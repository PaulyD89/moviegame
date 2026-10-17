import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { puzzleDate, puzzleNumber } from "./daily-clock";
import { createAdminClient } from "./supabase/admin";

const COOKIE = "mh_admin";

/** The session cookie holds a hash of the password, never the password itself. */
function sessionToken() {
  return createHmac("sha256", process.env.ADMIN_PASSWORD!).update("movie-horse-admin").digest("hex");
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function isAdmin() {
  if (!process.env.ADMIN_PASSWORD) return false;
  const token = (await cookies()).get(COOKIE)?.value;
  return !!token && same(token, sessionToken());
}

export async function startAdminSession(password: string) {
  if (!process.env.ADMIN_PASSWORD || !same(password, process.env.ADMIN_PASSWORD)) return false;
  (await cookies()).set(COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export async function endAdminSession() {
  (await cookies()).delete(COOKIE);
}

export type GrowthDay = {
  number: number;
  date: string;
  players: number;
  finished: number;
  won: number;
  new_players: number;
  returning: number;
  prev_players: number;
  active: number;
  challenges: number;
  rematches: number;
};

export type AdminGrowth = {
  days: GrowthDay[];
  totals: { players: number; daily_games: number; challenges: number; challenges_finished: number };
};

export type AdminStats = {
  puzzleNumber: number;
  live_games: number;
  players_on_screen: number;
  games_in_progress: number;
  lobbies_open: number;
  challenges_today: number;
  finished_today: number;
  challenges_total: number;
  daily_started: number;
  daily_finished: number;
  daily_won: number;
  daily_avg_links: number | null;
  daily_last7: { number: number; started: number; finished: number }[];
  push_devices: number;
  push_daily: number;
  growth: AdminGrowth;
  /** Players by country over the last 7 days (counted since the country was first recorded). */
  countries: { country: string; players: number }[];
  /** Players by where they arrived from, last 7 days, with how many moved and finished. */
  sources: { source: string; players: number; moved: number; finished: number }[];
  browsers: { browser: string; players: number; moved: number; finished: number }[];
  returns: { dim: "puzzle" | "outcome" | "source" | "browser"; label: string; players: number; back: number }[];
  errors: {
    /** Not yet dismissed, from the last 7 days. */
    open: { id: number; at: string; source: string; path: string | null; message: string }[];
    openCount: number;
    dismissedThisWeek: number;
  };
  activeGames: {
    code: string | null;
    status: "lobby" | "playing";
    players: { nickname: string; letters: number; live: boolean; turn: boolean }[];
    updatedAt: string;
  }[];
};

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = createAdminClient();
  const today = puzzleNumber(puzzleDate());
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const [stats, games, openErrors, dismissedErrors, growth, countries, sources, browsers, returns] = await Promise.all([
    supabase.rpc("admin_stats", { today_number: today }),
    supabase
      .from("challenges")
      .select("code, status, turn_seat, updated_at, challenge_players(nickname, letters, seat, last_seen)")
      .in("status", ["lobby", "playing"])
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("app_errors")
      .select("id, at, source, path, message", { count: "exact" })
      .is("dismissed_at", null)
      .gte("at", weekAgo)
      .order("at", { ascending: false })
      .limit(10),
    supabase
      .from("app_errors")
      .select("id", { count: "exact", head: true })
      .not("dismissed_at", "is", null)
      .gte("at", weekAgo),
    supabase.rpc("admin_growth", { today_number: today }),
    supabase.rpc("admin_countries", { days: 7 }),
    supabase.rpc("admin_sources", { days: 7 }),
    supabase.rpc("admin_browsers", { days: 7 }),
    supabase.rpc("admin_returns", { today_number: today }),
  ]);
  if (growth.error) throw growth.error;
  if (stats.error) throw stats.error;
  const now = Date.now();
  type GameRow = {
    code: string | null;
    status: "lobby" | "playing";
    turn_seat: number | null;
    updated_at: string;
    challenge_players: { nickname: string; letters: number; seat: number; last_seen: string }[];
  };
  return {
    ...(stats.data as Omit<AdminStats, "puzzleNumber" | "activeGames" | "errors" | "growth">),
    growth: growth.data as AdminGrowth,
    countries: ((countries.data ?? []) as { country: string; players: number }[]).map((c) => ({
      country: c.country,
      players: Number(c.players),
    })),
    sources: ((sources.data ?? []) as { source: string; players: number; moved: number; finished: number }[]).map((s) => ({
      source: s.source,
      players: Number(s.players),
      moved: Number(s.moved),
      finished: Number(s.finished),
    })),
    browsers: ((browsers.data ?? []) as { browser: string; players: number; moved: number; finished: number }[]).map(
      (b) => ({ browser: b.browser, players: Number(b.players), moved: Number(b.moved), finished: Number(b.finished) }),
    ),
    returns: ((returns.data ?? []) as AdminStats["returns"]).map((r) => ({
      ...r,
      players: Number(r.players),
      back: Number(r.back),
    })),
    errors: {
      open: (openErrors.data ?? []) as AdminStats["errors"]["open"],
      openCount: openErrors.count ?? 0,
      dismissedThisWeek: dismissedErrors.count ?? 0,
    },
    puzzleNumber: today,
    // Active = someone opened it in the last day; the overnight skips alone don't count.
    activeGames: ((games.data ?? []) as GameRow[])
      .filter((g) => g.challenge_players.some((p) => Date.parse(p.last_seen) >= Date.parse(since)))
      .slice(0, 25)
      .map((g) => ({
      code: g.code,
      status: g.status,
      updatedAt: g.updated_at,
      players: g.challenge_players
        .sort((a, b) => a.seat - b.seat)
        .map((p) => ({
          nickname: p.nickname,
          letters: p.letters,
          live: now - Date.parse(p.last_seen) < 30_000,
          turn: g.status === "playing" && p.seat === g.turn_seat,
        })),
    })),
  };
}

/** Hide errors from the admin banner (all open ones when no id is given). They stay in the log. */
export async function dismissErrors(id?: number) {
  let q = createAdminClient().from("app_errors").update({ dismissed_at: new Date().toISOString() }).is("dismissed_at", null);
  if (id !== undefined) q = q.eq("id", id);
  const { error } = await q;
  if (error) throw error;
}
