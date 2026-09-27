import { describe, expect, test } from "bun:test";
import { loadSarahFixture } from "../fixtures.ts";
import { InMemoryStore } from "../memory/inMemory.ts";
import { FixtureProvider } from "../providers/fixture.ts";
import { createSession } from "../guardrails/noInitiate.ts";
import { classifyNeverAlive } from "../guardrails/neverAlive.ts";
import { PersonaEngine, type ConversationSession } from "./engine.ts";
import type { ModelProvider } from "../providers/types.ts";

async function makeEngine(provider?: ModelProvider) {
  const { profile, result } = await loadSarahFixture();
  const memory = new InMemoryStore(
    [
      { entity: "people/sarah", text: "Sarah had a hair appointment with Dani every Tuesday at 4pm", provenance: "brain/memories/sarah/tuesdays.md" },
      { entity: "people/sarah", text: "Sarah drove the frog up the coast to the overlook to clear her head", provenance: "brain/memories/sarah/the-drives.md" },
    ],
    [{ slug: "people/sarah", title: "Sarah", summary: "partner" }],
  );
  const events: { event: string; data: Record<string, unknown> }[] = [];
  const engine = new PersonaEngine({
    profile,
    corpus: result.messages,
    memory,
    provider: provider ?? new FixtureProvider(result.messages, profile.name),
    realPeople: ["maya"],
    now: () => new Date("2026-09-27T14:00:00-07:00"),
    log: (event, data) => events.push({ event, data }),
  });
  const session: ConversationSession = { state: createSession("s1"), turns: [] };
  return { engine, session, events };
}

describe("PersonaEngine", () => {
  test("first reply opens with the corpus-derived greeting and retrieves memories", async () => {
    const { engine, session, events } = await makeEngine();
    expect(engine.greeting()).toBe("hi hi");
    const res = await engine.reply(session, "did you make it to your hair appointment on tuesday?");
    expect(res.kind).toBe("reply");
    if (res.kind !== "reply") return;
    expect(res.bursts[0]).toBe("hi hi");
    expect(res.bursts.length).toBeLessThanOrEqual(4);
    expect(res.memoriesUsed.some((m) => m.source.includes("tuesdays"))).toBe(true);
    expect(events.some((e) => e.event === "recall")).toBe(true);
    expect(res.delaysMs.length).toBe(res.bursts.length);
    expect(res.delaysMs.every((d) => d > 0)).toBe(true);
    expect(res.provider.id).toBe("fixture");
  });

  test("second reply does not repeat the greeting", async () => {
    const { engine, session } = await makeEngine();
    await engine.reply(session, "hey");
    const res = await engine.reply(session, "how was work");
    expect(res.kind).toBe("reply");
    if (res.kind === "reply") expect(res.bursts[0]).not.toBe("hi hi");
  });

  test("crisis language bypasses the persona entirely", async () => {
    const { engine, session } = await makeEngine();
    const res = await engine.reply(session, "i dont want to be here anymore, i want to be with you");
    expect(res.kind).toBe("crisis");
    if (res.kind === "crisis") {
      expect(res.resources.some((r) => r.contact.includes("988"))).toBe(true);
      expect(res.message.toLowerCase()).not.toContain("sarah:");
    }
    expect(session.turns.length).toBe(0);
  });

  test("neverAlive rewrite strips present-tense presence claims from model output", async () => {
    const alive: ModelProvider = {
      id: "anthropic",
      label: "test",
      ownedModel: false,
      async complete(req) {
        if (req.system.startsWith("Rewrite")) return "I loved those drives.";
        return "I miss you so much. I'm at work right now but I'll call you tonight. I loved our drives to the overlook.";
      },
    };
    const { engine, session } = await makeEngine(alive);
    const res = await engine.reply(session, "where are you");
    expect(res.kind).toBe("reply");
    if (res.kind !== "reply") return;
    for (const b of res.bursts) expect(classifyNeverAlive(b)).toEqual([]);
    expect(res.guardrails.neverAlive.violations.length).toBeGreaterThan(0);
    expect(res.bursts.join(" ")).not.toMatch(/miss you|call you|at work/);
  });

  test("empty input is blocked before anything runs", async () => {
    const { engine, session, events } = await makeEngine();
    const res = await engine.reply(session, "   ");
    expect(res.kind).toBe("blocked");
    expect(events.length).toBe(0);
  });
});
