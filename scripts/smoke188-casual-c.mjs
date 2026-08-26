/**
 * 1.1 第 3 步 C 的手动冒烟替身：用真浏览器把三款休闲益智游戏
 * （地鼠嘭嘭 / 拼图乐园 / 贪吃毛毛虫）的第 100/140/188 关一路玩到真实胜负，
 * 顺便点开三款的无尽模式入口，并检查 375×667 窄屏不横向溢出、老存档不丢。
 * 跑法（playwright 是临时工具，没有进 package.json）：
 *   npm i -D playwright --no-save && npx playwright install chromium --with-deps
 *   npx vite --port 5175
 *   SMOKE_BASE=http://localhost:5175 node scripts/smoke188-casual-c.mjs
 *   # 也可以 SMOKE_ONLY=mole-pop 只跑一款
 * 手感类关卡拿不到「标准答案」，所以带 ?smoke=1 让拼图和毛毛虫把逐帧状态镜像到
 * dataset，自动玩家读镜像、点真实 UI（和真人手指一样走真实事件）。
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5173";
// 0 基：第 100 / 140 / 188 关（SMOKE_LEVELS 可以只挑其中几关重跑）
const LEVELS = (process.env.SMOKE_LEVELS ?? "99,139,187").split(",").map(Number);
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
      await page.waitForTimeout(400);
      return true;
    }
  }
  return false;
}

/** 等到过关 / 失败浮层出现，返回标题文字 */
async function waitOutcome(page, timeout = 300000) {
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
// 地鼠嘭嘭：读地洞里的脸，算式鼠先算得数再决定拍不拍，小兔子一律不碰
// --------------------------------------------------------------------------
async function playMole(page) {
  await page.waitForSelector(".mp-board", { timeout: 15000 });
  for (let guard = 0; guard < 4000; guard++) {
    if ((await page.locator(".l99-ov-title").count()) > 0) break;
    await page.evaluate(() => {
      const evalExpr = (s) => {
        const m = /^(\d+)([+\-×÷])(\d+)$/.exec(s.trim());
        if (!m) return NaN;
        const a = Number(m[1]);
        const b = Number(m[3]);
        if (m[2] === "+") return a + b;
        if (m[2] === "-") return a - b;
        if (m[2] === "×") return a * b;
        return b === 0 ? NaN : a / b;
      };
      const qnum = document.querySelector(".mp-qnum");
      const target = qnum ? Number(qnum.textContent) : NaN;
      for (const hole of document.querySelectorAll(".mp-hole")) {
        const card = hole.querySelector(".mp-card");
        if (card) {
          if (!Number.isNaN(target) && evalExpr(card.textContent ?? "") === target) {
            hole.click();
            return; // 出题关一次只拍一只，拍完重新读题
          }
          continue;
        }
        const face = (hole.textContent ?? "").trim();
        if (!face || face === "🐰") continue;
        hole.click();
      }
    });
    await page.waitForTimeout(70);
  }
  return waitOutcome(page);
}

// --------------------------------------------------------------------------
// 拼图乐园：三种板式都有确定解 —— 推格子照打乱的逆序点回去，
// 旋转块把每块点正，缺块补齐照托盘对应关系一块块放
// --------------------------------------------------------------------------
async function playPuzzle(page) {
  await page.waitForSelector(".pz-board", { timeout: 15000 });
  const kind = await page.evaluate(() => document.querySelector(".pz-board")?.dataset.kind ?? "");
  if (kind === "rotate") {
    const rot = await page.evaluate(() =>
      (document.querySelector(".pz-board")?.dataset.rot ?? "").split(",").filter(Boolean).map(Number)
    );
    for (let i = 0; i < rot.length; i++) {
      for (let k = (4 - rot[i]) % 4; k > 0; k--) {
        await page.locator(".pz-tile").nth(i).click({ force: true });
        await page.waitForTimeout(12);
      }
    }
  } else if (kind === "fill") {
    const { holes, tray } = await page.evaluate(() => {
      const d = document.querySelector(".pz-board")?.dataset ?? {};
      const list = (s) => (s ?? "").split(",").filter(Boolean).map(Number);
      return { holes: list(d.holes), tray: list(d.tray) };
    });
    for (const hole of holes) {
      const piece = tray.indexOf(hole);
      if (piece < 0) continue;
      await page.locator(".pz-piece").nth(piece).click({ force: true });
      await page.waitForTimeout(30);
      await page.locator(".pz-tile").nth(hole).click({ force: true });
      await page.waitForTimeout(30);
    }
  } else {
    const undo = await page.evaluate(() =>
      (document.querySelector(".pz-board")?.dataset.undo ?? "").split(",").filter(Boolean).map(Number)
    );
    for (const pos of undo) {
      await page.locator(".pz-tile").nth(pos).click({ force: true });
      await page.waitForTimeout(14);
    }
  }
  return waitOutcome(page, 60000);
}

// --------------------------------------------------------------------------
// 贪吃毛毛虫：读画布 dataset 做一次广度优先寻路，
// 双身位时两条虫的落点都要先验一遍安全，再发真实方向键
// --------------------------------------------------------------------------
async function playSnake(page) {
  await page.waitForSelector(".sn-canvas", { timeout: 15000 });
  await page.evaluate(() => {
    const GRID = 13;
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const list = (s) => (s ?? "").split(",").filter(Boolean).map(Number);
    window.__snDrive = setInterval(() => {
      const c = document.querySelector(".sn-canvas");
      if (!c || !c.dataset.worms) return;
      const walls = new Set(list(c.dataset.walls));
      const gates = new Set(list(c.dataset.gate));
      const gateOpen = c.dataset.gateopen === "1";
      const beasts = new Set(list(c.dataset.movers));
      const portals = new Map();
      for (const pair of (c.dataset.portals ?? "").split(",").filter(Boolean)) {
        const [a, b] = pair.split(">").map(Number);
        portals.set(a, b);
      }
      const worms = (c.dataset.worms ?? "").split("|").filter(Boolean).map((s) => s.split(";").map(Number));
      if (!worms.length) return;
      const snack = Number(c.dataset.snack);
      const bodies = new Set();
      for (const w of worms) for (let i = 0; i < w.length - 1; i++) bodies.add(w[i]);

      const stepTo = (from, d) => {
        const x = (from % GRID) + d[0];
        const y = Math.floor(from / GRID) + d[1];
        if (x < 0 || x >= GRID || y < 0 || y >= GRID) return null;
        let k = y * GRID + x;
        if (walls.has(k)) return null;
        if (gates.has(k) && !gateOpen) return "stay";
        if (portals.has(k)) k = portals.get(k);
        return k;
      };
      const safe = (k) => k !== null && k !== "stay" && !beasts.has(k) && !bodies.has(k);

      // 从某条虫的头出发做一次广度优先，找出走向点心的第一步（换算成玩家该按的方向）
      const planFor = (idx) => {
        const from = worms[idx][0];
        const toPlayer = (d) => (idx === 1 ? [d[0] === 0 ? 0 : -d[0], d[1]] : d);
        const prev = new Map([[from, null]]);
        const queue = [from];
        for (let i = 0; i < queue.length; i++) {
          const cur = queue[i];
          if (cur === snack) break;
          for (const d of DIRS) {
            const nxt = stepTo(cur, d);
            if (!safe(nxt) || prev.has(nxt)) continue;
            prev.set(nxt, cur);
            queue.push(nxt);
          }
        }
        if (!prev.has(snack)) return { dir: null, steps: Infinity };
        let node = snack;
        let steps = 0;
        while (prev.get(node) !== null && prev.get(node) !== from) { node = prev.get(node); steps++; }
        if (prev.get(node) !== from) return { dir: null, steps: Infinity };
        for (const d of DIRS) if (stepTo(from, d) === node) return { dir: toPlayer(d), steps };
        return { dir: null, steps: Infinity };
      };
      // 双身位时两条虫都算一遍，谁离点心近就听谁的
      const plans = worms.map((_, i) => planFor(i)).filter((p) => p.dir).sort((a, b) => a.steps - b.steps);

      const head = worms[0][0];
      const neck = worms[0][1];
      const back = neck === undefined
        ? null
        : [Math.sign((neck % GRID) - (head % GRID)), Math.sign(Math.floor(neck / GRID) - Math.floor(head / GRID))];
      const isBack = (d) => back && Math.abs(back[0]) + Math.abs(back[1]) === 1 && d[0] === back[0] && d[1] === back[1];
      const okFor = (d) => {
        if (isBack(d)) return false;
        const a = stepTo(worms[0][0], d);
        if (!safe(a)) return false;
        if (worms.length > 1) {
          const b = stepTo(worms[1][0], [d[0] === 0 ? 0 : -d[0], d[1]]);
          if (!safe(b) || b === a) return false;
        }
        return true;
      };
      const pick = plans.map((p) => p.dir).find(okFor) ?? DIRS.find(okFor);
      if (!pick) return;
      const key = pick[0] === 1 ? "ArrowRight" : pick[0] === -1 ? "ArrowLeft" : pick[1] === 1 ? "ArrowDown" : "ArrowUp";
      window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    }, 40);
  });
  const outcome = await waitOutcome(page);
  await page.evaluate(() => clearInterval(window.__snDrive));
  return outcome;
}

const ALL_GAMES = [
  { id: "mole-pop", name: "地鼠嘭嘭", play: playMole, endless: "无尽地鼠场" },
  { id: "puzzle-tiles", name: "拼图乐园", play: playPuzzle, endless: "无尽画廊" },
  { id: "snake-snack", name: "贪吃毛毛虫", play: playSnake, endless: "无尽花园" },
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

  // --- 无尽模式入口：点开要能真的开一局，回选关也要回得来 ---
  console.log("\n=== 无尽模式入口 ===");
  for (const g of GAMES) {
    await page.goto(`${BASE}/?smoke=1&t=${Date.now()}#/game/${g.id}`, { waitUntil: "load" });
    await page.waitForSelector(".l99-grid", { timeout: 15000 });
    const btn = page.locator(`button:has-text("${g.endless}")`).first();
    const has = (await btn.count()) > 0;
    log(has, `${g.name} 首页有「${g.endless}」入口`);
    if (!has) continue;
    await btn.click({ force: true });
    await page.waitForTimeout(900);
    const started = await page.evaluate(
      (sel) => document.querySelectorAll(sel).length > 0,
      g.id === "mole-pop" ? ".mp-board" : g.id === "puzzle-tiles" ? ".pz-board" : ".sn-canvas"
    );
    log(started, `${g.name} 无尽模式第 1 局真的开起来了`);
    await checkNoOverflow(page, `${g.name} 无尽模式`);
    const back = page.locator('button:has-text("回选关")').first();
    if ((await back.count()) > 0) {
      await back.click({ force: true });
      await page.waitForTimeout(500);
    }
    log((await page.locator(".l99-grid").count()) > 0, `${g.name} 无尽模式回得到选关地图`);
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
  }

  log(errors.length === 0, "全程没有未捕获的页面报错", errors.slice(0, 3).join(" | "));

  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n合计 ${results.length} 项，通过 ${results.length - bad.length} 项，失败 ${bad.length} 项。`);
  if (bad.length) {
    for (const b of bad) console.log(`  失败：${b.what}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
