import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateText } from "ai";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { DailyState } from "./daily-play";
import { logError } from "./errors";
import { accessToken, graph, refreshToken, untilReady } from "./instagram";
import { createAdminClient } from "./supabase/admin";
import { getMovie } from "./tmdb";
import type { Card } from "./types";

/**
 * "Yesterday's Deepest Cut": the midday Instagram post (feed + story) showing the least-known
 * route any player won the previous day's chain with, laid out as a snake (left to right, down,
 * right to left...). Anonymous: no names or player counts.
 */

const SITE = "https://moviehorsegame.com";
const INK = "#1c1206";
const RUST = "#7c2d12";
const ACTOR = "#b91c1c";

const anton = readFile(join(process.cwd(), "assets/Anton-Regular.ttf"));
const logo = readFile(join(process.cwd(), "assets/logo-share.png")).then(
  (b) => `data:image/png;base64,${b.toString("base64")}`,
);

/** Titles we'd rather not put on the account's feed, beyond TMDB's own adult flag. */
const AWKWARD = /porn|nymphomaniac|xxx|erotic|sex tape/i;

const chainOf = (s: DailyState) => s.links.flatMap((l) => [l.card, l.answer]);

/** Typical obscurity: the average log-popularity, so one big star doesn't tip it. */
const typical = (cards: Card[]) =>
  cards.slice(1).reduce((n, c) => n + Math.log(Math.max(c.popularity || 1, 1)), 0) / Math.max(cards.length - 1, 1);

async function postable(cards: Card[]) {
  for (const c of cards) {
    if (c.kind !== "movie") continue;
    if (AWKWARD.test(c.name)) return false;
    const m = (await getMovie(c.id).catch(() => null)) as { adult?: boolean } | null;
    if (m?.adult) return false;
  }
  return true;
}

/** The least-known winning chain for a puzzle that's fit to post, or null. */
export async function deepestCut(number: number): Promise<Card[] | null> {
  const { data } = await createAdminClient()
    .from("daily_plays")
    .select("state")
    .eq("puzzle_number", number)
    .eq("won", true)
    .not("state", "is", null)
    .limit(2000);
  const chains = ((data ?? []) as { state: DailyState }[]).map((r) => chainOf(r.state)).filter((c) => c.length >= 2);
  for (const chain of chains.sort((a, b) => typical(a) - typical(b))) {
    if (await postable(chain)) return chain;
  }
  return null;
}

function Arrow({ dir, size }: { dir: "right" | "left" | "down"; size: number }) {
  const rotate = dir === "right" ? 0 : dir === "left" ? 180 : 90;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M3 12h14" stroke={INK} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <path d="M13 6l7 6-7 6" stroke={INK} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** The post (1080x1350) or story (1080x1920) image as a JPEG. */
export async function deepCutJpeg(number: number, chain: Card[], format: "post" | "story") {
  const story = format === "story";
  const PER = 5;
  const tile = story ? 156 : 132;
  const gap = story ? 40 : 34;
  const rows: Card[][] = [];
  for (let i = 0; i < chain.length; i += PER) rows.push(chain.slice(i, i + PER));
  const rowWidth = PER * tile + (PER - 1) * gap;
  // Shorten long names ourselves: centered text that overflows gets clipped at both ends.
  const max = story ? 17 : 16;
  const short = (name: string) => (name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name);

  const node = (c: Card) => (
    <div key={`${c.kind}-${c.id}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: tile }}>
      {c.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>
        <img
          src={c.image.replace("/w500/", "/w185/")}
          width={tile}
          height={tile * 1.25}
          alt=""
          style={{
            objectFit: "cover",
            objectPosition: "top",
            borderRadius: 12,
            border: `4px solid ${c.kind === "person" ? ACTOR : INK}`,
          }}
        />
      ) : (
        <div style={{ display: "flex", width: tile, height: tile * 1.25, borderRadius: 12, background: "#27272a" }} />
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: tile + 8,
          marginTop: 6,
          fontSize: story ? 21 : 18,
          fontWeight: 700,
          color: INK,
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {short(c.name)}
      </div>
    </div>
  );

  const png = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: story ? "center" : "flex-start",
          padding: story ? "80px 60px" : "30px 60px 26px",
          backgroundImage: "radial-gradient(circle at 50% 0%, #fde68a 0%, #fbbf24 55%, #f59e0b 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            padding: "8px 40px",
            borderRadius: 999,
            backgroundImage: "radial-gradient(ellipse at center, rgba(28,18,6,0.55) 0%, rgba(28,18,6,0) 70%)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
          <img src={await logo} width={story ? 260 : 210} height={story ? 173 : 140} alt="" />
        </div>
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: story ? 82 : 70, lineHeight: 1.1, color: INK, marginTop: 6, letterSpacing: 2 }}>
          {"YESTERDAY'S DEEPEST CUT"}
        </div>
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: story ? 36 : 32, lineHeight: 1.1, color: RUST, letterSpacing: 5, marginTop: story ? 16 : 12 }}>
          {`MOVIE CHAIN #${number} · A WINNING ROUTE`}
        </div>

        <div style={{ display: "flex", flexDirection: "column", width: rowWidth, marginTop: story ? 50 : 26 }}>
          {rows.map((row, r) => {
            const reversed = r % 2 === 1;
            const items: React.ReactNode[] = [];
            const ordered = reversed ? [...row].reverse() : row;
            ordered.forEach((c, i) => {
              if (i > 0)
                items.push(
                  <div key={`a${i}`} style={{ display: "flex", width: gap, height: tile * 1.25, alignItems: "center", justifyContent: "center" }}>
                    <Arrow dir={reversed ? "left" : "right"} size={gap - 4} />
                  </div>,
                );
              items.push(node(c));
            });
            const last = r === rows.length - 1;
            return (
              <div key={r} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: reversed && row.length < PER ? "flex-end" : "flex-start" }}>{items}</div>
                {!last && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: reversed ? "flex-start" : "flex-end",
                      height: story ? 44 : 32,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", width: tile, justifyContent: "center" }}>
                      <Arrow dir="down" size={story ? 36 : 28} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", fontFamily: "Anton", fontSize: story ? 50 : 42, lineHeight: 1.1, color: INK, marginTop: story ? 56 : 24 }}>
          Someone won with this chain. Could you?
        </div>
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: story ? 34 : 30, lineHeight: 1.1, letterSpacing: 2, color: RUST, marginTop: story ? 16 : 10 }}>moviehorsegame.com</div>
      </div>
    ),
    {
      width: 1080,
      height: story ? 1920 : 1350,
      fonts: [{ name: "Anton", data: await anton, weight: 400, style: "normal" }],
    },
  );
  return sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 90 }).toBuffer();
}

const CAPTION_SYSTEM = `You write the middle of a short Instagram caption for Movie Horse, a daily movie-and-actor chain game.
It celebrates "yesterday's deepest cut": the least-known route one anonymous player took to win.
Voice: a witty movie buff, playful and affectionate, never mean.
Rules: use ONLY the chain given; don't invent facts about the films or people. Two sentences, under 260 characters.
Call the player "one of you". No numbers of players, no hashtags, no emoji. Reply with the text only.`;

/** The caption, written once per puzzle and saved. */
export async function deepCutCaption(number: number, chain: Card[]) {
  const db = createAdminClient();
  const { data } = await db.from("daily_puzzles").select("deepcut_caption").eq("number", number).maybeSingle();
  let middle = data?.deepcut_caption as string | undefined;
  if (!middle) {
    try {
      const { text } = await generateText({
        model: "anthropic/claude-sonnet-5.5",
        system: CAPTION_SYSTEM,
        prompt: `Winning chain, in order: ${chain.map((c) => c.name).join(" → ")}`,
        maxOutputTokens: 1000,
      });
      middle = text.trim().replace(/^["“]|["”]$/g, "").replace(/\s+/g, " ");
    } catch {
      middle = "";
    }
    if (!middle || middle.length > 320 || middle.includes("#")) {
      middle = `One of you went from ${chain[0].name} to ${chain.at(-1)!.name} the long way round and still made all 10 links. Respect.`;
    }
    await db.from("daily_puzzles").update({ deepcut_caption: middle }).eq("number", number);
  }
  return [
    `🕵️ Yesterday's Deepest Cut · Movie Horse #${number}`,
    "",
    middle,
    "",
    "Today's chain is live. How deep can you go? moviehorsegame.com (link in bio) 🎬",
    "",
    "#moviehorse #moviehorsegame #movietrivia #moviequiz #dailygame #movies #film #cinema #moviebuff #letterboxd",
  ].join("\n");
}

/**
 * Post the deepest cut for a finished puzzle, as a feed post and a story, once. A story that
 * Instagram refuses is logged without undoing the feed post.
 */
export async function postDeepCut(number: number) {
  const userId = process.env.INSTAGRAM_USER_ID;
  const token = await accessToken();
  if (!userId || !token) return "not set up";
  const chain = await deepestCut(number);
  if (!chain) return "no postable winning chain";

  const { data } = await createAdminClient()
    .from("daily_puzzles")
    .update({ deepcut_posted_at: new Date().toISOString() })
    .eq("number", number)
    .is("deepcut_posted_at", null)
    .select("number");
  if (!data?.length) return "already posted";

  const image = (format: string) => `${SITE}/api/instagram/deepcut/${number}?format=${format}`;
  const result: Record<string, string> = {};
  try {
    const caption = await deepCutCaption(number, chain);
    const post = await graph(`${userId}/media`, { image_url: image("post"), caption, access_token: token });
    await untilReady(post, token);
    result.post = await graph(`${userId}/media_publish`, { creation_id: post, access_token: token });
  } catch (e) {
    await logError("cron", `Deepest cut post for #${number} failed: ${e instanceof Error ? e.message : e}`, "/api/cron/deepcut");
    result.post = "failed";
  }
  try {
    const story = await graph(`${userId}/media`, { image_url: image("story"), media_type: "STORIES", access_token: token });
    await untilReady(story, token);
    result.story = await graph(`${userId}/media_publish`, { creation_id: story, access_token: token });
  } catch (e) {
    await logError("cron", `Deepest cut story for #${number} failed: ${e instanceof Error ? e.message : e}`, "/api/cron/deepcut");
    result.story = "failed";
  }
  await refreshToken(token).catch(() => {});
  return result;
}
