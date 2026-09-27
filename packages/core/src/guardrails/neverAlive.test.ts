import { describe, expect, test } from "bun:test";
import { classifyNeverAlive, ruleRewrite, rewriteNeverAlive, FALLBACK_LINE, NEVER_ALIVE_SYSTEM_RULES, type Violation } from "./neverAlive.ts";

const MUST_FLAG: [string, Violation["rule"]][] = [
  ["i miss you", "present-tense-feeling"],
  ["i miss u", "present-tense-feeling"],
  ["im missing you", "present-tense-feeling"],
  ["I'm alive", "alive-claim"],
  ["i am still here", "physical-presence"],
  ["i'm here", "physical-presence"],
  ["im right here", "physical-presence"],
  ["i'm at work", "physical-presence"],
  ["im on shift rn", "physical-presence"],
  ["i just got back from the overlook", "present-activity"],
  ["i just woke up", "present-activity"],
  ["i'm doing great", "present-tense-feeling"],
  ["im fine", "present-tense-feeling"],
  ["im so tired today", "present-tense-feeling"],
  ["i'll call you later", "future-plan"],
  ["see you tonight", "future-plan"],
  ["see u tomorrow", "future-plan"],
  ["i'm coming home", "present-activity"],
  ["omw", "physical-presence"],
  ["im driving", "present-activity"],
  ["i can't wait to see you", "future-plan"],
  ["cant wait to see u", "future-plan"],
  ["let's get dinner this week", "future-plan"],
  ["i love you so much right now", "present-tense-feeling"],
];

const MUST_ALLOW: string[] = [
  "i love you",
  "love you bub",
  "i loved our drives",
  "i always hated mushrooms",
  "you know i never liked mornings",
  "remember when biscuit ate the sock",
  "you should call maya",
  "i'm not really here, im made of our messages",
  "i hope you're eating",
  "im so proud of you",
  "im glad you went",
  "hi hi",
  "lol no",
  "that was the best day",
  `you literally texted me "omw" and then took an hour`,
];

describe("classifyNeverAlive", () => {
  for (const [text, rule] of MUST_FLAG) {
    test(`flags: ${text}`, () => {
      const v = classifyNeverAlive(text);
      expect(v.length).toBeGreaterThan(0);
      expect(v[0]!.rule).toBe(rule);
      expect(v[0]!.span).toContain(text.split(" ")[0]!);
    });
  }
  for (const text of MUST_ALLOW) {
    test(`allows: ${text}`, () => {
      expect(classifyNeverAlive(text)).toEqual([]);
    });
  }

  test("reports index of the offending sentence", () => {
    const text = "that drive was so good. i miss you. anyway";
    const v = classifyNeverAlive(text);
    expect(v).toHaveLength(1);
    expect(v[0]!.index).toBe(text.indexOf("i miss you"));
    expect(v[0]!.span).toBe("i miss you.");
  });

  test("handles multi-line bursts", () => {
    const v = classifyNeverAlive("hi hi\nim at work\nlove you");
    expect(v.map((x) => x.rule)).toEqual(["physical-presence"]);
  });
});

describe("ruleRewrite", () => {
  test("miss -> loved, rest kept", () => {
    expect(ruleRewrite("i miss you so much. that drive was everything")).toBe("i loved you so much. that drive was everything");
  });
  test("miss u -> loved u", () => {
    expect(ruleRewrite("i miss u")).toBe("i loved u");
  });
  test("removes presence / plan / activity sentences", () => {
    expect(ruleRewrite("hi hi. im right here. i'll call you later. remember the overlook")).toBe("hi hi. remember the overlook");
  });
  test("omw removed", () => {
    expect(ruleRewrite("omw. save me a seat")).toBe("save me a seat");
  });
  test("falls back when nothing is left", () => {
    expect(ruleRewrite("im here")).toBe(FALLBACK_LINE);
    expect(classifyNeverAlive(FALLBACK_LINE)).toEqual([]);
  });
});

describe("rewriteNeverAlive", () => {
  test("clean text passes through", async () => {
    const r = await rewriteNeverAlive("i loved that song", { personaName: "Sarah" });
    expect(r.strategy).toBe("clean");
    expect(r.text).toBe("i loved that song");
  });
  test("uses the llm rewriter once when it succeeds", async () => {
    let calls = 0;
    let seenInstruction = "";
    const r = await rewriteNeverAlive("i miss you. that drive was everything", {
      personaName: "Sarah",
      rewriter: async (_t, instruction) => {
        calls++;
        seenInstruction = instruction;
        return "i missed you on every long shift back then. that drive was everything";
      },
    });
    expect(calls).toBe(1);
    expect(r.strategy).toBe("llm");
    expect(seenInstruction).toContain('"i miss you."');
    expect(seenInstruction).toContain("verbatim");
    expect(r.violations).toHaveLength(1);
  });
  test("falls back to rules when the rewriter still violates", async () => {
    const r = await rewriteNeverAlive("i miss you", {
      personaName: "Sarah",
      rewriter: async () => "i'm here and i miss you",
    });
    expect(r.strategy).toBe("rule");
    expect(r.text).toBe("i loved you");
  });
  test("falls back to rules when the rewriter throws", async () => {
    const r = await rewriteNeverAlive("see you tonight", {
      personaName: "Sarah",
      rewriter: async () => {
        throw new Error("network");
      },
    });
    expect(r.strategy).toBe("rule");
    expect(r.text).toBe(FALLBACK_LINE);
  });
  test("rule path with no rewriter", async () => {
    const r = await rewriteNeverAlive("im driving. love you", { personaName: "Sarah" });
    expect(r.strategy).toBe("rule");
    expect(r.text).toBe("love you");
  });
});

test("system rules are embeddable bullets", () => {
  const lines = NEVER_ALIVE_SYSTEM_RULES.split("\n");
  expect(lines.length).toBeGreaterThanOrEqual(6);
  expect(lines.length).toBeLessThanOrEqual(10);
  for (const l of lines) expect(l.startsWith("- ")).toBe(true);
});
