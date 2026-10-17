import "server-only";
import { createAdminClient } from "./supabase/admin";
import { cardKey, type Card } from "./types";
import type { DailyState } from "./daily-play";
import { bestKnownAnswers, cardFromKey } from "./game";

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

export type CouldHaveSaid = { card: Card; answers: { card: Card; mostSaid: boolean }[] };

/**
 * After a lost daily: up to 3 answers that would have worked on the card that ended it. First
 * what other players said to that card today (most common first), then the best-known answers.
 * Answers already in the player's chain are left out (they'd have been "already used").
 */
export async function couldHaveSaid(puzzle: number, playerId: string): Promise<CouldHaveSaid | null> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("daily_plays")
    .select("state, won")
    .eq("puzzle_number", puzzle)
    .eq("player_id", playerId)
    .not("finished_at", "is", null)
    .maybeSingle<{ state: DailyState | null; won: boolean }>();
  const state = row?.state;
  if (!state || row.won || state.status !== "lost") return null;
  const card = state.card;
  const used = new Set(state.used);

  const { data } = await supabase.rpc("daily_answer_stats", { p_puzzle: puzzle, p_prompts: [cardKey(card)] });
  const said = ((data ?? []) as { answer: string; n: number }[])
    .filter((r) => !used.has(r.answer))
    .sort((a, b) => Number(b.n) - Number(a.n))
    .slice(0, 3);
  const answers: { card: Card; mostSaid: boolean }[] = [];
  for (const [i, r] of said.entries()) {
    const c = await cardFromKey(r.answer).catch(() => null);
    if (c) answers.push({ card: c, mostSaid: i === 0 && Number(r.n) >= 2 });
  }
  if (answers.length < 3) {
    const taken = new Set([...used, ...answers.map((a) => cardKey(a.card))]);
    const more = await bestKnownAnswers(card, taken, 3 - answers.length).catch(() => []);
    answers.push(...more.map((c) => ({ card: c, mostSaid: false })));
  }
  return answers.length ? { card, answers } : null;
}
