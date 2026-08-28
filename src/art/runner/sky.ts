/**
 * 1.3 第 1 步 C · 分层视差远景:渐变天幕 / 远景剪影 / 中景剪影 / 云层。
 *
 * 剪影与云全部程序化生成(多边形 + 圆弧),带 seed 保证同一颗种子出同一片天,
 * 不用任何位图。视差系数由远到近递增(越远滚得越慢),
 * `prefers-reduced-motion` 时系数一律按 0 处理(背景静止但仍然分层好看)。
 *
 * 地平线口径与 view25d.DEFAULT_HORIZON 一致,天空正好铺到跑道的消失线上,
 * 底部再叠一条雾化光带,把远处路面「化」进天里。
 */
import { DEFAULT_HORIZON } from "../../engine/view25d";

export interface SkyTheme {
  /** 天幕顶部色 */
  top: string;
  /** 天幕近地平线色 */
  bottom: string;
  /** 远景剪影色 */
  far: string;
  /** 中景剪影色 */
  mid: string;
  /** 云 / 星霭色 */
  cloud: string;
}

/** 彩虹糖果系白昼:淡蓝到奶粉的天,紫粉山影,白云 */
export const CANDY_SKY: SkyTheme = {
  top: "#aee3ff",
  bottom: "#ffe9f4",
  far: "#c9a6f0",
  mid: "#9fb8ef",
  cloud: "#ffffff",
};

/** 星夜系:深蓝夜空,墨蓝山影,月光色云霭 */
export const NIGHT_SKY: SkyTheme = {
  top: "#1c2350",
  bottom: "#4b3a7a",
  far: "#151a3c",
  mid: "#2a3163",
  cloud: "#8fa3e8",
};

export const SKY_THEMES: SkyTheme[] = [CANDY_SKY, NIGHT_SKY];

export type SkyLayerKind = "gradient" | "silhouette" | "cloud";

export interface SkyLayer {
  kind: SkyLayerKind;
  name: string;
  /** 视差系数:0 = 完全不动,越近越大 */
  parallax: number;
  color: string;
  /** 渐变层的第二个色(近地平线),其余层不用 */
  color2?: string;
  alpha: number;
  /** 一个循环单元有多宽(视宽倍数),平铺用 */
  span: number;
  /** 剪影最高能爬到地平线高度的多少(0..1) */
  rise: number;
  /**
   * 程序化控制点:
   *  - silhouette:归一化山脊高度序列(首尾相同,平铺无缝)
   *  - cloud:每朵云一组 [cx, cy, r](全部 0..1 归一)
   */
  points: number[];
}

/** 地平线雾化光带的透明度 */
export const HAZE_ALPHA = 0.18;
/** scroll 一个世界单位折算成多少像素的视差位移(系数 1 时) */
export const SKY_DRIFT_PX_PER_UNIT = 40;

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, finite(n, 0)));
}

/** 确定性伪随机(mulberry32):同 seed 出同一串数,天空才可测、可复现 */
function mulberry32(seed: number): () => number {
  let a = (finite(seed, 1) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 随机游走出一条平滑山脊,首尾同高保证平铺无缝 */
function ridgePoints(rand: () => number, n: number, lo: number, hi: number): number[] {
  const pts: number[] = [];
  let hgt = lo + (hi - lo) * rand();
  for (let i = 0; i < n; i++) {
    pts.push(hgt);
    hgt = Math.max(lo, Math.min(hi, hgt + (rand() - 0.5) * (hi - lo) * 0.6));
  }
  pts.push(pts[0]);
  return pts;
}

/** m 朵云的 [cx, cy, r] 序列 */
function cloudPoints(rand: () => number, m: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < m; i++) {
    pts.push((i + rand()) / m, 0.12 + rand() * 0.48, 0.05 + rand() * 0.07);
  }
  return pts;
}

/**
 * 造 ≥ 3 层天空:天幕(不动)→ 远景剪影 → 中景剪影 → 云层,
 * 视差系数按深度递减(排在前面的更远、系数更小)。
 */
export function makeSkyLayers(theme: SkyTheme, seed = 7): SkyLayer[] {
  const rand = mulberry32(seed);
  return [
    {
      kind: "gradient",
      name: "天幕",
      parallax: 0,
      color: theme.top,
      color2: theme.bottom,
      alpha: 1,
      span: 0,
      rise: 0,
      points: [],
    },
    {
      kind: "silhouette",
      name: "远景",
      parallax: 0.05,
      color: theme.far,
      alpha: 0.55,
      span: 1.6,
      rise: 0.52,
      points: ridgePoints(rand, 18, 0.35, 0.95),
    },
    {
      kind: "silhouette",
      name: "中景",
      parallax: 0.12,
      color: theme.mid,
      alpha: 0.75,
      span: 1.1,
      rise: 0.34,
      points: ridgePoints(rand, 14, 0.25, 0.85),
    },
    {
      kind: "cloud",
      name: "云层",
      parallax: 0.24,
      color: theme.cloud,
      alpha: 0.85,
      span: 1.4,
      rise: 0,
      points: cloudPoints(rand, 5),
    },
  ];
}

function drawSilhouette(
  ctx: CanvasRenderingContext2D,
  layer: SkyLayer,
  shift: number,
  w: number,
  horizon: number
): void {
  const pts = layer.points;
  if (pts.length < 2) return;
  const spanPx = Math.max(w * 0.2, layer.span * w);
  const n = pts.length - 1;
  const rise = horizon * clamp01(layer.rise);
  ctx.save();
  ctx.globalAlpha = clamp01(layer.alpha);
  ctx.fillStyle = layer.color;
  let guard = 0;
  for (let tileX = -shift - spanPx; tileX < w + spanPx && guard < 64; tileX += spanPx, guard++) {
    ctx.beginPath();
    ctx.moveTo(tileX, horizon);
    for (let i = 0; i <= n; i++) {
      ctx.lineTo(tileX + (i / n) * spanPx, horizon - clamp01(pts[i]) * rise);
    }
    ctx.lineTo(tileX + spanPx, horizon);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawClouds(
  ctx: CanvasRenderingContext2D,
  layer: SkyLayer,
  shift: number,
  w: number,
  horizon: number
): void {
  const pts = layer.points;
  const spanPx = Math.max(w, layer.span * w);
  ctx.save();
  ctx.globalAlpha = clamp01(layer.alpha);
  ctx.fillStyle = layer.color;
  for (let i = 0; i + 2 < pts.length; i += 3) {
    const baseX = (((pts[i] * spanPx - shift) % spanPx) + spanPx) % spanPx;
    const y = horizon * (0.08 + clamp01(pts[i + 1]) * 0.7);
    const r = Math.max(2, clamp01(pts[i + 2]) * w);
    // 左右各补一份,云飘出边缘时另一侧无缝接上
    for (const x of [baseX - spanPx, baseX]) {
      ctx.beginPath();
      ctx.arc(x - r * 0.6, y + r * 0.16, r * 0.5, 0, Math.PI * 2);
      ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
      ctx.arc(x + r * 0.6, y + r * 0.2, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/**
 * 把整组天空层画到地平线以上。reduced 为 true 时视差系数按 0 处理:
 * 背景完全静止(不随 scroll 移动),层次照旧。
 */
export function drawSky(
  ctx: CanvasRenderingContext2D,
  layers: SkyLayer[],
  scroll: number,
  viewW: number,
  viewH: number,
  reduced: boolean
): void {
  const w = finite(viewW, 0);
  const h = finite(viewH, 0);
  if (w <= 0 || h <= 0 || !Array.isArray(layers)) return;
  const horizon = Math.max(1, h * DEFAULT_HORIZON);
  const sc = finite(scroll, 0);
  let hazeColor = "#ffffff";

  for (const layer of layers) {
    if (!layer) continue;
    const factor = reduced ? 0 : Math.max(0, finite(layer.parallax, 0));
    const spanPx = Math.max(w * 0.2, finite(layer.span, 0) * w) || w;
    const shift = (((sc * factor * SKY_DRIFT_PX_PER_UNIT) % spanPx) + spanPx) % spanPx;
    if (layer.kind === "gradient") {
      const g = ctx.createLinearGradient(0, 0, 0, horizon);
      g.addColorStop(0, layer.color);
      g.addColorStop(1, layer.color2 ?? layer.color);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, horizon + h * 0.02);
      hazeColor = layer.color2 ?? layer.color;
    } else if (layer.kind === "silhouette") {
      drawSilhouette(ctx, layer, shift, w, horizon);
    } else {
      drawClouds(ctx, layer, shift, w, horizon);
    }
  }

  // 地平线雾化:一条淡淡的光带,把远处的路和山「化」进天里
  ctx.save();
  ctx.globalAlpha = HAZE_ALPHA;
  ctx.fillStyle = hazeColor;
  ctx.fillRect(0, horizon * 0.72, w, horizon * 0.5);
  ctx.restore();
}
