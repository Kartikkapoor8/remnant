/**
 * bun run demo: the whole stack from one command.
 *
 *   brain   gbrain init if needed, import brain/, seed facts   (skipped when gbrain is missing or GBRAIN_MCP_URL is set)
 *   river   training/serve.py sidecar                           (only with RIVER_API_KEY, a .venv and training/runs/latest.json)
 *   api     Bun server on PORT (8787); it spawns gbrain serve
 *   web     Vite on WEB_PORT (5173); it proxies /api to the Bun server
 *
 * One readiness check at the end prints the URLs and what GET /api/health
 * reports. Every fallback is printed, never silent. Ctrl-C stops everything.
 */
import { resolve } from "node:path";
import { BRAIN_DIR, REPO_ROOT, brainHome, ensureBrain, gbrainInstalled, importBrain } from "./lib/brain.ts";
import { lanIp, spawnTagged, waitForHttp, type Child } from "./lib/proc.ts";

const PORT = process.env.PORT ?? "8787";
const WEB_PORT = process.env.WEB_PORT ?? "5173";
const SIDECAR = process.env.RIVER_SIDECAR_URL ?? "http://127.0.0.1:8765";
const children: Child[] = [];
const say = (line: string) => console.log(`[demo] ${line}`);

function stopAll(code: number): never {
  for (const c of children) c.proc.kill();
  process.exit(code);
}
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
const exited = (c: Child) => c.proc.exitCode !== null;

// 1. brain
if (process.env.GBRAIN_MCP_URL) {
  say(`brain: hosted at ${process.env.GBRAIN_MCP_URL}; skipping the local import`);
} else if (!gbrainInstalled()) {
  say("brain: gbrain is not on PATH (bun add -g gbrain); the api will use in-memory facts parsed from brain/");
} else {
  const home = brainHome();
  try {
    const state = await ensureBrain(home);
    say(`brain: ${home}/.gbrain (${state}); importing ${BRAIN_DIR}`);
    const r = await importBrain(home);
    say(`brain: ${r.pages} pages, ${r.facts} facts (${r.seed.inserted} new, ${r.seed.duplicate} already present, ${r.seed.failed} failed)`);
  } catch (err) {
    say(`brain: import failed: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}; the api will fall back to in-memory facts`);
  }
}

// 2. river sidecar
const manifest = resolve(REPO_ROOT, "training/runs/latest.json");
const python = resolve(REPO_ROOT, ".venv/bin/python");
let river: Child | null = null;
let riverNote: string;
if (!process.env.RIVER_API_KEY) {
  riverNote = `not started: RIVER_API_KEY is absent, the model falls back to ${process.env.ANTHROPIC_API_KEY ? "Anthropic (base model + persona prompt)" : "the fixture (Sarah's own past replies)"}`;
} else if (!(await Bun.file(manifest).exists())) {
  riverNote = "not started: no finished run in training/runs/latest.json (see training/README.md)";
} else if (!(await Bun.file(python).exists())) {
  riverNote = "not started: no .venv (python3.12 -m venv .venv && .venv/bin/pip install river-client transformers)";
} else {
  river = spawnTagged("river", [python, "training/serve.py", "--port", new URL(SIDECAR).port || "8765"], { cwd: REPO_ROOT });
  children.push(river);
  riverNote = `${SIDECAR}/health`;
}
say(`river: ${riverNote}`);

try {
  if (river) {
    // The api decides its provider once at boot, so the sidecar must answer first.
    await waitForHttp(`${SIDECAR}/health`, { timeoutMs: 120_000, abort: () => exited(river!) });
    say("river: sidecar is up");
  }

  // 3. api, 4. web
  const api = spawnTagged("api", ["bun", "apps/web/server/index.ts"], { cwd: REPO_ROOT, env: { PORT } });
  children.push(api);
  const web = spawnTagged("web", ["bun", "run", "dev", "--", "--port", WEB_PORT, "--strictPort"], { cwd: resolve(REPO_ROOT, "apps/web"), env: { PORT, WEB_PORT } });
  children.push(web);

  // 5. readiness
  const health = await waitForHttp(`http://127.0.0.1:${PORT}/api/health`, { timeoutMs: 90_000, abort: () => exited(api) });
  const report = (await health.json()) as Record<string, unknown>;
  await waitForHttp(`http://127.0.0.1:${WEB_PORT}/`, { timeoutMs: 60_000, abort: () => exited(web) });
  const ip = lanIp();
  say("ready");
  say(`  web    http://localhost:${WEB_PORT}/${ip ? `   http://${ip}:${WEB_PORT}/  (phone on the same wifi)` : ""}`);
  say(`  demo   http://localhost:${WEB_PORT}/?demo=sarah  (scripted thread and call, for filming)`);
  say(`  api    http://127.0.0.1:${PORT}/api/health  ${JSON.stringify(report)}`);
  say(`  river  ${riverNote}`);
  say("  ctrl-c stops all of it");

  const first = await Promise.race(children.map((c) => c.proc.exited.then((code) => ({ tag: c.tag, code }))));
  say(`${first.tag} exited with code ${first.code}; stopping the rest`);
  stopAll(first.code === 0 ? 0 : 1);
} catch (err) {
  say(`failed: ${err instanceof Error ? err.message : String(err)}`);
  stopAll(1);
}
