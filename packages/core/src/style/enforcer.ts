/**
 * StyleEnforcer — the most important authenticity component.
 *
 * The LLM produces a well-formed paragraph. This post-processor forces it
 * back onto the person's measured mechanics: their length distribution,
 * their (lack of) punctuation, their capitalization, their lexical tics,
 * their burst rhythm, and a little strategic imperfection. All randomness
 * is a seeded PRNG so replies are reproducible in tests.
 */
import type { StyleFingerprint } from "../stylometry/fingerprint.ts";
import { CONTRACTIONS } from "../stylometry/fingerprint.ts";
import { extractEmoji, isEmoji, makeRng, splitSentences } from "../stylometry/text.ts";

export interface EnforcerOptions {
  seed?: number;
  maxBursts?: number;
}

type Rng = () => number;

const SPEAKER_PREFIX = /^(?:[A-Z][\w .'-]{0,30}|them|persona|assistant|reply):\s+/i;

/** a. Strip markdown, quotes, speaker prefixes, stage directions. */
export function normalizeLlmOutput(raw: string): string {
  let t = raw.replace(/\r/g, "").trim();
  t = t.replace(/\*\*([^*\n]{1,80})\*\*/g, "$1");   // **bold** → plain
  t = t.replace(/__([^_\n]{1,80})__/g, "$1");
  t = t.replace(/\*[^*\n]{1,80}\*/g, " ");        // *stage directions* / *emphasis*
  t = t.replace(/\[[^\]\n]{1,80}\]/g, " ");        // [stage directions]
  t = t.replace(/\([^)\n]*(?:laughs|smiles|pauses|sighs)[^)\n]*\)/gi, " ");
  t = t.replace(/[`#*_~>]+/g, "");
  t = t.split("\n").map((line) => line.replace(SPEAKER_PREFIX, "")).join("\n");
  t = t.replace(/^["'“‘]+|["'”’]+$/g, "");
  t = t.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  return t;
}

function sampleBurstCount(fp: StyleFingerprint, rng: Rng, maxBursts: number): number {
  const dist = fp.bursts.sizeDistribution;
  const total = dist.reduce((a, b) => a + b, 0);
  if (total <= 0) return 1;
  let r = rng() * total;
  for (let i = 1; i < dist.length; i++) {
    r -= dist[i] ?? 0;
    if (r <= 0) return Math.min(maxBursts, Math.max(1, i));
  }
  return Math.min(maxBursts, Math.max(1, dist.length - 1));
}

/** Cut at the last word boundary at or before `max` chars. Never mid-word. */
export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const idx = cut.lastIndexOf(" ");
  const out = (idx > 0 ? cut.slice(0, idx) : text.split(" ")[0]!).trim();
  return out.replace(/[,;:\-–—]+$/, "").trim() || text.split(" ")[0]!;
}

/** Cut an overlong sentence at its last clause boundary before `limit`. */
export function cutAtClause(sentence: string, limit: number): string {
  if (sentence.length <= limit) return sentence;
  const head = sentence.slice(0, limit);
  const m = [...head.matchAll(/,\s|\s(?:and|but|so|because)\s/g)];
  const last = m[m.length - 1];
  if (last && last.index !== undefined && last.index > limit * 0.3) {
    return sentence.slice(0, last.index).trim();
  }
  return truncateAtWord(sentence, limit);
}

/** b. Split into bursts sized to the fingerprint. */
export function splitIntoBursts(text: string, fp: StyleFingerprint, rng: Rng, maxBursts = 4): string[] {
  if (!text.trim()) return [];
  const { charsP75, charsP90, charsMax } = fp.length;
  const limit = Math.max(12, charsP90);
  const sentences = splitSentences(text)
    .map((s) => (s.length > charsMax ? cutAtClause(s, Math.max(12, charsP75)) : s))
    .filter(Boolean);
  if (sentences.length === 0) return [];

  const target = sampleBurstCount(fp, rng, maxBursts);
  // Greedily merge sentences into `target` bursts while respecting the limit.
  const bursts: string[] = [];
  for (const s of sentences) {
    const last = bursts[bursts.length - 1];
    if (last !== undefined && bursts.length >= target && `${last} ${s}`.length <= limit) {
      bursts[bursts.length - 1] = `${last} ${s}`;
    } else if (last !== undefined && bursts.length < target && last.length + s.length + 1 <= limit && sentences.length > target && bursts.length + (sentences.length - sentences.indexOf(s)) > target) {
      bursts[bursts.length - 1] = `${last} ${s}`;
    } else {
      bursts.push(s);
    }
  }
  // Content that doesn't fit into maxBursts is dropped: a texter says less, not more.
  return bursts.slice(0, maxBursts).map((b) => truncateAtWord(b, limit)).filter((b) => b.length > 0);
}

/** c. Punctuation habits. */
export function applyPunctuation(bursts: string[], fp: StyleFingerprint, rng: Rng): string[] {
  const p = fp.punctuation;
  const exclaimIdx = p.exclamationRate > 0.15 && rng() < 0.4 ? Math.floor(rng() * bursts.length) : -1;
  return bursts.map((b, i) => {
    let t = b;
    if (p.terminalPeriodRate < 0.2) {
      if (p.ellipsisRate > 0.05) t = t.replace(/(?<!\.)\.$/, "");
      else t = t.replace(/(\.{2,}|…|\.)$/, "");
      // Also drop periods that ended sentences merged inside one burst.
      t = t.replace(/(?<!\.)\.(\s)/g, "$1");
    }
    if (p.commaRate < 0.1) t = t.replace(/,\s*(?=[a-z])/gi, " ").replace(/,$/g, "");
    if (i === exclaimIdx && /!$/.test(t)) t = t.replace(/!$/, "!!");
    if (p.apostropheDropRate > 0.5) {
      t = t.replace(/\b(don|i|can|didn|that|you|won|isn)['’](t|m|s|re|ve)\b/gi, (m) => {
        const key = m.toLowerCase().replace("’", "'");
        const dropped = CONTRACTIONS[key];
        return dropped ? matchCase(m, dropped) : m.replace(/['’]/g, "");
      });
    }
    return t.replace(/\s+/g, " ").trim();
  });
}

function matchCase(original: string, replacement: string): string {
  if (original[0] === original[0]?.toUpperCase() && original[0] !== original[0]?.toLowerCase()) {
    return replacement[0]!.toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** d. Capitalization habits. Emoji and URLs are left alone. */
export function applyCapitalization(bursts: string[], fp: StyleFingerprint): string[] {
  const c = fp.capitalization;
  return bursts.map((b) => {
    let t = b;
    if (c.allLowercaseRate > 0.7) {
      t = t.split(/(\s+)/).map((w) => (/^https?:\/\//i.test(w) || isEmoji(w) ? w : w.toLowerCase())).join("");
    } else if (c.lowercaseIRate > 0.7) {
      t = t.replace(/(^|\s)I(?=\s|$|')/g, "$1i");
    }
    return t;
  });
}

const LAUGH_RE = /\b(lol|lmao|lmfao|haha(?:ha)*|hehe(?:he)*|rofl)\b/gi;

/** e. Lexical tics: laugh word, affirmative, abbreviations, pet name. */
export function applyLexicon(bursts: string[], fp: StyleFingerprint, rng: Rng): string[] {
  const lex = fp.lexicon;
  const abbr = new Set([...lex.abbreviations, ...lex.signaturePhrases]);
  let out = bursts.map((b) => {
    let t = b;
    if (lex.laugh) t = t.replace(LAUGH_RE, (m) => matchCase(m, lex.laugh!));
    if (lex.affirmative) t = t.replace(/^(yes|yeah|yep|yup)\b/i, (m) => matchCase(m, lex.affirmative!));
    if (abbr.has("omw")) t = t.replace(/\bon my way\b/gi, (m) => matchCase(m, "omw"));
    if (abbr.has("okok")) t = t.replace(/\b(ok|okay)\b/gi, (m) => matchCase(m, "okok"));
    if (abbr.has("u")) t = t.replace(/\byou\b/gi, (m) => matchCase(m, "u"));
    if (abbr.has("ur")) t = t.replace(/\byour\b/gi, (m) => matchCase(m, "ur"));
    if (abbr.has("rn")) t = t.replace(/\bright now\b/gi, "rn");
    if (abbr.has("idk")) t = t.replace(/\bi don'?t know\b/gi, "idk");
    if (abbr.has("tho")) t = t.replace(/\bthough\b/gi, "tho");
    return t;
  });
  const pet = lex.petNames[0];
  if (pet && out.length > 0) {
    const hasPet = out.some((b) => new RegExp(`\\b${pet}\\b`, "i").test(b));
    if (!hasPet && rng() < 0.35) {
      const idx = rng() < 0.5 ? 0 : out.length - 1;
      const b = out[idx]!;
      const trailing = b.match(/[!?]+$/)?.[0] ?? "";
      out[idx] = `${b.slice(0, b.length - trailing.length).replace(/[.,]$/, "")} ${pet}${trailing}`;
    }
  }
  return out;
}

const STRETCHABLE: Record<string, string> = { so: "soooo", hey: "heyyy", no: "nooo", yes: "yesss", omg: "omggg", please: "pleasee", yay: "yayyy", aw: "awww" };

/** f. Strategic imperfection: one stretch, at most one emoji. */
export function injectImperfection(bursts: string[], fp: StyleFingerprint, rng: Rng): string[] {
  if (bursts.length === 0) return bursts;
  let out = [...bursts];
  if (rng() < fp.lexicon.stretchRate) {
    for (let i = 0; i < out.length; i++) {
      const re = /\b(so|hey|no|yes|omg|please|yay|aw)\b/i;
      const m = out[i]!.match(re);
      if (m) {
        out[i] = out[i]!.replace(re, matchCase(m[0], STRETCHABLE[m[0].toLowerCase()]!));
        break;
      }
    }
  }
  if (fp.emoji.top.length > 0 && !out.some((b) => extractEmoji(b).length > 0)) {
    for (let i = 0; i < out.length; i++) {
      if (rng() < fp.emoji.perMessage) {
        const e = fp.emoji.top[Math.floor(rng() * fp.emoji.top.length)]!;
        out[i] = `${out[i]} ${e}`;
        break;
      }
    }
  }
  return out;
}

export class StyleEnforcer {
  private readonly fp: StyleFingerprint;
  private readonly seed: number;
  private readonly maxBursts: number;

  constructor(fp: StyleFingerprint, opts: EnforcerOptions = {}) {
    this.fp = fp;
    this.seed = opts.seed ?? 1;
    this.maxBursts = opts.maxBursts ?? 4;
  }

  /** Turn one LLM paragraph into the person's bursts. Empty input → []. */
  enforce(raw: string): string[] {
    const rng = makeRng(this.seed);
    const text = normalizeLlmOutput(raw);
    if (!text) return [];
    let bursts = splitIntoBursts(text, this.fp, rng, this.maxBursts);
    bursts = applyPunctuation(bursts, this.fp, rng);
    bursts = applyCapitalization(bursts, this.fp);
    bursts = applyLexicon(bursts, this.fp, rng);
    bursts = injectImperfection(bursts, this.fp, rng);
    return bursts.map((b) => b.trim()).filter((b) => b.length > 0);
  }

  /** Per-burst delays in ms: typing time first, then the person's gap rhythm. */
  burstDelaysMs(bursts: string[]): number[] {
    const rng = makeRng(this.seed ^ 0x9e3779b9);
    const { charsPerSecond, medianGapMs } = this.fp.bursts;
    return bursts.map((b, i) => {
      if (i === 0) return Math.round(900 + (b.length / charsPerSecond) * 1000);
      const jitter = 0.6 + rng() * 0.8;
      return Math.round(Math.min(4000, Math.max(600, medianGapMs * jitter)));
    });
  }

  describe(): string {
    const f = this.fp;
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    const parts = [
      `${f.sampleSize} msgs`,
      `median ${f.length.charsP50} chars (p90 ${f.length.charsP90})`,
      `lowercase ${pct(f.capitalization.allLowercaseRate)}`,
      `ends with period ${pct(f.punctuation.terminalPeriodRate)}`,
      `bursts of ~${f.bursts.meanSize.toFixed(1)}`,
      f.lexicon.laugh ? `laughs "${f.lexicon.laugh}"` : "no laugh word",
      f.lexicon.petNames.length ? `pet name "${f.lexicon.petNames[0]}"` : null,
      f.emoji.top.length ? `emoji ${f.emoji.top.slice(0, 3).join("")}` : "no emoji",
      f.greetings.length ? `opens with "${f.greetings[0]}"` : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }
}
