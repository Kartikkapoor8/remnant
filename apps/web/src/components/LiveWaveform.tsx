import { useEffect, useRef } from "react";

const BARS = Array.from({ length: 24 }, (_, i) => i);
const MAX = 64;
const MIN = 3;

/**
 * 24 bars driven by real audio amplitude: an AnalyserNode's frequency bins are
 * mapped onto the bars each animation frame. Used on the call screen while a
 * clip is playing; the motion-driven Waveform handles idle sway.
 */
export function LiveWaveform({ analyser }: { analyser: AnalyserNode }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const usable = Math.floor(data.length * 0.6); // speech lives in the lower bins
      for (let i = 0; i < BARS.length; i++) {
        // mirror around the center so the loudest bins sit in the middle
        const centered = Math.abs(i - (BARS.length - 1) / 2) / ((BARS.length - 1) / 2);
        const bin = Math.min(usable - 1, Math.floor(centered * usable));
        const v = data[bin]! / 255;
        const h = MIN + v * v * (MAX - MIN);
        const el = bars.current[i];
        if (el) el.style.height = `${h.toFixed(1)}px`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [analyser]);
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
