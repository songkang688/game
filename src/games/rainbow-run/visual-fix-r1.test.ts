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
import { drawHeartPip, drawNoteChip, titleFitPx } from "./art";

const indexSrc = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

/** 线性量宽桩:width = px × 每字符宽系数 */
const measureAt = (perPx: number) => (px: number) => px * perPx;

/** 极简录制桩:记方法名/样式赋值,截获 fillText 文本 */
function makeRec(): { ctx: CanvasRenderingContext2D; ops: string[]; texts: string[] } {
  const ops: string[] = [];
  const texts: string[] = [];
  const gradient = { addColorStop: (_o: number, c: string) => ops.push(`stop:${c}`) };
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop: string | symbol) => {
        const name = String(prop);
        if (name === "fillText")
          return (t: string) => {
            texts.push(t);
            ops.push("fillText");
          };
        if (name === "createRadialGradient" || name === "createLinearGradient")
          return () => {
            ops.push(name);
            return gradient;
          };
        return () => {
          ops.push(name);
        };
      },
      set: (_t, prop: string | symbol, v: unknown) => {
        ops.push(`${String(prop)}=${typeof v === "string" ? v : "*"}`);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, ops, texts };
}

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

describe("fix(visual-r1) P-07：局内 HUD 图标画制化", () => {
  it("drawHeartPip:实心有渐变面+高光点,空心平面灰白,两态都有描边、零 fillText", () => {
    const filled = makeRec();
    drawHeartPip(filled.ctx, 8, true);
    const empty = makeRec();
    drawHeartPip(empty.ctx, 8, false);
    expect(filled.ops).toContain("createRadialGradient");
    expect(empty.ops).not.toContain("createRadialGradient");
    for (const r of [filled, empty]) {
      expect(r.ops).toContain("bezierCurveTo");
      expect(r.ops).toContain("stroke");
      expect(r.texts).toEqual([]);
    }
    // 实心多一枚左上高光椭圆
    const count = (ops: string[]) => ops.filter((o) => o === "ellipse").length;
    expect(count(filled.ops)).toBe(count(empty.ops) + 1);
  });

  it("drawNoteChip:矢量音符(符头+符干+小旗),零 fillText", () => {
    const r = makeRec();
    drawNoteChip(r.ctx, 7);
    expect(r.ops).toContain("ellipse");
    expect(r.ops.filter((o) => o === "stroke").length).toBeGreaterThanOrEqual(2);
    expect(r.texts).toEqual([]);
  });

  it("局内 HUD 不再拼 🍬⭐💗🤍 emoji 串,改走画制图标", () => {
    // 只钉局内 HUD 那一行(结算/复活面板的 emoji 行属 P-07 遗留,交下一轮)
    expect(indexSrc.includes("⭐${stats.stars}${comboTxt}")).toBe(false);
    expect(indexSrc.includes('"💗".repeat')).toBe(false);
    expect(indexSrc.includes('"🤍".repeat')).toBe(false);
    expect(indexSrc).toContain("drawHeartPip(ctx, 8, i < hearts)");
    expect(indexSrc).toContain("drawCoinFrame(ctx, 7.5, 0)");
    expect(indexSrc).toContain("drawStarPickup(ctx, 6, 0)");
    expect(indexSrc).toContain("drawNoteChip(ctx, 6.5)");
  });
});
