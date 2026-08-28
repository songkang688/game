/**
 * S-1(trio-r5):首页首屏必须见到首行游戏卡。
 *
 * 实测基线(修前):360×640 首卡 top=722(首屏 0 卡)、390×844 top=717(只露 127px 半张)、
 * 915×412 top=557(横屏首屏 0 卡)。修后:493 / 496 / 304,三档都露出首行卡上半张。
 * 这里钉住三件事:两档媒体查询在场、hero 插图确实让位、热区与字号红线没被顺手压穿。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

/** 取出某个媒体查询块的完整内容(括号配平,而不是正则贪婪匹配) */
function mediaBlock(query: string): string {
  const start = CSS.indexOf(`@media ${query}`);
  expect(start, `styles.css 里应有 @media ${query}`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  let i = CSS.indexOf("{", start);
  const bodyStart = i;
  for (; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    else if (CSS[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return CSS.slice(bodyStart, i + 1);
}

describe("S-1 首页首屏媒体查询", () => {
  const portrait = mediaBlock("(max-width: 480px)");
  const landscape = mediaBlock("(max-height: 500px)");

  it("竖屏手机档:安全区 padding 用双类名压过尾部规则,env() 兜底照留", () => {
    expect(portrait).toMatch(/\.screen\.home-screen\s*\{[^}]*max\(10px, env\(safe-area-inset-top/);
  });

  it("竖屏手机档:hero 插图让位给游戏卡,欢迎语气泡保留", () => {
    expect(portrait).toMatch(/\.home-screen \.hero-figure\s*\{\s*display:\s*none/);
    // 气泡本体只收 padding,不许 display:none
    expect(portrait).not.toMatch(/\.hero-bubble\s*\{[^}]*display:\s*none/);
  });

  it("横屏矮屏档:hero 只留一句欢迎语(插图与副标题都收起)", () => {
    expect(landscape).toMatch(/\.home-screen \.hero-figure\s*\{\s*display:\s*none/);
    expect(landscape).toMatch(/\.home-screen \.hero-bubble span\s*\{\s*display:\s*none/);
    expect(landscape).toMatch(/\.home-screen \.hero-bubble strong/);
  });

  it("横屏矮屏档:玩法与设备两排筛选并成一排(inline-flex + width auto)", () => {
    expect(landscape).toMatch(
      /\.home-screen \.tabs\.mode-chips,\s*\.home-screen \.tabs\.platform-chips\s*\{[^}]*display:\s*inline-flex/
    );
    expect(landscape).toMatch(/width:\s*auto/);
  });

  it("两档里所有 min-height 都不低于 44px 热区线", () => {
    for (const block of [portrait, landscape]) {
      const heights = [...block.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
      expect(heights.length).toBeGreaterThan(0);
      for (const px of heights) expect(px).toBeGreaterThanOrEqual(44);
    }
  });

  it("两档里所有 font-size 都不低于 14px 控件字号线", () => {
    for (const block of [portrait, landscape]) {
      const sizes = [...block.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]));
      for (const px of sizes) expect(px).toBeGreaterThanOrEqual(14);
    }
  });

  it("U-4 平板横屏收 hero,S-1 两档原文仍在", () => {
    expect(CSS).toContain("@media (min-width: 700px) and (max-height: 840px)");
    expect(CSS).toContain("@media (max-width: 480px)");
    expect(CSS).toContain("@media (max-height: 500px)");
  });
});
