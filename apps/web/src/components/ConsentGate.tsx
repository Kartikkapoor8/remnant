import { useState } from "react";
import type { AppState } from "../api.ts";
import { api } from "../api.ts";

interface Props {
  state: AppState;
  onDone: () => Promise<void>;
}

export function ConsentGate({ state, onDone }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const p = state.persona;
  const statement = `I am ${p.name}'s ${p.relationship}. ${p.name} has died. I am building a reflection from messages ${p.name} sent to me, for myself, and I understand it is not ${p.name}.`;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.consent(name.trim(), statement);
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <h1>Before anything else</h1>
      <p>{state.consent.reason}</p>
      <p>{statement}</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
      <button onClick={submit} disabled={busy || name.trim().length < 2}>
        I attest to this
      </button>
      {err && <p>{err}</p>}
    </div>
  );
}
