// 泡泡瞄准纯逻辑：六边形错位网格（支持整体下降换奇偶）、连消、悬空掉落、
// 弹道反射（墙壁 + 云挡板）、黑洞吞噬、石泡两击、彩虹百搭。不依赖 DOM。

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
/** 黑洞吞噬半径 */
export const HOLE_R = 24;

/** 彩虹泡：跟任何颜色都算同色 */
export const RAINBOW = "W";
/** 石泡：不参与连消，被弹道直接命中两次才碎（S→T→碎） */
export const STONE = "S";
/** 裂开的石泡（再命中一次就碎） */
export const STONE_CRACKED = "T";

export type Cell = string | null;

/**
 * 网格：rows 存内容，flip 表示几何奇偶偏移。
 * 整体下降一行时 flip 翻转，原有泡泡的横向位置保持不变。
 */
export interface Grid {
  rows: Cell[][];
  flip: number;
}

export interface CloudDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HoleDef {
  x: number;
  y: number;
}

export interface Obstacles {
  clouds?: CloudDef[];
  holes?: HoleDef[];
}

/** 某行的格子数：长行 9 个，短行右移半格 8 个 */
export function rowLen(flip: number, r: number): number {
  return (r + flip) % 2 === 0 ? COLS : COLS - 1;
}

export function rowLength(g: Grid, r: number): number {
  return rowLen(g.flip, r);
}

export function cellCenter(g: Grid, r: number, c: number): { x: number; y: number } {
  const margin = (W - COLS * 2 * R) / 2;
  const offset = (r + g.flip) % 2 === 0 ? 0 : R;
  return {
    x: margin + R + offset + c * 2 * R,
    y: TOP + R + r * ROW_H,
  };
}

export function inGrid(g: Grid, r: number, c: number): boolean {
  return r >= 0 && r < g.rows.length && c >= 0 && c < rowLength(g, r);
}

/** 六边形邻居（短行相对长行右移半格） */
export function neighbors(g: Grid, r: number, c: number): Array<[number, number]> {
  const out: Array<[number, number]> = [
    [r, c - 1],
    [r, c + 1],
  ];
  if ((r + g.flip) % 2 === 0) {
    // 长行：上下的短行在 c-1 和 c
    out.push([r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]);
  } else {
    // 短行：上下的长行在 c 和 c+1
    out.push([r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]);
  }
  return out.filter(([rr, cc]) => inGrid(g, rr, cc));
}

/** 单行字符串解析（'.' 为空） */
function parseRow(row: string, need: number, rowIndex: number): Cell[] {
  if (row.length !== need) {
    throw new Error(`第 ${rowIndex} 行应有 ${need} 个字符，实际 ${row.length}`);
  }
  return Array.from(row, (ch) => (ch === "." ? null : ch));
}

/**
 * 把关卡布局字符串解析成网格并补足空行。
 * 起始 flip=0：偶数行 9 个字符、奇数行 8 个字符。
 */
export function parseLayout(rows: string[]): Grid {
  const g: Grid = { rows: [], flip: 0 };
  rows.forEach((row, r) => {
    g.rows.push(parseRow(row, rowLen(0, r), r));
  });
  while (g.rows.length < MAX_ROWS) {
    g.rows.push(new Array<Cell>(rowLen(0, g.rows.length)).fill(null));
  }
  return g;
}

/**
 * 整体下降一行：顶部插入新行，flip 翻转。
 * 原有行的几何位置正好整体往下移一行，横向不动。
 * 新行字符串长度必须匹配翻转后的顶行长度（8/9 交替）。
 */
export function descend(g: Grid, rowStr: string): void {
  const newFlip = g.flip ^ 1;
  const row = parseRow(rowStr, rowLen(newFlip, 0), 0);
  g.flip = newFlip;
  g.rows.unshift(row);
}

/** 石泡？ */
export function isStone(cell: Cell): boolean {
  return cell === STONE || cell === STONE_CRACKED;
}

/** 需要清空才能过关的泡泡（彩色 + 彩虹；石泡不算） */
export function isClearable(cell: Cell): boolean {
  return cell !== null && !isStone(cell);
}

/** 同色连通块（彩虹算百搭；起点必须是普通颜色） */
export function floodSameColor(g: Grid, r: number, c: number): Array<[number, number]> {
  const color = g.rows[r]?.[c];
  if (!color || isStone(color) || color === RAINBOW) return [];
  const match = (cell: Cell): boolean => cell === color || cell === RAINBOW;
  const seen = new Set<string>([`${r},${c}`]);
  const queue: Array<[number, number]> = [[r, c]];
  const out: Array<[number, number]> = [];
  while (queue.length > 0) {
    const [cr, cc] = queue.pop()!;
    out.push([cr, cc]);
    for (const [nr, nc] of neighbors(g, cr, cc)) {
      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;
      if (!match(g.rows[nr]?.[nc] ?? null)) continue;
      seen.add(key);
      queue.push([nr, nc]);
    }
  }
  return out;
}

/** 没有连到顶行的悬空泡泡（石泡也会掉） */
export function findFloating(g: Grid): Array<[number, number]> {
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [];
  for (let c = 0; c < rowLength(g, 0); c++) {
    if (g.rows[0][c]) {
      seen.add(`0,${c}`);
      queue.push([0, c]);
    }
  }
  while (queue.length > 0) {
    const [cr, cc] = queue.pop()!;
    for (const [nr, nc] of neighbors(g, cr, cc)) {
      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;
      if (!g.rows[nr]?.[nc]) continue;
      seen.add(key);
      queue.push([nr, nc]);
    }
  }
  const floating: Array<[number, number]> = [];
  for (let r = 0; r < g.rows.length; r++) {
    for (let c = 0; c < rowLength(g, r); c++) {
      if (g.rows[r][c] && !seen.has(`${r},${c}`)) floating.push([r, c]);
    }
  }
  return floating;
}

/** 还剩多少需要清掉的泡泡（不含石泡） */
export function countBubbles(g: Grid): number {
  let n = 0;
  for (const row of g.rows) for (const cell of row) if (isClearable(cell)) n++;
  return n;
}

/** 石泡数量 */
export function countStones(g: Grid): number {
  let n = 0;
  for (const row of g.rows) for (const cell of row) if (isStone(cell)) n++;
  return n;
}

/** 网格里出现过的普通颜色（射出的泡泡只从这里挑） */
export function colorsInGrid(g: Grid): string[] {
  const set = new Set<string>();
  for (const row of g.rows) {
    for (const cell of row) {
      if (cell && !isStone(cell) && cell !== RAINBOW) set.add(cell);
    }
  }
  return Array.from(set);
}

export interface ShotResult {
  /** 弹道折线（起点、每次反弹点、终点），画虚线用 */
  path: Array<{ x: number; y: number }>;
  /** 吸附落位；打不到/被吞/命中石泡则为 null */
  landing: { r: number; c: number } | null;
  /** 第一个直接碰到的格子（命中石泡时用来扣血） */
  hitCell: { r: number; c: number } | null;
  /** 被黑洞吞掉 */
  swallowed: boolean;
}

/**
 * 从 (sx,sy) 沿方向 (dx,dy) 发射：碰左右墙和云挡板反弹，
 * 遇到黑洞被吞，碰到石泡直接命中（不吸附），碰到泡泡或顶就吸附。
 * 同一个函数既算瞄准虚线又算真实飞行，保证"指哪打哪"。
 */
export function simulateShot(
  g: Grid,
  sx: number,
  sy: number,
  dx: number,
  dy: number,
  obs: Obstacles = {}
): ShotResult {
  const len = Math.hypot(dx, dy) || 1;
  let vx = dx / len;
  let vy = dy / len;
  let x = sx;
  let y = sy;
  const path: Array<{ x: number; y: number }> = [{ x, y }];
  const step = 3;
  const clouds = obs.clouds ?? [];
  const holes = obs.holes ?? [];

  const occupied: Array<{ r: number; c: number; x: number; y: number }> = [];
  for (let r = 0; r < g.rows.length; r++) {
    for (let c = 0; c < rowLength(g, r); c++) {
      if (g.rows[r][c]) occupied.push({ r, c, ...cellCenter(g, r, c) });
    }
  }

  for (let i = 0; i < 1600; i++) {
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

    // 云挡板：像墙一样反弹
    for (const cl of clouds) {
      if (
        x > cl.x - R && x < cl.x + cl.w + R &&
        y > cl.y - R && y < cl.y + cl.h + R
      ) {
        const dl = x - (cl.x - R);
        const dr = cl.x + cl.w + R - x;
        const dt = y - (cl.y - R);
        const db = cl.y + cl.h + R - y;
        const m = Math.min(dl, dr, dt, db);
        if (m === dt) {
          y = cl.y - R;
          vy = -Math.abs(vy);
        } else if (m === db) {
          y = cl.y + cl.h + R;
          vy = Math.abs(vy);
        } else if (m === dl) {
          x = cl.x - R;
          vx = -Math.abs(vx);
        } else {
          x = cl.x + cl.w + R;
          vx = Math.abs(vx);
        }
        path.push({ x, y });
      }
    }

    // 黑洞：吞掉
    for (const hole of holes) {
      if (Math.hypot(x - hole.x, y - hole.y) < HOLE_R) {
        path.push({ x: hole.x, y: hole.y });
        return { path, landing: null, hitCell: null, swallowed: true };
      }
    }

    let hitTop = y <= TOP + R;
    let hitCell: { r: number; c: number } | null = null;
    if (!hitTop) {
      for (const o of occupied) {
        const dist = Math.hypot(x - o.x, y - o.y);
        if (dist < R * 2 - 3) {
          hitCell = { r: o.r, c: o.c };
          break;
        }
      }
    }
    if (hitTop || hitCell) {
      path.push({ x, y });
      // 直接命中石泡：不吸附，弹开消失（游戏里扣石泡血）
      if (hitCell && isStone(g.rows[hitCell.r][hitCell.c])) {
        return { path, landing: null, hitCell, swallowed: false };
      }
      const landing = snapCell(g, x, y);
      if (landing) {
        const cc = cellCenter(g, landing.r, landing.c);
        path[path.length - 1] = { x: cc.x, y: cc.y };
      }
      return { path, landing, hitCell, swallowed: false };
    }
  }
  path.push({ x, y });
  return { path, landing: null, hitCell: null, swallowed: false };
}

/** 找离碰撞点最近的合法空格（顶行或贴着已有泡泡） */
export function snapCell(g: Grid, x: number, y: number): { r: number; c: number } | null {
  let best: { r: number; c: number } | null = null;
  let bestDist = Infinity;
  for (let r = 0; r < g.rows.length; r++) {
    for (let c = 0; c < rowLength(g, r); c++) {
      if (g.rows[r][c]) continue;
      const anchored = r === 0 || neighbors(g, r, c).some(([nr, nc]) => g.rows[nr][nc]);
      if (!anchored) continue;
      const cc = cellCenter(g, r, c);
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
  popped: Array<{ r: number; c: number; color: string }>;
  dropped: Array<{ r: number; c: number; color: string }>;
}

/**
 * 落位后结算：同色（含彩虹百搭）≥3 就消，再让悬空的掉下来。直接改 grid。
 */
export function settleShot(g: Grid, r: number, c: number): SettleResult {
  const popped: SettleResult["popped"] = [];
  const dropped: SettleResult["dropped"] = [];
  const match = floodSameColor(g, r, c);
  if (match.length >= 3) {
    for (const [mr, mc] of match) {
      popped.push({ r: mr, c: mc, color: g.rows[mr][mc]! });
      g.rows[mr][mc] = null;
    }
    for (const [fr, fc] of findFloating(g)) {
      dropped.push({ r: fr, c: fc, color: g.rows[fr][fc]! });
      g.rows[fr][fc] = null;
    }
  }
  return { popped, dropped };
}

export type StoneHitResult = "cracked" | "broken" | "none";

/**
 * 石泡被直接命中：第一次裂开，第二次碎掉（碎后悬空的一起掉）。
 * 返回结果与掉落列表。
 */
export function damageStone(
  g: Grid,
  r: number,
  c: number
): { result: StoneHitResult; dropped: SettleResult["dropped"] } {
  const cell = g.rows[r]?.[c];
  if (cell === STONE) {
    g.rows[r][c] = STONE_CRACKED;
    return { result: "cracked", dropped: [] };
  }
  if (cell === STONE_CRACKED) {
    g.rows[r][c] = null;
    const dropped: SettleResult["dropped"] = [];
    for (const [fr, fc] of findFloating(g)) {
      dropped.push({ r: fr, c: fc, color: g.rows[fr][fc]! });
      g.rows[fr][fc] = null;
    }
    return { result: "broken", dropped };
  }
  return { result: "none", dropped: [] };
}

/**
 * 场上已经没有普通颜色时，剩下的彩虹泡自动欢快地飞走
 * （否则没有同色弹药可配对）。返回弹出的彩虹泡。
 */
export function releaseLoneRainbows(g: Grid): SettleResult["popped"] {
  if (colorsInGrid(g).length > 0) return [];
  const out: SettleResult["popped"] = [];
  for (let r = 0; r < g.rows.length; r++) {
    for (let c = 0; c < rowLength(g, r); c++) {
      if (g.rows[r][c] === RAINBOW) {
        out.push({ r, c, color: RAINBOW });
        g.rows[r][c] = null;
      }
    }
  }
  if (out.length > 0) {
    for (const [fr, fc] of findFloating(g)) {
      out.push({ r: fr, c: fc, color: g.rows[fr][fc]! });
      g.rows[fr][fc] = null;
    }
  }
  return out;
}

/** 是否有泡泡越过失败线 */
export function crossedDeadline(g: Grid): boolean {
  for (let r = DEADLINE_ROW; r < g.rows.length; r++) {
    for (let c = 0; c < rowLength(g, r); c++) {
      if (g.rows[r][c]) return true;
    }
  }
  return false;
}

/** 泡泡已经压到警戒线上一行(含更低):提前闪烁预警 */
export function nearDeadline(g: Grid): boolean {
  for (let r = DEADLINE_ROW - 1; r < g.rows.length; r++) {
    for (let c = 0; c < rowLength(g, r); c++) {
      if (g.rows[r][c]) return true;
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

/* ---------------- 结算朗读 ---------------- */
// 逐关结算不走 level99 浮层，识字量有限的孩子靠听。
// 纯函数便于测试；朗读本身走 speech.ts，无中文语音包时静默降级。

/** 过关时要朗读的整句话。 */
export function wonSpeechLine(stars: number): string {
  return `清空啦！得到 ${stars} 颗星，瞄得真准！`;
}

/** 失败时要朗读的整句话：先说原因，再温柔安抚。 */
export function failedSpeechLine(reason: string): string {
  return `${reason}没关系，点一下屏幕再来一次！`;
}
