import type { ChallengeSummary } from "@/lib/challenge";

const KEY = "moviegame:games";
const MAX_GAMES = 50;
const LIST_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/** Challenge ids this device has joined, newest first. */
export function loadGameIds(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function rememberGame(id: string) {
  try {
    const ids = [id, ...loadGameIds().filter((x) => x !== id)].slice(0, MAX_GAMES);
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Not critical; the game link still works.
  }
}

/**
 * Games worth listing: anything in progress (however old), plus finished games and
 * unjoined lobbies from the last few days. Stored ids are trimmed to match, so old
 * games never push a live one off the device's list.
 */
export function keepGames(games: ChallengeSummary[]) {
  const cutoff = Date.now() - LIST_DAYS_MS;
  const kept = games.filter((g) => g.status === "playing" || Date.parse(g.updatedAt) > cutoff);
  try {
    const keep = new Set(kept.map((g) => g.id));
    localStorage.setItem(KEY, JSON.stringify(loadGameIds().filter((id) => keep.has(id))));
  } catch {
    // Not critical.
  }
  return kept;
}
