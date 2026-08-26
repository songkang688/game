/**
 * 噗噗兄弟的真机冒烟:用无头 Chrome 把四种玩法各走一遍,收 pageerror / console.error,
 * 顺手在 375×667(手机竖屏)和 900×720(桌面)两种尺寸下各截几张图。
 *
 * 用法:npm i --no-save puppeteer-core(本机需有 Chrome),
 *      npm run build && npx vite preview --port 4173,再 node scripts/smoke-puff-bros.mjs
 */
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const OUT = process.env.SMOKE_OUT ?? "/tmp/puff-bros-smoke";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 重新进游戏。goto 到同一个 hash 不会重新加载文档,所以先回首页再进,
 * 不然拿到的是上一段留下的状态。
 */
async function reopen(page) {
  await page.goto(`${BASE}/#/`, { waitUntil: "networkidle2" });
  await sleep(300);
  await page.goto(`${BASE}/#/game/puff-bros`, { waitUntil: "networkidle2" });
  await page.waitForSelector(".pb-modebar", { timeout: 15000 });
  await sleep(500);
}

/** 按文字找一个按钮并点它 */
async function clickByText(page, selector, text) {
  const handle = await page.evaluateHandle(
    (sel, txt) => [...document.querySelectorAll(sel)].find((b) => (b.textContent ?? "").includes(txt)) ?? null,
    selector,
    text
  );
  const el = handle.asElement();
  if (!el) throw new Error(`找不到写着「${text}」的 ${selector}`);
  await el.click();
  await sleep(500);
}

/**
 * 有没有内容被下沿切掉。
 * 外壳是不滚动的,超出去的部分直接看不见,scrollHeight 也不跟着变大,
 * 所以只能拿元素自己的位置去量;而且拦住它的不一定是窗口,
 * 外壳那几层 overflow:hidden 的下沿往往还要更靠上。
 */
async function clipped(page, where) {
  return page.evaluate((label) => {
    const wrap = document.querySelector(".pb-wrap");
    if (!wrap) return "";
    let limit = window.innerHeight;
    for (let e = wrap.parentElement; e; e = e.parentElement) {
      if (getComputedStyle(e).overflowY !== "visible") limit = Math.min(limit, e.getBoundingClientRect().bottom);
    }
    const over = Math.round(wrap.getBoundingClientRect().bottom - limit);
    return over > 0 ? `${label}:底下 ${over}px 被切掉了,看不见` : "";
  }, where);
}

/** 按住一串键玩一会儿 */
async function play(page, keys, ms) {
  for (const k of keys) await page.keyboard.down(k);
  await sleep(ms);
  for (const k of keys) await page.keyboard.up(k);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });

  const shots = [];
  const shot = async (name) => {
    const file = `${OUT}/${name}.png`;
    await page.screenshot({ path: file });
    shots.push(file);
  };

  await page.setViewport({ width: 900, height: 720, deviceScaleFactor: 2 });
  await reopen(page);
  await shot("01-mode-bar");

  // ---- 188 关闯关 ----
  await page.click(".l99-node, .map-node, .level-node").catch(async () => {
    // 关卡地图的节点类名各家不同,退而求其次点第一个可点的圆点
    const node = await page.$("[data-level], .node");
    if (node) await node.click();
  });
  await sleep(900);
  await page.waitForSelector(".pb-cv", { timeout: 10000 });
  await play(page, ["KeyD"], 700);
  await play(page, ["KeyF"], 120);
  await sleep(500);
  await play(page, ["KeyD"], 500);
  await play(page, ["KeyG"], 200);
  await sleep(600);
  await shot("02-campaign");
  errors.push(...[await clipped(page, "900×720 闯关")].filter(Boolean));

  const hud = await page.$eval(".pb-bar-txt", (n) => n.textContent);
  if (!/咕噜怪 \d+\/\d+/.test(hud ?? "")) errors.push(`闯关 HUD 不对:${hud}`);

  // 暂停面板
  await page.keyboard.press("Escape");
  await sleep(400);
  await shot("03-pause");
  if (!(await page.$(".pb-veil"))) errors.push("Esc 没有弹出暂停面板");
  await page.keyboard.press("Escape");
  await sleep(300);

  // ---- 人机三档 ----
  await reopen(page);
  await clickByText(page, ".pb-mode", "人机三档");
  await page.waitForSelector(".pb-picks", { timeout: 8000 });
  await shot("04-bot-picker");
  const picks = await page.$$eval(".pb-pick-name", (ns) => ns.map((n) => n.textContent?.trim()));
  if (picks.length !== 3) errors.push(`人机档位应该是三档,实际 ${picks.length} 档`);
  await clickByText(page, ".pb-pick", "泡泡大师");
  await page.waitForSelector(".pb-cv", { timeout: 8000 });
  const stillShowing = await page.evaluate(() => {
    const shown = (sel) => {
      const el = document.querySelector(sel);
      return !!el && el.getClientRects().length > 0;
    };
    return [
      shown(".pb-modebar") ? "模式按钮" : "",
      shown(".pb-picker") ? "挑对手的面板" : "",
      [...document.querySelectorAll(".pb-head")].filter((h) => h.getClientRects().length > 0).length > 1
        ? "两行标题栏"
        : "",
    ].filter(Boolean);
  });
  for (const what of stillShowing) errors.push(`已经进对局了,${what}还杵在页面上`);
  await play(page, ["KeyD"], 600);
  await play(page, ["KeyF"], 150);
  await sleep(2500);
  await shot("05-duel-vs-bot");
  errors.push(...[await clipped(page, "900×720 人机对战")].filter(Boolean));
  const score = await page.$eval(".pb-head .pb-chip", (n) => n.textContent);
  if (!/\d+ : \d+/.test(score ?? "")) errors.push(`对战比分条不对:${score}`);

  // ---- 无尽 ----
  await reopen(page);
  await clickByText(page, ".pb-mode", "噗噗不停");
  await page.waitForSelector(".pb-cv", { timeout: 8000 });
  await play(page, ["KeyD"], 600);
  await play(page, ["KeyF"], 150);
  await sleep(1200);
  await shot("06-endless");
  errors.push(...[await clipped(page, "900×720 无尽")].filter(Boolean));

  const waveChip = await page.$eval(".pb-hud .pb-chip:last-of-type", (n) => n.textContent);
  if (!/\d+ 分/.test(waveChip ?? "")) errors.push(`无尽的分数条不对:${waveChip}`);

  // ---- 手机竖屏:双人对战 ----
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2 });
  await reopen(page);
  await clickByText(page, ".pb-mode", "双人对战");
  await page.waitForSelector(".pb-cv", { timeout: 8000 });
  await sleep(600);
  await shot("07-duel-mobile-375");

  // 窄屏上两套触屏按键得排得下,不能溢出
  const overflow = await page.evaluate(() => {
    const pads = document.querySelector(".pb-pads");
    if (!pads) return "没有触屏按键";
    return pads.scrollWidth > pads.clientWidth + 1 ? `触屏按键溢出 ${pads.scrollWidth}>${pads.clientWidth}` : "";
  });
  if (overflow) errors.push(overflow);
  errors.push(...[await clipped(page, "375×667 双人对战")].filter(Boolean));

  // 窄屏闯关是最挤的一种:HUD + 画面 + 一整套按键 + 提示语都得塞进一屏
  await reopen(page);
  const node = await page.$("[data-level], .node, .l99-node");
  if (node) await node.click();
  await sleep(900);
  await page.waitForSelector(".pb-cv", { timeout: 10000 });
  await shot("08-campaign-mobile-375");
  errors.push(...[await clipped(page, "375×667 闯关")].filter(Boolean));

  await browser.close();

  console.log(shots.map((s) => `截图 ${s}`).join("\n"));
  if (errors.length) {
    console.error(`\n发现 ${errors.length} 个问题:`);
    for (const e of errors) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log("\n噗噗兄弟四种玩法都跑通了,没有 pageerror。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
