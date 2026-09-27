/**
 * Generates the scripted call clips: one mp3 per line of
 * fixtures/sarah/call-script.json via ElevenLabs TTS (model eleven_v3).
 *
 *   bun apps/web/scripts/sarah-voice.ts        # needs ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in .env
 *
 * Writes fixtures/sarah/call/<id>.mp3. Idempotent: existing clips are
 * regenerated only with --force.
 */

import { loadCallScript, callClipPath } from "@remnant/core";
import { ElevenLabsVoice } from "@remnant/voice";

const force = process.argv.includes("--force");
const voice = ElevenLabsVoice.fromEnv();
const voiceId = process.env.ELEVENLABS_VOICE_ID;
if (!voice || !voiceId) {
  console.error("ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID must be set in .env");
  process.exit(1);
}
const script = await loadCallScript("sarah");
if (!script) {
  console.error("fixtures/sarah/call-script.json not found");
  process.exit(1);
}

for (const line of script.lines) {
  const out = callClipPath("sarah", `${line.id}.mp3`)!;
  if (!force && (await Bun.file(out).exists())) {
    console.log(`${line.id} exists, skipping`);
    continue;
  }
  const res = await voice.speak(line.text, voiceId, {
    modelId: script.model,
    stability: 0.35,
    similarityBoost: 0.8,
    style: 0.4,
    useSpeakerBoost: true,
  });
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength === 0) {
    console.error(`${line.id}: ElevenLabs returned empty audio for "${line.text}"; give the line something to voice`);
    process.exit(1);
  }
  await Bun.write(out, bytes);
  console.log(`${line.id} -> ${out} (${bytes.byteLength} bytes)`);
}
