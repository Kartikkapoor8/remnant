/**
 * bun run sarah: rebuild the Sarah persona from fixtures/ end to end.
 *
 *   1. adapters     fixtures/sarah/sarah.whatsapp.txt through the WhatsApp adapter
 *   2. fingerprint  computeFingerprint -> fixtures/sarah/fingerprint.json, the measured style the StyleEnforcer targets
 *   3. brain pages  brain/**.md parsed into facts and audited against the corpus (last message, greeting, entity)
 *   4. gbrain       init if needed, import the pages, seed the facts with provenance (skipped when gbrain is not installed)
 *
 * Exits non-zero when a stage fails, so CI and a reviewer get a straight answer.
 */
import { resolve } from "node:path";
import { auditBrain, computeFingerprint, loadSarahFixture, SARAH_FIXTURE_DIR, StyleEnforcer } from "@remnant/core";
import { BRAIN_DIR, brainHome, ensureBrain, gbrainInstalled, importBrain } from "./lib/brain.ts";

const say = (line: string) => console.log(`[sarah] ${line}`);

// 1. adapters
const { profile, result } = await loadSarahFixture();
const them = result.messages.filter((m) => m.sender === "them").length;
say(`1/4 adapters     ${result.messages.length} messages (${them} from ${profile.name}), ${result.skipped} lines skipped, last: "${result.messages.at(-1)?.text}"`);

// 2. fingerprint
const fingerprint = computeFingerprint(result.messages);
const fingerprintPath = resolve(SARAH_FIXTURE_DIR, "fingerprint.json");
await Bun.write(fingerprintPath, JSON.stringify(fingerprint, null, 2) + "\n");
say(`2/4 fingerprint  ${new StyleEnforcer(fingerprint).describe()} -> fixtures/sarah/fingerprint.json`);

// 3. brain pages
const audit = await auditBrain(BRAIN_DIR, {
  entity: `people/${profile.slug}`,
  lastMessage: result.messages.at(-1)?.text ?? "",
  greeting: fingerprint.greetings[0] ?? null,
});
for (const p of audit.problems) say(`    problem: ${p}`);
say(`3/4 brain pages  ${audit.pages.length} pages -> ${audit.facts.length} facts (${audit.facts.filter((f) => f.kind === "event").length} timeline events), ${audit.problems.length} problems`);
if (audit.problems.length > 0) process.exit(1);

// 4. gbrain
if (!gbrainInstalled()) {
  say("4/4 gbrain       skipped: gbrain is not on PATH (bun add -g gbrain); the app will use the same facts in memory");
  process.exit(0);
}
const home = brainHome();
try {
  const state = await ensureBrain(home);
  const r = await importBrain(home, (line) => say(`    ${line}`));
  say(`4/4 gbrain       ${home}/.gbrain (${state}): ${r.pages} pages imported, facts ${r.seed.inserted} inserted, ${r.seed.duplicate} already present, ${r.seed.failed} failed`);
  process.exit(r.seed.failed > 0 ? 1 : 0);
} catch (err) {
  say(`4/4 gbrain       failed: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
  process.exit(1);
}
