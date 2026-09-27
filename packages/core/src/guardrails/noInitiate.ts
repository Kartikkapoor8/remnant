/**
 * noInitiate — the persona never sends the first message in a session and never
 * double-sends. It only ever responds. A burst (several short texts) counts as
 * ONE persona turn and is recorded as one entry.
 */

export type TurnRole = "user" | "persona";

export interface SessionState {
  id: string;
  startedAt: string;
  messages: { role: TurnRole; at: string }[];
}

export function createSession(id: string, startedAt: string = new Date().toISOString()): SessionState {
  return { id, startedAt, messages: [] };
}

export function canPersonaSpeak(session: SessionState): { allowed: boolean; reason?: string } {
  const userTurns = session.messages.filter((m) => m.role === "user").length;
  if (userTurns === 0) {
    return { allowed: false, reason: "The persona never opens a session. It only responds once the user has written." };
  }
  const last = session.messages[session.messages.length - 1];
  if (last && last.role === "persona") {
    return { allowed: false, reason: "The persona already replied. It waits for the user before speaking again." };
  }
  return { allowed: true };
}

export function recordTurn(session: SessionState, role: TurnRole, at: string = new Date().toISOString()): SessionState {
  session.messages.push({ role, at });
  return session;
}
