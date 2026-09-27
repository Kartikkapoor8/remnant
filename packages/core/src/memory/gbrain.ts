import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { MemoryHit } from "../types.ts";
import {
  rankByOverlap,
  type EntityCard,
  type MemoryStore,
  type RecallOptions,
  type RememberInput,
  type RememberResult,
} from "./store.ts";

export interface GBrainOptions {
  /** Parent directory of `.gbrain/`. Defaults to $HOME (i.e. ~/.gbrain). */
  home?: string;
  /** Path to the gbrain executable. Defaults to "gbrain" on PATH. */
  command?: string;
  /** Hosted brain: URL of a gbrain HTTP MCP server (`gbrain serve --http` or `gbrain mcp expose`). When set, nothing is spawned. */
  url?: string;
  /** Bearer token for `url` (from `gbrain mcp grant`). */
  token?: string;
  /** Per-call timeout in ms. */
  timeoutMs?: number;
  /** Receives child stderr lines for diagnostics. */
  onStderr?: (line: string) => void;
}

interface RecallFact {
  fact_id: string;
  fact: string;
  kind: string;
  provenance: string;
  entity_slug?: string;
}

interface RecallResult {
  slug: string;
  title: string;
  chunk?: string;
  evidence: string;
  provenance: string;
}

interface RecallResponse {
  facts: RecallFact[];
  results?: RecallResult[];
  search_degraded?: string;
  total: number;
}

interface RememberResponse {
  id: string;
  status: "inserted" | "duplicate" | "superseded";
}

interface EntityResponse {
  found: boolean;
  card?: {
    entity: { slug: string; title: string; type: string | null };
    summary: string;
    active_fact_count: number;
  };
}

interface ForgetResponse {
  id: string;
  expired: boolean;
}

export class GBrainUnavailableError extends Error {
  constructor(message: string, readonly hint: string) {
    super(message);
    this.name = "GBrainUnavailableError";
  }
}

/**
 * MemoryStore backed by a real GBrain brain over MCP stdio.
 *
 * Spawns `gbrain serve --surface verbs` and speaks JSON-RPC to it with the
 * official MCP client over stdio, or, with `url`, talks Streamable HTTP to a
 * hosted brain. The 7 memory verbs are the only tools on that surface:
 * recall, remember, entity, synthesize, forget, context_pack, delta. We use
 * four of them at runtime; `synthesize` is deliberately not used (it costs an
 * LLM call inside gbrain and the persona prompt already does the reasoning).
 */
export class GBrainMemoryStore implements MemoryStore {
  readonly kind = "gbrain" as const;
  readonly backend: "gbrain-stdio" | "gbrain-http";
  private client: Client | null = null;
  private transport: Transport | null = null;
  private stderrTail: string[] = [];
  private readonly opts: Required<Pick<GBrainOptions, "command" | "timeoutMs">> & GBrainOptions;

  constructor(opts: GBrainOptions = {}) {
    this.opts = { command: "gbrain", timeoutMs: 20_000, ...opts };
    this.backend = opts.url ? "gbrain-http" : "gbrain-stdio";
  }

  static envFor(home?: string): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (typeof v === "string") env[k] = v;
    if (home) env.GBRAIN_HOME = home;
    return env;
  }

  private makeTransport(): Transport {
    if (this.opts.url) {
      const headers: Record<string, string> = this.opts.token ? { authorization: `Bearer ${this.opts.token}` } : {};
      return new StreamableHTTPClientTransport(new URL(this.opts.url), { requestInit: { headers } });
    }
    return new StdioClientTransport({
      command: this.opts.command,
      args: ["serve", "--surface", "verbs"],
      env: GBrainMemoryStore.envFor(this.opts.home),
      stderr: "pipe",
    });
  }

  async connect(): Promise<void> {
    if (this.client) return;
    const transport = this.makeTransport();
    const client = new Client({ name: "remnant", version: "0.1.0" });
    try {
      await client.connect(transport);
    } catch (err) {
      throw this.unavailable(err);
    }
    if (transport instanceof StdioClientTransport) {
      transport.stderr?.on("data", (chunk: Buffer) => {
        for (const line of chunk.toString().split("\n")) {
          if (!line.trim()) continue;
          this.stderrTail.push(line);
          if (this.stderrTail.length > 40) this.stderrTail.shift();
          this.opts.onStderr?.(line);
        }
      });
    }
    this.transport = transport;
    this.client = client;
    const tools = await client.listTools();
    const names = new Set(tools.tools.map((t) => t.name));
    for (const required of ["recall", "remember", "entity", "forget"]) {
      if (!names.has(required)) {
        await this.close();
        throw new GBrainUnavailableError(
          `gbrain serve did not expose the '${required}' verb (got: ${[...names].join(", ")})`,
          "Run `gbrain upgrade`; the verbs surface needs gbrain >= 0.31.",
        );
      }
    }
  }

  private unavailable(err: unknown): GBrainUnavailableError {
    const message = err instanceof Error ? err.message : String(err);
    if (this.opts.url) {
      return new GBrainUnavailableError(
        `could not reach the hosted brain at ${this.opts.url}: ${message}`,
        "Check GBRAIN_MCP_URL and GBRAIN_MCP_TOKEN (issued by `gbrain mcp grant`), or unset GBRAIN_MCP_URL to use a local brain.",
      );
    }
    const tail = this.stderrTail.join("\n");
    const lock = /already open through `gbrain serve`|LiveServeLockError|pglite_busy/i.test(tail + message);
    return new GBrainUnavailableError(
      `could not start gbrain serve: ${message}\n${tail}`,
      lock
        ? "Another `gbrain serve` (probably a Claude Code MCP child) holds the PGLite lock. Stop it (`pkill -f 'gbrain serve'`) or point REMNANT_GBRAIN_HOME at a different brain."
        : "Is gbrain installed? `bun add -g gbrain` then `gbrain init --pglite`.",
    );
  }

  private async call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    if (!this.client) await this.connect();
    const res = await this.client!.callTool({ name, arguments: args }, undefined, {
      timeout: this.opts.timeoutMs,
    });
    const content = (res.content as { type: string; text?: string }[] | undefined) ?? [];
    const text = content.find((c) => c.type === "text")?.text ?? "";
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : res.structuredContent;
    } catch {
      parsed = res.structuredContent ?? { raw: text };
    }
    if (res.isError) {
      const e = parsed as { error?: string; message?: string; suggestion?: string };
      throw new Error(`gbrain ${name} failed: ${e.error ?? ""} ${e.message ?? text} ${e.suggestion ?? ""}`.trim());
    }
    return parsed as T;
  }

  /**
   * Recall = facts arm (all active facts for the entity, ranked client-side by
   * overlap with the query) + page-search arm (gbrain's hybrid search, which is
   * keyword-only without an embedding provider). Facts are what
   * `scripts/import-brain.ts` wrote via `remember`, so every hit has provenance.
   */
  async recall(query: string, opts: RecallOptions = {}): Promise<MemoryHit[]> {
    const limit = opts.limit ?? 8;
    const args: Record<string, unknown> = { query, limit: 100 };
    if (opts.entity) args.entity = opts.entity;
    const res = await this.call<RecallResponse>("recall", args);
    const hits: MemoryHit[] = [];
    const kinds = opts.kinds && opts.kinds.length > 0 ? new Set(opts.kinds) : null;
    for (const f of res.facts ?? []) {
      if (kinds && !kinds.has(f.kind)) continue;
      hits.push({ id: f.fact_id, text: f.fact, source: f.provenance || f.entity_slug || "gbrain:fact", kind: f.kind });
    }
    for (const r of res.results ?? []) {
      const text = (r.chunk ?? r.title).trim();
      if (!text) continue;
      hits.push({ id: `page:${r.slug}`, text, source: r.slug, kind: "page", score: evidenceScore(r.evidence) });
    }
    const ranked = rankByOverlap(dedupeHits(hits), query);
    const relevant = ranked.filter((h) => (h.score ?? 0) > 0);
    // Always give the persona a little grounding, even off-topic: pad with the
    // top unscored facts up to a small floor, clearly marked as background.
    const floor = Math.min(3, limit);
    const padded = relevant.length >= floor ? relevant : [...relevant, ...ranked.filter((h) => (h.score ?? 0) === 0).slice(0, floor - relevant.length).map((h) => ({ ...h, kind: h.kind === "page" ? "page" : "background" }))];
    return padded.slice(0, limit);
  }

  async remember(input: RememberInput): Promise<RememberResult> {
    if (!input.provenance?.trim()) throw new Error("provenance is required");
    const args: Record<string, unknown> = {
      fact: input.fact,
      entity: input.entity,
      provenance: input.provenance,
      kind: input.kind ?? "fact",
    };
    if (input.sessionId) args.session_id = input.sessionId;
    const res = await this.call<RememberResponse>("remember", args);
    return { id: res.id, status: res.status };
  }

  async entity(name: string): Promise<EntityCard> {
    const res = await this.call<EntityResponse>("entity", { name });
    if (!res.found || !res.card) {
      return { slug: name, title: name, summary: "", found: false, activeFactCount: 0 };
    }
    return {
      slug: res.card.entity.slug,
      title: res.card.entity.title,
      summary: res.card.summary ?? "",
      found: true,
      activeFactCount: res.card.active_fact_count ?? 0,
    };
  }

  async forget(id: string, reason?: string): Promise<{ id: string; expired: boolean }> {
    const args: Record<string, unknown> = { id };
    if (reason) args.reason = reason;
    const res = await this.call<ForgetResponse>("forget", args);
    return { id: res.id, expired: res.expired };
  }

  async close(): Promise<void> {
    const c = this.client;
    const t = this.transport;
    this.client = null;
    this.transport = null;
    try {
      await c?.close();
    } catch {
      /* already gone */
    }
    try {
      await t?.close();
    } catch {
      /* already gone */
    }
  }
}

function evidenceScore(evidence: string): number {
  switch (evidence) {
    case "alias_hit":
    case "exact_title_match":
      return 1;
    case "high_vector_match":
      return 0.9;
    case "keyword_exact":
      return 0.7;
    default:
      return 0.4;
  }
}

function dedupeHits(hits: MemoryHit[]): MemoryHit[] {
  const seen = new Set<string>();
  const out: MemoryHit[] = [];
  for (const h of hits) {
    const key = h.text.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}
