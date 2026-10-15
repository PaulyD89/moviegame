import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { puzzleDate, puzzleNumber } from "@/lib/daily-clock";
import type { DailyState } from "@/lib/daily-play";
import { playerId } from "@/lib/player";
import { createAdminClient } from "@/lib/supabase/admin";
import { WORD } from "@/lib/types";

// Read once per server instance: the headline font and the logo never change.
const anton = readFile(join(process.cwd(), "assets/Anton-Regular.ttf"));
const logo = readFile(join(process.cwd(), "assets/logo-share.png")).then(
  (b) => `data:image/png;base64,${b.toString("base64")}`,
);

const AMBER = "#fbbf24";
const RED = "#dc2626";

function formatTime(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The player's finished daily as a picture for the share sheet. Spoiler-free: it shows the
 * starting card everyone gets, the shape of the game, and the score, but none of the answers.
 */
export async function GET() {
  const pid = await playerId(false);
  if (!pid) return new Response("Not found", { status: 404 });

  // Today's puzzle, or yesterday's for someone sharing just after midnight.
  const numbers = [0, -1].map((d) => puzzleNumber(puzzleDate(new Date(Date.now() + d * 86_400_000))));
  const { data } = await createAdminClient()
    .from("daily_plays")
    .select("puzzle_number, state, duration_ms")
    .eq("player_id", pid)
    .in("puzzle_number", numbers)
    .not("finished_at", "is", null)
    .not("state", "is", null)
    .order("puzzle_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ puzzle_number: number; state: DailyState; duration_ms: number | null }>();
  if (!data) return new Response("Not found", { status: 404 });

  const { puzzle_number: number, state: s, duration_ms } = data;
  const won = s.status === "won";
  const start = s.links[0]?.card ?? s.card;
  const points = (won ? 10 + 2 * (WORD.length - s.letters) : 2) + s.fastLinks;
  // One tile per move; correct moves line up with links, in order.
  let link = 0;
  const tiles = s.events.map((e) =>
    e === "correct" ? { color: AMBER, fast: !!s.links[link++]?.fast } : { color: e === "wrong" ? RED : "#52525b", fast: false },
  );
  const facts = [
    `${s.links.length}/10 links`,
    ...(s.fastLinks ? [`⚡ ${s.fastLinks} fast`] : []),
    ...(duration_ms ? [formatTime(duration_ms)] : []),
    `${points} pts`,
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "56px 64px",
          color: "white",
          background: "radial-gradient(circle at 50% 0%, #3b2a12 0%, #0b0908 55%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
        <img src={await logo} width={330} height={220} alt="" />
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: 44, color: AMBER, letterSpacing: 4, marginTop: 8 }}>
          {`MOVIE CHAIN #${number}`}
        </div>
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: 92, lineHeight: 1.1, marginTop: 4 }}>
          {won ? (s.letters === 0 ? "PERFECT GAME!" : "THAT'S A WRAP!") : "M-O-V-I-E"}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 36 }}>
          {start.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>
            <img
              src={start.image}
              width={300}
              height={450}
              alt=""
              style={{ borderRadius: 18, border: "2px solid rgba(255,255,255,0.15)", objectFit: "cover" }}
            />
          ) : (
            <div style={{ display: "flex", width: 300, height: 450, borderRadius: 18, background: "#27272a" }} />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 22, width: 470 }}>
            <div style={{ display: "flex", fontSize: 26, color: "#d4d4d8" }}>Today started with</div>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, lineHeight: 1.15 }}>{start.name}</div>
            <div style={{ display: "flex", gap: 10 }}>
              {WORD.split("").map((ch, i) => (
                <div
                  key={ch}
                  style={{
                    display: "flex",
                    width: 70,
                    height: 70,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    fontFamily: "Anton",
                    fontSize: 40,
                    background: i < s.letters ? RED : "transparent",
                    border: i < s.letters ? "none" : "2px solid rgba(255,255,255,0.18)",
                    color: i < s.letters ? "white" : "rgba(255,255,255,0.2)",
                  }}
                >
                  {ch}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 48, width: 940 }}>
          {tiles.map((t, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                width: 72,
                height: 72,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 14,
                // Fast links: a dark tile with a gold bolt, so the bolt stands out.
                background: t.fast ? "#1c1917" : t.color,
                border: t.fast ? `3px solid ${AMBER}` : "none",
                fontSize: 38,
              }}
            >
              {t.fast ? "⚡" : ""}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#a1a1aa", marginTop: 16 }}>
          {"⚡ under 20 seconds  ·  gold = link  ·  red = miss  ·  gray = pass"}
        </div>

        <div style={{ display: "flex", fontSize: 46, marginTop: 40 }}>{facts.join("  ·  ")}</div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 34, color: AMBER }}>
          Can you beat me? moviehorsegame.com
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [{ name: "Anton", data: await anton, weight: 400, style: "normal" }],
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
