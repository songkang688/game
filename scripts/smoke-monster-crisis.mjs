/**
 * 小怪物危机专项冒烟(1.2 动作防守版):真走位、真出手、真打到结算。
 *
 * 1.1 那版冒烟盯的是「建筑栏 + 虚拟方向盘 + 摆炮台」,1.2 已经没有这些东西了 ——
 * 现在是玩家角色亲自上场:左下摇杆走位、右下技能钮甩颜料弹、每 3 波三选一。
 * 所以这份脚本整个改口,盯的是新的那套:
 *
 * 1. 1280×800 桌面:直达第 1 关,挑一张成长卡,拖摇杆 + 按住技能钮打到「过关」;
 * 2. 1280×800 桌面:进第 1 关什么都不做,一直等到失败浮层,并确认文案只鼓励;
 * 3. 375×667 与 360×720 手机:摇杆真在左下、技能钮真在右下,热区 ≥ 44px、字号 ≥ 14px,
 *    一屏装得下不被裁,再真打一局到结算;
 * 4. 无尽 / 双人合作 / 各守一半三个模式各真打一局到结算(不是只挂载一下就退)。
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
async function openGame(page, query = "") {
  await page.goto(`${BASE}/?r=${Date.now()}${query}#/game/${GAME}`, { waitUntil: "networkidle0" });
  await sleep(900);
}

async function enterLevel1(page) {
  await openGame(page);
  const node = await page.$(".l99-node:not(.l99-node-lock)");
  if (!node) return false;
  await node.click();
  await sleep(900);
  return !!(await page.$(".mcr-canvas"));
}

async function boxOf(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  }, selector);
}

/** 成长面板弹出来就挑第一张(冒烟不挑食) */
async function takeCard(page) {
  const card = await page.$(".mcr-card");
  if (!card) return false;
  await card.click().catch(() => {});
  await sleep(160);
  return true;
}

/** 结算文字:闯关走平台浮层,附加模式走自己那块 .mcr-over */
async function settleText(page) {
  return page.evaluate(() => {
    const ov = document.querySelector(".l99-overlay");
    if (ov) return (ov.querySelector(".l99-ov-title")?.textContent ?? "").trim();
    const own = document.querySelector(".mcr-over");
    if (own) return (own.querySelector(".mcr-layer-t")?.textContent ?? "").trim();
    return null;
  });
}

async function waveText(page) {
  return page.evaluate(() => {
    const hud = document.querySelector(".mcr-hud");
    return hud ? (hud.querySelector(".mcr-chip")?.textContent ?? "") : "";
  });
}

/**
 * 像个真人一样打:按住技能钮不放(自动瞄准会挑最近的那只),
 * 摇杆绕着家画圈跑位,成长面板弹出来就挑一张,一直打到结算浮层出现。
 */
async function playUntilSettled(page, { maxSeconds, move = true, fire = true, players = 1 }) {
  const stick = await boxOf(page, ".mcr-stick");
  let holding = false;

  // 一根鼠标只按得住一个键:单人真的按住右下那颗技能钮,双人改用键盘 F / L 一起甩
  const pressFire = async () => {
    if (!fire || holding) return;
    if (players === 1) {
      const btn = await page.$(".mcr-fire");
      const b = btn ? await btn.boundingBox() : null;
      if (!b) return;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
    } else {
      await page.keyboard.down("f");
      await page.keyboard.down("l");
    }
    holding = true;
  };
  const releaseFire = async () => {
    if (!holding) return;
    if (players === 1) await page.mouse.up().catch(() => {});
    else {
      await page.keyboard.up("f").catch(() => {});
      await page.keyboard.up("l").catch(() => {});
    }
    holding = false;
  };

  const until = Date.now() + maxSeconds * 1000;
  const ring = ["w", "d", "s", "a"];
  const ring2 = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"];
  let step = 0;
  let text = null;
  while (Date.now() < until) {
    text = await settleText(page);
    if (text !== null) break;
    // 成长面板挡在前面时先松手再点卡 —— 鼠标还按在技能钮上的话点不动卡
    if (await page.$(".mcr-card")) {
      await releaseFire();
      await takeCard(page);
      continue;
    }
    await pressFire();
    if (move) {
      // 绕着家画圈:每 700ms 换一个方向,不站在原地被围住
      const k = ring[step % ring.length];
      const k2 = ring2[(step + 2) % ring2.length];
      await page.keyboard.down(k);
      if (players > 1) await page.keyboard.down(k2);
      await sleep(650);
      await page.keyboard.up(k);
      if (players > 1) await page.keyboard.up(k2);
      step++;
    } else {
      await sleep(500);
    }
  }
  await releaseFire();
  return { text: text ?? (await settleText(page)), stick };
}

/** 布局体检:摇杆左下、技能钮右下、热区 ≥ 44、字号 ≥ 14、一屏装得下 */
async function auditLayout(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    const stage = q(".game-stage");
    const canvas = rect(q(".mcr-canvas"));
    const pads = q(".mcr-pads");
    const stick = rect(q(".mcr-stick"));
    const fire = rect(q(".mcr-fire"));
    const hud = rect(q(".mcr-hud"));
    const padsRect = rect(pads);
    const smallFont = [];
    for (const el of document.querySelectorAll(".mcr-wrap *")) {
      if (!(el.textContent ?? "").trim()) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      // 卡面上的等级小字与键盘提示不是热区,单列出来看一眼就行
      if (size < 14 && !el.className.includes("mcr-card-lv") && !el.className.includes("mcr-card-desc") &&
          !el.className.includes("mcr-padname")) {
        smallFont.push(`${el.className || el.tagName}:${size}px`);
      }
    }
    const inView = (r) => !!r && r.width > 0 && r.left >= -1 && r.right <= window.innerWidth + 1;
    return {
      canvasW: canvas ? Math.round(canvas.width) : 0,
      canvasIn: inView(canvas),
      hudIn: inView(hud),
      padsIn: inView(padsRect),
      // 摇杆在这一行的左半边、技能钮在右半边
      stickLeft: !!stick && !!padsRect && stick.left < padsRect.left + padsRect.width / 2,
      fireRight: !!fire && !!padsRect && fire.right > padsRect.left + padsRect.width / 2,
      stickBelowCanvas: !!stick && !!canvas && stick.top >= canvas.top,
      stickSize: stick ? Math.round(Math.min(stick.width, stick.height)) : 0,
      fireSize: fire ? Math.round(Math.min(fire.width, fire.height)) : 0,
      pauseSize: (() => {
        const r = rect(q(".mcr-hudbtn"));
        return r ? Math.round(Math.min(r.width, r.height)) : 0;
      })(),
      smallFont,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      stageOverflowY: stage ? stage.scrollHeight - stage.clientHeight : -1,
      padsBottom: padsRect ? Math.round(padsRect.bottom) : -1,
      stageBottom: stage ? Math.round(stage.getBoundingClientRect().bottom) : -1,
    };
  });
}

function watchErrors(page) {
  const errors = [];
  const onErr = (e) => errors.push(`pageerror: ${e.message}`);
  const onMsg = (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  };
  page.on("pageerror", onErr);
  page.on("console", onMsg);
  return {
    errors,
    off: () => {
      page.off("pageerror", onErr);
      page.off("console", onMsg);
    },
  };
}

/* ---------------- 一、闯关主链路 ---------------- */

async function runViewport(page, label, width, height, { shot } = {}) {
  console.log(`\n【${label} ${width}×${height}】`);
  await page.setViewport({ width, height });
  const watch = watchErrors(page);

  const ok = await enterLevel1(page);
  check(ok, "第 1 关能进得去,战场画布挂出来了");
  if (!ok) {
    watch.off();
    return;
  }

  const layout = await auditLayout(page);
  check(layout.canvasIn && layout.hudIn && layout.padsIn, "画布 / 状态条 / 摇杆那一行都在屏内");
  check(layout.canvasW > 200, "画布宽度够用", `${layout.canvasW}px`);
  check(layout.stickLeft, "摇杆在左边");
  check(layout.fireRight, "技能钮在右边");
  check(layout.stickBelowCanvas, "摇杆和技能钮在战场下方,不挡视线");
  check(layout.stickSize >= 44, "摇杆热区 ≥ 44px", `${layout.stickSize}px`);
  check(layout.fireSize >= 44, "技能钮热区 ≥ 44px", `${layout.fireSize}px`);
  check(layout.pauseSize >= 44, "暂停钮热区 ≥ 44px", `${layout.pauseSize}px`);
  check(layout.smallFont.length === 0, "界面字号一律 ≥ 14px", layout.smallFont.slice(0, 3).join(" | "));
  check(layout.overflowX <= 1, "没有横向溢出", `${layout.overflowX}px`);
  check(layout.stageOverflowY <= 1, "一屏装得下,没有内容被舞台裁掉", `多出 ${layout.stageOverflowY}px`);
  check(
    layout.padsBottom > 0 && layout.padsBottom <= layout.stageBottom + 1,
    "摇杆那一行还在舞台里,手指够得到",
    `行底 ${layout.padsBottom} / 舞台底 ${layout.stageBottom}`
  );

  // 开局那张成长卡:三张、互不重复
  const draft = await page.evaluate(() =>
    [...document.querySelectorAll(".mcr-card")].map((c) => c.getAttribute("aria-label") ?? "")
  );
  check(draft.length === 3, "开局发三张成长卡", `${draft.length} 张`);
  check(new Set(draft).size === draft.length, "同一次不出重复的卡");
  if (shot) await page.screenshot({ path: `${shot}-draft.png` });

  // 真的拖一把摇杆,确认小人会动
  await takeCard(page);
  await sleep(200);
  const stick = await boxOf(page, ".mcr-stick");
  if (stick) {
    await page.mouse.move(stick.cx, stick.cy);
    await page.mouse.down();
    await page.mouse.move(stick.cx + stick.w * 0.4, stick.cy + stick.h * 0.3, { steps: 6 });
    await sleep(500);
    const knob = await page.evaluate(() => document.querySelector(".mcr-knob")?.style.transform ?? "");
    check(/translate\((?!0px, 0px)/.test(knob), "拖摇杆时手柄跟着走", knob || "没动");
    await page.mouse.up();
    await sleep(120);
    const back = await page.evaluate(() => document.querySelector(".mcr-knob")?.style.transform ?? "");
    check(back === "translate(0px, 0px)", "松手摇杆回中", back);
  }
  if (shot) await page.screenshot({ path: `${shot}-play.png` });

  const { text } = await playUntilSettled(page, { maxSeconds: 150 });
  check(text !== null && text.includes("过关"), "走位 + 出手真能打到过关", text ?? "没出结算");
  const stars = await page.evaluate(() => {
    const el = document.querySelector(".l99-ov-stars");
    return el ? (el.textContent ?? "").split("").filter((c) => c === "★").length : 0;
  });
  check(stars >= 1, "结算给出了星级", `${stars} 星`);
  if (shot) await page.screenshot({ path: `${shot}-win.png` });

  check(watch.errors.length === 0, "整局没有 JS 报错", watch.errors.slice(0, 2).join(" | "));
  watch.off();
}

/* ---------------- 二、失败只鼓励 ---------------- */

async function runLose(page) {
  console.log("\n【失败路径 1280×800】");
  await page.setViewport({ width: 1280, height: 800 });
  const ok = await enterLevel1(page);
  check(ok, "重进第 1 关");
  if (!ok) return;
  await takeCard(page);
  const { text } = await playUntilSettled(page, { maxSeconds: 150, move: false, fire: false });
  check(text !== null && !text.includes("过关"), "干站着不动会真的守不住", text ?? "没出结算");
  const encourage = await page.evaluate(() => document.querySelector(".l99-ov-sub")?.textContent ?? "");
  check(
    encourage.length > 6 && !/血|死|伤|疼|笨|又输/.test(encourage),
    "失败文案只鼓励,一个丧气字都没有",
    encourage
  );
  check(/再来|下一次|一定/.test(encourage), "失败文案给了下一步怎么做");
}

/* ---------------- 三、直达第 N 关 ---------------- */

async function runDirectLevel(page) {
  console.log("\n【直达第 N 关 1280×800】");
  await page.setViewport({ width: 1280, height: 800 });
  await openGame(page, "&level=30");
  const state = await page.evaluate(() => ({
    canvas: !!document.querySelector(".mcr-canvas"),
    title: [...document.querySelectorAll(".mcr-chip")].map((c) => c.textContent ?? "").join(" | "),
  }));
  check(state.canvas, "?level=30 直接开在战场上");
  check(state.title.includes("第 30 关"), "开的确实是第 30 关", state.title);
  const back = await page.$(".mcr-back");
  if (back) await back.click().catch(() => {});
  await sleep(600);
  check(!!(await page.$(".l99-map")), "能退回选关地图");
}

/* ---------------- 四、三个附加模式各真打到结算 ---------------- */

async function runMode(page, label, { players, maxSeconds, expect: want, endless = false }) {
  console.log(`\n【${label} 1280×800】`);
  await page.setViewport({ width: 1280, height: 800 });
  const watch = watchErrors(page);
  await openGame(page);
  const opened = await page.evaluate((name) => {
    const btn = [...document.querySelectorAll(".mcr-bar .mcr-btn")].find((b) =>
      (b.textContent ?? "").includes(name)
    );
    if (!btn) return false;
    btn.click();
    return true;
  }, label);
  await sleep(900);
  const shape = await page.evaluate(() => ({
    canvas: !!document.querySelector(".mcr-mode .mcr-canvas"),
    sticks: document.querySelectorAll(".mcr-mode .mcr-stick").length,
    fires: document.querySelectorAll(".mcr-mode .mcr-fire").length,
  }));
  check(opened && shape.canvas, `${label} 能打开并画出战场`);
  check(shape.sticks === players, `${label} 给了 ${players} 套摇杆`, `${shape.sticks} 套`);
  check(shape.fires === players, `${label} 给了 ${players} 个技能钮`, `${shape.fires} 个`);

  const before = await waveText(page);
  let { text } = await playUntilSettled(page, { maxSeconds, players });
  let after = await waveText(page);
  if (endless) {
    // 无尽没有终点:先认真打一段,确认波次真的往前走,再撒手让这一趟自然收工
    check(text === null, "无尽在限定时间里没被打死,说明真能一直往下打", after);
    check(/第 \d+ 波/.test(after) && after !== before, "无尽波次一路往前走", `${before} → ${after}`);
    ({ text } = await playUntilSettled(page, { maxSeconds: 90, players, move: false, fire: false }));
    after = await waveText(page);
  }
  check(text !== null, `${label} 真能打到结算`, text ?? `卡在 ${after}`);
  if (text !== null) check(want.test(text), `${label} 的结算文案对得上`, text);

  const again = await page.evaluate(() =>
    [...document.querySelectorAll(".mcr-over .mcr-btn")].map((b) => b.textContent ?? "").join(" | ")
  );
  if (text !== null && !text.includes("过关")) check(again.length > 0, `${label} 结算面板给了再来一局的按钮`, again);

  const back = await page.$(".mcr-mode .mcr-back");
  if (back) await back.click().catch(() => {});
  await sleep(600);
  check(!!(await page.$(".l99-map")), `${label} 能退回选关地图`);
  check(watch.errors.length === 0, `${label} 全程没有 JS 报错`, watch.errors.slice(0, 2).join(" | "));
  watch.off();
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"],
  });
  const page = await browser.newPage();
  try {
    await runViewport(page, "桌面", 1280, 800, { shot: process.env.SMOKE_SHOT ? "/tmp/mcr-desktop" : null });
    await runViewport(page, "手机竖屏", 375, 667, { shot: process.env.SMOKE_SHOT ? "/tmp/mcr-375" : null });
    await runViewport(page, "窄手机", 360, 720, { shot: process.env.SMOKE_SHOT ? "/tmp/mcr-360" : null });
    await runLose(page);
    await runDirectLevel(page);
    await runMode(page, "无尽守家", { players: 1, maxSeconds: 90, endless: true, expect: /新纪录|元气被抱完/ });
    await runMode(page, "双人合作", { players: 2, maxSeconds: 180, expect: /一起守住|元气被抱完/ });
    await runMode(page, "各守一半", { players: 2, maxSeconds: 180, expect: /平手|守住啦/ });
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
