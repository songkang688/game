/**
 * 窗口4 · 档B 验收用的「泡泡噗噗模拟玩家」。
 *
 * 这里没有任何游戏逻辑的复制品:摆盘、消除、塌陷、重排全都调 `logic.ts` / `collapse.ts`
 * 的真函数,本文件只负责把 `index.ts` 里「点一下 → onCell → afterPop → runCollapse → checkEnd」
 * 这条路按同样的顺序串起来,好让第 1、2、3 轮验收共用同一个玩家。
 *
 * 文件名以 `qa` 开头,`readGameSources()` 会把它排除在源码巡检之外,
 * 也不会被 `import.meta.glob` 收进首页或任何 chunk。
 */
import { mulberry32 } from "../level99";
import { CHAIN, blowShuffle, chainBlast, isChain, planCollapse } from "./collapse";
import { BOARD_COLS, type BubbleLevel } from "./levels";
import {
  BOLT,
  CHAMELEON_BASE,
  FROZEN_OFFSET,
  HIDDEN_OFFSET,
  RAINBOW,
  STONE,
  colorOf,
  countLeftOn,
  cycleChameleons,
  groupAt,
  isFrozen,
  isHidden,
  revealHidden,
} from "./logic";

const COLS = BOARD_COLS;

/** 与 index.ts 第 45 行的 MAX_SHUFFLE 同口径 */
export const MAX_SHUFFLE = 3;

/** 照着 index.ts 的 setup() 摆一盘,只是把 Math.random 换成可复现的种子 */
export function seedBoard(cfg: BubbleLevel, seed: number): number[][] {
  const rand = mulberry32(seed >>> 0);
  const rows = cfg.rows;
  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    grid.push(Array.from({ length: COLS }, () => Math.floor(rand() * cfg.colors)));
  }
  const specials: number[] = [];
  for (let i = 0; i < cfg.rainbow; i++) specials.push(RAINBOW);
  for (let i = 0; i < cfg.stone; i++) specials.push(STONE);
  for (let i = 0; i < cfg.bolt; i++) specials.push(BOLT);
  for (let i = 0; i < (cfg.chain ?? 0); i++) specials.push(CHAIN);
  const used = new Set<number>();
  const pick = (): [number, number] | null => {
    for (let guard = 0; guard < 200; guard++) {
      const r = Math.floor(rand() * rows);
      const c = Math.floor(rand() * COLS);
      if (used.has(r * COLS + c)) continue;
      used.add(r * COLS + c);
      return [r, c];
    }
    return null;
  };
  for (const sp of specials) {
    const at = pick();
    if (at) grid[at[0]][at[1]] = sp;
  }
  const wrapValue = (offset: number): void => {
    const at = pick();
    if (at) grid[at[0]][at[1]] = (grid[at[0]][at[1]] % cfg.colors) + offset;
  };
  for (let i = 0; i < cfg.frozen; i++) wrapValue(FROZEN_OFFSET);
  for (let i = 0; i < (cfg.hidden ?? 0); i++) wrapValue(HIDDEN_OFFSET);
  for (let i = 0; i < (cfg.chameleon ?? 0); i++) wrapValue(CHAMELEON_BASE);
  return grid;
}

/** 照着 index.ts 的 popCells():消掉一组,并解冻旁边的冰冻泡 */
export function popCells(grid: number[][], list: Array<[number, number]>): void {
  const rows = grid.length;
  for (const [r, c] of list) grid[r][c] = -1;
  for (const [r, c] of list) {
    for (const [nr, nc] of [
      [r + 1, c],
      [r - 1, c],
      [r, c + 1],
      [r, c - 1],
    ] as Array<[number, number]>) {
      if (nr < 0 || nr >= rows || nc < 0 || nc >= COLS) continue;
      if (isFrozen(grid[nr][nc])) grid[nr][nc] -= FROZEN_OFFSET;
    }
  }
}

/** 照着 index.ts 的 onCell():把还没点亮的隐藏泡先点一遍(点亮不算一步) */
export function revealAll(grid: number[][]): void {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isHidden(grid[r][c])) grid[r][c] = revealHidden(grid[r][c]);
    }
  }
}

/**
 * 这一手能带走哪些格子。四种可点的东西各算各的:
 * 连锁泡炸一圈、彩虹泡清最多的那色、闪电泡清一行一列、同色连通群 ≥2。
 * 石头 / 冰冻 / 还没点亮的隐藏泡点了没反应,按 index.ts 的分支直接跳过。
 */
export function actionAt(grid: number[][], cfg: BubbleLevel, r: number, c: number): Array<[number, number]> {
  const rows = grid.length;
  const v = grid[r][c];
  if (v < 0 || v === STONE || isFrozen(v) || isHidden(v)) return [];
  if (isChain(v)) return chainBlast(grid, COLS, r, c);
  if (v === RAINBOW) {
    const counts = new Array<number>(cfg.colors).fill(0);
    for (let rr = 0; rr < rows; rr++)
      for (let cc = 0; cc < COLS; cc++) {
        const color = colorOf(grid[rr][cc], cfg.colors);
        if (color >= 0) counts[color]++;
      }
    let best = 0;
    for (let i = 1; i < cfg.colors; i++) if (counts[i] > counts[best]) best = i;
    const list: Array<[number, number]> = [[r, c]];
    for (let rr = 0; rr < rows; rr++)
      for (let cc = 0; cc < COLS; cc++) {
        if (colorOf(grid[rr][cc], cfg.colors) === best) list.push([rr, cc]);
      }
    return list;
  }
  if (v === BOLT) {
    const list: Array<[number, number]> = [];
    for (let cc = 0; cc < COLS; cc++) {
      const gv = grid[r][cc];
      if (gv >= 0 && gv !== STONE) list.push([r, cc]);
    }
    for (let rr = 0; rr < rows; rr++) {
      if (rr === r) continue;
      const gv = grid[rr][c];
      if (gv >= 0 && gv !== STONE) list.push([rr, c]);
    }
    return list;
  }
  const group = groupAt(grid, COLS, r, c, cfg.colors);
  return group.length >= 2 ? group : [];
}

/** 全盘扫一遍,挑收益最大的一手;一手都没有就返回 null */
export function bestAction(grid: number[][], cfg: BubbleLevel): Array<[number, number]> | null {
  let best: Array<[number, number]> = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < COLS; c++) {
      const list = actionAt(grid, cfg, r, c);
      if (list.length > best.length) best = list;
    }
  }
  return best.length > 0 ? best : null;
}

export interface BubbleRun {
  won: boolean;
  left: number;
  moves: number;
  shuffles: number;
  outOfMoves: boolean;
}

/**
 * 贪心玩家:先把隐藏泡点亮,再一直挑收益最大的一手,没得消就让朵朵吹一口气重排。
 * 这条路径和 `onCell → afterPop → runCollapse → checkEnd` 完全同构,
 * 只是把动画换成了直接取 `plan.next`。
 */
export function greedyPlay(cfg: BubbleLevel, seed: number, opts: { lazy?: boolean } = {}): BubbleRun {
  let grid = seedBoard(cfg, seed);
  const rand = mulberry32(seed * 31 + 7);
  let gravityUp = false;
  let movesLeft = cfg.moveLimit ?? 0;
  let shuffles = 0;
  let moves = 0;

  for (let guard = 0; guard < 4000; guard++) {
    revealAll(grid);
    const outOfMoves = cfg.moveLimit ? movesLeft <= 0 : false;
    const move = opts.lazy || outOfMoves ? null : bestAction(grid, cfg);
    if (!move) {
      const left = countLeftOn(grid);
      if (!opts.lazy && !outOfMoves && left > cfg.maxLeft && shuffles < MAX_SHUFFLE) {
        shuffles++;
        grid = blowShuffle(grid, COLS, cfg.colors, rand);
        continue;
      }
      return { won: left <= cfg.maxLeft, left, moves, shuffles, outOfMoves };
    }
    popCells(grid, move);
    moves++;
    if (cfg.moveLimit) movesLeft = Math.max(0, movesLeft - 1);
    if ((cfg.chameleon ?? 0) > 0) cycleChameleons(grid, cfg.colors);
    if (cfg.flipGravity) gravityUp = !gravityUp;
    grid = planCollapse(grid, COLS, gravityUp, { reduced: true }).next;
  }
  throw new Error("贪心玩家跑了 4000 步还没收敛,盘面可能不收口");
}
