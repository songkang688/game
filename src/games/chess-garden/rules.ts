/**
 * 花园国际象棋 · 走法生成与胜负判定（自己写，不接任何走法库或引擎）。
 *
 * 关键规则一条都没落下：兵首步两格、斜吃、吃过路兵（只在下一手有效）、
 * 长短易位的四种失败情形、升变四选一、将杀、逼和、50 回合、三次重复、子力不足。
 */
import {
  clonePosition,
  fileOf,
  findKing,
  other,
  rankOf,
  squareName,
  squareOf,
  zobrist,
  type Color,
  type PieceType,
  type Position,
  type Square,
} from "./board";

export interface Move {
  from: Square;
  to: Square;
  /** 升变成什么 */
  promo?: Exclude<PieceType, "p" | "k">;
  /** 这一手把谁请去休息了 */
  capture?: PieceType;
  /** 吃过路兵 */
  ep?: boolean;
  /** 王车易位：k 是短易位，q 是长易位 */
  castle?: "k" | "q";
  /** 兵首步走两格 */
  double?: boolean;
}

const KNIGHT_DELTAS: Array<[number, number]> = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

const KING_DELTAS: Array<[number, number]> = [
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
];

const ROOK_DIRS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

const BISHOP_DIRS: Array<[number, number]> = [
  [1, 1],
  [1, -1],
  [-1, -1],
  [-1, 1],
];

/** 白兵往「上」走，也就是 rank 下标变小 */
function pawnDir(color: Color): number {
  return color === "w" ? -1 : 1;
}

function homeRank(color: Color): number {
  return color === "w" ? 6 : 1;
}

function promoRank(color: Color): number {
  return color === "w" ? 0 : 7;
}

const PROMO_CHOICES: Array<Exclude<PieceType, "p" | "k">> = ["q", "r", "b", "n"];

/** 这一格有没有被某一方攻击到（易位与将军判断都用它） */
export function attacked(pos: Position, sq: Square, by: Color): boolean {
  const f = fileOf(sq);
  const r = rankOf(sq);

  // 兵：从 by 方的角度看，兵是往 pawnDir(by) 走的，所以攻击者在反方向
  const pd = pawnDir(by);
  for (const df of [-1, 1]) {
    const af = f + df;
    const ar = r - pd;
    if (af < 0 || af > 7 || ar < 0 || ar > 7) continue;
    const p = pos.board[squareOf(af, ar)];
    if (p && p.color === by && p.type === "p") return true;
  }

  for (const [df, dr] of KNIGHT_DELTAS) {
    const af = f + df;
    const ar = r + dr;
    if (af < 0 || af > 7 || ar < 0 || ar > 7) continue;
    const p = pos.board[squareOf(af, ar)];
    if (p && p.color === by && p.type === "n") return true;
  }

  for (const [df, dr] of KING_DELTAS) {
    const af = f + df;
    const ar = r + dr;
    if (af < 0 || af > 7 || ar < 0 || ar > 7) continue;
    const p = pos.board[squareOf(af, ar)];
    if (p && p.color === by && p.type === "k") return true;
  }

  for (const dirs of [ROOK_DIRS, BISHOP_DIRS]) {
    const sliding: PieceType = dirs === ROOK_DIRS ? "r" : "b";
    for (const [df, dr] of dirs) {
      let af = f + df;
      let ar = r + dr;
      while (af >= 0 && af < 8 && ar >= 0 && ar < 8) {
        const p = pos.board[squareOf(af, ar)];
        if (p) {
          if (p.color === by && (p.type === sliding || p.type === "q")) return true;
          break;
        }
        af += df;
        ar += dr;
      }
    }
  }
  return false;
}

export function inCheck(pos: Position, color: Color = pos.turn): boolean {
  const k = findKing(pos, color);
  if (k < 0) return false;
  return attacked(pos, k, other(color));
}

/** 某一格上的子的伪合法走法（还没过滤「走完自己被将」） */
export function pseudoMoves(pos: Position, from: Square): Move[] {
  const p = pos.board[from];
  if (!p || p.color !== pos.turn) return [];
  const out: Move[] = [];
  const f = fileOf(from);
  const r = rankOf(from);
  const me = p.color;

  const push = (to: Square, extra: Partial<Move> = {}): void => {
    const t = pos.board[to];
    out.push({ from, to, ...(t ? { capture: t.type } : {}), ...extra });
  };

  if (p.type === "p") {
    const d = pawnDir(me);
    const one = squareOf(f, r + d);
    if (r + d >= 0 && r + d < 8 && !pos.board[one]) {
      if (r + d === promoRank(me)) {
        for (const q of PROMO_CHOICES) out.push({ from, to: one, promo: q });
      } else {
        out.push({ from, to: one });
        if (r === homeRank(me)) {
          const two = squareOf(f, r + 2 * d);
          if (!pos.board[two]) out.push({ from, to: two, double: true });
        }
      }
    }
    for (const df of [-1, 1]) {
      const cf = f + df;
      const cr = r + d;
      if (cf < 0 || cf > 7 || cr < 0 || cr > 7) continue;
      const to = squareOf(cf, cr);
      const t = pos.board[to];
      if (t && t.color !== me) {
        if (cr === promoRank(me)) {
          for (const q of PROMO_CHOICES) out.push({ from, to, promo: q, capture: t.type });
        } else {
          out.push({ from, to, capture: t.type });
        }
        continue;
      }
      // 吃过路兵：只有对方兵上一手刚走两格才有这一格
      if (!t && pos.ep === to) out.push({ from, to, capture: "p", ep: true });
    }
    return out;
  }

  if (p.type === "n") {
    for (const [df, dr] of KNIGHT_DELTAS) {
      const af = f + df;
      const ar = r + dr;
      if (af < 0 || af > 7 || ar < 0 || ar > 7) continue;
      const to = squareOf(af, ar);
      const t = pos.board[to];
      if (t && t.color === me) continue;
      push(to);
    }
    return out;
  }

  if (p.type === "k") {
    for (const [df, dr] of KING_DELTAS) {
      const af = f + df;
      const ar = r + dr;
      if (af < 0 || af > 7 || ar < 0 || ar > 7) continue;
      const to = squareOf(af, ar);
      const t = pos.board[to];
      if (t && t.color === me) continue;
      push(to);
    }
    for (const side of ["k", "q"] as const) {
      if (canCastle(pos, me, side)) {
        const rank = me === "w" ? 7 : 0;
        out.push({ from, to: squareOf(side === "k" ? 6 : 2, rank), castle: side });
      }
    }
    return out;
  }

  const dirs = p.type === "r" ? ROOK_DIRS : p.type === "b" ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
  for (const [df, dr] of dirs) {
    let af = f + df;
    let ar = r + dr;
    while (af >= 0 && af < 8 && ar >= 0 && ar < 8) {
      const to = squareOf(af, ar);
      const t = pos.board[to];
      if (t && t.color === me) break;
      push(to);
      if (t) break;
      af += df;
      ar += dr;
    }
  }
  return out;
}

/** 王车易位的四道关：王或车动过、中间有子、起点 / 经过格 / 落点被攻击 */
export function canCastle(pos: Position, color: Color, side: "k" | "q"): boolean {
  const rights = pos.castling;
  const ok = color === "w" ? (side === "k" ? rights.wk : rights.wq) : side === "k" ? rights.bk : rights.bq;
  if (!ok) return false;
  const rank = color === "w" ? 7 : 0;
  const kingSq = squareOf(4, rank);
  const k = pos.board[kingSq];
  if (!k || k.type !== "k" || k.color !== color) return false;
  const rookSq = squareOf(side === "k" ? 7 : 0, rank);
  const rook = pos.board[rookSq];
  if (!rook || rook.type !== "r" || rook.color !== color) return false;

  const emptyFiles = side === "k" ? [5, 6] : [1, 2, 3];
  for (const f of emptyFiles) {
    if (pos.board[squareOf(f, rank)]) return false;
  }
  const foe = other(color);
  const walk = side === "k" ? [4, 5, 6] : [4, 3, 2];
  for (const f of walk) {
    if (attacked(pos, squareOf(f, rank), foe)) return false;
  }
  return true;
}

/** 走一手，返回新局面（不改原局面） */
export function makeMove(pos: Position, m: Move): Position {
  const next = clonePosition(pos);
  const p = next.board[m.from];
  if (!p) return next;
  const me = p.color;

  next.board[m.to] = m.promo ? { color: me, type: m.promo } : p;
  next.board[m.from] = null;

  if (m.ep) {
    const capRank = rankOf(m.to) + (me === "w" ? 1 : -1);
    next.board[squareOf(fileOf(m.to), capRank)] = null;
  }

  if (m.castle) {
    const rank = me === "w" ? 7 : 0;
    if (m.castle === "k") {
      next.board[squareOf(5, rank)] = next.board[squareOf(7, rank)];
      next.board[squareOf(7, rank)] = null;
    } else {
      next.board[squareOf(3, rank)] = next.board[squareOf(0, rank)];
      next.board[squareOf(0, rank)] = null;
    }
  }

  // 易位权：王动过、车动过、车被吃掉，三种都要收回
  if (p.type === "k") {
    if (me === "w") {
      next.castling.wk = false;
      next.castling.wq = false;
    } else {
      next.castling.bk = false;
      next.castling.bq = false;
    }
  }
  const clearRook = (sq: Square): void => {
    if (sq === squareOf(7, 7)) next.castling.wk = false;
    if (sq === squareOf(0, 7)) next.castling.wq = false;
    if (sq === squareOf(7, 0)) next.castling.bk = false;
    if (sq === squareOf(0, 0)) next.castling.bq = false;
  };
  clearRook(m.from);
  clearRook(m.to);

  next.ep = m.double ? squareOf(fileOf(m.from), rankOf(m.from) + pawnDir(me)) : null;
  next.halfmove = p.type === "p" || m.capture ? 0 : pos.halfmove + 1;
  next.fullmove = me === "b" ? pos.fullmove + 1 : pos.fullmove;
  next.turn = other(me);
  return next;
}

/** 这一方所有真正能走的手（已经过滤掉走完自己被将的） */
export function legalMoves(pos: Position): Move[] {
  const out: Move[] = [];
  const me = pos.turn;
  for (let sq = 0; sq < 64; sq++) {
    const p = pos.board[sq];
    if (!p || p.color !== me) continue;
    for (const m of pseudoMoves(pos, sq)) {
      const next = makeMove(pos, m);
      if (!inCheck(next, me)) out.push(m);
    }
  }
  return out;
}

/** 只算某一格的合法走法（界面点子时用） */
export function legalMovesFrom(pos: Position, from: Square): Move[] {
  return legalMoves(pos).filter((m) => m.from === from);
}

/** 子力不足：王对王、王象对王、王马对王 */
export function insufficientMaterial(pos: Position): boolean {
  const men: Array<{ color: Color; type: PieceType }> = [];
  for (const p of pos.board) {
    if (p) men.push(p);
  }
  if (men.some((m) => m.type === "p" || m.type === "r" || m.type === "q")) return false;
  const minor = men.filter((m) => m.type === "n" || m.type === "b");
  return minor.length <= 1;
}

export type Status =
  | { kind: "playing" }
  | { kind: "checkmate"; winner: Color }
  | { kind: "stalemate" }
  | { kind: "draw"; why: "fifty" | "repetition" | "material" };

/**
 * 局面状态。三次重复要看历史哈希，所以由调用方把走过的局面哈希传进来。
 */
export function status(pos: Position, history: readonly number[] = []): Status {
  const moves = legalMoves(pos);
  if (moves.length === 0) {
    if (inCheck(pos, pos.turn)) return { kind: "checkmate", winner: other(pos.turn) };
    return { kind: "stalemate" };
  }
  if (pos.halfmove >= 100) return { kind: "draw", why: "fifty" };
  if (insufficientMaterial(pos)) return { kind: "draw", why: "material" };
  const h = zobrist(pos);
  let seen = 0;
  for (const x of history) {
    if (x === h) seen += 1;
  }
  if (seen >= 3) return { kind: "draw", why: "repetition" };
  return { kind: "playing" };
}

/** 记谱（够攻略和测试用的简化 SAN） */
export function toSan(pos: Position, m: Move): string {
  if (m.castle) return m.castle === "k" ? "O-O" : "O-O-O";
  const p = pos.board[m.from];
  if (!p) return "??";
  const letter = p.type === "p" ? "" : p.type.toUpperCase();
  const takes = m.capture ? "x" : "";
  const fromFile = p.type === "p" && m.capture ? squareName(m.from)[0] : "";
  // 同种类的另一枚子也能走到同一格时，补上出发格的列（够用了）
  let disamb = "";
  if (p.type !== "p") {
    const rivals = legalMoves(pos).filter(
      (x) => x.to === m.to && x.from !== m.from && pos.board[x.from]?.type === p.type
    );
    if (rivals.length > 0) disamb = squareName(m.from)[0];
  }
  const promo = m.promo ? `=${m.promo.toUpperCase()}` : "";
  const next = makeMove(pos, m);
  const suffix = inCheck(next, next.turn) ? (legalMoves(next).length === 0 ? "#" : "+") : "";
  return `${letter}${disamb}${fromFile}${takes}${squareName(m.to)}${promo}${suffix}`;
}

/** 从坐标找一手（界面与测试都方便） */
export function findMove(pos: Position, from: string, to: string, promo?: Exclude<PieceType, "p" | "k">): Move | null {
  const list = legalMoves(pos);
  for (const m of list) {
    if (squareName(m.from) !== from || squareName(m.to) !== to) continue;
    if (promo && m.promo !== promo) continue;
    if (!promo && m.promo && m.promo !== "q") continue;
    return m;
  }
  return null;
}

/** perft：把走法生成从根上验一遍 */
export function perft(pos: Position, depth: number): number {
  if (depth <= 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(makeMove(pos, m), depth - 1);
  return n;
}
