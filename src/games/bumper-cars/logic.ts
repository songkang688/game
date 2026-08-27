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
/**
 * 车对车恢复系数的下限与上限。
 *
 * 1.2 规格把这个值钉在 0.6–0.8 之间:低于 0.6 撞起来像撞棉花,高于 0.8 就成了「凭空造能量」,
 * 两台静止的车贴一下都能互相弹飞,小朋友看不懂。所有车对车的碰撞都要先过 `clampRestitution`。
 */
export const E_MIN = 0.6;
export const E_MAX = 0.8;

/** 把任意恢复系数夹回 [E_MIN, E_MAX];非数字当作中间值 */
export function clampRestitution(e: number): number {
  if (!Number.isFinite(e)) return (E_MIN + E_MAX) / 2;
  return Math.max(E_MIN, Math.min(E_MAX, e));
}

/** 车对车的弹性系数(普通对撞) */
export const CAR_BOUNCE = E_MAX;
/** 冲刺 / 蓄力撞人时的弹性:取上限,撞飞的效果最明显 */
export const DASH_BOUNCE = E_MAX;
/**
 * 「顶一把」的额外推力(单位/秒)。
 *
 * 恢复系数被规格钉死在 0.8 以内,纯弹性碰撞再也不能凭空造能量;
 * 但冲刺 / 蓄力状态下车屁股后面是有马达在顶的,这股力来自地面,不属于两车之间的内力。
 * 所以撞飞的手感放在这里做:被撞的一方沿连心线再吃一记推力,按质量比缩放——
 * 重车照样难顶动。`resolveCollision` 本身保持严格的动量守恒,单测直接断言那一条。
 */
export const DASH_RAM = 16;
/** 弹簧墙的弹性:大于 1,弹回来比撞上去还快一点(这是机关,不是车对车) */
export const SPRING_BOUNCE = 1.16;
/** 障碍物的弹性 */
export const HAZARD_BOUNCE = 1.1;
/** 掉出场地的判定:中心越过边缘超过这么多就开始「打转」 */
export const FALL_MARGIN = CAR_R * 0.55;
/** 中心越过边缘超过这么多就是整台车都出去了,再打转也没意义 */
export const DEEP_MARGIN = CAR_R * 0.9;
/** 打转:越界之后先原地打转这么久,这段时间里往场内打方向还能自己开回来 */
export const TEETER_MS = 2000;
/** 打转期间死命往场内打方向能蹭回来的速度(单位/秒) */
export const TEETER_CRAWL = 2.6;
/** 打转期间车自己往台沿外滑的速度(单位/秒):撒手不管就是一路滑出去 */
export const TEETER_SLIDE = 0.7;
/** 打转期间每秒转几圈 */
export const TEETER_TURNS_PER_SEC = 1.4;
/** 打转的车再挨一记「往外」的撞击,冲击到这个数就直接出局 */
export const LIP_KO_IMPACT = 14;
/** 没到这个数的小碰撞只把它往外推一点:每点冲击推多少 */
export const LIP_SHOVE = 0.055;
/** 一次小碰撞最多把它往外推多少 */
export const LIP_SHOVE_MAX = 0.6;

/**
 * 打转时这一帧的径向速度:正数 = 往场内蹭回来,负数 = 继续往外滑。
 *
 * `inward` 是方向摇杆在「指向场内的法线」上的分量(-1..1)。
 * 半个车身悬空,轮子咬不住地,所以油门在这里不按加速度算——
 * 死命往里打也只有 `TEETER_CRAWL - TEETER_SLIDE` 这么一点点爬回去的速度,
 * 刚好够在两秒里挪回台面;方向打歪了、或者干脆撒手,就一路滑出去。
 */
export function teeterCrawl(inward: number): number {
  const k = Math.max(0, Math.min(1, inward));
  return TEETER_CRAWL * k - TEETER_SLIDE;
}

/** 无尽模式里每台车一共有几次上场机会(掉下去由工作人员推回来,用完才退场) */
export const ENDLESS_REVIVES = 3;
/** 掉出去后多久回到场上 */
export const RESPAWN_MS = 1200;
/** 把人往悬崖顶了一下之后,多久之内对方掉下去都算这一下的功劳 */
export const CREDIT_MS = 2600;
/** 这一撞给对方加了多少「朝悬崖去」的速度才算「顶了一把」(单位/秒) */
export const SHOVE_MIN = 3;
/** 撞上去的那一刻,自己得朝对方开出这个速度,这一下才算是我出的力(单位/秒) */
export const SHOVE_DRIVE_MIN = 4;
/** 认定为「一次有感觉的碰撞」的最小冲击 */
export const BUMP_MIN = 4;
/** 挨了这么重的一撞就会打滑 */
export const SKID_MIN = 12;
/** 打滑持续多久:这段时间里油门只剩三成,方向也不听话 */
export const SKID_MS = 420;
/** 打滑期间油门的折扣 */
export const SKID_THRUST = 0.3;
/** 挨一记重撞之后失控旋转多久(规格钉死 0.3 秒) */
export const SPIN_MS = 300;
/** 失控旋转的角速度范围(圈/秒):撞得越狠转得越快 */
export const SPIN_TURNS_MIN = 1.1;
export const SPIN_TURNS_MAX = 3.2;
/** 冲击强度到这个数就算「转满」 */
export const SPIN_FULL_IMPACT = 46;

// ---------------------------------------------------------------------------
// 蓄力冲撞
// ---------------------------------------------------------------------------

/** 按住这么久算蓄满 */
export const CHARGE_MS = 800;
/** 至少按住这么久松手才放得出来,免得手一抖就白交冷却 */
export const CHARGE_MIN_MS = 220;
/** 蓄力期间油门的折扣:车明显慢下来,这就是给对手看的「前摇」 */
export const CHARGE_THRUST = 0.5;
/** 蓄满之后放出去的速度增量(最小 / 最大) */
export const CHARGE_KICK_MIN = 20;
export const CHARGE_KICK_MAX = 46;
/** 强撞的增益持续时间 */
export const CHARGE_BOOST_MS = 460;
/** 强撞的冷却 */
export const CHARGE_CD_MS = 2600;

/** 按住的毫秒数 → 0..1 的蓄力量 */
export function chargeRatio(heldMs: number): number {
  if (!Number.isFinite(heldMs) || heldMs <= 0) return 0;
  return Math.min(1, heldMs / CHARGE_MS);
}

/** 蓄力量 → 放出去那一下的速度增量;没蓄够 CHARGE_MIN_MS 的返回 0 */
export function chargeKick(heldMs: number): number {
  if (!Number.isFinite(heldMs) || heldMs < CHARGE_MIN_MS) return 0;
  const r = chargeRatio(heldMs);
  return CHARGE_KICK_MIN + (CHARGE_KICK_MAX - CHARGE_KICK_MIN) * r;
}

/** 冲击强度 → 失控旋转的角速度(弧度/秒),符号由 sign 决定 */
export function spinRateFor(impact: number, sign: 1 | -1): number {
  const k = Math.max(0, Math.min(1, Math.abs(impact) / SPIN_FULL_IMPACT));
  const turns = SPIN_TURNS_MIN + (SPIN_TURNS_MAX - SPIN_TURNS_MIN) * k;
  return sign * turns * Math.PI * 2;
}

/** 失控旋转 elapsed 毫秒之后的车头朝向(纯函数,单测可以逐帧对) */
export function spinFaceAt(base: number, rate: number, elapsedMs: number): number {
  return base + rate * (Math.max(0, elapsedMs) / 1000);
}

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

/** 最近的那条「开放边」:朝场外的单位法线 + 还有多远(负数表示已经越过去了) */
export interface OpenEdge {
  /** 指向场外(悬崖那边)的单位法线 */
  ox: number;
  oy: number;
  /** 到这条开放边还有多远 */
  dist: number;
}

/**
 * 离这一点最近的**悬崖**在哪个方向、还有多远;四面都是护栏就返回 null。
 *
 * 和 `boundaryHit` 的区别是这里只认没装护栏的那几条边——护栏会把车弹回来,
 * 贴着护栏开一点都不危险,把它算进「危险距离」里只会让车缩在场地中间不敢动。
 * 圆台按车此刻的方位角判断:落在护栏弧段上就不算悬崖,因为车真要掉也是从这个方位掉下去。
 */
export function openEdgeAt(field: Field, x: number, y: number, inset = 0): OpenEdge | null {
  const cut = Math.max(0, inset);
  if (field.shape === "round") {
    const c = fieldCenter(field);
    const dx = x - c.x;
    const dy = y - c.y;
    const dist = hypot(dx, dy);
    const turn = turnOf(Math.atan2(dy, dx));
    if (field.arcs.some((a) => inArc(a, turn))) return null;
    const R = Math.max(1, fieldRadius(field) - cut);
    if (dist < 0.001) return { ox: 1, oy: 0, dist: R };
    return { ox: dx / dist, oy: dy / dist, dist: R - dist };
  }
  const edges: Array<{ ox: number; oy: number; dist: number; edge: EdgeName }> = [
    { ox: -1, oy: 0, dist: x - cut, edge: "left" },
    { ox: 1, oy: 0, dist: field.w - cut - x, edge: "right" },
    { ox: 0, oy: -1, dist: y - cut, edge: "top" },
    { ox: 0, oy: 1, dist: field.h - cut - y, edge: "bottom" },
  ];
  const cand = edges.filter((e) => !field.springs.includes(e.edge));
  if (cand.length === 0) return null;
  let best = cand[0];
  for (const e of cand) if (e.dist < best.dist) best = e;
  return { ox: best.ox, oy: best.oy, dist: best.dist };
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
// 场地机关(三种,全是纯函数:弹簧墙 / 旋转盘 / 油渍)
// ---------------------------------------------------------------------------

/**
 * 弹簧墙:撞上去按 e 反弹。
 * vn 是沿「指向场内的法线」的速度分量,负数表示正在往外撞;
 * 返回反弹之后的法线速度(正数 = 被推回场内)。e 大于 1 就是「弹回来比撞上去还快」的加成。
 */
export function springBounce(vn: number, e = SPRING_BOUNCE): number {
  if (vn >= 0) return vn;
  return -vn * e;
}

/**
 * 旋转盘:踩上去的车会被盘子带着转——车头按盘子的转速偏过去,
 * 同时吃到一点切向推力。盘子不改变车的速度大小,只改方向,所以不会凭空加速。
 */
export interface Spinner {
  x: number;
  y: number;
  r: number;
  /** 每秒转几圈,正数 = 顺时针(屏幕坐标 y 向下) */
  rate: number;
  /** 切向推力(单位/秒²) */
  push: number;
}

export function onSpinner(sp: Spinner, x: number, y: number): boolean {
  return hypot(x - sp.x, y - sp.y) <= sp.r;
}

/** 站在盘子上这一帧会被转多少弧度、被切向推多少 */
export function spinnerEffect(sp: Spinner, x: number, y: number, dtMs: number): {
  faceDelta: number;
  ax: number;
  ay: number;
} {
  if (!onSpinner(sp, x, y)) return { faceDelta: 0, ax: 0, ay: 0 };
  const s = Math.max(0, dtMs) / 1000;
  const dx = x - sp.x;
  const dy = y - sp.y;
  const d = hypot(dx, dy);
  // 圆心上没有切线方向,只转车头
  if (d < 0.001) return { faceDelta: sp.rate * Math.PI * 2 * s, ax: 0, ay: 0 };
  const sign = sp.rate >= 0 ? 1 : -1;
  const tanX = (-dy / d) * sign;
  const tanY = (dx / d) * sign;
  return { faceDelta: sp.rate * Math.PI * 2 * s, ax: tanX * sp.push, ay: tanY * sp.push };
}

/**
 * 油渍:一摊圆形的油,踩上去摩擦变小(每秒保留的速度比例被抬高),车会一路滑过去。
 * `keep` 一定要比场地本身的 keep 大才叫「更滑」,`slickKeepAt` 会取两者中更滑的那个。
 */
export interface Slick {
  x: number;
  y: number;
  r: number;
  /** 这一摊油上每秒保留的速度比例(越接近 1 越滑) */
  keep: number;
}

export function onSlick(sl: Slick, x: number, y: number): boolean {
  return hypot(x - sl.x, y - sl.y) <= sl.r;
}

/** 这一点上实际生效的每秒保留比例:踩到油就用油的,踩到好几摊就用最滑的那摊 */
export function slickKeepAt(slicks: readonly Slick[], x: number, y: number, base: number): number {
  let keep = base;
  for (const sl of slicks) {
    if (onSlick(sl, x, y)) keep = Math.max(keep, sl.keep);
  }
  return Math.min(0.995, keep);
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
  /** 失控旋转剩余时间(毫秒);大于 0 时车头自己转,方向盘不太听话 */
  spin: number;
  /** 失控旋转的角速度(弧度/秒) */
  spinRate: number;
  /** 已经按住蓄力多久(毫秒) */
  charge: number;
  /** 强撞的冷却剩余 */
  chargeCd: number;
  /** 打转剩余时间(毫秒):车滑出场边了,这两秒里还有救 */
  teeter: number;
  /** 这一局一共打转过几次 */
  teeters: number;
  /**
   * 最近**把这台车往悬崖那边顶**的是谁,用来判定「是谁把它撞下去的」。
   *
   * 记的不是「最后碰过我的人」:对手一头撞在停着不动的车上、自己弹开之后
   * 一路开下悬崖,这一下不该算在被撞的人头上。只有那次碰撞真的给我加了
   * 一份朝悬崖去的速度(≥ `SHOVE_MIN`)才留名,超过 `CREDIT_MS` 或者
   * 中途被台沿救回来都作废。
   */
  lastPushBy: number;
  lastPushAt: number;
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
    spin: 0,
    spinRate: 0,
    charge: 0,
    chargeCd: 0,
    teeter: 0,
    teeters: 0,
    lastPushBy: -1,
    lastPushAt: -99999,
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
  /** 按住 = 蓄力,松开 = 放出强撞;不传当作没按 */
  charge?: boolean;
}

export const IDLE: Intent = { dx: 0, dy: 0, dash: false, brake: false };

export type CarEvent =
  | { kind: "bump"; who: number; other: number; impact: number }
  | { kind: "wall"; who: number; impact: number }
  | { kind: "boost"; who: number }
  | { kind: "dash"; who: number }
  | { kind: "charge"; who: number; power: number }
  | { kind: "spinner"; who: number }
  | { kind: "slick"; who: number }
  | { kind: "teeter"; who: number }
  | { kind: "rescue"; who: number }
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
  /** 旋转盘 */
  spinners: Spinner[];
  /** 油渍 */
  slicks: Slick[];
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
  spinners?: Spinner[];
  slicks?: Slick[];
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
    spinners: opts.spinners ?? [],
    slicks: opts.slicks ?? [],
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

  // 这一帧谁真的在开车(踩着方向 / 还在冲刺 / 攒着蓄力)。
  // 「撞飞」记谁头上要看这个:被人撞得满场飞、恰好撞到别人身上,那不是你的战绩。
  const driving: boolean[] = world.cars.map(() => false);

  // ---- 油门 / 刹车 / 冲刺 / 蓄力 ----
  world.cars.forEach((car, i) => {
    if (car.gone) return;
    car.dashT = Math.max(0, car.dashT - dt);
    car.dashCd = Math.max(0, car.dashCd - dt);
    car.chargeCd = Math.max(0, car.chargeCd - dt);
    car.skid = Math.max(0, car.skid - dt);
    if (car.spin > 0) {
      // 失控旋转:车头自己转,方向盘还能推,但车身看着就是在打圈
      car.face = spinFaceAt(car.face, car.spinRate, dt);
      car.spin = Math.max(0, car.spin - dt);
      if (car.spin === 0) car.spinRate = 0;
    }
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
        car.spin = 0;
        car.spinRate = 0;
        car.charge = 0;
        car.teeter = 0;
        car.lastPushBy = -1;
        world.events.push({ kind: "respawn", who: i });
      }
      return;
    }
    const want = intents[i] ?? IDLE;
    const dir = clampVec(want.dx, want.dy, 1);
    if (car.teeter > 0) {
      // 挂在台沿上打转:车身悬空,油门、冲刺、机关这一帧全都用不上,
      // 只剩「往场内死命打方向」这一件事能做。
      const lip = boundaryHit(world.field, car.x, car.y, world.inset);
      const crawl = teeterCrawl(dir.x * lip.nx + dir.y * lip.ny);
      // 往外滑也有个限度:光靠自己滑不会整台车悬空——那得是被人再撞一下才有的事。
      const room = Math.max(0, DEEP_MARGIN - 0.05 - lip.depth);
      const move = crawl < 0 ? -Math.min(room, -crawl * s) : crawl * s;
      car.vx = lip.nx * crawl;
      car.vy = lip.ny * crawl;
      car.x += lip.nx * move;
      car.y += lip.ny * move;
      car.charge = 0;
      return;
    }
    const before = hypot(car.vx, car.vy);
    driving[i] = dir.x !== 0 || dir.y !== 0 || want.dash === true || car.dashT > 0 || car.charge > 0;
    // 蓄力:按住的时候车明显慢下来(这就是给对手看的前摇),松手才放出去
    const charging = want.charge === true && car.chargeCd <= 0 && car.spin <= 0;
    if (charging) car.charge = Math.min(CHARGE_MS, car.charge + dt);
    if (dir.x !== 0 || dir.y !== 0) {
      const boost = (car.dashT > 0 ? 1.5 : 1) * (car.skid > 0 ? SKID_THRUST : 1) * (charging ? CHARGE_THRUST : 1);
      car.vx += dir.x * ACCEL * boost * s;
      car.vy += dir.y * ACCEL * boost * s;
      if (car.spin <= 0) car.face = Math.atan2(dir.y, dir.x);
    }
    if (!charging && car.charge > 0) {
      const kick = chargeKick(car.charge);
      if (kick > 0) {
        const speed = hypot(car.vx, car.vy);
        const ax = speed > 1 ? car.vx / speed : Math.cos(car.face);
        const ay = speed > 1 ? car.vy / speed : Math.sin(car.face);
        car.vx += ax * kick;
        car.vy += ay * kick;
        car.dashT = Math.max(car.dashT, CHARGE_BOOST_MS);
        car.chargeCd = CHARGE_CD_MS;
        world.events.push({ kind: "charge", who: i, power: chargeRatio(car.charge) });
      }
      car.charge = 0;
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
    // 油渍:踩上去摩擦变小,刹车也刹不太住
    const oily = slickKeepAt(world.slicks, car.x, car.y, world.keep);
    const slippery = oily > world.keep;
    if (slippery) world.events.push({ kind: "slick", who: i });
    if (want.brake && car.skid <= 0) {
      const k = dampFactor(slippery ? Math.max(BRAKE_PER_SEC, oily * 0.75) : BRAKE_PER_SEC, dt);
      car.vx *= k;
      car.vy *= k;
    } else {
      const k = dampFactor(oily, dt);
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
    // 旋转盘:把车头带着转,再顺手给一点切向推力
    for (const sp of world.spinners) {
      const eff = spinnerEffect(sp, car.x, car.y, dt);
      if (eff.faceDelta === 0 && eff.ax === 0 && eff.ay === 0) continue;
      car.face += eff.faceDelta;
      car.vx += eff.ax * s;
      car.vy += eff.ay * s;
      world.events.push({ kind: "spinner", who: i });
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
      const bounce = clampRestitution(a.dashT > 0 || b.dashT > 0 ? DASH_BOUNCE : CAR_BOUNCE);
      const beforeA = { vx: a.vx, vy: a.vy };
      const beforeB = { vx: b.vx, vy: b.vy };
      const impact = resolveCollision(ba, bb, bounce);
      separate(ba, bb);
      writeBack(a, ba);
      writeBack(b, bb);
      if (impact <= 0) continue;
      ramPush(a, b);
      ramPush(b, a);
      if (driving[j]) creditShove(world, a, b, beforeA, beforeB);
      if (driving[i]) creditShove(world, b, a, beforeB, beforeA);
      if (impact >= SKID_MIN) {
        // 挨重撞的一方会打滑一小会儿,还要失控旋转 0.3 秒,这正是把对手顶出场的窗口
        a.skid = Math.max(a.skid, SKID_MS);
        b.skid = Math.max(b.skid, SKID_MS);
        startSpin(a, impact, 1);
        startSpin(b, impact, -1);
      }
      if (impact >= BUMP_MIN) {
        world.events.push({ kind: "bump", who: i, other: j, impact });
      }
      // 正在场边打转的车再被结结实实地「往外」顶一下,就真的下去了;
      // 轻轻蹭一下只是把它往外推一点,刚蹭回来的那点距离白费了。
      lipHit(world, i, impact);
      lipHit(world, j, impact);
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

  // ---- 边缘:弹簧墙弹回来,开放边先打转再决定去留 ----
  world.cars.forEach((car, i) => {
    if (!carActive(car)) return;
    const hit = boundaryHit(world.field, car.x, car.y, world.inset);
    if (hit.depth <= 0) {
      // 自己开回场内了:打转结束,工作人员不用出手
      if (car.teeter > 0) {
        car.teeter = 0;
        car.spin = 0;
        car.spinRate = 0;
        // 这一下算它自己救回来了:刚才那记推撞就此结清,之后再掉下去是另一回事
        car.lastPushBy = -1;
        world.events.push({ kind: "rescue", who: i });
      }
      return;
    }
    if (hit.spring) {
      // 推回场内,并把法线方向的速度反弹回去
      car.x += hit.nx * (hit.depth + 0.01);
      car.y += hit.ny * (hit.depth + 0.01);
      const vn = car.vx * hit.nx + car.vy * hit.ny;
      if (vn < 0) {
        const back = springBounce(vn);
        car.vx += (back - vn) * hit.nx;
        car.vy += (back - vn) * hit.ny;
        world.events.push({ kind: "wall", who: i, impact: Math.abs(vn) });
      }
      // 打转的时候蹭到护栏就是捡回一条命,别再让它继续倒计时
      if (car.teeter > 0) {
        car.teeter = 0;
        car.spin = 0;
        car.spinRate = 0;
        car.lastPushBy = -1;
        world.events.push({ kind: "rescue", who: i });
      }
      return;
    }
    if (car.teeter > 0) {
      // 打转期间被人一把推到整台车都悬空:这就是「再被撞出去」,不用等两秒了
      if (hit.depth >= DEEP_MARGIN) {
        dropCar(world, i);
        return;
      }
      // 第二段:两秒到了还没蹭回台面,车就滑出场外,工作人员小人把它推回来
      car.teeter = Math.max(0, car.teeter - dt);
      if (car.teeter === 0) dropCar(world, i);
      return;
    }
    // 车轮压线但重心还在台上:还没到打转那一步
    if (hit.depth < FALL_MARGIN) return;
    // 第一段:越过边缘不直接出局,先在台沿上打转两秒,这两秒里往场内打方向还救得回来。
    // 把它顶上台沿的那一下算到这里为止:打转这两秒不该把功劳的有效期耗光。
    if (car.lastPushBy >= 0) car.lastPushAt = world.time;
    car.teeter = TEETER_MS;
    car.teeters += 1;
    car.spin = TEETER_MS;
    car.spinRate = TEETER_TURNS_PER_SEC * Math.PI * 2;
    // 撞过来的那股劲全被台沿吃掉,接下来只剩一点点蹭回场里的力气
    car.vx = 0;
    car.vy = 0;
    world.events.push({ kind: "teeter", who: i });
  });
}

/**
 * 打转的车挨了一下之后怎么算。
 *
 * 这就是两段式淘汰的第二段:**再被撞出去才算出局**。
 * 只有「往场外」的那一下才作数,而且要撞得够结实(冲击 ≥ `LIP_KO_IMPACT`);
 * 蹭一下的小碰撞只是把它往台沿外推一点点,刚爬回来的距离白费了,人还有救。
 */
export function lipHit(world: World, index: number, impact: number): void {
  const car = world.cars[index];
  if (!car || car.teeter <= 0 || !carActive(car)) return;
  if (!pushedOutward(world, car)) return;
  if (impact >= LIP_KO_IMPACT) {
    dropCar(world, index);
    return;
  }
  const hit = boundaryHit(world.field, car.x, car.y, world.inset);
  const back = Math.min(LIP_SHOVE_MAX, impact * LIP_SHOVE);
  car.x -= hit.nx * back;
  car.y -= hit.ny * back;
}

/**
 * 这台车此刻是不是正被往场外推。
 *
 * 打转的车再挨一下要不要判出局,就看这一条:速度沿「指向场内的法线」是负的,
 * 说明这一撞把它往悬崖那边送;反过来把它顶回场里的那一撞算帮忙,不能判出局。
 */
export function pushedOutward(world: World, car: Car): boolean {
  const hit = boundaryHit(world.field, car.x, car.y, world.inset);
  if (hit.depth <= 0 || hit.spring) return false;
  return car.vx * hit.nx + car.vy * hit.ny < 0;
}

/**
 * 记一笔「谁把谁往悬崖顶了一下」——这就是「撞飞」的唯一入账口。
 *
 * 两件事要同时成立才留名(调用方还会先确认我这一帧真的在开车,不是被撞得满场飞):
 *  1. **这一下是我出的力**:撞上的那一刻我确实在朝它开(`SHOVE_DRIVE_MIN`)。
 *     停在原地被人一头撞上不算——那是它自己撞过来的。
 *  2. **真的把它往悬崖那边送了**:这一撞给它加的「朝最近那道悬崖去」的速度够 `SHOVE_MIN`。
 *     把它顶回场地里侧的那一撞是帮忙,不是功劳。
 *
 * 第 3 轮测试员抓到的「玩家一个键都没按,结算却写撞飞 1 台」正是这两条都不成立的局:
 * 车停在那儿一动不动,对手自己冲下了悬崖。
 */
export function creditShove(
  world: World,
  victim: Car,
  hitter: Car,
  before: { vx: number; vy: number },
  hitterBefore: { vx: number; vy: number }
): void {
  if (hitter.team === victim.team) return;
  const dx = victim.x - hitter.x;
  const dy = victim.y - hitter.y;
  const d = hypot(dx, dy);
  if (d < 0.001) return;
  const drive = (hitterBefore.vx * dx + hitterBefore.vy * dy) / d;
  if (drive < SHOVE_DRIVE_MIN) return;
  const cliff = openEdgeAt(world.field, victim.x, victim.y, world.inset);
  if (!cliff) return;
  const gain = (victim.vx - before.vx) * cliff.ox + (victim.vy - before.vy) * cliff.oy;
  if (gain < SHOVE_MIN) return;
  victim.lastPushBy = hitter.id;
  victim.lastPushAt = world.time;
}

/**
 * 「顶一把」:正在冲刺 / 蓄力的一方沿连心线额外推对方一下。
 * 推力按质量比缩放,重车顶不太动;不在冲刺状态就什么也不做。
 */
export function ramPush(attacker: Car, victim: Car): void {
  if (attacker.dashT <= 0) return;
  const dx = victim.x - attacker.x;
  const dy = victim.y - attacker.y;
  const d = hypot(dx, dy);
  if (d < 0.001) return;
  const k = DASH_RAM * Math.min(2, attacker.mass / victim.mass);
  victim.vx += (dx / d) * k;
  victim.vy += (dy / d) * k;
}

/** 挨了一记重撞:开始 0.3 秒失控旋转 */
export function startSpin(car: Car, impact: number, sign: 1 | -1): void {
  if (car.teeter > 0) return;
  car.spin = Math.max(car.spin, SPIN_MS);
  car.spinRate = spinRateFor(impact, sign);
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
  car.teeter = 0;
  car.spin = 0;
  car.spinRate = 0;
  car.charge = 0;
  let by = -1;
  if (car.lastPushBy >= 0 && world.time - car.lastPushAt <= CREDIT_MS) {
    const hitter = world.cars.find((c) => c.id === car.lastPushBy);
    if (hitter && hitter.team !== car.team) {
      hitter.score += 1;
      by = hitter.id;
    }
  }
  car.lastPushBy = -1;
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
 *
 * 还有一条底线:`knocked`(玩家亲手顶下去的台数)是 0 的那一局最多 1 星。
 * 对手全是自己开下悬崖的,这一关孩子什么都没做,星星就不能满上——
 * 星星是努力的凭证,不是坐在旁边等来的。
 */
export function rateLevel(secondsLeft: number, total: number, falls: number, knocked: number): 1 | 2 | 3 {
  const ratio = total > 0 ? secondsLeft / total : 0;
  if (knocked <= 0) return 1;
  if (falls === 0 && ratio >= 0.4) return 3;
  if (falls <= 1 && ratio >= 0.15) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// 文案(小学六年级读得懂;失败只鼓励,不批评)
// ---------------------------------------------------------------------------

/**
 * 闯关过关的播报。
 *
 * `knocked` 是**玩家亲手顶下去的台数**(`Car.score`),对手自己开下悬崖不算在里面。
 * 所以一台都没撞飞的时候不能写「撞飞 0 台」,更不能夸「走位和刹车配合得很好」——
 * 那是在表扬一件孩子根本没做过的事。这种局如实说是对手自己下的场,再给一句下次怎么做。
 */
export function winLine(secondsLeft: number, falls: number, knocked: number): string {
  if (knocked <= 0) {
    if (falls === 0) {
      return `对手自己开下了悬崖,你一台都没撞飞,还剩 ${secondsLeft} 秒。下一关主动迎上去,亲手把他们顶出场才算本事。`;
    }
    return `对手自己开下了悬崖,你一台都没撞飞,自己还掉下去 ${falls} 次。下一关先在场地中间站稳,再找机会顶人。`;
  }
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
