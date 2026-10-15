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
  errors: { count24h: number; recent: { at: string; source: string; path: string | null; message: string }[] };
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
  const [stats, games, errorCount, recentErrors, growth] = await Promise.all([
    supabase.rpc("admin_stats", { today_number: today }),
    supabase
      .from("challenges")
      .select("code, status, turn_seat, updated_at, challenge_players(nickname, letters, seat, last_seen)")
      .in("status", ["lobby", "playing"])
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(25),
    supabase.from("app_errors").select("id", { count: "exact", head: true }).gte("at", since),
    supabase.from("app_errors").select("at, source, path, message").order("at", { ascending: false }).limit(10),
    supabase.rpc("admin_growth", { today_number: today }),
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
    errors: {
      count24h: errorCount.count ?? 0,
      recent: (recentErrors.data ?? []) as AdminStats["errors"]["recent"],
    },
    puzzleNumber: today,
    activeGames: ((games.data ?? []) as GameRow[]).map((g) => ({
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
