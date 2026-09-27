import { useEffect, useState } from "react";

interface Readout {
  innerHeight: number;
  vvHeight: number;
  vvOffsetTop: number;
  scrollY: number;
  appHeight: number;
}

/** `?debug=1`: live viewport numbers, updated every frame, for reporting from the phone. */
export function DebugOverlay() {
  const [r, setR] = useState<Readout | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const vv = window.visualViewport;
      const app = document.querySelector<HTMLElement>(".app");
      setR({
        innerHeight: window.innerHeight,
        vvHeight: Math.round(vv?.height ?? 0),
        vvOffsetTop: Math.round(vv?.offsetTop ?? 0),
        scrollY: Math.round(window.scrollY),
        appHeight: Math.round(app?.getBoundingClientRect().height ?? 0),
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (!r) return null;
  return (
    <div className="debug">
      ih {r.innerHeight} · vvh {r.vvHeight} · vvTop {r.vvOffsetTop} · scrollY {r.scrollY} · app {r.appHeight}
    </div>
  );
}
