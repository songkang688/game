// 对局层的纯逻辑：落子确认、提示限次与「只给区域」、连胜阶梯、level→AI 档、
// 直开第 N 题、旧存档迁移。这里一行 DOM 都不碰，index.ts 只负责把结论画出来。

import type { Difficulty } from "./ai";
import { PUZZLES } from "./puzzles";
import {
  TOTAL_LEVELS,
  loadStars,
  saveStar,
  type StorageLike,
} from "../level99";

/* ---------------- 落子确认 ---------------- */

/**
 * 默认要不要「点两次才落子」：手机开、桌面关。
 * 判据按可靠度排：先看指针粗细（触屏一律粗指针），没有这个信息再退回「格子有多小」。
 */
export interface PointerEnv {
  /** matchMedia("(pointer: coarse)") 的结果，触屏为 true */
  coarsePointer?: boolean;
  /** navigator.maxTouchPoints */
  maxTouchPoints?: number;
  /** 棋盘上一格实际占多少 CSS 像素 */
  cellPx?: number;
}

/** 一格窄到这个数以下，手指就按不准了 */
export const TIGHT_CELL_PX = 28;

export function prefersConfirm(env: PointerEnv): boolean {
  if (env.coarsePointer === true) return true;
  if (typeof env.maxTouchPoints === "number" && env.maxTouchPoints > 0) return true;
  if (env.coarsePointer === false) return false;
  if (typeof env.cellPx === "number" && env.cellPx > 0) return env.cellPx < TIGHT_CELL_PX;
  return false;
}

export interface Cell {
  x: number;
  y: number;
}

export interface ConfirmState {
  /** 已经预览、等着再点一次确认的那个点 */
  pending: Cell | null;
}

/**
 * 点一下棋盘的结果：
 * - `commit` 真的落子；
 * - `preview` 只画一个待确认的半透明子；
 * - `move` 换了个待确认的点；
 * - `clear` 取消待确认（点到已有棋子上）；
 * - `ignore` 什么都不做。
 */
export type TapKind = "commit" | "preview" | "move" | "clear" | "ignore";

export interface TapOutcome {
  kind: TapKind;
  cell: Cell | null;
  state: ConfirmState;
}

export function emptyConfirm(): ConfirmState {
  return { pending: null };
}

export interface TapOptions {
  /** 确认模式开着没有 */
  confirm: boolean;
  /** 现在轮得到这个人下吗 */
  myTurn: boolean;
  /** 这个点已经有子了 */
  occupied: boolean;
}

/** 落子确认状态机：同一个点连点两次才算数，点别处只是换预览点。 */
export function tapCell(state: ConfirmState, cell: Cell, opts: TapOptions): TapOutcome {
  if (!opts.myTurn) return { kind: "ignore", cell: null, state };
  if (opts.occupied) return { kind: "clear", cell: null, state: emptyConfirm() };
  if (!opts.confirm) return { kind: "commit", cell, state: emptyConfirm() };
  const p = state.pending;
  if (p && p.x === cell.x && p.y === cell.y) {
    return { kind: "commit", cell, state: emptyConfirm() };
  }
  return { kind: p ? "move" : "preview", cell, state: { pending: { x: cell.x, y: cell.y } } };
}

/* ---------------- 提示 ---------------- */

/** 自由对战每局 3 次 */
export const HINTS_PER_FREE_GAME = 3;
/** 解局每题 1 次，用掉就没有三星 */
export const HINTS_PER_PUZZLE = 1;

export type PlayKind = "free" | "puzzle";

export interface HintState {
  left: number;
  used: number;
}

export function newHints(kind: PlayKind): HintState {
  return { left: kind === "puzzle" ? HINTS_PER_PUZZLE : HINTS_PER_FREE_GAME, used: 0 };
}

export function spendHint(s: HintState): { ok: boolean; state: HintState } {
  if (s.left <= 0) return { ok: false, state: s };
  return { ok: true, state: { left: s.left - 1, used: s.used + 1 } };
}

/** 用过提示就封顶两星（三星只留给自己想出来的） */
export function puzzleStars(hintUsed: boolean): 1 | 2 | 3 {
  return hintUsed ? 2 : 3;
}

export interface HintArea {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 给孩子的一句话，只说方位，不报坐标 */
  text: string;
}

const ROW_WORD = ["上边", "中间那几行", "下边"];
const COL_WORD = ["靠左", "中间", "靠右"];

/** 把一个点说成「棋盘的哪一片」，永远不出现具体行列号 */
export function areaWords(cx: number, cy: number, size: number): string {
  const third = (v: number): number => (v < size / 3 ? 0 : v < (size * 2) / 3 ? 1 : 2);
  const c = third(cx);
  const r = third(cy);
  if (c === 1 && r === 1) return "棋盘正中间";
  return `棋盘${ROW_WORD[r]}${COL_WORD[c]}的那一片`;
}

/**
 * 提示只圈一片区域：以正解为中心的 (2r+1)² 格，再按 rng 随机偏一点，
 * 免得「亮区中心就是答案」变成新的报坐标方式。区域一定包含正解。
 */
export function hintArea(
  mv: Cell,
  size: number,
  radius = 1,
  rng: () => number = Math.random
): HintArea {
  const r = Math.max(1, Math.round(radius));
  const span = r * 2;
  const jx = Math.min(r, Math.max(0, Math.floor(rng() * (r + 1))));
  const jy = Math.min(r, Math.max(0, Math.floor(rng() * (r + 1))));
  let x0 = mv.x - r + jx;
  let y0 = mv.y - r + jy;
  x0 = Math.max(0, Math.min(size - 1 - span, x0));
  y0 = Math.max(0, Math.min(size - 1 - span, y0));
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  const x1 = Math.min(size - 1, x0 + span);
  const y1 = Math.min(size - 1, y0 + span);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return { x0, y0, x1, y1, text: `好棋就在${areaWords(cx, cy, size)}，亮着的格子里自己找找看！` };
}

export function areaContains(a: HintArea, x: number, y: number): boolean {
  return x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1;
}

/* ---------------- 连胜挑战 ---------------- */

/** 从菜鸟起，赢一盘升一档，到地狱封顶 */
export const STREAK_LADDER: readonly Difficulty[] = [
  "novice",
  "easy",
  "normal",
  "smart",
  "master",
  "hell",
];

/** 已经连赢 wins 盘时，下一盘的对手是哪一档 */
export function streakDifficulty(wins: number): Difficulty {
  const i = Number.isFinite(wins) ? Math.max(0, Math.round(wins)) : 0;
  return STREAK_LADDER[Math.min(STREAK_LADDER.length - 1, i)];
}

export interface StreakState {
  /** 这一轮已经连赢几盘 */
  wins: number;
  /** 历史最高连胜（写平台 endlessBest 的就是它） */
  best: number;
  /** 这一轮结束了没有（输一盘就结束） */
  over: boolean;
}

export function newStreak(best = 0): StreakState {
  return { wins: 0, best: Math.max(0, Math.round(best) || 0), over: false };
}

/**
 * 一盘打完：赢了连胜 +1 并升一档，输了（或和棋）这一轮就结束。
 * 平局按「没赢」算：不升档也不清零，直接收摊，免得靠和棋刷分。
 */
export function streakStep(s: StreakState, result: "win" | "loss" | "draw"): StreakState {
  if (s.over) return s;
  if (result !== "win") return { ...s, over: true };
  const wins = s.wins + 1;
  return { wins, best: Math.max(s.best, wins), over: false };
}

export function streakLine(s: StreakState): string {
  if (!s.over) {
    return s.wins === 0
      ? `连胜挑战：从${TIER_SHORT[streakDifficulty(0)]}打起，赢一盘升一档！`
      : `已经连赢 ${s.wins} 盘，下一位是${TIER_SHORT[streakDifficulty(s.wins)]}！`;
  }
  return s.wins === 0
    ? "这一轮到此为止，再来一次就从头开始，别急～"
    : `这一轮连赢 ${s.wins} 盘，最高纪录 ${s.best} 盘。`;
}

/** 连胜播报里用的短名（不带 emoji，读起来顺） */
export const TIER_SHORT: Record<Difficulty, string> = {
  novice: "菜鸟",
  easy: "简单",
  normal: "普通",
  smart: "聪明",
  master: "大师",
  hell: "地狱",
};

/* ---------------- 自由对战的 level → AI 档 ---------------- */

/** 每一档覆盖到第几关为止（1 基，含），最后一档兜到 188 */
export const TIER_LEVEL_BOUNDS: readonly number[] = [30, 60, 90, 120, 150, TOTAL_LEVELS];

/**
 * 平台按关号派难度时用：level 是 0 基的，越界一律 clamp 到首尾档。
 * 六档均分 188 关，保证「关号越大对手越强」是单调的。
 */
export function difficultyForLevel(level: number): Difficulty {
  const n = Number.isFinite(level) ? Math.round(level) : 0;
  if (n < 0) return STREAK_LADDER[0];
  for (let i = 0; i < TIER_LEVEL_BOUNDS.length; i++) {
    if (n < TIER_LEVEL_BOUNDS[i]) return STREAK_LADDER[i];
  }
  return STREAK_LADDER[STREAK_LADDER.length - 1];
}

/* ---------------- 直开第 N 题 ---------------- */

/**
 * 把壳层给的关号整理成 0 基下标；给不出就返回 -1（照常回选关地图）。
 * 认三种来源：`api.initialLevel`、地址栏 `?level=N`、hash 里的 `level=N` / `#/gomoku/N`。
 */
export function initialLevelOf(
  hint: unknown,
  search = "",
  hash = "",
  total: number = TOTAL_LEVELS
): number {
  let raw: number | null = null;
  if (typeof hint === "number" && Number.isFinite(hint)) raw = hint;
  else if (typeof hint === "string" && /^\d+$/.test(hint.trim())) raw = Number(hint.trim());
  if (raw === null) {
    const m = /[?&]level=(\d+)/.exec(search) ?? /[?&#/]level=(\d+)/.exec(hash) ?? /\/(\d+)\s*$/.exec(hash);
    if (m) raw = Number(m[1]);
  }
  if (raw === null || !Number.isFinite(raw)) return -1;
  const max = Math.max(1, Math.min(total, TOTAL_LEVELS));
  // 壳层与地址栏都是 1 基的关号，越界一律 clamp
  return Math.max(0, Math.min(max - 1, Math.round(raw) - 1));
}

/* ---------------- 旧存档迁移 ---------------- */

/** 1.0/1.1 时代五子棋自建的战役存档 key（迁完就删） */
export const LEGACY_CAMPAIGN_KEY = "yiduo.gomoku.campaign.v2";

export interface MigrationResult {
  /** 这次真的读到并搬走了旧存档 */
  migrated: boolean;
  /** 搬过来多少关的星级（只算比现有成绩更好的那些） */
  moved: number;
  /** 迁移之后的 188 关星级 */
  stars: number[];
}

/** 把任意来源的旧存档整理成长度 188 的星级数组 */
export function parseLegacyStars(raw: unknown): number[] {
  const src: unknown = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? (raw as { stars?: unknown }).stars
      : null;
  const arr = Array.isArray(src) ? src : [];
  const out = new Array<number>(TOTAL_LEVELS).fill(0);
  for (let i = 0; i < TOTAL_LEVELS && i < arr.length; i++) {
    const v: unknown = arr[i];
    if (typeof v === "number" && Number.isFinite(v)) out[i] = Math.max(0, Math.min(3, Math.round(v)));
  }
  return out;
}

/**
 * 旧战役存档只读一次：逐关取最大值并进框架的 `yiduo-yixing.l99.gomoku`，
 * 然后把旧 key 删掉。**一颗星都不会丢**，而且重复调用是幂等的。
 */
export function migrateLegacyCampaign(
  storage: StorageLike | null | undefined,
  gameId = "gomoku"
): MigrationResult {
  const store = storage;
  let raw: string | null = null;
  try {
    raw = store ? store.getItem(LEGACY_CAMPAIGN_KEY) : null;
  } catch {
    raw = null;
  }
  if (!raw) return { migrated: false, moved: 0, stars: loadStars(gameId, store) };

  let legacy: number[];
  try {
    legacy = parseLegacyStars(JSON.parse(raw) as unknown);
  } catch {
    legacy = [];
  }
  let stars = loadStars(gameId, store);
  let moved = 0;
  for (let i = 0; i < legacy.length; i++) {
    if (legacy[i] > stars[i]) {
      stars = saveStar(gameId, i, legacy[i], store);
      moved++;
    }
  }
  try {
    store?.removeItem?.(LEGACY_CAMPAIGN_KEY);
  } catch {
    // 删不掉也没关系：下次迁移取的还是最大值，不会掉星
  }
  return { migrated: true, moved, stars };
}

/* ---------------- 解局关卡 ---------------- */

/** 第 level 关（0 基）对应哪一道残局 */
export function puzzleOfLevel(level: number): number {
  const n = Number.isFinite(level) ? Math.round(level) : 0;
  return Math.max(0, Math.min(PUZZLES.length - 1, n));
}
