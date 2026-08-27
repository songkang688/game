// 果果合成 · 1.3 视觉契约(素材契约测试,只增不减)。
//
// 视觉宪法第九节要求每个视觉步都有素材契约:这里用一个「录音笔」2D 上下文
// 把 `paintFruit` 的每一步绘制记下来,证明 11 级果子真的两两不同、真的有渐变有脸,
// 而不是「跑了没炸」就算过。贴图缓存与爆汁 fx 也在这里逐条对账。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BIG_LEVEL,
  FRUIT_STYLE,
  JUICE_MAX,
  JUICE_MS,
  RING_MS,
  SHAKE_MS,
  TEXT_MS,
  blinkAlpha,
  clearSpriteCache,
  createFx,
  fruitSprite,
  paintFruit,
  spriteCacheKeys,
  spriteScaleKey,
} from "./art";
import { installDom, restoreDom } from "./domStub";
import { CHAIN, TOP_LEVEL } from "./merge";

/** 录音笔上下文:把每一次方法调用与属性赋值按顺序记成字符串 */
function recordCtx(): { g: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const fmt = (v: unknown): string => (typeof v === "number" ? v.toFixed(2) : String(v));
  const g = new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== "string") return undefined;
        return (...args: unknown[]) => {
          calls.push(`${prop}(${args.map(fmt).join(",")})`);
          if (prop === "createRadialGradient" || prop === "createLinearGradient") {
            return { addColorStop: (o: number, c: string) => calls.push(`stop(${fmt(o)},${c})`) };
          }
          return undefined;
        };
      },
      set(_t, prop, v) {
        calls.push(`${String(prop)}=${fmt(v)}`);
        return true;
      },
    }
  ) as unknown as CanvasRenderingContext2D;
  return { g, calls };
}

describe("果卡:11 级各有纹理和脸,不是纯色圆", () => {
  it("paintFruit 的绘制调用序列 11 级两两不同,而且每级都不止一个圆", () => {
    const seqs = new Set<string>();
    for (let lvl = 0; lvl <= TOP_LEVEL; lvl++) {
      const { g, calls } = recordCtx();
      paintFruit(g, lvl, 30, "smile");
      expect(calls.length, `第 ${lvl} 级只画了 ${calls.length} 步,还是个纯色圆`).toBeGreaterThan(30);
      seqs.add(calls.join(";"));
    }
    expect(seqs.size, "有两级果子画出来一模一样").toBe(TOP_LEVEL + 1);
  });

  it("主体是径向渐变(左上高光 → 边缘压暗),不是平涂", () => {
    const { g, calls } = recordCtx();
    paintFruit(g, 5, 30, "smile");
    expect(calls.some((c) => c.startsWith("createRadialGradient("))).toBe(true);
    expect(calls.filter((c) => c.startsWith("stop(")).length).toBeGreaterThanOrEqual(3);
  });

  it("微笑脸与担忧脸画得不一样:警戒反馈落在角色身上", () => {
    for (const lvl of [0, 5, TOP_LEVEL]) {
      const a = recordCtx();
      paintFruit(a.g, lvl, 30, "smile");
      const b = recordCtx();
      paintFruit(b.g, lvl, 30, "worry");
      expect(a.calls.join(";"), `第 ${lvl} 级两种脸画出来一样`).not.toBe(b.calls.join(";"));
    }
  });

  it("调色板契约:11 级提亮色 / 纹理色逐级配齐且都是合法 #rrggbb", () => {
    expect(FRUIT_STYLE).toHaveLength(CHAIN.length);
    for (const st of FRUIT_STYLE) {
      expect(st.hi).toMatch(/^#[0-9a-f]{6}$/i);
      expect(st.detail).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("贴图缓存:预渲染一次,主画布只 drawImage", () => {
  beforeEach(() => {
    installDom(420);
    clearSpriteCache();
  });
  afterEach(() => {
    clearSpriteCache();
    restoreDom();
  });

  it("11 级贴图逐级入缓存,键与画布两两不同,再取命中同一张", () => {
    const first = [];
    for (let lvl = 0; lvl <= TOP_LEVEL; lvl++) first.push(fruitSprite(lvl, 1, "smile"));
    expect(new Set(first.map((s) => s.key)).size).toBe(TOP_LEVEL + 1);
    expect(new Set(first.map((s) => s.canvas)).size).toBe(TOP_LEVEL + 1);
    expect(spriteCacheKeys()).toHaveLength(TOP_LEVEL + 1);
    for (let lvl = 0; lvl <= TOP_LEVEL; lvl++) {
      expect(fruitSprite(lvl, 1, "smile").canvas, `第 ${lvl} 级没吃到缓存`).toBe(first[lvl].canvas);
    }
    expect(spriteCacheKeys(), "命中缓存还多出了新键").toHaveLength(TOP_LEVEL + 1);
  });

  it("担忧脸是另一张贴图;清缓存后键归零", () => {
    const smile = fruitSprite(3, 1, "smile");
    const worry = fruitSprite(3, 1, "worry");
    expect(worry.key).not.toBe(smile.key);
    expect(worry.canvas).not.toBe(smile.canvas);
    clearSpriteCache();
    expect(spriteCacheKeys()).toHaveLength(0);
  });

  it("缩放键有量化和钳制:布局微调不重画一整套,极端缩放不炸缓存", () => {
    expect(spriteScaleKey(0.01)).toBe(0.5);
    expect(spriteScaleKey(99)).toBe(4);
    expect(spriteScaleKey(1.01)).toBe(spriteScaleKey(1.02));
    expect(fruitSprite(2, 1.01, "smile").canvas).toBe(fruitSprite(2, 1.02, "smile").canvas);
  });

  it("最小的「籽」贴图在 1x 下也不小于 12px,360px 上仍认得出种类", () => {
    const sp = fruitSprite(0, 1, "smile");
    expect(sp.canvas.width).toBeGreaterThanOrEqual(12);
    expect(sp.canvas.width, "贴图连果身直径都装不下").toBeGreaterThanOrEqual(Math.floor(CHAIN[0].r * 2));
  });
});

describe("合并爆汁:果汁 / 扩散环 / 金星 / 飘字 / 震屏", () => {
  it("一次合并迸 4–6 滴果汁加一圈白环加飘字,动画走完全部回收", () => {
    const fx = createFx(false);
    fx.burst(50, 60, 3, 10, false);
    const c = fx.counts();
    expect(c.juice).toBeGreaterThanOrEqual(4);
    expect(c.juice).toBeLessThanOrEqual(6);
    expect(c.rings).toBe(1);
    expect(c.texts).toBe(1);
    fx.update(JUICE_MS + 20);
    expect(fx.counts().juice, "果汁到寿没有回收").toBe(0);
    fx.update(TEXT_MS + RING_MS);
    const done = fx.counts();
    expect(done.rings + done.stars + done.texts, "还有效果赖着不走").toBe(0);
  });

  it("reduced 下一颗粒子都不出、不飘字、不震屏", () => {
    const fx = createFx(true);
    fx.burst(50, 60, TOP_LEVEL, 66, true);
    expect(fx.counts()).toEqual({ juice: 0, rings: 0, stars: 0, texts: 0 });
    expect(fx.shakeLeft).toBe(0);
    expect(fx.shakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("果汁对象池封顶,连环合成也不越攒越多", () => {
    const fx = createFx(false);
    for (let i = 0; i < 10; i++) fx.burst(10 * i, 40, 2, 6, false);
    expect(fx.counts().juice).toBeLessThanOrEqual(JUICE_MAX);
  });

  it("后三级合成加金星两颗,小果不加", () => {
    const fx = createFx(false);
    fx.burst(40, 40, BIG_LEVEL, 45, false);
    expect(fx.counts().stars).toBe(2);
    const small = createFx(false);
    small.burst(40, 40, 1, 3, false);
    expect(small.counts().stars).toBe(0);
  });

  it("顶级合成轻震一次(≤2px)加彩虹环,走完自动归零", () => {
    const fx = createFx(false);
    fx.burst(80, 80, TOP_LEVEL, 200, true);
    expect(fx.shakeLeft).toBe(SHAKE_MS);
    const off = fx.shakeOffset();
    expect(Math.abs(off.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(off.y)).toBeLessThanOrEqual(2);
    expect(fx.counts().rings, "顶级应该是白环 + 彩虹环两圈").toBe(2);
    fx.update(SHAKE_MS + RING_MS * 2);
    expect(fx.shakeLeft).toBe(0);
    expect(fx.shakeOffset()).toEqual({ x: 0, y: 0 });
  });

  it("draw 真的把活着的效果画出去了", () => {
    const fx = createFx(false);
    fx.burst(50, 50, TOP_LEVEL, 66, true);
    fx.update(16);
    const { g, calls } = recordCtx();
    fx.draw(g);
    expect(calls.filter((c) => c.startsWith("arc(")).length, "粒子和环一个都没画").toBeGreaterThan(4);
    expect(calls.some((c) => c.startsWith("fillText(")), "飘字没画").toBe(true);
  });
});

describe("警戒线闪烁(回归)", () => {
  it("reduced 下恒定为 1,不闪", () => {
    for (const t of [0, 130, 260, 5000]) expect(blinkAlpha(t, true)).toBe(1);
  });

  it("非 reduced 时随时间呼吸,幅度夹在 0.45–1", () => {
    expect(blinkAlpha(0, false)).not.toBeCloseTo(blinkAlpha(130, false), 3);
    for (const t of [0, 60, 130, 260, 777]) {
      const v = blinkAlpha(t, false);
      expect(v).toBeGreaterThanOrEqual(0.45);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
