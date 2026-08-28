import { describe, expect, it } from "vitest";
import { CSS } from "./index";

/** 切出 `@media (max-height:500px)` 那一块(数括号找配对收尾) */
function shortLandscapeBlock(css: string): string {
  const at = css.indexOf("@media (max-height:500px)");
  expect(at, "矮横屏媒体块丢了(N-76 会回退)").toBeGreaterThan(-1);
  const from = css.indexOf("{", at) + 1;
  let depth = 1;
  let i = from;
  for (; i < css.length && depth > 0; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
  }
  return css.slice(from, i - 1);
}

describe("N-105 combo-clash 矮横屏 .cc-info 字号守门", () => {
  it("矮横屏块里 .cc-info 不许再压到 16px 以下(高度紧只收 max-height)", () => {
    const block = shortLandscapeBlock(CSS);
    const decl = block.match(/\.cc-info\s*\{([^}]*)\}/);
    expect(decl, "矮横屏块里找不到 .cc-info").not.toBeNull();
    const fs = decl?.[1].match(/font-size:\s*([0-9.]+)px/);
    if (fs) expect(Number(fs[1]), ".cc-info 是正文,360px 守门 ≥16px").toBeGreaterThanOrEqual(16);
    // N-76 的高度收口(52px 内自滚)不许丢
    expect(decl?.[1]).toContain("max-height:52px");
    expect(decl?.[1]).toContain("overflow:auto");
  });
});
