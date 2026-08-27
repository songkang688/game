/**
 * 1.3 窗口 1 · 第 1 轮监督修复员(C 档)新增的修复钉子。
 *
 * 把本轮 CSS 级修复固化成源码级契约,防止后续轮次回退:
 *  ① P4 / G-5:`oa-open` / `sr-open` / `bd-open` / `sr-skin` 触区 ≥ 44px;
 *  ② P8:mahjong-bloom 毛毡织纹存在且 alpha ≤ 0.04(眯眼不抢牌面);
 *  ③ P8:hero-cards 卡面是米白纸感渐变,不再是 `#fff` 平涂;
 *  ④ P1 / G-6:star-estate 棋盘格不再渲染 `se-tile-emoji` 裸 emoji 节点。
 *
 * 只读源码;修复报告见 docs/qa/1.3-window1-round1-fixer.md。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

function src(game: string, file = "index.ts"): string {
  return readFileSync(join(ROOT, "src", "games", game, file), "utf8");
}

describe("P4 / G-5 · 三款按钮触区补到 44px", () => {
  it("orb-arena .oa-open 声明 min-height:44px", () => {
    expect(/\.oa-open\{[^}]*min-height:44px/s.test(src("orb-arena"))).toBe(true);
  });

  it("snake-royale .sr-open 与 .sr-skin 都声明 min-height:44px", () => {
    const text = src("snake-royale");
    expect(/\.sr-open\{[^}]*min-height:44px/s.test(text)).toBe(true);
    expect(/\.sr-skin\{[^}]*min-height:44px/s.test(text)).toBe(true);
    expect(text).not.toContain("min-height:36px");
  });

  it("block-drop .bd-open 声明 min-height:44px", () => {
    expect(/\.bd-open\{[^}]*min-height:44px/s.test(src("block-drop"))).toBe(true);
  });
});

describe("P8 · 纯 CSS 织纹与纸感", () => {
  it("mahjong-bloom 毛毡叠了斜织纹,且 alpha 严格 ≤ 0.04", () => {
    const text = src("mahjong-bloom");
    const weave = /\.mj-board\{[^}]*repeating-linear-gradient\(45deg,rgba\(255,255,255,\.0([0-4])\)/s.exec(text);
    expect(weave, "毛毡没有织纹层").toBeTruthy();
    // 织纹在毛毡径向渐变之上、木纹边框之前(background 多层顺序)
    const boardRule = /\.mj-board\{[^}]*\}/s.exec(text)?.[0] ?? "";
    expect(boardRule.indexOf("repeating-linear-gradient")).toBeLessThan(boardRule.indexOf("radial-gradient"));
  });

  it("hero-cards 卡面是米白纸感渐变,不再是 #fff 平涂", () => {
    const text = src("hero-cards");
    const rule = /\.hc-card\{[^}]*\}/s.exec(text)?.[0] ?? "";
    expect(rule).toContain("linear-gradient(180deg,#fffdf8,#f6efe2)");
    expect(rule).not.toContain("background:#fff;");
  });
});

describe("P1 / G-6 · star-estate 地格图标矢量化(源码级钉子)", () => {
  it("index.ts 不再有 se-tile-emoji 渲染节点,改插 tileIconSVG", () => {
    const text = src("star-estate");
    expect(text).not.toContain('class="se-tile-emoji"');
    expect(text).toContain("tileIconSVG(tile.emoji)");
    // emoji 转入 aria-label(无障碍语义不降)
    expect(text).toContain("`${tile.emoji} ${tile.name}");
  });
});
