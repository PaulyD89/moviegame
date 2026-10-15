import type { Card } from "./types";

export const MAX_PLAYERS = 6;
export const SHOT_CLOCK_MS = 30_000;

export type ChallengePlayer = {
  seat: number;
  nickname: string;
  letters: number;
  out: boolean;
  live: boolean;
  isHost: boolean;
  isYou: boolean;
};

export type ChallengeMove = {
  id: number;
  nickname: string;
  prompt: Card;
  guess: string | null;
  outcome: "correct" | "wrong" | "pass" | "timeout";
  answer: Card | null;
};

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
};

export type MoveResult =
  | { ok: true; outcome: "correct" | "wrong" | "pass"; answer?: Card }
  | { ok: false; reason: "used"; answer: Card }
  | { ok: false; reason: "not-your-turn" | "stale" | "not-playing" };
