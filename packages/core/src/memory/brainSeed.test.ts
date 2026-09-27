import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadSarahFixture } from "../fixtures.ts";
import { computeFingerprint } from "../stylometry/fingerprint.ts";
import { auditBrain, parseBrainFacts, seedBrainFacts, splitSentences } from "./brainSeed.ts";
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

  test("auditBrain passes on the real brain/ and flags a brain that drifted from the corpus", async () => {
    const { profile, result } = await loadSarahFixture();
    const fp = computeFingerprint(result.messages);
    const audit = await auditBrain(BRAIN, { entity: `people/${profile.slug}`, lastMessage: result.messages.at(-1)!.text, greeting: fp.greetings[0] ?? null });
    expect(audit.problems).toEqual([]);
    expect(audit.pages.length).toBe(9);
    expect(audit.facts.length).toBe((await parseBrainFacts(BRAIN)).length);

    const dir = mkdtempSync(join(tmpdir(), "remnant-brain-"));
    mkdirSync(join(dir, "people"));
    mkdirSync(join(dir, "memories", "sarah"), { recursive: true });
    writeFileSync(join(dir, "people", "sarah.md"), "---\ntitle: Sarah\n---\n# Sarah\n\nA page with no sections.\n");
    writeFileSync(join(dir, "memories", "sarah", "drives.md"), "---\ntitle: Drives\n---\n## Compiled Truth\n\nShe drove the frog to the overlook most weeks.\n");
    const bad = await auditBrain(dir, { entity: "people/sarah", lastMessage: "love you, going on a drive", greeting: "hi hi" });
    expect(bad.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('brain/people/sarah.md: no "## Compiled Truth"'),
        expect.stringContaining("does not quote the corpus's last message"),
        expect.stringContaining('brain/memories/sarah/drives.md: entity is "(none)"'),
      ]),
    );
  });
});
