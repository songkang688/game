/**
 * 弹弹小鸟 · 1.3 视觉契约(素材契约测试,水位只升不降)。
 *
 * 1.2 的渲染层短板:五种鸟身体是同一个圆、豆豆全场一个模子、
 * 粒子是纯色方块/圆、皮筋单线、背景无中景层、TNT 上还有字符「爆」。
 * 1.3 把绘制资产全部抽进 `art.ts`,这份契约钉死主管点名的五件事:
 *
 *  1. 五种鸟 kind 的绘制调用序列互不相同(体型差异生效);
 *  2. 方块残血时绘制调用多于满血(裂纹分级生效);
 *  3. 材质碎片按 kind 产生不同形状调用(至少木/冰两种可区分);
 *  4. 豆豆三种体型绘制序列不同;
 *  5. drawBirdArt 标准参数下产生非空绘制调用且含 createRadialGradient。
 *
 * 另按视觉宪法第九节补足:零字符占位、表情状态可达、速度线门控、
 * 相同参数逐次一致(弱动效静止的前提)、弹弓双线皮筋、星点弹道、
 * 中景剪影 / 草丛带 / 横幅角标非空且分章可辨、冲击波环衰减。
 * 录音式 ctx:把每一次方法调用与属性赋值记成序列,直接对序列做断言。
 */
import { describe, expect, it } from "vitest";
import {
  SHARD_COLORS,
  SHARD_SHAPE,
  beanVariant,
  crackColor,
  drawBannerBadge,
  drawBeanArt,
  drawBirdArt,
  drawBlockArt,
  drawGrassStrip,
  drawMidground,
  drawShard,
  drawShockRing,
  drawSlingshotArt,
  drawSparklePoint,
  pathStar,
  shade,
  shardShapeFor,
  type BeanVariant,
  type BirdMood
} from "./art";
import type { BirdKind, BlockKind } from "./levels";

interface Call {
  fn: string;
  args: unknown[];
}

/** 录音式 2D context:所有方法调用与属性赋值都进 calls 序列 */
function makeCtx(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (!(prop in t)) {
        t[prop] = (...args: unknown[]) => {
          calls.push({ fn: prop, args });
          if (prop === "createLinearGradient" || prop === "createRadialGradient") {
            return { addColorStop: () => {} };
          }
          if (prop === "measureText") return { width: 24 };
          return undefined;
        };
      }
      return t[prop];
    },
    set(t, prop: string, v) {
      calls.push({ fn: `set:${prop}`, args: [v] });
      t[prop] = v;
      return true;
    }
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

/** 把调用序列压成一条可比对的签名 */
function sig(calls: Call[]): string {
  return calls
    .map((c) => `${c.fn}(${c.args.map((a) => (typeof a === "number" ? a.toFixed(2) : String(a))).join(",")})`)
    .join(";");
}

/** 所有 fillText / strokeText 打出去的字符串 */
function texts(calls: Call[]): string[] {
  return calls.filter((c) => c.fn === "fillText" || c.fn === "strokeText").map((c) => String(c.args[0]));
}

function count(calls: Call[], fn: string): number {
  return calls.filter((c) => c.fn === fn).length;
}

const BIRD_KINDS: BirdKind[] = ["straight", "split", "slam", "drill", "boomerang"];
const BLOCK_KINDS: BlockKind[] = ["wood", "stone", "ice", "glass", "tnt", "shell", "core"];
const BEAN_VARIANTS: BeanVariant[] = ["sprout", "helmet", "elder"];

function birdCalls(kind: BirdKind, extra: Partial<Parameters<typeof drawBirdArt>[1]> = {}): Call[] {
  const { ctx, calls } = makeCtx();
  drawBirdArt(ctx, { kind, x: 60, y: 60, r: 10, angle: 0, flap: 0, mood: "idle", blink: 0, dash: 0, ...extra });
  return calls;
}

function blockCalls(kind: BlockKind, ratio: number): Call[] {
  const { ctx, calls } = makeCtx();
  drawBlockArt(ctx, { kind, x: 20, y: 20, w: 40, h: 20, ratio });
  return calls;
}

function beanCalls(variant: BeanVariant, extra: Partial<Parameters<typeof drawBeanArt>[2]> = {}): Call[] {
  const { ctx, calls } = makeCtx();
  drawBeanArt(ctx, variant, { x: 50, y: 50, r: 10, wob: 0, blink: 0, tilt: 0, ...extra });
  return calls;
}

describe("① 五种鸟体型差异(判定半径不动,只改绘制轮廓)", () => {
  it("五种 kind 的绘制调用序列两两互不相同", () => {
    const sigs = BIRD_KINDS.map((k) => sig(birdCalls(k)));
    for (let i = 0; i < sigs.length; i++) {
      expect(sigs[i].length, `${BIRD_KINDS[i]} 画了个寂寞`).toBeGreaterThan(0);
      for (let j = i + 1; j < sigs.length; j++) {
        expect(sigs[i], `${BIRD_KINDS[i]} 与 ${BIRD_KINDS[j]} 的绘制序列不许一样`).not.toBe(sigs[j]);
      }
    }
  });

  it("体型轮廓走不同原语:直冲圆 arc、分裂/横杆 ellipse、钻头贝塞尔水滴", () => {
    expect(count(birdCalls("drill"), "bezierCurveTo"), "钻头必须有贝塞尔拉尖").toBeGreaterThanOrEqual(2);
    // 分裂(瘦高)与横杆(矮胖)都是椭圆身体,但轴比不同 → 序列已在上一条钉死不同
    expect(count(birdCalls("split"), "ellipse")).toBeGreaterThan(0);
    expect(count(birdCalls("slam"), "ellipse")).toBeGreaterThan(0);
    // 卷卷两侧蓬毛:比直冲多至少 6 次 arc(每侧 3 撮)
    expect(count(birdCalls("boomerang"), "arc") - count(birdCalls("straight"), "arc")).toBeGreaterThanOrEqual(6);
  });

  it("⑤ drawBirdArt 标准参数下产生非空绘制调用且含 createRadialGradient", () => {
    const calls = birdCalls("straight");
    expect(calls.length).toBeGreaterThan(0);
    expect(count(calls, "createRadialGradient"), "身体必须有径向渐变").toBeGreaterThanOrEqual(1);
    expect(count(calls, "fill"), "尾羽/身体/肚皮/高光/眼睛至少五层填充").toBeGreaterThanOrEqual(5);
  });

  it("五种鸟全程零字符占位(眼睛嘴巴标记全是画的)", () => {
    for (const k of BIRD_KINDS) {
      expect(texts(birdCalls(k)), `${k} 不许打字符`).toEqual([]);
    }
  });

  it("表情状态可达且互不相同:拉弓鼓腮闭眼 / 飞行瞪眼 / 落地捂头", () => {
    const moods: BirdMood[] = ["idle", "charge", "fly", "rest"];
    const sigs = moods.map((m) => sig(birdCalls("straight", { mood: m, blink: m === "rest" ? 1 : 0 })));
    for (let i = 0; i < sigs.length; i++) {
      for (let j = i + 1; j < sigs.length; j++) {
        expect(sigs[i], `${moods[i]} 与 ${moods[j]} 的表情不许一样`).not.toBe(sigs[j]);
      }
    }
  });

  it("速度线门控:dash=1 比 dash=0 多画,dash=0 一根都不画(弱动效恒 0 即静止)", () => {
    const still = birdCalls("straight", { mood: "fly" });
    const fast = birdCalls("straight", { mood: "fly", dash: 1 });
    expect(fast.length).toBeGreaterThan(still.length);
    expect(count(fast, "stroke") - count(still, "stroke"), "身后 3 根速度线").toBeGreaterThanOrEqual(3);
  });

  it("相同参数两次绘制的序列逐字节一致(不含随机,弱动效可整体静止)", () => {
    expect(sig(birdCalls("boomerang", { mood: "fly", dash: 0.5 }))).toBe(
      sig(birdCalls("boomerang", { mood: "fly", dash: 0.5 }))
    );
  });
});

describe("② 方块残血裂纹分级", () => {
  it("残血时绘制调用多于满血:满血 < 半血 < 残血(每种材质都成立)", () => {
    for (const k of BLOCK_KINDS) {
      const full = blockCalls(k, 1).length;
      const half = blockCalls(k, 0.5).length;
      const low = blockCalls(k, 0.2).length;
      expect(half, `${k} ≤50% 该有一条折线裂纹`).toBeGreaterThan(full);
      expect(low, `${k} ≤25% 该再加三条放射裂纹`).toBeGreaterThan(half);
    }
  });

  it("血量 >50% 无裂纹:0.51 与 1.0 的序列一致;≤25% 放射裂纹从同一点出发 3 条", () => {
    expect(sig(blockCalls("wood", 0.51))).toBe(sig(blockCalls("wood", 1)));
    const low = blockCalls("wood", 0.25);
    const half = blockCalls("wood", 0.5);
    expect(count(low, "moveTo") - count(half, "moveTo"), "三条放射裂纹三次起笔").toBeGreaterThanOrEqual(3);
  });

  it("裂纹颜色取材质 edge 加深(合法 rgba),七种材质零字符(TNT 的「爆」已换成绘制火花)", () => {
    for (const k of BLOCK_KINDS) {
      expect(crackColor(k)).toMatch(/^rgba\(\d+,\d+,\d+,0\.6\)$/);
      expect(texts(blockCalls(k, 0.2)), `${k} 不许打字符`).toEqual([]);
    }
    // TNT 中央是画出来的八角火花(pathStar),不是文字
    expect(count(blockCalls("tnt", 1), "lineTo")).toBeGreaterThanOrEqual(15);
  });
});

describe("③ 材质碎片查表(碎裂粒子不再是纯色方块)", () => {
  it("木与冰的碎片形状可区分:查表不同、绘制序列不同", () => {
    expect(shardShapeFor("wood")).not.toBe(shardShapeFor("ice"));
    const wood = makeCtx();
    drawShard(wood.ctx, shardShapeFor("wood"), 4, SHARD_COLORS.wood[0]);
    const ice = makeCtx();
    drawShard(ice.ctx, shardShapeFor("ice"), 4, SHARD_COLORS.ice[0]);
    expect(wood.calls.length).toBeGreaterThan(0);
    expect(ice.calls.length).toBeGreaterThan(0);
    expect(sig(wood.calls)).not.toBe(sig(ice.calls));
    // 木片是圆角长条,冰片是带白描边的三角
    expect(count(wood.calls, "roundRect")).toBeGreaterThanOrEqual(1);
    expect(count(ice.calls, "lineTo")).toBeGreaterThanOrEqual(2);
    expect(count(ice.calls, "stroke"), "冰片要有白描边").toBeGreaterThanOrEqual(1);
  });

  it("六种材质形状表完整(冰玻璃共用三角),每种碎片非空且配色齐全", () => {
    const shapes = new Set(Object.values(SHARD_SHAPE));
    expect(shapes.size, "至少六种不同碎片形状(冰=玻璃)").toBeGreaterThanOrEqual(6);
    for (const k of BLOCK_KINDS) {
      const { ctx, calls } = makeCtx();
      drawShard(ctx, shardShapeFor(k), 4, SHARD_COLORS[k][0]);
      expect(calls.length, `${k} 的碎片画了个寂寞`).toBeGreaterThan(0);
      expect(SHARD_COLORS[k].length, `${k} 的碎片配色`).toBeGreaterThanOrEqual(2);
    }
    // 羽毛 / 叶子 / 星屑(演出粒子)也各自成形
    for (const shape of ["feather", "leaf", "star"] as const) {
      const { ctx, calls } = makeCtx();
      drawShard(ctx, shape, 4, "#FFD9E6");
      expect(calls.length, `${shape} 粒子画了个寂寞`).toBeGreaterThan(0);
    }
  });

  it("TNT 冲击波环:扩散淡出(t 越大越透明、越细),收尾把 globalAlpha 归 1", () => {
    const early = makeCtx();
    drawShockRing(early.ctx, 100, 100, 0.1, 64);
    const late = makeCtx();
    drawShockRing(late.ctx, 100, 100, 0.9, 64);
    const alphaOf = (calls: Call[]): number => Number(calls.find((c) => c.fn === "set:globalAlpha")?.args[0]);
    expect(alphaOf(early.calls)).toBeGreaterThan(alphaOf(late.calls));
    expect(early.calls.at(-1)).toEqual({ fn: "set:globalAlpha", args: [1] });
  });
});

describe("④ 豆豆三种体型家族化", () => {
  it("三种体型的绘制序列两两不同,且都含径向渐变与非空调用", () => {
    const sigs = BEAN_VARIANTS.map((v) => sig(beanCalls(v)));
    for (let i = 0; i < sigs.length; i++) {
      expect(sigs[i].length).toBeGreaterThan(0);
      for (let j = i + 1; j < sigs.length; j++) {
        expect(sigs[i], `${BEAN_VARIANTS[i]} 与 ${BEAN_VARIANTS[j]} 不许一个模子`).not.toBe(sigs[j]);
      }
    }
    for (const v of BEAN_VARIANTS) {
      expect(count(beanCalls(v), "createRadialGradient")).toBeGreaterThanOrEqual(1);
      expect(texts(beanCalls(v)), `${v} 不许打字符`).toEqual([]);
    }
  });

  it("体型序号查表确定:0 普通 1 戴盔 2 长辈,循环取模", () => {
    expect(beanVariant(0)).toBe("sprout");
    expect(beanVariant(1)).toBe("helmet");
    expect(beanVariant(2)).toBe("elder");
    expect(beanVariant(3)).toBe("sprout");
  });

  it("被击中的惊讶脸:与普通脸序列不同,O 形嘴 + 两粒飞汗滴", () => {
    const calm = beanCalls("sprout");
    const shock = beanCalls("sprout", { surprise: true });
    expect(sig(shock)).not.toBe(sig(calm));
    // 汗滴是两枚椭圆;O 嘴是一整圈 stroke 弧
    expect(count(shock, "ellipse") - count(calm, "ellipse")).toBeGreaterThanOrEqual(2);
  });

  it("眨眼分支可达:blink=1 与 blink=0 序列不同(弱动效恒 0 即静止睁眼)", () => {
    expect(sig(beanCalls("sprout", { blink: 1 }))).not.toBe(sig(beanCalls("sprout", { blink: 0 })));
  });
});

describe("弹弓 / 弹道 / 场景资产", () => {
  it("皮筋双线:装弹时暗边亮边两股;拉满(tension>0.8)加张力白高光,比松弛画得多", () => {
    const slack = makeCtx();
    drawSlingshotArt(slack.ctx, { x: 74, y: 236, groundY: 312, birdX: 40, birdY: 260, tension: 0 });
    const full = makeCtx();
    drawSlingshotArt(full.ctx, { x: 74, y: 236, groundY: 312, birdX: 30, birdY: 280, tension: 1 });
    expect(full.calls.length).toBeGreaterThan(slack.calls.length);
    // 双线皮筋 + 木叉双层 + 三道绑带:stroke 少不了
    expect(count(slack.calls, "stroke")).toBeGreaterThanOrEqual(8);
    // 空弓与装弹的皮筋形态不同
    const empty = makeCtx();
    drawSlingshotArt(empty.ctx, { x: 74, y: 236, groundY: 312, birdX: null, birdY: null, tension: 0 });
    expect(sig(empty.calls)).not.toBe(sig(slack.calls));
    expect(count(empty.calls, "quadraticCurveTo"), "空弓皮筋回弹成软弧").toBeGreaterThanOrEqual(2);
  });

  it("弹道预测点是四角星点(折线路径),精确段才描边;dots 数学不在本层", () => {
    const precise = makeCtx();
    drawSparklePoint(precise.ctx, 100, 80, 2.4, true);
    const fuzzy = makeCtx();
    drawSparklePoint(fuzzy.ctx, 100, 80, 2.4, false);
    expect(count(precise.calls, "lineTo"), "四角星至少 7 段折线").toBeGreaterThanOrEqual(7);
    expect(count(precise.calls, "stroke")).toBe(1);
    expect(count(fuzzy.calls, "stroke")).toBe(0);
    expect(count(fuzzy.calls, "arc"), "星点不是圆点").toBe(0);
  });

  it("中景剪影:草地/雪原/星空三章互不相同且非空;视差位移进 translate", () => {
    const sigs = [0, 2, 3].map((ch) => {
      const { ctx, calls } = makeCtx();
      drawMidground(ctx, ch, 312, 540, 0);
      expect(calls.length, `章节 ${ch} 中景画了个寂寞`).toBeGreaterThan(0);
      return sig(calls);
    });
    expect(sigs[0]).not.toBe(sigs[1]);
    expect(sigs[1]).not.toBe(sigs[2]);
    expect(sigs[0]).not.toBe(sigs[2]);
    const shifted = makeCtx();
    drawMidground(shifted.ctx, 0, 312, 540, 6);
    expect(shifted.calls.find((c) => c.fn === "translate")?.args[0]).toBe(6);
  });

  it("草丛带:三角草簇每 60px 一组铺满全场(540 宽 ≥ 8 组,每组 3 片)", () => {
    const { ctx, calls } = makeCtx();
    drawGrassStrip(ctx, 0, 312, 540);
    expect(count(calls, "moveTo"), "≥8 组 × 3 片草").toBeGreaterThanOrEqual(24);
    expect(count(calls, "fill")).toBeGreaterThanOrEqual(1);
  });

  it("横幅角标:草地小花/雪原雪花/星空五角星互不相同且非空、零字符", () => {
    const sigs = [0, 2, 3].map((ch) => {
      const { ctx, calls } = makeCtx();
      drawBannerBadge(ctx, 166, 47, 7, ch);
      expect(calls.length, `章节 ${ch} 角标画了个寂寞`).toBeGreaterThan(0);
      expect(texts(calls)).toEqual([]);
      return sig(calls);
    });
    expect(sigs[0]).not.toBe(sigs[1]);
    expect(sigs[1]).not.toBe(sigs[2]);
    expect(sigs[0]).not.toBe(sigs[2]);
  });

  it("颜色工具:shade 合法 rgb 且方向正确;pathStar 顶点数正确", () => {
    expect(shade("#808080", 32)).toBe("rgb(160,160,160)");
    expect(shade("#808080", -32)).toBe("rgb(96,96,96)");
    const { ctx, calls } = makeCtx();
    pathStar(ctx, 5, 10, 4.5);
    expect(count(calls, "lineTo")).toBe(9);
    expect(count(calls, "closePath")).toBe(1);
  });
});
