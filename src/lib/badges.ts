/**
 * Achievement badges on the stats screen, in display order. Art lives in /public/badges.
 * Keep `how` short: it sits beside the enlarged badge on a phone.
 */
export const BADGES = [
  { id: "opening-night", name: "Opening Night", how: "Win your first daily" },
  { id: "one-take", name: "One Take", how: "Win a daily with no letters" },
  { id: "franchise", name: "Franchise", how: "Play the daily 7 days in a row" },
  { id: "lightning-round", name: "Lightning Round", how: "All 10 links under 20s each" },
  { id: "top-billing", name: "Top Billing", how: "Make the top 10 for a month" },
  { id: "showdown", name: "Showdown", how: "Win your first VS game" },
] as const;

export type BadgeId = (typeof BADGES)[number]["id"];

/** What the server knows about this player's dailies, for badges and stats a phone can't see on its own. */
export type BadgeFacts = { won: boolean; perfect: boolean; lightning: boolean; fastestWinMs: number | null };
