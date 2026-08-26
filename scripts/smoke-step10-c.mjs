/**
 * 1.1 第 10 步 C 档的手动冒烟替身:用真浏览器把「星星射击场」和「飞机小队」
 * 各玩到**真实胜负**,并检查 375×667 与 1280×800 都不横向溢出。
 *
 * 跑法(playwright 是临时工具,没有进 package.json):
 *   npm i -D playwright --no-save && npx playwright install chromium --with-deps
 *   npx vite --port 5173
 *   node scripts/smoke-step10-c.mjs
 * 它必须连着源码跑(dev server),因为要 import 关卡模块反推靶子坐标再点真实画布。
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5173";
const VIEWPORTS = [
  { name: "375×667", width: 375, height: 667 },
  { name: "1280×800", width: 1280, height: 800 },
];

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

async function seedProgress(page, gameId, cleared) {
  await page.evaluate(
    ([id, n]) => {
      const stars = Array.from({ length: 188 }, (_, i) => (i < n ? 3 : 0));
      localStorage.setItem(`yiduo-yixing.l99.${id}`, JSON.stringify(stars));
    },
    [gameId, cleared]
  );
}

async function openLevel(page, gameId, level) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/${gameId}`, { waitUntil: "load" });
  await page.waitForSelector(".l99-grid", { timeout: 20000 });
  const tabs = page.locator(".l99-tab");
  for (let i = 0; i < (await tabs.count()); i++) {
    await tabs.nth(i).click({ force: true });
    await page.waitForTimeout(120);
    const node = page.locator(`.l99-node[aria-label^="第 ${level + 1} 关"]:not(.l99-node-lock)`);
    if ((await node.count()) > 0) {
      await node.first().click({ force: true });
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

async function waitOutcome(page, timeout = 120000) {
  await page.waitForSelector(".l99-ov-title", { timeout });
  return (await page.locator(".l99-ov-title").first().textContent())?.trim() ?? "";
}

async function checkNoOverflow(page, label) {
  const over = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  log(over.scroll <= over.client + 2, `${label} 无横向溢出`, `${over.scroll}/${over.client}`);
}

// --------------------------------------------------------------------------
// 星星射击场:import 关卡模块拿到靶心坐标,换算成画布上的点再真点一遍
// --------------------------------------------------------------------------

async function playShootRange(page, level) {
  await page.waitForSelector(".sr-cv", { timeout: 15000 });
  const plan = await page.evaluate(
    async ([lv]) => {
      const levels = await import("/src/games/shoot-range/levels.ts");
      const logic = await import("/src/games/shoot-range/logic.ts");
      const def = levels.buildLevel(lv);
      const cv = document.querySelector(".sr-cv");
      const rect = cv.getBoundingClientRect();
      const sx = rect.width / logic.FIELD_W;
      const offY = (rect.height - logic.FIELD_H * sx) / 2;
      return {
        need: def.need,
        budget: def.shotBudget,
        points: def.targets
          .filter((t) => t.kind !== "friend")
          .map((t) => ({
            x: rect.left + t.x * sx,
            y: rect.top + offY + t.y * sx,
          })),
      };
    },
    [level]
  );

  for (const p of plan.points) {
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(90);
    await page.mouse.click(p.x, p.y);
    // 弹匣打空要等换弹,慢一点反而更稳
    await page.waitForTimeout(320);
  }
  return plan;
}

// --------------------------------------------------------------------------
// 飞机小队:自动射击已经开着,脚本只负责左右扫场,把小飞机都拦下来
// --------------------------------------------------------------------------

async function playSkySquad(page, seconds = 40, useBombs = false) {
  await page.waitForSelector(".ss-cv", { timeout: 15000 });
  await page.locator(".ss-cv").click({ position: { x: 20, y: 20 }, force: true });
  const deadline = Date.now() + seconds * 1000;
  let dir = 0;
  while (Date.now() < deadline) {
    if (await page.locator(".l99-ov-title").count()) break;
    // 小幅左右摆:既能躲弹,又基本待在 Boss 底下保持火力
    const key = dir % 2 === 0 ? "ArrowRight" : "ArrowLeft";
    await page.keyboard.down(key);
    await page.waitForTimeout(240);
    await page.keyboard.up(key);
    await page.waitForTimeout(160);
    if (useBombs && dir % 14 === 13) await page.keyboard.press("KeyK");
    dir++;
  }
}

// --------------------------------------------------------------------------

async function run() {
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.width < 500,
    });
    const page = await ctx.newPage();
    page.on("pageerror", (err) => log(false, `${vp.name} 页面报错`, String(err)));

    // ---- 星星射击场:第 1 关(静止靶,能算出确定的靶心) ----
    await page.goto(`${BASE}/?t=${Date.now()}`, { waitUntil: "load" });
    await seedProgress(page, "shoot-range", 0);
    const opened = await openLevel(page, "shoot-range", 0);
    log(opened, `${vp.name} 星星射击场 第 1 关打得开`);
    if (opened) {
      const plan = await playShootRange(page, 0);
      const title = await waitOutcome(page, 60000);
      log(title.includes("过关"), `${vp.name} 星星射击场 打到真实胜负`, `${title} · ${plan.need} 个靶`);
      const sub = (await page.locator(".l99-ov-sub").first().textContent())?.trim() ?? "";
      log(/命中率\s*\d+%/.test(sub), `${vp.name} 星星射击场 结算带命中率评级`, sub);
      await checkNoOverflow(page, `${vp.name} 星星射击场`);
    }

    // ---- 星星射击场:后期关(移动靶 + 遮挡 + 好人靶),只要求走到胜负任一侧 ----
    await seedProgress(page, "shoot-range", 150);
    if (await openLevel(page, "shoot-range", 150)) {
      await playShootRange(page, 150);
      const title = await waitOutcome(page, 90000);
      log(title.length > 0, `${vp.name} 星星射击场 第 151 关走到结算`, title);
    }

    // ---- 星星射击场:双人分屏,两套键位互不抢占 ----
    await page.goto(`${BASE}/?t=${Date.now()}#/game/shoot-range`, { waitUntil: "load" });
    await page.waitForSelector(".sr-modebar", { timeout: 15000 });
    await page.locator(".sr-mode.sr-mode-duo").click();
    await page.waitForSelector(".sr-cv", { timeout: 15000 });
    // 每发之间要等过冷却,不然连点只会打出一发(那是冷却在起作用,不是键位冲突)
    const duo = await page.evaluate(async () => {
      const chips = () => [...document.querySelectorAll(".sr-chip-duo, .sr-chip-star")].map((n) => n.textContent);
      const fire = async (code, times) => {
        for (let i = 0; i < times; i++) {
          window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
          window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
          await new Promise((r) => setTimeout(r, 260));
        }
      };
      await fire("KeyF", 3);
      const afterDuo = chips();
      await fire("KeyL", 2);
      return { afterDuo, afterStar: chips() };
    });
    const shotsOf = (text) => Number(/命中 \d+\/(\d+)/.exec(text ?? "")?.[1] ?? -1);
    // 朵朵按 F 时星星一发不动;星星按 L 时朵朵的发数原地不变
    const okDuo =
      shotsOf(duo.afterDuo[0]) === 3 &&
      shotsOf(duo.afterDuo[1]) === 0 &&
      shotsOf(duo.afterStar[0]) === 3 &&
      shotsOf(duo.afterStar[1]) === 2;
    log(okDuo, `${vp.name} 星星射击场 双人两套键位互不抢占`, [...duo.afterDuo, "→", ...duo.afterStar].join(" | "));
    await checkNoOverflow(page, `${vp.name} 星星射击场双人`);

    // ---- 飞机小队:第 1 关 ----
    await page.goto(`${BASE}/?t=${Date.now()}`, { waitUntil: "load" });
    await seedProgress(page, "sky-squad", 0);
    const skyOpen = await openLevel(page, "sky-squad", 0);
    log(skyOpen, `${vp.name} 飞机小队 第 1 关打得开`);
    if (skyOpen) {
      await playSkySquad(page, 45);
      const title = await waitOutcome(page, 30000);
      log(title.includes("过关"), `${vp.name} 飞机小队 打到真实胜负`, title);
      await checkNoOverflow(page, `${vp.name} 飞机小队`);
    }

    // ---- 飞机小队:第 24 关是第一章 Boss,验证三阶段真的会切 ----
    await seedProgress(page, "sky-squad", 23);
    if (await openLevel(page, "sky-squad", 23)) {
      await page.waitForSelector(".ss-chip-boss", { timeout: 30000 });
      const seenPhases = new Set();
      const watch = setInterval(async () => {
        const t = await page.evaluate(() => document.querySelector(".ss-chip-boss")?.textContent ?? "").catch(() => "");
        const m = /·\s*(.+)$/.exec(t ?? "");
        if (m) seenPhases.add(m[1].trim());
      }, 400);
      await playSkySquad(page, 130, true);
      clearInterval(watch);
      const title = await waitOutcome(page, 60000);
      log(title.includes("过关"), `${vp.name} 飞机小队 Boss 关打到真实胜负`, title);
      log(seenPhases.size >= 3, `${vp.name} 飞机小队 Boss 三阶段都切到了`, [...seenPhases].join(" → "));
    }

    // ---- 飞机小队:双人合作同屏两机 ----
    await page.goto(`${BASE}/?t=${Date.now()}#/game/sky-squad`, { waitUntil: "load" });
    await page.waitForSelector(".ss-modebar", { timeout: 15000 });
    await page.locator(".ss-mode.ss-mode-duo").click();
    await page.waitForSelector(".ss-cv", { timeout: 15000 });
    const coop = await page.evaluate(async () => {
      const hold = async (code, ms) => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
        await new Promise((r) => setTimeout(r, ms));
        window.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
      };
      await hold("KeyA", 500);
      await hold("ArrowRight", 500);
      return [...document.querySelectorAll(".ss-chip-duo, .ss-chip-star")].map((n) => n.textContent);
    });
    log(coop.length === 2 && coop.every((t) => (t ?? "").length > 4), `${vp.name} 飞机小队 双人同屏两套装备栏`, coop.join(" | "));
    await checkNoOverflow(page, `${vp.name} 飞机小队双人`);

    await ctx.close();
  }
  await browser.close();

  const bad = results.filter((r) => !r.ok);
  console.log(`\n共 ${results.length} 项,失败 ${bad.length} 项`);
  if (bad.length) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
