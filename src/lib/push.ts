import "server-only";
import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  /** Same tag replaces the previous notification instead of stacking (e.g. one per game). */
  tag?: string;
};

type SubscriptionRow = { endpoint: string; p256dh: string; auth: string };

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    "https://moviehorsegame.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function saveSubscription(sub: BrowserSubscription, playerId: string, daily?: boolean) {
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert({
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      player_id: playerId,
      updated_at: new Date().toISOString(),
      ...(daily === undefined ? {} : { daily }),
    });
  if (error) throw error;
}

export async function removeSubscription(endpoint: string) {
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function subscriptionStatus(endpoint: string) {
  const { data } = await createAdminClient()
    .from("push_subscriptions")
    .select("daily")
    .eq("endpoint", endpoint)
    .maybeSingle<{ daily: boolean }>();
  return data;
}

async function deliver(subs: SubscriptionRow[], payload: PushPayload) {
  if (subs.length === 0) return 0;
  configure();
  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;
  // Send in small batches so a big reminder list doesn't open hundreds of sockets at once.
  for (let i = 0; i < subs.length; i += 50) {
    const results = await Promise.allSettled(
      subs.slice(i, i + 50).map((s) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 60 * 60 * 12,
          urgency: "high",
        }),
      ),
    );
    results.forEach((r, j) => {
      if (r.status === "fulfilled") sent++;
      // 404/410 = the browser dropped this subscription; stop sending to it.
      else if ([404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)) {
        dead.push(subs[i + j].endpoint);
      }
    });
  }
  if (dead.length) await createAdminClient().from("push_subscriptions").delete().in("endpoint", dead);
  return sent;
}

/** Notify every device belonging to these players. */
export async function notifyPlayers(playerIds: string[], payload: PushPayload) {
  if (playerIds.length === 0) return 0;
  const { data } = await createAdminClient()
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("player_id", playerIds);
  return deliver((data ?? []) as SubscriptionRow[], payload);
}

/** Notify everyone who asked for the nightly Movie Chain reminder. */
export async function notifyDailySubscribers(payload: PushPayload) {
  const { data } = await createAdminClient()
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("daily", true);
  return deliver((data ?? []) as SubscriptionRow[], payload);
}
