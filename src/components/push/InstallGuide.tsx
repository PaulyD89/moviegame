"use client";

/** iPhone only allows web notifications from the Home Screen app, so walk people through adding it. */
export function InstallGuide({ code, onClose }: { code?: string | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 animate-fade bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        className="relative w-full max-w-md animate-sheet rounded-t-3xl border-t border-amber-400/30 bg-gradient-to-b from-zinc-900 to-[#0b0908] px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <h2 id="install-title" className="text-center font-display text-3xl tracking-wide text-amber-400">
          GET NOTIFICATIONS
        </h2>
        <p className="mt-2 text-center text-white">
          On iPhone, notifications work once Movie Horse is on your Home Screen. It takes 10 seconds:
        </p>

        <ol className="mt-5 space-y-4 text-[15px] text-white">
          <Step n={1}>
            Tap the <b>Share</b> button <ShareIcon /> in Safari&apos;s toolbar.
          </Step>
          <Step n={2}>
            Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.
          </Step>
          <Step n={3}>
            Open <b>Movie Horse</b> from your Home Screen and tap <b>🔔</b> again.
          </Step>
          {code && (
            <Step n={4}>
              To play this game from the app, tap <b>VS</b> → <b>Join with code</b> and enter{" "}
              <b className="font-display tracking-[0.2em] text-amber-400">{code}</b>
            </Step>
          )}
        </ol>

        <button
          onClick={onClose}
          className="mt-6 min-h-12 w-full rounded-xl bg-amber-400 text-lg font-bold text-black outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.98]"
        >
          Got it
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

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="inline h-5 w-5 -translate-y-0.5 text-sky-400"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-label="Share"
    >
      <path d="M12 3v12M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" strokeLinecap="round" />
    </svg>
  );
}
