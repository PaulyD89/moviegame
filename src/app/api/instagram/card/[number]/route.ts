import { savedOpener } from "@/lib/game";
import { dailyCardJpeg, dailyCaption } from "@/lib/instagram";

/**
 * The Instagram picture for a saved daily (Instagram fetches it from here when posting).
 * Only shows the opener everyone gets, so it's public. Add ?caption to see the post's text.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/instagram/card/[number]">) {
  const number = Number((await params).number);
  if (!Number.isInteger(number) || number < 1) return new Response("Not found", { status: 404 });
  const card = await savedOpener(number);
  if (!card) return new Response("Not found", { status: 404 });

  if (new URL(request.url).searchParams.has("caption")) {
    return new Response(await dailyCaption(number, card), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const jpeg = await dailyCardJpeg(number, card);
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" },
  });
}
