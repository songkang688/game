/**
 * 1.1 第 5 步 B 的手动冒烟替身:用真浏览器(375×667 竖屏)把糖果秋千的
 * 第 100 / 145 / 188 关用真实划绳手势打到真实过关,并检查:
 *   - 窄屏无横向溢出、画布整块在首屏内、糖果与怪物都够得着;
 *   - 1.0 老存档(99 个星级)读进来第 100 关自然解锁、前 99 关星级原样;
 *   - 四个新章节(发条钟楼/泡泡浮岛/星糖工厂/月光大巡游)在选关地图上都在。
 * 跑法(playwright 是临时工具,没有进 package.json):
 *   npm i -D playwright --no-save && npx playwright install chromium --with-deps
 *   npx vite --port 5173
 *   node scripts/smoke-candy188.mjs
 * 必须连着源码跑(dev server):要 import sim.ts 把关卡自带的 solve 配方
 * 推成「第几秒割哪根绳」的动作表,再照着表在画布上真划。
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5173";
const VIEWPORT = { width: 375, height: 667 };
const STORE_KEY = "yiduo.candy-swing.campaign.v2";
const TOTAL = 188;
/** 画布内部坐标系宽度(index.ts 的 W) */
const W_WORLD = 360;

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

async function seedProgress(page, upTo) {
  await page.evaluate(
    ([key, n, total]) => {
      const stars = Array.from({ length: total }, (_, i) => (i < n - 1 ? 3 : 0));
      localStorage.setItem(key, JSON.stringify({ stars }));
    },
    [STORE_KEY, upTo, TOTAL]
  );
}

async function openLevel(page, id) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/candy-swing`, { waitUntil: "load" });
  await page.waitForSelector(".cs-lv", { timeout: 15000 });
  const clicked = await page.evaluate((lid) => {
    const cell = [...document.querySelectorAll(".cs-lv")].find(
      (c) => c.querySelector(".n")?.textContent === String(lid) && !c.classList.contains("locked")
    );
    if (!cell) return false;
    cell.click();
    return true;
  }, id);
  if (!clicked) return null;
  await page.waitForSelector(".cs-game:not(.cs-hidden)", { timeout: 5000 });
  return page.evaluate(() => document.querySelector(".cs-level")?.textContent ?? "");
}

/** 关卡自带 solve 配方 → 定时动作表(事件驱动的判定在仿真里跑一遍取时刻) */
async function planLevel(page, id) {
  return page.evaluate(async (lid) => {
    const sim = await import("/src/games/candy-swing/sim.ts");
    const lvs = await import("/src/games/candy-swing/levels.ts");
    const lv = lvs.LEVELS[lid - 1];
    const acts = [];
    const res = sim.playRecipeFor(lv, (a) => acts.push(a));
    return {
      ok: res.ate,
      acts,
      ropes: lv.ropes.map((r) => ({ x: r.x, y: r.y })),
      candy: { x: lv.candy.x, y: lv.candy.y },
      monster: { x: lv.monster.x, y: lv.monster.y },
      name: lv.name ?? "",
    };
  }, id);
}

async function canvasGeo(page) {
  return page.evaluate(() => {
    const cv = document.querySelector(".cs-canvas");
    const r = cv.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height, bw: cv.width, bh: cv.height };
  });
}

const toClient = (geo, wx, wy) => [
  geo.left + (wx / geo.bw) * geo.width,
  geo.top + (wy / geo.bh) * geo.height,
];

/**
 * 「割绳帘」:在绳子可能出现的高度带上来回横划一遍。
 * 绳段长 ~16px、判定半宽 10px,10px 一档的横线不可能漏掉挂着的绳子。
 */
async function curtainCut(page, geo, yTop, yBottom) {
  const xs = [8, W_WORLD - 8];
  let flip = false;
  const [sx, sy] = toClient(geo, xs[0], yTop);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let y = yTop; y <= yBottom; y += 10) {
    const [x1, y1] = toClient(geo, xs[flip ? 0 : 1], y);
    await page.mouse.move(x1, y1);
    const [x2, y2] = toClient(geo, xs[flip ? 0 : 1], Math.min(y + 10, yBottom));
    await page.mouse.move(x2, y2);
    flip = !flip;
  }
  await page.mouse.up();
}

/** 割单根绳:绕着这根绳的锚点画个叉,不碰别的绳 */
async function cutOneRope(page, geo, anchor) {
  const r = 26;
  const pts = [
    [anchor.x - r, anchor.y + 6],
    [anchor.x + r, anchor.y + 34],
    [anchor.x + r, anchor.y + 6],
    [anchor.x - r, anchor.y + 34],
  ];
  for (let i = 0; i < pts.length; i += 2) {
    const [sx, sy] = toClient(geo, pts[i][0], pts[i][1]);
    const [ex, ey] = toClient(geo, pts[i + 1][0], pts[i + 1][1]);
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (let k = 1; k <= 4; k++) {
      await page.mouse.move(sx + ((ex - sx) * k) / 4, sy + ((ey - sy) * k) / 4);
    }
    await page.mouse.up();
  }
}

async function tap(page, geo, x, y) {
  const [cx, cy] = toClient(geo, x, y);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.up();
}

async function outcome(page) {
  return page.evaluate(() => {
    const t = document.querySelector(".cs-msg")?.textContent ?? "";
    if (t.includes("吃到糖果")) return "win";
    if (t.includes("再来一次")) return "lose";
    return null;
  });
}

async function attempt(page, plan, geo, shiftMs) {
  const t0 = Date.now();
  const waitUntil = async (sec) => {
    const target = t0 + sec * 1000 + shiftMs;
    while (Date.now() < target - 2) {
      await page.waitForTimeout(Math.min(20, Math.max(1, target - Date.now())));
    }
  };
  for (const act of plan.acts) {
    await waitUntil(act.at);
    if (act.do === "cut") {
      const yTop = Math.min(...plan.ropes.map((r) => r.y)) + 8;
      await curtainCut(page, geo, yTop, Math.max(yTop + 20, plan.candy.y + 40));
    } else if (act.do === "cutRope") {
      await cutOneRope(page, geo, plan.ropes[act.i ?? 0]);
    } else {
      // pop / puff 都是轻点:泡泡戳破点糖果附近,吹气球点气球
      await tap(page, geo, plan.candy.x, plan.candy.y);
    }
    const now = await outcome(page);
    if (now) return now;
  }
  const deadline = Date.now() + 14000;
  while (Date.now() < deadline) {
    const now = await outcome(page);
    if (now) return now;
    await page.waitForTimeout(150);
  }
  return null;
}

async function playLevel(page, id) {
  const plan = await planLevel(page, id);
  log(plan.ok, `第 ${id} 关「${plan.name}」的 solve 配方在仿真里能吃到糖`, JSON.stringify(plan.acts));

  const geo = await canvasGeo(page);
  const over = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  log(over.scroll <= over.client + 2, `第 ${id} 关竖屏无横向溢出`, `${over.scroll}/${over.client}`);
  const fits =
    geo.left >= -2 &&
    geo.left + geo.width <= VIEWPORT.width + 2 &&
    geo.top >= 0 &&
    geo.top + geo.height <= VIEWPORT.height;
  log(
    fits,
    `第 ${id} 关画布整块落在 375×667 首屏内(不用滚动就能划绳)`,
    `canvas ${Math.round(geo.width)}×${Math.round(geo.height)} @top=${Math.round(geo.top)}`
  );
  // 糖果起点与怪物嘴巴都得在可点区域里
  const [, candyY] = toClient(geo, plan.candy.x, plan.candy.y);
  const [, monY] = toClient(geo, plan.monster.x, plan.monster.y);
  log(
    candyY > 0 && candyY < VIEWPORT.height && monY > 0 && monY < VIEWPORT.height,
    `第 ${id} 关糖果与啾啾都在屏内`,
    `candyY=${Math.round(candyY)} monsterY=${Math.round(monY)}`
  );

  for (const shift of [0, -120, 120, -240]) {
    const res = await attempt(page, plan, geo, shift);
    if (res === "win") {
      const saved = await page.evaluate(
        ([key, lid]) => JSON.parse(localStorage.getItem(key) ?? "{}").stars?.[lid - 1] ?? 0,
        [STORE_KEY, id]
      );
      log(saved > 0, `第 ${id} 关真实划绳通关并写进存档`, `⭐${saved}(偏移 ${shift}ms)`);
      await page.screenshot({ path: `/tmp/candy-${id}-win.png` });
      return true;
    }
    // 输了或没动静:按重试从头再来
    await page.locator(".cs-retry").click();
    await page.waitForTimeout(500);
  }
  log(false, `第 ${id} 关真实划绳通关`, "四次时机偏移都没吃到");
  await page.screenshot({ path: `/tmp/candy-${id}-fail.png` });
  return false;
}

async function checkLegacySave(page) {
  await page.goto(BASE, { waitUntil: "load" });
  await page.evaluate((key) => {
    const stars = Array.from({ length: 99 }, (_, i) => (i % 3) + 1);
    localStorage.setItem(key, JSON.stringify({ stars }));
  }, STORE_KEY);
  await page.goto(`${BASE}/?t=${Date.now()}#/game/candy-swing`, { waitUntil: "load" });
  await page.waitForSelector(".cs-lv", { timeout: 15000 });

  // 上锁的格子写的是 🔒 不是关号,只能按 DOM 顺序对应关卡
  const view = await page.evaluate(() =>
    ({
      cells: [...document.querySelectorAll(".cs-lv")].map((c) => ({
        label: c.querySelector(".n")?.textContent ?? "",
        stars: c.querySelector(".s")?.textContent ?? "",
        locked: c.classList.contains("locked"),
      })),
      chapters: [...document.querySelectorAll(".cs-ch-name")].map((e) => e.textContent),
      total: document.querySelector(".cs-map-total")?.textContent ?? "",
    }));
  const cellOf = (lv) => view.cells[lv - 1];
  log(view.cells.length === TOTAL, `选关地图共 ${TOTAL} 个关卡格`, `count=${view.cells.length}`);
  log(view.total.includes(`共 ${TOTAL} 关`), "地图顶部写着共 188 关", view.total);
  let starsOk = true;
  for (let i = 1; i <= 99; i++) {
    const want = ((i - 1) % 3) + 1;
    const cell = cellOf(i);
    const ok = cell?.label === String(i) && cell.stars === "★".repeat(want) + "☆".repeat(3 - want);
    if (!ok) {
      starsOk = false;
      console.log(`       第 ${i} 关不符:${JSON.stringify(cell)},应是 ${want} 星`);
      break;
    }
  }
  log(starsOk, "老存档前 99 关星级逐关原样显示");
  log(
    cellOf(100) && !cellOf(100).locked && cellOf(100).stars === "☆☆☆",
    "第 100 关随 1.0 老存档自然解锁且是 0 星新关",
    JSON.stringify(cellOf(100) ?? null)
  );
  log(cellOf(101)?.locked === true, "第 101 关仍锁着(要先打通 100)", JSON.stringify(cellOf(101) ?? null));
  const want = ["发条钟楼", "泡泡浮岛", "星糖工厂", "月光大巡游"];
  const missing = want.filter((n) => !view.chapters.some((c) => c?.includes(n)));
  log(missing.length === 0, "四个新章节都在选关地图上", view.chapters.slice(6).join(" / "));
  log(view.chapters.length === 10, "共 10 章", `chapters=${view.chapters.length}`);
}

async function main() {
  // 沙盒里没装 playwright 自带的 chromium 时,回落到系统 chrome
  const executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, hasTouch: false });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(BASE, { waitUntil: "load" });

  for (const id of [100, 145, 188]) {
    console.log(`\n=== 糖果秋千 第 ${id} 关 ===`);
    await seedProgress(page, id);
    const badge = await openLevel(page, id);
    if (badge === null) {
      log(false, `第 ${id} 关能从选关地图打开`);
      continue;
    }
    log(badge.includes(String(id)), `第 ${id} 关能从选关地图打开`, badge);
    await playLevel(page, id);
  }

  console.log("\n=== 老存档兼容(1.0 → 1.1)===");
  await checkLegacySave(page);

  log(errors.length === 0, "全程没有页面报错", errors.slice(0, 3).join(" | "));

  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n合计 ${results.length} 项,通过 ${results.length - bad.length},失败 ${bad.length}`);
  process.exit(bad.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
