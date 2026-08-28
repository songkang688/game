// 共享美术套件 · 果冻糖砖单测:
// 三层色值计算 / 光斑省略分支 / 裂纹 seed 可复现与层数映射 / 五道工序真的都画了。
import { describe, expect, it } from "vitest";
import {
  CANDY_CRACK,
  CANDY_DARK_K,
  CANDY_LIT_BAND_K,
  CANDY_LIT_K,
  CANDY_MIN_SPARK_H,
  CANDY_OUTLINE_K,
  CANDY_OUTLINE_PX,
  CANDY_RADIUS_K,
  CANDY_SHADOW,
  candyColors,
  candyDarken,
  candyLighten,
  crackPaths,
  hasSpark,
  paintCandyBrick
} from "./candyBrick";

/** 记录式 canvas 桩:数一数每类笔触被叫了几次 */
function makeCtx(): { ctx: CanvasRenderingContext2D; calls: Record<string, number>; fills: string[] } {
  const calls: Record<string, number> = {};
  const fills: string[] = [];
  const target: Record<string | symbol, unknown> = {};
  const bump = (name: string) => {
    calls[name] = (calls[name] ?? 0) + 1;
  };
  const ctx = new Proxy(target, {
    get(t, prop) {
      if (typeof prop === "string" && !(prop in t)) {
        return (..._args: unknown[]) => {
          bump(prop);
          return undefined;
        };
      }
      return t[prop];
    },
    set(t, prop, v) {
      if (prop === "fillStyle" && typeof v === "string") fills.push(v);
      t[prop] = v;
      return true;
    }
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, fills };
}

describe("candyBrick · 三层色值(四·补二工序 2/3/4)", () => {
  it("比例常量与规格表一致:+28% / -18% / 描边 -20% / 亮带 35% / 圆角 22%", () => {
    expect(CANDY_LIT_K).toBe(0.28);
    expect(CANDY_DARK_K).toBe(0.18);
    expect(CANDY_OUTLINE_K).toBe(0.2);
    expect(CANDY_LIT_BAND_K).toBe(0.35);
    expect(CANDY_RADIUS_K).toBe(0.22);
    expect(CANDY_SHADOW).toBe("rgba(93,74,110,.16)");
  });

  it("粉砖 #FF9EC8 的三层色值逐通道对账", () => {
    const c = candyColors("#FF9EC8");
    expect(c.body).toBe("#FF9EC8");
    // lit: 每通道 +28% 向白 → (255, 158+27.16→185, 200+15.4→215)
    expect(c.lit).toBe("#ffb9d7");
    // dark: 每通道 ×0.82 → (209, 130, 164)
    expect(c.dark).toBe("#d182a4");
    // outline: 每通道 ×0.8 → (204, 126, 160)
    expect(c.outline).toBe("#cc7ea0");
  });

  it("提亮/压暗是纯函数且夹在 0..255:白色提不上去、黑色压不下去", () => {
    expect(candyLighten("#ffffff", 0.28)).toBe("#ffffff");
    expect(candyDarken("#000000", 0.18)).toBe("#000000");
    expect(candyLighten("#000000", 1)).toBe("#ffffff");
    expect(candyDarken("#ffffff", 1)).toBe("#000000");
  });
});

describe("candyBrick · 光斑省略分支(工序 5)", () => {
  it("砖高 >= 10 画光斑,< 10 省略", () => {
    expect(hasSpark(CANDY_MIN_SPARK_H)).toBe(true);
    expect(hasSpark(14)).toBe(true);
    expect(hasSpark(9.9)).toBe(false);
    expect(hasSpark(6)).toBe(false);
  });

  it("矮砖(h=8)不调 arc(无光斑),但亮带的 fillRect 照画", () => {
    const { ctx, calls, fills } = makeCtx();
    paintCandyBrick(ctx, 0, 0, 40, 8, "#FF9EC8");
    expect(calls.arc ?? 0).toBe(0);
    // 底影 1 次 + 亮带 1 次 + 暗边 1 次 = 3 次 fillRect
    expect(calls.fillRect).toBe(3);
    expect(fills).toContain(candyColors("#FF9EC8").lit);
  });

  it("常规砖(h=14)光斑要画:arc 恰好 1 次", () => {
    const { ctx, calls } = makeCtx();
    paintCandyBrick(ctx, 0, 0, 40, 14, "#FF9EC8");
    expect(calls.arc).toBe(1);
  });
});

describe("candyBrick · 裂纹(多血砖附加工序)", () => {
  it("同 seed 同尺寸两次生成的路径完全相等(可复现)", () => {
    const a = crackPaths(7 * 31 + 3, 41, 14, 2);
    const b = crackPaths(7 * 31 + 3, 41, 14, 2);
    expect(a).toEqual(b);
  });

  it("不同 seed 的裂纹不一样", () => {
    const a = crackPaths(1, 41, 14, 1);
    const b = crackPaths(2, 41, 14, 1);
    expect(a).not.toEqual(b);
  });

  it("层数 = 传入的 level:0 层不画、2 层两条、每条是两段折线(3 个点)", () => {
    expect(crackPaths(5, 41, 14, 0)).toHaveLength(0);
    const two = crackPaths(5, 41, 14, 2);
    expect(two).toHaveLength(2);
    for (const path of two) {
      expect(path).toHaveLength(3);
      for (const [px, py] of path) {
        expect(px).toBeGreaterThanOrEqual(0);
        expect(px).toBeLessThanOrEqual(41);
        expect(py).toBeGreaterThanOrEqual(0);
        expect(py).toBeLessThanOrEqual(14);
      }
    }
  });

  it("画裂纹时 stroke 次数 = 描边 1 次 + 裂纹层数", () => {
    const { ctx, calls } = makeCtx();
    paintCandyBrick(ctx, 0, 0, 40, 14, "#7E8798", { crackSeed: 9, cracks: 2 });
    expect(calls.stroke).toBe(3);
  });
});

describe("candyBrick · 五道工序与无副作用", () => {
  it("save/restore 配平,外描边 1.5px,裂纹色是深糖缝色", () => {
    const { ctx, calls } = makeCtx();
    paintCandyBrick(ctx, 2, 2, 40, 14, "#9AA0AE", { cracks: 1 });
    expect(calls.save).toBe(calls.restore);
    expect((ctx as unknown as Record<string, unknown>).lineWidth).toBe(CANDY_OUTLINE_PX);
    expect(CANDY_CRACK).toBe("rgba(74,58,88,.5)");
  });

  it("零尺寸直接返回,一笔都不画", () => {
    const { ctx, calls } = makeCtx();
    paintCandyBrick(ctx, 0, 0, 0, 14, "#FF9EC8");
    paintCandyBrick(ctx, 0, 0, 40, 0, "#FF9EC8");
    expect(Object.keys(calls)).toHaveLength(0);
  });
});
