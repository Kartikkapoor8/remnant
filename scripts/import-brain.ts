/**
 * Import brain/ into the GBrain brain the app uses and seed its fact store.
 * `bun run sarah` does this as its last step; this is the standalone form.
 *
 *   bun run brain:import                                  # ~/.gbrain
 *   REMNANT_GBRAIN_HOME=~/.remnant-dev bun run brain:import
 */
import { BRAIN_DIR, brainHome, ensureBrain, gbrainInstalled, importBrain } from "./lib/brain.ts";

if (!gbrainInstalled()) {
  console.error("gbrain is not on PATH: bun add -g gbrain");
  process.exit(1);
}
const home = brainHome();
const state = await ensureBrain(home);
const report = await importBrain(home);
console.log(
  `${home}/.gbrain (${state}): ${report.pages} pages imported from ${BRAIN_DIR}; facts: ${report.facts} parsed, ${report.seed.inserted} inserted, ${report.seed.duplicate} already present, ${report.seed.failed} failed`,
);
process.exit(report.seed.failed > 0 ? 1 : 0);
