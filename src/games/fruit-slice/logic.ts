// 切切乐 —— 纯逻辑函数,不依赖 DOM,方便单独测试。
// 99 回合九大果园经典战役 + 禅宗限时无炸弹 + 街机无尽!
// 每个果园 11 回合(8 回合手写 + 3 回合生成),配色、特殊水果和物理手感都不一样。

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
  | "royal";

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
];

/** 每章 11 回合:8 回合手写 + 3 回合生成。 */
export const LEVELS_PER_THEME = 11;
export const HANDMADE_PER_THEME = 8;

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
};

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
}

/** idx(0 起)回合属于哪个果园。 */
export function themeOfLevel(idx: number): OrchardId {
  return ORCHARD_ORDER[Math.floor(idx / LEVELS_PER_THEME)];
}

/** 章节 ci(0 起)包含的回合下标。 */
export function levelIndicesOfTheme(ci: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < LEVELS_PER_THEME; i++) out.push(ci * LEVELS_PER_THEME + i);
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
  return isLevelUnlocked(stars, themeIdx * LEVELS_PER_THEME);
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
