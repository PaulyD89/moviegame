import "server-only";
import { checkGuess, dailyStart, passCard, usedKeysFor } from "./game";
import { createAdminClient } from "./supabase/admin";
import { cardKey, FAST_MS, LINKS_TO_WIN, WORD, type Card } from "./types";

const GRACE_MS = 2_000; // network time between the phone and the server

/** "skip" is a free pass right after a miss, so one card never costs two letters. */
export type GameEvent = "correct" | "wrong" | "pass" | "skip";

/** One player's daily game, as kept by the server. */
export type DailyState = {
  card: Card;
  /** The answer that led to the current card (null at the start or after a dead end). */
  from: Card | null;
  links: { card: Card; answer: Card; fast?: boolean }[];
  events: GameEvent[];
  used: string[];
  letters: number;
  status: "playing" | "won" | "lost";
  fastLinks: number;
  /** Set when the game ends: first card to last move. */
  durationMs?: number;
};

/** What the phone gets back after opening the daily or making a move. */
export type DailySync = {
  number: number;
  state: DailyState;
  cardShownAt: number;
  serverNow: number;
};

type Row = {
  puzzle_number: number;
  player_id: string;
  state: DailyState | null;
  card_shown_at: string | null;
  started_at: string;
  finished_at: string | null;
  moves: number;
  won: boolean | null;
  letters: number | null;
};

const db = () => createAdminClient();

function freshState(card: Card): DailyState {
  return { card, from: null, links: [], events: [], used: [cardKey(card)], letters: 0, status: "playing", fastLinks: 0 };
}

async function loadRow(number: number, playerId: string) {
  const { data, error } = await db()
    .from("daily_plays")
    .select("puzzle_number, player_id, state, card_shown_at, started_at, finished_at, moves, won, letters")
    .eq("puzzle_number", number)
    .eq("player_id", playerId)
    .maybeSingle<Row>();
  if (error) throw error;
  return data;
}

const sync = (number: number, state: DailyState, cardShownAt: string | null): DailySync => ({
  number,
  state,
  cardShownAt: cardShownAt ? Date.parse(cardShownAt) : Date.now(),
  serverNow: Date.now(),
});

/** Keep only well-formed fields from a game a phone had in progress before server play. */
function sanitizeLegacy(g: DailyState, start: Card): DailyState | null {
  if (!g || !Array.isArray(g.events) || !Array.isArray(g.links) || !Array.isArray(g.used) || !g.card) return null;
  const letters = Math.min(WORD.length - 1, Math.max(0, Math.trunc(Number(g.letters) || 0)));
  return {
    card: g.card,
    from: g.from ?? null,
    links: g.links.slice(0, LINKS_TO_WIN - 1).map((l) => ({ card: l.card, answer: l.answer })),
    events: g.events.slice(0, 20).filter((e): e is GameEvent => ["correct", "wrong", "pass", "skip"].includes(e)),
    used: [...new Set([cardKey(start), ...g.used.filter((u) => typeof u === "string").slice(0, 200)])],
    letters,
    status: "playing",
    fastLinks: 0,
  };
}

/**
 * Open today's game for this player, creating it on first visit. Until the first move, each
 * open restarts the clock, so reading the rules or opening the app early doesn't cost time.
 * `legacy` is a game the phone had in progress before the server kept games; it carries over
 * but doesn't count toward the global rank.
 */
export async function openDaily(
  date: string,
  playerId: string,
  legacy: DailyState | null,
  /** Two-letter country from Vercel's geo header, kept for the admin page. */
  country: string | null = null,
  /** Where they arrived from ("Reddit ad", "Google", "Direct"...), for the admin page. */
  source: string | null = null,
): Promise<DailySync | null> {
  const { number, card } = await dailyStart(date);
  const now = new Date().toISOString();
  const row = await loadRow(number, playerId);

  if (!row) {
    const state = freshState(card);
    const { error } = await db()
      .from("daily_plays")
      .insert({ puzzle_number: number, player_id: playerId, state, card_shown_at: now, started_at: now, country, source });
    if (!error) return sync(number, state, now);
    if (error.code !== "23505") throw error;
    const raced = await loadRow(number, playerId); // opened twice at once
    return raced?.state ? sync(number, raced.state, raced.card_shown_at) : null;
  }

  if (row.state) {
    if (row.moves === 0 && row.state.status === "playing") {
      await db()
        .from("daily_plays")
        .update({ card_shown_at: now, started_at: now })
        .eq("puzzle_number", number)
        .eq("player_id", playerId)
        .eq("moves", 0);
      return sync(number, row.state, now);
    }
    return sync(number, row.state, row.card_shown_at);
  }

  // A game finished before server play (phones that still have it show their own copy).
  // Show the bare result; the chain itself wasn't kept back then.
  if (row.finished_at) {
    const state: DailyState = {
      ...freshState(card),
      status: row.won ? "won" : "lost",
      letters: row.letters ?? 0,
    };
    return sync(number, state, now);
  }
  const carried = legacy ? sanitizeLegacy(legacy, card) : null;
  const state = carried && carried.events.length > 0 ? carried : freshState(card);
  await db()
    .from("daily_plays")
    .update({ state, card_shown_at: now, moves: state.events.length, verified: !carried })
    .eq("puzzle_number", number)
    .eq("player_id", playerId);
  return sync(number, state, now);
}

export type DailyMove =
  | { outcome: "correct"; answer: Card; close: boolean; fast: boolean; sync: DailySync }
  | { outcome: "wrong" | "pass" | "skip"; sync: DailySync }
  | { outcome: "used"; answer: Card }
  | { outcome: "stale"; sync: DailySync | null };

/** Score one guess (or a pass, when `guess` is null) against the player's saved game. */
export async function playDaily(date: string, playerId: string, guess: string | null): Promise<DailyMove> {
  const { number } = await dailyStart(date);
  const row = await loadRow(number, playerId);
  if (!row?.state || row.state.status !== "playing") {
    return { outcome: "stale", sync: row?.state ? sync(number, row.state, row.card_shown_at) : null };
  }
  const s = row.state;
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  let next: DailyState;
  let cardShownAt = row.card_shown_at;
  let result: { outcome: "correct"; answer: Card; close: boolean; fast: boolean } | { outcome: "wrong" | "pass" | "skip" };

  if (guess === null) {
    const card = await passCard(s.card, s.from, s.used, date);
    const moved = { ...s, card, used: [...s.used, ...usedKeysFor(card)] };
    // A miss keeps the card, so it already cost its letter: moving on from it is free.
    const free = freeSkip(s);
    next = free ? { ...moved, events: [...s.events, "skip"] } : addLetter(moved, "pass");
    cardShownAt = now;
    result = { outcome: free ? "skip" : "pass" };
  } else {
    // A right answer here is link number links+1, and leads to card number links+2.
    const r = await checkGuess(s.card, guess, s.used, date, s.links.length + 2);
    if (r.outcome === "used") return { outcome: "used", answer: r.answer };
    if (r.outcome === "wrong") {
      next = addLetter(s, "wrong"); // same card, same clock
      result = { outcome: "wrong" };
      // Kept so /admin can spot answers the matcher should have accepted.
      await db()
        .from("missed_guesses")
        .insert({ puzzle_number: number, card: s.card, guess: guess.slice(0, 120) })
        .then(
          () => {},
          () => {},
        );
    } else {
      const shown = row.card_shown_at ? Date.parse(row.card_shown_at) : nowMs;
      const fast = nowMs - shown <= FAST_MS + GRACE_MS;
      const links = [...s.links, { card: s.card, answer: r.answer, fast }];
      next = {
        ...s,
        links,
        events: [...s.events, "correct"],
        used: [...s.used, cardKey(r.answer), ...(r.next ? usedKeysFor(r.next) : [])],
        card: r.next ?? s.card,
        from: r.answer,
        fastLinks: s.fastLinks + (fast ? 1 : 0),
        status: links.length >= LINKS_TO_WIN ? "won" : "playing",
      };
      cardShownAt = now;
      result = { outcome: "correct", answer: r.answer, close: r.close, fast };
    }
  }

  const done = next.status !== "playing";
  if (done) next.durationMs = nowMs - Date.parse(row.started_at);
  const { data, error } = await db()
    .from("daily_plays")
    .update({
      state: next,
      moves: row.moves + 1,
      card_shown_at: cardShownAt,
      fast_links: next.fastLinks,
      ...(done
        ? {
            finished_at: now,
            won: next.status === "won",
            links: next.links.length,
            letters: next.letters,
            duration_ms: next.durationMs,
          }
        : {}),
    })
    .eq("puzzle_number", number)
    .eq("player_id", playerId)
    .eq("moves", row.moves) // a double tap or a second tab moved first
    .select("puzzle_number");
  if (error) throw error;
  if (!data?.length) {
    const latest = await loadRow(number, playerId);
    return { outcome: "stale", sync: latest?.state ? sync(number, latest.state, latest.card_shown_at) : null };
  }
  return { ...result, sync: sync(number, next, cardShownAt) };
}

/** True when the last move was a miss on the current card, so passing it costs nothing. */
export function freeSkip(s: Pick<DailyState, "events">) {
  return s.events.at(-1) === "wrong";
}

function addLetter(s: DailyState, event: "wrong" | "pass"): DailyState {
  const letters = s.letters + 1;
  return { ...s, letters, events: [...s.events, event], status: letters >= WORD.length ? "lost" : "playing" };
}
