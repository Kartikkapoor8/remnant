import { motion, useReducedMotion } from "motion/react";

const BARS = Array.from({ length: 24 }, (_, i) => i);
/** Fixed per-bar amplitude profile so the speaking state looks alive but deterministic. */
const PROFILE = [0.35, 0.6, 0.8, 0.5, 0.9, 0.7, 1, 0.55, 0.85, 0.4, 0.75, 0.95, 0.95, 0.75, 0.4, 0.85, 0.55, 1, 0.7, 0.9, 0.5, 0.8, 0.6, 0.35];
const MAX = 64;

/** 24 amber bars: idle sway when silent, energetic when speaking. Bars rise from 0 on enter with a 20ms stagger. */
export function Waveform({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  return (
    <div className="waveform" aria-hidden="true">
      {BARS.map((i) => {
        const peak = MAX * PROFILE[i]!;
        const idle = 4 + 6 * PROFILE[i]!;
        if (reduced) return <span key={i} className="waveform__bar" style={{ height: active ? peak * 0.6 : idle }} />;
        return (
          <motion.span
            key={i}
            className="waveform__bar"
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: active ? [idle, peak, idle * 1.5, peak * 0.7, idle] : [idle, idle + 6, idle],
              opacity: 1,
            }}
            transition={{
              opacity: { duration: 0.3, delay: i * 0.02 },
              height: {
                delay: i * 0.02,
                duration: active ? 0.7 + (i % 5) * 0.06 : 1.8 + (i % 4) * 0.2,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
          />
        );
      })}
    </div>
  );
}
