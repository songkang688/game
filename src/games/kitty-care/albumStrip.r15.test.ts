/**
 * N-77(trio-r15 A):kitty-care 小屋相册矮横屏第一排「换回来」切底。
 * ≠ 诊所护理、≠ 马拉松、≠ N-59 收藏 overlay。存档 key / 题库零触碰。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { KTC_CSS } from "./styles";
import { ALBUM_KEY } from "./album";

function mediaBlock(css: string, query: string): string {
  const needle = `@media ${query}{`;
  const at = css.indexOf(needle);
  expect(at, `应有 ${query}`).toBeGreaterThanOrEqual(0);
  let i = at + needle.length;
  let depth = 1;
  while (i < css.length && depth > 0) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") depth -= 1;
    i += 1;
  }
  return css.slice(at, i);
}

describe("N-77 小屋相册矮横屏横条", () => {
  it("只收 .ktc-album,诊所/马拉松选择器不进这条 media", () => {
    const block = mediaBlock(KTC_CSS, "(max-height:430px) and (min-width:800px)");
    expect(block).toContain(".ktc-album .ktc-card{flex-direction:row");
    expect(block).toContain(".ktc-album .ktc-card .ktc-thumb{width:44px;min-width:44px;min-height:44px");
    expect(block).toContain(".ktc-album .ktc-card>.ktc-mini{flex:0 0 auto");
    expect(block).not.toContain(".ktc-nook");
    expect(block).not.toContain(".ktc-btn{");
    expect(block).not.toContain("ktc-wrap");
  });

  it("竖屏两列+缩略图 100px 基线仍在,兑换钮热区仍 44", () => {
    expect(KTC_CSS).toContain(".ktc-grid{display:grid;grid-template-columns:repeat(2,minmax(100px,1fr))");
    expect(KTC_CSS).toContain(".ktc-card .ktc-thumb{width:100%;min-height:100px");
    expect(KTC_CSS).toContain(".ktc-mini{border:none;border-radius:999px;padding:8px 16px;min-height:44px");
  });

  it("相册存档 key 与 wiring 未改", () => {
    expect(ALBUM_KEY).toBe("yiduo-yixing.kitty-care.album.v1");
    const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(src).toContain("scrollIntoStage(grid, LIST_MIN_ROOM, wrap)");
    expect(src).toContain("⭐ ${piece.cost} 换回来");
  });
});
