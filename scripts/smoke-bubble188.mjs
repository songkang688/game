/**
 * 1.1 第 5 步 C 的手动冒烟替身：用真浏览器（375×667 竖屏）把泡泡瞄准手的
 * 第 100 / 145 / 188 关一路打到真实胜负，并检查：
 *   - 窄屏无横向溢出、画布和发射台完整露在屏幕里、能一路点着玩完；
 *   - 1.0 老存档（长度 99 的星级数组）读出来前 99 关原样、第 100 关自然解锁。
 * 跑法（playwright 是临时工具，没有进 package.json）：
 *   npm i -D playwright --no-save && npx playwright install chromium --with-deps
 *   npx vite --port 5173
 *   node scripts/smoke-bubble188.mjs   # SMOKE_LEVELS=100,145 只跑几关；SMOKE_SEED=2 换个手气
 * 它连着源码跑（dev server）：只有弹药颜色那一处随机数换成了可复算的固定序列（还要跟发射台上
 * 真画出来的颜色对一遍），落点用 logic.ts 的 simulateShot 复算，再用真鼠标在画布上瞄准发射；
 * 每一发之后都把整片泡泡逐格跟画布像素核对，数量、剩余弹数、抽签次数也都要对上。
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5173";
const VIEWPORT = { width: 375, height: 667 };
const SAVE_KEY = "yiduo.bubble-aim.campaign.v2";
const TARGETS = (process.env.SMOKE_LEVELS ?? "100,145,188").split(",").map(Number);
/** 一关最多重打几次（换个手气重来，人也会这样） */
const MAX_TRIES = 8;
/** 弹药颜色的手气种子：换个数字就是另一局，默认 1 好复现 */
const SEED = Number(process.env.SMOKE_SEED ?? 1);

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

/** 前 target-1 关全 3 星，好让目标关自然解锁 */
async function seedProgress(page, target) {
  await page.evaluate(
    ([key, n]) => {
      const stars = Array.from({ length: 188 }, (_, i) => (i < n - 1 ? 3 : 0));
      localStorage.setItem(key, JSON.stringify({ stars }));
    },
    [SAVE_KEY, target]
  );
}

async function openLevel(page, target) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/bubble-aim`, { waitUntil: "load" });
  await page.waitForSelector(".ba-lv", { timeout: 15000 });
  const handle = await page.evaluateHandle(
    (n) =>
      [...document.querySelectorAll(".ba-lv")].find(
        (b) => !b.classList.contains("locked") && b.querySelector(".num")?.textContent === String(n)
      ) ?? null,
    target
  );
  const el = handle.asElement();
  if (!el) return false;
  await el.scrollIntoViewIfNeeded();
  await el.click();
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".ba-canvas")).display !== "none", undefined, {
    timeout: 10000,
  });
  return true;
}

/**
 * 在页面里备好一份「影子棋盘」：跟游戏同一套 logic.ts，连弹药队列都照着 randomColor
 * 的调用顺序复算一遍（游戏刚开这一关时已经抽掉了两发，所以从 __cr-2 接上）。
 */
async function initMirror(page, level) {
  return page.evaluate(async (lv) => {
    const L = await import("/src/games/bubble-aim/logic.ts");
    const LV = await import("/src/games/bubble-aim/levels.ts");
    const def = LV.LEVELS[lv];
    const st = {
      L,
      def,
      g: L.parseLayout(def.layout),
      obs: { clouds: def.clouds, holes: def.holes },
      dropQueue: [...(def.dropRows ?? [])],
      dropEvery: def.dropEvery ?? 0,
      pressEvery: def.pressEvery ?? 0,
      pressLeft: (def.pressEvery ?? 0) > 0 ? (def.pressMax ?? 0) : 0,
      shotsLeft: def.shots,
      fired: 0,
      n: window.__cr - 2,
    };
    window.__ba = st;
    window.__baPick = () => {
      const pool = L.colorsInGrid(st.g);
      return pool[Math.floor(window.__crand(st.n++) * pool.length)] ?? "R";
    };
    st.cur = window.__baPick();
    st.next = window.__baPick();
    return { name: def.name, shots: def.shots, cur: st.cur, synced: st.n === window.__cr };
  }, level);
}

/**
 * 认出发射台上那颗弹药的颜色：在球的下半圈取几个点，跟调色板比最近的。
 * （高光在左上、色弱小图案在正中，所以只取下半圈的环带）
 */
async function readAmmo(page) {
  // 掉落的泡泡会淡出着从发射台上飞过去，遮住弹药。所以要求：
  // 一帧里五个取样点认出同一个颜色，而且隔 150 毫秒再看一次像素一模一样（画面静止了）。
  let last = null;
  for (let tries = 0; tries < 40; tries++) {
    const got = await readAmmoFrame(page);
    if (got && last && got.color === last.color && got.raw === last.raw) return got.color;
    last = got;
    await page.waitForTimeout(150);
  }
  throw new Error("看不清发射台上的弹药颜色");
}

async function readAmmoFrame(page) {
  return page.evaluate(() => {
    const cv = document.querySelector(".ba-canvas");
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    const PAL = {
      R: [[255, 167, 189], [242, 109, 147]],
      Y: [[255, 227, 138], [240, 190, 62]],
      B: [[166, 217, 250], [91, 167, 224]],
      G: [[188, 232, 165], [124, 190, 95]],
      P: [[220, 194, 250], [168, 127, 222]],
    };
    const votes = {};
    const raw = [];
    for (const deg of [15, 55, 90, 125, 165]) {
      const a = (deg * Math.PI) / 180;
      const px = Math.round(180 + Math.cos(a) * 14);
      const py = Math.round(444 + Math.sin(a) * 14);
      const d = ctx.getImageData(px, py, 1, 1).data;
      raw.push(d[0], d[1], d[2]);
      let best = null;
      let bestDist = Infinity;
      for (const [key, refs] of Object.entries(PAL)) {
        for (const [r, g, b] of refs) {
          const dist = (d[0] - r) ** 2 + (d[1] - g) ** 2 + (d[2] - b) ** 2;
          if (dist < bestDist) {
            bestDist = dist;
            best = key;
          }
        }
      }
      votes[best] = (votes[best] ?? 0) + 1;
    }
    const keys = Object.keys(votes);
    return keys.length === 1 ? { color: keys[0], raw: raw.join(",") } : null;
  });
}

/** 贪心选角：跟单测里的机器人同一套打分，用影子棋盘算 */
async function chooseAim(page, color) {
  return page.evaluate((cur) => {
    const st = window.__ba;
    const L = st.L;
    const clone = (g) => ({ rows: g.rows.map((r) => [...r]), flip: g.flip });
    let bestScore = -Infinity;
    let bestDeg = 90;
    for (let deg = 20; deg <= 160; deg += 1.5) {
      const a = (deg * Math.PI) / 180;
      const res = L.simulateShot(st.g, 180, 444, Math.cos(a), -Math.sin(a), st.obs);
      let score;
      if (res.swallowed) {
        score = -50;
      } else if (res.hitCell && L.isStone(st.g.rows[res.hitCell.r][res.hitCell.c])) {
        const sim = clone(st.g);
        const hit = L.damageStone(sim, res.hitCell.r, res.hitCell.c);
        score = hit.result === "broken" ? 3 + hit.dropped.length * 2.5 : 1;
      } else if (res.landing) {
        const sim = clone(st.g);
        sim.rows[res.landing.r][res.landing.c] = cur;
        const settle = L.settleShot(sim, res.landing.r, res.landing.c);
        const bonus = L.releaseLoneRainbows(sim).length;
        if (settle.popped.length > 0) {
          score = settle.popped.length * 2 + settle.dropped.length * 3 + bonus * 2;
        } else {
          const nearSame = L.neighbors(st.g, res.landing.r, res.landing.c).some(([nr, nc]) => {
            const n = st.g.rows[nr][nc];
            return n === cur || n === L.RAINBOW;
          });
          score = (nearSame ? 0.5 : -1) - res.landing.r * 0.15;
        }
      } else {
        score = -30;
      }
      if (score > bestScore) {
        bestScore = score;
        bestDeg = deg;
      }
    }
    // 把角度换成画布上一个真的能点到的点，再换成屏幕坐标
    const a = (bestDeg * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = -Math.sin(a);
    let t = 120;
    while (t > 40) {
      const x = 180 + dx * t;
      const y = 444 + dy * t;
      if (x > 10 && x < 350 && y > 10 && y < 470) break;
      t -= 5;
    }
    const cx = 180 + dx * t;
    const cy = 444 + dy * t;
    const rect = document.querySelector(".ba-canvas").getBoundingClientRect();
    return {
      deg: bestDeg,
      clientX: rect.left + (cx / 360) * rect.width,
      clientY: rect.top + (cy / 480) * rect.height,
    };
  }, color);
}

/** 用真实按下的那一点反推方向（跟游戏 setAim 同一套算式），推进影子棋盘 */
async function advanceMirror(page) {
  return page.evaluate(() => {
    const st = window.__ba;
    const cur = st.cur;
    const L = st.L;
    const p = window.__lastPtr;
    const cx = ((p.x - p.left) / p.w) * 360;
    const cy = ((p.y - p.top) / p.h) * 480;
    const dx = cx - 180;
    const dy = cy - 444;
    const len = Math.hypot(dx, dy);
    st.before = {
      grid: st.g.rows.map((row) => row.map((q) => q ?? ".").join("")).join("\n"),
      dir: [dx / len, dy / len],
      ptr: [p.x, p.y],
    };
    const res = L.simulateShot(st.g, 180, 444, dx / len, dy / len, st.obs);
    st.before.landing = res.landing ? `${res.landing.r},${res.landing.c}` : res.swallowed ? "被吞" : "没落点";
    st.before.hitCell = res.hitCell ? `${res.hitCell.r},${res.hitCell.c}` : "无";
    // 飞行是按 820 像素/秒走折线的，算出这一发要飞多久，等它落稳再打下一发
    let pathLen = 0;
    for (let i = 1; i < res.path.length; i++) {
      pathLen += Math.hypot(res.path[i].x - res.path[i - 1].x, res.path[i].y - res.path[i - 1].y);
    }
    st.shotsLeft--;
    // 游戏在发射的那一刻就把队列往前推一格，用的是还没落子的棋盘
    st.cur = st.next;
    st.next = window.__baPick();
    if (!res.swallowed) {
      if (res.hitCell && L.isStone(st.g.rows[res.hitCell.r]?.[res.hitCell.c] ?? null)) {
        L.damageStone(st.g, res.hitCell.r, res.hitCell.c);
      } else if (res.landing) {
        st.g.rows[res.landing.r][res.landing.c] = cur;
        L.settleShot(st.g, res.landing.r, res.landing.c);
      }
    }
    st.fired++;
    L.releaseLoneRainbows(st.g);
    let verdict = "on";
    if (L.countBubbles(st.g) === 0) {
      verdict = "won";
    } else {
      if (st.dropEvery > 0 && st.dropQueue.length > 0 && st.fired % st.dropEvery === 0) {
        L.descend(st.g, st.dropQueue.shift());
      }
      if (st.pressEvery > 0 && st.pressLeft > 0 && st.fired % st.pressEvery === 0) {
        L.pressCeiling(st.g);
        st.pressLeft--;
      }
      // refreshQueue：手上的颜色场上没有了就换一个
      const pool = L.colorsInGrid(st.g);
      if (pool.length > 0) {
        if (!pool.includes(st.cur)) st.cur = window.__baPick();
        if (!pool.includes(st.next)) st.next = window.__baPick();
      }
      if (L.crossedDeadline(st.g)) verdict = "lost";
      else if (st.shotsLeft <= 0) verdict = "lost";
    }
    return {
      verdict,
      bubbles: L.countBubbles(st.g),
      shotsLeft: st.shotsLeft,
      flightMs: Math.ceil((pathLen / 820) * 1000) + 260,
      // 弹药抽签次数必须跟游戏一模一样，否则影子棋盘的颜色就不可信了
      rngSynced: st.n === window.__cr,
      rng: [st.n, window.__cr],
      after: { cur: st.cur, next: st.next, pool: L.colorsInGrid(st.g).join("") },
    };
  });
}

/**
 * 把影子棋盘里每一颗泡泡都到画面上核对一遍：颜色对不上就说明哪里岔了。
 * （空格子不查——掉落动画会从上面飞过去；彩虹泡在转，也跳过）
 */
async function gridMismatch(page) {
  return page.evaluate(() => {
    const st = window.__ba;
    const L = st.L;
    const c2 = document.querySelector(".ba-canvas").getContext("2d", { willReadFrequently: true });
    const PAL = {
      R: [[255, 167, 189], [242, 109, 147]],
      Y: [[255, 227, 138], [240, 190, 62]],
      B: [[166, 217, 250], [91, 167, 224]],
      G: [[188, 232, 165], [124, 190, 95]],
      P: [[220, 194, 250], [168, 127, 222]],
      S: [[237, 239, 244], [201, 203, 212], [139, 143, 160]],
    };
    const px = (x, y) => {
      const d = c2.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    const far = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    for (let r = 0; r < st.g.rows.length; r++) {
      for (let c = 0; c < L.rowLength(st.g, r); c++) {
        const cell = st.g.rows[r][c];
        const p = L.cellCenter(st.g, r, c);
        // 警戒线以下就是发射台那一片，白托盘会盖住取样点，不查（真掉到那儿早就判输了）
        if (r > L.DEADLINE_ROW) continue;
        const pts = [
          [p.x, p.y + 11],
          [p.x + 11, p.y + 4],
          [p.x - 11, p.y + 4],
        ];
        // 每个取样点跟同一高度的天空底色比：三点都像天空才算这一格是空的
        const bgs = pts.map(([, sy]) => px(4, sy));
        const cols = pts.map(([sx, sy]) => px(sx, sy));
        const blank = cols.filter((q, i) => far(q, bgs[i]) < 900).length;
        if (!cell) {
          if (blank === 0) return `第 ${r} 行第 ${c} 格：算的是空的，画面上却有泡泡`;
          continue;
        }
        if (blank === 3) return `第 ${r} 行第 ${c} 格：算的是 ${cell}，画面上却是空的`;
        if (cell === L.RAINBOW) continue; // 彩虹泡在转,颜色不固定,只查「在不在」
        const want = L.isStone(cell) ? "S" : cell;
        const votes = {};
        for (const q of cols) {
          let best = "?";
          let bd = Infinity;
          for (const [k, refs] of Object.entries(PAL)) {
            for (const ref of refs) {
              const dist = far(q, ref);
              if (dist < bd) {
                bd = dist;
                best = k;
              }
            }
          }
          votes[best] = (votes[best] ?? 0) + 1;
        }
        const saw = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
        if (saw !== want) return `第 ${r} 行第 ${c} 格：算的是 ${want}，画面上像 ${saw}`;
      }
    }
    return null;
  });
}

/** 等游戏那边的 HUD 追上影子棋盘（数量、剩余弹数都要对上） */
async function waitSynced(page, expect) {
  try {
    await page.waitForFunction(
      ([bubbles, shots]) => {
        const num = (sel, re) => Number(re.exec(document.querySelector(sel)?.textContent ?? "")?.[1] ?? -1);
        return num(".ba-count", /🫧\s*(\d+)/) === bubbles && num(".ba-shots", /🎯\s*(\d+)/) === shots;
      },
      [expect.bubbles, expect.shotsLeft],
      { timeout: 15000 }
    );
  } catch {
    const now = await page.evaluate(() => {
      const st = window.__ba;
      const L = st.L;
      const c2 = document.querySelector(".ba-canvas").getContext("2d", { willReadFrequently: true });
      const PAL = {
        R: [242, 109, 147], Y: [240, 190, 62], B: [91, 167, 224],
        G: [124, 190, 95], P: [168, 127, 222], S: [139, 143, 160],
      };
      // 把整片棋盘从画面上认一遍，跟影子棋盘并排画出来，好看出是哪一格开始岔的
      const seen = [];
      for (let r = 0; r < st.g.rows.length; r++) {
        let line = "";
        for (let c = 0; c < L.rowLength(st.g, r); c++) {
          const p = L.cellCenter(st.g, r, c);
          const d = c2.getImageData(Math.round(p.x + 10), Math.round(p.y + 10), 1, 1).data;
          let best = ".";
          let bd = 4200;
          for (const [k, ref] of Object.entries(PAL)) {
            const dist = (d[0] - ref[0]) ** 2 + (d[1] - ref[1]) ** 2 + (d[2] - ref[2]) ** 2;
            if (dist < bd) {
              bd = dist;
              best = k;
            }
          }
          line += best;
        }
        seen.push(line);
      }
      return {
        count: document.querySelector(".ba-count")?.textContent ?? "",
        shots: document.querySelector(".ba-shots")?.textContent ?? "",
        msg: document.querySelector(".ba-msg")?.textContent ?? "",
        mine: st.g.rows.map((row) => row.map((c) => c ?? ".").join("")).join("\n"),
        seen: seen.join("\n"),
      };
    });
    const b4 = await page.evaluate(() => window.__ba.before);
    console.log(
      `这一发之前的影子棋盘（按下 ${b4.ptr.map((v) => v.toFixed(2)).join(",")}、方向 ${b4.dir
        .map((v) => v.toFixed(4))
        .join(",")}、算出的落点 ${b4.landing}、命中格 ${b4.hitCell}）：\n${b4.grid}`
    );
    console.log("这一发之后的影子棋盘：\n" + now.mine + "\n画面上：\n" + now.seen);
    throw new Error(
      `影子棋盘对不上：算的是 🫧 ${expect.bubbles} / 🎯 ${expect.shotsLeft}，屏幕上是 ${now.count} / ${now.shots}（${now.msg}）`
    );
  }
}

/** 剩余弹数徽章上的数字 */
async function shotsBadge(page) {
  return page.evaluate(() => Number(/🎯\s*(\d+)/.exec(document.querySelector(".ba-shots")?.textContent ?? "")?.[1] ?? -1));
}

async function playOnce(page, level) {
  const start = await initMirror(page, level);
  if (!start.synced) throw new Error(`开局弹药队列就跟游戏对不上（${start.name}）`);
  const trace = [];
  for (let shot = 0; shot < 200; shot++) {
    const ammo = await page.evaluate(() => window.__ba.cur);
    // 影子棋盘算出来的弹药，得跟发射台上真画出来的那颗颜色一致
    const shown = await readAmmo(page);
    if (shown !== ammo) throw new Error(`第 ${shot + 1} 发：算的是 ${ammo}，发射台上却是 ${shown}`);
    trace.push(ammo);
    if (process.env.SMOKE_TRACE) console.log(`   第 ${shot + 1} 发弹药 ${ammo}`);
    const aim = await chooseAim(page, ammo);
    const before = await shotsBadge(page);
    let fired = false;
    for (let retry = 0; retry < 6 && !fired; retry++) {
      await page.mouse.move(aim.clientX, aim.clientY);
      await page.mouse.down();
      await page.mouse.up();
      fired = await page
        .waitForFunction(
          (was) => Number(/🎯\s*(\d+)/.exec(document.querySelector(".ba-shots")?.textContent ?? "")?.[1] ?? -1) === was - 1,
          before,
          { timeout: 2500 }
        )
        .then(() => true)
        .catch(() => false);
      // 补点之前先确认是真没发出去，别把一发点成两发
      if (!fired && (await shotsBadge(page)) !== before) {
        throw new Error(`第 ${shot + 1} 发点重了：🎯 从 ${before} 掉到 ${await shotsBadge(page)}`);
      }
    }
    if (!fired) throw new Error(`第 ${shot + 1} 发怎么点都发不出去（🎯 还停在 ${before}）`);
    const step = await advanceMirror(page);
    if (process.env.SMOKE_TRACE) {
      console.log(`      → 打完 cur=${step.after.cur} next=${step.after.next} 场上颜色=${step.after.pool} 抽签 ${step.rng.join("/")}`);
    }
    await page.waitForTimeout(step.flightMs);
    if (step.verdict === "won") {
      await page.waitForFunction(
        ([key, lv]) => {
          const raw = localStorage.getItem(key);
          if (!raw) return false;
          return (JSON.parse(raw).stars?.[lv] ?? 0) > 0;
        },
        [SAVE_KEY, level],
        { timeout: 15000 }
      );
      return { won: true, shots: shot + 1 };
    }
    try {
      await waitSynced(page, step);
      // 数量对上了还不够：每颗泡泡的颜色也要跟画面一致（掉落动画飞过时多等两帧）。
      // 判输那一下会盖一层白蒙版，颜色全变，这时就不查了。
      let bad = step.verdict === "lost" ? null : await gridMismatch(page);
      for (let wait = 0; bad && wait < 12; wait++) {
        await page.waitForTimeout(120);
        bad = await gridMismatch(page);
      }
      if (bad) throw new Error(`第 ${shot + 1} 发之后棋盘跟画面对不上：${bad}`);
      // 抽签次数要等这一发真的落稳、游戏那边也把队列刷完了再比
      const rng = await page.evaluate(() => [window.__ba.n, window.__cr]);
      if (rng[0] !== rng[1]) throw new Error(`第 ${shot + 1} 发之后弹药抽签次数对不上：${rng.join(" vs ")}`);
    } catch (e) {
      throw new Error(`${e.message}；这一路的弹药是 ${trace.join("")}`);
    }
    if (step.verdict === "lost") {
      await page.waitForFunction(() => (document.querySelector(".ba-msg")?.textContent ?? "").includes("再来一次"), undefined, {
        timeout: 15000,
      });
      return { won: false, shots: shot + 1 };
    }
  }
  return { won: false, shots: 200 };
}

/** 竖屏可玩性：不横向溢出，画布整块露在屏幕里，发射台够得着 */
async function checkFits(page, label) {
  const box = await page.evaluate(() => {
    const d = document.documentElement;
    const cv = document.querySelector(".ba-canvas").getBoundingClientRect();
    return {
      scroll: d.scrollWidth,
      client: d.clientWidth,
      left: cv.left,
      right: cv.right,
      bottom: cv.bottom,
      width: cv.width,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });
  log(box.scroll <= box.client + 2, `${label} 竖屏无横向溢出`, `${box.scroll}/${box.client}`);
  log(
    box.left >= -1 && box.right <= box.vw + 1 && box.bottom <= box.vh + 1,
    `${label} 画布整块露在 375×667 里`,
    `left=${box.left.toFixed(0)} right=${box.right.toFixed(0)} bottom=${box.bottom.toFixed(0)}`
  );
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await ctx.addInitScript((seed) => {
    window.__cseed = seed;
    // 弹药颜色本来是随机的，测试里换成一条可复算的固定序列：
    // 只拦 randomColor 里那次 Math.random，别的（掉落动画等）照旧随机。
    window.__cr = 0;
    window.__crand = (n) => {
      let h = Math.imul(n + 1 + window.__cseed * 7919, 2654435761) >>> 0;
      h ^= h >>> 15;
      h = Math.imul(h, 2246822519) >>> 0;
      h ^= h >>> 13;
      h = Math.imul(h, 3266489917) >>> 0;
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
    const realRandom = Math.random;
    Math.random = function () {
      if ((new Error().stack ?? "").includes("randomColor")) return window.__crand(window.__cr++);
      return realRandom();
    };
    // 记下每次真实按下的屏幕坐标和当时画布的位置：游戏就是拿这两样算方向的，
    // 提示语换行会让画布上下挪一点点，所以必须当场记下来，不能事后再量。
    window.__lastPtr = null;
    document.addEventListener(
      "pointerdown",
      (e) => {
        const cv = document.querySelector(".ba-canvas");
        const r = cv ? cv.getBoundingClientRect() : null;
        window.__lastPtr = r
          ? { x: e.clientX, y: e.clientY, left: r.left, top: r.top, w: r.width, h: r.height }
          : null;
      },
      true
    );
  }, SEED);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(BASE, { waitUntil: "load" });

  for (const target of TARGETS) {
    const level = target - 1;
    console.log(`\n=== 泡泡瞄准手 第 ${target} 关 ===`);
    await seedProgress(page, target);
    if (!(await openLevel(page, target))) {
      log(false, `第 ${target} 关能从地图点开`);
      continue;
    }
    const info = await page.evaluate(() => ({
      level: document.querySelector(".ba-level")?.textContent ?? "",
      shots: document.querySelector(".ba-shots")?.textContent ?? "",
      tip: document.querySelector(".ba-msg")?.textContent ?? "",
    }));
    log(info.level.startsWith(`${target}.`), `第 ${target} 关能从地图点开`, `${info.level} · ${info.shots} · ${info.tip}`);
    await checkFits(page, `第 ${target} 关`);

    let outcome = { won: false, shots: 0 };
    let tries = 0;
    while (tries < MAX_TRIES && !outcome.won) {
      tries++;
      outcome = await playOnce(page, level);
      if (!outcome.won && tries < MAX_TRIES) {
        // 失败浮层上点一下就是重打这一关（弹药颜色重新随机）
        const rect = await page.evaluate(() => {
          const r = document.querySelector(".ba-canvas").getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        await page.mouse.click(rect.x, rect.y);
        await page.waitForTimeout(300);
      }
    }
    log(outcome.won, `第 ${target} 关打到真实通关`, `第 ${tries} 次尝试、${outcome.shots} 发`);
    if (outcome.won) {
      const stars = await page.evaluate(
        ([key, lv]) => JSON.parse(localStorage.getItem(key)).stars[lv],
        [SAVE_KEY, level]
      );
      log(stars >= 1 && stars <= 3, `第 ${target} 关结算写进存档`, `${stars} 星`);
    }
  }

  // --- 老存档：1.0 时代长度 99 的数组，前 99 关星级要原样 ---
  console.log("\n=== 老存档兼容 ===");
  await page.goto(BASE, { waitUntil: "load" });
  const legacy = Array.from({ length: 99 }, (_, i) => (i % 3) + 1);
  await page.evaluate(
    ([key, arr]) => localStorage.setItem(key, JSON.stringify({ stars: arr })),
    [SAVE_KEY, legacy]
  );
  await page.goto(`${BASE}/?t=${Date.now()}#/game/bubble-aim`, { waitUntil: "load" });
  await page.waitForSelector(".ba-lv", { timeout: 15000 });
  const shown = await page.evaluate(() => {
    const out = {};
    for (const b of document.querySelectorAll(".ba-lv")) {
      const n = b.querySelector(".num")?.textContent ?? "";
      out[n] = b.querySelector(".stars")?.textContent ?? "";
    }
    return out;
  });
  const starsOk = legacy.every((v, i) => shown[String(i + 1)] === "⭐".repeat(v) + "☆".repeat(3 - v));
  log(starsOk, "地图上前 99 关星级逐关原样", `第99关=${shown["99"] ?? "没找到"}`);
  log(shown["100"] === "☆☆☆", "第 100 关随老存档自然解锁", shown["100"] ?? "没找到");
  const parsed = await page.evaluate(async () => {
    const LV = await import("/src/games/bubble-aim/levels.ts");
    const raw = JSON.parse(localStorage.getItem("yiduo.bubble-aim.campaign.v2")).stars;
    return LV.parseStars(raw);
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
