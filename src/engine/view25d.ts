/**
 * 1.2 新增:2.5D / 伪三维的透视投影数学(共享基建)。
 *
 * 这是一份自己实现的针孔透视:摄像机放在原点后方 `cameraZ` 处,
 * 前方 z 米的东西按 `cameraZ / (cameraZ + z)` 缩小,z 越大越靠近地平线。
 * 1.1 的跑酷与双人冲刺各写过一份同样口径的公式,这里收成一处,以后新游戏直接 import。
 *
 * 只有 Canvas 2D + 算术,没有任何三维库,也没有外部依赖。
 * 极端输入(视场角 0 / 180、视口宽高为 0、z 为负、NaN)一律给有限数值或 `visible: false`,
 * 绝不返回 NaN、绝不抛异常。
 */

export interface View25dCamera {
  kind: "flat" | "perspective";
  /** 视场角,度 */
  fov: number;
  /** 地平线在画布高度上的比例 0–1 */
  horizon: number;
  cameraY: number;
  cameraZ: number;
}

/** 贴到镜头跟前最多放大到几倍,免得 z 逼近 -cameraZ 时炸开 */
export const MAX_SCALE = 2.4;
/** 远到几乎看不见就当 0.02,别让缩放掉到 0 造成除零 */
export const MIN_SCALE = 0.02;
/** 缺省地平线位置(与 1.1 跑酷同口径) */
export const DEFAULT_HORIZON = 0.3;
/** 缺省视场角 */
export const DEFAULT_FOV = 60;

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, finite(n, lo)));
}

export function defaultCamera(kind: View25dCamera["kind"] = "perspective"): View25dCamera {
  return {
    kind: kind === "flat" ? "flat" : "perspective",
    fov: DEFAULT_FOV,
    horizon: DEFAULT_HORIZON,
    cameraY: 1,
    cameraZ: 6
  };
}

/** 把相机参数收拾到安全范围:视场角夹在 (0,180) 开区间内,相机距离至少 0.01 */
export function sanitizeCamera(cam: View25dCamera): View25dCamera {
  const kind = cam?.kind === "flat" ? "flat" : "perspective";
  return {
    kind,
    fov: clamp(cam?.fov ?? DEFAULT_FOV, 1, 179),
    horizon: clamp(cam?.horizon ?? DEFAULT_HORIZON, 0, 1),
    cameraY: finite(cam?.cameraY ?? 1, 1),
    cameraZ: Math.max(0.01, finite(cam?.cameraZ ?? 6, 6))
  };
}

/** 焦距:视场角越小看得越"长焦",画面里的东西越大 */
export function focalLength(cam: View25dCamera): number {
  const c = sanitizeCamera(cam);
  const halfFov = (c.fov * Math.PI) / 360;
  const t = Math.tan(halfFov);
  return t <= 0 ? 1 : 1 / t;
}

/** 某个深度上的缩放倍率:z 越大越小,相机后面按 MIN_SCALE 处理 */
export function scaleAtDepth(cam: View25dCamera, z: number): number {
  const c = sanitizeCamera(cam);
  if (c.kind === "flat") return 1;
  const depth = c.cameraZ + finite(z, 0);
  if (depth <= 0) return MIN_SCALE;
  return clamp(c.cameraZ / depth, MIN_SCALE, MAX_SCALE);
}

/** 地平线的屏幕 y */
export function horizonY(cam: View25dCamera, viewH: number): number {
  const c = sanitizeCamera(cam);
  const h = Math.max(0, finite(viewH, 0));
  return h * c.horizon;
}

export interface Projected {
  x: number;
  y: number;
  scale: number;
  visible: boolean;
}

/**
 * 世界 (x, y, z) → 画布像素。y 向上,z 向前(越大越远)。
 * 相机后面的点 `visible` 为 false,坐标仍旧给一个有限值方便调用方直接画裁剪。
 */
export function project(
  cam: View25dCamera,
  x: number,
  y: number,
  z: number,
  viewW: number,
  viewH: number
): Projected {
  const c = sanitizeCamera(cam);
  const w = Math.max(0, finite(viewW, 0));
  const h = Math.max(0, finite(viewH, 0));
  const wx = finite(x, 0);
  const wy = finite(y, 0);
  const wz = finite(z, 0);
  const hy = horizonY(c, h);

  if (c.kind === "flat") {
    // 降级成正交:缩放恒为 1,y 直接按世界坐标铺,谁都不会晕
    return { x: w / 2 + wx, y: h - wy, scale: 1, visible: true };
  }

  const depth = c.cameraZ + wz;
  const behind = depth <= 0;
  const scale = scaleAtDepth(c, wz);
  const f = focalLength(c) / focalLength(defaultCamera());
  const groundY = h;
  return {
    x: w / 2 + wx * scale * f,
    y: hy + (groundY - hy) * scale - wy * scale * f,
    scale,
    visible: !behind && scale > MIN_SCALE
  };
}

/**
 * 一段沿 z 轴的路面梯形,给跑酷 / 卡丁 / 球道画地面。
 * 返回四个点(近左、近右、远右、远左);整段都在相机后面时返回 null。
 */
export function roadQuad(
  cam: View25dCamera,
  z0: number,
  z1: number,
  halfWidth: number,
  viewW: number,
  viewH: number
): [number, number][] | null {
  const c = sanitizeCamera(cam);
  const near = Math.min(finite(z0, 0), finite(z1, 0));
  const far = Math.max(finite(z0, 0), finite(z1, 0));
  const hw = Math.abs(finite(halfWidth, 0));
  if (c.cameraZ + far <= 0) return null;

  const nl = project(c, -hw, 0, near, viewW, viewH);
  const nr = project(c, hw, 0, near, viewW, viewH);
  const fl = project(c, -hw, 0, far, viewW, viewH);
  const fr = project(c, hw, 0, far, viewW, viewH);
  if (!nl.visible && !fl.visible) return null;
  return [
    [nl.x, nl.y],
    [nr.x, nr.y],
    [fr.x, fr.y],
    [fl.x, fl.y]
  ];
}

/** 远处雾化透明度:越远(scale 越小)越浓,最多 maxAlpha */
export function fogAlpha(scale: number, maxAlpha = 0.7): number {
  const cap = clamp(maxAlpha, 0, 1);
  const s = clamp(scale, 0, MAX_SCALE);
  if (s >= 1) return 0;
  return clamp((1 - s) * cap, 0, cap);
}

/** 地面网格线的深度序列(递增,不超过 maxDepth),给滚动地面用 */
export function groundGridDepths(scroll: number, spacing: number, maxDepth: number): number[] {
  const step = Math.abs(finite(spacing, 0));
  const max = Math.max(0, finite(maxDepth, 0));
  if (step <= 0 || max <= 0) return [];
  const offset = ((finite(scroll, 0) % step) + step) % step;
  const out: number[] = [];
  // 上限保护:再密的网格也不生成超过 512 条,免得极端参数把主线程卡死
  for (let z = offset; z <= max && out.length < 512; z += step) out.push(z);
  return out;
}

/** prefers-reduced-motion 时降级成 flat:project 变正交,scale 恒为 1 */
export function respectReducedMotion(cam: View25dCamera, reduced: boolean): View25dCamera {
  const c = sanitizeCamera(cam);
  return reduced ? { ...c, kind: "flat" } : c;
}

/** `matchMedia` 的最小形状:只要能问一句、能读 matches 就够了 */
export type MediaQueryLike = (query: string) => { matches?: boolean } | null | undefined;

/** 减弱动效的那条媒体查询,写成常量免得各家抄错空格 */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * 系统有没有要求「减弱动效」。
 *
 * `respectReducedMotion` 只负责把相机降级,谁来算这个布尔值一直没人管,
 * 于是几款游戏各抄了一份 `matchMedia` 的 try/catch。收到这里统一一份:
 * 拿不到 `matchMedia`、调用抛异常、返回 null、返回的对象没有 `matches`,
 * 一律当「没要求减弱」返回 false —— 宁可动效照旧,也不要因为读不到偏好就把画面全静了。
 */
export function prefersReducedMotion(mm?: MediaQueryLike | null): boolean {
  const query = mm ?? (globalThis as { matchMedia?: MediaQueryLike }).matchMedia;
  if (typeof query !== "function") return false;
  try {
    return query(REDUCED_MOTION_QUERY)?.matches === true;
  } catch {
    return false;
  }
}

const STYLE_ID = "view25d-vars";

/** 可选:注入一次 CSS 变量(带固定 id,重复调用不重复插入) */
export function installView25dCss(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `:root{--v25-horizon:${DEFAULT_HORIZON};--v25-fog:0.7;}`;
  document.head.appendChild(style);
}
