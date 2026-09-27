import { describe, expect, test } from "bun:test";
import { loadDemoScript, isReplyStep, validateDemoScript } from "./demo.ts";
import { loadSarahFixture } from "./fixtures.ts";
import { computeFingerprint } from "./stylometry/fingerprint.ts";
import { classifyInContext, classifyNeverAlive } from "./guardrails/neverAlive.ts";
import { detectCrisis } from "./guardrails/crisisBypass.ts";

describe("Sarah demo script", () => {
  test("loads, validates, and ends by pulsing the call button", async () => {
    const script = await loadDemoScript("sarah");
    expect(script).not.toBeNull();
    expect(script!.steps.length).toBe(3);
    const last = script!.steps[2]!;
    expect(isReplyStep(last)).toBe(false);
    expect((last as { action: string }).action).toBe("pulse-call");
    expect(await loadDemoScript("nobody")).toBeNull();
    expect(await loadDemoScript("../etc")).toBeNull();
  });

  test("every scripted burst passes the same guardrails as live output", async () => {
    const script = (await loadDemoScript("sarah"))!;
    for (const step of script.steps) {
      expect(detectCrisis(step.user).crisis).toBe(false);
      if (!isReplyStep(step)) continue;
      const reply = step.bursts.join("\n");
      expect(classifyNeverAlive(reply)).toEqual([]);
      expect(classifyInContext(step.user, reply)).toBeNull();
    }
  });

  test("scripted bursts have the StyleEnforcer output shape for Sarah", async () => {
    const { result } = await loadSarahFixture();
    const fp = computeFingerprint(result.messages);
    const script = (await loadDemoScript("sarah"))!;
    for (const step of script.steps) {
      if (!isReplyStep(step)) continue;
      expect(step.bursts.length).toBeLessThanOrEqual(4);
      for (const b of step.bursts) {
        expect(b).toBe(b.toLowerCase());
        expect(b.endsWith(".")).toBe(false);
        expect(b.length).toBeLessThanOrEqual(fp.length.charsMax);
        expect(/\blol\b/i.test(b)).toBe(false);
      }
    }
  });

  test("validation rejects malformed scripts", () => {
    expect(() => validateDemoScript({ persona: "x", steps: [] })).toThrow();
    expect(() => validateDemoScript({ persona: "x", steps: [{ user: "hi", waitMs: 1, bursts: [] , typingMs: 1, gapMs: 1}] })).toThrow(/bursts/);
    expect(() => validateDemoScript({ persona: "x", steps: [{ user: "hi", waitMs: 1, action: "dance" }] })).toThrow(/action/);
  });
});
