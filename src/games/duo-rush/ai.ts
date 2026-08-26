/**
 * 朵星双人冲刺 · 人机对手。
 *
 * 三档的差别是三件事，不是给电脑开数值外挂——它和真人跑在**一模一样**的赛道上，
 * 速度曲线也完全相同：
 *  1. **反应延迟**：电脑不是每帧重新想，而是隔一段才重新看一眼前方，中间照着旧主意跑。
 *     新手档要 0.46 秒才看一眼，高手档 0.14 秒。
 *  2. **会不会失误**：每次重新看的时候，有一定概率「愣了一下」什么都不做。
 *     新手档三次里差不多要愣一次，高手档基本不愣。
 *  3. **顺不顺路捡金币**：档位越高越会在安全的时候顺手拐去吃金币。
 *
 * 随机数是自带的确定性发生器，同一个 seed 就是同一串行为，单测里可以完全复现。
 */
import type { Action } from "./keys";
import {
  JUMP_SECONDS,
  SLIDE_SECONDS,
  type Entity,
  isObstacle,
  makeRng,
  trackClusters,
} from "./logic";

/** 0 = 新手，1 = 稳当，2 = 高手 */
export type AiLevel = 0 | 1 | 2;

export const AI_LEVELS: readonly AiLevel[] = [0, 1, 2];

export const AI_LABELS: Record<AiLevel, string> = {
  0: "新手",
  1: "稳当",
  2: "高手",
};

export const AI_HINTS: Record<AiLevel, string> = {
  0: "反应慢半拍，还常常愣神，第一次上手挑它",
  1: "反应中等，基本不失误，赢它要靠稳",
  2: "几乎不失误，但它也有反应延迟，抓住这半拍就能超车",
};

/** 每一档隔多久才重新看一眼前方（秒）—— 这就是反应延迟 */
export const AI_REACTION_SECONDS: Record<AiLevel, number> = { 0: 0.46, 1: 0.26, 2: 0.14 };
/** 每次重新看的时候「愣一下」的概率 */
export const AI_MISTAKE_CHANCE: Record<AiLevel, number> = { 0: 0.34, 1: 0.09, 2: 0.015 };
/** 安全时顺手拐去吃金币的积极度 */
export const AI_COIN_GREED: Record<AiLevel, number> = { 0: 0.18, 1: 0.5, 2: 0.78 };

/** 提前多少秒开始横移（换道比跳跃安全，所以给的提前量大得多） */
export const LANE_LEAD_SECONDS = 1.25;
/** 跳跃 / 下滑在离障碍还有这么久的时候按下，正好在半空中撞上 */
export const JUMP_LEAD_SECONDS = JUMP_SECONDS * 0.45;
export const SLIDE_LEAD_SECONDS = SLIDE_SECONDS * 0.45;

export interface AiView {
  /** 现在在第几条道（0 左 / 1 中 / 2 右） */
  lane: number;
  dist: number;
  speed: number;
  jumping: boolean;
  sliding: boolean;
  /** 共享的赛道实体表（按 at 升序） */
  entities: readonly Entity[];
  /** 已经跑过的实体下标，从这里往后扫就够了 */
  from: number;
}

function clampLane(lane: number): 0 | 1 | 2 {
  return Math.max(0, Math.min(2, Math.round(lane))) as 0 | 1 | 2;
}

/** 往目标道靠一步：往左还是往右 */
function stepToward(lane: number, target: number): Action | null {
  if (target === lane) return null;
  return target < lane ? "left" : "right";
}

/** 一组候选道里挑离自己最近的那条 */
function nearestLane(lanes: number[], from: number): number | null {
  let best: number | null = null;
  let bestGap = Infinity;
  for (const l of lanes) {
    const gap = Math.abs(l - from);
    if (gap < bestGap) {
      bestGap = gap;
      best = l;
    }
  }
  return best;
}

/**
 * 不含反应延迟与失误的「标准解法」：这一刻最该做什么。
 * 顺序是先保命再吃分：能换到空道就换道（最安全），换不掉才跳或滑，
 * 前方彻底干净的时候才考虑拐去吃金币。
 */
export function planFor(view: AiView, greedy: boolean): Action | null {
  const speed = Math.max(1, view.speed);
  const horizon = Math.max(16, speed * 1.6);
  const ahead: Entity[] = [];
  for (let i = Math.max(0, view.from); i < view.entities.length; i++) {
    const e = view.entities[i];
    if (e.at <= view.dist) continue;
    if (e.at - view.dist > horizon) break;
    ahead.push(e);
  }
  const lane = clampLane(view.lane);
  const cluster = trackClusters(ahead)[0];

  if (cluster) {
    const eta = (cluster.at - view.dist) / speed;
    const need = cluster.lanes[lane];
    if (need !== "lane") {
      // 先找空道：那是不用做任何动作就能过去的
      const free = [0, 1, 2].filter((l) => cluster.lanes[l] === "lane");
      const target = nearestLane(free, lane);
      if (target !== null) {
        if (eta <= LANE_LEAD_SECONDS) return stepToward(lane, target);
        return null; // 还早，先别乱动
      }
      if (need === "jump") {
        return eta <= JUMP_LEAD_SECONDS && !view.jumping ? "jump" : null;
      }
      if (need === "slide") {
        return eta <= SLIDE_LEAD_SECONDS && !view.sliding ? "slide" : null;
      }
      // 自己这条道过不去，也没有空道，只能挪到「跳得过或滑得过」的那条
      const usable = [0, 1, 2].filter((l) => cluster.lanes[l] !== null);
      const fallback = nearestLane(usable, lane);
      if (fallback !== null && eta <= LANE_LEAD_SECONDS) return stepToward(lane, fallback);
      return null;
    }
    // 自己这条道本来就空，眼前这一排不用管
    if (eta <= LANE_LEAD_SECONDS) return null;
  }

  if (!greedy) return null;
  // 前面干净，才考虑顺手拐去吃金币或踩加速带
  const pickup = ahead.find(
    (e) => !isObstacle(e.kind) && e.lane !== lane && e.at - view.dist <= speed * LANE_LEAD_SECONDS,
  );
  if (!pickup) return null;
  // 拐过去的路上不能有障碍挡着
  const blocked = ahead.some(
    (e) => isObstacle(e.kind) && e.lane === pickup.lane && e.at <= pickup.at + 2,
  );
  if (blocked) return null;
  return stepToward(lane, pickup.lane);
}

export interface AiBrain {
  level: AiLevel;
  rand: () => number;
  /** 下一次重新看前方的时刻（秒） */
  nextThinkAt: number;
  /** 上一次真的做了什么（调试与展示用） */
  lastAction: Action | null;
}

export function createBrain(level: AiLevel, seed: number): AiBrain {
  return {
    level,
    rand: makeRng(seed || 1),
    nextThinkAt: 0,
    lastAction: null,
  };
}

/**
 * 电脑这一帧要不要动。`now` 是对局已经跑了多少秒。
 * 没到重新思考的时刻就一律返回 null——这就是它「反应慢半拍」的来源。
 */
export function decide(brain: AiBrain, view: AiView, now: number): Action | null {
  if (now < brain.nextThinkAt) return null;
  brain.nextThinkAt = now + AI_REACTION_SECONDS[brain.level];
  if (brain.rand() < AI_MISTAKE_CHANCE[brain.level]) {
    brain.lastAction = null;
    return null; // 愣了一下
  }
  const greedy = brain.rand() < AI_COIN_GREED[brain.level];
  const action = planFor(view, greedy);
  brain.lastAction = action;
  return action;
}
