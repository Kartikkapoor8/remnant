import { useCallback, useEffect, useRef, useState } from "react";
import { api, type AppState, type ChatResult, type Message } from "../api.ts";

export interface ThreadItem extends Message {
  id: string;
  /** Present on persona replies: which memories the engine retrieved. */
  memories?: string[];
}

export interface CrisisCardData {
  message: string;
  resources: { name: string; contact: string; region: string; url?: string }[];
}

export interface Conversation {
  state: AppState | null;
  error: string | null;
  items: ThreadItem[];
  typing: boolean;
  crisis: CrisisCardData | null;
  blocked: string | null;
  lastReply: string | null;
  send: (text: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function newSessionId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Owns the thread: real history first, then user turns and persona bursts arriving one at a time. */
export function useConversation(): Conversation {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [typing, setTyping] = useState(false);
  const [crisis, setCrisis] = useState<CrisisCardData | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [lastReply, setLastReply] = useState<string | null>(null);
  const sessionId = useRef(newSessionId());

  const refresh = useCallback(async () => {
    try {
      const s = await api.state();
      setState(s);
      setItems(s.history.map((m, i) => ({ ...m, id: `h-${i}` })));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    setItems((prev) => [...prev, { id: `u-${Date.now()}`, sender: "me", text: trimmed, timestamp: now }]);
    setCrisis(null);
    setBlocked(null);
    let result: ChatResult;
    try {
      setTyping(true);
      result = await api.chat(sessionId.current, trimmed);
    } catch (e) {
      setTyping(false);
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    if (result.kind === "crisis") {
      setTyping(false);
      setCrisis({ message: result.message, resources: result.resources });
      return;
    }
    if (result.kind === "blocked") {
      setTyping(false);
      setBlocked(result.reason);
      return;
    }
    const memories = result.memoriesUsed.map((m) => m.source);
    for (let i = 0; i < result.bursts.length; i++) {
      setTyping(true);
      await sleep(result.delaysMs[i] ?? 800);
      setTyping(false);
      const burst = result.bursts[i]!;
      setItems((prev) => [
        ...prev,
        { id: `p-${Date.now()}-${i}`, sender: "them", text: burst, timestamp: new Date().toISOString(), memories: i === 0 ? memories : undefined },
      ]);
      if (i < result.bursts.length - 1) await sleep(250);
    }
    setLastReply(result.bursts.join(". "));
  }, []);

  return { state, error, items, typing, crisis, blocked, lastReply, send, refresh };
}
