import { describe, expect, it } from "vitest";
import { MJ_CSS } from "./index";

/** 切出 `@media (max-height:500px)` 那一块(数括号找配对收尾) */
function shortLandscapeBlock(css: string): string {
  const at = css.indexOf("@media (max-height:500px)");
  expect(at, "矮横屏媒体块丢了(N-75 会回退)").toBeGreaterThan(-1);
  const from = css.indexOf("{", at) + 1;
  let depth = 1;
  let i = from;
  for (; i < css.length && depth > 0; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
  }
  return css.slice(from, i - 1);
}

describe("N-105 mahjong-bloom 矮横屏 .mj-goal 字号守门", () => {
  it("矮横屏块里 .mj-goal 不许压小字号、不许 nowrap(高度紧走两行截断)", () => {
    const block = shortLandscapeBlock(MJ_CSS);
    const decl = block.match(/\.mj-goal\s*\{([^}]*)\}/);
    expect(decl, "矮横屏块里找不到 .mj-goal").not.toBeNull();
    const fs = decl?.[1].match(/font-size:\s*([0-9.]+)px/);
    if (fs) expect(Number(fs[1]), ".mj-goal 是正文,360px 守门 ≥16px").toBeGreaterThanOrEqual(16);
    expect(decl?.[1], "正文不许 nowrap 挤成一条").not.toContain("nowrap");
    // 高度用两行截断兜底,别让目标行把手牌挤出屏
    expect(decl?.[1]).toMatch(/max-height:\s*2\.6em/);
  });

  it("N-75 手牌钉底不回退", () => {
    const block = shortLandscapeBlock(MJ_CSS);
    expect(block).toContain(".mj-hand{position:fixed");
  });
});
