"use server";

import { dismissErrors, endAdminSession, getAdminStats, isAdmin, startAdminSession } from "@/lib/admin";
import { letterboxdKit } from "@/lib/letterboxd-kit";
import { suspectMisses } from "@/lib/missed";

export async function login(password: string) {
  // A small delay makes password guessing slow.
  await new Promise((r) => setTimeout(r, 500));
  return startAdminSession(String(password ?? ""));
}

export async function logout() {
  await endAdminSession();
}

export async function stats() {
  if (!(await isAdmin())) throw new Error("Not signed in");
  return getAdminStats();
}

/** Dismiss one error from the banner, or all of them. */
export async function dismiss(id?: number) {
  if (!(await isAdmin())) throw new Error("Not signed in");
  if (id !== undefined && !Number.isInteger(id)) throw new Error("Bad id");
  await dismissErrors(id);
}

/** Wrong guesses from the last few days that look like real answers (see lib/missed). */
export async function missedAnswers() {
  if (!(await isAdmin())) throw new Error("Not signed in");
  return suspectMisses();
}

/** Title, description and import file for a day's Letterboxd list (see lib/letterboxd-kit). */
export async function letterboxdList(number: number) {
  if (!(await isAdmin())) throw new Error("Not signed in");
  if (!Number.isInteger(number) || number < 1) throw new Error("Bad puzzle");
  return letterboxdKit(number);
}
