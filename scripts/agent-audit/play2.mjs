// 阶段3:画布五款进关 + 双人模式竖屏可用性
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const FLOWS = {
  "garden-guard":   [{ tap: [195, 390] }, { tap: [116, 216], shot: "map" }, { tap: [62, 192], shot: "level" }],
  "ocean-munch":    [{ tap: [195, 222] }, { tap: [116, 240], shot: "map" }, { tap: [62, 192], shot: "level" }],
  "sprout-defense": [{ tap: [116, 216], shot: "map" }, { tap: [62, 192], shot: "level" }],
  "rainbow-run":    [{ tap: [116, 261], shot: "map" }, { tap: [62, 192], shot: "level" }],
  "fruit-slice":    [{ tap: [195, 330] }, { tap: [116, 214], shot: "map" }, { tap: [62, 192], shot: "level" }],
  "gold-hook":      [{ dom: "闯关矿洞", shot: "map" }, { sel: ".l99-continue", shot: "level" }],
  "brave-path":     [{ dom: "闯关", shot: "map" }, { sel: ".l99-continue", shot: "level" }],
  "bomb-buddies-2p":   { game: "bomb-buddies", steps: [{ dom: "双人对战", shot: "2p" }] },
  "tank-battle-2p":    { game: "tank-battle", steps: [{ dom: "双人对战", shot: "2p" }] },
  "dot-maze-2p":       { game: "dot-maze", steps: [{ dom: "双人追逃", shot: "2p" }] },
  "orb-arena-2p":      { game: "orb-arena", steps: [{ dom: "双人同屏", shot: "2p" }] },
  "snake-royale-2p":   { game: "snake-royale", steps: [{ dom: "双人同屏", shot: "2p" }] },
  "prince-princess-2p":{ game: "prince-princess", steps: [{ dom: "两人一起", shot: "2p" }] },
  "poop-hero-2p":      { game: "poop-hero", steps: [{ dom: "双人合作", shot: "2p" }] },
  "sky-squad-2p":      { game: "sky-squad", steps: [{ dom: "双人合作", shot: "2p" }] },
  "monster-crisis-arena": { game: "monster-crisis", steps: [{ dom: "怪兽擂台", shot: "2p" }] },
  "ocean-munch-vs":    { game: "ocean-munch", steps: [{ tap: [195, 430], shot: "2p" }] },
};

const only = process.argv[2] ? process.argv[2].split(",") : Object.keys(FLOWS);
const OUT = "/tmp/shots/play2";
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
for (const key of only) {
  const flow = FLOWS[key];
  const game = flow.game || key;
  const steps = flow.steps || flow;
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
  const entry = { key, errors, steps: [] };
  try {
    await page.goto(`http://127.0.0.1:5173/#/game/${game}`, { waitUntil: "networkidle2", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 2600));
    for (const [i, step] of steps.entries()) {
      let ok = false;
      if (step.dom) ok = await clickByText(page, step.dom);
      else if (step.sel) ok = await page.evaluate((s) => { const el = document.querySelector(s); if (el) { el.click(); return true; } return false; }, step.sel);
      else if (step.tap) { await page.touchscreen.tap(step.tap[0], step.tap[1]); ok = true; }
      entry.steps.push({ i, ok });
      await new Promise((r) => setTimeout(r, 1500));
      if (step.shot) await page.screenshot({ path: `${OUT}/${key}-${step.shot}.png` });
    }
  } catch (e) {
    entry.fatal = String(e).slice(0, 150);
  }
  report.push(entry);
  await page.close();
  process.stderr.write(`${key} done\n`);
}
await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log("done");
