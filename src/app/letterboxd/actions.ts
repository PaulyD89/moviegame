"use server";

import { letterboxdFilmUrl } from "@/lib/letterboxd";

/** Direct Letterboxd film links (which open the app) for up to 20 TMDB movie ids. */
export async function filmLinks(ids: number[]) {
  const clean = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 20);
  const urls = await Promise.all(clean.map((id) => letterboxdFilmUrl(id)));
  return Object.fromEntries(clean.flatMap((id, i) => (urls[i] ? [[id, urls[i]]] : [])));
}
