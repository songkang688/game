/**
 * 1.1 第 3 步 A 的手动冒烟替身：用真浏览器把四款休闲游戏
 * （气球砰砰 / 碰碰砖块 / 泡泡噗噗 / 接住小水果）的第 100/140/188 关
 * 一路玩到真实胜负，并检查窄屏不溢出、老存档不丢。
 * 跑法（playwright 是临时工具，没有进 package.json）：
 *   npm i -D playwright --no-save && npx playwright install chromium --with-deps
 *   npx vite --port 5173
 *   node scripts/smoke188-casual.mjs      # 也可以 SMOKE_ONLY=balloon-pop 只跑一款
 * 手感类关卡拿不到「标准答案」，所以带 ?smoke=1 让游戏把逐帧状态镜像到 dataset，
 * 自动玩家读镜像、点真实 UI（和真人手指一样走 pointer 事件）。
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5173";
const LEVELS = [99, 139, 187]; // 0 基：第 100 / 140 / 188 关
const VIEWPORT = { width: 375, height: 667 };

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

/** 把存档写成「前 target 关都拿过 3 星」，好让 target 关解锁 */
async function seedProgress(page, gameId, target) {
  await page.evaluate(
    ([id, n]) => {
      const stars = Array.from({ length: 188 }, (_, i) => (i < n ? 3 : 0));
      localStorage.setItem(`yiduo-yixing.l99.${id}`, JSON.stringify(stars));
    },
    [gameId, target]
  );
}

async function openLevel(page, gameId, level) {
  await page.goto(`${BASE}/?smoke=1&t=${Date.now()}#/game/${gameId}`, { waitUntil: "load" });
  await page.waitForSelector(".l99-grid", { timeout: 15000 });
  const tabs = page.locator(".l99-tab");
  const tabCount = await tabs.count();
  for (let i = 0; i < tabCount; i++) {
    await tabs.nth(i).click({ force: true });
    await page.waitForTimeout(120);
    const node = page.locator(`.l99-node[aria-label^="第 ${level + 1} 关"]:not(.l99-node-lock)`);
    if ((await node.count()) > 0) {
      await node.first().click({ force: true });
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

/** 等到过关 / 失败浮层出现，返回标题文字 */
async function waitOutcome(page, timeout = 240000) {
  await page.waitForSelector(".l99-ov-title", { timeout });
  return (await page.locator(".l99-ov-title").first().textContent())?.trim() ?? "";
}

async function checkNoOverflow(page, label) {
  const over = await page.evaluate(() => {
    const d = document.documentElement;
    return { scroll: d.scrollWidth, client: d.clientWidth };
  });
  log(over.scroll <= over.client + 2, `${label} 窄屏无横向溢出`, `${over.scroll}/${over.client}`);
}

// --------------------------------------------------------------------------
// 气球砰砰：读指令徽章 + 气球 dataset，只戳该戳的
// --------------------------------------------------------------------------
async function playBalloon(page) {
  await page.waitForSelector(".blp-sky", { timeout: 15000 });
  for (let guard = 0; guard < 2000; guard++) {
    if ((await page.locator(".l99-ov-title").count()) > 0) break;
    await page.evaluate(() => {
      const order = document.querySelector(".blp-order")?.textContent ?? "";
      const fire = (el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
      let colorIdx = -1;
      let num = -1;
      const cm = /戳(红|黄|蓝|绿|紫)色/.exec(order);
      if (cm) colorIdx = ["红", "黄", "蓝", "绿", "紫"].indexOf(cm[1]);
      const nm = /(?:下一个：|得数 )(\d)/.exec(order);
      if (nm) num = Number(nm[1]);
      for (const el of document.querySelectorAll(".blp-balloon:not(.blp-pop)")) {
        const k = el.dataset.kind;
        if (k === "cloud") continue;
        if (k === "rainbow" || k === "chain") { fire(el); continue; }
        if (colorIdx >= 0 && Number(el.dataset.color) !== colorIdx) continue;
        if (num >= 0 && Number(el.dataset.num) !== num) continue;
        fire(el);
        if (el.dataset.shield === "1") fire(el);
        // 顺序 / 颜色指令模式一次只戳一个，戳完重新读指令，免得指令换了还照旧戳
        if (num >= 0 || colorIdx >= 0) break;
      }
    });
    await page.waitForTimeout(120);
  }
  return waitOutcome(page);
}

// --------------------------------------------------------------------------
// 碰碰砖块：球拍逐帧追着最低的那颗球走（dataset 镜像 → pointermove）
// --------------------------------------------------------------------------
async function playBrick(page) {
  await page.waitForSelector(".bb-canvas", { timeout: 15000 });
  await page.evaluate(() => {
    const follow = () => {
      const canvas = document.querySelector(".bb-canvas");
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const balls = (canvas.dataset.balls ?? "").split(";").filter(Boolean).map((s) => s.split(",").map(Number));
      if (!balls.length) return;
      let target = balls[0];
      for (const b of balls) if (b[1] > target[1]) target = b;
      // 瞄准点带一个缓慢摆动的偏移：反弹角持续变化，球才不会
      // 在没有砖的竖直列里上下打转（正好居中接球时 vx 会归零）
      const sway = 20 * Math.sin(performance.now() / 650);
      const aim = Math.max(10, Math.min(350, target[0] + sway));
      window.__bbAim = aim;
      canvas.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        clientX: rect.left + (aim / 360) * rect.width,
        clientY: rect.top + rect.height * 0.9,
      }));
    };
    window.__bbDrive = setInterval(follow, 25);
    // 发球 / 丢球后重发：pointerdown 打在当前跟随点，不会把拍子拽偏
    window.__bbLaunch = setInterval(() => {
      const canvas = document.querySelector(".bb-canvas");
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const aim = typeof window.__bbAim === "number" ? window.__bbAim : 180;
      canvas.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: rect.left + (aim / 360) * rect.width,
        clientY: rect.top + rect.height * 0.9,
      }));
    }, 800);
  });
  const outcome = await waitOutcome(page);
  await page.evaluate(() => {
    clearInterval(window.__bbDrive);
    clearInterval(window.__bbLaunch);
  });
  return outcome;
}

// --------------------------------------------------------------------------
// 泡泡噗噗：读格子 dataset 还原棋盘，用真实逻辑模块做一步前瞻 + 贪心推演
// --------------------------------------------------------------------------
async function playBubble(page, level) {
  await page.waitForSelector(".bp-board", { timeout: 15000 });
  for (let guard = 0; guard < 400; guard++) {
    if ((await page.locator(".l99-ov-title").count()) > 0) break;
    const status = await page.evaluate(async ([lv]) => {
      const logic = await import("/src/games/bubble-pop/logic.ts");
      const lvmod = await import("/src/games/bubble-pop/levels.ts");
      const cfg = lvmod.LEVELS[lv];
      const cells = [...document.querySelectorAll(".bp-cell")];
      if (!cells.length) return "no-board";
      const COLS = 8;
      const rows = cells.length / COLS;
      const grid = [];
      for (let r = 0; r < rows; r++) grid.push(cells.slice(r * COLS, r * COLS + COLS).map((el) => Number(el.dataset.v)));
      // 1) 先点亮所有隐藏泡泡（点亮不耗步）
      for (let i = 0; i < cells.length; i++) {
        if (logic.isHidden(grid[Math.floor(i / COLS)][i % COLS])) {
          cells[i].click();
          return "revealed";
        }
      }
      const gravityUp = (document.querySelector(".bp-grav")?.textContent ?? "").includes("⬆️");
      const clone = (g) => g.map((r) => r.slice());
      const popList = (g, list) => {
        for (const [r, c] of list) g[r][c] = -1;
        for (const [r, c] of list) {
          for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
            if (nr < 0 || nr >= g.length || nc < 0 || nc >= COLS) continue;
            if (logic.isFrozen(g[nr][nc])) g[nr][nc] -= 10;
          }
        }
      };
      const candidates = (g) => {
        const seen = new Set();
        const out = [];
        for (let r = 0; r < g.length; r++) {
          for (let c = 0; c < COLS; c++) {
            const v = g[r][c];
            if (v === logic.BOLT || v === logic.RAINBOW) { out.push({ r, c, kind: v }); continue; }
            const grp = logic.groupAt(g, COLS, r, c, cfg.colors);
            if (grp.length >= 2) {
              const key = Math.min(...grp.map(([a, b]) => a * COLS + b));
              if (!seen.has(key)) { seen.add(key); out.push({ r, c, kind: "group", size: grp.length }); }
            }
          }
        }
        return out;
      };
      const applyMove = (g, m, up) => {
        if (m.kind === logic.RAINBOW) {
          const counts = new Array(cfg.colors).fill(0);
          for (const row of g) for (const v of row) { const col = logic.colorOf(v, cfg.colors); if (col >= 0) counts[col]++; }
          let best = 0;
          for (let i = 1; i < cfg.colors; i++) if (counts[i] > counts[best]) best = i;
          const list = [[m.r, m.c]];
          for (let r = 0; r < g.length; r++) for (let c = 0; c < COLS; c++) {
            if (logic.colorOf(g[r][c], cfg.colors) === best) list.push([r, c]);
          }
          popList(g, list);
        } else if (m.kind === logic.BOLT) {
          const list = [];
          for (let c = 0; c < COLS; c++) { const v = g[m.r][c]; if (v >= 0 && v !== logic.STONE) list.push([m.r, c]); }
          for (let r = 0; r < g.length; r++) { if (r === m.r) continue; const v = g[r][m.c]; if (v >= 0 && v !== logic.STONE) list.push([r, m.c]); }
          for (const [r, c] of list) if (logic.isFrozen(g[r][c])) g[r][c] -= 10;
          popList(g, list);
        } else {
          popList(g, logic.groupAt(g, COLS, m.r, m.c, cfg.colors));
        }
        if ((cfg.chameleon ?? 0) > 0) logic.cycleChameleons(g, cfg.colors);
        let nup = up;
        if (cfg.flipGravity) nup = !nup;
        logic.collapseGrid(g, COLS, nup);
        return nup;
      };
      const rollout = (g0, up0) => {
        const g = clone(g0);
        let up = up0;
        for (let step = 0; step < 200; step++) {
          const cands = candidates(g);
          if (!cands.length) break;
          let best = null;
          for (const m of cands) {
            const score = m.kind === "group" ? m.size : 1.5;
            if (!best || score > best.score) best = { ...m, score };
          }
          up = applyMove(g, best, up);
        }
        return logic.countLeftOn(g);
      };
      const cands = candidates(grid);
      if (!cands.length) return "stuck";
      let pick = null;
      for (const m of cands) {
        const g = clone(grid);
        const up = applyMove(g, m, gravityUp);
        const left = rollout(g, up);
        if (!pick || left < pick.left) pick = { m, left };
      }
      cells[pick.m.r * COLS + pick.m.c].click();
      return `clicked:${pick.left}`;
    }, [level]);
    if (status === "stuck" || status === "no-board") break;
    await page.waitForTimeout(status === "revealed" ? 140 : 320);
  }
  return waitOutcome(page, 30000);
}

// --------------------------------------------------------------------------
// 接住小水果：篮子逐帧追最低的好果子，坏东西靠近接果带就侧身让开
// --------------------------------------------------------------------------
async function playFruit(page, level) {
  await page.waitForSelector(".fc-canvas", { timeout: 15000 });
  await page.evaluate(async ([lv]) => {
    const lvmod = await import("/src/games/fruit-catch/levels.ts");
    const baskets = lvmod.LEVELS[lv].baskets ?? 1;
    const W = 360;
    const H = 460;
    window.__fcDown = false;
    window.__fcDrive = setInterval(() => {
      const canvas = document.querySelector(".fc-canvas");
      if (!canvas || !canvas.dataset.items) return;
      const rect = canvas.getBoundingClientRect();
      const items = JSON.parse(canvas.dataset.items);
      const good = items.filter((i) => i[2] !== "bad" && i[1] < H - 8);
      let aim = W / 2;
      if (good.length) {
        let t = good[0];
        for (const g of good) if (g[1] > t[1]) t = g;
        aim = t[0];
      }
      const bads = items.filter((i) => i[2] === "bad" && i[1] > H - 150);
      const nearBad = (x) => bads.some((b) => Math.abs(b[0] - x) < 42 || (baskets > 1 && Math.abs(b[0] - (W - x)) < 42));
      if (nearBad(aim)) {
        const alt1 = Math.min(W - 28, aim + 60);
        const alt2 = Math.max(28, aim - 60);
        aim = nearBad(alt1) ? alt2 : alt1;
      }
      const clientX = rect.left + (aim / W) * rect.width;
      const clientY = rect.top + rect.height * 0.5;
      const type = window.__fcDown ? "pointermove" : "pointerdown";
      window.__fcDown = true;
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX, clientY }));
    }, 25);
  }, [level]);
  const outcome = await waitOutcome(page);
  await page.evaluate(() => clearInterval(window.__fcDrive));
  return outcome;
}

const ALL_GAMES = [
  { id: "balloon-pop", name: "气球砰砰", play: (p, lv) => playBalloon(p, lv) },
  { id: "brick-break", name: "碰碰砖块", play: (p, lv) => playBrick(p, lv) },
  { id: "bubble-pop", name: "泡泡噗噗", play: (p, lv) => playBubble(p, lv) },
  { id: "fruit-catch", name: "接住小水果", play: (p, lv) => playFruit(p, lv) },
];
const GAMES = process.env.SMOKE_ONLY
  ? ALL_GAMES.filter((g) => process.env.SMOKE_ONLY.split(",").includes(g.id))
  : ALL_GAMES;

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(BASE, { waitUntil: "load" });

  for (const g of GAMES) {
    console.log(`\n=== ${g.name} (${g.id}) ===`);
    for (const lv of LEVELS) {
      await seedProgress(page, g.id, lv);
      const opened = await openLevel(page, g.id, lv);
      if (!opened) {
        log(false, `${g.name} 第 ${lv + 1} 关能打开`);
        continue;
      }
      let outcome = "";
      try {
        outcome = await g.play(page, lv);
      } catch (e) {
        log(false, `${g.name} 第 ${lv + 1} 关玩到真实胜负`, String(e).slice(0, 160));
        continue;
      }
      log(/过关/.test(outcome), `${g.name} 第 ${lv + 1} 关玩到真实通关`, outcome);
      await checkNoOverflow(page, `${g.name} 第 ${lv + 1} 关`);
    }
  }

  // --- 老存档不丢：写一个 1.0 时代长度 99 的存档，前 99 关星级要原样显示 ---
  console.log("\n=== 老存档兼容 ===");
  for (const g of GAMES) {
    await page.goto(BASE, { waitUntil: "load" });
    await page.evaluate((id) => {
      const legacy = Array.from({ length: 99 }, (_, i) => (i % 3) + 1);
      localStorage.setItem(`yiduo-yixing.l99.${id}`, JSON.stringify(legacy));
    }, g.id);
    await page.goto(`${BASE}/?t=${Date.now()}#/game/${g.id}`, { waitUntil: "load" });
    await page.waitForSelector(".l99-grid", { timeout: 15000 });

    const raw = await page.evaluate((id) => localStorage.getItem(`yiduo-yixing.l99.${id}`), g.id);
    log(JSON.parse(raw ?? "[]").length === 99, `${g.name} 老存档原封不动没被改写`, `len=${JSON.parse(raw ?? "[]").length}`);
    const migrated = await page.evaluate(async (id) => {
      const mod = await import("/src/games/level99.ts");
      return mod.loadStars(id);
    }, g.id);
    const head = Array.from({ length: 99 }, (_, i) => (i % 3) + 1);
    const kept = migrated.length === 188
      && head.every((v, i) => migrated[i] === v)
      && migrated.slice(99).every((v) => v === 0);
    log(kept, `${g.name} 读出来补到 188 且前 99 关星级原样`, `len=${migrated.length}`);

    const shown = await page.evaluate(() => {
      const out = {};
      const tabs = [...document.querySelectorAll(".l99-tab")];
      for (const tab of tabs) {
        tab.click();
        for (const n of document.querySelectorAll(".l99-node")) {
          const label = n.getAttribute("aria-label") ?? "";
          const m = /^第 (\d+) 关，(.+)$/.exec(label);
          if (m) out[m[1]] = m[2];
        }
      }
      return out;
    });
    const allMatch = head.every((v, i) => shown[String(i + 1)] === `已通关 ${v} 星`);
    log(allMatch, `${g.name} 地图上前 99 关星级逐关原样显示`, `第99关=${shown["99"] ?? "未找到"}`);
    log(shown["100"] === "还没通关", `${g.name} 第 100 关随老存档自然解锁`, shown["100"] ?? "未找到");
  }

  log(errors.length === 0, "全程没有页面报错", errors.slice(0, 3).join(" | "));

  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n合计 ${results.length} 项，通过 ${results.length - bad.length}，失败 ${bad.length}`);
  process.exit(bad.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
