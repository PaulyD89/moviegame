"use client";

import { track } from "@vercel/analytics";
import { useEffect, useState } from "react";
import { filmLinks } from "@/app/letterboxd/actions";
import type { Card } from "@/lib/types";

/** Letterboxd opens a film page straight from its TMDB id. */
export const letterboxdUrl = (movieId: number) => `https://letterboxd.com/tmdb/${movieId}/`;

/**
 * Direct film links for a set of movies, looked up once. Until they arrive (or if one can't be
 * found) links use Letterboxd's TMDB shortcut, which opens the website instead of the app.
 */
export function useLetterboxdLinks(movieIds: number[]) {
  const [links, setLinks] = useState<Record<number, string>>({});
  const key = movieIds.join(",");
  useEffect(() => {
    if (!key) return;
    let active = true;
    filmLinks(key.split(",").map(Number))
      .then((l) => active && setLinks(l))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [key]);
  return links;
}

/** Small "Letterboxd ↗" link for a movie in a finished chain. */
export function LetterboxdLink({ movieId, href }: { movieId: number; href?: string }) {
  return (
    <a
      href={href ?? letterboxdUrl(movieId)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("letterboxd_film_opened")}
      aria-label="Open on Letterboxd"
      className="mt-1 inline-block rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-95"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static badge */}
      <img src="/letterboxd-logo.png" alt="Letterboxd" width={54} height={29} className="block rounded-sm" />
    </a>
  );
}

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/**
 * "Save this chain as a Letterboxd list": a CSV in Letterboxd's import format (tmdbID, Title, Year).
 * On phones it opens the share sheet (Save to Files); elsewhere it downloads. Then Letterboxd's
 * New list → Import turns it into a list.
 */
export function LetterboxdListButton({ movies, number }: { movies: Card[]; number: number }) {
  const [saved, setSaved] = useState(false);
  if (movies.length === 0) return null;

  async function save() {
    const rows = movies.map((m) => [String(m.id), csvCell(m.name), m.year ? String(m.year) : ""].join(","));
    const csv = ["tmdbID,Title,Year", ...rows].join("\n") + "\n";
    const name = `movie-horse-${number}-letterboxd.csv`;
    const file = new File([csv], name, { type: "text/csv" });
    track("letterboxd_list_saved", { movies: movies.length });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Movie Horse #${number}` });
      } else {
        const url = URL.createObjectURL(file);
        const a = Object.assign(document.createElement("a"), { href: url, download: name });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      setSaved(true);
    } catch {
      // Share sheet dismissed.
    }
  }

  return (
    <div className="-mt-2 text-center text-sm">
      <button onClick={save} className="min-h-11 px-3 text-zinc-300 underline underline-offset-2">
        📋 Save this chain as a Letterboxd list
      </button>
      {saved && (
        <p className="text-xs text-zinc-400">
          Now on Letterboxd: <b className="text-zinc-200">New list → Import</b> and pick the file.{" "}
          <a
            href="https://letterboxd.com/list/new/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 underline"
          >
            Open Letterboxd ↗
          </a>
        </p>
      )}
    </div>
  );
}
