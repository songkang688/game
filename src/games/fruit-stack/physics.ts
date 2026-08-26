/**
 * 果果合成 · 自写 2D 圆碰撞物理（不引入任何物理引擎依赖）。
 *
 * 设计要点：
 *  - 固定步长子步进（SUB_DT），先积分再解重叠，保证同一序列每次结果一致；
 *  - 碰撞用「法向冲量 + 位置修正」，恢复系数 < 1，摩擦与阻尼都是耗散项，
 *    所以在没有外力注入时系统总动能不会增长（有单测盯着这条）。
 */

export interface Vec {
  x: number;
  y: number;
}

export interface Circle {
  /** 场上唯一编号 */
  id: number;
  /** 合成链等级 0..10 */
  level: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** 质量 ∝ 半径² */
  m: number;
  /** 静止累计毫秒 */
  restMs: number;
  /** 刚落下的宽限剩余毫秒：宽限期内不参与越线判定 */
  graceMs: number;
  /** 属于哪一边（对战 / 双人时区分容器），单容器恒为 0 */
  side: number;
}

export interface Box {
  left: number;
  right: number;
  floor: number;
  /** 警戒线 y（越小越靠上） */
  line: number;
}

export interface World {
  box: Box;
  circles: Circle[];
  /** 重力加速度（像素 / 秒²） */
  gravity: number;
  /** 恢复系数 */
  restitution: number;
  /** 每秒速度衰减比例 */
  damping: number;
  /** 与地面 / 墙的切向摩擦 */
  friction: number;
  nextId: number;
}

/** 固定物理子步长（秒） */
export const SUB_DT = 1 / 120;

/** 速度低于这个值并持续 SETTLE_MS 就算静止 */
export const SETTLE_SPEED = 12;
export const SETTLE_MS = 240;

/** 刚落下的果子有这么长时间不参与越线判定 */
export const DROP_GRACE_MS = 900;

export const DEFAULT_GRAVITY = 1500;
export const DEFAULT_RESTITUTION = 0.22;
export const DEFAULT_DAMPING = 0.7;
export const DEFAULT_FRICTION = 0.06;

export function makeWorld(box: Box, over: Partial<Omit<World, "box" | "circles" | "nextId">> = {}): World {
  return {
    box,
    circles: [],
    gravity: over.gravity ?? DEFAULT_GRAVITY,
    restitution: over.restitution ?? DEFAULT_RESTITUTION,
    damping: over.damping ?? DEFAULT_DAMPING,
    friction: over.friction ?? DEFAULT_FRICTION,
    nextId: 1,
  };
}

export function massOf(r: number): number {
  return Math.max(0.0001, r * r * 0.01);
}

export function addCircle(world: World, level: number, x: number, y: number, r: number, side = 0): Circle {
  const c: Circle = {
    id: world.nextId++,
    level,
    x,
    y,
    vx: 0,
    vy: 0,
    r,
    m: massOf(r),
    restMs: 0,
    graceMs: DROP_GRACE_MS,
    side,
  };
  world.circles.push(c);
  return c;
}

/** 系统总动能，稳定性回归用 */
export function kineticEnergy(world: World): number {
  let e = 0;
  for (const c of world.circles) e += 0.5 * c.m * (c.vx * c.vx + c.vy * c.vy);
  return e;
}

/** 一对圆的重叠解算：法向冲量 + 位置修正，返回是否真的碰上了 */
export function resolveCircles(a: Circle, b: Circle, restitution: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distSq = dx * dx + dy * dy;
  const minDist = a.r + b.r;
  if (distSq >= minDist * minDist) return false;
  let dist = Math.sqrt(distSq);
  let nx: number;
  let ny: number;
  if (dist < 1e-6) {
    // 完全重合时给一个确定的分离方向，避免除以 0
    dist = 1e-6;
    nx = 1;
    ny = 0;
  } else {
    nx = dx / dist;
    ny = dy / dist;
  }
  const overlap = minDist - dist;
  const invA = 1 / a.m;
  const invB = 1 / b.m;
  const invSum = invA + invB;
  // 位置修正：按质量反比推开，留一点点松弛避免抖动
  const corr = (overlap * 0.8) / invSum;
  a.x -= nx * corr * invA;
  a.y -= ny * corr * invA;
  b.x += nx * corr * invB;
  b.y += ny * corr * invB;

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn > 0) return true; // 已经在分离
  const e = Math.max(0, Math.min(0.95, restitution));
  const j = (-(1 + e) * vn) / invSum;
  a.vx -= j * nx * invA;
  a.vy -= j * ny * invA;
  b.vx += j * nx * invB;
  b.vy += j * ny * invB;
  return true;
}

/** 圆与容器边界：反射 + 能量损耗 + 切向摩擦 */
export function resolveBounds(c: Circle, box: Box, restitution: number, friction: number): void {
  const e = Math.max(0, Math.min(0.95, restitution));
  if (c.x - c.r < box.left) {
    c.x = box.left + c.r;
    if (c.vx < 0) c.vx = -c.vx * e;
    c.vy *= 1 - friction;
  }
  if (c.x + c.r > box.right) {
    c.x = box.right - c.r;
    if (c.vx > 0) c.vx = -c.vx * e;
    c.vy *= 1 - friction;
  }
  if (c.y + c.r > box.floor) {
    c.y = box.floor - c.r;
    if (c.vy > 0) c.vy = -c.vy * e;
    c.vx *= 1 - friction;
  }
}

/** 单个子步：积分 → 边界 → 两两分离 */
export function substep(world: World, dt: number): void {
  const decay = Math.max(0, 1 - world.damping * dt);
  for (const c of world.circles) {
    c.vy += world.gravity * dt;
    c.vx *= decay;
    c.vy *= decay;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
  }
  for (const c of world.circles) resolveBounds(c, world.box, world.restitution, world.friction);
  const list = world.circles;
  for (let i = 0; i < list.length; i++) {
    for (let k = i + 1; k < list.length; k++) {
      if (list[i].side !== list[k].side) continue;
      resolveCircles(list[i], list[k], world.restitution);
    }
  }
  for (const c of world.circles) resolveBounds(c, world.box, world.restitution, world.friction);
}

/**
 * 推进 dtMs 毫秒：拆成若干个固定子步跑，最多 8 个，避免掉帧时一次跳太远。
 */
export function stepPhysics(world: World, dtMs: number): void {
  const seconds = Math.max(0, Math.min(0.1, dtMs / 1000));
  const steps = Math.max(1, Math.min(8, Math.round(seconds / SUB_DT)));
  const dt = seconds / steps;
  for (let s = 0; s < steps; s++) substep(world, dt);
  const ms = seconds * 1000;
  for (const c of world.circles) {
    const speed = Math.hypot(c.vx, c.vy);
    c.restMs = speed < SETTLE_SPEED ? c.restMs + ms : 0;
    c.graceMs = Math.max(0, c.graceMs - ms);
  }
}

/** 这颗果子静止了吗 */
export function isSettled(c: Circle): boolean {
  return c.restMs >= SETTLE_MS;
}

/** 全场都静止了吗 */
export function allSettled(world: World): boolean {
  return world.circles.every(isSettled);
}

/**
 * 越线判定：只看**已经静止**的果子，而且刚落下的宽限期内一律不算。
 * 返回越线的果子 id 列表。
 */
export function overLine(world: World, side = 0): number[] {
  const out: number[] = [];
  for (const c of world.circles) {
    if (c.side !== side) continue;
    if (c.graceMs > 0) continue;
    if (!isSettled(c)) continue;
    if (c.y < world.box.line) out.push(c.id);
  }
  return out;
}

/** 警戒线预警：有果子静止后离警戒线只差一点点 */
export function nearLine(world: World, warnPx: number, side = 0): boolean {
  for (const c of world.circles) {
    if (c.side !== side) continue;
    if (c.y - c.r < world.box.line + warnPx) return true;
  }
  return false;
}

/** 容器里最高一颗果子的顶端 y（没有果子时返回地面 y） */
export function stackTop(world: World, side = 0): number {
  let top = world.box.floor;
  for (const c of world.circles) {
    if (c.side !== side) continue;
    top = Math.min(top, c.y - c.r);
  }
  return top;
}
