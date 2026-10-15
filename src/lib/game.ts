import "server-only";
import { puzzleDate, puzzleNumber } from "./daily-clock";
import { closeness, nameKey, nicknameKey, soundsLike, titleKey } from "./normalize";
import {
  getAltTitles,
  getMovie,
  getPerson,
  getStarterPool,
  posterUrl,
  profileUrl,
  type StarterMovie,
  type TmdbMovie,
  type TmdbPerson,
} from "./tmdb";
import { createAdminClient } from "./supabase/admin";
import { cardKey, type Card, type GuessResult } from "./types";

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
 * A repeatable number in [0, 1) for a seed. From puzzle #3 on, the hash gets a final mixing
 * step (MurmurHash3's finalizer): without it, seeds that differ only at the end land close
 * together and skew which decade or actor wins. Earlier puzzles keep the old numbers.
 */
function roll(seed: string) {
  let h = hash(seed);
  if (audienceRules(seed)) {
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    h >>>= 0;
  }
  return h / 2 ** 32;
}

/** The game never shows movies before 1970, and shows 1970s ones half as often. */
const MIN_YEAR = 1970;

/**
 * Share of picks per decade, aimed at 25-to-55-year-olds (percent; the owner's numbers).
 * Took effect with puzzle #3 (2026-10-16) so #2 stayed consistent all day.
 */
const AUDIENCE_RULES_FROM = "2026-10-16";
const DECADE_WEIGHT: Record<number, number> = { 1970: 4, 1980: 17, 1990: 21, 2000: 21, 2010: 21, 2020: 16 };

/** The day a pick belongs to: daily seeds start with the puzzle date; challenges use today. */
const rulesDate = (seed: string) => /^\d{4}-\d{2}-\d{2}/.exec(seed)?.[0] ?? puzzleDate();
const audienceRules = (seed: string) => rulesDate(seed) >= AUDIENCE_RULES_FROM;

function yearWeight(year?: number, seed?: string) {
  if (!year || year < MIN_YEAR) return 0;
  if (seed && audienceRules(seed)) return DECADE_WEIGHT[Math.min(2020, Math.floor(year / 10) * 10)] ?? 1;
  return year < 1980 ? 0.5 : 1;
}

/**
 * Weighted pick that's repeatable: same seed + same candidates = same pick, so players
 * who give the same answer on the same day see the same next card.
 */
function pickWeighted<T>(items: T[], seed: string, weight: (item: T) => number): T | undefined {
  const weighted = items.map((item) => ({ item, w: weight(item) })).filter((x) => x.w > 0);
  const total = weighted.reduce((sum, x) => sum + x.w, 0);
  if (total === 0) return undefined;
  let r = roll(seed) * total;
  for (const x of weighted) {
    r -= x.w;
    if (r < 0) return x.item;
  }
  return weighted.at(-1)!.item;
}

/** 1960s films show up now and then (about 8% of movie picks), and at most once per chain. */
export const SIXTIES_USED = "era:1960s";
const SIXTIES_SHARE = 0.08;
const isSixties = (year?: number) => !!year && year >= 1960 && year < 1970;

/** Keys to record when a card joins a chain, including the one-per-chain 1960s marker. */
export function usedKeysFor(card: Card) {
  return [cardKey(card), ...(card.kind === "movie" && isSixties(card.year) ? [SIXTIES_USED] : [])];
}

/** A well-known movie this person acted in that hasn't been used yet (1970+, or rarely the 1960s). */
async function nextMovieFor(person: TmdbPerson, used: Set<string>, seed: string): Promise<Card | null> {
  const eligible = person.movie_credits.cast.filter(
    (c) =>
      c.poster_path &&
      !used.has(cardKey({ kind: "movie", id: c.id })) &&
      !NOT_A_ROLE.test(c.character ?? "") &&
      !c.genre_ids.some((g) => SKIP_GENRES.has(g)),
  );
  if (!used.has(SIXTIES_USED) && roll(`${seed}:60s`) < SIXTIES_SHARE) {
    const sixties = eligible
      .filter((c) => isSixties(yearOf(c.release_date)) && c.vote_count >= 500)
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, 12);
    const pick = pickWeighted(sixties, seed, () => 1);
    if (pick) return movieCard(await getMovie(pick.id));
  }
  const credits = eligible.filter((c) => yearWeight(yearOf(c.release_date)) > 0);
  for (const minVotes of [2000, 500, 50]) {
    const famous = credits
      .filter((c) => c.vote_count >= minVotes)
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, 12);
    const pick = pickWeighted(famous, seed, (c) => yearWeight(yearOf(c.release_date), seed));
    if (pick) return movieCard(await getMovie(pick.id));
  }
  return null;
}

/** Actors who've died or were born before 1940 often show up in old black-and-white photos. */
const CLASSIC_SHARE = 0.25;
const isClassic = (p: TmdbPerson) => !!p.deathday || Number(p.birthday?.slice(0, 4) ?? 9999) < 1940;

/**
 * A top-billed actor in this movie who hasn't been used yet. About a quarter of picks may be
 * classic (deceased or born before 1940); the rest come from current actors when the cast has them.
 */
async function nextPersonFor(movie: TmdbMovie, used: Set<string>, seed: string): Promise<Card | null> {
  const cast = movie.credits.cast.filter(
    (c) =>
      c.profile_path &&
      !used.has(cardKey({ kind: "person", id: c.id })) &&
      !NOT_A_ROLE.test(c.character ?? ""),
  );
  const wantClassic = roll(`${seed}:era`) < CLASSIC_SHARE;
  for (const maxOrder of [6, 12, 30]) {
    const tier = cast.filter((c) => c.order < maxOrder);
    if (tier.length === 0) continue;
    const people = (await Promise.all(tier.map((c) => getPerson(c.id).catch(() => null)))).filter(
      (p): p is TmdbPerson => !!p,
    );
    if (audienceRules(seed)) {
      // Recognizable actors come up more, but not every time: weight grows with the square root
      // of their well-known films (a lead star ~2x a working character actor, ~10x an unknown).
      // Classic actors count a third as much, which keeps them to about a quarter of picks.
      const weight = (p: TmdbPerson) => (1 + 2 * Math.sqrt(famousCredits(p))) * (isClassic(p) ? 1 / 3 : 1);
      const pick = pickWeighted(people, seed, weight);
      if (pick) return personCard(pick);
      continue;
    }
    const classic = people.filter(isClassic);
    const current = people.filter((p) => !isClassic(p));
    const [first, second] = wantClassic ? [classic, current] : [current, classic];
    const pick = pickWeighted(first.length ? first : second, seed, () => 1);
    if (pick) return personCard(pick);
  }
  return null;
}

/**
 * Weight starter movies so each decade gets an equal share of picks (the '70s half a share),
 * however many movies of that decade are left.
 */
function decadeBalanced(pool: StarterMovie[], seed: string) {
  const perDecade = new Map<number, number>();
  for (const m of pool) perDecade.set(m.decade, (perDecade.get(m.decade) ?? 0) + 1);
  return (m: StarterMovie) => yearWeight(m.decade, seed) / perDecade.get(m.decade)!;
}

/** Fresh card of the given kind, for dead ends, passes, and new chains in challenges. */
async function freshCard(kind: Card["kind"], used: Set<string>, seed: string): Promise<Card> {
  const pool = (await getStarterPool()).filter((m) => !used.has(cardKey({ kind: "movie", id: m.id })));
  const pick = pickWeighted(pool, seed, decadeBalanced(pool, seed))!;
  const movie = await getMovie(pick.id);
  if (kind === "movie") return movieCard(movie);
  used.add(cardKey({ kind: "movie", id: movie.id }));
  return (await nextPersonFor(movie, used, seed)) ?? freshCard(kind, used, seed);
}

type PuzzleRow = { number: number; kind: Card["kind"]; tmdb_id: number; movie_id: number };

/** How many well-known movies someone has acted in: a steadier fame signal than trending popularity. */
const famousCredits = (p: TmdbPerson) =>
  p.movie_credits.cast.filter((c) => c.vote_count >= 2000 && !NOT_A_ROLE.test(c.character ?? "")).length;

/**
 * For actor days: a true star to open with. One of the top two billed, with at least 12
 * well-known movies (so it's someone everyone recognizes and has plenty of answers), skipping
 * anyone who already started a day.
 */
async function leadActor(movie: TmdbMovie, usedPeople: Set<number>, strict = true) {
  const topBilled = strict ? 2 : 3;
  const minFamous = strict ? 12 : 6;
  const billed = movie.credits.cast.filter(
    (c) => c.order < topBilled && c.profile_path && !usedPeople.has(c.id) && !NOT_A_ROLE.test(c.character ?? ""),
  );
  const people = await Promise.all(billed.map((c) => getPerson(c.id)));
  return people
    .filter((p) => famousCredits(p) >= minFamous)
    .sort((a, b) => famousCredits(b) - famousCredits(a))[0];
}

/** Opening cards come from each decade's very best-known films, so nobody starts on a deep cut. */
const isHeadliner = (m: StarterMovie) => m.rank < (m.decade === 1970 ? 20 : 40);

/**
 * The puzzle for a date (YYYY-MM-DD, Eastern). Each day's start is chosen once and saved,
 * and never reuses a movie or lead actor from an earlier day.
 */
export async function dailyStart(dateStr: string): Promise<{ number: number; card: Card }> {
  const number = puzzleNumber(dateStr);
  const supabase = createAdminClient();
  const toCard = async (row: PuzzleRow) =>
    row.kind === "person" ? personCard(await getPerson(row.tmdb_id)) : movieCard(await getMovie(row.tmdb_id));

  const existing = await supabase.from("daily_puzzles").select("*").eq("number", number).maybeSingle<PuzzleRow>();
  if (existing.data) return { number, card: await toCard(existing.data) };

  const history = await supabase.from("daily_puzzles").select("kind, tmdb_id, movie_id");
  if (history.error) throw history.error;
  const usedMovies = new Set(history.data.map((r) => r.movie_id));
  const usedPeople = new Set(history.data.filter((r) => r.kind === "person").map((r) => r.tmdb_id));

  // Odd puzzles start with a movie, even ones with an actor.
  const kind: Card["kind"] = number % 2 === 0 ? "person" : "movie";
  let pool = (await getStarterPool()).filter((m) => isHeadliner(m) && !usedMovies.has(m.id));
  // Stars first; if none qualify after many tries, fall back to the looser rule so a day is never empty.
  for (let attempt = 0; attempt < 35 && pool.length > 0; attempt++) {
    const pick = pickWeighted(pool, `${dateStr}:${attempt}`, decadeBalanced(pool, dateStr))!;
    const movie = await getMovie(pick.id);
    const lead = kind === "person" ? await leadActor(movie, usedPeople, attempt < 25) : null;
    if (kind === "person" && !lead) {
      pool = pool.filter((m) => m.id !== pick.id);
      continue;
    }
    const row: PuzzleRow = { number, kind, tmdb_id: lead?.id ?? movie.id, movie_id: movie.id };
    const saved = await supabase
      .from("daily_puzzles")
      .insert({ ...row, puzzle_date: dateStr })
      .select("*")
      .single<PuzzleRow>();
    // Two players can hit a brand-new day at once; whoever saved first wins.
    if (saved.error) {
      const winner = await supabase.from("daily_puzzles").select("*").eq("number", number).single<PuzzleRow>();
      if (winner.error) throw winner.error;
      return { number, card: await toCard(winner.data) };
    }
    return { number, card: await toCard(saved.data) };
  }
  throw new Error("Ran out of unused starting movies");
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
    const guessKeys = [key, nicknameKey(guess)];
    let { best, items } = ranked(cast, (c) => closeness([key], [nameKey(c.name)]));
    if (items.length === 0) {
      // A nickname for the first name ("Cathy" for Catherine), only when nothing matched as typed.
      const nick = ranked(cast, (c) => closeness(guessKeys, [nicknameKey(c.name)]));
      if (new Set(nick.items.map((c) => c.id)).size === 1) ({ best, items } = { best: 1, items: nick.items });
    }
    if (items.length === 0 && key.length >= 4) {
      // Last name only, e.g. "Cruise" for Top Gun, if exactly one cast member has it.
      const byLast = ranked(cast, (c) => closeness([key], [lastName(c.name)]));
      const people = new Set(byLast.items.map((c) => c.id));
      if (people.size === 1) ({ best, items } = { best: 1, items: byLast.items });
    }
    if (items.length === 0) {
      // Spelled by ear ("Kay Huay Quan" for Ke Huy Quan), if it points to exactly one person.
      const heard = cast.filter((c) => soundsLike(guess, c.name));
      if (new Set(heard.map((c) => c.id)).size === 1) ({ best, items } = { best: 1, items: heard });
    }
    if (items.length === 0) {
      // Another name they've been credited under (the main cast only, to keep lookups cheap).
      const top = cast.slice(0, 15);
      const people = await Promise.all(top.map((c) => getPerson(c.id).catch(() => null)));
      const known = top.filter((c, i) =>
        (people[i]?.also_known_as ?? []).some(
          (aka) => closeness(guessKeys, [nameKey(aka), nicknameKey(aka)]) < Infinity || soundsLike(guess, aka),
        ),
      );
      if (new Set(known.map((c) => c.id)).size === 1) ({ best, items } = { best: 1, items: known });
    }
    if (items.length === 0) return { outcome: "wrong" };
    const answer = personCard(await getPerson(items[0].id));
    if (used.has(cardKey(answer))) return { outcome: "used", answer };
    return { outcome: "correct", answer, close: best > 0 };
  }

  const credits = (await getPerson(card.id)).movie_credits.cast
    .slice()
    .sort((a, b) => b.vote_count - a.vote_count);
  // The main title alone counts too: "Batman v Superman" for "Batman v Superman: Dawn of Justice".
  const mainTitle = (title: string) => (title.includes(":") ? titleKey(title.split(":")[0]) : "");
  let { best, items } = ranked(credits, (c) =>
    closeness(
      [key, titleKey(guess)],
      [nameKey(c.title), nameKey(c.original_title), titleKey(c.title), mainTitle(c.title)],
    ),
  );
  if (items.length === 0) {
    // A title spelled by ear, if it points to exactly one film.
    const strip = (s: string) => s.replace(/^\s*(the|a|an)\s+/i, "");
    const heard = credits.filter(
      (c) => soundsLike(strip(guess), strip(c.title)) || soundsLike(strip(guess), strip(c.title.split(":")[0])),
    );
    if (new Set(heard.map((c) => c.id)).size === 1) ({ best, items } = { best: 1, items: heard });
  }
  if (items.length === 0) {
    // Another title the film goes by ("The Road Warrior" for Mad Max 2), among their best-known films.
    const top = credits.slice(0, 40);
    const alts = await Promise.all(top.map((c) => getAltTitles(c.id).catch(() => [] as string[])));
    const strip = (s: string) => s.replace(/^\s*(the|a|an)\s+/i, "");
    const known = top.filter((c, i) =>
      alts[i].some(
        (t) => closeness([key, titleKey(guess)], [nameKey(t), titleKey(t)]) < Infinity || soundsLike(strip(guess), strip(t)),
      ),
    );
    if (new Set(known.map((c) => c.id)).size === 1) ({ best, items } = { best: 1, items: known });
  }
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
