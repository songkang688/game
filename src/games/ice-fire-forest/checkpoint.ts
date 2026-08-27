/**
 * 冰冰火火森林 · 检查点与小云朵(纯函数,不碰 DOM)。
 *
 * 1.1 里踩到自己过不去的池子是「原地被弹回来、掉一颗心」,三颗心掉完整关重来。
 * 1.2 改成:
 *
 *  1. 每关 **2–3 条检查线**(按横向均分,`pickCheckpoints`);
 *  2. **两个人都越过**一条线,那条线才算点亮 —— 这是合作游戏,
 *     一个人冲在前面就把检查点算掉的话,另一个人会被送到自己根本没去过的地方;
 *  3. 踩进池子的人**变成一朵小云**,飘回最近那条检查线上离他最近的一格;
 *  4. 飘回**只挪人**:拉杆、闩开的记忆门、捡过的宝石、推过的木箱统统保留,
 *     不许整关重来。
 *
 * 检查点做成「列」而不是「格」,是因为两位主角走的是两条不同的路
 * (冰水那条只有凛凛过得去,岩浆那条只有焰焰过得去),
 * 同一格当检查点的话总有一个人回不去。
 */
import { TILE, type Hero, type ParsedLevel } from "./logic";

/** 每关最少几条检查线 */
export const MIN_CHECKPOINTS = 2;
/** 每关最多几条检查线 */
export const MAX_CHECKPOINTS = 3;
/** 宽到这个数才摆得下三条线 */
const WIDE_ENOUGH_FOR_THREE = 12;

export interface Checkpoints {
  /** 从左到右的检查线列号 */
  columns: number[];
}

/** 这一格是不是「谁都站得住、而且站上去不会顺手改变什么」 */
function restfulCell(level: ParsedLevel, pos: number): boolean {
  const t = level.tiles[pos];
  return t === TILE.FLOOR || t === TILE.LIFT_PAD;
}

/** 这一列有没有能歇脚的格子 */
function columnHasRest(level: ParsedLevel, x: number): boolean {
  for (let y = 1; y < level.h - 1; y++) {
    if (restfulCell(level, y * level.w + x)) return true;
  }
  return false;
}

/**
 * 给一关挑 2–3 条检查线。
 *
 * 做法是把「出发点那一列」到「两扇门那一列」之间均分成 n+1 段,
 * 每个分界处往左右找最近的、有歇脚格的那一列。
 * 纯函数:同一张图每次挑出来的线完全一样。
 */
export function pickCheckpoints(level: ParsedLevel): Checkpoints {
  const startX = Math.min(level.iceStart % level.w, level.fireStart % level.w);
  const endX = Math.max(level.iceDoor % level.w, level.fireDoor % level.w);
  const span = endX - startX;
  if (span < 3) return { columns: [] };

  const want = level.w >= WIDE_ENOUGH_FOR_THREE ? MAX_CHECKPOINTS : MIN_CHECKPOINTS;
  const columns: number[] = [];
  for (let i = 1; i <= want; i++) {
    const ideal = startX + Math.round((span * i) / (want + 1));
    let hit = -1;
    for (let off = 0; off <= span; off++) {
      for (const x of [ideal - off, ideal + off]) {
        if (x <= startX || x >= endX) continue;
        if (columns.includes(x)) continue;
        if (!columnHasRest(level, x)) continue;
        hit = x;
        break;
      }
      if (hit >= 0) break;
    }
    if (hit >= 0) columns.push(hit);
  }
  columns.sort((a, b) => a - b);
  return { columns };
}

/**
 * 两人都越过了第几条线(0 基;-1 表示一条都还没点亮)。
 * 只往前记,不往回退 —— 所以传上一次的 `current` 进来。
 */
export function updateReached(
  cps: Checkpoints,
  current: number,
  iceX: number,
  fireX: number
): number {
  let next = current;
  for (let i = 0; i < cps.columns.length; i++) {
    if (iceX >= cps.columns[i] && fireX >= cps.columns[i]) next = Math.max(next, i);
  }
  return next;
}

/**
 * 小云朵该飘回哪一格。
 *
 * 一条都没点亮就回自己的出发点;点亮了就回那条线上**离他现在最近的一行**。
 * 同伴占着的格子要让开,实在找不着就退回出发点 —— 出发点永远站得住。
 */
export function respawnCell(
  level: ParsedLevel,
  cps: Checkpoints,
  reached: number,
  hero: Hero,
  fromPos: number,
  occupied: number
): number {
  const home = hero === "ice" ? level.iceStart : level.fireStart;
  if (reached < 0 || reached >= cps.columns.length) return home === occupied ? -1 : home;
  const x = cps.columns[reached];
  const fromY = (fromPos / level.w) | 0;
  let best = -1;
  let bestGap = Number.POSITIVE_INFINITY;
  for (let y = 1; y < level.h - 1; y++) {
    const pos = y * level.w + x;
    if (!restfulCell(level, pos)) continue;
    if (pos === occupied) continue;
    const gap = Math.abs(y - fromY);
    if (gap < bestGap) {
      bestGap = gap;
      best = pos;
    }
  }
  if (best >= 0) return best;
  return home === occupied ? -1 : home;
}

/**
 * 小云朵飘回去的那条弧线(渲染用的采样点,格坐标)。
 * 中间抬高一点,看着像一朵云飘过去,而不是瞬移。
 */
export function cloudPath(
  level: ParsedLevel,
  fromPos: number,
  toPos: number,
  samples = 12
): Array<{ x: number; y: number }> {
  const fx = fromPos % level.w;
  const fy = (fromPos / level.w) | 0;
  const tx = toPos % level.w;
  const ty = (toPos / level.w) | 0;
  const lift = Math.min(1.4, 0.4 + Math.abs(tx - fx) * 0.12);
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    pts.push({
      x: fx + (tx - fx) * t,
      y: fy + (ty - fy) * t - Math.sin(Math.PI * t) * lift,
    });
  }
  return pts;
}

/** 飘回去的时候说的一句话:没有任何「受不了」的描写,只是换个地方接着玩 */
export function cloudLine(hero: Hero, reached: number): string {
  const who = hero === "ice" ? "凛凛" : "焰焰";
  return reached < 0
    ? `${who}变成一朵小云,飘回出发点啦,机关都还开着。`
    : `${who}变成一朵小云,飘回上一个休息点啦,机关都还开着。`;
}

/** HUD 上那颗检查点小旗的文字 */
export function checkpointLabel(cps: Checkpoints, reached: number): string {
  const total = cps.columns.length;
  if (total === 0) return "🚩 —";
  return `🚩 ${reached + 1}/${total}`;
}
