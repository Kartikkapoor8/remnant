import { describe, expect, test } from "bun:test";
import { computeFingerprint, neutralFingerprint } from "./fingerprint.ts";
import { SARAH_STYLE } from "./corpus.fixture.ts";
import { percentile, tokenize, extractEmoji, isOnlyUrl, splitSentences } from "./text.ts";

describe("text helpers", () => {
  test("percentile interpolates", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([], 0.9)).toBe(0);
    expect(percentile([7], 0.9)).toBe(7);
  });
  test("tokenize lowercases and keeps apostrophes", () => {
    expect(tokenize("Don't Stop, Biscuit! 🌻")).toEqual(["don't", "stop", "biscuit"]);
  });
  test("extractEmoji finds pictographs and ignores letters", () => {
    expect(extractEmoji("love u ❤️ 🌻 ok")).toEqual(["❤️", "🌻"]);
    expect(extractEmoji("plain text")).toEqual([]);
  });
  test("isOnlyUrl", () => {
    expect(isOnlyUrl("https://x.com/a")).toBe(true);
    expect(isOnlyUrl("look https://x.com/a")).toBe(false);
  });
  test("splitSentences splits on terminal punctuation and newlines", () => {
    expect(splitSentences("Hey! I'm good. Are you?\nyes")).toEqual(["Hey!", "I'm good.", "Are you?", "yes"]);
  });
});

describe("computeFingerprint on a Sarah-style corpus", () => {
  const fp = computeFingerprint(SARAH_STYLE);

  test("counts only her messages", () => {
    expect(fp.sampleSize).toBe(SARAH_STYLE.filter((m) => m.sender === "them").length);
  });
  test("she never ends with periods and writes lowercase", () => {
    expect(fp.punctuation.terminalPeriodRate).toBeLessThan(0.1);
    expect(fp.capitalization.allLowercaseRate).toBeGreaterThan(0.8);
    expect(fp.capitalization.lowercaseIRate).toBeGreaterThan(0.9);
  });
  test("she drops apostrophes", () => {
    expect(fp.punctuation.apostropheDropRate).toBeGreaterThan(0.8);
  });
  test("lexicon: haha, ya, bub, omw/okok, stretch", () => {
    expect(fp.lexicon.laugh).toBe("haha");
    expect(fp.lexicon.affirmative).toBe("ya");
    expect(fp.lexicon.petNames).toContain("bub");
    expect(fp.lexicon.abbreviations).toEqual(expect.arrayContaining(["u", "omw", "okok", "ya"]));
    expect(fp.lexicon.stretchRate).toBeGreaterThan(0);
    expect(fp.lexicon.stretchRate).toBeLessThan(0.3);
  });
  test("signature phrases are hers, not the user's", () => {
    expect(fp.lexicon.signaturePhrases).toContain("bub");
    expect(fp.lexicon.signaturePhrases).not.toContain("the");
  });
  test("greetings: hi hi is her top opener", () => {
    expect(fp.greetings[0]).toBe("hi hi");
  });
  test("bursts of 2-3 with plausible rhythm", () => {
    expect(fp.bursts.meanSize).toBeGreaterThan(1.5);
    expect(fp.bursts.meanSize).toBeLessThan(3);
    const sum = fp.bursts.sizeDistribution.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(fp.bursts.medianGapMs).toBeGreaterThan(5_000);
    expect(fp.bursts.medianGapMs).toBeLessThan(90_000);
    expect(fp.bursts.charsPerSecond).toBeGreaterThanOrEqual(2);
    expect(fp.bursts.charsPerSecond).toBeLessThanOrEqual(12);
  });
  test("length distribution is short-text sized", () => {
    expect(fp.length.charsP50).toBeGreaterThan(5);
    expect(fp.length.charsP90).toBeGreaterThan(fp.length.charsP50);
    expect(fp.length.charsP90).toBeLessThan(60);
    expect(fp.length.charsMax).toBeGreaterThanOrEqual(fp.length.charsP90);
    expect(fp.length.wordsP50).toBeLessThan(6);
  });
  test("emoji: sparse, sunflower and heart on top", () => {
    expect(fp.emoji.perMessage).toBeGreaterThan(0.05);
    expect(fp.emoji.perMessage).toBeLessThan(0.4);
    expect(fp.emoji.top).toEqual(expect.arrayContaining(["🌻", "❤️"]));
  });
});

describe("computeFingerprint edge cases", () => {
  test("empty corpus → neutral defaults", () => {
    expect(computeFingerprint([])).toEqual(neutralFingerprint());
  });
  test("ignores URL-only messages", () => {
    const fp = computeFingerprint([
      { sender: "them", text: "https://example.com/very/long/link/that/would/skew/lengths", timestamp: "2025-01-01T00:00:00Z" },
      { sender: "them", text: "ok", timestamp: "2025-01-01T00:00:10Z" },
    ]);
    expect(fp.sampleSize).toBe(1);
  });
  test("formal writer keeps periods and capitals", () => {
    const fp = computeFingerprint([
      { sender: "them", text: "Good morning. I hope you slept well.", timestamp: "2025-01-01T08:00:00Z" },
      { sender: "them", text: "I will be there at noon.", timestamp: "2025-01-01T08:01:00Z" },
      { sender: "them", text: "Please bring the documents.", timestamp: "2025-01-01T08:02:00Z" },
    ]);
    expect(fp.punctuation.terminalPeriodRate).toBe(1);
    expect(fp.capitalization.allLowercaseRate).toBe(0);
    expect(fp.lexicon.laugh).toBeNull();
    expect(fp.lexicon.petNames).toEqual([]);
  });
});
