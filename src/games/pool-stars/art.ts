/**
 * 朵星台球 · 本款专属绘制资产（1.3 视觉升级）。
 *
 * `src/art/kit/` 共享套件尚未合入，按 visual-bible 第四节的口径先在本款落地：
 * 全部是「给一个 2D context 就能画」的纯函数 + 模块级 sprite 缓存，
 * 不碰任何玩法数值，物理、规则一个字也不 import。
 *
 * 命名约定：
 *  - `paintXxx(ctx, ...)`：以原点为中心往 ctx 上画，调用方自己 translate / rotate；
 *  - `xxxSprite(kind, r)`：预渲染到离屏 canvas 并缓存（16 球 × 60fps 的性能硬要求）。
 *
 * 阵营语义（形状 + 颜色双通道，色弱也分得开）：
 *  - warm（朵朵的暖色组）→ 白色五瓣小花压印；
 *  - cool（星星的冷色组）→ 白色五角星压印；
 *  - black（黑星球）→ 金色大五角星；
 *  - cue（母球）→ 纯白 + 一颗极淡蓝点。
 */
import type { BallKind } from "./physics";

// ---------------------------------------------------------------------------
// 调色板
// ---------------------------------------------------------------------------

export interface BallPalette {
  /** 球体主色 */
  base: string;
  /** 高光侧亮色（左上受光） */
  light: string;
  /** 背光侧暗色 */
  dark: string;
  /** 阵营压印色 */
  stamp: string;
}

export const BALL_COLORS: Record<BallKind, BallPalette> = {
  cue: { base: "#fdfdf7", light: "#ffffff", dark: "#d9d8c9", stamp: "#b8d4ec" },
  warm: { base: "#f4845f", light: "#ffb48f", dark: "#c25a3a", stamp: "#fff4ef" },
  cool: { base: "#5aa9e6", light: "#93ccff", dark: "#38719f", stamp: "#f2f8ff" },
  black: { base: "#3b3b52", light: "#63637f", dark: "#22222f", stamp: "#ffd25e" },
};

/** 黑星球金星的描边金（护口弧也用它） */
export const GOLD = "#e8b654";

/** 球画到多小时压印退化成一颗色点（像素半径；可辨阵营即可） */
export const SIMPLE_STAMP_R = 5;

/** sprite 用两倍分辨率预渲染，缩回去画的时候边缘更顺滑 */
export const SPRITE_SCALE = 2;

// ---------------------------------------------------------------------------
// 基础形状（星星 / 花朵 / 星光）
// ---------------------------------------------------------------------------

/** 以 (x, y) 为心补一条 n 角星的路径（不 beginPath 不 fill，调用方决定） */
export function traceStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outer: number,
  inner: number,
  points = 5
): void {
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** 五瓣小花：五个花瓣圆 + 花心，一笔填充 */
export function paintFlower(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  heartColor?: string
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const px = x + Math.cos(a) * r * 0.62;
    const py = y + Math.sin(a) * r * 0.62;
    ctx.moveTo(px + r * 0.42, py);
    ctx.arc(px, py, r * 0.42, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = heartColor ?? color;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** 四芒星光（进袋迸出的那种），以原点为心 */
export function paintSparkle(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  traceStar(ctx, 0, 0, r, r * 0.36, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// 球体
// ---------------------------------------------------------------------------

/**
 * 球体底层（不含阵营压印，压印单独一层才能跟着滚动转）。
 * 以原点为球心：径向渐变主体（高光点在左上）+ 顶部白高光斑 + 底部台呢反光暗弧 + 描边。
 */
export function paintBallBase(ctx: CanvasRenderingContext2D, kind: BallKind, r: number): void {
  const c = BALL_COLORS[kind];
  const body = ctx.createRadialGradient(-r * 0.34, -r * 0.38, r * 0.12, 0, 0, r * 1.12);
  body.addColorStop(0, c.light);
  body.addColorStop(0.55, c.base);
  body.addColorStop(1, c.dark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // 底部一弯台呢反光（绿色环境色打上来的暗弧）
  ctx.strokeStyle = "rgba(46,90,62,.28)";
  ctx.lineWidth = Math.max(1, r * 0.2);
  ctx.beginPath();
  ctx.arc(0, r * 0.08, r * 0.82, Math.PI * 0.22, Math.PI * 0.78);
  ctx.stroke();

  // 顶部白色高光斑（模糊边靠小径向渐变）
  const spot = ctx.createRadialGradient(-r * 0.38, -r * 0.42, 0, -r * 0.38, -r * 0.42, r * 0.34);
  spot.addColorStop(0, "rgba(255,255,255,.95)");
  spot.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spot;
  ctx.beginPath();
  ctx.arc(-r * 0.38, -r * 0.42, r * 0.34, 0, Math.PI * 2);
  ctx.fill();

  const rim = Math.max(1, r * 0.07);
  ctx.lineWidth = rim;
  ctx.strokeStyle = "rgba(30,44,36,.35)";
  ctx.beginPath();
  ctx.arc(0, 0, r - rim / 2, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * 阵营压印层（透明底，滚动时单独旋转）。
 * simple（默认按 r < SIMPLE_STAMP_R）时退化为一颗可辨阵营的色点（360px 红线）；
 * sprite 走两倍过采样，所以缓存入口按屏显半径另传 simple。
 */
export function paintBallStamp(
  ctx: CanvasRenderingContext2D,
  kind: BallKind,
  r: number,
  simple = r < SIMPLE_STAMP_R
): void {
  const c = BALL_COLORS[kind];
  if (simple) {
    // 极小尺寸：形状简化成点 / 菱形点，颜色仍分阵营
    if (kind === "cue") return; // 母球本来就纯白，小到这份上不用再点
    ctx.fillStyle = kind === "black" ? c.stamp : "rgba(255,255,255,.9)";
    ctx.beginPath();
    if (kind === "cool") {
      // 星星阵营用菱形点，和朵朵的圆点保持形状差
      ctx.moveTo(0, -r * 0.42);
      ctx.lineTo(r * 0.42, 0);
      ctx.lineTo(0, r * 0.42);
      ctx.lineTo(-r * 0.42, 0);
      ctx.closePath();
    } else {
      ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
    }
    ctx.fill();
    return;
  }
  if (kind === "cue") {
    // 母球：一颗极淡蓝点（帮小朋友看清母球在滚）
    ctx.fillStyle = c.stamp;
    ctx.beginPath();
    ctx.arc(r * 0.3, r * 0.1, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (kind === "warm") {
    ctx.globalAlpha = 0.85;
    paintFlower(ctx, 0, 0, r * 0.52, c.stamp, "#ffe0b8");
    ctx.globalAlpha = 1;
    return;
  }
  if (kind === "cool") {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = c.stamp;
    ctx.beginPath();
    traceStar(ctx, 0, 0, r * 0.56, r * 0.24, 5);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  // 黑星球：金色大五角星（替代旧的黄圆占位）
  ctx.fillStyle = c.stamp;
  ctx.beginPath();
  traceStar(ctx, 0, 0, r * 0.64, r * 0.27, 5);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  traceStar(ctx, 0, 0, r * 0.64, r * 0.27, 5);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// sprite 缓存（kind × 尺寸）
// ---------------------------------------------------------------------------

type Painter = (ctx: CanvasRenderingContext2D, r: number) => void;

const spriteCache = new Map<string, HTMLCanvasElement>();

function makeSprite(key: string, rPx: number, paint: Painter): HTMLCanvasElement {
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const r = Math.max(2, rPx) * SPRITE_SCALE;
  const size = Math.ceil(r * 2) + 4;
  const cv = document.createElement("canvas") as HTMLCanvasElement;
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d") as CanvasRenderingContext2D | null;
  if (ctx) {
    ctx.save();
    ctx.translate(size / 2, size / 2);
    paint(ctx, r);
    ctx.restore();
  }
  spriteCache.set(key, cv);
  return cv;
}

/** 球体底层 sprite（同 kind 同尺寸只画一次） */
export function ballSprite(kind: BallKind, rPx: number): HTMLCanvasElement {
  const q = Math.round(rPx * 4);
  return makeSprite(`b:${kind}:${q}`, rPx, (ctx, r) => paintBallBase(ctx, kind, r));
}

/** 阵营压印 sprite（透明底，滚动时旋转这一层） */
export function ballStampSprite(kind: BallKind, rPx: number): HTMLCanvasElement {
  const q = Math.round(rPx * 4);
  const simple = rPx < SIMPLE_STAMP_R;
  return makeSprite(`s:${kind}:${q}`, rPx, (ctx, r) => paintBallStamp(ctx, kind, r, simple));
}

/** 清空 sprite 缓存（单测在 DOM 桩装卸之间调用） */
export function resetArtCache(): void {
  spriteCache.clear();
}

// ---------------------------------------------------------------------------
// 球杆
// ---------------------------------------------------------------------------

/**
 * 球杆：沿 -x 方向画，杆尖在 (-gap, 0)、杆尾在 (-gap-len, 0)。
 * 调用方 translate 到母球心、rotate 到出杆角即可；蓄力时把 gap 拉大就是后拉。
 * 备注：整条渲染管线里只有球杆用 bezierCurveTo（杆尾圆弧），单测靠它认杆。
 */
export function paintCueStick(
  ctx: CanvasRenderingContext2D,
  gap: number,
  len: number,
  w: number
): void {
  const x0 = -gap;
  const x1 = -gap - len;
  const shaft = ctx.createLinearGradient(x0, 0, x1, 0);
  shaft.addColorStop(0, "#f0d7a8");
  shaft.addColorStop(0.12, "#dcae72");
  shaft.addColorStop(0.7, "#a06a3c");
  shaft.addColorStop(1, "#5c3a22");
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.moveTo(x0, -w * 0.38);
  ctx.lineTo(x1 + w, -w * 0.66);
  ctx.bezierCurveTo(x1 - w * 0.4, -w * 0.66, x1 - w * 0.4, w * 0.66, x1 + w, w * 0.66);
  ctx.lineTo(x0, w * 0.38);
  ctx.closePath();
  ctx.fill();

  // 深色握把（杆尾三成）
  ctx.fillStyle = "rgba(58,34,18,.85)";
  ctx.fillRect(x1 + w * 0.6, -w * 0.62, len * 0.26, w * 1.24);

  // 白色先角 + 蓝色皮头
  ctx.fillStyle = "#f6f2e8";
  ctx.fillRect(x0 - w * 1.5, -w * 0.4, w * 1.5, w * 0.8);
  ctx.fillStyle = "#4a76a8";
  ctx.beginPath();
  ctx.arc(x0 - w * 0.1, 0, w * 0.42, -Math.PI / 2, Math.PI / 2);
  ctx.fill();

  // 上缘一条受光高光
  ctx.strokeStyle = "rgba(255,255,255,.32)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0 - w, -w * 0.24);
  ctx.lineTo(x1 + len * 0.32, -w * 0.4);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// HUD / 结算用的 SVG 小球图标（DOM 里排剩余球、结算大图共用）
// ---------------------------------------------------------------------------

function starPointsAttr(cx: number, cy: number, outer: number, inner: number, points = 5): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** 一颗球的内联 SVG（装饰性图标，aria-hidden，文案另给） */
export function ballIconSvg(kind: BallKind, size: number): string {
  const c = BALL_COLORS[kind];
  const gid = `psb-${kind}`;
  const cx = 50;
  const cy = 50;
  let stamp = "";
  if (kind === "warm") {
    const petals: string[] = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      petals.push(
        `<circle cx="${(cx + Math.cos(a) * 17).toFixed(1)}" cy="${(cy + Math.sin(a) * 17).toFixed(1)}" r="11" fill="rgba(255,255,255,.88)"/>`
      );
    }
    stamp = `${petals.join("")}<circle cx="${cx}" cy="${cy}" r="8" fill="#ffe0b8"/>`;
  } else if (kind === "cool") {
    stamp = `<polygon points="${starPointsAttr(cx, cy, 26, 11)}" fill="rgba(255,255,255,.92)"/>`;
  } else if (kind === "black") {
    stamp = `<polygon points="${starPointsAttr(cx, cy, 30, 13)}" fill="${c.stamp}" stroke="${GOLD}" stroke-width="3"/>`;
  } else {
    stamp = `<circle cx="62" cy="55" r="7" fill="${c.stamp}"/>`;
  }
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">` +
    `<defs><radialGradient id="${gid}" cx="36%" cy="32%" r="78%">` +
    `<stop offset="0" stop-color="${c.light}"/><stop offset=".55" stop-color="${c.base}"/><stop offset="1" stop-color="${c.dark}"/>` +
    `</radialGradient></defs>` +
    `<circle cx="${cx}" cy="${cy}" r="46" fill="url(#${gid})" stroke="rgba(30,44,36,.35)" stroke-width="3"/>` +
    `<circle cx="34" cy="30" r="12" fill="rgba(255,255,255,.75)"/>` +
    stamp +
    `</svg>`
  );
}
