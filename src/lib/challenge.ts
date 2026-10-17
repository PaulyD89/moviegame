import "server-only";
import { after } from "next/server";
import { matchGuess, startCard, usedKeysFor } from "./game";
import { claimKey, claimsFor } from "./names";
import { logError } from "./errors";
import { notifyPlayers } from "./push";
import { createAdminClient } from "./supabase/admin";
import {
  MAX_PLAYERS,
  SHOT_CLOCK_MS,
  ABANDON_MS, HOST_AWAY_MS, STALL_MS,
  type ChallengeView,
  type MoveOutcome,
  type MoveResult,
} from "./challenge-types";
import { cardKey, WORD, type Card } from "./types";

const LIVE_MS = 15_000; // seen this recently = "on the screen right now"
const HEARTBEAT_MS = 5_000;

type ChallengeRow = {
  id: string;
  status: "lobby" | "playing" | "finished";
  host_id: string;
  card: Card | null;
  used: string[];
  turn_seat: number | null;
  turn_started_at: string | null;
  turn_deadline: string | null;
  winner_id: string | null;
  version: number;
  code: string | null;
  rematch_id: string | null;
};

type PlayerRow = {
  player_id: string;
  seat: number;
  nickname: string;
  letters: number;
  last_seen: string;
};

type WaitRow = { player_id: string; nickname: string };

type MoveRow = {
  id: number;
  player_id: string;
  prompt: Card;
  guess: string | null;
  outcome: MoveOutcome;
  answer: Card | null;
};

const db = () => createAdminClient();
const isOut = (p: PlayerRow) => p.letters >= WORD.length;
const isLive = (p: PlayerRow, now: number) => now - Date.parse(p.last_seen) < LIVE_MS;
/** The host left the lobby screen (sent the invite from another app and never came back...). */
const hostAway = (players: PlayerRow[], c: ChallengeRow, now: number) => {
  const host = players.find((p) => p.player_id === c.host_id);
  return c.status === "lobby" && (!host || now - Date.parse(host.last_seen) > HOST_AWAY_MS);
};

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const newCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

const promptLine = (card: Card) =>
  card.kind === "movie" ? `Name an actor in ${card.name}.` : `Name a movie with ${card.name}.`;

/**
 * Push a notification after the response is sent, so a slow push never delays a move.
 * Players already looking at this game see the move on screen, so they don't get one.
 */
function notifyLater(players: PlayerRow[], title: string, body: string, challengeId: string) {
  const now = Date.now();
  const playerIds = players.filter((p) => !isLive(p, now)).map((p) => p.player_id);
  if (playerIds.length === 0) return;
  after(() =>
    notifyPlayers(playerIds, { title, body, url: `/c/${challengeId}`, tag: `challenge-${challengeId}` }).catch(
      (e) => logError("server", `Push failed: ${e instanceof Error ? e.message : String(e)}`, `challenge ${challengeId}`),
    ),
  );
}

export function cleanNickname(name: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, 20);
}

async function load(id: string) {
  const supabase = db();
  const [c, p, m, w] = await Promise.all([
    supabase.from("challenges").select("*").eq("id", id).maybeSingle<ChallengeRow>(),
    supabase.from("challenge_players").select("*").eq("challenge_id", id).order("seat"),
    supabase
      .from("challenge_moves")
      .select("id, player_id, prompt, guess, outcome, answer")
      .eq("challenge_id", id)
      .order("id", { ascending: false })
      .limit(300), // enough for a whole game, so final standings and link counts are complete
    supabase.from("challenge_waitlist").select("player_id, nickname").eq("challenge_id", id).order("joined_at"),
  ]);
  if (c.error) throw c.error;
  if (!c.data) return null;
  return {
    challenge: c.data,
    players: (p.data ?? []) as PlayerRow[],
    moves: ((m.data ?? []) as MoveRow[]).reverse(),
    waiting: (w.data ?? []) as WaitRow[],
  };
}

/** Next seat after `fromSeat` among players still in the game. */
function nextSeat(players: PlayerRow[], fromSeat: number) {
  const alive = players.filter((p) => !isOut(p));
  return (alive.find((p) => p.seat > fromSeat) ?? alive[0]).seat;
}

/** Start a turn: the shot clock only runs when everyone still in is on the screen. */
function turnTiming(players: PlayerRow[], now: number) {
  const everyoneLive = players.filter((p) => !isOut(p)).every((p) => isLive(p, now));
  return {
    turn_started_at: new Date(now).toISOString(),
    turn_deadline: everyoneLive ? new Date(now + SHOT_CLOCK_MS).toISOString() : null,
  };
}

/** Write only if nobody else moved first. */
async function commit(c: ChallengeRow, patch: Partial<ChallengeRow>) {
  const { data, error } = await db()
    .from("challenges")
    .update({ ...patch, version: c.version + 1, updated_at: new Date().toISOString() })
    .eq("id", c.id)
    .eq("version", c.version)
    .select("id");
  if (error) throw error;
  return (data ?? []).length === 1;
}

/** A new empty game with its own join code. */
async function insertChallenge(hostId: string) {
  // Codes are random; on the rare collision, try another.
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await db()
      .from("challenges")
      .insert({ host_id: hostId, code: newCode() })
      .select("id")
      .single<{ id: string }>();
    if (res.data) return res.data.id;
    if (res.error && res.error.code !== "23505") throw res.error;
  }
  throw new Error("Couldn't create a game code");
}

export async function createChallenge(playerId: string, nickname: string) {
  const id = await insertChallenge(playerId);
  const joined = await db()
    .from("challenge_players")
    .insert({ challenge_id: id, player_id: playerId, seat: 0, nickname });
  if (joined.error) throw joined.error;
  return id;
}

/**
 * Same players, new game. Everyone is already seated (order shifted by one so someone new
 * goes first), and whoever asked for the rematch hosts it. If two people ask at once,
 * both end up in the same game.
 */
export async function rematchChallenge(id: string, playerId: string): Promise<string | null> {
  const state = await load(id);
  if (!state || state.challenge.status !== "finished") return null;
  const { challenge, players } = state;
  const me = players.find((p) => p.player_id === playerId);
  if (!me) return null;
  if (challenge.rematch_id) return challenge.rematch_id;

  const newId = await insertChallenge(playerId);
  const rotated = [...players.slice(1), players[0]];
  const seated = await db()
    .from("challenge_players")
    .insert(
      rotated.map((p, seat) => ({
        challenge_id: newId,
        player_id: p.player_id,
        seat,
        nickname: p.nickname,
        last_seen: p.last_seen,
      })),
    );
  if (seated.error) throw seated.error;

  const linked = await db()
    .from("challenges")
    .update({ rematch_id: newId })
    .eq("id", id)
    .is("rematch_id", null)
    .select("id");
  if (!linked.data?.length) {
    // Someone else's rematch got there first; use theirs.
    await db().from("challenges").delete().eq("id", newId);
    return (await load(id))?.challenge.rematch_id ?? null;
  }

  // Friends who showed up late get the open seats.
  const late = state.waiting
    .filter((w) => !players.some((p) => p.player_id === w.player_id))
    .slice(0, MAX_PLAYERS - players.length);
  if (late.length) {
    await db()
      .from("challenge_players")
      .insert(late.map((w, i) => ({ challenge_id: newId, player_id: w.player_id, seat: players.length + i, nickname: w.nickname })));
    notifyLater(
      late.map((w) => ({ player_id: w.player_id, seat: -1, nickname: w.nickname, letters: 0, last_seen: new Date(0).toISOString() })),
      "🐴 You're in the next game!",
      `${me.nickname} started a rematch. Tap to join the lobby.`,
      newId,
    );
  }
  await db().from("challenge_waitlist").delete().eq("challenge_id", id);

  notifyLater(
    players.filter((p) => p.player_id !== playerId),
    `🐴 ${me.nickname} wants a rematch!`,
    "Same crew, new chain. Tap to jump back in.",
    newId,
  );
  return newId;
}

export async function joinChallenge(id: string, playerId: string, nickname: string) {
  const state = await load(id);
  if (!state) return { ok: false as const, reason: "not-found" };
  const { challenge, players } = state;
  if (players.some((p) => p.player_id === playerId)) return { ok: true as const };
  if (challenge.status !== "lobby") return { ok: false as const, reason: "started" };
  if (players.length >= MAX_PLAYERS) return { ok: false as const, reason: "full" };

  const seat = Math.max(-1, ...players.map((p) => p.seat)) + 1;
  const { error } = await db()
    .from("challenge_players")
    .insert({ challenge_id: id, player_id: playerId, seat, nickname });
  // A simultaneous join can grab the same seat; the unique constraint rejects one of them.
  if (error) return { ok: false as const, reason: "retry" };
  notifyLater(
    players.filter((p) => p.player_id === challenge.host_id),
    `🐴 ${nickname} joined your game`,
    `${players.length + 1} players in the lobby. Start whenever you're ready.`,
    id,
  );
  return { ok: true as const };
}

/**
 * Someone opened the link after the game started: put them in line for the rematch.
 * In a lobby they just join; if a rematch already exists, they join that.
 */
type WaitResult = { ok: true; rematchId?: string } | { ok: false; reason: string };

export async function waitForNext(id: string, playerId: string, nickname: string): Promise<WaitResult> {
  const state = await load(id);
  if (!state) return { ok: false, reason: "not-found" };
  const { challenge, players, waiting } = state;
  if (players.some((p) => p.player_id === playerId)) return { ok: true };
  if (challenge.status === "lobby") return joinChallenge(id, playerId, nickname);
  if (challenge.rematch_id) {
    // The next game already exists (maybe even started): get in line for that one instead.
    const next = await waitForNext(challenge.rematch_id, playerId, nickname);
    return next.ok ? { ok: true, rematchId: next.rematchId ?? challenge.rematch_id } : next;
  }
  const others = waiting.filter((w) => w.player_id !== playerId);
  if (players.length + others.length >= MAX_PLAYERS) return { ok: false, reason: "full" };
  const { error } = await db()
    .from("challenge_waitlist")
    .upsert({ challenge_id: id, player_id: playerId, nickname });
  return error ? { ok: false, reason: "retry" } : { ok: true };
}

export async function startChallenge(id: string, playerId: string) {
  const state = await load(id);
  if (!state) return false;
  const { challenge, players } = state;
  const me = players.find((p) => p.player_id === playerId);
  const byHost = challenge.host_id === playerId;
  if (!me || (!byHost && !hostAway(state.players, challenge, Date.now()))) return false;
  if (challenge.status !== "lobby" || players.length < 2) return false;
  // Started for an absent host: the starter goes first, since the host may not be back soon.
  const first = byHost ? players[0] : me;
  const used = new Set<string>();
  const card = await startCard(used, `${id}:start`);
  const started = await commit(challenge, {
    status: "playing",
    card,
    used: [cardKey(card)],
    turn_seat: first.seat,
    ...turnTiming(players, Date.now()),
  });
  if (started) {
    const host = me.nickname;
    if (first.player_id !== playerId) {
      notifyLater([first], "🐴 Game on. Your turn!", promptLine(card), id);
    }
    notifyLater(
      players.filter((p) => p.player_id !== playerId && p.player_id !== first.player_id),
      "🐴 Game on!",
      `${host} started the game. ${first.nickname} goes first.`,
      id,
    );
  }
  return started;
}

async function applyMove(
  challenge: ChallengeRow,
  players: PlayerRow[],
  outcome: MoveOutcome,
  guess: string | null,
  answer: Card | null,
): Promise<boolean> {
  const now = Date.now();
  const mover = players.find((p) => p.seat === challenge.turn_seat)!;
  const used = new Set(challenge.used);
  let card: Card;

  if (outcome === "correct" && answer) {
    card = answer; // the answer becomes the next player's prompt
  } else {
    mover.letters += 1;
    card = await startCard(used, `${challenge.id}:${challenge.version}`);
  }
  for (const key of usedKeysFor(card)) used.add(key);

  const alive = players.filter((p) => !isOut(p));
  const finished = alive.length <= 1;
  const next = finished ? null : nextSeat(players, mover.seat);
  const committed = await commit(challenge, {
    card,
    used: [...used],
    ...(finished
      ? { status: "finished", winner_id: alive[0]?.player_id ?? null, turn_seat: null, turn_deadline: null }
      : { turn_seat: next, ...turnTiming(players, now) }),
  });
  if (!committed) return false;

  const what =
    outcome === "correct"
      ? `${mover.nickname} said ${answer!.name} ✓`
      : outcome === "timeout"
        ? `${mover.nickname} ran out of time`
        : outcome === "skip"
          ? `${mover.nickname} was skipped after a day`
          : outcome === "pass"
            ? `${mover.nickname} passed`
            : `${mover.nickname} missed`;
  if (finished) {
    const winner = alive[0];
    notifyLater(
      players.filter((p) => p.player_id !== mover.player_id || outcome === "timeout" || outcome === "skip"),
      winner ? `🏆 ${winner.nickname} wins Movie Horse!` : "🐴 Game over",
      `${what}. That's the game.`,
      challenge.id,
    );
  } else {
    const up = players.find((p) => p.seat === next)!;
    notifyLater([up], "🐴 Your turn!", `${what}. ${promptLine(card)}`, challenge.id);
    if (outcome === "skip") {
      notifyLater(
        [mover],
        "⏰ You got skipped",
        `Your turn sat for a day, so that's ${WORD[mover.letters - 1]}. It's ${up.nickname}'s turn now.`,
        challenge.id,
      );
    }
  }

  const supabase = db();
  await Promise.all([
    outcome === "correct"
      ? null
      : supabase
          .from("challenge_players")
          .update({ letters: mover.letters })
          .eq("challenge_id", challenge.id)
          .eq("player_id", mover.player_id),
    supabase.from("challenge_moves").insert({
      challenge_id: challenge.id,
      player_id: mover.player_id,
      prompt: challenge.card,
      guess,
      outcome,
      answer,
    }),
  ]);
  return true;
}

export async function submitMove(
  id: string,
  playerId: string,
  version: number,
  guess: string | null,
): Promise<MoveResult> {
  const state = await load(id);
  if (!state || state.challenge.status !== "playing" || !state.challenge.card) {
    return { ok: false, reason: "not-playing" };
  }
  const { challenge, players } = state;
  const me = players.find((p) => p.player_id === playerId);
  if (!me || me.seat !== challenge.turn_seat) return { ok: false, reason: "not-your-turn" };
  if (challenge.version !== version) return { ok: false, reason: "stale" };

  if (guess === null) {
    return (await applyMove(challenge, players, "pass", null, null))
      ? { ok: true, outcome: "pass" }
      : { ok: false, reason: "stale" };
  }

  const result = await matchGuess(challenge.card!, guess, new Set(challenge.used));
  if (result.outcome === "used") return { ok: false, reason: "used", answer: result.answer };

  const answer = result.outcome === "correct" ? result.answer : null;
  const ok = await applyMove(challenge, players, result.outcome, guess, answer);
  if (!ok) return { ok: false, reason: "stale" };
  return { ok: true, outcome: result.outcome, answer: answer ?? undefined };
}

/**
 * Run out an expired turn: the shot clock in live games, or a day's wait in take-your-time
 * games. Applied whenever anyone looks at the game, and by the nightly sweep.
 */
async function enforceClock(c: ChallengeRow, players: PlayerRow[], now: number) {
  if (c.status !== "playing") return false;
  if (c.turn_deadline) {
    if (now <= Date.parse(c.turn_deadline) + 1_000) return false;
    return applyMove(c, players, "timeout", null, null);
  }
  if (!c.turn_started_at || now - Date.parse(c.turn_started_at) < STALL_MS) return false;
  return applyMove(c, players, "skip", null, null);
}

/** Skip every turn that has sat for a day, so the next player gets pinged. */
export async function sweepStalled() {
  await closeAbandoned();
  const { data } = await db()
    .from("challenges")
    .select("id")
    .eq("status", "playing")
    .is("turn_deadline", null)
    .lt("turn_started_at", new Date(Date.now() - STALL_MS).toISOString())
    .limit(200);
  let skipped = 0;
  for (const { id } of data ?? []) {
    const state = await load(id);
    if (state && (await enforceClock(state.challenge, state.players, Date.now()))) skipped++;
  }
  return skipped;
}

/**
 * Close games nobody has opened in ABANDON_MS: finished with no winner, so nobody gets a win or
 * a loss, and no notifications. Otherwise the daily skips would drag a ghost game on for a week.
 */
async function closeAbandoned() {
  const cutoff = Date.now() - ABANDON_MS;
  const { data } = await db()
    .from("challenges")
    .select("id, challenge_players(last_seen)")
    .eq("status", "playing")
    .lt("updated_at", new Date(Date.now() - STALL_MS).toISOString())
    .limit(200);
  const stale = ((data ?? []) as { id: string; challenge_players: { last_seen: string }[] }[]).filter((c) =>
    c.challenge_players.every((p) => Date.parse(p.last_seen) < cutoff),
  );
  for (const { id } of stale) {
    const state = await load(id);
    if (state?.challenge.status === "playing") {
      await commit(state.challenge, { status: "finished", winner_id: null, turn_seat: null, turn_deadline: null });
    }
  }
  return stale.length;
}

/**
 * A player's VS record from the server, so every device linked by a save code shows the same
 * numbers. Games closed as abandoned (no winner) don't count.
 */
export async function vsRecord(playerId: string) {
  const { data } = await db()
    .from("challenge_players")
    .select("challenges!inner(status, winner_id)")
    .eq("player_id", playerId)
    .eq("challenges.status", "finished")
    .not("challenges.winner_id", "is", null);
  const games = (data ?? []) as unknown as { challenges: { winner_id: string } }[];
  return { played: games.length, won: games.filter((g) => g.challenges.winner_id === playerId).length };
}

/** The host can remove someone from the lobby (say, a friend who never showed up). */
export async function removeFromLobby(id: string, hostId: string, seat: number) {
  const state = await load(id);
  if (!state || state.challenge.status !== "lobby" || state.challenge.host_id !== hostId) return false;
  const target = state.players.find((p) => p.seat === seat);
  if (!target || target.player_id === hostId) return false;
  const { error } = await db()
    .from("challenge_players")
    .delete()
    .eq("challenge_id", id)
    .eq("player_id", target.player_id);
  return !error;
}

/** The player left the screen (closed the app, switched away), so turn alerts should reach them. */
export async function markAway(id: string, playerId: string) {
  const state = await load(id);
  const me = state?.players.find((p) => p.player_id === playerId);
  if (!state || !me) return;
  const wasWatching = isLive(me, Date.now());
  const away = new Date(Date.now() - LIVE_MS - 1_000).toISOString();
  await db().from("challenge_players").update({ last_seen: away }).eq("challenge_id", id).eq("player_id", playerId);

  // Leaving while it's your turn: the "your turn" alert was skipped because you were watching,
  // so send it now (once per leave) or the game just sits there.
  const { challenge } = state;
  if (wasWatching && challenge.status === "playing" && challenge.turn_seat === me.seat && challenge.card) {
    const last = state.moves.at(-1);
    const mover = last && state.players.find((p) => p.player_id === last.player_id);
    notifyLater(
      [{ ...me, last_seen: away }],
      "🐴 Still your turn!",
      `${mover ? `${mover.nickname} is waiting. ` : ""}${promptLine(challenge.card)}`,
      id,
    );
  }
}

/** Read a challenge for one player. Also records that they're watching and enforces the shot clock. */
export async function viewChallenge(id: string, playerId: string | null): Promise<ChallengeView | null> {
  let state = await load(id);
  if (!state) return null;
  const now = Date.now();

  const me = state.players.find((p) => p.player_id === playerId);
  if (me && now - Date.parse(me.last_seen) > HEARTBEAT_MS) {
    await db()
      .from("challenge_players")
      .update({ last_seen: new Date(now).toISOString() })
      .eq("challenge_id", id)
      .eq("player_id", me.player_id);
    me.last_seen = new Date(now).toISOString();
  }

  if (await enforceClock(state.challenge, state.players, now)) state = (await load(id))!;

  const c = state.challenge;
  // A late friend who's been seated in the rematch: tell them where to go.
  let youInNext = false;
  if (c.rematch_id && playerId && !me) {
    const { data } = await db()
      .from("challenge_players")
      .select("player_id")
      .eq("challenge_id", c.rematch_id)
      .eq("player_id", playerId)
      .maybeSingle();
    youInNext = !!data;
  }
  const nickname = (pid: string) =>
    state.players.find((p) => p.player_id === pid)?.nickname ?? "Someone";
  const claims = await claimsFor(state.players.map((p) => p.player_id));
  return {
    id: c.id,
    status: c.status,
    card: c.card,
    turnSeat: c.turn_seat,
    turnDeadline: c.turn_deadline ? Date.parse(c.turn_deadline) : null,
    serverNow: now,
    winner: c.winner_id ? nickname(c.winner_id) : null,
    winnerSeat: state.players.find((p) => p.player_id === c.winner_id)?.seat ?? null,
    version: c.version,
    players: state.players.map((p) => ({
      seat: p.seat,
      nickname: p.nickname,
      claimed: claims.get(p.player_id) === claimKey(p.nickname),
      letters: p.letters,
      out: isOut(p),
      live: isLive(p, now),
      isHost: p.player_id === c.host_id,
      isYou: p.player_id === playerId,
    })),
    moves: state.moves.map((m) => ({
      id: m.id,
      nickname: nickname(m.player_id),
      seat: state.players.find((p) => p.player_id === m.player_id)?.seat ?? -1,
      prompt: m.prompt,
      guess: m.guess,
      outcome: m.outcome,
      answer: m.answer,
    })),
    youSeat: me?.seat ?? null,
    youAreHost: c.host_id === playerId,
    hostAway: hostAway(state.players, c, now),
    code: c.code,
    rematchId: c.rematch_id,
    waiting: state.waiting.map((w) => w.nickname),
    youWaiting: !!playerId && state.waiting.some((w) => w.player_id === playerId),
    youInNext,
  };
}

export async function findByCode(code: string) {
  const { data } = await db().from("challenges").select("id").eq("code", code).maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

export type ChallengeSummary = {
  id: string;
  status: ChallengeRow["status"];
  players: string[];
  /** Everyone but you, for "vs …". */
  others: string[];
  yourTurn: boolean;
  turnName: string | null;
  winner: string | null;
  youWon: boolean;
  updatedAt: string;
};

/** One-line status for each game in a device's "Your games" list. */
export async function summarizeChallenges(ids: string[], playerId: string | null): Promise<ChallengeSummary[]> {
  const supabase = db();
  // Run out any of these games whose turn has sat too long, so the list (and badge) is current.
  const { data: waiting } = await supabase
    .from("challenges")
    .select("id")
    .in("id", ids)
    .eq("status", "playing")
    .or(
      `turn_deadline.lt."${new Date(Date.now() - 1_000).toISOString()}",` +
        `turn_started_at.lt."${new Date(Date.now() - STALL_MS).toISOString()}"`,
    );
  for (const { id } of waiting ?? []) {
    const state = await load(id);
    if (state) await enforceClock(state.challenge, state.players, Date.now());
  }

  const [c, p] = await Promise.all([
    supabase.from("challenges").select("id, status, turn_seat, winner_id, updated_at").in("id", ids),
    supabase.from("challenge_players").select("challenge_id, player_id, seat, nickname").in("challenge_id", ids),
  ]);
  const players = (p.data ?? []) as { challenge_id: string; player_id: string; seat: number; nickname: string }[];
  return ((c.data ?? []) as (Pick<ChallengeRow, "id" | "status" | "turn_seat" | "winner_id"> & { updated_at: string })[])
    .map((row) => {
      const mine = players.filter((x) => x.challenge_id === row.id).sort((a, b) => a.seat - b.seat);
      const turn = mine.find((x) => x.seat === row.turn_seat);
      const winner = mine.find((x) => x.player_id === row.winner_id);
      return {
        id: row.id,
        status: row.status,
        players: mine.map((x) => x.nickname),
        others: mine.filter((x) => x.player_id !== playerId).map((x) => x.nickname),
        yourTurn: row.status === "playing" && !!playerId && turn?.player_id === playerId,
        turnName: turn?.nickname ?? null,
        winner: winner?.nickname ?? null,
        youWon: !!playerId && winner?.player_id === playerId,
        updatedAt: row.updated_at,
      };
    })
    // Your turn first, then games still going, then finished; newest first within each.
    .sort(
      (a, b) =>
        Number(b.yourTurn) - Number(a.yourTurn) ||
        Number(a.status === "finished") - Number(b.status === "finished") ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
}
