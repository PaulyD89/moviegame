"use server";

import { puzzleDate, puzzleNumber } from "@/lib/daily-clock";
import { answerStats } from "@/lib/answer-stats";
import { dailyRank } from "@/lib/daily-log";
import { openDaily, playDaily, type DailyState } from "@/lib/daily-play";
import { playerId } from "@/lib/player";
import { globalRank } from "@/lib/rank";
import { allow } from "@/lib/rate-limit";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Only today's puzzle (give or take a day for clock skew): a phone with a wrong clock shouldn't create next month's. */
function checkDate(dateStr: string) {
  if (!DATE.test(dateStr)) throw new Error("Bad date");
  const day = 86_400_000;
  const allowed = [-day, 0, day].map((offset) => puzzleDate(new Date(Date.now() + offset)));
  if (!allowed.includes(dateStr)) throw new Error("Date out of range");
}

/**
 * Today's game as the server keeps it. `legacy` is a game this phone had in progress from
 * before the server kept games (carried over once, unranked).
 */
export async function openToday(dateStr: string, legacy: DailyState | null) {
  checkDate(dateStr);
  return openDaily(dateStr, await playerId(true), legacy);
}

/** A guess, or a pass when `guess` is null. */
export async function playToday(dateStr: string, guess: string | null) {
  checkDate(dateStr);
  const pid = await playerId(true);
  if (!(await allow("guess", pid))) return { outcome: "slow" as const };
  return playDaily(dateStr, pid, guess === null ? null : guess.slice(0, 120));
}

export async function myDailyRank(puzzle: number) {
  const day = 86_400_000;
  const allowed = [-day, 0, day].map((o) => puzzleNumber(puzzleDate(new Date(Date.now() + o))));
  if (!Number.isInteger(puzzle) || !allowed.includes(puzzle)) throw new Error("Not a current puzzle");
  const pid = await playerId(false);
  return pid ? dailyRank(puzzle, pid) : null;
}

/** Global ranking for the stats screen; null for a phone that hasn't played yet. */
export async function myGlobalRank() {
  const pid = await playerId(false);
  return pid ? globalRank(pid) : null;
}

/** How this player's answers in a finished daily compare with everyone's. */
export async function myAnswerStats(puzzle: number) {
  const day = 86_400_000;
  const allowed = [-day, 0, day].map((o) => puzzleNumber(puzzleDate(new Date(Date.now() + o))));
  if (!Number.isInteger(puzzle) || !allowed.includes(puzzle)) return [];
  const pid = await playerId(false);
  return pid ? answerStats(puzzle, pid) : [];
}
