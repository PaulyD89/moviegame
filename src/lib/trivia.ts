import "server-only";
import { generateText } from "ai";
import type { Card } from "./types";

/**
 * One snarky-but-affectionate trivia line for the daily Instagram post, written by Claude
 * from TMDB facts only (it isn't trusted to recall trivia on its own). Null when there's
 * nothing usable, so the post goes out without it.
 */

const MODEL = "anthropic/claude-sonnet-5.5";
const API = "https://api.themoviedb.org/3";

async function tmdb(path: string) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${process.env.TMDB_READ_TOKEN}` } });
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`);
  return res.json();
}

type Credit = { title?: string; release_date?: string; character?: string; vote_count?: number };
type Named = { name: string };

/** The facts the writer may use, kept small and specific (also used for the post's hashtags). */
export async function openerFacts(card: Card) {
  if (card.kind === "movie") {
    const m = await tmdb(`/movie/${card.id}?append_to_response=credits,keywords`);
    return {
      kind: "movie",
      title: m.title,
      year: card.year,
      release_date: m.release_date,
      runtime_minutes: m.runtime || undefined,
      budget_usd: m.budget || undefined,
      box_office_usd: m.revenue || undefined,
      tagline: m.tagline || undefined,
      overview: m.overview,
      genres: (m.genres as Named[]).map((g) => g.name),
      directors: (m.credits.crew as (Named & { job: string })[]).filter((c) => c.job === "Director").map((c) => c.name),
      top_cast: (m.credits.cast as (Named & { character: string })[])
        .slice(0, 6)
        .map((c) => `${c.name} as ${c.character}`),
      keywords: (m.keywords?.keywords as Named[] | undefined)?.slice(0, 12).map((k) => k.name),
      countries: (m.production_countries as Named[]).map((c) => c.name),
    };
  }
  const p = await tmdb(`/person/${card.id}?append_to_response=movie_credits`);
  const films = (p.movie_credits.cast as Credit[]).filter((c) => c.release_date);
  const years = films.map((c) => Number(c.release_date!.slice(0, 4)));
  return {
    kind: "actor",
    name: p.name,
    birthday: p.birthday || undefined,
    died: p.deathday || undefined,
    place_of_birth: p.place_of_birth || undefined,
    biography: (p.biography as string)?.slice(0, 1800) || undefined,
    movie_acting_credits: films.length,
    first_film_year: years.length ? Math.min(...years) : undefined,
    best_known_films: [...films]
      .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
      .slice(0, 10)
      .map((c) => `${c.title} (${c.release_date!.slice(0, 4)})${c.character ? ` as ${c.character}` : ""}`),
  };
}

const SYSTEM = `You write one line of trivia for Movie Horse, a daily movie-and-actor chain game, to go in its Instagram post.
Voice: a witty movie buff. Snarky, dry and playful, never cruel. Think a friend ribbing a movie they love.
Rules:
- Use ONLY the facts given. Do not add any fact, number, award, quote, or story that isn't in them. If unsure, leave it out.
- One or two short sentences, under 200 characters total. No hashtags, no emoji, no quotation marks around the whole line.
- Don't reveal anything about how to play or give away answers; don't list cast members as a hint.
- Never joke about someone's looks, weight, age, health, family, relationships, death, politics or legal trouble.
- If the person has died, keep it warm.
Reply with the line only.`;

export async function writeTrivia(card: Card): Promise<string | null> {
  try {
    const data = await openerFacts(card);
    const { text } = await generateText({
      model: MODEL,
      system: SYSTEM,
      prompt: `Facts (JSON):\n${JSON.stringify(data)}`,
      // Room to think before the one line; 200 left some answers empty.
      maxOutputTokens: 1000,
    });
    const line = text.trim().replace(/^["“]|["”]$/g, "").replace(/\s+/g, " ");
    return line && line.length <= 260 && !line.includes("#") ? line : null;
  } catch (e) {
    console.error("Trivia failed:", e);
    return null;
  }
}
