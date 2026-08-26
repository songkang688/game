// 钓鱼小达人 · 188 关关卡表(确定性生成:同一关每次算出来的目标完全一样)。
//
// 八个主题水域合计 188 关,章节和由 level99 的 assertTotal 兜底校验。
// 每一关给出:今天鱼群在哪一段水层(band)、要达成什么目标、限时多久、最多抛几竿、
// 鱼的力气有多大(hardness)。
//
// 关卡只吐数据,不画一个像素,所以「这一关到底打不打得过」可以在单测里全量模拟:
// 用一个标准手法的自动钓手把 188 关跑一遍,一关都不许卡死。

import { chapterOf, indexInChapter, mulberry32, type Chapter } from "../level99";
import { FISH, LAYERS, MAX_DEPTH, clamp, fishWeightAt, layerAt } from "./logic";

export const CHAPTERS: Chapter[] = [
  { name: "晨光浅滩", emoji: "🌤️", color: "#dff1fb", desc: "学抛竿:力度条走到一半松手,钩子就停在小鱼最多的水层", size: 24 },
  { name: "芦苇水湾", emoji: "🌿", color: "#e2f5ea", desc: "水草层的鱼爱赖底,拉扯时间更长,别急着一口气收线", size: 24 },
  { name: "落霞湖心", emoji: "🌇", color: "#ffeede", desc: "水面开阔、鱼群更深,抛竿力度要拿捏得更准", size: 24 },
  { name: "星语深潭", emoji: "🌌", color: "#e9e9fb", desc: "第一次遇上真正有力气的鱼,红区一亮就得松手", size: 24 },
  { name: "冰纹湖", emoji: "❄️", color: "#e4f1f8", desc: "冷水层的鱼挣扎又快又短,张力像心跳一样一跳一跳", size: 23 },
  { name: "珊瑚暗流", emoji: "🪸", color: "#fde9ef", desc: "暗流会让鱼群带变窄,抛偏一点点好鱼就不来了", size: 23 },
  { name: "幽蓝海沟", emoji: "🫧", color: "#e0ecf7", desc: "深水大鱼登场,一竿的时间够别人钓三条小鱼", size: 23 },
  { name: "月光鱼汛", emoji: "🌙", color: "#eee7f8", desc: "传说里的那几条都在这一章,手稳的人才带得走", size: 23 },
];

/** 一关的目标类型 */
export type GoalKind = "count" | "score" | "variety" | "weight";

export interface FishingLevel {
  /** 0 基关号 */
  index: number;
  chapter: number;
  goal: GoalKind;
  /** 目标数值:条数 / 分数 / 种类数 / 千克 */
  need: number;
  /** 今天鱼群所在的水层区间(米) */
  band: { from: number; to: number };
  /** 限时(秒) */
  seconds: number;
  /** 最多抛几竿 */
  casts: number;
  /** 0..1 的难度,只加鱼的力气,不减玩家的收线速度 */
  hardness: number;
  seed: number;
  hint: string;
}

interface ChapterSpec {
  from: number;
  to: number;
  /** 这一章允许出现的目标类型(按关号轮换) */
  goals: GoalKind[];
}

const SPECS: ChapterSpec[] = [
  { from: 0, to: 8, goals: ["count", "count", "score", "count"] },
  { from: 4, to: 14, goals: ["count", "score", "variety", "count"] },
  { from: 10, to: 22, goals: ["count", "score", "count", "weight"] },
  { from: 16, to: 29, goals: ["score", "count", "variety", "weight"] },
  { from: 22, to: 34, goals: ["count", "weight", "score", "variety"] },
  { from: 28, to: 40, goals: ["score", "variety", "weight", "count"] },
  { from: 34, to: 46, goals: ["weight", "score", "count", "variety"] },
  { from: 40, to: MAX_DEPTH, goals: ["score", "weight", "variety", "score"] },
];

// ---------------------------------------------------------------------------
// 鱼群带
// ---------------------------------------------------------------------------

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * 这一关的鱼群带:章节给出大范围,关号越靠后带子越窄、越往深处挪。
 * 带子最窄也留 3 米,保证抛竿手感永远够得着。
 */
export function bandOf(chapter: number, within: number): { from: number; to: number } {
  const spec = SPECS[clamp(Math.round(chapter), 0, SPECS.length - 1)];
  const t = clamp(within, 0, 1);
  const width = spec.to - spec.from;
  let from = spec.from + width * 0.18 * t;
  let to = spec.to - width * 0.22 * t;
  if (to - from < 3) {
    const mid = (from + to) / 2;
    from = mid - 1.5;
    to = mid + 1.5;
  }
  return { from: round1(Math.max(0, from)), to: round1(Math.min(MAX_DEPTH, to)) };
}

/** 鱼群带的中心深度:抛竿瞄这里最稳 */
export function bandCenter(band: { from: number; to: number }): number {
  return round1((band.from + band.to) / 2);
}

/** 落在鱼群带里给的运气加成:好鱼更愿意咬钩 */
export const BAND_LUCK = 0.4;

/**
 * 钩子停在某个深度时,一竿平均能钓到多少分、多少千克。
 * 关卡表拿它折算「攒够多少分」「钓够多少千克」这类目标,
 * 免得写死的数字在深水区变成不可能完成的任务。
 */
export function expectCatch(depth: number, luck: number = BAND_LUCK): { score: number; weight: number } {
  const weights = FISH.map((f) => fishWeightAt(f, depth, luck));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return { score: FISH[0].score, weight: FISH[0].weight };
  let score = 0;
  let weight = 0;
  for (let i = 0; i < FISH.length; i++) {
    score += FISH[i].score * weights[i];
    weight += FISH[i].weight * weights[i];
  }
  return { score: score / total, weight: weight / total };
}

/**
 * 这个深度「十来竿之内大概率碰得到」的鱼种数(占比 12% 以上的那些)。
 * 「钓够几种」的目标拿它封顶:最深的一层常见鱼本来就少,
 * 目标定得比这个数还高就会变成靠运气,不是靠手法。
 */
export function speciesNear(depth: number): number {
  const weights = FISH.map((f) => fishWeightAt(f, depth, BAND_LUCK));
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.filter((w) => w / total >= 0.12).length;
}

// ---------------------------------------------------------------------------
// 关卡生成
// ---------------------------------------------------------------------------

/** 一关要钓上来的鱼的条数量级(其它目标都按它折算) */
export function unitsFor(chapter: number, within: number): number {
  return 3 + Math.round(clamp(within, 0, 1) * 2) + Math.floor(clamp(chapter, 0, 7) / 3);
}

export function hardnessFor(chapter: number, within: number): number {
  return round1(clamp((clamp(chapter, 0, 7) / 7) * 0.85 + clamp(within, 0, 1) * 0.15, 0, 1));
}

const HINTS: Record<GoalKind, string> = {
  count: "先把力度停在鱼群带里,咬钩以后一收一放,别一直按着不放。",
  score: "分数看鱼的稀有度:落点越准,稀有的鱼越愿意来。",
  variety: "同一个深度反复抛就容易钓到同一种,试着在鱼群带里换两三个落点。",
  weight: "大鱼都在深处,力气也大,张力一到红区就立刻松手。",
};

/** 第 index 关(0 基)的全部数据 */
export function buildLevel(index: number): FishingLevel {
  const i = clamp(Math.round(index), 0, 187);
  const chapter = chapterOf(CHAPTERS, i);
  const size = CHAPTERS[chapter].size;
  const within = size > 1 ? indexInChapter(CHAPTERS, i) / (size - 1) : 0;
  const band = bandOf(chapter, within);
  const hardness = hardnessFor(chapter, within);
  const units = unitsFor(chapter, within);
  const goal = SPECS[chapter].goals[i % SPECS[chapter].goals.length];
  const expect = expectCatch(bandCenter(band));

  let need: number;
  if (goal === "count") {
    need = units;
  } else if (goal === "score") {
    // 只按基础分折算:实际游玩还有连击与完美收竿的加成,所以这个门槛是留了余量的
    need = Math.max(10, Math.round(units * expect.score * 0.85));
  } else if (goal === "weight") {
    need = Math.max(1, round1(units * expect.weight * 0.8));
  } else {
    need = clamp(2 + Math.floor(units / 3), 2, Math.max(2, speciesNear(bandCenter(band))));
  }

  const perUnit = 11 + hardness * 4;
  const seconds = Math.round(units * perUnit + 10);
  const casts = units + 3 + Math.round((1 - hardness) * 2);

  return {
    index: i,
    chapter,
    goal,
    need,
    band,
    seconds,
    casts,
    hardness,
    seed: 9173 + i * 137,
    hint: HINTS[goal],
  };
}

/** 关卡自带的确定性随机源(咬钩抽签用) */
export function levelRandom(level: FishingLevel, salt = 0): () => number {
  return mulberry32(level.seed + salt * 7919);
}

// ---------------------------------------------------------------------------
// 目标文案与结算
// ---------------------------------------------------------------------------

/** 目标的一句话描述 */
export function goalText(level: FishingLevel): string {
  if (level.goal === "count") return `钓够 ${level.need} 条鱼`;
  if (level.goal === "score") return `攒够 ${level.need} 分`;
  if (level.goal === "weight") return `钓够 ${level.need} 千克`;
  return `钓上 ${level.need} 种不一样的鱼`;
}

/** 鱼群带的一句话提示 */
export function bandText(level: FishingLevel): string {
  const l = LAYERS[layerAt(bandCenter(level.band))];
  return `${l.emoji} 今天鱼群在 ${level.band.from}–${level.band.to} 米(${l.name})`;
}

export interface CatchLog {
  /** 已经钓上来几条 */
  count: number;
  /** 累计分数 */
  score: number;
  /** 累计重量(千克) */
  weight: number;
  /** 钓到过的鱼种 */
  species: string[];
}

export function emptyLog(): CatchLog {
  return { count: 0, score: 0, weight: 0, species: [] };
}

/** 这一关的目标进度(0..1),HUD 的进度条直接用 */
export function goalRatio(level: FishingLevel, log: CatchLog): number {
  const got = goalValue(level, log);
  return clamp(level.need > 0 ? got / level.need : 1, 0, 1);
}

/** 当前目标已经达成的数值 */
export function goalValue(level: FishingLevel, log: CatchLog): number {
  if (level.goal === "count") return log.count;
  if (level.goal === "score") return log.score;
  if (level.goal === "weight") return round1(log.weight);
  return new Set(log.species).size;
}

export function goalMet(level: FishingLevel, log: CatchLog): boolean {
  // 千克目标用一位小数比,避免 2.999999 这种浮点尾巴卡住玩家
  const got = level.goal === "weight" ? round1(goalValue(level, log)) : goalValue(level, log);
  return got >= level.need;
}

/** HUD 上的「3 / 5 条」这类文字 */
export function progressText(level: FishingLevel, log: CatchLog): string {
  const got = goalValue(level, log);
  if (level.goal === "count") return `${got} / ${level.need} 条`;
  if (level.goal === "score") return `${got} / ${level.need} 分`;
  if (level.goal === "weight") return `${got.toFixed(1)} / ${level.need.toFixed(1)} 千克`;
  return `${got} / ${level.need} 种`;
}

export interface LevelResult {
  /** 结算时还剩多少秒 */
  secondsLeft: number;
  /** 断线 + 跑鱼的次数 */
  lost: number;
  /** 还剩几竿没抛 */
  castsLeft: number;
}

/**
 * 评星:又快又稳三星,慢一点或者丢过鱼两星,压着线过关一星。
 * 只看「剩多少时间」和「丢了几条」,不看运气好不好碰上大鱼。
 */
export function rateLevel(level: FishingLevel, res: LevelResult): 1 | 2 | 3 {
  const ratio = level.seconds > 0 ? clamp(res.secondsLeft / level.seconds, 0, 1) : 0;
  if (ratio >= 0.35 && res.lost === 0) return 3;
  if (ratio >= 0.2 || res.lost <= 1) return 2;
  return 1;
}

/** 没过关时的一句温柔话 */
export function loseLine(reason: "time" | "casts"): string {
  return reason === "time"
    ? "时间到啦。下次抛竿别犹豫,力度条走到鱼群带那一格就松手。"
    : "鱼竿累啦。断线和跑鱼都会白费一竿,稳一点比快一点更省竿。";
}
