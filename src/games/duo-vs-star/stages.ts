/**
 * 鸭梨大战康康 · 场地（纯数据）。
 *
 * 世界坐标固定 960×540，四周留出弹飞线，渲染时整体缩放到画布，
 * 所以 375×667 的手机和 1280×800 的大屏看到的场地是同一张。
 *
 * 机关一律做成卡通的：会塌的浮岛只是「呼」地散成小云朵、
 * 咕嘟糖浆碰到只会「啵」地把人弹得高高的，是一池软乎乎的甜点。
 */
import type { Bounds } from "./knockback";

export interface Platform {
  /** 左上角 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** solid = 从各个方向都撞得到；pass = 只能从上面落上去的软平台 */
  kind: "solid" | "pass";
  /** 传送带：站上去每秒被推走多少 */
  drift?: number;
  /** 弹簧地：落上去往上弹的初速 */
  bounce?: number;
  /** 冰面：几乎没有摩擦 */
  ice?: boolean;
  /** 会塌：站够几秒就散开 */
  collapse?: number;
  /** 散开几秒后再长回来 */
  restore?: number;
  /** 升降台：上下摆动的幅度 */
  moveY?: number;
  /** 平移台：左右摆动的幅度 */
  moveX?: number;
  /** 摆动一个来回要几秒 */
  period?: number;
  /** 摆动相位（0..1），同一张图上的台子可以错开 */
  phase?: number;
  /** 外观色 */
  color?: string;
}

export interface Syrup {
  /** 糖浆池初始的液面高度（世界 y） */
  top: number;
  /** 液面每秒上升多少 */
  rise: number;
  /** 最高涨到哪（世界 y，越小越高） */
  limit: number;
  /** 碰到糖浆被弹起的初速 */
  bounce: number;
  /** 碰一下涨多少击退值 */
  bump: number;
}

export interface Stage {
  id: string;
  name: string;
  emoji: string;
  /** 一句话介绍，给小朋友看 */
  blurb: string;
  /** 天空渐变的两个颜色 */
  sky: [string, string];
  bounds: Bounds;
  platforms: Platform[];
  /** 出生点（至少 4 个，够 4 人混战） */
  spawns: Array<{ x: number; y: number }>;
  /** 空中的横向风（每秒每秒） */
  wind?: number;
  /** 重力倍率 */
  gravityScale?: number;
  /** 咕嘟糖浆池 */
  syrup?: Syrup;
}

/** 世界大小（渲染时按这个比例缩放） */
export const WORLD_W = 960;
export const WORLD_H = 540;

/** 大多数场地共用的弹飞线 */
const NORMAL_BOUNDS: Bounds = { left: -150, right: 1110, top: -260, bottom: 720 };
/** 宽敞一点的弹飞线（跳台图，飞出去还有救） */
const WIDE_BOUNDS: Bounds = { left: -230, right: 1190, top: -330, bottom: 800 };
/** 紧凑的弹飞线（决战图，一不留神就出去了） */
const TIGHT_BOUNDS: Bounds = { left: -90, right: 1050, top: -200, bottom: 640 };

export const STAGES: Stage[] = [
  {
    id: "cloud-square",
    name: "云朵广场",
    emoji: "☁️",
    blurb: "最平整的一张图，左右两块软云台，适合先熟悉手感。",
    sky: ["#dff0ff", "#ffeaf4"],
    bounds: NORMAL_BOUNDS,
    platforms: [
      { x: 190, y: 400, w: 580, h: 30, kind: "solid", color: "#ffe3f0" },
      { x: 150, y: 288, w: 160, h: 16, kind: "pass", color: "#e6f2ff" },
      { x: 650, y: 288, w: 160, h: 16, kind: "pass", color: "#e6f2ff" },
      { x: 400, y: 208, w: 160, h: 16, kind: "pass", color: "#e6f2ff" },
    ],
    spawns: [
      { x: 300, y: 340 },
      { x: 660, y: 340 },
      { x: 230, y: 240 },
      { x: 730, y: 240 },
    ],
  },
  {
    id: "wobble-isles",
    name: "摇摇浮岛",
    emoji: "🏝️",
    blurb: "浮岛站久了会「呼」地散成小云朵，过几秒才长回来，别在同一块上生根。",
    sky: ["#e9e2ff", "#fff0e6"],
    bounds: NORMAL_BOUNDS,
    platforms: [
      { x: 400, y: 410, w: 170, h: 26, kind: "solid", color: "#ffeede" },
      { x: 150, y: 330, w: 170, h: 18, kind: "pass", collapse: 2.4, restore: 3, color: "#ffd9ea" },
      { x: 640, y: 330, w: 170, h: 18, kind: "pass", collapse: 2.4, restore: 3, color: "#ffd9ea" },
      { x: 260, y: 230, w: 150, h: 16, kind: "pass", collapse: 1.8, restore: 3.4, color: "#d9ecff" },
      { x: 560, y: 230, w: 150, h: 16, kind: "pass", collapse: 1.8, restore: 3.4, color: "#d9ecff" },
    ],
    spawns: [
      { x: 230, y: 270 },
      { x: 720, y: 270 },
      { x: 330, y: 170 },
      { x: 630, y: 170 },
    ],
  },
  {
    id: "belt-works",
    name: "传送带工厂",
    emoji: "🏭",
    blurb: "地板一直在跑，站着不动也会被送到边上，记得逆着跑两步。",
    sky: ["#e2f4ff", "#f6ecff"],
    bounds: NORMAL_BOUNDS,
    platforms: [
      { x: 130, y: 400, w: 300, h: 28, kind: "solid", drift: 70, color: "#d8e8ff" },
      { x: 530, y: 400, w: 300, h: 28, kind: "solid", drift: -70, color: "#d8e8ff" },
      { x: 400, y: 400, w: 160, h: 28, kind: "solid", color: "#efe6ff" },
      { x: 230, y: 280, w: 180, h: 16, kind: "pass", drift: -55, color: "#e4f6ff" },
      { x: 560, y: 280, w: 180, h: 16, kind: "pass", drift: 55, color: "#e4f6ff" },
    ],
    spawns: [
      { x: 300, y: 330 },
      { x: 660, y: 330 },
      { x: 320, y: 220 },
      { x: 640, y: 220 },
    ],
  },
  {
    id: "spring-candy",
    name: "弹簧糖果地",
    emoji: "🍬",
    blurb: "地板是软糖做的，一落地就把你弹起来，空中打斗特别多。",
    sky: ["#ffeef6", "#fff8dd"],
    bounds: NORMAL_BOUNDS,
    platforms: [
      { x: 180, y: 420, w: 600, h: 26, kind: "solid", bounce: 22, color: "#ffd0e0" },
      { x: 120, y: 300, w: 150, h: 16, kind: "pass", bounce: 16, color: "#ffe4b8" },
      { x: 690, y: 300, w: 150, h: 16, kind: "pass", bounce: 16, color: "#ffe4b8" },
      { x: 405, y: 240, w: 150, h: 16, kind: "pass", color: "#fff1c9" },
    ],
    spawns: [
      { x: 290, y: 350 },
      { x: 670, y: 350 },
      { x: 195, y: 250 },
      { x: 765, y: 250 },
    ],
  },
  {
    id: "syrup-pool",
    name: "咕嘟糖浆池",
    emoji: "🍯",
    blurb: "下面的糖浆会慢慢涨上来，碰到只会被「啵」地弹得高高的，快往上面的台子跳！",
    sky: ["#fff2df", "#ffe0e8"],
    bounds: NORMAL_BOUNDS,
    platforms: [
      { x: 330, y: 430, w: 300, h: 24, kind: "solid", color: "#ffe6c4" },
      { x: 130, y: 340, w: 170, h: 16, kind: "pass", color: "#ffd9c2" },
      { x: 660, y: 340, w: 170, h: 16, kind: "pass", color: "#ffd9c2" },
      { x: 250, y: 240, w: 160, h: 16, kind: "pass", color: "#ffecd2" },
      { x: 550, y: 240, w: 160, h: 16, kind: "pass", color: "#ffecd2" },
      { x: 400, y: 150, w: 160, h: 16, kind: "pass", color: "#fff4e2" },
    ],
    spawns: [
      { x: 215, y: 280 },
      { x: 745, y: 280 },
      { x: 330, y: 180 },
      { x: 630, y: 180 },
    ],
    syrup: { top: 620, rise: 9, limit: 300, bounce: 26, bump: 8 },
  },
  {
    id: "windmill-field",
    name: "呼呼风车原",
    emoji: "🌬️",
    blurb: "空中一直有风把人往一边吹，跳之前先看看风往哪儿刮。",
    sky: ["#e6fbf0", "#eef4ff"],
    bounds: NORMAL_BOUNDS,
    platforms: [
      { x: 210, y: 400, w: 540, h: 28, kind: "solid", color: "#d9f2df" },
      { x: 120, y: 300, w: 150, h: 16, kind: "pass", color: "#e8f8ee" },
      { x: 690, y: 300, w: 150, h: 16, kind: "pass", color: "#e8f8ee" },
      { x: 330, y: 220, w: 130, h: 16, kind: "pass", color: "#f0fbf4" },
      { x: 500, y: 220, w: 130, h: 16, kind: "pass", color: "#f0fbf4" },
    ],
    spawns: [
      { x: 300, y: 340 },
      { x: 660, y: 340 },
      { x: 195, y: 250 },
      { x: 765, y: 250 },
    ],
    wind: 16,
  },
  {
    id: "ice-lake",
    name: "滑滑冰湖",
    emoji: "⛸️",
    blurb: "冰面几乎不刹车，想停下来得提前松手，边上更要小心。",
    sky: ["#e8f6ff", "#f2f0ff"],
    bounds: NORMAL_BOUNDS,
    platforms: [
      { x: 160, y: 410, w: 640, h: 26, kind: "solid", ice: true, color: "#dbeeff" },
      { x: 250, y: 300, w: 180, h: 16, kind: "pass", ice: true, color: "#e9f6ff" },
      { x: 530, y: 300, w: 180, h: 16, kind: "pass", ice: true, color: "#e9f6ff" },
      { x: 405, y: 210, w: 150, h: 16, kind: "pass", color: "#f4fbff" },
    ],
    spawns: [
      { x: 300, y: 350 },
      { x: 660, y: 350 },
      { x: 330, y: 240 },
      { x: 630, y: 240 },
    ],
  },
  {
    id: "star-lift",
    name: "星光升降台",
    emoji: "🛗",
    blurb: "三块台子上上下下，踩准时机才追得上对手。",
    sky: ["#efe6ff", "#e3f0ff"],
    bounds: NORMAL_BOUNDS,
    platforms: [
      { x: 380, y: 420, w: 200, h: 24, kind: "solid", color: "#ece2ff" },
      { x: 140, y: 340, w: 160, h: 16, kind: "pass", moveY: 90, period: 5, phase: 0, color: "#dfeaff" },
      { x: 660, y: 340, w: 160, h: 16, kind: "pass", moveY: 90, period: 5, phase: 0.5, color: "#dfeaff" },
      { x: 400, y: 230, w: 160, h: 16, kind: "pass", moveX: 130, period: 6, phase: 0.25, color: "#f0e8ff" },
    ],
    spawns: [
      { x: 220, y: 280 },
      { x: 740, y: 280 },
      { x: 420, y: 180 },
      { x: 540, y: 180 },
    ],
  },
  {
    id: "night-hops",
    name: "夜空跳台",
    emoji: "🌙",
    blurb: "台子小、间隔大，弹飞线却离得远，被撞出去还有机会飘回来。",
    sky: ["#dfe4ff", "#f6e6ff"],
    bounds: WIDE_BOUNDS,
    platforms: [
      { x: 420, y: 400, w: 140, h: 22, kind: "solid", color: "#e6e2ff" },
      { x: 200, y: 330, w: 120, h: 14, kind: "pass", color: "#eae6ff" },
      { x: 650, y: 330, w: 120, h: 14, kind: "pass", color: "#eae6ff" },
      { x: 90, y: 240, w: 110, h: 14, kind: "pass", color: "#f2eaff" },
      { x: 780, y: 240, w: 110, h: 14, kind: "pass", color: "#f2eaff" },
      { x: 430, y: 210, w: 120, h: 14, kind: "pass", color: "#f6f0ff" },
    ],
    spawns: [
      { x: 260, y: 270 },
      { x: 710, y: 270 },
      { x: 145, y: 180 },
      { x: 835, y: 180 },
    ],
    gravityScale: 0.88,
  },
  {
    id: "allstar-arena",
    name: "全明星决战场",
    emoji: "🏟️",
    blurb: "传送带、弹簧、会塌的浮岛全凑齐了，弹飞线还特别近，冠军就在这儿分。",
    sky: ["#ffe9f2", "#e6f0ff"],
    bounds: TIGHT_BOUNDS,
    platforms: [
      { x: 360, y: 410, w: 240, h: 26, kind: "solid", bounce: 14, color: "#ffdcea" },
      { x: 150, y: 350, w: 170, h: 18, kind: "solid", drift: 60, color: "#dfe9ff" },
      { x: 640, y: 350, w: 170, h: 18, kind: "solid", drift: -60, color: "#dfe9ff" },
      { x: 250, y: 250, w: 150, h: 16, kind: "pass", collapse: 2, restore: 2.8, color: "#e8dcff" },
      { x: 560, y: 250, w: 150, h: 16, kind: "pass", collapse: 2, restore: 2.8, color: "#e8dcff" },
      { x: 420, y: 170, w: 120, h: 14, kind: "pass", moveX: 110, period: 5.5, color: "#fff0d9" },
    ],
    spawns: [
      { x: 235, y: 290 },
      { x: 725, y: 290 },
      { x: 325, y: 190 },
      { x: 635, y: 190 },
    ],
  },
];

/** 按 id 找场地，找不到就退回第一张，绝不返回 undefined */
export function stageById(id: string): Stage {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

/** 按下标取场地（自动绕圈），关卡表用它排场地 */
export function stageAt(index: number): Stage {
  const n = STAGES.length;
  const i = ((Math.trunc(index) % n) + n) % n;
  return STAGES[i];
}

/** 升降 / 平移台在 t 秒时的实际位置（纯函数，渲染与碰撞共用同一份） */
export function platformAt(p: Platform, t: number): { x: number; y: number } {
  const period = p.period && p.period > 0 ? p.period : 0;
  if (!period || (!p.moveY && !p.moveX)) return { x: p.x, y: p.y };
  const phase = ((p.phase ?? 0) + t / period) * Math.PI * 2;
  const s = Math.sin(phase);
  return { x: p.x + (p.moveX ?? 0) * s, y: p.y + (p.moveY ?? 0) * s };
}

/** 糖浆在 t 秒时的液面高度（越小越高；没有糖浆池就返回 Infinity） */
export function syrupLevel(stage: Stage, t: number): number {
  const s = stage.syrup;
  if (!s) return Number.POSITIVE_INFINITY;
  const level = s.top - s.rise * Math.max(0, t);
  return Math.max(s.limit, level);
}
