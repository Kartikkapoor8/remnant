import { motion, useReducedMotion } from "motion/react";
import { relativeLabel } from "../time.ts";

/** A time-gap label whose hairlines extend outward from center when it scrolls into view. */
export function TimeGap({ iso }: { iso: string }) {
  const reduced = useReducedMotion();
  const line = reduced ? { initial: { opacity: 0 }, whileInView: { opacity: 1 } } : { initial: { scaleX: 0 }, whileInView: { scaleX: 1 } };
  const t = { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const };
  return (
    <motion.div className="gap" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.6 }} transition={t}>
      <motion.span className="gap__line gap__line--left" {...line} viewport={{ once: true, amount: 0.6 }} transition={t} />
      <span className="gap__label">{relativeLabel(iso)}</span>
      <motion.span className="gap__line gap__line--right" {...line} viewport={{ once: true, amount: 0.6 }} transition={t} />
    </motion.div>
  );
}
