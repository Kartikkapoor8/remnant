import type { Message } from "../types.ts";
import { significantTokens } from "../memory/store.ts";
import type { CompletionRequest, ModelProvider } from "./types.ts";

/** A reply pair: what the user said, and the burst the person answered with. */
export interface ReplyPair {
  prompt: string;
  reply: string[];
}

/**
 * Builds (user message -> their reply burst) pairs from a corpus. Consecutive
 * 'me' messages are joined; the following consecutive 'them' messages form the
 * reply burst. Pairs with an empty side are dropped.
 */
export function buildReplyPairs(messages: Message[]): ReplyPair[] {
  const pairs: ReplyPair[] = [];
  let prompt: string[] = [];
  let reply: string[] = [];
  const flush = () => {
    if (prompt.length && reply.length) pairs.push({ prompt: prompt.join(" "), reply: [...reply] });
    prompt = [];
    reply = [];
  };
  for (const m of messages) {
    if (m.sender === "me") {
      if (reply.length) flush();
      prompt.push(m.text);
    } else if (prompt.length) {
      reply.push(m.text);
    }
  }
  flush();
  return pairs;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic provider for tests and as the last-resort fallback.
 *
 * It never invents text: it answers with the person's own words, chosen by
 * keyword overlap between the incoming message and the messages they once
 * replied to. With no overlap it picks a reply by a stable hash of the input,
 * so the same conversation always produces the same output.
 */
export class FixtureProvider implements ModelProvider {
  readonly id = "fixture" as const;
  readonly label: string;
  readonly ownedModel = false;
  private readonly pairs: ReplyPair[];

  constructor(corpus: Message[], personaName = "them") {
    this.pairs = buildReplyPairs(corpus);
    this.label = `Fixture (${personaName}'s own messages, no model)`;
    if (this.pairs.length === 0) throw new Error("FixtureProvider needs a corpus with at least one reply pair");
  }

  async complete(req: CompletionRequest): Promise<string> {
    const last = [...req.turns].reverse().find((t) => t.role === "user")?.content ?? "";
    return this.pick(last).join(". ");
  }

  pick(userText: string): string[] {
    const tokens = new Set(significantTokens(userText));
    let best: ReplyPair | null = null;
    let bestScore = 0;
    for (const p of this.pairs) {
      if (tokens.size === 0) break;
      const ptoks = new Set(significantTokens(p.prompt));
      let overlap = 0;
      for (const t of tokens) if (ptoks.has(t)) overlap += 1;
      const score = overlap / Math.sqrt(ptoks.size + 1);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (!best) best = this.pairs[hash(userText) % this.pairs.length]!;
    return best.reply;
  }
}
