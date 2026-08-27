/**
 * 朵星擂台 · 1.3 视觉契约(素材契约测试,水位只升不降)。
 *
 * 1.2 的渲染层有四处扎眼的草稿位:眩晕表情是 `fillText("@ @")`、
 * 目标物全是 🪙/💫/🎁 emoji 字符、金币就是一个字、角色是纯色平面图形。
 * 1.3 把它们全部换成纯 Canvas 绘制资产(见 `art.ts`),这份契约钉死五件事:
 *
 *  1. 金币绘制**含渐变**(createRadialGradient 至少一次),不是纯色圆;
 *  2. 朵朵与星星的绘制调用序列**不同**(角色可分辨,形状 + 颜色双通道);
 *  3. 眩晕表情**不再**出现 `fillText("@ @")`;
 *  4. 目标物渲染**不再**包含 🪙/💫/🎁 emoji 字符串;
 *  5. `drawCourt` 在标准参数下产生**非空**绘制调用。
 *
 * 另按视觉宪法第九节补足:A/B 主色不等、调色板 #rrggbb 合法、
 * reduced-motion 降级分支可达(公转星 / 火花 / 盾面旋转全部静止)。
 * 录音式 ctx:把每一次方法调用与属性赋值记成序列,直接对序列做断言。
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  ART,
  BLUSH,
  drawBomb,
  drawDuoFlower,
  drawFacetStar,
  drawGift,
  drawIceShell,
  drawJellyPad,
  drawKitCoin,
  drawMascotFace,
  drawShieldHex,
  drawSkillIcon,
  drawSparkStar,
  drawStageGround,
  drawTargetBubble,
  hexAlpha,
  shadeHex,
} from "./art";
import { STAGES } from "./stages";
import { findOne, install, type Harness } from "./domStub";

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
    },
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

const HEX6 = /^#[0-9A-F]{6}$/i;

describe("调色板与颜色工具", () => {
  it("调色板全部是合法 #rrggbb,朵朵与星星主色不相等(A/B 双通道的颜色层)", () => {
    for (const [key, value] of Object.entries(ART)) {
      expect(value, `ART.${key}`).toMatch(HEX6);
    }
    expect(ART.duoFront).not.toBe(ART.starLight);
    expect(ART.duoBack).not.toBe(ART.starDark);
    expect(BLUSH.duo).not.toBe(BLUSH.star);
  });

  it("shadeHex / hexAlpha 算得对:0 幅度原样返回,alpha 进 rgba", () => {
    expect(shadeHex("#808080", 0)).toBe("#808080");
    expect(shadeHex("#000000", 1)).toBe("#FFFFFF");
    expect(shadeHex("#FFFFFF", -1)).toBe("#000000");
    expect(hexAlpha("#FF0000", 0.5)).toBe("rgba(255,0,0,0.5)");
  });
});

describe("金币:全产品标准件", () => {
  it("① 金币含径向渐变 + 厚度/内环/星印/高光多层细节,不是纯色圆", () => {
    const { ctx, calls } = makeCtx();
    drawKitCoin(ctx, 50, 50, 12);
    expect(count(calls, "createRadialGradient"), "金币必须有渐变").toBeGreaterThanOrEqual(1);
    expect(count(calls, "fill"), "厚度 + 币面 + 星印至少三层填充").toBeGreaterThanOrEqual(3);
    expect(count(calls, "stroke"), "内环 + 高光弧至少两道").toBeGreaterThanOrEqual(2);
    expect(count(calls, "lineTo"), "五角星压印的折线").toBeGreaterThanOrEqual(8);
    expect(texts(calls), "金币不许再打任何字符").toEqual([]);
  });
});

describe("双主角:朵朵与星星", () => {
  it("② 朵朵与星星的绘制调用序列不同(角色可分辨)", () => {
    const flower = makeCtx();
    drawDuoFlower(flower.ctx, 40, 40, 16);
    const star = makeCtx();
    drawFacetStar(star.ctx, 40, 40, 16);
    expect(flower.calls.length).toBeGreaterThan(0);
    expect(star.calls.length).toBeGreaterThan(0);
    expect(sig(flower.calls)).not.toBe(sig(star.calls));
  });

  it("朵朵每片前层花瓣有渐变提亮,星星有十个切面三角", () => {
    const flower = makeCtx();
    drawDuoFlower(flower.ctx, 40, 40, 16);
    expect(count(flower.calls, "createLinearGradient"), "六片前层花瓣各一条渐变").toBeGreaterThanOrEqual(6);
    expect(count(flower.calls, "ellipse"), "双层共十二片花瓣").toBeGreaterThanOrEqual(12);
    const star = makeCtx();
    drawFacetStar(star.ctx, 40, 40, 16);
    expect(count(star.calls, "fill"), "十个切面 + 星尖高光").toBeGreaterThanOrEqual(11);
  });
});

describe("表情:三层眼 + 查表嘴 + 螺旋眩晕", () => {
  it("③ 眩晕不再 fillText('@ @'):全程零字符,螺旋眼用弧线画", () => {
    const { ctx, calls } = makeCtx();
    drawMascotFace(ctx, 40, 40, 16, { who: "duo", mood: "dizzy", t: 0.8 });
    expect(texts(calls), "眩晕脸不许打任何字符").toEqual([]);
    expect(sig(calls)).not.toContain("@ @");
    expect(count(calls, "arc"), "两只螺旋眼至少四段弧").toBeGreaterThanOrEqual(4);
  });

  it("弱动效时公转小星静止:换个时间画,调用序列逐位一致;不开弱动效则会转", () => {
    const a = makeCtx();
    drawMascotFace(a.ctx, 40, 40, 16, { who: "star", mood: "dizzy", t: 0, reduceMotion: true });
    const b = makeCtx();
    drawMascotFace(b.ctx, 40, 40, 16, { who: "star", mood: "dizzy", t: 1.23, reduceMotion: true });
    expect(sig(a.calls)).toBe(sig(b.calls));
    const c = makeCtx();
    drawMascotFace(c.ctx, 40, 40, 16, { who: "star", mood: "dizzy", t: 1.23, reduceMotion: false });
    expect(sig(a.calls)).not.toBe(sig(c.calls));
  });

  it("待机 / 抓取 / 领先三种心情的嘴各不相同(查表生效)", () => {
    const moods = (["idle", "grab", "lead"] as const).map((mood) => {
      const { ctx, calls } = makeCtx();
      drawMascotFace(ctx, 40, 40, 16, { who: "duo", mood });
      return sig(calls);
    });
    expect(moods[0]).not.toBe(moods[1]);
    expect(moods[1]).not.toBe(moods[2]);
    expect(moods[0]).not.toBe(moods[2]);
  });
});

describe("目标物:全部绘制化", () => {
  it("④ 金币/迷糊泡/礼盒/软气泡全绘制,没有 🪙/💫/🎁 字符", () => {
    for (const [name, draw] of [
      ["coin", (ctx: CanvasRenderingContext2D) => drawKitCoin(ctx, 30, 30, 10)],
      ["bomb", (ctx: CanvasRenderingContext2D) => drawBomb(ctx, 30, 30, 10, { t: 1 })],
      ["gift", (ctx: CanvasRenderingContext2D) => drawGift(ctx, 30, 30, 10)],
      ["bubble", (ctx: CanvasRenderingContext2D) => drawTargetBubble(ctx, 30, 30, 14)],
    ] as const) {
      const { ctx, calls } = makeCtx();
      draw(ctx);
      expect(calls.length, `${name} 画了东西`).toBeGreaterThan(0);
      expect(texts(calls), `${name} 不打字符`).toEqual([]);
      expect(sig(calls), `${name} 里没有 emoji`).not.toMatch(/[🪙💫🎁✨🌸⭐]/u);
    }
  });

  it("迷糊泡火花两帧闪烁,弱动效时恒定不闪", () => {
    const f0 = makeCtx();
    drawBomb(f0.ctx, 30, 30, 10, { t: 0.05 });
    const f1 = makeCtx();
    drawBomb(f1.ctx, 30, 30, 10, { t: 0.2 });
    expect(sig(f0.calls), "两帧之间火花要变").not.toBe(sig(f1.calls));
    const r0 = makeCtx();
    drawBomb(r0.ctx, 30, 30, 10, { t: 0.05, reduceMotion: true });
    const r1 = makeCtx();
    drawBomb(r1.ctx, 30, 30, 10, { t: 0.2, reduceMotion: true });
    expect(sig(r0.calls), "弱动效时逐帧一致").toBe(sig(r1.calls));
  });

  it("软气泡底是白→透明径向渐变 + 顶部高光弧,不是纯白圆", () => {
    const { ctx, calls } = makeCtx();
    drawTargetBubble(ctx, 30, 30, 14);
    expect(count(calls, "createRadialGradient")).toBeGreaterThanOrEqual(1);
    expect(count(calls, "stroke"), "顶部高光弧").toBeGreaterThanOrEqual(1);
  });
});

describe("场地与地块:吃 stages 数据红利", () => {
  it("四张场地地面全有渐变,且互相长得不一样(云/花点/木纹星光/糖纹)", () => {
    const seen: string[] = [];
    for (const stage of STAGES) {
      const { ctx, calls } = makeCtx();
      drawStageGround(ctx, stage, 336, 186);
      expect(count(calls, "createLinearGradient"), `${stage.name} 地面渐变`).toBeGreaterThanOrEqual(1);
      expect(count(calls, "clip"), `${stage.name} 装饰裁进边界`).toBeGreaterThanOrEqual(1);
      const s = sig(calls);
      expect(seen, `${stage.name} 与其它场地画得一样`).not.toContain(s);
      seen.push(s);
    }
  });

  it("果冻垫:高光条 + 虚线缝线都在;会滑的垫子比不动的多两侧速度线", () => {
    const still = makeCtx();
    drawJellyPad(still.ctx, 10, 10, 60, 24, { tint: "#EAF3FF", sway: false });
    expect(count(still.calls, "clip"), "高光条要裁进垫身").toBeGreaterThanOrEqual(1);
    expect(count(still.calls, "setLineDash"), "缝线是虚线").toBeGreaterThanOrEqual(1);
    const sway = makeCtx();
    drawJellyPad(sway.ctx, 10, 10, 60, 24, { tint: "#EAF3FF", sway: true });
    expect(count(sway.calls, "stroke"), "速度线多出四道").toBeGreaterThan(count(still.calls, "stroke"));
  });
});

describe("特效与徽章", () => {
  it("加速 / 护盾 / 弹开波三个绘制图标互不相同(不再用 spec.emoji)", () => {
    const sigs = (["dash", "shield", "wave"] as const).map((id) => {
      const { ctx, calls } = makeCtx();
      drawSkillIcon(ctx, 20, 20, 6, id);
      expect(calls.length, `${id} 图标画了东西`).toBeGreaterThan(0);
      return sig(calls);
    });
    expect(sigs[0]).not.toBe(sigs[1]);
    expect(sigs[1]).not.toBe(sigs[2]);
    expect(sigs[0]).not.toBe(sigs[2]);
  });

  it("冰晶罩带径向渐变与冰锥;护盾是六边形盾面,弱动效时不随时间旋转", () => {
    const ice = makeCtx();
    drawIceShell(ice.ctx, 40, 40, 20);
    expect(count(ice.calls, "createRadialGradient")).toBeGreaterThanOrEqual(1);
    expect(count(ice.calls, "closePath"), "三根冰锥 + 闪点").toBeGreaterThanOrEqual(3);
    const s0 = makeCtx();
    drawShieldHex(s0.ctx, 40, 40, 24, { t: 0, reduceMotion: true });
    const s1 = makeCtx();
    drawShieldHex(s1.ctx, 40, 40, 24, { t: 2.4, reduceMotion: true });
    expect(sig(s0.calls)).toBe(sig(s1.calls));
    expect(count(s0.calls, "lineTo"), "六边形五条边").toBeGreaterThanOrEqual(5);
    const s2 = makeCtx();
    drawShieldHex(s2.ctx, 40, 40, 24, { t: 2.4, reduceMotion: false });
    expect(sig(s0.calls)).not.toBe(sig(s2.calls));
  });

  it("四芒星徽章用曲线切角(quadraticCurveTo ≥ 4),带白色中心亮点", () => {
    const { ctx, calls } = makeCtx();
    drawSparkStar(ctx, 40, 40, 8);
    expect(count(calls, "quadraticCurveTo")).toBeGreaterThanOrEqual(4);
    expect(count(calls, "arc"), "中心亮点").toBeGreaterThanOrEqual(1);
  });
});

/* ---------------- drawCourt 全挂载契约 ---------------- */

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

async function mountGame(h: Harness): Promise<{ destroy: () => void }> {
  const mod = await import("./index");
  return mod.mount({
    root: h.root as unknown as HTMLElement,
    play: () => {},
    onWin: () => {},
    onLose: () => {},
  } as never);
}

/** 把两块场地画布都换成录音 ctx,开擂打一阵,合流两边的调用序列 */
function recordBout(h: Harness): Call[] {
  const buckets: Call[][] = [];
  for (const cv of h.root.querySelectorAll("canvas")) {
    const rec = makeCtx();
    buckets.push(rec.calls);
    (cv as unknown as { getContext: () => CanvasRenderingContext2D }).getContext = () => rec.ctx;
  }
  findOne(h.root, "dua-start")?.fire("click");
  for (let i = 0; i < 4; i++) {
    h.runTimers();
    h.flush(2);
  }
  // 倒数 2.4 秒 + 回合里再跑约 4.5 秒,让各种目标真的出现在画面里
  h.flush(360, 20);
  return buckets.flat();
}

describe("drawCourt 全挂载契约", () => {
  it("⑤ 标准参数下 drawCourt 产生非空绘制调用,画面里再无 emoji/字符占位", async () => {
    const h = install();
    harness = h;
    const game = await mountGame(h);
    const calls = recordBout(h);
    expect(calls.length, "drawCourt 必须画出东西").toBeGreaterThan(0);
    expect(calls.filter((c) => c.fn === "createLinearGradient").length, "座位底色 / 地面是渐变").toBeGreaterThan(0);
    const printed = texts(calls);
    for (const s of printed) {
      expect(s, `画布字符「${s}」里不许有 emoji 占位`).not.toMatch(/[🪙💫🎁✨🌸⭐]|@ @/u);
    }
    // 技能徽章的文字说明还在(底板 + 图标 + 文案),孩子看得懂
    expect(printed.some((s) => s.includes("就绪") || s.includes("冷却中")), "技能徽章文案").toBe(true);
    game.destroy();
  });

  it("弱动效挂载一样能画:呼吸 / 脉冲 / 粒子全走静态分支,不抛异常", async () => {
    const h = install({ reduceMotion: true });
    harness = h;
    const game = await mountGame(h);
    const calls = recordBout(h);
    expect(calls.length).toBeGreaterThan(0);
    game.destroy();
  });
});
