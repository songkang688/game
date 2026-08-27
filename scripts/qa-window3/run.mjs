/**
 * 窗口 3 验收 · 19 款逐款走查(真实 Chrome + 真实键鼠事件)。
 *
 * 每款走:首页点卡片 → 战役指定几关(主动打一局 + 摆烂一局)→ 每个模式入口
 *        → 退出重进 → 360px 视口再走一遍。
 * 结果以 JSON 落到 docs/qa/_evidence/window3-roundN-browser[.shard].json。
 *
 * 用法:npm run build && npx vite preview --port 4173
 *      node scripts/qa-window3/run.mjs --round 1 [--shard 0/3] [--only id,id]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import * as D from "./driver.mjs";

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : dflt;
};
const ROUND = Number(arg("round", 1));
const ONLY = arg("only", "").split(",").map((s) => s.trim()).filter(Boolean);
const SHARD = arg("shard", "");
/** 每轮换一批关卡,第 2 轮不碰第 1 关 */
const LEVEL_SETS = { 1: [1, 100, 188], 2: [7, 45, 132], 3: [1, 60, 133, 188] };
const LEVELS = LEVEL_SETS[ROUND] ?? LEVEL_SETS[1];
const PLAY_MS = Number(arg("playms", 15000));
const IDLE_MS = Number(arg("idlems", 11000));
const MODE_MS = Number(arg("modems", 11000));

export const GAMES = [
  { id: "duo-rush", title: "朵星双人冲刺", levels: 0, drag: false },
  { id: "duo-arena", title: "朵星擂台", levels: 0, drag: false },
  { id: "duo-vs-star", title: "朵朵大战星星", levels: 188, drag: false },
  { id: "sling-birds", title: "弹弹小鸟", levels: 188, drag: true },
  { id: "candy-swing", title: "糖果秋千", levels: 188, drag: true },
  { id: "gold-hook", title: "金矿钩钩", levels: 188, drag: false },
  { id: "garden-guard", title: "花园守卫", levels: 188, drag: false },
  { id: "sprout-defense", title: "绿芽保卫战", levels: 188, drag: false },
  { id: "monster-crisis", title: "小怪物危机", levels: 188, drag: false },
  { id: "shoot-range", title: "星星射击场", levels: 188, drag: true },
  { id: "sky-squad", title: "飞机小队", levels: 188, drag: true },
  { id: "tank-battle", title: "铁皮坦克大战", levels: 188, drag: false },
  { id: "bomb-buddies", title: "泡泡炸弹人", levels: 188, drag: false },
  { id: "snow-fight", title: "雪球大作战", levels: 188, drag: true },
  { id: "bumper-cars", title: "碰碰车大乱斗", levels: 188, drag: false },
  { id: "bowling-lane", title: "保龄球小馆", levels: 188, drag: true },
  { id: "ice-fire-forest", title: "冰冰火火森林", levels: 188, drag: false },
  { id: "puff-bros", title: "噗噗兄弟", levels: 188, drag: false },
  { id: "prince-princess", title: "王子公主大冒险", levels: 188, drag: false },
];

const MODE_RE = /对战|无尽|合作|双人|人机|车轮|守到|远征|雪季|打靶|甜甜|矿井|守巢|老巢|城堡塔|擂|一个人玩|两人一起/;

async function modeEntries(page) {
  return page.evaluate((reSrc) => {
    const re = new RegExp(reSrc);
    const stage = document.querySelector(".game-stage");
    if (!stage) return [];
    const out = [];
    for (const b of stage.querySelectorAll("button")) {
      if (b.closest(".l99-map") || b.closest(".l99-stagebar") || b.closest(".l99-overlay")) continue;
      const t = (b.textContent ?? "").trim().replace(/\s+/g, " ");
      if (!t || t.length > 24) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      if (!re.test(t)) continue;
      out.push(t);
    }
    return [...new Set(out)];
  }, MODE_RE.source);
}

/** 每次开局前把存档重置成「全通关」,免得前一局的乱点污染后面的解锁状态 */
async function reseed(page, g) {
  if (!g.levels) return;
  await D.seedProgress(page, [g.id], g.levels);
}

async function playLevel(page, g, lv, { idle = false, ms }) {
  const found = await D.gotoChapterOf(page, lv);
  if (!found) return { open: "chapter-not-found" };
  const opened = await D.openLevel(page, lv);
  if (opened.open !== "clicked" || opened.stage !== "ok") return opened;
  const played = await D.play(page, {
    ms,
    drag: g.drag,
    idle,
    seed: ROUND * 1000 + lv + (idle ? 7 : 0),
    stopOnResult: true,
    stayInLevel: true,
  });
  const out = { ...opened, ...played };
  await D.dismissResult(page);
  await D.backToMap(page);
  return out;
}

async function runGame(page, errs, g) {
  const rec = {
    id: g.id, title: g.title, entry: null, modeButtons: [], chapters: 0,
    campaign: {}, idleLose: null, modes: {}, reentry: null, mobile: {}, errors: [],
  };
  errs.reset();

  await page.goto(`${D.BASE}/`, { waitUntil: "networkidle0" });
  await D.clearStorage(page);
  await reseed(page, g);

  const entry = await D.openFromHome(page, g);
  rec.entry = entry;
  if (entry.entry !== "ok") {
    rec.errors = [...errs.errors];
    return rec;
  }

  rec.modeButtons = await modeEntries(page);
  rec.chapters = (await D.chapterTabs(page)).length;

  // ---- 战役:每关主动打一局 ----
  if (g.levels) {
    for (const lv of LEVELS) {
      rec.campaign[lv] = await playLevel(page, g, lv, { ms: PLAY_MS });
      // 上一局可能改了存档,重置回全通关再开下一关
      await reseed(page, g);
      await D.gotoGame(page, g.id);
    }
    // ---- 摆烂一局:证明这关真有失败分支 ----
    rec.idleLose = await playLevel(page, g, LEVELS[0], { idle: true, ms: IDLE_MS });
    await reseed(page, g);
  }

  // ---- 模式入口 ----
  for (const label of rec.modeButtons.slice(0, 6)) {
    const st = await D.gotoGame(page, g.id);
    if (st !== "ok") {
      rec.modes[label] = { enter: st };
      continue;
    }
    const clicked = await D.clickButtonByText(page, label);
    if (!clicked) {
      rec.modes[label] = { enter: "button-gone" };
      continue;
    }
    const started = await D.clickStart(page);
    const played = await D.play(page, {
      ms: MODE_MS, drag: g.drag, seed: ROUND * 2000 + label.length * 13, stopOnResult: true,
    });
    rec.modes[label] = { enter: "ok", started, ...played };
    await D.dismissResult(page);
  }

  // ---- 退出 → 重进 ×2 ----
  await D.goHome(page);
  const re1 = await D.gotoGame(page, g.id);
  await D.goHome(page);
  const re2 = await D.gotoGame(page, g.id);
  rec.reentry = { first: re1, second: re2 };

  // ---- 360×720 ----
  await page.setViewport({ width: 360, height: 720 });
  await page.goto(`${D.BASE}/`, { waitUntil: "networkidle0" });
  await reseed(page, g);
  const mEntry = await D.openFromHome(page, g);
  rec.mobile.entry = mEntry.entry;
  if (mEntry.entry === "ok") {
    rec.mobile.overflowHome = await D.overflowPx(page);
    if (g.levels) {
      await D.gotoChapterOf(page, LEVELS[0]);
      const opened = await D.openLevel(page, LEVELS[0]);
      rec.mobile.level = opened;
      if (opened.stage === "ok") {
        const played = await D.play(page, {
          ms: 8000, drag: g.drag, seed: 77, stopOnResult: true, stayInLevel: true,
        });
        rec.mobile.play = { win: played.win, lose: played.lose };
        rec.mobile.overflowLevel = await D.overflowPx(page);
      }
    } else {
      const played = await D.play(page, { ms: 8000, drag: g.drag, seed: 77, stopOnResult: true });
      rec.mobile.play = { win: played.win, lose: played.lose };
      rec.mobile.overflowLevel = await D.overflowPx(page);
    }
    rec.mobile.minHit = await page.evaluate(() => {
      const stage = document.querySelector(".game-stage");
      if (!stage) return null;
      let min = 9999, sel = "";
      for (const b of stage.querySelectorAll("button, [role='button']")) {
        const r = b.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        const m = Math.min(r.width, r.height);
        if (m < min) { min = Math.round(m); sel = (typeof b.className === "string" ? b.className : "").slice(0, 40); }
      }
      return min === 9999 ? null : { min, sel };
    });
  }
  await page.setViewport({ width: 900, height: 1200 });

  rec.errors = [...errs.errors].slice(0, 12);
  return rec;
}

async function main() {
  let list = ONLY.length ? GAMES.filter((g) => ONLY.includes(g.id)) : GAMES;
  let tag = "";
  if (SHARD) {
    const [i, n] = SHARD.split("/").map(Number);
    list = list.filter((_, k) => k % n === i);
    tag = `.s${i}`;
  }
  const { browser, page } = await D.launch();
  const errs = D.collectErrors(page);

  await page.goto(`${D.BASE}/`, { waitUntil: "networkidle0" });
  await D.sleep(500);
  const home = await page.evaluate(() => ({
    cards: document.querySelectorAll(".game-card").length,
    ourCards: [
      "朵星双人冲刺","朵星擂台","朵朵大战星星","弹弹小鸟","糖果秋千","金矿钩钩","花园守卫",
      "绿芽保卫战","小怪物危机","星星射击场","飞机小队","铁皮坦克大战","泡泡炸弹人","雪球大作战",
      "碰碰车大乱斗","保龄球小馆","冰冰火火森林","噗噗兄弟","王子公主大冒险",
    ].filter((t) => [...document.querySelectorAll(".game-card")].some((c) => (c.textContent ?? "").includes(t))).length,
  }));
  console.log(`home: ${home.cards} 张卡片,本窗 19 款命中 ${home.ourCards}`);

  const results = [];
  for (const g of list) {
    const t0 = Date.now();
    let rec;
    try {
      rec = await runGame(page, errs, g);
    } catch (e) {
      rec = { id: g.id, title: g.title, fatal: String(e).slice(0, 300) };
    }
    rec.ms = Date.now() - t0;
    results.push(rec);
    const camp = Object.entries(rec.campaign ?? {})
      .map(([lv, v]) => `${lv}:${v.open === "clicked" ? (v.win ? "赢" : v.lose ? "输" : "无结算") : v.open}`)
      .join(" ");
    const modes = Object.entries(rec.modes ?? {})
      .map(([m, v]) => `${m.replace(/[^\u4e00-\u9fa5A-Za-z]/g, "")}=${v.enter === "ok" ? (v.win ? "赢" : v.lose ? "输" : "无") : v.enter}`)
      .join(" ");
    console.log(
      `${rec.entry?.entry === "ok" ? "✓" : "✗"} ${rec.id} | ${camp} | 摆烂=${rec.idleLose ? (rec.idleLose.lose ? "输" : rec.idleLose.win ? "赢" : "无") : "-"} | ${modes} | 重进=${rec.reentry?.second} | 360=${rec.mobile?.entry}/of${rec.mobile?.overflowLevel?.doc ?? "-"}/hit${rec.mobile?.minHit?.min ?? "-"} | err=${rec.errors?.length ?? "-"} | ${Math.round(rec.ms / 1000)}s`
    );
  }

  await browser.close();
  mkdirSync("docs/qa/_evidence", { recursive: true });
  const out = `docs/qa/_evidence/window3-round${ROUND}-browser${tag}.json`;
  writeFileSync(out, JSON.stringify({ round: ROUND, levels: LEVELS, home, results }, null, 2));
  console.log(`\n证据落盘:${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
