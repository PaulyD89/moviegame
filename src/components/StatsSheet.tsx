"use client";

import { Modal } from "./Modal";

import { useEffect, useRef, useState } from "react";
import { myGlobalRank } from "@/app/actions";
import type { GlobalRank } from "@/lib/rank";
import { LINKS_TO_WIN } from "@/lib/types";
import { currentStreak, loadChallengeStats, loadStats } from "./storage";

/** All of this device's stats: daily Movie Chain and challenges. */
export function StatsSheet({ todayNumber, todayLinks, onClose }: {
  todayNumber: number;
  /** Links made in today's finished game, to highlight its bar. */
  todayLinks?: number;
  onClose: () => void;
}) {
  // Only opened by a tap, so reading storage during the first render is safe.
  const [daily] = useState(loadStats);
  const [vs] = useState(loadChallengeStats);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [rank, setRank] = useState<GlobalRank | null | undefined>(undefined);

  useEffect(() => {
    myGlobalRank()
      .then(setRank)
      .catch(() => setRank(null));
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  const avg = daily.played ? ((daily.linksTotal ?? 0) / daily.played).toFixed(1) : "–";

  return (
    <Modal labelledBy="stats-title" onClose={onClose}>
      <h2 id="stats-title" className="text-center font-display text-3xl tracking-wide text-amber-400">
        YOUR STATS
      </h2>

      <GlobalRankCard rank={rank} />

      <h3 className="mt-5 text-xs uppercase tracking-widest text-zinc-300">Daily Movie Chain</h3>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        <Stat label="Played" value={daily.played} />
        <Stat label="Win %" value={pct(daily.won, daily.played)} />
        <Stat label="Streak" value={currentStreak(daily, todayNumber)} />
        <Stat label="Best" value={daily.maxStreak} />
      </div>
      <p className="mt-2 text-center text-sm text-zinc-300">
        Average chain: <b className="text-white">{avg}</b> links
      </p>
      <p className="mt-1 text-center text-sm text-zinc-300">
        🏁 Fastest perfect game:{" "}
        <b className="text-white">{daily.bestPerfectMs ? formatTime(daily.bestPerfectMs) : "none yet"}</b>
      </p>

      <LinksChart dist={daily.dist} highlight={todayLinks} />

      <h3 className="mt-6 text-xs uppercase tracking-widest text-zinc-300">Challenges</h3>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <Stat label="Played" value={vs.played} />
        <Stat label="Wins" value={vs.won} />
        <Stat label="Win %" value={pct(vs.won, vs.played)} />
      </div>

      <p className="mt-5 text-center text-xs text-zinc-400">
        Stats are saved on this device. Your global rank follows this phone&apos;s browser.
      </p>
      <button
        ref={closeRef}
        onClick={onClose}
        className="mt-4 min-h-12 w-full rounded-xl bg-amber-400 text-lg font-bold text-black outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.98]"
      >
        Close
      </button>
    </Modal>
  );
}

/** Where you stand among every Movie Horse player, by all-time points. */
function GlobalRankCard({ rank }: { rank: GlobalRank | null | undefined }) {
  const [showHow, setShowHow] = useState(false);
  return (
    <section className="mt-4 rounded-2xl border border-amber-400/50 p-4 text-center">
      <h3 className="text-xs uppercase tracking-widest text-amber-400">Rank</h3>
      {rank === undefined ? (
        <p className="mt-2 h-14 text-zinc-400">Loading…</p>
      ) : rank?.allTime.rank ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <RankTile
            label={new Date().toLocaleString("en-US", { month: "long", timeZone: "America/New_York" })}
            standing={rank.month}
          />
          <RankTile label="All time" standing={rank.allTime} />
        </div>
      ) : (
        <p className="mt-2 text-sm text-zinc-300">
          {rank === null ? "Couldn't load your rank right now." : "Finish a daily Movie Chain to get ranked."}
        </p>
      )}
      <button
        type="button"
        onClick={() => setShowHow(!showHow)}
        aria-expanded={showHow}
        className="mt-2 min-h-11 px-3 text-xs text-zinc-400 underline"
      >
        How points work
      </button>
      {showHow && (
        <div className="mt-1 text-left">
          <ul className="space-y-1 text-sm text-zinc-300">
            <li>🏆 Daily win: <b className="text-white">10 pts</b> + 2 for each letter you didn&apos;t get</li>
            <li>🎬 Daily finished without winning: <b className="text-white">2 pts</b></li>
            <li>⚡ Speed bonus: <b className="text-white">+1</b> for each link answered within 20 seconds</li>
          </ul>
          <p className="mt-2 text-xs text-zinc-400">
            Only the daily counts, since everyone plays the same puzzle once a day. Challenge wins show in
            your stats below. The monthly rank starts over on the 1st.
          </p>
        </div>
      )}
    </section>
  );
}

/** One rank: the place, then points. A month with no games yet shows a dash. */
function RankTile({ label, standing }: { label: string; standing: GlobalRank["month"] }) {
  return (
    <div className="rounded-xl bg-white/5 px-2 py-3">
      <div className="text-xs uppercase tracking-wider text-zinc-300">{label}</div>
      <div className="mt-1 font-display text-4xl tracking-wide text-white">
        {standing.rank ? `#${standing.rank.toLocaleString()}` : "–"}
      </div>
      <div className="text-xs text-zinc-300">
        <b className="text-white">{standing.points.toLocaleString()}</b> points
      </div>
    </div>
  );
}

function formatTime(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/5 py-2">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-zinc-300">{label}</div>
    </div>
  );
}

/** How many links each daily game reached (0–10), like Wordle's guess distribution. */
function LinksChart({ dist, highlight }: { dist?: number[]; highlight?: number }) {
  const counts = Array.from({ length: LINKS_TO_WIN + 1 }, (_, i) => dist?.[i] ?? 0);
  const max = Math.max(...counts);
  const [active, setActive] = useState<number | null>(null);
  if (max === 0) {
    return <p className="mt-4 text-center text-sm text-zinc-400">Finish a daily chain to see your chart.</p>;
  }
  const labelled = (i: number) => i === highlight || i === active || (counts[i] === max && highlight === undefined);

  return (
    <figure className="mt-4">
      <figcaption className="mb-2 text-xs text-zinc-300">Links made per game</figcaption>
      <div className="flex h-28 items-end gap-0.5" role="list" aria-label="Links made per daily game">
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
