import "server-only";
import { createAdminClient } from "./supabase/admin";
import { cardKey, type Card } from "./types";
import type { DailyState } from "./daily-play";

/** A card needs this many answers before percentages mean anything (and so tiny counts never show). */
const MIN_ANSWERS = 10;

export type LinkCompare = {
  prompt: Card;
  answer: Card;
  /** Share of players who gave your answer to this card. */
  pct: number;
  /** The most common answer, when it isn't yours. */
  top: { name: string; pct: number } | null;
};

/** For each link in this player's finished daily, how their answer compares with everyone's. */
export async function answerStats(puzzle: number, playerId: string): Promise<LinkCompare[]> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("daily_plays")
    .select("state")
    .eq("puzzle_number", puzzle)
    .eq("player_id", playerId)
    .not("finished_at", "is", null)
    .maybeSingle<{ state: DailyState | null }>();
  const links = row?.state?.links ?? [];
  if (links.length === 0) return [];

  const { data, error } = await supabase.rpc("daily_answer_stats", {
    p_puzzle: puzzle,
    p_prompts: links.map((l) => cardKey(l.card)),
  });
  if (error) throw error;
  const rows = (data ?? []) as { prompt: string; answer: string; answer_name: string; n: number }[];

  return links.flatMap((l) => {
    const forCard = rows.filter((r) => r.prompt === cardKey(l.card));
    const total = forCard.reduce((sum, r) => sum + Number(r.n), 0);
    if (total < MIN_ANSWERS) return [];
    const pct = (n: number) => Math.round((n / total) * 100);
    const mine = forCard.find((r) => r.answer === cardKey(l.answer));
    const top = forCard.reduce((a, b) => (Number(b.n) > Number(a.n) ? b : a));
    return [
      {
        prompt: l.card,
        answer: l.answer,
        pct: pct(Number(mine?.n ?? 1)),
        top: top.answer === cardKey(l.answer) ? null : { name: top.answer_name, pct: pct(Number(top.n)) },
      },
    ];
  });
}
