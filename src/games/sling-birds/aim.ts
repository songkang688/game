/**
 * 弹弹小鸟 —— 瞄准手感的纯函数(1.2 第 12 步 A 档新增)。
 *
 * 两件事:
 * 1. 弹道预测点:8–12 个会衰减的小点,前 60% 精确、后 40% 淡出。
 *    **故意不给完整落点圈**——把「再往前会落到哪」留给孩子自己估,才有学习空间。
 * 2. 触屏拉弓的「拖动锚点偏移」:按下的那一点就是锚点,小鸟不会瞬移到手指下面;
 *    手指与小鸟之间恒定隔开 FINGER_GAP,一年级的小手不会把弹弓整个盖住。
 */
import { MAX_DRAG, SLING_X, SLING_Y, clamp, simulateTrajectory, type WindLike } from "./physics";

/* ------------------------------------------------------------------ */
/* 弹道预测点                                                          */
/* ------------------------------------------------------------------ */

/** 预测点数量的上下限(规格:8–12 个) */
export const PREVIEW_DOTS_MIN = 8;
export const PREVIEW_DOTS_MAX = 12;
/** 前多少比例的点是「精确点」(实心、跟实弹逐点吻合) */
export const PREVIEW_PRECISE_RATIO = 0.6;
/** 采样间隔(秒),与 simulateTrajectory 默认一致 */
export const PREVIEW_STEP = 0.07;
/** 松手阈值:拉不到这么远就当没拉,小鸟放回弹弓 */
export const MIN_DRAG = 13;

export interface PreviewDot {
  x: number;
  y: number;
  /** 透明度:越往后越淡 */
  alpha: number;
  /** 半径:越往后越小 */
  radius: number;
  /** 是否属于前 60% 的精确段 */
  precise: boolean;
}

/**
 * 拉得越满,给的预测点越多(8 → 12):
 * 轻轻一拉只看个方向,拉满了才值得多算几步。
 */
export function previewDotCount(dragLen: number, maxDrag = MAX_DRAG): number {
  const span = Math.max(1e-6, maxDrag - MIN_DRAG);
  const t = clamp((dragLen - MIN_DRAG) / span, 0, 1);
  return PREVIEW_DOTS_MIN + Math.round((PREVIEW_DOTS_MAX - PREVIEW_DOTS_MIN) * t);
}

/** 第 i 个点(共 count 个)的样式:前 60% 精确,后 40% 一路淡出 */
export function previewDotStyle(i: number, count: number): Omit<PreviewDot, "x" | "y"> {
  const n = Math.max(1, count);
  const cut = Math.max(1, Math.round(n * PREVIEW_PRECISE_RATIO));
  if (i < cut) {
    const t = i / Math.max(1, cut);
    return { alpha: 0.92 - t * 0.12, radius: 3.4 - t * 0.5, precise: true };
  }
  const t = (i - cut + 1) / Math.max(1, n - cut);
  return { alpha: Math.max(0.06, 0.8 - t * 0.72), radius: Math.max(1.3, 2.9 - t * 1.6), precise: false };
}

/**
 * 生成预测点。位置直接用 simulateTrajectory(与飞行积分同一套),
 * 所以精确段画在哪儿,实弹就飞到哪儿。
 */
export function previewDots(
  x: number,
  y: number,
  vx: number,
  vy: number,
  gfactor = 1,
  winds: WindLike[] = [],
  count = PREVIEW_DOTS_MAX
): PreviewDot[] {
  const n = clamp(Math.round(count), PREVIEW_DOTS_MIN, PREVIEW_DOTS_MAX);
  const pts = simulateTrajectory(x, y, vx, vy, gfactor, winds, n, PREVIEW_STEP);
  return pts.map((p, i) => ({ x: p.x, y: p.y, ...previewDotStyle(i, pts.length) }));
}

/* ------------------------------------------------------------------ */
/* 触屏拉弓:拖动锚点偏移                                              */
/* ------------------------------------------------------------------ */

/**
 * 手指与小鸟之间至少隔开的世界像素。
 * 画布 540 世界像素宽,360px 手机上大约映射成 336 CSS px(比例 ~0.62),
 * 所以 72 世界像素 ≈ 45 CSS px —— 正好一根手指的宽度,弹弓不会被盖住。
 */
export const FINGER_GAP = 72;

export interface GrabOffset {
  ox: number;
  oy: number;
}

/**
 * 按下时求锚点偏移:小鸟位置 = 手指位置 - 偏移。
 * - 按在离弹弓较远的地方:偏移就是「按下点 - 弹弓」,小鸟原地不动,
 *   之后手指怎么挪,小鸟就跟着挪多少(相对拖动)。
 * - 按在弹弓身上(偏移不足一根手指):把偏移撑到 (0, FINGER_GAP),
 *   小鸟被抬到手指正上方,照样看得见皮筋。
 */
export function grabOffset(
  downX: number,
  downY: number,
  slingX = SLING_X,
  slingY = SLING_Y,
  gap = FINGER_GAP
): GrabOffset {
  const ox = downX - slingX;
  const oy = downY - slingY;
  if (Math.hypot(ox, oy) < gap) return { ox: 0, oy: gap };
  return { ox, oy };
}

/** 当前手指位置换算成拉弓向量(已按 MAX_DRAG 夹住) */
export function dragFromPointer(
  px: number,
  py: number,
  off: GrabOffset,
  slingX = SLING_X,
  slingY = SLING_Y,
  maxDrag = MAX_DRAG
): { dx: number; dy: number } {
  let dx = px - off.ox - slingX;
  let dy = py - off.oy - slingY;
  const d = Math.hypot(dx, dy);
  if (d > maxDrag) {
    dx = (dx / d) * maxDrag;
    dy = (dy / d) * maxDrag;
  }
  return { dx, dy };
}

/** 此刻手指离小鸟有多远(遮挡检查用) */
export function fingerDistance(
  px: number,
  py: number,
  dx: number,
  dy: number,
  slingX = SLING_X,
  slingY = SLING_Y
): number {
  return Math.hypot(px - (slingX + dx), py - (slingY + dy));
}

/* ------------------------------------------------------------------ */
/* 释放手感:皮筋张力与镜头轻微拉伸                                     */
/* ------------------------------------------------------------------ */

/** 皮筋张力形变:拉得越满,皮筋越细、颜色越紧(0..1) */
export function bandTension(dragLen: number, maxDrag = MAX_DRAG): number {
  return clamp(dragLen / Math.max(1e-6, maxDrag), 0, 1);
}

/** 松手后镜头拉伸的持续时间与最大幅度 */
export const RELEASE_STRETCH_TIME = 0.32;
export const RELEASE_STRETCH_MAX = 0.055;

/**
 * 松手瞬间的镜头拉伸系数(1 = 不拉伸)。
 * elapsed 秒后线性回落到 1;reduced-motion 传 scale=0 直接得到 1。
 */
export function releaseStretch(elapsed: number, power = 1, scale = 1): number {
  if (!(elapsed >= 0) || elapsed >= RELEASE_STRETCH_TIME) return 1;
  const t = 1 - elapsed / RELEASE_STRETCH_TIME;
  return 1 + RELEASE_STRETCH_MAX * clamp(power, 0, 1) * clamp(scale, 0, 1) * t * t;
}
