import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { GBrainMemoryStore } from "./gbrain.ts";

/**
 * Integration test against a real `gbrain serve --surface verbs` over MCP stdio.
 * Runs only when REMNANT_GBRAIN_HOME points at a brain that has had
 * `gbrain import brain/ --no-embed` run against it (see scripts/import-brain.ts).
 */
const home = process.env.REMNANT_GBRAIN_HOME;
const run = home ? describe : describe.skip;

run("GBrainMemoryStore (real gbrain over MCP)", () => {
  const store = new GBrainMemoryStore({ home, timeoutMs: 30_000 });

  beforeAll(async () => {
    await store.connect();
  });
  afterAll(async () => {
    await store.close();
  });

  test("recall finds the Tuesday hair appointment page", async () => {
    const hits = await store.recall("hair appointment on tuesday", { entity: "people/sarah", limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.source.includes("tuesdays") || /tuesday/i.test(h.text))).toBe(true);
    expect(hits.every((h) => h.id && h.text && h.source)).toBe(true);
  });

  test("entity card resolves Sarah", async () => {
    const card = await store.entity("Sarah");
    expect(card.found).toBe(true);
    expect(card.slug).toBe("people/sarah");
  });

  test("remember then forget round-trips with provenance", async () => {
    const fact = `Sarah test fact ${Date.now()}: she kept a sunflower sticker on the frog's dashboard`;
    const r = await store.remember({ entity: "people/sarah", fact, provenance: "packages/core/src/memory/gbrain.test.ts", kind: "fact" });
    expect(r.status).toBe("inserted");
    const hits = await store.recall("sunflower sticker dashboard", { entity: "people/sarah" });
    expect(hits.some((h) => h.id === r.id)).toBe(true);
    const gone = await store.forget(r.id, "test cleanup");
    expect(gone.expired).toBe(true);
    const again = await store.forget(r.id, "idempotent");
    expect(again.expired).toBe(false);
  });
});
