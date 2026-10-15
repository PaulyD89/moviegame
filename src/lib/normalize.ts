/**
 * Words that people write either way. Both the guess and the real title/name go through this,
 * so "Dr. Strange" = "Doctor Strange" and "Rocky 2" = "Rocky II".
 */
const SAME_WORD: Record<string, string> = {
  doctor: "dr",
  mister: "mr",
  missus: "mrs",
  saint: "st",
  junior: "jr",
  senior: "sr",
  versus: "vs",
  mount: "mt",
  ii: "2",
  iii: "3",
  iv: "4",
  vi: "6",
  vii: "7",
  viii: "8",
  ix: "9",
};

/**
 * Comparison key: ignores case, accents, punctuation and spacing, and evens out common
 * short forms. "Zoë Saldaña" -> "zoesaldana", "Top Gun: Maverick" -> "topgunmaverick"
 */
export function nameKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .map((word) => SAME_WORD[word] ?? word)
    .join("");
}

/** Key without a leading article, so "Matrix" matches "The Matrix". */
export function titleKey(s: string): string {
  return nameKey(s.replace(/^\s*(the|a|an)\s+/i, ""));
}

/** How many typos we forgive: none under 5 letters, 1 up to 7, 2 from 8 on. */
export function typoAllowance(key: string): number {
  return key.length < 5 ? 0 : key.length < 8 ? 1 : 2;
}

/** Edit distance counting insert, delete, substitute and swap of neighbors as one typo each. */
export function typoDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return Infinity;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** 0 = exact, 1–2 = close enough, Infinity = no match. */
export function closeness(guessKeys: string[], candidateKeys: string[]): number {
  let best = Infinity;
  for (const c of candidateKeys) {
    if (!c) continue;
    for (const g of guessKeys) {
      if (g === c) return 0;
      const dist = typoDistance(g, c);
      if (dist <= typoAllowance(c) && dist < best) best = dist;
    }
  }
  return best;
}
