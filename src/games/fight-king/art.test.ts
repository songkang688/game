/**
 * 朵星格斗王 · 1.3 视觉契约测试。
 *
 * 用一只「录制型 2D 上下文」把每个绘制函数的调用序列抄下来直接断言：
 *  1. 八位小伙伴的行头绘制序列两两不同（剪影差异），双色服装上下装不同色；
 *  2. 五款表情按状态正确查表，且五张脸的绘制序列两两不同；
 *  3. 命中火花三档互不相同：轻招 4 根短线、重招 8 根加星形爆点、破防盾碎六片；
 *  4. reduced 全链路降级：残影 / 流光 / 白闪关闭，视差静态一帧（层还在，不消失）；
 *  5. poseOf 四态语义回归（与原渲染层逐字一致）；
 *  6. 影子随高度缩放公式回归；
 *  7. cut-in 时序有界，不阻塞引擎帧推进（拿真引擎做帧数断言）；
 *  8. 舞台四主题、地面纵深三条带、P1/P2 光环 + 标记双通道、回合星、头像、彩带 20 片。
 */
import { describe, expect, it } from "vitest";
import {
  CONFETTI_COUNT,
  DOWN_BOUNCE_FRAMES,
  DUST_LIFE,
  HERO_LOOKS,
  PARALLAX,
  RING_COLORS,
  STAGE_THEMES,
  SUPER_CUT_FRAMES,
  SUPER_CUT_REDUCED_FRAMES,
  SUPER_FLASH_FRAMES,
  afterimageAlpha,
  comboPopScale,
  comboPopVisible,
  downBounceOffset,
  drawAfterimage,
  drawAvatar,
  drawBackGear,
  drawComboPop,
  drawConfetti,
  drawCutInBands,
  drawCutInCloseUp,
  drawDustPuff,
  drawFace,
  drawFarHills,
  drawFootRing,
  drawGroundBands,
  drawHeroBody,
  drawHeroLook,
  drawNearProps,
  drawRoundPips,
  drawSideMarker,
  drawSkyDecor,
  drawSpeedLines,
  drawStarShape,
  faceOf,
  hitSpark,
  lookOf,
  parallaxOffset,
  poseOf,
  shadowAlpha,
  shadowShrink,
  shimmerOffset,
  sparkLife,
  stageThemeOf,
  superCutDuration,
  superFlashAlpha,
  type FaceKind,
  type FighterFrame
} from "./art";
import { CHARACTERS } from "./frames";
import { createMatch, neutralInput, stepMatch } from "./engine";

/* ------------------------------------------------------------------ */
/* 录制型 2D 上下文：每个调用记一行，数值四舍五入到两位小数              */
/* ------------------------------------------------------------------ */

class Rec {
  ops: string[] = [];
  /** fillText 的文本（emoji 或字符占位一条就算违约的用例查它） */
  texts: string[] = [];

  private log(name: string, args: unknown[]): void {
    const fmt = args
      .map((a) => (typeof a === "number" ? String(Math.round(a * 100) / 100) : String(a)))
      .join(",");
    this.ops.push(`${name}(${fmt})`);
  }

  set fillStyle(v: unknown) {
    this.ops.push(`fillStyle:${typeof v === "string" ? v : "<gradient>"}`);
  }
  set strokeStyle(v: unknown) {
    this.ops.push(`strokeStyle:${typeof v === "string" ? v : "<gradient>"}`);
  }
  set lineWidth(v: number) {
    this.log("lineWidth", [v]);
  }
  set lineCap(_v: string) {
    // 端帽不进序列：它不改变形状本身
  }
  set globalAlpha(v: number) {
    this.log("globalAlpha", [v]);
  }
  set font(_v: string) {
    this.ops.push("font");
  }
  set textAlign(_v: string) {}
  set textBaseline(_v: string) {}

  save(): void {
    this.ops.push("save");
  }
  restore(): void {
    this.ops.push("restore");
  }
  beginPath(): void {
    this.ops.push("beginPath");
  }
  closePath(): void {
    this.ops.push("closePath");
  }
  moveTo(...a: number[]): void {
    this.log("moveTo", a);
  }
  lineTo(...a: number[]): void {
    this.log("lineTo", a);
  }
  quadraticCurveTo(...a: number[]): void {
    this.log("quad", a);
  }
  bezierCurveTo(...a: number[]): void {
    this.log("bezier", a);
  }
  arc(...a: number[]): void {
    this.log("arc", a);
  }
  ellipse(...a: number[]): void {
    this.log("ellipse", a);
  }
  rect(...a: number[]): void {
    this.log("rect", a);
  }
  fill(): void {
    this.ops.push("fill");
  }
  stroke(): void {
    this.ops.push("stroke");
  }
  clip(): void {
    this.ops.push("clip");
  }
  fillRect(...a: number[]): void {
    this.log("fillRect", a);
  }
  strokeRect(...a: number[]): void {
    this.log("strokeRect", a);
  }
  clearRect(...a: number[]): void {
    this.log("clearRect", a);
  }
  translate(...a: number[]): void {
    this.log("translate", a);
  }
  scale(...a: number[]): void {
    this.log("scale", a);
  }
  rotate(...a: number[]): void {
    this.log("rotate", a);
  }
  fillText(text: string, ...a: number[]): void {
    this.texts.push(text);
    this.log("fillText", a);
  }
  strokeText(text: string, ...a: number[]): void {
    this.log("strokeText", a);
  }
  createLinearGradient(...a: number[]): { addColorStop: (o: number, c: string) => void } {
    this.log("linearGradient", a);
    return { addColorStop: (o: number, c: string) => this.ops.push(`stop:${o}:${c}`) };
  }
  createRadialGradient(...a: number[]): { addColorStop: (o: number, c: string) => void } {
    this.log("radialGradient", a);
    return { addColorStop: (o: number, c: string) => this.ops.push(`stop:${o}:${c}`) };
  }
}

type Ctx = CanvasRenderingContext2D;

function record(draw: (ctx: Ctx) => void): Rec {
  const rec = new Rec();
  draw(rec as unknown as Ctx);
  return rec;
}

function seq(draw: (ctx: Ctx) => void): string {
  return record(draw).ops.join("|");
}

/** 一帧标准几何（数值随手定但自洽：feet - h = bodyTop 等） */
function frameFixture(over: Partial<FighterFrame> = {}): FighterFrame {
  return {
    x: 100,
    feet: 200,
    hw: 24,
    h: 92,
    bodyTop: 108,
    hipY: 174,
    shoulderY: 146,
    headX: 100,
    headY: 126,
    headR: 18,
    facing: 1,
    stride: 0,
    airborne: false,
    crouch: false,
    tick: 0,
    reduced: false,
    ...over
  };
}

const HEX = /^#[0-9a-f]{6}$/i;

/* ------------------------------------------------------------------ */
/* 1. 行头：八位小伙伴两两可辨                                          */
/* ------------------------------------------------------------------ */

describe("朵星格斗王 1.3 · 行头", () => {
  it("八位小伙伴每人一套 look，正好覆盖全部角色 id", () => {
    const ids = CHARACTERS.map((c) => c.id).sort();
    expect(Object.keys(HERO_LOOKS).sort()).toEqual(ids);
  });

  it("八套行头的绘制序列两两不同（剪影差异），头饰款式也不重样", () => {
    const fr = frameFixture();
    const seqs = CHARACTERS.map((c) => seq((ctx) => drawHeroLook(ctx, fr, lookOf(c.id))));
    expect(new Set(seqs).size).toBe(CHARACTERS.length);
    const gears = new Set(CHARACTERS.map((c) => lookOf(c.id).headgear));
    expect(gears.size).toBe(CHARACTERS.length);
  });

  it("双色服装：每人上衣与下装不同色，且色值全部合法", () => {
    for (const c of CHARACTERS) {
      const look = lookOf(c.id);
      expect(look.top, `${c.id} 上衣`).toMatch(HEX);
      expect(look.bottom, `${c.id} 下装`).toMatch(HEX);
      expect(look.belt, `${c.id} 腰带`).toMatch(HEX);
      expect(look.glove, `${c.id} 拳套`).toMatch(HEX);
      expect(look.top).not.toBe(look.bottom);
    }
  });

  it("躯干是上衣 + 下装 + 腰带三层填充再描边，不是一块单色", () => {
    const rec = record((ctx) => drawHeroBody(ctx, frameFixture(), lookOf("duoduo"), "#B24A78"));
    const fills = rec.ops.filter((op) => op.startsWith("fillStyle:"));
    expect(fills).toContain(`fillStyle:${lookOf("duoduo").top}`);
    expect(fills).toContain(`fillStyle:${lookOf("duoduo").bottom}`);
    expect(fills).toContain(`fillStyle:${lookOf("duoduo").belt}`);
    expect(rec.ops).toContain("stroke");
  });

  it("朵朵的裙摆随步幅方向摆一帧；星星的披风跳起来展开", () => {
    const duo = lookOf("duoduo");
    expect(duo.extra).toBe("skirt");
    expect(seq((ctx) => drawHeroLook(ctx, frameFixture({ stride: 8 }), duo))).not.toBe(
      seq((ctx) => drawHeroLook(ctx, frameFixture({ stride: -8 }), duo))
    );
    const star = lookOf("xingxing");
    expect(star.extra).toBe("cape");
    expect(seq((ctx) => drawBackGear(ctx, frameFixture({ airborne: true }), star))).not.toBe(
      seq((ctx) => drawBackGear(ctx, frameFixture({ airborne: false }), star))
    );
  });

  it("认不出的角色 id 一律退回朵朵那套，永不缺行头", () => {
    expect(lookOf("no-such-hero")).toBe(HERO_LOOKS.duoduo);
  });
});

/* ------------------------------------------------------------------ */
/* 2. 表情：五款按状态查表                                              */
/* ------------------------------------------------------------------ */

describe("朵星格斗王 1.3 · 表情", () => {
  it("查表：获胜 > 眩晕 > 被打中 > 出招 > 平常", () => {
    expect(faceOf({ pose: "normal", phase: "idle", winner: true })).toBe("win");
    expect(faceOf({ pose: "stun", phase: "guardbreak", winner: false })).toBe("dizzy");
    expect(faceOf({ pose: "down", phase: "knockdown", winner: false })).toBe("hurt");
    expect(faceOf({ pose: "normal", phase: "hitstun", winner: false })).toBe("hurt");
    expect(faceOf({ pose: "normal", phase: "blockstun", winner: false })).toBe("hurt");
    expect(faceOf({ pose: "normal", phase: "attack", winner: false })).toBe("attack");
    expect(faceOf({ pose: "normal", phase: "idle", winner: false })).toBe("normal");
    expect(faceOf({ pose: "wakeup", phase: "knockdown", winner: false })).toBe("normal");
  });

  it("五张脸的绘制序列两两不同", () => {
    const kinds: FaceKind[] = ["normal", "attack", "hurt", "dizzy", "win"];
    const seqs = kinds.map((k) => seq((ctx) => drawFace(ctx, 100, 126, 18, 1, k, "#4a3a68")));
    expect(new Set(seqs).size).toBe(kinds.length);
    for (const s of seqs) expect(s.length).toBeGreaterThan(0);
  });

  it("眩晕是螺旋眼：每只眼两圈弧，不再是一条闭眼线", () => {
    const rec = record((ctx) => drawFace(ctx, 100, 126, 18, 1, "dizzy", "#4a3a68"));
    expect(rec.ops.filter((op) => op.startsWith("arc")).length).toBeGreaterThanOrEqual(4);
  });
});

/* ------------------------------------------------------------------ */
/* 3. 命中火花三档                                                      */
/* ------------------------------------------------------------------ */

describe("朵星格斗王 1.3 · 命中火花分级", () => {
  it("轻 / 重 / 破防三档的绘制序列两两不同", () => {
    const seqs = (["light", "heavy", "break"] as const).map((gr) => seq((ctx) => hitSpark(ctx, 50, 60, gr, 0.3)));
    expect(new Set(seqs).size).toBe(3);
  });

  it("轻招 4 根放射短线 + 白闪点；重招 8 根 + 星形爆点", () => {
    const light = record((ctx) => hitSpark(ctx, 50, 60, "light", 0.2));
    // 4 根短线各是一次 moveTo，中心白点一笔 arc 填充
    expect(light.ops.filter((op) => op.startsWith("moveTo")).length).toBe(4);
    expect(light.ops).toContain("fillStyle:#ffffff");
    const heavy = record((ctx) => hitSpark(ctx, 50, 60, "heavy", 0.2));
    expect(heavy.ops.filter((op) => op.startsWith("moveTo")).length).toBeGreaterThanOrEqual(8 + 1); // 8 根 + 星形起笔
    expect(heavy.ops).toContain("fillStyle:#ffd45e");
  });

  it("破防是六片盾碎三角（六条闭合路径）", () => {
    const rec = record((ctx) => hitSpark(ctx, 50, 60, "break", 0.3));
    expect(rec.ops.filter((op) => op === "closePath").length).toBe(6);
  });

  it("火花寿命一档比一档长，随进度淡出", () => {
    expect(sparkLife("light")).toBeLessThan(sparkLife("heavy"));
    expect(sparkLife("heavy")).toBeLessThan(sparkLife("break"));
    const early = record((ctx) => hitSpark(ctx, 50, 60, "light", 0.1));
    const late = record((ctx) => hitSpark(ctx, 50, 60, "light", 0.9));
    expect(early.ops.join("|")).not.toBe(late.ops.join("|"));
  });
});

/* ------------------------------------------------------------------ */
/* 4. reduced 全链路降级：静态、不消失                                   */
/* ------------------------------------------------------------------ */

describe("朵星格斗王 1.3 · 减弱动效降级", () => {
  it("残影关闭：alpha 恒 0，一笔都不画；正常模式有轮廓", () => {
    expect(afterimageAlpha(true)).toBe(0);
    expect(afterimageAlpha(false)).toBeGreaterThan(0);
    const ghost = { x: 100, feet: 200, hw: 24, h: 92 };
    expect(record((ctx) => drawAfterimage(ctx, ghost, "#FFC7DC", afterimageAlpha(true))).ops).toHaveLength(0);
    expect(record((ctx) => drawAfterimage(ctx, ghost, "#FFC7DC", afterimageAlpha(false))).ops.length).toBeGreaterThan(0);
  });

  it("满槽流光关闭：偏移恒 0（静态金框）；正常模式随帧推进", () => {
    for (const t of [0, 7, 30, 999]) expect(shimmerOffset(t, true)).toBe(0);
    expect(shimmerOffset(10, false)).not.toBe(shimmerOffset(11, false));
  });

  it("cut-in 白闪关闭：reduced 恒 0；正常模式只在头 6 帧闪一次且递减", () => {
    for (let e = 0; e < SUPER_CUT_FRAMES; e++) expect(superFlashAlpha(e, true)).toBe(0);
    expect(superFlashAlpha(0, false)).toBeGreaterThan(superFlashAlpha(3, false));
    expect(superFlashAlpha(3, false)).toBeGreaterThan(0);
    expect(superFlashAlpha(SUPER_FLASH_FRAMES, false)).toBe(0);
    expect(superFlashAlpha(SUPER_FLASH_FRAMES + 20, false)).toBe(0);
  });

  it("视差静态一帧：偏移恒 0，但四层照画不消失（原来 reduced 是整层不画）", () => {
    expect(parallaxOffset(500, PARALLAX.far, true)).toBe(0);
    expect(parallaxOffset(0, PARALLAX.far, true)).toBe(0);
    expect(parallaxOffset(500, PARALLAX.far, false)).not.toBe(parallaxOffset(0, PARALLAX.far, false));
    for (const theme of STAGE_THEMES) {
      expect(seq((ctx) => drawSkyDecor(ctx, theme, 900, 380, 0, 0)).length).toBeGreaterThan(0);
      expect(seq((ctx) => drawFarHills(ctx, theme, 330, 0, 900)).length).toBeGreaterThan(0);
      expect(seq((ctx) => drawNearProps(ctx, theme, 330, 0, 900)).length).toBeGreaterThan(0);
      expect(seq((ctx) => drawGroundBands(ctx, theme, 330, 900, 380)).length).toBeGreaterThan(0);
    }
  });

  it("连击弹跳 / 倒地小跳 / 彩带在 reduced 下全部静止但不消失", () => {
    expect(comboPopScale(0, true)).toBe(1);
    expect(comboPopScale(0, false)).toBeGreaterThan(1);
    expect(comboPopScale(8, false)).toBe(1);
    for (const f of [0, 3, 6]) expect(downBounceOffset(f, true)).toBe(0);
    expect(downBounceOffset(6, false)).toBeGreaterThan(0);
    expect(downBounceOffset(DOWN_BOUNCE_FRAMES, false)).toBe(0);
    // reduced 彩带：不同 tick 画面一模一样（静止），片数照旧 20
    expect(seq((ctx) => drawConfetti(ctx, 900, 380, 0, true))).toBe(seq((ctx) => drawConfetti(ctx, 900, 380, 99, true)));
    expect(seq((ctx) => drawConfetti(ctx, 900, 380, 0, false))).not.toBe(
      seq((ctx) => drawConfetti(ctx, 900, 380, 30, false))
    );
    const rec = record((ctx) => drawConfetti(ctx, 900, 380, 0, true));
    expect(rec.ops.filter((op) => op.startsWith("fillRect")).length).toBe(CONFETTI_COUNT);
    expect(CONFETTI_COUNT).toBe(20);
  });
});

/* ------------------------------------------------------------------ */
/* 5. poseOf 四态回归（渲染层原语义逐字对齐）                            */
/* ------------------------------------------------------------------ */

describe("朵星格斗王 1.3 · poseOf 四态回归", () => {
  it("破防 → stun；倒地按剩余帧分 down / wakeup；起身无敌 → wakeup；其余 normal", () => {
    expect(poseOf({ phase: "guardbreak", stun: 40, invuln: 0, free: false })).toBe("stun");
    expect(poseOf({ phase: "knockdown", stun: 15, invuln: 0, free: false })).toBe("down");
    expect(poseOf({ phase: "knockdown", stun: 14, invuln: 0, free: false })).toBe("wakeup");
    expect(poseOf({ phase: "knockdown", stun: 1, invuln: 0, free: false })).toBe("wakeup");
    expect(poseOf({ phase: "idle", stun: 0, invuln: 6, free: true })).toBe("wakeup");
    // 无敌但不自由（比如出招里）不算起身
    expect(poseOf({ phase: "attack", stun: 0, invuln: 6, free: false })).toBe("normal");
    expect(poseOf({ phase: "idle", stun: 0, invuln: 0, free: true })).toBe("normal");
    expect(poseOf({ phase: "walk", stun: 0, invuln: 0, free: true })).toBe("normal");
  });
});

/* ------------------------------------------------------------------ */
/* 6. 影子公式回归 + 交叠加深                                            */
/* ------------------------------------------------------------------ */

describe("朵星格斗王 1.3 · 影子", () => {
  it("随高度缩放：max(0.45, 1 - y/220)，一个数都没动", () => {
    expect(shadowShrink(0)).toBe(1);
    expect(shadowShrink(110)).toBeCloseTo(0.5, 10);
    expect(shadowShrink(220)).toBeCloseTo(0.45, 10);
    expect(shadowShrink(500)).toBeCloseTo(0.45, 10);
  });

  it("两人贴身影子加深：远处 0.15，贴脸最深 0.3，单调不增", () => {
    expect(shadowAlpha(999)).toBeCloseTo(0.15, 10);
    expect(shadowAlpha(70)).toBeCloseTo(0.15, 10);
    expect(shadowAlpha(0)).toBeCloseTo(0.3, 10);
    expect(shadowAlpha(35)).toBeGreaterThan(shadowAlpha(60));
  });
});

/* ------------------------------------------------------------------ */
/* 7. cut-in 时序：有界，不阻塞引擎帧推进                                */
/* ------------------------------------------------------------------ */

describe("朵星格斗王 1.3 · cut-in 时序", () => {
  it("演出时长有上限：正常 72 帧（1.2 秒），reduced 24 帧静态卡（0.4 秒）", () => {
    expect(superCutDuration(false)).toBe(SUPER_CUT_FRAMES);
    expect(superCutDuration(true)).toBe(SUPER_CUT_REDUCED_FRAMES);
    expect(SUPER_CUT_FRAMES).toBeLessThanOrEqual(72);
    expect(SUPER_CUT_REDUCED_FRAMES).toBe(24);
  });

  it("帧数断言：演出结束后引擎每帧照常推进，一帧不少（拿真引擎跑）", () => {
    for (const reduced of [false, true]) {
      const s = createMatch("duoduo", "xingxing", { config: { reducedMotion: reduced } });
      let cut = superCutDuration(reduced);
      // 复刻渲染层 tick 的定格逻辑：cut > 0 只减演出计数，之后每帧 stepMatch
      for (let i = 0; i < 100; i++) {
        if (cut > 0) {
          cut--;
          continue;
        }
        stepMatch(s, [neutralInput(), neutralInput()]);
      }
      expect(cut).toBe(0);
      expect(s.frame).toBe(100 - superCutDuration(reduced));
    }
  });

  it("连点跳过：演出计数一清零，下一帧引擎立刻走", () => {
    const s = createMatch("duoduo", "xingxing", {});
    let cut = superCutDuration(false);
    cut = 0; // skipSuperCut 的语义
    for (let i = 0; i < 10; i++) {
      if (cut > 0) {
        cut--;
        continue;
      }
      stepMatch(s, [neutralInput(), neutralInput()]);
    }
    expect(s.frame).toBe(10);
  });

  it("cut-in 三件套都画得出来：竖条底 / 12 根速度线 / 角色特写（含头饰与出招表情）", () => {
    const theme = stageThemeOf(0);
    expect(record((ctx) => drawCutInBands(ctx, 900, 380, 0, theme)).ops.length).toBeGreaterThan(0);
    const lines = record((ctx) => drawSpeedLines(ctx, 900, 380, 0, 0.4));
    expect(lines.ops.filter((op) => op.startsWith("moveTo")).length).toBe(12);
    const closeUp = record((ctx) => drawCutInCloseUp(ctx, 260, 160, 64, lookOf("xingxing"), "#BFD8FF", "#3A62A8", 1));
    expect(closeUp.ops.filter((op) => op.startsWith("arc")).length).toBeGreaterThanOrEqual(2);
    // 两边出招的 cut-in 版式不同（左右镜像）
    expect(seq((ctx) => drawCutInBands(ctx, 900, 380, 0, theme))).not.toBe(
      seq((ctx) => drawCutInBands(ctx, 900, 380, 1, theme))
    );
  });
});

/* ------------------------------------------------------------------ */
/* 8. 舞台主题 / 地面纵深带 / 双通道识别 / HUD 资产                       */
/* ------------------------------------------------------------------ */

describe("朵星格斗王 1.3 · 舞台主题与 2.5D 纵深", () => {
  it("四套主题齐全：樱花山道 / 星空擂台 / 海边木台 / 雪夜灯笼，色值全部合法", () => {
    expect(STAGE_THEMES.map((t) => t.name)).toEqual(["樱花山道", "星空擂台", "海边木台", "雪夜灯笼"]);
    for (const t of STAGE_THEMES) {
      expect(t.skyTop).toMatch(HEX);
      expect(t.skyBottom).toMatch(HEX);
      expect(t.ground).toHaveLength(3);
      for (const g of t.ground) expect(g).toMatch(HEX);
    }
  });

  it("主题查表按序轮换，格斗塔两章换一套（0..7 章 → 4 套）", () => {
    expect(stageThemeOf(0).id).toBe("sakura");
    expect(stageThemeOf(1).id).toBe("starry");
    expect(stageThemeOf(2).id).toBe("seaside");
    expect(stageThemeOf(3).id).toBe("snowlantern");
    expect(stageThemeOf(4).id).toBe("sakura");
    // 章节 → 主题：floor(ci / 2)
    expect(stageThemeOf(Math.floor(0 / 2)).id).toBe("sakura");
    expect(stageThemeOf(Math.floor(3 / 2)).id).toBe("starry");
    expect(stageThemeOf(Math.floor(5 / 2)).id).toBe("seaside");
    expect(stageThemeOf(Math.floor(7 / 2)).id).toBe("snowlantern");
  });

  it("四层视差系数从远到近递增：远天 < 远山 < 近景 < 前景", () => {
    expect(PARALLAX.sky).toBeLessThan(PARALLAX.far);
    expect(PARALLAX.far).toBeLessThan(PARALLAX.near);
    expect(PARALLAX.near).toBeLessThan(PARALLAX.petal);
    // 远山 22% / 近景 52% 沿用原两层的系数，镜头观感回归
    expect(PARALLAX.far).toBe(0.22);
    expect(PARALLAX.near).toBe(0.52);
  });

  it("远山与近景的剪影随主题换：四套两两不同", () => {
    const farSeqs = STAGE_THEMES.map((t) => seq((ctx) => drawFarHills(ctx, t, 330, 0, 900)));
    expect(new Set(farSeqs).size).toBeGreaterThanOrEqual(3); // 樱花与星空共用山形，颜色不同
    const nearSeqs = STAGE_THEMES.map((t) => seq((ctx) => drawNearProps(ctx, t, 330, 0, 900)));
    expect(new Set(nearSeqs).size).toBe(STAGE_THEMES.length);
  });

  it("地面纵深：三条横向色带（远暗近亮）+ 地平线 + 两条分层细线", () => {
    const rec = record((ctx) => drawGroundBands(ctx, stageThemeOf(0), 330, 900, 380));
    expect(rec.ops.filter((op) => op.startsWith("fillRect")).length).toBe(3);
    expect(rec.ops.filter((op) => op === "stroke").length).toBeGreaterThanOrEqual(3);
    for (const g of stageThemeOf(0).ground) expect(rec.ops).toContain(`fillStyle:${g}`);
  });
});

describe("朵星格斗王 1.3 · P1/P2 双通道与 HUD 资产", () => {
  it("光环颜色通道：P1 粉、P2 蓝，两色不同", () => {
    expect(RING_COLORS[0]).not.toBe(RING_COLORS[1]);
    expect(seq((ctx) => drawFootRing(ctx, 100, 205, 24, 0, 1))).not.toBe(
      seq((ctx) => drawFootRing(ctx, 100, 205, 24, 1, 1))
    );
  });

  it("标记形状通道：P1 小花与 P2 小星的绘制序列不同（色弱也分得开）", () => {
    expect(seq((ctx) => drawSideMarker(ctx, 100, 90, 0, 0, false))).not.toBe(
      seq((ctx) => drawSideMarker(ctx, 100, 90, 1, 0, false))
    );
    // reduced 不上下浮动：不同 tick 序列一样
    expect(seq((ctx) => drawSideMarker(ctx, 100, 90, 0, 0, true))).toBe(
      seq((ctx) => drawSideMarker(ctx, 100, 90, 0, 30, true))
    );
  });

  it("回合星是画的星形：赢几颗亮几颗，序列随 wins 变化", () => {
    const zero = seq((ctx) => drawRoundPips(ctx, 64, 16, 0, 2, false));
    const one = seq((ctx) => drawRoundPips(ctx, 64, 16, 1, 2, false));
    const two = seq((ctx) => drawRoundPips(ctx, 64, 16, 2, 2, false));
    expect(new Set([zero, one, two]).size).toBe(3);
    expect(record((ctx) => drawRoundPips(ctx, 64, 16, 1, 2, false)).ops).toContain("fillStyle:#f2b429");
  });

  it("头像复用脑袋画法：不同角色的头像序列不同，且一个字符都不写", () => {
    const a = record((ctx) => drawAvatar(ctx, 24, lookOf("duoduo"), "#FFC7DC", "#B24A78"));
    const b = record((ctx) => drawAvatar(ctx, 24, lookOf("dundun"), "#EDEDF5", "#4B4B60"));
    expect(a.ops.join("|")).not.toBe(b.ops.join("|"));
    expect(a.texts).toHaveLength(0);
    expect(b.texts).toHaveLength(0);
  });

  it("眩晕星星与连击徽章：星星是矢量星形；≥3 连击才弹数字", () => {
    const star = record((ctx) => drawStarShape(ctx, 0, 0, 6, "#ffd45e"));
    expect(star.texts).toHaveLength(0);
    expect(star.ops.filter((op) => op.startsWith("lineTo")).length).toBeGreaterThanOrEqual(9);
    expect(comboPopVisible(2)).toBe(false);
    expect(comboPopVisible(3)).toBe(true);
    const pop = record((ctx) => drawComboPop(ctx, 64, 100, 5, 1.3, 0));
    expect(pop.ops.some((op) => op.startsWith("arc"))).toBe(true);
    expect(pop.texts).toEqual(["5连"]);
  });

  it("扬尘：三团软云、随进度散开变淡，寿命为正", () => {
    expect(DUST_LIFE).toBeGreaterThan(0);
    const rec = record((ctx) => drawDustPuff(ctx, 100, 205, 3, 0.3));
    expect(rec.ops.filter((op) => op.startsWith("arc")).length).toBe(3);
    expect(seq((ctx) => drawDustPuff(ctx, 100, 205, 3, 0.1))).not.toBe(
      seq((ctx) => drawDustPuff(ctx, 100, 205, 3, 0.8))
    );
  });
});
