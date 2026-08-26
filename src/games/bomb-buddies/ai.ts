// 泡泡炸弹人 · 危险预测与电脑玩家(全部纯函数)。
//
// 这一层回答三个问题:
//  1. 哪些格子马上要着火、还有多少毫秒着火(`dangerTiming`);
//  2. 从某一格出发,能不能在着火之前走到一个安全格(`findEscape`,BFS);
//  3. 电脑玩家这一帧该干什么(`chooseAiAction`)。
//
// 最重要的一条铁律:**电脑玩家绝不会把自己炸掉**。
// 每次考虑放炸弹前,都会先把「假如这颗炸弹已经放下」的世界算一遍,
// 只有在引信烧完之前确实能走到安全格,才真的放下去(见 `escapeAfterBomb`)。

import {
  DIR_NONE,
  DIRS,
  FUSE_MS,
  FLAME_MS,
  TILE_FLOOR,
  TILE_SOFT,
  bombCells,
  blastCells,
  canStand,
  chainBombs,
  idx,
  manhattan,
  stepCell,
  stepMsFor,
  tileOf,
  xOf,
  yOf,
  type Board,
  type Bomb,
  type Fighter,
  type World,
} from "./logic";

/** 判定「安全」时多留一点余量:算得再准,手比脑子慢半拍 */
export const SAFETY_MS = 140;

// ---------------------------------------------------------------------------
// 危险时刻表
// ---------------------------------------------------------------------------

/**
 * 每个格子最早什么时候会着火(毫秒,相对现在)。没列进表里的格子就是安全的。
 *
 * 连锁也算进去了:一颗炸弹先炸,被它点着的炸弹按同一时刻一起炸,
 * 所以「站在远处那颗弹旁边」也会被正确判成危险。
 */
export function dangerTiming(board: Board, bombs: readonly Bomb[], pierce = false): Map<number, number> {
  const out = new Map<number, number>();
  if (bombs.length === 0) return out;

  // 先按引信从早到晚处理:早炸的那一颗会把连锁里的其它炸弹一起拉到同一时刻
  const order = [...bombs].sort((a, b) => a.fuse - b.fuse || a.id - b.id);
  const settled = new Set<number>();
  for (const bomb of order) {
    if (settled.has(bomb.id)) continue;
    const { ids, cells } = chainBombs(board, bombs, [bomb.id], pierce);
    const at = Math.max(0, bomb.fuse);
    for (const id of ids) settled.add(id);
    for (const cell of cells) {
      const prev = out.get(cell);
      if (prev === undefined || at < prev) out.set(cell, at);
    }
  }
  return out;
}

/** 现在就危险的格子(正在烧的爆风 + 迟早要着火的格子) */
export function dangerCells(world: World): Set<number> {
  const s = new Set<number>(world.flames.keys());
  for (const cell of dangerTiming(world.board, world.bombs, world.pierce).keys()) s.add(cell);
  return s;
}

/**
 * 站着不动的话,这一格还有多少毫秒会着火。永远不会着火返回 Infinity。
 * 正在烧的爆风返回 0(现在就危险)。
 */
export function timeToBurn(world: World, cell: number, timing?: Map<number, number>): number {
  if (world.flames.has(cell)) return 0;
  const t = (timing ?? dangerTiming(world.board, world.bombs, world.pierce)).get(cell);
  return t === undefined ? Infinity : t;
}

// ---------------------------------------------------------------------------
// 逃生路径:BFS 找安全格
// ---------------------------------------------------------------------------

export interface EscapeOpts {
  /** 走一格要多少毫秒 */
  stepMs: number;
  /** 能不能钻软砖 */
  ghost?: boolean;
  /** 额外加进来的炸弹(试算「假如我在这里放一颗」) */
  extraBombs?: readonly Bomb[];
  /** 搜索上限,防止大图上跑太久 */
  maxNodes?: number;
}

export interface EscapePlan {
  /** 从起点到安全格的路径(不含起点) */
  path: number[];
  /** 最终落脚的安全格 */
  goal: number;
  /** 走完要多少毫秒 */
  cost: number;
}

/**
 * 从 `from` 出发找一条「一路上都不会被烧到」的路,终点是一个永远不着火的格子。
 *
 * 时间是算进去的:走到第 k 格的时刻是 `k * stepMs`,
 * 只有「这一格着火的时间 > 到达时刻 + 安全余量」才允许踩上去,
 * 所以 AI 不会算出一条「路过时刚好被点着」的假逃生路线。
 *
 * 找不到就返回 null——这时候 AI 会选择不放这颗炸弹。
 */
export function findEscape(world: World, from: number, opts: EscapeOpts): EscapePlan | null {
  const board = world.board;
  const bombs = opts.extraBombs && opts.extraBombs.length > 0 ? [...world.bombs, ...opts.extraBombs] : world.bombs;
  const timing = dangerTiming(board, bombs, world.pierce);
  const blocked = new Set<number>();
  for (const b of bombs) blocked.add(b.pos);
  const stepMs = Math.max(40, opts.stepMs);
  const maxNodes = opts.maxNodes ?? 900;

  // 站在原地就已经安全了:不用走
  const flameLeft = world.flames.get(from) ?? 0;
  if (!timing.has(from) && flameLeft <= 0) {
    return { path: [], goal: from, cost: 0 };
  }

  const prev = new Map<number, number>();
  const seen = new Set<number>([from]);
  let queue: number[] = [from];
  let depth = 0;
  let visited = 0;

  while (queue.length > 0 && visited < maxNodes) {
    const next: number[] = [];
    depth++;
    // 到达时刻要往两头各留一点:
    //  - `latest` 多算一格,因为决策发生在帧上、真正迈步还要等走格冷却结束;
    //  - `earliest` 少算一格,因为冷却也可能刚好归零、这一步立刻就迈出去。
    // 判「会不会被将来的爆风炸到」用 latest(算得晚一点更保守),
    // 判「现在烧着的火灭没灭」用 earliest(算得早一点更保守),两头都不踩线。
    const latest = (depth + 1) * stepMs;
    const earliest = (depth - 1) * stepMs;
    for (const cell of queue) {
      visited++;
      for (let dir = 0; dir < 4; dir++) {
        const nb = stepCell(board, cell, dir);
        if (nb < 0 || seen.has(nb)) continue;
        if (!canStand(board, nb, { ghost: opts.ghost, bombs: blocked, from })) continue;
        // 可能还在烧的爆风,和「到达前后就要炸」的格子,都不能踩
        const flame = world.flames.get(nb) ?? 0;
        if (flame > earliest) continue;
        const burn = timing.get(nb);
        if (burn !== undefined && burn <= latest + SAFETY_MS) continue;
        seen.add(nb);
        prev.set(nb, cell);
        if (burn === undefined) {
          // 找到了永远不着火的格子:回溯出路径
          const path: number[] = [];
          let cur = nb;
          while (cur !== from) {
            path.push(cur);
            cur = prev.get(cur) as number;
          }
          path.reverse();
          return { path, goal: nb, cost: path.length * stepMs };
        }
        next.push(nb);
      }
    }
    queue = next;
  }
  return null;
}

/**
 * 「假如我现在在脚下放一颗炸弹,还跑得掉吗?」——跑得掉就返回逃生方案。
 * 这就是 AI 不会自炸的那道闸门。
 */
export function escapeAfterBomb(world: World, f: Fighter): EscapePlan | null {
  const fake: Bomb = {
    id: -999,
    pos: f.pos,
    owner: f.index,
    power: f.power,
    // 遥控弹也按普通引信试算:留够真炸得掉的余地才敢放
    fuse: FUSE_MS,
    remote: false,
    slide: DIR_NONE,
    slideT: 0,
  };
  return findEscape(world, f.pos, { stepMs: stepMsFor(f.speed), ghost: f.ghost, extraBombs: [fake] });
}

// ---------------------------------------------------------------------------
// 目标搜索:最近的砖 / 道具 / 对手
// ---------------------------------------------------------------------------

export interface Quest {
  /** 走到目标的第一步方向 */
  dir: number;
  /** 目标格 */
  goal: number;
  /** 要走几步 */
  steps: number;
}

/**
 * 从 `from` 出发做一次 BFS,找出第一个满足 `want` 的格子并给出第一步方向。
 * 全程只走安全格(会着火的格子直接绕开)。
 */
export function seek(
  world: World,
  from: number,
  want: (cell: number) => boolean,
  opts: { stepMs: number; ghost?: boolean; avoid?: ReadonlySet<number>; maxNodes?: number }
): Quest | null {
  const board = world.board;
  const blocked = bombCells(world);
  const avoid = opts.avoid ?? dangerCells(world);
  const maxNodes = opts.maxNodes ?? 900;

  const prev = new Map<number, number>();
  const seen = new Set<number>([from]);
  let queue: number[] = [from];
  let visited = 0;

  while (queue.length > 0 && visited < maxNodes) {
    const next: number[] = [];
    for (const cell of queue) {
      visited++;
      for (let dir = 0; dir < 4; dir++) {
        const nb = stepCell(board, cell, dir);
        if (nb < 0 || seen.has(nb)) continue;
        const passable = canStand(board, nb, { ghost: opts.ghost, bombs: blocked, from });
        // 会着火的格子不当目标:捡道具也好、追人也好,都不值得往火里钻
        if (want(nb) && !(passable && avoid.has(nb))) {
          // 目标本身可以是一堵软砖(要炸的那种):走到它旁边就够了
          const path = tracePath(prev, from, cell);
          if (passable) path.push(nb);
          if (path.length === 0) return { dir: DIR_NONE, goal: nb, steps: 0 };
          return { dir: dirBetween(board, from, path[0]), goal: nb, steps: path.length };
        }
        if (!passable || avoid.has(nb)) continue;
        seen.add(nb);
        prev.set(nb, cell);
        next.push(nb);
      }
    }
    queue = next;
  }
  return null;
}

function tracePath(prev: Map<number, number>, from: number, to: number): number[] {
  const path: number[] = [];
  let cur = to;
  let guard = 0;
  while (cur !== from && guard++ < 4096) {
    path.push(cur);
    const p = prev.get(cur);
    if (p === undefined) break;
    cur = p;
  }
  path.reverse();
  return path;
}

/** 相邻两格之间的方向;不相邻返回 -1 */
export function dirBetween(board: Board, from: number, to: number): number {
  const dx = xOf(board, to) - xOf(board, from);
  const dy = yOf(board, to) - yOf(board, from);
  for (let d = 0; d < 4; d++) {
    if (DIRS[d].dx === dx && DIRS[d].dy === dy) return d;
  }
  return DIR_NONE;
}

/** 脚下放一颗炸弹能炸到几块软砖 */
export function bricksHit(world: World, pos: number, power: number): number {
  let n = 0;
  for (const cell of blastCells(world.board, pos, power, world.pierce)) {
    if (tileOf(world.board, cell) === TILE_SOFT) n++;
  }
  return n;
}

/** 脚下放一颗炸弹能不能盖到某个对手现在站的位置 */
export function wouldCatch(world: World, pos: number, power: number, targets: readonly number[]): boolean {
  const cells = new Set(blastCells(world.board, pos, power, world.pierce));
  return targets.some((t) => cells.has(t));
}

// ---------------------------------------------------------------------------
// 电脑玩家
// ---------------------------------------------------------------------------

/** 1=轻松(新手友好) 2=普通 3=高手(会算爆风与逃生) */
export type AiLevel = 1 | 2 | 3;

export const AI_LABEL: Record<AiLevel, string> = {
  1: "轻松",
  2: "普通",
  3: "高手",
};

export interface AiAction {
  dir: number;
  drop: boolean;
  detonate: boolean;
  /** 这一步为什么这么走(调试与单测用,也可以显示成气泡提示) */
  why: string;
}

export function idleAction(why = "等一等"): AiAction {
  return { dir: DIR_NONE, drop: false, detonate: false, why };
}

/**
 * 电脑玩家这一帧的动作。
 *
 * 决策顺序(越靠前越优先):
 *  1. 脚下危险 → 沿 BFS 逃生路径跑;跑不掉就往「最晚着火」的邻格挪一步;
 *  2. 出口关的收尾:小怪清完、出口炸开了就直奔出口;
 *  3. 手上有遥控弹,而且引爆能盖到对手、又不会盖到自己 → 按引爆;
 *  4. 站在能一发困住对手 / 小怪的位置,而且自己跑得掉 → 放弹;
 *  5. 附近有道具 → 去捡;
 *  6. 场上还有小怪 → 走到能打到它的位置(不往它身上撞);
 *  7. 旁边有软砖、放弹能炸到而且跑得掉 → 放弹;
 *  8. 高手/普通档:朝对手方向挪;轻松档:随便逛逛。
 *
 * 第 4、7 步都过了 `escapeAfterBomb` 这道闸门,所以任何档位都不会自炸。
 */
export function chooseAiAction(world: World, who: number, level: AiLevel, tick = 0): AiAction {
  const me = world.fighters[who];
  if (!me || me.bubbleT > 0) return idleAction("被泡泡包着,先歇一会儿");

  const stepMs = stepMsFor(me.speed);
  const timing = dangerTiming(world.board, world.bombs, world.pierce);
  const inDanger = world.flames.has(me.pos) || timing.has(me.pos);

  // 1) 先保命
  if (inDanger) {
    const plan = findEscape(world, me.pos, { stepMs, ghost: me.ghost });
    if (plan && plan.path.length > 0) {
      return { dir: dirBetween(world.board, me.pos, plan.path[0]), drop: false, detonate: false, why: "躲爆风" };
    }
    const fallback = latestBurnNeighbor(world, me, timing);
    if (fallback >= 0) {
      return { dir: dirBetween(world.board, me.pos, fallback), drop: false, detonate: false, why: "先挪开一格" };
    }
    return idleAction("退无可退,原地等泡泡");
  }

  const foes = world.fighters
    .filter((f) => f.index !== who && f.team !== me.team && f.bubbleT <= 0)
    .map((f) => f.pos);
  const critters = world.critters.map((c) => c.pos);
  // 撞上小怪一样会被泡泡包住,所以走位时把小怪站的格子也当成要绕开的地方
  const avoid = dangerCells(world);
  for (const cell of critters) avoid.add(cell);

  // 2) 出口关:小怪清干净、出口也炸开了,就直奔出口
  if (world.goal === "exit" && world.exitOpen && world.critters.length === 0 && world.exit >= 0) {
    if (me.pos === world.exit) return idleAction("已经站在出口上了");
    const run = seek(world, me.pos, (cell) => cell === world.exit, { stepMs, ghost: me.ghost, avoid });
    if (run && run.dir >= 0) {
      return { dir: run.dir, drop: false, detonate: false, why: "冲向出口" };
    }
  }

  // 3) 遥控弹:能困住对手又不会烧到自己就按
  if (me.remote && level >= 2) {
    const mine = world.bombs.filter((b) => b.owner === who && b.remote);
    if (mine.length > 0) {
      const cells = new Set<number>();
      for (const b of mine) for (const c of blastCells(world.board, b.pos, b.power, world.pierce)) cells.add(c);
      if (!cells.has(me.pos) && foes.some((p) => cells.has(p))) {
        return { dir: DIR_NONE, drop: false, detonate: true, why: "遥控引爆" };
      }
    }
  }

  const canBomb = world.bombs.filter((b) => b.owner === who).length < me.bombs && !hasBombHere(world, me.pos);

  // 4) 站在能一发困住对手 / 小怪的位置就放弹(轻松档不埋伏人,但照样会打小怪)
  const prey = level === 3 ? [...foes, ...critters] : critters;
  if (canBomb && prey.length > 0 && wouldCatch(world, me.pos, me.power, prey)) {
    if (escapeAfterBomb(world, me)) {
      return { dir: DIR_NONE, drop: true, detonate: false, why: "堵住对手" };
    }
  }

  // 5) 捡道具:轻松档偶尔懒得捡
  const lazy = level === 1 && tick % 3 === 0;
  if (!lazy) {
    const item = seek(world, me.pos, (cell) => world.items.has(cell), { stepMs, ghost: me.ghost, avoid });
    if (item && item.steps <= (level === 1 ? 4 : level === 2 ? 8 : 14)) {
      return { dir: item.dir, drop: false, detonate: false, why: "去捡道具" };
    }
  }

  // 6) 去打小怪:走到「放一颗就能盖到它」的位置,而不是直接往它身上撞
  if (critters.length > 0) {
    const spot = seek(world, me.pos, (cell) => !avoid.has(cell) && wouldCatch(world, cell, me.power, critters), {
      stepMs,
      ghost: me.ghost,
      avoid,
    });
    if (spot && spot.dir >= 0) {
      return { dir: spot.dir, drop: false, detonate: false, why: "绕到能打到小怪的位置" };
    }
  }

  // 7) 炸砖开路
  if (canBomb) {
    const hits = bricksHit(world, me.pos, me.power);
    if (hits >= 1 && escapeAfterBomb(world, me)) {
      return { dir: DIR_NONE, drop: true, detonate: false, why: "炸开挡路的砖" };
    }
    const brick = seek(world, me.pos, (cell) => tileOf(world.board, cell) === TILE_SOFT, {
      stepMs,
      ghost: false,
      avoid,
    });
    if (brick && brick.dir >= 0) {
      return { dir: brick.dir, drop: false, detonate: false, why: "去找砖" };
    }
  }

  // 8) 朝对手挪 / 随便逛
  if (level >= 2 && foes.length > 0) {
    const chase = seek(world, me.pos, (cell) => foes.includes(cell), { stepMs, ghost: me.ghost, avoid });
    if (chase && chase.dir >= 0) {
      return { dir: chase.dir, drop: false, detonate: false, why: "靠近对手" };
    }
  }
  const stroll = wanderDir(world, me, tick);
  return { dir: stroll, drop: false, detonate: false, why: "四处走走" };
}

function hasBombHere(world: World, cell: number): boolean {
  return world.bombs.some((b) => b.pos === cell);
}

/** 退而求其次:往「最晚才着火」的相邻格挪一步 */
function latestBurnNeighbor(world: World, me: Fighter, timing: Map<number, number>): number {
  const blocked = bombCells(world);
  let best = -1;
  let bestT = world.flames.has(me.pos) ? 0 : timing.get(me.pos) ?? Infinity;
  for (let dir = 0; dir < 4; dir++) {
    const nb = stepCell(world.board, me.pos, dir);
    if (nb < 0) continue;
    if (!canStand(world.board, nb, { ghost: me.ghost, bombs: blocked, from: me.pos })) continue;
    if (world.flames.has(nb)) continue;
    const t = timing.get(nb) ?? Infinity;
    if (t > bestT) {
      bestT = t;
      best = nb;
    }
  }
  return best;
}

/** 没事干的时候走一走:朝当前朝向走,走不动就换方向(确定性,不摇骰子) */
export function wanderDir(world: World, me: Fighter, tick: number): number {
  const blocked = bombCells(world);
  const danger = dangerCells(world);
  const ok = (dir: number): boolean => {
    const nb = stepCell(world.board, me.pos, dir);
    if (nb < 0) return false;
    if (!canStand(world.board, nb, { ghost: me.ghost, bombs: blocked, from: me.pos })) return false;
    return !danger.has(nb);
  };
  if (ok(me.facing)) return me.facing;
  for (let i = 1; i <= 4; i++) {
    const d = (me.facing + i + tick) % 4;
    if (ok(d)) return d;
  }
  return DIR_NONE;
}

// ---------------------------------------------------------------------------
// 无尽模式:场地收缩
// ---------------------------------------------------------------------------

/**
 * 一圈一圈往里收:第 step 步把第 ring 圈的空地变成硬墙。
 * 返回这一步新变成墙的格子(纯函数,不改传进来的棋盘)。
 */
export function shrinkRing(board: Board, ring: number): number[] {
  const out: number[] = [];
  const maxRing = Math.floor((Math.min(board.w, board.h) - 1) / 2);
  if (ring < 0 || ring >= maxRing) return out;
  for (let x = ring; x < board.w - ring; x++) {
    for (let y = ring; y < board.h - ring; y++) {
      const edge = x === ring || y === ring || x === board.w - 1 - ring || y === board.h - 1 - ring;
      if (!edge) continue;
      const cell = idx(board, x, y);
      if (board.cells[cell] !== TILE_FLOOR) continue;
      out.push(cell);
    }
  }
  return out;
}

/** 无尽模式第 round 轮的收缩节奏(毫秒):越往后收得越快 */
export function shrinkDelay(round: number): number {
  return Math.max(4000, 12000 - round * 900);
}

/** 距离最近的对手有多远(找不到返回 Infinity),给 AI 的走位评分用 */
export function distanceToFoe(world: World, who: number): number {
  const me = world.fighters[who];
  let best = Infinity;
  for (const f of world.fighters) {
    if (f.index === who || f.team === me.team || f.bubbleT > 0) continue;
    best = Math.min(best, manhattan(world.board, me.pos, f.pos));
  }
  return best;
}

/** 爆风还有多久烧到这里(给玩家的提示灯用):<=0 表示已经在烧 */
export function fuseHint(world: World, cell: number): number {
  if (world.flames.has(cell)) return 0;
  const t = dangerTiming(world.board, world.bombs, world.pierce).get(cell);
  return t === undefined ? Infinity : t;
}

/** 爆风快到时的告警等级:0=安全 1=注意 2=马上炸 */
export function alertLevel(msLeft: number): 0 | 1 | 2 {
  if (!Number.isFinite(msLeft)) return 0;
  if (msLeft <= FLAME_MS) return 2;
  return 1;
}
