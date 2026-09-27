/**
 * Import brain/ markdown into the GBrain brain the app uses, then write each
 * Compiled Truth sentence and Timeline entry into GBrain's fact store through
 * the `remember` verb (with provenance), so `recall` can rank them by entity.
 *
 * PGLite is single-writer, so this must run while no other `gbrain serve`
 * holds the lock (stop the app server first).
 *
 *   bun run brain:import                                  # ~/.gbrain
 *   REMNANT_GBRAIN_HOME=.remnant bun run brain:import     # project-local brain
 */
import { resolve } from "node:path";
import { GBrainMemoryStore, parseBrainFacts, seedBrainFacts } from "@remnant/core";

const home = process.env.REMNANT_GBRAIN_HOME ? resolve(process.env.REMNANT_GBRAIN_HOME) : process.env.HOME!;
const brainDir = resolve(import.meta.dir, "../brain");

const proc = Bun.spawn(["gbrain", "import", brainDir, "--no-embed"], {
  env: { ...process.env, GBRAIN_HOME: home },
  stdout: "inherit",
  stderr: "inherit",
});
const code = await proc.exited;
if (code !== 0) {
  console.error(`gbrain import exited ${code}. If it says the database is already open through gbrain serve, stop that process first.`);
  process.exit(code);
}

const facts = await parseBrainFacts(brainDir);
const store = new GBrainMemoryStore({ home, timeoutMs: 30_000 });
await store.connect();
const report = await seedBrainFacts(store, facts, (line) => console.error(line));
await store.close();
console.log(`pages imported from ${brainDir}; facts: ${facts.length} parsed, ${report.inserted} inserted, ${report.duplicate} already present, ${report.failed} failed -> ${home}/.gbrain`);
