// 找不同：99 关 · 六大主题图鉴关卡生成（双图对照找不同，确定性可测试）
import { chapterOf, indexInChapter, mulberry32, pick, randInt, type Chapter } from "../level99";

export const CHAPTERS: Chapter[] = [
  { name: "水果果园", emoji: "🍓", color: "#ffe8cc", desc: "小小果园找不同热身", size: 17 },
  { name: "萌宠乐园", emoji: "🐾", color: "#d3f9d8", desc: "小动物们排排站", size: 17 },
  { name: "海底世界", emoji: "🌊", color: "#d0f0fd", desc: "格子更大，藏得更深", size: 17 },
  { name: "甜品小屋", emoji: "🍰", color: "#ffdeeb", desc: "小心！甜品长得很像", size: 16 },
  { name: "夜空营地", emoji: "🌙", color: "#e5dbff", desc: "星星月亮眨眼睛，限时挑战", size: 16 },
  { name: "玩具城堡", emoji: "🧸", color: "#fff3bf", desc: "最大棋盘 + 双胞胎玩具", size: 16 },
];

/** 每章的表情池 */
export const THEME_POOLS: string[][] = [
  ["🍎", "🍌", "🍇", "🍉", "🍓", "🍑", "🍍", "🥝", "🍒"],
  ["🐶", "🐱", "🐰", "🐻", "🐼", "🦊", "🐷", "🐸", "🐮"],
  ["🐟", "🐙", "🦀", "🐬", "🐳", "🦑", "🐚", "🐢", "🦐"],
  ["🍰", "🧁", "🍩", "🍪", "🍫", "🍭", "🍬", "🎂", "🍮"],
  ["🌙", "⭐", "🌟", "✨", "☁️", "🪐", "🌈", "🌠", "🔭"],
  ["🧸", "🚗", "🚂", "✈️", "🚁", "⚽", "🏀", "🎈", "🥁"],
];

/** 双胞胎替换对（后期章节：换成很像的另一个，更难发现） */
const LOOKALIKE: Record<string, string> = {
  "🍰": "🎂", "🎂": "🍰", "🍭": "🍬", "🍬": "🍭", "🍩": "🍪", "🍪": "🍩",
  "⭐": "🌟", "🌟": "⭐", "✨": "🌠", "🌠": "✨",
  "⚽": "🏀", "🏀": "⚽", "🚗": "🚂", "🚂": "🚗", "✈️": "🚁", "🚁": "✈️",
};

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
}

function buildLevel(level: number): DiffLevel {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  switch (ci) {
    case 0:
      return { rows: 3, cols: t < 0.5 ? 3 : 4, diffs: 2 + Math.floor(t * 1.2), maxMiss: 5, timeSec: 0, lookalike: false, theme: 0 };
    case 1:
      return { rows: t < 0.5 ? 3 : 4, cols: 4, diffs: 3 + Math.floor(t * 1.2), maxMiss: 5, timeSec: 0, lookalike: false, theme: 1 };
    case 2:
      return { rows: 4, cols: 4, diffs: 3 + Math.floor(t * 2), maxMiss: 4, timeSec: t > 0.6 ? 90 : 0, lookalike: false, theme: 2 };
    case 3:
      return { rows: 4, cols: t < 0.5 ? 4 : 5, diffs: 4 + Math.floor(t * 1.2), maxMiss: 4, timeSec: 80, lookalike: true, theme: 3 };
    case 4:
      return { rows: 4, cols: 5, diffs: 4 + Math.floor(t * 2), maxMiss: 3, timeSec: 70 - Math.floor(t * 10), lookalike: true, theme: 4 };
    default:
      return { rows: t < 0.5 ? 4 : 5, cols: 5, diffs: 5 + Math.floor(t * 2), maxMiss: 3, timeSec: 60 - Math.floor(t * 15), lookalike: true, theme: 5 };
  }
}

export const LEVELS: DiffLevel[] = Array.from({ length: 99 }, (_, i) => buildLevel(i));

export interface DiffBoard {
  /** 左图（原图）按行展开 */
  base: string[];
  /** 右图（有 diffs 个格子被换掉） */
  changed: string[];
  /** 被换掉的格子下标 */
  diffIdx: number[];
}

/** 生成某一关的双图（确定性：同一关重试布局不变） */
export function buildBoard(level: number): DiffBoard {
  const cfg = LEVELS[level];
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
