import type { AppState } from "../api.ts";

export function Footer({ state }: { state: AppState | null }) {
  if (!state) return <div className="footer">Loading…</div>;
  const owned = state.provider.ownedModel ? "your fine-tuned model" : state.provider.label;
  return (
    <div className="footer">
      A reflection of {state.persona.name}, built from your messages.
      <div className="footer__note">
        memory: {state.memory.kind} · model: {owned}
        {state.provider.note ? ` · ${state.provider.note}` : ""}
      </div>
    </div>
  );
}
