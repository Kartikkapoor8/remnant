import { resolve } from "node:path";
import { GBrainMemoryStore, parseBrainFacts, seedBrainFacts, type SeedReport } from "@remnant/core";

export const REPO_ROOT = resolve(import.meta.dir, "../..");
export const BRAIN_DIR = resolve(REPO_ROOT, "brain");

/** Parent directory of `.gbrain/`: REMNANT_GBRAIN_HOME, else $HOME (i.e. ~/.gbrain). */
export function brainHome(): string {
  return process.env.REMNANT_GBRAIN_HOME ? resolve(process.env.REMNANT_GBRAIN_HOME) : process.env.HOME!;
}

export function gbrainInstalled(): boolean {
  return Bun.which("gbrain") !== null;
}

async function gbrain(args: string[], home: string): Promise<number> {
  const proc = Bun.spawn(["gbrain", ...args], {
    env: { ...process.env, GBRAIN_HOME: home },
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  });
  return proc.exited;
}

/** Creates a PGLite brain under <home>/.gbrain when there is none. */
export async function ensureBrain(home: string): Promise<"created" | "exists"> {
  if (await Bun.file(resolve(home, ".gbrain", "config.json")).exists()) return "exists";
  const code = await gbrain(["init", "--pglite"], home);
  if (code !== 0) throw new Error(`gbrain init exited ${code}`);
  return "created";
}

export interface ImportReport {
  pages: number;
  facts: number;
  seed: SeedReport;
}

/**
 * `gbrain import brain/` for the pages, then every Compiled Truth sentence and
 * Timeline entry through the `remember` verb with the page as provenance, so
 * `recall` can rank them by entity. Idempotent: re-runs report duplicates.
 *
 * PGLite is single-writer: this needs the lock, so no `gbrain serve` may be
 * running against the same brain (stop the app server first).
 */
export async function importBrain(home: string, log: (line: string) => void = (l) => console.error(l)): Promise<ImportReport> {
  const code = await gbrain(["import", BRAIN_DIR, "--no-embed"], home);
  if (code !== 0) {
    throw new Error(`gbrain import exited ${code}. If it says the database is already open through gbrain serve, stop that process first.`);
  }
  const facts = await parseBrainFacts(BRAIN_DIR);
  let pages = 0;
  for await (const _ of new Bun.Glob("**/*.md").scan(BRAIN_DIR)) pages += 1;
  const store = new GBrainMemoryStore({ home, timeoutMs: 30_000 });
  await store.connect();
  try {
    const seed = await seedBrainFacts(store, facts, log);
    return { pages, facts: facts.length, seed };
  } finally {
    await store.close();
  }
}
