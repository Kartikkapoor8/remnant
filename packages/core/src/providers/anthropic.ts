import Anthropic from "@anthropic-ai/sdk";
import type { CompletionRequest, ModelProvider } from "./types.ts";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5";

/**
 * Anthropic-backed provider. Used when no River adapter is available and an
 * API key is present. Effort is pinned low: this is a texting persona, not a
 * reasoning task, and latency on a phone matters more than depth.
 */
export class AnthropicProvider implements ModelProvider {
  readonly id = "anthropic" as const;
  readonly label: string;
  readonly ownedModel = false;
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(opts: { apiKey?: string; model?: string } = {}) {
    this.client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
    this.model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
    this.label = `Anthropic ${this.model} (base model + persona prompt)`;
  }

  static available(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  }

  async complete(req: CompletionRequest): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens ?? 400,
      system: req.system,
      output_config: { effort: "low" },
      messages: req.turns.map((t) => ({ role: t.role, content: t.content })),
    });
    if (response.stop_reason === "refusal") {
      throw new Error(`model refused: ${response.stop_details?.explanation ?? "no explanation"}`);
    }
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  }
}
