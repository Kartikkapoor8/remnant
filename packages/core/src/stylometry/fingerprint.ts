/**
 * Layer 1 of authenticity: the MECHANICAL fingerprint.
 *
 * Everything here is computed by code from the corpus, never by an LLM:
 * message length distribution, punctuation habits, capitalization, emoji,
 * burst-texting rhythm, lexical tics and how the person opens a conversation.
 * The StyleEnforcer later forces model output back onto these numbers.
 */
import type { Message } from "../types.ts";
import {
  countBy,
  extractEmoji,
  isOnlyUrl,
  mean,
  median,
  percentile,
  stripEmoji,
  tokenize,
  wordCount,
} from "./text.ts";

export interface StyleFingerprint {
  sampleSize: number;
  length: {
    charsP50: number;
    charsP75: number;
    charsP90: number;
    charsMax: number;
    wordsP50: number;
    wordsP90: number;
  };
  punctuation: {
    terminalPeriodRate: number;
    exclamationRate: number;
    questionRate: number;
    ellipsisRate: number;
    commaRate: number;
    apostropheDropRate: number;
  };
  capitalization: {
    lowercaseStartRate: number;
    allLowercaseRate: number;
    lowercaseIRate: number;
  };
  emoji: { perMessage: number; top: string[] };
  bursts: {
    meanSize: number;
    sizeDistribution: number[];
    medianGapMs: number;
    charsPerSecond: number;
  };
  lexicon: {
    laugh: "haha" | "lol" | "lmao" | "hehe" | null;
    affirmative: string | null;
    signaturePhrases: string[];
    petNames: string[];
    stretchRate: number;
    abbreviations: string[];
  };
  greetings: string[];
}

export const BURST_GAP_MS = 90_000;
export const CONVERSATION_GAP_MS = 4 * 60 * 60 * 1000;

/** Contractions people commonly write without the apostrophe. */
export const CONTRACTIONS: Record<string, string> = {
  "don't": "dont",
  "i'm": "im",
  "can't": "cant",
  "didn't": "didnt",
  "that's": "thats",
  "you're": "youre",
  "i've": "ive",
  "won't": "wont",
  "isn't": "isnt",
};
const DROPPED = new Set(Object.values(CONTRACTIONS));
const KEPT = new Set(Object.keys(CONTRACTIONS));

const LAUGHS = ["haha", "lol", "lmao", "hehe"] as const;
const AFFIRMATIVES = ["ya", "yea", "yeah", "yep", "yup", "yes", "okok", "ok", "okay", "sure"];
const PET_NAMES = ["bub", "babe", "baby", "love", "hun", "honey", "dear", "boo", "bubs", "sweetie", "darling"];
const ABBREVIATIONS = ["u", "ur", "omw", "rn", "idk", "tho", "k", "ya", "okok", "nvm", "brb", "btw", "tbh", "ily", "pls", "plz", "thx", "ttyl", "gn", "gm", "imo", "wyd", "hbu", "ofc", "bc", "cuz", "lmk", "fr"];
const STOPWORDS = new Set(["the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "at", "for", "is", "it", "i", "you", "we", "me", "my", "your", "that", "this", "so", "be", "was", "are", "with", "have", "just", "not", "do", "up", "get", "got", "im", "its", "if", "can", "will", "what", "how", "when", "go", "going", "ok", "okay", "yes", "no", "yeah", "ya", "too", "now", "all", "about"]);

export function computeFingerprint(messages: Message[]): StyleFingerprint {
  const sorted = [...messages]
    .filter((m) => m.text.trim().length > 0 && !isOnlyUrl(m.text))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const them = sorted.filter((m) => m.sender === "them");
  const me = sorted.filter((m) => m.sender === "me");
  const texts = them.map((m) => m.text.trim());
  const n = texts.length;

  if (n === 0) return neutralFingerprint();

  const rate = (pred: (t: string) => boolean) => texts.filter(pred).length / n;

  // --- length ---
  const chars = texts.map((t) => stripEmoji(t).length);
  const words = texts.map(wordCount);

  // --- punctuation ---
  const stripped = texts.map((t) => stripEmoji(t).trim());
  const terminalPeriodRate = stripped.filter((t) => /[^.]\.$/.test(t)).length / n;
  const exclamationRate = rate((t) => /!/.test(t));
  const questionRate = rate((t) => /\?/.test(t));
  const ellipsisRate = rate((t) => /\.{2,}|…/.test(t));
  const commaRate = rate((t) => /,/.test(t));
  let dropped = 0;
  let kept = 0;
  for (const t of texts) for (const tok of tokenize(t)) {
    if (DROPPED.has(tok)) dropped++;
    else if (KEPT.has(tok)) kept++;
  }
  const apostropheDropRate = dropped + kept === 0 ? 0 : dropped / (dropped + kept);

  // --- capitalization ---
  const withLetters = stripped.filter((t) => /[a-zA-Z]/.test(t));
  const capBase = withLetters.length || 1;
  const lowercaseStartRate = withLetters.filter((t) => { const c = t.match(/[a-zA-Z]/)?.[0]; return c !== undefined && c === c.toLowerCase(); }).length / capBase;
  const allLowercaseRate = withLetters.filter((t) => t === t.toLowerCase()).length / capBase;
  let lowerI = 0; let upperI = 0;
  for (const t of stripped) {
    lowerI += (t.match(/(^|\s)i(?=\s|$|')/g) ?? []).length;
    upperI += (t.match(/(^|\s)I(?=\s|$|')/g) ?? []).length;
  }
  const lowercaseIRate = lowerI + upperI === 0 ? 0 : lowerI / (lowerI + upperI);

  // --- emoji ---
  const allEmoji = texts.flatMap(extractEmoji);
  const emojiCounts = countBy(allEmoji);
  const top = [...emojiCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([e]) => e);

  // --- bursts ---
  const bursts = computeBursts(sorted);

  // --- lexicon ---
  const themTokens = texts.flatMap(tokenize);
  const meTokens = me.flatMap((m) => tokenize(m.text));
  const themCounts = countBy(themTokens);
  const meCounts = countBy(meTokens);

  let laugh: StyleFingerprint["lexicon"]["laugh"] = null;
  let laughBest = 0;
  for (const l of LAUGHS) {
    const c = themTokens.filter((t) => t === l || t.startsWith(l)).length;
    if (c > laughBest) { laughBest = c; laugh = l; }
  }
  let affirmative: string | null = null;
  let affBest = 0;
  for (const a of AFFIRMATIVES) {
    const c = themCounts.get(a) ?? 0;
    if (c > affBest) { affBest = c; affirmative = a; }
  }
  const petNames = PET_NAMES.filter((p) => (themCounts.get(p) ?? 0) >= 3);
  const abbreviations = ABBREVIATIONS.filter((a) => (themCounts.get(a) ?? 0) >= 2);
  const stretchRate = rate((t) => /([a-z])\1\1/i.test(t));
  const signaturePhrases = findSignaturePhrases(texts, me.map((m) => m.text), themTokens.length, meTokens.length, themCounts, meCounts);

  // --- greetings ---
  const greetings = computeGreetings(sorted);

  return {
    sampleSize: n,
    length: {
      charsP50: Math.round(percentile(chars, 0.5)),
      charsP75: Math.round(percentile(chars, 0.75)),
      charsP90: Math.round(percentile(chars, 0.9)),
      charsMax: Math.max(...chars),
      wordsP50: Math.round(percentile(words, 0.5)),
      wordsP90: Math.round(percentile(words, 0.9)),
    },
    punctuation: { terminalPeriodRate, exclamationRate, questionRate, ellipsisRate, commaRate, apostropheDropRate },
    capitalization: { lowercaseStartRate, allLowercaseRate, lowercaseIRate },
    emoji: { perMessage: allEmoji.length / n, top },
    bursts,
    lexicon: { laugh, affirmative, signaturePhrases, petNames, stretchRate, abbreviations },
    greetings,
  };
}

function computeBursts(sorted: Message[]): StyleFingerprint["bursts"] {
  const sizes: number[] = [];
  const gaps: number[] = [];
  const cps: number[] = [];
  let size = 0;
  let prev: Message | null = null;
  for (const m of sorted) {
    if (m.sender !== "them") {
      if (size > 0) sizes.push(size);
      size = 0; prev = null; continue;
    }
    if (prev) {
      const gap = Date.parse(m.timestamp) - Date.parse(prev.timestamp);
      if (gap <= BURST_GAP_MS) {
        size++;
        gaps.push(gap);
        if (gap > 0) cps.push(stripEmoji(m.text).length / (gap / 1000));
      } else {
        sizes.push(size); size = 1;
      }
    } else size = 1;
    prev = m;
  }
  if (size > 0) sizes.push(size);
  if (sizes.length === 0) return { meanSize: 1, sizeDistribution: [0, 1], medianGapMs: 20_000, charsPerSecond: 5 };
  const maxSize = Math.max(...sizes);
  const dist = new Array<number>(maxSize + 1).fill(0);
  for (const s of sizes) dist[s]! += 1 / sizes.length;
  return {
    meanSize: mean(sizes),
    sizeDistribution: dist,
    medianGapMs: gaps.length ? Math.round(median(gaps)) : 20_000,
    charsPerSecond: cps.length ? Math.min(12, Math.max(2, median(cps))) : 5,
  };
}

function findSignaturePhrases(
  themTexts: string[], meTexts: string[],
  themTotal: number, meTotal: number,
  themCounts: Map<string, number>, meCounts: Map<string, number>,
): string[] {
  const phrases = new Map<string, number>();
  const bigrams = (texts: string[]) => {
    const out: string[] = [];
    for (const t of texts) {
      const toks = tokenize(t);
      for (let i = 0; i + 1 < toks.length; i++) out.push(`${toks[i]} ${toks[i + 1]}`);
    }
    return out;
  };
  const themBi = countBy(bigrams(themTexts));
  const meBi = countBy(bigrams(meTexts));
  const themN = Math.max(1, themTotal);
  const meN = Math.max(1, meTotal);
  const relOk = (tc: number, mc: number) => tc / themN >= 3 * (mc / meN) || (mc === 0 && tc >= 3);
  for (const [tok, c] of themCounts) {
    if (c >= 3 && tok.length > 1 && !STOPWORDS.has(tok) && relOk(c, meCounts.get(tok) ?? 0)) phrases.set(tok, c);
  }
  for (const [bi, c] of themBi) {
    if (c >= 3 && relOk(c, meBi.get(bi) ?? 0)) phrases.set(bi, c);
  }
  return [...phrases.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([p]) => p);
}

function computeGreetings(sorted: Message[]): string[] {
  const openers: string[] = [];
  let prevTs: number | null = null;
  for (const m of sorted) {
    const ts = Date.parse(m.timestamp);
    if (m.sender === "them" && (prevTs === null || ts - prevTs > CONVERSATION_GAP_MS)) {
      const norm = stripEmoji(m.text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, 3).join(" ");
      if (norm) openers.push(norm);
    }
    prevTs = ts;
  }
  return [...countBy(openers).entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);
}

export function neutralFingerprint(): StyleFingerprint {
  return {
    sampleSize: 0,
    length: { charsP50: 40, charsP75: 70, charsP90: 110, charsMax: 200, wordsP50: 8, wordsP90: 20 },
    punctuation: { terminalPeriodRate: 0.5, exclamationRate: 0.1, questionRate: 0.2, ellipsisRate: 0.02, commaRate: 0.3, apostropheDropRate: 0 },
    capitalization: { lowercaseStartRate: 0.2, allLowercaseRate: 0.1, lowercaseIRate: 0.1 },
    emoji: { perMessage: 0, top: [] },
    bursts: { meanSize: 1, sizeDistribution: [0, 1], medianGapMs: 20_000, charsPerSecond: 5 },
    lexicon: { laugh: null, affirmative: null, signaturePhrases: [], petNames: [], stretchRate: 0, abbreviations: [] },
    greetings: [],
  };
}
