// 花园守卫 —— 纯逻辑函数,不依赖 DOM,方便单独测试。

export type Vec = { x: number; y: number };

/** 路径拐点(格子坐标),怪物从第一个点走到最后一个点(花朵所在)。 */
export const PATH_CORNERS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [6, 1],
  [6, 3],
  [1, 3],
  [1, 5],
  [8, 5],
];

export const GRID_COLS = 9;
export const GRID_ROWS = 6;

/** 拐点 → 格子中心坐标(单位:格)。 */
export function buildWaypoints(
  corners: ReadonlyArray<readonly [number, number]> = PATH_CORNERS,
): Vec[] {
  return corners.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
}

/** 折线总长度(单位:格)。 */
export function pathLength(pts: Vec[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

/** 沿折线走 dist 格后的位置;走完则 done=true 并停在终点。 */
export function pointAlongPath(
  pts: Vec[],
  dist: number,
): { x: number; y: number; done: boolean } {
  if (dist <= 0) return { x: pts[0].x, y: pts[0].y, done: false };
  let remaining = dist;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg) {
      const t = remaining / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, done: false };
    }
    remaining -= seg;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, done: true };
}

/** 路径覆盖到的所有格子("col,row" 集合),这些格子不能放塔。 */
export function pathCellSet(
  corners: ReadonlyArray<readonly [number, number]> = PATH_CORNERS,
): Set<string> {
  const cells = new Set<string>();
  for (let i = 1; i < corners.length; i++) {
    const [c1, r1] = corners[i - 1];
    const [c2, r2] = corners[i];
    const dc = Math.sign(c2 - c1);
    const dr = Math.sign(r2 - r1);
    let c = c1;
    let r = r1;
    cells.add(`${c},${r}`);
    while (c !== c2 || r !== r2) {
      c += dc;
      r += dr;
      cells.add(`${c},${r}`);
    }
  }
  return cells;
}

/** 这个格子能不能放塔。 */
export function canPlace(
  col: number,
  row: number,
  blocked: ReadonlySet<string>,
  occupied: ReadonlySet<string>,
): boolean {
  if (col < 0 || row < 0 || col >= GRID_COLS || row >= GRID_ROWS) return false;
  const key = `${col},${row}`;
  return !blocked.has(key) && !occupied.has(key);
}

/** 挑选射程内"走得最远"的怪物下标;没有则返回 -1。 */
export function pickTarget(
  monsters: ReadonlyArray<{ x: number; y: number; dist: number; hp: number }>,
  tx: number,
  ty: number,
  range: number,
): number {
  let best = -1;
  let bestDist = -1;
  for (let i = 0; i < monsters.length; i++) {
    const m = monsters[i];
    if (m.hp <= 0) continue;
    if (Math.hypot(m.x - tx, m.y - ty) <= range && m.dist > bestDist) {
      best = i;
      bestDist = m.dist;
    }
  }
  return best;
}
