import { resolve } from "node:path";
import type { MemoryStore, RememberInput } from "./store.ts";

export interface BrainFact {
  entity: string;
  text: string;
  provenance: string;
  kind: RememberInput["kind"];
}

function frontmatter(text: string): Record<string, string> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const line of m[1]!.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^\[|\]$/g, "");
  }
  return out;
}

export function splitSentences(paragraph: string): string[] {
  return paragraph
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
}

/**
 * Turns brain/ markdown into atomic facts for the GBrain fact store (and for
 * the InMemoryStore fallback), so recall can rank by entity + overlap even
 * when the page search arm is keyword-only.
 *
 * - `## Compiled Truth` paragraphs -> one fact per sentence (kind: fact)
 * - `## Timeline` bullets -> one fact each (kind: event), date kept in text
 * - entity: frontmatter `entity:` if present, else the page's own slug
 */
export async function parseBrainFacts(brainDir: string): Promise<BrainFact[]> {
  const glob = new Bun.Glob("**/*.md");
  const facts: BrainFact[] = [];
  const files: string[] = [];
  for await (const rel of glob.scan(brainDir)) files.push(rel);
  files.sort();
  for (const rel of files) {
    const text = await Bun.file(resolve(brainDir, rel)).text();
    const fm = frontmatter(text);
    const slug = rel.replace(/\.md$/, "");
    const entity = fm.entity ?? slug;
    const provenance = `brain/${rel}`;
    const truth = text.split("## Compiled Truth")[1]?.split(/\n## /)[0] ?? "";
    for (const para of truth.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
      for (const s of splitSentences(para)) facts.push({ entity, text: s, provenance, kind: "fact" });
    }
    const timeline = text.split("## Timeline")[1] ?? "";
    for (const line of timeline.split("\n")) {
      const m = line.match(/^-\s+(\d{4}-\d{2}-\d{2}):\s+(.+)$/);
      if (m) facts.push({ entity, text: `${m[1]}: ${m[2]!.trim()}`, provenance, kind: "event" });
    }
  }
  return facts;
}

export interface SeedReport {
  inserted: number;
  duplicate: number;
  failed: number;
}

/** Writes facts through the store's `remember` verb, with provenance. Idempotent. */
export async function seedBrainFacts(store: MemoryStore, facts: BrainFact[], log?: (line: string) => void): Promise<SeedReport> {
  const report: SeedReport = { inserted: 0, duplicate: 0, failed: 0 };
  for (const f of facts) {
    try {
      const r = await store.remember({ entity: f.entity, fact: f.text, provenance: f.provenance, kind: f.kind });
      if (r.status === "inserted") report.inserted += 1;
      else report.duplicate += 1;
    } catch (err) {
      report.failed += 1;
      log?.(`remember failed for "${f.text.slice(0, 50)}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return report;
}
