/**
 * 窗口 6 R1 fixer · 自查:360/320 宽跑首页 + 9 款(地图态 + 第 1 关场景态)横向溢出审计。
 * 用法:npm run build && npx vite preview --port 4173,再 node scripts/qa-window6/fixer-overflow.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GAMES = [
  "brave-path", "adventure-king", "alien-seek", "brick-break", "mole-pop",
  "box-hamster", "balloon-pop", "bubble-pop", "bubble-aim",
];

async function overflow(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const doc = Math.max(de.scrollWidth, document.body.scrollWidth) - de.clientWidth;
    let worst = 0;
    let worstSel = "";
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      const past = Math.round(r.right - de.clientWidth);
      if (past > worst && r.width > 4 && r.height > 4) {
        worst = past;
        worstSel = (typeof el.className === "string" ? el.className : el.tagName).slice(0, 50);
      }
    }
    return { doc: Math.round(doc), worst, worstSel };
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
  const rows = [];

  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await sleep(700);
  rows.push({ id: "home", ...(await overflow(page)) });

  for (const id of GAMES) {
    await page.goto(`${BASE}/#/game/${id}`, { waitUntil: "networkidle0" }).catch(() => {});
    await sleep(1200);
    // 有的款先落在模式选择屏:点「闯关/战役/一个人玩」进地图
    await page.evaluate(() => {
      const re = /闯关|战役|冒险|188|关卡地图|一个人玩|独自|单人闯/;
      const stage = document.querySelector(".game-stage");
      if (!stage || document.querySelector(".l99-node")) return;
      for (const b of stage.querySelectorAll("button")) {
        const t = (b.textContent ?? "").trim();
        if (t && re.test(t)) { b.click(); return; }
      }
    });
    await sleep(900);
    rows.push({ id: `${id}·map`, ...(await overflow(page)) });
    const opened = await page.evaluate(() => {
      const hit = [...document.querySelectorAll(".l99-node")].find((el) =>
        (el.getAttribute("aria-label") ?? "").startsWith("第 1 关"));
      if (!hit) return false;
      hit.click();
      return true;
    });
    if (opened) {
      await sleep(1300);
      rows.push({ id: `${id}·lv1`, ...(await overflow(page)) });
    } else {
      rows.push({ id: `${id}·lv1`, doc: -1, worst: -1, worstSel: "no-map" });
    }
  }
  await browser.close();
  const bad = rows.filter((r) => r.doc > 0 || r.worst > 0);
  console.log(`== width ${width}:${rows.length} 个采样点,溢出 ${bad.length} 个`);
  for (const r of rows) console.log(`${String(r.id).padEnd(22)} doc=${r.doc} worst=${r.worst} ${r.worst > 0 ? r.worstSel : ""}`);
}

await run(360);
await run(320);
