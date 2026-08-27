/**
 * 梨康双人冲刺 · 2.5D 伪三维投影与分屏布局（纯函数，不碰 canvas）。
 *
 * 用的是最朴素的针孔透视：把摄像机放在跑者后面 `CAM_DEPTH` 米处，
 * 前方 z 米的东西缩放成 `CAM_DEPTH / (CAM_DEPTH + z)`。
 *  · z = 0 落在画面底部（跑者脚下），缩放 1；
 *  · z 越大越靠近地平线，缩放趋近 0，三条道自然向一个点收拢；
 *  · 远端再叠一层雾，看起来有纵深。
 *
 * 全部是算术，没有任何依赖，所以坐标可以直接用单测钉住。
 */

export type SplitLayout = "column" | "row";

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 窄于这个宽度就上下分屏，宽了才左右分屏 */
export const SPLIT_BREAKPOINT = 720;

/** 画布最大宽度，再宽也不撑（大屏上留白比拉伸好看） */
export const MAX_STAGE_WIDTH = 960;

export function splitLayout(width: number): SplitLayout {
  return width < SPLIT_BREAKPOINT ? "column" : "row";
}

/**
 * 按可用宽度算出画布尺寸与分屏方向。
 * 上下分屏时每一格矮一点（两格叠起来才不会把手机屏顶穿），
 * 左右分屏时每一格宽一半、可以高一些。
 */
export function stageSize(availWidth: number): Size & { layout: SplitLayout } {
  const width = Math.max(260, Math.min(MAX_STAGE_WIDTH, Math.round(availWidth)));
  const layout = splitLayout(width);
  if (layout === "column") {
    const paneH = Math.round(Math.max(140, Math.min(240, width * 0.58)));
    return { width, height: paneH * 2, layout };
  }
  const paneH = Math.round(Math.max(230, Math.min(420, width * 0.36)));
  return { width, height: paneH, layout };
}

/** 两个人各自那一格的位置（0 = 鸭梨，1 = 康康）。 */
export function paneRects(size: Size, layout: SplitLayout): [Rect, Rect] {
  if (layout === "column") {
    const h = size.height / 2;
    return [
      { x: 0, y: 0, width: size.width, height: h },
      { x: 0, y: h, width: size.width, height: h },
    ];
  }
  const w = size.width / 2;
  return [
    { x: 0, y: 0, width: w, height: size.height },
    { x: w, y: 0, width: w, height: size.height },
  ];
}

/* ---------------- 透视 ---------------- */

/**
 * 摄像机到跑者的距离（米）：越小透视越夸张。
 * 这一款的速度是 46～96 米/秒，取小了的话前方几十米会全挤在地平线那一条缝里，
 * 障碍要到最后零点几秒才「唰」地长大，根本来不及看。34 米是让障碍
 * 在最后两三秒里稳稳变大的取值。
 */
export const CAM_DEPTH = 34;
/** 画到多远（米），再远就不画了 */
export const DRAW_DISTANCE = 190;
/** 地平线在一格里的高度比例 */
export const HORIZON_RATIO = 0.32;
/** z = 0 落在一格里的高度比例 */
export const GROUND_RATIO = 0.97;
/** 相邻两条道在 z = 0 时相隔多少（占一格宽度的比例） */
export const LANE_SPACING_RATIO = 0.29;

export interface Projected {
  x: number;
  y: number;
  /** 缩放系数：1 = 贴脸，趋近 0 = 地平线 */
  scale: number;
}

export function horizonY(pane: Rect): number {
  return pane.y + pane.height * HORIZON_RATIO;
}

export function groundY(pane: Rect): number {
  return pane.y + pane.height * GROUND_RATIO;
}

export function depthScale(z: number): number {
  return CAM_DEPTH / (CAM_DEPTH + Math.max(0, z));
}

/**
 * 把「前方 z 米、第 lane 条道」换算成屏幕坐标。
 * `lane` 允许带小数，换道动画就是让它在 0…2 之间平滑滑过去。
 */
export function project(pane: Rect, z: number, lane: number): Projected {
  const scale = depthScale(z);
  const top = horizonY(pane);
  const bottom = groundY(pane);
  return {
    x: pane.x + pane.width / 2 + (lane - 1) * LANE_SPACING_RATIO * pane.width * scale,
    y: top + (bottom - top) * scale,
    scale,
  };
}

/** 远处开始起雾的距离 */
export const FOG_START = 95;

/** 这个距离上要盖多浓的雾（0 = 清清楚楚，1 = 完全化进天空）。 */
export function fogAlpha(z: number): number {
  if (z <= FOG_START) return 0;
  const t = (z - FOG_START) / (DRAW_DISTANCE - FOG_START);
  return Math.max(0, Math.min(1, t));
}

/** 地面横向网格线的间隔（米） */
export const GRID_SPACING = 12;

/**
 * 跑到 dist 米时，前方该画哪几条横向网格线。
 * 用「离整数格还差多少」起头，线就会跟着人一直往后掠，看起来在动。
 */
export function gridLineZs(dist: number, spacing: number = GRID_SPACING): number[] {
  const step = spacing > 0 ? spacing : GRID_SPACING;
  const out: number[] = [];
  let z = step - (((dist % step) + step) % step);
  while (z < DRAW_DISTANCE) {
    out.push(z);
    z += step;
  }
  return out;
}

/**
 * 远景视差层的横向偏移：层越远（factor 越小）挪得越慢，
 * 结果永远落在 [0, period) 里，方便贴图循环平铺。
 */
export function parallaxOffset(dist: number, factor: number, period: number): number {
  if (!(period > 0)) return 0;
  const raw = dist * factor;
  return ((raw % period) + period) % period;
}

/** 跑者站在摄像机前面这么远的地方（米），留一点点前视距离 */
export const RUNNER_Z = 2;

/** 跳起来最高抬多高（占一格高度的比例，还要再乘透视缩放） */
export const JUMP_LIFT_RATIO = 0.2;

/**
 * 这个深度上「一条车道有多宽」（像素）。
 * 障碍与人物的尺寸全都按它换算，这样不管上下分屏还是左右分屏，
 * 石头永远占车道的同一个比例，不会窄屏一个样宽屏另一个样。
 */
export function laneWidthAt(pane: Rect, z: number): number {
  return LANE_SPACING_RATIO * pane.width * depthScale(z);
}

/** 跳跃的高度曲线：0 → 1 → 0 的一段抛物线，`t` 是本次跳跃的进度 0…1。 */
export function jumpArc(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  return 4 * t * (1 - t);
}

/** 下滑时人物压扁到多少（0…1 的进度，中段最扁）。 */
export function slideSquash(t: number): number {
  if (t <= 0 || t >= 1) return 1;
  return 1 - 0.45 * Math.sin(Math.PI * t);
}

/* ---------------- 换道手感与领先反馈（1.2 第 11 步 A 新增） ---------------- */

/**
 * 换一次道横着滑多久：100ms，正落在 80–120ms 这个「跟手但不生硬」的区间里。
 * `match.ts` 的 `LANE_LERP` 就是按它换算出来的。
 */
export const LANE_TWEEN_SECONDS = 0.1;

/** 指数插值的速率：跑 `LANE_TWEEN_SECONDS` 秒走完约 95% 的距离。 */
export function laneLerpRate(seconds: number = LANE_TWEEN_SECONDS): number {
  const s = seconds > 0 ? seconds : LANE_TWEEN_SECONDS;
  return 3 / s;
}

/** 换道时最多歪多少度（只是可爱的小侧倾，不是翻车） */
export const LANE_TILT_DEG = 9;

/**
 * 横移中的轻侧倾：还差多少道就歪多少，正在往右挪就往右歪。
 * `reduced` 为真（`prefers-reduced-motion`）时一律返回 0——位移保留，晃动关掉。
 */
export function laneTiltDeg(
  lane: number,
  laneFloat: number,
  reduced = false,
  maxDeg: number = LANE_TILT_DEG,
): number {
  if (reduced) return 0;
  const diff = Math.max(-1, Math.min(1, lane - laneFloat));
  return diff * maxDeg;
}

/** 撞击后的打晃幅度（`reduced` 下同样归零）。 */
export function bumpShake(bump: number, time: number, unit: number, reduced = false): number {
  if (reduced || bump <= 0) return 0;
  return Math.sin(time * 42) * unit * 0.12 * bump;
}

/** 领先者头顶的小皇冠画在哪儿（在跑者中心正上方一点点）。 */
export function crownOffset(unit: number): number {
  return unit * 0.72;
}
