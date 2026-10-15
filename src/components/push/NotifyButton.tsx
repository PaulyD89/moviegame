"use client";

import { useState, useTransition } from "react";
import { InstallGuide } from "./InstallGuide";
import { usePush } from "./usePush";

const base =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-4 text-base font-semibold active:scale-[0.98] disabled:opacity-50";

/**
 * "Notify me" for a challenge (your turn, game over) or for the nightly Movie Chain reminder.
 * On iPhone in Safari it explains how to add the app to the Home Screen first.
 */
export function NotifyButton({ mode, code }: { mode: "challenge" | "daily"; code?: string | null }) {
  const { state, turnOn, setDaily } = usePush();
  const [guide, setGuide] = useState(false);
  const [isPending, startTransition] = useTransition();
  const run = (fn: () => Promise<unknown>) => startTransition(async () => void (await fn().catch(() => {})));

  const label =
    mode === "challenge" ? "🔔 Notify me when it's my turn" : "🔔 Remind me when the next Movie Chain is up";

  if (state.kind === "loading" || state.kind === "unsupported") return null;

  if (state.kind === "denied") {
    return (
      <p className="text-center text-sm text-zinc-300">
        🔕 Notifications are blocked for Movie Horse. Turn them on in your phone&apos;s Settings.
      </p>
    );
  }

  if (state.kind === "ios-install") {
    return (
      <>
        <button onClick={() => setGuide(true)} className={`${base} border-white/20 text-white`}>
          {label}
        </button>
        {guide && <InstallGuide code={mode === "challenge" ? code : null} onClose={() => setGuide(false)} />}
      </>
    );
  }

  if (mode === "challenge" && state.kind === "on") {
    return <p className="text-center text-sm text-emerald-400">🔔 Notifications on. We&apos;ll ping you on your turn.</p>;
  }

  if (mode === "daily" && state.kind === "on" && state.daily) {
    return (
      <p className="text-center text-sm text-emerald-400">
        🔔 Nightly reminder on (9pm PT).{" "}
        <button onClick={() => run(() => setDaily(false))} className="text-zinc-300 underline" disabled={isPending}>
          Turn off
        </button>
      </p>
    );
  }

  return (
    <button
      disabled={isPending}
      onClick={() => run(() => (mode === "daily" ? (state.kind === "on" ? setDaily(true) : turnOn(true)) : turnOn()))}
      className={`${base} border-white/20 text-white`}
    >
      {isPending ? "Turning on…" : label}
    </button>
  );
}
