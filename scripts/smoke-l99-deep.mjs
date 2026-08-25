/**
 * 深关冒烟:把 22 款 l99 框架游戏的存档种到前 98 关全通,
 * 直接点进第 99 关(参数化生成的最深关),看有没有生成/挂载崩溃。
 * 用法:npm i --no-save puppeteer-core(本机需有 Chrome),
 *      npm run build && npx vite preview --port 4173,再 node scripts/smoke-l99-deep.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

// 22 款走 level99.ts 通用框架的游戏
const L99_IDS = [
  "balloon-pop", "brick-break", "bubble-pop", "clock-house", "color-fun",
  "find-diff", "fruit-catch", "kitty-care", "lianliankan", "match-stars",
  "math-farm", "memory-cards", "mole-pop", "music-stars", "pinyin-train",
  "puzzle-tiles", "red-blue-race", "red-blue-tap", "red-blue-tug",
  "shape-kingdom", "snake-snack", "word-garden"
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio", "--window-size=900,1200"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 1200 });

  const failures = [];
  let errors = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });

  await page.goto(BASE, { waitUntil: "networkidle0" });

  for (const id of L99_IDS) {
    errors = [];
    // 前 98 关全 3 星,只留最后一关未通 → 第 99 关可点
    await page.evaluate((gid) => {
      const arr = Array.from({ length: 99 }, (_, i) => (i < 98 ? 3 : 0));
      localStorage.setItem(`yiduo-yixing.l99.${gid}`, JSON.stringify(arr));
      location.hash = "";
    }, id);
    await sleep(200);
    await page.goto(`${BASE}/#/game/${id}`, { waitUntil: "networkidle0" });
    await sleep(1000);

    // 「继续」按钮直达最远可玩关(第 99 关)
    const cont = await page.$(".l99-continue");
    let state = "no-continue";
    if (cont) {
      await cont.click().catch(() => {});
      await sleep(1400);
      state = await page.evaluate(() => {
        const s = document.querySelector(".l99-stage");
        if (!s) return "no-stage";
        return s.children.length > 0 ? "ok" : "empty";
      });
      const title = await page
        .$eval(".l99-stagetitle", (el) => el.textContent)
        .catch(() => "");
      if (!/99/.test(title ?? "")) state = `wrong-level(${title})`;
    }

    // 关卡里随手点几下
    const box = await page.evaluate(() => {
      const el = document.querySelector(".l99-stage");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    if (box && box.w > 10) {
      for (const [fx, fy] of [[0.3, 0.3], [0.7, 0.4], [0.5, 0.7], [0.2, 0.8]]) {
        await page.mouse.click(box.x + box.w * fx, box.y + box.h * fy).catch(() => {});
        await sleep(160);
      }
    }

    const bad = state !== "ok" || errors.length > 0;
    console.log(`${bad ? "✗" : "✓"} ${id} L99: ${state} errors=${errors.length}`);
    if (bad) failures.push({ id, state, errors: [...errors] });
  }

  await browser.close();

  if (failures.length) {
    console.log("\n===== 失败明细 =====");
    for (const f of failures) {
      console.log(`\n--- ${f.id} (${f.state})`);
      for (const e of f.errors) console.log("  " + e.slice(0, 500));
    }
    process.exit(1);
  }
  console.log("\n全部通过 ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
