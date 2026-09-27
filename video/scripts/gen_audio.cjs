// Generates Sarah lines, scratch male lines, scratch VO and SFX via ElevenLabs.
// Never prints the key. Writes mp3s to video/out/audio/raw.
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync('/Users/kartik/hack/remnant/.env', 'utf8');
const key = (env.match(/^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/m) || [])[1];
if (!key) { console.error('ELEVENLABS_API_KEY not found in .env'); process.exit(1); }
const H = { 'xi-api-key': key, 'Content-Type': 'application/json' };
const out = '/Users/kartik/hack/remnant-explainer/video/out/audio/raw';
fs.mkdirSync(out, { recursive: true });

const SARAH = [
  ['s1', 'hi.'],
  ['s2', 'I know.'],
  ['s3', "You had the hackathon today. How'd it actually go."],
  ['s4', 'You said ok every time it went well.'],
  ['s5', "It's Sunday. Tuesday I'd have been at the salon. Eleven, same as always."],
  ['s6', 'Go get some sleep. <break time="1.2s" /> Love you.'],
];
const ME = [
  ['me1', 'hi.'],
  ['me2', 'I missed you.'],
  ['me3', 'ok.'],
];
const VO = [
  ['vo1', 'You went for a drive. Eight months ago.'],
  ['vo2', 'I never deleted the thread.'],
  ['vo3', "It's not you. I know that."],
  ['vo4', 'Remnant takes a message export and a voice sample and builds a reflection of someone you lost. Black Mirror called it Be Right Back. I built it today.'],
  ['vo5', 'Her memories are in GBrain. Seventy-eight facts, each with a source. The model is a LoRA fine tune on her messages through River AI, and the weights are mine. Her voice is ElevenLabs, behind a consent gate.'],
  ['vo6', "It never says it's alive. It never texts first. In a crisis it steps aside entirely."],
  ['vo7', 'They said own your intelligence. Nothing is more yours than the people you loved.'],
];
const SFX = [
  ['sfx_rain', 'steady heavy rain on a car windshield at night, no music', 20],
  ['sfx_horn', 'a single long car horn approaching fast and getting louder, doppler, ends abruptly', 5],
  ['sfx_thud', 'one deep sub bass thud impact, cinematic, short', 2],
  ['sfx_hiss', 'quiet telephone line hiss, steady, no voices, no music', 20],
  ['sfx_room', 'very quiet empty room tone, faint hum, no voices', 20],
];

async function getVoices() {
  const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: H });
  if (!r.ok) throw new Error('voices ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return j.voices || [];
}
function pick(voices, names) {
  for (const n of names) {
    const v = voices.find((x) => x.name && x.name.toLowerCase() === n.toLowerCase());
    if (v) return v;
  }
  return null;
}
async function tts(id, name, text, settings) {
  const f = path.join(out, id + '.mp3');
  if (fs.existsSync(f) && fs.statSync(f).size > 1000) { console.log('skip', id); return; }
  const body = { text, model_id: 'eleven_multilingual_v2', voice_settings: settings };
  for (let a = 0; a < 3; a++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${name}?output_format=mp3_44100_128`, { method: 'POST', headers: H, body: JSON.stringify(body) });
    if (r.ok) { fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); console.log('ok', id); return; }
    const t = await r.text();
    console.log('fail', id, r.status, t.slice(0, 200));
    if (r.status === 429) await new Promise((s) => setTimeout(s, 3000)); else if (a === 2) return;
  }
}
async function sfx(id, text, dur) {
  const f = path.join(out, id + '.mp3');
  if (fs.existsSync(f) && fs.statSync(f).size > 1000) { console.log('skip', id); return; }
  for (let a = 0; a < 3; a++) {
    const r = await fetch('https://api.elevenlabs.io/v1/sound-generation', { method: 'POST', headers: H, body: JSON.stringify({ text, duration_seconds: dur, prompt_influence: 0.5 }) });
    if (r.ok) { fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); console.log('ok', id); return; }
    const t = await r.text();
    console.log('fail', id, r.status, t.slice(0, 200));
    if (r.status === 429) await new Promise((s) => setTimeout(s, 3000)); else if (a === 2) return;
  }
}
async function pool(tasks, n) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) { const t = tasks[i++]; try { await t(); } catch (e) { console.log('err', e.message); } } }));
}
(async () => {
  const voices = await getVoices();
  const sarah = pick(voices, ["Sarah", "Matilda"]) || { name: "Sarah(premade id)", voice_id: "EXAVITQu4vr4xnSDxMaL" };
  const male = pick(voices, ["George", "Brian", "Daniel", "Liam", "Bill", "Callum", "Adam"]) || { name: "George(premade id)", voice_id: "JBFqnCBsd6RMkjVDRZzb" };
  console.log('sarah voice:', sarah && sarah.name, '| male voice:', male && male.name);
  const sarahSettings = { stability: 0.35, similarity_boost: 0.8, style: 0.15, speed: 0.95, use_speaker_boost: true };
  const maleSettings = { stability: 0.6, similarity_boost: 0.75, style: 0.0, speed: 0.92, use_speaker_boost: true };
  const tasks = [];
  if (sarah) for (const [id, t] of SARAH) tasks.push(() => tts(id, sarah.voice_id, t, sarahSettings));
  if (male) for (const [id, t] of [...ME, ...VO]) tasks.push(() => tts(id, male.voice_id, t, maleSettings));
  for (const [id, t, d] of SFX) tasks.push(() => sfx(id, t, d));
  await pool(tasks, 3);
  console.log('DONE');
})();
