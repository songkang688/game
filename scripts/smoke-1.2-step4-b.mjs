/**
 * 1.2 第 4 步 B「围子花园」的手动冒烟替身：用真浏览器（360×640 最窄屏）
 * 把这盘棋从头到尾摸一遍，覆盖验收清单里靠单元测试证不了的几条：
 *
 *   1. 360px 竖屏不横向溢出，九路棋盘整块露在屏幕里、每个交叉点都点得到（热区 ≥ 28px）；
 *   2. 抽查 8 个章节各一关，用真鼠标点在交叉点上把题解出来，等「过关」浮层真的弹出来；
 *   3. 键位在真实 keydown 下有效：方向键移光标、F 确认落子、G 停一手、Esc 暂停并挡住落子；
 *   4. 自由对战选九路 + 地狱档，连下三手，每手 AI 的回应都在 1 秒内落地；
 *   5. 连胜无尽 / 双人同屏两个入口都开得起来，棋盘真的画出东西（canvas 不是白板）；
 *   6. destroy 无泄漏：进 → 玩 → 退回首页 → window 监听、interval、rAF 全部清干净；
 *   7. 全程没有 pageerror 和 console.error。
 *
 * 跑法（puppeteer-core 是临时工具，没有进 package.json）：
 *   npm i --no-save puppeteer-core
 *   npx vite --port 5182
 *   node scripts/smoke-1.2-step4-b.mjs        # SMOKE_LEVELS=1,24 可只跑其中几关
 *
 * 它连着源码跑（dev server）：先 import 一遍 levels.ts 把这一关的解算出来，
 * 再换算成画布坐标用真鼠标点下去，不走任何测试后门。
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5182";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const VIEWPORT = { width: 360, height: 640 };
const SAVE_KEY = "yiduo-yixing.l99.weiqi-garden";
// 8 章各抽一关（章节边界：24/48/72/96/118/140/164/188）
const LEVELS = (process.env.SMOKE_LEVELS ?? "1,25,49,73,97,119,141,188")
  .split(",")
  .map(Number)
  .filter((n) => n >= 1 && n <= 188);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

// --- 页面里跑的小工具（都靠 dev server 直接 import 源码） -------------------

/** 这一关要点哪几个交叉点：多数题型一手解决，数气/标死子要点一串 */
async function planClicks(page, index) {
  return page.evaluate(async (n) => {
    const L = await import("/src/games/weiqi-garden/levels.ts");
    const life = await import("/src/games/weiqi-garden/life.ts");
    const score = await import("/src/games/weiqi-garden/score.ts");
    const level = L.levelAt(n - 1);
    const board = L.cloneLevelBoard(level);
    let clicks;
    if (level.kind === "markDead") {
      const seen = new Set();
      clicks = [];
      for (const p of life.autoDeadStones(board)) {
        if (seen.has(p)) continue;
        for (const q of life.expandDead(board, [p])) seen.add(q);
        clicks.push(p);
      }
    } else if (level.kind === "dame") {
      clicks = score.damePoints(board);
    } else {
      clicks = L.levelSolutions(level).slice(0, 1);
    }
    return { size: level.size, kind: level.kind, clicks };
  }, index);
}

/** 交叉点 → 画布上的视口坐标。extent = cell*(size+0.4)，pad = 0.7*cell */
async function pointXY(page, size, pt) {
  return page.evaluate(
    ([s, p]) => {
      const c = document.querySelector(".wq-canvas");
      if (!c) return null;
      const r = c.getBoundingClientRect();
      const cell = r.width / (s + 0.4);
      const pad = cell * 0.7;
      return {
        x: r.x + pad + (p % s) * cell,
        y: r.y + pad + Math.floor(p / s) * cell,
        cell,
        width: r.width
      };
    },
    [size, pt]
  );
}

async function clickPoint(page, size, pt) {
  // 画布比窄屏宽时外层 .wq-scroll 横向滚，画布比屏幕高时整页纵向滚，两边都先摆正
  await page.evaluate(
    ([s, p, vh]) => {
      const c = document.querySelector(".wq-canvas");
      const box = c?.closest(".wq-scroll");
      if (!c) return;
      const cell = c.getBoundingClientRect().width / (s + 0.4);
      const pad = cell * 0.7;
      if (box && box.scrollWidth > box.clientWidth) {
        box.scrollLeft = pad + (p % s) * cell - box.clientWidth / 2;
      }
      // 纵向:整页并不滚 —— html / body 正好一屏,`window.scrollTo` 是空操作。
      // 真正在滚、并且把棋盘下半截裁掉的是外壳 .game-stage,它的下边缘(624)
      // 还比视口(640)高一截。所以判据得按这个容器的可视框来,不能按视口:
      // 九路第 5 行落在 y=624,坐标看着「在屏内」,`elementFromPoint` 却已经是容器本身,
      // 第 6 行更是直接出屏。原先按视口判,这两行一手都点不下去,报成「won=false」。
      let sc = c.parentElement;
      while (sc && sc.scrollHeight <= sc.clientHeight + 2) sc = sc.parentElement;
      const view = sc ? sc.getBoundingClientRect() : { top: 0, bottom: vh };
      const top = Math.max(view.top, 0) + cell * 0.6;
      const bot = Math.min(view.bottom, vh) - cell * 0.6;
      const wantY = c.getBoundingClientRect().top + pad + Math.floor(p / s) * cell;
      if (wantY < top || wantY > bot) {
        const delta = wantY - (top + bot) / 2;
        if (sc) sc.scrollTop += delta;
        else window.scrollBy(0, delta);
      }
    },
    [size, pt, VIEWPORT.height]
  );
  await sleep(80);
  const now = await pointXY(page, size, pt);
  if (!now) return false;
  // 摆正之后再确认一次这个坐标上最顶的确实是棋盘:光看「在不在视口里」不够,
  // 被滚动容器裁掉的那一条坐标合法、命中的却是容器。
  const onCanvas = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.classList.contains("wq-canvas") ?? false,
    [now.x, now.y]
  );
  if (!onCanvas) return false;
  await page.mouse.click(now.x, now.y);
  return true;
}

/** 页面上所有 .wq-hud 拼起来的文本（第一个 hud 是模式标题栏，第二个才是棋局信息） */
async function hudText(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".wq-hud,.wq-msg,.wq-chip")].map((el) => el.textContent ?? "").join(" | ")
  );
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
  await page.goto(`${BASE}/?t=${Date.now()}#/game/weiqi-garden`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".l99-continue", { timeout: 15000 });
  await page.click(".l99-continue");
  await page.waitForSelector(".wq-canvas", { timeout: 10000 });
  await sleep(260);
  const title = await page.$eval(".l99-stagetitle", (el) => el.textContent ?? "").catch(() => "");
  return title;
}

async function overflowX(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    const wide = [...document.querySelectorAll("body *")].filter(
      (el) => el.getBoundingClientRect().right > d.clientWidth + 1 && getComputedStyle(el).position !== "fixed"
    );
    // .wq-canvas 允许比屏幕宽（外层 .wq-scroll 负责横向滚动），别的都不许探头
    const bad = wide.filter((el) => !el.classList.contains("wq-canvas") && !el.closest(".wq-scroll"));
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
    [...document.querySelectorAll("body *")].some((el) => el.textContent?.trim() === "围子花园")
  );
  log(card, "首页自动发现「围子花园」卡片");

  // 2. 逐关真解
  for (const n of LEVELS) {
    errors = [];
    const title = await openLevel(page, n);
    const plan = await planClicks(page, n).catch((e) => ({ error: String(e) }));
    if (plan.error || !plan.clicks?.length) {
      log(false, `第 ${n} 关`, plan.error ?? "算不出解");
      continue;
    }
    const rightLevel = new RegExp(`\\b${n}\\b`).test(title ?? "");

    // 热区检查：九路每个交叉点不小于 28px，十三 / 十九路不小于 22px
    const at = await pointXY(page, plan.size, 0);
    const wantHit = plan.size <= 9 ? 28 : 22;
    const hitOk = !!at && at.cell >= wantHit - 0.01;

    for (const pt of plan.clicks) {
      const done = await clickPoint(page, plan.size, pt);
      if (!done) break;
      await sleep(220);
    }
    await sleep(700);
    const won = await page.evaluate(
      () => document.querySelector(".l99-ov-title")?.textContent?.includes("过关") ?? false
    );
    const flow = await overflowX(page);
    const ok = rightLevel && hitOk && won && flow.doc <= 1 && flow.bad.length === 0 && errors.length === 0;
    log(
      ok,
      `第 ${n} 关（${plan.size} 路 · ${plan.kind}）真解到过关`,
      ok
        ? ""
        : `title=${title} hit=${at?.cell?.toFixed(1)}/${wantHit} won=${won} overflow=${flow.doc} bad=${flow.bad} err=${errors[0] ?? "-"}`
    );
  }

  // 3. 键位：方向键 + F 落子，G 停一手，Esc 暂停后点不动
  errors = [];
  await openLevel(page, 1);
  await page.focus(".wq-canvas");
  const before = await page.$eval(".wq-msg", (el) => el.textContent ?? "");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("KeyF");
  await sleep(300);
  const afterF = await page.$eval(".wq-msg", (el) => el.textContent ?? "");
  await page.keyboard.press("KeyG");
  await sleep(200);
  const afterG = await page.$eval(".wq-msg", (el) => el.textContent ?? "");
  await page.keyboard.press("Escape");
  await sleep(200);
  // 暂停的标志：按钮变成「继续」，提示行换成歇一会儿的话
  const pausedUi = await page.evaluate(() => ({
    btn: [...document.querySelectorAll(".wq-btn")].some((b) => /继续/.test(b.textContent ?? "")),
    msg: document.querySelector(".wq-msg")?.textContent ?? ""
  }));
  // 暂停时点棋盘应该点不动
  const beforeIdle = await page.$eval(".wq-hud", (el) => el.textContent ?? "");
  await clickPoint(page, 9, 40);
  await sleep(200);
  const afterIdle = await page.$eval(".wq-hud", (el) => el.textContent ?? "");
  await page.keyboard.press("Escape");
  await sleep(150);
  const resumed = await page.evaluate(() =>
    [...document.querySelectorAll(".wq-btn")].some((b) => /暂停/.test(b.textContent ?? ""))
  );
  log(afterF !== before, "F 键真的落了一手（提示行变了）", `${before} → ${afterF}`);
  log(/停/.test(afterG), "G 键停一手", afterG);
  log(pausedUi.btn && /歇|回来/.test(pausedUi.msg), "Esc 暂停", `${pausedUi.msg}`);
  log(beforeIdle === afterIdle, "暂停时点棋盘落不了子", `${beforeIdle} → ${afterIdle}`);
  log(resumed, "再按一次 Esc 就接着下");
  log(errors.length === 0, "闯关键位过程无报错", errors[0] ?? "");

  // 4. 自由对战：九路 + 地狱档，AI 每手 ≤ 1s
  errors = [];
  await page.goto(`${BASE}/?t=${Date.now()}#/game/weiqi-garden`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".wq-modebar .wq-open", { timeout: 10000 });
  const openMode = async (label) => {
    const btn = await page.evaluateHandle(
      (t) => [...document.querySelectorAll(".wq-modebar .wq-open")].find((b) => b.textContent?.includes(t)) ?? null,
      label
    );
    const el = btn.asElement();
    if (!el) return false;
    await el.click();
    await sleep(400);
    return true;
  };
  const pickBtn = async (text) => {
    const h = await page.evaluateHandle(
      (t) => [...document.querySelectorAll(".wq-btn,.wq-open")].find((b) => b.textContent?.includes(t)) ?? null,
      text
    );
    const el = h.asElement();
    if (!el) return false;
    await el.click();
    await sleep(250);
    return true;
  };

  await openMode("自由对战");
  await pickBtn("九路花园");
  await pickBtn("地狱");
  await pickBtn("开始");
  await page.waitForSelector(".wq-canvas", { timeout: 10000 });
  await sleep(300);

  const movesPlayed = () =>
    page.evaluate(() => {
      const txt = [...document.querySelectorAll(".wq-hud")].map((el) => el.textContent ?? "").join(" ");
      const m = /第 (\d+) 手/.exec(txt);
      return m ? Number(m[1]) : -1;
    });

  // 别写死交叉点：地狱档 AI 最爱下的就是星位，写死 (2,2)/(6,6)/(2,6) 的话
  // 第二三手多半落在它刚占掉的点上，落子被规则拒了，等回应就只能等到超时。
  // （定 seed 复现见 src/games/__tests__/window1-smoke-seeds.test.ts：
  //   120 个 seed 里超过两成第二三手被占；改成临下之前挑空点，120/120 全走得通。）
  // 这里照样只用真鼠标点画布，不走后门：点下去手数没动就换下一个点。
  const CANDIDATES = [];
  for (const gy of [2, 6, 4, 3, 5, 1, 7]) for (const gx of [2, 6, 4, 3, 5, 1, 7]) CANDIDATES.push([gx, gy]);

  let slowest = 0;
  let played = await movesPlayed();
  const started = played;
  let landed = 0;
  let tried = 0;
  for (const [gx, gy] of CANDIDATES) {
    if (landed >= 3) break;
    tried++;
    const before = played;
    const t0 = Date.now();
    if (!(await clickPoint(page, 9, gy * 9 + gx))) continue;
    // 先看自己这一手落没落地：没落地说明那个点有子了，换一个点，不算 AI 没回应
    const mine = await page
      .waitForFunction(
        (n) => {
          const txt = [...document.querySelectorAll(".wq-hud")].map((el) => el.textContent ?? "").join(" ");
          const m = /第 (\d+) 手/.exec(txt);
          return m ? Number(m[1]) >= n : false;
        },
        { timeout: 900 },
        before + 1
      )
      .then(() => true)
      .catch(() => false);
    if (!mine) continue;
    // 自己落地了，才开始量星星（AI）多久回一手
    const replied = await page
      .waitForFunction(
        (n) => {
          const txt = [...document.querySelectorAll(".wq-hud")].map((el) => el.textContent ?? "").join(" ");
          const m = /第 (\d+) 手/.exec(txt);
          return m ? Number(m[1]) >= n : false;
        },
        { timeout: 4000 },
        before + 2
      )
      .then(() => true)
      .catch(() => false);
    if (!replied) break;
    landed++;
    slowest = Math.max(slowest, Date.now() - t0);
    played = await movesPlayed();
    await sleep(120);
  }
  log(
    landed >= 3 && played >= started + 6,
    "地狱档自由对战连下三手都有回应",
    `落地 ${landed} 手（试了 ${tried} 个点）· 已走 ${played} 手（开局 ${started}）`
  );
  log(slowest > 0 && slowest <= 1200, "AI 单手用时 ≤ 1s（含点击与重绘）", `最慢 ${slowest}ms`);
  const vsFlow = await overflowX(page);
  log(vsFlow.doc <= 1 && vsFlow.bad.length === 0, "自由对战 360px 不溢出", `${vsFlow.doc} ${vsFlow.bad}`);
  log(errors.length === 0, "自由对战无报错", errors[0] ?? "");

  // 5. 连胜无尽 / 双人同屏都开得起来，画布不是白板
  for (const label of ["连胜无尽", "双人同屏"]) {
    errors = [];
    await page.goto(`${BASE}/?t=${Date.now()}#/game/weiqi-garden`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".wq-modebar .wq-open", { timeout: 10000 });
    await openMode(label);
    await pickBtn("开始");
    // 棋盘不是白板：整块画布里得有一半以上的行出现过跟背景不同的像素（网格线）
    const drew = await page
      .waitForFunction(
        () => {
          const c = document.querySelector(".wq-canvas");
          if (!c || !c.width) return false;
          const g = c.getContext("2d");
          const d = g.getImageData(0, 0, c.width, c.height).data;
          let diff = 0;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) diff++;
          }
          return diff > c.width;
        },
        { timeout: 8000 }
      )
      .then(() => true)
      .catch(() => false);
    const flow = await overflowX(page);
    log(drew && flow.doc <= 1 && errors.length === 0, `${label} 开得起来且棋盘画得出`, `overflow=${flow.doc} ${errors[0] ?? ""}`);
  }

  // 6. destroy：退回首页后监听 / interval / rAF 都还回去
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
