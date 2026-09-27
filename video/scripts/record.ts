/**
 * Records the four app beats for the explainer as webm takes at 393x852 @2x.
 * Offsets are measured from page creation (when Playwright's screencast starts)
 * and written to public/footage/clips.json for the Remotion compositions.
 *
 *   NODE_PATH=apps/web/node_modules bun video/scripts/record.ts [http://localhost:5173]
 */
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.argv[2] ?? "http://localhost:5173";
const footage = resolve(import.meta.dir, "../public/footage");
const stills = resolve(import.meta.dir, "stills");
const raw = resolve(footage, "raw");
mkdirSync(raw, { recursive: true });
mkdirSync(stills, { recursive: true });

const LEAD = 0.2;
const TAIL_MS = 3800;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Take {
  ctx: BrowserContext;
  page: Page;
  t0: number;
  /** Seconds since the screencast started. */
  now: () => number;
}

async function open(browser: Browser): Promise<Take> {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
    userAgent: UA,
    recordVideo: { dir: raw, size: { width: 786, height: 1704 } },
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(`${base}/?demo=sarah`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: ":root{--safe-top:59px;--safe-bottom:34px;--safe-left:0px;--safe-right:0px}" });
  await page.waitForSelector(".header__name", { timeout: 15_000 });
  await page.waitForSelector(".intro", { state: "detached", timeout: 15_000 });
  return { ctx, page, t0, now: () => (Date.now() - t0) / 1000 };
}

async function still(take: Take, at: number, name: string) {
  const wait = at * 1000 - (Date.now() - take.t0);
  if (wait > 0) await sleep(wait);
  await take.page.screenshot({ path: resolve(stills, `${name}.png`), scale: "css" });
}

async function finish(take: Take, name: string): Promise<number> {
  const video = take.page.video();
  await take.ctx.close();
  const seconds = (Date.now() - take.t0) / 1000;
  renameSync(await video!.path(), resolve(footage, `${name}.webm`));
  return seconds;
}

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const clips: Record<string, { file: string; start: number }> = {};
const lengths: Record<string, number> = {};

// 1. gap: from the top of the history, scroll down until her last message and its time-gap label come into view
{
  const take = await open(browser);
  await sleep(400);
  const dims = await take.page.evaluate(() => {
    const t = document.querySelector<HTMLElement>(".thread")!;
    const labels = [...document.querySelectorAll(".gap__label")].map((l) => l.textContent);
    const bottom = t.scrollTop;
    t.scrollTop = 0;
    return { scrollHeight: t.scrollHeight, clientHeight: t.clientHeight, bottom, labels };
  });
  console.log("gap thread", dims);
  await sleep(900);
  const start = take.now();
  await take.page.evaluate(() => {
    const t = document.querySelector<HTMLElement>(".thread")!;
    t.scrollTo({ top: t.scrollHeight, behavior: "smooth" });
  });
  clips.gap = { file: "footage/gap.webm", start: Math.max(0, start - LEAD) };
  await still(take, start + 1.0, "gap");
  await sleep(TAIL_MS - 1000);
  lengths.gap = await finish(take, "gap");
}

// 2 + 3. typing and bursts share one take: send "hey", wait for the dots, then her bursts
{
  const take = await open(browser);
  await sleep(500);
  await take.page.fill(".composer__input", "hey");
  await take.page.press(".composer__input", "Enter");
  // drop focus so the layout is not sized for a keyboard that is not on screen
  await take.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await take.page.waitForSelector(".typing", { timeout: 15_000 });
  const typingAt = take.now();
  clips.typing = { file: "footage/thread.webm", start: Math.max(0, typingAt - LEAD) };
  await still(take, typingAt + 1.0, "typing");
  await take.page.waitForSelector(".bubble--them >> text=hey you", { timeout: 15_000 });
  const burstAt = take.now();
  clips.bursts = { file: "footage/thread.webm", start: Math.max(0, burstAt - LEAD) };
  await take.page.waitForSelector(".bubble--them >> text=how'd it go", { timeout: 15_000 });
  await still(take, burstAt + 2.2, "bursts");
  await sleep(TAIL_MS - 400);
  lengths.thread = await finish(take, "thread");
}

// 4. call: open the call, tap to play her first clip, wait for the bars to move
{
  const take = await open(browser);
  await sleep(500);
  await take.page.click(".call-button");
  await take.page.waitForSelector(".call__name", { timeout: 5_000 });
  await sleep(700);
  await take.page.click(".call__top");
  await take.page.waitForFunction(
    () => [...document.querySelectorAll<HTMLElement>(".waveform__bar")].some((b) => parseFloat(b.style.height || "0") > 16),
    undefined,
    { timeout: 10_000, polling: 50 },
  );
  const barsAt = take.now();
  clips.call = { file: "footage/call.webm", start: Math.max(0, barsAt - 0.6) };
  await still(take, barsAt + 0.6, "call");
  await sleep(TAIL_MS);
  lengths.call = await finish(take, "call");
}

await browser.close();
for (const k of Object.keys(clips)) clips[k]!.start = Math.round(clips[k]!.start * 100) / 100;
writeFileSync(resolve(footage, "clips.json"), `${JSON.stringify(clips, null, 2)}\n`);
console.log(JSON.stringify({ clips, lengths }, null, 2));
