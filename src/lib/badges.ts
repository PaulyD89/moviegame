/** Achievement badges on the stats screen, in display order. Art lives in /public/badges. */
export const BADGES = [
  { id: "opening-night", name: "Opening Night", how: "Win your first daily Movie Chain." },
  { id: "one-take", name: "One Take", how: "Win a daily without getting a single letter." },
  { id: "franchise", name: "Franchise", how: "Win the daily 7 days in a row." },
  { id: "lightning-round", name: "Lightning Round", how: "Answer all 10 links of a daily within 20 seconds each." },
  { id: "top-billing", name: "Top Billing", how: "Reach the top 10 in a month's global rank." },
  { id: "showdown", name: "Showdown", how: "Win your first VS game." },
] as const;

export type BadgeId = (typeof BADGES)[number]["id"];

/** What the server knows about this player's dailies, for badges a phone can't see on its own. */
export type BadgeFacts = { won: boolean; perfect: boolean; lightning: boolean };
