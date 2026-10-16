"use client";

import { useEffect, useState } from "react";
import { FAST_MS } from "@/lib/types";

/**
 * A quiet countdown for the daily's speed bonus: answer while the bolt is lit for +1 point.
 * It never costs a letter, so it stays small and calm.
 */
export function SpeedClock({ shownAt, fastSoFar }: { shownAt?: number; fastSoFar: number }) {
  const left = useSpeedLeft(shownAt);
  const lit = left > 0;
  return (
    <div className="flex w-full items-center gap-2 text-xs" aria-live="off">
      <span className={lit ? "text-amber-400" : "text-zinc-500"} aria-hidden>
        ⚡
      </span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-amber-400/70 transition-[width] duration-300 ease-linear"
          style={{ width: `${(left / FAST_MS) * 100}%` }}
        />
      </div>
      <span className={`w-28 text-right ${lit ? "text-amber-300" : "text-zinc-400"}`}>
        {lit ? `Speed bonus ${Math.ceil(left / 1000)}s` : `⚡ ${fastSoFar} fast so far`}
      </span>
    </div>
  );
}

/**
 * The same countdown drawn inside the guess box while typing, since the keyboard scrolls the
 * bar above off screen: a gold line along the bottom edge and the seconds left at the right.
 * Gone once the bonus runs out. Place inside a relative wrapper around the input.
 */
export function InBoxClock({ shownAt }: { shownAt?: number }) {
  const left = useSpeedLeft(shownAt);
  if (left <= 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
      <span className="absolute top-1/2 right-4 -translate-y-1/2 text-sm tabular-nums text-amber-300">
        ⚡{Math.ceil(left / 1000)}s
      </span>
      <div
        className="absolute bottom-0 left-0 h-[3px] rounded-r-full bg-amber-400 transition-[width] duration-300 ease-linear"
        style={{ width: `${(left / FAST_MS) * 100}%` }}
      />
    </div>
  );
}

/** Milliseconds of speed bonus left on the current card, ticking four times a second. */
function useSpeedLeft(shownAt?: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!shownAt) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() - shownAt > FAST_MS) clearInterval(t);
    }, 250);
    return () => clearInterval(t);
  }, [shownAt]);

  return shownAt ? Math.max(0, FAST_MS - (now - shownAt)) : 0;
}
