// 泡泡布阵 · 危险预测与电脑玩家(全部纯函数)。
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

/**
 * 现在就危险的格子(正在散的彩虹波 + 迟早要被扫到的格子)。
 * 时刻表可以外面算好传进来 —— 一帧里要问好几次,不必每次都重算一遍连锁。
 */
export function dangerCells(world: World, timing?: Map<number, number>): Set<number> {
  const s = new Set<number>(world.flames.keys());
  for (const cell of (timing ?? dangerTiming(world.board, world.bombs, world.pierce)).keys()) s.add(cell);
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
  /** 额外加进来的泡泡(试算「假如我在这里放一颗」) */
  extraBombs?: readonly Bomb[];
  /**
   * 迈出第一步之前还要等多少毫秒(走格冷却没走完的那一截)。
   * 1.2 起必须算上它:泡泡 2 秒就破,少算这半步就是「以为跑得掉,其实差一格」。
   */
  startDelay?: number;
  /** 逃命时把小怪站的格子当墙绕开(默认开;绕不开时上层会关掉再算一次) */
  avoidCritters?: boolean;
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
  // 逃命路上一头撞进小怪怀里,一样会被罩住 —— 它们站的格子当墙绕开。
  // 真的一格都绕不开时(`avoidCritters` 关掉重来一次),再退回「至少先躲开彩虹波」。
  if (opts.avoidCritters !== false) for (const c of world.critters) blocked.add(c.pos);
  const stepMs = Math.max(40, opts.stepMs);
  const startDelay = Math.max(0, opts.startDelay ?? 0);
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
    const latest = startDelay + (depth + 1) * stepMs;
    const earliest = Math.max(0, startDelay + (depth - 1) * stepMs);
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
          return { path, goal: nb, cost: startDelay + path.length * stepMs };
        }
        next.push(nb);
      }
    }
    queue = next;
  }
  return null;
}

/**
 * 「假如我现在在脚下放一颗泡泡,还跑得掉吗?」——跑得掉就返回逃生方案。
 * 这就是 AI 不会把自己关进泡泡的那道闸门:**三档都要过这一关**。
 *
 * 手上那半步冷却(`moveT`)一起算进去:泡泡只有 2 秒,
 * 不算这半步的话,算出来的「跑得掉」在真跑的时候会差一格。
 */
export function escapeAfterBomb(world: World, f: Fighter): EscapePlan | null {
  const fake: Bomb = {
    id: -999,
    pos: f.pos,
    owner: f.index,
    power: f.power,
    // 遥控泡泡也按普通引信试算:留够真跑得掉的余地才敢放
    fuse: FUSE_MS,
    remote: false,
    slide: DIR_NONE,
    slideT: 0,
  };
  return findEscape(world, f.pos, {
    stepMs: stepMsFor(f.speed),
    ghost: f.ghost,
    extraBombs: [fake],
    startDelay: Math.max(0, f.moveT),
  });
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

/** 脚下放一颗泡泡能拍开几块软砖 */
export function bricksHit(world: World, pos: number, power: number): number {
  let n = 0;
  for (const cell of blastCells(world.board, pos, power, world.pierce)) {
    if (tileOf(world.board, cell) === TILE_SOFT) n++;
  }
  return n;
}

/** 脚下放一颗泡泡能不能盖到某个对手现在站的位置 */
export function wouldCatch(world: World, pos: number, power: number, targets: readonly number[]): boolean {
  const cells = new Set(blastCells(world.board, pos, power, world.pierce));
  return targets.some((t) => cells.has(t));
}

/**
 * 「假如我走到 `cell` 再放一颗泡泡,还跑得掉吗?」——**踩点用的快筛**。
 *
 * 和 `escapeAfterBomb` 分工明确:那一个是真要放泡泡之前的精算闸门(会算连锁、算到达时刻),
 * 这一个是找位置时一格一格试的粗筛,只问「引信烧完之前,能不能走到一个完全干净的格子」。
 * 判定比精算更严(要求落脚点当下就绝对安全),所以筛过的位置精算一定也过得去,
 * 而代价只有一次小范围 BFS —— 一帧里试六七个位置也不卡。
 */
export function canEscapeFrom(world: World, f: Fighter, cell: number, timing?: Map<number, number>): boolean {
  const board = world.board;
  const stepMs = stepMsFor(f.speed);
  const danger = timing ?? dangerTiming(board, world.bombs, world.pierce);
  const blast = new Set(blastCells(board, cell, f.power, world.pierce));
  const blocked = new Set<number>([...bombCells(world), cell]);
  // 引信烧完之前迈得出几步(起步那半格冷却也算上)
  const startDelay = cell === f.pos ? Math.max(0, f.moveT) : stepMs;
  const budget = Math.min(6, Math.floor((FUSE_MS - SAFETY_MS - startDelay) / stepMs));
  if (budget <= 0) return false;

  const seen = new Set<number>([cell]);
  let ring = [cell];
  for (let step = 0; step < budget; step++) {
    const next: number[] = [];
    for (const from of ring) {
      for (let dir = 0; dir < 4; dir++) {
        const nb = stepCell(board, from, dir);
        if (nb < 0 || seen.has(nb)) continue;
        if (!canStand(board, nb, { ghost: f.ghost, bombs: blocked, from: cell })) continue;
        if (world.flames.has(nb)) continue;
        seen.add(nb);
        if (!blast.has(nb) && !danger.has(nb)) return true;
        next.push(nb);
      }
    }
    ring = next;
  }
  return false;
}

/**
 * 预判(高手档专用):对手接下来 `steps` 步之内可能站到哪些格。
 *
 * 不猜他想去哪,只算他**够得着**哪儿——够得着的格子越少,说明他越憋屈。
 * 高手档就朝这片格子的中间放泡泡,而不是朝他现在站的那一格放(等泡泡破的时候他早走了)。
 */
export function predictFoeCells(world: World, foePos: number, steps: number, ghost = false): number[] {
  const board = world.board;
  const blocked = bombCells(world);
  const seen = new Set<number>([foePos]);
  let ring = [foePos];
  for (let s = 0; s < Math.max(0, steps); s++) {
    const next: number[] = [];
    for (const cell of ring) {
      for (let dir = 0; dir < 4; dir++) {
        const nb = stepCell(board, cell, dir);
        if (nb < 0 || seen.has(nb)) continue;
        if (!canStand(board, nb, { ghost, bombs: blocked, from: foePos })) continue;
        seen.add(nb);
        next.push(nb);
      }
    }
    ring = next;
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * 封路(高手档专用):我在 `at` 放一颗泡泡以后,站在 `foePos` 的人还剩几个安全落脚点。
 *
 * 数字越小,说明这一颗把他的退路封得越狠;数到 0 就是「他只能等着被罩住」。
 */
export function foeEscapeCount(world: World, at: number, power: number, foePos: number, ghost = false): number {
  const board = world.board;
  const fake: Bomb = {
    id: -997,
    pos: at,
    owner: -1,
    power,
    fuse: FUSE_MS,
    remote: false,
    slide: DIR_NONE,
    slideT: 0,
  };
  const timing = dangerTiming(board, [...world.bombs, fake], world.pierce);
  const blocked = new Set<number>([...bombCells(world), at]);
  const seen = new Set<number>([foePos]);
  let ring = [foePos];
  let safe = timing.has(foePos) ? 0 : 1;
  // 只看三步以内:再远就不是「这一颗泡泡封不封得住」的问题了
  for (let s = 0; s < 3; s++) {
    const next: number[] = [];
    for (const cell of ring) {
      for (let dir = 0; dir < 4; dir++) {
        const nb = stepCell(board, cell, dir);
        if (nb < 0 || seen.has(nb)) continue;
        if (!canStand(board, nb, { ghost, bombs: blocked, from: foePos })) continue;
        seen.add(nb);
        next.push(nb);
        if (!timing.has(nb) && !world.flames.has(nb)) safe++;
      }
    }
    ring = next;
  }
  return safe;
}

// ---------------------------------------------------------------------------
// 电脑玩家
// ---------------------------------------------------------------------------

/** 1=轻松(新手友好) 2=普通 3=高手(会预判落点、会封退路) */
export type AiLevel = 1 | 2 | 3;

export const AI_LABEL: Record<AiLevel, string> = {
  1: "轻松",
  2: "普通",
  3: "高手",
};

export interface AiTuning {
  /**
   * 隔多久才重新想一步(毫秒):档位越低想得越慢,给孩子留出反应时间。
   * 两次思考之间它照着上一步的方向继续走 —— 见 `pacedAiAction()`。
   */
  thinkMs: number;
  /** 愿意为一件道具跑多远 */
  itemReach: number;
  /** 会不会主动埋伏人 */
  hunt: boolean;
  /** 会不会预判对手的落点(不朝他现在站的地方放,朝他要去的地方放) */
  predict: boolean;
  /** 会不会挑「能把对手退路封死」的那一格 */
  cutoff: boolean;
  /** 走到远处一个「放完跑得掉」的位置去放泡泡(轻松档只在脚下就位时才放) */
  reposition: boolean;
}

/** 三档的全部差别都摊在这张表上,便于单测逐项断言 */
export const AI_TUNING: Record<AiLevel, AiTuning> = {
  // 轻松档也会挪位置再放泡泡 —— 这不是「强」,是「玩得下去」:
  // 泡泡只有 2 秒,不许挪位置的电脑会站在原地一颗都放不出来,那不叫简单,叫坏了。
  1: { thinkMs: 260, itemReach: 4, hunt: false, predict: false, cutoff: false, reposition: true },
  2: { thinkMs: 150, itemReach: 8, hunt: false, predict: false, cutoff: false, reposition: true },
  3: { thinkMs: 70, itemReach: 14, hunt: true, predict: true, cutoff: true, reposition: true },
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

// ---------------------------------------------------------------------------
// 思考节奏
// ---------------------------------------------------------------------------

/**
 * 这一档隔多久才重新想一步(毫秒);档号不认识就按普通档。
 *
 * **这是思考节奏唯一的出处。** 1.2 之前 `AI_TUNING.thinkMs` 全仓库没有一处生产代码读它,
 * 同一组数字在 `index.ts` 里被手抄成了一句 `skill === 1 ? 260 : skill === 2 ? 150 : 70`。
 * 抄出来的那份才是真上场的,表里那份只被单测断言单调 —— 调表不改游戏、改游戏不红单测。
 */
export function thinkMsFor(level: AiLevel): number {
  return (AI_TUNING[level] ?? AI_TUNING[2]).thinkMs;
}

/** 一个电脑座位的思考节拍器(会被 `pacedAiAction` 就地改写) */
export interface AiPacer {
  /** 还有多少毫秒才轮到下一次重新想 */
  cool: number;
  /** 上一次想出来的方向:冷却期间照着它继续走 */
  dir: number;
  /** 这一帧是真想了(true),还是照着上一步走(false) */
  fresh: boolean;
}

export function createPacer(): AiPacer {
  return { cool: 0, dir: DIR_NONE, fresh: false };
}

/**
 * 按档位节奏想一步 —— **游戏与单测共用的那一份**。
 *
 * `chooseAiAction()` 回答的是「这一刻最该干什么」,它不管节奏;
 * 真正让三档拉开差距的是**多久问一次**:轻松档 260ms 才问一次,
 * 中间那十几帧它照着旧主意闷头走,撞见新情况也得等下一拍才反应得过来。
 *
 * 这个节奏以前只长在 `index.ts` 的主循环里,单测够不着,于是
 * `ai12.test.ts` 那条「固定 seed 的胜率」回归线是**每 20ms 重想一次**跑出来的——
 * 等于把三档的思考节奏抹平,量的是一个不存在的电脑(实测:抹平之后
 * 高手档打普通档 3 比 5,**倒输**;按真节奏跑是 4 比 1)。
 * 挪进来之后两边跑的是同一份代码。
 *
 * 冷却期间只重复方向,**不重复放泡泡也不重复引爆**:那两件事按一次就够,
 * 连按十几帧只会把手里的泡泡一次全撒出去。
 */
export function pacedAiAction(
  pacer: AiPacer,
  world: World,
  who: number,
  level: AiLevel,
  dtMs: number,
  tick = 0
): AiAction {
  pacer.cool -= Math.max(0, dtMs);
  if (pacer.cool > 0) {
    pacer.fresh = false;
    return { dir: pacer.dir, drop: false, detonate: false, why: "照着上一步走" };
  }
  pacer.cool = thinkMsFor(level);
  pacer.fresh = true;
  const act = chooseAiAction(world, who, level, tick);
  pacer.dir = act.dir;
  return act;
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
    const startDelay = Math.max(0, me.moveT);
    const plan =
      findEscape(world, me.pos, { stepMs, ghost: me.ghost, startDelay }) ??
      // 小怪把每条退路都堵上了:那就先躲开彩虹波,被小怪抱一下总比两头都挨上强
      findEscape(world, me.pos, { stepMs, ghost: me.ghost, startDelay, avoidCritters: false });
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
  // 撞上小怪一样会被罩进泡泡,所以走位时把小怪站的格子也当成要绕开的地方
  const avoid = dangerCells(world, timing);
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
  const tune = AI_TUNING[level];

  // 4) 站在能一发罩住对手 / 小怪的位置就放泡泡(轻松档不埋伏人,但照样会打小怪)
  const prey = tune.hunt ? [...foes, ...critters] : critters;
  if (canBomb && prey.length > 0) {
    // 高手档不只看「他现在站哪」,还看「他两步之内能去哪」:等泡泡破的时候人早挪窝了
    const aimed = tune.predict
      ? [...prey, ...foes.flatMap((p) => predictFoeCells(world, p, 2))]
      : prey;
    const hit = wouldCatch(world, me.pos, me.power, aimed);
    // 封路:这一颗放下去,对手还剩几个安全落脚点?剩得越少越值得放
    const cuts = tune.cutoff && foes.length > 0 && foes.some((p) => foeEscapeCount(world, me.pos, me.power, p, me.ghost) <= 1);
    if ((hit || cuts) && escapeAfterBomb(world, me)) {
      return { dir: DIR_NONE, drop: true, detonate: false, why: cuts && !hit ? "封住对手的退路" : "堵住对手" };
    }
  }

  // 5) 捡道具:轻松档偶尔懒得捡
  const lazy = level === 1 && tick % 3 === 0;
  if (!lazy) {
    const item = seek(world, me.pos, (cell) => world.items.has(cell), { stepMs, ghost: me.ghost, avoid });
    if (item && item.steps <= tune.itemReach) {
      return { dir: item.dir, drop: false, detonate: false, why: "去捡道具" };
    }
  }

  // 6) 去打小怪:走到「放一颗就能盖到它、而且放完自己跑得掉」的位置,而不是直接往它身上撞
  if (critters.length > 0 && canBomb) {
    if (wouldCatch(world, me.pos, me.power, critters) && escapeAfterBomb(world, me)) {
      return { dir: DIR_NONE, drop: true, detonate: false, why: "放一颗把小怪包起来" };
    }
    const spot = safeBombSpot(
      world,
      me,
      avoid,
      // 先用「同行同列且够得着」这个 O(1) 的粗筛挡一道,真去算爆风覆盖的只剩几格
      (cell) => inLineWithin(world.board, cell, critters, me.power) && wouldCatch(world, cell, me.power, critters),
      tune,
      timing
    );
    if (spot && spot.dir >= 0) {
      return { dir: spot.dir, drop: false, detonate: false, why: "绕到能打到小怪的位置" };
    }
  }

  // 7) 拍开挡路的砖。
  // 手上已经有一颗在场上就先不放第二颗:多摆一颗只是给自己多画一条危险线,
  // 而清砖这件事本来就不急 —— 打人和打小怪(第 4、6 步)才享受「摆满」的权利。
  if (canBomb && world.bombs.every((b) => b.owner !== who)) {
    const hits = bricksHit(world, me.pos, me.power);
    if (hits >= 1 && escapeAfterBomb(world, me)) {
      return { dir: DIR_NONE, drop: true, detonate: false, why: "拍开挡路的砖" };
    }
    // 脚下这一格放完跑不掉(或者压根拍不到砖):换一格站,而不是傻站着等
    const spot = safeBombSpot(world, me, avoid, (cell) => brickBeside(world.board, cell), tune, timing);
    if (spot && spot.dir >= 0) {
      return { dir: spot.dir, drop: false, detonate: false, why: "挪到能安全放泡泡的位置" };
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

/** 一次决策里最多试算几个「放完跑得掉吗」——BFS 套 BFS,得给它封个顶 */
const SPOT_TRIES = 6;

/** 四邻有没有软砖(站上去放一颗必定能拍开砖):踩点时的 O(1) 粗筛 */
function brickBeside(board: Board, cell: number): boolean {
  for (let dir = 0; dir < 4; dir++) {
    const nb = stepCell(board, cell, dir);
    if (nb >= 0 && tileOf(board, nb) === TILE_SOFT) return true;
  }
  return false;
}

/** 和任一目标同行或同列、而且在射程内(不查墙,只做粗筛) */
function inLineWithin(board: Board, cell: number, targets: readonly number[], power: number): boolean {
  const x = xOf(board, cell);
  const y = yOf(board, cell);
  for (const t of targets) {
    const tx = xOf(board, t);
    const ty = yOf(board, t);
    if (x === tx && Math.abs(y - ty) <= power) return true;
    if (y === ty && Math.abs(x - tx) <= power) return true;
  }
  return false;
}

/**
 * 找一个「站上去能打到目标、放完自己还跑得掉」的落脚点,返回走过去的第一步。
 *
 * 这是 1.2 补上的那块拼图:老版本只会在脚下试一次,试不过就傻站着,
 * 泡泡缩到 2 秒以后这种站桩会直接卡死一整关。轻松档不做这件事(它本来就笨手笨脚)。
 */
function safeBombSpot(
  world: World,
  me: Fighter,
  avoid: ReadonlySet<number>,
  want: (cell: number) => boolean,
  tune: AiTuning,
  timing: Map<number, number>
): Quest | null {
  if (!tune.reposition) return null;
  let tries = 0;
  return seek(
    world,
    me.pos,
    (cell) => {
      if (avoid.has(cell) || !want(cell)) return false;
      if (tries++ >= SPOT_TRIES) return false;
      return canEscapeFrom(world, me, cell, timing);
    },
    { stepMs: stepMsFor(me.speed), ghost: me.ghost, avoid, maxNodes: 240 }
  );
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
