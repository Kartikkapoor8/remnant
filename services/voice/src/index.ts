/**
 * ElevenLabs voice service: Instant Voice Cloning + streaming TTS.
 *
 * Consent is NOT checked here on purpose. The server calls
 * `checkConsent(profile, store, "voice-clone")` from @remnant/core before it
 * ever constructs a clone request; this module only knows how to talk to
 * ElevenLabs. Keeping the gate outside means it cannot be bypassed by a
 * different caller forgetting to pass a flag.
 */

export const ELEVENLABS_BASE = "https://api.elevenlabs.io";

/** A stock ElevenLabs voice used when no clone exists. Labelled as such in the UI. */
export const STOCK_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export interface CloneRequest {
  name: string;
  /** One or more audio samples (wav/mp3/m4a). 30s-2min of clean speech is enough for IVC. */
  samples: { blob: Blob; filename: string }[];
  description?: string;
  removeBackgroundNoise?: boolean;
}

export interface CloneResult {
  voiceId: string;
  requiresVerification: boolean;
}

export interface TtsOptions {
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  /** e.g. mp3_44100_128 (default) or mp3_22050_32 for slower connections. */
  outputFormat?: string;
}

export interface VoiceInfo {
  voiceId: string;
  name: string;
  category: string;
}

export class ElevenLabsError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

export class ElevenLabsVoice {
  constructor(
    private readonly apiKey: string,
    private readonly base: string = ELEVENLABS_BASE,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is required");
  }

  static fromEnv(): ElevenLabsVoice | null {
    const key = process.env.ELEVENLABS_API_KEY;
    return key ? new ElevenLabsVoice(key) : null;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { "xi-api-key": this.apiKey, ...extra };
  }

  private async fail(res: Response, what: string): Promise<never> {
    const body = await res.text();
    throw new ElevenLabsError(res.status, `${what} failed (${res.status}): ${body.slice(0, 300)}`);
  }

  /** POST /v1/voices/add — Instant Voice Cloning from uploaded samples. */
  async cloneVoice(req: CloneRequest): Promise<CloneResult> {
    if (req.samples.length === 0) throw new Error("at least one audio sample is required");
    const form = new FormData();
    form.set("name", req.name);
    if (req.description) form.set("description", req.description);
    form.set("remove_background_noise", String(req.removeBackgroundNoise ?? true));
    for (const s of req.samples) form.append("files", s.blob, s.filename);
    const res = await this.fetchImpl(`${this.base}/v1/voices/add`, { method: "POST", headers: this.headers(), body: form });
    if (!res.ok) await this.fail(res, "voice clone");
    const json = (await res.json()) as { voice_id: string; requires_verification?: boolean };
    return { voiceId: json.voice_id, requiresVerification: Boolean(json.requires_verification) };
  }

  /** POST /v1/text-to-speech/{voice}/stream — returns the streaming audio Response. */
  async speak(text: string, voiceId: string, opts: TtsOptions = {}): Promise<Response> {
    const format = opts.outputFormat ?? "mp3_44100_128";
    const res = await this.fetchImpl(
      `${this.base}/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=${encodeURIComponent(format)}`,
      {
        method: "POST",
        headers: this.headers({ "content-type": "application/json", accept: "audio/mpeg" }),
        body: JSON.stringify({
          text,
          model_id: opts.modelId ?? "eleven_multilingual_v2",
          voice_settings: {
            stability: opts.stability ?? 0.45,
            similarity_boost: opts.similarityBoost ?? 0.8,
          },
        }),
      },
    );
    if (!res.ok || !res.body) await this.fail(res, "tts");
    return res;
  }

  /** GET /v1/voices — used to verify a stored clone still exists. */
  async listVoices(): Promise<VoiceInfo[]> {
    const res = await this.fetchImpl(`${this.base}/v1/voices`, { headers: this.headers() });
    if (!res.ok) await this.fail(res, "list voices");
    const json = (await res.json()) as { voices: { voice_id: string; name: string; category: string }[] };
    return json.voices.map((v) => ({ voiceId: v.voice_id, name: v.name, category: v.category }));
  }

  async deleteVoice(voiceId: string): Promise<void> {
    const res = await this.fetchImpl(`${this.base}/v1/voices/${encodeURIComponent(voiceId)}`, { method: "DELETE", headers: this.headers() });
    if (!res.ok) await this.fail(res, "delete voice");
  }
}

/** Persisted record of a cloned voice, kept next to the consent record. */
export interface VoiceRecord {
  personaSlug: string;
  voiceId: string;
  clonedAt: string;
  consentId: string;
}

export class JsonVoiceStore {
  constructor(private readonly path: string) {}

  async get(personaSlug: string): Promise<VoiceRecord | null> {
    const f = Bun.file(this.path);
    if (!(await f.exists())) return null;
    const all = (await f.json()) as VoiceRecord[];
    return all.find((r) => r.personaSlug === personaSlug) ?? null;
  }

  async set(record: VoiceRecord): Promise<void> {
    const f = Bun.file(this.path);
    const all = (await f.exists()) ? ((await f.json()) as VoiceRecord[]) : [];
    const rest = all.filter((r) => r.personaSlug !== record.personaSlug);
    await Bun.write(this.path, JSON.stringify([...rest, record], null, 2));
  }
}
