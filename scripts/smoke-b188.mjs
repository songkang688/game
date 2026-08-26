/**
 * 1.1 第 3 步 B 的手动冒烟替身：用真浏览器（375×667 竖屏）把
 * 萌猫小屋 / 连连看 / 星星消消乐 / 记忆翻翻乐 四款游戏的
 * 第 100 / 140 / 188 关各自实玩到「真实胜负」，并检查：
 *   - 窄屏没有横向溢出、页面不卡死、全程没有控制台报错；
 *   - 1.0 老存档（长度 99 的星级数组）读出来前 99 位原样、第 100 关自然解锁。
 *
 * 跑法（playwright 是临时工具，没有进 package.json）：
 *   npm i -D playwright --no-save && npx playwright install chromium --with-deps
 *   npx vite --port 5174
 *   SMOKE_BASE=http://localhost:5174 node scripts/smoke-b188.mjs
 *
 * 自动玩家全都在页面里跑：直接 import 源码里的纯函数（board.ts / engine.ts /
 * levels.ts），照着界面上真正显示的东西决策，再用真实点击操作 DOM——
 * 也就是说它玩的和孩子玩的是同一套规则，不是绕过 UI 直接改状态。
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5174";
const VIEWPORT = { width: 375, height: 667 };
const LEVELS_TO_PLAY = [100, 140, 188];
const MAX_ATTEMPTS = 8;

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

const GAMES = [
  { id: "kitty-care", name: "萌猫小屋", chapters: [17, 17, 17, 16, 16, 16, 23, 22, 22, 22] },
  { id: "lianliankan", name: "连连看", chapters: [17, 17, 17, 16, 16, 16, 23, 22, 22, 22] },
  { id: "match-stars", name: "星星消消乐", chapters: [16, 16, 16, 17, 17, 17, 23, 22, 22, 22] },
  { id: "memory-cards", name: "记忆翻翻乐", chapters: [17, 17, 17, 16, 16, 16, 23, 22, 22, 22] }
];

/** 造一份「前 level-1 关全三星」的存档，让目标关正好是当前关 */
async function seedProgress(page, gameId, level) {
  await page.evaluate(
    ([id, n]) => {
      const arr = new Array(188).fill(0);
      for (let i = 0; i < n - 1; i++) arr[i] = 3;
      localStorage.setItem(`yiduo-yixing.l99.${id}`, JSON.stringify(arr));
      localStorage.setItem(`yiduo-yixing.l99skip.${id}`, "[]");
    },
    [gameId, level]
  );
}

async function openLevel(page, gameId, level) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/${gameId}`, { waitUntil: "load" });
  await page.waitForSelector(".l99-node", { timeout: 20000 });
  return page.evaluate((n) => {
    const node = [...document.querySelectorAll(".l99-node")].find(
      (b) => b.querySelector(".l99-node-num")?.textContent === String(n) && !b.disabled
    );
    if (!node) return false;
    node.click();
    return true;
  }, level);
}

/** 结算浮层出来了吗：win / lose / null */
async function outcome(page) {
  return page.evaluate(() => {
    const t = document.querySelector(".l99-overlay .l99-ov-title");
    if (!t) return null;
    return (t.textContent ?? "").includes("过关") ? "win" : "lose";
  });
}

async function retry(page) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".l99-ov-btn")].find((b) =>
      (b.textContent ?? "").includes("再")
    );
    btn?.click();
  });
  await page.waitForTimeout(700);
}

async function narrowOk(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth <= window.innerWidth + 1;
  });
}

// ---------------------------------------------------------------------------
// 四个自动玩家（全都在页面里跑）
// ---------------------------------------------------------------------------

/** 萌猫小屋：照着气泡 / 护理单 / 主题词做出正确选择 */
const BOT_KITTY = async (levelIdx) => {
  const lv = await import("/src/games/kitty-care/levels.ts");
  const sleep = (m) => new Promise((r) => setTimeout(r, m));
  const q = (s) => document.querySelector(s);
  const wardrobe = new Map();
  for (const slot of lv.STYLE_WARDROBE) for (const it of slot.items) wardrobe.set(it.name, it);
  const buttons = () => [...document.querySelectorAll(".kc-btn")].filter((b) => !b.disabled);
  let notes = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    if (q(".l99-overlay")) return "settled";
    const bubble = (q(".kc-bubble")?.textContent ?? "").trim();
    const msg = (q(".kc-msg")?.textContent ?? "").trim();

    const spot = q(".kc-spot");
    if (spot) { spot.click(); await sleep(45); continue; }
    const toy = q(".kc-toy");
    if (toy) { toy.click(); await sleep(60); continue; }

    if (bubble.startsWith("🌙 摇篮曲：")) {
      notes = bubble.slice("🌙 摇篮曲：".length).trim().split(/\s+/).filter(Boolean);
      await sleep(120);
      continue;
    }
    const bs = buttons();
    if (bs.length === 0) { await sleep(120); continue; }

    if (bubble.includes("轮到你弹") && notes && notes.length) {
      for (const n of notes) {
        const cur = buttons().find((b) => (b.textContent ?? "").startsWith(n));
        if (!cur) break;
        cur.click();
        await sleep(110);
      }
      notes = null;
      await sleep(200);
      continue;
    }
    // 看病：护理单第几步就拿哪件工具
    const cure = /该拿\s*(.+?)\s*啦/.exec(msg);
    if (cure) {
      const want = cure[1];
      const btn = bs.find((b) => b.getAttribute("aria-label") === want);
      if (btn) { btn.click(); await sleep(180); continue; }
    }
    // 搭配：按当天主题挑最搭的一件
    if (bubble.startsWith("👗 今天的主题：") && msg.includes("挑一件")) {
      const theme = bubble.slice("👗 今天的主题：".length).trim();
      let best = null;
      let bestScore = -1;
      for (const b of bs) {
        const item = wardrobe.get(b.getAttribute("aria-label") ?? "");
        const s = item ? lv.styleItemScore(item, theme) : -1;
        if (s > bestScore) { bestScore = s; best = b; }
      }
      if (best) { best.click(); await sleep(180); continue; }
    }
    // 喂饭 / 打扮：气泡末尾那个表情就是答案
    const want = bubble.split(/\s+/).pop() ?? "";
    if (want) {
      const btn = bs.find((b) => (b.textContent ?? "").startsWith(want));
      if (btn) { btn.click(); await sleep(180); continue; }
    }
    await sleep(150);
  }
  return "timeout";
};

/** 连连看：从界面读棋盘，用 board.ts 的 findPath 找真正连得上的一对 */
const BOT_LLK = async (levelIdx) => {
  const bd = await import("/src/games/lianliankan/board.ts");
  const lvs = await import("/src/games/lianliankan/levels.ts");
  const cfg = lvs.LEVELS[levelIdx];
  const maxTurns = lvs.turnsOf(cfg);
  const sleep = (m) => new Promise((r) => setTimeout(r, m));
  const R = cfg.rows + 2;
  const C = cfg.cols + 2;

  const readBoard = () => {
    const cells = [...document.querySelectorAll(".llk-cell")];
    if (cells.length !== R * C) return null;
    const faces = [];
    const grid = [];
    const ids = new Map();
    let next = 0;
    for (let r = 0; r < R; r++) {
      const row = [];
      const frow = [];
      for (let c = 0; c < C; c++) {
        const el = cells[r * C + c];
        const txt = (el.textContent ?? "").trim();
        if (!txt || el.classList.contains("llk-gone")) { row.push(-1); frow.push(""); continue; }
        if (el.classList.contains("llk-mask")) {
          // 戴面具的：占着位置挡路，但谁也配不上它
          row.push(90000 + r * C + c);
          frow.push("?");
          continue;
        }
        if (!ids.has(txt)) ids.set(txt, next++);
        row.push(ids.get(txt));
        frow.push(txt);
      }
      grid.push(row);
      faces.push(frow);
    }
    return { rows: cfg.rows, cols: cfg.cols, R, C, grid, faces, cells };
  };

  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    if (document.querySelector(".l99-overlay")) return "settled";
    const b = readBoard();
    if (!b) { await sleep(120); continue; }

    // ① 找一对看得见、又真的连得上的
    const groups = new Map();
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const v = b.grid[r][c];
        if (v < 0 || v >= 90000) continue;
        const list = groups.get(v) ?? [];
        list.push([r, c]);
        groups.set(v, list);
      }
    }
    let pair = null;
    for (const list of groups.values()) {
      for (let i = 0; i < list.length && !pair; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (bd.findPath(b, list[i], list[j], maxTurns)) { pair = [list[i], list[j]]; break; }
        }
      }
      if (pair) break;
    }
    if (pair) {
      b.cells[pair[0][0] * C + pair[0][1]].click();
      await sleep(45);
      b.cells[pair[1][0] * C + pair[1][1]].click();
      await sleep(90);
      continue;
    }

    // ② 看得见的都连不上：先把面具一个个点开看真身
    let mask = null;
    for (let r = 0; r < R && !mask; r++) {
      for (let c = 0; c < C; c++) {
        if (b.grid[r][c] >= 90000) { mask = [r, c]; break; }
      }
    }
    if (mask) {
      b.cells[mask[0] * C + mask[1]].click();
      await sleep(70);
      continue;
    }

    // ③ 真的连不动了：洗牌（洗完自然重排）
    const sh = document.querySelector(".llk-shuffle");
    if (sh && !sh.disabled) { sh.click(); await sleep(200); continue; }
    await sleep(220);
  }
  return "timeout";
};

/** 星星消消乐：从界面读棋盘与目标，用 engine.ts 试算每个交换挑最优 */
const BOT_MST = async (levelIdx) => {
  const eng = await import("/src/games/match-stars/engine.ts");
  const lvs = await import("/src/games/match-stars/levels.ts");
  const cfg = lvs.LEVELS[levelIdx];
  const SIZE = eng.SIZE;
  const sleep = (m) => new Promise((r) => setTimeout(r, m));
  const EMOJIS = ["⭐", "💖", "🍀", "🌙", "🍊"];

  const readState = (used) => {
    const cells = [...document.querySelectorAll(".mst-cell")];
    if (cells.length !== SIZE * SIZE) return null;
    const grid = [];
    const ice = [];
    const vine = [];
    const frost = [];
    for (const el of cells) {
      const txt = (el.textContent ?? "").trim();
      grid.push(txt === "🌈" ? eng.RAINBOW : EMOJIS.indexOf(txt));
      ice.push(el.classList.contains("mst-ice"));
      vine.push(el.classList.contains("mst-vine"));
      frost.push(el.classList.contains("mst-frost2") ? 2 : el.classList.contains("mst-frost1") ? 1 : 0);
    }
    if (grid.some((v) => v === -1)) return null;
    // 目标进度从界面上的小标签里读回来
    const chips = [...document.querySelectorAll(".mst-goal")].map((c) => c.textContent ?? "");
    let k = 0;
    const collected = cfg.goals.map(() => 0);
    cfg.goals.forEach((g, gi) => {
      const m = /(\d+)\s*\/\s*(\d+)/.exec(chips[k++] ?? "");
      collected[gi] = m ? Number(m[1]) : 0;
    });
    if (cfg.ice > 0) k++;
    if (cfg.vine > 0) k++;
    if ((cfg.frost ?? 0) > 0) k++;
    const orders = (cfg.orders ?? []).map(() => 0);
    (cfg.orders ?? []).forEach((o, oi) => {
      const m = /（\s*(\d+)\s*\/\s*(\d+)\s*）/.exec(chips[k++] ?? "");
      orders[oi] = m ? Number(m[1]) : 0;
    });
    let armor = 0;
    if (cfg.boss) {
      const m = /(\d+)\s*\/\s*(\d+)/.exec(chips[k++] ?? "");
      armor = m ? Number(m[1]) : cfg.boss.armor;
    }
    return {
      state: {
        grid, ice, vine, frost,
        iceLeft: ice.filter(Boolean).length,
        vineLeft: vine.filter(Boolean).length,
        frostLeft: frost.reduce((a, b) => a + b, 0),
        collected, orders, armor, used
      },
      cells
    };
  };

  /** 等这一步的连锁播完（棋盘连着两拍没变就算稳住了） */
  const settle = async () => {
    let last = "";
    let same = 0;
    for (let i = 0; i < 60; i++) {
      const now = [...document.querySelectorAll(".mst-cell")].map((c) => c.textContent).join("");
      if (now === last) same++;
      else same = 0;
      last = now;
      if (same >= 2) return;
      if (document.querySelector(".l99-overlay")) return;
      await sleep(160);
    }
  };

  let used = 0;
  let seed = 20250826;
  const t0 = Date.now();
  while (Date.now() - t0 < 180000) {
    if (document.querySelector(".l99-overlay")) return "settled";
    const snap = readState(used);
    if (!snap) { await sleep(150); continue; }
    const swaps = eng.legalSwaps(snap.state, cfg);
    if (swaps.length === 0) { await sleep(250); continue; }
    const before = eng.remaining(snap.state, cfg);
    let best = swaps[0];
    let bestScore = -Infinity;
    for (const [a, b] of swaps) {
      const trial = eng.cloneState(snap.state);
      const info = eng.playSwap(trial, cfg, a, b, mulberry(seed++));
      const score = (before - eng.remaining(trial, cfg)) * 10 + info.best + info.steps * 2;
      if (score > bestScore) { bestScore = score; best = [a, b]; }
    }
    snap.cells[best[0]].click();
    await sleep(60);
    snap.cells[best[1]].click();
    used++;
    await sleep(180);
    await settle();
  }
  return "timeout";

  function mulberry(s) {
    let a = s >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
};

/** 记忆翻翻乐：记性完美的玩家，牌阵整体旋转时同步挪动自己的记忆 */
const BOT_MEM = async (levelIdx) => {
  const lvs = await import("/src/games/memory-cards/levels.ts");
  const cfg = lvs.LEVELS[levelIdx];
  const need = cfg.matchSize;
  const rotateEvery = cfg.rotateEvery ?? 0;
  const sleep = (m) => new Promise((r) => setTimeout(r, m));
  const slots = () => [...document.querySelectorAll(".mem-card")];
  const isGone = (el) => el.classList.contains("mem-gone");
  const isUp = (el) => el.classList.contains("mem-up");
  const turnLeft = () => {
    const m = /(\d+)/.exec(document.querySelector(".mem-turnbadge")?.textContent ?? "");
    return m ? Number(m[1]) : -1;
  };
  /** 记忆：格子号 → 牌面 */
  const mem = new Map();

  const isNumberFace = (f) => /^\d+$/.test(f);
  /** a、b 两张牌是不是同一组（算式关是「算式 = 得数」，普通关是同一个图案） */
  const sameGroup = (a, b) => {
    if (!cfg.mathPairs) return a === b;
    if (isNumberFace(a) === isNumberFace(b)) return false;
    const expr = isNumberFace(a) ? b : a;
    const num = isNumberFace(a) ? a : b;
    return lvs.evalExpr(expr) === Number(num);
  };

  /** 牌阵整体转了一格：把记忆按同样的规矩挪一挪 */
  const rotateMemory = () => {
    const els = slots();
    const active = [];
    els.forEach((el, i) => { if (!isGone(el)) active.push(i); });
    const n = active.length;
    if (n < 2) return;
    const old = new Map(mem);
    mem.clear();
    active.forEach((slot, k) => {
      const from = active[(k - 1 + n) % n];
      if (old.has(from)) mem.set(slot, old.get(from));
    });
  };

  /** 看一眼牌桌：谁还在、谁正翻着，顺手把看见的牌面记下来 */
  const observe = () => {
    const els = slots();
    const alive = [];
    const open = [];
    els.forEach((el, i) => {
      if (isGone(el)) return;
      alive.push(i);
      if (isUp(el)) {
        open.push(i);
        const f = (el.textContent ?? "").trim();
        if (f) mem.set(i, f);
      }
    });
    for (const k of [...mem.keys()]) if (!alive.includes(k)) mem.delete(k);
    return { alive, open };
  };

  /**
   * 点一张牌，等这一手彻底走完，再顺便盯一眼木马有没有转。
   * 计数牌只会往下减，一旦回弹就说明刚刚整体转过一格。
   */
  const clickSlot = async (i) => {
    const before = turnLeft();
    slots()[i]?.click();
    await sleep(150);
    for (let k = 0; k < 60; k++) {
      if (document.querySelector(".l99-overlay")) return;
      if (observe().open.length < need) break;
      await sleep(120);
    }
    await sleep(140);
    if (rotateEvery > 0 && turnLeft() > before) {
      await sleep(180);
      rotateMemory();
    }
  };

  // 开局偷看：所有牌都亮着，一次记完
  for (let k = 0; k < 30; k++) {
    const els = slots();
    if (els.length && els.every((el) => isUp(el))) {
      els.forEach((el, i) => mem.set(i, (el.textContent ?? "").trim()));
      break;
    }
    if (els.length && els.some((el) => isUp(el))) break;
    await sleep(90);
  }
  for (let k = 0; k < 40; k++) {
    if (observe().open.length === 0) break;
    await sleep(150);
  }

  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    if (document.querySelector(".l99-overlay")) return "settled";
    const { alive, open } = observe();
    if (alive.length === 0) { await sleep(200); continue; }
    if (open.length >= need) { await sleep(150); continue; }

    const free = alive.filter((i) => !open.includes(i));
    if (free.length === 0) { await sleep(200); continue; }
    let target = -1;

    if (open.length > 0) {
      // 手上有翻开的牌：优先去补齐它这一组
      const face = mem.get(open[0]);
      const cand = face === undefined
        ? []
        : free.filter((j) => mem.has(j) && sameGroup(face, mem.get(j)));
      if (cand.length >= need - open.length) target = cand[0];
      else {
        const fresh = free.filter((j) => !mem.has(j));
        target = fresh.length ? fresh[0] : cand[0] ?? free[0];
      }
    } else {
      // 桌面干净：记忆里凑得齐一组就直接收，否则去翻一张生牌
      let group = null;
      for (const i of alive) {
        const f = mem.get(i);
        if (f === undefined) continue;
        const same = alive.filter((j) => j !== i && mem.has(j) && sameGroup(f, mem.get(j)));
        if (same.length >= need - 1) { group = [i, ...same]; break; }
      }
      if (group) target = group[0];
      else {
        const fresh = alive.filter((j) => !mem.has(j));
        target = fresh.length ? fresh[0] : alive[0];
      }
    }
    if (target < 0) { await sleep(200); continue; }
    await clickSlot(target);
  }
  return "timeout";
};

const BOTS = {
  "kitty-care": BOT_KITTY,
  lianliankan: BOT_LLK,
  "match-stars": BOT_MST,
  "memory-cards": BOT_MEM
};

// ---------------------------------------------------------------------------

async function playLevel(page, game, level) {
  const levelIdx = level - 1;
  await page.goto(BASE, { waitUntil: "load" });
  await seedProgress(page, game.id, level);
  const opened = await openLevel(page, game.id, level);
  if (!opened) {
    log(false, `${game.name} 第 ${level} 关能打开`, "选关地图上找不到这一关");
    return;
  }
  const narrow = await narrowOk(page);
  log(narrow, `${game.name} 第 ${level} 关 375×667 窄屏不横向溢出`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const state = await page.evaluate(BOTS[game.id], levelIdx);
    const res = await outcome(page);
    if (res === "win") {
      const sub = (await page.locator(".l99-ov-sub").first().textContent())?.trim() ?? "";
      const stars = (await page.locator(".l99-ov-stars").first().textContent())?.trim() ?? "";
      log(true, `${game.name} 第 ${level} 关实玩到真实通关`, `${stars} ${sub}（第 ${attempt} 次尝试）`);
      await page.screenshot({ path: `/tmp/b188-${game.id}-${level}.png` });
      return;
    }
    if (res === "lose" && attempt < MAX_ATTEMPTS) {
      await retry(page);
      continue;
    }
    if (state === "timeout") {
      log(false, `${game.name} 第 ${level} 关实玩到真实胜负`, "自动玩家超时（疑似卡死）");
      await page.screenshot({ path: `/tmp/b188-${game.id}-${level}-stuck.png` });
      return;
    }
  }
  log(false, `${game.name} 第 ${level} 关实玩到真实通关`, `${MAX_ATTEMPTS} 次尝试都没赢`);
  await page.screenshot({ path: `/tmp/b188-${game.id}-${level}-fail.png` });
}

/** 老存档（长度 99 的数组）读出来前 99 位不变、第 100 关自然解锁 */
async function checkLegacySave(page, game) {
  await page.goto(BASE, { waitUntil: "load" });
  await page.evaluate((id) => {
    const old = [];
    for (let i = 0; i < 99; i++) old.push((i % 3) + 1);
    localStorage.setItem(`yiduo-yixing.l99.${id}`, JSON.stringify(old));
    localStorage.removeItem(`yiduo-yixing.l99skip.${id}`);
  }, game.id);
  await page.goto(`${BASE}/?t=${Date.now()}#/game/${game.id}`, { waitUntil: "load" });
  await page.waitForSelector(".l99-node", { timeout: 20000 });

  const shown = await page.evaluate(() => {
    const out = {};
    const count = document.querySelectorAll(".l99-tab").length;
    let lastHint = "";
    let lastNodes = 0;
    for (let i = 0; i < count; i++) {
      // 每次都重新取：点一下页签整块地图会重建，旧引用已经不在文档里了
      document.querySelectorAll(".l99-tab")[i].click();
      for (const node of document.querySelectorAll(".l99-node")) {
        const n = node.querySelector(".l99-node-num")?.textContent ?? "";
        if (!/^\d+$/.test(n)) continue;
        out[n] = { stars: node.querySelectorAll(".l99-star-on").length, locked: node.disabled };
      }
      if (i === count - 1) {
        lastHint = document.querySelector(".l99-pagehint")?.textContent ?? "";
        lastNodes = document.querySelectorAll(".l99-node").length;
      }
    }
    return { cells: out, tabs: count, lastHint, lastNodes };
  });

  let intact = true;
  for (let i = 1; i <= 99; i++) {
    if ((shown.cells[String(i)]?.stars ?? -1) !== ((i - 1) % 3) + 1) {
      intact = false;
      console.log(`       第 ${i} 关星级不符：${JSON.stringify(shown.cells[String(i)])}`);
      break;
    }
  }
  log(intact, `${game.name} 老存档前 99 关星级逐关原样`);
  log(shown.tabs >= 10, `${game.name} 选关地图至少 10 个章节页签`, `tabs=${shown.tabs}`);
  log(
    !!shown.cells["100"] && !shown.cells["100"].locked && shown.cells["100"].stars === 0,
    `${game.name} 第 100 关随老存档自然解锁且尚未通关`,
    JSON.stringify(shown.cells["100"] ?? null)
  );
  log(
    shown.lastHint.includes("188 关") && shown.lastNodes > 0,
    `${game.name} 地图最后一章一直排到第 188 关`,
    `${shown.lastHint.trim()}（${shown.lastNodes} 格）`
  );
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  for (const game of GAMES) {
    for (const level of LEVELS_TO_PLAY) {
      console.log(`\n=== ${game.name} 第 ${level} 关 ===`);
      await playLevel(page, game, level);
    }
    console.log(`\n=== ${game.name} 老存档兼容（1.0 → 1.1）===`);
    await checkLegacySave(page, game);
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
