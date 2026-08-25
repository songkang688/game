// 切切乐 —— 纯逻辑函数,不依赖 DOM,方便单独测试。

/* ---------------- 碰撞与抛射 ---------------- */

/** 线段(刀光)是否切到圆(水果)。 */
export function segCircleHit(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
  }
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  return Math.hypot(cx - px, cy - py) <= r;
}

/**
 * 由 0..1 的随机数生成一次抛射(纯函数,便于测试)。
 * 返回:起点在屏幕下方,初速度向上、稍微飘向中间。
 */
export function makeLaunch(
  w: number,
  h: number,
  rx: number,
  rvx: number,
  rvy: number,
): { x: number; y: number; vx: number; vy: number } {
  const x = w * (0.2 + 0.6 * rx);
  const vx = (w * 0.5 - x) * 0.6 + (rvx - 0.5) * w * 0.25;
  const vy = -(h * 1.05 + rvy * h * 0.3);
  return { x, y: h + 30, vx, vy };
}

/** 重力加速度(和屏幕高度成正比,保证不同屏幕手感一致)。 */
export function gravityFor(h: number): number {
  return h * 0.9;
}

/* ---------------- 连击爆击 ---------------- */

/** 一口气(0.3 秒内)切到 n 个水果的爆击奖励分:2→2,3→6,4→12…… */
export function comboBonus(n: number): number {
  return n >= 2 ? n * (n - 1) : 0;
}

/** 爆击文案;不足两连没有文案。 */
export function comboLabel(n: number): string | null {
  if (n < 2) return null;
  if (n === 2) return "双果快切!";
  if (n === 3) return "三连爆击!";
  return `${n} 连大爆击!!`;
}

/** 连击窗口:两次切中间隔小于这个秒数就算同一串。 */
export const COMBO_WINDOW = 0.3;

/* ---------------- 经典模式(回合闯关) ---------------- */

export interface RoundDef {
  name: string;
  /** 本回合要切到的分数 */
  target: number;
  /** 回合时长(秒) */
  time: number;
  /** 每次抛射里混进炸弹的概率 */
  bombChance: number;
  /** 同屏最多飞行物 */
  maxOnScreen: number;
  /** 每次抛射的水果数量范围 */
  volleyMin: number;
  volleyMax: number;
}

export const ROUNDS: RoundDef[] = [
  { name: "热身果盘", target: 30, time: 40, bombChance: 0.12, maxOnScreen: 6, volleyMin: 1, volleyMax: 2 },
  { name: "果园快手", target: 50, time: 40, bombChance: 0.2, maxOnScreen: 7, volleyMin: 2, volleyMax: 3 },
  { name: "大丰收", target: 75, time: 45, bombChance: 0.28, maxOnScreen: 8, volleyMin: 2, volleyMax: 4 },
];

export const HEARTS_PER_ROUND = 3;

/* ---------------- 香蕉水果雨 ---------------- */

/** 切到彩虹香蕉后,水果雨持续的秒数。 */
export const FRENZY_SECONDS = 4;
/** 水果雨期间每颗水果的分数倍率。 */
export const FRENZY_MULTIPLIER = 2;
/** 彩虹香蕉出现概率(每次抛射)。 */
export const BANANA_CHANCE = 0.07;

/* ---------------- 街机无尽模式 ---------------- */

/** 街机模式难度:得分越高抛射越快、炸弹越多。 */
export function arcadePace(score: number): { interval: number; bombChance: number } {
  const t = Math.min(1, score / 200);
  return {
    interval: Math.max(0.7, 1.5 - t * 0.7),
    bombChance: Math.min(0.34, 0.1 + t * 0.24),
  };
}

/** 街机模式按得分给星;不足 1 星就算没通关。 */
export function arcadeStars(score: number): 0 | 1 | 2 | 3 {
  if (score >= 150) return 3;
  if (score >= 90) return 2;
  if (score >= 40) return 1;
  return 0;
}

/* ---------------- 结算 ---------------- */

export function starsForClassic(retries: number, bombsHit: number): 1 | 2 | 3 {
  if (retries === 0 && bombsHit <= 1) return 3;
  if (retries <= 1) return 2;
  return 1;
}
