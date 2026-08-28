// 阶段2:进第一关 → 截图玩法 → 暂停/恢复 → 指标收集
import puppeteer from "puppeteer-core";
import fs from "node:fs";

// 每款游戏进入第一关的步骤:dom=按文本找按钮点击;sel=按选择器点;tap=画布坐标(手机版390x844);
// pad 坐标用 padTap(没给就按比例缩放 x)
const FLOWS = {
  "garden-guard":   [{ tap: [195, 390], padTap: [512, 355] }, { tap: [140, 300], padTap: [360, 300], wait: 1500 }],
  "ocean-munch":    [{ tap: [195, 222], padTap: [512, 240] }, { tap: [120, 320], padTap: [340, 330], wait: 1500 }],
  "sprout-defense": [{ dom: "第1章" }, { tap: [80, 320], padTap: [240, 330], wait: 1500 }],
  "rainbow-run":    [{ dom: "第1章" }, { tap: [80, 320], padTap: [240, 330], wait: 1500 }],
  "fruit-slice":    [{ tap: [195, 330], padTap: [512, 300] }, { tap: [90, 350], padTap: [300, 330], wait: 1500 }],
  "candy-swing":    [{ dom: "1" }],
  "sling-birds":    [{ dom: "1" }],
  "gold-hook":      [{ sel: ".l99-continue" }],
  "poop-hero":      [{ sel: ".l99-continue" }],
  "brave-path":     [{ sel: ".l99-continue" }],
  "adventure-king": [{ sel: ".l99-continue" }],
  "ice-fire-forest":[{ sel: ".l99-continue" }],
  "prince-princess":[{ sel: ".l99-continue" }],
  "box-hamster":    [{ sel: ".l99-continue" }],
  "monster-crisis": [{ sel: ".l99-continue" }],
  "bomb-buddies":   [{ sel: ".l99-continue" }],
  "tank-battle":    [{ sel: ".l99-continue" }],
  "sky-squad":      [{ sel: ".l99-continue" }],
  "dot-maze":       [{ dom: "闯关 188" }, { sel: ".l99-continue" }],
  "orb-arena":      [{ sel: ".l99-continue" }],
  "snake-royale":   [{ sel: ".l99-continue" }],
  "math-farm":      [{ sel: ".l99-continue" }],
  "word-garden":    [{ sel: ".l99-continue" }],
  "pinyin-train":   [{ sel: ".l99-continue" }],
  "shape-kingdom":  [{ sel: ".l99-continue" }],
  "find-diff":      [{ sel: ".l99-continue" }],
  "clock-house":    [{ sel: ".l99-continue" }],
  "sudoku-petal":   [{ sel: ".l99-continue" }],
};

const only = process.argv[2] ? process.argv[2].split(",") : Object.keys(FLOWS);
const VIEWPORTS = [
  { name: "phone", width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: "pad", width: 1024, height: 768, isMobile: false, hasTouch: true },
];
const OUT = "/tmp/shots/play";
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
});

async function clickByText(page, text) {
  return page.evaluate((t) => {
    const els = [...document.querySelectorAll(".game-stage button, .game-stage [role=button]")];
    const el = els.find((e) => (e.textContent || "").replace(/\s+/g, " ").includes(t) && !e.disabled);
    if (el) { el.click(); return true; }
    return false;
  }, text);
}

const report = [];
for (const game of only) {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    const entry = { game, vp: vp.name, errors, steps: [] };
    try {
      await page.goto(`http://127.0.0.1:5173/#/game/${game}`, { waitUntil: "networkidle2", timeout: 20000 });
      await new Promise((r) => setTimeout(r, 2600));
      for (const [i, step] of (FLOWS[game] || []).entries()) {
        let ok = false;
        if (step.dom) ok = await clickByText(page, step.dom);
        else if (step.sel) ok = await page.evaluate((s) => { const el = document.querySelector(s); if (el) { el.click(); return true; } return false; }, step.sel);
        else if (step.tap) {
          const [x, y] = vp.name === "pad" && step.padTap ? step.padTap : step.tap;
          await page.touchscreen.tap(x, y);
          ok = true;
        }
        entry.steps.push({ i, ok });
        await new Promise((r) => setTimeout(r, step.wait ?? 1000));
      }
      await new Promise((r) => setTimeout(r, 2000));
      await page.screenshot({ path: `${OUT}/${game}-${vp.name}-play.png` });
      entry.metrics = await page.evaluate(() => {
        const stage = document.querySelector(".game-stage");
        const overflowers = [];
        for (const el of stage?.querySelectorAll("*") || []) {
          const r = el.getBoundingClientRect();
          if (r.width > 2 && (r.right > window.innerWidth + 3 || r.left < -3)) {
            const cls = (el.className && String(el.className).slice(0, 50)) || el.tagName;
            if (overflowers.length < 5) overflowers.push(`${cls} L${Math.round(r.left)} R${Math.round(r.right)}`);
          }
        }
        return {
          stageScrollH: stage?.scrollHeight, stageClientH: stage?.clientHeight,
          overflowers,
          text: (stage?.textContent || "").replace(/\s+/g, " ").slice(0, 60),
        };
      });
      // 暂停 → 继续
      await page.evaluate(() => document.querySelector(".icon-btn--pause")?.click());
      await new Promise((r) => setTimeout(r, 700));
      entry.pauseShown = await page.evaluate(() => !!document.querySelector(".dialog--pause"));
      if (entry.pauseShown && vp.name === "phone") await page.screenshot({ path: `${OUT}/${game}-${vp.name}-pause.png` });
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll(".dialog--pause button")];
        btns.find((b) => (b.textContent || "").includes("继续"))?.click();
      });
      await new Promise((r) => setTimeout(r, 500));
      entry.resumed = await page.evaluate(() => !document.querySelector(".dialog--pause"));
    } catch (e) {
      entry.fatal = String(e).slice(0, 150);
    }
    report.push(entry);
    await page.close();
  }
  process.stderr.write(`${game} done\n`);
}
await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log("play audit complete");
