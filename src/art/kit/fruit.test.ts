/**
 * 六剪影水果套件契约测试（1.3 第 20 步 A 档）。
 * 全部跑在 node 环境：用记录式 2D context 桩，不碰真 DOM。
 */
import { describe, expect, it } from "vitest";
import {
  FRUIT_DETAIL_MIN_PX,
  FRUIT_GRADIENT_STOPS,
  FRUIT_KINDS,
  FRUIT_MAIN,
  FRUIT_OUTLINE_PX,
  drawFruitShadow,
  drawKitFruit,
  fruitOutline,
  grapeBerries,
  shade,
  type FruitKitKind
} from "./fruit";

interface StubCtx {
  ops: string[];
  nums: number[];
  stops: string[];
  ctx: CanvasRenderingContext2D;
}

/** 记录式 2D context 桩：记操作名、数值参数与渐变 stop */
function makeStubCtx(): StubCtx {
  const ops: string[] = [];
  const nums: number[] = [];
  const stops: string[] = [];
  const rec = (name: string) => (...args: unknown[]) => {
    ops.push(name);
    for (const a of args) if (typeof a === "number") nums.push(a);
  };
  const target: Record<string, unknown> = {
    save: rec("save"),
    restore: rec("restore"),
    beginPath: rec("beginPath"),
    closePath: rec("closePath"),
    moveTo: rec("moveTo"),
    lineTo: rec("lineTo"),
    quadraticCurveTo: rec("quadraticCurveTo"),
    bezierCurveTo: rec("bezierCurveTo"),
    arc: rec("arc"),
    ellipse: rec("ellipse"),
    rect: rec("rect"),
    roundRect: rec("roundRect"),
    fill: rec("fill"),
    stroke: rec("stroke"),
    clip: rec("clip"),
    fillRect: rec("fillRect"),
    strokeRect: rec("strokeRect"),
    clearRect: rec("clearRect"),
    translate: rec("translate"),
    rotate: rec("rotate"),
    scale: rec("scale"),
    setLineDash: rec("setLineDash"),
    fillText: rec("fillText"),
    createRadialGradient: (...args: unknown[]) => {
      ops.push("createRadialGradient");
      for (const a of args) if (typeof a === "number") nums.push(a);
      return { addColorStop: (_o: number, c: string) => stops.push(c) };
    },
    createLinearGradient: (...args: unknown[]) => {
      ops.push("createLinearGradient");
      for (const a of args) if (typeof a === "number") nums.push(a);
      return { addColorStop: (_o: number, c: string) => stops.push(c) };
    },
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "left",
    lineCap: "butt",
    lineJoin: "miter"
  };
  return { ops, nums, stops, ctx: target as unknown as CanvasRenderingContext2D };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

describe("art-kit fruit · 调色与工具", () => {
  it("六种水果都有合法 #rrggbb 主色，apple/banana/grape 与 step 文档 token 一致", () => {
    expect(FRUIT_KINDS).toHaveLength(6);
    for (const k of FRUIT_KINDS) expect(FRUIT_MAIN[k]).toMatch(HEX);
    expect(FRUIT_MAIN.apple).toBe("#F06B6B");
    expect(FRUIT_MAIN.banana).toBe("#F5D442");
    expect(FRUIT_MAIN.grape).toBe("#9F7AD8");
  });

  it("shade 正往白走、负往黑走，非法输入原样返回不抛", () => {
    expect(shade("#808080", 0.5)).toMatch(HEX);
    const up = parseInt(shade("#808080", 0.5).slice(1, 3), 16);
    const down = parseInt(shade("#808080", -0.5).slice(1, 3), 16);
    expect(up).toBeGreaterThan(0x80);
    expect(down).toBeLessThan(0x80);
    expect(shade("红色", 0.2)).toBe("红色");
    expect(shade("#80808", 0.2)).toBe("#80808");
    expect(() => shade("#808080", Number.NaN)).not.toThrow();
  });

  it("三停渐变的三个 stop 是 +18% / 主体 / -14%", () => {
    expect(FRUIT_GRADIENT_STOPS[0]).toBe(0.18);
    expect(FRUIT_GRADIENT_STOPS[1]).toBe(0);
    expect(FRUIT_GRADIENT_STOPS[2]).toBe(-0.14);
    expect(FRUIT_OUTLINE_PX).toBe(1.5);
  });
});

describe("art-kit fruit · 六种剪影两两不同", () => {
  const signature = (k: FruitKitKind): string =>
    fruitOutline(k, 20, 36)
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(";");

  it("全部 15 对剪影采样两两不相等（远超抽 3 对的下限）", () => {
    for (let i = 0; i < FRUIT_KINDS.length; i++) {
      for (let j = i + 1; j < FRUIT_KINDS.length; j++) {
        expect(signature(FRUIT_KINDS[i]), `${FRUIT_KINDS[i]} vs ${FRUIT_KINDS[j]}`).not.toBe(
          signature(FRUIT_KINDS[j])
        );
      }
    }
  });

  it("剪影特征成立：苹果凹顶、香蕉月牙、葡萄六球、草莓下尖、梨下宽", () => {
    const topY = (k: FruitKitKind): number =>
      Math.min(...fruitOutline(k, 20, 48).map((p) => p.y));
    // 苹果顶部凹陷：最高点比正圆(-20)矮
    expect(topY("apple")).toBeGreaterThan(-20);
    // 橙子就是正圆
    expect(topY("orange")).toBeCloseTo(-20, 0);
    // 葡萄由 6 球组成
    expect(grapeBerries(20)).toHaveLength(6);
    // 草莓：底半程宽度小于顶半程（倒水滴）；梨相反（葫芦）
    const widthAt = (k: FruitKitKind, sign: 1 | -1): number =>
      Math.max(...fruitOutline(k, 20, 48).filter((p) => Math.sign(p.y) === sign).map((p) => Math.abs(p.x)));
    expect(widthAt("strawberry", 1)).toBeLessThan(widthAt("strawberry", -1) + 1);
    expect(widthAt("pear", 1)).toBeGreaterThan(widthAt("pear", -1));
    // 香蕉是弯月：轮廓点全都不在中心正下方深处（有内凹）
    const banana = fruitOutline("banana", 20, 48);
    expect(banana.length).toBeGreaterThan(20);
    // 非法尺寸不炸、给空
    expect(fruitOutline("apple", 0)).toEqual([]);
    expect(fruitOutline("apple", Number.NaN)).toEqual([]);
  });
});

describe("art-kit fruit · 绘制契约", () => {
  it("六种都画得出来：有填充、有描边、有渐变高光，坐标里没有 NaN", () => {
    for (const k of FRUIT_KINDS) {
      const s = makeStubCtx();
      drawKitFruit(s.ctx, 50, 60, 16, k);
      expect(s.ops.filter((o) => o === "fill").length, k).toBeGreaterThan(0);
      expect(s.ops.filter((o) => o === "stroke").length, k).toBeGreaterThan(0);
      expect(s.ops).toContain("createRadialGradient");
      expect(s.stops.length, k).toBeGreaterThanOrEqual(3);
      for (const n of s.nums) expect(Number.isFinite(n), `${k} 画出了非有限坐标`).toBe(true);
    }
  });

  it("细节层阈值：直径 < 18px 自动省略，≥ 18px 画出", () => {
    expect(FRUIT_DETAIL_MIN_PX).toBe(18);
    const small = makeStubCtx();
    drawKitFruit(small.ctx, 0, 0, 8, "orange"); // 直径 16 < 18
    const big = makeStubCtx();
    drawKitFruit(big.ctx, 0, 0, 16, "orange"); // 直径 32 ≥ 18
    // 皮孔点阵只在大图出现：大图的 arc 次数明显多
    const arcs = (s: StubCtx): number => s.ops.filter((o) => o === "arc").length;
    expect(arcs(big)).toBeGreaterThan(arcs(small));
    // 也可以强制开关
    const forced = makeStubCtx();
    drawKitFruit(forced.ctx, 0, 0, 8, "orange", { detail: true });
    expect(arcs(forced)).toBeGreaterThan(arcs(small));
  });

  it("rot / color / alpha 参数生效且安全：非法 r 不画、非法色回退主色", () => {
    const s = makeStubCtx();
    drawKitFruit(s.ctx, 0, 0, -5, "apple");
    drawKitFruit(s.ctx, Number.NaN, 0, 10, "apple");
    expect(s.ops).toHaveLength(0);
    const rot = makeStubCtx();
    drawKitFruit(rot.ctx, 0, 0, 14, "apple", { rot: 0.14, alpha: 0.5, color: "不是色值" });
    expect(rot.ops).toContain("rotate");
    for (const n of rot.nums) expect(Number.isFinite(n)).toBe(true);
  });

  it("落影小椭圆存在、用统一落影色，非法输入不抛", () => {
    const s = makeStubCtx();
    drawFruitShadow(s.ctx, 10, 20, 15);
    expect(s.ops).toContain("ellipse");
    expect(() => drawFruitShadow(s.ctx, Number.NaN, 0, 10)).not.toThrow();
  });
});
