/**
 * r18 · N-86 回归时新抓的横向爆宽:矮横屏 `.bvp-mode-d` 的 nowrap 把
 * `1fr 1fr` 网格轨的 min-content 撑到 449+510=960px(容器 640),右列
 * 「无尽深渊 / 备战小屋」right=1104 溢出 915 视口。
 * 修法:网格项 + `.bvp-row-main` 放开 `min-width:0`。竖向口径仍归 r16 测试。
 */
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BVP_LOBBY_SHORT_CSS } from "./lobbyFit";

const PUPPETEER_JS = "/tmp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";
const CHROME = "/usr/local/bin/google-chrome";

describe("r18 brave-path 大厅模式卡横向不出屏", () => {
  it("矮横屏网格项与文字列都放开了 min-width(nowrap 不再撑轨)", () => {
    expect(BVP_LOBBY_SHORT_CSS).toMatch(/\.bvp-lobby \.bvp-mode\{[^}]*min-width:0/);
    expect(BVP_LOBBY_SHORT_CSS).toMatch(/\.bvp-lobby \.bvp-row-main\{[^}]*min-width:0/);
    // 单行省略的观感保留
    expect(BVP_LOBBY_SHORT_CSS).toMatch(/\.bvp-lobby \.bvp-mode-d\{[^}]*text-overflow:ellipsis/);
  });

  it.skipIf(!existsSync(PUPPETEER_JS) || !existsSync(CHROME))(
    "915×412 getBoundingClientRect:四张模式卡右边 ≤ 视口",
    async () => {
      const puppeteer = await import(PUPPETEER_JS);
      const mode = (em: string, t: string, d: string) =>
        `<button class="bvp-mode" type="button"><span class="bvp-mode-em">${em}</span>` +
        `<span class="bvp-row-main"><span class="bvp-mode-t">${t}</span>` +
        `<span class="bvp-mode-d">${d}</span></span></button>`;
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:915px;height:412px;overflow:hidden;}
.bvp-root{--bvp-ink:#4b3a6e;--bvp-soft:#7b6aa0;font-family:sans-serif;max-width:640px;margin:0;}
.bvp-modes{display:grid;grid-template-columns:1fr;gap:10px;}
@media(min-width:560px){.bvp-modes{grid-template-columns:1fr 1fr;}}
.bvp-mode{border:none;border-radius:18px;padding:15px;text-align:left;font-family:inherit;
  display:flex;gap:12px;align-items:flex-start;}
.bvp-mode-t{font-size:17px;font-weight:900;display:block;}
.bvp-mode-d{font-size:13px;font-weight:700;line-height:1.55;display:block;}
${BVP_LOBBY_SHORT_CSS}
</style></head><body><div class="bvp-root"><div class="bvp-lobby"><div class="bvp-modes">
${mode("地图", "闯关 · 188 关", "八个主题章节，每章尽头有一位首领。从第一章第 1 关起步。")}
${mode("洞", "无尽深渊", "一层一层往下走，越走越难，随时可以回城。最好成绩：第 0 层。")}
${mode("剑", "对战 · 星星的队伍", "三对三接力，双方自动比拼。已挑战 0 次，赢了 0 次。")}
${mode("包", "备战小屋", "换装备、点技能、整理背包、挑同伴。出发前多花一分钟，路上少走十步弯路。")}
</div></div></div></body></html>`;
      const browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
      });
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 915, height: 412, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: "domcontentloaded" });
        const shot = await page.evaluate(() => {
          return [...document.querySelectorAll(".bvp-mode")].map((el) => {
            const r = el.getBoundingClientRect();
            const t = el.querySelector(".bvp-mode-t");
            return { right: r.right, w: r.width, text: t ? t.textContent || "" : "" };
          });
        });
        expect(shot).toHaveLength(4);
        for (const m of shot) {
          expect(m.right, `${m.text} right=${m.right}`).toBeLessThanOrEqual(915 + 1);
        }
      } finally {
        await browser.close();
      }
    },
    25000
  );
});
