/**
 * The daily puzzle flips at midnight US Eastern (9pm Pacific) for everyone,
 * so friends anywhere are always on the same chain.
 */
const ZONE = "America/New_York";

/**
 * Today's puzzle date, YYYY-MM-DD, in Eastern time. Built from parts: some phones (Android
 * in-app browsers) format "en-CA" dates as 10/15/2026 instead of 2026-10-15.
 */
export function puzzleDate(now = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Milliseconds until the next puzzle (next midnight Eastern). */
export function msUntilNextPuzzle(now = new Date()): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONE,
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, Number(p.value)]),
  );
  const elapsed = (parts.hour * 3600 + parts.minute * 60 + parts.second) * 1000 + now.getMilliseconds();
  return 86_400_000 - elapsed;
}

const LAUNCH = Date.UTC(2026, 9, 14); // puzzle #1

/** Puzzle number for a YYYY-MM-DD date (Eastern). */
export function puzzleNumber(dateStr: string): number {
  return Math.floor((Date.parse(dateStr) - LAUNCH) / 86_400_000) + 1;
}
