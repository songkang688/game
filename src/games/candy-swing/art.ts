// 糖果秋千 · 1.3 视觉素材库（本款独占）。
// 只放「纯绘制/纯几何」的素材函数与调色板：不碰物理、不碰关卡数值、不碰胜负规则。
// 全部是确定性纯函数，art.test.ts 直接拿录音桩验证绘制序列。

/** 画布绘制的最小接口：真 CanvasRenderingContext2D 与测试录音桩都满足 */
export interface ArtGradient {
  addColorStop(offset: number, color: string): void;
}

export interface ArtCtx {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineJoin: unknown;
  globalAlpha: number;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  fill(): void;
  stroke(): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): ArtGradient;
  createRadialGradient(
    x0: number, y0: number, r0: number,
    x1: number, y1: number, r1: number
  ): ArtGradient;
}

/* ================= 调色板（全部 #rrggbb，契约测试盯格式与明暗关系） ================= */

/** 糖体径向渐变：左上亮 → 边缘深 */
export const CANDY_BODY_LIGHT = "#FFB1C9";
export const CANDY_BODY_DEEP = "#F76F9F";
/** 糖纸比糖体深一档，褶皱线再深一档 */
export const CANDY_WRAP = "#E8538F";
export const CANDY_WRAP_FOLD = "#C93D75";

/** 小怪物身体径向渐变：左上亮 → 右下深；内耳粉 */
export const MONSTER_LIGHT = "#D9BFF8";
export const MONSTER_DARK = "#B593E6";
export const MONSTER_EAR_INNER = "#EFC6E8";

/** 星星金渐变三层：中心亮黄 → 边缘深金 + 深金描边 */
export const STAR_CORE = "#FFE9A0";
export const STAR_EDGE = "#F0B429";
export const STAR_RIM = "#C9861B";

/** 传送门入口 / 出口配色必须可分辨（紫 vs 青） */
export const PORTAL_IN_COLOR = "#B06AF0";
export const PORTAL_OUT_COLOR = "#3FC3E8";

/** 入泡泡状态的彩虹泡膜分色 */
export const BUBBLE_RAINBOW = ["#FF9E9E", "#FFD27A", "#9DE58F", "#8FCBF0", "#C79DF5"] as const;

/** 中景层视差系数（本款无镜头，仅云层漂移打这个折） */
export const MID_PARALLAX = 0.15;

/** 结算三星逐颗点亮：每颗弹入用时（秒） */
export const RESULT_STAR_POP = 0.3;

/** 剪刀剪断后断口散丝的存活时长（秒） */
export const SNIP_FRAY_SEC = 0.3;

/* ================= 纯几何素材 ================= */

/**
 * 阿基米德螺线（糖果的真螺旋纹）：turns 圈、steps 段，半径从 0 匀速涨到 maxR。
 * 返回以糖心为原点的折线点列，点数 = steps + 1（契约要求 > 10）。
 */
export function candySpiralPoints(
  maxR: number,
  turns = 2.5,
  steps = 40
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const totalAng = Math.PI * 2 * turns;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = t * totalAng;
    const r = maxR * t;
    pts.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
  }
  return pts;
}

export interface FluffSeg {
  /** 本段落点（椭圆上） */
  x: number;
  y: number;
  /** 本段绒毛控制点（顶到椭圆外一点点） */
  cx: number;
  cy: number;
}

/**
 * 小怪物的绒毛轮廓：把 rx×ry 椭圆切成 bumps 段短弧，
 * 每段中点往外顶 9% 当二次曲线控制点，拼成一次 path 的微锯齿绒毛边。
 * 起笔点固定在 (rx, 0)。
 */
export function fluffOutline(rx: number, ry: number, bumps = 14): FluffSeg[] {
  const segs: FluffSeg[] = [];
  for (let i = 0; i < bumps; i++) {
    const a1 = (Math.PI * 2 * (i + 1)) / bumps;
    const mid = (Math.PI * 2 * (i + 0.5)) / bumps;
    segs.push({
      x: Math.cos(a1) * rx,
      y: Math.sin(a1) * ry,
      cx: Math.cos(mid) * rx * 1.09,
      cy: Math.sin(mid) * ry * 1.09,
    });
  }
  return segs;
}

/* ================= 小怪物三段演出的姿态表 ================= */

export interface MonsterPose {
  /** 身体离地弹跳量（正 = 往上） */
  bounce: number;
  /** 张嘴程度；null = 跟随实时的 mouthOpenAmount（追糖时用） */
  open: number | null;
  /** 圆眼追糖 / 眯眼笑 */
  eyes: "round" | "smile";
  /** 腮帮子半径（咀嚼时鼓一鼓） */
  cheek: number;
  /** 接住光环进度 0→1；null = 不画 */
  halo: number | null;
  /** 满足爱心进度 0→1；null = 不画 */
  heart: number | null;
}

/**
 * 1.2 三段进食演出的编排数值原样搬进来（catch / chew / happy 的公式一个没改），
 * drawMonster 只管照着姿态画。三段姿态互不相同是 art.test.ts 的契约。
 */
export function monsterPose(
  stage: "catch" | "chew" | "happy" | "",
  eatShowT: number,
  phaseTime: number
): MonsterPose {
  if (stage === "catch") {
    return {
      bounce: -4 * (1 - eatShowT / 0.22),
      open: 1,
      eyes: "round",
      cheek: 5,
      halo: Math.min(1, eatShowT / 0.22),
      heart: null,
    };
  }
  if (stage === "chew") {
    return {
      bounce: Math.sin(eatShowT * 34) * 3,
      open: 0.35 + Math.abs(Math.sin(eatShowT * 30)) * 0.4,
      eyes: "round",
      cheek: 5 + Math.abs(Math.sin(eatShowT * 30)) * 3,
      halo: null,
      heart: null,
    };
  }
  if (stage === "happy") {
    return {
      bounce: Math.abs(Math.sin(phaseTime * 8)) * 6,
      open: 0,
      eyes: "smile",
      cheek: 5,
      halo: null,
      heart: phaseTime < 1.2 ? phaseTime / 1.2 : null,
    };
  }
  return { bounce: 0, open: null, eyes: "round", cheek: 5, halo: null, heart: null };
}

/* ================= 纯绘制素材 ================= */

/** 十顶点五角星路径（不填色，调用方自己 fill / stroke） */
export function starPath(ctx: ArtCtx, x: number, y: number, r: number, rot = 0): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = rot - Math.PI / 2 + (Math.PI * i) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(ang) * rr;
    const py = y + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * 全产品标准的金星三层：金径向渐变 + 2px 深金描边 + 中心小高光星。
 */
export function drawGoldStar(ctx: ArtCtx, x: number, y: number, r: number, rot = 0): void {
  const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.15, x, y, r);
  g.addColorStop(0, STAR_CORE);
  g.addColorStop(1, STAR_EDGE);
  starPath(ctx, x, y, r, rot);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = STAR_RIM;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  starPath(ctx, x - r * 0.18, y - r * 0.22, r * 0.32, rot + 0.35);
  ctx.fill();
}

/**
 * 绘制的心形（替代 fillText("💜")）：两瓣贝塞尔 + 底尖，紫粉纵向渐变。
 * 本文件是 bezierCurveTo 的唯一用户——真机契约靠这一点认出爱心帧。
 */
export function drawHeart(ctx: ArtCtx, x: number, y: number, r: number): void {
  const g = ctx.createLinearGradient(x, y - r, x, y + r);
  g.addColorStop(0, "#D9A6F2");
  g.addColorStop(1, "#F26FA5");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.bezierCurveTo(x - r * 1.4, y + r * 0.2, x - r * 1.1, y - r, x, y - r * 0.25);
  ctx.bezierCurveTo(x + r * 1.1, y - r, x + r * 1.4, y + r * 0.2, x, y + r);
  ctx.closePath();
  ctx.fill();
}
