/**
 * 星星射击场 1.2 · 手感三件套（出手前摇 / 命中顿感 / 准星散布）。
 *
 * 三件套都是**常量 + 纯函数**，运行时只负责把 dt 喂进来、把结果画出去，
 * 这样「手感」这件最玄的事有单测兜着，改数值先看用例会不会红。
 *
 * 这是嘉年华打靶场：所谓「后坐力」是**准星被星星弹弹上去一点点再自己落回来**，
 * 加上连发时准星圈会变大（星星弹撒得开一些）。没有枪械建模，没有伤害。
 */

// ---------------------------------------------------------------------------
// 一、出手前摇：按下到星星弹真的出去之间的那一小段
// ---------------------------------------------------------------------------

/**
 * 前摇毫秒数。规格上限 80ms —— 再长就「按了没反应」，再短就没有蓄力的实感。
 * 70ms 大概是 4 帧多一点，孩子感觉不到延迟，但发射台压一下再弹回来的动作看得见。
 */
export const WINDUP_MS = 70;
/** 前摇（秒），主循环用 */
export const WINDUP_S = WINDUP_MS / 1000;

/** 前摇进度 0..1（0 = 刚按下，1 = 星星弹出膛），给发射台压缩动画用 */
export function windupProgress(leftS: number): number {
  if (!(leftS > 0)) return 1;
  return Math.max(0, Math.min(1, 1 - leftS / WINDUP_S));
}

// ---------------------------------------------------------------------------
// 二、命中顿感：打中的一瞬间整个场面停一下
// ---------------------------------------------------------------------------

/** 顿感帧数下限（规格 4–6 帧） */
export const HIT_STOP_MIN_FRAMES = 4;
/** 顿感帧数上限 */
export const HIT_STOP_MAX_FRAMES = 6;
/** 按 60fps 折算 */
export const FRAME_S = 1 / 60;

/**
 * 这一下该顿几帧：普通靶 4 帧，护盾靶敲开外壳 5 帧，
 * 分裂靶炸成两个 / 彩虹靶这种"大事"6 帧。永远夹在 4–6 帧之间。
 */
export function hitStopFrames(kind: "normal" | "shield" | "big"): number {
  const n = kind === "big" ? HIT_STOP_MAX_FRAMES : kind === "shield" ? 5 : HIT_STOP_MIN_FRAMES;
  return Math.max(HIT_STOP_MIN_FRAMES, Math.min(HIT_STOP_MAX_FRAMES, n));
}

/** 顿感时长（秒） */
export function hitStopSeconds(kind: "normal" | "shield" | "big"): number {
  return hitStopFrames(kind) * FRAME_S;
}

/** 顿感倒计时：走完返回 0。顿感期间靶子不动、倒计时也不走。 */
export function stepHitStop(leftS: number, dt: number): number {
  return Math.max(0, leftS - Math.max(0, dt));
}

// ---------------------------------------------------------------------------
// 三、准星散布：连发就撒，停手就收
// ---------------------------------------------------------------------------

/** 停手停稳时的散布半径（逻辑单位）：0 = 瞄哪打哪 */
export const SPREAD_MIN = 0;
/** 每开一发涨多少 */
export const SPREAD_PER_SHOT = 9;
/** 撒得再开也就这么大（逻辑单位；靶子最小半径 30 上下，封顶保证还打得中） */
export const SPREAD_MAX = 34;
/** 停手后每秒收回多少 */
export const SPREAD_RECOVER_PER_S = 26;
/** 停手多久才开始收（秒）：连点的间隙不算停手 */
export const SPREAD_SETTLE_DELAY = 0.14;

/** 开一发之后的散布 */
export function spreadAfterShot(spread: number): number {
  return Math.min(SPREAD_MAX, Math.max(SPREAD_MIN, spread) + SPREAD_PER_SHOT);
}

/**
 * 时间推进：`sinceShot` 是距离上一发过了多久。
 * 还在 `SPREAD_SETTLE_DELAY` 里就不收（否则连点会一边打一边收，散布形同虚设）。
 */
export function stepSpread(spread: number, dt: number, sinceShot: number): number {
  if (sinceShot < SPREAD_SETTLE_DELAY) return Math.min(SPREAD_MAX, Math.max(SPREAD_MIN, spread));
  return Math.max(SPREAD_MIN, spread - SPREAD_RECOVER_PER_S * Math.max(0, dt));
}

/** 完全收回需要几秒（给攻略文案与用例用） */
export function spreadRecoverSeconds(spread: number): number {
  return Math.max(0, spread) / SPREAD_RECOVER_PER_S + SPREAD_SETTLE_DELAY;
}

/** 连打几发会撒到封顶 */
export function shotsToMaxSpread(): number {
  return Math.ceil(SPREAD_MAX / SPREAD_PER_SHOT);
}

/**
 * 这一发实际落到哪：在准星周围的散布圆里取一点。
 * `rand` 由调用方给（运行时用 Math.random，用例用定序随机），所以整件事是可复现的。
 */
export function spreadOffset(spread: number, rand: () => number): { dx: number; dy: number } {
  const r = Math.max(0, Math.min(SPREAD_MAX, spread));
  if (r <= 0) return { dx: 0, dy: 0 };
  const ang = rand() * Math.PI * 2;
  // 半径开方，落点在圆面上均匀分布，不会全挤在圆心
  const dist = Math.sqrt(Math.max(0, Math.min(1, rand()))) * r;
  return { dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist };
}

// ---------------------------------------------------------------------------
// 四、准星回弹（本作的「后坐力」）
// ---------------------------------------------------------------------------

/** 开一发准星往上跳多少（逻辑单位，y 越小越高） */
export const RECOIL_KICK = 16;
/** 跳上去之后每秒落回多少 */
export const RECOIL_RETURN_PER_S = 90;

/** 开一发之后的抬升量 */
export function recoilAfterShot(kick: number): number {
  return Math.min(RECOIL_KICK * 2, Math.max(0, kick) + RECOIL_KICK);
}

/** 抬升量自己往回落 */
export function stepRecoil(kick: number, dt: number): number {
  return Math.max(0, Math.max(0, kick) - RECOIL_RETURN_PER_S * Math.max(0, dt));
}

// ---------------------------------------------------------------------------
// 五、reduced-motion：关抖动，留数值
// ---------------------------------------------------------------------------

/**
 * 准星圈画多大：散布数值照实反映（这样孩子仍然看得出"连发会撒"），
 * 但 `reduced` 时不叠那层来回抖的呼吸动画。
 */
export function crosshairRadius(spread: number, timeS: number, reduced: boolean): number {
  const base = 20 + Math.max(0, Math.min(SPREAD_MAX, spread));
  if (reduced) return base;
  return base + Math.sin(timeS * 7) * Math.min(2.5, spread * 0.12);
}

/** 命中顿感期间的屏幕微震幅度（reduced 时恒为 0） */
export function shakeAmount(hitStopLeft: number, reduced: boolean): number {
  if (reduced || hitStopLeft <= 0) return 0;
  return Math.min(4, hitStopLeft / FRAME_S);
}
