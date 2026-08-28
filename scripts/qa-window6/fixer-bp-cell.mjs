/**
 * 窗口 6 R1 fixer · W6R1-08 取证脚本(不属于玩法代码)。
 * 量 bubble-pop 第 1 关在 360/320 宽下的盘面布局:
 *  1) 现状 min-width:36px 的格子实际尺寸与裁切情况;
 *  2) 注入 min-width:40px 后同样测一遍,判断能不能落。
 * 用法:npm run build && npx vite preview --port 4173,再 node scripts/qa-window6/fixer-bp-cell.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measure(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const board = document.querySelector(".bp-board");
    const wrap = document.querySelector(".bp-wrap");
    const cells = [...document.querySelectorAll(".bp-cell")];
    if (!board || !wrap || cells.length === 0) return { err: "no-board" };
    const first = cells[0].getBoundingClientRect();
    const row0 = cells.slice(0, 8).map((c) => c.getBoundingClientRect());
    const last = row0[row0.length - 1];
    const wrapR = wrap.getBoundingClientRect();
    const boardR = board.getBoundingClientRect();
    return {
      viewport: de.clientWidth,
      docOverflow: Math.max(de.scrollWidth, document.body.scrollWidth) - de.clientWidth,
      wrapContentRight: wrapR.right - parseFloat(getComputedStyle(wrap).paddingRight),
      wrapClientW: wrap.clientWidth,
      boardW: Math.round(boardR.width * 10) / 10,
      boardScrollW: board.scrollWidth,
      cellW: Math.round(first.width * 10) / 10,
      cellH: Math.round(first.height * 10) / 10,
      lastCellRight: Math.round(last.right * 10) / 10,
      // 最后一列有没有被 .bp-wrap 的 overflow:hidden 裁掉
      lastColClippedPx: Math.round((last.right - (wrapR.right - parseFloat(getComputedStyle(wrap).paddingRight))) * 10) / 10,
      pastViewportPx: Math.round((last.right - de.clientWidth) * 10) / 10,
    };
  });
}

async function run(width) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width, height: 640, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await page.goto(`${BASE}/#/game/bubble-pop`, { waitUntil: "networkidle0" });
  await sleep(1200);
  // 进第 1 关
  const opened = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".l99-node")];
    const hit = nodes.find((el) => (el.getAttribute("aria-label") ?? "").startsWith("第 1 关"));
    if (!hit) return false;
    hit.click();
    return true;
  });
  if (!opened) {
    console.log(JSON.stringify({ width, err: "no-level-node" }));
    await browser.close();
    return;
  }
  await sleep(1400);
  const before = await measure(page);
  await page.addStyleTag({ content: ".bp-cell { min-width: 40px !important; }" });
  await sleep(300);
  const after40 = await measure(page);
  console.log(JSON.stringify({ width, before, after40 }, null, 2));
  await browser.close();
}

await run(360);
await run(320);
