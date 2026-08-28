/**
 * 1.3 第 1 步 C · 深度精灵:按 z 投影缩放的绘制回调 + 自动落地阴影 + 雾化。
 *
 * 具体画什么由调用方的 `draw(ctx, screenX, screenY, scale)` 回调决定
 * (将来传素材包的金币 / 障碍 / 角色进来,本文件不认识它们,天然解耦)。
 * 本文件只负责三件事:project 投影与相机后剔除、椭圆落地阴影(随 scale 缩放)、
 * 按 view25d.fogAlpha 的口径把远处的精灵化进雾里。
 */
import {
  fogAlpha,
  project,
  sanitizeCamera,
  type Projected,
  type View25dCamera,
} from "../../engine/view25d";

/** 调用方的绘制回调:在 (screenX, screenY) 以 scale 倍率画自己 */
export type SpriteDraw = (
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  scale: number
) => void;

export interface DepthSprite {
  /** 世界 x(scale = 1 时的屏幕像素,向右为正) */
  x: number;
  /** 世界 y(向上为正,0 = 贴地) */
  y: number;
  /** 世界 z(向前为正,越大越远) */
  z: number;
  draw: SpriteDraw;
  /** 落地阴影半径(scale = 1 时的像素);0 = 不画影;缺省 SHADOW_BASE_RADIUS */
  shadowRadius?: number;
}

/** 缺省阴影半径(scale = 1 时) */
export const SHADOW_BASE_RADIUS = 26;
/** 阴影椭圆的纵横比:压得很扁才像贴在地上 */
export const SHADOW_FLATTEN = 0.32;
/** 阴影最深的透明度 */
export const SHADOW_ALPHA = 0.3;
/** 阴影用的深紫灰(不是纯黑,宪法「粉彩」方向) */
export const SHADOW_COLOR = "#1e1a3a";

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, finite(n, 0)));
}

/** 包装 view25d.fogAlpha:scale 越小(越远)雾越浓,近处(scale ≥ 1)为 0 */
export function fogTint(scale: number): number {
  return fogAlpha(scale);
}

/**
 * 把一个深度精灵画到屏幕上:先椭圆落地阴影(贴地投影处),再调 draw 回调,
 * 两者都按雾化强度降透明度。相机后面的精灵整个剔除(不调回调、不画影),
 * 返回 null;画了就返回投影结果,方便调用方做命中区或调试。
 */
export function drawAtDepth(
  ctx: CanvasRenderingContext2D,
  cam: View25dCamera,
  sprite: DepthSprite,
  viewW: number,
  viewH: number
): Projected | null {
  const c = sanitizeCamera(cam);
  const p = project(c, sprite.x, sprite.y, sprite.z, viewW, viewH);
  if (!p.visible) return null;
  const fog = fogTint(p.scale);
  const body = clamp01(1 - fog);

  const shadowR = Math.max(0, finite(sprite.shadowRadius ?? SHADOW_BASE_RADIUS, 0)) * p.scale;
  if (shadowR > 0) {
    const ground = project(c, sprite.x, 0, sprite.z, viewW, viewH);
    ctx.save();
    ctx.globalAlpha = body * SHADOW_ALPHA;
    ctx.fillStyle = SHADOW_COLOR;
    ctx.beginPath();
    ctx.ellipse(ground.x, ground.y, shadowR, shadowR * SHADOW_FLATTEN, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = body;
  sprite.draw(ctx, p.x, p.y, p.scale);
  ctx.restore();
  return p;
}

/**
 * 深度排序:远的先画(z 大在前),z 相同保持原有顺序(稳定)。
 * 返回新数组,不动原数组;NaN 的 z 按 0 参与排序,不抛。
 */
export function sortByDepth<T extends { z: number }>(items: readonly T[]): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => finite(b.item.z, 0) - finite(a.item.z, 0) || a.i - b.i)
    .map((e) => e.item);
}
