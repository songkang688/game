/**
 * 窗口 1 · 第 2 轮测试员的走查脚本(只读取证,一行玩法代码都不改)。
 *
 * 和第 1 轮那份 `smoke-1.2-window1-r1-tester.mjs` 的区别:
 *   · 战役样本换成 **第 2 / 50 / 150 关**(第 1 轮是 1 / 100 / 188),越界夹到合法关;
 *   · 视口除了 360×640 再抽一档 **1280×800** 宽屏做对照;
 *   · 双人键位一律 **分边取证**(画布左右/上下半 + 分边 DOM 叶子 + 朵朵/星星 HUD 行),
 *     并且先采一遍「什么都不按」的空跑基线再做差集 —— 第 1 轮 `mine-garden` 的整屏
 *     指纹误报就是栽在「两块盘同种子长得一样」和「画面自己在动」这两件事上;
 *   · 二级界面(对战/无尽/双人)也量 360px 字号,不只入口屏;
 *   · W1-10 / W1-11 改用**固定 seed**(把页面里的 Math.random 钉死)复现,
 *     并把「我这一手落没落下去」与「AI 回没回」拆开量,好判定是脚本挑点还是真缺陷。
 *
 * 跑法(puppeteer-core 是临时工具,没有进 package.json):
 *   npm i --no-save puppeteer-core
 *   npx vite --port 5186
 *   PART=A node scripts/smoke-1.2-window1-r2-tester.mjs
 *
 * PART 可选(默认 ACDEF):
 *   A 平台五项 + 首页(root 门 / 直达 / 家长门 / 拼音 / 搜索框 / 字号下限)
 *   C 12 款 × 四模式矩阵 @360×640(战役 2/50/150、二级界面字号、destroy 泄漏)
 *   D 同样的矩阵 @1280×800 宽屏对照
 *   E 双人键位分边取证
 *   F W1-01 Esc 双暂停回归复核(5 款)
 *   G W1-10 围子花园自由对战 · 固定 seed 判定
 *   H W1-11 飞行棋 375×667 四色上环线 · 固定 seed 判定
 *   I W1-12 六款过关证据(通用假人,预算给足)
 *   J merge-2048 aria-live 连续写入观察
 *
 * IDS=orb-arena,block-drop 可只跑其中几款。
 * 它连着 dev server 跑源码,点的是真按钮、按的是真键盘,不走任何测试后门。
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5186";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const NARROW = { width: 360, height: 640 };
const WIDE = { width: 1280, height: 800 };
const PARTS = (process.env.PART ?? "ACDEF").toUpperCase();
const ROOT_KEY = "yiduo-yixing.root.v1";
const PASSWORD = "kangkang";
const PHONE = "18438037080";

/** 第 2 轮换的样本关号(第 1 轮用的是 1 / 100 / 188) */
const SAMPLE_LEVELS = [2, 50, 150];
/** 字号硬下限,取自 src/ui/mobileText.ts 的 MIN_CONTROL_PX */
const MIN_CONTROL_PX = 14;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what, extra });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}
function note(what, extra = "") {
  console.log(`  ··    ${what}${extra ? ` — ${extra}` : ""}`);
}

// ---------------------------------------------------------------------------
// 12 款的操作配方
// ---------------------------------------------------------------------------

const GAMES = [
  {
    id: "orb-arena",
    title: "圆圆大作战",
    p: "oa",
    modes: { versus: "🤝 圆圆混战", endless: "♾️ 缩圈无尽", twoPlayer: "👫 双人同屏" },
    keys: ["KeyW", "KeyD", "KeyS", "KeyA", "KeyF", "KeyG"],
    clicks: [".oa-btn"],
    canvas: true
  },
  {
    id: "snake-royale",
    title: "长蛇争霸",
    p: "sr",
    modes: { versus: "🤝 原野混战", endless: "♾️ 缩圈无尽", twoPlayer: "👫 双人同屏" },
    keys: ["KeyW", "KeyD", "KeyS", "KeyA", "KeyF", "KeyG"],
    clicks: [".sr-btn"],
    canvas: true
  },
  {
    id: "block-drop",
    title: "方块叠叠乐",
    p: "bd",
    modes: { versus: "🤝 对战发行", endless: "♾️ 马拉松 / 竞速", twoPlayer: "👫 双人同屏" },
    keys: ["KeyA", "KeyD", "KeyW", "KeyS", "KeyF", "KeyG"],
    clicks: [".bd-btn"],
    canvas: true
  },
  {
    id: "combo-clash",
    title: "连招对决",
    p: "cc",
    modes: { versus: "🤝 人机对战", endless: "♾️ 连胜无尽", twoPlayer: "👫 双人同屏" },
    keys: ["KeyD", "KeyF", "KeyG", "KeyW", "KeyA", "KeyF", "KeyF"],
    clicks: [".cc-btn"],
    canvas: true
  },
  {
    id: "mahjong-bloom",
    title: "花开麻将",
    p: "mj",
    modes: { versus: "🀄 对战一桌", endless: "♾️ 快棋无尽", twoPlayer: "👫 双人同桌" },
    keys: ["KeyA", "KeyD", "KeyF"],
    clicks: [".mj-tile", ".mj-btn:not(.mj-ghost)"]
  },
  {
    id: "star-estate",
    title: "朵星地产",
    p: "se",
    modes: { versus: "🤝 对战 1v3", endless: "♾️ 短盘连胜", twoPlayer: "👫 双人同屏" },
    keys: ["KeyF", "KeyG", "KeyD"],
    clicks: [".se-btn"]
  },
  {
    id: "hero-cards",
    title: "英杰令",
    p: "hc",
    modes: { versus: "🤝 身份场 1v4", endless: "♾️ 连胜无尽" },
    keys: ["KeyA", "KeyD", "KeyF", "KeyG"],
    clicks: [".hc-card", ".hc-seat", ".hc-btn"]
  },
  {
    id: "weiqi-garden",
    title: "围子花园",
    p: "wq",
    modes: { versus: "🤖 自由对战", endless: "🔥 连胜无尽", twoPlayer: "👫 双人同屏" },
    keys: ["KeyD", "KeyS", "KeyF"],
    clicks: [],
    canvas: true
  },
  {
    id: "flight-chess",
    title: "飞行棋乐园",
    p: "fc",
    modes: { versus: "🤝 四人对战", endless: "♾️ 连胜无尽", twoPlayer: "👫 双人同屏" },
    keys: ["KeyF", "KeyD"],
    clicks: [".fc-btn-go", ".fc-pick", ".fc-token"]
  },
  {
    id: "merge-2048",
    title: "星星合成",
    p: "mg",
    modes: { versus: "🤝 对战竞速", endless: "♾️ 马拉松", twoPlayer: "👫 双人同屏" },
    keys: ["KeyA", "KeyW", "KeyD", "KeyS"],
    clicks: [],
    boardSel: ".mg-board"
  },
  {
    id: "mine-garden",
    title: "扫雷花园",
    p: "mg",
    modes: { versus: "🤖 竞速对战", endless: "🔥 连续清盘", twoPlayer: "👫 双人同屏" },
    keys: ["KeyD", "KeyS", "KeyF"],
    clicks: [".mg-cell"]
  },
  {
    id: "sudoku-petal",
    title: "数独花田",
    p: "sp",
    modes: { versus: "🤝 对战竞速", endless: "♾️ 花田马拉松", twoPlayer: "👫 双人同屏" },
    keys: ["KeyD", "KeyS", "Digit1", "Digit2", "Digit3", "KeyF"],
    clicks: [".sp-cell", ".sp-key"]
  }
];

const WANT_IDS = process.env.IDS ? process.env.IDS.split(",") : null;
const PICKED = WANT_IDS ? GAMES.filter((g) => WANT_IDS.includes(g.id)) : GAMES;

const P1_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG"];
const P2_KEYS = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "KeyL", "KeyK"];

// ---------------------------------------------------------------------------
// 页面小工具
// ---------------------------------------------------------------------------

async function overflowX(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    const bad = [...document.querySelectorAll("body *")].filter(
      (el) => el.getBoundingClientRect().right > d.clientWidth + 1 && getComputedStyle(el).position !== "fixed"
    );
    return { doc: d.scrollWidth - d.clientWidth, bad: bad.slice(0, 3).map((el) => String(el.className || el.tagName)) };
  });
}

/** 屏上所有看得见的文字节点里,字号最小的那几个(用来量 360px 字号下限) */
async function tinyText(page, floor = MIN_CONTROL_PX) {
  return page.evaluate((min) => {
    const bad = [];
    let smallest = 999;
    for (const el of document.querySelectorAll("body *")) {
      if (el.children.length > 0) continue;
      const t = (el.textContent ?? "").trim();
      if (!t) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      const px = Math.round(parseFloat(cs.fontSize) * 10) / 10;
      if (px < smallest) smallest = px;
      if (px < min - 0.05) bad.push(`${String(el.className || el.tagName).slice(0, 28)}=${px}px「${t.slice(0, 10)}」`);
    }
    return { smallest: smallest === 999 ? null : smallest, bad: bad.slice(0, 5), count: bad.length };
  }, floor);
}

async function verdict(page, p) {
  return page.evaluate((prefix) => {
    const shown = (el) => el && !el.closest("[hidden]") && el.getClientRects().length > 0;
    const sels = [".l99-ov-title", `.${prefix}-over-t`, "[class*='over-t']", "[class*='-ov-title']"];
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        if (!shown(el)) continue;
        const t = el.textContent?.trim() ?? "";
        if (t) return t;
      }
    }
    return "";
  }, p);
}

/**
 * 分边探针:一次采样返回一组「区域 → 摘要」,后面靠比对哪些区域变了来判断谁在动。
 *   canvas<i>.L / .R / .T / .B  画布左右半、上下半的像素摘要
 *   dom.L / dom.R               舞台左右半的叶子节点(类名 + 坐标 + 文字)
 *   hud.朵朵 / hud.星星          带这两个名字的那一行读数
 * 整屏指纹一概不用 —— 第 1 轮 mine-garden 就是栽在这上头。
 */
async function sideProbe(page) {
  return page.evaluate(() => {
    const hash = (s) => {
      let a = 5381;
      for (let i = 0; i < s.length; i++) a = ((a * 33) ^ s.charCodeAt(i)) >>> 0;
      return a.toString(36);
    };
    const out = {};
    const root = document.querySelector(".game-stage") ?? document.querySelector("#app") ?? document.body;

    // 1) 画布:左右半 + 上下半各自的像素摘要
    let ci = 0;
    for (const c of document.querySelectorAll("canvas")) {
      if (!c.width || !c.height) continue;
      let g = null;
      try {
        g = c.getContext("2d");
      } catch {
        g = null;
      }
      if (!g) continue;
      const w = c.width;
      const h = c.height;
      const boxes = {
        L: [0, 0, Math.floor(w / 2), h],
        R: [Math.ceil(w / 2), 0, w - Math.ceil(w / 2), h],
        T: [0, 0, w, Math.floor(h / 2)],
        B: [0, Math.ceil(h / 2), w, h - Math.ceil(h / 2)]
      };
      for (const [k, [x, y, ww, hh]] of Object.entries(boxes)) {
        if (ww < 2 || hh < 2) continue;
        let d;
        try {
          d = g.getImageData(x, y, ww, hh).data;
        } catch {
          continue;
        }
        let a = 5381;
        for (let i = 0; i < d.length; i += 37) a = ((a * 33) ^ d[i]) >>> 0;
        out[`canvas${ci}.${k}`] = a.toString(36);
      }
      ci += 1;
    }

    // 2) DOM 叶子按中心 x 分到左右两半
    const rr = root.getBoundingClientRect();
    const mid = rr.x + rr.width / 2;
    const buckets = { "dom.L": [], "dom.R": [] };
    for (const el of root.querySelectorAll("*")) {
      if (el.children.length > 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const key = r.x + r.width / 2 < mid ? "dom.L" : "dom.R";
      buckets[key].push(
        `${String(el.className || el.tagName).slice(0, 24)}@${Math.round(r.x)},${Math.round(r.y)}:${(el.textContent ?? "")
          .trim()
          .slice(0, 20)}`
      );
    }
    for (const [k, v] of Object.entries(buckets)) out[k] = `${v.length}/${hash(v.join("|"))}`;

    // 3) 朵朵 / 星星各自那一行读数(混战类共用一块场地,分不出左右,只能按名字分人)
    for (const who of ["朵朵", "星星"]) {
      const rows = [];
      for (const el of root.querySelectorAll("*")) {
        if (el.children.length > 0) continue;
        if (!(el.textContent ?? "").includes(who)) continue;
        const row = el.parentElement ?? el;
        rows.push((row.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 90));
      }
      if (rows.length > 0) out[`hud.${who}`] = hash(rows.join("¶"));
    }
    return out;
  });
}

function changedKeys(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = [];
  for (const k of keys) if (a[k] !== b[k]) out.push(k);
  return out.sort();
}

async function pressAll(page, keys, gap = 150) {
  for (const k of keys) {
    await page.keyboard.press(k).catch(() => {});
    await sleep(gap);
  }
}

/** 模式页开局:一层层点 `.<前缀>-open`,躲开「回闯关 / 换难度」这类返回键 */
async function pickThrough(page, prefix, maxDepth = 4) {
  let picked = 0;
  for (let i = 0; i < maxDepth; i++) {
    const hit = await page.evaluate((p) => {
      const back = /回闯关|换难度|返回|选关|攻略|暂停|←|◀/;
      const btns = [...document.querySelectorAll(`.${p}-open, .${p}-btn-sm, .${p}-pick`)].filter(
        (b) => !b.closest("[hidden]") && b.getClientRects().length > 0 && !b.disabled && !back.test(b.textContent ?? "")
      );
      if (btns.length === 0) return false;
      const go = btns.find((b) => /开始|开局|▶/.test(b.textContent ?? ""));
      (go ?? btns[0]).click();
      return true;
    }, prefix);
    if (!hit) break;
    picked += 1;
    await sleep(600);
  }
  return picked;
}

/** 把 188 关存档铺到第 n 关可玩,再整页重载进这一关 */
async function openLevel(page, id, n, total = 188) {
  const target = Math.min(Math.max(1, n), total);
  await page.evaluate(
    ([key, t, len]) => {
      localStorage.setItem(key, JSON.stringify(Array.from({ length: len }, (_, i) => (i < t - 1 ? 3 : 0))));
    },
    [`yiduo-yixing.l99.${id}`, target, total]
  );
  await page.goto(`${BASE}/?t=${Date.now()}#/game/${id}`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".l99-continue", { timeout: 20000 });
  await page.click(".l99-continue");
  await page.waitForSelector(".l99-stagetitle", { timeout: 15000 });
  await sleep(700);
  return page.$eval(".l99-stagetitle", (el) => el.textContent ?? "").catch(() => "");
}

async function enterMode(page, g, label) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/${g.id}`, { waitUntil: "networkidle0" });
  await page.waitForSelector(`.${g.p}-modebar .${g.p}-open`, { timeout: 20000 });
  const clicked = await page.evaluate(
    ([sel, t]) => {
      const b = [...document.querySelectorAll(sel)].find((x) => (x.textContent ?? "").includes(t));
      if (!b) return false;
      b.click();
      return true;
    },
    [`.${g.p}-modebar .${g.p}-open`, label]
  );
  if (!clicked) return { ok: false, picks: 0 };
  await sleep(600);
  const picks = await pickThrough(page, g.p);
  await sleep(800);
  return { ok: true, picks };
}

async function drewNodes(page, prefix) {
  return page.evaluate(
    (p) => document.querySelectorAll(`canvas, [class^='${p}-'], [class*=' ${p}-']`).length,
    prefix
  );
}

/** 「玩一会儿」:按配方按键 + 点舞台里能点的东西,直到结算浮层出现或预算用完 */
async function drive(page, g, { budgetMs = 26000, mode = "play" } = {}) {
  const t0 = Date.now();
  let acts = 0;
  let k = 0;
  while (Date.now() - t0 < budgetMs) {
    const v = await verdict(page, g.p);
    if (v) return { v, acts, ms: Date.now() - t0 };
    if (mode === "idle") {
      await sleep(700);
      continue;
    }
    await page.keyboard.press(g.keys[k % g.keys.length]).catch(() => {});
    k += 1;
    acts += 1;
    if (g.clicks.length > 0) {
      await page
        .evaluate(
          ([sels, prefix, seed]) => {
            const bad = /返回|选关|攻略|暂停|跳过|🎵|模式|Esc|换难度|回闯关/;
            const pool = [];
            for (const s of sels) {
              for (const el of document.querySelectorAll(s)) {
                if (el.disabled) continue;
                if (el.className && String(el.className).includes(`${prefix}-open`)) continue;
                if (bad.test(el.textContent ?? "")) continue;
                const r = el.getBoundingClientRect();
                if (r.width < 4 || r.height < 4) continue;
                pool.push(el);
              }
            }
            if (pool.length === 0) return false;
            pool[seed % pool.length].click();
            return true;
          },
          [g.clicks, g.p, acts * 7 + 3]
        )
        .catch(() => {});
    }
    if (g.canvas || g.boardSel) {
      const sel = g.boardSel ?? "canvas";
      const box = await page
        .$eval(sel, (el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        })
        .catch(() => null);
      if (box && box.w > 8) {
        const fx = ((acts * 37) % 80) / 100 + 0.1;
        const fy = ((acts * 53) % 80) / 100 + 0.1;
        await page.mouse.move(box.x + box.w * fx, box.y + box.h * fy).catch(() => {});
        await page.mouse.click(box.x + box.w * fx, box.y + box.h * fy).catch(() => {});
      }
    }
    await sleep(140);
  }
  return { v: await verdict(page, g.p), acts, ms: Date.now() - t0 };
}

/** 泄漏计数器 + 可选的「把 Math.random 钉死」,都要赶在页面脚本之前挂上 */
async function preparePage(page, { pinSeed = null } = {}) {
  await page.evaluateOnNewDocument((seed) => {
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
    if (seed !== null) {
      // 固定 seed:同一个 seed 每次跑出同一局,W1-10 / W1-11 靠它复现
      let s = seed >>> 0;
      Math.random = () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      w.__pinnedSeed = seed;
    }
  }, pinSeed);
}

async function newPage(browser, viewport, opts = {}) {
  const page = await browser.newPage();
  await page.setViewport({
    ...viewport,
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 500,
    deviceScaleFactor: 1
  });
  await preparePage(page, opts);
  return page;
}

// ---------------------------------------------------------------------------
// A. 平台五项 + 首页
// ---------------------------------------------------------------------------

async function partA(browser) {
  console.log("\n===== A. 平台五项 + 首页(360×640) =====");
  const page = await newPage(browser, NARROW);
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await sleep(1300);

  // --- 首页清点 ---
  const titles = await page.$$eval(".card-title", (e) => e.map((x) => x.textContent?.trim() ?? ""));
  const missing = GAMES.filter((g) => !titles.includes(g.title)).map((g) => g.title);
  log(missing.length === 0, `12 款卡片靠 import.meta.glob 全部自动冒出来(全库 ${titles.length} 张)`, missing.join(","));

  // --- 首页搜索框在 360px 不被顶出 + 16px 字号下限 ---
  const box = await page.evaluate(() => {
    const el = document.querySelector(".home-search-input");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { x: r.x, right: r.right, w: r.width, font: parseFloat(cs.fontSize), vw: document.documentElement.clientWidth };
  });
  log(
    box !== null && box.x >= -1 && box.right <= box.vw + 1 && box.w > 80,
    "首页搜索框整条在 360px 屏里,没被顶出去",
    box ? `x=${Math.round(box.x)} right=${Math.round(box.right)} 宽=${Math.round(box.w)} 视口=${box.vw}` : "没找到搜索框"
  );
  log(box !== null && box.font >= 16, "首页搜索框字号 ≥ 16px(iOS 聚焦不自动放大)", box ? `${box.font}px` : "");
  const homeTiny = await tinyText(page);
  log(
    homeTiny.count === 0,
    `入口屏字号下限 ${MIN_CONTROL_PX}px 仍在`,
    `最小 ${homeTiny.smallest}px${homeTiny.count ? " · 越线 " + homeTiny.count + " 处:" + homeTiny.bad.join(" ") : ""}`
  );
  const homeFlow = await overflowX(page);
  log(homeFlow.doc <= 1, "首页 360px 不横向溢出", `doc+${homeFlow.doc}`);

  // --- 拼音:12 款标题 + 全库首字母 ---
  const pinyin = await page.evaluate(async () => {
    const L = await import("/src/engine/loader.ts");
    const F = await import("/src/ui/homeFilters.ts");
    const games = L.loadGames();
    const rows = games.map((g) => {
      const title = g.meta.title;
      const han = [...title].filter((c) => /[\u4e00-\u9fa5]/.test(c)).length;
      const initials = F.pinyinInitials(title);
      return { id: g.meta.id, title, han, initials, ok: initials.length >= han };
    });
    return { total: games.length, rows };
  });
  const twelve = pinyin.rows.filter((r) => GAMES.some((g) => g.id === r.id));
  const badTwelve = twelve.filter((r) => !r.ok);
  log(
    badTwelve.length === 0,
    "W1-02 复核 · 12 款标题的拼音首字母一个不缺",
    badTwelve.map((r) => `${r.title}→"${r.initials}"`).join(" ")
  );
  const badAll = pinyin.rows.filter((r) => !r.ok);
  log(
    badAll.length === 0,
    `W1-02 复核 · 全库 ${pinyin.total} 款标题用字都进了 PINYIN_INITIALS`,
    badAll.map((r) => `${r.title}→"${r.initials}"`).join(" ")
  );
  // 真在搜索框里敲首字母
  for (const r of twelve) {
    const hit = await page.evaluate(
      async ([q, want]) => {
        const el = document.querySelector(".home-search-input");
        if (!el) return "没有搜索框";
        el.value = q;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise((res) => setTimeout(res, 260));
        const list = [...document.querySelectorAll(".card-title")].map((e) => e.textContent?.trim() ?? "");
        return list.includes(want) ? `${list.length} 张里有它` : `${list.length} 张里没有它`;
      },
      [r.initials, r.title]
    );
    log(hit.includes("有它"), `搜「${r.initials}」找得到「${r.title}」`, hit);
  }
  await page.evaluate(() => {
    const el = document.querySelector(".home-search-input");
    if (el) {
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await sleep(300);

  // --- 平台芯片 ---
  const chips = await page.$$eval(".platform-chips .tab", (e) => e.map((x) => x.textContent?.trim() ?? ""));
  log(chips.length === 3, "平台芯片「全部 / 手游 / 端游」三颗都在", chips.join(" "));
  const filt = await page.evaluate(async () => {
    const F = await import("/src/ui/homeFilters.ts");
    return {
      dirty: [{}, { platform: "both" }, { platform: "脏值" }, { platform: undefined }].map((m) => [
        F.matchesPlatformChip(m, "mobile"),
        F.matchesPlatformChip(m, "desktop")
      ]),
      mob: [F.matchesPlatformChip({ platform: "mobile" }, "mobile"), F.matchesPlatformChip({ platform: "mobile" }, "desktop")],
      desk: [F.matchesPlatformChip({ platform: "desktop" }, "mobile"), F.matchesPlatformChip({ platform: "desktop" }, "desktop")]
    };
  });
  log(filt.dirty.every(([a, b]) => a && b), "缺省 / both / 脏值一律当两边都顺手", JSON.stringify(filt.dirty));
  log(filt.mob[0] && !filt.mob[1] && !filt.desk[0] && filt.desk[1], "只写 mobile / desktop 的 meta 只落一边");

  // --- root 门 ---
  console.log("\n----- root 管理员门 -----");
  const openGate = async () => {
    await page.evaluate(() => document.querySelector(".icon-btn--admin")?.click());
    await page.waitForSelector(".rootgate", { timeout: 8000 });
    await sleep(220);
  };
  log(await page.evaluate(() => Boolean(document.querySelector(".icon-btn--admin"))), "首页有管理员入口 🔑");
  await openGate();
  const gateText = await page.$eval(".rootgate", (el) => el.textContent ?? "");
  log(gateText.includes(`要打开请联系管理员 ${PHONE}`), `弹窗原样出现「要打开请联系管理员 ${PHONE}」`);
  log(await page.$eval(".rootgate-input", (el) => el.type === "password"), "密码框是 password 类型");
  const gateFlow = await overflowX(page);
  log(gateFlow.doc <= 1, "管理员弹窗 360px 不溢出", `doc+${gateFlow.doc}`);
  const gateTiny = await tinyText(page);
  log(gateTiny.count === 0, `管理员弹窗字号下限 ${MIN_CONTROL_PX}px 仍在`, `最小 ${gateTiny.smallest}px ${gateTiny.bad.join(" ")}`);

  // 真敲密码
  await page.click(".rootgate-input");
  await page.type(".rootgate-input", PASSWORD);
  await page.keyboard.press("Enter");
  await sleep(420);
  const store = await page.evaluate((key) => {
    const all = {};
    for (let i = 0; i < localStorage.length; i++) all[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
    const ss = {};
    for (let i = 0; i < sessionStorage.length; i++) ss[sessionStorage.key(i)] = sessionStorage.getItem(sessionStorage.key(i));
    return { all, ss, raw: localStorage.getItem(key), cookie: document.cookie, href: location.href };
  }, ROOT_KEY);
  let parsed = null;
  try {
    parsed = JSON.parse(store.raw ?? "null");
  } catch {
    parsed = null;
  }
  log(parsed !== null && typeof parsed.expiresAt === "number", `密码 ${PASSWORD} 能开门,只写 ${ROOT_KEY}`, store.raw ?? "(空)");
  log(parsed !== null && Object.keys(parsed).length === 1, "存档里只有 expiresAt 一个字段", JSON.stringify(parsed));
  const ttl = parsed ? parsed.expiresAt - Date.now() : 0;
  log(ttl > 59 * 60 * 1000 && ttl <= 60 * 60 * 1000 + 5000, "TTL 正好一小时", `${Math.round(ttl / 60000)} 分钟`);
  const dump = JSON.stringify(store.all) + JSON.stringify(store.ss) + store.cookie + store.href;
  log(!dump.includes(PASSWORD), "密码绝不落盘:localStorage / sessionStorage / cookie / URL 全搜不到");
  log(
    await page.evaluate(() => (document.querySelector(".rootgate-input")?.value ?? "") === ""),
    "弹窗里的输入框当场抹空,DOM 里也不留密码"
  );
  // 假时钟推 TTL
  const clock = await page.evaluate(async () => {
    const C = await import("/src/ui/root12Contract.ts");
    const now = Date.now();
    return {
      before: C.isRootOpen(now + 59 * 60 * 1000),
      after: C.isRootOpen(now + 60 * 60 * 1000 + 1000),
      cleaned: localStorage.getItem("yiduo-yixing.root.v1")
    };
  });
  log(clock.before && !clock.after && clock.cleaned === null, "假时钟推到 1 小时后自动关门并清档", JSON.stringify(clock));
  // closeRoot()
  const closed = await page.evaluate(async () => {
    const R = await import("/src/ui/rootGate.ts");
    const C = await import("/src/ui/root12Contract.ts");
    R.submitRootPassword("kangkang", Date.now());
    const openBefore = C.isRootOpen(Date.now());
    R.closeRoot();
    return { openBefore, openAfter: C.isRootOpen(Date.now()), raw: localStorage.getItem("yiduo-yixing.root.v1") };
  });
  log(closed.openBefore && !closed.openAfter && closed.raw === null, "closeRoot() 一调就关门,存档当场消失", JSON.stringify(closed));

  // --- 家长算术门原样保留 ---
  const parent = await page.evaluate(async () => {
    const P = await import("/src/ui/parentAuth.ts");
    const q = P.makeQuestion("basic", () => 0.42);
    return {
      text: q.text,
      right: P.checkAnswer(q, String(q.answer)),
      wrong: !P.checkAnswer(q, String(q.answer + 1)),
      ttl: P.AUTH_TTL_MS,
      maxWrong: P.MAX_WRONG,
      lock: P.LOCK_MS,
      highNeed: P.HIGH_NEED_CORRECT
    };
  });
  log(parent.right && parent.wrong, "家长算术门还在出题,答对放行答错拦下", parent.text);
  log(
    parent.ttl === 300000 && parent.maxWrong === 2 && parent.lock === 90000 && parent.highNeed === 2,
    "家长门四个参数一个没动(5 分钟 / 错 2 次 / 锁 90 秒 / 高权限 2 题)",
    JSON.stringify(parent)
  );

  // --- 直达第 N 关:这一轮改抽 2 / 50 / 150 ---
  console.log("\n----- 直达第 N 关(样本 2 / 50 / 150) -----");
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/?t=${Date.now()}#/game/sudoku-petal`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".l99-map", { timeout: 15000 });
  await sleep(400);
  log(
    (await page.$$eval(".l99-jump", (e) => e.length)) === 0,
    "门关着时直达控件连 DOM 都不生成"
  );
  await page.evaluate(async () => {
    const R = await import("/src/ui/rootGate.ts");
    R.submitRootPassword("kangkang", Date.now());
  });
  await page.goto(`${BASE}/?t=${Date.now()}#/game/sudoku-petal`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".l99-map", { timeout: 15000 });
  await sleep(400);
  log((await page.$$eval(".l99-jump", (e) => e.length)) === 1, "门开着时直达控件出现在选关页");
  for (const n of SAMPLE_LEVELS) {
    await page.evaluate(() => document.querySelector(".l99-back")?.click());
    await sleep(320);
    await page.waitForSelector(".l99-jump-input", { timeout: 8000 }).catch(() => {});
    await page.evaluate((t) => {
      const el = document.querySelector(".l99-jump-input");
      el.value = String(t);
      [...document.querySelectorAll(".l99-jump .l99-tool")].find((b) => b.textContent?.includes("直达"))?.click();
    }, n);
    await sleep(1000);
    const title = await page.$eval(".l99-stagetitle", (el) => el.textContent ?? "").catch(() => "");
    const cells = await page.$$eval(".sp-cell", (e) => e.length).catch(() => 0);
    log(new RegExp(`第\\s*${n}\\s*关`).test(title) && cells > 0, `直达第 ${n} 关,盘面真的画出来`, `${title.trim()} · ${cells} 格`);
  }
  const stars = await page.evaluate(() => JSON.parse(localStorage.getItem("yiduo-yixing.l99.sudoku-petal") ?? "[]"));
  log(
    (stars[149] ?? 0) === 0 && (stars[49] ?? 0) === 0 && (stars[1] ?? 0) === 0,
    "直达 2 / 50 / 150 一颗星都不发",
    `第2关=${stars[1] ?? 0} 第50关=${stars[49] ?? 0} 第150关=${stars[149] ?? 0}`
  );
  const clamp = await page.evaluate(async () => {
    const C = await import("/src/ui/root12Contract.ts");
    return {
      big: C.clampJumpTarget("999", 188),
      zero: C.clampJumpTarget("0", 188),
      neg: C.clampJumpTarget("-5", 188),
      abc: C.clampJumpTarget("abc", 188),
      frac: C.clampJumpTarget("149.6", 188)
    };
  });
  log(
    clamp.big === 188 && clamp.zero === 1 && clamp.neg === 1 && clamp.abc === null && clamp.frac === 150,
    "越界 / 乱输一律夹到 1–188",
    JSON.stringify(clamp)
  );

  // --- 2.5D 禁 three.js ---
  const three = await page.evaluate(() => ({
    global: Boolean(window.THREE),
    scripts: [...document.querySelectorAll("script[src]")].filter((s) => /three/i.test(s.src)).length
  }));
  log(!three.global && three.scripts === 0, "页面里没有 three.js", JSON.stringify(three));
  const v25 = await page.evaluate(async () => {
    const V = await import("/src/engine/view25d.ts");
    const cam = V.defaultCamera("perspective");
    return {
      near: V.project(cam, 0, 0, 1, 360, 640).scale,
      far: V.project(cam, 0, 0, 40, 360, 640).scale,
      flat: V.project(V.defaultCamera("flat"), 10, 0, 40, 360, 640).scale,
      horizon: V.horizonY(cam, 640),
      finite: [
        V.project(cam, 0, 0, NaN, 360, 640),
        V.project({ ...cam, fov: 0 }, 0, 0, 5, 0, 0)
      ].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.scale))
    };
  });
  log(v25.near > v25.far, "自写透视越远缩得越小", `z=1→${v25.near.toFixed(3)} z=40→${v25.far.toFixed(3)}`);
  log(v25.flat === 1 && v25.horizon > 0 && v25.horizon < 640 && v25.finite, "flat 档正交 + 地平线在画面里 + 脏输入不炸");

  await page.close();
}

// ---------------------------------------------------------------------------
// C / D. 12 款 × 四模式矩阵
// ---------------------------------------------------------------------------

async function partMatrix(browser, viewport, tag, { checkLeak = true, checkFont = true } = {}) {
  console.log(`\n===== ${tag}. 12 款 × 四模式矩阵(${viewport.width}×${viewport.height}) =====`);
  for (const g of PICKED) {
    console.log(`\n----- ${g.title}(${g.id}) -----`);
    const page = await newPage(browser, viewport);
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
    });

    await page.goto(`${BASE}/?t=${Date.now()}`, { waitUntil: "networkidle0" });
    await sleep(900);
    const baseLeak = await page.evaluate(() => ({ ...window.__leak }));

    // 从首页点卡片进去
    const entered = await page.evaluate((title) => {
      const card = [...document.querySelectorAll(".game-card")].find(
        (c) => c.querySelector(".card-title")?.textContent?.trim() === title
      );
      if (!card) return false;
      card.click();
      return true;
    }, g.title);
    const mounted = await page
      .waitForSelector(`.${g.p}-modebar, .${g.p}-wrap, .l99-wrap`, { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    log(entered && mounted, "从首页点卡片就能进去");

    // 模式条按 meta.modes 列齐
    const bar = await page
      .$$eval(`.${g.p}-modebar .${g.p}-open`, (els) => els.map((e) => e.textContent?.trim() ?? ""))
      .catch(() => []);
    const wantLabels = Object.values(g.modes);
    log(wantLabels.every((m) => bar.includes(m)), `模式入口齐:${wantLabels.join(" / ")}`, bar.join(" | "));

    // 闯关:第 2 / 50 / 150 关
    for (const n of SAMPLE_LEVELS) {
      const title = await openLevel(page, g.id, n);
      const drew = await page.evaluate(
        (p) => {
          const stage = document.querySelector(".l99-stage");
          if (!stage) return 0;
          return stage.querySelectorAll(`canvas, [class^='${p}-'], [class*=' ${p}-']`).length;
        },
        g.p
      );
      const flow = await overflowX(page);
      const okLevel = new RegExp(`第\\s*${n}\\s*关`).test(title) && drew > 0 && flow.doc <= 1;
      log(okLevel, `闯关第 ${n} 关:进得去、画得出、不横向溢出`, `${title.trim()} · ${drew} 个节点 · doc+${flow.doc}${flow.doc > 1 ? " " + flow.bad : ""}`);
      if (checkFont && n === SAMPLE_LEVELS[0]) {
        const t = await tinyText(page);
        log(t.count === 0, `闯关第 ${n} 关字号下限 ${MIN_CONTROL_PX}px`, `最小 ${t.smallest}px ${t.bad.join(" ")}`);
      }
    }

    // 对战 / 无尽 / 双人:进得去 + 画得出 + 不溢出 + 二级界面字号
    for (const [kind, label] of Object.entries(g.modes)) {
      const r = await enterMode(page, g, label);
      const drew = await drewNodes(page, g.p);
      const flow = await overflowX(page);
      log(
        r.ok && drew > 5 && flow.doc <= 1,
        `${kind} ${label}:进得去、画得出、不横向溢出`,
        `选了 ${r.picks} 层 · ${drew} 个节点 · doc+${flow.doc}${flow.doc > 1 ? " " + flow.bad : ""}`
      );
      if (checkFont) {
        const t = await tinyText(page);
        log(t.count === 0, `${kind} 二级界面字号下限 ${MIN_CONTROL_PX}px`, `最小 ${t.smallest}px ${t.bad.join(" ")}`);
      }
    }

    if (checkLeak) {
      await page.evaluate(() => {
        location.hash = "";
      });
      await sleep(1600);
      const endLeak = await page.evaluate(() => ({ ...window.__leak }));
      const leak =
        endLeak.listeners - baseLeak.listeners > 0 ||
        endLeak.intervals - baseLeak.intervals > 0 ||
        endLeak.frames - baseLeak.frames > 0;
      log(!leak, "退出后监听 / 定时器 / rAF 都还回去了", `${JSON.stringify(baseLeak)} → ${JSON.stringify(endLeak)}`);
      const remount = await page
        .evaluate((title) => {
          const card = [...document.querySelectorAll(".game-card")].find(
            (c) => c.querySelector(".card-title")?.textContent?.trim() === title
          );
          if (!card) return false;
          card.click();
          return true;
        }, g.title)
        .then(() => page.waitForSelector(`.${g.p}-modebar, .${g.p}-wrap, .l99-wrap`, { timeout: 15000 }))
        .then(() => true)
        .catch(() => false);
      log(remount, "退出再进还能正常挂起来");
    }

    log(errors.length === 0, "这一款全程没有 pageerror / console.error", errors.slice(0, 2).join(" ; "));
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// E. 双人键位分边取证
// ---------------------------------------------------------------------------

async function partE(browser) {
  console.log("\n===== E. 双人键位分边取证(360×640) =====");
  for (const g of PICKED) {
    const label = g.modes.twoPlayer;
    if (!label) {
      log(true, `${g.title}:meta 里就没有 twoPlayer(身份场两个人挤一屏会互相看光牌),跳过`);
      continue;
    }
    const page = await newPage(browser, NARROW);
    const r = await enterMode(page, g, label);
    if (!r.ok) {
      log(false, `${g.title} 双人:进不去 ${label}`);
      await page.close();
      continue;
    }
    // 1) 空跑基线:一根手指都不动,看哪些区域自己就会变(动画、倒计时、AI)
    const s0 = await sideProbe(page);
    await sleep(P1_KEYS.length * 150);
    const sIdle = await sideProbe(page);
    const idle = new Set(changedKeys(s0, sIdle));

    // 2) 朵朵 WASD+F+G
    const before1 = await sideProbe(page);
    await pressAll(page, P1_KEYS);
    const after1 = await sideProbe(page);
    const byP1 = changedKeys(before1, after1).filter((k) => !idle.has(k));

    // 3) 星星 方向键+L+K
    const before2 = await sideProbe(page);
    await pressAll(page, P2_KEYS);
    const after2 = await sideProbe(page);
    const byP2 = changedKeys(before2, after2).filter((k) => !idle.has(k));

    const onlyP1 = byP1.filter((k) => !byP2.includes(k));
    const onlyP2 = byP2.filter((k) => !byP1.includes(k));
    log(byP1.length > 0, `${g.title} 双人:朵朵 WASD+F+G 有反应`, `动了 ${byP1.join(",") || "(无)"}`);
    log(byP2.length > 0, `${g.title} 双人:星星 方向键+L+K 有反应`, `动了 ${byP2.join(",") || "(无)"}`);
    log(
      onlyP1.length > 0 || onlyP2.length > 0,
      `${g.title} 双人:两套键位管的不是同一块地方(分边可辨)`,
      `只认朵朵=${onlyP1.join(",") || "-"} · 只认星星=${onlyP2.join(",") || "-"}`
    );
    note(`空跑基线自己就会变的区域:${[...idle].join(",") || "(无,画面是静止的)"}`);
    const flow = await overflowX(page);
    log(flow.doc <= 1, `${g.title} 双人:360px 不横向溢出`, `doc+${flow.doc}`);
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// F. W1-01 Esc 双暂停回归复核
// ---------------------------------------------------------------------------

async function partF(browser) {
  console.log("\n===== F. W1-01 Esc 双暂停回归复核(样本关 50) =====");
  const ids = ["orb-arena", "snake-royale", "block-drop", "combo-clash", "merge-2048"];
  for (const g of GAMES.filter((x) => ids.includes(x.id))) {
    const page = await newPage(browser, NARROW);
    await page.goto(BASE, { waitUntil: "networkidle0" });
    await openLevel(page, g.id, 50);
    await page.keyboard.press("KeyD").catch(() => {});
    await sleep(900);

    const alive = async () => {
      const a = await sideProbe(page);
      await sleep(800);
      const b = await sideProbe(page);
      if (changedKeys(a, b).length > 0) return true;
      // 回合制的款开局本来就静止:按几下方向键看盘面动不动
      const c = await sideProbe(page);
      await pressAll(page, g.keys.slice(0, 4), 160);
      const d = await sideProbe(page);
      return changedKeys(c, d).length > 0;
    };

    const liveBefore = await alive();
    await page.keyboard.press("Escape");
    await sleep(750);
    const paused = await page.evaluate(() => /暂停|先歇/.test(document.querySelector(".game-stage")?.textContent ?? ""));
    const shellDlg = await page.evaluate(() => document.querySelectorAll(".dialog, .dlg").length);
    await page.keyboard.press("Escape");
    await sleep(750);
    const liveAfter = await alive();
    log(
      liveBefore && paused && liveAfter,
      `W1-01 复核 · ${g.title}(第 50 关):Esc 暂停后再按一次能接着玩`,
      `开局在动=${liveBefore} · 暂停提示=${paused}(壳层面板 ${shellDlg} 个) · 恢复后在动=${liveAfter}`
    );
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// G. W1-10 围子花园自由对战 · 固定 seed
// ---------------------------------------------------------------------------

async function partG(browser) {
  console.log("\n===== G. W1-10 围子花园自由对战 · 固定 seed 复现 =====");
  const POINTS = [
    [2, 2],
    [6, 6],
    [2, 6]
  ];
  const rows = [];
  for (const seed of [1, 7, 20240601, 424242, 987654321]) {
    const page = await newPage(browser, NARROW, { pinSeed: seed });
    await page.goto(`${BASE}/?t=${Date.now()}#/game/weiqi-garden`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".wq-modebar .wq-open", { timeout: 20000 });
    const clickBtn = async (t) => {
      const ok = await page.evaluate((txt) => {
        const b = [...document.querySelectorAll(".wq-modebar .wq-open, .wq-btn, .wq-open")].find((x) =>
          (x.textContent ?? "").includes(txt)
        );
        if (!b) return false;
        b.click();
        return true;
      }, t);
      await sleep(400);
      return ok;
    };
    await clickBtn("自由对战");
    await clickBtn("九路花园");
    await clickBtn("地狱");
    await clickBtn("开始");
    await page.waitForSelector(".wq-canvas", { timeout: 15000 }).catch(() => {});
    await sleep(500);

    const moves = () =>
      page.evaluate(() => {
        const txt = [...document.querySelectorAll(".wq-hud")].map((el) => el.textContent ?? "").join(" ");
        const m = /第 (\d+) 手/.exec(txt);
        return m ? Number(m[1]) : -1;
      });
    const clickPoint = async (gx, gy) => {
      const xy = await page.evaluate(
        ([x, y]) => {
          const c = document.querySelector(".wq-canvas");
          if (!c) return null;
          const r = c.getBoundingClientRect();
          const cell = r.width / 9.4;
          const pad = cell * 0.7;
          return { x: r.x + pad + x * cell, y: r.y + pad + y * cell };
        },
        [gx, gy]
      );
      if (!xy) return false;
      await page.mouse.click(xy.x, xy.y);
      return true;
    };

    const trace = [];
    let played = await moves();
    const started = played;
    for (const [gx, gy] of POINTS) {
      const before = await moves();
      await clickPoint(gx, gy);
      // 先看我这一手落没落下去(+1),再看 AI 回没回(+2)
      const mine = await page
        .waitForFunction(
          (n) => {
            const txt = [...document.querySelectorAll(".wq-hud")].map((el) => el.textContent ?? "").join(" ");
            const m = /第 (\d+) 手/.exec(txt);
            return m ? Number(m[1]) >= n : false;
          },
          { timeout: 1500 },
          before + 1
        )
        .then(() => true)
        .catch(() => false);
      const reply = mine
        ? await page
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
            .catch(() => false)
        : false;
      trace.push({ pt: `${gx},${gy}`, 我落子: mine, AI回应: reply });
      played = await moves();
      await sleep(150);
    }
    const myFails = trace.filter((t) => !t.我落子).length;
    const aiFails = trace.filter((t) => t.我落子 && !t.AI回应).length;
    rows.push({ seed, started, played, trace, myFails, aiFails });
    note(
      `seed=${seed}:开局 ${started} 手 → ${played} 手`,
      trace.map((t) => `${t.pt}[我${t.我落子 ? "✓" : "✗"}/AI${t.AI回应 ? "✓" : "✗"}]`).join(" ")
    );
    await page.close();
  }
  const anyAiFail = rows.some((r) => r.aiFails > 0);
  const anyMyFail = rows.some((r) => r.myFails > 0);
  log(!anyAiFail, "W1-10 判定 · 只要我这一手落得下去,AI 每次都在 4s 内回应", `AI 缺回合的 seed 数=${rows.filter((r) => r.aiFails > 0).length}/${rows.length}`);
  note(
    "W1-10 结论线索",
    anyMyFail
      ? `有 ${rows.filter((r) => r.myFails > 0).length}/${rows.length} 个 seed 里脚本挑的固定点已被占(自己那一手就没落下去)→ 指向脚本挑点`
      : "五个 seed 下三手全部落得下去,step4-b 的失败复现不出来"
  );
  const reproduced = rows.filter((r) => r.played < r.started + 6).length;
  log(
    true,
    `W1-10 复现率:${reproduced}/${rows.length} 个固定 seed 下「连下三手」不足 6 手`,
    rows.map((r) => `${r.seed}:${r.started}→${r.played}`).join(" ")
  );
}

// ---------------------------------------------------------------------------
// H. W1-11 飞行棋 375×667 四色上环线 · 固定 seed
// ---------------------------------------------------------------------------

async function partH(browser) {
  console.log("\n===== H. W1-11 飞行棋 375×667 四色上环线 · 固定 seed 复现 =====");
  // 先用纯函数算一遍:同一个 seed 的骰子流里,前 N 掷能开出几架
  const probe = await (async () => {
    const page = await newPage(browser, { width: 375, height: 667 });
    await page.goto(BASE, { waitUntil: "networkidle0" });
    const out = await page.evaluate(async () => {
      const D = await import("/src/games/flight-chess/dice.ts");
      const rows = [];
      for (const seed of [1, 7, 20240611, 424242, 987654321, 13, 99, 2026]) {
        const seq = D.rollSeq(seed, 80);
        // 四人轮流,座位 i 拿到的是第 i, i+4, i+8 … 掷
        const sixes = [0, 1, 2, 3].map((i) => seq.filter((_, k) => k % 4 === i).filter((v) => v === 6).length);
        rows.push({ seed, sixes, total: sixes.reduce((a, b) => a + b, 0), 有座位掷不出6: sixes.some((n) => n === 0) });
      }
      return rows;
    });
    await page.close();
    return out;
  })();
  for (const r of probe) note(`seed=${r.seed} 前 80 掷里四座各得 6 的次数 ${JSON.stringify(r.sixes)}`, `合计 ${r.total}`);
  log(
    probe.every((r) => !r.有座位掷不出6),
    "骰子流本身不偏心:固定 seed 下前 80 掷四个座位都掷得出 6",
    `掷不出的 seed 数=${probe.filter((r) => r.有座位掷不出6).length}/${probe.length}`
  );

  // 再真跑一遍 375×667 的四人对战,把 Math.random 钉死
  const runs = [];
  for (const seed of [1, 20240611, 987654321]) {
    const page = await newPage(browser, { width: 375, height: 667 }, { pinSeed: seed });
    await page.goto(`${BASE}/?t=${Date.now()}#/game/flight-chess`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".fc-modebar", { timeout: 20000 });
    await page.evaluate(() => {
      [...document.querySelectorAll(".fc-open")].find((b) => (b.textContent ?? "").includes("四人对战"))?.click();
    });
    await sleep(500);
    await page.evaluate(() => document.querySelector(".fc-btn-sm")?.click());
    const ok = await page
      .waitForSelector(".fc-board", { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    if (!ok) {
      log(false, `W1-11 · seed=${seed} 四人对战开不起来`);
      await page.close();
      continue;
    }
    const rollsOf = () =>
      page.evaluate(() => {
        const t = [...document.querySelectorAll(".fc-top .fc-badge")].map((e) => e.textContent ?? "").join(" ");
        return Number(/已掷\s*(\d+)/.exec(t)?.[1] ?? -1);
      });
    const onRing = () =>
      page.evaluate(() => {
        const all = [...document.querySelectorAll(".fc-token")].map((n) => n.getAttribute("aria-label") ?? "");
        return { out: all.filter((t) => !t.includes("基地")).length, total: all.length };
      });
    const r0 = await rollsOf();
    const t0 = Date.now();
    while (Date.now() - t0 < 90000) {
      await page.evaluate(() => {
        const b = document.querySelector(".fc-btn-go:not([disabled])") ?? document.querySelector(".fc-pick:not([disabled])");
        b?.click();
      });
      await sleep(260);
    }
    const r1 = await rollsOf();
    const ring = await onRing();
    runs.push({ seed, rolls: `${r0}→${r1}`, ...ring });
    note(`seed=${seed} · 375×667 四人对战 90s`, `已掷 ${r0}→${r1} · ${ring.out}/${ring.total} 架在路上`);
    await page.close();
  }
  const hit = runs.filter((r) => r.out >= 4).length;
  log(
    true,
    `W1-11 复现:固定 seed 三次里有 ${hit}/${runs.length} 次达到 step4-c 的「≥4 架在路上」阈值`,
    runs.map((r) => `${r.seed}:${r.out}/${r.total}(掷 ${r.rolls})`).join(" ")
  );
}

// ---------------------------------------------------------------------------
// I. W1-12 六款过关证据
// ---------------------------------------------------------------------------

async function partI(browser) {
  const budget = Number(process.env.WIN_MS ?? 75000);
  const rounds = Number(process.env.WIN_ROUNDS ?? 3);
  const ids = (process.env.WIN_IDS ?? "orb-arena,snake-royale,block-drop,combo-clash,mahjong-bloom,star-estate").split(",");
  console.log(`\n===== I. W1-12 补过关证据(每款最多 ${rounds} 局 × ${Math.round(budget / 1000)}s,样本关 2) =====`);
  for (const g of GAMES.filter((x) => ids.includes(x.id))) {
    const page = await newPage(browser, NARROW);
    await page.goto(BASE, { waitUntil: "networkidle0" });
    let win = "";
    let lose = "";
    await openLevel(page, g.id, 2);
    for (let i = 0; i < rounds && !win; i++) {
      const r = await drive(page, g, { budgetMs: budget, mode: "play" });
      if (r.v.includes("过关")) win = `${r.v}(第 ${i + 1} 局 · ${r.acts} 次操作 · ${Math.round(r.ms / 1000)}s)`;
      else if (r.v && !lose) lose = `${r.v}(第 ${i + 1} 局 · ${r.acts} 次操作)`;
      const again = await page.evaluate(() => {
        const b = [...document.querySelectorAll(".l99-ov-btn")].find((x) => /再试本关|再玩一次/.test(x.textContent ?? ""));
        if (!b) return false;
        b.click();
        return true;
      });
      if (!again) await openLevel(page, g.id, 2);
      await sleep(700);
    }
    log(win !== "", `${g.title}:第 2 关真打到过关`, win || `${rounds} 局都没打出过关(拿到的结算:${lose || "无"})`);
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// J. merge-2048 aria-live 观察
// ---------------------------------------------------------------------------

async function partJ(browser) {
  console.log("\n===== J. merge-2048 aria-live 连续写入观察 =====");
  const page = await newPage(browser, NARROW);
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await openLevel(page, "merge-2048", 50);
  const live = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("[aria-live]")];
    return nodes.map((n) => ({ cls: String(n.className).slice(0, 40), politeness: n.getAttribute("aria-live") }));
  });
  note(`页面上的 aria-live 节点:${JSON.stringify(live)}`);
  // 挂 MutationObserver,连按 24 下方向键,数它被改写了多少次、最短间隔多少
  await page.evaluate(() => {
    window.__live = [];
    const targets = [...document.querySelectorAll("[aria-live]")];
    window.__liveObs = new MutationObserver((recs) => {
      for (const r of recs) {
        window.__live.push({ t: performance.now(), text: (r.target.textContent ?? "").slice(0, 40) });
      }
    });
    for (const t of targets) window.__liveObs.observe(t, { childList: true, characterData: true, subtree: true });
  });
  const keys = ["KeyA", "KeyW", "KeyD", "KeyS"];
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press(keys[i % 4]).catch(() => {});
    await sleep(90);
  }
  await sleep(400);
  const stat = await page.evaluate(() => {
    const l = window.__live ?? [];
    window.__liveObs?.disconnect();
    const gaps = [];
    for (let i = 1; i < l.length; i++) gaps.push(Math.round(l[i].t - l[i - 1].t));
    return {
      writes: l.length,
      minGap: gaps.length ? Math.min(...gaps) : null,
      under100: gaps.filter((g) => g < 100).length,
      sample: l.slice(-4).map((x) => x.text)
    };
  });
  log(
    true,
    `merge-2048:24 次方向键触发 aria-live 改写 ${stat.writes} 次`,
    `最短间隔 ${stat.minGap}ms · 间隔 <100ms 的有 ${stat.under100} 次 · 末尾播报「${(stat.sample ?? []).join(" / ")}」`
  );
  note(
    stat.under100 > 0
      ? `有 ${stat.under100} 次改写间隔不足 100ms,读屏会来不及念完上一条 → 值得升级成一般问题`
      : "没有出现 <100ms 的连写,当前节奏读屏跟得上,先只做观察"
  );
  await page.close();
}

// ---------------------------------------------------------------------------

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"]
  });
  try {
    if (PARTS.includes("A")) await partA(browser);
    if (PARTS.includes("C")) await partMatrix(browser, NARROW, "C", { checkLeak: true, checkFont: true });
    if (PARTS.includes("D")) await partMatrix(browser, WIDE, "D", { checkLeak: false, checkFont: false });
    if (PARTS.includes("E")) await partE(browser);
    if (PARTS.includes("F")) await partF(browser);
    if (PARTS.includes("G")) await partG(browser);
    if (PARTS.includes("H")) await partH(browser);
    if (PARTS.includes("I")) await partI(browser);
    if (PARTS.includes("J")) await partJ(browser);
  } finally {
    await browser.close();
  }

  const bad = results.filter((r) => !r.ok);
  console.log(`\n共 ${results.length} 项,通过 ${results.length - bad.length} 项。`);
  if (bad.length) {
    console.log("未通过:");
    for (const r of bad) console.log(`  - ${r.what}${r.extra ? ` — ${r.extra}` : ""}`);
    process.exit(1);
  }
  console.log("全部通过 ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
