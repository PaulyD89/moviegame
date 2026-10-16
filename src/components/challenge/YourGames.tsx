"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { myGames } from "@/app/challenge/actions";
import { keepGames, loadGameIds, recordFinished, type ListedGame } from "./myGames";

/** Games this device has joined, with whose turn it is. */
export function YourGames() {
  const [games, setGames] = useState<ListedGame[]>([]);

  useEffect(() => {
    const ids = loadGameIds();
    if (ids.length)
      myGames(ids)
        // Rows that need you (your turn, an unseen win) float to the top.
        .then((all) => {
          recordFinished(all);
          setGames(keepGames(all).sort((a, b) => Number(status(b).hot) - Number(status(a).hot)));
        })
        .catch(() => {});
  }, []);

  if (games.length === 0) return null;
  return (
    <section className="w-full rounded-2xl border border-amber-400/50 p-3">
      <h3 className="mb-2 px-1 text-sm uppercase tracking-wider text-amber-400">Your games</h3>
      <ul className="space-y-2">
        {games.map((g) => {
          const { label, hot } = status(g);
          return (
            <li key={g.id}>
              <Link
                href={`/c/${g.id}`}
                className={`flex min-h-12 items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1 active:bg-white/10 ${
                  hot ? "bg-amber-400/15 ring-amber-400" : "bg-white/5 ring-white/10"
                }`}
              >
                <span className="min-w-0 truncate text-white">
                  {g.others.length ? `vs ${g.others.join(", ")}` : "Just you so far"}
                </span>
                <span className={`shrink-0 text-sm font-semibold ${hot ? "text-amber-400" : "text-zinc-300"}`}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Right-hand label; "hot" rows need you (your turn, or a result you haven't seen). */
function status(g: ListedGame) {
  if (g.status === "lobby") return { label: g.others.length ? "In lobby" : "Invite friends", hot: false };
  if (g.status === "finished" && !g.winner) return { label: "Closed · nobody played", hot: false };
  if (g.status === "finished")
    return g.youWon
      ? { label: g.seen ? "🏆 You won · Share" : "🏆 You won! See result", hot: !g.seen }
      : { label: `${g.winner ?? "Someone"} won · See result`, hot: false };
  return { label: g.yourTurn ? "Your turn!" : `${g.turnName}'s turn`, hot: g.yourTurn };
}
