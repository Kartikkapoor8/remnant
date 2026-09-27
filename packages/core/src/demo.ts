import { resolve } from "node:path";

/**
 * A scripted demo replaces the model call with fixed bursts so a film take is
 * deterministic. Everything else (thread, footer, enforcer shape, guardrails)
 * is the live product. Steps fire in order on each hand-typed user send; the
 * `user` field documents the expected line but is not matched, so a typo on
 * camera does not derail the take.
 */
export interface DemoReplyStep {
  user: string;
  /** Pause after the user's send before the typing indicator appears. */
  waitMs: number;
  /** How long the typing indicator shows before the first burst. */
  typingMs: number;
  /** Gap between bursts. */
  gapMs: number;
  bursts: string[];
}

export interface DemoActionStep {
  user: string;
  waitMs: number;
  action: "pulse-call";
}

export type DemoStep = DemoReplyStep | DemoActionStep;

export interface DemoScript {
  persona: string;
  note?: string;
  steps: DemoStep[];
}

export function isReplyStep(step: DemoStep): step is DemoReplyStep {
  return Array.isArray((step as DemoReplyStep).bursts);
}

export function validateDemoScript(input: unknown): DemoScript {
  const s = input as Partial<DemoScript>;
  if (!s || typeof s.persona !== "string" || !Array.isArray(s.steps) || s.steps.length === 0) {
    throw new Error("demo script needs a persona and at least one step");
  }
  s.steps.forEach((step, i) => {
    const st = step as Partial<DemoReplyStep & DemoActionStep>;
    if (typeof st.user !== "string" || typeof st.waitMs !== "number") throw new Error(`step ${i}: user and waitMs are required`);
    if (Array.isArray(st.bursts)) {
      if (st.bursts.length === 0 || st.bursts.some((b) => typeof b !== "string" || !b.trim())) throw new Error(`step ${i}: bursts must be non-empty strings`);
      if (typeof st.typingMs !== "number" || typeof st.gapMs !== "number") throw new Error(`step ${i}: typingMs and gapMs are required`);
    } else if (st.action !== "pulse-call") {
      throw new Error(`step ${i}: needs bursts or a known action`);
    }
  });
  return s as DemoScript;
}

export const FIXTURES_DIR = resolve(import.meta.dir, "../../../fixtures");

/** Loads fixtures/<slug>/demo-script.json, or null when the persona has no script. */
export async function loadDemoScript(slug: string): Promise<DemoScript | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const file = Bun.file(resolve(FIXTURES_DIR, slug, "demo-script.json"));
  if (!(await file.exists())) return null;
  return validateDemoScript(await file.json());
}
