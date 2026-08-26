/**
 * 1.1 第 5 步 A 的手动冒烟替身:用真浏览器(375×667 竖屏)把弹弹小鸟的
 * 第 100 / 145 / 188 关一路弹到真实胜负,并检查:
 *   - 窄屏无横向溢出、画布不被压扁、弹弓能完整拉满;
 *   - 1.0 老存档(99 个星级键位)读出来前 99 关星级原样、第 100 关自然解锁。
 * 跑法(playwright 是临时工具,没有进 package.json):
 *   npm i -D playwright --no-save && npx playwright install chromium --with-deps
 *   npx vite --port 5173
 *   node scripts/smoke-sling188.mjs
 * 它必须连着源码跑(dev server):要 import physics.ts 的弹道模拟反推拖拽向量,
 * 再用鼠标在真实画布上拉弓发射。
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5173";
const VIEWPORT = { width: 375, height: 667 };
const STORE_KEY = "yiduo-yixing.sling-birds.v2";

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

/**
 * 每关的「射击脚本」:target 是希望命中的世界坐标;clear 是弹道前段必须
 * 高于(y 小于)某高度的横向区间,用来避开挡路的柱子/传送门;
 * tap: true 表示到达最近点时点屏幕放技能(墩墩下砸等)。
 */
const PLANS = {
  100: [
    { target: [424, 268], clear: [[408, 421, 280]] },
    { target: [484, 300], clear: [[450, 472, 244]] },
    { target: [484, 300], clear: [[450, 472, 244]] }
  ],
  145: [
    { target: [360, 100], clear: [[235, 265, 138]] },
    { target: [419, 268], clear: [[235, 265, 138], [398, 416, 280]] },
    { target: [480, 246], clear: [[235, 265, 138], [452, 476, 248]] },
    { target: [480, 246], clear: [[452, 476, 248]] }
  ],
  188: [
    // 卷卷:直取气球(绕开传送门口)
    { target: [330, 92], clear: [[237, 267, 111]] },
    // 闪闪:高抛砸岩壳顶上的豆豆
    { target: [411, 198], clear: [[237, 267, 111]] },
    // 墩墩:飞到石梁上空点屏下砸——砸穿石梁引爆 TNT,清掉亭子里的豆豆
    { target: [430, 165], clear: [[237, 267, 111], [370, 428, 200]], tap: true },
    // 云云:弧线越过堡垒,落到右侧木箱上的豆豆
    { target: [505, 272], clear: [[237, 267, 111], [372, 464, 238], [394, 428, 202]] },
    // 两只糯糯补漏:再打一次高塔豆与木箱豆
    { target: [411, 198], clear: [[237, 267, 111]] },
    { target: [505, 272], clear: [[372, 464, 238], [394, 428, 202]] }
  ]
};

/** 写入进度:前 upTo-1 关全 3 星,当前章节切到目标关所在章 */
async function seedProgress(page, upTo) {
  await page.evaluate(
    ([key, n]) => {
      const stars = {};
      for (let i = 1; i < n; i++) stars[String(i)] = 3;
      const sizes = [15, 15, 15, 15, 20, 19, 30, 30, 29];
      let c = 0;
      let start = 1;
      while (c < sizes.length - 1 && n >= start + sizes[c]) {
        start += sizes[c];
        c++;
      }
      localStorage.setItem(key, JSON.stringify({ stars, resume: null, chapter: c }));
    },
    [STORE_KEY, upTo]
  );
}

async function openLevel(page, id) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/sling-birds`, { waitUntil: "load" });
  await page.waitForSelector(".slb-cell", { timeout: 15000 });
  const clicked = await page.evaluate((lid) => {
    const cell = [...document.querySelectorAll(".slb-cell")].find(
      (c) => c.querySelector("span")?.textContent === String(lid) && !c.disabled
    );
    if (!cell) return false;
    cell.click();
    return true;
  }, id);
  if (!clicked) return false;
  await page.waitForTimeout(600);
  return page.evaluate(() => document.querySelector(".slb-play")?.style.display !== "none");
}

/** 画布几何:世界坐标 → 浏览器坐标(竖屏时上方延展了天空) */
async function canvasGeo(page) {
  return page.evaluate(async () => {
    const phys = await import("/src/games/sling-birds/physics.ts");
    const cv = document.querySelector(".slb-canvas");
    const r = cv.getBoundingClientRect();
    return {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      bufH: cv.height,
      skyPad: phys.padSplit(cv.height).sky,
      worldW: phys.WORLD_W,
      slingX: phys.SLING_X,
      slingY: phys.SLING_Y,
      maxDrag: phys.MAX_DRAG
    };
  });
}

/**
 * 在页面里用真实弹道模拟(physics.ts 的 simulateTrajectory,含风区与重力系数)
 * 扫描拖拽角度 × 力度,选出离目标最近、且前段避开 clear 区的一发。
 */
async function planShot(page, levelId, birdIndex, spec) {
  return page.evaluate(
    async ([lid, bi, sp]) => {
      const phys = await import("/src/games/sling-birds/physics.ts");
      const lvs = await import("/src/games/sling-birds/levels.ts");
      const lv = lvs.LEVELS.find((l) => l.id === lid);
      const kind = lv.birds[Math.min(bi, lv.birds.length - 1)];
      const gf = kind === "straight" ? 0.75 : 1;
      const winds = lv.winds ?? [];
      let best = null;
      for (let deg = 6; deg <= 84; deg += 1.5) {
        for (let f = 0.45; f <= 1.001; f += 0.05) {
          const rad = (deg * Math.PI) / 180;
          const dx = -Math.cos(rad) * phys.MAX_DRAG * f;
          const dy = Math.sin(rad) * phys.MAX_DRAG * f;
          const v = phys.launchVelocity(dx, dy);
          const pts = phys.simulateTrajectory(
            phys.SLING_X + dx,
            phys.SLING_Y + dy,
            v.vx,
            v.vy,
            gf,
            winds,
            160,
            0.02
          );
          let bestIdx = 0;
          let bestD = 1e9;
          for (let i = 0; i < pts.length; i++) {
            const d = Math.hypot(pts[i].x - sp.target[0], pts[i].y - sp.target[1]);
            if (d < bestD) {
              bestD = d;
              bestIdx = i;
            }
          }
          let ok = true;
          for (const cz of sp.clear ?? []) {
            for (let i = 0; i <= bestIdx && ok; i++) {
              const p = pts[i];
              if (p.x >= cz[0] && p.x <= cz[1] && p.y > cz[2]) ok = false;
            }
            if (!ok) break;
          }
          if (!ok) continue;
          if (!best || bestD < best.score) {
            best = { dx, dy, score: bestD, tapAfterMs: sp.tap ? Math.round(bestIdx * 20) : null };
          }
        }
      }
      return best;
    },
    [levelId, birdIndex, spec]
  );
}

async function fireShot(page, geo, plan) {
  const toClient = (wx, wy) => [
    geo.left + (wx / geo.worldW) * geo.width,
    geo.top + ((wy + geo.skyPad) / geo.bufH) * geo.height
  ];
  const [sx, sy] = toClient(geo.slingX, geo.slingY);
  const [ex, ey] = toClient(geo.slingX + plan.dx, geo.slingY + plan.dy);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(sx + ((ex - sx) * i) / 6, sy + ((ey - sy) * i) / 6);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(90);
  await page.mouse.up();
  if (plan.tapAfterMs != null) {
    await page.waitForTimeout(plan.tapAfterMs);
    await page.mouse.down();
    await page.mouse.up();
  }
}

/** 等这一发的余波:胜负弹窗出现返回结果,否则等到场面差不多静止 */
async function settle(page, ms = 5600) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const outcome = await page.evaluate(() => {
      if (document.querySelector(".dialog--win")) return "win";
      if (document.querySelector(".dialog--lose")) return "lose";
      return null;
    });
    if (outcome) return outcome;
    await page.waitForTimeout(250);
  }
  return null;
}

async function checkNoOverflow(page, label) {
  const over = await page.evaluate(() => {
    const d = document.documentElement;
    return { scroll: d.scrollWidth, client: d.clientWidth };
  });
  log(over.scroll <= over.client + 2, `${label} 竖屏无横向溢出`, `${over.scroll}/${over.client}`);
}

async function playLevel(page, id, maxAttempts = 5) {
  const plan = PLANS[id];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt === 1) {
      await seedProgress(page, id);
      const opened = await openLevel(page, id);
      if (!opened) {
        log(false, `第 ${id} 关能从选关地图打开`);
        return false;
      }
      log(true, `第 ${id} 关能从选关地图打开`);
      await checkNoOverflow(page, `第 ${id} 关`);
      const geo = await canvasGeo(page);
      // 竖屏可完整拉满:弹弓拉到最远点仍在画布(=屏幕)内
      const pullOk =
        geo.width > 0 &&
        geo.left >= -2 &&
        geo.left + geo.width <= VIEWPORT.width + 2 &&
        geo.top + ((geo.slingY + geo.maxDrag + geo.skyPad) / geo.bufH) * geo.height <=
          VIEWPORT.height;
      log(pullOk, `第 ${id} 关画布贴合竖屏、弹弓可完整拉满`, `canvas ${Math.round(geo.width)}×${Math.round(geo.height)}`);
    }
    const geo = await canvasGeo(page);
    let outcome = null;
    for (let shot = 0; shot < plan.length; shot++) {
      const p = await planShot(page, id, shot, plan[shot]);
      if (!p) {
        console.log(`       第 ${id} 关第 ${shot + 1} 发找不到满足避障的弹道,直接裸瞄`);
        continue;
      }
      await fireShot(page, geo, p);
      outcome = await settle(page);
      if (outcome) break;
    }
    if (!outcome) outcome = await settle(page, 14000); // 小鸟用完,等判负/判胜
    if (outcome === "win") {
      const title = (await page.locator(".result-title").first().textContent())?.trim() ?? "";
      log(true, `第 ${id} 关实玩到真实通关`, `${title}(第 ${attempt} 次尝试)`);
      await page.screenshot({ path: `/tmp/sling-${id}-win.png` });
      return true;
    }
    // 输了:点「再玩一次」原地重试
    if (outcome === "lose" && attempt < maxAttempts) {
      await page.locator(".dialog--lose .btn--primary").click({ force: true });
      await page.waitForTimeout(900);
    }
  }
  log(false, `第 ${id} 关实玩到真实通关`, `${maxAttempts} 次尝试都没赢`);
  await page.screenshot({ path: `/tmp/sling-${id}-fail.png` });
  return false;
}

async function checkLegacySave(page) {
  await page.goto(BASE, { waitUntil: "load" });
  await page.evaluate((key) => {
    const stars = {};
    for (let i = 1; i <= 99; i++) stars[String(i)] = (i % 3) + 1;
    localStorage.setItem(key, JSON.stringify({ stars, resume: null, chapter: 5 }));
  }, STORE_KEY);
  await page.goto(`${BASE}/?t=${Date.now()}#/game/sling-birds`, { waitUntil: "load" });
  await page.waitForSelector(".slb-cell", { timeout: 15000 });

  const raw = await page.evaluate((key) => localStorage.getItem(key), STORE_KEY);
  const parsed = JSON.parse(raw ?? "{}");
  const keys = Object.keys(parsed.stars ?? {});
  const intact =
    keys.length === 99 && keys.every((k) => parsed.stars[k] === (Number(k) % 3) + 1);
  log(intact, "老存档 99 个星级键位读写后原样保留", `keys=${keys.length}`);

  const shown = await page.evaluate(() => {
    const out = {};
    const tabs = [...document.querySelectorAll(".slb-tab")];
    for (const tab of tabs) {
      if (tab.disabled) continue;
      tab.click();
      for (const cell of document.querySelectorAll(".slb-cell")) {
        const id = cell.querySelector("span")?.textContent ?? "";
        const st = cell.querySelector(".slb-stars")?.textContent ?? "";
        if (/^\d+$/.test(id)) out[id] = { stars: st, locked: cell.classList.contains("slb-lock") };
      }
    }
    return { cells: out, tabCount: tabs.length, windTabOpen: !tabs[6]?.disabled, mineTabOpen: !tabs[7]?.disabled };
  });
  let starsMatch = true;
  for (let i = 1; i <= 99; i++) {
    const want = (i % 3) + 1;
    const got = shown.cells[String(i)]?.stars ?? "";
    if (got !== "★".repeat(want) + "☆".repeat(3 - want)) {
      starsMatch = false;
      console.log(`       第 ${i} 关星级不符:${got}`);
      break;
    }
  }
  log(starsMatch, "地图上前 99 关星级逐关原样显示");
  log(shown.tabCount === 9, "选关地图共 9 个章节页签", `tabs=${shown.tabCount}`);
  log(
    shown.windTabOpen && shown.cells["100"] && !shown.cells["100"].locked,
    "第 100 关(风车高地)随老存档自然解锁",
    JSON.stringify(shown.cells["100"] ?? null)
  );
  log(shown.mineTabOpen === false, "冰晶矿洞仍需打过第 129 关才解锁");
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    hasTouch: false
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(BASE, { waitUntil: "load" });

  for (const id of [100, 145, 188]) {
    console.log(`\n=== 弹弹小鸟 第 ${id} 关 ===`);
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
