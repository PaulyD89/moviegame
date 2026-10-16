"use client";

import { useEffect, useState, useTransition } from "react";
import { claimMyName, myName } from "@/app/actions";
import { loadNickname, saveNickname } from "./challenge/nickname";

const REASONS: Record<string, string> = {
  taken: "Someone already claimed that name. Try another.",
  blocked: "That name isn't allowed. Try another.",
  invalid: "Use at least 2 letters or numbers.",
  "not-eligible": "Play 7 days in a row to earn a name.",
  slow: "Too many tries. Wait a minute and try again.",
};

/**
 * A 7-day streak earns a claimed name: unique across players and shown with a gold check in VS
 * games and on the share image. `compact` shows just the claimed name (for the stats sheet).
 */
export function ClaimName({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<{ name: string | null; eligible: boolean } | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    myName()
      .then((s) => {
        setState(s);
        setDraft(s.name ?? loadNickname() ?? "");
      })
      .catch(() => {});
  }, []);

  if (!state || (!state.name && !state.eligible)) return null;
  if (state.name) {
    return (
      <p className={`text-center ${compact ? "-mt-1 text-xs" : "text-sm"} text-zinc-300`}>
        Playing as <b className="text-white">{state.name}</b> <span className="text-amber-400">✓</span>
      </p>
    );
  }
  if (compact) return null;

  const claim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || isPending) return;
    startTransition(async () => {
      const result = await claimMyName(draft).catch(() => null);
      if (!result) return setError("Couldn't claim it. Try again.");
      if (!result.ok) return setError(REASONS[result.reason] ?? "Couldn't claim it. Try again.");
      saveNickname(result.name);
      setError(null);
      setState({ name: result.name, eligible: true });
    });
  };

  return (
    <form onSubmit={claim} className="w-full rounded-2xl border border-amber-400/60 bg-amber-400/10 p-4 text-center">
      <p className="font-display text-xl tracking-wide text-amber-400">🔥 7-DAY STREAK! CLAIM YOUR NAME</p>
      <p className="mt-1 text-sm text-zinc-300">
        It&apos;s yours alone: nobody else can use it, and it gets a gold ✓ in VS games and on your shared results.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          maxLength={20}
          autoComplete="nickname"
          placeholder="Your name"
          aria-label="Name to claim"
          className="min-w-0 flex-1 rounded-xl border border-amber-400/40 bg-black/40 px-3 py-2.5 outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={isPending || !draft.trim()}
          className="rounded-xl bg-amber-400 px-4 font-bold text-black disabled:opacity-50"
        >
          {isPending ? "…" : "Claim"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </form>
  );
}
