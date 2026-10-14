import "server-only";
import { nameKey } from "./normalize";
import {
  getMovie,
  getPerson,
  getStarterPool,
  posterUrl,
  profileUrl,
  type TmdbMovie,
  type TmdbPerson,
} from "./tmdb";
import { cardKey, type Card, type GuessResult } from "./types";

const LAUNCH = Date.UTC(2026, 9, 14); // puzzle #1
const NOT_A_ROLE = /\b(him|her|them)?self\b|uncredited|archive footage/i;
const SKIP_GENRES = new Set([99, 10770]); // documentary, TV movie

const yearOf = (date?: string) => (date ? Number(date.slice(0, 4)) : undefined);

function movieCard(m: TmdbMovie): Card {
  return {
    kind: "movie",
    id: m.id,
    name: m.title,
    image: posterUrl(m.poster_path),
    year: yearOf(m.release_date),
    popularity: m.vote_count,
    imdbId: m.imdb_id,
  };
}

function personCard(p: TmdbPerson): Card {
  return {
    kind: "person",
    id: p.id,
    name: p.name,
    image: profileUrl(p.profile_path),
    popularity: p.popularity,
    imdbId: p.imdb_id,
  };
}

function pickRandom<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

/** A well-known movie this person acted in that hasn't been used yet. */
async function nextMovieFor(person: TmdbPerson, used: Set<string>): Promise<Card | null> {
  const credits = person.movie_credits.cast.filter(
    (c) =>
      !used.has(cardKey({ kind: "movie", id: c.id })) &&
      c.poster_path &&
      c.release_date &&
      !NOT_A_ROLE.test(c.character ?? "") &&
      !c.genre_ids.some((g) => SKIP_GENRES.has(g)),
  );
  for (const minVotes of [2000, 500, 50]) {
    const famous = credits
      .filter((c) => c.vote_count >= minVotes)
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, 12);
    const pick = pickRandom(famous);
    if (pick) return movieCard(await getMovie(pick.id));
  }
  return null;
}

/** A top-billed actor in this movie who hasn't been used yet. */
async function nextPersonFor(movie: TmdbMovie, used: Set<string>): Promise<Card | null> {
  const cast = movie.credits.cast.filter(
    (c) =>
      !used.has(cardKey({ kind: "person", id: c.id })) &&
      c.profile_path &&
      !NOT_A_ROLE.test(c.character ?? ""),
  );
  for (const maxOrder of [6, 12, 30]) {
    const pick = pickRandom(cast.filter((c) => c.order < maxOrder));
    if (pick) return personCard(await getPerson(pick.id));
  }
  return null;
}

/** Fresh card of the given kind, for dead ends and passes at the start. */
async function freshCard(kind: Card["kind"], used: Set<string>): Promise<Card> {
  const pool = (await getStarterPool()).filter(
    (m) => !used.has(cardKey({ kind: "movie", id: m.id })),
  );
  const movie = await getMovie(pickRandom(pool)!.id);
  if (kind === "movie") return movieCard(movie);
  return (await nextPersonFor(movie, used)) ?? freshCard(kind, used);
}

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** dateStr is the player's local date, YYYY-MM-DD, so the puzzle flips at their midnight. */
export async function dailyStart(dateStr: string): Promise<{ number: number; card: Card }> {
  const number = Math.floor((Date.parse(dateStr) - LAUNCH) / 86_400_000) + 1;
  const pool = await getStarterPool();
  const movie = await getMovie(pool[hash(dateStr) % pool.length].id);

  // Every third day starts with an actor instead of a movie.
  if (number % 3 === 0) {
    const lead = movie.credits.cast.find((c) => c.profile_path && !NOT_A_ROLE.test(c.character));
    if (lead) return { number, card: personCard(await getPerson(lead.id)) };
  }
  return { number, card: movieCard(movie) };
}

export async function checkGuess(card: Card, guess: string, usedKeys: string[]): Promise<GuessResult> {
  const key = nameKey(guess);
  const used = new Set([...usedKeys, cardKey(card)]);
  if (!key) return { outcome: "wrong" };

  if (card.kind === "movie") {
    const movie = await getMovie(card.id);
    const match = movie.credits.cast.find((c) => nameKey(c.name) === key);
    if (!match) return { outcome: "wrong" };

    const person = await getPerson(match.id);
    const answer = personCard(person);
    if (used.has(cardKey(answer))) return { outcome: "used", answer };
    used.add(cardKey(answer));
    const next = (await nextMovieFor(person, used)) ?? (await freshCard("movie", used));
    return { outcome: "correct", answer, next };
  }

  const person = await getPerson(card.id);
  const matches = person.movie_credits.cast
    .filter((c) => nameKey(c.title) === key || nameKey(c.original_title) === key)
    .sort((a, b) => b.vote_count - a.vote_count);
  if (matches.length === 0) return { outcome: "wrong" };

  // Same title can exist twice (remakes); prefer one not yet used.
  const match = matches.find((m) => !used.has(cardKey({ kind: "movie", id: m.id })));
  if (!match) return { outcome: "used", answer: movieCard(await getMovie(matches[0].id)) };

  const movie = await getMovie(match.id);
  const answer = movieCard(movie);
  used.add(cardKey(answer));
  const next = (await nextPersonFor(movie, used)) ?? (await freshCard("person", used));
  return { outcome: "correct", answer, next };
}

/** Swap the current card for another of the same kind (costs a letter on the client). */
export async function passCard(card: Card, from: Card | null, usedKeys: string[]): Promise<Card> {
  const used = new Set([...usedKeys, cardKey(card)]);
  if (from?.kind === "person" && card.kind === "movie") {
    const next = await nextMovieFor(await getPerson(from.id), used);
    if (next) return next;
  }
  if (from?.kind === "movie" && card.kind === "person") {
    const next = await nextPersonFor(await getMovie(from.id), used);
    if (next) return next;
  }
  return freshCard(card.kind, used);
}
