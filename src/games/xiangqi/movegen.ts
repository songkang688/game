// 走法加速层 —— 语义和 logic.ts 完全一致，只做三件事：
//  1. 把「有没有被将军」从「遍历对方每个子的 rawMoves」换成「从将帅往外扫」；
//  2. 提供就地走子 / 撤销，搜索里不用每一步都 slice 一份 90 格棋盘；
//  3. 给出局面指纹，置换表与重复局面检测共用。
//
// **兵种规则一行都没有重写**：所有着法仍旧来自 `logic.rawMoves`，
// 这里只是把 legalMoves / inCheck 的那层过滤做快一点。
// movegen.test.ts 会拿随机局面逐一比对，确保和 logic 的结论一模一样。
import {
  COLS,
  ROWS,
  type Board,
  type Move,
  type Piece,
  type Pos,
  type Side,
  crossedRiver,
  findKing,
  generalsFacing,
  idx,
  inBoard,
  other,
  rawMoves,
} from "./logic";

/** 九宫的三条横线（红在下、黑在上） */
const PALACE_ROWS: Record<Side, readonly number[]> = { red: [9, 8, 7], black: [0, 1, 2] };

/**
 * 找将帅。规则保证它只会在自己的九宫那九格里，所以先扫九格；
 * 万一没找到（测试里摆的怪局面）再退回 logic 的全盘扫描，结论保持一致。
 * 合法性检查每走一步就要问一次将帅在哪，这九格和九十格的差别很值钱。
 */
function kingPos(board: Board, side: Side): Pos | null {
  for (const y of PALACE_ROWS[side]) {
    for (let x = 3; x <= 5; x++) {
      const p = board[idx(x, y)];
      if (p && p.type === "K" && p.side === side) return { x, y };
    }
  }
  return findKing(board, side);
}

const RAY_DIRS: ReadonlyArray<readonly [number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** 八个马位：马落在哪、以及该看哪一格的马腿 */
const HORSE_SPOTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [1, 2, 1, 1], [-1, 2, -1, 1], [1, -2, 1, -1], [-1, -2, -1, -1],
  [2, 1, 1, 1], [2, -1, 1, -1], [-2, 1, -1, 1], [-2, -1, -1, -1],
];

/**
 * side 的将帅有没有被攻击。
 *
 * 只扫四条直线（车 / 炮）、八个马位与兵卒的三个方向：
 * 仕、相、将本身永远够不到对方的九宫，扫了反而会和 logic.inCheck 结论不一致。
 * 前提是双方将帅都待在自己的九宫里 —— 这也是规则允许的唯一情况。
 */
export function kingAttacked(board: Board, side: Side): boolean {
  const king = kingPos(board, side);
  if (!king) return true;
  return attackedAt(board, side, king.x, king.y);
}

/** 把「将帅在 (kx,ky)」这件事当已知条件问一遍：合法性检查里将帅的位置是算得出来的 */
function attackedAt(board: Board, side: Side, kx: number, ky: number): boolean {
  const enemy = other(side);

  // 车与炮：沿四个方向找第一个子（车）与第二个子（炮）
  for (const [dx, dy] of RAY_DIRS) {
    let x = kx + dx;
    let y = ky + dy;
    while (inBoard(x, y) && !board[idx(x, y)]) {
      x += dx;
      y += dy;
    }
    if (!inBoard(x, y)) continue;
    const first = board[idx(x, y)];
    if (first && first.side === enemy && first.type === "R") return true;
    // 越过炮架继续找第二个子
    x += dx;
    y += dy;
    while (inBoard(x, y) && !board[idx(x, y)]) {
      x += dx;
      y += dy;
    }
    if (!inBoard(x, y)) continue;
    const second = board[idx(x, y)];
    if (second && second.side === enemy && second.type === "C") return true;
  }

  // 马：八个可能的马位，各自看自己的马腿有没有被别住
  for (const [dx, dy, lx, ly] of HORSE_SPOTS) {
    const hx = kx + dx;
    const hy = ky + dy;
    if (!inBoard(hx, hy)) continue;
    const p = board[idx(hx, hy)];
    if (!p || p.side !== enemy || p.type !== "H") continue;
    // 马腿：从马位往将帅方向的那一格（等价于 rawMoves 里的 lx/ly 判断）
    if (board[idx(kx + lx, ky + ly)]) continue;
    return true;
  }

  // 兵卒：正面一格，以及过了河之后的左右两格
  const back = enemy === "red" ? 1 : -1; // 敌兵在将帅的哪一侧才能向前吃到它
  const fy = ky + back;
  if (inBoard(kx, fy)) {
    const p = board[idx(kx, fy)];
    if (p && p.side === enemy && p.type === "P") return true;
  }
  for (const dx of [-1, 1]) {
    const px = kx + dx;
    if (!inBoard(px, ky)) continue;
    const p = board[idx(px, ky)];
    if (p && p.side === enemy && p.type === "P" && crossedRiver(enemy, ky)) return true;
  }
  return false;
}

/** 就地走子，返回被吃掉的子（撤销时要还回去） */
export function makeMove(board: Board, m: Move): Piece | null {
  const from = idx(m.from.x, m.from.y);
  const to = idx(m.to.x, m.to.y);
  const captured = board[to];
  board[to] = board[from];
  board[from] = null;
  return captured;
}

/** 撤销 makeMove */
export function unmakeMove(board: Board, m: Move, captured: Piece | null): void {
  const from = idx(m.from.x, m.from.y);
  const to = idx(m.to.x, m.to.y);
  board[from] = board[to];
  board[to] = captured;
}

/**
 * 将帅照面没有（与 logic.generalsFacing 同语义）。
 * 同样先在九宫里找将帅，找不到才退回全盘扫描。
 */
export function facing(board: Board): boolean {
  const rk = kingPos(board, "red");
  const bk = kingPos(board, "black");
  if (!rk || !bk) return false;
  return facingAt(board, rk.x, rk.y, bk.x, bk.y);
}

function facingAt(board: Board, ax: number, ay: number, bx: number, by: number): boolean {
  if (ax !== bx) return false;
  const lo = Math.min(ay, by);
  const hi = Math.max(ay, by);
  for (let y = lo + 1; y < hi; y++) if (board[idx(ax, y)]) return false;
  return true;
}

/**
 * 逐个试探某个子的着法，合法的交给 `keep`；`keep` 返回 true 就提前收工。
 *
 * 合法性检查是整个搜索里跑得最多的一段，所以这里把两个将帅的位置先取出来：
 * 对方的将不会因为我走一步而挪窝，自己的将也只有「走的就是将」时才换位置，
 * 于是内层一次九宫扫描都不用做。唯一的例外是这一步正好吃到对方的将
 * （伪着法里会出现，合法棋里不会），那就退回通用的那条路，结论和 logic 一致。
 */
function tryMoves(board: Board, x: number, y: number, keep: (to: Pos) => boolean): void {
  const piece = board[idx(x, y)];
  if (!piece) return;
  const foe = other(piece.side);
  const my0 = kingPos(board, piece.side);
  const foeKing = kingPos(board, foe);
  const isKingMove = piece.type === "K";
  // 反复复用同一个对象，省掉每个伪着法一次分配
  const mv: Move = { from: { x, y }, to: { x: 0, y: 0 } };
  for (const to of rawMoves(board, x, y)) {
    mv.to = to;
    const captured = makeMove(board, mv);
    let bad: boolean;
    if (!my0 || !foeKing || (captured && captured.type === "K")) {
      bad = kingAttacked(board, piece.side) || facing(board);
    } else {
      const kx = isKingMove ? to.x : my0.x;
      const ky = isKingMove ? to.y : my0.y;
      bad = attackedAt(board, piece.side, kx, ky) || facingAt(board, kx, ky, foeKing.x, foeKing.y);
    }
    unmakeMove(board, mv, captured);
    if (!bad && keep(to)) return;
  }
}

/** 某个子的全部合法落点（与 logic.legalMoves 同语义，只是快一点） */
export function legalTargets(board: Board, x: number, y: number): Pos[] {
  const out: Pos[] = [];
  tryMoves(board, x, y, (to) => {
    out.push(to);
    return false;
  });
  return out;
}

/** 一方的全部合法着法（与 logic.allLegalMoves 同语义） */
export function genMoves(board: Board, side: Side): Move[] {
  const out: Move[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const p = board[idx(x, y)];
      if (!p || p.side !== side) continue;
      for (const to of legalTargets(board, x, y)) out.push({ from: { x, y }, to });
    }
  }
  return out;
}

/** 轮到 side 走棋时还有没有棋可走（比数着法快：找到一个就收工） */
export function hasLegalMove(board: Board, side: Side): boolean {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const p = board[idx(x, y)];
      if (!p || p.side !== side) continue;
      let any = false;
      tryMoves(board, x, y, () => {
        any = true;
        return true;
      });
      if (any) return true;
    }
  }
  return false;
}

const KEY_CHARS: Record<string, string> = {
  redK: "K", redA: "A", redE: "E", redH: "H", redR: "R", redC: "C", redP: "P",
  blackK: "k", blackA: "a", blackE: "e", blackH: "h", blackR: "r", blackC: "c", blackP: "p",
};

/**
 * 局面指纹：90 格 + 该谁走。
 * 置换表、重复局面与长将判负都用它，同一个局面轮到不同人走算两个指纹。
 */
export function positionKey(board: Board, turn: Side): string {
  let s = turn === "red" ? "r|" : "b|";
  let empty = 0;
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (!p) {
      empty++;
      continue;
    }
    if (empty > 0) {
      s += String(empty);
      empty = 0;
    }
    s += KEY_CHARS[p.side + p.type];
  }
  if (empty > 0) s += String(empty);
  return s;
}

/** 着法指纹（记谱去重、长将检测用） */
export function moveKey(m: Move): string {
  return `${m.from.x}${m.from.y}${m.to.x}${m.to.y}`;
}

export function sameMove(a: Move | null, b: Move | null): boolean {
  if (!a || !b) return false;
  return a.from.x === b.from.x && a.from.y === b.from.y && a.to.x === b.to.x && a.to.y === b.to.y;
}
