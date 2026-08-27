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

/**
 * 摘掉落空的预览点：预览点所在的格子只要不再是空的（对手占了、悔棋改了盘面、
 * 换了一副棋盘），这个 `pending` 就该作废。
 *
 * 这条约束本来只写在视图里 —— `view.ts` 画粉圈之前自己查了一次「这一格还空着吗」，
 * 状态层却没有同一道闸，全靠 `index.ts` 每一处落子 / 悔棋都记得手动清一次。
 * 放回纯函数之后，视图和状态用的是同一把尺，往后新增落子路径也不会漏。
 *
 * `isEmpty` 由调用方给：传进来的是「这一格还空着吗」，不是「有子吗」。
 */
export function pruneConfirm(state: ConfirmState, isEmpty: (cell: Cell) => boolean): ConfirmState {
  const p = state.pending;
  if (!p) return state;
  return isEmpty(p) ? state : emptyConfirm();
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

/* ---------------- 键盘光标的读屏播报 ---------------- */

export interface CursorInfo {
  /** 光标这一格上是什么：0 空、1 黑棋、2 白棋 */
  at: 0 | 1 | 2;
  /** 这一格正是等着再确认一次的预览点 */
  pending?: boolean;
  /** 现在轮得到这个人下 */
  interactive?: boolean;
  /** 确认落子开着没有 */
  confirm?: boolean;
}

/**
 * 键盘光标走到哪儿就播到哪儿。
 *
 * 棋盘是一块 `role="application"` 的 canvas，方向键把光标挪遍全盘、
 * 屏幕上跟着画十字准星，但 accessibility tree 上原先**一个字都不变**：
 * 看不清屏幕的孩子按了半天方向键，既不知道自己停在哪儿，也不知道那一格有没有子，
 * 更不知道按回车是直接落子还是先出一个预览。
 *
 * 这句话报的是**光标自己的位置**，和提示不是一回事 —— 提示只圈一片区域、
 * 永远不报行列号（`hintArea`），那条口径不受这里影响。
 */
export function cursorLabel(cell: Cell, size: number, info: CursorInfo): string {
  const n = Math.max(1, Math.round(size) || 1);
  const row = Math.max(1, Math.min(n, Math.round(cell.y) + 1));
  const col = Math.max(1, Math.min(n, Math.round(cell.x) + 1));
  const mid = Math.floor(n / 2);
  const spot = row - 1 === mid && col - 1 === mid ? "，正中间天元" : "";
  const what =
    info.at === 1
      ? "这里是黑棋"
      : info.at === 2
        ? "这里是白棋"
        : info.pending
          ? "这里是等着确认的预览点"
          : "这里是空点";
  const next = !info.interactive
    ? "现在轮不到你，先等一等"
    : info.at !== 0
      ? "这一格有子了，换个空点"
      : info.pending
        ? "再按一次回车就落子"
        : info.confirm
          ? "按回车先出预览，再按一次才落子"
          : "按回车落子";
  // 位置放最前面、操作说明垫最后：读屏器可以随时打断，先听到的永远是「我在哪儿」
  return `棋盘第 ${row} 行第 ${col} 列${spot}。${what}。${next}；方向键换位置。`;
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

/**
 * 提示按钮上的说明：解局里用掉提示这题就封顶两星，这个代价得在**点下去之前**说清楚，
 * 不能等结算时才告诉孩子「用了提示只有 2 星」。用完了也要有一句话，
 * 而不是只剩一个灰掉的按钮。
 */
export function hintButtonHint(s: HintState, kind: PlayKind): string {
  if (s.left <= 0) {
    return kind === "puzzle" ? "这一题的提示用完啦，自己再看看棋形～" : "这一局的提示用完啦，自己找找看～";
  }
  if (kind === "puzzle") return `提示还有 ${s.left} 次；用了这一题最多拿 2 星哦。`;
  return s.left === 1 ? "提示只剩最后 1 次啦，想清楚再点～" : `提示还有 ${s.left} 次，只圈一片区域。`;
}

/**
 * 真的用掉一次提示之后说的话：在区域文案后面接一句「还剩几次」。
 * `spent` 是**花完之后**的状态，`left === 0` 就是刚刚用掉了最后一次。
 */
export function hintSpentLine(area: HintArea, spent: HintState, kind: PlayKind): string {
  if (kind === "puzzle") return `${area.text}（这一题用过提示，最多 2 星）`;
  if (spent.left <= 0) return `${area.text}（这是最后一次提示啦）`;
  return `${area.text}（提示还剩 ${spent.left} 次）`;
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

/**
 * 这一盘赢下来算不算「刷新了纪录」。`prevBest` 是**这一盘之前**的历史最高
 * （`streakStep` 会把 `best` 抬到 `wins`，所以事后再比 `s.best` 是比不出来的）。
 * 第一次玩（还没有纪录）不算破纪录，那时候每一盘都是纪录，说了也没意思。
 */
export function brokeRecord(prevBest: number, s: StreakState): boolean {
  const b = Number.isFinite(prevBest) ? Math.max(0, Math.round(prevBest)) : 0;
  return b > 0 && s.wins > b;
}

/**
 * 连胜进行时的纪录播报：一整轮里都看得见自己离最高纪录还差几盘。
 * 以前只有这一轮结束后的 `streakSummary` 提纪录，打到一半的孩子完全不知道自己的位置。
 * 还没有纪录（第一次玩）就不说，免得平白多一句话。
 */
export function streakRecordLine(s: StreakState): string {
  if (s.best <= 0) return "";
  if (s.wins >= s.best) return `这一轮已经是最高纪录 ${s.best} 盘，再赢一盘就再往上刷一格！`;
  const gap = s.best - s.wins;
  return gap === 1
    ? `再赢 1 盘就追平最高纪录 ${s.best} 盘！`
    : `最高纪录 ${s.best} 盘，还差 ${gap} 盘追平。`;
}

/**
 * 开局播报：进行时的连胜播报 + 纪录播报 + 这一档什么脾气。
 *
 * 六档各有一句 `DIFFICULTY_BLURB`，自由对战的开局播报里一直有，
 * 连胜挑战里原先**没有**：下一档的脾气只在上一盘的结算浮层上闪一次，
 * 点掉「继续挑战」就再也看不见；第 1 盘更是压根没有任何一档说明。
 *
 * `blurb` 由调用方传（`session.ts` 不依赖 `ai.ts` 的运行时导出），
 * 不传就是原来那句，老口径一字不变。
 */
export function streakOpening(s: StreakState, blurb = ""): string {
  const rec = streakRecordLine(s);
  const head = rec ? `${streakLine(s)}${rec}` : streakLine(s);
  const tip = typeof blurb === "string" ? blurb.trim().replace(/[。.]+$/, "") : "";
  return tip ? `${head}这一档的脾气：${tip}。` : head;
}

/** 赢下一盘之后的标题：刷新纪录那一盘要看得出来和平常不一样。 */
export function streakWinTitle(prevBest: number, s: StreakState): string {
  return brokeRecord(prevBest, s) ? `🏆 新纪录 ${s.wins} 盘！` : `🎉 连赢 ${s.wins} 盘！`;
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
