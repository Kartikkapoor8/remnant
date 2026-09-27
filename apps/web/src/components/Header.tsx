import { motion, useReducedMotion } from "motion/react";
import type { AppState } from "../api.ts";
import { relativeLabel } from "../time.ts";

interface Props {
  state: AppState | null;
  onCall: () => void;
  /** Draws attention to the call button (set by the scripted demo). */
  pulse?: boolean;
}

const RINGS = [0, 1, 2];

function PhoneGlyph() {
  return (
    <svg className="call-button__glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5L16 14l4 1.5V19a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

export function Header({ state, onCall, pulse = false }: Props) {
  const reduced = useReducedMotion();
  const name = state?.persona.name ?? "";
  const last = state?.persona.lastMessageAt ? `last real message ${relativeLabel(state.persona.lastMessageAt)}` : "";
  return (
    <header className="header">
      <div>
        <div className="header__name">{name}</div>
        <div className="header__sub">{last}</div>
      </div>
      <button className="call-button" onClick={onCall} disabled={!state?.voice.enabled} aria-label="Call">
        <PhoneGlyph />
        {pulse &&
          !reduced &&
          RINGS.map((i) => (
            <motion.span
              key={i}
              className="call-ring"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 1.4, delay: i * 1.6, ease: "easeOut" }}
            />
          ))}
      </button>
    </header>
  );
}
