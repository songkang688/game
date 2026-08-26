/**
 * 花园国际象棋 · 走法生成、落子与记谱。
 *
 * 分成两层，和规格第六节的抽成一一对应：
 *  - `pseudoMoves`：伪合法走法（只管棋子怎么走，不管走完自己的王会不会挨将）；
 *  - `legalMoves`：把走完之后自己王被攻击的那些过滤掉，再补上易位。
 *
 * 走法生成靠三张预表：马 / 王的落点表、八个方向的射线表、兵的斜吃表。
 * 表在模块加载时算一次，之后每次生成都只是查表，`perft` 才跑得动。
 */
import {
  BISHOP,
  BLACK,
  CASTLE_BK,
  CASTLE_BQ,
  CASTLE_WK,
  CASTLE_WQ,
  KING,
  KNIGHT,
  PAWN,
  PIECE_SAN,
  QUEEN,
  ROOK,
  WHITE,
  clonePosition,
  colorOf,
  fileOf,
  kingSquare,
  onBoard,
  rankOf,
  squareAt,
  squareName,
  typeOf,
  type Color,
  type PieceType,
  type Position,
} from "./board";

/** 走法种类：普通 / 兵走两格 / 吃过路兵 / 短易位 / 长易位 */
export type MoveFlag = "n" | "d" | "e" | "k" | "q";

export interface Move {
  from: number;
  to: number;
  /** 走的那个子（带正负号） */
  piece: number;
  /** 被吃的子（带正负号，0 表示没吃子）；吃过路兵时是那个被请去休息的兵 */
  captured: number;
  /** 升变成什么（0 表示不升变） */
  promo: PieceType | 0;
  flag: MoveFlag;
}

// ---------------------------------------------------------------------------
// 预表
// ---------------------------------------------------------------------------

const KNIGHT_D: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

/** 前 4 个是车的方向，后 4 个是象的方向 */
const RAY_D: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];

function buildStepTable(deltas: ReadonlyArray<readonly [number, number]>): number[][] {
  const table: number[][] = [];
  for (let sq = 0; sq < 64; sq++) {
    const f = fileOf(sq);
    const r = rankOf(sq);
    const list: number[] = [];
    for (const [df, dr] of deltas) {
      if (onBoard(f + df, r + dr)) list.push(squareAt(f + df, r + dr));
    }
    table.push(list);
  }
  return table;
}

const KNIGHT_TARGETS: number[][] = buildStepTable(KNIGHT_D);
const KING_TARGETS: number[][] = buildStepTable(RAY_D);

/** RAYS[sq][dir] = 从 sq 沿 dir 一路走出去的格子（由近及远） */
const RAYS: number[][][] = (() => {
  const table: number[][][] = [];
  for (let sq = 0; sq < 64; sq++) {
    const rays: number[][] = [];
    for (const [df, dr] of RAY_D) {
      const line: number[] = [];
      let f = fileOf(sq) + df;
      let r = rankOf(sq) + dr;
      while (onBoard(f, r)) {
        line.push(squareAt(f, r));
        f += df;
        r += dr;
      }
      rays.push(line);
    }
    table.push(rays);
  }
  return table;
})();

/** PAWN_ATTACKS[白=0/黑=1][sq] = 这一格上的兵能斜吃到哪儿 */
const PAWN_ATTACKS: number[][][] = [[], []];
for (let sq = 0; sq < 64; sq++) {
  const f = fileOf(sq);
  const r = rankOf(sq);
  for (const side of [0, 1]) {
    const dr = side === 0 ? 1 : -1;
    const list: number[] = [];
    if (onBoard(f - 1, r + dr)) list.push(squareAt(f - 1, r + dr));
    if (onBoard(f + 1, r + dr)) list.push(squareAt(f + 1, r + dr));
    PAWN_ATTACKS[side].push(list);
  }
}

const PROMO_CHOICES: PieceType[] = [QUEEN, ROOK, BISHOP, KNIGHT];

function sideIndex(color: Color): number {
  return color === WHITE ? 0 : 1;
}

// ---------------------------------------------------------------------------
// 被攻击判定
// ---------------------------------------------------------------------------

/** `sq` 这一格有没有被 `by` 方攻击到（自己的子挡在那儿也算被攻击，易位安全检查要用） */
export function isSquareAttacked(pos: Position, sq: number, by: Color): boolean {
  const b = pos.board;
  // 兵：反过来查——「哪些格子上的兵能吃到 sq」等于「sq 上的对方兵能吃到哪儿」
  for (const from of PAWN_ATTACKS[sideIndex((-by) as Color)][sq]) {
    if (b[from] === by * PAWN) return true;
  }
  for (const from of KNIGHT_TARGETS[sq]) {
    if (b[from] === by * KNIGHT) return true;
  }
  for (const from of KING_TARGETS[sq]) {
    if (b[from] === by * KING) return true;
  }
  const rays = RAYS[sq];
  for (let d = 0; d < 8; d++) {
    const line = rays[d];
    const slider = d < 4 ? ROOK : BISHOP;
    for (let i = 0; i < line.length; i++) {
      const p = b[line[i]];
      if (p === 0) continue;
      if (p === by * slider || p === by * QUEEN) return true;
      break;
    }
  }
  return false;
}

/** 这一方的王现在被将了吗 */
export function inCheck(pos: Position, color: Color): boolean {
  const ks = kingSquare(pos, color);
  if (ks < 0) return false;
  return isSquareAttacked(pos, ks, (-color) as Color);
}

// ---------------------------------------------------------------------------
// 伪合法走法
// ---------------------------------------------------------------------------

function push(list: Move[], pos: Position, from: number, to: number, flag: MoveFlag = "n"): void {
  list.push({
    from,
    to,
    piece: pos.board[from],
    captured: flag === "e" ? -pos.turn * PAWN : pos.board[to],
    promo: 0,
    flag,
  });
}

function pushPawn(list: Move[], pos: Position, from: number, to: number, flag: MoveFlag): void {
  const lastRank = pos.turn === WHITE ? 7 : 0;
  const captured = flag === "e" ? -pos.turn * PAWN : pos.board[to];
  if (rankOf(to) === lastRank) {
    // 到底线**必须**升变，所以这里一次生成四条，界面弹四选一
    for (const promo of PROMO_CHOICES) {
      list.push({ from, to, piece: pos.board[from], captured, promo, flag: "n" });
    }
    return;
  }
  list.push({ from, to, piece: pos.board[from], captured, promo: 0, flag });
}

/**
 * 伪合法走法：给一格就只出那一格的，不给就出轮走方的全部。
 * 不含易位（易位要做三段安全检查，放在 `castlingMoves` 里）。
 */
export function pseudoMoves(pos: Position, sq?: number): Move[] {
  const out: Move[] = [];
  const b = pos.board;
  const us = pos.turn;
  const from0 = sq === undefined ? 0 : sq;
  const from1 = sq === undefined ? 63 : sq;
  for (let from = from0; from <= from1; from++) {
    const p = b[from];
    if (p === 0 || colorOf(p) !== us) continue;
    const type = typeOf(p);
    if (type === PAWN) {
      const dr = us === WHITE ? 1 : -1;
      const one = from + dr * 8;
      if (one >= 0 && one < 64 && b[one] === 0) {
        pushPawn(out, pos, from, one, "n");
        const startRank = us === WHITE ? 1 : 6;
        const two = from + dr * 16;
        if (rankOf(from) === startRank && b[two] === 0) pushPawn(out, pos, from, two, "d");
      }
      for (const to of PAWN_ATTACKS[sideIndex(us)][from]) {
        if (b[to] !== 0 && colorOf(b[to]) === -us) {
          pushPawn(out, pos, from, to, "n");
        } else if (to === pos.ep && b[to] === 0) {
          pushPawn(out, pos, from, to, "e");
        }
      }
      continue;
    }
    if (type === KNIGHT || type === KING) {
      const targets = type === KNIGHT ? KNIGHT_TARGETS[from] : KING_TARGETS[from];
      for (const to of targets) {
        if (b[to] === 0 || colorOf(b[to]) === -us) push(out, pos, from, to);
      }
      continue;
    }
    const dirFrom = type === BISHOP ? 4 : 0;
    const dirTo = type === ROOK ? 4 : 8;
    const rays = RAYS[from];
    for (let d = dirFrom; d < dirTo; d++) {
      const line = rays[d];
      for (let i = 0; i < line.length; i++) {
        const to = line[i];
        const q = b[to];
        if (q === 0) {
          push(out, pos, from, to);
          continue;
        }
        if (colorOf(q) === -us) push(out, pos, from, to);
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 易位
// ---------------------------------------------------------------------------

export interface CastleShape {
  /** 王的起点 */
  kingFrom: number;
  /** 王的落点 */
  kingTo: number;
  /** 车的起点 */
  rookFrom: number;
  /** 车的落点 */
  rookTo: number;
  /** 必须全空的格子 */
  empty: number[];
  /** 王的起点 / 经过格 / 落点，三个都不许被将 */
  safe: number[];
  mask: number;
  flag: MoveFlag;
}

/** 四种易位的形状表：白短、白长、黑短、黑长 */
export const CASTLE_SHAPES: Record<"wk" | "wq" | "bk" | "bq", CastleShape> = {
  wk: { kingFrom: 4, kingTo: 6, rookFrom: 7, rookTo: 5, empty: [5, 6], safe: [4, 5, 6], mask: CASTLE_WK, flag: "k" },
  wq: {
    kingFrom: 4,
    kingTo: 2,
    rookFrom: 0,
    rookTo: 3,
    empty: [1, 2, 3],
    safe: [4, 3, 2],
    mask: CASTLE_WQ,
    flag: "q",
  },
  bk: {
    kingFrom: 60,
    kingTo: 62,
    rookFrom: 63,
    rookTo: 61,
    empty: [61, 62],
    safe: [60, 61, 62],
    mask: CASTLE_BK,
    flag: "k",
  },
  bq: {
    kingFrom: 60,
    kingTo: 58,
    rookFrom: 56,
    rookTo: 59,
    empty: [57, 58, 59],
    safe: [60, 59, 58],
    mask: CASTLE_BQ,
    flag: "q",
  },
};

function shapesFor(color: Color): CastleShape[] {
  return color === WHITE ? [CASTLE_SHAPES.wk, CASTLE_SHAPES.wq] : [CASTLE_SHAPES.bk, CASTLE_SHAPES.bq];
}

/** 某个形状的易位现在合不合法（权 / 空格 / 三段安全全部要过） */
export function canCastleShape(pos: Position, shape: CastleShape): boolean {
  const us = pos.turn;
  if ((pos.castling & shape.mask) === 0) return false;
  if (pos.board[shape.kingFrom] !== us * KING) return false;
  if (pos.board[shape.rookFrom] !== us * ROOK) return false;
  for (const sq of shape.empty) if (pos.board[sq] !== 0) return false;
  for (const sq of shape.safe) if (isSquareAttacked(pos, sq, (-us) as Color)) return false;
  return true;
}

/** 轮走方现在能走的易位 */
export function castlingMoves(pos: Position): Move[] {
  const out: Move[] = [];
  for (const shape of shapesFor(pos.turn)) {
    if (!canCastleShape(pos, shape)) continue;
    out.push({
      from: shape.kingFrom,
      to: shape.kingTo,
      piece: pos.turn * KING,
      captured: 0,
      promo: 0,
      flag: shape.flag,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 落子
// ---------------------------------------------------------------------------

/** 这四格上的车一动（或者被请去休息），对应的易位权就没了 */
const ROOK_HOME: Array<{ sq: number; mask: number }> = [
  { sq: 0, mask: CASTLE_WQ },
  { sq: 7, mask: CASTLE_WK },
  { sq: 56, mask: CASTLE_BQ },
  { sq: 63, mask: CASTLE_BK },
];

/** 走一步，返回新局面（不改原局面） */
export function makeMove(pos: Position, move: Move): Position {
  const next = clonePosition(pos);
  const b = next.board;
  const us = pos.turn;
  const type = typeOf(move.piece);

  b[move.from] = 0;
  b[move.to] = move.promo ? us * move.promo : move.piece;

  if (move.flag === "e") {
    // 吃过路兵：被吃的兵不在落点上，在落点后面那一格
    b[move.to - us * 8] = 0;
  } else if (move.flag === "k" || move.flag === "q") {
    const shape = shapesFor(us).find((s) => s.flag === move.flag)!;
    b[shape.rookFrom] = 0;
    b[shape.rookTo] = us * ROOK;
  }

  if (type === KING) {
    next.castling &= us === WHITE ? ~(CASTLE_WK | CASTLE_WQ) : ~(CASTLE_BK | CASTLE_BQ);
  }
  for (const home of ROOK_HOME) {
    if (move.from === home.sq || move.to === home.sq) next.castling &= ~home.mask;
  }
  next.castling &= 15;

  // 过路格**每走一步都重算**，所以吃过路兵只有紧接着的那一手有效
  next.ep = move.flag === "d" ? move.from + us * 8 : -1;
  next.halfmove = type === PAWN || move.captured !== 0 ? 0 : pos.halfmove + 1;
  next.fullmove = us === BLACK ? pos.fullmove + 1 : pos.fullmove;
  next.turn = (-us) as Color;
  return next;
}

// ---------------------------------------------------------------------------
// 合法走法
// ---------------------------------------------------------------------------

/** 走完之后自己的王没被攻击才算合法 */
export function isLegal(pos: Position, move: Move): boolean {
  const next = makeMove(pos, move);
  return !inCheck(next, pos.turn);
}

/** 轮走方的全部合法走法；给了 sq 就只出那一格的 */
export function legalMoves(pos: Position, sq?: number): Move[] {
  const out: Move[] = [];
  for (const m of pseudoMoves(pos, sq)) {
    if (isLegal(pos, m)) out.push(m);
  }
  for (const m of castlingMoves(pos)) {
    if (sq === undefined || m.from === sq) out.push(m);
  }
  return out;
}

/** 走法的短标识：起点+落点+升变，界面点选和测试比对都用它 */
export function moveKey(move: Move): string {
  return `${squareName(move.from)}${squareName(move.to)}${move.promo ? PIECE_SAN[move.promo].toLowerCase() : ""}`;
}

export function sameMove(a: Move, b: Move): boolean {
  return a.from === b.from && a.to === b.to && a.promo === b.promo;
}

/** 在合法走法里找一条（升变不给就默认后） */
export function findMove(pos: Position, from: number, to: number, promo?: PieceType): Move | null {
  const list = legalMoves(pos, from);
  const hit = list.filter((m) => m.to === to);
  if (hit.length === 0) return null;
  if (hit.length === 1) return hit[0];
  const want = promo ?? QUEEN;
  return hit.find((m) => m.promo === want) ?? hit[0];
}

/** 规格第六节的 `promote(move, piece)`：把一条升变走法换成指定兵种 */
export function promote(move: Move, piece: PieceType): Move {
  if (!move.promo) return move;
  return { ...move, promo: piece };
}

// ---------------------------------------------------------------------------
// 记谱
// ---------------------------------------------------------------------------

/** 标准代数记谱；`pos` 是走这一步**之前**的局面 */
export function toSan(move: Move, pos: Position): string {
  if (move.flag === "k") return withCheck("O-O", pos, move);
  if (move.flag === "q") return withCheck("O-O-O", pos, move);
  const type = typeOf(move.piece) as PieceType;
  const capture = move.captured !== 0;
  let san: string;
  if (type === PAWN) {
    san = capture ? `${"abcdefgh"[fileOf(move.from)]}x${squareName(move.to)}` : squareName(move.to);
    if (move.promo) san += `=${PIECE_SAN[move.promo]}`;
  } else {
    const rivals = legalMoves(pos).filter(
      (m) => m.to === move.to && m.from !== move.from && typeOf(m.piece) === type
    );
    let disambig = "";
    if (rivals.length > 0) {
      const sameFile = rivals.some((m) => fileOf(m.from) === fileOf(move.from));
      const sameRank = rivals.some((m) => rankOf(m.from) === rankOf(move.from));
      if (!sameFile) disambig = "abcdefgh"[fileOf(move.from)];
      else if (!sameRank) disambig = String(rankOf(move.from) + 1);
      else disambig = squareName(move.from);
    }
    san = `${PIECE_SAN[type]}${disambig}${capture ? "x" : ""}${squareName(move.to)}`;
  }
  return withCheck(san, pos, move);
}

function withCheck(san: string, pos: Position, move: Move): string {
  const next = makeMove(pos, move);
  if (!inCheck(next, next.turn)) return san;
  return legalMoves(next).length === 0 ? `${san}#` : `${san}+`;
}

/** 中文记谱，界面上给孩子看：「马 g1→f3」 */
export function toChinese(move: Move, pos: Position): string {
  if (move.flag === "k") return "王车易位（短）";
  if (move.flag === "q") return "王车易位（长）";
  const type = typeOf(move.piece) as PieceType;
  const names: Record<PieceType, string> = { 1: "兵", 2: "马", 3: "象", 4: "车", 5: "后", 6: "王" };
  let text = `${names[type]} ${squareName(move.from)}→${squareName(move.to)}`;
  if (move.flag === "e") text += "（吃过路兵）";
  else if (move.captured !== 0) text += `（请${names[typeOf(move.captured) as PieceType]}去休息）`;
  if (move.promo) text += `（升${names[move.promo]}）`;
  const next = makeMove(pos, move);
  if (inCheck(next, next.turn)) text += legalMoves(next).length === 0 ? "，将杀！" : "，将军！";
  return text;
}

/** 按 SAN 找一条合法走法（关卡数据与测试用；认不出来返回 null） */
export function fromSan(pos: Position, san: string): Move | null {
  const clean = san.replace(/[+#!?]/g, "").trim();
  for (const m of legalMoves(pos)) {
    if (toSan(m, pos).replace(/[+#!?]/g, "") === clean) return m;
  }
  return null;
}

// ---------------------------------------------------------------------------
// perft（走法生成的体检）
// ---------------------------------------------------------------------------

/** 数一数深度 depth 的叶子节点。走法生成写错一条这里立刻对不上。 */
export function perft(pos: Position, depth: number): number {
  if (depth <= 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(makeMove(pos, m), depth - 1);
  return n;
}

/** 分手统计，调试走法 bug 时按第一手拆开看 */
export function perftDivide(pos: Position, depth: number): Array<{ move: string; nodes: number }> {
  return legalMoves(pos).map((m) => ({
    move: moveKey(m),
    nodes: depth <= 1 ? 1 : perft(makeMove(pos, m), depth - 1),
  }));
}
