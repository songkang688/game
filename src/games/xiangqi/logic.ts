// 朵朵星星象棋 —— 中国象棋纯逻辑（不依赖 DOM，方便单元测试）。
// 棋盘 9 列 × 10 行，交叉点坐标 (x, y)：x 0..8 从左到右，y 0..9 从上到下。
// 黑方在上（y 0..4），红方在下（y 5..9），y=4 与 y=5 之间是楚河汉界。

export type Side = "red" | "black";

/** K帅将 A仕士 E相象 H马 R车 C炮 P兵卒 */
export type PieceType = "K" | "A" | "E" | "H" | "R" | "C" | "P";

export interface Piece {
  side: Side;
  type: PieceType;
}

/** 长度 90 的数组，下标 = y * 9 + x，空点为 null。 */
export type Board = (Piece | null)[];

export interface Pos {
  x: number;
  y: number;
}

export interface Move {
  from: Pos;
  to: Pos;
}

export const COLS = 9;
export const ROWS = 10;

export function idx(x: number, y: number): number {
  return y * COLS + x;
}

export function inBoard(x: number, y: number): boolean {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

/** 九宫：x 3..5，红方 y 7..9，黑方 y 0..2。 */
export function inPalace(side: Side, x: number, y: number): boolean {
  if (x < 3 || x > 5) return false;
  return side === "red" ? y >= 7 && y <= 9 : y >= 0 && y <= 2;
}

/** 是否已过河（进入对方半场）。 */
export function crossedRiver(side: Side, y: number): boolean {
  return side === "red" ? y <= 4 : y >= 5;
}

/** 未过河时不能越过河界（象用）。 */
function ownHalf(side: Side, y: number): boolean {
  return side === "red" ? y >= 5 : y <= 4;
}

export function other(side: Side): Side {
  return side === "red" ? "black" : "red";
}

/** 棋子中文名（红/黑写法不同）。 */
export const PIECE_NAME: Record<Side, Record<PieceType, string>> = {
  red: { K: "帅", A: "仕", E: "相", H: "马", R: "车", C: "炮", P: "兵" },
  black: { K: "将", A: "士", E: "象", H: "马", R: "车", C: "炮", P: "卒" },
};

export function makeEmptyBoard(): Board {
  return new Array<Piece | null>(COLS * ROWS).fill(null);
}

/** 标准开局。 */
export function initialBoard(): Board {
  const b = makeEmptyBoard();
  const back: PieceType[] = ["R", "H", "E", "A", "K", "A", "E", "H", "R"];
  for (let x = 0; x < COLS; x++) {
    b[idx(x, 0)] = { side: "black", type: back[x] };
    b[idx(x, 9)] = { side: "red", type: back[x] };
  }
  b[idx(1, 2)] = { side: "black", type: "C" };
  b[idx(7, 2)] = { side: "black", type: "C" };
  b[idx(1, 7)] = { side: "red", type: "C" };
  b[idx(7, 7)] = { side: "red", type: "C" };
  for (let i = 0; i < 5; i++) {
    b[idx(i * 2, 3)] = { side: "black", type: "P" };
    b[idx(i * 2, 6)] = { side: "red", type: "P" };
  }
  return b;
}

export function findKing(board: Board, side: Side): Pos | null {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 3; x <= 5; x++) {
      const p = board[idx(x, y)];
      if (p && p.side === side && p.type === "K") return { x, y };
    }
  }
  return null;
}

/** 双方将帅在同一列且中间无子（“飞将”，不允许出现的局面）。 */
export function generalsFacing(board: Board): boolean {
  const rk = findKing(board, "red");
  const bk = findKing(board, "black");
  if (!rk || !bk || rk.x !== bk.x) return false;
  for (let y = bk.y + 1; y < rk.y; y++) {
    if (board[idx(rk.x, y)]) return false;
  }
  return true;
}

/**
 * 伪合法走法：只按兵种规则生成（含吃子限制），
 * 不检查走后是否送将 / 飞将 —— 那一步在 legalMoves 里过滤。
 */
export function rawMoves(board: Board, x: number, y: number): Pos[] {
  const piece = board[idx(x, y)];
  if (!piece) return [];
  const { side, type } = piece;
  const out: Pos[] = [];
  const push = (tx: number, ty: number): void => {
    if (!inBoard(tx, ty)) return;
    const t = board[idx(tx, ty)];
    if (t && t.side === side) return;
    out.push({ x: tx, y: ty });
  };

  if (type === "K") {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const tx = x + dx;
      const ty = y + dy;
      if (inPalace(side, tx, ty)) push(tx, ty);
    }
  } else if (type === "A") {
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const tx = x + dx;
      const ty = y + dy;
      if (inPalace(side, tx, ty)) push(tx, ty);
    }
  } else if (type === "E") {
    for (const [dx, dy] of [[2, 2], [2, -2], [-2, 2], [-2, -2]] as const) {
      const tx = x + dx;
      const ty = y + dy;
      if (!inBoard(tx, ty) || !ownHalf(side, ty)) continue;
      // 塞象眼：田字中心有子不能走
      if (board[idx(x + dx / 2, y + dy / 2)]) continue;
      push(tx, ty);
    }
  } else if (type === "H") {
    // 马走日，蹩马腿：先直一步的位置有子就不能跳
    const jumps: Array<[number, number, number, number]> = [
      [1, 0, 2, 1], [1, 0, 2, -1],
      [-1, 0, -2, 1], [-1, 0, -2, -1],
      [0, 1, 1, 2], [0, 1, -1, 2],
      [0, -1, 1, -2], [0, -1, -1, -2],
    ];
    for (const [lx, ly, dx, dy] of jumps) {
      if (!inBoard(x + lx, y + ly) || board[idx(x + lx, y + ly)]) continue;
      push(x + dx, y + dy);
    }
  } else if (type === "R" || type === "C") {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      let tx = x + dx;
      let ty = y + dy;
      // 直线滑行到第一个子为止
      while (inBoard(tx, ty) && !board[idx(tx, ty)]) {
        out.push({ x: tx, y: ty });
        tx += dx;
        ty += dy;
      }
      if (!inBoard(tx, ty)) continue;
      if (type === "R") {
        // 车：第一个子若是敌方可吃
        const t = board[idx(tx, ty)];
        if (t && t.side !== side) out.push({ x: tx, y: ty });
      } else {
        // 炮：隔一个“炮架”后第一个敌子可吃
        tx += dx;
        ty += dy;
        while (inBoard(tx, ty) && !board[idx(tx, ty)]) {
          tx += dx;
          ty += dy;
        }
        if (inBoard(tx, ty)) {
          const t = board[idx(tx, ty)];
          if (t && t.side !== side) out.push({ x: tx, y: ty });
        }
      }
    }
  } else {
    // 兵/卒：过河前只能向前，过河后可以向前或横走，永远不能后退
    const fwd = side === "red" ? -1 : 1;
    push(x, y + fwd);
    if (crossedRiver(side, y)) {
      push(x - 1, y);
      push(x + 1, y);
    }
  }
  return out;
}

/** side 一方的将/帅当前是否被攻击（被将军）。 */
export function inCheck(board: Board, side: Side): boolean {
  const king = findKing(board, side);
  if (!king) return true;
  const enemy = other(side);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const p = board[idx(x, y)];
      if (!p || p.side !== enemy) continue;
      for (const m of rawMoves(board, x, y)) {
        if (m.x === king.x && m.y === king.y) return true;
      }
    }
  }
  return false;
}

/** 执行一步（返回新棋盘，原棋盘不变）。 */
export function applyMove(board: Board, move: Move): Board {
  const next = board.slice();
  next[idx(move.to.x, move.to.y)] = next[idx(move.from.x, move.from.y)];
  next[idx(move.from.x, move.from.y)] = null;
  return next;
}

/** 一个子的全部合法走法：走后不能自己被将军，也不能形成飞将。 */
export function legalMoves(board: Board, x: number, y: number): Pos[] {
  const piece = board[idx(x, y)];
  if (!piece) return [];
  const out: Pos[] = [];
  for (const to of rawMoves(board, x, y)) {
    const next = applyMove(board, { from: { x, y }, to });
    if (inCheck(next, piece.side)) continue;
    if (generalsFacing(next)) continue;
    out.push(to);
  }
  return out;
}

export function allLegalMoves(board: Board, side: Side): Move[] {
  const out: Move[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const p = board[idx(x, y)];
      if (!p || p.side !== side) continue;
      for (const to of legalMoves(board, x, y)) {
        out.push({ from: { x, y }, to });
      }
    }
  }
  return out;
}

export type Status = "normal" | "check" | "checkmate" | "stalemate";

/** 轮到 side 走棋时的局面状态。checkmate=将死，stalemate=困毙，两者都判 side 负。 */
export function statusOf(board: Board, side: Side): Status {
  const hasMove = allLegalMoves(board, side).length > 0;
  const checked = inCheck(board, side);
  if (!hasMove) return checked ? "checkmate" : "stalemate";
  return checked ? "check" : "normal";
}

/* ---------------- 简单电脑（一年级水平） ---------------- */

const VALUE: Record<PieceType, number> = {
  K: 10000,
  R: 90,
  C: 45,
  H: 40,
  E: 20,
  A: 20,
  P: 10,
};

function pieceValue(p: Piece, y: number): number {
  let v = VALUE[p.type];
  // 过河兵更值钱
  if (p.type === "P" && crossedRiver(p.side, y)) v += 10;
  return v;
}

/** 简单局面分：side 视角的子力差。 */
export function evaluate(board: Board, side: Side): number {
  let score = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const p = board[idx(x, y)];
      if (!p) continue;
      score += p.side === side ? pieceValue(p, y) : -pieceValue(p, y);
    }
  }
  return score;
}

/**
 * 电脑走子：一层半的小搜索 —— 对每步棋，看对手最好的回应（只按子力算），
 * 再带一点随机，让棋力停留在“陪小朋友玩”的水平，绝不会卡死。
 */
export function aiMove(
  board: Board,
  side: Side,
  rng: () => number = Math.random,
): Move | null {
  const moves = allLegalMoves(board, side);
  if (moves.length === 0) return null;
  const enemy = other(side);
  let scored: Array<{ move: Move; score: number }> = [];
  for (const move of moves) {
    const after = applyMove(board, move);
    // 直接将死对面：最高分
    const st = statusOf(after, enemy);
    if (st === "checkmate" || st === "stalemate") {
      return move;
    }
    // 对手会挑让我们最难受的回应
    let worst = Infinity;
    for (const reply of allLegalMoves(after, enemy)) {
      const after2 = applyMove(after, reply);
      const s = evaluate(after2, side);
      if (s < worst) worst = s;
    }
    if (worst === Infinity) worst = evaluate(after, side);
    scored.push({ move, score: worst });
  }
  scored.sort((a, b) => b.score - a.score);
  // 从差距不大的前几名里随机挑一个（小朋友水平：偶尔走出“可爱”的棋）
  const best = scored[0].score;
  const pool = scored.filter((s) => s.score >= best - 15).slice(0, 5);
  const pick = pool[Math.floor(rng() * pool.length)] ?? scored[0];
  return pick.move;
}

/* ---------------- 记谱辅助（给界面显示用） ---------------- */

/** 把一步棋说成小朋友能懂的话，例如“红马 跳到 (3,4)”。 */
export function describeMove(board: Board, move: Move): string {
  const p = board[idx(move.from.x, move.from.y)];
  if (!p) return "";
  const target = board[idx(move.to.x, move.to.y)];
  const who = p.side === "red" ? "红" : "黑";
  const name = PIECE_NAME[p.side][p.type];
  if (target) {
    const tn = PIECE_NAME[target.side][target.type];
    return `${who}${name} 吃掉了 ${target.side === "red" ? "红" : "黑"}${tn}`;
  }
  return `${who}${name} 走了一步`;
}
