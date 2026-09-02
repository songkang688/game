/**
 * 保龄球小馆 · 1.3 视觉用例(第 15 步 C 档,只增不减)。
 *
 * 八件事:配色对表、木板缝会聚(远端间距 < 近端)、瓶剪影比例、
 * 源码零 emoji fillText、倒瓶旋转时序与方向、指孔相位沿用旧白点、
 * 跟球运镜参数与 1.2 一致、destroy 归零;另附 reduced 降级与绘制不抛。
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { shade } from "../../art/kit/palette";
import { GUTTER_EDGE, LANE_LEN, LANE_W, laneProject, type LaneView } from "./logic";
import { FakeCtx, findButton, install, type Harness } from "./domStub";
import {
  BL_COLORS,
  FOLLOW_IN_MS,
  FOLLOW_OUT_MS,
  FOLLOW_ZOOM,
  HOLE_ORBIT,
  HOLE_R,
  NEON_MS,
  OIL_STREAK_MS,
  PIN_BOUNCE_MS,
  PIN_FALL_MS,
  PIN_SHAPE,
  SEAM_COUNT,
  SEAM_FAR_ALPHA,
  STRIKE_FLASH_MS,
  STRIKE_FLASH_TIMES,
  drawBall,
  drawCeilingLamp,
  drawPin,
  drawPinBadge,
  drawStar,
  fingerHoleAngle,
  neonAlpha,
  pinFallAngle,
  pinFallDir,
  seamAlphaAt,
  seamXs,
  strikeFlashOn,
  tracePin,
} from "./visual13";

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

function ctx(): CanvasRenderingContext2D {
  return new FakeCtx() as unknown as CanvasRenderingContext2D;
}

describe("保龄球 · 1.3 视觉 · 配色板对表(4.3)", () => {
  it("token 色值与规格表逐个一致,沟槽内壁 = 深 22%", () => {
    expect(BL_COLORS.blWoodA).toBe("#F7E6C8");
    expect(BL_COLORS.blWoodB).toBe("#EDD6B0");
    expect(BL_COLORS.blSeam).toBe("rgba(160,120,70,.35)");
    expect(BL_COLORS.blGutter).toBe("#D8C3A5");
    expect(BL_COLORS.blGutterWall).toBe(shade("#D8C3A5", -22));
    expect(BL_COLORS.blOil).toBe("rgba(255,255,255,.28)");
    expect(BL_COLORS.blPin).toBe("#FFFFFF");
    expect(BL_COLORS.blPinRing).toBe("#E85D75");
    expect(BL_COLORS.blGlow).toBe("#FFE2B8");
    expect(BL_COLORS.blNeonPink).toBe("#FF9FBE");
    expect(BL_COLORS.blNeonBlue).toBe("#9FD0FF");
  });
});

describe("保龄球 · 1.3 视觉 · 木板缝沿 laneProject 会聚", () => {
  const view: LaneView = { w: 360, h: 450 };

  it("缝 6–8 条,全部落在两沟之间", () => {
    const xs = seamXs(GUTTER_EDGE);
    expect(xs.length).toBeGreaterThanOrEqual(6);
    expect(xs.length).toBeLessThanOrEqual(8);
    expect(SEAM_COUNT).toBe(xs.length);
    for (const x of xs) {
      expect(x).toBeGreaterThan(GUTTER_EDGE);
      expect(x).toBeLessThan(LANE_W - GUTTER_EDGE);
    }
  });

  it("远端相邻缝间距 < 近端(和 laneProject 的会聚一致)", () => {
    const xs = seamXs(GUTTER_EDGE);
    const nearGap = laneProject(xs[1], 0, view).sx - laneProject(xs[0], 0, view).sx;
    const farGap = laneProject(xs[1], LANE_LEN, view).sx - laneProject(xs[0], LANE_LEN, view).sx;
    expect(farGap).toBeGreaterThan(0);
    expect(farGap).toBeLessThan(nearGap);
  });

  it("缝的透明度远端 ×0.5,与近端 .35 同源", () => {
    expect(seamAlphaAt(0)).toBeCloseTo(0.35, 10);
    expect(seamAlphaAt(1)).toBeCloseTo(0.35 * SEAM_FAR_ALPHA, 10);
    expect(SEAM_FAR_ALPHA).toBe(0.5);
    expect(seamAlphaAt(0.5)).toBeLessThan(seamAlphaAt(0));
  });

  it("360px 窄屏:最外侧缝在近端与远端都不出画布(band 会聚线不裁切)", () => {
    const xs = seamXs(GUTTER_EDGE);
    for (const y of [0, LANE_LEN]) {
      const left = laneProject(xs[0], y, view);
      const right = laneProject(xs[xs.length - 1], y, view);
      expect(left.sx).toBeGreaterThanOrEqual(0);
      expect(right.sx).toBeLessThanOrEqual(view.w);
    }
  });
});

describe("保龄球 · 1.3 视觉 · 瓶剪影比例(细颈宽肩)", () => {
  it("肩 0.42h@0.62h、颈 0.16h@0.82h、底 0.3h、双红颈环 0.78h/0.84h", () => {
    expect(PIN_SHAPE.shoulderW).toBe(0.42);
    expect(PIN_SHAPE.shoulderY).toBe(0.62);
    expect(PIN_SHAPE.neckW).toBe(0.16);
    expect(PIN_SHAPE.neckY).toBe(0.82);
    expect(PIN_SHAPE.baseW).toBe(0.3);
    expect(PIN_SHAPE.ringYs).toEqual([0.78, 0.84]);
    // 剪影成立的充分条件:肩最宽、颈比底还细
    expect(PIN_SHAPE.shoulderW).toBeGreaterThan(PIN_SHAPE.baseW);
    expect(PIN_SHAPE.neckW).toBeLessThan(PIN_SHAPE.baseW);
  });

  it("tracePin 真的走两段贝塞尔(每侧 2 段,共 ≥ 4 次 bezierCurveTo)", () => {
    let beziers = 0;
    const g = new FakeCtx();
    (g as unknown as Record<string, unknown>).bezierCurveTo = () => {
      beziers++;
    };
    tracePin(g as unknown as CanvasRenderingContext2D, 16);
    expect(beziers).toBeGreaterThanOrEqual(4);
  });

  it("瓶 16px 高、各瓶种、倒下中,drawPin/drawPinBadge 全都画得动不抛", () => {
    const g = ctx();
    expect(() => {
      for (const kind of ["wood", "iron", "ice", "spring", "balloon"] as const) {
        drawPin(g, { sx: 40, sy: 60, h: 16, kind });
        drawPinBadge(g, kind, 0, 0, 3);
      }
      drawPin(g, { sx: 40, sy: 60, h: 16, kind: "wood", fall: Math.PI / 4, dir: -1, alpha: 0.7 });
      drawPin(g, { sx: 0, sy: 0, h: 0, kind: "wood" });
      drawBall(g, 50, 80, 12, "#e8558f", 33, false);
      drawBall(g, 50, 80, 12, "#3f7fd6", 33, true);
      drawCeilingLamp(g, 40, 20, 9);
      drawStar(g, 5, 5, 4, "#FFD166", 0.4);
    }).not.toThrow();
  });
});

describe("保龄球 · 1.3 视觉 · 源码断言:emoji fillText 清零", () => {
  it("index.ts 不再有 fillText / pinFace,特殊瓶走自绘徽章", () => {
    expect(SRC).not.toMatch(/fillText/);
    expect(SRC).not.toMatch(/pinFace/);
    expect(SRC).toMatch(/drawPin\(/);
    expect(SRC).toMatch(/drawPinBadge|drawBall\(/);
  });

  it("球道补肉的四件套都接上了:板缝/内壁/油区拉丝/灯箱", () => {
    expect(SRC).toMatch(/seamXs\(/);
    expect(SRC).toMatch(/blGutterWall|wallFill/);
    expect(SRC).toMatch(/reflectStreak\(/);
    expect(SRC).toMatch(/drawLightbox\(/);
  });
});

describe("保龄球 · 1.3 视觉 · 倒瓶旋转", () => {
  it("250ms easeInQuad 倒到 π/2,随后 140ms 弹跳一次再躺定", () => {
    expect(PIN_FALL_MS).toBe(250);
    expect(pinFallAngle(0, false)).toBe(0);
    expect(pinFallAngle(125, false)).toBeCloseTo(0.25 * (Math.PI / 2), 10);
    expect(pinFallAngle(PIN_FALL_MS, false)).toBeCloseTo(Math.PI / 2, 10);
    // 弹跳:躺平后中途会抬起来一点,弹完回到 π/2
    const mid = pinFallAngle(PIN_FALL_MS + PIN_BOUNCE_MS / 2, false);
    expect(mid).toBeLessThan(Math.PI / 2);
    expect(pinFallAngle(PIN_FALL_MS + PIN_BOUNCE_MS, false)).toBeCloseTo(Math.PI / 2, 10);
    expect(pinFallAngle(9999, false)).toBeCloseTo(Math.PI / 2, 10);
  });

  it("方向沿受击矢量的横向分量;reduced 直接躺平", () => {
    expect(pinFallDir(3.2)).toBe(1);
    expect(pinFallDir(-0.4)).toBe(-1);
    expect(pinFallDir(0)).toBe(1);
    expect(pinFallAngle(0, true)).toBe(Math.PI / 2);
    expect(pinFallAngle(10, true)).toBe(Math.PI / 2);
  });
});

describe("保龄球 · 1.3 视觉 · 指孔公转沿用旧白点相位", () => {
  it("0 / π 两点断言:travelY=0 相位 0,travelY=3π 相位 π(旧白点 spun = y/3)", () => {
    expect(fingerHoleAngle(0, 0, false)).toBe(0);
    expect(fingerHoleAngle(3 * Math.PI, 0, false)).toBeCloseTo(Math.PI, 12);
    // 三孔相隔 2π/3(和旧的三个白点一样)
    expect(fingerHoleAngle(0, 1, false)).toBeCloseTo((Math.PI * 2) / 3, 12);
    expect(fingerHoleAngle(0, 2, false)).toBeCloseTo((Math.PI * 4) / 3, 12);
    // calm(reduced)下白点原来就冻结,指孔也冻结
    expect(fingerHoleAngle(3 * Math.PI, 0, true)).toBe(0);
    // 公转半径 / 孔径沿用旧白点的 0.42r / 0.16r
    expect(HOLE_ORBIT).toBe(0.42);
    expect(HOLE_R).toBe(0.16);
  });
});

describe("保龄球 · 1.3 视觉 · 跟球运镜与 1.2 一致(只读断言)", () => {
  it("缩放 0.14、涨 260ms、落 200ms,index 引用的就是这三枚常量", () => {
    expect(FOLLOW_ZOOM).toBe(0.14);
    expect(FOLLOW_IN_MS).toBe(260);
    expect(FOLLOW_OUT_MS).toBe(200);
    expect(SRC).toMatch(/FOLLOW_ZOOM \* follow/);
    expect(SRC).toMatch(/dt \/ FOLLOW_IN_MS/);
    expect(SRC).toMatch(/dt \/ FOLLOW_OUT_MS/);
  });
});

describe("保龄球 · 1.3 视觉 · reduced 降级", () => {
  it("霓虹常亮、全中灯箱一次长亮、倒瓶直躺;非 reduced 按时序走", () => {
    expect(neonAlpha(NEON_MS * 0.37, true)).toBe(1);
    expect(neonAlpha(NEON_MS * 0.75, false)).toBeLessThan(1);
    expect(NEON_MS).toBe(2400);
    // 闪三下:0..160 亮、160..320 灭、320..480 亮 ……
    expect(STRIKE_FLASH_TIMES).toBe(3);
    expect(STRIKE_FLASH_MS).toBe(160);
    expect(strikeFlashOn(10, false)).toBe(true);
    expect(strikeFlashOn(STRIKE_FLASH_MS + 10, false)).toBe(false);
    expect(strikeFlashOn(STRIKE_FLASH_MS * 2 + 10, false)).toBe(true);
    expect(strikeFlashOn(STRIKE_FLASH_MS * 6 + 10, false)).toBe(false);
    // reduced:同样总时长里一直亮着,不闪
    expect(strikeFlashOn(10, true)).toBe(true);
    expect(strikeFlashOn(STRIKE_FLASH_MS + 10, true)).toBe(true);
    expect(strikeFlashOn(STRIKE_FLASH_MS * 6 + 10, true)).toBe(false);
    expect(strikeFlashOn(-5, false)).toBe(false);
    expect(OIL_STREAK_MS).toBe(200);
  });
});

describe("保龄球 · 1.3 视觉 · destroy 归零", () => {
  let harness: Harness | null = null;
  afterEach(() => {
    harness?.restore();
    harness = null;
  });

  it("开一局跑几帧再 destroy:rAF、window 监听全部归零,再 destroy 一次不炸", async () => {
    const h = install();
    harness = h;
    const mod = await import("./index");
    const game = mod.mount({ root: h.root as unknown as HTMLElement, play: () => {}, addStars: () => {} } as never);
    findButton(h.root, "双人对战")?.fire("click");
    h.flush(10);
    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(0);
    expect(() => game.destroy()).not.toThrow();
  });

  it("reduced 环境整局跑起来不抛(直躺/常亮/不生成拉丝的分支真的被走到)", async () => {
    const h = install({ reduceMotion: true });
    harness = h;
    const mod = await import("./index");
    const game = mod.mount({ root: h.root as unknown as HTMLElement, play: () => {}, addStars: () => {} } as never);
    findButton(h.root, "人机对战")?.fire("click");
    expect(() => h.flush(12)).not.toThrow();
    game.destroy();
    expect(h.pendingFrames()).toBe(0);
  });
});
