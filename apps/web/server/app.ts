import {
  GUARDRAILS_VERSION,
  callClipPath,
  checkConsent,
  createAttestation,
  createSession,
  loadCallScript,
  loadDemoScript,
  type ConversationSession,
  type MemoryBackend,
  type ProviderId,
} from "@remnant/core";
import { STOCK_VOICE_ID } from "@remnant/voice";
import type { AppContext } from "./bootstrap.ts";

/** GET /api/health. The footer renders from this, so what the UI claims is what the server chose. */
export interface HealthReport {
  ok: true;
  provider: ProviderId;
  providerLabel: string;
  ownedModel: boolean;
  providerNote: string | null;
  memory: MemoryBackend;
  memoryNote: string | null;
  /** Active facts about the persona in the memory store; null when the store could not answer. */
  facts: number | null;
  guardrails: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function readJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}

export function createServer(ctx: AppContext, port: number) {
  const sessions = new Map<string, ConversationSession>();

  function session(id: string): ConversationSession {
    let s = sessions.get(id);
    if (!s) {
      s = { state: createSession(id), turns: [] };
      sessions.set(id, s);
    }
    return s;
  }

  async function voiceStatus() {
    const record = await ctx.voices.get(ctx.profile.slug);
    const consent = await checkConsent(ctx.profile, ctx.consent, "voice-clone");
    return {
      enabled: Boolean(ctx.voice),
      name: ctx.profile.name.toLowerCase(),
      cloned: Boolean(record),
      voiceId: record?.voiceId ?? (ctx.voice ? STOCK_VOICE_ID : null),
      label: record ? `cloned voice (${record.clonedAt.slice(0, 10)})` : ctx.voice ? "stock voice, not cloned" : "voice disabled (no ELEVENLABS_API_KEY)",
      cloneAllowed: consent.allowed,
      cloneReason: consent.reason,
    };
  }

  async function health(): Promise<HealthReport> {
    let facts: number | null = null;
    try {
      facts = (await ctx.memory.entity(ctx.engine.entitySlug)).activeFactCount;
    } catch (err) {
      ctx.log("health.facts", { error: err instanceof Error ? err.message : String(err) });
    }
    return {
      ok: true,
      provider: ctx.provider.id,
      providerLabel: ctx.provider.label,
      ownedModel: ctx.provider.ownedModel,
      providerNote: ctx.providerNote,
      memory: ctx.memory.backend,
      memoryNote: ctx.memoryNote,
      facts,
      guardrails: GUARDRAILS_VERSION,
    };
  }

  return Bun.serve({
    port,
    hostname: "0.0.0.0",
    idleTimeout: 120,
    routes: {
      "/api/health": async () => json(await health()),

      "/api/state": {
        GET: async () => {
          const consent = await checkConsent(ctx.profile, ctx.consent, "persona");
          const history = ctx.corpus.messages.slice(-14);
          return json({
            persona: ctx.profile,
            history,
            corpus: { messages: ctx.corpus.messages.length, source: ctx.corpus.source, skipped: ctx.corpus.skipped },
            style: ctx.engine.enforcer.describe(),
            greeting: ctx.engine.greeting(),
            consent: { allowed: consent.allowed, reason: consent.reason },
            voice: await voiceStatus(),
          });
        },
      },

      "/api/demo/:slug": {
        GET: async (req) => {
          const script = await loadDemoScript(req.params.slug);
          return script ? json(script) : json({ error: `no demo script for ${req.params.slug}` }, 404);
        },
      },

      "/api/demo/:slug/call-script": {
        GET: async (req) => {
          const script = await loadCallScript(req.params.slug);
          return script ? json(script) : json({ error: `no call script for ${req.params.slug}` }, 404);
        },
      },

      "/api/demo/:slug/call/:file": {
        GET: async (req) => {
          const path = callClipPath(req.params.slug, req.params.file);
          if (!path) return json({ error: "bad clip name" }, 400);
          const file = Bun.file(path);
          if (!(await file.exists())) return json({ error: "clip not generated; run apps/web/scripts/sarah-voice.ts" }, 404);
          return new Response(file, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
        },
      },

      "/api/consent": {
        POST: async (req) => {
          const body = await readJson<{ grantedBy: string; statement: string }>(req);
          if (!body.grantedBy?.trim() || !body.statement?.trim()) return json({ error: "grantedBy and statement are required" }, 400);
          const record = createAttestation(ctx.profile, body.grantedBy.trim(), body.statement.trim(), ["persona", "voice-clone"]);
          await ctx.consent.add(record);
          ctx.log("consent.recorded", { id: record.id, kind: record.kind, scope: record.scope });
          return json({ ok: true, record });
        },
      },

      "/api/chat": {
        POST: async (req) => {
          const body = await readJson<{ sessionId: string; text: string }>(req);
          if (!body.sessionId || typeof body.text !== "string") return json({ error: "sessionId and text are required" }, 400);
          const consent = await checkConsent(ctx.profile, ctx.consent, "persona");
          if (!consent.allowed) return json({ kind: "blocked", reason: consent.reason }, 403);
          const result = await ctx.engine.reply(session(body.sessionId), body.text);
          if (result.kind === "reply") {
            ctx.log("reply", {
              session: body.sessionId,
              bursts: result.bursts.length,
              memories: result.memoriesUsed.map((m) => m.source),
              neverAlive: result.guardrails.neverAlive.strategy,
              dependency: result.guardrails.dependency,
            });
          }
          return json(result);
        },
      },

      "/api/voice/clone": {
        POST: async (req) => {
          if (!ctx.voice) return json({ error: "voice disabled: ELEVENLABS_API_KEY not set" }, 503);
          const consent = await checkConsent(ctx.profile, ctx.consent, "voice-clone");
          if (!consent.allowed || !consent.record) return json({ error: consent.reason }, 403);
          const form = await req.formData();
          const files = form.getAll("audio").filter((f): f is File => f instanceof File);
          if (files.length === 0) return json({ error: "attach at least one audio sample as 'audio'" }, 400);
          const result = await ctx.voice.cloneVoice({
            name: `Remnant reflection of ${ctx.profile.name}`,
            description: `Consent record ${consent.record.id}. A reflection, not the person.`,
            samples: files.map((f) => ({ blob: f, filename: f.name })),
          });
          await ctx.voices.set({ personaSlug: ctx.profile.slug, voiceId: result.voiceId, clonedAt: new Date().toISOString(), consentId: consent.record.id });
          ctx.log("voice.cloned", { voiceId: result.voiceId, samples: files.length });
          return json({ ok: true, voiceId: result.voiceId, requiresVerification: result.requiresVerification });
        },
      },

      "/api/voice/tts": {
        POST: async (req) => {
          if (!ctx.voice) return json({ error: "voice disabled: ELEVENLABS_API_KEY not set" }, 503);
          const body = await readJson<{ text: string }>(req);
          if (!body.text?.trim()) return json({ error: "text is required" }, 400);
          const status = await voiceStatus();
          const upstream = await ctx.voice.speak(body.text.trim(), status.voiceId ?? STOCK_VOICE_ID);
          return new Response(upstream.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
        },
      },
    },
    fetch: () => json({ error: "not found" }, 404),
    error: (err) => {
      ctx.log("error", { message: err.message });
      return json({ error: err.message }, 500);
    },
  });
}
