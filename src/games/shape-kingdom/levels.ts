// 形状王国：188 关 · 十大王国区域题库生成（认形状 → 周长面积/对称旋转/立体展开/坐标方位）
//
// 1.1 起总关数 99 → 188：前 99 关（前 6 章）的章节切分、seed、生成参数逐字未动，
// 新的 4 章共 89 关只在末尾追加，面向约小学六年级，允许多步推理。
//
// 1.2 只动第 100–188 关：补齐题型（分类归纳 / 挑展开图 / 复合变换 / 多步坐标）、
// 给每道题写上「推理步数」与三级提示、几何结论一律改从 `geometry.ts` / `nets.ts` 求，
// 图形改用 `figures.ts` 的精确顶点与等距斜投影。
// **前 6 章的分支、seed、生成参数一个字都没动**，`upgrade12.test.ts` 用 99 个逐关指纹钉死。
import { TOTAL_LEVELS, mulberry32, pick, randInt, shuffled, chapterOf, indexInChapter, type Chapter } from "../level99";
import type { QuizQuestion, QuizTheme } from "../quiz99";
import {
  cellSet,
  compositeArea,
  lShapeCells,
  notchCells,
  notchPerimeter,
  polyominoArea,
  polyominoPerimeter,
  rectCells,
  stackedCells,
} from "./geometry";
import { exactAxisCount, exactShapeSVG, gridFigureSVG, isoSolidSVG } from "./figures";
import { cubeNetSVG, cubeNets, nonCubeNets } from "./nets";
import { safeHints, trio, type HintTrio } from "./hints";
import {
  COLOR_NAMES,
  COLOR_VALUES,
  DIRECTIONS,
  POLYHEDRA,
  SHAPE_COLORS,
  SHAPE_KINDS,
  SHAPE_NAMES,
  SHAPE_SIDES,
  SIDED_SHAPES,
  SOLID_EDGES,
  SOLID_FACES,
  SOLID_KINDS,
  SOLID_NAMES,
  SOLID_NETS,
  SOLID_VERTICES,
  SYMMETRIC_SHAPES,
  SYMMETRY_AXES,
  cellsKey,
  formatPoint,
  lShapeArea,
  lShapePerimeter,
  mirrorCellsH,
  movePoint,
  rectArea,
  rectPerimeter,
  rotateCells,
  triangleArea,
  type Direction,
  type Move,
  type ShapeColor,
  type ShapeKind,
  type SolidKind,
} from "./logic";

/** 1.0 时代的章节数：下标 < 这个数的章节一律保持原样 */
export const LEGACY_CHAPTER_COUNT = 6;

export const CHAPTERS: Chapter[] = [
  { name: "形状城门", emoji: "🏰", color: "#d0f0fd", desc: "认一认八种形状", size: 17 },
  { name: "彩虹染坊", emoji: "🌈", color: "#ffe8cc", desc: "认颜色、找颜色", size: 17 },
  { name: "大小滑梯", emoji: "📏", color: "#d3f9d8", desc: "比一比谁大谁小", size: 17 },
  { name: "数边小桥", emoji: "🔢", color: "#fff3bf", desc: "数一数有几条边", size: 16 },
  { name: "数数广场", emoji: "🧮", color: "#e5dbff", desc: "一堆图形里数目标", size: 16 },
  { name: "国王大赛", emoji: "👑", color: "#ffdeeb", desc: "全部本领混合挑战", size: 16 },
  // ↓ 1.1 新增：第 100–188 关
  { name: "周长面积镇", emoji: "📐", color: "#ffe9d6", desc: "量一圈是周长，铺满是面积，缺角图形也难不倒", size: 23 },
  { name: "对称旋转塔", emoji: "🪞", color: "#e7e0ff", desc: "数对称轴、照镜子、把图案转个方向", size: 22 },
  { name: "立体展开馆", emoji: "🧊", color: "#d9f2f7", desc: "立体图形的面棱顶点，还要认出它的展开图", size: 22 },
  { name: "坐标方位岛", emoji: "🧭", color: "#e6f5df", desc: "看坐标找图形，按方位一步步走到终点", size: 22 },
];

export const CHAPTER_THEMES: QuizTheme[] = [
  { bg: "linear-gradient(#e7f5ff,#d0f0fd)", accent: "#1971c2" },
  { bg: "linear-gradient(#fff4e6,#ffe8cc)", accent: "#d9480f" },
  { bg: "linear-gradient(#e3fafc,#d3f9d8)", accent: "#2b8a3e" },
  { bg: "linear-gradient(#fff9db,#fff3bf)", accent: "#e8590c" },
  { bg: "linear-gradient(#f3f0ff,#e5dbff)", accent: "#6741d9" },
  { bg: "linear-gradient(#fff0f6,#ffdeeb)", accent: "#c2255c" },
  { bg: "linear-gradient(#fff5eb,#ffe9d6)", accent: "#c2410c" },
  { bg: "linear-gradient(#f3f0ff,#e7e0ff)", accent: "#5f3dc4" },
  { bg: "linear-gradient(#ecfbfe,#d9f2f7)", accent: "#0b7285" },
  { bg: "linear-gradient(#f2fbee,#e6f5df)", accent: "#2f9e44" },
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

export type LegacyShapeQKind = "shape" | "findshape" | "color" | "findcolor" | "size" | "sides" | "countshape";
/** 1.1 新增的进阶题型（第 100–188 关专用） */
export type AdvancedShapeQKind =
  | "perimeter"
  | "area"
  | "symmetry"
  | "mirror"
  | "rotate"
  | "solid"
  | "net"
  | "coord"
  | "path"
  // ↓ 1.2 新增
  | "classify"
  | "netpick"
  | "symsum"
  | "transform"
  | "solidcalc"
  | "coordmove";
export type ShapeQKind = LegacyShapeQKind | AdvancedShapeQKind;

export interface ShapeQ extends QuizQuestion {
  kind: ShapeQKind;
  answer: string;
  /**
   * 这道题要推几步（1.2 新增）。**只有第 100–188 关才有**：
   * 前 99 关的题目对象一个键都不多，快照才钉得死。
   */
  steps?: 1 | 2 | 3;
  /** 三级提示（同样只给第 100–188 关）；任何一级都不含答案 */
  hints?: HintTrio;
}

/** 每种进阶题型最多能撑到几步推理（难度曲线按它裁剪） */
export const MAX_STEPS: Record<AdvancedShapeQKind, 1 | 2 | 3> = {
  perimeter: 3,
  area: 3,
  symmetry: 1,
  mirror: 1,
  rotate: 3,
  solid: 2,
  net: 1,
  coord: 1,
  path: 3,
  classify: 3,
  netpick: 2,
  symsum: 3,
  transform: 3,
  solidcalc: 3,
  coordmove: 3,
};

/**
 * 本关的推理步数目标：前 6 章一律 1 步（契约冻结），
 * 后 4 章按章内位置走难度曲线——前 1/3 单步、中 1/3 两步、后 1/3 三步。
 */
export function stepsForLevel(level: number): 1 | 2 | 3 {
  const ci = chapterOf(CHAPTERS, level);
  if (ci < LEGACY_CHAPTER_COUNT) return 1;
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  if (t < 1 / 3) return 1;
  if (t < 2 / 3) return 2;
  return 3;
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

// ---------------------------------------------------------------------------
// 1.1 新机制一：方格纸上的周长与面积（长方形 / 直角三角形 / 缺角的 L 形）
// ---------------------------------------------------------------------------

function gridLines(cols: number, rows: number, u: number, ox: number, oy: number): string {
  let s = "";
  for (let c = 0; c <= cols; c++) {
    s += `<line x1="${(ox + c * u).toFixed(1)}" y1="${oy.toFixed(1)}" x2="${(ox + c * u).toFixed(1)}" y2="${(oy + rows * u).toFixed(1)}" stroke="#dee2e6" stroke-width="1"/>`;
  }
  for (let r = 0; r <= rows; r++) {
    s += `<line x1="${ox.toFixed(1)}" y1="${(oy + r * u).toFixed(1)}" x2="${(ox + cols * u).toFixed(1)}" y2="${(oy + r * u).toFixed(1)}" stroke="#dee2e6" stroke-width="1"/>`;
  }
  return s;
}

/** 带边长标注的长方形 */
export function rectFigSVG(w: number, h: number): string {
  const u = Math.min(16, 150 / w, 84 / h);
  const rw = w * u;
  const rh = h * u;
  const ox = (220 - rw) / 2;
  const oy = 20;
  return `<svg data-fig="rect" data-w="${w}" data-h="${h}" width="220" height="150" viewBox="0 0 220 150" aria-label="长 ${w} 厘米、宽 ${h} 厘米的长方形">
    ${gridLines(w, h, u, ox, oy)}
    <rect x="${ox.toFixed(1)}" y="${oy}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="#a5d8ff88" stroke="#1971c2" stroke-width="3"/>
    <text x="${(ox + rw / 2).toFixed(1)}" y="${(oy + rh + 24).toFixed(1)}" font-size="15" font-weight="800" text-anchor="middle" fill="#1864ab">${w} 厘米</text>
    <text x="${(ox - 6).toFixed(1)}" y="${(oy + rh / 2 + 5).toFixed(1)}" font-size="15" font-weight="800" text-anchor="end" fill="#1864ab">${h} 厘米</text>
  </svg>`;
}

/** 带底与高标注的直角三角形 */
export function triFigSVG(base: number, height: number): string {
  const u = Math.min(16, 150 / base, 84 / height);
  const bw = base * u;
  const bh = height * u;
  const ox = (220 - bw) / 2;
  const oy = 20;
  const pts = `${ox.toFixed(1)},${(oy + bh).toFixed(1)} ${(ox + bw).toFixed(1)},${(oy + bh).toFixed(1)} ${ox.toFixed(1)},${oy}`;
  return `<svg data-fig="tri" data-b="${base}" data-h="${height}" width="220" height="150" viewBox="0 0 220 150" aria-label="底 ${base} 厘米、高 ${height} 厘米的直角三角形">
    ${gridLines(base, height, u, ox, oy)}
    <polygon points="${pts}" fill="#b2f2bb88" stroke="#2f9e44" stroke-width="3"/>
    <text x="${(ox + bw / 2).toFixed(1)}" y="${(oy + bh + 24).toFixed(1)}" font-size="15" font-weight="800" text-anchor="middle" fill="#2b8a3e">底 ${base} 厘米</text>
    <text x="${(ox - 6).toFixed(1)}" y="${(oy + bh / 2 + 5).toFixed(1)}" font-size="15" font-weight="800" text-anchor="end" fill="#2b8a3e">高 ${height} 厘米</text>
  </svg>`;
}

/** 缺掉右上角的 L 形（方格纸上数得出来） */
export function lFigSVG(w: number, h: number, cutW: number, cutH: number): string {
  const u = Math.min(18, 150 / w, 84 / h);
  const ox = (220 - w * u) / 2;
  const oy = 20;
  const px = (x: number) => (ox + x * u).toFixed(1);
  const py = (y: number) => (oy + y * u).toFixed(1);
  const pts = [
    `${px(0)},${py(0)}`,
    `${px(w - cutW)},${py(0)}`,
    `${px(w - cutW)},${py(cutH)}`,
    `${px(w)},${py(cutH)}`,
    `${px(w)},${py(h)}`,
    `${px(0)},${py(h)}`,
  ].join(" ");
  return `<svg data-fig="ell" data-w="${w}" data-h="${h}" data-cw="${cutW}" data-ch="${cutH}" width="220" height="150" viewBox="0 0 220 150" aria-label="缺了一角的图形">
    ${gridLines(w, h, u, ox, oy)}
    <polygon points="${pts}" fill="#ffd8a888" stroke="#e8590c" stroke-width="3"/>
    <text x="110" y="146" font-size="13" font-weight="800" text-anchor="middle" fill="#d9480f">每个小格是 1 厘米</text>
  </svg>`;
}

function unitChoices(rand: () => number, answer: number, unit: string, deltas: number[]): { choices: string[]; correct: number; answer: string } {
  const set = new Set<number>([answer]);
  let guard = 0;
  while (set.size < 3 && guard++ < 120) {
    const v = answer + pick(rand, deltas) * (rand() < 0.5 ? 1 : -1);
    if (v > 0 && v !== answer) set.add(v);
  }
  let filler = 1;
  while (set.size < 3) set.add(answer + filler++);
  const arr = shuffled([...set], rand);
  const label = `${answer} ${unit}`;
  return { choices: arr.map((v) => `${v} ${unit}`), correct: arr.indexOf(answer), answer: label };
}

/**
 * 周长题。步数决定图形：
 *  1 步 —— 长方形，套公式；
 *  2 步 —— 缺一个角的 L 形，要先想明白「缺角不改变周长」再套公式；
 *  3 步 —— 边中间啃了一个凹槽，先算大长方形周长、再数凹槽深度、再补上两条竖边。
 */
function qPerimeter(rand: () => number, t: number, steps: 1 | 2 | 3): ShapeQ {
  if (steps >= 3) {
    const w = randInt(rand, 5, 9);
    const h = randInt(rand, 3, 6);
    const notchW = randInt(rand, 1, Math.max(1, w - 4));
    const notchH = randInt(rand, 1, Math.max(1, h - 2));
    const atC = randInt(rand, 1, w - notchW - 1);
    const cells = notchCells(w, h, notchW, notchH, atC);
    const value = polyominoPerimeter(cells);
    const { choices, correct, answer } = unitChoices(rand, value, "厘米", [2, 4, notchH * 2, w, h]);
    return {
      kind: "perimeter", answer, steps,
      promptHTML: gridFigureSVG(cells, { fig: "notch", fill: "#ffd8a8", stroke: "#e8590c" }),
      ask: "沿着边走一圈有多长？",
      choices, correct,
      hints: trio(
        "先想清楚：周长是沿着边界走一圈的长度，凹进去的那几段也得走。",
        "先按没有缺口的大长方形算 （长 + 宽）× 2，再补上凹槽两侧多出来的两条竖边。",
        `没有凹槽时这个长方形的周长是 ${rectPerimeter(w, h)} 厘米，接着数凹槽有多深。`
      ),
    };
  }
  if (steps === 2) {
    const w = randInt(rand, 4, 12);
    const h = randInt(rand, 3, 8);
    const cutW = randInt(rand, 1, Math.max(1, w - 2));
    const cutH = randInt(rand, 1, Math.max(1, h - 1));
    const value = lShapePerimeter(w, h);
    const { choices, correct, answer } = unitChoices(rand, value, "厘米", [2, 4, cutW * 2, cutH * 2, 6]);
    return {
      kind: "perimeter", answer, steps,
      promptHTML: lFigSVG(w, h, cutW, cutH),
      ask: "沿着边走一圈有多长？",
      choices, correct,
      hints: trio(
        "先想周长是绕一圈，再看看缺掉的那一角有没有把「一圈」变长或者变短。",
        "把缺口的两条边平移回去，正好补成原来的长方形：周长 = （长 + 宽）× 2。",
        `补回去以后长是 ${w} 厘米、宽是 ${h} 厘米，长加宽先算出来是 ${w + h}。`
      ),
    };
  }
  const w = randInt(rand, 4, t < 0.5 ? 9 : 14);
  const h = randInt(rand, 2, t < 0.5 ? 7 : 10);
  const value = rectPerimeter(w, h);
  const { choices, correct, answer } = unitChoices(rand, value, "厘米", [2, 4, w, h, 10]);
  return {
    kind: "perimeter", answer, steps,
    promptHTML: rectFigSVG(w, h),
    ask: "这个长方形的周长是多少？",
    choices, correct,
    hints: trio(
      "先想周长是绕一圈：四条边都要走到，不是只走两条。",
      "长方形周长 = （长 + 宽）× 2。",
      `图上长是 ${w} 厘米、宽是 ${h} 厘米，长加宽先算出来是 ${w + h}。`
    ),
  };
}

/**
 * 面积题。步数决定图形：
 *  1 步 —— 长方形；
 *  2 步 —— 直角三角形（先算长方形再对半）或缺角 L 形（先整块再减缺口）；
 *  3 步 —— 上下两块拼起来的组合图形，分别算完再相加。
 */
function qArea(rand: () => number, t: number, steps: 1 | 2 | 3): ShapeQ {
  if (steps >= 3) {
    const topW = randInt(rand, 2, 4);
    const topH = randInt(rand, 1, 3);
    const bottomW = randInt(rand, topW + 1, topW + 4);
    const bottomH = randInt(rand, 1, 3);
    const cells = stackedCells(topW, topH, bottomW, bottomH);
    const value = compositeArea([{ w: topW, h: topH }, { w: bottomW, h: bottomH }]);
    const { choices, correct, answer } = unitChoices(rand, value, "平方厘米", [topW * topH, bottomW * bottomH, 2, 3]);
    return {
      kind: "area", answer, steps,
      promptHTML: gridFigureSVG(cells, { fig: "comp", fill: "#b2f2bb", stroke: "#2f9e44" }),
      ask: "这个图形的面积是多少？",
      choices, correct,
      hints: trio(
        "先想面积是「铺满里面要多少个方格」，跟绕一圈的长度不是一回事。",
        "把它切成上下两块长方形，各自「长 × 宽」，最后把两块加起来。",
        `上面那块是 ${topW} 乘 ${topH}，先把它算出来是 ${topW * topH} 平方厘米。`
      ),
    };
  }
  if (steps === 2) {
    if (rand() < 0.5) {
      // 直角三角形：保证底 × 高是偶数，面积一定是整数
      let base = randInt(rand, 3, 12);
      let height = randInt(rand, 2, 9);
      if ((base * height) % 2 !== 0) height = height + 1 <= 10 ? height + 1 : height - 1;
      if ((base * height) % 2 !== 0) base = base + 1;
      const value = triangleArea(base, height);
      const { choices, correct, answer } = unitChoices(rand, value, "平方厘米", [base, height, 2, base * height - value]);
      return {
        kind: "area", answer, steps,
        promptHTML: triFigSVG(base, height),
        ask: "这个三角形的面积是多少？",
        choices, correct,
        hints: trio(
          "先想：这个直角三角形正好是某个长方形的一半。",
          "三角形面积 = 底 × 高 ÷ 2。",
          `底乘高先算出来是 ${base * height}，别忘了后面还有一步。`
        ),
      };
    }
    const w = randInt(rand, 5, 12);
    const h = randInt(rand, 3, 9);
    const cutW = randInt(rand, 1, w - 2);
    const cutH = randInt(rand, 1, h - 1);
    const value = lShapeArea(w, h, cutW, cutH);
    const { choices, correct, answer } = unitChoices(rand, value, "平方厘米", [cutW * cutH, w, h, 2]);
    return {
      kind: "area", answer, steps,
      promptHTML: lFigSVG(w, h, cutW, cutH),
      ask: "缺了一角，面积还有多少？",
      choices, correct,
      hints: trio(
        "先想面积是铺满里面要几个方格，缺掉的那块不算。",
        "整块长方形的面积减去缺口那一小块：长 × 宽 − 缺口的长 × 缺口的宽。",
        `整块长方形先算出来是 ${w * h} 平方厘米，接着看缺口有多大。`
      ),
    };
  }
  const w = randInt(rand, 3, t < 0.5 ? 9 : 14);
  const h = randInt(rand, 2, t < 0.5 ? 7 : 10);
  const value = rectArea(w, h);
  const { choices, correct, answer } = unitChoices(rand, value, "平方厘米", [w, h, 2, w + h]);
  return {
    kind: "area", answer, steps,
    promptHTML: rectFigSVG(w, h),
    ask: "这个长方形的面积是多少？",
    choices, correct,
    hints: trio(
      "先想面积是「铺满要多少个方格」，别跟绕一圈的周长搞混。",
      "长方形面积 = 长 × 宽。",
      `一行能摆 ${w} 个方格，接下来数一数一共有几行。`
    ),
  };
}

// ---------------------------------------------------------------------------
// 1.1 新机制二：对称轴、镜像、旋转
// ---------------------------------------------------------------------------

/**
 * 数对称轴。
 *
 * 1.2 改用 `figures.ts` 的**精确顶点**渲染：1.1 那个「五边形」其实不是正五边形
 * （边长 50/52.2 交替，只有 1 条对称轴），图和「5 条」的答案对不上。
 * 现在正五边形、正五角星都是现算顶点，`exactAxisCount` 数出来多少条就是多少条。
 */
function qSymmetry(rand: () => number): ShapeQ {
  const shape = pick(rand, SYMMETRIC_SHAPES);
  const color = pick(rand, SHAPE_COLORS);
  const axes = SYMMETRY_AXES[shape];
  const set = new Set<number>([axes]);
  let guard = 0;
  while (set.size < 3 && guard++ < 60) {
    const v = randInt(rand, 1, 6);
    if (v !== axes) set.add(v);
  }
  const arr = shuffled([...set], rand);
  return {
    kind: "symmetry", answer: `${axes} 条`, steps: 1,
    promptHTML: exactShapeSVG(shape, color, 100),
    ask: "它有几条对称轴？",
    choices: arr.map((v) => `${v} 条`),
    correct: arr.indexOf(axes),
    hints: trio(
      "先想清楚对称轴是什么：一条能让图形对折之后完全重合的线。",
      "横着、竖着、斜着都要试一遍，别只试竖的那一条。",
      "先从最容易看出来的竖线开始试，试完再把图形在心里转一转换个方向试。"
    ),
  };
}

/**
 * 对称轴的合计与比较（1.2 新增，两步 / 三步）。
 * 两步：两个图形一共几条；三步：三个图形里最多的那个有几条。
 */
function qSymSum(rand: () => number, steps: 2 | 3): ShapeQ {
  const n = steps === 2 ? 2 : 3;
  const kinds: ShapeKind[] = [];
  let guard = 0;
  while (kinds.length < n && guard++ < 200) {
    const k = pick(rand, SYMMETRIC_SHAPES);
    if (!kinds.includes(k)) kinds.push(k);
  }
  const axes = kinds.map((k) => SYMMETRY_AXES[k]);
  let value: number;
  let ask: string;
  if (steps === 2) {
    value = axes[0] + axes[1];
    ask = "两个图形一共几条对称轴？";
  } else {
    // 保证「最多的那一个」唯一，答案才不含糊
    const max = Math.max(...axes);
    if (axes.filter((a) => a === max).length > 1) {
      const spare = SYMMETRIC_SHAPES.filter((k) => !kinds.includes(k) && SYMMETRY_AXES[k] < max);
      if (spare.length > 0) {
        const idx = axes.lastIndexOf(max);
        kinds[idx] = spare[0];
        axes[idx] = SYMMETRY_AXES[spare[0]];
      }
    }
    value = Math.max(...axes);
    ask = "对称轴最多的有几条？";
  }
  const set = new Set<number>([value]);
  guard = 0;
  while (set.size < 3 && guard++ < 80) {
    const v = value + randInt(rand, -3, 3);
    if (v >= 1 && v !== value) set.add(v);
  }
  let filler = 1;
  while (set.size < 3) set.add(value + filler++);
  const arr = shuffled([...set], rand);
  const colors = kinds.map(() => pick(rand, SHAPE_COLORS));
  const figures = kinds.map((k, i) => exactShapeSVG(k, colors[i], 72)).join("");
  return {
    kind: "symsum", answer: `${value} 条`, steps,
    promptHTML: `<span data-sym="${kinds.join(",")}" data-symask="${steps === 2 ? "sum" : "max"}" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">${figures}</span>`,
    ask,
    choices: arr.map((v) => `${v} 条`),
    correct: arr.indexOf(value),
    hints: trio(
      "先想清楚：要先把每个图形各自的对称轴数清楚，再拿它们做比较或者相加。",
      steps === 2 ? "把第一个图形的条数和第二个图形的条数加起来。" : "把每个图形的条数都数出来，再挑其中最大的那个。",
      "先只看最左边那一个，把它对折的方向一个个试完，别急着看后面的。"
    ),
  };
}

/** 方格图案（data-cells 供判定与测试） */
export function patternSVG(cells: readonly boolean[], size: number, px: number, color: string): string {
  const u = px / size;
  let body = "";
  cells.forEach((on, i) => {
    const r = Math.floor(i / size);
    const c = i % size;
    body += `<rect x="${(c * u).toFixed(1)}" y="${(r * u).toFixed(1)}" width="${u.toFixed(1)}" height="${u.toFixed(1)}" fill="${on ? color : "#f1f3f5"}" stroke="#ced4da" stroke-width="1"/>`;
  });
  return `<svg data-cells="${cellsKey(cells)}" data-size="${size}" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" aria-label="方格图案">${body}</svg>`;
}

/**
 * 图案的八种摆法：四个旋转 + 四个「先照镜子再旋转」。
 * 八个 key 全都不同，才说明这个图案完全不对称，出题时任何两个选项都不会撞车。
 */
function dihedralKeys(cells: readonly boolean[], size: number): string[] {
  const mirrored = mirrorCellsH(cells, size);
  const out: string[] = [];
  for (let q = 0; q < 4; q++) {
    out.push(cellsKey(rotateCells(cells, size, q)));
    out.push(cellsKey(rotateCells(mirrored, size, q)));
  }
  return out;
}

/**
 * 随机一个完全不对称的图案。
 *
 * 1.1 只要求「四个旋转 + 一个镜像」共 5 个不重样，而且兜底图案是 L 形三格骨牌——
 * 它顺时针 90° 恰好等于左右镜像，一旦走到兜底就会冒出两个一样的选项。
 * 1.2 把条件收紧成八种摆法全不同，兜底也换成一个真正手性的四格骨牌。
 */
function makePattern(rand: () => number, size: number): boolean[] {
  for (let guard = 0; guard < 400; guard++) {
    const cells = Array.from({ length: size * size }, () => rand() < 0.42);
    const on = cells.filter(Boolean).length;
    if (on < 3 || on > size * size - 3) continue;
    if (new Set(dihedralKeys(cells, size)).size === 8) return cells;
  }
  // 兜底：J 形四格骨牌，八种摆法互不相同
  const cells = new Array<boolean>(size * size).fill(false);
  cells[0] = true;
  cells[size] = true;
  cells[size * 2] = true;
  cells[size * 2 + 1] = true;
  return cells;
}

/** 照镜子：找出左右翻转后的图案 */
function qMirror(rand: () => number, t: number): ShapeQ {
  const size = t < 0.5 ? 3 : 4;
  const color = COLOR_VALUES[pick(rand, SHAPE_COLORS)];
  const cells = makePattern(rand, size);
  const mirror = mirrorCellsH(cells, size);
  const wrongs = [rotateCells(cells, size, 1), rotateCells(cells, size, 2)];
  const order = shuffled([mirror, ...wrongs], rand);
  return {
    kind: "mirror", answer: `data-cells="${cellsKey(mirror)}"`, steps: 1,
    promptHTML: `${patternSVG(cells, size, 96, color)}<span style="font-size:26px">🪞</span>`,
    ask: "哪个是它照镜子的样子？",
    choices: order.map((c) => patternSVG(c, size, 76, color)),
    correct: order.findIndex((c) => cellsKey(c) === cellsKey(mirror)),
    hints: trio(
      "照镜子考的是左右互换：上下不动，左边的跑到右边去。",
      "原图最左边那一列，在镜子里会变成最右边那一列。",
      "先只盯住最上面那一行，把它左右反过来，再拿去跟三个选项比。"
    ),
  };
}

/** 旋转：顺时针转 90° / 180° / 270° 后是哪个（转几个 90° 就是几步） */
function qRotate(rand: () => number, t: number, steps: 1 | 2 | 3): ShapeQ {
  const size = t < 0.5 ? 3 : 4;
  const color = COLOR_VALUES[pick(rand, SHAPE_COLORS)];
  const cells = makePattern(rand, size);
  const quarters = steps;
  const target = rotateCells(cells, size, quarters);
  const others = [1, 2, 3].filter((q) => q !== quarters).map((q) => rotateCells(cells, size, q));
  const order = shuffled([target, ...others], rand);
  const degree = quarters * 90;
  return {
    kind: "rotate", answer: `data-cells="${cellsKey(target)}"`, steps,
    promptHTML: `${patternSVG(cells, size, 96, color)}<span style="font-size:26px">🔄</span>`,
    ask: `顺时针转 ${degree} 度后是哪个？`,
    choices: order.map((c) => patternSVG(c, size, 76, color)),
    correct: order.findIndex((c) => cellsKey(c) === cellsKey(target)),
    hints: trio(
      "旋转考的是整块一起转，格子之间的相对位置一点都不会变。",
      "每转一个直角，原来的第一行就会变成最后一列；转几个直角就重复几次。",
      "先只转一个直角看看变成什么样，再接着往下转，别想一步到位。"
    ),
  };
}

/** 复合变换（1.2 新增，三步）：先照镜子，再顺时针转一个直角 */
function qTransform(rand: () => number, t: number): ShapeQ {
  const size = t < 0.5 ? 3 : 4;
  const color = COLOR_VALUES[pick(rand, SHAPE_COLORS)];
  const cells = makePattern(rand, size);
  const mirror = mirrorCellsH(cells, size);
  const target = rotateCells(mirror, size, 1);
  const wrongs = [mirror, rotateCells(cells, size, 1)];
  const order = shuffled([target, ...wrongs], rand);
  return {
    kind: "transform", answer: `data-cells="${cellsKey(target)}"`, steps: 3,
    promptHTML: `${patternSVG(cells, size, 96, color)}<span style="font-size:24px">🪞→🔄</span>`,
    ask: "先照镜子再转一个直角是哪个？",
    choices: order.map((c) => patternSVG(c, size, 76, color)),
    correct: order.findIndex((c) => cellsKey(c) === cellsKey(target)),
    hints: trio(
      "这题要连做两件事：先左右翻，再整块转，顺序不能颠倒。",
      "照镜子把左右对调，再把镜子里的样子顺时针转一个直角。",
      "先只做第一步：把原图左右翻过来，脑子里记住这个中间的样子。"
    ),
  };
}

// ---------------------------------------------------------------------------
// 1.1 新机制三：立体图形与展开图
// ---------------------------------------------------------------------------

const SOLID_BODIES: Record<SolidKind, string> = {
  cube: `<polygon points="20,38 60,38 60,78 20,78"/><polygon points="20,38 36,22 76,22 60,38"/><polygon points="60,38 76,22 76,62 60,78"/>`,
  cuboid: `<polygon points="12,42 72,42 72,76 12,76"/><polygon points="12,42 28,26 88,26 72,42"/><polygon points="72,42 88,26 88,60 72,76"/>`,
  triPrism: `<polygon points="24,74 58,74 41,36"/><polygon points="42,60 76,60 59,22"/><line x1="24" y1="74" x2="42" y2="60"/><line x1="58" y1="74" x2="76" y2="60"/><line x1="41" y1="36" x2="59" y2="22"/>`,
  squarePyramid: `<polygon points="20,74 50,86 80,74 50,62"/><polygon points="20,74 50,16 50,86"/><polygon points="80,74 50,16 50,86"/><line x1="50" y1="16" x2="50" y2="62"/>`,
  triPyramid: `<polygon points="22,78 78,78 50,22"/><line x1="22" y1="78" x2="56" y2="62"/><line x1="78" y1="78" x2="56" y2="62"/><line x1="50" y1="22" x2="56" y2="62"/>`,
  cylinder: `<rect x="24" y="28" width="52" height="44"/><ellipse cx="50" cy="72" rx="26" ry="10"/><ellipse cx="50" cy="28" rx="26" ry="10"/>`,
  cone: `<polygon points="24,74 76,74 50,18"/><ellipse cx="50" cy="74" rx="26" ry="10"/>`,
  sphere: `<circle cx="50" cy="50" r="30"/><ellipse cx="50" cy="50" rx="30" ry="11" fill="none"/>`,
};

/** 立体图形的示意图（data-solid 供判定与测试） */
export function solidSVG(kind: SolidKind, size: number): string {
  return `<svg data-solid="${kind}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-label="${SOLID_NAMES[kind]}" fill="#d0ebff" stroke="#1c7ed6" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${SOLID_BODIES[kind]}</svg>`;
}

type SolidAsk = "face" | "edge" | "vertex";
const SOLID_ASK_TEXT: Record<SolidAsk, string> = {
  face: "它有几个面？",
  edge: "它有几条棱？",
  vertex: "它有几个顶点？",
};
const SOLID_ASK_UNIT: Record<SolidAsk, string> = { face: "个", edge: "条", vertex: "个" };

/** 立体图形的面 / 棱 / 顶点数（一步问面，两步问棱或顶点） */
function qSolid(rand: () => number, t: number, steps: 1 | 2): ShapeQ {
  const which: SolidAsk = steps === 1 ? "face" : pick(rand, ["edge", "vertex"] as SolidAsk[]);
  // 棱和顶点只问多面体，避免圆柱圆锥的说法有争议
  const kind = which === "face" ? pick(rand, SOLID_KINDS) : pick(rand, POLYHEDRA);
  const table = which === "face" ? SOLID_FACES : which === "edge" ? SOLID_EDGES : SOLID_VERTICES;
  const value = table[kind];
  const unit = SOLID_ASK_UNIT[which];
  const set = new Set<number>([value]);
  let guard = 0;
  while (set.size < 3 && guard++ < 80) {
    const v = value + randInt(rand, -3, 3);
    if (v >= 0 && v !== value) set.add(v);
  }
  const arr = shuffled([...set], rand);
  void t;
  return {
    kind: "solid", answer: `${value} ${unit}`, steps,
    promptHTML: `${isoSolidSVG(kind, 100)}<div style="font-size:16px;font-weight:900;color:#0b7285">${SOLID_NAMES[kind]}</div>`,
    ask: SOLID_ASK_TEXT[which],
    choices: arr.map((v) => `${v} ${unit}`),
    correct: arr.indexOf(value),
    hints: trio(
      which === "face"
        ? "先看清楚问的是「面」：面是一整块平的皮，不是边也不是角。"
        : which === "edge"
          ? "先看清楚问的是「棱」：棱是两个面交出来的那条线。"
          : "先看清楚问的是「顶点」：顶点是几条棱碰头的那个尖。",
      "按上下、前后、左右分组数，看不见的那一半也要算进去。",
      "先把图上看得见的部分数完，再想想被挡住的那边跟它是不是一样多。"
    ),
  };
}

/**
 * 棱数比顶点数多几（1.2 新增，三步）：查棱数 → 查顶点数 → 相减。
 * 欧拉公式 V − E + F = 2 保证这个差一定等于「面数减 2」，是能自洽验算的。
 */
function qSolidCalc(rand: () => number): ShapeQ {
  const kind = pick(rand, POLYHEDRA);
  const value = SOLID_EDGES[kind] - SOLID_VERTICES[kind];
  const set = new Set<number>([value]);
  let guard = 0;
  while (set.size < 3 && guard++ < 80) {
    const v = value + randInt(rand, -3, 3);
    if (v >= 1 && v !== value) set.add(v);
  }
  let filler = 1;
  while (set.size < 3) set.add(value + filler++);
  const arr = shuffled([...set], rand);
  return {
    kind: "solidcalc", answer: `${value} 条`, steps: 3,
    promptHTML: `${isoSolidSVG(kind, 100)}<div style="font-size:16px;font-weight:900;color:#0b7285">${SOLID_NAMES[kind]}</div>`,
    ask: "棱比顶点多几条？",
    choices: arr.map((v) => `${v} 条`),
    correct: arr.indexOf(value),
    hints: trio(
      "这题要分成三小步：先数棱，再数顶点，最后相减。",
      "棱是两个面交出来的线，顶点是几条棱碰头的尖，用棱数减去顶点数。",
      "先只数棱：按上面一圈、下面一圈、竖着连的那几条分组数，别一口气数完。"
    ),
  };
}

/**
 * 认展开图（文字版）。
 *
 * 1.2 修掉一处真错：正方形本来就是长方形的特例，
 * 所以问「正方体的展开图」时，「6 个长方形，对面两两相同」也说得通——
 * 1.1 挑干扰项只排除「文字与答案相同」的，于是同一道题会冒出两个正确选项。
 * 现在把正方体 ↔ 长方体这一对互斥掉。
 */
const NET_CONFUSABLE: Partial<Record<SolidKind, SolidKind>> = { cube: "cuboid", cuboid: "cube" };

function qNet(rand: () => number): ShapeQ {
  const kind = pick(rand, SOLID_KINDS.filter((k) => k !== "sphere"));
  const answer = SOLID_NETS[kind];
  const banned = NET_CONFUSABLE[kind];
  const others = SOLID_KINDS.filter((k) => SOLID_NETS[k] !== answer && k !== banned).map((k) => SOLID_NETS[k]);
  const picked = new Set<string>();
  let guard = 0;
  while (picked.size < 2 && guard++ < 80) picked.add(pick(rand, others));
  const order = shuffled([answer, ...picked], rand);
  return {
    kind: "net", answer, steps: 1,
    promptHTML: `${isoSolidSVG(kind, 100)}<div style="font-size:16px;font-weight:900;color:#0b7285">${SOLID_NAMES[kind]}</div>`,
    ask: "它的展开图是哪一个？",
    choices: order.map((s) => `<span style="font-size:15px;font-weight:800;line-height:1.5">${s}</span>`),
    correct: order.indexOf(answer),
    hints: trio(
      "先想清楚：展开图是把立体沿着棱剪开、摊平之后的样子。",
      "数一数这个立体有几个面、都是什么形状，展开图上就该有一样多、一样形状的块。",
      "先只数面：上下两个底面是什么形状，侧面又是什么形状，分开来看。"
    ),
  };
}

/**
 * 挑展开图（1.2 新增，两步）：三张六格展开图里挑能折成正方体的那一张。
 * 正确项来自折叠校验器筛过的 11 张，干扰项来自被校验器判否的 24 张，**不可能出错**。
 */
function qNetPick(rand: () => number): ShapeQ {
  const good = cubeNets();
  const bad = nonCubeNets();
  const right = pick(rand, good);
  const wrongs: Array<Set<string>> = [];
  let guard = 0;
  while (wrongs.length < 2 && guard++ < 200) {
    const b = pick(rand, bad);
    const key = [...b].sort().join(" ");
    if (!wrongs.some((w) => [...w].sort().join(" ") === key)) wrongs.push(b);
  }
  const order = shuffled([right, ...wrongs], rand);
  const svgOf = (cells: Set<string>): string => cubeNetSVG(cells, 84);
  const answer = svgOf(right).match(/data-net="[^"]*"/)?.[0] ?? "";
  return {
    kind: "netpick", answer, steps: 2,
    promptHTML: `${isoSolidSVG("cube", 96)}<div style="font-size:15px;font-weight:900;color:#0b7285">正方体</div>`,
    ask: "哪张展开图能折成正方体？",
    choices: order.map(svgOf),
    correct: order.indexOf(right),
    hints: trio(
      "先想清楚：正方体有六个面，展开图必须正好六格，而且折起来六个面各占一次。",
      "找出会成为「相对面」的两格：在展开图里它们中间通常隔着一格，不会挨在一起。",
      "先在心里把中间那一排折成一圈，看看剩下的两格是不是刚好当盖子和底。"
    ),
  };
}

// ---------------------------------------------------------------------------
// 1.1 新机制四：坐标与方位
// ---------------------------------------------------------------------------

interface Placed {
  x: number;
  y: number;
  kind: ShapeKind;
  color: ShapeColor;
}

/** 坐标格（原点在左下角；data-grid 供判定与测试） */
export function coordSVG(n: number, items: readonly Placed[], star?: { x: number; y: number }): string {
  const u = 30;
  const ox = 26;
  const oy = 8;
  const H = oy + n * u;
  let body = gridLines(n, n, u, ox, oy);
  for (let i = 1; i <= n; i++) {
    body += `<text x="${(ox + (i - 0.5) * u).toFixed(1)}" y="${(H + 18).toFixed(1)}" font-size="13" font-weight="800" text-anchor="middle" fill="#5c4a7d">${i}</text>`;
    body += `<text x="${(ox - 8).toFixed(1)}" y="${(H - (i - 0.5) * u + 5).toFixed(1)}" font-size="13" font-weight="800" text-anchor="end" fill="#5c4a7d">${i}</text>`;
  }
  for (const it of items) {
    const cx = ox + (it.x - 1) * u;
    const cy = H - it.y * u;
    body += `<g transform="translate(${cx.toFixed(1)},${cy.toFixed(1)}) scale(${(u / 100).toFixed(3)})">${SHAPE_PATHS[it.kind].replace("/>", ` fill="${COLOR_VALUES[it.color]}" stroke="#495057" stroke-width="4" stroke-linejoin="round"/>`)}</g>`;
  }
  if (star) {
    const cx = ox + (star.x - 1) * u;
    const cy = H - star.y * u;
    body += `<rect x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${u}" height="${u}" fill="none" stroke="#e64980" stroke-width="4"/>`;
  }
  // 1.2 补两个字：数对是「先列后行」，把「列」「行」标出来，孩子不用猜先读哪个
  body += `<text x="${(ox + n * u + 4).toFixed(1)}" y="${(H + 18).toFixed(1)}" font-size="12" font-weight="800" text-anchor="start" fill="#5c4a7d">列</text>`;
  body += `<text x="${(ox - 8).toFixed(1)}" y="${(oy + 10).toFixed(1)}" font-size="12" font-weight="800" text-anchor="end" fill="#5c4a7d">行</text>`;
  const grid = items.map((it) => `${it.x},${it.y},${it.kind}`).join("|");
  return `<svg data-grid="${grid}" data-n="${n}" width="${ox + n * u + 22}" height="${H + 26}" viewBox="0 0 ${ox + n * u + 22} ${H + 26}" aria-label="坐标格，横着是列、竖着是行">${body}</svg>`;
}

/** 坐标题：看坐标说形状，或者说出某个形状的坐标 */
function qCoord(rand: () => number, t: number): ShapeQ {
  const n = t < 0.5 ? 4 : 5;
  const spots = new Set<string>();
  const items: Placed[] = [];
  const kinds = shuffled(SHAPE_KINDS, rand).slice(0, 4);
  let guard = 0;
  while (items.length < 4 && guard++ < 200) {
    const x = randInt(rand, 1, n);
    const y = randInt(rand, 1, n);
    if (spots.has(`${x},${y}`)) continue;
    spots.add(`${x},${y}`);
    items.push({ x, y, kind: kinds[items.length], color: pick(rand, SHAPE_COLORS) });
  }
  const target = items[randInt(rand, 0, items.length - 1)];
  if (rand() < 0.5) {
    // 看坐标找形状
    const names = shuffled(
      [SHAPE_NAMES[target.kind], ...items.filter((i) => i.kind !== target.kind).slice(0, 2).map((i) => SHAPE_NAMES[i.kind])],
      rand
    );
    return {
      kind: "coord", answer: SHAPE_NAMES[target.kind], steps: 1,
      promptHTML: coordSVG(n, items, { x: target.x, y: target.y }),
      ask: `${formatPoint(target.x, target.y)} 上是什么形状？`,
      choices: names,
      correct: names.indexOf(SHAPE_NAMES[target.kind]),
      hints: COORD_HINTS,
    };
  }
  // 找形状说坐标
  const answer = formatPoint(target.x, target.y);
  const set = new Set<string>([answer]);
  guard = 0;
  while (set.size < 3 && guard++ < 80) {
    const x = Math.min(n, Math.max(1, target.x + randInt(rand, -2, 2)));
    const y = Math.min(n, Math.max(1, target.y + randInt(rand, -2, 2)));
    set.add(formatPoint(x, y));
  }
  const arr = shuffled([...set], rand);
  return {
    kind: "coord", answer, steps: 1,
    promptHTML: coordSVG(n, items),
    ask: `${SHAPE_NAMES[target.kind]}在哪个位置？`,
    choices: arr,
    correct: arr.indexOf(answer),
    hints: COORD_HINTS,
  };
}

/** 坐标题的三级提示：一个数字都不提，绝不可能漏答案 */
const COORD_HINTS: HintTrio = trio(
  "先想清楚数对怎么读：括号里先写列、后写行，顺序固定不会变。",
  "从左往右数是第几列，从下往上数是第几行，两个数按这个顺序配成一对。",
  "先只找列：把手指从格子的最左边一列一列往右挪，挪到目标那一列先停下。"
);

/**
 * 先按方位走、再读那个位置上的形状（1.2 新增，两步 / 三步）。
 * 两步：走一段再读；三步：走两段再读。
 */
function qCoordMove(rand: () => number, steps: 2 | 3): ShapeQ {
  const n = 5;
  const spots = new Set<string>();
  const items: Placed[] = [];
  const kinds = shuffled(SHAPE_KINDS, rand).slice(0, 5);
  let guard = 0;
  while (items.length < 5 && guard++ < 300) {
    const x = randInt(rand, 1, n);
    const y = randInt(rand, 1, n);
    if (spots.has(`${x},${y}`)) continue;
    spots.add(`${x},${y}`);
    items.push({ x, y, kind: kinds[items.length], color: pick(rand, SHAPE_COLORS) });
  }
  // 起点和终点：两步题要求同一行或同一列（走一段），三步题要求行列都不同（走两段）
  const pairs: Array<[Placed, Placed]> = [];
  for (const a of items) {
    for (const b of items) {
      if (a === b) continue;
      const straight = a.x === b.x || a.y === b.y;
      if (steps === 2 ? straight : !straight) pairs.push([a, b]);
    }
  }
  // 这一批图形凑不出合适的起终点时，退回同样步数的方位题，绝不降难度
  if (pairs.length === 0) return qPath(rand, steps === 2 ? 0.3 : 0.9, steps);
  const [start, end] = pairs[randInt(rand, 0, pairs.length - 1)];
  const moves: Move[] = [];
  if (end.x !== start.x) moves.push({ dir: end.x > start.x ? "右" : "左", steps: Math.abs(end.x - start.x) });
  if (end.y !== start.y) moves.push({ dir: end.y > start.y ? "上" : "下", steps: Math.abs(end.y - start.y) });
  const names = shuffled(
    [SHAPE_NAMES[end.kind], ...items.filter((i) => i.kind !== end.kind).slice(0, 2).map((i) => SHAPE_NAMES[i.kind])],
    rand
  );
  const moveText = moves.map((m) => `向${m.dir}走 ${m.steps} 格`).join("，");
  return {
    kind: "coordmove", answer: SHAPE_NAMES[end.kind], steps,
    promptHTML: `${coordSVG(n, items, { x: start.x, y: start.y })}
      <div data-start="${start.x},${start.y}" data-moves="${moves
        .map((m) => `${m.dir}${m.steps}`)
        .join("|")}" style="font-size:15px;font-weight:800;color:#2f9e44;line-height:1.5">从 ${formatPoint(
      start.x,
      start.y
    )} 出发：${moveText}</div>`,
    ask: "照着走完，落在什么形状上？",
    choices: names,
    correct: names.indexOf(SHAPE_NAMES[end.kind]),
    hints: trio(
      "这题要先走路、再看图形，两件事分开做才不会乱。",
      "向右列号变大、向左变小；向上行号变大、向下变小，一段一段改。",
      "先只走第一段，把走到的那个位置在心里记成一个新的数对。"
    ),
  };
}

/** 方位题：从起点出发按方位走几段，最后停在哪（走几段就是几步推理） */
function qPath(rand: () => number, t: number, want?: 2 | 3): ShapeQ {
  const n = 6;
  const steps = want ?? (t < 0.4 ? 2 : 3);
  for (let guard = 0; guard < 300; guard++) {
    const start = { x: randInt(rand, 1, n), y: randInt(rand, 1, n) };
    const moves: Move[] = [];
    let cur = { ...start };
    let ok = true;
    for (let i = 0; i < steps; i++) {
      const dir = pick(rand, DIRECTIONS) as Direction;
      const k = randInt(rand, 1, 3);
      const next = movePoint(cur.x, cur.y, [{ dir, steps: k }]);
      if (next.x < 1 || next.x > n || next.y < 1 || next.y > n || (next.x === cur.x && next.y === cur.y)) {
        ok = false;
        break;
      }
      moves.push({ dir, steps: k });
      cur = next;
    }
    if (!ok || (cur.x === start.x && cur.y === start.y)) continue;
    const end = movePoint(start.x, start.y, moves);
    const answer = formatPoint(end.x, end.y);
    const set = new Set<string>([answer]);
    let g2 = 0;
    while (set.size < 3 && g2++ < 80) {
      const x = Math.min(n, Math.max(1, end.x + randInt(rand, -2, 2)));
      const y = Math.min(n, Math.max(1, end.y + randInt(rand, -2, 2)));
      set.add(formatPoint(x, y));
    }
    const arr = shuffled([...set], rand);
    const moveText = moves.map((m) => `向${m.dir}走 ${m.steps} 格`).join("，");
    return {
      kind: "path", answer, steps: steps as 2 | 3,
      promptHTML: `${coordSVG(n, [{ x: start.x, y: start.y, kind: "star", color: "yellow" }], start)}
        <div data-start="${start.x},${start.y}" data-moves="${moves.map((m) => `${m.dir}${m.steps}`).join("|")}" style="font-size:15px;font-weight:800;color:#2f9e44;line-height:1.5">从 ${formatPoint(start.x, start.y)} 出发：${moveText}</div>`,
      ask: "一步步走，最后停在哪？",
      choices: arr,
      correct: arr.indexOf(answer),
      hints: PATH_HINTS,
    };
  }
  // 兜底：一条一定合法的路线
  const answer = formatPoint(3, 3);
  const arr = shuffled([answer, formatPoint(2, 3), formatPoint(3, 2)], rand);
  return {
    kind: "path", answer, steps: steps as 2 | 3,
    promptHTML: `${coordSVG(n, [{ x: 1, y: 1, kind: "star", color: "yellow" }], { x: 1, y: 1 })}
      <div data-start="1,1" data-moves="右2|上2" style="font-size:15px;font-weight:800;color:#2f9e44">从 (1, 1) 出发：向右走 2 格，向上走 2 格</div>`,
    ask: "一步步走，最后停在哪？",
    choices: arr,
    correct: arr.indexOf(answer),
    hints: PATH_HINTS,
  };
}

/** 方位题的三级提示：不出现任何数字，答案里的坐标不可能被漏出去 */
const PATH_HINTS: HintTrio = trio(
  "先想清楚每一段是往哪个方向走，方向弄反了后面全错。",
  "向右列号变大、向左变小；向上行号变大、向下变小，一段一段地改。",
  "先只走第一段，把落脚的位置在心里写成一个新的数对，再接着走下一段。"
);

// ---------------------------------------------------------------------------
// 1.2 新机制：分类归纳
// ---------------------------------------------------------------------------

/** 有确定边数、又能画出精确顶点的形状（分类题只用这些） */
const FOUR_SIDED: ShapeKind[] = ["square", "rectangle", "diamond"];
const OTHER_SIDED: ShapeKind[] = ["triangle", "pentagon"];

/**
 * 分类归纳（1.2 新增）。
 *  两步：三个图形里挑出「和另外两个不是一类」的那个（另外两个边数相同、颜色全同）。
 *  三步：既要边数对、又要颜色跟另外两个都不一样，两个条件都满足才算。
 */
function qClassify(rand: () => number, steps: 2 | 3): ShapeQ {
  const pair = shuffled(FOUR_SIDED, rand).slice(0, 2);
  const odd = pick(rand, OTHER_SIDED);
  if (steps === 2) {
    const color = pick(rand, SHAPE_COLORS);
    const cards: Array<{ kind: ShapeKind; color: ShapeColor }> = [
      { kind: pair[0], color },
      { kind: pair[1], color },
      { kind: odd, color },
    ];
    const order = shuffled(cards, rand);
    const answer = `data-kind="${odd}" data-color="${color}"`;
    return {
      kind: "classify", answer, steps,
      promptHTML: `<span data-classify="sides" style="font-size:30px">🗂️</span>`,
      ask: "哪一个和另外两个不是一类？",
      choices: order.map((c) => exactShapeSVG(c.kind, c.color, 74)),
      correct: order.findIndex((c) => c.kind === odd),
      hints: trio(
        "先找一找这三个图形有什么地方可以拿来比：边数、颜色，还是大小。",
        "颜色都一样的时候，就只剩边数可以比了：把每个图形的边一条一条数出来。",
        "先只数最左边那个图形有几条边，再拿这个数去对另外两个。"
      ),
    };
  }
  const colorA = pick(rand, SHAPE_COLORS);
  const colorB = pick(rand, SHAPE_COLORS.filter((c) => c !== colorA));
  const cards: Array<{ kind: ShapeKind; color: ShapeColor }> = [
    { kind: pair[0], color: colorA }, // 四条边 + 独一份的颜色 → 就是它
    { kind: odd, color: colorB },
    { kind: pair[1], color: colorB },
  ];
  const order = shuffled(cards, rand);
  const answer = `data-kind="${pair[0]}" data-color="${colorA}"`;
  return {
    kind: "classify", answer, steps,
    promptHTML: `<span data-classify="sides+color" style="font-size:30px">🗂️</span>`,
    ask: "哪个是四条边、颜色又不一样？",
    choices: order.map((c) => exactShapeSVG(c.kind, c.color, 74)),
    correct: order.findIndex((c) => c.kind === pair[0] && c.color === colorA),
    hints: trio(
      "这题有两个条件要同时满足，缺一个都不行，得分开来查。",
      "先按边数筛一遍，把不是四条边的划掉；再在剩下的里面比颜色。",
      "先只数边数：三个图形各有几条边，把不满足的那个先排除掉。"
    ),
  };
}

function makeAdvanced(rand: () => number, kind: AdvancedShapeQKind, t: number, want: 1 | 2 | 3): ShapeQ {
  // 步数按题型能力裁剪：撑不到三步的题型就停在它的上限，不硬凑
  const steps = Math.min(want, MAX_STEPS[kind]) as 1 | 2 | 3;
  switch (kind) {
    case "perimeter": return qPerimeter(rand, t, steps);
    case "area": return qArea(rand, t, steps);
    case "symmetry": return qSymmetry(rand);
    case "mirror": return qMirror(rand, t);
    case "rotate": return qRotate(rand, t, steps);
    case "solid": return qSolid(rand, t, steps === 1 ? 1 : 2);
    case "net": return qNet(rand);
    case "coord": return qCoord(rand, t);
    case "classify": return qClassify(rand, steps === 3 ? 3 : 2);
    case "netpick": return qNetPick(rand);
    case "symsum": return qSymSum(rand, steps === 3 ? 3 : 2);
    case "transform": return qTransform(rand, t);
    case "solidcalc": return qSolidCalc(rand);
    case "coordmove": return qCoordMove(rand, steps === 3 ? 3 : 2);
    default: return qPath(rand, t, steps === 1 ? 2 : (steps as 2 | 3));
  }
}

/** 每关题目数：前 99 关 4 → 7 题；第 100–188 关 6 → 10 题（明显更长） */
export function questionCount(level: number): number {
  const ci = chapterOf(CHAPTERS, level);
  const idx = indexInChapter(CHAPTERS, level);
  const t = idx / Math.max(1, CHAPTERS[ci].size - 1);
  if (ci >= LEGACY_CHAPTER_COUNT) return 6 + Math.min(4, Math.floor(t * 4.6));
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
    case 5:
      return t < 0.4
        ? ["shape", "color", "size"]
        : ["shape", "findcolor", "size", "sides", "countshape"];
    // ↓ 1.1 新增章节；1.2 按「前 1/3 单步、中 1/3 两步、后 1/3 三步」重排题型池，
    //   每一段的题型池里只放撑得起那个步数的题型（`MAX_STEPS` 兜底裁剪）
    case 6:
      if (t < 1 / 3) return ["perimeter"];
      if (t < 2 / 3) return ["perimeter", "area"];
      return ["area", "perimeter", "classify"];
    case 7:
      if (t < 1 / 3) return ["symmetry", "mirror"];
      if (t < 2 / 3) return ["symsum", "rotate"];
      return ["transform", "symsum", "rotate"];
    case 8:
      if (t < 1 / 3) return ["solid", "net"];
      if (t < 2 / 3) return ["solid", "netpick"];
      return ["solidcalc", "netpick", "symsum"];
    default:
      if (t < 1 / 3) return ["coord"];
      if (t < 2 / 3) return ["path", "coordmove"];
      return ["path", "coordmove", "classify"];
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
  const steps = stepsForLevel(level);
  const out: ShapeQ[] = [];
  for (let i = 0; i < count; i++) {
    const kind = i < kinds.length ? kinds[i] : pick(rand, kinds);
    out.push(makeOne(rand, kind, t, steps));
  }
  return shuffled(out, rand);
}

const ADVANCED_SET = new Set<ShapeQKind>([
  "perimeter", "area", "symmetry", "mirror", "rotate", "solid", "net", "coord", "path",
  "classify", "netpick", "symsum", "transform", "solidcalc", "coordmove",
]);

function makeOne(rand: () => number, kind: ShapeQKind, t: number, steps: 1 | 2 | 3): ShapeQ {
  // 1.1 新章节走独立的进阶生成器；前 6 章的分支一行都没动
  if (ADVANCED_SET.has(kind)) return makeAdvanced(rand, kind as AdvancedShapeQKind, t, steps);
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

/** 188 关概览（测试用） */
export const LEVELS = Array.from({ length: TOTAL_LEVELS }, (_, i) => ({
  count: questionCount(i),
  kinds: kindPool(i),
}));
