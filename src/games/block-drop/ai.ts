/**
 * 方块叠叠乐 · 本机 AI(四档)与关卡可解性求解器。
 * 对战里的「对手」全是这里算出来的,离线运行,不连任何网络。
 *
 * 为了跑得快,评估落点时直接在原场地上落 4 格、算完再撤掉,
 * 不复制整块场地 —— 所有函数对外仍然是纯的(进出都不改传进来的 board)。
 */
import {
  COLS,
  ROWS,
  addGarbage,
  clearLines,
  cloneBoard,
  collides,
  dropPosition,
  lockPiece,
  maxHeight,
  type Board
} from "./board";
import { PIECE_IDS, PieceQueue, cellsFor, rng, spawnX, type Cell, type PieceId, type Rot } from "./pieces";
import { tryRotate } from "./srs";
import { cancelGarbage, detectTSpin, garbageFor, isB2BMove, type TSpinKind } from "./score";

export type AiTier = "rookie" | "normal" | "pro" | "hell";

export const AI_TIERS: AiTier[] = ["rookie", "normal", "pro", "hell"];

export const AI_TIER_LABELS: Record<AiTier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  pro: "高手",
  hell: "地狱"
};

export function tierBlurb(tier: AiTier): string {
  switch (tier) {
    case "rookie":
      return "菜鸟:随便找个地方就放,偶尔碰巧消一行。";
    case "normal":
      return "普通:会挑洞最少的位置放。";
    case "pro":
      return "高手:会算高度、洞、井深和平整度,还会留一口井等长条。";
    default:
      return "地狱:会连着看两个块再决定,还会盯着你发过来的垃圾行想抵消。";
  }
}

export interface Placement {
  rot: Rot;
  x: number;
  y: number;
  cells: Cell[];
  /** 落地之后又转了一下才定位(小凸转身要靠这个) */
  spun: boolean;
  /** 那次旋转用的是第几组踢墙偏移 */
  kickIndex: number;
}

/**
 * 列出这个块所有能落到的位置。
 * 除了「转好再直落」,还包括「落到底之后再转一下」——
 * 小凸转身只能这么塞进去。
 */
/** 落点必须整块都在场地数组里,顶出缓冲区的位置不算能放 */
function inside(cells: readonly Cell[], y: number): boolean {
  for (const c of cells) if (c.y + y < 0) return false;
  return true;
}

export function enumeratePlacements(board: Board, id: PieceId): Placement[] {
  const cols = board[0]?.length ?? COLS;
  const out: Placement[] = [];
  const seen = new Set<string>();
  const rots: Rot[] = id === "O" ? [0] : id === "I" || id === "S" || id === "Z" ? [0, 1] : [0, 1, 2, 3];

  for (const rot of rots) {
    const cells = cellsFor(id, rot);
    for (let x = -3; x < cols + 3; x++) {
      if (collides(board, cells, x, 0) && collides(board, cells, x, -2)) continue;
      let y = -2;
      while (collides(board, cells, x, y) && y < ROWS) y += 1;
      if (y >= ROWS) continue;
      const landY = dropPosition(board, cells, x, y);
      const key = `${rot}:${x}:${landY}`;
      if (!seen.has(key) && inside(cells, landY)) {
        seen.add(key);
        out.push({ rot, x, y: landY, cells, spun: false, kickIndex: 0 });
      }
      // 落到底之后再转一下:能转进去就是一个新的落点(小方块转了也一样,不重复列)
      if (id === "O") continue;
      for (const dir of [1, -1] as const) {
        const r = tryRotate(id, rot, x, landY, dir, (cs, cx, cy) => collides(board, cs, cx, cy));
        if (!r) continue;
        const finalY = dropPosition(board, cellsFor(id, r.rot), r.x, r.y);
        const k2 = `${r.rot}:${r.x}:${finalY}`;
        if (seen.has(k2) || !inside(cellsFor(id, r.rot), finalY)) continue;
        seen.add(k2);
        out.push({
          rot: r.rot,
          x: r.x,
          y: finalY,
          cells: cellsFor(id, r.rot),
          spun: true,
          kickIndex: r.kickIndex
        });
      }
    }
  }
  return out;
}

export interface Metrics {
  /** 所有列的高度之和 */
  height: number;
  /** 最高的一列 */
  peak: number;
  /** 被压住的空格 */
  holes: number;
  /** 相邻列高度差之和 */
  bump: number;
  /** 最深的一口井 */
  deepWell: number;
  /** 这一手消了几行 */
  lines: number;
}

/** 算一块场地的形态指标,skip 里的行当作已经消掉了 */
function metricsOf(board: Board, skip: readonly number[]): Metrics {
  const rows = board.length;
  const cols = board[0]?.length ?? COLS;
  const skipped = skip.length > 0 ? new Set(skip) : null;
  const heights = new Array<number>(cols).fill(0);
  let holes = 0;
  for (let c = 0; c < cols; c++) {
    let depth = 0;
    let seen = false;
    for (let r = 0; r < rows; r++) {
      if (skipped?.has(r)) continue;
      depth += 1;
      const filled = board[r][c] !== 0;
      if (filled && !seen) {
        seen = true;
        heights[c] = rows - skip.length - (depth - 1);
      } else if (!filled && seen) {
        holes += 1;
      }
    }
  }
  let height = 0;
  let peak = 0;
  let bump = 0;
  let deepWell = 0;
  for (let c = 0; c < cols; c++) {
    height += heights[c];
    peak = Math.max(peak, heights[c]);
    if (c > 0) bump += Math.abs(heights[c] - heights[c - 1]);
    const left = c === 0 ? Number.POSITIVE_INFINITY : heights[c - 1];
    const right = c === cols - 1 ? Number.POSITIVE_INFINITY : heights[c + 1];
    const side = Math.min(left, right);
    if (Number.isFinite(side)) deepWell = Math.max(deepWell, side - heights[c]);
    else deepWell = Math.max(deepWell, (c === 0 ? heights[1] ?? 0 : heights[cols - 2] ?? 0) - heights[c]);
  }
  return { height, peak, holes, bump, deepWell, lines: skip.length };
}

/**
 * 把一个落点放上去,算完形态指标再撤掉。
 * board 进出保持原样。
 */
export function measure(board: Board, p: Placement): Metrics {
  const rows = board.length;
  const cols = board[0]?.length ?? COLS;
  const touched: { r: number; c: number }[] = [];
  for (const c of p.cells) {
    const cx = c.x + p.x;
    const cy = c.y + p.y;
    if (cy < 0 || cy >= rows || cx < 0 || cx >= cols) continue;
    if (board[cy][cx] === 0) {
      board[cy][cx] = 1;
      touched.push({ r: cy, c: cx });
    }
  }
  const full: number[] = [];
  const rowsToCheck = new Set(touched.map((t) => t.r));
  for (const r of rowsToCheck) {
    let ok = true;
    for (let c = 0; c < cols; c++) {
      if (board[r][c] === 0) {
        ok = false;
        break;
      }
    }
    if (ok) full.push(r);
  }
  const m = metricsOf(board, full);
  for (const t of touched) board[t.r][t.c] = 0;
  return m;
}

export interface Weights {
  height: number;
  holes: number;
  bump: number;
  lines: number;
  peak: number;
  /** 留一口井等长条的意愿 */
  well: number;
}

export const WEIGHTS: Record<AiTier, Weights> = {
  rookie: { height: 0, holes: -0.4, bump: 0, lines: 0.4, peak: 0, well: 0 },
  // 普通档就是最朴素的贪心:只盯着「别多出洞」,不管高度也不管平不平
  normal: { height: 0, holes: -2.6, bump: 0, lines: 0.5, peak: 0, well: 0 },
  pro: { height: -0.51, holes: -3.6, bump: -0.28, lines: 0.9, peak: -0.4, well: 0.35 },
  hell: { height: -0.51, holes: -6, bump: -0.4, lines: 0.85, peak: -0.6, well: 0.5 }
};

/** 一个落点值不值 */
export function scorePlacement(m: Metrics, w: Weights): number {
  // 留井:井深到 4 就够插一根长条了,再深没意义
  const wellBonus = w.well * Math.min(4, m.deepWell) * (m.lines === 0 ? 1 : 0);
  return w.height * m.height + w.holes * m.holes + w.bump * m.bump + w.lines * m.lines * m.lines + w.peak * m.peak + wellBonus;
}

/** 把一个落点真的钉进场地,返回新场地和消了几行 */
export function applyPlacement(board: Board, p: Placement, color = 1): { board: Board; lines: number } {
  const locked = lockPiece(board, p.cells, p.x, p.y, color);
  const cleared = clearLines(locked);
  return { board: cleared.board, lines: cleared.count };
}

export interface ChooseOpts {
  /** 下一个块,地狱档会连着一起算 */
  next?: PieceId | null;
  /** 待落到自己头上的垃圾行,地狱档会想着抵消 */
  incoming?: number;
  rand?: () => number;
}

/**
 * 挑一个落点。菜鸟基本靠蒙,地狱档会把下一个块也算进去。
 */
export function choosePlacement(board: Board, id: PieceId, tier: AiTier, opts: ChooseOpts = {}): Placement | null {
  const list = enumeratePlacements(board, id);
  if (list.length === 0) return null;
  const rand = opts.rand ?? Math.random;
  const w = WEIGHTS[tier];

  if (tier === "rookie") {
    // 随便放,只是稍微偏好能消行的地方
    const pool = list.filter(() => rand() < 0.75);
    const pick = (pool.length > 0 ? pool : list)[Math.floor(rand() * (pool.length > 0 ? pool.length : list.length)) % (pool.length > 0 ? pool.length : list.length)];
    return pick ?? list[0];
  }

  const scored = list
    .map((p) => ({ p, m: measure(board, p), s: 0 }))
    .map((e) => ({ ...e, s: scorePlacement(e.m, w) }));

  if (tier === "hell" && opts.next) {
    // 只对一层里最好的几个再往下看一步,免得算爆
    scored.sort((a, b) => b.s - a.s);
    const top = scored.slice(0, 8);
    let best = top[0];
    let bestTotal = -Infinity;
    for (const e of top) {
      const after = applyPlacement(board, e.p).board;
      const follow = enumeratePlacements(after, opts.next);
      let bestNext = -Infinity;
      for (const q of follow) {
        const s2 = scorePlacement(measure(after, q), w);
        if (s2 > bestNext) bestNext = s2;
      }
      // 有垃圾在头上就更看重这一手能不能消行(消行才抵消得掉)
      const urgent = (opts.incoming ?? 0) > 0 ? e.m.lines * 1.6 : 0;
      const total = e.s + (Number.isFinite(bestNext) ? bestNext * 0.85 : 0) + urgent;
      if (total > bestTotal) {
        bestTotal = total;
        best = e;
      }
    }
    return best?.p ?? list[0];
  }

  let best = scored[0];
  for (const e of scored) if (e.s > best.s) best = e;
  return best.p;
}

// ---------------------------------------------------------------------------
// 关卡可解性:用高手档的搜索去真的把每一关走一遍
// ---------------------------------------------------------------------------

export interface SolveGoal {
  /** 要消掉几行 */
  lines: number;
  /** 最多用几个块 */
  pieces: number;
}

export interface SolveResult {
  ok: boolean;
  /** 实际消了几行 */
  lines: number;
  /** 实际用了几个块 */
  used: number;
  /** 中途叠到顶了没有 */
  toppedOut: boolean;
  /** 一路打出过的小凸转身次数 */
  tspins: number;
  /** 一次消四行的次数 */
  quads: number;
  /** 最长连击 */
  bestCombo: number;
}

/**
 * 拿高手档的评估把一关走完,用来断言「这一关有解」。
 * 同一个 seed 每次跑出来的过程完全一样。
 */
export function solveLevel(
  start: Board,
  seed: number,
  goal: SolveGoal,
  tier: AiTier = "hell",
  bag: readonly PieceId[] = PIECE_IDS
): SolveResult {
  let board = cloneBoard(start);
  const queue = new PieceQueue(rng(seed), bag);
  let lines = 0;
  let used = 0;
  let tspins = 0;
  let quads = 0;
  let combo = 0;
  let bestCombo = 0;
  const budget = Math.max(1, Math.round(goal.pieces));

  while (used < budget && lines < goal.lines) {
    const id = queue.take();
    const next = queue.peek(1)[0] ?? null;
    if (collides(board, cellsFor(id, 0), spawnX(id, board[0].length), 0)) {
      return { ok: false, lines, used, toppedOut: true, tspins, quads, bestCombo };
    }
    const pick = choosePlacement(board, id, tier, { next });
    if (!pick) return { ok: false, lines, used, toppedOut: true, tspins, quads, bestCombo };
    const spin: TSpinKind = pick.spun
      ? detectTSpin(board, id, pick.rot, pick.x, pick.y, true, pick.kickIndex)
      : "none";
    const out = applyPlacement(board, pick);
    board = out.board;
    used += 1;
    lines += out.lines;
    if (out.lines > 0) {
      combo += 1;
      bestCombo = Math.max(bestCombo, combo);
      if (out.lines >= 4) quads += 1;
      if (spin !== "none") tspins += 1;
    } else {
      combo = 0;
    }
  }

  return { ok: lines >= goal.lines, lines, used, toppedOut: false, tspins, quads, bestCombo };
}

/** 这块场地上现在能不能立刻打出一次小凸转身 */
export function tspinAvailable(board: Board): boolean {
  for (const p of enumeratePlacements(board, "T")) {
    if (!p.spun) continue;
    if (detectTSpin(board, "T", p.rot, p.x, p.y, true, p.kickIndex) !== "none") return true;
  }
  return false;
}

/** 这块场地上现在能不能立刻消掉四行 */
export function quadAvailable(board: Board): boolean {
  for (const id of ["I"] as PieceId[]) {
    for (const p of enumeratePlacements(board, id)) {
      if (measure(board, p).lines >= 4) return true;
    }
  }
  return false;
}

/** 这块场地上现在有没有非踢墙塞不进去的缝 */
export function kickNeeded(board: Board): boolean {
  for (const id of ["T", "J", "L", "I", "S", "Z"] as PieceId[]) {
    for (const p of enumeratePlacements(board, id)) {
      if (p.spun && p.kickIndex > 0 && measure(board, p).lines > 0) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 对战模拟:用来断言「档位越高越强」
// ---------------------------------------------------------------------------

interface DuelSide {
  board: Board;
  queue: PieceQueue;
  tier: AiTier;
  incoming: number;
  linesSent: number;
  linesCleared: number;
  alive: boolean;
  b2b: boolean;
  combo: number;
}

export interface DuelResult {
  winner: "a" | "b" | "draw";
  sentA: number;
  sentB: number;
  pieces: number;
}

function makeSide(tier: AiTier, seed: number): DuelSide {
  return {
    board: cloneBoard(Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0))),
    queue: new PieceQueue(rng(seed)),
    tier,
    incoming: 0,
    linesSent: 0,
    linesCleared: 0,
    alive: true,
    b2b: false,
    combo: 0
  };
}

/**
 * 两档 AI 对战一局:互相发垃圾行,谁先叠到顶谁这局结束。
 * 全程纯计算,同一个 seed 结果完全一样。
 */
export function simulateVersus(tierA: AiTier, tierB: AiTier, seed: number, maxPieces = 90): DuelResult {
  const s0 = Math.round(seed) || 1;
  const a = makeSide(tierA, s0 * 2 + 1);
  const b = makeSide(tierB, s0 * 2 + 2);
  const holeRand = rng(s0);
  let pieces = 0;

  for (; pieces < maxPieces; pieces++) {
    const pendingA: number[] = [];
    const pendingB: number[] = [];
    for (const [me, foe, pending] of [
      [a, b, pendingB],
      [b, a, pendingA]
    ] as [DuelSide, DuelSide, number[]][]) {
      if (!me.alive) continue;
      // 上一轮别人发过来的垃圾先落到自己场地上
      if (me.incoming > 0) {
        me.board = addGarbage(me.board, me.incoming, Math.floor(holeRand() * COLS) % COLS);
        me.incoming = 0;
      }
      const id = me.queue.take();
      const next = me.queue.peek(1)[0] ?? null;
      if (collides(me.board, cellsFor(id, 0), spawnX(id, COLS), 0)) {
        me.alive = false;
        continue;
      }
      const pick = choosePlacement(me.board, id, me.tier, { next, incoming: me.incoming, rand: holeRand });
      if (!pick) {
        me.alive = false;
        continue;
      }
      const spin: TSpinKind = pick.spun ? detectTSpin(me.board, id, pick.rot, pick.x, pick.y, true, pick.kickIndex) : "none";
      const out = applyPlacement(me.board, pick);
      me.board = out.board;
      me.linesCleared += out.lines;
      if (out.lines > 0) {
        const send = garbageFor(out.lines, spin, me.b2b);
        me.b2b = isB2BMove(out.lines, spin);
        me.combo += 1;
        const cancel = cancelGarbage(me.incoming, send + Math.max(0, me.combo - 2));
        me.incoming = cancel.incoming;
        if (cancel.outgoing > 0) {
          me.linesSent += cancel.outgoing;
          pending.push(cancel.outgoing);
        }
      } else {
        me.combo = 0;
      }
      if (maxHeight(me.board) >= ROWS) me.alive = false;
      void foe;
    }
    for (const n of pendingA) a.incoming += n;
    for (const n of pendingB) b.incoming += n;
    if (!a.alive || !b.alive) break;
  }

  let winner: DuelResult["winner"];
  if (a.alive && !b.alive) winner = "a";
  else if (b.alive && !a.alive) winner = "b";
  else if (a.linesSent > b.linesSent) winner = "a";
  else if (b.linesSent > a.linesSent) winner = "b";
  else winner = "draw";
  return { winner, sentA: a.linesSent, sentB: b.linesSent, pieces };
}

/** 跑 games 局,每隔一局换边,统计各自赢几场 */
export function duelWins(
  tierA: AiTier,
  tierB: AiTier,
  games = 10,
  seed0 = 20240612
): { a: number; b: number; draw: number } {
  let a = 0;
  let b = 0;
  let draw = 0;
  for (let i = 0; i < games; i++) {
    const swap = i % 2 === 1;
    const r = simulateVersus(swap ? tierB : tierA, swap ? tierA : tierB, seed0 + i * 7919);
    const winA = swap ? r.winner === "b" : r.winner === "a";
    const winB = swap ? r.winner === "a" : r.winner === "b";
    if (winA) a++;
    else if (winB) b++;
    else draw++;
  }
  return { a, b, draw };
}
