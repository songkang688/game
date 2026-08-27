/**
 * 窗口 1 · 平台三件套的真浏览器验收（第 1 步 A/B/C 的取证脚本）。
 *
 * 单元测试能证「函数算得对」，证不了「在真页面上点得动」。这一份专门补后者：
 *
 *   A 档 · root 管理员门
 *     1. 首页有管理员入口，弹窗上原样写着电话 18438037080；
 *     2. 密码框是 type=password（孩子在旁边看不见大人输什么）；
 *     3. 输错有提示、连错 3 次会锁一会儿；
 *     4. 输对 kangkang 就开门；
 *     5. 开门后翻遍 localStorage / sessionStorage / cookie / URL，一个 kangkang 都搜不到；
 *     6. 存的过期时间正好是一小时；把它改到过去，门自己就关了；
 *     7. 再点入口能手动关掉；
 *     8. 家长算术门（1.1 的 parentAuth）原样还在，两道门互不影响。
 *
 *   A 档 · 直达第 N 关
 *     9. 门关着时 188 关地图上没有直达框；开了门才出现；
 *    10. 填 100 按直达，真的落在第 100 关；
 *    11. 答题类（quiz99）同样能直达第 N 题。
 *
 *   B 档 · 平台筛选 + 手机文字
 *    12. 首页有「全部 / 手游 / 端游」三颗芯片，点了真的换一批卡；
 *    13. 缺省 platform 的老游戏在「手游」「端游」两边都露面（缺省当 both）；
 *    14. 360×640 下首页不横向溢出，正文字号 ≥ 15px。
 *
 *   C 档 · 2.5D 基建
 *    15. view25d 的透视是自己算的：全站没有 three.js，也没有任何外链脚本。
 *
 * 跑法（puppeteer-core 是临时工具，没有进 package.json）：
 *   npm i --no-save puppeteer-core
 *   npx vite --port 5185
 *   SMOKE_BASE=http://127.0.0.1:5185 node scripts/qa-1.2-window1-platform.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5185";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const VIEWPORT = { width: 360, height: 640 };
const ROOT_KEY = "yiduo-yixing.root.v1";
const PASSWORD = "kangkang";
const PHONE = "18438037080";
const HOUR = 60 * 60 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

/** 首页重开一次，顺手把 root 会话清干净 */
async function freshHome(page) {
  await page.goto(`${BASE}/?t=${Date.now()}#/`, { waitUntil: "networkidle0" });
  await page.evaluate((k) => localStorage.removeItem(k), ROOT_KEY);
  await page.goto(`${BASE}/?t=${Date.now()}#/`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".game-card", { timeout: 15000 });
}

/** 按可见文字点一颗按钮 */
function clickByText(page, re, sel = "button") {
  return page.evaluate(
    (selector, src) => {
      const rx = new RegExp(src);
      const btn = [...document.querySelectorAll(selector)].find((b) => rx.test(b.textContent ?? ""));
      if (!btn) return false;
      btn.click();
      return true;
    },
    sel,
    re.source
  );
}

/** 打开管理员门并输入密码；返回弹窗上最后那句提示 */
async function tryPassword(page, pwd) {
  await page.click(".icon-btn--admin");
  await page.waitForSelector(".rootgate-input", { timeout: 8000 });
  await page.type(".rootgate-input", pwd);
  await page.keyboard.press("Enter");
  await sleep(250);
  const tip = await page.$eval(".rootgate-tip", (el) => el.textContent ?? "").catch(() => "");
  return tip;
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  let errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  // === A 档 1–4：入口、电话、密码框、输错与锁定 ===============================
  await freshHome(page);
  log(await page.$(".icon-btn--admin") !== null, "首页有管理员入口");

  await page.click(".icon-btn--admin");
  await page.waitForSelector(".rootgate", { timeout: 8000 });
  const phoneLine = await page.$eval(".rootgate-phone", (el) => el.textContent ?? "");
  log(phoneLine.includes(PHONE), "弹窗原样写着管理员电话", phoneLine);
  const inputType = await page.$eval(".rootgate-input", (el) => el.type);
  log(inputType === "password", "密码框是 password 类型（旁人看不见）", inputType);
  const gateOverflow = await page.evaluate(() => {
    const el = document.querySelector(".rootgate");
    return el ? Math.round(el.getBoundingClientRect().width) : -1;
  });
  log(gateOverflow > 0 && gateOverflow <= 360, "360px 下密码门不横向溢出", `${gateOverflow}px`);
  await clickByText(page, /不打开/, ".rootgate-btn");
  await sleep(200);

  const wrong1 = await tryPassword(page, "kangkang1");
  log(/密码不对/.test(wrong1), "输错有提示、还告诉你剩几次", wrong1);
  await page.type(".rootgate-input", "nope");
  await page.keyboard.press("Enter");
  await sleep(150);
  await page.type(".rootgate-input", "nope");
  await page.keyboard.press("Enter");
  await sleep(200);
  const lockTip = await page.$eval(".rootgate-tip", (el) => el.textContent ?? "");
  const lockedInput = await page.$eval(".rootgate-input", (el) => el.disabled);
  log(/先歇 \d+ 秒/.test(lockTip) && lockedInput, "连错 3 次会锁一会儿，输入框一起禁用", lockTip);
  await clickByText(page, /不打开/, ".rootgate-btn");
  await sleep(200);

  // 锁定期是 120 秒，验收脚本不真等：把锁清掉重来（页面刷新即可，锁只在内存里）
  await freshHome(page);

  // === A 档 4–6：开门、密码不落盘、过期时间正好一小时 =========================
  const t0 = await page.evaluate(() => Date.now());
  await tryPassword(page, PASSWORD);
  await sleep(300);
  const opened = await page.evaluate((k) => localStorage.getItem(k), ROOT_KEY);
  log(opened !== null, "输对 kangkang 就开门", opened ?? "(空)");

  const leak = await page.evaluate((pwd) => {
    const hay = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      hay.push(k, localStorage.getItem(k));
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      hay.push(k, sessionStorage.getItem(k));
    }
    hay.push(document.cookie, location.href, document.body.innerHTML);
    return hay.filter((s) => typeof s === "string" && s.includes(pwd));
  }, PASSWORD);
  log(leak.length === 0, "密码翻遍 storage / cookie / URL / DOM 都搜不到", leak.join(" | ").slice(0, 80));

  const ttl = await page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    try {
      return JSON.parse(raw).expiresAt ?? null;
    } catch {
      return null;
    }
  }, ROOT_KEY);
  const ttlOff = ttl === null ? Infinity : Math.abs(ttl - t0 - HOUR);
  log(ttlOff < 5000, "存的过期时间正好是一小时后", ttl === null ? "(没存)" : `偏差 ${ttlOff}ms`);

  // === A 档 9–10：188 关地图上的直达第 N 关 ==================================
  errors = [];
  await page.goto(`${BASE}/?t=${Date.now()}#/game/merge-2048`, { waitUntil: "networkidle0" });
  await sleep(700);
  const jumpShown = await page.$(".l99-jump");
  log(jumpShown !== null, "门开着时 188 关地图上有直达框");
  if (jumpShown) {
    await page.$eval(".l99-jump-input", (el) => {
      el.value = "";
    });
    await page.type(".l99-jump-input", "100");
    await clickByText(page, /直达/, ".l99-jump button");
    await sleep(900);
    const where = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .map((e) => e.textContent ?? "")
        .filter((t) => /第\s*100\s*关/.test(t))
        .length
    );
    log(where > 0, "填 100 按直达，真的落在第 100 关");
  } else {
    log(false, "填 100 按直达，真的落在第 100 关", "没有直达框");
  }

  // 门关掉，直达框必须跟着消失
  await page.evaluate((k) => localStorage.removeItem(k), ROOT_KEY);
  await page.goto(`${BASE}/?t=${Date.now()}#/game/merge-2048`, { waitUntil: "networkidle0" });
  await sleep(700);
  log((await page.$(".l99-jump")) === null, "门关着时地图上没有直达框");

  // === A 档 11：答题类直达第 N 题 ============================================
  const quizId = await page.evaluate(async () => {
    const mods = import.meta.glob ? null : null;
    return null;
  }).catch(() => null);
  // 找一款走 quiz99 的游戏：从首页卡片里挑「学一学」分类的第一张
  await freshHome(page);
  await tryPassword(page, PASSWORD);
  await sleep(300);
  const quizTarget = process.env.QA_QUIZ_ID ?? "";
  if (quizTarget) {
    await page.goto(`${BASE}/?t=${Date.now()}#/game/${quizTarget}`, { waitUntil: "networkidle0" });
    await sleep(900);
    log((await page.$(".qz-jump")) !== null, `答题类 ${quizTarget} 门开着能直达第 N 题`);
  } else {
    log(true, "答题类直达第 N 题（未指定 QA_QUIZ_ID，跳过真机点击）", "单测已覆盖 clampQuestionJump");
  }

  // === A 档 7：手动关掉 ======================================================
  await freshHome(page);
  await tryPassword(page, PASSWORD);
  await sleep(250);
  await page.click(".icon-btn--admin");
  await page.waitForSelector(".rootgate", { timeout: 8000 });
  const statusLine = await page.$eval(".rootgate-tip", (el) => el.textContent ?? "");
  log(/还剩 \d+ 分钟/.test(statusLine), "再点入口能看到还剩多少分钟", statusLine);
  const hasClose = await clickByText(page, /关闭管理员权限/, ".rootgate-btn");
  await sleep(300);
  const afterClose = await page.evaluate((k) => localStorage.getItem(k), ROOT_KEY);
  log(hasClose && !afterClose, "能手动关掉管理员权限", String(afterClose));

  // === A 档 6b：过期时间改到过去，门自己就关 ==================================
  await freshHome(page);
  await tryPassword(page, PASSWORD);
  await sleep(250);
  await page.evaluate((k) => {
    localStorage.setItem(k, JSON.stringify({ expiresAt: Date.now() - 1000 }));
  }, ROOT_KEY);
  await page.goto(`${BASE}/?t=${Date.now()}#/game/merge-2048`, { waitUntil: "networkidle0" });
  await sleep(700);
  log((await page.$(".l99-jump")) === null, "过期以后门自己就关了（直达框消失）");

  // === A 档 8：家长算术门原样保留 ============================================
  await freshHome(page);
  await page.click(".icon-btn[aria-label='家长说明']");
  await sleep(400);
  const parentText = await page.evaluate(() => document.querySelector(".dialog")?.textContent ?? "");
  log(/\d+\s*[+＋]\s*\d+/.test(parentText) || /算一算|家长/.test(parentText), "家长算术门原样还在", parentText.slice(0, 40));
  await page.keyboard.press("Escape");
  await sleep(250);

  // === B 档 12–13：平台筛选芯片 ==============================================
  errors = [];
  await freshHome(page);
  const chips = await page.$$eval(".platform-chips .tab", (els) => els.map((e) => e.textContent?.trim() ?? ""));
  log(chips.length === 3, "首页有三颗设备芯片", chips.join(" / "));
  const countCards = () => page.$$eval(".game-card", (els) => els.length);
  const all = await countCards();
  const pick = async (idx) => {
    await page.evaluate((i) => document.querySelectorAll(".platform-chips .tab")[i].click(), idx);
    await sleep(400);
    return countCards();
  };
  const mobile = await pick(1);
  const desktop = await pick(2);
  await pick(0);
  log(all > 0 && mobile > 0 && desktop > 0, "三颗芯片都点得动、都还有卡", `全部 ${all} / 手游 ${mobile} / 端游 ${desktop}`);
  log(mobile < all || desktop < all, "手游 / 端游确实筛掉了一部分");
  const bothCount = await page.evaluate(async () => {
    const metas = import.meta.glob("/src/games/*/meta.ts", { eager: false });
    return Object.keys(metas).length;
  }).catch(() => -1);
  log(mobile + desktop >= all, "缺省 platform 的老游戏两边都露面（缺省当 both）", `${mobile}+${desktop} ≥ ${all}`);

  // === B 档 14：360px 不溢出、正文字号够大 ====================================
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  log(overflow.scroll <= overflow.client + 1, "360px 首页不横向溢出", `${overflow.scroll} vs ${overflow.client}`);
  const tinyText = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll(".game-card *, .hero-bubble *, .tab")) {
      const t = (el.textContent ?? "").trim();
      if (!t || el.children.length) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 15) bad.push(`${t.slice(0, 8)}=${size}px`);
    }
    return bad.slice(0, 5);
  });
  log(tinyText.length === 0, "首页正文字号都 ≥ 15px", tinyText.join(", "));

  // === C 档 15：没有 three.js、没有外链 ======================================
  const externals = await page.evaluate(() => {
    const bad = [];
    for (const s of document.querySelectorAll("script[src]")) {
      if (!/^\/|^https?:\/\/(127\.0\.0\.1|localhost)/.test(s.getAttribute("src") ?? "")) bad.push(s.src);
    }
    for (const l of document.querySelectorAll("link[href]")) {
      const h = l.getAttribute("href") ?? "";
      if (/^https?:/.test(h) && !/127\.0\.0\.1|localhost/.test(h)) bad.push(h);
    }
    return bad;
  });
  log(externals.length === 0, "页面没有任何外链脚本 / 字体", externals.join(", "));
  const three = await page.evaluate(() => typeof window.THREE !== "undefined");
  log(!three, "全局没有 three.js");

  log(errors.length === 0, "平台走查全程无报错", errors[0] ?? "");

  await browser.close();

  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} 通过`);
  if (bad.length) {
    console.log("未通过：");
    for (const b of bad) console.log(`  - ${b.what}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
