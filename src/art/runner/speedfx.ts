/**
 * 1.3 第 1 步 C · 速度与镜头:边缘向心速度线 + 变道微倾 / 落地轻震。
 *
 * 速度线从画面边缘指向中心,intensity 越大线越多、越亮;
 * 镜头微动返回的是「视口比例」的位移(dx / dy ≤ 1.5%)与角度(rot ≤ 1.2°),
 * 调用方乘视口尺寸再 translate / rotate。
 * `prefers-reduced-motion` 一票否决:速度线数量 0,镜头位移恒 0。
 */

/** intensity = 1 时最多几条速度线 */
export const MAX_SPEED_LINES = 28;
/** 镜头微动的位移上限(视口尺寸的比例) */
export const NUDGE_MAX_SHIFT = 0.015;
/** 镜头微动的旋转上限(度) */
export const NUDGE_MAX_ROT = 1.2;

export interface SpeedLine {
  /** 从中心指向边缘的方向角(弧度) */
  angle: number;
  /** 0..1 的相位,推进时向中心滑 */
  phase: number;
  /** 相位每秒推进多少 */
  speed: number;
  /** 线长(边缘半径的比例) */
  len: number;
  /** 线宽(像素) */
  width: number;
}

export interface SpeedLinesState {
  reduced: boolean;
  /** 0..1,进 makeSpeedLines 时已夹好 */
  intensity: number;
  lines: SpeedLine[];
}

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, finite(n, 0)));
}

/** 确定性伪随机(mulberry32),同 seed 出同一组线 */
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

/** 造一组速度线:数量 = intensity × MAX_SPEED_LINES,reduced 一律 0 条 */
export function makeSpeedLines(intensity: number, reduced: boolean, seed = 1): SpeedLinesState {
  const level = clamp01(intensity);
  const count = reduced ? 0 : Math.round(level * MAX_SPEED_LINES);
  const rand = mulberry32(seed);
  const lines: SpeedLine[] = [];
  for (let i = 0; i < count; i++) {
    lines.push({
      angle: rand() * Math.PI * 2,
      phase: rand(),
      speed: 0.7 + rand() * 1.1,
      len: 0.1 + rand() * 0.14,
      width: 1 + rand() * 2,
    });
  }
  return { reduced: reduced === true, intensity: level, lines };
}

/** 推进相位(dt 秒),相位在 [0, 1) 里循环,负 dt / NaN 不动 */
export function advanceSpeedLines(state: SpeedLinesState, dt: number): void {
  const step = finite(dt, 0);
  if (step <= 0 || !state) return;
  for (const line of state.lines) {
    line.phase = (((line.phase + line.speed * step) % 1) + 1) % 1;
  }
}

/** 画速度线:每条从边缘半径向中心收,相位越大离中心越近、越淡 */
export function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  state: SpeedLinesState,
  viewW: number,
  viewH: number
): void {
  const w = finite(viewW, 0);
  const h = finite(viewH, 0);
  if (w <= 0 || h <= 0 || !state || state.lines.length === 0) return;
  const cx = w / 2;
  const cy = h / 2;
  const edge = Math.hypot(cx, cy);
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#ffffff";
  for (const line of state.lines) {
    const p = clamp01(line.phase);
    const outer = edge * (1 - 0.3 * p);
    const inner = Math.max(edge * 0.34, outer - edge * clamp01(line.len) * (0.6 + state.intensity * 0.8));
    const ca = Math.cos(line.angle);
    const sa = Math.sin(line.angle);
    ctx.globalAlpha = clamp01(0.25 + 0.5 * state.intensity * (1 - p * 0.5));
    ctx.lineWidth = Math.max(1, finite(line.width, 1));
    ctx.beginPath();
    ctx.moveTo(cx + ca * outer, cy + sa * outer);
    ctx.lineTo(cx + ca * inner, cy + sa * inner);
    ctx.stroke();
  }
  ctx.restore();
}

export interface CameraNudge {
  /** 横向位移(视口宽度比例),|dx| ≤ NUDGE_MAX_SHIFT */
  dx: number;
  /** 纵向位移(视口高度比例),|dy| ≤ NUDGE_MAX_SHIFT */
  dy: number;
  /** 旋转(度),|rot| ≤ NUDGE_MAX_ROT */
  rot: number;
}

/**
 * 镜头微动。t 是动作进度,按 1 为周期循环(t 与 t+1 同相,首尾都归零,循环连续);
 *  - tilt:变道微倾,正弦鼓包,横移 + 小角度;
 *  - land:落地轻震,下沉后衰减回弹,只有纵向位移。
 * reduced 恒为 0;NaN 的 t 按 0。
 */
export function cameraNudge(t: number, kind: "tilt" | "land", reduced: boolean): CameraNudge {
  if (reduced) return { dx: 0, dy: 0, rot: 0 };
  const tt = finite(t, 0);
  const frac = ((tt % 1) + 1) % 1;
  if (kind === "tilt") {
    const s = Math.sin(Math.PI * frac);
    return {
      dx: NUDGE_MAX_SHIFT * s,
      dy: NUDGE_MAX_SHIFT * 0.2 * s,
      rot: NUDGE_MAX_ROT * s,
    };
  }
  // land:sin 鼓包再乘 (1 - frac) 衰减,峰值 ≈ 0.58,×1.5 仍在 1 以内
  const e = Math.sin(Math.PI * frac) * (1 - frac) * 1.5;
  return { dx: 0, dy: NUDGE_MAX_SHIFT * e, rot: 0 };
}
