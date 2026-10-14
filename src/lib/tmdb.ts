import "server-only";
import { cacheLife } from "next/cache";

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

export type TmdbCastCredit = {
  id: number;
  name: string;
  character: string;
  order: number;
  profile_path: string | null;
  popularity: number;
  known_for_department?: string;
};

export type TmdbMovieCredit = {
  id: number;
  title: string;
  original_title: string;
  character: string;
  release_date: string;
  poster_path: string | null;
  popularity: number;
  vote_count: number;
  genre_ids: number[];
};

export type TmdbMovie = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  popularity: number;
  vote_count: number;
  imdb_id: string | null;
  credits: { cast: TmdbCastCredit[] };
};

export type TmdbPerson = {
  id: number;
  name: string;
  profile_path: string | null;
  popularity: number;
  imdb_id: string | null;
  movie_credits: { cast: TmdbMovieCredit[] };
};

async function tmdb<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_READ_TOKEN}` },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

export async function getMovie(id: number): Promise<TmdbMovie> {
  "use cache";
  cacheLife("days");
  return tmdb<TmdbMovie>(`/movie/${id}?append_to_response=credits`);
}

export async function getPerson(id: number): Promise<TmdbPerson> {
  "use cache";
  cacheLife("days");
  return tmdb<TmdbPerson>(`/person/${id}?append_to_response=movie_credits`);
}

export type StarterMovie = { id: number; title: string; year: number; decade: number };

// The most-voted lists skew heavily recent, so take each decade's best-known films separately.
const STARTER_DECADES = [
  { decade: 1970, pages: 2 }, // top 40
  { decade: 1980, pages: 5 }, // top 100
  { decade: 1990, pages: 5 },
  { decade: 2000, pages: 5 },
  { decade: 2010, pages: 5 },
  { decade: 2020, pages: 3 }, // top 60
];

/** ~500 well-known English-language movies from 1970 on, balanced by decade. Seeds daily puzzles. */
export async function getStarterPool(): Promise<StarterMovie[]> {
  "use cache";
  cacheLife("weeks");
  const requests = STARTER_DECADES.flatMap(({ decade, pages }) =>
    Array.from({ length: pages }, (_, i) =>
      tmdb<{ results: { id: number; title: string; release_date: string }[] }>(
        `/discover/movie?sort_by=vote_count.desc&with_original_language=en&without_genres=16,99` +
          `&primary_release_date.gte=${decade}-01-01&primary_release_date.lte=${decade + 9}-12-31` +
          `&page=${i + 1}`,
      ).then((p) =>
        p.results.map(({ id, title, release_date }) => ({
          id,
          title,
          year: Number(release_date?.slice(0, 4)),
          decade,
        })),
      ),
    ),
  );
  return (await Promise.all(requests)).flat();
}

export function posterUrl(path: string | null) {
  return path ? `${IMG}/w500${path}` : null;
}

export function profileUrl(path: string | null) {
  return path ? `${IMG}/h632${path}` : null;
}
