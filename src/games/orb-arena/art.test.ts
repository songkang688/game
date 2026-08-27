/**
 * 圆圆大作战 · 1.3 视觉契约(资产级)。
 *
 * 用共享素材包的记录桩 `makeStubCtx` 逐个核验绘制函数:
 * 三阶光影、非纯色圆、人类/AI 可分辨、soft 关动效、极端输入不画 NaN。
 * 整帧级契约(drawPane 一帧)在 index.test.ts 里。
 */
import { describe, expect, it } from "vitest";
import { makeStubCtx } from "../../art/kit";
import {
  ARENA_THEMES,
  CANDY_COLORS,
  CREST_COLORS,
  SPIKE_COUNT,
  ZONE_ORBIT_DOTS,
  drawArenaBackground,
  drawJellyOrb,
  drawMassCurve,
  drawNameTag,
  drawPellet,
  drawResultArt,
  drawSpikeBall,
  drawSplitStretch,
  drawSpore,
  drawTrophy,
  drawZone,
  makePelletSprites,
  paintStarCandy,
  pelletStyle,
  themeFor
} from "./art";

const HEX = /^#[0-9a-f]{6}$/;

describe("果冻球(圆圆核心资产)", () => {
  it("伪体积三件套:径向渐变 + rim 描边 + 高光,不是单次 fill 的平涂圆", () => {
    const s = makeStubCtx();
    drawJellyOrb(s.ctx, { x: 50, y: 50, r: 30, color: "#f5a9c8" });
    expect(s.count("createRadialGradient")).toBeGreaterThanOrEqual(1);
    expect(s.count("fill")).toBeGreaterThanOrEqual(3);
    expect(s.count("stroke")).toBeGreaterThanOrEqual(2);
    // 三阶光影:去重后的 fillStyle 至少 3 种
    expect(s.distinctFillStyles().length).toBeGreaterThanOrEqual(3);
  });

  it("半径够大才有脸:r=30 的绘制调用比 r=6 多出眼睛和腮红那一截", () => {
    const big = makeStubCtx();
    drawJellyOrb(big.ctx, { x: 0, y: 0, r: 30, color: "#f5a9c8" });
    const small = makeStubCtx();
    drawJellyOrb(small.ctx, { x: 0, y: 0, r: 6, color: "#f5a9c8" });
    expect(big.count("arc")).toBeGreaterThan(small.count("arc") + 3);
  });

  it("人类戴头饰、AI 不戴:两种 owner 的绘制序列不同(头饰分支被走到)", () => {
    const human = makeStubCtx();
    drawJellyOrb(human.ctx, { x: 0, y: 0, r: 24, color: "#f5a9c8", crest: "star", crestColor: CREST_COLORS.star });
    const bot = makeStubCtx();
    drawJellyOrb(bot.ctx, { x: 0, y: 0, r: 24, color: "#f5a9c8", crest: null });
    expect(human.snapshot()).not.toBe(bot.snapshot());
    expect(human.calls.length).toBeGreaterThan(bot.calls.length);
  });

  it("双人头饰形状 + 颜色双通道:金星与银月的路径序列不同(色弱也能分)", () => {
    const p1 = makeStubCtx();
    drawJellyOrb(p1.ctx, { x: 0, y: 0, r: 24, color: "#f5a9c8", crest: "star" });
    const p2 = makeStubCtx();
    drawJellyOrb(p2.ctx, { x: 0, y: 0, r: 24, color: "#a9c8f5", crest: "moon" });
    expect(p1.snapshot()).not.toBe(p2.snapshot());
    expect(CREST_COLORS.star).not.toBe(CREST_COLORS.moon);
  });

  it("表情帧:张嘴吞吃 / 惊讶 O 嘴 / 平时微笑,三种画法互不相同", () => {
    const snap = (mouth: "smile" | "eat" | "oops"): string => {
      const s = makeStubCtx();
      drawJellyOrb(s.ctx, { x: 0, y: 0, r: 28, color: "#f5a9c8", mouth });
      return s.snapshot();
    };
    const smile = snap("smile");
    const eat = snap("eat");
    const oops = snap("oops");
    expect(eat).not.toBe(smile);
    expect(oops).not.toBe(smile);
    expect(eat).not.toBe(oops);
  });

  it("瞳孔朝移动方向偏移:朝左看与朝右看画出的坐标不同", () => {
    const left = makeStubCtx();
    drawJellyOrb(left.ctx, { x: 0, y: 0, r: 20, color: "#f5a9c8", lookX: -1, lookY: 0 });
    const right = makeStubCtx();
    drawJellyOrb(right.ctx, { x: 0, y: 0, r: 20, color: "#f5a9c8", lookX: 1, lookY: 0 });
    expect(left.snapshot()).not.toBe(right.snapshot());
  });

  it("头像模式:22px 小圆也强制画脸(排行榜复用同一个绘制函数)", () => {
    const ava = makeStubCtx();
    drawJellyOrb(ava.ctx, { x: 11, y: 13, r: 6.5, color: "#f5a9c8", avatar: true });
    const plain = makeStubCtx();
    drawJellyOrb(plain.ctx, { x: 11, y: 13, r: 6.5, color: "#f5a9c8" });
    expect(ava.count("arc")).toBeGreaterThan(plain.count("arc"));
  });

  it("极端输入不抛不画 NaN:r ≤ 0 / NaN 坐标一笔都不落", () => {
    const s = makeStubCtx();
    drawJellyOrb(s.ctx, { x: 0, y: 0, r: 0, color: "#f5a9c8" });
    drawJellyOrb(s.ctx, { x: Number.NaN, y: 0, r: 10, color: "#f5a9c8" });
    expect(s.calls.length).toBe(0);
    drawJellyOrb(s.ctx, { x: 0, y: 0, r: 20, color: "#f5a9c8", lookX: Number.NaN });
    expect(s.nonFiniteArgs).toBe(0);
  });
});

describe("星光糖(彩豆)", () => {
  it("三种造型逐个都不是纯色圆:主体渐变 + 白描边 + 高光", () => {
    for (const kind of [0, 1, 2] as const) {
      const s = makeStubCtx();
      paintStarCandy(s.ctx, 10, 10, 5, kind, 0.4, 0, false);
      expect(s.count("createRadialGradient"), `kind ${kind} 要有渐变`).toBeGreaterThanOrEqual(1);
      expect(s.count("fill"), `kind ${kind} 至少两次落笔`).toBeGreaterThanOrEqual(2);
      expect(s.count("stroke"), `kind ${kind} 要有白描边`).toBeGreaterThanOrEqual(1);
    }
    // 三种造型的路径序列彼此不同
    const snaps = ([0, 1, 2] as const).map((k) => {
      const s = makeStubCtx();
      paintStarCandy(s.ctx, 10, 10, 5, k, 0.4, 0, false);
      return s.snapshot();
    });
    expect(new Set(snaps).size).toBe(3);
  });

  it("确定性哈希选型:同一坐标永远同型同相位,三种造型都取得到", () => {
    const a = pelletStyle(123, 456);
    expect(pelletStyle(123, 456)).toEqual(a);
    const kinds = new Set<number>();
    for (let i = 0; i < 40; i++) kinds.add(pelletStyle(i * 13.7, i * 29.3).kind);
    expect(kinds.size).toBe(3);
    expect(CANDY_COLORS).toHaveLength(3);
    for (const c of CANDY_COLORS) expect(c).toMatch(HEX);
  });

  it("soft 关摆动:同一颗星糖在两个时刻画出的序列一致;非 soft 会动", () => {
    const at = (t: number, soft: boolean): string => {
      const s = makeStubCtx();
      paintStarCandy(s.ctx, 10, 10, 5, 0, 0.4, t, soft);
      return s.snapshot();
    };
    expect(at(0, true)).toBe(at(0.9, true));
    expect(at(0, false)).not.toBe(at(0.9, false));
  });

  it("没有 document 也不炸:精灵图建不出来返回 null,drawPellet 走矢量兜底", () => {
    expect(makePelletSprites()).toBeNull();
    const s = makeStubCtx();
    drawPellet(s.ctx, null, 10, 10, 4, 1, 0.2, 0, false);
    expect(s.count("createRadialGradient")).toBeGreaterThanOrEqual(1);
    expect(s.count("fill")).toBeGreaterThanOrEqual(2);
  });
});

describe("孢子与刺球", () => {
  it("孢子是带高光的小水珠,颜色跟 owner 走", () => {
    const s = makeStubCtx();
    drawSpore(s.ctx, 5, 5, 4, "#f5a9c8");
    expect(s.count("createRadialGradient")).toBe(1);
    expect(s.count("fill")).toBeGreaterThanOrEqual(2);
    const other = makeStubCtx();
    drawSpore(other.ctx, 5, 5, 4, "#a9c8f5");
    expect(other.snapshot()).not.toBe(s.snapshot());
  });

  it("仙人掌刺球:渐变内芯 + 逐根尖刺 + 凶脸,不是平面剪纸", () => {
    const s = makeStubCtx();
    drawSpikeBall(s.ctx, 40, 40, 24, 0, false);
    expect(s.count("createRadialGradient")).toBeGreaterThanOrEqual(1);
    // 逐根三角刺 + 刺尖描边 + 内芯 + 脸,落笔次数远超旧版单次 fill
    expect(s.count("fill")).toBeGreaterThanOrEqual(SPIKE_COUNT + 3);
    expect(s.count("stroke")).toBeGreaterThanOrEqual(SPIKE_COUNT + 3);
  });

  it("呼吸动画 ±3%:soft 停住(两个时刻序列一致),非 soft 在动", () => {
    const at = (t: number, soft: boolean): string => {
      const s = makeStubCtx();
      drawSpikeBall(s.ctx, 40, 40, 24, t, soft);
      return s.snapshot();
    };
    expect(at(0.2, true)).toBe(at(1.7, true));
    expect(at(0.2, false)).not.toBe(at(1.7, false));
  });
});

describe("风暴光环(缩圈)", () => {
  it("双层描边 + evenodd 圈外罩:rect 与 arc 同路径成环", () => {
    const s = makeStubCtx();
    drawZone(s.ctx, { x: 100, y: 80, r: 60, w: 200, h: 160, t: 0, soft: false, shrinking: false });
    expect(s.count("rect")).toBe(1);
    expect(s.count("arc")).toBeGreaterThanOrEqual(3);
    expect(s.count("fill")).toBeGreaterThanOrEqual(1);
    expect(s.count("stroke")).toBeGreaterThanOrEqual(2);
  });

  it("缩圈进行时有 8 个绕行光点;soft 一颗都不画", () => {
    const on = makeStubCtx();
    drawZone(on.ctx, { x: 100, y: 80, r: 60, w: 200, h: 160, t: 1, soft: false, shrinking: true });
    const off = makeStubCtx();
    drawZone(off.ctx, { x: 100, y: 80, r: 60, w: 200, h: 160, t: 1, soft: true, shrinking: true });
    expect(ZONE_ORBIT_DOTS).toBe(8);
    expect(on.count("fill")).toBeGreaterThanOrEqual(off.count("fill") + ZONE_ORBIT_DOTS);
  });
});

describe("糖果竞技场背景与主题", () => {
  it("三层背景:线性渐变打底、网格降到 6% 透明、视差圆斑用径向渐变", () => {
    const s = makeStubCtx();
    drawArenaBackground(s.ctx, {
      w: 320,
      h: 180,
      camX: 400,
      camY: 400,
      zoom: 1,
      mapW: 800,
      mapH: 800,
      theme: ARENA_THEMES[0]
    });
    expect(s.count("createLinearGradient")).toBe(1);
    expect(s.count("createRadialGradient")).toBe(7);
    expect(s.calls.some((c) => c.method === "set:globalAlpha" && c.args[0] === 0.06)).toBe(true);
  });

  it("走到世界边缘看得见糖果条纹墙,不是「突然没了」", () => {
    const edge = makeStubCtx();
    drawArenaBackground(edge.ctx, { w: 320, h: 180, camX: 10, camY: 10, zoom: 1, mapW: 800, mapH: 800, theme: ARENA_THEMES[0] });
    const middle = makeStubCtx();
    drawArenaBackground(middle.ctx, { w: 320, h: 180, camX: 400, camY: 400, zoom: 1, mapW: 800, mapH: 800, theme: ARENA_THEMES[0] });
    expect(edge.count("fillRect")).toBeGreaterThan(middle.count("fillRect") + 2);
  });

  it("每 47 关换一套主题:糖果紫 → 海洋青 → 黄昏橙 → 星夜蓝,色值全部合法", () => {
    expect(ARENA_THEMES).toHaveLength(4);
    expect(themeFor(0)).toBe(ARENA_THEMES[0]);
    expect(themeFor(46)).toBe(ARENA_THEMES[0]);
    expect(themeFor(47)).toBe(ARENA_THEMES[1]);
    expect(themeFor(94)).toBe(ARENA_THEMES[2]);
    expect(themeFor(141)).toBe(ARENA_THEMES[3]);
    expect(themeFor(187)).toBe(ARENA_THEMES[3]);
    expect(themeFor(-1)).toBe(ARENA_THEMES[0]);
    const seen = new Set<string>();
    for (const t of ARENA_THEMES) {
      for (const c of [t.bgTop, t.bgBottom, t.grid, t.blob, t.wallA, t.wallB]) expect(c).toMatch(HEX);
      seen.add(t.bgBottom);
    }
    expect(seen.size).toBe(4);
  });
});

describe("名字牌与分身拉丝", () => {
  it("名字牌是圆角胶囊 + 文字,替代裸 fillText", () => {
    const s = makeStubCtx();
    drawNameTag(s.ctx, 50, 50, "朵朵");
    expect(s.count("fill")).toBeGreaterThanOrEqual(1);
    expect(s.count("stroke")).toBeGreaterThanOrEqual(1);
    expect(s.textLog).toContain("朵朵");
    // 胶囊先落笔,文字后写(文字在最上层)
    const fillAt = s.calls.findIndex((c) => c.method === "fill");
    const textAt = s.calls.findIndex((c) => c.method === "fillText");
    expect(fillAt).toBeGreaterThanOrEqual(0);
    expect(textAt).toBeGreaterThan(fillAt);
  });

  it("分身拉丝:两球之间的果冻带,k 归零后一笔不画", () => {
    const s = makeStubCtx();
    drawSplitStretch(s.ctx, { x1: 0, y1: 0, r1: 10, x2: 60, y2: 0, r2: 8, color: "#f5a9c8", k: 1 });
    expect(s.count("lineTo")).toBeGreaterThanOrEqual(16);
    expect(s.count("fill")).toBe(1);
    const idle = makeStubCtx();
    drawSplitStretch(idle.ctx, { x1: 0, y1: 0, r1: 10, x2: 60, y2: 0, r2: 8, color: "#f5a9c8", k: 0 });
    expect(idle.calls.length).toBe(0);
  });
});

describe("结算画布:奖杯与质量曲线", () => {
  it("前三名金银铜奖杯,三种色调画出的序列互不相同", () => {
    const snaps = [1, 2, 3].map((rank) => {
      const s = makeStubCtx();
      drawResultArt(s.ctx, 260, 96, rank, [30, 80, 140]);
      return s.snapshot();
    });
    expect(new Set(snaps).size).toBe(3);
  });

  it("四名开外不发奖杯,画纪念章,依旧非空", () => {
    const s = makeStubCtx();
    drawResultArt(s.ctx, 260, 96, 7, [30, 60]);
    expect(s.count("fill")).toBeGreaterThanOrEqual(3);
    expect(s.textLog.join("")).toContain("第 7 名");
  });

  it("奖杯有三阶光影;质量曲线按采样逐点折线 + 面积渐变", () => {
    const t = makeStubCtx();
    drawTrophy(t.ctx, 40, 6, 50, "#ffd34e");
    expect(t.distinctFillStyles().length).toBeGreaterThanOrEqual(4);
    const c = makeStubCtx();
    drawMassCurve(c.ctx, 0, 0, 120, 60, [30, 50, 90, 140, 200]);
    expect(c.count("createLinearGradient")).toBe(1);
    expect(c.count("lineTo")).toBeGreaterThanOrEqual(8);
    const empty = makeStubCtx();
    drawMassCurve(empty.ctx, 0, 0, 120, 60, []);
    expect(empty.nonFiniteArgs).toBe(0);
  });
});
