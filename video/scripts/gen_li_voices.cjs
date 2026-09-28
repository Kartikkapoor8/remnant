// LinkedIn cut voices. Sarah: voice RXtWW6etvimS8QJ5nhVk on eleven_multilingual_v2. Narration: T4x5CtnhOiichhcqFzgg on eleven_v3.
// Never prints the key. Writes to video/out/audio/li/.
const fs = require('fs'); const path = require('path');
const env = fs.readFileSync('/Users/kartik/hack/remnant/.env', 'utf8');
const key = (env.match(/^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/m) || [])[1];
const H = { 'xi-api-key': key, 'Content-Type': 'application/json' };
const out = '/Users/kartik/hack/remnant-explainer/video/out/audio/li';
fs.mkdirSync(out, { recursive: true });
const SARAH_VOICE = 'RXtWW6etvimS8QJ5nhVk';
const NARR_VOICE = 'T4x5CtnhOiichhcqFzgg';
const SARAH = [
  ['sarah1', 'hi.'],
  ['sarah2', 'I know.'],
  ['sarah3', "You had the hackathon today. How'd it actually go."],
  ['sarah4', 'You said ok every time it went well.'],
  ['sarah5', "It's Sunday. Tuesday I'd have been at the salon. Eleven, same as always."],
  ['sarah6', 'Go get some sleep. <break time="1.0s" /> Love you.'],
];
const NARR = [
  ['nar4', '[warm] I built this in one afternoon, at a YC hackathon. A message export, a voice sample, and Remnant builds a reflection of someone you lost.'],
  ['nar5', '[steady] Her memory is in GBrain. The model is a LoRA on her messages, through River. Her voice is ElevenLabs, behind a consent gate. The memory and the weights are mine, not a company\'s.'],
  ['nar6', '[steady] Never claims to be alive, never texts first, and in a crisis it steps aside.'],
  ['nar7', '[quiet] They said, own your intelligence. Nothing is more yours than the people you loved.'],
];
const only = process.argv[2]; // optional id filter, e.g. "nar4" or "sarah"
async function tts(id, voice, text, model, settings) {
  const f = path.join(out, id + '.mp3');
  const body = { text, model_id: model, voice_settings: settings };
  for (let a = 0; a < 4; a++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, { method: 'POST', headers: H, body: JSON.stringify(body) });
    if (r.ok) { fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); console.log('ok', id); return; }
    console.log('fail', id, r.status, (await r.text()).slice(0, 160));
    await new Promise((z) => setTimeout(z, 3000));
  }
}
(async () => {
  const jobs = [];
  for (const [id, t] of SARAH) if (!only || id.startsWith(only)) jobs.push(() => tts(id, SARAH_VOICE, t, 'eleven_multilingual_v2', { stability: 0.35, similarity_boost: 0.8, style: 0.15, speed: 0.95, use_speaker_boost: true }));
  for (const [id, t] of NARR) if (!only || id.startsWith(only)) jobs.push(() => tts(id, NARR_VOICE, t, 'eleven_v3', { stability: 0.4, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true }));
  // sequential: the account's concurrency limit is low
  for (const j of jobs) await j();
  console.log('DONE');
})();
