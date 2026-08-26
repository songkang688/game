// 找不同：188 关 · 十大主题图鉴关卡生成（双图对照 → 三图/动态/镜像/连环挑战，确定性可测试）
//
// 1.1 起总关数 99 → 188：前 99 关（前 6 章）的章节切分、seed、生成参数逐字未动，
// 新的 4 章共 89 关只在末尾追加，面向约小学六年级，玩法明显更烧脑。
import { TOTAL_LEVELS, chapterOf, indexInChapter, mulberry32, pick, randInt, shuffled, type Chapter } from "../level99";

/** 1.0 时代的章节数：下标 < 这个数的章节一律保持原样 */
export const LEGACY_CHAPTER_COUNT = 6;

export const CHAPTERS: Chapter[] = [
  { name: "水果果园", emoji: "🍓", color: "#ffe8cc", desc: "小小果园找不同热身", size: 17 },
  { name: "萌宠乐园", emoji: "🐾", color: "#d3f9d8", desc: "小动物们排排站", size: 17 },
  { name: "海底世界", emoji: "🌊", color: "#d0f0fd", desc: "格子更大，藏得更深", size: 17 },
  { name: "甜品小屋", emoji: "🍰", color: "#ffdeeb", desc: "小心！甜品长得很像", size: 16 },
  { name: "夜空营地", emoji: "🌙", color: "#e5dbff", desc: "星星月亮眨眼睛，限时挑战", size: 16 },
  { name: "玩具城堡", emoji: "🧸", color: "#fff3bf", desc: "最大棋盘 + 双胞胎玩具", size: 16 },
  // ↓ 1.1 新增：第 100–188 关
  { name: "三图侦探社", emoji: "🕵️", color: "#ffe9e0", desc: "三张图一起看：只有跟上面两张都不同的才算数", size: 23 },
  { name: "旋转灯塔", emoji: "🌀", color: "#e0f0ff", desc: "图案会自己换位置，不同点也跟着跑", size: 22 },
  { name: "镜像水面", emoji: "🪟", color: "#e4f7f2", desc: "下图是左右翻过来的，要按镜子的位置去对", size: 22 },
  { name: "连环挑战场", emoji: "⏱️", color: "#f3e8ff", desc: "一关连打好几轮，共用一个总倒计时", size: 22 },
];

/** 每章的表情池 */
export const THEME_POOLS: string[][] = [
  ["🍎", "🍌", "🍇", "🍉", "🍓", "🍑", "🍍", "🥝", "🍒"],
  ["🐶", "🐱", "🐰", "🐻", "🐼", "🦊", "🐷", "🐸", "🐮"],
  ["🐟", "🐙", "🦀", "🐬", "🐳", "🦑", "🐚", "🐢", "🦐"],
  ["🍰", "🧁", "🍩", "🍪", "🍫", "🍭", "🍬", "🎂", "🍮"],
  ["🌙", "⭐", "🌟", "✨", "☁️", "🪐", "🌈", "🌠", "🔭"],
  ["🧸", "🚗", "🚂", "✈️", "🚁", "⚽", "🏀", "🎈", "🥁"],
  ["🔍", "🧩", "🗝️", "📜", "🕯️", "🎩", "🧭", "📒", "📕"],
  ["🌀", "🚦", "🛟", "⚓", "🪁", "🎐", "🌪️", "🛶", "🧿"],
  ["🪞", "💧", "🫧", "🐟", "🌊", "🪷", "🦢", "🍃", "🪸"],
  ["⏱️", "🏅", "🎯", "🎲", "🚀", "💎", "🔔", "🏁", "⌛"],
];

/** 双胞胎替换对（后期章节：换成很像的另一个，更难发现） */
const LOOKALIKE: Record<string, string> = {
  "🍰": "🎂", "🎂": "🍰", "🍭": "🍬", "🍬": "🍭", "🍩": "🍪", "🍪": "🍩",
  "⭐": "🌟", "🌟": "⭐", "✨": "🌠", "🌠": "✨",
  "⚽": "🏀", "🏀": "⚽", "🚗": "🚂", "🚂": "🚗", "✈️": "🚁", "🚁": "✈️",
  // ↓ 1.1 新章节的双胞胎
  "📒": "📕", "📕": "📒", "🌀": "🌪️", "🌪️": "🌀",
  "💧": "🫧", "🫧": "💧", "🪷": "🪸", "🪸": "🪷",
  "⏱️": "⌛", "⌛": "⏱️",
};

/** 1.1 新增：一关的玩法模式 */
export type DiffMode = "classic" | "triple" | "moving" | "mirror" | "rush";

export interface DiffLevel {
  rows: number;
  cols: number;
  /** 不同点数量 */
  diffs: number;
  /** 允许点错的次数 */
  maxMiss: number;
  /** 时间限制（秒），0 = 不限时 */
  timeSec: number;
  /** 是否用双胞胎表情替换（更难） */
  lookalike: boolean;
  theme: number;
  /** 玩法模式，前 99 关一律 classic */
  mode: DiffMode;
  /** 三图模式：上面两张图之间的干扰差异数（这些格子不是答案） */
  decoys: number;
  /** 动态模式：每隔几秒整块棋盘换一次位置（0 = 不动） */
  moveEverySec: number;
  /** 连环模式：一关要连打几轮（其余模式恒为 1） */
  rounds: number;
}

/** 前 99 关用的固定配置：mode/decoys/moveEverySec/rounds 全是中性值，玩法与 1.0 完全一致 */
const CLASSIC = { mode: "classic" as DiffMode, decoys: 0, moveEverySec: 0, rounds: 1 };

function buildLevel(level: number): DiffLevel {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  switch (ci) {
    case 0:
      return { rows: 3, cols: t < 0.5 ? 3 : 4, diffs: 2 + Math.floor(t * 1.2), maxMiss: 5, timeSec: 0, lookalike: false, theme: 0, ...CLASSIC };
    case 1:
      return { rows: t < 0.5 ? 3 : 4, cols: 4, diffs: 3 + Math.floor(t * 1.2), maxMiss: 5, timeSec: 0, lookalike: false, theme: 1, ...CLASSIC };
    case 2:
      return { rows: 4, cols: 4, diffs: 3 + Math.floor(t * 2), maxMiss: 4, timeSec: t > 0.6 ? 90 : 0, lookalike: false, theme: 2, ...CLASSIC };
    case 3:
      return { rows: 4, cols: t < 0.5 ? 4 : 5, diffs: 4 + Math.floor(t * 1.2), maxMiss: 4, timeSec: 80, lookalike: true, theme: 3, ...CLASSIC };
    case 4:
      return { rows: 4, cols: 5, diffs: 4 + Math.floor(t * 2), maxMiss: 3, timeSec: 70 - Math.floor(t * 10), lookalike: true, theme: 4, ...CLASSIC };
    case 5:
      return { rows: t < 0.5 ? 4 : 5, cols: 5, diffs: 5 + Math.floor(t * 2), maxMiss: 3, timeSec: 60 - Math.floor(t * 15), lookalike: true, theme: 5, ...CLASSIC };
    // ↓ 1.1 新增章节
    case 6:
      return {
        rows: t < 0.5 ? 3 : 4, cols: t < 0.35 ? 4 : 5,
        diffs: 3 + Math.floor(t * 2), maxMiss: 4,
        timeSec: t < 0.4 ? 0 : 130 - Math.floor(t * 30),
        lookalike: t > 0.6, theme: 6,
        mode: "triple", decoys: 2 + Math.floor(t * 3), moveEverySec: 0, rounds: 1,
      };
    case 7:
      return {
        rows: 4, cols: t < 0.5 ? 4 : 5,
        diffs: 4 + Math.floor(t * 2), maxMiss: 4,
        timeSec: 110 - Math.floor(t * 25),
        lookalike: t > 0.5, theme: 7,
        mode: "moving", decoys: 0, moveEverySec: 6 - Math.floor(t * 3), rounds: 1,
      };
    case 8:
      return {
        rows: 4, cols: t < 0.5 ? 4 : 5,
        diffs: 4 + Math.floor(t * 2), maxMiss: 4,
        timeSec: 105 - Math.floor(t * 25),
        lookalike: t > 0.5, theme: 8,
        mode: "mirror", decoys: 0, moveEverySec: 0, rounds: 1,
      };
    default: {
      const rounds = 2 + Math.floor(t * 2);
      return {
        rows: 3, cols: t < 0.5 ? 4 : 5,
        diffs: 3 + Math.floor(t * 2), maxMiss: 2 + rounds,
        timeSec: 130 - Math.floor(t * 30),
        lookalike: t > 0.4, theme: 9,
        mode: "rush", decoys: 0, moveEverySec: 0, rounds,
      };
    }
  }
}

export const LEVELS: DiffLevel[] = Array.from({ length: TOTAL_LEVELS }, (_, i) => buildLevel(i));

export interface DiffBoard {
  /** 上图（原图）按行展开 */
  base: string[];
  /** 下图（可点的那张，有 diffs 个格子和上图对不上） */
  changed: string[];
  /** 下图里「不一样」的格子下标 */
  diffIdx: number[];
  /** 三图模式专用：上排右边那张图 */
  second?: string[];
  /** 三图模式专用：上排两张图之间的干扰差异（不是答案，点了不算对） */
  decoyIdx?: number[];
}

/** 换一个图案：优先用双胞胎，没有就从主题池里另挑一个 */
function swapEmoji(rand: () => number, pool: string[], current: string, lookalike: boolean): string {
  const twin = LOOKALIKE[current];
  if (lookalike && twin && twin !== current && pool.includes(twin)) return twin;
  return pick(rand, pool.filter((e) => e !== current));
}

/**
 * 生成某一关的对照图（确定性：同一关重试布局不变）。
 * classic / moving 走的是 1.0 原封不动的那段代码，前 99 关逐字未变。
 */
export function buildBoard(level: number): DiffBoard {
  const cfg = LEVELS[level];
  if (cfg.mode === "triple") return buildTripleBoard(level);
  if (cfg.mode === "mirror") return buildMirrorBoard(level);
  if (cfg.mode === "rush") return buildRushBoards(level)[0];
  const rand = mulberry32(10700 + level * 7919);
  const pool = THEME_POOLS[cfg.theme];
  const n = cfg.rows * cfg.cols;
  const base: string[] = Array.from({ length: n }, () => pick(rand, pool));
  const changed = base.slice();
  const indices = new Set<number>();
  let guard = 0;
  while (indices.size < cfg.diffs && guard++ < 500) {
    indices.add(randInt(rand, 0, n - 1));
  }
  const diffIdx = [...indices].sort((a, b) => a - b);
  for (const i of diffIdx) {
    const twin = LOOKALIKE[base[i]];
    if (cfg.lookalike && twin && twin !== base[i]) {
      changed[i] = twin;
    } else {
      changed[i] = pick(rand, pool.filter((e) => e !== base[i]));
    }
  }
  return { base, changed, diffIdx };
}

// ---------------------------------------------------------------------------
// 1.1 新机制一：三图对照（只有跟上面两张都不一样的格子才算数）
// ---------------------------------------------------------------------------

function buildTripleBoard(level: number): DiffBoard {
  const cfg = LEVELS[level];
  const rand = mulberry32(10700 + level * 7919);
  const pool = THEME_POOLS[cfg.theme];
  const n = cfg.rows * cfg.cols;
  const base: string[] = Array.from({ length: n }, () => pick(rand, pool));
  const second = base.slice();
  const changed = base.slice();
  const order = shuffled(Array.from({ length: n }, (_, i) => i), rand);
  const diffIdx = order.slice(0, cfg.diffs).sort((a, b) => a - b);
  const decoyIdx = order.slice(cfg.diffs, cfg.diffs + cfg.decoys).sort((a, b) => a - b);
  // 答案格：下图跟上面两张都不同
  for (const i of diffIdx) changed[i] = swapEmoji(rand, pool, base[i], cfg.lookalike);
  // 干扰格：上面两张自己不一样，但下图跟左边那张一模一样
  for (const i of decoyIdx) second[i] = swapEmoji(rand, pool, base[i], cfg.lookalike);
  return { base, second, changed, diffIdx, decoyIdx };
}

// ---------------------------------------------------------------------------
// 1.1 新机制二：动态图（整块棋盘按固定周期换位置，不同点跟着跑）
// ---------------------------------------------------------------------------

/**
 * 第 step 轮的位置置换：返回长度 rows×cols 的数组，
 * `perm[新位置] = 老位置`。每一行按不同的速度左右滚动，所以整张图会「活」起来。
 */
export function movePermutation(rows: number, cols: number, step: number): number[] {
  const n = rows * cols;
  const out = new Array<number>(n);
  const s = ((Math.round(step) % (cols * rows)) + cols * rows) % (cols * rows);
  for (let r = 0; r < rows; r++) {
    const shift = ((s * (r + 1)) % cols + cols) % cols;
    for (let c = 0; c < cols; c++) {
      out[r * cols + c] = r * cols + ((c + shift) % cols);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1.1 新机制三：镜像图（下图左右翻转，要按镜子的位置去对）
// ---------------------------------------------------------------------------

/** 同一行里左右对称的那一格 */
export function mirrorIndex(i: number, cols: number): number {
  const r = Math.floor(i / cols);
  const c = i % cols;
  return r * cols + (cols - 1 - c);
}

function buildMirrorBoard(level: number): DiffBoard {
  const cfg = LEVELS[level];
  const rand = mulberry32(10700 + level * 7919);
  const pool = THEME_POOLS[cfg.theme];
  const n = cfg.rows * cfg.cols;
  const base: string[] = Array.from({ length: n }, () => pick(rand, pool));
  // 下图先整体左右翻过来，再在若干格上做手脚
  const changed = Array.from({ length: n }, (_, j) => base[mirrorIndex(j, cfg.cols)]);
  const order = shuffled(Array.from({ length: n }, (_, i) => i), rand);
  const diffIdx = order.slice(0, cfg.diffs).sort((a, b) => a - b);
  for (const j of diffIdx) changed[j] = swapEmoji(rand, pool, changed[j], cfg.lookalike);
  return { base, changed, diffIdx };
}

// ---------------------------------------------------------------------------
// 1.1 新机制四：连环挑战（一关连打好几轮小棋盘，共用一个总倒计时）
// ---------------------------------------------------------------------------

/** 连环挑战的每一轮棋盘（长度等于 cfg.rounds） */
export function buildRushBoards(level: number): DiffBoard[] {
  const cfg = LEVELS[level];
  const pool = THEME_POOLS[cfg.theme];
  const n = cfg.rows * cfg.cols;
  const out: DiffBoard[] = [];
  for (let round = 0; round < Math.max(1, cfg.rounds); round++) {
    const rand = mulberry32(10700 + level * 7919 + round * 104729);
    const base: string[] = Array.from({ length: n }, () => pick(rand, pool));
    const changed = base.slice();
    const order = shuffled(Array.from({ length: n }, (_, i) => i), rand);
    const diffIdx = order.slice(0, cfg.diffs).sort((a, b) => a - b);
    for (const i of diffIdx) changed[i] = swapEmoji(rand, pool, base[i], cfg.lookalike);
    out.push({ base, changed, diffIdx });
  }
  return out;
}

/** 某一关要玩的全部棋盘（非连环模式就只有一张） */
export function buildBoards(level: number): DiffBoard[] {
  return LEVELS[level].mode === "rush" ? buildRushBoards(level) : [buildBoard(level)];
}
