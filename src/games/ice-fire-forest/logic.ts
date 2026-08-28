/**
 * 冰冰火火森林 · 纯逻辑层(不碰 DOM,全部可单测)。
 *
 * 世界是一张俯视的字符网格,两位主角各占一格,按格子走:
 *  - **冰灵·凛凛**:趟得过冰水潭,进不了岩浆池;
 *  - **火灵·焰焰**:踩得住岩浆池,进不了冰水潭;
 *  - **绿黏液**:两个人都得绕开。
 * 过关条件是**两人同时站在各自的门上**,少一个都不算。
 *
 * 之所以做成格子而不是连续物理,是为了能把整局压成一个整数状态
 * `(凛凛格号, 焰焰格号, 拉杆开关)`,直接 BFS 穷举 —— 这样才有办法
 * 对全部 188 关逐关证明「一定有解」,顺带把最优步数拿来当三星标准。
 *
 * 求解器只按「一次动一个人」搜索;实时游戏里两人可以同时走,
 * 所以搜出来的解在实时里必然也走得通,是个偏保守的证明。
 */

// ---------------------------------------------------------------------------
// 格子类型
// ---------------------------------------------------------------------------

/** 地格种类(数值化,方便塞进 Uint8Array 让 BFS 跑得动) */
export const TILE = {
  WALL: 0,
  FLOOR: 1,
  ICE_WATER: 2,
  LAVA: 3,
  SLIME: 4,
  DOOR_ICE: 5,
  DOOR_FIRE: 6,
  /** 踏板:有人压着才通电 */
  PLATE: 7,
  /** 拉杆:踩上去切换通断 */
  LEVER: 8,
  /** 石闸门:通电时打开 */
  GATE: 9,
  /** 跷跷门:通电时反而关上 */
  SEESAW: 10,
  /** 传送带 */
  BELT: 11,
  /** 托举点 */
  LIFT_PAD: 12,
  /** 高坎:同伴踩在托举点上才上得去 */
  LEDGE: 13,
  /** 斜镜 ∕ */
  MIRROR_SLASH: 14,
  /** 斜镜 ＼ */
  MIRROR_BACK: 15,
  /** 光束发射器 */
  EMITTER: 16,
  /** 光束接收器 */
  RECEIVER: 17,
  /** 光门:光束接通时打开 */
  LIGHT_GATE: 18,
} as const;

export type TileCode = (typeof TILE)[keyof typeof TILE];

/** 机关最多三组(拉杆状态要塞进 BFS 状态里,组数越少搜得越快) */
export const MAX_GROUPS = 3;

/** 方向:0=右 1=左 2=下 3=上 */
export const DX = [1, -1, 0, 0];
export const DY = [0, 0, 1, -1];
export const DIR_RIGHT = 0;
export const DIR_LEFT = 1;
export const DIR_DOWN = 2;
export const DIR_UP = 3;

/** 斜镜 ∕ 的反射表:右→上、左→下、下→左、上→右 */
const MIRROR_SLASH_TURN = [DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT];
/** 斜镜 ＼ 的反射表:右→下、左→上、下→右、上→左 */
const MIRROR_BACK_TURN = [DIR_DOWN, DIR_UP, DIR_RIGHT, DIR_LEFT];

export type Hero = "ice" | "fire";
export type GemKind = "blue" | "red" | "white";

/** 中文角色名(文案里只许用这两个原创名字) */
export const HERO_NAMES: Record<Hero, string> = {
  ice: "冰灵·凛凛",
  fire: "火灵·焰焰",
};

/** 短名,HUD 上位置紧张的时候用 */
export const HERO_SHORT: Record<Hero, string> = { ice: "凛凛", fire: "焰焰" };

export interface Gem {
  pos: number;
  kind: GemKind;
}

export interface ParsedLevel {
  w: number;
  h: number;
  /** 每格的地格种类 */
  tiles: Uint8Array;
  /** 附加参数:机关格存组号(0..2),传送带存方向,发射器存方向 */
  aux: Uint8Array;
  iceStart: number;
  fireStart: number;
  iceDoor: number;
  fireDoor: number;
  gems: Gem[];
  /** 哪几组是拉杆驱动的(其余组由踏板驱动) */
  leverGroupMask: number;
  emitters: { pos: number; dir: number }[];
  hasReceiver: boolean;
}

/** 走一步的三种结果:走成了 / 撞墙 / 碰到了对自己有害的地格 */
export const ENTER_OK = 0;
export const ENTER_SOLID = 1;
export const ENTER_HURT = 2;
export type EnterResult = 0 | 1 | 2;

export interface GameState {
  ice: number;
  fire: number;
  /** 拉杆组的通断位图 */
  levers: number;
}

// ---------------------------------------------------------------------------
// 字符网格解析
// ---------------------------------------------------------------------------

/** 字符 → 含义速查表,levels.ts 与攻略面板共用一份,免得两边说法不一致 */
export const LEGEND: ReadonlyArray<{ ch: string; name: string }> = [
  { ch: "#", name: "石墙" },
  { ch: ".", name: "空地" },
  { ch: "~", name: "冰水潭(只有凛凛趟得过)" },
  { ch: "^", name: "岩浆池(只有焰焰踩得住)" },
  { ch: "%", name: "绿黏液(两个人都得绕开)" },
  { ch: "L", name: "凛凛的出发点" },
  { ch: "Y", name: "焰焰的出发点" },
  { ch: "l", name: "冰门(凛凛的出口)" },
  { ch: "y", name: "火门(焰焰的出口)" },
  { ch: "o", name: "蓝宝石" },
  { ch: "*", name: "红宝石" },
  { ch: "+", name: "白水晶" },
  { ch: "1", name: "踏板·第一组" },
  { ch: "2", name: "踏板·第二组" },
  { ch: "3", name: "踏板·第三组" },
  { ch: "4", name: "拉杆·第一组" },
  { ch: "5", name: "拉杆·第二组" },
  { ch: "6", name: "拉杆·第三组" },
  { ch: "A", name: "石闸门·第一组(通电打开)" },
  { ch: "B", name: "石闸门·第二组(通电打开)" },
  { ch: "C", name: "石闸门·第三组(通电打开)" },
  { ch: "a", name: "跷跷门·第一组(通电关上)" },
  { ch: "b", name: "跷跷门·第二组(通电关上)" },
  { ch: "c", name: "跷跷门·第三组(通电关上)" },
  { ch: ">", name: "传送带·向右" },
  { ch: "<", name: "传送带·向左" },
  { ch: "v", name: "传送带·向下" },
  { ch: "u", name: "传送带·向上" },
  { ch: "t", name: "托举点" },
  { ch: "H", name: "高坎(同伴踩住托举点才上得去)" },
  { ch: "/", name: "斜镜" },
  { ch: "\\", name: "斜镜" },
  { ch: "e", name: "光束发射器·朝右" },
  { ch: "s", name: "光束发射器·朝下" },
  { ch: "R", name: "光束接收器" },
  { ch: "D", name: "光门(光束接通才打开)" },
];

const LEGEND_CHARS = new Set(LEGEND.map((e) => e.ch));

/** 这个字符是不是网格里认识的合法字符 */
export function isKnownChar(ch: string): boolean {
  return LEGEND_CHARS.has(ch);
}

interface CellParse {
  tile: number;
  aux: number;
  gem?: GemKind;
  spawn?: Hero;
}

function parseChar(ch: string): CellParse | null {
  switch (ch) {
    case "#":
      return { tile: TILE.WALL, aux: 0 };
    case ".":
      return { tile: TILE.FLOOR, aux: 0 };
    case "~":
      return { tile: TILE.ICE_WATER, aux: 0 };
    case "^":
      return { tile: TILE.LAVA, aux: 0 };
    case "%":
      return { tile: TILE.SLIME, aux: 0 };
    case "L":
      return { tile: TILE.FLOOR, aux: 0, spawn: "ice" };
    case "Y":
      return { tile: TILE.FLOOR, aux: 0, spawn: "fire" };
    case "l":
      return { tile: TILE.DOOR_ICE, aux: 0 };
    case "y":
      return { tile: TILE.DOOR_FIRE, aux: 0 };
    case "o":
      return { tile: TILE.FLOOR, aux: 0, gem: "blue" };
    case "*":
      return { tile: TILE.FLOOR, aux: 0, gem: "red" };
    case "+":
      return { tile: TILE.FLOOR, aux: 0, gem: "white" };
    case "1":
    case "2":
    case "3":
      return { tile: TILE.PLATE, aux: ch.charCodeAt(0) - 49 };
    case "4":
    case "5":
    case "6":
      return { tile: TILE.LEVER, aux: ch.charCodeAt(0) - 52 };
    case "A":
    case "B":
    case "C":
      return { tile: TILE.GATE, aux: ch.charCodeAt(0) - 65 };
    case "a":
    case "b":
    case "c":
      return { tile: TILE.SEESAW, aux: ch.charCodeAt(0) - 97 };
    case ">":
      return { tile: TILE.BELT, aux: DIR_RIGHT };
    case "<":
      return { tile: TILE.BELT, aux: DIR_LEFT };
    case "v":
      return { tile: TILE.BELT, aux: DIR_DOWN };
    case "u":
      return { tile: TILE.BELT, aux: DIR_UP };
    case "t":
      return { tile: TILE.LIFT_PAD, aux: 0 };
    case "H":
      return { tile: TILE.LEDGE, aux: 0 };
    case "/":
      return { tile: TILE.MIRROR_SLASH, aux: 0 };
    case "\\":
      return { tile: TILE.MIRROR_BACK, aux: 0 };
    case "e":
      return { tile: TILE.EMITTER, aux: DIR_RIGHT };
    case "s":
      return { tile: TILE.EMITTER, aux: DIR_DOWN };
    case "R":
      return { tile: TILE.RECEIVER, aux: 0 };
    case "D":
      return { tile: TILE.LIGHT_GATE, aux: 0 };
    default:
      return null;
  }
}

/**
 * 把字符网格读成可运行的关卡。
 * 网格不合法(缺角色、缺门、有不认识的字符、行长不齐)就抛错 —— 生成器
 * 会在测试里被逐关检查,不会把坏网格丢到孩子面前。
 */
export function parseLevel(rows: readonly string[]): ParsedLevel {
  if (rows.length < 3) throw new Error("关卡至少要有 3 行");
  const h = rows.length;
  const w = rows[0].length;
  if (w < 3) throw new Error("关卡至少要有 3 列");
  for (const row of rows) {
    if (row.length !== w) throw new Error("关卡每一行的长度必须一致");
  }

  const tiles = new Uint8Array(w * h);
  const aux = new Uint8Array(w * h);
  const gems: Gem[] = [];
  const emitters: { pos: number; dir: number }[] = [];
  let iceStart = -1;
  let fireStart = -1;
  let iceDoor = -1;
  let fireDoor = -1;
  let leverGroupMask = 0;
  let hasReceiver = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      const cell = parseChar(ch);
      if (!cell) throw new Error(`关卡里出现了不认识的字符「${ch}」`);
      const pos = y * w + x;
      tiles[pos] = cell.tile;
      aux[pos] = cell.aux;
      if (cell.gem) gems.push({ pos, kind: cell.gem });
      if (cell.spawn === "ice") iceStart = pos;
      if (cell.spawn === "fire") fireStart = pos;
      if (cell.tile === TILE.DOOR_ICE) iceDoor = pos;
      if (cell.tile === TILE.DOOR_FIRE) fireDoor = pos;
      if (cell.tile === TILE.LEVER) leverGroupMask |= 1 << cell.aux;
      if (cell.tile === TILE.EMITTER) emitters.push({ pos, dir: cell.aux });
      if (cell.tile === TILE.RECEIVER) hasReceiver = true;
    }
  }

  if (iceStart < 0) throw new Error("关卡缺少凛凛的出发点");
  if (fireStart < 0) throw new Error("关卡缺少焰焰的出发点");
  if (iceDoor < 0) throw new Error("关卡缺少冰门");
  if (fireDoor < 0) throw new Error("关卡缺少火门");

  return {
    w,
    h,
    tiles,
    aux,
    iceStart,
    fireStart,
    iceDoor,
    fireDoor,
    gems,
    leverGroupMask,
    emitters,
    hasReceiver,
  };
}

/** 开局状态 */
export function initialState(level: ParsedLevel): GameState {
  const st: GameState = { ice: level.iceStart, fire: level.fireStart, levers: 0 };
  settle(level, st);
  return st;
}

// ---------------------------------------------------------------------------
// 通电 / 光束
// ---------------------------------------------------------------------------

/** 当前哪几组通着电:拉杆组看开关,踏板组看有没有人压着 */
export function computePower(level: ParsedLevel, st: GameState): number {
  let mask = st.levers & level.leverGroupMask;
  if (level.tiles[st.ice] === TILE.PLATE) mask |= 1 << level.aux[st.ice];
  if (level.tiles[st.fire] === TILE.PLATE) mask |= 1 << level.aux[st.fire];
  return mask & ((1 << MAX_GROUPS) - 1);
}

/** 光束会不会被这一格挡住(人另算) */
function blocksLight(tile: number, aux: number, power: number): boolean {
  switch (tile) {
    case TILE.WALL:
    case TILE.SLIME:
    case TILE.LEDGE:
    case TILE.EMITTER:
    case TILE.LIGHT_GATE:
      return true;
    case TILE.GATE:
      return ((power >> aux) & 1) === 0;
    case TILE.SEESAW:
      return ((power >> aux) & 1) === 1;
    default:
      return false;
  }
}

/**
 * 光束现在通没通:从每个发射器打一条光线,遇斜镜转弯、遇人或挡光物就断,
 * 打到接收器就算接通。光门自己永远挡光,所以不会出现「光门开不开取决于光门」的死循环。
 */
export function computeLight(level: ParsedLevel, st: GameState, power: number): boolean {
  if (level.emitters.length === 0 || !level.hasReceiver) return false;
  const { w, h, tiles, aux } = level;
  for (const em of level.emitters) {
    let x = em.pos % w;
    let y = (em.pos / w) | 0;
    let dir = em.dir;
    for (let step = 0; step < w * h * 2; step++) {
      x += DX[dir];
      y += DY[dir];
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      const p = y * w + x;
      if (p === st.ice || p === st.fire) break;
      const t = tiles[p];
      if (t === TILE.RECEIVER) return true;
      if (t === TILE.MIRROR_SLASH) {
        dir = MIRROR_SLASH_TURN[dir];
        continue;
      }
      if (t === TILE.MIRROR_BACK) {
        dir = MIRROR_BACK_TURN[dir];
        continue;
      }
      if (blocksLight(t, aux[p], power)) break;
    }
  }
  return false;
}

/** 光束一路经过的格子(只给渲染用,规则判定不看它) */
export function traceBeam(level: ParsedLevel, st: GameState, power: number): number[] {
  const path: number[] = [];
  if (level.emitters.length === 0) return path;
  const { w, h, tiles, aux } = level;
  for (const em of level.emitters) {
    let x = em.pos % w;
    let y = (em.pos / w) | 0;
    let dir = em.dir;
    for (let step = 0; step < w * h * 2; step++) {
      x += DX[dir];
      y += DY[dir];
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      const p = y * w + x;
      path.push(p);
      if (p === st.ice || p === st.fire) break;
      const t = tiles[p];
      if (t === TILE.RECEIVER) break;
      if (t === TILE.MIRROR_SLASH) {
        dir = MIRROR_SLASH_TURN[dir];
        continue;
      }
      if (t === TILE.MIRROR_BACK) {
        dir = MIRROR_BACK_TURN[dir];
        continue;
      }
      if (blocksLight(t, aux[p], power)) break;
    }
  }
  return path;
}

// ---------------------------------------------------------------------------
// 通行判定
// ---------------------------------------------------------------------------

/**
 * 某位主角能不能踏进这一格。
 * 返回 `ENTER_HURT` 的是「对我有害」的地格(走错元素的水火、绿黏液):
 * 游戏里不会真的走进去,只会被弹回来并掉一颗心 —— 求解器把它当墙看,
 * 所以证明出来的解一定不需要靠硬闯危险格。
 */
export function canEnter(
  level: ParsedLevel,
  pos: number,
  hero: Hero,
  power: number,
  light: boolean,
  partnerOnPad: boolean
): EnterResult {
  const t = level.tiles[pos];
  switch (t) {
    case TILE.FLOOR:
    case TILE.PLATE:
    case TILE.LEVER:
    case TILE.BELT:
    case TILE.LIFT_PAD:
      return ENTER_OK;
    case TILE.ICE_WATER:
      return hero === "ice" ? ENTER_OK : ENTER_HURT;
    case TILE.LAVA:
      return hero === "fire" ? ENTER_OK : ENTER_HURT;
    case TILE.SLIME:
      return ENTER_HURT;
    case TILE.DOOR_ICE:
      return hero === "ice" ? ENTER_OK : ENTER_SOLID;
    case TILE.DOOR_FIRE:
      return hero === "fire" ? ENTER_OK : ENTER_SOLID;
    case TILE.GATE:
      return ((power >> level.aux[pos]) & 1) === 1 ? ENTER_OK : ENTER_SOLID;
    case TILE.SEESAW:
      return ((power >> level.aux[pos]) & 1) === 0 ? ENTER_OK : ENTER_SOLID;
    case TILE.LIGHT_GATE:
      return light ? ENTER_OK : ENTER_SOLID;
    case TILE.LEDGE:
      return partnerOnPad ? ENTER_OK : ENTER_SOLID;
    default:
      return ENTER_SOLID;
  }
}

function heroPos(st: GameState, hero: Hero): number {
  return hero === "ice" ? st.ice : st.fire;
}

function setHeroPos(st: GameState, hero: Hero, pos: number): void {
  if (hero === "ice") st.ice = pos;
  else st.fire = pos;
}

/** 踩上拉杆就切换那一组 */
function applyLever(level: ParsedLevel, st: GameState, pos: number): void {
  if (level.tiles[pos] === TILE.LEVER) st.levers ^= 1 << level.aux[pos];
}

/**
 * 传送带结算:谁站在带子上就被一路送到带子尽头(或被挡住的地方为止)。
 * 每挪一步都要重算通电与光束 —— 有人从踏板上被带走,门是会关上的。
 * 32 步的上限只是保险丝,生成器不会造出首尾相接的带子。
 */
export function settle(
  level: ParsedLevel,
  st: GameState,
  icePath?: number[],
  firePath?: number[]
): void {
  for (let iter = 0; iter < 32; iter++) {
    let moved = false;
    for (const hero of ["ice", "fire"] as const) {
      const from = heroPos(st, hero);
      if (level.tiles[from] !== TILE.BELT) continue;
      const dir = level.aux[from];
      const x = (from % level.w) + DX[dir];
      const y = ((from / level.w) | 0) + DY[dir];
      if (x < 0 || y < 0 || x >= level.w || y >= level.h) continue;
      const to = y * level.w + x;
      const other = hero === "ice" ? st.fire : st.ice;
      if (to === other) continue;
      const power = computePower(level, st);
      const light = computeLight(level, st, power);
      const partnerOnPad = level.tiles[other] === TILE.LIFT_PAD;
      if (canEnter(level, to, hero, power, light, partnerOnPad) !== ENTER_OK) continue;
      setHeroPos(st, hero, to);
      applyLever(level, st, to);
      if (hero === "ice") icePath?.push(to);
      else firePath?.push(to);
      moved = true;
    }
    if (!moved) break;
  }
}

export interface MoveOutcome {
  /** "moved" 真的走了 / "solid" 撞上挡路的东西 / "hurt" 碰到了对自己有害的地格 */
  kind: "moved" | "solid" | "hurt";
  state: GameState;
  /** 这一步里凛凛实际经过的格子(含被传送带带走的部分),给动画用 */
  icePath: number[];
  firePath: number[];
}

/** 走一步(含拉杆切换与传送带结算),返回新状态;原状态不会被改动 */
export function moveHero(
  level: ParsedLevel,
  st: GameState,
  hero: Hero,
  dir: number
): MoveOutcome {
  const next: GameState = { ice: st.ice, fire: st.fire, levers: st.levers };
  const from = heroPos(st, hero);
  const x = (from % level.w) + DX[dir];
  const y = ((from / level.w) | 0) + DY[dir];
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) {
    return { kind: "solid", state: next, icePath: [], firePath: [] };
  }
  const to = y * level.w + x;
  const other = hero === "ice" ? st.fire : st.ice;
  if (to === other) return { kind: "solid", state: next, icePath: [], firePath: [] };

  const power = computePower(level, st);
  const light = computeLight(level, st, power);
  const partnerOnPad = level.tiles[other] === TILE.LIFT_PAD;
  const res = canEnter(level, to, hero, power, light, partnerOnPad);
  if (res === ENTER_HURT) return { kind: "hurt", state: next, icePath: [], firePath: [] };
  if (res === ENTER_SOLID) return { kind: "solid", state: next, icePath: [], firePath: [] };

  const icePath: number[] = [];
  const firePath: number[] = [];
  setHeroPos(next, hero, to);
  applyLever(level, next, to);
  if (hero === "ice") icePath.push(to);
  else firePath.push(to);
  settle(level, next, icePath, firePath);
  return { kind: "moved", state: next, icePath, firePath };
}

/** 两人是不是都站在自己的门上了 */
export function isWin(level: ParsedLevel, st: GameState): boolean {
  return st.ice === level.iceDoor && st.fire === level.fireDoor;
}

/** 两人是不是紧挨着(击掌要用) */
export function isAdjacent(level: ParsedLevel, st: GameState): boolean {
  const ax = st.ice % level.w;
  const ay = (st.ice / level.w) | 0;
  const bx = st.fire % level.w;
  const by = (st.fire / level.w) | 0;
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

// ---------------------------------------------------------------------------
// 元素之力:凛凛把岩浆冻成冰桥、焰焰把冰水烤成干地
// ---------------------------------------------------------------------------

/** 每关开局带几发元素之力 */
export const POWER_CHARGES = 2;
/** 击掌能把元素之力补到几发封顶 */
export const POWER_CHARGES_MAX = 3;

/**
 * 对着 dir 方向用一次元素之力,成功就把那一格改成空地并返回格号,否则返回 -1。
 * 它只会把关卡变简单(危险格变成平地),所以不影响「一定有解」的证明。
 */
export function useElementPower(
  level: ParsedLevel,
  st: GameState,
  hero: Hero,
  dir: number
): number {
  const from = heroPos(st, hero);
  const x = (from % level.w) + DX[dir];
  const y = ((from / level.w) | 0) + DY[dir];
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return -1;
  const to = y * level.w + x;
  const want = hero === "ice" ? TILE.LAVA : TILE.ICE_WATER;
  if (level.tiles[to] !== want) return -1;
  level.tiles[to] = TILE.FLOOR;
  return to;
}

// ---------------------------------------------------------------------------
// BFS 求解器
// ---------------------------------------------------------------------------

const LEVER_STATES = 1 << MAX_GROUPS;

/** 解法里的一步:谁、往哪个方向 */
export interface SolutionStep {
  hero: Hero;
  dir: number;
}

export interface SearchResult {
  /** 有没有搜到目标 */
  found: boolean;
  /** 最优联合步数(一次动一个人);没搜到是 -1 */
  steps: number;
  /** 搜到的那个状态 */
  state: GameState | null;
  /** 凛凛能踏到的格子 */
  iceReach: Uint8Array;
  /** 焰焰能踏到的格子 */
  fireReach: Uint8Array;
  /** 搜过的状态数,给测试看规模 */
  explored: number;
  /** 传了 trackPath 才有:从起点到目标的完整走法 */
  path: SolutionStep[] | null;
}

export interface SolveResult extends SearchResult {
  /** 两人能不能都走到自己的门上 */
  solvable: boolean;
}

/** BFS 用的临时缓冲,按最大关卡尺寸复用,免得 188 关来回申请几百兆 */
let scratchVisited: Uint8Array | null = null;
let scratchQueue: Int32Array | null = null;
let scratchFrom: Int32Array | null = null;
let scratchMove: Uint8Array | null = null;

function ensureScratch(size: number): { visited: Uint8Array; queue: Int32Array } {
  if (!scratchVisited || scratchVisited.length < size) {
    scratchVisited = new Uint8Array(size);
    scratchQueue = new Int32Array(size);
  } else {
    scratchVisited.fill(0, 0, size);
  }
  return { visited: scratchVisited, queue: scratchQueue as Int32Array };
}

function ensureTrail(size: number): { from: Int32Array; move: Uint8Array } {
  if (!scratchFrom || scratchFrom.length < size) {
    scratchFrom = new Int32Array(size);
    scratchMove = new Uint8Array(size);
  }
  return { from: scratchFrom, move: scratchMove as Uint8Array };
}

/**
 * 从 `start` 出发穷举 `(凛凛格号, 焰焰格号, 拉杆开关)` 这个状态空间,
 * 找第一个满足 `isGoal` 的状态,并顺带记下两人各自踏得到哪些格子。
 */
export function searchFrom(
  level: ParsedLevel,
  start: GameState,
  isGoal: (st: GameState) => boolean,
  trackPath = false
): SearchResult {
  const n = level.w * level.h;
  const size = n * n * LEVER_STATES;
  const { visited, queue } = ensureScratch(size);
  const trail = trackPath ? ensureTrail(size) : null;
  const iceReach = new Uint8Array(n);
  const fireReach = new Uint8Array(n);

  const encode = (st: GameState): number =>
    (st.ice * n + st.fire) * LEVER_STATES + (st.levers & (LEVER_STATES - 1));

  let head = 0;
  let tail = 0;
  const startId = encode(start);
  visited[startId] = 1;
  queue[tail++] = startId;
  iceReach[start.ice] = 1;
  fireReach[start.fire] = 1;
  if (trail) trail.from[startId] = -1;

  let steps = -1;
  let goalState: GameState | null = null;
  let goalId = -1;
  let depth = 0;
  let explored = 0;
  if (isGoal(start)) {
    steps = 0;
    goalState = { ...start };
    goalId = startId;
  }

  const heroes: Hero[] = ["ice", "fire"];
  while (head < tail && steps < 0) {
    const layerEnd = tail;
    depth++;
    while (head < layerEnd) {
      const id = queue[head++];
      explored++;
      const levers = id % LEVER_STATES;
      const rest = (id - levers) / LEVER_STATES;
      const fire = rest % n;
      const ice = (rest - fire) / n;
      const cur: GameState = { ice, fire, levers };
      for (let hi = 0; hi < heroes.length; hi++) {
        for (let dir = 0; dir < 4; dir++) {
          const out = moveHero(level, cur, heroes[hi], dir);
          if (out.kind !== "moved") continue;
          const nid = encode(out.state);
          if (visited[nid]) continue;
          visited[nid] = 1;
          if (trail) {
            trail.from[nid] = id;
            trail.move[nid] = hi * 4 + dir;
          }
          iceReach[out.state.ice] = 1;
          fireReach[out.state.fire] = 1;
          if (isGoal(out.state)) {
            steps = depth;
            goalState = out.state;
            goalId = nid;
            head = layerEnd;
            tail = layerEnd;
            break;
          }
          queue[tail++] = nid;
        }
        if (steps >= 0) break;
      }
      if (steps >= 0) break;
    }
  }

  let path: SolutionStep[] | null = null;
  if (trail && goalId >= 0) {
    path = [];
    let cur = goalId;
    while (cur !== startId && cur >= 0) {
      const code = trail.move[cur];
      path.push({ hero: heroes[(code / 4) | 0], dir: code % 4 });
      cur = trail.from[cur];
    }
    path.reverse();
  }

  return { found: steps >= 0, steps, state: goalState, iceReach, fireReach, explored, path };
}

/** 两人能不能同时到门口、最短要多少步、各自到得了哪些格子 */
export function solveLevel(level: ParsedLevel, trackPath = false): SolveResult {
  const res = searchFrom(level, initialState(level), (st) => isWin(level, st), trackPath);
  return { ...res, solvable: res.found };
}

/** 每颗宝石归谁捡 */
export function gemOwner(kind: GemKind): Hero | "both" {
  if (kind === "blue") return "ice";
  if (kind === "red") return "fire";
  return "both";
}

/** 这一关的宝石是不是都有人捡得到(三星要收齐,所以必须逐颗验) */
export function gemsAllReachable(level: ParsedLevel, res: SolveResult): boolean {
  for (const gem of level.gems) {
    const owner = gemOwner(gem.kind);
    const ok =
      owner === "ice"
        ? res.iceReach[gem.pos] === 1
        : owner === "fire"
          ? res.fireReach[gem.pos] === 1
          : res.iceReach[gem.pos] === 1 || res.fireReach[gem.pos] === 1;
    if (!ok) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 计时 / 评星
// ---------------------------------------------------------------------------

/** 一步走多久(秒);实时里两人可以同时走,所以真实用时通常比这更短 */
export const MOVE_SECONDS = 0.14;
/** 开局有几颗心 */
export const MAX_HEARTS = 3;

/** 按最优步数折算的「理论用时」 */
export function parSeconds(steps: number): number {
  return Math.max(1, steps) * MOVE_SECONDS;
}

/** 三星的用时线 */
export function threeStarSeconds(steps: number): number {
  return Math.round(parSeconds(steps) * 2.4 + 18);
}

/** 二星的用时线 */
export function twoStarSeconds(steps: number): number {
  return Math.round(parSeconds(steps) * 4.5 + 40);
}

/** 这一关最多能磨蹭多久(超时算没过,但只会说鼓励的话) */
export function timeLimitSeconds(steps: number): number {
  const raw = Math.round(parSeconds(steps) * 8 + 60);
  return Math.max(120, Math.min(480, raw));
}

export interface RunSummary {
  gems: number;
  totalGems: number;
  seconds: number;
  steps: number;
  hearts: number;
}

/**
 * 评星:
 *  - 三星 = 宝石收齐 + 用时在三星线内 + 至少还剩两颗心;
 *  - 二星 = 宝石收了一半以上,或者用时在二星线内;
 *  - 其余一星(照样过关,照样有鼓励)。
 */
export function rateRun(run: RunSummary): 1 | 2 | 3 {
  const allGems = run.totalGems === 0 || run.gems >= run.totalGems;
  if (allGems && run.seconds <= threeStarSeconds(run.steps) && run.hearts >= 2) return 3;
  if (run.gems * 2 >= run.totalGems || run.seconds <= twoStarSeconds(run.steps)) return 2;
  return 1;
}

/** 过关时说的一句话(只夸不损) */
export function winLine(run: RunSummary, stars: 1 | 2 | 3): string {
  if (stars === 3) return `${run.seconds} 秒收齐 ${run.totalGems} 颗宝石,两个人的配合已经很默契了!`;
  if (stars === 2) return `顺利会合!下次试试把宝石都捡上,再快一点就是三星。`;
  return `两个人都到门口了,这一关算过!慢慢来,路线还能再优化。`;
}

/** 没过关时说的一句话(只鼓励不批评) */
export function loseLine(reason: "time" | "hearts"): string {
  return reason === "time"
    ? "时间用完啦,不过路线你已经摸清一半了,再来一遍会顺很多。"
    : "两位小精灵有点累了,先歇一口气;记住哪几格不能碰,下一次就稳了。";
}

// ---------------------------------------------------------------------------
// 键位与 HUD 文字(纯数据,运行时与测试共用)
// ---------------------------------------------------------------------------

export type HeroAction = "up" | "down" | "left" | "right" | "power" | "cheer";

/** 朵朵那一套(W A S D + F + G)开凛凛,星星那一套(方向键 + L + K)开焰焰 */
export const KEY_MAP: Record<string, { hero: Hero; action: HeroAction }> = {
  KeyW: { hero: "ice", action: "up" },
  KeyS: { hero: "ice", action: "down" },
  KeyA: { hero: "ice", action: "left" },
  KeyD: { hero: "ice", action: "right" },
  KeyF: { hero: "ice", action: "power" },
  KeyG: { hero: "ice", action: "cheer" },
  ArrowUp: { hero: "fire", action: "up" },
  ArrowDown: { hero: "fire", action: "down" },
  ArrowLeft: { hero: "fire", action: "left" },
  ArrowRight: { hero: "fire", action: "right" },
  KeyL: { hero: "fire", action: "power" },
  KeyK: { hero: "fire", action: "cheer" },
};

/** 方向类动作 → 方向号 */
export const ACTION_DIR: Record<string, number> = {
  up: DIR_UP,
  down: DIR_DOWN,
  left: DIR_LEFT,
  right: DIR_RIGHT,
};

/** 两套键位有没有撞车 —— 同屏双人的底线,测试会一直盯着 */
export function keySetsDisjoint(): boolean {
  const ice = new Set<string>();
  const fire = new Set<string>();
  for (const [code, bind] of Object.entries(KEY_MAP)) {
    (bind.hero === "ice" ? ice : fire).add(code);
  }
  for (const code of ice) if (fire.has(code)) return false;
  return ice.size === fire.size && ice.size === 6;
}

/** HUD 上的时间显示 */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** 一个人先到门口时给的一句提示 */
export function waitingLine(iceHome: boolean, fireHome: boolean): string {
  if (iceHome && fireHome) return "两个人都到齐了!";
  if (iceHome) return "凛凛已经站在冰门上,等焰焰过来。";
  if (fireHome) return "焰焰已经站在火门上,等凛凛过来。";
  return "";
}

/** 棋盘最高占多少像素(再大也不铺满,免得一张小图被拉糊) */
const MAX_BOARD_H = 360;

/**
 * 棋盘最多能占屏幕高度的几成。
 *
 * 手机竖屏得把下半屏整个让给两套虚拟方向键 —— 375×667 上棋盘一旦超过三成高,
 * 焰焰那套方向键就被顶到屏幕外面去了,手指够不着,单人模式也就没法玩。
 * 宽屏没这个顾虑,可以放开一点。
 */
export function boardHeightBudget(viewportW: number, viewportH: number): number {
  const h = viewportH > 0 ? viewportH : 700;
  const short = h <= 520;
  const wide = viewportW >= 700;
  const sidePads = short && viewportW >= 640;
  const ratio = sidePads ? 0.58 : wide ? 0.46 : 0.29;
  const floor = sidePads ? 120 : 150;
  return Math.min(MAX_BOARD_H, Math.max(floor, h * ratio));
}
