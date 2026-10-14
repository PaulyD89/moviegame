"use client";

import { useEffect, useRef } from "react";
import { LINKS_TO_WIN, WORD } from "@/lib/types";

const SEEN_KEY = "moviegame:seenHowTo";

export function hasSeenHowTo() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage unavailable; they'll just see it again next time.
  }
}

const EXAMPLE = ["Top Gun", "Tom Cruise", "Cocktail", "Elisabeth Shue", "…"];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  function close() {
    markSeen();
    onClose();
  }

  useEffect(() => {
    buttonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fade bg-black/70 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-to-play-title"
        className="relative w-full max-w-md animate-sheet rounded-t-3xl border-t border-amber-400/30 bg-gradient-to-b from-zinc-900 to-[#0b0908] px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_rgb(251_191_36/0.12)] sm:rounded-3xl sm:border"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" />

        <h2
          id="how-to-play-title"
          className="text-center font-display text-3xl tracking-wide text-amber-400"
        >
          HOW TO PLAY
        </h2>

        <ol className="mt-5 space-y-4 text-[15px] leading-snug text-zinc-200">
          <Step n={1}>
            We show you a <b className="text-white">movie</b>. Name an{" "}
            <b className="text-white">actor</b> who was in it.
          </Step>
          <Step n={2}>
            Get it right and we show you <b className="text-white">another movie</b> that actor
            was in. Keep the chain going for{" "}
            <b className="text-white">{LINKS_TO_WIN} links</b> to win.
          </Step>
          <Step n={3}>
            Wrong guess or pass? You get a letter. Spell{" "}
            <b className="whitespace-nowrap text-red-400">M-O-V-I-E</b> and you&apos;re out.
          </Step>
        </ol>

        <div className="mt-5 rounded-2xl bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-widest text-zinc-500">Example chain</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
            {EXAMPLE.map((name, i) => (
              <span key={name} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-amber-400/60">→</span>}
                <span
                  className={
                    i % 2 === 0 ? "font-semibold text-white" : "italic text-amber-300"
                  }
                >
                  {name}
                </span>
              </span>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-1">
              {WORD.split("").map((ch, i) => (
                <span
                  key={ch}
                  className={`flex h-7 w-7 items-center justify-center rounded font-display text-sm ${
                    i < 2 ? "bg-red-600 text-white" : "border border-white/15 text-white/20"
                  }`}
                >
                  {ch}
                </span>
              ))}
            </div>
            <span className="text-xs text-zinc-400">2 strikes. 3 to go.</span>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-500">
          Some days start with an actor instead: name a movie they were in. Small typos are OK;
          we&apos;ll show you the right spelling. New chain every day.
        </p>

        <button
          ref={buttonRef}
          onClick={close}
          className="mt-5 min-h-12 w-full rounded-xl bg-amber-400 text-lg font-bold text-black active:scale-[0.98]"
        >
          Roll film
        </button>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 font-display text-sm text-black">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="How to play"
      className="absolute top-0 right-0 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-lg font-semibold text-zinc-300 active:bg-white/10"
    >
      ?
    </button>
  );
}
