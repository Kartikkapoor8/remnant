/** `?demo=<slug>` switches the thread to the scripted demo for that persona. */
export function demoSlugFromLocation(search: string = window.location.search): string | null {
  const v = new URLSearchParams(search).get("demo");
  return v && /^[a-z0-9-]+$/.test(v) ? v : null;
}

/** `?debug=1` shows the viewport readout overlay. */
export function debugFromLocation(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get("debug") === "1";
}
