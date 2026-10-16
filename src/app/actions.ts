"use server";

import { headers } from "next/headers";
import { puzzleDate, puzzleNumber } from "@/lib/daily-clock";
import { answerStats } from "@/lib/answer-stats";
import { dailyRank } from "@/lib/daily-log";
import { openDaily, playDaily, type DailyState } from "@/lib/daily-play";
import { playerId } from "@/lib/player";
import { CLAIM_STREAK, claimName, claimedName, playStreak } from "@/lib/names";
import { globalRank } from "@/lib/rank";
import { allow } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { LINKS_TO_WIN } from "@/lib/types";
import type { BadgeFacts } from "@/lib/badges";

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
  const country = (await headers()).get("x-vercel-ip-country")?.slice(0, 2).toUpperCase() || null;
  return openDaily(dateStr, await playerId(true), legacy, country);
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

/** Daily achievements the server can vouch for, so badges follow a player across phones. */
export async function myBadgeFacts(): Promise<BadgeFacts | null> {
  const pid = await playerId(false);
  if (!pid) return null;
  const { data, error } = await createAdminClient()
    .from("daily_plays")
    .select("won, letters, fast_links, duration_ms")
    .eq("player_id", pid)
    .not("finished_at", "is", null);
  if (error) throw error;
  const wins = data.filter((r) => r.won);
  return {
    won: wins.length > 0,
    perfect: wins.some((r) => r.letters === 0),
    lightning: wins.some((r) => (r.fast_links ?? 0) >= LINKS_TO_WIN),
    fastestWinMs: wins.reduce<number | null>(
      (best, r) => (r.duration_ms && (best === null || r.duration_ms < best) ? r.duration_ms : best),
      null,
    ),
  };
}

/** Days in a row this player finished the daily (won or lost), and their best run. */
export async function myStreak() {
  const pid = await playerId(false);
  return pid ? playStreak(pid) : null;
}

/** This player's claimed name, and whether they've earned one (a 7-day streak). */
export async function myName() {
  const pid = await playerId(false);
  if (!pid) return { name: null, eligible: false };
  const [name, streak] = await Promise.all([claimedName(pid), playStreak(pid)]);
  return { name, eligible: streak.best >= CLAIM_STREAK };
}

/** Claim a name earned with a 7-day streak. */
export async function claimMyName(name: string) {
  const pid = await playerId(true);
  if (!(await allow("code", pid))) return { ok: false as const, reason: "slow" as const };
  return claimName(pid, String(name ?? ""));
}
