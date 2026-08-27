/**
 * 窗口 1 · 12 款新游戏的整批走查（三轮验收都用这一份，靠 QA_ROUND 换样本）。
 *
 * 每一款都走同一条真人路线，全部用真浏览器、真点击、真键盘：
 *
 *   1. 首页搜得到这张卡（`import.meta.glob` 自动发现，不改 loader）；
 *   2. 从首页点卡进去，游戏真的挂起来了（舞台上有东西、没有出错兜底页）；
 *   3. `meta.modes` 里写的每一种模式，界面上都有对得上的入口，而且点得开；
 *   4. 战役抽三关（第 1 / 100 / 188 关，第 2 轮换 24 / 96 / 164，第 3 轮换 12 / 60 / 140）：
 *      写好前置星级存档 → 从地图「继续闯关」进去 → 关卡标题对得上；
 *   5. 360×640 竖屏不横向溢出，最小正文字号 ≥ 14px；
 *   6. Esc 只弹一层暂停：外壳的暂停面板和游戏自己的暂停条不许各说各话；
 *   7. 退回首页后 window 监听 / interval / rAF 全部回到基线（destroy 无泄漏）；
 *   8. 全程没有 pageerror、没有 console.error。
 *
 * 跑法：
 *   npm i --no-save puppeteer-core
 *   npx vite --port 5185
 *   SMOKE_BASE=http://127.0.0.1:5185 node scripts/qa-1.2-window1-sweep.mjs
 *   QA_ROUND=2 ... 换第二批关卡；QA_ONLY=merge-2048,mine-garden 只跑其中几款
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5185";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const VIEWPORT = { width: 360, height: 640 };
const ROUND = Number(process.env.QA_ROUND ?? 1);

/** 三轮各换一批关卡，免得三轮都只玩第 1 关 */
const LEVEL_SETS = { 1: [1, 100, 188], 2: [24, 96, 164], 3: [12, 60, 140] };
const LEVELS = LEVEL_SETS[ROUND] ?? LEVEL_SETS[1];

const GAMES = [
  { id: "orb-arena", title: "圆圆大作战" },
  { id: "snake-royale", title: "长蛇争霸" },
  { id: "block-drop", title: "方块叠叠乐" },
  { id: "combo-clash", title: "连招对决" },
  { id: "mahjong-bloom", title: "花开麻将" },
  { id: "star-estate", title: "梨康地产" },
  { id: "hero-cards", title: "英杰令" },
  { id: "weiqi-garden", title: "围子花园" },
  { id: "flight-chess", title: "飞行棋乐园" },
  { id: "merge-2048", title: "星星合成" },
  { id: "mine-garden", title: "扫雷花园" },
  { id: "sudoku-petal", title: "数独花田" }
];

const ONLY = (process.env.QA_ONLY ?? "").split(",").filter(Boolean);
const TARGETS = ONLY.length ? GAMES.filter((g) => ONLY.includes(g.id)) : GAMES;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
function log(id, ok, what, extra = "") {
  rows.push({ id, ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} [${id}] ${what}${extra ? ` — ${extra}` : ""}`);
}

/** destroy 泄漏计数器，必须在任何页面脚本之前挂上 */
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

/** 从首页搜名字、点卡进去（不直接改 hash，走孩子真会走的那条路） */
async function enterFromHome(page, game) {
  await page.$eval(".home-search-input", (el) => {
    el.value = "";
  });
  await page.type(".home-search-input", game.title);
  await sleep(350);
  const clicked = await page.evaluate((title) => {
    const card = [...document.querySelectorAll(".game-card")].find((c) => (c.textContent ?? "").includes(title));
    if (!card) return false;
    card.click();
    return true;
  }, game.title);
  if (!clicked) return false;
  await sleep(900);
  return true;
}

/** 舞台上真的画出东西了吗（不是加载中、也不是出错兜底） */
async function mounted(page) {
  return page.evaluate(() => {
    if (document.querySelector(".game-error")) return "error";
    if (document.querySelector(".game-loading")) return "loading";
    const stage = document.querySelector(".game-stage");
    if (!stage || stage.children.length === 0) return "empty";
    // 12 款都是「进去先看 188 关地图，旁边一排模式入口」
    if (!document.querySelector(".l99-map")) return "no-map";
    if (!document.querySelector('[class$="-modebar"]')) return "no-modebar";
    return "ok";
  });
}

/** 游戏自己那排模式入口上的文案 */
async function modeButtons(page) {
  return page.$$eval('[class$="-modebar"] button', (els) => els.map((e) => (e.textContent ?? "").trim()).filter(Boolean));
}

/** 逐个点开模式入口，看它是不是真的挂出了一个能玩的界面 */
async function openEachMode(page) {
  const labels = await modeButtons(page);
  const out = [];
  for (let i = 0; i < labels.length; i++) {
    const before = await page.evaluate(() => document.querySelector(".game-stage")?.innerText?.length ?? 0);
    await page.evaluate((idx) => document.querySelectorAll('[class$="-modebar"] button')[idx]?.click(), i);
    await sleep(700);
    const opened = await page.evaluate(() => {
      const stage = document.querySelector(".game-stage");
      return {
        gone: !document.querySelector(".l99-map") || document.querySelector(".l99-map")?.offsetParent === null,
        len: stage?.innerText?.length ?? 0,
        canvas: !!stage?.querySelector("canvas"),
        nodes: stage?.querySelectorAll("*").length ?? 0
      };
    });
    out.push({ label: labels[i], ok: opened.gone && opened.nodes > 10, detail: opened });
    // 回到地图：先找返回键，找不到就重进
    const backed = await page.evaluate(() => {
      const b = [...document.querySelectorAll(".game-stage button")].find((x) => /返回|↩|◀ ?返回|退出/.test(x.textContent ?? ""));
      if (!b) return false;
      b.click();
      return true;
    });
    await sleep(600);
    if (!backed || !(await page.$(".l99-map"))) return { labels, out, needsReload: true };
  }
  return { labels, out, needsReload: false };
}

/** 写好「前 n-1 关已过」的星级存档，再从地图继续闯关，落到第 n 关 */
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
  if (!cont) return "";
  await cont.click();
  await sleep(900);
  return page.$eval(".l99-stagetitle", (el) => el.textContent ?? "").catch(() => "");
}

/**
 * 360px 溢出与字号。字号只量**本窗口自己画的**文字：
 * `.l99-*` 是 1.1 的关卡外壳（不是本窗口的独占文件），单独记一笔交给主管；
 * 纯符号（★ 🔒 箭头）当装饰，不按正文字号要求。
 */
async function overflowInfo(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const decorative = /^[\s★☆🔒✔✖◀▶▲▼♾️🏆🌟·|—-]+$/u;
    // 纯 emoji（含变体选择符 / 零宽连接）也是装饰：地块上那朵 🌷 不是要读的正文
    const emojiOnly = /^[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u;
    let minFont = Infinity;
    let worst = "";
    let minShell = Infinity;
    let worstShell = "";
    for (const el of document.querySelectorAll(".game-screen *")) {
      const t = (el.textContent ?? "").trim();
      if (!t || el.children.length || decorative.test(t) || emojiOnly.test(t)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const size = parseFloat(cs.fontSize);
      const isShell = el.className && /\bl99-/.test(String(el.className));
      if (isShell) {
        if (size < minShell) {
          minShell = size;
          worstShell = t.slice(0, 10);
        }
      } else if (size < minFont) {
        minFont = size;
        worst = t.slice(0, 10);
      }
    }
    return { scroll: doc.scrollWidth, client: doc.clientWidth, minFont, worst, minShell, worstShell };
  });
}

/**
 * Esc 只该弹一层。
 *
 * 本窗口 12 款都自己接管了 Esc，所以正确的样子是：**外壳那层面板一次都不该出现**
 * （游戏 `e.preventDefault()` 把 Esc 接住了，`gameShell` 看到 `defaultPrevented` 就让路），
 * 而游戏自己的暂停层跟着按键一下一下地开、关、开。
 *
 * 第 1 轮 W1-R1-01 修之前是反过来的：两层一起动还错开一拍。当时这里写的判据是
 * 「两层同步」，那只在缺陷还在的时候成立；修好之后 `shell` 恒为 false，
 * 拿它跟游戏自己的暂停比就必然对不上，是判据过期了，不是产品回退。
 */
async function escLayers(page) {
  const read = () =>
    page.evaluate(() => {
      // 认最里层那个：外层容器的 textContent 会把注入的 CSS 和整屏文字都算进来
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
  const snaps = [await read()];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Escape");
    await sleep(320);
    snaps.push(await read());
  }
  // 收干净，别影响后面的用例
  if (snaps.at(-1).selfPaused) {
    await page.keyboard.press("Escape");
    await sleep(250);
  }
  return snaps;
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

  console.log(`第 ${ROUND} 轮 · 关卡样本 ${LEVELS.join(" / ")} · 共 ${TARGETS.length} 款\n`);

  for (const game of TARGETS) {
    errors = [];
    await goHome(page);
    const baseline = await leak(page);

    // 1–2. 首页找得到、点得进
    const entered = await enterFromHome(page, game);
    log(game.id, entered, "首页搜得到这张卡、点得进去");
    if (!entered) continue;

    const state = await mounted(page);
    log(game.id, state === "ok", "进去先看到 188 关地图和一排模式入口", state);

    // 3. meta.modes 说有几种，界面上就得有几个入口，而且每个都点得开
    const declared = await page.evaluate(async (id) => {
      const mod = await import(`/src/games/${id}/meta.ts`);
      return mod.meta?.modes ?? [];
    }, game.id);
    const extras = declared.filter((m) => m !== "campaign");
    const { labels, out } = await openEachMode(page);
    // 只要求「声明了的都在」，不要求「界面上一个都不许多」：
    // `combo-clash` 的「🎯 训练场」是不结算胜负的练习区（帧数据、输入历史都摊开给你看），
    // 它不属于 playModes 里 campaign / versus / endless 那套口径，meta.modes 不该认领它。
    log(
      game.id,
      labels.length >= extras.length,
      `meta.modes 说的 ${extras.length} 个非战役入口界面上都在`,
      labels.length > extras.length
        ? `${labels.join(" / ")}（多出 ${labels.length - extras.length} 个不结算胜负的练习入口）`
        : labels.join(" / ")
    );
    const deadEntries = out.filter((o) => !o.ok).map((o) => o.label);
    log(game.id, deadEntries.length === 0, "每个模式入口都点得开、真的挂出界面", deadEntries.join(", "));

    // 4. 战役三关
    for (const n of LEVELS) {
      const title = await openLevel(page, game.id, n);
      const hit = new RegExp(`第\\s*${n}\\s*关`).test(title);
      log(game.id, hit, `战役第 ${n} 关开得起来`, title.slice(0, 24));
    }

    // 5. 360px（此时人在关卡里，量的是真正在玩的那一屏）
    const ov = await overflowInfo(page);
    log(game.id, ov.scroll <= ov.client + 1, "360px 竖屏不横向溢出", `${ov.scroll} vs ${ov.client}`);
    log(game.id, ov.minFont >= 14, "本窗口自画文字最小字号 ≥ 14px", `${ov.minFont}px「${ov.worst}」`);
    if (ov.minShell < 14) console.log(`       · 1.1 关卡外壳最小字号 ${ov.minShell}px「${ov.worstShell}」（不是本窗口的文件，记给主管）`);

    // 6. Esc 只弹一层
    const snaps = await escLayers(page);
    // 进关时不该是暂停的；此后三下 Esc 要一下一下地开、关、开；外壳那层一次都不许露头
    const want = [false, true, false, true];
    const ok =
      snaps.length === 4 &&
      !snaps.some((s) => s.shell) &&
      snaps.every((s, i) => s.selfPaused === want[i]);
    log(
      game.id,
      ok,
      "Esc 只弹一层暂停（外壳不叠面板，游戏自己那层一下一下地开关）",
      JSON.stringify(snaps.map((s) => `${s.shell ? "S" : "-"}${s.selfPaused ? "P" : "-"}`))
    );

    // 7. destroy 无泄漏
    await goHome(page);
    await sleep(500);
    const after = await leak(page);
    const dl = after.listeners - baseline.listeners;
    const di = after.intervals - baseline.intervals;
    log(game.id, dl <= 0 && di <= 0 && after.frames <= 1, "退回首页后监听 / timer / rAF 都清干净", JSON.stringify({ dl, di, frames: after.frames }));

    // 8. 无报错
    log(game.id, errors.length === 0, "全程无 pageerror / console.error", errors[0]?.slice(0, 120) ?? "");
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

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
