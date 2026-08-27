/**
 * 豆豆迷宫 · 格子地图纯逻辑。
 *
 * 地图用字符网格描述：`#` 墙、`.` 普通豆、`o` 能量豆、`-` 隧道口、空格是空通路。
 * 所有函数都是纯函数，不碰 DOM，方便单测。
 */

export type Dir = "up" | "down" | "left" | "right";

export const DIRS: readonly Dir[] = ["up", "right", "down", "left"];

export const DELTA: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
};

/** 反向 */
export const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export interface Cell {
  x: number;
  y: number;
}

export interface Maze {
  w: number;
  h: number;
  /** 长度 w*h：true 表示墙 */
  wall: boolean[];
  /** 长度 w*h：true 表示还有一颗普通豆 */
  dot: boolean[];
  /** 长度 w*h：true 表示能量豆 */
  power: boolean[];
  /** 左右相通的行号（这些行的最左最右两格是隧道口） */
  tunnelRows: number[];
  /** 玩家出生格 */
  spawn: Cell;
  /** 小幽灵的巢（回家点） */
  home: Cell;
}

/** 转向输入缓冲窗口：提前 200ms 按下的转向指令依然算数 */
export const TURN_BUFFER_MS = 200;

/** 穿隧道时的速度倍率（比在迷宫里慢一点，给追逐留出空间） */
export const TUNNEL_SPEED_SCALE = 0.6;

export function cellIndex(maze: Pick<Maze, "w">, x: number, y: number): number {
  return y * maze.w + x;
}

export function inBounds(maze: Maze, x: number, y: number): boolean {
  return x >= 0 && x < maze.w && y >= 0 && y < maze.h;
}

/** 这一行是不是左右相通的隧道行 */
export function isTunnelRow(maze: Maze, y: number): boolean {
  return maze.tunnelRows.includes(y);
}

/**
 * 越过左右边界时从另一侧出来（只在隧道行成立）。
 * 上下永远不环绕，越界的坐标夹回地图内。
 */
export function wrapTunnel(maze: Maze, x: number, y: number): Cell {
  const yy = Math.max(0, Math.min(maze.h - 1, y));
  if (!isTunnelRow(maze, yy)) {
    return { x: Math.max(0, Math.min(maze.w - 1, x)), y: yy };
  }
  let xx = x;
  while (xx < 0) xx += maze.w;
  while (xx >= maze.w) xx -= maze.w;
  return { x: xx, y: yy };
}

export function isWall(maze: Maze, x: number, y: number): boolean {
  if (!inBounds(maze, x, y)) return true;
  return maze.wall[cellIndex(maze, x, y)];
}

/** 从 cell 沿 dir 走一格之后的格子（自动处理隧道环绕） */
export function stepCell(maze: Maze, cell: Cell, dir: Dir): Cell {
  const d = DELTA[dir];
  return wrapTunnel(maze, cell.x + d.dx, cell.y + d.dy);
}

/** 站在 cell 上能不能朝 dir 转向：目标格必须是通路 */
export function canTurn(maze: Maze, cell: Cell, dir: Dir): boolean {
  const d = DELTA[dir];
  const nx = cell.x + d.dx;
  const ny = cell.y + d.dy;
  if (ny < 0 || ny >= maze.h) return false;
  if ((nx < 0 || nx >= maze.w) && !isTunnelRow(maze, cell.y)) return false;
  const t = wrapTunnel(maze, nx, ny);
  return !isWall(maze, t.x, t.y);
}

/** cell 上所有能走出去的方向 */
export function openDirs(maze: Maze, cell: Cell): Dir[] {
  return DIRS.filter((d) => canTurn(maze, cell, d));
}

/** 交叉口：能走的方向 ≥ 3，或者是拐角（两个方向但不共线） */
export function isJunction(maze: Maze, cell: Cell): boolean {
  const dirs = openDirs(maze, cell);
  if (dirs.length >= 3) return true;
  if (dirs.length === 2) return OPPOSITE[dirs[0]] !== dirs[1];
  return false;
}

/** 已缓存的转向指令 */
export interface TurnBuffer {
  dir: Dir | null;
  /** 按下时刻（ms） */
  at: number;
}

export function emptyBuffer(): TurnBuffer {
  return { dir: null, at: -Infinity };
}

/**
 * 输入缓冲：提前按下的转向在 TURN_BUFFER_MS 内到达可转的格子依旧生效。
 * 返回本帧应该采用的方向；没有可用缓冲时返回 null。
 */
export function bufferedTurn(
  maze: Maze,
  cell: Cell,
  buf: TurnBuffer,
  now: number,
  windowMs: number = TURN_BUFFER_MS
): Dir | null {
  if (!buf.dir) return null;
  if (now - buf.at > windowMs) return null;
  return canTurn(maze, cell, buf.dir) ? buf.dir : null;
}

/** 场上还剩多少颗豆（含能量豆） */
export function dotsLeft(maze: Maze): number {
  let n = 0;
  for (let i = 0; i < maze.dot.length; i++) {
    if (maze.dot[i] || maze.power[i]) n++;
  }
  return n;
}

/** 从 start 出发能走到的全部通路格 */
export function floodFill(maze: Maze, start: Cell): boolean[] {
  const seen = new Array<boolean>(maze.w * maze.h).fill(false);
  if (isWall(maze, start.x, start.y)) return seen;
  const queue: Cell[] = [start];
  seen[cellIndex(maze, start.x, start.y)] = true;
  // 用游标代替 shift()，188 关批量生成时别把复杂度拖到 O(n²)
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    for (const d of DIRS) {
      if (!canTurn(maze, cur, d)) continue;
      const next = stepCell(maze, cur, d);
      const i = cellIndex(maze, next.x, next.y);
      if (seen[i]) continue;
      seen[i] = true;
      queue.push(next);
    }
  }
  return seen;
}

/** 从 start 出发能吃到的豆子数（含能量豆）。等于 dotsLeft 才说明这张图可以清空 */
export function reachableDots(maze: Maze, start: Cell = maze.spawn): number {
  const seen = floodFill(maze, start);
  let n = 0;
  for (let i = 0; i < seen.length; i++) {
    if (!seen[i]) continue;
    if (maze.dot[i] || maze.power[i]) n++;
  }
  return n;
}

/** 墙体是否封闭：除隧道行的两个开口外，边框必须全是墙 */
export function isEnclosed(maze: Maze): boolean {
  for (let x = 0; x < maze.w; x++) {
    if (!isWall(maze, x, 0) || !isWall(maze, x, maze.h - 1)) return false;
  }
  for (let y = 0; y < maze.h; y++) {
    const tunnel = isTunnelRow(maze, y);
    const left = isWall(maze, 0, y);
    const right = isWall(maze, maze.w - 1, y);
    if (tunnel) {
      if (left || right) return false;
    } else if (!left || !right) {
      return false;
    }
  }
  return true;
}

/** 把字符网格解析成 Maze */
export function parseMaze(rows: readonly string[]): Maze {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const wall = new Array<boolean>(w * h).fill(true);
  const dot = new Array<boolean>(w * h).fill(false);
  const power = new Array<boolean>(w * h).fill(false);
  const tunnelRows: number[] = [];
  let spawn: Cell = { x: 1, y: 1 };
  let home: Cell = { x: 1, y: 1 };
  for (let y = 0; y < h; y++) {
    const row = rows[y].padEnd(w, "#");
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      const i = y * w + x;
      if (ch === "#") continue;
      wall[i] = false;
      if (ch === ".") dot[i] = true;
      else if (ch === "o") power[i] = true;
      else if (ch === "-") {
        if (!tunnelRows.includes(y)) tunnelRows.push(y);
      } else if (ch === "S") spawn = { x, y };
      else if (ch === "H") home = { x, y };
    }
  }
  return { w, h, wall, dot, power, tunnelRows, spawn, home };
}

/** 把 Maze 画回字符网格（调试与测试用） */
export function renderMaze(maze: Maze): string[] {
  const out: string[] = [];
  for (let y = 0; y < maze.h; y++) {
    let row = "";
    for (let x = 0; x < maze.w; x++) {
      const i = cellIndex(maze, x, y);
      if (maze.wall[i]) row += "#";
      else if (maze.power[i]) row += "o";
      else if (maze.dot[i]) row += ".";
      else if (isTunnelRow(maze, y) && (x === 0 || x === maze.w - 1)) row += "-";
      else row += " ";
    }
    out.push(row);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 地图生成器：先铺一张一定连通的「柱子格网」，再挑不会切断通路的位置加墙
// ---------------------------------------------------------------------------

function rng32(seed: number): () => number {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MazeOptions {
  /** 奇数宽（会自动向上取奇数），建议 15–25 */
  w: number;
  /** 奇数高（会自动向上取奇数），建议 11–19 */
  h: number;
  /** 额外加墙的比例 0–1，越大越绕 */
  density: number;
  /** 隧道条数 0–3 */
  tunnels: number;
  /** 能量豆数量 0–4 */
  powerPellets: number;
}

function toOdd(n: number, min: number): number {
  const v = Math.max(min, Math.round(n));
  return v % 2 === 0 ? v + 1 : v;
}

/**
 * 生成一张一定可以清空的迷宫：
 *  1. 边框全墙，内部先按「偶数行 × 偶数列放柱子」铺成格网 —— 奇数行与奇数列天然全通，必然连通；
 *  2. 按 seed 随机挑内部格子加墙，每加一块都做一次连通性检查，切断通路就撤销；
 *  3. 剩下的通路格全部撒豆，四角附近换成能量豆，出生点与巢穴不放豆。
 */
export function buildMaze(seed: number, opts: MazeOptions): Maze {
  const w = toOdd(opts.w, 11);
  const h = toOdd(opts.h, 9);
  const wall = new Array<boolean>(w * h).fill(false);
  const at = (x: number, y: number): number => y * w + x;

  for (let x = 0; x < w; x++) {
    wall[at(x, 0)] = true;
    wall[at(x, h - 1)] = true;
  }
  for (let y = 0; y < h; y++) {
    wall[at(0, y)] = true;
    wall[at(w - 1, y)] = true;
  }
  for (let y = 2; y < h - 1; y += 2) {
    for (let x = 2; x < w - 1; x += 2) {
      wall[at(x, y)] = true;
    }
  }

  const tunnelRows: number[] = [];
  const maxTunnels = Math.max(0, Math.min(3, Math.round(opts.tunnels)));
  const candidateRows: number[] = [];
  const mid = h % 2 === 1 ? Math.floor(h / 2) : Math.floor(h / 2) + 1;
  for (const y of [mid, mid - 2, mid + 2, 1, h - 2]) {
    if (y > 0 && y < h - 1 && y % 2 === 1 && !candidateRows.includes(y)) candidateRows.push(y);
  }
  for (let i = 0; i < maxTunnels && i < candidateRows.length; i++) {
    const y = candidateRows[i];
    tunnelRows.push(y);
    wall[at(0, y)] = false;
    wall[at(w - 1, y)] = false;
  }

  const spawn: Cell = { x: 1, y: h - 2 };
  const home: Cell = { x: mid % 2 === 1 ? Math.floor(w / 2) : Math.floor(w / 2) + 1, y: mid };
  if (home.x % 2 === 0) home.x -= 1;
  wall[at(home.x, home.y)] = false;
  wall[at(spawn.x, spawn.y)] = false;

  const base: Maze = {
    w,
    h,
    wall,
    dot: new Array<boolean>(w * h).fill(false),
    power: new Array<boolean>(w * h).fill(false),
    tunnelRows,
    spawn,
    home,
  };

  // 候选加墙点：内部的奇偶混合格（不能动出生点、巢穴、隧道行的开口通道）
  const candidates: Cell[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (wall[at(x, y)]) continue;
      if (x === spawn.x && y === spawn.y) continue;
      if (x === home.x && y === home.y) continue;
      if (tunnelRows.includes(y) && (x <= 1 || x >= w - 2)) continue;
      candidates.push({ x, y });
    }
  }
  const rand = rng32(seed);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const want = Math.floor(candidates.length * Math.max(0, Math.min(0.6, opts.density)));
  let added = 0;
  for (const c of candidates) {
    if (added >= want) break;
    const i = at(c.x, c.y);
    wall[i] = true;
    const seen = floodFill(base, spawn);
    let ok = true;
    for (let k = 0; k < wall.length && ok; k++) {
      if (!wall[k] && !seen[k]) ok = false;
    }
    if (ok) added++;
    else wall[i] = false;
  }

  // 撒豆
  const openCells: Cell[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      if (wall[at(x, y)]) continue;
      if (tunnelRows.includes(y) && (x === 0 || x === w - 1)) continue;
      if (x === spawn.x && y === spawn.y) continue;
      if (x === home.x && y === home.y) continue;
      base.dot[at(x, y)] = true;
      openCells.push({ x, y });
    }
  }

  const corners: Cell[] = [
    { x: 1, y: 1 },
    { x: w - 2, y: 1 },
    { x: 1, y: h - 2 },
    { x: w - 2, y: h - 2 },
  ];
  let placed = 0;
  const wantPower = Math.max(0, Math.min(4, Math.round(opts.powerPellets)));
  for (const corner of corners) {
    if (placed >= wantPower) break;
    let best: Cell | null = null;
    let bestD = Infinity;
    for (const c of openCells) {
      if (!base.dot[at(c.x, c.y)]) continue;
      const d = Math.abs(c.x - corner.x) + Math.abs(c.y - corner.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) {
      base.dot[at(best.x, best.y)] = false;
      base.power[at(best.x, best.y)] = true;
      placed++;
    }
  }

  return base;
}
