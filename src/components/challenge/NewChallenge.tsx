"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { create } from "@/app/challenge/actions";
import { MAX_PLAYERS } from "@/lib/challenge-types";
import { Logo } from "../Logo";
import { JoinWithCode } from "./JoinWithCode";
import { loadNickname, saveNickname } from "./nickname";
import { YourGames } from "./YourGames";

export function NewChallenge() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Prefill after hydration so the server-rendered HTML matches.
  useEffect(() => {
    if (inputRef.current && !inputRef.current.value) inputRef.current.value = loadNickname();
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nickname = inputRef.current?.value.trim() ?? "";
    if (!nickname) {
      setError("Pick a nickname first.");
      inputRef.current?.focus();
      return;
    }
    if (isPending) return;
    startTransition(async () => {
      try {
        saveNickname(nickname);
        const result = await create(nickname);
        if (!result.ok) return setError("You've started a lot of games. Try again in a little while.");
        track("challenge_created");
        router.push(`/c/${result.id}`);
      } catch {
        setError("Couldn't create the challenge. Try again.");
      }
    });
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="relative w-full">
        <Logo size="sm" />
        <Link
          href="/"
          className="absolute top-0 left-0 flex h-11 items-center rounded-full border border-white/15 px-4 text-sm text-zinc-300 active:bg-white/10"
        >
          ← Daily
        </Link>
      </div>

      {/* Games already going come first, so tapping the VS badge lands on them. */}
      <YourGames />

      <div className="mt-4 text-center">
        <h2 className="font-display text-4xl tracking-wide text-amber-400">CHALLENGE A FRIEND</h2>
        <p className="mt-2 text-zinc-300">
          Up to {MAX_PLAYERS} players take turns on one chain. Miss and you get a letter. Last one
          standing wins.
        </p>
      </div>

      <ol className="w-full space-y-2 rounded-2xl bg-white/5 p-4 text-sm text-zinc-300">
        <li>
          <b className="text-white">1.</b> Pick a nickname and create the game.
        </li>
        <li>
          <b className="text-white">2.</b> Text the link to your friends.
        </li>
        <li>
          <b className="text-white">3.</b> Play live together, or take turns whenever you like.
        </li>
      </ol>

      <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
        <label htmlFor="nickname" className="text-sm uppercase tracking-wider text-zinc-400">
          Your nickname
        </label>
        <input
          id="nickname"
          ref={inputRef}
          maxLength={20}
          autoComplete="nickname"
          placeholder="e.g. Maverick"
          className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3.5 text-lg outline-none placeholder:text-zinc-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
        />
        <button
          type="submit"
          disabled={isPending}
          className="min-h-12 rounded-xl bg-amber-400 text-lg font-bold text-black active:scale-[0.98] disabled:opacity-40"
        >
          {isPending ? "Creating…" : "Create challenge"}
        </button>
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </form>

      <div className="flex w-full items-center gap-3 text-xs uppercase tracking-widest text-zinc-400">
        <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
      </div>
      <JoinWithCode />
    </div>
  );
}
