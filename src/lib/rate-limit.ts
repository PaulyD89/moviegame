import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "./supabase/admin";

/**
 * Per-player limits stop one runaway phone; per-IP limits stop scripts that drop cookies.
 * IP limits are looser since a household or school can share one address.
 */
const LIMITS = {
  guess: { windowSec: 60, perPlayer: 20, perIp: 90 }, // guesses and passes, daily and challenge
  create: { windowSec: 3600, perPlayer: 15, perIp: 40 }, // new challenges and rematches
  code: { windowSec: 60, perPlayer: 15, perIp: 30 }, // join-code lookups (no guessing codes)
} as const;

export type LimitName = keyof typeof LIMITS;

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
}

async function hit(key: string, windowSec: number, max: number) {
  const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
    p_key: key,
    p_window_seconds: windowSec,
    p_max: max,
  });
  // If the counter itself fails, let the player through rather than block a real game.
  return error ? true : data !== false;
}

/** True if this request is allowed. Counts a hit against the player and their IP. */
export async function allow(name: LimitName, playerId: string | null) {
  const limit = LIMITS[name];
  const ip = await clientIp();
  const checks = await Promise.all([
    playerId ? hit(`${name}:pid:${playerId}`, limit.windowSec, limit.perPlayer) : true,
    ip ? hit(`${name}:ip:${ip}`, limit.windowSec, limit.perIp) : true,
  ]);
  return checks.every(Boolean);
}
