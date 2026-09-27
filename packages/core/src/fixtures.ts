import { join } from "node:path";
import { parseWhatsApp } from "./adapters/whatsapp.ts";
import type { ImportResult, PersonaProfile } from "./types.ts";

export const SARAH_FIXTURE_DIR = join(import.meta.dir, "../../../fixtures/sarah");

/**
 * Load the seeded "Sarah" persona: profile + parsed corpus.
 * The demo never depends on a live import because of this.
 */
export async function loadSarahFixture(): Promise<{ profile: PersonaProfile; result: ImportResult }> {
  const profile = (await Bun.file(join(SARAH_FIXTURE_DIR, "profile.json")).json()) as PersonaProfile;
  const text = await Bun.file(join(SARAH_FIXTURE_DIR, "sarah.whatsapp.txt")).text();
  const result = parseWhatsApp(text, { themName: profile.name });
  result.source = "fixture";
  return { profile, result };
}
