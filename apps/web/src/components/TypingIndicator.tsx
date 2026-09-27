import { motion, useReducedMotion } from "motion/react";

const DOTS = [0, 1, 2];

/** Three dots pulsing in a wave; the amber glow behind the bubble breathes with them. */
export function TypingIndicator({ cycleSeconds = 1.2 }: { cycleSeconds?: number }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <div className="typing" aria-label="typing">
        {DOTS.map((i) => (
          <span key={i} className="typing__dot" />
        ))}
      </div>
    );
  }
  return (
    <motion.div
      className="typing"
      aria-label="typing"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, boxShadow: ["0 0 16px rgba(201,164,106,0.18)", "0 0 28px rgba(201,164,106,0.4)", "0 0 16px rgba(201,164,106,0.18)"] }}
      transition={{ opacity: { duration: 0.25 }, y: { type: "spring", stiffness: 380, damping: 28 }, boxShadow: { duration: cycleSeconds, repeat: Infinity, ease: "easeInOut" } }}
    >
      {DOTS.map((i) => (
        <motion.span
          key={i}
          className="typing__dot"
          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: cycleSeconds, repeat: Infinity, ease: "easeInOut", delay: i * (cycleSeconds / 6) }}
        />
      ))}
    </motion.div>
  );
}
