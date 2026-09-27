import { useCallback, useEffect, useRef, useState } from "react";
import { api, type CallScript } from "../api.ts";

/**
 * Voice-driven scripted call (demo mode only).
 *
 * - One AudioContext. The clip <audio> element and the microphone each feed
 *   an AnalyserNode; the waveform reads whichever is louder.
 * - Energy VAD on the mic: speech starts after RMS > threshold for 150ms and
 *   ends after 1100ms below it. The VAD is muted while a clip plays and for
 *   600ms after, so her voice from the speaker never counts as the user.
 * - Each clip has a trigger: after_user (delay after the user's speech ends)
 *   or auto (delay after the previous clip ends). A tap anywhere forces the
 *   next clip so a take cannot get stuck. Mic denied -> tap mode, silently.
 */

const VAD_THRESHOLD = 0.02;
const VAD_START_MS = 150;
const VAD_END_MS = 1100;
const POST_CLIP_MUTE_MS = 600;
const FADE_IN_S = 0.15;
const FADE_OUT_S = 0.25;
const LINE_NOISE_SRC = "/line-noise.m4a";
const LINE_NOISE_GAIN = 0.04;

export interface DemoCall {
  analysers: AnalyserNode[];
  playing: boolean;
  userSpeaking: boolean;
  micGranted: boolean | null;
  done: boolean;
  forceNext: () => void;
}

export function useDemoCall(slug: string | null, audioEl: HTMLAudioElement | null): DemoCall {
  const [script, setScript] = useState<CallScript | null>(null);
  const [analysers, setAnalysers] = useState<AnalyserNode[]>([]);
  const [playing, setPlaying] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);

  const ctx = useRef<AudioContext | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const micAnalyser = useRef<AnalyserNode | null>(null);
  const index = useRef(0);
  const playingRef = useRef(false);
  const mutedUntil = useRef(0);
  const speaking = useRef(false);
  const aboveSince = useRef<number | null>(null);
  const belowSince = useRef<number | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingForUser = useRef(false);
  const scriptRef = useRef<CallScript | null>(null);
  const clipGain = useRef<GainNode | null>(null);
  const noiseEl = useRef<HTMLAudioElement | null>(null);
  const fadingOut = useRef(false);

  useEffect(() => {
    if (!slug) return;
    api
      .callScript(slug)
      .then((s) => {
        scriptRef.current = s;
        setScript(s);
      })
      .catch(() => setScript(null));
  }, [slug]);

  const clearPending = () => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
  };

  const ensureContext = useCallback(async () => {
    if (!audioEl) return null;
    if (!ctx.current) {
      const ac = new AudioContext();
      const el = ac.createAnalyser();
      el.fftSize = 128;
      el.smoothingTimeConstant = 0.7;
      // clip: element -> analyser -> gain (150ms in / 250ms out) -> speaker
      const gain = ac.createGain();
      gain.gain.value = 0;
      ac.createMediaElementSource(audioEl).connect(el);
      el.connect(gain);
      gain.connect(ac.destination);
      clipGain.current = gain;
      // continuous low phone-line noise for the length of the call
      const noise = new Audio(LINE_NOISE_SRC);
      noise.loop = true;
      noise.preload = "auto";
      const noiseGain = ac.createGain();
      noiseGain.gain.value = LINE_NOISE_GAIN;
      ac.createMediaElementSource(noise).connect(noiseGain);
      noiseGain.connect(ac.destination);
      noise.play().catch(() => {});
      noiseEl.current = noise;
      ctx.current = ac;
      setAnalysers((prev) => [...prev, el]);
    }
    if (ctx.current.state === "suspended") await ctx.current.resume();
    return ctx.current;
  }, [audioEl]);

  /** Plays clip `i` now. Returns false if there is no such clip. */
  const play = useCallback(
    async (i: number): Promise<boolean> => {
      const s = scriptRef.current;
      const line = s?.lines[i];
      if (!slug || !s || !line || !audioEl) return false;
      clearPending();
      waitingForUser.current = false;
      const ac = await ensureContext();
      if (!ac) return false;
      index.current = i + 1;
      playingRef.current = true;
      setPlaying(true);
      mutedUntil.current = Number.POSITIVE_INFINITY;
      audioEl.src = api.callClipUrl(slug, line.id);
      fadingOut.current = false;
      const g = clipGain.current!.gain;
      g.cancelScheduledValues(ac.currentTime);
      g.setValueAtTime(0, ac.currentTime);
      g.linearRampToValueAtTime(1, ac.currentTime + FADE_IN_S);
      audioEl.ontimeupdate = () => {
        const remaining = audioEl.duration - audioEl.currentTime;
        if (!fadingOut.current && Number.isFinite(remaining) && remaining <= FADE_OUT_S) {
          fadingOut.current = true;
          g.cancelScheduledValues(ac.currentTime);
          g.setValueAtTime(g.value, ac.currentTime);
          g.linearRampToValueAtTime(0, ac.currentTime + Math.max(0.05, remaining));
        }
      };
      const onEnd = () => {
        playingRef.current = false;
        setPlaying(false);
        mutedUntil.current = performance.now() + POST_CLIP_MUTE_MS;
        speaking.current = false;
        aboveSince.current = null;
        belowSince.current = null;
        setUserSpeaking(false);
        scheduleNext();
      };
      audioEl.onended = onEnd;
      audioEl.onerror = onEnd;
      try {
        await audioEl.play();
      } catch {
        onEnd();
      }
      return true;
    },
    [slug, audioEl, ensureContext],
  );

  /** Arms the next clip according to its trigger. */
  const scheduleNext = useCallback(() => {
    const s = scriptRef.current;
    const next = s?.lines[index.current];
    if (!next) {
      setDone(true);
      return;
    }
    if (next.trigger.kind === "auto") {
      clearPending();
      pending.current = setTimeout(() => void play(index.current), next.trigger.delayMs);
    } else {
      waitingForUser.current = true;
    }
  }, [play]);

  /** Called by the VAD when the user's speech ends. */
  const onUserSpeechEnd = useCallback(() => {
    const s = scriptRef.current;
    const next = s?.lines[index.current];
    if (!next || !waitingForUser.current || next.trigger.kind !== "after_user") return;
    waitingForUser.current = false;
    clearPending();
    pending.current = setTimeout(() => void play(index.current), next.trigger.delayMs);
  }, [play]);

  const forceNext = useCallback(() => {
    if (playingRef.current) return;
    void play(index.current);
  }, [play]);

  // Connect: the AudioContext (and the line noise) start as soon as the call screen mounts,
  // inside the answer tap's gesture, before the mic prompt can interrupt it.
  useEffect(() => {
    if (slug && audioEl) void ensureContext();
  }, [slug, audioEl, ensureContext]);

  // Arm the first clip (after_user by script) once the script is known.
  useEffect(() => {
    if (script) scheduleNext();
  }, [script, scheduleNext]);

  // Microphone + VAD loop.
  useEffect(() => {
    if (!slug || !audioEl) return;
    let raf = 0;
    let cancelled = false;
    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch {
        setMicGranted(false);
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ac = await ensureContext();
      if (!ac) return;
      micStream.current = stream;
      const node = ac.createAnalyser();
      node.fftSize = 512;
      node.smoothingTimeConstant = 0.5;
      ac.createMediaStreamSource(stream).connect(node);
      micAnalyser.current = node;
      setAnalysers((prev) => [...prev, node]);
      setMicGranted(true);
      const buf = new Float32Array(node.fftSize);
      const tick = () => {
        node.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();
        const muted = playingRef.current || now < mutedUntil.current;
        if (!muted) {
          if (rms > VAD_THRESHOLD) {
            belowSince.current = null;
            if (aboveSince.current === null) aboveSince.current = now;
            else if (!speaking.current && now - aboveSince.current >= VAD_START_MS) {
              speaking.current = true;
              setUserSpeaking(true);
            }
          } else {
            aboveSince.current = null;
            if (speaking.current) {
              if (belowSince.current === null) belowSince.current = now;
              else if (now - belowSince.current >= VAD_END_MS) {
                speaking.current = false;
                belowSince.current = null;
                setUserSpeaking(false);
                onUserSpeechEnd();
              }
            }
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [slug, audioEl, ensureContext, onUserSpeechEnd]);

  // Teardown.
  useEffect(() => {
    return () => {
      clearPending();
      micStream.current?.getTracks().forEach((t) => t.stop());
      if (noiseEl.current) {
        noiseEl.current.pause();
        noiseEl.current.src = "";
      }
      ctx.current?.close().catch(() => {});
    };
  }, []);

  return { analysers, playing, userSpeaking, micGranted, done, forceNext };
}
