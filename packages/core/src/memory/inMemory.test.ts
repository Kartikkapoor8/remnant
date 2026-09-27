import { describe, expect, test } from "bun:test";
import { InMemoryStore } from "./inMemory.ts";

const seed = [
  { entity: "people/sarah", text: "Sarah had a hair appointment with Dani every Tuesday at 4pm", kind: "fact", provenance: "brain/memories/sarah/tuesdays.md" },
  { entity: "people/sarah", text: "Sarah drove her green Subaru, the frog, up the coast to the overlook to clear her head", kind: "fact", provenance: "brain/memories/sarah/the-drives.md" },
  { entity: "people/sarah", text: "Sarah's last message was 'love you, going on a drive' on 2026-01-27", kind: "event", provenance: "fixtures/sarah" },
  { entity: "people/biscuit", text: "Biscuit the beagle ate a sock and went to the emergency vet", kind: "event", provenance: "brain/people/biscuit.md" },
];

const entities = [
  { slug: "people/sarah", title: "Sarah", summary: "Kartik's partner." },
  { slug: "people/biscuit", title: "Biscuit", summary: "The beagle." },
];

describe("InMemoryStore", () => {
  test("recall ranks by keyword overlap and respects limit", async () => {
    const store = new InMemoryStore(seed, entities);
    const hits = await store.recall("did she go for a drive on tuesday after her hair appointment", { limit: 2 });
    expect(hits.length).toBe(2);
    expect(hits[0]!.text).toContain("Tuesday");
    expect(hits.every((h) => typeof h.score === "number" && h.score! > 0)).toBe(true);
  });

  test("recall scopes to an entity", async () => {
    const store = new InMemoryStore(seed, entities);
    expect((await store.recall("sock vet", { entity: "people/sarah" })).length).toBe(0);
    expect((await store.recall("sock vet", { entity: "people/biscuit" })).length).toBe(1);
  });

  test("recall returns nothing for unrelated queries", async () => {
    const store = new InMemoryStore(seed, entities);
    expect(await store.recall("quantum chromodynamics")).toEqual([]);
  });

  test("remember inserts, dedupes, and requires provenance", async () => {
    const store = new InMemoryStore(seed, entities);
    const r1 = await store.remember({ entity: "people/sarah", fact: "Sarah hated mushrooms", provenance: "user" });
    expect(r1.status).toBe("inserted");
    const r2 = await store.remember({ entity: "people/sarah", fact: "sarah hated mushrooms", provenance: "user" });
    expect(r2.status).toBe("duplicate");
    expect(r2.id).toBe(r1.id);
    await expect(store.remember({ entity: "people/sarah", fact: "x", provenance: "" })).rejects.toThrow(/provenance/);
    expect((await store.recall("mushrooms"))[0]!.source).toBe("user");
  });

  test("forget expires a fact and is idempotent", async () => {
    const store = new InMemoryStore(seed, entities);
    const before = store.size();
    const hit = (await store.recall("frog overlook"))[0]!;
    expect(await store.forget(hit.id)).toEqual({ id: hit.id, expired: true });
    expect(await store.forget(hit.id)).toEqual({ id: hit.id, expired: false });
    expect(store.size()).toBe(before - 1);
    expect(await store.recall("frog overlook")).toEqual([]);
    await expect(store.forget("nope")).rejects.toThrow(/unknown/);
  });

  test("entity resolves slug, tail, or title", async () => {
    const store = new InMemoryStore(seed, entities);
    expect((await store.entity("people/sarah")).found).toBe(true);
    expect((await store.entity("Sarah")).activeFactCount).toBe(3);
    expect((await store.entity("biscuit")).title).toBe("Biscuit");
    expect((await store.entity("nobody")).found).toBe(false);
  });
});
