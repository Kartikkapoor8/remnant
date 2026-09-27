import { motion, useReducedMotion } from "motion/react";
import type { ThreadItem } from "../hooks/useConversation.ts";

interface Props {
  item: ThreadItem;
  /** Newly arrived in this session: springs in. History renders still. */
  arriving: boolean;
}

export function MessageBubble({ item, arriving }: Props) {
  const reduced = useReducedMotion();
  const cls = item.sender === "me" ? "bubble bubble--me" : "bubble bubble--them";
  const title = item.memories?.length ? `memories: ${item.memories.join(", ")}` : undefined;
  if (!arriving) {
    return (
      <div className={cls} title={title}>
        {item.text}
      </div>
    );
  }
  return (
    <motion.div
      className={cls}
      title={title}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduced ? { duration: 0.2 } : { type: "spring", stiffness: 380, damping: 28 }}
    >
      {item.text}
    </motion.div>
  );
}
