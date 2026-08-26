// 碰碰车大乱斗 · 纯逻辑层(俯视场地 + 弹性碰撞物理)。
//
// 这一层不碰 DOM、不画一个像素、不摸 Math.random:
//  - 碰撞、阻尼、加速带、弹簧墙、掉出场地的判定全是纯函数,可以逐条断言;
//  - 一整局的推进走 `stepWorld(world, dt, intents)`,渲染层和无头单测跑的是同一套代码;
//  - 需要随机的地方(复活点挑选)统一走世界自带的 mulberry32 种子,同一局每次结果一样。
//
// 物理约定:速度单位是「场地单位 / 秒」,时间参数一律毫秒。场地单位是虚拟的,
// 渲染层按画布大小缩放,所以 375×667 的手机和 1280×800 的电脑玩到的是同一场比赛。
import { mulberry32 } from "../level99";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 车身半径(场地单位) */
export const CAR_R = 4.2;
/** 标准车重 */
export const CAR_MASS = 1;
/** 油门加速度(单位/秒²) */
export const ACCEL = 52;
/** 踩油门能开到的最高速度(被撞飞时允许超过这个数) */
export const MAX_SPEED = 32;
/** 每秒保留的速度比例:0.5 表示一秒内自然掉到一半,松手会滑一小段再停 */
export const DAMP_PER_SEC = 0.5;
/** 刹车时每秒保留的速度比例(比自然阻尼狠得多) */
export const BRAKE_PER_SEC = 0.25;
/** 冲刺瞬间加上去的速度 */
export const DASH_KICK = 26;
/** 冲刺增益持续时间 */
export const DASH_MS = 340;
/** 冲刺冷却 */
export const DASH_CD_MS = 1400;
/** 冲刺期间的限速加成 */
export const DASH_SPEED_BONUS = 12;
/** 车对车的弹性系数(接近 1:碰撞几乎不吃掉动能) */
export const CAR_BOUNCE = 0.75;
/** 冲刺撞人时额外的弹性:撞飞的效果更明显 */
export const DASH_BOUNCE = 1.15;
/** 弹簧墙的弹性:大于 1,弹回来比撞上去还快一点 */
export const SPRING_BOUNCE = 1.16;
/** 障碍物的弹性 */
export const HAZARD_BOUNCE = 1.1;
/** 掉出场地的判定:中心越过边缘超过这么多就算掉下去 */
export const FALL_MARGIN = CAR_R * 0.55;
/** 掉出去后多久回到场上 */
export const RESPAWN_MS = 1200;
/** 撞人后多久之内对方掉下去都算这一撞的功劳 */
export const CREDIT_MS = 2600;
/** 认定为「一次有感觉的碰撞」的最小冲击 */
export const BUMP_MIN = 4;
/** 挨了这么重的一撞就会打滑 */
export const SKID_MIN = 12;
/** 打滑持续多久:这段时间里油门只剩三成,方向也不听话 */
export const SKID_MS = 420;
/** 打滑期间油门的折扣 */
export const SKID_THRUST = 0.3;

// ---------------------------------------------------------------------------
// 向量与刚体
// ---------------------------------------------------------------------------

/** 刚体:inv 是质量的倒数,0 表示钉死不动的物体(墙柱、移动障碍) */
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  inv: number;
}

export function hypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** 把向量截断到最大长度(限速用) */
export function clampVec(x: number, y: number, max: number): { x: number; y: number } {
  const len = hypot(x, y);
  if (len <= max || len === 0) return { x, y };
  const k = max / len;
  return { x: x * k, y: y * k };
}

/** 每秒保留 `keep` 比例的阻尼,换算成这一帧的衰减系数 */
export function dampFactor(keep: number, dtMs: number): number {
  const k = Math.max(0, Math.min(1, keep));
  return Math.pow(k, Math.max(0, dtMs) / 1000);
}

/** 两个刚体是否已经叠在一起 */
export function overlapping(a: Body, b: Body): boolean {
  return hypot(b.x - a.x, b.y - a.y) < a.r + b.r;
}

/**
 * 一次弹性碰撞(冲量法)。
 *
 * n 是从 a 指向 b 的单位向量,只有两者正在靠近时才处理;
 * 冲量对 a、b 大小相等方向相反,所以**总动量永远守恒**(单测里直接断言这一条),
 * 弹性系数取 1 时动能也守恒,取小于 1 时按比例吃掉一部分动能。
 * 质量倒数为 0 的一方(墙柱、移动障碍)不吃冲量,只把对方弹开。
 *
 * 返回这一次碰撞的冲击强度(0 表示没碰上),渲染层拿它决定火花与音效。
 */
export function resolveCollision(a: Body, b: Body, restitution: number): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = hypot(dx, dy);
  const min = a.r + b.r;
  if (dist >= min || dist === 0) return 0;
  if (a.inv + b.inv === 0) return 0;
  const nx = dx / dist;
  const ny = dy / dist;
  // a 相对 b 的速度在法线上的分量:大于 0 才是在互相靠近
  const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (rel <= 0) return 0;
  const j = (-(1 + restitution) * rel) / (a.inv + b.inv);
  a.vx += j * a.inv * nx;
  a.vy += j * a.inv * ny;
  b.vx -= j * b.inv * nx;
  b.vy -= j * b.inv * ny;
  return Math.abs(j);
}

/** 把两个叠在一起的刚体按质量比例推开,免得它们卡成一团 */
export function separate(a: Body, b: Body): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = hypot(dx, dy);
  const min = a.r + b.r;
  if (dist >= min) return;
  const total = a.inv + b.inv;
  if (total === 0) return;
  // 正好重合时给一个固定方向,避免除以 0
  const nx = dist === 0 ? 1 : dx / dist;
  const ny = dist === 0 ? 0 : dy / dist;
  const push = min - (dist === 0 ? 0 : dist) + 0.01;
  a.x -= nx * push * (a.inv / total);
  a.y -= ny * push * (a.inv / total);
  b.x += nx * push * (b.inv / total);
  b.y += ny * push * (b.inv / total);
}

/** 一堆刚体的总动量(质量 = 1/inv;钉死的物体不计) */
export function totalMomentum(bodies: readonly Body[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const b of bodies) {
    if (b.inv === 0) continue;
    const m = 1 / b.inv;
    x += m * b.vx;
    y += m * b.vy;
  }
  return { x, y };
}

/** 一堆刚体的总动能 */
export function kineticEnergy(bodies: readonly Body[]): number {
  let e = 0;
  for (const b of bodies) {
    if (b.inv === 0) continue;
    e += (0.5 / b.inv) * (b.vx * b.vx + b.vy * b.vy);
  }
  return e;
}

// ---------------------------------------------------------------------------
// 场地
// ---------------------------------------------------------------------------

export type EdgeName = "top" | "right" | "bottom" | "left";

/** 圆形场地上的一段弹簧护栏,用「圈数」表示角度(0..1,从正右方逆时针) */
export interface SpringArc {
  from: number;
  to: number;
}

export interface Field {
  shape: "rect" | "round";
  /** 方形场地的宽高;圆形场地取两者较小值的一半当半径 */
  w: number;
  h: number;
  /** 方形场地上装了弹簧护栏的边(其余边是开放的悬崖) */
  springs: EdgeName[];
  /** 圆形场地上的弹簧护栏弧段 */
  arcs: SpringArc[];
}

export function fieldCenter(field: Field): { x: number; y: number } {
  return { x: field.w / 2, y: field.h / 2 };
}

export function fieldRadius(field: Field): number {
  return Math.min(field.w, field.h) / 2;
}

/** 角度(弧度)换算成 0..1 的圈数 */
export function turnOf(rad: number): number {
  const t = rad / (Math.PI * 2);
  return t - Math.floor(t);
}

/** 圈数是否落在某段护栏里(支持跨过 0 的弧段) */
export function inArc(arc: SpringArc, turn: number): boolean {
  const t = turn - Math.floor(turn);
  if (arc.from <= arc.to) return t >= arc.from && t <= arc.to;
  return t >= arc.from || t <= arc.to;
}

export interface BoundaryHit {
  /** 指向场内的单位法线 */
  nx: number;
  ny: number;
  /** 中心越过边缘多少(≤0 表示还在场内) */
  depth: number;
  /** 这一段边缘装了弹簧护栏 */
  spring: boolean;
}

/**
 * 某个点相对场地边缘的状态:
 * depth ≤ 0 是安全区,depth > 0 说明中心已经越过边缘,
 * spring 为真就该被弹回来,为假就是要掉下去了。
 */
export function boundaryHit(field: Field, x: number, y: number, inset = 0): BoundaryHit {
  const cut = Math.max(0, inset);
  if (field.shape === "round") {
    const c = fieldCenter(field);
    const dx = x - c.x;
    const dy = y - c.y;
    const dist = hypot(dx, dy);
    const R = Math.max(1, fieldRadius(field) - cut);
    const nx = dist === 0 ? 0 : -dx / dist;
    const ny = dist === 0 ? 0 : -dy / dist;
    const turn = turnOf(Math.atan2(dy, dx));
    return { nx, ny, depth: dist - R, spring: field.arcs.some((a) => inArc(a, turn)) };
  }
  const cand: Array<{ nx: number; ny: number; depth: number; edge: EdgeName }> = [
    { nx: 1, ny: 0, depth: cut - x, edge: "left" },
    { nx: -1, ny: 0, depth: x - (field.w - cut), edge: "right" },
    { nx: 0, ny: 1, depth: cut - y, edge: "top" },
    { nx: 0, ny: -1, depth: y - (field.h - cut), edge: "bottom" },
  ];
  // 取越界最深的那条边;都没越界就取「最接近边缘」的那条,depth 仍是负数
  let best = cand[0];
  for (const c of cand) if (c.depth > best.depth) best = c;
  return { nx: best.nx, ny: best.ny, depth: best.depth, spring: field.springs.includes(best.edge) };
}

/** 场地内的一点到最近边缘还有多远(负数表示已经出界) */
export function edgeDistance(field: Field, x: number, y: number, inset = 0): number {
  return -boundaryHit(field, x, y, inset).depth;
}

// ---------------------------------------------------------------------------
// 加速带与障碍
// ---------------------------------------------------------------------------

/** 加速带:矩形区域,踩上去顺着 dx/dy 方向推一把 */
export interface BoostPad {
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  /** 推力(单位/秒²) */
  power: number;
}

export function inPad(pad: BoostPad, x: number, y: number): boolean {
  return x >= pad.x && x <= pad.x + pad.w && y >= pad.y && y <= pad.y + pad.h;
}

/**
 * 障碍:钉死的柱子(speed = 0)或者来回移动的滚桶。
 * 移动障碍是运动学物体——它按自己的轨迹走,撞到车只把车弹开,自己不会被撞歪。
 */
export interface Hazard {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  r: number;
  /** 来回一趟的速度(单位/秒);0 就是不动的柱子 */
  speed: number;
  /** 出发相位(0..1),让同一张图上的几个滚桶错开 */
  phase: number;
  /** 当前位置(由 hazardAt 每帧刷新) */
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function makeHazard(init: Omit<Hazard, "x" | "y" | "vx" | "vy">): Hazard {
  const h: Hazard = { ...init, x: init.x0, y: init.y0, vx: 0, vy: 0 };
  updateHazard(h, 0);
  return h;
}

/**
 * 把移动障碍推进到 t 毫秒时刻:在两个端点之间做匀速往返(三角波),
 * 纯函数式的位置计算意味着暂停、快进、单测重放都不会算歪。
 */
export function updateHazard(h: Hazard, timeMs: number): void {
  const dx = h.x1 - h.x0;
  const dy = h.y1 - h.y0;
  const span = hypot(dx, dy);
  if (span === 0 || h.speed <= 0) {
    h.x = h.x0;
    h.y = h.y0;
    h.vx = 0;
    h.vy = 0;
    return;
  }
  const cycle = (2 * span) / h.speed;
  const t = ((timeMs / 1000 + h.phase * cycle) % cycle + cycle) % cycle;
  const half = cycle / 2;
  const forward = t < half;
  const k = forward ? t / half : (cycle - t) / half;
  h.x = h.x0 + dx * k;
  h.y = h.y0 + dy * k;
  const dir = forward ? 1 : -1;
  h.vx = (dx / span) * h.speed * dir;
  h.vy = (dy / span) * h.speed * dir;
}

// ---------------------------------------------------------------------------
// 车
// ---------------------------------------------------------------------------

export interface Car {
  id: number;
  name: string;
  emoji: string;
  color: string;
  /** 0 = 玩家这一队,1.. = 对手 */
  team: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  mass: number;
  /** 朝向(弧度),只影响画面与冲刺方向 */
  face: number;
  lives: number;
  /** 撞出去几个对手 */
  score: number;
  /** 自己掉下去几次 */
  falls: number;
  /** true = 正在场外等复活 */
  out: boolean;
  respawn: number;
  /** true = 生命用光,彻底退场 */
  gone: boolean;
  dashT: number;
  dashCd: number;
  /** 打滑剩余时间:挨了重撞的那一小会儿,油门使不上劲 */
  skid: number;
  /** 最近被谁撞过,用来判定「是谁把它撞下去的」 */
  lastHitBy: number;
  lastHitAt: number;
  ai: boolean;
  /** 出生点(复活时优先回到这里) */
  homeX: number;
  homeY: number;
}

export interface CarSpec {
  id: number;
  name: string;
  emoji: string;
  color: string;
  team: number;
  x: number;
  y: number;
  lives?: number;
  mass?: number;
  r?: number;
  ai?: boolean;
}

export function makeCar(spec: CarSpec): Car {
  return {
    id: spec.id,
    name: spec.name,
    emoji: spec.emoji,
    color: spec.color,
    team: spec.team,
    x: spec.x,
    y: spec.y,
    vx: 0,
    vy: 0,
    r: spec.r ?? CAR_R,
    mass: spec.mass ?? CAR_MASS,
    face: 0,
    lives: spec.lives ?? 1,
    score: 0,
    falls: 0,
    out: false,
    respawn: 0,
    gone: false,
    dashT: 0,
    dashCd: 0,
    skid: 0,
    lastHitBy: -1,
    lastHitAt: -99999,
    ai: spec.ai ?? false,
    homeX: spec.x,
    homeY: spec.y,
  };
}

/** 车当前是否在场上(没掉下去也没退场) */
export function carActive(car: Car): boolean {
  return !car.gone && !car.out;
}

/** 把车当成刚体交给物理函数 */
export function bodyOf(car: Car): Body {
  return { x: car.x, y: car.y, vx: car.vx, vy: car.vy, r: car.r, inv: 1 / car.mass };
}

function writeBack(car: Car, body: Body): void {
  car.x = body.x;
  car.y = body.y;
  car.vx = body.vx;
  car.vy = body.vy;
}

// ---------------------------------------------------------------------------
// 世界
// ---------------------------------------------------------------------------

export interface Intent {
  /** 方向摇杆(-1..1),长度大于 1 会自动归一 */
  dx: number;
  dy: number;
  dash: boolean;
  brake: boolean;
}

export const IDLE: Intent = { dx: 0, dy: 0, dash: false, brake: false };

export type CarEvent =
  | { kind: "bump"; who: number; other: number; impact: number }
  | { kind: "wall"; who: number; impact: number }
  | { kind: "boost"; who: number }
  | { kind: "dash"; who: number }
  | { kind: "out"; who: number; by: number }
  | { kind: "respawn"; who: number }
  | { kind: "gone"; who: number };

/**
 * 缩圈:比赛过半之后场地边缘会一圈一圈往里化掉,
 * 谁都别想靠「绕圈躲到时间结束」赖过去——这也是这类撞人玩法必须有的收官机制。
 */
export interface Shrink {
  /** 从第几毫秒开始化 */
  after: number;
  /** 每秒往里化多少 */
  rate: number;
  /** 最多化进来多少 */
  max: number;
}

export const NO_SHRINK: Shrink = { after: 0, rate: 0, max: 0 };

export interface World {
  field: Field;
  cars: Car[];
  pads: BoostPad[];
  hazards: Hazard[];
  /** 已经过去的毫秒 */
  time: number;
  /** 限时(毫秒),0 表示不限时 */
  limit: number;
  /** 每秒保留的速度比例:冰面关把它调高,车就滑得远 */
  keep: number;
  shrink: Shrink;
  /** 当前边缘已经往里化掉了多少(由 stepWorld 每帧刷新,画面照着它画) */
  inset: number;
  events: CarEvent[];
  rand: () => number;
}

export interface WorldOpts {
  field: Field;
  cars: Car[];
  pads?: BoostPad[];
  hazards?: Hazard[];
  limit?: number;
  keep?: number;
  seed?: number;
  /** 不传就按限时自动排一张缩圈表;传 NO_SHRINK 表示这张图不缩 */
  shrink?: Shrink;
}

/**
 * 默认缩圈表:比赛过半开始化,到时间到那一刻正好化掉最小边的两成半。
 * 不限时的场地(比如无尽车海)按 90 秒当作一场来排。
 */
export function defaultShrink(field: Field, limitMs: number): Shrink {
  const span = limitMs > 0 ? limitMs : 90000;
  const after = span * 0.5;
  const max = Math.min(field.w, field.h) * 0.25;
  return { after, rate: max / (span * 0.5 / 1000), max };
}

/** 到 timeMs 这一刻,边缘已经往里化了多少(纯函数,暂停重放都算得一样) */
export function insetAt(shrink: Shrink, timeMs: number): number {
  if (shrink.rate <= 0 || shrink.max <= 0) return 0;
  const t = (timeMs - shrink.after) / 1000;
  if (t <= 0) return 0;
  return Math.min(shrink.max, t * shrink.rate);
}

export function createWorld(opts: WorldOpts): World {
  const limit = opts.limit ?? 0;
  return {
    field: opts.field,
    cars: opts.cars,
    pads: opts.pads ?? [],
    hazards: opts.hazards ?? [],
    time: 0,
    limit,
    keep: opts.keep ?? DAMP_PER_SEC,
    shrink: opts.shrink ?? defaultShrink(opts.field, limit),
    inset: 0,
    events: [],
    rand: mulberry32(opts.seed ?? 20260826),
  };
}

/** 这一刻某个点离「正在往里化的边缘」还有多远 */
export function worldEdge(world: World, x: number, y: number): number {
  return edgeDistance(world.field, x, y, world.inset);
}

/** 剩余秒数(不限时返回 0) */
export function secondsLeft(world: World): number {
  if (world.limit <= 0) return 0;
  return Math.max(0, Math.ceil((world.limit - world.time) / 1000));
}

export function timeUp(world: World): boolean {
  return world.limit > 0 && world.time >= world.limit;
}

/** 某一队还剩几台车没退场 */
export function teamAlive(world: World, team: number): number {
  return world.cars.filter((c) => c.team === team && !c.gone).length;
}

/** 闯关通过:对手全部退场 */
export function levelCleared(world: World): boolean {
  return world.cars.some((c) => c.team !== 0) && world.cars.every((c) => c.team === 0 || c.gone);
}

/** 玩家这一队全军覆没 */
export function playerDown(world: World): boolean {
  return teamAlive(world, 0) === 0;
}

/**
 * 对战的胜者:只剩一队还有车就是那一队;还没分出来返回 -1。
 * 双人同屏与人机对战都用这一条,座位号就是队号。
 */
export function lastTeamStanding(world: World): number {
  const teams = new Set(world.cars.map((c) => c.team));
  const alive = [...teams].filter((t) => teamAlive(world, t) > 0);
  return alive.length === 1 ? alive[0] : -1;
}

/** 找一个离所有人都远、又在场内的复活点 */
export function respawnSpot(world: World, car: Car): { x: number; y: number } {
  const cand: Array<{ x: number; y: number }> = [{ x: car.homeX, y: car.homeY }];
  const c = fieldCenter(world.field);
  cand.push({ x: c.x, y: c.y });
  for (let i = 0; i < 6; i++) {
    const t = world.rand();
    const rad = t * Math.PI * 2;
    const reach = world.field.shape === "round" ? fieldRadius(world.field) * 0.55 : Math.min(world.field.w, world.field.h) * 0.3;
    cand.push({ x: c.x + Math.cos(rad) * reach, y: c.y + Math.sin(rad) * reach });
  }
  let best = cand[0];
  let bestScore = -Infinity;
  for (const p of cand) {
    if (worldEdge(world, p.x, p.y) < car.r * 2) continue;
    let near = Infinity;
    for (const other of world.cars) {
      if (other.id === car.id || !carActive(other)) continue;
      near = Math.min(near, hypot(other.x - p.x, other.y - p.y));
    }
    for (const h of world.hazards) near = Math.min(near, hypot(h.x - p.x, h.y - p.y));
    if (near > bestScore) {
      bestScore = near;
      best = p;
    }
  }
  return best;
}

/**
 * 推进一帧。dt 会被截到 32ms 以内:切后台回来时不会一口气把车瞬移出场。
 * intents 按 world.cars 的下标一一对应,缺省当作松手。
 */
export function stepWorld(world: World, dtMs: number, intents: readonly Intent[]): void {
  const dt = Math.max(0, Math.min(32, dtMs));
  if (dt === 0) return;
  const s = dt / 1000;
  world.time += dt;
  world.inset = insetAt(world.shrink, world.time);

  for (const h of world.hazards) updateHazard(h, world.time);

  // ---- 油门 / 刹车 / 冲刺 ----
  world.cars.forEach((car, i) => {
    if (car.gone) return;
    car.dashT = Math.max(0, car.dashT - dt);
    car.dashCd = Math.max(0, car.dashCd - dt);
    car.skid = Math.max(0, car.skid - dt);
    if (car.out) {
      car.respawn -= dt;
      if (car.respawn <= 0) {
        const spot = respawnSpot(world, car);
        car.x = spot.x;
        car.y = spot.y;
        car.vx = 0;
        car.vy = 0;
        car.out = false;
        car.skid = 0;
        car.lastHitBy = -1;
        world.events.push({ kind: "respawn", who: i });
      }
      return;
    }
    const want = intents[i] ?? IDLE;
    const dir = clampVec(want.dx, want.dy, 1);
    const before = hypot(car.vx, car.vy);
    if (dir.x !== 0 || dir.y !== 0) {
      const boost = (car.dashT > 0 ? 1.5 : 1) * (car.skid > 0 ? SKID_THRUST : 1);
      car.vx += dir.x * ACCEL * boost * s;
      car.vy += dir.y * ACCEL * boost * s;
      car.face = Math.atan2(dir.y, dir.x);
    }
    // 油门只能把车推到「自驾限速」为止;被撞飞、被弹簧墙弹开这些外力
    // 允许超速(否则挨一记重撞也只是慢慢滑走,撞飞就没手感了)。
    const driveCap = Math.max(MAX_SPEED + (car.dashT > 0 ? DASH_SPEED_BONUS : 0), before);
    const drive = clampVec(car.vx, car.vy, driveCap);
    car.vx = drive.x;
    car.vy = drive.y;
    if (want.dash && car.dashCd <= 0) {
      const speed = hypot(car.vx, car.vy);
      const ax = speed > 1 ? car.vx / speed : Math.cos(car.face);
      const ay = speed > 1 ? car.vy / speed : Math.sin(car.face);
      car.vx += ax * DASH_KICK;
      car.vy += ay * DASH_KICK;
      car.dashT = DASH_MS;
      car.dashCd = DASH_CD_MS;
      world.events.push({ kind: "dash", who: i });
    }
    if (want.brake && car.skid <= 0) {
      const k = dampFactor(BRAKE_PER_SEC, dt);
      car.vx *= k;
      car.vy *= k;
    } else {
      const k = dampFactor(world.keep, dt);
      car.vx *= k;
      car.vy *= k;
    }
    // 加速带
    for (const pad of world.pads) {
      if (!inPad(pad, car.x, car.y)) continue;
      car.vx += pad.dx * pad.power * s;
      car.vy += pad.dy * pad.power * s;
      world.events.push({ kind: "boost", who: i });
    }
    // 兜底限速:再怎么连撞带冲,速度也不许飙到画面跟不上
    const capped = clampVec(car.vx, car.vy, MAX_SPEED * 2.6);
    car.vx = capped.x;
    car.vy = capped.y;
    car.x += car.vx * s;
    car.y += car.vy * s;
  });

  // ---- 车与车 ----
  for (let i = 0; i < world.cars.length; i++) {
    const a = world.cars[i];
    if (!carActive(a)) continue;
    for (let j = i + 1; j < world.cars.length; j++) {
      const b = world.cars[j];
      if (!carActive(b)) continue;
      const ba = bodyOf(a);
      const bb = bodyOf(b);
      if (!overlapping(ba, bb)) continue;
      const bounce = a.dashT > 0 || b.dashT > 0 ? DASH_BOUNCE : CAR_BOUNCE;
      const impact = resolveCollision(ba, bb, bounce);
      separate(ba, bb);
      writeBack(a, ba);
      writeBack(b, bb);
      if (impact <= 0) continue;
      a.lastHitBy = b.id;
      a.lastHitAt = world.time;
      b.lastHitBy = a.id;
      b.lastHitAt = world.time;
      if (impact >= SKID_MIN) {
        // 挨重撞的一方会打滑一小会儿,这正是把对手顶出场的窗口
        a.skid = Math.max(a.skid, SKID_MS);
        b.skid = Math.max(b.skid, SKID_MS);
      }
      if (impact >= BUMP_MIN) {
        world.events.push({ kind: "bump", who: i, other: j, impact });
      }
    }
  }

  // ---- 车与障碍 ----
  for (const car of world.cars) {
    if (!carActive(car)) continue;
    for (const h of world.hazards) {
      const hb: Body = { x: h.x, y: h.y, vx: h.vx, vy: h.vy, r: h.r, inv: 0 };
      const cb = bodyOf(car);
      if (!overlapping(cb, hb)) continue;
      const impact = resolveCollision(cb, hb, HAZARD_BOUNCE);
      separate(cb, hb);
      writeBack(car, cb);
      if (impact >= BUMP_MIN) {
        world.events.push({ kind: "wall", who: world.cars.indexOf(car), impact });
      }
    }
  }

  // ---- 边缘:弹簧墙弹回来,开放边掉下去 ----
  world.cars.forEach((car, i) => {
    if (!carActive(car)) return;
    const hit = boundaryHit(world.field, car.x, car.y, world.inset);
    if (hit.depth <= 0) return;
    if (hit.spring) {
      // 推回场内,并把法线方向的速度反弹回去
      car.x += hit.nx * (hit.depth + 0.01);
      car.y += hit.ny * (hit.depth + 0.01);
      const vn = car.vx * hit.nx + car.vy * hit.ny;
      if (vn < 0) {
        car.vx -= (1 + SPRING_BOUNCE) * vn * hit.nx;
        car.vy -= (1 + SPRING_BOUNCE) * vn * hit.ny;
        world.events.push({ kind: "wall", who: i, impact: Math.abs(vn) });
      }
      return;
    }
    if (hit.depth < FALL_MARGIN) return;
    dropCar(world, i);
  });
}

/** 把某台车判定为「掉出场地」,并把功劳记给最后撞它的人 */
export function dropCar(world: World, index: number): void {
  const car = world.cars[index];
  if (!car || car.out || car.gone) return;
  car.out = true;
  car.respawn = RESPAWN_MS;
  car.falls += 1;
  car.vx = 0;
  car.vy = 0;
  let by = -1;
  if (car.lastHitBy >= 0 && world.time - car.lastHitAt <= CREDIT_MS) {
    const hitter = world.cars.find((c) => c.id === car.lastHitBy);
    if (hitter && hitter.team !== car.team) {
      hitter.score += 1;
      by = hitter.id;
    }
  }
  car.lives -= 1;
  world.events.push({ kind: "out", who: index, by });
  if (car.lives <= 0) {
    car.gone = true;
    car.out = false;
    world.events.push({ kind: "gone", who: index });
  }
}

// ---------------------------------------------------------------------------
// 结算与评分
// ---------------------------------------------------------------------------

/** 先赢 target 分的那一队;还没分出来返回 -1 */
export function matchWinner(scores: readonly number[], target = 5): number {
  let best = -1;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] >= target && (best < 0 || scores[i] > scores[best])) best = i;
  }
  return best;
}

/** 时间到还没人达标时按比分判:平手返回 -1 */
export function leader(scores: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
  const tie = scores.filter((s) => s === scores[best]).length > 1;
  return tie ? -1 : best;
}

/**
 * 闯关评星:一次没掉下去且时间宽裕给 3 星,掉过一次给 2 星,再往下 1 星。
 * 「越快越好」和「越稳越好」各占一半,鼓励孩子先站稳再冲。
 */
export function rateLevel(secondsLeft: number, total: number, falls: number): 1 | 2 | 3 {
  const ratio = total > 0 ? secondsLeft / total : 0;
  if (falls === 0 && ratio >= 0.4) return 3;
  if (falls <= 1 && ratio >= 0.15) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// 文案(小学六年级读得懂;失败只鼓励,不批评)
// ---------------------------------------------------------------------------

export function winLine(secondsLeft: number, falls: number, knocked: number): string {
  if (falls === 0) {
    return `撞飞 ${knocked} 台对手车,自己一次都没掉下去,还剩 ${secondsLeft} 秒。走位和刹车配合得很好,继续保持。`;
  }
  return `撞飞 ${knocked} 台对手车,自己掉下去 ${falls} 次。下一关记得贴着场地中间打,边缘留给对手。`;
}

export function loseLine(reason: "fall" | "time"): string {
  if (reason === "fall") {
    return "这一次被顶出了场地。别急,下一把先用刹车稳住车头,再借冲刺撞回去,主动权就回来了。";
  }
  return "时间到啦。下一次试着把对手往最近的悬崖边赶,不用满场追,省下的时间够多撞两台。";
}

export function versusLine(scores: readonly number[], names: readonly string[]): string {
  return `${names[0]} ${scores[0]} 比 ${scores[1]} ${names[1]}`;
}

export function endlessLine(wave: number, best: number): string {
  if (wave >= best && wave > 0) {
    return `顶住了第 ${wave} 波车海,刷新了自己的纪录!车越多越要往中间站,四周留出撞人的空间。`;
  }
  return `这次撑到第 ${wave} 波,最好成绩是第 ${best} 波。人多的时候先别急着冲,等他们互相撞开再收拾。`;
}

// ---------------------------------------------------------------------------
// 键位
// ---------------------------------------------------------------------------

export type InputName = "up" | "right" | "down" | "left" | "dash" | "brake";

/** 朵朵 WASD + F 冲刺 / G 刹车;星星 方向键 + L 冲刺 / K 刹车 */
export const KEY_MAP: Record<string, { player: 0 | 1; action: InputName }> = {
  KeyW: { player: 0, action: "up" },
  KeyD: { player: 0, action: "right" },
  KeyS: { player: 0, action: "down" },
  KeyA: { player: 0, action: "left" },
  KeyF: { player: 0, action: "dash" },
  KeyG: { player: 0, action: "brake" },
  ArrowUp: { player: 1, action: "up" },
  ArrowRight: { player: 1, action: "right" },
  ArrowDown: { player: 1, action: "down" },
  ArrowLeft: { player: 1, action: "left" },
  KeyL: { player: 1, action: "dash" },
  KeyK: { player: 1, action: "brake" },
};

/** 键盘 code 翻译成「几号玩家的哪个动作」;单人玩的时候两套键位都归 0 号 */
export function keyToAction(code: string, players: number): { player: number; action: InputName } | null {
  const hit = KEY_MAP[code];
  if (!hit) return null;
  if (players <= 1) return { player: 0, action: hit.action };
  return { player: hit.player, action: hit.action };
}

export function isPauseKey(code: string): boolean {
  return code === "Escape";
}

/** 上右下左四个按键的按住状态 → 摇杆向量(斜着走不会比直走快) */
export function axisFromHeld(held: ReadonlyArray<boolean>): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  if (held[0]) dy -= 1;
  if (held[1]) dx += 1;
  if (held[2]) dy += 1;
  if (held[3]) dx -= 1;
  const v = clampVec(dx, dy, 1);
  return { dx: v.x, dy: v.y };
}

/** 摇杆的原始偏移 → 归一化方向(死区之内当没动) */
export function stickVector(dx: number, dy: number, radius: number, dead = 0.18): { dx: number; dy: number } {
  const r = Math.max(1, radius);
  const nx = dx / r;
  const ny = dy / r;
  const len = hypot(nx, ny);
  if (len < dead) return { dx: 0, dy: 0 };
  const v = clampVec(nx, ny, 1);
  return { dx: v.x, dy: v.y };
}

/** 秒数 → mm:ss */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
