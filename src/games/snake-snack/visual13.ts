// 贪吃毛毛虫 · 1.3 视觉层:配色板 / 图层序 / 动效时序 / 场景画笔。
//
// 只管好看,不管规则:逻辑格坐标、碰撞判定、移动节奏都在 logic.ts / snake12.ts,
// 这里的所有函数都是「拿着状态画一帧」的纯绘制,一个逻辑数值都不改。
// 光源统一左上 45°;reduced-motion 的降级开关全部由入参传进来。
import { type CatLook } from "../../art/kit/caterpillar";

/* ------------------------------------------------------------------ */
/* 一、配色板(与 step 文档四·补一的表逐色一致)                          */
/* ------------------------------------------------------------------ */

export const SS_COLORS = {
  /** 棋盘双色格(明度差 4%) */
  ssBoardA: "#F4F8EC",
  ssBoardB: "#EDF3E2",
  /** 花园栅栏边框 */
  ssFence: "#C89B6C",
  /** 虫身双色交替节 */
  ssBodyA: "#9FD98B",
  ssBodyB: "#B8E39B",
  /** 头部主色(大眼白 + 黑瞳在 kit 里画) */
  ssHead: "#8FCB7A",
  /** 待踩花砖 / 踩过亮砖 */
  ssTile: "#E8D8F0",
  ssTileLit: "#FFE9A8",
  /** 三棱面岩石 */
  ssRock: "#B9AFA4",
  /** 统一落影 */
  ssShadow: "rgba(90,110,74,.14)",
} as const;

/** 场景件的补充色(归在视觉常量块里,不散落在画笔里) */
export const SS_SCENE = {
  bushDark: "#93C17E",
  bushLight: "#B7DFA0",
  doorWood: "#C99A63",
  doorDark: "#A87C4C",
  doorLight: "#F7EFD8",
  lockGold: "#E8C05A",
  swirlA: "#8FB7E8",
  swirlB: "#C9A6E8",
  hogBody: "#B99B7E",
  hogSpike: "#8D7358",
  hogFace: "#F3E3CF",
  tileGlow: "rgba(255,214,120,0.55)",
} as const;

/** 绿虫是主角;双身位关的第二条粉虫,主色/交替色全套不同,一眼可分 */
export const SS_WORM_GREEN: CatLook = {
  head: SS_COLORS.ssHead,
  bodyA: SS_COLORS.ssBodyA,
  bodyB: SS_COLORS.ssBodyB,
  shadow: SS_COLORS.ssShadow,
};
export const SS_WORM_PINK: CatLook = {
  head: "#D389B4",
  bodyA: "#E9A6C9",
  bodyB: "#F3C3DB",
  shadow: SS_COLORS.ssShadow,
};

/**
 * draw 的图层序(从底到顶),index.ts 按这个顺序画:
 * 棋盘双色格 → 花砖小路 → 墙草丛/石头/门 → 传送旋涡 → 食物/奖励星
 * → 刺猬 → 毛毛虫(尾→头,头永远最上) → 鼓包波/金闪 → HUD(DOM)。
 */
export const SS_LAYERS = [
  "board",
  "tiles",
  "terrain",
  "portal",
  "snack",
  "hedgehog",
  "caterpillar",
  "fx",
  "hud",
] as const;

/* ------------------------------------------------------------------ */
/* 二、动效时序(毫秒写死成常量,测试引用这里)                            */
/* ------------------------------------------------------------------ */

export const SS_ANIM = {
  /** 移动插值:上一格 → 当前格 80ms 平滑(linear);reduced 关闭回逐格瞬跳 */
  moveMs: 80,
  /** 吃食张嘴:1 帧(step);reduced 保留(功能反馈) */
  biteFrames: 1,
  /** 鼓包传导:两节 × 90ms(easeOutQuad);reduced 关闭 */
  bulgeNodeMs: 90,
  bulgeNodes: 2,
  /** 奖励金闪:1 帧全身(step);reduced 保留 */
  goldFrames: 1,
  /** 门旋开:150ms(easeOutQuad);reduced 瞬开 */
  doorMs: 150,
  /** 传送旋涡:常驻 2400ms/圈(linear);reduced 静止 */
  swirlMs: 2400,
  /** 花砖点亮微光:260ms 渐入(easeOut);reduced 瞬亮(提示保留) */
  tileGlowMs: 260,
} as const;

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

export function easeOutQuad(t: number): number {
  const c = clamp01(t);
  return c * (2 - c);
}

/** 移动插值进度:80ms 内平滑走完,之后停在格心;reduced 直接落格 */
export function moveGlideT(accMs: number, reduced: boolean): number {
  if (reduced) return 1;
  return clamp01(accMs / SS_ANIM.moveMs);
}

/** 花砖踩亮微光进度:260ms easeOut 渐入;reduced 瞬亮(提示不丢) */
export function tileGlowT(msSinceLit: number, reduced: boolean): number {
  if (reduced) return 1;
  if (!(msSinceLit >= 0)) return 0;
  return easeOutQuad(msSinceLit / SS_ANIM.tileGlowMs);
}

/** 门旋开进度:150ms easeOutQuad;reduced 瞬开 */
export function doorSwingT(msSinceOpen: number, reduced: boolean): number {
  if (reduced) return 1;
  if (!(msSinceOpen >= 0)) return 0;
  return easeOutQuad(msSinceOpen / SS_ANIM.doorMs);
}

/** 传送旋涡相位 0..1:2400ms 一圈 linear;reduced 静止在 0 */
export function swirlPhase(nowMs: number, reduced: boolean): number {
  if (reduced) return 0;
  const ms = Math.max(0, nowMs);
  return (ms % SS_ANIM.swirlMs) / SS_ANIM.swirlMs;
}

/**
 * 鼓包波此刻传到第几节(小数):两节 × 90ms,easeOutQuad 减速;
 * 传完(≥ 180ms)或 reduced 时返回 -9 = 没有波。
 */
export function bulgePos(msSinceEat: number, reduced: boolean): number {
  if (reduced || !(msSinceEat >= 0)) return -9;
  const total = SS_ANIM.bulgeNodeMs * SS_ANIM.bulgeNodes;
  if (msSinceEat >= total) return -9;
  return easeOutQuad(msSinceEat / total) * SS_ANIM.bulgeNodes;
}

/* ------------------------------------------------------------------ */
/* 三、一局的视觉小状态(插值计时 / 张嘴金闪帧 / 花砖点亮时刻)             */
/* ------------------------------------------------------------------ */

export interface VisualFx {
  /** 上一口吃在几毫秒(鼓包波起点);-1 = 没有波 */
  eatAtMs: number;
  /** 张嘴剩余帧 / 金闪剩余帧 */
  biteFrames: number;
  goldFrames: number;
  /** 绕圈门打开时刻;-1 = 还没开 */
  doorOpenAtMs: number;
  /** 每块花砖踩亮的时刻(格 key → 毫秒) */
  tileLitAt: Map<number, number>;
  noteEat(nowMs: number): void;
  noteStar(): void;
  noteDoorOpen(nowMs: number): void;
  noteTileLit(key: number, nowMs: number): void;
  /** destroy 时全部归零:计时、帧、砖点亮记录一个不留 */
  reset(): void;
}

export function createVisualFx(): VisualFx {
  return {
    eatAtMs: -1,
    biteFrames: 0,
    goldFrames: 0,
    doorOpenAtMs: -1,
    tileLitAt: new Map<number, number>(),
    noteEat(nowMs: number) {
      this.eatAtMs = nowMs;
      this.biteFrames = SS_ANIM.biteFrames;
    },
    noteStar() {
      this.goldFrames = SS_ANIM.goldFrames;
    },
    noteDoorOpen(nowMs: number) {
      this.doorOpenAtMs = nowMs;
    },
    noteTileLit(key: number, nowMs: number) {
      this.tileLitAt.set(key, nowMs);
    },
    reset() {
      this.eatAtMs = -1;
      this.biteFrames = 0;
      this.goldFrames = 0;
      this.doorOpenAtMs = -1;
      this.tileLitAt.clear();
    },
  };
}
