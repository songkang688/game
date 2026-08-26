/**
 * 泡泡噗噗 · 棋盘纯逻辑（1.1 抽出，UI 与测试共用）。
 * 格子取值约定：
 *  -1        空
 *  0..4      普通颜色泡泡
 *  10..14    冰冻泡泡（颜色 = 值 - 10，要先在旁边消一组才解冻）
 *  20..24    隐藏泡泡（颜色 = 值 - 20，1.1 新增：先点亮才看得见颜色）
 *  30..34    变色泡泡（当前颜色 = 值 - 30，1.1 新增：每消一组换下一种颜色）
 *  97        闪电泡泡（清整行整列）
 *  98        石头（敲不破）
 *  99        彩虹泡泡（消掉最多的颜色）
 */

export const EMPTY = -1;
export const RAINBOW = 99;
export const STONE = 98;
export const BOLT = 97;
export const FROZEN_OFFSET = 10;
export const HIDDEN_OFFSET = 20;
export const CHAMELEON_BASE = 30;

export function isColor(v: number, colors: number): boolean {
  return v >= 0 && v < colors;
}

export function isFrozen(v: number): boolean {
  return v >= FROZEN_OFFSET && v < FROZEN_OFFSET + 5;
}

export function isHidden(v: number): boolean {
  return v >= HIDDEN_OFFSET && v < HIDDEN_OFFSET + 5;
}

export function isChameleon(v: number): boolean {
  return v >= CHAMELEON_BASE && v < CHAMELEON_BASE + 5;
}

/**
 * 能参与同色连消的「当前颜色」：普通泡泡是它自己，变色泡泡是它现在的颜色，
 * 其余（冰冻/隐藏/石头/机关/空）都返回 -1，谁也配不上。
 */
export function colorOf(v: number, colors: number): number {
  if (isColor(v, colors)) return v;
  if (isChameleon(v)) return v - CHAMELEON_BASE;
  return -1;
}

/** 点亮一颗隐藏泡泡（不是隐藏泡泡就原样返回） */
export function revealHidden(v: number): number {
  return isHidden(v) ? v - HIDDEN_OFFSET : v;
}

/** 每消一组后，所有变色泡泡换到下一种颜色 */
export function cycleChameleons(grid: number[][], colors: number): void {
  for (const row of grid) {
    for (let c = 0; c < row.length; c++) {
      if (isChameleon(row[c])) {
        row[c] = CHAMELEON_BASE + ((row[c] - CHAMELEON_BASE + 1) % colors);
      }
    }
  }
}

/** 从 (r,c) 出发的同色连通块（按当前颜色算，变色泡泡也能入伙） */
export function groupAt(grid: number[][], cols: number, r: number, c: number, colors: number): Array<[number, number]> {
  const rows = grid.length;
  const color = colorOf(grid[r]?.[c] ?? EMPTY, colors);
  if (color < 0) return [];
  const seen = new Set<number>();
  const stack: Array<[number, number]> = [[r, c]];
  const out: Array<[number, number]> = [];
  while (stack.length) {
    const [cr, cc] = stack.pop() as [number, number];
    const key = cr * cols + cc;
    if (seen.has(key)) continue;
    seen.add(key);
    if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue;
    if (colorOf(grid[cr][cc], colors) !== color) continue;
    out.push([cr, cc]);
    stack.push([cr + 1, cc], [cr - 1, cc], [cr, cc + 1], [cr, cc - 1]);
  }
  return out;
}

/**
 * 塌落：泡泡向 down（或 1.1 重力翻转时向 up）压实，再把空列往左并拢。
 */
export function collapseGrid(grid: number[][], cols: number, up: boolean): void {
  const rows = grid.length;
  for (let c = 0; c < cols; c++) {
    if (up) {
      let write = 0;
      for (let r = 0; r < rows; r++) {
        if (grid[r][c] >= 0) {
          grid[write][c] = grid[r][c];
          if (write !== r) grid[r][c] = EMPTY;
          write++;
        }
      }
      for (let r = write; r < rows; r++) grid[r][c] = EMPTY;
    } else {
      let write = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        if (grid[r][c] >= 0) {
          grid[write][c] = grid[r][c];
          if (write !== r) grid[r][c] = EMPTY;
          write--;
        }
      }
      for (let r = write; r >= 0; r--) grid[r][c] = EMPTY;
    }
  }
  let writeCol = 0;
  for (let c = 0; c < cols; c++) {
    const hasAny = grid.some((row) => row[c] >= 0);
    if (hasAny) {
      if (writeCol !== c) {
        for (let r = 0; r < rows; r++) {
          grid[r][writeCol] = grid[r][c];
          grid[r][c] = EMPTY;
        }
      }
      writeCol++;
    }
  }
}

/**
 * 还有没有可走的一步：有机关（彩虹/闪电）、有没点亮的隐藏泡泡，
 * 或任意相邻两格当前颜色相同，都算有。
 */
export function hasMovesOn(grid: number[][], cols: number, colors: number): boolean {
  const rows = grid.length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = grid[r][c];
      if (v === RAINBOW || v === BOLT) return true;
      if (isHidden(v)) return true;
      const color = colorOf(v, colors);
      if (color < 0) continue;
      if (r + 1 < rows && colorOf(grid[r + 1][c], colors) === color) return true;
      if (c + 1 < cols && colorOf(grid[r][c + 1], colors) === color) return true;
    }
  }
  return false;
}

/** 场上还剩几颗（含石头等一切非空格） */
export function countLeftOn(grid: number[][]): number {
  let n = 0;
  for (const row of grid) for (const v of row) if (v >= 0) n++;
  return n;
}
