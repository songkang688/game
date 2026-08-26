/**
 * 花园国际象棋 · 自写搜索（alpha-beta + 置换表 + 迭代加深）。
 *
 * 这里没有任何外部引擎、没有 wasm、没有权重文件——评估函数就是
 * 「子力 + 位置表 + 王安全」这三样，看得懂也调得动。
 */
import { fileOf, other, rankOf, zobrist, type Color, type PieceType, type Position } from "./board";
import { inCheck, legalMoves, makeMove, status, type Move } from "./rules";

export type Tier = "rookie" | "normal" | "pro" | "hell";

export const TIERS: readonly Tier[] = ["rookie", "normal", "pro", "hell"];

export const TIER_LABELS: Record<Tier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  pro: "高手",
  hell: "地狱",
};

export const TIER_BLURB: Record<Tier, string> = {
  rookie: "随便走，但不会主动白送子。",
  normal: "会算一两步，能吃就吃。",
  pro: "会看位置和王的安全，算三步。",
  hell: "迭代加深，一手想两百毫秒。",
};

export const VALUE: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

/** 位置表：白方视角，下标 0 是 a8。黑方读的时候上下翻过来 */
const PST: Record<PieceType, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15,
    20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10,
    5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10,
    -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0,
    0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0,
    -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10,
    -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40,
    -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20,
    -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

function mirror(sq: number): number {
  return (7 - rankOf(sq)) * 8 + fileOf(sq);
}

/** 局面评估：正分表示轮走方占优 */
export function evaluate(pos: Position, usePst = true): number {
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = pos.board[sq];
    if (!p) continue;
    const base = VALUE[p.type] + (usePst ? PST[p.type][p.color === "w" ? sq : mirror(sq)] : 0);
    score += p.color === pos.turn ? base : -base;
  }
  return score;
}

interface TtEntry {
  depth: number;
  score: number;
  flag: "exact" | "lower" | "upper";
}

/** 走法排序：先吃大子、先升变，剪枝才剪得动 */
function orderMoves(moves: Move[]): Move[] {
  return moves.slice().sort((a, b) => scoreOrder(b) - scoreOrder(a));
}

function scoreOrder(m: Move): number {
  let s = 0;
  if (m.capture) s += VALUE[m.capture];
  if (m.promo) s += VALUE[m.promo];
  if (m.castle) s += 40;
  return s;
}

const MATE = 100000;

export interface SearchOptions {
  depth: number;
  /** 时间预算（毫秒），到点就返回目前最好的一手 */
  timeMs?: number;
  usePst?: boolean;
}

export interface SearchResult {
  move: Move | null;
  score: number;
  depth: number;
  nodes: number;
}

/** 迭代加深 + alpha-beta + 置换表 */
export function search(pos: Position, opts: SearchOptions): SearchResult {
  const started = Date.now();
  const budget = opts.timeMs ?? Infinity;
  const usePst = opts.usePst ?? true;
  const tt = new Map<number, TtEntry>();
  let nodes = 0;
  let stopped = false;

  function timeUp(): boolean {
    if (budget === Infinity) return false;
    if (stopped) return true;
    if ((nodes & 511) === 0 && Date.now() - started >= budget) stopped = true;
    return stopped;
  }

  function quiesce(p: Position, alpha: number, beta: number, ply: number): number {
    nodes += 1;
    const stand = evaluate(p, usePst);
    if (stand >= beta) return beta;
    let a = Math.max(alpha, stand);
    if (ply > 4 || timeUp()) return a;
    const loud = legalMoves(p).filter((m) => m.capture || m.promo);
    for (const m of orderMoves(loud)) {
      const v = -quiesce(makeMove(p, m), -beta, -a, ply + 1);
      if (v >= beta) return beta;
      if (v > a) a = v;
    }
    return a;
  }

  function negamax(p: Position, depth: number, alpha: number, beta: number, ply: number): number {
    if (timeUp()) return evaluate(p, usePst);
    const key = zobrist(p);
    const hit = tt.get(key);
    if (hit && hit.depth >= depth) {
      if (hit.flag === "exact") return hit.score;
      if (hit.flag === "lower" && hit.score > alpha) alpha = hit.score;
      if (hit.flag === "upper" && hit.score < beta) beta = hit.score;
      if (alpha >= beta) return hit.score;
    }
    const moves = legalMoves(p);
    if (moves.length === 0) return inCheck(p, p.turn) ? -MATE + ply : 0;
    if (depth <= 0) return quiesce(p, alpha, beta, 0);

    let best = -Infinity;
    const origAlpha = alpha;
    for (const m of orderMoves(moves)) {
      const v = -negamax(makeMove(p, m), depth - 1, -beta, -alpha, ply + 1);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    tt.set(key, {
      depth,
      score: best,
      flag: best <= origAlpha ? "upper" : best >= beta ? "lower" : "exact",
    });
    return best;
  }

  const roots = orderMoves(legalMoves(pos));
  if (roots.length === 0) return { move: null, score: 0, depth: 0, nodes };

  let bestMove = roots[0];
  let bestScore = -Infinity;
  let reached = 0;
  for (let d = 1; d <= opts.depth; d++) {
    let localBest = roots[0];
    let localScore = -Infinity;
    let alpha = -Infinity;
    for (const m of roots) {
      const v = -negamax(makeMove(pos, m), d - 1, -Infinity, -alpha, 1);
      if (v > localScore) {
        localScore = v;
        localBest = m;
      }
      if (v > alpha) alpha = v;
      if (timeUp()) break;
    }
    if (!stopped || reached === 0) {
      bestMove = localBest;
      bestScore = localScore;
      reached = d;
    }
    if (stopped) break;
  }
  return { move: bestMove, score: bestScore, depth: reached, nodes };
}

function rand01(seed: number, i: number): number {
  let h = (seed ^ Math.imul(i + 7, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

/** 菜鸟档：随便走，但会躲开「走完马上被吃」的白送 */
function rookieMove(pos: Position, seed: number): Move | null {
  const moves = legalMoves(pos);
  if (moves.length === 0) return null;
  const me = pos.turn;
  const safe = moves.filter((m) => {
    const next = makeMove(pos, m);
    const reply = legalMoves(next);
    const mine = pos.board[m.from];
    if (!mine) return true;
    return !reply.some((r) => r.to === m.to && VALUE[r.capture ?? "p"] >= VALUE[mine.type]);
  });
  const pool = safe.length > 0 ? safe : moves;
  void me;
  return pool[Math.floor(rand01(seed, pos.fullmove) * pool.length) % pool.length];
}

/** 各档位默认的思考时间（毫秒） */
export const TIER_BUDGET_MS: Record<Tier, number> = { rookie: 0, normal: 120, pro: 180, hell: 200 };

/**
 * 按档位挑一手。
 * `budgetMs` 可以临时收紧思考时间——批量对局的测试要用，正常玩不传。
 */
export function chooseMove(pos: Position, tier: Tier, seed = 1, budgetMs?: number): Move | null {
  if (legalMoves(pos).length === 0) return null;
  if (tier === "rookie") return rookieMove(pos, seed);
  const timeMs = budgetMs ?? TIER_BUDGET_MS[tier];
  if (tier === "normal") return search(pos, { depth: 2, usePst: false, timeMs }).move;
  if (tier === "pro") return search(pos, { depth: 3, timeMs }).move;
  return search(pos, { depth: 5, timeMs }).move;
}

export interface DuelResult {
  winner: Color | null;
  plies: number;
}

/** 无头对局：两档 AI 互下一局 */
export function playDuel(
  pos: Position,
  whiteTier: Tier,
  blackTier: Tier,
  seed: number,
  maxPlies = 120,
  budgetMs?: number
): DuelResult {
  let p = pos;
  const history: number[] = [];
  for (let i = 0; i < maxPlies; i++) {
    const st = status(p, history);
    if (st.kind === "checkmate") return { winner: st.winner, plies: i };
    if (st.kind !== "playing") return { winner: null, plies: i };
    const tier = p.turn === "w" ? whiteTier : blackTier;
    const m = chooseMove(p, tier, seed + i * 23, budgetMs);
    if (!m) return { winner: null, plies: i };
    p = makeMove(p, m);
    history.push(zobrist(p));
  }
  return { winner: null, plies: maxPlies };
}

export { other };
