"use server";

import { puzzleDate } from "@/lib/daily-clock";
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
  return checkGuess(card, guess.slice(0, 120), used.slice(0, 200), dateStr);
}

export async function pass(card: Card, from: Card | null, used: string[], dateStr: string) {
  if (!DATE.test(dateStr)) throw new Error("Bad date");
  return passCard(card, from, used.slice(0, 200), dateStr);
}
