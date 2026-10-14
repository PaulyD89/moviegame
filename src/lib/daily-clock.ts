/**
 * The daily puzzle flips at midnight US Eastern (9pm Pacific) for everyone,
 * so friends anywhere are always on the same chain.
 */
const ZONE = "America/New_York";

/** Today's puzzle date, YYYY-MM-DD, in Eastern time. */
export function puzzleDate(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: ZONE });
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
