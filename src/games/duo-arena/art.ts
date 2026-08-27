/**
 * 朵星擂台 · 1.3 视觉资产库(纯 Canvas 矢量,零位图、零 emoji 字符)。
 *
 * 三条约定:
 *  1. 朵朵、星星、金币是全产品通用件(视觉宪法第三、四节)。共享套件 `src/art/kit/`
 *     建成后,这里的 `drawDuoFlower` / `drawFacetStar` / `drawKitCoin` 应整体上移;
 *     目前 kit 尚未建立,先在本目录实现,函数签名一律保持 `(ctx, x, y, r, opts)`,
 *     搬家时只改 import 路径 —— **待上移**。
 *  2. 这里只画不算:半径、判定、时长全部由调用方传入,不含任何玩法数值。
 *  3. `reduceMotion` 为 true 时,一切随时间演出(公转星 / 火花闪烁 / 盾面旋转)
 *     退化为静止摆放,同一组参数画出的调用序列必须逐帧一致。
 */

import { type Stage, boundaryHalfWidth } from "./stages";

type Ctx = CanvasRenderingContext2D;

/* ---------------- 调色板 ---------------- */

/** 本款视觉的全部主色(单测里逐个验 #rrggbb 合法性与 A/B 主色差) */
export const ART = {
  /** 朵朵:后层深粉花瓣 */
  duoBack: "#F27BA8",
  /** 朵朵:前层亮粉花瓣(A 角主色) */
  duoFront: "#FF9EC4",
  /** 朵朵:花瓣瓣尖提亮色 */
  duoTip: "#FFD3E4",
  /** 花芯:深金环 */
  coreRing: "#E8B84B",
  /** 花芯:亮黄底 */
  coreFill: "#FFE58A",
  /** 花芯:花蕊点 */
  stamen: "#D9913F",
  /** 暖白描边(粉色场地上把角色衬出来) */
  warmWhite: "#FFF6EC",
  /** 星星:亮金切面(B 角主色) */
  starLight: "#FFD86B",
  /** 星星:深金切面 */
  starDark: "#E8A93C",
  /** 星星:外描边 */
  starEdge: "#B87A18",
  /** 五官墨色 */
  ink: "#4A4266",
  /** 金币:侧面厚度 */
  coinEdge: "#C9881B",
  /** 金币:高光金 */
  coinLight: "#FFEFA8",
  /** 金币:主体金 */
  coinMid: "#FFD96A",
  /** 金币:暗部金 */
  coinDeep: "#E8A93C",
  /** 迷糊泡(炸弹):主体紫 */
  bombBody: "#5A4A80",
  /** 迷糊泡:暗部紫黑 */
  bombDeep: "#3A2E58",
  /** 礼盒:盒身 */
  giftBox: "#FFA7C4",
  /** 礼盒:盒盖 */
  giftLid: "#FF7FA8",
  /** 礼盒:缎带 */
  giftRibbon: "#FFF3B0",
} as const;

/** 朵朵腮红(粉) / 星星腮红(橙):A/B 双通道之一 */
export const BLUSH = {
  duo: "rgba(255,140,170,.45)",
  star: "rgba(255,180,90,.45)",
} as const;

/* ---------------- 颜色小工具 ---------------- */

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** 把 #rrggbb 往白(amt > 0)或黑(amt < 0)方向调,amt 取 -1..1 */
export function shadeHex(hex: string, amt: number): string {
  const { r, g, b } = hexToRgb(hex);
  const to = amt >= 0 ? 255 : 0;
  const k = Math.min(1, Math.abs(amt));
  const mix = (c: number): number => Math.round(c + (to - c) * k);
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, "0").toUpperCase()}`;
}

/** #rrggbb → rgba(r,g,b,a) */
export function hexAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 手写圆角矩形路径(不依赖 ctx.roundRect,老 WebView 也能跑) */
export function pathRoundRect(ctx: Ctx, x: number, y: number, w: number, h: number, rad: number): void {
  const r = Math.max(0, Math.min(rad, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ---------------- 双主角:朵朵(花)与星星(切面星) ---------------- */

/**
 * 朵朵 —— 双层错位花瓣 + 三层花芯。
 * 后层深粉旋开 30° 配暖白描边,前层亮粉每瓣从瓣根到瓣尖渐变提亮;
 * 花芯深金环 → 亮黄底 → 顶上三粒花蕊点(避开脸的位置)。
 * 【通用件,待上移 src/art/kit/】
 */
export function drawDuoFlower(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  // 后层:深粉花瓣,整体暖白描边保证在粉色场地上可读
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * i) / 6 + Math.PI / 6);
    ctx.beginPath();
    ctx.ellipse(r * 0.66, 0, r * 0.46, r * 0.32, 0, 0, Math.PI * 2);
    ctx.strokeStyle = ART.warmWhite;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = ART.duoBack;
    ctx.fill();
    ctx.restore();
  }
  // 前层:亮粉花瓣,瓣根到瓣尖渐变提亮
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * i) / 6);
    const grad = ctx.createLinearGradient(r * 0.15, 0, r * 1.1, 0);
    grad.addColorStop(0, ART.duoFront);
    grad.addColorStop(1, ART.duoTip);
    ctx.beginPath();
    ctx.ellipse(r * 0.6, 0, r * 0.45, r * 0.33, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  // 花芯三层:深金环 → 亮黄 → 花蕊点
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = ART.coreRing;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = ART.coreFill;
  ctx.fill();
  ctx.fillStyle = ART.stamen;
  for (const da of [-0.55, 0, 0.55]) {
    const a = -Math.PI / 2 + da;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.28, Math.sin(a) * r * 0.28, Math.max(0.8, r * 0.06), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 星星 —— 折纸切面五角星。
 * 十个三角切面亮金 / 深金交替形成立体感,外描边 2px,星尖一粒白高光。
 * 【通用件,待上移 src/art/kit/】
 */
export function drawFacetStar(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  const pts: Array<{ px: number; py: number }> = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.48;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    pts.push({ px: Math.cos(a) * rad, py: Math.sin(a) * rad });
  }
  // 十个切面三角,亮暗交替 —— 折纸立体感
  for (let i = 0; i < 10; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % 10];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(p.px, p.py);
    ctx.lineTo(q.px, q.py);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? ART.starLight : ART.starDark;
    ctx.fill();
  }
  // 外描边
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    if (i === 0) ctx.moveTo(pts[i].px, pts[i].py);
    else ctx.lineTo(pts[i].px, pts[i].py);
  }
  ctx.closePath();
  ctx.strokeStyle = ART.starEdge;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
  // 星尖高光
  ctx.beginPath();
  ctx.arc(pts[0].px * 0.7, pts[0].py * 0.7, Math.max(1, r * 0.1), 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.fill();
  ctx.restore();
}

/* ---------------- 脸:三层眼睛 + 腮红 + 查表嘴 + 螺旋眩晕 ---------------- */

export type FaceMood = "idle" | "grab" | "lead" | "dizzy";

export interface FaceOpts {
  who: "duo" | "star";
  mood?: FaceMood;
  /** 回合内时间(秒),给公转小星用 */
  t?: number;
  reduceMotion?: boolean;
}

/**
 * 双主角共用的脸。
 * 眼睛三层(白眼球 + 黑瞳 + 高光点),腮红按角色分粉 / 橙;
 * 嘴按状态查表:待机微笑弧 / 抓取张嘴 / 领先眯眼笑;
 * 眩晕是螺旋眼 + 头顶三颗小星公转(reduceMotion 时静止摆放),没有任何字符占位。
 */
export function drawMascotFace(ctx: Ctx, x: number, y: number, r: number, opts: FaceOpts): void {
  const mood = opts.mood ?? "idle";
  if (mood === "dizzy") {
    drawDizzyFace(ctx, x, y, r, opts.t ?? 0, opts.reduceMotion === true);
    return;
  }
  // 腮红:朵朵粉 / 星星橙(颜色 + 形状双通道里的颜色层)
  ctx.fillStyle = opts.who === "duo" ? BLUSH.duo : BLUSH.star;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + sx * r * 0.36, y + r * 0.16, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const eyeY = y - r * 0.08;
  if (mood === "lead") {
    // 领先眯眼笑:两道上弯的弧
    ctx.strokeStyle = ART.ink;
    ctx.lineWidth = Math.max(1.2, r * 0.09);
    ctx.lineCap = "round";
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + sx * r * 0.28, eyeY + r * 0.06, r * 0.13, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  } else {
    // 三层眼:白眼球 + 黑瞳 + 高光点
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + sx * r * 0.28, eyeY, r * 0.15, r * 0.17, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + sx * r * 0.28, eyeY + r * 0.02, Math.max(1, r * 0.095), 0, Math.PI * 2);
      ctx.fillStyle = ART.ink;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + sx * r * 0.28 - r * 0.035, eyeY - r * 0.035, Math.max(0.6, r * 0.04), 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
    }
  }
  // 嘴:查表
  if (mood === "grab") {
    // 抓取:使劲张嘴的小椭圆
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.24, r * 0.12, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#A8506B";
    ctx.fill();
  } else {
    // 待机 / 领先:微笑弧,领先笑得更开
    ctx.strokeStyle = "#E07A9A";
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x, y + r * 0.16, mood === "lead" ? r * 0.28 : r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
}

/** 眩晕脸:螺旋眼 + 头顶三颗小星绕圈公转(替代旧版 fillText("@ @")) */
function drawDizzyFace(ctx: Ctx, x: number, y: number, r: number, t: number, reduceMotion: boolean): void {
  ctx.strokeStyle = ART.ink;
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.lineCap = "round";
  for (const sx of [-1, 1]) {
    const ex = x + sx * r * 0.28;
    const ey = y - r * 0.06;
    // 两圈递增半径的弧拼出螺旋
    ctx.beginPath();
    ctx.arc(ex, ey, r * 0.055, 0, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex, ey, r * 0.11, Math.PI * 0.6, Math.PI * 2.1);
    ctx.stroke();
  }
  // 迷糊小嘴:一个歪歪的「o」
  ctx.beginPath();
  ctx.ellipse(x + r * 0.04, y + r * 0.24, r * 0.09, r * 0.11, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#A8506B";
  ctx.fill();
  // 头顶三颗小星公转;弱动效时静止摆放
  const base = reduceMotion ? 0.6 : t * 3.2;
  for (let i = 0; i < 3; i++) {
    const a = base + (Math.PI * 2 * i) / 3;
    drawMiniStar(
      ctx,
      x + Math.cos(a) * r * 1.15,
      y - r * 1.05 + Math.sin(a) * r * 0.28,
      Math.max(2, r * 0.2),
    );
  }
}

/** 小号五角星(眩晕圈、星光点缀通用) */
export function drawMiniStar(ctx: Ctx, x: number, y: number, r: number, color: string = ART.starLight): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/* ---------------- 收集物:金币 / 迷糊泡 / 礼盒 / 软气泡底 ---------------- */

/**
 * 金币 —— 全产品金币标准:侧面厚度 + 金渐变币面 + 深金内环 + 五角星压印 + 左上高光弧。
 * 【通用件,待上移 src/art/kit/】
 */
export function drawKitCoin(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  // 侧面厚度
  ctx.beginPath();
  ctx.arc(x, y + r * 0.1, r, 0, Math.PI * 2);
  ctx.fillStyle = ART.coinEdge;
  ctx.fill();
  // 币面:左上亮到右下深的金渐变
  const face = ctx.createRadialGradient(x - r * 0.35, y - r * 0.42, r * 0.12, x, y, r);
  face.addColorStop(0, ART.coinLight);
  face.addColorStop(0.55, ART.coinMid);
  face.addColorStop(1, ART.coinDeep);
  ctx.beginPath();
  ctx.arc(x, y - r * 0.04, r * 0.97, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();
  // 深金内环
  ctx.beginPath();
  ctx.arc(x, y - r * 0.04, r * 0.68, 0, Math.PI * 2);
  ctx.strokeStyle = hexAlpha(ART.coinEdge, 0.85);
  ctx.lineWidth = Math.max(1, r * 0.13);
  ctx.stroke();
  // 五角星压印
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = (i % 2 === 0 ? 0.46 : 0.2) * r;
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y - r * 0.04 + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = hexAlpha(ART.starEdge, 0.55);
  ctx.fill();
  // 左上高光弧
  ctx.beginPath();
  ctx.arc(x, y - r * 0.04, r * 0.78, Math.PI * 1.08, Math.PI * 1.48);
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

/**
 * 迷糊泡(踩到会转圈的那颗):紫黑圆体 + 麻绳引信 + 火花两帧闪烁 + 表面高光。
 * 表情画成呆萌款 —— 圆亮眼、小圆嘴,一点也不凶(分级红线)。
 */
export function drawBomb(ctx: Ctx, x: number, y: number, r: number, opts: { t?: number; reduceMotion?: boolean } = {}): void {
  const t = opts.t ?? 0;
  ctx.save();
  // 紫黑圆体:中心偏亮,有体积
  const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.15, x, y + r * 0.06, r);
  body.addColorStop(0, "#8A76B8");
  body.addColorStop(0.6, ART.bombBody);
  body.addColorStop(1, ART.bombDeep);
  ctx.beginPath();
  ctx.arc(x, y + r * 0.06, r * 0.94, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  // 麻绳引信
  ctx.beginPath();
  ctx.moveTo(x + r * 0.06, y - r * 0.78);
  ctx.quadraticCurveTo(x + r * 0.3, y - r * 1.22, x + r * 0.62, y - r * 1.08);
  ctx.strokeStyle = "#B8895A";
  ctx.lineWidth = Math.max(1.2, r * 0.16);
  ctx.lineCap = "round";
  ctx.stroke();
  // 火花:两帧闪烁,弱动效时恒定
  const flick = opts.reduceMotion ? 1 : Math.floor(t * 6) % 2 === 0 ? 1 : 0.6;
  drawSparkStar(ctx, x + r * 0.62, y - r * 1.08, r * 0.32 * flick, { color: ART.coreFill });
  // 表面高光
  ctx.beginPath();
  ctx.arc(x, y + r * 0.06, r * 0.72, Math.PI * 1.12, Math.PI * 1.45);
  ctx.strokeStyle = "rgba(255,255,255,.5)";
  ctx.lineWidth = Math.max(1, r * 0.13);
  ctx.lineCap = "round";
  ctx.stroke();
  // 呆萌脸:圆亮眼 + 小圆嘴
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + sx * r * 0.26, y - r * 0.02, r * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + sx * r * 0.26 + r * 0.03, y, Math.max(0.8, r * 0.07), 0, Math.PI * 2);
    ctx.fillStyle = ART.bombDeep;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y + r * 0.3, Math.max(1, r * 0.1), 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,.8)";
  ctx.lineWidth = Math.max(0.8, r * 0.06);
  ctx.stroke();
  ctx.restore();
}

/** 礼盒:双色盒身 + 缎带十字 + 蝴蝶结,底部压一阶暗色显体积 */
export function drawGift(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  const w = r * 1.7;
  const h = r * 1.5;
  const bx = x - w / 2;
  const by = y - h / 2 + r * 0.1;
  // 盒身
  pathRoundRect(ctx, bx + w * 0.05, by + h * 0.3, w * 0.9, h * 0.62, r * 0.14);
  ctx.fillStyle = ART.giftBox;
  ctx.fill();
  // 底部暗一阶
  pathRoundRect(ctx, bx + w * 0.05, by + h * 0.72, w * 0.9, h * 0.2, r * 0.1);
  ctx.fillStyle = "rgba(176,90,124,.35)";
  ctx.fill();
  // 盒盖(更宽一圈)
  pathRoundRect(ctx, bx, by + h * 0.12, w, h * 0.26, r * 0.12);
  ctx.fillStyle = ART.giftLid;
  ctx.fill();
  // 缎带十字
  ctx.fillStyle = ART.giftRibbon;
  ctx.fillRect(x - r * 0.14, by + h * 0.12, r * 0.28, h * 0.8);
  ctx.fillRect(bx + w * 0.05, by + h * 0.52, w * 0.9, r * 0.22);
  // 蝴蝶结:两瓣 + 中间结
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(x + sx * r * 0.3, by + h * 0.02);
    ctx.rotate(sx * 0.45);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.27, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fillStyle = ART.giftRibbon;
    ctx.fill();
    ctx.strokeStyle = "rgba(217,169,75,.7)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(x, by + h * 0.05, Math.max(1.2, r * 0.11), 0, Math.PI * 2);
  ctx.fillStyle = shadeHex(ART.giftRibbon, -0.12);
  ctx.fill();
  ctx.restore();
}

/** 目标底座 —— 软气泡:白到透明的径向渐变 + 顶部高光弧(不再是纯白圆) */
export function drawTargetBubble(ctx: Ctx, x: number, y: number, r: number): void {
  const g = ctx.createRadialGradient(x, y - r * 0.15, r * 0.2, x, y, r);
  g.addColorStop(0, "rgba(255,255,255,.95)");
  g.addColorStop(0.75, "rgba(255,255,255,.72)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, Math.PI * 1.15, Math.PI * 1.5);
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.lineCap = "round";
  ctx.stroke();
}

/** 四芒星徽章(双倍星光挂头顶那颗,也当星屑粒子用) */
export function drawSparkStar(ctx: Ctx, x: number, y: number, r: number, opts: { color?: string } = {}): void {
  ctx.save();
  ctx.translate(x, y);
  const inner = r * 0.22;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(inner, -inner, r, 0);
  ctx.quadraticCurveTo(inner, inner, 0, r);
  ctx.quadraticCurveTo(-inner, inner, -r, 0);
  ctx.quadraticCurveTo(-inner, -inner, 0, -r);
  ctx.closePath();
  ctx.fillStyle = opts.color ?? ART.coreFill;
  ctx.fill();
  ctx.strokeStyle = hexAlpha(ART.starDark, 0.8);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(0.6, r * 0.16), 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.95)";
  ctx.fill();
  ctx.restore();
}

/* ---------------- 状态特效:冰晶罩 / 六边形护盾 ---------------- */

/** 冰冻:浅蓝径向渐变冰罩 + 三根冰锥 + 两粒闪点(替代旧版纯色圆罩) */
export function drawIceShell(ctx: Ctx, x: number, y: number, r: number): void {
  const g = ctx.createRadialGradient(x, y - r * 0.2, r * 0.2, x, y, r);
  g.addColorStop(0, "rgba(220,245,255,.66)");
  g.addColorStop(1, "rgba(150,215,255,.30)");
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(170,225,255,.9)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 三根冰锥从罩顶探出来
  ctx.fillStyle = "rgba(205,240,255,.9)";
  for (const [dx, hgt] of [
    [-0.42, 0.45],
    [0, 0.68],
    [0.4, 0.4],
  ] as const) {
    const cx = x + dx * r;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.14, y - r * 0.6);
    ctx.lineTo(cx + r * 0.14, y - r * 0.6);
    ctx.lineTo(cx, y - r * (0.6 + hgt));
    ctx.closePath();
    ctx.fill();
  }
  // 两粒闪点
  drawSparkStar(ctx, x - r * 0.5, y + r * 0.3, Math.max(1.5, r * 0.16), { color: "#FFFFFF" });
  drawSparkStar(ctx, x + r * 0.55, y - r * 0.12, Math.max(1.2, r * 0.13), { color: "#FFFFFF" });
}

/** 护盾泡:六边形微光盾面 + 亮边 + 顶部微光(替代旧版单线圈) */
export function drawShieldHex(ctx: Ctx, x: number, y: number, r: number, opts: { t?: number; reduceMotion?: boolean } = {}): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(opts.reduceMotion ? 0 : (opts.t ?? 0) * 0.6);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(120,200,255,.25)";
  ctx.fill();
  ctx.strokeStyle = "rgba(150,225,255,.95)";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, Math.PI * 1.15, Math.PI * 1.5);
  ctx.strokeStyle = "rgba(255,255,255,.7)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

/* ---------------- HUD:技能图标(替代 spec.emoji) ---------------- */

/** 技能徽章里的绘制图标:加速三道风线 / 护盾小泡 / 弹开波螺旋 */
export function drawSkillIcon(ctx: Ctx, x: number, y: number, r: number, id: "dash" | "shield" | "wave"): void {
  ctx.save();
  ctx.lineCap = "round";
  if (id === "dash") {
    ctx.strokeStyle = "#5A8AD8";
    ctx.lineWidth = Math.max(1.2, r * 0.28);
    for (let i = 0; i < 3; i++) {
      const ly = y + (i - 1) * r * 0.6;
      const len = r * (1.7 - i * 0.4);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.85, ly);
      ctx.lineTo(x - r * 0.85 + len, ly);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x + r * 0.55, y - r * 0.45, r * 0.32, 0, Math.PI * 1.5);
    ctx.stroke();
  } else if (id === "shield") {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(120,200,255,.35)";
    ctx.fill();
    ctx.strokeStyle = "#4A90D9";
    ctx.lineWidth = Math.max(1.2, r * 0.22);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, Math.PI * 1.1, Math.PI * 1.5);
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#8A5AA8";
    ctx.lineWidth = Math.max(1.2, r * 0.24);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.35, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.75, Math.PI, Math.PI * 2.4);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------- 场地:果冻垫与主题地面 ---------------- */

/** 地块 —— 果冻软垫:场地主色加深 + 顶部高光条 + 底部缝线;会滑的垫子两侧加速度线 */
export function drawJellyPad(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { tint: string; sway?: boolean },
): void {
  const base = shadeHex(opts.tint, -0.15);
  const rad = Math.min(8, w / 2, h / 2);
  // 垫身
  pathRoundRect(ctx, x, y, w, h, rad);
  ctx.fillStyle = hexAlpha(base, 0.92);
  ctx.fill();
  ctx.strokeStyle = hexAlpha(shadeHex(opts.tint, -0.38), 0.65);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.save();
  pathRoundRect(ctx, x, y, w, h, rad);
  ctx.clip();
  // 顶部 30% 高光条
  pathRoundRect(ctx, x + 1.5, y + 1.5, w - 3, Math.max(2, h * 0.3), rad * 0.8);
  ctx.fillStyle = "rgba(255,255,255,.42)";
  ctx.fill();
  // 底部缝线
  ctx.beginPath();
  ctx.moveTo(x + rad * 0.8, y + h - 2.5);
  ctx.lineTo(x + w - rad * 0.8, y + h - 2.5);
  ctx.strokeStyle = hexAlpha(shadeHex(opts.tint, -0.5), 0.7);
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // 会滑的垫子:左右两侧速度线,提示它会动
  if (opts.sway) {
    ctx.strokeStyle = hexAlpha(shadeHex(opts.tint, -0.45), 0.55);
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    const len = Math.max(4, w * 0.14);
    for (const side of [-1, 1] as const) {
      const sx = side < 0 ? x - 4 : x + w + 4;
      for (let i = 0; i < 2; i++) {
        const ly = y + h * (0.35 + i * 0.3);
        ctx.beginPath();
        ctx.moveTo(sx, ly);
        ctx.lineTo(sx + side * len, ly);
        ctx.stroke();
      }
    }
  }
}

/** 沿边界描一圈路径(与 stages.boundaryHalfWidth 完全一致,只描不算) */
function traceBoundary(ctx: Ctx, stage: Stage, w: number, h: number): void {
  const steps = 26;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const ny = i / steps;
    const half = boundaryHalfWidth(stage, ny);
    if (i === 0) ctx.moveTo((0.5 - half) * w, ny * h);
    else ctx.lineTo((0.5 - half) * w, ny * h);
  }
  for (let i = steps; i >= 0; i--) {
    const ny = i / steps;
    const half = boundaryHalfWidth(stage, ny);
    ctx.lineTo((0.5 + half) * w, ny * h);
  }
  ctx.closePath();
}

/** 微型小花(花田地面点缀) */
export function drawMicroFlower(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = hexAlpha(color, 0.75);
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = hexAlpha(ART.coreFill, 0.9);
  ctx.fill();
}

/** 圆糖(糖果沙漏角落点缀):糖身 + 螺旋纹 + 高光点 */
function drawCandy(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,217,232,.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(232,160,184,.9)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.5, 0, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, Math.max(0.8, r * 0.2), 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.fill();
}

/** 每张场地各自的地面装饰(已被调用方裁进边界内) */
function drawGroundDecor(ctx: Ctx, stage: Stage, w: number, h: number): void {
  if (stage.id === "cloud-square") {
    // 云台广场:三朵扁云剪影
    ctx.fillStyle = "rgba(255,255,255,.6)";
    for (const c of [
      { x: 0.2, y: 0.24, s: 1 },
      { x: 0.74, y: 0.4, s: 0.8 },
      { x: 0.38, y: 0.74, s: 1.15 },
    ]) {
      const cx = c.x * w;
      const cy = c.y * h;
      const s = c.s * w * 0.05;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 1.6, s * 0.62, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - s, cy + s * 0.18, s * 0.9, s * 0.5, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + s, cy + s * 0.2, s * 0.95, s * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (stage.id === "flower-isle") {
    // 花田小岛:撒七粒微型花点
    const spots: ReadonlyArray<readonly [number, number]> = [
      [0.3, 0.2],
      [0.62, 0.16],
      [0.8, 0.5],
      [0.62, 0.82],
      [0.3, 0.78],
      [0.16, 0.5],
      [0.5, 0.55],
    ];
    for (let i = 0; i < spots.length; i++) {
      drawMicroFlower(ctx, spots[i][0] * w, spots[i][1] * h, Math.max(2.4, w * 0.01), i % 2 === 0 ? "#FF9EC4" : "#FFD86B");
    }
    return;
  }
  if (stage.id === "star-bridge") {
    // 星桥回廊:桥面木纹三条横线 + 淡星光点
    ctx.strokeStyle = "rgba(140,120,190,.22)";
    ctx.lineWidth = 2;
    for (const ny of [0.3, 0.52, 0.74]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.06, ny * h);
      ctx.lineTo(w * 0.94, ny * h);
      ctx.stroke();
    }
    const stars: ReadonlyArray<readonly [number, number]> = [
      [0.2, 0.18],
      [0.66, 0.24],
      [0.84, 0.62],
      [0.34, 0.66],
      [0.52, 0.42],
      [0.14, 0.84],
    ];
    ctx.save();
    ctx.globalAlpha = 0.4;
    for (const [nx, ny] of stars) drawSparkStar(ctx, nx * w, ny * h, Math.max(2.4, w * 0.012), { color: ART.starLight });
    ctx.restore();
    return;
  }
  // 糖果沙漏(及后续新场地兜底):斜向糖纹 + 两粒圆糖
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#FFB37E";
  for (let i = -1; i < 6; i++) {
    ctx.save();
    ctx.translate(i * w * 0.22, 0);
    ctx.rotate(0.55);
    ctx.fillRect(-8, -h * 0.4, 12, h * 1.9);
    ctx.restore();
  }
  ctx.restore();
  drawCandy(ctx, w * 0.16, h * 0.16, Math.max(4, w * 0.018));
  drawCandy(ctx, w * 0.84, h * 0.84, Math.max(4, w * 0.018));
}

/**
 * 整块擂台地面:主题渐变(上浅下深)+ 场内装饰 + 边界描边。
 * 云台广场配白绒边,花田小岛在圆边界上缀一圈小花瓣。
 * boundary 的几何完全来自 stages.boundaryHalfWidth,一个数都不改。
 */
export function drawStageGround(ctx: Ctx, stage: Stage, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shadeHex(stage.tint, 0.05));
  g.addColorStop(1, shadeHex(stage.tint, -0.07));
  traceBoundary(ctx, stage, w, h);
  ctx.fillStyle = g;
  ctx.fill();
  // 场内装饰裁在边界里画,不越界
  ctx.save();
  traceBoundary(ctx, stage, w, h);
  ctx.clip();
  drawGroundDecor(ctx, stage, w, h);
  ctx.restore();
  // 云台广场:白绒边打底
  if (stage.id === "cloud-square") {
    traceBoundary(ctx, stage, w, h);
    ctx.strokeStyle = "rgba(255,255,255,.8)";
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  traceBoundary(ctx, stage, w, h);
  ctx.strokeStyle = "rgba(150,140,200,.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  // 花田小岛:圆边界上缀一圈小花瓣
  if (stage.boundary === "round") {
    for (let k = 0; k < 14; k++) {
      const a = (Math.PI * 2 * k) / 14;
      ctx.save();
      ctx.translate(w * (0.5 + Math.cos(a) * 0.485), h * (0.5 + Math.sin(a) * 0.485));
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(3, w * 0.014), Math.max(1.8, w * 0.008), 0, 0, Math.PI * 2);
      ctx.fillStyle = k % 2 === 0 ? "#FFC9DE" : "#FFF0B8";
      ctx.fill();
      ctx.restore();
    }
  }
}
