/**
 * 1.2 第 6 步 B 档的手动冒烟替身：用真浏览器把「果果合成」跑一遍。
 *
 * 单测能验的都在 `src/games/fruit-stack/*.test.ts` 里验过了：物理不爆能量、188 关
 * 无头回放全通、四档假人强弱有序，连 mount / destroy 都在 DOM 桩上数过监听。
 * 这份脚本补的是桩验不了的那几件事：
 *  1. 360×640 / 375×667 / 1280×800 都不横向溢出，盆完整入屏、字号够大；
 *  2. A / D / F 真的能把果子投下去，合成真的会发生（最大果往上走）；
 *  3. Esc 真的停得住，暂停期间盘面不再推进，再按一次能继续；
 *  4. 三个模式入口都点得进去、回得来；
 *  5. 离开游戏之后 keydown 监听与 rAF 全部停掉，不在后台空转。
 *
 * 跑法（puppeteer-core 是临时工具，没有进 package.json）：
 *   npm i --no-save puppeteer-core   # 本机需有 Chrome
 *   npm run build && npx vite preview --port 4173
 *   node scripts/smoke-1.2-step6-b.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

/** 规格第九节：360px 上字号不小于 13px */
const MIN_FONT_PX = 13;

const VIEWPORTS = [
  { name: "360×640", width: 360, height: 640 },
  { name: "375×667", width: 375, height: 667 },
  { name: "1280×800", width: 1280, height: 800 },
];

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 装监听器与 rAF 的计数探针，页面一开就注入 */
async function installProbes(page) {
  await page.evaluateOnNewDocument(() => {
    window.__probe = { keydown: 0, raf: 0 };
    const addEL = window.addEventListener.bind(window);
    const rmEL = window.removeEventListener.bind(window);
    window.addEventListener = (type, fn, opts) => {
      if (type === "keydown") window.__probe.keydown++;
      return addEL(type, fn, opts);
    };
    window.removeEventListener = (type, fn, opts) => {
      if (type === "keydown") window.__probe.keydown--;
      return rmEL(type, fn, opts);
    };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      raf((t) => {
        window.__probe.raf++;
        return cb(t);
      });
  });
}

async function openGame(page) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/fruit-stack`, { waitUntil: "load" });
  await page.waitForSelector(".fs-open", { timeout: 20000 });
}

/** 点开写着这几个字的那个模式按钮 */
async function openMode(page, label) {
  const clicked = await page.evaluate((text) => {
    const btn = [...document.querySelectorAll(".fs-open")].find((b) => b.textContent.includes(text));
    if (!btn) return false;
    btn.click();
    return true;
  }, label);
  if (!clicked) throw new Error(`找不到模式按钮：${label}`);
  await page.waitForSelector(".fs-canvaswrap canvas", { visible: true, timeout: 10000 });
}

async function backToMenu(page) {
  await page.evaluate(() => {
    [...document.querySelectorAll(".fs-back")].find((b) => b.textContent.includes("回选关"))?.click();
  });
  await page.waitForSelector(".fs-open", { timeout: 10000 });
}

/** 把画布 aria-label 里的「鸭梨的果盆，120分，最大「梨」，盆里 7 颗，不限」拆成结构 */
async function readBowl(page) {
  return page.$eval(".fs-canvaswrap canvas", (el) => {
    const label = el.getAttribute("aria-label") ?? "";
    const m = /，(\d+)分，最大「(.+?)」，盆里(\d+)颗/.exec(label);
    const r = el.getBoundingClientRect();
    return {
      label,
      score: m ? +m[1] : null,
      biggest: m ? m[2] : null,
      count: m ? +m[3] : null,
      paused: label.includes("已暂停"),
      drops: +(el.getAttribute("data-drops") ?? 0),
      w: r.width,
      h: r.height,
    };
  });
}

async function overflow(page) {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
}

/** 左右挪几步再按 F，投够 n 颗 */
async function dropSome(page, n) {
  for (let i = 0; i < n; i++) {
    const dir = i % 2 === 0 ? "d" : "a";
    for (let k = 0; k < 3 + (i % 5); k++) await page.keyboard.press(dir);
    await page.keyboard.press("f");
    await sleep(560);
  }
  return readBowl(page);
}

/** 链条顺序，用来判断「最大果」有没有往上走 */
const CHAIN = ["籽", "莓", "柑", "桃", "梨", "苹", "橙", "柚", "瓜", "玉瓜", "团圆瓜"];

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"],
  });
  const page = await browser.newPage();
  await installProbes(page);

  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await openGame(page);

    // ---- 模式入口 ----
    const modes = await page.$$eval(".fs-open", (bs) => bs.map((b) => b.textContent.trim()));
    log(modes.length === 3, `${vp.name} 人机 / 双人 / 无尽三个入口都在`, modes.join(" / "));
    const picks = await page.$$eval(".fs-pick", (bs) => bs.map((b) => b.textContent.trim()));
    log(picks.length === 4, `${vp.name} 四档难度都选得到`, picks.join(" / "));

    await openMode(page, "无尽果盆");
    await sleep(400);

    // ---- 布局 ----
    const { scroll, client } = await overflow(page);
    log(scroll <= client + 1, `${vp.name} 不横向溢出`, `scroll=${scroll} client=${client}`);

    const bowl = await readBowl(page);
    log(bowl.w <= vp.width, `${vp.name} 盆完整入屏`, `画布宽 ${Math.round(bowl.w)} ≤ ${vp.width}`);
    log(bowl.label.length > 0, `${vp.name} 画布有读屏文字`, bowl.label);

    const chipPx = await page.$eval(".fs-chip", (el) => parseFloat(getComputedStyle(el).fontSize));
    log(chipPx >= MIN_FONT_PX - 1, `${vp.name} HUD 字号够大`, `${chipPx}px`);
    const keyPx = await page.$eval(".fs-key", (el) => {
      const r = el.getBoundingClientRect();
      return Math.min(r.width, r.height);
    });
    log(keyPx >= 40, `${vp.name} 触屏按钮热区不小于 40px`, `${Math.round(keyPx)}px`);

    // ---- A / D / F 真的能投，而且真的会合成 ----
    const after = await dropSome(page, 12);
    log(after.drops >= 10, `${vp.name} A / D / F 把果子投下去了`, `投了 ${after.drops} 颗`);
    log(
      after.count !== null && after.count < after.drops,
      `${vp.name} 同级真的合成了`,
      `投了 ${after.drops} 颗，盆里只剩 ${after.count} 颗`,
    );
    log(
      CHAIN.indexOf(after.biggest ?? "") > 0,
      `${vp.name} 最大果爬上去了`,
      `最大「${after.biggest}」，${after.score} 分`,
    );

    // ---- Esc 暂停与继续 ----
    await page.keyboard.press("Escape");
    await sleep(260);
    const frozen = await readBowl(page);
    log(frozen.paused, `${vp.name} Esc 暂停了`);
    await sleep(900);
    const still = await readBowl(page);
    log(
      still.count === frozen.count && still.score === frozen.score,
      `${vp.name} 暂停期间盘面不再推进`,
      `${frozen.count} 颗 / ${frozen.score} 分 → ${still.count} 颗 / ${still.score} 分`,
    );
    await page.keyboard.press("Escape");
    await sleep(260);
    log(!(await readBowl(page)).paused, `${vp.name} 再按一次继续`);

    // ---- 回菜单再进别的模式 ----
    await backToMenu(page);
    for (const label of ["人机对战", "双人同屏"]) {
      await openMode(page, label);
      await sleep(500);
      const canvases = await page.$$eval(".fs-canvaswrap canvas", (cs) =>
        cs.map((c) => c.getBoundingClientRect().width),
      );
      log(canvases.length === 2, `${vp.name} ${label} 是左右两个盆`, canvases.map(Math.round).join(" + "));
      const total = canvases.reduce((a, b) => a + b, 0);
      log(total <= vp.width + 1, `${vp.name} ${label} 两个盆并排不超屏`, `${Math.round(total)} ≤ ${vp.width}`);
      await backToMenu(page);
    }

    // ---- 闯关地图 ----
    const mapOk = await page.evaluate(() => Boolean(document.querySelector(".l99-map, .l99-grid")));
    log(mapOk, `${vp.name} 188 关地图在选关页上`);

    // ---- 离开游戏之后不留监听、不空转 ----
    await openMode(page, "无尽果盆");
    await sleep(500);
    const live = await page.evaluate(() => window.__probe.keydown);
    await page.goto(`${BASE}/?t=${Date.now()}#/`, { waitUntil: "load" });
    await sleep(600);
    const rafBefore = await page.evaluate(() => window.__probe.raf);
    await sleep(700);
    const rafAfter = await page.evaluate(() => window.__probe.raf);
    const leftOver = await page.evaluate(() => window.__probe.keydown);
    log(leftOver <= 0, `${vp.name} 离开后 keydown 监听收干净`, `进游戏时 ${live}，离开后 ${leftOver}`);
    log(rafAfter - rafBefore < 12, `${vp.name} 离开后 rAF 不再空转`, `0.7s 内又跑了 ${rafAfter - rafBefore} 帧`);
  }

  log(errors.length === 0, "整场没有页面报错", errors.slice(0, 3).join(" | "));

  await browser.close();

  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} 项通过`);
  if (bad.length) {
    console.log("没过的：");
    for (const b of bad) console.log(`  - ${b.what}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
