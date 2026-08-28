// 云端子代理布局审计脚本(不进入构建,仅本地使用)
// 用系统 Chrome 打开每款游戏,两种视口截图 + 收集布局指标与控制台报错。
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const GAMES = process.argv[2]
  ? process.argv[2].split(",")
  : [
      "garden-guard", "ocean-munch", "sprout-defense", "rainbow-run", "fruit-slice",
      "candy-swing", "sling-birds", "gold-hook", "poop-hero", "brave-path",
      "adventure-king", "ice-fire-forest", "prince-princess", "box-hamster",
      "monster-crisis", "bomb-buddies", "tank-battle", "sky-squad", "dot-maze",
      "orb-arena", "snake-royale",
      "math-farm", "word-garden", "pinyin-train", "shape-kingdom", "find-diff",
      "clock-house", "sudoku-petal",
    ];

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: "pad", width: 1024, height: 768, isMobile: false, hasTouch: true },
];

const OUT = "/tmp/shots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
});

const report = [];
for (const game of GAMES) {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    const errors = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 200));
    });
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    try {
      await page.goto(`http://127.0.0.1:5173/#/game/${game}`, { waitUntil: "networkidle2", timeout: 20000 });
      await new Promise((r) => setTimeout(r, 2600)); // 等入场卡退场
      const metrics = await page.evaluate(() => {
        const stage = document.querySelector(".game-stage");
        const doc = document.documentElement;
        const overflowers = [];
        if (stage) {
          const sw = stage.clientWidth;
          for (const el of stage.querySelectorAll("*")) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.right > window.innerWidth + 2 || r.left < -2)) {
              const cls = (el.className && String(el.className).slice(0, 60)) || el.tagName;
              if (overflowers.length < 6) overflowers.push(`${cls} L${Math.round(r.left)} R${Math.round(r.right)}`);
            }
          }
        }
        return {
          stage: stage
            ? {
                clientW: stage.clientWidth,
                clientH: stage.clientHeight,
                scrollH: stage.scrollHeight,
                scrollW: stage.scrollWidth,
              }
            : null,
          docScrollH: doc.scrollHeight,
          winH: window.innerHeight,
          overflowers,
          hasCanvas: !!document.querySelector(".game-stage canvas"),
          canvasSize: (() => {
            const c = document.querySelector(".game-stage canvas");
            if (!c) return null;
            const r = c.getBoundingClientRect();
            return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) };
          })(),
          bodyText: (document.querySelector(".game-stage")?.textContent || "").slice(0, 80),
        };
      });
      await page.screenshot({ path: `${OUT}/${game}-${vp.name}.png` });
      report.push({ game, vp: vp.name, errors: errors.slice(0, 3), ...metrics });
    } catch (e) {
      report.push({ game, vp: vp.name, fatal: String(e).slice(0, 150) });
    }
    await page.close();
  }
  process.stderr.write(`${game} done\n`);
}
await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log("audit complete:", report.length, "entries");
