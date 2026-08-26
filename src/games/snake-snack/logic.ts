/**
 * 贪吃毛毛虫的纯逻辑：墙 / 星门 / 小刺猬 / 窄门的规则与可达性。
 * 全是纯函数，不碰 DOM，方便单测把每一关都验算一遍。
 */
import { GRID, type Mover, type SnakeLevel } from "./levels";

export const DIRS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** 格子编号：同一套编号在关卡表、逻辑和画布里通用 */
export function cellKey(x: number, y: number): number {
  return y * GRID + x;
}

export function cellXY(key: number): [number, number] {
  return [key % GRID, Math.floor(key / GRID)];
}

export function wallSet(lv: SnakeLevel): Set<number> {
  return new Set(lv.walls.map(([x, y]) => cellKey(x, y)));
}

export function gateSet(lv: SnakeLevel): Set<number> {
  return new Set((lv.gate ?? []).map(([x, y]) => cellKey(x, y)));
}

/** 星门对照表：踩进 key 就从 value 钻出来（两个方向都能走） */
export function portalMap(lv: SnakeLevel): Map<number, number> {
  const map = new Map<number, number>();
  for (const [ax, ay, bx, by] of lv.portals ?? []) {
    map.set(cellKey(ax, ay), cellKey(bx, by));
    map.set(cellKey(bx, by), cellKey(ax, ay));
  }
  return map;
}

/** 小刺猬在第 step 拍时站在哪儿（来回巡逻，走到头就折返） */
export function moverAt(m: Mover, step: number): [number, number] {
  const [x, y, dx, dy, span] = m;
  const s = Math.max(1, Math.round(span));
  const p = ((Math.round(step) % (2 * s)) + 2 * s) % (2 * s);
  const off = p <= s ? p : 2 * s - p;
  return [x + dx * off, y + dy * off];
}

/** 第 step 拍时所有小刺猬占的格子 */
export function moverCells(lv: SnakeLevel, step: number): Set<number> {
  const out = new Set<number>();
  for (const m of lv.movers ?? []) {
    const [x, y] = moverAt(m, step);
    out.add(cellKey(x, y));
  }
  return out;
}

/** 小刺猬来回会走到的所有格子（用来检查它们没被墙卡死） */
export function moverPathCells(lv: SnakeLevel): Set<number> {
  const out = new Set<number>();
  for (const m of lv.movers ?? []) {
    for (let s = 0; s <= Math.max(1, Math.round(m[4])); s++) {
      out.add(cellKey(m[0] + m[2] * s, m[1] + m[3] * s));
    }
  }
  return out;
}

/** 第一条毛毛虫的出生位置（头在最前面） */
export function spawnA(): Array<[number, number]> {
  const mid = Math.floor(GRID / 2);
  return [[3, mid], [2, mid], [1, mid]];
}

/** 双身位时第二条毛毛虫的出生位置：左右镜像，另起一行 */
export function spawnB(): Array<[number, number]> {
  return [[GRID - 4, 2], [GRID - 3, 2], [GRID - 2, 2]];
}

/** 镜像方向：左右翻面，上下照旧 */
export function mirrorDir(d: [number, number]): [number, number] {
  return [d[0] === 0 ? 0 : -d[0], d[1]];
}

/** 不是墙的格子（窄门也算，它只是会临时关上） */
export function freeCells(lv: SnakeLevel): number[] {
  const walls = wallSet(lv);
  const out: number[] = [];
  for (let k = 0; k < GRID * GRID; k++) if (!walls.has(k)) out.push(k);
  return out;
}

/**
 * 从 from 出发能走到哪些格子：墙走不了，窄门只有 gateOpen 时能穿，星门算一条捷径。
 * 放点心前用它筛一遍，保证每一颗点心都真的够得着。
 */
export function reachableCells(lv: SnakeLevel, from: number, gateOpen: boolean): Set<number> {
  const walls = wallSet(lv);
  const gates = gateSet(lv);
  const portals = portalMap(lv);
  const seen = new Set<number>();
  if (walls.has(from)) return seen;
  seen.add(from);
  const queue: number[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const [x, y] = cellXY(cur);
    const next: number[] = [];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) continue;
      const k = cellKey(nx, ny);
      if (walls.has(k)) continue;
      if (gates.has(k) && !gateOpen) continue;
      next.push(k);
    }
    const hop = portals.get(cur);
    if (hop !== undefined && !walls.has(hop)) next.push(hop);
    for (const k of next) {
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push(k);
    }
  }
  return seen;
}

/** 窄门这会儿开着吗：身子不超过 gateMax 节就挤得过去 */
export function gateOpenFor(lv: SnakeLevel, length: number): boolean {
  if (!lv.gate || lv.gate.length === 0) return true;
  return length <= (lv.gateMax ?? 99);
}

/** 这一口该发什么点心：优先剪刀果（身子太长时一定发），其次限时星星果 */
export function snackKind(lv: SnakeLevel, eaten: number, length: number): "normal" | "star" | "trim" {
  if (lv.trimEvery) {
    if (!gateOpenFor(lv, length)) return "trim";
    if (eaten > 0 && eaten % lv.trimEvery === lv.trimEvery - 1) return "trim";
  }
  return eaten > 0 && eaten % 3 === 2 ? "star" : "normal";
}

/** 星星果追到得越多星越多 */
export function starsFor(starsGot: number): 1 | 2 | 3 {
  if (starsGot >= 2) return 3;
  if (starsGot >= 1) return 2;
  return 1;
}

/** 开局那句玩法说明 */
export function openingLine(lv: SnakeLevel): string {
  if (lv.twin) return "两条毛毛虫左右镜像同步走，按键前先看清另一条会挪到哪里！";
  if (lv.portals) return "踩进星门会从对面那扇门钻出来，先想好出口朝哪再进！";
  if (lv.movers) return "小刺猬来回巡逻，数一数它的节奏，等它背身让开再穿过去！";
  if (lv.gate) return `身子超过 ${lv.gateMax ?? 8} 节就挤不过窄门，先绕去吃剪刀果再进！`;
  return "吃点心变长，每隔几口会出现限时 ⭐ 星星果，顺路的时候优先去拿！";
}

/** 过关那句夸奖 */
export function winLine(lv: SnakeLevel, target: number, starsGot: number): string {
  if (lv.twin) return `两条毛毛虫一起吃满 ${target} 口，同步配合得很稳！`;
  if (lv.portals) return `穿了这么多趟星门还吃满 ${target} 口，方向感和预判都很准！`;
  if (lv.movers) return `踩着小刺猬的空档吃满 ${target} 口，节奏抓得很好！`;
  if (lv.gate) return `进进出出窄门吃满 ${target} 口，长度控制得刚刚好！`;
  return `吃满 ${target} 口，还顺路追到了 ${starsGot} 颗星星果！`;
}

/** 没过关那句话（只鼓励，不批评） */
export function loseLine(reason: "fence" | "wall" | "self" | "twin" | "mover"): string {
  switch (reason) {
    case "fence": return "碰到围栏啦～沿着边缘绕圈走，把中间的空地留给自己回旋！";
    case "wall": return "撞到树篱啦～进通道前先看清出口在哪，路线就顺了！";
    case "self": return "咬到自己啦～吃之前先想好「吃完从哪儿出来」，就不会把自己钉进死角！";
    case "twin": return "两条毛毛虫撞一块儿啦～它俩左右是反着走的，先看窄的那条通道够不够两个身位！";
    default: return "被巡逻的小刺猬碰到啦～数着它的来回节奏，等它背身那一拍再穿过去！";
  }
}
