import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { AppState, CallScript } from "../api.ts";
import { api } from "../api.ts";
import { Avatar } from "./Avatar.tsx";
import { LiveWaveform } from "./LiveWaveform.tsx";
import { Waveform } from "./Waveform.tsx";

interface Props {
  state: AppState;
  /** Sends a user utterance through the same persona pipeline as the thread. */
  send: (text: string) => Promise<void>;
  /** The most recent persona reply, joined; spoken when it changes. */
  lastReply: string | null;
  onEnd: () => void;
  /**
   * Scripted demo: no TTS is fetched. A tap anywhere plays the next pre-rendered
   * clip from the persona's call script; after the last clip taps do nothing.
   */
  demoSlug?: string | null;
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function EndGlyph() {
  return (
    <svg className="call__end-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12c5-4.5 13-4.5 18 0l-1.5 2.5-3.5-1v-2.3a11 11 0 0 0-8 0v2.3l-3.5 1z" />
    </svg>
  );
}

/**
 * Voice call screen. The call is the same persona pipeline as texting: the
 * user's utterance goes through guardrails, memory, model and StyleEnforcer,
 * and the resulting reply is spoken with ElevenLabs TTS. Typed input is used
 * for the utterance so the demo does not depend on speech recognition.
 */
export function CallScreen({ state, send, lastReply, onEnd, demoSlug = null }: Props) {
  const silent = demoSlug !== null;
  const reduced = useReducedMotion();
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState("connected");
  const [utterance, setUtterance] = useState("");
  const [busy, setBusy] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const spoken = useRef<string | null>(null);
  const [script, setScript] = useState<CallScript | null>(null);
  const clipIndex = useRef(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const source = useRef<MediaElementAudioSourceNode | null>(null);
  const [playing, setPlaying] = useState(false);

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
    if (!demoSlug) return;
    api.callScript(demoSlug).then(setScript).catch(() => setScript(null));
  }, [demoSlug]);

  /** Demo: play the next clip through a Web Audio graph so the waveform follows the real amplitude. */
  const playNext = async () => {
    if (!demoSlug || !script || playing) return;
    const line = script.lines[clipIndex.current];
    if (!line) return;
    clipIndex.current += 1;
    const el = audio.current!;
    if (!audioCtx.current) {
      audioCtx.current = new AudioContext();
      const node = audioCtx.current.createAnalyser();
      node.fftSize = 64;
      node.smoothingTimeConstant = 0.75;
      source.current = audioCtx.current.createMediaElementSource(el);
      source.current.connect(node);
      node.connect(audioCtx.current.destination);
      setAnalyser(node);
    }
    if (audioCtx.current.state === "suspended") await audioCtx.current.resume();
    el.src = api.callClipUrl(demoSlug, line.id);
    el.onended = () => setPlaying(false);
    el.onerror = () => setPlaying(false);
    setPlaying(true);
    try {
      await el.play();
    } catch {
      setPlaying(false);
    }
  };

  useEffect(() => {
    if (silent || !lastReply || lastReply === spoken.current) return;
    spoken.current = lastReply;
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

  useEffect(() => {
    return () => {
      audioCtx.current?.close().catch(() => {});
    };
  }, []);

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

  const voiceError = status.startsWith("voice failed") ? status : null;

  return (
    <motion.div
      className="call"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0.2 : 0.4 }}
      onClick={silent ? () => void playNext() : undefined}
    >
      <div className="call__top">
        <Avatar name={state.persona.name} size={96} ring />
        <div className="call__name">{state.persona.name}</div>
        <div className="call__timer">{fmt(seconds)}</div>
      </div>
      <div className="call__middle">
        {silent && playing && analyser ? <LiveWaveform analyser={analyser} /> : <Waveform active={!silent && status === "speaking"} />}
        <div className="call__transcript">{silent ? "" : lastReply ?? ""}</div>
        <div className="call__status">
          {voiceError ?? state.voice.name}
          <br />a reflection, built from your messages
        </div>
      </div>
      <div className="call__bottom">
        {!silent && (
          <form onSubmit={submit} className="call__form">
            <input className="call__input" value={utterance} onChange={(e) => setUtterance(e.target.value)} placeholder="say something" enterKeyHint="send" />
            <button className="call__talk" type="submit" disabled={busy || !utterance.trim()}>
              talk
            </button>
          </form>
        )}
        <button
          className="call__end"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEnd();
          }}
          aria-label="End call"
        >
          <EndGlyph />
        </button>
      </div>
    </motion.div>
  );
}
