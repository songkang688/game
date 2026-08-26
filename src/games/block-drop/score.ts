/**
 * 方块叠叠乐 · 重力、锁定延迟、小凸转身、计分与垃圾行(全是纯函数)。
 */
import { GARBAGE_CELL, type Board } from "./board";
import type { PieceId, Rot } from "./pieces";

/** 落地之后还能再挪多久(毫秒) */
export const LOCK_DELAY = 500;
/** 挪一下能重置延迟,但最多重置这么多次,免得一直拖着不落 */
export const MAX_LOCK_RESETS = 15;
/** 每消这么多行升一级 */
export const LINES_PER_LEVEL = 10;
/** 等级上限 */
export const MAX_LEVEL = 15;

/** 每一级下落一格要多少毫秒,等级越高越快 */
const GRAVITY_MS: number[] = [1000, 793, 618, 473, 355, 262, 190, 135, 94, 64, 43, 28, 18, 11, 7, 5];

/** 等级 → 下落一格的毫秒数 */
export function gravity(level: number): number {
  const lv = Math.max(0, Math.min(MAX_LEVEL, Math.round(Number.isFinite(level) ? level : 0)));
  return GRAVITY_MS[lv];
}

/** 消了多少行 → 现在几级 */
export function levelOf(lines: number, start = 0): number {
  const n = Math.max(0, Math.round(Number.isFinite(lines) ? lines : 0));
  return Math.min(MAX_LEVEL, Math.max(0, Math.round(start)) + Math.floor(n / LINES_PER_LEVEL));
}

export interface LockState {
  /** 已经在地上待了多久(毫秒) */
  timer: number;
  /** 用掉几次重置 */
  resets: number;
}

export interface LockStep {
  timer: number;
  resets: number;
  /** 该锁死了 */
  locked: boolean;
}

/**
 * 落地计时走一帧。
 * 悬空就清零;贴着地就累计,累计满 LOCK_DELAY 就锁。
 */
export function lockStep(state: LockState, dtMs: number, grounded: boolean): LockStep {
  if (!grounded) return { timer: 0, resets: state.resets, locked: false };
  const timer = Math.max(0, state.timer) + Math.max(0, Number.isFinite(dtMs) ? dtMs : 0);
  return { timer, resets: state.resets, locked: timer >= LOCK_DELAY };
}

/**
 * 成功挪动或者转动之后重置延迟。
 * 重置次数用完就不给了 —— 这样拖不下去,但也不会突然锁死。
 */
export function lockReset(state: LockState): LockState {
  if (state.resets >= MAX_LOCK_RESETS) return { timer: state.timer, resets: state.resets };
  return { timer: 0, resets: state.resets + 1 };
}

export type TSpinKind = "none" | "mini" | "full";

/** 小凸的四个角在场地上的坐标(方框是 3×3,角就是四个顶点) */
export function tCorners(x: number, y: number): { x: number; y: number }[] {
  return [
    { x, y },
    { x: x + 2, y },
    { x, y: y + 2 },
    { x: x + 2, y: y + 2 }
  ];
}

function occupied(board: Board, x: number, y: number): boolean {
  const cols = board[0]?.length ?? 10;
  if (x < 0 || x >= cols) return true; // 墙外算被占
  if (y >= board.length) return true; // 地板算被占
  if (y < 0) return false;
  return board[y][x] !== 0;
}

/**
 * 小凸转身判定(三角规则)。
 * 必须是「靠旋转塞进去的」,并且四个角里至少三个被占。
 * 朝向那一侧的两个前角都被占 → 完整转身;只占一个 → mini。
 */
export function detectTSpin(
  board: Board,
  id: PieceId,
  rot: Rot,
  x: number,
  y: number,
  lastMoveWasRotate: boolean,
  kickIndex = 0
): TSpinKind {
  if (id !== "T" || !lastMoveWasRotate) return "none";
  const corners = tCorners(x, y);
  const filled = corners.map((c) => occupied(board, c.x, c.y));
  const total = filled.filter(Boolean).length;
  if (total < 3) return "none";
  // 四个角按 rot 分成「凸起朝向的两个前角」和「后面两个」
  // corners 顺序:左上(0) 右上(1) 左下(2) 右下(3)
  const FRONT: Record<Rot, [number, number]> = {
    0: [0, 1],
    1: [1, 3],
    2: [2, 3],
    3: [0, 2]
  };
  const [f1, f2] = FRONT[rot];
  const frontBoth = filled[f1] && filled[f2];
  // 用了最后一组偏移(踢得最远的那一次)按规范也算完整转身
  if (frontBoth || kickIndex === 4) return "full";
  return "mini";
}

export interface ScoreInput {
  /** 这一次消了几行 */
  lines: number;
  tspin: TSpinKind;
  level: number;
  /** 上一次是不是也打出了满四行或者转身消 */
  backToBack: boolean;
  /** 连击数:第几次连着消行,0 表示这是第一次 */
  combo: number;
  /** 软降了几格 */
  softDrop?: number;
  /** 硬降了几格 */
  hardDrop?: number;
}

export interface ScoreResult {
  points: number;
  /** 这一手之后连续消还算不算续上 */
  backToBack: boolean;
  /** 这一手之后的连击数 */
  combo: number;
  /** 给孩子看的一句话 */
  label: string;
}

const LINE_POINTS = [0, 100, 300, 500, 800];
const TSPIN_POINTS = [400, 800, 1200, 1600];
const TSPIN_MINI_POINTS = [100, 200, 400, 600];
const LINE_LABEL = ["", "一行", "两行", "三行", "满四行"];

/** 这一手算不算「厉害的一手」,续得上连续消 */
export function isB2BMove(lines: number, tspin: TSpinKind): boolean {
  return lines >= 4 || (lines > 0 && tspin !== "none");
}

/** 一手的得分 */
export function scoreFor(input: ScoreInput): ScoreResult {
  const lines = Math.max(0, Math.min(4, Math.round(input.lines)));
  const level = Math.max(0, Math.round(input.level));
  const soft = Math.max(0, Math.round(input.softDrop ?? 0));
  const hard = Math.max(0, Math.round(input.hardDrop ?? 0));
  let base = 0;
  let label = "";

  if (input.tspin === "full") {
    base = TSPIN_POINTS[lines] ?? 0;
    label = lines > 0 ? `小凸转身 · ${LINE_LABEL[lines]}` : "小凸转身";
  } else if (input.tspin === "mini") {
    base = TSPIN_MINI_POINTS[lines] ?? 0;
    label = lines > 0 ? `小转身 · ${LINE_LABEL[lines]}` : "小转身";
  } else {
    base = LINE_POINTS[lines] ?? 0;
    label = LINE_LABEL[lines];
  }

  const strong = isB2BMove(lines, input.tspin);
  const chained = strong && input.backToBack;
  if (chained) {
    base = Math.round(base * 1.5);
    label = `连续 ${label}`;
  }

  const combo = lines > 0 ? Math.max(0, Math.round(input.combo)) + 1 : 0;
  const comboBonus = combo > 1 ? 50 * (combo - 1) * (level + 1) : 0;
  if (combo > 1) label = `${label} · ${combo} 连击`;

  const points = base * (level + 1) + comboBonus + soft + hard * 2;
  return {
    points,
    // 没消行的时候连续消状态原样保留,消了行才根据这一手决定续不续
    backToBack: lines === 0 ? input.backToBack : strong,
    combo,
    label
  };
}

/** 消 n 行给对手发几条垃圾行 */
export function garbageFor(lines: number, tspin: TSpinKind = "none", backToBack = false): number {
  const n = Math.max(0, Math.min(4, Math.round(lines)));
  const base = [0, 0, 1, 2, 4][n];
  const bonus = tspin === "full" && n > 0 ? n * 2 : 0;
  const chain = backToBack && isB2BMove(n, tspin) ? 1 : 0;
  return base + bonus + chain;
}

export interface CancelResult {
  /** 抵消之后还剩多少要往自己身上落 */
  incoming: number;
  /** 抵消之后还能发出去多少 */
  outgoing: number;
}

/**
 * 抵消:自己消行发出去的垃圾先去顶掉待落到自己场地上的垃圾,剩下的才发给对手。
 */
export function cancelGarbage(incoming: number, outgoing: number): CancelResult {
  const inc = Math.max(0, Math.round(Number.isFinite(incoming) ? incoming : 0));
  const out = Math.max(0, Math.round(Number.isFinite(outgoing) ? outgoing : 0));
  const eaten = Math.min(inc, out);
  return { incoming: inc - eaten, outgoing: out - eaten };
}

export interface HoldResult {
  /** 换完之后暂存格里放的是谁 */
  held: PieceId;
  /** 接着要控制的块;null 表示暂存格原来是空的,得从队列再取一个 */
  next: PieceId | null;
  /** 这一颗块还能不能再存(存过一次就不行了) */
  locked: boolean;
  /** 这一次换成功了没有 */
  ok: boolean;
}

/**
 * 暂存:把手上的块放进暂存格,把原来存着的换出来。
 * 同一颗块只能存一次,存过就得先把它放下去才能再存。
 */
export function holdSwap(cur: PieceId, held: PieceId | null, locked: boolean): HoldResult {
  if (locked) return { held: held ?? cur, next: cur, locked: true, ok: false };
  return { held: cur, next: held, locked: true, ok: true };
}

/** 结束时给孩子的话:只鼓励,不说输 */
export function overLine(lines: number, score: number): string {
  return `叠得好高呀,下一局再来！这一局消了 ${Math.max(0, Math.round(lines))} 行,拿了 ${Math.max(0, Math.round(score))} 分。`;
}

/** 垃圾行的颜色编号再导出一次,画面层要用 */
export { GARBAGE_CELL };
