/**
 * 窗口 1 · 第 2 轮监督修复员自查:**二级界面**的 360px 复核。
 *
 * 第 1 轮走查脚本(smoke-1.2-window1-round1.mjs)只量到每款的入口屏 ——
 * 进了对战 / 无尽 / 双人之后一直在变的那些读数(HUD 徽章、排行榜、席位行、
 * 战报、目标行、按键说明)从来没被量过,第 1 轮的字号修复也就只抬了入口屏那一行。
 *
 * 这个脚本把 12 款的每一个模式入口都真点进去,进去之后再量一遍:
 *   1. 360×640 下不横向溢出;
 *   2. 说明类文字 ≥ 16px、按钮里的字 ≥ 14px(与第 1 轮同一把尺子);
 *   3. 模式菜单那句共享口径(.<前缀>-modetip)真的挂上去了、也 ≥ 16px;
 *   4. 返回键跟模式入口不是同一个类名(W1-06:走查得点得到「开始」而不是「返回」);
 *   5. 全程没有 pageerror / console.error。
 *
 * 跑法(puppeteer-core 是临时工具,没有进 package.json):
 *   npm i --no-save puppeteer-core
 *   npx vite --host 127.0.0.1 --port 5182
 *   node scripts/smoke-1.2-window1-r2-secondary.mjs      # ONLY=orb-arena,mine-garden 可只跑几款
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5182";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const VIEWPORT = { width: 360, height: 640 };

/** [游戏 id, 中文名, 类名前缀] */
const GAMES = [
  ["orb-arena", "圆圆大作战", "oa"],
  ["snake-royale", "长蛇争霸", "sr"],
  ["block-drop", "方块叠叠乐", "bd"],
  ["combo-clash", "连招对决", "cc"],
  ["mahjong-bloom", "花开麻将", "mj"],
  ["star-estate", "梨康地产", "se"],
  ["hero-cards", "英杰令", "hc"],
  ["weiqi-garden", "围子花园", "wq"],
  ["flight-chess", "飞行棋乐园", "fc"],
  ["merge-2048", "星星合成", "mg"],
  ["mine-garden", "扫雷花园", "mn"],
  ["sudoku-petal", "数独花田", "sp"]
];

const only = (process.env.ONLY ?? "").split(",").filter(Boolean);
const targets = only.length ? GAMES.filter(([id]) => only.includes(id)) : GAMES;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

/** 横向溢出:能自己横滚的容器不算(棋盘那种故意留的横滚) */
const OVERFLOW = () => {
  const w = document.documentElement.clientWidth;
  const scrollable = (el) => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const ov = getComputedStyle(n).overflowX;
      if (ov === "auto" || ov === "scroll") return true;
    }
    return false;
  };
  const bad = [];
  for (const el of document.querySelectorAll(".game-stage *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= w + 1 && r.left >= -1) continue;
    if (scrollable(el)) continue;
    bad.push(
      `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}@${Math.round(r.left)}..${Math.round(r.right)}`
    );
  }
  return { docScroll: document.documentElement.scrollWidth - w, bad: bad.slice(0, 6) };
};

/** 正文字号下限:说明类文字 ≥ 16px,按钮里的字 ≥ 14px */
const SMALL_TEXT = () => {
  const bad = [];
  for (const el of document.querySelectorAll(".game-stage *")) {
    if (el.children.length > 0) continue;
    const t = (el.textContent ?? "").trim();
    if (t.length < 6) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    const isButton = el.closest("button") !== null;
    if (size < (isButton ? 14 : 16) - 0.01) {
      bad.push(`${(el.className || el.tagName).toString().split(" ")[0]}=${size}px "${t.slice(0, 14)}"`);
    }
  }
  return bad.slice(0, 6);
};

async function newPage(browser, errors) {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text().slice(0, 200)}`);
  });
  return page;
}

/** 模式入口条上的按钮文案(返回键不该混在里面) */
async function modeEntries(page, p) {
  return page.evaluate(
    (pre) =>
      [...document.querySelectorAll(`.${pre}-modebar .${pre}-open`)].map((b) => (b.textContent ?? "").trim()),
    p
  );
}

/** 按文案点入口条上的某个按钮 */
async function openEntry(page, p, label) {
  const ok = await page.evaluate(
    ([pre, want]) => {
      const btn = [...document.querySelectorAll(`.${pre}-modebar .${pre}-open`)].find(
        (b) => (b.textContent ?? "").trim() === want
      );
      if (!btn) return false;
      btn.click();
      return true;
    },
    [p, label]
  );
  if (!ok) return false;
  await sleep(700);
  return true;
}

/** 有的模式还要先挑难度 / 挑盘面才开打,能点「开始」就点一下 */
async function pressStart(page) {
  const pressed = await page.evaluate(() => {
    const btns = [...document.querySelectorAll(".game-stage button")];
    // 只认「开始 / 来一局 / 开打」,明确躲开「回闯关 / 回选关 / 返回」
    const go = btns.find(
      (b) => /开始|来一局|开打|发牌|摆盘/.test(b.textContent ?? "") && !/回|返回/.test(b.textContent ?? "")
    );
    if (!go || go.disabled) return false;
    go.click();
    return true;
  });
  if (pressed) await sleep(900);
  return pressed;
}

/** 退回入口屏:优先点这一款自己的返回键 */
async function goBack(page, p) {
  const ok = await page.evaluate(
    (pre) => {
      const back =
        document.querySelector(`.${pre}-back`) ??
        [...document.querySelectorAll(".game-stage button")].find((b) => /回闯关|回选关/.test(b.textContent ?? ""));
      if (!back) return false;
      back.click();
      return true;
    },
    p
  );
  await sleep(600);
  return ok;
}

async function checkGame(page, id, title, p, errors) {
  console.log(`\n=== ${title}(${id}) ===`);
  await page.goto(`${BASE}/?t=${Date.now()}#/game/${id}`, { waitUntil: "domcontentloaded" });
  const up = await page
    .waitForSelector(`.${p}-modebar`, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!up) return log(false, `${title} 入口屏起不来`);

  // W1-03:模式菜单那句共享口径挂上去了没有
  const tip = await page.evaluate((pre) => {
    const el = document.querySelector(`.${pre}-modetip`);
    if (!el) return null;
    return { text: (el.textContent ?? "").trim(), size: parseFloat(getComputedStyle(el).fontSize) };
  }, p);
  log(
    tip !== null && /可以闯关/.test(tip.text) && tip.size >= 16,
    `${title} 模式菜单挂着共享口径那句话且 ≥16px`,
    tip ? `${tip.size}px「${tip.text.slice(0, 22)}…」` : "找不到 .modetip"
  );

  // W1-06:返回键不许顶着模式入口的类名
  const entries = await modeEntries(page, p);
  log(
    entries.length > 0 && !entries.some((t) => /回闯关|回选关|返回/.test(t)),
    `${title} 入口条上没有混进返回键`,
    entries.join(" / ")
  );

  for (const label of entries) {
    const before = errors.length;
    if (!(await openEntry(page, p, label))) {
      log(false, `${title} · ${label} 点不开`);
      continue;
    }
    await pressStart(page);
    await sleep(500);

    const ov = await page.evaluate(OVERFLOW);
    log(ov.bad.length === 0, `${title} · ${label} 360px 不横向溢出`, ov.bad.join(", "));
    const small = await page.evaluate(SMALL_TEXT);
    log(small.length === 0, `${title} · ${label} 360px 正文 ≥16px / 按钮 ≥14px`, small.join(", "));
    log(errors.length === before, `${title} · ${label} 无报错`, errors[before] ?? "");

    // 退回入口屏准备点下一个;退不回去就整页重来
    if (!(await goBack(page, p))) {
      await page.goto(`${BASE}/?t=${Date.now()}#/game/${id}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(`.${p}-modebar`, { timeout: 20000 }).catch(() => {});
      await sleep(300);
    }
  }
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const errors = [];
  const page = await newPage(browser, errors);
  try {
    for (const [id, title, p] of targets) {
      await checkGame(page, id, title, p, errors);
    }
  } finally {
    await browser.close();
  }
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n共 ${results.length} 项，通过 ${pass} 项。`);
  if (pass !== results.length) {
    console.log("没过的：");
    for (const r of results.filter((x) => !x.ok)) console.log(`  - ${r.what}`);
    process.exit(1);
  }
  console.log("全部通过 ✓");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
