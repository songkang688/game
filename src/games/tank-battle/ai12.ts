/**
 * 铁皮坦克大战 1.2 · 铁皮车的脑子(纯算法层,只认识一张格子图)。
 *
 * 三档脾气:
 *  - `wander` 乱转:在空地上瞎逛,撞墙才换方向,看见人才顺手来一发。给最前面几章。
 *  - `chase`  追人:网格 A\* 一路找过去,认准目标不放。
 *  - `flank`  绕后卡位:先把「正门」那几格当成走不通,A\* 自然就从侧面 / 背面摸过去,
 *             摸到位置还会守在那儿卡着不让人回防。
 *
 * A\* 用的是四邻网格 + 曼哈顿启发值,并且给「三面是墙的坑」加了一大笔过路费——
 * 这就是不卡墙角的办法:进坑的代价比绕一圈还贵,最短路自己就不往坑里钻了。
 */

import type { Cell, Dir } from "./terrain12";
import { DX, DY } from "./terrain12";

export type AiTier = "wander" | "chase" | "flank";

export const AI_TIERS: readonly AiTier[] = ["wander", "chase", "flank"];

export interface TierSpec {
  tier: AiTier;
  name: string;
  emoji: string;
  desc: string;
  /** 隔多久重新拿一次主意(秒) */
  think: number;
  /** 会不会用 A\* 找路 */
  paths: boolean;
  /** 会不会绕开正门 */
  flanks: boolean;
  /** 多远之内看见人就开火(格) */
  fireRange: number;
  /** 瞎逛的概率:越高越像没头苍蝇 */
  wanderChance: number;
}

export const TIER_SPECS: Record<AiTier, TierSpec> = {
  wander: {
    tier: "wander",
    name: "乱转",
    emoji: "🌀",
    desc: "在场上瞎逛,撞墙才换个方向,看见人才顺手来一发。",
    think: 0.55,
    paths: false,
    flanks: false,
    fireRange: 5,
    wanderChance: 1,
  },
  chase: {
    tier: "chase",
    name: "追人",
    emoji: "🎯",
    desc: "认准一个目标,用 A* 一路找过去。",
    think: 0.3,
    paths: true,
    flanks: false,
    fireRange: 9,
    wanderChance: 0.05,
  },
  flank: {
    tier: "flank",
    name: "绕后卡位",
    emoji: "🕵️",
    desc: "不走正门,从侧面绕到背后,还会守着路口卡位。",
    think: 0.26,
    paths: true,
    flanks: true,
    fireRange: 10,
    wanderChance: 0,
  },
};

export function tierSpec(tier: AiTier): TierSpec {
  return TIER_SPECS[tier];
}

// ---------------------------------------------------------------------------
// 格子图
// ---------------------------------------------------------------------------

export interface Grid {
  w: number;
  h: number;
  /** 这一格彻底走不通(钢板 / 水洼 / 老巢) */
  wall: (cx: number, cy: number) => boolean;
  /** 进这一格的基础代价(砖可以打穿,所以只是贵) */
  cost?: (cx: number, cy: number) => number;
}

export function inGrid(g: Grid, cx: number, cy: number): boolean {
  return cx >= 0 && cy >= 0 && cx < g.w && cy < g.h;
}

export function passable(g: Grid, cx: number, cy: number): boolean {
  return inGrid(g, cx, cy) && !g.wall(cx, cy);
}

/**
 * 「三面是墙的坑」过路费:卡墙角就是这么防住的。
 * 只罚死胡同,不罚走廊——这张图上两边有墙的走廊到处都是,
 * 一格罚一点累起来比砸穿一堵砖还贵,那就会逼着车去拆墙,反而更糟。
 */
export const DEAD_END_TOLL = 9;

export function wallsAround(g: Grid, cx: number, cy: number): number {
  let n = 0;
  for (let d = 0 as Dir; d < 4; d++) {
    if (!passable(g, cx + DX[d], cy + DY[d])) n += 1;
  }
  return n;
}

/** 这一格是不是个死胡同(只有一个出口) */
export function isDeadEnd(g: Grid, cx: number, cy: number): boolean {
  return passable(g, cx, cy) && wallsAround(g, cx, cy) >= 3;
}

export function cornerToll(g: Grid, cx: number, cy: number): number {
  return wallsAround(g, cx, cy) >= 3 ? DEAD_END_TOLL : 0;
}

export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
}

export interface PathOpts {
  /** 这些格子当成走不通(绕后就靠它把正门封起来) */
  blocked?: readonly Cell[];
  /** 关掉墙角过路费(测试对照用) */
  cornerAware?: boolean;
  /** 找路上限,防呆 */
  maxNodes?: number;
}

/**
 * 四邻网格 A\*。找得到返回整条路(含起点与终点),找不到返回 null。
 * 代价 = 地形代价 + 墙角过路费,所以它宁可多绕两格也不往死胡同里钻。
 */
export function astar(g: Grid, from: Cell, to: Cell, opts: PathOpts = {}): Cell[] | null {
  if (!inGrid(g, from.cx, from.cy) || !inGrid(g, to.cx, to.cy)) return null;
  const cornerAware = opts.cornerAware ?? true;
  const maxNodes = opts.maxNodes ?? g.w * g.h * 4;
  const size = g.w * g.h;
  const idx = (c: Cell): number => c.cy * g.w + c.cx;
  const shut = new Uint8Array(size);
  for (const c of opts.blocked ?? []) {
    if (inGrid(g, c.cx, c.cy)) shut[idx(c)] = 1;
  }
  const start = idx(from);
  const goal = idx(to);
  if (shut[goal]) shut[goal] = 0;
  if (!passable(g, from.cx, from.cy) && start !== goal) {
    // 起点被压在墙里(刚被砖埋住之类)也得给条路走,放行起点即可
    shut[start] = 0;
  }

  const gScore = new Float64Array(size).fill(Infinity);
  const came = new Int32Array(size).fill(-1);
  const open: number[] = [start];
  const inOpen = new Uint8Array(size);
  const closed = new Uint8Array(size);
  gScore[start] = 0;
  inOpen[start] = 1;
  let visited = 0;

  const hOf = (i: number): number => manhattan({ cx: i % g.w, cy: Math.floor(i / g.w) }, to);

  while (open.length > 0 && visited < maxNodes) {
    let bestAt = 0;
    let bestF = Infinity;
    for (let k = 0; k < open.length; k++) {
      const i = open[k];
      const f = gScore[i] + hOf(i);
      if (f < bestF) {
        bestF = f;
        bestAt = k;
      }
    }
    const cur = open.splice(bestAt, 1)[0];
    inOpen[cur] = 0;
    if (cur === goal) {
      const path: Cell[] = [];
      for (let i: number = cur; i >= 0; i = came[i]) path.push({ cx: i % g.w, cy: Math.floor(i / g.w) });
      return path.reverse();
    }
    closed[cur] = 1;
    visited += 1;
    const cx = cur % g.w;
    const cy = Math.floor(cur / g.w);
    for (let d = 0 as Dir; d < 4; d++) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (!inGrid(g, nx, ny)) continue;
      const ni = ny * g.w + nx;
      // 终点本身是墙也认(老巢就是这种目标:走到跟前砸它,不需要开进去)
      if (closed[ni] || shut[ni] || (ni !== goal && g.wall(nx, ny))) continue;
      const step = (g.cost?.(nx, ny) ?? 1) + (ni === goal || !cornerAware ? 0 : cornerToll(g, nx, ny));
      const next = gScore[cur] + step;
      if (next < gScore[ni]) {
        gScore[ni] = next;
        came[ni] = cur;
        if (!inOpen[ni]) {
          open.push(ni);
          inOpen[ni] = 1;
        }
      }
    }
  }
  return null;
}

/** 把一条路翻成一串方向 */
export function pathDirs(path: readonly Cell[]): Dir[] {
  const out: Dir[] = [];
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].cx - path[i - 1].cx;
    const dy = path[i].cy - path[i - 1].cy;
    for (let d = 0 as Dir; d < 4; d++) {
      if (DX[d] === dx && DY[d] === dy) out.push(d);
    }
  }
  return out;
}

/** 这条路踩没踩死胡同(墙角过路费到底管不管用,用例看这个) */
export function pathTouchesDeadEnd(g: Grid, path: readonly Cell[]): boolean {
  for (let i = 1; i < path.length - 1; i++) {
    if (isDeadEnd(g, path[i].cx, path[i].cy)) return true;
  }
  return false;
}

/** 从 from 往 to 走的第一步;没路返回 -1 */
export function firstStep(g: Grid, from: Cell, to: Cell, opts: PathOpts = {}): Dir | -1 {
  const path = astar(g, from, to, opts);
  if (!path || path.length < 2) return -1;
  return pathDirs(path)[0] ?? -1;
}

// ---------------------------------------------------------------------------
// 绕后与瞎逛
// ---------------------------------------------------------------------------

/** 目标四周走得通的接近格 */
export function approachCells(g: Grid, target: Cell): Cell[] {
  const out: Cell[] = [];
  for (let d = 0 as Dir; d < 4; d++) {
    const cx = target.cx + DX[d];
    const cy = target.cy + DY[d];
    if (passable(g, cx, cy)) out.push({ cx, cy });
  }
  return out;
}

/**
 * 绕后:在目标四周挑一个离「正门」最远、自己又走得到的接近格。
 * 挑不出来(四周只剩正门)就返回 null,由上层退回正门方案。
 */
export function flankPick(g: Grid, target: Cell, front: readonly Cell[], from: Cell): Cell | null {
  const cells = approachCells(g, target).filter(
    (c) => !front.some((f) => f.cx === c.cx && f.cy === c.cy)
  );
  let best: Cell | null = null;
  let bestScore = -Infinity;
  for (const c of cells) {
    const path = astar(g, from, c, { blocked: front });
    if (!path) continue;
    const away = front.length === 0 ? 0 : Math.min(...front.map((f) => manhattan(f, c)));
    const score = away * 4 - path.length * 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** 瞎逛:能直走就直走,走不动了才换个方向(不原地掉头,免得抽风) */
export function wanderStep(g: Grid, from: Cell, cur: Dir | -1, rand: () => number): Dir {
  const open: Dir[] = [];
  for (let d = 0 as Dir; d < 4; d++) {
    if (passable(g, from.cx + DX[d], from.cy + DY[d])) open.push(d);
  }
  if (open.length === 0) return (cur >= 0 ? cur : 0) as Dir;
  if (cur >= 0 && open.includes(cur as Dir) && rand() < 0.72) return cur as Dir;
  const back = cur >= 0 ? (((cur as number) + 2) % 4 as Dir) : -1;
  const nice = open.filter((d) => d !== back);
  const pool = nice.length > 0 ? nice : open;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}
