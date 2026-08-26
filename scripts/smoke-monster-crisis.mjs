/**
 * 小怪物危机专项冒烟:真打到真实胜负,两个视口都跑一遍。
 *
 * 1. 1280×800 桌面:进第 1 关,摆颜料罐 + 泡泡炮,再一路甩颜料弹打到「过关」浮层;
 * 2. 1280×800 桌面:进第 1 关什么都不做,一直等到「就差一点点」失败浮层;
 * 3. 375×667 手机:进第 1 关,确认画布、建筑栏、虚拟方向盘都在屏内,再打一次到真实胜负;
 * 4. 三个附加模式(无尽 / 双人合作 / 非对称对战)各挂载一遍,确认不报错、能返回。
 *
 * 用法:npm run build && npx vite preview --port 4173,再 node scripts/smoke-monster-crisis.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const GAME = "monster-crisis";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];

function check(ok, label, extra = "") {
  console.log(`${ok ? "  ✅" : "  ❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures.push(`${label}${extra ? ` (${extra})` : ""}`);
}

/** 每次都带一个不重样的查询串,强制整页重载(纯改 hash 不会重新挂载) */
async function openGame(page) {
  await page.goto(`${BASE}/?r=${Date.now()}#/game/${GAME}`, { waitUntil: "networkidle0" });
  await sleep(900);
}

async function enterLevel1(page) {
  await openGame(page);
  const node = await page.$(".l99-node:not(.l99-node-lock)");
  if (!node) return false;
  await node.click();
  await sleep(900);
  return !!(await page.$(".mc-canvas"));
}

/** 读状态条上现在有多少罐颜料 */
async function readPaint(page) {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll(".mc-chip")) {
      const m = /🎨\s*(\d+)/.exec(el.textContent ?? "");
      if (m) return Number(m[1]);
    }
    return -1;
  });
}

async function canvasBox(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".mc-canvas");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}

/** 点建筑栏里名字匹配的按钮 */
async function pickTower(page, name) {
  const handles = await page.$$(".mc-item");
  for (const h of handles) {
    const text = await page.evaluate((el) => el.textContent ?? "", h);
    if (text.includes(name)) {
      await h.click();
      await sleep(120);
      return true;
    }
  }
  return false;
}

/** 在第 col 列(0 基)、第 lane 行的格子上点一下 */
async function clickCell(page, box, col, lane) {
  const gx = ((56 + (col + 1) * 68) / 712) * box.w;
  const gy = ((36 + lane * 80 + 40) / 460) * box.h;
  await page.mouse.click(box.x + gx, box.y + gy);
  await sleep(90);
}

/** 备战面板弹出来时点「准备好啦」继续开打 */
async function dismissPrep(page) {
  const btn = await page.$(".mc-layer .mc-open");
  if (!btn) return false;
  await btn.click().catch(() => {});
  await sleep(150);
  return true;
}

async function settleText(page) {
  return page.evaluate(() => {
    const ov = document.querySelector(".l99-overlay");
    if (!ov) return null;
    const title = ov.querySelector(".l99-ov-title");
    return title ? title.textContent ?? "" : "";
  });
}

/** 攒够钱就照着这张单子摆:先三个颜料罐,再五条道各一门泡泡炮,最后五堵棉花墙。 */
const BUILD_PLAN = [
  { tower: "颜料罐", cost: 3, col: 0, lane: 1 },
  { tower: "颜料罐", cost: 3, col: 0, lane: 2 },
  { tower: "颜料罐", cost: 3, col: 0, lane: 3 },
  ...[0, 1, 2, 3, 4].map((lane) => ({ tower: "泡泡炮", cost: 4, col: 3, lane })),
  ...[0, 1, 2, 3, 4].map((lane) => ({ tower: "棉花墙", cost: 2, col: 6, lane })),
];

/**
 * 像个真人一样打:有钱就照单子摆一件,没钱就扫着五条道甩颜料弹,
 * 备战面板弹出来就点「准备好啦」,一直打到结算浮层出现。
 */
async function playUntilSettled(page, box, { fire, build, maxSeconds }) {
  const until = Date.now() + maxSeconds * 1000;
  const plan = build ? [...BUILD_PLAN] : [];
  let lane = 0;
  let selectedTower = null;
  while (Date.now() < until) {
    await dismissPrep(page);
    const done = await settleText(page);
    if (done !== null) return done;

    if (plan.length > 0 && (await readPaint(page)) >= plan[0].cost) {
      const item = plan.shift();
      if (selectedTower !== item.tower) {
        if (selectedTower) await pickTower(page, selectedTower); // 先取消上一个
        await pickTower(page, item.tower);
        selectedTower = item.tower;
      }
      await clickCell(page, box, item.col, item.lane);
      continue;
    }
    if (selectedTower) {
      await pickTower(page, selectedTower);
      selectedTower = null;
    }
    if (fire) {
      const gx = box.x + box.w * 0.72;
      const gy = box.y + ((36 + lane * 80 + 40) / 460) * box.h;
      await page.mouse.click(gx, gy).catch(() => {});
      lane = (lane + 1) % 5;
    }
    await sleep(fire ? 130 : 500);
  }
  return await settleText(page);
}

async function runViewport(page, label, width, height) {
  console.log(`\n【${label} ${width}×${height}】`);
  await page.setViewport({ width, height });
  const errors = [];
  const onErr = (e) => errors.push(`pageerror: ${e.message}`);
  const onMsg = (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  };
  page.on("pageerror", onErr);
  page.on("console", onMsg);

  const ok = await enterLevel1(page);
  check(ok, "第 1 关能进得去,画布挂出来了");
  if (!ok) {
    page.off("pageerror", onErr);
    page.off("console", onMsg);
    return;
  }

  const box = await canvasBox(page);
  check(box && box.w > 200, "画布宽度够用", box ? `${Math.round(box.w)}px` : "无");
  const layout = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const inView = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= window.innerWidth + 1;
    };
    return {
      shop: inView(q(".mc-shop")),
      pads: inView(q(".mc-pads")),
      hud: inView(q(".mc-hud")),
      items: document.querySelectorAll(".mc-item").length,
      padBtns: document.querySelectorAll(".mc-pad .mc-btn").length,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  check(layout.shop && layout.pads && layout.hud, "建筑栏 / 方向盘 / 状态条都在屏内");
  check(layout.items === 3, "第一章解锁三件建筑", `${layout.items} 件`);
  check(layout.padBtns >= 6, "虚拟方向盘按钮齐全", `${layout.padBtns} 个`);
  check(layout.overflowX <= 1, "没有横向溢出", `${layout.overflowX}px`);

  // ---- 真打一局到胜利 ----
  const winText = await playUntilSettled(page, box, { fire: true, build: true, maxSeconds: 180 });
  check(winText !== null && winText.includes("过关"), "打到真实胜利", winText ?? "没出结算");

  const stars = await page.evaluate(() => {
    const el = document.querySelector(".l99-ov-stars");
    return el ? (el.textContent ?? "").split("").filter((c) => c === "★").length : 0;
  });
  check(stars >= 1, "结算给出了星级", `${stars} 星`);

  check(errors.length === 0, "整局没有 JS 报错", errors.slice(0, 2).join(" | "));
  page.off("pageerror", onErr);
  page.off("console", onMsg);
}

async function runLose(page) {
  console.log("\n【失败路径 1280×800】");
  await page.setViewport({ width: 1280, height: 800 });
  const ok = await enterLevel1(page);
  check(ok, "重进第 1 关");
  if (!ok) return;
  const box = await canvasBox(page);
  const text = await playUntilSettled(page, box, { fire: false, build: false, maxSeconds: 180 });
  check(text !== null && text.includes("就差一点点"), "什么都不做会真的守不住", text ?? "没出结算");
  const encourage = await page.evaluate(() => {
    const el = document.querySelector(".l99-ov-sub");
    return el ? el.textContent ?? "" : "";
  });
  check(encourage.length > 6 && !/死|输了|失败|笨/.test(encourage), "失败文案只鼓励", encourage);
}

async function runModes(page) {
  console.log("\n【三个附加模式 1280×800】");
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  const onErr = (e) => errors.push(`pageerror: ${e.message}`);
  const onMsg = (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  };
  page.on("pageerror", onErr);
  page.on("console", onMsg);

  for (const name of ["无尽守家", "双人合作", "非对称对战"]) {
    await openGame(page);
    check(!!(await page.$(".l99-map")), `${name} 之前先站在选关地图上`);
    const opened = await page.evaluate((label) => {
      const btns = [...document.querySelectorAll(".mc-bar .mc-open")];
      const btn = btns.find((b) => (b.textContent ?? "").includes(label));
      if (!btn) return false;
      btn.click();
      return true;
    }, name);
    await sleep(1200);
    const state = await page.evaluate(() => {
      const canvas = document.querySelector(".mc-mode .mc-canvas");
      const pads = document.querySelectorAll(".mc-mode .mc-pad").length;
      return { canvas: !!canvas, pads };
    });
    check(opened && state.canvas, `${name} 能打开并画出战场`, `方向盘 ${state.pads} 套`);
    if (name !== "无尽守家") {
      check(state.pads === 2, `${name} 给了两套方向盘`);
    }
    // 玩一小会儿再退回选关,顺便验证 destroy 不炸
    const box = await page.evaluate(() => {
      const el = document.querySelector(".mc-mode .mc-canvas");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    if (box) {
      for (let i = 0; i < 8; i++) {
        await dismissPrep(page);
        await page.mouse.click(box.x + box.w * 0.7, box.y + box.h * (0.2 + 0.15 * (i % 5))).catch(() => {});
        await sleep(200);
      }
    }
    await dismissPrep(page);
    const back = await page.$(".mc-mode .mc-back");
    if (back) await back.click().catch(() => {});
    await sleep(600);
    const returned = await page.evaluate(() => !!document.querySelector(".l99-map"));
    check(returned, `${name} 能退回选关地图`);
  }
  check(errors.length === 0, "三个模式全程没有 JS 报错", errors.slice(0, 2).join(" | "));
  page.off("pageerror", onErr);
  page.off("console", onMsg);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"],
  });
  const page = await browser.newPage();
  try {
    await runViewport(page, "桌面", 1280, 800);
    await runViewport(page, "手机竖屏", 375, 667);
    await runLose(page);
    await runModes(page);
  } finally {
    await browser.close();
  }

  console.log("\n================ 小怪物危机冒烟结果 ================");
  if (failures.length === 0) {
    console.log("全部通过 ✅");
  } else {
    console.log(`失败 ${failures.length} 项:`);
    for (const f of failures) console.log(` - ${f}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
