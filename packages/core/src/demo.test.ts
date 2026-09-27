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

describe("Sarah call script", () => {
  test("six lines, every spoken line passes neverAlive", async () => {
    const { loadCallScript, stripAudioTags } = await import("./demo.ts");
    const script = await loadCallScript("sarah");
    expect(script).not.toBeNull();
    expect(script!.lines.length).toBe(6);
    expect(script!.model).toBe("eleven_v3");
    expect(script!.lines.map((l) => l.trigger.kind)).toEqual(["after_user", "after_user", "auto", "after_user", "auto", "auto"]);
    expect(script!.lines[0]!.trigger.kind).toBe("after_user"); // the persona never speaks first
    for (const line of script!.lines) {
      const spoken = stripAudioTags(line.text);
      if (!spoken) continue; // a bare [breath]
      expect(classifyNeverAlive(spoken)).toEqual([]);
      expect(detectCrisis(spoken).crisis).toBe(false);
    }
    expect(stripAudioTags("[soft laugh] you said ok, bub.")).toBe("you said ok, bub.");
  });
});
