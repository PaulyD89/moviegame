"use client";

import Image from "next/image";
import { Modal } from "./Modal";
import { ProgressLink } from "./progress/ProgressLink";

import { useEffect, useRef, useState } from "react";
import { myBadgeFacts, myGlobalRank } from "@/app/actions";
import { BADGES, type BadgeFacts, type BadgeId } from "@/lib/badges";
import type { GlobalRank } from "@/lib/rank";
import { LINKS_TO_WIN } from "@/lib/types";
import { currentStreak, loadChallengeStats, saveBadges, type ChallengeStats, type Stats } from "./storage";
import { useSyncedStats } from "./useStats";
import { ClaimName } from "./ClaimName";

/** All of this device's stats: daily Movie Chain and challenges. */
export function StatsSheet({ todayNumber, todayLinks, onClose }: {
  todayNumber: number;
  /** Links made in today's finished game, to highlight its bar. */
  todayLinks?: number;
  onClose: () => void;
}) {
  // Only opened by a tap, so reading storage during the first render is safe.
  const daily = useSyncedStats();
  const [vs] = useState(loadChallengeStats);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [rank, setRank] = useState<GlobalRank | null | undefined>(undefined);
  const [facts, setFacts] = useState<BadgeFacts | null>(null);

  useEffect(() => {
    myGlobalRank()
      .then(setRank)
      .catch(() => setRank(null));
    myBadgeFacts()
      .then(setFacts)
      .catch(() => {});
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  const avg = daily.played ? ((daily.linksTotal ?? 0) / daily.played).toFixed(1) : "–";
  // The server has every win's time; a perfect game on this phone is a win too.
  const fastestWin = Math.min(facts?.fastestWinMs ?? Infinity, daily.bestPerfectMs ?? Infinity);
  const fastestWinOk = Number.isFinite(fastestWin);

  return (
    <Modal labelledBy="stats-title" onClose={onClose} tight>
      <h2 id="stats-title" className="flex justify-center">
        <Image
          src="/stats-header-v2-640.webp"
          alt="Your stats"
          width={640}
          height={320}
          priority
          className="h-auto w-36 drop-shadow-[0_6px_24px_rgb(251_191_36/0.25)]"
        />
      </h2>
      <button
        ref={closeRef}
        onClick={onClose}
        aria-label="Close"
        className="absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-full text-xl text-zinc-400 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 active:bg-white/10"
      >
        ✕
      </button>

      <BadgeRow earned={earnedBadges(daily, vs, facts, rank)} />

      <ClaimName compact />
      <GlobalRankCard rank={rank} />

      <h3 className="mt-2 flex justify-center">
        <Image
          src="/daily-chain-header-600.webp"
          alt="Daily Movie Chain"
          width={600}
          height={200}
          className="h-auto w-36"
        />
      </h3>
      <div className="mt-1 grid grid-cols-4 gap-1.5 text-center">
        <Stat label="Played" value={daily.played} />
        <Stat label="Win %" value={pct(daily.won, daily.played)} />
        <StreakStat value={currentStreak(daily, todayNumber)} />
        <Stat label="Best" value={daily.maxStreak} />
      </div>
      <p className="mt-1 text-center text-xs text-zinc-300">
        Average chain <b className="text-white">{avg}</b> links · ⏱ Fastest win{" "}
        <b className="text-white">{fastestWinOk ? formatTime(fastestWin) : "–"}</b>
      </p>

      <LinksChart dist={daily.dist} highlight={todayLinks} />

      <h3 className="mt-2 flex justify-center">
        <Image
          src="/vs-games-header-600.webp"
          alt="VS Games"
          width={600}
          height={200}
          className="h-auto w-36"
        />
      </h3>
      <div className="mt-1 grid grid-cols-3 gap-1.5 text-center">
        <Stat label="Played" value={vs.played} />
        <Stat label="Wins" value={vs.won} />
        <Stat label="Win %" value={pct(vs.won, vs.played)} />
      </div>

      <p className="mt-1 text-center text-xs text-zinc-400">
        Stats are saved in this browser.{" "}
        <ProgressLink className="inline-flex min-h-9 items-center font-semibold text-amber-400 underline underline-offset-2">
          📲 Save or restore
        </ProgressLink>
      </p>
    </Modal>
  );
}

/** Badges earned on this phone, from the server, or saved earlier; newly earned ones are saved. */
function earnedBadges(
  daily: Stats,
  vs: ChallengeStats,
  facts: BadgeFacts | null,
  rank: GlobalRank | null | undefined,
): Set<BadgeId> {
  const now: Record<BadgeId, boolean> = {
    "opening-night": daily.won > 0 || !!facts?.won,
    "one-take": !!daily.bestPerfectMs || !!facts?.perfect,
    franchise: daily.maxStreak >= 7,
    "lightning-round": !!facts?.lightning,
    "top-billing": !!rank?.month.rank && rank.month.rank <= 10,
    showdown: vs.won > 0,
  };
  const earned = new Set([...(daily.badges ?? []), ...BADGES.filter((b) => now[b.id]).map((b) => b.id)]);
  return earned as Set<BadgeId>;
}

/** A shelf of six badges, gold once earned. Tap one to see how it's earned. */
function BadgeRow({ earned }: { earned: Set<BadgeId> }) {
  const [open, setOpen] = useState<BadgeId | null>(null);
  const key = [...earned].sort().join();
  useEffect(() => {
    if (key) saveBadges(key.split(","));
  }, [key]);
  // Keep the last badge's text while the panel slides shut.
  const [shown, setShown] = useState<BadgeId | null>(null);
  if (open && open !== shown) setShown(open);
  const badge = BADGES.find((b) => b.id === shown);

  return (
    <section aria-label="Badges" className="mt-1">
      <ul className="flex justify-center gap-1.5">
        {BADGES.map((b) => {
          const got = earned.has(b.id);
          return (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setOpen(open === b.id ? null : b.id)}
                aria-label={`${b.name}${got ? ", earned" : ", not earned yet"}`}
                aria-expanded={open === b.id}
                className={`block rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-95 ${
                  open === b.id ? "scale-110" : ""
                }`}
              >
                <Image
                  src={`/badges/${b.id}${got ? "" : "-locked"}.webp`}
                  alt=""
                  width={256}
                  height={256}
                  className={`h-11 w-11 ${got ? "drop-shadow-[0_0_8px_rgb(251_191_36/0.45)]" : "opacity-60"}`}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
        aria-live="polite"
      >
        <div className="overflow-hidden">
          {badge && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Image
                src={`/badges/${badge.id}${earned.has(badge.id) ? "" : "-locked"}.webp`}
                alt=""
                width={256}
                height={256}
                className={`h-20 w-20 shrink-0 ${earned.has(badge.id) ? "drop-shadow-[0_0_14px_rgb(251_191_36/0.5)]" : ""}`}
              />
              <div className="min-w-0 text-left">
                <div className={`font-semibold ${earned.has(badge.id) ? "text-amber-400" : "text-white"}`}>
                  {badge.name}
                  {earned.has(badge.id) && " ✓"}
                </div>
                <div className="text-xs text-zinc-300">{badge.how}</div>
                <div className="text-[11px] text-zinc-400">{earned.has(badge.id) ? "Earned" : "Not earned yet"}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Where you stand among every Movie Horse player, by all-time points. */
function GlobalRankCard({ rank }: { rank: GlobalRank | null | undefined }) {
  const [showHow, setShowHow] = useState(false);
  return (
    <section className="mt-2 rounded-2xl border border-amber-400/50 px-3 pt-1 pb-2 text-center">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-widest text-amber-400">Global rank</h3>
        <button
          type="button"
          onClick={() => setShowHow(!showHow)}
          aria-expanded={showHow}
          className="-mr-2 min-h-9 px-2 text-[11px] text-zinc-400 underline"
        >
          How points work
        </button>
      </div>
      {rank === undefined ? (
        <p className="h-16 text-sm text-zinc-400">Loading…</p>
      ) : rank?.allTime.rank ? (
        <div className="grid grid-cols-2 gap-1.5">
          <RankTile
            label={new Date().toLocaleString("en-US", { month: "long", timeZone: "America/New_York" })}
            standing={rank.month}
          />
          <RankTile label="All time" standing={rank.allTime} />
        </div>
      ) : (
        <p className="text-sm text-zinc-300">
          {rank === null ? "Couldn't load your rank right now." : "Finish a daily Movie Chain to get ranked."}
        </p>
      )}
      {/* Slides open: animating grid rows from 0fr to 1fr lets the height follow the content. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
          showHow ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
        aria-hidden={!showHow}
        inert={!showHow}
      >
        <div className="overflow-hidden">
          <div className="pt-2 text-left">
            <ul className="space-y-1 text-sm text-zinc-300">
              <li>🏆 Win: <b className="text-white">10 pts</b> + 2 per letter left</li>
              <li>🎬 Finished, no win: <b className="text-white">2 pts</b></li>
              <li>⚡ Speed: <b className="text-white">+1</b> per link under 20s</li>
            </ul>
            <p className="mt-1.5 text-xs text-zinc-400">Daily games only. Month resets on the 1st.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** One rank: the place, then points. A month with no games yet shows a dash. */
function RankTile({ label, standing }: { label: string; standing: GlobalRank["month"] }) {
  return (
    <div className="rounded-xl bg-white/5 px-2 py-1">
      <div className="text-[11px] uppercase tracking-wider text-zinc-300">{label}</div>
      <div className="flex items-baseline justify-center gap-2">
        <span className="font-display text-2xl tracking-wide text-white">
          {standing.rank ? `#${standing.rank.toLocaleString()}` : "–"}
        </span>
        <span className="text-xs text-zinc-300">
          <b className="text-white">{standing.points.toLocaleString()}</b> pts
        </span>
      </div>
    </div>
  );
}

function formatTime(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The streak tile, wrapped in flames while a streak is alive. */
function StreakStat({ value }: { value: number }) {
  return (
    <div className="relative rounded-lg bg-white/5 py-1">
      {value > 0 && (
        <Image
          src="/streak-flames.webp"
          alt=""
          width={320}
          height={170}
          className="pointer-events-none absolute -inset-x-2 -bottom-1.5 h-[calc(100%+0.5rem)] w-[calc(100%+1rem)] max-w-none object-fill opacity-60"
        />
      )}
      <div className="relative text-xl leading-tight font-bold text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.8)]">
        {value}
      </div>
      <div className="relative text-[11px] text-zinc-100 drop-shadow-[0_1px_2px_rgb(0_0_0/0.8)]">Streak</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/5 py-1">
      <div className="text-xl leading-tight font-bold text-white">{value}</div>
      <div className="text-[11px] text-zinc-300">{label}</div>
    </div>
  );
}

/** How many links each daily game reached (0–10), like Wordle's guess distribution. */
function LinksChart({ dist, highlight }: { dist?: number[]; highlight?: number }) {
  const counts = Array.from({ length: LINKS_TO_WIN + 1 }, (_, i) => dist?.[i] ?? 0);
  const max = Math.max(...counts);
  const [active, setActive] = useState<number | null>(null);
  if (max === 0) {
    return <p className="mt-2 text-center text-xs text-zinc-400">Finish a daily chain to see your chart.</p>;
  }
  const labelled = (i: number) => i === highlight || i === active || (counts[i] === max && highlight === undefined);

  return (
    <figure className="mt-2">
      <div className="flex h-12 items-end gap-0.5" role="list" aria-label="Links made per daily game">
        {counts.map((n, i) => (
          <button
            key={i}
            type="button"
            role="listitem"
            aria-label={`${n} ${n === 1 ? "game" : "games"} with ${i} links`}
            onClick={() => setActive(active === i ? null : i)}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className="relative flex h-full flex-1 flex-col items-center justify-end outline-none"
          >
            {labelled(i) && n > 0 && <span className="mb-0.5 text-[11px] font-semibold text-white">{n}</span>}
            <span
              className={`w-full max-w-5 rounded-t ${i === highlight ? "bg-amber-400" : "bg-amber-400/45"} ${
                active === i ? "ring-1 ring-white" : ""
              }`}
              style={{ height: n ? `${Math.max(6, (n / max) * 80)}%` : "2px" }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 border-t border-white/15 pt-1">
        {counts.map((_, i) => (
          <span key={i} className={`flex-1 text-center text-[11px] ${i === highlight ? "font-bold text-white" : "text-zinc-400"}`}>
            {i}
          </span>
        ))}
      </div>
      <figcaption className="text-center text-[10px] text-zinc-400">Links made per game</figcaption>
    </figure>
  );
}

export function StatsButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label="Your stats"
      className={`absolute top-0 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-zinc-300 active:bg-white/10 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        <rect x="4" y="12" width="4" height="8" rx="1" />
        <rect x="10" y="6" width="4" height="14" rx="1" />
        <rect x="16" y="9" width="4" height="11" rx="1" />
      </svg>
    </button>
  );
}
