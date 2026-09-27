export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  system: string;
  turns: ChatTurn[];
  maxTokens?: number;
  temperature?: number;
}

export type ProviderId = "river-finetuned" | "anthropic" | "fixture";

/**
 * A swappable text-completion backend for the persona.
 * The engine only ever calls `complete`; everything else (style, memory,
 * guardrails) happens around it in code we own.
 */
export interface ModelProvider {
  readonly id: ProviderId;
  /** Human-readable label shown in the UI footer, e.g. "River LoRA (Qwen3.8-27B)". */
  readonly label: string;
  /** True when this provider is a fine-tune the user owns (drives the footer copy). */
  readonly ownedModel: boolean;
  complete(req: CompletionRequest): Promise<string>;
}
