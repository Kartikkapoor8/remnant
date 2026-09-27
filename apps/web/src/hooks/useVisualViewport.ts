import { useEffect } from "react";

const KEYBOARD_FALLBACK_PX = 336; // iPhone 15 Pro keyboard with predictive bar
const STOP_AFTER_BLUR_MS = 300;

/**
 * iOS Safari keyboard handling, aggressive variant for the real device.
 *
 * While the composer is focused a requestAnimationFrame loop pins every
 * scroll container to 0 each frame (window, html, body, the app shell), so
 * Safari's focus-scroll can never move the header. The app container is sized
 * to the keyboard explicitly: visualViewport.height when it changed, otherwise
 * innerHeight minus a known keyboard height. The loop stops 300ms after blur
 * and everything is restored.
 */
export function useVisualViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const app = document.querySelector<HTMLElement>(".app");
    if (!app) return;
    const root = document.documentElement;
    let raf = 0;
    let focused = false;
    let stopTimer: ReturnType<typeof setTimeout> | null = null;
    const baseHeight = window.innerHeight;

    const pin = () => {
      window.scrollTo(0, 0);
      root.scrollTop = 0;
      document.body.scrollTop = 0;
      if (app.scrollTop !== 0) app.scrollTop = 0;
    };

    const size = () => {
      const vvh = vv?.height ?? 0;
      const changed = vvh > 0 && baseHeight - vvh > 80;
      const h = changed ? vvh : window.innerHeight - KEYBOARD_FALLBACK_PX;
      app.style.height = `${Math.round(h)}px`;
      app.style.transform = vv && changed ? `translateY(${Math.round(vv.offsetTop)}px)` : "";
      root.style.setProperty("--safe-bottom", "0px");
      const thread = document.querySelector<HTMLElement>(".thread");
      if (thread) thread.scrollTop = thread.scrollHeight;
    };

    const restore = () => {
      app.style.height = "";
      app.style.transform = "";
      root.style.removeProperty("--safe-bottom");
      pin();
    };

    const loop = () => {
      pin();
      if (focused) size();
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (stopTimer) clearTimeout(stopTimer);
      stopTimer = null;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!(e.target instanceof HTMLInputElement)) return;
      focused = true;
      start();
      size();
    };

    const onFocusOut = (e: FocusEvent) => {
      if (!(e.target instanceof HTMLInputElement)) return;
      focused = false;
      restore();
      stopTimer = setTimeout(() => {
        cancelAnimationFrame(raf);
        restore();
      }, STOP_AFTER_BLUR_MS);
    };

    const onViewport = () => {
      if (focused) size();
      else pin();
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    vv?.addEventListener("resize", onViewport);
    vv?.addEventListener("scroll", onViewport);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      vv?.removeEventListener("resize", onViewport);
      vv?.removeEventListener("scroll", onViewport);
      if (stopTimer) clearTimeout(stopTimer);
      cancelAnimationFrame(raf);
      restore();
    };
  }, []);
}
