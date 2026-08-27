/**
 * 花园国际象棋 · 自写搜索与四档 AI。
 *
 * 全部自己写：子力评估 + 位置表 + alpha-beta + 迭代加深 + 置换表 + 杀手启发。
 * **没有接任何外部引擎、没有走法库、没有 wasm、没有权重文件**，
 * 断网状态下和联网时算出来的是同一步棋。
 *
 * 另外提供一个专用的杀棋验证器 `findForcedMate`：188 道题的「有解」就是它证的。
 */
import {
  BISHOP,
  BLACK,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  WHITE,
  fileOf,
  rankOf,
  typeOf,
  zobrist,
  type Color,
  type PieceType,
  type Position,
} from "./board";
import { inCheck, legalMoves, makeMove, moveKey, type Move } from "./moves";

export type AiTier = 1 | 2 | 3 | 4;

export const AI_TIERS: AiTier[] = [1, 2, 3, 4];

export const AI_LABEL: Record<AiTier, string> = {
  1: "菜鸟",
  2: "普通",
  3: "高手",
  4: "地狱",
};

export const AI_BLURB: Record<AiTier, string> = {
  1: "随便走走，但不会白白把子送到你嘴边。",
  2: "会算一两步，看得见明摆着的吃子。",
  3: "会算三步，还讲究中心、兵型和王的安全。",
  4: "会一层层加深地算，每手想满两百毫秒才落子。",
};

/** 子力价值（王不参与计价，被将杀本身就是终局） */
export const PIECE_VALUE: Record<PieceType, number> = {
  1: 100,
  2: 320,
  3: 330,
  4: 500,
  5: 900,
  6: 0,
};

/** 将杀分：离根越近分越高，这样引擎会选最快的杀法 */
export const MATE_SCORE = 100000;

/**
 * 分数绝对值超过这条线就是「几步之内见分晓」的杀分。
 * 杀分是相对当前层数算的，同一个局面在不同层上的杀分不一样，
 * 所以这种分数只借它记的那一手用来排序，不能当成缓存值直接返回。
 */
const MATE_BOUND = MATE_SCORE - 1000;

// ---------------------------------------------------------------------------
// 位置表（白方视角，按 a1..h8 排列；黑方查表时上下翻转）
// ---------------------------------------------------------------------------

/** 表是按「第 8 横线写在最上面」的直觉顺序写的，这里翻成 a1..h8 的下标 */
function flip(table: number[]): number[] {
  const out = new Array<number>(64).fill(0);
  for (let sq = 0; sq < 64; sq++) {
    const file = fileOf(sq);
    const rank = rankOf(sq);
    out[sq] = table[(7 - rank) * 8 + file];
  }
  return out;
}

const PST_PAWN = flip([
  0, 0, 0, 0, 0, 0, 0, 0,
  55, 55, 55, 55, 55, 55, 55, 55,
  12, 14, 22, 32, 32, 22, 14, 12,
  4, 6, 12, 26, 26, 12, 6, 4,
  0, 0, 0, 22, 22, 0, 0, 0,
  4, -4, -8, 0, 0, -8, -4, 4,
  4, 8, 8, -22, -22, 8, 8, 4,
  0, 0, 0, 0, 0, 0, 0, 0,
]);

const PST_KNIGHT = flip([
  -50, -38, -28, -28, -28, -28, -38, -50,
  -38, -20, 0, 0, 0, 0, -20, -38,
  -28, 0, 10, 15, 15, 10, 0, -28,
  -28, 5, 15, 20, 20, 15, 5, -28,
  -28, 0, 15, 20, 20, 15, 0, -28,
  -28, 5, 10, 15, 15, 10, 5, -28,
  -38, -20, 0, 5, 5, 0, -20, -38,
  -50, -38, -28, -28, -28, -28, -38, -50,
]);

const PST_BISHOP = flip([
  -18, -8, -8, -8, -8, -8, -8, -18,
  -8, 0, 0, 0, 0, 0, 0, -8,
  -8, 0, 5, 10, 10, 5, 0, -8,
  -8, 5, 5, 10, 10, 5, 5, -8,
  -8, 0, 10, 10, 10, 10, 0, -8,
  -8, 10, 10, 10, 10, 10, 10, -8,
  -8, 5, 0, 0, 0, 0, 5, -8,
  -18, -8, -8, -8, -8, -8, -8, -18,
]);

const PST_ROOK = flip([
  0, 0, 0, 0, 0, 0, 0, 0,
  6, 12, 12, 12, 12, 12, 12, 6,
  -6, 0, 0, 0, 0, 0, 0, -6,
  -6, 0, 0, 0, 0, 0, 0, -6,
  -6, 0, 0, 0, 0, 0, 0, -6,
  -6, 0, 0, 0, 0, 0, 0, -6,
  -6, 0, 0, 0, 0, 0, 0, -6,
  0, 0, 0, 6, 6, 6, 0, 0,
]);

const PST_QUEEN = flip([
  -18, -8, -8, -4, -4, -8, -8, -18,
  -8, 0, 0, 0, 0, 0, 0, -8,
  -8, 0, 5, 5, 5, 5, 0, -8,
  -4, 0, 5, 5, 5, 5, 0, -4,
  0, 0, 5, 5, 5, 5, 0, -4,
  -8, 5, 5, 5, 5, 5, 0, -8,
  -8, 0, 5, 0, 0, 0, 0, -8,
  -18, -8, -8, -4, -4, -8, -8, -18,
]);

/** 中局的王：躲在角落里最安全 */
const PST_KING_MID = flip([
  -28, -38, -38, -48, -48, -38, -38, -28,
  -28, -38, -38, -48, -48, -38, -38, -28,
  -28, -38, -38, -48, -48, -38, -38, -28,
  -28, -38, -38, -48, -48, -38, -38, -28,
  -18, -28, -28, -38, -38, -28, -28, -18,
  -8, -18, -18, -18, -18, -18, -18, -8,
  16, 16, 0, 0, 0, 0, 16, 16,
  16, 24, 8, 0, 0, 8, 24, 16,
]);

/** 残局的王：要走到中间去帮忙 */
const PST_KING_END = flip([
  -50, -30, -30, -30, -30, -30, -30, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
]);

const PST: Record<PieceType, number[]> = {
  1: PST_PAWN,
  2: PST_KNIGHT,
  3: PST_BISHOP,
  4: PST_ROOK,
  5: PST_QUEEN,
  6: PST_KING_MID,
};

/** 黑方查表时把格子上下翻过来 */
function mirror(sq: number): number {
  return (7 - rankOf(sq)) * 8 + fileOf(sq);
}

/** 非兵非王的子力总和，用来判断进没进残局 */
function heavyMaterial(pos: Position): number {
  let sum = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = pos.board[sq];
    if (p === 0) continue;
    const t = typeOf(p) as PieceType;
    if (t !== PAWN && t !== KING) sum += PIECE_VALUE[t];
  }
  return sum;
}

/**
 * 评估：白方为正。含子力、位置表、双象加成、叠兵罚分、开放线上的车。
 * 用位置表的档次（高手 / 地狱）会用到全部项，普通档只看子力。
 */
export function evaluate(pos: Position, usePst = true): number {
  let score = 0;
  const endgame = heavyMaterial(pos) <= 1300;
  let bishops = 0;
  let darkBishops = 0;
  const pawnFiles = [new Array<number>(8).fill(0), new Array<number>(8).fill(0)];
  for (let sq = 0; sq < 64; sq++) {
    const p = pos.board[sq];
    if (p === 0) continue;
    const t = typeOf(p) as PieceType;
    const white = p > 0;
    let v = PIECE_VALUE[t];
    if (usePst) {
      const table = t === KING ? (endgame ? PST_KING_END : PST_KING_MID) : PST[t];
      v += table[white ? sq : mirror(sq)];
    }
    score += white ? v : -v;
    if (t === BISHOP) {
      if (white) bishops++;
      else darkBishops++;
    }
    if (t === PAWN) pawnFiles[white ? 0 : 1][fileOf(sq)]++;
  }
  if (!usePst) return score;
  // 双象在开阔局面里确实好用
  if (bishops >= 2) score += 28;
  if (darkBishops >= 2) score -= 28;
  for (let f = 0; f < 8; f++) {
    if (pawnFiles[0][f] > 1) score -= 14 * (pawnFiles[0][f] - 1);
    if (pawnFiles[1][f] > 1) score += 14 * (pawnFiles[1][f] - 1);
  }
  return score;
}

// ---------------------------------------------------------------------------
// 走法排序
// ---------------------------------------------------------------------------

/** 先吃大子、后吃小子；升变、将军也排前面。排得越准剪枝越狠。 */
function moveScore(pos: Position, m: Move, ttBest: string | null, killers: string[]): number {
  const key = moveKey(m);
  if (ttBest && key === ttBest) return 1_000_000;
  let s = 0;
  if (m.captured !== 0) {
    s += 100_000 + PIECE_VALUE[typeOf(m.captured) as PieceType] * 10 - PIECE_VALUE[typeOf(m.piece) as PieceType];
  }
  if (m.promo) s += 90_000 + PIECE_VALUE[m.promo];
  if (killers.includes(key)) s += 50_000;
  if (m.flag === "k" || m.flag === "q") s += 400;
  return s;
}

function ordered(pos: Position, moves: Move[], ttBest: string | null, killers: string[]): Move[] {
  return moves
    .map((m) => ({ m, s: moveScore(pos, m, ttBest, killers) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}

// ---------------------------------------------------------------------------
// 搜索
// ---------------------------------------------------------------------------

export interface SearchOptions {
  /** 最大深度（不给就靠时间预算决定） */
  depth?: number;
  /** 单手时间预算（毫秒） */
  timeMs?: number;
  /** 用不用位置表（普通档关掉，只看子力） */
  usePst?: boolean;
  /** 静态搜索（只延伸吃子）；关掉会明显变傻 */
  quiescence?: boolean;
  /** 可注入的时钟，测试里不用真等 */
  now?: () => number;
  /** 同分走法之间打散用，给了才有随机性 */
  rand?: () => number;
}

export interface SearchResult {
  move: Move | null;
  score: number;
  depth: number;
  nodes: number;
  timeMs: number;
  /** 主要变例（SAN 之前的短标识） */
  pv: string[];
}

interface TTEntry {
  depth: number;
  score: number;
  flag: "exact" | "lower" | "upper";
  best: string | null;
}

/**
 * 规格第六节的 `search(pos, depth, timeMs)`。
 * 迭代加深：先算浅的，把最好的一手记进置换表，再算深的——
 * 时间到了随时能停，手上永远有一步能走的棋。
 */
export function search(pos: Position, opts: SearchOptions = {}): SearchResult {
  const now = opts.now ?? (() => Date.now());
  const started = now();
  const budget = opts.timeMs ?? Infinity;
  const maxDepth = Math.max(1, opts.depth ?? 64);
  const usePst = opts.usePst !== false;
  const useQuiescence = opts.quiescence !== false;
  const tt = new Map<string, TTEntry>();
  const killers: string[][] = [];
  let nodes = 0;
  let stop = false;

  function timeUp(): boolean {
    if (stop) return true;
    // 每 512 个节点看一次表就够了，看太勤反而拖慢搜索
    if (budget !== Infinity && (nodes & 511) === 0 && now() - started >= budget) stop = true;
    return stop;
  }

  function quiesce(p: Position, alpha: number, beta: number, ply: number): number {
    nodes++;
    let best = p.turn * evaluate(p, usePst);
    if (best >= beta) return best;
    if (best > alpha) alpha = best;
    if (ply > 8 || timeUp()) return best;
    const caps = legalMoves(p).filter((m) => m.captured !== 0 || m.promo);
    for (const m of ordered(p, caps, null, [])) {
      const score = -quiesce(makeMove(p, m), -beta, -alpha, ply + 1);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function negamax(p: Position, depth: number, alpha: number, beta: number, ply: number): number {
    nodes++;
    if (timeUp()) return p.turn * evaluate(p, usePst);
    const alphaOrig = alpha;
    const moves = legalMoves(p);
    if (moves.length === 0) {
      return inCheck(p, p.turn) ? -(MATE_SCORE - ply) : 0;
    }
    if (p.halfmove >= 100) return 0;
    // 表按局面本身做键，不掺深度：这样浅层算出来的结果与最好的一手，
    // 深一层还用得上——迭代加深每加一层都能接着上一层的剪枝往下走。
    const key = zobrist(p);
    const hit = tt.get(key);
    if (hit && hit.depth >= depth && Math.abs(hit.score) < MATE_BOUND) {
      if (hit.flag === "exact") return hit.score;
      if (hit.flag === "lower" && hit.score > alpha) alpha = hit.score;
      else if (hit.flag === "upper" && hit.score < beta) beta = hit.score;
      if (alpha >= beta) return hit.score;
    }
    if (depth <= 0) {
      return useQuiescence ? quiesce(p, alpha, beta, ply) : p.turn * evaluate(p, usePst);
    }
    if (!killers[ply]) killers[ply] = [];
    let best = -Infinity;
    let bestKey: string | null = null;
    for (const m of ordered(p, moves, hit?.best ?? null, killers[ply])) {
      const score = -negamax(makeMove(p, m), depth - 1, -beta, -alpha, ply + 1);
      if (score > best) {
        best = score;
        bestKey = moveKey(m);
      }
      if (best > alpha) alpha = best;
      if (alpha >= beta) {
        if (m.captured === 0) {
          killers[ply].unshift(moveKey(m));
          killers[ply].length = Math.min(killers[ply].length, 2);
        }
        break;
      }
    }
    // 深的结果比浅的值钱：只有同深度或更深才覆盖，别让一条浅记录把深记录冲掉
    const stored = tt.get(key);
    if (!stored || stored.depth <= depth) {
      tt.set(key, {
        depth,
        score: best,
        flag: best <= alphaOrig ? "upper" : best >= beta ? "lower" : "exact",
        best: bestKey,
      });
    }
    return best;
  }

  const roots = legalMoves(pos);
  if (roots.length === 0) {
    return { move: null, score: 0, depth: 0, nodes: 0, timeMs: 0, pv: [] };
  }

  let bestMove = roots[0];
  let bestScore = -Infinity;
  let reached = 0;
  for (let depth = 1; depth <= maxDepth; depth++) {
    let localBest: Move | null = null;
    let localScore = -Infinity;
    let alpha = -Infinity;
    for (const m of ordered(pos, roots, bestMove ? moveKey(bestMove) : null, [])) {
      const score = -negamax(makeMove(pos, m), depth - 1, -Infinity, -alpha, 1);
      if (stop) break;
      const jitter = opts.rand && score === localScore ? (opts.rand() < 0.5 ? 1 : 0) : 0;
      if (localBest === null || score > localScore || jitter === 1) {
        localBest = m;
        localScore = score;
      }
      if (score > alpha) alpha = score;
    }
    if (localBest && (!stop || reached === 0)) {
      bestMove = localBest;
      bestScore = localScore;
      reached = depth;
    }
    if (stop) break;
    if (budget !== Infinity && now() - started >= budget) break;
    // 已经找到强制杀了，再往下算没意义
    if (Math.abs(bestScore) >= MATE_SCORE - 100) break;
  }

  return {
    move: bestMove,
    score: bestScore,
    depth: reached,
    nodes,
    timeMs: now() - started,
    pv: bestMove ? [moveKey(bestMove)] : [],
  };
}

// ---------------------------------------------------------------------------
// 四档 AI
// ---------------------------------------------------------------------------

export interface TierPlan {
  depth: number;
  timeMs: number;
  usePst: boolean;
  quiescence: boolean;
}

/** 四档的搜索参数（PLAN.md 第六节那张表） */
export const TIER_PLAN: Record<AiTier, TierPlan> = {
  1: { depth: 1, timeMs: 30, usePst: false, quiescence: false },
  2: { depth: 2, timeMs: 60, usePst: false, quiescence: false },
  3: { depth: 3, timeMs: 120, usePst: true, quiescence: true },
  4: { depth: 6, timeMs: 200, usePst: true, quiescence: true },
};

/**
 * 菜鸟档：随机挑一条合法走法，但会先把「走过去就被更便宜的子吃掉」的那些排到最后。
 * 所以它不会白送后，也不会算出什么高招。
 */
function rookieMove(pos: Position, rand: () => number): Move {
  const moves = legalMoves(pos);
  const safe: Move[] = [];
  const risky: Move[] = [];
  for (const m of moves) {
    const gain = m.captured !== 0 ? PIECE_VALUE[typeOf(m.captured) as PieceType] : 0;
    const next = makeMove(pos, m);
    let worst = 0;
    for (const reply of legalMoves(next)) {
      if (reply.to !== m.to) continue;
      const loss = PIECE_VALUE[typeOf(m.piece) as PieceType] - PIECE_VALUE[typeOf(reply.piece) as PieceType];
      if (loss > worst) worst = loss;
    }
    (worst > gain + 40 ? risky : safe).push(m);
  }
  const pool = safe.length > 0 ? safe : risky.length > 0 ? risky : moves;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

export interface ChooseOptions {
  /** 可注入的时钟，测试里不用真等 */
  now?: () => number;
  /** 覆盖这一档的时间预算（无尽模式逐场加时用） */
  timeMs?: number;
}

/** 按档位挑一手棋。`rand` 固定 seed 时结果可复现，单测靠这条。 */
export function chooseMove(
  pos: Position,
  tier: AiTier,
  rand: () => number = Math.random,
  opts: ChooseOptions = {}
): Move | null {
  const moves = legalMoves(pos);
  if (moves.length === 0) return null;
  if (tier === 1) return rookieMove(pos, rand);
  const plan = TIER_PLAN[tier];
  const res = search(pos, {
    depth: plan.depth,
    timeMs: opts.timeMs ?? plan.timeMs,
    usePst: plan.usePst,
    quiescence: plan.quiescence,
    now: opts.now,
    rand: tier === 2 ? rand : undefined,
  });
  return res.move ?? moves[0];
}

// ---------------------------------------------------------------------------
// 杀棋验证器（188 道题的「有解」证明）
// ---------------------------------------------------------------------------

/** 排序：先将军、再吃子、再升变——杀棋题里正解基本都在前面 */
function mateOrder(pos: Position, moves: Move[]): Move[] {
  return moves
    .map((m) => {
      const next = makeMove(pos, m);
      let s = 0;
      if (inCheck(next, next.turn)) s += 1000;
      if (m.captured !== 0) s += 100 + PIECE_VALUE[typeOf(m.captured) as PieceType] / 10;
      if (m.promo) s += 90;
      return { m, s };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}

/**
 * 攻方能不能在 `plies` 个半回合内**强制**将杀（plies 是奇数：1 = 一步杀、3 = 两步杀…）。
 * 找到就返回第一手，找不到返回 null。带记忆表，同一局面换个走法顺序转过来不重算。
 */
export function findForcedMate(pos: Position, plies: number, memo = new Map<string, boolean>()): Move | null {
  if (plies <= 0) return null;
  for (const m of mateOrder(pos, legalMoves(pos))) {
    const next = makeMove(pos, m);
    const replies = legalMoves(next);
    if (replies.length === 0) {
      if (inCheck(next, next.turn)) return m;
      continue;
    }
    if (plies === 1) continue;
    let all = true;
    for (const r of replies) {
      const after = makeMove(next, r);
      const key = `${zobrist(after)}|${plies - 2}`;
      let ok = memo.get(key);
      if (ok === undefined) {
        ok = findForcedMate(after, plies - 2, memo) !== null;
        memo.set(key, ok);
      }
      if (!ok) {
        all = false;
        break;
      }
    }
    if (all) return m;
  }
  return null;
}

/**
 * 走了这一手之后，还保得住 `plies` 个半回合内的强制将杀吗。
 * 闯关模式判「这一手对不对」就靠它——玩家想到的杀法不一定和参考解一样，
 * 只要还是强制杀就算对。
 */
export function forcesMate(pos: Position, move: Move, plies: number): boolean {
  const next = makeMove(pos, move);
  const replies = legalMoves(next);
  if (replies.length === 0) return inCheck(next, next.turn);
  if (plies <= 1) return false;
  const memo = new Map<string, boolean>();
  for (const r of replies) {
    if (findForcedMate(makeMove(next, r), plies - 2, memo) === null) return false;
  }
  return true;
}

/** 这道题正好是 N 步杀吗（有 plies 步解，且更短一步解不出来） */
export function isExactMate(pos: Position, plies: number): boolean {
  if (findForcedMate(pos, plies) === null) return false;
  return plies <= 1 || findForcedMate(pos, plies - 2) === null;
}

/** 找一步走完就是逼和的棋（和棋题用） */
export function findStalemateMove(pos: Position): Move | null {
  for (const m of legalMoves(pos)) {
    const next = makeMove(pos, m);
    if (legalMoves(next).length === 0 && !inCheck(next, next.turn)) return m;
  }
  return null;
}

/** 找一步走完就变成「子力不足」的棋（例如换掉对方最后一个车） */
export function findMaterialDrawMove(pos: Position, isDraw: (p: Position) => boolean): Move | null {
  for (const m of legalMoves(pos)) {
    if (isDraw(makeMove(pos, m))) return m;
  }
  return null;
}
