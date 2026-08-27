/**
 * 形状王国 · 作图题（1.2 新增，第 100–188 关里的动手关）。
 *
 * 三类动手题，判定**全部**走纯函数，界面只负责收集孩子摆出来的格子：
 *  ① `rect`   —— 在点阵上拖两个点画长方形，按给定的周长或面积判定；
 *  ② `symfill`—— 图形沿竖直对称轴补全另一半，判定是「格子集合相等」；
 *  ③ `tiling` —— 几块多联骨牌拼满目标轮廓，判定是「并集等于轮廓且互不重叠」。
 *
 * 手感与无障碍：点阵吸附半径 12px、拖动中实时显示周长 / 面积读数；
 * 每个可点的东西热区 ≥ 44px；作图区在 360px 手机上也 ≥ 280×280px；
 * 答对城堡长高一层并 `sfx("win")`，答错只温和提示、不打叉。
 */
import {
  cellKey,
  cellSet,
  normalizeCells,
  parseCellKey,
  pieceOrientations,
  polyominoArea,
  polyominoPerimeter,
  rectCells,
  sameCells,
  sortedCells,
  translateCells,
  type CellKey,
} from "./geometry";
import { mulberry32, pick, randInt, type PlayCtx, type PlayHandle } from "../level99";
import type { QuizTheme } from "../quiz99";
import { HINT_LABELS, safeHints, trio, type HintTrio } from "./hints";

// ---------------------------------------------------------------------------
// 尺寸与吸附（纯函数，360px 下限靠它守住）
// ---------------------------------------------------------------------------

/** 点阵吸附半径（px） */
export const SNAP_RADIUS = 12;
/** 作图区最小边长（px） */
export const MIN_BOARD = 280;
/** 可点元素的最小热区（px） */
export const MIN_HIT = 44;
/** 一行最多几格：再多热区就掉到 44px 以下了 */
export const MAX_DRAW_COLS = 6;
/** 「矮屏」的门槛：这以下作图台要自己收一档并允许在本款壳里滚 */
export const SHORT_SCREEN_PX = 720;

export interface DrawMetrics {
  /** 作图区边长 */
  board: number;
  /** 一格 / 一段点距的像素 */
  unit: number;
  /** 热区边长（视觉上的点可以小，热区不许小） */
  hit: number;
}

/** 按屏宽算作图区尺寸：窄屏也保证 ≥280px，热区 ≥44px */
export function drawMetrics(viewportWidth: number, cols: number, rows: number): DrawMetrics {
  const usable = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth - 40 : 320;
  const board = Math.max(MIN_BOARD, Math.min(360, usable));
  const span = Math.max(1, Math.max(cols, rows));
  const unit = board / span;
  return { board, unit, hit: Math.max(MIN_HIT, unit) };
}

export interface DotBoardMetrics extends DrawMetrics {
  /** 整块板子的宽（含两端各半个热区） */
  width: number;
  /** 整块板子的高 */
  height: number;
}

/**
 * 点阵作图台的尺寸。和 `drawMetrics` 的差别只有一处，但那一处是致命的：
 * 点阵两端各要探出半个热区，所以整块板子是 `unit * cols + hit` 宽。老算法先把
 * 格子撑到可用宽度、再往外加一个热区，板子必然比屏幕宽；`.shk-boardwrap` 是 flex，
 * 板子被压扁之后绝对定位的点还按原像素摆，最右边那一列就掉到板外去了
 * （测试员 W5-B-03：7 列点阵的第 7 列在任何手机宽度上都够不着）。
 * 这里反过来算：先定死「整块板子不许超过可用宽度」，再往回推格距与热区。
 */
export function dotBoardMetrics(viewportWidth: number, cols: number, rows: number): DotBoardMetrics {
  const usable = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth - 40 : 320;
  const board = Math.max(MIN_BOARD, Math.min(360, usable));
  const span = Math.max(1, Math.max(cols, rows));
  // 先试「热区正好等于一格」：这时整块板子刚好是 span + 1 个热区宽
  let unit = board / (span + 1);
  let hit = unit;
  if (unit < MIN_HIT) {
    // 格子挤到 44px 以下了：热区守住 44px 不缩，相邻热区允许重叠，落点精度交给吸附半径
    hit = MIN_HIT;
    unit = (board - hit) / span;
  }
  return { board, unit, hit, width: unit * cols + hit, height: unit * rows + hit };
}

/**
 * 舞台真正看得见的那一段，从 `selfTop` 往下还剩多少像素。
 *
 * `clipperBottoms` 是所有会裁掉内容的祖先的下沿——取最小的那个，因为只要有一层裁，
 * 再往下就看不见了。一层都没有（比如用例里的裸节点）就返回 `Infinity`，表示不用钳。
 */
export function visibleRoomPx(selfTop: number, clipperBottoms: readonly number[]): number {
  if (clipperBottoms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...clipperBottoms) - selfTop;
}

/**
 * 把作图台钳进「舞台看得见的那一段」，钳不下就让它自己滚。
 *
 * 为什么不能只靠 CSS：矮屏那一档写的是 `max-height:100%`，可百分比要有一个**定高**的
 * 父级才算得出来，而壳层这条链上 `.l99-stage` / `.l99-stage-wrap` 全是内容撑出来的
 * auto 高——它们自己先长到 653px，`100%` 于是等于内容自己的高度，永远钳不住，
 * `scrollHeight === clientHeight`，滚动条一次都不会出现。真机实测：360×640 上
 * `.shk-draw` 高 517、舞台只看得见 408，`canScroll` 仍是 0，「✅ 我摆好了」照样点不着。
 * 真正定高的那一层是 `.game-stage`（平台文件，交给窗口1），本款够不着它的 CSS，
 * 但够得着它的**盒子**——量一次下沿，把像素值写成自己的 `max-height` 就成了。
 *
 * 只在真的装不下时才写 `max-height` / `overflow-y`，装得下就把两样都还回去，
 * 免得高屏上凭空多出一个滚动容器（那会把 `.shk-board` 的投影裁掉）。
 * 返回拆监听的函数，`destroy` 时叫一声。
 */
export function fitIntoStage(el: HTMLElement): { relayout: () => void; dispose: () => void } {
  const view = el.ownerDocument?.defaultView ?? null;
  const measurable = typeof el.getBoundingClientRect === "function" && !!view;
  const relayout = (): void => {
    if (!measurable || !view) return;
    // 先把上一次钳出来的值还原，不然量到的是钳完的高度，越量越小
    el.style.maxHeight = "";
    el.style.overflowY = "";
    const bottoms: number[] = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      const oy = view.getComputedStyle(p).overflowY;
      if (oy === "auto" || oy === "scroll" || oy === "hidden") bottoms.push(p.getBoundingClientRect().bottom);
    }
    const room = visibleRoomPx(el.getBoundingClientRect().top, bottoms);
    if (!Number.isFinite(room) || room <= 0) return;
    if (el.scrollHeight <= room + 1) return;
    el.style.maxHeight = `${Math.floor(room)}px`;
    el.style.overflowY = "auto";
  };
  relayout();
  view?.addEventListener("resize", relayout);
  return {
    relayout,
    dispose(): void {
      view?.removeEventListener("resize", relayout);
    },
  };
}

export interface DotHit {
  r: number;
  c: number;
  dist: number;
}

/** 离 (x, y) 最近的那个格点（x 向右、y 向下，都是作图区内的相对像素） */
export function nearestDot(x: number, y: number, unit: number, cols: number, rows: number): DotHit {
  const c = Math.max(0, Math.min(cols, Math.round(x / unit)));
  const r = Math.max(0, Math.min(rows, Math.round(y / unit)));
  return { r, c, dist: Math.hypot(x - c * unit, y - r * unit) };
}

/** 够不够得着吸附（12px 以内才算吸上） */
export function isSnapped(dist: number): boolean {
  return dist <= SNAP_RADIUS;
}

// ---------------------------------------------------------------------------
// 三类作图题：题目结构与判定
// ---------------------------------------------------------------------------

export type DrawKind = "rect" | "symfill" | "tiling";

export interface RectTask {
  kind: "rect";
  cols: number;
  rows: number;
  goal: "area" | "perimeter";
  target: number;
  ask: string;
  hints: HintTrio;
}

export interface SymfillTask {
  kind: "symfill";
  /** 方格纸边长（size × size，竖直对称轴在正中间） */
  size: number;
  given: CellKey[];
  answer: CellKey[];
  ask: string;
  hints: HintTrio;
}

export interface TilingTask {
  kind: "tiling";
  cols: number;
  rows: number;
  target: CellKey[];
  pieces: CellKey[][];
  ask: string;
  hints: HintTrio;
}

export type DrawTask = RectTask | SymfillTask | TilingTask;

/** 长方形的读数：拖动过程中实时显示的那两个数 */
export function rectReadout(w: number, h: number): { area: number; perimeter: number } {
  const cells = rectCells(Math.max(0, w), Math.max(0, h));
  return { area: polyominoArea(cells), perimeter: cells.size === 0 ? 0 : polyominoPerimeter(cells) };
}

/** ①拖点画长方形：宽高都要 ≥1，而且目标那一项要正好对上 */
export function judgeRect(task: RectTask, w: number, h: number): boolean {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) return false;
  if (w > task.cols || h > task.rows) return false;
  const got = rectReadout(w, h);
  return (task.goal === "area" ? got.area : got.perimeter) === task.target;
}

/** 竖直对称轴的镜像：`size` 列里第 c 列照过去是第 size−1−c 列 */
export function mirrorAcrossVertical(cells: Iterable<CellKey>, size: number): Set<CellKey> {
  const out = new Set<CellKey>();
  for (const k of cells) {
    const { r, c } = parseCellKey(k);
    out.add(cellKey(r, size - 1 - c));
  }
  return out;
}

/** ②补全对称的另一半：孩子点亮的格子必须和「给定的一半照镜子」一模一样 */
export function judgeSymfill(task: SymfillTask, picked: Iterable<CellKey>): boolean {
  return sameCells(picked, mirrorAcrossVertical(task.given, task.size));
}

export interface Placement {
  /** 用的是第几块骨牌 */
  piece: number;
  /** 这一块实际占住的格子 */
  cells: CellKey[];
}

/** 把一块骨牌按第 orientation 种摆法放到 (atR, atC) */
export function placePiece(piece: Iterable<CellKey>, orientation: number, atR: number, atC: number): Set<CellKey> {
  const forms = pieceOrientations(piece);
  const form = forms[((orientation % forms.length) + forms.length) % forms.length];
  return translateCells(form, atR, atC);
}

/** ③拼满目标轮廓：每块都用上、互不重叠、并集正好等于轮廓 */
export function judgeTiling(task: TilingTask, placements: readonly Placement[]): boolean {
  if (placements.length !== task.pieces.length) return false;
  const usedPieces = new Set<number>();
  const union = new Set<CellKey>();
  let total = 0;
  for (const p of placements) {
    if (p.piece < 0 || p.piece >= task.pieces.length || usedPieces.has(p.piece)) return false;
    usedPieces.add(p.piece);
    const shape = normalizeCells(p.cells);
    const ok = pieceOrientations(task.pieces[p.piece]).some((form) => sameCells(form, shape));
    if (!ok) return false;
    for (const k of p.cells) {
      if (union.has(k)) return false;
      union.add(k);
    }
    total += p.cells.length;
  }
  if (union.size !== total) return false;
  return sameCells(union, task.target);
}

// ---------------------------------------------------------------------------
// 题目生成（确定性：同一关重玩不换题）
// ---------------------------------------------------------------------------

/** 手工验算过的拼图：目标轮廓一定拼得满 */
const TILING_PUZZLES: Array<{ cols: number; rows: number; pieces: Array<Array<[number, number]>> }> = [
  {
    cols: 3,
    rows: 2,
    pieces: [
      [[0, 0], [1, 0]],
      [[0, 1], [0, 2]],
      [[1, 1], [1, 2]],
    ],
  },
  {
    cols: 3,
    rows: 3,
    pieces: [
      [[0, 0], [0, 1], [1, 0]],
      [[0, 2], [1, 2], [1, 1]],
      [[2, 0], [2, 1], [2, 2]],
    ],
  },
  {
    cols: 4,
    rows: 3,
    pieces: [
      [[0, 0], [1, 0], [2, 0], [2, 1]],
      [[0, 1], [0, 2], [0, 3], [1, 3]],
      [[1, 1], [1, 2], [2, 2], [2, 3]],
    ],
  },
  {
    cols: 4,
    rows: 4,
    pieces: [
      [[0, 0], [0, 1], [0, 2], [1, 1]],
      [[0, 3], [1, 3], [2, 3], [1, 2]],
      [[1, 0], [2, 0], [3, 0], [2, 1]],
      [[2, 2], [3, 1], [3, 2], [3, 3]],
    ],
  },
];

function makeRectTask(rand: () => number, hard: boolean): RectTask {
  const cols = MAX_DRAW_COLS;
  const rows = hard ? 5 : 4;
  const goal: "area" | "perimeter" = rand() < 0.5 ? "area" : "perimeter";
  const w = randInt(rand, 2, cols);
  const h = randInt(rand, 1, rows);
  const got = rectReadout(w, h);
  const target = goal === "area" ? got.area : got.perimeter;
  const ask =
    goal === "area"
      ? `拖两个点，画一个面积是 ${target} 平方厘米的长方形`
      : `拖两个点，画一个周长是 ${target} 厘米的长方形`;
  const hints =
    goal === "area"
      ? trio(
          "这题问的是「铺满要多少个方格」，也就是面积。",
          "长方形面积 = 长 × 宽，两个数相乘。",
          "先想想哪两个数相乘能得到题目要的那个数，从最小的宽开始试。"
        )
      : trio(
          "这题问的是「沿着边走一圈有多长」，也就是周长。",
          "长方形周长 = （长 + 宽）× 2。",
          "先把题目给的周长除以 2，得到的是长加宽，再把它拆成两个数。"
        );
  return { kind: "rect", cols, rows, goal, target, ask, hints };
}

function makeSymfillTask(rand: () => number, hard: boolean): SymfillTask {
  const size = 6;
  const half = size / 2;
  const rows = hard ? 6 : 4;
  const given: CellKey[] = [];
  let guard = 0;
  while (given.length < (hard ? 7 : 5) && guard++ < 200) {
    const r = randInt(rand, 0, rows - 1);
    const c = randInt(rand, 0, half - 1);
    const k = cellKey(r, c);
    if (!given.includes(k)) given.push(k);
  }
  // 保证至少贴着对称轴有一格，孩子一眼看出轴在哪
  const spine = cellKey(randInt(rand, 0, rows - 1), half - 1);
  if (!given.includes(spine)) given.push(spine);
  const sorted = sortedCells(given);
  return {
    kind: "symfill",
    size,
    given: sorted,
    answer: sortedCells(mirrorAcrossVertical(sorted, size)),
    ask: "沿着中间那条线，把另一半补成一样的",
    hints: trio(
      "这题考的是轴对称：对折之后两边要完全重合。",
      "左边第几列的格子，右边就要在「对称轴到它一样远」的那一列。",
      "先看最上面那一行，把它左边有几格、离轴多远数清楚，右边照着摆第一格。"
    ),
  };
}

function makeTilingTask(rand: () => number, hard: boolean): TilingTask {
  const pool = hard ? TILING_PUZZLES.slice(2) : TILING_PUZZLES.slice(0, 2);
  const puzzle = pick(rand, pool);
  const pieces = puzzle.pieces.map((p) => sortedCells(normalizeCells(cellSet(p))));
  const target = sortedCells(cellSet(puzzle.pieces.flat()));
  return {
    kind: "tiling",
    cols: puzzle.cols,
    rows: puzzle.rows,
    target,
    pieces,
    ask: "把这几块拼进灰色的轮廓里，不许留空也不许叠着",
    hints: trio(
      "这题考的是把几块图形拼成一整块，关键是每一格都要恰好被盖住一次。",
      "总格子数 = 每块的格子数加起来，先确认它和轮廓的格子数一样多。",
      "先摆有拐角的那一块：拐角只能塞进轮廓的角上，位置最少，试起来最快。"
    ),
  };
}

/** 一关的作图题（确定性；`round` 用来给错题回顾换一批新题） */
export function buildDrawTasks(level: number, count = 4, round = 0): DrawTask[] {
  const rand = mulberry32(90210 + level * 6151 + round * 977);
  const out: DrawTask[] = [];
  const order: DrawKind[] = ["rect", "symfill", "tiling", "rect", "symfill", "tiling"];
  for (let i = 0; i < Math.max(1, count); i++) {
    const hard = i >= Math.ceil(count / 2);
    out.push(makeDrawTask(rand, order[i % order.length], hard));
  }
  return out;
}

/** 按题型造一道作图题（错题回顾直接点名要哪一类） */
export function makeDrawTask(rand: () => number, kind: DrawKind, hard = false): DrawTask {
  if (kind === "rect") return makeRectTask(rand, hard);
  if (kind === "symfill") return makeSymfillTask(rand, hard);
  return makeTilingTask(rand, hard);
}

/** 这一关是不是作图关：后四章里章内序号 % 5 === 2 的那些 */
export function isDrawLevel(chapterIndex: number, indexInChapter: number, legacyChapters: number): boolean {
  return chapterIndex >= legacyChapters && indexInChapter % 5 === 2;
}

// ---------------------------------------------------------------------------
// 界面：点阵作图台
// ---------------------------------------------------------------------------

export const DRAW_CSS = `
.shk-draw{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:16px;padding:12px;
  user-select:none;-webkit-user-select:none;display:flex;flex-direction:column;gap:8px;min-height:380px;}
.shk-draw-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;}
.shk-badge{background:#ffffffd9;border-radius:999px;padding:5px 12px;font-weight:800;font-size:14px;}
.shk-castle{font-size:20px;letter-spacing:2px;min-height:26px;text-align:center;}
.shk-castle-grow{animation:shkGrow .45s ease;}
@keyframes shkGrow{0%{transform:translateY(6px);opacity:.4}100%{transform:none;opacity:1}}
.shk-ask{text-align:center;font-size:16px;font-weight:800;line-height:1.5;}
.shk-boardwrap{display:flex;justify-content:center;}
.shk-board{position:relative;background:#fff;border-radius:14px;box-shadow:0 3px 10px rgba(120,120,160,.18);
  touch-action:none;flex:none;}
.shk-dot{position:absolute;border:none;background:transparent;padding:0;margin:0;cursor:pointer;
  display:flex;align-items:center;justify-content:center;font-family:inherit;}
.shk-dot::before{content:"";width:10px;height:10px;border-radius:50%;background:#adb5bd;}
.shk-dot-on::before{width:16px;height:16px;background:#e64980;}
.shk-dot-near::before{width:14px;height:14px;background:#f783ac;}
.shk-cell{position:absolute;border:2px solid #ced4da;background:#f8f9fa;border-radius:4px;cursor:pointer;
  padding:0;font-family:inherit;font-size:13px;font-weight:800;color:#495057;}
.shk-cell-given{background:#a5d8ff;border-color:#1864ab;cursor:default;}
.shk-cell-on{background:#ffc9c9;border-color:#e03131;}
.shk-cell-target{background:#e9ecef;border-color:#868e96;}
.shk-cell-p0{background:#ffd8a8;border-color:#e8590c;}
.shk-cell-p1{background:#b2f2bb;border-color:#2f9e44;}
.shk-cell-p2{background:#d0bfff;border-color:#6741d9;}
.shk-cell-p3{background:#99e9f2;border-color:#0b7285;}
.shk-preview{position:absolute;border:3px dashed #e64980;border-radius:4px;pointer-events:none;background:#ffdeeb55;}
.shk-readout{text-align:center;font-size:14px;font-weight:800;min-height:20px;}
/* 图形以下的那一摞（骨牌架 / 读数 / 提示 / 按钮排 / 反馈）合成一块，贴住作图台底边常驻。
   七巧板那一小题在矮屏上就是装不下：轮廓要 ≥280px（再小格子热区就掉到 44px 以下，
   那是换一种点不着），加上骨牌架 + 按钮排怎么摆都超。测试员 W5-B-10 量到的表现是
   「没有任何一个滚动位置能同时够着所有控件」——滚到顶才摆得了第一块，滚到底才交得了卷，
   一道题要来回滚两趟。钉住之后要滚的只剩上面的图形，「摆哪一块」「🔄 转一下」
   「✅ 我摆好了」在任何滚动位置都够得着。
   position:sticky 只在真的滚起来时才起作用，所以这里不按屏高开关：作图台什么时候
   装不下就什么时候钉住，比拿一个高度阈值去猜准。背景色由 JS 按本关主题写成内联样式，
   图形从它底下滚过去不会透出来。热区一个都不动。 */
.shk-dock{display:flex;flex-direction:column;gap:8px;position:sticky;bottom:0;z-index:2;
  box-shadow:0 -8px 12px -10px rgba(60,42,107,.45);}
.shk-tools{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.shk-btn{border:none;border-radius:14px;padding:11px 18px;min-height:44px;font-size:15px;font-weight:900;
  cursor:pointer;font-family:inherit;background:#ffffffe6;color:#5f4a8a;box-shadow:0 3px 0 rgba(120,90,160,.28);}
.shk-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.28);}
.shk-btn-go{background:linear-gradient(180deg,#c84483,#ad3a72);color:#fff;box-shadow:0 4px 0 #8f2c5c;}
.shk-piece{border:none;border-radius:12px;padding:8px;min-width:44px;min-height:44px;cursor:pointer;
  font-family:inherit;font-weight:900;font-size:14px;background:#fff;box-shadow:0 3px 0 rgba(120,120,160,.28);}
.shk-piece-on{outline:3px solid #e64980;}
.shk-piece-used{opacity:.45;}
.shk-msg{text-align:center;min-height:22px;font-size:15px;font-weight:800;line-height:1.5;}
.shk-hint{text-align:center;font-size:14px;font-weight:700;line-height:1.6;background:#ffffffcc;border-radius:12px;
  padding:6px 10px;min-height:0;}
.shk-dot:focus-visible,.shk-cell:focus-visible,.shk-btn:focus-visible,.shk-piece:focus-visible{
  outline:3px solid #3c2a6b;outline-offset:3px;}
@media (max-height:${SHORT_SCREEN_PX}px){
  /* 舞台是定高 + overflow:hidden（平台的 styles.css，交给窗口1），作图台一高就被硬裁，
     裁掉的那一截里正是交卷用的「✅ 我摆好了」——测试员 W5-B-01 在 360×720 上量到它
     低于裁切线 37px、360×640 上低 117px，按不着就交不了卷。
     本款自己能做的两件事：① 竖向逐项收一档；② 收完还高就在本款壳里自己滚。
     按钮热区（.shk-btn 的 min-height:44px）一个都不动。
     下面这行 max-height:100% 今天是空转的：百分比要有定高父级，而壳层这条链上
     .l99-stage / .l99-stage-wrap 都是内容撑出来的 auto 高。真正把它钳住的是
     fitIntoStage() 量出来的像素值（内联样式，优先级更高）；这行留着是等平台
     哪天给舞台链定了高就自动接上，两边不打架。 */
  .shk-draw{min-height:0;max-height:100%;overflow-y:auto;gap:6px;padding:8px;}
  /* 上面那行让**壳**能竖着滚了，可作图板还挂着 touch-action:none，于是手指落在板子上
     一步都划不动——而要够着的正是点阵最后两行（被常驻的 .shk-dock 压在底下）。
     真机逐点复量：360×720 / 360×640 / 320×640 上顶部分别有 7 / 14 / 14 颗点不着，
     从「第 3 行第 4 列的点」起手上划 110px，scrollTop 一律 0 → 0；
     对照实验把同一颗点改成 pan-y，同一次上划当场滚满 30 / 104 / 101px。
     和第 1 轮 music-stars 横向那条、本轮 W5R2-LB-13 竖向那条是同一个坑，修法照抄：
     只在真的滚得起来的这一档里让出**竖**这一个方向，热区一个都不动。
     代价：buildRectBoard 的「按住拖」在这一档里竖着拖会变成滚动。读数行写的是
     「点两个点（或者按住拖）」，点两个点是主路（W5-B-05 专门修通的就是它），
     横着拖照旧能拖；高屏上一个字都没变。 */
  .shk-board{touch-action:pan-y;}
  /* 常驻那一摞在矮屏上把行距再收一档（钉住本身写在上面的通用规则里，不分屏高）。
     热区一个都不动：.shk-btn / .shk-piece 的 44px 在这一档里没被碰过。 */
  .shk-dock{gap:6px;padding-top:4px;}
  .shk-castle{font-size:17px;min-height:20px;}
  .shk-ask{font-size:15px;}
  .shk-readout{min-height:18px;}
  .shk-msg{min-height:18px;}
  .shk-btn{padding:9px 14px;}
  .shk-hint{padding:4px 8px;}
}
@media (prefers-reduced-motion:reduce){.shk-castle-grow{animation:none;}}
`;

export interface DrawRoundOptions {
  stage: HTMLElement;
  ctx: PlayCtx;
  tasks: DrawTask[];
  theme: QuizTheme;
  /** 屏宽（不传就问 globalThis.innerWidth，测试里直接喂） */
  viewportWidth?: number;
  /** 一道题错几次就放过（保底不让孩子卡死） */
  maxTries?: number;
  /** 每道题结束的回调（错题回顾靠它记账） */
  onTaskDone?: (task: DrawTask, correct: boolean) => void;
}

/** 作图关的成绩：一次过 3 星，错得少 2 星，其余 1 星 */
export function drawStars(wrong: number, total: number): 1 | 2 | 3 {
  if (wrong <= 0) return 3;
  return wrong <= Math.max(1, Math.round(total * 0.5)) ? 2 : 1;
}

export const DRAW_WRONG_LINES = [
  "还差一点点，再看看图上的数～",
  "思路是对的，位置再调一调～",
  "别急，一格一格数过去就好～",
];

export function runDrawRound(opts: DrawRoundOptions): PlayHandle {
  const { stage, ctx, theme } = opts;
  const tasks = opts.tasks.slice();
  const maxTries = opts.maxTries ?? 3;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let index = 0;
  let wrong = 0;
  let triesHere = 0;
  let hintLevel = 0;
  let castle = 0;

  const wrap = document.createElement("div");
  wrap.className = "shk-draw";
  wrap.style.background = theme.bg;
  const style = document.createElement("style");
  style.textContent = DRAW_CSS;
  wrap.appendChild(style);

  const top = document.createElement("div");
  top.className = "shk-draw-top";
  const progress = document.createElement("span");
  progress.className = "shk-badge";
  progress.style.color = theme.accent;
  const castleEl = document.createElement("span");
  castleEl.className = "shk-badge";
  castleEl.style.color = theme.accent;
  top.append(progress, castleEl);
  wrap.appendChild(top);

  const castleArt = document.createElement("div");
  castleArt.className = "shk-castle";
  wrap.appendChild(castleArt);

  const askEl = document.createElement("div");
  askEl.className = "shk-ask";
  askEl.style.color = theme.accent;
  wrap.appendChild(askEl);

  const boardWrap = document.createElement("div");
  boardWrap.className = "shk-boardwrap";
  wrap.appendChild(boardWrap);

  // 图形以下的这一摞（骨牌架 / 读数 / 提示 / 按钮 / 反馈）合成一个 dock：
  // 矮屏上它整块贴在作图台底边常驻（见 DRAW_CSS 里 .shk-dock 那一段），
  // 于是「摆哪一块」和「交卷」永远够得着，要滚的只剩上面的图形。顺序一个都没换。
  const dock = document.createElement("div");
  dock.className = "shk-dock";
  dock.style.background = theme.bg;
  wrap.appendChild(dock);

  // 拼图关的骨牌架子固定挂在这里，换题时清空即可（不用 innerHTML / querySelectorAll）
  const rackHost = document.createElement("div");
  rackHost.className = "shk-rack";
  dock.appendChild(rackHost);

  const readout = document.createElement("div");
  readout.className = "shk-readout";
  readout.style.color = theme.accent;
  dock.appendChild(readout);

  const hintEl = document.createElement("div");
  hintEl.className = "shk-hint";
  hintEl.style.color = theme.accent;
  hintEl.hidden = true;
  dock.appendChild(hintEl);

  const tools = document.createElement("div");
  tools.className = "shk-tools";
  const hintBtn = document.createElement("button");
  hintBtn.type = "button";
  hintBtn.className = "shk-btn";
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "shk-btn";
  clearBtn.textContent = "🧹 重来";
  const goBtn = document.createElement("button");
  goBtn.type = "button";
  goBtn.className = "shk-btn shk-btn-go";
  goBtn.textContent = "✅ 我摆好了";
  tools.append(hintBtn, clearBtn, goBtn);
  dock.appendChild(tools);

  const msg = document.createElement("div");
  msg.className = "shk-msg";
  msg.style.color = theme.accent;
  dock.appendChild(msg);

  stage.appendChild(wrap);
  // 进 DOM 之后立刻钳一次：矮屏上作图台比舞台看得见的那一段高，钳完才滚得到交卷键
  const fit = fitIntoStage(wrap);

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function viewport(): number {
    if (typeof opts.viewportWidth === "number") return opts.viewportWidth;
    const w = (globalThis as { innerWidth?: number }).innerWidth;
    return typeof w === "number" && w > 0 ? w : 360;
  }

  // --- 每道题的状态 ---
  let corner: { r: number; c: number } | null = null;
  let rectSel: { w: number; h: number } | null = null;
  let picked = new Set<CellKey>();
  let placements: Placement[] = [];
  let activePiece = 0;
  let activeOrientation = 0;

  function resetState(): void {
    corner = null;
    rectSel = null;
    picked = new Set();
    placements = [];
    activePiece = 0;
    activeOrientation = 0;
  }

  function castleLine(): string {
    return castle === 0 ? "🧱" : "🏰" + "▮".repeat(Math.min(8, castle));
  }

  function paintHeader(): void {
    progress.textContent = `第 ${index + 1} / ${tasks.length} 题`;
    castleEl.textContent = `🏰 城堡 ${castle} 层`;
    castleArt.textContent = castleLine();
  }

  function showHint(): void {
    const task = tasks[index];
    hintLevel = Math.min(3, hintLevel + 1);
    const safe = safeHints(task.hints, String(taskAnswerText(task)));
    hintEl.hidden = false;
    hintEl.textContent = `${HINT_LABELS[hintLevel - 1]}：${safe[hintLevel - 1]}`;
    hintBtn.textContent = hintLevel >= 3 ? "💡 提示（已到底）" : `💡 提示 ${hintLevel + 1}/3`;
    ctx.sfx("tap");
  }

  function taskAnswerText(task: DrawTask): string {
    if (task.kind === "rect") return String(task.target);
    if (task.kind === "symfill") return task.answer.join(" ");
    return task.target.join(" ");
  }

  // --- 三种作图台 ---

  function buildRectBoard(task: RectTask): void {
    const m = dotBoardMetrics(viewport(), task.cols, task.rows);
    const board = document.createElement("div");
    board.className = "shk-board";
    board.style.width = `${m.width.toFixed(0)}px`;
    board.style.height = `${m.height.toFixed(0)}px`;
    const pad = m.hit / 2;
    const preview = document.createElement("div");
    preview.className = "shk-preview";
    preview.hidden = true;
    board.appendChild(preview);

    const dots: HTMLElement[][] = [];
    for (let r = 0; r <= task.rows; r++) {
      dots.push([]);
      for (let c = 0; c <= task.cols; c++) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "shk-dot";
        dot.style.width = `${m.hit.toFixed(0)}px`;
        dot.style.height = `${m.hit.toFixed(0)}px`;
        dot.style.left = `${(pad + c * m.unit - m.hit / 2).toFixed(1)}px`;
        dot.style.top = `${(pad + r * m.unit - m.hit / 2).toFixed(1)}px`;
        dot.setAttribute("aria-label", `第 ${r + 1} 行第 ${c + 1} 列的点`);
        // 只接键盘合成的 click。手指 / 鼠标那条路在 onUp 里已经判过「原地抬起 = 一次点击」，
        // 这里再接一次就会同一下点两回（第一下摆上、第二下立刻撤掉），看起来就是「点了没反应」。
        // 键盘按 Enter / 空格派发的 click 是合成事件，detail 恒为 0，拿这个区分最稳，
        // 不用去维护一个「吞掉下一次 click」的标志位——那种标志位在「松手时不在任何点上」
        // （不会有后续 click）时会漏收，把下一次真的键盘操作也吞掉。
        dot.addEventListener("click", (e) => {
          if ((e as MouseEvent).detail) return;
          tapDot(r, c);
        });
        board.appendChild(dot);
        dots[r].push(dot);
      }
    }

    function paintReadout(): void {
      const w = rectSel?.w ?? 0;
      const h = rectSel?.h ?? 0;
      const got = rectReadout(w, h);
      readout.textContent =
        w > 0 && h > 0
          ? `现在是 ${w} × ${h}：周长 ${got.perimeter} 厘米，面积 ${got.area} 平方厘米`
          : "点两个点（或者按住拖），拉出一个长方形";
    }

    function paint(): void {
      for (let r = 0; r <= task.rows; r++) {
        for (let c = 0; c <= task.cols; c++) {
          dots[r][c].classList.toggle("shk-dot-on", corner !== null && corner.r === r && corner.c === c);
        }
      }
      paintReadout();
    }

    function setRect(a: { r: number; c: number }, b: { r: number; c: number }): void {
      const w = Math.abs(a.c - b.c);
      const h = Math.abs(a.r - b.r);
      rectSel = w > 0 && h > 0 ? { w, h } : null;
      if (rectSel) {
        const left = pad + Math.min(a.c, b.c) * m.unit;
        const top2 = pad + Math.min(a.r, b.r) * m.unit;
        preview.style.left = `${left.toFixed(1)}px`;
        preview.style.top = `${top2.toFixed(1)}px`;
        preview.style.width = `${(w * m.unit).toFixed(1)}px`;
        preview.style.height = `${(h * m.unit).toFixed(1)}px`;
        preview.hidden = false;
      } else {
        preview.hidden = true;
      }
    }

    function tapDot(r: number, c: number): void {
      ctx.sfx("tap");
      if (corner === null) {
        corner = { r, c };
        rectSel = null;
        preview.hidden = true;
      } else {
        setRect(corner, { r, c });
        corner = null;
      }
      paint();
    }

    // 拖动：按下吸附到最近的点，松开时再吸附一次。
    // 「原地抬起」不算拖，算一次点击——读数那行白纸黑字写着「点两个点（或者按住拖）」，
    // 可原来按下就把 corner 顶掉、松开又清成 null，第一下点的那个点永远留不住，
    // 「点两个点」这条路从来没通过（测试员 W5-B-05）。
    let dragFrom: { r: number; c: number } | null = null;
    /** 这一次按下之后，手指有没有真的滑到别的点上去 */
    let movedAway = false;
    const rel = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
      const box = board.getBoundingClientRect();
      return { x: e.clientX - box.left - pad, y: e.clientY - box.top - pad };
    };
    const onDown = (e: PointerEvent): void => {
      const p = rel(e);
      const hit = nearestDot(p.x, p.y, m.unit, task.cols, task.rows);
      if (!isSnapped(hit.dist)) return;
      dragFrom = { r: hit.r, c: hit.c };
      movedAway = false;
      // corner 这时一个字都不能动：万一这是一次「原地点一下」，
      // 上一次点的那个点还得留着跟它凑成矩形。
    };
    const onMove = (e: PointerEvent): void => {
      if (!dragFrom) return;
      const p = rel(e);
      const hit = nearestDot(p.x, p.y, m.unit, task.cols, task.rows);
      if (hit.r !== dragFrom.r || hit.c !== dragFrom.c) movedAway = true;
      if (!movedAway) return;
      // 确认是拖了，这才接管：起点就是按下的那个点，之前挂着的半个点作废
      corner = dragFrom;
      setRect(dragFrom, { r: hit.r, c: hit.c });
      paintReadout();
    };
    const onUp = (e: PointerEvent): void => {
      if (!dragFrom) return;
      const from = dragFrom;
      dragFrom = null;
      if (!movedAway) {
        // 原地抬起：走两点定矩形那条路（第一下摆上、第二下拉出矩形）
        tapDot(from.r, from.c);
        return;
      }
      const p = rel(e);
      const hit = nearestDot(p.x, p.y, m.unit, task.cols, task.rows);
      setRect(from, hit);
      corner = null;
      paint();
    };
    board.addEventListener("pointerdown", onDown as EventListener);
    board.addEventListener("pointermove", onMove as EventListener);
    board.addEventListener("pointerup", onUp as EventListener);

    boardWrap.appendChild(board);
    paint();
  }

  function buildSymfillBoard(task: SymfillTask): void {
    const m = drawMetrics(viewport(), task.size, task.size);
    const board = document.createElement("div");
    board.className = "shk-board";
    board.style.width = `${(m.unit * task.size).toFixed(0)}px`;
    board.style.height = `${(m.unit * task.size).toFixed(0)}px`;
    const given = new Set(task.given);
    const cells = new Map<CellKey, HTMLElement>();
    for (let r = 0; r < task.size; r++) {
      for (let c = 0; c < task.size; c++) {
        const key = cellKey(r, c);
        const el = document.createElement("button");
        el.type = "button";
        el.className = `shk-cell${given.has(key) ? " shk-cell-given" : ""}`;
        el.style.width = `${(m.unit - 3).toFixed(1)}px`;
        el.style.height = `${(m.unit - 3).toFixed(1)}px`;
        el.style.left = `${(c * m.unit).toFixed(1)}px`;
        el.style.top = `${(r * m.unit).toFixed(1)}px`;
        el.setAttribute("aria-label", `第 ${r + 1} 行第 ${c + 1} 列`);
        if (given.has(key)) {
          el.disabled = true;
        } else {
          el.addEventListener("click", () => {
            ctx.sfx("tap");
            if (picked.has(key)) picked.delete(key);
            else picked.add(key);
            el.classList.toggle("shk-cell-on", picked.has(key));
            readout.textContent = `已经补了 ${picked.size} 格`;
          });
        }
        board.appendChild(el);
        cells.set(key, el);
      }
    }
    const axis = document.createElement("div");
    axis.className = "shk-preview";
    axis.style.left = `${(m.unit * (task.size / 2) - 2).toFixed(1)}px`;
    axis.style.top = "0px";
    axis.style.width = "0px";
    axis.style.height = `${(m.unit * task.size).toFixed(0)}px`;
    axis.setAttribute("aria-hidden", "true");
    board.appendChild(axis);
    boardWrap.appendChild(board);
    readout.textContent = "点右边的格子，把另一半补出来";
  }

  function buildTilingBoard(task: TilingTask): void {
    const m = drawMetrics(viewport(), task.cols, task.rows);
    const board = document.createElement("div");
    board.className = "shk-board";
    board.style.width = `${(m.unit * task.cols).toFixed(0)}px`;
    board.style.height = `${(m.unit * task.rows).toFixed(0)}px`;
    const target = new Set(task.target);
    const cells = new Map<CellKey, HTMLElement>();
    for (const key of task.target) {
      const { r, c } = parseCellKey(key);
      const el = document.createElement("button");
      el.type = "button";
      el.className = "shk-cell shk-cell-target";
      el.style.width = `${(m.unit - 3).toFixed(1)}px`;
      el.style.height = `${(m.unit - 3).toFixed(1)}px`;
      el.style.left = `${(c * m.unit).toFixed(1)}px`;
      el.style.top = `${(r * m.unit).toFixed(1)}px`;
      el.setAttribute("aria-label", `轮廓里第 ${r + 1} 行第 ${c + 1} 列`);
      el.addEventListener("click", () => tryPlace(r, c));
      board.appendChild(el);
      cells.set(key, el);
    }
    boardWrap.appendChild(board);

    const rack = document.createElement("div");
    rack.className = "shk-tools shk-rack-row";
    const pieceBtns: HTMLElement[] = [];
    task.pieces.forEach((p, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shk-piece";
      btn.textContent = `第 ${i + 1} 块 · ${p.length} 格`;
      btn.setAttribute("aria-label", `选第 ${i + 1} 块，一共 ${p.length} 格`);
      btn.addEventListener("click", () => {
        ctx.sfx("tap");
        activePiece = i;
        activeOrientation = 0;
        paintRack();
      });
      rack.appendChild(btn);
      pieceBtns.push(btn);
    });
    const rotBtn = document.createElement("button");
    rotBtn.type = "button";
    rotBtn.className = "shk-piece";
    rotBtn.textContent = "🔄 转一下";
    rotBtn.addEventListener("click", () => {
      ctx.sfx("tap");
      activeOrientation++;
      paintRack();
    });
    rack.appendChild(rotBtn);
    rackHost.appendChild(rack);

    function paintRack(): void {
      const used = new Set(placements.map((p) => p.piece));
      pieceBtns.forEach((b, i) => {
        b.classList.toggle("shk-piece-on", i === activePiece);
        b.classList.toggle("shk-piece-used", used.has(i));
      });
      const forms = pieceOrientations(task.pieces[activePiece]);
      readout.textContent = `选中第 ${activePiece + 1} 块（第 ${
        (activeOrientation % forms.length) + 1
      } / ${forms.length} 种摆法），点轮廓里的格子放下去`;
    }

    function paintBoard(): void {
      cells.forEach((el) => {
        el.className = "shk-cell shk-cell-target";
      });
      placements.forEach((p) => {
        for (const key of p.cells) {
          const el = cells.get(key);
          if (el) el.className = `shk-cell shk-cell-p${p.piece % 4}`;
        }
      });
    }

    function tryPlace(r: number, c: number): void {
      ctx.sfx("tap");
      const used = new Set(placements.map((p) => p.piece));
      if (used.has(activePiece)) {
        // 再点一次同一块就是把它收回来
        placements = placements.filter((p) => p.piece !== activePiece);
        paintBoard();
        paintRack();
        return;
      }
      const shape = placePiece(task.pieces[activePiece], activeOrientation, 0, 0);
      const anchor = sortedCells(shape)[0];
      const a = parseCellKey(anchor);
      const cellsHere = sortedCells(translateCells(shape, r - a.r, c - a.c));
      const occupied = new Set(placements.flatMap((p) => p.cells));
      const fits = cellsHere.every((k) => target.has(k) && !occupied.has(k));
      if (!fits) {
        msg.textContent = "这一块放不进去，换个位置或者转一下～";
        return;
      }
      msg.textContent = "";
      placements.push({ piece: activePiece, cells: cellsHere });
      const next = task.pieces.findIndex((_, i) => !placements.some((p) => p.piece === i));
      if (next >= 0) activePiece = next;
      activeOrientation = 0;
      paintBoard();
      paintRack();
    }

    paintRack();
  }

  function judgeCurrent(): boolean {
    const task = tasks[index];
    if (task.kind === "rect") return rectSel !== null && judgeRect(task, rectSel.w, rectSel.h);
    if (task.kind === "symfill") return judgeSymfill(task, picked);
    return judgeTiling(task, placements);
  }

  function show(): void {
    const task = tasks[index];
    resetState();
    hintLevel = 0;
    triesHere = 0;
    hintEl.hidden = true;
    hintEl.textContent = "";
    hintBtn.textContent = "💡 提示 1/3";
    msg.textContent = "";
    askEl.textContent = task.ask;
    while (boardWrap.firstChild) boardWrap.removeChild(boardWrap.firstChild);
    while (rackHost.firstChild) rackHost.removeChild(rackHost.firstChild);
    if (task.kind === "rect") buildRectBoard(task);
    else if (task.kind === "symfill") buildSymfillBoard(task);
    else buildTilingBoard(task);
    paintHeader();
    // 换一道题内容就换一批，高度跟着变，钳位重算一次
    fit.relayout();
  }

  function finish(): void {
    const stars = drawStars(wrong, tasks.length);
    ctx.win(stars, wrong === 0 ? "全部一次摆对，城堡封顶啦！" : `${tasks.length} 道作图题全部完成！`);
  }

  function next(): void {
    index++;
    if (index >= tasks.length) {
      later(finish, 350);
      return;
    }
    show();
  }

  goBtn.addEventListener("click", () => {
    if (destroyed || index >= tasks.length) return;
    const task = tasks[index];
    const ok = judgeCurrent();
    if (ok) {
      castle++;
      castleArt.className = "shk-castle shk-castle-grow";
      ctx.sfx("win");
      msg.textContent = "摆对啦！城堡长高一层～";
      paintHeader();
      opts.onTaskDone?.(task, true);
      later(next, 700);
      return;
    }
    triesHere++;
    wrong++;
    ctx.sfx("oops");
    msg.textContent = DRAW_WRONG_LINES[Math.min(DRAW_WRONG_LINES.length - 1, triesHere - 1)];
    if (triesHere >= maxTries) {
      // 试到上限就先带着走，别把孩子卡在一道题上
      msg.textContent = "这道先放一放，我们接着玩下一道～";
      opts.onTaskDone?.(task, false);
      later(next, 800);
    } else if (hintLevel < 3) {
      showHint();
    }
  });

  clearBtn.addEventListener("click", () => {
    ctx.sfx("tap");
    show();
  });

  hintBtn.addEventListener("click", () => {
    if (hintLevel >= 3) return;
    showHint();
  });

  show();

  return {
    destroy() {
      destroyed = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      fit.dispose();
      wrap.remove();
    },
  };
}
