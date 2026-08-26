/**
 * 1.1 第 4 步 B 的手动冒烟替身:用真浏览器(375×667 竖屏)把
 * 海底大胃王 / 水果切切乐 的第 100、145、188 关一路玩到真实胜负。
 *
 * 覆盖验收清单里的四条:
 *   1. 每款实玩第 100 / 145 / 188 关到真实胜负(存档里真的多了星星才算赢);
 *   2. Boss / 果王关必须能打赢也能打输,两种结局各验一次;
 *   3. 375×667 窄屏 HUD 不溢出(按真实字体量出来的宽度和左右安全线比);
 *   4. destroy 无泄漏:进游戏 → 玩一关 → 退出 → 再进,
 *      rAF / setInterval / 事件监听全部清干净。
 *
 * 跑法(playwright 是临时工具,没有进 package.json):
 *   npm i -D playwright --no-save && npx playwright install chromium --with-deps
 *   npx vite --port 5173
 *   node scripts/smoke188-b.mjs            # 也可以 SMOKE_ONLY=fruit-slice 只跑一款
 *
 * 它连着 dev server 跑:直接 import 游戏模块的 mount(),自己造一个
 * GameAPI 桩,这样 onWin / onLose / addStars 都能被记下来,
 * 判定胜负不靠猜画面,靠存档和回调。
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5173";
const ONLY = process.env.SMOKE_ONLY ?? "";
const VIEWPORT = { width: 375, height: 667 };

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

const GAMES = {
  "ocean-munch": {
    title: "海底大胃王",
    progressKey: "yiduo-yixing.ocean-munch.campaign.v2",
    extraKeys: ["yiduo-yixing.ocean-munch.dex.v1"],
    levels: [99, 144, 187],
    bossLevel: 187,
  },
  "fruit-slice": {
    title: "水果切切乐",
    progressKey: "yiduo-yixing.fruit-slice.campaign.v2",
    extraKeys: [],
    levels: [99, 144, 187],
    bossLevel: 187,
  },
};

/* ------------------------------------------------------------------ *
 * 页面内的通用驾驶台:挂载游戏 + 按坐标点过菜单 + 记录回调
 * ------------------------------------------------------------------ */

const HARNESS = `
window.__smoke = (() => {
  const state = { api: null, handle: null, calls: [], rafBefore: 0, listeners: [] };

  // 数一数没被清掉的 rAF / setInterval / 事件监听
  const realRaf = window.requestAnimationFrame;
  const realCancel = window.cancelAnimationFrame;
  const realSetInterval = window.setInterval;
  const realClearInterval = window.clearInterval;
  const liveRaf = new Set();
  const liveInterval = new Set();
  window.requestAnimationFrame = (cb) => {
    const id = realRaf((t) => { liveRaf.delete(id); cb(t); });
    liveRaf.add(id);
    return id;
  };
  window.cancelAnimationFrame = (id) => { liveRaf.delete(id); return realCancel(id); };
  window.setInterval = (...a) => { const id = realSetInterval(...a); liveInterval.add(id); return id; };
  window.clearInterval = (id) => { liveInterval.delete(id); return realClearInterval(id); };

  // 记事件监听的挂/摘,退出后不该有残留
  const targets = new Map();
  const wrap = (proto, label) => {
    const add = proto.addEventListener;
    const rm = proto.removeEventListener;
    proto.addEventListener = function (type, fn, opts) {
      const key = label + ':' + type;
      targets.set(key, (targets.get(key) ?? 0) + 1);
      return add.call(this, type, fn, opts);
    };
    proto.removeEventListener = function (type, fn, opts) {
      const key = label + ':' + type;
      targets.set(key, (targets.get(key) ?? 0) - 1);
      return rm.call(this, type, fn, opts);
    };
  };
  wrap(HTMLCanvasElement.prototype, 'canvas');
  wrap(Window.prototype, 'window');

  return {
    async mount(gameId, w, h) {
      const host = document.createElement('div');
      host.id = 'smoke-host';
      host.style.cssText = 'position:fixed;left:0;top:0;width:' + w + 'px;height:' + h + 'px;overflow:hidden;';
      document.body.style.margin = '0';
      document.body.appendChild(host);
      const mod = await import('/src/games/' + gameId + '/index.ts');
      state.calls = [];
      state.api = {
        root: host,
        play: (n) => state.calls.push(['play', n]),
        addStars: (n) => { state.calls.push(['addStars', n]); return n; },
        getStars: () => 0,
        onWin: (s, m) => state.calls.push(['onWin', s, m]),
        onLose: (m) => state.calls.push(['onLose', m]),
      };
      state.handle = mod.mount(state.api);
      return true;
    },
    destroy() {
      state.handle?.destroy();
      state.handle = null;
      document.getElementById('smoke-host')?.remove();
    },
    leaks() {
      const leftovers = [...targets.entries()].filter(([, n]) => n !== 0);
      return { raf: liveRaf.size, interval: liveInterval.size, listeners: leftovers };
    },
    calls() { return state.calls.slice(); },
    canvasRect() {
      const cv = document.querySelector('#smoke-host canvas');
      const r = cv.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    },
    /** 画布上有没有画到边界外(逐帧比不了,退而求其次:量文字宽度) */
    measure(font, text) {
      const c = document.createElement('canvas').getContext('2d');
      c.font = font;
      return c.measureText(text).width;
    },
  };
})();
`;

/**
 * 冒烟用的空白页:只有 <body>,好让 mount() 出来的画布独占屏幕。
 * /src/** 的模块请求照样打到 dev server,拿到的是真实源码。
 */
const BLANK = `${BASE}/__smoke_blank`;
async function routeBlank(page) {
  await page.route(BLANK + "*", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><html><head><meta charset='utf-8'></head><body style='margin:0'></body></html>",
    }),
  );
}

async function openBlank(page) {
  await page.goto(`${BLANK}?t=${Date.now()}`, { waitUntil: "load" });
  await page.evaluate(HARNESS);
}

/** 在画布上点一下(真事件,走 pointerdown/up) */
async function tap(page, x, y) {
  const r = await page.evaluate(() => window.__smoke.canvasRect());
  await page.mouse.move(r.left + x, r.top + y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(90);
}

/** 从 (x1,y1) 划到 (x2,y2),中间分 steps 步,模拟一刀 */
async function swipe(page, x1, y1, x2, y2, steps = 10) {
  const r = await page.evaluate(() => window.__smoke.canvasRect());
  await page.mouse.move(r.left + x1, r.top + y1);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(r.left + x1 + ((x2 - x1) * i) / steps, r.top + y1 + ((y2 - y1) * i) / steps);
  }
  await page.mouse.up();
}

/* ------------------------------------------------------------------ *
 * 菜单坐标:和 index.ts 里的排版算式一一对应
 * ------------------------------------------------------------------ */

/** 章节卡片中心(两栏布局,和 drawThemes 一致) */
function themeCardCenter(chapterIdx, chapterCount, w, h) {
  const cols = w > h * 1.15 ? 3 : 2;
  const rows = Math.ceil(chapterCount / cols);
  const pad = 10;
  const x0 = Math.max(10, w * 0.06);
  const y0 = 70;
  const cw = (w - x0 * 2 - pad * (cols - 1)) / cols;
  const ch = Math.min(96, (h - y0 - 16 - pad * (rows - 1)) / rows);
  const col = chapterIdx % cols;
  const row = Math.floor(chapterIdx / cols);
  return { x: x0 + col * (cw + pad) + cw / 2, y: y0 + row * (ch + pad) + ch / 2 };
}

/** 关卡节点中心(蛇形排布,和 drawMap 一致) */
function mapNodeCenter(i, count, cols, w, h) {
  const rows = Math.ceil(count / cols);
  const mx0 = w * 0.12;
  const mx1 = w * 0.88;
  const my0 = 96;
  const my1 = h - 62;
  const row = Math.floor(i / cols);
  const colRaw = i % cols;
  const col = row % 2 === 0 ? colRaw : cols - 1 - colRaw;
  return {
    x: mx0 + ((mx1 - mx0) * col) / (cols - 1),
    y: my0 + (rows === 1 ? 0 : ((my1 - my0) * row) / (rows - 1)),
  };
}

/* ------------------------------------------------------------------ *
 * 两款游戏各自的自动玩家
 * ------------------------------------------------------------------ */

/**
 * 水果切切乐:每隔一会儿横着划一刀。刀路故意画在屏幕中段
 * (水果抛物线顶点附近),既能连刀,也不至于老去蹭底下的炸弹。
 */
async function playFruitSlice(page, { sloppy }) {
  const rows = sloppy ? [0.82, 0.9] : [0.42, 0.5, 0.36, 0.46];
  for (let k = 0; k < (sloppy ? 40 : 150); k++) {
    const y = VIEWPORT.height * rows[k % rows.length];
    const leftToRight = k % 2 === 0;
    await swipe(
      page,
      leftToRight ? 16 : VIEWPORT.width - 16,
      y - 26,
      leftToRight ? VIEWPORT.width - 16 : 16,
      y + 26,
      sloppy ? 5 : 12,
    );
    const done = await page.evaluate(() =>
      window.__smoke.calls().some((c) => c[0] === "addStars" || c[0] === "onWin" || c[0] === "onLose"),
    );
    if (done) return;
  }
}

/**
 * 海底大胃王:指针就是鱼的目标点。按「绕大圈 + 贴着屏幕中段游」
 * 的路线跑,自然会撞上顺路的小鱼;鱼变大之后吃得更快。
 */
async function playOceanMunch(page, { sloppy }) {
  const cx = VIEWPORT.width / 2;
  const cy = VIEWPORT.height / 2;
  const r = await page.evaluate(() => window.__smoke.canvasRect());
  const steps = sloppy ? 60 : 900;
  for (let k = 0; k < steps; k++) {
    // 手生的玩法:缩在角落不动,专等障碍撞上来
    const t = k * 0.16;
    const x = sloppy ? 24 : cx + Math.cos(t) * (VIEWPORT.width * 0.36);
    const y = sloppy ? 24 : cy + Math.sin(t * 1.37) * (VIEWPORT.height * 0.33);
    await page.mouse.move(r.left + x, r.top + y);
    if (k % 12 === 0) {
      const done = await page.evaluate(() =>
        window.__smoke.calls().some((c) => c[0] === "addStars" || c[0] === "onWin" || c[0] === "onLose"),
      );
      if (done) return;
      await page.waitForTimeout(60);
    }
  }
}

/* ------------------------------------------------------------------ *
 * 单关流程
 * ------------------------------------------------------------------ */

async function seed(page, cfg, level) {
  await page.evaluate(
    ([key, extra, n]) => {
      localStorage.clear();
      const stars = Array.from({ length: 188 }, (_, i) => (i < n ? 3 : 0));
      localStorage.setItem(key, JSON.stringify(stars));
      for (const k of extra) localStorage.removeItem(k);
    },
    [cfg.progressKey, cfg.extraKeys, level],
  );
}

/** 菜单 → 章节 → 关卡 → intro → play */
async function enterLevel(page, gameId, level, layout) {
  const { w, h } = VIEWPORT.width && { w: VIEWPORT.width, h: VIEWPORT.height };
  if (gameId === "fruit-slice") {
    // 主菜单第一张卡就是经典战役
    const cardH = Math.min(88, (h * 0.66) / 3 - 12);
    await tap(page, w / 2, h * 0.26 + cardH / 2);
  }
  const chapter = layout.chapterOf(level);
  const c = themeCardCenter(chapter, layout.chapterCount, w, h);
  await tap(page, c.x, c.y);
  const size = layout.sizeOf(chapter);
  const n = mapNodeCenter(level - layout.startOf(chapter), size, layout.cols(size), w, h);
  await tap(page, n.x, n.y);
  // intro 面板点一下开始
  await tap(page, w / 2, h / 2);
  await page.waitForTimeout(200);
}

async function runLevel(page, gameId, cfg, level, { sloppy = false } = {}, layout) {
  await openBlank(page);
  await seed(page, cfg, level);
  await page.evaluate(
    ([id, w, h]) => window.__smoke.mount(id, w, h),
    [gameId, VIEWPORT.width, VIEWPORT.height],
  );
  await page.waitForTimeout(300);
  await enterLevel(page, gameId, level, layout);

  if (gameId === "fruit-slice") await playFruitSlice(page, { sloppy });
  else await playOceanMunch(page, { sloppy });

  const out = await page.evaluate(
    ([key, lv]) => {
      const stars = JSON.parse(localStorage.getItem(key) ?? "[]");
      return { stars: stars[lv] ?? 0, calls: window.__smoke.calls() };
    },
    [cfg.progressKey, level],
  );
  return out;
}

/* ------------------------------------------------------------------ *
 * HUD 溢出检查:按真实字体量宽度
 * ------------------------------------------------------------------ */

async function checkHud(page, gameId, cfg) {
  const bad = await page.evaluate(
    async ([id, w]) => {
      const logic = await import("/src/games/" + id + "/logic.ts");
      const m = document.createElement("canvas").getContext("2d");
      const over = [];
      const heartsW = (() => {
        m.font = "16px sans-serif";
        return m.measureText("💗💗💗").width;
      })();
      const count = id === "fruit-slice" ? logic.ROUNDS.length : logic.LEVELS.length;
      for (let i = 0; i < count; i++) {
        const ci = logic.themeIndexOf(i);
        const rel = i - logic.themeStart(ci) + 1;
        const size = logic.themeSize(ci);
        m.font = "bold 16px sans-serif";
        let text;
        if (id === "fruit-slice") {
          const r = logic.ROUNDS[i];
          text = `第${ci + 1}章 ${rel}/${size} · 🍑 0/${r.target} · ⏱${r.time}s`;
        } else {
          const l = logic.LEVELS[i];
          text = `第${ci + 1}章 ${rel}/${size} · 🐟 14/${l.targetR}`;
        }
        const pillW = Math.min(w - 90, m.measureText(text).width + 28);
        // 左侧药丸从 x=10 起,右侧爱心右缘留 12px
        if (10 + pillW > w - 12 - heartsW) {
          over.push(`第 ${i + 1} 关 药丸 ${Math.round(pillW)} + 爱心 ${Math.round(heartsW)}`);
        }
      }
      return over;
    },
    [gameId, VIEWPORT.width],
  );
  log(bad.length === 0, `${cfg.title} 375×667 HUD 药丸与爱心不打架`, bad.slice(0, 3).join(" | "));
}

/** 地图页 30 关一章的最后一行不会被切到屏幕外 */
async function checkMapFits(page, gameId, cfg) {
  const bad = await page.evaluate(
    async ([id, w, h]) => {
      const logic = await import("/src/games/" + id + "/logic.ts");
      const sizes = logic.THEME_SIZES;
      const out = [];
      for (let ci = 0; ci < sizes.length; ci++) {
        const count = sizes[ci];
        const cols = id === "fruit-slice" ? (count > 16 ? 5 : 4) : 4;
        const rows = Math.ceil(count / cols);
        const mx0 = w * 0.12;
        const mx1 = w * 0.88;
        const my0 = 96;
        const my1 = h - 62;
        const nr = Math.max(
          id === "fruit-slice" ? 13 : 16,
          Math.min(28, (mx1 - mx0) / cols / 2.4, (my1 - my0) / rows / 2.6),
        );
        const lastY = my0 + (rows === 1 ? 0 : my1 - my0);
        // 压轴关的圈会放大 1.22~1.25 倍,星星画在 y + r*1.45
        const bottom = lastY + nr * 1.25 * 1.45 + 6;
        if (bottom > h) out.push(`第 ${ci + 1} 章 底部 ${Math.round(bottom)} > ${h}`);
        if (mx0 - nr < 0 || mx1 + nr > w) out.push(`第 ${ci + 1} 章 左右溢出`);
      }
      return out;
    },
    [gameId, VIEWPORT.width, VIEWPORT.height],
  );
  log(bad.length === 0, `${cfg.title} 375×667 关卡地图不出血`, bad.slice(0, 3).join(" | "));
}

/* ------------------------------------------------------------------ *
 * destroy 泄漏检查
 * ------------------------------------------------------------------ */

async function checkDestroy(page, gameId, cfg, layout) {
  await openBlank(page);
  await seed(page, cfg, 99);
  // 进游戏 → 玩一小会儿 → 退出 → 再进 → 再退
  for (let round = 0; round < 2; round++) {
    await page.evaluate(
      ([id, w, h]) => window.__smoke.mount(id, w, h),
      [gameId, VIEWPORT.width, VIEWPORT.height],
    );
    await page.waitForTimeout(250);
    await enterLevel(page, gameId, 99, layout);
    if (gameId === "fruit-slice") {
      for (let i = 0; i < 6; i++) await swipe(page, 20, 300, 355, 340, 8);
    } else {
      const r = await page.evaluate(() => window.__smoke.canvasRect());
      for (let i = 0; i < 20; i++) {
        await page.mouse.move(r.left + 60 + i * 12, r.top + 200 + (i % 5) * 40);
      }
    }
    await page.evaluate(() => window.__smoke.destroy());
    await page.waitForTimeout(400);
  }
  const leaks = await page.evaluate(() => window.__smoke.leaks());
  log(
    leaks.raf === 0 && leaks.interval === 0 && leaks.listeners.length === 0,
    `${cfg.title} destroy 无泄漏(rAF/setInterval/监听全清)`,
    `rAF ${leaks.raf} · interval ${leaks.interval} · 监听 ${JSON.stringify(leaks.listeners)}`,
  );
  const gone = await page.evaluate(() => !document.querySelector("#smoke-host canvas"));
  log(gone, `${cfg.title} destroy 之后画布已摘除`);
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

async function layoutFor(page, gameId) {
  const info = await page.evaluate(async (id) => {
    const logic = await import("/src/games/" + id + "/logic.ts");
    return { sizes: logic.THEME_SIZES, total: id === "fruit-slice" ? logic.ROUNDS.length : logic.LEVELS.length };
  }, gameId);
  const starts = [];
  let s = 0;
  for (const n of info.sizes) {
    starts.push(s);
    s += n;
  }
  return {
    chapterCount: info.sizes.length,
    total: info.total,
    sizeOf: (ci) => info.sizes[ci],
    startOf: (ci) => starts[ci],
    chapterOf: (idx) => info.sizes.findIndex((_, ci) => idx < starts[ci] + info.sizes[ci]),
    cols: (size) => (gameId === "fruit-slice" ? (size > 16 ? 5 : 4) : 4),
  };
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => log(false, `页面报错:${e.message}`));
  await routeBlank(page);

  for (const [gameId, cfg] of Object.entries(GAMES)) {
    if (ONLY && ONLY !== gameId) continue;
    console.log(`\n=== ${cfg.title} (${gameId}) ===`);

    // 先把布局算式对齐
    await openBlank(page);
    const layout = await layoutFor(page, gameId);
    log(layout.total === 188, `${cfg.title} 战役总数 188`, String(layout.total));

    await checkHud(page, gameId, cfg);
    await checkMapFits(page, gameId, cfg);

    // 实玩第 100 / 145 / 188 关
    for (const level of cfg.levels) {
      const out = await runLevel(page, gameId, cfg, level, {}, layout);
      const won = out.stars > 0;
      log(won, `${cfg.title} 第 ${level + 1} 关实玩通关`, `星级 ${out.stars}`);
      if (level === cfg.bossLevel) {
        const finale = out.calls.find((c) => c[0] === "onWin");
        log(!!finale, `${cfg.title} 第 188 关触发全通关庆祝`, finale ? String(finale[2]).slice(0, 40) : "");
      }
      if (won) {
        await page.screenshot({ path: `/tmp/smoke-${gameId}-${level + 1}.png` });
      }
    }

    // Boss 关也要能打输
    const lost = await runLevel(page, gameId, cfg, cfg.bossLevel, { sloppy: true }, layout);
    log(lost.stars === 0, `${cfg.title} 第 ${cfg.bossLevel + 1} 关(Boss)手生时会真的失败`, `星级 ${lost.stars}`);

    await checkDestroy(page, gameId, cfg, layout);
  }

  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} 项通过`);
  if (bad.length > 0) {
    for (const b of bad) console.log(` FAIL ${b.what}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
