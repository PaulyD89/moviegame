import "server-only";
import { createAdminClient } from "./supabase/admin";

export type GlobalRank = { points: number; rank: number | null; ranked: number };

/** This player's all-time points and place among everyone with points (see the global_rank SQL). */
export async function globalRank(playerId: string): Promise<GlobalRank> {
  const { data, error } = await createAdminClient().rpc("global_rank", { p_player: playerId });
  if (error) throw error;
  return data as GlobalRank;
}
