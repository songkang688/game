/**
 * 雪球大作战 1.3 · 视觉升级用例(第 15 步 B 档,只增不减)。
 *
 * 管四件事:
 *   1. 配色板与图层序和规格表一字不差(雪地阴影必须冷蓝,不许黑);
 *   2. 换皮不换骨:三帧相位 / 蓄力雪球 / 融化高光 / 落点样式 / 风旗长度
 *      全部**只读**既有玩法常量,数值快照一个都没动;
 *   3. 纯画笔工序(七道工序 / 雪人三件套 / 堆雪墙 / 功能件)在 FakeCtx 桩上可调用不抛错;
 *   4. 运行时:蓄力雪球读数逐点一致、reduced 降级、脚印 / 雪粉的生灭、destroy 归零。
 */
import { afterEach, describe, expect, it } from "vitest";
import { FakeCtx, findOne, install, type FakeEl, type Harness } from "./domStub";
import { VIEW_W, buildLevel } from "./levels";
import { BODY_R_12, CROUCH_SCALE, THROW_COOLDOWN, aimCircle, campaignArena, type Arena } from "./arena";
import {
  AIR_DRAG,
  CHARGE_MAX,
  GRAVITY_12,
  SPEED_MAX,
  SPEED_MIN,
  WIND_MAX_12,
  chargeRatio,
  windWord,
} from "./throw12";
import { BUMP_LIMIT, FREEZE_TIME, REST_TIME, freezeRatio, type HitState } from "./snowman";
import {
  CHARGE_BALL_R_MAX,
  CHARGE_BALL_R_MIN,
  CHARGE_FULL_AT,
  FLAG_WAVE_MS,
  FOOTPRINT_LIFE_13,
  SCARF_SWING_MS,
  SNF_LAYERS,
  SNF_PALETTE,
  SNOWFALL_CAP_13,
  SPLASH_MS_13,
  ballRollPhase,
  chargeBallRadius,
  chargeReadout,
  fighterDrawRadius,
  flagFrame,
  flagLen,
  landingStyle,
  meltRise,
  scarfSwing,
  throwPhase,
} from "./visual13";
import {
  paintAimArrow,
  paintChargeSnowball,
  paintCrate,
  paintFighterBody,
  paintFortKeep,
  paintLanding,
  paintPineRow,
  paintSlope,
  paintSnowMounds,
  paintSnowWall,
  paintSnowball,
  paintSnowman,
  paintStanceRing,
  paintWindFlag,
  teamColor,
  type FighterPose,
} from "./paint13";
import { FOOTPRINT_LIFE_S, SNOW_CAP, SPLASH_MS } from "../../art/kit/snow";

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

interface Bout {
  destroy: () => void;
  arena: Arena;
  fxCount: () => { flakes: number; footprints: number; bursts: number; confetti: number };
}

async function openBout(h: Harness, arena: Arena): Promise<Bout> {
  const mod = await import("./index");
  return mod.createBout({
    host: h.root as unknown as HTMLElement,
    arena,
    viewW: VIEW_W,
    humans: 1,
  } as never) as unknown as Bout;
}

function canvasOf(h: Harness): FakeEl {
  const cv = findOne(h.root, "snf-canvas");
  if (!cv) throw new Error("画布没挂上");
  return cv;
}

function ctx(): CanvasRenderingContext2D {
  return new FakeCtx() as unknown as CanvasRenderingContext2D;
}

function pose(over: Partial<FighterPose> = {}): FighterPose {
  return {
    x: 60,
    base: 120,
    full: 12,
    r: 12,
    dir: 1,
    seat: 0,
    crouch: false,
    warming: false,
    phase: "idle",
    chargeK: 0,
    swing: 0,
    time: 0,
    wink: false,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// 一、配色板与图层序(四·补一)
// ---------------------------------------------------------------------------

describe("1.3 · 配色板与图层序", () => {
  it("九个 token 与规格表逐项一致", () => {
    expect(SNF_PALETTE.sfSnow).toBe("#F6FAFF");
    expect(SNF_PALETTE.sfSnowLit).toBe("#FFFFFF");
    expect(SNF_PALETTE.sfShadow).toBe("rgba(120,150,200,.18)");
    expect(SNF_PALETTE.sfPineFar).toBe("#B9D4C9");
    expect(SNF_PALETTE.sfPineNear).toBe("#8FBCA8");
    expect(SNF_PALETTE.sfPink).toBe("#F4859F");
    expect(SNF_PALETTE.sfBlue).toBe("#7FB2F0");
    expect(SNF_PALETTE.sfCarrot).toBe("#F0954F");
    expect(SNF_PALETTE.sfFort).toBe("#E8F1FB");
  });

  it("雪地阴影是冷蓝不是黑:token 里不许出现纯黑通道", () => {
    expect(SNF_PALETTE.sfShadow).toContain("120,150,200");
    for (const v of Object.values(SNF_PALETTE)) {
      expect(v).not.toMatch(/rgba?\(\s*0\s*,\s*0\s*,\s*0/);
      expect(v.toLowerCase()).not.toBe("#000000");
    }
  });

  it("图层序共九层,功能件(⑧)永远压在飘雪(⑦)上面", () => {
    expect(SNF_LAYERS.length).toBe(9);
    expect(SNF_LAYERS[0]).toBe("sky");
    expect(SNF_LAYERS[SNF_LAYERS.length - 1]).toBe("hud");
    const snowAt = SNF_LAYERS.indexOf("splash+snowfall");
    const uiAt = SNF_LAYERS.indexOf("charge+wind+aim");
    expect(snowAt).toBeGreaterThanOrEqual(0);
    expect(uiAt).toBeGreaterThan(snowAt);
  });
});

// ---------------------------------------------------------------------------
// 二、换皮不换骨:只读映射与数值快照
// ---------------------------------------------------------------------------

describe("1.3 · 玩法数值快照(一个都不许动)", () => {
  it("蓄力 / 物理 / 雪人 / 判定的骨头和 1.2 一字不差", () => {
    expect(CHARGE_MAX).toBe(1.2);
    expect(SPEED_MIN).toBe(14);
    expect(SPEED_MAX).toBe(42);
    expect(GRAVITY_12).toBe(24);
    expect(AIR_DRAG).toBe(0.5);
    expect(WIND_MAX_12).toBe(3);
    expect(BODY_R_12).toBe(1.2);
    expect(CROUCH_SCALE).toBe(0.55);
    expect(THROW_COOLDOWN).toBe(0.28);
    expect(FREEZE_TIME).toBe(1.5);
    expect(REST_TIME).toBe(5);
    expect(BUMP_LIMIT).toBe(3);
  });
});

describe("1.3 · 投掷三帧相位(只读蓄力与冷却)", () => {
  it("蓄力中 = 后仰;冷却前半段 = 出手;后半段 = 收势;其余 = 常态", () => {
    expect(throwPhase(0.4, 0)).toBe("windup");
    expect(throwPhase(null, THROW_COOLDOWN)).toBe("release");
    expect(throwPhase(null, THROW_COOLDOWN * 0.51)).toBe("release");
    expect(throwPhase(null, THROW_COOLDOWN * 0.49)).toBe("recover");
    expect(throwPhase(null, 0)).toBe("idle");
  });
});

describe("1.3 · 蓄力雪球(数值映射与旧蓄力条逐点一致)", () => {
  it("读数就是 chargeRatio:0 / 0.5 / 1 三点分毫不差", () => {
    expect(chargeReadout(0)).toBe(chargeRatio(0));
    expect(chargeReadout(CHARGE_MAX / 2)).toBe(chargeRatio(CHARGE_MAX / 2));
    expect(chargeReadout(CHARGE_MAX)).toBe(chargeRatio(CHARGE_MAX));
    expect(chargeReadout(0)).toBe(0);
    expect(chargeReadout(CHARGE_MAX / 2)).toBeCloseTo(0.5, 9);
    expect(chargeReadout(CHARGE_MAX)).toBe(1);
  });

  it("雪球从小滚大:半径严格单调、夹在 4..11px,满档阈值仍是 0.92", () => {
    expect(chargeBallRadius(0)).toBe(CHARGE_BALL_R_MIN);
    expect(chargeBallRadius(1)).toBe(CHARGE_BALL_R_MAX);
    expect(chargeBallRadius(0.5)).toBeGreaterThan(chargeBallRadius(0.25));
    expect(chargeBallRadius(-1)).toBe(CHARGE_BALL_R_MIN);
    expect(chargeBallRadius(9)).toBe(CHARGE_BALL_R_MAX);
    expect(CHARGE_FULL_AT).toBe(0.92);
  });
});

describe("1.3 · 融化高光(读既有解冻时长,不改)", () => {
  it("刚被砸中在脚(0),半程在腰(0.5),快解冻爬到头(→1)", () => {
    const at = (timer: number): HitState => ({ phase: "snowman", timer, bumps: 1, total: 1 });
    expect(meltRise(freezeRatio(at(FREEZE_TIME)))).toBe(0);
    expect(meltRise(freezeRatio(at(FREEZE_TIME / 2)))).toBeCloseTo(0.5, 9);
    expect(meltRise(freezeRatio(at(0)))).toBe(1);
  });
});

describe("1.3 · 落点凹陷与风旗(时序 / 映射沿用 1.2)", () => {
  it("落点样式三点对旧公式:热度与模糊怎么算透明度、虚线、线宽都没变", () => {
    expect(landingStyle(true, 0)).toEqual({ alpha: 0.85, dash: [7, 4], width: 2.4 });
    expect(landingStyle(false, 0)).toEqual({ alpha: 0.4, dash: [7, 4], width: 1.6 });
    const hazy = landingStyle(true, 0.8);
    expect(hazy.alpha).toBeCloseTo(0.85 * (1 - 0.8 * 0.5), 9);
    expect(hazy.dash).toEqual([4, 5]);
  });

  it("风旗箭头长度 = min(46, 12 + |wind|·12),文字映射一字不改", () => {
    for (const w of [0, 0.5, 1.5, -2.4, 3]) {
      expect(flagLen(w)).toBe(Math.min(46, 12 + Math.abs(w) * 12));
    }
    expect(windWord(0)).toBe("无风");
    expect(windWord(1)).toBe("→ 微风");
    expect(windWord(-2.4)).toBe("← 大风");
  });

  it("旗面波浪两帧:240ms 一帧来回换,reduced 停在第 0 帧", () => {
    expect(FLAG_WAVE_MS).toBe(240);
    expect(flagFrame(0, false)).toBe(0);
    expect(flagFrame(0.25, false)).toBe(1);
    expect(flagFrame(0.5, false)).toBe(0);
    expect(flagFrame(0.25, true)).toBe(0);
    expect(flagFrame(99, true)).toBe(0);
  });
});

describe("1.3 · 时序表其余几条", () => {
  it("围巾 240ms / 溅雪 320ms / 脚印 2s / 飘雪上限 24,和 kit 的账本对得上", () => {
    expect(SCARF_SWING_MS).toBe(240);
    expect(SPLASH_MS_13).toBe(320);
    expect(SPLASH_MS_13).toBe(SPLASH_MS);
    expect(FOOTPRINT_LIFE_13).toBe(2);
    expect(FOOTPRINT_LIFE_13).toBe(FOOTPRINT_LIFE_S);
    expect(SNOWFALL_CAP_13).toBe(24);
    expect(SNOWFALL_CAP_13).toBe(SNOW_CAP);
  });

  it("围巾甩动:刚出手甩满(1),240ms 回位(0),easeOutQuad;reduced 恒 0", () => {
    expect(scarfSwing(0, false)).toBe(1);
    expect(scarfSwing(SCARF_SWING_MS / 2000, false)).toBeCloseTo(0.25, 9);
    expect(scarfSwing(SCARF_SWING_MS / 1000, false)).toBe(0);
    expect(scarfSwing(0, true)).toBe(0);
  });

  it("雪球滚纹相位随 spin×age;reduced 静止在 0", () => {
    expect(ballRollPhase(2.4, false)).toBe(2.4);
    expect(ballRollPhase(2.4, true)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 三、纯画笔工序(FakeCtx 桩,可调用不抛错)
// ---------------------------------------------------------------------------

describe("1.3 · 角色七道工序", () => {
  it("主体圆半径恒等于 full,下蹲仍走 CROUCH_SCALE(公式与 1.2 一字不差)", () => {
    expect(fighterDrawRadius(12, false)).toBe(12);
    expect(fighterDrawRadius(12, true)).toBeCloseTo(12 * CROUCH_SCALE + 12 * 0.25, 9);
  });

  it("站 / 蹲 / 三帧相位 / 暖手,每个分支都画得动不抛错", () => {
    for (const phase of ["idle", "windup", "release", "recover"] as const) {
      for (const crouch of [false, true]) {
        const c = ctx();
        expect(() =>
          paintFighterBody(c, pose({ phase, crouch, r: fighterDrawRadius(12, crouch), chargeK: 0.6, swing: 0.5, wink: true }))
        ).not.toThrow();
        expect((c as unknown as FakeCtx).ops.length).toBeGreaterThan(0);
      }
    }
    expect(() => paintFighterBody(ctx(), pose({ warming: true }))).not.toThrow();
    expect(() => paintStanceRing(ctx(), 60, 120, 12, 0, 1.2)).not.toThrow();
  });

  it("两队灰度也分得清:seat 0 与 seat 1 的帽形 / 围巾结画出来的序列不同", () => {
    const a = ctx();
    const b = ctx();
    paintFighterBody(a, pose({ seat: 0 }));
    paintFighterBody(b, pose({ seat: 1 }));
    expect(teamColor(0)).toBe(SNF_PALETTE.sfPink);
    expect(teamColor(1)).toBe(SNF_PALETTE.sfBlue);
    expect(JSON.stringify((a as unknown as FakeCtx).ops)).not.toBe(JSON.stringify((b as unknown as FakeCtx).ops));
  });
});

describe("1.3 · 雪人三件套 + 融化高光", () => {
  it("两球 + 三粒纽扣 + 笑脸都在(arc 至少 8 个),画得动不抛错", () => {
    const c = ctx();
    expect(() => paintSnowman(c, 60, 120, 12, 0.5, 1)).not.toThrow();
    const arcs = (c as unknown as FakeCtx).ops.filter((o) => o.op === "arc");
    expect(arcs.length).toBeGreaterThanOrEqual(8);
  });

  it("融化高光从脚往头爬:meltK 越大,亮带画得越高", () => {
    const bandY = (meltK: number): number => {
      const c = ctx();
      paintSnowman(c, 60, 120, 12, meltK, 0);
      const band = (c as unknown as FakeCtx).ops.find((o) => o.op === "ellipse" && Math.abs((o.args[2] ?? 0) - 12 * 0.95) < 1e-6);
      expect(band, `meltK=${meltK} 没画亮带`).toBeDefined();
      return band?.args[1] ?? Number.NaN;
    };
    const feet = bandY(0);
    const waist = bandY(0.5);
    const head = bandY(1);
    expect(waist).toBeLessThan(feet);
    expect(head).toBeLessThan(waist);
    expect(feet).toBe(120);
  });
});

describe("1.3 · 掩体 / 场景 / 功能件的画笔分支", () => {
  it("堆雪墙三阶段:每掉一层多一口缺口(读既有 hp,不回写)", () => {
    const arcsAt = (hp: number): number => {
      const c = ctx();
      paintSnowWall(c, { x: 10, w: 24, top: 60, bottom: 110 }, hp, 3);
      return (c as unknown as FakeCtx).ops.filter((o) => o.op === "arc").length;
    };
    expect(arcsAt(2)).toBe(arcsAt(3) + 1);
    expect(arcsAt(1)).toBe(arcsAt(3) + 2);
  });

  it("木箱 / 雪坡 / 雪堡 / 松树 / 雪丘高光斑全部画得动不抛错", () => {
    expect(() => paintCrate(ctx(), { x: 10, w: 20, top: 60, bottom: 100 })).not.toThrow();
    expect(() => paintSlope(ctx(), { x: 10, w: 30, top: 60, bottom: 100 })).not.toThrow();
    expect(() => paintFortKeep(ctx(), 40, 110, 8)).not.toThrow();
    expect(() => paintPineRow(ctx(), 360, 110, 22, SNF_PALETTE.sfPineFar, 96, 12)).not.toThrow();
    expect(() => paintSnowMounds(ctx(), 360, 110, 18)).not.toThrow();
  });

  it("雪球本体 + 底部冷阴影 + 两道滚纹;落点凹陷里功能圈半径原样", () => {
    const c = ctx();
    paintSnowball(c, 80, 40, 5, 1.1);
    const fake = c as unknown as FakeCtx;
    expect(fake.ops.filter((o) => o.op === "arc").length).toBeGreaterThanOrEqual(1);
    expect(fake.ops.filter((o) => o.op === "ellipse").length).toBeGreaterThanOrEqual(3);

    const l = ctx();
    paintLanding(l, 100, 120, 30, 9.6, true, 0.2);
    const ring = (l as unknown as FakeCtx).ops.find((o) => o.op === "ellipse" && o.args[0] === 100 && o.args[2] === 30);
    expect(ring).toBeDefined();
  });

  it("蓄力雪球:画出来的半径就是 chargeBallRadius(k);风旗两帧、准星点阵不抛错", () => {
    for (const k of [0, 0.5, 1]) {
      const c = ctx();
      paintChargeSnowball(c, 10, 100, 160, k, 0);
      const hit = (c as unknown as FakeCtx).ops.some((o) => o.op === "arc" && Math.abs((o.args[2] ?? 0) - chargeBallRadius(k)) < 1e-9);
      expect(hit, `k=${k} 的蓄力雪球半径不对`).toBe(true);
    }
    expect(() => paintWindFlag(ctx(), 180, 20, 2.4, "#4f6a9c", 0, flagLen(2.4), windWord(2.4), 13)).not.toThrow();
    expect(() => paintWindFlag(ctx(), 180, 20, 0, "#4f6a9c", 1, flagLen(0), windWord(0), 13)).not.toThrow();
    const c = ctx();
    paintAimArrow(c, 10, 100, 40, 60, "rgba(232,85,143,.8)");
    expect((c as unknown as FakeCtx).ops.filter((o) => o.op === "arc").length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// 四、运行时(domStub):读数一致、reduced 降级、生灭、destroy 归零
// ---------------------------------------------------------------------------

describe("1.3 · 运行时接线", () => {
  it("蓄力时画在角落的就是「从小滚大」的雪球,半径与蓄力读数逐点对得上", async () => {
    const h = (harness = install({ innerWidth: 360 }));
    const bout = await openBout(h, campaignArena(buildLevel(0)));
    h.flush(2);
    const cv = canvasOf(h).getContext("2d")!;
    h.key("keydown", "KeyF");
    h.flush(30);
    cv.ops.length = 0;
    h.flush(1);
    const me = bout.arena.fighters[0]!;
    expect(me.charge).toBeGreaterThan(0.3);
    const want = chargeBallRadius(chargeReadout(me.charge ?? 0));
    const hit = cv.ops.some((o) => o.op === "arc" && Math.abs((o.args[2] ?? 0) - want) < 1e-9);
    expect(hit, `没找到半径 ${want} 的蓄力雪球`).toBe(true);
    h.key("keyup", "KeyF");
    bout.destroy();
  });

  it("reduced:飘雪 0 颗,但落点提示(功能件)照画", async () => {
    const h = (harness = install({ reduceMotion: true }));
    const bout = await openBout(h, campaignArena(buildLevel(0)));
    h.flush(3);
    expect(bout.fxCount().flakes).toBe(0);
    const cv = canvasOf(h).getContext("2d")!;
    cv.ops.length = 0;
    h.flush(1);
    const me = bout.arena.fighters[0]!;
    const ring = aimCircle(bout.arena, me);
    const s = Number.parseFloat(canvasOf(h).style.width) / VIEW_W;
    const drawn = cv.ops.some(
      (o) => o.op === "ellipse" && Math.abs((o.args[0] ?? -99) - ring.x * s) < 1 && Math.abs((o.args[2] ?? -99) - Math.max(4, ring.r * s)) < 1
    );
    expect(drawn).toBe(true);
    bout.destroy();
  });

  it("有动效时:飘雪不超过 24 颗;出手喷雪粉;走两步留脚印,2 秒后自己淡掉", async () => {
    const h = (harness = install());
    const bout = await openBout(h, campaignArena(buildLevel(0)));
    h.flush(2);
    expect(bout.fxCount().flakes).toBeGreaterThan(0);
    expect(bout.fxCount().flakes).toBeLessThanOrEqual(SNOWFALL_CAP_13);

    h.key("keydown", "KeyF");
    h.flush(10);
    h.key("keyup", "KeyF");
    h.flush(1);
    expect(bout.fxCount().bursts).toBeGreaterThan(0);

    h.key("keydown", "KeyD");
    h.flush(24);
    h.key("keyup", "KeyD");
    expect(bout.fxCount().footprints).toBeGreaterThan(0);
    h.flush(140); // 2.2 秒
    expect(bout.fxCount().footprints).toBe(0);
    bout.destroy();
  });

  it("destroy 之后:飘雪场、脚印、溅雪、彩带全部归零", async () => {
    const h = (harness = install());
    const bout = await openBout(h, campaignArena(buildLevel(0)));
    h.flush(2);
    h.key("keydown", "KeyD");
    h.flush(24);
    h.key("keyup", "KeyD");
    h.key("keydown", "KeyF");
    h.flush(10);
    h.key("keyup", "KeyF");
    h.flush(1);
    expect(bout.fxCount().flakes).toBeGreaterThan(0);
    bout.destroy();
    expect(bout.fxCount()).toEqual({ flakes: 0, footprints: 0, bursts: 0, confetti: 0 });
    expect(h.pendingFrames()).toBe(0);
  });
});
