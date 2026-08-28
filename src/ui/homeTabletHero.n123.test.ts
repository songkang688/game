/**
 * N-123(U-4):平板横屏/小笔记本首页 hero 收紧。
 *
 * 实测基线(修前):1024×768 / 1180×820 / 1280×800 首卡 top=557(首屏只露半行卡)。
 * 修后三档均 top=499(≤500 验收线);390×844(496)、768×1024(623)、915×412(304) 零回退。
 * 这里钉住三件事:平板档媒体查询在场且与 S-1 两档互斥、插图只缩不删、S-1 两档原文未动。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

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

describe("N-123 首页平板横屏 hero 档", () => {
  const tablet = mediaBlock("(min-width: 700px) and (min-height: 501px) and (max-height: 840px)");

  it("平板档存在且用 min-height:501 与 S-1 的 500 档互斥(915×412 不落此档)", () => {
    expect(tablet.length).toBeGreaterThan(0);
    expect(CSS).toContain("@media (min-width: 700px) and (min-height: 501px) and (max-height: 840px)");
  });

  it("插图只缩不删:平板还看得到朵朵星星,display:none 是 S-1 手机档的事", () => {
    expect(tablet).toMatch(/\.home-screen \.hero-figure\s*\{[^}]*width:\s*72px/);
    expect(tablet).not.toContain("display: none");
  });

  it("S-1 两档原文未动(测试只增不减)", () => {
    const portrait = mediaBlock("(max-width: 480px)");
    const landscape = mediaBlock("(max-height: 500px)");
    expect(portrait).toMatch(/\.home-screen \.hero-figure\s*\{\s*display:\s*none/);
    expect(landscape).toMatch(/\.home-screen \.hero-figure\s*\{\s*display:\s*none/);
  });
});
