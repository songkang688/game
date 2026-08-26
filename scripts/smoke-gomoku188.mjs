/**
 * 1.1 第 5 步 C 的手动冒烟替身：用真浏览器（375×667 竖屏）把五子棋的
 * 第 100 / 145 / 188 道残局真解到「解开啦」，再跟棋灵象·大师下一盘到真实胜负，并检查：
 *   - 窄屏无横向溢出、棋盘整块露在屏幕里、每个交叉点都点得到；
 *   - 1.0 老存档（长度 99 的星级数组）读出来前 99 道原样、第 100 道自然解锁。
 * 跑法（playwright 是临时工具，没有进 package.json）：
 *   npm i -D playwright --no-save && npx playwright install chromium --with-deps
 *   npx vite --port 5173
 *   node scripts/smoke-gomoku188.mjs        # SMOKE_PUZZLES=100 可只跑其中几道
 * 它连着源码跑（dev server）：用 ai.ts 现搜一遍强制胜路线，再用真鼠标点棋盘落子。
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5173";
const VIEWPORT = { width: 375, height: 667 };
const SAVE_KEY = "yiduo.gomoku.campaign.v2";
const TARGETS = (process.env.SMOKE_PUZZLES ?? "100,145,188")
  .split(",")
  .map(Number)
  .filter((n) => n >= 1);

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

async function seedProgress(page, target) {
  await page.evaluate(
    ([key, n]) => {
      const stars = Array.from({ length: 188 }, (_, i) => (i < n - 1 ? 3 : 0));
      localStorage.setItem(key, JSON.stringify({ stars }));
    },
    [SAVE_KEY, target]
  );
}

/** 打开棋谜战役列表并点开第 target 道 */
async function openPuzzle(page, target) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/gomoku`, { waitUntil: "load" });
  await page.waitForSelector(".gm-kind button[data-v='puzzle']", { timeout: 15000 });
  await page.click(".gm-kind button[data-v='puzzle']");
  await page.waitForSelector(".gm-pz", { timeout: 10000 });
  const handle = await page.evaluateHandle(
    (n) =>
      [...document.querySelectorAll(".gm-pz")].find(
        (b) => !b.classList.contains("locked") && b.querySelector(".n")?.textContent === String(n)
      ) ?? null,
    target
  );
  const el = handle.asElement();
  if (!el) return false;
  await el.scrollIntoViewIfNeeded();
  await el.click();
  await page.waitForSelector(".gm-game:not(.gm-hidden)", { timeout: 10000 });
  return true;
}

/** 页面里备一份解题器：黑棋只走「逼着白棋必须堵」的强迫手 */
async function installSolver(page) {
  await page.evaluate(async () => {
    const A = await import("/src/games/gomoku/ai.ts");
    window.__gm = {
      A,
      /** 读回当前局面（黑白棋子都从画面状态之外的模块算，不作弊） */
      makeBoard(size, black, white) {
        const b = A.makeBoard(size);
        for (const [x, y] of black) A.setCell(b, x, y, 1);
        for (const [x, y] of white) A.setCell(b, x, y, 2);
        return b;
      },
      fiveSpots(b, p) {
        return A.candidateMoves(b).filter(([x, y]) => A.makesFive(b, x, y, p));
      },
      /** 黑先，movesLeft 步内是否必胜 */
      forcedWin(b, movesLeft) {
        const cands = A.candidateMoves(b);
        if (cands.some(([x, y]) => A.makesFive(b, x, y, 1))) return true;
        if (movesLeft <= 1) return false;
        for (const [x, y] of cands) {
          A.setCell(b, x, y, 1);
          let ok = false;
          const threats = window.__gm.fiveSpots(b, 1);
          if (threats.length > 0 && window.__gm.fiveSpots(b, 2).length === 0) {
            ok = true;
            for (const [wx, wy] of threats) {
              A.setCell(b, wx, wy, 2);
              const r = window.__gm.forcedWin(b, movesLeft - 1);
              A.setCell(b, wx, wy, 0);
              if (!r) {
                ok = false;
                break;
              }
            }
          }
          A.setCell(b, x, y, 0);
          if (ok) return true;
        }
        return false;
      },
      /** 这一手该下哪：能直接连五就连五，否则挑一手必胜的强迫手 */
      solve(b, movesLeft) {
        const cands = A.candidateMoves(b);
        for (const [x, y] of cands) if (A.makesFive(b, x, y, 1)) return { x, y, kind: "five" };
        for (const [x, y] of cands) {
          A.setCell(b, x, y, 1);
          let ok = false;
          const threats = window.__gm.fiveSpots(b, 1);
          if (threats.length > 0 && window.__gm.fiveSpots(b, 2).length === 0) {
            ok = true;
            for (const [wx, wy] of threats) {
              A.setCell(b, wx, wy, 2);
              const r = window.__gm.forcedWin(b, movesLeft - 1);
              A.setCell(b, wx, wy, 0);
              if (!r) {
                ok = false;
                break;
              }
            }
          }
          A.setCell(b, x, y, 0);
          if (ok) return { x, y, kind: "force" };
        }
        return null;
      },
    };
  });
}

/** 从棋谜定义 + 已经落下的棋子还原局面，再算出这一手 */
async function nextMove(page, puzzleIndex, played) {
  return page.evaluate(
    async ([index, moves]) => {
      const P = await import("/src/games/gomoku/puzzles.ts");
      const p = P.PUZZLES[index];
      const black = [...p.black];
      const white = [...p.white];
      for (const m of moves) (m.p === 1 ? black : white).push([m.x, m.y]);
      const b = window.__gm.makeBoard(p.size, black, white);
      const used = moves.filter((m) => m.p === 1).length;
      return { move: window.__gm.solve(b, p.moves - used), size: p.size, moves: p.moves, name: p.name };
    },
    [puzzleIndex, played]
  );
}

/** 棋盘上的交叉点换成屏幕坐标（跟游戏 eventCell 同一套算式） */
async function cellPoint(page, x, y, size) {
  return page.evaluate(
    ([cx, cy, n]) => {
      const rect = document.querySelector(".gm-canvas").getBoundingClientRect();
      const cs = 380 / (n + 1);
      const px = cs + cx * cs;
      const py = cs + cy * cs;
      return {
        clientX: rect.left + (px / 380) * rect.width,
        clientY: rect.top + (py / 380) * rect.height,
      };
    },
    [x, y, size]
  );
}

/** 从画布像素上认出某个交叉点是黑子、白子还是空（跟小朋友用眼睛看一样） */
async function readStone(page, x, y, size) {
  return page.evaluate(([cx, cy, n]) => window.__gmRead(cx, cy, n), [x, y, size]);
}

/** 真点一下：窄屏格子小的时候游戏要「点两次确认」，多点一下也不会出岔子 */
async function tapCell(page, x, y, size) {
  const pt = await cellPoint(page, x, y, size);
  for (let tries = 0; tries < 3; tries++) {
    await page.mouse.move(pt.clientX, pt.clientY);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(120);
    if ((await readStone(page, x, y, size)) === 1) return true;
    // 决胜的那一手会被画上金色的星星，认不出黑子很正常——看提示语就知道已经落下去了
    const over = await page.evaluate(() =>
      /解开啦|差一点点|赢啦|平局/.test(document.querySelector(".gm-turn")?.textContent ?? "")
    );
    if (over) return true;
  }
  const why = await page.evaluate(
    ([cx, cy, n]) => ({
      lum: window.__gmLum(cx, cy, n),
      cell: document.querySelector(".gm-canvas").getBoundingClientRect().width / (n + 1),
      msg: document.querySelector(".gm-msg")?.textContent ?? "",
      turn: document.querySelector(".gm-turn")?.textContent ?? "",
    }),
    [x, y, size]
  );
  throw new Error(
    `第 ${x + 1} 列第 ${y + 1} 行怎么点都落不了子（亮度 ${why.lum}、格宽 ${why.cell.toFixed(1)}、${why.turn}、${why.msg}）`
  );
}

async function solvePuzzle(page, target) {
  const index = target - 1;
  const played = [];
  for (let step = 0; step < 12; step++) {
    const plan = await nextMove(page, index, played);
    if (!plan.move) return { solved: false, why: "算不出强制胜的下一手" };
    await tapCell(page, plan.move.x, plan.move.y, plan.size);
    played.push({ x: plan.move.x, y: plan.move.y, p: 1 });
    // 等：要么解开了，要么白棋防守完轮回黑棋
    await page.waitForFunction(
      () => {
        const t = document.querySelector(".gm-turn")?.textContent ?? "";
        return t.includes("解开啦") || t.includes("差一点点") || t.includes("还可以走");
      },
      undefined,
      { timeout: 20000 }
    );
    const turn = await page.evaluate(() => document.querySelector(".gm-turn")?.textContent ?? "");
    if (turn.includes("解开啦")) return { solved: true, steps: played.length };
    if (turn.includes("差一点点")) return { solved: false, why: "步数用完了" };
    // 白棋刚才堵在哪：把棋盘扫一遍找出新增的白子
    const white = await page.evaluate(
      async ([idx, moves]) => {
        const P = await import("/src/games/gomoku/puzzles.ts");
        const p = P.PUZZLES[idx];
        const taken = new Set([
          ...p.black.map(([x, y]) => `${x},${y}`),
          ...p.white.map(([x, y]) => `${x},${y}`),
          ...moves.map((m) => `${m.x},${m.y}`),
        ]);
        for (let y = 0; y < p.size; y++) {
          for (let x = 0; x < p.size; x++) {
            if (taken.has(`${x},${y}`)) continue;
            if (window.__gmRead(x, y, p.size) === 2) return { x, y };
          }
        }
        return null;
      },
      [index, played]
    );
    if (!white) return { solved: false, why: "找不到白棋刚落的子" };
    played.push({ x: white.x, y: white.y, p: 2 });
  }
  return { solved: false, why: "走了 12 步还没解开" };
}

/** 竖屏可玩性：不横向溢出、棋盘整块在屏幕里、格子点得到 */
async function checkFits(page, label) {
  const box = await page.evaluate(() => {
    const d = document.documentElement;
    const cv = document.querySelector(".gm-canvas").getBoundingClientRect();
    const btns = document.querySelector(".gm-btns").getBoundingClientRect();
    return {
      scroll: d.scrollWidth,
      client: d.clientWidth,
      left: cv.left,
      right: cv.right,
      bottom: cv.bottom,
      width: cv.width,
      btnsBottom: btns.bottom,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });
  log(box.scroll <= box.client + 2, `${label} 竖屏无横向溢出`, `${box.scroll}/${box.client}`);
  log(
    box.left >= -1 && box.right <= box.vw + 1 && box.bottom <= box.vh + 1 && box.btnsBottom <= box.vh + 1,
    `${label} 棋盘和按钮都在 375×667 里`,
    `right=${box.right.toFixed(0)} 按钮底=${box.btnsBottom.toFixed(0)}`
  );
}

/** 自由对战：跟棋灵象·大师下一盘，下到真实胜负 */
async function playMaster(page) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/gomoku`, { waitUntil: "load" });
  await page.waitForSelector(".gm-mode button[data-v='master']", { timeout: 15000 });
  await page.click(".gm-size button[data-v='15']");
  await page.click(".gm-mode button[data-v='master']");
  await page.click(".gm-start");
  await page.waitForSelector(".gm-game:not(.gm-hidden)", { timeout: 10000 });
  const label = await page.evaluate(() => document.querySelector(".gm-modelabel")?.textContent ?? "");
  log(label.includes("棋灵象·大师"), "自由对战能选到棋灵象·大师", label);
  await checkFits(page, "棋灵象对局");

  const N = 15;
  let plies = 0;
  for (let ply = 0; ply < 60; ply++) {
    const done = await page.evaluate(() => {
      const t = document.querySelector(".gm-turn")?.textContent ?? "";
      return t.includes("赢啦") || t.includes("平局");
    });
    if (done) break;
    // 每一手都从画面上重认一遍整盘棋，再照「普通档」的想法走一步
    const mv = await page.evaluate(async (n) => {
      const A = await import("/src/games/gomoku/ai.ts");
      const b = A.makeBoard(n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) A.setCell(b, x, y, window.__gmRead(x, y, n));
      return A.bestMove(b, 1, "normal", () => 0.5);
    }, N);
    if (!mv) break;
    await tapCell(page, mv.x, mv.y, N);
    plies++;
    // 等棋灵象落子（或者局已终）
    await page.waitForFunction(
      () => {
        const t = document.querySelector(".gm-turn")?.textContent ?? "";
        return t.includes("赢啦") || t.includes("平局") || t.includes("该黑棋");
      },
      undefined,
      { timeout: 30000 }
    );
    plies++;
  }
  const end = await page.evaluate((n) => ({
    turn: document.querySelector(".gm-turn")?.textContent ?? "",
    msg: document.querySelector(".gm-msg")?.textContent ?? "",
    board: Array.from({ length: n }, (_, y) =>
      Array.from({ length: n }, (_, x) => ".XO"[window.__gmRead(x, y, n)]).join("")
    ).join("\n"),
  }), N);
  if (process.env.SMOKE_DUMP) console.log(end.board);
  log(/赢啦|平局/.test(end.turn), "跟棋灵象下到真实胜负", `${end.turn} · 约 ${plies} 手`);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await ctx.addInitScript(() => {
    // 认棋子：交叉点附近取一小块求平均——黑子偏暗、白子最亮、空点是木头色
    window.__gmLum = (x, y, size) => {
      const c2 = document.querySelector(".gm-canvas").getContext("2d", { willReadFrequently: true });
      const cs = 380 / (size + 1);
      let sum = 0;
      let n = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const d = c2.getImageData(Math.round(cs + x * cs + dx), Math.round(cs + y * cs + dy), 1, 1).data;
          sum += (d[0] + d[1] + d[2]) / 3;
          n++;
        }
      }
      return sum / n;
    };
    // 半透明的那颗是「再点一次确认」的预览,不算真落子(≈144);真黑子≈104、木头≈184、白子≈248
    window.__gmRead = (x, y, size) => {
      const lum = window.__gmLum(x, y, size);
      if (lum < 130) return 1;
      if (lum > 238) return 2;
      return 0;
    };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(BASE, { waitUntil: "load" });

  for (const target of TARGETS) {
    console.log(`\n=== 五子棋 第 ${target} 道残局 ===`);
    await seedProgress(page, target);
    if (!(await openPuzzle(page, target))) {
      log(false, `第 ${target} 道能从战役列表点开`);
      continue;
    }
    await installSolver(page);
    const head = await page.evaluate(() => ({
      label: document.querySelector(".gm-modelabel")?.textContent ?? "",
      turn: document.querySelector(".gm-turn")?.textContent ?? "",
      msg: document.querySelector(".gm-msg")?.textContent ?? "",
    }));
    log(head.label.includes(`第 ${target} 谜`), `第 ${target} 道能从战役列表点开`, `${head.label} · ${head.turn}`);
    await checkFits(page, `第 ${target} 道`);
    const out = await solvePuzzle(page, target);
    log(out.solved, `第 ${target} 道真解到「解开啦」`, out.solved ? `${out.steps} 手` : out.why);
    if (out.solved) {
      const stars = await page.evaluate(
        ([key, i]) => JSON.parse(localStorage.getItem(key)).stars[i],
        [SAVE_KEY, target - 1]
      );
      log(stars === 3, `第 ${target} 道不用提示拿到 3 星`, `${stars} 星`);
    }
  }

  console.log("\n=== 棋灵象·大师 自由对战 ===");
  await playMaster(page);

  // --- 老存档：1.0 时代长度 99 的数组，前 99 道星级要原样 ---
  console.log("\n=== 老存档兼容 ===");
  await page.goto(BASE, { waitUntil: "load" });
  const legacy = Array.from({ length: 99 }, (_, i) => (i % 3) + 1);
  await page.evaluate(
    ([key, arr]) => localStorage.setItem(key, JSON.stringify({ stars: arr })),
    [SAVE_KEY, legacy]
  );
  await page.goto(`${BASE}/?t=${Date.now()}#/game/gomoku`, { waitUntil: "load" });
  await page.waitForSelector(".gm-kind button[data-v='puzzle']", { timeout: 15000 });
  await page.click(".gm-kind button[data-v='puzzle']");
  await page.waitForSelector(".gm-pz", { timeout: 10000 });
  const shown = await page.evaluate(() => {
    const out = {};
    for (const b of document.querySelectorAll(".gm-pz")) {
      const n = b.querySelector(".n")?.textContent ?? "";
      out[n] = b.querySelector(".s")?.textContent ?? "";
    }
    return out;
  });
  const starsOk = legacy.every((v, i) => shown[String(i + 1)] === "★".repeat(v) + "☆".repeat(3 - v));
  log(starsOk, "列表里前 99 道星级逐道原样", `第99道=${shown["99"] ?? "没找到"}`);
  log(shown["100"] === "☆☆☆", "第 100 道随老存档自然解锁", shown["100"] ?? "没找到");
  const parsed = await page.evaluate(async () => {
    const P = await import("/src/games/gomoku/puzzles.ts");
    const raw = JSON.parse(localStorage.getItem("yiduo.gomoku.campaign.v2")).stars;
    return P.parseCampaignStars(raw);
  });
  log(
    parsed.length === 188 && legacy.every((v, i) => parsed[i] === v) && parsed.slice(99).every((v) => v === 0),
    "老存档读出来补到 188、前 99 位一字没动",
    `len=${parsed.length}`
  );

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
