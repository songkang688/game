/**
 * 星星射击场 1.3 · 视觉常量块与纯映射（第 14 步 A 档）。
 *
 * 本文件是「只动皮肤不动骨头」的皮肤侧账本：配色板 token、图层序、
 * 动效时序表、靶子七道工序的几何常量,以及几条**只读**玩法常量的映射函数
 * （散布→准星爪张角、护盾剩余→裂纹阶段、离场倒计时→呼吸缩放）。
 *
 * 红线：这里一个数都不回写 `logic.ts` / `feel12.ts` / `targets12.ts`——
 * 判定半径、散布数值、离场闪烁的触发条件全部原样,只做视觉换算。
 */
import { SPREAD_MAX } from "./feel12";
import { SHIELD_HP } from "./targets12";
import type { Target, TargetKind } from "./logic";

// ---------------------------------------------------------------------------
// 一、配色板（四·补一,禁止魔法数散落）
// ---------------------------------------------------------------------------

export const SHR_PALETTE = {
  /** 天幕底色（帐篷条纹亮条） */
  shrSky: "#FFE9F2",
  /** 帐篷条纹暗条与彩旗主色 */
  shrTent: "#F4859F",
  /** 横梁 / 柜台木色主色 */
  shrWood: "#C89B6C",
  /** 木纹暗线、支架斜杆 */
  shrWoodDark: "#A87B4F",
  /** 靶环主粉 */
  shrRing: "#FF9FBE",
  /** 连击金环 / 星屑 */
  shrGold: "#FFD678",
  /** 全场统一落影色 */
  shrShadow: "rgba(93,64,55,.18)",
} as const;

export type ShrToken = keyof typeof SHR_PALETTE;

/**
 * 图层序（drawField 每帧从底到顶,任何新元素先归层再画）：
 * ① 天幕条纹 → ② 彩旗串 → ③ 中景横梁 + 远排靶 → ④ 近景柜台 + 近排靶
 * → ⑤ 弹道与粒子 → ⑥ 准星 → ⑦ HUD。
 */
export const SHR_LAYERS = [
  "tent",
  "bunting",
  "beam+far",
  "counter+near",
  "shots+particles",
  "crosshair",
  "hud",
] as const;

// ---------------------------------------------------------------------------
// 二、场景纵深（第七节:360px 上帐篷 ≤ 22% 视口）
// ---------------------------------------------------------------------------

/** 场地逻辑高（与 logic.FIELD_H 一致,这里只做视觉换算不回写） */
const FIELD_H_LOGIC = 620;
/** 帐篷天幕最多占视口高的几成 */
export const TENT_MAX_VIEW_RATIO = 0.22;
/** 帐篷天幕逻辑高度（120 / 620 ≈ 19.4%,留在 22% 红线内） */
export const TENT_H = 120;
/** 彩旗串挂的高度 */
export const BUNTING_Y = TENT_H + 14;
/** 修复员装饰件:奖品架剪影的单色(2 阶 = 底色 + 暗 15%),压灰不抢靶 */
export const SHR_PRIZE = "#C9B4DE";
/** 奖品架搁板顶边(天幕与横梁之间的中景空档) */
export const PRIZE_SHELF_Y = 214;
/** 中景横梁顶边（远排靶脚下,原 y=236 白带的位置换成木梁） */
export const BEAM_Y = 244;
/** 横梁厚度 */
export const BEAM_H = 16;
/** 横梁顶亮边厚度（3px） */
export const BEAM_TOP_EDGE = 3;
/** 近景柜台顶边 */
export const COUNTER_Y = 540;
/** 帐篷条纹一条多宽 */
export const TENT_STRIPE_W = 76;

/** 自检用:帐篷高度确实压在红线内 */
export function tentRatio(): number {
  return TENT_H / FIELD_H_LOGIC;
}

// ---------------------------------------------------------------------------
// 三、靶子七道工序的几何常量（四·补二）
// ---------------------------------------------------------------------------

/** 落影:圆心在靶心下方 0.92r */
export const TARGET_SHADOW_DY = 0.92;
/** 落影横半径 0.8r */
export const TARGET_SHADOW_RX = 0.8;
/** 落影纵半径 0.24r */
export const TARGET_SHADOW_RY = 0.24;

/** 木框外环宽 0.08r（外圈 8% 半径） */
export const WOOD_FRAME_W = 0.08;
/** 木框双色相间分段数 */
export const WOOD_FRAME_SEGMENTS = 8;
/** 木纹接缝相位错开 22.5°（弧度） */
export const WOOD_FRAME_PHASE = (22.5 * Math.PI) / 180;

/** 靶心亮点半径 0.12r */
export const BULLSEYE_DOT_R = 0.12;
/** 靶心光晕半径 0.2r */
export const BULLSEYE_GLOW_R = 0.2;

/** 靶子最小绘制半径（判定半径不变,只是保证画出来认得出） */
export const MIN_DRAW_RADIUS = 14;

// ---------------------------------------------------------------------------
// 四、动效时序表（四·补三,毫秒写死成常量并被测试引用）
// ---------------------------------------------------------------------------

/** 准星呼吸周期（常驻,sin;reduced 停用画静态圈） */
export const BREATH_MS = 1200;
/** 准星呼吸幅度 ±6% */
export const BREATH_AMP = 0.06;
/** 星屑爆发时长（命中,easeOutQuad 抛物线;reduced 不生成） */
export const SPARKLE_BURST_MS = 300;
/** 丝带飘落时长（命中,easeOutCubic 螺旋;reduced 不生成） */
export const RIBBON_FALL_MS = 420;
/** 花瓣飘落时长（误击花朵靶,easeOutSine;reduced 不生成） */
export const PETAL_FALL_MS = 480;
/** 彩虹环自转一圈（常驻,linear;reduced 相位冻结） */
export const RAINBOW_SPIN_MS = 6000;
/** 连击金环扩散（倍率变化,easeOutBack;reduced 画静态金圈） */
export const COMBO_RING_MS = 260;

/** 离场闪烁频率（与 1.2 的 `Math.sin(now * 8)` 完全一致,只读不改） */
export const LEAVE_FLASH_HZ = 8;
/** 离场呼吸缩放下限 */
export const LEAVE_BREATH_MIN = 0.9;
/** 离场呼吸缩放上限（封顶 1.0,绘制半径永不超过判定半径的视觉基准） */
export const LEAVE_BREATH_MAX = 1.0;

/** 准星呼吸倍率:1200ms 周期 ±6%;reduced 恒为 1 */
export function breathScale(nowS: number, reduced: boolean): number {
  if (reduced) return 1;
  return 1 + Math.sin((nowS * 1000 * Math.PI * 2) / BREATH_MS) * BREATH_AMP;
}

/** 离场倒计时的呼吸缩放:0.9→1.0 来回,永不超过 1.0;reduced 只留闪烁不缩放 */
export function leaveBreathScale(nowS: number, reduced: boolean): number {
  if (reduced) return LEAVE_BREATH_MAX;
  const mid = (LEAVE_BREATH_MIN + LEAVE_BREATH_MAX) / 2;
  const amp = (LEAVE_BREATH_MAX - LEAVE_BREATH_MIN) / 2;
  return mid + Math.sin(nowS * LEAVE_FLASH_HZ) * amp;
}

/** 彩虹环相位（弧度）:6000ms 一圈,linear;reduced 冻结在 0 */
export function rainbowPhase(nowS: number, reduced: boolean): number {
  if (reduced) return 0;
  return ((nowS * 1000) % RAINBOW_SPIN_MS) / RAINBOW_SPIN_MS * Math.PI * 2;
}

// ---------------------------------------------------------------------------
// 五、只读玩法常量的视觉映射
// ---------------------------------------------------------------------------

/** 准星爪并拢时偏离基准位的角度（弧度） */
export const CLAW_ANGLE_MIN = 0.1;
/** 散布封顶时爪张到多开（弧度） */
export const CLAW_ANGLE_MAX = 0.42;

/**
 * 连发散布 → 准星爪张角:只读 `feel12.SPREAD_MAX`,不改任何散布数值。
 * spread 0 → 爪并拢（0.1 rad）,spread 封顶 → 张满（0.42 rad）。
 */
export function clawOpenAngle(spread: number): number {
  const k = Math.max(0, Math.min(1, spread / SPREAD_MAX));
  return CLAW_ANGLE_MIN + (CLAW_ANGLE_MAX - CLAW_ANGLE_MIN) * k;
}

export type ShieldCrackStage = "intact" | "cracked";

/**
 * 护盾剩余 → 盾罩裂纹阶段:满壳画完整盾罩,敲开一层画裂纹盾罩。
 * 只读 `hp`,绝不回写。
 */
export function shieldCrackStage(hp: number | undefined): ShieldCrackStage {
  return (hp ?? SHIELD_HP) > 1 ? "intact" : "cracked";
}

// ---------------------------------------------------------------------------
// 六、命中粒子预算（reduced 一票否决,花朵误击只飘花瓣不喷星屑）
// ---------------------------------------------------------------------------

export interface ParticleBudget {
  /** 星屑几颗（0 表示不生成） */
  sparkles: number;
  /** 丝带几条 */
  ribbons: number;
  /** 花瓣几片 */
  petals: number;
}

/** 命中星屑颗数下限（8–12 由 sparkle.ts 内部随机,这里给基准数） */
export const HIT_SPARKLES = 10;
/** 命中丝带条数 */
export const HIT_RIBBONS = 3;
/** 误击花朵的花瓣片数 */
export const FOUL_PETALS = 6;

/**
 * 这一下该生成什么粒子:
 * - reduced:全零（保留静态高光与落影,粒子全关）;
 * - 花朵靶误击:只有花瓣,星屑为 0（不批评,温柔提醒）;
 * - 好人靶误击:全零（保留原「哎呀～」文案通道）;
 * - 普通命中且靶子倒了:星屑 + 丝带双通道。
 */
export function hitParticleBudget(
  kind: TargetKind | "miss",
  opts: { destroyed: boolean; foul: boolean; reduced: boolean }
): ParticleBudget {
  if (opts.reduced) return { sparkles: 0, ribbons: 0, petals: 0 };
  if (opts.foul) {
    if (kind === "flower") return { sparkles: 0, ribbons: 0, petals: FOUL_PETALS };
    return { sparkles: 0, ribbons: 0, petals: 0 };
  }
  if (!opts.destroyed || kind === "miss") return { sparkles: 0, ribbons: 0, petals: 0 };
  return { sparkles: HIT_SPARKLES, ribbons: HIT_RIBBONS, petals: 0 };
}

// ---------------------------------------------------------------------------
// 七、离场判断的视觉包装（读 targets12 的口径,不另立门户）
// ---------------------------------------------------------------------------

/** 远排靶画一根支架、近排画两根（四·补二第 2 道工序） */
export function strutCount(t: Target): number {
  return t.far === true ? 1 : 2;
}
