import { connection } from "next/server";
import { puzzleDate, puzzleNumber } from "@/lib/daily-clock";
import { postDeepCut } from "@/lib/deepcut";

/**
 * Noon Pacific: post yesterday's deepest cut (feed + story). Vercel Cron calls this at 19:00
 * and 20:00 UTC; only the run in Los Angeles' noon hour posts (daylight saving), and only once.
 */
export async function GET(request: Request) {
  await connection();
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const laHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }).format(
      new Date(),
    ),
  );
  if (laHour !== 12) return Response.json({ skipped: `It's ${laHour}:00 in Los Angeles` });
  const yesterday = puzzleNumber(puzzleDate()) - 1;
  return Response.json({ number: yesterday, result: await postDeepCut(yesterday) });
}
