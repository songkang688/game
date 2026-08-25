/**
 * 战役深关冒烟:9 款自有战役 UI 的游戏(动作 5 款 + 经典 4 款),
 * 把各自私有存档种到「前 98 关全通、只剩最后一关」,再进游戏:
 *  - 经典 4 款(糖果秋千/泡泡瞄准手/五子棋棋谜/弹弹小鸟)按 DOM 点进最深一关,真正挂载最深关卡;
 *  - 动作 5 款(花园守卫/绿芽保卫战/彩虹跑跑/水果切切乐/海底大胃王)是全 canvas,
 *    深进度下主题图/选关图全解锁渲染 + 网格盲点(会踩到主题→地图→关卡的指针路径);
 * 全程收集 pageerror / console.error,有一条就算失败。
 * 与 smoke-l99-deep.mjs 互补:那边管 22 款 l99 框架,这边管 12 款自有 UI 里有存档的 9 款。
 * 用法:npm i --no-save puppeteer-core(本机需有 Chrome),
 *      npm run build && npx vite preview --port 4173,再 node scripts/smoke-campaign-deep.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 前 98 关 3 星、最后一关未通的数组 */
const deepArray = () => Array.from({ length: 99 }, (_, i) => (i < 98 ? 3 : 0));

/**
 * 每款:id + 种存档(在 about:blank 同源页面里执行)+ 深关进入方式。
 * enter: "dom" 用选关按钮点最深一关;"monkey" 只做盲点(canvas 主题图)。
 */
const GAMES = [
  // ---- 动作 5 款:campaign.v2 = 每关星级数组 ----
  ...["garden-guard", "sprout-defense", "rainbow-run", "fruit-slice", "ocean-munch"].map(
    (id) => ({
      id,
      seed: { [`yiduo-yixing.${id}.campaign.v2`]: JSON.stringify(deepArray()) },
      enter: "monkey"
    })
  ),
  // ---- 经典 4 款:各自私有格式,DOM 可精确点进最深关 ----
  {
    id: "candy-swing",
    seed: { "yiduo.candy-swing.campaign.v2": JSON.stringify({ stars: deepArray() }) },
    enter: "dom",
    nodeSel: ".cs-lv:not(.locked)",
    levelBadge: ".cs-level"
  },
  {
    id: "bubble-aim",
    seed: { "yiduo.bubble-aim.campaign.v2": JSON.stringify({ stars: deepArray() }) },
    enter: "dom",
    nodeSel: ".ba-lv:not(.locked)",
    levelBadge: ".ba-level"
  },
  {
    id: "gomoku",
    seed: { "yiduo.gomoku.campaign.v2": JSON.stringify({ stars: deepArray() }) },
    enter: "dom",
    preClick: '.gm-kind button[data-v="puzzle"]',
    nodeSel: ".gm-pz:not(.locked)"
  },
  {
    id: "sling-birds",
    seed: {
      "yiduo-yixing.sling-birds.v2": JSON.stringify({
        stars: Object.fromEntries(Array.from({ length: 98 }, (_, i) => [String(i + 1), 3])),
        resume: null,
        chapter: 0
      })
    },
    enter: "dom",
    nodeSel: ".slb-cell:not(.slb-lock)",
    tabSel: ".slb-tab"
  }
];

/** 舞台内 4x3 网格盲点;弹窗出现就点主按钮 */
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
        await sleep(300);
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

  for (const g of GAMES) {
    errors = [];
    await page.evaluate((seed) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      location.hash = "";
    }, g.seed);
    await sleep(200);
    await page.goto(`${BASE}/#/game/${g.id}`, { waitUntil: "networkidle0" });
    await sleep(1200);

    let state = "ok";
    const mountedOk = await page.evaluate(() => {
      const stage = document.querySelector(".game-stage");
      if (!stage) return false;
      if (stage.querySelector(".empty-state") || stage.querySelector(".game-loading")) return false;
      return stage.children.length > 0;
    });
    if (!mountedOk) state = "mount-failed";

    if (state === "ok" && g.enter === "dom") {
      if (g.preClick) {
        await page.click(g.preClick).catch(() => (state = "no-preclick"));
        await sleep(500);
      }
      if (g.tabSel) {
        // 点到最后一个未禁用的章节页签(最深章)
        const clickedTab = await page.evaluate((sel) => {
          const tabs = [...document.querySelectorAll(sel)].filter((t) => !t.disabled);
          if (!tabs.length) return false;
          tabs[tabs.length - 1].click();
          return true;
        }, g.tabSel);
        if (!clickedTab) state = "no-tabs";
        await sleep(500);
      }
      if (state === "ok") {
        const clicked = await page.evaluate((sel) => {
          const nodes = [...document.querySelectorAll(sel)];
          if (!nodes.length) return 0;
          nodes[nodes.length - 1].click();
          return nodes.length;
        }, g.nodeSel);
        if (!clicked) state = "no-level-node";
        await sleep(1400);
        if (state === "ok" && g.levelBadge) {
          const badge = await page
            .$eval(g.levelBadge, (el) => el.textContent ?? "")
            .catch(() => "");
          if (!/99/.test(badge)) state = `wrong-level(${badge})`;
        }
      }
    }

    // 深进度地图 / 最深关里都盲点一轮
    await monkeyClicks(page);

    const bad = state !== "ok" || errors.length > 0;
    console.log(`${bad ? "✗" : "✓"} ${g.id} deep: ${state} errors=${errors.length}`);
    if (bad) failures.push({ id: g.id, state, errors: [...errors] });
  }

  // 收尾把种进去的深存档清掉,避免影响后续脚本
  await page.evaluate(() => localStorage.clear()).catch(() => {});
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
