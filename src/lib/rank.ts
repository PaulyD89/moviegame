import "server-only";
import { puzzleDate, puzzleNumber } from "./daily-clock";
import { createAdminClient } from "./supabase/admin";

export type Standing = { points: number; rank: number | null };
export type GlobalRank = { month: Standing; allTime: Standing };

async function standing(playerId: string, fromPuzzle: number): Promise<Standing> {
  const { data, error } = await createAdminClient().rpc("global_rank", { p_player: playerId, p_from: fromPuzzle });
  if (error) throw error;
  const { points, rank } = data as Standing;
  return { points, rank };
}

/**
 * This player's place by points this month (resets on the 1st, Eastern time) and all time.
 * The number of ranked players stays on the server; it isn't shown to anyone.
 */
export async function globalRank(playerId: string): Promise<GlobalRank> {
  const firstOfMonth = `${puzzleDate().slice(0, 8)}01`;
  const [month, allTime] = await Promise.all([
    standing(playerId, Math.max(1, puzzleNumber(firstOfMonth))),
    standing(playerId, 1),
  ]);
  return { month, allTime };
}
