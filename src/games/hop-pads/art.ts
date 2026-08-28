/**
 * 跳跳台 · 1.3 视觉资产库(纯绘制函数与查表,不碰任何玩法数值)。
 *
 * `src/art/kit/` 尚未建立,按 visual-bible 的约定把本款要用的共享资产收在这一份里:
 * 角色(朵朵/星星)的表情四肢、台面种类图案、完美落点粒子、天空时段查表、
 * 深度雾曲线、救援云、蓄力力度环、结算进度环。全部是给定输入必出同一串
 * 绘制调用的纯函数,视觉契约测试拿录制型上下文直接断言。
 */
import { clamp01 } from "./physics";

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------------------
// 调色工具
// ---------------------------------------------------------------------------

/** 两个 #RRGGBB 颜色按 t 插值,输出恒为大写 #RRGGBB(t=0 时原样吐回 a) */
export function mixColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const k = clamp01(t);
  const ch = (sh: number): number => {
    const va = (pa >> sh) & 255;
    const vb = (pb >> sh) & 255;
    return Math.round(va + (vb - va) * k);
  };
  const to2 = (v: number): string => v.toString(16).toUpperCase().padStart(2, "0");
  return `#${to2(ch(16))}${to2(ch(8))}${to2(ch(0))}`;
}

// ---------------------------------------------------------------------------
// 天空时段:白天 → 黄昏 → 星夜(无尽模式每 TIME_HOPS 跳渐变一段)
// ---------------------------------------------------------------------------

export interface SkyTheme {
  /** 天顶色 */
  top: string;
  /** 地平线色(也是深度雾的罩色) */
  horizon: string;
  /** 地平线以下的地面色 */
  ground: string;
  /** 远山剪影色 */
  hill: string;
  /** 中景漂浮小岛剪影色 */
  island: string;
  /** 远景大云色 */
  cloud: string;
  /** 画布上闪话的墨色(星夜换成奶白,保证对比度) */
  ink: string;
  /** 星星颗数(只有星夜 > 0) */
  stars: number;
}

/** 三个时段的查表:0 白天 / 1 黄昏 / 2 星夜 */
export const SKY_THEMES: readonly SkyTheme[] = [
  {
    top: "#BFE3FF",
    horizon: "#FFF3D9",
    ground: "#FFEBD2",
    hill: "#BCD4EC",
    island: "#9FC490",
    cloud: "#FFFFFF",
    ink: "#8A5330",
    stars: 0,
  },
  {
    top: "#FFC48F",
    horizon: "#FFE9C8",
    ground: "#FFDFBC",
    hill: "#D9A8B8",
    island: "#B08BA0",
    cloud: "#FFE9D6",
    ink: "#7A4A28",
    stars: 0,
  },
  {
    top: "#31396E",
    horizon: "#8B93CC",
    ground: "#7E86BE",
    hill: "#4A5390",
    island: "#3C4480",
    cloud: "#9BA3D6",
    ink: "#FFF4E0",
    stars: 14,
  },
];

/** 无尽模式多少跳换一个时段 */
export const TIME_HOPS = 20;

/** 按跳数取当刻天空(非无尽恒为白天;无尽在相邻时段之间查表插值) */
export function skyTheme(hops: number, endless: boolean): SkyTheme {
  if (!endless) return SKY_THEMES[0];
  const n = Math.max(0, hops);
  const seg = Math.floor(n / TIME_HOPS);
  const t = (n % TIME_HOPS) / TIME_HOPS;
  const a = SKY_THEMES[seg % SKY_THEMES.length];
  const b = SKY_THEMES[(seg + 1) % SKY_THEMES.length];
  return {
    top: mixColor(a.top, b.top, t),
    horizon: mixColor(a.horizon, b.horizon, t),
    ground: mixColor(a.ground, b.ground, t),
    hill: mixColor(a.hill, b.hill, t),
    island: mixColor(a.island, b.island, t),
    cloud: mixColor(a.cloud, b.cloud, t),
    ink: mixColor(a.ink, b.ink, t),
    stars: Math.round(a.stars + (b.stars - a.stars) * t),
  };
}

// ---------------------------------------------------------------------------
// 深度雾:远处台子叠一层淡天空色,拉开纵深
// ---------------------------------------------------------------------------

/** 雾最浓只到这个透明度,再远也不会把台子糊没 */
export const FOG_MAX = 0.35;
/** 比镜头远这么多(世界单位)才开始起雾 */
export const FOG_NEAR = 140;
/** 到这个距离雾就到顶 */
export const FOG_FAR = 560;

/** z 距离 → 雾罩透明度(0 → FOG_MAX,严格单调不减) */
export function fogAlpha(dz: number): number {
  return clamp01((dz - FOG_NEAR) / (FOG_FAR - FOG_NEAR)) * FOG_MAX;
}

// ---------------------------------------------------------------------------
// 台面种类:顶面图案 + 侧壁色双通道,不再用字符占位
// ---------------------------------------------------------------------------

export type PadMotif = "rim" | "arrows" | "spiral" | "coil" | "cracks";

export interface PadStyle {
  top: string;
  side: string;
  /** 顶面图案与侧壁装饰用的强调色 */
  accent: string;
  motif: PadMotif;
}

const PAD_STYLES: Record<string, PadStyle> = {
  steady: { top: "#FFD9B4", side: "#D9A473", accent: "#E5A96F", motif: "rim" },
  slider: { top: "#BFDCFF", side: "#8AAEDC", accent: "#5D87C8", motif: "arrows" },
  shrink: { top: "#DCD7FF", side: "#A9A1DE", accent: "#8F84D6", motif: "spiral" },
  spring: { top: "#FFC9E2", side: "#DB93B8", accent: "#C86A9B", motif: "coil" },
  once: { top: "#BFEFDF", side: "#84C4AC", accent: "#4F9A7C", motif: "cracks" },
};

/** 一种台面的配色与图案(纯查表,认不出的种类回落到稳台) */
export function padTopPattern(kind: string): PadStyle {
  return PAD_STYLES[kind] ?? PAD_STYLES.steady;
}

/** 顶面图案:稳台内圈 / 移动台双向箭头 / 缩小台旋纹 / 弹簧台弹圈 / 一次台裂纹 */
export function drawPadMotif(ctx: Ctx, kind: string, sx: number, sy: number, rx: number, ry: number, cracks = 0): void {
  const st = padTopPattern(kind);
  ctx.strokeStyle = st.accent;
  ctx.lineWidth = Math.max(1.5, rx * 0.05);
  ctx.lineCap = "round";
  if (st.motif === "rim") {
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (st.motif === "arrows") {
    const w = rx * 0.55;
    const ah = Math.max(2, ry * 0.34);
    ctx.beginPath();
    ctx.moveTo(sx - w, sy);
    ctx.lineTo(sx + w, sy);
    ctx.moveTo(sx - w + ah * 1.5, sy - ah);
    ctx.lineTo(sx - w, sy);
    ctx.lineTo(sx - w + ah * 1.5, sy + ah);
    ctx.moveTo(sx + w - ah * 1.5, sy - ah);
    ctx.lineTo(sx + w, sy);
    ctx.lineTo(sx + w - ah * 1.5, sy + ah);
    ctx.stroke();
  } else if (st.motif === "spiral") {
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * 0.72, ry * 0.72, 0, 0.4, Math.PI * 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * 0.45, ry * 0.45, 0, Math.PI * 0.9, Math.PI * 2.4);
    ctx.stroke();
    ctx.fillStyle = st.accent;
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * 0.08, ry * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (st.motif === "coil") {
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * 0.3, ry * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx * 0.52, ry * 0.52, 0, Math.PI * 0.2, Math.PI * 1.4);
    ctx.stroke();
  } else {
    // 裂纹:平时 2 道,被踩住扩展到 4 道(碎裂下坠由粒子层演)
    const dirs: ReadonlyArray<readonly [number, number]> = [
      [0.75, -0.35],
      [-0.6, 0.5],
      [0.4, 0.62],
      [-0.72, -0.3],
    ];
    const n = Math.min(dirs.length, Math.max(2, cracks));
    for (let i = 0; i < n; i++) {
      const [dx, dy] = dirs[i];
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + dx * rx * 0.5, sy + dy * ry * 0.5);
      ctx.lineTo(sx + dx * rx * 0.85, sy + dy * ry * 0.82);
      ctx.stroke();
    }
  }
}

/** 移动台侧壁条纹:三道短竖线,和顶面箭头一起构成双通道 */
export function drawSideStripes(ctx: Ctx, sx: number, sy: number, rx: number, ry: number, wall: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, rx * 0.07);
  ctx.lineCap = "round";
  for (const k of [-0.5, 0, 0.5]) {
    const x = sx + k * rx;
    const yTop = sy + ry * Math.sqrt(Math.max(0, 1 - k * k));
    ctx.beginPath();
    ctx.moveTo(x, yTop + wall * 0.18);
    ctx.lineTo(x, yTop + wall * 0.82);
    ctx.stroke();
  }
}

/** 弹簧台侧壁的弹簧圈线:两道绕柱身的半圈 */
export function drawSpringCoil(ctx: Ctx, sx: number, sy: number, rx: number, ry: number, wall: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, rx * 0.07);
  ctx.lineCap = "round";
  for (const f of [0.32, 0.66]) {
    ctx.beginPath();
    ctx.ellipse(sx, sy + wall * f, rx * 0.94, ry * 0.88, 0, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// 角色:朵朵(花苞呆毛 + 粉裙边)/ 星星(星星呆毛 + 黄披风)
// ---------------------------------------------------------------------------

export type HeroVariant = "duo" | "star";
export type HeroPose = "idle" | "charge" | "fly" | "land" | "fall";

/** 双人配饰色:形状之外的第二通道,直接断言两值不同 */
export const HERO_TRIM: Record<HeroVariant, string> = {
  duo: "#F58FB4",
  star: "#FFD76A",
};

const INK = "#40332B";

/** 脸:大眼高光 + 腮红,姿态换表情(蓄力眯眼 / 飞行圆睁 / 落地笑 / 坠落 >< 眼) */
export function drawHeroFace(ctx: Ctx, pose: HeroPose, cx: number, cy: number, r: number, t = 0): void {
  const ex = r * 0.34;
  const eyeY = cy - r * 0.1;
  const er = r * 0.15;
  ctx.fillStyle = "rgba(244,143,177,.55)";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * r * 0.52, cy + r * 0.18, r * 0.14, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.4, r * 0.09);
  ctx.lineCap = "round";
  const blink = pose === "idle" && t % 3.4 < 0.14;
  if (pose === "charge" || blink) {
    // 用力眯成一条线 + 抿嘴
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * ex - er, eyeY);
      ctx.lineTo(cx + s * ex + er, eyeY);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.12, cy + r * 0.3);
    ctx.lineTo(cx + r * 0.12, cy + r * 0.3);
    ctx.stroke();
  } else if (pose === "fall") {
    // >< 眼 + 小 o 嘴:惊讶但不痛苦(下面有云接着)
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * ex - er, eyeY - er);
      ctx.lineTo(cx + s * ex + er, eyeY + er);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + s * ex + er, eyeY - er);
      ctx.lineTo(cx + s * ex - er, eyeY + er);
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.32, r * 0.1, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 白底黑瞳 + 高光,飞行时睁得更圆
    const wide = pose === "fly" ? 1.25 : 1;
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.ellipse(cx + s * ex, eyeY, er * 1.25 * wide, er * 1.45 * wide, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(cx + s * ex, eyeY + er * 0.15, er * 0.72 * wide, er * 0.9 * wide, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(cx + s * ex - er * 0.24, eyeY - er * 0.3, er * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }
    if (pose === "land") {
      // 落台后咧嘴笑 0.2 秒
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.24, r * 0.16, 0, Math.PI);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.22, r * 0.12, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
  }
}

export interface HeroSpriteOpts {
  /** 脚底锚点(与旧版椭圆角色同一锚点) */
  x: number;
  y: number;
  /** squash/stretch 之后的半径(公式在 index.ts 里,一个字都没动) */
  rx: number;
  ry: number;
  color: string;
  variant: HeroVariant;
  pose: HeroPose;
  /** 连击 ≥ 3 冒小皇冠(reduced 只发光) */
  crown?: boolean;
  reduced?: boolean;
  /** 局内时间(秒):待机呼吸与眨眼用,单测传定值 */
  t?: number;
  /** 飞行中的历史位置(屏幕坐标),星星的披风拖着它飘 */
  trail?: ReadonlyArray<{ sx: number; sy: number }>;
}

/** 画一个跳跳员:身体三阶光影 + 呆毛/裙边/披风 + 小手 + 表情 */
export function drawHeroSprite(ctx: Ctx, o: HeroSpriteOpts): void {
  const rx = o.rx;
  const ry = o.ry * 1.25;
  const t = o.t ?? 0;
  const bob = o.pose === "idle" && !o.reduced ? Math.sin(t * 2.4) * ry * 0.03 : 0;
  const by = o.y - o.ry + bob;
  const x = o.x;
  const trim = HERO_TRIM[o.variant];

  // 披风(星星):画在身体后面,飞行中拖着最近两帧的位置飘
  if (o.variant === "star") {
    ctx.fillStyle = trim;
    const a = o.trail?.[2];
    const b = o.trail?.[4];
    if (o.pose === "fly" && !o.reduced && a && b) {
      ctx.beginPath();
      ctx.moveTo(x - rx * 0.55, by - ry * 0.1);
      ctx.lineTo(a.sx - rx * 0.7, a.sy - o.ry);
      ctx.lineTo(b.sx - rx * 0.15, b.sy - o.ry * 0.55);
      ctx.lineTo(a.sx + rx * 0.15, a.sy - o.ry * 1.1);
      ctx.lineTo(x + rx * 0.55, by - ry * 0.1);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(x - rx * 0.62, by - ry * 0.15);
      ctx.lineTo(x - rx * 0.88, by + ry * 0.72);
      ctx.lineTo(x + rx * 0.88, by + ry * 0.72);
      ctx.lineTo(x + rx * 0.62, by - ry * 0.15);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 呆毛:朵朵是花苞,星星是小星星 —— 剪影通道
  if (o.variant === "duo") {
    ctx.strokeStyle = "#7FA35C";
    ctx.lineWidth = Math.max(1.4, rx * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, by - ry * 0.92);
    ctx.quadraticCurveTo(x + rx * 0.12, by - ry * 1.18, x, by - ry * 1.32);
    ctx.stroke();
    ctx.fillStyle = "#F58FB4";
    ctx.beginPath();
    ctx.ellipse(x, by - ry * 1.44, rx * 0.16, ry * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FBC0D9";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + s * rx * 0.15, by - ry * 1.36, rx * 0.09, ry * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    drawStar(ctx, x, by - ry * 1.42, rx * 0.3, trim);
  }

  // 身体:底色 + 下缘暗部 + 左上高光,三阶
  ctx.fillStyle = o.color;
  ctx.beginPath();
  ctx.ellipse(x, by, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(120,60,30,.14)";
  ctx.beginPath();
  ctx.ellipse(x, by + ry * 0.4, rx * 0.78, ry * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.34, by - ry * 0.42, rx * 0.3, ry * 0.22, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // 裙边(朵朵):身体下缘一圈波浪
  if (o.variant === "duo") {
    ctx.fillStyle = trim;
    const yb = by + ry * 0.6;
    const w = rx * 1.56;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, yb);
    for (let i = 0; i < 4; i++) {
      const x0 = x - w / 2 + ((i + 0.5) * w) / 4;
      ctx.quadraticCurveTo(x0, yb + ry * 0.42, x - w / 2 + ((i + 1) * w) / 4, yb);
    }
    ctx.closePath();
    ctx.fill();
  }

  // 小手:起跳上举、落地平展、蓄力收在身侧、坠落张开
  const hand: Record<HeroPose, readonly [number, number]> = {
    idle: [0.88, 0.28],
    charge: [0.8, 0.5],
    fly: [0.95, -0.55],
    land: [1.08, 0.05],
    fall: [0.98, -0.35],
  };
  const [hx, hy] = hand[o.pose];
  ctx.fillStyle = o.color;
  ctx.strokeStyle = "rgba(120,60,30,.3)";
  ctx.lineWidth = Math.max(1, rx * 0.05);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * rx * hx, by + ry * hy, rx * 0.18, ry * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  drawHeroFace(ctx, o.pose, x, by - ry * 0.18, rx * 0.9, t);

  // 连击 ≥ 3:头顶小皇冠;reduced 改成安静的金色光环
  if (o.crown) {
    if (o.reduced) {
      ctx.strokeStyle = "#FFC94A";
      ctx.lineWidth = Math.max(2, rx * 0.1);
      ctx.beginPath();
      ctx.ellipse(x, by, rx * 1.28, ry * 1.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      drawCrown(ctx, x, by - ry * 1.85, rx * 0.36);
    }
  }
}

// ---------------------------------------------------------------------------
// 星星 / 皇冠 / 粒子
// ---------------------------------------------------------------------------

/** 五角星(实心) */
export function drawStar(ctx: Ctx, x: number, y: number, r: number, color: string, rot = -Math.PI / 2): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.46;
    const a = rot + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** 小皇冠:三个尖 + 一颗小圆宝石 */
export function drawCrown(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = "#FFC94A";
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x - s, y - s * 0.55);
  ctx.lineTo(x - s * 0.5, y - s * 0.2);
  ctx.lineTo(x, y - s * 0.85);
  ctx.lineTo(x + s * 0.5, y - s * 0.2);
  ctx.lineTo(x + s, y - s * 0.55);
  ctx.lineTo(x + s, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#FFE9A8";
  ctx.beginPath();
  ctx.arc(x, y - s * 0.08, s * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 每秒往下加的速度(屏幕像素) */
  g: number;
  /** 已经活了多少秒 */
  t: number;
  life: number;
  size: number;
  color: string;
  kind: "star" | "dust" | "shard";
}

/** 完美落点喷几颗星星 */
export const PERFECT_STARS = 4;
/** 普通落地扬几粒尘土 */
export const DUST_PUFFS = 2;
/** 一次台碎成几块 */
export const ONCE_SHARDS = 3;

const BURST_DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1.5],
  [1, -1.6],
  [-0.4, -2],
  [0.5, -1.2],
];

/** 完美落点:4 颗金色星星往上蹦(reduced 一颗都不给,发光走别的路) */
export function spawnPerfectBurst(x: number, y: number, s: number, reduced: boolean): Particle[] {
  if (reduced) return [];
  return BURST_DIRS.map(([dx, dy], i) => ({
    x,
    y,
    vx: dx * 60 * s,
    vy: dy * 70 * s,
    g: 300 * s,
    t: 0,
    life: 0.75,
    size: (5 + (i % 2) * 2) * s,
    color: i % 2 === 0 ? "#FFC94A" : "#FFE28A",
    kind: "star" as const,
  }));
}

/** 普通落地:左右各一粒尘土 */
export function spawnDustPuff(x: number, y: number, s: number, reduced: boolean): Particle[] {
  if (reduced) return [];
  return [-1, 1].map((d) => ({
    x: x + d * 6 * s,
    y,
    vx: d * 40 * s,
    vy: -26 * s,
    g: 140 * s,
    t: 0,
    life: 0.45,
    size: 4.5 * s,
    color: "rgba(214,180,150,.85)",
    kind: "dust" as const,
  }));
}

/** 一次台碎裂:3 块碎片往下坠 */
export function spawnShards(x: number, y: number, s: number, color: string, reduced: boolean): Particle[] {
  if (reduced) return [];
  return [-1, 0, 1].map((d) => ({
    x: x + d * 9 * s,
    y: y + 4 * s,
    vx: d * 34 * s,
    vy: (12 + Math.abs(d) * 8) * s,
    g: 260 * s,
    t: 0,
    life: 0.8,
    size: (6 - Math.abs(d)) * s,
    color,
    kind: "shard" as const,
  }));
}

/** 粒子推进一帧(纯函数:吐回新数组,过了寿命的自动清走) */
export function stepParticles(ps: readonly Particle[], dt: number): Particle[] {
  const out: Particle[] = [];
  for (const p of ps) {
    const t = p.t + dt;
    if (t >= p.life) continue;
    out.push({ ...p, t, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.vy + p.g * dt });
  }
  return out;
}

/** 把一批粒子画出来:星星 / 尘土圆点 / 三角碎片,越老越淡 */
export function drawParticles(ctx: Ctx, ps: readonly Particle[]): void {
  for (const p of ps) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    if (p.kind === "star") {
      drawStar(ctx, p.x, p.y, p.size, p.color);
    } else if (p.kind === "dust") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - p.size);
      ctx.lineTo(p.x + p.size * 0.8, p.y + p.size * 0.6);
      ctx.lineTo(p.x - p.size * 0.8, p.y + p.size * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// 云:远景大云(纯剪影)与救援云(睡眼 + 接住时弹性下沉)
// ---------------------------------------------------------------------------

const CLOUD_LOBES: ReadonlyArray<readonly [number, number, number]> = [
  [-1.1, 0.1, 0.72],
  [0, -0.25, 0.95],
  [1.1, 0.1, 0.72],
  [0, 0.32, 0.8],
];

/** 四圆组合的云朵剪影(远景大云直接用) */
export function drawCloudPuff(ctx: Ctx, x: number, y: number, s: number, color = "#FFFFFF"): void {
  ctx.fillStyle = color;
  for (const [dx, dy, r] of CLOUD_LOBES) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 救援云:睡眼惺忪 + 腮红,接住人的那一下整朵往下沉 sink 像素再弹回 */
export function drawRescueCloud(ctx: Ctx, x: number, y: number, s: number, sink = 0): void {
  const yy = y + sink;
  drawCloudPuff(ctx, x, yy, s, "#FFFFFF");
  ctx.strokeStyle = "#8FA3B8";
  ctx.lineWidth = Math.max(1.5, s * 0.09);
  ctx.lineCap = "round";
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + d * s * 0.38, yy - s * 0.1, s * 0.16, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, yy + s * 0.2, s * 0.1, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();
  ctx.fillStyle = "rgba(244,143,177,.4)";
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + d * s * 0.62, yy + s * 0.06, s * 0.12, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// 背景层:远山剪影与漂浮小岛
// ---------------------------------------------------------------------------

/** 沿地平线铺一条远山剪影,off 是视差偏移(像素),自动首尾循环 */
export function drawHills(ctx: Ctx, w: number, hy: number, color: string, off = 0): void {
  ctx.fillStyle = color;
  const span = w + 240;
  for (let i = 0; i < 4; i++) {
    const base = i * (span / 3);
    const x = ((((base - off * 0.6) % span) + span) % span) - 120;
    const hw = 90 + (i % 2) * 50;
    const hh = 26 + (i % 3) * 12;
    ctx.beginPath();
    ctx.ellipse(x, hy, hw, hh, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }
}

/** 漂浮小岛剪影:椭圆岛面 + 倒锥岛底 + 小树丛 */
export function drawIsland(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, s, s * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.8, y + s * 0.1);
  ctx.lineTo(x, y + s * 0.85);
  ctx.lineTo(x + s * 0.8, y + s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - s * 0.3, y - s * 0.34, s * 0.2, 0, Math.PI * 2);
  ctx.arc(x + s * 0.24, y - s * 0.3, s * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// 蓄力力度环与结算进度环
// ---------------------------------------------------------------------------

/** 力度 → 颜色:绿 → 金 → 红,和「快满了」的直觉一致 */
export function chargeColor(p: number): string {
  const t = clamp01(p);
  return t < 0.5 ? mixColor("#6FCB77", "#FFC94A", t * 2) : mixColor("#FFC94A", "#E05656", (t - 0.5) * 2);
}

/** 角色脚下的弧形力度环:白底圈 + 按力度着色的进度弧 */
export function drawChargeRing(ctx: Ctx, x: number, y: number, r: number, p: number): void {
  ctx.lineWidth = Math.max(3, r * 0.18);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,.7)";
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = chargeColor(p);
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.5, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(p));
  ctx.stroke();
}

/**
 * 暂停牌:两根圆头粗竖条(经典暂停符),取代画布上的「⏸」emoji(round2 遗留 #6)。
 * 以 (x,y) 为中心、h 为竖条高度;圆头线帽自带圆角,颜色跟随调用方(默认暂停层的赭墨)。
 */
export function drawPauseBars(ctx: Ctx, x: number, y: number, h: number, color = "#9A5A2C"): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, h * 0.32);
  ctx.lineCap = "round";
  const half = h / 2;
  const dx = h * 0.3;
  ctx.beginPath();
  ctx.moveTo(x - dx, y - half);
  ctx.lineTo(x - dx, y + half);
  ctx.moveTo(x + dx, y - half);
  ctx.lineTo(x + dx, y + half);
  ctx.stroke();
  ctx.restore();
}

/** 结算面板的完美率进度环 */
export function drawProgressRing(ctx: Ctx, x: number, y: number, r: number, ratio: number, color: string, track = "rgba(190,150,120,.25)"): void {
  ctx.lineWidth = Math.max(3, r * 0.22);
  ctx.lineCap = "round";
  ctx.strokeStyle = track;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(ratio));
  ctx.stroke();
}
