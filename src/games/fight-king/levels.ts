/**
 * 朵星格斗王 —— 格斗塔 188 关配表（确定性，同一关每次遇到的对手完全一样）。
 *
 * 八个章节、八种场地，每章最后一关是本章的守擂者（Boss）。
 * 越往上走三件事同时变：对手 AI 档位更高、元气与威力的增益更厚、回合时限更紧。
 * 这里只出数据，不画一个像素。
 */
import { TOTAL_LEVELS, type Chapter } from "../level99";
import { CHARACTERS } from "./frames";
import type { FighterBuff } from "./engine";
import type { AiLevel } from "./ai";

export const CHAPTERS: Chapter[] = [
  { name: "樱花道场", emoji: "🌸", color: "#ffd9e6", desc: "先把轻击重击和格挡练顺，这里的对手都很客气", size: 24 },
  { name: "星光广场", emoji: "⭐", color: "#d8e6ff", desc: "对手开始会跳了，学着用对空招把他们打下来", size: 24 },
  { name: "糯米集市", emoji: "🍡", color: "#ffe9cf", desc: "扫堂腿登场：站着挡是挡不住下段的", size: 24 },
  { name: "云端回廊", emoji: "☁️", color: "#e4ecff", desc: "长手对手够得远，得会找机会贴上去", size: 24 },
  { name: "竹林擂台", emoji: "🎋", color: "#d9f2d0", desc: "对手学会跳进来压，也学会了转圈摔", size: 23 },
  { name: "闪电高台", emoji: "⚡", color: "#fff2c2", desc: "对手开始防反：挡住你就立刻回敬一下", size: 23 },
  { name: "豆田操场", emoji: "🌱", color: "#e2f6cf", desc: "防反打得更准了，倒地记得按轻击受身", size: 23 },
  { name: "云顶王座", emoji: "👑", color: "#ffe6f2", desc: "最后一层：反应最快的高手，不过它每隔一会儿也要喘口气", size: 23 }
];

/** 每章的场地底色（渲染背景用，和章节色分开，画面更有层次） */
export const STAGE_SKY: string[] = [
  "#ffeef5",
  "#e9f1ff",
  "#fff4e6",
  "#f0f4ff",
  "#eafbe6",
  "#fffae0",
  "#f2fce6",
  "#fceaf6"
];

export interface TowerStage {
  /** 0 基关号 */
  level: number;
  chapterIndex: number;
  /** 对手角色 id */
  foeId: string;
  aiLevel: AiLevel;
  /** 对手的增益 */
  foeBuff: FighterBuff;
  /** 本章守擂者 */
  boss: boolean;
  /** 本关要赢几个回合（后期章节升到 2） */
  roundsToWin: number;
  /** 回合时限（秒） */
  timeLimitSec: number;
  /** 关卡一句话提示 */
  hint: string;
}

/** 章节起始关（0 基） */
export function chapterStartLevel(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci && i < CHAPTERS.length; i++) acc += CHAPTERS[i].size;
  return acc;
}

/** 关号（0 基）属于第几章 */
export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

/** 这一关是不是本章守擂者（每章最后一关） */
export function isBossLevel(level: number): boolean {
  const ci = chapterIndexOf(level);
  return level === chapterStartLevel(ci) + CHAPTERS[ci].size - 1;
}

/** 难度进度 0..1，纯粹按关号线性推进 */
export function progressOf(level: number): number {
  const clamped = Math.max(0, Math.min(TOTAL_LEVELS - 1, level));
  return TOTAL_LEVELS > 1 ? clamped / (TOTAL_LEVELS - 1) : 0;
}

/** 每一章的对手 AI 档位（0 轻松 / 1 普通 / 2 灵巧 / 3 老练 / 4 高手） */
const CHAPTER_AI: AiLevel[] = [0, 0, 1, 1, 2, 3, 3, 4];

/** 最高档 */
const AI_TOP: AiLevel = 4;

/**
 * 对手 AI 档位：一章一档往上走，守擂者再升一档（封顶在最高档）。
 * 后段的难度主要靠**新的 AI 行为**（会跳会投 → 会防反 → 高手）撑起来，
 * 而不是一味把元气和威力堆厚 —— 堆数值只会让孩子觉得"打不动"，
 * 换行为才会让他觉得"这家伙学乖了"。
 */
export function aiLevelOf(level: number): AiLevel {
  const ci = chapterIndexOf(level);
  const base = CHAPTER_AI[ci] ?? AI_TOP;
  if (isBossLevel(level)) return Math.min(AI_TOP, base + 1) as AiLevel;
  return base;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 对手增益：随关号平滑上涨，守擂者再多一点厚度。
 * 涨幅刻意做得比 1.1 收敛（元气 +0.52 而不是 +0.62，威力 +0.48 而不是 +0.58）——
 * 差出来的那一截交给 AI 档位去补，后段的对手是"更会打"，不是"更耐打"。
 */
export function foeBuffOf(level: number): FighterBuff {
  const p = progressOf(level);
  const boss = isBossLevel(level);
  return {
    vigorMul: round2(0.72 + p * 0.52 + (boss ? 0.1 : 0)),
    powerMul: round2(0.66 + p * 0.48 + (boss ? 0.07 : 0)),
    speedMul: round2(0.86 + p * 0.24 + (boss ? 0.04 : 0))
  };
}

/** 守擂者按章节固定：第 n 章的守擂者就是第 n 位小伙伴 */
export function bossIdOf(chapterIndex: number): string {
  return CHARACTERS[chapterIndex % CHARACTERS.length].id;
}

/** 普通关的对手：按关号错开轮转，同一章里不会连着三关都是同一个人 */
export function foeIdOf(level: number): string {
  if (isBossLevel(level)) return bossIdOf(chapterIndexOf(level));
  const ci = chapterIndexOf(level);
  const idx = level - chapterStartLevel(ci);
  return CHARACTERS[(idx * 3 + ci * 5 + 1) % CHARACTERS.length].id;
}

const HINTS = [
  "先看清对手的起手，再决定是挡还是打。",
  "轻击接重击再接必杀，一条连段就成型了。",
  "扫堂腿是下段，要蹲着才挡得住。",
  "跳跃攻击是上段，得站着挡。",
  "被挡住不要紧，收招小的招挡了也不亏。",
  "转圈摔挡不住，但对手在硬直里就抓不到。",
  "能量满了别憋着，超必杀是翻盘的机会。",
  "倒地那一下按轻击可以受身，快点爬起来。"
];

/** 取某一关的完整配置 */
export function towerStage(level: number): TowerStage {
  const lv = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(level)));
  const ci = chapterIndexOf(lv);
  const boss = isBossLevel(lv);
  return {
    level: lv,
    chapterIndex: ci,
    foeId: foeIdOf(lv),
    aiLevel: aiLevelOf(lv),
    foeBuff: foeBuffOf(lv),
    boss,
    roundsToWin: ci >= 5 ? 2 : 1,
    timeLimitSec: boss ? 90 : 75,
    hint: boss ? `${CHAPTERS[ci].name}的守擂者在等你，稳住节奏别急。` : HINTS[lv % HINTS.length]
  };
}

/** 难度分（单调不降，测试用它验证"越往后越难"） */
export function difficultyScore(level: number): number {
  const s = towerStage(level);
  return round2(s.aiLevel * 2 + s.foeBuff.vigorMul + s.foeBuff.powerMul + s.foeBuff.speedMul);
}

// ---------------------------------------------------------------------------
// 无尽：连胜挑战
// ---------------------------------------------------------------------------

/** 无尽第 streak 场（0 基）的对手 */
export function endlessFoeId(streak: number): string {
  const i = Math.max(0, Math.round(streak));
  return CHARACTERS[(i * 5 + 2) % CHARACTERS.length].id;
}

/** 无尽第 streak 场的 AI 档：连胜越多档位越高，五档一路走到顶 */
export function endlessAiLevel(streak: number): AiLevel {
  if (streak < 2) return 0;
  if (streak < 5) return 1;
  if (streak < 9) return 2;
  if (streak < 14) return 3;
  return 4;
}

/** 无尽第 streak 场对手的增益：一直涨，但有封顶，不会变成打不过 */
export function endlessBuff(streak: number): FighterBuff {
  const i = Math.max(0, Math.round(streak));
  return {
    vigorMul: round2(Math.min(1.6, 0.8 + i * 0.055)),
    powerMul: round2(Math.min(1.45, 0.7 + i * 0.05)),
    speedMul: round2(Math.min(1.25, 0.9 + i * 0.025))
  };
}

/** 连胜结束时的鼓励语（温柔收尾，不写任何失败羞辱） */
export function endlessEndText(streak: number): string {
  if (streak <= 0) return "第一场就遇到了硬对手，歇口气再来一次！";
  if (streak < 3) return `连赢 ${streak} 场，手感在回来了！`;
  if (streak < 6) return `连赢 ${streak} 场，很稳！下次试试多用连段。`;
  if (streak < 10) return `连赢 ${streak} 场，你已经是道场里的常胜将军啦！`;
  return `连赢 ${streak} 场，这个纪录够吹一整年了！`;
}

/** 无尽的连胜奖励星星（少量，避免刷分） */
export function endlessStarReward(streak: number): number {
  if (streak <= 0) return 0;
  if (streak < 3) return 1;
  if (streak < 6) return 2;
  return 3;
}
