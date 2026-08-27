/**
 * 海底大胃王 · 1.3 窗口3 第 1 轮监督修复员 · 修后钉子。
 *
 * 对应 A 档 P-01：360 视口主页标题「海底大胃王」右侧 ≈34px 被图鉴徽章盖住。
 * 修法：标题走 fitTitle 避让——优先整幅居中，会压到徽章/按钮时在空档内
 * 居中并自动缩字号（titleFitPx，不小于 15px）；海域选择页两钮之间塞不下时
 * 标题块整体下移（stacked 布局）。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { titleFitPx } from "./art";

const indexSrc = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 线性量宽桩:width = px × 每字符宽系数 */
const measureAt = (perPx: number) => (px: number) => px * perPx;

describe("fix(visual-r1) P-01：标题避让图鉴徽章", () => {
  it("titleFitPx:塞得下就保持原字号", () => {
    expect(titleFitPx(measureAt(7), 24, 15, 200)).toBe(24);
  });

  it("titleFitPx:塞不下逐级缩到恰好放下", () => {
    // 24px 时宽 168 > 119,17px 时宽 119 ≤ 119
    expect(titleFitPx(measureAt(7), 24, 15, 119)).toBe(17);
  });

  it("titleFitPx:再窄也不小于 minPx 兜底", () => {
    expect(titleFitPx(measureAt(7), 24, 15, 60)).toBe(15);
  });

  it("主页/海域页/对战选难度的标题都改走 fitTitle,不再裸 fillText 撞按钮", () => {
    expect(indexSrc).toContain('fitTitle("🐟 海底大胃王", 28');
    expect(indexSrc).toContain("fitTitle(themesTitle");
    expect(indexSrc).toContain('fitTitle("⚖️ 限时谁更胖"');
    expect(indexSrc.includes('ctx.fillText("🐟 海底大胃王", w / 2')).toBe(false);
    expect(indexSrc.includes('ctx.fillText("🐟 海底大胃王 · 九大海域", w / 2')).toBe(false);
    expect(indexSrc.includes('ctx.fillText("⚖️ 限时谁更胖", w / 2')).toBe(false);
  });

  it("海域选择页保留窄屏堆叠分支(标题下移,卡片让位)", () => {
    expect(indexSrc).toContain("stacked ? 82 : 52");
    expect(indexSrc).toContain("stacked ? 96 : 70");
  });
});
