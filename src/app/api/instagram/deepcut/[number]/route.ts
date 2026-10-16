import { deepCutCaption, deepCutJpeg, deepestCut } from "@/lib/deepcut";

/**
 * The "Yesterday's Deepest Cut" image for a finished puzzle (Instagram fetches it from here).
 * ?format=story for the 9:16 story version; ?caption for the post text.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/instagram/deepcut/[number]">) {
  const number = Number((await params).number);
  if (!Number.isInteger(number) || number < 1) return new Response("Not found", { status: 404 });
  const chain = await deepestCut(number);
  if (!chain) return new Response("No winning chain to show", { status: 404 });
  const q = new URL(request.url).searchParams;
  if (q.has("caption")) {
    return new Response(await deepCutCaption(number, chain), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const jpeg = await deepCutJpeg(number, chain, q.get("format") === "story" ? "story" : "post");
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" },
  });
}
