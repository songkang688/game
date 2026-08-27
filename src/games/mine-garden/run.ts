/**
 * 扫雷花园 · 一局的状态机（纯逻辑，不碰 DOM，也不自己看表）。
 *
 * 时间一律由调用方把 `now` 传进来，所以单测可以随便造时间线，
 * 界面那边则用 `performance.now()`。
 */
import {
  FLAG,
  HIDDEN,
  OPEN,
  autoFlagRest,
  chord,
  cloneBoard,
  createBoard,
  flagCount,
  flagsLeft,
  floodOpen,
  lost,
  moveCursor,
  progress,
  replantMines,
  revealOrder,
  safeLeft,
  toggleFlag,
  won,
  wrongFlags,
  type Board,
  type Dir,
  type FlagOutcome
} from "./board";
import { generateNoGuess, type GenerateOptions } from "./solver";

export interface RunOptions {
  w: number;
  h: number;
  mines: number;
  /** 布种用的确定性种子 */
  seed: number;
  /** 这一盘要不要走无猜生成 */
  noGuess?: boolean;
  /** 第一次踩到刺种给一次保护（小铲子挡下来，改成插旗） */
  protect?: boolean;
  /** 最多能同时插几面小旗；不传就不限 */
  flagLimit?: number;
  /** 迷雾园：只照亮光标周围 3×3（纯显示） */
  fog?: boolean;
  /** 倒计时（毫秒）；不传就不限时 */
  timeLimitMs?: number;
  /** 允许问号档 */
  useGuess?: boolean;
  /** 生成器预算，测试里可以调小 */
  generate?: GenerateOptions;
}

export type RunPhase = "idle" | "playing" | "won" | "lost";

export interface Run {
  opts: Required<Pick<RunOptions, "w" | "h" | "mines" | "seed">> & RunOptions;
  board: Board;
  phase: RunPhase;
  /** 已经点过第一下（计时从这一下开始） */
  started: boolean;
  startedAt: number;
  endedAt: number;
  /** 首次翻开的那一格 */
  firstIndex: number;
  /** 生成器真的做到了无猜 */
  noGuess: boolean;
  /** 还剩几次保护 */
  protectLeft: number;
  usedProtect: boolean;
  /** 键盘光标 */
  cursor: number;
  /** 这一局翻开过多少次（结算里当「手数」看） */
  moves: number;
  /** 踩到的那一颗刺种在哪儿（没踩过就是 -1） */
  hitAt: number;
}

export function createRun(opts: RunOptions): Run {
  const w = Math.max(1, Math.floor(opts.w));
  const h = Math.max(1, Math.floor(opts.h));
  const mines = Math.max(0, Math.floor(opts.mines));
  return {
    opts: { ...opts, w, h, mines, seed: opts.seed >>> 0 },
    board: createBoard(w, h),
    phase: "idle",
    started: false,
    startedAt: 0,
    endedAt: 0,
    firstIndex: -1,
    noGuess: false,
    protectLeft: opts.protect ? 1 : 0,
    usedProtect: false,
    cursor: Math.floor((w * h) / 2),
    moves: 0,
    hitAt: -1
  };
}

export interface ActionResult {
  kind: "open" | "flag" | "chord" | "none";
  /** 本次翻开的格子（按顺序，动画一格一格播） */
  opened: number[];
  /** 翻到了刺种 */
  hit: boolean;
  hitAt: number;
  /** 保护挡下了这一次（刺种改成插旗，本局继续） */
  saved: boolean;
  flag: FlagOutcome;
  win: boolean;
  lose: boolean;
  /** 小旗用完了 */
  blocked: boolean;
  /** 这一下是本局的第一下（刚刚布好种） */
  first: boolean;
}

function noAction(kind: ActionResult["kind"] = "none"): ActionResult {
  return {
    kind,
    opened: [],
    hit: false,
    hitAt: -1,
    saved: false,
    flag: "none",
    win: false,
    lose: false,
    blocked: false,
    first: false
  };
}

/** 首次翻开时才布种：安全区按构造排除，所以第一下永远开出一片空地 */
function plant(run: Run, index: number): void {
  const { w, h, mines, seed } = run.opts;
  const res = generateNoGuess(w, h, mines, index, seed, {
    ...(run.opts.generate ?? {}),
    noGuess: run.opts.noGuess ?? run.opts.generate?.noGuess ?? false
  });
  replantMines(run.board, res.mine);
  run.noGuess = res.noGuess;
  run.firstIndex = index;
}

function settle(run: Run, res: ActionResult, now: number): ActionResult {
  if (won(run.board)) {
    run.phase = "won";
    run.endedAt = now;
    autoFlagRest(run.board);
    res.win = true;
  } else if (lost(run.board)) {
    run.phase = "lost";
    run.endedAt = now;
    res.lose = true;
  }
  return res;
}

/**
 * 翻开一格。
 *
 * 踩到刺种时：还有保护就当场把那一颗改成插旗（本局继续，但三星没了），
 * 没保护就本局结束 —— 那一颗种子会在界面上开出一朵花。
 */
export function openAt(run: Run, index: number, now = 0): ActionResult {
  if (run.phase === "won" || run.phase === "lost") return noAction();
  if (index < 0 || index >= run.board.state.length) return noAction();
  if (run.board.state[index] === FLAG) return noAction("open");
  if (run.board.state[index] === OPEN) return noAction("open");

  const res = noAction("open");
  if (!run.started) {
    plant(run, index);
    run.started = true;
    run.startedAt = now;
    run.phase = "playing";
    res.first = true;
  }
  run.moves++;
  const r = floodOpen(run.board, index);
  res.opened = r.opened;
  res.hit = r.hit;
  res.hitAt = r.hitAt;
  if (r.hit && run.protectLeft > 0) {
    run.protectLeft--;
    run.usedProtect = true;
    run.board.state[r.hitAt] = FLAG;
    res.saved = true;
    res.opened = [];
  } else if (r.hit) {
    run.hitAt = r.hitAt;
  }
  run.cursor = index;
  return settle(run, res, now);
}

/** 插旗 / 收旗。第一下就插旗不会触发布种（还没翻开过，计时也不开始）。 */
export function flagAt(run: Run, index: number, now = 0): ActionResult {
  if (run.phase === "won" || run.phase === "lost") return noAction();
  const res = noAction("flag");
  const outcome = toggleFlag(run.board, index, {
    limit: run.opts.flagLimit,
    useGuess: run.opts.useGuess
  });
  res.flag = outcome;
  res.blocked = outcome === "blocked";
  if (outcome !== "none") run.cursor = index;
  return settle(run, res, now);
}

/**
 * 双键和弦：数字格周围旗数正好等于数字时，一次翻开周围没插旗的格子。
 * 旗插错了地方就会真的踩到刺种 —— 和弦是提速手段，不是保险。
 */
export function chordAt(run: Run, index: number, now = 0): ActionResult {
  if (run.phase !== "playing") return noAction();
  const res = noAction("chord");
  const r = chord(run.board, index);
  if (r.opened.length === 0 && !r.hit) return res;
  run.moves++;
  res.opened = r.opened;
  res.hit = r.hit;
  res.hitAt = r.hitAt;
  if (r.hit && run.protectLeft > 0) {
    run.protectLeft--;
    run.usedProtect = true;
    run.board.state[r.hitAt] = FLAG;
    res.saved = true;
    res.opened = r.opened.filter((i) => i !== r.hitAt);
  } else if (r.hit) {
    run.hitAt = r.hitAt;
  }
  run.cursor = index;
  return settle(run, res, now);
}

/** 移光标（键盘玩家）；撞到边就停住 */
export function moveRunCursor(run: Run, dir: Dir): number {
  run.cursor = moveCursor(run.opts.w, run.opts.h, run.cursor, dir);
  return run.cursor;
}

/** 用掉的时间（毫秒）；还没点第一下就是 0 */
export function elapsedMs(run: Run, now: number): number {
  if (!run.started) return 0;
  const end = run.phase === "won" || run.phase === "lost" ? run.endedAt : now;
  return Math.max(0, end - run.startedAt);
}

/** 倒计时剩余（毫秒）；不限时返回 Infinity */
export function timeLeftMs(run: Run, now: number): number {
  const limit = run.opts.timeLimitMs;
  if (typeof limit !== "number" || !Number.isFinite(limit)) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - elapsedMs(run, now));
}

/** 倒计时用完了（限时关靠它判负） */
export function timedOut(run: Run, now: number): boolean {
  return run.started && run.phase === "playing" && timeLeftMs(run, now) <= 0;
}

/** 倒计时用完：本局结束，温柔收场 */
export function expire(run: Run, now: number): void {
  if (run.phase !== "playing") return;
  run.phase = "lost";
  run.endedAt = now;
}

export function runFlagsLeft(run: Run): number {
  return flagsLeft(run.board);
}

export function runFlagCount(run: Run): number {
  return flagCount(run.board);
}

/** 限旗关还能插几面 */
export function flagBudgetLeft(run: Run): number {
  const limit = run.opts.flagLimit;
  if (typeof limit !== "number") return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - flagCount(run.board));
}

export function runProgress(run: Run): number {
  return progress(run.board);
}

export function runSafeLeft(run: Run): number {
  return safeLeft(run.board);
}

/** 输了之后温柔揭开剩下的刺种（离踩中那一格由近到远，界面一颗一颗慢慢开花） */
export function revealRest(run: Run): number[] {
  return revealOrder(run.board, run.hitAt >= 0 ? run.hitAt : run.cursor);
}

/** 复盘：插错地方的小旗 */
export function runWrongFlags(run: Run): number[] {
  return wrongFlags(run.board);
}

export function snapshot(run: Run): Board {
  return cloneBoard(run.board);
}

/** 重开一局：换一个派生 seed，别让孩子把同一张图背下来 */
export function restart(run: Run, seedSalt = 1): Run {
  return createRun({ ...run.opts, seed: (run.opts.seed + seedSalt * 0x9e3779b9) >>> 0 });
}

export { FLAG, HIDDEN, OPEN };
