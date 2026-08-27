/**
 * 冰冰火火森林 · 六种合作机关(纯函数,不碰 DOM)。
 *
 * ## 为什么这些机关不写进关卡网格
 *
 * `solve.test.ts` 对全部 188 关逐关跑 BFS,证明「两人一定都能站上自己的门、
 * 每颗宝石都有人捡得到、整局模拟不超时」。往网格里加新字符会把这一串证明全部推翻,
 * 而且 1.2 明令**前 99 关的关卡数据一个字都不许改**。
 *
 * 所以六种新机关全部做成**运行时叠加的增量能力**:关卡网格一个字符没动,
 * 每一件机关都**只增不减** —— 不拿走任何一条原本走得通的路。
 * 只要这一点成立,「188 关全部可解」的旧证明就自动继续成立。
 * 这不是取巧:这个目录里的元素之力(凛凛冻岩浆、焰焰烤冰水)本来就是这么做的。
 *
 * 逐条兑现「只增不减」:
 *
 * | 机关 | 为什么不会挡住任何人 |
 * | --- | --- |
 * | 双人按钮 | 闩开的那扇记忆门原本是石墙 / 绿黏液,闩开只是多一条路 |
 * | 顶举 | 纯新增动作,原来的走法一步没少 |
 * | 绳索拉伸 | 同上 |
 * | 可推箱 | 木箱是**浮桥**,两个人都踩得住;它占的又是原本谁也过不去的水火池 |
 * | 传送门配对 | 要两人各站一头再按同行键才生效,站上去不会被硬拽走 |
 * | 双人电梯 | 竖井原本是整块石墙,电梯是凭空多出来的一条通道 |
 *
 * ## 登场时机
 *
 * 一律从**第 100 关**起(`COOP_FROM_LEVEL`,0 基关号 99)。
 * 前 99 关连运行时都不叠加,和 1.1 的手感一模一样。
 */
import { mulberry32 } from "../level99";
import {
  DIR_DOWN,
  DIR_LEFT,
  DIR_RIGHT,
  DIR_UP,
  DX,
  DY,
  ENTER_OK,
  ENTER_SOLID,
  TILE,
  canEnter,
  computeLight,
  computePower,
  moveHero,
  settle,
  type EnterResult,
  type GameState,
  type Hero,
  type ParsedLevel,
} from "./logic";

// ---------------------------------------------------------------------------
// 机关清单
// ---------------------------------------------------------------------------

export type CoopKind = "dualButton" | "boost" | "rope" | "crate" | "portal" | "elevator";

/** 六种,一种不少 */
export const COOP_KINDS: readonly CoopKind[] = [
  "dualButton",
  "boost",
  "rope",
  "crate",
  "portal",
  "elevator",
];

export const COOP_NAMES: Record<CoopKind, string> = {
  dualButton: "双人按钮",
  boost: "顶举",
  rope: "绳索拉伸",
  crate: "浮桥木箱",
  portal: "传送门",
  elevator: "双人电梯",
};

/** 棋盘下面那行提示用的一句话,每条都压在 25 字以内 */
export const COOP_HINTS: Record<CoopKind, string> = {
  dualButton: "两个人各踩一个同色按钮,记忆门就一直开着。",
  boost: "挨在一起按同行键,可以把同伴举过一格障碍。",
  rope: "隔着水火池也能用绳子把同伴拉到身边。",
  crate: "水面上的木箱两个人都踩得住,还能一格一格推。",
  portal: "两人各站一扇传送门,按同行键就换个位置。",
  elevator: "升降台要两个人一起站上去才动得了。",
};

/** 第 100 关起才叠加新机关(0 基关号) */
export const COOP_FROM_LEVEL = 99;

/** 绳索最远能够到几格 */
export const ROPE_REACH = 4;

/** 顶举把同伴送出去几格 */
export const BOOST_DISTANCE = 2;

// ---------------------------------------------------------------------------
// 机关摆位与运行时状态
// ---------------------------------------------------------------------------

export interface DualButton {
  /** 凛凛那一颗按钮 */
  icePad: number;
  /** 焰焰那一颗按钮 */
  firePad: number;
  /** 两颗都压住就永久闩开的记忆门(原本是石墙或绿黏液) */
  door: number;
}

export interface Portal {
  a: number;
  b: number;
}

export interface Elevator {
  /** 升降台占的两列 */
  colA: number;
  colB: number;
  /** 上停靠层的行号(这一行两列都是空地) */
  top: number;
  /** 下停靠层的行号 */
  bottom: number;
}

export interface CoopKit {
  dualButton: DualButton | null;
  /** 浮桥木箱的起始格号;-1 表示这一关没有 */
  crate: number;
  portal: Portal | null;
  elevator: Elevator | null;
  /** 这一关真的摆上了哪几种(顶举与绳索不用摆位,只要开了就有) */
  kinds: CoopKind[];
}

export interface CoopState {
  /** 已经闩开的记忆门(0 或 1;只有一扇门,留成位图是为了以后加组) */
  latched: number;
  /** 木箱现在在哪一格;-1 表示没有 */
  crate: number;
  /** 升降台现在停在第几行;-1 表示没有 */
  elevatorRow: number;
}

export function emptyKit(): CoopKit {
  return { dualButton: null, crate: -1, portal: null, elevator: null, kinds: [] };
}

export function initialCoop(kit: CoopKit): CoopState {
  return {
    latched: 0,
    crate: kit.crate,
    elevatorRow: kit.elevator ? kit.elevator.top : -1,
  };
}

/** 拷一份运行时状态(检查点回档要用) */
export function cloneCoop(coop: CoopState): CoopState {
  return { latched: coop.latched, crate: coop.crate, elevatorRow: coop.elevatorRow };
}

// ---------------------------------------------------------------------------
// 摆位:确定性地在关卡里找位置
// ---------------------------------------------------------------------------

/** 这一格谁都走得进去吗(不看通电与光,只看地格本身) */
function plainWalkable(level: ParsedLevel, pos: number): boolean {
  const t = level.tiles[pos];
  return t === TILE.FLOOR || t === TILE.PLATE || t === TILE.LEVER || t === TILE.LIFT_PAD;
}

/** 这一格是水火池吗 */
export function isPool(level: ParsedLevel, pos: number): boolean {
  const t = level.tiles[pos];
  return t === TILE.ICE_WATER || t === TILE.LAVA;
}

/**
 * 木箱推得进这一格吗(只看地格,不看人)。
 *
 * 传送带排除在外:箱子停在带子上,骑在箱子上的人会被带子结算带走,
 * 那一幕怎么画都别扭,不如干脆不许推上去。
 */
export function crateFits(level: ParsedLevel, kit: CoopKit, pos: number): boolean {
  if (pos < 0 || pos >= level.tiles.length) return false;
  if (kit.dualButton && pos === kit.dualButton.door) return false;
  const t = level.tiles[pos];
  return t === TILE.FLOOR || t === TILE.ICE_WATER || t === TILE.LAVA || t === TILE.SLIME;
}

/** 一格四邻里的格号(越界的不给) */
function neighbours(level: ParsedLevel, pos: number): number[] {
  const x = pos % level.w;
  const y = (pos / level.w) | 0;
  const out: number[] = [];
  for (let dir = 0; dir < 4; dir++) {
    const nx = x + DX[dir];
    const ny = y + DY[dir];
    if (nx < 0 || ny < 0 || nx >= level.w || ny >= level.h) continue;
    out.push(ny * level.w + nx);
  }
  return out;
}

/** 摆位时用得着的「特殊格」:出发点、两扇门、宝石,一律避开 */
function reservedCells(level: ParsedLevel): Set<number> {
  const set = new Set<number>([level.iceStart, level.fireStart, level.iceDoor, level.fireDoor]);
  for (const g of level.gems) set.add(g.pos);
  return set;
}

/**
 * 记忆门的候选:一格石墙 / 绿黏液,左右(或上下)正好各有一格谁都走得进去的空地。
 * 闩开它等于在一堵墙上开一扇门 —— 只会多一条路。
 */
function findMemoryDoor(level: ParsedLevel, rand: () => number): number {
  const cands: number[] = [];
  for (let y = 1; y < level.h - 1; y++) {
    for (let x = 1; x < level.w - 1; x++) {
      const pos = y * level.w + x;
      const t = level.tiles[pos];
      if (t !== TILE.WALL && t !== TILE.SLIME) continue;
      const leftRight =
        plainWalkable(level, pos - 1) && plainWalkable(level, pos + 1);
      const upDown =
        plainWalkable(level, pos - level.w) && plainWalkable(level, pos + level.w);
      if (leftRight || upDown) cands.push(pos);
    }
  }
  if (cands.length === 0) return -1;
  return cands[Math.floor(rand() * cands.length) % cands.length];
}

/** 竖井:两列相邻、上下各有一层空地、中间夹着至少一行石墙 */
function findElevator(level: ParsedLevel): Elevator | null {
  const solid = (x: number, y: number): boolean => level.tiles[y * level.w + x] === TILE.WALL;
  const open = (x: number, y: number): boolean => plainWalkable(level, y * level.w + x);
  for (let x = 1; x + 1 < level.w - 1; x++) {
    for (let top = 1; top < level.h - 3; top++) {
      if (!open(x, top) || !open(x + 1, top)) continue;
      let bottom = top + 1;
      while (bottom < level.h - 1 && solid(x, bottom) && solid(x + 1, bottom)) bottom++;
      if (bottom === top + 1) continue;
      if (bottom >= level.h - 1) continue;
      if (!open(x, bottom) || !open(x + 1, bottom)) continue;
      return { colA: x, colB: x + 1, top, bottom };
    }
  }
  return null;
}

/**
 * 给第 `level`(0 基)关摆一套合作机关。
 * 同一关每次摆出来的位置完全一样(纯函数 + 定种子随机),测试才盯得住。
 */
export function buildCoopKit(level: number, parsed: ParsedLevel): CoopKit {
  const kit = emptyKit();
  if (level < COOP_FROM_LEVEL) return kit;

  const rand = mulberry32(level * 40507 + 1337);
  const reserved = reservedCells(parsed);
  const kinds: CoopKind[] = ["boost", "rope"];

  // 1. 浮桥木箱:挑一格水火池,而且至少能往一个方向推得动
  const pools: number[] = [];
  for (let pos = 0; pos < parsed.tiles.length; pos++) {
    if (!isPool(parsed, pos) || reserved.has(pos)) continue;
    const pushable = neighbours(parsed, pos).some(
      (n) => plainWalkable(parsed, n) || isPool(parsed, n)
    );
    if (pushable) pools.push(pos);
  }
  if (pools.length > 0) {
    kit.crate = pools[Math.floor(rand() * pools.length) % pools.length];
    kinds.push("crate");
  }

  // 2. 传送门:挑两格离得最远的空地,近了就不值当传送
  const floors: number[] = [];
  for (let pos = 0; pos < parsed.tiles.length; pos++) {
    if (parsed.tiles[pos] !== TILE.FLOOR || reserved.has(pos)) continue;
    if (pos === kit.crate) continue;
    floors.push(pos);
  }
  if (floors.length >= 4) {
    let best: Portal | null = null;
    let bestGap = 0;
    for (const a of floors) {
      for (const b of floors) {
        if (b <= a) continue;
        const gap = Math.abs((a % parsed.w) - (b % parsed.w));
        if (gap > bestGap) {
          bestGap = gap;
          best = { a, b };
        }
      }
    }
    if (best && bestGap >= 4) {
      kit.portal = best;
      kinds.push("portal");
    }
  }

  // 3. 双人按钮 + 记忆门
  const door = findMemoryDoor(parsed, rand);
  if (door >= 0) {
    const pads = floors.filter((p) => p !== kit.portal?.a && p !== kit.portal?.b);
    if (pads.length >= 2) {
      const icePad = pads[Math.floor(rand() * pads.length) % pads.length];
      const rest = pads.filter((p) => p !== icePad);
      const firePad = rest[Math.floor(rand() * rest.length) % rest.length];
      kit.dualButton = { icePad, firePad, door };
      kinds.push("dualButton");
    }
  }

  // 4. 双人电梯
  const lift = findElevator(parsed);
  if (lift) {
    kit.elevator = lift;
    kinds.push("elevator");
  }

  kit.kinds = kinds;
  return kit;
}

// ---------------------------------------------------------------------------
// 机关一:双人按钮
// ---------------------------------------------------------------------------

/** 两颗按钮现在是不是都被压着(必须一人一颗,一个人压两颗不算) */
export function dualPressed(kit: CoopKit, st: GameState): boolean {
  const db = kit.dualButton;
  if (!db) return false;
  return st.ice === db.icePad && st.fire === db.firePad;
}

/** 记忆门开了没 */
export function memoryDoorOpen(kit: CoopKit, coop: CoopState): boolean {
  return kit.dualButton !== null && (coop.latched & 1) === 1;
}

/**
 * 两颗按钮都压住的那一瞬间,把记忆门永久闩开。
 * 闩开之后人走开也不会再关 —— 不然两个人被按钮钉死在原地,门就成了摆设。
 */
export function latchDual(kit: CoopKit, st: GameState, coop: CoopState): CoopState {
  if (!dualPressed(kit, st) || memoryDoorOpen(kit, coop)) return coop;
  return { ...coop, latched: coop.latched | 1 };
}

// ---------------------------------------------------------------------------
// 机关二:顶举
// ---------------------------------------------------------------------------

/**
 * `actor` 把紧挨着的同伴往「背对自己」的方向举出去 `BOOST_DISTANCE` 格。
 * 举得成就返回同伴的新格号,举不成返回 -1。
 *
 * 落点要满足:在图里、同伴自己走得进去、而且没被 `actor` 占着。
 * 高坎(`LEDGE`)本来要同伴踩托举点才上得去 —— 顶举正好是「亲手托一把」,所以照样算数。
 */
export function boostTarget(
  level: ParsedLevel,
  st: GameState,
  actor: Hero,
  power: number,
  light: boolean
): number {
  const from = actor === "ice" ? st.ice : st.fire;
  const mate = actor === "ice" ? st.fire : st.ice;
  const fx = from % level.w;
  const fy = (from / level.w) | 0;
  const mx = mate % level.w;
  const my = (mate / level.w) | 0;
  const dx = mx - fx;
  const dy = my - fy;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return -1;

  const tx = mx + dx * BOOST_DISTANCE;
  const ty = my + dy * BOOST_DISTANCE;
  if (tx < 0 || ty < 0 || tx >= level.w || ty >= level.h) return -1;
  const to = ty * level.w + tx;
  if (to === from) return -1;
  const mateHero: Hero = actor === "ice" ? "fire" : "ice";
  // 举过去的人是被同伴亲手托上去的,所以 partnerOnPad 记 true
  if (canEnter(level, to, mateHero, power, light, true) !== ENTER_OK) return -1;
  return to;
}

// ---------------------------------------------------------------------------
// 机关三:绳索拉伸
// ---------------------------------------------------------------------------

/**
 * `actor` 隔空把同伴拉到自己身边。
 *
 * 条件:两人在同一行或同一列,相隔 2..`ROPE_REACH` 格,
 * 而且中间**至少隔着一格同伴自己过不去的东西**(不然直接走过来就好了,用不着绳子)。
 * 拉过来的落点是紧挨着 `actor` 的那一格,同伴得站得住。
 *
 * 拉得成返回同伴的新格号,拉不成返回 -1。
 */
export function ropePull(
  level: ParsedLevel,
  st: GameState,
  actor: Hero,
  power: number,
  light: boolean
): number {
  const from = actor === "ice" ? st.ice : st.fire;
  const mate = actor === "ice" ? st.fire : st.ice;
  const mateHero: Hero = actor === "ice" ? "fire" : "ice";
  const fx = from % level.w;
  const fy = (from / level.w) | 0;
  const mx = mate % level.w;
  const my = (mate / level.w) | 0;
  if (fx !== mx && fy !== my) return -1;
  const dist = Math.abs(fx - mx) + Math.abs(fy - my);
  if (dist < 2 || dist > ROPE_REACH) return -1;

  const sx = Math.sign(mx - fx);
  const sy = Math.sign(my - fy);
  let blocked = false;
  for (let i = 1; i < dist; i++) {
    const pos = (fy + sy * i) * level.w + (fx + sx * i);
    if (canEnter(level, pos, mateHero, power, light, false) !== ENTER_OK) blocked = true;
  }
  if (!blocked) return -1;

  const to = (fy + sy) * level.w + (fx + sx);
  if (canEnter(level, to, mateHero, power, light, true) !== ENTER_OK) return -1;
  return to;
}

// ---------------------------------------------------------------------------
// 机关四:浮桥木箱
// ---------------------------------------------------------------------------

export interface CratePushPlan {
  /** 木箱推到哪一格 */
  crate: number;
  /** 骑在木箱上的同伴跟着到哪一格(-1 = 没人骑) */
  rider: number;
  /** 推的人自己走到哪一格(-1 = 站在岸上不跟过去) */
  pusher: number;
}

/**
 * 有人往 `dir` 走,木箱正好挡在前面 —— 这一推会发生什么?
 *
 * 三件事分开算,这是本机关最要紧的地方:
 *
 *  1. **木箱**能不能滑到下一格(只看地格,水火泥都行,墙和机关不行);
 *  2. **骑在木箱上的同伴**跟着走 —— 这就是「摆渡」:
 *     凛凛趟在冰水里推,焰焰坐在木箱上过河,这一款最像样的一次合作;
 *  3. **推的人**只有在自己站得住木箱腾出来的那一格时才跟进去;
 *     站不住就留在岸上,不会稀里糊涂踩进池子。
 *
 * 推不动就返回 null(推不动也没关系:木箱本来就站得上去)。
 */
export function planCratePush(
  level: ParsedLevel,
  kit: CoopKit,
  coop: CoopState,
  st: GameState,
  hero: Hero,
  dir: number,
  power: number,
  light: boolean
): CratePushPlan | null {
  if (coop.crate < 0) return null;
  const cx = (coop.crate % level.w) + DX[dir];
  const cy = ((coop.crate / level.w) | 0) + DY[dir];
  if (cx < 0 || cy < 0 || cx >= level.w || cy >= level.h) return null;
  const dest = cy * level.w + cx;
  if (!crateFits(level, kit, dest)) return null;

  const from = hero === "ice" ? st.ice : st.fire;
  const mate = hero === "ice" ? st.fire : st.ice;
  if (dest === from) return null;
  const riding = mate === coop.crate;
  if (!riding && dest === mate) return null;

  const partnerOnPad = level.tiles[mate] === TILE.LIFT_PAD;
  const pusherFollows =
    canEnter(level, coop.crate, hero, power, light, partnerOnPad) === ENTER_OK;
  return { crate: dest, rider: riding ? dest : -1, pusher: pusherFollows ? coop.crate : -1 };
}

/** 木箱现在在这一格上吗(在的话谁都踩得住) */
export function crateAt(coop: CoopState, pos: number): boolean {
  return coop.crate >= 0 && coop.crate === pos;
}

// ---------------------------------------------------------------------------
// 机关五:传送门配对
// ---------------------------------------------------------------------------

/** 两人是不是正好一人站一扇传送门 */
export function portalReady(kit: CoopKit, st: GameState): boolean {
  const p = kit.portal;
  if (!p) return false;
  return (st.ice === p.a && st.fire === p.b) || (st.ice === p.b && st.fire === p.a);
}

/**
 * 两人各站一扇门时按同行键 —— 交换位置。
 * 一定要**显式按键**才生效:站上去就被硬拽走的话,这一格就等于没了,
 * 「只增不减」也就不成立了。
 */
export function portalSwap(kit: CoopKit, st: GameState): GameState | null {
  if (!portalReady(kit, st)) return null;
  return { ice: st.fire, fire: st.ice, levers: st.levers };
}

// ---------------------------------------------------------------------------
// 机关六:双人电梯
// ---------------------------------------------------------------------------

/** 升降台现在占的那两格 */
export function elevatorCellsIn(level: ParsedLevel, kit: CoopKit, coop: CoopState): number[] {
  const lift = kit.elevator;
  if (!lift || coop.elevatorRow < 0) return [];
  return [coop.elevatorRow * level.w + lift.colA, coop.elevatorRow * level.w + lift.colB];
}

/** 两人是不是都站在升降台上 */
export function elevatorReady(
  level: ParsedLevel,
  kit: CoopKit,
  st: GameState,
  coop: CoopState
): boolean {
  const cells = elevatorCellsIn(level, kit, coop);
  if (cells.length !== 2) return false;
  return (
    (st.ice === cells[0] && st.fire === cells[1]) || (st.ice === cells[1] && st.fire === cells[0])
  );
}

/**
 * 两人都站上去之后往 `dir`(上 / 下)开一格。
 * 开得动就返回新的状态,开不动返回 null。
 */
export function elevatorRide(
  level: ParsedLevel,
  kit: CoopKit,
  st: GameState,
  coop: CoopState,
  dir: number
): { state: GameState; coop: CoopState } | null {
  const lift = kit.elevator;
  if (!lift || !elevatorReady(level, kit, st, coop)) return null;
  const step = dir === DIR_DOWN ? 1 : dir === DIR_UP ? -1 : 0;
  if (step === 0) return null;
  const row = coop.elevatorRow + step;
  if (row < lift.top || row > lift.bottom) return null;
  const iceCol = st.ice % level.w;
  const fireCol = st.fire % level.w;
  return {
    state: { ice: row * level.w + iceCol, fire: row * level.w + fireCol, levers: st.levers },
    coop: { ...coop, elevatorRow: row },
  };
}

// ---------------------------------------------------------------------------
// 把机关接进「走一步」
// ---------------------------------------------------------------------------

/** 叠加了合作机关之后,这一格能不能进 */
export function canEnterCoop(
  level: ParsedLevel,
  kit: CoopKit,
  coop: CoopState,
  pos: number,
  hero: Hero,
  power: number,
  light: boolean,
  partnerOnPad: boolean
): EnterResult {
  if (kit.dualButton && pos === kit.dualButton.door) {
    return memoryDoorOpen(kit, coop) ? ENTER_OK : ENTER_SOLID;
  }
  // 木箱是浮桥:两个人都站得住,底下是冰水还是岩浆都不要紧
  if (crateAt(coop, pos)) return ENTER_OK;
  return canEnter(level, pos, hero, power, light, partnerOnPad);
}

export interface CoopMove {
  /** "moved" 走了 / "solid" 挡住了 / "hurt" 踩进了自己过不去的池子 */
  kind: "moved" | "solid" | "hurt";
  state: GameState;
  coop: CoopState;
  icePath: number[];
  firePath: number[];
  /** 这一步顺手把木箱推了一格吗 */
  pushed: boolean;
}

/**
 * 走一步,顺带处理木箱、记忆门与双人按钮。
 *
 * 没有机关的格子一律转交给 `logic.ts` 的 `moveHero`,行为和 1.1 完全一致 ——
 * 这样前 99 关(压根没有机关套件)连一个字节的差别都没有。
 */
export function moveWithCoop(
  level: ParsedLevel,
  kit: CoopKit,
  coop: CoopState,
  st: GameState,
  hero: Hero,
  dir: number
): CoopMove {
  const keep = (kind: "solid" | "hurt"): CoopMove => ({
    kind,
    state: { ...st },
    coop: cloneCoop(coop),
    icePath: [],
    firePath: [],
    pushed: false,
  });

  const from = hero === "ice" ? st.ice : st.fire;
  const x = (from % level.w) + DX[dir];
  const y = ((from / level.w) | 0) + DY[dir];
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return keep("solid");
  const to = y * level.w + x;
  const other = hero === "ice" ? st.fire : st.ice;

  const onCrate = crateAt(coop, to);
  const onDoor = kit.dualButton !== null && to === kit.dualButton.door;
  if (!onCrate && to === other) return keep("solid");
  if (!onCrate && !onDoor) {
    const out = moveHero(level, st, hero, dir);
    const next = out.kind === "moved" ? latchDual(kit, out.state, coop) : cloneCoop(coop);
    return {
      kind: out.kind,
      state: out.state,
      coop: next,
      icePath: out.icePath,
      firePath: out.firePath,
      pushed: false,
    };
  }

  const power = computePower(level, st);
  const light = computeLight(level, st, power);
  const partnerOnPad = level.tiles[other] === TILE.LIFT_PAD;

  const state: GameState = { ice: st.ice, fire: st.fire, levers: st.levers };
  const nextCoop = cloneCoop(coop);
  const icePath: number[] = [];
  const firePath: number[] = [];
  const walkTo = (who: Hero, pos: number): void => {
    if (who === "ice") {
      state.ice = pos;
      icePath.push(pos);
    } else {
      state.fire = pos;
      firePath.push(pos);
    }
  };

  let pushed = false;
  if (onCrate) {
    const plan = planCratePush(level, kit, coop, st, hero, dir, power, light);
    if (plan) {
      nextCoop.crate = plan.crate;
      pushed = true;
      if (plan.rider >= 0) walkTo(hero === "ice" ? "fire" : "ice", plan.rider);
      if (plan.pusher >= 0) walkTo(hero, plan.pusher);
    } else {
      // 推不动就爬上去 —— 同伴正骑在上面的话就真的挤不进去了
      if (to === other) return keep("solid");
      walkTo(hero, to);
    }
  } else {
    if (!memoryDoorOpen(kit, coop)) return keep("solid");
    walkTo(hero, to);
  }

  // 站在岸上把木箱推走也是一次成功的操作:人没挪,但木箱漂出去了
  if (icePath.length === 0 && firePath.length === 0 && !pushed) return keep("solid");
  // 木箱与记忆门都不会是拉杆,所以这里不用再切一次拉杆
  settle(level, state, icePath, firePath);
  return { kind: "moved", state, coop: latchDual(kit, state, nextCoop), icePath, firePath, pushed };
}

// ---------------------------------------------------------------------------
// 光路提示:哪个开关连哪扇门
// ---------------------------------------------------------------------------

export interface LinkHint {
  /** 开关(踏板或拉杆)的格号 */
  from: number;
  /** 它管的那扇门的格号 */
  to: number;
  group: number;
}

/**
 * 把「开关 → 门」的连线列出来,渲染层画一条虚线光路。
 * 孩子最容易卡的地方就是「这颗踏板到底开的是哪扇门」。
 */
export function linkHints(level: ParsedLevel): LinkHint[] {
  const switches: Array<{ pos: number; group: number }> = [];
  const gates: Array<{ pos: number; group: number }> = [];
  for (let pos = 0; pos < level.tiles.length; pos++) {
    const t = level.tiles[pos];
    if (t === TILE.PLATE || t === TILE.LEVER) switches.push({ pos, group: level.aux[pos] });
    if (t === TILE.GATE || t === TILE.SEESAW) gates.push({ pos, group: level.aux[pos] });
  }
  const out: LinkHint[] = [];
  for (const s of switches) {
    for (const g of gates) {
      if (g.group === s.group) out.push({ from: s.pos, to: g.pos, group: s.group });
    }
  }
  return out;
}

/** 给渲染用:方向号 → 单位向量(重新导出一份,渲染层就不用再 import logic) */
export const DIRS = [DIR_RIGHT, DIR_LEFT, DIR_DOWN, DIR_UP] as const;
