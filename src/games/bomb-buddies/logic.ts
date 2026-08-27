// 泡泡炸弹人 · 纯逻辑层。
//
// 这一层只算数,不画一个像素、不碰一次 DOM:
//  - 棋盘与走位(硬墙 / 软砖 / 空地,踢泡泡、穿泡,以及 1.2 的拐弯补正 `planTurn`);
//  - 彩虹波传播与连锁(`blastCells` / `chainBombs` / `chainWaves`,纯函数);
//  - 软砖里的道具掉落(`rollItem` 老六件 / `rollItemV2` 含护盾的七件,同一颗种子同一格永远掉同一件);
//  - 世界推进 `stepWorld`:给定 dt 与两位玩家的意图,把泡泡、彩虹波、
//    小怪、道具、出口全部往前走一帧,并把这一帧发生的事记成事件。
//
// **泡泡不是炸药**:全程没有火焰、没有伤害、没有死亡。
// 泡泡到点是「啵」的一声破开一圈彩虹波;被波扫到的人只是被罩进一个泡泡里,
// 自己晃几秒就出来,合作模式里队友还能贴上去拍破把他捞出来(`popBubble`);
// 被扫到的砖变成一把小花散开;小怪则开开心心飘回家。
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

export type ItemKind = "fire" | "bomb" | "speed" | "kick" | "ghost" | "remote" | "shield";

/**
 * 老池(六件)。**前 99 关与老存档认的就是这一张表**,
 * 顺序与权重一个字节都不能动,不然背过板的孩子回来会发现道具全换了位置。
 */
export const ITEM_KINDS: readonly ItemKind[] = ["fire", "bomb", "speed", "kick", "ghost", "remote"];

/** 1.2 新池(七件):第 100 关起、擂台与泡泡塔用,多一件「泡泡护盾」 */
export const ITEM_KINDS_V2: readonly ItemKind[] = [...ITEM_KINDS, "shield"];

export interface ItemInfo {
  emoji: string;
  name: string;
  /** 捡到时飘的一句话 */
  line: string;
}

export const ITEM_INFO: Record<ItemKind, ItemInfo> = {
  fire: { emoji: "🌈", name: "彩虹波+1", line: "彩虹波+1!泡泡破开时的波纹又长了一格。" },
  bomb: { emoji: "🫧", name: "泡泡+1", line: "泡泡+1!可以同时多放一颗。" },
  speed: { emoji: "👟", name: "速度+1", line: "速度+1!跑起来更利索了。" },
  kick: { emoji: "🦵", name: "踢泡泡", line: "学会踢泡泡啦!撞上去就能把它踹到走廊深处。" },
  ghost: { emoji: "👻", name: "穿泡", line: "穿泡!软砖可以直接钻过去。" },
  remote: { emoji: "📡", name: "遥控拍破", line: "遥控拍破!想让它破的时候再按一下。" },
  shield: { emoji: "🛡️", name: "泡泡护盾", line: "泡泡护盾!下一次被彩虹波扫到,护盾替你挡一下。" },
};

/** 彩虹波长度 / 泡泡数 / 速度的上限,免得后期一颗泡泡清全屏 */
export const MAX_POWER = 8;
export const MAX_BOMBS = 6;
export const MAX_SPEED = 5;
/** 护盾最多叠两层 */
export const MAX_SHIELD = 2;

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

/**
 * 1.2 的新掉落表(七件,多一件护盾)。
 *
 * 为什么另开一个函数而不是给 `rollItem` 加参数:掉落表一改,同一颗种子同一格掉的东西就变了,
 * 前 99 关的藏品位置会整体错位。老函数原样封存给前 99 关用,新表只在
 * 第 100 关起、对战擂台与泡泡塔上线,两边都能背板。
 */
export function rollItemV2(seed: number, cell: number, richness = 1): ItemKind | null {
  if (richness <= 0) return null;
  // 换一颗盐,免得同一格在新旧两张表里掉出同一件,失去「新池」的意义
  let a = (Math.imul(seed | 0, 0x27d4eb2f) + Math.imul(cell | 0, 0x165667b1)) | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;

  const rate = Math.min(0.7, 0.42 * richness);
  if (r >= rate) return null;
  const pickR = (r / rate) * 100;
  if (pickR < 24) return "fire";
  if (pickR < 46) return "bomb";
  if (pickR < 64) return "speed";
  if (pickR < 76) return "kick";
  if (pickR < 85) return "ghost";
  if (pickR < 93) return "remote";
  return "shield";
}

// ---------------------------------------------------------------------------
// 泡泡与彩虹波(1.2:整条时间线都是常量,画面与 AI 读同一组数)
// ---------------------------------------------------------------------------

// 放下去 → 0.4 秒鼓起来 → 2.0 秒「啵」的一声破开 → 波及到的泡泡 3 帧内跟着破。
// 这四个数是本款手感的全部来源,谁也不许在别处写死。

/** 一帧按 60fps 算多少毫秒(连锁节奏用它换算) */
export const FRAME_MS = 16;
/** 放下去到彻底鼓起来:这 0.4 秒里泡泡还在长大,踢得动、也躲得开 */
export const BUBBLE_GROW_MS = 400;
/** 放下去到「啵」的一声破开 */
export const BUBBLE_POP_MS = 2000;
/** 引信:放下去到自己破开的毫秒数(= 时间线的终点) */
export const FUSE_MS = BUBBLE_POP_MS;
/** 被波及的泡泡最多几帧内跟着破 */
export const CHAIN_FRAMES = 3;
/** 连锁一环传一环的间隔:一帧一环,肉眼看得见「一颗带一串」 */
export const CHAIN_STEP_MS = FRAME_MS;
/** 连锁的兑现窗口:被波及的泡泡从被点到破,绝不超过这个时间 */
export const CHAIN_WINDOW_MS = CHAIN_FRAMES * FRAME_MS;
/** 遥控泡泡的保险绳:一直不按拍破键,过了这个时间它也会自己破(免得摆满全场) */
export const REMOTE_FUSE_MS = 9000;
/** 彩虹波留在格子上的时间 */
export const FLAME_MS = 460;
/** 被泡泡罩住多久自己晃出来 */
export const BUBBLE_MS = 3600;
/** 被踢的泡泡每滑一格要多久 */
export const SLIDE_MS = 110;

/** 泡泡的三个阶段:鼓起来 → 晃悠悠 → 马上要破 */
export type BubbleStage = "grow" | "wobble" | "burst";

/** 已经过去多少毫秒(遥控泡泡按自己的保险绳算) */
export function bubbleAge(fuse: number, remote = false): number {
  const total = remote ? REMOTE_FUSE_MS : BUBBLE_POP_MS;
  return Math.max(0, total - Math.max(0, fuse));
}

/** 膨胀进度 0..1:0 是刚放下的小点,1 是鼓满了 */
export function growProgress(fuse: number, remote = false): number {
  return Math.max(0, Math.min(1, bubbleAge(fuse, remote) / BUBBLE_GROW_MS));
}

/** 这一颗泡泡现在处在时间线的哪一段 */
export function bubbleStage(fuse: number, remote = false): BubbleStage {
  if (bubbleAge(fuse, remote) < BUBBLE_GROW_MS) return "grow";
  return fuse <= CHAIN_WINDOW_MS * 4 ? "burst" : "wobble";
}

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
  /** 是被隔壁那颗的彩虹波点着的(连锁的一环,画面给它换一圈颜色) */
  chained?: boolean;
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

/** 连锁的一环:第几波、这一波破的是哪几颗、盖到哪些格 */
export interface ChainWave {
  wave: number;
  ids: number[];
  cells: number[];
  /** 这一波相对第一声「啵」延后多少毫秒 */
  delay: number;
}

/**
 * 把一串连锁拆成一波一波(纯函数)。
 *
 * 第 0 波是自己到点破的那几颗;第 k+1 波是被第 k 波的彩虹波扫到的泡泡。
 * 每一波的 id 与格子都升序排好,**同一个局面永远拆出同一份波次表**——
 * 连锁顺序可复现这条要求就落在这里,画面按 `delay` 一环一环放彩虹圈。
 */
export function chainWaves(
  board: Board,
  bombs: readonly Bomb[],
  seedIds: readonly number[],
  pierce = false
): ChainWave[] {
  const byId = new Map<number, Bomb>();
  for (const b of bombs) byId.set(b.id, b);
  const atCell = new Map<number, Bomb>();
  // 同一格万一摞了两颗(理论上不会),取 id 小的那颗,保证结果稳定
  for (const b of [...bombs].sort((a, b) => a.id - b.id)) if (!atCell.has(b.pos)) atCell.set(b.pos, b);

  const fired = new Set<number>();
  let current = [...new Set(seedIds)].filter((id) => byId.has(id)).sort((a, b) => a - b);
  for (const id of current) fired.add(id);

  const out: ChainWave[] = [];
  let wave = 0;
  while (current.length > 0) {
    const cells = new Set<number>();
    const next = new Set<number>();
    for (const id of current) {
      const bomb = byId.get(id) as Bomb;
      for (const cell of blastCells(board, bomb.pos, bomb.power, pierce)) {
        cells.add(cell);
        const other = atCell.get(cell);
        if (other && !fired.has(other.id)) next.add(other.id);
      }
    }
    out.push({
      wave,
      ids: [...current],
      cells: [...cells].sort((a, b) => a - b),
      delay: chainDelay(wave),
    });
    for (const id of next) fired.add(id);
    current = [...next].sort((a, b) => a - b);
    wave++;
  }
  return out;
}

/** 第 wave 波相对第一声「啵」延后多少毫秒(一波一帧) */
export function chainDelay(wave: number): number {
  return Math.max(0, Math.round(wave)) * CHAIN_STEP_MS;
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
  /** 手上还有几层泡泡护盾:被彩虹波扫到时先扣护盾,人不进泡泡 */
  shield: number;
  /** 被泡泡罩住的剩余毫秒,>0 时不能动也不能放泡泡 */
  bubbleT: number;
  /** 这一局一共被罩了几次 */
  bubbled: number;
  /** 护盾刚替你挡过一下的无敌毫秒:同一圈彩虹波不许连扣两层 */
  safeT: number;
  /** 队友贴着泡泡拍了多久(合作模式的救援进度) */
  rescueT: number;
  /** 这一局被队友救出来几次 */
  rescued: number;
  /** 这一局救了队友几次 */
  saves: number;
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
    shield: 0,
    bubbleT: 0,
    bubbled: 0,
    safeT: 0,
    rescueT: 0,
    rescued: 0,
    saves: 0,
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
    case "shield":
      if (f.shield >= MAX_SHIELD) return false;
      f.shield++;
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
  /** 一声「啵」:cells 是彩虹波盖到的格,waves 是这一串连锁的波次(画面按波放圈) */
  | { kind: "boom"; cells: number[]; waves: ChainWave[] }
  /** 一块砖变成小花散开了 */
  | { kind: "brick"; cell: number }
  | { kind: "pickup"; who: number; item: ItemKind }
  | { kind: "bubble"; who: number }
  /** 护盾替你挡了一下,人没进泡泡 */
  | { kind: "shield"; who: number; left: number }
  | { kind: "free"; who: number }
  /** 队友把泡泡拍破了:who 被救,by 是救人的那个 */
  | { kind: "rescue"; who: number; by: number }
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
  /** 彩虹波能不能贯通软砖(后期泡泡王关) */
  pierce: boolean;
  /** 合作模式:被罩住的人可以被队友拍破救出来(见 RESCUE_MS) */
  rescue: boolean;
  nextBombId: number;
  /** 已经过去的毫秒 */
  time: number;
  /** 限时(毫秒),<=0 表示不限时 */
  limit: number;
  /** 道具掉落用的种子 */
  seed: number;
  richness: number;
  /** 掉落表:v1 是前 99 关的老六件,v2 是含护盾的七件 */
  pool: "v1" | "v2";
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
  rescue?: boolean;
  limit?: number;
  seed?: number;
  richness?: number;
  pool?: "v1" | "v2";
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
    rescue: init.rescue ?? false,
    nextBombId: 1,
    time: 0,
    limit: init.limit ?? 0,
    seed: init.seed ?? 1,
    richness: init.richness ?? 1,
    pool: init.pool ?? "v1",
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

/** 当前场上全部泡泡所在格 */
export function bombCells(world: World): Set<number> {
  const s = new Set<number>();
  for (const b of world.bombs) s.add(b.pos);
  return s;
}

// ---------------------------------------------------------------------------
// 转向补正(1.2):差半格也能拐弯
// ---------------------------------------------------------------------------

/**
 * 补正阈值:想拐弯的时候,**前方半格以内**只要有通路就自动对齐过去。
 *
 * 棋盘是一格一格的,半格换算到格子上就是「往两边各看一格」:
 * 角色的身子本来就骑在格子边界上,差半格的观感,落到数据上正好是相邻的那一格。
 */
export const TURN_ASSIST_CELLS = 0.5;

/** 补正最远看几格(由阈值换算,半格 → 1 格) */
export function turnAssistReach(cells: number = TURN_ASSIST_CELLS): number {
  return Math.max(1, Math.round(cells * 2));
}

export interface TurnPlan {
  /** 这一帧真正要走的方向 */
  dir: number;
  /** 是不是补正出来的(true = 先往旁边挪一格对齐,下一步才拐过去) */
  assisted: boolean;
  /** 补正时先落脚的那一格(没补正就是 -1) */
  via: number;
}

/**
 * 拐弯补正(纯函数)。
 *
 * 想往 `want` 走却被墙或砖挡住时,顺着当前朝向的那条轴往两边各看 `turnAssistReach()` 格:
 * 只要有一格「站得上去,而且从那里就能拐进 `want`」,就先往那一格挪,把自己对齐到路口上。
 * 找不到就老老实实返回 `want`(让上层照常判定「走不动」)。
 *
 * 只对地形补正:目标格上有泡泡时不补正,因为那一步是「踢泡泡」,不该被悄悄改成别的方向。
 */
export function planTurn(
  board: Board,
  from: number,
  facing: number,
  want: number,
  opts: WalkOpts & { reach?: number } = {}
): TurnPlan {
  const plain: TurnPlan = { dir: want, assisted: false, via: -1 };
  if (want < 0 || want > 3) return plain;

  const target = stepCell(board, from, want);
  // 目标格本来就能走 / 上面压着一颗泡泡(那是踢的事) → 不插手
  if (target >= 0 && canStand(board, target, opts)) return plain;
  if (target >= 0 && opts.bombs?.has(target)) return plain;

  const reach = Math.max(1, Math.round(opts.reach ?? turnAssistReach()));
  // 先顺着当前朝向找(玩家正在跑的方向优先,拐起来最跟手),再看反方向
  const axis = facing >= 0 && facing % 2 !== want % 2 ? [facing, (facing + 2) % 4] : [(want + 1) % 4, (want + 3) % 4];

  for (let step = 1; step <= reach; step++) {
    for (const side of axis) {
      let cursor = from;
      let ok = true;
      for (let k = 0; k < step; k++) {
        const nb = stepCell(board, cursor, side);
        if (nb < 0 || !canStand(board, nb, { ...opts, from })) {
          ok = false;
          break;
        }
        cursor = nb;
      }
      if (!ok) continue;
      const turn = stepCell(board, cursor, want);
      if (turn < 0 || !canStand(board, turn, { ...opts, from })) continue;
      return { dir: side, assisted: true, via: cursor };
    }
  }
  return plain;
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

/**
 * 把某人罩进泡泡里(同一个人正被罩着就不重复计数)。
 *
 * 手上有护盾就先扣护盾:泡泡「啵」地替他破掉一层,人一点事没有,
 * 再给一小段无敌时间,免得同一圈彩虹波在相邻两帧里把两层护盾一起吃掉。
 */
export function bubble(world: World, who: number): void {
  const f = world.fighters[who];
  if (!f || f.bubbleT > 0 || f.safeT > 0) return;
  if (f.shield > 0) {
    f.shield--;
    f.safeT = FLAME_MS;
    world.events.push({ kind: "shield", who, left: f.shield });
    return;
  }
  f.bubbleT = world.rescue ? RESCUE_MS : BUBBLE_MS;
  f.rescueT = 0;
  f.bubbled++;
  world.events.push({ kind: "bubble", who });
}

/**
 * 刚从泡泡里出来的一小会儿有一层彩虹光罩着,谁也碰不到。
 *
 * 没有这段缓冲会出人命(不是真的出人命,是玩不下去):追追怪站在你头上不走,
 * 泡泡一破立刻又把你罩回去,一整关就这么循环到时间结束。
 */
export const FREE_GRACE_MS = 900;
/** 合作模式:被罩住的人最多困这么久,这段时间里队友随时能把他拍出来 */
export const RESCUE_MS = 5000;
/** 队友贴着泡泡拍多久才「啵」的一下救出来 */
export const RESCUE_TOUCH_MS = 600;

/** 谁能来救 who:同队、自己没被罩住、就站在旁边一格(或同一格) */
export function rescuerFor(world: World, who: number): number {
  const f = world.fighters[who];
  if (!f || f.bubbleT <= 0) return -1;
  const near = new Set<number>([f.pos, ...neighbors(world.board, f.pos)]);
  for (const mate of world.fighters) {
    if (mate.index === who || mate.team !== f.team || mate.bubbleT > 0) continue;
    if (near.has(mate.pos)) return mate.index;
  }
  return -1;
}

/** 把泡泡拍破,把人放出来(by 是救人的那位;-1 表示自己晃出来的) */
export function popBubble(world: World, who: number, by = -1): boolean {
  const f = world.fighters[who];
  if (!f || f.bubbleT <= 0) return false;
  f.bubbleT = 0;
  f.rescueT = 0;
  f.safeT = Math.max(f.safeT, FREE_GRACE_MS);
  if (by >= 0) {
    f.rescued++;
    const mate = world.fighters[by];
    if (mate) mate.saves++;
    world.events.push({ kind: "rescue", who, by });
  }
  world.events.push({ kind: "free", who });
  return true;
}

/**
 * 主动踢一脚:把面前那颗泡泡朝自己的朝向踹出去(手机上的「踢泡钮」走这条)。
 * 没学会踢泡、面前没泡泡、或者泡泡后面没地方滑,都返回 false。
 */
export function kickBomb(world: World, who: number, dir?: number): boolean {
  const f = world.fighters[who];
  if (!f || f.bubbleT > 0 || !f.kick) return false;
  const way = dir === undefined ? f.facing : dir;
  const next = stepCell(world.board, f.pos, way);
  if (next < 0) return false;
  const bomb = bombAt(world, next);
  if (!bomb || bomb.slide !== DIR_NONE) return false;
  const beyond = stepCell(world.board, next, way);
  if (beyond < 0 || !canStand(world.board, beyond, { ghost: false, bombs: bombCells(world) })) return false;
  bomb.slide = way;
  bomb.slideT = 0;
  return true;
}

// ---------------------------------------------------------------------------
// 爆炸
// ---------------------------------------------------------------------------

/**
 * 让指定的几颗泡泡「啵」地破开,把砖、道具、人和小怪一并结算。
 *
 * 1.2 起连锁不再是瞬间全炸:被这一圈彩虹波扫到的泡泡只是**被点着**
 * (引信压到 `CHAIN_STEP_MS`),下一帧才轮到它破。
 * 这样一串泡泡是一环一环「啵啵啵」地传过去,看得见节奏,
 * 而且每一环都在 `CHAIN_WINDOW_MS`(3 帧)内兑现,不会拖成慢动作。
 */
export function explodeBombs(world: World, ids: readonly number[]): number[] {
  const seeds = [...new Set(ids)].sort((a, b) => a - b);
  const waves = chainWaves(world.board, world.bombs, seeds, world.pierce);
  if (waves.length === 0) return [];

  const fired = waves[0].ids;
  const cells = waves[0].cells;
  const firedSet = new Set(fired);
  const nextWave = new Set(waves[1]?.ids ?? []);
  world.bombs = world.bombs.filter((b) => !firedSet.has(b.id));
  // 被这一圈波扫到的泡泡:引信压到一帧,下一帧跟着破(顺序由 chainWaves 定死,可复现)
  for (const b of world.bombs) {
    if (nextWave.has(b.id) && b.fuse > CHAIN_STEP_MS) {
      b.fuse = CHAIN_STEP_MS;
      b.chained = true;
    }
  }

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
        const roll = world.pool === "v2" ? rollItemV2 : rollItem;
        const rolled = roll(world.seed, cell, world.richness);
        if (rolled) world.items.set(cell, rolled);
      }
      if (cell === world.exit) world.exitOpen = true;
    } else {
      // 地上的道具被彩虹波卷走(免得刷屏),出口不会被卷走
      if (world.items.has(cell) && cell !== world.exit) world.items.delete(cell);
    }
  }
  world.events.push({ kind: "boom", cells, waves });
  applyFlameHits(world, cells);
  return cells;
}

/** 彩虹波扫到的人和小怪 */
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
  /** 这一帧按了放泡钮 */
  drop: boolean;
  /** 这一帧按了遥控拍破键 */
  detonate: boolean;
  /** 这一帧按了踢泡钮(手机上的第三颗按钮) */
  kick?: boolean;
}

export function idleIntent(): Intent {
  return { dir: DIR_NONE, drop: false, detonate: false, kick: false };
}

/**
 * 把世界往前推 dt 毫秒。
 *
 * 顺序很讲究:先散掉旧彩虹波 → 走泡泡引信与滑行 → 人动 → 小怪动 →
 * 最后再判一次「谁站在波里」,这样「刚好走进彩虹波」和「彩虹波刚好扫到脚下」
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
    if (f.safeT > 0) f.safeT = Math.max(0, f.safeT - step);
    if (f.bubbleT > 0) {
      // 合作模式:队友贴着泡泡拍,拍够 RESCUE_TOUCH_MS 就「啵」的一下把人放出来
      if (world.rescue) {
        const mate = rescuerFor(world, f.index);
        if (mate >= 0) {
          f.rescueT += step;
          if (f.rescueT >= RESCUE_TOUCH_MS) {
            popBubble(world, f.index, mate);
            continue;
          }
        } else {
          f.rescueT = Math.max(0, f.rescueT - step);
        }
      }
      f.bubbleT -= step;
      if (f.bubbleT <= 0) {
        f.bubbleT = 0;
        f.rescueT = 0;
        f.safeT = Math.max(f.safeT, FREE_GRACE_MS);
        world.events.push({ kind: "free", who: f.index });
      }
      continue;
    }
    const intent = intents[f.index] ?? idleIntent();
    if (intent.detonate) detonate(world, f.index);
    if (intent.kick) kickBomb(world, f.index);
    if (intent.drop) dropBomb(world, f.index);
    f.moveT -= step;
    if (f.moveT <= 0 && intent.dir >= 0) {
      // 拐弯补正:请求的方向被墙挡住时,先往旁边对齐一格,让这一拐拐得过去。
      // 只补人的手指头 —— 电脑玩家的每一步都是 BFS 算准的,替它改方向反而会把它推进彩虹波里。
      const plan = f.ai
        ? { dir: intent.dir, assisted: false, via: -1 }
        : planTurn(world.board, f.pos, f.facing, intent.dir, {
            ghost: f.ghost,
            bombs: bombCells(world),
            from: f.pos,
          });
      if (tryStep(world, f.index, plan.dir)) {
        f.moveT = stepMsFor(f.speed);
        // 补正只是「对齐」,朝向仍然记玩家真正想去的方向,下一步就拐过去了
        if (plan.assisted) f.facing = intent.dir;
      } else {
        f.moveT = 60;
      }
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
    return `一次泡泡都没挨上,还剩 ${secLeft} 秒收工。放泡泡的位置挑得很准,继续保持这个节奏。`;
  }
  if (bubbled === 0) {
    return `全程没被泡泡罩住,路线规划得很稳。下一关试着提前算好退路,时间还能再省一截。`;
  }
  return `被罩了 ${bubbled} 次也照样通关,捡到 ${picked} 件道具。下次放泡泡之前先想好往哪躲,时间会更宽裕。`;
}

export function loseLine(reason: "time" | "bubble"): string {
  if (reason === "time") {
    return "时间到啦。下一次先拍开一条直路,把彩虹波和泡泡数攒起来,清场速度会快很多。";
  }
  return "泡泡把你罩住了一小会儿。放泡泡之前先看好身后有没有退路,拐角是最好的藏身处。";
}

/** 合作模式的结算:救人是这一版最想让孩子看见的那件事,放在最前面说 */
export function coopLine(saves: number, picked: number, bubbled: number): string {
  if (saves > 0) {
    return `两个人一共拍破 ${saves} 次泡泡把对方救出来,捡了 ${picked} 件道具。互相盯着点,谁被罩住都能捞回来。`;
  }
  if (bubbled > 0) {
    return `这一关谁也没顾上救谁,被罩住 ${bubbled} 次都是自己晃出来的。下次听见「啵」的一声就往队友那边跑,5 秒之内拍一下就能救人。`;
  }
  return `两个人一次都没被罩住,配合得很干净,一共捡了 ${picked} 件道具。下一关试试分头开路,速度还能更快。`;
}

export function versusLine(scores: readonly number[], names: readonly string[]): string {
  return `${names[0]} ${scores[0]} 比 ${scores[1]} ${names[1]}`;
}

/** 无尽「泡泡塔」:一层一张小地图,说的是爬到第几层 */
export function endlessLine(floor: number, best: number): string {
  if (floor >= best && floor > 0) {
    return `爬到泡泡塔第 ${floor} 层,刷新了自己的纪录!越往上小怪越多,先拍开一条能来回跑的路。`;
  }
  return `这次爬到第 ${floor} 层,最好成绩是第 ${best} 层。上一层之前把彩虹波攒长一点,清场会快很多。`;
}

// ---------------------------------------------------------------------------
// 键位
// ---------------------------------------------------------------------------

export type InputName = "up" | "right" | "down" | "left" | "drop" | "boom" | "kick";

/**
 * 朵朵 WASD + F 放泡 / G 拍破 / V 踢泡;
 * 星星 方向键 + L 放泡 / K 拍破 / J 踢泡。两套键零重叠。
 */
export const KEY_MAP: Record<string, { player: 0 | 1; action: InputName }> = {
  KeyW: { player: 0, action: "up" },
  KeyD: { player: 0, action: "right" },
  KeyS: { player: 0, action: "down" },
  KeyA: { player: 0, action: "left" },
  KeyF: { player: 0, action: "drop" },
  KeyG: { player: 0, action: "boom" },
  KeyV: { player: 0, action: "kick" },
  ArrowUp: { player: 1, action: "up" },
  ArrowRight: { player: 1, action: "right" },
  ArrowDown: { player: 1, action: "down" },
  ArrowLeft: { player: 1, action: "left" },
  KeyL: { player: 1, action: "drop" },
  KeyK: { player: 1, action: "boom" },
  KeyJ: { player: 1, action: "kick" },
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
