"use server";

import { playerId, setPlayerCookie } from "@/lib/player";
import { backupProgress, cleanCode, cleanSnapshot, restoreProgress, saveProgress } from "@/lib/progress";
import { allow } from "@/lib/rate-limit";

/** Your save code (created the first time), backing up this phone's stats with it. */
export async function getSaveCode(snapshot: unknown) {
  return saveProgress(await playerId(true), cleanSnapshot(snapshot));
}

/** Quietly refresh the backup after a game. */
export async function backup(snapshot: unknown) {
  const pid = await playerId(false);
  if (pid) await backupProgress(pid, cleanSnapshot(snapshot));
}

export async function restore(input: string) {
  const code = cleanCode(input);
  if (!code) return { ok: false as const, reason: "format" };
  const current = await playerId(false);
  if (!(await allow("restore", current))) return { ok: false as const, reason: "slow" };
  const found = await restoreProgress(code, current);
  if (!found) return { ok: false as const, reason: "not-found" };
  await setPlayerCookie(found.playerId);
  return { ok: true as const, snapshot: found.snapshot };
}
