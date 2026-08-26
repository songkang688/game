/**
 * 跳跳台 · 幽灵对手。
 *
 * 做法就两步:先把这条台序的**理想力度序列**录下来(每一跳正好踩中台心需要多大力),
 * 再按档位往上加一层噪声重放。档位只改噪声幅度,不改任何别的能力 ——
 * 所以「地狱几乎跳跳完美、菜鸟经常掉下去」是同一套手感自然长出来的差距,不是硬调分数。
 */
import { mulberry32 } from "../level99";
import { clamp01 } from "./physics";
import type { Difficulty } from "./pads";
import { createRun, hop, requiredPower, type RunState } from "./run";

export type AiTier = "rookie" | "normal" | "expert" | "hell";

export const AI_TIERS: readonly AiTier[] = ["rookie", "normal", "expert", "hell"];

export const TIER_NAMES: Record<AiTier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  expert: "高手",
  hell: "地狱",
};

/** 各档的力度误差幅度(相对理想力度的百分比) */
export const TIER_NOISE: Record<AiTier, number> = {
  rookie: 0.25,
  normal: 0.12,
  expert: 0.05,
  hell: 0.015,
};

/** 幽灵头像,原创角色 */
export const TIER_FACES: Record<AiTier, string> = {
  rookie: "🐰",
  normal: "🐼",
  expert: "🦊",
  hell: "🐯",
};

/** 理想力度 + 档位噪声 = 幽灵这一跳真正用的力度 */
export function ghostPower(ideal: number, tier: AiTier, rand: () => number): number {
  const n = TIER_NOISE[tier] ?? TIER_NOISE.normal;
  return clamp01(ideal * (1 + n * (rand() * 2 - 1)));
}

/**
 * 录一条理想力度序列:一路踩中台心地跳下去,把每一跳需要的力度记下来。
 * 这就是「录制」那一步,重放时只往上叠噪声。
 */
export function recordPowers(seed: number, difficulty: Difficulty, hops: number): number[] {
  let run = createRun(seed, difficulty);
  const out: number[] = [];
  for (let i = 0; i < hops && run.alive; i++) {
    const p = requiredPower(run);
    out.push(p);
    run = hop(run, p).state;
  }
  return out;
}

export interface GhostRun {
  tier: AiTier;
  score: number;
  /** 站住了几座 */
  cleared: number;
  perfects: number;
  bestCombo: number;
  /** 掉下去了没有 */
  fell: boolean;
  /** 真正用出去的力度序列(重放动画用) */
  powers: number[];
}

/**
 * 让某一档幽灵把这条台序跑一遍。
 * 幽灵掉下去就停手 —— 和玩家一个规矩,不给复活。
 */
export function playGhost(
  seed: number,
  difficulty: Difficulty,
  tier: AiTier,
  hops: number,
  noiseSeed = seed ^ 0x5a17
): GhostRun {
  const rand = mulberry32(noiseSeed >>> 0);
  let run: RunState = createRun(seed, difficulty);
  const powers: number[] = [];
  let fell = false;
  for (let i = 0; i < hops; i++) {
    const p = ghostPower(requiredPower(run), tier, rand);
    powers.push(p);
    const step = hop(run, p);
    run = step.state;
    if (!run.alive) {
      fell = true;
      break;
    }
  }
  return {
    tier,
    score: run.score,
    cleared: run.hops,
    perfects: run.perfects,
    bestCombo: run.bestCombo,
    fell,
    powers,
  };
}

/** 幽灵会说的话,输赢都好好说 */
export function ghostLine(tier: AiTier, ghost: GhostRun, mine: number): string {
  const name = TIER_NAMES[tier];
  if (mine > ghost.score) return `你 ${mine} 分,${name}幽灵 ${ghost.score} 分 —— 这一局你赢了!`;
  if (mine === ghost.score) return `${mine} 比 ${ghost.score},和${name}幽灵打成平手,再来一局分高下。`;
  return `${name}幽灵这次拿了 ${ghost.score} 分,你 ${mine} 分。看它每次都往圆心里落,你也可以。`;
}
