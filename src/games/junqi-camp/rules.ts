/**
 * 军旗对决 · 规则内核（纯函数，界面一行都不碰）。
 *
 * 电子裁判负责三件事：算出一枚子能走到哪儿、两子撞上以后谁留在场上、这一盘还有没有得下。
 * 被撞下场的一方一律叫「回营休息」，下一盘还能上场。
 */
import {
  RAIL_ADJ,
  ROAD_ADJ,
  colOf,
  inCamp,
  inHQ,
  isRail,
  other,
  rowOf,
  type Pos,
  type Side,
} from "./board";

export type { Pos, Side };

/** 十二种棋子 */
export type Kind =
  | "siling"
  | "junzhang"
  | "shizhang"
  | "lvzhang"
  | "tuanzhang"
  | "yingzhang"
  | "lianzhang"
  | "paizhang"
  | "gongbing"
  | "zhadan"
  | "dilei"
  | "junqi";

export const KINDS: readonly Kind[] = [
  "siling",
  "junzhang",
  "shizhang",
  "lvzhang",
  "tuanzhang",
  "yingzhang",
  "lianzhang",
  "paizhang",
  "gongbing",
  "zhadan",
  "dilei",
  "junqi",
];

/** 棋子名（卡通化的老名字，看得懂就行） */
export const LABEL: Record<Kind, string> = {
  siling: "司令",
  junzhang: "军长",
  shizhang: "师长",
  lvzhang: "旅长",
  tuanzhang: "团长",
  yingzhang: "营长",
  lianzhang: "连长",
  paizhang: "排长",
  gongbing: "工兵",
  zhadan: "炸弹",
  dilei: "地雷",
  junqi: "军旗",
};

/**
 * 比大小用的号数：司令最大，工兵最小。
 * 炸弹 / 地雷 / 军旗不参与比大小，单独写在 combat 里，所以给 0。
 */
export const RANK: Record<Kind, number> = {
  siling: 9,
  junzhang: 8,
  shizhang: 7,
  lvzhang: 6,
  tuanzhang: 5,
  yingzhang: 4,
  lianzhang: 3,
  paizhang: 2,
  gongbing: 1,
  zhadan: 0,
  dilei: 0,
  junqi: 0,
};

/** 每方 25 枚 */
export const ARMY: Record<Kind, number> = {
  siling: 1,
  junzhang: 1,
  shizhang: 2,
  lvzhang: 2,
  tuanzhang: 2,
  yingzhang: 2,
  lianzhang: 3,
  paizhang: 3,
  gongbing: 3,
  zhadan: 2,
  dilei: 3,
  junqi: 1,
};

/** 一方一共几枚棋子 */
export const ARMY_SIZE = KINDS.reduce((s, k) => s + ARMY[k], 0);

/** 炸弹撞上军旗：本款判扛旗成功（两子同尽，但旗算被请回来了） */
export const BOMB_ON_FLAG_WINS = true;

/** 双方连着这么多手不吃子就算和 */
export const NO_CAPTURE_DRAW = 70;

export interface Piece {
  id: number;
  side: Side;
  kind: Kind;
}

export type Cell = Piece | null;

export interface Move {
  from: Pos;
  to: Pos;
}

export type CombatOutcome = "attacker" | "defender" | "both";

export interface CombatResult {
  /** attacker=主动的一方留下；defender=守方留下；both=两子一起回营休息 */
  outcome: CombatOutcome;
  /** 这一撞把对方军旗扛回来了 */
  flagTaken: boolean;
}

/**
 * 对撞表（a 是主动撞上去的一方）：
 *  - 军旗：谁撞上都算扛旗成功；炸弹撞旗按 BOMB_ON_FLAG_WINS 也算成功；
 *  - 地雷：工兵挖得掉，炸弹同尽，其余棋子回营休息；
 *  - 炸弹：和任何棋子相遇都是两子同尽；
 *  - 其余：号数大的留下，同号两子同尽。
 */
export function combat(a: Kind, b: Kind): CombatResult {
  if (b === "junqi") {
    if (a === "zhadan") {
      return BOMB_ON_FLAG_WINS
        ? { outcome: "both", flagTaken: true }
        : { outcome: "both", flagTaken: false };
    }
    return { outcome: "attacker", flagTaken: true };
  }
  if (b === "dilei") {
    if (a === "gongbing") return { outcome: "attacker", flagTaken: false };
    if (a === "zhadan") return { outcome: "both", flagTaken: false };
    return { outcome: "defender", flagTaken: false };
  }
  if (a === "zhadan" || b === "zhadan") return { outcome: "both", flagTaken: false };
  if (RANK[a] > RANK[b]) return { outcome: "attacker", flagTaken: false };
  if (RANK[a] < RANK[b]) return { outcome: "defender", flagTaken: false };
  return { outcome: "both", flagTaken: false };
}

/** 地雷与军旗永远不动；进了大本营的棋子也不能再动 */
export function movablePiece(board: readonly Cell[], from: Pos): boolean {
  const p = board[from];
  if (!p) return false;
  if (p.kind === "dilei" || p.kind === "junqi") return false;
  if (inHQ(from)) return false;
  return true;
}

/** 这一步能不能落下去：空格随便进，对方的子要能撞得着（行营里的撞不着），自己人挡路不行 */
function canLand(board: readonly Cell[], from: Pos, to: Pos): boolean {
  const me = board[from];
  if (!me) return false;
  const t = board[to];
  if (!t) return true;
  if (t.side === me.side) return false;
  return !inCamp(to);
}

/** 公路：一次只走一格（行营的四条斜线也算公路） */
export function roadMoves(board: readonly Cell[], from: Pos): Pos[] {
  if (!movablePiece(board, from)) return [];
  return ROAD_ADJ[from].filter((to) => canLand(board, from, to));
}

/**
 * 铁路：直线上没子挡就能走任意格。
 * 只有工兵能在铁路上拐弯——工兵用 BFS 求可达集合，别人只沿着四个方向直着推。
 */
export function railMoves(board: readonly Cell[], from: Pos, isEngineer: boolean): Pos[] {
  if (!movablePiece(board, from)) return [];
  if (!isRail(from)) return [];
  const out = new Set<Pos>();

  if (!isEngineer) {
    for (const first of RAIL_ADJ[from]) {
      const dr = rowOf(first) - rowOf(from);
      const dc = colOf(first) - colOf(from);
      let next = first;
      for (;;) {
        if (board[next]) {
          if (canLand(board, from, next)) out.add(next);
          break;
        }
        out.add(next);
        const step = RAIL_ADJ[next].find(
          (n) => rowOf(n) - rowOf(next) === dr && colOf(n) - colOf(next) === dc
        );
        if (step === undefined) break;
        next = step;
      }
    }
    return [...out].sort((a, b) => a - b);
  }

  // 工兵：沿着铁路网到处爬，空格才能继续往下传，碰到子就停在那儿
  const seen = new Set<Pos>([from]);
  const queue: Pos[] = [from];
  while (queue.length) {
    const cur = queue.shift() as Pos;
    for (const n of RAIL_ADJ[cur]) {
      if (seen.has(n)) continue;
      seen.add(n);
      if (board[n]) {
        if (canLand(board, from, n)) out.add(n);
        continue;
      }
      out.add(n);
      queue.push(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/** 一枚子这一手能去的全部格子 */
export function movesFrom(board: readonly Cell[], from: Pos): Pos[] {
  const p = board[from];
  if (!p) return [];
  const set = new Set<Pos>(roadMoves(board, from));
  for (const t of railMoves(board, from, p.kind === "gongbing")) set.add(t);
  return [...set].sort((a, b) => a - b);
}

/** 这一步是不是在铁路上拐了弯（只有工兵做得到，暗棋推理靠它） */
export function isRailTurn(board: readonly Cell[], from: Pos, to: Pos): boolean {
  if (!isRail(from) || !isRail(to)) return false;
  if (ROAD_ADJ[from].includes(to)) return false;
  return !railMoves(board, from, false).includes(to);
}

/** 某一方这一手全部能走的步 */
export function legalMoves(board: readonly Cell[], side: Side): Move[] {
  const out: Move[] = [];
  for (let from = 0; from < board.length; from++) {
    const p = board[from];
    if (!p || p.side !== side) continue;
    for (const to of movesFrom(board, from)) out.push({ from, to });
  }
  return out;
}

export function hasMoves(board: readonly Cell[], side: Side): boolean {
  for (let from = 0; from < board.length; from++) {
    const p = board[from];
    if (!p || p.side !== side) continue;
    if (movesFrom(board, from).length > 0) return true;
  }
  return false;
}

export function findPiece(board: readonly Cell[], side: Side, kind: Kind): Pos | null {
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (p && p.side === side && p.kind === kind) return i;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 局面
// ---------------------------------------------------------------------------

export interface PieceInfo {
  id: number;
  side: Side;
  kind: Kind;
}

export type GameEvent =
  | {
      t: "move";
      side: Side;
      piece: PieceInfo;
      from: Pos;
      to: Pos;
      /** 走的是铁路 */
      rail: boolean;
      /** 在铁路上拐了弯 */
      turned: boolean;
    }
  | {
      t: "combat";
      side: Side;
      at: Pos;
      attacker: PieceInfo;
      defender: PieceInfo;
      outcome: CombatOutcome;
      flagTaken: boolean;
    }
  | { t: "flagShown"; side: Side; at: Pos };

export interface Outcome {
  /** null 表示和局 */
  winner: Side | null;
  why: string;
}

export interface GameState {
  cells: Cell[];
  turn: Side;
  plies: number;
  /** 连着多少手没吃子了 */
  sinceCapture: number;
  history: GameEvent[];
  /** 司令回营之后，这一方的军旗位置就公开了 */
  flagShown: Record<Side, boolean>;
  /** 闯关的守备队关：星星按兵不动，也不会因为不动而判负 */
  garrison: boolean;
  outcome: Outcome | null;
}

export interface StateOptions {
  turn?: Side;
  garrison?: boolean;
}

export function makeState(cells: Cell[], opts: StateOptions = {}): GameState {
  return {
    cells: cells.slice(),
    turn: opts.turn ?? "duo",
    plies: 0,
    sinceCapture: 0,
    history: [],
    flagShown: { duo: false, star: false },
    garrison: opts.garrison ?? false,
    outcome: null,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    cells: state.cells.slice(),
    turn: state.turn,
    plies: state.plies,
    sinceCapture: state.sinceCapture,
    history: state.history.slice(),
    flagShown: { ...state.flagShown },
    garrison: state.garrison,
    outcome: state.outcome ? { ...state.outcome } : null,
  };
}

/** 一方的司令回营之后，立刻把这一方的军旗亮出来 */
export function revealFlagOnCommanderLoss(state: GameState, side: Side): Pos | null {
  if (findPiece(state.cells, side, "siling") !== null) return null;
  const flag = findPiece(state.cells, side, "junqi");
  if (flag === null) return null;
  if (!state.flagShown[side]) {
    state.flagShown[side] = true;
    state.history.push({ t: "flagShown", side, at: flag });
  }
  return flag;
}

export function drawByNoCapture(state: GameState): boolean {
  return state.sinceCapture >= NO_CAPTURE_DRAW;
}

/** 谁赢了：null 表示还没分出来或者是和局，配合 status 用 */
export function winner(state: GameState): Side | null {
  return status(state).side ?? null;
}

export interface Status {
  kind: "playing" | "win" | "draw";
  side?: Side;
  why: string;
}

export function status(state: GameState): Status {
  if (state.outcome) {
    return state.outcome.winner
      ? { kind: "win", side: state.outcome.winner, why: state.outcome.why }
      : { kind: "draw", why: state.outcome.why };
  }
  if (drawByNoCapture(state)) {
    return { kind: "draw", why: `连着 ${NO_CAPTURE_DRAW} 手谁也没吃到子，这一盘算和。` };
  }
  const idle = state.garrison && state.turn === "star";
  if (!idle && !hasMoves(state.cells, state.turn)) {
    return {
      kind: "win",
      side: other(state.turn),
      why: "对面已经没有子能动了，这一盘收官。",
    };
  }
  return { kind: "playing", why: "" };
}

export interface MoveResult {
  ok: boolean;
  message: string;
  combat?: CombatResult & { at: Pos; attacker: PieceInfo; defender: PieceInfo };
}

function info(p: Piece): PieceInfo {
  return { id: p.id, side: p.side, kind: p.kind };
}

/** 走一手棋。会就地改 state（界面与 AI 都用同一份），非法走法只返回提示不改盘面。 */
export function applyMove(state: GameState, move: Move): MoveResult {
  if (state.outcome) return { ok: false, message: "这一盘已经结束啦。" };
  const me = state.cells[move.from];
  if (!me) return { ok: false, message: "这一格没有棋子。" };
  if (me.side !== state.turn) return { ok: false, message: "现在不是这一方走棋。" };
  if (!movesFrom(state.cells, move.from).includes(move.to)) {
    return { ok: false, message: "这一步走不通，换一格试试。" };
  }

  const rail = railMoves(state.cells, move.from, me.kind === "gongbing").includes(move.to);
  const turned = rail && isRailTurn(state.cells, move.from, move.to);
  const target = state.cells[move.to];
  state.history.push({
    t: "move",
    side: me.side,
    piece: info(me),
    from: move.from,
    to: move.to,
    rail,
    turned,
  });

  let message: string;
  let result: MoveResult["combat"];

  if (!target) {
    state.cells[move.to] = me;
    state.cells[move.from] = null;
    state.sinceCapture += 1;
    message = rail ? "沿着铁路推过去。" : "往前挪一格。";
  } else {
    const c = combat(me.kind, target.kind);
    state.cells[move.from] = null;
    if (c.outcome === "attacker") {
      state.cells[move.to] = me;
      message = `${LABEL[target.kind]}回营休息。`;
    } else if (c.outcome === "defender") {
      state.cells[move.to] = target;
      message = `${LABEL[me.kind]}回营休息，${LABEL[target.kind]}守住了。`;
    } else {
      state.cells[move.to] = null;
      message = `${LABEL[me.kind]}和${LABEL[target.kind]}一起回营休息。`;
    }
    state.sinceCapture = 0;
    result = { ...c, at: move.to, attacker: info(me), defender: info(target) };
    state.history.push({
      t: "combat",
      side: me.side,
      at: move.to,
      attacker: info(me),
      defender: info(target),
      outcome: c.outcome,
      flagTaken: c.flagTaken,
    });
    if (c.flagTaken) {
      state.outcome = { winner: me.side, why: "旗子被扛回来啦！" };
      message = "旗子扛回来啦！";
    }
  }

  revealFlagOnCommanderLoss(state, "duo");
  revealFlagOnCommanderLoss(state, "star");

  state.plies += 1;
  if (!state.outcome) {
    state.turn = state.garrison ? "duo" : other(state.turn);
    const st = status(state);
    if (st.kind === "win") state.outcome = { winner: st.side ?? null, why: st.why };
    else if (st.kind === "draw") state.outcome = { winner: null, why: st.why };
  }

  return { ok: true, message, combat: result };
}

// ---------------------------------------------------------------------------
// 信息集（电子暗棋）
// ---------------------------------------------------------------------------

export interface EnemyFact {
  /** 已经露过面的子，号数是确定的 */
  kind: Kind | null;
  /** 动过的子一定不是地雷、也不是军旗 */
  moved: boolean;
  /** 在铁路上拐过弯的一定是工兵 */
  engineer: boolean;
}

export interface Knowledge {
  facts: Map<number, EnemyFact>;
  /** 对方司令回营之后亮出来的军旗位置 */
  flagAt: Pos | null;
}

function fact(map: Map<number, EnemyFact>, id: number): EnemyFact {
  let f = map.get(id);
  if (!f) {
    f = { kind: null, moved: false, engineer: false };
    map.set(id, f);
  }
  return f;
}

/**
 * 站在 side 这一边，从公开发生过的事情里能推出对方哪些子。
 * 电子裁判每次对撞都会把两枚子翻开给两边看，所以参战过的子从此就是明的。
 */
export function knownInfo(side: Side, history: readonly GameEvent[]): Knowledge {
  const facts = new Map<number, EnemyFact>();
  let flagAt: Pos | null = null;
  for (const ev of history) {
    if (ev.t === "move") {
      if (ev.piece.side === side) continue;
      const f = fact(facts, ev.piece.id);
      f.moved = true;
      if (ev.turned) {
        f.engineer = true;
        f.kind = "gongbing";
      }
      continue;
    }
    if (ev.t === "combat") {
      for (const p of [ev.attacker, ev.defender]) {
        if (p.side === side) continue;
        const f = fact(facts, p.id);
        f.kind = p.kind;
        if (p.kind === "gongbing") f.engineer = true;
      }
      continue;
    }
    if (ev.side !== side) flagAt = ev.at;
  }
  return { facts, flagAt };
}

/** 站在 viewer 这一边，这一格该显示成什么：null 表示只能看到一张背面 */
export function visibleKind(state: GameState, viewer: Side | "all", at: Pos): Kind | null {
  const p = state.cells[at];
  if (!p) return null;
  if (viewer === "all" || p.side === viewer) return p.kind;
  const know = knownInfo(viewer, state.history);
  const f = know.facts.get(p.id);
  if (f?.kind) return f.kind;
  if (know.flagAt === at && p.kind === "junqi") return "junqi";
  return null;
}
