import type { Card } from "@/lib/types";

export type GameEvent = "correct" | "wrong" | "pass";

export type SavedGame = {
  date: string;
  number: number;
  card: Card;
  /** The answer that led to the current card (null at the start or after a dead end). */
  from: Card | null;
  links: { card: Card; answer: Card }[];
  events: GameEvent[];
  used: string[];
  letters: number;
  status: "playing" | "won" | "lost";
  startedAt: number;
  finishedAt?: number;
};

export type Stats = {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  lastWon?: number;
  lastPlayed?: number;
  /** dist[n] = how many daily games ended with n links made (0–10). */
  dist?: number[];
  linksTotal?: number;
};

export type ChallengeStats = {
  played: number;
  won: number;
  /** Challenge ids already counted, so revisiting a finished game doesn't count twice. */
  counted: string[];
};

const GAME_KEY = "moviegame:daily";
const STATS_KEY = "moviegame:stats";
const CHALLENGE_STATS_KEY = "moviegame:challengeStats";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage full; the game still works, it just won't persist.
  }
}

export function loadGame(date: string): SavedGame | null {
  const saved = read<SavedGame>(GAME_KEY);
  return saved?.date === date ? saved : null;
}

export const saveGame = (game: SavedGame) => write(GAME_KEY, game);

export function loadStats(): Stats {
  return read<Stats>(STATS_KEY) ?? { played: 0, won: 0, streak: 0, maxStreak: 0 };
}

export function recordResult(game: SavedGame) {
  const stats = loadStats();
  if (stats.lastPlayed === game.number) return; // already counted today's game
  const won = game.status === "won";
  const streak = won ? (stats.lastWon === game.number - 1 ? stats.streak + 1 : 1) : 0;
  const links = game.links.length;
  const dist = Array.from({ length: 11 }, (_, i) => (stats.dist?.[i] ?? 0) + (i === links ? 1 : 0));
  write(STATS_KEY, {
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    lastWon: won ? game.number : stats.lastWon,
    lastPlayed: game.number,
    dist,
    linksTotal: (stats.linksTotal ?? 0) + links,
  } satisfies Stats);
}

/** The daily streak is broken if you won neither today's nor yesterday's puzzle. */
export function currentStreak(stats: Stats, todayNumber: number) {
  return stats.lastWon !== undefined && stats.lastWon >= todayNumber - 1 ? stats.streak : 0;
}

export function loadChallengeStats(): ChallengeStats {
  return read<ChallengeStats>(CHALLENGE_STATS_KEY) ?? { played: 0, won: 0, counted: [] };
}

export function recordChallenge(id: string, won: boolean) {
  const stats = loadChallengeStats();
  if (stats.counted.includes(id)) return;
  write(CHALLENGE_STATS_KEY, {
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    counted: [id, ...stats.counted].slice(0, 200),
  } satisfies ChallengeStats);
}
