import { describe, expect, it } from "vitest";
import { KIT_PALETTE, makeStubCtx } from "../../art/kit";
import {
  BEAN_BOTTOM,
  BEAN_TOP,
  BOW_COLOR,
  CAP_COLOR,
  DECOR_PARALLAX,
  FENCE_WARN_PX,
  FIELD_THEMES,
  GEM_POP_SEC,
  GEM_TIERS,
  STARDUST_LIFE,
  STARDUST_MAX,
  TROPHY_COLORS,
  accessoryFor,
  beanPhase,
  drawBodyNode,
  drawCompassRadar,
  drawFence,
  drawFieldBackground,
  drawGemDrop,
  drawLengthCurve,
  drawNameTag,
  drawShieldBadge,
  drawShrinkZone,
  drawSnakeHead,
  drawStarBean,
  drawStarBeanFast,
  drawSummary,
  drawTrophy,
  fieldTheme,
  gemPopScale,
  gemTier,
  hash2,
  makeBeanSprites,
  makeStardustPool,
  patternFamily,
  trophyColor,
  type BeanSprites
} from "./art";

// ---------------------------------------------------------------------------
// 1.3 视觉素材契约:星光豆 / 宝石 / 糖果蟒 / 围栏缩圈 / 背景 / 雷达 / 结算。
// 全部用 kit 的记录式 2D 桩,逐笔核对绘制结构。
// ---------------------------------------------------------------------------

describe("星光豆:会发光的星星", () => {
  it("直绘含柔光晕渐变与五角星路径,不再是单次 arc+fill", () => {
    const s = makeStubCtx();
    drawStarBean(s.ctx, { x: 0, y: 0, r: 10, t: 0.3 });
    expect(s.count("createRadialGradient")).toBeGreaterThanOrEqual(1);
    expect(s.count("createLinearGradient")).toBeGreaterThanOrEqual(1);
    expect(s.count("lineTo")).toBeGreaterThanOrEqual(9);
    expect(s.count("fill")).toBeGreaterThanOrEqual(2);
    expect(s.nonFiniteArgs).toBe(0);
  });

  it("soft 模式关掉光晕,但星形主体还在", () => {
    const s = makeStubCtx();
    drawStarBean(s.ctx, { x: 0, y: 0, r: 10, t: 0.3, soft: true });
    expect(s.count("createRadialGradient")).toBe(0);
    expect(s.count("lineTo")).toBeGreaterThanOrEqual(9);
    const full = makeStubCtx();
    drawStarBean(full.ctx, { x: 0, y: 0, r: 10, t: 0.3 });
    expect(s.snapshot()).not.toBe(full.snapshot());
  });

  it("哈希相位确定:同一颗豆同一节奏,不同豆节奏不同", () => {
    expect(beanPhase(30, 40, 2)).toBe(beanPhase(30, 40, 2));
    expect(beanPhase(30, 40, 2)).not.toBe(beanPhase(31, 40, 2));
    expect(beanPhase(30, 40, 2)).toBeGreaterThanOrEqual(0);
    expect(beanPhase(30, 40, 2)).toBeLessThan(1);
  });

  it("没有 document 时预渲染退回 null,直绘路径顶上", () => {
    expect(makeBeanSprites(false)).toBeNull();
    const s = makeStubCtx();
    drawStarBeanFast(s.ctx, null, { x: 5, y: 5, r: 8, t: 0.2 });
    expect(s.count("lineTo")).toBeGreaterThanOrEqual(9);
    expect(s.count("drawImage")).toBe(0);
  });

  it("有 sprite 且上下文支持 drawImage 时主循环只贴图", () => {
    const fakeCanvas = { width: 44, height: 44 } as HTMLCanvasElement;
    const sprites: BeanSprites = {
      small: { canvas: fakeCanvas, px: 44, bakedR: 9 },
      big: { canvas: fakeCanvas, px: 88, bakedR: 18 }
    };
    const s = makeStubCtx();
    drawStarBeanFast(s.ctx, sprites, { x: 5, y: 5, r: 8, t: 0.2 });
    expect(s.count("drawImage")).toBe(1);
    expect(s.count("lineTo")).toBe(0);
  });

  it("预渲染两种尺寸:给个假 document 就能烤出来", () => {
    const g = globalThis as { document?: unknown };
    const saved = g.document;
    const baked: ReturnType<typeof makeStubCtx>[] = [];
    g.document = {
      createElement: () => {
        const stub = makeStubCtx();
        baked.push(stub);
        return { width: 0, height: 0, getContext: () => stub.ctx };
      }
    };
    try {
      const sp = makeBeanSprites(false);
      expect(sp).not.toBeNull();
      expect(sp!.small.px).toBeGreaterThan(0);
      expect(sp!.big.bakedR).toBeGreaterThan(sp!.small.bakedR);
      expect(baked.length).toBe(2);
      expect(baked[0].count("lineTo")).toBeGreaterThanOrEqual(9);
    } finally {
      if (saved === undefined) delete g.document;
      else g.document = saved;
    }
  });

  it("金黄渐变两端与豆色契约合法", () => {
    expect(BEAN_TOP).toMatch(/^#[0-9a-f]{6}$/);
    expect(BEAN_BOTTOM).toMatch(/^#[0-9a-f]{6}$/);
    expect(BEAN_TOP).not.toBe(BEAN_BOTTOM);
  });
});

describe("掉落光点 → 糖果宝石", () => {
  it("按价值分三档色,三档互不相同", () => {
    expect(gemTier(0.8)).toBe(0);
    expect(gemTier(1.5)).toBe(1);
    expect(gemTier(3)).toBe(2);
    const colors = GEM_TIERS.map((t) => t.color);
    expect(new Set(colors).size).toBe(3);
  });

  it("落地 0.5s 弹性:开局 1.4 倍,到点归 1", () => {
    expect(gemPopScale(0)).toBeCloseTo(1.4, 5);
    expect(gemPopScale(GEM_POP_SEC)).toBe(1);
    expect(gemPopScale(9)).toBe(1);
    expect(gemPopScale(Number.NaN)).toBe(1);
  });

  it("宝石走 kit 切面画法,三档颜色真的落到画布", () => {
    for (const tier of [0, 1, 2] as const) {
      const s = makeStubCtx();
      drawGemDrop(s.ctx, { x: 0, y: 0, r: 6, value: GEM_TIERS[tier].min + 0.01, age: 1 });
      expect(s.fillStyleLog).toContain(GEM_TIERS[tier].color);
      expect(s.count("lineTo")).toBeGreaterThanOrEqual(6);
    }
  });

  it("落地瞬间与落定之后的缩放序列不同;soft 不弹", () => {
    const young = makeStubCtx();
    drawGemDrop(young.ctx, { x: 0, y: 0, r: 6, value: 1, age: 0 });
    const settled = makeStubCtx();
    drawGemDrop(settled.ctx, { x: 0, y: 0, r: 6, value: 1, age: 1 });
    expect(young.snapshot()).not.toBe(settled.snapshot());
    const soft = makeStubCtx();
    drawGemDrop(soft.ctx, { x: 0, y: 0, r: 6, value: 1, age: 0, soft: true });
    expect(soft.snapshot()).toBe(settled.snapshot());
  });
});

describe("糖果蟒:蛇身三层与花纹族", () => {
  it("节点是渐变底 + 背脊高光,不是纯色圆", () => {
    const s = makeStubCtx();
    drawBodyNode(s.ctx, { x: 0, y: 0, r: 8, color: "#8fd9a8", nx: 0, ny: -1, pattern: "plain", index: 1 });
    expect(s.count("createRadialGradient")).toBe(1);
    expect(s.count("fill")).toBeGreaterThanOrEqual(2);
  });

  it("同色同档半径的渐变会被缓存,第二节不再重建", () => {
    const s = makeStubCtx();
    drawBodyNode(s.ctx, { x: 0, y: 0, r: 8, color: "#8fd9a8", index: 0 });
    drawBodyNode(s.ctx, { x: 9, y: 0, r: 8, color: "#8fd9a8", index: 1 });
    expect(s.count("createRadialGradient")).toBe(1);
    drawBodyNode(s.ctx, { x: 18, y: 0, r: 8, color: "#f7b8ce", index: 2 });
    expect(s.count("createRadialGradient")).toBe(2);
  });

  it("波点族每 4 节一颗点,条纹族每 3 节一道环,填缝节只画底", () => {
    const dot = makeStubCtx();
    drawBodyNode(dot.ctx, { x: 0, y: 0, r: 8, color: "#a9c8f5", pattern: "dot", index: 4 });
    const dotOff = makeStubCtx();
    drawBodyNode(dotOff.ctx, { x: 0, y: 0, r: 8, color: "#a9c8f5", pattern: "dot", index: 5 });
    expect(dot.count("fill")).toBeGreaterThan(dotOff.count("fill"));
    const stripe = makeStubCtx();
    drawBodyNode(stripe.ctx, { x: 0, y: 0, r: 8, color: "#f8d98c", pattern: "stripe", index: 3 });
    expect(stripe.count("stroke")).toBeGreaterThanOrEqual(1);
    const plain = makeStubCtx();
    drawBodyNode(plain.ctx, { x: 0, y: 0, r: 8, color: "#f8d98c", plain: true });
    expect(plain.count("fill")).toBe(1);
  });

  it("皮肤花纹字段映射到三族渲染,一族不落", () => {
    expect(patternFamily("stripe")).toBe("stripe");
    expect(patternFamily("dot")).toBe("dot");
    expect(patternFamily("rainbow")).toBe("gradient");
    expect(patternFamily("solid")).toBe("plain");
  });
});

describe("糖果蟒:头、表情与双人头饰", () => {
  const base = { x: 0, y: 0, r: 10, angle: 0.4, color: "#8fd9a8" } as const;

  it("椭圆头带渐变、鼻孔与高光双瞳", () => {
    const s = makeStubCtx();
    drawSnakeHead(s.ctx, { ...base });
    expect(s.count("scale")).toBeGreaterThanOrEqual(1);
    expect(s.count("createRadialGradient")).toBe(1);
    expect(s.count("arc")).toBeGreaterThanOrEqual(8);
    expect(s.fillStyleLog).toContain(KIT_PALETTE.cloud);
  });

  it("死亡帧走 X 眼分支,序列与活着时不同", () => {
    const alive = makeStubCtx();
    drawSnakeHead(alive.ctx, { ...base });
    const dead = makeStubCtx();
    drawSnakeHead(dead.ctx, { ...base, dead: true });
    expect(dead.snapshot()).not.toBe(alive.snapshot());
    expect(dead.count("lineTo")).toBeGreaterThanOrEqual(4);
    expect(dead.count("arc")).toBeLessThan(alive.count("arc"));
  });

  it("boost 眯眼咧嘴,序列又是另一副表情", () => {
    const normal = makeStubCtx();
    drawSnakeHead(normal.ctx, { ...base });
    const boost = makeStubCtx();
    drawSnakeHead(boost.ctx, { ...base, boosting: true });
    expect(boost.snapshot()).not.toBe(normal.snapshot());
  });

  it("P1 蝴蝶结 / P2 棒球帽:形状 + 颜色双通道,序列不同", () => {
    expect(accessoryFor("duo")).toBe("bow");
    expect(accessoryFor("star")).toBe("cap");
    expect(accessoryFor(undefined)).toBeNull();
    expect(BOW_COLOR).not.toBe(CAP_COLOR);
    const p1 = makeStubCtx();
    drawSnakeHead(p1.ctx, { ...base, accessory: "bow" });
    const p2 = makeStubCtx();
    drawSnakeHead(p2.ctx, { ...base, accessory: "cap" });
    expect(p1.snapshot()).not.toBe(p2.snapshot());
    expect(p1.fillStyleLog).toContain(BOW_COLOR);
    expect(p2.fillStyleLog).toContain(CAP_COLOR);
  });

  it("白底胶囊名字牌:胶囊 + 文字都落笔", () => {
    const s = makeStubCtx();
    drawNameTag(s.ctx, { x: 10, y: 10, text: "朵朵", color: "#f5a9c8" });
    expect(s.count("arc")).toBeGreaterThanOrEqual(2);
    expect(s.textLog).toContain("朵朵");
    expect(s.fontLog.some((f) => /14px/.test(f))).toBe(true);
  });
});

describe("加速尾焰 → 星屑拖尾粒子池", () => {
  it("池上限 40,撒再多也不越界,死粒子的坑会复用", () => {
    const pool = makeStardustPool();
    for (let i = 0; i < 90; i++) pool.spawn(0, 0, 0, i);
    expect(pool.alive()).toBeLessThanOrEqual(STARDUST_MAX);
    expect(pool.parts.length).toBeLessThanOrEqual(STARDUST_MAX);
    pool.step(STARDUST_LIFE + 0.01);
    expect(pool.alive()).toBe(0);
    pool.spawn(1, 1, 0, 3);
    expect(pool.parts.length).toBeLessThanOrEqual(STARDUST_MAX);
    expect(pool.alive()).toBe(1);
  });

  it("寿命 0.3s,活着才落笔,死光了零绘制", () => {
    expect(STARDUST_LIFE).toBeCloseTo(0.3, 5);
    const pool = makeStardustPool(8);
    pool.spawn(0, 0, 0, 1);
    pool.spawn(0, 0, 0, 2);
    const live = makeStubCtx();
    pool.draw(live.ctx, (x) => x, (y) => y, 1);
    expect(live.count("fill")).toBeGreaterThan(0);
    pool.step(1);
    const gone = makeStubCtx();
    pool.draw(gone.ctx, (x) => x, (y) => y, 1);
    expect(gone.count("fill")).toBe(0);
  });
});

describe("围栏与缩圈:名副其实的发光", () => {
  it("围栏三层描边 + 12 颗灯珠,注释不再撒谎", () => {
    const s = makeStubCtx();
    drawFence(s.ctx, { cx: 320, cy: 186, r: 150, w: 640, h: 372, t: 1, theme: FIELD_THEMES.day });
    expect(s.count("stroke")).toBeGreaterThanOrEqual(3);
    // 3 圈描边 + 12 颗灯珠每颗 2 个圆
    expect(s.count("arc")).toBeGreaterThanOrEqual(3 + 12 * 2);
    expect(s.nonFiniteArgs).toBe(0);
  });

  it("蛇头逼近 80px 内出红色警示,soft 时不闪", () => {
    expect(FENCE_WARN_PX).toBe(80);
    const warn = makeStubCtx();
    drawFence(warn.ctx, { cx: 320, cy: 186, r: 150, w: 640, h: 372, t: 1, theme: FIELD_THEMES.day, warn: 1, warnAngle: 0.5 });
    expect(warn.strokeStyleLog).toContain(KIT_PALETTE.coral);
    const softCtx = makeStubCtx();
    drawFence(softCtx.ctx, { cx: 320, cy: 186, r: 150, w: 640, h: 372, t: 1, theme: FIELD_THEMES.day, warn: 1, warnAngle: 0.5, soft: true });
    expect(softCtx.snapshot()).not.toBe(warn.snapshot());
  });

  it("缩圈是圈外罩 + 双层光带,不再是一根细线", () => {
    const s = makeStubCtx();
    drawShrinkZone(s.ctx, { cx: 320, cy: 186, r: 150, w: 640, h: 372, t: 1 });
    expect(s.count("rect")).toBeGreaterThanOrEqual(1);
    expect(s.count("stroke")).toBeGreaterThanOrEqual(3);
    const soft = makeStubCtx();
    drawShrinkZone(soft.ctx, { cx: 320, cy: 186, r: 150, w: 640, h: 372, t: 1, soft: true });
    expect(soft.snapshot()).not.toBe(s.snapshot());
  });
});

describe("糖果原野背景", () => {
  it("三层齐:线性渐变 + 网格 + 装饰贴片,且完全确定", () => {
    const a = makeStubCtx();
    drawFieldBackground(a.ctx, { w: 640, h: 372, camX: 120, camY: -40, zoom: 1, theme: FIELD_THEMES.day });
    expect(a.count("createLinearGradient")).toBeGreaterThanOrEqual(1);
    expect(a.count("moveTo")).toBeGreaterThan(4);
    expect(a.count("arc")).toBeGreaterThan(0);
    expect(a.nonFiniteArgs).toBe(0);
    const b = makeStubCtx();
    drawFieldBackground(b.ctx, { w: 640, h: 372, camX: 120, camY: -40, zoom: 1, theme: FIELD_THEMES.day });
    expect(b.snapshot()).toBe(a.snapshot());
  });

  it("白天 / 黄昏 / 夜三主题换色,fog 关自动夜色调", () => {
    expect(fieldTheme("night").bgTop).not.toBe(fieldTheme("day").bgTop);
    expect(fieldTheme("dusk").bgTop).not.toBe(fieldTheme("day").bgTop);
    for (const th of Object.values(FIELD_THEMES)) {
      for (const c of [th.bgTop, th.bgBottom, th.grid, th.fence, th.lamp, th.decoA, th.decoB, th.decoC]) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    expect(DECOR_PARALLAX).toBeCloseTo(0.85, 5);
  });

  it("哈希撒点确定可复现", () => {
    expect(hash2(3, 7)).toBe(hash2(3, 7));
    expect(hash2(3, 7)).not.toBe(hash2(7, 3));
  });
});

describe("罗盘小地图", () => {
  const dots = [
    { x: 0.2, y: 0.1, color: "#f7b8ce" },
    { x: -0.4, y: 0.6, color: "#a9c8f5", me: true }
  ];

  it("金属环 + 深底 + 扫描线,自己的点保留 #E0508C 加白描边", () => {
    const s = makeStubCtx();
    drawCompassRadar(s.ctx, { cx: 560, cy: 300, r: 40, t: 2, dots });
    expect(s.count("createLinearGradient")).toBeGreaterThanOrEqual(1);
    expect(s.count("rotate")).toBeGreaterThanOrEqual(1);
    expect(s.fillStyleLog).toContain("#E0508C");
    expect(s.strokeStyleLog).toContain(KIT_PALETTE.cloud);
  });

  it("soft 关掉扫描线旋转", () => {
    const s = makeStubCtx();
    drawCompassRadar(s.ctx, { cx: 560, cy: 300, r: 40, t: 2, soft: true, dots });
    expect(s.count("rotate")).toBe(0);
    expect(s.fillStyleLog).toContain("#E0508C");
  });
});

describe("结算:奖杯、盾徽与长度曲线", () => {
  it("金银铜 + 参与奖四档杯色,名次映射正确", () => {
    expect(trophyColor(1)).toBe(TROPHY_COLORS[0]);
    expect(trophyColor(2)).toBe(TROPHY_COLORS[1]);
    expect(trophyColor(3)).toBe(TROPHY_COLORS[2]);
    expect(trophyColor(9)).toBe(TROPHY_COLORS[3]);
    expect(new Set(TROPHY_COLORS).size).toBe(4);
  });

  it("奖杯有杯身 / 双耳 / 底座三阶光影", () => {
    const gold = makeStubCtx();
    drawTrophy(gold.ctx, { x: 40, y: 40, r: 24, rank: 1 });
    expect(gold.count("fillRect")).toBeGreaterThanOrEqual(3);
    expect(gold.distinctFillStyles().length).toBeGreaterThanOrEqual(3);
    const silver = makeStubCtx();
    drawTrophy(silver.ctx, { x: 40, y: 40, r: 24, rank: 2 });
    expect(silver.snapshot()).not.toBe(gold.snapshot());
  });

  it("拦截盾徽写清拦下几条", () => {
    const s = makeStubCtx();
    drawShieldBadge(s.ctx, { x: 0, y: 0, r: 20, count: 3 });
    expect(s.textLog).toContain("3");
    expect(s.count("lineTo")).toBeGreaterThanOrEqual(8);
  });

  it("长度曲线两点起画,一点不画", () => {
    const none = makeStubCtx();
    drawLengthCurve(none.ctx, { x: 0, y: 0, w: 100, h: 50, points: [16] });
    expect(none.calls.length).toBe(0);
    const s = makeStubCtx();
    drawLengthCurve(s.ctx, { x: 0, y: 0, w: 100, h: 50, points: [16, 30, 22, 48] });
    expect(s.count("lineTo")).toBeGreaterThanOrEqual(5);
    expect(s.count("createLinearGradient")).toBe(1);
  });

  it("结算画布:奖杯 + 曲线齐上,拦到人才亮盾", () => {
    const withShield = makeStubCtx();
    drawSummary(withShield.ctx, { w: 320, h: 130, rank: 1, stops: 2, curve: [16, 40, 80] });
    expect(withShield.textLog).toContain("2");
    expect(withShield.textLog.some((t) => t.includes("第 1 名"))).toBe(true);
    const noShield = makeStubCtx();
    drawSummary(noShield.ctx, { w: 320, h: 130, rank: 4, stops: 0, curve: [16, 40, 80] });
    expect(noShield.textLog.some((t) => t === "0")).toBe(false);
  });
});

describe("极端输入不抛不画 NaN", () => {
  it("全家桶喂 NaN 都安静返回", () => {
    const s = makeStubCtx();
    expect(() => {
      drawStarBean(s.ctx, { x: Number.NaN, y: 0, r: 8 });
      drawGemDrop(s.ctx, { x: 0, y: 0, r: Number.NaN, value: 1 });
      drawBodyNode(s.ctx, { x: 0, y: 0, r: -2, color: "#8fd9a8" });
      drawSnakeHead(s.ctx, { x: 0, y: Number.POSITIVE_INFINITY, r: 8, angle: 0, color: "#8fd9a8" });
      drawFence(s.ctx, { cx: 0, cy: 0, r: 0, w: 10, h: 10, t: 0, theme: FIELD_THEMES.day });
      drawShrinkZone(s.ctx, { cx: 0, cy: 0, r: Number.NaN, w: 10, h: 10, t: 0 });
      drawFieldBackground(s.ctx, { w: -5, h: 10, camX: 0, camY: 0, zoom: 1, theme: FIELD_THEMES.day });
      drawCompassRadar(s.ctx, { cx: 0, cy: 0, r: 0, t: 0, dots: [] });
      drawTrophy(s.ctx, { x: 0, y: 0, r: Number.NaN, rank: 1 });
      drawShieldBadge(s.ctx, { x: 0, y: 0, r: 0, count: 1 });
      drawLengthCurve(s.ctx, { x: 0, y: 0, w: 0, h: 10, points: [1, 2] });
      drawNameTag(s.ctx, { x: Number.NaN, y: 0, text: "x", color: "#8fd9a8" });
    }).not.toThrow();
    expect(s.calls.length).toBe(0);
  });
});
