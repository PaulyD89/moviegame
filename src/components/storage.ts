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
};

const GAME_KEY = "moviegame:daily";
const STATS_KEY = "moviegame:stats";

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
  const won = game.status === "won";
  const streak = won ? (stats.lastWon === game.number - 1 ? stats.streak + 1 : 1) : 0;
  write(STATS_KEY, {
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    lastWon: won ? game.number : stats.lastWon,
  } satisfies Stats);
}
