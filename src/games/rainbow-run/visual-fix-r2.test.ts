/**
 * 彩虹跑跑 · 1.3 窗口3 第 2 轮监督修复员 · 修后钉子。
 *
 * 对应第 1 轮 fixer 遗留 #2(本轮 A 档精确化为 8 行):
 * 战役地图锁 🔒 / 终点旗 🏁 / 限时表 ⏱ / 节点与结算星 ⭐▫☆ /
 * 结算统计行 🍬⭐ / 无尽入口 ♾️ / 任务行 🎯(战役+无尽双入口)/
 * 岔路路牌 ◀▶ ——画布 fillText emoji 全部换画制小图标。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  drawMiniStar,
  drawPadlock,
  drawFinishFlag,
  drawStopwatchBadge,
  drawInfinityBadge,
  drawTargetBadge,
  drawForkArrow,
} from "./art";

const indexSrc = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

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

describe("fix(visual-r2) 遗留#2:画制徽章画法", () => {
  it("drawMiniStar:满/空两态互异,都有描边,零 fillText", () => {
    const filled = makeRec();
    drawMiniStar(filled.ctx, 7, true);
    const empty = makeRec();
    drawMiniStar(empty.ctx, 7, false);
    for (const r of [filled, empty]) {
      expect(r.ops.filter((o) => o === "lineTo").length).toBeGreaterThanOrEqual(9);
      expect(r.ops).toContain("stroke");
      expect(r.texts).toEqual([]);
    }
    const fillOf = (ops: string[]) => ops.filter((o) => o.startsWith("fillStyle="));
    expect(fillOf(filled.ops)).not.toEqual(fillOf(empty.ops));
  });

  it("drawPadlock:锁梁+金身渐变+锁孔+左上高光,零 fillText", () => {
    const r = makeRec();
    drawPadlock(r.ctx, 10);
    expect(r.ops).toContain("createLinearGradient");
    expect(r.ops.filter((o) => o === "roundRect").length).toBeGreaterThanOrEqual(2);
    expect(r.ops).toContain("ellipse");
    expect(r.texts).toEqual([]);
  });

  it("drawFinishFlag:旗杆+白底格纹旗面(≥3 个深格),零 fillText", () => {
    const r = makeRec();
    drawFinishFlag(r.ctx, 10);
    expect(r.ops.filter((o) => o === "fillRect").length).toBeGreaterThanOrEqual(3);
    expect(r.ops.filter((o) => o === "stroke").length).toBeGreaterThanOrEqual(2);
    expect(r.texts).toEqual([]);
  });

  it("drawStopwatchBadge:表面+双针+顶钮+弧光,零 fillText", () => {
    const r = makeRec();
    drawStopwatchBadge(r.ctx, 8);
    expect(r.ops.filter((o) => o === "arc").length).toBeGreaterThanOrEqual(3);
    expect(r.ops.filter((o) => o === "stroke").length).toBeGreaterThanOrEqual(3);
    expect(r.texts).toEqual([]);
  });

  it("drawInfinityBadge:两只彩虹描边圆环颜色互异,零 fillText", () => {
    const r = makeRec();
    drawInfinityBadge(r.ctx, 11);
    const strokes = r.ops.filter((o) => o.startsWith("strokeStyle="));
    expect(strokes).toContain("strokeStyle=#ff8fb4");
    expect(strokes).toContain("strokeStyle=#7ac9e0");
    expect(r.ops.filter((o) => o === "arc").length).toBeGreaterThanOrEqual(3);
    expect(r.texts).toEqual([]);
  });

  it("drawTargetBadge:同心环+靶心+高光弧,零 fillText", () => {
    const r = makeRec();
    drawTargetBadge(r.ctx, 8);
    expect(r.ops.filter((o) => o === "arc").length).toBeGreaterThanOrEqual(4);
    expect(r.texts).toEqual([]);
  });

  it("drawForkArrow:左右两个朝向画出的三角互为镜像,零 fillText", () => {
    const left = makeRec();
    drawForkArrow(left.ctx, 6, -1);
    const right = makeRec();
    drawForkArrow(right.ctx, 6, 1);
    for (const r of [left, right]) {
      expect(r.ops.filter((o) => o === "lineTo").length).toBeGreaterThanOrEqual(2);
      expect(r.ops).toContain("closePath");
      expect(r.texts).toEqual([]);
    }
  });
});

describe("fix(visual-r2) 遗留#2:8 行画布 emoji 全部换画制接入", () => {
  it("章节卡与地图节点的 🔒 换 drawPadlock", () => {
    expect(indexSrc.includes('unlocked ? st.emoji : "🔒"')).toBe(false);
    expect(indexSrc.includes('ctx.fillText("🔒"')).toBe(false);
    expect(indexSrc).toContain("drawPadlock(ctx, ch * 0.15)");
    expect(indexSrc).toContain("drawPadlock(ctx, r * 0.52)");
  });

  it("终点 🏁 换 drawFinishFlag,限时 ⏱ 换 drawStopwatchBadge", () => {
    expect(indexSrc.includes('ctx.fillText("🏁"')).toBe(false);
    expect(indexSrc.includes('ctx.fillText("⏱"')).toBe(false);
    expect(indexSrc).toContain("drawFinishFlag(ctx, r * 0.32)");
    expect(indexSrc).toContain("drawStopwatchBadge(ctx, r * 0.28)");
  });

  it("地图节点星级与结算三星不再拼 ⭐▫/⭐☆ 字符串", () => {
    expect(indexSrc.includes('s < got ? "⭐" : "▫"')).toBe(false);
    expect(indexSrc.includes('s < earnedStars ? "⭐" : "☆"')).toBe(false);
    expect(indexSrc).toContain("drawMiniStar(ctx, r * 0.26, s < got)");
    expect(indexSrc).toContain("drawMiniStar(ctx, 16, s < earnedStars)");
  });

  it("结算统计行 🍬⭐ 换静态星币帧 + 迷你星,整行量宽居中", () => {
    expect(indexSrc.includes("🍬${stats.coins} ⭐${stats.stars}")).toBe(false);
    expect(indexSrc).toContain("drawCoinFrame(ctx, 7, 0)");
    expect(indexSrc).toContain("const rowW = 16 + ctx.measureText(coinsTxt).width + 20 + ctx.measureText(starsTxt).width");
  });

  it("无尽入口 ♾️ 换 drawInfinityBadge,任务行 🎯(战役+无尽)换 drawTargetBadge", () => {
    expect(indexSrc.includes('"♾️ 无尽彩虹跑"')).toBe(false);
    expect(indexSrc.includes("🎯 任务:")).toBe(false);
    expect(indexSrc.includes("🎯 目标:")).toBe(false);
    expect(indexSrc).toContain("drawInfinityBadge(ctx, 11)");
    expect(indexSrc.split("drawTargetBadge(ctx, 8)").length).toBeGreaterThanOrEqual(3);
  });

  it("岔路路牌 ◀▶ 字符换 drawForkArrow 双向箭头", () => {
    expect(indexSrc.includes("◀ 岔路口")).toBe(false);
    expect(indexSrc).toContain("drawForkArrow(ctx, 6, -1)");
    expect(indexSrc).toContain("drawForkArrow(ctx, 6, 1)");
  });

  it("章节地图页行首 ⭐ 换 drawMiniStar,量宽后整体居中", () => {
    expect(indexSrc.includes("`⭐ ${themeStars(progress, chapterIdx)}")).toBe(false);
    expect(indexSrc).toContain("drawMiniStar(ctx, 7, true)");
  });
});
