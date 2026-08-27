// 残局求解器 —— 只回答一个问题：轮到 side 走，它能不能在 n 步之内**必胜**。
//
// 象棋里「赢」有两种：把对方将死，或者让对方无棋可走（困毙），两种都算。
// 求解器不猜、不用启发式，是完整的「我方任选一步、对方所有应法都得输」的穷举，
// 所以 188 课残局的可解性断言拿它当裁判：
//   · 声明的步数内有强制胜；
//   · 少一步就没有（步数是紧的）；
//   · **首着解集只有一个**（唯一主线解）。
import { type Board, type Move, type Side, other } from "./logic";
import { genMoves, hasLegalMove, kingAttacked, makeMove, positionKey, unmakeMove } from "./movegen";

/** 一次求解的备忘录：同一局面同一剩余步数只算一次 */
type Memo = Map<string, boolean>;

function winIn(board: Board, side: Side, n: number, memo: Memo): boolean {
  if (n <= 0) return false;
  const key = `${positionKey(board, side)}#${n}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const enemy = other(side);
  let ok = false;
  for (const m of genMoves(board, side)) {
    const captured = makeMove(board, m);
    let good = !hasLegalMove(board, enemy);
    if (!good && n > 1) {
      good = true;
      for (const reply of genMoves(board, enemy)) {
        const c2 = makeMove(board, reply);
        const still = winIn(board, side, n - 1, memo);
        unmakeMove(board, reply, c2);
        if (!still) {
          good = false;
          break;
        }
      }
    }
    unmakeMove(board, m, captured);
    if (good) {
      ok = true;
      break;
    }
  }
  memo.set(key, ok);
  return ok;
}

/** side 先走，能不能在 n 步（自己走 n 步）之内必胜 */
export function canWinIn(board: Board, side: Side, n: number, memo: Memo = new Map()): boolean {
  return winIn(board.slice(), side, n, memo);
}

/** n 步必胜的**全部首着**：长度为 1 才叫「唯一主线解」 */
export function winningFirstMoves(
  board: Board,
  side: Side,
  n: number,
  memo: Memo = new Map(),
): Move[] {
  if (n <= 0) return [];
  const work = board.slice();
  const enemy = other(side);
  const out: Move[] = [];
  for (const m of genMoves(work, side)) {
    const captured = makeMove(work, m);
    let good = !hasLegalMove(work, enemy);
    if (!good && n > 1) {
      good = true;
      for (const reply of genMoves(work, enemy)) {
        const c2 = makeMove(work, reply);
        const still = winIn(work, side, n - 1, memo);
        unmakeMove(work, reply, c2);
        if (!still) {
          good = false;
          break;
        }
      }
    }
    unmakeMove(work, m, captured);
    if (good) out.push(m);
  }
  return out;
}

export interface MateSolution {
  /** 最少要走几步 */
  moves: number;
  /** 这一步之后必胜的首着（唯一主线解时长度为 1） */
  first: Move[];
}

/** 从 1 步开始往上找，返回最短的必胜步数与它的首着解集；找不到返回 null */
export function solveMate(board: Board, side: Side, maxMoves = 3): MateSolution | null {
  const memo: Memo = new Map();
  for (let n = 1; n <= maxMoves; n++) {
    const first = winningFirstMoves(board, side, n, memo);
    if (first.length > 0) return { moves: n, first };
  }
  return null;
}

/**
 * 主线着法序列（我方走最短的那条，对方每次挑「最能拖」的应法）。
 * 只给讲解与提示用，不参与判定。
 */
export function principalLine(board: Board, side: Side, n: number): Move[] {
  const work = board.slice();
  const memo: Memo = new Map();
  const line: Move[] = [];
  let left = n;
  while (left > 0) {
    const first = winningFirstMoves(work, side, left, memo);
    if (first.length === 0) break;
    const mine = first[0];
    makeMove(work, mine);
    line.push(mine);
    const enemy = other(side);
    if (!hasLegalMove(work, enemy)) break;
    // 对方挑一步「还能撑最久」的应法
    let best: Move | null = null;
    for (const reply of genMoves(work, enemy)) {
      const c = makeMove(work, reply);
      const stillLost = winIn(work, side, left - 1, memo);
      unmakeMove(work, reply, c);
      if (!stillLost) {
        best = reply;
        break;
      }
      if (!best) best = reply;
    }
    if (!best) break;
    makeMove(work, best);
    line.push(best);
    left--;
  }
  return line;
}

/** 走完这一步之后对方是「将死」还是「困毙」（都算赢，提示语不一样） */
export function finishKindAfter(board: Board, move: Move, mover: Side): "checkmate" | "stalemate" | "none" {
  const work = board.slice();
  const captured = makeMove(work, move);
  const enemy = other(mover);
  const done = !hasLegalMove(work, enemy);
  // 无棋可走时再看是不是正在被将军：被将着走不了叫将死，没被将叫困毙
  const checked = done ? kingAttacked(work, enemy) : false;
  unmakeMove(work, move, captured);
  if (!done) return "none";
  return checked ? "checkmate" : "stalemate";
}
