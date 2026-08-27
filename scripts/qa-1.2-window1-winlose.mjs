/**
 * 窗口 1 · 第 2、3 步那六款（orb-arena / snake-royale / block-drop /
 * combo-clash / mahjong-bloom / star-estate）的**真胜真负**取证。
 *
 * 第 4、5 步那六款已经各有一份深度冒烟脚本（`smoke-1.2-step4-*` / `step5-*`），
 * 那边是按每一款的规则写死解法、真把关打通的。这一份补上剩下六款：
 *
 *   - 赢：在简单关上用这一款**真正的操作方式**一直玩，等 188 关外壳弹出「第 N 关过关！」；
 *   - 输：在高关号上完全不动，等外壳弹出「就差一点点」，并检查这句话只鼓励、不打击。
 *
 * 「真正的操作方式」每款不一样，照抄不了同一套按键，所以分了三种假人：
 *
 *   `pixel`  圆圆和长蛇是 canvas 游戏，镜头永远跟着自己。假人每 250ms 把画布像素读回来，
 *            按颜色找出离画面正中最近的那颗食物，再**按住** WASD 往那边走
 *            （这两款读的是「键有没有按住」，敲一下就松开等于没动）。
 *   `press`  方块和连招是一下一下地按：左右挪、旋转、硬降、轻击。
 *   `click`  麻将和地产是 DOM 牌桌，假人直接点界面上的按钮和牌，跟孩子的手指一样。
 *
 * 胜负只认 188 关外壳真的弹出来的结算浮层（`.l99-ov-title`），不看游戏内部变量，
 * 也不加任何测试后门。
 *
 * 跑法：
 *   npm i --no-save puppeteer-core
 *   npx vite --port 5185
 *   SMOKE_BASE=http://127.0.0.1:5185 node scripts/qa-1.2-window1-winlose.mjs
 *   QA_ONLY=orb-arena 只跑一款；QA_WIN_LEVEL / QA_LOSE_LEVEL 换关号
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5185";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const VIEWPORT = { width: 360, height: 640 };
const WIN_BUDGET_MS = Number(process.env.QA_WIN_BUDGET ?? 150000);
const LOSE_BUDGET_MS = Number(process.env.QA_LOSE_BUDGET ?? 90000);
const VERBOSE = process.env.QA_VERBOSE === "1";
const WIN_TRIES = Number(process.env.QA_WIN_TRIES ?? 3);

const PLANS = [
  {
    id: "orb-arena",
    winLevel: 1,
    loseLevel: 160,
    bot: "pointer",
    // 彩豆画成 #F7C6DE 的小圆点
    food: [0xf7, 0xc6, 0xde],
    // 朵朵自己是 #F5A9C8，第 1 关那只对手（糯糯）是 BOT_COLORS[0] = #F6B8D0。
    // 三种粉都很近，容差得收到 6 才分得开
    self: [0xf5, 0xa9, 0xc8],
    prey: [[0xf6, 0xb8, 0xd0]],
    tol: 6,
    eatRatio: 1.5,
    skipR: 60,
    overshoot: 1.35,
    hold: 150
  },
  {
    id: "snake-royale",
    winLevel: 1,
    loseLevel: 160,
    bot: "pixel",
    // 场上的豆子画成 #F7D98C
    food: [0xf7, 0xd9, 0x8c],
    hold: 260
  },
  {
    id: "block-drop",
    winLevel: 1,
    loseLevel: 170,
    bot: "press",
    // 左右铺平再硬降：把一行填满就算数，不追求漂亮
    keys: ["KeyA", "KeyA", "KeyG", "KeyD", "KeyG", "KeyA", "KeyG", "KeyD", "KeyD", "KeyG", "KeyF", "KeyG"],
    tick: 120
  },
  {
    id: "combo-clash",
    winLevel: 1,
    loseLevel: 170,
    bot: "press",
    // 轻击学堂：贴上去不停轻击，偶尔挡一下
    keys: ["KeyD", "KeyF", "KeyF", "KeyF", "KeyG", "KeyD", "KeyF", "KeyF"],
    tick: 110
  },
  {
    id: "mahjong-bloom",
    winLevel: 1,
    loseLevel: 170,
    bot: "click",
    // 能和就和，能摸就摸，否则打最右边那张
    priority: [/和牌/, /接着摸牌|摸牌/, /碰|吃|杠/, /过/],
    fallback: ".mj-hand .mj-tile, .mj-tile"
  },
  {
    id: "star-estate",
    winLevel: 1,
    loseLevel: 170,
    bot: "click",
    // 掷骰 → 能买就买 → 能建就建
    priority: [/掷骰/, /购买|买下/, /建屋|盖房/, /结束回合|过/],
    fallback: ".se-tile"
  }
];

const ONLY = (process.env.QA_ONLY ?? "").split(",").filter(Boolean);
const TARGETS = ONLY.length ? PLANS.filter((p) => ONLY.includes(p.id)) : PLANS;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
function log(id, ok, what, extra = "") {
  rows.push({ id, ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} [${id}] ${what}${extra ? ` — ${extra}` : ""}`);
}

/** 没过关时不许出现的丧气话 */
const HARSH = ["你输了", "笨", "死了", "淘汰出局", "Game Over", "game over", "垃圾"];

async function openLevel(page, id, n) {
  // localStorage 得先有个同源文档才碰得到：about:blank 上读会直接 SecurityError
  if (!page.url().startsWith(BASE)) await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    (key, target) => {
      localStorage.setItem(key, JSON.stringify(Array.from({ length: 188 }, (_, i) => (i < target - 1 ? 3 : 0))));
    },
    `yiduo-yixing.l99.${id}`,
    n
  );
  await page.goto(`${BASE}/?t=${Date.now()}#/game/${id}`, { waitUntil: "networkidle0" });
  const cont = await page.waitForSelector(".l99-continue", { timeout: 15000 }).catch(() => null);
  if (!cont) return false;
  await cont.click();
  await sleep(1000);
  return true;
}

/**
 * 结算浮层读回来了没有。
 *
 * 轮询期间页面随时可能自己跳一次（过关之后 188 关外壳会重挂），
 * 这时正在飞的 `evaluate` 会抛「Execution context was destroyed」。
 * 那不是产品出错，是这一拍没读到 —— 当成「还没结算」继续轮询。
 */
const settle = (page) =>
  page
    .evaluate(() => {
      const t = document.querySelector(".l99-ov-title");
      if (!t) return null;
      return { title: t.textContent ?? "", body: t.parentElement?.textContent ?? "" };
    })
    .catch(() => null);

/**
 * 镜头跟着自己的 canvas 游戏：把画布读回来，找离正中最近的那颗食物。
 * 返回 -1..1 的方向；找不到就返回 null，让假人自己绕圈找。
 */
const FIND_FOOD = (rgb, skipR) => {
  const canvas = document.querySelector("canvas");
  if (!canvas) return null;
  const g = canvas.getContext("2d");
  if (!g) return null;
  const w = canvas.width;
  const h = canvas.height;
  const img = g.getImageData(0, 0, w, h).data;
  const [tr, tg, tb] = rgb;
  const cx = w / 2;
  const cy = h / 2;
  const skip2 = skipR * skipR;
  let bestD = Infinity;
  let bx = 0;
  let by = 0;
  // 隔 2 个像素抽样够用了，整幅扫太慢
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      if (Math.abs(img[i] - tr) > 10 || Math.abs(img[i + 1] - tg) > 10 || Math.abs(img[i + 2] - tb) > 10) continue;
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      // 正中那一坨是自己，别把自己当饭吃
      if (d < skip2 || d >= bestD) continue;
      bestD = d;
      bx = x;
      by = y;
    }
  }
  if (bestD === Infinity) return null;
  return { dx: (bx - cx) / (w / 2), dy: (by - cy) / (h / 2) };
};

/**
 * 圆圆这种「吃小的、躲大的」游戏，光捡豆子长不到目标：
 * 起步 30 质量、目标 90，掉质量的速度（`DECAY`）比捡豆子的进账还快，
 * **必须把对手吃掉一次**才过得去。这一段就是找猎物：
 *
 * 数一数正中那一坨（自己）有多少像素、最近那只对手有多少像素，
 * 自己明显更大才去追；否则原样去捡豆子。
 */
const FIND_PREY = (selfRgb, preyRgbs, skipR, tol) => {
  const canvas = document.querySelector("canvas");
  if (!canvas) return null;
  const g = canvas.getContext("2d");
  if (!g) return null;
  const w = canvas.width;
  const h = canvas.height;
  const img = g.getImageData(0, 0, w, h).data;
  const cx = w / 2;
  const cy = h / 2;
  const skip2 = skipR * skipR;
  const near = (i, rgb) =>
    Math.abs(img[i] - rgb[0]) <= tol && Math.abs(img[i + 1] - rgb[1]) <= tol && Math.abs(img[i + 2] - rgb[2]) <= tol;
  let selfPx = 0;
  let preyPx = 0;
  let bestD = Infinity;
  let bx = 0;
  let by = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (near(i, selfRgb)) {
        selfPx++;
        continue;
      }
      if (d < skip2) continue;
      for (const rgb of preyRgbs) {
        if (!near(i, rgb)) continue;
        preyPx++;
        if (d < bestD) {
          bestD = d;
          bx = x;
          by = y;
        }
        break;
      }
    }
  }
  if (bestD === Infinity || preyPx === 0) return null;
  return { dx: (bx - cx) / (w / 2), dy: (by - cy) / (h / 2), selfPx, preyPx };
};

/** HUD 上那个「已经长到多少」的数，用来判断假人是不是卡住了 */
const READ_SCORE = () => {
  const t = document.querySelector(".game-stage")?.innerText ?? "";
  const m = /(\d+)\s*\/\s*(\d+)/.exec(t);
  return m ? Number(m[1]) : -1;
};

/**
 * 圆圆这种「圆跟着手指走」的游戏：按住不放，把指针停在那颗彩豆上，
 * 圆就一路走过去。比四向按键准得多，也正是手机上孩子真实的玩法。
 */
async function pointerBot(page, plan, budgetMs) {
  const t0 = Date.now();
  const box = await page
    .$eval("canvas", (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })
    .catch(() => null);
  if (!box) return settle(page);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  let spin = 0;
  try {
    while (Date.now() - t0 < budgetMs) {
      const s = await settle(page);
      if (s) return s;
      // 先看有没有吃得下的对手：吃一口顶几十颗豆子
      let dir = null;
      let hunting = false;
      if (plan.prey) {
        const p = await page.evaluate(FIND_PREY, plan.self, plan.prey, plan.skipR ?? 55, plan.tol ?? 8).catch(() => null);
        if (p && p.selfPx > p.preyPx * (plan.eatRatio ?? 1.6)) {
          dir = { dx: p.dx, dy: p.dy };
          hunting = true;
        }
      }
      if (!dir) dir = await page.evaluate(FIND_FOOD, plan.food, plan.skipR ?? 55).catch(() => null);
      let tx;
      let ty;
      if (dir) {
        // 瞄过头一点：正好瞄在豆子上，圆走到就停住了，一停就不再吃到别的
        const over = plan.overshoot ?? 1.8;
        tx = cx + (dir.dx * box.w * over) / 2;
        ty = cy + (dir.dy * box.h * over) / 2;
      } else {
        const a = (spin++ / 8) * Math.PI * 2;
        tx = cx + Math.cos(a) * box.w * 0.45;
        ty = cy + Math.sin(a) * box.h * 0.45;
      }
      await page.mouse.move(tx, ty);
      if (VERBOSE && spin % 10 === 0) {
        const sc = await page.evaluate(READ_SCORE).catch(() => -1);
        console.log(`       · ${plan.id} 进度 ${sc} 目标点 ${hunting ? "对手" : dir ? "食物" : "绕圈"}`);
      }
      spin++;
      await sleep(plan.hold);
    }
  } finally {
    await page.mouse.up().catch(() => {});
  }
  return settle(page);
}

async function pixelBot(page, plan, budgetMs) {
  const t0 = Date.now();
  let held = [];
  let spin = 0;
  let lastScore = -1;
  let stuck = 0;
  const release = async () => {
    for (const k of held) await page.keyboard.up(k);
    held = [];
  };
  const press = async (want) => {
    if (want.join() === held.join()) return;
    await release();
    for (const k of want) await page.keyboard.down(k);
    held = want;
  };
  while (Date.now() - t0 < budgetMs) {
    const s = await settle(page);
    if (s) {
      await release();
      return s;
    }
    const score = await page.evaluate(READ_SCORE).catch(() => -1);
    stuck = score === lastScore ? stuck + 1 : 0;
    lastScore = score;

    let want;
    if (stuck >= 6) {
      // 半天不长个儿：多半是顶在墙上，或者盯着自己身上的一块颜色。换个方向硬走一段
      want = [["KeyA", "KeyS"], ["KeyD", "KeyS"], ["KeyA", "KeyW"], ["KeyD", "KeyW"]][spin++ % 4];
      await press(want);
      await sleep(plan.hold * 4);
      stuck = 0;
      continue;
    }
    const dir = await page.evaluate(FIND_FOOD, plan.food, plan.skipR ?? 55).catch(() => null);
    if (dir) {
      want = [];
      if (Math.abs(dir.dx) > 0.05) want.push(dir.dx > 0 ? "KeyD" : "KeyA");
      if (Math.abs(dir.dy) > 0.05) want.push(dir.dy > 0 ? "KeyS" : "KeyW");
      if (!want.length) want = ["KeyD"];
    } else {
      // 一颗都看不见就绕大圈找
      want = [["KeyD"], ["KeyS"], ["KeyA"], ["KeyW"]][spin++ % 4];
    }
    await press(want);
    await sleep(plan.hold);
  }
  await release();
  return settle(page);
}

async function pressBot(page, plan, budgetMs) {
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < budgetMs) {
    const s = await settle(page);
    if (s) return s;
    await page.keyboard.press(plan.keys[i++ % plan.keys.length]);
    await sleep(plan.tick);
  }
  return settle(page);
}

async function clickBot(page, plan, budgetMs) {
  const t0 = Date.now();
  let nth = 0;
  while (Date.now() - t0 < budgetMs) {
    const s = await settle(page);
    if (s) return s;
    const did = await page.evaluate(
      (sources, fallback, n) => {
        const stage = document.querySelector(".game-stage");
        if (!stage) return "no-stage";
        const buttons = [...stage.querySelectorAll("button")].filter(
          (b) => !b.disabled && b.offsetParent !== null && !/返回|攻略|跳过|选关|音|暂停|继续/.test(b.textContent ?? "")
        );
        for (const src of sources) {
          const rx = new RegExp(src);
          const hit = buttons.find((b) => rx.test(b.textContent ?? ""));
          if (hit) {
            hit.click();
            return hit.textContent?.trim() ?? "?";
          }
        }
        const tiles = [...stage.querySelectorAll(fallback)].filter((t) => t.offsetParent !== null);
        if (tiles.length) {
          const t = tiles[n % tiles.length];
          t.click();
          return `tile:${t.textContent?.trim().slice(0, 4) ?? ""}`;
        }
        return null;
      },
      plan.priority.map((r) => r.source),
      plan.fallback,
      nth++
    );
    await sleep(did ? 260 : 500);
  }
  return settle(page);
}

/** 放着不动，等它自己结算 */
async function idleBot(page, budgetMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs) {
    const s = await settle(page);
    if (s) return s;
    await sleep(500);
  }
  return settle(page);
}

const BOTS = { pixel: pixelBot, pointer: pointerBot, press: pressBot, click: clickBot };

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"]
  });
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  let errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });

  for (const plan of TARGETS) {
    errors = [];
    try {
      await playOne(page, plan, () => errors);
    } catch (e) {
      // 一款炸了不该把后面几款一起带走：记一条红，继续下一款
      log(plan.id, false, "这一款的取证跑完了", String(e).slice(0, 140));
    }
  }

  await browser.close();
  const bad = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - bad.length}/${rows.length} 通过`);
  if (bad.length) {
    console.log("未通过：");
    for (const b of bad) console.log(`  - [${b.id}] ${b.what}`);
    process.exitCode = 1;
  }
}

async function playOne(page, plan, readErrors) {
  {
    const errors = readErrors();
    const winLevel = Number(process.env.QA_WIN_LEVEL ?? plan.winLevel);
    // 假人没有孩子的直觉，同一关未必一把就过；给它几条命，
    // 只要真有一把打通就算数（孩子重开一局也是这么玩的）
    let won = null;
    let tries = 0;
    let okIn = false;
    while (tries < WIN_TRIES && !won) {
      tries++;
      okIn = await openLevel(page, plan.id, winLevel);
      if (!okIn) break;
      const s = await BOTS[plan.bot](page, plan, WIN_BUDGET_MS);
      if (s && /过关/.test(s.title)) won = s;
      else if (VERBOSE) console.log(`       · 第 ${tries} 把没过：${s?.title ?? "超时"}`);
    }
    log(plan.id, okIn, `第 ${winLevel} 关进得去`);
    log(plan.id, !!won, `第 ${winLevel} 关真操作打到过关`, won ? `${won.title}（第 ${tries} 把）` : `${tries} 把都没过`);

    const loseLevel = Number(process.env.QA_LOSE_LEVEL ?? plan.loseLevel);
    if (await openLevel(page, plan.id, loseLevel)) {
      const s = await idleBot(page, LOSE_BUDGET_MS);
      log(plan.id, !!s && !/过关/.test(s.title), `第 ${loseLevel} 关放着不动真的会没过`, s ? s.title : "超时没结算");
      if (s) {
        const harsh = HARSH.filter((w) => s.body.includes(w));
        log(plan.id, harsh.length === 0, "没过的文案只鼓励、不打击", harsh.join(",") || s.body.replace(/\s+/g, " ").slice(0, 36));
      }
    }

    log(plan.id, errors.length === 0, "真打这两局全程无报错", errors[0]?.slice(0, 100) ?? "");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
