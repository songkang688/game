/**
 * 花园国际象棋 · 对局状态机。
 *
 * 走法本身在 moves.ts；这里只回答「这一局现在算什么」：
 * 将杀 / 逼和 / 50 回合 / 三次重复 / 子力不足 / 认输 / 超时。
 *
 * 三次重复要看历史，所以多包了一层 `Game`：它拿着当前局面、走过的每一手，
 * 以及每个局面哈希出现过几次。哈希来自 board.ts 的 `zobrist`，含轮走方、
 * 易位权与过路格，所以「摆法一样但轮到对方走」不会被错算成重复。
 */
import {
  BISHOP,
  BLACK,
  KING,
  KNIGHT,
  PAWN,
  QUEEN,
  ROOK,
  WHITE,
  isLightSquare,
  startPosition,
  typeOf,
  zobrist,
  fromFen,
  type Color,
  type Position,
} from "./board";
import {
  CASTLE_SHAPES,
  canCastleShape,
  inCheck,
  legalMoves,
  makeMove,
  toChinese,
  toSan,
  type Move,
} from "./moves";

/** 50 回合规则：连续 50 个回合（= 100 个半回合）没吃子也没动兵 */
export const FIFTY_MOVE_PLIES = 100;
/** 同一个局面出现这么多次可以判和 */
export const REPETITION_LIMIT = 3;

export type StatusKind =
  | "ongoing"
  | "check"
  | "checkmate"
  | "stalemate"
  | "fifty"
  | "repetition"
  | "material"
  | "resign"
  | "timeout";

export interface Status {
  kind: StatusKind;
  /** 这一局结束了吗 */
  over: boolean;
  /** 1 白胜 / -1 黑胜 / 0 和棋 / null 还没完 */
  winner: Color | 0 | null;
  /** 给孩子看的一句话（只鼓励，不批评） */
  text: string;
}

/** 规格第六节的 `castlingRights(pos)`：现在还留着哪几种易位权 */
export function castlingRights(pos: Position): Array<"wk" | "wq" | "bk" | "bq"> {
  const out: Array<"wk" | "wq" | "bk" | "bq"> = [];
  for (const key of ["wk", "wq", "bk", "bq"] as const) {
    if (pos.castling & CASTLE_SHAPES[key].mask) out.push(key);
  }
  return out;
}

/** 规格第六节的 `canCastle(pos, side)`：轮走方现在能不能往这边易位 */
export function canCastle(pos: Position, side: "king" | "queen"): boolean {
  const key = pos.turn === WHITE ? (side === "king" ? "wk" : "wq") : side === "king" ? "bk" : "bq";
  return canCastleShape(pos, CASTLE_SHAPES[key]);
}

/** 规格第六节的 `epSquare(pos)`：这一手可以吃过路兵的落点，没有就是 -1 */
export function epSquare(pos: Position): number {
  return pos.ep;
}

/** 规格第六节的 `halfmoveClock`：50 回合规则数到哪儿了 */
export function halfmoveClock(pos: Position): number {
  return pos.halfmove;
}

/**
 * 子力不足判和：王对王、王象对王、王马对王。
 * 另外把「双方各剩一个同色格的象」也算进来——那种局面谁都杀不掉谁。
 */
export function insufficientMaterial(pos: Position): boolean {
  const minors: Array<{ color: Color; type: number; light: boolean }> = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = pos.board[sq];
    if (p === 0) continue;
    const type = typeOf(p);
    if (type === KING) continue;
    if (type === PAWN || type === ROOK || type === QUEEN) return false;
    minors.push({ color: p > 0 ? WHITE : BLACK, type, light: isLightSquare(sq) });
  }
  if (minors.length === 0) return true;
  if (minors.length === 1) return true;
  if (minors.length === 2) {
    const [a, b] = minors;
    if (a.type === BISHOP && b.type === BISHOP && a.color !== b.color && a.light === b.light) return true;
  }
  return false;
}

/**
 * 局面状态。三次重复要靠历史，所以重复次数从外面传进来（`Game` 会算好）。
 * 判定顺序照 FIDE：先看有没有合法走法（将杀 / 逼和），再看和棋条款。
 */
export function status(pos: Position, repetitions = 1): Status {
  const moves = legalMoves(pos);
  const checked = inCheck(pos, pos.turn);
  if (moves.length === 0) {
    if (checked) {
      const winner = (-pos.turn) as Color;
      return {
        kind: "checkmate",
        over: true,
        winner,
        text: winner === WHITE ? "白方将杀，这一局赢下来了！" : "黑方将杀，这一局赢下来了！",
      };
    }
    return { kind: "stalemate", over: true, winner: 0, text: "逼和：轮到走的一方一步都走不了，又没被将，算和棋。" };
  }
  if (insufficientMaterial(pos)) {
    return { kind: "material", over: true, winner: 0, text: "子力不足：剩下的棋子谁也杀不掉谁，算和棋。" };
  }
  if (pos.halfmove >= FIFTY_MOVE_PLIES) {
    return { kind: "fifty", over: true, winner: 0, text: "50 回合没吃子也没动兵，按规则算和棋。" };
  }
  if (repetitions >= REPETITION_LIMIT) {
    return { kind: "repetition", over: true, winner: 0, text: "同一个局面出现三次，按规则算和棋。" };
  }
  if (checked) {
    return { kind: "check", over: false, winner: null, text: "将军！先把王照顾好。" };
  }
  return { kind: "ongoing", over: false, winner: null, text: "轮到你了，慢慢想。" };
}

// ---------------------------------------------------------------------------
// 一整局
// ---------------------------------------------------------------------------

export interface PlayedMove {
  move: Move;
  san: string;
  cn: string;
  /** 走完之后的局面哈希 */
  hash: string;
}

export interface Game {
  pos: Position;
  history: PlayedMove[];
  /** 局面哈希 → 出现过几次（含当前局面） */
  counts: Map<string, number>;
  /** 结算结果；没结束就是 null */
  result: Status | null;
  /** 起始局面，用于「重下这一局」 */
  startFen: string;
}

export function createGame(fen?: string): Game {
  const pos = fen ? fromFen(fen) : startPosition();
  const counts = new Map<string, number>();
  counts.set(zobrist(pos), 1);
  return { pos, history: [], counts, result: null, startFen: fen ?? "" };
}

/** 当前局面重复了几次 */
export function repetitionCount(game: Game): number {
  return game.counts.get(zobrist(game.pos)) ?? 1;
}

/** 现在这一局算什么（会把结算缓存进 `game.result`） */
export function gameStatus(game: Game): Status {
  if (game.result) return game.result;
  const st = status(game.pos, repetitionCount(game));
  if (st.over) game.result = st;
  return st;
}

/** 走一手；这一手不合法就原样返回 false，什么都不改 */
export function playMove(game: Game, move: Move): boolean {
  if (game.result) return false;
  const legal = legalMoves(game.pos).find(
    (m) => m.from === move.from && m.to === move.to && m.promo === move.promo
  );
  if (!legal) return false;
  const san = toSan(legal, game.pos);
  const cn = toChinese(legal, game.pos);
  const next = makeMove(game.pos, legal);
  const hash = zobrist(next);
  game.pos = next;
  game.counts.set(hash, (game.counts.get(hash) ?? 0) + 1);
  game.history.push({ move: legal, san, cn, hash });
  gameStatus(game);
  return true;
}

/** 认输 */
export function resign(game: Game, side: Color): Status {
  const winner = (-side) as Color;
  game.result = {
    kind: "resign",
    over: true,
    winner,
    text: side === WHITE ? "白方认输，这一局先收着，下一局再来。" : "黑方认输，这一局先收着，下一局再来。",
  };
  return game.result;
}

/**
 * 超时结算。对方的子力已经不够将杀了就判和（这是 FIDE 的处理），
 * 否则超时那一方算负。
 */
export function flagFall(game: Game, side: Color): Status {
  const winner = (-side) as Color;
  const opponentCanMate = !onlyKingLike(game.pos, winner);
  game.result = opponentCanMate
    ? { kind: "timeout", over: true, winner, text: "时间用完啦，这一局先算对方的，下一局多留点时间。" }
    : { kind: "material", over: true, winner: 0, text: "时间虽然用完了，但对方的子力也不够将杀，算和棋。" };
  return game.result;
}

/** 这一方是不是只剩「王」或者「王 + 一个轻子」——那样连将杀都摆不出来 */
function onlyKingLike(pos: Position, color: Color): boolean {
  let minors = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = pos.board[sq];
    if (p === 0 || (p > 0 ? WHITE : BLACK) !== color) continue;
    const type = typeOf(p);
    if (type === KING) continue;
    if (type === KNIGHT || type === BISHOP) minors++;
    else return false;
  }
  return minors <= 1;
}

/** 记谱串：「1. e4 e5 2. Nf3」这种，记谱抽屉与攻略都用它 */
export function moveList(game: Game): string[] {
  const out: string[] = [];
  for (let i = 0; i < game.history.length; i += 2) {
    const no = Math.floor(i / 2) + 1;
    const white = game.history[i]?.san ?? "";
    const black = game.history[i + 1]?.san ?? "";
    out.push(`${no}. ${white}${black ? ` ${black}` : ""}`);
  }
  return out;
}
