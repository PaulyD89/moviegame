"use client";

import Image from "next/image";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { useEffect, useState } from "react";
import { myAnswerStats, myCouldHaveSaid, myDailyRank, myName } from "@/app/actions";
import type { CouldHaveSaid as CouldHaveSaidData, LinkCompare } from "@/lib/answer-stats";
import { msUntilNextPuzzle } from "@/lib/daily-clock";
import { CLAIM_STREAK, LINKS_TO_WIN, WORD, type Card } from "@/lib/types";
import { Letters } from "./Game";
import { Logo } from "./Logo";
import { LetterboxdLink, useLetterboxdLinks } from "./Letterboxd";
import { StatsSheet } from "./StatsSheet";
import { NotifyButton } from "./push/NotifyButton";
import { ComeBackNudge } from "./push/ComeBackNudge";
import { isPerfect, type SavedGame, type Stats } from "./storage";
import { useSyncedStats } from "./useStats";
import { ClaimName } from "./ClaimName";

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
  const rank = useTodayRank(game.number);
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
    ...(won ? [`${game.links.length}/${LINKS_TO_WIN} links`] : []),
    ...(typeof game.durationMs === "number" ? [`⚡ ${pts.speed} fast`] : []),
    ...(ms !== null ? [formatTime(ms)] : []),
    ...(typeof game.durationMs === "number" ? [`${pts.total} pts`] : []),
  ].join(" · ");

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <Logo size="md" />
      {won ? (
        <>
          <h2 className="-mt-2 text-center font-display text-[2.55rem] leading-tight tracking-wide text-amber-400">
            {game.letters === 0 ? "Perfect game!" : "That's a wrap!"}
          </h2>
          <Letters count={game.letters} />
        </>
      ) : (
        // A loss leads with the run (links, and who you beat), then how it ended.
        <div className="-mt-2 flex flex-col items-center gap-3 text-center">
          <div>
            <h2 className="font-display text-[2.55rem] leading-tight tracking-wide text-amber-400">
              {game.links.length} {game.links.length === 1 ? "LINK" : "LINKS"}
            </h2>
            {rank && rank.others >= 3 && (
              <p className="text-[15px] text-zinc-300">
                You beat <b className="font-semibold text-white">{rank.percentBeat}% of players</b> today
              </p>
            )}
          </div>
          <Letters count={game.letters} small />
          <p className="-mt-1 text-sm font-medium text-red-300">
            Game Over on <b className="font-semibold text-white">{game.card.name}</b>
          </p>
        </div>
      )}

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

      {!won && <CouldHaveSaid number={game.number} />}

      <ClaimName />

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

      {/* How your day went: one card, its parts split by thin dividers (empty parts drop out). */}
      <div className="w-full divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
        {won && <TodayRank rank={rank} />}
        <HowYouCompare number={game.number} />
        {(decades.length > 0 || oldest || deepCut) && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5">
            {decades.length > 0 && (
              <Fact icon="decades" label="Decades" value={decades.map((d) => `${String(d).slice(2)}s`).join(" · ")} />
            )}
            {deepCut && <Fact icon="gem" label="Deepest pick" value={deepCut.name} />}
            {oldest && <Fact icon="rewind" label="Oldest" value={oldest.name} />}
            {newest && newest !== oldest && <Fact icon="sparkle" label="Newest" value={newest.name} />}
          </dl>
        )}
        {stats.played > 0 && (
          <div className="grid grid-cols-4 divide-x divide-white/10 py-3 text-center">
            <Stat label="Played" value={String(stats.played)} />
            <Stat label="Win" value={`${stats.played ? Math.round((stats.won / stats.played) * 100) : 0}%`} />
            <Stat label="Streak" value={String(stats.streak)} />
            <Stat label="Best" value={String(stats.maxStreak)} />
          </div>
        )}
        {stats.streak > 0 && stats.maxStreak < CLAIM_STREAK && <StreakGoal streak={stats.streak} />}
        <button
          onClick={() => setShowStats(true)}
          className="block min-h-11 w-full px-4 text-center text-sm font-semibold text-amber-400 active:bg-white/5"
        >
          See all your stats →
        </button>
      </div>
      {showStats && (
        <StatsSheet todayNumber={game.number} todayLinks={game.links.length} onClose={() => setShowStats(false)} />
      )}

      <NextPuzzle />
      <ComeBackNudge />
      <NotifyButton mode="daily" />
    </div>
  );
}

/** Line icons for the chain facts, drawn in gold on a faint gold tile. */
const FACT_ICONS = {
  decades: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4" />
    </>
  ),
  gem: <path d="M6 3h12l3 5-9 13L3 8zM3 8h18M9 3l3 5 3-5M12 21L9 8m3 13l3-13" />,
  rewind: <path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8M3 3v5h5M12 7v5l3.5 2" />,
  sparkle: (
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" />
  ),
};

/** A small fact about the chain: icon, label, value. */
function Fact({ icon, label, value }: { icon: keyof typeof FACT_ICONS; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-amber-400/10">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-[17px] w-[17px] fill-none stroke-amber-400"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {FACT_ICONS[icon]}
        </svg>
      </span>
      <div className="min-w-0">
        <dt className="text-[10.5px] uppercase tracking-[0.16em] text-zinc-400">{label}</dt>
        <dd className="truncate text-sm font-medium text-white">{value}</dd>
      </div>
    </div>
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

/** After a loss: up to 3 answers that would have worked on the card that ended the game. */
function CouldHaveSaid({ number }: { number: number }) {
  const [data, setData] = useState<CouldHaveSaidData | null>(null);
  useEffect(() => {
    let active = true;
    // The finish is logged in the background, so retry briefly if it hasn't landed yet.
    const attempt = (tries: number) =>
      myCouldHaveSaid(number)
        .then((d) => {
          if (!active) return;
          if (d) setData(d);
          else if (tries > 0) setTimeout(() => attempt(tries - 1), 1500);
        })
        .catch(() => {});
    attempt(3);
    return () => {
      active = false;
    };
  }, [number]);
  if (!data) return null;
  const { card, answers } = data;
  return (
    <section className="w-full rounded-2xl bg-white/5 px-4 py-3.5 ring-1 ring-white/10">
      <h3 className="text-[10.5px] uppercase tracking-[0.16em] text-zinc-400">You could have said</h3>
      <p className="mt-0.5 mb-3 text-sm text-zinc-300">
        {card.kind === "person" ? "Films" : "Actors"} that would have worked for <b className="text-white">{card.name}</b>
      </p>
      <ul className="grid grid-cols-3 gap-2.5">
        {answers.map(({ card: a, mostSaid }) => (
          <li key={`${a.kind}-${a.id}`} className="min-w-0 text-center">
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-white/10">
              {a.image && <Image src={a.image} alt={a.name} fill sizes="110px" className="object-cover" />}
            </div>
            <div className="mt-1.5 line-clamp-2 text-xs font-semibold leading-tight text-white">{a.name}</div>
            <div className="mt-0.5 text-[11px] text-zinc-400">{mostSaid ? "Most said" : (a.year ?? "")}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const COMPARE_ROWS = 4;

/** How your answers stacked up against everyone's today. Hidden until enough people have played. */
function HowYouCompare({ number }: { number: number }) {
  const [rows, setRows] = useState<LinkCompare[]>([]);
  const [showAll, setShowAll] = useState(false);
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
  // The 4 most interesting rows first (rare picks, then most popular, then early cards), kept in
  // chain order; the rest are a tap away.
  const interest = (r: LinkCompare, i: number) => (r.pct <= 10 ? 0 : !r.top ? 1 : 2) * 100 + i;
  const picked = new Set(
    rows
      .map((r, i) => ({ i, score: interest(r, i) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, COMPARE_ROWS)
      .map((r) => r.i),
  );
  const shown = showAll ? rows : rows.filter((_, i) => picked.has(i));

  return (
    <section className="px-4 py-3.5">
      <h3 className="mb-1.5 text-[10.5px] uppercase tracking-[0.16em] text-zinc-400">How you compare</h3>
      {rarest.pct <= 10 && (
        <p className="mb-2 rounded-xl bg-amber-400/15 px-3 py-2.5 text-sm text-amber-200 ring-1 ring-amber-400/50">
          🦄 Rare pick! Only <b className="text-white">{rarest.pct}%</b> said {rarest.answer.name} for{" "}
          {rarest.prompt.name}.
        </p>
      )}
      <ul className="space-y-2.5">
        {shown.map((r) => (
          <li key={`${r.prompt.kind}-${r.prompt.id}`} className="flex items-center gap-3">
            {/* Your answer's photo or poster, like the chain above. */}
            <div className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-md bg-zinc-800 ring-1 ring-white/10">
              {r.answer.image && <Image src={r.answer.image} alt="" fill sizes="40px" className="object-cover" />}
            </div>
            <div className="min-w-0">
            <div className="truncate text-[15px] text-zinc-300">
              {r.prompt.name} → <b className="text-white">{r.answer.name}</b>
            </div>
            <div className="mt-0.5 text-[13px] text-zinc-400">
              {r.top ? (
                `${r.pct}% said it too · most said ${r.top.name}`
              ) : (
                <>
                  <span className="font-semibold text-amber-400"><span className="mr-1">👑</span>Most popular answer</span> · {r.pct}% said it too
                </>
              )}
            </div>
            </div>
          </li>
        ))}
      </ul>
      {rows.length > COMPARE_ROWS && (
        <button
          onClick={() => {
            setShowAll(!showAll);
            if (!showAll) track("compare_show_all", { rows: rows.length });
          }}
          className="mt-2 min-h-9 text-[13px] font-semibold text-amber-400"
        >
          {showAll ? "Show less" : `Show all ${rows.length} ›`}
        </button>
      )}
    </section>
  );
}

/** "Day 2 of 7": the road to a claimed screen name, shown until a name can be claimed. */
function StreakGoal({ streak }: { streak: number }) {
  const [claimed, setClaimed] = useState(false);
  useEffect(() => {
    myName()
      .then((s) => setClaimed(!!s.name || s.eligible))
      .catch(() => {});
  }, []);
  if (claimed) return null;
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5">
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-zinc-300">
        🔥 <b className="font-semibold text-white">Day {streak} of {CLAIM_STREAK}</b> – choose your screen name at{" "}
        {CLAIM_STREAK}
      </p>
      <div className="flex shrink-0 gap-1" aria-hidden>
        {Array.from({ length: CLAIM_STREAK }, (_, i) => (
          <i key={i} className={`size-2 rounded-full ${i < streak ? "bg-amber-400" : "bg-white/15"}`} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-[26px] leading-tight tabular-nums">{value}</div>
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-zinc-400">{label}</div>
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

/** Where today's game ranks ("you beat 72%"); the finish is logged in the background, so retry briefly. */
function useTodayRank(number: number) {
  const [rank, setRank] = useState<{ others: number; percentBeat: number } | null>(null);
  useEffect(() => {
    let active = true;
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
  return rank;
}

/** "You beat 72% of players today", once enough people have finished to make it meaningful. */
function TodayRank({ rank }: { rank: { others: number; percentBeat: number } | null }) {
  if (!rank || rank.others < 3) return null;
  return (
    <div className="flex items-center gap-3.5 bg-gradient-to-r from-amber-400/10 to-transparent px-4 py-3.5">
      <span className="font-display text-[40px] leading-none text-amber-400">{rank.percentBeat}%</span>
      <span className="text-sm text-zinc-300">
        You beat <b className="font-semibold text-white">{rank.percentBeat}% of players</b> today
      </span>
    </div>
  );
}
