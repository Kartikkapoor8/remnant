import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AppState } from "../api.ts";
import { api } from "../api.ts";
import { Waveform } from "./Waveform.tsx";

interface Props {
  state: AppState;
  /** Sends a user utterance through the same persona pipeline as the thread. */
  send: (text: string) => Promise<void>;
  /** The most recent persona reply, joined; spoken when it changes. */
  lastReply: string | null;
  onEnd: () => void;
  /** Scripted demo: no audio is fetched or played; the waveform and timer still run. */
  silent?: boolean;
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Voice call screen. The call is the same persona pipeline as texting: the
 * user's utterance goes through guardrails, memory, model and StyleEnforcer,
 * and the resulting reply is spoken with ElevenLabs TTS. Typed input is used
 * for the utterance so the demo does not depend on speech recognition.
 */
export function CallScreen({ state, send, lastReply, onEnd, silent = false }: Props) {
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState("connected");
  const [utterance, setUtterance] = useState("");
  const [busy, setBusy] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const spoken = useRef<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    // Create the element inside the user's tap so iOS Safari allows playback later.
    audio.current = new Audio();
    audio.current.preload = "auto";
    return () => {
      clearInterval(id);
      audio.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (!lastReply || lastReply === spoken.current) return;
    spoken.current = lastReply;
    if (silent) {
      setStatus("speaking");
      const t = setTimeout(() => setStatus("listening"), 400 + lastReply.length * 60);
      return () => clearTimeout(t);
    }
    let url: string | null = null;
    (async () => {
      try {
        setStatus("speaking");
        const res = await fetch(api.ttsUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: lastReply }) });
        if (!res.ok) throw new Error(await res.text());
        url = URL.createObjectURL(await res.blob());
        const el = audio.current!;
        el.src = url;
        el.onended = () => setStatus("listening");
        await el.play();
      } catch (e) {
        setStatus(`voice failed: ${e instanceof Error ? e.message.slice(0, 80) : String(e)}`);
      }
    })();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [lastReply, silent]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = utterance.trim();
    if (!t || busy) return;
    setUtterance("");
    setBusy(true);
    setStatus("thinking");
    try {
      await send(t);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="call">
      <div>
        <div className="call__name">{state.persona.name}</div>
        <div className="call__timer">{fmt(seconds)}</div>
      </div>
      <Waveform active={silent || status === "speaking"} />
      <div className="call__transcript">{lastReply ?? "say something"}</div>
      <div className="call__status">
        {status} · {state.voice.label}
        <br />a reflection, built from your messages
      </div>
      <form onSubmit={submit} className="call__controls">
        <input className="call__input" value={utterance} onChange={(e) => setUtterance(e.target.value)} placeholder="Say something" enterKeyHint="send" />
        <button className="call__btn call__btn--talk" type="submit" disabled={busy || !utterance.trim()}>
          Talk
        </button>
        <button className="call__btn call__btn--end" type="button" onClick={onEnd}>
          End
        </button>
      </form>
    </div>
  );
}
