// 糖果秋千 —— 简易 Verlet 绳链物理，纯逻辑不碰 DOM，方便单元测试。

export interface Particle {
  x: number;
  y: number;
  /** 上一帧位置（Verlet 用位置差表示速度） */
  px: number;
  py: number;
  /** 钉住的粒子不受力（绳子锚点） */
  pinned: boolean;
  /** 逆质量：1=普通绳结，糖果更重用较小值 */
  invMass: number;
}

export interface Link {
  a: number;
  b: number;
  rest: number;
  /** 被剪断后置 false，两头各自继续模拟 */
  active: boolean;
}

export function makeParticle(
  x: number,
  y: number,
  pinned = false,
  invMass = 1
): Particle {
  return { x, y, px: x, py: y, pinned, invMass };
}

/** Verlet 积分一步：位置差即速度，再叠加重力。 */
export function integrate(
  ps: Particle[],
  gx: number,
  gy: number,
  dt: number,
  damping = 0.998
): void {
  for (const p of ps) {
    if (p.pinned) continue;
    const vx = (p.x - p.px) * damping;
    const vy = (p.y - p.py) * damping;
    p.px = p.x;
    p.py = p.y;
    p.x += vx + gx * dt * dt;
    p.y += vy + gy * dt * dt;
  }
}

/** 迭代求解距离约束，让绳段保持长度；按逆质量分配修正量。 */
export function solveLinks(
  ps: Particle[],
  links: Link[],
  iterations: number
): void {
  for (let it = 0; it < iterations; it++) {
    for (const link of links) {
      if (!link.active) continue;
      const pa = ps[link.a];
      const pb = ps[link.b];
      let dx = pb.x - pa.x;
      let dy = pb.y - pa.y;
      let dist = Math.hypot(dx, dy);
      if (dist < 1e-6) {
        dx = 0.01;
        dy = 0;
        dist = 0.01;
      }
      const diff = (dist - link.rest) / dist;
      const wa = pa.pinned ? 0 : pa.invMass;
      const wb = pb.pinned ? 0 : pb.invMass;
      const wSum = wa + wb;
      if (wSum === 0) continue;
      const cx = dx * diff;
      const cy = dy * diff;
      pa.x += cx * (wa / wSum);
      pa.y += cy * (wa / wSum);
      pb.x -= cx * (wb / wSum);
      pb.y -= cy * (wb / wSum);
    }
  }
}

/** 线段 AB 与线段 CD 是否相交（用于手指划过剪断绳段）。 */
export function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
): boolean {
  const d1 = cross(dx - cx, dy - cy, ax - cx, ay - cy);
  const d2 = cross(dx - cx, dy - cy, bx - cx, by - cy);
  const d3 = cross(bx - ax, by - ay, cx - ax, cy - ay);
  const d4 = cross(bx - ax, by - ay, dx - ax, dy - ay);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  // 共线端点相触也算相交（避免慢速划过时漏切）
  if (d1 === 0 && onSegment(cx, cy, dx, dy, ax, ay)) return true;
  if (d2 === 0 && onSegment(cx, cy, dx, dy, bx, by)) return true;
  if (d3 === 0 && onSegment(ax, ay, bx, by, cx, cy)) return true;
  if (d4 === 0 && onSegment(ax, ay, bx, by, dx, dy)) return true;
  return false;
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function onSegment(
  ax: number, ay: number, bx: number, by: number,
  px: number, py: number
): boolean {
  return (
    Math.min(ax, bx) - 1e-9 <= px && px <= Math.max(ax, bx) + 1e-9 &&
    Math.min(ay, by) - 1e-9 <= py && py <= Math.max(ay, by) + 1e-9
  );
}

/** 圆与轴对齐矩形是否重叠（刺条、木板碰撞用）。 */
export function circleRectOverlap(
  cx: number, cy: number, r: number,
  rx: number, ry: number, rw: number, rh: number
): boolean {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

/** 圆与圆是否重叠（星星、泡泡、怪物嘴巴）。 */
export function circlesOverlap(
  ax: number, ay: number, ar: number,
  bx: number, by: number, br: number
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
}

export interface RopeBuild {
  /** 新增粒子（[0] 是锚点，其余为绳结） */
  particles: Particle[];
  /**
   * 新增约束。索引是"相对"的：>=0 指向本次新增粒子，
   * -1 表示接到外部的糖果粒子（由调用方换算成全局索引）。
   */
  links: { a: number; b: number; rest: number }[];
}

/**
 * 从锚点到糖果搭一条绳：按总长均分为 segments 段。
 * totalLength 不传则用锚点到糖果的直线距离。
 */
export function buildRope(
  anchorX: number,
  anchorY: number,
  candyX: number,
  candyY: number,
  segments: number,
  totalLength?: number
): RopeBuild {
  const n = Math.max(2, Math.floor(segments));
  const dist = Math.hypot(candyX - anchorX, candyY - anchorY);
  const len = totalLength ?? dist;
  const rest = len / n;
  const particles: Particle[] = [makeParticle(anchorX, anchorY, true)];
  const links: { a: number; b: number; rest: number }[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    particles.push(
      makeParticle(
        anchorX + (candyX - anchorX) * t,
        anchorY + (candyY - anchorY) * t
      )
    );
    links.push({ a: i - 1, b: i, rest });
  }
  links.push({ a: n - 1, b: -1, rest });
  return { particles, links };
}

/**
 * 圆（糖果）与矩形（木板）碰撞并推出，带一点弹性。
 * 返回是否发生碰撞；boardDx/boardDy 是木板本帧位移，让糖果能被木板带着走。
 */
export function collideCircleRect(
  p: Particle,
  r: number,
  rx: number, ry: number, rw: number, rh: number,
  restitution = 0.35,
  boardDx = 0,
  boardDy = 0
): boolean {
  const nx = Math.max(rx, Math.min(p.x, rx + rw));
  const ny = Math.max(ry, Math.min(p.y, ry + rh));
  let dx = p.x - nx;
  let dy = p.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return false;

  let dist = Math.sqrt(d2);
  if (dist < 1e-6) {
    // 圆心陷进矩形里：往最近的边推
    const left = p.x - rx;
    const right = rx + rw - p.x;
    const top = p.y - ry;
    const bottom = ry + rh - p.y;
    const m = Math.min(left, right, top, bottom);
    if (m === top) { dx = 0; dy = -1; }
    else if (m === bottom) { dx = 0; dy = 1; }
    else if (m === left) { dx = -1; dy = 0; }
    else { dx = 1; dy = 0; }
    dist = 1;
  } else {
    dx /= dist;
    dy /= dist;
  }

  const push = r - Math.min(dist, r);
  p.x += dx * push;
  p.y += dy * push;

  // 沿法线反弹：把法向速度取反乘弹性
  const vx = p.x - p.px;
  const vy = p.y - p.py;
  const vn = vx * dx + vy * dy;
  if (vn < 0) {
    const bounceX = vx - (1 + restitution) * vn * dx;
    const bounceY = vy - (1 + restitution) * vn * dy;
    p.px = p.x - bounceX;
    p.py = p.y - bounceY;
  }
  // 踩在木板上（法线朝上）时跟着木板走
  if (dy < -0.5) {
    p.x += boardDx;
    p.px += boardDx * 0.85;
    p.y += boardDy;
  }
  return true;
}

/** 木板在两点间来回滑动的插值位置（余弦缓动，period 秒一个来回）。 */
export function boardPosition(
  x1: number, y1: number, x2: number, y2: number,
  period: number,
  time: number
): { x: number; y: number } {
  const t = (1 - Math.cos((time * Math.PI * 2) / period)) / 2;
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
}

/** 总星数换最终评级。 */
export function starsForCollected(collected: number, total: number): 1 | 2 | 3 {
  if (total <= 0) return 1;
  const ratio = collected / total;
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.45) return 2;
  return 1;
}
