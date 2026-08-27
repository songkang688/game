// 中文纵线记谱 —— 「炮二平五」「马８进７」那一套，全是纯函数。
//
// 纵线怎么数：**各自从自己这一侧的右手边往左数**。
// 红方在下（y 大的一侧），它的右手边是 x=8，所以 x=8 是「一」、x=0 是「九」，用汉字；
// 黑方在上，它的右手边是 x=0，所以 x=0 是「1」、x=8 是「9」，用阿拉伯数字。
//
// 前进后退：走向对方是「进」，走回自己这边是「退」，同一横线上是「平」。
// 车 / 炮 / 兵 / 将 直着走，进退后面写**走了几格**；
// 马 / 相 / 士 斜着走，进退后面写**落到第几条纵线**。
import {
  type Board,
  type Move,
  type PieceType,
  type Side,
  COLS,
  ROWS,
  PIECE_NAME,
  idx,
} from "./logic";

const RED_DIGITS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 交叉点的 x 坐标 → 这一方眼里的纵线号（1..9） */
export function fileNumber(x: number, side: Side): number {
  return side === "red" ? COLS - x : x + 1;
}

/** 纵线号 / 步数写成这一方的写法：红用汉字，黑用阿拉伯数字 */
export function numeral(n: number, side: Side): string {
  const i = Math.max(1, Math.min(9, Math.round(n)));
  return side === "red" ? RED_DIGITS[i - 1] : String(i);
}

/** 斜着走的三种子：进退后面写的是纵线号而不是步数 */
const DIAGONAL: readonly PieceType[] = ["A", "E", "H"];

/** 同一纵线上本方同种子的 y 坐标，按「从前到后」排好（前 = 更靠近对方） */
export function sameFilePieces(board: Board, x: number, side: Side, type: PieceType): number[] {
  const ys: number[] = [];
  for (let y = 0; y < ROWS; y++) {
    const p = board[idx(x, y)];
    if (p && p.side === side && p.type === type) ys.push(y);
  }
  // 红方往上走（y 变小）算前，黑方往下走（y 变大）算前
  return side === "red" ? ys.sort((a, b) => a - b) : ys.sort((a, b) => b - a);
}

/** 一列上有好几个同种子时的「前 / 中 / 后」写法 */
export function stackWord(order: number, count: number, side: Side): string {
  if (count <= 1) return "";
  if (count === 2) return order === 0 ? "前" : "后";
  if (count === 3) return order === 0 ? "前" : order === 1 ? "中" : "后";
  // 四个以上（只可能是兵卒）：从前往后按数字数
  if (order === 0) return "前";
  if (order === count - 1) return "后";
  return numeral(order + 1, side);
}

/**
 * 一步棋的中文纵线记谱，例如「炮二平五」「前马进七」「卒７进１」。
 * 棋盘传的是**走之前**的局面。
 */
export function moveToChinese(board: Board, move: Move): string {
  const piece = board[idx(move.from.x, move.from.y)];
  if (!piece) return "";
  const side = piece.side;
  const name = PIECE_NAME[side][piece.type];

  const stack = sameFilePieces(board, move.from.x, side, piece.type);
  const order = stack.indexOf(move.from.y);
  const word = stack.length > 1 && order >= 0 ? stackWord(order, stack.length, side) : "";
  // 一列上有好几个同种子时不写起点纵线，改写「前 / 后」
  const head = word ? `${word}${name}` : `${name}${numeral(fileNumber(move.from.x, side), side)}`;

  if (move.from.y === move.to.y) {
    return `${head}平${numeral(fileNumber(move.to.x, side), side)}`;
  }
  const forward = side === "red" ? move.to.y < move.from.y : move.to.y > move.from.y;
  const verb = forward ? "进" : "退";
  const tail = DIAGONAL.includes(piece.type)
    ? numeral(fileNumber(move.to.x, side), side)
    : numeral(Math.abs(move.to.y - move.from.y), side);
  return `${head}${verb}${tail}`;
}

/** 复盘条上的一行：「3. 红 炮二平五」 */
export function recordLine(no: number, side: Side, text: string): string {
  return `${no}. ${side === "red" ? "红" : "黑"} ${text}`;
}

/**
 * 给小朋友的口语解说。吃子说成「请对方的子回家休息」——
 * 分级红线：无血无伤，不写「杀」「死」这类字眼（将死是术语，另外单独说）。
 */
export function friendlyLine(board: Board, move: Move): string {
  const piece = board[idx(move.from.x, move.from.y)];
  if (!piece) return "";
  const target = board[idx(move.to.x, move.to.y)];
  const who = piece.side === "red" ? "红" : "黑";
  const name = PIECE_NAME[piece.side][piece.type];
  const chinese = moveToChinese(board, move);
  if (target) {
    const tn = PIECE_NAME[target.side][target.type];
    return `${who}${name} ${chinese} —— 请${target.side === "red" ? "红" : "黑"}${tn}回家休息`;
  }
  return `${who}${name} ${chinese}`;
}
