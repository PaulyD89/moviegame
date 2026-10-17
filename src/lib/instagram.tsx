import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { logError } from "./errors";
import { createAdminClient } from "./supabase/admin";
import { openerFacts, writeTrivia } from "./trivia";
import { LINKS_TO_WIN, type Card } from "./types";

/**
 * The nightly Instagram post for a new Movie Chain: a 4:5 card with the opener everyone gets
 * (no spoilers) and a caption. Posts through the Instagram API with Instagram Login, which
 * needs INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN; without them nothing is posted.
 */

const GRAPH = "https://graph.instagram.com/v23.0";
const SITE = "https://moviehorsegame.com";
const AMBER = "#fbbf24";

const anton = readFile(join(process.cwd(), "assets/Anton-Regular.ttf"));
const logo = readFile(join(process.cwd(), "assets/logo-share.png")).then(
  (b) => `data:image/png;base64,${b.toString("base64")}`,
);

const ask = (card: Card) => (card.kind === "movie" ? "Name an actor in it" : "Name a movie they were in");

/** The post's picture as a JPEG (Instagram doesn't take PNGs): 4:5 post or 9:16 story. */
export async function dailyCardJpeg(number: number, card: Card, format: "post" | "story" = "post") {
  const story = format === "story";
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
          padding: story ? "70px 56px" : "60px 64px",
          color: "white",
          // Movie days gold on black, actor days deep burgundy, so the grid alternates.
          background:
            card.kind === "movie"
              ? "radial-gradient(circle at 50% 0%, #3b2a12 0%, #0b0908 58%)"
              : "radial-gradient(circle at 50% 0%, #6e1a2a 0%, #3a0b16 45%, #1a050b 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
        <img src={await logo} width={story ? 560 : 330} height={story ? 373 : 220} alt="" />
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: story ? 72 : 50, color: AMBER, letterSpacing: 4, marginTop: 10 }}>
          {`MOVIE CHAIN #${number} IS LIVE`}
        </div>
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>
          <img
            src={card.image}
            width={story ? 600 : 400}
            height={story ? 900 : 600}
            alt=""
            style={{ marginTop: story ? 40 : 36, borderRadius: 22, border: "3px solid rgba(251,191,36,0.45)", objectFit: "cover" }}
          />
        ) : (
          <div style={{ display: "flex", marginTop: 36, width: story ? 600 : 400, height: story ? 900 : 600, borderRadius: 22, background: "#27272a" }} />
        )}
        <div style={{ display: "flex", fontSize: story ? 38 : 30, color: "#d4d4d8", marginTop: 30 }}>Today starts with</div>
        <div style={{ display: "flex", fontSize: story ? 66 : 54, fontWeight: 700, marginTop: 4, textAlign: "center" }}>
          {card.year ? `${card.name} (${card.year})` : card.name}
        </div>
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: story ? 46 : 40, color: AMBER, marginTop: 18, letterSpacing: 2 }}>
          {`${ask(card).toUpperCase()} · ${LINKS_TO_WIN} LINKS TO WIN`}
        </div>
        <div style={{ display: "flex", marginTop: story ? 56 : "auto", fontSize: story ? 42 : 34, color: "#e4e4e7" }}>
          {"Don't spell M-O-V-I-E  ·  moviehorsegame.com"}
        </div>
      </div>
    ),
    { width: 1080, height: story ? 1920 : 1350, fonts: [{ name: "Anton", data: await anton, weight: 400, style: "normal" }] },
  );
  return sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 90 }).toBuffer();
}

const FIXED_TAGS = [
  "moviehorse", "moviehorsegame", "movietrivia", "moviequiz", "dailygame", "dailypuzzle", "triviagame",
  "movies", "film", "cinema", "moviebuff", "cinephile", "letterboxd",
];

const GENRE_TAGS: Record<string, string> = {
  Action: "actionmovies", Adventure: "adventuremovies", Animation: "animatedmovies", Comedy: "comedymovies",
  Crime: "crimemovies", Documentary: "documentary", Drama: "dramamovies", Family: "familymovies",
  Fantasy: "fantasymovies", History: "historymovies", Horror: "horrormovies", Music: "musicmovies",
  Mystery: "mysterymovies", Romance: "romancemovies", "Science Fiction": "scifimovies",
  Thriller: "thrillermovies", War: "warmovies", Western: "westernmovies",
};

/** "Spider-Man: Homecoming (2017)" → "SpiderManHomecoming". */
const asTag = (name: string) =>
  name
    .replace(/\s*\(\d{4}\)$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "And")
    .split(/[^A-Za-z0-9]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join("");

/**
 * Fixed tags for the game, then ones that follow the day: the opener, and the decade and
 * main genre (movie days) or their best-known film (actor days).
 */
async function hashtags(card: Card) {
  const daily = [asTag(card.name)];
  try {
    const f = await openerFacts(card);
    if (f.kind === "movie") {
      const decade = card.year ? Math.floor(card.year / 10) * 10 : null;
      if (decade) daily.push(decade >= 2000 ? `${decade}smovies` : `${String(decade).slice(2)}smovies`);
      const genre = f.genres?.map((g) => GENRE_TAGS[g]).find(Boolean);
      if (genre) daily.push(genre);
    } else if (f.best_known_films?.[0]) {
      daily.push(asTag(f.best_known_films[0].replace(/ as .*$/, "")));
    }
  } catch {
    // The fixed tags and the opener's tag are enough.
  }
  return [...new Set([...FIXED_TAGS, ...daily].filter((t) => t.length > 1))].map((t) => `#${t}`).join(" ");
}

/** The puzzle's trivia line: written once, then saved so every caption for it matches. */
async function triviaFor(number: number, card: Card) {
  const db = createAdminClient();
  const { data } = await db.from("daily_puzzles").select("instagram_trivia").eq("number", number).maybeSingle();
  if (data?.instagram_trivia) return data.instagram_trivia as string;
  const line = await writeTrivia(card);
  if (line) await db.from("daily_puzzles").update({ instagram_trivia: line }).eq("number", number);
  return line;
}

export async function dailyCaption(number: number, card: Card) {
  const start = card.year ? `${card.name} (${card.year})` : card.name;
  const [trivia, tags] = await Promise.all([triviaFor(number, card), hashtags(card)]);
  return [
    `Movie Horse #${number} is live 🐴`,
    "",
    `Today's chain starts with ${start}.`,
    ...(trivia ? ["", `🍿 ${trivia}`] : []),
    "",
    `${ask(card)}, then keep the chain going for ${LINKS_TO_WIN} links. Don't spell M-O-V-I-E.`,
    "",
    "Play free at moviehorsegame.com (link in bio) 🎬",
    "",
    tags,
  ].join("\n");
}

/** The current token: the last refreshed one if we have it, else the one set in Vercel. */
export async function accessToken() {
  const { data } = await createAdminClient().from("app_settings").select("value").eq("key", "instagram_token").maybeSingle();
  return (data?.value as string | undefined) ?? process.env.INSTAGRAM_ACCESS_TOKEN ?? null;
}

/** Long-lived tokens last 60 days; refreshing nightly keeps them alive indefinitely. */
export async function refreshToken(token: string) {
  const res = await fetch(`${GRAPH.replace(/\/v[\d.]+$/, "")}/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`);
  const body = (await res.json()) as { access_token?: string };
  if (!res.ok || !body.access_token) throw new Error(`Instagram token refresh failed: ${res.status}`);
  await createAdminClient()
    .from("app_settings")
    .upsert({ key: "instagram_token", value: body.access_token, updated_at: new Date().toISOString() });
}

export async function graph(path: string, params: Record<string, string>) {
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body: new URLSearchParams(params) });
  const body = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !body.id) throw new Error(`Instagram ${path}: ${body.error?.message ?? res.status}`);
  return body.id;
}

/** Instagram fetches and processes the picture after upload; publishing before then fails. */
export async function untilReady(container: string, token: string) {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`${GRAPH}/${container}?fields=status_code&access_token=${token}`);
    const { status_code } = (await res.json()) as { status_code?: string };
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`Instagram media ${status_code}`);
  }
  throw new Error("Instagram media still processing after a minute");
}

/**
 * Post tonight's chain once. Marks the puzzle first, so the second nightly cron run (or a
 * retry) can't post twice; a failure is logged for /admin instead of retried.
 */
export async function postDailyToInstagram(number: number, card: Card) {
  const userId = process.env.INSTAGRAM_USER_ID;
  const token = await accessToken();
  if (!userId || !token) return "not set up";

  const { data } = await createAdminClient()
    .from("daily_puzzles")
    .update({ instagram_posted_at: new Date().toISOString() })
    .eq("number", number)
    .is("instagram_posted_at", null)
    .select("number");
  if (!data?.length) return "already posted";

  try {
    const container = await graph(`${userId}/media`, {
      image_url: `${SITE}/api/instagram/card/${number}`,
      caption: await dailyCaption(number, card),
      access_token: token,
    });
    await untilReady(container, token);
    const post = await graph(`${userId}/media_publish`, { creation_id: container, access_token: token });
    // The same card as a story; if Instagram refuses it, the feed post still stands.
    const story = await (async () => {
      try {
        const s = await graph(`${userId}/media`, {
          image_url: `${SITE}/api/instagram/card/${number}?format=story`,
          media_type: "STORIES",
          access_token: token,
        });
        await untilReady(s, token);
        return await graph(`${userId}/media_publish`, { creation_id: s, access_token: token });
      } catch (e) {
        await logError("cron", `Instagram story for #${number} failed: ${e instanceof Error ? e.message : e}`, "/api/cron/instagram");
        return "failed";
      }
    })();
    await refreshToken(token).catch((e) => logError("cron", String(e), "/api/cron/new-chain"));
    return { post, story };
  } catch (e) {
    await logError("cron", `Instagram post for #${number} failed: ${e instanceof Error ? e.message : e}`, "/api/cron/new-chain");
    return "failed";
  }
}
