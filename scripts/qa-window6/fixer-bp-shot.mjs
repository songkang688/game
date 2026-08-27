/** 窗口 6 R1 fixer · bubble-pop 360px 截图取证 */
import puppeteer from "puppeteer-core";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const width = Number(process.argv[2] ?? 360);
const out = process.argv[3] ?? `/tmp/bp-${width}.png`;
const extraCss = process.argv[4] ?? "";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio", "--disable-gpu"],
});
const page = await browser.newPage();
await page.setViewport({ width, height: 640, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.goto(`${BASE}/#/game/bubble-pop`, { waitUntil: "networkidle0" });
await sleep(1200);
await page.evaluate(() => {
  const nodes = [...document.querySelectorAll(".l99-node")];
  const hit = nodes.find((el) => (el.getAttribute("aria-label") ?? "").startsWith("第 1 关"));
  if (hit) hit.click();
});
await sleep(1400);
if (extraCss) await page.addStyleTag({ content: extraCss });
await sleep(250);
await page.screenshot({ path: out });
console.log("saved", out);
await browser.close();
