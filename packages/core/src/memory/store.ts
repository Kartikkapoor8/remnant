import type { MemoryHit } from "../types.ts";

/**
 * MemoryStore is the persona's long-term memory boundary.
 *
 * The real implementation (GBrainMemoryStore) speaks MCP to `gbrain serve
 * --surface verbs`; the in-memory implementation backs tests and fixtures.
 * Every persona reply MUST go through `recall` so the UI can show which
 * memories were used.
 */

export interface RecallOptions {
  /** Entity slug to scope facts to (e.g. "people/sarah"). */
  entity?: string;
  /** Max hits to return. */
  limit?: number;
  /** Fact kinds to prefer, e.g. ["event", "preference"]. */
  kinds?: string[];
}

export interface RememberInput {
  fact: string;
  entity: string;
  kind?: "event" | "preference" | "commitment" | "belief" | "fact";
  /** Where the fact came from: a message id, an import file, "user". */
  provenance: string;
  sessionId?: string;
}

export interface RememberResult {
  id: string;
  status: "inserted" | "duplicate" | "superseded";
}

export interface EntityCard {
  slug: string;
  title: string;
  summary: string;
  found: boolean;
  activeFactCount: number;
}

export interface MemoryStore {
  readonly kind: "gbrain" | "memory";
  /** Retrieve memories relevant to a query. */
  recall(query: string, opts?: RecallOptions): Promise<MemoryHit[]>;
  /** Store a new fact with provenance. */
  remember(input: RememberInput): Promise<RememberResult>;
  /** Fetch the entity card for a person/place. */
  entity(name: string): Promise<EntityCard>;
  /** Withdraw a fact by id. */
  forget(id: string, reason?: string): Promise<{ id: string; expired: boolean }>;
  /** Release resources (child processes, handles). */
  close(): Promise<void>;
}

/** Normalise a free-text query to lowercase tokens; shared by both stores' fallbacks. */
export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

const STOPWORDS = new Set([
  "the", "and", "you", "your", "are", "was", "were", "for", "with", "that", "this",
  "have", "has", "had", "not", "but", "she", "her", "him", "his", "they", "them",
  "what", "when", "how", "did", "do", "does", "about", "just", "like", "from", "into",
  "its", "it's", "i'm", "im", "dont", "don't", "can", "will", "would", "could", "there",
  "then", "than", "also", "any", "all", "our", "out", "get", "got", "one", "some",
]);

export function significantTokens(query: string): string[] {
  return tokenizeQuery(query).filter((t) => !STOPWORDS.has(t));
}
