/**
 * 金矿钩钩的真机冒烟:用无头 Chrome 把两种模式各走一遍,收 pageerror / console.error,
 * 顺手在 375×667(手机竖屏)和 1280×800(桌面)两种尺寸下量一遍有没有被切掉,并各截几张图。
 *
 * 覆盖的路径:
 *  - 开场的模式选择 → 闯关矿洞 → 选关地图 → 第 1 关放绳钩到东西 → 商店买道具 → Esc 暂停;
 *  - 一路玩到真出胜负(等倒计时走完),看结算浮层出不出来;
 *  - 退出去再进来一次,确认没有残留监听器报错;
 *  - 无尽矿井开挖一层。
 *
 * 用法:npm i --no-save puppeteer-core(本机需有 Chrome),
 *      npm run build && npx vite preview --port 4173,再 node scripts/smoke-gold-hook.mjs
 */
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const OUT = process.env.SMOKE_OUT ?? "/tmp/gold-hook-smoke";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 重新进游戏:goto 同一个 hash 不会重新加载文档,所以先回首页再进 */
async function reopen(page) {
  await page.goto(`${BASE}/#/`, { waitUntil: "networkidle2" });
  await sleep(250);
  await page.goto(`${BASE}/#/game/gold-hook`, { waitUntil: "networkidle2" });
  await page.waitForSelector(".gh-card", { timeout: 15000 });
  await sleep(350);
}

/** 按文字找一个元素并点它 */
async function clickByText(page, selector, text) {
  const handle = await page.evaluateHandle(
    (sel, txt) => [...document.querySelectorAll(sel)].find((b) => (b.textContent ?? "").includes(txt)) ?? null,
    selector,
    text
  );
  const el = handle.asElement();
  if (!el) throw new Error(`找不到写着「${text}」的 ${selector}`);
  await el.click();
  await sleep(400);
}

/**
 * 有没有内容被下沿切掉。外壳不滚动,超出去的部分直接看不见,
 * 所以拿元素自己的位置去量,而且拦住它的往往是外壳那几层 overflow:hidden。
 */
async function clipped(page, where) {
  return page.evaluate((label) => {
    const wrap = document.querySelector(".gh-wrap");
    if (!wrap) return "";
    let limit = window.innerHeight;
    for (let e = wrap.parentElement; e; e = e.parentElement) {
      if (getComputedStyle(e).overflowY !== "visible") limit = Math.min(limit, e.getBoundingClientRect().bottom);
    }
    const over = Math.round(wrap.getBoundingClientRect().bottom - limit);
    return over > 0 ? `${label}:底下 ${over}px 被切掉了,看不见` : "";
  }, where);
}

/** 横向有没有溢出 */
async function overflowX(page, where) {
  return page.evaluate((label) => {
    const over = Math.round(document.documentElement.scrollWidth - window.innerWidth);
    return over > 1 ? `${label}:横向多出来 ${over}px` : "";
  }, where);
}

/** 进第 1 关 */
async function enterLevel1(page) {
  await clickByText(page, ".gh-card", "闯关矿洞");
  await page.waitForSelector(".l99-node", { timeout: 10000 });
  await page.click(".l99-node");
  await page.waitForSelector(".gh-cv", { timeout: 10000 });
  await sleep(400);
}

/** 反复放绳,直到钩到点东西(金币数变了)或者试够次数 */
async function digUntilCoin(page, tries = 14) {
  const coins = () => page.$eval(".gh-hud .gh-chip", (n) => Number((n.textContent ?? "").replace(/\D/g, "")));
  const before = await coins();
  for (let i = 0; i < tries; i++) {
    await page.keyboard.press("Space");
    await sleep(1400);
    if ((await coins()) !== before) return true;
  }
  return false;
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

  // ---------------- 桌面 1280×800 ----------------
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await reopen(page);
  await shot("01-modes-desktop");
  const cards = await page.$$eval(".gh-card-name", (ns) => ns.map((n) => n.textContent?.trim()));
  if (cards.length !== 2) errors.push(`开场应该有两张模式卡,实际 ${cards.length} 张:${cards.join("/")}`);

  await enterLevel1(page);
  await shot("02-level1-desktop");
  errors.push(...[await clipped(page, "1280×800 第 1 关"), await overflowX(page, "1280×800 第 1 关")].filter(Boolean));

  if (!(await digUntilCoin(page))) errors.push("放了十几次绳都没钩到任何东西");
  await shot("03-hauled-desktop");

  // 商店
  await clickByText(page, ".gh-btn", "商店");
  await page.waitForSelector(".gh-shoplist", { timeout: 5000 });
  await shot("04-shop");
  const rows = await page.$$eval(".gh-shopname", (ns) => ns.map((n) => n.textContent?.trim()));
  if (rows.length !== 3) errors.push(`商店应该有三样道具,实际 ${rows.length} 样`);
  const bought = await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".gh-buy")].find((b) => !b.disabled);
    if (!btn) return "没有一件买得起(启动金币加钩到的钱都不够?)";
    btn.click();
    return "";
  });
  if (bought) errors.push(bought);
  await sleep(300);
  await clickByText(page, ".gh-btn", "接着挖");

  // Esc 暂停:开一次、关一次都要生效,而且不许把外壳自己的暂停也勾出来
  await page.keyboard.press("Escape");
  await sleep(400);
  const paused = await page.evaluate(() => ({
    mine: document.querySelector(".gh-veil-title")?.textContent ?? "",
    shell: !!document.querySelector(".overlay"),
  }));
  if (!paused.mine.includes("歇")) errors.push(`Esc 没有弹出游戏自己的暂停面板(拿到「${paused.mine}」)`);
  if (paused.shell) errors.push("Esc 把外壳的暂停也勾出来了,两层暂停叠在一起");
  await shot("05-pause");
  await page.keyboard.press("Escape");
  await sleep(400);
  if (await page.evaluate(() => document.querySelector(".gh-veil")?.hidden === false)) {
    errors.push("再按一次 Esc 关不掉暂停面板");
  }

  // 玩到真出胜负:一直放绳直到倒计时走完
  const deadline = Date.now() + 70000;
  while (Date.now() < deadline) {
    if (await page.$(".l99-overlay")) break;
    await page.keyboard.press("Space");
    await sleep(900);
  }
  if (!(await page.$(".l99-overlay"))) errors.push("等了 70 秒也没等到关卡结算浮层");
  else {
    const title = await page.$eval(".l99-ov-title", (n) => n.textContent?.trim());
    if (!title) errors.push("结算浮层没有标题");
    await shot("06-settle");
  }

  // 退出去再进来一次
  await reopen(page);
  await enterLevel1(page);
  await sleep(600);
  await shot("07-reenter");
  if (!(await page.$(".gh-cv"))) errors.push("第二次进关卡没有画面");

  // 无尽矿井
  await reopen(page);
  await clickByText(page, ".gh-card", "无尽矿井");
  await clickByText(page, ".gh-btn", "开挖");
  await page.waitForSelector(".gh-cv", { timeout: 8000 });
  await digUntilCoin(page, 6);
  await shot("08-endless-desktop");
  errors.push(...[await clipped(page, "1280×800 无尽"), await overflowX(page, "1280×800 无尽")].filter(Boolean));

  // ---------------- 手机 375×667 ----------------
  await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2 });
  await reopen(page);
  await shot("09-modes-phone");
  errors.push(...[await clipped(page, "375×667 模式选择"), await overflowX(page, "375×667 模式选择")].filter(Boolean));

  await enterLevel1(page);
  await sleep(500);
  await shot("10-level1-phone");
  errors.push(...[await clipped(page, "375×667 第 1 关"), await overflowX(page, "375×667 第 1 关")].filter(Boolean));

  // 手机上用触屏:直接点画布放绳
  const box = await page.$eval(".gh-cv", (n) => {
    const r = n.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  });
  if (box.w < 150) errors.push(`手机上矿洞画面只有 ${Math.round(box.w)}px 宽,太小了`);
  await page.mouse.click(box.x, box.y);
  await sleep(1500);
  await shot("11-phone-dig");

  await clickByText(page, ".gh-btn", "商店");
  await sleep(300);
  await shot("12-phone-shop");
  errors.push(...[await clipped(page, "375×667 商店")].filter(Boolean));

  await browser.close();

  console.log(`截图:\n  ${shots.join("\n  ")}`);
  if (errors.length > 0) {
    console.error(`\n冒烟发现 ${errors.length} 个问题:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("\n金矿钩钩冒烟通过:两种模式都能玩到真结算,两种尺寸都没被切掉。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
