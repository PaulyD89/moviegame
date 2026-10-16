import { doubleMetaphone } from "double-metaphone";

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
  // Spelled-out numbers: "Ocean's Eleven" = "Ocean's 11".
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
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
    .replace(/['’ʻʼ`´]/g, "")
    .split(/[^a-z0-9]+/)
    .map((word) => SAME_WORD[word] ?? word)
    .join("");
}

const FILLER = new Set(["the", "a", "an", "and", "of", "in", "on", "to"]);

/** The meaningful words of a title or name, each evened out like nameKey ("Ocean's Eleven" -> oceans, 11). */
export function wordKeys(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’ʻʼ`´]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !FILLER.has(w))
    .map((w) => SAME_WORD[w] ?? w);
}

/** First names people swap freely. Each group maps to its first entry. */
const NICKNAMES = [
  ["catherine", "cathy", "kathy", "katherine", "kathryn", "cate", "kate", "katie", "kat"],
  ["michael", "mike", "mick", "mickey"],
  ["matthew", "matt"],
  ["christopher", "chris"],
  ["thomas", "tom", "tommy"],
  ["james", "jim", "jimmy", "jamie"],
  ["william", "bill", "billy", "will", "willie"],
  ["robert", "bob", "bobby", "rob", "robbie", "bert"],
  ["richard", "rick", "ricky", "dick", "rich"],
  ["daniel", "dan", "danny"],
  ["david", "dave", "davey"],
  ["joseph", "joe", "joey"],
  ["steven", "stephen", "steve"],
  ["anthony", "tony"],
  ["andrew", "andy", "drew"],
  ["alexander", "alex", "alec"],
  ["nicholas", "nick", "nicky"],
  ["benjamin", "ben", "benny"],
  ["jonathan", "jon"],
  ["john", "johnny"],
  ["joshua", "josh"],
  ["zachary", "zach", "zack"],
  ["samuel", "sam", "sammy"],
  ["edward", "ed", "eddie", "ted", "teddy"],
  ["jennifer", "jen", "jenny"],
  ["elizabeth", "liz", "lizzy", "beth", "betty", "eliza"],
  ["margaret", "maggie", "meg", "peggy"],
  ["rebecca", "becky"],
  ["susan", "sue", "susie"],
  ["deborah", "debra", "debbie", "deb"],
  ["patricia", "pat", "patty", "tricia"],
  ["abigail", "abby"],
  ["alexandra", "alexis", "lexi"],
  ["timothy", "tim", "timmy"],
  ["kenneth", "ken", "kenny"],
  ["gregory", "greg"],
  ["jeffrey", "jeff"],
  ["frederick", "fred", "freddie"],
  ["lawrence", "larry"],
  ["raymond", "ray"],
  ["ronald", "ron", "ronnie"],
  ["donald", "don", "donnie"],
  ["leonard", "leo", "len", "lenny"],
  ["vincent", "vince", "vinnie"],
  ["philip", "phillip", "phil"],
  ["gerald", "gerry", "jerry"],
  ["peter", "pete"],
];
const NICK: Record<string, string> = Object.fromEntries(NICKNAMES.flatMap((g) => g.map((n) => [n, g[0]])));

/**
 * Name key with the first name evened out, so "Cathy Moriarty" = "Catherine Moriarty"
 * and "Mike Myers" = "Michael Myers". Used alongside nameKey, never instead of it.
 */
export function nicknameKey(s: string): string {
  const words = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’ʻʼ`´]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (words.length < 2) return "";
  return [NICK[words[0]] ?? words[0], ...words.slice(1)].join("");
}

/**
 * Key without a leading article or any "and"/"&", so "Matrix" matches "The Matrix" and
 * "Planes Trains Automobiles" matches "Planes, Trains and Automobiles".
 */
export function titleKey(s: string): string {
  return nameKey(s.replace(/^\s*(the|a|an)\s+/i, "").replace(/&|\band\b/gi, " "));
}

/**
 * The title people actually say, without a leading "The Adventures of": "Elmo in Grouchland"
 * for "The Adventures of Elmo in Grouchland". Empty if the title has no such prefix.
 */
export function shortTitleKey(title: string): string {
  const rest = title.replace(/^\s*(the\s+)?adventures\s+of\s+/i, "");
  return rest === title ? "" : titleKey(rest);
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

/** Plain edit distance (no cap), for the sound-alike check. */
function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

const soundWords = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’ʻʼ`´]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => SAME_WORD[w] ?? w);

/**
 * Typos forgiven in one word of a longer name: 2 from 8 letters, 1 for 3-7, none shorter. Two in
 * a short word makes a different name ("Emma Watson" would become Gemma Aston).
 */
const wordAllowance = (word: string) => (word.length >= 8 ? 2 : word.length >= 3 ? 1 : 0);

/**
 * Typos counted word by word, for names of two or more words: "Kiera Knoghtly" for Keira
 * Knightley is 1 + 2 typos, each word within its own allowance. Same number of words, numbers
 * exact. Returns the total, or Infinity when any word is too far off.
 */
export function wordTypos(guess: string, real: string): number {
  const g = soundWords(guess);
  const r = soundWords(real);
  if (g.length < 2 || g.length !== r.length) return Infinity;
  let total = 0;
  for (let i = 0; i < g.length; i++) {
    if (g[i] === r[i]) continue;
    if (/^\d+$/.test(g[i]) || /^\d+$/.test(r[i])) return Infinity;
    const dist = typoDistance(g[i], r[i]);
    if (dist > wordAllowance(r[i])) return Infinity;
    total += dist;
  }
  return total;
}

/**
 * Does the guess sound like the real name, spelled by ear? "Kay Huay Quan" = "Ke Huy Quan",
 * "Zack Galifinakis" = "Zach Galifianakis". Every word must sound alike (Double Metaphone),
 * and the spelling must still be in the neighborhood, so different names don't slip through.
 */
export function soundsLike(guess: string, real: string): boolean {
  const g = soundWords(guess);
  const r = soundWords(real);
  if (g.length === 0 || g.length !== r.length) return false;
  const wordsMatch = g.every((word, i) => {
    if (/^\d+$/.test(word) || /^\d+$/.test(r[i])) return word === r[i];
    if (word === r[i]) return true;
    const [a1, a2] = doubleMetaphone(word);
    const [b1, b2] = doubleMetaphone(r[i]);
    return [a1, a2].some((code) => code && (code === b1 || code === b2));
  });
  if (!wordsMatch) return false;
  const a = g.join("");
  const b = r.join("");
  return editDistance(a, b) <= Math.max(2, Math.floor(b.length * 0.4));
}
