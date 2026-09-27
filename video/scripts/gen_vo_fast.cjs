// Regenerates VO 4-7 scratch at a faster pace so they fit the explainer scenes. Never prints the key.
const fs = require('fs'); const path = require('path');
const env = fs.readFileSync('/Users/kartik/hack/remnant/.env', 'utf8');
const key = (env.match(/^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/m) || [])[1];
const H = { 'xi-api-key': key, 'Content-Type': 'application/json' };
const out = '/Users/kartik/hack/remnant-explainer/video/out/audio/raw';
const VO = {
  vo4: 'Remnant takes a message export and a voice sample and builds a reflection of someone you lost. Black Mirror called it Be Right Back. I built it today.',
  vo5: 'Her memories are in GBrain. Seventy-eight facts, each with a source. The model is a LoRA fine tune on her messages through River AI, and the weights are mine. Her voice is ElevenLabs, behind a consent gate.',
  vo6: "It never says it's alive. It never texts first. In a crisis it steps aside entirely.",
  vo7: 'They said own your intelligence. Nothing is more yours than the people you loved.',
};
(async () => {
  await Promise.all(Object.entries(VO).map(async ([id, text]) => {
    const body = { text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.6, similarity_boost: 0.75, style: 0.0, speed: 1.15, use_speaker_boost: true } };
    for (let a = 0; a < 3; a++) {
      const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128', { method: 'POST', headers: H, body: JSON.stringify(body) });
      if (r.ok) { fs.writeFileSync(path.join(out, id + 'f.mp3'), Buffer.from(await r.arrayBuffer())); console.log('ok', id + 'f'); return; }
      console.log('fail', id, r.status, (await r.text()).slice(0, 120)); await new Promise((s) => setTimeout(s, 2500));
    }
  }));
  console.log('DONE');
})();
