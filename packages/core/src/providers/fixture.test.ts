import { describe, expect, test } from "bun:test";
import type { Message } from "../types.ts";
import { FixtureProvider, buildReplyPairs } from "./fixture.ts";

const t = (sender: "them" | "me", text: string, min: number): Message => ({
  sender,
  text,
  timestamp: new Date(Date.UTC(2025, 5, 10, 17, min)).toISOString(),
});

const corpus: Message[] = [
  t("them", "hi hi", 0),
  t("them", "running late to dani", 1),
  t("me", "Of course you are. Want me to grab dog food?", 2),
  t("them", "ya please", 3),
  t("them", "biscuit ate the last of it", 4),
  t("me", "How was the shift?", 30),
  t("them", "brutal", 31),
  t("them", "going on a drive after", 32),
];

describe("buildReplyPairs", () => {
  test("pairs joined user prompts with the following reply burst", () => {
    const pairs = buildReplyPairs(corpus);
    expect(pairs.length).toBe(2);
    expect(pairs[0]!.prompt).toContain("dog food");
    expect(pairs[0]!.reply).toEqual(["ya please", "biscuit ate the last of it"]);
    expect(pairs[1]!.reply).toEqual(["brutal", "going on a drive after"]);
  });
});

describe("FixtureProvider", () => {
  test("answers with the reply to the most similar past prompt", async () => {
    const p = new FixtureProvider(corpus, "Sarah");
    const out = await p.complete({ system: "", turns: [{ role: "user", content: "how was your shift tonight?" }] });
    expect(out).toBe("brutal. going on a drive after");
  });

  test("is deterministic with no overlap", async () => {
    const p = new FixtureProvider(corpus, "Sarah");
    const a = await p.complete({ system: "", turns: [{ role: "user", content: "zzz qqq" }] });
    const b = await p.complete({ system: "", turns: [{ role: "user", content: "zzz qqq" }] });
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  test("rejects a corpus without reply pairs", () => {
    expect(() => new FixtureProvider([t("them", "hi", 0)])).toThrow();
  });
});
