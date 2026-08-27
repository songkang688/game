/**
 * 数独花田 · 竞速假人。
 *
 * 假人不是「作弊直接抄答案」:它按出题时记下来的**最小技巧路径**一步一步填,
 * 每一步之间歇一会儿,档位越高歇得越短、失误越少。所以你能看懂它在干什么,
 * 也追得上它 —— 输了也只是慢了半步,不是被机器碾过去。
 *
 * 全程本机模拟,不联网、不开 socket。
 */
import { EMPTY, isValidPlacement, maskToDigits, type SudokuBoard } from "./solver";
import {
  TECHNIQUE_ORDER,
  candidateGrid,
  findHiddenSingle,
  findNakedSingle,
  findNakedPair,
  findPointingPair,
  type TechniqueKind
} from "./techniques";

export type AiTier = "rookie" | "normal" | "pro" | "hell";

export const AI_TIERS: readonly AiTier[] = ["rookie", "normal", "pro", "hell"];

export const AI_TIER_LABELS: Record<AiTier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  pro: "高手",
  hell: "地狱"
};

export const AI_TIER_BLURBS: Record<AiTier, string> = {
  rookie: "想得很慢,还时不时种错一朵。",
  normal: "不快不慢,偶尔看走眼。",
  pro: "手很稳,基本不会种错。",
  hell: "又快又准,一朵都不会种错。"
};

export interface AiProfile {
  tier: AiTier;
  /** 两步之间歇多久(毫秒) */
  stepMs: number;
  /** 失误率:这么大的概率会先填一个错的,下一步再改回来 */
  missRate: number;
}

/** 四档假人的参数(规格:菜鸟 3s 会填错,普通 1.5s,高手 0.8s,地狱 0.4s 不失误) */
export const AI_PROFILES: Record<AiTier, AiProfile> = {
  rookie: { tier: "rookie", stepMs: 3000, missRate: 0.25 },
  normal: { tier: "normal", stepMs: 1500, missRate: 0.12 },
  pro: { tier: "pro", stepMs: 800, missRate: 0.04 },
  hell: { tier: "hell", stepMs: 400, missRate: 0 }
};

export function profileOf(tier: AiTier): AiProfile {
  return AI_PROFILES[tier] ?? AI_PROFILES.normal;
}

export interface AiMove {
  idx: number;
  digit: number;
  /** 这一步是靠哪一招想出来的 */
  by: TechniqueKind;
  /** 这一步是故意填错的(档位失误) */
  slip: boolean;
}

/**
 * 假人的下一步:按技巧从易到难找一个能填的格子。
 *
 * 数对与区块摒除**只划候选、不落子**,而且常常要连划好几轮才逼得出一个独苗,
 * 所以这里是个循环:划一轮就重找一次唯余 / 隐性唯一,直到有格子能填或者再也划不动。
 * 四招都使不上(题库保证不会)才退化成「挑候选最少的格子填一个合规矩的」。
 */
export function nextMove(board: SudokuBoard, roll = 1, profile: AiProfile = AI_PROFILES.normal): AiMove | null {
  if (board.cells.every((v) => v > EMPTY)) return null;
  const grid = candidateGrid(board);

  let idx = -1;
  let digit = 0;
  let by: TechniqueKind = "nakedSingle";
  // 这一手是被哪一档技巧逼出来的:划过候选就记下最深的那一档
  let deepest: TechniqueKind | null = null;

  for (let round = 0; round < 80 && idx < 0; round++) {
    const naked = findNakedSingle(board, grid);
    if (naked) {
      idx = naked.idx;
      digit = naked.digit;
      by = deepest ?? "nakedSingle";
      break;
    }
    const hidden = findHiddenSingle(board, grid);
    if (hidden) {
      idx = hidden.idx;
      digit = hidden.digit;
      by = deepest ?? "hiddenSingle";
      break;
    }
    const pair = findNakedPair(board, grid) ?? findPointingPair(board, grid);
    if (!pair) break;
    for (const s of pair.strikes) grid[s.idx] &= ~s.mask;
    if (!deepest || TECHNIQUE_ORDER.indexOf(pair.kind) > TECHNIQUE_ORDER.indexOf(deepest)) deepest = pair.kind;
  }

  if (idx < 0) {
    // 兜底:候选最少的空格里随便挑一个合法数字,保证假人不会卡死不动
    let best = -1;
    let bestCount = 99;
    for (let i = 0; i < board.cells.length; i++) {
      if (board.cells[i] > EMPTY) continue;
      const c = maskToDigits(grid[i]).length;
      if (c > 0 && c < bestCount) {
        bestCount = c;
        best = i;
      }
    }
    if (best < 0) return null;
    idx = best;
    digit = maskToDigits(grid[best])[0];
    by = "nakedSingle";
  }

  // 档位失误:先种错一朵,下一步自己发现再改回来。
  // 优先挑一个「看着也说得通」的数字(不跟已有的撞),实在没有就随便挑一个别的,
  // 那一格会亮成冲突色 —— 和小朋友手快点错是一个样子。
  if (profile.missRate > 0 && roll < profile.missRate) {
    const n = board.variant.n;
    const all: number[] = [];
    for (let d = 1; d <= n; d++) {
      if (d !== digit) all.push(d);
    }
    const plausible = all.filter((d) => isValidPlacement(board, idx, d));
    const pool = plausible.length > 0 ? plausible : all;
    if (pool.length > 0) {
      return { idx, digit: pool[Math.floor(roll * 997) % pool.length], by, slip: true };
    }
  }
  return { idx, digit, by, slip: false };
}

/** 档位越高,平均每题用的时间越短(单测靠它卡「强弱单调」) */
export function estimateMs(tier: AiTier, holes: number): number {
  const p = profileOf(tier);
  return Math.round(holes * p.stepMs * (1 + p.missRate));
}

/** 四档从弱到强的排序号 */
export function tierStrength(tier: AiTier): number {
  return AI_TIERS.indexOf(tier);
}

/** 假人用到过的技巧在四档里排第几(展示用) */
export function moveTierRank(move: AiMove): number {
  return TECHNIQUE_ORDER.indexOf(move.by);
}
