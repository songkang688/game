/**
 * 长蛇争霸 · 1.3 视觉素材库(纯绘制函数)。
 *
 * 统一签名 `(g, opts)`:只吃传入的 2D 上下文,不碰 DOM(仅 makeBeanSprites 探测
 * `document` 造离屏 sprite,拿不到就返回 null 让调用方走直绘路径)。
 * 共享三件套(shade / tint / 调色板 / 宝石 / 四芒星屑)一律 import `src/art/kit/`,
 * 不重抄第二份;蛇身、糖果原野、罗盘雷达是本作独占资产,按同等三阶光影标准画。
 *
 * 兼容线:仓库单测的画布替身只实现 arc / moveTo / lineTo / rect / 渐变 /
 * translate / rotate / scale 这批基础方法,所以这里不用 ellipse /
 * quadraticCurveTo / setLineDash;椭圆一律 save + scale + arc 模拟。
 */

import { KIT_PALETTE, drawGem, drawSparkle, shade, tint } from "../../art/kit";
import type { Skin } from "./skins";

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function fin(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** 标准五角星路径(本地小工具;kit 的同名函数没有导出) */
function starPath(g: Ctx, cx: number, cy: number, rOuter: number, rInner: number, rot = -Math.PI / 2): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/** 确定性二维哈希:同一格永远撒同一朵花,测试可复现 */
export function hash2(ix: number, iy: number): number {
  const a = Math.imul((Math.round(fin(ix) ? ix : 0) | 0) + 0x9e3779b9, 0x85ebca6b);
  const b = Math.imul((Math.round(fin(iy) ? iy : 0) | 0) + 0x165667b1, 0xc2b2ae35);
  const m = Math.imul(a ^ (b >>> 13), 0x27d4eb2f);
  return (m ^ (m >>> 15)) >>> 0;
}

// ---------------------------------------------------------------------------
// 糖果原野主题(白天 → 黄昏 → 迷雾夜)
// ---------------------------------------------------------------------------

export type FieldThemeKind = "day" | "dusk" | "night";

export interface FieldTheme {
  kind: FieldThemeKind;
  bgTop: string;
  bgBottom: string;
  grid: string;
  fence: string;
  lamp: string;
  /** 装饰贴片三色:小花 / 三叶草 / 糖果石子 */
  decoA: string;
  decoB: string;
  decoC: string;
}

export const FIELD_THEMES: Readonly<Record<FieldThemeKind, FieldTheme>> = {
  day: {
    kind: "day",
    bgTop: "#f4fbef",
    bgBottom: "#e6f5dc",
    grid: "#4f9e6b",
    fence: "#8fd9a8",
    lamp: "#fff3b0",
    decoA: "#ffd7e6",
    decoB: "#bfe3a8",
    decoC: "#d9e6f2"
  },
  dusk: {
    kind: "dusk",
    bgTop: "#fff0dc",
    bgBottom: "#ffdcc0",
    grid: "#c78a5a",
    fence: "#f5b97f",
    lamp: "#ffe7a8",
    decoA: "#ffc9d9",
    decoB: "#e8cf9a",
    decoC: "#ecd2ea"
  },
  night: {
    kind: "night",
    bgTop: "#33406b",
    bgBottom: "#25304f",
    grid: "#9fb4de",
    fence: "#7fe3d0",
    lamp: "#ffe9a8",
    decoA: "#cfe0ff",
    decoB: "#8fa8d9",
    decoC: "#6d7fb0"
  }
};

/** 关卡段 → 主题:fog 关自动夜色调 */
export function fieldTheme(kind: FieldThemeKind): FieldTheme {
  return FIELD_THEMES[kind] ?? FIELD_THEMES.day;
}

export interface FieldBgOpts {
  w: number;
  h: number;
  camX: number;
  camY: number;
  zoom: number;
  theme: FieldTheme;
}

/** 装饰贴片的世界格边长 */
export const DECOR_CELL = 176;
/** 装饰层视差(比主镜头慢一点,原野才有远近) */
export const DECOR_PARALLAX = 0.85;
/** 远景色岛的世界格边长(约每 900 世界 px 一枚;1.3 r1 · learner P6) */
export const ISLAND_CELL = 900;
/** 色岛层视差:0.6,与贴片层 0.85 合计两档,不出现第三档 */
export const ISLAND_PARALLAX = 0.6;
/** 贴片屏幕尺寸下限(2.4 → 3.2,低 zoom 不退化成噪点;1.3 r1 · learner P6) */
export const DECOR_MIN_SIZE = 3.2;

/**
 * 糖果原野四层背景:线性渐变底 → 8% 透明网格 → 远景色岛(视差 0.6)
 * → 确定性哈希装饰贴片(视差 0.85)。全场恰两档视差,不出现第三档。
 */
export function drawFieldBackground(g: Ctx, o: FieldBgOpts): void {
  if (!fin(o.w) || !fin(o.h) || !fin(o.zoom) || o.w <= 0 || o.h <= 0 || o.zoom <= 0) return;
  const { w, h, zoom } = o;
  const camX = fin(o.camX) ? o.camX : 0;
  const camY = fin(o.camY) ? o.camY : 0;
  const theme = o.theme ?? FIELD_THEMES.day;

  // 1) 渐变底
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, theme.bgTop);
  grad.addColorStop(1, theme.bgBottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  // 2) 低透明网格(1.2 时代是 100% 实线,这里降到 8%)
  const step = 90 * zoom;
  if (step > 6) {
    g.save();
    g.globalAlpha = g.globalAlpha * 0.08;
    g.strokeStyle = theme.grid;
    g.lineWidth = 1;
    for (let x = (((-camX * zoom + w / 2) % step) + step) % step; x < w; x += step) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = (((-camY * zoom + h / 2) % step) + step) % step; y < h; y += step) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.restore();
  }

  // 2.5) 远景「原野色岛」(1.3 r1 · learner P6):直径 300–500 世界 px 的
  // 大椭圆色斑,视差 0.6,画在贴片层之下,给原野第二档远近。
  const ipx = camX * ISLAND_PARALLAX;
  const ipy = camY * ISLAND_PARALLAX;
  const ihw = w / 2 / zoom + 260;
  const ihh = h / 2 / zoom + 260;
  const jx0 = Math.floor((ipx - ihw) / ISLAND_CELL);
  const jx1 = Math.ceil((ipx + ihw) / ISLAND_CELL);
  const jy0 = Math.floor((ipy - ihh) / ISLAND_CELL);
  const jy1 = Math.ceil((ipy + ihh) / ISLAND_CELL);
  let islandBudget = 48;
  for (let jy = jy0; jy <= jy1 && islandBudget > 0; jy++) {
    for (let jx = jx0; jx <= jx1 && islandBudget > 0; jx++) {
      islandBudget--;
      const hsh = hash2(jx + 7919, jy - 4409);
      // 每格恰一枚,格心 ±0.35 格抖动:既不成棋盘,也不留多屏空档
      const wx = (jx + 0.5 + ((hsh % 83) / 83 - 0.5) * 0.7) * ISLAND_CELL;
      const wy = (jy + 0.5 + (((hsh >>> 6) % 79) / 79 - 0.5) * 0.7) * ISLAND_CELL;
      const rx = (150 + ((hsh >>> 9) % 101)) * zoom; // 直径 300–500 世界 px
      const ry = rx * (0.55 + ((hsh >>> 13) % 21) / 100);
      const sx = w / 2 + (wx - ipx) * zoom;
      const sy = h / 2 + (wy - ipy) * zoom;
      if (sx + rx < 0 || sy + ry < 0 || sx - rx > w || sy - ry > h) continue;
      g.save();
      g.globalAlpha = 0.08 + ((hsh >>> 3) % 5) / 100; // 0.08–0.12
      g.fillStyle = theme.decoB;
      g.translate(sx, sy);
      g.scale(Math.max(0.1, rx), Math.max(0.1, ry));
      g.beginPath();
      g.arc(0, 0, 1, 0, TAU); // 单位圆 + scale 模拟椭圆(兼容线:不用 ellipse)
      g.fill();
      g.restore();
    }
  }

  // 3) 装饰贴片:视差坐标系里按格撒点,同一格永远同一朵
  const px = camX * DECOR_PARALLAX;
  const py = camY * DECOR_PARALLAX;
  const halfW = w / 2 / zoom;
  const halfH = h / 2 / zoom;
  const ix0 = Math.floor((px - halfW) / DECOR_CELL);
  const ix1 = Math.ceil((px + halfW) / DECOR_CELL);
  const iy0 = Math.floor((py - halfH) / DECOR_CELL);
  const iy1 = Math.ceil((py + halfH) / DECOR_CELL);
  let budget = 360;
  g.save();
  g.globalAlpha = g.globalAlpha * 0.55;
  for (let iy = iy0; iy <= iy1 && budget > 0; iy++) {
    for (let ix = ix0; ix <= ix1 && budget > 0; ix++) {
      budget--;
      const hsh = hash2(ix, iy);
      if (hsh % 5 >= 2) continue; // 六成的格子留白,原野才不闹
      const wx = ix * DECOR_CELL + (hsh % 97) / 97 * DECOR_CELL;
      const wy = iy * DECOR_CELL + ((hsh >>> 7) % 89) / 89 * DECOR_CELL;
      const sx = w / 2 + (wx - px) * zoom;
      const sy = h / 2 + (wy - py) * zoom;
      if (sx < -14 || sy < -14 || sx > w + 14 || sy > h + 14) continue;
      const s = Math.max(DECOR_MIN_SIZE, 5 * zoom);
      drawDecorPatch(g, sx, sy, s, hsh % 3, theme);
    }
  }
  g.restore();
}

/** 单块装饰贴片:0 小花 / 1 三叶草 / 2 糖果石子 */
function drawDecorPatch(g: Ctx, x: number, y: number, s: number, kind: number, theme: FieldTheme): void {
  if (kind === 0) {
    g.fillStyle = theme.decoA;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      g.beginPath();
      g.arc(x + Math.cos(a) * s * 0.8, y + Math.sin(a) * s * 0.8, s * 0.55, 0, TAU);
      g.fill();
    }
    g.fillStyle = KIT_PALETTE.lemon;
    g.beginPath();
    g.arc(x, y, s * 0.45, 0, TAU);
    g.fill();
    return;
  }
  if (kind === 1) {
    g.fillStyle = theme.decoB;
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (k / 3) * TAU;
      g.beginPath();
      g.arc(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.55, 0, TAU);
      g.fill();
    }
    g.strokeStyle = shade(theme.decoB, 0.25);
    g.lineWidth = Math.max(0.8, s * 0.16);
    g.beginPath();
    g.moveTo(x, y + s * 0.3);
    g.lineTo(x + s * 0.35, y + s * 1.4);
    g.stroke();
    return;
  }
  g.fillStyle = theme.decoC;
  g.beginPath();
  g.arc(x, y, s * 0.8, 0, TAU);
  g.fill();
  g.fillStyle = tint(theme.decoC, 0.45);
  g.beginPath();
  g.arc(x - s * 0.25, y - s * 0.28, s * 0.3, 0, TAU);
  g.fill();
}

// ---------------------------------------------------------------------------
// 发光围栏与缩圈
// ---------------------------------------------------------------------------

export interface FenceOpts {
  cx: number;
  cy: number;
  /** 屏幕半径 */
  r: number;
  w: number;
  h: number;
  t: number;
  theme: FieldTheme;
  /** 蛇头逼近围栏的警示强度 0–1;0 不画警示 */
  warn?: number;
  /** 警示段的世界角(蛇头相对场心方向) */
  warnAngle?: number;
  soft?: boolean;
}

/** 围栏靠近多少像素内触发红色警示(世界坐标,仅视觉) */
export const FENCE_WARN_PX = 80;

/**
 * 名副其实的发光围栏:8px 外光 + 4px 主线 + 1px 内亮线,每 30° 一颗灯珠,
 * 蛇头逼近时那一段红色脉动(soft 时脉动改常亮)。
 */
export function drawFence(g: Ctx, o: FenceOpts): void {
  if (!fin(o.cx) || !fin(o.cy) || !fin(o.r) || o.r <= 0) return;
  const theme = o.theme ?? FIELD_THEMES.day;
  const t = fin(o.t) ? o.t : 0;
  g.save();
  // 三层描边
  g.strokeStyle = theme.fence;
  g.globalAlpha = g.globalAlpha * 0.2;
  g.lineWidth = 8;
  g.beginPath();
  g.arc(o.cx, o.cy, o.r, 0, TAU);
  g.stroke();
  g.restore();
  g.strokeStyle = theme.fence;
  g.lineWidth = 4;
  g.beginPath();
  g.arc(o.cx, o.cy, o.r, 0, TAU);
  g.stroke();
  g.strokeStyle = tint(theme.fence, 0.55);
  g.lineWidth = 1;
  g.beginPath();
  g.arc(o.cx, o.cy, Math.max(1, o.r - 2.5), 0, TAU);
  g.stroke();
  // 每 30° 一颗灯珠
  const lampR = Math.max(2, o.r * 0.006 + 2.2);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    const lx = o.cx + Math.cos(a) * o.r;
    const ly = o.cy + Math.sin(a) * o.r;
    if (fin(o.w) && fin(o.h) && (lx < -16 || ly < -16 || lx > o.w + 16 || ly > o.h + 16)) continue;
    const glow = o.soft ? 0.9 : 0.65 + 0.35 * Math.sin(t * 2.2 + k * 0.8);
    g.save();
    g.globalAlpha = g.globalAlpha * glow;
    g.fillStyle = theme.lamp;
    g.beginPath();
    g.arc(lx, ly, lampR, 0, TAU);
    g.fill();
    g.fillStyle = KIT_PALETTE.cloud;
    g.beginPath();
    g.arc(lx - lampR * 0.25, ly - lampR * 0.25, lampR * 0.38, 0, TAU);
    g.fill();
    g.restore();
  }
  // 逼近警示:蛇头那一段红色脉动
  const warn = fin(o.warn) ? Math.min(1, Math.max(0, o.warn)) : 0;
  if (warn > 0) {
    const a = fin(o.warnAngle) ? o.warnAngle : 0;
    const pulse = o.soft ? 0.7 : 0.5 + 0.5 * Math.sin(t * 7);
    g.save();
    g.globalAlpha = g.globalAlpha * warn * (0.35 + 0.45 * pulse);
    g.strokeStyle = KIT_PALETTE.coral;
    g.lineWidth = 8;
    g.beginPath();
    g.arc(o.cx, o.cy, o.r, a - 0.4, a + 0.4);
    g.stroke();
    g.restore();
  }
}

export interface ZoneDrawOpts {
  cx: number;
  cy: number;
  /** 屏幕半径 */
  r: number;
  w: number;
  h: number;
  t: number;
  soft?: boolean;
}

/**
 * 缩圈:圈外 10% 青灰罩(矩形 + 逆时针圆挖洞,非零环绕) + 双层光带。
 */
export function drawShrinkZone(g: Ctx, o: ZoneDrawOpts): void {
  if (!fin(o.cx) || !fin(o.cy) || !fin(o.r) || !fin(o.w) || !fin(o.h) || o.r <= 0) return;
  const t = fin(o.t) ? o.t : 0;
  g.save();
  g.fillStyle = "#5e7c8a";
  g.globalAlpha = g.globalAlpha * 0.1;
  g.beginPath();
  g.rect(0, 0, o.w, o.h);
  g.arc(o.cx, o.cy, o.r, 0, TAU, true);
  g.fill();
  g.restore();
  // 双层光带
  g.save();
  g.strokeStyle = "#7fc7d9";
  g.globalAlpha = g.globalAlpha * 0.3;
  g.lineWidth = 9;
  g.beginPath();
  g.arc(o.cx, o.cy, o.r, 0, TAU);
  g.stroke();
  g.restore();
  const pulse = o.soft ? 1 : 0.8 + 0.2 * Math.sin(t * 3);
  g.save();
  g.globalAlpha = g.globalAlpha * pulse;
  g.strokeStyle = "#7fc7d9";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(o.cx, o.cy, o.r, 0, TAU);
  g.stroke();
  g.strokeStyle = tint("#7fc7d9", 0.6);
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(o.cx, o.cy, Math.max(1, o.r - 4), 0, TAU);
  g.stroke();
  g.restore();
}

// ---------------------------------------------------------------------------
// 星光豆:五角星 + 柔光晕 + 哈希相位闪烁,预渲染 sprite
// ---------------------------------------------------------------------------

export interface StarBeanOpts {
  x: number;
  y: number;
  r: number;
  /** 0–1 相位(闪烁);soft 时忽略 */
  t?: number;
  soft?: boolean;
}

/** 星光豆金黄渐变的两端 */
export const BEAN_TOP = "#ffe066";
export const BEAN_BOTTOM = "#f5a623";

/** 哈希相位:同一颗豆每帧闪同一个节奏 */
export function beanPhase(x: number, y: number, t: number): number {
  const seed = ((fin(x) ? x : 0) * 13 + (fin(y) ? y : 0) * 7) % TAU;
  const v = ((fin(t) ? t : 0) * 0.9 + seed / TAU) % 1;
  return (v + 1) % 1;
}

/**
 * 星光豆直绘:柔光晕(soft 关) + 五角星金黄渐变 + 圆角描边 + 高光斑,
 * alpha 随相位在 0.75–1 之间缓慢闪。绝不再是「单次 arc + fill」。
 */
export function drawStarBean(g: Ctx, o: StarBeanOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  const r = o.r;
  const t = fin(o.t) ? ((o.t % 1) + 1) % 1 : 0;
  const twinkle = o.soft ? 1 : 0.75 + 0.25 * Math.sin(t * TAU);
  g.save();
  g.translate(o.x, o.y);
  g.globalAlpha = g.globalAlpha * twinkle;
  if (!o.soft) {
    const halo = g.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.2);
    halo.addColorStop(0, "rgba(255, 224, 102, 0.5)");
    halo.addColorStop(1, "rgba(255, 224, 102, 0)");
    g.fillStyle = halo;
    g.beginPath();
    g.arc(0, 0, r * 2.2, 0, TAU);
    g.fill();
  }
  const body = g.createLinearGradient(0, -r, 0, r);
  body.addColorStop(0, BEAN_TOP);
  body.addColorStop(1, BEAN_BOTTOM);
  g.fillStyle = body;
  starPath(g, 0, 0, r, r * 0.48);
  g.fill();
  g.strokeStyle = BEAN_BOTTOM;
  g.lineWidth = Math.max(0.8, r * 0.18);
  g.lineJoin = "round";
  g.lineCap = "round";
  g.stroke();
  g.fillStyle = KIT_PALETTE.cloud;
  g.beginPath();
  g.arc(-r * 0.26, -r * 0.3, r * 0.17, 0, TAU);
  g.fill();
  g.restore();
}

export interface BeanSprite {
  /** 离屏画布 */
  canvas: HTMLCanvasElement;
  /** 画布边长(px) */
  px: number;
  /** 烘焙时的星形外接半径 */
  bakedR: number;
}

export interface BeanSprites {
  small: BeanSprite;
  big: BeanSprite;
}

/**
 * 预渲染 2 种尺寸的星光豆 sprite(数百颗豆不许逐帧 beginPath 画星)。
 * 拿不到 document / 2D 上下文时返回 null,调用方退回 drawStarBean 直绘。
 */
export function makeBeanSprites(soft: boolean): BeanSprites | null {
  try {
    const doc = (globalThis as { document?: { createElement?: (t: string) => unknown } }).document;
    if (!doc || typeof doc.createElement !== "function") return null;
    const bake = (bakedR: number): BeanSprite | null => {
      const pad = soft ? 1.35 : 2.4;
      const px = Math.ceil(bakedR * 2 * pad);
      const canvas = doc.createElement!("canvas") as HTMLCanvasElement;
      canvas.width = px;
      canvas.height = px;
      const sg = canvas.getContext?.("2d");
      if (!sg) return null;
      drawStarBean(sg as Ctx, { x: px / 2, y: px / 2, r: bakedR, t: 0.25, soft });
      return { canvas, px, bakedR };
    };
    const small = bake(9);
    const big = bake(18);
    if (!small || !big) return null;
    return { small, big };
  } catch {
    return null;
  }
}

/**
 * 主循环画一颗豆:有 sprite 且上下文支持 drawImage 就贴图,否则直绘。
 * 闪烁只动 globalAlpha,sprite 一张贴到底。
 */
export function drawStarBeanFast(g: Ctx, sprites: BeanSprites | null, o: StarBeanOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  const canBlit = sprites !== null && typeof (g as { drawImage?: unknown }).drawImage === "function";
  if (!canBlit) {
    drawStarBean(g, o);
    return;
  }
  const sp = o.r > 5 ? sprites.big : sprites.small;
  const s = (o.r / sp.bakedR) * sp.px;
  const t = fin(o.t) ? ((o.t % 1) + 1) % 1 : 0;
  const twinkle = o.soft ? 1 : 0.75 + 0.25 * Math.sin(t * TAU);
  g.save();
  g.globalAlpha = g.globalAlpha * twinkle;
  g.drawImage(sp.canvas, o.x - s / 2, o.y - s / 2, s, s);
  g.restore();
}

// ---------------------------------------------------------------------------
// 掉落光点 → 糖果宝石
// ---------------------------------------------------------------------------

/** 宝石按价值分三档:粉 / 青 / 金 */
export const GEM_TIERS = [
  { min: 0, color: "#ff9ec4", scale: 1 },
  { min: 1.1, color: "#79e0d2", scale: 1.22 },
  { min: 2.2, color: "#ffd34e", scale: 1.45 }
] as const;

export function gemTier(value: number): 0 | 1 | 2 {
  const v = fin(value) ? value : 0;
  if (v >= GEM_TIERS[2].min) return 2;
  if (v >= GEM_TIERS[1].min) return 1;
  return 0;
}

/** 落地弹性:0.5s 内从 1.4 倍缩回 1 倍 */
export const GEM_POP_SEC = 0.5;

export function gemPopScale(age: number): number {
  if (!fin(age) || age >= GEM_POP_SEC) return 1;
  const p = Math.max(0, age) / GEM_POP_SEC;
  return 1 + 0.4 * (1 - p) * Math.abs(Math.cos(p * Math.PI * 2.5));
}

export interface GemDropOpts {
  x: number;
  y: number;
  r: number;
  value: number;
  /** 落地至今的秒数,驱动弹性缩放 */
  age?: number;
  soft?: boolean;
}

/** 糖果宝石:kit 的切面宝石 + 价值分档配色 + 落地弹性 */
export function drawGemDrop(g: Ctx, o: GemDropOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  const tier = gemTier(o.value);
  const pop = o.soft ? 1 : gemPopScale(fin(o.age) ? o.age : GEM_POP_SEC);
  g.save();
  g.translate(o.x, o.y);
  g.scale(pop, pop);
  drawGem(g, { x: 0, y: 0, r: o.r * GEM_TIERS[tier].scale, t: 0.15, color: GEM_TIERS[tier].color });
  g.restore();
}

// ---------------------------------------------------------------------------
// 糖果蟒:节点三层 + 花纹族 + 椭圆头 + 表情 + 头饰
// ---------------------------------------------------------------------------

export type PatternFamily = "stripe" | "dot" | "gradient" | "plain";

/** skins.ts 的花纹字段 → 渲染族(条纹 / 波点 / 渐变尾),不动皮肤数据本身 */
export function patternFamily(pattern: Skin["pattern"]): PatternFamily {
  switch (pattern) {
    case "stripe":
      return "stripe";
    case "dot":
      return "dot";
    case "rainbow":
      return "gradient";
    default:
      return "plain";
  }
}

/** 节点径向渐变缓存:同一上下文里同色同档半径只建一次 */
const nodeGradCache = new WeakMap<object, Map<string, CanvasGradient>>();

function nodeGradient(g: Ctx, color: string, r: number): CanvasGradient {
  let byCtx = nodeGradCache.get(g);
  if (!byCtx) {
    byCtx = new Map();
    nodeGradCache.set(g, byCtx);
  }
  const rb = Math.max(2, Math.round(r));
  const key = `${color}|${rb}`;
  let grad = byCtx.get(key);
  if (!grad) {
    grad = g.createRadialGradient(-rb * 0.25, -rb * 0.3, rb * 0.15, 0, 0, rb);
    grad.addColorStop(0, tint(color, 0.16));
    grad.addColorStop(1, shade(color, 0.1));
    byCtx.set(key, grad);
  }
  return grad;
}

export interface BodyNodeOpts {
  x: number;
  y: number;
  r: number;
  color: string;
  /** 行进法线(单位向量),背脊高光往这边偏 */
  nx?: number;
  ny?: number;
  pattern?: PatternFamily;
  index?: number;
  /** 只画渐变底(节间填缝用) */
  plain?: boolean;
}

/**
 * 蛇身单节三层:径向渐变底(中心亮、边暗) + 背脊高光带 + 花纹覆盖。
 */
export function drawBodyNode(g: Ctx, o: BodyNodeOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  const r = o.r;
  g.save();
  g.translate(o.x, o.y);
  g.fillStyle = nodeGradient(g, o.color, r);
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.fill();
  if (!o.plain) {
    // 背脊高光带:宽 0.5r 的浅色圆偏到行进法线上方
    const nx = fin(o.nx) ? o.nx : 0;
    const ny = fin(o.ny) ? o.ny : -1;
    const ga = g.globalAlpha;
    g.globalAlpha = ga * 0.5;
    g.fillStyle = tint(o.color, 0.42);
    g.beginPath();
    g.arc(nx * r * 0.32, ny * r * 0.32, r * 0.5, 0, TAU);
    g.fill();
    g.globalAlpha = ga;
    const idx = Math.max(0, Math.round(fin(o.index) ? o.index : 0));
    if (o.pattern === "dot" && idx % 4 === 0) {
      g.fillStyle = tint(o.color, 0.72);
      g.beginPath();
      g.arc(0, 0, r * 0.3, 0, TAU);
      g.fill();
    } else if (o.pattern === "stripe" && idx % 3 === 0) {
      g.strokeStyle = shade(o.color, 0.18);
      g.lineWidth = Math.max(0.8, r * 0.18);
      g.beginPath();
      g.arc(0, 0, r * 0.82, 0, TAU);
      g.stroke();
    }
  }
  g.restore();
}

export type HeadAccessory = "bow" | "cap" | null;

/** 双人 A/B 头饰:P1 朵朵红蝴蝶结,P2 星星蓝棒球帽(形状 + 颜色双通道) */
export function accessoryFor(human: "duo" | "star" | undefined): HeadAccessory {
  if (human === "duo") return "bow";
  if (human === "star") return "cap";
  return null;
}

export const BOW_COLOR = "#e8455f";
export const CAP_COLOR = "#4f86d9";

export interface SnakeHeadOpts {
  x: number;
  y: number;
  r: number;
  angle: number;
  color: string;
  boosting?: boolean;
  dead?: boolean;
  accessory?: HeadAccessory;
  soft?: boolean;
}

/**
 * 糖果蟒的头:沿行进方向拉伸 1.25 倍的椭圆(scale + arc 模拟) + 渐变 + 描边;
 * 双瞳带高光、两颗小鼻孔;boost 眯眼咧嘴;dead 走 X 眼分支(淡出由调用方的
 * globalAlpha 控制,这里不动它)。头饰画在屏幕坐标里,不跟头转。
 */
export function drawSnakeHead(g: Ctx, o: SnakeHeadOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  const r = o.r;
  const angle = fin(o.angle) ? o.angle : 0;
  g.save();
  g.translate(o.x, o.y);
  g.rotate(angle);
  // 椭圆头(前后拉伸 1.25)
  g.save();
  g.scale(1.25, 1);
  const grad = g.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.2, 0, 0, r * 1.05);
  grad.addColorStop(0, tint(o.color, 0.35));
  grad.addColorStop(1, shade(o.color, 0.08));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.fill();
  g.strokeStyle = shade(o.color, 0.3);
  g.lineWidth = Math.max(1, r * 0.1);
  g.stroke();
  g.restore();
  // 鼻孔
  g.fillStyle = shade(o.color, 0.42);
  g.beginPath();
  g.arc(r * 1.02, -r * 0.16, r * 0.07, 0, TAU);
  g.arc(r * 1.02, r * 0.16, r * 0.07, 0, TAU);
  g.fill();
  // 眼睛
  const ex = r * 0.42;
  const ey = r * 0.5;
  if (o.dead) {
    // X 眼:碎成糖果宝石之前的最后一帧表情,无血腥
    g.strokeStyle = KIT_PALETTE.ink;
    g.lineWidth = Math.max(1.2, r * 0.14);
    g.lineCap = "round";
    for (const s of [-1, 1]) {
      const k = r * 0.2;
      g.beginPath();
      g.moveTo(ex - k, s * ey - k);
      g.lineTo(ex + k, s * ey + k);
      g.moveTo(ex + k, s * ey - k);
      g.lineTo(ex - k, s * ey + k);
      g.stroke();
    }
  } else if (o.boosting) {
    // 眯眼 + 嘴角上扬
    g.strokeStyle = KIT_PALETTE.ink;
    g.lineWidth = Math.max(1.2, r * 0.13);
    g.lineCap = "round";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(ex, s * ey, r * 0.24, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    }
    g.strokeStyle = shade(o.color, 0.45);
    g.lineWidth = Math.max(1, r * 0.11);
    g.beginPath();
    g.arc(r * 0.82, 0, r * 0.22, -Math.PI * 0.35, Math.PI * 0.35);
    g.stroke();
  } else {
    for (const s of [-1, 1]) {
      g.fillStyle = KIT_PALETTE.cloud;
      g.beginPath();
      g.arc(ex, s * ey, r * 0.34, 0, TAU);
      g.fill();
      g.fillStyle = KIT_PALETTE.ink;
      g.beginPath();
      g.arc(ex + r * 0.07, s * ey, r * 0.17, 0, TAU);
      g.fill();
      g.fillStyle = KIT_PALETTE.cloud;
      g.beginPath();
      g.arc(ex + r * 0.02, s * ey - r * 0.07, r * 0.06, 0, TAU);
      g.fill();
    }
  }
  g.restore();
  // 头饰(屏幕坐标,始终立着,色弱下靠形状也能分)
  if (o.accessory === "bow") drawBow(g, o.x, o.y - r * 1.28, r * 0.6);
  else if (o.accessory === "cap") drawCap(g, o.x, o.y - r * 1.12, r * 0.85);
}

/** P1 红蝴蝶结:左右两翼 + 中心结 */
function drawBow(g: Ctx, x: number, y: number, s: number): void {
  g.save();
  g.translate(x, y);
  for (const dir of [-1, 1]) {
    g.fillStyle = dir < 0 ? BOW_COLOR : shade(BOW_COLOR, 0.12);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(dir * s * 1.5, -s * 0.7);
    g.lineTo(dir * s * 1.5, s * 0.7);
    g.closePath();
    g.fill();
  }
  g.fillStyle = tint(BOW_COLOR, 0.3);
  g.beginPath();
  g.arc(0, 0, s * 0.42, 0, TAU);
  g.fill();
  g.restore();
}

/** P2 蓝棒球帽:半圆帽顶 + 帽檐 + 顶扣 */
function drawCap(g: Ctx, x: number, y: number, s: number): void {
  g.save();
  g.translate(x, y);
  g.fillStyle = CAP_COLOR;
  g.beginPath();
  g.arc(0, 0, s, Math.PI, TAU);
  g.closePath();
  g.fill();
  g.strokeStyle = tint(CAP_COLOR, 0.45);
  g.lineWidth = Math.max(0.8, s * 0.12);
  g.beginPath();
  g.arc(-s * 0.28, -s * 0.28, s * 0.55, Math.PI * 0.95, Math.PI * 1.45);
  g.stroke();
  g.fillStyle = shade(CAP_COLOR, 0.22);
  g.fillRect(-s * 1.22, -s * 0.04, s * 2.44, s * 0.2);
  g.fillStyle = tint(CAP_COLOR, 0.35);
  g.beginPath();
  g.arc(0, -s * 0.92, s * 0.16, 0, TAU);
  g.fill();
  g.restore();
}

export interface NameTagOpts {
  x: number;
  y: number;
  text: string;
  color: string;
}

/** 白底胶囊名字牌:任何底色上都读得清 */
export function drawNameTag(g: Ctx, o: NameTagOpts): void {
  if (!fin(o.x) || !fin(o.y) || typeof o.text !== "string" || o.text.length === 0) return;
  const fontPx = 14;
  const hw = (o.text.length * fontPx) / 2 + 7;
  const hr = fontPx * 0.72;
  g.save();
  const ga = g.globalAlpha;
  g.globalAlpha = ga * 0.88;
  g.fillStyle = KIT_PALETTE.cloud;
  g.beginPath();
  g.arc(o.x - hw + hr, o.y, hr, Math.PI / 2, Math.PI * 1.5);
  g.arc(o.x + hw - hr, o.y, hr, Math.PI * 1.5, Math.PI / 2);
  g.closePath();
  g.fill();
  g.globalAlpha = ga;
  g.fillStyle = shade(o.color, 0.45);
  g.font = `800 ${fontPx}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(o.text, o.x, o.y);
  g.restore();
}

// ---------------------------------------------------------------------------
// 加速尾焰 → 星屑拖尾粒子(对象池,上限 40)
// ---------------------------------------------------------------------------

export interface Stardust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

export interface StardustPool {
  readonly parts: Stardust[];
  /** 在尾节后方撒一颗;池满且都活着就不撒 */
  spawn(x: number, y: number, angle: number, seed: number): void;
  /** 推进 dt 秒 */
  step(dt: number): void;
  /** 画进屏幕坐标(调用方给世界 → 屏幕映射) */
  draw(g: Ctx, toX: (x: number) => number, toY: (y: number) => number, zoom: number): void;
  /** 活着的粒子数 */
  alive(): number;
}

/** 星屑寿命(秒) */
export const STARDUST_LIFE = 0.3;
/** 池上限 */
export const STARDUST_MAX = 40;

export function makeStardustPool(max: number = STARDUST_MAX): StardustPool {
  const cap = Math.max(1, Math.round(fin(max) ? max : STARDUST_MAX));
  const parts: Stardust[] = [];
  const pool: StardustPool = {
    parts,
    spawn(x, y, angle, seed) {
      if (!fin(x) || !fin(y)) return;
      const a = (fin(angle) ? angle : 0) + Math.PI + Math.sin((fin(seed) ? seed : 0) * 2.4) * 0.55;
      const speed = 36 + ((fin(seed) ? Math.abs(seed) : 0) % 3) * 14;
      const dust: Stardust = {
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: STARDUST_LIFE,
        maxLife: STARDUST_LIFE,
        size: 3 + ((fin(seed) ? Math.abs(seed) : 0) % 2) * 1.4
      };
      const dead = parts.findIndex((p) => p.life <= 0);
      if (dead >= 0) parts[dead] = dust;
      else if (parts.length < cap) parts.push(dust);
    },
    step(dt) {
      if (!fin(dt) || dt <= 0) return;
      const d = dt;
      for (const p of parts) {
        if (p.life <= 0) continue;
        p.life = Math.max(0, p.life - d);
        p.x += p.vx * d;
        p.y += p.vy * d;
      }
    },
    draw(g, toX, toY, zoom) {
      const z = fin(zoom) && zoom > 0 ? zoom : 1;
      const ga = g.globalAlpha;
      for (const p of parts) {
        if (p.life <= 0) continue;
        const k = p.life / p.maxLife;
        g.globalAlpha = ga * k;
        drawSparkle(g, { x: toX(p.x), y: toY(p.y), r: Math.max(1.4, p.size * z * (0.4 + 0.6 * k)), t: 0.25, color: "#ffdf8f" });
      }
      g.globalAlpha = ga;
    },
    alive() {
      let n = 0;
      for (const p of parts) if (p.life > 0) n++;
      return n;
    }
  };
  return pool;
}

// ---------------------------------------------------------------------------
// 迷雾雷达 → 罗盘小地图
// ---------------------------------------------------------------------------

export interface RadarDot {
  /** 归一化坐标(-1..1,相对场半径) */
  x: number;
  y: number;
  color: string;
  me?: boolean;
}

export interface CompassOpts {
  cx: number;
  cy: number;
  r: number;
  t: number;
  soft?: boolean;
  dots: RadarDot[];
}

/**
 * 罗盘小地图:金属渐变外环 + 深色底 + 十字刻度 + 旋转扫描线(soft 关),
 * 自己的点保留 #E0508C 并加白描边。
 */
export function drawCompassRadar(g: Ctx, o: CompassOpts): void {
  if (!fin(o.cx) || !fin(o.cy) || !fin(o.r) || o.r <= 0) return;
  const t = fin(o.t) ? o.t : 0;
  g.save();
  // 深色底
  g.fillStyle = "rgba(30, 40, 66, 0.88)";
  g.beginPath();
  g.arc(o.cx, o.cy, o.r, 0, TAU);
  g.fill();
  // 金属渐变外环
  const ring = g.createLinearGradient(o.cx - o.r, o.cy - o.r, o.cx + o.r, o.cy + o.r);
  ring.addColorStop(0, "#ffe9a8");
  ring.addColorStop(0.5, "#c9a04e");
  ring.addColorStop(1, "#8a6420");
  g.strokeStyle = ring;
  g.lineWidth = Math.max(2, o.r * 0.1);
  g.beginPath();
  g.arc(o.cx, o.cy, o.r, 0, TAU);
  g.stroke();
  // 十字刻度
  g.strokeStyle = "rgba(159, 216, 255, 0.35)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(o.cx - o.r * 0.8, o.cy);
  g.lineTo(o.cx + o.r * 0.8, o.cy);
  g.moveTo(o.cx, o.cy - o.r * 0.8);
  g.lineTo(o.cx, o.cy + o.r * 0.8);
  g.stroke();
  // 扫描线(弱动效关)
  if (!o.soft) {
    g.save();
    g.translate(o.cx, o.cy);
    g.rotate(t * 1.4);
    g.fillStyle = "rgba(159, 216, 255, 0.14)";
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, o.r * 0.88, -0.6, 0);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(159, 216, 255, 0.75)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(o.r * 0.88, 0);
    g.stroke();
    g.restore();
  }
  // 点
  for (const d of o.dots ?? []) {
    if (!fin(d.x) || !fin(d.y)) continue;
    const px = o.cx + Math.max(-1, Math.min(1, d.x)) * (o.r - 4);
    const py = o.cy + Math.max(-1, Math.min(1, d.y)) * (o.r - 4);
    g.fillStyle = d.me ? "#E0508C" : d.color;
    g.beginPath();
    g.arc(px, py, d.me ? 4 : 3, 0, TAU);
    g.fill();
    if (d.me) {
      g.strokeStyle = KIT_PALETTE.cloud;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(px, py, 4, 0, TAU);
      g.stroke();
    }
  }
  g.restore();
}

// ---------------------------------------------------------------------------
// 结算:名次奖杯 + 长度曲线 + 拦截盾徽
// ---------------------------------------------------------------------------

/** 名次 → 杯色:金 / 银 / 铜 / 薄荷(参与奖) */
export const TROPHY_COLORS = ["#ffd34e", "#cdd6e4", "#d9a066", "#a5e6c8"] as const;

export function trophyColor(rank: number): string {
  const r = Math.max(1, Math.round(fin(rank) ? rank : 4));
  return TROPHY_COLORS[Math.min(3, r - 1)];
}

export interface TrophyOpts {
  x: number;
  y: number;
  r: number;
  rank: number;
}

/** 名次奖杯:杯身 + 双耳 + 杯座三阶光影 + 星光徽 */
export function drawTrophy(g: Ctx, o: TrophyOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  const r = o.r;
  const base = trophyColor(o.rank);
  g.save();
  g.translate(o.x, o.y);
  // 双耳
  g.strokeStyle = shade(base, 0.18);
  g.lineWidth = Math.max(1.5, r * 0.16);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(s * r * 0.82, -r * 0.55, r * 0.32, s < 0 ? Math.PI * 0.5 : Math.PI * 1.2, s < 0 ? Math.PI * 1.8 : Math.PI * 0.5 + TAU);
    g.stroke();
  }
  // 杯身:上沿矩形 + 半圆杯底
  g.fillStyle = base;
  g.fillRect(-r * 0.72, -r * 1.05, r * 1.44, r * 0.5);
  g.beginPath();
  g.arc(0, -r * 0.55, r * 0.72, 0, Math.PI);
  g.closePath();
  g.fill();
  // 侧面暗阶 + 左棱高光
  g.fillStyle = shade(base, 0.2);
  g.beginPath();
  g.arc(0, -r * 0.55, r * 0.72, 0, Math.PI * 0.5);
  g.lineTo(0, -r * 0.55);
  g.closePath();
  g.fill();
  g.strokeStyle = tint(base, 0.55);
  g.lineWidth = Math.max(1, r * 0.1);
  g.beginPath();
  g.moveTo(-r * 0.45, -r * 0.9);
  g.lineTo(-r * 0.45, -r * 0.3);
  g.stroke();
  // 杯颈与底座
  g.fillStyle = shade(base, 0.12);
  g.fillRect(-r * 0.14, r * 0.16, r * 0.28, r * 0.3);
  g.fillStyle = base;
  g.fillRect(-r * 0.5, r * 0.46, r, r * 0.2);
  g.fillStyle = shade(base, 0.28);
  g.fillRect(-r * 0.5, r * 0.58, r, r * 0.08);
  // 星光徽
  drawSparkle(g, { x: 0, y: -r * 0.5, r: r * 0.3, t: 0.25, color: KIT_PALETTE.cloud });
  g.restore();
}

export interface ShieldBadgeOpts {
  x: number;
  y: number;
  r: number;
  /** 拦下的条数 */
  count: number;
}

/** 拦截盾徽:盾形三阶 + 拦截数 */
export function drawShieldBadge(g: Ctx, o: ShieldBadgeOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  const r = o.r;
  const base = "#6fa8dc";
  g.save();
  g.translate(o.x, o.y);
  g.lineJoin = "round";
  const shield = (k: number): void => {
    g.beginPath();
    g.moveTo(-0.72 * r * k, -0.8 * r * k);
    g.lineTo(0.72 * r * k, -0.8 * r * k);
    g.lineTo(0.72 * r * k, 0.1 * r * k);
    g.lineTo(0, 0.9 * r * k);
    g.lineTo(-0.72 * r * k, 0.1 * r * k);
    g.closePath();
  };
  g.fillStyle = shade(base, 0.28);
  shield(1.08);
  g.fill();
  g.fillStyle = base;
  shield(1);
  g.fill();
  g.strokeStyle = tint(base, 0.5);
  g.lineWidth = Math.max(1, r * 0.08);
  shield(0.82);
  g.stroke();
  g.fillStyle = KIT_PALETTE.cloud;
  g.font = `900 ${Math.max(14, Math.round(r * 0.62))}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(Math.max(0, Math.round(fin(o.count) ? o.count : 0))), 0, -r * 0.06);
  g.restore();
}

export interface LengthCurveOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  points: readonly number[];
  color?: string;
}

/** 本局长度曲线:面积渐变 + 折线 + 端点 */
export function drawLengthCurve(g: Ctx, o: LengthCurveOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.w) || !fin(o.h) || o.w <= 0 || o.h <= 0) return;
  const pts = (o.points ?? []).filter((v) => fin(v));
  if (pts.length < 2) return;
  const color = typeof o.color === "string" ? o.color : "#4f9e6b";
  const max = Math.max(1, ...pts);
  const sx = (i: number): number => o.x + (i / (pts.length - 1)) * o.w;
  const sy = (v: number): number => o.y + o.h - (v / max) * o.h;
  g.save();
  // 面积
  const grad = g.createLinearGradient(0, o.y, 0, o.y + o.h);
  grad.addColorStop(0, "rgba(143, 217, 168, 0.5)");
  grad.addColorStop(1, "rgba(143, 217, 168, 0)");
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(sx(0), sy(pts[0]));
  for (let i = 1; i < pts.length; i++) g.lineTo(sx(i), sy(pts[i]));
  g.lineTo(o.x + o.w, o.y + o.h);
  g.lineTo(o.x, o.y + o.h);
  g.closePath();
  g.fill();
  // 折线
  g.strokeStyle = color;
  g.lineWidth = 2.4;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(sx(0), sy(pts[0]));
  for (let i = 1; i < pts.length; i++) g.lineTo(sx(i), sy(pts[i]));
  g.stroke();
  // 端点
  g.fillStyle = "#e0508c";
  g.beginPath();
  g.arc(sx(pts.length - 1), sy(pts[pts.length - 1]), 3.4, 0, TAU);
  g.fill();
  g.restore();
}

export interface SummaryOpts {
  w: number;
  h: number;
  rank: number;
  stops: number;
  curve: readonly number[];
}

/** 结算装饰画布:左奖杯(+拦截盾徽)、右长度曲线 */
export function drawSummary(g: Ctx, o: SummaryOpts): void {
  if (!fin(o.w) || !fin(o.h) || o.w <= 0 || o.h <= 0) return;
  g.save();
  g.clearRect(0, 0, o.w, o.h);
  drawTrophy(g, { x: o.w * 0.18, y: o.h * 0.52, r: o.h * 0.3, rank: o.rank });
  g.fillStyle = "#3f7a52";
  g.font = "800 14px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(`第 ${Math.max(1, Math.round(fin(o.rank) ? o.rank : 1))} 名`, o.w * 0.18, o.h * 0.93);
  if (fin(o.stops) && o.stops > 0) {
    drawShieldBadge(g, { x: o.w * 0.36, y: o.h * 0.3, r: o.h * 0.16, count: o.stops });
  }
  drawLengthCurve(g, { x: o.w * 0.46, y: o.h * 0.12, w: o.w * 0.5, h: o.h * 0.68, points: o.curve });
  g.fillText("本局长度曲线", o.w * 0.71, o.h * 0.93);
  g.restore();
}
