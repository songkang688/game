/**
 * 绿芽保卫战 1.3 · 视觉资产层(纯绘制,不碰玩法数值)。
 *
 * 这里放的都是「给一个 2D context 就能画」的函数,index.ts 只负责算坐标与状态:
 *  - kit 图标:挂锁/王冠/双剑/水滴/金星/心/雪花/土洞/月牙/推车/双叶芽/太阳……
 *    专门替换 1.2 残留的 🔒👑⚔💧⭐💗❄🕳🌙🚚🌱 等 emoji 字符;
 *  - 植物图标:坚果按 HP 三档换缺口、射手后坐帧+枪口白闪、吐泡鼓腮;
 *  - 虫子:三节波浪蠕动、地面虫四只小短腿、啃咬时头部前顶张嘴 —— 全是纯视觉,
 *    速度/伤害/节奏一个数都不改;
 *  - 战场氛围:泳道小草、萤火虫、月光斜带、房端栅栏、地图地平线剪影;
 *  - 结算金星:路径 + 渐变逐颗点亮,替代 ⭐/☆ 字符星。
 *
 * 抽成独立模块还有一个目的:art.test.ts 用「录制型 context」对每个资产做
 * 视觉契约断言(序列不同 ⇔ 画面不同),不用整局挂起来才能测。
 */
import { BUG_INFO, BugKind, PlantKind } from "./logic";

type Ctx = CanvasRenderingContext2D;

/** 把 #rrggbb 变深/变浅(amt 为 -255..255)。 */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

/* ================= 一、共用小脸 ================= */

export interface FaceOpts {
  /** 张嘴程度 0..1(吃/啃/吐泡) */
  munch?: number;
  /** 担忧表情:眉毛下垂(坚果被啃到低血用) */
  worried?: boolean;
}

export function drawFace(ctx: Ctx, x: number, y: number, r: number, opts: FaceOpts = {}): void {
  const munch = opts.munch ?? 0;
  ctx.fillStyle = "rgba(255,150,160,0.35)";
  ctx.beginPath();
  ctx.arc(x - r * 0.52, y + r * 0.1, r * 0.15, 0, Math.PI * 2);
  ctx.arc(x + r * 0.52, y + r * 0.1, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a3a4a";
  ctx.beginPath();
  ctx.arc(x - r * 0.32, y - r * 0.12, r * 0.1, 0, Math.PI * 2);
  ctx.arc(x + r * 0.32, y - r * 0.12, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.15, r * 0.035, 0, Math.PI * 2);
  ctx.arc(x + r * 0.29, y - r * 0.15, r * 0.035, 0, Math.PI * 2);
  ctx.fill();
  if (opts.worried) {
    // 下垂的小眉毛:外高内低,看起来担心但不吓人
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.48, y - r * 0.42);
    ctx.lineTo(x - r * 0.18, y - r * 0.3);
    ctx.moveTo(x + r * 0.48, y - r * 0.42);
    ctx.lineTo(x + r * 0.18, y - r * 0.3);
    ctx.stroke();
  }
  if (munch > 0) {
    ctx.fillStyle = "#3a3a4a";
    ctx.beginPath();
    ctx.arc(x, y + r * 0.22, r * (0.12 + 0.14 * munch), 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    ctx.lineCap = "round";
    ctx.beginPath();
    if (opts.worried) {
      // 担心时嘴角向下的小波浪
      ctx.arc(x, y + r * 0.34, r * 0.2, 1.15 * Math.PI, 1.85 * Math.PI);
    } else {
      ctx.arc(x, y + r * 0.12, r * 0.26, 0.15 * Math.PI, 0.85 * Math.PI);
    }
    ctx.stroke();
  }
}

/* ================= 二、kit 图标(emoji 清零专用) ================= */

export type IconKind =
  | "lock" // 🔒
  | "crown" // 👑
  | "swords" // ⚔
  | "drop" // 💧
  | "star" // ⭐(金渐变)
  | "starEmpty" // ▫/☆(灰空星)
  | "heart" // 💗
  | "snowflake" // ❄
  | "hole" // 🕳
  | "moon" // 🌙
  | "cart" // 🚚
  | "sprout" // 🌱
  | "sun" // ☀️
  | "shield" // 预警:带盾
  | "spring" // 预警:会跳
  | "wing" // 预警:会飞
  | "question" // 预警:藏土里
  | "flag"; // 🚩 旗帜大波

export const ICON_KINDS: IconKind[] = [
  "lock", "crown", "swords", "drop", "star", "starEmpty", "heart", "snowflake",
  "hole", "moon", "cart", "sprout", "sun", "shield", "spring", "wing", "question", "flag",
];

/** 五角星路径(kit 金星与结算星共用)。 */
function starPath(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const sx = x + Math.cos(a) * rr;
    const sy = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
}

/**
 * 手绘小图标:每枚只用十来条指令,r=12 的地图节点上也认得出。
 * 颜色内置(与全款粉彩调一致),调用方不用管配色。
 */
export function drawKitIcon(ctx: Ctx, kind: IconKind, x: number, y: number, r: number): void {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (kind === "lock") {
    ctx.strokeStyle = "#8a8a9a";
    ctx.lineWidth = Math.max(1.5, r * 0.22);
    ctx.beginPath();
    ctx.arc(x, y - r * 0.25, r * 0.42, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = "#a8a8b8";
    ctx.beginPath();
    ctx.roundRect(x - r * 0.6, y - r * 0.25, r * 1.2, r * 1.0, r * 0.2);
    ctx.fill();
    ctx.fillStyle = "#70707e";
    ctx.beginPath();
    ctx.arc(x, y + r * 0.2, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "crown") {
    ctx.fillStyle = "#ffd868";
    ctx.strokeStyle = "#e8a830";
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.75, y + r * 0.5);
    ctx.lineTo(x - r * 0.8, y - r * 0.35);
    ctx.lineTo(x - r * 0.35, y);
    ctx.lineTo(x, y - r * 0.6);
    ctx.lineTo(x + r * 0.35, y);
    ctx.lineTo(x + r * 0.8, y - r * 0.35);
    ctx.lineTo(x + r * 0.75, y + r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e06a9a";
    ctx.beginPath();
    ctx.arc(x, y + r * 0.14, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "swords") {
    ctx.strokeStyle = "#9fb8c8";
    ctx.lineWidth = Math.max(1.5, r * 0.2);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.6, y - r * 0.6);
    ctx.lineTo(x + r * 0.6, y + r * 0.6);
    ctx.moveTo(x + r * 0.6, y - r * 0.6);
    ctx.lineTo(x - r * 0.6, y + r * 0.6);
    ctx.stroke();
    ctx.strokeStyle = "#c9a05a";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.62, y + r * 0.28);
    ctx.lineTo(x - r * 0.28, y + r * 0.62);
    ctx.moveTo(x + r * 0.62, y + r * 0.28);
    ctx.lineTo(x + r * 0.28, y + r * 0.62);
    ctx.stroke();
  } else if (kind === "drop") {
    const g = ctx.createLinearGradient(x, y - r, x, y + r);
    g.addColorStop(0, "#bfe9ff");
    g.addColorStop(1, "#5a9ad9");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#4a7ab9";
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.95);
    ctx.quadraticCurveTo(x + r * 0.85, y + r * 0.1, x, y + r * 0.85);
    ctx.quadraticCurveTo(x - r * 0.85, y + r * 0.1, x, y - r * 0.95);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(x - r * 0.22, y + r * 0.1, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "star") {
    const g = ctx.createLinearGradient(x, y - r, x, y + r);
    g.addColorStop(0, "#ffe9a8");
    g.addColorStop(1, "#f2b83e");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#d89020";
    ctx.lineWidth = Math.max(1, r * 0.1);
    starPath(ctx, x, y, r);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "starEmpty") {
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    ctx.strokeStyle = "#b8b8c2";
    ctx.lineWidth = Math.max(1, r * 0.1);
    starPath(ctx, x, y, r);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "heart") {
    const g = ctx.createLinearGradient(x, y - r, x, y + r);
    g.addColorStop(0, "#ff9eb5");
    g.addColorStop(1, "#e05a7a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.75);
    ctx.quadraticCurveTo(x - r * 1.05, y - r * 0.05, x - r * 0.5, y - r * 0.55);
    ctx.quadraticCurveTo(x, y - r * 0.85, x, y - r * 0.25);
    ctx.quadraticCurveTo(x, y - r * 0.85, x + r * 0.5, y - r * 0.55);
    ctx.quadraticCurveTo(x + r * 1.05, y - r * 0.05, x, y + r * 0.75);
    ctx.fill();
  } else if (kind === "snowflake") {
    ctx.strokeStyle = "#8fd0f0";
    ctx.lineWidth = Math.max(1, r * 0.16);
    for (let i = 0; i < 3; i++) {
      const a = (Math.PI * i) / 3;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * r * 0.85, y - Math.sin(a) * r * 0.85);
      ctx.lineTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85);
      ctx.stroke();
    }
    ctx.fillStyle = "#bfe9ff";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "hole") {
    ctx.fillStyle = "#5a4230";
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2e2018";
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.08, r * 0.68, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a6a4a";
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.9, r * 0.5, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else if (kind === "moon") {
    const g = ctx.createLinearGradient(x, y - r, x, y + r);
    g.addColorStop(0, "#fff6d5");
    g.addColorStop(1, "#ffd868");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.85, Math.PI * 0.32, Math.PI * 1.68);
    ctx.quadraticCurveTo(x + r * 0.45, y, x + r * 0.32, y + r * 0.78);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "cart") {
    ctx.fillStyle = "#c9a05a";
    ctx.strokeStyle = "#9a7038";
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.roundRect(x - r * 0.8, y - r * 0.45, r * 1.4, r * 0.7, r * 0.12);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + r * 0.6, y - r * 0.35);
    ctx.lineTo(x + r * 0.95, y - r * 0.62);
    ctx.stroke();
    ctx.fillStyle = "#5a5a6e";
    ctx.beginPath();
    ctx.arc(x - r * 0.42, y + r * 0.48, r * 0.24, 0, Math.PI * 2);
    ctx.arc(x + r * 0.3, y + r * 0.48, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "sprout") {
    ctx.strokeStyle = "#4a9a5a";
    ctx.lineWidth = Math.max(1.5, r * 0.18);
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.85);
    ctx.quadraticCurveTo(x + r * 0.1, y, x, y - r * 0.35);
    ctx.stroke();
    ctx.fillStyle = "#7ac97a";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.42, y - r * 0.45, r * 0.42, r * 0.24, -0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a9a5a";
    ctx.beginPath();
    ctx.ellipse(x + r * 0.42, y - r * 0.55, r * 0.42, r * 0.24, 0.7, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "sun") {
    ctx.strokeStyle = "#f2b83e";
    ctx.lineWidth = Math.max(1, r * 0.16);
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * r * 0.95, y - Math.sin(a) * r * 0.95);
      ctx.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(x - r * 0.15, y - r * 0.15, r * 0.05, x, y, r * 0.6);
    g.addColorStop(0, "#fff2cf");
    g.addColorStop(1, "#ffc94e");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#e8a830";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "shield") {
    const g = ctx.createLinearGradient(x, y - r, x, y + r);
    g.addColorStop(0, "#d8c496");
    g.addColorStop(1, "#b8a070");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#8a7448";
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.85);
    ctx.quadraticCurveTo(x + r * 0.85, y - r * 0.55, x + r * 0.7, y + r * 0.15);
    ctx.quadraticCurveTo(x + r * 0.5, y + r * 0.7, x, y + r * 0.9);
    ctx.quadraticCurveTo(x - r * 0.5, y + r * 0.7, x - r * 0.7, y + r * 0.15);
    ctx.quadraticCurveTo(x - r * 0.85, y - r * 0.55, x, y - r * 0.85);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "spring") {
    ctx.strokeStyle = "#8a5ac9";
    ctx.lineWidth = Math.max(1.5, r * 0.18);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.6, y + r * 0.8);
    ctx.quadraticCurveTo(x - r * 0.9, y, x, y - r * 0.1);
    ctx.quadraticCurveTo(x + r * 0.9, y - r * 0.2, x + r * 0.15, y - r * 0.8);
    ctx.stroke();
    ctx.fillStyle = "#8a5ac9";
    ctx.beginPath();
    ctx.moveTo(x + r * 0.15, y - r * 0.95);
    ctx.lineTo(x + r * 0.55, y - r * 0.55);
    ctx.lineTo(x - r * 0.05, y - r * 0.45);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "wing") {
    ctx.fillStyle = "rgba(159,216,245,0.9)";
    ctx.strokeStyle = "#5a9ad9";
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    ctx.ellipse(x - r * 0.4, y, r * 0.5, r * 0.28, -0.5, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.4, y, r * 0.5, r * 0.28, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "question") {
    ctx.strokeStyle = "#a05914";
    ctx.lineWidth = Math.max(1.5, r * 0.2);
    ctx.beginPath();
    ctx.arc(x, y - r * 0.3, r * 0.42, Math.PI * 0.9, Math.PI * 2.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + r * 0.05, y + r * 0.05);
    ctx.lineTo(x, y + r * 0.3);
    ctx.stroke();
    ctx.fillStyle = "#a05914";
    ctx.beginPath();
    ctx.arc(x, y + r * 0.72, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // flag:小旗杆 + 飘着的三角旗
    ctx.strokeStyle = "#8a6a4a";
    ctx.lineWidth = Math.max(1.5, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.9);
    ctx.lineTo(x - r * 0.5, y + r * 0.9);
    ctx.stroke();
    ctx.fillStyle = "#e05a7a";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.9);
    ctx.lineTo(x + r * 0.85, y - r * 0.45);
    ctx.lineTo(x - r * 0.5, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ================= 三、结算金星(逐颗点亮) ================= */

export interface ClearStarOpts {
  /** 亮没亮 */
  lit: boolean;
  /** 刚点亮的弹跳进度 0..1(0=刚亮,1=落定);不在弹跳窗口就传 1 */
  pop?: number;
}

/**
 * 结算面板的星:路径绘制 + 金渐变,点亮瞬间放大回落 + 四粒星屑。
 * 替代 1.2 的 "⭐/☆" 字符星。
 */
export function drawClearStar(ctx: Ctx, x: number, y: number, r: number, opts: ClearStarOpts): void {
  ctx.save();
  ctx.lineJoin = "round";
  if (!opts.lit) {
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    ctx.strokeStyle = "#c8c8d2";
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    starPath(ctx, x, y, r);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }
  const pop = Math.min(1, Math.max(0, opts.pop ?? 1));
  const scale = 1 + (1 - pop) * 0.45;
  // 点亮那一下的光晕
  if (pop < 1) {
    ctx.fillStyle = `rgba(255,220,120,${(0.35 * (1 - pop)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r * (1.4 + pop * 0.5), 0, Math.PI * 2);
    ctx.fill();
    // 四粒星屑往外飞
    ctx.fillStyle = "#ffd868";
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI * 2 * i) / 4 + Math.PI / 4;
      const d = r * (1.1 + pop * 0.9);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.1 * (1 - pop * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const g = ctx.createLinearGradient(x, y - r * scale, x, y + r * scale);
  g.addColorStop(0, "#fff1b8");
  g.addColorStop(0.55, "#ffd868");
  g.addColorStop(1, "#f2a83e");
  ctx.fillStyle = g;
  ctx.strokeStyle = "#d89020";
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  starPath(ctx, x, y, r * scale);
  ctx.fill();
  ctx.stroke();
  // 左上小高光
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.3 * scale, y - r * 0.32 * scale, r * 0.16, r * 0.09, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ================= 四、植物图标(坚果缺口 + 后坐帧) ================= */

export interface PlantArtOpts {
  /** 发射/吐泡/受击等瞬间动画 0..1(1=刚触发) */
  anim?: number;
  /** 剩余 HP 比例(坚果/弹弹网的缺口分档用),默认满血 */
  hpFrac?: number;
  /** 射手后坐 0..1:身体后倾 + >0.75 时一帧枪口白闪 */
  recoil?: number;
}

/** 坚果被啃出的缺口:内瓤浅色 + 两道裂纹。 */
function nutBite(ctx: Ctx, x: number, y: number, r: number, side: 1 | -1): void {
  ctx.fillStyle = "#fff3dd";
  ctx.strokeStyle = "#bc9662";
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.arc(x + side * r * 0.48, y - r * 0.42, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + side * r * 0.34, y - r * 0.2);
  ctx.lineTo(x + side * r * 0.18, y + r * 0.02);
  ctx.moveTo(x + side * r * 0.5, y - r * 0.1);
  ctx.lineTo(x + side * r * 0.42, y + r * 0.14);
  ctx.stroke();
}

/** 发射瞬间的一帧枪口白闪(小十字星)。 */
function muzzleFlash(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = Math.max(1.5, r * 0.1);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - r * 0.18, y);
  ctx.lineTo(x + r * 0.18, y);
  ctx.moveTo(x, y - r * 0.18);
  ctx.lineTo(x, y + r * 0.18);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPlantIcon(
  ctx: Ctx,
  x0: number,
  y: number,
  r: number,
  kind: PlantKind,
  opts: PlantArtOpts = {},
): void {
  const anim = opts.anim ?? 0;
  const hpFrac = opts.hpFrac ?? 1;
  const recoil = opts.recoil ?? 0;
  // 后坐:发射瞬间身体往家的方向(左)倾一点,子弹是往右飞的
  const x = x0 - (kind === "star" || kind === "ice" ? recoil * r * 0.16 : 0);
  ctx.save();
  ctx.lineJoin = "round";
  // 先画土里的小茎叶(荷叶除外),说明"这是种下的植物"
  if (kind !== "lily") {
    ctx.fillStyle = "rgba(170,130,90,0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.75, r * 0.55, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8fd8a8";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.5, y + r * 0.66, r * 0.24, r * 0.11, -0.5, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.5, y + r * 0.66, r * 0.24, r * 0.11, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === "sparkle") {
    ctx.fillStyle = "#ffe387";
    ctx.strokeStyle = "#f2c24e";
    ctx.lineWidth = Math.max(1, r * 0.06);
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.34, r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(x - r * 0.15, y - r * 0.15, r * 0.05, x, y, r * 0.7);
    g.addColorStop(0, "#ffe9a8");
    g.addColorStop(1, "#ffc94e");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#e8a830";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawFace(ctx, x, y, r * 0.55);
  } else if (kind === "bubble") {
    const sq = 1 + anim * 0.2;
    const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.08, x, y, r * 0.95);
    g.addColorStop(0, "#b2ecdc");
    g.addColorStop(1, "#74c8b2");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#54a890";
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.62 * sq, (r * 0.62) / sq, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 吐泡瞬间腮帮鼓起来
    if (anim > 0.4) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.arc(x - r * 0.42 * sq, y + r * 0.16, r * 0.18 * anim, 0, Math.PI * 2);
      ctx.arc(x + r * 0.42 * sq, y + r * 0.16, r * 0.18 * anim, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#6fc4b0";
    ctx.strokeStyle = "#54a890";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.15, y - r * 0.62, r * 0.2, r * 0.32, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawFace(ctx, x, y, r * 0.62, { munch: anim });
  } else if (kind === "nut") {
    // 1.3:被啃出的缺口按 HP 三档换绘制 —— 满血完整壳纹;
    // <2/3 右上咬缺一口 + 裂纹;<1/3 双缺口 + 表情变担忧
    const tier = hpFrac < 1 / 3 ? 2 : hpFrac < 2 / 3 ? 1 : 0;
    const g = ctx.createLinearGradient(x, y - r * 0.7, x, y + r * 0.7);
    g.addColorStop(0, "#f2d8ae");
    g.addColorStop(1, "#dcb684");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#bc9662";
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.05, r * 0.58, r * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c8a06e";
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.35, r * 0.5, r * 0.3, 0, Math.PI, 0);
    ctx.fill();
    if (tier >= 1) nutBite(ctx, x, y, r, 1);
    if (tier >= 2) nutBite(ctx, x, y + r * 0.3, r, -1);
    drawFace(ctx, x, y + r * 0.1, r * 0.55, { worried: tier >= 2 });
  } else if (kind === "star") {
    ctx.fillStyle = "#ffd868";
    ctx.strokeStyle = "#e8a830";
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * i) / 5 - Math.PI / 2 + anim * 0.3;
      const rr = i % 2 === 0 ? r * 0.72 : r * 0.32;
      const sx = x + Math.cos(a) * rr;
      const sy = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawFace(ctx, x, y + r * 0.08, r * 0.45);
    if (recoil > 0.75) muzzleFlash(ctx, x0 + r * 0.85, y - r * 0.1, r);
  } else if (kind === "ice") {
    // 冰冰花:淡蓝雪花瓣
    ctx.strokeStyle = "#9fd8f5";
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * i) / 3 + anim * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(x - r * 0.1, y - r * 0.1, r * 0.05, x, y, r * 0.55);
    g.addColorStop(0, "#eefaff");
    g.addColorStop(1, "#bce4f8");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#82c0e2";
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawFace(ctx, x, y, r * 0.45);
    if (recoil > 0.75) muzzleFlash(ctx, x0 + r * 0.85, y - r * 0.1, r);
  } else if (kind === "boom") {
    // 爆爆果:红彤彤圆果 + 小引线
    const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.1, r * 0.08, x, y + r * 0.08, r * 0.85);
    g.addColorStop(0, "#ffb8a8");
    g.addColorStop(1, "#f27862");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#d05846";
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.arc(x, y + r * 0.08, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#c47a2a";
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.5);
    ctx.quadraticCurveTo(x + r * 0.3, y - r * 0.85, x + r * 0.5, y - r * 0.7);
    ctx.stroke();
    ctx.fillStyle = "#ffd868";
    ctx.beginPath();
    ctx.arc(x + r * 0.5, y - r * 0.7, r * (0.14 + anim * 0.06), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff9a4e";
    ctx.beginPath();
    ctx.arc(x + r * 0.5, y - r * 0.7, r * (0.07 + anim * 0.03), 0, Math.PI * 2);
    ctx.fill();
    drawFace(ctx, x, y + r * 0.08, r * 0.55);
  } else if (kind === "scout") {
    // 望望草(1.1):长脖子潜望镜小草,头顶一盏亮灯照出地地虫
    ctx.strokeStyle = "#5aa878";
    ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.6);
    ctx.quadraticCurveTo(x - r * 0.15, y - r * 0.1, x, y - r * 0.5);
    ctx.stroke();
    // 灯光光晕
    ctx.fillStyle = `rgba(255,227,135,${0.35 + anim * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.55, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.1, y - r * 0.65, r * 0.05, x, y - r * 0.55, r * 0.4);
    g.addColorStop(0, "#fff6d5");
    g.addColorStop(1, "#ffe387");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#e8a830";
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.arc(x, y - r * 0.55, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawFace(ctx, x, y - r * 0.55, r * 0.38);
  } else if (kind === "moon") {
    // 月月菇(1.1):月牙帽小蘑菇,夜里咕嘟冒露珠
    ctx.fillStyle = "#f2ecd8";
    ctx.strokeStyle = "#c9b88a";
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.roundRect(x - r * 0.22, y - r * 0.1, r * 0.44, r * 0.7, r * 0.12);
    ctx.fill();
    ctx.stroke();
    const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.5, r * 0.08, x, y - r * 0.35, r * 0.75);
    g.addColorStop(0, "#d5ddff");
    g.addColorStop(1, "#8f9fe8");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#6a7ac9";
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.3, r * 0.68, r * 0.45, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 帽子上的小月牙
    ctx.fillStyle = "#fff1c9";
    ctx.beginPath();
    ctx.arc(x + r * 0.2, y - r * 0.42, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8f9fe8";
    ctx.beginPath();
    ctx.arc(x + r * 0.28, y - r * 0.46, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    drawFace(ctx, x, y + r * 0.18, r * 0.35);
  } else if (kind === "sunbud") {
    // 暖暖花(1.2):橙心花盘,一圈花瓣像小太阳,但脸是圆滚滚的小花不是星球
    ctx.fillStyle = "#ffc46a";
    ctx.strokeStyle = "#e08a2a";
    ctx.lineWidth = Math.max(1, r * 0.06);
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + anim * 0.2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.26, r * 0.16, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(x - r * 0.12, y - r * 0.12, r * 0.05, x, y, r * 0.6);
    g.addColorStop(0, "#fff2cf");
    g.addColorStop(1, "#ffb347");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#d0791c";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawFace(ctx, x, y, r * 0.48);
  } else if (kind === "puff") {
    // 蓬蓬花(1.2):毛茸茸的粉色蒲公英,一团花粉扫一小片
    ctx.fillStyle = "rgba(255,190,220,0.55)";
    ctx.beginPath();
    ctx.arc(x, y, r * (0.86 + anim * 0.08), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd0e8";
    ctx.strokeStyle = "#e88ab8";
    ctx.lineWidth = Math.max(1, r * 0.05);
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10 + anim * 0.35;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.58, y + Math.sin(a) * r * 0.58, r * 0.19, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(x - r * 0.12, y - r * 0.14, r * 0.05, x, y, r * 0.55);
    g.addColorStop(0, "#fff0f7");
    g.addColorStop(1, "#f5aed2");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#dd7cae";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawFace(ctx, x, y, r * 0.45, { munch: anim });
  } else if (kind === "netpad") {
    // 弹弹网(1.2):绷紧的青色小网,会跳的弹回去、挖地的钻不过
    ctx.fillStyle = "rgba(90,168,120,0.2)";
    ctx.beginPath();
    ctx.roundRect(x - r * 0.72, y - r * 0.5, r * 1.44, r * 1.0, r * 0.2);
    ctx.fill();
    ctx.strokeStyle = "#5aa878";
    ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.lineCap = "round";
    for (let i = 0; i <= 4; i++) {
      const t = -0.72 + (i * 1.44) / 4;
      ctx.beginPath();
      ctx.moveTo(x + r * t, y - r * 0.5);
      ctx.lineTo(x + r * t, y + r * 0.5);
      ctx.stroke();
    }
    for (let i = 0; i <= 3; i++) {
      const t = -0.5 + (i * 1.0) / 3;
      const bow = Math.sin(anim * Math.PI) * r * 0.1;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.72, y + r * t);
      ctx.quadraticCurveTo(x, y + r * t + bow, x + r * 0.72, y + r * t);
      ctx.stroke();
    }
    ctx.strokeStyle = "#3f7f59";
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath();
    ctx.roundRect(x - r * 0.72, y - r * 0.5, r * 1.44, r * 1.0, r * 0.2);
    ctx.stroke();
    drawFace(ctx, x, y, r * 0.34, { worried: hpFrac < 1 / 3 });
  } else {
    // 荷叶垫
    const g = ctx.createRadialGradient(x - r * 0.2, y, r * 0.1, x, y + r * 0.2, r * 0.9);
    g.addColorStop(0, "#96dc96");
    g.addColorStop(1, "#5cb45c");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#48a048";
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.2, r * 0.72, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.15, y + r * 0.12, r * 0.3, r * 0.15, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawShovelIcon(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.strokeStyle = "#b08a5a";
  ctx.lineWidth = Math.max(3, r * 0.22);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - r * 0.4, y - r * 0.6);
  ctx.lineTo(x + r * 0.15, y + 0);
  ctx.stroke();
  ctx.fillStyle = "#9fb8c8";
  ctx.beginPath();
  ctx.moveTo(x + r * 0.05, y - r * 0.1);
  ctx.quadraticCurveTo(x + r * 0.85, y + r * 0.2, x + r * 0.35, y + r * 0.75);
  ctx.quadraticCurveTo(x - r * 0.1, y + r * 0.55, x + r * 0.05, y - r * 0.1);
  ctx.fill();
}

/* ================= 五、虫子(蠕动 + 短腿 + 啃咬帧) ================= */

export const BUG_COLORS: Record<BugKind, string> = {
  walker: "#ffcf8a",
  flyer: "#9fd8f5",
  armor: "#c9b6f2",
  speedy: "#ffd868",
  digger: "#b5e8a8",
  bucket: "#c8c8d8",
  racer: "#8ae0d0",
  bossbug: "#e88aa5",
  queen: "#c95a9a",
  mole: "#d8b088",
  moth: "#d8c8f0",
  mama: "#f0a0c0",
  queenx: "#b04a8a",
  tunneler: "#c98f5a",
};

export interface BugArt {
  kind: BugKind;
  /** 身体锚点(index 已把飞行悬浮/跳跃抬升算进 y) */
  x: number;
  y: number;
  /** 影子落点(泳道中心) */
  groundY: number;
  /** min(格宽, 道高) */
  unit: number;
  /** 爬行相位(index 的 bug.wob) */
  wob: number;
  frozen: boolean;
  raged: boolean;
  /** 啃咬循环相位 0..1(0=没在啃);啃的时候头部前顶+张嘴,纯视觉 */
  chew: number;
  armor: number;
  maxArmor: number;
  /** 血量点点 */
  dots: number;
  hpFrac: number;
  /** 弱动效:蠕动/摆腿/啃咬循环全部停成静态帧 */
  calm?: boolean;
}

export function drawBugBody(ctx: Ctx, o: BugArt): void {
  const info = BUG_INFO[o.kind];
  const boss = info.boss;
  const flying = info.flying;
  const { x, y, unit, wob } = o;
  const r = unit * (boss ? 0.42 : 0.26);
  const color = BUG_COLORS[o.kind];
  // 狂暴中的进化体:一圈红色气浪
  if (o.raged) {
    ctx.fillStyle = `rgba(224,90,122,${0.2 + 0.12 * Math.abs(Math.sin(wob * 2))})`;
    ctx.beginPath();
    ctx.arc(x + r * 0.6, y, r * 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  if (flying) {
    // r2 修复 W4R2-06:翅膀锚点上移出身体轮廓+张角放大一档(0.9→1.15、0.55→0.8、
    // calm 静态张角 0.5→0.8),16px 剪影多出翅膀通道,不再只靠悬浮影子分离兜底
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    const flap = (o.calm ? 0.8 : Math.sin(wob * 4)) * r * 0.55;
    ctx.beginPath();
    ctx.ellipse(x + r * 0.2, y - r * 1.15 - flap, r * 0.8, r * 0.32, -0.45, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.2, y - r * 1.15 + flap, r * 0.8, r * 0.32, 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  // 脚下软阴影
  ctx.fillStyle = "rgba(58,58,74,0.13)";
  ctx.beginPath();
  ctx.ellipse(x + r * 0.6, o.groundY + r * 1.05, r * 1.4, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  const bodyColor = o.frozen ? "#9fd8f5" : color;
  // 1.3:地面虫四只交替小短腿(飞的没有);calm 时定格
  if (!flying) {
    ctx.strokeStyle = shade(bodyColor, -60);
    ctx.lineWidth = Math.max(1.5, r * 0.1);
    ctx.lineCap = "round";
    for (let li = 0; li < 4; li++) {
      const lx = x + (li - 1.1) * r * 0.62;
      const sw = (o.calm ? (li % 2 === 0 ? 0.5 : -0.5) : Math.sin(wob * 2 + li * Math.PI * 0.5)) * r * 0.2;
      ctx.beginPath();
      ctx.moveTo(lx, y + r * 0.68);
      ctx.lineTo(lx + sw, y + r * 1.02);
      ctx.stroke();
    }
  }
  // 啃咬:头部往植物那边(左)一顶一顶
  const headPush = o.chew > 0 ? Math.abs(Math.sin(o.chew * Math.PI)) * r * 0.28 : 0;
  ctx.strokeStyle = shade(bodyColor, -46);
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  for (let s = 2; s >= 0; s--) {
    // 1.3:三节 y 相位差改成清晰的波浪传递(calm 静态错落)
    const wave = o.calm ? Math.sin(s * 1.2) * r * 0.06 : Math.sin(wob * 1.4 - s * 0.9) * r * 0.2;
    const sx = x + s * r * 0.9 - (s === 0 ? headPush : 0);
    const sr = r * (1 - s * 0.15);
    const grad = ctx.createRadialGradient(sx - sr * 0.3, y - sr * 0.35, sr * 0.1, sx, y, sr * 1.2);
    grad.addColorStop(0, shade(bodyColor, 26));
    grad.addColorStop(1, bodyColor);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, y + wave, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // 护甲壳(壳壳虫是半圆壳,桶桶虫是铁桶)
  if (o.maxArmor > 0 && o.armor > 0) {
    if (o.kind === "bucket" || o.kind === "bossbug" || o.kind === "queen" || o.kind === "queenx") {
      ctx.fillStyle = "rgba(140,150,170,0.95)";
      ctx.beginPath();
      ctx.roundRect(x - r * 0.8, y - r * 1.6, r * 1.6, r * 1.0, r * 0.2);
      ctx.fill();
      ctx.strokeStyle = "#6a7488";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(216,196,150,0.95)";
      ctx.beginPath();
      ctx.arc(x + r * 0.5, y - r * 0.25, r * 1.05, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "#b8a070";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + r * 0.5, y - r * 0.25, r * 1.05, Math.PI, 0);
      ctx.stroke();
    }
  }
  if (o.kind === "digger") {
    // 小小的弹簧腿
    ctx.strokeStyle = "#5aa878";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3, y + r * 0.8);
    ctx.lineTo(x - r * 0.55, y + r * 1.25);
    ctx.moveTo(x + r * 0.3, y + r * 0.8);
    ctx.lineTo(x + r * 0.55, y + r * 1.25);
    ctx.stroke();
  }
  if (o.kind === "speedy") {
    ctx.strokeStyle = "rgba(255,216,104,0.8)";
    ctx.lineWidth = 2.5;
    for (let k = 1; k <= 2; k++) {
      ctx.beginPath();
      ctx.arc(x + k * r * 1.1, y, r * 0.55, -0.5, 0.5);
      ctx.stroke();
    }
  }
  if (o.kind === "mole") {
    // 现形的地地虫:一对挖土小爪子 + 脚边土堆
    ctx.fillStyle = "rgba(150,110,70,0.55)";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 1.05, r * 1.2, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#9a6a3a";
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.65, y + r * 0.3);
    ctx.lineTo(x - r * 0.95, y + r * 0.75);
    ctx.moveTo(x - r * 0.45, y + r * 0.55);
    ctx.lineTo(x - r * 0.7, y + r * 0.95);
    ctx.stroke();
  }
  if (o.kind === "tunneler") {
    // 哧溜虫:两把小铲爪 + 头上还挂着土屑,一看就是刚从地里钻出来的
    ctx.strokeStyle = "#8a5a2a";
    ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.lineCap = "round";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * r * 0.55, y + r * 0.35);
      ctx.lineTo(x + s * r * 1.0, y + r * 0.85);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(150,110,70,0.6)";
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(x + (k - 1) * r * 0.4, y - r * 1.05 + Math.sin(wob + k) * r * 0.1, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (o.kind === "moth") {
    // 扑扑蛾:一对打圈的小触角,夜里更精神
    ctx.strokeStyle = shade(color, -60);
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * r * 0.2, y - r * 0.75);
      ctx.quadraticCurveTo(x + s * r * 0.7, y - r * 1.5, x + s * r * 0.35, y - r * 1.6);
      ctx.stroke();
      ctx.fillStyle = shade(color, -40);
      ctx.beginPath();
      ctx.arc(x + s * r * 0.35, y - r * 1.6, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (o.kind === "mama") {
    // 分分虫:身上背着两只小圆点宝宝
    for (const s of [-0.35, 0.45]) {
      ctx.fillStyle = shade(color, 40);
      ctx.strokeStyle = shade(color, -40);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + s * r * 1.4, y - r * 0.95, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (boss) {
    ctx.fillStyle = "#ffd868";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.4, y - r * 1.35);
    ctx.lineTo(x - r * 0.2, y - r * 1.75);
    ctx.lineTo(x, y - r * 1.4);
    ctx.lineTo(x + r * 0.2, y - r * 1.75);
    ctx.lineTo(x + r * 0.4, y - r * 1.35);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.2, y - r * 0.8);
  ctx.lineTo(x - r * 0.5, y - r * 1.3);
  ctx.moveTo(x + r * 0.3, y - r * 0.8);
  ctx.lineTo(x + r * 0.6, y - r * 1.3);
  ctx.stroke();
  const munch = o.chew > 0 ? (o.calm ? 0.6 : Math.abs(Math.sin(o.chew * Math.PI * 2))) : 0;
  drawFace(ctx, x - headPush, y, r, { munch });
  // 冻住的小雪花(绘制,不再是 "❄" 字符)
  if (o.frozen) {
    drawKitIcon(ctx, "snowflake", x, y - r * 1.25, r * 0.34);
  }
  // 血量点点
  const frac = Math.max(0, Math.min(1, o.hpFrac));
  for (let i = 0; i < o.dots; i++) {
    const filled = i < Math.ceil(frac * o.dots);
    ctx.fillStyle = filled ? "#7ac97a" : "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.arc(x - ((o.dots - 1) * r * 0.18) / 2 + i * r * 0.18, y - r * 1.6 + (flying ? -r * 0.4 : 0), r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 没现形的地地虫:拱起来的小土包 + 扬起的土粒 + 白色问号气泡。
 * 问号是路径绘制的,替代 1.2 的 fillText("?")。
 */
export function drawMoleMound(ctx: Ctx, x: number, y: number, r: number, wob: number, calm = false): void {
  ctx.fillStyle = "rgba(150,110,70,0.75)";
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.5, r * 1.1, r * 0.55, 0, Math.PI, 0);
  ctx.fill();
  // 土粒每半秒抖一下(wob 每秒涨 6,floor(wob/3) 半秒变一次)
  const jolt = calm ? 0 : Math.floor(wob / 3) % 2;
  ctx.fillStyle = "rgba(120,88,56,0.6)";
  for (let i = 0; i < 3; i++) {
    const a = wob * 2 + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(
      x + Math.cos(a) * r * 0.9,
      y + r * 0.2 - Math.abs(Math.sin(a)) * r * 0.6 - jolt * r * 0.14,
      r * 0.14,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  // 白色圆角问号气泡
  const bx = x + r * 0.5;
  const by = y - r * 1.15;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.strokeStyle = "rgba(120,88,56,0.5)";
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.arc(bx, by, r * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx - r * 0.2, by + r * 0.44);
  ctx.lineTo(bx - r * 0.38, by + r * 0.78);
  ctx.lineTo(bx + r * 0.05, by + r * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8a6234";
  ctx.lineWidth = Math.max(1.5, r * 0.11);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(bx, by - r * 0.12, r * 0.2, Math.PI * 0.9, Math.PI * 2.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx + r * 0.02, by + r * 0.05);
  ctx.lineTo(bx, by + r * 0.14);
  ctx.stroke();
  ctx.fillStyle = "#8a6234";
  ctx.beginPath();
  ctx.arc(bx, by + r * 0.32, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

/* ================= 六、战场氛围 ================= */

/** 泳道小草:每道 3~5 株两笔小草,位置由 lane 决定(确定性,不闪)。 */
export function drawLaneGrass(
  ctx: Ctx,
  x0: number,
  w: number,
  yTop: number,
  laneH: number,
  lane: number,
  dark: boolean,
): void {
  const n = 3 + ((lane * 7 + 1) % 3);
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.13)" : "rgba(90,150,90,0.4)";
  ctx.lineWidth = Math.max(1, laneH * 0.035);
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const fx = x0 + w * (((lane * 53 + i * 37 + 11) % 89) / 89);
    const fy = yTop + laneH * (0.3 + (((lane * 31 + i * 61) % 47) / 47) * 0.55);
    const s = laneH * 0.12;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(fx - s * 0.4, fy - s * 0.7, fx - s * 0.5, fy - s * 1.2);
    ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(fx + s * 0.5, fy - s * 0.6, fx + s * 0.7, fy - s * 1.1);
    ctx.stroke();
  }
}

/** 夜章萤火虫:3~4 粒黄绿光点慢慢飘;calm 时停在固定位置。 */
export function drawFireflies(ctx: Ctx, w: number, yTop: number, h: number, t: number, calm: boolean): void {
  for (let i = 0; i < 4; i++) {
    const drift = calm ? 0 : Math.sin(t * 0.5 + i * 1.9) * 0.05;
    const fx = w * (0.14 + i * 0.24 + drift);
    const fy = yTop + h * (0.2 + ((i * 29) % 13) / 13 * 0.6 + (calm ? 0 : Math.sin(t * 0.7 + i * 2.3) * 0.05));
    const a = calm ? 0.55 : 0.3 + 0.35 * Math.abs(Math.sin(t * 1.6 + i * 2.1));
    ctx.fillStyle = `rgba(214,255,140,${(a * 0.3).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(fx, fy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(244,255,196,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(fx, fy, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 房子端的小栅栏剪影;fall>0 是被突破时倒下的一帧演出(往家那边斜)。 */
export function drawFence(
  ctx: Ctx,
  x: number,
  yTop: number,
  yBottom: number,
  unit: number,
  fall: number,
): void {
  ctx.save();
  // 倒下用剪切位移画:离地越高歪得越多(不依赖 rotate,轻量 context 也能画)
  const leanAt = (y: number): number => -Math.min(1, fall) * 0.4 * (yBottom - y);
  ctx.strokeStyle = "rgba(196,150,96,0.85)";
  ctx.lineWidth = Math.max(2, unit * 0.08);
  ctx.lineCap = "round";
  const step = unit * 0.55;
  ctx.beginPath();
  for (let y = yTop + step * 0.4; y < yBottom; y += step) {
    ctx.moveTo(x - unit * 0.1 + leanAt(y), y);
    ctx.lineTo(x + unit * 0.1 + leanAt(y), y);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(176,130,80,0.9)";
  ctx.beginPath();
  ctx.moveTo(x + leanAt(yTop), yTop);
  ctx.lineTo(x, yBottom);
  ctx.stroke();
  ctx.fillStyle = "rgba(176,130,80,0.9)";
  ctx.beginPath();
  ctx.arc(x + leanAt(yTop), yTop, unit * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ================= 七、地图装饰 ================= */

export type HorizonVariant = "garden" | "snow" | "night" | "water";

/** 关卡地图底部的章节地平线剪影(花园/雪原/夜园/水畔查表)。 */
export function drawMapHorizon(ctx: Ctx, w: number, h: number, variant: HorizonVariant, accent: string): void {
  const base = h - 26;
  ctx.save();
  ctx.globalAlpha = 0.5;
  // 两座圆丘
  ctx.fillStyle =
    variant === "snow" ? "#e8f2fb" : variant === "night" ? "#2e3452" : variant === "water" ? "#9fd8f5" : "#b8e2a8";
  ctx.beginPath();
  ctx.ellipse(w * 0.25, h + 8, w * 0.42, 44, 0, Math.PI, 0);
  ctx.ellipse(w * 0.78, h + 8, w * 0.4, 34, 0, Math.PI, 0);
  ctx.fill();
  if (variant === "garden") {
    // 三朵小花点
    ctx.fillStyle = accent;
    for (let i = 0; i < 3; i++) {
      const fx = w * (0.2 + i * 0.3);
      ctx.beginPath();
      ctx.arc(fx, base + 4 - (i % 2) * 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (variant === "snow") {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const fx = w * (0.22 + i * 0.28);
      const fy = base + 2 - (i % 2) * 8;
      ctx.beginPath();
      ctx.moveTo(fx - 4, fy);
      ctx.lineTo(fx + 4, fy);
      ctx.moveTo(fx, fy - 4);
      ctx.lineTo(fx, fy + 4);
      ctx.stroke();
    }
  } else if (variant === "night") {
    drawKitIcon(ctx, "moon", w * 0.85, base - 14, 9);
  } else {
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const fx = w * (0.2 + i * 0.3);
      ctx.beginPath();
      ctx.moveTo(fx - 8, base + 6);
      ctx.quadraticCurveTo(fx, base + 1, fx + 8, base + 6);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 地图连线上的小叶片路径点(替代虚线)。 */
export function drawLeafDot(ctx: Ctx, x: number, y: number, r: number, angle: number, dark: boolean): void {
  ctx.save();
  ctx.fillStyle = dark ? "rgba(255,255,255,0.4)" : "rgba(110,170,110,0.65)";
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.5, angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 主页/地图的章节圆章:accent 圆底 + 白色双叶芽 + 一圈叶环;锁住换挂锁。 */
export function drawThemeMedallion(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  accent: string,
  locked: boolean,
): void {
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
  g.addColorStop(0, locked ? "#d8d8de" : shade(accent, 50));
  g.addColorStop(1, locked ? "#b8b8c2" : accent);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.stroke();
  if (locked) {
    drawKitIcon(ctx, "lock", x, y, r * 0.52);
  } else {
    // 叶环:六片小叶绕一圈
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78, r * 0.13, r * 0.07, a, 0, Math.PI * 2);
      ctx.fill();
    }
    drawKitIcon(ctx, "sprout", x, y + r * 0.05, r * 0.5);
  }
  ctx.restore();
}
