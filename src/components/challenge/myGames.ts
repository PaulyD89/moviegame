import type { ChallengeSummary } from "@/lib/challenge";
import { recordChallenge } from "../storage";

const KEY = "moviegame:games";
const SEEN_KEY = "moviegame:seenResults";
const MAX_GAMES = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const LIST_DAYS_MS = 3 * DAY_MS;
const WIN_DAYS_MS = 2 * DAY_MS; // wins linger even after you've seen them, in case you want to share

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

/** Count finished games in your stats even if you never opened the final screen (once per game). */
export function recordFinished(games: ChallengeSummary[]) {
  for (const g of games) if (g.status === "finished") recordChallenge(g.id, g.youWon);
}

export type ListedGame = ChallengeSummary & { seen: boolean };

/**
 * Games worth listing: anything in progress (however old), lobbies from the last few days,
 * finished games whose result you haven't seen yet, and wins from the last two days (so you
 * can still share them). Stored ids are trimmed to match, so old games never push a live one
 * off the list.
 */
export function keepGames(games: ChallengeSummary[]): ListedGame[] {
  const now = Date.now();
  const seenIds = new Set(loadSeen());
  const kept = games
    .map((g) => ({ ...g, seen: seenIds.has(g.id) }))
    .filter((g) => {
      const age = now - Date.parse(g.updatedAt);
      if (g.status === "playing") return true;
      if (g.status === "lobby") return age < LIST_DAYS_MS;
      return (!g.seen && age < LIST_DAYS_MS) || (g.youWon && age < WIN_DAYS_MS);
    });
  try {
    const keep = new Set(kept.map((g) => g.id));
    localStorage.setItem(KEY, JSON.stringify(loadGameIds().filter((id) => keep.has(id))));
  } catch {
    // Not critical.
  }
  return kept;
}
