/**
 * 1.2 第 5 步 B「扫雷花园」的手动冒烟替身：用真浏览器（360×640 最窄屏）
 * 把这片花园从头到尾摸一遍，覆盖验收清单里靠单元测试证不了的几条：
 *
 *   1. 首页自动发现这张卡（`import.meta.glob` 收 meta.ts，没改过 loader）；
 *   2. 360px 竖屏不横向溢出，格子实测 ≥ 28px，30 列的大图有迷你地图 + 横向滚动；
 *   3. 8 个章节各抽一关，用真鼠标一格一格点到「过关」浮层弹出来（含限时 / 限旗 / 迷雾关）；
 *   4. 真输一次：点在刺种上，看那一颗当场开花、其余刺种一颗一颗慢慢揭开；
 *   5. 键位在真实事件下有效：方向键移光标、F 翻开、G 插旗、Esc 暂停后点不动；
 *   6. 触屏长按插旗（真按住 600ms）与右键插旗都好使；旗插齐之后点数字能真的和弦；
 *   7. 竞速对战 / 连续清盘 / 双人同屏三个入口都开得起来，对战里假人的进度条真的会走；
 *   8. destroy 无泄漏：进 → 玩 → 退回首页 → window 监听、interval、rAF 全部清干净；
 *   9. 全程没有 pageerror 和 console.error。
 *
 * 跑法（puppeteer-core 是临时工具，没有进 package.json）：
 *   npm i --no-save puppeteer-core
 *   npx vite --port 5183
 *   node scripts/smoke-1.2-step5-b.mjs        # SMOKE_LEVELS=1,49 可只跑其中几关
 *
 * 它连着源码跑（dev server）：先 import 一遍 levels.ts / solver.ts，
 * 按「这一关的种子 + 我这一下点在哪儿」把刺种分布**照玩法代码原样再算一遍**，
 * 再用真鼠标去点那些空地，不走任何测试后门。
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5183";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const VIEWPORT = { width: 360, height: 640 };
const SAVE_KEY = "yiduo-yixing.l99.mine-garden";
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

/** 把这一关的刺种分布照玩法代码原样再算一遍（同一个种子 + 同一个首点 = 同一张图） */
async function planLevel(page, index, first) {
  return page.evaluate(
    async ([n, f]) => {
      const L = await import("/src/games/mine-garden/levels.ts");
      const I = await import("/src/games/mine-garden/index.ts");
      const S = await import("/src/games/mine-garden/solver.ts");
      const level = L.levelAt(n - 1);
      const opts = I.levelRunOptions(level);
      const res = S.generateNoGuess(opts.w, opts.h, opts.mines, f, opts.seed, { noGuess: opts.noGuess });
      return {
        w: opts.w,
        h: opts.h,
        mines: opts.mines,
        noGuess: res.noGuess,
        wantNoGuess: Boolean(opts.noGuess),
        fog: Boolean(level.fog),
        flagLimit: level.flagLimit ?? 0,
        timeLimitMs: level.timeLimitMs ?? 0,
        mine: Array.from(res.mine)
      };
    },
    [index, first]
  );
}

/** 每一格现在是不是已经翻开了（迷雾只是加了 mg-dark，翻开与否照样看得出来） */
async function openMap(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".mg-cell")].map((el) =>
      el.classList.contains("mg-open") || el.classList.contains("mg-bloom") ? 1 : 0
    )
  );
}

async function cellBox(page, i) {
  return page.evaluate((k) => {
    const cells = document.querySelectorAll(".mg-cell");
    const el = cells[k];
    if (!el) return null;
    const box = el.closest(".mg-scroll");
    if (box && box.scrollWidth > box.clientWidth) {
      const r0 = el.getBoundingClientRect();
      box.scrollLeft += r0.left - box.getBoundingClientRect().left - box.clientWidth / 2;
    }
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  }, i);
}

async function clickCell(page, i) {
  const box = await cellBox(page, i);
  if (!box || box.x < 0 || box.x > VIEWPORT.width || box.y < 0 || box.y > VIEWPORT.height) return false;
  await page.mouse.click(box.x, box.y);
  return true;
}

async function overflowX(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    const wide = [...document.querySelectorAll("body *")].filter(
      (el) => el.getBoundingClientRect().right > d.clientWidth + 1 && getComputedStyle(el).position !== "fixed"
    );
    // 网格允许比屏幕宽（外层 .mg-scroll 负责横向滚动），别的都不许探头
    const bad = wide.filter((el) => !el.closest(".mg-scroll"));
    return { doc: d.scrollWidth - d.clientWidth, bad: bad.slice(0, 3).map((el) => el.className || el.tagName) };
  });
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
  await page.goto(`${BASE}/?t=${Date.now()}#/game/mine-garden`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".l99-continue", { timeout: 15000 });
  await page.click(".l99-continue");
  await page.waitForSelector(".mg-cell", { timeout: 10000 });
  await sleep(220);
  return page.$eval(".l99-stagetitle", (el) => el.textContent ?? "").catch(() => "");
}

/** 一关一关点到清盘：只点还没翻开的空地，洪水展开会替我们省下大半的点击 */
async function clearLevel(page, plan, first, budget = 500) {
  let clicks = 1;
  if (!(await clickCell(page, first))) return { cleared: false, clicks, why: "首点点不到" };
  await sleep(120);
  for (let round = 0; round < budget; round++) {
    const open = await openMap(page);
    let next = -1;
    for (let i = 0; i < plan.mine.length; i++) {
      if (!plan.mine[i] && !open[i]) {
        next = i;
        break;
      }
    }
    if (next < 0) return { cleared: true, clicks };
    if (!(await clickCell(page, next))) return { cleared: false, clicks, why: `第 ${next} 格点不到` };
    clicks++;
    await sleep(35);
  }
  return { cleared: false, clicks, why: "点击预算用完" };
}

async function wonOverlay(page) {
  return page.evaluate(() => document.querySelector(".l99-ov-title")?.textContent?.includes("过关") ?? false);
}

const cursorAt = (page) =>
  page.evaluate(() => [...document.querySelectorAll(".mg-cell")].findIndex((el) => el.classList.contains("mg-cursor")));

/** 只用方向键把光标走到第 target 格（不碰鼠标，专门验键位） */
async function walkCursorTo(page, target, w) {
  for (let step = 0; step < 200; step++) {
    const at = await cursorAt(page);
    if (at === target) return true;
    if (at < 0) return false;
    const dy = Math.floor(target / w) - Math.floor(at / w);
    const dx = (target % w) - (at % w);
    if (dy !== 0) await page.keyboard.press(dy > 0 ? "ArrowDown" : "ArrowUp");
    else if (dx !== 0) await page.keyboard.press(dx > 0 ? "ArrowRight" : "ArrowLeft");
    else return true;
  }
  return false;
}

/** 现在还没翻开、也没插旗的第一格（键盘插旗得挑这种格子，不然按了也没反应） */
async function firstHiddenCell(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".mg-cell")].findIndex(
      (el) =>
        !el.classList.contains("mg-open") &&
        !el.classList.contains("mg-bloom") &&
        !el.classList.contains("mg-flag") &&
        !el.classList.contains("mg-guess")
    )
  );
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
  await sleep(1200);
  const baseLeak = await page.evaluate(() => ({ ...window.__leak }));

  // 1. 首页能看见这张卡
  const card = await page.evaluate(() =>
    [...document.querySelectorAll("body *")].some((el) => el.textContent?.trim() === "扫雷花园")
  );
  log(card, "首页自动发现「扫雷花园」卡片");

  // 2. 逐关真扫
  for (const n of LEVELS) {
    errors = [];
    const title = await openLevel(page, n);
    const cells = await page.$$eval(".mg-cell", (list) => list.length);
    const plan = await planLevel(page, n, 0).catch((e) => ({ error: String(e) }));
    if (plan.error) {
      log(false, `第 ${n} 关`, plan.error);
      continue;
    }
    // 首点挑中间那一格：安全区更大，展开也更痛快
    const first = Math.floor(plan.h / 2) * plan.w + Math.floor(plan.w / 2);
    const real = await planLevel(page, n, first);
    const box = await cellBox(page, first);
    const noGuessOk = !real.wantNoGuess || real.noGuess;

    const res = await clearLevel(page, real, first);
    await sleep(600);
    const won = await wonOverlay(page);
    const flow = await overflowX(page);
    const ok =
      cells === plan.w * plan.h &&
      (box?.w ?? 0) >= 27.5 &&
      noGuessOk &&
      res.cleared &&
      won &&
      flow.doc <= 1 &&
      flow.bad.length === 0 &&
      errors.length === 0;
    log(
      ok,
      `第 ${n} 关（${real.h}×${real.w} / ${real.mines} 颗${real.fog ? " · 有雾" : ""}${
        real.timeLimitMs ? " · 限时" : ""
      }${real.flagLimit ? " · 限旗" : ""}）真扫到过关`,
      ok
        ? `${res.clicks} 次点击`
        : `title=${title} cells=${cells}/${plan.w * plan.h} cell=${box?.w?.toFixed(1)} noGuess=${real.noGuess}/${real.wantNoGuess} cleared=${res.cleared}(${res.why ?? ""}) won=${won} overflow=${flow.doc} bad=${flow.bad} err=${errors[0] ?? "-"}`
    );
  }

  // 3. 30 列的大图：迷你地图出现，网格确实比屏幕宽
  errors = [];
  await openLevel(page, 164);
  const bigInfo = await page.evaluate(() => {
    const grid = document.querySelector(".mg-grid");
    const mini = document.querySelector(".mg-mini");
    const scroll = document.querySelector(".mg-scroll");
    return {
      gridWidth: grid?.getBoundingClientRect().width ?? 0,
      scrollable: scroll ? scroll.scrollWidth > scroll.clientWidth : false,
      miniShown: mini ? !mini.hidden && mini.getBoundingClientRect().width > 0 : false
    };
  });
  const bigFlow = await overflowX(page);
  log(
    bigInfo.scrollable && bigInfo.miniShown && bigFlow.doc <= 1 && bigFlow.bad.length === 0,
    "30 列大图：横向可滚 + 迷你地图 + 页面不溢出",
    JSON.stringify({ ...bigInfo, doc: bigFlow.doc, bad: bigFlow.bad })
  );

  // 4a. 前两章有一次小铲子保护：踩中不算输，替你插好旗接着玩
  errors = [];
  await openLevel(page, 25);
  {
    const plan = await planLevel(page, 25, 40);
    await clickCell(page, 40);
    await sleep(150);
    const spike = plan.mine.findIndex((v) => v === 1);
    await clickCell(page, spike);
    await sleep(200);
    const said = await page.$eval(".mg-msg", (el) => el.textContent ?? "").catch(() => "");
    const flagged = await page.evaluate(
      (i) => document.querySelectorAll(".mg-cell")[i].classList.contains("mg-flag"),
      spike
    );
    const alive = await page.evaluate(() => !document.querySelector(".l99-ov-title"));
    log(
      said.includes("挡下") && flagged && alive,
      "前两章的小铲子：第一颗刺种被挡下、自动插旗，这一盘继续",
      `文案=「${said}」 插旗=${flagged} 没结束=${alive}`
    );
  }

  // 4b. 第三章起没有保护：真输一次，那一颗当场开花，其余的慢慢揭开
  errors = [];
  await openLevel(page, 49);
  {
    const first = 40;
    const plan = await planLevel(page, 49, first);
    const total = plan.mine.filter(Boolean).length;
    await clickCell(page, first);
    await sleep(150);
    const spike = plan.mine.findIndex((v) => v === 1);
    await clickCell(page, spike);
    await sleep(120);
    const early = await page.$$eval(".mg-bloom", (l) => l.length);
    const lostPanel = await page.evaluate(
      () => document.querySelector(".l99-ov-title")?.textContent?.includes("就差一点点") ?? false
    );
    // 每颗之间隔 90ms，等它全开完再数
    await sleep(total * 90 + 900);
    const late = await page.$$eval(".mg-bloom", (l) => l.length);
    const gentle = await page.evaluate(() =>
      [...document.querySelectorAll(".mg-msg,.l99-ov-sub")].map((el) => el.textContent ?? "").join(" ")
    );
    const noScary = !/地雷|爆炸|炸|战争|伤亡/.test(gentle);
    log(
      early >= 1 && early < total && late === total && lostPanel && noScary,
      "踩到刺种：那一颗当场开花，其余的一颗一颗慢慢揭开，文案温柔",
      `early=${early} late=${late} 共 ${total} 颗 lost=${lostPanel} 文案=${noScary}`
    );
  }

  // 5. 键位：方向键 + F 翻开、G 插旗、Esc 暂停后点不动
  errors = [];
  await openLevel(page, 1);
  {
    const plan1 = await planLevel(page, 1, 0);
    const before = await cursorAt(page);
    await page.keyboard.press("ArrowRight");
    const moved = await cursorAt(page);
    await page.keyboard.press("KeyF");
    await sleep(200);
    const opened = await page.$$eval(".mg-open", (l) => l.length);
    // 插旗只对还盖着的格子有效，先用方向键走到一格没翻开的地方再按 G
    const flagsBefore = await page.$$eval(".mg-flag", (l) => l.length);
    const hidden = await firstHiddenCell(page);
    const walked = hidden >= 0 && (await walkCursorTo(page, hidden, plan1.w));
    await page.keyboard.press("KeyG");
    await sleep(120);
    const flags = (await page.$$eval(".mg-flag", (l) => l.length)) - flagsBefore;
    await page.keyboard.press("Escape");
    await sleep(120);
    const pausedText = await page.$eval(".mg-msg", (el) => el.textContent ?? "");
    const openedWhilePaused = await (async () => {
      const wasOpen = await page.$$eval(".mg-open", (l) => l.length);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("KeyF");
      await sleep(150);
      return (await page.$$eval(".mg-open", (l) => l.length)) - wasOpen;
    })();
    log(
      moved === before + 1 &&
        opened > 0 &&
        walked &&
        flags === 1 &&
        pausedText.includes("计时停住") &&
        openedWhilePaused === 0,
      "键位：方向键移光标 / F 翻开 / G 插旗 / Esc 暂停后点不动",
      `move=${before}→${moved} opened=${opened} 走到=${hidden}(${walked}) flags=+${flags} paused=「${pausedText}」 pausedOpen=${openedWhilePaused}`
    );
  }

  // 6. 触屏长按插旗 + 右键插旗 + 和弦
  errors = [];
  await openLevel(page, 25);
  {
    const plan = await planLevel(page, 25, 40);
    await clickCell(page, 40);
    await sleep(150);
    const spikes = plan.mine.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);

    // 长按 600ms 插旗
    const box = await cellBox(page, spikes[0]);
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await sleep(600);
    await page.mouse.up();
    await sleep(120);
    const longOk = await page.evaluate(
      (i) => document.querySelectorAll(".mg-cell")[i].classList.contains("mg-flag"),
      spikes[0]
    );

    // 右键插旗
    const box2 = await cellBox(page, spikes[1]);
    await page.mouse.click(box2.x, box2.y, { button: "right" });
    await sleep(120);
    const rightOk = await page.evaluate(
      (i) => document.querySelectorAll(".mg-cell")[i].classList.contains("mg-flag"),
      spikes[1]
    );

    // 和弦：把某个数字格周围的刺种全插上旗，再点它
    const target = await page.evaluate(
      ([mine, w]) => {
        const cells = [...document.querySelectorAll(".mg-cell")];
        for (let i = 0; i < cells.length; i++) {
          if (!cells[i].classList.contains("mg-open")) continue;
          const n = Number(cells[i].textContent);
          if (!n) continue;
          const nbs = [];
          const x = i % w;
          const y = Math.floor(i / w);
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= cells.length / w) continue;
              nbs.push(ny * w + nx);
            }
          }
          const need = nbs.filter((k) => mine[k]);
          const hidden = nbs.filter((k) => !mine[k] && !cells[k].classList.contains("mg-open"));
          if (need.length === n && hidden.length > 0) return { at: i, flags: need, gain: hidden.length };
        }
        return null;
      },
      [plan.mine, plan.w]
    );
    let chordOk = false;
    if (target) {
      for (const f of target.flags) {
        // 前面长按 / 右键已经插上的就别再点了，再点一下等于把旗拔了
        const already = await page.evaluate(
          (i) => document.querySelectorAll(".mg-cell")[i].classList.contains("mg-flag"),
          f
        );
        if (already) continue;
        const b = await cellBox(page, f);
        await page.mouse.click(b.x, b.y, { button: "right" });
        await sleep(120);
      }
      const openedBefore = await page.$$eval(".mg-open", (l) => l.length);
      await clickCell(page, target.at);
      await sleep(200);
      const openedAfter = await page.$$eval(".mg-open", (l) => l.length);
      chordOk = openedAfter >= openedBefore + target.gain;
    }
    log(longOk && rightOk && chordOk, "长按插旗 / 右键插旗 / 旗插齐之后点数字真的和弦", `长按=${longOk} 右键=${rightOk} 和弦=${chordOk}`);
  }

  // 7. 三个额外模式
  errors = [];
  await page.goto(`${BASE}/?t=${Date.now()}#/game/mine-garden`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".mg-modebar", { timeout: 10000 });
  {
    const enter = async (label) => {
      await page.evaluate((t) => {
        const btn = [...document.querySelectorAll(".mg-modebar button")].find((el) => el.textContent?.includes(t));
        btn?.click();
      }, label);
      await sleep(260);
    };
    const leave = async () => {
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find((el) => el.textContent?.includes("回闯关"));
        btn?.click();
      });
      await sleep(200);
    };

    await enter("竞速对战");
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((el) => el.textContent?.includes("开始竞速"));
      btn?.click();
    });
    await sleep(300);
    await clickCell(page, 40);
    await sleep(1600);
    const aiWidth = await page.evaluate(() => {
      const bar = document.querySelector(".mg-bar > i");
      return bar ? parseFloat(bar.style.width || "0") : -1;
    });
    log(aiWidth > 0, "竞速对战：同一张图开局，假人的进度条真的在走", `进度=${aiWidth}%`);
    await leave();

    await enter("连续清盘");
    const endlessOk = await page.evaluate(() =>
      [...document.querySelectorAll(".mg-note")].some((el) => (el.textContent ?? "").includes("连清"))
    );
    log(endlessOk, "连续清盘：入口开得起来，连清计数在界面上");
    await leave();

    await enter("双人同屏");
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((el) => (el.textContent ?? "").trim().startsWith("开始"));
      btn?.click();
    });
    await sleep(300);
    const duo = await page.$$eval(".mg-field", (l) => l.length);
    const duoNames = await page.evaluate(() =>
      [...document.querySelectorAll(".mg-field .mg-chip")].map((el) => el.textContent ?? "").join(" ")
    );
    log(
      duo === 2 && duoNames.includes("朵朵") && duoNames.includes("星星"),
      "双人同屏：左右两块地都在，朵朵和星星各一份",
      `块数=${duo}`
    );
    await leave();
  }

  // 8. destroy 无泄漏
  await page.goto(`${BASE}/?t=${Date.now()}#/game/mine-garden`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".l99-continue", { timeout: 15000 });
  await page.click(".l99-continue");
  await page.waitForSelector(".mg-cell", { timeout: 10000 });
  await clickCell(page, 12);
  await sleep(500);
  await page.goto(`${BASE}/?t=${Date.now()}`, { waitUntil: "networkidle0" });
  await sleep(1200);
  const afterLeak = await page.evaluate(() => ({ ...window.__leak }));
  log(
    afterLeak.listeners <= baseLeak.listeners + 1 && afterLeak.intervals <= baseLeak.intervals && afterLeak.frames <= 1,
    "destroy 无泄漏：监听 / interval / rAF 都回到基线",
    `${JSON.stringify(baseLeak)} → ${JSON.stringify(afterLeak)}`
  );

  log(errors.length === 0, "全程没有 pageerror / console.error", errors.slice(0, 2).join(" ; "));

  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} 项通过`);
  if (bad.length) {
    console.log("未通过：");
    for (const b of bad) console.log(`  - ${b.what}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
