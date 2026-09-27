import type { EngineResult, MemoryHit, Message, PersonaProfile } from "@remnant/core";

export interface AppState {
  persona: PersonaProfile;
  history: Message[];
  corpus: { messages: number; source: string; skipped: number };
  provider: { id: string; label: string; ownedModel: boolean; note: string | null };
  memory: { kind: string; note: string | null };
  style: string;
  greeting: string | null;
  consent: { allowed: boolean; reason: string };
  voice: { enabled: boolean; cloned: boolean; voiceId: string | null; label: string; cloneAllowed: boolean; cloneReason: string };
}

export type ChatResult = EngineResult;
export type { MemoryHit, Message };

async function expectOk<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export const api = {
  state: () => fetch("/api/state").then((r) => expectOk<AppState>(r)),
  chat: (sessionId: string, text: string) =>
    fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, text }) }).then(
      async (r) => (r.status === 403 ? ((await r.json()) as ChatResult) : expectOk<ChatResult>(r)),
    ),
  consent: (grantedBy: string, statement: string) =>
    fetch("/api/consent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grantedBy, statement }) }).then((r) =>
      expectOk<{ ok: true }>(r),
    ),
  ttsUrl: "/api/voice/tts",
};
