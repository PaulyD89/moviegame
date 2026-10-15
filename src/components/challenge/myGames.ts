const KEY = "moviegame:games";

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
    const ids = [id, ...loadGameIds().filter((x) => x !== id)].slice(0, 20);
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Not critical; the game link still works.
  }
}
