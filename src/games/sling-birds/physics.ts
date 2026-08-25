/**
 * 弹弹小鸟 —— 纯物理 / 数学 / 评分函数。
 * 不依赖 DOM,方便单元测试;渲染与实体循环在 index.ts。
 */

/** 世界尺寸(canvas 逻辑分辨率) */
export const WORLD_W = 540;
export const WORLD_H = 340;
/** 地面表面 y 坐标 */
export const GROUND_Y = 312;
/** 重力加速度(px/s²) */
export const GRAVITY = 460;
/** 弹弓锚点(皮筋中心) */
export const SLING_X = 74;
export const SLING_Y = 236;
/** 最大拖拽半径 / 最大出弓速度 */
export const MAX_DRAG = 58;
export const MAX_LAUNCH = 560;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** 竖屏画布最多延展到世界高度的多少倍(再高就纯留白居中,不无限拉天空) */
export const MAX_BUFFER_RATIO = 2.6;

/**
 * 按舞台可用空间算画布缓冲高度(世界坐标):宽度固定 WORLD_W,
 * 竖屏时向上延展天空、向下延展泥土,让画面尽量填满舞台;
 * 横屏(box 比世界扁)保持原始 WORLD_H,不裁剪玩法区。
 */
export function canvasBufferHeight(boxW: number, boxH: number): number {
  if (!(boxW > 0) || !(boxH > 0)) return WORLD_H;
  const ideal = Math.round((boxH / boxW) * WORLD_W);
  return clamp(ideal, WORLD_H, Math.round(WORLD_H * MAX_BUFFER_RATIO));
}

/**
 * 把延展出来的高度拆成「上方天空 + 下方泥土」:
 * 天空占大头(高弧线的小鸟不再飞出画面),泥土只垫一点当装饰。
 */
export function padSplit(bufferH: number): { sky: number; ground: number } {
  const extra = Math.max(0, Math.round(bufferH) - WORLD_H);
  const sky = Math.round(extra * 0.72);
  return { sky, ground: extra - sky };
}

/** mulberry32 —— 确定性随机数,生成关卡时用同一个种子结果永远一样 */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 拖拽向量(指尖 - 锚点)→ 发射速度:方向相反,拉得越满越快,有上限 */
export function launchVelocity(dragX: number, dragY: number): { vx: number; vy: number } {
  const k = 9.6;
  let vx = -dragX * k;
  let vy = -dragY * k;
  const sp = Math.hypot(vx, vy);
  if (sp > MAX_LAUNCH) {
    vx = (vx / sp) * MAX_LAUNCH;
    vy = (vy / sp) * MAX_LAUNCH;
  }
  return { vx, vy };
}

export interface WindLike {
  x: number;
  y: number;
  w: number;
  h: number;
  fx: number;
  fy: number;
}

/**
 * 弹道预览点(与 index.ts stepBirds 同一套半隐式欧拉积分:
 * 风区加速 → 重力(乘小鸟重力系数) → 位移),保证预览虚线与实弹一致。
 * subStep 取 1/180 ≈ 实际飞行 60fps × 3 子步的步长。
 */
export function simulateTrajectory(
  x: number,
  y: number,
  vx: number,
  vy: number,
  gfactor = 1,
  winds: WindLike[] = [],
  count = 13,
  sampleEvery = 0.07,
  subStep = 1 / 180,
  gravity = GRAVITY
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  let px = x;
  let py = y;
  let pvx = vx;
  let pvy = vy;
  let acc = 0;
  const maxSteps = Math.ceil((count * sampleEvery) / subStep) + 8;
  for (let i = 0; i < maxSteps && pts.length < count; i++) {
    for (const w of winds) {
      if (px > w.x && px < w.x + w.w && py > w.y && py < w.y + w.h) {
        pvx += w.fx * subStep;
        pvy += w.fy * subStep;
      }
    }
    pvy += gravity * gfactor * subStep;
    px += pvx * subStep;
    py += pvy * subStep;
    acc += subStep;
    if (acc >= sampleEvery - 1e-9) {
      pts.push({ x: px, y: py });
      acc = 0;
    }
  }
  return pts;
}

/** 弹道预览点(不考虑风,给小朋友一个大概方向) */
export function trajectoryPoints(
  x: number,
  y: number,
  vx: number,
  vy: number,
  count = 14,
  step = 0.07,
  gravity = GRAVITY
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  let px = x;
  let py = y;
  let pvy = vy;
  for (let i = 0; i < count; i++) {
    px += vx * step;
    pvy += gravity * step;
    py += pvy * step;
    pts.push({ x: px, y: py });
  }
  return pts;
}

export interface Hit {
  /** 把圆从物体里推出去的单位法线 */
  nx: number;
  ny: number;
  /** 穿透深度 */
  depth: number;
}

/** 圆 vs 轴对齐矩形 */
export function circleRectHit(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): Hit | null {
  const px = clamp(cx, rx, rx + rw);
  const py = clamp(cy, ry, ry + rh);
  const dx = cx - px;
  const dy = cy - py;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }
  // 圆心在矩形内部:沿最浅的一侧推出
  const left = cx - rx;
  const right = rx + rw - cx;
  const top = cy - ry;
  const bottom = ry + rh - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === top) return { nx: 0, ny: -1, depth: top + r };
  if (m === bottom) return { nx: 0, ny: 1, depth: bottom + r };
  if (m === left) return { nx: -1, ny: 0, depth: left + r };
  return { nx: 1, ny: 0, depth: right + r };
}

export interface SlopeLike {
  x: number;
  y: number;
  w: number;
  h: number;
  /** up-right:左低右高;up-left:左高右低 */
  dir: "up-right" | "up-left";
}

/** 斜坡表面在横坐标 x 处的高度(表面 y) */
export function slopeSurfaceY(s: SlopeLike, x: number): number {
  const t = clamp((x - s.x) / s.w, 0, 1);
  return s.dir === "up-right" ? s.y + s.h - t * s.h : s.y + t * s.h;
}

/** 圆 vs 斜坡(斜边线段 + 实心内部) */
export function circleSlopeHit(cx: number, cy: number, r: number, s: SlopeLike): Hit | null {
  const x1 = s.x;
  const y1 = s.dir === "up-right" ? s.y + s.h : s.y;
  const x2 = s.x + s.w;
  const y2 = s.dir === "up-right" ? s.y : s.y + s.h;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  // 表面朝上的单位法线:(dy, -dx) 归一化后 y 分量必为负(朝上)
  const upNx = dy / len;
  const upNy = -dx / len;

  // 圆心在斜坡实体内部(表面下方、包围盒内)时,沿表面法线整体推出
  if (cx >= s.x && cx <= s.x + s.w && cy <= s.y + s.h) {
    const sy = slopeSurfaceY(s, cx);
    if (cy > sy) {
      const inside = (cy - sy) * Math.abs(upNy);
      return { nx: upNx, ny: upNy, depth: inside + r };
    }
  }

  // 圆 vs 斜边线段
  let t = ((cx - x1) * dx + (cy - y1) * dy) / (len * len);
  t = clamp(t, 0, 1);
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  let ox = cx - px;
  let oy = cy - py;
  const d = Math.hypot(ox, oy);
  if (d >= r) return null;
  if (d < 1e-6) return { nx: upNx, ny: upNy, depth: r };
  ox /= d;
  oy /= d;
  return { nx: ox, ny: oy, depth: r - d };
}

/** 撞击伤害:低速蹭一下不掉血,速度越快越疼 */
export function impactDamage(speed: number, power: number, vuln: number): number {
  return Math.max(0, speed - 70) * 0.3 * power * vuln;
}

/**
 * 三星评分:剩的小鸟多 → 3 星;破坏得很彻底也能补星。
 * birdsLeft = 没用到的小鸟数,destroyRatio ∈ [0,1]。
 */
export function calcStars(birdsLeft: number, destroyRatio: number): 1 | 2 | 3 {
  if (birdsLeft >= 2 || (birdsLeft >= 1 && destroyRatio >= 0.85)) return 3;
  if (birdsLeft >= 1 || destroyRatio >= 0.6) return 2;
  return 1;
}
