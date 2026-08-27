// 彩虹跑跑 · 手感常量与 delta time 积分(1.2 第 9 步新增)
//
// 1.1 的 view3d.ts 已经把「换道插值」「镜头跟随」做成了帧率无关的指数逼近,
// 但跳跃还是靠一条 sin 曲线扫 actionTimer,速度也只是每帧乘一下。
// 这里把三样东西收进同一个文件、写成纯函数,好单独量:
//
//   · 换道横向插值走完要多久(规格:80–120ms);
//   · 跳跃按初速与重力积分,不按帧步进;
//   · 一段路跑下来的位移只跟真实时间有关,30fps 与 60fps 的差要小于 2%。
//
// 跳跃的初速与重力不是新拍的数,是从 1.1 已有的 JUMP_TIME(滞空 0.55 秒)
// 与渲染层那条 70 像素高的抛物线**反推**出来的——换了积分写法,
// 滞空时长与最高点一个像素都没动,188 关的判定窗口自然也没挪。

import { JUMP_TIME, SLIDE_TIME } from "./logic";
import { smoothing } from "./view3d";

/* ------------------------------------------------------------------ */
/* 换道                                                                */
/* ------------------------------------------------------------------ */

/** 换道横向插值走完要多久(秒)。 */
export const LANE_GLIDE = 0.1;
/** 规格给的窗口:低于这个太滑没有重量,高于这个就开始「跟不上手」。 */
export const LANE_GLIDE_MIN = 0.08;
export const LANE_GLIDE_MAX = 0.12;

/** 剩这么点残差就算走到位了(指数逼近永远到不了终点,得给个口径)。 */
export const GLIDE_RESIDUAL = 0.1;

/**
 * 指数逼近的速率:让 LANE_GLIDE 秒之后正好只剩 GLIDE_RESIDUAL 的残差。
 * 因为走的还是 `smoothing()`,连着两个 dt/2 和一次 dt 的结果完全一样,
 * 60fps 与 30fps 换到同一条道上的时间是同一个数。
 */
export const LANE_RATE = -Math.log(GLIDE_RESIDUAL) / LANE_GLIDE;

/** 换道这一帧挪到哪:贴到终点附近就直接吸过去,免得永远差一丝。 */
export function glideLane(current: number, target: number, dt: number): number {
  if (!(dt > 0)) return current;
  const next = current + (target - current) * smoothing(dt, LANE_RATE);
  return Math.abs(target - next) < 0.002 ? target : next;
}

/** 从 from 换到 to,走完 (1 - GLIDE_RESIDUAL) 那段要多少秒。 */
export function laneGlideSeconds(): number {
  return LANE_GLIDE;
}

/** 换道时身体侧倾多少弧度;reduced-motion 下取消倾斜,位移照走。 */
export const MAX_TILT = 0.17;

export function tiltFor(laneFloat: number, target: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const lag = Math.max(-1, Math.min(1, target - laneFloat));
  return lag * MAX_TILT;
}

/* ------------------------------------------------------------------ */
/* 跳跃:初速 + 重力                                                   */
/* ------------------------------------------------------------------ */

/** 跳到最高点时离地多少像素(沿用 1.1 渲染层那条抛物线的高度)。 */
export const JUMP_RISE = 70;
/** 起跳初速(像素/秒):由「滞空 JUMP_TIME 秒、最高 JUMP_RISE 像素」反推。 */
export const JUMP_SPEED = (4 * JUMP_RISE) / JUMP_TIME;
/** 重力(像素/秒²):同一组条件反推,保证 2·v0/g 正好等于 JUMP_TIME。 */
export const GRAVITY = (8 * JUMP_RISE) / (JUMP_TIME * JUMP_TIME);

/**
 * 下滑锁定:贴地这么久之后就能被跳跃打断。
 * 比一次跳跃短得多,所以「先滑过低梁、马上跳过下一道栏」是接得上的。
 */
export const SLIDE_LOCK = 0.22;

export function slideCanCancel(elapsed: number): boolean {
  return elapsed >= SLIDE_LOCK;
}

export interface JumpBody {
  /** 离地高度(像素),贴地时是 0 */
  lift: number;
  /** 竖直速度(像素/秒),往上为正 */
  vy: number;
  airborne: boolean;
}

export function groundedBody(): JumpBody {
  return { lift: 0, vy: 0, airborne: false };
}

export function launchBody(): JumpBody {
  return { lift: 0, vy: JUMP_SPEED, airborne: true };
}

/**
 * 推进一帧。落地那一帧把高度归零——不然 dt 大一点就会陷进地里,
 * 而 30fps 与 60fps 的落地时刻会差出一整帧。
 */
export function stepJump(body: JumpBody, dt: number): JumpBody {
  if (!body.airborne || !(dt > 0)) return body;
  const vy = body.vy - GRAVITY * dt;
  const lift = body.lift + (body.vy + vy) * 0.5 * dt;
  if (lift <= 0) return groundedBody();
  return { lift, vy, airborne: true };
}

/** 收藏册的弹跳加成只抬高画面上的高度,不动滞空时长(动了就等于改判定窗口)。 */
export function renderLift(body: JumpBody, riseMul: number): number {
  return body.lift * Math.max(0.5, Math.min(2, riseMul));
}

/** 脚下那块扁圆影子:跳得越高越小越淡。 */
export function shadowScale(lift: number): number {
  const t = Math.max(0, Math.min(1, lift / (JUMP_RISE * 1.6)));
  return 1 - t * 0.62;
}

/* ------------------------------------------------------------------ */
/* 位移:只跟真实时间有关                                              */
/* ------------------------------------------------------------------ */

export function stepDistance(dist: number, speed: number, dt: number): number {
  return dist + speed * Math.max(0, dt);
}

export interface StretchOptions {
  /** 一帧多久(秒) */
  dt: number;
  /** 一共跑多少秒 */
  seconds: number;
  /** 当前跑了 dist 之后的速度 */
  speedAt: (dist: number) => number;
  /** 每隔多久起一次跳;不给就一路平跑 */
  jumpEvery?: number;
}

export interface StretchResult {
  dist: number;
  jumps: number;
  /** 一共在空中待了多久 */
  airSeconds: number;
  /** 这一趟跳到过的最高点 */
  peakLift: number;
}

/**
 * 拿同一段路跑一遍:速度、重力、跳跃全按 dt 积分。
 * 用同样的 seconds、不同的 dt 跑两次,位移差应当小到看不出来——
 * 这就是「30fps 与 60fps 手感一致」那条断言量的东西。
 */
export function runStretch(opts: StretchOptions): StretchResult {
  const dt = Math.max(1e-6, opts.dt);
  const steps = Math.round(opts.seconds / dt);
  const every = opts.jumpEvery && opts.jumpEvery > 0 ? opts.jumpEvery : Infinity;
  let dist = 0;
  let body = groundedBody();
  let jumps = 0;
  let airSeconds = 0;
  let peakLift = 0;
  let sinceJump = every;
  for (let i = 0; i < steps; i++) {
    sinceJump += dt;
    if (!body.airborne && sinceJump >= every) {
      sinceJump = 0;
      body = launchBody();
      jumps++;
    }
    body = stepJump(body, dt);
    if (body.airborne) airSeconds += dt;
    if (body.lift > peakLift) peakLift = body.lift;
    dist = stepDistance(dist, opts.speedAt(dist), dt);
  }
  return { dist, jumps, airSeconds, peakLift };
}

/** 两趟跑的相对位移差(0.02 就是差 2%)。 */
export function relativeGap(a: number, b: number): number {
  const base = Math.max(Math.abs(a), Math.abs(b));
  return base === 0 ? 0 : Math.abs(a - b) / base;
}

/** 位移差的验收线:30fps 与 60fps 跑同一段路,差得超过这个就算手感漂了。 */
export const FRAMERATE_TOLERANCE = 0.02;

/** 下滑锁定必须短于一次跳跃,不然滑完就错过下一拍。 */
export const SLIDE_SHORTER_THAN_JUMP = SLIDE_LOCK < JUMP_TIME && SLIDE_LOCK < SLIDE_TIME;
