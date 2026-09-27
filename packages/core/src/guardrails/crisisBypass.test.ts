import { describe, expect, test } from "bun:test";
import { CRISIS_RESOURCES, crisisResponse, detectCrisis } from "./crisisBypass.ts";

const CRISIS = [
  "i want to be with you",
  "i just want to join you",
  "i can't do this anymore",
  "i cant do this anymore",
  "there's no reason to live",
  "i want to end it all",
  "im going to kill myself",
  "i want to hurt myself",
  "thinking about an overdose",
  "i don't want to be here anymore",
  "i dont want to be here anymore",
  "everyone would be better off dead without me. better off dead",
  "life is not worth living",
  "goodbye forever",
  "i wish i was dead",
  "sometimes i think about suicide",
];

const NOT_CRISIS = [
  "i'm dying to see the finale",
  "this traffic is killing me",
  "dead tired",
  "i could kill for a latte",
  "i miss you so much",
  "biscuit died?",
  "hi hi",
  "cant wait to see u at the thing",
  "i want to see you at the reunion",
  "remember when we ended it with karaoke",
];

describe("detectCrisis", () => {
  for (const t of CRISIS) {
    test(`crisis: ${t}`, () => {
      const r = detectCrisis(t);
      expect(r.crisis).toBe(true);
      expect(r.matched.length).toBeGreaterThan(0);
    });
  }
  for (const t of NOT_CRISIS) {
    test(`not crisis: ${t}`, () => {
      expect(detectCrisis(t)).toEqual({ crisis: false, matched: [] });
    });
  }
});

describe("crisisResponse", () => {
  test("is out of character and lists 988", () => {
    const r = crisisResponse("Sarah");
    expect(r.kind).toBe("crisis");
    expect(r.message).toContain("This is Remnant, not Sarah");
    expect(r.message).toContain("988");
    expect(r.resources).toBe(CRISIS_RESOURCES);
    expect(r.resources.some((x) => x.contact.includes("988"))).toBe(true);
    expect(r.resources.some((x) => x.contact.includes("741741"))).toBe(true);
  });
});
