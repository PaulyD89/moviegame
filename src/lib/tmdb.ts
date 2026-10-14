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

/** Well-known movies used to seed daily puzzles, most-voted first. */
export async function getStarterPool(): Promise<{ id: number; title: string }[]> {
  "use cache";
  cacheLife("weeks");
  const pages = await Promise.all(
    [1, 2, 3, 4, 5].map((page) =>
      tmdb<{ results: { id: number; title: string; genre_ids: number[] }[] }>(
        `/discover/movie?sort_by=vote_count.desc&with_original_language=en&without_genres=16,99&page=${page}`,
      ),
    ),
  );
  return pages.flatMap((p) => p.results).map(({ id, title }) => ({ id, title }));
}

export function posterUrl(path: string | null) {
  return path ? `${IMG}/w500${path}` : null;
}

export function profileUrl(path: string | null) {
  return path ? `${IMG}/h632${path}` : null;
}
