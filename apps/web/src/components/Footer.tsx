import type { AppState, HealthReport } from "../api.ts";

/** "gbrain-stdio" and "gbrain-http" are both gbrain to the person reading the footer. */
function memoryLabel(backend: HealthReport["memory"]): string {
  return backend.startsWith("gbrain") ? "gbrain" : backend;
}

export function Footer({ state, health }: { state: AppState | null; health: HealthReport | null }) {
  if (!state || !health) return <div className="footer">Loading…</div>;
  const owned = health.ownedModel ? "your fine-tuned model" : health.providerLabel;
  return (
    <div className="footer">
      A reflection of {state.persona.name}, built from your messages.
      <div className="footer__note">
        memory: {memoryLabel(health.memory)} · model: {owned}
        {health.providerNote ? ` · ${health.providerNote}` : ""}
      </div>
    </div>
  );
}
