import type { Card } from "./types";

export const MAX_PLAYERS = 6;
export const SHOT_CLOCK_MS = 30_000;
/** A take-your-time turn nobody takes for this long is skipped with a letter. */
export const STALL_MS = 24 * 60 * 60 * 1000;
/** A game nobody has opened for this long is closed as abandoned: no winner, no win or loss. */
export const ABANDON_MS = 3 * 24 * 60 * 60 * 1000;

export type ChallengePlayer = {
  seat: number;
  nickname: string;
  /** Playing under the name they claimed with a 7-day streak (shown with a gold check). */
  claimed: boolean;
  letters: number;
  out: boolean;
  live: boolean;
  isHost: boolean;
  isYou: boolean;
};

export type ChallengeMove = {
  id: number;
  seat: number;
  nickname: string;
  prompt: Card;
  guess: string | null;
  outcome: MoveOutcome;
  answer: Card | null;
};

export type MoveOutcome = "correct" | "wrong" | "pass" | "timeout" | "skip";

/** Everything a phone needs to draw a challenge, from that player's point of view. */
export type ChallengeView = {
  id: string;
  status: "lobby" | "playing" | "finished";
  card: Card | null;
  turnSeat: number | null;
  turnDeadline: number | null;
  serverNow: number;
  winner: string | null;
  winnerSeat: number | null;
  version: number;
  players: ChallengePlayer[];
  moves: ChallengeMove[];
  youSeat: number | null;
  youAreHost: boolean;
  code: string | null;
  rematchId: string | null;
  /** Friends who arrived after the start and will be seated in the rematch. */
  waiting: string[];
  /** You opened the link late and asked to be in the next game. */
  youWaiting: boolean;
  /** You were waiting and have been seated in the rematch. */
  youInNext: boolean;
};

export type MoveResult =
  | { ok: true; outcome: "correct" | "wrong" | "pass"; answer?: Card }
  | { ok: false; reason: "used"; answer: Card }
  | { ok: false; reason: "not-your-turn" | "stale" | "not-playing" | "slow" };
