import { markAway } from "@/lib/challenge";
import { playerId, UUID } from "@/lib/player";

/** Sent by the game screen (via sendBeacon) when the player leaves it, so turn alerts resume right away. */
export async function POST(_request: Request, { params }: RouteContext<"/api/challenge/[id]/away">) {
  const { id } = await params;
  const pid = await playerId(false);
  if (pid && UUID.test(id)) await markAway(id, pid);
  return new Response(null, { status: 204 });
}
