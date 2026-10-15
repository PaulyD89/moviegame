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
    const onError = (e: ErrorEvent) => report(e.message);
    const onRejection = (e: PromiseRejectionEvent) =>
      report(e.reason instanceof Error ? e.reason.message : String(e.reason));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
