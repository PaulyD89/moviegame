import type { MetadataRoute } from "next";

const SITE = "https://moviehorsegame.com";

/** The public pages. /how-to-play is listed here rather than linked in the footer. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/how-to-play`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/challenge`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
