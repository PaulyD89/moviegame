import "server-only";
import { cacheLife } from "next/cache";

/**
 * A film's real Letterboxd address (letterboxd.com/film/<slug>/), found by following Letterboxd's
 * TMDB shortcut once. Phones open the Letterboxd app for /film/ links, but not for the shortcut.
 */
export async function letterboxdFilmUrl(tmdbId: number): Promise<string | null> {
  "use cache";
  cacheLife("max");
  try {
    const res = await fetch(`https://letterboxd.com/tmdb/${tmdbId}/`, { method: "HEAD", redirect: "manual" });
    const location = res.headers.get("location");
    if (!location) return null;
    const url = new URL(location, "https://letterboxd.com");
    return url.hostname === "letterboxd.com" && url.pathname.startsWith("/film/") ? url.href : null;
  } catch {
    return null;
  }
}
