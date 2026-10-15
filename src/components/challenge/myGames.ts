import type { ChallengeSummary } from "@/lib/challenge";

const KEY = "moviegame:games";
const SEEN_KEY = "moviegame:seenResults";
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

function loadSeen(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

/** You've looked at this game's final result, so it can leave "Your games". */
export function markResultSeen(id: string) {
  try {
    const ids = [id, ...loadSeen().filter((x) => x !== id)].slice(0, MAX_GAMES);
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    // Not critical.
  }
}

/**
 * Games worth listing: anything in progress (however old), lobbies from the last few days,
 * and finished games whose result you haven't seen yet (so you can catch up or share a win).
 * Stored ids are trimmed to match, so old games never push a live one off the list.
 */
export function keepGames(games: ChallengeSummary[]) {
  const cutoff = Date.now() - LIST_DAYS_MS;
  const seen = new Set(loadSeen());
  const kept = games.filter(
    (g) =>
      g.status === "playing" ||
      (Date.parse(g.updatedAt) > cutoff && !(g.status === "finished" && seen.has(g.id))),
  );
  try {
    const keep = new Set(kept.map((g) => g.id));
    localStorage.setItem(KEY, JSON.stringify(loadGameIds().filter((id) => keep.has(id))));
  } catch {
    // Not critical.
  }
  return kept;
}
