import type { CompletionRequest, ModelProvider } from "./types.ts";

/** Written by training/train.py when a run finishes. */
export interface RiverRunManifest {
  base_model: string;
  checkpoint: string;
  step: number;
  final_loss: number | null;
  finished_at: string;
  examples: number;
}

export const DEFAULT_RIVER_SIDECAR = "http://127.0.0.1:8765";

/**
 * Provider for the user's own fine-tuned LoRA on River AI.
 *
 * River's client is Python/gRPC, so inference runs in `training/serve.py`, a
 * small HTTP sidecar holding one River session. This class only talks HTTP to
 * it. `detect()` returns null unless BOTH a finished run manifest and a live
 * sidecar exist, so the fallback to the base model is explicit, never silent.
 */
export class RiverProvider implements ModelProvider {
  readonly id = "river-finetuned" as const;
  readonly label: string;
  readonly ownedModel = true;

  constructor(
    readonly manifest: RiverRunManifest,
    private readonly sidecarUrl: string = DEFAULT_RIVER_SIDECAR,
  ) {
    const short = manifest.base_model.split("/").pop() ?? manifest.base_model;
    this.label = `River LoRA on ${short}, step ${manifest.step} (your model)`;
  }

  static async detect(manifestPath: string, sidecarUrl = process.env.RIVER_SIDECAR_URL ?? DEFAULT_RIVER_SIDECAR): Promise<RiverProvider | null> {
    const file = Bun.file(manifestPath);
    if (!(await file.exists())) return null;
    let manifest: RiverRunManifest;
    try {
      manifest = (await file.json()) as RiverRunManifest;
    } catch {
      return null;
    }
    if (!manifest.checkpoint) return null;
    try {
      const res = await fetch(`${sidecarUrl}/health`, { signal: AbortSignal.timeout(1500) });
      if (!res.ok) return null;
      const body = (await res.json()) as { ok?: boolean; checkpoint?: string };
      if (!body.ok) return null;
      return new RiverProvider(manifest, sidecarUrl);
    } catch {
      return null;
    }
  }

  async complete(req: CompletionRequest): Promise<string> {
    const res = await fetch(`${this.sidecarUrl}/sample`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system: req.system,
        turns: req.turns,
        max_tokens: req.maxTokens ?? 120,
        temperature: req.temperature ?? 0.8,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`river sidecar ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { text: string };
    return body.text.trim();
  }
}
