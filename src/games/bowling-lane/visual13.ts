/**
 * 保龄球小馆 · 1.3 视觉模块(只管画,不碰玩法)。
 *
 * 这里住着三样东西:
 *   1. 配色板(规格 4.3 表逐 token 落死)与动效时序表 —— 测试逐个对表;
 *   2. 纯函数相位:木板缝位置与浓淡、倒瓶旋转(250ms easeInQuad + 弹跳一次)、
 *      指孔公转(**沿用旧白点相位 y/3**)、霓虹呼吸、全中灯箱闪 ——
 *      全部「输入进、数值出」,不持有状态;
 *   3. 矢量绘制:两段贝塞尔「细颈宽肩」瓶剪影 + 双红颈环、特殊瓶彩绘徽章
 *      (盾牌 / 雪花 / 弹簧 / 气球,替掉 emoji)、球体三停渐变 + 三指孔、
 *      瓶台灯箱、天花板垂灯、星星。
 *
 * 玩法红线:`scoring.ts` 计分、`laneProject` 投影数学、球瓶碰撞、
 * `PIN_R` / `BALL_R` / `pinSpot` 一个数都不动,本模块只 import 只读。
 */

import { shade, withAlpha } from "../../art/kit/palette";
import { OUTLINE_DARKEN } from "../../art/kit/outline";
import { ballGradient } from "../../art/kit/volume";
import { LANE_LEN, LANE_W, laneProject, type LaneView, type PinKind } from "./logic";

// ---------------------------------------------------------------------------
// 4.3 配色板(token 一个不许飘)
// ---------------------------------------------------------------------------

export const BL_COLORS = {
  /** 相邻木板双色 */
  blWoodA: "#F7E6C8",
  blWoodB: "#EDD6B0",
  /** 木板缝(远端透明度 ×0.5) */
  blSeam: "rgba(160,120,70,.35)",
  /** 沟槽底色 */
  blGutter: "#D8C3A5",
  /** 沟槽内壁 = 深 22% */
  blGutterWall: shade("#D8C3A5", -22),
  /** 油区镜面高光带 */
  blOil: "rgba(255,255,255,.28)",
  /** 瓶身 */
  blPin: "#FFFFFF",
  /** 双红颈环 */
  blPinRing: "#E85D75",
  /** 瓶台灯箱暖光 */
  blGlow: "#FFE2B8",
  /** 两侧霓虹装饰线 */
  blNeonPink: "#FF9FBE",
  blNeonBlue: "#9FD0FF",
} as const;

/** 星星招牌 / 彩纸的金 */
export const BL_GOLD = "#FFD166";

// ---------------------------------------------------------------------------
// C-2 粉彩夜场(B 档 R2 一致性排名 3 · 方案 A):暗底提暖一档。
// 暗底 #3b3556 曾是全窗唯一大面积低明度色 ——「灰紫夜场」不是「粉彩夜场」。
// 修法是调参不加料:整屏先提亮 6%(白色覆盖层,数学上与 shade("#3b3556",+6)
// 逐通道相等),再叠 4% 粉紫 tint 把色温往粉彩家族拉;两道覆盖层压在暗底与
// 邻道剪影之间,主道 / 灯箱随后原样压顶 —— 亮度预算仍只留给球道与灯箱。
// ---------------------------------------------------------------------------

/** 暗底提亮档:往白混 6%(等价 shade(+6)) */
export const BL_HALL_LIFT_ALPHA = 0.06;
/** 粉紫 tint 色:粉彩家族的暖紫(不用字母、不拼品牌色带) */
export const BL_HALL_TINT = "#E3A9E0";
/** 粉紫 tint 浓度:4%,只调色温不抢对比 */
export const BL_HALL_TINT_ALPHA = 0.04;

// ---------------------------------------------------------------------------
// 动效时序表(毫秒写死,测试引用)
// ---------------------------------------------------------------------------

/** 倒瓶旋转:250ms easeInQuad 倒下 + 弹跳一次;reduced 直接躺平 */
export const PIN_FALL_MS = 250;
export const PIN_BOUNCE_MS = 140;
/** 油区倒影拉丝:200ms 渐隐(linear);reduced 不生成 */
export const OIL_STREAK_MS = 200;
/** 霓虹呼吸:2400ms 一个 sin 周期;reduced 常亮 */
export const NEON_MS = 2400;
/** 全中灯箱闪:3 次 × 160ms(step);reduced 1 次长亮 */
export const STRIKE_FLASH_TIMES = 3;
export const STRIKE_FLASH_MS = 160;
/** 跟球运镜参数:与 1.2 完全一致,只读断言用 */
export const FOLLOW_ZOOM = 0.14;
export const FOLLOW_IN_MS = 260;
export const FOLLOW_OUT_MS = 200;
/** 指孔公转:半径 / 孔径沿用旧白点的 0.42r / 0.16r */
export const HOLE_ORBIT = 0.42;
export const HOLE_R = 0.16;

// ---------------------------------------------------------------------------
// 木板缝:沿 laneProject 会聚(几何由调用方投影,这里只给俯视 x)
// ---------------------------------------------------------------------------

/** 木板缝条数(规格 6–8 条) */
export const SEAM_COUNT = 7;
/** 远端透明度缩到近端的一半 */
export const SEAM_FAR_ALPHA = 0.5;
/** 近端缝的透明度(与 blSeam 的 .35 同值) */
export const SEAM_NEAR_ALPHA = 0.35;

/** SEAM_COUNT 条缝的俯视 x:把内侧球道平均分成 SEAM_COUNT + 1 块板 */
export function seamXs(gutterW: number): number[] {
  const w = Math.max(0, LANE_W - gutterW * 2);
  const xs: number[] = [];
  for (let i = 1; i <= SEAM_COUNT; i++) xs.push(gutterW + (w * i) / (SEAM_COUNT + 1));
  return xs;
}

/** 纵深 t(0 近 → 1 远)处缝的透明度:远端 ×0.5 */
export function seamAlphaAt(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return SEAM_NEAR_ALPHA * (1 - (1 - SEAM_FAR_ALPHA) * k);
}

// ---------------------------------------------------------------------------
// 倒瓶旋转 / 指孔公转 / 霓虹 / 灯箱闪(纯函数相位)
// ---------------------------------------------------------------------------

export function easeInQuad(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return t * t;
}

/**
 * 被击后 sinceMs 毫秒时瓶身的倒伏角(0 站着 → π/2 躺平):
 * 250ms easeInQuad 倒下,接着 140ms 里弹跳一次再躺定。reduced 直接躺平。
 */
export function pinFallAngle(sinceMs: number, reduced: boolean): number {
  if (reduced) return Math.PI / 2;
  const t = Math.max(0, sinceMs);
  if (t < PIN_FALL_MS) return easeInQuad(t / PIN_FALL_MS) * (Math.PI / 2);
  const bt = t - PIN_FALL_MS;
  if (bt < PIN_BOUNCE_MS) return Math.PI / 2 - Math.sin((bt / PIN_BOUNCE_MS) * Math.PI) * 0.14;
  return Math.PI / 2;
}

/** 倒下方向沿受击矢量:取横向速度分量的符号(0 当作往右) */
export function pinFallDir(vx: number): 1 | -1 {
  return Number.isFinite(vx) && vx < 0 ? -1 : 1;
}

/**
 * 第 index 个指孔此刻的公转角:相位**沿用旧白点** —— `travelY / 3`,
 * 三孔相隔 2π/3;calm(reduced)下白点原来就冻结,这里也冻结。
 */
export function fingerHoleAngle(travelY: number, index: number, calm: boolean): number {
  const spun = calm ? 0 : travelY / 3;
  return spun + (index * Math.PI * 2) / 3;
}

/** 霓虹呼吸的透明度系数(0.24..1,sin);reduced 常亮 1 */
export function neonAlpha(tMs: number, reduced: boolean): number {
  if (reduced) return 1;
  return 0.62 + 0.38 * Math.sin((Math.max(0, tMs) / NEON_MS) * Math.PI * 2);
}

/**
 * 全中后 sinceMs 毫秒时灯箱亮不亮:3 次 × 160ms 的亮灭方波;
 * reduced 改成一次长亮(同样总时长),闪烁不出现。
 */
export function strikeFlashOn(sinceMs: number, reduced: boolean): boolean {
  if (!Number.isFinite(sinceMs) || sinceMs < 0) return false;
  const total = STRIKE_FLASH_TIMES * STRIKE_FLASH_MS * 2;
  if (sinceMs >= total) return false;
  if (reduced) return true;
  return Math.floor(sinceMs / STRIKE_FLASH_MS) % 2 === 0;
}

// ---------------------------------------------------------------------------
// 瓶剪影:两段贝塞尔的「细颈宽肩」,关键比例落成常量
// ---------------------------------------------------------------------------

/** 剪影关键比例(相对总高 h,从瓶底往上量) */
export const PIN_SHAPE = {
  /** 肩(最宽处):宽 0.42h,位于 0.62h */
  shoulderW: 0.42,
  shoulderY: 0.62,
  /** 颈(最细处):宽 0.16h,位于 0.82h */
  neckW: 0.16,
  neckY: 0.82,
  /** 底宽 0.3h */
  baseW: 0.3,
  /** 双红颈环的高度 */
  ringYs: [0.78, 0.84] as const,
  /** 头部圆的半径与圆心高度 */
  headR: 0.1,
  headY: 0.9,
} as const;

/**
 * 在当前变换下画一只瓶剪影路径:原点在瓶底中心,+y 朝下(canvas 惯例),
 * 瓶身往 -y 长。只建路径不填色,填色 / 描边由调用方决定。
 */
export function tracePin(g: CanvasRenderingContext2D, h: number): void {
  const sw = (PIN_SHAPE.shoulderW / 2) * h;
  const sy = -PIN_SHAPE.shoulderY * h;
  const nw = (PIN_SHAPE.neckW / 2) * h;
  const ny = -PIN_SHAPE.neckY * h;
  const bw = (PIN_SHAPE.baseW / 2) * h;
  const hr = PIN_SHAPE.headR * h;
  const hy = -PIN_SHAPE.headY * h;
  g.beginPath();
  g.moveTo(-bw, 0);
  // 左侧第一段:底 → 肚(肩)
  g.bezierCurveTo(-bw * 1.55, -0.2 * h, -sw * 1.16, -0.42 * h, -sw, sy);
  // 左侧第二段:肩 → 颈
  g.bezierCurveTo(-sw * 0.8, -0.72 * h, -nw * 1.4, -0.78 * h, -nw, ny);
  // 圆头:从颈过头顶绕到右颈
  g.arc(0, hy, hr, Math.PI * 0.75, Math.PI * 0.25, false);
  // 右侧镜像:颈 → 肩 → 底
  g.bezierCurveTo(nw * 1.4, -0.78 * h, sw * 0.8, -0.72 * h, sw, sy);
  g.bezierCurveTo(sw * 1.16, -0.42 * h, bw * 1.55, -0.2 * h, bw, 0);
  g.closePath();
}

/** 特殊瓶的彩绘徽章(替掉 emoji):盾牌 / 雪花 / 弹簧 / 气球,自绘小图案 */
export function drawPinBadge(g: CanvasRenderingContext2D, kind: PinKind, x: number, y: number, s: number): void {
  if (!(s > 0) || kind === "wood") return;
  g.save();
  g.translate(x, y);
  g.lineCap = "round";
  if (kind === "iron") {
    // 小盾牌:稳重的铁灰
    g.fillStyle = "#8F9BB0";
    g.beginPath();
    g.moveTo(-s * 0.7, -s * 0.55);
    g.lineTo(s * 0.7, -s * 0.55);
    g.lineTo(s * 0.62, s * 0.2);
    g.quadraticCurveTo(s * 0.3, s * 0.7, 0, s * 0.9);
    g.quadraticCurveTo(-s * 0.3, s * 0.7, -s * 0.62, s * 0.2);
    g.closePath();
    g.fill();
    g.strokeStyle = shade("#8F9BB0", OUTLINE_DARKEN);
    g.lineWidth = s * 0.16;
    g.stroke();
  } else if (kind === "ice") {
    // 雪花:三根交叉线 + 端点
    g.strokeStyle = "#7FB2F0";
    g.lineWidth = s * 0.2;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI;
      g.beginPath();
      g.moveTo(Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.85);
      g.lineTo(-Math.cos(a) * s * 0.85, -Math.sin(a) * s * 0.85);
      g.stroke();
    }
    g.fillStyle = "#7FB2F0";
    g.beginPath();
    g.arc(0, 0, s * 0.22, 0, Math.PI * 2);
    g.fill();
  } else if (kind === "spring") {
    // 弹簧:三圈横向折线
    g.strokeStyle = "#4C9D86";
    g.lineWidth = s * 0.22;
    g.beginPath();
    g.moveTo(-s * 0.7, -s * 0.6);
    for (let k = 0; k < 3; k++) {
      const yy = -s * 0.6 + ((k + 0.5) * s * 1.2) / 3;
      g.lineTo(s * 0.7, yy);
      g.lineTo(-s * 0.7, yy + (s * 0.6) / 3);
    }
    g.stroke();
  } else {
    // 气球:小圆 + 结 + 线
    g.fillStyle = "#FF9FBE";
    g.beginPath();
    g.ellipse(0, -s * 0.25, s * 0.55, s * 0.65, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = shade("#FF9FBE", OUTLINE_DARKEN);
    g.lineWidth = s * 0.12;
    g.stroke();
    g.beginPath();
    g.moveTo(0, s * 0.42);
    g.quadraticCurveTo(s * 0.2, s * 0.66, 0, s * 0.9);
    g.stroke();
  }
  g.restore();
}

export interface PinArt {
  /** 瓶底中心(画布坐标) */
  sx: number;
  sy: number;
  /** 瓶总高(画布像素) */
  h: number;
  kind: PinKind;
  /** 倒伏角 0..π/2(pinFallAngle 的返回值);0 = 站着 */
  fall?: number;
  /** 倒下方向 ±1 */
  dir?: 1 | -1;
  alpha?: number;
}

/**
 * 画一只保龄瓶:细颈宽肩剪影 + 双红颈环 + 左上高光条 + 脚下落影;
 * fall > 0 时整瓶绕瓶底支点旋转(倒瓶动画),躺平后压一点透明度。
 */
export function drawPin(g: CanvasRenderingContext2D, art: PinArt): void {
  const { sx, sy, h, kind } = art;
  if (!(h > 0) || !Number.isFinite(sx) || !Number.isFinite(sy)) return;
  const fall = Math.max(0, Math.min(Math.PI / 2, art.fall ?? 0));
  g.save();
  g.globalAlpha = art.alpha ?? 1;
  // 脚下落影(倒下过程中影子跟着变长一点)
  g.fillStyle = "rgba(90,74,102,.16)";
  g.beginPath();
  g.ellipse(sx + h * 0.05, sy + h * 0.03, h * (0.2 + fall * 0.12), h * 0.08, 0, 0, Math.PI * 2);
  g.fill();
  g.translate(sx, sy);
  if (fall > 0) g.rotate((art.dir ?? 1) * fall);
  // 瓶身
  tracePin(g, h);
  g.fillStyle = BL_COLORS.blPin;
  g.fill();
  g.strokeStyle = shade("#F0D9E0", OUTLINE_DARKEN);
  g.lineWidth = Math.max(0.8, h * 0.045);
  g.stroke();
  // 双红颈环(0.78h / 0.84h)
  g.strokeStyle = BL_COLORS.blPinRing;
  g.lineWidth = Math.max(0.7, h * 0.05);
  for (const ry of PIN_SHAPE.ringYs) {
    // 环处的半宽:接近颈宽,略放大一点包住剪影
    const half = (PIN_SHAPE.neckW / 2) * h * 1.35;
    g.beginPath();
    g.moveTo(-half, -ry * h);
    g.lineTo(half, -ry * h);
    g.stroke();
  }
  // 左上高光条(光源左上 45°)
  g.strokeStyle = withAlpha("#FFFFFF", 0.75);
  g.lineCap = "round";
  g.lineWidth = Math.max(0.7, h * 0.05);
  g.beginPath();
  g.moveTo(-h * 0.1, -h * 0.3);
  g.quadraticCurveTo(-h * 0.15, -h * 0.5, -h * 0.07, -h * 0.68);
  g.stroke();
  // 特殊瓶徽章画在肚子上
  drawPinBadge(g, kind, 0, -h * 0.42, h * 0.16);
  g.restore();
}

// ---------------------------------------------------------------------------
// 球 / 灯箱 / 垂灯 / 星星
// ---------------------------------------------------------------------------

/** 四角小星(招牌 / 彩纸用) */
export function drawStar(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rot = 0): void {
  if (!(r > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, -r);
  g.lineTo(r * 0.3, 0);
  g.lineTo(0, r);
  g.lineTo(-r * 0.3, 0);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(-r, 0);
  g.lineTo(0, r * 0.3);
  g.lineTo(r, 0);
  g.lineTo(0, -r * 0.3);
  g.closePath();
  g.fill();
  g.restore();
}

/**
 * 保龄球:三停径向渐变(高光左上)+ 三指孔(相位 = fingerHoleAngle,
 * 替代旧白点,公转半径 / 孔径与旧白点一致)。
 */
export function drawBall(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  travelY: number,
  calm: boolean
): void {
  if (!(r > 0)) return;
  g.save();
  g.fillStyle = ballGradient(g, x, y, r, color);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = shade(color, OUTLINE_DARKEN);
  g.lineWidth = Math.max(0.8, r * 0.09);
  g.stroke();
  // 三指孔:沿用旧白点相位公转 —— 这是「球在转」的功能表达
  g.fillStyle = shade(color, -46);
  for (let i = 0; i < 3; i++) {
    const a = fingerHoleAngle(travelY, i, calm);
    g.beginPath();
    g.arc(x + Math.cos(a) * r * HOLE_ORBIT, y + Math.sin(a) * r * HOLE_ORBIT, r * HOLE_R, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** 天花板垂灯:一盏暖光晕 + 灯罩 + 吊线 */
export function drawCeilingLamp(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  if (!(s > 0)) return;
  g.save();
  const halo = g.createRadialGradient(x, y, s * 0.1, x, y, s * 2.4);
  halo.addColorStop(0, withAlpha(BL_COLORS.blGlow, 0.5));
  halo.addColorStop(1, withAlpha(BL_COLORS.blGlow, 0));
  g.fillStyle = halo;
  g.beginPath();
  g.arc(x, y, s * 2.4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = withAlpha("#6B6478", 0.6);
  g.lineWidth = s * 0.1;
  g.beginPath();
  g.moveTo(x, y - s * 2.2);
  g.lineTo(x, y - s * 0.55);
  g.stroke();
  g.fillStyle = "#F2A9C6";
  g.beginPath();
  g.moveTo(x - s * 0.7, y - s * 0.1);
  g.lineTo(x + s * 0.7, y - s * 0.1);
  g.lineTo(x + s * 0.34, y - s * 0.62);
  g.lineTo(x - s * 0.34, y - s * 0.62);
  g.closePath();
  g.fill();
  g.fillStyle = BL_COLORS.blGlow;
  g.beginPath();
  g.arc(x, y, s * 0.32, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// ---------------------------------------------------------------------------
// 邻道暗剪影(修复员装饰件:馆内两侧不再是一笔平涂)
// ---------------------------------------------------------------------------

/** 邻道剪影填色:比主道木色深 8%(剪影一色,不铺木纹不抢主道) */
export const BL_NEIGHBOR_WOOD = shade(BL_COLORS.blWoodA, -8);
/** 邻道与主道之间留出的暗色分隔带(俯视宽,LANE_W 的比例)——暗场层还在 */
export const BL_NEIGHBOR_GAP = 0.18;
/** 馆内立柱竖线透明度(learner 规格:≤ 0.25) */
export const BL_PILLAR_ALPHA = 0.22;

/**
 * 两侧邻道暗剪影 + 馆内立柱竖线。
 * 梯形四角全部走 `laneProject`(只读),与主道同一套透视会聚;
 * 近端探出画布、远端收进上方两角 ——「邻道只在远处看得见」。
 * 每侧 2 根立柱竖线只落在上半屏两侧,alpha 0.22 压灰。
 * 纯静态件:调用方必须画在跟球运镜 save/scale 之前,reduced 无关。
 */
export function drawNeighborLanes(g: CanvasRenderingContext2D, view: LaneView): void {
  const gap = LANE_W * BL_NEIGHBOR_GAP;
  for (const side of [-1, 1] as const) {
    const xNear = side === -1 ? -gap : LANE_W + gap;
    const xFar = side === -1 ? -gap - LANE_W : LANE_W + gap + LANE_W;
    const p0 = laneProject(xNear, 0, view);
    const p1 = laneProject(xNear, LANE_LEN, view);
    const p2 = laneProject(xFar, LANE_LEN, view);
    const p3 = laneProject(xFar, 0, view);
    g.fillStyle = BL_NEIGHBOR_WOOD;
    g.beginPath();
    g.moveTo(p0.sx, p0.sy);
    g.lineTo(p1.sx, p1.sy);
    g.lineTo(p2.sx, p2.sy);
    g.lineTo(p3.sx, p3.sy);
    g.closePath();
    g.fill();
    // 立柱竖线 ×2:给「馆」一点纵向结构,只到半屏高,不进球道区
    g.strokeStyle = withAlpha("#221D38", BL_PILLAR_ALPHA);
    g.lineWidth = 2.5;
    for (const fx of [0.06, 0.14]) {
      const px = side === -1 ? view.w * fx : view.w * (1 - fx);
      g.beginPath();
      g.moveTo(px, 0);
      g.lineTo(px, view.h * 0.46);
      g.stroke();
    }
  }
}
