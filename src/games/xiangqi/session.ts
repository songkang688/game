// 对局层的纯逻辑：落子确认、悔棋 / 认输 / 求和的同意流程、残局连胜阶梯、
// level → AI 档的映射、直开第 N 课、交叉点热区。这里一行 DOM 都不碰。
import type { Difficulty } from "./ai";
import { DIFFICULTIES } from "./ai";
import { TOTAL_LEVELS } from "../level99";
import type { Pos } from "./logic";

/* ------------------------------------------------------------------ */
/* 落子确认                                                            */
/* ------------------------------------------------------------------ */

/**
 * 象棋的子大、九宫又挤，手机上一碰就毁一盘，所以**确认落子默认开着**：
 * 点自己的子 → 高亮 → 点落点 → 出半透明预览 → 再点一次才真的走。
 * 桌面鼠标点得准，默认关（还是可以手动打开）。
 */
export function confirmDefault(env: { coarsePointer?: boolean; maxTouchPoints?: number }): boolean {
  if (env.coarsePointer === true) return true;
  if (typeof env.maxTouchPoints === "number" && env.maxTouchPoints > 0) return true;
  if (env.coarsePointer === false) return false;
  // 什么都探测不到时按「手机优先」处理：宁可多点一下，也别走错子
  return true;
}

export interface PickState {
  /** 已经选中的自己的子 */
  from: Pos | null;
  /** 已经预览、等着再点一次确认的落点 */
  pending: Pos | null;
}

export function emptyPick(): PickState {
  return { from: null, pending: null };
}

export type TapKind =
  | "ignore"
  | "select"
  | "reselect"
  | "clear"
  | "preview"
  | "movePreview"
  | "commit"
  | "illegal";

export interface TapResult {
  kind: TapKind;
  state: PickState;
  /** commit 时要走的那一步 */
  move: { from: Pos; to: Pos } | null;
}

export interface TapEnv {
  /** 确认落子开着没有 */
  confirm: boolean;
  /** 现在轮得到这个人走吗 */
  myTurn: boolean;
  /** 这个点上是不是自己的子 */
  mine: boolean;
  /** 这个点是不是选中子的合法落点 */
  legalTarget: boolean;
}

/**
 * 点一下棋盘的状态机。同一个落点点两次才算数；点别处只是换预览点，
 * 点自己的另一个子就是换子；点不能去的地方给一句解释（`illegal`）。
 */
export function tapPoint(state: PickState, at: Pos, env: TapEnv): TapResult {
  if (!env.myTurn) return { kind: "ignore", state, move: null };
  const samePending = state.pending && state.pending.x === at.x && state.pending.y === at.y;
  if (state.from && env.legalTarget) {
    if (!env.confirm) {
      return { kind: "commit", state: emptyPick(), move: { from: state.from, to: at } };
    }
    if (samePending) {
      return { kind: "commit", state: emptyPick(), move: { from: state.from, to: at } };
    }
    return {
      kind: state.pending ? "movePreview" : "preview",
      state: { from: state.from, pending: { x: at.x, y: at.y } },
      move: null,
    };
  }
  if (env.mine) {
    const already = state.from && state.from.x === at.x && state.from.y === at.y;
    if (already) return { kind: "clear", state: emptyPick(), move: null };
    return {
      kind: state.from ? "reselect" : "select",
      state: { from: { x: at.x, y: at.y }, pending: null },
      move: null,
    };
  }
  if (state.from) return { kind: "illegal", state: { from: state.from, pending: null }, move: null };
  return { kind: "clear", state: emptyPick(), move: null };
}

/* ------------------------------------------------------------------ */
/* 悔棋 / 认输 / 求和                                                  */
/* ------------------------------------------------------------------ */

export type AskKind = "undo" | "draw";

export interface AskState {
  kind: AskKind;
  /** 谁提出来的 */
  from: "red" | "black";
  /** 对方同意了没有（人机对局里电脑自动同意悔棋、按局面决定和棋） */
  agreed: boolean;
}

/**
 * 双人同屏时，悔棋和求和都要**两边都点头**：
 * 一个人点「悔棋」只是发起请求，另一边点「同意」才真的退回去。
 * 人机对局里对手是电脑，直接算同意（悔棋）或按 `aiAgrees` 决定（求和）。
 */
export function newAsk(kind: AskKind, from: "red" | "black", twoPlayer: boolean): AskState {
  return { kind, from, agreed: !twoPlayer };
}

export function agreeAsk(ask: AskState, who: "red" | "black"): AskState {
  if (who === ask.from) return ask;
  return { ...ask, agreed: true };
}

/** 双人同屏的悔棋退一步，人机对局退两步（把电脑那一手也一起退回来） */
export function undoSteps(twoPlayer: boolean, history: number): number {
  if (history <= 0) return 0;
  return twoPlayer ? 1 : Math.min(2, history);
}

/** 电脑同不同意和棋：子力差不多、又走了很久才点头 */
export function aiAgreesDraw(materialDiff: number, plies: number): boolean {
  return Math.abs(materialDiff) <= 60 && plies >= 40;
}

/* ------------------------------------------------------------------ */
/* 残局连胜（替代「真·无尽」）                                          */
/* ------------------------------------------------------------------ */

/**
 * 为什么不做真·无尽：象棋一局的终点由将帅决定，没有「同一盘无限下下去」的维度。
 * 硬加计时或者无限补子都会改掉象棋本身的规则，所以用**残局连胜**替代。
 */
export const ENDLESS_REASON =
  "象棋一局的终点是将帅，没有「无限走下去」的玩法：硬加计时或者无限补子都会改掉规则。所以这里用残局连胜代替 —— 一课接一课地解，错一次就结束。";

export interface StreakState {
  /** 这一轮连着解开了几课 */
  wins: number;
  /** 历史最高连胜 */
  best: number;
  /** 这一轮结束了没有 */
  over: boolean;
}

export function newStreak(best = 0): StreakState {
  const b = Number.isFinite(best) ? Math.max(0, Math.round(best)) : 0;
  return { wins: 0, best: b, over: false };
}

export function streakStep(s: StreakState, solved: boolean): StreakState {
  if (s.over) return s;
  if (!solved) return { ...s, over: true };
  const wins = s.wins + 1;
  return { wins, best: Math.max(s.best, wins), over: false };
}

/** 连胜第 n 课（0 基）抽哪一道残局：越连越难，固定顺序，可复现 */
export function streakPuzzle(wins: number, total: number): number {
  const n = Number.isFinite(wins) ? Math.max(0, Math.round(wins)) : 0;
  const t = Math.max(1, Math.round(total));
  // 前几课从简单章节里取，越往后越靠后面的章节
  const step = Math.max(1, Math.floor(t / 24));
  return Math.min(t - 1, (n * step + (n % 3) * 2) % t);
}

export function streakSummary(s: StreakState, best: number): string {
  if (s.wins <= 0) return `第一课就卡住了，再来一次！历史最高连胜 ${best} 课。`;
  if (s.wins >= best) return `连解 ${s.wins} 课，刷新纪录！下一次的目标是 ${s.wins + 1} 课。`;
  return `连解 ${s.wins} 课，离最高纪录 ${best} 课还差 ${best - s.wins} 课。`;
}

/* ------------------------------------------------------------------ */
/* level → AI 档                                                       */
/* ------------------------------------------------------------------ */

/**
 * 平台按关号派难度时用（自由对战）。六档均分 188 关：
 * 1–31 菜鸟、32–62 简单、63–93 普通、94–125 高手、126–156 大师、157–188 地狱。
 * level 是 0 基的，越界一律 clamp 到首尾档。
 */
export const TIER_LEVEL_BOUNDS: readonly number[] = [31, 62, 93, 125, 156, TOTAL_LEVELS];

export function difficultyForLevel(level: number): Difficulty {
  const n = Number.isFinite(level) ? Math.round(level) : 0;
  if (n < 0) return DIFFICULTIES[0];
  for (let i = 0; i < TIER_LEVEL_BOUNDS.length; i++) {
    if (n < TIER_LEVEL_BOUNDS[i]) return DIFFICULTIES[i];
  }
  return DIFFICULTIES[DIFFICULTIES.length - 1];
}

/* ------------------------------------------------------------------ */
/* 直开第 N 课                                                         */
/* ------------------------------------------------------------------ */

/**
 * 把壳层给的课号整理成 0 基下标；给不出就返回 -1（照常回选课地图）。
 * 认三种来源：`api.initialLevel`、地址栏 `?level=N`、hash 里的 `level=N` / `#/xiangqi/N`。
 * 课号是 1 基的，越界一律 clamp 到 1..188。
 */
export function initialLevelOf(
  hint: unknown,
  search = "",
  hash = "",
  total: number = TOTAL_LEVELS,
): number {
  let raw: number | null = null;
  if (typeof hint === "number" && Number.isFinite(hint)) raw = hint;
  else if (typeof hint === "string" && /^\d+$/.test(hint.trim())) raw = Number(hint.trim());
  if (raw === null) {
    const m =
      /[?&]level=(\d+)/.exec(search) ?? /[?&#/]level=(\d+)/.exec(hash) ?? /\/(\d+)\s*$/.exec(hash);
    if (m) raw = Number(m[1]);
  }
  if (raw === null || !Number.isFinite(raw)) return -1;
  const max = Math.max(1, Math.min(total, TOTAL_LEVELS));
  return Math.max(0, Math.min(max - 1, Math.round(raw) - 1));
}

/* ------------------------------------------------------------------ */
/* 交叉点热区                                                          */
/* ------------------------------------------------------------------ */

export interface BoardGeom {
  /** 画布逻辑宽高 */
  width: number;
  height: number;
  /** 左上角第一个交叉点的位置 */
  margin: number;
  /** 交叉点间距 */
  cell: number;
}

/** 交叉点的画布坐标 */
export function pointAt(g: BoardGeom, x: number, y: number): { cx: number; cy: number } {
  return { cx: g.margin + x * g.cell, cy: g.margin + y * g.cell };
}

/** 手指至少要有多大的靶子：44 CSS px（无障碍下限） */
export const MIN_HIT_PX = 44;

/**
 * 命中判定的半径（逻辑像素）。热区不跟着格子缩：
 * 屏幕窄的时候按 44px 反推，保证手指点得到；同时不超过半格，免得点错相邻点。
 */
export function hitRadius(g: BoardGeom, cssWidth: number): number {
  const scale = cssWidth > 0 ? g.width / cssWidth : 1;
  const want = (MIN_HIT_PX / 2) * scale;
  return Math.max(want, g.cell * 0.5);
}

/** 把画布坐标换成交叉点；离最近的交叉点太远就返回 null */
export function pickPoint(g: BoardGeom, cx: number, cy: number, radius: number): Pos | null {
  const x = Math.round((cx - g.margin) / g.cell);
  const y = Math.round((cy - g.margin) / g.cell);
  if (x < 0 || x > 8 || y < 0 || y > 9) return null;
  const p = pointAt(g, x, y);
  if (Math.hypot(cx - p.cx, cy - p.cy) > radius) return null;
  return { x, y };
}
