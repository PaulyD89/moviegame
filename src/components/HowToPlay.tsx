"use client";

import { Modal } from "./Modal";

import { useEffect, useRef } from "react";
import { FAST_MS, LINKS_TO_WIN, WORD } from "@/lib/types";

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
    <Modal labelledBy="how-to-play-title" onClose={close}>

      <h2
        id="how-to-play-title"
        className="text-center font-display text-3xl tracking-wide text-amber-400"
      >
        HOW TO PLAY
      </h2>

      <HowToPlayRules />

      <button
        ref={buttonRef}
        onClick={close}
        className="mt-5 min-h-12 w-full rounded-xl bg-amber-400 text-lg font-bold text-black outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.98]"
      >
        Roll film
      </button>
    </Modal>
  );
}

/** The rules, shared by the ? pop-up and the /how-to-play page (so they never drift apart). */
export function HowToPlayRules() {
  return (
    <>
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
          <b className="whitespace-nowrap text-red-400">M-O-V-I-E</b> and you&apos;re out. After a
          miss, skipping that card is free.
        </Step>
        <Step n={4}>
          <b className="text-amber-300">⚡ Speed bonus:</b> answer within {FAST_MS / 1000} seconds for an extra
          point. It&apos;s only a bonus. Run out of time and you just miss the point, never a letter.
        </Step>
      </ol>

      <div className="mt-5 rounded-2xl bg-white/5 p-4">
        <div className="text-[11px] uppercase tracking-widest text-zinc-300">Example chain</div>
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
          <span className="text-xs text-zinc-200">2 strikes. 3 to go.</span>
        </div>
      </div>

      <p className="mt-4 text-center text-sm leading-snug text-white">
        Every other day starts with an actor instead: name a movie they were in. Small typos are OK;
        we&apos;ll show you the right spelling. New chain every day.
      </p>
    </>
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
