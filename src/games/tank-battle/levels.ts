/**
 * 铁皮坦克大战 · 188 关战役(8 大章节)与另外三种模式的地图。
 *
 * 每一关的地图都是同一颗种子确定生成的:同一关每次进去布局一模一样,
 * 生成完还会做一次连通性体检——保证每个敌人出生点都能走到星星堡垒
 * (砖墙算「能打穿」),也保证两位玩家出得了门。体检不过就沿着一条 L 形
 * 通道把钢墙和水面清掉,绝不会出现「怎么打都过不去」的死关。
 */
import type { Chapter } from "../level99";
import { mulberry32 } from "../level99";
import type { EnemyKind, EnemySpec, Tile } from "./logic";

export const MAP_W = 13;
export const MAP_H = 13;

/** 星星堡垒的位置(底边正中) */
export const BASE: { cx: number; cy: number } = { cx: 6, cy: 12 };
/** 朵朵 / 星星的出生点 */
export const PLAYER_SPAWNS: ReadonlyArray<{ cx: number; cy: number }> = [
  { cx: 3, cy: 12 },
  { cx: 9, cy: 12 },
];
/** 三个敌人出生点(顶边) */
export const ENEMY_SPAWNS: ReadonlyArray<{ cx: number; cy: number }> = [
  { cx: 0, cy: 0 },
  { cx: 6, cy: 0 },
  { cx: 12, cy: 0 },
];

export const CHAPTERS: Chapter[] = [
  {
    name: "铁皮训练场",
    emoji: "🚜",
    color: "#e6f2d8",
    desc: "只有砖墙和快速兵,先把准头和走位练出来。",
    size: 22,
  },
  {
    name: "钢板工厂",
    emoji: "🔩",
    color: "#e3e8f1",
    desc: "钢墙打不动,学会借墙躲炮;装甲车也来了。",
    size: 23,
  },
  {
    name: "水湾码头",
    emoji: "💧",
    color: "#dceef8",
    desc: "水面过不去,炮弹却飞得过;火力车加入战场。",
    size: 23,
  },
  {
    name: "青草迷宫",
    emoji: "🌿",
    color: "#e2f2e0",
    desc: "草丛挡视线不挡炮弹,埋伏和被埋伏都从这里开始。",
    size: 22,
  },
  {
    name: "装甲车队",
    emoji: "🛡️",
    color: "#eee7f6",
    desc: "装甲车成群出动,每辆都要连着打两发。",
    size: 22,
  },
  {
    name: "火力靶场",
    emoji: "💥",
    color: "#fbe8e0",
    desc: "火力车的炮又快又急,先横移再还手。",
    size: 22,
  },
  {
    name: "绕后特务",
    emoji: "🕵️",
    color: "#f0e6f8",
    desc: "机灵车不走正门,会绕到堡垒后面找空档。",
    size: 26,
  },
  {
    name: "铁皮总决赛",
    emoji: "🏆",
    color: "#fdeedd",
    desc: "四种铁皮车一起上,全地形混战,守住堡垒就是冠军。",
    size: 28,
  },
];

export const LEVEL_TOTAL = 188;

export interface TankLevel {
  /** 0 基关号 */
  index: number;
  chapterIndex: number;
  rows: string[];
  waves: EnemySpec[];
  maxAlive: number;
  /** 时限(秒) */
  limit: number;
  /** 每位玩家的备用砖块数 */
  bricks: number;
  /** 出场间隔(秒) */
  spawnGap: number;
}

// ---------------------------------------------------------------------------
// 章节工具
// ---------------------------------------------------------------------------

export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

export function chapterStartOf(ci: number): number {
  let acc = 0;
  for (let i = 0; i < ci; i++) acc += CHAPTERS[i].size;
  return acc;
}

/** 每章第一次出现的新东西,关卡头部会写出来 */
export const CHAPTER_NEW: readonly string[] = [
  "砖墙能打碎:连着打两发才会塌。",
  "钢墙打不动:拿它当盾牌用。装甲车登场。",
  "水面过不去,炮弹能飞过去。火力车登场。",
  "草丛挡视线不挡炮弹,可以躲进去埋伏。",
  "装甲车成群:每辆要连打两发。",
  "火力车成群:炮又快又急,先躲开直线。",
  "机灵车登场:它会绕到堡垒后面。",
  "四种铁皮车混编,全地形一起上。",
];

// ---------------------------------------------------------------------------
// 地形生成
// ---------------------------------------------------------------------------

type Grid = Tile[][];

function blankGrid(): Grid {
  const g: Grid = [];
  for (let y = 0; y < MAP_H; y++) g.push(new Array<Tile>(MAP_W).fill("."));
  return g;
}

function key(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** 不许被随机地形占用的格子:堡垒四周、出生点和它们的门口 */
function reservedCells(): Set<string> {
  const r = new Set<string>();
  for (let dy = -2; dy <= 0; dy++) {
    for (let dx = -1; dx <= 1; dx++) r.add(key(BASE.cx + dx, BASE.cy + dy));
  }
  r.add(key(BASE.cx - 2, BASE.cy));
  r.add(key(BASE.cx + 2, BASE.cy));
  for (const p of PLAYER_SPAWNS) {
    r.add(key(p.cx, p.cy));
    r.add(key(p.cx, p.cy - 1));
  }
  for (const e of ENEMY_SPAWNS) {
    r.add(key(e.cx, e.cy));
    r.add(key(e.cx, e.cy + 1));
  }
  return r;
}

function place(g: Grid, reserved: Set<string>, cx: number, cy: number, tile: Tile): void {
  if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) return;
  if (reserved.has(key(cx, cy))) return;
  g[cy][cx] = tile;
}

function blob(
  g: Grid,
  reserved: Set<string>,
  rand: () => number,
  tile: Tile,
  maxW: number,
  maxH: number
): void {
  const bw = 1 + Math.floor(rand() * maxW);
  const bh = 1 + Math.floor(rand() * maxH);
  const cx = Math.floor(rand() * (MAP_W - bw + 1));
  const cy = 1 + Math.floor(rand() * (MAP_H - bh - 1));
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) place(g, reserved, cx + x, cy + y, tile);
  }
}

/** 砖墙 / 钢墙 / 水面 / 草丛能不能走过去(砖墙算能打穿) */
function passable(t: Tile): boolean {
  return t !== "S" && t !== "~";
}

function floodReach(g: Grid, from: { cx: number; cy: number }): boolean[][] {
  const seen: boolean[][] = [];
  for (let y = 0; y < MAP_H; y++) seen.push(new Array<boolean>(MAP_W).fill(false));
  if (!passable(g[from.cy][from.cx])) return seen;
  const q: Array<{ cx: number; cy: number }> = [from];
  seen[from.cy][from.cx] = true;
  const dx = [0, 1, 0, -1];
  const dy = [-1, 0, 1, 0];
  while (q.length > 0) {
    const cur = q.shift()!;
    for (let d = 0; d < 4; d++) {
      const nx = cur.cx + dx[d];
      const ny = cur.cy + dy[d];
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      if (seen[ny][nx] || !passable(g[ny][nx])) continue;
      seen[ny][nx] = true;
      q.push({ cx: nx, cy: ny });
    }
  }
  return seen;
}

/** 沿一条 L 形通道把挡路的钢墙和水面清成空地(堡垒本身不动) */
function carvePath(g: Grid, from: { cx: number; cy: number }, to: { cx: number; cy: number }): void {
  const clear = (cx: number, cy: number): void => {
    if (cx === BASE.cx && cy === BASE.cy) return;
    if (!passable(g[cy][cx])) g[cy][cx] = ".";
  };
  const stepY = to.cy >= from.cy ? 1 : -1;
  for (let y = from.cy; y !== to.cy; y += stepY) clear(from.cx, y);
  const stepX = to.cx >= from.cx ? 1 : -1;
  for (let x = from.cx; x !== to.cx; x += stepX) clear(x, to.cy);
  clear(to.cx, to.cy);
}

/** 体检 + 修路:所有出生点都要能走到堡垒 */
function ensureConnected(g: Grid): void {
  const spots = [...ENEMY_SPAWNS, ...PLAYER_SPAWNS];
  for (const s of spots) {
    const seen = floodReach(g, s);
    if (seen[BASE.cy][BASE.cx]) continue;
    // 先走到堡垒上面那一行,再横过去,最后落到堡垒上
    carvePath(g, s, { cx: BASE.cx, cy: BASE.cy - 1 });
    carvePath(g, { cx: BASE.cx, cy: BASE.cy - 1 }, BASE);
  }
}

/**
 * 堡垒护墙:顶上两层砖,左右各两块。
 * 厚一点是有讲究的——正上方和贴着底边的两条直线是最短的偷家路线,
 * 得让对手多打几发,玩家才来得及回防、才来得及用备用砖把缺口补上。
 */
function fortify(g: Grid): void {
  const ring: Array<[number, number]> = [
    [BASE.cx - 1, BASE.cy - 2],
    [BASE.cx, BASE.cy - 2],
    [BASE.cx + 1, BASE.cy - 2],
    [BASE.cx - 1, BASE.cy - 1],
    [BASE.cx, BASE.cy - 1],
    [BASE.cx + 1, BASE.cy - 1],
    [BASE.cx - 2, BASE.cy],
    [BASE.cx - 1, BASE.cy],
    [BASE.cx + 1, BASE.cy],
    [BASE.cx + 2, BASE.cy],
  ];
  for (const [cx, cy] of ring) {
    if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) continue;
    g[cy][cx] = "#";
  }
  g[BASE.cy][BASE.cx] = "B";
}

function toRows(g: Grid): string[] {
  const rows = g.map((row) => row.join(""));
  const stamp = (cx: number, cy: number, ch: string): void => {
    rows[cy] = rows[cy].slice(0, cx) + ch + rows[cy].slice(cx + 1);
  };
  for (const [i, p] of PLAYER_SPAWNS.entries()) stamp(p.cx, p.cy, String(i + 1));
  for (const e of ENEMY_SPAWNS) stamp(e.cx, e.cy, "e");
  return rows;
}

/** 生成某一关的地形(不含出生点标记) */
export function buildGrid(index: number): Grid {
  const ci = chapterIndexOf(index);
  const rand = mulberry32(9137 + index * 7919);
  const g = blankGrid();
  const reserved = reservedCells();

  const brickCount = 7 + Math.min(6, ci);
  for (let i = 0; i < brickCount; i++) blob(g, reserved, rand, "#", 3, 3);
  if (ci >= 1) {
    const steel = 2 + Math.min(4, Math.floor(ci / 2));
    for (let i = 0; i < steel; i++) blob(g, reserved, rand, "S", 2, 2);
  }
  if (ci >= 2) {
    const water = 1 + Math.min(2, Math.floor(ci / 3));
    for (let i = 0; i < water; i++) blob(g, reserved, rand, "~", 3, 1);
  }
  if (ci >= 3) {
    const grass = 2 + Math.min(4, Math.floor(ci / 2));
    for (let i = 0; i < grass; i++) blob(g, reserved, rand, "*", 3, 2);
  }

  // 出生点门口保持空地,免得一出场就顶着墙
  for (const s of [...ENEMY_SPAWNS, ...PLAYER_SPAWNS]) {
    g[s.cy][s.cx] = ".";
  }
  for (const e of ENEMY_SPAWNS) g[Math.min(MAP_H - 1, e.cy + 1)][e.cx] = ".";
  for (const p of PLAYER_SPAWNS) g[Math.max(0, p.cy - 1)][p.cx] = ".";

  fortify(g);
  ensureConnected(g);
  fortify(g);
  return g;
}

// ---------------------------------------------------------------------------
// 敌人配比
// ---------------------------------------------------------------------------

type Weights = ReadonlyArray<readonly [EnemyKind, number]>;

const CHAPTER_WEIGHTS: readonly Weights[] = [
  [["swift", 1]],
  [
    ["swift", 7],
    ["armor", 3],
  ],
  [
    ["swift", 5],
    ["armor", 2],
    ["power", 3],
  ],
  [
    ["swift", 4],
    ["armor", 3],
    ["power", 3],
  ],
  [
    ["armor", 6],
    ["swift", 2],
    ["power", 2],
  ],
  [
    ["power", 5],
    ["swift", 2],
    ["armor", 3],
  ],
  [
    ["smart", 4],
    ["swift", 2],
    ["armor", 2],
    ["power", 2],
  ],
  [
    ["smart", 3],
    ["swift", 2],
    ["armor", 2],
    ["power", 3],
  ],
];

function pickKind(weights: Weights, rand: () => number): EnemyKind {
  let total = 0;
  for (const [, wgt] of weights) total += wgt;
  let roll = rand() * total;
  for (const [kind, wgt] of weights) {
    roll -= wgt;
    if (roll <= 0) return kind;
  }
  return weights[0][0];
}

/** 这一关派几辆车 */
export function waveSize(index: number): number {
  const ci = chapterIndexOf(index);
  const ii = index - chapterStartOf(ci);
  return Math.min(16, 5 + Math.round(ci * 1.1) + Math.floor(ii / 2.4));
}

export function buildWaves(index: number): EnemySpec[] {
  const ci = chapterIndexOf(index);
  const rand = mulberry32(5501 + index * 104729);
  const weights = CHAPTER_WEIGHTS[ci] ?? CHAPTER_WEIGHTS[0];
  const size = waveSize(index);
  const out: EnemySpec[] = [];
  for (let i = 0; i < size; i++) {
    out.push({ kind: pickKind(weights, rand), spawn: Math.floor(rand() * ENEMY_SPAWNS.length) });
  }
  return out;
}

/** 按种类点一下这一关有哪些车,关卡头部要显示 */
export function countKinds(waves: readonly EnemySpec[]): Record<EnemyKind, number> {
  const out: Record<EnemyKind, number> = { swift: 0, armor: 0, power: 0, smart: 0 };
  for (const s of waves) out[s.kind] += 1;
  return out;
}

// ---------------------------------------------------------------------------
// 关卡组装
// ---------------------------------------------------------------------------

export function buildLevel(index: number): TankLevel {
  const clamped = Math.max(0, Math.min(LEVEL_TOTAL - 1, Math.round(index)));
  const ci = chapterIndexOf(clamped);
  const waves = buildWaves(clamped);
  return {
    index: clamped,
    chapterIndex: ci,
    rows: toRows(buildGrid(clamped)),
    waves,
    maxAlive: Math.min(6, 3 + Math.floor(ci / 2)),
    limit: 45 + waves.length * 6,
    bricks: 3 + Math.floor(ci / 3),
    spawnGap: Math.max(1.1, 2.2 - ci * 0.12),
  };
}

/**
 * 按到场人数调节强度:一个人玩的时候同屏敌人少一辆、出场慢一点、多给一块砖,
 * 两个人一起玩就按原设定来。关卡内容(地图、车队、时限)完全不变。
 */
export function scaleForPlayers(
  lv: TankLevel,
  players: 1 | 2
): { maxAlive: number; spawnGap: number; bricks: number } {
  if (players >= 2) return { maxAlive: lv.maxAlive, spawnGap: lv.spawnGap, bricks: lv.bricks };
  return {
    maxAlive: Math.max(2, Math.round(lv.maxAlive / 2) + 1),
    spawnGap: lv.spawnGap * 1.45,
    bricks: lv.bricks + 1,
  };
}

// ---------------------------------------------------------------------------
// 无尽 / 对战 地图
// ---------------------------------------------------------------------------

/** 无尽敌潮用的固定战场:通路多、方便长时间周旋 */
export function endlessRows(): string[] {
  const g = blankGrid();
  const reserved = reservedCells();
  const rand = mulberry32(20260826);
  for (let i = 0; i < 9; i++) blob(g, reserved, rand, "#", 3, 3);
  for (let i = 0; i < 4; i++) blob(g, reserved, rand, "S", 2, 2);
  for (let i = 0; i < 2; i++) blob(g, reserved, rand, "~", 3, 1);
  for (let i = 0; i < 4; i++) blob(g, reserved, rand, "*", 3, 2);
  for (const s of [...ENEMY_SPAWNS, ...PLAYER_SPAWNS]) g[s.cy][s.cx] = ".";
  for (const e of ENEMY_SPAWNS) g[e.cy + 1][e.cx] = ".";
  for (const p of PLAYER_SPAWNS) g[p.cy - 1][p.cx] = ".";
  fortify(g);
  ensureConnected(g);
  fortify(g);
  return toRows(g);
}

/**
 * 双人对战战场:没有堡垒也没有敌人,两辆车一左一右,中间是掩体。
 * 地图左右对称,谁都占不到地形便宜。
 */
export function versusRows(): string[] {
  const g = blankGrid();
  const mirror = (cx: number, cy: number, tile: Tile): void => {
    g[cy][cx] = tile;
    g[cy][MAP_W - 1 - cx] = tile;
  };
  for (let y = 2; y <= 10; y += 2) {
    for (let x = 1; x <= 4; x += 3) mirror(x, y, "#");
  }
  for (let y = 3; y <= 9; y += 3) mirror(2, y, "S");
  mirror(5, 6, "~");
  for (let y = 5; y <= 7; y++) mirror(4, y, "*");
  const rows = g.map((row) => row.join(""));
  const stamp = (cx: number, cy: number, ch: string): void => {
    rows[cy] = rows[cy].slice(0, cx) + ch + rows[cy].slice(cx + 1);
  };
  stamp(0, 6, "1");
  stamp(MAP_W - 1, 6, "2");
  return rows;
}
