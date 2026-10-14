export type CardKind = "movie" | "person";

/** A movie or actor on screen or in the chain. */
export type Card = {
  kind: CardKind;
  id: number;
  name: string;
  image: string | null;
  year?: number;
  popularity: number;
  imdbId?: string | null;
};

/** Stable key for "already used" checks, e.g. "movie:744". */
export const cardKey = (c: Pick<Card, "kind" | "id">) => `${c.kind}:${c.id}`;

export type GuessResult =
  | { outcome: "correct"; answer: Card; next: Card | null }
  | { outcome: "wrong" }
  | { outcome: "used"; answer: Card };

export const WORD = "MOVIE";
export const LINKS_TO_WIN = 10;
