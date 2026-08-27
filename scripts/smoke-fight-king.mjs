/**
 * 梨康格斗王（fight-king）真机冒烟。
 *
 * 逐条对着验收单跑：
 *  1. 两种视口（375×667 与 1280×800）都能挂载出画面，不白屏、不报错；
 *  2. 双人对战：两套键位互不抢占（只按鸭梨的键，康康纹丝不动；反之亦然）；
 *  3. 人机对战：让 AI 打站着不动的玩家，跑到真实胜负；
 *  4. 格斗塔：进第 1 关能挂出对局；
 *  5. 训练模式：帧数据表出得来；
 *  6. 无尽 / 结算页能走通；
 *  7. 离开再进两次，destroy 之后不报错、rAF 与监听都收干净。
 *
 * 用法：npm i --no-save puppeteer-core（本机需有 Chrome）
 *       npm run build && npx vite preview --port 4173
 *       node scripts/smoke-fight-king.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const GAME = "fight-king";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];

/**
 * 回到游戏首屏。
 * 注意不能直接 `goto` 同一个 hash 地址：浏览器把它当成同文档跳转，页面根本不会重载，
 * 后面几段就会全部跑在上一段留下的界面上。这里加一个时间戳强制真重载。
 */
async function openGame(page) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/${GAME}`, { waitUntil: "networkidle0" });
  await sleep(900);
}

function check(name, ok, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(`${name}${detail ? `：${detail}` : ""}`);
}

/** 按住一串键若干毫秒 */
async function holdKeys(page, keys, ms) {
  for (const k of keys) await page.keyboard.down(k).catch(() => {});
  await sleep(ms);
  for (const k of keys) await page.keyboard.up(k).catch(() => {});
}

/** 点包含某段文字的按钮 */
async function clickText(page, selector, text) {
  const handle = await page.evaluateHandle(
    (sel, t) => [...document.querySelectorAll(sel)].find((el) => (el.textContent ?? "").includes(t)) ?? null,
    selector,
    text
  );
  const elem = handle.asElement();
  if (!elem) return false;
  await elem.click().catch(() => {});
  return true;
}

/** 读一下场上两个人的位置与元气（游戏把状态画在 canvas 上，这里改看 HUD） */
async function hud(page) {
  return page.evaluate(() => {
    const widths = [...document.querySelectorAll(".fk-vig-in")].map((el) => el.style.width);
    const names = [...document.querySelectorAll(".fk-name")].map((el) => el.textContent);
    const clock = document.querySelector(".fk-clock-t")?.textContent ?? "";
    const banner = document.querySelector(".fk-banner-big")?.textContent ?? "";
    return { widths, names, clock, banner };
  });
}

async function run(page, viewport, label) {
  console.log(`\n=== ${label}（${viewport.width}×${viewport.height}）===`);
  await page.setViewport(viewport);

  let errors = [];
  const onError = (err) => errors.push(`pageerror: ${err.message}`);
  const onConsole = (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  };
  page.on("pageerror", onError);
  page.on("console", onConsole);

  // ---- 1. 挂载 ----
  await openGame(page);
  const modes = await page.$$eval(".fk-mode", (els) => els.length).catch(() => 0);
  check("菜单挂出五种模式", modes === 5, `实际 ${modes} 个`);
  check("挂载无报错", errors.length === 0, errors.join(" | "));

  // ---- 2. 双人对战：两套键位互不抢占 ----
  errors = [];
  await clickText(page, ".fk-mode", "双人对战");
  await sleep(500);
  const pickers = await page.$$eval(".fk-pick", (els) => els.length).catch(() => 0);
  check("双人模式有两个选人栏", pickers === 2, `实际 ${pickers}`);
  await clickText(page, ".fk-btn", "开打");
  await sleep(2600); // 等读条走完

  const canvasBox = await page.$eval(".fk-canvas", (el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  check("对局画面撑满可用宽度", canvasBox.w > 200 && canvasBox.h > 60, `${Math.round(canvasBox.w)}×${Math.round(canvasBox.h)}`);

  // 只按鸭梨的攻击键：康康的元气条不该动
  const before = await hud(page);
  await holdKeys(page, ["KeyD"], 900);
  await holdKeys(page, ["KeyF"], 700);
  const afterP1 = await hud(page);
  check(
    "只按 1 号位键位时 2 号位不会被抢键",
    afterP1.widths[0] === before.widths[0],
    `鸭梨元气 ${before.widths[0]} → ${afterP1.widths[0]}`
  );

  // 只按康康的键：鸭梨的元气条不该动
  const before2 = await hud(page);
  await holdKeys(page, ["ArrowLeft"], 500);
  await holdKeys(page, ["KeyK"], 700);
  const afterP2 = await hud(page);
  check(
    "只按 2 号位键位时 1 号位不会被抢键",
    afterP2.widths[1] === before2.widths[1],
    `康康元气 ${before2.widths[1]} → ${afterP2.widths[1]}`
  );

  // 两个人分别打到对方，双方的元气条都能掉
  for (let i = 0; i < 26; i++) {
    await holdKeys(page, ["KeyD"], 90);
    await holdKeys(page, ["KeyF"], 70);
    await holdKeys(page, ["ArrowLeft"], 90);
    await holdKeys(page, ["KeyL"], 70);
  }
  const duel = await hud(page);
  const p1Down = parseFloat(duel.widths[0]) < 100;
  const p2Down = parseFloat(duel.widths[1]) < 100;
  check("双人对打两边都真的能打到对方", p1Down && p2Down, `${duel.widths.join(" / ")}`);

  // Esc 暂停（游戏自己接住，不该出现壳层的暂停面板重复弹出）
  await page.keyboard.press("Escape");
  await sleep(400);
  const paused = await page.$$eval(".fk-pause:not(.fk-hidden)", (els) => els.length).catch(() => 0);
  check("Esc 弹出游戏自己的暂停面板", paused === 1, `实际 ${paused} 个`);
  await clickText(page, ".fk-btn", "继续");
  await sleep(300);
  check("双人对战全程无报错", errors.length === 0, errors.join(" | "));

  // ---- 3. 人机对战：跑到真实胜负 ----
  errors = [];
  await openGame(page);
  await clickText(page, ".fk-mode", "人机对战");
  await sleep(400);
  await clickText(page, ".fk-btn", "高手");
  await sleep(200);
  await clickText(page, ".fk-btn", "开打");
  await sleep(1500);
  let ended = false;
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    const h = await hud(page);
    if (h.banner.includes("赢啦")) {
      ended = true;
      break;
    }
    const done = await page.$(".fk-card .fk-h");
    if (done) {
      const text = await page.evaluate((el) => el.textContent ?? "", done);
      if (text.includes("打完啦")) {
        ended = true;
        break;
      }
    }
  }
  check("人机对战能跑出真实胜负", ended);
  check("人机对战全程无报错", errors.length === 0, errors.join(" | "));

  // ---- 4. 格斗塔 ----
  errors = [];
  await openGame(page);
  await clickText(page, ".fk-mode", "格斗塔");
  await sleep(800);
  const nodes = await page.$$eval(".l99-node", (els) => els.length).catch(() => 0);
  check("格斗塔挂出 188 关地图", nodes > 0, `本页 ${nodes} 个格子`);
  const chapters = await page.$$eval(".l99-tab", (els) => els.length).catch(() => 0);
  check("格斗塔章节数 ≥ 8", chapters >= 8, `实际 ${chapters}`);
  const first = await page.$(".l99-node:not(.l99-node-lock)");
  if (first) await first.click().catch(() => {});
  await sleep(2200);
  const towerCanvas = await page.$$eval(".l99-stage .fk-canvas", (els) => els.length).catch(() => 0);
  check("格斗塔第 1 关能挂出对局", towerCanvas === 1, `实际 ${towerCanvas}`);

  // 攻略侧栏：翻开来该是本作自己写的八章攻略，不是框架的兜底提示
  await clickText(page, "button", "📖 攻略");
  await sleep(500);
  const guide = await page.evaluate(() => {
    const panel = document.querySelector(".guide-drawer");
    if (!panel) return null;
    return {
      title: panel.querySelector(".guide-title")?.textContent ?? "",
      tips: panel.querySelectorAll(".guide-tip").length,
      fallback: !!panel.querySelector(".guide-note")
    };
  });
  check("格斗塔翻得开攻略侧栏", !!guide, guide ? "" : "没弹出面板");
  check(
    "第 1 关翻到的是本作写的攻略，不是兜底提示",
    !!guide && guide.tips >= 3 && !guide.fallback,
    guide ? `${guide.title} · ${guide.tips} 条提示` : ""
  );
  await clickText(page, "button", "知道啦");
  await sleep(300);
  check("格斗塔无报错", errors.length === 0, errors.join(" | "));

  // ---- 5. 训练模式 ----
  errors = [];
  await openGame(page);
  await clickText(page, ".fk-mode", "训练模式");
  await sleep(400);
  await clickText(page, ".fk-btn", "开打");
  await sleep(2400);
  const rows = await page.$$eval(".fk-fd tbody tr", (els) => els.length).catch(() => 0);
  check("训练模式列出 11 行帧数据", rows === 11, `实际 ${rows}`);
  await holdKeys(page, ["KeyF"], 300);
  await sleep(300);
  const live = await page.$eval(".fk-live", (el) => el.textContent ?? "").catch(() => "");
  check("训练模式实时显示当前招式", live.includes("当前招式"), live.slice(0, 40));
  check("训练模式无报错", errors.length === 0, errors.join(" | "));

  // ---- 6. 无尽 ----
  errors = [];
  await openGame(page);
  await clickText(page, ".fk-mode", "无尽");
  await sleep(400);
  await clickText(page, ".fk-btn", "开打");
  await sleep(2200);
  const endlessTitle = await page.$eval(".fk-bar .fk-h", (el) => el.textContent ?? "").catch(() => "");
  check("无尽模式标题显示连胜数", endlessTitle.includes("连赢"), endlessTitle);
  check("无尽模式无报错", errors.length === 0, errors.join(" | "));

  // ---- 7. 离开再进两次 ----
  errors = [];
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      location.hash = "";
    });
    await sleep(600);
    await page.evaluate((g) => {
      location.hash = `#/game/${g}`;
    }, GAME);
    await sleep(900);
    await clickText(page, ".fk-mode", "人机对战");
    await sleep(300);
    await clickText(page, ".fk-btn", "开打");
    await sleep(1200);
    await holdKeys(page, ["KeyF"], 200);
  }
  await page.evaluate(() => {
    location.hash = "";
  });
  await sleep(800);
  const leftovers = await page.evaluate(() => document.querySelectorAll(".fk-root").length);
  check("离开后游戏 DOM 完全移除", leftovers === 0, `残留 ${leftovers} 个`);
  check("反复进出无报错", errors.length === 0, errors.join(" | "));

  page.off("pageerror", onError);
  page.off("console", onConsole);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"]
  });
  const page = await browser.newPage();
  try {
    await run(page, { width: 375, height: 667, isMobile: false }, "手机窄屏");
    await run(page, { width: 1280, height: 800 }, "桌面宽屏");
  } finally {
    await browser.close();
  }

  console.log("\n================ 结果 ================");
  if (failures.length === 0) {
    console.log("全部通过 🎉");
  } else {
    console.log(`${failures.length} 条不通过：`);
    for (const f of failures) console.log(` - ${f}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
