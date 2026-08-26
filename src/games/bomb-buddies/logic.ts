// 泡泡炸弹人 · 纯逻辑层。
//
// 这一层只算数,不画一个像素、不碰一次 DOM:
//  - 棋盘与走位(硬墙 / 软砖 / 空地,踢炸弹、穿砖);
//  - 爆风传播与连锁引爆(`blastCells` / `chainBombs`,纯函数);
//  - 软砖里的道具掉落(`rollItem`,同一颗种子同一格永远掉同一件);
//  - 世界推进 `stepWorld`:给定 dt 与两位玩家的意图,把炸弹、爆风、
//    小怪、道具、出口全部往前走一帧,并把这一帧发生的事记成事件。
//
// 全程没有血、没有伤、没有死亡:被爆风碰到的人和小怪只是被泡泡包起来,
// 玩家困几秒自己就破泡泡出来,小怪则开开心心飘回家。
//
// 逃生路径与 AI 决策在 ai.ts;关卡数据在 levels.ts;画面在 index.ts。

// ---------------------------------------------------------------------------
// 棋盘
// ---------------------------------------------------------------------------

export const TILE_FLOOR = 0;
export const TILE_HARD = 1;
export const TILE_SOFT = 2;

/** 0=空地 1=硬墙(炸不动) 2=软砖(能炸,可能藏道具) */
export type Tile = 0 | 1 | 2;

export interface Board {
  w: number;
  h: number;
  cells: Tile[];
}

export const DIR_UP = 0;
export const DIR_RIGHT = 1;
export const DIR_DOWN = 2;
export const DIR_LEFT = 3;
export const DIR_NONE = -1;

/** 四个方向的 (dx, dy),下标就是 DIR_* */
export const DIRS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

export function makeBoard(w: number, h: number, fill: Tile = TILE_FLOOR): Board {
  return { w, h, cells: new Array<Tile>(w * h).fill(fill) };
}

export function cloneBoard(b: Board): Board {
  return { w: b.w, h: b.h, cells: b.cells.slice() };
}

export function inside(b: Board, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < b.w && y < b.h;
}

export function idx(b: Board, x: number, y: number): number {
  return y * b.w + x;
}

export function xOf(b: Board, i: number): number {
  return i % b.w;
}

export function yOf(b: Board, i: number): number {
  return Math.floor(i / b.w);
}

/** 越界一律当硬墙,省得每个调用方都自己判边界 */
export function tileAt(b: Board, x: number, y: number): Tile {
  return inside(b, x, y) ? b.cells[idx(b, x, y)] : TILE_HARD;
}

export function tileOf(b: Board, cell: number): Tile {
  if (cell < 0 || cell >= b.cells.length) return TILE_HARD;
  return b.cells[cell];
}

/** 相邻格(不含自己),越界的方向直接不返回 */
export function neighbors(b: Board, cell: number): number[] {
  const x = xOf(b, cell);
  const y = yOf(b, cell);
  const out: number[] = [];
  for (const d of DIRS) {
    const nx = x + d.dx;
    const ny = y + d.dy;
    if (inside(b, nx, ny)) out.push(idx(b, nx, ny));
  }
  return out;
}

/** 沿方向走一格,越界返回 -1 */
export function stepCell(b: Board, cell: number, dir: number): number {
  const d = DIRS[dir];
  if (!d) return -1;
  const nx = xOf(b, cell) + d.dx;
  const ny = yOf(b, cell) + d.dy;
  return inside(b, nx, ny) ? idx(b, nx, ny) : -1;
}

/** 棋盘上两格的曼哈顿距离 */
export function manhattan(b: Board, a: number, c: number): number {
  return Math.abs(xOf(b, a) - xOf(b, c)) + Math.abs(yOf(b, a) - yOf(b, c));
}

// ---------------------------------------------------------------------------
// 道具
// ---------------------------------------------------------------------------

export type ItemKind = "fire" | "bomb" | "speed" | "kick" | "ghost" | "remote";

export const ITEM_KINDS: readonly ItemKind[] = ["fire", "bomb", "speed", "kick", "ghost", "remote"];

export interface ItemInfo {
  emoji: string;
  name: string;
  /** 捡到时飘的一句话 */
  line: string;
}

export const ITEM_INFO: Record<ItemKind, ItemInfo> = {
  fire: { emoji: "🔥", name: "火力+1", line: "火力+1!爆风又长了一格。" },
  bomb: { emoji: "💣", name: "炸弹+1", line: "炸弹+1!可以同时多摆一颗。" },
  speed: { emoji: "👟", name: "速度+1", line: "速度+1!跑起来更利索了。" },
  kick: { emoji: "🦵", name: "踢炸弹", line: "学会踢炸弹啦!撞上去就能把它踹走。" },
  ghost: { emoji: "🫧", name: "穿墙泡", line: "穿墙泡!软砖可以直接钻过去。" },
  remote: { emoji: "📡", name: "遥控引爆", line: "遥控引爆!想炸的时候再按引爆键。" },
};

/** 火力 / 炸弹数 / 速度的上限,免得后期一颗炸弹清全屏 */
export const MAX_POWER = 8;
export const MAX_BOMBS = 6;
export const MAX_SPEED = 5;

/**
 * 软砖被炸掉时掉什么(纯函数)。
 *
 * 同一颗种子 + 同一格永远给同一个结果,所以同一关重打两遍,
 * 道具位置完全一样,孩子可以背板、可以复盘。
 * `richness` 越大越容易掉东西(0 = 一件都不掉)。
 */
export function rollItem(seed: number, cell: number, richness = 1): ItemKind | null {
  if (richness <= 0) return null;
  // 和 level99 的 mulberry32 同一套做法,但这里只取一次,写成纯表达式更好测
  let a = (Math.imul(seed | 0, 0x9e3779b1) + Math.imul(cell | 0, 0x85ebca6b)) | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;

  // 掉落率:基础 42%,richness 可以往上调到 70%
  const rate = Math.min(0.7, 0.42 * richness);
  if (r >= rate) return null;
  // 常见的三件(火力/炸弹/速度)占大头,三件特殊道具少见一些
  const pickR = (r / rate) * 100;
  if (pickR < 26) return "fire";
  if (pickR < 50) return "bomb";
  if (pickR < 70) return "speed";
  if (pickR < 82) return "kick";
  if (pickR < 92) return "ghost";
  return "remote";
}

// ---------------------------------------------------------------------------
// 炸弹与爆风
// ---------------------------------------------------------------------------

/** 引信:放下去到自己炸的毫秒数 */
export const FUSE_MS = 2400;
/** 遥控炸弹的保险丝:一直不按引爆键,过了这个时间也会自己炸(免得摆满全场) */
export const REMOTE_FUSE_MS = 9000;
/** 爆风留在格子上的时间 */
export const FLAME_MS = 460;
/** 被泡泡包住多久自己破出来 */
export const BUBBLE_MS = 3600;
/** 被踢的炸弹每滑一格要多久 */
export const SLIDE_MS = 110;

export interface Bomb {
  id: number;
  pos: number;
  /** 谁放的(fighters 下标);-1 表示场地机关放的 */
  owner: number;
  power: number;
  /** 剩余引信(毫秒) */
  fuse: number;
  /** 遥控弹:等主人按引爆键 */
  remote: boolean;
  /** 被踢出去以后滑行的方向,-1 表示没在动 */
  slide: number;
  /** 滑行累计时间 */
  slideT: number;
}

/**
 * 一颗炸弹的爆风覆盖格(纯函数)。
 *
 * 从中心往四个方向直线推:
 *  - 撞到硬墙立刻停,硬墙本身不着火;
 *  - 撞到软砖:软砖着火(会被炸掉),然后这个方向停下——
 *    除非 `pierce` 打开(后期 Boss 关的贯通爆风),那就继续往前烧;
 *  - `power` 是「中心之外每个方向最多几格」。
 *
 * 返回值升序去重,方便直接比对与做集合运算。
 */
export function blastCells(board: Board, pos: number, power: number, pierce = false): number[] {
  const hit = new Set<number>();
  if (pos < 0 || pos >= board.cells.length) return [];
  hit.add(pos);
  const reach = Math.max(0, Math.floor(power));
  for (let dir = 0; dir < 4; dir++) {
    const d = DIRS[dir];
    let x = xOf(board, pos);
    let y = yOf(board, pos);
    for (let step = 0; step < reach; step++) {
      x += d.dx;
      y += d.dy;
      if (!inside(board, x, y)) break;
      const t = tileAt(board, x, y);
      if (t === TILE_HARD) break;
      hit.add(idx(board, x, y));
      if (t === TILE_SOFT && !pierce) break;
    }
  }
  return [...hit].sort((a, b) => a - b);
}

/**
 * 连锁引爆(纯函数):从 `seedIds` 这几颗开始,爆风盖到的炸弹也会被点着,
 * 一直传染到没有新炸弹为止。
 *
 * 返回一起炸掉的炸弹 id(升序)与全部着火格(升序)。
 * 传进来的 bombs 数组不会被改动。
 */
export function chainBombs(
  board: Board,
  bombs: readonly Bomb[],
  seedIds: readonly number[],
  pierce = false
): { ids: number[]; cells: number[] } {
  const byId = new Map<number, Bomb>();
  for (const b of bombs) byId.set(b.id, b);
  const atCell = new Map<number, Bomb>();
  for (const b of bombs) if (!atCell.has(b.pos)) atCell.set(b.pos, b);

  const fired = new Set<number>();
  const cells = new Set<number>();
  const queue: number[] = [];
  for (const id of seedIds) {
    if (byId.has(id) && !fired.has(id)) {
      fired.add(id);
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    const bomb = byId.get(queue.shift() as number) as Bomb;
    for (const cell of blastCells(board, bomb.pos, bomb.power, pierce)) {
      cells.add(cell);
      const other = atCell.get(cell);
      if (other && !fired.has(other.id)) {
        fired.add(other.id);
        queue.push(other.id);
      }
    }
  }

  return {
    ids: [...fired].sort((a, b) => a - b),
    cells: [...cells].sort((a, b) => a - b),
  };
}

// ---------------------------------------------------------------------------
// 角色
// ---------------------------------------------------------------------------

/** 速度档位 → 走一格要多少毫秒(档位越高越快) */
export const SPEED_STEP_MS = [230, 205, 180, 158, 138];

export function stepMsFor(speed: number): number {
  const i = Math.max(0, Math.min(SPEED_STEP_MS.length - 1, Math.round(speed) - 1));
  return SPEED_STEP_MS[i];
}

export interface Fighter {
  index: number;
  name: string;
  emoji: string;
  /** 同队的人不会互相「困住」:合作闯关两人同队,对战各自一队 */
  team: number;
  pos: number;
  power: number;
  /** 同时能摆几颗 */
  bombs: number;
  speed: number;
  kick: boolean;
  ghost: boolean;
  remote: boolean;
  /** 被泡泡包住的剩余毫秒,>0 时不能动也不能放弹 */
  bubbleT: number;
  /** 这一局一共被包了几次 */
  bubbled: number;
  /** 走格子的冷却 */
  moveT: number;
  facing: number;
  /** 电脑玩家?(人机对战 / 闯关里的对手) */
  ai: boolean;
  /** 已经捡到的道具数(结算文案用) */
  picked: number;
}

export function makeFighter(index: number, name: string, emoji: string, pos: number, team = index): Fighter {
  return {
    index,
    name,
    emoji,
    team,
    pos,
    power: 2,
    bombs: 1,
    speed: 2,
    kick: false,
    ghost: false,
    remote: false,
    bubbleT: 0,
    bubbled: 0,
    moveT: 0,
    facing: DIR_DOWN,
    ai: false,
    picked: 0,
  };
}

/** 捡到道具后的属性变化(就地生效,返回是否真的有提升) */
export function applyItem(f: Fighter, kind: ItemKind): boolean {
  switch (kind) {
    case "fire":
      if (f.power >= MAX_POWER) return false;
      f.power++;
      return true;
    case "bomb":
      if (f.bombs >= MAX_BOMBS) return false;
      f.bombs++;
      return true;
    case "speed":
      if (f.speed >= MAX_SPEED) return false;
      f.speed++;
      return true;
    case "kick":
      if (f.kick) return false;
      f.kick = true;
      return true;
    case "ghost":
      if (f.ghost) return false;
      f.ghost = true;
      return true;
    case "remote":
      if (f.remote) return false;
      f.remote = true;
      return true;
  }
}

// ---------------------------------------------------------------------------
// 小怪(闯关模式)
// ---------------------------------------------------------------------------

/** slime=慢吞吞 hopper=转弯快 chaser=会追人 ghosty=能钻软砖 boss=要包三层泡泡 */
export type CritterKind = "slime" | "hopper" | "chaser" | "ghosty" | "boss";

export interface CritterInfo {
  emoji: string;
  name: string;
  /** 走一格要多少毫秒 */
  stepMs: number;
  /** 能不能穿软砖 */
  ghost: boolean;
  /** 要被爆风碰几次才会被泡泡包好 */
  layers: number;
}

export const CRITTER_INFO: Record<CritterKind, CritterInfo> = {
  slime: { emoji: "🐸", name: "咕噜怪", stepMs: 520, ghost: false, layers: 1 },
  hopper: { emoji: "🐰", name: "蹦蹦怪", stepMs: 340, ghost: false, layers: 1 },
  chaser: { emoji: "🐱", name: "追追怪", stepMs: 300, ghost: false, layers: 1 },
  ghosty: { emoji: "👻", name: "钻墙怪", stepMs: 420, ghost: true, layers: 1 },
  boss: { emoji: "🐲", name: "泡泡王", stepMs: 380, ghost: false, layers: 3 },
};

export interface Critter {
  id: number;
  kind: CritterKind;
  pos: number;
  dir: number;
  moveT: number;
  /** 还剩几层要包 */
  layers: number;
  /** 刚被爆风碰过的无敌时间,免得一次爆风连扣三层 */
  hitCd: number;
}

export function makeCritter(id: number, kind: CritterKind, pos: number, dir = DIR_DOWN): Critter {
  return { id, kind, pos, dir, moveT: 0, layers: CRITTER_INFO[kind].layers, hitCd: 0 };
}

// ---------------------------------------------------------------------------
// 世界
// ---------------------------------------------------------------------------

export type GoalKind = "clear" | "exit" | "boss";

export type WorldEvent =
  | { kind: "boom"; cells: number[] }
  | { kind: "brick"; cell: number }
  | { kind: "pickup"; who: number; item: ItemKind }
  | { kind: "bubble"; who: number }
  | { kind: "free"; who: number }
  | { kind: "critter"; id: number; done: boolean }
  | { kind: "exit"; who: number };

export interface World {
  board: Board;
  fighters: Fighter[];
  critters: Critter[];
  bombs: Bomb[];
  /** 看得见的道具:格子 → 种类 */
  items: Map<number, ItemKind>;
  /** 还盖在软砖底下的道具,砖炸掉才落出来 */
  hidden: Map<number, ItemKind>;
  /** 正在燃烧的爆风:格子 → 剩余毫秒 */
  flames: Map<number, number>;
  /** 出口格(-1 表示这关不用找出口);藏在软砖底下,砖炸开才露出来 */
  exit: number;
  exitOpen: boolean;
  /** 出口要先清完小怪才打得开吗 */
  exitNeedsClear: boolean;
  goal: GoalKind;
  /** 爆风能不能贯通软砖(后期 Boss 关) */
  pierce: boolean;
  nextBombId: number;
  /** 已经过去的毫秒 */
  time: number;
  /** 限时(毫秒),<=0 表示不限时 */
  limit: number;
  /** 道具掉落用的种子 */
  seed: number;
  richness: number;
  /** 本帧发生的事,index.ts 消费完自己清空 */
  events: WorldEvent[];
  /** 谁走到了出口(-1 表示还没有) */
  escaped: number;
}

export interface WorldInit {
  board: Board;
  fighters: Fighter[];
  critters?: Critter[];
  hidden?: Map<number, ItemKind>;
  exit?: number;
  exitNeedsClear?: boolean;
  goal?: GoalKind;
  pierce?: boolean;
  limit?: number;
  seed?: number;
  richness?: number;
}

export function createWorld(init: WorldInit): World {
  return {
    board: init.board,
    fighters: init.fighters,
    critters: init.critters ?? [],
    bombs: [],
    items: new Map(),
    hidden: init.hidden ?? new Map(),
    flames: new Map(),
    exit: init.exit ?? -1,
    exitOpen: false,
    exitNeedsClear: init.exitNeedsClear ?? true,
    goal: init.goal ?? "clear",
    pierce: init.pierce ?? false,
    nextBombId: 1,
    time: 0,
    limit: init.limit ?? 0,
    seed: init.seed ?? 1,
    richness: init.richness ?? 1,
    events: [],
    escaped: -1,
  };
}

/** 这一格有没有炸弹 */
export function bombAt(world: World, cell: number): Bomb | null {
  for (const b of world.bombs) if (b.pos === cell) return b;
  return null;
}

/** 某人已经摆在场上的炸弹数 */
export function bombsOf(world: World, who: number): number {
  let n = 0;
  for (const b of world.bombs) if (b.owner === who) n++;
  return n;
}

export interface WalkOpts {
  /** 能不能钻软砖 */
  ghost?: boolean;
  /** 炸弹挡不挡路(踢炸弹时按「挡路」算,踢的动作单独处理) */
  bombs?: ReadonlySet<number>;
  /** 站在起点上的那颗炸弹不算挡路(刚放下还没走出去) */
  from?: number;
}

/** 这一格能不能站人 */
export function canStand(board: Board, cell: number, opts: WalkOpts = {}): boolean {
  if (cell < 0 || cell >= board.cells.length) return false;
  const t = tileOf(board, cell);
  if (t === TILE_HARD) return false;
  if (t === TILE_SOFT && !opts.ghost) return false;
  if (opts.bombs && opts.bombs.has(cell) && cell !== opts.from) return false;
  return true;
}

/** 当前场上全部炸弹所在格 */
export function bombCells(world: World): Set<number> {
  const s = new Set<number>();
  for (const b of world.bombs) s.add(b.pos);
  return s;
}

// ---------------------------------------------------------------------------
// 动作
// ---------------------------------------------------------------------------

/**
 * 放一颗炸弹。放不下(被泡泡困着 / 摆满了 / 脚下已经有一颗)就返回 null。
 */
export function dropBomb(world: World, who: number): Bomb | null {
  const f = world.fighters[who];
  if (!f || f.bubbleT > 0) return null;
  if (bombsOf(world, who) >= f.bombs) return null;
  if (bombAt(world, f.pos)) return null;
  const bomb: Bomb = {
    id: world.nextBombId++,
    pos: f.pos,
    owner: who,
    power: f.power,
    fuse: f.remote ? REMOTE_FUSE_MS : FUSE_MS,
    remote: f.remote,
    slide: DIR_NONE,
    slideT: 0,
  };
  world.bombs.push(bomb);
  return bomb;
}

/** 遥控引爆:把自己摆的遥控弹全部点着,返回引爆了几颗 */
export function detonate(world: World, who: number): number {
  const f = world.fighters[who];
  if (!f || f.bubbleT > 0 || !f.remote) return 0;
  const mine = world.bombs.filter((b) => b.owner === who && b.remote).map((b) => b.id);
  if (mine.length === 0) return 0;
  explodeBombs(world, mine);
  return mine.length;
}

/**
 * 走一格。返回真的走动了没有。
 * 目标格有炸弹而且自己会踢:把炸弹踹出去,人不动。
 */
export function tryStep(world: World, who: number, dir: number): boolean {
  const f = world.fighters[who];
  if (!f || f.bubbleT > 0 || dir < 0 || dir > 3) return false;
  f.facing = dir;
  const next = stepCell(world.board, f.pos, dir);
  if (next < 0) return false;

  const bomb = bombAt(world, next);
  if (bomb) {
    if (f.kick && bomb.slide === DIR_NONE) {
      const beyond = stepCell(world.board, next, dir);
      if (beyond >= 0 && canStand(world.board, beyond, { ghost: false, bombs: bombCells(world) })) {
        bomb.slide = dir;
        bomb.slideT = 0;
      }
    }
    return false;
  }

  if (!canStand(world.board, next, { ghost: f.ghost })) return false;
  f.pos = next;
  pickUp(world, who);
  return true;
}

/** 站到道具上就捡起来(已经顶格的属性捡了不再涨,但一样记一件,不让孩子白跑) */
function pickUp(world: World, who: number): void {
  const f = world.fighters[who];
  const item = world.items.get(f.pos);
  if (!item) return;
  world.items.delete(f.pos);
  applyItem(f, item);
  f.picked++;
  world.events.push({ kind: "pickup", who, item });
}

/** 把某人包成泡泡(同一个人正被包着就不重复计数) */
export function bubble(world: World, who: number): void {
  const f = world.fighters[who];
  if (!f || f.bubbleT > 0) return;
  f.bubbleT = BUBBLE_MS;
  f.bubbled++;
  world.events.push({ kind: "bubble", who });
}

// ---------------------------------------------------------------------------
// 爆炸
// ---------------------------------------------------------------------------

/** 引爆指定的几颗炸弹(会连锁),把砖、道具、人和小怪一并结算 */
export function explodeBombs(world: World, ids: readonly number[]): number[] {
  const { ids: fired, cells } = chainBombs(world.board, world.bombs, ids, world.pierce);
  if (fired.length === 0) return [];
  const firedSet = new Set(fired);
  world.bombs = world.bombs.filter((b) => !firedSet.has(b.id));

  for (const cell of cells) {
    world.flames.set(cell, FLAME_MS);
    if (tileOf(world.board, cell) === TILE_SOFT) {
      world.board.cells[cell] = TILE_FLOOR;
      world.events.push({ kind: "brick", cell });
      const drop = world.hidden.get(cell);
      if (drop) {
        world.hidden.delete(cell);
        world.items.set(cell, drop);
      } else {
        const rolled = rollItem(world.seed, cell, world.richness);
        if (rolled) world.items.set(cell, rolled);
      }
      if (cell === world.exit) world.exitOpen = true;
    } else {
      // 地上的道具被爆风烧掉(免得刷屏),出口不会被烧
      if (world.items.has(cell) && cell !== world.exit) world.items.delete(cell);
    }
  }
  world.events.push({ kind: "boom", cells });
  applyFlameHits(world, cells);
  return cells;
}

/** 爆风扫到的人和小怪 */
function applyFlameHits(world: World, cells: readonly number[]): void {
  const hot = new Set(cells);
  for (const f of world.fighters) {
    if (f.bubbleT > 0) continue;
    if (hot.has(f.pos)) bubble(world, f.index);
  }
  for (const c of world.critters) {
    if (c.layers <= 0 || c.hitCd > 0) continue;
    if (!hot.has(c.pos)) continue;
    c.layers--;
    c.hitCd = 500;
    world.events.push({ kind: "critter", id: c.id, done: c.layers <= 0 });
  }
  world.critters = world.critters.filter((c) => c.layers > 0);
}

// ---------------------------------------------------------------------------
// 每帧推进
// ---------------------------------------------------------------------------

export interface Intent {
  /** 想往哪走(-1 表示不动) */
  dir: number;
  /** 这一帧按了放弹键 */
  drop: boolean;
  /** 这一帧按了引爆键 */
  detonate: boolean;
}

export function idleIntent(): Intent {
  return { dir: DIR_NONE, drop: false, detonate: false };
}

/**
 * 把世界往前推 dt 毫秒。
 *
 * 顺序很讲究:先烧掉旧爆风 → 走炸弹引信与滑行 → 人动 → 小怪动 →
 * 最后再判一次「谁站在火里」,这样「刚好走进爆风」和「爆风刚好烧到脚下」
 * 两种情况都会被抓到,不会漏判也不会重复判。
 */
export function stepWorld(world: World, dt: number, intents: readonly Intent[]): void {
  const step = Math.max(1, Math.min(120, dt));
  world.time += step;

  // 1) 旧爆风退火
  for (const [cell, left] of [...world.flames]) {
    const next = left - step;
    if (next <= 0) world.flames.delete(cell);
    else world.flames.set(cell, next);
  }

  // 2) 炸弹:滑行 + 引信
  slideBombs(world, step);
  const due: number[] = [];
  for (const b of world.bombs) {
    b.fuse -= step;
    if (b.fuse <= 0) due.push(b.id);
  }
  if (due.length > 0) explodeBombs(world, due);

  // 3) 人
  for (const f of world.fighters) {
    if (f.bubbleT > 0) {
      f.bubbleT -= step;
      if (f.bubbleT <= 0) {
        f.bubbleT = 0;
        world.events.push({ kind: "free", who: f.index });
      }
      continue;
    }
    const intent = intents[f.index] ?? idleIntent();
    if (intent.detonate) detonate(world, f.index);
    if (intent.drop) dropBomb(world, f.index);
    f.moveT -= step;
    if (f.moveT <= 0 && intent.dir >= 0) {
      if (tryStep(world, f.index, intent.dir)) f.moveT = stepMsFor(f.speed);
      else f.moveT = 60;
    } else if (f.moveT < 0) {
      f.moveT = 0;
    }
  }

  // 4) 小怪
  stepCritters(world, step);

  // 5) 补一次判定:站在火上的人和小怪
  if (world.flames.size > 0) applyFlameHits(world, [...world.flames.keys()]);

  // 6) 出口
  updateExit(world);
}

function slideBombs(world: World, dt: number): void {
  for (const b of world.bombs) {
    if (b.slide === DIR_NONE) continue;
    b.slideT += dt;
    while (b.slideT >= SLIDE_MS) {
      b.slideT -= SLIDE_MS;
      const next = stepCell(world.board, b.pos, b.slide);
      const blocked =
        next < 0 ||
        tileOf(world.board, next) !== TILE_FLOOR ||
        world.bombs.some((o) => o !== b && o.pos === next) ||
        world.fighters.some((f) => f.pos === next) ||
        world.critters.some((c) => c.pos === next);
      if (blocked) {
        b.slide = DIR_NONE;
        b.slideT = 0;
        break;
      }
      b.pos = next;
    }
  }
}

/**
 * 小怪走位(确定性:只看当前世界状态,不摇骰子)。
 * - 追追怪朝最近的人走一格(简单的贪心,遇墙就换个能走的方向);
 * - 其它小怪一直往前,撞墙就顺时针换方向;
 * - 谁都不会主动往爆风里钻(它们也怕被包成泡泡)。
 */
function stepCritters(world: World, dt: number): void {
  for (const c of world.critters) {
    if (c.hitCd > 0) c.hitCd = Math.max(0, c.hitCd - dt);
    const info = CRITTER_INFO[c.kind];
    c.moveT -= dt;
    if (c.moveT > 0) continue;
    c.moveT = info.stepMs;
    const dir = critterDir(world, c);
    if (dir < 0) continue;
    const next = stepCell(world.board, c.pos, dir);
    if (next < 0) continue;
    c.dir = dir;
    c.pos = next;
  }
  // 撞到人的小怪也把人包成泡泡(它们只是想抱一下)
  for (const c of world.critters) {
    for (const f of world.fighters) {
      if (f.bubbleT <= 0 && f.pos === c.pos) bubble(world, f.index);
    }
  }
}

/** 小怪这一步往哪走(纯粹看棋盘,便于测试) */
export function critterDir(world: World, c: Critter): number {
  const info = CRITTER_INFO[c.kind];
  const blocked = bombCells(world);
  const ok = (dir: number): boolean => {
    const next = stepCell(world.board, c.pos, dir);
    if (next < 0) return false;
    if (!canStand(world.board, next, { ghost: info.ghost, bombs: blocked })) return false;
    return !world.flames.has(next);
  };

  if (c.kind === "chaser" || c.kind === "boss") {
    // 朝最近的、没被泡泡困住的人挪一格
    let best = -1;
    let bestD = Infinity;
    for (const f of world.fighters) {
      if (f.bubbleT > 0) continue;
      const d = manhattan(world.board, c.pos, f.pos);
      if (d < bestD) {
        bestD = d;
        best = f.pos;
      }
    }
    if (best >= 0) {
      const dx = xOf(world.board, best) - xOf(world.board, c.pos);
      const dy = yOf(world.board, best) - yOf(world.board, c.pos);
      const wish: number[] = [];
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx !== 0) wish.push(dx > 0 ? DIR_RIGHT : DIR_LEFT);
        if (dy !== 0) wish.push(dy > 0 ? DIR_DOWN : DIR_UP);
      } else {
        if (dy !== 0) wish.push(dy > 0 ? DIR_DOWN : DIR_UP);
        if (dx !== 0) wish.push(dx > 0 ? DIR_RIGHT : DIR_LEFT);
      }
      for (const d of wish) if (ok(d)) return d;
    }
  }

  if (ok(c.dir)) return c.dir;
  for (let i = 1; i <= 3; i++) {
    const d = (c.dir + i) % 4;
    if (ok(d)) return d;
  }
  return DIR_NONE;
}

function updateExit(world: World): void {
  if (world.exit < 0 || !world.exitOpen) return;
  if (world.exitNeedsClear && world.critters.length > 0) return;
  for (const f of world.fighters) {
    if (f.bubbleT > 0) continue;
    if (f.pos === world.exit && world.escaped < 0) {
      world.escaped = f.index;
      world.events.push({ kind: "exit", who: f.index });
    }
  }
}

// ---------------------------------------------------------------------------
// 胜负
// ---------------------------------------------------------------------------

/** 闯关关卡过没过 */
export function levelCleared(world: World): boolean {
  if (world.goal === "exit") return world.escaped >= 0;
  return world.critters.length === 0;
}

/** 限时到了没有 */
export function timeUp(world: World): boolean {
  return world.limit > 0 && world.time >= world.limit;
}

/** 剩余秒数(不限时的关返回 0) */
export function secondsLeft(world: World): number {
  if (world.limit <= 0) return 0;
  return Math.max(0, Math.ceil((world.limit - world.time) / 1000));
}

/** 对战里被包成泡泡就判这一局输;返回赢家下标,还没分出来返回 -1 */
export function roundWinner(world: World): number {
  const standing = world.fighters.filter((f) => f.bubbleT <= 0);
  if (standing.length === 1) return standing[0].index;
  return -1;
}

/** 三局两胜制的赛点判断:先到 target 局的人赢下整场 */
export function matchWinner(scores: readonly number[], target = 3): number {
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] >= target) return i;
  }
  return -1;
}

/** 关卡评星:剩得越多、被包得越少,星越多 */
export function rateLevel(secLeft: number, totalSec: number, bubbled: number): 1 | 2 | 3 {
  if (bubbled >= 2) return 1;
  const ratio = totalSec > 0 ? secLeft / totalSec : 0.5;
  if (bubbled === 0 && ratio >= 0.45) return 3;
  if (ratio >= 0.2) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// 文案(小学六年级读得懂,失败只鼓励)
// ---------------------------------------------------------------------------

export function winLine(secLeft: number, bubbled: number, picked: number): string {
  if (bubbled === 0 && secLeft > 0) {
    return `一次泡泡都没挨上,还剩 ${secLeft} 秒收工。摆弹的位置挑得很准,继续保持这个节奏。`;
  }
  if (bubbled === 0) {
    return `全程没被泡泡包住,路线规划得很稳。下一关试着提前算好退路,时间还能再省一截。`;
  }
  return `被包了 ${bubbled} 次也照样通关,捡到 ${picked} 件道具。下次放弹前先想好往哪躲,时间会更宽裕。`;
}

export function loseLine(reason: "time" | "bubble"): string {
  if (reason === "time") {
    return "时间到啦。下一次先炸开一条直路,把火力和炸弹数攒起来,清场速度会快很多。";
  }
  return "泡泡把你包住了一小会儿。放弹之前先看好身后有没有退路,拐角是最好的藏身处。";
}

export function versusLine(scores: readonly number[], names: readonly string[]): string {
  return `${names[0]} ${scores[0]} 比 ${scores[1]} ${names[1]}`;
}

export function endlessLine(round: number, best: number): string {
  if (round >= best && round > 0) {
    return `撑到第 ${round} 轮,刷新了自己的纪录!场地越缩越小,越往后越要抢中间的位置。`;
  }
  return `这次到第 ${round} 轮,最好成绩是第 ${best} 轮。场地开始收缩前先往中间靠,活动空间会大很多。`;
}

// ---------------------------------------------------------------------------
// 键位
// ---------------------------------------------------------------------------

export type InputName = "up" | "right" | "down" | "left" | "drop" | "boom";

/** 朵朵 WASD + F 放弹 / G 引爆;星星 方向键 + L 放弹 / K 引爆 */
export const KEY_MAP: Record<string, { player: 0 | 1; action: InputName }> = {
  KeyW: { player: 0, action: "up" },
  KeyD: { player: 0, action: "right" },
  KeyS: { player: 0, action: "down" },
  KeyA: { player: 0, action: "left" },
  KeyF: { player: 0, action: "drop" },
  KeyG: { player: 0, action: "boom" },
  ArrowUp: { player: 1, action: "up" },
  ArrowRight: { player: 1, action: "right" },
  ArrowDown: { player: 1, action: "down" },
  ArrowLeft: { player: 1, action: "left" },
  KeyL: { player: 1, action: "drop" },
  KeyK: { player: 1, action: "boom" },
};

/**
 * 键盘 code 翻译成「几号玩家的哪个动作」。
 * 单人玩的时候两套键位都归 0 号,左右手都顺;双人时各管各的,互不抢占。
 */
export function keyToAction(code: string, players: number): { player: number; action: InputName } | null {
  const hit = KEY_MAP[code];
  if (!hit) return null;
  if (players <= 1) return { player: 0, action: hit.action };
  return { player: hit.player, action: hit.action };
}

export function isPauseKey(code: string): boolean {
  return code === "Escape";
}

/** 方向动作 → DIR_*,不是方向键返回 -1 */
export function actionDir(action: InputName): number {
  switch (action) {
    case "up":
      return DIR_UP;
    case "right":
      return DIR_RIGHT;
    case "down":
      return DIR_DOWN;
    case "left":
      return DIR_LEFT;
    default:
      return DIR_NONE;
  }
}

/**
 * 同时按住好几个方向时选一个:后按下去的那个优先(`recent` 是按下顺序,越靠后越新),
 * `recent` 里没有可用的就退回上右下左的固定顺序;一个都没按返回 -1。
 */
export function pickDir(held: ReadonlyArray<boolean>, recent: ReadonlyArray<number> = []): number {
  for (let i = recent.length - 1; i >= 0; i--) {
    const d = recent[i];
    if (d >= 0 && d < 4 && held[d]) return d;
  }
  for (let d = 0; d < 4; d++) if (held[d]) return d;
  return DIR_NONE;
}

// ---------------------------------------------------------------------------
// 合作闯关的进度(和 188 关战役的星级存档分开放,互不干扰)
// ---------------------------------------------------------------------------

export const COOP_KEY = "yiduo-yixing.bomb-buddies.coop.v1";

/** 读合作模式打到第几关(0 基);读不出来就是第 1 关 */
export function parseCoopProgress(raw: string | null, total = 188): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(total - 1, Math.floor(n)));
}

export function serializeCoopProgress(level: number): string {
  return String(Math.max(0, Math.floor(level)));
}

/** 秒数 → mm:ss */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
