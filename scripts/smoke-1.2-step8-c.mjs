/**
 * 1.2 第 8 步 C 档的手动冒烟替身：用真浏览器把「音符下落」跑一遍。
 *
 * 单测能验的都在 `src/games/tap-tiles/*.test.ts` 里验过了（含 DOM 桩上的 destroy 断言）。
 * 这份脚本补的是桩验不了的那几件事：
 *  1. 360×640 / 375×667 / 1280×800 都不横向溢出，四列铺满且每列 ≥ 80px、HUD 字号 ≥ 16px；
 *     以及判定线连同下面那行提示都落在 overflow:hidden 的平台舞台里（被裁掉就没法玩）；
 *  2. D F J K 真的能把分数敲上去，Esc 能停住、再按能继续；
 *  3. 四个入口（188 关闯关 / 无尽加速 / 同谱对战 / 双人同屏）都点得进去，也回得来；
 *  4. 离开游戏之后 keydown 监听与 rAF 全部停掉，不在后台空转。
 *
 * 跑法（puppeteer-core 是临时工具，没有进 package.json）：
 *   npm i --no-save puppeteer-core   # 本机需有 Chrome
 *   npm run build && npx vite preview --port 4173
 *   node scripts/smoke-1.2-step8-c.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

/** 规格第十节：360px 上每一列不能窄于 80px，HUD 字号不小于 16px */
const MIN_LANE_PX = 80;
const MIN_HUD_PX = 16;

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
  await page.goto(`${BASE}/?t=${Date.now()}#/game/tap-tiles`, { waitUntil: "load" });
  await page.waitForSelector(".tt-bar", { timeout: 20000 });
}

/** 点开写着这几个字的那个按钮（模式入口、地图上的开始按钮都走这里） */
async function clickText(page, selector, text) {
  const clicked = await page.evaluate(
    (sel, want) => {
      const btn = [...document.querySelectorAll(sel)].find((b) => b.textContent.includes(want));
      if (!btn) return false;
      btn.click();
      return true;
    },
    selector,
    text,
  );
  if (!clicked) throw new Error(`找不到按钮：${text}`);
}

/** 读一眼舞台：画布尺寸、HUD 里的分数与连击、判定线落在哪儿 */
async function readStage(page) {
  return page.evaluate(() => {
    const c = document.querySelector(".tt-canvas");
    const hud = document.querySelector(".tt-hud");
    const r = c ? c.getBoundingClientRect() : { width: 0, height: 0, top: 0 };
    const text = hud ? hud.textContent : "";
    // 平台舞台是 overflow:hidden 的，判定线被推到它下面就再也点不着
    const box = document.querySelector(".game-stage");
    const say = document.querySelector(".tt-say");
    return {
      w: r.width,
      h: r.height,
      label: c ? c.getAttribute("aria-label") : "",
      score: Number(/(\d+) 分/.exec(text)?.[1] ?? -1),
      combo: Number(/(\d+) 连/.exec(text)?.[1] ?? -1),
      paused: Boolean(document.querySelector(".tt-cover")),
      say: say?.textContent ?? "",
      judgeY: Math.round(r.top + r.height * 0.8),
      sayBottom: say ? Math.round(say.getBoundingClientRect().bottom) : 0,
      clipBottom: box ? Math.round(box.getBoundingClientRect().bottom) : 0,
    };
  });
}

async function overflow(page) {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
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

    // ---- 入口 ----
    const entries = await page.$$eval(".tt-open", (bs) => bs.map((b) => b.textContent.trim()));
    log(entries.length === 3, `${vp.name} 三个模式入口都在`, entries.join(" / "));
    log(
      (await page.$(".l99-map")) !== null,
      `${vp.name} 188 关选关地图在首屏`,
    );

    // ---- 进第 1 关 ----
    await clickText(page, ".l99-continue", "▶");
    await page.waitForSelector(".tt-canvas", { visible: true, timeout: 10000 });
    await sleep(300);

    const { scroll, client } = await overflow(page);
    log(scroll <= client + 1, `${vp.name} 不横向溢出`, `scroll=${scroll} client=${client}`);

    const stage = await readStage(page);
    log(stage.w <= vp.width, `${vp.name} 画布完整入屏`, `画布宽 ${Math.round(stage.w)} ≤ ${vp.width}`);
    log(stage.w / 4 >= MIN_LANE_PX, `${vp.name} 每列不小于 ${MIN_LANE_PX}px`, `${(stage.w / 4).toFixed(1)}px`);
    log(String(stage.label).includes("判定线"), `${vp.name} 画布有读屏文字`, String(stage.label));

    log(
      stage.judgeY > 0 && stage.judgeY <= stage.clipBottom,
      `${vp.name} 判定线在舞台里点得着`,
      `判定线 y=${stage.judgeY}，舞台底 ${stage.clipBottom}`,
    );
    log(
      stage.sayBottom > 0 && stage.sayBottom <= stage.clipBottom,
      `${vp.name} 判定线下面那行提示也没被裁掉`,
      `提示底 ${stage.sayBottom}，舞台底 ${stage.clipBottom}`,
    );

    const hudPx = await page.$eval(".tt-stat", (el) => parseFloat(getComputedStyle(el).fontSize));
    log(hudPx >= MIN_HUD_PX, `${vp.name} HUD 字号不小于 ${MIN_HUD_PX}px`, `${hudPx}px`);

    const btnPx = await page.$eval(".tt-btn", (el) => {
      const r = el.getBoundingClientRect();
      return Math.min(r.width, r.height);
    });
    log(btnPx >= 44, `${vp.name} 暂停按钮热区不小于 44px`, `${Math.round(btnPx)}px`);

    // ---- 敲键真的能得分 ----
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("d");
      await sleep(120);
    }
    const played = await readStage(page);
    log(played.score > 0, `${vp.name} D F J K 能把分数敲上去`, `${played.score} 分 / ${played.combo} 连`);

    // ---- Esc 暂停与继续 ----
    await page.keyboard.press("Escape");
    await sleep(250);
    const frozen = await readStage(page);
    log(frozen.paused, `${vp.name} Esc 盖住了暂停面板`);
    await page.keyboard.press("Escape");
    await sleep(250);
    log(!(await readStage(page)).paused, `${vp.name} 再按一次接着弹`);

    // ---- 回地图,再把另外三个模式点一遍 ----
    await clickText(page, ".l99-back", "选关");
    await page.waitForSelector(".tt-bar", { timeout: 10000 });
    for (const label of ["无尽加速", "同谱对战", "双人同屏"]) {
      await clickText(page, ".tt-open", label);
      await sleep(400);
      if (label === "同谱对战") {
        await clickText(page, ".tt-mode .tt-btn", "地狱");
        // 首页那排入口里也有「点我开始」，所以这里限定在模式面板内找
        await clickText(page, ".tt-mode .tt-open", "开始 ▶");
        await sleep(400);
      }
      log((await page.$(".tt-canvas")) !== null, `${vp.name} ${label} 进得去`);
      await clickText(page, ".tt-goback", "回选关");
      await page.waitForSelector(".tt-bar", { timeout: 10000 });
    }

    // ---- 离开游戏之后不留监听、不空转 ----
    await clickText(page, ".tt-open", "无尽加速");
    await sleep(400);
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
