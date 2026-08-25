// 形状王国：分类出题纯逻辑（五关：形状/颜色/大小/数边/混合）

export type ShapeKind =
  | "circle"
  | "triangle"
  | "square"
  | "rectangle"
  | "star"
  | "heart"
  | "diamond"
  | "pentagon";
export type ShapeColor = "red" | "yellow" | "blue" | "green" | "purple" | "orange";

export const SHAPE_KINDS: ShapeKind[] = [
  "circle",
  "triangle",
  "square",
  "rectangle",
  "star",
  "heart",
  "diamond",
  "pentagon",
];
export const SHAPE_COLORS: ShapeColor[] = ["red", "yellow", "blue", "green", "purple", "orange"];

export const SHAPE_NAMES: Record<ShapeKind, string> = {
  circle: "圆形",
  triangle: "三角形",
  square: "方形",
  rectangle: "长方形",
  star: "星形",
  heart: "爱心",
  diamond: "菱形",
  pentagon: "五边形",
};

export const COLOR_NAMES: Record<ShapeColor, string> = {
  red: "红色",
  yellow: "黄色",
  blue: "蓝色",
  green: "绿色",
  purple: "紫色",
  orange: "橙色",
};

export const COLOR_VALUES: Record<ShapeColor, string> = {
  red: "#fa5252",
  yellow: "#ffd43b",
  blue: "#4dabf7",
  green: "#51cf66",
  purple: "#9775fa",
  orange: "#ff922b",
};

/** 有明确「边数」的形状，用于数边题 */
export const SIDED_SHAPES: ShapeKind[] = ["triangle", "square", "rectangle", "diamond", "pentagon"];
export const SHAPE_SIDES: Record<ShapeKind, number> = {
  circle: 0,
  triangle: 3,
  square: 4,
  rectangle: 4,
  diamond: 4,
  pentagon: 5,
  star: 10,
  heart: 0,
};

export type RoundMode = "shape" | "color" | "size" | "sides";

export type ShapeRound = {
  /** 本轮按什么分类 */
  mode: RoundMode;
  shape: ShapeKind;
  color: ShapeColor;
  /**
   * 三扇城堡门的取值，已打乱：
   * shape 题是形状 key，color 题是颜色 key，
   * size 题是缩放百分比字符串，sides 题是边数字符串。
   */
  bins: string[];
  answerIndex: number;
  /** size 题的目标：找最大还是最小 */
  goal?: "big" | "small";
};

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickDistinct<T>(arr: T[], n: number, rand: () => number, exclude: T[] = []): T[] {
  const pool = arr.filter((x) => !exclude.includes(x));
  const out: T[] = [];
  while (out.length < n && pool.length > 0) {
    const x = pick(pool, rand);
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

/** 认形状 / 认颜色题（兼容旧接口） */
export function makeShapeRound(rand: () => number = Math.random, mode?: "shape" | "color"): ShapeRound {
  const m: "shape" | "color" = mode ?? (rand() < 0.5 ? "shape" : "color");
  const shape = pick(SHAPE_KINDS, rand);
  const color = pick(SHAPE_COLORS, rand);
  if (m === "shape") {
    const distractors = pickDistinct(SHAPE_KINDS, 2, rand, [shape]);
    const bins = shuffle<string>([shape, ...distractors], rand);
    return { mode: m, shape, color, bins, answerIndex: bins.indexOf(shape) };
  }
  const distractors = pickDistinct(SHAPE_COLORS, 2, rand, [color]);
  const bins = shuffle<string>([color, ...distractors], rand);
  return { mode: m, shape, color, bins, answerIndex: bins.indexOf(color) };
}

/** 比大小题：三个同形不同大小的图形，找最大或最小 */
export function makeSizeRound(rand: () => number = Math.random): ShapeRound {
  const shape = pick(SHAPE_KINDS, rand);
  const color = pick(SHAPE_COLORS, rand);
  const goal: "big" | "small" = rand() < 0.5 ? "big" : "small";
  const sizes = shuffle([44, 66, 92], rand);
  const answerSize = goal === "big" ? Math.max(...sizes) : Math.min(...sizes);
  const bins = sizes.map((s) => String(s));
  return { mode: "size", shape, color, bins, answerIndex: sizes.indexOf(answerSize), goal };
}

/** 数边题：这个形状有几条边 */
export function makeSidesRound(rand: () => number = Math.random): ShapeRound {
  const shape = pick(SIDED_SHAPES, rand);
  const color = pick(SHAPE_COLORS, rand);
  const answer = SHAPE_SIDES[shape];
  const options = [3, 4, 5, 6].filter((n) => n !== answer);
  const distractors = pickDistinct(options, 2, rand);
  const nums = shuffle([answer, ...distractors], rand);
  const bins = nums.map((n) => String(n));
  return { mode: "sides", shape, color, bins, answerIndex: nums.indexOf(answer) };
}

/**
 * 按关卡出题：
 * 1 认形状；2 认颜色；3 比大小；4 数边数；5 混合挑战。
 */
export function makeRoundForLevel(level: 1 | 2 | 3 | 4 | 5, rand: () => number = Math.random): ShapeRound {
  if (level === 1) return makeShapeRound(rand, "shape");
  if (level === 2) return makeShapeRound(rand, "color");
  if (level === 3) return makeSizeRound(rand);
  if (level === 4) return makeSidesRound(rand);
  const r = rand();
  if (r < 0.25) return makeShapeRound(rand, "shape");
  if (r < 0.5) return makeShapeRound(rand, "color");
  if (r < 0.75) return makeSizeRound(rand);
  return makeSidesRound(rand);
}
