/**
 * 铁皮坦克大战 · 纯逻辑层(不碰 DOM,可以直接在测试里跑完整一关)。
 *
 * 战场是一张紧凑的字符网格:
 *   `.` 空地   `#` 积木砖(能打碎,一小角一小角地碎)   `S` 钢板(要彩纸穿甲弹)
 *   `~` 水洼(开不过去,弹丸飞得过)   `*` 草丛(半透明遮挡)   `i` 冰面(打滑)
 *   `B` 星星老巢   `1`/`2` 朵朵 / 星星出生点   `e` 铁皮车出生点
 *
 * 1.2 在这一层加了三件事:地形五件套(补冰面 + 砖的四分之一格)、
 * 三种弹丸(直线弹 / 弹力球 / 彩纸穿甲弹,`ballistics12.ts`)、
 * 三档 AI(乱转 / 追人 / 绕后卡位,`ai12.ts`)。
 *
 * 全程没有血量、没有受伤、没有淘汰的说法:
 *  - 铁皮车挨够弹丸就「冒烟变成一朵花」离场;
 *  - 自己人被打中是「零件散一地」,3 秒后在出生点组装回来接着开;
 *  - 星星老巢被砸中就是这一关结束,重来一次即可。
 */

import { mulberry32 } from "../level99";
import {
  BRICK_FULL,
  DX,
  DY,
  brickGone,
  chipBrick,
  iceGlide,
  iceSteer,
  isSlippery,
  isTile,
  maskToHp,
  quarterSolid,
  blocksShell,
  blocksSight as terrainBlocksSight,
  blocksTank as terrainBlocksTank,
  type Cell,
  type Dir,
  type Tile,
} from "./terrain12";
import { SHELLS, reflect, shotVelocity, type BlockedAt, type ShellKind, type Vec2 } from "./ballistics12";
import {
  TIER_SPECS,
  astar,
  flankPick,
  manhattan,
  pathDirs,
  wanderStep,
  type AiTier,
  type Grid,
} from "./ai12";

export type { Cell, Dir, Tile } from "./terrain12";
export { DX, DY } from "./terrain12";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 坦克半宽(格) */
export const TANK_HALF = 0.38;
/** 一整块新砖要挨几发普通弹丸才没(正面对着打的话) */
export const BRICK_HP = 2;
/** 每位玩家开局带几块备用砖 */
export const DEFAULT_BRICKS = 4;
/**
 * 被打中之后要多久才回得来(秒)。
 * 这 3 秒里零件散了一地,然后在出生点一件一件组装回来——没有淘汰,也没有伤。
 */
export const REBUILD_SECONDS = 3;
/** 兼容旧名字:这段时间既不能动,也不会再被打中 */
export const SPIN_SECONDS = REBUILD_SECONDS;
/** 零件飞散占前面这几秒,剩下的时间在出生点组装 */
export const SCATTER_SECONDS = 1.1;
/** 组装好之后的护罩时长(秒):刚回场的一小会儿不会被再打散 */
export const SHIELD_SECONDS = 2.2;
/** 炮口前摇(秒):按下到弹丸出膛之间的一小顿,手感就靠它 */
export const MUZZLE_WINDUP = 0.09;
/** 后坐位移(格):渲染时折算成 4–6px */
export const RECOIL_CELLS = 0.16;
/** 后坐弹回来要多久(秒) */
export const RECOIL_SECONDS = 0.18;

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

/**
 * 换弹丸的键(1.2 新增)。单独放一张表:
 * `KEY_MAP` 里那六个动作是「一直按着」的,换弹是「按一下」的,混在一起两边都别扭。
 */
export const SHELL_KEY_MAP: Readonly<Record<string, 0 | 1>> = {
  KeyR: 0,
  KeyO: 1,
};

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
  /** 每格砖墙剩余耐久(非砖墙为 0);= 剩下的小块数 ÷ 2,向上取整 */
  brickHp: number[];
  /** 每格砖的四个小块还剩哪几个(四分之一格粒度) */
  brickMask: number[];
  /** 星星堡垒所在格;对战地图没有堡垒 */
  base: Cell | null;
  /** 玩家出生点:0 号是朵朵,1 号是星星 */
  playerSpawns: Cell[];
  enemySpawns: Cell[];
}

/** 坦克过不去的地形(地形字典在 `terrain12.ts`) */
export function blocksTank(t: Tile): boolean {
  return terrainBlocksTank(t);
}

/** 弹丸飞不过去的地形(水洼和草丛都飞得过) */
export function blocksBullet(t: Tile): boolean {
  return blocksShell(t);
}

/** 挡视线的地形(草丛只挡视线) */
export function blocksSight(t: Tile): boolean {
  return terrainBlocksSight(t);
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
  const brickMask: number[] = new Array<number>(w * h).fill(0);
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
      } else if (isTile(ch)) {
        tiles[i] = ch;
        if (ch === "#") {
          brickHp[i] = BRICK_HP;
          brickMask[i] = BRICK_FULL;
        }
        if (ch === "B") base = { cx, cy };
      } else {
        throw new Error(`第 ${cy + 1} 行第 ${cx + 1} 列出现不认识的字符「${ch}」`);
      }
    }
  }
  if (playerSpawns[0] === undefined) throw new Error("地图缺少朵朵的出生点 1");
  return { w, h, tiles, brickHp, brickMask, base, playerSpawns, enemySpawns };
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
  /** 散架剩余秒:>0 时零件还在飞 / 还在组装,动不了也打不中 */
  spin: number;
  /** 零件是从哪儿散开的(渲染用) */
  scatterX: number;
  scatterY: number;
  /** 现在装的是哪种弹丸 */
  shell: ShellKind;
  /** 弹力球下一发往哪边斜(每打一发换一边,预测虚线会跟着翻) */
  tilt: 1 | -1;
  /** 炮口前摇剩余秒:>0 表示已经按下,弹丸还没出膛 */
  windup: number;
  /** 前摇结束要打哪种弹丸 */
  windupShell: ShellKind;
  /** 后坐剩余秒(渲染把车身往后推 4–6px) */
  recoil: number;
  /** 冰上滑行速度(格/秒)与滑行方向 */
  glide: number;
  glideDir: Dir;
  /** 备用砖块数(玩家) */
  bricks: number;
  /** 场上还剩几发自己的炮弹 */
  shots: number;
  maxShots: number;
  /** AI 用的重算计时 */
  aiTimer: number;
  aiDir: Dir | -1;
  aiFire: boolean;
  /** 这辆车的脾气分档:乱转 / 追人 / 绕后卡位 */
  tier: AiTier;
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
  /** 开火的是哪位玩家(对战模式判分用) */
  player: number;
  x: number;
  y: number;
  dir: Dir;
  speed: number;
  /** 哪一种弹丸;不写就是直线弹 */
  kind?: ShellKind;
  /** 速度方向(单位向量);不写就按 dir 走直线 */
  vx?: number;
  vy?: number;
  /** 还能弹几次墙 */
  bounces?: number;
  /** 还能穿几层墙 */
  pierces?: number;
}

/** 一发弹丸的速度方向(老数据只有 dir 也认) */
export function bulletVec(b: Bullet): Vec2 {
  if (b.vx === undefined || b.vy === undefined) return { x: DX[b.dir], y: DY[b.dir] };
  return { x: b.vx, y: b.vy };
}

export function bulletKind(b: Bullet): ShellKind {
  return b.kind ?? "plain";
}

export type EffectKind = "smoke" | "flower" | "spark" | "crumb" | "shield" | "parts" | "build";

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
  /** 老巢外面那层星星护罩:先替老巢挡一发,碎了要等它自己充能回来 */
  baseShield: boolean;
  /** 护罩还要充几秒才回来(护罩还在时是 0) */
  shieldTimer: number;
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
  /**
   * 哪个位子交给电脑陪练(对战一个人来的时候用):
   * `aiTiers[1] = "chase"` 就是星星那台由电脑开,难度是「追人」。
   */
  aiTiers: Array<AiTier | null>;
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
  /** 哪个位子交给电脑陪练 */
  aiTiers?: ReadonlyArray<AiTier | null>;
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
    scatterX: spawn.cx + 0.5,
    scatterY: spawn.cy + 0.5,
    shell: "plain",
    tilt: 1,
    windup: 0,
    windupShell: "plain",
    recoil: 0,
    glide: 0,
    glideDir: 0,
    bricks,
    shots: 0,
    maxShots: 2,
    aiTimer: 0,
    aiDir: -1,
    aiFire: false,
    tier: "chase",
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
  swift: 0.06,
  armor: 0.11,
  power: 0.09,
  smart: 0.3,
};

/** 重新拿主意的间隔(秒) */
export const GOAL_SECONDS = 5;

/** 卡住多久才会动手拆挡路的砖(秒) */
export const STUCK_SECONDS = 0.7;

/**
 * 每种铁皮车的脾气分档。三档是分开的三套走法(见 `ai12.ts`):
 * 快速兵满场乱转,装甲车和火力车认准人就追,机灵车专门绕后卡位。
 */
export const TIER_BY_KIND: Record<EnemyKind, AiTier> = {
  swift: "wander",
  armor: "chase",
  power: "chase",
  smart: "flank",
};

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
    scatterX: spawn.cx + 0.5,
    scatterY: spawn.cy + 0.5,
    shell: "plain",
    tilt: 1,
    windup: 0,
    windupShell: "plain",
    recoil: 0,
    glide: 0,
    glideDir: 2,
    bricks: 0,
    shots: 0,
    maxShots: kind === "power" ? 2 : 1,
    aiTimer: 0,
    aiDir: -1,
    aiFire: false,
    tier: TIER_BY_KIND[kind],
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
    shieldTimer: 0,
    fortCells: scanFort(map),
    wave: 0,
    nextId,
    seed: opts.seed ?? 1,
    rng: mulberry32(opts.seed ?? 20260826),
    players,
    aiTiers: [opts.aiTiers?.[0] ?? null, opts.aiTiers?.[1] ?? null],
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

/** 站着的这一格滑不滑 */
export function onIce(w: World, t: Tank): boolean {
  return isSlippery(tileAt(w.map, Math.floor(t.x), Math.floor(t.y)));
}

/**
 * 冰上溜车:不改车头朝向,只让车身继续往前滑。
 * 于是在冰上「炮口指着一边、人往另一边溜」是做得到的——这也是冰面最好玩的地方。
 */
export function slideTank(w: World, t: Tank, dir: Dir, dist: number): boolean {
  const nx = t.x + DX[dir] * dist;
  const ny = t.y + DY[dir] * dist;
  if (!canStand(w, t, nx, ny)) return false;
  t.x = nx;
  t.y = ny;
  t.moved = true;
  return true;
}

/**
 * 走一帧。空地上说停就停;冰上起步慢、松手还要溜一段(`terrain12.ts` 的摩擦公式)。
 * 返回这一帧到底有没有挪动。
 */
export function driveTank(w: World, t: Tank, want: Dir | -1, dt: number): boolean {
  const ice = onIce(w, t);
  if (want >= 0) {
    if (!ice) {
      t.glide = 0;
      return moveTank(w, t, want as Dir, t.speed * dt);
    }
    // 冰上蹬地:方向立刻改,速度得慢慢加
    if (t.glideDir !== want) {
      t.glide = Math.max(0, t.glide - t.speed * dt);
      if (t.glide <= 0.05) t.glideDir = want as Dir;
    } else {
      t.glide = iceSteer(t.glide, t.speed, dt);
    }
    const moved = moveTank(w, t, want as Dir, Math.max(t.glide, t.speed * 0.35) * dt);
    if (!moved) t.glide = 0;
    return moved;
  }
  if (!ice || t.glide <= 0) {
    t.glide = 0;
    return false;
  }
  // 松手了:顺着原来的方向溜,朝向不变
  const moved = slideTank(w, t, t.glideDir, t.glide * dt);
  t.glide = moved ? iceGlide(t.glide, dt) : 0;
  return moved;
}

// ---------------------------------------------------------------------------
// 开火
// ---------------------------------------------------------------------------

export function canFire(t: Tank): boolean {
  return t.cool <= 0 && t.shots < t.maxShots && t.spin <= 0 && t.windup <= 0;
}

/** 这一发弹丸的冷却:好用的弹丸要多等一会儿 */
export function shellCool(t: Tank, kind: ShellKind): number {
  return t.coolMax * SHELLS[kind].coolMul;
}

/**
 * 扣下扳机。有一点点前摇(`MUZZLE_WINDUP`),弹丸在前摇结束的那一帧才出膛——
 * 就是这一小顿让「开火」有分量。前摇期间再按不叠加。
 */
export function pullTrigger(w: World, t: Tank, kind: ShellKind = t.shell): boolean {
  if (!canFire(t)) return false;
  t.windup = MUZZLE_WINDUP;
  t.windupShell = kind;
  t.cool = shellCool(t, kind);
  t.shots += 1;
  return true;
}

/** 弹丸真的出膛(前摇走完,或者测试 / AI 直接开一发) */
export function launch(w: World, t: Tank, kind: ShellKind = t.shell): Bullet {
  const spec = SHELLS[kind];
  const v = shotVelocity(t.dir, kind, t.tilt);
  const b: Bullet = {
    id: w.nextId++,
    owner: t.id,
    side: t.side,
    player: t.player,
    x: t.x + v.x * (TANK_HALF + 0.08),
    y: t.y + v.y * (TANK_HALF + 0.08),
    dir: t.dir,
    speed: t.bulletSpeed * spec.speedMul,
    kind,
    vx: v.x,
    vy: v.y,
    bounces: spec.maxBounces,
    pierces: spec.pierceBlocks,
  };
  if (kind === "bounce") t.tilt = t.tilt === 1 ? -1 : 1;
  t.recoil = RECOIL_SECONDS;
  w.bullets.push(b);
  return b;
}

/**
 * 开一发(老接口:立刻出膛,没有前摇)。
 * 运行时走 `pullTrigger`,AI 与用例走这条,两边打出来的弹丸一模一样。
 */
export function fire(w: World, t: Tank, kind: ShellKind = t.shell): Bullet | null {
  if (!canFire(t)) return null;
  t.cool = shellCool(t, kind);
  t.shots += 1;
  return launch(w, t, kind);
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
  w.map.brickMask[i] = BRICK_FULL;
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
 * 把当前地图翻成 `ai12.ts` 认识的格子图:
 * 钢板 / 水洼 / 老巢是墙,砖只是「贵一点」(打得穿)。
 */
export function worldGrid(w: World, brickCost = 5): Grid {
  return {
    w: w.map.w,
    h: w.map.h,
    wall: (cx, cy) => {
      const tile = tileAt(w.map, cx, cy);
      return tile === "S" || tile === "~" || tile === "B";
    },
    cost: (cx, cy) => (tileAt(w.map, cx, cy) === "#" ? brickCost : 1),
  };
}

/** 乱转的车离目标这么近就不装了,直接扑上去(格) */
export const WANDER_LOCK = 6;
/** 乱转的车每次拿主意时,有这么大概率会朝目标那边挪一步(其余时间真的在瞎逛) */
export const WANDER_DRIFT = 0.25;

/** 一辆车正前方的两格:绕后的时候要躲开这条炮口线 */
export function muzzleCells(t: Tank): Cell[] {
  const here = tankCell(t);
  return [
    { cx: here.cx + DX[t.dir], cy: here.cy + DY[t.dir] },
    { cx: here.cx + DX[t.dir] * 2, cy: here.cy + DY[t.dir] * 2 },
  ];
}

/** A\* 找路的第一步(墙角过路费默认开着,所以不会往死胡同里钻) */
export function stepToward(grid: Grid, from: Cell, to: Cell, blocked?: readonly Cell[]): Dir | -1 {
  const path = astar(grid, from, to, blocked ? { blocked } : {});
  if (!path || path.length < 2) return -1;
  return pathDirs(path)[0] ?? -1;
}

/**
 * 铁皮车这一帧想干什么。按脾气分档走三套路子(`ai12.ts`):
 * 乱转的瞎逛、追人的用 A\* 一路找过去、绕后的先把正门封掉再算路。
 * 拿定的主意会缓存一小会儿,既省算力又让走位看着不神经质。
 */
export function enemyIntent(w: World, t: Tank): { dir: Dir | -1; fire: boolean } {
  const targets = enemyTargets(w, t);
  if (targets.length === 0) return { dir: -1, fire: false };
  const spec = TIER_SPECS[t.tier];
  const here = tankCell(t);
  const target = targets[0];
  const grid = worldGrid(w, t.kind === "armor" ? 3 : 5);

  let dir: Dir | -1 = -1;
  // 乱转的车也不是瞎子:目标凑到眼前了就扑上去,平时也会往那边飘一飘
  const hunts = spec.paths || manhattan(here, target) <= WANDER_LOCK || w.rng() < WANDER_DRIFT;
  if (hunts) {
    let goal = target;
    let blocked: Cell[] | undefined;
    if (spec.flanks && t.goal === "base" && w.map.base) {
      blocked = frontDoor(w.map);
      const side = flankPick(grid, w.map.base, blocked, here);
      if (side) goal = side;
    }
    dir = stepToward(grid, here, goal, blocked);
    // 侧门也被堵死了就老老实实走正门,别原地发呆
    if (dir === -1) dir = stepToward(grid, here, target);
  }
  if (dir === -1) dir = wanderStep(grid, here, t.dir, w.rng);

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

/**
 * 电脑陪练:对战模式里一个人来的时候,另一台车交给它开。
 * 用的是同一套三档脾气——`wander` 瞎逛顺手打、`chase` A\* 追着打、
 * `flank` 绕开对方炮口线从侧面摸过去。
 */
export function aiPlayerInput(w: World, t: Tank, tier: AiTier): PlayerInput {
  if (t.spin > 0) return IDLE_INPUT;
  const spec = TIER_SPECS[tier];
  const foe = w.tanks.find((o) => o.id !== t.id && (o.side !== t.side || o.player !== t.player));
  if (!foe) return IDLE_INPUT;
  const here = tankCell(t);
  const there = tankCell(foe);
  const ray = lineOfFire(w, t, spec.fireRange);
  // 已经瞄上了:站住别动,先来一发
  if (ray.kind === "player" || ray.kind === "enemy") return { dir: -1, fire: true, brick: false };

  const grid = worldGrid(w, 4);
  let dir: Dir | -1 = -1;
  const hunts = spec.paths || manhattan(here, there) <= WANDER_LOCK;
  if (hunts) {
    let goal = there;
    if (spec.flanks) {
      const side = flankPick(grid, there, muzzleCells(foe), here);
      if (side) goal = side;
    }
    dir = stepToward(grid, here, goal);
    if (dir === -1) dir = stepToward(grid, here, there);
  }
  if (dir === -1) dir = wanderStep(grid, here, t.dir, w.rng);

  const nx = here.cx + DX[dir];
  const ny = here.cy + DY[dir];
  const wantFire = tileAt(w.map, nx, ny) === "#" && t.dir === dir && ray.kind === "brick" && ray.dist < 1.8;
  return { dir, fire: wantFire, brick: false };
}

// ---------------------------------------------------------------------------
// 弹丸结算
// ---------------------------------------------------------------------------

/**
 * 一发弹丸打在砖上:按四分之一格结算。
 * `cross` 是弹丸在另一根轴上的格内位置——打在格中线上就一次崩掉半格(老规矩两发一格),
 * 打偏了只崩掉一角,墙上就多出一条只有弹丸钻得过的缝。
 */
function damageBrick(w: World, cx: number, cy: number, dir: Dir, cross: number, whole = false): void {
  const i = cellIndex(w.map, cx, cy);
  const before = w.map.brickMask[i] || BRICK_FULL;
  const after = whole ? 0 : chipBrick(before, dir, cross);
  w.map.brickMask[i] = after;
  w.map.brickHp[i] = maskToHp(after);
  if (brickGone(after)) {
    w.map.tiles[i] = ".";
    w.map.brickHp[i] = 0;
    w.map.brickMask[i] = 0;
  }
  w.effects.push({ kind: "crumb", x: cx + 0.5, y: cy + 0.5, t: 0, life: 0.3 });
}

/** 彩纸穿甲弹拆钢板:钢板碎成一地彩纸,留下一块空地 */
function breakSteel(w: World, cx: number, cy: number): void {
  const i = cellIndex(w.map, cx, cy);
  w.map.tiles[i] = ".";
  w.map.brickHp[i] = 0;
  w.map.brickMask[i] = 0;
  w.effects.push({ kind: "spark", x: cx + 0.5, y: cy + 0.5, t: 0, life: 0.35 });
}

/** 弹丸在这一点上过不过得去(砖只看那一个小块,所以缺口能钻) */
export function shellBlockedAt(w: World, cx: number, cy: number, x: number, y: number): boolean {
  const tile = tileAt(w.map, cx, cy);
  if (!blocksShell(tile)) return false;
  if (tile !== "#") return true;
  const i = cellIndex(w.map, cx, cy);
  if (!inside(w.map, cx, cy)) return true;
  return quarterSolid(w.map.brickMask[i] || BRICK_FULL, x - cx, y - cy);
}

/** 给弹道预测用:一张「哪里挡弹丸」的问答表 */
export function blockedProbe(w: World): BlockedAt {
  return (cx, cy, x, y) => shellBlockedAt(w, cx, cy, x, y);
}

function releaseShot(w: World, ownerId: number): void {
  const owner = w.tanks.find((t) => t.id === ownerId);
  if (owner) owner.shots = Math.max(0, owner.shots - 1);
}

/**
 * 自己人被打中:零件散一地,3 秒后在出生点一件一件组装回来。
 * 没有淘汰、没有伤,连「掉血」这个词都不存在——只是要等一会儿才回得来。
 */
/** 出生点周围这么近有铁皮车,就算「有人堵门」 */
export const SAFE_SPAWN_DIST = 3;

/** 星星护罩碎了之后,过这么多秒自己充能回来 */
export const BASE_SHIELD_REGROW = 14;

/**
 * 挑一个组装回来的地方:自己的出生点门口有车堵着,就先去队友那个点组装。
 * 没有这一条的话,一辆车守在出生点门口就能把人按在原地反复打散,那太糟心了。
 */
export function safeSpawn(w: World, player: number): Cell {
  const spots = w.map.playerSpawns;
  const mine = spots[player] ?? spots[0];
  const risk = (c: Cell): number => {
    let n = 0;
    for (const o of w.tanks) {
      if (o.side !== "enemy") continue;
      if (Math.abs(o.x - (c.cx + 0.5)) + Math.abs(o.y - (c.cy + 0.5)) <= SAFE_SPAWN_DIST) n += 1;
    }
    return n;
  };
  if (risk(mine) === 0) return mine;
  let best = mine;
  let bestRisk = risk(mine);
  for (const spot of spots) {
    if (!spot) continue;
    const r = risk(spot);
    if (r < bestRisk) {
      bestRisk = r;
      best = spot;
    }
  }
  return best;
}

function scatterPlayer(w: World, t: Tank): void {
  const spawn = safeSpawn(w, t.player);
  t.scatterX = t.x;
  t.scatterY = t.y;
  t.x = spawn.cx + 0.5;
  t.y = spawn.cy + 0.5;
  t.dir = 0;
  t.glide = 0;
  // 前摇里被打散的话,那一发没打出去,得把占着的位子还回来,
  // 不然场上炮弹名额会被吃掉,再也开不了火
  if (t.windup > 0) {
    t.windup = 0;
    t.shots = Math.max(0, t.shots - 1);
  }
  t.spin = REBUILD_SECONDS;
  t.shield = REBUILD_SECONDS + SHIELD_SECONDS;
  w.bounced += 1;
  w.effects.push({ kind: "parts", x: t.scatterX, y: t.scatterY, t: 0, life: SCATTER_SECONDS });
  w.effects.push({ kind: "build", x: t.x, y: t.y, t: 0, life: REBUILD_SECONDS });
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

/** 弹丸撞墙:能弹就按反射公式弹开,返回 true 表示这一发到此为止 */
function bounceOffWall(w: World, b: Bullet, fromX: number, fromY: number): boolean {
  if ((b.bounces ?? 0) <= 0) return true;
  const v = bulletVec(b);
  const axis =
    (shellBlockedAt(w, Math.floor(b.x), Math.floor(fromY), b.x, fromY) ? 1 : 0) +
    (shellBlockedAt(w, Math.floor(fromX), Math.floor(b.y), fromX, b.y) ? 2 : 0);
  const back = reflect(v, axis === 1 ? "x" : axis === 2 ? "y" : "both");
  b.vx = back.x;
  b.vy = back.y;
  b.bounces = (b.bounces ?? 0) - 1;
  // 退回撞墙前那一点,免得卡在墙里反复反射
  b.x = fromX;
  b.y = fromY;
  // 车头朝向只用来画图,顺手对齐到最接近的轴向
  b.dir = Math.abs(back.x) >= Math.abs(back.y) ? (back.x >= 0 ? 1 : 3) : back.y >= 0 ? 2 : 0;
  w.effects.push({ kind: "spark", x: b.x, y: b.y, t: 0, life: 0.18 });
  return false;
}

/** 单发弹丸推进一小步;返回 true 表示这一发没了 */
function advanceBullet(w: World, b: Bullet, dist: number): boolean {
  const v = bulletVec(b);
  const fromX = b.x;
  const fromY = b.y;
  b.x += v.x * dist;
  b.y += v.y * dist;
  const cx = Math.floor(b.x);
  const cy = Math.floor(b.y);
  if (!inside(w.map, cx, cy)) {
    if ((b.bounces ?? 0) > 0) return bounceOffWall(w, b, fromX, fromY);
    w.effects.push({ kind: "spark", x: b.x, y: b.y, t: 0, life: 0.2 });
    return true;
  }
  const tile = w.map.tiles[cellIndex(w.map, cx, cy)];
  if (tile === "B") {
    if (b.side === "enemy") {
      if (w.baseShield) {
        // 护罩替老巢挨了这一发:给玩家一段补墙救场的时间,护罩自己会再充回来
        w.baseShield = false;
        w.shieldTimer = BASE_SHIELD_REGROW;
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
    // 钢板:只有彩纸穿甲弹拆得动,弹力球会被弹开,普通弹丸就散了
    if (SHELLS[bulletKind(b)].breaksSteel && (b.pierces ?? 0) > 0) {
      breakSteel(w, cx, cy);
      b.pierces = (b.pierces ?? 0) - 1;
      return (b.pierces ?? 0) <= 0;
    }
    if ((b.bounces ?? 0) > 0) return bounceOffWall(w, b, fromX, fromY);
    w.effects.push({ kind: "spark", x: b.x, y: b.y, t: 0, life: 0.2 });
    return true;
  }
  if (tile === "#") {
    const i = cellIndex(w.map, cx, cy);
    const mask = w.map.brickMask[i] || BRICK_FULL;
    // 缺口已经开在这儿了,弹丸直接钻过去
    if (!quarterSolid(mask, b.x - cx, b.y - cy)) return false;
    const vertical = Math.abs(v.y) >= Math.abs(v.x);
    const face: Dir = vertical ? (v.y >= 0 ? 2 : 0) : v.x >= 0 ? 1 : 3;
    const cross = vertical ? b.x - cx : b.y - cy;
    if (SHELLS[bulletKind(b)].breaksSteel && (b.pierces ?? 0) > 0) {
      damageBrick(w, cx, cy, face, cross, true);
      b.pierces = (b.pierces ?? 0) - 1;
      return (b.pierces ?? 0) <= 0;
    }
    damageBrick(w, cx, cy, face, cross);
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
      scatterPlayer(w, o);
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

function stepTimers(w: World, t: Tank, dt: number): void {
  t.cool = Math.max(0, t.cool - dt);
  t.shield = Math.max(0, t.shield - dt);
  t.spin = Math.max(0, t.spin - dt);
  t.recoil = Math.max(0, t.recoil - dt);
  t.moved = false;
  if (t.windup > 0) {
    t.windup -= dt;
    // 前摇走完的那一帧,弹丸才真的出膛
    if (t.windup <= 0) {
      t.windup = 0;
      if (t.spin <= 0) launch(w, t, t.windupShell);
      else t.shots = Math.max(0, t.shots - 1);
    }
  }
}

/**
 * 一位玩家这一帧的操作。
 * 位子上坐的是电脑陪练(`w.aiTiers`)就把摇杆交给 AI,其余照读真人的输入。
 */
export function inputForPlayer(w: World, t: Tank, inputs: readonly PlayerInput[]): PlayerInput {
  const tier = w.aiTiers[t.player];
  if (tier) return aiPlayerInput(w, t, tier);
  return inputs[t.player] ?? IDLE_INPUT;
}

function stepPlayers(w: World, dt: number, inputs: readonly PlayerInput[]): void {
  for (const t of w.tanks) {
    if (t.side !== "player") continue;
    if (t.spin > 0) continue;
    const input = inputForPlayer(w, t, inputs);
    driveTank(w, t, input.dir, dt);
    if (input.fire) pullTrigger(w, t);
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
      const ok = driveTank(w, t, t.aiDir as Dir, dt);
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

/** 护罩充能:碎了不是就没了,等一会儿它自己会亮回来 */
function stepBaseShield(w: World, dt: number): void {
  if (w.baseShield || !w.map.base || w.shieldTimer <= 0) return;
  w.shieldTimer -= dt;
  if (w.shieldTimer > 0) return;
  w.shieldTimer = 0;
  w.baseShield = true;
  w.effects.push({ kind: "shield", x: w.map.base.cx + 0.5, y: w.map.base.cy + 0.5, t: 0, life: 0.6 });
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
  for (const t of [...w.tanks]) stepTimers(w, t, dt);
  spawnFromQueue(w, dt);
  stepPlayers(w, dt, inputs);
  stepEnemies(w, dt);
  stepBullets(w, dt);
  stepBaseShield(w, dt);
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
