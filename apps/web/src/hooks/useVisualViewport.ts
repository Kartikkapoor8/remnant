import { useEffect } from "react";

/**
 * Keeps the app sized to the visual viewport so the composer stays pinned
 * above the iOS keyboard, and scrolls the thread to the bottom when the
 * keyboard opens. Writes --vvh on :root; CSS falls back to 100dvh without it.
 */
export function useVisualViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
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
      cancelAnimationFrame(raf);
    };
  }, []);
}
