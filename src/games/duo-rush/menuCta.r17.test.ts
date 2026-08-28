/**
 * N-87 duo-rush 菜单 CTA 进 915×412。≠ N-40：赛道 .dr-btns sticky 必须还在。
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const INDEX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const MATCH = readFileSync(fileURLToPath(new URL("./match.ts", import.meta.url)), "utf8");
const PUPPETEER_JS = "/tmp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";
const CHROME = "/usr/local/bin/google-chrome";

const CTA_CSS = `
html,body{margin:0;width:915px;height:412px;overflow:auto;}
.dr-panel{display:flex;flex-direction:column;gap:12px;padding:8px 4px;}
.dr-label{font-weight:800;font-size:15px;margin-bottom:6px;}
.dr-seg{display:flex;gap:8px;flex-wrap:wrap;}
.dr-seg button{flex:1 1 150px;min-height:48px;padding:10px 8px;font-size:15px;}
.dr-softbtn,.dr-start{border:none;border-radius:16px;padding:12px;font-size:16px;width:100%;min-height:44px;}
.dr-hidden{display:none;}
@media (max-height: 500px) {
  .dr-setup-cta {
    position: sticky; bottom: 0; z-index: 4; display: flex; gap: 6px; flex-wrap: wrap;
    padding: 6px 0 2px; background: #E9F4FF;
  }
  .dr-setup-cta .dr-softbtn, .dr-setup-cta .dr-start {
    flex: 1 1 140px; width: auto; min-height: 44px;
  }
}
`;

function menuHtml(): string {
  const seg = (n: number) =>
    Array.from({ length: n }, (_, i) => `<button type="button">选项 ${i + 1}</button>`).join("");
  return `<!doctype html><html><head><style>${CTA_CSS}</style></head><body>
<div class="dr-panel dr-setup" style="min-height:520px">
  <div><div class="dr-label">选比赛</div><div class="dr-seg">${seg(5)}</div></div>
  <div><div class="dr-label">选对手</div><div class="dr-seg">${seg(4)}</div></div>
  <div><div class="dr-label">让分</div><div class="dr-seg">${seg(2)}</div></div>
  <div class="dr-setup-cta">
    <button class="dr-softbtn dr-rulesbtn" type="button">怎么玩（点我看规则）</button>
    <button class="dr-softbtn dr-collectbtn" type="button">我的收藏册</button>
    <button class="dr-start" type="button">准备好，开跑</button>
  </div>
</div></body></html>`;
}

describe("N-87 duo-rush 菜单 CTA", () => {
  it("菜单 .dr-setup-cta sticky，赛道 .dr-btns sticky 未回退", () => {
    expect(INDEX).toContain("class=\"dr-setup-cta\"");
    expect(INDEX).toContain(".dr-setup-cta {");
    expect(INDEX).toContain("position: sticky; bottom: 0; z-index: 4");
    expect(INDEX).toContain(".dr-btns {");
    expect(INDEX).toContain("position: sticky; bottom: 0; z-index: 7");
    expect(MATCH).not.toContain("dr-setup-cta");
    expect(MATCH).not.toContain("sticky");
  });

  it.skipIf(!existsSync(PUPPETEER_JS) || !existsSync(CHROME))(
    "915×412 getBoundingClientRect：怎么玩与收藏册底边 ≤ 412",
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
        await page.setContent(menuHtml(), { waitUntil: "domcontentloaded" });
        const shot = await page.evaluate(() => {
          const grab = (sel: string) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, height: r.height };
          };
          return {
            how: grab(".dr-rulesbtn"),
            collect: grab(".dr-collectbtn"),
            innerHeight,
          };
        });
        expect(shot.how).toBeTruthy();
        expect(shot.collect).toBeTruthy();
        expect(shot.how!.top).toBeGreaterThanOrEqual(0);
        expect(shot.how!.bottom).toBeLessThanOrEqual(412 + 1);
        expect(shot.how!.height).toBeGreaterThanOrEqual(44);
        expect(shot.collect!.bottom).toBeLessThanOrEqual(412 + 1);
        expect(shot.collect!.height).toBeGreaterThanOrEqual(44);
      } finally {
        await browser.close();
      }
    },
    25000
  );
});
