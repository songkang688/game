/**
 * 翻翻暗棋 · 规则层（纯函数，不碰 DOM）。
 *
 * 一手棋只有两种：翻开一枚盖着的子，或者走一枚自己已经翻开的子。
 * 走子一律只走一格正交；只有炮吃子要隔一个「炮架」。
 */
import {
  RANK,
  between,
  cloneCells,
  dealCovered,
  neighbors,
  rowOf,
  colOf,
  sameLine,
  type Cell,
  type Color,
  type Kind,
  type Piece,
} from "./board";

export type Side = "duo" | "star";

/** 兵能请将去休息，将请不动兵——本款采用这一条 */
export const SOLDIER_BEATS_GENERAL = true;

/** 炮能不能隔子吃盖着的子：本款不行，盖着的子只能被翻开 */
export const CANNON_CAN_TAKE_COVERED = false;

/** 连续多少手既没吃子也没翻子就判和 */
export const QUIET_LIMIT = 20;

export interface GameState {
  cells: Cell[];
  turn: Side;
  /** 还没有人翻第一手时两边都是 null */
  colors: Record<Side, Color | null>;
  /** 连续多少手没吃没翻 */
  quiet: number;
  /** 已经走了多少手 */
  plies: number;
  winner: Side | null;
  draw: boolean;
}

export type Action = { type: "flip"; at: number } | { type: "move"; from: number; to: number };

export function other(s: Side): Side {
  return s === "duo" ? "star" : "duo";
}

export function otherColor(c: Color): Color {
  return c === "red" ? "blue" : "red";
}

export function makeState(cells: Cell[], over: Partial<GameState> = {}): GameState {
  return {
    cells,
    turn: "duo",
    colors: { duo: null, star: null },
    quiet: 0,
    plies: 0,
    winner: null,
    draw: false,
    ...over,
  };
}

export function newGame(seed: number, over: Partial<GameState> = {}): GameState {
  return makeState(dealCovered(seed), over);
}

/** 第一手翻到什么颜色，翻的人就是那一色（翻到「将」也一样算数） */
export function firstFlipColor(state: GameState, at: number): Color | null {
  const p = state.cells[at];
  if (!p || !p.covered) return null;
  return p.color;
}

/** 这一手是不是「只能翻子」的第一手 */
export function mustFlip(state: GameState): boolean {
  return state.colors.duo === null && state.colors.star === null;
}

/**
 * a 能不能把 b 请去休息（不含炮的隔子吃，炮走这条路的时候恒为 false）。
 * 同级可以互吃；兵吃将成立，将吃兵不成立。
 */
export function canCapture(attacker: Piece, target: Piece): boolean {
  if (attacker.color === target.color) return false;
  if (target.covered) return false;
  if (attacker.kind === "cannon") return false; // 炮只能隔子吃，贴身吃不了
  if (SOLDIER_BEATS_GENERAL) {
    if (attacker.kind === "soldier" && target.kind === "general") return true;
    if (attacker.kind === "general" && target.kind === "soldier") return false;
  }
  return RANK[attacker.kind] >= RANK[target.kind];
}

/** 正交一步：空格随便走，敌子看相克表（炮走这一步不能吃） */
export function stepMoves(cells: readonly Cell[], from: number): number[] {
  const p = cells[from];
  if (!p || p.covered) return [];
  const out: number[] = [];
  for (const to of neighbors(from)) {
    const t = cells[to];
    if (!t) {
      out.push(to);
      continue;
    }
    if (canCapture(p, t)) out.push(to);
  }
  return out;
}

/**
 * 炮的隔子吃：同一行或同一列，中间**恰好一个**子（盖着的也算炮架），
 * 落点必须是已经翻开的敌方子。贴身（中间 0 个）吃不了，隔两个也吃不了。
 */
export function cannonCaptures(cells: readonly Cell[], from: number): number[] {
  const p = cells[from];
  if (!p || p.covered || p.kind !== "cannon") return [];
  const out: number[] = [];
  for (let to = 0; to < cells.length; to++) {
    if (to === from || !sameLine(from, to)) continue;
    const t = cells[to];
    if (!t) continue;
    if (t.color === p.color) continue;
    if (t.covered && !CANNON_CAN_TAKE_COVERED) continue;
    const mid = between(from, to).filter((i) => cells[i] !== null);
    if (mid.length !== 1) continue;
    out.push(to);
  }
  return out;
}

/** 一枚子所有能落的点（含炮的隔子吃） */
export function movesFrom(cells: readonly Cell[], from: number): number[] {
  const p = cells[from];
  if (!p || p.covered) return [];
  if (p.kind === "cannon") return [...stepMoves(cells, from), ...cannonCaptures(cells, from)];
  return stepMoves(cells, from);
}

/** 某一方这一手能做的全部动作 */
export function legalActions(state: GameState, side: Side): Action[] {
  if (state.winner || state.draw) return [];
  const out: Action[] = [];
  for (let i = 0; i < state.cells.length; i++) {
    const c = state.cells[i];
    if (c && c.covered) out.push({ type: "flip", at: i });
  }
  const mine = state.colors[side];
  if (!mine) return out; // 还没定阵营：只能翻
  for (let i = 0; i < state.cells.length; i++) {
    const c = state.cells[i];
    if (!c || c.covered || c.color !== mine) continue;
    for (const to of movesFrom(state.cells, i)) out.push({ type: "move", from: i, to });
  }
  return out;
}

/** 盖着的还剩几枚 */
export function coveredCount(state: GameState): number {
  return state.cells.filter((c) => c && c.covered).length;
}

/** 记牌面板用：某一色还有哪些兵种没露过面 */
export function remainingUnknown(state: GameState): Record<Color, Record<Kind, number>> {
  const out: Record<Color, Record<Kind, number>> = {
    red: { general: 0, guard: 0, elephant: 0, chariot: 0, horse: 0, cannon: 0, soldier: 0 },
    blue: { general: 0, guard: 0, elephant: 0, chariot: 0, horse: 0, cannon: 0, soldier: 0 },
  };
  for (const c of state.cells) {
    if (c && c.covered) out[c.color][c.kind] += 1;
  }
  return out;
}

/** 某一色在台面上还有没有「将」 */
export function hasGeneral(state: GameState, color: Color): boolean {
  return state.cells.some((c) => c !== null && c.color === color && c.kind === "general");
}

export interface StepResult {
  ok: boolean;
  /** 这一手吃掉了谁 */
  captured: Piece | null;
  /** 这一手翻开了什么 */
  revealed: Piece | null;
  message: string;
}

/** 走一手（会直接改 state） */
export function applyAction(state: GameState, action: Action): StepResult {
  if (state.winner || state.draw) return { ok: false, captured: null, revealed: null, message: "这一局已经结束啦。" };
  const side = state.turn;

  if (action.type === "flip") {
    const p = state.cells[action.at];
    if (!p || !p.covered) return { ok: false, captured: null, revealed: null, message: "这一格没有盖着的棋子。" };
    p.covered = false;
    if (mustFlip(state)) {
      state.colors[side] = p.color;
      state.colors[other(side)] = otherColor(p.color);
    }
    state.quiet = 0;
    state.plies += 1;
    state.turn = other(side);
    settle(state);
    return { ok: true, captured: null, revealed: p, message: `翻开了一枚${p.color === "red" ? "红" : "蓝"}子。` };
  }

  const p = state.cells[action.from];
  const mine = state.colors[side];
  if (!p || p.covered || !mine || p.color !== mine) {
    return { ok: false, captured: null, revealed: null, message: "这枚棋子不是你的。" };
  }
  if (!movesFrom(state.cells, action.from).includes(action.to)) {
    return { ok: false, captured: null, revealed: null, message: "这一步走不过去。" };
  }
  const target = state.cells[action.to];
  state.cells[action.to] = p;
  state.cells[action.from] = null;
  if (target) {
    state.quiet = 0;
  } else {
    state.quiet += 1;
  }
  state.plies += 1;
  state.turn = other(side);
  settle(state);
  return {
    ok: true,
    captured: target,
    revealed: null,
    message: target ? "请这枚棋子先去休息。" : "走了一步。",
  };
}

/** 每一手之后重新算胜负与和棋 */
export function settle(state: GameState): void {
  if (state.winner || state.draw) return;
  const duoColor = state.colors.duo;
  const starColor = state.colors.star;
  if (duoColor && starColor) {
    if (!hasGeneral(state, starColor)) {
      state.winner = "duo";
      return;
    }
    if (!hasGeneral(state, duoColor)) {
      state.winner = "star";
      return;
    }
  }
  if (state.quiet >= QUIET_LIMIT) {
    state.draw = true;
    return;
  }
  // 轮到的人既无子可动也无盖可翻 → 这一局交给对方
  if (legalActions(state, state.turn).length === 0) {
    state.winner = other(state.turn);
  }
}

export type Status = { kind: "playing" } | { kind: "win"; side: Side } | { kind: "draw" };

export function status(state: GameState): Status {
  if (state.winner) return { kind: "win", side: state.winner };
  if (state.draw) return { kind: "draw" };
  return { kind: "playing" };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    cells: cloneCells(state.cells),
    colors: { ...state.colors },
  };
}

/** 棋盘上某一色还剩的子力总分（AI 与记牌面板都用） */
export function material(state: GameState, color: Color): number {
  let n = 0;
  for (const c of state.cells) {
    if (!c || c.color !== color) continue;
    n += RANK[c.kind] + (c.covered ? 1 : 0);
  }
  return n;
}

/** 界面画格子要用的行列 */
export { rowOf, colOf };
