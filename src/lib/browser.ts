/**
 * Which browser a visitor plays in, as a short label for the admin page and the results
 * screen. In-app browsers (Instagram, Reddit...) keep their own storage, apart from Safari or
 * Chrome, and can't get notifications. Runs in the browser.
 */
export const BROWSERS = [
  "Home Screen app",
  "Instagram app",
  "Facebook app",
  "TikTok app",
  "Snapchat app",
  "Reddit app",
  "Other app",
  "Safari",
  "Chrome",
  "Firefox",
  "Edge",
  "Samsung Internet",
  "Other",
] as const;
export type Browser = (typeof BROWSERS)[number];

export function browserKind(ua: string, standalone: boolean): Browser {
  const ios = /iPhone|iPad|iPod/.test(ua);
  if (standalone) return "Home Screen app";
  if (/Instagram/.test(ua)) return "Instagram app";
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(ua)) return "Facebook app";
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return "TikTok app";
  if (/Snapchat/.test(ua)) return "Snapchat app";
  if (/Reddit/i.test(ua)) return "Reddit app";
  // An app's own web view: on iPhone it drops the "Safari/" token, on Android it adds "; wv)".
  if ((ios && !/Safari\//.test(ua)) || (/Android/.test(ua) && /; wv\)/.test(ua))) return "Other app";
  if (/EdgA?\/|EdgiOS/.test(ua)) return "Edge";
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/CriOS|Chrome\//.test(ua)) return "Chrome";
  if (/FxiOS|Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}

/** This visitor's browser, from the page itself. */
export function currentBrowser(): Browser {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return browserKind(navigator.userAgent, standalone);
}
