import type { MetadataRoute } from "next";

/** Index the game and its info pages; keep admin, APIs and private VS game links out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/c/"] },
    sitemap: "https://moviehorsegame.com/sitemap.xml",
  };
}
