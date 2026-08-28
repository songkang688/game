/**
 * 共享美术套件 · 果冻糖砖（candyBrick）：1.3 视觉升级 · 窗口 6 第 18 步 A 档落的文件。
 *
 * 把「一块平涂圆角矩形」升级成五道工序的糖果砖，供 brick-break / puzzle-tiles
 * 等一切要画「一格一格糖块」的游戏复用。全部程序化绘制、零依赖、零位图：
 *
 *  1. 底影：砖下 1px `CANDY_SHADOW` 线；
 *  2. 主体：圆角矩形（圆角 = 砖高 22%）主色平涂；
 *  3. 亮带：顶部 35% 高度、主色向白提 28%（果冻高光），同圆角裁剪；
 *  4. 暗边：底部 2px 主色压暗 18% + 外描边 1.5px 压暗 20%；
 *  5. 光斑：左上一粒 2px 圆形光斑（砖高 < 10px 时省略，只留亮带）。
 *
 * 多血砖附加：`crackPaths(seed, w, h, level)` 每掉一档血叠一层裂纹（两段折线），
 * 起点随 seed 固定——同 seed 两次调用路径完全相等，砖不会一帧一个裂法。
 *
 * 接口约定（定了就不改）：`paintCandyBrick(ctx, x, y, w, h, base, opts?)`，
 * 除了往 ctx 上描以外无任何副作用；颜色计算是纯函数，单测直接咬色值。
 */

/** 亮带：主色向白提这么多（0..1） */
export const CANDY_LIT_K = 0.28;
/** 底部暗边：主色压暗这么多 */
export const CANDY_DARK_K = 0.18;
/** 外描边：主色压暗这么多 */
export const CANDY_OUTLINE_K = 0.2;
/** 底影统一色（与 brick-break 的 bkShadow token 同值） */
export const CANDY_SHADOW = "rgba(93,74,110,.16)";
/** 砖高低于这个像素就省略光斑，只留亮带（360px 小屏的兜底） */
export const CANDY_MIN_SPARK_H = 10;
/** 圆角 = 砖高 × 这个比例 */
export const CANDY_RADIUS_K = 0.22;
/** 亮带占砖高的比例 */
export const CANDY_LIT_BAND_K = 0.35;
/** 亮带 / 暗边 / 描边 / 光斑各自的其余画法常量 */
export const CANDY_DARK_EDGE_PX = 2;
export const CANDY_OUTLINE_PX = 1.5;
export const CANDY_SPARK_PX = 2;
/** 裂纹描线色（糖面上的细缝，深而不黑） */
export const CANDY_CRACK = "rgba(74,58,88,.5)";

function hexParts(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** 主色向白提亮 k（0..1），返回 #rrggbb */
export function candyLighten(hex: string, k: number): string {
  const t = Math.max(0, Math.min(1, k));
  const [r, g, b] = hexParts(hex);
  const up = (x: number): number => Math.round(x + (255 - x) * t);
  return toHex(up(r), up(g), up(b));
}

/** 主色压暗 k（0..1），返回 #rrggbb */
export function candyDarken(hex: string, k: number): string {
  const t = Math.max(0, Math.min(1, k));
  const [r, g, b] = hexParts(hex);
  const down = (x: number): number => Math.round(x * (1 - t));
  return toHex(down(r), down(g), down(b));
}

export interface CandyColors {
  /** 主体色（就是传进来的 base） */
  body: string;
  /** 顶部亮带：+28% */
  lit: string;
  /** 底部暗边：-18% */
  dark: string;
  /** 外描边：-20% */
  outline: string;
}

/** 一块糖砖的三层色值（亮带 / 主体 / 暗边）与描边色，全部由主色推出 */
export function candyColors(base: string): CandyColors {
  return {
    body: base,
    lit: candyLighten(base, CANDY_LIT_K),
    dark: candyDarken(base, CANDY_DARK_K),
    outline: candyDarken(base, CANDY_OUTLINE_K)
  };
}

/** 光斑要不要画：砖高 < 10px 时省略（亮带永远保留） */
export function hasSpark(h: number): boolean {
  return h >= CANDY_MIN_SPARK_H;
}

/** 裂纹折线：三个点（两段折线），坐标是砖内相对值（0..w, 0..h） */
export type CrackPath = Array<[number, number]>;

function crackRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * level 层裂纹（掉几档血就几层）。同 seed 同 level 两次调用路径完全相等；
 * 只做绘制参考，绝不读写任何血量——层数由调用方从格子值换算出来传进来。
 */
export function crackPaths(seed: number, w: number, h: number, level: number): CrackPath[] {
  const n = Math.max(0, Math.floor(level));
  const out: CrackPath[] = [];
  const rng = crackRng(seed);
  for (let i = 0; i < n; i++) {
    // 起点在顶边中段，先折向砖心，再折向左右下角——两段折线像糖面敲出的细缝
    const x0 = w * (0.25 + rng() * 0.5);
    const y0 = h * 0.08;
    const x1 = x0 + (rng() - 0.5) * w * 0.3;
    const y1 = h * (0.4 + rng() * 0.2);
    const x2 = x1 + (i % 2 === 0 ? -1 : 1) * w * (0.12 + rng() * 0.18);
    const y2 = h * (0.78 + rng() * 0.14);
    const clamp = (v: number, hi: number): number => Math.max(1, Math.min(hi - 1, v));
    out.push([
      [clamp(x0, w), clamp(y0, h)],
      [clamp(x1, w), clamp(y1, h)],
      [clamp(x2, w), clamp(y2, h)]
    ]);
  }
  return out;
}

export interface CandyBrickOpts {
  /** 裂纹随机种子（同一块砖请传固定值，比如 行×31+列） */
  crackSeed?: number;
  /** 叠几层裂纹（多血砖掉了几档血） */
  cracks?: number;
}

/**
 * 五道工序把一块糖砖描到画布上。除了画画不做任何事：
 * 不改传入参数、不留全局状态，save/restore 自己配平。
 */
export function paintCandyBrick(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
  opts: CandyBrickOpts = {}
): void {
  if (w <= 0 || h <= 0) return;
  const colors = candyColors(base);
  const r = h * CANDY_RADIUS_K;

  ctx.save();

  // ① 底影：砖下 1px 阴影线
  ctx.fillStyle = CANDY_SHADOW;
  ctx.fillRect(x + 1, y + h, w - 2, 1);

  // ② 主体圆角矩形平涂
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = colors.body;
  ctx.fill();

  // ③④ 亮带与暗边都裁在主体圆角里
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  ctx.fillStyle = colors.lit;
  ctx.fillRect(x, y, w, h * CANDY_LIT_BAND_K);
  ctx.fillStyle = colors.dark;
  ctx.fillRect(x, y + h - CANDY_DARK_EDGE_PX, w, CANDY_DARK_EDGE_PX);

  // 多血砖的裂纹：也裁在砖体里，掉几档血叠几层
  const cracks = crackPaths(opts.crackSeed ?? 1, w, h, opts.cracks ?? 0);
  if (cracks.length > 0) {
    ctx.strokeStyle = CANDY_CRACK;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    for (const path of cracks) {
      ctx.beginPath();
      ctx.moveTo(x + path[0][0], y + path[0][1]);
      for (let i = 1; i < path.length; i++) ctx.lineTo(x + path[i][0], y + path[i][1]);
      ctx.stroke();
    }
  }
  ctx.restore();

  // ④ 外描边 1.5px
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = CANDY_OUTLINE_PX;
  ctx.stroke();

  // ⑤ 左上 2px 圆形光斑（矮砖省略，光源统一左上 45°）
  if (hasSpark(h)) {
    ctx.beginPath();
    ctx.arc(x + r + CANDY_SPARK_PX, y + h * 0.2 + 1, CANDY_SPARK_PX / 2 + 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fill();
  }

  ctx.restore();
}
