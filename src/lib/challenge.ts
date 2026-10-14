import "server-only";
import { matchGuess, startCard } from "./game";
import { createAdminClient } from "./supabase/admin";
import {
  MAX_PLAYERS,
  SHOT_CLOCK_MS,
  type ChallengeView,
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
};

type PlayerRow = {
  player_id: string;
  seat: number;
  nickname: string;
  letters: number;
  last_seen: string;
};

type MoveRow = {
  id: number;
  player_id: string;
  prompt: Card;
  guess: string | null;
  outcome: "correct" | "wrong" | "pass" | "timeout";
  answer: Card | null;
};

const db = () => createAdminClient();
const isOut = (p: PlayerRow) => p.letters >= WORD.length;
const isLive = (p: PlayerRow, now: number) => now - Date.parse(p.last_seen) < LIVE_MS;

export function cleanNickname(name: string) {
  return name.replace(/\s+/g, " ").trim().slice(0, 20);
}

async function load(id: string) {
  const supabase = db();
  const [c, p, m] = await Promise.all([
    supabase.from("challenges").select("*").eq("id", id).maybeSingle<ChallengeRow>(),
    supabase.from("challenge_players").select("*").eq("challenge_id", id).order("seat"),
    supabase
      .from("challenge_moves")
      .select("id, player_id, prompt, guess, outcome, answer")
      .eq("challenge_id", id)
      .order("id", { ascending: false })
      .limit(40),
  ]);
  if (c.error) throw c.error;
  if (!c.data) return null;
  return {
    challenge: c.data,
    players: (p.data ?? []) as PlayerRow[],
    moves: ((m.data ?? []) as MoveRow[]).reverse(),
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

export async function createChallenge(playerId: string, nickname: string) {
  const supabase = db();
  const { data, error } = await supabase
    .from("challenges")
    .insert({ host_id: playerId })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  const joined = await supabase
    .from("challenge_players")
    .insert({ challenge_id: data.id, player_id: playerId, seat: 0, nickname });
  if (joined.error) throw joined.error;
  return data.id;
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
  return { ok: true as const };
}

export async function startChallenge(id: string, playerId: string) {
  const state = await load(id);
  if (!state) return false;
  const { challenge, players } = state;
  if (challenge.host_id !== playerId || challenge.status !== "lobby" || players.length < 2) {
    return false;
  }
  const used = new Set<string>();
  const card = await startCard(used, `${id}:start`);
  return commit(challenge, {
    status: "playing",
    card,
    used: [cardKey(card)],
    turn_seat: players[0].seat,
    ...turnTiming(players, Date.now()),
  });
}

async function applyMove(
  challenge: ChallengeRow,
  players: PlayerRow[],
  outcome: "correct" | "wrong" | "pass" | "timeout",
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
  used.add(cardKey(card));

  const alive = players.filter((p) => !isOut(p));
  const finished = alive.length <= 1;
  const committed = await commit(challenge, {
    card,
    used: [...used],
    ...(finished
      ? { status: "finished", winner_id: alive[0]?.player_id ?? null, turn_seat: null, turn_deadline: null }
      : { turn_seat: nextSeat(players, mover.seat), ...turnTiming(players, now) }),
  });
  if (!committed) return false;

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

  const { challenge } = state;
  if (
    challenge.status === "playing" &&
    challenge.turn_deadline &&
    now > Date.parse(challenge.turn_deadline) + 1_000
  ) {
    await applyMove(challenge, state.players, "timeout", null, null);
    state = (await load(id))!;
  }

  const c = state.challenge;
  const nickname = (pid: string) =>
    state.players.find((p) => p.player_id === pid)?.nickname ?? "Someone";
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
      letters: p.letters,
      out: isOut(p),
      live: isLive(p, now),
      isHost: p.player_id === c.host_id,
      isYou: p.player_id === playerId,
    })),
    moves: state.moves.map((m) => ({
      id: m.id,
      nickname: nickname(m.player_id),
      prompt: m.prompt,
      guess: m.guess,
      outcome: m.outcome,
      answer: m.answer,
    })),
    youSeat: me?.seat ?? null,
    youAreHost: c.host_id === playerId,
  };
}
