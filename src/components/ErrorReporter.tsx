"use client";

import { useEffect } from "react";
import { reportPhoneError } from "@/app/errors/actions";

/** Crashes on players' phones get sent to the admin page's error log (a few per visit at most). */
export function ErrorReporter() {
  useEffect(() => {
    let sent = 0;
    const report = (message: string) => {
      if (sent >= 3 || !message) return;
      sent++;
      reportPhoneError(message, location.pathname).catch(() => {});
    };
    // Browsers hide the details of errors from other sites' scripts ("Script error."), so note
    // where it came from and which browser, which usually points at an extension or in-app browser.
    const browser = () => {
      const ua = navigator.userAgent;
      const app = /Instagram|FBAN|FBAV|TikTok|Snapchat|Twitter|LinkedIn|GSA\//.exec(ua)?.[0];
      const name = app ?? (/CriOS|Chrome/.test(ua) ? "Chrome" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "browser");
      const device = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : "other";
      const homeScreen = window.matchMedia("(display-mode: standalone)").matches ? ", Home Screen app" : "";
      return `${name} on ${device}${homeScreen}`;
    };
    const onError = (e: ErrorEvent) => {
      // Skip errors from other companies' code: in-app browsers (Instagram, Facebook) and
      // extensions inject scripts that throw when the user closes them. Ours come from the site's
      // /_next/ script files; an injected script reports the page itself as its source.
      const ours = !e.filename || e.filename.startsWith(`${location.origin}/_next/`);
      const appBridge = /webkit\.messageHandlers|Java object is gone|iabjs:/i.test(`${e.message} ${e.filename}`);
      if (!ours || appBridge || (e.message === "Script error." && !e.filename)) return;
      const where = e.filename ? ` @ ${e.filename.replace(location.origin, "")}:${e.lineno}:${e.colno}` : "";
      report(`${e.message}${where} [${browser()}]`);
    };
    const onRejection = (e: PromiseRejectionEvent) =>
      report(`${e.reason instanceof Error ? e.reason.message : String(e.reason)} [${browser()}]`);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
