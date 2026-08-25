/**
 * 无头冒烟测试:逐款打开 34 个游戏,收集 pageerror / console.error,
 * 检查游戏舞台是否真的挂载出内容(没有白屏/错误态)。
 * - l99 框架类游戏点进第 1 关,真正跑一次关卡挂载;
 * - canvas 战役类游戏做网格猴子点击(主题→地图→关卡的指针命中路径都会被踩到);
 * - 每款游戏离开后再重进一次,检验 destroy 清理没有崩;
 * - 最后走一遍家长门(解乘法题→面板→导出进度)。
 * 用法:npm i --no-save puppeteer-core(本机需有 Chrome),
 *      npm run build && npx vite preview --port 4173,再 node scripts/smoke-games.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

const GAME_IDS = [
  "balloon-pop", "brick-break", "bubble-aim", "bubble-pop", "candy-swing",
  "clock-house", "color-fun", "duo-arena", "duo-rush", "find-diff",
  "fruit-catch", "fruit-slice", "garden-guard", "gomoku", "kitty-care",
  "lianliankan", "match-stars", "math-farm", "memory-cards", "mole-pop",
  "music-stars", "ocean-munch", "pinyin-train", "puzzle-tiles", "rainbow-run",
  "red-blue-race", "red-blue-tap", "red-blue-tug", "shape-kingdom", "sling-birds",
  "snake-snack", "sprout-defense", "word-garden", "xiangqi"
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 舞台范围内 4x3 网格猴子点击;弹窗出现就点主按钮(再玩一次) */
async function monkeyClicks(page) {
  const box = await page.evaluate(() => {
    const el = document.querySelector(".game-stage");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  if (!box || box.w < 10 || box.h < 10) return;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const dialogBtn = await page.$(".overlay .btn--primary");
      if (dialogBtn) {
        await dialogBtn.click().catch(() => {});
        await sleep(400);
        continue;
      }
      const x = box.x + box.w * (0.15 + 0.7 * (col / 3));
      const y = box.y + box.h * (0.15 + 0.7 * (row / 2));
      await page.mouse.click(x, y).catch(() => {});
      await sleep(140);
    }
  }
  const dialogBtn = await page.$(".overlay .btn--primary");
  if (dialogBtn) await dialogBtn.click().catch(() => {});
}

async function stageState(page) {
  return page.evaluate(() => {
    const stage = document.querySelector(".game-stage");
    if (!stage) return "no-stage";
    if (stage.querySelector(".empty-state")) return "error-state";
    if (stage.querySelector(".game-loading")) return "still-loading";
    return stage.children.length > 0 ? "ok" : "empty";
  });
}

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

  // ---- 首页 ----
  errors = [];
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await sleep(600);
  const homeCards = await page.$$eval(".game-card", (els) => els.length).catch(() => 0);
  if (homeCards < 30 || errors.length) {
    failures.push({ id: "(home)", errors: [...errors, `卡片数=${homeCards}`] });
  }
  console.log(`home: ${homeCards} 张卡片, ${errors.length} 个错误`);

  // ---- 逐款游戏 ----
  for (const id of GAME_IDS) {
    errors = [];
    await page.goto(`${BASE}/#/game/${id}`, { waitUntil: "networkidle0" });
    await sleep(1100);
    const state = await stageState(page);

    // l99 类:点「第 1 关」进入真实关卡
    let levelState = "-";
    const node = await page.$(".l99-node:not(.l99-node-lock)");
    if (node) {
      await node.click().catch(() => {});
      await sleep(1200);
      levelState = await page.evaluate(() => {
        const s = document.querySelector(".l99-stage");
        return s && s.children.length > 0 ? "ok" : "empty";
      });
    }

    // 猴子点击(canvas 战役类会踩到主题选择/选关/战斗;DOM 类会踩到按钮)
    await monkeyClicks(page);
    await sleep(400);

    // 离开→重进,检验 destroy 清理
    await page.evaluate(() => { location.hash = ""; });
    await sleep(500);
    await page.evaluate((gid) => { location.hash = `#/game/${gid}`; }, id);
    await sleep(1100);
    const reState = await stageState(page);
    await monkeyClicks(page);
    await sleep(300);

    const bad =
      state !== "ok" ||
      reState !== "ok" ||
      (levelState !== "-" && levelState !== "ok") ||
      errors.length > 0;
    console.log(
      `${bad ? "✗" : "✓"} ${id}: stage=${state} level=${levelState} re=${reState} errors=${errors.length}`
    );
    if (bad) failures.push({ id, state, levelState, reState, errors: [...errors] });
  }

  // ---- 家长门:解乘法题→面板→导出 ----
  errors = [];
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await sleep(500);
  const gateOk = await (async () => {
    const btn = await page.$('button[aria-label="家长说明"]');
    if (!btn) return "no-entry";
    await btn.click();
    await sleep(400);
    const q = await page.$eval(".gate-question", (el) => el.textContent).catch(() => null);
    const m = q && q.match(/(\d+)\s*×\s*(\d+)/);
    if (!m) return "no-question";
    await page.type(".gate-input", String(Number(m[1]) * Number(m[2])));
    const ok = (await page.evaluateHandle(() => {
      return [...document.querySelectorAll(".overlay button")].find((b) => b.textContent.includes("确认")) ?? null;
    })).asElement();
    if (!ok) return "no-confirm";
    await ok.click();
    await sleep(500);
    const hasPanel = await page.$(".parent-content");
    if (!hasPanel) return "no-panel";
    const exportBtn = (await page.evaluateHandle(() => {
      return [...document.querySelectorAll(".overlay button")].find((b) => b.textContent.includes("导出")) ?? null;
    })).asElement();
    if (exportBtn) {
      await exportBtn.click();
      await sleep(600);
    }
    return "ok";
  })().catch((e) => `throw:${e.message}`);
  console.log(`parent-gate: ${gateOk}, ${errors.length} 个错误`);
  if (gateOk !== "ok" || errors.length) {
    failures.push({ id: "(parent-gate)", state: gateOk, errors: [...errors] });
  }

  await browser.close();

  if (failures.length) {
    console.log("\n===== 失败明细 =====");
    for (const f of failures) {
      console.log(`\n--- ${f.id} (stage=${f.state ?? ""} level=${f.levelState ?? ""} re=${f.reState ?? ""})`);
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
