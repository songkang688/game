/**
 * 1.2 第 4 步 C 档「飞行棋乐园」的手动冒烟替身:用真浏览器把闯关、四人对战、
 * 连胜无尽、双人同屏各跑一遍,顺便量一量 360 / 375 / 1280 三档下棋盘是不是完整入屏、
 * 字号有没有掉到 13px 以下、能点的飞机热区够不够 44px。
 *
 * 跑法(playwright 是临时工具,没有进 package.json):
 *   npm i -D playwright --no-save && npx playwright install chromium --with-deps
 *   npx vite --port 5173
 *   node scripts/smoke-1.2-step4-c.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5173";
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

async function seedProgress(page, gameId, cleared) {
  await page.evaluate(
    ([id, n]) => {
      const stars = Array.from({ length: 188 }, (_, i) => (i < n ? 3 : 0));
      localStorage.setItem(`yiduo-yixing.l99.${id}`, JSON.stringify(stars));
    },
    [gameId, cleared]
  );
}

async function openLevel(page, level) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/flight-chess`, { waitUntil: "load" });
  await page.waitForSelector(".l99-grid", { timeout: 20000 });
  const tabs = page.locator(".l99-tab");
  for (let i = 0; i < (await tabs.count()); i++) {
    await tabs.nth(i).click({ force: true });
    await page.waitForTimeout(120);
    const node = page.locator(`.l99-node[aria-label^="第 ${level + 1} 关"]:not(.l99-node-lock)`);
    if ((await node.count()) > 0) {
      await node.first().click({ force: true });
      await page.waitForSelector(".fc-board", { timeout: 15000 });
      return true;
    }
  }
  return false;
}

async function checkNoOverflow(page, label) {
  const over = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  log(over.scroll <= over.client + 2, `${label} 无横向溢出`, `${over.scroll}/${over.client}`);
}

/** 棋盘必须是正方形,而且整块都在视口里 */
async function checkBoard(page, label, vp) {
  const box = await page.locator(".fc-board").first().boundingBox();
  if (!box) return log(false, `${label} 找得到棋盘`);
  const square = Math.abs(box.width - box.height) <= 2;
  log(square, `${label} 棋盘是正方形`, `${Math.round(box.width)}×${Math.round(box.height)}`);
  log(box.width <= vp.width + 1, `${label} 棋盘横向完整入屏`, `${Math.round(box.width)} ≤ ${vp.width}`);
}

/** 界面上所有看得见的字都不许小于 13px */
async function checkFontSize(page, label) {
  const small = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll(".fc-wrap *, .fc-modebar *, .fc-mode *")) {
      if (!el.textContent || !el.textContent.trim()) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px && px < 13) bad.push(`${el.className}:${px}px`);
    }
    return [...new Set(bad)].slice(0, 6);
  });
  log(small.length === 0, `${label} 字号一律 ≥13px`, small.join(" | "));
}

/** 当前能点的飞机,热区（含隐形 ::before）必须够手指按 */
async function checkTouchTarget(page, label) {
  const hot = await page.evaluate(() => {
    const el = document.querySelector(".fc-token-can");
    if (!el) return null;
    const before = getComputedStyle(el, "::before");
    const box = el.getBoundingClientRect();
    return {
      w: Math.max(box.width, parseFloat(before.width) || 0),
      h: Math.max(box.height, parseFloat(before.height) || 0),
    };
  });
  if (!hot) return log(true, `${label} 这一刻没有待选的飞机（跳过热区检查）`);
  log(hot.w >= 44 && hot.h >= 44, `${label} 可点飞机热区 ≥44px`, `${Math.round(hot.w)}×${Math.round(hot.h)}`);
}

/** 一直按掷骰,直到出结算或超时 */
async function playUntilOver(page, seconds = 90) {
  const deadline = Date.now() + seconds * 1000;
  let sawToken = false;
  while (Date.now() < deadline) {
    if (await page.locator(".l99-ov-title, .fc-over-t").count()) break;
    if (!sawToken && (await page.locator(".fc-token-can").count())) sawToken = true;
    const roll = page.locator(".fc-btn-go:not([disabled])").first();
    if (await roll.count()) {
      await roll.click({ force: true }).catch(() => {});
      await page.waitForTimeout(260);
      continue;
    }
    // 轮到自己挑飞机就点最靠前的那个候选
    const pick = page.locator(".fc-pick:not([disabled])").first();
    if (await pick.count()) {
      await pick.click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(200);
  }
  return sawToken;
}

/** 走格禁止瞬移:连拍几十帧,飞机必须在起点与终点之间出现过中间位置 */
async function checkNoTeleport(page, label) {
  const moved = await page.evaluate(async () => {
    const tokens = [...document.querySelectorAll(".fc-token")];
    if (tokens.length === 0) return null;
    const read = () => tokens.map((t) => t.getBoundingClientRect().left);
    const a = read();
    const btn =
      document.querySelector(".fc-btn-go:not([disabled])") ?? document.querySelector(".fc-pick:not([disabled])");
    btn?.click();
    const frames = [];
    for (let i = 0; i < 26; i++) {
      await new Promise((r) => setTimeout(r, 80));
      frames.push(read());
    }
    const b = frames.at(-1);
    let jumped = 0;
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(b[i] - a[i]) < 1) continue;
      // 中途至少要出现过一个既不是起点也不是终点的位置
      const between = frames.some((f) => Math.abs(f[i] - a[i]) > 1 && Math.abs(f[i] - b[i]) > 1);
      if (!between) jumped++;
    }
    return { jumped, any: a.some((v, i) => Math.abs(b[i] - v) > 1) };
  });
  if (!moved || !moved.any) return log(true, `${label} 这一手没人动（跳过瞬移检查）`);
  log(moved.jumped === 0, `${label} 走格一格一格挪，没有瞬移`, `瞬移 ${moved.jumped} 架`);
}

async function openMode(page, label) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/flight-chess`, { waitUntil: "load" });
  await page.waitForSelector(".fc-modebar", { timeout: 20000 });
  const btn = page.locator(".fc-open", { hasText: label }).first();
  if ((await btn.count()) === 0) return false;
  await btn.click({ force: true });
  await page.waitForTimeout(400);
  return true;
}

async function run() {
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.width < 500,
    });
    const page = await ctx.newPage();
    page.on("pageerror", (err) => log(false, `${vp.name} 页面报错`, String(err)));

    // ---- 闯关第 1 关:起飞跑道 ----
    await page.goto(`${BASE}/?t=${Date.now()}`, { waitUntil: "load" });
    await seedProgress(page, "flight-chess", 0);
    const opened = await openLevel(page, 0);
    log(opened, `${vp.name} 闯关第 1 关打得开`);
    if (opened) {
      await checkBoard(page, `${vp.name} 第 1 关`, vp);
      await checkFontSize(page, `${vp.name} 第 1 关`);
      await playUntilOver(page, 60);
      const title = (await page.locator(".l99-ov-title").first().textContent().catch(() => ""))?.trim() ?? "";
      log(title.length > 0, `${vp.name} 闯关第 1 关走到结算`, title);
      await checkNoOverflow(page, `${vp.name} 闯关`);
    }

    // ---- 闯关第 100 关:叠机堡垒,验证能选飞机、热区够大 ----
    await seedProgress(page, "flight-chess", 120);
    if (await openLevel(page, 99)) {
      await page.locator(".fc-btn-go").first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(1400);
      await checkTouchTarget(page, `${vp.name} 第 100 关`);
      await checkBoard(page, `${vp.name} 第 100 关`, vp);
      // 这一关一开局就有三架在路上,挑一架走,正好拿来量「有没有瞬移」
      await checkNoTeleport(page, `${vp.name} 第 100 关`);
      // Esc 暂停面板
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      log((await page.locator(".fc-pause").count()) === 1, `${vp.name} Esc 能叫出暂停面板`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      log((await page.locator(".fc-pause").count()) === 0, `${vp.name} Esc 能收回暂停面板`);
    }

    // ---- 四人对战 ----
    // 一整局四人飞行棋本来就要几分钟,这里只跑一段,看它是不是真的在往前推
    if (await openMode(page, "四人对战")) {
      await page.locator(".fc-btn-sm").first().click({ force: true });
      await page.waitForSelector(".fc-board", { timeout: 15000 });
      await checkBoard(page, `${vp.name} 四人对战`, vp);
      log((await page.locator(".fc-seat").count()) === 4, `${vp.name} 四人对战摆满四个座位`);
      const rollsOf = async () =>
        Number(/已掷\s*(\d+)/.exec((await page.locator(".fc-top .fc-badge").nth(1).textContent()) ?? "")?.[1] ?? -1);
      const t0 = await rollsOf();
      await playUntilOver(page, 90);
      const t1 = await rollsOf();
      log(t1 > t0 + 20, `${vp.name} 四人对战一直在推进`, `已掷 ${t0} → ${t1} 次`);
      const airborne = async () =>
        page.evaluate(
          () =>
            [...document.querySelectorAll(".fc-token")]
              .map((n) => n.getAttribute("aria-label") ?? "")
              .filter((t) => !t.includes("基地")).length
        );
      // 起飞只认 6 点：「≥4 架离开基地」中位数要掷 24 次骰、p99 要 63 次，
      // 而上面那句只保证掷过 21 次 —— 原来在这个时刻拍一张快照断言 ≥4，
      // 等于在分布正中间掷硬币，第 1 轮 375×667 就是这么挂的（W1-11）。
      // 定 seed 复现与分布见 src/games/__tests__/window1-smoke-seeds.test.ts：
      // 150 个 seed 全都到得了，只是要给够掷骰次数。所以这里改成接着打、打到为止。
      let out = await airborne();
      for (let more = 0; more < 3 && out < 4; more++) {
        await playUntilOver(page, 45);
        out = await airborne();
      }
      log(out >= 4, `${vp.name} 四人对战至少四架飞上了环线`, `${out}/16 架在路上（已掷 ${await rollsOf()} 次）`);
      await checkNoOverflow(page, `${vp.name} 四人对战`);
    }

    // ---- 连胜无尽 ----
    if (await openMode(page, "连胜无尽")) {
      await page.waitForSelector(".fc-board", { timeout: 15000 });
      const chip = (await page.locator(".fc-mhead .fc-badge").first().textContent()) ?? "";
      log(/连胜\s*\d+/.test(chip), `${vp.name} 无尽显示连胜与最高纪录`, chip.trim());
      await checkBoard(page, `${vp.name} 连胜无尽`, vp);
      await checkNoOverflow(page, `${vp.name} 连胜无尽`);
    }

    // ---- 双人同屏:朵朵 F、星星 L 各掷各的 ----
    if (await openMode(page, "双人同屏")) {
      await page.waitForSelector(".fc-board", { timeout: 15000 });
      log((await page.locator(".fc-seat").count()) === 4, `${vp.name} 双人同屏也是四色同场`);
      const before = (await page.locator(".fc-top .fc-badge").first().textContent()) ?? "";
      await page.keyboard.press("f");
      await page.waitForTimeout(1600);
      const after = (await page.locator(".fc-top .fc-badge").first().textContent()) ?? "";
      log(before !== after, `${vp.name} 双人同屏 F 键掷得动骰子`, `${before.trim()} → ${after.trim()}`);
      await checkFontSize(page, `${vp.name} 双人同屏`);
      await checkNoOverflow(page, `${vp.name} 双人同屏`);
    }

    await ctx.close();
  }
  await browser.close();

  const bad = results.filter((r) => !r.ok);
  console.log(`\n共 ${results.length} 项,失败 ${bad.length} 项`);
  if (bad.length) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
