// 视觉资产契约（1.3）：调色板合法、玉石渐变黑白有别、木盘边框/漆印/波纹/金花
// 都真的在画。改的是观感，胜负数值一个都不碰 —— 这里断言的全是绘制层。
import { describe, expect, it } from "vitest";
import {
  CORNER_COPPER,
  FRAME_DARK,
  FRAME_GOLD,
  FRAME_LIGHT,
  FRAME_PX,
  HINT_GOLD_EDGE,
  LACQUER_RED,
  SPRITE_OVERSAMPLE,
  SPRITE_SPAN_CELLS,
  STONE_BLACK,
  STONE_WHITE,
  TABLE_DARK,
  TABLE_LIGHT,
  TABLE_PX,
  bloomScale,
  buildStoneSprite,
  hourglassSVG,
  paintBoardFrame,
  paintGoldFlower,
  paintLacquerDot,
  paintRipple,
  paintStar,
  paintStarPoint,
  paintStone,
  rippleAlpha,
  rippleRadius,
  stoneIconSVG,
} from "./art";

/** 记录式 2d 上下文：数方法调用、收渐变色标，够断言「真的画了什么」 */
function recCtx(): { ctx: CanvasRenderingContext2D; calls: string[]; stops: string[] } {
  const calls: string[] = [];
  const stops: string[] = [];
  const grad = { addColorStop: (_o: number, c: string) => void stops.push(c) };
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "createRadialGradient" || prop === "createLinearGradient") {
          return () => {
            calls.push(String(prop));
            return grad;
          };
        }
        return () => {
          calls.push(String(prop));
          return undefined;
        };
      },
      set: () => true,
    }
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, stops };
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe("gomoku 视觉资产 · 调色板", () => {
  it("所有色值都是合法 #rrggbb", () => {
    for (const c of [...STONE_BLACK, ...STONE_WHITE, FRAME_DARK, FRAME_LIGHT, FRAME_GOLD, TABLE_DARK, TABLE_LIGHT, CORNER_COPPER, LACQUER_RED, HINT_GOLD_EDGE]) {
      expect(c, `${c} 不是合法色值`).toMatch(HEX);
    }
  });

  it("黑白棋子的三档渐变逐档都不同（色弱也分得清的双通道之一）", () => {
    for (let i = 0; i < 3; i++) expect(STONE_BLACK[i]).not.toBe(STONE_WHITE[i]);
  });

  it("黑子渐变按规格换成了更沉的墨玉三档", () => {
    expect(STONE_BLACK).toEqual(["#8E7E92", "#4A4054", "#2E2837"]);
    expect(STONE_WHITE).toEqual(["#FFFFFF", "#FBF4E8", "#EBDFC9"]);
  });

  it("边框 / 桌面圈厚度是常数，px() 落点换算永远不受影响", () => {
    expect(FRAME_PX).toBe(10);
    expect(TABLE_PX).toBe(3);
  });
});

describe("gomoku 视觉资产 · 玉石棋子", () => {
  it("paintStone 走径向渐变路径，黑白 stop 色不同", () => {
    const b = recCtx();
    paintStone(b.ctx, 50, 50, 12, 1);
    const w = recCtx();
    paintStone(w.ctx, 50, 50, 12, 2);
    expect(b.calls).toContain("createRadialGradient");
    expect(w.calls).toContain("createRadialGradient");
    expect(b.stops).toEqual([...STONE_BLACK]);
    expect(w.stops).toEqual([...STONE_WHITE]);
  });

  it("白子有描边、黑子没有（贝壳白靠描边压住浅底）", () => {
    const b = recCtx();
    paintStone(b.ctx, 0, 0, 10, 1);
    const w = recCtx();
    paintStone(w.ctx, 0, 0, 10, 2);
    expect(b.calls.filter((c) => c === "stroke").length).toBe(0);
    expect(w.calls.filter((c) => c === "stroke").length).toBe(1);
  });

  it("半径 <= 0 时一笔不画（缩放动画起点安全）", () => {
    const r = recCtx();
    paintStone(r.ctx, 0, 0, 0, 1);
    expect(r.calls.length).toBe(0);
  });

  it("buildStoneSprite 预渲染：尺寸按倍率放大，绘制走渐变", () => {
    const rec = recCtx();
    const canvas = { width: 0, height: 0, getContext: () => rec.ctx };
    const spr = buildStoneSprite({ createElement: () => canvas }, 23.75, 1);
    expect(spr).not.toBeNull();
    expect(spr!.span).toBeCloseTo(23.75 * SPRITE_SPAN_CELLS, 5);
    expect(canvas.width).toBe(Math.ceil(23.75 * SPRITE_SPAN_CELLS * SPRITE_OVERSAMPLE));
    expect(rec.calls).toContain("createRadialGradient");
  });

  it("离屏画布拿不到 2d 上下文时返回 null，调用方能退回逐颗绘制", () => {
    const spr = buildStoneSprite({ createElement: () => ({ getContext: () => null }) }, 24, 2);
    expect(spr).toBeNull();
    expect(buildStoneSprite({ createElement: () => ({ getContext: () => null }) }, 0, 1)).toBeNull();
  });
});

describe("gomoku 视觉资产 · 精装木盘", () => {
  it("边框一次画齐：桌面 4 块 + 边框 4 块、柔影与金线、四角铜饰双弧", () => {
    const r = recCtx();
    paintBoardFrame(r.ctx, 380);
    expect(r.calls.filter((c) => c === "fillRect").length).toBeGreaterThanOrEqual(8);
    expect(r.calls.filter((c) => c === "strokeRect").length).toBeGreaterThanOrEqual(2);
    expect(r.calls.filter((c) => c === "arc").length).toBeGreaterThanOrEqual(8);
  });

  it("星位点是圆点 + 高光弧的内嵌钉", () => {
    const r = recCtx();
    paintStarPoint(r.ctx, 100, 100, 3);
    expect(r.calls.filter((c) => c === "arc").length).toBe(2);
    expect(r.calls.filter((c) => c === "stroke").length).toBe(1);
  });
});

describe("gomoku 视觉资产 · 标记与仪式", () => {
  it("漆印红点三层：投影、红点、高光", () => {
    const r = recCtx();
    paintLacquerDot(r.ctx, 10, 10, 3);
    expect(r.calls.filter((c) => c === "fill").length).toBe(3);
    const zero = recCtx();
    paintLacquerDot(zero.ctx, 10, 10, 0);
    expect(zero.calls.length).toBe(0);
  });

  it("落定波纹：半径从棋子边缘单调扩到 1.7 倍，透明度淡出到 0", () => {
    expect(rippleRadius(10, 0)).toBeCloseTo(10, 5);
    expect(rippleRadius(10, 1)).toBeCloseTo(17, 5);
    expect(rippleRadius(10, 0.5)).toBeGreaterThan(rippleRadius(10, 0.2));
    expect(rippleAlpha(0)).toBeGreaterThan(rippleAlpha(0.5));
    expect(rippleAlpha(1)).toBe(0);
    const done = recCtx();
    paintRipple(done.ctx, 0, 0, 10, 1);
    expect(done.calls.filter((c) => c === "stroke").length).toBe(0);
    const mid = recCtx();
    paintRipple(mid.ctx, 0, 0, 10, 0.4);
    expect(mid.calls.filter((c) => c === "stroke").length).toBe(1);
  });

  it("胜利星星是矢量五角星（闭合路径 + 描边），不再是字符占位", () => {
    const r = recCtx();
    paintStar(r.ctx, 0, 0, 8, 0.8);
    expect(r.calls.filter((c) => c === "lineTo").length).toBe(9);
    expect(r.calls).toContain("closePath");
    expect(r.calls).toContain("stroke");
    expect(r.calls).not.toContain("fillText");
    const hidden = recCtx();
    paintStar(hidden.ctx, 0, 0, 8, 0);
    expect(hidden.calls.length).toBe(0);
  });

  it("金色小花：五瓣 + 花心两层；reduced 下 bloomScale 恒为满开", () => {
    const r = recCtx();
    paintGoldFlower(r.ctx, 0, 0, 10, 1);
    expect(r.calls.filter((c) => c === "ellipse").length).toBe(5);
    expect(r.calls.filter((c) => c === "arc").length).toBe(2);
    expect(bloomScale(0.3, true)).toBe(1);
    expect(bloomScale(1, true)).toBe(1);
    expect(bloomScale(0, false)).toBeCloseTo(0, 5);
    expect(bloomScale(1, false)).toBeCloseTo(1, 5);
    // easeOutBack 的微回弹：中途会超过 1 一点点，落定时回到 1
    expect(bloomScale(0.75, false)).toBeGreaterThan(1);
  });
});

describe("gomoku 视觉资产 · HUD SVG 图标", () => {
  it("座位条棋子图标：黑白两枚不同，且是矢量 SVG 不是 emoji", () => {
    const black = stoneIconSVG(1, 20);
    const white = stoneIconSVG(2, 20);
    expect(black).toContain("<svg");
    expect(white).toContain("<svg");
    expect(black).not.toBe(white);
    expect(black).toContain(STONE_BLACK[2]);
    expect(white).toContain(STONE_WHITE[2]);
    expect(black).not.toMatch(/[\u2600-\u27BF\u2B50]/);
  });

  it("沙漏是矢量 SVG，尺寸跟参数走", () => {
    const svg = hourglassSVG(18);
    expect(svg).toContain("<svg");
    expect(svg).toContain('width="18"');
    expect(svg).not.toMatch(/[\u2600-\u27BF\u231B\u23F3]/);
  });
});
