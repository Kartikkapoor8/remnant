import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ElevenLabsVoice, JsonVoiceStore, STOCK_VOICE_ID } from "./index.ts";

function fakeFetch(handler: (url: string, init?: RequestInit) => Response): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => handler(String(input), init)) as typeof fetch;
}

describe("ElevenLabsVoice", () => {
  test("cloneVoice posts multipart to /v1/voices/add with the key header", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const v = new ElevenLabsVoice("k", "https://x.test", fakeFetch((url, init) => {
      seen = { url, init };
      return new Response(JSON.stringify({ voice_id: "v123", requires_verification: false }), { status: 200 });
    }));
    const out = await v.cloneVoice({ name: "Sarah", samples: [{ blob: new Blob([new Uint8Array(4)]), filename: "a.wav" }] });
    expect(out).toEqual({ voiceId: "v123", requiresVerification: false });
    expect(seen!.url).toBe("https://x.test/v1/voices/add");
    expect((seen!.init!.headers as Record<string, string>)["xi-api-key"]).toBe("k");
    const form = seen!.init!.body as FormData;
    expect(form.get("name")).toBe("Sarah");
    expect(form.getAll("files").length).toBe(1);
  });

  test("speak streams from the voice endpoint and surfaces API errors", async () => {
    const v = new ElevenLabsVoice("k", "https://x.test", fakeFetch((url) =>
      url.includes("/v1/text-to-speech/v1/stream?output_format=mp3_44100_128")
        ? new Response("audio", { status: 200 })
        : new Response("nope", { status: 422 }),
    ));
    const ok = await v.speak("hi hi", "v1");
    expect(await ok.text()).toBe("audio");
    await expect(v.speak("hi", "missing")).rejects.toThrow(/tts failed \(422\)/);
  });

  test("requires an api key and a sample", async () => {
    expect(() => new ElevenLabsVoice("")).toThrow();
    const v = new ElevenLabsVoice("k");
    await expect(v.cloneVoice({ name: "x", samples: [] })).rejects.toThrow(/sample/);
    expect(STOCK_VOICE_ID.length).toBeGreaterThan(5);
  });
});

describe("JsonVoiceStore", () => {
  test("round-trips a record per persona", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "remnant-voice-")), "voice.json");
    const store = new JsonVoiceStore(path);
    expect(await store.get("sarah")).toBeNull();
    await store.set({ personaSlug: "sarah", voiceId: "v1", clonedAt: "2026-09-27T00:00:00Z", consentId: "c1" });
    await store.set({ personaSlug: "sarah", voiceId: "v2", clonedAt: "2026-09-27T00:00:01Z", consentId: "c1" });
    expect((await store.get("sarah"))?.voiceId).toBe("v2");
  });
});
