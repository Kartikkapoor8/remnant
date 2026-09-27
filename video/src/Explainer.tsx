import React, { type FC, type ReactNode } from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadSerif } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import clips from "../public/footage/clips.json";

const serif = loadSerif("normal", { weights: ["500"], subsets: ["latin"] }).fontFamily;
const sans = loadInter("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
const mono = 'ui-monospace, "SF Mono", Menlo, monospace';

// apps/web/src/styles/tokens.css
const C = {
  bg: "#0B0B0C",
  text: "#EDE8DF",
  muted: "#8A857B",
  accent: "#C9A46A",
  hairline: "rgba(237, 232, 223, 0.08)",
};

export const FPS = 24;
const EDGE = FPS; // 1s black at each end
const PRODUCT = 10 * FPS;
const ARCH = 14 * FPS;
const GUARD = 10 * FPS;
const CLOSE = 8 * FPS;
const BODY = PRODUCT + ARCH + GUARD + CLOSE;
export const DURATION = EDGE + BODY + EDGE;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Fade in over `inF` frames, out over the last `outF` frames of `dur`. */
function fade(frame: number, dur: number, inF = 10, outF = 10): number {
  return interpolate(frame, [0, inF, dur - outF, dur], [0, 1, 1, 0], clamp);
}

/** Opacity and lift for an element entering at `at`. */
function enter(frame: number, fps: number, at: number, lift = 18): { opacity: number; transform: string } {
  const p = spring({ frame: frame - at, fps, config: { damping: 200 }, durationInFrames: 18 });
  return { opacity: p, transform: `translateY(${(1 - p) * lift}px)` };
}

export const Explainer: FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <Sequence from={EDGE} durationInFrames={BODY}>
      <Body />
    </Sequence>
  </AbsoluteFill>
);

const Body: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, opacity: fade(frame, BODY, 12, 16) }}>
      <Sequence durationInFrames={PRODUCT}>
        <Product />
      </Sequence>
      <Sequence from={PRODUCT} durationInFrames={ARCH}>
        <Architecture />
      </Sequence>
      <Sequence from={PRODUCT + ARCH} durationInFrames={GUARD}>
        <Guardrails />
      </Sequence>
      <Sequence from={PRODUCT + ARCH + GUARD} durationInFrames={CLOSE}>
        <Close />
      </Sequence>
    </AbsoluteFill>
  );
};

/* ---------- 1. product beats ---------- */

type ClipKey = keyof typeof clips;
const BEATS: { key: ClipKey; caption: string }[] = [
  { key: "gap", caption: "the last message" },
  { key: "typing", caption: "she types like she typed" },
  { key: "bursts", caption: "bursts, no periods, her length" },
  { key: "call", caption: "her voice" },
];
const BEAT = PRODUCT / BEATS.length;
const XFADE = 6;

const SCREEN_H = 820;
const SCREEN_W = Math.round((SCREEN_H * 393) / 852);
const S = SCREEN_H / 852; // CSS px of the recording -> px on canvas
const BEZEL = 12;
const PHONE_CX = 700;

const Product: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: fade(frame, PRODUCT, 1, 10) }}>
      <Phone>
        {BEATS.map((b, i) => (
          <Sequence key={b.key} from={i * BEAT} durationInFrames={BEAT + (i < BEATS.length - 1 ? XFADE : 0)}>
            <Screen clip={clips[b.key]} fadeIn={i > 0} />
          </Sequence>
        ))}
      </Phone>
      {BEATS.map((b, i) => (
        <Sequence key={b.key} from={i * BEAT} durationInFrames={BEAT}>
          <Caption text={b.caption} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const Phone: FC<{ children: ReactNode }> = ({ children }) => (
  <div
    style={{
      position: "absolute",
      left: PHONE_CX - SCREEN_W / 2 - BEZEL,
      top: (1080 - SCREEN_H) / 2 - BEZEL,
      padding: BEZEL,
      borderRadius: 64,
      background: "#050506",
      boxShadow: "0 0 0 1.5px rgba(237, 232, 223, 0.14), 0 40px 120px rgba(0, 0, 0, 0.55)",
    }}
  >
    <div style={{ position: "relative", width: SCREEN_W, height: SCREEN_H, borderRadius: 52, overflow: "hidden", background: C.bg }}>
      {children}
      <div
        style={{
          position: "absolute",
          top: 11 * S,
          left: SCREEN_W / 2 - 62 * S,
          width: 124 * S,
          height: 36 * S,
          borderRadius: 18 * S,
          background: "#000",
        }}
      />
    </div>
  </div>
);

// Playwright records a 2x viewport as 1x frames in the top-left quarter of the webm; scale 2x to crop to it,
// plus 1.2% so the gray padding does not bleed in at the right edge.
const Screen: FC<{ clip: { file: string; start: number }; fadeIn: boolean }> = ({ clip, fadeIn }) => {
  const frame = useCurrentFrame();
  const opacity = fadeIn ? interpolate(frame, [0, XFADE], [0, 1], clamp) : 1;
  return (
    <AbsoluteFill style={{ opacity }}>
      <OffthreadVideo
        src={staticFile(clip.file)}
        trimBefore={Math.round(clip.start * FPS)}
        muted
        style={{ position: "absolute", left: -2, top: 0, width: SCREEN_W * 2 * 1.012, height: SCREEN_H * 2 * 1.012, objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
};

const Caption: FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inn = enter(frame, fps, 6, 14);
  const out = interpolate(frame, [BEAT - 9, BEAT - 1], [1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 1000,
        top: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        fontFamily: serif,
        fontWeight: 500,
        fontSize: 58,
        color: C.text,
        opacity: inn.opacity * out,
        transform: inn.transform,
      }}
    >
      {text}
    </div>
  );
};

/* ---------- 2. architecture ---------- */

// Per-step loss_mean from training/runs/train.stdout.log (run 20260927T212125Z, 36 steps).
const LOSS = [
  4.1926, 2.8794, 2.6031, 2.4294, 2.2147, 1.4722, 2.6379, 1.6117, 2.4033, 2.6578, 1.8556, 2.2168, 1.3169, 1.6534, 1.6054,
  1.5338, 1.5, 1.5249, 1.3915, 1.0285, 1.1845, 1.3633, 0.9491, 0.7744, 0.802, 0.5925, 0.9212, 0.479, 0.5685, 0.9867,
  0.8744, 0.5114, 0.6067, 0.4912, 0.2802, 0.7534,
];

const Arrow: FC = () => (
  <svg width="0.95em" height="0.6em" viewBox="0 0 19 12" style={{ margin: "0 0.28em", verticalAlign: "0.04em" }}>
    <path d="M1 6h16M12 1l5 5-5 5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const COLS: { label: string; name: string; lines: ReactNode[]; spark?: boolean }[] = [
  { label: "memory", name: "GBrain", lines: ["78 facts with sources"] },
  {
    label: "model",
    name: "River AI",
    lines: [
      "LoRA on Qwen3.8-27B",
      <>
        loss 4.19
        <Arrow />
        0.75
      </>,
      "yours",
    ],
    spark: true,
  },
  { label: "voice", name: "ElevenLabs", lines: ["consent-gated clone"] },
];
const COL_W = 460;
const COL_GAP = 80;
const COL_X0 = (1920 - (COLS.length * COL_W + (COLS.length - 1) * COL_GAP)) / 2;
const COL_STAGGER = 18;

const Architecture: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bottom = enter(frame, fps, 150, 14);
  return (
    <AbsoluteFill style={{ opacity: fade(frame, ARCH, 1, 10) }}>
      {COLS.map((col, i) => {
        const at = 8 + i * COL_STAGGER;
        const e = enter(frame, fps, at, 30);
        return (
          <div key={col.name} style={{ position: "absolute", left: COL_X0 + i * (COL_W + COL_GAP), top: 250, width: COL_W, ...e }}>
            {i > 0 && (
              <div style={{ position: "absolute", left: -COL_GAP / 2, top: 6, height: 400, width: 1, background: C.hairline }} />
            )}
            <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 20, letterSpacing: "0.24em", color: C.accent }}>{col.label}</div>
            <div style={{ fontFamily: serif, fontWeight: 500, fontSize: 84, lineHeight: 1.1, color: C.text, marginTop: 14 }}>{col.name}</div>
            <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 12 }}>
              {col.lines.map((line, j) => (
                <div
                  key={j}
                  style={{
                    fontFamily: sans,
                    fontWeight: 400,
                    fontSize: 30,
                    color: C.text,
                    opacity: interpolate(frame, [at + 10 + j * 8, at + 22 + j * 8], [0, 0.82], clamp),
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
            {col.spark && <Spark progress={interpolate(frame, [at + 30, at + 100], [0, 1], clamp)} />}
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 820,
          textAlign: "center",
          fontFamily: serif,
          fontWeight: 500,
          fontSize: 52,
          color: C.text,
          ...bottom,
        }}
      >
        runs on your machine, your brain, your weights
      </div>
    </AbsoluteFill>
  );
};

const Spark: FC<{ progress: number }> = ({ progress }) => {
  const w = 360;
  const h = 96;
  const max = 4.4;
  const d = LOSS.map((v, i) => `${i ? "L" : "M"}${((i / (LOSS.length - 1)) * w).toFixed(1)} ${(h - (v / max) * h).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h + 8} viewBox={`0 -4 ${w} ${h + 8}`} style={{ marginTop: 30, overflow: "visible" }}>
      <line x1={0} y1={h} x2={w} y2={h} stroke={C.hairline} strokeWidth={1} />
      <path
        d={d}
        fill="none"
        stroke={C.accent}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - progress}
      />
    </svg>
  );
};

/* ---------- 3. guardrails ---------- */

const RULES = ["never claims to be alive", "never texts first", "consent before cloning", "notices dependency", "steps aside in a crisis"];
const TYPE_START = 14;
const LINE_PAUSE = 7;
const RULE_STARTS = RULES.reduce<number[]>((acc, _r, i) => {
  acc.push(i === 0 ? TYPE_START : acc[i - 1]! + RULES[i - 1]!.length + LINE_PAUSE);
  return acc;
}, []);
const TYPED_END = RULE_STARTS[RULES.length - 1]! + RULES[RULES.length - 1]!.length;
const VERDICT_AT = TYPED_END + 14;

const Guardrails: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const verdict = enter(frame, fps, VERDICT_AT, 14);
  const dim = interpolate(frame, [VERDICT_AT, VERDICT_AT + 16], [1, 0.42], clamp);
  const active = RULE_STARTS.reduce((a, s, i) => (frame >= s ? i : a), 0);
  const cursorOn = Math.floor(frame / 12) % 2 === 0 || frame < TYPED_END;
  return (
    <AbsoluteFill style={{ opacity: fade(frame, GUARD, 1, 10) }}>
      <div style={{ position: "absolute", left: 640, top: 210, opacity: dim }}>
        <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 20, letterSpacing: "0.24em", color: C.accent, marginBottom: 34, ...enter(frame, fps, 0, 10) }}>
          guardrails
        </div>
        {RULES.map((rule, i) => {
          const n = Math.max(0, Math.min(rule.length, frame - RULE_STARTS[i]!));
          if (frame < RULE_STARTS[i]!) return <div key={rule} style={{ height: 62 }} />;
          return (
            <div key={rule} style={{ height: 62, fontFamily: mono, fontSize: 38, color: C.text, whiteSpace: "pre" }}>
              <span style={{ color: C.accent }}>{"› "}</span>
              {rule.slice(0, n)}
              {i === active && (
                <span
                  style={{
                    display: "inline-block",
                    width: "0.55em",
                    height: "1.05em",
                    marginLeft: 4,
                    verticalAlign: "-0.18em",
                    background: C.accent,
                    opacity: cursorOn ? 0.85 : 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 780,
          textAlign: "center",
          fontFamily: serif,
          fontWeight: 500,
          fontSize: 56,
          color: C.text,
          ...verdict,
        }}
      >
        we didn't soften it. we made it honest about what it is.
      </div>
    </AbsoluteFill>
  );
};

/* ---------- 4. close ---------- */

// Same effect as apps/web/src/components/Intro.tsx: hex glyphs resolve left to right.
const WORD = "REMNANT";
const GLYPHS = "0123456789ABCDEF";
const RESOLVE_AT = 10;
const RESOLVE_FRAMES = 30;

const Close: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = Math.max(0, frame - RESOLVE_AT);
  const done = Math.min(WORD.length, Math.floor((elapsed / RESOLVE_FRAMES) * WORD.length));
  const tagline = enter(frame, fps, RESOLVE_AT + RESOLVE_FRAMES + 18, 10);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: interpolate(frame, [0, 8], [0, 1], clamp) }}>
      <div style={{ fontFamily: serif, fontWeight: 500, fontSize: 168, letterSpacing: "0.08em", color: C.text, fontVariantNumeric: "tabular-nums" }}>
        {WORD.split("").map((ch, i) => {
          const glyph = i < done ? ch : GLYPHS[Math.floor(random(`g-${i}-${frame}`) * GLYPHS.length)]!;
          return (
            <span key={i} style={{ position: "relative", display: "inline-block" }}>
              <span style={{ visibility: "hidden" }}>{ch}</span>
              <span style={{ position: "absolute", left: 0, right: "0.08em", top: 0, textAlign: "center", color: i < done ? C.text : C.muted }}>
                {glyph}
              </span>
            </span>
          );
        })}
      </div>
      <div style={{ marginTop: 18, fontFamily: sans, fontWeight: 400, fontSize: 30, letterSpacing: "0.04em", color: C.muted, ...tagline }}>
        own your intelligence
      </div>
    </AbsoluteFill>
  );
};
