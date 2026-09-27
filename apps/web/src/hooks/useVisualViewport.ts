import { useEffect } from "react";

/**
 * iOS Safari keyboard handling, for the real device:
 *
 * When the composer is focused Safari shrinks the visual viewport and scrolls
 * the page to reveal the input, which drags the fixed app shell (and the
 * header) off-screen. On every visualViewport resize/scroll we size the app
 * container to visualViewport.height, translate it by visualViewport.offsetTop
 * and immediately undo Safari's focus-scroll with window.scrollTo(0, 0). The
 * header stays at the top of the container; only the thread (flex: 1) shrinks,
 * and it is kept scrolled to its bottom. On blur everything resets.
 */
export function useVisualViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const app = document.querySelector<HTMLElement>(".app");
    if (!vv || !app) return;
    const root = document.documentElement;
    let raf = 0;

    const reset = () => {
      app.style.height = "";
      app.style.transform = "";
      root.style.removeProperty("--safe-bottom");
    };

    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const keyboardOpen = window.innerHeight - vv.height > 80;
        if (!keyboardOpen) {
          reset();
          return;
        }
        app.style.height = `${Math.round(vv.height)}px`;
        app.style.transform = `translateY(${Math.round(vv.offsetTop)}px)`;
        root.style.setProperty("--safe-bottom", "0px");
        window.scrollTo(0, 0);
        const thread = document.querySelector<HTMLElement>(".thread");
        if (thread) thread.scrollTop = thread.scrollHeight;
      });
    };

    const onFocusOut = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement) {
        // Safari fires the viewport resize slightly after blur; reset now so there is no flash.
        cancelAnimationFrame(raf);
        reset();
      }
    };

    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    window.addEventListener("scroll", apply, { passive: true });
    document.addEventListener("focusout", onFocusOut);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      window.removeEventListener("scroll", apply);
      document.removeEventListener("focusout", onFocusOut);
      cancelAnimationFrame(raf);
      reset();
    };
  }, []);
}
