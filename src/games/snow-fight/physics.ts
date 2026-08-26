/**
 * 雪球大作战 · 抛物线与风偏(全是纯函数,没有任何状态)。
 *
 * 世界很小很好算:横着 60 个单位、地面在 y = 0、向上为正。
 * 雪球出手之后只受两件事影响——
 *  1. 重力:一直往下拉,所以轨迹是一条抛物线;
 *  2. 风:一个恒定的水平加速度,飞得越久被吹得越远(所以高抛比平抛更怕风)。
 *
 * 位置公式(t 是出手后经过的秒数):
 *   x(t) = x₀ + vx·t + ½·wind·t²
 *   y(t) = y₀ + vy·t − ½·g·t²
 */

export interface Vec {
  x: number;
  y: number;
}

/** 重力加速度(单位/秒²) */
export const GRAVITY = 22;
/** 蓄力 0 时的出手速度 */
export const MIN_SPEED = 10;
/**
 * 蓄力 100 时的出手速度。
 * 定这个数是为了让最远的靶子用七八成力就够得着——
 * 每一发都得拉满的话,蓄力条就没得选了,顶风的关还会直接变成死局。
 */
export const MAX_SPEED = 38;
/** 风的水平加速度上限(正数向右) */
export const MAX_WIND = 3;
/** 场地宽度 */
export const FIELD_W = 60;
/** 地面高度 */
export const GROUND_Y = 0;

/** 抛雪球的全部参数 */
export interface ThrowSpec {
  /** 出手点 */
  x: number;
  y: number;
  /** 仰角(度,0 = 平着扔,90 = 直上直下) */
  angle: number;
  /** 蓄力 0..100 */
  power: number;
  /** 面朝哪边:1 向右,-1 向左 */
  dir: 1 | -1;
  /** 风(正数向右) */
  wind: number;
}

export function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

/** 蓄力条读数 → 出手速度 */
export function throwSpeed(power: number): number {
  const p = clamp(power, 0, 100) / 100;
  return MIN_SPEED + (MAX_SPEED - MIN_SPEED) * p;
}

/** 出手速度 → 蓄力条读数(solvePower 的反函数) */
export function speedToPower(speed: number): number {
  const p = (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
  return clamp(p * 100, 0, 100);
}

/** 出手瞬间的水平 / 垂直速度 */
export function velocity(spec: ThrowSpec): Vec {
  const s = throwSpeed(spec.power);
  const rad = (clamp(spec.angle, 0, 90) * Math.PI) / 180;
  return { x: Math.cos(rad) * s * spec.dir, y: Math.sin(rad) * s };
}

/** 出手 t 秒后雪球在哪儿 */
export function positionAt(spec: ThrowSpec, t: number): Vec {
  const v = velocity(spec);
  return {
    x: spec.x + v.x * t + 0.5 * spec.wind * t * t,
    y: spec.y + v.y * t - 0.5 * GRAVITY * t * t,
  };
}

/**
 * 从出手到落地要飞几秒。风不改变飞行时间(它只推横向),
 * 所以这里只解一个一元二次方程。
 */
export function flightTime(spec: ThrowSpec, groundY: number = GROUND_Y): number {
  const v = velocity(spec);
  const h = spec.y - groundY;
  const disc = v.y * v.y + 2 * GRAVITY * h;
  if (disc <= 0) return 0;
  return (v.y + Math.sqrt(disc)) / GRAVITY;
}

/** 最高能飞多高 */
export function peakHeight(spec: ThrowSpec): number {
  const v = velocity(spec);
  return spec.y + (v.y * v.y) / (2 * GRAVITY);
}

/** 落地点的横坐标 */
export function landingX(spec: ThrowSpec, groundY: number = GROUND_Y): number {
  const t = flightTime(spec, groundY);
  const v = velocity(spec);
  return spec.x + v.x * t + 0.5 * spec.wind * t * t;
}

/**
 * 风把落点吹偏了多少(和「没有风」的同一发比)。
 * 结果的正负和风向一致,绝对值随飞行时间的平方长——这就是「飞得越久偏得越多」。
 */
export function windDrift(spec: ThrowSpec, groundY: number = GROUND_Y): number {
  const t = flightTime(spec, groundY);
  return 0.5 * spec.wind * t * t;
}

/** 采样一条轨迹,给画面描点用;到地面就停 */
export function trajectory(spec: ThrowSpec, groundY: number = GROUND_Y, step = 0.05): Vec[] {
  const total = flightTime(spec, groundY);
  const pts: Vec[] = [];
  for (let t = 0; t < total; t += step) pts.push(positionAt(spec, t));
  pts.push({ x: landingX(spec, groundY), y: groundY });
  return pts;
}

/**
 * 想让雪球落在 targetX,该用多大力?
 * 先按 1 的步长扫一遍找出跨过目标的那一段,再二分细调。
 * 扫一遍是为了稳:有风的时候「力度越大落点越远」并不总是成立。
 * 够不着就返回 null(该换个角度了)。
 */
export function solvePower(
  base: Omit<ThrowSpec, "power">,
  targetX: number,
  groundY: number = GROUND_Y
): number | null {
  const at = (power: number): number => landingX({ ...base, power }, groundY) - targetX;
  let lo = 0;
  let loV = at(0);
  if (Math.abs(loV) < 1e-6) return 0;
  for (let p = 1; p <= 100; p += 1) {
    const v = at(p);
    if (Math.abs(v) < 1e-6) return p;
    if (loV < 0 !== v < 0) {
      let a = lo;
      let b = p;
      let av = loV;
      for (let i = 0; i < 40; i++) {
        const mid = (a + b) / 2;
        const mv = at(mid);
        if (av < 0 === mv < 0) {
          a = mid;
          av = mv;
        } else {
          b = mid;
        }
      }
      return clamp((a + b) / 2, 0, 100);
    }
    lo = p;
    loV = v;
  }
  return null;
}

/** 这一发实际落在哪、离目标差多少(负数是没到,正数是过头,按面朝方向算) */
export function missBy(spec: ThrowSpec, targetX: number, groundY: number = GROUND_Y): number {
  return (landingX(spec, groundY) - targetX) * spec.dir;
}

// ---------------------------------------------------------------------------
// 风的说明文字
// ---------------------------------------------------------------------------

/** 风力分档:0 无风,1 微风,2 有点风,3 大风 */
export function windLevel(wind: number): 0 | 1 | 2 | 3 {
  const a = Math.abs(wind);
  if (a < 0.25) return 0;
  if (a < 1.1) return 1;
  if (a < 2.1) return 2;
  return 3;
}

/** 风标上的文字,比如「→ 大风」 */
export function windLabel(wind: number): string {
  const level = windLevel(wind);
  if (level === 0) return "无风";
  const arrow = wind > 0 ? "→" : "←";
  const word = level === 1 ? "微风" : level === 2 ? "有点风" : "大风";
  return `${arrow} ${word}`;
}

/** 风标箭头画多长(0..1) */
export function windBarLength(wind: number): number {
  return clamp(Math.abs(wind) / MAX_WIND, 0, 1);
}

// ---------------------------------------------------------------------------
// 人机对战:三档 AI 的瞄准
// ---------------------------------------------------------------------------

export type AiLevel = "easy" | "normal" | "hard";

export interface AiProfile {
  name: string;
  /** 会不会把风算进去 */
  readsWind: boolean;
  /** 力度上的随机偏差(比例) */
  jitter: number;
  /** 仰角上的随机偏差(度) */
  angleJitter: number;
  desc: string;
}

export const AI_PROFILES: Record<AiLevel, AiProfile> = {
  easy: {
    name: "雪团初学者",
    readsWind: false,
    jitter: 0.16,
    angleJitter: 7,
    desc: "还不会看风,力度也常常拿不准。",
  },
  normal: {
    name: "雪球好手",
    readsWind: false,
    jitter: 0.05,
    angleJitter: 2.5,
    desc: "力度很准,可惜忘了看风标。",
  },
  hard: {
    name: "风向大师",
    readsWind: true,
    jitter: 0.015,
    angleJitter: 0.8,
    desc: "出手前一定先算风偏,很难骗到它。",
  },
};

export interface AiAim {
  angle: number;
  power: number;
}

/**
 * AI 怎么瞄:先挑一个仰角,再解出力度。
 * 高档会把真实风代进去算(所以风偏被抵消掉);
 * 中低档按「没有风」算,风多大就偏多少,再叠一点手抖。
 */
export function aiAim(
  level: AiLevel,
  from: { x: number; y: number; dir: 1 | -1 },
  targetX: number,
  wind: number,
  rand: () => number,
  groundY: number = GROUND_Y
): AiAim {
  const profile = AI_PROFILES[level];
  const angle = clamp(45 + (rand() * 2 - 1) * profile.angleJitter, 15, 75);
  const base = { x: from.x, y: from.y, dir: from.dir, angle };
  const assumedWind = profile.readsWind ? wind : 0;
  const solved = solvePower({ ...base, wind: assumedWind }, targetX, groundY);
  const power = solved ?? 70;
  const noise = (rand() * 2 - 1) * profile.jitter;
  return { angle, power: clamp(power * (1 + noise), 5, 100) };
}
