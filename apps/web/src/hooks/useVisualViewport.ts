import { useEffect } from "react";

/**
 * Keeps the header pinned and the composer above the iOS keyboard:
 * - the app shell is position: fixed and sized to visualViewport.height (--vvh)
 * - the header is position: fixed; the thread pads by the measured header
 *   height (--header-h) so only the thread shrinks and scrolls
 * - body scroll is pinned to 0 so Safari cannot push the header off-screen
 * CSS falls back to 100dvh / 56px without the variables.
 */
export function useVisualViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const header = document.querySelector<HTMLElement>(".header");
    const ro = header
      ? new ResizeObserver(() => root.style.setProperty("--header-h", `${Math.round(header.getBoundingClientRect().height)}px`))
      : null;
    if (header) {
      root.style.setProperty("--header-h", `${Math.round(header.getBoundingClientRect().height)}px`);
      ro?.observe(header);
    }
    let raf = 0;
    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const keyboardOpen = window.innerHeight - vv.height > 80;
        if (keyboardOpen) {
          root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
          root.style.setProperty("--safe-bottom", "0px");
          window.scrollTo(0, 0);
          document.querySelector(".thread")?.scrollTo({ top: 1e9 });
        } else {
          root.style.removeProperty("--vvh");
          root.style.removeProperty("--safe-bottom");
        }
      });
    };
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      ro?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
}
