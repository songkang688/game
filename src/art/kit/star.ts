/**
 * 共享美术套件 · 参数化五角星(1.3 视觉升级 · 第 16 步 C 档新增)。
 *
 * 「⭐ emoji 贴图」的下岗通知书:魔杖星头、裙面星纹、友方星弹这些地方
 * 以后都用这条参数化路径自绘 —— 齿数、内外径比、起始朝向全是参数,
 * 缺省就是教科书五角星:5 齿、相邻外顶点夹角 360°/5 = 72°、内径 0.42R。
 *
 * 纯几何函数,零 DOM;`tracePath` 只接受传进来的 2d 画笔,画完不收尾
 * (fill / stroke 由调用方决定,统一描边照旧走 `outline.ts`)。
 */

/** 缺省齿数:五角星 */
export const STAR_POINTS = 5;
/** 缺省内外径比:0.42 的腰身最像孩子画的星星 */
export const STAR_INNER_RATIO = 0.42;
/** 缺省起始角:第一颗齿朝正上(-90°) */
export const STAR_ROTATION = -Math.PI / 2;

export interface StarOpts {
  /** 齿数(≥3,缺省 5) */
  points?: number;
  /** 内径 / 外径(0..1,缺省 0.42) */
  inner?: number;
  /** 起始角(弧度,缺省 -π/2 即第一颗齿朝上) */
  rotation?: number;
}

/**
 * 星形顶点序列:外顶点与内凹点交替,共 `points * 2` 个,首尾相接即闭合。
 * 相邻两个**外顶点**的圆心角恰为 `2π / points`(五角星就是 72°)。
 * 参数不合法(齿数 < 3、半径 ≤ 0)时退回空数组,绘制层不许炸。
 */
export function starPoints(
  cx: number,
  cy: number,
  r: number,
  opts: StarOpts = {}
): Array<[number, number]> {
  const n = Math.floor(opts.points ?? STAR_POINTS);
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r) || r <= 0 || n < 3) {
    return [];
  }
  const inner = Math.max(0.05, Math.min(0.95, opts.inner ?? STAR_INNER_RATIO));
  const rot = opts.rotation ?? STAR_ROTATION;
  const out: Array<[number, number]> = [];
  const step = Math.PI / n;
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const ang = rot + i * step;
    out.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
  }
  return out;
}

/** 把一串顶点铺成当前路径(beginPath → moveTo/lineTo → closePath),不 fill 不 stroke */
export function tracePath(ctx: CanvasRenderingContext2D, pts: ReadonlyArray<readonly [number, number]>): void {
  if (pts.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** 一步到位:铺好星形路径(fill / stroke 仍由调用方决定) */
export function traceStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  opts: StarOpts = {}
): void {
  tracePath(ctx, starPoints(cx, cy, r, opts));
}
