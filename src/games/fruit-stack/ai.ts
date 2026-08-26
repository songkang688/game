/**
 * 果果合成 · 对战假人与无头推演。
 *
 * 假人只决定「把果子放在哪一列」，其余全部交给真正的物理与合成逻辑，
 * 所以档位强弱的差别是真实打出来的，不是写死的分数。
 */
import { CHAIN, chainMerges, nextFruit, totalScore, type MergeEvent } from "./merge";
import {
  DROP_GRACE_MS,
  addCircle,
  allSettled,
  makeWorld,
  overLine,
  stackTop,
  stepPhysics,
  type Box,
  type World,
} from "./physics";

export type Tier = "rookie" | "normal" | "pro" | "hell";

export const TIERS: readonly Tier[] = ["rookie", "normal", "pro", "hell"];

export const TIER_LABELS: Record<Tier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  pro: "高手",
  hell: "地狱",
};

function rand01(seed: number, i: number): number {
  let h = (seed ^ Math.imul(i + 7, 0x27d4eb2d)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2545f491) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

/** 把容器横向切成若干个候选落点 */
export function dropSlots(box: Box, r: number, count = 9): number[] {
  const left = box.left + r + 1;
  const right = box.right - r - 1;
  if (right <= left) return [(box.left + box.right) / 2];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(left + ((right - left) * i) / (count - 1));
  }
  return out;
}

/** 容器的高度图：每个候选落点下方最高的果子顶端 */
export function heightMap(world: World, slots: readonly number[], side = 0): number[] {
  return slots.map((x) => {
    let top = world.box.floor;
    for (const c of world.circles) {
      if (c.side !== side) continue;
      if (Math.abs(c.x - x) > c.r + 6) continue;
      top = Math.min(top, c.y - c.r);
    }
    return top;
  });
}

/**
 * 挑一个落点。四档行为：
 *  菜鸟——随便挑；
 *  普通——找同级果子对准；
 *  高手——同级优先，否则挑最低洼处；
 *  地狱——同级优先，再看「放下去之后周围有没有可能连锁」，同时躲开最高的一列。
 */
export function pickDrop(world: World, tier: Tier, level: number, seed: number, turn: number, side = 0): number {
  const r = CHAIN[level].r;
  const slots = dropSlots(world.box, r);
  const roll = rand01(seed, turn);
  if (tier === "rookie") return slots[Math.floor(roll * slots.length) % slots.length];

  const heights = heightMap(world, slots, side);
  const same = world.circles.filter((c) => c.side === side && c.level === level);
  if (same.length > 0) {
    // 对准同级果子里最靠下的那颗
    let best = same[0];
    for (const c of same) if (c.y > best.y) best = c;
    let bestSlot = slots[0];
    let bestD = Infinity;
    for (const s of slots) {
      const d = Math.abs(s - best.x);
      if (d < bestD) {
        bestD = d;
        bestSlot = s;
      }
    }
    if (tier !== "normal") {
      // 高手 / 地狱：同级但堆得太高就换低洼处
      const idx = slots.indexOf(bestSlot);
      const lowest = Math.max(...heights);
      if (idx >= 0 && heights[idx] < lowest - 90) {
        return slots[heights.indexOf(lowest)];
      }
    }
    return bestSlot;
  }

  if (tier === "normal") return slots[Math.floor(roll * slots.length) % slots.length];

  // 高手：挑最低洼处
  let lowIdx = 0;
  for (let i = 1; i < heights.length; i++) if (heights[i] > heights[lowIdx]) lowIdx = i;
  if (tier === "pro") return slots[lowIdx];

  // 地狱：低洼优先，同时避开会让整体高度立刻超过一半的位置
  const limit = world.box.line + (world.box.floor - world.box.line) * 0.35;
  for (let i = 0; i < heights.length; i++) {
    const idx = (lowIdx + i) % heights.length;
    if (heights[idx] > limit) return slots[idx];
  }
  return slots[lowIdx];
}

export interface SimResult {
  score: number;
  drops: number;
  highest: number;
  lost: boolean;
  /** 一次连锁最长几段 */
  bestChain: number;
  world: World;
}

export interface SimOptions {
  box: Box;
  seed: number;
  maxSpawn: number;
  drops: number;
  restitution?: number;
  tier?: Tier;
  /** 由外部指定每一颗的落点（回放用）；给了就不走 AI */
  script?: number[];
  /** 每颗果子落下后最多推进多少毫秒等它静止 */
  settleMs?: number;
}

/**
 * 无头推演一整局：一颗一颗投放 → 等静止 → 结算连锁 → 检查越线。
 * 测试用它断言「关卡目标可达成」与「档位强弱」。
 */
export function simulate(opts: SimOptions): SimResult {
  const world = makeWorld(opts.box, { restitution: opts.restitution });
  const tier = opts.tier ?? "pro";
  const settleMs = opts.settleMs ?? 4000;
  let score = 0;
  let highest = -1;
  let bestChain = 0;
  let dropped = 0;

  for (let i = 0; i < opts.drops; i++) {
    const level = nextFruit(opts.seed, i, opts.maxSpawn);
    const x = opts.script ? opts.script[i % opts.script.length] : pickDrop(world, tier, level, opts.seed, i);
    const c = addCircle(world, level, x, opts.box.line - CHAIN[level].r - 8, CHAIN[level].r);
    c.vy = 60;
    dropped++;

    let t = 0;
    let rounds: MergeEvent[][] = [];
    while (t < settleMs) {
      stepPhysics(world, 16);
      t += 16;
      const r = chainMerges(world);
      if (r.length > 0) {
        rounds = rounds.concat(r);
        score += totalScore(r);
      }
      if (allSettled(world)) break;
    }
    bestChain = Math.max(bestChain, rounds.length);
    for (const c2 of world.circles) highest = Math.max(highest, c2.level);
    // 静止之后再看越线
    for (const c2 of world.circles) c2.graceMs = Math.min(c2.graceMs, 0);
    if (overLine(world).length > 0) {
      return { score, drops: dropped, highest, lost: true, bestChain, world };
    }
  }
  return { score, drops: dropped, highest, lost: false, bestChain, world };
}

/** 给前端用的落点提示（教学关的辅助线） */
export function suggestDrop(world: World, level: number): number {
  return pickDrop(world, "pro", level, 1, 0);
}

/** 容器的堆叠健康度：0 表示空，1 表示已经顶到警戒线 */
export function fillRatio(world: World, side = 0): number {
  const top = stackTop(world, side);
  const span = world.box.floor - world.box.line;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (world.box.floor - top) / span));
}

export { DROP_GRACE_MS };
