/**
 * 花园国际象棋 · 局面表示与 FEN。
 *
 * 棋盘用一个长度 64 的数组，下标 0 是 a8、下标 63 是 h1（和 FEN 的书写顺序一致）。
 * 这一层只管「局面长什么样、怎么读写」，走法和规则在 `rules.ts`。
 */

export type Color = "w" | "b";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export interface Piece {
  color: Color;
  type: PieceType;
}

export type Square = number;

export const FILES = "abcdefgh";
export const RANKS = "87654321";

export interface Castling {
  wk: boolean;
  wq: boolean;
  bk: boolean;
  bq: boolean;
}

export interface Position {
  board: Array<Piece | null>;
  turn: Color;
  castling: Castling;
  /** 过路兵的目标格（对方兵刚走两格越过的那一格），没有就是 null */
  ep: Square | null;
  /** 50 回合规则用的半回合计数 */
  halfmove: number;
  fullmove: number;
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function fileOf(sq: Square): number {
  return sq % 8;
}

export function rankOf(sq: Square): number {
  return Math.floor(sq / 8);
}

export function squareOf(file: number, rank: number): Square {
  return rank * 8 + file;
}

export function onBoard(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

/** 「e4」这样的坐标 → 下标 */
export function parseSquare(name: string): Square {
  const f = FILES.indexOf(name[0]);
  const r = RANKS.indexOf(name[1]);
  if (f < 0 || r < 0) throw new Error(`看不懂的坐标：${name}`);
  return squareOf(f, r);
}

/** 下标 → 「e4」 */
export function squareName(sq: Square): string {
  return `${FILES[fileOf(sq)]}${RANKS[rankOf(sq)]}`;
}

export function other(c: Color): Color {
  return c === "w" ? "b" : "w";
}

const FEN_PIECES: Record<string, Piece> = {
  p: { color: "b", type: "p" },
  n: { color: "b", type: "n" },
  b: { color: "b", type: "b" },
  r: { color: "b", type: "r" },
  q: { color: "b", type: "q" },
  k: { color: "b", type: "k" },
  P: { color: "w", type: "p" },
  N: { color: "w", type: "n" },
  B: { color: "w", type: "b" },
  R: { color: "w", type: "r" },
  Q: { color: "w", type: "q" },
  K: { color: "w", type: "k" },
};

export function pieceChar(p: Piece): string {
  return p.color === "w" ? p.type.toUpperCase() : p.type;
}

export function parseFen(fen: string): Position {
  const parts = fen.trim().split(/\s+/);
  const board: Array<Piece | null> = new Array(64).fill(null);
  let sq = 0;
  for (const ch of parts[0]) {
    if (ch === "/") continue;
    if (ch >= "1" && ch <= "8") {
      sq += Number(ch);
      continue;
    }
    const p = FEN_PIECES[ch];
    if (!p) throw new Error(`看不懂的 FEN 字符：${ch}`);
    board[sq++] = { ...p };
  }
  const rights = parts[2] ?? "-";
  return {
    board,
    turn: (parts[1] as Color) ?? "w",
    castling: {
      wk: rights.includes("K"),
      wq: rights.includes("Q"),
      bk: rights.includes("k"),
      bq: rights.includes("q"),
    },
    ep: parts[3] && parts[3] !== "-" ? parseSquare(parts[3]) : null,
    halfmove: Number(parts[4] ?? 0),
    fullmove: Number(parts[5] ?? 1),
  };
}

export function toFen(pos: Position): string {
  let out = "";
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.board[squareOf(f, r)];
      if (!p) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        out += String(empty);
        empty = 0;
      }
      out += pieceChar(p);
    }
    if (empty > 0) out += String(empty);
    if (r < 7) out += "/";
  }
  const c = pos.castling;
  const rights = `${c.wk ? "K" : ""}${c.wq ? "Q" : ""}${c.bk ? "k" : ""}${c.bq ? "q" : ""}` || "-";
  return `${out} ${pos.turn} ${rights} ${pos.ep === null ? "-" : squareName(pos.ep)} ${pos.halfmove} ${pos.fullmove}`;
}

export function startPosition(): Position {
  return parseFen(START_FEN);
}

export function clonePosition(pos: Position): Position {
  return {
    board: pos.board.map((p) => (p ? { ...p } : null)),
    turn: pos.turn,
    castling: { ...pos.castling },
    ep: pos.ep,
    halfmove: pos.halfmove,
    fullmove: pos.fullmove,
  };
}

export function findKing(pos: Position, color: Color): Square {
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (p && p.type === "k" && p.color === color) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Zobrist 哈希：三次重复局面要靠它，所以轮走方、易位权、过路格都要算进去
// ---------------------------------------------------------------------------

function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2545f491) + 0x9e3779b9) >>> 0;
    return s;
  };
}

const ZOB = (() => {
  const rnd = prng(0x1a2b3c4d);
  const pieces: number[][] = [];
  for (let i = 0; i < 12; i++) {
    const row: number[] = [];
    for (let s = 0; s < 64; s++) row.push(rnd());
    pieces.push(row);
  }
  const castling: number[] = [rnd(), rnd(), rnd(), rnd()];
  const epFile: number[] = [];
  for (let f = 0; f < 8; f++) epFile.push(rnd());
  return { pieces, castling, epFile, turn: rnd() };
})();

const PIECE_INDEX: Record<string, number> = {
  wp: 0,
  wn: 1,
  wb: 2,
  wr: 3,
  wq: 4,
  wk: 5,
  bp: 6,
  bn: 7,
  bb: 8,
  br: 9,
  bq: 10,
  bk: 11,
};

/** 局面哈希（32 位无符号）。同一个局面一定得到同一个值 */
export function zobrist(pos: Position): number {
  let h = 0;
  for (let s = 0; s < 64; s++) {
    const p = pos.board[s];
    if (!p) continue;
    h = (h ^ ZOB.pieces[PIECE_INDEX[`${p.color}${p.type}`]][s]) >>> 0;
  }
  if (pos.castling.wk) h = (h ^ ZOB.castling[0]) >>> 0;
  if (pos.castling.wq) h = (h ^ ZOB.castling[1]) >>> 0;
  if (pos.castling.bk) h = (h ^ ZOB.castling[2]) >>> 0;
  if (pos.castling.bq) h = (h ^ ZOB.castling[3]) >>> 0;
  if (pos.ep !== null) h = (h ^ ZOB.epFile[fileOf(pos.ep)]) >>> 0;
  if (pos.turn === "b") h = (h ^ ZOB.turn) >>> 0;
  return h >>> 0;
}
