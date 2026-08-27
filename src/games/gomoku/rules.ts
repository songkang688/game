// 规则纯函数：棋谱解析、棋型判定（活三 / 眠三 / 活四 / 冲四）、禁手与「白方指出禁手」的申告窗口。
// 全部不碰 DOM，UI 只负责把这里的结论画出来。
//
// 两套规则：
//  · 无禁·自由（默认，给低年级）：黑白一视同仁，连成五颗或更多都算赢，长连也算。
//  · 禁手规则（给高年级，可开关，只约束黑棋）：
//      - 长连（黑棋六子以上）当场判负，不用谁来指；
//      - 三三 / 四四要由**白方指出**才算数，UI 给 8 秒按钮，超时视为放弃；
//      - 五连优先：黑棋这一手同时成五又踩禁手，判黑棋赢；
//      - 白棋长连仍然算赢。

import {
  type Board,
  type Player,
  analyzeWindow,
  findWinLine,
  getCell,
  isForbidden,
  lineWindow,
  makeBoard,
  setCell,
} from "./ai";

/* ---------------- 棋谱（给测试与攻略画图用） ---------------- */

export interface Diagram {
  board: Board;
  /** 谱面里用 ✱ 标出来的「待验证的点」，仍然是空点 */
  marks: Array<[number, number]>;
}

const BLACK_CHARS = "●xX★";
const WHITE_CHARS = "○oO☆";
const EMPTY_CHARS = ".。·+";
const MARK_CHARS = "✱*?";

/**
 * 解析一张棋谱：每行一排交叉点，空白字符忽略。
 * `●`/`x` 黑子，`○`/`o` 白子，`.` 空点，`✱`/`*` 是要验证的空点（记进 marks）。
 * 行列数不等时按较大的一边补成正方棋盘。
 */
export function parseDiagram(text: string): Diagram {
  const rows = text
    .split("\n")
    .map((line) => Array.from(line).filter((ch) => !/\s/.test(ch)))
    .filter((cells) => cells.length > 0);
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const size = Math.max(width, rows.length);
  const board = makeBoard(size);
  const marks: Array<[number, number]> = [];
  rows.forEach((cells, y) => {
    cells.forEach((ch, x) => {
      if (BLACK_CHARS.includes(ch)) setCell(board, x, y, 1);
      else if (WHITE_CHARS.includes(ch)) setCell(board, x, y, 2);
      else if (MARK_CHARS.includes(ch)) marks.push([x, y]);
      else if (!EMPTY_CHARS.includes(ch)) {
        throw new Error(`棋谱里看不懂的字符：${ch}`);
      }
    });
  });
  return { board, marks };
}

/* ---------------- 棋型 ---------------- */

export type ShapeName =
  | "five"
  | "liveFour"
  | "rushFour"
  | "liveThree"
  | "sleepThree"
  | "liveTwo"
  | "none";

/** 棋型的中文名（讲棋与攻略共用） */
export const SHAPE_NAME: Record<ShapeName, string> = {
  five: "五连",
  liveFour: "活四",
  rushFour: "冲四",
  liveThree: "活三",
  sleepThree: "眠三",
  liveTwo: "活二",
  none: "普通一手",
};

export interface ShapeCount {
  five: number;
  liveFour: number;
  rushFour: number;
  liveThree: number;
  sleepThree: number;
  liveTwo: number;
}

const DIRS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** p 落在 (x,y) 之后，四个方向上各出现了什么棋型（按方向计数） */
export function shapesAt(b: Board, x: number, y: number, p: Player): ShapeCount {
  const out: ShapeCount = {
    five: 0,
    liveFour: 0,
    rushFour: 0,
    liveThree: 0,
    sleepThree: 0,
    liveTwo: 0,
  };
  if (getCell(b, x, y) !== 0) return out;
  for (const [dx, dy] of DIRS) {
    const pat = analyzeWindow(lineWindow(b, x, y, dx, dy, p));
    if (pat.five) out.five++;
    if (pat.liveFour) out.liveFour++;
    else if (pat.fourDots > 0) out.rushFour++;
    if (pat.liveThree) out.liveThree++;
    else if (pat.sleepThree) out.sleepThree++;
    if (pat.liveTwo) out.liveTwo++;
  }
  return out;
}

/** 这一手最强的棋型是什么（讲棋用一句话就够） */
export function strongestShape(b: Board, x: number, y: number, p: Player): ShapeName {
  const s = shapesAt(b, x, y, p);
  if (s.five > 0) return "five";
  if (s.liveFour > 0) return "liveFour";
  if (s.rushFour > 0) return "rushFour";
  if (s.liveThree > 0) return "liveThree";
  if (s.sleepThree > 0) return "sleepThree";
  if (s.liveTwo > 0) return "liveTwo";
  return "none";
}

/* ---------------- 禁手 ---------------- */

export type ForbiddenKind = "none" | "doubleThree" | "doubleFour" | "overline";

export const FORBIDDEN_NAME: Record<ForbiddenKind, string> = {
  none: "",
  doubleThree: "三三",
  doubleFour: "四四",
  overline: "长连",
};

/** 黑棋这一手踩了哪一种禁手（白棋永远返回 none） */
export function forbiddenKind(b: Board, x: number, y: number, p: Player = 1): ForbiddenKind {
  if (p !== 1) return "none";
  const r = isForbidden(b, x, y);
  if (!r.forbidden) return "none";
  if (r.reason.includes("长连")) return "overline";
  if (r.reason.includes("双四")) return "doubleFour";
  return "doubleThree";
}

export interface RuleSet {
  /** 禁手规则打开没有（只约束黑棋） */
  forbidden: boolean;
}

export interface MoveVerdict {
  /** 落子方这一手直接赢了 */
  win: boolean;
  /** 黑棋踩了什么禁手 */
  kind: ForbiddenKind;
  /** 三三 / 四四：要白方在 8 秒内指出来才算数 */
  claimable: boolean;
  /** 长连：当场判黑棋负，不用谁指 */
  instantLoss: boolean;
  /** 给孩子看的一句话 */
  text: string;
}

/**
 * 判一手棋。**五连优先**：黑棋这一手同时连成五又构成禁手，算黑棋赢。
 * 白棋不受禁手约束，长连照样算赢。
 */
export function judgeMove(b: Board, x: number, y: number, p: Player, rules: RuleSet): MoveVerdict {
  const kind = rules.forbidden ? forbiddenKind(b, x, y, p) : "none";
  setCell(b, x, y, p);
  const line = findWinLine(b, x, y);
  setCell(b, x, y, 0);
  const exactFive = line !== null && line.length === 5;

  if (line && (p === 2 || !rules.forbidden || exactFive)) {
    return { win: true, kind: "none", claimable: false, instantLoss: false, text: "连成五颗，赢啦！" };
  }
  if (kind === "overline") {
    return {
      win: false,
      kind,
      claimable: false,
      instantLoss: true,
      text: "黑棋连成了六颗，长连禁手，这一手不能下。",
    };
  }
  if (kind !== "none") {
    return {
      win: false,
      kind,
      claimable: true,
      instantLoss: false,
      text: `这里是${FORBIDDEN_NAME[kind]}，白棋可以指出禁手哦。`,
    };
  }
  return { win: false, kind: "none", claimable: false, instantLoss: false, text: "" };
}

/* ---------------- 「指出禁手」申告窗口 ---------------- */

export const CLAIM_WINDOW_MS = 8000;

export type ClaimStatus = "pending" | "claimed" | "expired";

export interface ClaimState {
  kind: ForbiddenKind;
  /** 被指着的那一手 */
  x: number;
  y: number;
  openedAt: number;
  deadline: number;
  status: ClaimStatus;
}

/** 黑棋踩了三三 / 四四：开一个 8 秒的窗口给白棋 */
export function openClaim(
  kind: ForbiddenKind,
  x: number,
  y: number,
  now: number,
  windowMs: number = CLAIM_WINDOW_MS
): ClaimState {
  return { kind, x, y, openedAt: now, deadline: now + windowMs, status: "pending" };
}

/** 还剩几秒（向上取整，到点是 0） */
export function claimSecondsLeft(state: ClaimState, now: number): number {
  if (state.status !== "pending") return 0;
  return Math.max(0, Math.ceil((state.deadline - now) / 1000));
}

/** 时间推进：过了 8 秒就作废，白棋放弃了这次机会 */
export function tickClaim(state: ClaimState, now: number): ClaimState {
  if (state.status !== "pending") return state;
  if (now >= state.deadline) return { ...state, status: "expired" };
  return state;
}

/** 白方按下「指出禁手」：窗口还开着才算数 */
export function pressClaim(state: ClaimState, now: number): ClaimState {
  if (state.status !== "pending") return state;
  if (now >= state.deadline) return { ...state, status: "expired" };
  return { ...state, status: "claimed" };
}

/** 申告成功后的判决：黑棋踩禁手，白棋赢 */
export function claimResult(state: ClaimState): { winner: Player | 0; text: string } {
  if (state.status !== "claimed") return { winner: 0, text: "" };
  return {
    winner: 2,
    text: `白棋指出了${FORBIDDEN_NAME[state.kind]}禁手，这一局白棋赢，换个点再来一盘！`,
  };
}
