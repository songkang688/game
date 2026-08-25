/**
 * 无头冒烟测试:存档损坏自愈验证。
 * 把全部已知存档 key(平台 save.v1 / recent / l99.* / 各游戏独立战役档)依次注入
 * 六类坏数据(非法 JSON、错误类型、越界数值…),然后加载首页 + 有独立存档的 12 款游戏
 * + 家长门导出,断言舞台正常挂载、零 pageerror / console.error——
 * 读到坏档必须静默回退新档,绝不能崩溃或白屏。
 * 与 smoke-games(全量挂载)/smoke-l99-deep(l99 深关)/smoke-campaign-deep(战役深关)互补,
 * 专门守「存档损坏」这一类线上最难排查的崩溃口。
 * 用法:npm i --no-save puppeteer-core(本机需有 Chrome),
 *      npm run build && npx vite preview --port 4173,再 node scripts/smoke-save-corrupt.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

/** 全部已知存档 key(新增游戏存档时在这里补一行) */
const KEYS = [
  "yiduo-yixing.save.v1",
  "yiduo-yixing.recent.v1",
  "yiduo-yixing.l99.math-farm",
  "yiduo-yixing.l99.mole-pop",
  "yiduo-yixing.l99.word-garden",
  "yiduo-yixing.sprout-defense.campaign.v2",
  "yiduo-yixing.sling-birds.v2",
  "yiduo.gomoku.campaign.v2",
  "yiduo-yixing.garden-guard.campaign.v2",
  "yiduo-yixing.ocean-munch.dex.v1",
  "yiduo-yixing.ocean-munch.campaign.v2",
  "yiduo-yixing.fruit-slice.campaign.v2",
  "yiduo-yixing.fruit-slice.best.v1",
  "yiduo-yixing.rainbow-run.campaign.v2",
  "yiduo-yixing.rainbow-run.endless-best.v1",
  "yiduo.bubble-aim.campaign.v2",
  "yiduo.candy-swing.campaign.v2"
];

/** 六类坏数据:覆盖 JSON.parse 抛错、类型不对、字段缺失、数值越界 */
const PAYLOADS = [
  ["invalid-json", "{oops"],
  ["number", "12345"],
  ["string", '"hello"'],
  ["bad-stars-obj", '{"stars":"bad"}'],
  ["mixed-array", '[null,{"a":1},"x",-99,1e999]'],
  ["out-of-range", '{"stars":[999,-5,"x",null],"resume":"z","chapter":-3}']
];

/** 有独立存档读写路径的游戏(l99 代表 3 款 + 战役 9 款) */
const GAME_IDS = [
  "math-farm", "mole-pop", "word-garden",
  "garden-guard", "sprout-defense", "rainbow-run", "fruit-slice", "ocean-munch",
  "gomoku", "candy-swing", "bubble-aim", "sling-birds"
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  await page.goto(BASE, { waitUntil: "networkidle0" });

  for (const [name, payload] of PAYLOADS) {
    await page.evaluate((keys, val) => {
      localStorage.clear();
      for (const k of keys) localStorage.setItem(k, val);
    }, KEYS, payload);

    // 首页:坏档在场也要正常渲染全部卡片(星星余额/最近玩过/通关数都读档)
    errors = [];
    await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
    await sleep(700);
    const cards = await page.$$eval(".game-card", (els) => els.length).catch(() => 0);
    if (cards < 30 || errors.length) {
      failures.push({ payload: name, id: "(home)", errors: [...errors, `卡片数=${cards}`] });
      console.log(`✗ [${name}] home: cards=${cards} errors=${errors.length}`);
    } else {
      console.log(`✓ [${name}] home: cards=${cards} errors=0`);
    }

    // 逐款游戏:挂载即读档,读到坏档必须静默回退新档
    for (const id of GAME_IDS) {
      errors = [];
      await page.goto(`${BASE}/#/game/${id}`, { waitUntil: "networkidle0" });
      await sleep(900);
      const state = await stageState(page);
      const bad = state !== "ok" || errors.length > 0;
      if (bad) {
        failures.push({ payload: name, id, state, errors: [...errors] });
        console.log(`✗ [${name}] ${id}: stage=${state} errors=${errors.length}`);
      }
      await page.evaluate(() => { location.hash = ""; });
      await sleep(250);
    }
    console.log(`  [${name}] ${GAME_IDS.length} 款游戏读坏档挂载完成`);

    // 家长门导出:坏档在场时导出也不该崩(导出会遍历全部自家 key)
    errors = [];
    await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
    await sleep(400);
    const gateBtn = await page.$('button[aria-label="家长说明"]');
    if (gateBtn) {
      await gateBtn.click();
      await sleep(350);
      const q = await page.$eval(".gate-question", (el) => el.textContent).catch(() => null);
      const m = q && q.match(/(\d+)\s*×\s*(\d+)/);
      if (m) {
        await page.type(".gate-input", String(Number(m[1]) * Number(m[2])));
        const ok = (await page.evaluateHandle(() => {
          return [...document.querySelectorAll(".overlay button")].find((b) => b.textContent.includes("确认")) ?? null;
        })).asElement();
        if (ok) {
          await ok.click();
          await sleep(400);
          const exportBtn = (await page.evaluateHandle(() => {
            return [...document.querySelectorAll(".overlay button")].find((b) => b.textContent.includes("导出")) ?? null;
          })).asElement();
          if (exportBtn) { await exportBtn.click(); await sleep(500); }
        }
      }
      await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
    }
    if (errors.length) {
      failures.push({ payload: name, id: "(parent-export)", errors: [...errors] });
      console.log(`✗ [${name}] parent-export errors=${errors.length}`);
    }
  }

  await browser.close();

  if (failures.length) {
    console.log("\n===== 失败明细 =====");
    for (const f of failures) {
      console.log(`\n--- [${f.payload}] ${f.id} (state=${f.state ?? ""})`);
      for (const e of f.errors) console.log("  " + e.slice(0, 400));
    }
    process.exit(1);
  }
  console.log("\n存档损坏自愈冒烟全部通过 ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
