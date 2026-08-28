/**
 * N-86 勇者小路大厅 · 915×412 真布局（getBoundingClientRect）。
 * ≠ N-32：不断言、不改 `.bvp-endless-fight` 战斗三钮。
 *
 * Chrome 走环境里的 puppeteer-core（不写进 package.json）。没有就跳过 GBR 条，CSS 护栏仍跑。
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BVP_LOBBY_CSS,
  BVP_LOBBY_SHORT_CSS,
  lobbySecondRowBottom,
} from "./lobbyFit";

const IDX = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const PUPPETEER_JS = "/tmp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";
const CHROME = "/usr/local/bin/google-chrome";

const FIXTURE_CHROME = `
html,body{margin:0;width:915px;height:412px;overflow:hidden;background:#f6efe4;}
.bvp-root{--bvp-ink:#4b3a6e;--bvp-soft:#7b6aa0;font-family:sans-serif;max-width:640px;margin:0;color:var(--bvp-ink);}
.bvp-card{background:#fffdff;border-radius:18px;padding:14px;margin-bottom:12px;box-sizing:border-box;}
.bvp-h{font-size:17px;font-weight:900;margin:0 0 8px;}
.bvp-sub{font-size:13px;font-weight:700;line-height:1.65;}
.bvp-hero-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;}
.bvp-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:800;}
${BVP_LOBBY_CSS}
`;

function lobbyHtml(): string {
  const sub =
    "朵朵背上小包出发啦。路上有小怪、宝箱、小摊和岔路，打赢了就往前走一步。" +
    "每一招都有属性，火克草、草克水、水克火，光和暗互相克——挑对属性，一下顶两下。";
  const mode = (em: string, t: string, d: string) =>
    `<button class="bvp-mode" type="button"><span class="bvp-mode-em">${em}</span>` +
    `<span class="bvp-row-main"><span class="bvp-mode-t">${t}</span>` +
    `<span class="bvp-mode-d">${d}</span></span></button>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FIXTURE_CHROME}</style></head><body>
<div class="bvp-root"><div class="bvp-lobby">
<div class="bvp-card">
  <div class="bvp-h">勇者小路</div>
  <div class="bvp-sub">${sub}</div>
  <div class="bvp-hero-line">
    <span class="bvp-chip">Lv.1</span><span class="bvp-chip">星芒 20</span>
    <span class="bvp-chip">攻 4 · 防 3 · 速 3</span><span class="bvp-chip">战力 12</span>
    <span class="bvp-chip">币 0</span>
  </div>
</div>
<div class="bvp-modes">
  ${mode("地图", "闯关 · 188 关", "八个主题章节，每章尽头有一位首领。从第一章第 1 关起步。")}
  ${mode("洞", "无尽深渊", "一层一层往下走，越走越难，随时可以回城。最好成绩：第 0 层。")}
  ${mode("剑", "对战 · 星星的队伍", "三对三接力，双方自动比拼。已挑战 0 次，赢了 0 次。")}
  ${mode("包", "备战小屋", "换装备、点技能、整理背包、挑同伴。出发前多花一分钟，路上少走十步弯路。")}
</div>
</div></div></body></html>`;
}

describe("N-86 brave-path 大厅模式卡", () => {
  it("矮横屏规则只打在 .bvp-lobby，战斗壳 N-32 sticky 仍在", () => {
    expect(BVP_LOBBY_SHORT_CSS).toContain("@media (max-height:500px)");
    expect(BVP_LOBBY_SHORT_CSS).toContain(".bvp-lobby .bvp-mode{");
    expect(BVP_LOBBY_SHORT_CSS).toContain("min-height:44px");
    expect(IDX).toContain('view.className = screen === "menu" ? "bvp-lobby" : ""');
    expect(IDX).toContain("BVP_LOBBY_CSS");
    expect(IDX).toContain('if (opts.onFlee) wrap.className = "bvp-endless-fight"');
    expect(IDX).toContain(".bvp-endless-fight .bvp-acts{");
    expect(IDX).toContain("position:sticky;bottom:0");
    expect(IDX).not.toMatch(/\.bvp-endless-fight \.bvp-mode/);
  });

  it("公式：修前 211+116+10+116=453 超 412；修后两行 44 进屏", () => {
    expect(lobbySecondRowBottom(211, 116, 10)).toBe(453);
    expect(lobbySecondRowBottom(140, 44, 6)).toBeLessThanOrEqual(412);
  });

  it.skipIf(!existsSync(PUPPETEER_JS) || !existsSync(CHROME))(
    "915×412 getBoundingClientRect：四张模式卡底边 ≤ 视口",
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
        await page.setContent(lobbyHtml(), { waitUntil: "domcontentloaded" });
        const shot = await page.evaluate(() => {
          const modes = [...document.querySelectorAll(".bvp-mode")].map((el) => {
            const r = el.getBoundingClientRect();
            const t = el.querySelector(".bvp-mode-t");
            return {
              top: r.top,
              bottom: r.bottom,
              height: r.height,
              text: t ? t.textContent || "" : "",
            };
          });
          return { innerHeight, innerWidth, modes };
        });
        expect(shot.innerWidth).toBe(915);
        expect(shot.innerHeight).toBe(412);
        expect(shot.modes).toHaveLength(4);
        expect(shot.modes.some((m) => m.text.includes("对战"))).toBe(true);
        expect(shot.modes.some((m) => m.text.includes("备战"))).toBe(true);
        for (const m of shot.modes) {
          expect(m.top, `${m.text} top=${m.top}`).toBeGreaterThanOrEqual(0);
          expect(m.bottom, `${m.text} bottom=${m.bottom}`).toBeLessThanOrEqual(412 + 1);
          expect(m.height).toBeGreaterThanOrEqual(44);
        }
      } finally {
        await browser.close();
      }
    },
    25000
  );
});
