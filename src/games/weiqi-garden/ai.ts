/**
 * 围子花园 · 会下棋的对手(四档)
 *
 * 全部是本仓库里的纯 TypeScript:气 / 眼位 / 墙 的启发式打分,
 * 地狱档再加一层**很浅的随机模拟**(蒙特卡洛式:从候选点各走若干盘随机快棋,
 * 谁的赢面高就下谁)。**没有 wasm、没有外部棋力引擎、没有任何模型文件**,
 * 离线打开就能下。
 *
 * | 档 | 行为 |
 * | --- | --- |
 * | 菜鸟 | 随机合法点(不自尽、不填自己的眼) |
 * | 普通 | 能提就提、被打吃会逃、会长气 |
 * | 高手 | 再加占角占边与星位、贴身与补断点 |
 * | 地狱 | 高手打分选出候选,再用浅层随机模拟挑最稳的一手 |
 *
 * 模拟次数(`playouts`)与候选宽度(`candidates`)都能从外面传,
 * 界面用默认值保证 9 路一手 ≤ 1 秒,单测里调低几档跑得飞快。
 */
import {
  BLACK,
  EMPTY,
  WHITE,
  cloneBoard,
  diagonalTable,
  groupAt,
  neighborTable,
  other,
  positionHash,
  starPoints,
  xy,
  type Board,
  type BoardSize,
  type Color
} from "./board";
import { autoDeadStones, isTrueEye } from "./life";
import { finalScore, komiFor, type Winner } from "./score";
import { createGame, legalMoves, passMove, play, playMove, type GameState, type ScoreRule } from "./rules";
import { mulberry32 } from "../level99";

export type AiTier = "rookie" | "normal" | "expert" | "master";

export const AI_TIERS: readonly AiTier[] = ["rookie", "normal", "expert", "master"];

export const AI_TIER_LABELS: Record<AiTier, string> = {
  rookie: "菜鸟",
  normal: "普通",
  expert: "高手",
  master: "地狱"
};

export const AI_TIER_HINTS: Record<AiTier, string> = {
  rookie: "随手下,哪儿空就往哪儿放,适合刚学会规则的时候。",
  normal: "能提子就提,自己被打吃了会逃,会给自己长气。",
  expert: "会先占角再占边,九路上盯着星位,还会补断点。",
  master: "先挑几个好点,再各走几盘快棋试试,哪一手赢面大就下哪一手。"
};

/** 每档的默认模拟参数;只有地狱档真的会做模拟 */
export interface AiOptions {
  ko: number | null;
  history: ReadonlySet<string> | null;
  rand: () => number;
  /** 候选宽度:先按启发式挑这么多个点,再拿去模拟 */
  candidates: number;
  /** 每个候选点走几盘随机快棋;0 表示纯启发式 */
  playouts: number;
  /** 一盘随机快棋最多走多少手 */
  maxPlayoutMoves: number;
  /** 模拟里判胜负用的贴还 */
  komi: number;
  /** 领先并且找不到好点时允许停一手(自由对战用,模拟里永远关着) */
  allowPass: boolean;
}

export function defaultAiOptions(tier: AiTier, size: number): AiOptions {
  // 9 路地狱档:6 个候选 × 24 盘 × 最多 120 手,实测远低于 1 秒的预算
  const wide = size <= 9 ? 6 : size <= 13 ? 5 : 4;
  const sims = size <= 9 ? 24 : size <= 13 ? 12 : 6;
  return {
    ko: null,
    history: null,
    rand: Math.random,
    candidates: tier === "master" ? wide : 1,
    playouts: tier === "master" ? sims : 0,
    maxPlayoutMoves: size * size + size * 2,
    komi: komiFor("chinese", 0),
    allowPass: true
  };
}

// ---------------------------------------------------------------------------
// 候选点
// ---------------------------------------------------------------------------

/** 合法、而且不是「往自己真眼里填」的点 */
export function candidateMoves(
  board: Board,
  color: Color,
  ko: number | null = null,
  history?: ReadonlySet<string> | null
): number[] {
  return legalMoves(board, color, ko, history ?? undefined).filter((pt) => !isTrueEye(board, pt, color));
}

// ---------------------------------------------------------------------------
// 启发式打分
// ---------------------------------------------------------------------------

/** 第几线(0 = 最外一线) */
export function lineOf(size: number, pt: number): number {
  const { x, y } = xy(size, pt);
  return Math.min(x, y, size - 1 - x, size - 1 - y);
}

/** 各条线的价值:一线太低、三线四线最实惠 */
function lineValue(line: number): number {
  if (line === 0) return -6;
  if (line === 1) return 0.5;
  if (line === 2) return 5;
  if (line === 3) return 4;
  return 2;
}

export interface ScoreParts {
  capture: number;
  rescue: number;
  atari: number;
  liberty: number;
  shape: number;
  place: number;
  total: number;
}

/**
 * 给一个候选点打分。`positional` 关掉时就是「普通」档:只看提子、逃跑、长气。
 * 打开就是「高手」档:再加占角占边、星位、贴身与连接。
 */
export function scoreMove(board: Board, pt: number, color: Color, positional: boolean): ScoreParts {
  const zero: ScoreParts = { capture: 0, rescue: 0, atari: 0, liberty: 0, shape: 0, place: 0, total: -Infinity };
  const res = play(board, pt, color);
  if (!res) return zero;
  const size = board.size;
  const table = neighborTable(size);
  const foe = other(color);

  const capture = res.captured.length * 14;

  // 被打吃的自家棋,这一手救回来没有
  let rescue = 0;
  const seenMine = new Set<number>();
  for (const n of table[pt]) {
    if (board.cells[n] !== color || seenMine.has(n)) continue;
    const before = groupAt(board, n);
    if (!before) continue;
    for (const s of before.stones) seenMine.add(s);
    if (before.liberties.length !== 1) continue;
    const after = groupAt(res.board, n);
    if (after && after.liberties.length >= 2) rescue += 8 + 3 * before.stones.length;
  }

  // 打吃 / 紧气对方
  let atari = 0;
  const seenFoe = new Set<number>();
  for (const n of table[pt]) {
    if (res.board.cells[n] !== foe || seenFoe.has(n)) continue;
    const g = groupAt(res.board, n);
    if (!g) continue;
    for (const s of g.stones) seenFoe.add(s);
    if (g.liberties.length === 1) atari += 6 + 2 * g.stones.length;
    else if (g.liberties.length === 2) atari += 1.5;
  }

  // 自己这块的气
  const mine = groupAt(res.board, pt);
  const libs = mine ? mine.liberties.length : 0;
  const mySize = mine ? mine.stones.length : 1;
  let liberty = Math.min(libs, 6) * 1.6;
  if (libs === 1 && res.captured.length === 0) liberty -= 12 + 4 * mySize;

  let shape = 0;
  let place = 0;
  if (positional) {
    let ownNbr = 0;
    let foeNbr = 0;
    for (const n of table[pt]) {
      if (board.cells[n] === color) ownNbr++;
      else if (board.cells[n] === foe) foeNbr++;
    }
    let ownDiag = 0;
    for (const d of diagonalTable(size)[pt]) {
      if (board.cells[d] === color) ownDiag++;
    }
    shape = ownNbr * 1.2 + foeNbr * 1.6 + ownDiag * 0.8;
    // 四周全是自己的子:这是在填自己的地,除非能提子,否则别下
    if (ownNbr === table[pt].length && res.captured.length === 0) shape -= 10;
    place = lineValue(lineOf(size, pt));
    if (starPoints(size).includes(pt)) place += 3;
  }

  const total = capture + rescue + atari + liberty + shape + place;
  return { capture, rescue, atari, liberty, shape, place, total };
}

/** 按启发式排好序的候选点(高分在前),同分用 rand 打散 */
export function rankedMoves(
  board: Board,
  color: Color,
  positional: boolean,
  moves: readonly number[],
  rand: () => number
): Array<{ pt: number; score: number }> {
  return moves
    .map((pt) => ({ pt, score: scoreMove(board, pt, color, positional).total + rand() * 0.9 }))
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// 浅层随机快棋(地狱档专用)
// ---------------------------------------------------------------------------

interface Scratch {
  size: number;
  table: number[][];
  seen: Int32Array;
  stack: Int32Array;
  mark: number;
}

function makeScratch(size: number): Scratch {
  return { size, table: neighborTable(size), seen: new Int32Array(size * size), stack: new Int32Array(size * size), mark: 0 };
}

/** 就地落子:提子成功返回提到的子数,自杀返回 -1(并把盘面还原) */
function placeInPlace(cells: Int8Array, sc: Scratch, pt: number, color: Color): number {
  cells[pt] = color;
  const foe = color === BLACK ? WHITE : BLACK;
  let taken = 0;
  for (const n of sc.table[pt]) {
    if (cells[n] !== foe) continue;
    if (hasLiberty(cells, sc, n)) continue;
    taken += removeGroup(cells, sc, n);
  }
  if (taken === 0 && !hasLiberty(cells, sc, pt)) {
    cells[pt] = EMPTY;
    return -1;
  }
  return taken;
}

/** pt 所在的块还有没有气(只回答有没有,不列出来,省一次分配) */
function hasLiberty(cells: Int8Array, sc: Scratch, pt: number): boolean {
  const color = cells[pt];
  if (color === EMPTY) return true;
  sc.mark++;
  const mark = sc.mark;
  let top = 0;
  sc.stack[top++] = pt;
  sc.seen[pt] = mark;
  while (top > 0) {
    const cur = sc.stack[--top];
    for (const n of sc.table[cur]) {
      const c = cells[n];
      if (c === EMPTY) return true;
      if (c === color && sc.seen[n] !== mark) {
        sc.seen[n] = mark;
        sc.stack[top++] = n;
      }
    }
  }
  return false;
}

function removeGroup(cells: Int8Array, sc: Scratch, pt: number): number {
  const color = cells[pt];
  if (color === EMPTY) return 0;
  let removed = 0;
  let top = 0;
  sc.stack[top++] = pt;
  cells[pt] = EMPTY;
  removed++;
  while (top > 0) {
    const cur = sc.stack[--top];
    for (const n of sc.table[cur]) {
      if (cells[n] === color) {
        cells[n] = EMPTY;
        removed++;
        sc.stack[top++] = n;
      }
    }
  }
  return removed;
}

function eyeLikeFast(cells: Int8Array, sc: Scratch, pt: number, color: Color): boolean {
  for (const n of sc.table[pt]) {
    if (cells[n] !== color) return false;
  }
  return true;
}

/** 快棋结束后的「黑的地 − 白的地」(数子法,不含贴还) */
export function areaDiff(cells: Int8Array, sc: Scratch | null, size: number): number {
  const s = sc ?? makeScratch(size);
  const table = s.table;
  const seen = new Uint8Array(cells.length);
  let black = 0;
  let white = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === BLACK) black++;
    else if (cells[i] === WHITE) white++;
  }
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== EMPTY || seen[i]) continue;
    let count = 0;
    let touchB = false;
    let touchW = false;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const cur = stack.pop() as number;
      count++;
      for (const n of table[cur]) {
        const c = cells[n];
        if (c === EMPTY) {
          if (!seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        } else if (c === BLACK) touchB = true;
        else touchW = true;
      }
    }
    if (touchB && !touchW) black += count;
    else if (touchW && !touchB) white += count;
  }
  return black - white;
}

/**
 * 一盘随机快棋:从给定盘面轮流随机落子,直到双方都没地方下或者到手数上限,
 * 然后用数子法算「黑 − 白 − 贴还」。返回黑的净胜。
 */
export function randomPlayout(
  board: Board,
  toMove: Color,
  rand: () => number,
  maxMoves: number,
  komi: number,
  scratch?: Scratch
): number {
  const sc = scratch ?? makeScratch(board.size);
  const cells = Int8Array.from(board.cells);
  const n = cells.length;
  let color = toMove;
  let passes = 0;
  for (let move = 0; move < maxMoves && passes < 2; move++) {
    const start = Math.floor(rand() * n);
    let played = false;
    for (let k = 0; k < n; k++) {
      const pt = (start + k) % n;
      if (cells[pt] !== EMPTY) continue;
      if (eyeLikeFast(cells, sc, pt, color)) continue;
      if (placeInPlace(cells, sc, pt, color) >= 0) {
        played = true;
        break;
      }
    }
    passes = played ? 0 : passes + 1;
    color = color === BLACK ? WHITE : BLACK;
  }
  return areaDiff(cells, sc, board.size) - komi;
}

// ---------------------------------------------------------------------------
// 出招
// ---------------------------------------------------------------------------

/** 领先且实在找不到好点时才停一手的分数线 */
export const PASS_SCORE = -6;

/**
 * 让 AI 走一手。返回落子点;返回 `null` 表示停一手。
 * `tier` 决定用哪一套打分,`opts` 可以覆盖模拟参数(CI 里调低跑得快)。
 */
export function aiMove(board: Board, color: Color, tier: AiTier, opts: Partial<AiOptions> = {}): number | null {
  const cfg: AiOptions = { ...defaultAiOptions(tier, board.size), ...opts };
  const moves = candidateMoves(board, color, cfg.ko, cfg.history);
  if (moves.length === 0) return null;

  if (tier === "rookie") {
    return moves[Math.floor(cfg.rand() * moves.length)];
  }

  const positional = tier === "expert" || tier === "master";
  const ranked = rankedMoves(board, color, positional, moves, cfg.rand);
  const best = ranked[0];

  if (tier !== "master" || cfg.playouts <= 0) {
    if (cfg.allowPass && shouldPass(board, color, best.score, cfg.komi)) return null;
    return best.pt;
  }

  // 地狱档:挑几个好点,各走几盘随机快棋,看谁的赢面高
  const sc = makeScratch(board.size);
  const width = Math.max(1, Math.min(cfg.candidates, ranked.length));
  let bestPt = best.pt;
  let bestValue = -Infinity;
  for (let i = 0; i < width; i++) {
    const pt = ranked[i].pt;
    const res = play(board, pt, color);
    if (!res) continue;
    let wins = 0;
    for (let s = 0; s < cfg.playouts; s++) {
      const diff = randomPlayout(res.board, other(color), cfg.rand, cfg.maxPlayoutMoves, cfg.komi, sc);
      const mine = color === BLACK ? diff : -diff;
      if (mine > 0) wins++;
    }
    // 赢面为主,启发式分数只做同分时的微调
    const value = wins / cfg.playouts + ranked[i].score * 0.002;
    if (value > bestValue) {
      bestValue = value;
      bestPt = pt;
    }
  }
  if (cfg.allowPass && shouldPass(board, color, best.score, cfg.komi)) return null;
  return bestPt;
}

/** 已经领先、而且最好的一手也只是在填自己的地时,停一手更体面 */
export function shouldPass(board: Board, color: Color, bestScore: number, komi: number): boolean {
  if (bestScore > PASS_SCORE) return false;
  const diff = areaDiff(board.cells, null, board.size) - komi;
  return color === BLACK ? diff > 0 : diff < 0;
}

/** 界面用:AI 走一手并落到状态上(非法就退回停一手,绝不卡住) */
export function aiPlay(state: GameState, tier: AiTier, opts: Partial<AiOptions> = {}): GameState {
  const pt = aiMove(state.board, state.turn, tier, { ko: state.ko, history: state.history, ...opts });
  if (pt === null) return passMove(state);
  const res = playMove(state, pt);
  return res.ok ? res.state : passMove(state);
}

// ---------------------------------------------------------------------------
// 自动对局:胜率与耗时都靠它来测
// ---------------------------------------------------------------------------

export interface SelfGameOptions {
  size: BoardSize | number;
  black: AiTier;
  white: AiTier;
  seed: number;
  rule?: ScoreRule;
  komi?: number;
  handicap?: number;
  maxMoves?: number;
  /** 覆盖两边共用的模拟参数(CI 调低) */
  ai?: Partial<AiOptions>;
}

export interface SelfGameResult {
  winner: Winner;
  diff: number;
  moves: number;
  board: Board;
}

/** 两个 AI 自己下一盘,终局自动标死子后按数子法判胜负 */
export function playSelfGame(opts: SelfGameOptions): SelfGameResult {
  const rand = mulberry32(opts.seed >>> 0);
  const rule: ScoreRule = opts.rule ?? "chinese";
  let state = createGame({ size: opts.size, rule, handicap: opts.handicap ?? 0 });
  const komi = opts.komi ?? komiFor(rule, opts.handicap ?? 0);
  const limit = opts.maxMoves ?? state.board.cells.length * 3;
  let moves = 0;
  while (!state.over && moves < limit) {
    const tier = state.turn === BLACK ? opts.black : opts.white;
    // 自动对局不许停一手,免得两边互相客气把棋局提前结束
    state = aiPlay(state, tier, { rand, allowPass: false, komi, ...(opts.ai ?? {}) });
    const last = state.moves[state.moves.length - 1];
    moves++;
    if (last && last.pt === null && state.passes >= 2) break;
    // 双方都没地方下了就收工
    if (
      candidateMoves(state.board, state.turn, state.ko, state.history).length === 0 &&
      candidateMoves(state.board, other(state.turn), state.ko, state.history).length === 0
    ) {
      break;
    }
  }
  const dead = autoDeadStones(state.board);
  const verdict = finalScore(state.board, { rule, dead, captures: state.captures, komi });
  return { winner: verdict.winner, diff: verdict.diff, moves, board: cloneBoard(state.board) };
}

/** 跑 n 局,返回 tier 方(执黑执白轮着来)的胜率 */
export function winRate(opts: {
  size: BoardSize | number;
  hero: AiTier;
  foe: AiTier;
  games: number;
  seed?: number;
  ai?: Partial<AiOptions>;
}): number {
  let wins = 0;
  for (let i = 0; i < opts.games; i++) {
    const heroIsBlack = i % 2 === 0;
    const res = playSelfGame({
      size: opts.size,
      black: heroIsBlack ? opts.hero : opts.foe,
      white: heroIsBlack ? opts.foe : opts.hero,
      seed: (opts.seed ?? 20240601) + i * 7919,
      ai: opts.ai
    });
    if ((heroIsBlack && res.winner === "black") || (!heroIsBlack && res.winner === "white")) wins++;
  }
  return wins / Math.max(1, opts.games);
}

/** 盘面指纹在这里再导一次,便于外面复用同一份超劫历史 */
export { positionHash };
