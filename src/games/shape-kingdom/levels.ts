// 形状王国：188 关 · 十大王国区域题库生成（认形状 → 周长面积/对称旋转/立体展开/坐标方位）
//
// 1.1 起总关数 99 → 188：前 99 关（前 6 章）的章节切分、seed、生成参数逐字未动，
// 新的 4 章共 89 关只在末尾追加，面向约小学六年级，允许多步推理。
import { TOTAL_LEVELS, mulberry32, pick, randInt, shuffled, chapterOf, indexInChapter, type Chapter } from "../level99";
import type { QuizQuestion, QuizTheme } from "../quiz99";
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
  | "path";
export type ShapeQKind = LegacyShapeQKind | AdvancedShapeQKind;

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

/** 周长题：长方形或缺角 L 形 */
function qPerimeter(rand: () => number, t: number): ShapeQ {
  const useL = t > 0.5 && rand() < 0.45;
  const w = randInt(rand, 4, t < 0.5 ? 9 : 14);
  const h = randInt(rand, 2, t < 0.5 ? 7 : 10);
  if (useL) {
    const cutW = randInt(rand, 1, Math.max(1, w - 2));
    const cutH = randInt(rand, 1, Math.max(1, h - 1));
    const value = lShapePerimeter(w, h);
    const { choices, correct, answer } = unitChoices(rand, value, "厘米", [2, 4, cutW * 2, cutH * 2, 6]);
    return {
      kind: "perimeter", answer,
      promptHTML: lFigSVG(w, h, cutW, cutH),
      ask: "沿着边走一圈有多长？",
      choices, correct,
    };
  }
  const value = rectPerimeter(w, h);
  const { choices, correct, answer } = unitChoices(rand, value, "厘米", [2, 4, w, h, 10]);
  return {
    kind: "perimeter", answer,
    promptHTML: rectFigSVG(w, h),
    ask: "这个长方形的周长是多少？",
    choices, correct,
  };
}

/** 面积题：长方形 / 直角三角形 / 缺角 L 形 */
function qArea(rand: () => number, t: number): ShapeQ {
  const form = t < 0.35 ? 0 : randInt(rand, 0, 2);
  if (form === 1) {
    // 直角三角形：保证底 × 高是偶数，面积一定是整数
    let base = randInt(rand, 3, 12);
    let height = randInt(rand, 2, 9);
    if ((base * height) % 2 !== 0) height = height + 1 <= 10 ? height + 1 : height - 1;
    if ((base * height) % 2 !== 0) base = base + 1;
    const value = triangleArea(base, height);
    const { choices, correct, answer } = unitChoices(rand, value, "平方厘米", [base, height, 2, base * height - value]);
    return {
      kind: "area", answer,
      promptHTML: triFigSVG(base, height),
      ask: "这个三角形的面积是多少？",
      choices, correct,
    };
  }
  if (form === 2) {
    const w = randInt(rand, 5, 12);
    const h = randInt(rand, 3, 9);
    const cutW = randInt(rand, 1, w - 2);
    const cutH = randInt(rand, 1, h - 1);
    const value = lShapeArea(w, h, cutW, cutH);
    const { choices, correct, answer } = unitChoices(rand, value, "平方厘米", [cutW * cutH, w, h, 2]);
    return {
      kind: "area", answer,
      promptHTML: lFigSVG(w, h, cutW, cutH),
      ask: "缺了一角，面积还有多少？",
      choices, correct,
    };
  }
  const w = randInt(rand, 3, t < 0.5 ? 9 : 14);
  const h = randInt(rand, 2, t < 0.5 ? 7 : 10);
  const value = rectArea(w, h);
  const { choices, correct, answer } = unitChoices(rand, value, "平方厘米", [w, h, 2, w + h]);
  return {
    kind: "area", answer,
    promptHTML: rectFigSVG(w, h),
    ask: "这个长方形的面积是多少？",
    choices, correct,
  };
}

// ---------------------------------------------------------------------------
// 1.1 新机制二：对称轴、镜像、旋转
// ---------------------------------------------------------------------------

/** 数对称轴 */
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
    kind: "symmetry", answer: `${axes} 条`,
    promptHTML: shapeSVG(shape, color, 100),
    ask: "它有几条对称轴？",
    choices: arr.map((v) => `${v} 条`),
    correct: arr.indexOf(axes),
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

/** 随机一个不对称、旋转后也不重样的图案 */
function makePattern(rand: () => number, size: number): boolean[] {
  for (let guard = 0; guard < 400; guard++) {
    const cells = Array.from({ length: size * size }, () => rand() < 0.42);
    const on = cells.filter(Boolean).length;
    if (on < 3 || on > size * size - 3) continue;
    const keys = new Set([
      cellsKey(cells),
      cellsKey(rotateCells(cells, size, 1)),
      cellsKey(rotateCells(cells, size, 2)),
      cellsKey(rotateCells(cells, size, 3)),
      cellsKey(mirrorCellsH(cells, size)),
    ]);
    if (keys.size === 5) return cells;
  }
  // 兜底：一个必定不对称的小图案
  const cells = new Array<boolean>(size * size).fill(false);
  cells[0] = true;
  cells[1] = true;
  cells[size] = true;
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
    kind: "mirror", answer: `data-cells="${cellsKey(mirror)}"`,
    promptHTML: `${patternSVG(cells, size, 96, color)}<span style="font-size:26px">🪞</span>`,
    ask: "哪个是它照镜子的样子？",
    choices: order.map((c) => patternSVG(c, size, 76, color)),
    correct: order.findIndex((c) => cellsKey(c) === cellsKey(mirror)),
  };
}

/** 旋转：顺时针转 90° / 180° 后是哪个 */
function qRotate(rand: () => number, t: number): ShapeQ {
  const size = t < 0.5 ? 3 : 4;
  const color = COLOR_VALUES[pick(rand, SHAPE_COLORS)];
  const cells = makePattern(rand, size);
  const quarters = t < 0.5 ? 1 : pick(rand, [1, 2, 3]);
  const target = rotateCells(cells, size, quarters);
  const others = [1, 2, 3].filter((q) => q !== quarters).map((q) => rotateCells(cells, size, q));
  const order = shuffled([target, ...others], rand);
  const degree = quarters * 90;
  return {
    kind: "rotate", answer: `data-cells="${cellsKey(target)}"`,
    promptHTML: `${patternSVG(cells, size, 96, color)}<span style="font-size:26px">🔄</span>`,
    ask: `顺时针转 ${degree} 度后是哪个？`,
    choices: order.map((c) => patternSVG(c, size, 76, color)),
    correct: order.findIndex((c) => cellsKey(c) === cellsKey(target)),
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

/** 立体图形的面 / 棱 / 顶点数 */
function qSolid(rand: () => number, t: number): ShapeQ {
  const which: SolidAsk = t < 0.4 ? "face" : pick(rand, ["face", "edge", "vertex"] as SolidAsk[]);
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
  return {
    kind: "solid", answer: `${value} ${unit}`,
    promptHTML: `${solidSVG(kind, 96)}<div style="font-size:16px;font-weight:900;color:#0b7285">${SOLID_NAMES[kind]}</div>`,
    ask: SOLID_ASK_TEXT[which],
    choices: arr.map((v) => `${v} ${unit}`),
    correct: arr.indexOf(value),
  };
}

/** 认展开图 */
function qNet(rand: () => number): ShapeQ {
  const kind = pick(rand, SOLID_KINDS.filter((k) => k !== "sphere"));
  const answer = SOLID_NETS[kind];
  const others = SOLID_KINDS.filter((k) => SOLID_NETS[k] !== answer).map((k) => SOLID_NETS[k]);
  const picked = new Set<string>();
  let guard = 0;
  while (picked.size < 2 && guard++ < 80) picked.add(pick(rand, others));
  const order = shuffled([answer, ...picked], rand);
  return {
    kind: "net", answer,
    promptHTML: `${solidSVG(kind, 96)}<div style="font-size:16px;font-weight:900;color:#0b7285">${SOLID_NAMES[kind]}</div>`,
    ask: "它的展开图是哪一个？",
    choices: order.map((s) => `<span style="font-size:15px;font-weight:800;line-height:1.5">${s}</span>`),
    correct: order.indexOf(answer),
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
  const grid = items.map((it) => `${it.x},${it.y},${it.kind}`).join("|");
  return `<svg data-grid="${grid}" data-n="${n}" width="${ox + n * u + 8}" height="${H + 26}" viewBox="0 0 ${ox + n * u + 8} ${H + 26}" aria-label="坐标格">${body}</svg>`;
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
      kind: "coord", answer: SHAPE_NAMES[target.kind],
      promptHTML: coordSVG(n, items, { x: target.x, y: target.y }),
      ask: `${formatPoint(target.x, target.y)} 上是什么形状？`,
      choices: names,
      correct: names.indexOf(SHAPE_NAMES[target.kind]),
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
    kind: "coord", answer,
    promptHTML: coordSVG(n, items),
    ask: `${SHAPE_NAMES[target.kind]}在哪个位置？`,
    choices: arr,
    correct: arr.indexOf(answer),
  };
}

/** 方位题：从起点出发按方位走几步，最后停在哪 */
function qPath(rand: () => number, t: number): ShapeQ {
  const n = 6;
  const steps = t < 0.4 ? 2 : 3;
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
      kind: "path", answer,
      promptHTML: `${coordSVG(n, [{ x: start.x, y: start.y, kind: "star", color: "yellow" }], start)}
        <div data-start="${start.x},${start.y}" data-moves="${moves.map((m) => `${m.dir}${m.steps}`).join("|")}" style="font-size:15px;font-weight:800;color:#2f9e44;line-height:1.5">从 ${formatPoint(start.x, start.y)} 出发：${moveText}</div>`,
      ask: "一步步走，最后停在哪？",
      choices: arr,
      correct: arr.indexOf(answer),
    };
  }
  // 兜底：一条一定合法的路线
  const answer = formatPoint(3, 3);
  const arr = shuffled([answer, formatPoint(2, 3), formatPoint(3, 2)], rand);
  return {
    kind: "path", answer,
    promptHTML: `${coordSVG(n, [{ x: 1, y: 1, kind: "star", color: "yellow" }], { x: 1, y: 1 })}
      <div data-start="1,1" data-moves="右2|上2" style="font-size:15px;font-weight:800;color:#2f9e44">从 (1, 1) 出发：向右走 2 格，向上走 2 格</div>`,
    ask: "一步步走，最后停在哪？",
    choices: arr,
    correct: arr.indexOf(answer),
  };
}

function makeAdvanced(rand: () => number, kind: AdvancedShapeQKind, t: number): ShapeQ {
  switch (kind) {
    case "perimeter": return qPerimeter(rand, t);
    case "area": return qArea(rand, t);
    case "symmetry": return qSymmetry(rand);
    case "mirror": return qMirror(rand, t);
    case "rotate": return qRotate(rand, t);
    case "solid": return qSolid(rand, t);
    case "net": return qNet(rand);
    case "coord": return qCoord(rand, t);
    default: return qPath(rand, t);
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
    // ↓ 1.1 新增章节
    case 6:
      if (t < 0.35) return ["perimeter"];
      if (t < 0.7) return ["perimeter", "area"];
      return ["area", "perimeter", "area"];
    case 7:
      if (t < 0.35) return ["symmetry"];
      if (t < 0.7) return ["symmetry", "mirror"];
      return ["symmetry", "mirror", "rotate"];
    case 8:
      if (t < 0.4) return ["solid"];
      if (t < 0.7) return ["solid", "net"];
      return ["solid", "net", "symmetry"];
    default:
      if (t < 0.35) return ["coord"];
      if (t < 0.7) return ["coord", "path"];
      return ["coord", "path", "area", "solid"];
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

const ADVANCED_SET = new Set<ShapeQKind>([
  "perimeter", "area", "symmetry", "mirror", "rotate", "solid", "net", "coord", "path",
]);

function makeOne(rand: () => number, kind: ShapeQKind, t: number): ShapeQ {
  // 1.1 新章节走独立的进阶生成器；前 6 章的分支一行都没动
  if (ADVANCED_SET.has(kind)) return makeAdvanced(rand, kind as AdvancedShapeQKind, t);
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
