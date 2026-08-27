import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeCanvas, FakeCtx2D, installCanvasDom, type DomHarness } from "../__tests__/canvasDom";
import { PIECE_COLORS } from "./pieces";
import {
  ALARM_SEC,
  CLEAR_FX_PER_ROW,
  MARK_MIN_PX,
  RAINBOW_SEC,
  RELIEF_H,
  SHOT_SEC,
  WELL_THEMES,
  WELL_WALL,
  drawCellSprite,
  drawClearFx,
  drawGarbageAlarm,
  drawRainbowEdge,
  drawRowGlow,
  drawSentStar,
  getCellSprite,
  makeClearBlossom,
  paintBlossom,
  paintCellFace,
  paintGhostCell,
  paintHoldCanvas,
  paintNextCanvas,
  paintTrophy,
  paintWallRelief,
  paintWellBackground,
  themeForLevel
} from "./art";

// ---------------------------------------------------------------------------
// 1.3 第 2 步 C · 视觉契约:方块不再是「贴了白边的色纸」,影子不再只靠 alpha,
// 消行真的开花,井有三面壁,暂存 / 下一个是画出来的。全部跑在 FakeCtx2D 替身上。
// ---------------------------------------------------------------------------

let dom: DomHarness;
beforeEach(() => {
  dom = installCanvasDom();
});
afterEach(() => dom.restore());

function ctx(): FakeCtx2D {
  return new FakeCtx2D();
}

function ops(g: FakeCtx2D, name: string): number {
  return g.ops.filter((o) => o.op === name).length;
}

describe("糖果果冻块 · 单格 ≥ 3 层且走渐变", () => {
  it("一格至少三层填充(底影/主体/高光),主体走线性渐变", () => {
    const g = ctx();
    paintCellFace(g as unknown as CanvasRenderingContext2D, 0, 0, 24, "#8FD8EA", "一");
    expect(ops(g, "fill")).toBeGreaterThanOrEqual(3);
    expect(ops(g, "createLinearGradient")).toBeGreaterThanOrEqual(1);
    // 左亮边 + 右下暗边:至少两笔描边
    expect(ops(g, "stroke")).toBeGreaterThanOrEqual(2);
  });

  it("mark 角标保留且字色随格色加深(不再是半透明黑)", () => {
    const g = ctx();
    paintCellFace(g as unknown as CanvasRenderingContext2D, 0, 0, 24, "#FF9FAE", "乙");
    const markOp = g.ops.find((o) => o.op === "fillText:乙");
    expect(markOp).toBeTruthy();
    // 迷你格(低于 MARK_MIN_PX)不画字,免得糊成一团
    const g2 = ctx();
    paintCellFace(g2 as unknown as CanvasRenderingContext2D, 0, 0, MARK_MIN_PX - 2, "#FF9FAE", "乙");
    expect(g2.ops.some((o) => o.op.startsWith("fillText"))).toBe(false);
  });

  it("七色贴图缓存:同键同引用,不同键不同引用,贴图非空白", () => {
    const cv = getCellSprite("#8FD8EA", "一", 24) as unknown as FakeCanvas;
    expect(cv).toBeTruthy();
    expect(cv.ctx.painted).toBeGreaterThan(0);
    expect(getCellSprite("#8FD8EA", "一", 24)).toBe(cv);
    expect(getCellSprite("#FFD76E", "口", 24)).not.toBe(cv);
  });

  it("drawCellSprite 在没有 drawImage 的替身上下文里退回直绘(渐变仍然发生)", () => {
    const g = ctx();
    drawCellSprite(g as unknown as CanvasRenderingContext2D, 0, 0, 24, "#9ADB82", "之");
    expect(g.painted).toBeGreaterThan(0);
    expect(ops(g, "createLinearGradient")).toBeGreaterThanOrEqual(1);
  });
});

describe("影子 · 与实体路径不同", () => {
  it("影子只描边 + 内部斜纹,一笔 fill 都没有", () => {
    const g = ctx();
    paintGhostCell(g as unknown as CanvasRenderingContext2D, 0, 0, 24, "#8FD8EA");
    expect(ops(g, "stroke")).toBeGreaterThanOrEqual(2);
    expect(ops(g, "fill")).toBe(0);
    expect(g.globalAlpha).toBe(1);
  });

  it("实体格有 fill、影子没有 —— 两条绘制路径分得开", () => {
    const solid = ctx();
    paintCellFace(solid as unknown as CanvasRenderingContext2D, 0, 0, 24, "#8FD8EA");
    const ghost = ctx();
    paintGhostCell(ghost as unknown as CanvasRenderingContext2D, 0, 0, 24, "#8FD8EA");
    expect(ops(solid, "fill")).toBeGreaterThan(0);
    expect(ops(ghost, "fill")).toBe(0);
  });
});

describe("消行 · 真的开花", () => {
  it("每行粒子 > 0 且 ≤ 10,soft 时一颗都不出", () => {
    const parts = makeClearBlossom([18, 19], 10, false);
    expect(parts.length).toBe(2 * CLEAR_FX_PER_ROW);
    expect(CLEAR_FX_PER_ROW).toBeLessThanOrEqual(10);
    for (const p of parts) {
      expect(p.col).toBeGreaterThanOrEqual(0);
      expect(p.col).toBeLessThanOrEqual(10);
      expect(p.vy).toBeLessThan(0); // 向上飘
    }
    expect(makeClearBlossom([18, 19], 10, true)).toEqual([]);
  });

  it("花与星两种形态混着出", () => {
    const parts = makeClearBlossom([19], 10, false);
    expect(parts.some((p) => p.kind === "petal")).toBe(true);
    expect(parts.some((p) => p.kind === "star")).toBe(true);
  });

  it("30% 进度前不出粒子(那会儿还在泛金光),50% 时真的画", () => {
    const parts = makeClearBlossom([19], 10, false);
    const early = ctx();
    drawClearFx(early as unknown as CanvasRenderingContext2D, parts, 0.1, 24, WELL_WALL.side, 2);
    expect(early.painted).toBe(0);
    const mid = ctx();
    drawClearFx(mid as unknown as CanvasRenderingContext2D, parts, 0.5, 24, WELL_WALL.side, 2);
    expect(mid.painted).toBeGreaterThan(0);
    expect(mid.globalAlpha).toBe(1);
  });

  it("五瓣小花:五瓣 + 花芯 + 高光,三笔以上", () => {
    const g = ctx();
    paintBlossom(g as unknown as CanvasRenderingContext2D, 10, 10, 8, "#ffb3d2", 0.5);
    expect(ops(g, "fill")).toBeGreaterThanOrEqual(3);
    expect(ops(g, "arc")).toBeGreaterThanOrEqual(7);
  });

  it("整行金光走白→金渐变;消 4 行的彩虹描边是多色多笔", () => {
    const glow = ctx();
    drawRowGlow(glow as unknown as CanvasRenderingContext2D, 6, 0, 240, 24, 0.8);
    expect(ops(glow, "createLinearGradient")).toBe(1);
    expect(ops(glow, "fillRect")).toBe(1);
    const rb = ctx();
    drawRainbowEdge(rb as unknown as CanvasRenderingContext2D, 252, 488, 0.2);
    expect(ops(rb, "stroke")).toBeGreaterThanOrEqual(4);
    expect(RAINBOW_SEC).toBeCloseTo(0.3, 5);
  });
});

describe("井与背景 · 花园积木箱", () => {
  it("四段主题:木箱→冰晶→黄昏→星夜,色值全部合法且井壁互不相同", () => {
    expect(WELL_THEMES).toHaveLength(4);
    const walls = new Set<string>();
    for (const t of WELL_THEMES) {
      for (const c of [t.innerTop, t.innerBottom, t.grid, t.wallLight, t.wallDark]) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/i);
      }
      walls.add(t.wallLight);
    }
    expect(walls.size).toBe(4);
  });

  it("188 关每 ~47 关换一段皮,越界自动夹住", () => {
    expect(themeForLevel(0).id).toBe("wood");
    expect(themeForLevel(46).id).toBe("wood");
    expect(themeForLevel(47).id).toBe("ice");
    expect(themeForLevel(100).id).toBe("dusk");
    expect(themeForLevel(187).id).toBe("night");
    expect(themeForLevel(9999).id).toBe("night");
    expect(themeForLevel(Number.NaN).id).toBe("wood");
  });

  it("井体一帧:渐变 + 网格 + 三面壁 + 螺钉,绘制非空", () => {
    const g = ctx();
    paintWellBackground(g as unknown as CanvasRenderingContext2D, 252, 488, 24, WELL_THEMES[0]);
    expect(ops(g, "createLinearGradient")).toBeGreaterThanOrEqual(1);
    // 三面井壁至少三笔 fillRect(井内底色 + 左右 + 底)
    expect(ops(g, "fillRect")).toBeGreaterThanOrEqual(4);
    // 螺钉:四颗 × 两层圆
    expect(ops(g, "arc")).toBeGreaterThanOrEqual(8);
    expect(g.painted).toBeGreaterThan(6);
  });

  it("星夜主题画星星,不画云", () => {
    const night = ctx();
    paintWellBackground(night as unknown as CanvasRenderingContext2D, 252, 488, 24, WELL_THEMES[3]);
    expect(night.painted).toBeGreaterThan(0);
    expect(WELL_THEMES[3].decor).toBe("night");
  });

  it("井壁浮雕:四主题四款小件,件件收在 6×12 内(1.3 r1 P9)", () => {
    const sigs = new Set<string>();
    for (const t of WELL_THEMES) {
      const g = ctx();
      paintWallRelief(g as unknown as CanvasRenderingContext2D, 100, 40, t);
      expect(g.painted).toBeGreaterThanOrEqual(1);
      expect(g.ops.length).toBeGreaterThanOrEqual(4);
      sigs.add(JSON.stringify(g.ops));
      for (const o of g.ops) {
        if (o.op === "moveTo" || o.op === "lineTo") {
          expect(Math.abs(o.args[0] - 100)).toBeLessThanOrEqual(3);
          expect(o.args[1]).toBeGreaterThanOrEqual(40 - 0.01);
          expect(o.args[1]).toBeLessThanOrEqual(40 + RELIEF_H + 0.01);
        } else if (o.op === "arc") {
          expect(Math.abs(o.args[0] - 100) + o.args[2]).toBeLessThanOrEqual(3.01);
          expect(o.args[1] - o.args[2]).toBeGreaterThanOrEqual(40 - 0.01);
          expect(o.args[1] + o.args[2]).toBeLessThanOrEqual(40 + RELIEF_H + 0.01);
        } else if (o.op === "fillRect") {
          expect(o.args[0]).toBeGreaterThanOrEqual(100 - 3);
          expect(o.args[0] + o.args[2]).toBeLessThanOrEqual(100 + 3);
          expect(o.args[1]).toBeGreaterThanOrEqual(40 - 0.01);
          expect(o.args[1] + o.args[3]).toBeLessThanOrEqual(40 + RELIEF_H + 0.01);
        }
      }
    }
    // 四主题四款造型,绝不共用一款
    expect(sigs.size).toBe(4);
  });

  it("浮雕上墙:左右壁各一列、纵向每 6 格一件,堆高后仍有装饰可看(1.3 r1 P9)", () => {
    // 252×488、cell 24 → 井内高 480,步长 144,起点 72 → 每壁 72/216/360 三件
    const g = ctx();
    paintWellBackground(g as unknown as CanvasRenderingContext2D, 252, 488, 24, WELL_THEMES[3]);
    // night 星窗的窗身是 4.8×12 的 fillRect,壁中线 3 / 249 → 左缘 0.6 / 246.6
    const bodies = g.ops.filter((o) => o.op === "fillRect" && o.args[2] === 4.8 && o.args[3] === RELIEF_H);
    const left = bodies.filter((o) => Math.abs(o.args[0] - 0.6) < 0.01);
    const right = bodies.filter((o) => Math.abs(o.args[0] - 246.6) < 0.01);
    expect(left).toHaveLength(3);
    expect(right).toHaveLength(3);
    expect(left.map((o) => o.args[1])).toEqual([72, 216, 360]);
    expect(right.map((o) => o.args[1])).toEqual([72, 216, 360]);
    // 浮雕全部收在井壁内(≤ WELL_WALL.side),绝不探进井内玩法区
    for (const o of bodies) {
      const x0 = o.args[0];
      const x1 = o.args[0] + o.args[2];
      const inLeftWall = x0 >= 0 && x1 <= WELL_WALL.side + 0.01;
      const inRightWall = x0 >= 252 - WELL_WALL.side - 0.01 && x1 <= 252;
      expect(inLeftWall || inRightWall).toBe(true);
    }
  });
});

describe("垃圾行警示与飞星 · 纯视觉", () => {
  it("有待落垃圾:红带 + 斜纹;alarm 推满时多一圈红光描边", () => {
    const calm = ctx();
    drawGarbageAlarm(calm as unknown as CanvasRenderingContext2D, 252, 488, 24, 2, 0);
    expect(calm.painted).toBeGreaterThan(0);
    const hot = ctx();
    drawGarbageAlarm(hot as unknown as CanvasRenderingContext2D, 252, 488, 24, 2, 1);
    expect(ops(hot, "stroke")).toBeGreaterThan(ops(calm, "stroke"));
    // 没有待落垃圾时零绘制
    const idle = ctx();
    drawGarbageAlarm(idle as unknown as CanvasRenderingContext2D, 252, 488, 24, 0, 1);
    expect(idle.painted).toBe(0);
    expect(ALARM_SEC).toBeGreaterThan(0);
  });

  it("飞星弹:t 中途在画,t ≥ 1 播完零绘制", () => {
    const mid = ctx();
    drawSentStar(mid as unknown as CanvasRenderingContext2D, 252, 0.5);
    expect(mid.painted).toBeGreaterThan(0);
    const done = ctx();
    drawSentStar(done as unknown as CanvasRenderingContext2D, 252, 1);
    expect(done.painted).toBe(0);
    expect(SHOT_SEC).toBeCloseTo(0.4, 5);
  });
});

describe("暂存 / 下一个 · 迷你画布", () => {
  it("暂存有块画块、没块画虚位,两种都非空白", () => {
    const cv = new FakeCanvas();
    cv.width = 52;
    cv.height = 34;
    paintHoldCanvas(cv as unknown as HTMLCanvasElement, "T", false);
    expect(cv.ctx.painted).toBeGreaterThan(0);
    const empty = new FakeCanvas();
    empty.width = 52;
    empty.height = 34;
    paintHoldCanvas(empty as unknown as HTMLCanvasElement, null, false);
    expect(empty.ctx.painted).toBeGreaterThan(0);
  });

  it("本回合已换过:灰罩 + 锁图标叠在块上面", () => {
    const open = new FakeCanvas();
    open.width = 52;
    open.height = 34;
    paintHoldCanvas(open as unknown as HTMLCanvasElement, "T", false);
    const locked = new FakeCanvas();
    locked.width = 52;
    locked.height = 34;
    paintHoldCanvas(locked as unknown as HTMLCanvasElement, "T", true);
    expect(locked.ctx.painted).toBeGreaterThan(open.ctx.painted);
    expect(locked.ctx.ops.filter((o) => o.op === "fillRect").length).toBeGreaterThan(0);
  });

  it("下一个队列:三个块三个真形状,分隔线隔开", () => {
    const cv = new FakeCanvas();
    cv.width = 52;
    cv.height = 90;
    paintNextCanvas(cv as unknown as HTMLCanvasElement, ["I", "O", "T"]);
    expect(cv.ctx.painted).toBeGreaterThan(0);
    // I(4 格)+ O(4 格)+ T(4 格)≥ 12 个果冻格,每格至少 3 层 fill
    expect(cv.ctx.ops.filter((o) => o.op === "fill").length).toBeGreaterThanOrEqual(12);
  });

  it("七种块的迷你色和场上一致(直接引用 PIECE_COLORS)", () => {
    expect(Object.keys(PIECE_COLORS)).toHaveLength(7);
    expect(new Set(Object.values(PIECE_COLORS)).size).toBe(7);
  });
});

describe("结算奖杯", () => {
  it("金杯银杯都画得出来且非空", () => {
    const gold = ctx();
    paintTrophy(gold as unknown as CanvasRenderingContext2D, 60, 46, 36, true);
    expect(gold.painted).toBeGreaterThan(4);
    const silver = ctx();
    paintTrophy(silver as unknown as CanvasRenderingContext2D, 60, 46, 36, false);
    expect(silver.painted).toBeGreaterThan(4);
  });
});
