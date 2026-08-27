/**
 * 星星消消乐 · 对战与无尽的规则（纯函数，不碰 DOM）。
 *
 * 对战：左右（窄屏上下）各一块 6×6，两边拿到**同一条订单队列**，先清完 3 张的赢。
 * 无尽：订单队列无限，每清 1 张 +1 步，难度全靠订单越来越苛刻，没有倒计时。
 *
 * 特殊块（4 连火箭 / 5 连彩虹 / L·T 炸弹）也在这里产出与引爆——
 * 但**引爆只负责给出「下一波要炸哪些格」**，什么时候炸由 `view.ts` 的时间线决定，
 * 所以引爆同样是一波一波看得见地炸开，不会一次 render 清盘。
 */
import { mulberry32 } from "../level99";
import {
  BOMB,
  EMPTY,
  PLAIN,
  RAINBOW,
  ROCKET_H,
  ROCKET_V,
  cloneCellset,
  findMatchesOn,
  legalSwapsOn,
  makeCellset,
  nextBlastWave,
  refillOn,
  rewardAt,
  runsOn,
  settleOn,
  shuffleOn,
  specialOf,
  blastCells,
  type Cellset,
  type Reward,
  type RoundPlan,
} from "./board";
import type { CascadeInfo } from "./engine";

/** 对战 / 无尽的棋盘：6×6，窄屏上下排也塞得下 */
export const DUEL_COLS = 6;
export const DUEL_ROWS = 6;
export const DUEL_COLORS = 5;
/** 先清完几张订单就赢 */
export const DUEL_TARGET = 3;
/** 无尽开局给几步 */
export const ENDLESS_START_MOVES = 15;

// ---------------------------------------------------------------------------
// 订单
// ---------------------------------------------------------------------------

export type DuelOrderKind = "color" | "big4" | "big5" | "chain2" | "chain3";

export interface DuelOrder {
  kind: DuelOrderKind;
  /** 只有 `color` 用得上：要收哪种图案 */
  token: number;
  need: number;
  got: number;
}

/** 订单队列的花样：越往后越苛刻 */
const ORDER_CYCLE: DuelOrderKind[] = [
  "color", "color", "big4", "color", "chain2", "color", "big4", "chain3", "color", "big5",
];

/**
 * 第 n 张订单（0 基）。同一个 seed 两边拿到的队列完全一样，对战才公平。
 * 难度只来自「要得更多」，不来自倒计时。
 */
export function makeOrder(n: number, rand: () => number, colors = DUEL_COLORS): DuelOrder {
  const kind = ORDER_CYCLE[n % ORDER_CYCLE.length];
  const token = Math.floor(rand() * colors);
  if (kind === "color") {
    return { kind, token, need: 7 + Math.min(13, Math.floor(n * 1.5)), got: 0 };
  }
  return { kind, token, need: 1 + Math.floor(n / 5), got: 0 };
}

/** 订单队列：一次生出 n 张，用同一个 seed */
export function orderQueue(seed: number, n: number, colors = DUEL_COLORS): DuelOrder[] {
  const rand = mulberry32(seed);
  return Array.from({ length: n }, (_, i) => makeOrder(i, rand, colors));
}

export function orderText(o: DuelOrder, emojiOf: (t: number) => string): string {
  if (o.kind === "color") return `收 ${emojiOf(o.token)} ${o.got}/${o.need}`;
  const what =
    o.kind === "big4" ? "一次消 4 颗以上"
      : o.kind === "big5" ? "一次消 5 颗以上"
        : o.kind === "chain2" ? "连锁 2 次"
          : "连锁 3 次";
  return `${what} ${o.got}/${o.need}`;
}

function bigEnough(kind: DuelOrderKind, info: CascadeInfo): boolean {
  if (kind === "big4") return info.best >= 4;
  if (kind === "big5") return info.best >= 5;
  if (kind === "chain2") return info.steps >= 2;
  if (kind === "chain3") return info.steps >= 3;
  return false;
}

/**
 * 结算一张订单：`color` 按这一步清掉的图案累加，其余一步最多记一笔。
 * 返回「这一步把它清完了吗」。
 */
export function creditOrder(o: DuelOrder, info: CascadeInfo, cleared: readonly number[]): boolean {
  if (o.got >= o.need) return false;
  if (o.kind === "color") {
    for (const v of cleared) if (v === o.token) o.got++;
  } else if (bigEnough(o.kind, info)) {
    o.got++;
  }
  return o.got >= o.need;
}

// ---------------------------------------------------------------------------
// 棋盘
// ---------------------------------------------------------------------------

/**
 * 发一副 6×6 的牌：开局不许自带三连，也不许一步都走不动。
 * 6×6 比闯关的 8×8 小，随手发出来的死局并不罕见，所以发完还得洗到能走为止。
 */
export function makeDuelBoard(rand: () => number, colors = DUEL_COLORS): Cellset {
  const s = makeCellset(DUEL_COLS, DUEL_ROWS, 0);
  for (let i = 0; i < s.grid.length; i++) {
    const r = Math.floor(i / DUEL_COLS);
    const c = i % DUEL_COLS;
    let v = Math.floor(rand() * colors);
    let guard = 0;
    while (
      guard++ < 40 &&
      ((c >= 2 && s.grid[i - 1] === v && s.grid[i - 2] === v) ||
        (r >= 2 && s.grid[i - DUEL_COLS] === v && s.grid[i - 2 * DUEL_COLS] === v))
    ) {
      v = Math.floor(rand() * colors);
    }
    s.grid[i] = v;
  }
  if (legalSwapsOn(s).length === 0) shuffleOn(s, rand);
  return s;
}

function rank(r: Reward): number {
  return r === "rainbow" ? 3 : r === "bomb" ? 2 : r === "none" ? 0 : 1;
}

/**
 * 把一堆匹配格按上下左右连通分成几团。
 * `same` 用来判断两格算不算一团——同色才算，不然贴在一起的红三连和蓝三连会被并成一团。
 */
export function componentsOf(
  cells: Iterable<number>,
  cols: number,
  same: (a: number, b: number) => boolean = () => true
): number[][] {
  const left = new Set(cells);
  const out: number[][] = [];
  while (left.size > 0) {
    const seed: number = left.values().next().value as number;
    const stack = [seed];
    left.delete(seed);
    const comp: number[] = [];
    while (stack.length) {
      const i = stack.pop() as number;
      comp.push(i);
      const c = i % cols;
      const around = [i - cols, i + cols, c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1];
      for (const j of around) {
        if (j >= 0 && left.has(j) && same(i, j)) {
          left.delete(j);
          stack.push(j);
        }
      }
    }
    out.push(comp.sort((a, b) => a - b));
  }
  return out;
}

/**
 * 算这一轮要清哪些格、清完在哪儿留下奖励。
 * `focus` 是玩家刚动过的那一格：能留奖励时优先留在他手底下，手感才对。
 */
export function planRound(s: Cellset, focus = -1): RoundPlan | null {
  const matched = findMatchesOn(s.grid, s.cols, s.rows);
  if (matched.size === 0) return null;
  const runs = runsOn(s.grid, s.cols, s.rows);
  const rewards: NonNullable<RoundPlan["rewards"]> = [];
  for (const comp of componentsOf(matched, s.cols, (a, b) => s.grid[a] === s.grid[b])) {
    let best: Reward = "none";
    let at = comp[0];
    for (const i of comp) {
      const r = rewardAt(runs, i);
      if (rank(r) > rank(best) || (rank(r) === rank(best) && i === focus)) {
        best = r;
        at = i;
      }
    }
    if (best === "none") continue;
    rewards.push(
      best === "rainbow"
        ? { at, grid: RAINBOW, special: PLAIN }
        : { at, grid: s.grid[at], special: specialOf(best) }
    );
  }
  return { cells: Array.from(matched), rewards };
}

export interface RoundResult {
  /** 这一轮清掉的图案（订单按它累加） */
  cleared: number[];
  /** 被点着的特殊块要炸的下一波（空集表示炸完了） */
  blast: Set<number>;
}

/**
 * 把一轮消除真正落到盘面上。
 * 引爆的下一波只是**算出来返回**，什么时候炸交给时间线，绝不在这儿连炸到底。
 */
export function applyPlan(s: Cellset, plan: RoundPlan, done: Set<number>): RoundResult {
  for (const i of plan.cells) done.add(i);
  const blast = nextBlastWave(s, plan.cells, done);
  const cleared: number[] = [];
  for (const i of plan.cells) {
    if (s.grid[i] >= 0) cleared.push(s.grid[i]);
    s.grid[i] = EMPTY;
    s.special[i] = PLAIN;
  }
  for (const r of plan.rewards ?? []) {
    s.grid[r.at] = r.grid;
    s.special[r.at] = r.special;
  }
  return { cleared, blast };
}

/** 彩虹星和谁换：点名全场那种图案 */
export function rainbowPlan(s: Cellset, a: number, b: number, fallback: number): RoundPlan {
  const other = s.grid[a] === RAINBOW ? s.grid[b] : s.grid[a];
  const target = other === RAINBOW ? fallback : other;
  const cells = new Set<number>([a, b]);
  for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === target) cells.add(i);
  return { cells: Array.from(cells) };
}

/** 直接引爆手上的特殊块（交换特殊块时用） */
export function detonatePlan(s: Cellset, a: number, b: number): RoundPlan | null {
  const cells = new Set<number>();
  for (const i of [a, b]) {
    if (!s.special[i]) continue;
    cells.add(i);
    for (const j of blastCells(s.cols, s.rows, i, s.special[i])) cells.add(j);
  }
  return cells.size > 0 ? { cells: Array.from(cells) } : null;
}

/** 一次出手从头消到稳定（人机预演与单测用；界面走的是同一套规则，只是分段播） */
export function resolveBoard(
  s: Cellset,
  gen: () => number,
  focus = -1
): { info: CascadeInfo; cleared: number[] } {
  let steps = 0;
  let total = 0;
  let best = 0;
  const clearedAll: number[] = [];
  let focusCell = focus;
  for (let guard = 0; guard < 60; guard++) {
    const plan = planRound(s, focusCell);
    if (!plan) break;
    steps++;
    const done = new Set<number>();
    let cur: RoundPlan | null = plan;
    while (cur) {
      total += cur.cells.length;
      best = Math.max(best, cur.cells.length);
      const res = applyPlan(s, cur, done);
      clearedAll.push(...res.cleared);
      cur = res.blast.size > 0 ? { cells: Array.from(res.blast) } : null;
    }
    settleOn(s.grid, s.cols, s.rows, s);
    refillOn(s.grid, s.cols, s.rows, gen, s);
    focusCell = -1;
  }
  return { info: { steps, total, best }, cleared: clearedAll };
}

// ---------------------------------------------------------------------------
// 人机三档
// ---------------------------------------------------------------------------

export type AiTier = "rookie" | "normal" | "expert";

export const TIER_NAMES: Record<AiTier, string> = {
  rookie: "新手小云",
  normal: "老手小雨",
  expert: "高手小雷",
};
export const TIER_FACES: Record<AiTier, string> = { rookie: "🐣", normal: "🐰", expert: "🦊" };
/** 三档各自出手的间隔（毫秒）：越强想得越快 */
export const TIER_THINK_MS: Record<AiTier, number> = { rookie: 1500, normal: 1150, expert: 850 };

export function tierBlurb(tier: AiTier): string {
  if (tier === "rookie") return "随便找一个能消的就换，不挑。";
  if (tier === "normal") return "会往后看一步，专挑能连锁的换。";
  return "会攒 4 连做特殊块，出手很狠。";
}

/** 这一步把当前订单往前推了多少 */
function orderGain(order: DuelOrder | undefined, info: CascadeInfo, cleared: readonly number[]): number {
  if (!order) return 0;
  if (order.kind === "color") return cleared.filter((v) => v === order.token).length;
  return bigEnough(order.kind, info) ? 4 : 0;
}

/**
 * 人机挑一步：
 *  - `rookie` 在所有合法交换里随便抓一个；
 *  - `normal` 把每一步预演到稳定，挑连锁最多、最推进订单的；
 *  - `expert` 在 `normal` 的基础上，额外重奖「一次消 4 颗以上」——它是奔着攒特殊块去的。
 */
export function pickAiSwap(
  s: Cellset,
  order: DuelOrder | undefined,
  tier: AiTier,
  rand: () => number,
  colors = DUEL_COLORS
): [number, number] | null {
  const swaps = legalSwapsOn(s);
  if (swaps.length === 0) return null;
  if (tier === "rookie") return swaps[Math.floor(rand() * swaps.length)];
  let best = swaps[0];
  let bestScore = -Infinity;
  let evalSeed = Math.floor(rand() * 1e6) + 7;
  for (const [a, b] of swaps) {
    const trial = cloneCellset(s);
    [trial.grid[a], trial.grid[b]] = [trial.grid[b], trial.grid[a]];
    [trial.special[a], trial.special[b]] = [trial.special[b], trial.special[a]];
    const gen = mulberry32(evalSeed++);
    const { info, cleared } = resolveBoard(trial, () => Math.floor(gen() * colors), b);
    let score = info.total + info.steps * 3 + orderGain(order, info, cleared) * 6;
    if (tier === "expert") {
      score += info.best >= 5 ? 18 : info.best >= 4 ? 10 : 0;
      // 盘面上留下的火箭 / 炸弹也算资产
      for (let i = 0; i < trial.special.length; i++) {
        if (trial.special[i] === BOMB) score += 6;
        else if (trial.special[i] === ROCKET_H || trial.special[i] === ROCKET_V) score += 4;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = [a, b];
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 胜负与计分
// ---------------------------------------------------------------------------

/** 对战：谁先清完 `target` 张订单谁赢。0 = 还没分出胜负，1 = 左边赢，2 = 右边赢 */
export function duelWinner(left: number, right: number, target = DUEL_TARGET): 0 | 1 | 2 {
  if (left >= target && left > right) return 1;
  if (right >= target && right > left) return 2;
  if (left >= target && right >= target) return left >= right ? 1 : 2;
  return 0;
}

/** 无尽：每清 1 张订单 +1 步 */
export function endlessMovesAfter(moves: number, clearedOrders: number): number {
  return moves + clearedOrders;
}

/** 无尽这一局的得分就是清掉的订单张数 */
export function endlessScore(clearedOrders: number): number {
  return Math.max(0, Math.round(clearedOrders));
}

export function endlessLine(score: number, best: number): string {
  if (score <= 0) return "这一局没能凑齐第一张订单～下次先盯着一种图案攒。";
  if (score >= best) return `清了 ${score} 张订单，是新纪录！`;
  return `清了 ${score} 张订单，历史最好 ${best} 张，再来一次！`;
}
