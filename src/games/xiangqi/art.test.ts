// 1.3 视觉资产契约：棋子的层数与阴刻、14 种 sprite 缓存、棋盘装饰、
// 演出小件（花瓣 / 金环 / 印章）与动画纯公式逐条锁死 —— 改版前后同输入同输出。
import { beforeEach, describe, expect, it } from "vitest";
import { El, ctx2d, ctxCalls } from "./domStub";
import { PIECE_NAME, type PieceType, type Side } from "./logic";
import {
  ANIM_TOTAL_MS,
  BLACK_INK,
  CAPTURE_GOLD,
  CAPTURE_MS,
  CHECK_GLOW_MS,
  COMPASS_ORANGE,
  ENGRAVE_MIN_PX,
  FRAME_GOLD,
  FRAME_PX,
  LAND_MS,
  MOVE_MS,
  PETAL_MS,
  PETAL_PINK,
  PIECE_FACE,
  PIECE_WALL,
  POS_MARK,
  RED_INK,
  RIPPLE_MS,
  RIVER_WAVE,
  SEAL_MS,
  SEAL_RED,
  WIN_JUMP_MS,
  captureScale,
  captureSpin,
  checkGlowAlpha,
  landScaleAt,
  paintBoardFrame,
  paintCompassMark,
  paintGoldRing,
  paintPetal,
  paintPiece,
  paintPieceBody,
  paintPositionMark,
  paintRipple,
  paintRiverWaves,
  paintSeal,
  pieceIconSVG,
  pieceSprite,
  resetPieceSprites,
  rippleAlpha,
  rippleRadius,
  slideEase,
  winJumpOffset,
} from "./art";

type Ctx = CanvasRenderingContext2D;
const ctx = ctx2d as Ctx;

const SIDES: Side[] = ["red", "black"];
const TYPES: PieceType[] = ["K", "A", "E", "H", "R", "C", "P"];

beforeEach(() => {
  ctxCalls.length = 0;
  resetPieceSprites();
});

function count(m: string): number {
  return ctxCalls.filter((c) => c.m === m).length;
}

function setValues(prop: string): string[] {
  return ctxCalls.filter((c) => c.m === `set:${prop}`).map((c) => String(c.a[0]));
}

describe("调色板契约", () => {
  it("关键色值都是合法 #rrggbb", () => {
    for (const c of [RED_INK, BLACK_INK, PIECE_FACE, PIECE_WALL, FRAME_GOLD, SEAL_RED, PETAL_PINK]) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("侧壁色确实比面色深（三通道都低，才有月牙厚度感）", () => {
    const rgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const face = rgb(PIECE_FACE);
    const wall = rgb(PIECE_WALL);
    for (let i = 0; i < 3; i++) expect(wall[i]).toBeLessThan(face[i]);
  });
});

describe("木刻棋子：影 / 侧壁 / 面 / 字 ≥ 4 层", () => {
  it("一颗整子至少 4 层：3 次 fill（影、侧壁、面）+ 1 次刻字，面走径向渐变", () => {
    paintPiece(ctx, 100, 100, 20, "red", "K");
    expect(count("fill")).toBeGreaterThanOrEqual(3);
    expect(count("fillText")).toBeGreaterThanOrEqual(1);
    expect(count("createRadialGradient")).toBe(1);
  });

  it("侧壁层真的用了加深的侧壁色", () => {
    paintPiece(ctx, 100, 100, 20, "black", "R");
    expect(setValues("fillStyle")).toContain(PIECE_WALL);
  });

  it("双圈线保留，外圈加了高光弧（stroke ≥ 4：侧壁沿/外圈/内圈/高光）", () => {
    paintPiece(ctx, 100, 100, 20, "red", "H");
    expect(count("stroke")).toBeGreaterThanOrEqual(4);
  });

  it("阴刻三笔：浅色错位 + 本字 + 同色深描边（棋子 ≥ 30px 时）", () => {
    paintPiece(ctx, 0, 0, 20, "red", "K");
    expect(count("fillText")).toBe(2);
    expect(count("strokeText")).toBe(1);
  });

  it("棋子 < 30px 自动去描边保字（只剩一笔本字）", () => {
    expect(ENGRAVE_MIN_PX).toBe(30);
    paintPiece(ctx, 0, 0, 13, "red", "K");
    expect(count("fillText")).toBe(1);
    expect(count("strokeText")).toBe(0);
  });

  it("14 种棋子的（字形 × 墨色）互不相同 —— 色弱也分得清", () => {
    const seen = new Set<string>();
    for (const side of SIDES) {
      for (const type of TYPES) {
        ctxCalls.length = 0;
        paintPieceBody(ctx, 0, 0, 20, side, type);
        let style = "";
        let pair = "";
        for (const c of ctxCalls) {
          if (c.m === "set:fillStyle") style = String(c.a[0]);
          if (c.m === "fillText" && (style === RED_INK || style === BLACK_INK)) pair = `${style}|${String(c.a[0])}`;
        }
        expect(pair, `${side}${type} 没刻上正字`).toContain(PIECE_NAME[side][type]);
        seen.add(pair);
      }
    }
    expect(seen.size).toBe(14);
  });
});

describe("14 种 sprite 预渲染缓存", () => {
  const doc = { createElement: (tag: string) => new El(tag) };

  it("2 方 × 7 种 = 14 张 sprite，互不相同", () => {
    const seen = new Set<unknown>();
    for (const side of SIDES) {
      for (const type of TYPES) {
        const s = pieceSprite(doc, side, type, 20);
        expect(s, `${side}${type} sprite 建不出来`).not.toBeNull();
        expect(s!.span).toBeGreaterThan(0);
        seen.add(s!.canvas);
      }
    }
    expect(seen.size).toBe(14);
  });

  it("同一 (side, type, r) 复用同一张，不重复渲染", () => {
    const a = pieceSprite(doc, "red", "K", 20);
    const b = pieceSprite(doc, "red", "K", 20);
    expect(a).toBe(b);
  });

  it("半径变了整套重建（尺寸变化重建）", () => {
    const a = pieceSprite(doc, "red", "K", 20);
    const b = pieceSprite(doc, "red", "K", 22);
    expect(b).not.toBe(a);
    expect(b!.span).toBeGreaterThan(a!.span);
  });
});

describe("棋盘装饰绘制", () => {
  it("双层木框：4 条深木边 + 1 圈金线 + 四角如意云头（每角 3 弧）", () => {
    expect(FRAME_PX).toBe(8);
    paintBoardFrame(ctx, 440, 484);
    expect(count("fillRect")).toBe(4);
    expect(count("strokeRect")).toBe(1);
    expect(count("arc")).toBe(12);
    expect(setValues("strokeStyle")).toContain(FRAME_GOLD);
  });

  it("楚河汉界水波：两道极淡曲线（quadraticCurveTo × 16）", () => {
    paintRiverWaves(ctx, 24, 376, 220);
    expect(count("quadraticCurveTo")).toBe(16);
    expect(setValues("strokeStyle")).toContain(RIVER_WAVE);
  });

  it("位点十字角标：盘中 4 个象限、贴边只画朝内的一半", () => {
    paintPositionMark(ctx, 100, 100);
    const mid = count("moveTo");
    expect(mid).toBe(4);
    ctxCalls.length = 0;
    paintPositionMark(ctx, 24, 100, false, true);
    expect(count("moveTo")).toBe(2);
    expect(setValues("strokeStyle")).toContain(POS_MARK);
  });

  it("最后一手罗盘印记：细圈 + 四根短线", () => {
    paintCompassMark(ctx, 100, 100, 24, 0.9);
    expect(count("arc")).toBe(1);
    expect(count("moveTo")).toBe(4);
    expect(count("lineTo")).toBe(4);
    expect(setValues("strokeStyle").some((v) => v.startsWith(COMPASS_ORANGE))).toBe(true);
  });
});

describe("演出小件：花瓣 / 金环 / 波纹 / 印章", () => {
  it("花瓣是粉色椭圆（花瓣退场的全仓统一口径）", () => {
    paintPetal(ctx, 0, 0, 7, 0.5, 1);
    expect(setValues("fillStyle")).toContain(PETAL_PINK);
    expect(count("ellipse")).toBe(2);
  });

  it("金环随进度扩散淡出，散完一笔都不画", () => {
    paintGoldRing(ctx, 0, 0, 22, 0.3);
    expect(setValues("strokeStyle").some((v) => v.startsWith(`rgba(${CAPTURE_GOLD}`))).toBe(true);
    ctxCalls.length = 0;
    paintGoldRing(ctx, 0, 0, 22, 1);
    expect(count("stroke")).toBe(0);
  });

  it("波纹从棋子边缘扩到 1.65 倍后淡没", () => {
    expect(rippleRadius(20, 0)).toBeCloseTo(20, 6);
    expect(rippleRadius(20, 1)).toBeCloseTo(33, 6);
    expect(rippleAlpha(0)).toBeCloseTo(0.5, 6);
    expect(rippleAlpha(1)).toBe(0);
    ctxCalls.length = 0;
    paintRipple(ctx, 0, 0, 20, 1);
    expect(count("stroke")).toBe(0);
  });

  it("印章盖字，盖到一半有 2 粒微尘、盖定后微尘收走", () => {
    paintSeal(ctx, 0, 0, 84, 0.5, "胜");
    expect(ctxCalls.some((c) => c.m === "fillText" && c.a[0] === "胜")).toBe(true);
    expect(count("arc")).toBe(2);
    ctxCalls.length = 0;
    paintSeal(ctx, 0, 0, 84, 1, "妙手");
    expect(ctxCalls.some((c) => c.m === "fillText" && c.a[0] === "妙手")).toBe(true);
    expect(count("arc")).toBe(0);
  });
});

describe("动画纯公式回归（同输入同输出）", () => {
  it("走子三段的时长契约：滑动 160ms、落定 140ms、吃子 250ms", () => {
    expect(MOVE_MS).toBe(160);
    expect(LAND_MS).toBe(140);
    expect(CAPTURE_MS).toBe(250);
    expect(ANIM_TOTAL_MS).toBeGreaterThanOrEqual(MOVE_MS + LAND_MS);
    expect(ANIM_TOTAL_MS).toBeGreaterThanOrEqual(CAPTURE_MS);
    expect(ANIM_TOTAL_MS).toBeGreaterThanOrEqual(PETAL_MS);
    expect(ANIM_TOTAL_MS).toBeGreaterThanOrEqual(MOVE_MS + RIPPLE_MS);
  });

  it("slideEase：easeOut 两端锁死、中段先快后慢", () => {
    expect(slideEase(0)).toBe(0);
    expect(slideEase(1)).toBe(1);
    expect(slideEase(0.5)).toBeCloseTo(0.75, 8);
    expect(slideEase(-1)).toBe(0);
    expect(slideEase(2)).toBe(1);
  });

  it("落定回弹 1.08 → 1", () => {
    expect(landScaleAt(0)).toBeCloseTo(1.08, 8);
    expect(landScaleAt(1)).toBe(1);
    expect(landScaleAt(0.5)).toBeGreaterThan(1);
  });

  it("被吃方缩小旋出：1→0 缩、越转越开", () => {
    expect(captureScale(0)).toBe(1);
    expect(captureScale(1)).toBe(0);
    expect(captureSpin(0)).toBe(0);
    expect(captureSpin(1)).toBeCloseTo(1.8, 8);
  });

  it("将军红光 800ms 内呼吸两次，之后与 reduced 一样转静态", () => {
    expect(CHECK_GLOW_MS).toBe(800);
    expect(checkGlowAlpha(200, false)).toBeCloseTo(0.9, 6);
    expect(checkGlowAlpha(400, false)).toBeCloseTo(0.35, 6);
    expect(checkGlowAlpha(600, false)).toBeCloseTo(0.9, 6);
    expect(checkGlowAlpha(900, false)).toBe(0.85);
    for (const t of [0, 100, 300, 500, 999]) expect(checkGlowAlpha(t, true)).toBe(0.85);
  });

  it("胜方将帅跳两下：900ms 两个波峰，reduced 不跳", () => {
    expect(winJumpOffset(225, false)).toBeCloseTo(7, 6);
    expect(winJumpOffset(450, false)).toBeCloseTo(0, 6);
    expect(winJumpOffset(675, false)).toBeCloseTo(7, 6);
    expect(winJumpOffset(WIN_JUMP_MS, false)).toBe(0);
    expect(winJumpOffset(225, true)).toBe(0);
  });

  it("印章盖下 400ms", () => {
    expect(SEAL_MS).toBe(400);
  });
});

describe("HUD 小棋子图标（SVG，替掉字符占位）", () => {
  it("红帅黑将各成一格：字形与墨色都不同", () => {
    const red = pieceIconSVG("red", "K", 18);
    const black = pieceIconSVG("black", "K", 18);
    expect(red).toContain("帅");
    expect(red).toContain(RED_INK);
    expect(black).toContain("将");
    expect(black).toContain(BLACK_INK);
    expect(red).not.toBe(black);
  });

  it("图标有投影 + 侧壁 + 面三层，尺寸跟传入走", () => {
    const svg = pieceIconSVG("red", "P", 15);
    expect(svg).toContain('width="15"');
    expect(svg).toContain(PIECE_WALL);
    expect(svg).toContain(PIECE_FACE);
    expect(svg).toContain("ellipse");
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).toContain("兵");
  });
});
