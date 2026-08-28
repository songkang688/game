/**
 * 1.3 素材包 · 通用收集物与障碍件（`src/art/kit/props.ts`）
 *
 * 金币 / 星星 / 爱心 / 宝石四种收集物，全部满足宪法第四节的三阶标准：
 * 边缘厚度（侧面暗阶）+ 至少一处高光 + 内圈细节。金币绝不是一个纯色圆。
 * 障碍件（圆润尖刺、双色阶木箱）与椭圆落地软阴影是所有会动实体的标配。
 *
 * 纯绘制函数：只吃传入的 ctx。极端输入（半径 ≤ 0、NaN）不抛、不画。
 */

import { KIT_PALETTE, shade, tint } from "./palette";

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function fin(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function norm01(t: number | undefined): number {
  if (!fin(t)) return 0;
  return ((t % 1) + 1) % 1;
}

/** 标准五角星路径（props 内部用） */
function starPath(
  ctx: Ctx,
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  rot = -Math.PI / 2,
  points = 5
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (i * Math.PI) / points;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export interface CoinOpts {
  x: number;
  y: number;
  /** 币面半径，必须 > 0 */
  r: number;
  /** 0–1 相位，驱动缓慢自转（横向压扁模拟） */
  t?: number;
  /** 自定义主色，默认星光金 */
  color?: string;
}

/**
 * 金币：边缘厚度（下移一圈的深金椭圆）→ 币面 → 内圈环 → 星形浮雕 → 高光斑。
 * `t` 让币面绕竖轴自转（宽度按余弦压扁），静止画面传 0 即可。
 */
export function drawCoin(ctx: Ctx, o: CoinOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  const r = o.r;
  const t = norm01(o.t);
  const base = typeof o.color === "string" ? o.color : KIT_PALETTE.starGold;
  // 自转横向压扁：最窄压到 0.35，不至于消失
  const squash = 0.35 + 0.65 * Math.abs(Math.cos(t * TAU));
  ctx.save();
  ctx.translate(o.x, o.y);
  // 1) 边缘厚度（侧面暗阶）
  ctx.fillStyle = shade(base, 0.42);
  ctx.beginPath();
  ctx.ellipse(0, r * 0.12, r * squash, r, 0, 0, TAU);
  ctx.fill();
  // 2) 币面底色
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * squash, r, 0, 0, TAU);
  ctx.fill();
  // 3) 内圈环
  ctx.strokeStyle = shade(base, 0.22);
  ctx.lineWidth = Math.max(r * 0.12, 0.5);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.68 * squash, r * 0.68, 0, 0, TAU);
  ctx.stroke();
  // 4) 内圈星形浮雕（随自转一起压扁）
  ctx.save();
  ctx.scale(Math.max(squash, 0.05), 1);
  ctx.fillStyle = shade(base, 0.32);
  starPath(ctx, 0, 0, r * 0.44, r * 0.19);
  ctx.fill();
  ctx.restore();
  // 5) 高光斑
  ctx.fillStyle = tint(base, 0.72);
  ctx.beginPath();
  ctx.ellipse(-r * 0.32 * squash, -r * 0.42, r * 0.2 * squash, r * 0.11, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export interface StarPropOpts {
  x: number;
  y: number;
  /** 外接半径，必须 > 0 */
  r: number;
  /** 0–1 相位，轻微脉动 */
  t?: number;
  color?: string;
}

/** 星星收集物：底影厚度 + 主体（同色圆角描边磨圆星尖）+ 高光斑 */
export function drawStar(ctx: Ctx, o: StarPropOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  const r = o.r;
  const t = norm01(o.t);
  const base = typeof o.color === "string" ? o.color : KIT_PALETTE.starGold;
  const pulse = 1 + 0.06 * Math.sin(t * TAU);
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(pulse, pulse);
  // 底影厚度
  ctx.fillStyle = shade(base, 0.35);
  starPath(ctx, 0, r * 0.1, r, r * 0.45);
  ctx.fill();
  // 主体 + 圆角
  ctx.fillStyle = base;
  starPath(ctx, 0, 0, r, r * 0.45);
  ctx.fill();
  ctx.strokeStyle = base;
  ctx.lineWidth = r * 0.16;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  // 高光
  ctx.fillStyle = tint(base, 0.65);
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.3, r * 0.16, r * 0.09, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export interface HeartOpts {
  x: number;
  y: number;
  /** 半宽尺度，必须 > 0 */
  r: number;
  /** 0–1 相位，心跳脉动 */
  t?: number;
  color?: string;
}

function heartPath(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.9);
  ctx.bezierCurveTo(cx - r * 1.15, cy + r * 0.15, cx - r * 0.75, cy - r * 0.85, cx, cy - r * 0.3);
  ctx.bezierCurveTo(cx + r * 0.75, cy - r * 0.85, cx + r * 1.15, cy + r * 0.15, cx, cy + r * 0.9);
  ctx.closePath();
}

/** 爱心：底影厚度 + 主体 + 左上高光，`t` 驱动心跳 */
export function drawHeart(ctx: Ctx, o: HeartOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  const r = o.r;
  const t = norm01(o.t);
  const base = typeof o.color === "string" ? o.color : KIT_PALETTE.candyDeep;
  const pulse = 1 + 0.08 * Math.sin(t * TAU);
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = shade(base, 0.32);
  heartPath(ctx, 0, r * 0.1, r);
  ctx.fill();
  ctx.fillStyle = base;
  heartPath(ctx, 0, 0, r);
  ctx.fill();
  ctx.fillStyle = tint(base, 0.55);
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.32, r * 0.2, r * 0.12, -0.55, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export interface GemOpts {
  x: number;
  y: number;
  /** 半宽尺度，必须 > 0 */
  r: number;
  /** 0–1 相位，微微闪烁 */
  t?: number;
  color?: string;
}

/** 宝石：切面结构 —— 主体、冠面亮阶、右下暗阶、四芒星光点 */
export function drawGem(ctx: Ctx, o: GemOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  const r = o.r;
  const t = norm01(o.t);
  const base = typeof o.color === "string" ? o.color : KIT_PALETTE.gem;
  const pulse = 1 + 0.05 * Math.sin(t * TAU);
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(pulse, pulse);
  ctx.lineJoin = "round";
  // 主体（钻石轮廓）
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, -r * 0.3);
  ctx.lineTo(-r * 0.3, -r * 0.72);
  ctx.lineTo(r * 0.3, -r * 0.72);
  ctx.lineTo(r * 0.62, -r * 0.3);
  ctx.lineTo(0, r * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(base, 0.35);
  ctx.lineWidth = Math.max(r * 0.06, 0.5);
  ctx.stroke();
  // 冠面亮阶
  ctx.fillStyle = tint(base, 0.35);
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, -r * 0.3);
  ctx.lineTo(-r * 0.3, -r * 0.72);
  ctx.lineTo(r * 0.3, -r * 0.72);
  ctx.lineTo(r * 0.62, -r * 0.3);
  ctx.closePath();
  ctx.fill();
  // 右下切面暗阶
  ctx.fillStyle = shade(base, 0.28);
  ctx.beginPath();
  ctx.moveTo(r * 0.62, -r * 0.3);
  ctx.lineTo(0, r * 0.8);
  ctx.lineTo(0, -r * 0.3);
  ctx.closePath();
  ctx.fill();
  // 四芒星光点
  ctx.fillStyle = KIT_PALETTE.cloud;
  starPath(ctx, -r * 0.18, -r * 0.44, r * 0.16, r * 0.05, -Math.PI / 2, 4);
  ctx.fill();
  ctx.restore();
}

export interface SpikeOpts {
  /** 底边中心 x */
  x: number;
  /** 地面基线 y */
  y: number;
  /** 底边宽度，必须 > 0 */
  w: number;
  /** 高度，缺省取 w 的 1.25 倍 */
  h?: number;
}

/** 圆润尖刺：圆头锥体 + 右侧暗面 + 左棱高光 + 底部珊瑚警示色带 */
export function drawSpike(ctx: Ctx, o: SpikeOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.w) || o.w <= 0) return;
  const w = o.w;
  const h = fin(o.h) && o.h > 0 ? o.h : w * 1.25;
  const base = KIT_PALETTE.stone;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.lineJoin = "round";
  // 主体：两侧鼓弧、顶部圆头
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(-w * 0.14, -h * 0.55, -w * 0.06, -h + w * 0.1);
  ctx.quadraticCurveTo(0, -h, w * 0.06, -h + w * 0.1);
  ctx.quadraticCurveTo(w * 0.14, -h * 0.55, w / 2, 0);
  ctx.closePath();
  ctx.fillStyle = base;
  ctx.fill();
  ctx.strokeStyle = shade(base, 0.35);
  ctx.lineWidth = Math.max(w * 0.04, 0.5);
  ctx.stroke();
  // 右侧暗面
  ctx.fillStyle = shade(base, 0.22);
  ctx.beginPath();
  ctx.moveTo(w * 0.02, -h + w * 0.12);
  ctx.quadraticCurveTo(w * 0.12, -h * 0.55, w * 0.42, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  // 左棱高光
  ctx.strokeStyle = tint(base, 0.55);
  ctx.lineWidth = Math.max(w * 0.05, 0.5);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w * 0.08, -h * 0.78);
  ctx.lineTo(-w * 0.17, -h * 0.32);
  ctx.stroke();
  // 底部警示色带（珊瑚 / 白相间，危险语义但保持圆润）
  const bandTop = -h * 0.26;
  const bandH = h * 0.14;
  const seg = w * 0.17;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? KIT_PALETTE.coral : KIT_PALETTE.cloud;
    ctx.fillRect(-seg * 2 + i * seg, bandTop, seg, bandH);
  }
  ctx.restore();
}

export interface CrateOpts {
  /** 底边中心 x */
  x: number;
  /** 地面基线 y */
  y: number;
  /** 宽度，必须 > 0 */
  w: number;
  /** 高度，缺省等于 w（正方箱） */
  h?: number;
}

/** 木箱：顶面亮阶 / 底部暗阶双色 + 板缝 + 对角撑木 + 四角铆钉 */
export function drawCrate(ctx: Ctx, o: CrateOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.w) || o.w <= 0) return;
  const w = o.w;
  const h = fin(o.h) && o.h > 0 ? o.h : w;
  const base = KIT_PALETTE.woodLight;
  ctx.save();
  ctx.translate(o.x, o.y);
  // 前脸底色
  ctx.fillStyle = base;
  ctx.fillRect(-w / 2, -h, w, h);
  // 顶面亮阶
  ctx.fillStyle = tint(base, 0.3);
  ctx.fillRect(-w / 2, -h, w, h * 0.18);
  // 底部暗阶
  ctx.fillStyle = shade(base, 0.25);
  ctx.fillRect(-w / 2, -h * 0.14, w, h * 0.14);
  // 竖板缝
  ctx.strokeStyle = shade(base, 0.35);
  ctx.lineWidth = Math.max(w * 0.03, 0.5);
  for (const fx of [-w / 6, w / 6]) {
    ctx.beginPath();
    ctx.moveTo(fx, -h * 0.94);
    ctx.lineTo(fx, -h * 0.06);
    ctx.stroke();
  }
  // 对角撑木
  ctx.strokeStyle = shade(base, 0.14);
  ctx.lineWidth = Math.max(w * 0.09, 0.8);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-w * 0.36, -h * 0.82);
  ctx.lineTo(w * 0.36, -h * 0.18);
  ctx.stroke();
  // 外框
  ctx.strokeStyle = KIT_PALETTE.woodDark;
  ctx.lineWidth = Math.max(w * 0.05, 0.8);
  ctx.strokeRect(-w / 2, -h, w, h);
  // 四角铆钉
  ctx.fillStyle = shade(KIT_PALETTE.woodDark, 0.15);
  for (const [nx, ny] of [
    [-w * 0.38, -h * 0.86],
    [w * 0.38, -h * 0.86],
    [-w * 0.38, -h * 0.14],
    [w * 0.38, -h * 0.14]
  ] as const) {
    ctx.beginPath();
    ctx.arc(nx, ny, Math.max(w * 0.035, 0.5), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export interface ShadowOpts {
  /** 阴影中心 x */
  x: number;
  /** 地面 y */
  y: number;
  /** 阴影全宽，必须 > 0 */
  w: number;
  /** 不透明度，缺省 0.16 */
  alpha?: number;
}

/** 椭圆落地软阴影：所有会动实体的标配 */
export function drawShadow(ctx: Ctx, o: ShadowOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.w) || o.w <= 0) return;
  const alpha = fin(o.alpha) ? Math.min(1, Math.max(0, o.alpha)) : 0.16;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = KIT_PALETTE.ink;
  ctx.beginPath();
  ctx.ellipse(o.x, o.y, o.w / 2, Math.max(o.w * 0.16, 0.5), 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}
