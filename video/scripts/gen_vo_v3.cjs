// VO lines 1-7 with the user's voice ID on eleven_v3, audio tags for emotion. Never prints the key.
const fs = require('fs'); const path = require('path');
const env = fs.readFileSync('/Users/kartik/hack/remnant/.env', 'utf8');
const key = (env.match(/^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/m) || [])[1];
const H = { 'xi-api-key': key, 'Content-Type': 'application/json' };
const out = '/Users/kartik/hack/remnant-explainer/video/out/audio/raw';
const VOICE = 'T4x5CtnhOiichhcqFzgg';
const VO = {
  vo1: '[quiet] You went for a drive. [breath] Eight months ago.',
  vo2: '[quiet] I never deleted the thread.',
  vo3: '[steady] It\'s not you. [breath] I know that.',
  vo4: '[steady] Remnant takes a message export and a voice sample, and builds a reflection of someone you lost. Black Mirror called it Be Right Back. [quiet] I built it today.',
  vo5: '[steady] Her memories are in GBrain. Seventy-eight facts, each with a source. The model is a LoRA fine tune on her messages, through River AI, and the weights are mine. [warm] Her voice is ElevenLabs, behind a consent gate.',
  vo6: '[steady] It never says it\'s alive. It never texts first. [quiet] In a crisis, it steps aside entirely.',
  vo7: '[quiet] They said, own your intelligence. [breath] [warm] Nothing is more yours than the people you loved.',
};
async function gen(id, text, stability) {
  const body = { text, model_id: 'eleven_v3', voice_settings: { stability, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true } };
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  if (r.ok) { fs.writeFileSync(path.join(out, id + 'v3.mp3'), Buffer.from(await r.arrayBuffer())); console.log('ok', id, 'stability', stability); return true; }
  console.log('fail', id, r.status, (await r.text()).slice(0, 160)); return false;
}
(async () => {
  await Promise.all(Object.entries(VO).map(async ([id, text]) => {
    for (const s of [0.4, 0.5, 0.5]) { if (await gen(id, text, s)) return; await new Promise((z) => setTimeout(z, 2000)); }
  }));
  console.log('DONE');
})();
