// 共享美术套件 · 泡泡薄膜(film):肥皂泡边缘的彩虹薄膜描边与底部月牙反光。
// (1.3 视觉升级 · 窗口 6 第 19 步 C 档落的文件)
//
// 约定:输入 (ctx, x, y, r, base),对 ctx 之外零副作用;色相偏移换算是纯函数。
// 泡泡类游戏(bubble-aim / bubble-pop / balloon-pop)都可以只 import 来用。
import { hexToRgb, rgbToHex } from "./palette";

/** 薄膜描边的色相偏移量(度):同色系往彩虹方向偏一点,不换色系 */
export const FILM_HUE_DEG = 12;

/** 半径小于这个值(px)省略薄膜:小到看不清就别画,窄屏省一笔 */
export const FILM_MIN_RADIUS = 6;

/** 这个半径要不要画薄膜描边 */
export function filmVisible(r: number): boolean {
  return r >= FILM_MIN_RADIUS;
}

/**
 * 色相旋转 deg 度(饱和度 / 明度不变):#rrggbb → #rrggbb。
 * 灰色没有色相,转多少度都原样返回。
 */
export function hueShift(hex: string, deg: number): string {
  const [r0, g0, b0] = hexToRgb(hex);
  const r = r0 / 255;
  const g = g0 / 255;
  const b = b0 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return rgbToHex(r0, g0, b0);
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  h = (((h + deg / 360) % 1) + 1) % 1;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const one = (t0: number): number => {
    let t = ((t0 % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return rgbToHex(one(h + 1 / 3) * 255, one(h) * 255, one(h - 1 / 3) * 255);
}

/** 薄膜描边色:主色往彩虹方向偏 12°(四·补一 baFilm 的定义) */
export function filmColor(base: string): string {
  return hueShift(base, FILM_HUE_DEG);
}

/** 绘制只用到这几笔:测试用记录桩也装得下,真 CanvasRenderingContext2D 天然兼容 */
export interface FilmCtx {
  globalAlpha: number;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  save(): void;
  restore(): void;
  beginPath(): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  stroke(): void;
  fill(): void;
}

/**
 * 边缘 1px 彩虹薄膜描边:主弧一整圈偏 +12°,左下再补一小段偏 -12° 的虹彩。
 * 半径 < FILM_MIN_RADIUS 一笔不画,返回 false;画了返回 true。
 * 除 ctx 外零副作用(save/restore 包好,不漏状态)。
 */
export function paintFilm(ctx: FilmCtx, x: number, y: number, r: number, base: string): boolean {
  if (!filmVisible(r)) return false;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = filmColor(base);
  ctx.beginPath();
  ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
  ctx.stroke();
  // 左下一小段反向虹彩,薄膜才有「转着光」的感觉
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = hueShift(base, -FILM_HUE_DEG);
  ctx.beginPath();
  ctx.arc(x, y, r - 0.5, Math.PI * 0.55, Math.PI * 0.95);
  ctx.stroke();
  ctx.restore();
  return true;
}

/**
 * 底部月牙反光:光源统一左上 45°,球底右下弹一道细细的反光弧。
 * 同样 (ctx, x, y, r) 之外零副作用。
 */
export function paintBottomCrescent(ctx: FilmCtx, x: number, y: number, r: number): void {
  ctx.save();
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.78, Math.PI * 0.18, Math.PI * 0.62);
  ctx.stroke();
  ctx.restore();
}
