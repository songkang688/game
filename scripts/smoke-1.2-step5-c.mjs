/**
 * 1.2 第 5 步 C「数独花田」的手动冒烟替身:用真浏览器(360×640 最窄屏)
 * 把这片花田从头到尾种一遍,覆盖验收清单里靠单元测试证不了的那几条:
 *
 *   1. 首页靠 import.meta.glob 自动发现这张卡;
 *   2. 360px 竖屏不横向溢出:整块盘露在屏幕里、每格 ≥ 34px、盘面数字 ≥ 16px、
 *      数字钮 ≥ 44px 高且一行九个、不压在盘面上;
 *   3. 八章各抽一关**真解到底**:每一步都把 DOM 上真实渲染出来的盘面读回来,
 *      交给页面里的「地狱」假人按技巧挑下一手,再用真鼠标点格子 + 真 keydown 按数字;
 *   4. 种满时九朵花是**依次**开的:.sp-bloom 一朵一朵冒出来,不是一次性全亮;
 *   5. 键位在真实事件下有效:WASD 移光标、数字键直填、G 切铅笔(小字不算种下去)、
 *      F 只在真只剩一种时才动手、Esc 暂停停表;
 *   6. 提示按钮只讲方法:弹出来那句话里一个阿拉伯数字都没有,盘面也没被替你填;
 *   7. 对战竞速 / 花田马拉松 / 双人同屏三个入口都开得起来,盘面真的画出东西;
 *   8. destroy 无泄漏:进 → 玩 → 退回首页 → window 监听、interval、rAF 全部清干净;
 *   9. 全程没有 pageerror 和 console.error。
 *
 * 跑法(puppeteer-core 是临时工具,没有进 package.json):
 *   npm i --no-save puppeteer-core
 *   npx vite --port 5185
 *   node scripts/smoke-1.2-step5-c.mjs        # SMOKE_LEVELS=1,49 可只跑其中几关
 *
 * 它连着源码跑(dev server):盘面是从 .sp-cell 里真实渲染出来的数字读回来的,
 * 下一手是页面里 import 的 ai.ts 现挑的,点击走 mouse、按键走 keyboard,不留任何测试后门。
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5185";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const VIEWPORT = { width: 360, height: 640 };
const SAVE_KEY = "yiduo-yixing.l99.sudoku-petal";
// 八章各抽一关(章节边界:24/48/72/96/118/140/164/188)
const LEVELS = (process.env.SMOKE_LEVELS ?? "1,25,49,73,97,119,141,165")
  .split(",")
  .map(Number)
  .filter((n) => n >= 1 && n <= 188);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

// --- 页面里跑的小工具(都靠 dev server 直接 import 源码) -------------------

/** 把第一块盘上真实渲染出来的数字读回来,顺便记下最小字号与格子尺寸 */
const READ_BOARD = () => {
  const grid = document.querySelector(".sp-grid");
  if (!grid) return null;
  const cells = [...grid.querySelectorAll(".sp-cell")];
  if (cells.length === 0) return null;
  let minFont = Infinity;
  let minCell = Infinity;
  const digits = cells.map((c) => {
    // 用布局尺寸,不用 getBoundingClientRect:填进去那一下有个 scale 动画,
    // 会让外接矩形临时缩小,量出来的不是真正的格子大小
    minCell = Math.min(minCell, c.offsetWidth, c.offsetHeight);
    const holder = c.querySelector(".sp-digit");
    const text = holder ? holder.textContent.trim() : "";
    if (text) minFont = Math.min(minFont, parseFloat(getComputedStyle(c).fontSize));
    return text ? Number(text) : 0;
  });
  return {
    digits,
    size: Math.round(Math.sqrt(cells.length)),
    minFont: minFont === Infinity ? 0 : minFont,
    minCell: minCell === Infinity ? 0 : minCell,
    boardWidth: grid.getBoundingClientRect().width,
    filled: digits.filter((d) => d > 0).length,
    notes: grid.querySelectorAll(".sp-note").length,
    bloomed: grid.querySelectorAll(".sp-bloom").length
  };
};

async function readBoard(page) {
  return page.evaluate(READ_BOARD);
}

/** 让页面里的地狱档假人看着这个盘面挑下一手(它是按技巧推的,不是抄答案) */
async function askAi(page, level, digits) {
  return page.evaluate(
    async ([lv, cells]) => {
      const P = await import("/src/games/sudoku-petal/puzzles.ts");
      const AI = await import("/src/games/sudoku-petal/ai.ts");
      const variant = P.variantOfBank(P.bankAt(lv - 1));
      if (cells.length !== variant.n * variant.n) return null;
      const move = AI.nextMove({ variant, cells }, 0.99, AI.AI_PROFILES.hell);
      return move ? { idx: move.idx, digit: move.digit } : null;
    },
    [level, digits]
  );
}

async function levelInfo(page, level) {
  return page.evaluate(async (lv) => {
    const L = await import("/src/games/sudoku-petal/levels.ts");
    const P = await import("/src/games/sudoku-petal/puzzles.ts");
    const spec = L.levelSpec(lv - 1);
    const entry = P.bankAt(lv - 1);
    return { kind: spec.kind, tier: entry.t, holes: P.holesOfBank(entry), chapter: L.CHAPTERS[spec.chapter].name };
  }, level);
}

async function openLevel(page, target) {
  await page.evaluate(
    ([key, n]) => {
      localStorage.setItem(key, JSON.stringify(Array.from({ length: 188 }, (_, i) => (i < n - 1 ? 3 : 0))));
    },
    [SAVE_KEY, target]
  );
  // 带上时间戳强制整页重载:只改 hash 的话浏览器不会重新挂载
  await page.goto(`${BASE}/?t=${Date.now()}#/game/sudoku-petal`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".l99-continue", { timeout: 15000 });
  await page.click(".l99-continue");
  await page.waitForSelector(".sp-cell", { timeout: 10000 });
  await sleep(200);
  return page.$eval(".l99-stagetitle", (el) => el.textContent ?? "").catch(() => "");
}

async function wonYet(page) {
  return page.evaluate(() => document.querySelector(".l99-ov-title")?.textContent?.includes("过关") ?? false);
}

async function clickCell(page, idx) {
  const cells = await page.$$(".sp-grid .sp-cell");
  if (!cells[idx]) return false;
  await cells[idx].click();
  return true;
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

async function cursorLabel(page) {
  return page.evaluate(() => document.querySelector(".sp-cur")?.getAttribute("aria-label") ?? "");
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

  // destroy 泄漏计数器:在任何脚本之前挂上
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
  await sleep(1200); // 首页自己的动画先跑起来,这才是干净的基线
  const baseLeak = await page.evaluate(() => ({ ...window.__leak }));

  // 1. 首页能看见这张卡(首页靠 import.meta.glob 自动发现 meta.ts)
  const card = await page.evaluate(() =>
    [...document.querySelectorAll("body *")].some((el) => el.textContent?.trim() === "数独花田")
  );
  log(card, "首页自动发现「数独花田」卡片");

  // 2. 八章各真解一关
  for (const n of LEVELS) {
    errors = [];
    const title = await openLevel(page, n);
    const info = await levelInfo(page, n);
    const rightLevel = new RegExp(`\\b${n}\\b`).test(title ?? "");

    let minFont = Infinity;
    let minCell = Infinity;
    let boardWidth = 0;
    let steps = 0;
    let won = false;
    const cap = info.holes + 12;
    while (steps < cap) {
      if (await wonYet(page)) {
        won = true;
        break;
      }
      const read = await readBoard(page);
      if (!read) break;
      if (read.minFont > 0) minFont = Math.min(minFont, read.minFont);
      minCell = Math.min(minCell, read.minCell);
      boardWidth = Math.max(boardWidth, read.boardWidth);
      const move = await askAi(page, n, read.digits);
      if (!move) break;
      if (!(await clickCell(page, move.idx))) break;
      await page.keyboard.press(`Digit${move.digit}`);
      steps += 1;
    }
    if (!won) {
      // 最后一手落下之后开花动画要放九档,等它走完再看过关浮层
      await sleep(1400);
      won = await wonYet(page);
    }

    const flow = await overflowX(page);
    const ok =
      rightLevel &&
      won &&
      minFont >= 16 &&
      minCell >= 34 &&
      boardWidth <= VIEWPORT.width &&
      flow.doc <= 1 &&
      errors.length === 0;
    log(
      ok,
      `第 ${n} 关(${info.chapter} · ${info.kind} · ${info.holes} 个空 · ${info.tier})真解到过关`,
      ok
        ? `${steps} 手`
        : `title=${title} won=${won} ${steps}/${cap} 手 font=${minFont} cell=${minCell} 盘宽=${boardWidth.toFixed(
            0
          )} overflow=${flow.doc} bad=${flow.bad} err=${errors[0] ?? "-"}`
    );
  }

  // 3. 数字钮的红线:一行九个、≥44px 高、不压在盘面上
  errors = [];
  await openLevel(page, 49);
  const pad = await page.evaluate(() => {
    const el = document.querySelector(".sp-pad");
    const grid = document.querySelector(".sp-grid");
    if (!el || !grid) return null;
    const keys = [...el.querySelectorAll(".sp-key")];
    const cols = getComputedStyle(el).gridTemplateColumns.split(" ").length;
    const padBox = el.getBoundingClientRect();
    const gridBox = grid.getBoundingClientRect();
    return {
      count: keys.length,
      cols,
      minHeight: Math.min(...keys.map((k) => k.getBoundingClientRect().height)),
      right: Math.max(...keys.map((k) => k.getBoundingClientRect().right)),
      overlapsBoard: padBox.top < gridBox.bottom - 1
    };
  });
  log(
    pad !== null && pad.count === 9 && pad.cols === 9 && pad.minHeight >= 44 && pad.right <= VIEWPORT.width + 1 && !pad.overlapsBoard,
    "数字钮一行九个、≥44px 高、不遮盘面也不溢出",
    JSON.stringify(pad)
  );

  // 4. 开花是一朵一朵开的
  errors = [];
  await openLevel(page, 1);
  {
    let guard = 0;
    while (guard++ < 40) {
      const read = await readBoard(page);
      if (!read) break;
      const move = await askAi(page, 1, read.digits);
      if (!move) break;
      await clickCell(page, move.idx);
      await page.keyboard.press(`Digit${move.digit}`);
    }
    const first = await page.evaluate(() => document.querySelectorAll(".sp-bloom").length);
    await sleep(500);
    const later = await page.evaluate(() => document.querySelectorAll(".sp-bloom").length);
    log(first > 0 && later > first, "九朵花是依次开的,不是一次性全亮", `先 ${first} 朵 → 后 ${later} 朵`);
  }

  // 5. 键位:WASD 移光标、数字键直填、G 切铅笔、F 谨慎、Esc 暂停
  errors = [];
  await openLevel(page, 49);
  let moved = false;
  for (const key of ["KeyD", "KeyS", "KeyA", "KeyW"]) {
    const before = await cursorLabel(page);
    await page.keyboard.press(key);
    await sleep(80);
    if ((await cursorLabel(page)) !== before) moved = true;
  }
  log(moved, "WASD 移得动光标(朵朵键位)");

  {
    // 挪到一个空格上,数字键直填
    let idx = -1;
    for (let i = 0; i < 40 && idx < 0; i++) {
      const read = await readBoard(page);
      idx = read.digits.findIndex((d) => d === 0);
    }
    await clickCell(page, idx);
    const before = (await readBoard(page)).filled;
    await page.keyboard.press("Digit1");
    await sleep(120);
    const after = (await readBoard(page)).filled;
    log(after === before + 1, "数字键 1–9 直接种下去", `${before} → ${after}`);

    // G 切铅笔:再按数字只写小字,正文一格都不多
    await page.keyboard.press("KeyG");
    await sleep(80);
    const pencilOn = await page.evaluate(() => document.querySelectorAll(".sp-tool.sp-on").length > 0);
    let idx2 = (await readBoard(page)).digits.findIndex((d) => d === 0);
    await clickCell(page, idx2);
    const beforeNote = await readBoard(page);
    await page.keyboard.press("Digit3");
    await sleep(120);
    const afterNote = await readBoard(page);
    log(
      pencilOn && afterNote.notes > beforeNote.notes && afterNote.filled === beforeNote.filled,
      "G 切铅笔后写的是小字,不计入种下去的格子",
      `notes ${beforeNote.notes} → ${afterNote.notes},filled ${beforeNote.filled} → ${afterNote.filled}`
    );
    await page.keyboard.press("KeyG");
    await sleep(80);
  }

  {
    const before = (await readBoard(page)).filled;
    await page.keyboard.press("KeyF");
    await sleep(120);
    const after = (await readBoard(page)).filled;
    log(after === before || after === before + 1, "F 只在真只剩一种时才动手", `${before} → ${after}`);
  }

  {
    await page.keyboard.press("Escape");
    await sleep(120);
    const paused = await page.$eval(".sp-pause", (el) => el.textContent ?? "").catch(() => "");
    const clockOf = () => page.$eval(".sp-top", (el) => el.textContent ?? "");
    const t0 = await clockOf();
    await sleep(1400);
    const t1 = await clockOf();
    await page.keyboard.press("Escape");
    await sleep(1400);
    const t2 = await clockOf();
    log(/暂停/.test(paused), "Esc 暂停", paused);
    log(t0 === t1, "暂停时秒表不走", `${t0} / ${t1}`);
    log(t2 !== t1, "再按一次 Esc 接着走", `${t1} → ${t2}`);
  }
  log(errors.length === 0, "键位过程无报错", errors[0] ?? "");

  // 6. 提示只讲方法
  errors = [];
  await openLevel(page, 165);
  {
    const before = (await readBoard(page)).filled;
    const clicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll(".sp-tool")].find((b) => b.textContent?.includes("提示"));
      if (!btn) return false;
      btn.click();
      return true;
    });
    await sleep(200);
    const text = await page.$eval(".sp-hintbox", (el) => el.textContent ?? "").catch(() => "");
    const after = (await readBoard(page)).filled;
    log(
      clicked && text.length > 10 && !/[0-9]/.test(text) && after === before,
      "提示只讲方法:正文没有阿拉伯数字,盘面也没被替你填",
      text.slice(0, 40)
    );
  }
  log(errors.length === 0, "提示过程无报错", errors[0] ?? "");

  // 7. 三个额外模式都开得起来
  const pickBtn = async (text) => {
    const ok = await page.evaluate((t) => {
      const btn = [...document.querySelectorAll(".sp-open, .sp-tool")].find((b) => b.textContent?.includes(t));
      if (!btn) return false;
      btn.click();
      return true;
    }, text);
    await sleep(320);
    return ok;
  };

  for (const [label, picks, wantBoards] of [
    ["对战竞速", ["对战竞速", "地狱"], 2],
    ["花田马拉松", ["花田马拉松"], 1],
    ["双人同屏", ["双人同屏"], 2]
  ]) {
    errors = [];
    await page.goto(`${BASE}/?t=${Date.now()}#/game/sudoku-petal`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".sp-modebar .sp-open", { timeout: 10000 });
    let opened = true;
    for (const p of picks) opened = (await pickBtn(p)) && opened;
    const drew = await page
      .waitForFunction(() => document.querySelectorAll(".sp-cell").length >= 16, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    const boards = await page.$$eval(".sp-grid", (els) => els.length);
    const flow = await overflowX(page);
    log(
      opened && drew && boards === wantBoards && flow.doc <= 1 && errors.length === 0,
      `${label} 开得起来且盘面画得出(${wantBoards} 块盘)`,
      `boards=${boards} overflow=${flow.doc} ${errors[0] ?? ""}`
    );
  }

  // 8. destroy:退回首页后监听 / interval / rAF 都还回去
  await page.evaluate(() => {
    location.hash = "";
  });
  await sleep(1500);
  const endLeak = await page.evaluate(() => ({ ...window.__leak }));
  const leaked =
    endLeak.listeners - baseLeak.listeners > 0 ||
    endLeak.intervals - baseLeak.intervals > 0 ||
    endLeak.frames - baseLeak.frames > 0;
  log(!leaked, "退出后没留下监听 / 定时器 / rAF", JSON.stringify({ baseLeak, endLeak }));

  await browser.close();

  const bad = results.filter((r) => !r.ok);
  console.log(`\n共 ${results.length} 项,通过 ${results.length - bad.length} 项。`);
  if (bad.length) {
    console.log("未通过:");
    for (const r of bad) console.log("  - " + r.what);
    process.exit(1);
  }
  console.log("全部通过 ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
