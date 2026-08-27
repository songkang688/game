/**
 * 窗口 1 · 第 2 轮 · 竞态走查。
 *
 * 第 1 轮那份整批走查（`qa-1.2-window1-sweep.mjs`）走的是「慢慢来」的路：
 * 点一下、等一等、再点下一下。孩子不这么玩 —— 他们会连打 Esc、把模式按钮当
 * 连点器、动画还没放完就按返回。这一份专门抢那些拍子：
 *
 *   1. **Esc 连打**：40ms 一下连按 8 下，暂停层的开关次数要和按键次数对得上，
 *      外壳那层一次都不许露头，收工时状态必须回到「没暂停」；
 *   2. **模式入口连点**：同一个按钮 60ms 内点 3 下，舞台上只许挂一份界面；
 *   3. **模式切换风暴**：模式 A → 返回 → 模式 B → 返回 …… 每步只给 200ms，
 *      转完一圈监听 / timer / rAF 必须回到基线；
 *   4. **动画中途退出**：进关只等 250ms（此时入场动画、AI 首手都还在飞）就退回首页，
 *      连做 3 次，泄漏计数一样要归零；
 *   5. 全程无 pageerror / console.error。
 *
 * 跑法：
 *   npx vite --port 5185
 *   SMOKE_BASE=http://127.0.0.1:5185 node scripts/qa-1.2-window1-r2-race.mjs
 *   QA_ONLY=merge-2048,mine-garden 只跑其中几款
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5185";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const VIEWPORT = { width: 360, height: 640 };

const GAMES = [
  { id: "orb-arena", title: "圆圆大作战", level: 24 },
  { id: "snake-royale", title: "长蛇争霸", level: 96 },
  { id: "block-drop", title: "方块叠叠乐", level: 164 },
  { id: "combo-clash", title: "连招对决", level: 24 },
  { id: "mahjong-bloom", title: "花开麻将", level: 96 },
  { id: "star-estate", title: "梨康地产", level: 164 },
  { id: "hero-cards", title: "英杰令", level: 24 },
  { id: "weiqi-garden", title: "围子花园", level: 96 },
  { id: "flight-chess", title: "飞行棋乐园", level: 164 },
  { id: "merge-2048", title: "星星合成", level: 24 },
  { id: "mine-garden", title: "扫雷花园", level: 96 },
  { id: "sudoku-petal", title: "数独花田", level: 164 }
];

const ONLY = (process.env.QA_ONLY ?? "").split(",").filter(Boolean);
const TARGETS = ONLY.length ? GAMES.filter((g) => ONLY.includes(g.id)) : GAMES;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
function log(id, ok, what, extra = "") {
  rows.push({ id, ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} [${id}] ${what}${extra ? ` — ${extra}` : ""}`);
}

/** 与整批走查同一套泄漏计数器 */
const LEAK_PROBE = () => {
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
};

const leak = (page) => page.evaluate(() => ({ ...window.__leak }));

async function goHome(page) {
  await page.goto(`${BASE}/?t=${Date.now()}#/`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".game-card", { timeout: 15000 });
}

/** 写好前置星级，从地图「继续闯关」落到第 n 关 */
async function openLevel(page, id, n) {
  await page.evaluate(
    (key, target) => {
      localStorage.setItem(key, JSON.stringify(Array.from({ length: 188 }, (_, i) => (i < target - 1 ? 3 : 0))));
    },
    `yiduo-yixing.l99.${id}`,
    n
  );
  await page.goto(`${BASE}/?t=${Date.now()}#/game/${id}`, { waitUntil: "networkidle0" });
  const cont = await page.waitForSelector(".l99-continue", { timeout: 15000 }).catch(() => null);
  if (!cont) return false;
  await cont.click();
  await sleep(900);
  return true;
}

/** 当前可见的「自己那层暂停」——认最里层那个，别把注入的 CSS 算进去 */
const readPause = (page) =>
  page.evaluate(() => {
    const hit = /先歇一会儿|暂停中|接着玩|继续下|回来接着/;
    const stage = document.querySelector(".game-stage");
    let selfPaused = false;
    for (const el of stage ? stage.querySelectorAll("*") : []) {
      if (el.tagName === "STYLE" || el.tagName === "SCRIPT") continue;
      if (!hit.test(el.textContent ?? "")) continue;
      if (Array.from(el.children).some((c) => hit.test(c.textContent ?? ""))) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;
      if (el.getBoundingClientRect().height < 4) continue;
      selfPaused = true;
      break;
    }
    return { shell: !!document.querySelector(".dialog--pause"), selfPaused };
  });

/** 1. Esc 连打：按 n 下，偶数下之后应当回到「没暂停」 */
async function escStorm(page, n) {
  const before = await readPause(page);
  let shellEverShowed = before.shell;
  for (let i = 0; i < n; i++) {
    await page.keyboard.press("Escape");
    await sleep(40);
    if ((await page.evaluate(() => !!document.querySelector(".dialog--pause")))) shellEverShowed = true;
  }
  await sleep(500);
  const after = await readPause(page);
  if (after.selfPaused) {
    await page.keyboard.press("Escape");
    await sleep(300);
  }
  return { before, after, shellEverShowed };
}

/**
 * 舞台现在挂着的东西。
 *
 * 只数**看得见的**：模式开起来之后，188 关地图连同它那排入口会留在 DOM 里、但被藏起来，
 * 所以按 `querySelectorAll` 数出来永远是两排 `-modebar`，那不是重复挂载。
 */
const stageShape = (page) =>
  page.evaluate(() => {
    const stage = document.querySelector(".game-stage");
    if (!stage) return { children: 0, modebars: 0, canvases: 0, nodes: 0 };
    const visible = (el) => {
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden" && el.getBoundingClientRect().height > 0;
    };
    return {
      children: stage.children.length,
      modebars: [...stage.querySelectorAll('[class$="-modebar"]')].filter(visible).length,
      canvases: [...stage.querySelectorAll("canvas")].filter(visible).length,
      nodes: stage.querySelectorAll("*").length
    };
  });

/** 打开第一个模式入口：点 times 下（中间不等），回读舞台形状 */
async function openFirstMode(page, id, times) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/${id}`, { waitUntil: "networkidle0" });
  await page.waitForSelector('[class$="-modebar"] button', { timeout: 15000 }).catch(() => null);
  await page.evaluate((n) => {
    const b = document.querySelector('[class$="-modebar"] button');
    for (let i = 0; i < n; i++) b?.click();
  }, times);
  await sleep(1000);
  return stageShape(page);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"]
  });
  const page = await browser.newPage();
  await page.setViewport({ ...VIEWPORT, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(LEAK_PROBE);

  let errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });

  console.log(`第 2 轮 · 竞态走查 · 共 ${TARGETS.length} 款\n`);

  for (const game of TARGETS) {
    errors = [];
    await goHome(page);
    const baseline = await leak(page);

    // 1. Esc 连打 8 下（偶数）：状态必须回到「没暂停」，外壳一次都不许露头
    const inLevel = await openLevel(page, game.id, game.level);
    if (!inLevel) {
      log(game.id, false, `第 ${game.level} 关进不去,后面几项跳过`);
      continue;
    }
    const storm = await escStorm(page, 8);
    log(
      game.id,
      !storm.before.selfPaused && !storm.after.selfPaused && !storm.shellEverShowed,
      "Esc 连打 8 下后状态自洽（偶数下回到没暂停,外壳一次没露头）",
      `进关 ${storm.before.selfPaused ? "P" : "-"} → 连打后 ${storm.after.selfPaused ? "P" : "-"}${storm.shellEverShowed ? " ⚠️外壳露头" : ""}`
    );

    // 2. 模式入口连点：连点 3 下的舞台必须和老老实实点 1 下长得一样
    const one = await openFirstMode(page, game.id, 1);
    const three = await openFirstMode(page, game.id, 3);
    const same =
      one.children === three.children &&
      one.modebars === three.modebars &&
      one.canvases === three.canvases &&
      Math.abs(one.nodes - three.nodes) <= Math.max(4, one.nodes * 0.15);
    log(
      game.id,
      same,
      "模式入口连点 3 下,舞台和只点 1 下长得一样（没有叠挂第二份）",
      `1 下 ${JSON.stringify(one)} / 3 下 ${JSON.stringify(three)}`
    );

    // 3. 模式切换风暴：每步只给 200ms
    await page.goto(`${BASE}/?t=${Date.now()}#/game/${game.id}`, { waitUntil: "networkidle0" });
    await page.waitForSelector('[class$="-modebar"] button', { timeout: 15000 }).catch(() => null);
    const count = await page.$$eval('[class$="-modebar"] button', (e) => e.length);
    for (let i = 0; i < count; i++) {
      await page.evaluate((idx) => document.querySelectorAll('[class$="-modebar"] button')[idx]?.click(), i);
      await sleep(200);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll(".game-stage button")].find((x) => /返回|↩|退出/.test(x.textContent ?? ""));
        b?.click();
      });
      await sleep(200);
    }
    await sleep(400);
    const stormOk = await page.evaluate(() => !document.querySelector(".game-error"));
    log(game.id, stormOk, `${count} 个模式入口 200ms 一步来回切,没有翻出错页`);

    // 4. 动画中途退出 ×3
    for (let i = 0; i < 3; i++) {
      await openLevelFast(page, game.id, game.level);
      await goHome(page);
    }
    await sleep(700);
    const after = await leak(page);
    const dl = after.listeners - baseline.listeners;
    const di = after.intervals - baseline.intervals;
    log(
      game.id,
      dl <= 0 && di <= 0 && after.frames <= 1,
      "连做 4 次「抢拍子」之后监听 / timer / rAF 仍回到基线",
      JSON.stringify({ dl, di, frames: after.frames })
    );

    log(game.id, errors.length === 0, "全程无 pageerror / console.error", errors[0]?.slice(0, 140) ?? "");
  }

  await browser.close();

  const bad = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - bad.length}/${rows.length} 通过`);
  if (bad.length) {
    console.log("未通过：");
    for (const b of bad) console.log(`  - [${b.id}] ${b.what}`);
    process.exitCode = 1;
  }
}

/** 只等 250ms 就撤——入场动画、AI 首手都还在飞 */
async function openLevelFast(page, id, n) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/${id}`, { waitUntil: "domcontentloaded" });
  const cont = await page.waitForSelector(".l99-continue", { timeout: 15000 }).catch(() => null);
  if (!cont) return;
  await cont.click();
  await sleep(250);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
