import React, { type FC, type ReactNode } from "react";
import { AbsoluteFill, Sequence, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadSerif } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

// Cards and the portrait explainer for the LinkedIn cut. Same tokens, fonts and scene timings as Explainer.tsx.

const serif = loadSerif("normal", { weights: ["500"], subsets: ["latin"] }).fontFamily;
const sans = loadInter("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
const mono = 'ui-monospace, "SF Mono", Menlo, monospace';

const C = {
  bg: "#0B0B0C",
  text: "#EDE8DF",
  muted: "#8A857B",
  accent: "#C9A46A",
  hairline: "rgba(237, 232, 223, 0.08)",
};

export const FPS = 24;
export const ARCH = 14 * FPS;
export const GUARD = 10 * FPS;
export const CLOSE = 8 * FPS;
export const PORTRAIT_DURATION = ARCH + GUARD + CLOSE;
export const COLD_OPEN_DURATION = 2 * FPS;
export const END_CARD_DURATION = 3 * FPS;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function fade(frame: number, dur: number, inF = 10, outF = 10): number {
  return interpolate(frame, [0, inF, dur - outF, dur], [0, 1, 1, 0], clamp);
}

function enter(frame: number, fps: number, at: number, lift = 18): { opacity: number; transform: string } {
  const p = spring({ frame: frame - at, fps, config: { damping: 200 }, durationInFrames: 18 });
  return { opacity: p, transform: `translateY(${(1 - p) * lift}px)` };
}

const usePortrait = (): boolean => {
  const { width, height } = useVideoConfig();
  return height > width;
};

/* ---------- cold open ---------- */

export const ColdOpen: FC = () => {
  const frame = useCurrentFrame();
  const portrait = usePortrait();
  const o = interpolate(frame, [0, 10], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          fontFamily: serif,
          fontWeight: 500,
          fontSize: portrait ? 58 : 54,
          letterSpacing: "0.01em",
          color: C.text,
          opacity: o * 0.92,
          textAlign: "center",
          padding: "0 80px",
        }}
      >
        the last text was 8 months ago.
      </div>
    </AbsoluteFill>
  );
};

/* ---------- wordmark (shared by Close and EndCard so the cut between them holds still) ---------- */

const WORD = "REMNANT";
const GLYPHS = "0123456789ABCDEF";
const RESOLVE_AT = 10;
const RESOLVE_FRAMES = 30;

const Wordmark: FC<{ done: number; frame: number; size: number }> = ({ done, frame, size }) => (
  <div style={{ fontFamily: serif, fontWeight: 500, fontSize: size, letterSpacing: "0.08em", color: C.text, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
    {WORD.split("").map((ch, i) => {
      const glyph = i < done ? ch : GLYPHS[Math.floor(random(`g-${i}-${frame}`) * GLYPHS.length)]!;
      return (
        <span key={i} style={{ position: "relative", display: "inline-block" }}>
          <span style={{ visibility: "hidden" }}>{ch}</span>
          <span style={{ position: "absolute", left: 0, right: "0.08em", top: 0, textAlign: "center", color: i < done ? C.text : C.muted }}>{glyph}</span>
        </span>
      );
    })}
  </div>
);

const Close: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const elapsed = Math.max(0, frame - RESOLVE_AT);
  const done = Math.min(WORD.length, Math.floor((elapsed / RESOLVE_FRAMES) * WORD.length));
  const tagline = enter(frame, fps, RESOLVE_AT + RESOLVE_FRAMES + 18, 10);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: interpolate(frame, [0, 8], [0, 1], clamp) }}>
      <Wordmark done={done} frame={frame} size={portrait ? 150 : 168} />
      <div style={{ marginTop: 18, height: 36, fontFamily: sans, fontWeight: 400, fontSize: portrait ? 28 : 30, lineHeight: "36px", letterSpacing: "0.04em", color: C.muted, ...tagline }}>
        own your intelligence
      </div>
    </AbsoluteFill>
  );
};

export const EndCard: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = usePortrait();
  const l1 = enter(frame, fps, 2, 8);
  const l2 = enter(frame, fps, 10, 8);
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <Wordmark done={WORD.length} frame={frame} size={portrait ? 150 : 168} />
      {/* fixed-height slot, same as the Close tagline, so the wordmark does not move on the cut */}
      <div style={{ marginTop: 18, height: 36, position: "relative", textAlign: "center", whiteSpace: "nowrap" }}>
        <div style={{ fontFamily: sans, fontWeight: 400, fontSize: portrait ? 24 : 28, lineHeight: "36px", letterSpacing: "0.03em", color: C.muted, ...l1 }}>
          built in one afternoon at YC's Own Your Intelligence Hackathon
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 36 + 12, fontFamily: sans, fontWeight: 500, fontSize: portrait ? 24 : 26, lineHeight: "32px", letterSpacing: "0.03em", color: C.accent, ...l2 }}>
          github.com/Kartikkapoor8/remnant
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- portrait explainer: architecture, guardrails, close ---------- */

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
const COL_STAGGER = 18;
const MARGIN = 120;

const Spark: FC<{ progress: number; w: number; h: number }> = ({ progress, w, h }) => {
  const max = 4.4;
  const d = LOSS.map((v, i) => `${i ? "L" : "M"}${((i / (LOSS.length - 1)) * w).toFixed(1)} ${(h - (v / max) * h).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h + 8} viewBox={`0 -4 ${w} ${h + 8}`} style={{ marginTop: 22, overflow: "visible" }}>
      <line x1={0} y1={h} x2={w} y2={h} stroke={C.hairline} strokeWidth={1} />
      <path d={d} fill="none" stroke={C.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress} />
    </svg>
  );
};

// Row heights for the stacked layout (name 72px serif, lines 28px sans, spark 72px tall).
const ROW_TOPS = [120, 120 + 166 + 40, 120 + 166 + 40 + 360 + 40];

const ArchitectureP: FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const bottom = enter(frame, fps, 150, 14);
  return (
    <AbsoluteFill style={{ opacity: fade(frame, ARCH, 1, 10) }}>
      {COLS.map((col, i) => {
        const at = 8 + i * COL_STAGGER;
        const e = enter(frame, fps, at, 30);
        return (
          <div key={col.name} style={{ position: "absolute", left: MARGIN, right: MARGIN, top: ROW_TOPS[i], ...e }}>
            {i > 0 && <div style={{ position: "absolute", left: 0, right: 0, top: -20, height: 1, background: C.hairline }} />}
            <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 20, letterSpacing: "0.24em", color: C.accent }}>{col.label}</div>
            <div style={{ fontFamily: serif, fontWeight: 500, fontSize: 72, lineHeight: 1.1, color: C.text, marginTop: 12 }}>{col.name}</div>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              {col.lines.map((line, j) => (
                <div key={j} style={{ fontFamily: sans, fontWeight: 400, fontSize: 28, color: C.text, opacity: interpolate(frame, [at + 10 + j * 8, at + 22 + j * 8], [0, 0.82], clamp) }}>
                  {line}
                </div>
              ))}
            </div>
            {col.spark && <Spark progress={interpolate(frame, [at + 30, at + 100], [0, 1], clamp)} w={width - 2 * MARGIN} h={72} />}
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 60, right: 60, top: 960, textAlign: "center", fontFamily: serif, fontWeight: 500, fontSize: 40, color: C.text, ...bottom }}>
        runs on your machine, your brain, your weights
      </div>
    </AbsoluteFill>
  );
};

const RULES = ["never claims to be alive", "never texts first", "consent before cloning", "notices dependency", "steps aside in a crisis"];
const TYPE_START = 14;
const LINE_PAUSE = 7;
const RULE_STARTS = RULES.reduce<number[]>((acc, _r, i) => {
  acc.push(i === 0 ? TYPE_START : acc[i - 1]! + RULES[i - 1]!.length + LINE_PAUSE);
  return acc;
}, []);
const TYPED_END = RULE_STARTS[RULES.length - 1]! + RULES[RULES.length - 1]!.length;
const VERDICT_AT = TYPED_END + 14;

const GuardrailsP: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const verdict = enter(frame, fps, VERDICT_AT, 14);
  const dim = interpolate(frame, [VERDICT_AT, VERDICT_AT + 16], [1, 0.42], clamp);
  const active = RULE_STARTS.reduce((a, s, i) => (frame >= s ? i : a), 0);
  const cursorOn = Math.floor(frame / 12) % 2 === 0 || frame < TYPED_END;
  return (
    <AbsoluteFill style={{ opacity: fade(frame, GUARD, 1, 10) }}>
      <div style={{ position: "absolute", left: MARGIN, top: 220, opacity: dim }}>
        <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 20, letterSpacing: "0.24em", color: C.accent, marginBottom: 30, ...enter(frame, fps, 0, 10) }}>guardrails</div>
        {RULES.map((rule, i) => {
          const n = Math.max(0, Math.min(rule.length, frame - RULE_STARTS[i]!));
          if (frame < RULE_STARTS[i]!) return <div key={rule} style={{ height: 58 }} />;
          return (
            <div key={rule} style={{ height: 58, fontFamily: mono, fontSize: 34, color: C.text, whiteSpace: "pre" }}>
              <span style={{ color: C.accent }}>{"› "}</span>
              {rule.slice(0, n)}
              {i === active && (
                <span style={{ display: "inline-block", width: "0.55em", height: "1.05em", marginLeft: 4, verticalAlign: "-0.18em", background: C.accent, opacity: cursorOn ? 0.85 : 0 }} />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 90, right: 90, top: 760, textAlign: "center", fontFamily: serif, fontWeight: 500, fontSize: 48, lineHeight: 1.25, color: C.text, ...verdict }}>
        we didn't soften it. we made it honest about what it is.
      </div>
    </AbsoluteFill>
  );
};

export const ExplainerPortrait: FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.bg }}>
    <Sequence durationInFrames={ARCH}>
      <ArchitectureP />
    </Sequence>
    <Sequence from={ARCH} durationInFrames={GUARD}>
      <GuardrailsP />
    </Sequence>
    <Sequence from={ARCH + GUARD} durationInFrames={CLOSE}>
      <Close />
    </Sequence>
  </AbsoluteFill>
);
