/**
 * 1.1 第 6 步 C 档的手动冒烟替身：用真浏览器把「朵星双人冲刺」的 2.5D 分屏跑一遍。
 *
 * 验的是四件事：
 *  1. 375×667 与 1280×800 都不横向溢出，而且分屏方向会自动切（窄屏上下 / 宽屏左右）；
 *  2. 两个人同时按键真的各动各的（脚本同时按下 A 和 →，两个人分别往左往右）；
 *  3. Esc 能暂停、能继续；
 *  4. 离开游戏之后 rAF 与 keydown 监听器全部摘干净。
 *
 * 跑法（puppeteer-core 是临时工具，没有进 package.json）：
 *   npm i --no-save puppeteer-core   # 本机需有 Chrome
 *   npm run build && npx vite preview --port 4173
 *   node scripts/smoke-step6-c.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

const VIEWPORTS = [
  { name: "375×667", width: 375, height: 667, expectLayout: "column" },
  { name: "1280×800", width: 1280, height: 800, expectLayout: "row" },
];

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 把 aria-label 里的「朵朵中道123米金币4剩3」拆成结构 */
function parseLabel(label) {
  const parts = String(label ?? "").split("，");
  const one = (text) => {
    const m = /^(.+?)(左道|中道|右道)(\d+)米金币(\d+)剩(\d+)$/.exec(text ?? "");
    if (!m) return null;
    return { name: m[1], lane: { 左道: 0, 中道: 1, 右道: 2 }[m[2]], dist: +m[3], coins: +m[4], lives: +m[5] };
  };
  return [one(parts[0]), one(parts[1])];
}

async function readRunners(page) {
  const label = await page.$eval(".dr-canvas", (el) => el.getAttribute("aria-label"));
  return parseLabel(label);
}

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
  await page.goto(`${BASE}/?t=${Date.now()}#/game/duo-rush`, { waitUntil: "load" });
  await page.waitForSelector(".dr-setup", { timeout: 20000 });
}

async function startRace(page, mode) {
  await page.click(`.dr-mode button[data-v="${mode}"]`);
  await page.click(".dr-start");
  await page.waitForSelector(".dr-canvas", { visible: true, timeout: 10000 });
  await sleep(2600); // 3-2-1 倒计时
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
    await startRace(page, "rush");

    const { scroll, client } = await overflow(page);
    log(scroll <= client + 1, `${vp.name} 不横向溢出`, `scroll=${scroll} client=${client}`);

    const box = await page.$eval(".dr-canvas", (el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    const layout = box.w > box.h ? "row" : "column";
    log(layout === vp.expectLayout, `${vp.name} 分屏方向是 ${vp.expectLayout}`, `画布 ${Math.round(box.w)}×${Math.round(box.h)}`);
    log(box.w <= vp.width, `${vp.name} 画布不比屏幕宽`, `${Math.round(box.w)} ≤ ${vp.width}`);

    // ---- 两个人同时按键 ----
    const before = await readRunners(page);
    await page.keyboard.down("a");
    await page.keyboard.down("ArrowRight");
    await sleep(60);
    await page.keyboard.up("a");
    await page.keyboard.up("ArrowRight");
    await sleep(320);
    const after = await readRunners(page);
    const okBoth =
      before[0] && after[0] && before[1] && after[1] &&
      after[0].lane < before[0].lane &&
      after[1].lane > before[1].lane;
    log(
      Boolean(okBoth),
      `${vp.name} 两人同时按键各动各的`,
      `朵朵 ${before[0]?.lane}→${after[0]?.lane}，星星 ${before[1]?.lane}→${after[1]?.lane}`,
    );

    // 反向再来一次，确认不是一次性的
    await page.keyboard.down("d");
    await page.keyboard.down("ArrowLeft");
    await sleep(60);
    await page.keyboard.up("d");
    await page.keyboard.up("ArrowLeft");
    await sleep(320);
    const back = await readRunners(page);
    log(
      back[0].lane > after[0].lane && back[1].lane < after[1].lane,
      `${vp.name} 反方向也各动各的`,
      `朵朵 ${after[0].lane}→${back[0].lane}，星星 ${after[1].lane}→${back[1].lane}`,
    );

    // ---- 真的在往前跑 ----
    const d0 = (await readRunners(page))[0].dist;
    await sleep(900);
    const d1 = (await readRunners(page))[0].dist;
    log(d1 > d0, `${vp.name} 赛道在往前推进`, `${d0}m → ${d1}m`);

    // ---- 盖层默认不能挡着画面 ----
    const shown = (sel) =>
      page.$eval(sel, (el) => getComputedStyle(el).display !== "none" && el.getClientRects().length > 0);
    log(!(await shown(".dr-pausepanel")), `${vp.name} 比赛中暂停面板没有挡在画面上`);
    log(!(await shown(".dr-setup")), `${vp.name} 比赛中设置面板已经收起来`);

    // ---- Esc 暂停与继续 ----
    await page.keyboard.press("Escape");
    await sleep(200);
    const pausedVisible = await shown(".dr-pausepanel");
    const p0 = (await readRunners(page))[0].dist;
    await sleep(700);
    const p1 = (await readRunners(page))[0].dist;
    log(pausedVisible && p1 === p0, `${vp.name} Esc 暂停后画面真的停住`, `${p0}m → ${p1}m`);
    await page.keyboard.press("Escape");
    await sleep(600);
    const p2 = (await readRunners(page))[0].dist;
    log(p2 > p1 && !(await shown(".dr-pausepanel")), `${vp.name} Esc 再按一次继续比赛`, `${p1}m → ${p2}m`);
  }

  // ---- 幽灵对战与人机对战各开一局 ----
  await page.setViewport({ width: 375, height: 667 });
  await openGame(page);
  await startRace(page, "ghost");
  await sleep(1200);
  const ghostRunners = await readRunners(page);
  log(Boolean(ghostRunners[1]) && ghostRunners[1].name.includes("自己"), "幽灵对战的对手是上次的自己", ghostRunners[1]?.name);

  await openGame(page);
  await page.click('.dr-rival button[data-v="2"]');
  await startRace(page, "rush");
  await sleep(2500);
  const aiRunners = await readRunners(page);
  log(aiRunners[1].dist > 0, "人机对战里电脑也在跑", `电脑 ${aiRunners[1].dist}m / 剩 ${aiRunners[1].lives}`);

  // ---- 离开游戏后清理 ----
  const during = await page.evaluate(() => ({ ...window.__probe }));
  await page.goto(`${BASE}/?t=${Date.now()}#/`, { waitUntil: "load" });
  await page.waitForSelector(".home-hero, .card-grid, header", { timeout: 20000 });
  await sleep(400);
  const afterKeys = await page.evaluate(() => window.__probe.keydown);
  const rafA = await page.evaluate(() => window.__probe.raf);
  await sleep(900);
  const rafB = await page.evaluate(() => window.__probe.raf);
  log(afterKeys <= 1, "离开后 keydown 监听器已摘掉", `剩 ${afterKeys} 个（壳层自己那一个）`);
  log(rafB - rafA < 8, "离开后游戏的 rAF 循环已停", `900ms 里只多了 ${rafB - rafA} 帧`);
  void during;

  log(errors.length === 0, "全程没有 pageerror / console.error", errors.slice(0, 3).join(" | "));

  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} 通过`);
  if (bad.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
