// 形状王国：99 关 · 六大王国区域题库生成（一年级图形认知，确定性可测试）
import { mulberry32, pick, randInt, shuffled, chapterOf, indexInChapter, type Chapter } from "../level99";
import type { QuizQuestion, QuizTheme } from "../quiz99";
import {
  COLOR_NAMES,
  COLOR_VALUES,
  SHAPE_COLORS,
  SHAPE_KINDS,
  SHAPE_NAMES,
  SHAPE_SIDES,
  SIDED_SHAPES,
  type ShapeColor,
  type ShapeKind,
} from "./logic";

export const CHAPTERS: Chapter[] = [
  { name: "形状城门", emoji: "🏰", color: "#d0f0fd", desc: "认一认八种形状", size: 17 },
  { name: "彩虹染坊", emoji: "🌈", color: "#ffe8cc", desc: "认颜色、找颜色", size: 17 },
  { name: "大小滑梯", emoji: "📏", color: "#d3f9d8", desc: "比一比谁大谁小", size: 17 },
  { name: "数边小桥", emoji: "🔢", color: "#fff3bf", desc: "数一数有几条边", size: 16 },
  { name: "数数广场", emoji: "🧮", color: "#e5dbff", desc: "一堆图形里数目标", size: 16 },
  { name: "国王大赛", emoji: "👑", color: "#ffdeeb", desc: "全部本领混合挑战", size: 16 },
];

export const CHAPTER_THEMES: QuizTheme[] = [
  { bg: "linear-gradient(#e7f5ff,#d0f0fd)", accent: "#1971c2" },
  { bg: "linear-gradient(#fff4e6,#ffe8cc)", accent: "#d9480f" },
  { bg: "linear-gradient(#e3fafc,#d3f9d8)", accent: "#2b8a3e" },
  { bg: "linear-gradient(#fff9db,#fff3bf)", accent: "#e8590c" },
  { bg: "linear-gradient(#f3f0ff,#e5dbff)", accent: "#6741d9" },
  { bg: "linear-gradient(#fff0f6,#ffdeeb)", accent: "#c2255c" },
];

const SHAPE_PATHS: Record<ShapeKind, string> = {
  circle: `<circle cx="50" cy="50" r="40"/>`,
  triangle: `<polygon points="50,10 90,85 10,85"/>`,
  square: `<rect x="15" y="15" width="70" height="70" rx="6"/>`,
  rectangle: `<rect x="5" y="26" width="90" height="48" rx="6"/>`,
  star: `<polygon points="50,5 61,38 95,38 67,59 78,92 50,71 22,92 33,59 5,38 39,38"/>`,
  heart: `<path d="M50,85 C20,60 5,40 15,25 C25,10 45,15 50,28 C55,15 75,10 85,25 C95,40 80,60 50,85 Z"/>`,
  diamond: `<polygon points="50,8 88,50 50,92 12,50"/>`,
  pentagon: `<polygon points="50,8 90,38 75,88 25,88 10,38"/>`,
};

/** 生成一个形状的内联 SVG（data-kind 供测试与调试） */
export function shapeSVG(kind: ShapeKind, color: ShapeColor, size: number): string {
  const body = SHAPE_PATHS[kind].replace(
    "/>",
    ` fill="${COLOR_VALUES[color]}" stroke="#495057" stroke-width="4" stroke-linejoin="round"/>`
  );
  return `<svg data-kind="${kind}" data-color="${color}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-label="${COLOR_NAMES[color]}${SHAPE_NAMES[kind]}">${body}</svg>`;
}

export type ShapeQKind = "shape" | "findshape" | "color" | "findcolor" | "size" | "sides" | "countshape";

export interface ShapeQ extends QuizQuestion {
  kind: ShapeQKind;
  answer: string;
}

function pickDistinct<T>(arr: readonly T[], n: number, rand: () => number, exclude: T[]): T[] {
  const pool = arr.filter((x) => !exclude.includes(x));
  const out: T[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 200) {
    const x = pick(rand, pool);
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

/** 看形状选名字 */
function qShape(rand: () => number): ShapeQ {
  const target = pick(rand, SHAPE_KINDS);
  const color = pick(rand, SHAPE_COLORS);
  const kinds = shuffled([target, ...pickDistinct(SHAPE_KINDS, 2, rand, [target])], rand);
  return {
    kind: "shape", answer: SHAPE_NAMES[target],
    promptHTML: shapeSVG(target, color, 92),
    ask: "这是什么形状？",
    choices: kinds.map((k) => SHAPE_NAMES[k]),
    correct: kinds.indexOf(target),
  };
}

/** 听名字找形状 */
function qFindShape(rand: () => number): ShapeQ {
  const target = pick(rand, SHAPE_KINDS);
  const kinds = shuffled([target, ...pickDistinct(SHAPE_KINDS, 2, rand, [target])], rand);
  const color = pick(rand, SHAPE_COLORS);
  return {
    kind: "findshape", answer: `data-kind="${target}"`,
    promptHTML: `<span style="font-size:34px">🔍</span>`,
    ask: `找出「${SHAPE_NAMES[target]}」！`,
    choices: kinds.map((k) => shapeSVG(k, color, 64)),
    correct: kinds.indexOf(target),
  };
}

/** 看颜色选名字 */
function qColor(rand: () => number): ShapeQ {
  const target = pick(rand, SHAPE_COLORS);
  const shape = pick(rand, SHAPE_KINDS);
  const colors = shuffled([target, ...pickDistinct(SHAPE_COLORS, 2, rand, [target])], rand);
  return {
    kind: "color", answer: COLOR_NAMES[target],
    promptHTML: shapeSVG(shape, target, 92),
    ask: "它是什么颜色？",
    choices: colors.map((c) => COLOR_NAMES[c]),
    correct: colors.indexOf(target),
  };
}

/** 听颜色找图形 */
function qFindColor(rand: () => number): ShapeQ {
  const target = pick(rand, SHAPE_COLORS);
  const colors = shuffled([target, ...pickDistinct(SHAPE_COLORS, 2, rand, [target])], rand);
  const shape = pick(rand, SHAPE_KINDS);
  return {
    kind: "findcolor", answer: `data-color="${target}"`,
    promptHTML: `<span style="font-size:34px">🎨</span>`,
    ask: `哪个是${COLOR_NAMES[target]}的？`,
    choices: colors.map((c) => shapeSVG(shape, c, 64)),
    correct: colors.indexOf(target),
  };
}

/** 比大小：三个同形不同大小 */
function qSize(rand: () => number): ShapeQ {
  const shape = pick(rand, SHAPE_KINDS);
  const color = pick(rand, SHAPE_COLORS);
  const goal = rand() < 0.5 ? "big" : "small";
  const sizes = shuffled([40, 60, 84], rand);
  const answerSize = goal === "big" ? Math.max(...sizes) : Math.min(...sizes);
  return {
    kind: "size", answer: `width="${answerSize}"`,
    promptHTML: `<span style="font-size:34px">${goal === "big" ? "🐘" : "🐭"}</span>`,
    ask: goal === "big" ? "哪个最大？" : "哪个最小？",
    choices: sizes.map((s) => shapeSVG(shape, color, s)),
    correct: sizes.indexOf(answerSize),
  };
}

/** 数边：这个形状有几条边 */
function qSides(rand: () => number): ShapeQ {
  const shape = pick(rand, SIDED_SHAPES);
  const color = pick(rand, SHAPE_COLORS);
  const answer = SHAPE_SIDES[shape];
  const options = [3, 4, 5, 6].filter((n) => n !== answer);
  const nums = shuffled([answer, ...pickDistinct(options, 2, rand, [])], rand);
  return {
    kind: "sides", answer: String(answer),
    promptHTML: shapeSVG(shape, color, 92),
    ask: `数一数，${SHAPE_NAMES[shape]}有几条边？`,
    choices: nums.map(String),
    correct: nums.indexOf(answer),
  };
}

/** 数数：一堆图形里有几个目标形状 */
function qCountShape(rand: () => number, maxCount: number): ShapeQ {
  const target = pick(rand, SHAPE_KINDS);
  const n = randInt(rand, 2, maxCount);
  const others = pickDistinct(SHAPE_KINDS, 2, rand, [target]);
  const group: string[] = [];
  for (let i = 0; i < n; i++) group.push(shapeSVG(target, pick(rand, SHAPE_COLORS), 44));
  const extra = randInt(rand, 2, 4);
  for (let i = 0; i < extra; i++) group.push(shapeSVG(pick(rand, others), pick(rand, SHAPE_COLORS), 44));
  const all = shuffled(group, rand);
  const set = new Set<number>([n]);
  let guard = 0;
  while (set.size < 3 && guard++ < 40) {
    const near = n + randInt(rand, -2, 2);
    if (near >= 1 && near <= maxCount + 3) set.add(near);
  }
  const nums = shuffled([...set], rand);
  return {
    kind: "countshape", answer: String(n),
    promptHTML: `<span style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;max-width:280px">${all.join("")}</span>`,
    ask: `图里有几个${SHAPE_NAMES[target]}？`,
    choices: nums.map(String),
    correct: nums.indexOf(n),
  };
}

/** 每关题目数：章节内 4 → 7 题递增 */
export function questionCount(level: number): number {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  return 4 + Math.min(3, Math.floor(t * 3.6));
}

export function kindPool(level: number): ShapeQKind[] {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  switch (ci) {
    case 0:
      return t < 0.5 ? ["shape"] : ["shape", "findshape"];
    case 1:
      return t < 0.5 ? ["color"] : ["color", "findcolor"];
    case 2:
      return t < 0.6 ? ["size"] : ["size", "shape"];
    case 3:
      return t < 0.6 ? ["sides"] : ["sides", "shape"];
    case 4:
      return t < 0.6 ? ["countshape"] : ["countshape", "sides"];
    default:
      return t < 0.4
        ? ["shape", "color", "size"]
        : ["shape", "findcolor", "size", "sides", "countshape"];
  }
}

/** 生成某一关的全部题目（确定性，重试不换题） */
export function buildQuestions(level: number): ShapeQ[] {
  const rand = mulberry32(7400 + level * 7919);
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  const kinds = kindPool(level);
  const count = questionCount(level);
  const out: ShapeQ[] = [];
  for (let i = 0; i < count; i++) {
    const kind = i < kinds.length ? kinds[i] : pick(rand, kinds);
    out.push(makeOne(rand, kind, t));
  }
  return shuffled(out, rand);
}

function makeOne(rand: () => number, kind: ShapeQKind, t: number): ShapeQ {
  switch (kind) {
    case "shape": return qShape(rand);
    case "findshape": return qFindShape(rand);
    case "color": return qColor(rand);
    case "findcolor": return qFindColor(rand);
    case "size": return qSize(rand);
    case "sides": return qSides(rand);
    default: return qCountShape(rand, t < 0.5 ? 5 : 7);
  }
}

/** 99 关概览（测试用） */
export const LEVELS = Array.from({ length: 99 }, (_, i) => ({
  count: questionCount(i),
  kinds: kindPool(i),
}));
