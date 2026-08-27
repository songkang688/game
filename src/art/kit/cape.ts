/**
 * 共享美术套件 · 披风三段飘动(1.3 第 22 步 C 档 `poop-hero` 首建,归 C 档所有)。
 *
 * 只输出几何与形态判定:静止垂落 / 跑动后飘 / 冲刺水平拉直,
 * 三段形态按速度阈值切换,切换时 180ms ease-out 过渡(reduced 瞬切)。
 * 上色(渐变 / 亮边)由调用方按自家配色板来,这里不带任何颜色。
 *
 * 单位空间约定:x 向身后为正(以披风全长为 1),y 向下为正(以披风全长为 1)。
 * 调用方乘上自己的披风长度,再按朝向翻转。**只读速度,绝不回写速度。**
 */

export type CapeMode = "rest" | "run" | "dash";

/** 低于它算站着(披风垂落),单位 px/s */
export const CAPE_RUN_SPEED = 40;
/** 达到它算冲刺(披风水平拉直),单位 px/s */
export const CAPE_DASH_SPEED = 420;
/** 形态过渡时长(ms),ease-out;reduced 瞬切 */
export const CAPE_BLEND_MS = 180;

/** 速度 → 三段形态:阈值映射只读速度 */
export function capeMode(speed: number): CapeMode {
  const s = Math.abs(speed);
  if (s >= CAPE_DASH_SPEED) return "dash";
  if (s >= CAPE_RUN_SPEED) return "run";
  return "rest";
}

export interface CapePoints {
  /** 下摆最远点:向身后多远 */
  tipX: number;
  /** 下摆最远点:向下多深(1 = 披风全长,越小越水平) */
  tipY: number;
  /** 上沿控制点(肩后拱起的位置) */
  liftX: number;
  liftY: number;
  /** 下摆随时间的摆动幅度(调用方叠 sin 相位用) */
  sway: number;
}

const SHAPES: Record<CapeMode, CapePoints> = {
  rest: { tipX: 0.16, tipY: 0.98, liftX: 0.42, liftY: 0.34, sway: 0.02 },
  run: { tipX: 0.72, tipY: 0.6, liftX: 0.78, liftY: 0.18, sway: 0.06 },
  dash: { tipX: 1.06, tipY: 0.22, liftX: 0.94, liftY: 0.08, sway: 0.03 },
};

/** 某一形态的静态控制点 */
export function capePoints(mode: CapeMode): CapePoints {
  return SHAPES[mode];
}

export function capeEaseOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) * (1 - c);
}

/**
 * 两形态之间按 ease-out 混合:`elapsedMs` 是切换后过去的毫秒数。
 * 到点(≥ CAPE_BLEND_MS)或 reduced 时直接落在目标形态上。
 */
export function blendCape(from: CapeMode, to: CapeMode, elapsedMs: number, reduced: boolean): CapePoints {
  if (reduced || elapsedMs >= CAPE_BLEND_MS || from === to) return { ...SHAPES[to] };
  const t = capeEaseOut(elapsedMs / CAPE_BLEND_MS);
  const a = SHAPES[from];
  const b = SHAPES[to];
  const mix = (x: number, y: number): number => x + (y - x) * t;
  return {
    tipX: mix(a.tipX, b.tipX),
    tipY: mix(a.tipY, b.tipY),
    liftX: mix(a.liftX, b.liftX),
    liftY: mix(a.liftY, b.liftY),
    sway: mix(a.sway, b.sway),
  };
}
