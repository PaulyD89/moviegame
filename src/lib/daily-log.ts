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
