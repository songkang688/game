// 修后回归:地图排布 / HUD 换行 / 进关收条 / 双人触控 / root 全开
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const OUT = "/tmp/shots/verify";
fs.mkdirSync(OUT, { recursive: true });

const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true };
const PAD = { width: 1024, height: 768, isMobile: true, hasTouch: true };

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
});

const report = [];

async function openGame(page, game, { root = false } = {}) {
  await page.goto(`http://127.0.0.1:5173/#/game/${game}`, { waitUntil: "networkidle2", timeout: 20000 });
  if (root) {
    await page.evaluate(() => {
      localStorage.setItem("yiduo-yixing.root.v1", JSON.stringify({ expiresAt: Date.now() + 3600_000 }));
    });
    await page.reload({ waitUntil: "networkidle2" });
  }
  await new Promise((r) => setTimeout(r, 2500));
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function clickText(page, text) {
  return page.evaluate((t) => {
    const els = [...document.querySelectorAll(".game-stage button, .game-stage [role=button]")];
    const el = els.find((e) => (e.textContent || "").replace(/\s+/g, " ").includes(t) && !e.disabled);
    if (el) { el.click(); return true; }
    return false;
  }, text);
}

async function run(name, viewport, fn) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const entry = { name, errors };
  try {
    await fn(page, entry);
  } catch (e) {
    entry.fatal = String(e).slice(0, 200);
  }
  report.push(entry);
  await page.close();
  process.stderr.write(`${name} done\n`);
}

// ---- 1) 五款画布游戏:地图排布(手机),其中两款加平板 ----
const CANVAS_FLOW = {
  "garden-guard": [[195, 390]],
  "ocean-munch": [[195, 222]],
  "sprout-defense": [],
  "rainbow-run": [],
  "fruit-slice": [[195, 330]],
};
for (const [game, pre] of Object.entries(CANVAS_FLOW)) {
  await run(`${game}-phone-map`, PHONE, async (page) => {
    await openGame(page, game);
    await shot(page, `${game}-phone-home`);
    for (const [x, y] of pre) {
      await page.touchscreen.tap(x, y);
      await new Promise((r) => setTimeout(r, 1200));
    }
    // 进第一章(左上角卡)看地图行距
    await page.touchscreen.tap(110, 215);
    await new Promise((r) => setTimeout(r, 1200));
    await shot(page, `${game}-phone-map`);
  });
}
await run("garden-guard-pad-map", PAD, async (page) => {
  await openGame(page, "garden-guard");
  await shot(page, "garden-guard-pad-home");
});

// ---- 2) root(kangkang) 全开:garden-guard 章节卡全解锁 ----
await run("garden-guard-root", PHONE, async (page, entry) => {
  await openGame(page, "garden-guard", { root: true });
  await page.touchscreen.tap(195, 390);
  await new Promise((r) => setTimeout(r, 1200));
  await shot(page, "garden-guard-root-themes");
  // 点最后一章(底部)应能进地图而不是弹"通关上一章解锁"
  await page.evaluate(() => {
    const st = document.querySelector(".game-stage");
    if (st) st.scrollTop = st.scrollHeight;
  });
  entry.note = "看截图:锁图标应消失/所有章节可点";
});
await run("fruit-slice-root", PHONE, async (page) => {
  await openGame(page, "fruit-slice", { root: true });
  await page.touchscreen.tap(195, 330);
  await new Promise((r) => setTimeout(r, 1200));
  await shot(page, "fruit-slice-root-themes");
});

// ---- 3) sky-squad:手机 HUD 换行 ----
await run("sky-squad-phone", PHONE, async (page) => {
  await openGame(page, "sky-squad");
  await shot(page, "sky-squad-phone-home");
  await clickText(page, "第");
});

// ---- 4) snake-royale / orb-arena:进关收模式条 ----
for (const game of ["snake-royale", "orb-arena"]) {
  await run(`${game}-enter`, PHONE, async (page, entry) => {
    await openGame(page, game);
    const ok = await page.evaluate(() => {
      const node = document.querySelector(".l99-node:not(.l99-node-lock)");
      if (node) { node.click(); return true; }
      return false;
    });
    entry.clickedNode = ok;
    await new Promise((r) => setTimeout(r, 1800));
    entry.barHidden = await page.evaluate((cls) => {
      const bar = document.querySelector(cls);
      return bar ? bar.hidden : "missing";
    }, game === "snake-royale" ? ".sr-modebar" : ".oa-modebar");
    await shot(page, `${game}-enter-level`);
    // 回选关,模式条要回来
    await page.evaluate(() => document.querySelector(".l99-back")?.click());
    await new Promise((r) => setTimeout(r, 1000));
    entry.barRestored = await page.evaluate((cls) => {
      const bar = document.querySelector(cls);
      return bar ? !bar.hidden : "missing";
    }, game === "snake-royale" ? ".sr-modebar" : ".oa-modebar");
  });
}

// ---- 5) candy-swing:平板放宽 + 进关回窄 ----
await run("candy-swing-pad", PAD, async (page, entry) => {
  await openGame(page, "candy-swing");
  entry.mapWidth = await page.evaluate(() => document.querySelector(".cs-wrap")?.getBoundingClientRect().width);
  await shot(page, "candy-swing-pad-map");
  const ok = await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".cs-lv:not(.locked)")][0];
    if (btn) { btn.click(); return true; }
    return false;
  });
  entry.enteredLevel = ok;
  await new Promise((r) => setTimeout(r, 1200));
  entry.gameWidth = await page.evaluate(() => document.querySelector(".cs-wrap")?.getBoundingClientRect().width);
  await shot(page, "candy-swing-pad-level");
});

// ---- 6) dot-maze:双人追逃两套触控键盘 ----
await run("dot-maze-2p", PHONE, async (page, entry) => {
  await openGame(page, "dot-maze");
  await clickText(page, "双人追逃");
  await new Promise((r) => setTimeout(r, 1800));
  entry.starKeys = await page.evaluate(() => document.querySelectorAll(".dmz-key[data-star-dir]").length);
  entry.duoKeys = await page.evaluate(() => document.querySelectorAll(".dmz-key[data-dir]").length);
  await shot(page, "dot-maze-2p-pads");
  // 点星星的右键,不该报错
  await page.evaluate(() => document.querySelector('.dmz-key[data-star-dir="right"]')?.click());
  await new Promise((r) => setTimeout(r, 800));
});

await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
