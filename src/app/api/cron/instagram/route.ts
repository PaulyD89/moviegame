import { connection } from "next/server";
import { puzzleDate } from "@/lib/daily-clock";
import { dailyStart } from "@/lib/game";
import { postDailyToInstagram } from "@/lib/instagram";

/**
 * Nightly at 12:01am New York: post the new Movie Chain to Instagram, a minute after
 * new-chain has chosen it. Vercel Cron calls this at 04:01 and 05:01 UTC; only the run
 * in New York's midnight hour posts (that handles daylight saving), and only once.
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
  if (nyHour !== 0) return Response.json({ skipped: `It's ${nyHour}:00 in New York` });

  // Normally new-chain saved it a minute ago; dailyStart returns that saved puzzle.
  const { number, card } = await dailyStart(puzzleDate());
  return Response.json({ number, instagram: await postDailyToInstagram(number, card) });
}
