"use server";

import { checkGuess, dailyStart, passCard } from "@/lib/game";
import type { Card } from "@/lib/types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function startDaily(dateStr: string) {
  if (!DATE.test(dateStr)) throw new Error("Bad date");
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
