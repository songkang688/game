import { describe, expect, it } from "vitest";
import { hexToRgb, makeStubCtx } from "../../art/kit";
import { CHARACTERS, characterById } from "./frames";
import { chapterStartOf } from "./levels";
import {
  AURA_COLORS,
  CONFETTI_COUNT,
  HEAVY_LEAN,
  HIT_FLASH_FRAMES,
  HIT_SPARK_RAYS,
  KO_FRAMES,
  PETAL_MAX,
  SHARD_COUNT,
  STAGE_THEMES,
  drawArcSlash,
  drawComboPop,
  drawConfettiPiece,
  drawFighterHead,
  drawGuardShard,
  drawHitSpark,
  drawKoBanner,
  drawMiniAvatar,
  drawMiniStar,
  drawProjectileOrb,
  drawQFighter,
  drawSeatAura,
  drawStage,
  drawWinBadges,
  koBannerText,
  makeConfetti,
  makeShatter,
  poseOf,
  stageThemeOf,
  type PoseInput,
  type QFighterOpts
} from "./art";

const duo = characterById("duoduo");
const star = characterById("xingxing");

function pose(patch: Partial<PoseInput> = {}) {
  return poseOf({
    phase: "idle",
    stance: "stand",
    moveKind: null,
    seg: null,
    prog: 0,
    tick: 0,
    won: false,
    ...patch
  });
}

function fighterOpts(patch: Partial<QFighterOpts> = {}): QFighterOpts {
  return {
    x: 200,
    feet: 214,
    groundY: 214,
    facing: 1,
    color: duo.color,
    ink: duo.ink,
    look: duo.look,
    halfWidth: duo.halfWidth,
    height: duo.height,
    crouchHeight: duo.crouchHeight,
    pose: pose(),
    strike: null,
    t: 0.3,
    ...patch
  };
}

describe("combo-clash · look 外观查表(frames 纯外观字段)", () => {
  it("十位角色都有 look,头饰剪影两两不同", () => {
    const hats = CHARACTERS.map((c) => c.look.hat);
    expect(hats).toHaveLength(10);
    expect(new Set(hats).size).toBe(10);
  });

  it("服装二色都是合法 #rrggbb,朵朵花瓣头饰、星星星形头饰", () => {
    for (const c of CHARACTERS) {
      expect(hexToRgb(c.look.dress)).not.toBeNull();
      expect(hexToRgb(c.look.trim)).not.toBeNull();
    }
    expect(duo.look.hat).toBe("flower");
    expect(star.look.hat).toBe("star");
  });
});

describe("combo-clash · 姿态查表 poseOf(纯函数,不碰帧数)", () => {
  it("idle 呼吸浮动 ≤ 2px,双拳收着不出招", () => {
    for (const tick of [0, 30, 60, 90]) {
      const p = pose({ tick });
      expect(Math.abs(p.bob)).toBeLessThanOrEqual(2);
      expect(p.strike).toBe(0);
      expect(p.lying).toBe(false);
    }
  });

  it("walk 是两帧交替步", () => {
    expect(pose({ phase: "walk", tick: 0 }).step).toBe(1);
    expect(pose({ phase: "walk", tick: 8 }).step).toBe(-1);
    expect(pose({ phase: "walk", tick: 16 }).step).toBe(1);
  });

  it("轻拳三段:startup 收拳 → active 拳全伸 → recovery 收回", () => {
    const su = pose({ phase: "attack", moveKind: "light", seg: "startup", prog: 0 });
    const ac = pose({ phase: "attack", moveKind: "light", seg: "active", prog: 0.5 });
    const re = pose({ phase: "attack", moveKind: "light", seg: "recovery", prog: 0.9 });
    expect(su.strike).toBeGreaterThan(0);
    expect(su.strike).toBeLessThan(1);
    expect(ac.strike).toBe(1);
    expect(re.strike).toBeLessThan(su.strike + 0.65);
    expect(re.strike).toBeLessThan(ac.strike);
  });

  it("重脚身体后倾 8°", () => {
    const p = pose({ phase: "attack", moveKind: "heavy", seg: "active", prog: 0 });
    expect(p.lean).toBeCloseTo(HEAVY_LEAN, 5);
    expect(HEAVY_LEAN).toBeCloseTo((8 * Math.PI) / 180, 5);
  });

  it("crouch 屈膝、hitstun 后仰苦脸、knockdown 躺倒、rest 坐下", () => {
    expect(pose({ phase: "crouch" }).crouch).toBe(1);
    const hs = pose({ phase: "hitstun" });
    expect(hs.lean).toBeGreaterThan(0);
    expect(hs.mood).toBe("hurt");
    expect(pose({ phase: "knockdown" }).lying).toBe(true);
    expect(pose({ phase: "rest" }).sitting).toBe(true);
  });

  it("胜者举手,blockstun 抱盾", () => {
    const win = pose({ won: true });
    expect(win.raise).toBe(true);
    expect(win.mood).toBe("win");
    expect(pose({ phase: "blockstun" }).guard).toBe(true);
  });
});

describe("combo-clash · 二头身 Q 版格斗家(不再是单矩形)", () => {
  it("一次绘制 ≥ 6 个填充路径(头/身/四肢/头饰分层)", () => {
    const stub = makeStubCtx();
    drawQFighter(stub.ctx, fighterOpts());
    expect(stub.count("fill")).toBeGreaterThanOrEqual(6);
    expect(stub.nonFiniteArgs).toBe(0);
  });

  it("身体有渐变与描边,配色 ≥ 5 种(三阶光影)", () => {
    const stub = makeStubCtx();
    drawQFighter(stub.ctx, fighterOpts());
    expect(stub.count("createLinearGradient")).toBeGreaterThanOrEqual(1);
    expect(stub.count("stroke")).toBeGreaterThanOrEqual(2);
    expect(stub.distinctFillStyles().length).toBeGreaterThanOrEqual(5);
  });

  it("出招帧与 idle 帧绘制序列不同(姿态查表被走到)", () => {
    const a = makeStubCtx();
    drawQFighter(a.ctx, fighterOpts());
    const b = makeStubCtx();
    drawQFighter(
      b.ctx,
      fighterOpts({
        pose: pose({ phase: "attack", moveKind: "light", seg: "active", prog: 0.5 }),
        strike: { dx: 39, dy: 59, limb: "arm" }
      })
    );
    expect(a.snapshot()).not.toBe(b.snapshot());
  });

  it("蹲下不是压扁矩形:crouch 与 stand 序列不同且都在画", () => {
    const stand = makeStubCtx();
    drawQFighter(stand.ctx, fighterOpts());
    const crouch = makeStubCtx();
    drawQFighter(crouch.ctx, fighterOpts({ pose: pose({ phase: "crouch" }) }));
    expect(crouch.count("fill")).toBeGreaterThanOrEqual(6);
    expect(stand.snapshot()).not.toBe(crouch.snapshot());
  });

  it("倒地画躺姿 + 头顶转圈星(画的星形,不是 ✦ 字符)", () => {
    const stub = makeStubCtx();
    drawQFighter(stub.ctx, fighterOpts({ pose: pose({ phase: "knockdown" }) }));
    expect(stub.count("fill")).toBeGreaterThanOrEqual(6);
    expect(stub.textLog).toHaveLength(0);
  });

  it("十位角色的 look 全部画得出来,不产生 NaN 坐标", () => {
    for (const c of CHARACTERS) {
      const stub = makeStubCtx();
      drawQFighter(
        stub.ctx,
        fighterOpts({ color: c.color, ink: c.ink, look: c.look, halfWidth: c.halfWidth, height: c.height, crouchHeight: c.crouchHeight })
      );
      expect(stub.count("fill")).toBeGreaterThanOrEqual(6);
      expect(stub.nonFiniteArgs).toBe(0);
    }
  });

  it("头饰剪影可区分:花瓣头 / 星形头 / 熊耳画出的序列互不相同", () => {
    const snaps = ["duoduo", "xingxing", "dundun"].map((id) => {
      const c = characterById(id);
      const stub = makeStubCtx();
      drawFighterHead(stub.ctx, { x: 0, y: 0, r: 16, look: c.look, color: c.color, ink: c.ink, mood: "normal", blink: false, t: 0 });
      return stub.snapshot();
    });
    expect(new Set(snaps).size).toBe(3);
  });

  it("极端输入(NaN / 非正身高)不抛也不画", () => {
    const stub = makeStubCtx();
    drawQFighter(stub.ctx, fighterOpts({ x: Number.NaN }));
    drawQFighter(stub.ctx, fighterOpts({ height: 0 }));
    expect(stub.calls.length).toBe(0);
  });
});

describe("combo-clash · P1/P2 光环(颜色 + 形状双通道)", () => {
  it("P1 红圆环:画 arc,用 p1 红", () => {
    const stub = makeStubCtx();
    drawSeatAura(stub.ctx, { x: 100, groundY: 214, side: 0, t: 0.4, soft: false });
    expect(stub.count("arc")).toBeGreaterThanOrEqual(2);
    expect(stub.count("strokeRect")).toBe(0);
    expect(stub.strokeStyleLog).toContain(AURA_COLORS.p1);
  });

  it("P2 蓝方环:画 strokeRect,用 p2 蓝;两侧序列不同", () => {
    const p2 = makeStubCtx();
    drawSeatAura(p2.ctx, { x: 100, groundY: 214, side: 1, t: 0.4, soft: false });
    expect(p2.count("strokeRect")).toBeGreaterThanOrEqual(2);
    expect(p2.strokeStyleLog).toContain(AURA_COLORS.p2);
    const p1 = makeStubCtx();
    drawSeatAura(p1.ctx, { x: 100, groundY: 214, side: 0, t: 0.4, soft: false });
    expect(p1.snapshot()).not.toBe(p2.snapshot());
    expect(AURA_COLORS.p1).not.toBe(AURA_COLORS.p2);
  });
});

describe("combo-clash · 出招弧光与命中特效", () => {
  it("弧光是月牙渐变,轻招与重招画法不同(重招带残影)", () => {
    const light = makeStubCtx();
    drawArcSlash(light.ctx, { x: 0, y: 0, facing: 1, size: 30, k: 0.2, kind: "light", color: duo.color, soft: false });
    const heavy = makeStubCtx();
    drawArcSlash(heavy.ctx, { x: 0, y: 0, facing: 1, size: 30, k: 0.2, kind: "heavy", color: duo.color, soft: false });
    expect(light.count("createLinearGradient")).toBeGreaterThanOrEqual(1);
    expect(light.count("fill")).toBeGreaterThanOrEqual(1);
    expect(heavy.count("fill")).toBeGreaterThan(light.count("fill"));
    expect(light.snapshot()).not.toBe(heavy.snapshot());
  });

  it("命中火花:放射短线 6–8 根 + 中心闪白圆,0.15s 播完", () => {
    expect(HIT_SPARK_RAYS).toBeGreaterThanOrEqual(6);
    expect(HIT_SPARK_RAYS).toBeLessThanOrEqual(8);
    expect(HIT_FLASH_FRAMES).toBe(9);
    const stub = makeStubCtx();
    drawHitSpark(stub.ctx, { x: 50, y: 60, k: 0.4, power: 10 });
    expect(stub.count("moveTo")).toBe(HIT_SPARK_RAYS);
    expect(stub.count("arc")).toBeGreaterThanOrEqual(2);
    expect(stub.fillStyleLog).toContain("#ffffff");
  });

  it("破防:蓝色三角盾碎片正好 6 片,画的是三角形", () => {
    expect(SHARD_COUNT).toBe(6);
    const shards = makeShatter(100, 120);
    expect(shards).toHaveLength(6);
    const stub = makeStubCtx();
    drawGuardShard(stub.ctx, shards[0]);
    expect(stub.count("lineTo")).toBeGreaterThanOrEqual(2);
    expect(stub.fillStyleLog).toContain(AURA_COLORS.p2);
  });

  it("连击数字:≥3 才弹,画出大号数字文本;<3 一笔不画", () => {
    const no = makeStubCtx();
    drawComboPop(no.ctx, { x: 50, y: 40, n: 2, age: 4, soft: false });
    expect(no.calls.length).toBe(0);
    const yes = makeStubCtx();
    drawComboPop(yes.ctx, { x: 50, y: 40, n: 5, age: 4, soft: false });
    expect(yes.textLog.join("")).toContain("5 连");
  });

  it("投射物是发光小圆球(光晕+高光+星芒),不再是矩形色块", () => {
    const stub = makeStubCtx();
    drawProjectileOrb(stub.ctx, { cx: 80, cy: 100, r: 12, color: star.color, t: 0.2, facing: 1 });
    expect(stub.count("arc")).toBeGreaterThanOrEqual(5);
    expect(stub.count("fillRect")).toBe(0);
    expect(stub.distinctFillStyles().length).toBeGreaterThanOrEqual(4);
  });

  it("星屑画的是星形路径,不是 ✦ 字符", () => {
    const stub = makeStubCtx();
    drawMiniStar(stub.ctx, 10, 10, 4, "#FFD05A");
    expect(stub.count("lineTo")).toBeGreaterThanOrEqual(8);
    expect(stub.textLog).toHaveLength(0);
  });
});

describe("combo-clash · 主题舞台(按 levels 章节查表)", () => {
  it("三套主题色板都合法,主题名与规格一致", () => {
    expect(Object.keys(STAGE_THEMES)).toHaveLength(3);
    for (const th of Object.values(STAGE_THEMES)) {
      for (const c of [th.skyTop, th.skyBot, th.far, th.near, th.floor, th.seam, th.edge, th.rope, th.post, th.accent]) {
        expect(hexToRgb(c)).not.toBeNull();
      }
    }
    expect(STAGE_THEMES.sakura.name).toBe("樱花道场");
    expect(STAGE_THEMES.night.name).toBe("星空擂台");
    expect(STAGE_THEMES.candy.name).toBe("糖果广场");
  });

  it("188 关跑完正好覆盖三套舞台,章节分段查表", () => {
    expect(stageThemeOf(0)).toBe("sakura");
    expect(stageThemeOf(chapterStartOf(3))).toBe("night");
    expect(stageThemeOf(chapterStartOf(6))).toBe("candy");
    expect(stageThemeOf(187)).toBe("candy");
    const seen = new Set<string>();
    for (let lv = 0; lv < 188; lv++) seen.add(stageThemeOf(lv));
    expect(seen.size).toBe(3);
  });

  it("三套舞台绘制序列互不相同,且都有木板地面与围绳", () => {
    const snaps = (["sakura", "night", "candy"] as const).map((theme) => {
      const stub = makeStubCtx();
      drawStage(stub.ctx, { w: 640, h: 250, groundY: 214, shift: 320, theme, t: 1.2, soft: false });
      expect(stub.count("fillRect")).toBeGreaterThanOrEqual(4);
      expect(stub.count("stroke")).toBeGreaterThanOrEqual(4);
      return stub.snapshot();
    });
    expect(new Set(snaps).size).toBe(3);
  });

  it("樱花花瓣 ≤ 12 粒;soft 模式不飘花瓣、不放流星", () => {
    expect(PETAL_MAX).toBeLessThanOrEqual(12);
    const normal = makeStubCtx();
    drawStage(normal.ctx, { w: 640, h: 250, groundY: 214, shift: 320, theme: "sakura", t: 1.2, soft: false });
    const soft = makeStubCtx();
    drawStage(soft.ctx, { w: 640, h: 250, groundY: 214, shift: 320, theme: "sakura", t: 1.2, soft: true });
    expect(soft.calls.length).toBeLessThan(normal.calls.length);
  });
});

describe("combo-clash · KO 演出与 HUD 资产", () => {
  it("KO 演出 0.3s(18 帧)、彩带 20 片,文案只用「获胜」", () => {
    expect(KO_FRAMES).toBe(18);
    expect(CONFETTI_COUNT).toBe(20);
    expect(makeConfetti(100, 80)).toHaveLength(20);
    expect(koBannerText("朵朵")).toBe("朵朵 获胜!");
    expect(koBannerText(null)).toBe("平局!");
  });

  it("KO 横幅与彩带片都画得出来", () => {
    const stub = makeStubCtx();
    drawKoBanner(stub.ctx, { w: 640, text: koBannerText("星星"), t: 0.5 });
    expect(stub.textLog.join("")).toContain("获胜");
    const piece = makeConfetti(10, 10)[0];
    const c2 = makeStubCtx();
    drawConfettiPiece(c2.ctx, piece);
    expect(c2.count("fillRect")).toBe(1);
  });

  it("24px 头像复用角色头部函数,画得出且无 NaN", () => {
    for (const id of ["duoduo", "xingxing", "nuonuo"]) {
      const c = characterById(id);
      const stub = makeStubCtx();
      drawMiniAvatar(stub.ctx, { size: 24, color: c.color, ink: c.ink, look: c.look });
      expect(stub.count("fill")).toBeGreaterThanOrEqual(4);
      expect(stub.nonFiniteArgs).toBe(0);
    }
  });

  it("元气星徽:亮星三阶光影,亮 3 颗和亮 0 颗序列不同", () => {
    const full = makeStubCtx();
    drawWinBadges(full.ctx, { n: 3, total: 3, w: 56, h: 18 });
    const empty = makeStubCtx();
    drawWinBadges(empty.ctx, { n: 0, total: 3, w: 56, h: 18 });
    expect(full.count("fill")).toBeGreaterThan(empty.count("fill"));
    expect(full.snapshot()).not.toBe(empty.snapshot());
  });
});
