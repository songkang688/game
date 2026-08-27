/**
 * 花园国际象棋 · 局面表示与 FEN 读写。
 *
 * 棋盘是长度 64 的 Int8Array，下标 `sq = rank * 8 + file`：
 * 0 = a1、7 = h1、56 = a8、63 = h8。白子取正、黑子取负，绝对值就是兵种。
 * 这样「翻面」只要取负，评估函数与走法生成都能少写一半分支。
 *
 * 本文件只管数据，不生成走法（那是 moves.ts 的事），也不判胜负（rules.ts）。
 */

/** 兵种编码（取绝对值后） */
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export type PieceType = 1 | 2 | 3 | 4 | 5 | 6;
/** 1 = 白（鸭梨），-1 = 黑（康康） */
export type Color = 1 | -1;

export const WHITE: Color = 1;
export const BLACK: Color = -1;

/** 易位权掩码：白短、白长、黑短、黑长 */
export const CASTLE_WK = 1;
export const CASTLE_WQ = 2;
export const CASTLE_BK = 4;
export const CASTLE_BQ = 8;

/** 六种棋子的中文名（界面与记谱都用它，六种一眼可区分） */
export const PIECE_CN: Record<PieceType, string> = {
  1: "兵",
  2: "马",
  3: "象",
  4: "车",
  5: "后",
  6: "王",
};

/** 六种棋子的记谱字母（`toSan` 用；兵不写字母） */
export const PIECE_SAN: Record<PieceType, string> = {
  1: "",
  2: "N",
  3: "B",
  4: "R",
  5: "Q",
  6: "K",
};

/** FEN 字符 → 兵种 */
const FEN_TO_TYPE: Record<string, PieceType> = {
  p: PAWN,
  n: KNIGHT,
  b: BISHOP,
  r: ROOK,
  q: QUEEN,
  k: KING,
};

const TYPE_TO_FEN: Record<PieceType, string> = {
  1: "p",
  2: "n",
  3: "b",
  4: "r",
  5: "q",
  6: "k",
};

export interface Position {
  /** 64 格，0 表示空 */
  board: Int8Array;
  /** 轮到谁走 */
  turn: Color;
  /** 易位权掩码 */
  castling: number;
  /** 过路兵的目标格（可以落子的那一格），没有就是 -1 */
  ep: number;
  /** 50 回合规则用的半回合计数 */
  halfmove: number;
  /** 回合数，从 1 起 */
  fullmove: number;
}

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function fileOf(sq: number): number {
  return sq & 7;
}

export function rankOf(sq: number): number {
  return sq >> 3;
}

export function squareAt(file: number, rank: number): number {
  return rank * 8 + file;
}

export function onBoard(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

/** 格子名，例如 27 → "d4" */
export function squareName(sq: number): string {
  return `${"abcdefgh"[fileOf(sq)]}${rankOf(sq) + 1}`;
}

/** "d4" → 27；认不出来返回 -1 */
export function parseSquare(name: string): number {
  if (typeof name !== "string" || name.length < 2) return -1;
  const f = "abcdefgh".indexOf(name[0].toLowerCase());
  const r = Number(name[1]) - 1;
  if (f < 0 || !Number.isInteger(r) || r < 0 || r > 7) return -1;
  return squareAt(f, r);
}

/** 格子颜色：true 表示浅色格（a1 是深色格） */
export function isLightSquare(sq: number): boolean {
  return (fileOf(sq) + rankOf(sq)) % 2 === 1;
}

export function colorOf(piece: number): Color | 0 {
  if (piece > 0) return WHITE;
  if (piece < 0) return BLACK;
  return 0;
}

export function typeOf(piece: number): PieceType | 0 {
  const t = Math.abs(piece);
  return t === 0 ? 0 : (t as PieceType);
}

export function emptyPosition(): Position {
  return {
    board: new Int8Array(64),
    turn: WHITE,
    castling: 0,
    ep: -1,
    halfmove: 0,
    fullmove: 1,
  };
}

export function clonePosition(pos: Position): Position {
  return {
    board: Int8Array.from(pos.board),
    turn: pos.turn,
    castling: pos.castling,
    ep: pos.ep,
    halfmove: pos.halfmove,
    fullmove: pos.fullmove,
  };
}

/**
 * 读 FEN。字段不全时按常见缺省补：轮走方缺省白、易位权缺省无、过路格缺省无。
 * FEN 本身写坏了会抛错，调用方（关卡数据）在单测里就会被拦下。
 */
export function fromFen(fen: string): Position {
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0].split("/");
  if (rows.length !== 8) throw new Error(`FEN 的棋盘应该有 8 行，实际 ${rows.length} 行：${fen}`);
  const pos = emptyPosition();
  for (let r = 0; r < 8; r++) {
    // FEN 第一行是第 8 横线
    const rank = 7 - r;
    let file = 0;
    for (const ch of rows[r]) {
      if (ch >= "1" && ch <= "8") {
        file += Number(ch);
        continue;
      }
      const type = FEN_TO_TYPE[ch.toLowerCase()];
      if (!type) throw new Error(`FEN 里出现了不认识的棋子「${ch}」：${fen}`);
      if (file > 7) throw new Error(`FEN 第 ${r + 1} 行放不下这么多子：${fen}`);
      pos.board[squareAt(file, rank)] = ch === ch.toUpperCase() ? type : -type;
      file++;
    }
  }
  pos.turn = parts[1] === "b" ? BLACK : WHITE;
  const rights = parts[2] ?? "-";
  if (rights.includes("K")) pos.castling |= CASTLE_WK;
  if (rights.includes("Q")) pos.castling |= CASTLE_WQ;
  if (rights.includes("k")) pos.castling |= CASTLE_BK;
  if (rights.includes("q")) pos.castling |= CASTLE_BQ;
  pos.ep = parts[3] && parts[3] !== "-" ? parseSquare(parts[3]) : -1;
  pos.halfmove = Number.isFinite(Number(parts[4])) ? Math.max(0, Number(parts[4])) : 0;
  pos.fullmove = Number.isFinite(Number(parts[5])) ? Math.max(1, Number(parts[5])) : 1;
  return pos;
}

export function toFen(pos: Position): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = "";
    let gap = 0;
    for (let file = 0; file < 8; file++) {
      const p = pos.board[squareAt(file, rank)];
      if (p === 0) {
        gap++;
        continue;
      }
      if (gap > 0) {
        row += String(gap);
        gap = 0;
      }
      const letter = TYPE_TO_FEN[typeOf(p) as PieceType];
      row += p > 0 ? letter.toUpperCase() : letter;
    }
    if (gap > 0) row += String(gap);
    rows.push(row);
  }
  let rights = "";
  if (pos.castling & CASTLE_WK) rights += "K";
  if (pos.castling & CASTLE_WQ) rights += "Q";
  if (pos.castling & CASTLE_BK) rights += "k";
  if (pos.castling & CASTLE_BQ) rights += "q";
  return [
    rows.join("/"),
    pos.turn === WHITE ? "w" : "b",
    rights === "" ? "-" : rights,
    pos.ep >= 0 ? squareName(pos.ep) : "-",
    String(pos.halfmove),
    String(pos.fullmove),
  ].join(" ");
}

export function startPosition(): Position {
  return fromFen(START_FEN);
}

/** 找王；没有王返回 -1（残局题目里双方都必须有王，单测会查） */
export function kingSquare(pos: Position, color: Color): number {
  const want = color * KING;
  for (let sq = 0; sq < 64; sq++) {
    if (pos.board[sq] === want) return sq;
  }
  return -1;
}

/** 数某一方某个兵种还剩几个 */
export function countPiece(pos: Position, color: Color, type: PieceType): number {
  const want = color * type;
  let n = 0;
  for (let sq = 0; sq < 64; sq++) if (pos.board[sq] === want) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Zobrist 哈希（三次重复判和用）
// ---------------------------------------------------------------------------

/** 和 level99 同款的确定性随机；这里只在模块加载时用一次，生成固定的哈希表 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 32 位一段、两段拼成 64 位。JS 的按位运算只有 32 位，
 * 所以高低位各存一份，异或时两段分别异或。
 */
interface ZPair {
  hi: number;
  lo: number;
}

function buildTable(rand: () => number, n: number): ZPair[] {
  const out: ZPair[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ hi: (rand() * 0x100000000) >>> 0, lo: (rand() * 0x100000000) >>> 0 });
  }
  return out;
}

const zrand = mulberry32(0x9e3779b9);
/** [兵种 0..5][颜色 0 白 1 黑][格子 0..63] */
const Z_PIECES: ZPair[] = buildTable(zrand, 6 * 2 * 64);
const Z_CASTLING: ZPair[] = buildTable(zrand, 16);
const Z_EP_FILE: ZPair[] = buildTable(zrand, 8);
const Z_TURN: ZPair = buildTable(zrand, 1)[0];

/**
 * 局面哈希：**含轮走方、易位权与过路格**（规格明确要求），
 * 所以「同样的子力摆放但轮到对方走」不会被误判成重复局面。
 * 返回十六进制字符串，直接拿来当 Map 的 key。
 */
export function zobrist(pos: Position): string {
  let hi = 0;
  let lo = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = pos.board[sq];
    if (p === 0) continue;
    const type = Math.abs(p) - 1;
    const side = p > 0 ? 0 : 1;
    const z = Z_PIECES[(type * 2 + side) * 64 + sq];
    hi ^= z.hi;
    lo ^= z.lo;
  }
  const zc = Z_CASTLING[pos.castling & 15];
  hi ^= zc.hi;
  lo ^= zc.lo;
  if (pos.ep >= 0) {
    const ze = Z_EP_FILE[fileOf(pos.ep)];
    hi ^= ze.hi;
    lo ^= ze.lo;
  }
  if (pos.turn === BLACK) {
    hi ^= Z_TURN.hi;
    lo ^= Z_TURN.lo;
  }
  return `${(hi >>> 0).toString(16).padStart(8, "0")}${(lo >>> 0).toString(16).padStart(8, "0")}`;
}
