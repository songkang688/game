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
 * 手指与小鸟之间至少隔开的世界像素,同时也是弹弓周围的「手指禁区」半径。
 * 画布 540 世界像素宽,360px 手机上大约映射成 336 CSS px(比例 ~0.62),
 * 58 世界像素 ≈ 36 CSS px —— 一个指尖的接触面,弹弓与小鸟不会被盖住。
 * 取值正好等于 MAX_DRAG:这样「按在弹弓上」被推开之后,小鸟还在拉得到的范围内。
 */
export const FINGER_GAP = MAX_DRAG;

export interface GrabOffset {
  ox: number;
  oy: number;
}

/**
 * 按下时求锚点偏移:小鸟位置 = 手指位置 - 偏移。
 * - 按在离弹弓一个指尖以外的地方:偏移就是「按下点 - 弹弓」,小鸟原地不动,
 *   之后手指怎么挪,小鸟就跟着挪多少(相对拖动,手指想放哪儿放哪儿)。
 * - 按进了弹弓的手指禁区:把锚点沿同方向推到禁区边上,小鸟顺势往反方向拉开一点,
 *   手指与小鸟之间还是隔着一个指尖 —— 弹弓永远露在外面。
 * - 正正好按在弹弓中心(方向都算不出来):默认往右上推,小鸟落在左下,
 *   正是拉弓该去的方向。
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
  const d = Math.hypot(ox, oy);
  if (d >= gap) return { ox, oy };
  if (d < 1e-6) return { ox: gap * 0.6, oy: -gap * 0.8 };
  return { ox: (ox / d) * gap, oy: (oy / d) * gap };
}

/**
 * 当前手指位置换算成拉弓向量。
 *
 * 理想位置就是「手指 - 偏移」,拉不到那么远时要夹回 MAX_DRAG 的圆里。
 * 但直愣愣地往弹弓方向缩会把小鸟拽到手指底下,所以夹的时候优先**转角度**:
 * 在「离手指恰好一个偏移距离」的圆上找还够得着的那个点。
 * 实在找不到就退回缩放,并做一次兜底检查 —— 保证手指与小鸟始终隔着 gap。
 */
export function dragFromPointer(
  px: number,
  py: number,
  off: GrabOffset,
  slingX = SLING_X,
  slingY = SLING_Y,
  maxDrag = MAX_DRAG,
  gap = FINGER_GAP
): { dx: number; dy: number } {
  const tx = px - off.ox - slingX;
  const ty = py - off.oy - slingY;
  const want = Math.hypot(tx, ty);
  if (want <= maxDrag) return { dx: tx, dy: ty };

  const R = Math.hypot(off.ox, off.oy);
  const cx = slingX - px;
  const cy = slingY - py;
  const dist = Math.hypot(cx, cy);

  // 两圆(手指圆 R / 弹弓圆 maxDrag)相交时,取靠近理想方向的那个交点:距离一点不缩水
  if (dist > 1e-6 && dist <= R + maxDrag && Math.abs(R - maxDrag) <= dist) {
    const a = (R * R - maxDrag * maxDrag + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, R * R - a * a));
    const ux = cx / dist;
    const uy = cy / dist;
    const mx = px + ux * a;
    const my = py + uy * a;
    const cands = [
      { x: mx - uy * h, y: my + ux * h },
      { x: mx + uy * h, y: my - ux * h }
    ];
    let best = cands[0];
    let bestD = Infinity;
    for (const c of cands) {
      const d = Math.hypot(c.x - (slingX + tx), c.y - (slingY + ty));
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return { dx: best.x - slingX, dy: best.y - slingY };
  }

  // 退回缩放
  let dx = (tx / want) * maxDrag;
  let dy = (ty / want) * maxDrag;
  if (Math.hypot(px - (slingX + dx), py - (slingY + dy)) < gap) {
    // 兜底:取弹弓够得着的范围里离手指最远的那个点(顺着「手指 → 弹弓」再往外)
    if (dist > 1e-6) {
      dx = (cx / dist) * maxDrag;
      dy = (cy / dist) * maxDrag;
    }
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
