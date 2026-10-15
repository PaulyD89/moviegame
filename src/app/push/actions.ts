"use server";

import { playerId } from "@/lib/player";
import {
  removeSubscription,
  saveSubscription,
  subscriptionStatus,
  type BrowserSubscription,
} from "@/lib/push";

function valid(sub: BrowserSubscription) {
  return (
    typeof sub?.endpoint === "string" &&
    sub.endpoint.startsWith("https://") &&
    sub.endpoint.length < 1000 &&
    typeof sub.keys?.p256dh === "string" &&
    typeof sub.keys?.auth === "string"
  );
}

/** Turn notifications on for this device. `daily` also opts in to the nightly Movie Chain reminder. */
export async function subscribe(sub: BrowserSubscription, daily?: boolean) {
  if (!valid(sub)) throw new Error("Bad subscription");
  await saveSubscription(sub, await playerId(true), daily);
}

export async function setDailyReminder(sub: BrowserSubscription, daily: boolean) {
  if (!valid(sub)) throw new Error("Bad subscription");
  await saveSubscription(sub, await playerId(true), daily);
}

export async function unsubscribe(endpoint: string) {
  if (typeof endpoint === "string") await removeSubscription(endpoint);
}

export async function status(endpoint: string) {
  return typeof endpoint === "string" ? subscriptionStatus(endpoint) : null;
}
