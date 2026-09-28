// LinkedIn cut voices with character-level timestamps (for caption alignment).
// Sarah: RXtWW6etvimS8QJ5nhVk on eleven_multilingual_v2. Narration: T4x5CtnhOiichhcqFzgg on eleven_v3.
// Never prints the key. Writes mp3 + .align.json to video/out/audio/li/.
// usage: node gen_li_voices_ts.cjs [idprefix]
const fs = require('fs'); const path = require('path');
const env = fs.readFileSync('/Users/kartik/hack/remnant/.env', 'utf8');
const key = (env.match(/^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/m) || [])[1];
const H = { 'xi-api-key': key, 'Content-Type': 'application/json' };
const out = '/Users/kartik/hack/remnant-explainer/video/out/audio/li';
fs.mkdirSync(out, { recursive: true });
const SARAH_VOICE = 'RXtWW6etvimS8QJ5nhVk';
const NARR_VOICE = 'T4x5CtnhOiichhcqFzgg';
const LINES = JSON.parse(fs.readFileSync(path.join(__dirname, 'li_lines.json'), 'utf8'));
const only = process.argv[2];
async function tts(id, voice, text, model, settings) {
  const body = { text, model_id: model, voice_settings: settings };
  for (let a = 0; a < 4; a++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, { method: 'POST', headers: H, body: JSON.stringify(body) });
    if (r.ok) {
      const j = await r.json();
      fs.writeFileSync(path.join(out, id + '.mp3'), Buffer.from(j.audio_base64, 'base64'));
      const al = j.normalized_alignment || j.alignment;
      fs.writeFileSync(path.join(out, id + '.align.json'), JSON.stringify({ text, characters: al.characters, start: al.character_start_times_seconds, end: al.character_end_times_seconds }));
      console.log('ok', id, 'chars', al.characters.length, 'end', al.character_end_times_seconds.at(-1));
      return;
    }
    console.log('fail', id, r.status, (await r.text()).slice(0, 160));
    await new Promise((z) => setTimeout(z, 3000));
  }
}
(async () => {
  for (const l of LINES) {
    if (only && !l.id.startsWith(only)) continue;
    if (l.who === 'sarah') await tts(l.id, SARAH_VOICE, l.tts, 'eleven_multilingual_v2', { stability: 0.35, similarity_boost: 0.8, style: 0.15, speed: 0.95, use_speaker_boost: true });
    else await tts(l.id, NARR_VOICE, l.tts, 'eleven_v3', { stability: 0.4, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true });
  }
  console.log('DONE');
})();
