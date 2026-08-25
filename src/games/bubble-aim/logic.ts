// 泡泡瞄准纯逻辑：六边形错位网格、连消、悬空掉落、弹道反射。不依赖 DOM。

export const W = 360;
export const H = 480;
export const COLS = 9;
export const R = 19;
export const ROW_H = R * 2 * 0.866;
export const TOP = 6;
/** 泡泡占到这一行（含）就越线失败 */
export const DEADLINE_ROW = 11;
/** 网格总行数（含缓冲行） */
export const MAX_ROWS = 13;

export type Color = string;
export type Grid = (Color | null)[][];

/** 偶数行 9 个，奇数行右移半格只有 8 个 */
export function rowLength(r: number): number {
  return r % 2 === 0 ? COLS : COLS - 1;
}

export function cellCenter(r: number, c: number): { x: number; y: number } {
  const margin = (W - COLS * 2 * R) / 2;
  const offset = r % 2 === 0 ? 0 : R;
  return {
    x: margin + R + offset + c * 2 * R,
    y: TOP + R + r * ROW_H,
  };
}

export function inGrid(r: number, c: number): boolean {
  return r >= 0 && r < MAX_ROWS && c >= 0 && c < rowLength(r);
}

/** 六边形邻居（奇数行右移半格布局） */
export function neighbors(r: number, c: number): Array<[number, number]> {
  const out: Array<[number, number]> = [
    [r, c - 1],
    [r, c + 1],
  ];
  if (r % 2 === 0) {
    out.push([r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]);
  } else {
    out.push([r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]);
  }
  return out.filter(([rr, cc]) => inGrid(rr, cc));
}

/**
 * 把关卡布局字符串解析成网格并补足空行。
 * 偶数行 9 个字符、奇数行 8 个字符，'.' 表示空。
 */
export function parseLayout(rows: string[]): Grid {
  const grid: Grid = [];
  rows.forEach((row, r) => {
    const need = rowLength(r);
    if (row.length !== need) {
      throw new Error(`第 ${r} 行应有 ${need} 个字符，实际 ${row.length}`);
    }
    grid.push(Array.from(row, (ch) => (ch === "." ? null : ch)));
  });
  while (grid.length < MAX_ROWS) {
    grid.push(new Array<Color | null>(rowLength(grid.length)).fill(null));
  }
  return grid;
}

/** 同色连通块（含起点） */
export function floodSameColor(grid: Grid, r: number, c: number): Array<[number, number]> {
  const color = grid[r]?.[c];
  if (!color) return [];
  const seen = new Set<string>([`${r},${c}`]);
  const queue: Array<[number, number]> = [[r, c]];
  const out: Array<[number, number]> = [];
  while (queue.length > 0) {
    const [cr, cc] = queue.pop()!;
    out.push([cr, cc]);
    for (const [nr, nc] of neighbors(cr, cc)) {
      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;
      if (grid[nr]?.[nc] !== color) continue;
      seen.add(key);
      queue.push([nr, nc]);
    }
  }
  return out;
}

/** 没有连到顶行的悬空泡泡 */
export function findFloating(grid: Grid): Array<[number, number]> {
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [];
  for (let c = 0; c < rowLength(0); c++) {
    if (grid[0][c]) {
      seen.add(`0,${c}`);
      queue.push([0, c]);
    }
  }
  while (queue.length > 0) {
    const [cr, cc] = queue.pop()!;
    for (const [nr, nc] of neighbors(cr, cc)) {
      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;
      if (!grid[nr]?.[nc]) continue;
      seen.add(key);
      queue.push([nr, nc]);
    }
  }
  const floating: Array<[number, number]> = [];
  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < rowLength(r); c++) {
      if (grid[r][c] && !seen.has(`${r},${c}`)) floating.push([r, c]);
    }
  }
  return floating;
}

/** 网格里还剩多少泡泡 */
export function countBubbles(grid: Grid): number {
  let n = 0;
  for (const row of grid) for (const cell of row) if (cell) n++;
  return n;
}

/** 网格里出现过的颜色（射出的泡泡只从这里挑，不给没用的颜色） */
export function colorsInGrid(grid: Grid): Color[] {
  const set = new Set<Color>();
  for (const row of grid) for (const cell of row) if (cell) set.add(cell);
  return Array.from(set);
}

export interface ShotResult {
  /** 弹道折线（起点、每次反弹点、终点），画虚线用 */
  path: Array<{ x: number; y: number }>;
  /** 吸附落位；打不到就为 null */
  landing: { r: number; c: number } | null;
}

/**
 * 从 (sx,sy) 沿方向 (dx,dy) 发射：碰左右墙反弹，碰到泡泡或顶就吸附。
 * 同一个函数既算瞄准虚线又算真实飞行，保证"指哪打哪"。
 */
export function simulateShot(grid: Grid, sx: number, sy: number, dx: number, dy: number): ShotResult {
  const len = Math.hypot(dx, dy) || 1;
  let vx = dx / len;
  let vy = dy / len;
  let x = sx;
  let y = sy;
  const path: Array<{ x: number; y: number }> = [{ x, y }];
  const step = 3;

  const occupied: Array<{ r: number; c: number; x: number; y: number }> = [];
  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < rowLength(r); c++) {
      if (grid[r][c]) occupied.push({ r, c, ...cellCenter(r, c) });
    }
  }

  for (let i = 0; i < 1200; i++) {
    x += vx * step;
    y += vy * step;
    if (x < R) {
      x = R;
      vx = Math.abs(vx);
      path.push({ x, y });
    } else if (x > W - R) {
      x = W - R;
      vx = -Math.abs(vx);
      path.push({ x, y });
    }
    let hit = y <= TOP + R;
    if (!hit) {
      for (const o of occupied) {
        const dist = Math.hypot(x - o.x, y - o.y);
        if (dist < R * 2 - 3) {
          hit = true;
          break;
        }
      }
    }
    if (hit) {
      path.push({ x, y });
      const landing = snapCell(grid, x, y);
      if (landing) {
        const cc = cellCenter(landing.r, landing.c);
        path[path.length - 1] = { x: cc.x, y: cc.y };
      }
      return { path, landing };
    }
  }
  path.push({ x, y });
  return { path, landing: null };
}

/** 找离碰撞点最近的合法空格（顶行或贴着已有泡泡） */
export function snapCell(grid: Grid, x: number, y: number): { r: number; c: number } | null {
  let best: { r: number; c: number } | null = null;
  let bestDist = Infinity;
  for (let r = 0; r < MAX_ROWS; r++) {
    for (let c = 0; c < rowLength(r); c++) {
      if (grid[r][c]) continue;
      const anchored = r === 0 || neighbors(r, c).some(([nr, nc]) => grid[nr][nc]);
      if (!anchored) continue;
      const cc = cellCenter(r, c);
      const d = Math.hypot(x - cc.x, y - cc.y);
      if (d < bestDist) {
        bestDist = d;
        best = { r, c };
      }
    }
  }
  return best;
}

export interface SettleResult {
  popped: Array<{ r: number; c: number; color: Color }>;
  dropped: Array<{ r: number; c: number; color: Color }>;
}

/**
 * 落位后结算：同色 ≥3 就消，再让悬空的掉下来。直接改 grid。
 */
export function settleShot(grid: Grid, r: number, c: number): SettleResult {
  const popped: SettleResult["popped"] = [];
  const dropped: SettleResult["dropped"] = [];
  const match = floodSameColor(grid, r, c);
  if (match.length >= 3) {
    for (const [mr, mc] of match) {
      popped.push({ r: mr, c: mc, color: grid[mr][mc]! });
      grid[mr][mc] = null;
    }
    for (const [fr, fc] of findFloating(grid)) {
      dropped.push({ r: fr, c: fc, color: grid[fr][fc]! });
      grid[fr][fc] = null;
    }
  }
  return { popped, dropped };
}

/** 是否有泡泡越过失败线 */
export function crossedDeadline(grid: Grid): boolean {
  for (let r = DEADLINE_ROW; r < MAX_ROWS; r++) {
    for (let c = 0; c < rowLength(r); c++) {
      if (grid[r][c]) return true;
    }
  }
  return false;
}

/** 本关星级：剩的子弹越多星越多 */
export function starsForShotsLeft(left: number, total: number): 1 | 2 | 3 {
  if (total <= 0) return 1;
  const ratio = left / total;
  if (ratio >= 0.4) return 3;
  if (ratio >= 0.15) return 2;
  return 1;
}
