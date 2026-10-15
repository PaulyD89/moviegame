"use client";

import { track } from "@vercel/analytics";
import { useState, useTransition } from "react";
import { InstallGuide } from "./InstallGuide";
import { usePush } from "./usePush";

const KEY = "moviegame:reminderNudge";

/** The player turned the reminder on from the nudge, or tapped ✕. */
export function dismissedBefore() {
  try {
    return localStorage.getItem(KEY) === "done";
  } catch {
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(KEY, "done");
  } catch {}
}

/**
 * One slim row after a finished daily, offering the midnight reminder. Shown until the player
 * turns it on or taps ✕, and never to people who already have it.
 */
export function ReminderNudge() {
  const { state, turnOn, setDaily } = usePush();
  const [hidden, setHidden] = useState(dismissedBefore);
  const [done, setDone] = useState(false);
  const [guide, setGuide] = useState(false);
  const [isPending, startTransition] = useTransition();

  const offer = state.kind === "off" || state.kind === "ios-install" || (state.kind === "on" && !state.daily);
  if (hidden || (!offer && !done)) return null;

  if (done) {
    return <p className="-mt-2 text-center text-sm text-emerald-400">🔔 Done. We&apos;ll ping you when the next chain drops.</p>;
  }

  function enable() {
    if (state.kind === "ios-install") return setGuide(true);
    startTransition(async () => {
      const ok = await (state.kind === "on" ? setDaily(true) : turnOn(true)).catch(() => false);
      track("reminder_nudge", { ok: !!ok });
      if (ok) {
        remember();
        setDone(true);
      }
    });
  }

  return (
    <div className="-mt-2 flex w-full items-center gap-2 rounded-xl bg-white/5 py-1.5 pr-1.5 pl-4 ring-1 ring-white/10">
      <span className="min-w-0 flex-1 text-sm text-zinc-200">🔔 Get tomorrow&apos;s chain the moment it drops</span>
      <button
        onClick={enable}
        disabled={isPending}
        className="min-h-11 shrink-0 rounded-lg bg-amber-400 px-3 text-sm font-bold text-black active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? "…" : "Turn on"}
      </button>
      <button
        onClick={() => {
          remember();
          setHidden(true);
          track("reminder_nudge_dismissed");
        }}
        aria-label="No thanks"
        className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 active:bg-white/10"
      >
        ✕
      </button>
      {guide && <InstallGuide onClose={() => setGuide(false)} />}
    </div>
  );
}
