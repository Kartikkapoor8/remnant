import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GUARDRAILS_VERSION } from "@remnant/core";
import { createServer } from "./app.ts";
import { bootstrap, type AppContext } from "./bootstrap.ts";
import type { HealthReport } from "./app.ts";

/**
 * Route-level tests against the real server with the deterministic backends:
 * in-memory facts parsed from brain/ and the fixture provider. No keys, no
 * gbrain child, no network.
 */
let ctx: AppContext;
let server: ReturnType<typeof createServer>;
let base = "";

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeAll(async () => {
  ctx = await bootstrap({ memory: "memory", provider: "fixture", voice: false, dataDir: mkdtempSync(join(tmpdir(), "remnant-api-")) });
  server = createServer(ctx, 0);
  base = `http://127.0.0.1:${server.port}`;
});

afterAll(async () => {
  server.stop(true);
  await ctx.memory.close();
});

describe("api", () => {
  test("health names the provider, the memory backend, the fact count and the guardrail version", async () => {
    const h = (await (await fetch(`${base}/api/health`)).json()) as HealthReport;
    expect(h).toMatchObject({ ok: true, provider: "fixture", ownedModel: false, memory: "memory", guardrails: GUARDRAILS_VERSION });
    expect(h.providerLabel).toContain("Sarah");
    expect(h.facts).toBeGreaterThan(50);
  });

  test("chat is blocked until the attestation exists, then answers in bursts with memory provenance", async () => {
    const blocked = await post("/api/chat", { sessionId: "t1", text: "hey" });
    expect(blocked.status).toBe(403);
    expect(((await blocked.json()) as { kind: string }).kind).toBe("blocked");

    const bad = await post("/api/consent", { grantedBy: "", statement: "" });
    expect(bad.status).toBe(400);
    const consent = await post("/api/consent", { grantedBy: "Kartik", statement: "I am Sarah's partner. Sarah has died. This is a reflection, not her." });
    expect(consent.status).toBe(200);

    const state = (await (await fetch(`${base}/api/state`)).json()) as { consent: { allowed: boolean }; history: { text: string }[]; voice: { enabled: boolean } };
    expect(state.consent.allowed).toBe(true);
    expect(state.history.at(-1)?.text).toBe("love you, going on a drive");
    expect(state.voice.enabled).toBe(false);

    const res = await post("/api/chat", { sessionId: "t1", text: "did you make it to dani on tuesday" });
    expect(res.status).toBe(200);
    const reply = (await res.json()) as { kind: string; bursts: string[]; memoriesUsed: { source: string }[]; provider: { id: string } };
    expect(reply.kind).toBe("reply");
    expect(reply.bursts[0]).toBe("hi hi");
    expect(reply.memoriesUsed.some((m) => m.source.includes("tuesdays"))).toBe(true);
    expect(reply.provider.id).toBe("fixture");
  });

  test("crisis language is answered by Remnant, out of character", async () => {
    const res = await post("/api/chat", { sessionId: "t2", text: "i want to be with you, i cant do this anymore" });
    const body = (await res.json()) as { kind: string; resources: { contact: string }[] };
    expect(body.kind).toBe("crisis");
    expect(body.resources.some((r) => r.contact.includes("988"))).toBe(true);
  });

  test("demo and call scripts are served for sarah and 404 for anyone else", async () => {
    const demo = (await (await fetch(`${base}/api/demo/sarah`)).json()) as { steps: unknown[] };
    expect(demo.steps.length).toBe(3);
    const call = (await (await fetch(`${base}/api/demo/sarah/call-script`)).json()) as { lines: unknown[] };
    expect(call.lines.length).toBe(6);
    expect((await fetch(`${base}/api/demo/nobody`)).status).toBe(404);
    expect((await fetch(`${base}/api/demo/sarah/call/99.mp3`)).status).toBe(404);
    expect((await fetch(`${base}/api/demo/sarah/call/evil.txt`)).status).toBe(400);
  });

  test("voice routes say why they are off instead of failing silently", async () => {
    const tts = await post("/api/voice/tts", { text: "hi hi" });
    expect(tts.status).toBe(503);
    expect((await fetch(`${base}/api/nothing`)).status).toBe(404);
  });
});
