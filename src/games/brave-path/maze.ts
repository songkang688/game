/**
 * 勇者小路 1.2 · 迷宫小路（纯函数，不碰 DOM）。
 *
 * 1.1 的关卡是一条线性小路（`levels.ts` 的 `PathNode[]`），没有真正的迷宫。
 * 1.2 补上一张**生成式迷宫**，给「无尽之路」的每一层和「同图竞速」用：
 *
 *  · 生成用递归回溯，产出的是完美迷宫（任意两格之间恰好一条路，天然连通）；
 *  · 迷宫里放一把钥匙和一扇门，门永远压在「起点 → 终点」的唯一通路上，
 *    钥匙永远放在「不经过门也走得到」的那一侧——所以每一张图都保证可解；
 *  · `validateMaze` 把上面这两条写成显式校验，随机 2000 张全部通过（见单测）。
 *
 * 坐标一律 [行, 列]，0 基；外圈永远是墙。
 */
import { cloneFighter, mulberry32, type Fighter } from "./combat";

export type Pt = [number, number];

export interface Maze {
  /** 含外墙的实际行列数（都是奇数） */
  rows: number;
  cols: number;
  /** walls[r][c] = true 表示这一格走不过去 */
  walls: boolean[][];
  start: Pt;
  exit: Pt;
  /** 钥匙格：不经过门就能走到 */
  key: Pt;
  /** 门格：不拿钥匙过不去 */
  door: Pt;
}

/** 迷宫的规模（内圈格子数），会被换算成 2n+1 的实际网格 */
export interface MazeSize {
  cells: number;
  cellRows: number;
}

const DIRS: Pt[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];

function samePt(a: Pt, b: Pt): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function ptKey(p: Pt): string {
  return `${p[0]},${p[1]}`;
}

function inside(m: Maze, r: number, c: number): boolean {
  return r >= 0 && r < m.rows && c >= 0 && c < m.cols;
}

/** 这一格能不能走（门当作墙时传 blockDoor） */
export function walkable(m: Maze, r: number, c: number, blockDoor = false): boolean {
  if (!inside(m, r, c)) return false;
  if (m.walls[r][c]) return false;
  if (blockDoor && r === m.door[0] && c === m.door[1]) return false;
  return true;
}

/**
 * 广度优先找最短路；走不到返回 null。
 * 返回的数组含起点与终点，相邻两格永远只差一步。
 */
export function shortestPath(m: Maze, from: Pt, to: Pt, blockDoor = false): Pt[] | null {
  if (!walkable(m, from[0], from[1], blockDoor) || !walkable(m, to[0], to[1], blockDoor)) return null;
  const prev = new Map<string, string | null>();
  prev.set(ptKey(from), null);
  const queue: Pt[] = [from];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (samePt(cur, to)) break;
    for (const [dr, dc] of DIRS) {
      const nr = cur[0] + dr;
      const nc = cur[1] + dc;
      if (!walkable(m, nr, nc, blockDoor)) continue;
      const key = `${nr},${nc}`;
      if (prev.has(key)) continue;
      prev.set(key, ptKey(cur));
      queue.push([nr, nc]);
    }
  }
  if (!prev.has(ptKey(to))) return null;
  const out: Pt[] = [];
  let cursor: string | null = ptKey(to);
  while (cursor) {
    const [r, c] = cursor.split(",").map(Number);
    out.push([r, c]);
    cursor = prev.get(cursor) ?? null;
  }
  return out.reverse();
}

/** 从某一格出发、不经过门时走得到的全部格子 */
export function reachableFrom(m: Maze, from: Pt, blockDoor = true): Pt[] {
  const seen = new Set<string>([ptKey(from)]);
  const queue: Pt[] = [from];
  const out: Pt[] = [from];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    for (const [dr, dc] of DIRS) {
      const nr = cur[0] + dr;
      const nc = cur[1] + dc;
      if (!walkable(m, nr, nc, blockDoor)) continue;
      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([nr, nc]);
      out.push([nr, nc]);
    }
  }
  return out;
}

/**
 * 递归回溯挖迷宫：从 (1,1) 出发，每次随机挑一个没访问过的邻居打通中间那堵墙。
 * 产出的是完美迷宫——没有环，任意两格之间恰好一条通路。
 */
function carve(rows: number, cols: number, rand: () => number): boolean[][] {
  const walls: boolean[][] = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(true));
  const stack: Pt[] = [[1, 1]];
  walls[1][1] = false;
  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];
    const options: Pt[] = [];
    for (const [dr, dc] of DIRS) {
      const nr = r + dr * 2;
      const nc = c + dc * 2;
      if (nr <= 0 || nr >= rows - 1 || nc <= 0 || nc >= cols - 1) continue;
      if (!walls[nr][nc]) continue;
      options.push([nr, nc]);
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [nr, nc] = options[Math.floor(rand() * options.length)];
    walls[(r + nr) / 2][(c + nc) / 2] = false;
    walls[nr][nc] = false;
    stack.push([nr, nc]);
  }
  return walls;
}

/**
 * 内圈格子数换算成实际网格边长（永远是奇数）。
 * 最少 2×2 内圈：再小就放不下「起点 / 钥匙 / 门 / 终点」四样东西。
 */
export function gridSpan(cells: number): number {
  const n = Math.max(2, Math.round(Number.isFinite(cells) ? cells : 2));
  return n * 2 + 1;
}

/**
 * 生成一张迷宫。同一个 seed + 同一个尺寸永远得到同一张图。
 * `cells` 是内圈格子数（横向），`cellRows` 不给就按正方形。
 */
export function generateMaze(seed: number, cells: number, cellRows?: number): Maze {
  const rand = mulberry32(seed >>> 0);
  const cols = gridSpan(cells);
  const rows = gridSpan(cellRows ?? cells);
  const walls = carve(rows, cols, rand);
  const start: Pt = [1, 1];
  const exit: Pt = [rows - 2, cols - 2];
  const base: Maze = { rows, cols, walls, start, exit, key: start, door: start };

  // 门压在起点 → 终点的唯一通路上（越靠后越好，但不许压住起点/终点本身）
  const trunk = shortestPath(base, start, exit) ?? [start, exit];
  const doorIndex = Math.min(trunk.length - 2, Math.max(1, Math.round((trunk.length - 1) * 0.62)));
  base.door = trunk[doorIndex];

  // 钥匙放在「不经过门也到得了」的那一侧，挑离起点最远的一格，逛起来才有得逛
  const open = reachableFrom(base, start, true).filter(
    (p) => !samePt(p, start) && !samePt(p, base.door)
  );
  let best: Pt = open.length > 0 ? open[0] : start;
  let bestLen = -1;
  for (const p of open) {
    const path = shortestPath(base, start, p, true);
    const len = path ? path.length : -1;
    if (len > bestLen) {
      bestLen = len;
      best = p;
    }
  }
  base.key = best;
  return base;
}

export interface MazeCheck {
  ok: boolean;
  /** 不经过门就能捡到钥匙 */
  keyReachable: boolean;
  /** 拿到钥匙、开了门之后走得到终点 */
  exitReachable: boolean;
  /** 门确实拦在必经之路上（否则钥匙就白捡了） */
  doorGuardsExit: boolean;
  /** 起点 → 钥匙 → 终点的总步数 */
  steps: number;
}

/** 迷宫可解性校验：钥匙在门前可达 + 开门后终点可达 + 门确实拦路 */
export function validateMaze(m: Maze): MazeCheck {
  const toKey = shortestPath(m, m.start, m.key, true);
  const keyReachable = toKey !== null;
  const toExit = shortestPath(m, m.key, m.exit, false);
  const exitReachable = toExit !== null;
  const doorGuardsExit = shortestPath(m, m.start, m.exit, true) === null;
  const steps = (toKey?.length ?? 1) - 1 + ((toExit?.length ?? 1) - 1);
  return {
    ok: keyReachable && exitReachable && doorGuardsExit,
    keyReachable,
    exitReachable,
    doorGuardsExit,
    steps
  };
}

/** 一条把钥匙也捡上的完整通路：起点 → 钥匙 → 终点（走不通返回 null） */
export function fullRoute(m: Maze): Pt[] | null {
  const toKey = shortestPath(m, m.start, m.key, true);
  const toExit = shortestPath(m, m.key, m.exit, false);
  if (!toKey || !toExit) return null;
  return [...toKey, ...toExit.slice(1)];
}

// ---------------------------------------------------------------------------
// 幽灵竞速：同一张迷宫，和对手的影子比谁先到终点
// ---------------------------------------------------------------------------

/** 幽灵每走一格要多少毫秒（越小越快） */
export interface GhostPace {
  stepMs: number;
  /** 幽灵不是完美的：每隔几步会犹豫一下（多花一步的时间） */
  hesitateEvery: number;
}

/** 对手越强，脚程越快；wins 是玩家已经赢过几次（越赢对手越拼） */
export function ghostPace(wins: number): GhostPace {
  const w = Math.max(0, Math.floor(wins) || 0);
  return {
    stepMs: Math.max(180, 420 - w * 12),
    hesitateEvery: Math.max(4, 9 - Math.floor(w / 3))
  };
}

/** 幽灵在第 ms 毫秒时走到路线的第几格（超出路线就停在终点） */
export function ghostIndexAt(route: readonly Pt[], ms: number, pace: GhostPace): number {
  if (route.length === 0) return 0;
  const stepMs = Math.max(1, pace.stepMs);
  const every = Math.max(2, pace.hesitateEvery);
  let elapsed = 0;
  for (let i = 1; i < route.length; i++) {
    elapsed += i % every === 0 ? stepMs * 2 : stepMs;
    if (ms < elapsed) return i - 1;
  }
  return route.length - 1;
}

export type RaceResult = "win" | "lose" | "tie";

/** 竞速判定：玩家用时更短就赢，完全相同算平局 */
export function judgeRace(playerMs: number, ghostMs: number): RaceResult {
  if (!Number.isFinite(playerMs)) return "lose";
  if (playerMs < ghostMs) return "win";
  if (playerMs > ghostMs) return "lose";
  return "tie";
}

/** 幽灵跑完整条路线要多少毫秒（玩家的目标时间） */
export function ghostTotalMs(route: readonly Pt[], pace: GhostPace): number {
  if (route.length <= 1) return 0;
  const stepMs = Math.max(1, pace.stepMs);
  const every = Math.max(2, pace.hesitateEvery);
  let total = 0;
  for (let i = 1; i < route.length; i++) total += i % every === 0 ? stepMs * 2 : stepMs;
  return total;
}

// ---------------------------------------------------------------------------
// 无尽之路：楼层递增 + 每 5 层一个休息点
// ---------------------------------------------------------------------------

/** 每几层歇一次脚 */
export const REST_EVERY = 5;

export function isRestFloor(floor: number): boolean {
  const f = Math.floor(floor);
  return f > 0 && f % REST_EVERY === 0;
}

/** 下一个休息点还有几层 */
export function floorsToRest(floor: number): number {
  const f = Math.max(0, Math.floor(floor) || 0);
  return REST_EVERY - (f % REST_EVERY);
}

export type SupplyKind = "heal" | "shield" | "coins" | "power" | "grit";

export interface Supply {
  id: string;
  name: string;
  emoji: string;
  kind: SupplyKind;
  /** 数值含义随 kind 变：heal=回多少星芒，shield=盾量，coins=金币，power/grit=千分比加成 */
  amount: number;
  desc: string;
}

/**
 * 休息点的补给池：全是温和的小补给。
 * 上限有意压得低（攻防最多一次 +8%），绝不出现「拿到就赢」的东西。
 */
export const SUPPLIES: readonly Supply[] = [
  { id: "picnic", name: "野餐布", emoji: "🧺", kind: "heal", amount: 55, desc: "铺开垫子吃点东西，回 55 点星芒。" },
  { id: "spring", name: "叮咚小泉", emoji: "⛲", kind: "heal", amount: 80, desc: "掬一捧泉水，回 80 点星芒。" },
  { id: "leafshield", name: "叶片小盾", emoji: "🍀", kind: "shield", amount: 45, desc: "编一面叶子盾，挡下 45 点力道。" },
  { id: "wrist", name: "护腕布条", emoji: "🩹", kind: "grit", amount: 80, desc: "缠紧护腕，防御提升 8%。" },
  { id: "pouch", name: "碎金小袋", emoji: "💰", kind: "coins", amount: 40, desc: "路边捡的小袋子，里面有 40 枚金币。" },
  { id: "bandana", name: "劲头头巾", emoji: "🎽", kind: "power", amount: 80, desc: "系紧头巾，攻击提升 8%。" }
];

/** 补给能给多大的加成（千分之一）：攻防类一律不超过 +8%，写成常量给单测盯 */
export const SUPPLY_BUFF_CAP_PERMILLE = 80;

/** 把补给用在勇者身上（返回新对象，绝不改传进来的那个） */
export function applySupply(hero: Fighter, supply: Supply): Fighter {
  const next = cloneFighter(hero);
  const amount = Math.max(0, Math.round(supply.amount));
  switch (supply.kind) {
    case "heal":
      next.hp = Math.min(next.maxHp, next.hp + amount);
      break;
    case "shield":
      next.shield = next.shield + amount;
      break;
    case "power":
      next.atk = Math.round(next.atk * (1 + Math.min(SUPPLY_BUFF_CAP_PERMILLE, amount) / 1000));
      break;
    case "grit":
      next.def = Math.round(next.def * (1 + Math.min(SUPPLY_BUFF_CAP_PERMILLE, amount) / 1000)) + 1;
      break;
    default:
      break;
  }
  return next;
}

/**
 * 某个休息点给哪三样补给（同一层永远同三样，可复现）。
 * 三样一定互不相同，且至少有一样是回星芒的——不会出现「歇了个寂寞」。
 */
export function rollSupplies(floor: number): Supply[] {
  const rand = mulberry32((Math.max(1, Math.floor(floor) || 1) * 6151 + 977) >>> 0);
  const pool = SUPPLIES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, 3);
  if (!picked.some((s) => s.kind === "heal")) {
    const heal = pool.find((s) => s.kind === "heal");
    if (heal) picked[2] = heal;
  }
  return picked;
}

/** 第 floor 层的迷宫尺寸：慢慢变大，封顶 9×9，免得手机上看不清 */
export function roadSize(floor: number): MazeSize {
  const f = Math.max(1, Math.floor(floor) || 1);
  const cells = Math.min(9, 4 + Math.floor((f - 1) / 3));
  return { cells, cellRows: Math.min(8, cells) };
}

/** 第 floor 层的迷宫（同一趟探险 + 同一层 = 同一张图，可复现） */
export function roadMaze(runSeed: number, floor: number): Maze {
  const size = roadSize(floor);
  const seed = ((runSeed >>> 0) + Math.max(1, Math.floor(floor) || 1) * 40503) >>> 0;
  return generateMaze(seed, size.cells, size.cellRows);
}
