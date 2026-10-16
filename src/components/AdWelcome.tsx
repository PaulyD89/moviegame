"use client";

import Image from "next/image";
import { track } from "@vercel/analytics";
import { useEffect, useRef, useState } from "react";
import type { CardKind } from "@/lib/types";
import { Modal } from "./Modal";
import { loadStats } from "./storage";

const SEEN_KEY = "moviegame:adWelcome";

/** Came from a paid ad (Instagram/Facebook tag their links). */
export function fromAd() {
  const q = new URLSearchParams(location.search);
  return q.get("utm_medium") === "paid" || q.has("fbclid") || /^(ig|fb|instagram|facebook)$/i.test(q.get("utm_source") ?? "");
}

/**
 * A short welcome for first-time visitors arriving from an ad, who land cold. Shown once per
 * device, before the first move; regulars, Home Screen players and friends' links never see it.
 */
export function AdWelcome({ kind, fresh }: { kind: CardKind; fresh: boolean }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem(SEEN_KEY);
    } catch {}
    if (!fresh || seen || loadStats().played > 0 || !fromAd()) return;
    // Shown from the browser only, after the game has loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
    track("ad_welcome_shown");
  }, [fresh]);

  useEffect(() => {
    if (open) buttonRef.current?.focus();
  }, [open]);

  if (!open) return null;
  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setOpen(false);
  };
  return (
    <Modal labelledBy="ad-welcome" onClose={close}>
      <h2 id="ad-welcome" className="flex justify-center">
        <Image
          src="/logo-480.webp"
          alt="Welcome to Movie Horse"
          width={480}
          height={320}
          priority
          className="h-auto w-52 drop-shadow-[0_4px_16px_rgb(251_191_36/0.3)]"
        />
      </h2>
      <ul className="mt-4 space-y-3 text-[15px] leading-snug text-zinc-200">
        <li className="flex gap-3">
          <span className="w-6 shrink-0 text-center">🎬</span>
          <span>
            {kind === "movie" ? (
              <>
                We show you a movie. <b className="text-white">Name an actor in it.</b>
              </>
            ) : (
              <>
                We show you an actor. <b className="text-white">Name a movie they were in.</b>
              </>
            )}
          </span>
        </li>
        <li className="flex gap-3">
          <span className="w-6 shrink-0 text-center">🔗</span>
          <span>
            Then {kind === "movie" ? "a movie with that actor" : "an actor in that movie"}, and so on.{" "}
            <b className="text-white">10 links</b> wins.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="w-6 shrink-0 text-center">❌</span>
          <span>
            Miss or pass = a letter. Spell <b className="whitespace-nowrap text-red-400">M-O-V-I-E</b> and
            you&apos;re out.
          </span>
        </li>
      </ul>
      <button
        ref={buttonRef}
        onClick={close}
        className="mt-5 min-h-12 w-full rounded-xl bg-amber-400 text-lg font-bold text-black outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.98]"
      >
        Let&apos;s play
      </button>
      <p className="mt-2 text-center text-xs text-zinc-400">A new chain every day · free, no sign-up</p>
    </Modal>
  );
}
