/**
 * 弹弹小鸟 —— 无尽「打靶塔」(1.2 第 12 步 A 档补做)。
 *
 * 规则:一轮给固定几只小鸟,面前是随机生成、一轮比一轮高的靶塔;
 * 塔拆得越干净、豆弹得越多,这一轮拿的分越高。清台就进下一轮,
 * 小鸟用完还有豆没打掉就结束,总分交给 save.recordEndlessBest("sling-birds", n)。
 *
 * 生成是确定性的:同一个 seed + 同一轮永远长一模一样的塔,
 * 所以「第 7 轮特别难」这种事可以在单测里复现。
 */
import type { BirdKind, BlockDef, BlockKind, LevelDef } from "./levels";
import { GROUND_Y, makeRng } from "./physics";

/** 每轮固定给几只小鸟(「弹数固定」) */
export const ENDLESS_BIRDS = 3;
/** 默认种子:换个种子就是另一套塔,存档里不记种子,每次进来都从第 1 轮开始 */
export const ENDLESS_SEED = 20250812;
/** 塔的最少 / 最多座数与最少 / 最多层数 */
export const TOWER_MIN = 2;
export const TOWER_MAX = 4;
export const FLOOR_MIN = 2;
export const FLOOR_MAX = 7;
/** 一块砖的尺寸 */
export const BRICK_W = 26;
export const BRICK_H = 22;

export interface EndlessRound {
  round: number;
  name: string;
  /** 借用闯关的章节配色,轮换着换风景 */
  chapter: number;
  birds: BirdKind[];
  beans: LevelDef["beans"];
  blocks: BlockDef[];
}

/** 第 round 轮有几座塔(2 → 4) */
export function towerCount(round: number): number {
  const r = Math.max(1, Math.round(round));
  return Math.min(TOWER_MAX, TOWER_MIN + Math.floor((r - 1) / 3));
}

/** 第 round 轮的塔有几层(2 → 7,越来越高) */
export function towerFloors(round: number): number {
  const r = Math.max(1, Math.round(round));
  return Math.min(FLOOR_MAX, FLOOR_MIN + Math.floor((r - 1) / 2));
}

/** 第 round 轮塔身能出现的材质:一轮比一轮硬 */
export function towerMaterials(round: number): BlockKind[] {
  const r = Math.max(1, Math.round(round));
  const mats: BlockKind[] = ["wood"];
  if (r >= 2) mats.push("ice");
  if (r >= 4) mats.push("stone");
  if (r >= 7) mats.push("shell");
  return mats;
}

/** 第 round 轮上场的小鸟(固定 3 只,种类随轮次轮换) */
export function endlessBirdKinds(round: number): BirdKind[] {
  const pool: BirdKind[] = ["straight", "split", "slam", "drill", "boomerang"];
  const r = Math.max(1, Math.round(round));
  const out: BirdKind[] = [];
  for (let i = 0; i < ENDLESS_BIRDS; i++) out.push(pool[(r - 1 + i) % pool.length]);
  return out;
}

/**
 * 生成第 round 轮的靶塔。塔从 x=200 往右均匀排开,
 * 每座塔顶上站一颗绿绿豆;层数够高的塔中间还会架一条横梁,拆起来更有连锁感。
 */
export function towerRound(round: number, seed = ENDLESS_SEED): EndlessRound {
  const r = Math.max(1, Math.round(round));
  const rng = makeRng(seed + r * 7919);
  const count = towerCount(r);
  const floors = towerFloors(r);
  const mats = towerMaterials(r);
  const blocks: BlockDef[] = [];
  const beans: LevelDef["beans"] = [];

  const first = 214;
  const gap = count > 1 ? Math.min(96, Math.floor((496 - first) / (count - 1))) : 0;
  for (let i = 0; i < count; i++) {
    const x = first + i * gap;
    // 越靠后的塔越高一点,但不超过上限
    const tall = Math.min(FLOOR_MAX, floors + (rng() < 0.4 ? 1 : 0));
    let top = GROUND_Y;
    for (let k = 0; k < tall; k++) {
      const mat = k === 0 && mats.includes("stone") ? "stone" : mats[Math.floor(rng() * mats.length)];
      blocks.push({ kind: mat, x, y: top - BRICK_H, w: BRICK_W, h: BRICK_H });
      top -= BRICK_H;
    }
    if (tall >= 4 && i + 1 < count) {
      // 两座塔之间架一条横梁:打断一边,整条梁连着上面的豆一起塌
      blocks.push({ kind: "wood", x: x + BRICK_W, y: top, w: Math.max(8, gap - BRICK_W), h: 10 });
    }
    beans.push({ x: x + BRICK_W / 2, y: top - 10 });
  }

  return {
    round: r,
    name: `第 ${r} 座打靶塔`,
    chapter: (r - 1) % 9,
    birds: endlessBirdKinds(r),
    beans,
    blocks
  };
}

export interface RoundTally {
  round: number;
  /** 这一轮拆掉的方块数 */
  destroyed: number;
  /** 这一轮弹走的绿绿豆数 */
  popped: number;
  /** 没用上的小鸟数 */
  birdsLeft: number;
  /** 有没有清台 */
  cleared: boolean;
}

/** 单块方块 / 单颗豆 / 省下一只鸟各值多少分 */
export const SCORE_BLOCK = 10;
export const SCORE_BEAN = 20;
export const SCORE_BIRD_LEFT = 15;
export const SCORE_CLEAR_BASE = 30;
export const SCORE_CLEAR_PER_ROUND = 5;

/** 一轮得分:塔倒得越多分越高,清台还有额外奖励,轮次越靠后奖励越大 */
export function roundScore(t: RoundTally): number {
  const base = Math.max(0, t.destroyed) * SCORE_BLOCK + Math.max(0, t.popped) * SCORE_BEAN;
  if (!t.cleared) return base;
  return (
    base +
    Math.max(0, t.birdsLeft) * SCORE_BIRD_LEFT +
    SCORE_CLEAR_BASE +
    Math.max(1, Math.round(t.round)) * SCORE_CLEAR_PER_ROUND
  );
}

/** 结算文案:只鼓励,不说输 */
export function endlessLine(round: number, score: number, best: number, isNewBest: boolean): string {
  if (isNewBest) return `新纪录!你打到第 ${round} 座塔,拿了 ${score} 分,比以前都高!`;
  return `打到第 ${round} 座塔,这次 ${score} 分,最好成绩 ${best} 分。塔越高分越多,再来一次!`;
}
