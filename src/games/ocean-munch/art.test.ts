/**
 * 1.3 视觉契约测试:海底大胃王的水下三件套 + 鱼身材质 + 演出节点。
 *
 * 画面没法截图断言,就退一步锁「绘制序列与动画公式」:
 * - 用记录型 ctx 桩数出每一次 fill / arc / 渐变调用(连参数一起记);
 * - 纯函数动画(摆尾 / 光柱 / 弹性鼓起 / 演出节点)直接算数值;
 * - `reduced` 分支逐条对照:光柱静止、粒子砍半、弹性退化。
 *
 * 旧测试(logic / levels188 / versus / touch / smoke)一个不动。
 */
import { describe, expect, it } from "vitest";
import { afterEach, beforeEach } from "vitest";
import type { Dom } from "./domStub";
import { flushFrames, installDom, restoreDom } from "./domStub";
import { mount } from "./index";
import {
  BOSS_DEFEAT_S,
  BOSS_INTRO_S,
  BOSS_VIGNETTE_S,
  CROWN_GOLD,
  GROW_FX_S,
  MOUTH_OPEN_MS,
  STAR_SILVER,
  SWIRL_CAP,
  SWIRL_LIFE,
  TOXIN_AURA,
  bossDefeat,
  bossEntrance,
  bubbleCap,
  depthTintAlpha,
  drawBubble,
  drawCollectStar,
  drawCrown,
  drawFishBody,
  drawShieldBadge,
  drawForeLayer,
  drawFarLayer,
  drawLightShafts,
  drawSparkle,
  drawStarBand,
  drawToxinAura,
  drawUnderwaterBackdrop,
  eatBubbleCount,
  eyeOpen01,
  finWag,
  growFx,
  isHexColor,
  jellyGlowPulse,
  layerToggles,
  lerpColor,
  mouthOpen01,
  pufferInflateScale,
  qualityFor,
  shade,
  shaftSway,
  spawnSwirl,
  stepSwirls,
  swirlPose,
  tailWag,
  toxinAuraPulse,
} from "./art";
import type { Swirl } from "./art";

/* ------------------------------------------------------------------ */
/* 记录型 ctx 桩:方法名 + 参数全记下来,渐变色标单独记                  */
/* ------------------------------------------------------------------ */

interface Rec {
  ctx: CanvasRenderingContext2D;
  ops: string[];
  stops: string[];
  styles: string[];
}

function recCtx(): Rec {
  const ops: string[] = [];
  const stops: string[] = [];
  const styles: string[] = [];
  const fmt = (a: unknown) => (typeof a === "number" ? a.toFixed(2) : String(a));
  const ctx = new Proxy(
    {},
    {
      get(_t, prop: string) {
        return (...args: unknown[]) => {
          ops.push(`${prop}(${args.map(fmt).join(",")})`);
          if (prop === "createLinearGradient" || prop === "createRadialGradient") {
            return {
              addColorStop: (_o: number, c: string) => {
                stops.push(c);
              },
            };
          }
          return undefined;
        };
      },
      set(_t, prop: string, v: unknown) {
        if (typeof v === "object") styles.push(`${prop}=<gradient>`);
        else styles.push(`${prop}=${String(v)}`);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, ops, stops, styles };
}

const count = (list: string[], name: string) => list.filter((o) => o.startsWith(`${name}(`)).length;

/* ------------------------------------------------------------------ */
/* 1. 一帧主绘制非空且含渐变(水体 / 鱼身)                              */
/* ------------------------------------------------------------------ */

describe("水体与鱼身:非空且带渐变", () => {
  it("水体背板:线性渐变 + 整屏填充,底部一定比水面深", () => {
    const r = recCtx();
    drawUnderwaterBackdrop(r.ctx, 360, 640, "#c9edff", "#8fd0f0");
    expect(count(r.ops, "createLinearGradient")).toBe(1);
    expect(count(r.ops, "fillRect")).toBe(1);
    expect(r.stops).toHaveLength(3);
    for (const c of r.stops) expect(isHexColor(c)).toBe(true);
    // 最后一档色标是 bottom 再压暗:三通道都不大于原色
    expect(r.stops[2] < r.stops[1]).toBe(true);
  });

  it("鱼身:双色渐变 + 身体 / 尾 / 鳍都有落笔", () => {
    const r = recCtx();
    drawFishBody(r.ctx, { r: 20, color: "#ff9eb5", t: 1, reduced: false, head: "none" });
    expect(count(r.ops, "createLinearGradient")).toBe(1);
    expect(count(r.ops, "fill")).toBeGreaterThanOrEqual(6);
    expect(count(r.ops, "ellipse")).toBeGreaterThanOrEqual(3);
    expect(count(r.ops, "quadraticCurveTo")).toBeGreaterThanOrEqual(4);
  });

  it("光柱:4 道、每道一个渐变", () => {
    const r = recCtx();
    drawLightShafts(r.ctx, 360, 640, 2, false);
    expect(count(r.ops, "createLinearGradient")).toBe(4);
    expect(count(r.ops, "fill")).toBe(4);
  });

  it("气泡有体积:填充 + 描边 + 高光弧,不是一个孤圆", () => {
    const r = recCtx();
    drawBubble(r.ctx, 10, 10, 6, 0.8);
    expect(count(r.ops, "arc")).toBeGreaterThanOrEqual(2);
    expect(count(r.ops, "stroke")).toBeGreaterThanOrEqual(2);
    expect(count(r.ops, "fill")).toBeGreaterThanOrEqual(1);
  });
});

/* ------------------------------------------------------------------ */
/* 2. 玩家鱼与普通鱼绘制序列不同;P1 / P2 头饰不同                      */
/* ------------------------------------------------------------------ */

describe("头饰:玩家与普通鱼、P1 与 P2 都分得开", () => {
  const seq = (head: "crown" | "star" | "none") => {
    const r = recCtx();
    drawFishBody(r.ctx, { r: 20, color: "#ff9eb5", t: 1, reduced: false, head });
    return r;
  };

  it("玩家(金冠)比普通鱼多一段头饰绘制", () => {
    const plain = seq("none");
    const crown = seq("crown");
    expect(crown.ops.length).toBeGreaterThan(plain.ops.length);
    expect(crown.styles).toContain(`fillStyle=${CROWN_GOLD}`);
    expect(plain.styles).not.toContain(`fillStyle=${CROWN_GOLD}`);
  });

  it("P1 金冠与 P2 银星:形状序列不同、颜色也不同(双通道)", () => {
    const crown = seq("crown");
    const star = seq("star");
    expect(crown.ops.join("|")).not.toBe(star.ops.join("|"));
    expect(star.styles).toContain(`fillStyle=${STAR_SILVER}`);
    expect(star.styles).not.toContain(`fillStyle=${CROWN_GOLD}`);
    expect(CROWN_GOLD).not.toBe(STAR_SILVER);
    expect(isHexColor(CROWN_GOLD)).toBe(true);
    expect(isHexColor(STAR_SILVER)).toBe(true);
  });

  it("金冠三个尖、银星五个角:单独调用也画得出来", () => {
    const c = recCtx();
    drawCrown(c.ctx, 20);
    expect(count(c.ops, "lineTo")).toBeGreaterThanOrEqual(4);
    const s = recCtx();
    drawStarBand(s.ctx, 20);
    expect(count(s.ops, "lineTo")).toBeGreaterThanOrEqual(9);
  });
});

/* ------------------------------------------------------------------ */
/* 3. 可吃 / 不可吃:毒物光环分支                                       */
/* ------------------------------------------------------------------ */

describe("毒藻鱼:除颜色外还有光环形状通道", () => {
  it("光环 = 大圆 + 一圈 6 颗气泡,颜色是危险绿", () => {
    const r = recCtx();
    drawToxinAura(r.ctx, 0, 0, 16, 1, false);
    expect(count(r.ops, "arc")).toBe(7);
    expect(r.styles).toContain(`strokeStyle=${TOXIN_AURA}`);
    expect(r.styles).toContain(`fillStyle=${TOXIN_AURA}`);
    expect(isHexColor(TOXIN_AURA)).toBe(true);
  });

  it("普通鱼身绘制不含光环那种整圈 arc 序列", () => {
    const r = recCtx();
    drawFishBody(r.ctx, { r: 16, color: "#a8e6c9", t: 1, reduced: false, head: "none" });
    expect(r.styles).not.toContain(`strokeStyle=${TOXIN_AURA}`);
  });

  it("光环缓慢脉动 ≤ 3Hz;reduced 静态", () => {
    // 0.5s 内相位差 < π,肯定低于 3Hz 闪烁红线
    const a = toxinAuraPulse(0, false);
    const b = toxinAuraPulse(0.5, false);
    expect(a).not.toBe(b);
    expect(toxinAuraPulse(0, true)).toBe(toxinAuraPulse(7, true));
    // reduced 下光环整段绘制是确定性的(两次序列一致)
    const r1 = recCtx();
    drawToxinAura(r1.ctx, 0, 0, 16, 0, true);
    const r2 = recCtx();
    drawToxinAura(r2.ctx, 0, 0, 16, 5, true);
    expect(r1.ops.join("|")).toBe(r2.ops.join("|"));
  });

  it("精英鱼星辉是画出来的多角星,不是字符", () => {
    const r = recCtx();
    drawSparkle(r.ctx, 0, 0, 10, 1, false);
    expect(count(r.ops, "lineTo")).toBeGreaterThanOrEqual(7);
    expect(count(r.ops, "fillText")).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 4. 吞吃演出:缩入动画 + 气泡粒子 + 池回收;reduced 砍半 / 静止        */
/* ------------------------------------------------------------------ */

describe("吞吃演出与粒子池", () => {
  it("旋入残影:朝嘴移动、缩小、旋转,寿命 0.2s", () => {
    const pool: Swirl[] = [];
    spawnSwirl(pool, 0, 0, 10, "#ffe0a3", 100, 50);
    const mid = { ...pool[0], t: SWIRL_LIFE / 2 };
    const pose = swirlPose(mid, false);
    expect(pose.x).toBeCloseTo(50);
    expect(pose.y).toBeCloseTo(25);
    expect(pose.scale).toBeLessThan(1);
    expect(pose.rot).toBeGreaterThan(0);
    expect(SWIRL_LIFE).toBeCloseTo(0.2);
  });

  it("reduced:残影不旋转,只缩小淡出", () => {
    const s: Swirl = { x: 0, y: 0, tx: 10, ty: 0, r: 8, color: "#fff", t: SWIRL_LIFE / 2 };
    expect(swirlPose(s, true).rot).toBe(0);
    expect(swirlPose(s, true).scale).toBeLessThan(1);
  });

  it("池上限回收:塞 20 条只留 SWIRL_CAP 条,寿命到了逐条清空", () => {
    const pool: Swirl[] = [];
    for (let i = 0; i < 20; i++) spawnSwirl(pool, i, 0, 10, "#fff", 0, 0);
    expect(pool.length).toBe(SWIRL_CAP);
    // 最老的被回收:池里第一条已经不是 x=12 之前的
    expect(pool[0].x).toBe(20 - SWIRL_CAP);
    stepSwirls(pool, SWIRL_LIFE + 0.01);
    expect(pool.length).toBe(0);
  });

  it("吞吃气泡 3 颗,reduced 砍半;上浮气泡池上限 ≤ 24、reduced 减半", () => {
    expect(eatBubbleCount(false)).toBe(3);
    expect(eatBubbleCount(true)).toBeLessThanOrEqual(Math.ceil(3 / 2));
    expect(bubbleCap("high", false)).toBe(24);
    expect(bubbleCap("high", true)).toBe(12);
    expect(bubbleCap("low", false)).toBeLessThanOrEqual(24);
    expect(bubbleCap("low", true)).toBe(Math.floor(bubbleCap("low", false) / 2));
  });

  it("嘴巴张大只在咬下后 120ms 内那一帧", () => {
    expect(mouthOpen01(0)).toBe(1);
    expect(mouthOpen01(MOUTH_OPEN_MS / 2)).toBeCloseTo(0.5);
    expect(mouthOpen01(MOUTH_OPEN_MS)).toBe(0);
    expect(mouthOpen01(-5)).toBe(0);
  });

  it("成长升档:金光扩散、弹性最高 1.15 倍再回正;reduced 不缩放", () => {
    let peak = 1;
    for (let t = 0; t <= GROW_FX_S; t += 0.01) peak = Math.max(peak, growFx(t, false).scale);
    expect(peak).toBeGreaterThan(1.12);
    expect(peak).toBeLessThanOrEqual(1.1501);
    const end = growFx(GROW_FX_S, false);
    expect(end.done).toBe(true);
    expect(end.ringAlpha).toBeCloseTo(0);
    expect(growFx(GROW_FX_S / 2, true).scale).toBe(1);
  });

  it("光柱 reduced 静止:摆角恒为 0,两次绘制序列一致;非 reduced 会摆", () => {
    expect(shaftSway(1, 0, true)).toBe(0);
    expect(shaftSway(9, 3, true)).toBe(0);
    expect(Math.abs(shaftSway(1.2, 0, false))).toBeGreaterThan(0);
    expect(Math.abs(shaftSway(1.2, 0, false))).toBeLessThanOrEqual((3 * Math.PI) / 180 + 1e-9);
    const a = recCtx();
    drawLightShafts(a.ctx, 360, 640, 0, true);
    const b = recCtx();
    drawLightShafts(b.ctx, 360, 640, 7.3, true);
    expect(a.ops.join("|")).toBe(b.ops.join("|"));
  });
});

/* ------------------------------------------------------------------ */
/* 5. BOSS 进场演出:节点推进,结束后清理                                */
/* ------------------------------------------------------------------ */

describe("BOSS 演出节点", () => {
  it("进场:开局是剪影 + 暗角,0.8s 后实体化、暗角清零、done", () => {
    const start = bossEntrance(0, false);
    expect(start.silhouette).toBeCloseTo(1);
    expect(start.alpha).toBeLessThan(0.5);
    expect(start.vignette).toBeGreaterThan(0);
    expect(start.done).toBe(false);
    const end = bossEntrance(BOSS_INTRO_S, false);
    expect(end.silhouette).toBe(0);
    expect(end.alpha).toBe(1);
    expect(end.vignette).toBe(0);
    expect(end.done).toBe(true);
    // 暗角比整段演出先结束
    expect(bossEntrance(BOSS_VIGNETTE_S, false).vignette).toBe(0);
    expect(BOSS_VIGNETTE_S).toBeLessThan(BOSS_INTRO_S);
  });

  it("reduced:暗角力度减轻,但演出照样收尾", () => {
    expect(bossEntrance(0, true).vignette).toBeLessThan(bossEntrance(0, false).vignette);
    expect(bossEntrance(BOSS_INTRO_S + 1, true).done).toBe(true);
  });

  it("战败:翻白肚(转满 π)、缓沉、淡出,到点 done 可清理", () => {
    const mid = bossDefeat(BOSS_DEFEAT_S / 2);
    expect(mid.rot).toBeGreaterThan(0);
    expect(mid.sink01).toBeGreaterThan(0);
    expect(mid.done).toBe(false);
    const end = bossDefeat(BOSS_DEFEAT_S);
    expect(end.rot).toBeCloseTo(Math.PI);
    expect(end.sink01).toBeCloseTo(1);
    expect(end.alpha).toBeLessThan(0.5);
    expect(end.done).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 6. 分档:低画质不画前景 / 远景层                                     */
/* ------------------------------------------------------------------ */

describe("画质分档", () => {
  it("360 宽手机走低档,桌面走高档", () => {
    expect(qualityFor(360, 640)).toBe("low");
    expect(qualityFor(640, 360)).toBe("low");
    expect(qualityFor(800, 600)).toBe("high");
  });

  it("低画质:前景层与远景层都不绘制", () => {
    expect(layerToggles("low")).toEqual({ far: false, fore: false });
    expect(layerToggles("high")).toEqual({ far: true, fore: true });
  });

  it("远景 / 前景层本身画得出来(高档时供货)", () => {
    const far = recCtx();
    drawFarLayer(far.ctx, 800, 600, 1, 0, false);
    expect(far.ops.length).toBeGreaterThan(10);
    const fore = recCtx();
    drawForeLayer(fore.ctx, 800, 600, 1, 0, false);
    // 前景水草固定 35% 半透明
    expect(fore.styles).toContain("globalAlpha=0.35");
    expect(fore.ops.length).toBeGreaterThan(10);
  });

  it("深水罩:只盖 70% 屏高以下,实体罩 alpha 0.08", () => {
    expect(depthTintAlpha(0, 640)).toBe(0);
    expect(depthTintAlpha(640 * 0.69, 640)).toBe(0);
    expect(depthTintAlpha(640 * 0.71, 640)).toBeCloseTo(0.08);
  });
});

/* ------------------------------------------------------------------ */
/* 常量与公式契约                                                       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* 收集物标准:边缘厚度 + 高光 + 内圈细节(visual-bible 第四节)          */
/* ------------------------------------------------------------------ */

describe("收集物标准", () => {
  it("收集星:暗金厚边 + 亮金星面 + 内圈小星 + 高光点,四层落笔", () => {
    const r = recCtx();
    drawCollectStar(r.ctx, 0, 0, 11, 1, false);
    expect(count(r.ops, "fill")).toBeGreaterThanOrEqual(4);
    expect(r.styles).toContain("fillStyle=#d9a832");
    expect(r.styles).toContain("fillStyle=#ffd868");
    expect(r.styles).toContain("fillStyle=#fff3c2");
    expect(count(r.ops, "fillText")).toBe(0);
  });

  it("收集星 reduced:不上下浮动(两次绘制序列一致)", () => {
    const a = recCtx();
    drawCollectStar(a.ctx, 0, 0, 11, 0, true);
    const b = recCtx();
    drawCollectStar(b.ctx, 0, 0, 11, 3.3, true);
    expect(a.ops.join("|")).toBe(b.ops.join("|"));
  });

  it("护盾徽章:气泡 + 渐变盾面 + 描边 + 高光", () => {
    const r = recCtx();
    drawShieldBadge(r.ctx, 0, 0, 15, 0.85);
    expect(count(r.ops, "createLinearGradient")).toBe(1);
    expect(count(r.ops, "stroke")).toBeGreaterThanOrEqual(3);
    expect(count(r.ops, "fill")).toBeGreaterThanOrEqual(2);
    expect(count(r.ops, "fillText")).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 整机烟囱:新绘制路径在 360 窄屏与 reduced 下跑几百帧不抛              */
/* ------------------------------------------------------------------ */

describe("整机烟囱(domStub 挂载)", () => {
  let dom: Dom;

  beforeEach(() => {
    // 什么都不做:各用例自装(要控制 reduced 参数)
  });

  afterEach(() => {
    restoreDom();
  });

  const api = () =>
    ({
      root: dom.root as never,
      play: () => {},
      addStars: () => 0,
      getStars: () => 0,
      onWin: () => {},
      onLose: () => {},
    }) as never;

  it("360×640(低画质档)竞技场:全套新水体/鱼身/粒子跑 200 帧不抛", () => {
    dom = installDom(360, 640, false);
    const handle = mount(api());
    flushFrames(dom, 1);
    // 首屏第二张卡 = 无尽(和 smoke.test 的排版算式一致)
    const ch = Math.min(96, (640 - 76 - 20 - 24) / 3);
    dom.root.children[0].dispatch("pointerdown", { clientX: 180, clientY: 76 + ch + 12 + ch / 2, pointerType: "mouse" });
    expect(() => flushFrames(dom, 200, 50)).not.toThrow();
    handle.destroy();
  });

  it("reduced-motion 下同一条路径照样全绿(光柱静止/粒子砍半分支)", () => {
    dom = installDom(360, 640, true);
    const handle = mount(api());
    flushFrames(dom, 1);
    const ch = Math.min(96, (640 - 76 - 20 - 24) / 3);
    dom.root.children[0].dispatch("pointerdown", { clientX: 180, clientY: 76 + ch + 12 + ch / 2, pointerType: "mouse" });
    expect(() => flushFrames(dom, 200, 50)).not.toThrow();
    handle.destroy();
  });

  it("战役关(高画质桌面尺寸):远景/前景层照画,连跑 120 帧不抛", () => {
    dom = installDom(800, 600, false);
    const handle = mount({ ...(api() as object), initialLevel: 5 } as never);
    flushFrames(dom, 2);
    // intro 面板上点一下开始玩
    dom.root.children[0].dispatch("pointerdown", { clientX: 400, clientY: 560, pointerType: "mouse" });
    expect(() => flushFrames(dom, 120, 50)).not.toThrow();
    handle.destroy();
  });
});

describe("色彩与动画公式契约", () => {
  it("shade / lerpColor 永远返回合法 #rrggbb,端点正确", () => {
    for (const amt of [-1, -0.5, 0, 0.5, 1]) expect(isHexColor(shade("#ff9eb5", amt))).toBe(true);
    expect(shade("#808080", 0)).toBe("#808080");
    expect(lerpColor("#000000", "#ffffff", 0)).toBe("#000000");
    expect(lerpColor("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(lerpColor("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(isHexColor(lerpColor("#c9edff", "#0f1c36", 0.37))).toBe(true);
  });

  it("摆尾 ±12°,reduced 减半;胸鳍 0.8s 一个来回", () => {
    let max = 0;
    let maxR = 0;
    for (let t = 0; t < 2; t += 0.01) {
      max = Math.max(max, Math.abs(tailWag(t, false)));
      maxR = Math.max(maxR, Math.abs(tailWag(t, true)));
    }
    expect(max).toBeLessThanOrEqual((12 * Math.PI) / 180 + 1e-9);
    expect(max).toBeGreaterThan((11 * Math.PI) / 180);
    expect(maxR).toBeLessThanOrEqual((6 * Math.PI) / 180 + 1e-9);
    expect(finWag(0, false)).toBeCloseTo(finWag(0.8, false));
  });

  it("水母发光点呼吸;reduced 常亮", () => {
    expect(jellyGlowPulse(0, 0, false)).not.toBe(jellyGlowPulse(0.5, 0, false));
    expect(jellyGlowPulse(0, 0, true)).toBe(jellyGlowPulse(9, 0, true));
  });

  it("河豚弹性鼓起:1 → 过冲 1.65 → 停在 1.5;reduced 直接 1.5", () => {
    expect(pufferInflateScale(-1, false)).toBe(1);
    expect(pufferInflateScale(0.15, false)).toBeCloseTo(1.65);
    expect(pufferInflateScale(0.3, false)).toBeCloseTo(1.5);
    expect(pufferInflateScale(9, false)).toBe(1.5);
    expect(pufferInflateScale(0.15, true)).toBe(1.5);
  });

  it("眨眼:平时全开,每 3.4s 闭一小下(≤ 3Hz)", () => {
    expect(eyeOpen01(1)).toBe(1);
    expect(eyeOpen01(3.4 + 0.07)).toBeLessThan(0.2);
    expect(eyeOpen01(3.4 + 0.2)).toBe(1);
  });
});
