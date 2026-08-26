// 切切乐 —— 纯逻辑函数,不依赖 DOM,方便单独测试。
// 1.0:99 回合九大果园经典战役 + 禅宗限时无炸弹 + 街机无尽!
// 每个果园 11 回合(8 回合手写 + 3 回合生成),配色、特殊水果和物理手感都不一样。
//
// 1.1 在末尾续了三个新果园共 89 回合(前 99 回合一字不动):
// 回旋果谷(30)→ 指令果市(30)→ 镜湖果宫(29),合计 188 回合。
// 新机制:连刀判定(一刀之内第 n 颗值 n 分)、指令果(按号码顺序切)、
// 硬壳果(要切两刀,第一刀会被弹开)、镜像模式(左右每隔几秒翻一次)。
// 每个新果园的压轴都是一位「果王」,最后一位就是大果王。

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

/* ---------------- 九大果园 ---------------- */

export type OrchardId =
  | "sunny"
  | "berry"
  | "citrus"
  | "melon"
  | "tropic"
  | "frost"
  | "night"
  | "volcano"
  | "royal"
  | "swirl"
  | "decree"
  | "mirror";

export const ORCHARD_ORDER: OrchardId[] = [
  "sunny",
  "berry",
  "citrus",
  "melon",
  "tropic",
  "frost",
  "night",
  "volcano",
  "royal",
  "swirl",
  "decree",
  "mirror",
];

/** 1.0 的九个果园(1.1 的三个新果园不参与老生成器)。 */
export type LegacyOrchardId =
  | "sunny"
  | "berry"
  | "citrus"
  | "melon"
  | "tropic"
  | "frost"
  | "night"
  | "volcano"
  | "royal";

/** 1.0 的九个果园,每章 11 回合:8 回合手写 + 3 回合生成。 */
export const LEVELS_PER_THEME = 11;
export const HANDMADE_PER_THEME = 8;
export const LEGACY_ORCHARDS = 9;
export const LEGACY_ROUNDS = LEGACY_ORCHARDS * LEVELS_PER_THEME;

/** 1.1 新三个果园的回合数(前 99 回合的切分一格都没动)。 */
export const NEW_ORCHARD_SIZES = [30, 30, 29] as const;

/** 每章回合数:前九章各 11 回合,后三章 30/30/29。 */
export const THEME_SIZES: number[] = [
  ...Array.from({ length: LEGACY_ORCHARDS }, () => LEVELS_PER_THEME),
  ...NEW_ORCHARD_SIZES,
];

export const TOTAL_ROUNDS = THEME_SIZES.reduce((a, b) => a + b, 0);

/** 章节 ci(0 起)有几回合。 */
export function themeSize(ci: number): number {
  return THEME_SIZES[ci] ?? 0;
}

/** 章节 ci(0 起)的第一回合下标。 */
export function themeStart(ci: number): number {
  let s = 0;
  for (let i = 0; i < ci && i < THEME_SIZES.length; i++) s += THEME_SIZES[i];
  return s;
}

/** idx(0 起)回合属于第几章。 */
export function themeIndexOf(idx: number): number {
  let s = 0;
  for (let ci = 0; ci < THEME_SIZES.length; ci++) {
    s += THEME_SIZES[ci];
    if (idx < s) return ci;
  }
  return THEME_SIZES.length - 1;
}

export interface OrchardStyle {
  name: string;
  emoji: string;
  bgTop: string;
  bgBottom: string;
  accent: string;
  /** 本果园会出现的特殊水果 */
  specials: SpecialKind[];
  /** 侧风:水果横向漂移(像素/秒,负数往左) */
  wind: number;
  /** 重力倍率:小了飘,大了砸 */
  gravityMult: number;
  /** 水果大小倍率:小果子考精准,大瓜好切 */
  fruitScale: number;
  blurb: string;
}

export const ORCHARD_STYLE: Record<OrchardId, OrchardStyle> = {
  sunny: {
    name: "阳光果园", emoji: "🍑", bgTop: "#fdf3e0", bgBottom: "#ffe6ee", accent: "#c47a2a",
    specials: ["banana"], wind: 0, gravityMult: 1, fruitScale: 1,
    blurb: "暖洋洋的新手果园,认识炸弹和彩虹香蕉",
  },
  berry: {
    name: "莓莓丛林", emoji: "🫐", bgTop: "#e8e0ff", bgBottom: "#ffd9ec", accent: "#7a5ac9",
    specials: ["banana", "ice"], wind: 0, gravityMult: 1, fruitScale: 0.92,
    blurb: "小小的莓果考验准头,冰冻果第一次登场",
  },
  citrus: {
    name: "柑橘海岸", emoji: "🍊", bgTop: "#ffedc2", bgBottom: "#c9ecff", accent: "#e08a2a",
    specials: ["banana", "boom"], wind: 60, gravityMult: 1, fruitScale: 1,
    blurb: "海风把果子往边上吹!爆裂果和大炸弹登场",
  },
  melon: {
    name: "瓜瓜农场", emoji: "🍉", bgTop: "#dff2c9", bgBottom: "#ffe9d6", accent: "#4a9a3a",
    specials: ["ice", "boom"], wind: 0, gravityMult: 1, fruitScale: 1.15,
    blurb: "大瓜又大又好切,可炸弹也跟着变多了",
  },
  tropic: {
    name: "热带雨林", emoji: "🍍", bgTop: "#c9f0dc", bgBottom: "#fff3c2", accent: "#2a9a6a",
    specials: ["banana", "ice", "boom"], wind: 40, gravityMult: 1, fruitScale: 1,
    blurb: "三种特殊水果全到齐,湿热的风一直吹",
  },
  frost: {
    name: "冰霜果窖", emoji: "🧊", bgTop: "#ddeeff", bgBottom: "#f2f8ff", accent: "#4a7ab8",
    specials: ["ice"], wind: 0, gravityMult: 0.92, fruitScale: 1,
    blurb: "冷藏的果子飘得慢一点,冰冻果特别多",
  },
  night: {
    name: "星夜果市", emoji: "🌙", bgTop: "#3e4468", bgBottom: "#6a6f9e", accent: "#ffd868",
    specials: ["banana", "ice", "boom"], wind: 0, gravityMult: 0.72, fruitScale: 1,
    blurb: "夜市的果子轻飘飘挂在半空,连击好机会!",
  },
  volcano: {
    name: "火焰果山", emoji: "🌋", bgTop: "#5a2a2a", bgBottom: "#8e4a3a", accent: "#ff9e5a",
    specials: ["boom"], wind: -50, gravityMult: 1.18, fruitScale: 1,
    blurb: "火山口的果子落得飞快,热风还往左刮",
  },
  royal: {
    name: "果神殿", emoji: "👑", bgTop: "#ffe9f8", bgBottom: "#e0d0ff", accent: "#8a3a9a",
    specials: ["banana", "ice", "boom"], wind: 30, gravityMult: 1.05, fruitScale: 0.9,
    blurb: "最终试炼!小果子、侧风、全部炸弹一起上",
  },
  swirl: {
    name: "回旋果谷", emoji: "🌀", bgTop: "#e0f5e8", bgBottom: "#fff0d6", accent: "#1f7a5e",
    specials: ["banana", "boom"], wind: 45, gravityMult: 0.95, fruitScale: 1.02,
    blurb: "山谷的果子成串打转,一刀连着切分数翻着涨",
  },
  decree: {
    name: "指令果市", emoji: "🔖", bgTop: "#f6e4ff", bgBottom: "#ffe4ee", accent: "#6a2a9a",
    specials: ["banana", "ice", "boom"], wind: -35, gravityMult: 1.08, fruitScale: 0.95,
    blurb: "挂号码牌的指令果要按顺序切,记性和手速一起考",
  },
  mirror: {
    name: "镜湖果宫", emoji: "🪞", bgTop: "#d6f0f5", bgBottom: "#e8e0ff", accent: "#1f6a8a",
    specials: ["banana", "ice", "boom"], wind: 25, gravityMult: 1, fruitScale: 0.94,
    blurb: "湖面一翻,左右就颠倒过来,全部机制在这里收官",
  },
};

/* ---------------- 1.1 新机制:连刀 / 指令果 / 硬壳果 / 镜像 ---------------- */

/** 连刀:一刀之内连着切,第 n 颗值 n 分,最多按 CHAIN_MAX 算。 */
export const CHAIN_MAX = 5;

/** 一刀之内第 n 颗(1 起)水果值几分:1,2,3,4,5,5,5…… */
export function chainGain(n: number): number {
  if (n <= 1) return 1;
  return Math.min(CHAIN_MAX, Math.floor(n));
}

/** 一刀切到 n 颗水果一共几分。 */
export function chainTotal(n: number): number {
  let s = 0;
  for (let i = 1; i <= n; i++) s += chainGain(i);
  return s;
}

/** 连刀文案;一刀只切到一颗不报。 */
export function chainLabel(n: number): string | null {
  if (n < 2) return null;
  if (n === 2) return "连刀 ×2";
  if (n < CHAIN_MAX) return `连刀 ×${n}!`;
  return `满连刀 ×${n}!!`;
}

/** 指令果:一组最多挂几颗号码牌。 */
export const COMMAND_MAX = 4;
/** 切对第 step 颗(1 起)指令果得几分。 */
export function commandStepScore(step: number): number {
  return 2 + Math.max(0, Math.floor(step));
}
/** 一整组指令果按顺序切完的额外奖励。 */
export const COMMAND_CLEAR_BONUS = 12;

/** 一组 count 颗指令果的号码顺序。 */
export function commandSequence(count: number): number[] {
  const n = Math.max(1, Math.min(COMMAND_MAX, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => i + 1);
}

/** 切到号码 got 时,期待的是 need:对了继续,错了从头数。 */
export function commandCheck(need: number, got: number): "ok" | "wrong" {
  return got === need ? "ok" : "wrong";
}

/** 切错顺序不掉心,只是这组重新数(失败只鼓励)。 */
export function commandResetNeed(): number {
  return 1;
}

/** 指令果提示文案。 */
export function commandLabel(need: number, total: number): string {
  return `按号码切:下一颗 ${need}/${total}`;
}

/** 硬壳果:要切两刀,第一刀只会把它弹开。 */
export const SHELL_HITS = 2;
/** 硬壳果被切开给几分(比普通果值钱)。 */
export const SHELL_SCORE = 4;
/** 第一刀之后速度保留多少。 */
export const SHELL_BOUNCE = 0.55;
/** 第一刀额外把硬壳果向上顶多少(像素/秒),留出补刀时间。 */
export const SHELL_KICK = 170;

/** 硬壳果挨了 hits 刀之后是不是裂开了。 */
export function shellCracked(hits: number): boolean {
  return hits >= SHELL_HITS;
}

/**
 * 硬壳果第一刀:速度关于刀线镜像反射,再乘上保留系数并向上弹一下。
 * (dx, dy) 是刀的方向向量。
 */
export function shellBounce(
  vx: number,
  vy: number,
  dx: number,
  dy: number,
): { vx: number; vy: number } {
  const len = Math.hypot(dx, dy);
  if (len === 0) return { vx: -vx * SHELL_BOUNCE, vy: -vy * SHELL_BOUNCE - SHELL_KICK };
  const ux = dx / len;
  const uy = dy / len;
  const dot = vx * ux + vy * uy;
  return {
    vx: (2 * dot * ux - vx) * SHELL_BOUNCE,
    vy: (2 * dot * uy - vy) * SHELL_BOUNCE - SHELL_KICK,
  };
}

/** 镜像模式:每隔这么多秒左右翻一次。 */
export const MIRROR_PERIOD = 6;

/** t 秒时镜像开着没有(前半个周期正常,后半个周期翻过来)。 */
export function mirrorOn(t: number, period: number = MIRROR_PERIOD): boolean {
  const p = period > 0 ? period : MIRROR_PERIOD;
  return Math.floor(Math.max(0, t) / p) % 2 === 1;
}

/** 镜像开着的时候,手指的横坐标要翻到对面去。 */
export function mirrorX(x: number, w: number, on: boolean): number {
  return on ? w - x : x;
}

/* ---------------- 1.1 果王 ---------------- */

export type FruitKingId = "swirlKing" | "decreeKing" | "grandKing";

export interface FruitKingSpec {
  name: string;
  emoji: string;
  /** 要切几刀才倒下 */
  hp: number;
  /** 果王本体半径 */
  r: number;
  /** 每次现身待几秒 */
  showTime: number;
  /** 两次现身之间躲几秒 */
  hideTime: number;
  /** 切中一刀得几分 */
  hitScore: number;
  /** 倒下时的额外奖励分 */
  downBonus: number;
  /** 会甩硬壳果出来 */
  throwsShell?: boolean;
  /** 会挂指令果号码牌 */
  decrees?: boolean;
  /** 会把左右翻过来 */
  flips?: boolean;
  /** 血量过半会加速躲闪 */
  enrages?: boolean;
  blurb: string;
}

export const KING_INFO: Record<FruitKingId, FruitKingSpec> = {
  swirlKing: {
    name: "回旋果王", emoji: "🌀", hp: 8, r: 62, showTime: 4.6, hideTime: 2.4,
    hitScore: 6, downBonus: 20, throwsShell: true,
    blurb: "转着圈甩硬壳果,连刀切它最划算",
  },
  decreeKing: {
    name: "令牌果王", emoji: "🔖", hp: 10, r: 66, showTime: 4.2, hideTime: 2.2,
    hitScore: 7, downBonus: 24, throwsShell: true, decrees: true,
    blurb: "一边发号码牌一边扔硬壳果,按顺序拆它的招",
  },
  grandKing: {
    name: "大果王", emoji: "👑", hp: 12, r: 72, showTime: 4, hideTime: 2,
    hitScore: 8, downBonus: 30, throwsShell: true, decrees: true, flips: true, enrages: true,
    blurb: "果园的压轴对手:发令牌、甩硬壳,还会把镜湖整个翻过来",
  },
};

/** 果王被切了 hits 刀之后倒了没有。 */
export function kingDown(spec: FruitKingSpec, hits: number): boolean {
  return hits >= spec.hp;
}

/** 果王剩一半血会加速躲闪:返回现身时长的倍率。 */
export function kingShowMult(spec: FruitKingSpec, hits: number): number {
  if (!spec.enrages) return 1;
  return hits * 2 >= spec.hp ? 0.75 : 1;
}

/** 果王回合的过关判定:分数达标 + 果王倒下,缺一不可。 */
export function roundIsCleared(
  score: number,
  target: number,
  hasKing: boolean,
  down: boolean,
): boolean {
  if (score < target) return false;
  return !hasKing || down;
}

/* ---------------- 经典战役(99 回合) ---------------- */

export interface RoundDef {
  name: string;
  orchard: OrchardId;
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
  /** 本回合独特机制标记(测试用,全战役唯一) */
  feature: string;
  /** 生成器产出的回合 */
  gen?: boolean;
  hint: string;

  /* ---- 1.1 新机制(前 99 回合都不带这些字段) ---- */
  /** 连刀判定:一刀之内第 n 颗值 n 分 */
  chain?: boolean;
  /** 指令果:每组挂几颗号码牌(要按号码从小到大切) */
  command?: number;
  /** 硬壳果:每次抛射混进硬壳果的概率 */
  shellChance?: number;
  /** 镜像模式:左右每隔几秒翻一次 */
  mirror?: boolean;
  /** 镜像翻转周期(秒),不填走 MIRROR_PERIOD */
  mirrorPeriod?: number;
  /** 果王回合 */
  king?: FruitKingId;
}

/** idx(0 起)回合属于哪个果园。 */
export function themeOfLevel(idx: number): OrchardId {
  return ORCHARD_ORDER[themeIndexOf(idx)];
}

/** 章节 ci(0 起)包含的回合下标。 */
export function levelIndicesOfTheme(ci: number): number[] {
  const base = themeStart(ci);
  const out: number[] = [];
  for (let i = 0; i < themeSize(ci); i++) out.push(base + i);
  return out;
}

/** 手写回合的简写构造器。 */
function R(
  ci: number,
  name: string,
  target: number,
  time: number,
  bombChance: number,
  bigBombChance: number,
  maxOnScreen: number,
  volleyMin: number,
  volleyMax: number,
  specials: SpecialKind[],
  feature: string,
  hint: string,
): RoundDef {
  return {
    name,
    orchard: ORCHARD_ORDER[ci],
    target,
    time,
    bombChance,
    bigBombChance,
    maxOnScreen,
    volleyMin,
    volleyMax,
    specials,
    feature,
    hint,
  };
}

/** 生成回合:炸弹概率取三位小数,保证和手写回合(两位小数)不同模板。 */
// 第 75/95/97 等生成回合修复:原目标 16+ci*8+pos*2 在后期章节超过全场水果供给
// (R95 满切也只有 ~85% 目标,数学上不可能),改为 26+ci*5+sub*2 并把每波上限
// 提到 4~5 颗,保证一年级(切到 ~65% 水果)也能达标。
function genRound(ci: number, sub: number): RoundDef {
  const orchard = ORCHARD_ORDER[ci];
  const st = ORCHARD_STYLE[orchard];
  return {
    name: `${st.name}加宴 ${sub + 1} 号`,
    orchard,
    target: 26 + ci * 5 + sub * 2,
    time: 40 + (ci % 3) * 2,
    bombChance: Math.round((0.101 + ci * 0.02 + sub * 0.025) * 1000) / 1000,
    bigBombChance: ci >= 2 ? Math.round((0.02 + ci * 0.008) * 1000) / 1000 : 0,
    maxOnScreen: 7 + Math.floor(ci / 2) + (sub === 2 ? 1 : 0),
    volleyMin: 2 + (sub % 2),
    volleyMax: 4 + ((sub + ci) % 2),
    specials: [...st.specials],
    feature: `${st.name}加宴${sub + 1}号`,
    gen: true,
    hint: `${st.name}临时加宴!炸弹混得更刁钻,看清再切`,
  };
}

/** 一章 = 6 回合手写 + 3 回合生成 + 手写挑战回合 + 手写压轴回合。 */
function buildOrchard(ci: number, hand: RoundDef[]): RoundDef[] {
  if (hand.length !== HANDMADE_PER_THEME) {
    throw new Error(`orchard ${ci} 手写回合数量应为 ${HANDMADE_PER_THEME}`);
  }
  return [
    ...hand.slice(0, 6),
    genRound(ci, 0),
    genRound(ci, 1),
    genRound(ci, 2),
    hand[6],
    hand[7],
  ];
}

/* ---- 第 1 章 · 阳光果园:入门 + 炸弹和香蕉 ---- */
const sunnyHand: RoundDef[] = [
  R(0, "热身果盘", 20, 40, 0, 0, 6, 1, 2, [], "入门切果", "手指划过水果,唰!切到目标分就赢"),
  R(0, "小心黑球", 24, 40, 0.12, 0, 6, 1, 2, [], "普通炸弹登场", "黑黑的小炸弹别碰,切到会掉爱心!"),
  R(0, "香蕉派对", 28, 40, 0.12, 0, 7, 1, 3, ["banana"], "彩虹香蕉登场", "切到发光的彩虹香蕉,水果雨双倍分!"),
  R(0, "快手果盘", 32, 40, 0.15, 0, 7, 2, 3, ["banana"], "双发快抛", "水果一次来两三个,练练快手!"),
  R(0, "黑球排排站", 34, 42, 0.2, 0, 7, 2, 3, [], "炸弹密度上调", "炸弹变多啦,睁大眼睛!"),
  R(0, "连击初训", 36, 42, 0.15, 0, 8, 3, 4, ["banana"], "连击训练", "一刀切多个有爆击加分,冲连击!"),
  R(0, "阳光毕业宴", 40, 42, 0.22, 0, 8, 2, 4, ["banana"], "阳光毕业考", "阳光果园学的全用上!"),
  R(0, "阳光大丰收", 42, 44, 0.18, 0, 8, 3, 4, ["banana"], "阳光压轴宴", "大丰收!切完去莓莓丛林!"),
];

/* ---- 第 2 章 · 莓莓丛林:小果子 + 冰冻果 ---- */
const berryHand: RoundDef[] = [
  R(1, "莓莓初尝", 30, 40, 0.14, 0, 7, 2, 3, ["banana"], "小果子登场", "莓果小小的,下刀要更准!"),
  R(1, "冰冰凉凉", 34, 42, 0.15, 0, 7, 2, 3, ["banana", "ice"], "冰冻果登场", "切到蓝蓝的冰冻果,全场慢动作!"),
  R(1, "果雨绵绵", 38, 42, 0.18, 0, 8, 2, 4, ["banana", "ice"], "同屏大果雨", "满屏都是小果子,看准了再切!"),
  R(1, "丛林快闪", 36, 30, 0.16, 0, 8, 3, 4, ["ice"], "超短限时", "只有 30 秒!手别停!"),
  R(1, "莓莓连击谷", 42, 42, 0.18, 0, 9, 3, 4, ["banana", "ice"], "丛林连击谷", "小果子扎堆飞,连击好时机!"),
  R(1, "黑莓陷阱", 44, 44, 0.26, 0, 8, 2, 3, ["ice"], "高炸弹陷阱", "黑莓?不,是炸弹!别看走眼"),
  R(1, "丛林毕业宴", 48, 44, 0.22, 0, 9, 2, 4, ["banana", "ice"], "丛林毕业考", "小果子+冰冻果的毕业考!"),
  R(1, "莓莓女王宴", 52, 46, 0.2, 0, 9, 3, 4, ["banana", "ice"], "丛林压轴宴", "切给莓莓女王看!下一站海岸!"),
];

/* ---- 第 3 章 · 柑橘海岸:侧风 + 爆裂果 + 大炸弹 ---- */
const citrusHand: RoundDef[] = [
  R(2, "海风初起", 38, 42, 0.15, 0, 8, 2, 3, ["banana"], "侧风登场", "海风把果子往旁边吹,提前下刀!"),
  R(2, "爆裂惊喜", 42, 42, 0.16, 0, 8, 2, 3, ["banana", "boom"], "爆裂果登场", "红红的爆裂果一切就炸,周围水果全开花!"),
  R(2, "大家伙来了", 44, 44, 0.14, 0.07, 8, 2, 3, ["banana", "boom"], "大炸弹登场", "大炸弹又大又凶,切到掉 2 颗心!"),
  R(2, "橘子浪花", 48, 42, 0.18, 0.05, 9, 3, 4, ["boom"], "浪花快抛", "一浪一浪的橘子,跟上节奏!"),
  R(2, "逆风快刀", 50, 40, 0.2, 0.05, 9, 2, 4, ["banana", "boom"], "逆风限时", "风更大了,时间更紧了!"),
  R(2, "炸弹码头", 52, 44, 0.3, 0.06, 9, 2, 4, ["boom"], "炸弹阵突围", "码头全是炸弹!看清楚再下刀"),
  R(2, "海岸毕业宴", 56, 44, 0.24, 0.08, 9, 3, 4, ["banana", "boom"], "海岸毕业考", "侧风+爆裂果+大炸弹,毕业考!"),
  R(2, "柑橘灯塔宴", 60, 46, 0.2, 0.06, 10, 3, 4, ["banana", "boom"], "海岸压轴宴", "灯塔亮了,切出最亮的一刀!"),
];

/* ---- 第 4 章 · 瓜瓜农场:大果子 + 冰火两重天 ---- */
const melonHand: RoundDef[] = [
  R(3, "大瓜敞开切", 46, 42, 0.16, 0.04, 8, 2, 3, ["ice"], "大瓜登场", "瓜瓜农场的果子特别大,爽快切!"),
  R(3, "冰火两重天", 50, 42, 0.18, 0.05, 9, 2, 4, ["ice", "boom"], "冰火交替", "冰冻果配爆裂果,先冻住再炸!"),
  R(3, "瓜田连击赛", 54, 44, 0.18, 0.05, 10, 3, 4, ["ice", "boom"], "瓜田连击赛", "大瓜好切,连击冲起来!"),
  R(3, "西瓜快刀会", 52, 32, 0.16, 0.04, 9, 3, 4, ["ice"], "瓜田限时", "32 秒快刀会,唰唰唰!"),
  R(3, "炸弹瓜田", 58, 44, 0.28, 0.07, 9, 2, 4, ["boom"], "瓜田炸弹阵", "炸弹藏在瓜堆里,别切歪!"),
  R(3, "大炸弹警报", 60, 44, 0.18, 0.13, 9, 2, 4, ["ice"], "大炸弹警报", "大炸弹出没频繁,冰冻果能救命!"),
  R(3, "农场毕业宴", 64, 46, 0.24, 0.08, 10, 3, 4, ["ice", "boom"], "农场毕业考", "大瓜+冰火+大炸弹,毕业考!"),
  R(3, "瓜王争霸宴", 68, 46, 0.2, 0.07, 10, 3, 5, ["ice", "boom"], "农场压轴宴", "切出瓜王风范!雨林见!"),
];

/* ---- 第 5 章 · 热带雨林:三特殊果全开 + 湿热风 ---- */
const tropicHand: RoundDef[] = [
  R(4, "雨林开胃盘", 54, 44, 0.18, 0.05, 9, 2, 4, ["banana", "ice", "boom"], "三果全开", "三种特殊水果全到齐啦!"),
  R(4, "香蕉狂欢节", 58, 44, 0.2, 0.05, 10, 3, 4, ["banana"], "香蕉狂欢", "香蕉特别多,水果雨一场接一场!"),
  R(4, "藤蔓快抛手", 60, 42, 0.22, 0.06, 10, 3, 5, ["banana", "boom"], "藤蔓快抛", "藤蔓弹射!果子又多又快"),
  // 第 48 关修复:28 秒供给 ~70 颗,原目标 56 全切也只有 1.25 倍余量,
  // 一年级(切到 ~65%)只能拿 ~46 分,按供给 65% 定为 48。
  R(4, "雨林闪电战", 48, 28, 0.18, 0.05, 10, 3, 4, ["banana", "ice"], "雨林限时", "只有 28 秒的闪电战!"),
  R(4, "湿热炸弹雨", 64, 46, 0.3, 0.08, 10, 2, 4, ["ice", "boom"], "雨林炸弹雨", "湿热的风里混着好多炸弹!"),
  R(4, "冻住!别动", 66, 44, 0.22, 0.06, 10, 3, 4, ["ice"], "冰冻连发", "冰冻果连着出,慢动作切个够!"),
  R(4, "雨林毕业宴", 70, 46, 0.26, 0.09, 11, 3, 5, ["banana", "ice", "boom"], "雨林毕业考", "全部特殊水果和炸弹一起上!"),
  R(4, "雨林之心宴", 76, 48, 0.22, 0.08, 11, 3, 5, ["banana", "ice", "boom"], "雨林压轴宴", "切开雨林之心,前面是冰窖!"),
];

/* ---- 第 6 章 · 冰霜果窖:慢飘果 + 冰冻嘉年华 ---- */
const frostHand: RoundDef[] = [
  R(5, "果窖开门", 60, 44, 0.2, 0.06, 10, 2, 4, ["ice"], "慢飘果登场", "冷藏果飘得慢,看似好切别大意!"),
  R(5, "冰晶果盘", 64, 44, 0.22, 0.06, 10, 3, 4, ["ice"], "冰晶果盘", "冰冻果多多,慢动作叠慢动作!"),
  R(5, "霜花连击窖", 66, 44, 0.2, 0.07, 11, 3, 5, ["ice"], "霜花连击", "果子飘着排队,连击切不停!"),
  // 第 59 关修复:30 秒只出得了 ~75 颗果,原目标 62 连全切都只剩 1.2 倍余量,调 52
  R(5, "冷库快闪", 52, 30, 0.2, 0.05, 10, 3, 4, ["ice"], "冷库限时", "30 秒冷库快闪,别冻着手!"),
  R(5, "黑冰陷阱", 70, 46, 0.32, 0.08, 10, 2, 4, ["ice"], "黑冰炸弹阵", "黑冰一样的炸弹,混在雪里!"),
  R(5, "大黑冰警报", 72, 46, 0.2, 0.14, 10, 2, 4, ["ice"], "大黑冰警报", "大炸弹频出!冰冻果能救命"),
  R(5, "果窖毕业宴", 76, 46, 0.26, 0.09, 11, 3, 5, ["ice"], "果窖毕业考", "冰霜果窖全要素毕业考!"),
  R(5, "冰霜盛宴", 82, 48, 0.22, 0.08, 11, 3, 5, ["ice"], "果窖压轴宴", "切完这一窖,夜市在等你!"),
];

/* ---- 第 7 章 · 星夜果市:低重力漂浮果 ---- */
const nightHand: RoundDef[] = [
  R(6, "夜市开张", 66, 44, 0.2, 0.06, 10, 2, 4, ["banana", "ice"], "低重力登场", "夜市的果子轻飘飘,挂在半空慢慢切!"),
  R(6, "星灯果串", 70, 44, 0.22, 0.07, 11, 3, 4, ["banana", "boom"], "星灯果串", "果子像灯笼一样串着飞!"),
  R(6, "悬浮连击夜", 72, 44, 0.22, 0.07, 11, 3, 5, ["banana", "ice", "boom"], "悬浮连击", "低重力就是连击天堂!"),
  // 第 70 关修复:30 秒供给 ~75 颗,原目标 68 只有 1.1 倍余量不可达,调 54
  R(6, "打烊前快切", 54, 30, 0.2, 0.06, 11, 3, 4, ["banana", "ice"], "夜市限时", "夜市要打烊了,30 秒抢切!"),
  R(6, "黑灯瞎火阵", 76, 46, 0.32, 0.09, 11, 2, 4, ["ice", "boom"], "夜市炸弹阵", "灯一暗,炸弹全混进果堆!"),
  R(6, "流星果雨", 78, 46, 0.24, 0.08, 12, 3, 5, ["banana"], "流星果雨", "香蕉像流星一样划过夜空!"),
  R(6, "夜市毕业宴", 82, 48, 0.26, 0.1, 12, 3, 5, ["banana", "ice", "boom"], "夜市毕业考", "星夜果市全要素毕业考!"),
  R(6, "月光压轴宴", 88, 48, 0.24, 0.09, 12, 3, 5, ["banana", "ice", "boom"], "夜市压轴宴", "月光下最后一切,火山见!"),
];

/* ---- 第 8 章 · 火焰果山:高重力急坠 + 逆风 ---- */
const volcanoHand: RoundDef[] = [
  R(7, "火山口试刀", 72, 44, 0.22, 0.07, 11, 2, 4, ["boom"], "急坠果登场", "火山的果子落得飞快,出手要快!"),
  R(7, "岩浆果串", 76, 44, 0.24, 0.08, 11, 3, 4, ["boom"], "岩浆果串", "热风往左刮,果子全在漂移!"),
  R(7, "爆裂链条", 78, 44, 0.24, 0.08, 12, 3, 5, ["boom"], "爆裂连锁", "爆裂果连环炸,一刀清全场!"),
  // 第 81 关修复:28 秒供给 ~70 颗 < 原目标 74,数学上不可能通关,调 52
  R(7, "喷发前快切", 52, 28, 0.22, 0.07, 11, 3, 4, ["boom"], "火山限时", "火山要喷发!28 秒极速切"),
  // 第 82 关修复:34% 炸弹率下供给 ~99 颗,原目标 82 余量 1.2 倍太紧,调 76
  R(7, "火山炸弹雨", 76, 46, 0.34, 0.1, 11, 2, 4, ["boom"], "火山炸弹雨", "炸弹最多的一回合,冷静!"),
  // 第 83 关修复:大炸弹 15% 还要 84 分,供给 ~99 颗余量仅 1.17 倍,调 78
  R(7, "双倍大家伙", 78, 46, 0.22, 0.15, 11, 2, 4, ["boom"], "大炸弹狂潮", "大炸弹成群出没!"),
  R(7, "火山毕业宴", 88, 48, 0.28, 0.11, 12, 3, 5, ["boom"], "火山毕业考", "急坠+逆风+炸弹雨,毕业考!"),
  R(7, "熔岩压轴宴", 94, 48, 0.26, 0.1, 12, 3, 5, ["boom"], "火山压轴宴", "最烫的一宴!切完登果神殿!"),
];

/* ---- 第 9 章 · 果神殿:小果+侧风+全要素终极试炼 ---- */
const royalHand: RoundDef[] = [
  R(8, "神殿开门礼", 78, 46, 0.24, 0.08, 11, 3, 4, ["banana", "ice", "boom"], "神殿开门", "果神殿开门!小果子配侧风"),
  // 第 90 关修复:40 秒供给 ~100 颗,原目标 82 余量 1.22 倍偏紧,调 78
  R(8, "精准快刀试炼", 78, 40, 0.26, 0.08, 11, 3, 4, ["banana", "ice"], "精准冲刺", "时间紧目标高,刀刀要切准!"),
  R(8, "神殿连击柱", 84, 46, 0.24, 0.09, 12, 3, 5, ["banana", "boom"], "神殿连击柱", "连击柱上刻着你的名字!"),
  // 第 92 关修复:30 秒供给 ~75 颗 < 原目标 80,数学上不可能通关,调 54
  R(8, "圣火快切礼", 54, 30, 0.24, 0.08, 12, 3, 4, ["ice", "boom"], "神殿限时", "圣火燃烧的 30 秒!"),
  // 第 93 关修复:34% 炸弹率下供给 ~103 颗,原目标 88 余量 1.17 倍太紧,调 80
  R(8, "守殿炸弹阵", 80, 48, 0.34, 0.11, 12, 2, 4, ["ice", "boom"], "神殿炸弹阵", "守殿的炸弹军团来了!"),
  R(8, "众果朝圣", 92, 48, 0.26, 0.09, 12, 3, 5, ["banana", "ice", "boom"], "众果朝圣", "所有果子都来朝圣,切不过来啦!"),
  R(8, "全家福果宴", 96, 48, 0.28, 0.12, 12, 3, 5, ["banana", "ice", "boom"], "全要素混切", "全部特殊水果和炸弹一起上!"),
  R(8, "传说果神宴", 100, 50, 0.3, 0.12, 12, 3, 5, ["banana", "ice", "boom"], "最终盛宴", "最终回合!切出 100 分成为果神!"),
];

/* ================ 1.1:三个新果园(第 100–188 回合) ================ */
// 前 99 回合一格不动,这三章整段追加在数组末尾。
// 每章 12 回合手写 + 其余生成;生成回合的目标分在相邻手写回合之间插值,
// 保证整章目标分一路往上爬,而且抛射节奏("4-7"这类)和手写回合不同,
// 模板签名不会撞车。

/** 新果园每章手写 12 回合,其余交给巡宴生成器。 */
export const NEW_HANDMADE_PER_THEME = 12;

/** 新果园手写回合的简写构造器。 */
function N(
  orchard: OrchardId,
  name: string,
  target: number,
  time: number,
  bombChance: number,
  bigBombChance: number,
  maxOnScreen: number,
  volleyMin: number,
  volleyMax: number,
  specials: SpecialKind[],
  feature: string,
  hint: string,
  extra: Partial<RoundDef> = {},
): RoundDef {
  return {
    name,
    orchard,
    target,
    time,
    bombChance,
    bigBombChance,
    maxOnScreen,
    volleyMin,
    volleyMax,
    specials,
    feature,
    hint,
    ...extra,
  };
}

/** 巡宴回合的提示语:把本回合真正开着的机制念一遍。 */
function feastHint(st: OrchardStyle, r: Partial<RoundDef>): string {
  const bits: string[] = [];
  if (r.chain) bits.push("连刀照算");
  if (r.command) bits.push(`${r.command} 颗指令果按号码来`);
  if (r.shellChance) bits.push("硬壳果要补第二刀");
  if (r.mirror) bits.push("湖面还会翻镜像");
  return `${st.name}的常驻巡宴!${bits.join(",")},稳住节奏别乱刀`;
}

/**
 * 拼一个新果园:手写回合按 [0..7] → 巡宴 → [8,9] → 巡宴 → 毕业考 → 果王 排布。
 * 巡宴回合的目标分/时长在左右两侧手写回合之间插值,所以整章严格递增。
 */
function buildNewOrchard(
  orchard: OrchardId,
  hand: RoundDef[],
  size: number,
  opts: {
    volleyMin: number;
    volleyMax: number;
    maxOnScreen: number;
    specials: SpecialKind[];
    bombFrom: number;
    bombTo: number;
    bigBombFrom: number;
    bigBombTo: number;
    /** 巡宴回合固定带上的新机制 */
    base: Partial<RoundDef>;
    /** 巡宴回合轮换的附加机制 */
    rotate: Array<Partial<RoundDef>>;
  },
): RoundDef[] {
  if (hand.length !== NEW_HANDMADE_PER_THEME) {
    throw new Error(`${orchard} 手写回合数量应为 ${NEW_HANDMADE_PER_THEME}`);
  }
  const st = ORCHARD_STYLE[orchard];
  const genCount = size - hand.length;
  if (genCount < 2) throw new Error(`${orchard} 巡宴回合不够排`);
  const firstRun = Math.ceil(genCount / 2);
  const runs = [
    { from: hand[7], to: hand[8], n: firstRun },
    { from: hand[9], to: hand[10], n: genCount - firstRun },
  ];

  let sub = 0;
  const made: RoundDef[][] = [];
  for (const run of runs) {
    const list: RoundDef[] = [];
    for (let i = 0; i < run.n; i++) {
      const f = (i + 1) / (run.n + 1);
      const g = genCount === 1 ? 0 : sub / (genCount - 1);
      const extra: Partial<RoundDef> = {
        ...opts.base,
        ...opts.rotate[sub % opts.rotate.length],
      };
      list.push({
        name: `${st.name}巡宴 ${sub + 1} 号`,
        orchard,
        target: run.from.target + Math.round((run.to.target - run.from.target) * f),
        time: run.from.time + Math.round((run.to.time - run.from.time) * f),
        bombChance: Math.round((opts.bombFrom + (opts.bombTo - opts.bombFrom) * g) * 1000) / 1000,
        bigBombChance:
          Math.round((opts.bigBombFrom + (opts.bigBombTo - opts.bigBombFrom) * g) * 1000) / 1000,
        maxOnScreen: opts.maxOnScreen,
        volleyMin: opts.volleyMin,
        volleyMax: opts.volleyMax,
        specials: [...opts.specials],
        feature: `${st.name}巡宴${sub + 1}号`,
        gen: true,
        hint: feastHint(st, extra),
        ...extra,
      });
      sub++;
    }
    made.push(list);
  }

  return [
    ...hand.slice(0, 8),
    ...made[0],
    hand[8],
    hand[9],
    ...made[1],
    hand[10],
    hand[11],
  ];
}

/* ---- 第 10 章 · 回旋果谷:连刀判定 + 硬壳果登场 ---- */
const swirlHand: RoundDef[] = [
  N("swirl", "回旋初课", 84, 44, 0.2, 0.08, 12, 4, 6, ["banana"], "连刀判定登场", "新规矩:一刀不松手连着切,第 2 颗算 2 分、第 3 颗算 3 分!", { chain: true }),
  N("swirl", "长刀练习", 85, 44, 0.21, 0.08, 12, 4, 6, ["banana"], "连刀长划练习", "别急着抬手,把一刀划长一点,连刀分才叠得起来", { chain: true }),
  N("swirl", "谷风串果", 86, 44, 0.22, 0.08, 12, 4, 6, ["banana", "boom"], "连刀谷风串果", "谷风把果子吹成一串,顺着风向划过去正好连刀", { chain: true }),
  N("swirl", "硬壳登场", 87, 46, 0.21, 0.09, 12, 4, 6, ["banana"], "硬壳果登场", "带木纹的硬壳果要切两刀!第一刀会被弹开,追上去补一刀", { chain: true, shellChance: 0.1 }),
  N("swirl", "补刀练习", 88, 46, 0.22, 0.09, 12, 4, 6, ["banana", "boom"], "硬壳补刀练习", "硬壳果被弹开后会往上飘一下,那一下就是补刀的机会", { chain: true, shellChance: 0.12 }),
  N("swirl", "壳里带连", 90, 46, 0.23, 0.09, 12, 4, 6, ["banana", "boom"], "硬壳混进连刀", "硬壳果混在果串里,连刀被它挡住也别慌,划完再回头", { chain: true, shellChance: 0.14 }),
  N("swirl", "纯连刀擂台", 91, 48, 0.24, 0.1, 12, 4, 6, ["banana"], "纯连刀擂台", "这回没有硬壳果,专心把连刀拉长,冲满连刀!", { chain: true }),
  N("swirl", "回旋炸弹阵", 92, 48, 0.3, 0.11, 12, 4, 6, ["banana", "boom"], "回旋炸弹阵", "炸弹也跟着打转,连刀划长了容易扫到,看准再出手", { chain: true, shellChance: 0.16 }),
  N("swirl", "壳阵回旋", 103, 48, 0.24, 0.1, 12, 4, 6, ["banana", "boom"], "硬壳回旋阵", "整片山谷都是硬壳果,先弹开再一起补刀最省时间", { chain: true, shellChance: 0.14 }),
  N("swirl", "谷底大回旋", 104, 48, 0.25, 0.11, 12, 4, 6, ["banana", "boom"], "谷底大回旋", "果子绕着谷底转圈,画一条大弧线就能连一整串", { chain: true, shellChance: 0.18 }),
  N("swirl", "果谷毕业宴", 115, 50, 0.27, 0.12, 12, 4, 6, ["banana", "boom"], "回旋果谷毕业考", "果谷毕业考!连刀、硬壳、炸弹一起来", { chain: true, shellChance: 0.2 }),
  N("swirl", "回旋果王", 116, 52, 0.24, 0.1, 12, 4, 6, ["banana", "boom"], "果谷果王回旋果王", "回旋果王转着圈甩硬壳果!趁它停下来的时候连刀砍满 8 下", { chain: true, shellChance: 0.16, king: "swirlKing" }),
];

/* ---- 第 11 章 · 指令果市:挂号码牌的指令果 ---- */
const decreeHand: RoundDef[] = [
  N("decree", "号码牌初见", 106, 46, 0.2, 0.08, 12, 4, 6, ["banana", "ice"], "指令果登场", "挂号码牌的是指令果,要先切 1 再切 2,顺序对了才加分", { chain: true, command: 2 }),
  N("decree", "一二顺序", 107, 46, 0.21, 0.08, 12, 4, 6, ["banana", "ice"], "指令果两连顺序", "切错顺序不掉心,只是这一组重新数,放心大胆试", { chain: true, command: 2 }),
  N("decree", "三牌齐挂", 108, 46, 0.22, 0.09, 12, 4, 6, ["banana", "ice", "boom"], "指令果三连顺序", "一次挂三张号码牌,眼睛先找 1,再找 2、3", { chain: true, command: 3 }),
  N("decree", "壳上号码", 109, 48, 0.22, 0.09, 12, 4, 6, ["banana", "ice"], "指令果配硬壳", "硬壳果也来抢镜,别把它当成号码牌", { chain: true, command: 3, shellChance: 0.12 }),
  N("decree", "市集叫号", 110, 48, 0.23, 0.1, 12, 4, 6, ["banana", "ice", "boom"], "指令果市集叫号", "市集一叫号,三张牌就同时飞上来,先规划再下刀", { chain: true, command: 3 }),
  N("decree", "四牌大单", 112, 48, 0.24, 0.1, 12, 4, 6, ["banana", "ice", "boom"], "指令果四连顺序", "四张牌一整组,按顺序切完有一大笔奖励分!", { chain: true, command: 4 }),
  N("decree", "号码与硬壳", 113, 50, 0.25, 0.11, 12, 4, 6, ["banana", "ice", "boom"], "指令果硬壳混编", "硬壳果和号码牌混编,补刀的时候别把顺序切乱", { chain: true, command: 3, shellChance: 0.16 }),
  N("decree", "急单快切", 114, 50, 0.26, 0.11, 12, 4, 6, ["banana", "ice"], "指令果急单", "急单来了!四张牌加硬壳果,手要快心要稳", { chain: true, command: 4, shellChance: 0.14 }),
  N("decree", "对账大单", 125, 50, 0.25, 0.11, 12, 4, 6, ["banana", "ice", "boom"], "指令果对账大单", "整场都在对账,一组切完马上来下一组", { chain: true, command: 4 }),
  N("decree", "壳单齐飞", 126, 50, 0.27, 0.12, 12, 4, 6, ["banana", "ice", "boom"], "指令果壳单齐飞", "硬壳果和四张号码牌齐飞,先弹壳再对号最省事", { chain: true, command: 4, shellChance: 0.18 }),
  N("decree", "果市毕业宴", 137, 50, 0.29, 0.13, 12, 4, 6, ["banana", "ice", "boom"], "指令果市毕业考", "果市毕业考!连刀、号码牌、硬壳果、炸弹全上", { chain: true, command: 4, shellChance: 0.2 }),
  N("decree", "令牌果王", 140, 52, 0.25, 0.11, 12, 4, 6, ["banana", "ice", "boom"], "果市果王令牌果王", "令牌果王一边发号码牌一边扔硬壳果!按顺序拆招,砍它 10 下", { chain: true, command: 4, shellChance: 0.16, king: "decreeKing" }),
];

/* ---- 第 12 章 · 镜湖果宫:左右翻镜像,全机制收官 ---- */
const mirrorHand: RoundDef[] = [
  N("mirror", "湖面初翻", 130, 46, 0.2, 0.08, 13, 5, 7, ["banana", "ice"], "镜像模式登场", "湖面一翻,手往右划刀就往左走!画面上方有镜子图标提醒你", { chain: true, mirror: true, mirrorPeriod: 8 }),
  N("mirror", "翻与不翻", 131, 46, 0.21, 0.08, 13, 5, 7, ["banana", "ice"], "镜像翻与不翻", "镜像每 8 秒开一次关一次,盯住图标就不会切空", { chain: true, mirror: true, mirrorPeriod: 8 }),
  N("mirror", "镜中硬壳", 132, 46, 0.22, 0.09, 13, 5, 7, ["banana", "ice", "boom"], "镜像配硬壳", "镜像里补硬壳果的第二刀,手感要反过来想", { chain: true, mirror: true, mirrorPeriod: 7, shellChance: 0.12 }),
  N("mirror", "镜中号码", 133, 48, 0.22, 0.09, 13, 5, 7, ["banana", "ice", "boom"], "镜像配指令果", "号码牌在镜像里也不会变,顺序照旧,只是手要反着来", { chain: true, mirror: true, mirrorPeriod: 7, command: 2 }),
  N("mirror", "镜湖连刀", 134, 48, 0.23, 0.1, 13, 5, 7, ["banana", "ice", "boom"], "镜像长连刀", "镜像里也能拉长连刀,划出一条反方向的大弧线", { chain: true, mirror: true, mirrorPeriod: 6, shellChance: 0.14 }),
  N("mirror", "三牌照镜", 136, 48, 0.24, 0.1, 13, 5, 7, ["banana", "ice", "boom"], "镜像三牌顺序", "三张号码牌照着镜子挂,别被自己的手带跑偏", { chain: true, mirror: true, mirrorPeriod: 6, command: 3 }),
  N("mirror", "镜壳令牌", 137, 50, 0.25, 0.11, 13, 5, 7, ["banana", "ice", "boom"], "镜像壳牌混编", "镜像、硬壳、号码牌三样叠一起,慢一点也没关系", { chain: true, mirror: true, mirrorPeriod: 6, command: 3, shellChance: 0.16 }),
  N("mirror", "快翻急切", 138, 50, 0.27, 0.12, 13, 5, 7, ["banana", "ice"], "镜像快翻", "镜像 5 秒就翻一次,翻的瞬间先停半拍再下刀", { chain: true, mirror: true, mirrorPeriod: 5, shellChance: 0.18 }),
  N("mirror", "宫前大单", 148, 50, 0.26, 0.12, 13, 5, 7, ["banana", "ice", "boom"], "镜像四牌大单", "果宫门前的四牌大单,镜像里也要一次对完", { chain: true, mirror: true, mirrorPeriod: 5, command: 4 }),
  N("mirror", "镜宫壳阵", 149, 50, 0.28, 0.13, 13, 5, 7, ["banana", "ice", "boom"], "镜像壳阵", "满屏硬壳果照着镜子飞,补刀一定要预判反方向", { chain: true, mirror: true, mirrorPeriod: 5, command: 4, shellChance: 0.18 }),
  N("mirror", "果宫毕业宴", 168, 52, 0.3, 0.14, 13, 5, 7, ["banana", "ice", "boom"], "镜湖果宫毕业考", "果宫毕业考!镜像每 4 秒一翻,连刀号码硬壳炸弹全到齐", { chain: true, mirror: true, mirrorPeriod: 4, command: 4, shellChance: 0.2 }),
  N("mirror", "大果王", 188, 56, 0.26, 0.12, 13, 5, 7, ["banana", "ice", "boom"], "终局果王大果王", "大果王发令牌、甩硬壳,还会亲手翻镜湖!砍它 12 下,拿下第 188 回合", { chain: true, mirror: true, mirrorPeriod: 5, command: 4, shellChance: 0.18, king: "grandKing" }),
];

export const ROUNDS: RoundDef[] = [
  ...buildOrchard(0, sunnyHand),
  ...buildOrchard(1, berryHand),
  ...buildOrchard(2, citrusHand),
  ...buildOrchard(3, melonHand),
  ...buildOrchard(4, tropicHand),
  ...buildOrchard(5, frostHand),
  ...buildOrchard(6, nightHand),
  ...buildOrchard(7, volcanoHand),
  ...buildOrchard(8, royalHand),
  ...buildNewOrchard("swirl", swirlHand, NEW_ORCHARD_SIZES[0], {
    volleyMin: 4,
    volleyMax: 7,
    maxOnScreen: 13,
    specials: ["banana", "boom"],
    bombFrom: 0.221,
    bombTo: 0.263,
    bigBombFrom: 0.083,
    bigBombTo: 0.113,
    base: { chain: true },
    rotate: [{}, { shellChance: 0.13 }, { shellChance: 0.17 }],
  }),
  ...buildNewOrchard("decree", decreeHand, NEW_ORCHARD_SIZES[1], {
    volleyMin: 5,
    volleyMax: 6,
    maxOnScreen: 13,
    specials: ["banana", "ice", "boom"],
    bombFrom: 0.223,
    bombTo: 0.271,
    bigBombFrom: 0.087,
    bigBombTo: 0.121,
    base: { chain: true },
    rotate: [
      { command: 3 },
      { command: 4, shellChance: 0.13 },
      { command: 3, shellChance: 0.17 },
      { command: 4 },
    ],
  }),
  ...buildNewOrchard("mirror", mirrorHand, NEW_ORCHARD_SIZES[2], {
    volleyMin: 4,
    volleyMax: 8,
    maxOnScreen: 14,
    specials: ["banana", "ice", "boom"],
    bombFrom: 0.227,
    bombTo: 0.279,
    bigBombFrom: 0.091,
    bigBombTo: 0.129,
    base: { chain: true, mirror: true },
    rotate: [
      { mirrorPeriod: 7, command: 3 },
      { mirrorPeriod: 6, shellChance: 0.15 },
      { mirrorPeriod: 6, command: 4, shellChance: 0.17 },
      { mirrorPeriod: 5, command: 3 },
      { mirrorPeriod: 5, shellChance: 0.19 },
    ],
  }),
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

export const PROGRESS_KEY = "yiduo-yixing.fruit-slice.campaign.v2";
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

/** 果园章节解锁 = 该章第一回合解锁(即上一章最后一回合已通过)。 */
export function isThemeUnlocked(stars: ReadonlyArray<number>, themeIdx: number): boolean {
  return isLevelUnlocked(stars, themeStart(themeIdx));
}

/** 本章已得的星星数。 */
export function themeStars(stars: ReadonlyArray<number>, themeIdx: number): number {
  let s = 0;
  for (const i of levelIndicesOfTheme(themeIdx)) s += stars[i] ?? 0;
  return s;
}

/** 本章已通过的回合数。 */
export function themeCleared(stars: ReadonlyArray<number>, themeIdx: number): number {
  let n = 0;
  for (const i of levelIndicesOfTheme(themeIdx)) if ((stars[i] ?? 0) > 0) n++;
  return n;
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

/* ---------------- 结算面板朗读 ---------------- */
// 结算面板不走 level99 浮层,识字量有限的孩子靠听。
// 纯函数便于测试;朗读本身走 speech.ts,无中文语音包时静默降级。

/** 经典战役过关结算面板要朗读的整句话。 */
export function clearSpeechLine(name: string, stars: number, bestCombo: number): string {
  const praise = bestCombo >= 5 ? `最高 ${bestCombo} 连切,刀法真棒!` : "切得真棒!";
  return `${name}完成!得到 ${stars} 颗星,${praise}`;
}

/** 经典战役失败结算面板要朗读的整句话。 */
export function retrySpeechLine(): string {
  return "差一点点。没关系,重切这一回合就好!";
}

/** 禅宗/街机自由模式结束面板要朗读的整句话:破纪录要大声夸。 */
export function endSpeechLine(zen: boolean, score: number, newBest: boolean): string {
  const head = zen ? "禅宗时间到!" : "街机挑战结束!";
  return newBest
    ? `${head}本局 ${score} 分,新纪录,太厉害啦!`
    : `${head}本局 ${score} 分,休息一下再来!`;
}
