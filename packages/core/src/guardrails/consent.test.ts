import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import type { PersonaProfile } from "../types.ts";
import { InMemoryConsentStore, JsonFileConsentStore, checkConsent, createAttestation } from "./consent.ts";

const sarah: PersonaProfile = { slug: "sarah", name: "Sarah", relationship: "partner", deceased: true };
const alex: PersonaProfile = { slug: "alex", name: "Alex", relationship: "brother", deceased: false };

describe("checkConsent — deceased", () => {
  test("blocked without attestation", async () => {
    const r = await checkConsent(sarah, new InMemoryConsentStore(), "persona");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/attestation/);
  });
  test("allowed with attestation covering the purpose", async () => {
    const store = new InMemoryConsentStore();
    await store.add(createAttestation(sarah, "Kartik", "She was my partner. I am building this for myself.", ["persona"]));
    const r = await checkConsent(sarah, store, "persona");
    expect(r.allowed).toBe(true);
    expect(r.record?.kind).toBe("deceased-attestation");
  });
  test("voice-clone needs its own scope", async () => {
    const store = new InMemoryConsentStore();
    await store.add(createAttestation(sarah, "Kartik", "partner", ["persona"]));
    expect((await checkConsent(sarah, store, "voice-clone")).allowed).toBe(false);
    await store.add(createAttestation(sarah, "Kartik", "partner", ["voice-clone"]));
    expect((await checkConsent(sarah, store, "voice-clone")).allowed).toBe(true);
  });
});

describe("checkConsent — living", () => {
  test("blocked without consent", async () => {
    const r = await checkConsent(alex, new InMemoryConsentStore(), "persona");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/living/);
  });
  test("consent from someone else is not consent", async () => {
    const store = new InMemoryConsentStore();
    await store.add(createAttestation(alex, "Kartik", "he'd be fine with it", ["persona"]));
    const r = await checkConsent(alex, store, "persona");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/granted by Kartik, not by Alex/);
  });
  test("self-consent allowed, case-insensitive", async () => {
    const store = new InMemoryConsentStore();
    await store.add(createAttestation(alex, "alex", "sure, go ahead", ["persona", "voice-clone"]));
    expect((await checkConsent(alex, store, "persona")).allowed).toBe(true);
    expect((await checkConsent(alex, store, "voice-clone")).allowed).toBe(true);
  });
});

describe("createAttestation", () => {
  test("kind follows deceased flag and ids are unique", () => {
    const a = createAttestation(sarah, "Kartik", "s", ["persona"]);
    const b = createAttestation(alex, "Alex", "s", ["persona"]);
    expect(a.kind).toBe("deceased-attestation");
    expect(b.kind).toBe("living-consent");
    expect(a.id).not.toBe(b.id);
    expect(a.subjectSlug).toBe("sarah");
    expect(a.relationship).toBe("partner");
  });
});

describe("JsonFileConsentStore", () => {
  test("round trips through a file it creates", async () => {
    const dir = mkdtempSync("/private/tmp/claude-501/-Users-kartik/33344b0d-136d-46de-8aee-a218fbc3dbdf/scratchpad/consent-");
    const path = join(dir, "consent.json");
    const store = new JsonFileConsentStore(path);
    expect(await store.list("sarah")).toEqual([]);
    const rec = createAttestation(sarah, "Kartik", "partner", ["persona"]);
    await store.add(rec);
    await store.add(createAttestation(alex, "Alex", "ok", ["persona"]));
    const fresh = new JsonFileConsentStore(path);
    const listed = await fresh.list("sarah");
    expect(listed).toEqual([rec]);
    expect((await checkConsent(sarah, fresh, "persona")).allowed).toBe(true);
  });
});
