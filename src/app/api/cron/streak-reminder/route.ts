import { connection } from "next/server";
import { puzzleDate, puzzleNumber } from "@/lib/daily-clock";
import { deliver, type SubscriptionRow } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 8pm Eastern (5pm Pacific): nudge people on a win streak who haven't played today's chain.
 * Only devices that turned on the nightly reminder get it. Vercel Cron calls this at 00:00 and
 * 01:00 UTC; only the run that lands in the 8pm hour in New York does anything.
 */
export async function GET(request: Request) {
  await connection();
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const nyHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(
      new Date(),
    ),
  );
  const force = new URL(request.url).searchParams.has("force");
  if (nyHour !== 20 && !force) return Response.json({ skipped: `It's ${nyHour}:00 in New York` });

  const today = puzzleNumber(puzzleDate());
  const supabase = createAdminClient();
  // Claim tonight's reminder first, so the second cron (or a retry) can't send twice.
  const { data: claimed } = await supabase
    .from("daily_puzzles")
    .update({ streak_reminded_at: new Date().toISOString() })
    .eq("number", today)
    .is("streak_reminded_at", null)
    .select("number");
  if (!claimed?.length) return Response.json({ today, skipped: "Already reminded" });

  const { data, error } = await supabase.rpc("streak_reminder_targets", { today });
  if (error) throw error;
  const targets = (data ?? []) as (SubscriptionRow & { streak: number })[];

  // Same message for everyone on the same streak length, so send in groups.
  const byStreak = Map.groupBy(targets, (t) => Number(t.streak));
  let sent = 0;
  for (const [streak, subs] of byStreak) {
    sent += await deliver(subs, {
      title: `🔥 Your ${streak}-day streak ends at midnight`,
      body: `Today's Movie Chain #${today} is still waiting. Keep the streak alive!`,
      url: "/",
      tag: "streak",
    });
  }
  return Response.json({ today, targets: targets.length, sent });
}
