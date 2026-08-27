/**
 * 围子花园 · 规则
 *
 * 落子顺序永远是这三步,顺序反了就会把「打二还一」判错:
 *   1. 先把子放上去;
 *   2. 先提对方无气的块;
 *   3. 再看自己有没有气 —— 没气又没提到子,就是自杀禁手,这一手不作数。
 *
 * 打劫:刚被提的单子形成劫,立即回提非法。除了这个「一步劫」,
 * 还加一层**位置超劫**(positional superko):禁止全盘棋子摆位再现,
 * 连环劫、长生这类循环也一并挡住。指纹只看棋子摆位、不看轮到谁走。
 */
import {
  BLACK,
  EMPTY,
  WHITE,
  cloneBoard,
  createBoard,
  emptyPoints,
  groupAt,
  handicapPoints,
  neighborTable,
  other,
  positionHash,
  type Board,
  type BoardSize,
  type Color
} from "./board";

export type IllegalReason = "outside" | "occupied" | "suicide" | "ko" | "superko" | "over";

export interface PlacedMove {
  board: Board;
  /** 这一手提掉的对方子(升序) */
  captured: number[];
}

/**
 * 单纯的「放一颗子」:提子 + 自杀判定,不管劫、不管超劫、不管轮次。
 * 非法(点外 / 已有子 / 自杀)返回 null。
 */
export function play(board: Board, pt: number, color: Color): PlacedMove | null {
  if (!Number.isInteger(pt) || pt < 0 || pt >= board.cells.length) return null;
  if (board.cells[pt] !== EMPTY) return null;
  const next = cloneBoard(board);
  next.cells[pt] = color;
  const foe = other(color);
  const table = neighborTable(board.size);
  const captured: number[] = [];
  const done = new Uint8Array(board.cells.length);
  for (const n of table[pt]) {
    if (next.cells[n] !== foe || done[n]) continue;
    const g = groupAt(next, n);
    if (!g) continue;
    for (const s of g.stones) done[s] = 1;
    if (g.liberties.length === 0) {
      for (const s of g.stones) {
        next.cells[s] = EMPTY;
        captured.push(s);
      }
    }
  }
  const mine = groupAt(next, pt);
  if (mine && mine.liberties.length === 0) return null; // 自杀禁手
  captured.sort((a, b) => a - b);
  return { board: next, captured };
}

/**
 * 这一手有没有留下劫。
 * 判据是经典的那一条:恰好提掉 1 颗子,而且落下的这颗子自己成单、只剩 1 口气。
 * 满足时返回那颗被提子的位置(对方立即回提就是非法的);否则返回 null。
 */
export function koPoint(before: Board, after: Board, pt: number, captured: readonly number[]): number | null {
  if (captured.length !== 1) return null;
  const g = groupAt(after, pt);
  if (!g || g.stones.length !== 1 || g.liberties.length !== 1) return null;
  if (before.cells[captured[0]] === EMPTY) return null;
  return captured[0];
}

/** 这个点是不是自己的眼:四周正交全是本方子(界外算本方) */
export function isEyeLike(board: Board, pt: number, color: Color): boolean {
  if (board.cells[pt] !== EMPTY) return false;
  for (const n of neighborTable(board.size)[pt]) {
    if (board.cells[n] !== color) return false;
  }
  return true;
}

/**
 * 全部合法点。
 * `ko` 是当前禁着的劫点;`history` 是此前出现过的**位置指纹**集合,
 * 传进来就顺便把超劫也筛掉。
 */
export function legalMoves(
  board: Board,
  color: Color,
  ko: number | null = null,
  history?: ReadonlySet<string>
): number[] {
  const out: number[] = [];
  for (const pt of emptyPoints(board)) {
    if (pt === ko) continue;
    const res = play(board, pt, color);
    if (!res) continue;
    if (history && history.has(positionHash(res.board))) continue;
    out.push(pt);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 一局棋的状态
// ---------------------------------------------------------------------------

export type ScoreRule = "chinese" | "japanese";

export interface MoveRecord {
  /** 停一手记 null */
  pt: number | null;
  color: Color;
  captured: number[];
}

export interface GameState {
  board: Board;
  turn: Color;
  /** 当前禁着的劫点,没有就是 null */
  ko: number | null;
  /** 位置超劫历史(含开局盘面) */
  history: Set<string>;
  /** 各方**提掉的对方子**数量 */
  captures: Record<Color, number>;
  /** 连续停手数,到 2 就终局 */
  passes: number;
  moves: MoveRecord[];
  over: boolean;
  handicap: number;
  rule: ScoreRule;
}

export interface GameOptions {
  size: BoardSize | number;
  /** 让子数(0 / 2 / 3 / 4),让子后由白先走 */
  handicap?: number;
  rule?: ScoreRule;
  /** 直接从一个摆好的盘面开始(死活题用) */
  board?: Board;
  /** 谁先走;不传就按让子规则推 */
  turn?: Color;
}

export function createGame(opts: GameOptions): GameState {
  const handicap = Math.max(0, Math.floor(opts.handicap ?? 0));
  const board = opts.board ? cloneBoard(opts.board) : createBoard(opts.size);
  if (!opts.board && handicap >= 2) {
    for (const pt of handicapPoints(board.size, handicap)) board.cells[pt] = BLACK;
  }
  const placed = !opts.board && handicap >= 2;
  const turn: Color = opts.turn ?? (placed ? WHITE : BLACK);
  return {
    board,
    turn,
    ko: null,
    history: new Set([positionHash(board)]),
    captures: { [BLACK]: 0, [WHITE]: 0 } as Record<Color, number>,
    passes: 0,
    moves: [],
    over: false,
    handicap: placed ? handicap : 0,
    rule: opts.rule ?? "chinese"
  };
}

export function cloneGame(state: GameState): GameState {
  return {
    board: cloneBoard(state.board),
    turn: state.turn,
    ko: state.ko,
    history: new Set(state.history),
    captures: { ...state.captures },
    passes: state.passes,
    moves: state.moves.map((m) => ({ ...m, captured: m.captured.slice() })),
    over: state.over,
    handicap: state.handicap,
    rule: state.rule
  };
}

export type MoveOutcome =
  | { ok: true; state: GameState; captured: number[]; ko: number | null }
  | { ok: false; reason: IllegalReason };

/** 这一手行不行(不改状态) */
export function checkMove(state: GameState, pt: number): IllegalReason | null {
  if (state.over) return "over";
  if (!Number.isInteger(pt) || pt < 0 || pt >= state.board.cells.length) return "outside";
  if (state.board.cells[pt] !== EMPTY) return "occupied";
  if (pt === state.ko) return "ko";
  const res = play(state.board, pt, state.turn);
  if (!res) return "suicide";
  if (state.history.has(positionHash(res.board))) return "superko";
  return null;
}

export function isLegal(state: GameState, pt: number): boolean {
  return checkMove(state, pt) === null;
}

/** 走一手。返回新状态,原状态一个字节都不动。 */
export function playMove(state: GameState, pt: number): MoveOutcome {
  const bad = checkMove(state, pt);
  if (bad) return { ok: false, reason: bad };
  const color = state.turn;
  const res = play(state.board, pt, color) as PlacedMove;
  const next = cloneGame(state);
  next.board = res.board;
  next.ko = koPoint(state.board, res.board, pt, res.captured);
  next.captures[color] += res.captured.length;
  next.passes = 0;
  next.turn = other(color);
  next.moves.push({ pt, color, captured: res.captured.slice() });
  next.history.add(positionHash(res.board));
  return { ok: true, state: next, captured: res.captured, ko: next.ko };
}

/** 停一手。双方连着停手就终局。 */
export function passMove(state: GameState): GameState {
  if (state.over) return state;
  const next = cloneGame(state);
  next.moves.push({ pt: null, color: state.turn, captured: [] });
  next.passes = state.passes + 1;
  next.ko = null;
  next.turn = other(state.turn);
  if (next.passes >= 2) next.over = true;
  return next;
}

/** 当前这方的全部合法点(已经把劫与超劫筛掉) */
export function movesFor(state: GameState): number[] {
  return legalMoves(state.board, state.turn, state.ko, state.history);
}

/** 悔一手:从头重放,状态最干净,回合数不多所以不心疼 */
export function undoMove(state: GameState, opts: GameOptions): GameState {
  const records = state.moves.slice(0, -1);
  let cur = createGame(opts);
  for (const rec of records) {
    cur = rec.pt === null ? passMove(cur) : (playMove(cur, rec.pt) as { ok: true; state: GameState }).state;
  }
  return cur;
}

/** 非法原因的温柔说法(界面直接用,失败只鼓励) */
export const ILLEGAL_TEXT: Record<IllegalReason, string> = {
  outside: "这里在棋盘外面,换个交叉点试试。",
  occupied: "这个交叉点已经有子啦,挑个空的。",
  suicide: "放这儿它自己就没气了,先在旁边补一手更稳。",
  ko: "刚提完的劫要缓一手,先在别处下一子或者停一手。",
  superko: "这一手会让整盘棋回到刚才的样子,换个地方下吧。",
  over: "这一局已经数完啦,再来一局?"
};
