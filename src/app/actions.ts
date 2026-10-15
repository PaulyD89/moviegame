"use server";

import { puzzleDate, puzzleNumber } from "@/lib/daily-clock";
import { dailyRank, logDailyFinish, logDailyStart, type DailyFinish } from "@/lib/daily-log";
import { playerId } from "@/lib/player";
import { globalRank } from "@/lib/rank";
import { allow } from "@/lib/rate-limit";
import { checkGuess, dailyStart, passCard } from "@/lib/game";
import type { Card } from "@/lib/types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function startDaily(dateStr: string) {
  if (!DATE.test(dateStr)) throw new Error("Bad date");
  // Puzzles are saved forever, so only allow dates near today (Eastern) — a phone with a
  // wrong clock shouldn't be able to create next month's puzzle.
  const day = 86_400_000;
  const allowed = [-day, 0, day].map((offset) => puzzleDate(new Date(Date.now() + offset)));
  if (!allowed.includes(dateStr)) throw new Error("Date out of range");
  return dailyStart(dateStr);
}

export async function submitGuess(card: Card, guess: string, used: string[], dateStr: string) {
  if (!DATE.test(dateStr)) throw new Error("Bad date");
  if (!(await allow("guess", await playerId(false)))) return { outcome: "slow" as const };
  return checkGuess(card, guess.slice(0, 120), used.slice(0, 200), dateStr);
}

/** The replacement card, or null if this player is going too fast. */
export async function pass(card: Card, from: Card | null, used: string[], dateStr: string) {
  if (!DATE.test(dateStr)) throw new Error("Bad date");
  if (!(await allow("guess", await playerId(false)))) return null;
  return passCard(card, from, used.slice(0, 200), dateStr);
}

/** Only today's puzzle (give or take a day for clock skew) can be logged. */
function currentPuzzle(puzzle: number) {
  const day = 86_400_000;
  const allowed = [-day, 0, day].map((o) => puzzleNumber(puzzleDate(new Date(Date.now() + o))));
  if (!Number.isInteger(puzzle) || !allowed.includes(puzzle)) throw new Error("Not a current puzzle");
}

export async function dailyStarted(puzzle: number) {
  currentPuzzle(puzzle);
  await logDailyStart(puzzle, await playerId(true));
}

export async function dailyFinished(puzzle: number, result: DailyFinish) {
  currentPuzzle(puzzle);
  const clean: DailyFinish = {
    won: Boolean(result.won),
    links: Math.min(10, Math.max(0, Math.trunc(result.links))),
    letters: Math.min(5, Math.max(0, Math.trunc(result.letters))),
    durationMs: Math.min(86_400_000, Math.max(0, Math.trunc(result.durationMs))),
  };
  const pid = await playerId(true);
  await logDailyFinish(puzzle, pid, clean);
  return dailyRank(puzzle, pid);
}

export async function myDailyRank(puzzle: number) {
  currentPuzzle(puzzle);
  const pid = await playerId(false);
  return pid ? dailyRank(puzzle, pid) : null;
}

/** Global ranking for the stats screen; null for a phone that hasn't played yet. */
export async function myGlobalRank() {
  const pid = await playerId(false);
  return pid ? globalRank(pid) : null;
}
