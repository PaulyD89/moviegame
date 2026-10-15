import "server-only";
import { createAdminClient } from "./supabase/admin";

/** What a phone keeps in its browser storage, backed up so a code can bring it back. */
export type ProgressSnapshot = Record<string, string>;

/** Only these storage keys are saved; anything else a page sends is ignored. */
export const SNAPSHOT_KEYS = [
  "moviegame:stats",
  "moviegame:challengeStats",
  "moviegame:games",
  "moviegame:nickname",
  "moviegame:seenResults",
  "moviegame:seenHowTo",
] as const;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const db = () => createAdminClient();

function newCode() {
  const chars = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => ALPHABET[b % ALPHABET.length]);
  return [0, 4, 8].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

/** Accepts the code however it was typed: lowercase, missing dashes, spaces. */
export function cleanCode(input: string) {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return raw.length === 12 ? [raw.slice(0, 4), raw.slice(4, 8), raw.slice(8)].join("-") : null;
}

export function cleanSnapshot(input: unknown): ProgressSnapshot {
  const out: ProgressSnapshot = {};
  if (!input || typeof input !== "object") return out;
  for (const key of SNAPSHOT_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length <= 20_000) out[key] = value;
  }
  return out;
}

/** This player's code (made on first request), with the latest backup saved alongside. */
export async function saveProgress(playerId: string, snapshot: ProgressSnapshot) {
  const { data: existing } = await db()
    .from("progress_codes")
    .select("code")
    .eq("player_id", playerId)
    .maybeSingle<{ code: string }>();
  if (existing) {
    await db()
      .from("progress_codes")
      .update({ snapshot, updated_at: new Date().toISOString() })
      .eq("player_id", playerId);
    return existing.code;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const { error } = await db().from("progress_codes").insert({ player_id: playerId, code, snapshot });
    if (!error) return code;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Couldn't make a progress code");
}

/** Refresh the backup after a game, if this player has a code. */
export async function backupProgress(playerId: string, snapshot: ProgressSnapshot) {
  await db()
    .from("progress_codes")
    .update({ snapshot, updated_at: new Date().toISOString() })
    .eq("player_id", playerId);
}

/**
 * Look up a code and fold this browser's history into that player. Returns the saved player
 * and their backup, or null for an unknown code.
 */
export async function restoreProgress(code: string, currentPlayerId: string | null) {
  const { data } = await db()
    .from("progress_codes")
    .select("player_id, snapshot")
    .eq("code", code)
    .maybeSingle<{ player_id: string; snapshot: ProgressSnapshot | null }>();
  if (!data) return null;
  if (currentPlayerId && currentPlayerId !== data.player_id) {
    const { error } = await db().rpc("merge_players", { p_from: currentPlayerId, p_to: data.player_id });
    if (error) throw error;
  }
  return { playerId: data.player_id, snapshot: data.snapshot ?? {} };
}
