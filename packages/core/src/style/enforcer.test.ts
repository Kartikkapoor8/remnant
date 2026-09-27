import { describe, expect, test } from "bun:test";
import { computeFingerprint, neutralFingerprint, type StyleFingerprint } from "../stylometry/fingerprint.ts";
import { SARAH_STYLE } from "../stylometry/corpus.fixture.ts";
import { extractEmoji, makeRng } from "../stylometry/text.ts";
import {
  StyleEnforcer,
  applyCapitalization,
  applyLexicon,
  applyPunctuation,
  cutAtClause,
  injectImperfection,
  normalizeLlmOutput,
  splitIntoBursts,
  truncateAtWord,
} from "./enforcer.ts";

const SAMPLE =
  "Hey! I'm doing great. I just got back from the overlook and it was so beautiful. Lol, Biscuit ate another sock. On my way home now.";

const sarah = computeFingerprint(SARAH_STYLE);

const FORMAL: StyleFingerprint = {
  ...neutralFingerprint(),
  sampleSize: 50,
  length: { charsP50: 60, charsP75: 90, charsP90: 140, charsMax: 300, wordsP50: 12, wordsP90: 28 },
  punctuation: { terminalPeriodRate: 0.95, exclamationRate: 0.02, questionRate: 0.1, ellipsisRate: 0, commaRate: 0.6, apostropheDropRate: 0 },
  capitalization: { lowercaseStartRate: 0.02, allLowercaseRate: 0.01, lowercaseIRate: 0 },
  bursts: { meanSize: 1, sizeDistribution: [0, 1], medianGapMs: 60_000, charsPerSecond: 6 },
};

function assertSarahInvariants(bursts: string[]) {
  expect(bursts.length).toBeGreaterThan(0);
  expect(bursts.length).toBeLessThanOrEqual(4);
  for (const b of bursts) {
    expect(b.length).toBeGreaterThan(0);
    expect(b.length).toBeLessThanOrEqual(Math.max(12, sarah.length.charsP90) + 3); // + optional " 🌻"
    const letters = b.replace(/\p{Extended_Pictographic}/gu, "");
    expect(letters).toBe(letters.toLowerCase());
    expect(b.endsWith(".")).toBe(false);
    expect(/\blol\b/i.test(b)).toBe(false);
  }
  const joined = bursts.join(" ");
  expect(/\bomw\b/.test(joined) || !/on my way/i.test(joined)).toBe(true);
}

describe("normalizeLlmOutput", () => {
  test("strips markdown, quotes, prefixes and stage directions", () => {
    expect(normalizeLlmOutput('Sarah: "**hey** there *smiles* [pauses] `ok`"')).toBe("hey there ok");
    expect(normalizeLlmOutput("  ## hi\n\n_there_  ")).toBe("hi\nthere");
  });
  test("empty and whitespace → empty string", () => {
    expect(normalizeLlmOutput("   ")).toBe("");
  });
});

describe("truncation helpers", () => {
  test("truncateAtWord never cuts mid-word", () => {
    const out = truncateAtWord("the quick brown fox jumps over", 14);
    expect(out).toBe("the quick");
    expect("the quick brown fox jumps over".split(" ")).toEqual(expect.arrayContaining(out.split(" ")));
  });
  test("truncateAtWord leaves short input alone", () => {
    expect(truncateAtWord("hi", 10)).toBe("hi");
  });
  test("cutAtClause prefers a clause boundary", () => {
    expect(cutAtClause("i went to the store, and then i drove home for hours", 40)).toBe("i went to the store");
  });
});

describe("splitIntoBursts", () => {
  test("empty → []", () => {
    expect(splitIntoBursts("", sarah, makeRng(1))).toEqual([]);
  });
  test("respects maxBursts and charsP90", () => {
    const b = splitIntoBursts(SAMPLE, sarah, makeRng(3), 2);
    expect(b.length).toBeLessThanOrEqual(2);
    for (const x of b) expect(x.length).toBeLessThanOrEqual(Math.max(12, sarah.length.charsP90));
  });
  test("long single sentence is cut at a clause, not mid-word", () => {
    const words = "word ".repeat(80).trim();
    const b = splitIntoBursts(words, sarah, makeRng(1));
    expect(b.length).toBe(1);
    expect(b[0]!.split(" ").every((w) => w === "word")).toBe(true);
  });
});

describe("individual steps", () => {
  test("applyPunctuation strips periods, commas and apostrophes for Sarah", () => {
    expect(applyPunctuation(["I'm here, don't worry."], sarah, makeRng(1))).toEqual(["Im here dont worry"]); // case is the next step's job
  });
  test("applyPunctuation keeps a formal writer intact", () => {
    expect(applyPunctuation(["I'm here, don't worry."], FORMAL, makeRng(1))).toEqual(["I'm here, don't worry."]);
  });
  test("applyCapitalization lowercases but keeps emoji/URLs", () => {
    expect(applyCapitalization(["Hey There 🌻 https://X.com/A"], sarah)).toEqual(["hey there 🌻 https://X.com/A"]);
    expect(applyCapitalization(["Hey There"], FORMAL)).toEqual(["Hey There"]);
  });
  test("applyLexicon maps laugh/affirmative/abbreviations", () => {
    const out = applyLexicon(["Yes lol on my way", "okay you"], sarah, makeRng(999));
    expect(out[0]).toMatch(/^Ya haha omw/);
    expect(out[1]).toMatch(/^okok u/);
  });
  test("applyLexicon never injects a pet name when persona has none", () => {
    for (let s = 0; s < 30; s++) {
      expect(applyLexicon(["hello there"], FORMAL, makeRng(s))).toEqual(["hello there"]);
    }
  });
  test("applyLexicon injects at most one pet name and only when absent", () => {
    let injected = 0;
    for (let s = 0; s < 100; s++) {
      const out = applyLexicon(["see you soon", "bye"], sarah, makeRng(s));
      const count = out.join(" ").match(/\bbub\b/g)?.length ?? 0;
      expect(count).toBeLessThanOrEqual(1);
      injected += count;
      expect(applyLexicon(["bye bub"], sarah, makeRng(s)).join(" ").match(/\bbub\b/g)!.length).toBe(1);
    }
    expect(injected).toBeGreaterThan(15);
    expect(injected).toBeLessThan(60);
  });
  test("injectImperfection adds at most one emoji and one stretch", () => {
    for (let s = 0; s < 100; s++) {
      const out = injectImperfection(["so good", "hey you", "no way"], sarah, makeRng(s));
      expect(out.flatMap(extractEmoji).length).toBeLessThanOrEqual(1);
      expect(out.join(" ").match(/soooo|heyyy|nooo/g)?.length ?? 0).toBeLessThanOrEqual(1);
    }
    expect(injectImperfection([], sarah, makeRng(1))).toEqual([]);
  });
});

describe("StyleEnforcer end to end", () => {
  test("sample paragraph becomes Sarah's bursts", () => {
    const e = new StyleEnforcer(sarah, { seed: 7 });
    const bursts = e.enforce(SAMPLE);
    assertSarahInvariants(bursts);
    expect(bursts.join(" ")).toMatch(/haha/);
    expect(bursts.join(" ")).toMatch(/\bomw\b|overlook/);
  });
  test("deterministic for the same seed", () => {
    const a = new StyleEnforcer(sarah, { seed: 7 }).enforce(SAMPLE);
    const b = new StyleEnforcer(sarah, { seed: 7 }).enforce(SAMPLE);
    expect(a).toEqual(b);
  });
  test("invariants hold across 50 seeds; some seeds differ", () => {
    const outs = new Set<string>();
    for (let s = 0; s < 50; s++) {
      const bursts = new StyleEnforcer(sarah, { seed: s }).enforce(SAMPLE);
      assertSarahInvariants(bursts);
      outs.add(JSON.stringify(bursts));
    }
    expect(outs.size).toBeGreaterThan(1);
  });
  test("formal fingerprint leaves capitals and periods alone", () => {
    const bursts = new StyleEnforcer(FORMAL, { seed: 1 }).enforce("I will be there at noon. Please bring the documents.");
    expect(bursts.length).toBe(1);
    expect(bursts[0]).toBe("I will be there at noon. Please bring the documents.");
  });
  test("empty input → [] not ['']", () => {
    expect(new StyleEnforcer(sarah).enforce("")).toEqual([]);
    expect(new StyleEnforcer(sarah).enforce("**  **")).toEqual([]);
  });
  test("strips a speaker prefix and markdown", () => {
    const bursts = new StyleEnforcer(sarah, { seed: 2 }).enforce("Sarah: *laughs* **Okay** see you soon.");
    expect(bursts.join(" ")).not.toMatch(/sarah:|\*/i);
    expect(bursts.join(" ")).toMatch(/^okok/);
  });
  test("burstDelaysMs: positive, bounded, typing time first", () => {
    const e = new StyleEnforcer(sarah, { seed: 7 });
    const bursts = e.enforce(SAMPLE);
    const d = e.burstDelaysMs(bursts);
    expect(d.length).toBe(bursts.length);
    expect(d[0]).toBeGreaterThanOrEqual(900);
    expect(d[0]).toBeLessThanOrEqual(900 + (bursts[0]!.length / 2) * 1000);
    for (const x of d.slice(1)) {
      expect(x).toBeGreaterThanOrEqual(600);
      expect(x).toBeLessThanOrEqual(4000);
    }
    expect(e.burstDelaysMs([])).toEqual([]);
  });
  test("describe summarises the fingerprint", () => {
    const s = new StyleEnforcer(sarah).describe();
    expect(s).toContain("haha");
    expect(s).toContain("bub");
    expect(s).toContain("hi hi");
  });
});
