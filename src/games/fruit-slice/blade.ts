/**
 * 水果切切乐 · 1.2 刀光判定、连刀与水果暴风(纯函数,不碰 DOM)。
 *
 * 1.1 的切割是「上一帧指针 → 这一帧指针」一条线段对着水果**当前**位置做相交,
 * 手划得飞快、或者果子飞得飞快时,两者在这一帧之间擦身而过就漏判了。
 * 1.2 改成扫掠判定:把这一帧切成若干小步,刀和果子一起往前走,任何一步碰上就算切中;
 * 同时给一刀加了最短划动长度,小手指头点一下不会误切。
 *
 * 另外三件事也在这里:连刀(800ms 窗口、可累计但封顶)、
 * 保证「顶点一定在可视区、一定够得着」的抛物线,以及无尽「水果暴风」的节奏表。
 *
 * 前 99 回合的关卡数据一个字段都没动;1.2 的新目标靠 `extrasForRound` 按回合号分批登场。
 */
import { segCircleHit } from "./logic";

// ---------------------------------------------------------------------------
// 一、切割判定
// ---------------------------------------------------------------------------

/** 一刀至少要划这么长(像素)才开始吃判定:防止孩子手指头点一下就误切 */
export const MIN_SWIPE = 16;

/** 这一刀到目前为止划了 len 像素,够不够格切东西 */
export function swipeCounts(len: number): boolean {
  return Number.isFinite(len) && len >= MIN_SWIPE;
}

/** 每多少像素补一个采样点 */
export const SAMPLE_STEP = 26;
/** 一帧最多切成几小步(再多就是白烧 CPU) */
export const MAX_SAMPLES = 12;

/** 这一帧的刀要切成几小步来采样:划得越长越细 */
export function sampleCount(x1: number, y1: number, x2: number, y2: number): number {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (!Number.isFinite(len) || len <= 0) return 1;
  return Math.max(1, Math.min(MAX_SAMPLES, Math.ceil(len / SAMPLE_STEP)));
}

export interface MovingTarget {
  /** 这一帧结束时的位置 */
  x: number;
  y: number;
  /** 像素/秒 */
  vx: number;
  vy: number;
  r: number;
}

/**
 * 扫掠判定:这一帧里刀尖从 (x1,y1) 走到 (x2,y2),水果同时也在飞。
 * 把这一帧均分成若干小步,刀和水果同步倒推回去,任何一小步碰上就算切中。
 * `pad` 是判定走廊的额外宽度(触屏容错)。
 */
export function sweptHit(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  target: MovingTarget,
  dt: number,
  pad = 0
): boolean {
  const n = sampleCount(x1, y1, x2, y2);
  const span = Number.isFinite(dt) && dt > 0 ? dt : 0;
  for (let i = 0; i < n; i++) {
    const a = i / n;
    const b = (i + 1) / n;
    const ax = x1 + (x2 - x1) * a;
    const ay = y1 + (y2 - y1) * a;
    const bx = x1 + (x2 - x1) * b;
    const by = y1 + (y2 - y1) * b;
    const back = 1 - (a + b) / 2;
    const tx = target.x - target.vx * span * back;
    const ty = target.y - target.vy * span * back;
    if (segCircleHit(ax, ay, bx, by, tx, ty, target.r + pad)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 二、连刀
// ---------------------------------------------------------------------------

/** 连击窗口:两刀之间隔了这么久还没超,就算同一串(秒) */
export const BLADE_WINDOW = 0.8;
/** 一刀切到这么多颗就升级成彩虹刀 */
export const RAINBOW_BLADE = 4;
/** 连击倍率封顶在第几串 */
export const BLADE_STREAK_CAP = 6;
/** 每多一串加多少倍率 */
export const BLADE_STREAK_STEP = 0.2;

/** 距离上一刀 gap 秒,连击窗口还开着吗 */
export function bladeWindowAlive(gap: number): boolean {
  return Number.isFinite(gap) && gap >= 0 && gap <= BLADE_WINDOW;
}

/** 一划切中 n 颗的连刀加成:1 颗没有加成,越多越划算 */
export function strokeBonus(n: number): number {
  const k = Number.isFinite(n) ? Math.floor(n) : 0;
  if (k < 2) return 0;
  return (k - 1) * 3;
}

/** 一划切中 n 颗算不算彩虹刀 */
export function isRainbowBlade(n: number): boolean {
  return Number.isFinite(n) && Math.floor(n) >= RAINBOW_BLADE;
}

/** 连了 streak 串之后的分数倍率:可累计,但封顶 */
export function streakMultiplier(streak: number): number {
  const s = Math.max(1, Math.floor(Number.isFinite(streak) ? streak : 1));
  const capped = Math.min(BLADE_STREAK_CAP, s);
  return Math.round((1 + (capped - 1) * BLADE_STREAK_STEP) * 100) / 100;
}

/** 按当前连击串数把基础分折算成实得分 */
export function bladeScore(base: number, streak: number): number {
  return Math.round(Math.max(0, base) * streakMultiplier(streak));
}

/** 一划的战报文案;只切到一颗不报 */
export function bladeLabel(n: number): string | null {
  const k = Number.isFinite(n) ? Math.floor(n) : 0;
  if (k < 2) return null;
  if (isRainbowBlade(k)) return `彩虹刀 ×${k}!!`;
  if (k === 3) return "三连快刀!";
  return "双果快刀!";
}

// ---------------------------------------------------------------------------
// 三、抛物线:顶点一定在可视区里,一定够得着
// ---------------------------------------------------------------------------

/** 顶点最高不越过 h * APEX_TOP(顶得太高就飞出屏幕了) */
export const APEX_TOP = 0.16;
/** 顶点最低也要到 h * APEX_BOTTOM(太低就没得切) */
export const APEX_BOTTOM = 0.56;
/** 顶点离左右边至少留这么多像素 */
export const SIDE_MARGIN = 46;

export interface Arc {
  x: number;
  y: number;
  /** 水平速度(已经把风算进去的「实际」水平速度) */
  vx: number;
  vy: number;
}

/** 到达顶点要多久(秒);vy 是向上的负值 */
export function apexTime(vy: number, g: number): number {
  if (!(g > 0)) return 0;
  return Math.max(0, -vy / g);
}

/** 顶点的高度(y 越小越高) */
export function apexHeight(y0: number, vy: number, g: number): number {
  if (!(g > 0)) return y0;
  return y0 - (vy * vy) / (2 * g);
}

/** 顶点的横坐标 */
export function apexSide(x0: number, vx: number, vy: number, g: number): number {
  return x0 + vx * apexTime(vy, g);
}

/**
 * 生成一次「一定切得到」的抛射:先挑好顶点落在哪儿,再倒算初速度。
 * rx / rvx / rvy 都是 0..1 的随机数,纯函数便于测试。
 */
export function safeLaunch(
  w: number,
  h: number,
  rx: number,
  rvx: number,
  rvy: number,
  g: number,
  r = 30
): Arc {
  const gg = g > 0 ? g : 1;
  const x0 = w * (0.16 + 0.68 * clamp01(rx));
  const y0 = h + 30;
  const top = h * APEX_TOP;
  const bottom = h * APEX_BOTTOM;
  const ay = top + (bottom - top) * clamp01(rvy);
  const vy = -Math.sqrt(2 * gg * Math.max(1, y0 - ay));
  const t = apexTime(vy, gg);
  const lo = Math.min(w / 2, SIDE_MARGIN + r);
  const hi = Math.max(w / 2, w - SIDE_MARGIN - r);
  const ax = lo + (hi - lo) * clamp01(rvx);
  const vx = t > 0 ? (ax - x0) / t : 0;
  return { x: x0, y: y0, vx, vy };
}

/** 这条抛物线的顶点是不是既在屏幕里、又在孩子够得着的高度 */
export function arcReachable(a: Arc, w: number, h: number, g: number, r = 30): boolean {
  const ay = apexHeight(a.y, a.vy, g);
  const ax = apexSide(a.x, a.vx, a.vy, g);
  if (!(ay >= h * APEX_TOP - 1 && ay <= h * APEX_BOTTOM + 1)) return false;
  return ax >= r && ax <= w - r;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ---------------------------------------------------------------------------
// 四、1.2 新目标:双倍果 / 花朵 / 连体果(冰冻果沿用 1.0)
// ---------------------------------------------------------------------------

export type ExtraKind = "double" | "flower" | "twin";

export interface ExtraSpec {
  name: string;
  emoji: string;
  /** 能不能切:花朵是唯一不能切的 */
  slicable: boolean;
  tip: string;
}

export const EXTRA_SPEC: Record<ExtraKind, ExtraSpec> = {
  double: {
    name: "双倍果",
    emoji: "✨",
    slicable: true,
    tip: "亮闪闪的双倍果,切开之后几秒钟内每一刀都算两份",
  },
  flower: {
    name: "小花朵",
    emoji: "🌼",
    slicable: false,
    tip: "花朵是给朵朵的礼物,别切它,绕开就好",
  },
  twin: {
    name: "连体果",
    emoji: "🍒",
    slicable: true,
    tip: "两颗连在一起,要切两刀才分得开",
  },
};

/** 双倍果的加成持续几秒 */
export const DOUBLE_SECONDS = 6;
/** 双倍果开着的时候分数乘几 */
export const DOUBLE_MULT = 2;

export function doubleScore(base: number, active: boolean): number {
  return active ? base * DOUBLE_MULT : base;
}

/** 切到花朵要付出的代价:少一次机会(不是伤害,也不掉血) */
export const FLOWER_COST = 1;

/** 切到花朵时的温和提示:只提醒,不责怪 */
export function flowerLine(): string {
  return "哎呀,那是给朵朵的花~下次绕开它就好";
}

/** 冰冻果切了减速几秒 */
export const CHILL_SECONDS = 3;

/** 连体果要切几刀 */
export const TWIN_HITS = 2;

export function twinCracked(hits: number): boolean {
  return Number.isFinite(hits) && hits >= TWIN_HITS;
}

/** 连体果第一刀先分开一半,第二刀才整颗算完 */
export function twinStepScore(hits: number): number {
  const k = Number.isFinite(hits) ? Math.floor(hits) : 0;
  if (k <= 0) return 0;
  return twinCracked(k) ? 5 : 2;
}

/**
 * 第 idx 回合(0 起)会出现哪些 1.2 新目标。
 * 前 99 回合一个都不加,老回合的手感原样保留。
 */
export function extrasForRound(idx: number): ExtraKind[] {
  const i = Number.isFinite(idx) ? Math.floor(idx) : 0;
  if (i < 99) return [];
  const out: ExtraKind[] = ["double"];
  if (i >= 110) out.push("flower");
  if (i >= 140) out.push("twin");
  return out;
}

/** 每次抛射里混进一颗新目标的概率 */
export function extraChance(idx: number): number {
  const i = Number.isFinite(idx) ? Math.floor(idx) : 0;
  if (i < 99) return 0;
  return Math.min(0.16, 0.06 + (i - 99) * 0.0012);
}

// ---------------------------------------------------------------------------
// 五、无尽「水果暴风」
// ---------------------------------------------------------------------------

/** 漏掉这么多颗就收摊 */
export const STORM_MISS_LIMIT = 3;
/** 切错(炸弹 / 花朵)这么多次就收摊 */
export const STORM_MISTAKE_LIMIT = 3;

export function stormOver(missed: number, mistakes: number): boolean {
  return missed >= STORM_MISS_LIMIT || mistakes >= STORM_MISTAKE_LIMIT;
}

export interface StormWave {
  /** 这一波抛几颗 */
  count: number;
  /** 距离下一波多少秒 */
  interval: number;
  bombChance: number;
  /** 这一波会不会混新目标 */
  extras: ExtraKind[];
}

/** 三个基础旋钮先后拧到底是第几波(0 起) */
export const STORM_PACE_CAP = 22;

/** 一波最多抛几颗:封顶之后还会再涨,但涨到这儿为止 */
export const STORM_COUNT_MAX = 9;

/** 封顶之后新目标最多多混多少概率 */
export const STORM_EXTRA_BUMP_MAX = 0.2;

/**
 * 第 n 波(0 起)的基础节奏:越往后越密,但都有下限 / 上限。
 *
 * `count` 第 15 波、`interval` 与 `bombChance` 第 22 波先后到顶,
 * 原来到这儿整场暴风就定死了 —— 第 22 波和第 200 波是同一件事。
 * 现在封顶之后 `count` 再慢慢往上爬到 9 颗为止:间隔已经压到 0.55 秒不能再快,
 * 炸弹也不该再多(会变成运气游戏),能加的只剩「一次要照顾几颗」。
 */
export function stormPace(n: number): { count: number; interval: number; bombChance: number } {
  const i = Math.max(0, Number.isFinite(n) ? Math.floor(n) : 0);
  const over = Math.max(0, i - STORM_PACE_CAP);
  const base = Math.min(7, 2 + Math.floor(i / 3));
  return {
    count: Math.min(STORM_COUNT_MAX, base + Math.floor(over / 12)),
    interval: Math.max(0.55, 1.5 - i * 0.045),
    bombChance: Math.min(0.34, 0.08 + i * 0.012),
  };
}

/** 0..1 的确定性随机:同样的 seed 和波号永远给同一张牌 */
export function stormRand(seed: number, n: number): number {
  let x = (Math.floor(seed) * 2654435761 + Math.floor(n) * 40503 + 0x9e3779b9) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 3266489917) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}

/**
 * 第 n 波(0 起)长什么样:节奏是确定的,混哪种新目标由 seed 决定。
 * 基础节奏封顶之后,三种新目标混得越来越勤(各自都有上限),
 * 让后段的压力从「手快」慢慢转到「看清楚再下刀」。
 */
export function stormWave(n: number, seed: number): StormWave {
  const pace = stormPace(n);
  const i = Math.max(0, Number.isFinite(n) ? Math.floor(n) : 0);
  const bump = Math.min(STORM_EXTRA_BUMP_MAX, Math.max(0, i - STORM_PACE_CAP) * 0.006);
  const extras: ExtraKind[] = [];
  const roll = stormRand(seed, i);
  if (i >= 2 && roll < 0.34 + bump) extras.push("double");
  if (i >= 4 && stormRand(seed, i + 977) < 0.3 + bump) extras.push("flower");
  if (i >= 6 && stormRand(seed, i + 4231) < 0.26 + bump) extras.push("twin");
  return { ...pace, extras };
}

/** 暴风里按分数给星(不足 1 星也只鼓励) */
export function stormStars(score: number): 0 | 1 | 2 | 3 {
  const s = Number.isFinite(score) ? score : 0;
  if (s >= 160) return 3;
  if (s >= 95) return 2;
  if (s >= 45) return 1;
  return 0;
}

/** 暴风收摊时的一句话:只鼓励,不批评 */
export function stormLine(score: number, best: number): string {
  if (score <= 0) return "暴风一上来就过去啦~先盯住最中间那一串,下一趟就顺手多了!";
  if (score > best) return `新纪录!这趟水果暴风你切出了 ${score} 分!`;
  return `这趟 ${score} 分,最好纪录是 ${best} 分。划长一点、连着切,连刀分叠起来最快。`;
}

// ---------------------------------------------------------------------------
// 六、收摊清理:监听 / rAF 都塞进袋子里,destroy 一把倒干净
// ---------------------------------------------------------------------------

/** 把要拆的东西记在一起,destroy 时统一归零(纯逻辑,便于单测) */
export class BladeBag {
  private jobs: Array<() => void> = [];

  add(off: () => void): void {
    this.jobs.push(off);
  }

  get size(): number {
    return this.jobs.length;
  }

  clear(): void {
    const jobs = this.jobs;
    this.jobs = [];
    for (const off of jobs) off();
  }
}
