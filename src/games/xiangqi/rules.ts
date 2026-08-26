// 规则层 —— 全是纯函数，一行 DOM 都不碰：
//  · 对局记录（每一步的着法、是不是将军、走完之后的局面指纹）；
//  · **禁止单方面长将**：同一将军着法把同一个局面走出第三次，判走方负；
//  · 重复局面三次判和（简化版：不区分捉子与闲着，只认「同一局面、同一方走」）；
//  · 走不了的棋要能说出原因（马腿被别住 / 象眼被塞住 / 将帅不能照面……）。
//
// 走法本身仍旧由 logic.ts 生成，这里只在它之上做判定。
import {
  type Board,
  type Move,
  type Pos,
  type Side,
  PIECE_NAME,
  crossedRiver,
  generalsFacing,
  idx,
  inBoard,
  inPalace,
  other,
  rawMoves,
} from "./logic";
import { kingAttacked, moveKey, positionKey } from "./movegen";

/* ------------------------------------------------------------------ */
/* 对局记录                                                            */
/* ------------------------------------------------------------------ */

export interface RecordEntry {
  /** 谁走的 */
  side: Side;
  move: Move;
  /** 这一步是不是将军 */
  check: boolean;
  /** 走完之后的局面指纹（含轮到谁走） */
  key: string;
  /** 中文纵线记谱，界面复盘条直接显示 */
  text: string;
}

export type VerdictKind = "none" | "perpetual" | "repetition";

export interface Verdict {
  kind: VerdictKind;
  /** 长将判负时是哪一方输（重复局面判和时为 null） */
  loser: Side | null;
  /** 给孩子看的一句话 */
  text: string;
}

export const NO_VERDICT: Verdict = { kind: "none", loser: null, text: "" };

/** 长将 / 重复局面各自要出现几次才作数 */
export const REPEAT_LIMIT = 3;

/**
 * 一方连着将军、并且把同一个局面走出了第三次 —— 判这一方负。
 *
 * 判据（对应竞赛规则里「禁止单方面长将」的简化版）：
 * 从最后一步往回数，只要走方每一步都在将军，就算作一段「连将」；
 * 这段连将里同一个局面指纹出现 `REPEAT_LIMIT` 次，走方负。
 */
export function perpetualCheckLoser(entries: readonly RecordEntry[]): Side | null {
  const last = entries[entries.length - 1];
  if (!last || !last.check) return null;
  const side = last.side;
  let seen = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.side !== side) continue;
    // 连将一断就不再往回数
    if (!e.check) break;
    if (e.key === last.key) seen++;
  }
  return seen >= REPEAT_LIMIT ? side : null;
}

/** 同一个局面（含轮到谁走）出现了几次：开局局面也算一次 */
export function repetitionCount(startKey: string, entries: readonly RecordEntry[]): number {
  const last = entries[entries.length - 1];
  const key = last ? last.key : startKey;
  let n = startKey === key ? 1 : 0;
  for (const e of entries) if (e.key === key) n++;
  return n;
}

/**
 * 走完最后一步之后该怎么判。长将优先于重复局面：
 * 一直将军把局面走回去三次的是「输」，不是「和」。
 */
export function judgeRecord(startKey: string, entries: readonly RecordEntry[]): Verdict {
  const loser = perpetualCheckLoser(entries);
  if (loser) {
    return {
      kind: "perpetual",
      loser,
      text: `${loser === "red" ? "红方" : "黑方"}一直用同一招将军，同一个局面出现三次啦 —— 长将判负，换一条进攻路线试试。`,
    };
  }
  if (repetitionCount(startKey, entries) >= REPEAT_LIMIT) {
    return {
      kind: "repetition",
      loser: null,
      text: "同一个局面来回走了三次，这一局算和棋。想赢就得先换个走法。",
    };
  }
  return NO_VERDICT;
}

/** 走一步之后，这一步是不是将了对方的军 */
export function moveGivesCheck(board: Board, move: Move, mover: Side): boolean {
  const next = board.slice();
  next[idx(move.to.x, move.to.y)] = next[idx(move.from.x, move.from.y)];
  next[idx(move.from.x, move.from.y)] = null;
  return kingAttacked(next, other(mover));
}

/** 把一步棋记进对局记录（不改原数组，返回新的） */
export function pushRecord(
  entries: readonly RecordEntry[],
  board: Board,
  move: Move,
  mover: Side,
  text: string,
): RecordEntry[] {
  const next = board.slice();
  next[idx(move.to.x, move.to.y)] = next[idx(move.from.x, move.from.y)];
  next[idx(move.from.x, move.from.y)] = null;
  return [
    ...entries,
    {
      side: mover,
      move,
      check: kingAttacked(next, other(mover)),
      key: positionKey(next, other(mover)),
      text,
    },
  ];
}

/** 一方最近连着将了几步（界面用来提前提醒「别老是将军」） */
export function checkStreak(entries: readonly RecordEntry[], side: Side): number {
  let n = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.side !== side) continue;
    if (!e.check) break;
    n++;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* 走不了的时候，说清楚为什么                                          */
/* ------------------------------------------------------------------ */

export type IllegalKind =
  | "empty"
  | "notYours"
  | "own"
  | "palace"
  | "diagonal"
  | "river"
  | "eye"
  | "leg"
  | "blocked"
  | "screen"
  | "backward"
  | "shape"
  | "facing"
  | "selfCheck";

export interface IllegalReason {
  kind: IllegalKind;
  text: string;
}

function has(list: Pos[], x: number, y: number): boolean {
  return list.some((p) => p.x === x && p.y === y);
}

/** 两点之间（同一直线上）夹着几个子 */
function between(board: Board, a: Pos, b: Pos): number {
  if (a.x !== b.x && a.y !== b.y) return -1;
  const dx = Math.sign(b.x - a.x);
  const dy = Math.sign(b.y - a.y);
  let n = 0;
  let x = a.x + dx;
  let y = a.y + dy;
  while (x !== b.x || y !== b.y) {
    if (board[idx(x, y)]) n++;
    x += dx;
    y += dy;
  }
  return n;
}

/**
 * 这一步为什么走不了 —— 合法就返回 null。
 * 每一句都用孩子能懂的说法，而且必须说中真正的原因，不能一句「不行」了事。
 */
export function illegalReason(board: Board, from: Pos, to: Pos, mover: Side): IllegalReason | null {
  if (!inBoard(from.x, from.y) || !inBoard(to.x, to.y)) {
    return { kind: "shape", text: "点到棋盘外面啦，再点一次交叉点。" };
  }
  const piece = board[idx(from.x, from.y)];
  if (!piece) return { kind: "empty", text: "这个交叉点上没有棋子哦。" };
  if (piece.side !== mover) {
    return { kind: "notYours", text: "这是对方的棋子，先点自己的子。" };
  }
  const target = board[idx(to.x, to.y)];
  if (target && target.side === mover) {
    return { kind: "own", text: "那里站着自己人，换一个落点吧。" };
  }

  const name = PIECE_NAME[piece.side][piece.type];
  const raw = rawMoves(board, from.x, from.y);
  if (!has(raw, to.x, to.y)) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    switch (piece.type) {
      case "K":
        if (!inPalace(mover, to.x, to.y)) {
          return { kind: "palace", text: `${name}只能待在九宫格里走。` };
        }
        return { kind: "shape", text: `${name}一次只能直着走一格。` };
      case "A":
        if (!inPalace(mover, to.x, to.y)) {
          return { kind: "palace", text: `${name}不能走出九宫格。` };
        }
        return { kind: "diagonal", text: `${name}只能斜着走一格。` };
      case "E":
        if (adx === 2 && ady === 2) {
          if (crossedRiver(mover, to.y)) {
            return { kind: "river", text: `${name}不能过河，河那边去不了。` };
          }
          if (board[idx(from.x + dx / 2, from.y + dy / 2)]) {
            return { kind: "eye", text: "象眼被塞住啦，这个方向走不了。" };
          }
        }
        return { kind: "shape", text: `${name}走「田」字，斜着跨两格。` };
      case "H": {
        const isJump = (adx === 1 && ady === 2) || (adx === 2 && ady === 1);
        if (isJump) {
          const lx = adx === 2 ? from.x + Math.sign(dx) : from.x;
          const ly = ady === 2 ? from.y + Math.sign(dy) : from.y;
          if (board[idx(lx, ly)]) {
            return { kind: "leg", text: "马腿被别住啦，换个方向跳。" };
          }
        }
        return { kind: "shape", text: "马走「日」字，一直一斜。" };
      }
      case "R":
        if (dx === 0 || dy === 0) {
          return { kind: "blocked", text: "路上有子挡着，车不能跳过去。" };
        }
        return { kind: "shape", text: "车只能横着或竖着走直线。" };
      case "C":
        if (dx === 0 || dy === 0) {
          const cnt = between(board, from, to);
          if (target) {
            if (cnt === 0) return { kind: "screen", text: "炮要隔着一个「炮架」才能吃子。" };
            return { kind: "screen", text: "炮架只能有一个，中间的子太多啦。" };
          }
          return { kind: "blocked", text: "炮不吃子的时候和车一样，路上不能有子。" };
        }
        return { kind: "shape", text: "炮只能横着或竖着走直线。" };
      default: {
        const back = mover === "red" ? dy > 0 : dy < 0;
        if (back) return { kind: "backward", text: `${name}只能往前走，不能后退。` };
        if (dy === 0 && adx >= 1 && !crossedRiver(mover, from.y)) {
          return { kind: "river", text: `${name}过了河才能横着走。` };
        }
        return { kind: "shape", text: `${name}一次只能走一格。` };
      }
    }
  }

  // 兵种规则过了，剩下的两条是「走完之后不许出现的局面」
  const next = board.slice();
  next[idx(to.x, to.y)] = next[idx(from.x, from.y)];
  next[idx(from.x, from.y)] = null;
  if (generalsFacing(next)) {
    return { kind: "facing", text: "将帅不能照面哦，这样走两个大王就对上眼了。" };
  }
  if (kingAttacked(next, mover)) {
    return { kind: "selfCheck", text: "这样走自己的将帅会被将军，换一步吧。" };
  }
  return null;
}

/** 被将军的时候，能怎么应：垫 / 吃 / 逃（给提示面板用） */
export type EscapeKind = "move" | "block" | "capture";

export function escapeKinds(board: Board, side: Side, moves: readonly Move[]): EscapeKind[] {
  const king = (() => {
    for (let y = 0; y < 10; y++) {
      for (let x = 3; x <= 5; x++) {
        const p = board[idx(x, y)];
        if (p && p.type === "K" && p.side === side) return { x, y };
      }
    }
    return null;
  })();
  const kinds = new Set<EscapeKind>();
  for (const m of moves) {
    if (king && m.from.x === king.x && m.from.y === king.y) kinds.add("move");
    else if (board[idx(m.to.x, m.to.y)]) kinds.add("capture");
    else kinds.add("block");
  }
  return Array.from(kinds);
}
