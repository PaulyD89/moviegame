"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { myGames } from "@/app/challenge/actions";
import type { ChallengeSummary } from "@/lib/challenge";
import { keepGames, loadGameIds } from "./myGames";

/** Games this device has joined, with whose turn it is. */
export function YourGames() {
  const [games, setGames] = useState<ChallengeSummary[]>([]);

  useEffect(() => {
    const ids = loadGameIds();
    if (ids.length)
      myGames(ids)
        .then((all) => setGames(keepGames(all)))
        .catch(() => {});
  }, []);

  if (games.length === 0) return null;
  return (
    <section className="w-full">
      <h3 className="mb-2 text-sm uppercase tracking-wider text-zinc-300">Your games</h3>
      <ul className="space-y-2">
        {games.map((g) => (
          <li key={g.id}>
            <Link
              href={`/c/${g.id}`}
              className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1 active:bg-white/10 ${
                g.yourTurn ? "bg-amber-400/15 ring-amber-400" : "bg-white/5 ring-white/10"
              }`}
            >
              <span className="min-w-0 truncate text-white">{g.players.join(", ")}</span>
              <span
                className={`shrink-0 text-sm font-semibold ${g.yourTurn ? "text-amber-400" : "text-zinc-300"}`}
              >
                {g.status === "lobby"
                  ? "In lobby"
                  : g.status === "finished"
                    ? g.youWon
                      ? "🏆 You won"
                      : `${g.winner ?? "Someone"} won`
                    : g.yourTurn
                      ? "Your turn!"
                      : `${g.turnName}'s turn`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
