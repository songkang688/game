/**
 * 共享美术套件 · 毛笔变宽笔迹（1.3 视觉升级 · 窗口8 A 档新增，独占文件，归 word-garden）。
 *
 * 只做**渲染层**的粗细计算：拿一条轨迹点集算出每个点的笔宽，再拼成一串圆头
 * `<line>` 片段。点集本身**只读不改**——描红判定用的还是原来那份数组，
 * 这里连一个元素都不 push（单测里 Object.freeze 钉着）。
 *
 * 工序（word-garden 规格 4.2）：
 *  1. 段宽 = 基准宽 ×（0.6–1.4），按点间距离（≈书写速度）反比映射：慢粗快细；
 *  2. 起笔顿点：首点宽 ×1.2，首段墨色加深一档；
 *  3. 收笔出锋：撇捺类末三段宽度线性收到 0.4 倍基准宽；横竖类圆头顿收（不收窄）。
 */
import { shade } from "./palette";

export type BrushPoint = readonly [number, number];

/** 变宽范围与顿笔 / 出锋参数（规格钉死的数字都在这一处） */
export const BRUSH = {
  /** 最快时的宽度比例 */
  minScale: 0.6,
  /** 最慢时的宽度比例 */
  maxScale: 1.4,
  /** 起笔顿点：首点宽再乘这个 */
  startBoost: 1.2,
  /** 撇捺类收笔出锋：末点宽收到基准宽的这个倍数 */
  taperEnd: 0.4,
  /** 出锋铺在最后几段上 */
  taperTail: 3,
} as const;

/** 笔画类型（只按笔画名判断，名字来自笔顺数据，只读不改） */
export type BrushKind = "taper" | "blunt";

/** 撇 / 捺 / 提要出锋收尖，横竖折钩点一律圆头顿收 */
export function strokeKindOf(name: string): BrushKind {
  return /[撇捺提]/.test(String(name ?? "")) ? "taper" : "blunt";
}

/**
 * 速度 → 宽度比例：`speed / refSpeed` 为 0 时最粗（1.4），等速时 1.0，
 * 两倍参考速度以上最细（0.6）。参考速度给不了（≤0 / 非数）时回 1。
 */
export function speedToWidthScale(speed: number, refSpeed: number): number {
  if (!Number.isFinite(speed) || !Number.isFinite(refSpeed) || refSpeed <= 0) return 1;
  const scale = BRUSH.maxScale - (BRUSH.maxScale - 1) * (Math.max(0, speed) / refSpeed);
  return Math.max(BRUSH.minScale, Math.min(BRUSH.maxScale, scale));
}

function segLen(a: BrushPoint, b: BrushPoint): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * 每个点的笔宽（数组长度 = 点数）。
 * 没有时间戳时用相邻点间距近似速度（指针事件采样节奏近似均匀）。
 * 输入点集只读；点数不足 2 时每个点都给基准宽。
 */
export function brushWidths(points: readonly BrushPoint[], base: number, kind: BrushKind = "blunt"): number[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) return [base];
  const lens: number[] = [];
  for (let i = 0; i + 1 < n; i++) lens.push(segLen(points[i], points[i + 1]));
  const ref = lens.reduce((s, v) => s + v, 0) / lens.length;
  const widths: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const speed = i === 0 ? lens[0] : lens[i - 1];
    widths[i] = base * speedToWidthScale(speed, ref);
  }
  // 起笔顿点：首点宽 ×1.2
  widths[0] *= BRUSH.startBoost;
  // 收笔出锋：撇捺类末三段线性收到 0.4 倍基准宽；横竖类靠圆头线帽顿收，不动宽度
  if (kind === "taper") {
    const tail = Math.min(BRUSH.taperTail, n - 1);
    const from = widths[n - 1 - tail];
    for (let j = 1; j <= tail; j++) {
      const t = j / tail;
      widths[n - 1 - tail + j] = from + (base * BRUSH.taperEnd - from) * t;
    }
  }
  return widths;
}

/**
 * 把折线按步长重采样（渲染用：让 2 个点的「横」也能画出连续的提按过渡）。
 * 返回**新数组**，原点集一个元素都不动；步长非法或点数不足时原样浅拷贝。
 */
export function resamplePoints(points: readonly BrushPoint[], step: number): BrushPoint[] {
  if (points.length < 2 || !Number.isFinite(step) || step <= 0) return points.slice();
  const out: BrushPoint[] = [points[0]];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = segLen(a, b);
    const parts = Math.max(1, Math.ceil(len / step));
    for (let j = 1; j <= parts; j++) {
      const t = j / parts;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function n2(v: number): string {
  return (Object.is(v, -0) ? 0 : v).toFixed(2);
}

/**
 * 把点集 + 每点笔宽拼成一串圆头 `<line>` 片段（调用方 innerHTML 即用）。
 * 首段用加深一档的墨色画「起笔顿点」；其余段用原色。
 * 只产出字符串，不碰 DOM，也不改点集。
 */
export function brushSvg(points: readonly BrushPoint[], widths: readonly number[], color: string): string {
  const out: string[] = [];
  const darker = shade(color, -14);
  for (let i = 0; i + 1 < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const w = ((widths[i] ?? 1) + (widths[i + 1] ?? widths[i] ?? 1)) / 2;
    const stroke = i === 0 ? darker : color;
    out.push(
      `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" stroke="${stroke}" ` +
        `stroke-width="${n2(w)}" stroke-linecap="round"/>`
    );
  }
  return out.join("");
}
