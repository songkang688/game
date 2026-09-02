/**
 * 共享美术套件 · 雪场三件套(1.3 视觉升级,snow-fight 落的文件)。
 *
 * 1. 飘雪场 Snowfield:常驻的慢速雪粒,**上限 24 颗**;
 *    位置确定性(注入随机源),`clearSnowfield` 一步清空(destroy 归零断言用);
 * 2. 脚印淡痕 Footprint:走过的地方留一对浅印,**2 秒线性渐隐**;
 * 3. 雪爆 SnowBurst:落点溅雪 6 瓣(320ms easeOutCubic 淡出)与出手雪粉 4 颗。
 *
 * 纯状态机 + 只拿传入的 2d 画笔画,不摸 DOM、不查媒体特性——
 * `prefers-reduced-motion` 的降级由调用方决定「不生成」。
 */
import { easeOutCubic } from "./sparkle";

// ---------------------------------------------------------------------------
// 一、飘雪场(常驻,上限 24)
// ---------------------------------------------------------------------------

/** 飘雪粒子上限:再密的雪也只有这么多颗(掉帧兜底 + reduced 直接给 0) */
export const SNOW_CAP = 24;

export interface Flake {
  x: number;
  y: number;
  r: number;
  /** 下落速度(px/s) */
  fall: number;
  /** 横向摆动幅度(px) */
  sway: number;
  /** 摆动相位 */
  phase: number;
}

export interface Snowfield {
  flakes: Flake[];
  w: number;
  h: number;
  /** 从出生到现在多少秒(摆动相位用) */
  t: number;
}

/** 造一片飘雪场:count 会被夹到 0..SNOW_CAP,位置由注入的随机源定(同种子同雪) */
export function makeSnowfield(count: number, w: number, h: number, rand: () => number = Math.random): Snowfield {
  const n = Math.max(0, Math.min(SNOW_CAP, Math.round(count)));
  const flakes: Flake[] = [];
  for (let i = 0; i < n; i++) {
    flakes.push({
      x: rand() * w,
      y: rand() * h,
      r: 1 + rand() * 1.6,
      fall: 14 + rand() * 22,
      sway: 4 + rand() * 8,
      phase: rand() * Math.PI * 2,
    });
  }
  return { flakes, w, h, t: 0 };
}

/** 画布尺寸变了就跟着变(雪粒按比例挪,不重新洗牌) */
export function resizeSnowfield(f: Snowfield, w: number, h: number): void {
  if (f.w > 0 && f.h > 0) {
    for (const k of f.flakes) {
      k.x = (k.x / f.w) * w;
      k.y = (k.y / f.h) * h;
    }
  }
  f.w = w;
  f.h = h;
}

/** 往前飘一小步:落到底就回到顶上接着下 */
export function stepSnowfield(f: Snowfield, dt: number): void {
  const d = Math.max(0, dt);
  if (d === 0) return;
  f.t += d;
  for (const k of f.flakes) {
    k.y += k.fall * d;
    if (k.y > f.h + 4) {
      k.y = -4;
      k.x = (k.x + f.w * 0.37) % Math.max(1, f.w);
    }
  }
}

/** 把雪画出来(白色小圆,横向按相位轻摆)。最多画 visible 颗(掉帧时少画点) */
export function drawSnowfield(ctx: CanvasRenderingContext2D, f: Snowfield, visible = SNOW_CAP): void {
  const n = Math.max(0, Math.min(f.flakes.length, Math.round(visible)));
  ctx.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < n; i++) {
    const k = f.flakes[i] as Flake;
    const x = k.x + Math.sin(f.t * 0.8 + k.phase) * k.sway;
    ctx.beginPath();
    ctx.arc(x, k.y, k.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 一步清空(destroy / 换局用) */
export function clearSnowfield(f: Snowfield): void {
  f.flakes.length = 0;
  f.t = 0;
}

// ---------------------------------------------------------------------------
// 二、脚印淡痕(2 秒渐隐)
// ---------------------------------------------------------------------------

/** 一枚脚印活多久(秒) */
export const FOOTPRINT_LIFE_S = 2;
/** 场上最多同时留多少枚(再多就把最老的挤掉) */
export const FOOTPRINT_CAP = 48;

export interface Footprint {
  x: number;
  /** 左脚还是右脚(交替错开一点) */
  side: -1 | 1;
  /** 已经存在几秒 */
  t: number;
  /** 淡痕颜色(两队各自的冷色淡痕) */
  tint: string;
}

/** 踩一脚:超过上限就挤掉最老的一枚 */
export function stampFootprint(list: Footprint[], x: number, side: -1 | 1, tint: string, cap = FOOTPRINT_CAP): void {
  list.push({ x, side, t: 0, tint });
  while (list.length > Math.max(1, cap)) list.shift();
}

/** 时间往前走:活满 FOOTPRINT_LIFE_S 的就地消失 */
export function stepFootprints(list: Footprint[], dt: number): void {
  const d = Math.max(0, dt);
  for (const p of list) p.t += d;
  let keep = 0;
  for (const p of list) {
    if (p.t < FOOTPRINT_LIFE_S) {
      list[keep] = p;
      keep++;
    }
  }
  list.length = keep;
}

/** 这一枚现在多透明(1 = 刚踩下,0 = 该消失了),线性渐隐 */
export function footprintAlpha(p: Footprint): number {
  return Math.max(0, Math.min(1, 1 - p.t / FOOTPRINT_LIFE_S));
}

// ---------------------------------------------------------------------------
// 三、雪爆:落点溅雪 6 瓣 / 出手雪粉 4 颗
// ---------------------------------------------------------------------------

/** 落点溅雪几瓣 */
export const SPLASH_PETALS = 6;
/** 溅雪活多久(毫秒,easeOutCubic 淡出) */
export const SPLASH_MS = 320;
/** 出手瞬间喷几颗雪粉 */
export const POWDER_COUNT = 4;
/** 雪粉活多久(毫秒) */
export const POWDER_MS = 240;

export interface SnowBurst {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 活了几秒 */
  t: number;
  /** 总寿命(秒) */
  max: number;
  r: number;
}

/** 落点溅雪:count 瓣往上扇形溅开 */
export function burstSplash(x: number, y: number, count = SPLASH_PETALS, rand: () => number = Math.random): SnowBurst[] {
  const n = Math.max(0, Math.round(count));
  const out: SnowBurst[] = [];
  for (let i = 0; i < n; i++) {
    const ang = Math.PI * (0.15 + (0.7 * (i + 0.5)) / Math.max(1, n));
    const v = 46 + rand() * 30;
    out.push({
      x,
      y,
      vx: Math.cos(ang) * v * (rand() > 0.5 ? 1 : -1),
      vy: -Math.sin(ang) * v,
      t: 0,
      max: SPLASH_MS / 1000,
      r: 1.6 + rand() * 1.6,
    });
  }
  return out;
}

/** 出手雪粉:小而快,朝出手方向喷 */
export function burstPowder(x: number, y: number, dir: 1 | -1, rand: () => number = Math.random): SnowBurst[] {
  const out: SnowBurst[] = [];
  for (let i = 0; i < POWDER_COUNT; i++) {
    out.push({
      x,
      y,
      vx: dir * (28 + rand() * 40),
      vy: -12 - rand() * 26,
      t: 0,
      max: POWDER_MS / 1000,
      r: 1 + rand() * 1.2,
    });
  }
  return out;
}

/** 走一步:轻微重力,寿命到了就删(原地压缩,不产生新数组) */
export function stepBursts(list: SnowBurst[], dt: number): void {
  const d = Math.max(0, dt);
  let keep = 0;
  for (const p of list) {
    const t = p.t + d;
    if (t >= p.max) continue;
    p.t = t;
    p.x += p.vx * d;
    p.y += p.vy * d;
    p.vy += 160 * d;
    list[keep] = p;
    keep++;
  }
  list.length = keep;
}

/** 这一瓣现在多透明:easeOutCubic 淡出 */
export function burstAlpha(p: SnowBurst): number {
  return Math.max(0, 1 - easeOutCubic(p.t / p.max));
}

/** 把雪爆画出来(白点 + 冷蓝微描边由调用方配色,这里只管形) */
export function drawBursts(ctx: CanvasRenderingContext2D, list: SnowBurst[]): void {
  for (const p of list) {
    ctx.globalAlpha = burstAlpha(p);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
