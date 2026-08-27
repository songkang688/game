/**
 * 彩虹跑跑 · 1.3 窗口3 第 1 轮监督修复员 · 修后钉子。
 *
 * 对应 A 档 P-02：360 视口战役主页标题「十二大世界」末字与 🎁 收藏册按钮
 * 重叠 ≈18px。修法：标题走 fitTitle 避让——优先整幅居中，会压到按钮时在
 * 空档内居中并自动缩字号（titleFitPx，不小于 15px）；收藏册按钮不存在时
 * 沿用整幅宽度，画面与原来一致。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { titleFitPx } from "./art";

const indexSrc = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 线性量宽桩:width = px × 每字符宽系数 */
const measureAt = (perPx: number) => (px: number) => px * perPx;

describe("fix(visual-r1) P-02：标题避让收藏册按钮", () => {
  it("titleFitPx:塞得下就保持原字号", () => {
    expect(titleFitPx(measureAt(11), 24, 15, 300)).toBe(24);
  });

  it("titleFitPx:塞不下逐级缩到恰好放下", () => {
    // 24px 时宽 264 > 230,20px 时宽 220 ≤ 230
    expect(titleFitPx(measureAt(11), 24, 15, 230)).toBe(20);
  });

  it("titleFitPx:再窄也不小于 minPx 兜底", () => {
    expect(titleFitPx(measureAt(11), 24, 15, 80)).toBe(15);
  });

  it("战役主页标题改走 fitTitle,且右边界跟着收藏册按钮有无自适应", () => {
    expect(indexSrc).toContain('fitTitle("🌈 彩虹跑跑 · 十二大世界", 26, 24, 10, hasCollection() ? w - 54 : w - 10)');
    expect(indexSrc.includes('ctx.fillText("🌈 彩虹跑跑 · 十二大世界", w / 2')).toBe(false);
  });

  it("章节地图页标题同样避让「◀ 世界」按钮(P-02 同类项)", () => {
    expect(indexSrc).toContain("fitTitle(`${st.emoji} 第${chapterIdx + 1}章 · ${st.name}`, 28, 22, 76, w - 8)");
  });
});
