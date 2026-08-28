/**
 * N-88 fight-king 双人对战选人「开打」进 915×412。≠ N-57 训练场 .fk-pick-train。
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const PUPPETEER_JS = "/tmp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";
const CHROME = "/usr/local/bin/google-chrome";

const CSS = `
html,body{margin:0;width:915px;height:412px;overflow:auto;}
.fk-card{padding:14px;}
.fk-picks{display:grid;grid-template-columns:1fr 1fr;gap:10px;min-height:360px;}
.fk-pick{min-height:170px;background:#fff;}
.fk-bar{display:flex;gap:8px;}
.fk-btn-go{min-height:44px;padding:9px 15px;font-size:15px;}
@media (max-height:500px){
  .fk-pick-versus .fk-pick-go{
    position:sticky;bottom:0;z-index:5;padding:8px 0 2px;background:#fffdff;
  }
}
`;

function versusHtml(): string {
  return `<!doctype html><html><head><style>${CSS}</style></head><body>
<div class="fk-card fk-pick-versus">
  <div class="fk-bar"><button>返回</button><span>双人对战</span></div>
  <div class="fk-picks"><div class="fk-pick">P1</div><div class="fk-pick">P2</div></div>
  <div class="fk-bar fk-pick-go"><button class="fk-btn-go" type="button">开打 ▶</button></div>
</div></body></html>`;
}

describe("N-88 fight-king 双人对战选人开打", () => {
  it("versus 壳钉开打，训练场 N-57 规则原样", () => {
    expect(SRC).toContain('mode === "versus" ? "fk-card fk-pick-versus"');
    expect(SRC).toContain('mode === "versus" ? "fk-bar fk-pick-go"');
    expect(SRC).toContain(".fk-pick-versus .fk-pick-go{");
    expect(SRC).toContain("position:sticky;bottom:0");
    expect(SRC).toContain("fk-card fk-pick-train");
    expect(SRC).toContain(".fk-pick-train .fk-dummy-go{");
    expect(SRC).toContain("position:sticky;top:0");
    expect(SRC).toContain(".fk-train-shell .fk-pads{");
  });

  it.skipIf(!existsSync(PUPPETEER_JS) || !existsSync(CHROME))(
    "915×412 getBoundingClientRect：开打底边 ≤ 412",
    async () => {
      const puppeteer = await import(PUPPETEER_JS);
      const browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
      });
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 915, height: 412, deviceScaleFactor: 1 });
        await page.setContent(versusHtml(), { waitUntil: "domcontentloaded" });
        const go = await page.evaluate(() => {
          const el = document.querySelector(".fk-btn-go");
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, height: r.height };
        });
        expect(go).toBeTruthy();
        expect(go!.top).toBeGreaterThanOrEqual(0);
        expect(go!.bottom).toBeLessThanOrEqual(412 + 1);
        expect(go!.height).toBeGreaterThanOrEqual(44);
      } finally {
        await browser.close();
      }
    },
    25000
  );
});
