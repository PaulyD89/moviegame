/**
 * "Strict but fair" comparison key: ignores case, accents, punctuation and
 * spacing, but every letter still has to be right.
 * "Zoë Saldaña" -> "zoesaldana", "Top Gun: Maverick" -> "topgunmaverick"
 */
export function nameKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}
