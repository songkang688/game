// 海底大胃王 —— 纯逻辑函数,不依赖 DOM,方便单独测试。

export const START_RADIUS = 14;

/* ---------------- 海域分区与关卡 ---------------- */

export type ZoneId = "shallow" | "coral" | "deep";

export interface ZoneStyle {
  name: string;
  top: string;
  bottom: string;
  accent: string;
}

export const ZONE_STYLE: Record<ZoneId, ZoneStyle> = {
  shallow: { name: "浅浅海湾", top: "#c9edff", bottom: "#8fd0f0", accent: "#ffeeba" },
  coral: { name: "珊瑚花园", top: "#ffe3ee", bottom: "#c9b6f2", accent: "#ff9eb5" },
  deep: { name: "深深海沟", top: "#9fb8e8", bottom: "#6f86c8", accent: "#bfe9ff" },
};

export interface LevelDef {
  zone: ZoneId;
  name: string;
  /** 长到这个半径就算达成本关目标 */
  targetR: number;
  /** 同屏水母数量 */
  jellies: number;
  /** 是否出现鼓鼓鱼(河豚) */
  puffers: boolean;
  /** 大鱼出现概率加成 */
  bigFishBias: number;
  boss: boolean;
}

export const LEVELS: LevelDef[] = [
  { zone: "shallow", name: "浅浅海湾", targetR: 30, jellies: 0, puffers: false, bigFishBias: 0, boss: false },
  { zone: "coral", name: "珊瑚花园", targetR: 34, jellies: 0, puffers: true, bigFishBias: 0.04, boss: false },
  { zone: "deep", name: "深深海沟", targetR: 38, jellies: 2, puffers: false, bigFishBias: 0.08, boss: false },
  { zone: "deep", name: "暗流回廊", targetR: 42, jellies: 3, puffers: true, bigFishBias: 0.12, boss: false },
  { zone: "coral", name: "鲸鲸城堡", targetR: 40, jellies: 2, puffers: true, bigFishBias: 0.08, boss: true },
];

/* ---------------- 吃与长大 ---------------- */

/** 两个圆是否碰到(factor 越小越宽容)。 */
export function circlesOverlap(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
  factor = 0.78,
): boolean {
  return Math.hypot(x2 - x1, y2 - y1) < (r1 + r2) * factor;
}

/** 我方半径明显更大才能吃掉对方。 */
export function canEat(playerR: number, otherR: number): boolean {
  return playerR >= otherR * 1.08;
}

/** 对方明显更大才有危险;差不多大就只是互相碰碰。 */
export function isDanger(playerR: number, otherR: number): boolean {
  return otherR >= playerR * 1.12;
}

/** 吃掉一条鱼后长大,封顶到目标大小。 */
export function grow(r: number, eatenR: number, target: number): number {
  return Math.min(target, r + Math.max(1.0, eatenR * 0.16));
}

/** roll ∈ [0,1) → 新鱼半径:大多数比玩家小,bigBias 越大越容易出大鱼。 */
export function spawnRadius(playerR: number, roll: number, bigBias = 0): number {
  const smallShare = Math.max(0.4, 0.66 - bigBias);
  if (roll < smallShare) {
    const t = roll / smallShare;
    return Math.max(6, playerR * (0.35 + 0.5 * t));
  }
  const t = (roll - smallShare) / (1 - smallShare);
  return Math.min(70, playerR * (1.2 + 0.7 * t));
}

/** 连吃奖励分:连吃越多每口越值钱,封顶 8 连。 */
export function eatScore(streak: number): number {
  return 5 + Math.min(Math.max(streak, 1), 8) * 5;
}

/* ---------------- 道具与 BOSS ---------------- */

export const SHIELD_SECONDS = 6;
export const BOSS_HP = 5;
export const BOSS_R = 64;

/** 长到 BOSS 的六成大就可以咬它了。 */
export function bossBiteReady(playerR: number, bossR = BOSS_R): boolean {
  return playerR >= bossR * 0.62;
}

/* ---------------- 结算 ---------------- */

export function starsForRun(retries: number, heartsLost: number): 1 | 2 | 3 {
  if (retries === 0 && heartsLost <= 1) return 3;
  if (retries <= 1) return 2;
  return 1;
}
