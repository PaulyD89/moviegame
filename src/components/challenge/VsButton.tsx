"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { myGames } from "@/app/challenge/actions";
import { loadGameIds, recordFinished } from "./myGames";

/** The VS link on the daily screen, with a badge counting challenges waiting on you. */
export function VsButton() {
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    let active = true;
    function check() {
      const ids = loadGameIds();
      if (document.hidden || ids.length === 0) return;
      myGames(ids)
        .then((games) => {
          recordFinished(games); // games that ended while you were away still count in your stats
          if (active) setWaiting(games.filter((g) => g.yourTurn).length);
        })
        .catch(() => {});
    }
    check();
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return (
    <Link
      href="/challenge"
      aria-label={
        waiting
          ? `Challenge a friend. It's your turn in ${waiting} ${waiting === 1 ? "game" : "games"}`
          : "Challenge a friend"
      }
      className="absolute top-0 left-0 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 font-display text-sm tracking-wide text-amber-400 active:bg-white/10"
    >
      VS
      {waiting > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 animate-rise items-center justify-center rounded-full bg-red-600 px-1 font-sans text-xs font-bold text-white ring-2 ring-black">
          {waiting}
        </span>
      )}
    </Link>
  );
}
