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

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5186";
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
    hold: true,
    duoKind: "realtime",
    title: "圆圆大作战",
    p: "oa",
    modes: { versus: "🤝 圆圆混战", endless: "♾️ 缩圈无尽", twoPlayer: "👫 双人同屏" },
    keys: ["KeyW", "KeyD", "KeyS", "KeyA", "KeyF", "KeyG"],
    clicks: [".oa-btn"],
    canvas: true
  },
  {
    id: "snake-royale",
    hold: true,
    duoKind: "realtime",
    title: "长蛇争霸",
    p: "sr",
    modes: { versus: "🤝 原野混战", endless: "♾️ 缩圈无尽", twoPlayer: "👫 双人同屏" },
    keys: ["KeyW", "KeyD", "KeyS", "KeyA", "KeyF", "KeyG"],
    clicks: [".sr-btn"],
    canvas: true
  },
  {
    id: "block-drop",
    hold: true,
    duoKind: "split",
    title: "方块叠叠乐",
    p: "bd",
    modes: { versus: "🤝 对战发行", endless: "♾️ 马拉松 / 竞速", twoPlayer: "👫 双人同屏" },
    keys: ["KeyA", "KeyD", "KeyW", "KeyS", "KeyF", "KeyG"],
    clicks: [".bd-btn"],
    canvas: true
  },
  {
    id: "combo-clash",
    hold: true,
    duoKind: "realtime",
    title: "连招对决",
    p: "cc",
    modes: { versus: "🤝 人机对战", endless: "♾️ 连胜无尽", twoPlayer: "👫 双人同屏" },
    keys: ["KeyD", "KeyF", "KeyG", "KeyW", "KeyA", "KeyF", "KeyF"],
    clicks: [".cc-btn"],
    canvas: true
  },
  {
    id: "mahjong-bloom",
    duoKind: "turn",
    title: "花开麻将",
    p: "mj",
    modes: { versus: "🀄 对战一桌", endless: "♾️ 快棋无尽", twoPlayer: "👫 双人同桌" },
    keys: ["KeyA", "KeyD", "KeyF"],
    clicks: [".mj-tile", ".mj-btn:not(.mj-ghost)"]
  },
  {
    id: "star-estate",
    duoKind: "turn",
    title: "朵星地产",
    p: "se",
    modes: { versus: "🤝 对战 1v3", endless: "♾️ 短盘连胜", twoPlayer: "👫 双人同屏" },
    keys: ["KeyF", "KeyG", "KeyD"],
    clicks: [".se-btn"]
  },
  {
    id: "hero-cards",
    duoKind: "none",
    title: "英杰令",
    p: "hc",
    modes: { versus: "🤝 身份场 1v4", endless: "♾️ 连胜无尽" },
    keys: ["KeyA", "KeyD", "KeyF", "KeyG"],
    clicks: [".hc-card", ".hc-seat", ".hc-btn"]
  },
  {
    id: "weiqi-garden",
    duoKind: "turn",
    title: "围子花园",
    p: "wq",
    modes: { versus: "🤖 自由对战", endless: "🔥 连胜无尽", twoPlayer: "👫 双人同屏" },
    keys: ["KeyD", "KeyS", "KeyF"],
    clicks: [],
    canvas: true
  },
  {
    id: "flight-chess",
    duoKind: "turn",
    title: "飞行棋乐园",
    p: "fc",
    modes: { versus: "🤝 四人对战", endless: "♾️ 连胜无尽", twoPlayer: "👫 双人同屏" },
    keys: ["KeyF", "KeyD"],
    clicks: [".fc-btn-go", ".fc-pick", ".fc-token"]
  },
  {
    id: "merge-2048",
    duoKind: "split",
    title: "星星合成",
    p: "mg",
    modes: { versus: "🤝 对战竞速", endless: "♾️ 马拉松", twoPlayer: "👫 双人同屏" },
    keys: ["KeyA", "KeyW", "KeyD", "KeyS"],
    clicks: [],
    boardSel: ".mg-board"
  },
  {
    id: "mine-garden",
    duoKind: "split",
    title: "扫雷花园",
    // 上游把扫雷花园的类前缀从 mg- 换成 mn-(W1-05 的撞车修法),这里跟上。
    p: "mn",
    modes: { versus: "🤖 竞速对战", endless: "🔥 连续清盘", twoPlayer: "👫 双人同屏" },
    keys: ["KeyD", "KeyS", "KeyF"],
    clicks: [".mn-cell"]
  },
  {
    id: "sudoku-petal",
    duoKind: "split",
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
 *
 * 分边的切法**按各款自己的结构来**,不按屏幕几何瞎切:先找游戏自己的分边容器
 * (`.oa-panes` / `.sr-panes` / `.mg-seats` / `.sp-seats` / `.mg-duo` / `.cc-side` …),
 * 它的每个直接子节点就是一「座」,一座一个区域;找不到才退回几何四分。
 * 整屏指纹一概不用 —— 第 1 轮 `mine-garden` 就是栽在整屏指纹上误报的。
 *
 * 区域命名:
 *   座<i>.dom / 座<i>.canvas<j>   第 i 座的 DOM 叶子摘要 / 画布像素摘要
 *   外.dom                          分边容器之外的公共 HUD(两个人共用,不作为分边证据)
 *   几何.L/.R/.T/.B                找不到分边容器时的退路
 */
const SPLIT_CLASS_RE = "(seats|panes|duo|split|sides)";

async function sideProbe(page) {
  return page.evaluate((splitRe) => {
    const RE = new RegExp(splitRe);
    const hash = (s) => {
      let a = 5381;
      for (let i = 0; i < s.length; i++) a = ((a * 33) ^ s.charCodeAt(i)) >>> 0;
      return a.toString(36);
    };
    const pix = (c, x, y, w, h) => {
      let g = null;
      try {
        g = c.getContext("2d");
      } catch {
        return null;
      }
      if (!g) return null;
      let d;
      try {
        d = g.getImageData(x, y, w, h).data;
      } catch {
        return null;
      }
      let a = 5381;
      for (let i = 0; i < d.length; i += 37) a = ((a * 33) ^ d[i]) >>> 0;
      return a.toString(36);
    };
    /**
     * 一块区域的 DOM 摘要,拆成两份:
     *   .dom —— 类名 + 坐标 + 文字,但**数字一律抹成 #**;倒计时、秒表这种自己会跳的
     *            数字不会污染它,光标挪了 / 格子翻开了才会变。第 1 轮 mine-garden 的
     *            双人取证就是被两边的计时器一起带跑的。
     *   .num —— 只留数字,单独放一格,想看分数变化的时候再看它。
     */
    const leaves = (el) => {
      const shape = [];
      const nums = [];
      // 坐标一律换算成「相对本座左上角」:一边的盘子长高了会把另一边整体推下去,
      // 用绝对坐标的话另一边会跟着"变",看上去像串台,其实只是被挤了一下。
      const base = el.getBoundingClientRect();
      for (const n of el.querySelectorAll("*")) {
        if (n.children.length > 0) continue;
        const r = n.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const t = (n.textContent ?? "").trim().slice(0, 20);
        shape.push(
          `${String(n.className || n.tagName).slice(0, 24)}@${Math.round(r.x - base.x)},${Math.round(r.y - base.y)}:${t.replace(/\d/g, "#")}`
        );
        const d = t.replace(/\D/g, "");
        if (d) nums.push(d);
      }
      return { dom: `${shape.length}/${hash(shape.join("|"))}`, num: hash(nums.join(",")) };
    };
    /** 一块画布的像素摘要:整块 + 左右半 + 上下半,granularity 够细才分得出两个人 */
    const canvasParts = (c, prefix, out) => {
      if (!c.width || !c.height) return;
      const w = c.width;
      const h = c.height;
      const boxes = {
        "": [0, 0, w, h],
        ".L": [0, 0, Math.floor(w / 2), h],
        ".R": [Math.ceil(w / 2), 0, w - Math.ceil(w / 2), h],
        ".T": [0, 0, w, Math.floor(h / 2)],
        ".B": [0, Math.ceil(h / 2), w, h - Math.ceil(h / 2)]
      };
      for (const [k, [x, y, ww, hh]] of Object.entries(boxes)) {
        if (ww < 2 || hh < 2) continue;
        const v = pix(c, x, y, ww, hh);
        if (v) out[prefix + k] = v;
      }
    };

    const out = {};
    const root = document.querySelector(".game-stage") ?? document.querySelector("#app") ?? document.body;

    // 找游戏自己的分边容器:类名带 seats/panes/duo/split/sides,而且至少两个子节点
    let split = null;
    for (const el of root.querySelectorAll("*")) {
      if (!RE.test(String(el.className))) continue;
      if (el.children.length < 2) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 20) continue;
      split = el;
      break;
    }

    if (split) {
      out.__split = String(split.className).slice(0, 30) + `×${split.children.length}`;
      [...split.children].forEach((child, i) => {
        const l = leaves(child);
        out[`座${i}.dom`] = l.dom;
        out[`座${i}.num`] = l.num;
        const cs = child.tagName === "CANVAS" ? [child] : [...child.querySelectorAll("canvas")];
        cs.forEach((c, j) => canvasParts(c, `座${i}.canvas${j}`, out));
      });
      // 分边容器之外的公共 HUD:记下来,但它不算谁的地盘
      const outside = [];
      for (const n of root.querySelectorAll("*")) {
        if (n.children.length > 0 || split.contains(n)) continue;
        const r = n.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        outside.push(`${String(n.className || n.tagName).slice(0, 24)}:${(n.textContent ?? "").trim().slice(0, 20).replace(/\d/g, "#")}`);
      }
      out["外.dom"] = `${outside.length}/${hash(outside.join("|"))}`;
    } else {
      // 退路:几何四分 + 每块画布整块
      const rr = root.getBoundingClientRect();
      const midX = rr.x + rr.width / 2;
      const midY = rr.y + rr.height / 2;
      const buckets = { "几何.L": [], "几何.R": [], "几何.T": [], "几何.B": [] };
      for (const n of root.querySelectorAll("*")) {
        if (n.children.length > 0) continue;
        const r = n.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const tag = `${String(n.className || n.tagName).slice(0, 24)}@${Math.round(r.x)},${Math.round(r.y)}:${(
          n.textContent ?? ""
        )
          .trim()
          .slice(0, 20)
          .replace(/\d/g, "#")}`;
        buckets[r.x + r.width / 2 < midX ? "几何.L" : "几何.R"].push(tag);
        buckets[r.y + r.height / 2 < midY ? "几何.T" : "几何.B"].push(tag);
      }
      for (const [k, v] of Object.entries(buckets)) out[k] = `${v.length}/${hash(v.join("|"))}`;
      [...document.querySelectorAll("canvas")].forEach((c, i) => canvasParts(c, `几何.canvas${i}`, out));
    }
    return out;
  }, SPLIT_CLASS_RE);
}

/**
 * 按玩家颜色数像素:朵朵 #F5A9C8(粉)、星星 #A9C8F5(蓝),都是各款 index.ts 里写死的。
 * 混战类(圆圆 / 长蛇)两块 pane 都在画同一个场地、而且一直在动,
 * 「变没变」这种问法分不出人,只能问「朵朵那团粉色的重心往哪边挪了」。
 */
async function colorCentroids(page) {
  return page.evaluate(() => {
    const near = (r, g, b, [R, G, B]) => Math.abs(r - R) < 46 && Math.abs(g - G) < 46 && Math.abs(b - B) < 46;
    const DUO = [245, 169, 200];
    const STAR = [169, 200, 245];
    const out = [];
    [...document.querySelectorAll("canvas")].forEach((c, i) => {
      if (!c.width || !c.height) return;
      let g = null;
      try {
        g = c.getContext("2d");
      } catch {
        return;
      }
      if (!g) return;
      let d;
      try {
        d = g.getImageData(0, 0, c.width, c.height).data;
      } catch {
        return;
      }
      let dn = 0;
      let dx = 0;
      let sn = 0;
      let sx = 0;
      for (let k = 0; k < d.length; k += 4) {
        const px = (k / 4) % c.width;
        if (near(d[k], d[k + 1], d[k + 2], DUO)) {
          dn++;
          dx += px;
        } else if (near(d[k], d[k + 1], d[k + 2], STAR)) {
          sn++;
          sx += px;
        }
      }
      out.push({ pane: i, 朵朵n: dn, 朵朵x: dn ? Math.round(dx / dn) : null, 星星n: sn, 星星x: sn ? Math.round(sx / sn) : null });
    });
    return out;
  });
}

async function holdKey(page, key, ms) {
  await page.keyboard.down(key).catch(() => {});
  await sleep(ms);
  await page.keyboard.up(key).catch(() => {});
  await sleep(260);
}

/** 谁的回合:回合制的四款(地产 / 飞行棋 / 围棋 / 麻将)靠这句话决定该按谁的键 */
async function whoseTurn(page) {
  return page.evaluate(() => {
    const t = (document.querySelector(".game-stage")?.textContent ?? "").replace(/\s+/g, " ");
    const m = /轮到\s*(朵朵|星星)|(朵朵|星星)\s*的回合/.exec(t);
    return m ? m[1] ?? m[2] : "";
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
      // 只在「模式容器」里面找:顶上那排切模式的 `.<前缀>-modebar` 在容器外面,
      // 点它会跳去另一个模式(combo-clash 的双人就是这么被带走的)。
      // 也只认真正的 <button>:`.cc-pick` 是个容器 div,点它一辈子开不了局。
      const scope = document.querySelector(`.${p}-mode`) ?? document;
      const btns = [...scope.querySelectorAll(`button.${p}-open, button.${p}-btn-sm, button.${p}-face`)].filter(
        (b) => !b.closest("[hidden]") && b.getClientRects().length > 0 && !b.disabled && !back.test(b.textContent ?? "")
      );
      if (btns.length === 0) return false;
      // 优先点真正「开局」的那颗:combo-clash 要先挑朵朵的角色、再点「星星用 X」才开打,
      // 光顺着头像一路点下去,四层预算用完了局还没开。
      const go =
        btns.find((b) => /星星用\s*星星/.test(b.textContent ?? "")) ??
        btns.find((b) => /开始|开局|▶|星星用/.test(b.textContent ?? "")) ??
        btns.find((b) => String(b.className).includes(`${p}-open`)) ??
        btns[0];
      go.click();
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
    // 动作类要「按住」才走得动:轻点一下方向键,圆圆和长蛇几乎原地不动,
    // 第 1 轮的通用假人打不出过关,多半就吃了这个亏。
    if (g.hold) {
      const key = g.keys[k % g.keys.length];
      const isDir = /^(Key[WASD]|Arrow)/.test(key);
      await holdKey(page, key, isDir ? 520 + (acts % 3) * 240 : 90);
      k += 1;
      acts += 1;
    } else {
      await page.keyboard.press(g.keys[k % g.keys.length]).catch(() => {});
      k += 1;
      acts += 1;
    }
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

/** 各玩各的一块盘 / 一块 pane:靠「按谁的键、哪一座变了」取证 */
async function duoBySeat(page, g) {
  // 先热身:有的款(扫雷)第一次动手才启动计时器,不热身的话空跑基线是「静止」,
  // 后面两轮却都被计时器带着变,分边差集就全被抵消掉了。
  await pressAll(page, P1_KEYS.slice(0, 3), 120);
  await sleep(400);
  const idleOnce = async () => {
    const a = await sideProbe(page);
    await sleep(P1_KEYS.length * 150);
    return changedKeys(a, await sideProbe(page));
  };
  const idle = new Set(await idleOnce());

  const before1 = await sideProbe(page);
  await pressAll(page, P1_KEYS);
  const raw1 = changedKeys(before1, await sideProbe(page));
  for (const k of await idleOnce()) idle.add(k);
  const before2 = await sideProbe(page);
  await pressAll(page, P2_KEYS);
  const raw2 = changedKeys(before2, await sideProbe(page));
  for (const k of await idleOnce()) idle.add(k);

  const byP1 = raw1.filter((k) => !idle.has(k));
  const byP2 = raw2.filter((k) => !idle.has(k));
  const onlyP1 = byP1.filter((k) => !byP2.includes(k) && k.startsWith("座"));
  const onlyP2 = byP2.filter((k) => !byP1.includes(k) && k.startsWith("座"));
  note(`分边容器 ${before1.__split ?? "(没找到,走几何四分)"} · 空跑自己会变的:${[...idle].join(",") || "无"}`);
  log(byP1.length > 0, `${g.title} 双人:朵朵 WASD+F+G 有反应`, `动了 ${byP1.join(",") || "(无)"}`);
  log(byP2.length > 0, `${g.title} 双人:星星 方向键+L+K 有反应`, `动了 ${byP2.join(",") || "(无)"}`);
  log(
    onlyP1.length > 0 && onlyP2.length > 0,
    `${g.title} 双人:两套键位各管各的一座(分边可辨,互不串台)`,
    `只认朵朵=${onlyP1.join(",") || "-"} · 只认星星=${onlyP2.join(",") || "-"}`
  );
  return onlyP1.length > 0 && onlyP2.length > 0;
}

/**
 * 混战类(圆圆 / 长蛇 / 连招):两个人在同一个场地里,pane 一直在动,
 * 「变没变」分不出人 —— 改问「朵朵那团粉色 / 星星那团蓝色的重心往哪边挪」。
 * 一律成对做:先按住左键再按住右键,看重心的横坐标是不是跟着反向 → 正向走。
 */
async function duoByColor(page, g) {
  // 三段式:先往左压住、再往右压住、再往左压住。
  // 真的接住了这套键位,重心的横坐标就该「左 → 右 → 左」走一个来回;
  // 对家自己乱跑造成的漂移不会这么听话地跟着反向,所以要求两段符号相反。
  const sweep = async (neg, pos) => {
    await holdKey(page, neg, 1100);
    const s1 = await colorCentroids(page);
    await holdKey(page, pos, 2000);
    const s2 = await colorCentroids(page);
    await holdKey(page, neg, 2000);
    const s3 = await colorCentroids(page);
    return [s1, s2, s3];
  };
  /** 逐块 pane 算 Δ,挑「一来一回都够大、而且符号相反」的那一块 */
  const bestPane = (frames, who) => {
    const panes = frames[0].map((r) => r.pane);
    let best = null;
    for (const p of panes) {
      const v = frames.map((f) => f.find((r) => r.pane === p));
      if (v.some((r) => !r || r[`${who}n`] < 8 || r[`${who}x`] === null)) continue;
      const d1 = v[1][`${who}x`] - v[0][`${who}x`];
      const d2 = v[2][`${who}x`] - v[1][`${who}x`];
      const score = d1 > 12 && d2 < -12 ? Math.min(d1, -d2) : -1;
      if (!best || score > best.score) best = { pane: p, d1, d2, score };
    }
    return best;
  };

  const fd = await sweep("KeyA", "KeyD");
  const duo = bestPane(fd, "朵朵");
  const duoCross = bestPane(fd, "星星");
  const fs = await sweep("ArrowLeft", "ArrowRight");
  const star = bestPane(fs, "星星");
  const starCross = bestPane(fs, "朵朵");

  const fmt = (b) => (b ? `pane${b.pane} 左→右 ${b.d1 > 0 ? "+" : ""}${b.d1}px、右→左 ${b.d2}px` : "这个颜色在画布上找不到足够的像素");
  note(`按住 A/D 时星星那团的动静:${fmt(duoCross)} · 按住 ←/→ 时朵朵那团的动静:${fmt(starCross)}`);
  log(Boolean(duo && duo.score > 0), `${g.title} 双人:朵朵那团粉色跟着 A/D 左右来回`, fmt(duo));
  log(Boolean(star && star.score > 0), `${g.title} 双人:星星那团蓝色跟着 ←/→ 左右来回`, fmt(star));
  const ok = Boolean(duo && duo.score > 0 && star && star.score > 0);
  log(
    ok,
    `${g.title} 双人:两套键位各推各的那一颗(按玩家颜色分人,不看整屏)`,
    `朵朵 ${fmt(duo)} | 星星 ${fmt(star)}`
  );
  return ok;
}

/** 回合制(麻将 / 地产 / 围棋 / 飞行棋):同一块盘轮流出手,只有当前回合那个人的键该生效 */
async function duoByTurn(page, g) {
  // 一次只按一个键,按完立刻重新看「轮到谁」——
  // 一口气按完六个键会把回合推过头,量到的就永远是同一个人。
  const own = new Map();
  const cross = new Map();
  const seen = [];
  let ki = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 70000 && (own.size < 2 || cross.size < 2)) {
    const who = await whoseTurn(page);
    if (!who) {
      await sleep(400);
      continue;
    }
    if (seen.at(-1) !== who) seen.push(who);
    // 先量「他自己那套键」——串台探针要是先按,会把这个人的回合白白用掉,
    // 结果就是永远轮不到星星(上一版就栽在这)。
    const keys = who === "朵朵" ? P1_KEYS : P2_KEYS;
    const before = await sideProbe(page);
    // 一轮按两个键:地产那种「先掷骰、再决定买不买」的回合,一个键推不完
    for (let j = 0; j < 2; j++) {
      await page.keyboard.press(keys[ki % keys.length]).catch(() => {});
      ki += 1;
      await sleep(330);
    }
    const moved = changedKeys(before, await sideProbe(page));
    if (moved.length > 0 && !own.has(who)) own.set(who, moved);
    // 回合还在他手上,才拿对家那套键探一下会不会串台
    if (!cross.has(who) && (await whoseTurn(page)) === who) {
      const b0 = await sideProbe(page);
      const foeKeys = who === "朵朵" ? P2_KEYS : P1_KEYS;
      await page.keyboard.press(foeKeys[ki % foeKeys.length]).catch(() => {});
      await sleep(420);
      cross.set(who, changedKeys(b0, await sideProbe(page)));
    }
  }
  note(`回合流转:${seen.join(" → ") || "(读不到回合提示)"}`);
  if (seen.length === 0) {
    log(false, `${g.title} 双人:读不到「轮到谁」的提示,回合制取证做不下去`);
    return false;
  }
  for (const who of ["朵朵", "星星"]) {
    const keyName = who === "朵朵" ? "WASD+F+G" : "方向键+L+K";
    log(
      own.has(who),
      `${g.title} 双人:轮到 ${who} 时 ${keyName} 真的吃得进去`,
      own.get(who)?.join(",") ?? (seen.includes(who) ? "轮到过它但按了没反应" : "70s 里没轮到过它")
    );
    if (cross.has(who)) {
      const c = cross.get(who);
      note(`轮到 ${who} 时改按 ${other(who)} 那套键:${c.length === 0 ? "毫无反应(不串台)" : "动了 " + c.join(",")}`);
    }
  }
  note(`${g.title} 是同一块盘轮流出手,没有「左右两边」,所以不做分边差集,改看「轮到谁、谁的键才吃得进去」`);
  return own.size === 2;
}

function other(who) {
  return who === "朵朵" ? "星星" : "朵朵";
}

async function partE(browser) {
  console.log("\n===== E. 双人键位分边取证(360×640) =====");
  for (const g of PICKED) {
    const label = g.modes.twoPlayer;
    if (!label) {
      log(true, `${g.title}:meta 里就没有 twoPlayer(身份场两个人挤一屏会互相看光牌),跳过`);
      continue;
    }
    console.log(`\n----- ${g.title}(${g.duoKind}) -----`);
    const page = await newPage(browser, NARROW);
    const r = await enterMode(page, g, label);
    const started = await drewNodes(page, g.p);
    if (!r.ok || started < 6) {
      log(false, `${g.title} 双人:进不去 ${label}`, `选了 ${r.picks} 层 · ${started} 个节点`);
      await page.close();
      continue;
    }
    log(true, `${g.title} 双人:${label} 开得起来`, `选了 ${r.picks} 层 · ${started} 个节点`);

    if (g.duoKind === "turn") {
      await duoByTurn(page, g);
    } else {
      const ok = await duoBySeat(page, g);
      if (!ok && g.duoKind === "realtime") {
        // 混战类一局有时限,分边那一轮跑完往往已经打完了,颜色取证得重开一局
        await enterMode(page, g, label);
        await sleep(700);
        await duoByColor(page, g);
      }
    }
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
// M. 长蛇争霸:一根手指都不动,到底会不会过关
// ---------------------------------------------------------------------------

/**
 * `scripts/qa-1.2-window1-winlose.mjs` 拿「高关号放着不动」当**必输**的对照组,
 * 结果第 160 关放着不动反而弹出「第 160 关过关!第 1 名 · 长度 28」。
 * 这里换我自己的口径复现一遍,并顺着关号扫一段,看它是这一关的偶然还是一片都这样。
 */
async function partM(browser) {
  const levels = (process.env.IDLE_LEVELS ?? "2,50,150,160").split(",").map(Number);
  const runs = Number(process.env.IDLE_RUNS ?? 2);
  const budget = Number(process.env.IDLE_MS ?? 90000);
  console.log(`\n===== M. 长蛇争霸「不操作」对照(关号 ${levels.join("/")} × ${runs} 次 × ${Math.round(budget / 1000)}s) =====`);
  const g = GAMES.find((x) => x.id === "snake-royale");
  let idleWins = 0;
  let total = 0;
  for (const lv of levels) {
    const got = [];
    for (let i = 0; i < runs; i++) {
      const page = await newPage(browser, NARROW);
      await page.goto(BASE, { waitUntil: "networkidle0" });
      if (!(await openLevel(page, g.id, lv))) {
        got.push("开不起来");
        await page.close();
        continue;
      }
      const t0 = Date.now();
      let v = "";
      // 一根手指都不动,只等结算浮层自己冒出来
      while (Date.now() - t0 < budget && !v) {
        await sleep(1500);
        v = await verdict(page, g.p);
      }
      got.push(v || "超时没结算");
      total += 1;
      if (/过关/.test(v)) idleWins += 1;
      await page.close();
    }
    const win = got.filter((x) => /过关/.test(x)).length;
    log(
      win === 0,
      `长蛇争霸 第 ${lv} 关:放着不动不该过关`,
      `${runs} 次里过关 ${win} 次 — ${got.map((x) => x.replace(/\s+/g, " ").slice(0, 34)).join(" | ")}`
    );
  }
  note(`合计:不操作 ${total} 局,过关 ${idleWins} 局`);
}

// ---------------------------------------------------------------------------
// L. 暂停屏 / 结算屏的 360px 字号(模式入口那一遍走不到这两层)
// ---------------------------------------------------------------------------

/**
 * PART=C 走的是「首页 → 闯关 / 对战 / 无尽 / 双人」四层入口,按一次 Esc 才出来的暂停屏、
 * 打完才出来的结算屏都没量到。仓库自己的 `window1-mobile-text.test.ts` 也扫不到这两层:
 * 它匹配的是 `font-size:<数字>px`,`font-size:clamp(13px,…)` 这种下界写法直接漏过去。
 */
async function partL(browser) {
  console.log("\n===== L. 暂停屏 / 结算屏 360px 字号(样本关 2) =====");
  // 先把源码里 clamp()/max()/min() 的下界扫一遍,和真浏览器读数互相印证
  const floors = await (async () => {
    const fs = await import("node:fs/promises");
    const out = [];
    for (const g of GAMES) {
      const src = await fs.readFile(`src/games/${g.id}/index.ts`, "utf8");
      for (const m of src.matchAll(/\.([\w-]+)\s*\{[^{}]*font-size:\s*(?:clamp|max|min)\(\s*([0-9.]+)px/g)) {
        if (Number(m[2]) < MIN_CONTROL_PX) out.push(`${g.id} .${m[1]}=${m[2]}px`);
      }
    }
    return out;
  })();
  log(
    floors.length === 0,
    "源码里 clamp()/max() 的字号下界不该低于 14px",
    floors.length ? `${floors.length} 处:${floors.join(" · ")}` : "0 处"
  );

  for (const g of GAMES) {
    const page = await newPage(browser, NARROW);
    await page.goto(BASE, { waitUntil: "networkidle0" });
    const opened = await openLevel(page, g.id, 2);
    if (!opened) {
      log(false, `${g.title}:第 2 关开不起来,暂停屏量不到`);
      await page.close();
      continue;
    }
    await sleep(900);
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(700);
    const paused = await page.evaluate(() =>
      /暂停|继续|歇一会儿|先歇/.test(document.querySelector(".game-stage")?.textContent ?? "")
    );
    const t = await tinyText(page, MIN_CONTROL_PX);
    log(
      t.count === 0,
      `${g.title} 暂停屏:360px 字号下限 14px`,
      `${paused ? "暂停层已出现" : "没量到暂停层(按 Esc 无浮层)"} · 最小 ${t.smallest}px${t.count ? ` · ${t.count} 处偏小:${t.bad.join(" ")}` : ""}`
    );
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// K. 围子花园双人同屏:两套键位到底分不分人
// ---------------------------------------------------------------------------

/**
 * PART=E 的通用回合探针只能说「按了对家的键、画布动了」,画布动也可能只是光标挪了一格,
 * 说服力不够。这里改读围子花园自己播报的「第 N 手」:
 * 手数只有真落子才会 +1,所以「轮到朵朵时按星星的键,手数涨了」= 星星替朵朵下了子,
 * 是决定性证据,不用再猜画布上那一下是光标还是棋子。
 */
async function readWeiqi(page) {
  return page.evaluate(() => {
    const all = (document.querySelector(".game-stage")?.textContent ?? "").replace(/\s+/g, " ");
    const mv = /第\s*(\d+)\s*手/.exec(all);
    const tn = /轮到\s*(朵朵|星星)/.exec(all);
    return { moves: mv ? Number(mv[1]) : null, turn: tn ? tn[1] : "", raw: all.slice(0, 90) };
  });
}

async function partK(browser) {
  console.log("\n===== K. 围子花园双人同屏:两套键位分不分人(读「第 N 手」) =====");
  const g = GAMES.find((x) => x.id === "weiqi-garden");
  const page = await newPage(browser, NARROW);
  const r = await enterMode(page, g, g.modes.twoPlayer);
  if (!r.ok) {
    log(false, "围子花园:双人同屏开不起来", `选了 ${r.picks} 层`);
    await page.close();
    return;
  }
  await sleep(600);
  const start = await readWeiqi(page);
  note(`开局读数:第 ${start.moves} 手 · 轮到 ${start.turn} · 「${start.raw}」`);
  if (start.moves === null) {
    note("这一屏没播报手数,决定性取证做不了 —— 记为取证上限");
    await page.close();
    return;
  }

  // 第 1 段:轮到朵朵,只按星星那套键(←/→ 挪光标 + L 确认)。手数涨了就是串台。
  const rounds = [];
  for (let i = 0; i < 6; i++) {
    const before = await readWeiqi(page);
    if (before.turn !== "朵朵") break;
    await pressAll(page, ["ArrowRight", "ArrowDown", "KeyL"], 180);
    await sleep(500);
    const after = await readWeiqi(page);
    rounds.push({ before, after });
    if (after.moves > before.moves) break;
  }
  const crossed = rounds.find((x) => x.after.moves > x.before.moves);
  log(
    crossed === undefined,
    "围子花园 双人:轮到朵朵时,星星那套键不该落得下子",
    crossed
      ? `串台了 —— 按 ←/↓/L 之后手数 ${crossed.before.moves} → ${crossed.after.moves}、轮次 ${crossed.before.turn} → ${crossed.after.turn}`
      : `按了 ${rounds.length} 轮星星的键,手数一直停在 ${start.moves}(不串台)`
  );

  // 第 2 段:反向再探一次 —— 这一手轮到谁,就拿另一套键去试,看是不是两个方向都串
  const own0 = await readWeiqi(page);
  let own1 = own0;
  for (let i = 0; i < 6 && own1.moves <= own0.moves; i++) {
    await pressAll(page, ["ArrowRight", "KeyF"], 180);
    await sleep(500);
    own1 = await readWeiqi(page);
  }
  note(
    `反向探针:轮到 ${own0.turn} 时按朵朵那套的 F,手数 ${own0.moves} → ${own1.moves}、轮次 ${own0.turn} → ${own1.turn}` +
      (own1.moves > own0.moves && own0.turn === "星星" ? "(另一个方向也串)" : "")
  );

  // 第 3 段:同一份 keyAction 是不是真把两套键映成同一个动作(纯函数,不碰玩法)
  const map = await page.evaluate(async () => {
    const m = await import("/src/games/weiqi-garden/index.ts");
    const ks = ["w", "ArrowUp", "a", "ArrowLeft", "f", "l", "g", "k"];
    const out = {};
    for (const k of ks) out[k] = m.keyAction(k);
    return { arity: m.keyAction.length, out };
  });
  log(
    map.arity >= 2,
    "围子花园:keyAction 该带一个「这键是谁的」参数",
    `keyAction.length=${map.arity} · 映射 ${JSON.stringify(map.out)}`
  );
  await page.close();
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
    if (PARTS.includes("K")) await partK(browser);
    if (PARTS.includes("L")) await partL(browser);
    if (PARTS.includes("M")) await partM(browser);
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
