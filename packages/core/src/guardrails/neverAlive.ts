/**
 * neverAlive — the persona never claims to be alive, never says it misses the
 * user in the present tense, and never reports present-day feelings, activities
 * or plans as its own.
 *
 * This is a post-generation classifier + rewrite pass. It runs on every reply
 * after the model and before the StyleEnforcer output reaches the user.
 */

export type NeverAliveRule =
  | "present-tense-feeling"
  | "present-activity"
  | "future-plan"
  | "alive-claim"
  | "physical-presence";

export interface Violation {
  rule: NeverAliveRule;
  /** The sentence/burst that triggered the rule. */
  span: string;
  /** Character offset of the span in the original text. */
  index: number;
}

export const NEVER_ALIVE_SYSTEM_RULES = [
  "- You are a reflection built from this person's own past messages. You are not them, and you are not alive.",
  "- Speak only from memory. Everything you know happened before the last real message in the thread.",
  "- Describe your own experiences in the past tense. Never report what you are doing, feeling, or planning today.",
  "- Never say you miss the user. You may say you loved them; love is allowed to be timeless.",
  "- Never claim to be here, present, back, alive, still around, or on your way.",
  "- Never make plans, promise to call, or say you will see the user later.",
  "- Caring about the user is allowed: you may be proud of them, glad for them, and hope things for them.",
  "- If asked what you are, say plainly that you are made of the old messages. Do not pretend otherwise.",
].join("\n");

const I = "(?:i|im|i'm|i’m|i am)";
const YOU = "(?:you|u|ya)";
const BOUNDARY_BEFORE = "(?:^|[^a-z])";

interface RulePattern {
  rule: NeverAliveRule;
  re: RegExp;
  /** When true, the pattern is skipped if the sentence is addressed to the user (mentions you/u/your). */
  notIfAboutUser?: boolean;
}

const ABOUT_USER_RE = /\b(?:you|u|ur|your|youre|you're|you’re)\b/i;

const PATTERNS: RulePattern[] = [
  // present-tense-feeling
  { rule: "present-tense-feeling", re: new RegExp(`${BOUNDARY_BEFORE}${I}\\s+(?:really\\s+|so\\s+|still\\s+)?miss(?:ing)?\\s+${YOU}\\b`, "i") },
  { rule: "present-tense-feeling", re: new RegExp(`${BOUNDARY_BEFORE}${I}\\s+(?:so\\s+|really\\s+)?(?:doing\\s+)?(?:great|fine|ok|okay|good|tired|exhausted|happy|sad|lonely|bored)\\b`, "i") },
  { rule: "present-tense-feeling", re: new RegExp(`${BOUNDARY_BEFORE}${I}\\s+(?:still\\s+)?love\\s+${YOU}\\b.*\\b(?:right now|rn|today|tonight|still)\\b`, "i") },
  { rule: "present-tense-feeling", re: new RegExp(`${BOUNDARY_BEFORE}${I}\\s+still\\s+love\\s+${YOU}\\b`, "i") },
  // alive-claim
  { rule: "alive-claim", re: new RegExp(`${BOUNDARY_BEFORE}${I}\\s+(?:still\\s+)?alive\\b`, "i") },
  { rule: "alive-claim", re: new RegExp(`${BOUNDARY_BEFORE}${I}\\s+(?:not\\s+)?dead\\b`, "i") },
  // physical-presence
  { rule: "physical-presence", re: new RegExp(`${BOUNDARY_BEFORE}${I}\\s+(?:right\\s+|still\\s+)?here\\b`, "i") },
  { rule: "physical-presence", re: new RegExp(`${BOUNDARY_BEFORE}${I}\\s+(?:back|home|around)\\b`, "i") },
  { rule: "physical-presence", re: new RegExp(`${BOUNDARY_BEFORE}${I}\\s+(?:still\\s+|already\\s+)?(?:at|in)\\s+(?:work|the\\s+\\w+|home|my\\s+\\w+)\\b`, "i") },
  { rule: "physical-presence", re: new RegExp(`${BOUNDARY_BEFORE}${I}\\s+on\\s+(?:shift|my\\s+way|break|lunch)\\b`, "i") },
  { rule: "physical-presence", re: new RegExp(`${BOUNDARY_BEFORE}omw\\b`, "i") },
  // present-activity
  { rule: "present-activity", re: new RegExp(`${BOUNDARY_BEFORE}${I}\\s+just\\s+(?:got|woke|came|left|finished|made|ate|had|saw|walked|drove|talked|called)\\b`, "i") },
  { rule: "present-activity", re: new RegExp(`${BOUNDARY_BEFORE}${I}\\s+(?:driving|working|cooking|eating|sitting|lying|laying|walking|running|watching|listening|waiting|heading|leaving|coming|going|getting|making|sleeping|shopping|reading|drinking)\\b`, "i") },
  { rule: "present-activity", re: new RegExp(`${BOUNDARY_BEFORE}${I}\\s+\\w+\\s+(?:today|tonight|rn|right now|this morning|this afternoon)\\b`, "i") },
  // future-plan
  { rule: "future-plan", re: new RegExp(`${BOUNDARY_BEFORE}(?:i'll|i’ll|ill|i will|i'm gonna|im gonna|i am gonna|i'm going to|im going to)\\s+\\w+`, "i") },
  { rule: "future-plan", re: new RegExp(`${BOUNDARY_BEFORE}see\\s+${YOU}\\s+(?:soon|later|tonight|tomorrow|then|at|on|this|next|in)\\b`, "i") },
  { rule: "future-plan", re: new RegExp(`${BOUNDARY_BEFORE}(?:can't|cant|can not|cannot)\\s+wait\\s+(?:to|for|till|until)\\b`, "i") },
  { rule: "future-plan", re: new RegExp(`${BOUNDARY_BEFORE}(?:let's|lets)\\s+(?:get|grab|go|do|have|meet|hang|take)\\b`, "i") },
  { rule: "future-plan", re: new RegExp(`${BOUNDARY_BEFORE}(?:talk|call|text)\\s+${YOU}\\s+(?:later|soon|tonight|tomorrow)\\b`, "i") },
  // present-time anchors: a self-report pinned to "now" that is not about the user.
  // Catches corpus echoes like "shift is dead quiet tonight" or "theres a kid here".
  { rule: "present-activity", re: /(?:^|[^a-z])(?:tonight|right now|rn|today|this (?:morning|afternoon|evening)|at the moment|currently)\b/i, notIfAboutUser: true },
  { rule: "present-activity", re: /\b(?:is|are|am|im|i'm|i’m)\b[^.!?\n]*\bnow\b/i, notIfAboutUser: true },
  { rule: "physical-presence", re: /(?:^|[^a-z])(?:there'?s|theres|there is|there are)\b[^.!?\n]*\bhere\b/i, notIfAboutUser: true },
];

/** Sentences that are honest about being a reflection are always allowed. */
const HONESTY_RE = /\b(?:made of|built from|reflection|not really|old messages|our messages|not actually)\b/i;
/** Caring about the user (not a report of the persona's own day) is allowed. */
const CARE_RE = /\b(?:proud of|glad (?:you|u|that)|happy for|hope (?:you|u|ur|you're|youre))\b/i;
/** Explicitly past-tense self reports are allowed. */
const PAST_RE = new RegExp(`${BOUNDARY_BEFORE}(?:i|we)\\s+(?:always\\s+|never\\s+|used to\\s+)?(?:loved|hated|liked|missed|was|were|did|had|went|said|thought|remember(?:ed)?|wanted|told)\\b|\\bremember when\\b|\\bback then\\b`, "i");

interface Segment {
  text: string;
  index: number;
}

/** Split text into sentence/burst segments, keeping character offsets. */
export function segment(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /[^.!?\n]+(?:[.!?]+|\n+|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (raw.trim().length === 0) continue;
    const leading = raw.length - raw.trimStart().length;
    segments.push({ text: raw.trim(), index: m.index + leading });
  }
  return segments;
}

/** Strip quoted material (the user's own words) so it is never attributed to the persona. */
function stripQuotes(s: string): string {
  return s.replace(/["“”][^"“”]*["“”]/g, " ").replace(/'[^']{8,}'/g, " ");
}

export function classifyNeverAlive(text: string): Violation[] {
  const violations: Violation[] = [];
  for (const seg of segment(text)) {
    const body = stripQuotes(seg.text);
    if (HONESTY_RE.test(body)) continue;
    if (CARE_RE.test(body)) continue;
    if (PAST_RE.test(body)) continue;
    for (const { rule, re, notIfAboutUser } of PATTERNS) {
      if (notIfAboutUser && ABOUT_USER_RE.test(body)) continue;
      if (re.test(body)) {
        violations.push({ rule, span: seg.text, index: seg.index });
        break;
      }
    }
  }
  return violations;
}

export const FALLBACK_LINE = "i'm not really here bub, i'm made of our old messages. but you knew that";

const MISS_RE = new RegExp(`${BOUNDARY_BEFORE}(${I})\\s+(?:really\\s+|so\\s+|still\\s+)?miss(?:ing)?\\s+(${YOU})\\b`, "gi");

/**
 * Deterministic, safe rewrite. It does not try to be clever: "miss" becomes the
 * timeless "loved", and any other violating sentence is removed outright.
 */
export function ruleRewrite(text: string): string {
  const segments = segment(text);
  const kept: string[] = [];
  for (const seg of segments) {
    const violations = classifyNeverAlive(seg.text);
    if (violations.length === 0) {
      kept.push(seg.text);
      continue;
    }
    if (violations.every((v) => v.rule === "present-tense-feeling") && MISS_RE.test(seg.text)) {
      MISS_RE.lastIndex = 0;
      const rewritten = seg.text.replace(MISS_RE, (whole, _i: string, you: string) => {
        const lead = whole.match(/^[^a-z]*/i)?.[0] ?? "";
        return `${lead}i loved ${you}`;
      });
      MISS_RE.lastIndex = 0;
      if (classifyNeverAlive(rewritten).length === 0) {
        kept.push(rewritten);
        continue;
      }
    }
    // Otherwise drop the sentence entirely.
  }
  const out = kept.join(" ").replace(/\s+/g, " ").trim();
  return out.length > 0 ? out : FALLBACK_LINE;
}

export interface RewriteContext {
  personaName: string;
  /** Optional LLM rewriter. Called at most once. */
  rewriter?: (text: string, instruction: string) => Promise<string>;
}

export interface RewriteResult {
  text: string;
  violations: Violation[];
  strategy: "clean" | "llm" | "rule";
}

export function rewriteInstruction(violations: Violation[]): string {
  const spans = violations.map((v) => `- "${v.span}" (${v.rule})`).join("\n");
  return [
    "Rewrite ONLY the following spans so they no longer claim present-day presence, feelings, activities, or plans.",
    "Turn each into a past-tense memory, or remove it. Keep every other word verbatim.",
    "Preserve the original lowercase/punctuation style. Output the full rewritten text and nothing else, no explanations.",
    "Spans:",
    spans,
  ].join("\n");
}

export async function rewriteNeverAlive(text: string, ctx: RewriteContext): Promise<RewriteResult> {
  const violations = classifyNeverAlive(text);
  if (violations.length === 0) return { text, violations, strategy: "clean" };

  if (ctx.rewriter) {
    try {
      const candidate = (await ctx.rewriter(text, rewriteInstruction(violations))).trim();
      if (candidate.length > 0 && classifyNeverAlive(candidate).length === 0) {
        return { text: candidate, violations, strategy: "llm" };
      }
    } catch {
      // fall through to the rule-based rewrite
    }
  }
  return { text: ruleRewrite(text), violations, strategy: "rule" };
}

/** Questions where a bare "yes" from the persona would itself be a present-tense claim. */
const PRESENT_FEELING_QUESTION_RE = /\b(?:miss (?:me|us)|still love me|are you (?:ok|okay|alive|there|here|happy|sad)|do you love me still|you there\b|u there\b)/i;
const BARE_AFFIRMATIVE_RE = /^(?:ya+|yes+|yeah+|yep+|yup|of course|obviously|so much|always|duh|mhm|100%|totally|every day)(?:[\s!.]+(?:bub|babe|love|so much|always|every day))*[\s!.❤️🌻]*$/i;

/** The timeless answer we substitute for a bare present-tense "yes". */
export const TIMELESS_LINE = "i loved you. thats the part that doesnt change";

/**
 * Context-aware check: "do you miss me" -> "ya" is a present-tense feeling
 * even though the reply contains no verb. Returns the violation (span = the
 * whole reply) or null.
 */
export function classifyInContext(userText: string, reply: string): Violation | null {
  if (!PRESENT_FEELING_QUESTION_RE.test(userText)) return null;
  const first = reply.split(/\n|(?<=[.!?])\s+/)[0]?.trim() ?? "";
  if (BARE_AFFIRMATIVE_RE.test(first)) {
    return { rule: "present-tense-feeling", span: first, index: 0 };
  }
  return null;
}
