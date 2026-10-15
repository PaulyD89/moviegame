"use client";

import { track } from "@vercel/analytics";
import { useEffect, useState } from "react";
import { setDailyReminder, status, subscribe, unsubscribe } from "@/app/push/actions";

export type PushState =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "ios-install" } // iPhone/iPad in Safari: push only works from the Home Screen app
  | { kind: "denied" }
  | { kind: "off" }
  | { kind: "on"; daily: boolean };

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

const asJSON = (sub: PushSubscription) =>
  sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };

async function detect(): Promise<PushState> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIOS() && !isStandalone()) return { kind: "ios-install" };
  if (!supported) return { kind: "unsupported" };
  if (Notification.permission === "denied") return { kind: "denied" };
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  const sub = await reg.pushManager.getSubscription();
  if (!sub || Notification.permission !== "granted") return { kind: "off" };
  const saved = await status(sub.endpoint);
  if (!saved) {
    // The browser has a subscription the server forgot; re-save it.
    await subscribe(asJSON(sub));
    return { kind: "on", daily: false };
  }
  return { kind: "on", daily: saved.daily };
}

export function usePush() {
  const [state, setState] = useState<PushState>({ kind: "loading" });

  useEffect(() => {
    detect()
      .then(setState)
      .catch(() => setState({ kind: "unsupported" }));
  }, []);

  /** Must be called from a tap: browsers only show the permission prompt for a user gesture. */
  async function turnOn(daily?: boolean) {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState({ kind: permission === "denied" ? "denied" : "off" });
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      }));
    await subscribe(asJSON(sub), daily);
    track("notifications_on", { daily: !!daily });
    setState((prev) => ({ kind: "on", daily: daily ?? (prev.kind === "on" && prev.daily) }));
    return true;
  }

  async function setDaily(daily: boolean) {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return turnOn(daily);
    await setDailyReminder(asJSON(sub), daily);
    setState({ kind: "on", daily });
    return true;
  }

  async function turnOff() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await unsubscribe(sub.endpoint);
      await sub.unsubscribe();
    }
    setState({ kind: "off" });
  }

  return { state, turnOn, setDaily, turnOff };
}
