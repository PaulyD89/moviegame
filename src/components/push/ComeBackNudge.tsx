"use client";

import { track } from "@vercel/analytics";
import { useState } from "react";
import { currentBrowser } from "@/lib/browser";
import { trafficSource } from "@/lib/traffic-source";
import { ProgressModal } from "../progress/ProgressModal";
import { ReminderNudge } from "./ReminderNudge";

const KEY = "moviegame:comeBackNudge";
const INSTAGRAM = "https://www.instagram.com/moviehorsegame/";

/**
 * How a visitor can come back tomorrow, by where they're playing. In-app browsers can't get
 * notifications, so Instagram visitors are asked to follow us (the midnight post is the
 * reminder), and other in-app visitors to make a save code (their progress lives inside that
 * app). Everyone else gets the usual reminder row.
 */
function kind(): "instagram" | "app" | null {
  if (typeof window === "undefined") return null;
  const browser = currentBrowser();
  if (browser === "Instagram app") return "instagram";
  if (browser.endsWith(" app") && browser !== "Home Screen app") return "app";
  // Reddit's iPhone app opens links in a Safari view that looks like Safari but keeps its own storage.
  const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (iphone && browser === "Safari" && trafficSource(location.search, document.referrer).startsWith("Reddit")) {
    return "app";
  }
  return null;
}

function dismissed() {
  try {
    return localStorage.getItem(KEY) === "done";
  } catch {
    return false;
  }
}

export function ComeBackNudge() {
  const [where] = useState(kind);
  const [hidden, setHidden] = useState(dismissed);
  const [saving, setSaving] = useState(false);

  if (!where) return <ReminderNudge />;
  if (hidden && !saving) return null;

  const done = (action: string) => {
    try {
      localStorage.setItem(KEY, "done");
    } catch {}
    setHidden(true);
    track("come_back_nudge", { where, action });
  };

  return (
    <div className="-mt-2 flex w-full items-center gap-2 rounded-xl bg-white/5 py-1.5 pr-1.5 pl-4 ring-1 ring-white/10">
      {where === "instagram" ? (
        <>
          <span className="min-w-0 flex-1 text-sm text-zinc-200">
            📸 Tomorrow&apos;s chain posts at midnight. <b className="font-semibold text-white">Follow us</b> so you
            don&apos;t miss it
          </span>
          <a
            href={INSTAGRAM}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => done("follow")}
            className="flex min-h-11 shrink-0 items-center rounded-lg bg-amber-400 px-3 text-sm font-bold text-black active:scale-[0.98]"
          >
            Follow
          </a>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 text-sm text-zinc-200">
            🔒 Playing inside an app? <b className="font-semibold text-white">Save your streak</b> so it follows you
            to Safari
          </span>
          <button
            onClick={() => {
              setSaving(true);
              done("save");
            }}
            className="min-h-11 shrink-0 rounded-lg bg-amber-400 px-3 text-sm font-bold text-black active:scale-[0.98]"
          >
            Save
          </button>
        </>
      )}
      <button
        onClick={() => done("dismiss")}
        aria-label="No thanks"
        className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 active:bg-white/10"
      >
        ✕
      </button>
      {saving && <ProgressModal onClose={() => setSaving(false)} />}
    </div>
  );
}
