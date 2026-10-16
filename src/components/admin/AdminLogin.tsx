"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { login } from "@/app/admin/actions";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          if (await login(password)) router.refresh();
          else setError(true);
        });
      }}
      className="mx-auto mt-16 flex max-w-sm flex-col gap-3"
    >
      <h1 className="flex flex-col items-center gap-1">
        <Image
          src="/logo-480.webp"
          alt="Movie Horse"
          width={480}
          height={320}
          priority
          className="h-auto w-44 drop-shadow-[0_6px_24px_rgb(251_191_36/0.25)]"
        />
        <span className="text-xl font-light tracking-wide text-amber-400">Admin Dashboard</span>
      </h1>
      <input
        type="password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setError(false);
        }}
        placeholder="Password"
        autoComplete="current-password"
        className="rounded-xl border border-white/15 bg-black/40 px-4 py-3.5 text-lg text-white outline-none focus:border-amber-400"
      />
      <button
        disabled={isPending}
        className="min-h-12 rounded-xl bg-amber-400 text-lg font-bold text-black disabled:opacity-50"
      >
        {isPending ? "Checking…" : "Sign in"}
      </button>
      {error && <p className="text-center text-sm text-red-400">Wrong password.</p>}
    </form>
  );
}
