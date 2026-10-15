"use client";

import { useEffect } from "react";

/**
 * A centered window over the game, inset from the screen edges. The page behind it can't
 * scroll; tap outside, or use the window's own button, to close it.
 */
export function Modal({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const html = document.documentElement;
    const previous = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      [html.style.overflow, document.body.style.overflow] = previous;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-none px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="absolute inset-0 animate-fade touch-none bg-black/75 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative max-h-full w-full max-w-md animate-modal overflow-y-auto overscroll-contain rounded-3xl border border-amber-400/40 bg-gradient-to-b from-zinc-900 to-[#0b0908] px-6 pt-5 pb-6 shadow-[0_20px_60px_rgb(0_0_0/0.6)]"
      >
        {children}
      </div>
    </div>
  );
}
