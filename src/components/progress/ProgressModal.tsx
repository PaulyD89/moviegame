"use client";

import { track } from "@vercel/analytics";
import { useEffect, useState, useTransition } from "react";
import { getSaveCode, restore } from "@/app/progress/actions";
import { Modal } from "../Modal";
import { applySnapshot, markSaved, takeSnapshot } from "./snapshot";

type Tab = "save" | "restore";

/** Save code for this phone's progress, or restore progress from a code. */
export function ProgressModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("save");
  return (
    <Modal labelledBy="progress-title" onClose={onClose}>
      <h2 id="progress-title" className="text-center font-display text-3xl tracking-wide text-amber-400">
        YOUR PROGRESS
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1" role="tablist">
        {(["save", "restore"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 rounded-lg text-sm font-semibold ${
              tab === t ? "bg-amber-400 text-black" : "text-zinc-300 active:bg-white/10"
            }`}
          >
            {t === "save" ? "Save" : "Restore"}
          </button>
        ))}
      </div>
      {tab === "save" ? <SaveTab /> : <RestoreTab />}
      <button
        onClick={onClose}
        className="mt-5 min-h-12 w-full rounded-xl border border-white/20 text-lg font-semibold text-white active:scale-[0.98]"
      >
        Close
      </button>
    </Modal>
  );
}

function SaveTab() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getSaveCode(takeSnapshot())
      .then((c) => {
        setCode(c);
        markSaved();
        track("progress_code_shown");
      })
      .catch(() => setError(true));
  }, []);

  async function share() {
    if (!code) return;
    const text = `My Movie Horse save code: ${code}`;
    try {
      if (navigator.share) return await navigator.share({ text });
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed.
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="mt-4 text-center">
      <p className="text-sm text-zinc-300">
        Your save code brings back your rank, points, streaks, stats and games on any phone or browser.
      </p>
      <div className="mt-4 rounded-2xl border border-amber-400/50 px-3 py-4">
        {error ? (
          <p className="text-sm text-red-300">Couldn&apos;t get your code. Check your connection and try again.</p>
        ) : (
          <div className="font-display text-3xl tracking-[0.15em] text-white" aria-live="polite">
            {code ?? "…"}
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={copy}
          disabled={!code}
          className="min-h-12 rounded-xl border border-amber-400 font-bold text-amber-400 active:scale-[0.98] disabled:opacity-40"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          onClick={share}
          disabled={!code}
          className="min-h-12 rounded-xl bg-amber-400 font-bold text-black active:scale-[0.98] disabled:opacity-40"
        >
          Share
        </button>
      </div>
      <p className="mt-3 text-xs text-zinc-400">
        Screenshot it or text it to yourself. Your code never changes, and it stays up to date as you play.
      </p>
    </div>
  );
}

function RestoreTab() {
  const [input, setInput] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function doRestore() {
    startTransition(async () => {
      const result = await restore(input);
      if (!result.ok) {
        setConfirming(false);
        setError(
          result.reason === "format"
            ? "Codes are 12 letters and numbers, like 7K2M-PX4Q-H8RT."
            : result.reason === "slow"
              ? "Too many tries. Wait a while and try again."
              : "We couldn't find that code. Check it and try again.",
        );
        return;
      }
      applySnapshot(result.snapshot);
      track("progress_restored");
      // A full reload, so every screen re-reads the restored stats and the new player cookie.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    });
  }

  return (
    <div className="mt-4">
      <p className="text-center text-sm text-zinc-300">
        Enter the save code from your other phone or browser.
      </p>
      <input
        value={input}
        onChange={(e) => {
          setError(null);
          setConfirming(false);
          setInput(e.target.value.toUpperCase().slice(0, 16));
        }}
        placeholder="XXXX-XXXX-XXXX"
        aria-label="Save code"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        className="mt-3 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3.5 text-center font-display text-2xl tracking-[0.15em] outline-none placeholder:text-zinc-700 focus:border-amber-400"
      />
      {confirming ? (
        <div className="mt-3 rounded-xl bg-amber-400/10 p-3 text-center ring-1 ring-amber-400/50">
          <p className="text-sm text-amber-100">
            This replaces the stats on this phone with your saved progress. Games already played here
            are added to it.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="min-h-12 rounded-xl border border-white/20 font-semibold text-white"
            >
              Cancel
            </button>
            <button
              onClick={doRestore}
              disabled={isPending}
              className="min-h-12 rounded-xl bg-amber-400 font-bold text-black disabled:opacity-50"
            >
              {isPending ? "Restoring…" : "Yes, restore"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => (input.replace(/[^A-Za-z0-9]/g, "").length === 12 ? setConfirming(true) : setError("Codes are 12 letters and numbers, like 7K2M-PX4Q-H8RT."))}
          className="mt-3 min-h-12 w-full rounded-xl bg-amber-400 text-lg font-bold text-black active:scale-[0.98]"
        >
          Restore
        </button>
      )}
      {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
