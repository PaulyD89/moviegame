/**
 * Where a visitor came from, as a short label for the admin page: the ad tags on the link
 * first, then the referring site. Runs in the browser (document.referrer).
 */
export function trafficSource(search: string, referrer: string): string {
  const q = new URLSearchParams(search);
  const utm = (q.get("utm_source") ?? "").toLowerCase();
  const paid = q.get("utm_medium") === "paid" || q.has("fbclid");
  let host = "";
  try {
    host = referrer ? new URL(referrer).hostname.replace(/^www\.|^m\.|^l\./, "") : "";
  } catch {}
  if (utm === "reddit" || host.endsWith("reddit.com")) return paid ? "Reddit ad" : "Reddit";
  if (["ig", "instagram"].includes(utm) || host.endsWith("instagram.com")) return paid ? "Instagram ad" : "Instagram";
  if (["fb", "facebook"].includes(utm) || host.endsWith("facebook.com")) return paid ? "Facebook ad" : "Facebook";
  if (q.has("fbclid")) return "Instagram/Facebook ad";
  if (utm) return utm.slice(0, 30);
  if (/(^|\.)google\./.test(host)) return "Google";
  if (/bing\.com|duckduckgo\.com|search\.yahoo\.com/.test(host)) return "Other search";
  if (host.endsWith("letterboxd.com")) return "Letterboxd";
  if (host === "t.co" || host.endsWith("x.com") || host.endsWith("twitter.com")) return "X";
  if (host.endsWith("moviehorsegame.com") || host === "localhost") return "Direct";
  return host ? host.slice(0, 40) : "Direct";
}
