import "server-only";
import { puzzleDate, puzzleNumber } from "./daily-clock";
import { createAdminClient } from "./supabase/admin";
import { CLAIM_STREAK } from "./types";

export { CLAIM_STREAK };

const db = () => createAdminClient();

/** Days in a row this player finished the daily (won or lost), and their best run. */
export async function playStreak(playerId: string) {
  const { data, error } = await db()
    .from("daily_plays")
    .select("puzzle_number")
    .eq("player_id", playerId)
    .not("finished_at", "is", null)
    .order("puzzle_number");
  if (error) throw error;
  const days = data.map((r) => r.puzzle_number as number);
  let best = 0;
  let run = 0;
  days.forEach((n, i) => {
    run = i > 0 && days[i - 1] === n - 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  const today = puzzleNumber(puzzleDate());
  const last = days.at(-1) ?? null;
  return { current: last !== null && last >= today - 1 ? run : 0, best, lastPlayed: last };
}

/** Compare names ignoring case, spaces and punctuation: "Movie Horse" = "moviehorse". */
export const claimKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Names that would pass for the game itself, staff or partners. */
const RESERVED = ["moviehorse", "admin", "administrator", "official", "moderator", "staff", "support", "letterboxd", "tmdb"];
/** Slurs and the like; claimed names show on share images people post publicly. */
const BLOCKED = ["nigger", "nigga", "faggot", "retard", "kike", "chink", "spic", "tranny", "cunt", "whore", "slut", "rape", "nazi", "hitler"];

export type ClaimResult =
  | { ok: true; name: string }
  | { ok: false; reason: "not-eligible" | "invalid" | "blocked" | "taken" };

export async function claimedName(playerId: string): Promise<string | null> {
  const { data } = await db().from("claimed_names").select("name").eq("player_id", playerId).maybeSingle();
  return (data?.name as string | undefined) ?? null;
}

/** True if someone else has claimed this name, so this player can't use it in a VS game. */
export async function nameTakenByOther(name: string, playerId: string) {
  const { data } = await db().from("claimed_names").select("player_id").eq("name_key", claimKey(name)).maybeSingle();
  return !!data && data.player_id !== playerId;
}

/** Claimed names among these players, as player id -> name key, for the gold check in VS games. */
export async function claimsFor(playerIds: string[]) {
  if (!playerIds.length) return new Map<string, string>();
  const { data } = await db().from("claimed_names").select("player_id, name_key").in("player_id", playerIds);
  return new Map((data ?? []).map((r) => [r.player_id as string, r.name_key as string]));
}

/** Claim (or change) this player's name, once they've earned it. */
export async function claimName(playerId: string, raw: string): Promise<ClaimResult> {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, 20);
  const key = claimKey(name);
  if (key.length < 2) return { ok: false, reason: "invalid" };
  if (RESERVED.some((r) => key.includes(r)) || BLOCKED.some((b) => key.includes(b))) return { ok: false, reason: "blocked" };
  if ((await playStreak(playerId)).best < CLAIM_STREAK) return { ok: false, reason: "not-eligible" };
  if (await nameTakenByOther(name, playerId)) return { ok: false, reason: "taken" };
  const { error } = await db()
    .from("claimed_names")
    .upsert({ player_id: playerId, name, name_key: key, claimed_at: new Date().toISOString() });
  // Lost a race for the same name.
  if (error) return error.code === "23505" ? { ok: false, reason: "taken" } : Promise.reject(error);
  return { ok: true, name };
}
