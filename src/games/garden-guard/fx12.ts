// 花园守卫 1.2 —— 受击与清除的手感参数(纯计算)。
//
// 分级红线:这个游戏里没有血、没有伤、没有倒下。
// 挨了一下是「被弹开 + 头上冒星星」,被清掉是「散成花瓣飞走」,
// 头顶那条也不是血条,是元气条——所以颜色一律走暖色,不用红。

/** 弹开持续多久(秒)。短一点才像「被弹了一下」而不是「被推着走」。 */
export const KNOCK_TIME = 0.18;
/** 弹开最远退多少格。 */
export const KNOCK_DIST = 0.2;
/** 一次受击冒几颗星。 */
export const HIT_STARS = 4;
/** 被清除时散成几片花瓣。 */
export const CLEAR_PETALS = 8;

/**
 * 弹开的位移曲线:一下子弹出去,再柔和地滑回来。
 * t 从 0 走到 KNOCK_TIME,返回沿路径「往回退」多少格。
 */
export function knockOffset(t: number, power = 1): number {
  if (t <= 0 || t >= KNOCK_TIME) return 0;
  const k = t / KNOCK_TIME;
  return Math.sin(k * Math.PI) * KNOCK_DIST * power;
}

export interface Spark {
  vx: number;
  vy: number;
  life: number;
  size: number;
  spin: number;
}

/** 受击的星星:朝斜上方散开,很快消失,不挡住画面。 */
export function hitStar(i: number, n = HIT_STARS, power = 1): Spark {
  const spread = Math.PI * 0.9;
  const a = -Math.PI / 2 - spread / 2 + (spread * (i + 0.5)) / n;
  const v = (70 + (i % 2) * 26) * power;
  return {
    vx: Math.cos(a) * v,
    vy: Math.sin(a) * v,
    life: 0.42,
    size: 4 + (i % 3),
    spin: (i % 2 === 0 ? 1 : -1) * 6,
  };
}

/** 清除时飞走的花瓣:向四周飘开,比星星飘得久一点,像真的被风吹散。 */
export function clearPetal(i: number, n = CLEAR_PETALS, power = 1): Spark {
  const a = (Math.PI * 2 * i) / n + (i % 2) * 0.3;
  const v = (46 + (i % 4) * 15) * power;
  return {
    vx: Math.cos(a) * v,
    // 花瓣是「飞走」不是「掉下」,整体带一点向上的初速
    vy: Math.sin(a) * v - 34 * power,
    life: 0.85,
    size: 4.5 + (i % 3) * 1.2,
    spin: (i % 3) - 1,
  };
}

/** 元气条的颜色:满是暖黄,少是暖橙,任何时候都不用红。 */
export function energyColor(ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio));
  if (r > 0.6) return "#8fd8a8";
  if (r > 0.3) return "#ffd868";
  return "#f2a878";
}

/**
 * 系统层面是否要求减少动态效果。
 * 抖动与闪烁按这个开关关掉,但状态变化(元气条、花瓣飞走)照常——
 * 关掉的是「晃」,不是「看不出发生了什么」。
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** 抖动幅度:开了减少动效就一律 0。 */
export function shakeAmount(base: number, reduced: boolean): number {
  return reduced ? 0 : base;
}
