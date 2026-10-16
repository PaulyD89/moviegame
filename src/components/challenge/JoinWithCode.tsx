"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { lookupCode } from "@/app/challenge/actions";

export function JoinWithCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length < 5) return setError("Codes are 5 letters and numbers.");
        startTransition(async () => {
          const { id, slow } = await lookupCode(code);
          if (id) router.push(`/c/${id}`);
          else setError(slow ? "Too many tries. Wait a minute and try again." : "No game with that code.");
        });
      }}
      className="flex w-full flex-col gap-2"
    >
      <label htmlFor="code" className="text-sm uppercase tracking-wider text-zinc-300">
        Join with code
      </label>
      <div className="flex gap-2">
        <input
          id="code"
          value={code}
          onChange={(e) => {
            setError(null);
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5));
          }}
          placeholder="CODE"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="go"
          className="min-w-0 flex-1 rounded-xl border border-amber-400/40 bg-black/40 px-4 py-3.5 text-center font-display text-2xl tracking-[0.3em] outline-none placeholder:text-zinc-700 focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={isPending}
          className="min-h-12 rounded-xl border border-amber-400 px-5 font-bold text-amber-400 active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? "…" : "Join"}
        </button>
      </div>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </form>
  );
}
