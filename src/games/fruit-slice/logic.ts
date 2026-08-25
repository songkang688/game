// 切切乐 —— 纯逻辑函数,不依赖 DOM,方便单独测试。
// 18 回合经典战役 + 禅宗限时无炸弹 + 街机无尽,三种玩法一次切个够!

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

/* ---------------- 特殊水果与炸弹 ---------------- */

/** 特殊水果:彩虹香蕉(水果雨)/冰冻果(时间变慢)/爆裂果(炸开切周围)。 */
export type SpecialKind = "banana" | "ice" | "boom";
/** 炸弹种类:小炸弹掉 1 心,大炸弹掉 2 心还会炸飞全屏水果。 */
export type BombKind = "bomb" | "bigbomb";

/** 切到彩虹香蕉后,水果雨持续的秒数。 */
export const FRENZY_SECONDS = 4;
/** 水果雨期间每颗水果的分数倍率。 */
export const FRENZY_MULTIPLIER = 2;
/** 切到冰冻果后,时间变慢持续秒数。 */
export const ICE_SECONDS = 3.5;
/** 冰冻期间飞行物速度倍率。 */
export const ICE_SLOW = 0.3;
/** 爆裂果炸开的半径(像素),范围内水果全部被切开。 */
export const BOOM_RADIUS = 140;
/** 大炸弹一次掉的心数。 */
export const BIG_BOMB_HEARTS = 2;
/** 每种已解锁特殊水果在每次抛射中出现的概率。 */
export const SPECIAL_CHANCE = 0.08;

/* ---------------- 经典战役(18 回合) ---------------- */

export interface RoundDef {
  name: string;
  /** 本回合要切到的分数 */
  target: number;
  /** 回合时长(秒) */
  time: number;
  /** 每次抛射里混进小炸弹的概率 */
  bombChance: number;
  /** 每次抛射里混进大炸弹的概率 */
  bigBombChance: number;
  /** 同屏最多飞行物 */
  maxOnScreen: number;
  /** 每次抛射的水果数量范围 */
  volleyMin: number;
  volleyMax: number;
  /** 本回合会出现的特殊水果 */
  specials: SpecialKind[];
  /** 本回合独特机制标记(测试用) */
  feature: string;
  hint: string;
}

export const ROUNDS: RoundDef[] = [
  { name: "热身果盘", target: 20, time: 40, bombChance: 0, bigBombChance: 0, maxOnScreen: 6, volleyMin: 1, volleyMax: 2, specials: [], feature: "入门切果", hint: "手指划过水果,唰!切到目标分就赢" },
  { name: "小心黑球", target: 28, time: 40, bombChance: 0.12, bigBombChance: 0, maxOnScreen: 6, volleyMin: 1, volleyMax: 2, specials: [], feature: "普通炸弹登场", hint: "黑黑的小炸弹别碰,切到会掉爱心!" },
  { name: "香蕉派对", target: 34, time: 40, bombChance: 0.12, bigBombChance: 0, maxOnScreen: 7, volleyMin: 1, volleyMax: 3, specials: ["banana"], feature: "彩虹香蕉登场", hint: "切到发光的彩虹香蕉,水果雨双倍分!" },
  { name: "快手果园", target: 42, time: 40, bombChance: 0.15, bigBombChance: 0, maxOnScreen: 7, volleyMin: 2, volleyMax: 3, specials: ["banana"], feature: "双发快抛", hint: "水果一次来两三个,练练快手!" },
  { name: "冰冰凉凉", target: 48, time: 42, bombChance: 0.15, bigBombChance: 0, maxOnScreen: 7, volleyMin: 2, volleyMax: 3, specials: ["banana", "ice"], feature: "冰冻果登场", hint: "切到蓝蓝的冰冻果,全场慢动作!" },
  { name: "果雨绵绵", target: 54, time: 42, bombChance: 0.18, bigBombChance: 0, maxOnScreen: 8, volleyMin: 2, volleyMax: 4, specials: ["banana", "ice"], feature: "同屏大果雨", hint: "满屏都是果子,看准了再切!" },
  { name: "爆裂惊喜", target: 58, time: 42, bombChance: 0.18, bigBombChance: 0, maxOnScreen: 8, volleyMin: 2, volleyMax: 3, specials: ["banana", "ice", "boom"], feature: "爆裂果登场", hint: "红红的爆裂果一切就炸,周围水果全开花!" },
  { name: "大家伙来了", target: 58, time: 45, bombChance: 0.14, bigBombChance: 0.07, maxOnScreen: 8, volleyMin: 2, volleyMax: 3, specials: ["banana", "ice", "boom"], feature: "大炸弹登场", hint: "大炸弹又大又凶,切到掉 2 颗心!" },
  { name: "连击训练营", target: 66, time: 45, bombChance: 0.18, bigBombChance: 0.05, maxOnScreen: 9, volleyMin: 3, volleyMax: 4, specials: ["banana", "ice", "boom"], feature: "连击高分挑战", hint: "一刀切多个有爆击加分,冲连击!" },
  { name: "半场大宴", target: 72, time: 45, bombChance: 0.2, bigBombChance: 0.06, maxOnScreen: 9, volleyMin: 2, volleyMax: 4, specials: ["banana", "ice", "boom"], feature: "上半场毕业考", hint: "学过的都来啦,稳稳切过半场!" },
  { name: "限时快切", target: 52, time: 28, bombChance: 0.16, bigBombChance: 0.05, maxOnScreen: 9, volleyMin: 3, volleyMax: 4, specials: ["banana", "ice"], feature: "超短限时", hint: "只有 28 秒!手别停!" },
  { name: "炸弹阵突围", target: 68, time: 45, bombChance: 0.3, bigBombChance: 0.08, maxOnScreen: 9, volleyMin: 2, volleyMax: 4, specials: ["banana", "ice", "boom"], feature: "炸弹阵突围", hint: "炸弹好多!看清楚再下刀" },
  { name: "冰火两重天", target: 76, time: 45, bombChance: 0.22, bigBombChance: 0.06, maxOnScreen: 9, volleyMin: 2, volleyMax: 4, specials: ["ice", "boom"], feature: "冰火交替", hint: "冰冻果配爆裂果,先冻住再炸!" },
  { name: "香蕉狂欢节", target: 82, time: 45, bombChance: 0.2, bigBombChance: 0.05, maxOnScreen: 10, volleyMin: 3, volleyMax: 4, specials: ["banana"], feature: "香蕉狂欢", hint: "香蕉特别多,水果雨一场接一场!" },
  { name: "大炸弹警报", target: 80, time: 45, bombChance: 0.18, bigBombChance: 0.13, maxOnScreen: 9, volleyMin: 2, volleyMax: 4, specials: ["banana", "ice"], feature: "大炸弹警报", hint: "大炸弹出没频繁,冰冻果能救命!" },
  { name: "精准快刀", target: 86, time: 40, bombChance: 0.26, bigBombChance: 0.08, maxOnScreen: 10, volleyMin: 3, volleyMax: 4, specials: ["banana", "ice", "boom"], feature: "精准冲刺", hint: "时间紧目标高,刀刀要切准!" },
  { name: "全家福果宴", target: 92, time: 48, bombChance: 0.28, bigBombChance: 0.1, maxOnScreen: 10, volleyMin: 3, volleyMax: 5, specials: ["banana", "ice", "boom"], feature: "全要素混切", hint: "全部特殊水果和炸弹一起上!" },
  { name: "传说果神宴", target: 100, time: 50, bombChance: 0.3, bigBombChance: 0.12, maxOnScreen: 11, volleyMin: 3, volleyMax: 5, specials: ["banana", "ice", "boom"], feature: "最终盛宴", hint: "最终回合!切出 100 分成为果神!" },
];

export const HEARTS_PER_ROUND = 3;

/** 单回合星级:不掉心 3 星,掉 1 颗 2 星,通过 1 星。 */
export function starsForRound(heartsLost: number): 1 | 2 | 3 {
  if (heartsLost <= 0) return 3;
  if (heartsLost <= 1) return 2;
  return 1;
}

/* ---------------- 禅宗模式(无炸弹限时) ---------------- */

/** 禅宗模式时长(秒):没有炸弹,安安静静切个够。 */
export const ZEN_SECONDS = 60;

/** 禅宗模式按得分给星。 */
export function zenStars(score: number): 0 | 1 | 2 | 3 {
  if (score >= 130) return 3;
  if (score >= 80) return 2;
  if (score >= 40) return 1;
  return 0;
}

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

/* ---------------- 战役进度 ---------------- */

export const PROGRESS_KEY = "yiduo-yixing.fruit-slice.campaign.v1";
export const BEST_KEY = "yiduo-yixing.fruit-slice.best.v1";

export function parseProgress(raw: string | null, count: number): number[] {
  const out = new Array<number>(count).fill(0);
  if (!raw) return out;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) {
      for (let i = 0; i < Math.min(arr.length, count); i++) {
        const v = arr[i];
        if (typeof v === "number") out[i] = Math.max(0, Math.min(3, Math.round(v)));
      }
    }
  } catch {
    // 坏档当新档
  }
  return out;
}

export function serializeProgress(stars: ReadonlyArray<number>): string {
  return JSON.stringify(stars);
}

export function isLevelUnlocked(stars: ReadonlyArray<number>, idx: number): boolean {
  if (idx <= 0) return true;
  return (stars[idx - 1] ?? 0) > 0;
}

export function totalStars(stars: ReadonlyArray<number>): number {
  return stars.reduce((s, v) => s + v, 0);
}

/** 禅宗/街机最好成绩(用来发星星差额)。 */
export interface BestScores {
  zen: number;
  arcade: number;
}

export function parseBest(raw: string | null): BestScores {
  const out: BestScores = { zen: 0, arcade: 0 };
  if (!raw) return out;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (typeof obj.zen === "number") out.zen = Math.max(0, obj.zen);
    if (typeof obj.arcade === "number") out.arcade = Math.max(0, obj.arcade);
  } catch {
    // 坏档当新档
  }
  return out;
}

export function serializeBest(best: BestScores): string {
  return JSON.stringify(best);
}
