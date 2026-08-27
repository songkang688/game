/**
 * 雪球大作战 1.3 · 视觉常量块与纯映射(第 15 步 B 档)。
 *
 * 「只动皮肤不动骨头」的皮肤侧账本:配色板 token、图层序、动效时序表、
 * 角色七道工序 / 雪人三件套的几何常量,以及几条**只读**玩法常量的映射:
 * 投掷三帧相位读既有蓄力进度、蓄力雪球读 `chargeRatio`、融化高光读 `freezeRatio`、
 * 落点样式与风旗长度和 1.2 的旧公式逐点一致。
 *
 * 红线:这里一个数都不回写 `throw12.ts` / `snowman.ts` / `arena.ts`——
 * `BODY_R_12` 判定半径、`CROUCH_SCALE`、蓄力曲线、风力映射全部原样。
 */
import { THROW_COOLDOWN, CROUCH_SCALE } from "./arena";
import { chargeRatio, clamp12 } from "./throw12";

// ---------------------------------------------------------------------------
// 一、配色板(四·补一,魔法色号不许散落)
// ---------------------------------------------------------------------------

export const SNF_PALETTE = {
  /** 雪地主色 */
  sfSnow: "#F6FAFF",
  /** 雪丘高光斑 */
  sfSnowLit: "#FFFFFF",
  /** 全场冷蓝阴影(禁黑影) */
  sfShadow: "rgba(120,150,200,.18)",
  /** 远松树剪影 */
  sfPineFar: "#B9D4C9",
  /** 近松树剪影 */
  sfPineNear: "#8FBCA8",
  /** 朵朵队帽子 / 围巾主色 */
  sfPink: "#F4859F",
  /** 星星队帽子 / 围巾主色 */
  sfBlue: "#7FB2F0",
  /** 雪人胡萝卜鼻 */
  sfCarrot: "#F0954F",
  /** 堆雪墙主色 */
  sfFort: "#E8F1FB",
} as const;

export type SnfToken = keyof typeof SNF_PALETTE;

/** 冷蓝阴影的不透明基色(softShadow 要拆开的那份) */
export const SNF_SHADOW_RGB = "rgba(120,150,200,1)";
/** 冷蓝阴影统一透明度 */
export const SNF_SHADOW_ALPHA = 0.18;

/**
 * 图层序(draw 每帧从底到顶,任何新元素先归层再画):
 * ① 天空 → ② 远景松树两层视差 → ③ 地面雪丘 + 脚印淡痕 → ④ 掩体 / 雪墙
 * → ⑤ 角色与雪人 → ⑥ 雪球与落点圈 → ⑦ 溅雪 / 飘雪粒子
 * → ⑧ 蓄力条 / 风旗 / 瞄准箭头(功能件,永远最顶) → ⑨ HUD。
 */
export const SNF_LAYERS = [
  "sky",
  "pines",
  "ground+footprints",
  "covers",
  "fighters+snowmen",
  "balls+landing",
  "splash+snowfall",
  "charge+wind+aim",
  "hud",
] as const;

// ---------------------------------------------------------------------------
// 二、动效时序表(四·补三,毫秒写死成常量并被测试引用)
// ---------------------------------------------------------------------------

/** 围巾出手回摆(easeOutQuad;reduced 静止) */
export const SCARF_SWING_MS = 240;
/** 落点溅雪 6 瓣(easeOutCubic;reduced 不生成,保留凹陷) */
export const SPLASH_MS_13 = 320;
/** 脚印淡痕寿命(秒,linear;reduced 不生成) */
export const FOOTPRINT_LIFE_13 = 2;
/** 飘雪粒子上限(linear 常驻;reduced 数量 0) */
export const SNOWFALL_CAP_13 = 24;
/** 风旗波浪两帧的一帧多久(毫秒;reduced 停在第 0 帧) */
export const FLAG_WAVE_MS = 240;
/** 命中对方后眨单眼多久(秒) */
export const WINK_S = 0.6;

// ---------------------------------------------------------------------------
// 三、投掷三帧(相位只读既有蓄力进度与出手冷却,阈值不进玩法)
// ---------------------------------------------------------------------------

export type ThrowPhase = "idle" | "windup" | "release" | "recover";

/** 蓄力后摆的手臂角(度) */
export const WINDUP_ARM_DEG = 30;
/** 出手前倾角(度) */
export const RELEASE_LEAN_DEG = 12;
/** 出手冷却的前一半算「跨步出手」,后一半算「收势」 */
export const RECOVER_SPLIT = 0.5;

/**
 * 现在摆哪一帧:蓄力中 = 后仰蓄力;刚出手(冷却前半段)= 跨步出手;
 * 冷却后半段 = 收势;其余 = 常态。只读 `charge` 与 `cooldown`,不写回。
 */
export function throwPhase(charge: number | null, cooldown: number): ThrowPhase {
  if (charge !== null) return "windup";
  if (cooldown > THROW_COOLDOWN * RECOVER_SPLIT) return "release";
  if (cooldown > 0) return "recover";
  return "idle";
}

/** 蓄力多满,手臂往后摆多少度(读 chargeRatio,同一条曲线) */
export function windupArmDeg(chargeHeld: number): number {
  return WINDUP_ARM_DEG * chargeRatio(chargeHeld);
}

// ---------------------------------------------------------------------------
// 四、蓄力雪球(数值映射与旧蓄力条逐点一致)
// ---------------------------------------------------------------------------

/** 蓄力雪球最小半径(px) */
export const CHARGE_BALL_R_MIN = 4;
/** 蓄力雪球最大半径(px) */
export const CHARGE_BALL_R_MAX = 11;
/** 满档换色阈值(与旧蓄力条 `k > 0.92` 完全同一个数) */
export const CHARGE_FULL_AT = 0.92;

/** 蓄力读数:和旧蓄力条完全同一条 `chargeRatio`,一个点都不许偏 */
export function chargeReadout(heldSeconds: number): number {
  return chargeRatio(heldSeconds);
}

/** 读数 → 雪球画多大(严格单调,只是把「条有多长」换成「球有多大」) */
export function chargeBallRadius(k: number): number {
  return CHARGE_BALL_R_MIN + (CHARGE_BALL_R_MAX - CHARGE_BALL_R_MIN) * clamp12(k, 0, 1);
}

// ---------------------------------------------------------------------------
// 五、雪人融化高光(读既有解冻时长,不改)
// ---------------------------------------------------------------------------

/**
 * 融化高光爬到多高(0 = 脚,1 = 头)。
 * 入参就是 `snowman.freezeRatio`(1 = 刚被砸,0 = 马上能动),
 * 高光 = 1 − freeze:越接近解冻,亮带爬得越高。linear,不另立时长。
 */
export function meltRise(freeze: number): number {
  return 1 - clamp12(freeze, 0, 1);
}

// ---------------------------------------------------------------------------
// 六、落点凹陷与风旗(样式换皮,数值映射沿用 1.2 旧公式)
// ---------------------------------------------------------------------------

/** 落点提示的透明度 / 虚线 / 线宽:和 1.2 的 drawLanding 逐点一致 */
export function landingStyle(hot: boolean, blur: number): { alpha: number; dash: [number, number]; width: number } {
  return {
    alpha: (hot ? 0.85 : 0.4) * (1 - blur * 0.5),
    dash: blur > 0.4 ? [4, 5] : [7, 4],
    width: hot ? 2.4 : 1.6,
  };
}

/** 风旗箭头画多长:和 1.2 的 `Math.min(46, 12 + |wind| * 12)` 完全一致 */
export function flagLen(wind: number): number {
  return Math.min(46, 12 + Math.abs(wind) * 12);
}

/** 旗面现在是波浪的哪一帧(两帧交替;reduced 停在 0) */
export function flagFrame(timeSeconds: number, reduced: boolean): 0 | 1 {
  if (reduced) return 0;
  return (Math.floor((timeSeconds * 1000) / FLAG_WAVE_MS) % 2) as 0 | 1;
}

// ---------------------------------------------------------------------------
// 七、角色几何(判定不动,画法照抄 1.2 的半径公式)
// ---------------------------------------------------------------------------

/**
 * 身体画多大:和 1.2 完全同一条公式——
 * 站着 = full;蹲下 = `full * CROUCH_SCALE + full * 0.25`(读既有 CROUCH_SCALE)。
 */
export function fighterDrawRadius(full: number, crouch: boolean): number {
  return crouch ? full * CROUCH_SCALE + full * 0.25 : full;
}

/** 落影:0.8 × full 宽 */
export const FIGHTER_SHADOW_RX = 0.8;
/** 落影:0.22 × full 高 */
export const FIGHTER_SHADOW_RY = 0.22;
/** 下蹲时帽子往下压两成 */
export const HAT_CROUCH_DROP = 0.2;
/** 围巾出手时往出手反方向甩多少度 */
export const SCARF_SWING_DEG = 25;

/** 围巾此刻甩到几成(1 = 刚出手甩满,0 = 回位;easeOutQuad 回摆;reduced 恒 0) */
export function scarfSwing(sinceThrowSeconds: number, reduced: boolean): number {
  if (reduced) return 0;
  const k = clamp12(sinceThrowSeconds / (SCARF_SWING_MS / 1000), 0, 1);
  return (1 - k) * (1 - k);
}

// ---------------------------------------------------------------------------
// 八、雪球滚纹(随飞行距离滚,reduced 静止)
// ---------------------------------------------------------------------------

/** 表面雪纹几道 */
export const BALL_ROLL_LINES = 2;

/** 滚纹相位:随 spin×age 走(和 1.2 的转纹同源);reduced 恒 0(静止纹) */
export function ballRollPhase(spinTimesAge: number, reduced: boolean): number {
  return reduced ? 0 : spinTimesAge;
}
