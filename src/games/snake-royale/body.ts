/**
 * 长蛇争霸 · 身体与转向的纯数学。
 * 这里只做「一条线怎么变成一串等距节点」和「一帧最多能转多少角度」,
 * 不碰 DOM、不碰随机数,方便逐条单测。
 */

export interface Pt {
  x: number;
  y: number;
}

/** 最短的一条蛇也有这么长,低于它不能再加速 */
export const MIN_LEN = 10;
/** 出生长度 */
export const START_LEN = 16;
/** 半径基数:bodyRadius = R0 + K_B * sqrt(length) */
export const R0 = 5.2;
export const K_B = 0.62;
/** 节点之间的弧长间距(像素) */
export const SPACING = 8.5;
/** 每 1 点长度换多少个节点 */
export const NODES_PER_LEN = 0.85;
/** 画面上最多画这么多节点,再长也不多画,免得低端机掉帧 */
export const MAX_NODES = 220;
/** 每秒最大转向角速度(弧度),挡住「瞬间掉头」 */
export const TURN_RATE = 3.1;
/** 基础前进速度(像素/秒),长度越大略慢一点 */
export const BASE_SPEED = 170;
/** 长度对速度的拖累系数 */
export const SPEED_DRAG = 0.0016;
/** 再慢也不低于这个速度 */
export const MIN_SPEED = 96;

function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

/** 长度 → 身体半径 */
export function lenToRadius(length: number): number {
  const len = Math.max(0, finite(length, 0));
  return R0 + K_B * Math.sqrt(len);
}

/** 长度 → 应该画几个节点 */
export function nodeCount(length: number): number {
  const len = Math.max(0, finite(length, 0));
  return Math.max(3, Math.min(MAX_NODES, Math.round(len * NODES_PER_LEN)));
}

/** 长度 → 前进速度:越长越稳、越长越慢,但不会慢到走不动 */
export function lenToSpeed(length: number): number {
  const len = Math.max(0, finite(length, 0));
  return Math.max(MIN_SPEED, BASE_SPEED / (1 + SPEED_DRAG * len));
}

/** 把角度收进 (-π, π] */
export function normAngle(a: number): number {
  let v = finite(a, 0);
  const tau = Math.PI * 2;
  v = v % tau;
  if (v <= -Math.PI) v += tau;
  if (v > Math.PI) v -= tau;
  return v;
}

/** from 转到 to 的最短带符号夹角 */
export function angleDelta(from: number, to: number): number {
  return normAngle(finite(to, 0) - finite(from, 0));
}

/**
 * 限速转向:一帧最多转 rate * dt,所以永远做不到瞬间掉头。
 */
export function steer(angle: number, target: number, dt: number, rate: number = TURN_RATE): number {
  const cur = normAngle(angle);
  const want = normAngle(target);
  const step = Math.max(0, finite(rate, TURN_RATE)) * Math.max(0, finite(dt, 0));
  const d = angleDelta(cur, want);
  if (Math.abs(d) <= step) return want;
  return normAngle(cur + Math.sign(d) * step);
}

/**
 * 沿着历史轨迹等距取点。
 * path[0] 是头,后面越来越旧;返回的第 i 个节点距离头 (i + 1) * spacing。
 * 轨迹不够长的时候,多出来的节点全部落在轨迹末端(尾巴收拢),不会抛错。
 */
export function sampleBody(path: readonly Pt[], spacing: number, count: number): Pt[] {
  const out: Pt[] = [];
  const n = Math.max(0, Math.round(finite(count, 0)));
  if (path.length === 0 || n === 0) return out;
  const sp = Math.max(1e-6, finite(spacing, SPACING));

  let idx = 0;
  let px = finite(path[0].x, 0);
  let py = finite(path[0].y, 0);

  for (let k = 0; k < n; k++) {
    let left = sp;
    while (left > 0 && idx < path.length - 1) {
      const nx = finite(path[idx + 1].x, px);
      const ny = finite(path[idx + 1].y, py);
      const d = Math.hypot(nx - px, ny - py);
      if (d <= 1e-12) {
        idx += 1;
        px = nx;
        py = ny;
        continue;
      }
      if (d >= left) {
        const t = left / d;
        px += (nx - px) * t;
        py += (ny - py) * t;
        left = 0;
      } else {
        left -= d;
        idx += 1;
        px = nx;
        py = ny;
      }
    }
    out.push({ x: px, y: py });
  }
  return out;
}

/**
 * 把新的头位置压进轨迹,并按长度需要裁掉太旧的点。
 * 返回新数组,不改原数组(纯函数,方便测)。
 */
export function pushPath(path: readonly Pt[], head: Pt, length: number, spacing: number = SPACING): Pt[] {
  const keep = Math.ceil((nodeCount(length) + 3) * (spacing / Math.max(1, spacing))) + 6;
  const maxPoints = Math.max(16, Math.min(1200, Math.round(nodeCount(length) * 2.4 + keep)));
  const next: Pt[] = [{ x: finite(head.x, 0), y: finite(head.y, 0) }, ...path];
  if (next.length > maxPoints) next.length = maxPoints;
  return next;
}

/** 两点距离 */
export function dist(a: Pt, b: Pt): number {
  return Math.hypot(finite(a.x, 0) - finite(b.x, 0), finite(a.y, 0) - finite(b.y, 0));
}

/**
 * 撞到发光围栏不淘汰:把头按回圈内,并沿着墙滑行 + 轻微减速。
 * 返回新的位置、角度与这一帧的速度倍率。
 */
export function wallSlide(
  head: Pt,
  angle: number,
  mapR: number,
  cx = 0,
  cy = 0
): { x: number; y: number; angle: number; slowdown: number; hit: boolean } {
  const r = Math.max(1, finite(mapR, 1));
  const dx = finite(head.x, 0) - cx;
  const dy = finite(head.y, 0) - cy;
  const d = Math.hypot(dx, dy);
  if (d <= r) return { x: finite(head.x, 0), y: finite(head.y, 0), angle: normAngle(angle), slowdown: 1, hit: false };
  const ux = d > 0 ? dx / d : 1;
  const uy = d > 0 ? dy / d : 0;
  // 贴到围栏内侧
  const x = cx + ux * r;
  const y = cy + uy * r;
  // 切线方向:选和当前朝向同侧的那一边,视觉上就是「沿墙滑」
  const tx = -uy;
  const ty = ux;
  const facing = Math.cos(normAngle(angle)) * tx + Math.sin(normAngle(angle)) * ty;
  const sign = facing >= 0 ? 1 : -1;
  const nextAngle = Math.atan2(ty * sign, tx * sign);
  return { x, y, angle: normAngle(nextAngle), slowdown: 0.78, hit: true };
}
