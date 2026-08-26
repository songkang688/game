/**
 * 形状王国 · 展开图与「折叠校验器」（1.2 新增）。
 *
 * 1.1 的 `SOLID_NETS` 只有八句话，没有图，也就无从校验。1.2 把展开图变成真数据，
 * 并且**每一张都要过校验器**才准进题库：
 *
 *  - 正方体：展开图是六连方格，用**三维折叠模拟**判定。沿格子走一步，就把这一格的
 *    局部坐标系绕折痕转 90°；走完六格，看六个法向是不是刚好凑齐立方体的六个面。
 *    这一步能抓住「1×6 长条」这类组合上看着像树、实际折起来两格会撞在一起的错图。
 *  - 三棱柱 / 四棱锥 / 三棱锥：展开图是带精确坐标的多边形集合，用**组合校验**判定：
 *    ①两两不重叠（分离轴定理）②共边构成的折痕图是恰好 F−1 条边的生成树
 *    ③各面边数的多重集与立体一致 ④存在把展开图的面单射到立体的面、且每条折痕
 *    都落在立体真实相邻面对上的映射。
 *  - 圆柱 / 圆锥：没有多边形展开图，改判**长度关系**：圆柱侧面长方形的长 = 底面周长；
 *    圆锥扇形的弧长 = 底面周长。两条都是纯算术，能算就能测。
 *
 * 本文件只做几何判定与静态图形数据，不碰出题随机数，也不引入任何 3D 库
 * （立体一律用等距斜投影画，见 `iso.ts`）。
 */
import {
  cellKey,
  cellSet,
  isConnected,
  normalizeCells,
  parseCellKey,
  sortedCells,
  type CellKey,
  type Pt,
} from "./geometry";
import type { SolidKind } from "./logic";

// ---------------------------------------------------------------------------
// 一、正方体展开图：三维折叠模拟
// ---------------------------------------------------------------------------

type Vec3 = readonly [number, number, number];

function neg(v: Vec3): Vec3 {
  return [-v[0], -v[1], -v[2]];
}

function faceId(n: Vec3): string {
  return `${n[0]},${n[1]},${n[2]}`;
}

/**
 * 这张六连方格能不能折成正方体。
 *
 * 每一格带一个局部坐标系 `(u, v, n)`：`u` 是纸面「向右」折起来之后指向的三维方向，
 * `v` 是纸面「向下」的方向，`n = u × v` 是这一格折成的那个面的外法向。
 * 过一条折痕就绕折痕轴转 90°：
 *   向右 → (u, v, n) 变成 (n, v, −u)；向下 → 变成 (u, n, −v)；向左 / 向上取逆变换。
 * 六格走完，六个法向互不相同才说明六个面各占一次。
 */
export function foldsIntoCube(cells: Iterable<CellKey>): boolean {
  const set = cells instanceof Set ? cells : new Set(cells);
  if (set.size !== 6 || !isConnected(set)) return false;

  const start = sortedCells(set)[0];
  const frames = new Map<CellKey, { u: Vec3; v: Vec3; n: Vec3 }>();
  frames.set(start, { u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] });
  const queue: CellKey[] = [start];

  while (queue.length) {
    const key = queue.shift() as CellKey;
    const { r, c } = parseCellKey(key);
    const f = frames.get(key) as { u: Vec3; v: Vec3; n: Vec3 };
    const steps: Array<[CellKey, { u: Vec3; v: Vec3; n: Vec3 }]> = [
      [cellKey(r, c + 1), { u: f.n, v: f.v, n: neg(f.u) }],
      [cellKey(r, c - 1), { u: neg(f.n), v: f.v, n: f.u }],
      [cellKey(r + 1, c), { u: f.u, v: f.n, n: neg(f.v) }],
      [cellKey(r - 1, c), { u: f.u, v: neg(f.n), n: f.v }],
    ];
    for (const [nk, nf] of steps) {
      if (!set.has(nk) || frames.has(nk)) continue;
      frames.set(nk, nf);
      queue.push(nk);
    }
  }

  if (frames.size !== 6) return false;
  const faces = new Set<string>();
  for (const f of frames.values()) faces.add(faceId(f.n));
  return faces.size === 6;
}

/** 一块多联骨牌的「指纹」：八种摆法里字典序最小的那一个，用来去重 */
export function canonicalPolyomino(cells: Iterable<CellKey>): string {
  let best: string | null = null;
  let cur = normalizeCells(cells);
  for (let flip = 0; flip < 2; flip++) {
    for (let q = 0; q < 4; q++) {
      const key = sortedCells(cur).join(" ");
      if (best === null || key < best) best = key;
      // 顺时针 90°
      const next = new Set<CellKey>();
      for (const k of cur) {
        const { r, c } = parseCellKey(k);
        next.add(cellKey(c, -r));
      }
      cur = normalizeCells(next);
    }
    const mirrored = new Set<CellKey>();
    for (const k of cur) {
      const { r, c } = parseCellKey(k);
      mirrored.add(cellKey(r, -c));
    }
    cur = normalizeCells(mirrored);
  }
  return best as string;
}

/** 全部 n 连方格（自由多联骨牌，旋转与翻转算同一块），按指纹排序，结果确定 */
export function allPolyominoes(n: number): Set<CellKey>[] {
  let frontier: Set<CellKey>[] = [new Set([cellKey(0, 0)])];
  for (let size = 1; size < n; size++) {
    const seen = new Map<string, Set<CellKey>>();
    for (const shape of frontier) {
      for (const key of shape) {
        const { r, c } = parseCellKey(key);
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
          const nk = cellKey(r + dr, c + dc);
          if (shape.has(nk)) continue;
          const grown = normalizeCells(new Set([...shape, nk]));
          const id = canonicalPolyomino(grown);
          if (!seen.has(id)) seen.set(id, grown);
        }
      }
    }
    frontier = [...seen.values()];
  }
  return frontier.sort((a, b) => canonicalPolyomino(a).localeCompare(canonicalPolyomino(b)));
}

let cubeNetCache: { good: Set<CellKey>[]; bad: Set<CellKey>[] } | null = null;

function splitHexominoes(): { good: Set<CellKey>[]; bad: Set<CellKey>[] } {
  if (!cubeNetCache) {
    const all = allPolyominoes(6);
    cubeNetCache = {
      good: all.filter((p) => foldsIntoCube(p)),
      bad: all.filter((p) => !foldsIntoCube(p)),
    };
  }
  return cubeNetCache;
}

/** 真能折成正方体的六连方格（校验器筛出来的，教科书上的 11 张） */
export function cubeNets(): Set<CellKey>[] {
  return splitHexominoes().good;
}

/** 折不成正方体的六连方格（当干扰项用，绝不会混进正确答案） */
export function nonCubeNets(): Set<CellKey>[] {
  return splitHexominoes().bad;
}

// ---------------------------------------------------------------------------
// 二、多边形展开图：不重叠 + 折痕生成树 + 面映射
// ---------------------------------------------------------------------------

export interface NetPolygon {
  /** 顶点（按顺序绕一圈，凸多边形） */
  pts: Pt[];
}

export interface PolyhedronShape {
  /** 立体每个面的边数 */
  faceSides: number[];
  /** 相邻的面对（无向，每条棱一对） */
  adjacency: Array<[number, number]>;
}

/** 有棱有顶点的立体的「面邻接图」：折叠校验靠它判断折痕合不合法 */
export const POLYHEDRON_SHAPES: Record<"cube" | "cuboid" | "triPrism" | "squarePyramid" | "triPyramid", PolyhedronShape> = {
  // 0 上 1 下，2–5 四个侧面绕一圈
  cube: {
    faceSides: [4, 4, 4, 4, 4, 4],
    adjacency: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [3, 4], [4, 5], [5, 2]],
  },
  cuboid: {
    faceSides: [4, 4, 4, 4, 4, 4],
    adjacency: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [3, 4], [4, 5], [5, 2]],
  },
  // 0 1 两个三角形底面，2–4 三个长方形侧面
  triPrism: {
    faceSides: [3, 3, 4, 4, 4],
    adjacency: [[0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [3, 4], [4, 2]],
  },
  // 0 正方形底面，1–4 四个三角形侧面绕一圈
  squarePyramid: {
    faceSides: [4, 3, 3, 3, 3],
    adjacency: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 1]],
  },
  // 四个三角形两两相邻
  triPyramid: {
    faceSides: [3, 3, 3, 3],
    adjacency: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]],
  },
};

export type PolyhedronKind = keyof typeof POLYHEDRON_SHAPES;

const EPS = 1e-6;

function samePt(a: Pt, b: Pt): boolean {
  return Math.abs(a.x - b.x) < 1e-4 && Math.abs(a.y - b.y) < 1e-4;
}

function edgesOf(poly: NetPolygon): Array<[Pt, Pt]> {
  return poly.pts.map((p, i) => [p, poly.pts[(i + 1) % poly.pts.length]] as [Pt, Pt]);
}

function sameEdge(a: [Pt, Pt], b: [Pt, Pt]): boolean {
  return (samePt(a[0], b[0]) && samePt(a[1], b[1])) || (samePt(a[0], b[1]) && samePt(a[1], b[0]));
}

/** 两个凸多边形的内部是不是重叠（分离轴定理；只碰到一条边或一个点不算重叠） */
export function convexOverlap(a: NetPolygon, b: NetPolygon): boolean {
  for (const poly of [a, b]) {
    for (const [p, q] of edgesOf(poly)) {
      const nx = -(q.y - p.y);
      const ny = q.x - p.x;
      const len = Math.hypot(nx, ny);
      if (len < EPS) continue;
      const ux = nx / len;
      const uy = ny / len;
      const proj = (poly2: NetPolygon): [number, number] => {
        const vals = poly2.pts.map((pt) => pt.x * ux + pt.y * uy);
        return [Math.min(...vals), Math.max(...vals)];
      };
      const [aMin, aMax] = proj(a);
      const [bMin, bMax] = proj(b);
      const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
      if (overlap <= 1e-4) return false;
    }
  }
  return true;
}

/** 展开图里两两共边的那些面对（= 折痕） */
export function netHinges(faces: readonly NetPolygon[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      const shared = edgesOf(faces[i]).some((ea) => edgesOf(faces[j]).some((eb) => sameEdge(ea, eb)));
      if (shared) out.push([i, j]);
    }
  }
  return out;
}

function isSpanningTree(n: number, edges: ReadonlyArray<[number, number]>): boolean {
  if (edges.length !== n - 1) return false;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const [a, b] of edges) {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return false;
    parent[ra] = rb;
  }
  return new Set(Array.from({ length: n }, (_, i) => find(i))).size === 1;
}

/** 存在把展开图的面单射到立体的面、且每条折痕都落在真实相邻面对上的映射吗 */
export function hasFaceMapping(
  netSides: readonly number[],
  hinges: ReadonlyArray<[number, number]>,
  shape: PolyhedronShape
): boolean {
  const adj = new Set(shape.adjacency.flatMap(([a, b]) => [`${a},${b}`, `${b},${a}`]));
  const assign = new Array<number>(netSides.length).fill(-1);
  const used = new Array<boolean>(shape.faceSides.length).fill(false);

  const fits = (i: number, f: number): boolean => {
    if (used[f] || shape.faceSides[f] !== netSides[i]) return false;
    for (const [a, b] of hinges) {
      if (a === i && assign[b] >= 0 && !adj.has(`${f},${assign[b]}`)) return false;
      if (b === i && assign[a] >= 0 && !adj.has(`${f},${assign[a]}`)) return false;
    }
    return true;
  };

  const walk = (i: number): boolean => {
    if (i >= netSides.length) return true;
    for (let f = 0; f < shape.faceSides.length; f++) {
      if (!fits(i, f)) continue;
      assign[i] = f;
      used[f] = true;
      if (walk(i + 1)) return true;
      assign[i] = -1;
      used[f] = false;
    }
    return false;
  };

  return walk(0);
}

export interface FoldResult {
  ok: boolean;
  /** 折不成时说明是哪一关没过（写进测试报错里，一眼看出错在哪） */
  reason?: string;
}

/**
 * 通用多边形展开图校验：折得成返回 `{ ok: true }`。
 * 正方体 / 长方体额外再走一遍三维折叠模拟（组合条件挡不住「1×6 长条」那种错图）。
 */
export function checkPolygonNet(faces: readonly NetPolygon[], solid: PolyhedronKind): FoldResult {
  const shape = POLYHEDRON_SHAPES[solid];
  if (faces.length !== shape.faceSides.length) {
    return { ok: false, reason: `面数 ${faces.length} ≠ 立体的 ${shape.faceSides.length}` };
  }
  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      if (convexOverlap(faces[i], faces[j])) return { ok: false, reason: `第 ${i} 面和第 ${j} 面在纸上就重叠了` };
    }
  }
  const hinges = netHinges(faces);
  if (!isSpanningTree(faces.length, hinges)) {
    return { ok: false, reason: `折痕有 ${hinges.length} 条，应当是 ${faces.length - 1} 条且连成一棵树` };
  }
  const netSides = faces.map((f) => f.pts.length);
  const want = [...shape.faceSides].sort().join(",");
  const got = [...netSides].sort().join(",");
  if (want !== got) return { ok: false, reason: `各面边数 [${got}] 对不上立体的 [${want}]` };
  if (!hasFaceMapping(netSides, hinges, shape)) {
    return { ok: false, reason: "折痕连的两个面在立体上并不相邻" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 三、静态展开图数据（全部过了校验器才留下）
// ---------------------------------------------------------------------------

function poly(...pts: Array<[number, number]>): NetPolygon {
  return { pts: pts.map(([x, y]) => ({ x, y })) };
}

/** 三棱柱：三个长方形排一排，中间那个的上下各接一个正三角形 */
export function triPrismNet(a = 30, h = 44): NetPolygon[] {
  const top = a * Math.sqrt(3) / 2;
  const y0 = top;
  const y1 = top + h;
  return [
    poly([0, y0], [a, y0], [a, y1], [0, y1]),
    poly([a, y0], [2 * a, y0], [2 * a, y1], [a, y1]),
    poly([2 * a, y0], [3 * a, y0], [3 * a, y1], [2 * a, y1]),
    poly([a, y0], [2 * a, y0], [1.5 * a, y0 - top]),
    poly([a, y1], [2 * a, y1], [1.5 * a, y1 + top]),
  ];
}

/** 四棱锥：正方形底面，四条边各接一个等腰三角形 */
export function squarePyramidNet(a = 40, h = 32): NetPolygon[] {
  const x0 = h;
  const y0 = h;
  const x1 = x0 + a;
  const y1 = y0 + a;
  return [
    poly([x0, y0], [x1, y0], [x1, y1], [x0, y1]),
    poly([x0, y0], [x1, y0], [(x0 + x1) / 2, y0 - h]),
    poly([x1, y0], [x1, y1], [x1 + h, (y0 + y1) / 2]),
    poly([x0, y1], [x1, y1], [(x0 + x1) / 2, y1 + h]),
    poly([x0, y0], [x0, y1], [x0 - h, (y0 + y1) / 2]),
  ];
}

/** 三棱锥：一个大正三角形切成四个小正三角形 */
export function triPyramidNet(s = 30): NetPolygon[] {
  const H = s * Math.sqrt(3);
  const A: [number, number] = [0, H];
  const B: [number, number] = [2 * s, H];
  const C: [number, number] = [s, 0];
  const mAB: [number, number] = [s, H];
  const mBC: [number, number] = [1.5 * s, H / 2];
  const mCA: [number, number] = [0.5 * s, H / 2];
  return [poly(mAB, mBC, mCA), poly(A, mAB, mCA), poly(mAB, B, mBC), poly(mCA, mBC, C)];
}

/** 六连方格 → 展开图多边形（正方体 / 长方体共用，格子边长 u） */
export function cellsToNet(cells: Iterable<CellKey>, u = 24, uy = u): NetPolygon[] {
  return sortedCells(cells).map((k) => {
    const { r, c } = parseCellKey(k);
    return poly([c * u, r * uy], [(c + 1) * u, r * uy], [(c + 1) * u, (r + 1) * uy], [c * u, (r + 1) * uy]);
  });
}

// ---------------------------------------------------------------------------
// 四、圆柱与圆锥：没有多边形展开图，改判长度关系
// ---------------------------------------------------------------------------

/** 圆柱侧面展开成长方形：长必须等于底面周长，宽等于高 */
export function cylinderNetOk(radius: number, rectLength: number, rectWidth: number, height: number, eps = 1e-6): boolean {
  return Math.abs(rectLength - 2 * Math.PI * radius) < eps && Math.abs(rectWidth - height) < eps;
}

/** 圆锥侧面展开成扇形：扇形圆心角 = 360° × 底面半径 ÷ 母线长 */
export function coneSectorDegrees(radius: number, slant: number): number {
  return (360 * radius) / slant;
}

export function coneNetOk(radius: number, slant: number, sectorDegrees: number, eps = 1e-6): boolean {
  return Math.abs(sectorDegrees - coneSectorDegrees(radius, slant)) < eps;
}

// ---------------------------------------------------------------------------
// 五、渲染：把展开图画成 SVG（高对比描边 + 纹理，不只靠颜色）
// ---------------------------------------------------------------------------

const NET_FILL = "#d0ebff";
const NET_STROKE = "#1864ab";

/** 六连方格展开图的小图（data-net 供判定与测试） */
export function cubeNetSVG(cells: Iterable<CellKey>, px = 84): string {
  const list = sortedCells(cells).map(parseCellKey);
  const maxR = Math.max(...list.map((p) => p.r)) + 1;
  const maxC = Math.max(...list.map((p) => p.c)) + 1;
  const u = Math.floor(px / Math.max(maxR, maxC));
  const w = maxC * u;
  const h = maxR * u;
  const body = list
    .map(
      (p) =>
        `<rect x="${p.c * u}" y="${p.r * u}" width="${u}" height="${u}" fill="${NET_FILL}" stroke="${NET_STROKE}" stroke-width="2.5"/>`
    )
    .join("");
  const key = sortedCells(cells).join(" ");
  return `<svg data-net="${key}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-label="一张六格展开图">${body}</svg>`;
}

/** 多边形展开图的小图 */
export function polygonNetSVG(faces: readonly NetPolygon[], label: string, px = 110): string {
  const xs = faces.flatMap((f) => f.pts.map((p) => p.x));
  const ys = faces.flatMap((f) => f.pts.map((p) => p.y));
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  const scale = px / Math.max(w, h);
  const body = faces
    .map(
      (f) =>
        `<polygon points="${f.pts
          .map((p) => `${((p.x - minX) * scale).toFixed(1)},${((p.y - minY) * scale).toFixed(1)}`)
          .join(" ")}" fill="${NET_FILL}" stroke="${NET_STROKE}" stroke-width="2.5" stroke-linejoin="round"/>`
    )
    .join("");
  return `<svg data-netfaces="${faces.length}" width="${(w * scale).toFixed(0)}" height="${(h * scale).toFixed(
    0
  )}" viewBox="0 0 ${(w * scale).toFixed(1)} ${(h * scale).toFixed(1)}" aria-label="${label}">${body}</svg>`;
}

/** 立体 → 它的多边形展开图（球和圆柱圆锥不在此列） */
export function polygonNetOf(solid: SolidKind): NetPolygon[] | null {
  if (solid === "triPrism") return triPrismNet();
  if (solid === "squarePyramid") return squarePyramidNet();
  if (solid === "triPyramid") return triPyramidNet();
  return null;
}

/** 校验器跑一遍全部静态展开图；返回没过关的清单（正常情况下是空的） */
export function auditStaticNets(): string[] {
  const bad: string[] = [];
  for (const solid of ["triPrism", "squarePyramid", "triPyramid"] as const) {
    const faces = polygonNetOf(solid);
    if (!faces) {
      bad.push(`${solid}: 没有展开图数据`);
      continue;
    }
    const res = checkPolygonNet(faces, solid);
    if (!res.ok) bad.push(`${solid}: ${res.reason}`);
  }
  for (const net of cubeNets()) {
    const res = checkPolygonNet(cellsToNet(net), "cube");
    if (!res.ok) bad.push(`cube ${sortedCells(net).join(" ")}: ${res.reason}`);
  }
  return bad;
}

/** 方便测试直接构造格子集合 */
export { cellSet };
