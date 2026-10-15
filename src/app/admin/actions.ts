"use server";

import { dismissErrors, endAdminSession, getAdminStats, isAdmin, startAdminSession } from "@/lib/admin";

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
