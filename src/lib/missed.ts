import "server-only";
import { wordKeys, titleKey, nameKey } from "./normalize";
import { createAdminClient } from "./supabase/admin";
import { matchGuess } from "./game";
import { getMovie, getPerson } from "./tmdb";
import type { Card } from "./types";

/**
 * Wrong guesses (daily and VS) that look a lot like a real answer for their card: the ones
 * worth a look in case the matcher should accept them. Clear misses aren't listed.
 */
export type SuspectMiss = {
  mode: "daily" | "vs";
  at: string;
  card: string;
  kind: Card["kind"];
  tmdbId: number;
  guess: string;
  closest: string;
  score: number;
  /** Today's matcher already takes it (fixed since the guess was made). */
  acceptedNow: boolean;
};

/** Share of words in common (0-1), or 0.8 when one key contains the other. */
function likeness(guess: string, real: string) {
  const g = wordKeys(guess);
  const r = wordKeys(real);
  if (!g.length || !r.length) return 0;
  const common = g.filter((w) => r.includes(w)).length;
  let score = common / Math.max(g.length, r.length);
  const gk = titleKey(guess);
  const rk = titleKey(real);
  if (gk.length >= 5 && (rk.includes(gk) || gk.includes(rk))) score = Math.max(score, 0.8);
  if (nameKey(guess) === nameKey(real)) score = 1;
  return score;
}

/** Everything that would have counted on this card: cast names for a movie, titles for a person. */
async function answersFor(card: Card): Promise<string[]> {
  if (card.kind === "movie") return (await getMovie(card.id)).credits.cast.map((c) => c.name);
  return (await getPerson(card.id)).movie_credits.cast.map((c) => c.title);
}

export async function suspectMisses(days = 3): Promise<SuspectMiss[]> {
  const db = createAdminClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [daily, vs] = await Promise.all([
    db.from("missed_guesses").select("at, card, guess").gte("at", since).limit(500),
    db
      .from("challenge_moves")
      .select("created_at, prompt, guess")
      .eq("outcome", "wrong")
      .gte("created_at", since)
      .limit(500),
  ]);
  const rows = [
    ...(daily.data ?? []).map((r) => ({ mode: "daily" as const, at: r.at as string, card: r.card as Card, guess: r.guess as string })),
    ...(vs.data ?? []).map((r) => ({ mode: "vs" as const, at: r.created_at as string, card: r.prompt as Card, guess: r.guess as string })),
  ].filter((r) => r.card && r.guess);

  const answers = new Map<string, Promise<string[]>>();
  const found: SuspectMiss[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.card.kind}:${r.card.id}:${nameKey(r.guess)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cardKey = `${r.card.kind}:${r.card.id}`;
    if (!answers.has(cardKey)) answers.set(cardKey, answersFor(r.card).catch(() => []));
    let best = { closest: "", score: 0 };
    for (const real of await answers.get(cardKey)!) {
      const score = likeness(r.guess, real);
      if (score > best.score) best = { closest: real, score };
    }
    if (best.score >= 0.5) {
      const now = await matchGuess(r.card, r.guess, new Set()).catch(() => null);
      found.push({
        mode: r.mode,
        at: r.at,
        card: r.card.name,
        kind: r.card.kind,
        tmdbId: r.card.id,
        guess: r.guess,
        ...best,
        acceptedNow: now?.outcome === "correct" || now?.outcome === "used",
      });
    }
  }
  return found.sort((a, b) => b.score - a.score || b.at.localeCompare(a.at)).slice(0, 60);
}
