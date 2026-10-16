"use client";

import Image from "next/image";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { useEffect, useState } from "react";
import { myAnswerStats, myDailyRank } from "@/app/actions";
import type { LinkCompare } from "@/lib/answer-stats";
import { msUntilNextPuzzle } from "@/lib/daily-clock";
import { LINKS_TO_WIN, WORD, type Card } from "@/lib/types";
import { Letters } from "./Game";
import { Logo } from "./Logo";
import { LetterboxdLink, useLetterboxdLinks } from "./Letterboxd";
import { StatsSheet } from "./StatsSheet";
import { NotifyButton } from "./push/NotifyButton";
import { ReminderNudge } from "./push/ReminderNudge";
import { isPerfect, type SavedGame, type Stats } from "./storage";
import { useSyncedStats } from "./useStats";

function formatTime(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Server-timed games carry their duration; older ones timed themselves on the phone. */
function duration(game: SavedGame) {
  if (typeof game.durationMs === "number") return game.durationMs;
  return game.finishedAt && game.startedAt ? game.finishedAt - game.startedAt : null;
}

/** Today's global-rank points (see the player_points SQL function). */
function points(game: SavedGame) {
  const base = game.status === "won" ? 10 + 2 * (WORD.length - game.letters) : 2;
  return { base, speed: game.fastLinks ?? 0, total: base + (game.fastLinks ?? 0) };
}

/** The chain's movies in order, once each, for a Letterboxd list. */
function chainMovies(chain: Card[]) {
  const seen = new Set<number>();
  return chain.filter((c) => c.kind === "movie" && !seen.has(c.id) && seen.add(c.id));
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
  const ms = duration(game);
  const time = ms !== null ? ` · ${formatTime(ms)}` : "";
  const fast = game.fastLinks ? ` · ⚡${game.fastLinks}` : "";
  return [
    `Movie Horse #${game.number} 🐴`,
    `${game.links.length}/${LINKS_TO_WIN} links${time}${fast}`,
    trail,
    `${word}`,
  ].join("\n");
}

export function Results({ game }: { game: SavedGame }) {
  // Only rendered client-side, after the game has loaded from storage.
  const stats: Stats = useSyncedStats();
  const [copied, setCopied] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const card = useShareCard(game);

  const won = game.status === "won";
  const { oldest, newest, decades, deepCut } = insights(game);
  const chain = [
    ...game.links.flatMap((l) => [
      { ...l.card, fast: false },
      { ...l.answer, fast: !!l.fast },
    ]),
    ...(won ? [] : [{ ...game.card, fast: false }]),
  ];
  const filmLinks = useLetterboxdLinks(chainMovies(chain).map((m) => m.id));
  const ms = duration(game);
  const pts = points(game);
  const perfect = isPerfect(game);
  const personalBest = perfect && stats.bestPerfectMs === game.durationMs;

  async function share() {
    const text = shareText(game);
    const url = window.location.origin;
    // The picture is fetched ahead of time: iPhones only open the share sheet straight from a tap.
    const files = card ? [card] : [];
    const withImage = files.length > 0 && !!navigator.canShare?.({ files });
    track("result_shared", { image: withImage });
    try {
      if (withImage) {
        await navigator.share({ files, text: `${text}\n${url}` });
        return;
      }
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

  // One line instead of the old speed box: links · fast · time · points.
  const resultLine = [
    `${game.links.length}/${LINKS_TO_WIN} links`,
    ...(typeof game.durationMs === "number" ? [`⚡ ${pts.speed} fast`] : []),
    ...(ms !== null ? [formatTime(ms)] : []),
    ...(typeof game.durationMs === "number" ? [`${pts.total} pts`] : []),
  ].join(" · ");

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <Logo size="md" />
      <h2 className="-mt-2 text-center font-display text-[2.55rem] leading-tight tracking-wide text-amber-400">
        {won ? (game.letters === 0 ? "Perfect game!" : "That's a wrap!") : "M-O-V-I-E"}
      </h2>

      <Letters count={game.letters} />

      <div className="-mt-1 flex flex-col items-center gap-1 text-center">
        <p className="font-display text-xl tracking-wide text-white">{resultLine}</p>
        {perfect && ms !== null && (
          <p className="text-sm font-semibold text-amber-300">
            {personalBest ? "🏁 New record! " : "🏁 "}Perfect game in {formatTime(ms)}
          </p>
        )}
      </div>

      <div className="grid w-full grid-cols-[1.3fr_1fr] gap-2">
        <button
          onClick={share}
          className="min-h-10 rounded-lg bg-amber-400 px-3 text-sm font-bold text-black active:scale-[0.98]"
        >
          {copied ? "Copied!" : "Share result"}
        </button>
        <Link
          href="/challenge"
          className="flex min-h-10 items-center justify-center rounded-lg border border-amber-400 px-3 text-sm font-bold text-amber-400 active:scale-[0.98]"
        >
          Play with friends
        </Link>
      </div>

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
              {node.fast && (
                <span
                  className="absolute top-1 right-1 rounded-full bg-black/70 px-1 text-xs"
                  aria-label="answered fast"
                >
                  ⚡
                </span>
              )}
            </div>
            <div className="mt-1 line-clamp-2 text-xs text-zinc-300">{node.name}</div>
            {node.kind === "movie" && <LetterboxdLink movieId={node.id} href={filmLinks[node.id]} />}
          </li>
        ))}
      </ol>

      <TodayRank number={game.number} />
      <HowYouCompare number={game.number} />

      <div className="flex w-full flex-wrap gap-1.5">
        {decades.length > 0 && <Chip label="Decades" value={decades.map((d) => `${String(d).slice(2)}s`).join(" · ")} />}
        {oldest && <Chip label="Oldest" value={oldest.name} />}
        {newest && newest !== oldest && <Chip label="Newest" value={newest.name} />}
        {deepCut && <Chip label="Deep cut" value={deepCut.name} />}
      </div>

      {stats.played > 0 && (
        <div className="grid w-full grid-cols-4 gap-2 text-center">
          <Stat label="Played" value={stats.played} />
          <Stat label="Win %" value={stats.played ? Math.round((stats.won / stats.played) * 100) : 0} />
          <Stat label="Streak" value={stats.streak} />
          <Stat label="Best" value={stats.maxStreak} />
        </div>
      )}
      <button onClick={() => setShowStats(true)} className="-mt-3 min-h-11 px-3 text-sm text-zinc-200 underline">
        See all your stats
      </button>
      {showStats && (
        <StatsSheet todayNumber={game.number} todayLinks={game.links.length} onClose={() => setShowStats(false)} />
      )}

      <NextPuzzle />
      <ReminderNudge />
      <NotifyButton mode="daily" />
    </div>
  );
}

/** A small fact about the chain, in a row of chips. */
function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 max-w-full truncate rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-200">
      <span className="mr-1 text-zinc-500">{label}</span>
      {value}
    </span>
  );
}

/** Today's result as a picture to share, ready before the tap (server-scored games only). */
function useShareCard(game: SavedGame) {
  const [file, setFile] = useState<File | null>(null);
  const serverScored = typeof game.durationMs === "number";
  useEffect(() => {
    if (!serverScored) return;
    let active = true;
    fetch("/api/share/daily", { cache: "no-store" })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (active && blob) setFile(new File([blob], `movie-horse-${game.number}.png`, { type: "image/png" }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [serverScored, game.number]);
  return file;
}

/** How your answers stacked up against everyone's today. Hidden until enough people have played. */
function HowYouCompare({ number }: { number: number }) {
  const [rows, setRows] = useState<LinkCompare[]>([]);
  useEffect(() => {
    let active = true;
    myAnswerStats(number)
      .then((r) => active && setRows(r))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [number]);
  if (rows.length === 0) return null;
  const rarest = rows.reduce((a, b) => (b.pct < a.pct ? b : a));

  return (
    <section className="w-full">
      <h3 className="mb-2 text-xs uppercase tracking-widest text-zinc-300">How you compare</h3>
      {rarest.pct <= 10 && (
        <p className="mb-2 rounded-xl bg-amber-400/15 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/50">
          🦄 Rare pick! Only <b className="text-white">{rarest.pct}%</b> said {rarest.answer.name} for{" "}
          {rarest.prompt.name}.
        </p>
      )}
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={`${r.prompt.kind}-${r.prompt.id}`} className="rounded-xl bg-white/5 px-4 py-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-zinc-300">
                {r.prompt.name} → <b className="text-white">{r.answer.name}</b>
              </span>
              <span className="shrink-0 font-semibold text-amber-400">{r.pct}%</span>
            </div>
            <div className="text-xs text-zinc-400">
              {r.top ? `Most said ${r.top.name} (${r.top.pct}%)` : "👑 The most popular answer"}
            </div>
          </li>
        ))}
      </ul>
    </section>
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
      // The game screen moves to the new chain at midnight Eastern.
      setLeft(msUntilNextPuzzle());
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

/** "You beat 72% of players today", once enough people have finished to make it meaningful. */
function TodayRank({ number }: { number: number }) {
  const [rank, setRank] = useState<{ others: number; percentBeat: number } | null>(null);
  useEffect(() => {
    let active = true;
    // The finish is logged in the background, so retry briefly if it hasn't landed yet.
    const attempt = (tries: number) =>
      myDailyRank(number)
        .then((r) => {
          if (!active) return;
          if (r) setRank(r);
          else if (tries > 0) setTimeout(() => attempt(tries - 1), 1500);
        })
        .catch(() => {});
    attempt(3);
    return () => {
      active = false;
    };
  }, [number]);
  if (!rank || rank.others < 3) return null;
  return (
    <p className="-mb-2 w-full rounded-xl bg-amber-400/10 px-4 py-2.5 text-center text-sm text-white ring-1 ring-amber-400/40">
      🏅 You beat <b className="text-amber-400">{rank.percentBeat}%</b> of players today
    </p>
  );
}
