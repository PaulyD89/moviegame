import { connection } from "next/server";
import { puzzleDate } from "@/lib/daily-clock";
import { dailyStart } from "@/lib/game";
import { notifyDailySubscribers } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Nightly: create the new Movie Chain and ping everyone who asked for a reminder.
 * Vercel Cron calls this at 04:00 and 05:00 UTC; only the run that lands in the
 * midnight hour in New York does anything (that handles daylight saving).
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
  if (nyHour !== 0 && !force) return Response.json({ skipped: `It's ${nyHour}:00 in New York` });

  // Choose and save tonight's puzzle now, so the first player doesn't wait for it.
  const { number, card } = await dailyStart(puzzleDate());

  // Mark it reminded first, so a retry or the second cron can't send twice.
  const { data } = await createAdminClient()
    .from("daily_puzzles")
    .update({ reminded_at: new Date().toISOString() })
    .eq("number", number)
    .is("reminded_at", null)
    .select("number");
  if (!data?.length) return Response.json({ number, skipped: "Already reminded" });

  const sent = await notifyDailySubscribers({
    title: "Movie Horse",
    body: `A new Movie Chain is up! 🐴 #${number} starts with ${card.kind === "person" ? "an actor" : "a movie"}.`,
    url: "/",
    tag: "daily",
  });
  return Response.json({ number, sent });
}
