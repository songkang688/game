/**
 * 雪球大作战 1.2 · 投掷物理(纯函数,没有任何状态,也不碰 DOM)。
 *
 * 和 1.1 的 `physics.ts` 分工不同:那一份是回合制炮击用的**解析式**抛物线
 * (一条公式直接算落点,没有空气阻力),现在仍旧留着给关卡数据体检用。
 * 这一份是实时玩法用的**定步长积分**:
 *
 *   ax = −k · (vx − wind)        雪球又轻又毛,横向被空气拽着追风速
 *   ay = −k · vy − g             竖向除了重力还要被空气拖一把
 *   v += a·dt;  p += v·dt        半隐式欧拉,固定 1/120 秒一步
 *
 * 固定步长的好处是「同样的输入永远得到同样的落点」——落点圈敢画,用例才敢断言。
 *
 * 蓄力曲线:按住 0–1.2 秒,先慢后快地把初速从 13 拉到 36。
 * 用 `r·(0.55+0.45r)` 而不是直线,是为了让「轻轻一点」和「按满」都有用:
 * 前半段每 0.1 秒只多一点点力,近处的靶子好微调;后半段涨得快,够得着场地对面。
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** 一步积分多久(秒)。整个 1.2 的实时玩法都按这个步长推,同种子必然同结果 */
export const STEP_12 = 1 / 120;
/** 重力加速度(单位/秒²) */
export const GRAVITY_12 = 24;
/**
 * 空气阻力系数(1/秒):a_drag = −k·(v − 风速)。
 * 0.5 是量出来的:满力平抛飞两秒,三级风把落点吹偏两格出头——
 * 看得见、能靠经验修正,又不会大到让人放弃瞄准。
 */
export const AIR_DRAG = 0.5;
/** 蓄力满档要按住多久(秒) */
export const CHARGE_MAX = 1.2;
/** 蓄力 0(点一下就松)的出手速度 */
export const SPEED_MIN = 14;
/** 蓄力按满的出手速度。够把雪球从场地这头扔到那头,但要按满才行 */
export const SPEED_MAX = 42;
/** 雪球半径 */
export const BALL_R_12 = 0.5;
/** 地面高度 */
export const GROUND_Y_12 = 0;
/** 出手仰角的上下限(度) */
export const ANGLE_MIN_12 = 8;
export const ANGLE_MAX_12 = 82;
/** 风速上限(单位/秒,正数向右) */
export const WIND_MAX_12 = 3;

/** 落点圈最小半径:再近的一发也有这么一点点不确定 */
export const LAND_R_MIN = 0.8;
/** 落点圈每多飞一秒就多这么大(远的那一发圈更大、画得更虚) */
export const LAND_R_PER_SEC = 0.55;
/** 满蓄力时出手方向的抖动(度)。近距离轻投只有三成 */
export const SPREAD_DEG = 1.5;

export function clamp12(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

/** 按住多久 → 0..1 的蓄力读数 */
export function chargeRatio(heldSeconds: number): number {
  return clamp12(heldSeconds, 0, CHARGE_MAX) / CHARGE_MAX;
}

/** 蓄力读数 → 力度曲线(先慢后快,严格单调) */
export function chargeCurve(ratio: number): number {
  const r = clamp12(ratio, 0, 1);
  return r * (0.55 + 0.45 * r);
}

/** 按住多久 → 出手速度 */
export function chargeSpeed(heldSeconds: number): number {
  return SPEED_MIN + (SPEED_MAX - SPEED_MIN) * chargeCurve(chargeRatio(heldSeconds));
}

/** 一次投掷要交代的全部事情 */
export interface Throw12 {
  /** 出手点 */
  x: number;
  y: number;
  /** 仰角(度) */
  angle: number;
  /** 面朝哪边:1 向右,-1 向左 */
  dir: 1 | -1;
  /** 按住了多久(秒) */
  charge: number;
}

export interface Ball12 extends Vec2 {
  vx: number;
  vy: number;
}

/** 出手瞬间的雪球 */
export function launch(spec: Throw12): Ball12 {
  const speed = chargeSpeed(spec.charge);
  const rad = (clamp12(spec.angle, ANGLE_MIN_12, ANGLE_MAX_12) * Math.PI) / 180;
  return {
    x: spec.x,
    y: spec.y,
    vx: Math.cos(rad) * speed * spec.dir,
    vy: Math.sin(rad) * speed,
  };
}

/** 往前推一步(半隐式欧拉:先更新速度再更新位置,能量不会自己长出来) */
export function stepBall(ball: Ball12, dt: number, wind: number): Ball12 {
  const ax = -AIR_DRAG * (ball.vx - wind);
  const ay = -AIR_DRAG * ball.vy - GRAVITY_12;
  const vx = ball.vx + ax * dt;
  const vy = ball.vy + ay * dt;
  return { vx, vy, x: ball.x + vx * dt, y: ball.y + vy * dt };
}

export interface FlightResult {
  /** 落地点 */
  x: number;
  y: number;
  /** 飞了几秒 */
  t: number;
  /** 最高飞到多高 */
  apex: number;
  /** 采样出来的轨迹(给画面描点用) */
  points: Vec2[];
}

export interface FlightOpts {
  wind?: number;
  groundY?: number;
  /** 最多飞几秒(兜底,免得顶着大风一直飘) */
  maxT?: number;
  /** 每隔几步记一个点 */
  sampleEvery?: number;
}

/** 让一发雪球一路飞到落地,报告落点、飞行时间与轨迹 */
export function flight(spec: Throw12, opts: FlightOpts = {}): FlightResult {
  const wind = opts.wind ?? 0;
  const groundY = opts.groundY ?? GROUND_Y_12;
  const maxT = opts.maxT ?? 8;
  const every = Math.max(1, Math.round(opts.sampleEvery ?? 3));
  let ball: Ball12 = { x: spec.x, y: spec.y, vx: 0, vy: 0 };
  const first = launch(spec);
  ball = first;
  const points: Vec2[] = [{ x: ball.x, y: ball.y }];
  let apex = ball.y;
  let t = 0;
  for (let i = 1; t < maxT; i++) {
    const next = stepBall(ball, STEP_12, wind);
    t += STEP_12;
    if (next.y > apex) apex = next.y;
    // 只认「往下掉的时候穿过这条线」:瞄高处的靶子时出手点常常比目标还低,
    // 不看方向就会在出手第一帧判成「已经落地」,解力度那一层立刻算出「够不着」。
    if (next.y <= groundY && next.vy < 0) {
      // 落地那一步按直线插值补一下,落点才不会随步长跳来跳去
      const span = ball.y - next.y;
      const k = span > 1e-9 ? (ball.y - groundY) / span : 0;
      const hit = { x: ball.x + (next.x - ball.x) * k, y: groundY };
      points.push(hit);
      return { x: hit.x, y: groundY, t: t - STEP_12 * (1 - k), apex, points };
    }
    ball = next;
    if (i % every === 0) points.push({ x: ball.x, y: ball.y });
  }
  return { x: ball.x, y: ball.y, t, apex, points };
}

/** 这一发会落在哪儿(只要落点,不要轨迹) */
export function predictLanding(spec: Throw12, wind = 0, groundY = GROUND_Y_12): { x: number; t: number } {
  const f = flight(spec, { wind, groundY, sampleEvery: 1e9 });
  return { x: f.x, t: f.t };
}

/**
 * 出手方向的抖动(度)。
 * 轻投几乎不抖,按满力才明显——「用力过猛就没那么准」是这一层想教的事。
 */
export function releaseSpread(spec: Throw12): number {
  const r = chargeRatio(spec.charge);
  return SPREAD_DEG * (0.35 + 0.65 * r);
}

/** 把抖动加到出手角上。`u` 是 −1..1 的随机数,0 就是完全不抖 */
export function applySpread(spec: Throw12, u: number): Throw12 {
  const jitter = releaseSpread(spec) * clamp12(u, -1, 1);
  return { ...spec, angle: clamp12(spec.angle + jitter, ANGLE_MIN_12, ANGLE_MAX_12) };
}

export interface LandingCircle {
  /** 圆心(不抖的那一发落在哪儿) */
  x: number;
  /** 半径:抖到两个极端时落点能差出多远,至少 LAND_R_MIN */
  r: number;
  /** 0..1 的模糊度,画面上照着它把圈画虚。越远越模糊 */
  blur: number;
  /** 飞行时间,画面拿它决定圈要不要闪 */
  t: number;
}

/**
 * 落点圈:圆心是「手不抖」的落点,半径按飞行时间放大。
 *
 * 半径同时受两条约束,取大的那个:
 *  1. `LAND_R_MIN + 飞行秒数 × LAND_R_PER_SEC` —— 飞得越久越没底,圈越大越虚;
 *  2. 出手抖动抖到两个极端时落点的最大跨度 —— 保证**真实落点一定在圈里**
 *     (throw12.test.ts 拿一整片参数扫过一遍验这件事)。
 * 所以这个圈不是画着好看的装饰,它是一句能兑现的承诺。
 */
export function landingCircle(spec: Throw12, wind = 0, groundY = GROUND_Y_12): LandingCircle {
  const mid = predictLanding(spec, wind, groundY);
  const hi = predictLanding(applySpread(spec, 1), wind, groundY);
  const lo = predictLanding(applySpread(spec, -1), wind, groundY);
  const span = Math.max(Math.abs(hi.x - mid.x), Math.abs(lo.x - mid.x));
  const r = Math.max(LAND_R_MIN + mid.t * LAND_R_PER_SEC, span * 1.15);
  return { x: mid.x, r, blur: clamp12((r - LAND_R_MIN) / 1.6, 0, 1), t: mid.t };
}

/**
 * 想让雪球落在 targetX,该按住多久?
 *
 * 有风有阻力的时候「按得越久落得越远」并不总是成立(顶大风的高抛会被吹回来),
 * 所以先按 0.05 秒的步长扫一遍找出跨过目标的那一段,再二分细调。够不着就返回 null。
 */
export function solveCharge(
  base: Omit<Throw12, "charge">,
  targetX: number,
  wind = 0,
  groundY = GROUND_Y_12
): number | null {
  const at = (charge: number): number => (predictLanding({ ...base, charge }, wind, groundY).x - targetX) * base.dir;
  let lo = 0;
  let loV = at(0);
  if (Math.abs(loV) < 1e-3) return 0;
  for (let c = 0.05; c <= CHARGE_MAX + 1e-9; c += 0.05) {
    const v = at(c);
    if (loV < 0 !== v < 0) {
      let a = lo;
      let b = c;
      let av = loV;
      for (let i = 0; i < 24; i++) {
        const mid = (a + b) / 2;
        const mv = at(mid);
        if (av < 0 === mv < 0) {
          a = mid;
          av = mv;
        } else {
          b = mid;
        }
      }
      return clamp12((a + b) / 2, 0, CHARGE_MAX);
    }
    lo = c;
    loV = v;
  }
  return null;
}

/**
 * 想砸中 (targetX, targetY),挑哪个仰角、按多久?
 * 从顺手的平抛一路往上试,第一个「落点对得上、而且飞过去的时候不会低于目标高度」的就用。
 */
export function aimAt12(
  from: { x: number; y: number; dir: 1 | -1 },
  target: Vec2,
  wind = 0,
  angles: readonly number[] = [30, 38, 46, 54, 62, 70, 76]
): { angle: number; charge: number } | null {
  for (const angle of angles) {
    const charge = solveCharge({ ...from, angle }, target.x, wind, target.y);
    if (charge === null) continue;
    return { angle, charge };
  }
  return null;
}

/** 风标上的文字,比如「→ 大风」 */
export function windWord(wind: number): string {
  const a = Math.abs(wind);
  if (a < 0.25) return "无风";
  const arrow = wind > 0 ? "→" : "←";
  return `${arrow} ${a < 1.1 ? "微风" : a < 2.1 ? "有点风" : "大风"}`;
}
