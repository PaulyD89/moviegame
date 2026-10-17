import "server-only";
import { createAdminClient } from "./supabase/admin";

/** How many of today's finishers this player beat: more links, or same links with fewer letters. */
export async function dailyRank(puzzle: number, playerId: string) {
  const supabase = createAdminClient();
  const { data: me } = await supabase
    .from("daily_plays")
    .select("links, letters")
    .eq("puzzle_number", puzzle)
    .eq("player_id", playerId)
    .not("finished_at", "is", null)
    .maybeSingle<{ links: number; letters: number }>();
  if (!me) return null;

  const others = () =>
    supabase
      .from("daily_plays")
      .select("player_id", { count: "exact", head: true })
      .eq("puzzle_number", puzzle)
      .not("finished_at", "is", null)
      .neq("player_id", playerId);
  const [all, fewerLinks, sameLinksMoreLetters] = await Promise.all([
    others(),
    others().lt("links", me.links),
    others().eq("links", me.links).gt("letters", me.letters),
  ]);
  const total = all.count ?? 0;
  const beat = (fewerLinks.count ?? 0) + (sameLinksMoreLetters.count ?? 0);
  return { others: total, percentBeat: total ? Math.round((beat / total) * 100) : 0 };
}

/**
 * A player's finished dailies from the server: played, won, and links per game for the chart.
 * The stats screen uses this so every device linked by a save code shows the same numbers.
 */
export async function dailyRecord(playerId: string) {
  const { data } = await createAdminClient()
    .from("daily_plays")
    .select("won, links")
    .eq("player_id", playerId)
    .not("finished_at", "is", null)
    .limit(5000);
  const games = (data ?? []) as { won: boolean; links: number }[];
  const dist = Array(11).fill(0) as number[];
  for (const g of games) dist[Math.min(Math.max(g.links, 0), 10)]++;
  return {
    played: games.length,
    won: games.filter((g) => g.won).length,
    dist,
    linksTotal: games.reduce((n, g) => n + g.links, 0),
  };
}
