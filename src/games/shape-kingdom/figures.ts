/**
 * 形状王国 · 1.2 的图形渲染（只服务第 100–188 关）。
 *
 * 三件事：
 *  1. **精确形状**：对称轴题不能再用 1.1 那套「看着像正五边形」的路径——
 *     顶点由 `regularPolygonPoints` / `starPoints` 现算，`countSymmetryAxes` 数出来
 *     多少条就是多少条，图和答案永远对得上。
 *  2. **色盲友好**：不同形状同时套不同的 SVG 纹理（斜线 / 反斜线 / 网格 / 点阵 / 实心），
 *     描边一律 ≥ 2px，去掉颜色也分得出谁是谁。
 *  3. **等距斜投影（伪 2.5D）**：立体图形按真三维顶点算，绕竖轴转一个偏航角之后
 *     投到等距网格上，背面剔除 + 三种明度，孩子看得清「哪几个面看得见」。
 *     **不做真 3D、不引入任何 3D 库**，旋转展示走逐帧预渲染。
 *
 * 前 99 关用的 `shapeSVG` 在 `levels.ts` 里原样不动（快照契约），本文件一律新写。
 */
import {
  countSymmetryAxes,
  parseCellKey,
  regularPolygonPoints,
  sortedCells,
  starInnerRadius,
  starPoints,
  type CellKey,
  type Pt,
} from "./geometry";
import { COLOR_NAMES, COLOR_VALUES, SHAPE_NAMES, SOLID_NAMES, type ShapeColor, type ShapeKind, type SolidKind } from "./logic";

// ---------------------------------------------------------------------------
// 纹理：不同形状不同花纹，色觉障碍也分得出来
// ---------------------------------------------------------------------------

export type TextureName = "solid" | "stripe" | "backstripe" | "grid" | "dot";

/** 形状 → 纹理（同一个形状永远同一种花纹，孩子能建立稳定印象） */
export const SHAPE_TEXTURES: Record<ShapeKind, TextureName> = {
  circle: "dot",
  triangle: "stripe",
  square: "grid",
  rectangle: "backstripe",
  star: "solid",
  heart: "dot",
  diamond: "stripe",
  pentagon: "grid",
};

/**
 * 纹理的 `<defs>`。同一份 defs 会跟着每张图重复写一遍，id 也一样——
 * 内容完全相同，浏览器取第一份，渲染结果一致；这样每张图都能独立使用，
 * 不依赖外面有没有挂过一份全局 defs。
 */
export function textureDefs(name: TextureName, stroke: string): string {
  const id = `shk-tex-${name}`;
  if (name === "solid") return "";
  const line = `stroke="${stroke}" stroke-width="2" stroke-linecap="round"`;
  const body =
    name === "stripe"
      ? `<path d="M0,8 l8,-8 M-2,2 l4,-4 M6,10 l4,-4" ${line}/>`
      : name === "backstripe"
        ? `<path d="M0,0 l8,8 M-2,6 l4,4 M6,-2 l4,4" ${line}/>`
        : name === "grid"
          ? `<path d="M0,0 H8 M0,0 V8" ${line}/>`
          : `<circle cx="4" cy="4" r="1.7" fill="${stroke}"/>`;
  return `<defs><pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">${body}</pattern></defs>`;
}

function textureOverlay(name: TextureName, shapeBody: string): string {
  if (name === "solid") return "";
  return shapeBody.replace("/>", ` fill="url(#shk-tex-${name})" stroke="none" opacity="0.55"/>`);
}

// ---------------------------------------------------------------------------
// 精确形状：顶点表现算，对称轴数得出来
// ---------------------------------------------------------------------------

/** 对称题用的精确顶点表（圆和爱心不是多边形，返回 null，条数另有依据） */
export function exactShapePoints(kind: ShapeKind): Pt[] | null {
  switch (kind) {
    case "triangle":
      // 等腰三角形：底 80、腰 85，正好 1 条对称轴
      return [{ x: 50, y: 10 }, { x: 90, y: 85 }, { x: 10, y: 85 }];
    case "square":
      return [{ x: 15, y: 15 }, { x: 85, y: 15 }, { x: 85, y: 85 }, { x: 15, y: 85 }];
    case "rectangle":
      return [{ x: 5, y: 26 }, { x: 95, y: 26 }, { x: 95, y: 74 }, { x: 5, y: 74 }];
    case "diamond":
      // 菱形（不是正方形）：两条对角线不等长，2 条对称轴
      return [{ x: 50, y: 8 }, { x: 88, y: 50 }, { x: 50, y: 92 }, { x: 12, y: 50 }];
    case "pentagon":
      return regularPolygonPoints(5, 50, 54, 44);
    case "star":
      return starPoints(5, 50, 53, 46, starInnerRadius(5, 46));
    default:
      return null;
  }
}

/** 爱心的路径：控制点左右严格镜像，所以恰好 1 条对称轴 */
export const HEART_PATH = "M50,86 C18,60 4,40 15,25 C26,10 44,14 50,28 C56,14 74,10 85,25 C96,40 82,60 50,86 Z";

/** 从精确顶点表数出来的对称轴条数（圆无数条记 −1，爱心按左右镜像记 1） */
export function exactAxisCount(kind: ShapeKind): number {
  if (kind === "circle") return -1;
  if (kind === "heart") return 1;
  const pts = exactShapePoints(kind);
  return pts ? countSymmetryAxes(pts) : 0;
}

function polygonPath(pts: readonly Pt[]): string {
  return `<polygon points="${pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")}"/>`;
}

/**
 * 精确形状的 SVG（高对比描边 + 纹理，`data-kind` / `data-axes` 供判定与测试）。
 * `axisHint` 打开时会把对称轴虚线画出来，用在答对之后的讲解，不在题面上出现。
 */
export function exactShapeSVG(
  kind: ShapeKind,
  color: ShapeColor,
  size: number,
  opts: { axisHint?: boolean } = {}
): string {
  const tex = SHAPE_TEXTURES[kind];
  const stroke = "#343a40";
  const pts = exactShapePoints(kind);
  const shape =
    kind === "circle"
      ? `<circle cx="50" cy="50" r="40"/>`
      : kind === "heart"
        ? `<path d="${HEART_PATH}"/>`
        : polygonPath(pts as Pt[]);
  const filled = shape.replace("/>", ` fill="${COLOR_VALUES[color]}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>`);
  let axes = "";
  if (opts.axisHint && pts) {
    axes = `<line x1="50" y1="0" x2="50" y2="100" stroke="#e64980" stroke-width="2" stroke-dasharray="5 4"/>`;
  }
  return `<svg data-kind="${kind}" data-color="${color}" data-axes="${exactAxisCount(kind)}" data-texture="${tex}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-label="${COLOR_NAMES[color]}${SHAPE_NAMES[kind]}">${textureDefs(
    tex,
    stroke
  )}${filled}${textureOverlay(tex, shape)}${axes}</svg>`;
}

// ---------------------------------------------------------------------------
// 方格纸上的图形：面积 / 周长题的题面直接由格子集合画出来
// ---------------------------------------------------------------------------

/**
 * 由格子集合画方格纸图形（`data-cellkeys` 供判定与测试）。
 * 每个小格 1 厘米，这句话写在图上，孩子不用猜单位。
 */
export function gridFigureSVG(
  cells: Iterable<CellKey>,
  opts: { px?: number; fill?: string; stroke?: string; label?: string; fig?: string } = {}
): string {
  const list = sortedCells(cells);
  const pts = list.map(parseCellKey);
  const rows = Math.max(...pts.map((p) => p.r)) + 1;
  const cols = Math.max(...pts.map((p) => p.c)) + 1;
  const px = opts.px ?? 190;
  const u = Math.max(9, Math.min(20, Math.floor(px / Math.max(rows, cols))));
  const fill = opts.fill ?? "#a5d8ff";
  const stroke = opts.stroke ?? "#1864ab";
  const w = cols * u;
  const h = rows * u;
  const ox = 8;
  const oy = 6;
  let body = "";
  for (const p of pts) {
    body += `<rect x="${ox + p.c * u}" y="${oy + p.r * u}" width="${u}" height="${u}" fill="${fill}" stroke="#ffffff" stroke-width="1"/>`;
  }
  // 只描外轮廓：没有邻居的那一侧才画粗线，孩子一眼看清「一圈」是哪几段
  const set = new Set(list);
  for (const p of pts) {
    const x = ox + p.c * u;
    const y = oy + p.r * u;
    const seg = (x1: number, y1: number, x2: number, y2: number): string =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="3" stroke-linecap="square"/>`;
    if (!set.has(`${p.r - 1},${p.c}`)) body += seg(x, y, x + u, y);
    if (!set.has(`${p.r + 1},${p.c}`)) body += seg(x, y + u, x + u, y + u);
    if (!set.has(`${p.r},${p.c - 1}`)) body += seg(x, y, x, y + u);
    if (!set.has(`${p.r},${p.c + 1}`)) body += seg(x + u, y, x + u, y + u);
  }
  const note = opts.label ?? "每个小格是 1 厘米";
  const W = w + ox * 2;
  const H = h + oy + 22;
  return `<svg data-fig="${opts.fig ?? "cells"}" data-cellkeys="${list.join(
    " "
  )}" data-cols="${cols}" data-rows="${rows}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-label="方格纸上的图形">${body}<text x="${
    W / 2
  }" y="${H - 5}" font-size="12" font-weight="800" text-anchor="middle" fill="#495057">${note}</text></svg>`;
}

// ---------------------------------------------------------------------------
// 等距斜投影（伪 2.5D）：立体图形
// ---------------------------------------------------------------------------

type V3 = [number, number, number];

interface Solid3D {
  verts: V3[];
  /** 每个面的顶点下标，按外法向的右手序 */
  faces: number[][];
}

const SQ3 = Math.sqrt(3) / 2;

function prism(base: Array<[number, number]>, height: number): Solid3D {
  const n = base.length;
  const verts: V3[] = [
    ...base.map(([x, y]) => [x, y, 0] as V3),
    ...base.map(([x, y]) => [x, y, height] as V3),
  ];
  const faces: number[][] = [];
  faces.push(Array.from({ length: n }, (_, i) => n - 1 - i)); // 底面（法向朝下）
  faces.push(Array.from({ length: n }, (_, i) => n + i)); // 顶面
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([i, j, n + j, n + i]);
  }
  return { verts, faces };
}

function pyramid(base: Array<[number, number]>, apex: V3): Solid3D {
  const n = base.length;
  const verts: V3[] = [...base.map(([x, y]) => [x, y, 0] as V3), apex];
  const faces: number[][] = [Array.from({ length: n }, (_, i) => n - 1 - i)];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n]);
  return { verts, faces };
}

const TRI_BASE: Array<[number, number]> = [
  [-0.5, -SQ3 / 1.5],
  [0.5, -SQ3 / 1.5],
  [0, SQ3 / 0.75 - SQ3 / 1.5],
];

/** 立体的三维模型（只做多面体；圆柱圆锥球另走画法） */
export function solidModel(kind: SolidKind): Solid3D | null {
  switch (kind) {
    case "cube":
      return prism([[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], 1);
    case "cuboid":
      return prism([[-0.75, -0.45], [0.75, -0.45], [0.75, 0.45], [-0.75, 0.45]], 0.95);
    case "triPrism":
      return prism(TRI_BASE, 1.1);
    case "squarePyramid":
      return pyramid([[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]], [0, 0, 1.25]);
    case "triPyramid":
      return pyramid(TRI_BASE, [0, 0, 1.2]);
    default:
      return null;
  }
}

function yaw(v: V3, deg: number): V3 {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [v[0] * cos - v[1] * sin, v[0] * sin + v[1] * cos, v[2]];
}

/** 等距投影：x 向右下、y 向左下、z 向上 */
function isoProject(v: V3, scale: number, ox: number, oy: number): Pt {
  return {
    x: ox + (v[0] - v[1]) * Math.cos(Math.PI / 6) * scale,
    y: oy + ((v[0] + v[1]) * Math.sin(Math.PI / 6) - v[2]) * scale,
  };
}

const VIEW: V3 = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];

function faceNormal(a: V3, b: V3, c: V3): V3 {
  const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const w: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
}

const FACE_TONES = ["#e7f5ff", "#a5d8ff", "#74c0fc", "#4dabf7"];

/**
 * 立体图形的等距斜投影图（伪 2.5D）。
 * 背面剔除只画看得见的面，按明度分三档，棱线加深；`data-solid` / `data-yaw` 供测试。
 */
export function isoSolidSVG(kind: SolidKind, size: number, yawDeg = 20): string {
  const label = SOLID_NAMES[kind];
  const model = solidModel(kind);
  const stroke = "#1864ab";
  if (!model) {
    // 圆柱 / 圆锥 / 球：曲面画不出多边形，用椭圆表达「看得见的顶面」
    const body =
      kind === "cylinder"
        ? `<path d="M22,30 L22,70 A28,11 0 0 0 78,70 L78,30 Z" fill="#a5d8ff"/><ellipse cx="50" cy="30" rx="28" ry="11" fill="#e7f5ff"/>`
        : kind === "cone"
          ? `<path d="M50,12 L78,72 A28,11 0 0 1 22,72 Z" fill="#a5d8ff"/><path d="M50,12 L22,72 A28,11 0 0 0 50,83 Z" fill="#74c0fc"/>`
          : `<circle cx="50" cy="50" r="32" fill="#a5d8ff"/><ellipse cx="42" cy="40" rx="12" ry="8" fill="#e7f5ff" opacity="0.8"/>`;
    return `<svg data-solid="${kind}" data-yaw="0" width="${size}" height="${size}" viewBox="0 0 100 100" aria-label="${label}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round">${body}</svg>`;
  }
  const rotated = model.verts.map((v) => yaw(v, yawDeg));
  const scale = size * 0.3;
  const proj = rotated.map((v) => isoProject(v, scale, size / 2, size * 0.56));
  const visible = model.faces
    .map((idx, i) => {
      const n = faceNormal(rotated[idx[0]], rotated[idx[1]], rotated[idx[2]]);
      const dot = n[0] * VIEW[0] + n[1] * VIEW[1] + n[2] * VIEW[2];
      const depth = idx.reduce((s, k) => s + rotated[k][0] + rotated[k][1] + rotated[k][2], 0) / idx.length;
      return { idx, dot, depth, i };
    })
    .filter((f) => f.dot > 1e-6)
    .sort((a, b) => a.depth - b.depth);
  const body = visible
    .map((f, order) => {
      const tone = FACE_TONES[Math.min(FACE_TONES.length - 1, order)];
      const pts = f.idx.map((k) => `${proj[k].x.toFixed(1)},${proj[k].y.toFixed(1)}`).join(" ");
      return `<polygon points="${pts}" fill="${tone}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/>`;
    })
    .join("");
  return `<svg data-solid="${kind}" data-yaw="${yawDeg}" data-faces="${visible.length}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-label="${label}">${body}</svg>`;
}

/** 逐帧预渲染的旋转序列（不做真 3D 动画，只是把若干个偏航角先画好） */
export function isoSolidFrames(kind: SolidKind, size: number, count = 8): string[] {
  return Array.from({ length: Math.max(1, count) }, (_, i) => isoSolidSVG(kind, size, (360 / Math.max(1, count)) * i + 20));
}
