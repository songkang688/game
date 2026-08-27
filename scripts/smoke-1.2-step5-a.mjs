/**
 * 1.2 第 5 步 A「星星合成」的手动冒烟替身：用真浏览器（360×640 最窄屏）
 * 把这盘数字从头到尾摸一遍，覆盖验收清单里靠单元测试证不了的几条：
 *
 *   1. 首页靠 import.meta.glob 自动发现这张卡；
 *   2. 360px 竖屏不横向溢出，整块盘面露在屏幕里，盘上每个数字的字号都 ≥ 16px；
 *   3. 抽查 8 个章节各一关：每一步都把 DOM 上真实渲染出来的盘面读回来，
 *      交给页面里的「地狱」假人挑方向，再用真 keydown 按下去，等「过关」浮层弹出来；
 *   4. 滑行是补出来的不是瞬变：.mg-tile 的 transition-duration 落在 80–140ms 里；
 *   5. 键位在真实 keydown 下有效：方向键、WASD、Esc 暂停后按键不动盘；
 *   6. 手机四向滑屏：真 pointer 事件划一下，盘面跟着动；
 *   7. 对战竞速 / 马拉松无尽 / 双人同屏三个入口都开得起来，盘面真的画出东西；
 *   8. destroy 无泄漏：进 → 玩 → 退回首页 → window 监听、interval、rAF 全部清干净；
 *   9. 全程没有 pageerror 和 console.error。
 *
 * 跑法（puppeteer-core 是临时工具，没有进 package.json）：
 *   npm i --no-save puppeteer-core
 *   npx vite --port 5183
 *   node scripts/smoke-1.2-step5-a.mjs        # SMOKE_LEVELS=1,25 可只跑其中几关
 *
 * 它连着源码跑（dev server）：盘面是从 .mg-tile 的行内 transform 反算回来的，
 * 方向是页面里 import 的 ai.ts 现挑的，按键走 page.keyboard，不走任何测试后门。
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5183";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const VIEWPORT = { width: 360, height: 640 };
const SAVE_KEY = "yiduo-yixing.l99.merge-2048";
// 8 章各抽一关（章节边界：24/48/72/96/118/140/164/188）
const LEVELS = (process.env.SMOKE_LEVELS ?? "1,25,49,73,97,119,141,188")
  .split(",")
  .map(Number)
  .filter((n) => n >= 1 && n <= 188);

const ARROW = { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

// --- 页面里跑的小工具（都靠 dev server 直接 import 源码） -------------------

/**
 * 把渲染出来的盘面读回来。位置只认 .mg-tile 的**行内** transform：
 * 那是这一步的落点，滑行动画开始的瞬间就写好了，不用等 CSS 补完。
 * 障碍花看 .mg-hole.mg-block 的 left/top。
 */
const READ_BOARD = () => {
  const view = document.querySelector(".mg-board");
  if (!view) return null;
  const tiles = [...view.querySelectorAll(".mg-tile")];
  const holes = [...view.querySelectorAll(".mg-hole")];
  if (!holes.length) return null;
  const cell = parseFloat(holes[0].style.width);
  const xs = [...new Set(holes.map((h) => Math.round(parseFloat(h.style.left))))].sort((a, b) => a - b);
  const ys = [...new Set(holes.map((h) => Math.round(parseFloat(h.style.top))))].sort((a, b) => a - b);
  const size = xs.length;
  const idx = (v, axis) => {
    let best = 0;
    for (let i = 1; i < axis.length; i++) if (Math.abs(axis[i] - v) < Math.abs(axis[best] - v)) best = i;
    return best;
  };
  const board = Array.from({ length: size }, () => Array(size).fill(0));
  for (const h of holes) {
    if (!h.classList.contains("mg-block")) continue;
    board[idx(parseFloat(h.style.top), ys)][idx(parseFloat(h.style.left), xs)] = -1;
  }
  const spots = new Set();
  let minFont = Infinity;
  for (const t of tiles) {
    const m = /translate\(\s*(-?[\d.]+)px[ ,]+(-?[\d.]+)px/.exec(t.style.transform ?? "");
    if (!m) continue;
    const c = idx(parseFloat(m[1]), xs);
    const r = idx(parseFloat(m[2]), ys);
    spots.add(`${r},${c}`);
    board[r][c] = Number(t.textContent);
    minFont = Math.min(minFont, parseFloat(t.style.fontSize));
  }
  // 两块叠在同一格 = 这一步的滑行还没落地，读到的盘面不算数
  return { board, size, cell, settled: spots.size === tiles.length, tiles: tiles.length, minFont };
};

/** 等这一步的滑行落地，再把盘面读回来 */
async function readBoard(page) {
  await page.waitForFunction(`(${READ_BOARD.toString()})()?.settled === true`, { timeout: 5000 }).catch(() => {});
  return page.evaluate(READ_BOARD);
}

/** 这一关的目标数字与步数预算 */
async function levelInfo(page, index) {
  return page.evaluate(async (n) => {
    const L = await import("/src/games/merge-2048/levels.ts");
    const cfg = L.levelConfig(n - 1);
    return { target: cfg.target, size: cfg.size, blocks: cfg.blocks, stepLimit: cfg.stepLimit, budget: L.stepBudget(cfg) };
  }, index);
}

/** 让页面里的地狱档假人看着这个盘面挑一个方向 */
async function askAi(page, board) {
  return page.evaluate(async (b) => {
    const ai = await import("/src/games/merge-2048/ai.ts");
    return ai.chooseMove(b, "hell", () => Math.random());
  }, board);
}

async function openLevel(page, target) {
  await page.evaluate(
    ([key, n]) => {
      localStorage.setItem(
        key,
        JSON.stringify(Array.from({ length: 188 }, (_, i) => (i < n - 1 ? 3 : 0)))
      );
    },
    [SAVE_KEY, target]
  );
  // 带上时间戳强制整页重载：只改 hash 的话浏览器不会重新挂载
  await page.goto(`${BASE}/?t=${Date.now()}#/game/merge-2048`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".l99-continue", { timeout: 15000 });
  await page.click(".l99-continue");
  await page.waitForSelector(".mg-tile", { timeout: 10000 });
  await sleep(260);
  return page.$eval(".l99-stagetitle", (el) => el.textContent ?? "").catch(() => "");
}

async function wonYet(page) {
  return page.evaluate(() => document.querySelector(".l99-ov-title")?.textContent?.includes("过关") ?? false);
}

async function overflowX(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    const bad = [...document.querySelectorAll("body *")].filter(
      (el) => el.getBoundingClientRect().right > d.clientWidth + 1 && getComputedStyle(el).position !== "fixed"
    );
    return { doc: d.scrollWidth - d.clientWidth, bad: bad.slice(0, 3).map((el) => el.className || el.tagName) };
  });
}

// --- 主流程 ----------------------------------------------------------------

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"]
  });
  const page = await browser.newPage();
  await page.setViewport({ ...VIEWPORT, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  let errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });

  // destroy 泄漏计数器：在任何脚本之前挂上
  await page.evaluateOnNewDocument(() => {
    const w = window;
    w.__leak = { listeners: 0, intervals: 0, frames: 0 };
    const add = w.addEventListener.bind(w);
    const rm = w.removeEventListener.bind(w);
    w.addEventListener = (...a) => {
      w.__leak.listeners++;
      return add(...a);
    };
    w.removeEventListener = (...a) => {
      w.__leak.listeners--;
      return rm(...a);
    };
    const si = w.setInterval.bind(w);
    const ci = w.clearInterval.bind(w);
    w.setInterval = (...a) => {
      w.__leak.intervals++;
      return si(...a);
    };
    w.clearInterval = (...a) => {
      w.__leak.intervals--;
      return ci(...a);
    };
    const raf = w.requestAnimationFrame.bind(w);
    const caf = w.cancelAnimationFrame.bind(w);
    const live = new Set();
    w.requestAnimationFrame = (fn) => {
      const id = raf((t) => {
        live.delete(id);
        fn(t);
      });
      live.add(id);
      w.__leak.frames = live.size;
      return id;
    };
    w.cancelAnimationFrame = (id) => {
      live.delete(id);
      w.__leak.frames = live.size;
      return caf(id);
    };
  });

  await page.goto(BASE, { waitUntil: "networkidle0" });
  await sleep(1200); // 首页自己的动画先跑起来，这才是干净的基线
  const baseLeak = await page.evaluate(() => ({ ...window.__leak }));

  // 1. 首页能看见这张卡（首页靠 import.meta.glob 自动发现 meta.ts）
  const card = await page.evaluate(() =>
    [...document.querySelectorAll("body *")].some((el) => el.textContent?.trim() === "星星合成")
  );
  log(card, "首页自动发现「星星合成」卡片");

  // 2. 逐关真打：读 DOM 上的盘面 → 假人挑方向 → 真按键
  for (const n of LEVELS) {
    errors = [];
    const title = await openLevel(page, n);
    const info = await levelInfo(page, n);
    const rightLevel = new RegExp(`\\b${n}\\b`).test(title ?? "");

    let minFont = Infinity;
    let widest = 0;
    let steps = 0;
    let won = false;
    // 限步关按它自己的上限，其余给步数预算，多留一点余地
    const cap = info.stepLimit > 0 ? info.stepLimit : Math.ceil(info.budget * 1.2);
    while (steps < cap) {
      if (await wonYet(page)) {
        won = true;
        break;
      }
      const read = await readBoard(page);
      if (!read) break;
      minFont = Math.min(minFont, read.minFont);
      widest = Math.max(widest, read.cell * read.size);
      const dir = await askAi(page, read.board);
      if (!dir) break;
      await page.keyboard.press(ARROW[dir]);
      steps++;
    }
    if (!won) won = await wonYet(page);

    const flow = await overflowX(page);
    const ok =
      rightLevel && won && minFont >= 16 && widest <= VIEWPORT.width && flow.doc <= 1 && flow.bad.length === 0 && errors.length === 0;
    log(
      ok,
      `第 ${n} 关（${info.size}×${info.size} · 合到 ${info.target}${info.blocks ? ` · ${info.blocks} 朵花` : ""}）真打到过关`,
      ok
        ? `${steps} 步`
        : `title=${title} won=${won} 用了 ${steps}/${cap} 步 font=${minFont} 盘宽=${widest.toFixed(0)} overflow=${flow.doc} bad=${flow.bad} err=${errors[0] ?? "-"}`
    );
  }

  // 3. 滑行是补出来的：transition-duration 落在 80–140ms
  errors = [];
  await openLevel(page, 1);
  const tween = await page.evaluate(() => {
    const t = document.querySelector(".mg-tile");
    if (!t) return -1;
    const d = getComputedStyle(t).transitionDuration.split(",")[0].trim();
    return d.endsWith("ms") ? parseFloat(d) : parseFloat(d) * 1000;
  });
  log(tween >= 80 && tween <= 140, "滑行 tween 在 80–140ms（不是瞬变）", `${tween}ms`);

  // 4. 键位：方向键、WASD、Esc 暂停后按键不动盘
  const sig = async () => {
    const r = await readBoard(page);
    return r ? JSON.stringify(r.board) : "";
  };
  let moved = false;
  for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
    const before = await sig();
    await page.keyboard.press(key);
    await sleep(240);
    if ((await sig()) !== before) moved = true;
  }
  log(moved, "方向键推得动盘面");

  let wasd = false;
  for (const key of ["KeyA", "KeyW", "KeyD", "KeyS"]) {
    const before = await sig();
    await page.keyboard.press(key);
    await sleep(240);
    if ((await sig()) !== before) wasd = true;
  }
  log(wasd, "WASD 也推得动（朵朵键位）");

  await page.keyboard.press("Escape");
  await sleep(150);
  const pausedMsg = await page.$eval(".mg-msg", (el) => el.textContent ?? "").catch(() => "");
  const beforePause = await sig();
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
    await page.keyboard.press(key);
    await sleep(140);
  }
  const afterPause = await sig();
  await page.keyboard.press("Escape");
  await sleep(150);
  const resumed = await page.$eval(".mg-msg", (el) => el.textContent ?? "").catch(() => "");
  log(/暂停/.test(pausedMsg), "Esc 暂停", pausedMsg);
  log(beforePause === afterPause && beforePause !== "", "暂停时按方向键盘面不动");
  log(!/暂停/.test(resumed), "再按一次 Esc 就接着玩", resumed);
  log(errors.length === 0, "闯关与键位过程无报错", errors[0] ?? "");

  // 5. 手机四向滑屏：真 pointer 事件划一下
  errors = [];
  await openLevel(page, 1);
  const box = await page.$eval(".mg-board", (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  let swiped = false;
  for (const [dx, dy] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) {
    const before = await sig();
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx * 70, cy + dy * 70, { steps: 6 });
    await page.mouse.up();
    await sleep(260);
    if ((await sig()) !== before) swiped = true;
  }
  log(swiped, "手指划屏推得动盘面");
  log(errors.length === 0, "滑屏过程无报错", errors[0] ?? "");

  // 6. 对战 / 无尽 / 双人三个入口都开得起来，盘面真的画出东西
  const pickBtn = async (text) => {
    const h = await page.evaluateHandle(
      (t) => [...document.querySelectorAll(".mg-open")].find((b) => b.textContent?.includes(t)) ?? null,
      text
    );
    const el = h.asElement();
    if (!el) return false;
    await el.click();
    await sleep(320);
    return true;
  };

  for (const [label, picks] of [
    ["对战竞速", ["对战", "合到 128", "地狱"]],
    ["马拉松无尽", ["马拉松", "四乘四马拉松"]],
    ["双人同屏", ["双人同屏"]]
  ]) {
    errors = [];
    await page.goto(`${BASE}/?t=${Date.now()}#/game/merge-2048`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".mg-modebar .mg-open", { timeout: 10000 });
    let opened = true;
    for (const p of picks) opened = (await pickBtn(p)) && opened;
    const drew = await page
      .waitForFunction(() => document.querySelectorAll(".mg-tile").length >= 2, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    const boards = await page.$$eval(".mg-board", (els) => els.length);
    const wantBoards = label === "马拉松无尽" ? 1 : 2;
    const flow = await overflowX(page);
    log(
      opened && drew && boards === wantBoards && flow.doc <= 1 && errors.length === 0,
      `${label} 开得起来且盘面画得出（${wantBoards} 块盘）`,
      `boards=${boards} overflow=${flow.doc} ${errors[0] ?? ""}`
    );
  }

  // 7. destroy：退回首页后监听 / interval / rAF 都还回去
  await page.evaluate(() => {
    location.hash = "";
  });
  await sleep(1200);
  const endLeak = await page.evaluate(() => ({ ...window.__leak }));
  const leaked =
    endLeak.listeners - baseLeak.listeners > 0 ||
    endLeak.intervals - baseLeak.intervals > 0 ||
    endLeak.frames - baseLeak.frames > 0;
  log(!leaked, "退出后没留下监听 / 定时器 / rAF", JSON.stringify({ baseLeak, endLeak }));

  await browser.close();

  const bad = results.filter((r) => !r.ok);
  console.log(`\n共 ${results.length} 项，通过 ${results.length - bad.length} 项。`);
  if (bad.length) {
    console.log("未通过：");
    for (const r of bad) console.log("  - " + r.what);
    process.exit(1);
  }
  console.log("全部通过 ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
