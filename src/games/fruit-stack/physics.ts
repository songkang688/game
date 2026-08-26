// 果果合成 · 自写 2D 圆碰撞物理。
//
// 没有任何外部物理库:圆-圆用法向冲量 + 库仑摩擦,圆-墙用反射 + 能量损耗,
// 重叠只推位置不灌速度。固定子步长 SUB_DT 积分,一帧最多跑 MAX_SUBSTEPS 个子步,
// 切后台回来也不会一次算爆。
//
// 关掉重力时,这套解算对每一个子步都满足「总动能不增长」:
//  1. 阻尼是一个 ≤ 1 的乘数;
//  2. 法向冲量 j = -(1+e)·vn/invSum(e ≤ 1),ΔE = j·vn·(1-e)/2 ≤ 0;
//  3. 切向冲量同时被库仑上限和「刚好抹平切向相对速度」夹住,ΔE = vt²/invSum·(k²/2-k) ≤ 0;
//  4. 墙面是 v ← -e·v,同样 e ≤ 1;
//  5. 重叠分离只改坐标,对动能的贡献恒为 0。
// physics.test.ts 连续跑 100 个子步逐步断言这一条。

/** 固定子步长(秒) */
export const SUB_DT = 1 / 120;

/** 一帧最多跑几个子步:超出的积压直接丢弃,宁可慢放也不要算爆 */
export const MAX_SUBSTEPS = 4;

/** 重叠分离的比例:一次推掉 80% 的穿透,留一点给下一子步,免得来回抖 */
export const CORRECTION = 0.8;

/** 允许的微小穿透(像素),小于它就不管了 */
export const SLOP = 0.05;

/** 速度低于这个值(像素/秒)才开始累计静止时间 */
export const SETTLE_SPEED = 22;

/** 连续低速这么久(毫秒)算 settled */
export const SETTLE_MS = 380;

/** 刚落下的宽限期(毫秒):期内不参与越线判定 */
export const GRACE_MS = 900;

/** 一帧最多推进的毫秒数:标签页切回来的巨大 dt 会被钳在这里 */
export const MAX_FRAME_MS = 120;

export interface Box {
  w: number;
  h: number;
}

export interface PhysicsTuning {
  /** 重力加速度,像素/秒² */
  gravity: number;
  /** 弹性系数 0..1 */
  restitution: number;
  /** 每秒保留的速度比例 0..1 */
  damping: number;
  /** 圆-圆切向库仑摩擦系数 */
  friction: number;
  /** 圆-墙切向摩擦(每次碰撞抹掉的切向比例) */
  wallFriction: number;
}

export const DEFAULT_TUNING: PhysicsTuning = {
  gravity: 1200,
  restitution: 0.16,
  damping: 0.88,
  friction: 0.28,
  wallFriction: 0.22,
};

export interface Fruit {
  id: number;
  /** 合成链等级,0 起 */
  level: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  mass: number;
  /** 低速累计毫秒 */
  restMs: number;
  /** 落下宽限期剩余毫秒 */
  graceMs: number;
  /** 连锁深度:直接投下的是 0,合成出来的是父辈 +1 */
  chain: number;
  /** 弹出动画剩余毫秒(只影响画面,不影响物理) */
  popMs: number;
  /** 属于哪个容器(双人 / 对战分屏用,单容器恒为 0) */
  side: number;
}

/** 一次合成的吸合动画:两颗先靠拢缩小,再弹出新果 */
export interface MergeAnim {
  /** 合成后的等级;最高级相碰按清除处理时是 -1 */
  level: number;
  fromLevel: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** 两心中点 */
  x: number;
  y: number;
  vx: number;
  vy: number;
  chain: number;
  /** 已进行毫秒 */
  t: number;
  pull: number;
  pop: number;
  spawned: boolean;
}

export type FsEventKind = "drop" | "land" | "merge" | "top" | "over";

export interface FsEvent {
  kind: FsEventKind;
  level: number;
  chain: number;
  x: number;
  y: number;
  score: number;
}

export interface World {
  box: Box;
  fruits: Fruit[];
  merges: MergeAnim[];
  events: FsEvent[];
  tuning: PhysicsTuning;
  /** 警戒线的 y 坐标:静止果子的圆心跑到它上面就算越线 */
  lineY: number;
  score: number;
  /** 已经投下多少颗 */
  drops: number;
  /** 本局出现过的最高等级 */
  bestLevel: number;
  /** 本局最长的一次连锁 */
  bestChain: number;
  seed: number;
  nextId: number;
  /** 累计推进毫秒 */
  time: number;
  /** 子步长累加器(秒) */
  acc: number;
  /** 吸合 / 弹出动画时长,单位毫秒;pull 为 0 表示瞬时合成 */
  pullMs: number;
  popMs: number;
  over: boolean;
  side: number;
}

export interface WorldOptions {
  box: Box;
  lineY: number;
  seed?: number;
  tuning?: Partial<PhysicsTuning>;
  pullMs?: number;
  popMs?: number;
  side?: number;
}

export function createWorld(opts: WorldOptions): World {
  return {
    box: { w: opts.box.w, h: opts.box.h },
    fruits: [],
    merges: [],
    events: [],
    tuning: { ...DEFAULT_TUNING, ...(opts.tuning ?? {}) },
    lineY: opts.lineY,
    score: 0,
    drops: 0,
    bestLevel: 0,
    bestChain: 0,
    seed: opts.seed ?? 1,
    nextId: 1,
    time: 0,
    acc: 0,
    pullMs: opts.pullMs ?? 130,
    popMs: opts.popMs ?? 80,
    over: false,
    side: opts.side ?? 0,
  };
}

export interface FruitSpec {
  level: number;
  x: number;
  y: number;
  r: number;
  vx?: number;
  vy?: number;
  chain?: number;
  graceMs?: number;
  popMs?: number;
}

/** 造一颗果子并放进世界,质量按半径平方走 */
export function addFruit(world: World, spec: FruitSpec): Fruit {
  const fruit: Fruit = {
    id: world.nextId++,
    level: spec.level,
    x: spec.x,
    y: spec.y,
    vx: spec.vx ?? 0,
    vy: spec.vy ?? 0,
    r: spec.r,
    mass: massOf(spec.r),
    restMs: 0,
    graceMs: spec.graceMs ?? GRACE_MS,
    chain: spec.chain ?? 0,
    popMs: spec.popMs ?? 0,
    side: world.side,
  };
  world.fruits.push(fruit);
  if (fruit.level > world.bestLevel) world.bestLevel = fruit.level;
  return fruit;
}

/** 质量 ∝ 半径²(除以 100 只是把数量级压到 1 附近,方便调参) */
export function massOf(r: number): number {
  return Math.max(0.01, (r * r) / 100);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function hypot(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

export function speedOf(f: Fruit): number {
  return hypot(f.vx, f.vy);
}

/** 系统总动能 */
export function kineticEnergy(world: World): number {
  let e = 0;
  for (const f of world.fruits) e += 0.5 * f.mass * (f.vx * f.vx + f.vy * f.vy);
  return e;
}

// ---------------------------------------------------------------------------
// 碰撞解算
// ---------------------------------------------------------------------------

/**
 * 圆-圆:先按质量分摊推开重叠(只动位置),再打法向冲量与切向摩擦。
 * 返回这两颗是不是真的碰上了。
 */
export function resolveCircles(a: Fruit, b: Fruit, tuning: PhysicsTuning = DEFAULT_TUNING): boolean {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let d = hypot(dx, dy);
  const minD = a.r + b.r;
  if (d >= minD) return false;

  if (d < 1e-6) {
    // 完全重合:随便挑个方向把它们错开,免得除以 0
    dx = 0;
    dy = -1;
    d = 1e-6;
  } else {
    dx /= d;
    dy /= d;
  }
  const nx = dx;
  const ny = dy;

  const invA = 1 / a.mass;
  const invB = 1 / b.mass;
  const invSum = invA + invB;

  const pen = Math.max(minD - d - SLOP, 0);
  if (pen > 0) {
    const push = (pen / invSum) * CORRECTION;
    a.x -= nx * push * invA;
    a.y -= ny * push * invA;
    b.x += nx * push * invB;
    b.y += ny * push * invB;
  }

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const e = clamp(tuning.restitution, 0, 1);
    const j = (-(1 + e) * vn) / invSum;
    a.vx -= j * nx * invA;
    a.vy -= j * ny * invA;
    b.vx += j * nx * invB;
    b.vy += j * ny * invB;

    // 切向:方向取法线转 90°,大小同时被「抹平相对滑动」和库仑上限夹住
    const tx = -ny;
    const ty = nx;
    const vt = rvx * tx + rvy * ty;
    const stop = -vt / invSum;
    const cap = clamp(tuning.friction, 0, 1) * Math.abs(j);
    const jt = clamp(stop, -cap, cap);
    a.vx -= jt * tx * invA;
    a.vy -= jt * ty * invA;
    b.vx += jt * tx * invB;
    b.vy += jt * ty * invB;
  }
  return true;
}

/**
 * 圆-墙:左右两堵墙和地面。顶部是开口(果子可以从上面掉进来)。
 * 位置先夹回场内,速度按弹性反射并抹掉一部分切向。
 */
export function resolveBounds(c: Fruit, box: Box, tuning: PhysicsTuning = DEFAULT_TUNING): boolean {
  const e = clamp(tuning.restitution, 0, 1);
  const mu = clamp(tuning.wallFriction, 0, 1);
  let hit = false;

  if (c.x - c.r < 0) {
    c.x = c.r;
    if (c.vx < 0) {
      c.vx = -c.vx * e;
      c.vy *= 1 - mu;
    }
    hit = true;
  } else if (c.x + c.r > box.w) {
    c.x = box.w - c.r;
    if (c.vx > 0) {
      c.vx = -c.vx * e;
      c.vy *= 1 - mu;
    }
    hit = true;
  }

  if (c.y + c.r > box.h) {
    c.y = box.h - c.r;
    if (c.vy > 0) {
      c.vy = -c.vy * e;
      c.vx *= 1 - mu;
    }
    hit = true;
  }
  return hit;
}

/** 一个固定长度的子步:积分 → 解碰撞 → 更新静止计时 */
export function substep(world: World, dt: number = SUB_DT): void {
  const t = world.tuning;
  const keep = Math.pow(clamp(t.damping, 0, 1), dt);
  const ms = dt * 1000;

  for (const f of world.fruits) {
    f.vy += t.gravity * dt;
    f.vx *= keep;
    f.vy *= keep;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.graceMs > 0) f.graceMs = Math.max(0, f.graceMs - ms);
    if (f.popMs > 0) f.popMs = Math.max(0, f.popMs - ms);
  }

  // 两轮解算:一轮先把大的穿透推开,二轮收尾,堆得再高也不会陷进去
  for (let iter = 0; iter < 2; iter++) {
    const list = world.fruits;
    for (let i = 0; i < list.length; i++) {
      for (let k = i + 1; k < list.length; k++) {
        resolveCircles(list[i], list[k], t);
      }
    }
    for (const f of list) resolveBounds(f, world.box, t);
  }

  for (const f of world.fruits) {
    if (speedOf(f) < SETTLE_SPEED) f.restMs += ms;
    else f.restMs = 0;
  }
}

/** 按真实帧间隔推进:内部换算成固定子步,积压超过 MAX_SUBSTEPS 就丢掉 */
export function stepPhysics(world: World, dtMs: number): number {
  const dt = clamp(Number.isFinite(dtMs) ? dtMs : 0, 0, MAX_FRAME_MS) / 1000;
  world.acc += dt;
  let steps = 0;
  while (world.acc >= SUB_DT && steps < MAX_SUBSTEPS) {
    substep(world, SUB_DT);
    world.acc -= SUB_DT;
    steps++;
  }
  if (steps >= MAX_SUBSTEPS && world.acc > SUB_DT) world.acc = 0;
  world.time += dt * 1000;
  return steps;
}

// ---------------------------------------------------------------------------
// 静止 / 越线
// ---------------------------------------------------------------------------

/** 静止判定:连续低速超过 SETTLE_MS */
export function isSettled(c: Fruit): boolean {
  return c.restMs >= SETTLE_MS;
}

/** 刚落下还在宽限期内 */
export function inGrace(c: Fruit): boolean {
  return c.graceMs > 0;
}

/**
 * 越线判定:只看**已经静止且宽限期已过**的果子,圆心跑到警戒线上面才算。
 * 半空中的果子和刚投下的果子都不判,免得手一抖就判输。
 */
export function overLine(world: World, y: number = world.lineY): boolean {
  for (const f of world.fruits) {
    if (inGrace(f)) continue;
    if (!isSettled(f)) continue;
    if (f.y < y) return true;
  }
  return false;
}

/**
 * 快要越线了:堆里已经停下来的果子上沿冒到警戒线附近,界面先闪一闪。
 * 刚投下的那一颗不算,不然投放点本来就在线上方,线会一直闪。
 */
export function nearLine(world: World, y: number = world.lineY, margin = 18): boolean {
  for (const f of world.fruits) {
    if (inGrace(f)) continue;
    if (f.y - f.r < y + margin) return true;
  }
  return false;
}

/** 全场都停稳了(用来判断可以投下一颗了) */
export function allSettled(world: World): boolean {
  if (world.merges.length > 0) return false;
  for (const f of world.fruits) {
    if (!isSettled(f)) return false;
  }
  return true;
}

/** 当前堆得最高的那颗果子的上沿(空场返回容器底) */
export function stackTop(world: World): number {
  let top = world.box.h;
  for (const f of world.fruits) top = Math.min(top, f.y - f.r);
  return top;
}

/**
 * 容器的高度图:把宽度切成 cols 段,每段取最高的那个上沿。
 * 「高手」档假人靠它找低洼处投放。
 */
export function heightMap(world: World, cols: number): number[] {
  const out = new Array<number>(Math.max(1, cols)).fill(world.box.h);
  const step = world.box.w / out.length;
  for (const f of world.fruits) {
    const from = clamp(Math.floor((f.x - f.r) / step), 0, out.length - 1);
    const to = clamp(Math.floor((f.x + f.r) / step), 0, out.length - 1);
    for (let i = from; i <= to; i++) out[i] = Math.min(out[i], f.y - f.r);
  }
  return out;
}

/** 记一条事件(界面拿它放音效与飘字) */
export function pushEvent(world: World, ev: FsEvent): void {
  world.events.push(ev);
  if (world.events.length > 64) world.events.splice(0, world.events.length - 64);
}
