/**
 * 窗口 6 · 第 1 轮视觉监督修复员(C 档)· bubble-pop 修后钉住测试。
 *
 * 覆盖两件事:
 * 1. 自查修复:360/320 窄屏下 8 列棋盘曾被 .bp-wrap 的 overflow:hidden 裁掉
 *    第 8 列(实测 360px 只剩 4.2px 可见、320px 完全不可见)。修法是窄屏
 *    media 里让格子 min-width 归零 + 收窄池边距,整盘等比收窄全可见。
 * 2. W6R1-08 触区 36→40px 的核对结论:8×40 + 7×5 = 355px > 360 屏盘面
 *    物理上限(约 303px),放不下,登记遗留——宽屏基础规则保持 36px 不动。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { bpVisualCss } from "./visual";

const indexSrc = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const css = bpVisualCss();

describe("bubble-pop 窄屏 8 列全可见(fixer 自查修复)", () => {
  it("窄屏 media 让格子可收窄:min-width 归零 + 池边距收到 8px + 缝收回 4px", () => {
    const block = /@media \(max-width: 400px\) \{([\s\S]*?)\n\}/.exec(css);
    expect(block, "找不到窄屏适配 media 块").not.toBeNull();
    const body = block![1];
    expect(body).toContain(".bp-cell { min-width: 0; }");
    expect(body).toContain(".bp-wrap { padding-left: 8px; padding-right: 8px; }");
    expect(body).toContain(".bp-board { gap: 4px; }");
  });

  it("宽屏热区一个像素不动:基础 .bp-cell 仍是 min-width: 36px", () => {
    const m = /\.bp-cell \{[^}]*min-width: (\d+)px/.exec(indexSrc);
    expect(m).not.toBeNull();
    expect(m![1]).toBe("36");
  });

  it("窄屏收窄规则必须排在基础规则之后才能覆盖(bpVisualCss 追加在 1.2 布局之后)", () => {
    // index.ts 里 CSS = 1.2 布局字符串 + bpVisualCss(),顺序颠倒会让覆盖失效
    expect(indexSrc).toMatch(/\` \+ bpVisualCss\(\)/);
    // 380 的 gap:5 老规则仍在(字符串不删),但 400 的 gap:4 在其后生效
    expect(indexSrc).toContain(".bp-board { gap: 5px; }");
  });

  it("W6R1-08 遗留登记的数学成立:8 列 40px 触区超出 360 屏盘面物理上限", () => {
    // 360 屏:.screen 4vw×2 + .game-stage 边框 4×2 + .l99-stage 10×2 + 池边距 8×2 ≈ 57px 铺底
    const boardMax = 360 - 2 * 14.4 - 2 * 4 - 2 * 10 - 2 * 8;
    const need40 = 8 * 40 + 7 * 4;
    expect(need40).toBeGreaterThan(boardMax); // 348 > 303.2 → 放不下,遗留成立
    // 收窄后的实际格宽(可用宽 - 7 缝)/ 8 ≥ 32px,好过修前"第 8 列不可见"
    expect((boardMax - 7 * 4) / 8).toBeGreaterThanOrEqual(32);
  });
});
