/**
 * 飞行棋乐园 · 棋盘（纯数据 + 纯函数，不碰 DOM）。
 *
 * 建模只用一个数字:每架飞机的「行程 p」。
 *  - `p = BASE(-1)`  停在自己基地里，等一个能起飞的点数;
 *  - `p ∈ [0, 51]`   在 52 格环线上，实际格号 `ring = (13 × 色号 + p) % 52`;
 *  - `p ∈ [52, 57]`  在本色的 6 格终点通道里，只有自己进得来;
 *  - `p = 57`        终点，必须正好到达。
 *
 * 这样写的好处:所有规则(本色格跳、航线飞、终点折返)都只是 p 上的算术，
 * 四种颜色共用一套判断，渲染时才换算成 15 × 15 网格坐标。
 */

/** 环线格数 */
export const RING_LEN = 52;
/** 每色终点通道格数 */
export const HOME_LEN = 6;
/** 相邻两色起飞格的间隔 */
export const ARM = RING_LEN / 4;
/** 终点的行程值:走满 52 格环线再走完 6 格通道 */
export const GOAL = RING_LEN + HOME_LEN - 1;
/** 还停在基地里 */
export const BASE = -1;
/** 停在本色格上再向前跳几格（跳到下一个本色格） */
export const JUMP_STEP = 4;
/** 带虚线航线的本色格（行程值） */
export const AIRLINE_FROM = 16;
/** 航线的另一头，同样是本色格 */
export const AIRLINE_TO = 28;
/** 渲染网格边长 */
export const GRID = 15;
/** 每色飞机数 */
export const PLANES_PER_COLOR = 4;

/** 0 朵朵 / 1 星星 / 2 小花 / 3 小鸟 */
export type Color = 0 | 1 | 2 | 3;

export const COLORS: readonly Color[] = [0, 1, 2, 3];

export interface ColorInfo {
  /** 中文名（界面与播报都用它） */
  name: string;
  /** 棋子造型:卡通纸飞机上坐着谁 */
  token: string;
  /** 主色（粉彩） */
  ink: string;
  /** 浅色底 */
  soft: string;
  /** 基地在棋盘哪个角 */
  corner: string;
}

/** 四位队员:朵朵、星星，加上本作原创的小花与小鸟 */
export const COLOR_INFO: readonly ColorInfo[] = [
  { name: "朵朵", token: "🌸", ink: "#E0679B", soft: "#FFDCEA", corner: "左上" },
  { name: "星星", token: "⭐", ink: "#D79A24", soft: "#FFEFC4", corner: "右上" },
  { name: "小花", token: "🌼", ink: "#3E9C6A", soft: "#D6F5DF", corner: "右下" },
  { name: "小鸟", token: "🐦", ink: "#3D82BE", soft: "#D6ECFB", corner: "左下" }
];

/** 网格坐标（x 列、y 行，都是 0 起） */
export interface XY {
  x: number;
  y: number;
}

function seg(from: XY, to: XY): XY[] {
  const out: XY[] = [];
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  const n = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  for (let i = 0; i <= n; i++) out.push({ x: from.x + dx * i, y: from.y + dy * i });
  return out;
}

/**
 * 52 格环线的网格坐标，顺时针。
 * 十字形棋盘的四个内折角是斜着走一步（传统棋盘就是这么画的），
 * 渲染时那一步照样是一格一格地跳，不会瞬移。
 */
export const RING_XY: readonly XY[] = [
  // 左臂上沿 → 上臂左侧（朵朵起飞格 0 在最左边）
  ...seg({ x: 0, y: 6 }, { x: 5, y: 6 }),
  ...seg({ x: 6, y: 5 }, { x: 6, y: 0 }),
  { x: 7, y: 0 },
  // 上臂右侧 → 右臂上沿（星星起飞格 13）
  ...seg({ x: 8, y: 0 }, { x: 8, y: 5 }),
  ...seg({ x: 9, y: 6 }, { x: 14, y: 6 }),
  { x: 14, y: 7 },
  // 右臂下沿 → 下臂右侧（小花起飞格 26）
  ...seg({ x: 14, y: 8 }, { x: 9, y: 8 }),
  ...seg({ x: 8, y: 9 }, { x: 8, y: 14 }),
  { x: 7, y: 14 },
  // 下臂左侧 → 左臂下沿（小鸟起飞格 39）
  ...seg({ x: 6, y: 14 }, { x: 6, y: 9 }),
  ...seg({ x: 5, y: 8 }, { x: 0, y: 8 }),
  { x: 0, y: 7 }
];

/** 四条终点通道的网格坐标（从环线拐进来，最后一格挨着中央停机坪） */
export const HOME_XY: readonly (readonly XY[])[] = [
  seg({ x: 1, y: 7 }, { x: 6, y: 7 }),
  seg({ x: 7, y: 1 }, { x: 7, y: 6 }),
  seg({ x: 13, y: 7 }, { x: 8, y: 7 }),
  seg({ x: 7, y: 13 }, { x: 7, y: 8 })
];

/** 四角基地的左上角格子 */
const BASE_ORIGIN: readonly XY[] = [
  { x: 0, y: 0 },
  { x: 9, y: 0 },
  { x: 9, y: 9 },
  { x: 0, y: 9 }
];

/** 基地里 4 个停机位在 6 × 6 角落里的偏移 */
const BASE_SLOT: readonly XY[] = [
  { x: 1.5, y: 1.5 },
  { x: 3.5, y: 1.5 },
  { x: 1.5, y: 3.5 },
  { x: 3.5, y: 3.5 }
];

/** 某色的起飞格（环线格号） */
export function startRing(color: Color): number {
  return ARM * color;
}

/** 行程 p 对应的环线格号；不在环线上返回 -1 */
export function ringAt(color: Color, p: number): number {
  if (p < 0 || p >= RING_LEN) return -1;
  return (startRing(color) + p) % RING_LEN;
}

/** 环线格子属于哪一色（每 4 格轮一次，正好每色 13 格） */
export function ringColor(ring: number): Color {
  return (((ring % 4) + 4) % 4) as Color;
}

/** 行程 p 是不是自己的本色格（起飞格也算） */
export function isOwnColorCell(p: number): boolean {
  return p >= 0 && p < RING_LEN && p % JUMP_STEP === 0;
}

/** 本色格能不能再向前跳:跳完还得留在环线上，不许一跳跳进终点通道 */
export function canJumpFrom(p: number): boolean {
  return isOwnColorCell(p) && p + JUMP_STEP < RING_LEN;
}

/** 这一格带不带虚线航线 */
export function isAirline(p: number): boolean {
  return p === AIRLINE_FROM;
}

/** 在终点通道里（含终点） */
export function inHomeLane(p: number): boolean {
  return p >= RING_LEN && p <= GOAL;
}

/** 已经停在终点 */
export function isFinished(p: number): boolean {
  return p === GOAL;
}

/** 还在基地里 */
export function inBase(p: number): boolean {
  return p === BASE;
}

/** 行程 p 是不是安全的（基地与终点通道都撞不到） */
export function isSafe(p: number): boolean {
  return inBase(p) || inHomeLane(p);
}

export interface ColorPath {
  /** ring[p] = 行程 p 的环线格号，长度 52 */
  ring: number[];
  /** 终点通道 6 格的网格坐标 */
  home: XY[];
  /** 起飞格的环线格号 */
  start: number;
  /** 本色格的行程值 */
  ownCells: number[];
  /** 航线两端的行程值 */
  airline: { from: number; to: number };
}

/** 某色从起飞格到终点的完整路线（纯数据，AI 与渲染共用） */
export function pathOf(color: Color): ColorPath {
  const ring: number[] = [];
  for (let p = 0; p < RING_LEN; p++) ring.push(ringAt(color, p));
  const ownCells: number[] = [];
  for (let p = 0; p < RING_LEN; p += JUMP_STEP) ownCells.push(p);
  return {
    ring,
    home: HOME_XY[color].map((c) => ({ ...c })),
    start: startRing(color),
    ownCells,
    airline: { from: AIRLINE_FROM, to: AIRLINE_TO }
  };
}

/** 行程 p 画在网格的哪一格；停在基地的飞机交给 baseXY */
export function cellXY(color: Color, p: number): XY {
  if (inHomeLane(p)) return { ...HOME_XY[color][p - RING_LEN] };
  const ring = ringAt(color, p);
  if (ring < 0) return { x: 7, y: 7 };
  return { ...RING_XY[ring] };
}

/** 基地里第 slot 号停机位的网格坐标（用小数，正好落在 6×6 角落中间） */
export function baseXY(color: Color, slot: number): XY {
  const o = BASE_ORIGIN[color];
  const s = BASE_SLOT[((slot % PLANES_PER_COLOR) + PLANES_PER_COLOR) % PLANES_PER_COLOR];
  return { x: o.x + s.x, y: o.y + s.y };
}

/** 基地 6 × 6 区域（渲染底色用） */
export function baseRect(color: Color): { x: number; y: number; w: number; h: number } {
  const o = BASE_ORIGIN[color];
  return { x: o.x, y: o.y, w: 6, h: 6 };
}

/** 还差多少步到终点（已经到了就是 0） */
export function stepsToGoal(p: number): number {
  if (p === BASE) return GOAL + 1;
  return Math.max(0, GOAL - p);
}

/** 一句话描述某架飞机现在在哪（无障碍标签与播报共用） */
export function describePos(color: Color, p: number): string {
  const who = COLOR_INFO[color].name;
  if (inBase(p)) return `${who}的飞机停在基地`;
  if (isFinished(p)) return `${who}的飞机已经到齐终点`;
  if (inHomeLane(p)) return `${who}的飞机在终点通道第 ${p - RING_LEN + 1} 格`;
  return `${who}的飞机在环线第 ${p + 1} 格`;
}
