/**
 * 铁皮坦克大战 · 纯逻辑层(不碰 DOM,可以直接在测试里跑完整一关)。
 *
 * 战场是一张紧凑的字符网格:
 *   `.` 空地   `#` 砖墙(能打碎)   `S` 钢墙(打不动)   `~` 水面(过不去,炮弹能飞过)
 *   `*` 草丛(能开过去,挡视线)     `B` 星星堡垒        `1`/`2` 朵朵 / 星星出生点
 *   `e` 敌人出生点
 *
 * 全程没有血量、没有受伤、没有淘汰的说法:
 *  - 敌方坦克挨够炮弹就「冒烟变成一朵花」离场;
 *  - 我方坦克挨炮弹只会「被弹飞回出生点」,转两圈接着开;
 *  - 星星堡垒被砸中就是这一关结束,重来一次即可。
 */

import { mulberry32 } from "../level99";

export type Tile = "." | "#" | "S" | "~" | "*" | "B";

/** 0 上 1 右 2 下 3 左 */
export type Dir = 0 | 1 | 2 | 3;

export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];

export interface Cell {
  cx: number;
  cy: number;
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 坦克半宽(格) */
export const TANK_HALF = 0.38;
/** 砖墙要挨几发普通炮弹才碎 */
export const BRICK_HP = 2;
/** 每位玩家开局带几块备用砖 */
export const DEFAULT_BRICKS = 4;
/** 被弹飞之后原地打转多久(秒),这段时间不能动也不会再被打中 */
export const SPIN_SECONDS = 1.1;
/** 冒烟护罩时长(秒):刚回到出生点的一小会儿不会被再弹飞 */
export const SHIELD_SECONDS = 2.2;

export const PLAYER_SPEED = 3.6;
export const PLAYER_COOL = 0.42;
export const PLAYER_BULLET = 7.6;

export type EnemyKind = "swift" | "armor" | "power" | "smart";
export type TankKind = "duo" | "xing" | EnemyKind;

export interface EnemySpecInfo {
  name: string;
  emoji: string;
  color: string;
  /** 移动速度(格/秒) */
  speed: number;
  /** 开炮冷却(秒) */
  cool: number;
  /** 要挨几发炮弹才会冒烟变花 */
  armor: number;
  /** 炮弹速度(格/秒) */
  bullet: number;
  /** 变花时给的分(无尽模式计分用) */
  score: number;
  /** 一句话说明,给关卡头部与图鉴用 */
  desc: string;
}

export const ENEMY_SPECS: Record<EnemyKind, EnemySpecInfo> = {
  swift: {
    name: "快速兵",
    emoji: "💨",
    color: "#7fc8e8",
    speed: 3.4,
    cool: 1.15,
    armor: 1,
    bullet: 6.0,
    score: 1,
    desc: "跑得最快,但一发就冒烟。",
  },
  armor: {
    name: "装甲车",
    emoji: "🛡️",
    color: "#9a9fb5",
    speed: 1.9,
    cool: 1.35,
    armor: 2,
    bullet: 5.6,
    score: 3,
    desc: "皮厚,要连着打两发。",
  },
  power: {
    name: "火力车",
    emoji: "💥",
    color: "#e08a72",
    speed: 2.4,
    cool: 0.55,
    armor: 1,
    bullet: 8.6,
    score: 2,
    desc: "炮又快又急,别正面站着。",
  },
  smart: {
    name: "机灵车",
    emoji: "🕵️",
    color: "#b58ad8",
    speed: 2.9,
    cool: 0.9,
    armor: 1,
    bullet: 6.6,
    score: 4,
    desc: "会绕到堡垒后面下手。",
  },
};

export const ENEMY_KINDS: readonly EnemyKind[] = ["swift", "armor", "power", "smart"];

// ---------------------------------------------------------------------------
// 键位:朵朵 WASD + F/G,星星 方向键 + L/K,Esc 暂停
// ---------------------------------------------------------------------------

export type TankAction = "up" | "right" | "down" | "left" | "fire" | "brick";

export interface KeyBind {
  /** 0 = 朵朵,1 = 星星 */
  player: 0 | 1;
  action: TankAction;
}

export const KEY_MAP: Readonly<Record<string, KeyBind>> = {
  KeyW: { player: 0, action: "up" },
  KeyD: { player: 0, action: "right" },
  KeyS: { player: 0, action: "down" },
  KeyA: { player: 0, action: "left" },
  KeyF: { player: 0, action: "fire" },
  KeyG: { player: 0, action: "brick" },
  ArrowUp: { player: 1, action: "up" },
  ArrowRight: { player: 1, action: "right" },
  ArrowDown: { player: 1, action: "down" },
  ArrowLeft: { player: 1, action: "left" },
  KeyL: { player: 1, action: "fire" },
  KeyK: { player: 1, action: "brick" },
};

/** 暂停键(两位玩家共用) */
export const PAUSE_KEY = "Escape";

/** 方向动作 → 方向号 */
export const ACTION_DIR: Readonly<Record<string, Dir>> = {
  up: 0,
  right: 1,
  down: 2,
  left: 3,
};

/** 两位玩家的键位有没有互相抢占(有重叠就返回重叠的键) */
export function keyConflicts(): string[] {
  const seen = new Map<string, KeyBind>();
  const bad: string[] = [];
  for (const [code, bind] of Object.entries(KEY_MAP)) {
    const prev = seen.get(code);
    if (prev && prev.player !== bind.player) bad.push(code);
    seen.set(code, bind);
  }
  return bad;
}

// ---------------------------------------------------------------------------
// 地图
// ---------------------------------------------------------------------------

export interface TankMap {
  w: number;
  h: number;
  tiles: Tile[];
  /** 每格砖墙剩余耐久(非砖墙为 0) */
  brickHp: number[];
  /** 星星堡垒所在格;对战地图没有堡垒 */
  base: Cell | null;
  /** 玩家出生点:0 号是朵朵,1 号是星星 */
  playerSpawns: Cell[];
  enemySpawns: Cell[];
}

const TILE_CHARS = new Set<string>([".", "#", "S", "~", "*", "B"]);

/** 坦克过不去的地形 */
export function blocksTank(t: Tile): boolean {
  return t === "#" || t === "S" || t === "~" || t === "B";
}

/** 炮弹飞不过去的地形(水面和草丛都能飞过) */
export function blocksBullet(t: Tile): boolean {
  return t === "#" || t === "S" || t === "B";
}

/** 挡视线的地形(草丛只挡视线) */
export function blocksSight(t: Tile): boolean {
  return t === "*" || blocksBullet(t);
}

export function cellIndex(map: TankMap, cx: number, cy: number): number {
  return cy * map.w + cx;
}

export function inside(map: TankMap, cx: number, cy: number): boolean {
  return cx >= 0 && cy >= 0 && cx < map.w && cy < map.h;
}

/** 取某格地形;越界当成钢墙,省得到处判边界 */
export function tileAt(map: TankMap, cx: number, cy: number): Tile {
  if (!inside(map, cx, cy)) return "S";
  return map.tiles[cellIndex(map, cx, cy)];
}

/**
 * 把紧凑字符网格解析成地图。行数、列数不齐或出现不认识的字符都会直接报错,
 * 这样关卡生成器一旦写错,levels.test.ts 立刻就能发现。
 */
export function parseMap(rows: readonly string[]): TankMap {
  if (rows.length === 0) throw new Error("地图不能是空的");
  const w = rows[0].length;
  const h = rows.length;
  if (w === 0) throw new Error("地图行不能是空串");
  const tiles: Tile[] = new Array<Tile>(w * h).fill(".");
  const brickHp: number[] = new Array<number>(w * h).fill(0);
  let base: Cell | null = null;
  const playerSpawns: Cell[] = [];
  const enemySpawns: Cell[] = [];

  for (let cy = 0; cy < h; cy++) {
    const row = rows[cy];
    if (row.length !== w) throw new Error(`第 ${cy + 1} 行长度是 ${row.length},应为 ${w}`);
    for (let cx = 0; cx < w; cx++) {
      const ch = row[cx];
      const i = cy * w + cx;
      if (ch === "1" || ch === "2") {
        playerSpawns[ch === "1" ? 0 : 1] = { cx, cy };
        tiles[i] = ".";
      } else if (ch === "e") {
        enemySpawns.push({ cx, cy });
        tiles[i] = ".";
      } else if (TILE_CHARS.has(ch)) {
        tiles[i] = ch as Tile;
        if (ch === "#") brickHp[i] = BRICK_HP;
        if (ch === "B") base = { cx, cy };
      } else {
        throw new Error(`第 ${cy + 1} 行第 ${cx + 1} 列出现不认识的字符「${ch}」`);
      }
    }
  }
  if (playerSpawns[0] === undefined) throw new Error("地图缺少朵朵的出生点 1");
  return { w, h, tiles, brickHp, base, playerSpawns, enemySpawns };
}

/** 把地图导回字符网格(存档 / 调试 / 测试对拍用) */
export function renderMap(map: TankMap): string[] {
  const rows: string[] = [];
  for (let cy = 0; cy < map.h; cy++) {
    let row = "";
    for (let cx = 0; cx < map.w; cx++) row += map.tiles[cellIndex(map, cx, cy)];
    rows.push(row);
  }
  for (const [i, sp] of map.playerSpawns.entries()) {
    if (!sp) continue;
    const row = rows[sp.cy];
    rows[sp.cy] = row.slice(0, sp.cx) + String(i + 1) + row.slice(sp.cx + 1);
  }
  for (const sp of map.enemySpawns) {
    const row = rows[sp.cy];
    rows[sp.cy] = row.slice(0, sp.cx) + "e" + row.slice(sp.cx + 1);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 寻路:带权距离场(砖墙可以打穿,所以只是「贵一点」而不是走不通)
// ---------------------------------------------------------------------------

export const UNREACHABLE = 1 << 28;

export interface FieldOptions {
  /** 穿一堵砖墙折算成几步(默认 4:能打穿,但绕得过就绕) */
  brickCost?: number;
  /** 这些格子当成走不通(机灵车用它把「正门」封掉,好绕到后面去) */
  blocked?: readonly Cell[];
}

/**
 * 从若干目标格出发算一张距离场:每格的值是走到最近目标要花的代价。
 * 钢墙与水面永远不通;砖墙按 brickCost 计价(坦克可以打穿它)。
 */
export function distanceField(map: TankMap, targets: readonly Cell[], opts: FieldOptions = {}): number[] {
  const brickCost = opts.brickCost ?? 4;
  const size = map.w * map.h;
  const dist = new Array<number>(size).fill(UNREACHABLE);
  const closed = new Array<boolean>(size).fill(false);
  if (opts.blocked) {
    for (const c of opts.blocked) {
      if (inside(map, c.cx, c.cy)) closed[cellIndex(map, c.cx, c.cy)] = true;
    }
  }
  const open: number[] = [];
  for (const t of targets) {
    if (!inside(map, t.cx, t.cy)) continue;
    const i = cellIndex(map, t.cx, t.cy);
    // 目标本身就在钢墙或水里(不该发生)时直接跳过,免得算出一张假的距离场
    if (closed[i] || map.tiles[i] === "S" || map.tiles[i] === "~") continue;
    dist[i] = 0;
    open.push(i);
  }

  // 格子最多几百个,直接线性找最小值就够快,不值得上堆
  while (open.length > 0) {
    let bestAt = 0;
    for (let k = 1; k < open.length; k++) {
      if (dist[open[k]] < dist[open[bestAt]]) bestAt = k;
    }
    const cur = open.splice(bestAt, 1)[0];
    if (closed[cur]) continue;
    closed[cur] = true;
    const cx = cur % map.w;
    const cy = (cur - cx) / map.w;
    for (let d = 0 as Dir; d < 4; d++) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (!inside(map, nx, ny)) continue;
      const ni = cellIndex(map, nx, ny);
      if (closed[ni]) continue;
      const tile = map.tiles[ni];
      if (tile === "S" || tile === "~") continue;
      const step = tile === "#" ? brickCost : tile === "B" ? 1 : 1;
      const next = dist[cur] + step;
      if (next < dist[ni]) {
        dist[ni] = next;
        open.push(ni);
      }
    }
  }
  return dist;
}

/** 顺着距离场往下走一步:返回该走的方向,已经在目标上或无路可走返回 -1 */
export function stepDownField(map: TankMap, field: number[], from: Cell): Dir | -1 {
  if (!inside(map, from.cx, from.cy)) return -1;
  const here = field[cellIndex(map, from.cx, from.cy)];
  if (here === 0) return -1;
  let best: Dir | -1 = -1;
  let bestVal = here;
  for (let d = 0 as Dir; d < 4; d++) {
    const nx = from.cx + DX[d];
    const ny = from.cy + DY[d];
    if (!inside(map, nx, ny)) continue;
    const v = field[cellIndex(map, nx, ny)];
    if (v < bestVal) {
      bestVal = v;
      best = d;
    }
  }
  return best;
}

/** 从 from 能不能走到 to(砖墙算能打穿) */
export function reachable(map: TankMap, from: Cell, to: Cell): boolean {
  const field = distanceField(map, [to]);
  return inside(map, from.cx, from.cy) && field[cellIndex(map, from.cx, from.cy)] < UNREACHABLE;
}

// ---------------------------------------------------------------------------
// 世界状态
// ---------------------------------------------------------------------------

export type TankSide = "player" | "enemy";

export interface Tank {
  id: number;
  side: TankSide;
  kind: TankKind;
  /** 0 = 朵朵,1 = 星星;敌人为 -1 */
  player: number;
  x: number;
  y: number;
  dir: Dir;
  speed: number;
  cool: number;
  coolMax: number;
  bulletSpeed: number;
  /** 还要挨几发才冒烟(玩家永远是 1,被打中只是弹飞) */
  armor: number;
  armorMax: number;
  /** 冒烟护罩剩余秒:>0 时打不中 */
  shield: number;
  /** 被弹飞后打转剩余秒:>0 时不能动 */
  spin: number;
  /** 备用砖块数(玩家) */
  bricks: number;
  /** 场上还剩几发自己的炮弹 */
  shots: number;
  maxShots: number;
  /** AI 用的重算计时 */
  aiTimer: number;
  aiDir: Dir | -1;
  aiFire: boolean;
  /** 敌人这一阵子想干嘛:去砸堡垒,还是先找玩家的麻烦 */
  goal: "base" | "player";
  goalTimer: number;
  /** 连着几秒动不了(撞墙或被挡住);卡住了才会去拆挡路的砖 */
  stuck: number;
  /** 这一帧有没有在动(渲染履带用) */
  moved: boolean;
}

export interface Bullet {
  id: number;
  owner: number;
  side: TankSide;
  /** 开炮的是哪位玩家(对战模式判分用) */
  player: number;
  x: number;
  y: number;
  dir: Dir;
  speed: number;
}

export type EffectKind = "smoke" | "flower" | "spark" | "crumb" | "shield";

export interface Effect {
  kind: EffectKind;
  x: number;
  y: number;
  t: number;
  life: number;
}

export interface EnemySpec {
  kind: EnemyKind;
  /** 从哪个出生点出场(下标,越界会自动取模) */
  spawn: number;
}

export type TankMode = "campaign" | "coop" | "versus" | "endless";

export interface World {
  map: TankMap;
  mode: TankMode;
  tanks: Tank[];
  bullets: Bullet[];
  effects: Effect[];
  /** 还没出场的敌人 */
  queue: EnemySpec[];
  spawnTimer: number;
  spawnGap: number;
  maxAlive: number;
  time: number;
  limit: number;
  status: "playing" | "win" | "lose";
  reason: string;
  /** 对战模式的赢家(0 朵朵 / 1 星星),其余模式为 -1 */
  winner: number;
  /** 对战模式两边把对方弹飞了几次 */
  scores: [number, number];
  /** 对战模式要弹飞几次才算赢 */
  target: number;
  defeated: number;
  bounced: number;
  score: number;
  /** 堡垒外面那层星星护罩:先替堡垒挡一发,碎了就要小心了 */
  baseShield: boolean;
  /** 开局时护墙占的格子(补墙提示与 AI 都看它) */
  fortCells: Cell[];
  /** 无尽模式已经打到第几波 */
  wave: number;
  nextId: number;
  seed: number;
  /** 确定性随机:同样的种子 + 同样的操作 = 同样的一局 */
  rng: () => number;
  /** 两位玩家都在场?(单人时 1 号位不出场) */
  players: number;
}

export interface PlayerInput {
  /** -1 表示这一帧没按方向键 */
  dir: Dir | -1;
  fire: boolean;
  brick: boolean;
}

export const IDLE_INPUT: PlayerInput = { dir: -1, fire: false, brick: false };

export interface WorldOptions {
  rows: readonly string[];
  mode: TankMode;
  queue?: readonly EnemySpec[];
  maxAlive?: number;
  limit?: number;
  players?: 1 | 2;
  bricks?: number;
  spawnGap?: number;
  /** 对战模式弹飞几次算赢 */
  target?: number;
  seed?: number;
}

function makePlayerTank(id: number, player: 0 | 1, spawn: Cell, bricks: number): Tank {
  return {
    id,
    side: "player",
    kind: player === 0 ? "duo" : "xing",
    player,
    x: spawn.cx + 0.5,
    y: spawn.cy + 0.5,
    dir: 0,
    speed: PLAYER_SPEED,
    cool: 0,
    coolMax: PLAYER_COOL,
    bulletSpeed: PLAYER_BULLET,
    armor: 1,
    armorMax: 1,
    shield: SHIELD_SECONDS,
    spin: 0,
    bricks,
    shots: 0,
    maxShots: 2,
    aiTimer: 0,
    aiDir: -1,
    aiFire: false,
    goal: "player",
    goalTimer: 0,
    stuck: 0,
    moved: false,
  };
}

/**
 * 每种敌人有多大心思直接去砸堡垒(其余时间去找玩家的麻烦)。
 * 机灵车是专门绕后偷家的,所以最高;快速兵爱追着人跑,所以最低。
 */
export const BASE_BIAS: Record<EnemyKind, number> = {
  swift: 0.12,
  armor: 0.22,
  power: 0.18,
  smart: 0.5,
};

/** 重新拿主意的间隔(秒) */
export const GOAL_SECONDS = 5;

/** 卡住多久才会动手拆挡路的砖(秒) */
export const STUCK_SECONDS = 0.7;

function makeEnemyTank(id: number, kind: EnemyKind, spawn: Cell, rand: () => number): Tank {
  const spec = ENEMY_SPECS[kind];
  return {
    id,
    side: "enemy",
    kind,
    player: -1,
    x: spawn.cx + 0.5,
    y: spawn.cy + 0.5,
    dir: 2,
    speed: spec.speed,
    cool: spec.cool * 0.5,
    coolMax: spec.cool,
    bulletSpeed: spec.bullet,
    armor: spec.armor,
    armorMax: spec.armor,
    shield: 0,
    spin: 0,
    bricks: 0,
    shots: 0,
    maxShots: kind === "power" ? 2 : 1,
    aiTimer: 0,
    aiDir: -1,
    aiFire: false,
    goal: rand() < BASE_BIAS[kind] ? "base" : "player",
    goalTimer: GOAL_SECONDS + rand() * GOAL_SECONDS,
    stuck: 0,
    moved: false,
  };
}

export function createWorld(opts: WorldOptions): World {
  const map = parseMap(opts.rows);
  const players = opts.players ?? 1;
  const bricks = opts.bricks ?? DEFAULT_BRICKS;
  const tanks: Tank[] = [];
  let nextId = 1;
  for (let p = 0; p < players; p++) {
    const spawn = map.playerSpawns[p] ?? map.playerSpawns[0];
    tanks.push(makePlayerTank(nextId++, p as 0 | 1, spawn, bricks));
  }
  return {
    map,
    mode: opts.mode,
    tanks,
    bullets: [],
    effects: [],
    queue: (opts.queue ?? []).map((q) => ({ ...q })),
    spawnTimer: 0.6,
    spawnGap: opts.spawnGap ?? 1.8,
    maxAlive: opts.maxAlive ?? 4,
    time: 0,
    limit: opts.limit ?? 180,
    status: "playing",
    reason: "",
    winner: -1,
    scores: [0, 0],
    target: opts.target ?? 3,
    defeated: 0,
    bounced: 0,
    score: 0,
    baseShield: true,
    fortCells: scanFort(map),
    wave: 0,
    nextId,
    seed: opts.seed ?? 1,
    rng: mulberry32(opts.seed ?? 20260826),
    players,
  };
}

/** 场上还活着的敌人 */
export function aliveEnemies(w: World): Tank[] {
  return w.tanks.filter((t) => t.side === "enemy");
}

export function playerTank(w: World, player: number): Tank | undefined {
  return w.tanks.find((t) => t.side === "player" && t.player === player);
}

/** 坦克所在格 */
export function tankCell(t: Tank): Cell {
  return { cx: Math.floor(t.x), cy: Math.floor(t.y) };
}

// ---------------------------------------------------------------------------
// 碰撞
// ---------------------------------------------------------------------------

function terrainBlocked(map: TankMap, x: number, y: number, half: number): boolean {
  const eps = 1e-6;
  const x0 = Math.floor(x - half + eps);
  const x1 = Math.floor(x + half - eps);
  const y0 = Math.floor(y - half + eps);
  const y1 = Math.floor(y + half - eps);
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (blocksTank(tileAt(map, cx, cy))) return true;
    }
  }
  return false;
}

function tankOverlap(a: Tank, x: number, y: number, others: Tank[]): boolean {
  const span = TANK_HALF * 2 - 0.04;
  for (const o of others) {
    if (o.id === a.id) continue;
    if (Math.abs(o.x - x) < span && Math.abs(o.y - y) < span) return true;
  }
  return false;
}

/** 坦克能不能站到 (x,y):地形与其他坦克都要让路 */
export function canStand(w: World, t: Tank, x: number, y: number): boolean {
  if (terrainBlocked(w.map, x, y, TANK_HALF)) return false;
  return !tankOverlap(t, x, y, w.tanks);
}

/** 往 dir 方向挪 dist 格;挪不动返回 false。走廊里会自动往车道中线靠一点 */
export function moveTank(w: World, t: Tank, dir: Dir, dist: number): boolean {
  t.dir = dir;
  const horizontal = dir === 1 || dir === 3;
  // 车道对齐:横着走时把 y 往最近的格中心带,免得卡在墙角出不去
  if (horizontal) {
    const lane = Math.floor(t.y) + 0.5;
    const pull = Math.max(-dist, Math.min(dist, lane - t.y));
    if (pull !== 0 && canStand(w, t, t.x, t.y + pull)) t.y += pull;
  } else {
    const lane = Math.floor(t.x) + 0.5;
    const pull = Math.max(-dist, Math.min(dist, lane - t.x));
    if (pull !== 0 && canStand(w, t, t.x + pull, t.y)) t.x += pull;
  }
  const nx = t.x + DX[dir] * dist;
  const ny = t.y + DY[dir] * dist;
  if (!canStand(w, t, nx, ny)) return false;
  t.x = nx;
  t.y = ny;
  t.moved = true;
  return true;
}

// ---------------------------------------------------------------------------
// 开炮
// ---------------------------------------------------------------------------

export function canFire(t: Tank): boolean {
  return t.cool <= 0 && t.shots < t.maxShots && t.spin <= 0;
}

export function fire(w: World, t: Tank): Bullet | null {
  if (!canFire(t)) return null;
  t.cool = t.coolMax;
  t.shots += 1;
  const b: Bullet = {
    id: w.nextId++,
    owner: t.id,
    side: t.side,
    player: t.player,
    x: t.x + DX[t.dir] * (TANK_HALF + 0.08),
    y: t.y + DY[t.dir] * (TANK_HALF + 0.08),
    dir: t.dir,
    speed: t.bulletSpeed,
  };
  w.bullets.push(b);
  return b;
}

/** 放一块备用砖:放在车头前面那一格,占着人或已经有东西就放不了 */
export function placeBrick(w: World, t: Tank): boolean {
  if (t.bricks <= 0 || t.spin > 0) return false;
  const cx = Math.floor(t.x + DX[t.dir] * 0.9);
  const cy = Math.floor(t.y + DY[t.dir] * 0.9);
  if (!inside(w.map, cx, cy)) return false;
  const i = cellIndex(w.map, cx, cy);
  if (w.map.tiles[i] !== "." && w.map.tiles[i] !== "*") return false;
  for (const o of w.tanks) {
    if (Math.abs(o.x - (cx + 0.5)) < 0.9 && Math.abs(o.y - (cy + 0.5)) < 0.9) return false;
  }
  w.map.tiles[i] = "#";
  w.map.brickHp[i] = BRICK_HP;
  t.bricks -= 1;
  w.effects.push({ kind: "crumb", x: cx + 0.5, y: cy + 0.5, t: 0, life: 0.35 });
  return true;
}

// ---------------------------------------------------------------------------
// 视线 / 射线:AI 与模拟测试都靠它判断「这一炮打出去会打到什么」
// ---------------------------------------------------------------------------

export type RayHit = "enemy" | "player" | "base" | "brick" | "steel" | "none";

export interface RayResult {
  kind: RayHit;
  dist: number;
  tankId: number;
}

/**
 * 从坦克车头往前打一条射线,报告最先撞上什么。
 * 草丛不挡炮弹,所以这里也不当障碍(看不见,但打得到)。
 */
export function lineOfFire(w: World, from: Tank, maxDist = 14): RayResult {
  const step = 0.12;
  let x = from.x + DX[from.dir] * (TANK_HALF + 0.05);
  let y = from.y + DY[from.dir] * (TANK_HALF + 0.05);
  for (let d = 0; d < maxDist; d += step) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    const tile = tileAt(w.map, cx, cy);
    if (tile === "B") return { kind: "base", dist: d, tankId: 0 };
    if (tile === "S") return { kind: "steel", dist: d, tankId: 0 };
    if (tile === "#") return { kind: "brick", dist: d, tankId: 0 };
    for (const o of w.tanks) {
      if (o.id === from.id) continue;
      if (Math.abs(o.x - x) < TANK_HALF && Math.abs(o.y - y) < TANK_HALF) {
        return { kind: o.side === "player" ? "player" : "enemy", dist: d, tankId: o.id };
      }
    }
    x += DX[from.dir] * step;
    y += DY[from.dir] * step;
  }
  return { kind: "none", dist: maxDist, tankId: 0 };
}

// ---------------------------------------------------------------------------
// 敌人 AI
// ---------------------------------------------------------------------------

/** 堡垒的「正门」:堡垒上方那一格。机灵车会把它封掉,逼自己绕到侧面或后面 */
export function frontDoor(map: TankMap): Cell[] {
  if (!map.base) return [];
  return [
    { cx: map.base.cx, cy: map.base.cy - 1 },
    { cx: map.base.cx, cy: map.base.cy - 2 },
  ];
}

function nearestPlayerCell(w: World, t: Tank): Cell | null {
  const ps = w.tanks.filter((o) => o.side === "player");
  if (ps.length === 0) return null;
  let best = ps[0];
  let bestD = Infinity;
  for (const p of ps) {
    const d = Math.abs(p.x - t.x) + Math.abs(p.y - t.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return tankCell(best);
}

/**
 * 这一格是不是堡垒的护墙(堡垒周围两格内的砖)。
 * 渲染时会把它描成星星色,提醒「这是自己家的墙,别顺手打掉」。
 */
export function isFortBrick(map: TankMap, cx: number, cy: number): boolean {
  if (!map.base) return false;
  if (tileAt(map, cx, cy) !== "#") return false;
  const dy = cy - map.base.cy;
  return Math.abs(cx - map.base.cx) <= 2 && dy <= 0 && dy >= -2;
}

/** 开局时堡垒护墙占了哪几格(用来判断后面被打出了哪些缺口) */
export function scanFort(map: TankMap): Cell[] {
  if (!map.base) return [];
  const out: Cell[] = [];
  for (let dy = -2; dy <= 0; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const cx = map.base.cx + dx;
      const cy = map.base.cy + dy;
      if (tileAt(map, cx, cy) === "#") out.push({ cx, cy });
    }
  }
  return out;
}

/** 护墙现在缺了哪几格:玩家按 G / K 就能把它们补回去 */
export function fortGaps(w: World): Cell[] {
  return w.fortCells.filter((c) => tileAt(w.map, c.cx, c.cy) !== "#");
}

function enemyTargets(w: World, t: Tank): Cell[] {
  if (t.goal === "player" || !w.map.base) {
    const cell = nearestPlayerCell(w, t);
    if (cell) return [cell];
  }
  return w.map.base ? [w.map.base] : [];
}

/**
 * 敌人这一帧想干什么。会缓存 0.3 秒,既省算力又让走位看起来不那么神经质。
 * 机灵车把堡垒正门封掉重算,于是自然而然会从侧面绕过去。
 */
export function enemyIntent(w: World, t: Tank): { dir: Dir | -1; fire: boolean } {
  const targets = enemyTargets(w, t);
  if (targets.length === 0) return { dir: -1, fire: false };
  const blocked = t.kind === "smart" && t.goal === "base" ? frontDoor(w.map) : undefined;
  const field = distanceField(w.map, targets, { brickCost: t.kind === "armor" ? 3 : 5, blocked });
  const here = tankCell(t);
  let dir = stepDownField(w.map, field, here);
  if (dir === -1 && blocked) {
    // 侧门被自己人堵死了就老老实实走正门,别原地发呆
    dir = stepDownField(w.map, distanceField(w.map, targets, { brickCost: 5 }), here);
  }
  if (dir === -1) dir = t.dir;

  // 先看看现在这个朝向能不能直接打到东西
  const ahead = lineOfFire(w, t, 9);
  if (ahead.kind === "player") return { dir, fire: true };
  if (ahead.kind === "base" && t.goal === "base") return { dir, fire: true };
  // 挡路的砖墙:先想办法绕,实在卡住了(>STUCK_SECONDS)才动手拆。
  // 就是这条规则让堡垒的护墙不会被一队车顺手啃掉。
  const nx = here.cx + DX[dir];
  const ny = here.cy + DY[dir];
  if (tileAt(w.map, nx, ny) === "#" && t.stuck > STUCK_SECONDS) {
    return { dir, fire: t.dir === dir && ahead.kind === "brick" && ahead.dist < 1.6 };
  }
  return { dir, fire: false };
}

// ---------------------------------------------------------------------------
// 炮弹结算
// ---------------------------------------------------------------------------

function damageBrick(w: World, cx: number, cy: number): void {
  const i = cellIndex(w.map, cx, cy);
  w.map.brickHp[i] -= 1;
  if (w.map.brickHp[i] <= 0) {
    w.map.tiles[i] = ".";
    w.map.brickHp[i] = 0;
  }
  w.effects.push({ kind: "crumb", x: cx + 0.5, y: cy + 0.5, t: 0, life: 0.3 });
}

function releaseShot(w: World, ownerId: number): void {
  const owner = w.tanks.find((t) => t.id === ownerId);
  if (owner) owner.shots = Math.max(0, owner.shots - 1);
}

/** 我方坦克被打中:弹回出生点转两圈,不掉血也不淘汰 */
function bouncePlayer(w: World, t: Tank): void {
  const spawn = w.map.playerSpawns[t.player] ?? w.map.playerSpawns[0];
  t.x = spawn.cx + 0.5;
  t.y = spawn.cy + 0.5;
  t.dir = 0;
  t.spin = SPIN_SECONDS;
  t.shield = SPIN_SECONDS + SHIELD_SECONDS;
  w.bounced += 1;
  w.effects.push({ kind: "smoke", x: t.x, y: t.y, t: 0, life: 0.6 });
}

/** 敌方坦克挨一发:装甲没扣完只冒烟,扣完了变成一朵花退场 */
function hitEnemy(w: World, t: Tank): void {
  t.armor -= 1;
  if (t.armor > 0) {
    t.shield = 0.25;
    w.effects.push({ kind: "smoke", x: t.x, y: t.y, t: 0, life: 0.5 });
    return;
  }
  w.tanks = w.tanks.filter((o) => o.id !== t.id);
  w.defeated += 1;
  const kind = t.kind as EnemyKind;
  w.score += ENEMY_SPECS[kind]?.score ?? 1;
  w.effects.push({ kind: "flower", x: t.x, y: t.y, t: 0, life: 0.9 });
}

/** 单发炮弹推进一小步;返回 true 表示这发炮弹没了 */
function advanceBullet(w: World, b: Bullet, dist: number): boolean {
  b.x += DX[b.dir] * dist;
  b.y += DY[b.dir] * dist;
  const cx = Math.floor(b.x);
  const cy = Math.floor(b.y);
  if (!inside(w.map, cx, cy)) {
    w.effects.push({ kind: "spark", x: b.x, y: b.y, t: 0, life: 0.2 });
    return true;
  }
  const tile = w.map.tiles[cellIndex(w.map, cx, cy)];
  if (tile === "B") {
    if (b.side === "enemy") {
      if (w.baseShield) {
        // 护罩替堡垒挨了这一发:给玩家一次补墙救场的机会
        w.baseShield = false;
        w.effects.push({ kind: "shield", x: cx + 0.5, y: cy + 0.5, t: 0, life: 0.5 });
        return true;
      }
      w.status = "lose";
      w.reason = "星星堡垒被砸中啦";
    }
    w.effects.push({ kind: "spark", x: b.x, y: b.y, t: 0, life: 0.25 });
    return true;
  }
  if (tile === "S") {
    w.effects.push({ kind: "spark", x: b.x, y: b.y, t: 0, life: 0.2 });
    return true;
  }
  if (tile === "#") {
    damageBrick(w, cx, cy);
    return true;
  }
  for (const o of w.tanks) {
    if (o.id === b.owner) continue;
    if (Math.abs(o.x - b.x) > TANK_HALF || Math.abs(o.y - b.y) > TANK_HALF) continue;
    if (o.side === b.side) {
      // 自己人的炮弹只在对战模式里算数,其余模式互相穿过去
      if (!(w.mode === "versus" && o.side === "player" && o.player !== b.player)) continue;
    }
    if (o.shield > 0) {
      w.effects.push({ kind: "shield", x: o.x, y: o.y, t: 0, life: 0.3 });
      return true;
    }
    if (o.side === "player") {
      bouncePlayer(w, o);
      if (w.mode === "versus" && b.player >= 0) {
        w.scores[b.player] += 1;
        if (w.scores[b.player] >= w.target) {
          w.status = "win";
          w.winner = b.player;
          w.reason = `${b.player === 0 ? "朵朵" : "星星"}先把对手弹飞 ${w.target} 次`;
        }
      }
    } else {
      hitEnemy(w, o);
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 主循环
// ---------------------------------------------------------------------------

function spawnFromQueue(w: World, dt: number): void {
  if (w.queue.length === 0) return;
  w.spawnTimer -= dt;
  if (w.spawnTimer > 0) return;
  if (aliveEnemies(w).length >= w.maxAlive) {
    w.spawnTimer = 0.3;
    return;
  }
  const spec = w.queue[0];
  const spots = w.map.enemySpawns;
  if (spots.length === 0) {
    w.queue.shift();
    return;
  }
  // 出生点被占着就换下一个,全占着就等一下再来
  for (let k = 0; k < spots.length; k++) {
    const spot = spots[(spec.spawn + k) % spots.length];
    const free = w.tanks.every(
      (t) => Math.abs(t.x - (spot.cx + 0.5)) >= 0.9 || Math.abs(t.y - (spot.cy + 0.5)) >= 0.9
    );
    if (!free) continue;
    w.queue.shift();
    const tank = makeEnemyTank(w.nextId++, spec.kind, spot, w.rng);
    w.tanks.push(tank);
    w.effects.push({ kind: "shield", x: tank.x, y: tank.y, t: 0, life: 0.4 });
    w.spawnTimer = w.spawnGap;
    return;
  }
  w.spawnTimer = 0.4;
}

function stepTimers(t: Tank, dt: number): void {
  t.cool = Math.max(0, t.cool - dt);
  t.shield = Math.max(0, t.shield - dt);
  t.spin = Math.max(0, t.spin - dt);
  t.moved = false;
}

function stepPlayers(w: World, dt: number, inputs: readonly PlayerInput[]): void {
  for (const t of w.tanks) {
    if (t.side !== "player") continue;
    const input = inputs[t.player] ?? IDLE_INPUT;
    if (t.spin > 0) continue;
    if (input.dir >= 0) moveTank(w, t, input.dir as Dir, t.speed * dt);
    if (input.fire) fire(w, t);
    if (input.brick) placeBrick(w, t);
  }
}

function stepEnemies(w: World, dt: number): void {
  for (const t of w.tanks) {
    if (t.side !== "enemy") continue;
    t.goalTimer -= dt;
    if (t.goalTimer <= 0) {
      const kind = t.kind as EnemyKind;
      t.goal = w.rng() < (BASE_BIAS[kind] ?? 0.4) ? "base" : "player";
      t.goalTimer = GOAL_SECONDS + w.rng() * GOAL_SECONDS;
      t.aiTimer = 0;
    }
    t.aiTimer -= dt;
    if (t.aiTimer <= 0) {
      const intent = enemyIntent(w, t);
      t.aiDir = intent.dir;
      t.aiFire = intent.fire;
      t.aiTimer = 0.3;
    }
    if (t.aiDir >= 0) {
      const ok = moveTank(w, t, t.aiDir as Dir, t.speed * dt);
      if (ok) {
        t.stuck = 0;
      } else {
        // 撞墙撞车就立刻重想一次,免得贴着墙推一整秒
        t.stuck += dt;
        t.aiTimer = Math.min(t.aiTimer, 0.05);
      }
    }
    const ahead = lineOfFire(w, t, 9);
    if (t.aiFire || ahead.kind === "player" || (ahead.kind === "base" && t.goal === "base")) {
      fire(w, t);
    }
  }
}

function stepBullets(w: World, dt: number): void {
  const alive: Bullet[] = [];
  for (const b of w.bullets) {
    let left = b.speed * dt;
    let gone = false;
    while (left > 0 && !gone) {
      const step = Math.min(0.18, left);
      left -= step;
      gone = advanceBullet(w, b, step);
    }
    if (gone) releaseShot(w, b.owner);
    else alive.push(b);
  }
  // 迎面撞上的两发炮弹互相抵消,免得对着打没完没了
  const dropped = new Set<number>();
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i];
      const b = alive[j];
      if (a.side === b.side) continue;
      if (Math.abs(a.x - b.x) < 0.3 && Math.abs(a.y - b.y) < 0.3) {
        dropped.add(a.id);
        dropped.add(b.id);
      }
    }
  }
  if (dropped.size > 0) {
    for (const b of alive) {
      if (dropped.has(b.id)) {
        releaseShot(w, b.owner);
        w.effects.push({ kind: "spark", x: b.x, y: b.y, t: 0, life: 0.2 });
      }
    }
  }
  w.bullets = alive.filter((b) => !dropped.has(b.id));
}

function stepEffects(w: World, dt: number): void {
  for (const e of w.effects) e.t += dt;
  if (w.effects.length > 0) w.effects = w.effects.filter((e) => e.t < e.life);
}

function checkEnd(w: World): void {
  if (w.status !== "playing") return;
  if (w.mode === "versus") {
    if (w.time >= w.limit) {
      w.status = "win";
      w.winner = w.scores[0] === w.scores[1] ? -1 : w.scores[0] > w.scores[1] ? 0 : 1;
      w.reason = w.winner < 0 ? "时间到,两边打成平手" : "时间到,弹飞次数多的一方获胜";
    }
    return;
  }
  if (w.mode !== "endless" && w.queue.length === 0 && aliveEnemies(w).length === 0) {
    w.status = "win";
    w.reason = "全部敌方坦克都变成花啦";
    return;
  }
  if (w.time >= w.limit) {
    w.status = "lose";
    w.reason = w.mode === "endless" ? "时间到,这一轮结束" : "时间到,还有坦克没清完";
  }
}

/** 推进一帧。dt 建议 1/60(渲染)或 1/30(模拟),两者结果一致 */
export function stepWorld(w: World, dt: number, inputs: readonly PlayerInput[] = []): void {
  if (w.status !== "playing") return;
  w.time += dt;
  for (const t of w.tanks) stepTimers(t, dt);
  spawnFromQueue(w, dt);
  stepPlayers(w, dt, inputs);
  stepEnemies(w, dt);
  stepBullets(w, dt);
  stepEffects(w, dt);
  checkEnd(w);
}

// ---------------------------------------------------------------------------
// 评分与文案
// ---------------------------------------------------------------------------

/**
 * 过关评星:清得快、被弹飞得少就是三星。
 * 这里只看「用掉了时限的百分之几」和「被弹飞几次」,两项都好才给满星。
 */
export function rateRun(usedSeconds: number, limit: number, bounced: number): 1 | 2 | 3 {
  const ratio = limit > 0 ? usedSeconds / limit : 1;
  if (bounced <= 2 && ratio <= 0.65) return 3;
  if (bounced <= 6 && ratio <= 0.9) return 2;
  return 1;
}

/** 过关时的一句话点评:说清楚这次好在哪、下次往哪使劲 */
export function winLine(stars: 1 | 2 | 3, defeated: number, bounced: number): string {
  const head = `清掉 ${defeated} 辆铁皮车,被弹飞 ${bounced} 次。`;
  if (stars === 3) return `${head}又快又稳,堡垒一点灰都没沾上!`;
  if (stars === 2) return `${head}打得不错,下次少挨两发就能拿满星。`;
  return `${head}过关就好,试试先补上堡垒周围的砖再出门。`;
}

/** 失败时的一句话:只讲方法,不讲输赢 */
export function loseLine(reason: string, defeated: number): string {
  if (reason.includes("堡垒")) {
    return `堡垒被砸到了。下次留一个人守在堡垒边上,发现砖墙缺口就用 G / K 补回去。`;
  }
  return `时间到,还差 几辆没清完(已经清掉 ${defeated} 辆)。先打离堡垒最近的那一辆,会省很多时间。`;
}

/** 无尽模式:第 n 波派几辆车 */
export function endlessWaveSize(wave: number): number {
  return Math.min(14, 3 + Math.floor(wave * 0.8));
}

/** 无尽模式:第 n 波允许同时在场几辆 */
export function endlessMaxAlive(wave: number): number {
  return Math.min(8, 3 + Math.floor(wave / 3));
}

/** 无尽模式:第 n 波的敌人配比(越往后越硬) */
export function endlessWave(wave: number, rand: () => number): EnemySpec[] {
  const size = endlessWaveSize(wave);
  const pool: EnemyKind[] = ["swift"];
  if (wave >= 2) pool.push("armor");
  if (wave >= 3) pool.push("power");
  if (wave >= 4) pool.push("smart");
  const out: EnemySpec[] = [];
  for (let i = 0; i < size; i++) {
    const kind = pool[Math.floor(rand() * pool.length)] ?? "swift";
    out.push({ kind, spawn: Math.floor(rand() * 3) });
  }
  return out;
}
