/**
 * 1.2 第 6 步 A 档的手动冒烟替身：用真浏览器把「豆豆迷宫」跑一遍。
 *
 * 单测能验的都在 `src/games/dot-maze/*.test.ts` 里验过了（含 DOM 桩上的 destroy 断言）。
 * 这份脚本补的是桩验不了的那几件事：
 *  1. 375×667 与 1280×800 都不横向溢出，360px 上整张迷宫完整入屏且每格 ≥ 14px；
 *  2. WASD 真的能让朵朵吃到豆，Esc 能停住、再按能继续；
 *  3. 四个模式入口都点得进去，回菜单也回得来；
 *  4. 离开游戏之后 keydown 监听与 rAF 全部停掉，不在后台空转。
 *
 * 跑法（puppeteer-core 是临时工具，没有进 package.json）：
 *   npm i --no-save puppeteer-core   # 本机需有 Chrome
 *   npm run build && npx vite preview --port 4173
 *   node scripts/smoke-1.2-step6-a.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

/** 规格第九节：360px 上格子不能小于 14px */
const MIN_CELL_PX = 14;

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
  await page.goto(`${BASE}/?t=${Date.now()}#/game/dot-maze`, { waitUntil: "load" });
  await page.waitForSelector(".dmz-mode", { timeout: 20000 });
}

/** 点开写着这几个字的那个模式按钮 */
async function openMode(page, label) {
  const clicked = await page.evaluate((text) => {
    const btn = [...document.querySelectorAll(".dmz-mode")].find((b) => b.textContent.includes(text));
    if (!btn) return false;
    btn.click();
    return true;
  }, label);
  if (!clicked) throw new Error(`找不到模式按钮：${label}`);
}

/** 把画布 aria-label 里的「朵朵120分，小星命4，剩138颗豆」拆成结构 */
async function readStage(page) {
  return page.$eval(".dmz-canvas", (el) => {
    const m = /朵朵(\d+)分，小星命(\d+)，剩(\d+)颗豆(，已暂停)?/.exec(el.getAttribute("aria-label") ?? "");
    const r = el.getBoundingClientRect();
    return {
      score: m ? +m[1] : null,
      lives: m ? +m[2] : null,
      left: m ? +m[3] : null,
      paused: Boolean(m && m[4]),
      cols: +(el.getAttribute("data-cols") ?? 0),
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

/** 一直按同一串方向键，直到豆子数变了为止 */
async function eatSome(page, keys, tries = 14) {
  const before = (await readStage(page)).left;
  for (let i = 0; i < tries; i++) {
    await page.keyboard.press(keys[i % keys.length]);
    await sleep(180);
    const now = (await readStage(page)).left;
    if (now !== null && before !== null && now < before) return { before, after: now };
  }
  return { before, after: (await readStage(page)).left };
}

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

    // ---- 模式菜单 ----
    const modes = await page.$$eval(".dmz-mode", (bs) => bs.map((b) => b.textContent.trim()));
    log(modes.length === 4, `${vp.name} 菜单上四个模式都在`, modes.join(" / "));

    await openMode(page, "无尽迷宫");
    await page.waitForSelector(".dmz-canvas", { visible: true, timeout: 10000 });
    await sleep(500);

    // ---- 布局 ----
    const { scroll, client } = await overflow(page);
    log(scroll <= client + 1, `${vp.name} 不横向溢出`, `scroll=${scroll} client=${client}`);

    const stage = await readStage(page);
    log(stage.w <= vp.width, `${vp.name} 迷宫完整入屏`, `画布宽 ${Math.round(stage.w)} ≤ ${vp.width}`);
    const cellPx = stage.cols ? stage.w / stage.cols : 0;
    log(
      cellPx >= MIN_CELL_PX,
      `${vp.name} 每格不小于 ${MIN_CELL_PX}px`,
      `${stage.cols} 列 × ${cellPx.toFixed(1)}px`,
    );

    const chipPx = await page.$eval(".dmz-chip", (el) => parseFloat(getComputedStyle(el).fontSize));
    log(chipPx >= 13, `${vp.name} HUD 字号不小于 13px`, `${chipPx}px`);

    const padPx = await page.$eval(".dmz-key[data-dir]", (el) => {
      const r = el.getBoundingClientRect();
      return Math.min(r.width, r.height);
    });
    log(padPx >= 44, `${vp.name} 虚拟方向键热区不小于 44px`, `${Math.round(padPx)}px`);

    // ---- WASD 真的能吃豆 ----
    const eaten = await eatSome(page, ["w", "a", "s", "d"]);
    log(
      eaten.after !== null && eaten.before !== null && eaten.after < eaten.before,
      `${vp.name} WASD 能让朵朵吃到豆`,
      `剩 ${eaten.before} → ${eaten.after}`,
    );

    // ---- Esc 暂停与继续 ----
    await page.keyboard.press("Escape");
    await sleep(240);
    const frozen = await readStage(page);
    log(frozen.paused, `${vp.name} Esc 暂停了`, `HUD：${frozen.left} 颗豆`);
    await sleep(900);
    const still = await readStage(page);
    log(still.left === frozen.left, `${vp.name} 暂停期间不再推进`, `${frozen.left} → ${still.left}`);
    await page.keyboard.press("Escape");
    await sleep(240);
    const resumed = await readStage(page);
    log(!resumed.paused, `${vp.name} 再按一次继续`);

    // ---- 回菜单再进别的模式 ----
    await page.evaluate(() => {
      [...document.querySelectorAll(".dmz-btn")].find((b) => b.textContent.includes("换个玩法"))?.click();
    });
    await page.waitForSelector(".dmz-mode", { timeout: 10000 });
    for (const label of ["抢豆对战", "双人追逃", "闯关 188"]) {
      await openMode(page, label);
      await sleep(400);
      const ok = await page.evaluate(
        () => Boolean(document.querySelector(".dmz-canvas") || document.querySelector(".l99-map")),
      );
      log(ok, `${vp.name} ${label} 进得去`);
      await page.evaluate(() => {
        [...document.querySelectorAll(".dmz-btn")].find((b) => b.textContent.includes("换个玩法"))?.click();
      });
      await page.waitForSelector(".dmz-mode", { timeout: 10000 });
    }

    // ---- 离开游戏之后不留监听、不空转 ----
    await openMode(page, "无尽迷宫");
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
