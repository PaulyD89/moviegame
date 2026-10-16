import { connection } from "next/server";
import { suspectMisses } from "@/lib/missed";

/**
 * Read-only list of wrong guesses that look like real answers, for the morning review run.
 * Needs its own key (MISSED_REPORT_KEY), so the reviewer never holds database credentials.
 */
export async function GET(request: Request) {
  await connection();
  const key = process.env.MISSED_REPORT_KEY;
  if (!key || request.headers.get("authorization") !== `Bearer ${key}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const days = Math.min(7, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 1));
  return Response.json({ days, misses: await suspectMisses(days) });
}
