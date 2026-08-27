/**
 * 圆圆大作战 · 规则内核(全是纯函数,可单测)。
 *
 * 竞技场是一张俯视的矩形地图:每个人有若干个「圆圆」,吃彩豆长大、
 * 分身弹射、吐孢子、绕开刺球。所有对手都是本机 AI,不联网、不开任何 socket。
 * 画面怎么画在 index.ts,这里只有算术。
 */

/** 半径系数:r = K_R * sqrt(mass) */
export const K_R = 4;
/** 基础速度(像素/秒) */
export const V0 = 260;
/** 速度衰减参考质量:质量到这个数速度减半 */
export const MASS_SPEED_REF = 120;
/** 超过这个质量才开始自然衰减,逼着持续进食 */
export const DECAY_START = 90;
/** 每秒衰减比例 */
export const DECAY = 0.012;
/** 吞噬的重叠系数:圆心距要小于 |rA-rB| 的这个倍数 */
export const OVERLAP = 0.75;
/** 吞噬的质量比门槛 */
export const EAT_RATIO = 1.25;
/** 一个人最多几个分身 */
export const MAX_CELLS = 16;
/** 分身后每半的质量下限 */
export const MIN_SPLIT_MASS = 18;
/** 吐一颗孢子的质量 */
export const SPIT_MASS = 6;
/** 吐孢子需要的最小体格 */
export const MIN_SPIT_MASS = 24;
/** 刺球起始质量 */
export const VIRUS_MASS = 45;
/** 刺球吃到几颗孢子就分裂出一颗新刺球 */
export const VIRUS_FEED_LIMIT = 7;
/** 彩豆质量 */
export const PELLET_MASS = 1.2;
/** 掉到这个质量就「先去休息」 */
export const MIN_MASS = 8;
/** 合并等待:基础秒数 */
export const MERGE_BASE_SEC = 18;
/** 合并等待:质量越大等越久,上限 30 秒 */
export const MERGE_MAX_SEC = 30;

export interface Vec {
  x: number;
  y: number;
}

export interface Cell {
  id: string;
  /** 属于谁(玩家或 AI 的 id) */
  owner: string;
  mass: number;
  x: number;
  y: number;
  /** 弹射速度,会被阻尼吃掉 */
  vx: number;
  vy: number;
  /** 出生时刻(秒);合并窗口从这里算 */
  bornAt: number;
}

export interface Virus {
  id: string;
  x: number;
  y: number;
  mass: number;
  /** 吃进去几颗孢子了 */
  fed: number;
}

export interface Pellet {
  id: string;
  x: number;
  y: number;
}

export interface Spore {
  id: string;
  owner: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
}

function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

/** 质量 → 半径 */
export function massToRadius(mass: number): number {
  return K_R * Math.sqrt(Math.max(0, finite(mass)));
}

/** 质量 → 速度:越大越慢,小圆永远追得上大圆 */
export function massToSpeed(mass: number): number {
  const m = Math.max(0, finite(mass));
  return V0 / (1 + m / MASS_SPEED_REF);
}

/** 两点距离 */
export function dist(a: Vec, b: Vec): number {
  const dx = finite(a.x) - finite(b.x);
  const dy = finite(a.y) - finite(b.y);
  return Math.hypot(dx, dy);
}

/**
 * a 能不能吃掉 b:质量要够大,而且要压上去足够多。
 * 同一个人的两个分身除非到了合并窗口,否则永远吃不了对方。
 */
export function canEat(a: Cell, b: Cell, nowSec = 0): boolean {
  if (!a || !b || a.id === b.id) return false;
  if (a.owner === b.owner && !(canMerge(a, nowSec) && canMerge(b, nowSec))) return false;
  if (a.mass < b.mass * EAT_RATIO) return false;
  const ra = massToRadius(a.mass);
  const rb = massToRadius(b.mass);
  return dist(a, b) < Math.abs(ra - rb) * OVERLAP;
}

/** 这个分身要等多久才能合并(质量越大等越久) */
export function mergeDelaySec(mass: number): number {
  const m = Math.max(0, finite(mass));
  return Math.min(MERGE_MAX_SEC, MERGE_BASE_SEC + m / 40);
}

/** 到合并窗口了吗 */
export function canMerge(cell: Cell, nowSec: number): boolean {
  return finite(nowSec) - finite(cell?.bornAt) >= mergeDelaySec(cell?.mass ?? 0);
}

/** 两个自家分身贴到一起就并成一个(质量相加,位置按质量加权) */
export function mergeCells(a: Cell, b: Cell): Cell {
  const total = a.mass + b.mass;
  return {
    ...a,
    mass: total,
    x: (a.x * a.mass + b.x * b.mass) / (total || 1),
    y: (a.y * a.mass + b.y * b.mass) / (total || 1),
    vx: 0,
    vy: 0
  };
}

/**
 * 分身:把一个圆对半弹出去。
 * 两半都要够大,而且总数不能超过 16,否则原样返回(输入直接被忽略,不报错)。
 */
export function splitCell(
  cell: Cell,
  aim: Vec,
  ownCellCount: number,
  nowSec: number,
  idSuffix = "s"
): Cell[] {
  const half = cell.mass / 2;
  if (half < MIN_SPLIT_MASS || ownCellCount >= MAX_CELLS) return [cell];
  const dx = finite(aim.x) - cell.x;
  const dy = finite(aim.y) - cell.y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = 340 + Math.min(180, half);
  return [
    { ...cell, mass: half },
    {
      id: `${cell.id}-${idSuffix}`,
      owner: cell.owner,
      mass: half,
      x: cell.x + (dx / len) * massToRadius(half),
      y: cell.y + (dy / len) * massToRadius(half),
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      bornAt: nowSec
    }
  ];
}

/** 吐一颗孢子:体格不够就吐不出来(返回 null),够就从本体扣质量 */
export function ejectSpore(
  cell: Cell,
  aim: Vec,
  idSuffix = "p"
): { cell: Cell; spore: Spore } | null {
  if (cell.mass < MIN_SPIT_MASS) return null;
  const dx = finite(aim.x) - cell.x;
  const dy = finite(aim.y) - cell.y;
  const len = Math.hypot(dx, dy) || 1;
  const r = massToRadius(cell.mass);
  return {
    cell: { ...cell, mass: cell.mass - SPIT_MASS },
    spore: {
      id: `${cell.id}-${idSuffix}`,
      owner: cell.owner,
      x: cell.x + (dx / len) * (r + 2),
      y: cell.y + (dy / len) * (r + 2),
      vx: (dx / len) * 420,
      vy: (dy / len) * 420,
      mass: SPIT_MASS
    }
  };
}

/**
 * 撞上刺球会怎样:
 * - 比刺球轻:什么都不会发生,轻轻弹开而已,绝不会一下退场;
 * - 比刺球重:整个圆噗一下散成一堆小圆(总数封顶 16),并把刺球的质量吃下;
 * - 已经有 16 个分身:散不开,只是把质量加上去。
 */
export function eatVirus(
  cell: Cell,
  virus: Virus,
  ownCellCount: number,
  nowSec: number
): { cells: Cell[]; popped: boolean } {
  if (cell.mass <= virus.mass) return { cells: [cell], popped: false };
  const total = cell.mass + virus.mass;
  const room = MAX_CELLS - ownCellCount;
  if (room <= 0) return { cells: [{ ...cell, mass: total }], popped: false };
  const pieces = Math.max(2, Math.min(room + 1, Math.min(16, Math.floor(total / 14))));
  if (pieces < 2) return { cells: [{ ...cell, mass: total }], popped: false };
  const each = total / pieces;
  const out: Cell[] = [];
  for (let i = 0; i < pieces; i++) {
    const ang = (Math.PI * 2 * i) / pieces;
    out.push({
      id: i === 0 ? cell.id : `${cell.id}-v${i}`,
      owner: cell.owner,
      mass: each,
      x: cell.x + Math.cos(ang) * massToRadius(each),
      y: cell.y + Math.sin(ang) * massToRadius(each),
      vx: Math.cos(ang) * 300,
      vy: Math.sin(ang) * 300,
      bornAt: nowSec
    });
  }
  return { cells: out, popped: true };
}

/**
 * 给刺球喂孢子:刺球被推着走并且变重,吃够了就朝着被喂的方向弹出一颗新刺球。
 * 这是把刺球推到对手那边去的进攻手段。
 */
export function feedVirus(
  virus: Virus,
  spore: Spore,
  idSuffix = "n"
): { virus: Virus; spawned: Virus | null } {
  const dx = spore.vx;
  const dy = spore.vy;
  const len = Math.hypot(dx, dy) || 1;
  const pushed: Virus = {
    ...virus,
    x: virus.x + (dx / len) * 6,
    y: virus.y + (dy / len) * 6,
    mass: virus.mass + spore.mass,
    fed: virus.fed + 1
  };
  if (pushed.fed < VIRUS_FEED_LIMIT) return { virus: pushed, spawned: null };
  return {
    virus: { ...pushed, mass: VIRUS_MASS, fed: 0 },
    spawned: {
      id: `${virus.id}-${idSuffix}`,
      x: pushed.x + (dx / len) * 90,
      y: pushed.y + (dy / len) * 90,
      mass: VIRUS_MASS,
      fed: 0
    }
  };
}

/** 自然衰减:只有胖到一定程度才掉,而且掉不到下限以下 */
export function decayMass(mass: number, dt: number): number {
  const m = Math.max(0, finite(mass));
  if (m <= DECAY_START) return m;
  const next = m * (1 - DECAY * Math.max(0, finite(dt)));
  return Math.max(DECAY_START, next);
}

/** 圆心夹在地图里,身子不许出界 */
export function clampToMap(cell: Cell, mapW: number, mapH: number): Cell {
  const r = massToRadius(cell.mass);
  const w = Math.max(r * 2, finite(mapW, r * 2));
  const h = Math.max(r * 2, finite(mapH, r * 2));
  return {
    ...cell,
    x: Math.max(r, Math.min(w - r, finite(cell.x))),
    y: Math.max(r, Math.min(h - r, finite(cell.y)))
  };
}

export interface Zone {
  cx: number;
  cy: number;
  radius: number;
}

/** 安全区随时间内收(不会收到 0 以下) */
export function shrinkZone(zone: Zone, dt: number, speed: number): Zone {
  return { ...zone, radius: Math.max(60, zone.radius - Math.max(0, finite(speed)) * Math.max(0, finite(dt))) };
}

/** 圈外每秒掉质量;返回掉完之后的质量(掉到下限就该收工了) */
export function zoneDrain(cell: Cell, zone: Zone | null, dt: number, perSec = 9): number {
  if (!zone) return cell.mass;
  const d = dist(cell, { x: zone.cx, y: zone.cy });
  if (d <= zone.radius) return cell.mass;
  return Math.max(0, cell.mass - perSec * Math.max(0, finite(dt)));
}

/** 质量掉到下限就先去休息 */
export function isSpent(mass: number): boolean {
  return finite(mass) < MIN_MASS;
}

export interface LeaderRow {
  id: string;
  name: string;
  mass: number;
}

/** 排行榜:按总质量从大到小,同质量按 id 稳定排,取前 n 名 */
export function leaderboard(cells: readonly Cell[], names: Record<string, string>, top = 10): LeaderRow[] {
  const sum = new Map<string, number>();
  for (const c of cells) sum.set(c.owner, (sum.get(c.owner) ?? 0) + c.mass);
  const rows: LeaderRow[] = Array.from(sum.entries()).map(([id, mass]) => ({
    id,
    name: names[id] ?? id,
    mass
  }));
  rows.sort((a, b) => (b.mass - a.mass) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return rows.slice(0, Math.max(0, top));
}

/** 我排第几(1 基);场上没有我就返回 0 */
export function rankOf(cells: readonly Cell[], names: Record<string, string>, id: string): number {
  const all = leaderboard(cells, names, Number.MAX_SAFE_INTEGER);
  const i = all.findIndex((r) => r.id === id);
  return i < 0 ? 0 : i + 1;
}

/** 某个人的总质量 */
export function totalMass(cells: readonly Cell[], owner: string): number {
  let sum = 0;
  for (const c of cells) if (c.owner === owner) sum += c.mass;
  return sum;
}

/** 本局的一句战报(只鼓励,不批评) */
export function runLine(won: boolean, rank: number, mass: number): string {
  if (won) return `第 ${rank} 名,总质量 ${Math.round(mass)}，走位很稳！`;
  return "圆圆先去休息啦，下次一定更稳！";
}
