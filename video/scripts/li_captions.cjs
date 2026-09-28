// Burned-in caption builder for the LinkedIn cut.
// Reads the audio timeline the build wrote, gets word timestamps for every clip from ElevenLabs
// speech-to-text (cached), and writes an ASS file per aspect plus SRT files.
// usage: node li_captions.cjs <timeline.json> <ffmpeg> <outdir-ass> <outdir-srt>
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const [timelinePath, ffmpeg, assDir, srtDir] = process.argv.slice(2);
const env = fs.readFileSync('/Users/kartik/hack/remnant/.env', 'utf8');
const key = (env.match(/^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/m) || [])[1];
const tl = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
const sttDir = path.join(path.dirname(timelinePath), 'stt');
fs.mkdirSync(sttDir, { recursive: true }); fs.mkdirSync(assDir, { recursive: true }); fs.mkdirSync(srtDir, { recursive: true });
const PAD = 0.4;

async function words(item) {
  const cache = path.join(sttDir, item.id + '.json');
  const stat = fs.statSync(item.file);
  if (fs.existsSync(cache)) { const c = JSON.parse(fs.readFileSync(cache, 'utf8')); if (c.mtime === stat.mtimeMs) return c.words; }
  const padded = path.join(sttDir, item.id + '.padded.wav');
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', item.file, '-af', `adelay=${PAD * 1000}|${PAD * 1000},apad=pad_dur=0.5`, '-ac', '1', '-ar', '16000', padded]);
  const fd = new FormData();
  fd.append('model_id', 'scribe_v1'); fd.append('timestamps_granularity', 'word'); fd.append('language_code', 'eng');
  fd.append('file', new Blob([fs.readFileSync(padded)], { type: 'audio/wav' }), item.id + '.wav');
  let w = [];
  for (let a = 0; a < 3; a++) {
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: fd });
    if (!r.ok) { console.log('stt fail', item.id, r.status); await new Promise((z) => setTimeout(z, 2500)); continue; }
    const j = await r.json();
    w = (j.words || []).filter((x) => x.type === 'word').map((x) => ({ text: x.text, start: Math.max(0, x.start - PAD), end: Math.max(0, x.end - PAD) }));
    console.log(`stt ${item.id}: ${j.text}`);
    break;
  }
  fs.writeFileSync(cache, JSON.stringify({ mtime: stat.mtimeMs, words: w }));
  return w;
}

function clipDuration(file) {
  const out = execFileSync(ffmpeg, ['-i', file, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  return 0;
}

(async () => {
  const events = [];
  for (const item of tl.items) {
    const w = await words(item);
    const chunks = item.caption.split('|').map((s) => s.trim()).filter(Boolean);
    const chunkWords = chunks.map((c) => c.split(/\s+/).length);
    const total = chunkWords.reduce((a, b) => a + b, 0);
    let spans = [];
    if (w.length === total) {
      let i = 0;
      for (const n of chunkWords) { spans.push([w[i].start, w[i + n - 1].end]); i += n; }
    } else {
      console.log(`  word count mismatch for ${item.id}: stt ${w.length} vs caption ${total}; using proportional timing`);
      const s0 = w.length ? w[0].start : 0; const s1 = w.length ? w[w.length - 1].end : item.dur;
      const chars = chunks.map((c) => c.length); const sum = chars.reduce((a, b) => a + b, 0);
      let acc = 0;
      for (const c of chars) { const a = s0 + ((s1 - s0) * acc) / sum; acc += c; const b = s0 + ((s1 - s0) * acc) / sum; spans.push([a, b]); }
    }
    spans.forEach(([a, b], k) => {
      events.push({ id: item.id, who: item.who, start: item.start + a - 0.1, end: item.start + b + 0.5, text: chunks[k] });
    });
  }
  events.sort((a, b) => a.start - b.start);
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.end - e.start < 1.0) e.end = e.start + 1.0;
    if (i + 1 < events.length && e.end > events[i + 1].start - 0.03) e.end = Math.max(e.start + 0.4, events[i + 1].start - 0.03);
  }
  const t = (s) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60; return `${h}:${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`; };
  const tSrt = (s) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = Math.floor(s % 60); const ms = Math.round((s - Math.floor(s)) * 1000); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`; };
  const styles = {
    169: { w: 1920, h: 1080, size: 38, ml: 160, mv: 78 },
    45: { w: 1080, h: 1350, size: 42, ml: 80, mv: 150 },
  };
  for (const [k, s] of Object.entries(styles)) {
    const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${s.w}\nPlayResY: ${s.h}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Cap,Inter,${s.size},&H00DFE8ED,&H00DFE8ED,&H99000000,&H00000000,0,0,0,0,100,100,0,0,1,1.4,0,2,${s.ml},${s.ml},${s.mv},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
    const body = events.map((e) => `Dialogue: 0,${t(e.start)},${t(e.end)},Cap,,0,0,0,,${e.text}`).join('\n') + '\n';
    fs.writeFileSync(path.join(assDir, `cap_${k}.ass`), head + body);
    const srt = events.map((e, i) => `${i + 1}\n${tSrt(e.start)} --> ${tSrt(e.end)}\n${e.text}\n`).join('\n');
    fs.writeFileSync(path.join(srtDir, `remnant_linkedin_${k === '169' ? '16x9' : '4x5'}.srt`), srt);
  }
  fs.writeFileSync(path.join(path.dirname(timelinePath), 'li_captions.json'), JSON.stringify(events, null, 1));
  console.log(`${events.length} caption events`);
  for (const e of events) console.log(`${e.start.toFixed(2)}-${e.end.toFixed(2)} [${e.who}] ${e.text}`);
})();
