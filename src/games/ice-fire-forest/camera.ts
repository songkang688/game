/**
 * 冰冰火火森林 · 摄像机(纯函数,不碰 DOM)。
 *
 * 两个人各走各的路,迟早会分散。处理办法按优先级排:
 *
 *  1. **整张图放得下就整张图放**(前面几章的小图都是这样,根本不用移动);
 *  2. 放不下就**先拉远**,把两个人都框进来 —— 但拉远有下限 `MIN_SCALE`,
 *     再远格子就小到看不清了;
 *  3. 已经拉到下限还框不住,**不硬拽**:镜头停在两人的中点附近,
 *     跑出画面的那一位在屏幕边缘给一个「另一位在这边」的箭头。
 *
 * 硬拽是最糟的做法 —— 一个人往前走、另一个人就被镜头拖着走,
 * 两边都看不清自己脚下,小孩子会直接放弃。
 */

export const CAMERA = {
  /** 最多能拉远到基准格子的几成 */
  MIN_SCALE: 0.6,
  /** 最多放大到几成(不放大,免得小图被拉糊) */
  MAX_SCALE: 1,
  /** 两个人四周各留几格余量,不让人贴着画面边 */
  MARGIN_CELLS: 1.6,
  /** 镜头平滑跟随的速度(每秒补上剩余差距的几成) */
  FOLLOW_PER_SEC: 6,
  /** 箭头离画面边缘多少像素 */
  ARROW_INSET_PX: 16,
} as const;

export interface CameraInput {
  /** 两人的格坐标(可以是滑行中的小数) */
  iceX: number;
  iceY: number;
  fireX: number;
  fireY: number;
  /** 关卡尺寸(格) */
  gridW: number;
  gridH: number;
  /** 画面尺寸(像素) */
  viewW: number;
  viewH: number;
  /** 缩放 1.0 时一格多少像素 */
  baseCell: number;
}

export interface CameraArrow {
  /** 这个箭头指的是谁 */
  hero: "ice" | "fire";
  /** 单位方向(画面坐标,x 向右、y 向下) */
  dx: number;
  dy: number;
}

export interface CameraOut {
  /** 相对基准格的缩放 */
  scale: number;
  /** 实际的格子边长(像素) */
  cell: number;
  /** 镜头中心(格坐标) */
  cx: number;
  cy: number;
  /** 已经拉到下限还框不住吗 */
  clamped: boolean;
  /** 跑出画面的人,在边缘给的提示箭头 */
  arrows: CameraArrow[];
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 算这一帧的镜头。纯函数:同样的输入永远同样的输出,用例直接喂数字。
 */
export function computeCamera(input: CameraInput): CameraOut {
  const { iceX, iceY, fireX, fireY, gridW, gridH, viewW, viewH, baseCell } = input;
  const base = baseCell > 0 ? baseCell : 1;

  // 要把两个人加余量一起框进来,一格最多能有多大
  const spanX = Math.abs(iceX - fireX) + CAMERA.MARGIN_CELLS * 2 + 1;
  const spanY = Math.abs(iceY - fireY) + CAMERA.MARGIN_CELLS * 2 + 1;
  const fitPair = Math.min(viewW / spanX, viewH / spanY);
  // 整张图放得下的话,格子最大能有多大
  const fitGrid = Math.min(viewW / gridW, viewH / gridH);

  let cell = Math.min(fitPair, base * CAMERA.MAX_SCALE);
  const floor = base * CAMERA.MIN_SCALE;
  // 拉远有下限;但如果整张图在下限之上就放得下,那就直接整张图放,别再往外拉
  const lowest = Math.max(floor, Math.min(fitGrid, base * CAMERA.MAX_SCALE));
  const clampedByFloor = cell < lowest - 1e-9;
  if (clampedByFloor) cell = lowest;

  const scale = cell / base;
  const viewCellsX = viewW / cell;
  const viewCellsY = viewH / cell;

  let cx = (iceX + fireX) / 2 + 0.5;
  let cy = (iceY + fireY) / 2 + 0.5;
  // 画面比图还宽就居中,否则夹在图里面,不让镜头跑到图外面去
  cx = viewCellsX >= gridW ? gridW / 2 : clamp(cx, viewCellsX / 2, gridW - viewCellsX / 2);
  cy = viewCellsY >= gridH ? gridH / 2 : clamp(cy, viewCellsY / 2, gridH - viewCellsY / 2);

  const arrows: CameraArrow[] = [];
  const halfX = viewCellsX / 2;
  const halfY = viewCellsY / 2;
  for (const [hero, hx, hy] of [
    ["ice", iceX, iceY],
    ["fire", fireX, fireY],
  ] as Array<["ice" | "fire", number, number]>) {
    const offX = hx + 0.5 - cx;
    const offY = hy + 0.5 - cy;
    const outX = Math.abs(offX) > halfX - 0.5;
    const outY = Math.abs(offY) > halfY - 0.5;
    if (!outX && !outY) continue;
    const len = Math.hypot(offX, offY) || 1;
    arrows.push({ hero, dx: offX / len, dy: offY / len });
  }

  return { scale, cell, cx, cy, clamped: clampedByFloor, arrows };
}

/**
 * 镜头平滑跟随:每帧把当前值往目标值补一截。
 * 用「按时间的指数逼近」而不是「按帧数的固定比例」,所以 30fps 与 60fps 跟得一样快。
 */
export function followTowards(cur: number, target: number, dtMs: number): number {
  const k = 1 - Math.exp((-CAMERA.FOLLOW_PER_SEC * Math.max(0, dtMs)) / 1000);
  return cur + (target - cur) * k;
}

/** 箭头旁边那句话 */
export function arrowLabel(hero: "ice" | "fire"): string {
  return hero === "ice" ? "凛凛在这边" : "焰焰在这边";
}
