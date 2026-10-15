"use server";

import { logError } from "@/lib/errors";
import { playerId } from "@/lib/player";
import { allow } from "@/lib/rate-limit";

export async function reportPhoneError(message: string, path: string) {
  if (typeof message !== "string" || typeof path !== "string") return;
  if (!(await allow("report", await playerId(false)))) return;
  await logError("phone", message, path);
}
