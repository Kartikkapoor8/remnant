/**
 * Small, dependency-free text helpers shared by the stylometry fingerprint
 * and the StyleEnforcer.
 */

const EMOJI_RE = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu;
const URL_RE = /https?:\/\/\S+|www\.\S+/gi;

export function isEmoji(s: string): boolean {
  return /^\p{Extended_Pictographic}/u.test(s);
}

export function extractEmoji(text: string): string[] {
  return text.match(EMOJI_RE) ?? [];
}

export function stripEmoji(text: string): string {
  return text.replace(EMOJI_RE, "").trim();
}

export function isOnlyUrl(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.replace(URL_RE, "").trim().length === 0;
}

export function containsUrl(text: string): boolean {
  return URL_RE.test(text) && ((URL_RE.lastIndex = 0), true);
}

/** Lowercased word tokens (letters, digits, apostrophes), emoji removed. */
export function tokenize(text: string): string[] {
  return stripEmoji(text)
    .toLowerCase()
    .replace(URL_RE, " ")
    .match(/[a-z0-9']+/g) ?? [];
}

export function wordCount(text: string): number {
  return stripEmoji(text).split(/\s+/).filter(Boolean).length;
}

/** Linear-interpolated percentile of a numeric array (p in [0,1]). */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const a = sorted[lo]!;
  const b = sorted[hi]!;
  return a + (b - a) * (idx - lo);
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  return percentile(values, 0.5);
}

/** Count occurrences of each item. */
export function countBy<T>(items: Iterable<T>): Map<T, number> {
  const m = new Map<T, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return m;
}

/** Split text into sentences on terminal punctuation or newlines. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Deterministic PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
