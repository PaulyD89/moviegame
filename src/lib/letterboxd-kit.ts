import "server-only";
import type { DailyState } from "./daily-play";
import { savedOpener } from "./game";
import { createAdminClient } from "./supabase/admin";
import { cardKey, type Card } from "./types";

/**
 * Everything to post a day's Movie Horse list on Letterboxd by hand (until API access): a title,
 * a description, and the films as a Letterboxd import file. The films follow the most-played
 * path: from the opener, the answer most players gave, then the card most of them got next, and
 * so on.
 */
export type LetterboxdKit = {
  number: number;
  title: string;
  description: string;
  films: { tmdbId: number; name: string; year?: number }[];
  csv: string;
  /** Running list of every day's opening film, same import format. */
  openersCsv: string;
};

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const toCsv = (films: { tmdbId: number; name: string; year?: number }[]) =>
  ["tmdbID,Title,Year", ...films.map((f) => [String(f.tmdbId), csvCell(f.name), f.year ? String(f.year) : ""].join(","))].join(
    "\n",
  ) + "\n";

/** The path through the chain that most finishers took, card by card (the opener if nobody finished). */
function mostPlayedPath(states: DailyState[], opener: Card): Card[] {
  // Each finished game as the cards it answered and the answers given: card, answer, card, answer...
  const paths = states.map((s) => s.links.flatMap((l) => [l.card, l.answer]));
  const path: Card[] = [];
  let group = paths;
  for (let depth = 0; depth < 20 && group.length; depth++) {
    const counts = new Map<string, { card: Card; n: number }>();
    for (const p of group) {
      const c = p[depth];
      if (!c) continue;
      const k = cardKey(c);
      counts.set(k, { card: c, n: (counts.get(k)?.n ?? 0) + 1 });
    }
    const top = [...counts.values()].sort((a, b) => b.n - a.n)[0];
    if (!top) break;
    path.push(top.card);
    group = group.filter((p) => p[depth] && cardKey(p[depth]) === cardKey(top.card));
  }
  return path.length ? path : [opener];
}

export async function letterboxdKit(number: number): Promise<LetterboxdKit | null> {
  const opener = await savedOpener(number);
  if (!opener) return null;
  const db = createAdminClient();
  const [plays, openers] = await Promise.all([
    db
      .from("daily_plays")
      .select("state, won")
      .eq("puzzle_number", number)
      .not("finished_at", "is", null)
      .not("state", "is", null)
      .limit(2000),
    db.from("daily_puzzles").select("number").lte("number", number).order("number"),
  ]);
  const rows = (plays.data ?? []) as { state: DailyState; won: boolean }[];
  const path = mostPlayedPath(
    rows.map((r) => r.state),
    opener,
  );
  const films = path.filter((c) => c.kind === "movie").map((c) => ({ tmdbId: c.id, name: c.name, year: c.year }));
  const winPct = rows.length ? Math.round((rows.filter((r) => r.won).length / rows.length) * 100) : null;
  const last = path.at(-1)!;
  const start = opener.year ? `${opener.name} (${opener.year})` : opener.name;

  const title = `Movie Horse #${number}: ${opener.name} to ${last.name}`;
  const description = [
    `The most-played chain from Movie Horse #${number}, the daily movie-and-actor chain game. It started with ${start}.`,
    "",
    `The path: ${path.map((c) => c.name).join(" → ")}.`,
    ...(winPct !== null ? ["", `${winPct}% of players made all 10 links.`] : []),
    "",
    "Play today's chain free at moviehorsegame.com. Name an actor, then a movie, and don't spell M-O-V-I-E.",
  ].join("\n");

  const openerCards = await Promise.all(((openers.data ?? []) as { number: number }[]).map((o) => savedOpener(o.number)));
  const openerFilms = openerCards
    .filter((c): c is Card => !!c && c.kind === "movie")
    .map((c) => ({ tmdbId: c.id, name: c.name, year: c.year }));

  return { number, title, description, films, csv: toCsv(films), openersCsv: toCsv(openerFilms) };
}
