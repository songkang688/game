// 冒险小王:横版探索闯关的纯逻辑层。
//
// 这里只放「不碰 DOM、不碰画布」的数学:跑跳重力、抓钩能不能够到、荡绳单摆、
// 回旋镖轨迹、评星与计时纪录。index.ts 每一帧都调用它们,单测也直接测它们。

/** 重力加速度(像素/秒²) */
export const GRAVITY = 1500;
/** 下落速度封顶,免得掉太快穿过平台 */
export const MAX_FALL = 900;
/** 跑动最高速度 */
export const RUN_MAX = 250;
/** 起跳初速度(向上为负) */
export const JUMP_V = 580;
/** 抓钩最远能够到的距离 */
export const ROPE_MAX = 230;
/**
 * 荡绳阻尼:每秒衰减的比例。
 * 故意压得很小——荡一个来回只吃掉几个百分点的力气,
 * 这样「跑过去挂上藤环、顺势荡到对岸」对小朋友来说是稳的。
 */
export const SWING_DAMPING = 0.06;
/** 回旋镖一次来回的时间(秒) */
export const BOOMERANG_SEC = 1.1;
/** 回旋镖最远飞出去多远 */
export const BOOMERANG_RANGE = 260;

export function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

/** 两点距离 */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

// ---------------------------------------------------------------------------
// 跑与跳
// ---------------------------------------------------------------------------

/** 竖直速度积分一帧(向下为正),下落速度有封顶 */
export function fallStep(vy: number, dt: number, gravity: number = GRAVITY): number {
  return Math.min(MAX_FALL, vy + gravity * dt);
}

/**
 * 水平速度积分一帧:按住方向就加速到上限,松手按摩擦力减速到 0。
 * dir 只取 -1 / 0 / 1。
 */
export function runStep(vx: number, dir: number, dt: number, accel = 2200, friction = 2600): number {
  if (dir > 0) return Math.min(RUN_MAX, vx + accel * dt);
  if (dir < 0) return Math.max(-RUN_MAX, vx - accel * dt);
  if (vx > 0) return Math.max(0, vx - friction * dt);
  if (vx < 0) return Math.min(0, vx + friction * dt);
  return 0;
}

/** 一次满速起跳能水平跨过多远(关卡生成器用它保证每个坑都跳得过去) */
export function jumpDistance(runSpeed: number = RUN_MAX, jumpV: number = JUMP_V, gravity: number = GRAVITY): number {
  return runSpeed * ((2 * jumpV) / gravity);
}

/** 平台巡逻的小怪:走到边界就掉头 */
export function patrolStep(
  x: number,
  dir: number,
  dt: number,
  speed: number,
  from: number,
  to: number
): { x: number; dir: number } {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  let nx = x + dir * speed * dt;
  let nd = dir;
  if (nx <= lo) {
    nx = lo;
    nd = 1;
  } else if (nx >= hi) {
    nx = hi;
    nd = -1;
  }
  return { x: nx, dir: nd };
}

// ---------------------------------------------------------------------------
// 抓钩:能不能够到 + 挑一个锚点
// ---------------------------------------------------------------------------

export interface Anchor {
  x: number;
  y: number;
}

/**
 * 抓钩能不能挂上这个锚点:
 * 1) 直线距离不超过绳长;
 * 2) 锚点必须在人的上方(至少高出 20 像素,不然荡不起来);
 * 3) 锚点必须在朝向的前方或正上方(facing = 1 向右、-1 向左)。
 */
export function canGrab(
  px: number,
  py: number,
  ax: number,
  ay: number,
  maxLen: number = ROPE_MAX,
  facing = 1
): boolean {
  if (ay > py - 20) return false;
  if (dist(px, py, ax, ay) > maxLen) return false;
  const dx = ax - px;
  if (Math.abs(dx) < 12) return true;
  return facing >= 0 ? dx > 0 : dx < 0;
}

/** 从锚点表里挑一个最近的可用锚点;都够不到返回 -1 */
export function pickAnchor(
  anchors: readonly Anchor[],
  px: number,
  py: number,
  maxLen: number = ROPE_MAX,
  facing = 1
): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    if (!canGrab(px, py, a.x, a.y, maxLen, facing)) continue;
    const d = dist(px, py, a.x, a.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 荡绳:标准单摆(角度以锚点正下方为 0,向右为正)
// ---------------------------------------------------------------------------

export interface SwingState {
  angle: number;
  angVel: number;
}

/** 挂上锚点那一刻的绳长 */
export function ropeLength(px: number, py: number, ax: number, ay: number): number {
  return Math.max(1, dist(px, py, ax, ay));
}

/** 挂上锚点那一刻的绳子角度(弧度,0 = 正下方,向右为正) */
export function ropeAngle(px: number, py: number, ax: number, ay: number): number {
  return Math.atan2(px - ax, py - ay);
}

/** 把当前速度换算成刚挂上时的角速度(只有切向分量能转成转动) */
export function initialAngVel(angle: number, len: number, vx: number, vy: number): number {
  const tangential = vx * Math.cos(angle) - vy * Math.sin(angle);
  return tangential / Math.max(1, len);
}

/**
 * 单摆一步:角加速度 = -(g / L)·sinθ,再乘一点阻尼。
 * 纯函数,给进什么状态就返回什么状态,方便单测逐帧比对。
 */
export function swingStep(
  state: SwingState,
  len: number,
  dt: number,
  gravity: number = GRAVITY,
  damping: number = SWING_DAMPING
): SwingState {
  const L = Math.max(1, len);
  const acc = -(gravity / L) * Math.sin(state.angle);
  const angVel = (state.angVel + acc * dt) * Math.max(0, 1 - damping * dt);
  return { angle: state.angle + angVel * dt, angVel };
}

/** 摆到某个角度时,人挂在哪儿 */
export function swingPoint(ax: number, ay: number, len: number, angle: number): { x: number; y: number } {
  return { x: ax + Math.sin(angle) * len, y: ay + Math.cos(angle) * len };
}

/** 松手那一刻的速度:沿切线方向甩出去 */
export function releaseVelocity(angle: number, angVel: number, len: number): { vx: number; vy: number } {
  const v = angVel * len;
  return { vx: v * Math.cos(angle), vy: -v * Math.sin(angle) };
}

/**
 * 从静止、绳长 len、起始角 startAngle 荡到最低点时的水平速度大小。
 * 能量守恒:½v² = g·L·(1 − cosθ)。关卡生成器用它判断「这个坑荡得过去吗」。
 */
export function swingBottomSpeed(len: number, startAngle: number, gravity: number = GRAVITY): number {
  const h = len * (1 - Math.cos(startAngle));
  return Math.sqrt(Math.max(0, 2 * gravity * h));
}

/**
 * 在最低点松手后能飞多远(把它当平抛,落回同一高度前的水平距离)。
 * 只做粗估,给关卡生成器留安全余量用。
 */
export function swingReach(len: number, startAngle: number, dropHeight = 60, gravity: number = GRAVITY): number {
  const v = swingBottomSpeed(len, startAngle, gravity);
  const t = Math.sqrt(Math.max(0, (2 * dropHeight) / gravity));
  return v * t;
}

// ---------------------------------------------------------------------------
// 回旋镖:飞出去再飞回手里
// ---------------------------------------------------------------------------

/** 回旋镖打到守卫的判定半径 */
export const BOOMERANG_HIT = 34;

/**
 * 出手 t 秒后回旋镖相对出手点的位移。
 * x 走一个正弦:t=0 在手里,t=一半飞到最远,t=BOOMERANG_SEC 正好回到手里;
 * y 走一个很浅的弧线,只是让它看起来在空中兜了一圈——
 * 弧度故意压到判定半径以内,免得「明明扔过去了却从头顶飞过」。
 */
export function boomerangOffset(
  t: number,
  dir: number,
  range: number = BOOMERANG_RANGE,
  flightSec: number = BOOMERANG_SEC
): { x: number; y: number } {
  const k = clamp(t / Math.max(0.001, flightSec), 0, 1);
  return {
    x: (dir >= 0 ? 1 : -1) * range * Math.sin(Math.PI * k),
    y: -Math.sin(Math.PI * 2 * k) * range * 0.05,
  };
}

/** 回旋镖飞完一圈了吗 */
export function boomerangDone(t: number, flightSec: number = BOOMERANG_SEC): boolean {
  return t >= flightSec;
}

// ---------------------------------------------------------------------------
// 碰撞
// ---------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/**
 * 从上往下落到平台上的判定:上一帧脚底在平台面之上、这一帧到了平台面之下,
 * 并且水平方向压在平台上。返回 true 表示应该踩住。
 */
export function landsOn(
  prevFootY: number,
  footY: number,
  vy: number,
  left: number,
  right: number,
  plat: { x: number; y: number; w: number }
): boolean {
  if (vy < 0) return false;
  if (prevFootY > plat.y + 1) return false;
  if (footY < plat.y) return false;
  return right > plat.x && left < plat.x + plat.w;
}

// ---------------------------------------------------------------------------
// 评星、计时与无尽层
// ---------------------------------------------------------------------------

/** 闯关评星:三件神器全收且一次都没受伤 = 3 星;神器齐了 = 2 星;其余 1 星 */
export function levelStars(artifacts: number, hurts: number): 1 | 2 | 3 {
  if (artifacts >= 3 && hurts === 0) return 3;
  if (artifacts >= 3) return 2;
  return 1;
}

/** 速通评星:比目标时间快得多 = 3 星,快一点 = 2 星,超时 = 1 星 */
export function timeAttackStars(sec: number, par: number): 1 | 2 | 3 {
  if (sec <= par * 0.75) return 3;
  if (sec <= par) return 2;
  return 1;
}

/** 把毫秒排版成「12.34 秒」 */
export function formatTime(ms: number): string {
  const safe = Math.max(0, Number.isFinite(ms) ? ms : 0);
  return `${(safe / 1000).toFixed(2)} 秒`;
}

/** 速通纪录:0 表示还没有纪录,越小越好 */
export function betterTime(prev: number, next: number): number {
  if (!Number.isFinite(next) || next <= 0) return prev;
  if (!Number.isFinite(prev) || prev <= 0) return next;
  return Math.min(prev, next);
}

export function isNewTimeRecord(prev: number, next: number): boolean {
  if (!Number.isFinite(next) || next <= 0) return false;
  return !Number.isFinite(prev) || prev <= 0 || next < prev;
}

/** 速通纪录存档 key(带 yiduo-yixing. 前缀,家长面板导出备份时会一起带上) */
export const SPEEDRUN_KEY = "yiduo-yixing.adventure-king.speedrun.v1";

/** 把存档里的速通纪录整理成定长数组(毫秒,0 = 还没跑过);坏数据一律当没跑过 */
export function parseBestTimes(raw: string | null, count: number): number[] {
  const out = new Array<number>(Math.max(0, count)).fill(0);
  if (!raw) return out;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return out;
    for (let i = 0; i < out.length && i < parsed.length; i++) {
      const v: unknown = parsed[i];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) out[i] = Math.round(v);
    }
  } catch {
    // 数据坏了就当没跑过
  }
  return out;
}

export function serializeBestTimes(times: readonly number[]): string {
  return JSON.stringify(times.map((t) => (Number.isFinite(t) && t > 0 ? Math.round(t) : 0)));
}

export interface FloorConfig {
  /** 这一层有几段平台 */
  platforms: number;
  /** 最宽的坑 */
  gapMax: number;
  /** 小怪数量 */
  enemies: number;
  /** 绳长 */
  ropeLen: number;
  /** 限时(秒),0 表示不限时 */
  timeSec: number;
}

/** 无尽遗迹第 floor 层(1 基)的难度:越往下越长、坑越宽、怪越多,但都有封顶 */
export function endlessFloor(floor: number): FloorConfig {
  const f = Math.max(1, Math.round(floor));
  return {
    platforms: Math.min(12, 4 + Math.floor(f / 2)),
    gapMax: Math.min(300, 130 + f * 12),
    enemies: Math.min(7, Math.floor((f - 1) / 2)),
    ropeLen: ROPE_MAX,
    timeSec: 0,
  };
}

/** 无尽遗迹的层名:每 4 层换一种石壁颜色,读起来有「越走越深」的感觉 */
export function endlessFloorTitle(floor: number): string {
  const names = ["苔痕层", "石纹层", "沙砾层", "冰晶层", "星尘层"];
  const f = Math.max(1, Math.round(floor));
  return `第 ${f} 层 · ${names[Math.floor((f - 1) / 4) % names.length]}`;
}
