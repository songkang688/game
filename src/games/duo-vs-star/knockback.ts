/**
 * 鸭梨大战康康 · 击退与弹飞的全部纯函数。
 *
 * 这一款比的不是谁更抗打：被拍中只会让「击退值」往上涨，击退值越高，
 * 下一次被拍中就飞得越远；把对手撞出场地四周的弹飞线就算赢一分。
 * 本文件不碰 DOM，只做数学，方便单测。
 *
 * 坐标约定（和 canvas 一致）：x 向右为正，**y 向下为正**。
 * 角度约定：度数从 +x 轴逆时针量，所以 90° 表示「朝天上」，
 * 转成速度分量时 vy 会是负数（屏幕上往上飞）。
 */

/** 击退值上限：到顶之后再挨拍也不会更夸张，免得数值失控 */
export const BUMP_MAX = 320;

/** 护盾泡泡的耐久上限 */
export const SHIELD_MAX = 100;

/** 挡下 1 点力度要花掉多少护盾耐久 */
export const SHIELD_COST_PER_POWER = 2.6;

/** 击退值累积系数：1 点力度涨多少击退值 */
export const BUMP_PER_POWER = 2.4;

/** 体重基准：体重正好 100 的角色按标准距离飞 */
export const WEIGHT_REF = 100;

/**
 * 弹飞初速的下限（哪怕击退值是 0，也要被推开一点点）。
 * 单位是「世界单位 / 秒」，场地宽 960，所以 150 大约是每秒挪动六分之一个场地。
 */
export const BASE_LAUNCH = 150;

/** 力度换初速的系数 */
export const POWER_LAUNCH = 28;

/** 弹飞初速上限，防止一拍飞到天外 */
export const MAX_LAUNCH = 1700;

/**
 * 「从场地正中间被送出弹飞线」所需的初速，实测出来的参考值。
 * 平衡台与封顶表都拿它当尺子：低于这个数就飞不出去。
 */
export const KO_SPEED = 900;

/**
 * 元气 → 弹飞初速封顶表（元气从满到空）。
 *
 * 这张表是本款最重要的一条平衡线：**元气满着的人，一击绝对送不出场**。
 * 不管谁挥、拿没拿软软锤子，第一下最多只有 `800` 的初速，比 `KO_SPEED` 还小一截，
 * 所以「一上来一记重击直接结束」的支配打法在这一款里不存在。
 *
 * 封顶只管前半段：元气掉到一半以下就完全放开到 `MAX_LAUNCH`，
 * 该飞出去的还是飞得出去——这一条不是给对局降速的，只是掐掉「一击必出界」。
 */
export const LAUNCH_CAP_TABLE: ReadonlyArray<readonly [number, number]> = [
  [100, 800],
  [85, 1000],
  [70, 1400],
  [50, MAX_LAUNCH],
  [0, MAX_LAUNCH],
];

/** 常用出招方向对应的弹飞角度（朝右打时的度数） */
export const ANGLE_BY_KIND: Record<HitKind, number> = {
  light: 38,
  heavy: 46,
  up: 80,
  down: -52,
  bounce: 90,
};

/** 出招种类：轻击 / 重击 / 上挑 / 下砸 / 机关弹起 */
export type HitKind = "light" | "heavy" | "up" | "down" | "bounce";

/** 场地四周的弹飞线（超出任意一边就算被撞出场外） */
export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** 一个会飞的点：位置 + 速度 */
export interface Motion {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** 护盾结算结果 */
export interface ShieldResult {
  /** 被护盾挡掉的力度 */
  blocked: number;
  /** 漏过护盾、真正打到身上的力度 */
  through: number;
  /** 结算后剩下的护盾耐久 */
  shieldLeft: number;
  /** 这一下把护盾泡泡拍破了 */
  popped: boolean;
}

/** 一次命中的完整结算结果 */
export interface HitResult {
  /** 结算后的击退值 */
  bump: number;
  /** 弹飞初速 */
  speed: number;
  /** 弹飞角度（度） */
  angleDeg: number;
  /** 速度分量（vy 为负表示往上飞） */
  vx: number;
  vy: number;
  /** 护盾结算 */
  shield: ShieldResult;
  /** 护盾全挡下来了，人没被弹开 */
  fullyBlocked: boolean;
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

/** 把数值夹在 [lo, hi] 之间；NaN 一律当 lo，无穷大按上下限收，绝不让脏数据传下去 */
export function clamp(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return lo;
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/** 击退值只能落在 0..BUMP_MAX */
export function clampBump(v: number): number {
  return clamp(v, 0, BUMP_MAX);
}

/** 护盾耐久只能落在 0..SHIELD_MAX */
export function clampShield(v: number): number {
  return clamp(v, 0, SHIELD_MAX);
}

/** 角度归一到 (-180, 180]，方便断言与比较 */
export function normalizeAngle(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  let a = deg % 360;
  if (a <= -180) a += 360;
  if (a > 180) a -= 360;
  return a;
}

// ---------------------------------------------------------------------------
// 护盾泡泡
// ---------------------------------------------------------------------------

/**
 * 护盾泡泡吃掉多少力度：耐久够就全挡下来，不够就只挡住一部分、泡泡「啵」地破掉。
 * 力度 <= 0 或没护盾时原样返回，不会出现负数耐久。
 */
export function shieldAbsorb(shield: number, power: number): ShieldResult {
  const s = clampShield(shield);
  const p = Math.max(0, Number.isFinite(power) ? power : 0);
  if (s <= 0 || p <= 0) {
    return { blocked: 0, through: p, shieldLeft: s, popped: false };
  }
  const cost = p * SHIELD_COST_PER_POWER;
  if (s >= cost) {
    return { blocked: p, through: 0, shieldLeft: s - cost, popped: false };
  }
  const blocked = s / SHIELD_COST_PER_POWER;
  return { blocked, through: p - blocked, shieldLeft: 0, popped: true };
}

// ---------------------------------------------------------------------------
// 击退值累积
// ---------------------------------------------------------------------------

/**
 * 累积击退值：挨一下涨 `power * BUMP_PER_POWER`，涨到上限就封顶。
 * 这一步与体重无关（体重只影响「飞多远」），所以谁挨拍都涨得一样快。
 */
export function addBump(bump: number, power: number): number {
  const p = Math.max(0, Number.isFinite(power) ? power : 0);
  return clampBump(clampBump(bump) + p * BUMP_PER_POWER);
}

/** 喘口气：站着不动会慢慢把击退值降回去（每秒 rate 点） */
export function coolBump(bump: number, dt: number, rate = 3.2): number {
  const step = Math.max(0, dt) * Math.max(0, rate);
  return clampBump(clampBump(bump) - step);
}

/** 击退值分档，给 UI 上色与配音用：0 稳 / 1 有点晃 / 2 危险 */
export function bumpTier(bump: number): 0 | 1 | 2 {
  const b = clampBump(bump);
  if (b < 90) return 0;
  if (b < 190) return 1;
  return 2;
}

/** 击退值的一句话提示（六年级向，不吓人） */
export function bumpLabel(bump: number): string {
  const tier = bumpTier(bump);
  if (tier === 0) return "站得稳";
  if (tier === 1) return "有点晃";
  return "站不住啦";
}

// ---------------------------------------------------------------------------
// 元气：击退值的正向说法
// ---------------------------------------------------------------------------

/**
 * 元气（100 = 精神饱满，0 = 站不住了），就是击退值反过来讲。
 * HUD 上颜色与数字两条通道都用它，色觉不敏感的小朋友只看数字也不会误判。
 */
export function vigorOf(bump: number): number {
  return 100 - (clampBump(bump) / BUMP_MAX) * 100;
}

/** 元气换回击退值，测试与关卡预演里方便直接指定「元气还剩几成」 */
export function bumpFromVigor(vigor: number): number {
  return clampBump(((100 - clamp(vigor, 0, 100)) / 100) * BUMP_MAX);
}

/** 元气分档的中文说法，和 `bumpLabel` 是同一套档位，只是换个说法 */
export function vigorLabel(vigor: number): string {
  return bumpLabel(bumpFromVigor(vigor));
}

// ---------------------------------------------------------------------------
// 弹飞初速与角度
// ---------------------------------------------------------------------------

/**
 * 弹飞初速：击退值越高飞越远，体重越沉飞越近。
 * `power` 是这一下的力度，`weight` 是挨拍那位的体重（基准 100）。
 */
export function launchSpeed(bump: number, power: number, weight: number = WEIGHT_REF): number {
  const b = clampBump(bump);
  const p = Math.max(0, Number.isFinite(power) ? power : 0);
  if (p <= 0) return 0;
  const w = clamp(weight, 30, 300);
  const raw = (BASE_LAUNCH + p * POWER_LAUNCH) * (1 + b / 100) * (WEIGHT_REF / w);
  return clamp(raw, 0, MAX_LAUNCH);
}

/**
 * 这一下最多能给多少初速：按挨拍那位**挨拍之前**的元气查 `LAUNCH_CAP_TABLE`，
 * 表里两档之间线性插值。元气越足封得越紧，元气见底才放开到 `MAX_LAUNCH`。
 */
export function launchCap(vigor: number): number {
  const v = clamp(vigor, 0, 100);
  const table = LAUNCH_CAP_TABLE;
  for (let i = 0; i < table.length - 1; i++) {
    const [hiV, hiCap] = table[i];
    const [loV, loCap] = table[i + 1];
    if (v <= hiV && v >= loV) {
      const k = hiV === loV ? 0 : (hiV - v) / (hiV - loV);
      return hiCap + (loCap - hiCap) * k;
    }
  }
  return table[table.length - 1][1];
}

/**
 * 封过顶的弹飞初速：先按公式算，再让 `launchCap` 收一道。
 * `bumpBefore` 是挨拍那位**挨这一下之前**的击退值，`bumpAfter` 是挨完之后的。
 */
export function cappedLaunchSpeed(
  bumpBefore: number,
  bumpAfter: number,
  power: number,
  weight: number = WEIGHT_REF
): number {
  const raw = launchSpeed(bumpAfter, power, weight);
  return Math.min(raw, launchCap(vigorOf(bumpBefore)));
}

/**
 * 弹飞方向：默认「背着打人的那位飞出去」。
 * 站得完全重叠时（x 相同）用 `fallbackDir` 决定往哪边，缺省往右。
 */
export function launchDir(attackerX: number, targetX: number, fallbackDir: 1 | -1 = 1): 1 | -1 {
  if (!Number.isFinite(attackerX) || !Number.isFinite(targetX)) return fallbackDir;
  if (targetX > attackerX) return 1;
  if (targetX < attackerX) return -1;
  return fallbackDir;
}

/**
 * 弹飞角度（度）：朝右飞就是 `ANGLE_BY_KIND` 里的原值，
 * 朝左飞就把它镜像到左半边（例如 38° → 142°）。
 */
export function launchAngleDeg(kind: HitKind, dir: 1 | -1): number {
  const base = ANGLE_BY_KIND[kind] ?? ANGLE_BY_KIND.light;
  return normalizeAngle(dir === 1 ? base : 180 - base);
}

/** 角度 + 初速 → 速度分量（vy 为负表示屏幕上往上飞） */
export function launchVector(speed: number, angleDeg: number): { vx: number; vy: number } {
  const s = Math.max(0, Number.isFinite(speed) ? speed : 0);
  const rad = (normalizeAngle(angleDeg) * Math.PI) / 180;
  return { vx: s * Math.cos(rad), vy: -s * Math.sin(rad) };
}

/**
 * 一次命中的完整结算：先过护盾，再涨击退值，再算飞出去的速度。
 * 护盾全挡下来时人不动（`fullyBlocked`），只掉护盾耐久。
 */
export function resolveHit(input: {
  bump: number;
  shield: number;
  weight: number;
  power: number;
  kind: HitKind;
  attackerX: number;
  targetX: number;
  fallbackDir?: 1 | -1;
}): HitResult {
  const shield = shieldAbsorb(input.shield, input.power);
  const dir = launchDir(input.attackerX, input.targetX, input.fallbackDir ?? 1);
  const angleDeg = launchAngleDeg(input.kind, dir);
  if (shield.through <= 0) {
    return {
      bump: clampBump(input.bump),
      speed: 0,
      angleDeg,
      vx: 0,
      vy: 0,
      shield,
      fullyBlocked: true,
    };
  }
  const bump = addBump(input.bump, shield.through);
  const speed = cappedLaunchSpeed(input.bump, bump, shield.through, input.weight);
  const vec = launchVector(speed, angleDeg);
  return { bump, speed, angleDeg, vx: vec.vx, vy: vec.vy, shield, fullyBlocked: false };
}

// ---------------------------------------------------------------------------
// 命中顿帧
// ---------------------------------------------------------------------------

/**
 * 命中顿帧的上限。
 *
 * 顿帧是「打中的那一下画面卡住几帧」，卡得越久手感越重；但卡过头就变成掉帧了，
 * 所以这里钉了 6 帧（60fps 下 0.1 秒）的天花板，再重的一下也不会更久。
 * 开了「减少动态效果」的小朋友一帧都不卡。
 */
export const HIT_STOP_MAX = 6;

/** 顿帧换算成秒（渲染层直接拿这个数扣时间） */
export function hitStopSeconds(frames: number, fps = 60): number {
  const f = clamp(Number.isFinite(frames) ? frames : 0, 0, HIT_STOP_MAX);
  return f / Math.max(1, fps);
}

/**
 * 这一下该卡几帧：轻击垫一帧，重击垫三帧，再按弹飞初速加最多三帧。
 * `reducedMotion` 为真时恒为 0——这条比什么手感都要紧。
 */
export function hitStopFrames(speed: number, heavy: boolean, reducedMotion = false): number {
  if (reducedMotion) return 0;
  const s = clamp(Number.isFinite(speed) ? speed : 0, 0, MAX_LAUNCH);
  const base = heavy ? 3 : 1;
  const extra = Math.round((s / MAX_LAUNCH) * 3);
  return Math.min(HIT_STOP_MAX, base + extra);
}

// ---------------------------------------------------------------------------
// 低元气的挣扎窗口
// ---------------------------------------------------------------------------

/** 元气跌破这个数才给挣扎窗口（对应击退值 192） */
export const STRUGGLE_VIGOR = 40;

/** 挣扎窗口有多久：被拍飞之后的 0.4 秒里朝场地里按方向键就能挣一下 */
export const STRUGGLE_WINDOW = 0.4;

/** 挣扎一次能把弹飞速度削掉多少（0.45 = 只剩四成五） */
export const STRUGGLE_DAMP = 0.45;

/** 挣扎顺带往场地里推的一点点速度，让「挣回来」真的有希望 */
export const STRUGGLE_PUSH = 90;

/** 元气低到该给挣扎窗口了吗 */
export function canStruggle(bump: number): boolean {
  return vigorOf(bump) <= STRUGGLE_VIGOR;
}

/**
 * 挣扎一下：把弹飞速度削掉一大截，再朝 `inward`（场地中心那一侧）推一点点。
 * 一次弹飞只许挣一次，所以调用方要自己把窗口清掉。
 */
export function struggleVelocity(vx: number, vy: number, inward: 1 | -1): { vx: number; vy: number } {
  const sx = (Number.isFinite(vx) ? vx : 0) * STRUGGLE_DAMP + inward * STRUGGLE_PUSH;
  const sy = (Number.isFinite(vy) ? vy : 0) * STRUGGLE_DAMP;
  return { vx: sx, vy: sy };
}

// ---------------------------------------------------------------------------
// 飞行积分与场地边界
// ---------------------------------------------------------------------------

export interface FlightOptions {
  /** 重力加速度（每秒每秒，正数表示往下拽） */
  gravity?: number;
  /** 横向空气阻力：**每秒**还剩下多少比例的横向速度（0.15 = 一秒后剩 15%） */
  drag?: number;
  /** 横向的风（每秒每秒） */
  wind?: number;
  /** 下落速度上限，免得掉太快一帧穿过平台 */
  maxFall?: number;
}

export const DEFAULT_FLIGHT: Required<FlightOptions> = {
  gravity: 1250,
  drag: 0.15,
  wind: 0,
  maxFall: 900,
};

/**
 * 走一小步飞行：返回新的位置与速度，不改传进来的对象。
 * 阻力只作用在横向（竖直方向靠重力与下落上限管着，手感更好预测）。
 */
export function stepFlight(m: Motion, dt: number, opts: FlightOptions = {}): Motion {
  const o = { ...DEFAULT_FLIGHT, ...opts };
  const step = Math.max(0, Number.isFinite(dt) ? dt : 0);
  if (step <= 0) return { ...m };
  const keep = Math.pow(clamp(o.drag, 0.0001, 1), step);
  const vx = (m.vx + o.wind * step) * keep;
  let vy = m.vy + o.gravity * step;
  if (vy > o.maxFall) vy = o.maxFall;
  return { x: m.x + vx * step, y: m.y + vy * step, vx, vy };
}

/** 出界了吗（四周任意一条弹飞线之外） */
export function isOutOfBounds(x: number, y: number, b: Bounds): boolean {
  return outOfBoundsSide(x, y, b) !== null;
}

/** 从哪一边出界的；没出界返回 null。上下左右同时越界时按「先左右后上下」报 */
export function outOfBoundsSide(
  x: number,
  y: number,
  b: Bounds
): "left" | "right" | "top" | "bottom" | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "bottom";
  if (x < b.left) return "left";
  if (x > b.right) return "right";
  if (y < b.top) return "top";
  if (y > b.bottom) return "bottom";
  return null;
}

/** 离最近那条弹飞线还有多远（已经出界返回 0） */
export function distanceToBlast(x: number, y: number, b: Bounds): number {
  if (isOutOfBounds(x, y, b)) return 0;
  return Math.min(x - b.left, b.right - x, y - b.top, b.bottom - y);
}

/** 一块「落回来就算安全」的地板（通常填主平台） */
export interface Ground {
  /** 地板高度（世界 y） */
  y: number;
  /** 地板左右边界 */
  min: number;
  max: number;
}

export interface LaunchSimOptions extends FlightOptions {
  /** 最多模拟多少步 */
  maxSteps?: number;
  /** 每步多久（秒） */
  dt?: number;
  /** 落回这块地板上就算平安回场，模拟提前结束 */
  ground?: Ground | null;
}

export interface FlightPreview {
  /** 会不会飞出场外 */
  out: boolean;
  /** 从哪一边出去的 */
  side: "left" | "right" | "top" | "bottom" | null;
  /** 中途稳稳落回地板上了 */
  landed: boolean;
  /** 飞了多少步 */
  steps: number;
  /** 飞了多久（秒） */
  time: number;
  /** 最后停在哪 */
  end: Motion;
  /** 整个过程离弹飞线最近时还剩多远 */
  minMargin: number;
}

/**
 * 把一次弹飞完整模拟一遍：给 AI 判断「这一下能不能撞出去」，也给单测断言用。
 * 传了 `ground` 就把落回地板当成安全落地（模拟到此为止），
 * 不传就是纯自由飞行——那样迟早会掉到底线之外。
 */
export function simulateLaunch(
  start: Motion,
  bounds: Bounds,
  opts: LaunchSimOptions = {}
): FlightPreview {
  const dt = opts.dt && opts.dt > 0 ? opts.dt : 1 / 60;
  const limit = Math.max(1, Math.floor(opts.maxSteps ?? 240));
  const ground = opts.ground ?? null;
  let m: Motion = { ...start };
  let minMargin = distanceToBlast(m.x, m.y, bounds);
  for (let i = 1; i <= limit; i++) {
    const prev = m;
    m = stepFlight(m, dt, opts);
    const side = outOfBoundsSide(m.x, m.y, bounds);
    if (side) {
      return { out: true, side, landed: false, steps: i, time: i * dt, end: m, minMargin: 0 };
    }
    if (ground && m.vy > 0 && prev.y <= ground.y && m.y >= ground.y && m.x >= ground.min && m.x <= ground.max) {
      return {
        out: false,
        side: null,
        landed: true,
        steps: i,
        time: i * dt,
        end: m,
        minMargin: Math.min(minMargin, distanceToBlast(m.x, m.y, bounds)),
      };
    }
    minMargin = Math.min(minMargin, distanceToBlast(m.x, m.y, bounds));
  }
  return { out: false, side: null, landed: false, steps: limit, time: limit * dt, end: m, minMargin };
}

// ---------------------------------------------------------------------------
// 「元气 → 击退距离」分档表
// ---------------------------------------------------------------------------

/** 画曲线时看多久的飞行（秒）：差不多就是一次弹飞看得见的那一段 */
export const KNOCK_SPAN = 0.7;

/** 分档表用的元气档位，从满到空 */
export const KNOCK_VIGOR_STEPS: readonly number[] = [100, 80, 60, 40, 20, 0];

export interface KnockRow {
  /** 挨拍之前还剩多少元气 */
  vigor: number;
  /** 封过顶之后的弹飞初速 */
  speed: number;
  /** `KNOCK_SPAN` 秒里横着飞出去多远（世界单位，场地宽 960） */
  distance: number;
  /** 这一下够不够把站在场地中间的人送出去 */
  knocksOut: boolean;
}

/**
 * 「元气 → 击退距离」的分档表：这一款调手感时最常看的一张表。
 * 距离用真正的飞行积分算出来，所以能直接和场地宽度对着读。
 */
export function knockbackCurve(
  power: number,
  weight: number = WEIGHT_REF,
  kind: HitKind = "heavy",
  steps: readonly number[] = KNOCK_VIGOR_STEPS
): KnockRow[] {
  return steps.map((vigor) => {
    const before = bumpFromVigor(vigor);
    const after = addBump(before, power);
    const speed = cappedLaunchSpeed(before, after, power, weight);
    const vec = launchVector(speed, launchAngleDeg(kind, 1));
    let m: Motion = { x: 0, y: 0, vx: vec.vx, vy: vec.vy };
    const dt = 1 / 60;
    for (let t = 0; t < KNOCK_SPAN - 1e-9; t += dt) m = stepFlight(m, dt);
    return { vigor, speed, distance: Math.abs(m.x), knocksOut: speed >= KO_SPEED };
  });
}

export interface KnockOutQuery {
  bump: number;
  shield: number;
  weight: number;
  power: number;
  kind: HitKind;
  attackerX: number;
  targetX: number;
  targetY: number;
}

/**
 * 这一下打下去，对手会不会被撞出场外？
 * AI 的「该出重击了吗」和关卡提示语都靠它。
 */
export function willKnockOut(
  input: KnockOutQuery,
  bounds: Bounds,
  opts: LaunchSimOptions = {}
): boolean {
  const hit = resolveHit(input);
  if (hit.fullyBlocked) return false;
  const preview = simulateLaunch(
    { x: input.targetX, y: input.targetY, vx: hit.vx, vy: hit.vy },
    bounds,
    opts
  );
  return preview.out && !preview.landed;
}

/**
 * 需要多少击退值才能把人从这个位置撞出场外（怎么打都出不去就返回 null）。
 * 用二分找最小值，给关卡设计与提示语「再撞两下就出去啦」用。
 */
export function bumpNeededToKnockOut(
  input: Omit<KnockOutQuery, "bump" | "shield">,
  bounds: Bounds,
  opts: LaunchSimOptions = {}
): number | null {
  const test = (bump: number): boolean =>
    willKnockOut({ ...input, bump, shield: 0 }, bounds, opts);
  if (!test(BUMP_MAX)) return null;
  if (test(0)) return 0;
  let lo = 0;
  let hi = BUMP_MAX;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (test(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
