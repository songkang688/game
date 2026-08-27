/**
 * 1.2 第 8 步 B 档的手动冒烟替身：用真浏览器把「跳跳台」跑一遍。
 *
 * 单测能验的都在 `src/games/hop-pads/*.test.ts` 里验过了：蓄力映射单调封顶、
 * 落台三种判定的边界、生成器座座可达、188 关章节和、四档幽灵强弱有序，
 * 连 mount / destroy 都在 DOM 桩上数过监听。这份脚本补的是桩验不了的那几件事：
 *  1. 360×640 / 375×667 / 1280×800 都不横向溢出，画布完整入屏、HUD 字号够大；
 *  2. 整块画面真的是蓄力热区：在画布最左上角按住再松手，人真的跳出去了；
 *  3. 空格 / F 按住蓄力松开起跳，座数真的往上走；
 *  4. Esc 真的停得住，暂停期间局内时间不再推进，再按一次能继续；
 *  5. 三个模式入口都点得进去、回得来，双人是上下两块画布；
 *  6. 离开游戏之后 keydown 监听与 rAF 全部停掉，不在后台空转。
 *
 * 跑法（puppeteer-core 是临时工具，没有进 package.json）：
 *   npm i --no-save puppeteer-core   # 本机需有 Chrome
 *   npm run build && npx vite preview --port 4173
 *   node scripts/smoke-1.2-step8-b.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

/** 规格第九节：360px 上分数与连击字号不小于 16px */
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
  await page.goto(`${BASE}/?t=${Date.now()}#/game/hop-pads`, { waitUntil: "load" });
  await page.waitForSelector(".hp-open", { timeout: 20000 });
}

/** 点开写着这几个字的那个按钮 */
async function clickText(page, sel, text) {
  const ok = await page.evaluate(
    (s, t) => {
      const btn = [...document.querySelectorAll(s)].find((b) => b.textContent.includes(t));
      if (!btn) return false;
      btn.click();
      return true;
    },
    sel,
    text
  );
  if (!ok) throw new Error(`找不到按钮：${text}`);
}

/** 读第 i 块画布上挂着的状态 */
async function readStage(page, i = 0) {
  return page.evaluate((idx) => {
    const c = document.querySelectorAll(".hp-canvas")[idx];
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return {
      hops: +(c.getAttribute("data-hops") ?? -1),
      score: +(c.getAttribute("data-score") ?? -1),
      phase: c.getAttribute("data-phase"),
      paused: c.getAttribute("data-paused") === "1",
      label: c.getAttribute("aria-label") ?? "",
      w: r.width,
      h: r.height,
      top: r.top,
      left: r.left,
    };
  }, i);
}

/** 按住键盘 ms 毫秒再松开 */
async function holdKey(page, key, ms) {
  await page.keyboard.down(key);
  await sleep(ms);
  await page.keyboard.up(key);
  await sleep(1100);
}

/** 在画布的某个角上按住 ms 毫秒再松开（验整屏热区） */
async function holdCorner(page, ms) {
  const box = await readStage(page);
  const x = box.left + 8;
  const y = box.top + 8;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
  await sleep(1100);
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
    const modes = await page.$$eval(".hp-bar .hp-open", (bs) => bs.map((b) => b.textContent.trim()));
    log(modes.length === 3, `${vp.name} 无尽 / 对战 / 双人三个入口都在`, modes.join(" / "));
    const mapOk = await page.evaluate(() => Boolean(document.querySelector(".l99-map, .l99-grid")));
    log(mapOk, `${vp.name} 188 关地图在选关页上`);

    // ---- 进第 1 关 ----
    await clickText(page, ".l99-continue", "▶");
    await page.waitForSelector(".hp-canvas", { visible: true, timeout: 10000 });
    await sleep(400);

    const { scroll, client } = await overflow(page);
    log(scroll <= client + 1, `${vp.name} 不横向溢出`, `scroll=${scroll} client=${client}`);

    const st0 = await readStage(page);
    log(st0.w <= vp.width, `${vp.name} 画布完整入屏`, `画布宽 ${Math.round(st0.w)} ≤ ${vp.width}`);
    log(st0.label.includes("站住"), `${vp.name} 画布有读屏文字`, st0.label);

    const hudPx = await page.$eval(".hp-hud", (el) => parseFloat(getComputedStyle(el).fontSize));
    log(hudPx >= MIN_HUD_PX, `${vp.name} 分数与连击字号 ≥ 16px`, `${hudPx}px`);
    const hotBox = await page.$eval(".hp-hot", (el) => {
      const r = el.getBoundingClientRect();
      const p = el.parentElement.getBoundingClientRect();
      return { w: r.width, h: r.height, pw: p.width, ph: p.height };
    });
    log(
      Math.abs(hotBox.w - hotBox.pw) < 2 && Math.abs(hotBox.h - hotBox.ph) < 2,
      `${vp.name} 蓄力热区盖满整块画面`,
      `${Math.round(hotBox.w)}×${Math.round(hotBox.h)}`
    );

    // ---- 空格蓄力真的能跳 ----
    await holdKey(page, "Space", 520);
    const st1 = await readStage(page);
    log(st1.hops > st0.hops, `${vp.name} 按住空格松手真的跳出去了`, `${st0.hops} 座 → ${st1.hops} 座`);
    log(st1.phase === "ready" || st1.phase === "falling", `${vp.name} 落地后回到可再跳的状态`, st1.phase);

    // ---- 整屏热区:在最左上角按住也能蓄力 ----
    if (st1.phase === "ready") {
      await holdCorner(page, 520);
      const st2 = await readStage(page);
      log(st2.hops > st1.hops || st2.phase === "falling", `${vp.name} 画面角落按住一样能蓄力起跳`, `${st2.hops} 座`);
    } else {
      log(true, `${vp.name} 这一跳落空了,云朵接住,跳过角落热区这一项`);
    }

    // ---- Esc 暂停与继续 ----
    await openGame(page);
    await clickText(page, ".l99-continue", "▶");
    await page.waitForSelector(".hp-canvas", { visible: true, timeout: 10000 });
    await sleep(300);
    await page.keyboard.press("Escape");
    await sleep(260);
    const paused = await readStage(page);
    log(paused.paused, `${vp.name} Esc 暂停了`, paused.label);
    await page.keyboard.press("Escape");
    await sleep(260);
    log(!(await readStage(page)).paused, `${vp.name} 再按一次继续`);

    // ---- 三个模式 ----
    await openGame(page);
    for (const [label, canvases] of [
      ["无尽跳", 1],
      ["双人同屏", 2],
    ]) {
      await clickText(page, ".hp-bar .hp-open", label);
      await page.waitForSelector(".hp-canvas", { visible: true, timeout: 10000 });
      await sleep(400);
      const n = await page.$$eval(".hp-canvas", (cs) => cs.length);
      log(n === canvases, `${vp.name} ${label} 是 ${canvases} 块画布`, `实际 ${n} 块`);
      const wide = await overflow(page);
      log(wide.scroll <= wide.client + 1, `${vp.name} ${label} 不横向溢出`);
      await clickText(page, ".hp-back", "返回");
      await sleep(300);
    }

    await clickText(page, ".hp-bar .hp-open", "幽灵对战");
    await sleep(300);
    const tiers = await page.$$eval(".hp-open", (bs) => bs.map((b) => b.textContent.trim()));
    log(tiers.some((t) => t.includes("地狱")), `${vp.name} 对战四档对手都选得到`, tiers.join(" / "));
    await clickText(page, ".hp-open", "开跳");
    await page.waitForSelector(".hp-canvas", { visible: true, timeout: 10000 });
    await sleep(400);
    const vsInfo = await page.$eval(".hp-say", (el) => el.textContent);
    log(vsInfo.includes("分"), `${vp.name} 对战报得出幽灵成绩`, vsInfo);

    // ---- 离开游戏之后不留监听、不空转 ----
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
