/**
 * 窗口 6 R1 fixer · 运行时取证:
 *  1) balloon-pop 乌云章(第 52 关):特殊球徽记 .blp-kbadge 真的挂上、无 emoji 标签;
 *  2) mole-pop 月夜章(第 172 关):夜场氛围层(月牙/星子/剪影)+ 火把同屏。
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio", "--disable-gpu"],
});
const page = await browser.newPage();
await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, hasTouch: true, isMobile: true });

await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await page.evaluate(() => {
  const full = new Array(188).fill(3);
  full[187] = 0;
  for (const id of ["balloon-pop", "mole-pop"]) {
    localStorage.setItem(`yiduo-yixing.l99.${id}`, JSON.stringify(full));
  }
});

async function openLevel(id, n) {
  await page.goto(`${BASE}/#/game/${id}`, { waitUntil: "networkidle0" });
  await sleep(1100);
  // 翻章直到看到第 n 关
  for (let i = 0; i < 12; i++) {
    const found = await page.evaluate((lv) => {
      const hit = [...document.querySelectorAll(".l99-node")].find((el) =>
        (el.getAttribute("aria-label") ?? "").startsWith(`第 ${lv} 关`));
      if (hit) { hit.click(); return true; }
      return false;
    }, n);
    if (found) { await sleep(1400); return true; }
    const flipped = await page.evaluate((idx) => {
      const tabs = [...document.querySelectorAll(".l99-tab")];
      if (!tabs[idx]) return false;
      tabs[idx].click();
      return true;
    }, i);
    if (!flipped) return false;
    await sleep(320);
  }
  return false;
}

const out = {};

if (await openLevel("balloon-pop", 52)) {
  await sleep(6000); // 等特殊球出场
  out.balloonPop = await page.evaluate(() => {
    const badges = [...document.querySelectorAll(".blp-kbadge")];
    const balloons = [...document.querySelectorAll(".blp-balloon")];
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    return {
      balloons: balloons.length,
      kinds: [...new Set(balloons.map((b) => b.dataset.kind))],
      badgeCount: badges.length,
      badgeOnBalloonEmoji: balloons.some((b) => emojiRe.test(b.textContent ?? "")),
    };
  });
} else out.balloonPop = { err: "no-level-52" };

if (await openLevel("mole-pop", 172)) {
  out.molePop = await page.evaluate(() => {
    const scene = document.querySelector(".mp-scene");
    return {
      night: document.querySelector(".mp-wrap")?.classList.contains("mp-night") ?? false,
      moon: !!scene?.querySelector('[data-part="moon"]'),
      stars: scene?.querySelectorAll('[data-part="stars"] circle').length ?? 0,
      trees: !!scene?.querySelector('[data-part="night-trees"]'),
      torches: scene?.querySelectorAll(".mp-flame").length ?? 0,
    };
  });
  await page.screenshot({ path: "/tmp/mole-night-360.png" });
} else out.molePop = { err: "no-level-172" };

console.log(JSON.stringify(out, null, 2));
await browser.close();
