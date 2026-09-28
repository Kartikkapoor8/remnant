// Builds a sample-accurate gain curve (float32 stereo WAV) that flattens a music track to a constant
// short-term loudness, dips it under voice, and fades the ends. Used with ffmpeg's amultiply.
// usage: node li_music_curve.cjs <ffmpeg> <music> <out.wav> <srcStart> <duration> <targetLUFS> <duckDb> "<a:b,a:b,...>" [fadeIn] [fadeOut]
const fs = require('fs'); const { execFileSync } = require('child_process');
const [ffmpeg, music, out, srcStartS, durationS, targetS, duckS, ducksS, fadeInS, fadeOutS] = process.argv.slice(2);
const srcStart = +srcStartS, duration = +durationS, target = +targetS, duckDb = +duckS;
const fadeIn = fadeInS ? +fadeInS : 1.0, fadeOut = fadeOutS ? +fadeOutS : 2.0;
const ducks = (ducksS || '').split(',').filter(Boolean).map((p) => p.split(':').map(Number));
const SR = 48000;

// 1. short-term loudness of the source every 100 ms (ebur128 S = 3 s window, reported at its end)
const metaFile = out + '.meta.txt';
execFileSync(ffmpeg, ['-hide_banner', '-nostats', '-v', 'error', '-i', music, '-af', `ebur128=metadata=1,ametadata=mode=print:key=lavfi.r128.S:file=${metaFile}`, '-f', 'null', '-']);
const lines = fs.readFileSync(metaFile, 'utf8').split('\n');
const pts = [], S = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/pts_time:([0-9.]+)/);
  if (m) { const v = lines[i + 1] && lines[i + 1].match(/lavfi\.r128\.S=(-?[0-9.]+)/); if (v) { pts.push(+m[1] - 1.5); S.push(Math.max(-70, +v[1])); } }
}
// 2. smooth S over +-1.5 s, then invert to a gain in dB, clamped
function sAt(t) { // linear interpolation on the (centred) short-term curve
  if (t <= pts[0]) return S[0]; if (t >= pts[pts.length - 1]) return S[S.length - 1];
  let lo = 0, hi = pts.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid] <= t) lo = mid; else hi = mid; }
  const f = (t - pts[lo]) / (pts[hi] - pts[lo]); return S[lo] + f * (S[hi] - S[lo]);
}
function smoothS(t) { let acc = 0, n = 0; for (let d = -1.5; d <= 1.5; d += 0.1) { acc += sAt(t + d); n++; } return acc / n; }
function duckAt(t) { // 0..1, 0.3 s attack, 0.8 s release
  let d = 0; for (const [a, b] of ducks) { const up = Math.min(1, Math.max(0, (t - (a - 0.3)) / 0.3)); const down = Math.min(1, Math.max(0, ((b + 0.8) - t) / 0.8)); d = Math.max(d, Math.min(up, down)); } return d;
}
const gainDbAt = (t) => { // t = seconds into the cut
  const src = srcStart + t;
  let g = target - smoothS(src); g = Math.max(-30, Math.min(18, g));
  g += duckDb * duckAt(t);
  let lin = Math.pow(10, g / 20);
  if (t < fadeIn) lin *= t / fadeIn;
  if (t > duration - fadeOut) lin *= Math.max(0, (duration - t) / fadeOut);
  return lin;
};
// 3. write float32 stereo WAV, gain evaluated every 10 ms and linearly interpolated per sample
const n = Math.round(duration * SR);
const step = SR / 100; const knots = []; for (let k = 0; k <= Math.ceil(n / step) + 1; k++) knots.push(gainDbAt((k * step) / SR));
const data = Buffer.alloc(n * 2 * 4);
for (let i = 0; i < n; i++) { const k = Math.floor(i / step); const f = i / step - k; const g = knots[k] + f * (knots[k + 1] - knots[k]); data.writeFloatLE(g, i * 8); data.writeFloatLE(g, i * 8 + 4); }
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(3, 20); hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 8, 28); hdr.writeUInt16LE(8, 32); hdr.writeUInt16LE(32, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
fs.writeFileSync(out, Buffer.concat([hdr, data]));
const dbg = []; for (let t = 0; t < duration; t += 5) dbg.push(`${t}:${(20 * Math.log10(Math.max(1e-6, gainDbAt(t + 0.5)))).toFixed(1)}`);
console.log(`music curve: src ${srcStart}-${(srcStart + duration).toFixed(1)} s flattened to ${target} LUFS short-term, duck ${duckDb} dB under ${ducks.length} voice spans; gain dB every 5 s: ${dbg.join(' ')}`);
