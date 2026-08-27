/**
 * 跳跳台 · 幽灵对手。
 *
 * 做法就两步:先把这条台序的**理想力度序列**录下来(每一跳正好踩中台心需要多大力),
 * 再按档位往上加一层噪声重放。档位只改噪声幅度,不改任何别的能力 ——
 * 所以「大师几乎跳跳完美、新手经常掉下去」是同一套手感自然长出来的差距,不是硬调分数。
 *
 * 噪声之外还有一层**故意打偏**(`TIER_SLIP_EVERY`):每隔几跳往台沿方向偏一点,
 * 落在完美圈外、台面内 —— 只掉分、不掉下去。没有这一层的话,高手(±5%)与大师(±1.5%)
 * 的误差整个都落在完美圈里,两档逐局同分,选哪一档都一样(第 2 轮 R2B-2)。
 *
 * 屏幕上的四个字是 `TIER_NAMES`,存档与配表用的一直是 `AiTier` 的 id
 * (`rookie` / `normal` / `expert` / `hell`),两者分开,改字不动存档。
 */
import { mulberry32 } from "../level99";
import { DIST_SPAN, clamp01, flightTime, landPoint, yawTo } from "./physics";
import { padTick, perfectRadius, type Difficulty } from "./pads";
import { createRun, currentPad, hop, requiredPower, targetPadDef, type RunState } from "./run";

export type AiTier = "rookie" | "normal" | "expert" | "hell";

export const AI_TIERS: readonly AiTier[] = ["rookie", "normal", "expert", "hell"];

export const TIER_NAMES: Record<AiTier, string> = {
  rookie: "新手",
  normal: "普通",
  expert: "高手",
  hell: "大师",
};

/** 各档的力度误差幅度(相对理想力度的百分比) */
export const TIER_NOISE: Record<AiTier, number> = {
  rookie: 0.25,
  normal: 0.12,
  expert: 0.05,
  hell: 0.015,
};

/**
 * 每隔这么多跳故意打偏一次(0 = 一次都不偏)。
 * 大师一次都不偏,所以「跳跳完美」这句话仍旧成立;前三档偏得越勤,分越低。
 */
export const TIER_SLIP_EVERY: Record<AiTier, number> = {
  rookie: 3,
  normal: 5,
  expert: 9,
  hell: 0,
};

/** 故意打偏时,落点摆在「完美圈边 → 台沿」这段路的百分之多少处 */
export const SLIP_AT = 0.45;

/** 台沿到完美圈之间至少要有这么多余量,挤不出来就老老实实打准 */
export const SLIP_MIN_ROOM = 6;

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
 * 把这一跳的力度往外挪一点,让落点落在完美圈外、台面内 —— 掉分不掉人。
 *
 * 不能拍一个固定的偏移量了事:台子有大有小、移动台还在滑,力度一改飞行时长跟着改、
 * 台子又滑到别处去了。所以直接量「这个力度落下去离台心多远」,再二分到想要的那个距离上;
 * 二分出来的解要是不满足「出了完美圈又没出台面」,就当没偏过,原样打准。
 */
export function slipPower(run: RunState, base: number): number {
  const def = targetPadDef(run);
  if (!def) return base;
  const from = currentPad(run);
  const yaw = yawTo(from, padTick(def, run.time));
  const probe = (p: number): { d: number; r: number; pr: number } => {
    const pad = padTick(def, run.time + flightTime(p));
    const pt = landPoint(from, p, yaw);
    return { d: Math.hypot(pt.x - pad.x, pt.z - pad.z), r: pad.r, pr: perfectRadius(pad) };
  };
  const at0 = probe(base);
  const room = at0.r - at0.pr;
  if (room < SLIP_MIN_ROOM) return base;
  const want = at0.pr + room * SLIP_AT;
  // 噪声已经把它推出完美圈了,不用再补一刀
  if (at0.d >= want) return base;
  let lo = base;
  let hi = clamp01(base + (want + at0.d) / DIST_SPAN + 0.02);
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (probe(mid).d < want) lo = mid;
    else hi = mid;
  }
  const p = (lo + hi) / 2;
  const fin = probe(p);
  return fin.d > fin.pr && fin.d <= fin.r * 0.92 ? p : base;
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
 *
 * `hops` 是**站满多少座**,和玩家那边 `run.hops >= goal` 收工是同一把尺
 * (第 2 轮 R2B-2:以前这里数的是「起跳多少次」,弹簧台白送的台数只算给幽灵,
 * 于是满分玩家在同一条台序上天生少站好几座、少拿几十到一百分)。
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
  const every = TIER_SLIP_EVERY[tier] ?? 0;
  let fell = false;
  let shots = 0;
  while (run.hops < hops) {
    let p = ghostPower(requiredPower(run), tier, rand);
    shots += 1;
    if (every > 0 && shots % every === 0) p = slipPower(run, p);
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
