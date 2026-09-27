import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const WORD = "REMNANT";
const GLYPHS = "0123456789ABCDEF";
const RESOLVE_MS = 900;
const TICK_MS = 40;

/**
 * App-open wordmark: characters cycle through hex glyphs and resolve left to
 * right over 900ms, then the overlay fades to reveal the thread. Once per load.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const [chars, setChars] = useState<string[]>(() => (reduced ? WORD.split("") : WORD.split("").map(() => GLYPHS[0]!)));
  const [resolved, setResolved] = useState(reduced ? WORD.length : 0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => setLeaving(true), 500);
      return () => clearTimeout(t);
    }
    const start = performance.now();
    const id = setInterval(() => {
      const elapsed = performance.now() - start;
      const done = Math.min(WORD.length, Math.floor((elapsed / RESOLVE_MS) * WORD.length));
      setResolved(done);
      setChars(WORD.split("").map((ch, i) => (i < done ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!)));
      if (elapsed >= RESOLVE_MS) {
        clearInterval(id);
        setChars(WORD.split(""));
        setResolved(WORD.length);
        setTimeout(() => setLeaving(true), 350);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <motion.div
      className="intro"
      initial={{ opacity: 1 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.4 }}
      onAnimationComplete={() => {
        if (leaving) onDone();
      }}
    >
      <div className="wordmark" aria-label={WORD}>
        {chars.map((ch, i) => (
          <span key={i} className={i < resolved ? "wordmark__char" : "wordmark__char wordmark__char--pending"}>
            {ch}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
