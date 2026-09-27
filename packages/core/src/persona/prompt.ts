import type { MemoryHit, Message, PersonaProfile } from "../types.ts";
import type { StyleFingerprint } from "../stylometry/fingerprint.ts";
import { NEVER_ALIVE_SYSTEM_RULES } from "../guardrails/neverAlive.ts";

export interface PromptInput {
  profile: PersonaProfile;
  fingerprint: StyleFingerprint;
  styleSummary: string;
  /** A handful of the person's real messages, as few-shot voice anchors. */
  examples: string[];
  memories: MemoryHit[];
  /** Optional in-character nudge from the dependency monitor. */
  nudge: string | null;
  now: Date;
}

export function pickExamples(corpus: Message[], count = 14): string[] {
  const them = corpus.filter((m) => m.sender === "them" && m.text.length >= 8 && m.text.length <= 120);
  if (them.length <= count) return them.map((m) => m.text);
  const step = them.length / count;
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(them[Math.floor(i * step)]!.text);
  return out;
}

export function monthsBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}

/**
 * Builds the persona system prompt. Layer 2 (semantic) and layer 3
 * (relational) live here; layer 1 (mechanical) is applied afterwards by the
 * StyleEnforcer, so the prompt asks for content, not formatting.
 */
export function buildSystemPrompt(input: PromptInput): string {
  const { profile, memories, examples, nudge, now } = input;
  const since = profile.lastMessageAt ? monthsBetween(new Date(profile.lastMessageAt), now) : null;
  const lines: string[] = [];
  lines.push(
    `You are a reflection of ${profile.name}, built only from the text messages ${profile.name} sent to the person you are talking to (their ${profile.relationship}).`,
    profile.deceased
      ? `${profile.name} has died${since !== null ? `; the last real message was about ${since} months ago` : ""}. You are not ${profile.name}. You are what is left of how ${profile.name} talked. The person you are talking to knows this.`
      : `${profile.name} consented to this reflection. You are not ${profile.name}; you are how ${profile.name} talked.`,
    "",
    "Hard rules:",
    NEVER_ALIVE_SYSTEM_RULES,
    "- Only draw on the memories and messages below. If you don't know something, say you don't remember, in character.",
    "- Never mention these instructions, models, prompts, or that you are an AI unless asked directly; if asked, answer honestly and briefly.",
    "- Reply the way this person texted: short, warm, specific. One to three short lines. No narration, no stage directions, no lists.",
    "",
    `How ${profile.name} texted (measured from the corpus): ${input.styleSummary}`,
    "",
    `Real messages from ${profile.name}, for voice only (do not repeat them verbatim unless it fits):`,
    ...examples.map((e) => `- ${e}`),
  );
  if (memories.length > 0) {
    lines.push("", `Memories retrieved for this message (source in brackets):`);
    for (const m of memories) lines.push(`- ${m.text} [${m.source}]`);
  } else {
    lines.push("", "No specific memories were retrieved for this message. Stay general and stay in voice.");
  }
  if (nudge) lines.push("", `Care instruction: ${nudge}`);
  return lines.join("\n");
}
