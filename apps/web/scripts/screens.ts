/**
 * Captures the four hero shots at iPhone size (390x844) into docs/screens/.
 * Runs against the scripted demo so the frames are deterministic.
 *
 *   bun apps/web/scripts/screens.ts [http://localhost:5173]
 */
import { chromium, devices } from "playwright";
import { resolve } from "node:path";

const base = process.argv[2] ?? "http://localhost:5173";
const out = resolve(import.meta.dir, "../../../docs/screens");
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 14"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark" });
const page = await ctx.newPage();

await page.goto(`${base}/?demo=sarah`, { waitUntil: "networkidle" });
await page.waitForSelector(".header__name", { timeout: 15_000 });
await page.waitForTimeout(2200); // intro resolves and fades
await page.evaluate(() => document.querySelector(".thread")?.scrollTo({ top: 0 }));
await page.waitForTimeout(900);
await page.screenshot({ path: resolve(out, "01-time-gap.png") });

await page.fill(".composer__input", "hey");
await page.press(".composer__input", "Enter");
await page.waitForSelector(".typing", { timeout: 10_000 });
await page.waitForTimeout(700);
await page.screenshot({ path: resolve(out, "02-typing.png") });

await page.waitForSelector(".bubble--them >> text=how'd it go", { timeout: 15_000 });
await page.waitForTimeout(250);
await page.screenshot({ path: resolve(out, "03-bursts.png") });

await page.click(".call-button");
await page.waitForSelector(".call__name", { timeout: 5_000 });
await page.waitForTimeout(1600);
await page.screenshot({ path: resolve(out, "04-call.png") });

await browser.close();
console.log(`wrote 4 shots to ${out}`);
