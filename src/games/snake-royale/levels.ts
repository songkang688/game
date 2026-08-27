/**
 * 长蛇争霸 · 188 关战役配置(纯数据 + 纯函数)。
 * 八章把 IO 竞技的技术点一个一个拆开教:先练转向,再练加速取舍,
 * 再练拦头、抢掉落、绕圈、缩圈、迷雾,最后全套一起上。
 */
import { TOTAL_LEVELS, type Chapter } from "../level99";
import type { AiTier } from "./ai";

export const CHAPTERS: Chapter[] = [
  { name: "星光草地", emoji: "🌱", color: "#DFF5DC", desc: "场上只有星光豆,先把平滑转向练顺。", size: 24 },
  { name: "加速跑道", emoji: "💨", color: "#FDF3D2", desc: "加速能追上人,但要掉长度,自己算这笔账。", size: 24 },
  { name: "拦头课", emoji: "🎯", color: "#DCE9FB", desc: "绕到对手前面去,让它自己撞上你的身体。", size: 24 },
  { name: "光点争夺", emoji: "✨", color: "#FBE3EE", desc: "别人先去休息就会掉一串光点,谁快谁赚。", size: 24 },
  { name: "绕圈成环", emoji: "🔄", color: "#E9E1FB", desc: "一圈绕下来同时拦住两条,才算真本事。", size: 22 },
  { name: "缩圈原野", emoji: "🌀", color: "#D8EFF2", desc: "安全区一直在收,提前往圈里挪。", size: 22 },
  { name: "夜色迷雾", emoji: "🌙", color: "#DEDCF2", desc: "视野变小,靠小地图雷达找路。", size: 24 },
  { name: "长蛇杯", emoji: "🏆", color: "#F7DDE8", desc: "全部机制一起上,对手又多又刁。", size: 24 }
];

/** 每一关要达成什么 */
export type GoalKind = "length" | "rank" | "intercept" | "survive";

export interface SnakeLevel {
  /** 0 基关号 */
  level: number;
  /** 圆形地图半径 */
  mapR: number;
  /** 场上星光豆数量 */
  food: number;
  /** 本机 AI 对手数量 */
  bots: number;
  botTier: AiTier;
  goal: GoalKind;
  /** 目标长度(goal = length 时看这个) */
  targetLen: number;
  /** 目标名次(goal = rank 时看这个) */
  targetRank: number;
  /** 要拦下几条(goal = intercept 时看这个) */
  targetStops: number;
  /** 限时(秒),0 表示不限时 */
  timeSec: number;
  /** 安全区收缩速度(像素/秒),0 表示不缩圈 */
  shrink: number;
  /** 视野是不是变窄了 */
  fog: boolean;
  /** AI 之间会不会互相拦 */
  botsFight: boolean;
}

/** 关号 → 章节下标 */
export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

const TIER_BY_CHAPTER: AiTier[] = ["rookie", "rookie", "normal", "normal", "pro", "pro", "pro", "hell"];
const GOAL_BY_CHAPTER: GoalKind[] = ["length", "length", "intercept", "length", "intercept", "survive", "rank", "rank"];

/** 每一关的配置:同一关每次进来都一样,难度沿关号平滑上升 */
export function levelConfig(level: number): SnakeLevel {
  const lv = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(Number.isFinite(level) ? level : 0)));
  const ci = chapterIndexOf(lv);
  const inCh = lv - CHAPTERS.slice(0, ci).reduce((s, c) => s + c.size, 0);
  const ramp = inCh / Math.max(1, CHAPTERS[ci].size - 1);

  const bots = Math.min(9, Math.max(1, Math.round(1 + ci * 0.95 + ramp * 1.4)));
  // 第 8 章尾巴上再硬一点,前面都按章走
  const tier: AiTier = ci === 7 && ramp > 0.5 ? "hell" : TIER_BY_CHAPTER[ci];
  const goal = GOAL_BY_CHAPTER[ci];

  return {
    level: lv,
    mapR: 900 + ci * 130 + Math.round(ramp * 140),
    food: 110 + ci * 16 + Math.round(ramp * 24),
    bots,
    botTier: tier,
    goal,
    targetLen: 40 + ci * 16 + Math.round(ramp * 22),
    targetRank: Math.max(1, 4 - Math.floor(ci / 3) - (ramp > 0.7 ? 1 : 0)),
    targetStops: goal === "intercept" ? (ci >= 4 ? 2 : 1) + (ramp > 0.65 ? 1 : 0) : 0,
    timeSec: 70 + ci * 7 + Math.round(ramp * 15),
    shrink: ci === 5 || ci === 7 ? 5 + ramp * 5 : 0,
    fog: ci === 6 || ci === 7,
    botsFight: ci >= 3
  };
}

/** 无尽模式第 n 波:缩圈更快、对手更多 */
/**
 * 无尽的收圈速度上限。
 *
 * 起圈半径是 `mapR * 0.96 = 1440`,`shrinkZone` 收到 180 就不再收,
 * 一共要收 1260。原先 `shrink = 3 + w * 1.3` 一路长下去,第 100 波
 * 9 秒就收到底 —— 那不是更难,是原野没了。封到 22.5 之后收圈窗口
 * 不会短过 56 秒,目标长度照旧一波一波往上加。
 *
 * 第 15 波开始才封得住(3 + 1.3×15 = 22.5),之前每一波的数字一个都没变。
 */
export const ENDLESS_MAX_SHRINK = 22.5;

/**
 * 无尽的食物数上限。同 `orb-arena`:食物吃掉立刻重生,供给本来就是无限的,
 * 这个数只决定同时铺多少颗,而每帧都要遍历一遍。第 20 波开始才封得住。
 */
export const ENDLESS_MAX_FOOD = 330;

export function endlessConfig(wave: number): SnakeLevel {
  const w = Math.max(1, Math.round(Number.isFinite(wave) ? wave : 1));
  return {
    level: -1,
    mapR: 1500,
    // 三个「越往后越大」的旋钮都有上限,理由见上面的常量注释
    food: Math.min(ENDLESS_MAX_FOOD, 170 + w * 8),
    bots: Math.min(9, 3 + Math.floor(w / 2)),
    botTier: w >= 9 ? "hell" : w >= 6 ? "pro" : w >= 3 ? "normal" : "rookie",
    goal: "survive",
    targetLen: 70 + w * 34,
    targetRank: 1,
    targetStops: 0,
    timeSec: 0,
    shrink: Math.min(ENDLESS_MAX_SHRINK, 3 + w * 1.3),
    fog: w >= 5,
    botsFight: true
  };
}

/** 三星:超额越多、用时越短,星越多 */
export function starsFor(finalLen: number, target: number, usedSec: number, limitSec: number): 1 | 2 | 3 {
  const len = Math.max(0, Number.isFinite(finalLen) ? finalLen : 0);
  const tgt = Math.max(1, Number.isFinite(target) ? target : 1);
  if (len < tgt) return 1;
  const spare = len / tgt;
  const timeLeft = limitSec > 0 ? 1 - usedSec / Math.max(1, limitSec) : 0.5;
  if (spare >= 1.35 && timeLeft >= 0.25) return 3;
  if (spare >= 1.12 || timeLeft >= 0.4) return 2;
  return 1;
}

/** 关卡目标写成一句话 */
export function goalLine(cfg: SnakeLevel): string {
  const parts: string[] = [];
  if (cfg.goal === "length") parts.push(`长到 ${cfg.targetLen} 长度`);
  else if (cfg.goal === "rank") parts.push(`冲进第 ${cfg.targetRank} 名`);
  else if (cfg.goal === "intercept") parts.push(`拦下 ${cfg.targetStops} 条长蛇`);
  else parts.push(`撑到最后 · 长度 ${cfg.targetLen}`);
  if (cfg.timeSec > 0) parts.push(`${cfg.timeSec} 秒内`);
  if (cfg.shrink > 0) parts.push("安全区在收");
  if (cfg.fog) parts.push("视野变窄");
  return parts.join(" · ");
}

/** 这一关算不算赢 */
export function levelWon(
  cfg: SnakeLevel,
  state: { alive: boolean; length: number; rank: number; stops: number }
): boolean {
  if (!state.alive) return false;
  switch (cfg.goal) {
    case "length":
      return state.length >= cfg.targetLen;
    case "rank":
      return state.rank > 0 && state.rank <= cfg.targetRank;
    case "intercept":
      return state.stops >= cfg.targetStops;
    default:
      return state.length >= cfg.targetLen;
  }
}

/** 用来算三星的那个「目标值」 */
export function goalTarget(cfg: SnakeLevel): number {
  return cfg.goal === "intercept" ? Math.max(1, cfg.targetStops) : cfg.targetLen;
}
