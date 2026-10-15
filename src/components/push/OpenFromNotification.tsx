"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const NOTE = "/__open";
const FRESH_MS = 2 * 60 * 1000;

/**
 * Tapping a notification should land you in that game. The service worker tries to navigate
 * the open app, and also leaves a note (and a message) that this picks up as a fallback.
 */
export function OpenFromNotification() {
  const router = useRouter();

  useEffect(() => {
    function go(url: string) {
      const target = new URL(url, location.origin);
      if (target.origin !== location.origin) return;
      if (target.pathname + target.search !== location.pathname + location.search) {
        router.push(target.pathname + target.search);
      }
    }

    async function checkNote() {
      if (document.hidden || !("caches" in window)) return;
      try {
        const notes = await caches.open("mh-open");
        const note = await notes.match(NOTE);
        if (!note) return;
        await notes.delete(NOTE);
        const { url, at } = (await note.json()) as { url: string; at: number };
        if (Date.now() - at < FRESH_MS) go(url);
      } catch {
        // No note, or storage unavailable.
      }
    }

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "open" && typeof e.data.url === "string") go(e.data.url);
    };

    checkNote();
    document.addEventListener("visibilitychange", checkNote);
    window.addEventListener("focus", checkNote);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      document.removeEventListener("visibilitychange", checkNote);
      window.removeEventListener("focus", checkNote);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [router]);

  return null;
}
