// 彩虹跑跑 · 2.5D 伪三维视图(1.1 第 6 步新增)
//
// 玩法仍然跑在原来的「平面轨道坐标」里:障碍存 trackY,判定用 HIT_WINDOW,
// 刷行用 ROW_GAP,一个数都没动。透视只发生在绘制那一刻——
// 这样换了画法也不会让战役的可通关性漂移。
//
// 相机模型只有一条公式:
//   scale(depth) = camDepth / (camDepth + depth)
//   y(depth)     = horizonY + (playerY - horizonY) * scale
// depth = 0 就是玩家脚下那条横线(scale 1),depth 越大越远、越小、越靠近地平线。
// 玩家身后 depth 为负,scale 大于 1,东西会往画面下方涌过来并且变大。
//
// 纯 Canvas 2D,不引入任何三维库。

/** 地平线落在画面高度的哪个位置。 */
export const HORIZON_RATIO = 0.3;
/** 相机距离 = (玩家线 - 地平线) × 这个系数,决定透视有多强。 */
export const CAM_DEPTH_RATIO = 1.35;
/** 贴到镜头跟前的东西最多放大到几倍,防止 depth 逼近 -camDepth 时炸开。 */
export const MAX_SCALE = 2.4;
/** 远到几乎看不见就不必再画了。 */
export const MIN_SCALE = 0.05;
/** 相邻两条车道中心相差多少个屏幕宽(和 index.ts 的 laneX 同一个数)。 */
export const LANE_SPREAD = 0.26;
/** 障碍在轨道坐标里从这么远的地方冒出来,正好落在地平线附近。 */
export const SPAWN_TRACK_Y = -680;

export interface Camera {
  /** 画面宽 */
  w: number;
  /** 画面高 */
  h: number;
  /** 地平线的屏幕 y */
  horizonY: number;
  /** 玩家脚下那条横线的屏幕 y(depth = 0) */
  playerY: number;
  /** 相机距离 */
  camDepth: number;
}

export function makeCamera(w: number, h: number): Camera {
  const horizonY = h * HORIZON_RATIO;
  const playerY = h * 0.78;
  return { w, h, horizonY, playerY, camDepth: (playerY - horizonY) * CAM_DEPTH_RATIO };
}

/** 轨道坐标 → 深度:玩家线前面为正,身后为负。 */
export function depthOf(cam: Camera, trackY: number): number {
  return cam.playerY - trackY;
}

/** 某个深度上的缩放倍率。 */
export function scaleAtDepth(cam: Camera, depth: number): number {
  const denom = cam.camDepth + depth;
  if (denom <= cam.camDepth / MAX_SCALE) return MAX_SCALE;
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, cam.camDepth / denom));
}

/** 某个深度上的屏幕 y。 */
export function screenYAtDepth(cam: Camera, depth: number): number {
  return cam.horizonY + (cam.playerY - cam.horizonY) * scaleAtDepth(cam, depth);
}

export interface Projected {
  x: number;
  y: number;
  scale: number;
}

/** 车道号(可以是小数,换道过程中用)在 scale = 1 时的横向偏移。 */
export function laneOffset(w: number, laneFloat: number): number {
  return (laneFloat - 1) * w * LANE_SPREAD;
}

/** 车道分隔线的第 j 条(0..3)在 scale = 1 时的横向偏移。 */
export function edgeOffset(w: number, j: number): number {
  return (j - 1.5) * w * LANE_SPREAD;
}

/** 把「scale = 1 时的屏幕 x」按透视收到消失点方向。 */
export function projectFlatX(cam: Camera, flatX: number, scale: number): number {
  const cx = cam.w / 2;
  return cx + (flatX - cx) * scale;
}

/** 轨道坐标 + 车道 → 屏幕坐标与缩放。 */
export function projectTrack(cam: Camera, trackY: number, laneFloat: number): Projected {
  const depth = depthOf(cam, trackY);
  const scale = scaleAtDepth(cam, depth);
  return {
    x: cam.w / 2 + laneOffset(cam.w, laneFloat) * scale,
    y: cam.horizonY + (cam.playerY - cam.horizonY) * scale,
    scale,
  };
}

/**
 * 地面横向网格线的深度表:等距铺开,随跑动往观察者方向涌。
 * 返回值一定落在 (0, maxDepth],由近到远排好。
 */
export function groundGridDepths(scroll: number, spacing: number, maxDepth: number): number[] {
  const out: number[] = [];
  if (spacing <= 0 || maxDepth <= 0) return out;
  const phase = ((scroll % spacing) + spacing) % spacing;
  for (let d = spacing - phase; d <= maxDepth; d += spacing) out.push(d);
  return out;
}

/** 雾从这个缩放倍率开始起效,再远就一点点化进天空里。 */
export const FOG_START_SCALE = 0.55;

/** 远端雾的浓度(0 = 清清楚楚,1 = 完全化进天空)。 */
export function fogAlpha(scale: number, maxAlpha = 0.82): number {
  if (scale >= FOG_START_SCALE) return 0;
  const t = Math.max(0, Math.min(1, (FOG_START_SCALE - scale) / FOG_START_SCALE));
  return t * t * maxAlpha;
}

export interface ParallaxLayer {
  name: string;
  /** 跟着跑动横移的系数,越小越远 */
  factor: number;
  /** 这一层的带子有多高(占地平线以上高度的比例) */
  height: number;
  alpha: number;
  /** 一个循环单元有多宽(占屏宽的比例) */
  span: number;
}

/** 远景视差层,由远到近三层;低端机会从最远那层开始砍。 */
export const PARALLAX_LAYERS: ParallaxLayer[] = [
  { name: "远山", factor: 0.05, height: 0.66, alpha: 0.28, span: 0.9 },
  { name: "云带", factor: 0.13, height: 0.42, alpha: 0.4, span: 0.62 },
  { name: "近树", factor: 0.29, height: 0.24, alpha: 0.55, span: 0.34 },
];

/** 某一层这一帧该横移多少(结果永远落在 [0, span) 里,方便平铺)。 */
export function parallaxShift(scroll: number, factor: number, span: number): number {
  if (span <= 0) return 0;
  const raw = (-scroll * factor) % span;
  return raw < 0 ? raw + span : raw;
}

/* ---------------- 帧率自适应 ---------------- */

export interface QualityTier {
  name: string;
  /** 画几层视差 */
  parallax: number;
  /** 粒子数量倍率 */
  particles: number;
  /** 地面网格线的深度间距(越大线越少) */
  gridSpacing: number;
  /** 要不要画车道虚线格 */
  laneDashes: boolean;
  /** 要不要画地面高光与阴影 */
  glow: boolean;
}

/** 三档画质:低端安卓掉帧就自动往后退一档。 */
export const QUALITY_TIERS: QualityTier[] = [
  { name: "细腻", parallax: 3, particles: 1, gridSpacing: 150, laneDashes: true, glow: true },
  { name: "顺畅", parallax: 2, particles: 0.6, gridSpacing: 230, laneDashes: true, glow: false },
  { name: "省电", parallax: 1, particles: 0.3, gridSpacing: 340, laneDashes: false, glow: false },
];

/** 掉到这个帧率以下就降一档。 */
export const FPS_DOWNGRADE = 45;
/** 回到这个帧率以上才敢升一档(和降档之间留一段,免得来回抖)。 */
export const FPS_UPGRADE = 55;

/** 指数平滑的帧率:单帧卡一下不会立刻把画质砍掉。 */
export function smoothFps(prevFps: number, dt: number, weight = 0.08): number {
  if (!(dt > 0)) return prevFps;
  const instant = Math.max(1, Math.min(240, 1 / dt));
  return prevFps + (instant - prevFps) * weight;
}

/** 按当前帧率决定下一帧用哪一档画质(带迟滞)。 */
export function nextQualityTier(tier: number, fps: number): number {
  const last = QUALITY_TIERS.length - 1;
  const cur = Math.max(0, Math.min(last, Math.round(tier)));
  if (fps < FPS_DOWNGRADE && cur < last) return cur + 1;
  if (fps > FPS_UPGRADE && cur > 0) return cur - 1;
  return cur;
}

/** 这一档该放几颗粒子(至少留一颗,不然反馈全没了)。 */
export function particleCount(base: number, tier: number): number {
  const t = QUALITY_TIERS[Math.max(0, Math.min(QUALITY_TIERS.length - 1, tier))];
  return Math.max(1, Math.round(base * t.particles));
}

/* ---------------- delta time ---------------- */

/** 一帧最多按 1/20 秒算:切后台回来不会瞬移一大截。 */
export const MAX_DT = 1 / 20;

export function clampDt(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(MAX_DT, ms / 1000);
}

/**
 * 帧率无关的指数逼近系数。
 * 连着走两个 dt/2 和一次性走一个 dt 结果完全一样,
 * 所以 60fps 和 30fps 下换道、镜头跟随的手感是一致的。
 */
export function smoothing(dt: number, rate: number): number {
  if (!(dt > 0) || rate <= 0) return 0;
  return 1 - Math.exp(-rate * dt);
}

/* ---------------- 配色小工具 ---------------- */

function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace("#", "");
  const full =
    s.length === 3
      ? s
          .split("")
          .map((c) => c + c)
          .join("")
      : s;
  const n = Number.parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/** 两个十六进制颜色按 t 混合(t = 0 取 a,t = 1 取 b)。 */
export function mixHex(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const to2 = (v: number): string => clamp255(v).toString(16).padStart(2, "0");
  return `#${to2(r1 + (r2 - r1) * k)}${to2(g1 + (g2 - g1) * k)}${to2(b1 + (b2 - b1) * k)}`;
}

/** 十六进制颜色 + 透明度 → rgba(),画雾和影子用。 */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}
