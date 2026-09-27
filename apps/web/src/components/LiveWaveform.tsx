import { useEffect, useRef } from "react";

const BARS = Array.from({ length: 24 }, (_, i) => i);
const MAX = 64;
const MIN = 3;
const IDLE_ENERGY = 0.06;

/**
 * 24 bars driven by real audio: each frame reads every AnalyserNode given,
 * keeps the loudest, and maps its frequency bins onto the bars (loudest in
 * the middle, like a voice waveform). Below a small energy floor the bars
 * fall back to a slow idle sway. Same look whichever source is speaking.
 */
export function LiveWaveform({ analysers }: { analysers: AnalyserNode[] }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const heights = useRef<number[]>(BARS.map(() => MIN));
  useEffect(() => {
    const buffers = analysers.map((a) => new Uint8Array(a.frequencyBinCount));
    let frame = 0;
    const tick = (t: number) => {
      let bestIndex = -1;
      let bestEnergy = 0;
      for (let k = 0; k < analysers.length; k++) {
        const data = buffers[k]!;
        analysers[k]!.getByteFrequencyData(data);
        const usable = Math.max(1, Math.floor(data.length * 0.5));
        let e = 0;
        for (let i = 0; i < usable; i++) e += data[i]!;
        e /= usable * 255;
        if (e > bestEnergy) {
          bestEnergy = e;
          bestIndex = k;
        }
      }
      const best = bestIndex >= 0 ? buffers[bestIndex]! : null;
      for (let i = 0; i < BARS.length; i++) {
        const centered = Math.abs(i - (BARS.length - 1) / 2) / ((BARS.length - 1) / 2);
        let target: number;
        if (best && bestEnergy > IDLE_ENERGY) {
          const usable = Math.max(1, Math.floor(best.length * 0.5));
          const bin = Math.min(usable - 1, Math.floor(centered * usable));
          const v = best[bin]! / 255;
          target = MIN + v * v * (MAX - MIN);
        } else {
          target = 4 + 5 * (1 - centered) * (0.5 + 0.5 * Math.sin(t / 900 + i * 0.6));
        }
        // ease toward target so the bars feel physical rather than jittery
        const h = heights.current[i]! + (target - heights.current[i]!) * 0.35;
        heights.current[i] = h;
        const el = bars.current[i];
        if (el) el.style.height = `${h.toFixed(1)}px`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [analysers]);
  return (
    <div className="waveform" aria-hidden="true">
      {BARS.map((i) => (
        <span
          key={i}
          className="waveform__bar"
          ref={(el) => {
            bars.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}
