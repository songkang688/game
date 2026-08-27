/**
 * 弹弹小鸟 · 1.3 视觉资产库(纯 Canvas 矢量,零位图、零字符占位)。
 *
 * 三条约定(与视觉宪法一致):
 *  1. **只画不算**:坐标、半径、血量比例全部由调用方传入,这里不含任何
 *     物理 / 判定数值。`bird.r`、豆豆判定半径等玩法数据一个都不碰。
 *  2. 同一组参数画出的调用序列**逐次一致**(不调 Math.random、不看时钟),
 *     动画相位(翅膀 / 眨眼 / 摇摆)全部由调用方算好传进来,
 *     `prefers-reduced-motion` 时调用方传静止相位即可整体退化为静态。
 *  3. 小鸟 / 豆豆是本款独占资产;共享 kit(`src/art/kit/`)建成后,
 *     星屑与结算金星应改为 import kit —— 目前仓库尚无该目录,先在本地实现。
 */
import { BIRD_INFO } from "./birds";
import type { BirdKind, BlockKind } from "./levels";
import { MAT } from "./materials";

type Ctx = CanvasRenderingContext2D;

/* ------------------------------------------------------------------ */
/* 颜色小工具                                                          */
/* ------------------------------------------------------------------ */

/** 把 #rrggbb 变深/变浅(amt 为 -255..255),返回 rgb() */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 正 n 角星路径(以原点为中心,尖朝上)。结算金星 / 火花 / 弹道星点共用 */
export function pathStar(c: Ctx, points: number, rOut: number, rIn: number): void {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? rOut : rIn;
    const a = (Math.PI * i) / points - Math.PI / 2;
    if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
}

/* ------------------------------------------------------------------ */
/* 小鸟:五种体型 + 表情状态                                            */
/* ------------------------------------------------------------------ */

export type BirdMood = "idle" | "charge" | "fly" | "rest";

export interface BirdPose {
  kind: BirdKind;
  x: number;
  y: number;
  /** 判定半径(原样传入,绘制轮廓在它基础上做体型变化,不反过来影响判定) */
  r: number;
  /** 飞行倾角(弧度),站立时 0 */
  angle?: number;
  /** 翅膀扑动相位(弧度) */
  flap?: number;
  /** 表情:idle 待机 / charge 拉弓蓄力 / fly 飞行瞪眼 / rest 落地捂头 */
  mood?: BirdMood;
  /** 眨眼程度 0..1(1 = 全闭)。reduceMotion 时调用方恒传 0 */
  blink?: number;
  /** 速度线强度 0..1(飞得快才有,reduceMotion 时恒 0) */
  dash?: number;
}

/**
 * 体型差异只改绘制轮廓(判定半径 r 原样不动):
 * 直冲糯糯 = 标准圆;分裂云云 = 瘦高椭圆;下砸墩墩 = 矮胖椭圆;
 * 加速钻闪闪 = 前尖水滴;回旋卷卷 = 圆(蓬毛另画)。
 */
function birdBodyPath(c: Ctx, kind: BirdKind, r: number): void {
  c.beginPath();
  if (kind === "split") {
    c.ellipse(0, 0, r * 0.93, r * 1.1, 0, 0, Math.PI * 2);
  } else if (kind === "slam") {
    c.ellipse(0, 0, r * 1.15, r * 0.92, 0, 0, Math.PI * 2);
  } else if (kind === "drill") {
    // 前尖水滴:背面圆润,嘴侧用贝塞尔拉出尖头
    c.moveTo(-r, 0);
    c.bezierCurveTo(-r, -r * 0.96, r * 0.1, -r * 0.94, r * 1.16, -r * 0.14);
    c.quadraticCurveTo(r * 1.34, 0, r * 1.16, r * 0.14);
    c.bezierCurveTo(r * 0.1, r * 0.94, -r, r * 0.96, -r, 0);
    c.closePath();
  } else {
    // straight / boomerang:标准圆
    c.arc(0, 0, r, 0, Math.PI * 2);
  }
}

export function drawBirdArt(c: Ctx, pose: BirdPose): void {
  const info = BIRD_INFO[pose.kind];
  const r = pose.r;
  const mood: BirdMood = pose.mood ?? "idle";
  const blink = mood === "charge" ? 1 : clamp01(pose.blink ?? 0);
  const flap = pose.flap ?? 0;
  const dash = clamp01(pose.dash ?? 0);
  c.save();
  c.translate(pose.x, pose.y);
  c.rotate(pose.angle ?? 0);

  // 速度线:飞得快时身后 3 根白色拖线
  if (dash > 0) {
    c.lineCap = "round";
    c.strokeStyle = "rgba(255,255,255,0.75)";
    for (const [dy, len, k] of [
      [-0.45, 1.0, 0.8],
      [0.05, 1.35, 1],
      [0.5, 0.9, 0.7]
    ] as const) {
      c.globalAlpha = 0.5 * dash * k;
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-r * 1.3, r * dy);
      c.lineTo(-r * (1.3 + len * dash), r * dy);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  // 尾羽(三根小羽毛)
  c.fillStyle = shade(info.color, -26);
  for (const [dy, len] of [
    [-0.28, 0.9],
    [0, 1.05],
    [0.28, 0.9]
  ] as const) {
    c.beginPath();
    c.ellipse(-r * (0.75 + len * 0.25), r * dy, r * 0.42 * len, r * 0.16, dy * 0.7, 0, Math.PI * 2);
    c.fill();
  }

  // 卷卷:两侧各三撮蓬毛,先画,身体压住内半边
  if (pose.kind === "boomerang") {
    c.fillStyle = shade(info.color, -18);
    for (const deg of [118, 152, 186, 174, 208, 242]) {
      const a = (deg * Math.PI) / 180;
      c.beginPath();
      c.arc(Math.cos(a) * r * 0.94, Math.sin(a) * r * 0.94, r * 0.22, 0, Math.PI * 2);
      c.fill();
    }
  }

  // 身体:径向渐变 + 描边(体型轮廓按 kind 分支)
  const bodyGrad = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.2, 0, 0, r * 1.15);
  bodyGrad.addColorStop(0, shade(info.color, 26));
  bodyGrad.addColorStop(1, shade(info.color, -14));
  c.fillStyle = bodyGrad;
  c.strokeStyle = info.dark;
  c.lineWidth = 1.8;
  birdBodyPath(c, pose.kind, r);
  c.fill();
  c.stroke();

  // 肚皮(随体型微调)
  c.fillStyle = info.belly;
  c.beginPath();
  if (pose.kind === "slam") c.ellipse(0, r * 0.32, r * 0.62, r * 0.5, 0, 0, Math.PI * 2);
  else if (pose.kind === "split") c.ellipse(0, r * 0.4, r * 0.5, r * 0.6, 0, 0, Math.PI * 2);
  else c.arc(0, r * 0.35, r * 0.55, 0, Math.PI * 2);
  c.fill();

  // 翅膀:落地休息时抬到头顶「捂头」,其余时候在体侧扑动
  c.save();
  if (mood === "rest") {
    c.translate(r * 0.05, -r * 0.7);
    c.rotate(-1.9);
  } else {
    c.translate(-r * 0.25, r * 0.05);
    c.rotate(flap);
  }
  c.fillStyle = shade(info.color, -20);
  c.strokeStyle = info.dark;
  c.lineWidth = 1.2;
  c.beginPath();
  c.ellipse(0, 0, r * 0.5, r * 0.3, -0.5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();

  // 高光
  c.fillStyle = "rgba(255,255,255,0.5)";
  c.beginPath();
  c.ellipse(-r * 0.32, -r * 0.45, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2);
  c.fill();

  // 眼睛:蓄力闭眼 / 飞行瞪眼 / 待机与休息可眨眼
  if (blink >= 0.7) {
    // 闭眼:两条下弯的睫毛线
    c.strokeStyle = "#4A3B45";
    c.lineWidth = r * 0.1;
    c.lineCap = "round";
    for (const wx of [r * 0.25, r * 0.68]) {
      c.beginPath();
      c.arc(wx + r * 0.03, -r * 0.28, r * 0.16, Math.PI * 0.15, Math.PI * 0.85);
      c.stroke();
    }
  } else {
    const wide = mood === "fly" ? 1.18 : 1;
    const eyeH = 1 - blink * 0.6;
    c.fillStyle = "#FFFFFF";
    c.beginPath();
    for (const wx of [r * 0.25, r * 0.68]) c.ellipse(wx, -r * 0.25, r * 0.24 * wide, r * 0.24 * wide * eyeH, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#4A3B45";
    c.beginPath();
    for (const px of [r * 0.3, r * 0.73]) c.ellipse(px, -r * 0.23, r * 0.14 * wide, r * 0.14 * wide * eyeH, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#FFFFFF";
    c.beginPath();
    c.arc(r * 0.34, -r * 0.28, r * 0.05, 0, Math.PI * 2);
    c.arc(r * 0.77, -r * 0.28, r * 0.05, 0, Math.PI * 2);
    c.fill();
  }

  // 腮红;蓄力时鼓腮(腮红更大 + 一圈鼓起弧线)
  const puff = mood === "charge" ? 1.5 : 1;
  c.fillStyle = "rgba(255,120,140,0.45)";
  c.beginPath();
  c.arc(-r * 0.3, r * 0.1, r * 0.2 * puff, 0, Math.PI * 2);
  c.fill();
  if (mood === "charge") {
    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(-r * 0.3, r * 0.1, r * 0.34, Math.PI * 0.6, Math.PI * 1.5);
    c.stroke();
  }

  // 小嘴巴(上下两瓣)
  c.fillStyle = "#F7B267";
  c.strokeStyle = "#D98E3F";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(r * 0.95, -r * 0.08);
  c.lineTo(r * 1.35, r * 0.06);
  c.lineTo(r * 0.92, r * 0.12);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = "#EFA050";
  c.beginPath();
  c.moveTo(r * 0.92, r * 0.14);
  c.lineTo(r * 1.28, r * 0.14);
  c.lineTo(r * 0.9, r * 0.3);
  c.closePath();
  c.fill();

  // 技能标记(头顶剪影特征,五种互不相同)
  c.fillStyle = info.dark;
  if (pose.kind === "straight") {
    c.beginPath();
    c.moveTo(-r * 0.1, -r * 0.95);
    c.quadraticCurveTo(r * 0.15, -r * 1.5, r * 0.4, -r * 1.0);
    c.quadraticCurveTo(r * 0.15, -r * 1.1, -r * 0.1, -r * 0.95);
    c.fill();
  } else if (pose.kind === "split") {
    c.beginPath();
    c.arc(-r * 0.35, -r * 0.75, r * 0.14, 0, Math.PI * 2);
    c.arc(0, -r * 0.9, r * 0.14, 0, Math.PI * 2);
    c.arc(r * 0.35, -r * 0.75, r * 0.14, 0, Math.PI * 2);
    c.fill();
  } else if (pose.kind === "slam") {
    c.beginPath();
    c.roundRect(-r * 0.6, -r * 1.05, r * 1.2, r * 0.32, 2);
    c.fill();
  } else if (pose.kind === "drill") {
    c.beginPath();
    c.moveTo(-r * 0.2, -r * 0.8);
    c.lineTo(r * 0.45, -r * 0.95);
    c.lineTo(r * 0.15, -r * 0.55);
    c.closePath();
    c.fill();
  } else {
    // 卷卷:头顶一撮打着圈的回旋呆毛
    c.strokeStyle = info.dark;
    c.lineWidth = r * 0.22;
    c.lineCap = "round";
    c.beginPath();
    c.arc(r * 0.05, -r * 1.05, r * 0.32, Math.PI * 0.2, Math.PI * 1.6);
    c.stroke();
    c.beginPath();
    c.arc(r * 0.05, -r * 1.05, r * 0.14, Math.PI * 0.6, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}

/* ------------------------------------------------------------------ */
/* 豆豆:三种体型 + 惊讶 / 眨眼 / 跳舞                                  */
/* ------------------------------------------------------------------ */

export type BeanVariant = "sprout" | "helmet" | "elder";

/** 按豆豆在关卡里的序号确定体型(确定性查表,不动判定半径) */
export function beanVariant(index: number): BeanVariant {
  const m = ((index % 3) + 3) % 3;
  return m === 0 ? "sprout" : m === 1 ? "helmet" : "elder";
}

export interface BeanPose {
  x: number;
  y: number;
  r: number;
  /** 呼吸抖动量(调用方按时间算好;reduceMotion 传 0) */
  wob?: number;
  /** 眨眼 0..1 */
  blink?: number;
  /** 跳舞倾角(弧度,失败结算的幸灾乐祸小舞;reduceMotion 传 0) */
  tilt?: number;
  /** 被击中的 0.2s 惊讶脸(圆嘴 + 飞汗滴) */
  surprise?: boolean;
}

export function drawBeanArt(c: Ctx, variant: BeanVariant, pose: BeanPose): void {
  const { x, y, r } = pose;
  const wob = pose.wob ?? 0;
  const blink = pose.surprise ? 0 : clamp01(pose.blink ?? 0);
  c.save();
  c.translate(x, y);
  if (pose.tilt) c.rotate(pose.tilt);

  // 身体:径向渐变绿椭圆
  const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.2, 0, 0, r * 1.15);
  g.addColorStop(0, "#C4EA92");
  g.addColorStop(1, "#8FC957");
  c.fillStyle = g;
  c.strokeStyle = "#7FB84B";
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(0, 0, r + wob * 0.3, r - wob * 0.3, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // 头饰:普通豆 1 片嫩叶 / 戴盔豆 3 片叠盔 / 长辈豆小叶 + 眉毛胡子在脸部画
  if (variant === "helmet") {
    const layers: ReadonlyArray<readonly [number, number, number]> = [
      [0, 0.72, 0.34],
      [-0.1, 0.56, 0.28],
      [0.08, 0.4, 0.22]
    ];
    for (let i = 0; i < layers.length; i++) {
      const [dx, w, h] = layers[i];
      c.fillStyle = i === 1 ? "#5F9E3B" : "#6FAE45";
      c.strokeStyle = "#568F33";
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(dx * r, -r - r * 0.16 - i * r * 0.2, w * r, h * r, i % 2 === 0 ? -0.25 : 0.3, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  } else {
    c.fillStyle = "#6FAE45";
    c.beginPath();
    c.ellipse(r * 0.3, -r - r * 0.3, r * 0.45, r * 0.26, -0.6, 0, Math.PI * 2);
    c.fill();
    if (variant === "sprout") {
      // 嫩芽茎
      c.strokeStyle = "#6FAE45";
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(0, -r);
      c.quadraticCurveTo(r * 0.12, -r - r * 0.24, r * 0.26, -r - r * 0.26);
      c.stroke();
    }
  }

  // 脸
  if (pose.surprise) {
    // 惊讶:瞪圆白眼 + O 形圆嘴 + 两粒飞汗滴
    c.fillStyle = "#FFFFFF";
    c.beginPath();
    c.arc(-r * 0.34, -r * 0.2, r * 0.2, 0, Math.PI * 2);
    c.arc(r * 0.34, -r * 0.2, r * 0.2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#3E6B24";
    c.beginPath();
    c.arc(-r * 0.34, -r * 0.2, r * 0.1, 0, Math.PI * 2);
    c.arc(r * 0.34, -r * 0.2, r * 0.1, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#3E6B24";
    c.lineWidth = r * 0.16;
    c.beginPath();
    c.arc(0, r * 0.3, r * 0.24, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = "rgba(160,214,255,0.95)";
    for (const [dx, dy] of [
      [-r * 1.05, -r * 0.75],
      [r * 1.1, -r * 0.55]
    ] as const) {
      c.beginPath();
      c.ellipse(dx, dy, r * 0.14, r * 0.22, dx < 0 ? -0.5 : 0.5, 0, Math.PI * 2);
      c.fill();
    }
  } else {
    if (blink >= 0.7) {
      c.strokeStyle = "#3E6B24";
      c.lineWidth = 1.4;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(-r * 0.46, -r * 0.2);
      c.lineTo(-r * 0.22, -r * 0.2);
      c.moveTo(r * 0.22, -r * 0.2);
      c.lineTo(r * 0.46, -r * 0.2);
      c.stroke();
    } else {
      c.fillStyle = "#3E6B24";
      c.beginPath();
      c.arc(-r * 0.34, -r * 0.2, r * 0.15, 0, Math.PI * 2);
      c.arc(r * 0.34, -r * 0.2, r * 0.15, 0, Math.PI * 2);
      c.fill();
    }
    if (variant === "elder") {
      // 长辈感:眉毛两道 + 白胡子两撇
      c.strokeStyle = "#3E6B24";
      c.lineWidth = 1.4;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(-r * 0.5, -r * 0.5);
      c.lineTo(-r * 0.18, -r * 0.42);
      c.moveTo(r * 0.18, -r * 0.42);
      c.lineTo(r * 0.5, -r * 0.5);
      c.stroke();
      c.strokeStyle = "#F2F8E8";
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-r * 0.1, r * 0.3);
      c.quadraticCurveTo(-r * 0.5, r * 0.34, -r * 0.62, r * 0.14);
      c.moveTo(r * 0.1, r * 0.3);
      c.quadraticCurveTo(r * 0.5, r * 0.34, r * 0.62, r * 0.14);
      c.stroke();
    }
    c.strokeStyle = "#3E6B24";
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(0, r * 0.25, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
    c.stroke();
    c.fillStyle = "rgba(255,140,160,0.4)";
    c.beginPath();
    c.arc(-r * 0.6, r * 0.2, r * 0.18, 0, Math.PI * 2);
    c.arc(r * 0.6, r * 0.2, r * 0.18, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/* ------------------------------------------------------------------ */
/* 方块:材质纹理 + 残血裂纹分级                                        */
/* ------------------------------------------------------------------ */

export interface BlockSpec {
  kind: BlockKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 血量比例 hp/maxHp,0..1;>0.5 无裂纹,≤0.5 一条折线,≤0.25 再加三条放射 */
  ratio: number;
}

/** 裂纹颜色:取材质 edge 色加深后的半透明 */
export function crackColor(kind: BlockKind): string {
  const n = parseInt(MAT[kind].edge.slice(1), 16);
  const r = Math.max(0, (n >> 16) - 72);
  const g = Math.max(0, ((n >> 8) & 0xff) - 72);
  const b = Math.max(0, (n & 0xff) - 72);
  return `rgba(${r},${g},${b},0.6)`;
}

export function drawBlockArt(c: Ctx, b: BlockSpec): void {
  const m = MAT[b.kind];
  if (b.kind === "wood") {
    const g = c.createLinearGradient(b.x, b.y, b.w >= b.h ? b.x : b.x + b.w, b.w >= b.h ? b.y + b.h : b.y);
    g.addColorStop(0, "#F2CFA0");
    g.addColorStop(0.5, m.fill);
    g.addColorStop(1, "#D8AC76");
    c.fillStyle = g;
  } else if (b.kind === "stone") {
    const g = c.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    g.addColorStop(0, "#E0E4EC");
    g.addColorStop(1, "#BCC2CF");
    c.fillStyle = g;
  } else {
    c.fillStyle = m.fill;
  }
  c.strokeStyle = m.edge;
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(b.x, b.y, b.w, b.h, 4);
  c.fill();
  c.stroke();
  if (b.kind === "wood") {
    // 木板纹理:板缝 + 短木纹
    c.strokeStyle = "rgba(160,110,60,0.4)";
    c.lineWidth = 1.5;
    c.beginPath();
    if (b.w >= b.h) {
      c.moveTo(b.x + 4, b.y + b.h / 2);
      c.lineTo(b.x + b.w - 4, b.y + b.h / 2);
    } else {
      c.moveTo(b.x + b.w / 2, b.y + 4);
      c.lineTo(b.x + b.w / 2, b.y + b.h - 4);
    }
    c.stroke();
    c.strokeStyle = "rgba(160,110,60,0.22)";
    c.lineWidth = 1;
    c.beginPath();
    if (b.w >= b.h) {
      c.moveTo(b.x + b.w * 0.22, b.y + b.h * 0.26);
      c.lineTo(b.x + b.w * 0.42, b.y + b.h * 0.26);
      c.moveTo(b.x + b.w * 0.55, b.y + b.h * 0.74);
      c.lineTo(b.x + b.w * 0.8, b.y + b.h * 0.74);
    } else {
      c.moveTo(b.x + b.w * 0.26, b.y + b.h * 0.22);
      c.lineTo(b.x + b.w * 0.26, b.y + b.h * 0.42);
      c.moveTo(b.x + b.w * 0.74, b.y + b.h * 0.55);
      c.lineTo(b.x + b.w * 0.74, b.y + b.h * 0.8);
    }
    c.stroke();
  } else if (b.kind === "stone") {
    // 砖缝
    c.strokeStyle = "rgba(140,148,165,0.5)";
    c.lineWidth = 1.2;
    c.beginPath();
    if (b.w >= b.h) {
      c.moveTo(b.x + 3, b.y + b.h / 2);
      c.lineTo(b.x + b.w - 3, b.y + b.h / 2);
      c.moveTo(b.x + b.w * 0.33, b.y + 2);
      c.lineTo(b.x + b.w * 0.33, b.y + b.h / 2);
      c.moveTo(b.x + b.w * 0.66, b.y + b.h / 2);
      c.lineTo(b.x + b.w * 0.66, b.y + b.h - 2);
    } else {
      c.moveTo(b.x + 2, b.y + b.h * 0.33);
      c.lineTo(b.x + b.w - 2, b.y + b.h * 0.33);
      c.moveTo(b.x + 2, b.y + b.h * 0.66);
      c.lineTo(b.x + b.w - 2, b.y + b.h * 0.66);
    }
    c.stroke();
  } else if (b.kind === "ice" || b.kind === "glass") {
    // 斜向闪光
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(b.x + 3, b.y + b.h * 0.4);
    c.lineTo(b.x + b.w * 0.42, b.y + 3);
    c.stroke();
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(b.x + b.w * 0.3, b.y + b.h - 4);
    c.lineTo(b.x + b.w - 4, b.y + b.h * 0.25);
    c.stroke();
  } else if (b.kind === "shell") {
    // 岩壳:粗糙的鹅卵石纹 + 中缝透出的一线暖光,暗示里面藏着晶核
    c.strokeStyle = "rgba(90,66,48,0.5)";
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(b.x + b.w * 0.32, b.y + b.h * 0.34, Math.min(b.w, b.h) * 0.16, 0, Math.PI * 2);
    c.moveTo(b.x + b.w * 0.78, b.y + b.h * 0.62);
    c.arc(b.x + b.w * 0.66, b.y + b.h * 0.62, Math.min(b.w, b.h) * 0.12, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = "rgba(255,214,140,0.85)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(b.x + b.w * 0.5, b.y + b.h * 0.2);
    c.lineTo(b.x + b.w * 0.42, b.y + b.h * 0.5);
    c.lineTo(b.x + b.w * 0.56, b.y + b.h * 0.82);
    c.stroke();
  } else if (b.kind === "core") {
    // 晶核:亮闪闪的钻石切面,一看就很脆
    c.strokeStyle = "rgba(255,255,255,0.95)";
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(b.x + b.w / 2, b.y + 3);
    c.lineTo(b.x + b.w - 4, b.y + b.h / 2);
    c.lineTo(b.x + b.w / 2, b.y + b.h - 3);
    c.lineTo(b.x + 4, b.y + b.h / 2);
    c.closePath();
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.beginPath();
    c.arc(b.x + b.w * 0.38, b.y + b.h * 0.36, 2.2, 0, Math.PI * 2);
    c.fill();
  } else if (b.kind === "tnt") {
    // 警示斜纹 + 内框 + 白圈里一枚painted八角火花(1.3:字符「爆」换成绘制资产)
    c.save();
    c.beginPath();
    c.roundRect(b.x, b.y, b.w, b.h, 4);
    c.clip();
    c.strokeStyle = "rgba(226,132,141,0.4)";
    c.lineWidth = 3;
    for (let sx = b.x - b.h; sx < b.x + b.w; sx += 10) {
      c.beginPath();
      c.moveTo(sx, b.y + b.h);
      c.lineTo(sx + b.h, b.y);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = "#E2848D";
    c.lineWidth = 2;
    c.strokeRect(b.x + 3.5, b.y + 3.5, b.w - 7, b.h - 7);
    c.fillStyle = "#FFE9EB";
    c.beginPath();
    c.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * 0.34, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.translate(b.x + b.w / 2, b.y + b.h / 2);
    c.fillStyle = "#E2564A";
    pathStar(c, 8, Math.min(b.w, b.h) * 0.26, Math.min(b.w, b.h) * 0.12);
    c.fill();
    c.fillStyle = "#FFD98E";
    c.beginPath();
    c.arc(0, 0, Math.min(b.w, b.h) * 0.08, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  // 顶部受光条
  if (b.kind !== "tnt") {
    c.fillStyle = "rgba(255,255,255,0.3)";
    c.beginPath();
    c.roundRect(b.x + 2, b.y + 2, b.w - 4, Math.min(4, b.h * 0.2), 2);
    c.fill();
  }
  // 残血裂纹分级:>50% 完好;≤50% 一条折线;≤25% 再加三条放射裂纹
  if (b.ratio <= 0.5) {
    c.strokeStyle = crackColor(b.kind);
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(b.x + b.w * 0.25, b.y + 2);
    c.lineTo(b.x + b.w * 0.45, b.y + b.h * 0.35);
    c.lineTo(b.x + b.w * 0.32, b.y + b.h * 0.62);
    c.lineTo(b.x + b.w * 0.48, b.y + b.h - 2);
    c.stroke();
  }
  if (b.ratio <= 0.25) {
    c.strokeStyle = crackColor(b.kind);
    c.lineWidth = 1.2;
    const cx = b.x + b.w * 0.58;
    const cy = b.y + b.h * 0.45;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + b.w * 0.3, cy - b.h * 0.32);
    c.moveTo(cx, cy);
    c.lineTo(cx + b.w * 0.36, cy + b.h * 0.18);
    c.moveTo(cx, cy);
    c.lineTo(cx - b.w * 0.12, cy + b.h * 0.42);
    c.stroke();
  }
}

/* ------------------------------------------------------------------ */
/* 材质碎片查表:碎裂粒子不再是纯色方块                                  */
/* ------------------------------------------------------------------ */

export type ShardShape =
  | "dot"
  | "strip"
  | "quad"
  | "tri"
  | "pebble"
  | "diamond"
  | "spark"
  | "feather"
  | "leaf"
  | "star";

/** 每种方块材质碎裂时的碎片形状:木长条 / 石四边形 / 冰玻璃三角闪片 / 岩壳圆石 / 晶核菱形 / TNT 火花 */
export const SHARD_SHAPE: Record<BlockKind, ShardShape> = {
  wood: "strip",
  stone: "quad",
  ice: "tri",
  glass: "tri",
  shell: "pebble",
  core: "diamond",
  tnt: "spark"
};

export function shardShapeFor(kind: BlockKind): ShardShape {
  return SHARD_SHAPE[kind] ?? "quad";
}

/** 每种材质碎片的配色组 */
export const SHARD_COLORS: Record<BlockKind, string[]> = {
  wood: ["#E8C08E", "#D8AC76", "#C79A66"],
  stone: ["#CDD2DC", "#B7BDCB", "#A6ADBC"],
  ice: ["rgba(190,230,255,0.9)", "rgba(226,245,255,0.85)"],
  glass: ["rgba(226,245,255,0.8)", "rgba(255,255,255,0.85)"],
  shell: ["#B49A85", "#9A7F68", "#846852"],
  core: ["#FFD98E", "#FFE9B8", "#E0A452"],
  tnt: ["#FFB864", "#FFD98E", "#FF9E7A"]
};

/**
 * 以原点为中心画一枚碎片(调用方负责 translate / rotate / globalAlpha)。
 * 形状按材质查表,同一形状同一参数的调用序列逐次一致。
 */
export function drawShard(c: Ctx, shape: ShardShape, size: number, color: string): void {
  c.fillStyle = color;
  if (shape === "strip") {
    // 木片:2:1 圆角长条 + 一道木纹
    c.beginPath();
    c.roundRect(-size, -size / 2, size * 2, size, size * 0.35);
    c.fill();
    c.strokeStyle = "rgba(160,110,60,0.5)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-size * 0.6, 0);
    c.lineTo(size * 0.6, 0);
    c.stroke();
  } else if (shape === "quad") {
    // 石块:不规则四边形
    c.beginPath();
    c.moveTo(-size, -size * 0.6);
    c.lineTo(size * 0.7, -size * 0.9);
    c.lineTo(size * 0.95, size * 0.55);
    c.lineTo(-size * 0.55, size * 0.85);
    c.closePath();
    c.fill();
  } else if (shape === "tri") {
    // 冰 / 玻璃:半透明三角闪片 + 白描边
    c.beginPath();
    c.moveTo(0, -size);
    c.lineTo(size * 0.9, size * 0.7);
    c.lineTo(-size * 0.9, size * 0.55);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = 1;
    c.stroke();
  } else if (shape === "pebble") {
    // 岩壳:褐色圆石粒
    c.beginPath();
    c.ellipse(0, 0, size, size * 0.75, 0.4, 0, Math.PI * 2);
    c.fill();
  } else if (shape === "diamond") {
    // 晶核:菱形亮片 + 白色小glint
    c.beginPath();
    c.moveTo(0, -size);
    c.lineTo(size * 0.7, 0);
    c.lineTo(0, size);
    c.lineTo(-size * 0.7, 0);
    c.closePath();
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.beginPath();
    c.arc(-size * 0.15, -size * 0.3, size * 0.18, 0, Math.PI * 2);
    c.fill();
  } else if (shape === "spark") {
    // TNT:四角星形火花
    pathStar(c, 4, size * 1.2, size * 0.42);
    c.fill();
  } else if (shape === "feather") {
    // 小羽毛:细长椭圆 + 中轴羽轴
    c.beginPath();
    c.ellipse(0, 0, size * 1.2, size * 0.5, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-size * 1.05, 0);
    c.lineTo(size * 1.05, 0);
    c.stroke();
  } else if (shape === "leaf") {
    // 叶子:椭圆 + 叶柄
    c.beginPath();
    c.ellipse(0, 0, size * 1.1, size * 0.6, -0.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(90,140,70,0.8)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(size * 0.7, -size * 0.5);
    c.lineTo(-size * 0.7, size * 0.5);
    c.stroke();
  } else if (shape === "star") {
    // 五角星屑(结算 / 豆豆星屑)
    pathStar(c, 5, size * 1.2, size * 0.5);
    c.fill();
  } else {
    c.beginPath();
    c.arc(0, 0, size, 0, Math.PI * 2);
    c.fill();
  }
}

/** TNT 冲击波:白色圆环 0.25s 扩散淡出(t 传 0..1) */
export function drawShockRing(c: Ctx, x: number, y: number, t: number, maxR: number): void {
  const k = clamp01(t);
  c.globalAlpha = (1 - k) * 0.8;
  c.strokeStyle = "#FFFFFF";
  c.lineWidth = 3 * (1 - k) + 1;
  c.beginPath();
  c.arc(x, y, 10 + k * maxR, 0, Math.PI * 2);
  c.stroke();
  c.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* 弹弓:双线皮筋 + 底座点缀                                            */
/* ------------------------------------------------------------------ */

export interface SlingView {
  x: number;
  y: number;
  groundY: number;
  /** 弹弓上有鸟时传鸟心坐标,空弓传 null */
  birdX: number | null;
  birdY: number | null;
  /** 皮筋张力 0..1 */
  tension: number;
}

export function drawSlingshotArt(c: Ctx, v: SlingView): void {
  const { x, y, groundY, tension } = v;
  // 地面阴影
  c.fillStyle = "rgba(80,90,60,0.18)";
  c.beginPath();
  c.ellipse(x, groundY, 16, 4, 0, 0, Math.PI * 2);
  c.fill();
  // 底座点缀:两簇草 + 一块小石头
  c.fillStyle = "rgba(150,170,120,0.9)";
  for (const [gx, flip] of [
    [x - 14, 1],
    [x + 13, -1]
  ] as const) {
    c.beginPath();
    c.moveTo(gx - 4, groundY);
    c.lineTo(gx - 2, groundY - 7);
    c.lineTo(gx, groundY);
    c.moveTo(gx - 1, groundY);
    c.lineTo(gx + 1 * flip, groundY - 10);
    c.lineTo(gx + 3, groundY);
    c.moveTo(gx + 3, groundY);
    c.lineTo(gx + 5, groundY - 6);
    c.lineTo(gx + 7, groundY);
    c.closePath();
    c.fill();
  }
  c.fillStyle = "#B9B2A6";
  c.beginPath();
  c.ellipse(x + 22, groundY - 2, 4.5, 3, 0.2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.4)";
  c.beginPath();
  c.ellipse(x + 21, groundY - 3.2, 1.8, 1, 0.2, 0, Math.PI * 2);
  c.fill();
  // 大弹弓:粗木叉(深色描边 + 木色内芯,更立体)
  c.lineCap = "round";
  c.strokeStyle = "#96683F";
  c.lineWidth = 11;
  c.beginPath();
  c.moveTo(x, groundY);
  c.lineTo(x, y + 26);
  c.stroke();
  c.lineWidth = 9;
  c.beginPath();
  c.moveTo(x, y + 26);
  c.lineTo(x - 15, y - 12);
  c.moveTo(x, y + 26);
  c.lineTo(x + 15, y - 12);
  c.stroke();
  c.strokeStyle = "#C99A6B";
  c.lineWidth = 6.5;
  c.beginPath();
  c.moveTo(x, groundY - 1);
  c.lineTo(x, y + 26);
  c.stroke();
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(x, y + 26);
  c.lineTo(x - 15, y - 12);
  c.moveTo(x, y + 26);
  c.lineTo(x + 15, y - 12);
  c.stroke();
  // 缠绕的绑带
  c.strokeStyle = "#E2698A";
  c.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(x - 5, y + 30 + i * 4);
    c.lineTo(x + 5, y + 32 + i * 4);
    c.stroke();
  }

  // 皮筋:双线(暗边 + 亮边错 1px)体现厚度;拉得越满绷得越紧(越细、颜色越深)
  const darkBand = tension > 0.66 ? "#B23A54" : tension > 0.33 ? "#C9455F" : "#D75674";
  const lightBand = tension > 0.66 ? "#E2698A" : "#EE8AA6";
  if (v.birdX !== null && v.birdY !== null) {
    const bx = v.birdX;
    const by = v.birdY;
    c.strokeStyle = darkBand;
    c.lineWidth = 4.6 - tension * 1.6;
    c.beginPath();
    c.moveTo(x - 15, y - 12);
    c.lineTo(bx, by);
    c.lineTo(x + 15, y - 12);
    c.stroke();
    c.strokeStyle = lightBand;
    c.lineWidth = 2.4 - tension * 0.9;
    c.beginPath();
    c.moveTo(x - 15, y - 13);
    c.lineTo(bx, by - 1);
    c.lineTo(x + 15, y - 13);
    c.stroke();
    if (tension > 0.8) {
      // 拉满:两股中段各一道张力白高光
      c.strokeStyle = "rgba(255,255,255,0.85)";
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo((x - 15 + bx) / 2 - 4, (y - 12 + by) / 2 - 1);
      c.lineTo((x - 15 + bx) / 2 + 4, (y - 12 + by) / 2 - 1);
      c.moveTo((x + 15 + bx) / 2 - 4, (y - 12 + by) / 2 - 1);
      c.lineTo((x + 15 + bx) / 2 + 4, (y - 12 + by) / 2 - 1);
      c.stroke();
    }
  } else {
    c.strokeStyle = darkBand;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(x - 15, y - 12);
    c.quadraticCurveTo(x, y - 2, x + 15, y - 12);
    c.stroke();
    c.strokeStyle = lightBand;
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(x - 15, y - 13);
    c.quadraticCurveTo(x, y - 3, x + 15, y - 13);
    c.stroke();
  }
}

/** 弹道预测点:小白星点(四角星),精确段带淡蓝描边 */
export function drawSparklePoint(c: Ctx, x: number, y: number, r: number, precise: boolean): void {
  c.save();
  c.translate(x, y);
  c.fillStyle = "#FFFFFF";
  pathStar(c, 4, r * 1.6, r * 0.6);
  c.fill();
  if (precise) {
    c.strokeStyle = "rgba(120,140,190,0.6)";
    c.lineWidth = 1;
    c.stroke();
  }
  c.restore();
}

/* ------------------------------------------------------------------ */
/* 胜利结算仪式(1.3 r3 · R2-TOP10 绘制层子集)                          */
/* ------------------------------------------------------------------ */

/**
 * 仪式节奏:胜利后省下的排队小鸟按 0.25s 间隔逐只腾一个小弧(B 档规格的间隔口径)。
 * 硬约束:`finishWin` 在 endT>0.8 触发后 simT/endT 全部冻结,所以最后一跳必须在
 * 0.8s 结算窗口内落地——排队最多画 2 只(qx<14 截断),第 2 只 0.08+0.25+0.36=0.69s
 * 落地,不留半空定格帧。这里只算演出相位,queue / 物理 / 计分零改动。
 */
export const WIN_LEAP_DELAY = 0.08;
export const WIN_LEAP_STAGGER = 0.25;
export const WIN_LEAP_DUR = 0.36;
export const WIN_LEAP_H = 22;

/** 第 qi 只排队小鸟在胜利后 endT 秒的腾跃进度(起跳前与落地后都是 0,弧中 0..1) */
export function winLeapPhase(endT: number, qi: number): number {
  const p = (endT - WIN_LEAP_DELAY - qi * WIN_LEAP_STAGGER) / WIN_LEAP_DUR;
  return p <= 0 || p >= 1 ? 0 : p;
}

/** 仪式金星屑:腾跃小鸟身边的金色四角星 + 白芯(配色与胜利星屑撒场同族) */
export function drawWinSparkle(c: Ctx, x: number, y: number, r: number, alpha: number): void {
  const a = clamp01(alpha);
  if (a <= 0) return;
  c.save();
  c.globalAlpha = a;
  c.translate(x, y);
  c.fillStyle = "#FFD86B";
  pathStar(c, 4, r * 1.5, r * 0.55);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.85)";
  c.beginPath();
  c.arc(0, 0, r * 0.4, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/* ------------------------------------------------------------------ */
/* 场景:中景剪影层 + 地面草丛带                                        */
/* ------------------------------------------------------------------ */

/** 每章中景剪影的主色(半透明,压在远景与近景战场之间) */
const MID_COLOR = [
  "rgba(140,190,120,0.5)", // 0 青青草地
  "rgba(214,178,120,0.5)", // 1 阳光沙滩
  "rgba(176,200,224,0.55)", // 2 白白雪原
  "rgba(90,100,160,0.6)", // 3 星星夜空
  "rgba(150,84,70,0.55)", // 4 火山峡谷
  "rgba(196,176,232,0.5)", // 5 彩虹云端
  "rgba(130,178,110,0.5)", // 6 风车高地
  "rgba(84,102,158,0.6)", // 7 冰晶矿洞
  "rgba(126,84,64,0.6)" // 8 熔岩工坊
] as const;

/**
 * 中景剪影层:一次 path 画完一章的剪影(树 / 雪杉雪人 / 云堡浮岛…),
 * shift 为镜头拉伸带来的视差微移(reduceMotion 时调用方传 0)。
 */
export function drawMidground(c: Ctx, chapter: number, groundY: number, worldW: number, shift: number): void {
  c.save();
  c.translate(shift, 0);
  c.fillStyle = MID_COLOR[chapter] ?? MID_COLOR[0];
  c.beginPath();
  if (chapter === 0 || chapter === 6) {
    // 草原 / 风车高地:三棵圆树 + 一段栅栏
    for (const [tx, s] of [
      [150, 1],
      [318, 0.8],
      [468, 1.1]
    ] as const) {
      c.rect(tx - 3 * s, groundY - 26 * s, 6 * s, 26 * s);
      c.moveTo(tx + 16 * s, groundY - 34 * s);
      c.arc(tx, groundY - 34 * s, 16 * s, 0, Math.PI * 2);
      c.moveTo(tx - 2 * s, groundY - 46 * s);
      c.arc(tx - 8 * s, groundY - 44 * s, 9 * s, 0, Math.PI * 2);
    }
    for (let fx = 210; fx <= 270; fx += 20) c.rect(fx, groundY - 14, 4, 14);
    c.rect(206, groundY - 11, 72, 3);
  } else if (chapter === 1) {
    // 沙滩:两棵椰子树 + 一把遮阳伞剪影
    for (const [tx, lean] of [
      [190, 1],
      [430, -1]
    ] as const) {
      c.moveTo(tx, groundY);
      c.quadraticCurveTo(tx + 8 * lean, groundY - 24, tx + 16 * lean, groundY - 40);
      c.quadraticCurveTo(tx + 10 * lean, groundY - 22, tx + 6, groundY);
      for (const la of [-0.9, -0.3, 0.4, 1.0]) {
        c.moveTo(tx + 16 * lean, groundY - 40);
        c.quadraticCurveTo(
          tx + 16 * lean + Math.cos(la) * 20,
          groundY - 46 + Math.sin(la) * 10,
          tx + 16 * lean + Math.cos(la) * 26,
          groundY - 38 + Math.sin(la) * 14
        );
      }
    }
    c.moveTo(320, groundY);
    c.rect(318, groundY - 30, 3, 30);
    c.moveTo(342, groundY - 28);
    c.arc(319, groundY - 28, 22, Math.PI, 0);
  } else if (chapter === 2 || chapter === 7) {
    // 雪原 / 冰晶矿洞:三棵雪杉 + 一个雪人剪影
    for (const [tx, s] of [
      [160, 1],
      [330, 0.75],
      [470, 1.05]
    ] as const) {
      for (let layer = 0; layer < 3; layer++) {
        const ly = groundY - (14 + layer * 13) * s;
        const lw = (20 - layer * 5) * s;
        c.moveTo(tx - lw, ly);
        c.lineTo(tx, ly - 15 * s);
        c.lineTo(tx + lw, ly);
        c.closePath();
      }
      c.rect(tx - 2.5 * s, groundY - 10 * s, 5 * s, 10 * s);
    }
    c.moveTo(262, groundY - 9);
    c.arc(252, groundY - 9, 10, 0, Math.PI * 2);
    c.moveTo(259, groundY - 24);
    c.arc(252, groundY - 24, 7, 0, Math.PI * 2);
  } else if (chapter === 3 || chapter === 5) {
    // 星空 / 彩虹云端:云堡 + 浮岛剪影
    c.moveTo(150, groundY - 20);
    c.rect(140, groundY - 52, 14, 32);
    c.rect(162, groundY - 66, 16, 46);
    c.rect(186, groundY - 48, 13, 28);
    c.moveTo(147, groundY - 52);
    c.lineTo(147, groundY - 60);
    c.lineTo(153, groundY - 52);
    c.moveTo(170, groundY - 66);
    c.lineTo(170, groundY - 76);
    c.lineTo(177, groundY - 66);
    c.moveTo(228, groundY - 20);
    c.arc(206, groundY - 26, 22, Math.PI * 0.95, Math.PI * 2.02);
    // 两座浮岛(椭圆岛身 + 底部垂尖)
    for (const [ix, iy, s] of [
      [400, groundY - 74, 1],
      [488, groundY - 46, 0.7]
    ] as const) {
      c.moveTo(ix + 26 * s, iy);
      c.ellipse(ix, iy, 26 * s, 9 * s, 0, 0, Math.PI * 2);
      c.moveTo(ix - 10 * s, iy + 6 * s);
      c.lineTo(ix, iy + 20 * s);
      c.lineTo(ix + 10 * s, iy + 6 * s);
      c.closePath();
    }
  } else if (chapter === 4 || chapter === 8) {
    // 火山峡谷 / 熔岩工坊:嶙峋石笋带 + 一根烟囱
    let sx = 120;
    c.moveTo(sx, groundY);
    for (const [dw, dh] of [
      [34, 44],
      [26, 26],
      [40, 58],
      [30, 34],
      [36, 48],
      [28, 22]
    ] as const) {
      c.lineTo(sx + dw / 2, groundY - dh);
      c.lineTo(sx + dw, groundY);
      sx += dw + 26;
    }
    c.closePath();
    c.rect(452, groundY - 64, 14, 64);
    c.rect(448, groundY - 70, 22, 8);
  }
  c.fill();
  c.restore();
}

/** 每章草丛带的颜色(雪原偏白、火山偏焦糖) */
const GRASS_COLOR = [
  "rgba(110,168,90,0.85)",
  "rgba(206,178,116,0.85)",
  "rgba(228,238,248,0.9)",
  "rgba(120,130,190,0.85)",
  "rgba(150,96,72,0.85)",
  "rgba(176,208,150,0.85)",
  "rgba(104,160,86,0.85)",
  "rgba(140,158,214,0.85)",
  "rgba(150,100,70,0.85)"
] as const;

/** 地面草丛带:三角草簇每 60px 一组,确定性摆放(静态,天然满足弱动效) */
export function drawGrassStrip(c: Ctx, chapter: number, groundY: number, worldW: number): void {
  c.fillStyle = GRASS_COLOR[chapter] ?? GRASS_COLOR[0];
  c.beginPath();
  for (let gx = 18; gx < worldW; gx += 60) {
    const jig = (gx * 7) % 5;
    c.moveTo(gx - 5, groundY + 1);
    c.lineTo(gx - 3, groundY - 6 - jig);
    c.lineTo(gx - 1, groundY + 1);
    c.moveTo(gx - 1, groundY + 1);
    c.lineTo(gx + 1, groundY - 9 - jig);
    c.lineTo(gx + 3, groundY + 1);
    c.moveTo(gx + 3, groundY + 1);
    c.lineTo(gx + 5, groundY - 5 - jig);
    c.lineTo(gx + 7, groundY + 1);
  }
  c.closePath();
  c.fill();
}

/* ------------------------------------------------------------------ */
/* 关卡横幅角标:每章一枚绘制小徽章                                      */
/* ------------------------------------------------------------------ */

/**
 * 画在横幅圆角条两端的章节角标:
 * 草地小花 / 沙滩太阳 / 雪原雪花 / 夜空五角星 / 火山四角火花 /
 * 云端彩虹拱 / 高地风车 / 矿洞宝钻 / 工坊齿轮。
 */
export function drawBannerBadge(c: Ctx, x: number, y: number, r: number, chapter: number): void {
  c.save();
  c.translate(x, y);
  if (chapter === 0) {
    c.fillStyle = "#FFA7C4";
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      c.beginPath();
      c.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.42, r * 0.28, a, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#FFE58A";
    c.beginPath();
    c.arc(0, 0, r * 0.34, 0, Math.PI * 2);
    c.fill();
  } else if (chapter === 1) {
    c.fillStyle = "#FFD96A";
    c.beginPath();
    c.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#FFD96A";
    c.lineWidth = r * 0.16;
    c.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      c.beginPath();
      c.moveTo(Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68);
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      c.stroke();
    }
  } else if (chapter === 2 || chapter === 7) {
    c.strokeStyle = chapter === 2 ? "#9FD8F2" : "#C4B2F0";
    c.lineWidth = r * 0.16;
    c.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * i) / 3;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      c.moveTo(Math.cos(a) * r * 0.62 + Math.cos(a + Math.PI / 2) * r * 0.2, Math.sin(a) * r * 0.62 + Math.sin(a + Math.PI / 2) * r * 0.2);
      c.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
      c.lineTo(Math.cos(a) * r * 0.62 - Math.cos(a + Math.PI / 2) * r * 0.2, Math.sin(a) * r * 0.62 - Math.sin(a + Math.PI / 2) * r * 0.2);
      c.stroke();
    }
  } else if (chapter === 3) {
    c.fillStyle = "#FFD86B";
    pathStar(c, 5, r, r * 0.45);
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.beginPath();
    c.arc(-r * 0.2, -r * 0.25, r * 0.14, 0, Math.PI * 2);
    c.fill();
  } else if (chapter === 4 || chapter === 8) {
    c.fillStyle = chapter === 4 ? "#FFB864" : "#C9A06B";
    if (chapter === 4) {
      pathStar(c, 4, r, r * 0.4);
      c.fill();
      c.fillStyle = "#FFE9A8";
      c.beginPath();
      c.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      c.fill();
    } else {
      // 齿轮:外齿 + 轴孔
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        c.beginPath();
        c.arc(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, r * 0.2, 0, Math.PI * 2);
        c.fill();
      }
      c.beginPath();
      c.arc(0, 0, r * 0.66, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#FFF3DC";
      c.beginPath();
      c.arc(0, 0, r * 0.26, 0, Math.PI * 2);
      c.fill();
    }
  } else if (chapter === 5) {
    const arcCols = ["#FF9E9E", "#FFF3A8", "#A5D4F5"];
    c.lineWidth = r * 0.22;
    for (let i = 0; i < arcCols.length; i++) {
      c.strokeStyle = arcCols[i];
      c.beginPath();
      c.arc(0, r * 0.55, r * (1 - i * 0.24), Math.PI, Math.PI * 2);
      c.stroke();
    }
  } else {
    // 6 风车高地:四叶小风车
    c.fillStyle = "#F2B4C6";
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI * i) / 2;
      c.beginPath();
      c.ellipse(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.5, r * 0.22, a, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#FFF6EC";
    c.beginPath();
    c.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
