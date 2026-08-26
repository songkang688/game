// 人机六档 —— 从「小象学步」到「星海棋神」。
//
// 六档共用一套 α-β 搜索，差别只在**看多深、看多细、带不带记忆**：
//   novice 0 层（随机 + 一半概率吃白送的子）
//   easy   1 层（会吃子、会应将）
//   normal 2 层（子力 + 位置分）
//   hard   3 层（吃子延伸的静态搜索，威胁项会捉双）
//   master 4 层（置换表 + 杀棋优先 + 开局库）
//   hell   ≥5 层（迭代加深限时 400ms，残局先算杀）
//
// 走法生成一行都没重写：全部经过 movegen（它自己也只是 logic.rawMoves 的加速壳）。
import {
  type Board,
  type Move,
  type Piece,
  type PieceType,
  type Side,
  COLS,
  ROWS,
  crossedRiver,
  idx,
  initialBoard,
  other,
  rawMoves,
} from "./logic";
import {
  genMoves,
  hasLegalMove,
  kingAttacked,
  makeMove,
  moveKey,
  positionKey,
  unmakeMove,
} from "./movegen";
import { solveMate } from "./solve";

export type Difficulty = "novice" | "easy" | "normal" | "hard" | "master" | "hell";

export const DIFFICULTIES: readonly Difficulty[] = [
  "novice",
  "easy",
  "normal",
  "hard",
  "master",
  "hell",
];

/** 六个对手的名字（「棋灵象」是 1.1 就有的名字，按规格留在中高档，不改名） */
export const DIFFICULTY_NAME: Record<Difficulty, string> = {
  novice: "🌱 小象学步",
  easy: "🐘 小象过河",
  normal: "🐘 棋灵象",
  hard: "🔥 棋灵象·进阶",
  master: "🌌 银河象王",
  hell: "⭐ 星海棋神",
};

/** 播报用的短名（不带表情，读起来顺） */
export const TIER_SHORT: Record<Difficulty, string> = {
  novice: "小象学步",
  easy: "小象过河",
  normal: "棋灵象",
  hard: "棋灵象·进阶",
  master: "银河象王",
  hell: "星海棋神",
};

export const DIFFICULTY_BLURB: Record<Difficulty, string> = {
  novice: "刚学会走法，见到白送的子也只有一半时候会吃",
  easy: "看一步：能吃就吃，被将军会应将",
  normal: "看两步：算子力，也知道把子摆到好位置",
  hard: "看三步，还会把吃子的变化多算几层，专捉你的双",
  master: "看四步，记得住算过的局面，开局有套路，见到杀棋绝不放过",
  hell: "限时想满四百毫秒，残局先算杀，越到后面越难缠",
};

/** 名义搜索层数（写进说明，也是测试盯的契约） */
export const SEARCH_DEPTH: Record<Difficulty, number> = {
  novice: 0,
  easy: 1,
  normal: 2,
  hard: 3,
  master: 4,
  hell: 5,
};

/** 每一档最多想多久（毫秒）。地狱档按规格是 400ms 迭代加深 */
export const TIME_BUDGET_MS: Record<Difficulty, number> = {
  novice: 20,
  easy: 40,
  normal: 90,
  hard: 200,
  master: 300,
  hell: 400,
};

/** 界面上的「思考延时」：再快的档也不许秒应，孩子要看得见它在想 */
export const THINK_DELAY_MS: Record<Difficulty, number> = {
  novice: 320,
  easy: 380,
  normal: 460,
  hard: 540,
  master: 640,
  hell: 760,
};

/* ------------------------------------------------------------------ */
/* 局面评估                                                            */
/* ------------------------------------------------------------------ */

/** 子力价值（比 logic.evaluate 细一档，车最重、士象是防守骨架） */
export const PIECE_VALUE: Record<PieceType, number> = {
  K: 8000,
  R: 600,
  C: 300,
  H: 280,
  A: 130,
  E: 130,
  P: 60,
};

/** 兵卒越靠近对方九宫越值钱（按「离底线还有几步」加分） */
function pawnBonus(side: Side, x: number, y: number): number {
  if (!crossedRiver(side, y)) return 0;
  const depth = side === "red" ? 4 - y : y - 5; // 0..4
  const center = x >= 3 && x <= 5 ? 12 : 0;
  return 30 + depth * 14 + center;
}

/** 马怕边、炮爱中路、车喜欢压到对方半场 */
function placeBonus(p: Piece, x: number, y: number): number {
  switch (p.type) {
    case "H": {
      const edge = x === 0 || x === 8 ? -14 : 0;
      const forward = crossedRiver(p.side, y) ? 14 : 0;
      const center = x >= 2 && x <= 6 ? 8 : 0;
      return edge + forward + center;
    }
    case "C":
      return x === 4 ? 14 : 0;
    case "R":
      return crossedRiver(p.side, y) ? 16 : 0;
    case "P":
      return pawnBonus(p.side, x, y);
    case "A":
    case "E":
      return 4;
    default:
      return 0;
  }
}

/** 只算子力与位置的快评（低档用，够便宜） */
export function evaluateFast(board: Board, side: Side): number {
  let score = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const p = board[idx(x, y)];
      if (!p) continue;
      const v = PIECE_VALUE[p.type] + placeBonus(p, x, y);
      score += p.side === side ? v : -v;
    }
  }
  return score;
}

/**
 * 带机动性与威胁的细评（高档用）。
 * 「捉双」就藏在这里：一个子同时盯上两个没人保护的大子会拿到额外分。
 */
export function evaluateFull(board: Board, side: Side): number {
  let score = evaluateFast(board, side);
  // 谁在保护谁：一遍扫完，既拿到机动性，也拿到「攻击 / 保护」计数
  const attackedBy: Record<string, number[]> = { red: new Array(90).fill(0), black: new Array(90).fill(0) };
  const mobility = { red: 0, black: 0 };
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const p = board[idx(x, y)];
      if (!p) continue;
      const moves = rawMoves(board, x, y);
      mobility[p.side] += moves.length;
      for (const m of moves) attackedBy[p.side][idx(m.x, m.y)]++;
    }
  }
  score += (mobility[side] - mobility[other(side)]) * 2;

  const enemy = other(side);
  let doubleAttack = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const p = board[idx(x, y)];
      if (!p) continue;
      const i = idx(x, y);
      const attackers = attackedBy[other(p.side)][i];
      const guards = attackedBy[p.side][i];
      if (attackers > 0 && guards === 0 && p.type !== "K") {
        // 没人保护还被盯上：按子力的三成算风险
        const risk = Math.round(PIECE_VALUE[p.type] * 0.3);
        score += p.side === enemy ? risk : -risk;
        if (p.side === enemy && attackers >= 2) doubleAttack += 20;
      }
    }
  }
  return score + doubleAttack;
}

const MATE = 900000;

/* ------------------------------------------------------------------ */
/* α-β 搜索                                                            */
/* ------------------------------------------------------------------ */

interface TTEntry {
  depth: number;
  score: number;
  flag: "exact" | "lower" | "upper";
  move: Move | null;
}

interface Ctx {
  board: Board;
  full: boolean;
  quiesce: boolean;
  tt: Map<string, TTEntry> | null;
  deadline: number;
  nodes: number;
  aborted: boolean;
  now: () => number;
}

function timeUp(ctx: Ctx): boolean {
  if (ctx.aborted) return true;
  ctx.nodes++;
  if ((ctx.nodes & 255) === 0 && ctx.now() >= ctx.deadline) ctx.aborted = true;
  return ctx.aborted;
}

function evalOf(ctx: Ctx, side: Side): number {
  return ctx.full ? evaluateFull(ctx.board, side) : evaluateFast(ctx.board, side);
}

/** 吃子价值排序（MVV-LVA）：拿小子吃大子排最前 */
function captureScore(board: Board, m: Move): number {
  const victim = board[idx(m.to.x, m.to.y)];
  if (!victim) return 0;
  const attacker = board[idx(m.from.x, m.from.y)];
  return PIECE_VALUE[victim.type] * 10 - (attacker ? PIECE_VALUE[attacker.type] : 0);
}

function orderMoves(ctx: Ctx, moves: Move[], ttMove: Move | null, mateFirst: boolean): Move[] {
  const board = ctx.board;
  const scored = moves.map((m) => {
    let s = captureScore(board, m);
    if (ttMove && moveKey(ttMove) === moveKey(m)) s += 1_000_000;
    if (mateFirst && s < 1_000_000) {
      // 杀棋优先：先试将军的着法
      const captured = makeMove(board, m);
      const p = board[idx(m.to.x, m.to.y)];
      if (p && kingAttacked(board, other(p.side))) s += 5000;
      unmakeMove(board, m, captured);
    }
    return { m, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.m);
}

function quiescence(ctx: Ctx, side: Side, alpha: number, beta: number, ply: number, left: number): number {
  if (timeUp(ctx)) return alpha;
  if (!hasLegalMove(ctx.board, side)) return -MATE + ply;
  let best = evalOf(ctx, side);
  if (best >= beta || left <= 0) return best;
  if (best > alpha) alpha = best;
  const caps = genMoves(ctx.board, side).filter((m) => ctx.board[idx(m.to.x, m.to.y)]);
  for (const m of orderMoves(ctx, caps, null, false)) {
    const captured = makeMove(ctx.board, m);
    const score = -quiescence(ctx, other(side), -beta, -alpha, ply + 1, left - 1);
    unmakeMove(ctx.board, m, captured);
    if (ctx.aborted) return alpha;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function negamax(
  ctx: Ctx,
  side: Side,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  mateFirst: boolean,
): number {
  if (timeUp(ctx)) return alpha;
  const alpha0 = alpha;
  let ttMove: Move | null = null;
  let key = "";
  if (ctx.tt) {
    key = positionKey(ctx.board, side);
    const hit = ctx.tt.get(key);
    if (hit) {
      ttMove = hit.move;
      if (hit.depth >= depth) {
        if (hit.flag === "exact") return hit.score;
        if (hit.flag === "lower" && hit.score > alpha) alpha = hit.score;
        else if (hit.flag === "upper" && hit.score < beta) beta = hit.score;
        if (alpha >= beta) return hit.score;
      }
    }
  }

  const moves = genMoves(ctx.board, side);
  // 无棋可走：将死或困毙，两种都判负（越早被将死越糟）
  if (moves.length === 0) return -MATE + ply;
  if (depth <= 0) {
    return ctx.quiesce ? quiescence(ctx, side, alpha, beta, ply, 4) : evalOf(ctx, side);
  }

  let best = -Infinity;
  let bestMove: Move | null = null;
  for (const m of orderMoves(ctx, moves, ttMove, mateFirst && depth >= 2)) {
    const captured = makeMove(ctx.board, m);
    const score = -negamax(ctx, other(side), depth - 1, -beta, -alpha, ply + 1, mateFirst);
    unmakeMove(ctx.board, m, captured);
    if (ctx.aborted) break;
    if (score > best) {
      best = score;
      bestMove = m;
    }
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  if (best === -Infinity) return -MATE + ply;
  if (ctx.tt && !ctx.aborted) {
    const flag = best <= alpha0 ? "upper" : best >= beta ? "lower" : "exact";
    ctx.tt.set(key, { depth, score: best, flag, move: bestMove });
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* 开局库（大师 / 地狱档用）                                            */
/* ------------------------------------------------------------------ */

type Line = Array<[number, number, number, number]>;

/**
 * 几条最常见的开局：中炮进马出车、顺炮、仙人指路。
 * 只是为了让高档开局不至于走出「炮九平八」这种怪棋，走完就交给搜索。
 */
const OPENING_LINES: Line[] = [
  // 中炮 → 屏风马 → 马二进三 → 车９平８ → 车一平二
  [[7, 7, 4, 7], [7, 0, 6, 2], [7, 9, 6, 7], [8, 0, 7, 0], [8, 9, 7, 9]],
  // 中炮 → 顺炮 → 马二进三 → 马８进７
  [[7, 7, 4, 7], [7, 2, 4, 2], [7, 9, 6, 7], [7, 0, 6, 2]],
  // 仙人指路 → 卒７进１ → 马八进七
  [[2, 6, 2, 5], [6, 3, 6, 4], [1, 9, 2, 7]],
];

function buildBook(): Map<string, Move[]> {
  const book = new Map<string, Move[]>();
  for (const line of OPENING_LINES) {
    const board = initialBoard();
    let side: Side = "red";
    for (const [fx, fy, tx, ty] of line) {
      const move: Move = { from: { x: fx, y: fy }, to: { x: tx, y: ty } };
      const key = positionKey(board, side);
      const list = book.get(key) ?? [];
      if (!list.some((m) => moveKey(m) === moveKey(move))) list.push(move);
      book.set(key, list);
      makeMove(board, move);
      side = other(side);
    }
  }
  return book;
}

const BOOK = buildBook();

/** 开局库里有没有这一手（导出便于测试） */
export function bookMove(board: Board, side: Side, rng: () => number = Math.random): Move | null {
  const list = BOOK.get(positionKey(board, side));
  if (!list || list.length === 0) return null;
  const pick = list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  return pick ?? null;
}

/* ------------------------------------------------------------------ */
/* 各档的挑子逻辑                                                       */
/* ------------------------------------------------------------------ */

/** 白送的子：吃了它对方没有子能吃回来 */
export function freeCaptures(board: Board, side: Side): Move[] {
  const out: Array<{ m: Move; v: number }> = [];
  for (const m of genMoves(board, side)) {
    const victim = board[idx(m.to.x, m.to.y)];
    if (!victim) continue;
    const captured = makeMove(board, m);
    let safe = true;
    for (const reply of genMoves(board, other(side))) {
      if (reply.to.x === m.to.x && reply.to.y === m.to.y) {
        safe = false;
        break;
      }
    }
    unmakeMove(board, m, captured);
    if (safe) out.push({ m, v: PIECE_VALUE[victim.type] });
  }
  out.sort((a, b) => b.v - a.v);
  return out.map((x) => x.m);
}

function pickRandom(moves: Move[], rng: () => number): Move {
  const i = Math.min(moves.length - 1, Math.floor(rng() * moves.length));
  return moves[Math.max(0, i)];
}

export interface ThinkOptions {
  /** 覆盖这一档的思考预算（测试里调小，界面上用默认值） */
  timeMs?: number;
  /** 覆盖搜索层数（测试用） */
  depth?: number;
  /** 计时函数，默认 Date.now */
  now?: () => number;
}

/**
 * 电脑走一步。永远返回合法着法；一步都走不了（被将死 / 困毙）时返回 null。
 * 同样的棋盘 + 同样的 rng 一定给出同样的结果，测试可以复现。
 */
export function chooseMove(
  board: Board,
  side: Side,
  level: Difficulty,
  rng: () => number = Math.random,
  opts: ThinkOptions = {},
): Move | null {
  const moves = genMoves(board, side);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  // 菜鸟：随机走，只有一半概率吃白送的子
  if (level === "novice") {
    const free = freeCaptures(board, side);
    if (free.length > 0 && rng() < 0.5) return free[0];
    return pickRandom(moves, rng);
  }

  const now = opts.now ?? (() => Date.now());
  const budget = opts.timeMs ?? TIME_BUDGET_MS[level];
  const work = board.slice();
  const ctx: Ctx = {
    board: work,
    full: level === "hard" || level === "master" || level === "hell",
    quiesce: level === "hard" || level === "master" || level === "hell",
    tt: level === "master" || level === "hell" ? new Map() : null,
    deadline: now() + budget,
    nodes: 0,
    aborted: false,
    now,
  };

  // 大师 / 地狱：开局照套路走
  if (level === "master" || level === "hell") {
    const book = bookMove(work, side, rng);
    if (book) return book;
  }

  // 地狱：残局先算杀，能三步之内结束就直接结束
  if (level === "hell" && pieceCount(work) <= 12) {
    const mate = solveMate(work, side, 3);
    if (mate && mate.first.length > 0) return mate.first[0];
  }

  const target = opts.depth ?? SEARCH_DEPTH[level];
  const mateFirst = level === "master" || level === "hell";
  const ordered = orderMoves(ctx, moves, null, mateFirst);

  // 迭代加深：地狱档从两层起一层层往上挖，时间到就用上一层挖出来的结果；
  // 其余档位只跑自己那一层（层数就是它们的性格）。
  const startDepth = level === "hell" ? 2 : target;
  const maxDepth = level === "hell" ? target + 3 : target;
  let best = ordered[0];
  let searched = ordered;
  for (let depth = startDepth; depth <= maxDepth; depth++) {
    let localBest: Move | null = null;
    let localScore = -Infinity;
    let alpha = -Infinity;
    const rank: Array<{ m: Move; s: number }> = [];
    for (const m of searched) {
      const captured = makeMove(work, m);
      const score = -negamax(ctx, other(side), depth - 1, -Infinity, -alpha, 1, mateFirst);
      unmakeMove(work, m, captured);
      if (ctx.aborted) break;
      rank.push({ m, s: score });
      // 同分时按 rng 轻微抖动，免得每盘一模一样（低档抖得多一点）
      const jitter = level === "easy" ? rng() * 12 : level === "normal" ? rng() * 6 : rng() * 0.5;
      const total = score + jitter;
      if (total > localScore) {
        localScore = total;
        localBest = m;
      }
      if (score > alpha) alpha = score;
    }
    if (localBest) best = localBest;
    if (ctx.aborted) break;
    // 上一层的排名拿来给下一层排序：越深越省时间
    if (rank.length === searched.length) {
      rank.sort((a, b) => b.s - a.s);
      searched = rank.map((r) => r.m);
    }
    if (now() >= ctx.deadline) break;
  }
  return best ?? moves[0];
}

/** 棋盘上还有几个子（残局判定用） */
export function pieceCount(board: Board): number {
  let n = 0;
  for (const p of board) if (p) n++;
  return n;
}

/** 提示：给玩家算一手好棋（残局用大师档，够强但不至于慢） */
export function hintMove(board: Board, side: Side): Move | null {
  return chooseMove(board, side, "master", () => 0, { timeMs: 220 });
}

/** 1.1 的 `aiMove` 相当于哪一档：老入口继续可用，默认给普通档 */
export const LEGACY_TIER: Difficulty = "normal";
