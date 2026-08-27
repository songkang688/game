/**
 * 碰碰车大乱斗 · 1.3 视觉用例(第 15 步 C 档,只增不减)。
 *
 * 八件事:配色对表、三层车绘制不抛、源码零 emoji fillText、squash 只动绘制、
 * 蓄力流光映射与 1.2 蓄力环逐点一致、降落伞只读复活时序、reduced 降级、destroy 归零。
 * 跑在 node 环境,画笔用 domStub 的 FakeCtx,不需要真 canvas。
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { shade } from "../../art/kit/palette";
import { CHARGE_MS, RESPAWN_MS, chargeRatio } from "./logic";
import { FakeCtx, findButton, install, type Harness } from "./domStub";
import {
  BC_COLORS,
  BUMP_STAR_COUNT,
  FLOW_MS,
  LAMP_MS,
  PARACHUTE_MS,
  SQUASH_AMOUNT,
  SQUASH_MS,
  chargeFlowArc,
  drawBarrel,
  drawBumperCar,
  drawChargeTrack,
  drawDizzyStars,
  drawFloorGlow,
  drawLampPost,
  drawParachuteCar,
  drawSoapSlick,
  drawStar,
  drawSweat,
  drawTurntable,
  flagSwing,
  flowPhase,
  lampOn,
  padFlow,
  parachuteProgress,
  squashAmount,
} from "./visual13";

function ctx(): CanvasRenderingContext2D {
  return new FakeCtx() as unknown as CanvasRenderingContext2D;
}

const SRC = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("碰碰车 · 1.3 视觉 · 配色板对表(3.3)", () => {
  it("token 色值与规格表逐个一致,立面 = shade(bcRail, -22)", () => {
    expect(BC_COLORS.bcFloor).toBe("#F3E8F8");
    expect(BC_COLORS.bcRail).toBe("#E5B8D0");
    expect(BC_COLORS.bcRailSide).toBe(shade("#E5B8D0", -22));
    expect(BC_COLORS.bcIceEdge).toBe("#CDEBFF");
    expect(BC_COLORS.bcBumper).toBe("#5A4A66");
    expect(BC_COLORS.bcPink).toBe("#F4859F");
    expect(BC_COLORS.bcBlue).toBe("#7FB2F0");
    expect(BC_COLORS.bcShadow).toBe("rgba(90,74,102,.16)");
  });

  it("十六进制 token 全部合法(#RRGGBB)", () => {
    for (const [key, value] of Object.entries(BC_COLORS)) {
      if (key === "bcShadow") continue;
      expect(value, `${key} 不是合法十六进制`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("碰碰车 · 1.3 视觉 · 三层车与道具绘制分支", () => {
  it("三层车(橡胶圈/车壳/座舱司机)双阵营、缩到最小、蓄满、squash 中,全都画得动不抛", () => {
    const g = ctx();
    expect(() => {
      drawBumperCar(g, { x: 30, y: 30, r: 4.2, face: 0.4, color: BC_COLORS.bcPink, team: 0 });
      drawBumperCar(g, { x: 30, y: 30, r: 4.2, face: -1.2, color: BC_COLORS.bcBlue, team: 1, charge: 1 });
      // 缩到 car.r 最小档也不抛:发饰 + 车色双通道仍在画
      drawBumperCar(g, { x: 8, y: 8, r: 2, face: 0, color: "#8f7ae0", team: 1, squash: SQUASH_AMOUNT, swing: 0.3 });
      drawBumperCar(g, { x: 0, y: 0, r: 0, face: 0, color: "#000", team: 0 });
    }).not.toThrow();
  });

  it("道具(肥皂渍/木纹滚筒/唱片转盘)与场地件(反射斑/灯柱/星星/汗珠/晕星)可调用不抛", () => {
    const g = ctx();
    expect(() => {
      drawSoapSlick(g, 20, 20, 6);
      drawBarrel(g, 40, 20, 5);
      drawTurntable(g, 60, 30, 9, 1.2);
      drawTurntable(g, 60, 30, 9, 0);
      drawFloorGlow(g, 50, 40, 20);
      drawLampPost(g, 4, 4, 2.4, true);
      drawLampPost(g, 4, 4, 2.4, false);
      drawStar(g, 10, 10, 2, "#FFD166", 0.5);
      drawSweat(g, 12, 12, 4.2);
      drawDizzyStars(g, 12, 12, 4.2, 500, false);
      drawDizzyStars(g, 12, 12, 4.2, 500, true);
      drawChargeTrack(g, 10, 10, 4.2, 0.5, 1.1, false);
      drawParachuteCar(g, 20, 20, 4.2, "#F4859F", 0, 0.4, false);
      drawParachuteCar(g, 20, 20, 4.2, "#7FB2F0", 1, 0.9, true);
    }).not.toThrow();
  });
});

describe("碰碰车 · 1.3 视觉 · 源码断言:emoji 素材清零", () => {
  it("index.ts 不再有 emojiAt / fillText 画布出口,💧🛢️🧹💫 直出全部退场", () => {
    expect(SRC).not.toMatch(/emojiAt/);
    expect(SRC).not.toMatch(/fillText/);
    expect(SRC).not.toContain("💧");
    expect(SRC).not.toContain("🛢️");
    expect(SRC).not.toContain("🧹");
    expect(SRC).not.toContain("💫");
  });

  it("车绘制走 drawBumperCar,道具走肥皂渍/滚筒/转盘,复活走降落伞", () => {
    expect(SRC).toMatch(/drawBumperCar\(/);
    expect(SRC).toMatch(/drawSoapSlick\(/);
    expect(SRC).toMatch(/drawBarrel\(/);
    expect(SRC).toMatch(/drawTurntable\(/);
    expect(SRC).toMatch(/drawParachuteCar\(/);
  });
});

describe("碰碰车 · 1.3 视觉 · squash 只影响绘制", () => {
  it("drawBumperCar 画完,car 的 x/y/r/face 一个都没被写", () => {
    const car = { x: 33.3, y: 44.4, r: 4.2, face: 0.7, color: "#F4859F", team: 0, squash: SQUASH_AMOUNT, charge: 0.6 };
    drawBumperCar(ctx(), car);
    expect(car.x).toBe(33.3);
    expect(car.y).toBe(44.4);
    expect(car.r).toBe(4.2);
    expect(car.face).toBe(0.7);
  });

  it("squashAmount:t=0 压满 12%,80ms 回弹到 0,超时恒 0,纯函数同进同出", () => {
    expect(squashAmount(0, false)).toBeCloseTo(SQUASH_AMOUNT, 10);
    expect(squashAmount(SQUASH_MS, false)).toBe(0);
    expect(squashAmount(SQUASH_MS + 500, false)).toBe(0);
    expect(squashAmount(-1, false)).toBe(0);
    expect(squashAmount(40, false)).toBe(squashAmount(40, false));
    expect(SQUASH_MS).toBe(80);
    expect(SQUASH_AMOUNT).toBe(0.12);
  });
});

describe("碰碰车 · 1.3 视觉 · 蓄力流光映射与 1.2 蓄力环逐点一致", () => {
  it("0 / 0.5 / 1 三点:起点恒 -π/2,终点 = -π/2 + ratio × 2π", () => {
    for (const ratio of [0, 0.5, 1]) {
      const arc = chargeFlowArc(ratio);
      expect(arc.from).toBeCloseTo(-Math.PI / 2, 12);
      expect(arc.to).toBeCloseTo(-Math.PI / 2 + ratio * Math.PI * 2, 12);
    }
  });

  it("喂真实蓄力毫秒:chargeRatio 原样进映射,一个数都不另算", () => {
    expect(chargeFlowArc(chargeRatio(0)).to).toBeCloseTo(-Math.PI / 2, 12);
    expect(chargeFlowArc(chargeRatio(CHARGE_MS / 2)).to).toBeCloseTo(-Math.PI / 2 + Math.PI, 12);
    expect(chargeFlowArc(chargeRatio(CHARGE_MS)).to).toBeCloseTo(-Math.PI / 2 + Math.PI * 2, 12);
    expect(chargeFlowArc(chargeRatio(CHARGE_MS * 9)).to).toBeCloseTo(-Math.PI / 2 + Math.PI * 2, 12);
  });
});

describe("碰碰车 · 1.3 视觉 · 出局降落伞只读既有复活时序", () => {
  it("PARACHUTE_MS 就是 logic 的 RESPAWN_MS,进度 0→1 跟着倒计时走", () => {
    expect(PARACHUTE_MS).toBe(RESPAWN_MS);
    expect(parachuteProgress(RESPAWN_MS)).toBe(0);
    expect(parachuteProgress(RESPAWN_MS / 2)).toBeCloseTo(0.5, 10);
    expect(parachuteProgress(0)).toBe(1);
    expect(parachuteProgress(-50)).toBe(1);
  });
});

describe("碰碰车 · 1.3 视觉 · reduced 降级", () => {
  it("squash 关闭、灯串常亮、流光/加速带流光变静态、小旗静止", () => {
    expect(squashAmount(10, true)).toBe(0);
    expect(squashAmount(10, false)).toBeGreaterThan(0);
    for (const i of [0, 1, 2, 5]) {
      expect(lampOn(i, 0, true)).toBe(true);
      expect(lampOn(i, LAMP_MS * 3.5, true)).toBe(true);
    }
    expect(flowPhase(FLOW_MS * 0.37, true)).toBe(0);
    expect(padFlow(500, true)).toBe(0);
    expect(flagSwing(0.5, true)).toBe(0);
  });

  it("非 reduced:灯串 900ms 走一步奇偶交替,流光相位在 0..2π 里转", () => {
    expect(LAMP_MS).toBe(900);
    expect(lampOn(0, 0, false)).toBe(true);
    expect(lampOn(1, 0, false)).toBe(false);
    expect(lampOn(0, LAMP_MS, false)).toBe(false);
    expect(lampOn(1, LAMP_MS, false)).toBe(true);
    const p = flowPhase(FLOW_MS * 0.25, false);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(Math.PI * 2);
    expect(BUMP_STAR_COUNT).toBe(4);
  });
});

describe("碰碰车 · 1.3 视觉 · destroy 归零", () => {
  let harness: Harness | null = null;
  afterEach(() => {
    harness?.restore();
    harness = null;
  });

  it("开一局跑几帧再 destroy:rAF、window 监听、节点全部归零(粒子随对局一起清)", async () => {
    const h = install();
    harness = h;
    const mod = await import("./index");
    const game = mod.mount({ root: h.root as unknown as HTMLElement, play: () => {}, addStars: () => {} } as never);
    findButton(h.root, "双人对战")?.fire("click");
    h.flush(10);
    game.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(0);
    expect(h.pendingTimers()).toBe(0);
    expect(() => game.destroy()).not.toThrow();
  });

  it("reduced 环境整局跑起来也不抛(灯串常亮/流光静态的分支真的被走到)", async () => {
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
