/**
 * 星星合成 · 188 关战役配置(纯数据 + 纯函数)。
 *
 * 八章把合成这件事一层一层加难度:先小数字,再一路把目标抬到 4096,
 * 中间穿插障碍花、换盘面尺寸、限步数,最后是合成杯的竞速。
 *
 * ## 为什么每一关都过得去
 *
 * 每关有固定 seed 和**固定开局**:开局沿盘面的蛇形顺序,在角上摆好一条
 * 从 `ladderFrom` 到 `target / 2` 的降序阶梯,末尾再放两个 2 起手。
 * 玩家只要把 `ladderFrom` 这一级再造出来一份,就能顺着阶梯一级一级合上去到目标。
 * 所以 `ladderFrom` 越大 = 要从 2 开始堆的量越多 = 越难,这是本作唯一的难度旋钮。
 *
 * 这套说法不是「我觉得能过」:`levels.test.ts` 用 `ai.ts` 的高手策略当固定策略,
 * 188 关一关一关真跑一遍,跑不到目标就红。
 */
import { TOTAL_LEVELS, type Chapter } from "../level99";
import {
  EMPTY,
  applyHazards,
  createBoard,
  hazardCells,
  snakeOrder,
  type Board
} from "./board";
import type { AiTier } from "./ai";

export const CHAPTERS: Chapter[] = [
  { name: "小数入门", emoji: "🌱", color: "#FFF3C8", desc: "两个一样的数字撞在一起就会变大,先合到 32 和 64。", size: 24 },
  { name: "一二八", emoji: "🍋", color: "#FDF0D5", desc: "目标抬到 128,学着把大数字都赶到一个角上。", size: 24 },
  { name: "五一二花园", emoji: "🌷", color: "#FBE6F1", desc: "目标 512,盘面开始挤了,每一步都要想想空格。", size: 24 },
  { name: "二千零四八", emoji: "🌟", color: "#E8E4FB", desc: "经典的 2048。角上那块不许动,其他的绕着它转。", size: 24 },
  { name: "障碍花", emoji: "🌺", color: "#FBE0DC", desc: "开着花的格子滑不进去,一行被它切成两段。", size: 22 },
  { name: "三乘三与五乘五", emoji: "🔳", color: "#DFF1F5", desc: "小盘面转不开身,大盘面装得多,手法要跟着换。", size: 22 },
  { name: "限步挑战", emoji: "⏳", color: "#E3F2DC", desc: "步数是有限的,每一步都得合得上算。", size: 24 },
  { name: "合成杯", emoji: "🏆", color: "#FDE7D6", desc: "4096 与竞速。学过的全用上,和假人比谁先到。", size: 24 }
];

export interface MergeLevel {
  /** 0 基关号 */
  level: number;
  chapter: number;
  /** 固定 seed:同一关每次的生成序列都一样 */
  seed: number;
  /** 盘面边长 */
  size: number;
  /** 要合出来的数字 */
  target: number;
  /** 开局阶梯有几级(从 target/2 往下减半) */
  rungs: number;
  /** 开局阶梯的最低一级 = target / 2^rungs */
  ladderFrom: number;
  /** 障碍花个数 */
  blocks: number;
  /** 步数上限;0 表示不限 */
  stepLimit: number;
  /** 竞速关:假人同时在旁边跑,它先到目标这一关就算没赢 */
  race: boolean;
  /** 竞速关的对手档位 */
  aiTier: AiTier;
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

function chapterStartOf(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return acc;
}

/** 阶梯最多能有几级:`target/2` 一路减半到 2 就到头了 */
export function maxRungs(target: number): number {
  return Math.max(1, Math.round(Math.log2(target / 2)));
}

/**
 * 盘面装得下几级阶梯。
 * 开局塞得太满是这类玩法最常见的死法:小数字没地方落,几步之后就推不动了。
 * 实测把开局占用压到四成五以内(再留两格给起手的 2),后面才腾挪得开。
 */
export function roomRungs(size: number, blocks: number): number {
  return Math.max(1, Math.floor((size * size - blocks) * 0.45) - 1);
}

const RACE_TIERS: AiTier[] = ["rookie", "normal", "pro", "hell"];

export function levelConfig(level: number): MergeLevel {
  const lv = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(Number.isFinite(level) ? level : 0)));
  const ci = chapterIndexOf(lv);
  const inCh = lv - chapterStartOf(ci);
  const span = Math.max(1, CHAPTERS[ci].size - 1);
  const ramp = inCh / span;
  const half = inCh * 2 >= CHAPTERS[ci].size;

  let size = 4;
  let target = 32;
  let blocks = 0;
  let race = false;
  let aiTier: AiTier = "normal";
  // 少给一级阶梯 = 要多堆一倍的小数字 = 更难。这是本作唯一的难度旋钮
  let cut = 0;

  switch (ci) {
    case 0:
      target = half ? 64 : 32;
      cut = Math.round(ramp * 2);
      break;
    case 1:
      target = 128;
      cut = Math.round(ramp * 3);
      break;
    case 2:
      target = 512;
      cut = Math.round(ramp * 3);
      break;
    case 3:
      target = 2048;
      cut = 1 + Math.round(ramp * 3);
      break;
    case 4:
      // 障碍花把盘面切碎,目标和花的朵数都得收着点,不然真会摆死
      target = half ? 512 : 128;
      blocks = 1 + (inCh % 2);
      cut = Math.round(ramp * 2);
      break;
    case 5:
      // 双数关三乘三、单数关五乘五,一小一大轮着来
      size = inCh % 2 === 0 ? 3 : 5;
      target = size === 3 ? (half ? 128 : 64) : half ? 1024 : 512;
      cut = size === 3 ? Math.round(ramp) : 1 + Math.round(ramp * 2);
      break;
    case 6:
      target = half ? 1024 : 256;
      cut = 2;
      break;
    default:
      // 合成杯:前半程 4×4 冲 2048,后半程搬到五乘五的大盘上冲 4096
      size = half ? 5 : 4;
      target = half ? 4096 : 2048;
      cut = half ? 3 + Math.round(ramp) : 2 + Math.round(ramp);
      race = inCh % 2 === 1;
      aiTier = RACE_TIERS[Math.min(RACE_TIERS.length - 1, Math.floor(ramp * RACE_TIERS.length))];
      break;
  }

  const rungs = Math.max(1, Math.min(maxRungs(target) - cut, roomRungs(size, blocks)));
  const cfg: MergeLevel = {
    level: lv,
    chapter: ci,
    seed: 20480 + lv * 137,
    size,
    target,
    rungs,
    ladderFrom: Math.max(2, target / 2 ** rungs),
    blocks,
    stepLimit: 0,
    race,
    aiTier
  };
  // 限步章才真的卡步数,别的章是走不动了才结束
  cfg.stepLimit = ci === 6 ? Math.round(stepBudget(cfg) * 0.7) : 0;
  return cfg;
}

/** 开局阶梯上有哪几级(从 target/2 往下减半,一共 rungs 级) */
export function ladderValues(cfg: Pick<MergeLevel, "target" | "rungs">): number[] {
  const out: number[] = [];
  let v = cfg.target / 2;
  for (let i = 0; i < cfg.rungs && v >= 2; i++, v /= 2) out.push(v);
  return out;
}

/**
 * 这一关给多少步才算宽裕。
 * 实测下来花掉的步数主要跟目标数字的大小走(盘上要堆出来的总量就那么多),
 * 阶梯给几级只影响开头几步,所以这里按 √target 估,再按盘面大小和障碍花微调。
 */
export function stepBudget(cfg: Pick<MergeLevel, "target" | "size" | "blocks">): number {
  const sizeFactor = cfg.size === 3 ? 0.8 : cfg.size === 5 ? 1.15 : 1;
  return Math.round((50 + 11 * Math.sqrt(cfg.target)) * sizeFactor) + cfg.blocks * 20;
}

/**
 * 这一关的固定开局:先钉障碍花,再沿蛇形顺序摆阶梯,末尾放两个 2 起手。
 * 同一关每次调用都摆出一模一样的盘面。
 */
export function startBoard(level: number): Board {
  const cfg = levelConfig(level);
  let board = createBoard(cfg.size);
  if (cfg.blocks > 0) {
    board = applyHazards(board, { blocks: hazardCells(cfg.size, cfg.blocks, cfg.seed) });
  }

  const order = snakeOrder(cfg.size);
  const free = order.filter(([r, c]) => board[r][c] === EMPTY);
  let k = 0;
  for (const v of ladderValues(cfg)) {
    if (k >= free.length - 2) break;
    const [r, c] = free[k];
    board[r][c] = v;
    k += 1;
  }
  // 蛇尾那两格放两个 2:一上来就有一步能合,不会让人对着一堆大数字发呆
  for (let i = free.length - 2; i < free.length; i++) {
    const [r, c] = free[i];
    if (board[r][c] === EMPTY) board[r][c] = 2;
  }
  return board;
}

/** 这一关的目标写成一句话 */
export function goalLine(cfg: MergeLevel): string {
  const parts = [`合成 ${cfg.target}`];
  if (cfg.size !== 4) parts.push(`${cfg.size}×${cfg.size} 盘面`);
  if (cfg.blocks > 0) parts.push(`${cfg.blocks} 朵障碍花`);
  if (cfg.stepLimit > 0) parts.push(`${cfg.stepLimit} 步以内`);
  if (cfg.race) parts.push("和假人比谁先到");
  return parts.join(" · ");
}

export interface MergeResult {
  /** 本局合出来的最大数字 */
  best: number;
  /** 用掉的步数 */
  steps: number;
  score: number;
  /** 四个方向都推不动了 */
  stuck: boolean;
  /** 竞速关:假人先到了目标 */
  foeReached?: boolean;
}

/** 这一关算不算过 */
export function levelWon(cfg: MergeLevel, got: MergeResult): boolean {
  if (got.best < cfg.target) return false;
  if (cfg.stepLimit > 0 && got.steps > cfg.stepLimit) return false;
  if (cfg.race && got.foeReached) return false;
  return true;
}

/**
 * 评星:达标就有一星,步数省下来加一星,超额合出更大的数字再加一星。
 * 也就是规格里说的 `starsFor(target, steps, score)` —— target 从 cfg 里取。
 */
export function starsFor(cfg: MergeLevel, got: MergeResult): 1 | 2 | 3 {
  if (got.best < cfg.target) return 1;
  const budget = cfg.stepLimit > 0 ? cfg.stepLimit : stepBudget(cfg);
  const thrifty = got.steps <= Math.round(budget * 0.6);
  const overshoot = got.best >= cfg.target * 2;
  if (thrifty && overshoot) return 3;
  if (thrifty || overshoot) return 2;
  return 1;
}

/** 结束时给一句只鼓励、不批评的话 */
export function overLine(cfg: MergeLevel, got: MergeResult): string {
  if (got.stuck) return `这盘叠到了 ${got.best},已经很棒了,下一盘换个方向试试。`;
  if (cfg.stepLimit > 0 && got.steps > cfg.stepLimit) {
    return `步数刚好用完,盘上最大的是 ${got.best}。少绕一点路就够啦。`;
  }
  if (got.foeReached) return `假人这次快了半步,你已经叠到 ${got.best} 了,再来一盘。`;
  return `这盘叠得很棒,下一盘换个方向试试。`;
}

// ---------------------------------------------------------------------------
// 无尽 · 马拉松
// ---------------------------------------------------------------------------

export type EndlessKind = "marathon" | "tiny";

export interface EndlessConfig {
  kind: EndlessKind;
  size: number;
  label: string;
  hint: string;
}

export function endlessConfig(kind: EndlessKind): EndlessConfig {
  return kind === "tiny"
    ? { kind, size: 3, label: "🔳 三乘三马拉松", hint: "小盘面转不开身,能撑多久就撑多久。" }
    : { kind, size: 4, label: "♾️ 马拉松", hint: "没有目标,记最高分和最大的那一块。" };
}

// ---------------------------------------------------------------------------
// 对战竞速
// ---------------------------------------------------------------------------

export interface VersusConfig {
  tier: AiTier;
  size: number;
  target: number;
}

/** 对战:两边用同一个 seed 的生成序列,比谁先合到目标 */
export function versusConfig(tier: AiTier, target = 512): VersusConfig {
  return { tier, size: 4, target };
}

/** 对战可选的目标数字 */
export const VERSUS_TARGETS: readonly number[] = [128, 512, 1024];
