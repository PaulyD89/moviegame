"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { msUntilNextPuzzle } from "@/lib/daily-clock";
import { LINKS_TO_WIN, WORD, type Card } from "@/lib/types";
import { Letters } from "./Game";
import { Logo } from "./Logo";
import { loadStats, type SavedGame, type Stats } from "./storage";

function formatTime(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function insights(game: SavedGame) {
  const nodes = game.links.flatMap((l) => [l.card, l.answer]);
  const movies = nodes.filter((n) => n.kind === "movie" && n.year) as (Card & { year: number })[];
  const years = movies.map((m) => m.year);
  const decades = [...new Set(years.map((y) => Math.floor(y / 10) * 10))].sort();
  const answers = game.links.map((l) => l.answer);
  // Only worth calling out once there's enough of a chain to compare.
  const deepCut =
    answers.length >= 3 ? answers.reduce((a, b) => (b.popularity < a.popularity ? b : a)) : null;
  const span = movies.length >= 2;
  return {
    oldest: span ? movies.reduce((a, b) => (b.year < a.year ? b : a)) : null,
    newest: span ? movies.reduce((a, b) => (b.year > a.year ? b : a)) : null,
    decades,
    deepCut,
  };
}

export function shareText(game: SavedGame) {
  // Answers are always the opposite kind of the card being shown.
  const answerEmoji = game.card.kind === "movie" ? "🎭" : "🎬";
  const trail = game.events
    .map((e) => (e === "correct" ? answerEmoji : e === "wrong" ? "🟥" : "⏭️"))
    .join("");
  const word = WORD.split("")
    .map((ch, i) => (i < game.letters ? ch : "_"))
    .join(" ");
  const time = game.finishedAt ? ` · ${formatTime(game.finishedAt - game.startedAt)}` : "";
  return [
    `Movie Horse #${game.number} 🐴`,
    `${game.links.length}/${LINKS_TO_WIN} links${time}`,
    trail,
    `${word}`,
  ].join("\n");
}

export function Results({ game }: { game: SavedGame }) {
  // Only rendered client-side, after the game has loaded from storage.
  const [stats] = useState<Stats>(loadStats);
  const [copied, setCopied] = useState(false);

  const won = game.status === "won";
  const { oldest, newest, decades, deepCut } = insights(game);
  const chain = [...game.links.flatMap((l) => [l.card, l.answer]), ...(won ? [] : [game.card])];

  async function share() {
    const text = shareText(game);
    const url = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ text: `${text}\n${url}` });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed.
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Logo size="lg" />
      <div className="-mt-2 text-center">
        <h2 className="font-display text-5xl tracking-wide text-amber-400">
          {won ? "That's a wrap!" : "M-O-V-I-E"}
        </h2>
        <p className="mt-1 text-zinc-300">
          {won
            ? `You made all ${LINKS_TO_WIN} links.`
            : `You made ${game.links.length} of ${LINKS_TO_WIN} links before spelling it.`}
        </p>
      </div>

      <Letters count={game.letters} />

      <ol className="-mx-4 flex w-[calc(100%+2rem)] snap-x gap-3 overflow-x-auto px-4 pb-2">
        {chain.map((node, i) => (
          <li key={`${node.kind}-${node.id}-${i}`} className="w-24 shrink-0 snap-start text-center">
            <div
              className={`relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800 ring-1 ${
                !won && i === chain.length - 1 ? "ring-red-500" : "ring-white/10"
              }`}
            >
              {node.image && (
                <Image src={node.image} alt={node.name} fill sizes="96px" className="object-cover" />
              )}
            </div>
            <div className="mt-1 line-clamp-2 text-xs text-zinc-300">{node.name}</div>
          </li>
        ))}
      </ol>

      <dl className="grid w-full grid-cols-2 gap-3 text-sm">
        {decades.length > 0 && (
          <Insight label="Decades covered" value={decades.map((d) => `${d}s`).join(" · ")} />
        )}
        {game.finishedAt && <Insight label="Time" value={formatTime(game.finishedAt - game.startedAt)} />}
        {oldest && <Insight label="Oldest film" value={`${oldest.name} (${oldest.year})`} />}
        {newest && newest !== oldest && <Insight label="Newest film" value={`${newest.name} (${newest.year})`} />}
        {deepCut && <Insight label="Deep cut" value={deepCut.name} wide />}
      </dl>

      {stats.played > 0 && (
        <div className="grid w-full grid-cols-4 gap-2 text-center">
          <Stat label="Played" value={stats.played} />
          <Stat label="Win %" value={stats.played ? Math.round((stats.won / stats.played) * 100) : 0} />
          <Stat label="Streak" value={stats.streak} />
          <Stat label="Best" value={stats.maxStreak} />
        </div>
      )}

      <button
        onClick={share}
        className="w-full rounded-xl bg-amber-400 py-4 text-lg font-bold text-black active:scale-[0.98]"
      >
        {copied ? "Copied!" : "Share result"}
      </button>
      <Link
        href="/challenge"
        className="-mt-2 flex min-h-12 w-full items-center justify-center rounded-xl border border-amber-400 text-lg font-bold text-amber-400 active:scale-[0.98]"
      >
        Challenge a friend
      </Link>
      <NextPuzzle />
    </div>
  );
}

function Insight({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-lg bg-white/5 p-3 ${wide ? "col-span-2" : ""}`}>
      <dt className="text-xs uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

/** Countdown to the next daily chain (midnight Eastern / 9pm Pacific). */
function NextPuzzle() {
  const [left, setLeft] = useState(msUntilNextPuzzle);
  useEffect(() => {
    const t = setInterval(() => {
      const ms = msUntilNextPuzzle();
      setLeft(ms);
      // Past midnight Eastern: reload so the new chain appears.
      if (ms > 86_000_000) window.location.reload();
    }, 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.floor(left / 1000);
  const hms = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return (
    <p className="text-center text-sm text-zinc-300">
      Next chain in <span className="font-display text-lg tracking-wider text-white">{hms}</span>
      <br />
      <span className="text-xs text-zinc-400">New chain daily at midnight ET / 9pm PT</span>
    </p>
  );
}
