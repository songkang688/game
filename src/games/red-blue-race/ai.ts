/**
 * 红蓝赛跑 · 1.2 小电脑四档(纯函数,不碰 DOM)。
 *
 * 四档不是「把速度乘个系数」,而是照人的样子建模:
 *  · **目标节奏** `tapsPerSec`:它心里想按多快。**一律不许超过 `HUMAN_TAP_CAP_HZ`**
 *    ——玩家做不到的频率,小电脑也不许用,这条有常量、有断言;
 *  · **稳定度** `steadiness`:低档踩不稳鼓点,拿不满交替节奏的稳定加成;
 *  · **失误率** `missRate` + **反应时间** `reactionMs`:遇到水坑与栏架有概率没跳过去,愣一下再继续。
 *
 * 于是「地狱」档赢在稳,不赢在开挂:一个能把 7 次/秒交替按稳的孩子,速度是压得过它的。
 */
import { TRACK_LEN, type Obstacle } from "./levels";
import { HUMAN_TAP_CAP_HZ, STEADY_FULL_TAPS, cadenceFactor, steadyFactor } from "./rhythm";

export type AiLevel = "rookie" | "normal" | "expert" | "hell";

/** 四档由弱到强的固定顺序(UI 与测试都按它遍历) */
export const AI_LEVELS: readonly AiLevel[] = ["rookie", "normal", "expert", "hell"];

export interface AiProfile {
  key: AiLevel;
  /** 档位名 */
  label: string;
  emoji: string;
  /** 目标节奏:每秒交替按几下(≤ HUMAN_TAP_CAP_HZ) */
  tapsPerSec: number;
  /** 节奏稳定度 0..1:能拿到多少交替节奏的稳定加成 */
  steadiness: number;
  /** 失误率 0..1:遇到一个机关没跳过去的概率 */
  missRate: number;
  /** 反应时间(毫秒):失误之后愣多久 */
  reactionMs: number;
  /** 选档界面上的一句话 */
  blurb: string;
}

/**
 * 四档的具体数值。挑档时给孩子看的是 `label` + `blurb`,
 * 措辞只描述对手,不评价玩家。
 */
export const AI_PROFILES: Record<AiLevel, AiProfile> = {
  rookie: {
    key: "rookie",
    label: "菜鸟",
    emoji: "🐣",
    tapsPerSec: 3,
    steadiness: 0.2,
    missRate: 0.34,
    reactionMs: 520,
    blurb: "刚学会交替跑,常常忘了跳"
  },
  normal: {
    key: "normal",
    label: "普通",
    emoji: "🙂",
    tapsPerSec: 4.3,
    steadiness: 0.5,
    missRate: 0.2,
    reactionMs: 380,
    blurb: "节奏还行,偶尔踩进水坑"
  },
  expert: {
    key: "expert",
    label: "高手",
    emoji: "😎",
    tapsPerSec: 5.4,
    steadiness: 0.8,
    missRate: 0.1,
    reactionMs: 260,
    blurb: "交替按得很稳,机关基本都跳得过"
  },
  hell: {
    key: "hell",
    label: "地狱",
    emoji: "🔥",
    tapsPerSec: 6.4,
    steadiness: 1,
    missRate: 0.04,
    reactionMs: 170,
    blurb: "节奏几乎不乱,但它按的频率你也按得出来"
  }
};

/** 取一档的档案(给了奇怪的值就当普通档) */
export function profileOf(level: AiLevel): AiProfile {
  return AI_PROFILES[level] ?? AI_PROFILES.normal;
}

/** 这一档两步之间隔多少毫秒 */
export function aiTapGapMs(level: AiLevel): number {
  return 1000 / profileOf(level).tapsPerSec;
}

/**
 * 这一档每秒推进多少格(不含失误,失误在跑的时候按 `missRate` 现掷)。
 * 和玩家走的是同一套交替节奏公式:节奏 × 步长 × 频率系数 × 稳定加成。
 */
export function aiPacePerSec(level: AiLevel, tapStep: number): number {
  const p = profileOf(level);
  const gap = 1000 / p.tapsPerSec;
  const steady = steadyFactor(STEADY_FULL_TAPS * p.steadiness);
  return p.tapsPerSec * tapStep * cadenceFactor(gap) * steady;
}

/** 这一次遇到机关会不会失误 */
export function aiMisses(level: AiLevel, rand: () => number): boolean {
  const r = rand();
  return (Number.isFinite(r) ? r : 1) < profileOf(level).missRate;
}

/** 失误一次要愣多久(秒) */
export function aiStumbleSec(level: AiLevel): number {
  return profileOf(level).reactionMs / 1000 + 0.35;
}

export interface AiLaneResult {
  /** 跑完全程用了多少秒 */
  finishSec: number;
  /** 一共失误几次 */
  misses: number;
}

/**
 * 无头跑一整条道:按目标节奏匀速推进,每遇到一个水坑 / 栏架掷一次失误。
 * 给定同一个 `rand` 结果完全确定,四档强度单调就靠它写断言。
 */
export function runAiLane(
  level: AiLevel,
  tapStep: number,
  obstacles: readonly Obstacle[],
  rand: () => number,
  trackLen: number = TRACK_LEN
): AiLaneResult {
  const pace = aiPacePerSec(level, tapStep);
  let misses = 0;
  let sec = pace > 0 ? trackLen / pace : Infinity;
  for (const ob of obstacles) {
    if (ob.type !== "puddle" && ob.type !== "hurdle") continue;
    if (aiMisses(level, rand)) {
      misses++;
      sec += aiStumbleSec(level);
    }
  }
  return { finishSec: sec, misses };
}

/** 四档的目标节奏是不是全都在人能按出来的范围内(测试与运行时自检共用) */
export function respectsHumanCap(): boolean {
  return AI_LEVELS.every((lv) => AI_PROFILES[lv].tapsPerSec <= HUMAN_TAP_CAP_HZ);
}

/** 选档按钮上的文字 */
export function aiButtonLabel(level: AiLevel): string {
  const p = profileOf(level);
  return `${p.emoji} ${p.label}`;
}
