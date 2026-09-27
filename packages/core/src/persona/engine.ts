import type { MemoryHit, Message, PersonaProfile } from "../types.ts";
import type { MemoryStore } from "../memory/store.ts";
import type { ModelProvider, ChatTurn } from "../providers/types.ts";
import { computeFingerprint, type StyleFingerprint } from "../stylometry/fingerprint.ts";
import { StyleEnforcer } from "../style/enforcer.ts";
import { classifyInContext, classifyNeverAlive, rewriteNeverAlive, TIMELESS_LINE, type Violation } from "../guardrails/neverAlive.ts";
import { canPersonaSpeak, recordTurn, type SessionState } from "../guardrails/noInitiate.ts";
import { DependencyMonitor, fallbackNudgeLine } from "../guardrails/dependencyMonitor.ts";
import { crisisResponse, detectCrisis, type CrisisResponse } from "../guardrails/crisisBypass.ts";
import { buildSystemPrompt, pickExamples } from "./prompt.ts";

export interface PersonaReply {
  kind: "reply";
  bursts: string[];
  delaysMs: number[];
  memoriesUsed: MemoryHit[];
  guardrails: {
    neverAlive: { strategy: "clean" | "llm" | "rule"; violations: Violation[] };
    dependency: "ok" | "nudge" | "strong";
  };
  provider: { id: ModelProvider["id"]; label: string; ownedModel: boolean };
  raw: string;
}

export interface PersonaBlocked {
  kind: "blocked";
  reason: string;
}

export type EngineResult = PersonaReply | PersonaBlocked | CrisisResponse;

export interface EngineDeps {
  profile: PersonaProfile;
  corpus: Message[];
  memory: MemoryStore;
  provider: ModelProvider;
  monitor?: DependencyMonitor;
  /** Real people the nudge can point at (from the brain, e.g. ["maya"]). */
  realPeople?: string[];
  now?: () => Date;
  seed?: number;
  log?: (event: string, data: Record<string, unknown>) => void;
}

export interface ConversationSession {
  state: SessionState;
  turns: ChatTurn[];
}

/**
 * The PersonaEngine turns a user message into an in-character burst of
 * texts. Order matters and is fixed:
 *   crisis check -> noInitiate -> memory recall -> prompt -> model ->
 *   neverAlive rewrite -> StyleEnforcer -> greeting -> delays.
 */
export class PersonaEngine {
  readonly fingerprint: StyleFingerprint;
  readonly enforcer: StyleEnforcer;
  private readonly monitor: DependencyMonitor;
  private readonly examples: string[];
  private readonly now: () => Date;
  private readonly log: NonNullable<EngineDeps["log"]>;

  constructor(private readonly deps: EngineDeps) {
    this.fingerprint = computeFingerprint(deps.corpus);
    this.enforcer = new StyleEnforcer(this.fingerprint, { seed: deps.seed ?? 7 });
    this.monitor = deps.monitor ?? new DependencyMonitor(undefined, deps.now);
    this.examples = pickExamples(deps.corpus);
    this.now = deps.now ?? (() => new Date());
    this.log = deps.log ?? (() => {});
  }

  get entitySlug(): string {
    return `people/${this.deps.profile.slug}`;
  }

  /** The greeting this person actually used to open conversations, if the corpus shows one. */
  greeting(): string | null {
    return this.fingerprint.greetings[0] ?? null;
  }

  async reply(session: ConversationSession, userText: string): Promise<EngineResult> {
    const at = this.now().toISOString();
    const text = userText.trim();
    if (!text) return { kind: "blocked", reason: "empty message" };

    // 1. Crisis: the persona steps aside entirely.
    const crisis = detectCrisis(text);
    if (crisis.crisis) {
      this.log("crisis", { matched: crisis.matched });
      return crisisResponse(this.deps.profile.name);
    }

    // 2. noInitiate: the persona only ever answers a user turn.
    session.state = recordTurn(session.state, "user", at);
    session.turns.push({ role: "user", content: text });
    this.monitor.record({ sessionId: session.state.id, at, role: "user" });
    const speak = canPersonaSpeak(session.state);
    if (!speak.allowed) return { kind: "blocked", reason: speak.reason ?? "persona may not speak" };

    // 3. Memory: every reply retrieves through MemoryStore and logs what was used.
    const memories = await this.deps.memory.recall(text, { entity: this.entitySlug, limit: 6 });
    this.log("recall", { query: text, hits: memories.map((m) => ({ id: m.id, source: m.source })) });

    // 4. Dependency monitor: in-character nudge directive, if any.
    const assessment = this.monitor.assess(session.state.id);
    const nudge = this.monitor.nudgeDirective(session.state.id, this.deps.profile.name, this.deps.realPeople ?? []);

    // 5. Model.
    const system = buildSystemPrompt({
      profile: this.deps.profile,
      fingerprint: this.fingerprint,
      styleSummary: this.enforcer.describe(),
      examples: this.examples,
      memories,
      nudge,
      now: this.now(),
    });
    let raw = await this.deps.provider.complete({ system, turns: session.turns });
    if (this.deps.provider.id === "fixture" && assessment.level !== "ok") {
      raw = `${raw}. ${fallbackNudgeLine(assessment.level, this.deps.realPeople ?? [])}`;
    }

    // 6. neverAlive: classify, rewrite (LLM when we have one, rules otherwise).
    const rewriter =
      this.deps.provider.id === "fixture"
        ? undefined
        : (t: string, instruction: string) =>
            this.deps.provider.complete({ system: instruction, turns: [{ role: "user", content: t }], maxTokens: 300 });
    const guarded = await rewriteNeverAlive(raw, { personaName: this.deps.profile.name, rewriter });
    // A bare "ya" to "do you miss me" carries no verb but is still a present-tense claim.
    const contextual = classifyInContext(text, guarded.text);
    if (contextual) {
      guarded.violations = [...guarded.violations, contextual];
      guarded.strategy = "rule";
      guarded.text = guarded.text.replace(contextual.span, TIMELESS_LINE);
    }
    if (guarded.violations.length) this.log("neverAlive", { strategy: guarded.strategy, violations: guarded.violations });

    // 7. Mechanical layer: the StyleEnforcer makes it read like their texting.
    let bursts = this.enforcer.enforce(guarded.text);
    if (bursts.length === 0) bursts = this.enforcer.enforce(raw);
    if (bursts.length === 0) return { kind: "blocked", reason: "model produced no usable text" };

    // 8. Corpus-derived greeting on the first reply of a session.
    const isFirstReply = !session.state.messages.some((m) => m.role === "persona");
    const greeting = this.greeting();
    if (isFirstReply && greeting && !bursts[0]!.toLowerCase().startsWith(greeting)) {
      bursts = [greeting, ...bursts].slice(0, 4);
    }
    // Final safety: nothing that slipped through the rewrite may ship.
    bursts = bursts.filter((b) => classifyNeverAlive(b).length === 0);
    if (bursts.length === 0) bursts = [greeting ?? "i dont know what to say to that"];

    const delaysMs = this.enforcer.burstDelaysMs(bursts);
    session.state = recordTurn(session.state, "persona", this.now().toISOString());
    session.turns.push({ role: "assistant", content: bursts.join("\n") });
    this.monitor.record({ sessionId: session.state.id, at: this.now().toISOString(), role: "persona" });

    return {
      kind: "reply",
      bursts,
      delaysMs,
      memoriesUsed: memories,
      guardrails: {
        neverAlive: { strategy: guarded.strategy, violations: guarded.violations },
        dependency: assessment.level,
      },
      provider: { id: this.deps.provider.id, label: this.deps.provider.label, ownedModel: this.deps.provider.ownedModel },
      raw,
    };
  }
}
