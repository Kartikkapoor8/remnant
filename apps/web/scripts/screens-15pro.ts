/**
 * Before/after shots for the iPhone 15 Pro spacing pass (393x852, Dynamic Island).
 * Chromium reports 0 for env(safe-area-inset-*), so the device's insets
 * (59px top, 34px bottom) are injected as the CSS tokens the layout reads.
 *
 *   bun apps/web/scripts/screens-15pro.ts <before|after> [http://localhost:5173]
 */
import { chromium } from "playwright";
import { resolve } from "node:path";

const tag = process.argv[2] ?? "after";
const base = process.argv[3] ?? "http://localhost:5173";
const out = resolve(import.meta.dir, "../../../docs/screens");
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  colorScheme: "dark",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
await page.goto(`${base}/?demo=sarah`, { waitUntil: "networkidle" });
await page.addStyleTag({ content: ":root{--safe-top:59px;--safe-bottom:34px;--safe-left:0px;--safe-right:0px}" });
await page.waitForSelector(".header__name", { timeout: 15_000 });
await page.waitForTimeout(2300);
const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
console.log(`${tag}: horizontal scroll = ${hscroll}`);
await page.screenshot({ path: resolve(out, `15pro-${tag}-thread.png`) });
await page.fill(".composer__input", "hey");
await page.press(".composer__input", "Enter");
await page.waitForSelector(".bubble--them >> text=how'd it go", { timeout: 20_000 });
await page.waitForTimeout(300);
await page.screenshot({ path: resolve(out, `15pro-${tag}-bursts.png`) });
await page.click(".call-button");
await page.waitForSelector(".call__name", { timeout: 5_000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: resolve(out, `15pro-${tag}-call.png`) });
await browser.close();
console.log(`wrote 15pro-${tag}-*.png to ${out}`);
