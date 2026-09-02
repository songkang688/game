/**
 * 接住小水果 · 1.3 第 20 步 A 档视觉用例（只增不减）。
 *
 * 覆盖 step 文档第九节的 12 条：配色板 token、剪影互异（kit 侧全测）、
 * emoji fillText 清除、press 回弹、篮内裁剪层上限、细节层阈值、
 * 红圈脉动参数只读、道具状态只读映射、reduced 全停、destroy 清零、
 * 玩法判定数值一个不动。全部跑在 node：源码字符串断言 + stub ctx。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FRUIT_DETAIL_MIN_PX,
  FRUIT_MAIN,
  fruitOutline
} from "../../art/kit/fruit";
import {
  BASKET_HALF,
  CATCH_Y,
  H,
  MAX_MISS,
  SNAP_PX,
  W,
  isCaught
} from "./logic";
import { THEME_SETS, HEAVY_FRUITS } from "./levels";
import {
  FC_BASKET_SHOW_MAX,
  FC_COLORS,
  FC_LAYERS,
  FC_PRESS_PX,
  FC_TIMING,
  FcFx,
  drawFcBasket,
  drawFcItemBody,
  drawFcScene,
  drawNaughtyCloud,
  fcBasketShown,
  fcBasketSquash,
  fcCloudX,
  fcIsNight,
  fcSpinAngle,
  fruitKindOf
} from "./visual";

const SRC = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const VISUAL_SRC = readFileSync(fileURLToPath(new URL("./visual.ts", import.meta.url)), "utf8");

interface StubCtx {
  ops: string[];
  texts: string[];
  ctx: CanvasRenderingContext2D;
}

function makeStubCtx(): StubCtx {
  const ops: string[] = [];
  const texts: string[] = [];
  const rec = (name: string) => (...args: unknown[]) => {
    ops.push(name);
    if (name === "fillText" && typeof args[0] === "string") texts.push(args[0]);
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
    createRadialGradient: (..._a: unknown[]) => {
      ops.push("createRadialGradient");
      return { addColorStop: () => undefined };
    },
    createLinearGradient: (..._a: unknown[]) => {
      ops.push("createLinearGradient");
      return { addColorStop: () => undefined };
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
  return { ops, texts, ctx: target as unknown as CanvasRenderingContext2D };
}

// 覆盖 BMP 之外的 emoji（🍎🧺 等都在补充平面或带变体选择符）
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

describe("视觉① 配色板与时序常量（step 文档四·补一 / 四·补三 逐字核对）", () => {
  it("十个 fc token 色值与表一致且格式合法", () => {
    expect(FC_COLORS.fcSkyDay).toBe("#DFF2FF");
    expect(FC_COLORS.fcSkyNight).toBe("#2E2A55");
    expect(FC_COLORS.fcGrass).toBe("#B8E39B");
    expect(FC_COLORS.fcBranch).toBe("#A87B4F");
    expect(FC_COLORS.fcBasket).toBe("#C89B6C");
    expect(FC_COLORS.fcApple).toBe("#F06B6B");
    expect(FC_COLORS.fcBanana).toBe("#F5D442");
    expect(FC_COLORS.fcGrape).toBe("#9F7AD8");
    expect(FC_COLORS.fcCloudGray).toBe("#B9BEC9");
    expect(FC_COLORS.fcShadow).toBe("rgba(90,74,60,.16)");
    for (const [k, v] of Object.entries(FC_COLORS)) {
      expect(v, k).toMatch(/^#[0-9A-F]{6}$|^rgba\(/);
    }
    // kit 的三种示例果主色与 token 一致
    expect(FRUIT_MAIN.apple).toBe(FC_COLORS.fcApple);
    expect(FRUIT_MAIN.banana).toBe(FC_COLORS.fcBanana);
    expect(FRUIT_MAIN.grape).toBe(FC_COLORS.fcGrape);
  });

  it("动效时序全部按毫秒表写死", () => {
    expect(FC_TIMING.spinDeg).toBe(8);
    expect(FC_TIMING.spinPeriodMs).toBe(1600);
    expect(FC_TIMING.pressSquash).toBe(0.08);
    expect(FC_TIMING.pressMs).toBe(120);
    expect(FC_TIMING.sparkCount).toBe(4);
    expect(FC_TIMING.sparkMs).toBe(280);
    expect(FC_TIMING.rainbowMs).toBe(300);
    expect(FC_TIMING.missFadeMs).toBe(240);
    expect(FC_TIMING.cloudSpeedA).toBe(0.1);
    expect(FC_TIMING.cloudSpeedB).toBe(0.18);
  });

  it("图层序从底到顶：天空→云→树枝→下落物→篮子→火花→警告红圈→HUD", () => {
    expect([...FC_LAYERS]).toEqual(["sky", "clouds", "branch", "items", "basket", "fx", "warnRing", "hud"]);
    // index.ts 的 draw 落笔顺序与图层序一致（场景→篮子→火花→红圈）
    const seg = SRC.slice(SRC.indexOf("function draw(): void"), SRC.indexOf("function finish"));
    const order = ["drawFcScene", "drawItem", "drawBasket", "fx.draw", "drawWarnRing"].map((s) => seg.indexOf(s));
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1], `第 ${i} 层顺序`).toBeGreaterThanOrEqual(0);
      expect(order[i], `第 ${i + 1} 层顺序`).toBeGreaterThan(order[i - 1]);
    }
  });
});

describe("视觉② emoji 直出清除（drawItem / drawBasket / 背景）", () => {
  it("drawItem / drawBasket 不再有 emoji fillText：🧺 与 it.emoji 直出清零", () => {
    expect(SRC).not.toContain('fillText("🧺"');
    expect(SRC).not.toContain("fillText(it.emoji");
    expect(SRC).not.toContain('c2d.font = "30px serif"');
    expect(SRC).not.toContain('c2d.font = "44px serif"');
  });

  it("背景 🌠⭐☁️🌤️🌙🌧️🍃🌬️🌈 直出同样清除，画布 fillText 里一个 emoji 都没有", () => {
    for (const ch of ["🌠", "⭐", "☁️", "🌤️", "🌙", "🌧️", "🍃", "🌬️", "🌈", "▶", "◀"]) {
      expect(SRC, `fillText 里残留了 ${ch}`).not.toMatch(new RegExp(`fillText\\(\\s*"${ch}`));
    }
    // 逐个 fillText 调用检查第一实参：字符串字面量里不许有 emoji
    for (const m of SRC.matchAll(/fillText\(\s*("(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)/g)) {
      expect(EMOJI_RE.test(m[1]), `画布文字里有 emoji：${m[1]}`).toBe(false);
    }
  });

  it("六种主题果 emoji 全部映射到六剪影之一，同款永远同剪影", () => {
    const all = new Set<string>(HEAVY_FRUITS);
    for (const t of THEME_SETS) for (const f of t.fruits) all.add(f);
    for (const emoji of all) {
      const kind = fruitKindOf(emoji);
      expect(["apple", "banana", "grape", "orange", "strawberry", "pear"], emoji).toContain(kind);
      expect(fruitKindOf(emoji), `${emoji} 两次映射不一致`).toBe(kind);
    }
  });

  it("自绘身体真的落笔：水果 / 捣蛋云 / 辣椒 / 星星 / 冰 / 磁铁 各有绘制调用且互不相同", () => {
    const kinds = ["fruit", "bad", "chili", "gold", "freeze", "magnet", "heavy"] as const;
    const shapes = new Map<string, string>();
    for (const k of kinds) {
      const s = makeStubCtx();
      drawFcItemBody(s.ctx, k, k === "fruit" ? "🍎" : k === "heavy" ? "🍉" : "", 15, 0);
      expect(s.ops.filter((o) => o === "fill" || o === "stroke").length, k).toBeGreaterThan(0);
      expect(s.texts, `${k} 不该用 fillText 画身体`).toHaveLength(0);
      shapes.set(k, s.ops.join(","));
    }
    expect(shapes.get("bad")).not.toBe(shapes.get("fruit"));
    expect(shapes.get("chili")).not.toBe(shapes.get("bad"));
  });
});

describe("视觉③ 藤篮：press 回弹 / 裁剪层上限 / 状态只读", () => {
  it("篮身回弹沿用 press 变量，判定线与篮口宽度一个像素不动", () => {
    // press 仍然是 drawBasket 的入参、tick 里仍按原速回弹
    expect(SRC).toMatch(/function drawBasket\(c2d: CanvasRenderingContext2D, x: number, press: number/);
    expect(SRC).toContain("press = Math.max(0, press - dt * 24)");
    expect(SRC).toContain("press = PRESS_PX");
    expect(FC_PRESS_PX).toBe(3);
    expect(SRC).toContain("const PRESS_PX = 3");
    // 玩法判定数值原封不动（1.2 基线）
    expect(BASKET_HALF).toBe(34);
    expect(SNAP_PX).toBe(8);
    expect(CATCH_Y).toBe(H - 20);
    expect(MAX_MISS).toBe(3);
    const reach = BASKET_HALF + SNAP_PX;
    expect(isCaught(100 + reach - 1, CATCH_Y, 100)).toBe(true);
    expect(isCaught(100 + reach + 2, CATCH_Y, 100)).toBe(false);
  });

  it("篮内裁剪层最多显示 3 个小图标：第 4 个起不再增加落笔", () => {
    expect(FC_BASKET_SHOW_MAX).toBe(3);
    expect(fcBasketShown(["apple", "banana", "grape", "orange", "pear"])).toEqual(["grape", "orange", "pear"]);
    const opsWith = (n: number): number => {
      const s = makeStubCtx();
      drawFcBasket(s.ctx, { x: 180, h: H, press: 0, reduced: false, recent: Array(n).fill("apple") });
      return s.ops.length;
    };
    expect(opsWith(3)).toBe(opsWith(5)); // 3 个封顶，再多也不加笔
    expect(opsWith(3)).toBeGreaterThan(opsWith(0)); // 裁剪层真的画了
    const s = makeStubCtx();
    drawFcBasket(s.ctx, { x: 180, h: H, press: 0, reduced: false, recent: ["apple"] });
    expect(s.ops).toContain("clip");
  });

  it("磁铁 / 冰冻的篮子样式只读道具状态：冻结的入参原样、绘制不抛", () => {
    const opts = Object.freeze({
      x: 180,
      h: H,
      press: 2,
      reduced: false,
      magnet: true,
      frozen: true,
      recent: Object.freeze(["apple", "banana"]) as readonly ("apple" | "banana")[]
    });
    const s = makeStubCtx();
    expect(() => drawFcBasket(s.ctx, opts)).not.toThrow();
    expect(opts.magnet).toBe(true);
    expect(opts.frozen).toBe(true);
    expect(opts.recent).toHaveLength(2);
    // 状态开着时确实多了泛蓝微光 / 冰凌的笔画
    const plain = makeStubCtx();
    drawFcBasket(plain.ctx, { x: 180, h: H, press: 2, reduced: false });
    expect(s.ops.length).toBeGreaterThan(plain.ops.length);
  });
});

describe("视觉④ 细节层阈值与警告物", () => {
  it("细节层在直径 < 18px 自动省略（阈值断言）", () => {
    expect(FRUIT_DETAIL_MIN_PX).toBe(18);
    expect(VISUAL_SRC).not.toContain("localStorage");
  });

  it("警告红圈脉动参数与 1.2 一字不差（只读断言），圈内换成小捣蛋云路径", () => {
    expect(SRC).toContain("Math.sin(t * 6) * 0.08");
    expect(SRC).toContain("21 * pulse");
    expect(SRC).toContain("setLineDash([5, 4])");
    expect(SRC).toContain('"rgba(226,86,86,.85)"');
    // 三个模式（闯关 / 双人 / 水果雨）都补了红圈层
    expect([...SRC.matchAll(/drawWarnRing\(c2d/g)].length).toBeGreaterThanOrEqual(3);
    // 圈内物是自绘小捣蛋云（皱眉乌云 + 两滴小雨），不再是 emoji
    expect(VISUAL_SRC).toMatch(/drawNaughtyCloud/);
    const s = makeStubCtx();
    drawNaughtyCloud(s.ctx, 0, 0, 14);
    expect(s.ops.filter((o) => o === "arc").length).toBeGreaterThanOrEqual(3);
    expect(s.texts).toHaveLength(0);
  });

  it("警告物语义不吓人：捣蛋云文案在、雨滴在、没有任何惊吓词", () => {
    expect(SRC).toContain("小捣蛋云");
    for (const bad of ["骷髅", "尖牙", "恐怖"]) {
      expect(SRC).not.toContain(bad);
      expect(VISUAL_SRC).not.toContain(bad);
    }
  });
});

describe("视觉⑤ reduced-motion：旋转 / 云移 / 彩虹 / 回弹全停，红圈保留", () => {
  it("fcSpinAngle：非 reduced 有 ±8° 摆动，reduced 恒 0", () => {
    const amp = (FC_TIMING.spinDeg * Math.PI) / 180;
    let peak = 0;
    for (let t = 0; t < 1.6; t += 0.05) peak = Math.max(peak, Math.abs(fcSpinAngle(t, 0, false)));
    expect(peak).toBeGreaterThan(amp * 0.9);
    expect(peak).toBeLessThanOrEqual(amp + 1e-9);
    for (let t = 0; t < 1.6; t += 0.05) expect(fcSpinAngle(t, 1.2, true)).toBe(0);
  });

  it("fcCloudX：非 reduced 两朵云 0.1×/0.18× 各走各的，reduced 静止在基准位", () => {
    expect(fcCloudX(9, 0, W, true)).toBe(fcCloudX(0, 0, W, true));
    expect(fcCloudX(9, 1, W, true)).toBe(fcCloudX(0, 1, W, true));
    expect(fcCloudX(5, 0, W, false)).not.toBe(fcCloudX(0, 0, W, false));
    const moveA = fcCloudX(5, 0, W, false) - fcCloudX(0, 0, W, false);
    const moveB = fcCloudX(5, 1, W, false) - fcCloudX(0, 1, W, false);
    expect(moveB).toBeGreaterThan(moveA); // 0.18× 比 0.1× 快
  });

  it("回弹与彩虹与星屑：reduced 全为 0，飘分文字保留（淡出型反馈）", () => {
    expect(fcBasketSquash(FC_PRESS_PX, false)).toBeCloseTo(FC_TIMING.pressSquash, 9);
    expect(fcBasketSquash(FC_PRESS_PX, true)).toBe(0);
    const quiet = new FcFx(true);
    quiet.catchBurst(10, 10, "#FF9E5E");
    quiet.flashRainbow(100);
    expect(quiet.sparks).toHaveLength(0);
    expect(quiet.rainbowLeft).toBe(0);
    quiet.scoreFloat(10, 10, "+1");
    expect(quiet.floats).toHaveLength(1);
    // 红圈是功能件：reduced 只停脉动不摘圈
    expect(SRC).toMatch(/calm \? 1 : 1 \+ Math\.sin\(t \* 6\) \* 0\.08/);
  });

  it("场景静态层次在 reduced 下保留：照样画天空 / 云 / 树枝 / 草地", () => {
    const s = makeStubCtx();
    drawFcScene(s.ctx, { w: W, h: H, theme: 0, t: 3, reduced: true });
    expect(s.ops.filter((o) => o === "fill" || o === "fillRect").length).toBeGreaterThan(4);
  });
});

describe("视觉⑥ 接住反馈与粒子生命周期", () => {
  it("星屑 4 颗、寿命 280ms；接到警告物出灰云雾 +「哎呀」气泡", () => {
    const fx = new FcFx(false);
    fx.catchBurst(50, 50, "#FF9E5E");
    expect(fx.sparks).toHaveLength(FC_TIMING.sparkCount);
    for (const sp of fx.sparks) expect(sp.life).toBeCloseTo(FC_TIMING.sparkMs / 1000, 9);
    fx.hazardPuff(60, 60);
    expect(fx.floats.some((f) => f.text === "哎呀")).toBe(true);
  });

  it("落空果弹地渐隐 240ms：reduced 直接渐隐（不弹跳），到点自动消失", () => {
    const fx = new FcFx(false);
    fx.missFade(120, "apple");
    expect(fx.fades[0].bounce).toBe(true);
    expect(fx.fades[0].life).toBeCloseTo(FC_TIMING.missFadeMs / 1000, 9);
    fx.step(FC_TIMING.missFadeMs / 1000 + 0.01);
    expect(fx.fades).toHaveLength(0);
    const quiet = new FcFx(true);
    quiet.missFade(120, "apple");
    expect(quiet.fades[0].bounce).toBe(false);
  });

  it("连 5 彩虹 300ms 一闪，step 到点归零", () => {
    const fx = new FcFx(false);
    fx.flashRainbow(180);
    expect(fx.rainbowLeft).toBeCloseTo(FC_TIMING.rainbowMs / 1000, 9);
    fx.step(0.31);
    expect(fx.rainbowLeft).toBe(0);
    // 三个模式都接了「连 5 闪彩虹」
    expect([...SRC.matchAll(/flashRainbow\(/g)].length).toBeGreaterThanOrEqual(2);
  });

  it("destroy 后粒子与计时归零：clear() 一把清空，pending() 为 0", () => {
    const fx = new FcFx(false);
    fx.catchBurst(10, 10, "#FF9E5E");
    fx.scoreFloat(10, 10, "+1");
    fx.missFade(10, "pear");
    fx.flashRainbow(10);
    expect(fx.pending()).toBeGreaterThan(0);
    fx.clear();
    expect(fx.pending()).toBe(0);
    expect(fx.sparks.length + fx.floats.length + fx.fades.length).toBe(0);
    // 三个模式的 destroy 都调了 fx.clear()
    expect([...SRC.matchAll(/fx\.clear\(\)/g)].length).toBeGreaterThanOrEqual(3);
  });
});

describe("视觉⑦ 场景语义与 360px 兜底", () => {
  it("昼夜只跟关卡主题映射：夜晚萤火与连击星光坡是夜，其余是昼", () => {
    expect(fcIsNight(5)).toBe(true);
    expect(fcIsNight(9)).toBe(true);
    for (const t of [0, 1, 2, 3, 4, 6, 7, 8]) expect(fcIsNight(t), `主题 ${t}`).toBe(false);
    // 不新增状态存储
    expect(VISUAL_SRC).not.toContain("sessionStorage");
  });

  it("「果子从树上掉下来」语义成立：树枝层贴着出生线上方，六剪影 18px 仍互异", () => {
    // 树枝画在顶部（drawFcBranchAndGrass 的枝干 y 都在 40 以内），水果从 SPAWN_Y=-20 冒头
    expect(VISUAL_SRC).toContain("drawFcBranchAndGrass");
    const seg = SRC.slice(SRC.indexOf("function draw(): void"));
    expect(seg).toContain("drawFcScene");
    // 18px（r=9）下取样轮廓依旧两两不同——小尺寸剪影可辨
    const sig = (k: Parameters<typeof fruitOutline>[0]): string =>
      fruitOutline(k, 9, 24).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(";");
    const kinds = ["apple", "banana", "grape", "orange", "strawberry", "pear"] as const;
    for (let i = 0; i < kinds.length; i++) {
      for (let j = i + 1; j < kinds.length; j++) {
        expect(sig(kinds[i]), `${kinds[i]} vs ${kinds[j]} @18px`).not.toBe(sig(kinds[j]));
      }
    }
  });
});
