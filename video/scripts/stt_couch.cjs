// Transcribes couch source audio with ElevenLabs speech-to-text (word timestamps + diarization)
// to locate the user's spoken call lines. Never prints the key.
// usage: node stt_couch.cjs <ffmpeg> <file.MOV> [more files...]
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const env = fs.readFileSync('/Users/kartik/hack/remnant/.env', 'utf8');
const key = (env.match(/^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/m) || [])[1];
const [ffmpeg, ...files] = process.argv.slice(2);
const out = '/Users/kartik/hack/remnant-explainer/video/out/audio/stt';
fs.mkdirSync(out, { recursive: true });
(async () => {
  for (const f of files) {
    const base = path.basename(f).replace(/\.[^.]+$/, '');
    const wav = path.join(out, base + '.16k.wav');
    execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', f, '-map', '0:a:0', '-ac', '1', '-ar', '16000', wav]);
    const fd = new FormData();
    fd.append('model_id', 'scribe_v1');
    fd.append('diarize', 'true');
    fd.append('timestamps_granularity', 'word');
    fd.append('tag_audio_events', 'true');
    fd.append('language_code', 'eng');
    fd.append('file', new Blob([fs.readFileSync(wav)], { type: 'audio/wav' }), base + '.wav');
    let ok = false;
    for (let a = 0; a < 3 && !ok; a++) {
      const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: fd });
      if (!r.ok) { console.log('fail', base, r.status, (await r.text()).slice(0, 200)); await new Promise((z) => setTimeout(z, 3000)); continue; }
      const j = await r.json();
      fs.writeFileSync(path.join(out, base + '.json'), JSON.stringify(j, null, 1));
      console.log(`== ${base}: ${j.text}`);
      const words = (j.words || []).filter((w) => w.type === 'word' || w.type === 'audio_event');
      console.log(words.map((w) => `${w.start.toFixed(2)}-${w.end.toFixed(2)} ${w.speaker_id || ''} ${w.text}`).join('\n'));
      ok = true;
    }
  }
})();
