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

// ---------------------------------------------------------------------------
// 1.1 新增：周长面积、对称旋转、立体图形、坐标方位（第 100–188 关专用纯逻辑）
// 上面那套认形状 / 认颜色的接口一个都没动，前 99 关照旧。
// ---------------------------------------------------------------------------

/** 长方形周长 */
export function rectPerimeter(w: number, h: number): number {
  return 2 * (w + h);
}

/** 长方形面积 */
export function rectArea(w: number, h: number): number {
  return w * h;
}

/** 直角三角形面积（底 × 高 ÷ 2） */
export function triangleArea(base: number, height: number): number {
  return (base * height) / 2;
}

/** 大长方形缺掉一个角后的面积 */
export function lShapeArea(w: number, h: number, cutW: number, cutH: number): number {
  return w * h - cutW * cutH;
}

/**
 * 大长方形缺掉一个角后的周长：缺口多出来的两条边，长度刚好等于被切掉的两条，
 * 所以周长和原来的长方形一模一样。
 */
export function lShapePerimeter(w: number, h: number): number {
  return 2 * (w + h);
}

/** 各形状的对称轴条数（-1 表示无数条，比如圆） */
export const SYMMETRY_AXES: Record<ShapeKind, number> = {
  circle: -1,
  triangle: 1,
  square: 4,
  rectangle: 2,
  star: 5,
  heart: 1,
  diamond: 2,
  pentagon: 5,
};

/** 对称轴条数是有限值的形状（出题只用这些，避免「无数条」造成歧义） */
export const SYMMETRIC_SHAPES: ShapeKind[] = [
  "triangle",
  "square",
  "rectangle",
  "star",
  "heart",
  "diamond",
  "pentagon",
];

export type SolidKind =
  | "cube"
  | "cuboid"
  | "triPrism"
  | "squarePyramid"
  | "triPyramid"
  | "cylinder"
  | "cone"
  | "sphere";

export const SOLID_KINDS: SolidKind[] = [
  "cube",
  "cuboid",
  "triPrism",
  "squarePyramid",
  "triPyramid",
  "cylinder",
  "cone",
  "sphere",
];

/** 有棱有顶点的立体（面 / 棱 / 顶点三种问法都能问） */
export const POLYHEDRA: SolidKind[] = ["cube", "cuboid", "triPrism", "squarePyramid", "triPyramid"];

export const SOLID_NAMES: Record<SolidKind, string> = {
  cube: "正方体",
  cuboid: "长方体",
  triPrism: "三棱柱",
  squarePyramid: "四棱锥",
  triPyramid: "三棱锥",
  cylinder: "圆柱",
  cone: "圆锥",
  sphere: "球",
};

export const SOLID_FACES: Record<SolidKind, number> = {
  cube: 6, cuboid: 6, triPrism: 5, squarePyramid: 5, triPyramid: 4, cylinder: 3, cone: 2, sphere: 1,
};
export const SOLID_EDGES: Record<SolidKind, number> = {
  cube: 12, cuboid: 12, triPrism: 9, squarePyramid: 8, triPyramid: 6, cylinder: 0, cone: 0, sphere: 0,
};
export const SOLID_VERTICES: Record<SolidKind, number> = {
  cube: 8, cuboid: 8, triPrism: 6, squarePyramid: 5, triPyramid: 4, cylinder: 0, cone: 1, sphere: 0,
};

/** 各立体的展开图长什么样（一句话描述，孩子能对上） */
export const SOLID_NETS: Record<SolidKind, string> = {
  cube: "6 个一样大的正方形",
  cuboid: "6 个长方形，对面两两相同",
  triPrism: "2 个三角形 ＋ 3 个长方形",
  squarePyramid: "1 个正方形 ＋ 4 个三角形",
  triPyramid: "4 个一样的三角形",
  cylinder: "2 个圆 ＋ 1 个长方形",
  cone: "1 个圆 ＋ 1 个扇形",
  sphere: "球面展不平，没有平面展开图",
};

/** 布尔方格图案 → "0110" 这样的字符串（写进 SVG 的 data 属性，便于判定与测试） */
export function cellsKey(cells: readonly boolean[]): string {
  return cells.map((b) => (b ? "1" : "0")).join("");
}

/** "0110" → 布尔方格图案 */
export function keyCells(key: string): boolean[] {
  return key.split("").map((c) => c === "1");
}

/** 图案顺时针旋转 90° */
export function rotateCellsCW(cells: readonly boolean[], size: number): boolean[] {
  const out = new Array<boolean>(size * size).fill(false);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      out[r * size + c] = cells[(size - 1 - c) * size + r];
    }
  }
  return out;
}

/** 图案旋转 quarters 个 90°（负数就是逆时针） */
export function rotateCells(cells: readonly boolean[], size: number, quarters: number): boolean[] {
  let out = cells.slice();
  const n = (((Math.round(quarters) % 4) + 4) % 4);
  for (let i = 0; i < n; i++) out = rotateCellsCW(out, size);
  return out;
}

/** 图案左右翻转（照镜子） */
export function mirrorCellsH(cells: readonly boolean[], size: number): boolean[] {
  const out = new Array<boolean>(size * size).fill(false);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      out[r * size + c] = cells[r * size + (size - 1 - c)];
    }
  }
  return out;
}

export type Direction = "右" | "左" | "上" | "下";
export const DIRECTIONS: Direction[] = ["右", "左", "上", "下"];

export interface Move {
  dir: Direction;
  steps: number;
}

/** 从 (x, y) 出发，按方位一步步走，返回终点（原点在左下角，向右 x 增大、向上 y 增大） */
export function movePoint(x: number, y: number, moves: readonly Move[]): { x: number; y: number } {
  let cx = Math.round(x);
  let cy = Math.round(y);
  for (const m of moves) {
    const n = Math.round(m.steps);
    if (m.dir === "右") cx += n;
    else if (m.dir === "左") cx -= n;
    else if (m.dir === "上") cy += n;
    else cy -= n;
  }
  return { x: cx, y: cy };
}

/** 坐标写法「(3, 2)」 */
export function formatPoint(x: number, y: number): string {
  return `(${x}, ${y})`;
}
