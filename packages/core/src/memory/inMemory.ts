import type { MemoryHit } from "../types.ts";
import {
  significantTokens,
  type EntityCard,
  type MemoryStore,
  type RecallOptions,
  type RememberInput,
  type RememberResult,
} from "./store.ts";

export interface SeedFact {
  id?: string;
  entity: string;
  text: string;
  kind?: string;
  provenance?: string;
}

interface StoredFact {
  id: string;
  entity: string;
  text: string;
  kind: string;
  provenance: string;
  expired: boolean;
  createdAt: number;
}

/**
 * Deterministic, dependency-free MemoryStore for tests and fixtures.
 * Retrieval is keyword overlap scoring (token hits / query tokens) with a
 * small bonus for exact phrase matches, so tests can reason about ranking.
 */
export class InMemoryStore implements MemoryStore {
  readonly kind = "memory" as const;
  private facts = new Map<string, StoredFact>();
  private entities = new Map<string, { title: string; summary: string }>();
  private seq = 0;

  constructor(seed: SeedFact[] = [], entities: { slug: string; title: string; summary: string }[] = []) {
    for (const e of entities) this.entities.set(e.slug, { title: e.title, summary: e.summary });
    for (const f of seed) {
      const id = f.id ?? this.nextId();
      this.facts.set(id, {
        id,
        entity: f.entity,
        text: f.text,
        kind: f.kind ?? "fact",
        provenance: f.provenance ?? "seed",
        expired: false,
        createdAt: this.seq,
      });
    }
  }

  private nextId(): string {
    this.seq += 1;
    return `mem-${this.seq}`;
  }

  async recall(query: string, opts: RecallOptions = {}): Promise<MemoryHit[]> {
    const limit = opts.limit ?? 8;
    const tokens = significantTokens(query);
    const phrase = query.toLowerCase().trim();
    const scored: MemoryHit[] = [];
    for (const f of this.facts.values()) {
      if (f.expired) continue;
      if (opts.entity && f.entity !== opts.entity) continue;
      if (opts.kinds && opts.kinds.length > 0 && !opts.kinds.includes(f.kind)) continue;
      const hay = f.text.toLowerCase();
      let hits = 0;
      for (const t of tokens) if (hay.includes(t)) hits += 1;
      let score = tokens.length === 0 ? 0 : hits / tokens.length;
      if (phrase.length > 3 && hay.includes(phrase)) score += 0.5;
      if (score > 0) {
        scored.push({ id: f.id, text: f.text, source: f.provenance, score, kind: f.kind });
      }
    }
    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.id.localeCompare(b.id));
    return scored.slice(0, limit);
  }

  async remember(input: RememberInput): Promise<RememberResult> {
    if (!input.provenance || input.provenance.trim() === "") {
      throw new Error("provenance is required");
    }
    const normalized = input.fact.trim().toLowerCase();
    for (const f of this.facts.values()) {
      if (!f.expired && f.entity === input.entity && f.text.trim().toLowerCase() === normalized) {
        return { id: f.id, status: "duplicate" };
      }
    }
    const id = this.nextId();
    this.facts.set(id, {
      id,
      entity: input.entity,
      text: input.fact.trim(),
      kind: input.kind ?? "fact",
      provenance: input.provenance,
      expired: false,
      createdAt: this.seq,
    });
    return { id, status: "inserted" };
  }

  async entity(name: string): Promise<EntityCard> {
    const slug = this.resolveSlug(name);
    const e = slug ? this.entities.get(slug) : undefined;
    const active = slug ? [...this.facts.values()].filter((f) => !f.expired && f.entity === slug).length : 0;
    if (!slug || !e) {
      return { slug: name, title: name, summary: "", found: false, activeFactCount: 0 };
    }
    return { slug, title: e.title, summary: e.summary, found: true, activeFactCount: active };
  }

  private resolveSlug(name: string): string | undefined {
    const n = name.toLowerCase().trim();
    for (const [slug, e] of this.entities) {
      if (slug === n || slug.endsWith("/" + n) || e.title.toLowerCase() === n) return slug;
    }
    return undefined;
  }

  async forget(id: string, _reason?: string): Promise<{ id: string; expired: boolean }> {
    const f = this.facts.get(id);
    if (!f) throw new Error(`unknown fact id: ${id}`);
    if (f.expired) return { id, expired: false };
    f.expired = true;
    return { id, expired: true };
  }

  async close(): Promise<void> {
    /* nothing to release */
  }

  /** Test helper: number of active facts. */
  size(): number {
    return [...this.facts.values()].filter((f) => !f.expired).length;
  }
}
