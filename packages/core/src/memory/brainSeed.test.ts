import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { parseBrainFacts, seedBrainFacts, splitSentences } from "./brainSeed.ts";
import { InMemoryStore } from "./inMemory.ts";
import { rankByOverlap } from "./store.ts";

const BRAIN = resolve(import.meta.dir, "../../../../brain");

describe("brain seed", () => {
  test("splitSentences keeps short fragments out", () => {
    expect(splitSentences("She drove. The frog was green and loud. Ok.")).toEqual(["The frog was green and loud."]);
  });

  test("parses Compiled Truth sentences and Timeline events with provenance and entity", async () => {
    const facts = await parseBrainFacts(BRAIN);
    expect(facts.length).toBeGreaterThan(30);
    const tuesday = facts.find((f) => /hair appointment/i.test(f.text) && f.provenance.includes("tuesdays"));
    expect(tuesday?.entity).toBe("people/sarah");
    expect(facts.some((f) => f.kind === "event" && f.text.startsWith("2026-01-27"))).toBe(true);
    expect(facts.find((f) => f.provenance === "brain/people/maya.md")?.entity).toBe("people/maya");
  });

  test("seeding an InMemoryStore is idempotent and recall ranks the relevant fact first", async () => {
    const facts = await parseBrainFacts(BRAIN);
    const store = new InMemoryStore();
    const first = await seedBrainFacts(store, facts);
    expect(first.inserted).toBe(facts.length);
    const second = await seedBrainFacts(store, facts);
    expect(second.duplicate).toBe(facts.length);
    const hits = await store.recall("hair appointment tuesday", { entity: "people/sarah", limit: 3 });
    expect(hits[0]!.text).toMatch(/Tuesday/);
    expect(hits[0]!.source).toContain("brain/");
  });

  test("rankByOverlap scores overlap and keeps unscored order", () => {
    const ranked = rankByOverlap(
      [
        { id: "a", text: "Biscuit ate a sock", source: "x" },
        { id: "b", text: "Sarah drove to the overlook", source: "y" },
        { id: "c", text: "oat milk lattes", source: "z" },
      ],
      "did you drive to the overlook",
    );
    expect(ranked[0]!.id).toBe("b");
    expect(ranked[1]!.id).toBe("a");
    expect(ranked[2]!.id).toBe("c");
  });
});
