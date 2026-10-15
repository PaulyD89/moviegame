import "server-only";
import { createAdminClient } from "./supabase/admin";

export type GlobalRank = { points: number; rank: number | null };

/**
 * This player's all-time points and place among everyone with points (see the global_rank SQL).
 * The number of ranked players stays on the server; it isn't shown to anyone.
 */
export async function globalRank(playerId: string): Promise<GlobalRank> {
  const { data, error } = await createAdminClient().rpc("global_rank", { p_player: playerId });
  if (error) throw error;
  const { points, rank } = data as GlobalRank;
  return { points, rank };
}
