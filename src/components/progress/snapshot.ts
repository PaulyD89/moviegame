import { backup } from "@/app/progress/actions";

const KEYS = [
  "moviegame:stats",
  "moviegame:challengeStats",
  "moviegame:games",
  "moviegame:nickname",
  "moviegame:seenResults",
  "moviegame:seenHowTo",
];
/** Set once this phone has a save code, so backups only happen for people who use it. */
const SAVED_KEY = "moviegame:progressSaved";

/** This phone's saved stats and lists, for the server backup. */
export function takeSnapshot() {
  const out: Record<string, string> = {};
  try {
    for (const key of KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) out[key] = value;
    }
  } catch {
    // Storage unavailable: nothing to back up.
  }
  return out;
}

/** Replace this phone's progress with a restored backup; the games list keeps both. */
export function applySnapshot(snapshot: Record<string, string>) {
  try {
    const games = new Set<string>();
    for (const raw of [snapshot["moviegame:games"], localStorage.getItem("moviegame:games")]) {
      try {
        for (const id of JSON.parse(raw ?? "[]")) if (typeof id === "string") games.add(id);
      } catch {}
    }
    for (const key of KEYS) {
      if (snapshot[key] !== undefined) localStorage.setItem(key, snapshot[key]);
    }
    localStorage.setItem("moviegame:games", JSON.stringify([...games].slice(0, 50)));
    localStorage.removeItem("moviegame:daily"); // today's game reloads from the server
    localStorage.setItem(SAVED_KEY, "1");
  } catch {
    // Storage unavailable; the rank still follows the restored player.
  }
}

export function markSaved() {
  try {
    localStorage.setItem(SAVED_KEY, "1");
  } catch {}
}

/** After a game: refresh the server backup, if this phone has a save code. */
export function backupAfterGame() {
  try {
    if (localStorage.getItem(SAVED_KEY) !== "1") return;
  } catch {
    return;
  }
  backup(takeSnapshot()).catch(() => {});
}
