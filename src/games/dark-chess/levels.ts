/**
 * 翻翻暗棋 · 188 关战役（8 章）。
 *
 * 前四章是全盘对局，重点是把机制一条一条教会；
 * 第 6、7 章是**摆好的残局**，摆法保证「先手方有一条能赢的路」，测试里用参考解题器跑通。
 */
import { assertTotal, type Chapter } from "../level99";
import { COLS, ROWS, dealCovered, indexOf, rand01, type Cell, type Color, type Kind } from "./board";
import type { Tier } from "./ai";
import { makeState, type GameState } from "./rules";

export const CHAPTERS: Chapter[] = [
  { name: "翻翻看", emoji: "🔄", color: "#FDEBD2", desc: "先翻一枚，翻到什么颜色你就是哪一边。", size: 24 },
  { name: "走一步", emoji: "👣", color: "#E8F0DA", desc: "翻开的子只走一格，上下左右都行。", size: 24 },
  { name: "大小相克", emoji: "⚖️", color: "#E3E9F7", desc: "将最大，兵最小，可兵能请将去休息。", size: 24 },
  { name: "隔山炮", emoji: "💥", color: "#FBE1E4", desc: "炮要隔着恰好一个子才吃得到。", size: 24 },
  { name: "记牌", emoji: "🧠", color: "#E6F2F0", desc: "算一算还有哪些子没翻，心里就有底。", size: 22 },
  { name: "残局明棋", emoji: "🀄️", color: "#F2E7F7", desc: "全部翻开的残局，一步一步算清楚。", size: 22 },
  { name: "逼到无棋", emoji: "🚧", color: "#FFF0CE", desc: "让对方既没子可动也没盖子可翻。", size: 24 },
  { name: "暗棋杯", emoji: "🏆", color: "#DCEFE2", desc: "大师档全规则，翻子看运气也看脑子。", size: 24 },
];

export const TOTAL = 188;

export function chaptersValid(): boolean {
  return assertTotal(CHAPTERS, TOTAL, "dark-chess");
}

export function chapterIndexOf(level: number): number {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    acc += CHAPTERS[i].size;
    if (level < acc) return i;
  }
  return CHAPTERS.length - 1;
}

export interface LevelPlan {
  level: number;
  chapter: number;
  tier: Tier;
  /** 摆好的残局（true）还是整盘洗子（false） */
  endgame: boolean;
  /** 记牌面板默认打开 */
  showCounter: boolean;
  /** 最多下多少手，超了算平局收场 */
  maxPlies: number;
  seed: number;
}

export function planFor(level: number): LevelPlan {
  const lv = Math.max(0, Math.min(TOTAL - 1, Math.round(level)));
  const chapter = chapterIndexOf(lv);
  let acc = 0;
  for (let i = 0; i < chapter; i++) acc += CHAPTERS[i].size;
  const k = lv - acc;
  const size = CHAPTERS[chapter].size;
  const ramp = size <= 1 ? 0 : k / (size - 1);

  const tier: Tier =
    chapter <= 1 ? "rookie" : chapter <= 3 ? (ramp > 0.6 ? "normal" : "rookie") : chapter <= 5 ? "normal" : chapter === 6 ? "pro" : "hell";

  return {
    level: lv,
    chapter,
    tier,
    endgame: chapter === 5 || chapter === 6,
    showCounter: chapter >= 4,
    maxPlies: chapter === 5 || chapter === 6 ? 60 : 220,
    seed: 5100 + lv * 37,
  };
}

function empty(): Cell[] {
  return new Array(32).fill(null);
}

function put(cells: Cell[], r: number, c: number, color: Color, kind: Kind, covered = false): void {
  cells[indexOf(r, c)] = { color, kind, covered };
}

/**
 * 残局摆法。
 *
 * 可解性是**摆出来的**：对方的将被逼到角上，两个方向都被挡死，
 * 而朵朵手里有两枚兵——「将请不动兵」这一条让兵可以一路顶到底，
 * 所以一定存在一条赢棋的路。测试里用参考解题器把它真的走一遍。
 */
function endgameCells(plan: LevelPlan): Cell[] {
  const cells = empty();
  const s = plan.seed;
  const corner = Math.floor(rand01(s, 1) * 4) % 4;
  const r = corner < 2 ? 0 : ROWS - 1;
  const c = corner % 2 === 0 ? 0 : COLS - 1;
  const dr = r === 0 ? 1 : -1;
  const dc = c === 0 ? 1 : -1;

  // 对手：将缩在角上，两条出路都被自己人堵着
  put(cells, r, c, "blue", "general");
  put(cells, r + dr, c, "blue", "soldier");
  put(cells, r, c + dc, plan.chapter === 5 ? "blue" : "blue", plan.chapter === 5 ? "horse" : "soldier");

  // 朵朵：两枚兵负责收官，一辆车负责清障，帅缩在对角安全的地方
  put(cells, r + 2 * dr, c, "red", "soldier");
  put(cells, r, c + 2 * dc, "red", "soldier");
  put(cells, r + dr, c + 2 * dc, "red", "chariot");
  put(cells, ROWS - 1 - r, COLS - 1 - c, "red", "general");
  return cells;
}

/** 某一关的起始局面 */
export function setupFor(level: number): GameState {
  const plan = planFor(level);
  if (plan.endgame) {
    return makeState(endgameCells(plan), {
      colors: { duo: "red", star: "blue" },
      turn: "duo",
    });
  }
  const cells = dealCovered(plan.seed);
  // 前两章先替孩子翻开几枚，省得开局全是背面无从下手
  const preRevealed = plan.chapter === 0 ? 0 : plan.chapter === 1 ? 4 : 2;
  for (let i = 0; i < preRevealed; i++) {
    const at = Math.floor(rand01(plan.seed, 300 + i) * cells.length) % cells.length;
    const c = cells[at];
    if (c) c.covered = false;
  }
  return makeState(cells, { turn: "duo" });
}

/** 三星门槛：手数越少越漂亮 */
export function rateLevel(plies: number, budget: number): 1 | 2 | 3 {
  if (plies <= Math.max(2, Math.ceil(budget * 0.35))) return 3;
  if (plies <= Math.ceil(budget * 0.7)) return 2;
  return 1;
}

/** 无尽模式：连胜越多，对手越强、局面越难 */
export function endlessPlan(streak: number): { tier: Tier; seed: number } {
  const tier: Tier = streak >= 9 ? "hell" : streak >= 5 ? "pro" : streak >= 2 ? "normal" : "rookie";
  return { tier, seed: 9100 + streak * 131 };
}
