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
  | { outcome: "correct"; answer: Card; next: Card | null; close: boolean }
  | { outcome: "wrong" }
  | { outcome: "used"; answer: Card };

export const WORD = "MOVIE";
export const LINKS_TO_WIN = 10;
/** Answer within this long of a daily card appearing for a +1 speed bonus. */
export const FAST_MS = 20_000;

/** A 7-day streak (days played in a row) earns a claimed name. */
export const CLAIM_STREAK = 7;
