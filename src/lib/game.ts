import "server-only";
import { closeness, nameKey, titleKey } from "./normalize";
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

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Same seed + same candidates = same pick, so players who give the same answer
 * on the same day see the same next card. Skips ahead past anything already used.
 */
function pickStable<T>(items: T[], seed: string, isUsed: (item: T) => boolean): T | undefined {
  const start = hash(seed) % Math.max(items.length, 1);
  for (let i = 0; i < items.length; i++) {
    const item = items[(start + i) % items.length];
    if (!isUsed(item)) return item;
  }
  return undefined;
}

/** A well-known movie this person acted in that hasn't been used yet. */
async function nextMovieFor(person: TmdbPerson, used: Set<string>, seed: string): Promise<Card | null> {
  const isUsed = (c: { id: number }) => used.has(cardKey({ kind: "movie", id: c.id }));
  const credits = person.movie_credits.cast.filter(
    (c) =>
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
    const pick = pickStable(famous, seed, isUsed);
    if (pick) return movieCard(await getMovie(pick.id));
  }
  return null;
}

/** A top-billed actor in this movie who hasn't been used yet. */
async function nextPersonFor(movie: TmdbMovie, used: Set<string>, seed: string): Promise<Card | null> {
  const isUsed = (c: { id: number }) => used.has(cardKey({ kind: "person", id: c.id }));
  const cast = movie.credits.cast.filter(
    (c) => c.profile_path && !NOT_A_ROLE.test(c.character ?? ""),
  );
  for (const maxOrder of [6, 12, 30]) {
    const pick = pickStable(cast.filter((c) => c.order < maxOrder), seed, isUsed);
    if (pick) return personCard(await getPerson(pick.id));
  }
  return null;
}

/** Fresh card of the given kind, for dead ends and passes at the start. */
async function freshCard(kind: Card["kind"], used: Set<string>, seed: string): Promise<Card> {
  const pool = await getStarterPool();
  const pick = pickStable(pool, seed, (m) => used.has(cardKey({ kind: "movie", id: m.id })))!;
  const movie = await getMovie(pick.id);
  if (kind === "movie") return movieCard(movie);
  used.add(cardKey({ kind: "movie", id: movie.id }));
  return (await nextPersonFor(movie, used, seed)) ?? freshCard(kind, used, seed);
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

export type Match =
  | { outcome: "correct"; answer: Card; close: boolean }
  | { outcome: "wrong" }
  | { outcome: "used"; answer: Card };

/** Best candidates by closeness, keeping the input's priority order for ties. */
function ranked<T>(items: T[], score: (item: T) => number) {
  const scored = items.map((item) => ({ item, dist: score(item) })).filter((s) => s.dist < Infinity);
  const best = Math.min(...scored.map((s) => s.dist));
  return { best, items: scored.filter((s) => s.dist === best).map((s) => s.item) };
}

const lastName = (name: string) => nameKey(name.trim().split(/\s+/).at(-1) ?? "");

/**
 * Is `guess` a valid answer for `card`? Shared by the daily game and challenges.
 * Forgives small typos, a missing "The", and last-name-only when it's unambiguous.
 */
export async function matchGuess(card: Card, guess: string, used: Set<string>): Promise<Match> {
  const key = nameKey(guess);
  if (!key) return { outcome: "wrong" };

  if (card.kind === "movie") {
    const cast = (await getMovie(card.id)).credits.cast; // already in billing order
    let { best, items } = ranked(cast, (c) => closeness([key], [nameKey(c.name)]));
    if (items.length === 0 && key.length >= 4) {
      // Last name only, e.g. "Cruise" for Top Gun, if exactly one cast member has it.
      const byLast = ranked(cast, (c) => closeness([key], [lastName(c.name)]));
      const people = new Set(byLast.items.map((c) => c.id));
      if (people.size === 1) ({ best, items } = { best: 1, items: byLast.items });
    }
    if (items.length === 0) return { outcome: "wrong" };
    const answer = personCard(await getPerson(items[0].id));
    if (used.has(cardKey(answer))) return { outcome: "used", answer };
    return { outcome: "correct", answer, close: best > 0 };
  }

  const credits = (await getPerson(card.id)).movie_credits.cast
    .slice()
    .sort((a, b) => b.vote_count - a.vote_count);
  const { best, items } = ranked(credits, (c) =>
    closeness([key, titleKey(guess)], [nameKey(c.title), nameKey(c.original_title), titleKey(c.title)]),
  );
  if (items.length === 0) return { outcome: "wrong" };

  // Same title can exist twice (remakes); prefer one not yet used.
  const match = items.find((m) => !used.has(cardKey({ kind: "movie", id: m.id })));
  if (!match) return { outcome: "used", answer: movieCard(await getMovie(items[0].id)) };
  return { outcome: "correct", answer: movieCard(await getMovie(match.id)), close: best > 0 };
}

/** A well-known starting movie for a new chain (challenges, and after a miss in one). */
export async function startCard(used: Set<string>, seed: string): Promise<Card> {
  return freshCard("movie", used, seed);
}

export async function checkGuess(
  card: Card,
  guess: string,
  usedKeys: string[],
  dateStr: string,
): Promise<GuessResult> {
  const used = new Set([...usedKeys, cardKey(card)]);
  const result = await matchGuess(card, guess, used);
  if (result.outcome !== "correct") return result;

  const { answer, close } = result;
  used.add(cardKey(answer));
  const seed = `${dateStr}:${cardKey(answer)}`;
  const next =
    answer.kind === "person"
      ? ((await nextMovieFor(await getPerson(answer.id), used, seed)) ??
        (await freshCard("movie", used, seed)))
      : ((await nextPersonFor(await getMovie(answer.id), used, seed)) ??
        (await freshCard("person", used, seed)));
  return { outcome: "correct", answer, next, close };
}

/** Swap the current card for another of the same kind (costs a letter on the client). */
export async function passCard(
  card: Card,
  from: Card | null,
  usedKeys: string[],
  dateStr: string,
): Promise<Card> {
  const used = new Set([...usedKeys, cardKey(card)]);
  const seed = `${dateStr}:${from ? cardKey(from) : "start"}`;
  if (from?.kind === "person" && card.kind === "movie") {
    const next = await nextMovieFor(await getPerson(from.id), used, seed);
    if (next) return next;
  }
  if (from?.kind === "movie" && card.kind === "person") {
    const next = await nextPersonFor(await getMovie(from.id), used, seed);
    if (next) return next;
  }
  return freshCard(card.kind, used, `${seed}:fresh`);
}
