/**
 * 形状王国 · 几何纯函数（1.2 新增）。
 *
 * 这里只放「能算、能证、能测」的东西：格子集合的面积与周长、对称轴条数、欧拉公式。
 * 出题器与界面一行都不许自己算几何——全部经过本文件，好让单测把结论钉死。
 *
 * 两条自洽约定：
 *  1. 方格纸每格边长 1 厘米，所以面积单位一律「平方厘米」、周长单位一律「厘米」；
 *  2. 格子坐标 `(r, c)` 行在前列在后，行号向下增大（跟 SVG 一致）；
 *     坐标格题用的数对 `(列, 行)` 是另一套，见 `logic.ts` 的 `formatPoint`。
 */

// ---------------------------------------------------------------------------
// 格子集合：一切面积 / 周长的第一性原理
// ---------------------------------------------------------------------------

/** 一个格子的 key，形如 `"2,3"`（第 2 行第 3 列，都是 0 基） */
export type CellKey = string;

export function cellKey(r: number, c: number): CellKey {
  return `${Math.round(r)},${Math.round(c)}`;
}

export function parseCellKey(key: CellKey): { r: number; c: number } {
  const [r, c] = key.split(",").map(Number);
  return { r, c };
}

/** `[[r,c], …]` → 格子集合（重复的自动去掉） */
export function cellSet(list: readonly (readonly [number, number])[]): Set<CellKey> {
  return new Set(list.map(([r, c]) => cellKey(r, c)));
}

/** 两个格子集合是不是同一块图形（作图题的判定基石） */
export function sameCells(a: Iterable<CellKey>, b: Iterable<CellKey>): boolean {
  const sa = a instanceof Set ? a : new Set(a);
  const sb = b instanceof Set ? b : new Set(b);
  if (sa.size !== sb.size) return false;
  for (const k of sa) if (!sb.has(k)) return false;
  return true;
}

/** 排好序的 key 列表（比较与快照用，结果稳定） */
export function sortedCells(cells: Iterable<CellKey>): CellKey[] {
  return [...cells].sort((a, b) => {
    const pa = parseCellKey(a);
    const pb = parseCellKey(b);
    return pa.r - pb.r || pa.c - pb.c;
  });
}

/** 面积就是格子数（每格 1 平方厘米） */
export function polyominoArea(cells: Iterable<CellKey>): number {
  return (cells instanceof Set ? cells : new Set(cells)).size;
}

/**
 * 周长 = 每个格子 4 条边，减去每一对相邻格子共用的那 2 条。
 * 图形里有洞时算的是「全部边界」（外圈 + 洞圈），出题只用无洞图形。
 */
export function polyominoPerimeter(cells: Iterable<CellKey>): number {
  const set = cells instanceof Set ? cells : new Set(cells);
  let shared = 0;
  for (const key of set) {
    const { r, c } = parseCellKey(key);
    if (set.has(cellKey(r, c + 1))) shared++;
    if (set.has(cellKey(r + 1, c))) shared++;
  }
  return set.size * 4 - shared * 2;
}

/** 四连通是不是连成一块 */
export function isConnected(cells: Iterable<CellKey>): boolean {
  const set = cells instanceof Set ? cells : new Set(cells);
  if (set.size === 0) return false;
  const start = [...set][0];
  const seen = new Set<CellKey>([start]);
  const queue = [start];
  while (queue.length) {
    const { r, c } = parseCellKey(queue.pop() as CellKey);
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const k = cellKey(r + dr, c + dc);
      if (set.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push(k);
      }
    }
  }
  return seen.size === set.size;
}

/** 把图形平移到左上角贴边（比较形状时先归一化，位置就不重要了） */
export function normalizeCells(cells: Iterable<CellKey>): Set<CellKey> {
  const list = [...cells].map(parseCellKey);
  if (list.length === 0) return new Set();
  const minR = Math.min(...list.map((p) => p.r));
  const minC = Math.min(...list.map((p) => p.c));
  return new Set(list.map((p) => cellKey(p.r - minR, p.c - minC)));
}

/** 任意形状顺时针转 90°（不像 `rotateCells` 那样要求方阵） */
export function rotateCellSetCW(cells: Iterable<CellKey>): Set<CellKey> {
  const out = new Set<CellKey>();
  for (const key of cells) {
    const { r, c } = parseCellKey(key);
    out.add(cellKey(c, -r));
  }
  return normalizeCells(out);
}

/** 任意形状左右翻转 */
export function mirrorCellSetH(cells: Iterable<CellKey>): Set<CellKey> {
  const out = new Set<CellKey>();
  for (const key of cells) {
    const { r, c } = parseCellKey(key);
    out.add(cellKey(r, -c));
  }
  return normalizeCells(out);
}

/** 平移 */
export function translateCells(cells: Iterable<CellKey>, dr: number, dc: number): Set<CellKey> {
  const out = new Set<CellKey>();
  for (const key of cells) {
    const { r, c } = parseCellKey(key);
    out.add(cellKey(r + dr, c + dc));
  }
  return out;
}

/** 一块骨牌的 8 种摆法（4 个旋转 × 是否翻面），已按归一化去重 */
export function pieceOrientations(cells: Iterable<CellKey>): Set<CellKey>[] {
  const out: Set<CellKey>[] = [];
  const seen = new Set<string>();
  let cur = normalizeCells(cells);
  for (let flip = 0; flip < 2; flip++) {
    for (let q = 0; q < 4; q++) {
      const key = sortedCells(cur).join(" ");
      if (!seen.has(key)) {
        seen.add(key);
        out.push(new Set(cur));
      }
      cur = rotateCellSetCW(cur);
    }
    cur = mirrorCellSetH(cur);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 常见图形的格子集合（公式和第一性原理要能互相验算）
// ---------------------------------------------------------------------------

/** w 列 × h 行的长方形 */
export function rectCells(w: number, h: number): Set<CellKey> {
  const out = new Set<CellKey>();
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) out.add(cellKey(r, c));
  return out;
}

/** 长方形缺掉**右上角**一块（缺口宽 cutW、高 cutH），也就是 L 形 */
export function lShapeCells(w: number, h: number, cutW: number, cutH: number): Set<CellKey> {
  const out = rectCells(w, h);
  for (let r = 0; r < cutH; r++) {
    for (let c = w - cutW; c < w; c++) out.delete(cellKey(r, c));
  }
  return out;
}

/**
 * 长方形上边**中间**啃掉一个凹槽（左边留 atC 列）。
 * 和缺角不一样：凹槽会把周长撑大，这正是 1.1 那个 `lShapePerimeter` 表达不了的情形。
 */
export function notchCells(w: number, h: number, notchW: number, notchH: number, atC: number): Set<CellKey> {
  const out = rectCells(w, h);
  for (let r = 0; r < notchH; r++) {
    for (let c = atC; c < atC + notchW; c++) out.delete(cellKey(r, c));
  }
  return out;
}

/** 凹槽在边中间时的周长：比原长方形多出凹槽两侧的两条竖边 */
export function notchPerimeter(w: number, h: number, notchH: number): number {
  return 2 * (w + h) + 2 * notchH;
}

/** 两块不重叠的长方形拼起来的组合图形面积 */
export function compositeArea(parts: readonly { w: number; h: number }[]): number {
  return parts.reduce((s, p) => s + p.w * p.h, 0);
}

/** 「上面一块 + 下面一块」的组合图形（上块靠左对齐），用来出三步走的面积题 */
export function stackedCells(topW: number, topH: number, bottomW: number, bottomH: number): Set<CellKey> {
  const out = new Set<CellKey>();
  for (let r = 0; r < topH; r++) for (let c = 0; c < topW; c++) out.add(cellKey(r, c));
  for (let r = 0; r < bottomH; r++) for (let c = 0; c < bottomW; c++) out.add(cellKey(topH + r, c));
  return out;
}

// ---------------------------------------------------------------------------
// 对称轴：数值求解，用来反过来校验写死的对称轴条数表
// ---------------------------------------------------------------------------

export interface Pt {
  x: number;
  y: number;
}

/** 正多边形的顶点（第一个顶点在正上方） */
export function regularPolygonPoints(n: number, cx: number, cy: number, r: number): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

/** 正 n 角星的顶点（外顶点与内顶点交替，第一个外顶点在正上方） */
export function starPoints(n: number, cx: number, cy: number, outer: number, inner: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 === 0 ? outer : inner;
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return out;
}

/** 正 n 角星的内接半径：让五个角看起来是标准五角星 */
export function starInnerRadius(n: number, outer: number): number {
  return (outer * Math.cos(Math.PI / n)) / Math.cos(Math.PI / (2 * n));
}

function centroid(pts: readonly Pt[]): Pt {
  const n = pts.length;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / n,
    y: pts.reduce((s, p) => s + p.y, 0) / n,
  };
}

/** 把点集按某条过重心、方向为 (dx, dy) 的直线镜像后，是不是还是同一个点集 */
function mirrorsOnto(pts: readonly Pt[], c: Pt, dx: number, dy: number, eps: number): boolean {
  const len = Math.hypot(dx, dy);
  if (len < eps) return false;
  const ux = dx / len;
  const uy = dy / len;
  const used = new Array<boolean>(pts.length).fill(false);
  for (const p of pts) {
    const vx = p.x - c.x;
    const vy = p.y - c.y;
    const dot = vx * ux + vy * uy;
    const mx = c.x + 2 * dot * ux - vx;
    const my = c.y + 2 * dot * uy - vy;
    let hit = -1;
    for (let i = 0; i < pts.length; i++) {
      if (used[i]) continue;
      if (Math.abs(pts[i].x - mx) < eps && Math.abs(pts[i].y - my) < eps) {
        hit = i;
        break;
      }
    }
    if (hit < 0) return false;
    used[hit] = true;
  }
  return true;
}

/**
 * 多边形有几条对称轴（数值求解）。
 *
 * 对称轴一定过重心，而且一定穿过某个顶点或者某条边的中点，
 * 所以候选方向只有 2n 个；逐个镜像回去比对点集即可。
 */
export function countSymmetryAxes(pts: readonly Pt[], eps = 1e-6): number {
  const n = pts.length;
  if (n < 3) return 0;
  const c = centroid(pts);
  const angles: number[] = [];
  const push = (dx: number, dy: number): void => {
    if (Math.hypot(dx, dy) < eps) return;
    let a = Math.atan2(dy, dx);
    // 一条直线的两个方向是同一条轴：把角度折到 [0, π)
    a = ((a % Math.PI) + Math.PI) % Math.PI;
    if (!angles.some((b) => Math.abs(b - a) < 1e-6 || Math.abs(Math.abs(b - a) - Math.PI) < 1e-6)) {
      angles.push(a);
    }
  };
  for (let i = 0; i < n; i++) {
    push(pts[i].x - c.x, pts[i].y - c.y);
    const j = (i + 1) % n;
    push((pts[i].x + pts[j].x) / 2 - c.x, (pts[i].y + pts[j].y) / 2 - c.y);
  }
  let count = 0;
  for (const a of angles) {
    if (mirrorsOnto(pts, c, Math.cos(a), Math.sin(a), eps)) count++;
  }
  return count;
}

/** 多边形转 quarters 个 90°（绕重心，顺时针），旋转对称性检查用 */
export function rotatePoints(pts: readonly Pt[], quarters: number): Pt[] {
  const c = centroid(pts);
  const a = ((((Math.round(quarters) % 4) + 4) % 4) * Math.PI) / 2;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return pts.map((p) => ({
    x: c.x + (p.x - c.x) * cos - (p.y - c.y) * sin,
    y: c.y + (p.x - c.x) * sin + (p.y - c.y) * cos,
  }));
}

// ---------------------------------------------------------------------------
// 欧拉公式
// ---------------------------------------------------------------------------

/** 凸多面体的顶点 − 棱 + 面 = 2 */
export function eulerHolds(vertices: number, edges: number, faces: number): boolean {
  return vertices - edges + faces === 2;
}

/** 多面体的棱数也能由各面的边数推出来：每条棱正好被两个面共用 */
export function edgesFromFaceSides(faceSides: readonly number[]): number {
  const total = faceSides.reduce((s, n) => s + n, 0);
  return total / 2;
}
