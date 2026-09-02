/**
 * N-77：kitty-care 小屋相册 915×412 第一屏换装 CTA。
 * ≠ 诊所护理钮、≠ N-59 收藏册 overlay。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("./styles.ts", import.meta.url), "utf8");
const INDEX = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("N-77 小屋相册 · 矮横屏换装 CTA", () => {
  it("相册挂 ktc-album，诊所壳不挂", () => {
    expect(INDEX).toContain('wrap.className = "ktc-album"');
    expect(INDEX).toContain('action.textContent = `⭐ ${piece.cost} 换回来`');
    expect(INDEX).not.toContain("collection-overlay");
  });

  it("915×412 一族把卡片收成横条，首屏 CTA 优先于说明", () => {
    expect(CSS).toContain("N-77");
    expect(CSS).toContain("@media (max-height:500px) and (min-width:600px)");
    expect(CSS).toContain(".ktc-album .ktc-card{min-height:0;flex-direction:row");
    expect(CSS).toContain(".ktc-album .ktc-cardnote{display:none;}");
    expect(CSS).toContain(".ktc-album .ktc-card .ktc-thumb{min-height:44px");
    const land = CSS.slice(CSS.indexOf("/* N-77"), CSS.indexOf(".ktc-card{background"));
    expect(land).not.toContain(".ktc-nook");
    expect(land).not.toContain(".ktc-wrap");
  });

  it("兑换钮热区仍 ≥44，不靠收热区塞进屏", () => {
    expect(CSS).toMatch(/\.ktc-mini\{[^}]*min-height:44px/);
  });
});
