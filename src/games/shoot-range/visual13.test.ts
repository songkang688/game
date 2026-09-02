/**
 * 星星射击场 1.3 · 视觉升级用例（第 14 步 A 档,只增不减）。
 *
 * 管三件事:
 * 1. 皮肤规格照章办事——配色板 token、三停渐变、木框分段、落影参数、动效时序表;
 * 2. 「只动皮肤不动骨头」——散布 / 护盾 / 离场这些玩法口径只读不改;
 * 3. reduced-motion 与 destroy 的收尾干净——粒子不生成、rAF 与监听归零。
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameApi } from "../level99";
import { FakeCtx, install, type Harness } from "./domStub";
import {
  BREATH_MS,
  BREATH_AMP,
  COMBO_RING_MS,
  FOUL_PETALS,
  HIT_RIBBONS,
  HIT_SPARKLES,
  LEAVE_BREATH_MAX,
  LEAVE_BREATH_MIN,
  LEAVE_FLASH_HZ,
  MIN_DRAW_RADIUS,
  PETAL_FALL_MS,
  RAINBOW_SPIN_MS,
  RIBBON_FALL_MS,
  SHR_LAYERS,
  SHR_PALETTE,
  SPARKLE_BURST_MS,
  TARGET_SHADOW_DY,
  TARGET_SHADOW_RX,
  TARGET_SHADOW_RY,
  TENT_MAX_VIEW_RATIO,
  WOOD_FRAME_PHASE,
  WOOD_FRAME_SEGMENTS,
  breathScale,
  clawOpenAngle,
  hitParticleBudget,
  leaveBreathScale,
  rainbowPhase,
  shieldCrackStage,
  tentRatio,
} from "./visual13";
import { drawCrosshairSkin, drawLauncherSkin, drawTargetSkin } from "./paint13";
import { SPREAD_MAX, SPREAD_PER_SHOT, SPREAD_RECOVER_PER_S } from "./feel12";
import { makeTarget, type Target, type TargetKind } from "./logic";
import { makeTarget12 } from "./targets12";
import { mount } from "./index";

// ---------------------------------------------------------------------------
// 记录式 2d 桩(在 domStub.FakeCtx 之上记参数)
// ---------------------------------------------------------------------------

interface Rec {
  ctx: CanvasRenderingContext2D;
  ellipses: number[][];
  arcs: number[][];
  radials: number[][];
  stops: number[][];
  fillStyles: unknown[];
  fillTexts: string[];
}

function recCtx(): Rec {
  const rec: Rec = {
    ctx: null as unknown as CanvasRenderingContext2D,
    ellipses: [],
    arcs: [],
    radials: [],
    stops: [],
    fillStyles: [],
    fillTexts: [],
  };
  const base = new FakeCtx() as unknown as Record<string, unknown>;
  base.ellipse = (...args: number[]) => void rec.ellipses.push(args);
  base.arc = (...args: number[]) => void rec.arcs.push(args);
  base.fill = function (this: { fillStyle: unknown }) {
    rec.fillStyles.push(this.fillStyle);
  };
  base.fillText = (text: string) => void rec.fillTexts.push(text);
  base.createRadialGradient = (...args: number[]) => {
    rec.radials.push(args);
    const mine: number[] = [];
    rec.stops.push(mine);
    return { addColorStop: (off: number) => void mine.push(off) };
  };
  rec.ctx = base as unknown as CanvasRenderingContext2D;
  return rec;
}

const KINDS: TargetKind[] = [
  "bull",
  "balloon",
  "ufo",
  "robot",
  "number",
  "friend",
  "split",
  "shield",
  "rainbow",
  "flower",
];

describe("shoot-range 1.3 · 配色板与图层序", () => {
  it("shr token 全部是合法 hex / rgba,且与规格表逐字一致", () => {
    expect(SHR_PALETTE).toEqual({
      shrSky: "#FFE9F2",
      shrTent: "#F4859F",
      shrWood: "#C89B6C",
      shrWoodDark: "#A87B4F",
      shrRing: "#FF9FBE",
      shrGold: "#FFD678",
      shrShadow: "rgba(93,64,55,.18)",
    });
    for (const v of Object.values(SHR_PALETTE)) {
      expect(v).toMatch(/^(#[0-9A-Fa-f]{6}|rgba\(\d+,\d+,\d+,\.?\d+\))$/);
    }
  });

  it("图层序七层从底到顶,帐篷高度压在 22% 视口红线内", () => {
    expect([...SHR_LAYERS]).toEqual([
      "tent",
      "bunting",
      "beam+far",
      "counter+near",
      "shots+particles",
      "crosshair",
      "hud",
    ]);
    expect(TENT_MAX_VIEW_RATIO).toBe(0.22);
    expect(tentRatio()).toBeLessThanOrEqual(TENT_MAX_VIEW_RATIO);
  });

  it("动效时序表毫秒写死成常量:1200/300/420/480/6000/260", () => {
    expect(BREATH_MS).toBe(1200);
    expect(BREATH_AMP).toBe(0.06);
    expect(SPARKLE_BURST_MS).toBe(300);
    expect(RIBBON_FALL_MS).toBe(420);
    expect(PETAL_FALL_MS).toBe(480);
    expect(RAINBOW_SPIN_MS).toBe(6000);
    expect(COMBO_RING_MS).toBe(260);
  });
});

describe("shoot-range 1.3 · 靶子七道工序", () => {
  it("落影参数:rx=0.8r、ry=0.24r、圆心 0.92r、色 shrShadow", () => {
    expect(TARGET_SHADOW_DY).toBe(0.92);
    expect(TARGET_SHADOW_RX).toBe(0.8);
    expect(TARGET_SHADOW_RY).toBe(0.24);
    const rec = recCtx();
    const t = makeTarget(1, "bull", 100, 300, 40);
    drawTargetSkin(rec.ctx, t, 0, false, false);
    const [x, y, rx, ry] = rec.ellipses[0];
    expect(x).toBe(0);
    expect(y).toBeCloseTo(40 * 0.92, 5);
    expect(rx).toBeCloseTo(40 * 0.8, 5);
    expect(ry).toBeCloseTo(40 * 0.24, 5);
    expect(rec.fillStyles).toContain(SHR_PALETTE.shrShadow);
  });

  it("三停渐变停靠点 0/0.55/1,高光圆心偏 (-0.35r,-0.4r)", () => {
    const rec = recCtx();
    drawTargetSkin(rec.ctx, makeTarget(1, "bull", 100, 300, 40), 0, false, false);
    expect(rec.radials.length).toBeGreaterThan(0);
    const [hx, hy, inner, cx, cy, outer] = rec.radials[0];
    expect(outer).toBeCloseTo(40, 5);
    expect(hx).toBeCloseTo(-0.35 * 40, 5);
    expect(hy).toBeCloseTo(-0.4 * 40, 5);
    expect(inner).toBeCloseTo(40 * 0.08, 5);
    expect([cx, cy]).toEqual([0, 0]);
    for (const stops of rec.stops) expect(stops).toEqual([0, 0.55, 1]);
  });

  it("木框双色相间 8 段,接缝相位错开 22.5°", () => {
    expect(WOOD_FRAME_SEGMENTS).toBe(8);
    expect(WOOD_FRAME_PHASE).toBeCloseTo((22.5 * Math.PI) / 180, 10);
    const rec = recCtx();
    drawTargetSkin(rec.ctx, makeTarget(1, "bull", 100, 300, 40), 0, false, false);
    const frameArcs = rec.arcs.filter(([, , r]) => Math.abs(r - 40 * 1.04) < 1e-6);
    expect(frameArcs.length).toBe(WOOD_FRAME_SEGMENTS);
    expect(frameArcs[0][3]).toBeCloseTo(WOOD_FRAME_PHASE, 10);
  });

  it("全部十种靶(含四种 1.2 靶)在 2D 桩下可绘制不抛,缩到最小绘制半径 14 也一样", () => {
    expect(MIN_DRAW_RADIUS).toBe(14);
    for (const kind of KINDS) {
      for (const r of [MIN_DRAW_RADIUS, 44]) {
        const t = makeTarget12(7, kind, 300, 300, r);
        expect(() => drawTargetSkin(recCtx().ctx, t, 1.2, false, false)).not.toThrow();
        expect(() => drawTargetSkin(recCtx().ctx, t, 1.2, true, true)).not.toThrow();
      }
    }
  });

  it("护盾裂纹阶段随剩余护盾切换,读值不改值", () => {
    expect(shieldCrackStage(2)).toBe("intact");
    expect(shieldCrackStage(1)).toBe("cracked");
    expect(shieldCrackStage(undefined)).toBe("intact");
    const t = makeTarget12(3, "shield", 300, 300, 40);
    const before = JSON.stringify(t);
    drawTargetSkin(recCtx().ctx, t, 0.5, false, false);
    drawTargetSkin(recCtx().ctx, { ...t, hp: 1 }, 0.5, false, false);
    expect(JSON.stringify(t)).toBe(before);
  });

  it("离场闪烁频率与 1.2 的 sin(now*8) 一致,呼吸缩放 0.9→1.0 封顶不越界", () => {
    expect(LEAVE_FLASH_HZ).toBe(8);
    expect(LEAVE_BREATH_MIN).toBe(0.9);
    expect(LEAVE_BREATH_MAX).toBe(1.0);
    let top = 0;
    for (let ms = 0; ms < 4000; ms += 16) {
      const s = leaveBreathScale(ms / 1000, false);
      expect(s).toBeGreaterThanOrEqual(LEAVE_BREATH_MIN - 1e-9);
      expect(s).toBeLessThanOrEqual(LEAVE_BREATH_MAX + 1e-9);
      top = Math.max(top, s);
    }
    expect(top).toBeCloseTo(LEAVE_BREATH_MAX, 2);
    // reduced 只留闪烁不缩放
    expect(leaveBreathScale(0.37, true)).toBe(LEAVE_BREATH_MAX);
  });
});

describe("shoot-range 1.3 · 手感可视化只读不改", () => {
  it("准星爪张角只是散布常量的映射:常量对象值在绘制前后不变", () => {
    // 1.2 手感三件套验收过的散布口径,一个都不许动
    expect([SPREAD_MAX, SPREAD_PER_SHOT, SPREAD_RECOVER_PER_S]).toEqual([34, 9, 26]);
    const angles = [0, SPREAD_MAX / 2, SPREAD_MAX, SPREAD_MAX * 3].map(clawOpenAngle);
    expect(angles[0]).toBeLessThan(angles[1]);
    expect(angles[1]).toBeLessThan(angles[2]);
    // 超出封顶不再张
    expect(angles[3]).toBe(angles[2]);
    for (const player of [0, 1]) {
      drawCrosshairSkin(recCtx().ctx, 300, 200, {
        player,
        ink: "#B44F84",
        radius: 26,
        spread: 12,
        halo: { alpha: 0.5, width: 4 },
        haloPulse: 0.5,
        nowS: 1,
        reduce: false,
        label: "朵朵",
      });
    }
    expect([SPREAD_MAX, SPREAD_PER_SHOT, SPREAD_RECOVER_PER_S]).toEqual([34, 9, 26]);
  });

  it("花朵靶误击走「花瓣飘落」分支且星屑生成数为 0;普通命中是星屑+丝带双通道", () => {
    const flower = hitParticleBudget("flower", { destroyed: false, foul: true, reduced: false });
    expect(flower.petals).toBe(FOUL_PETALS);
    expect(flower.sparkles).toBe(0);
    expect(flower.ribbons).toBe(0);
    // 好人靶保留「哎呀～」文案通道,不喷任何粒子
    const friend = hitParticleBudget("friend", { destroyed: false, foul: true, reduced: false });
    expect(friend).toEqual({ sparkles: 0, ribbons: 0, petals: 0 });
    const hit = hitParticleBudget("bull", { destroyed: true, foul: false, reduced: false });
    expect(hit.sparkles).toBe(HIT_SPARKLES);
    expect(hit.ribbons).toBe(HIT_RIBBONS);
    expect(hit.petals).toBe(0);
    expect(hitParticleBudget("miss", { destroyed: false, foul: false, reduced: false })).toEqual({
      sparkles: 0,
      ribbons: 0,
      petals: 0,
    });
  });

  it("prefers-reduced-motion:粒子预算全零、彩虹环相位冻结、呼吸恒 1", () => {
    for (const kind of KINDS) {
      expect(hitParticleBudget(kind, { destroyed: true, foul: false, reduced: true })).toEqual({
        sparkles: 0,
        ribbons: 0,
        petals: 0,
      });
    }
    expect(hitParticleBudget("flower", { destroyed: false, foul: true, reduced: true }).petals).toBe(0);
    expect(rainbowPhase(1.23, true)).toBe(0);
    expect(rainbowPhase(4.56, true)).toBe(0);
    expect(rainbowPhase(1.23, false)).not.toBe(rainbowPhase(2.23, false));
    expect(breathScale(0.3, true)).toBe(1);
    expect(breathScale(0.3, false)).not.toBe(1);
  });

  it("发射台的星星是自绘矢量:整个发射台不再 fillText 任何字形", () => {
    const rec = recCtx();
    drawLauncherSkin(rec.ctx, 500, 592, "#B44F84", 0.5);
    expect(rec.fillTexts.length).toBe(0);
    expect(rec.fillStyles.length).toBeGreaterThan(2);
  });
});

describe("shoot-range 1.3 · 收尾干净", () => {
  let live: { h: Harness; destroy: () => void } | null = null;

  afterEach(() => {
    try {
      live?.destroy();
    } catch {
      // 用例自己 destroy 过就算了
    }
    live?.h.restore();
    live = null;
  });

  it("destroy 后 rAF 句柄清空、window 监听归零(粒子随场一起清)", () => {
    const h = install();
    const api = {
      root: h.root as unknown as HTMLElement,
      play: () => {},
      addStars: (n: number) => n,
      getStars: () => 0,
      onWin: () => {},
      onLose: () => {},
    } as unknown as GameApi;
    const handle = mount(api);
    live = { h, destroy: () => handle.destroy() };
    handle.openCampaignLevel(1);
    h.flush(5);
    expect(h.pendingFrames()).toBeGreaterThan(0);
    handle.destroy();
    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(0);
  });

  it("本目录源码没有残留 emoji fillText(💨 等一律自绘)", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const emoji = /fillText\(\s*["'`][^"'`]*[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
      const src = readFileSync(join(dir, file), "utf8");
      expect(emoji.test(src), `${file} 里还有 emoji fillText`).toBe(false);
    }
  });
});
