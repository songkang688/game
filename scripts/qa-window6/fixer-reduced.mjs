/**
 * 窗口 6 R1 fixer · 自查:reduced-motion 抽验(本轮动过的 4 款)。
 * 模拟 prefers-reduced-motion: reduce,断言装饰动画停、功能件还在。
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio", "--disable-gpu"],
});
const page = await browser.newPage();
await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

async function openLv1(id) {
  await page.goto(`${BASE}/#/game/${id}`, { waitUntil: "networkidle0" });
  await sleep(1100);
  await page.evaluate(() => {
    const hit = [...document.querySelectorAll(".l99-node")].find((el) =>
      (el.getAttribute("aria-label") ?? "").startsWith("第 1 关"));
    if (hit) hit.click();
  });
  await sleep(1300);
}

const out = {};

await openLv1("bubble-pop");
out["bubble-pop"] = await page.evaluate(() => {
  const cell = document.querySelector(".bp-cell");
  const decor = document.querySelector(".bp-decor");
  return {
    matchReduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
    cellW: cell ? Math.round(cell.getBoundingClientRect().width * 10) / 10 : null,
    decorAnim: decor ? getComputedStyle(decor).animationName : "no-decor",
    cells: document.querySelectorAll(".bp-cell").length,
  };
});

await openLv1("balloon-pop");
await sleep(2500);
out["balloon-pop"] = await page.evaluate(() => {
  const cloud = document.querySelector(".blp-cloudpuff");
  const badge = document.querySelector(".blp-kbadge");
  return {
    cloudAnim: cloud ? getComputedStyle(cloud).animationName : "no-cloud",
    balloons: document.querySelectorAll(".blp-balloon").length,
    badgeSeen: !!badge,
  };
});

// mole-pop 第 1 关是白天;夜场件断言走单测,这里验白天装饰动画停
await openLv1("mole-pop");
out["mole-pop"] = await page.evaluate(() => {
  const face = document.querySelector(".mp-face");
  const scene = document.querySelector(".mp-scene svg");
  return {
    faceAnim: face ? getComputedStyle(face).animationName : "no-face-yet",
    sceneSvg: !!scene,
  };
});

await openLv1("box-hamster");
out["box-hamster"] = await page.evaluate(() => {
  const box = document.querySelector(".bh-stagebox");
  const goal = document.querySelector(".bh-goal");
  return {
    matBg: box ? getComputedStyle(box).backgroundImage.slice(0, 60) : null,
    goalBreath: goal ? getComputedStyle(goal, "::after").animationName : "no-goal",
    grid: !!document.querySelector(".bh-grid"),
  };
});

console.log(JSON.stringify(out, null, 2));
await browser.close();
