import type { AppState } from "../api.ts";
import { relativeLabel } from "../time.ts";

interface Props {
  state: AppState | null;
  onCall: () => void;
}

export function Header({ state, onCall }: Props) {
  const name = state?.persona.name ?? "…";
  const last = state?.persona.lastMessageAt ? `last real message ${relativeLabel(state.persona.lastMessageAt)}` : "";
  return (
    <header className="header">
      <div>
        <div className="header__name">{name}</div>
        <div className="header__sub">{last}</div>
      </div>
      <button className="header__call" onClick={onCall} disabled={!state?.voice.enabled}>
        Call
      </button>
    </header>
  );
}
