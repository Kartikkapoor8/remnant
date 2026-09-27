const BARS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** Voice-activity bars for the call screen. Animates while `active`. */
export function Waveform({ active }: { active: boolean }) {
  return (
    <div className={active ? "waveform waveform--active" : "waveform"} aria-hidden="true">
      {BARS.map((i) => (
        <span key={i} className={`waveform__bar waveform__bar--${i}`} />
      ))}
    </div>
  );
}
