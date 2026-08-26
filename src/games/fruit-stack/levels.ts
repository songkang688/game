/**
 * 果果合成 · 188 关战役切分（8 章）与关卡目标。
 */
import { assertTotal, type Chapter } from "../level99";
import { MAX_LEVEL } from "./merge";

export const CHAPTERS: Chapter[] = [
  { name: "小籽", emoji: "🫘", color: "#E8F5DC", desc: "只出前三级，先合出一颗桃。", size: 24 },
  { name: "浆果盆", emoji: "🍓", color: "#FFE3EA", desc: "前五级都会出现，学着分区放。", size: 24 },
  { name: "警戒线", emoji: "🚧", color: "#FFEBCC", desc: "警戒线往下压，容错变小。", size: 24 },
  { name: "连锁课", emoji: "⛓️", color: "#DDEEFF", desc: "一次连锁三段以上才算漂亮。", size: 24 },
  { name: "窄瓶", emoji: "🫙", color: "#E4F3EC", desc: "容器变窄，落点要更准。", size: 22 },
  { name: "弹力果", emoji: "🏀", color: "#F0E6FF", desc: "弹性变大，果子会蹦。", size: 22 },
  { name: "对盆教学", emoji: "🤝", color: "#FFE0F2", desc: "分屏对战教学，抢先合成目标。", size: 24 },
  { name: "团圆杯", emoji: "🍉", color: "#DCF3D8", desc: "目标是合出团圆瓜。", size: 24 },
];

export const TOTAL = 188;

export function chaptersValid(): boolean {
  return assertTotal(CHAPTERS, TOTAL, "fruit-stack");
}

export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

export interface LevelPlan {
  level: number;
  chapter: number;
  /** 容器宽度（像素） */
  width: number;
  height: number;
  /** 警戒线离容器顶部多少像素 */
  lineFromTop: number;
  /** 投放序列里最高会出到几级 */
  maxSpawn: number;
  /** 目标：合成出这一级 */
  targetLevel: number;
  /** 目标：达到这个分数（0 表示不看分数） */
  targetScore: number;
  /** 一次连锁至少要这么多段（0 表示不要求） */
  minChain: number;
  restitution: number;
  /** 可以投放的果子总数 */
  drops: number;
  /** 分屏对战教学 */
  duel: boolean;
  seed: number;
}

export function planFor(level: number): LevelPlan {
  const lv = Math.max(0, Math.min(TOTAL - 1, Math.round(level)));
  const chapter = chapterIndexOf(lv);
  let acc = 0;
  for (let i = 0; i < chapter; i++) acc += CHAPTERS[i].size;
  const k = lv - acc;
  const size = CHAPTERS[chapter].size;
  const ramp = size <= 1 ? 0 : k / (size - 1);

  const width = chapter === 4 ? 250 - Math.round(ramp * 40) : 320;
  const lineFromTop = chapter >= 2 ? 60 + Math.round(ramp * 50) : 48;
  const maxSpawn = chapter === 0 ? 2 : chapter === 1 ? 4 : Math.min(5, 2 + Math.floor(chapter / 2));
  const targetLevel =
    chapter === 0 ? 3 : chapter === 7 ? MAX_LEVEL : Math.min(MAX_LEVEL - 1, 4 + Math.floor(chapter * 0.8 + ramp * 1.4));
  const targetScore = chapter >= 2 ? 120 + chapter * 60 + Math.round(ramp * 120) : 0;

  return {
    level: lv,
    chapter,
    width,
    height: 440,
    lineFromTop,
    maxSpawn,
    targetLevel,
    targetScore,
    minChain: chapter === 3 ? 3 : 0,
    restitution: chapter === 5 ? 0.35 + ramp * 0.2 : 0.22,
    drops: 40 + chapter * 6 + Math.round(ramp * 10),
    duel: chapter === 6,
    seed: 3000 + lv * 53,
  };
}

/** 无尽模式：容器固定，投放序列一直往下走 */
export function endlessPlan(): LevelPlan {
  return {
    level: -1,
    chapter: -1,
    width: 320,
    height: 460,
    lineFromTop: 56,
    maxSpawn: 4,
    targetLevel: MAX_LEVEL,
    targetScore: 0,
    minChain: 0,
    restitution: 0.24,
    drops: Number.MAX_SAFE_INTEGER,
    duel: false,
    seed: 987,
  };
}

/** 三星门槛：用掉的投放数越少越好 */
export function rateLevel(used: number, allowance: number): 1 | 2 | 3 {
  if (used <= allowance * 0.55) return 3;
  if (used <= allowance * 0.8) return 2;
  return 1;
}

/** 关卡目标的一句话说明 */
export function goalText(plan: LevelPlan): string {
  const parts: string[] = [];
  parts.push(`合出「${["籽", "莓", "柑", "桃", "梨", "苹", "橙", "柚", "瓜", "玉瓜", "团圆瓜"][plan.targetLevel]}」`);
  if (plan.targetScore > 0) parts.push(`拿到 ${plan.targetScore} 分`);
  if (plan.minChain > 0) parts.push(`打出 ${plan.minChain} 段连锁`);
  return parts.join(" · ");
}
