/**
 * 1.3 第 1 步 C · 跑道渲染:三车道透视路面、车道虚线、路肩滚动条纹、弯道偏移。
 *
 * 只 import `src/engine/view25d` 的透视数学(project / roadQuad / groundGridDepths /
 * scaleAtDepth),不改它、不重造第二套公式。纯 Canvas 2D,零外部依赖、零位图。
 *
 * 坐标口径与 view25d 相同:世界 x 是「scale = 1 时的屏幕像素」,z 向前为正(越大越远)。
 * 所以本文件里所有横向尺寸都以视宽 viewW 的比例给出,再乘 viewW 变成世界 x。
 *
 * 极端输入(NaN、视口 0、flat 相机)一律不抛、不出 NaN:flat / reduced 退化为
 * 平面俯视条带(垂直滚动的路肩条纹 + 直路),观感变平但结构语义不变。
 */
import {
  groundGridDepths,
  project,
  roadQuad,
  sanitizeCamera,
  scaleAtDepth,
  type View25dCamera,
} from "../../engine/view25d";

export interface TrackTheme {
  /** 路面主色 */
  road: string;
  /** 路肩底色(条纹之间露出来的) */
  shoulder: string;
  /** 车道分隔虚线 */
  laneLine: string;
  /** 路肩滚动条纹 A */
  stripeA: string;
  /** 路肩滚动条纹 B */
  stripeB: string;
}

/** 彩虹糖果系:粉彩紫路面、奶油虚线、粉黄条纹(宪法「Q 版粉彩」方向,全部原创色值) */
export const CANDY_TRACK: TrackTheme = {
  road: "#8d6fd1",
  shoulder: "#ffd9ec",
  laneLine: "#fff6d6",
  stripeA: "#ff9ecb",
  stripeB: "#ffe08a",
};

/** 星夜系:深蓝路面、月光虚线、蓝紫条纹 */
export const NIGHT_TRACK: TrackTheme = {
  road: "#2e3a67",
  shoulder: "#46548f",
  laneLine: "#cfe0ff",
  stripeA: "#7c8fd9",
  stripeB: "#3a477e",
};

export const TRACK_THEMES: TrackTheme[] = [CANDY_TRACK, NIGHT_TRACK];

/** 相邻两条车道中心相距多少个视宽(与 1.1 跑酷同量级,三条道正好铺满中屏) */
export const LANE_SPREAD = 0.26;
/** 路面半宽(视宽比例):盖住三条道再留一点边 */
export const ROAD_HALF_RATIO = 0.42;
/** 路肩外沿半宽(视宽比例):路面之外的条纹带 */
export const SHOULDER_HALF_RATIO = 0.5;
/** 一节条纹在 z 轴上的长度(世界单位) */
export const STRIPE_SPACING = 3;
/** 路面画到多远(世界单位),再远交给雾和天空 */
export const DRAW_DISTANCE = 60;
/** 弯道偏移的上限(视宽比例):再急的弯也不把路甩出屏幕 */
export const CURVE_MAX_RATIO = 0.32;
/** 弯道偏移在 z 轴上的饱和距离:z 远超它之后偏移趋于上限 */
export const CURVE_FALLOFF_Z = 24;

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, finite(n, lo)));
}

/**
 * 车道中心线的屏幕 x(直路)。lane 0/1/2 = 左/中/右,z 越大越向消失点收拢。
 * 透视里 y 不影响 x,所以 viewH 传 0 也不碍事。
 */
export function laneCenterX(
  lane: 0 | 1 | 2,
  z: number,
  cam: View25dCamera,
  viewW: number
): number {
  const w = Math.max(0, finite(viewW, 0));
  const idx = clamp(Math.round(lane), 0, 2);
  const worldX = (idx - 1) * LANE_SPREAD * w;
  return project(cam, worldX, 0, finite(z, 0), w, 0).x;
}

/**
 * 弯道 / 起伏的横向偏移,返回「视宽比例」(乘 viewW 再乘该深度的 scale 就是屏幕像素)。
 * 近处(z→0)偏移为 0 且导数为 0(路从脚下平滑弯出去),远处饱和到 CURVE_MAX_RATIO,
 * 永远有界;NaN / Infinity / 负 z 一律给 0。
 */
export function curveOffset(z: number, curvature: number): number {
  const k = clamp(finite(curvature, 0), -1, 1);
  const zz = finite(z, 0);
  if (zz <= 0 || k === 0) return 0;
  const s = zz / CURVE_FALLOFF_Z;
  const bounded = (s * s) / (1 + s * s);
  return k * CURVE_MAX_RATIO * bounded;
}

export interface TrackDrawOptions {
  /** 跑动里程(世界单位),驱动条纹与虚线滚动 */
  scroll: number;
  /** 弯道强度 -1..1,正值向右弯 */
  curvature: number;
  theme: TrackTheme;
}

/** 同一节条纹在世界里的编号:跟着 scroll 滑动时编号不变,颜色才不会闪 */
function stripeIndex(z0: number, scroll: number): number {
  return Math.round((z0 - scroll) / STRIPE_SPACING);
}

function fillQuad(
  ctx: CanvasRenderingContext2D,
  q: [number, number][],
  dxNear: number,
  dxFar: number
): void {
  ctx.beginPath();
  ctx.moveTo(q[0][0] + dxNear, q[0][1]);
  ctx.lineTo(q[1][0] + dxNear, q[1][1]);
  ctx.lineTo(q[2][0] + dxFar, q[2][1]);
  ctx.lineTo(q[3][0] + dxFar, q[3][1]);
  ctx.closePath();
  ctx.fill();
}

/** flat / reduced 退化:平面俯视条带,条纹垂直滚动,不搞任何透视 */
function drawFlatTrack(
  ctx: CanvasRenderingContext2D,
  opts: TrackDrawOptions,
  w: number,
  h: number
): void {
  const theme = opts.theme;
  const cx = w / 2;
  const halfRoad = w * ROAD_HALF_RATIO;
  const halfOut = w * SHOULDER_HALF_RATIO;
  const sc = finite(opts.scroll, 0);

  // 路肩底色
  ctx.fillStyle = theme.shoulder;
  ctx.fillRect(cx - halfOut, 0, halfOut - halfRoad, h);
  ctx.fillRect(cx + halfRoad, 0, halfOut - halfRoad, h);

  // 路肩条纹:按 scroll 垂直滚动(一节条纹 STRIPE_SPACING 个世界单位 = stripePx 像素)
  const stripePx = Math.max(10, h / 8);
  const period = stripePx * 2;
  const pxPerUnit = stripePx / STRIPE_SPACING;
  const phase = (((sc * pxPerUnit) % period) + period) % period;
  ctx.fillStyle = theme.stripeA;
  for (let y = phase - period; y < h; y += period) {
    ctx.fillRect(cx - halfOut, y, halfOut - halfRoad, stripePx);
    ctx.fillRect(cx + halfRoad, y, halfOut - halfRoad, stripePx);
  }

  // 路面 + 车道线(直路,不用弯道偏移,免得平面模式还晃)
  ctx.fillStyle = theme.road;
  ctx.fillRect(cx - halfRoad, 0, halfRoad * 2, h);
  ctx.strokeStyle = theme.laneLine;
  ctx.lineWidth = 2;
  for (const side of [-0.5, 0.5]) {
    const x = cx + side * LANE_SPREAD * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
}

/**
 * 由远及近画三车道跑道:路肩条纹梯形(交替 A/B 色)→ 路面梯形 → 车道虚线。
 * 段落边界来自 view25d.groundGridDepths(scroll 驱动),梯形来自 view25d.roadQuad,
 * 弯道用 curveOffset 在屏幕上按各自深度的 scale 平移。
 */
export function drawTrack(
  ctx: CanvasRenderingContext2D,
  cam: View25dCamera,
  opts: TrackDrawOptions,
  viewW: number,
  viewH: number
): void {
  const w = finite(viewW, 0);
  const h = finite(viewH, 0);
  if (w <= 0 || h <= 0 || !opts?.theme) return;
  const c = sanitizeCamera(cam);
  if (c.kind === "flat") {
    drawFlatTrack(ctx, opts, w, h);
    return;
  }

  const theme = opts.theme;
  const sc = finite(opts.scroll, 0);
  const halfRoad = w * ROAD_HALF_RATIO;
  const halfOut = w * SHOULDER_HALF_RATIO;
  const halfLane = (LANE_SPREAD / 2) * w;

  // 段落边界:0 与 DRAW_DISTANCE 之间按条纹间距切开,scroll 决定相位
  const raw = groundGridDepths(sc, STRIPE_SPACING, DRAW_DISTANCE);
  const bounds: number[] = [0];
  for (const z of raw) if (z > bounds[bounds.length - 1]) bounds.push(z);
  if (bounds[bounds.length - 1] < DRAW_DISTANCE) bounds.push(DRAW_DISTANCE);

  // 由远及近(画家算法):远段先画,近段盖上来
  for (let i = bounds.length - 2; i >= 0; i--) {
    const z0 = bounds[i];
    const z1 = bounds[i + 1];
    const dxNear = curveOffset(z0, opts.curvature) * w * scaleAtDepth(c, z0);
    const dxFar = curveOffset(z1, opts.curvature) * w * scaleAtDepth(c, z1);

    // 路肩条纹:整幅宽的梯形交替换色,路面随后盖住中间,只露出两侧条纹
    const outer = roadQuad(c, z0, z1, halfOut, w, h);
    if (outer) {
      ctx.fillStyle = stripeIndex(z0, sc) % 2 === 0 ? theme.stripeA : theme.stripeB;
      fillQuad(ctx, outer, dxNear, dxFar);
    }

    const road = roadQuad(c, z0, z1, halfRoad, w, h);
    if (road) {
      ctx.fillStyle = theme.road;
      fillQuad(ctx, road, dxNear, dxFar);
    }

    // 车道分隔虚线:隔一节画一节,和条纹同相位地滚
    if (stripeIndex(z0, sc) % 2 === 0) {
      for (const bx of [-halfLane, halfLane]) {
        const n = project(c, bx, 0, z0, w, h);
        const f = project(c, bx, 0, z1, w, h);
        if (!n.visible && !f.visible) continue;
        ctx.strokeStyle = theme.laneLine;
        ctx.lineWidth = Math.max(1, 3 * n.scale);
        ctx.beginPath();
        ctx.moveTo(n.x + dxNear, n.y);
        ctx.lineTo(f.x + dxFar, f.y);
        ctx.stroke();
      }
    }
  }
}
