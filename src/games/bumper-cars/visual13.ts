/**
 * 碰碰车大乱斗 · 1.3 视觉模块(只管画,不碰玩法)。
 *
 * 这里住着三样东西:
 *   1. 配色板(规格 3.3 表逐 token 落死)与动效时序表 —— 测试逐个对表;
 *   2. 纯函数相位:squash 回弹、蓄力流光、灯串交替、集电杆摆旗、出局降落伞,
 *      全部「毫秒 + reduced 进、数值出」,不持有状态;
 *   3. 矢量绘制函数:碰碰车三层(橡胶圈 / 车壳 / 座舱司机)、集电杆小旗、
 *      肥皂渍 / 木纹滚筒 / 唱片转盘、灯柱灯泡、星星 —— 彻底替掉 emoji 素材。
 *
 * 玩法红线:推挤物理、`chargeRatio` 蓄力窗口、复活时序都在 `logic.ts`,
 * 本模块只 import 只读;`car.x / y / r` 一个字也不写回去。
 * 分级红线:碰撞永远是「弹开 + 星花」,出局是「降落伞飘回看台」,无损毁无伤害。
 */

import { PASTELS, shade, withAlpha } from "../../art/kit/palette";
import { OUTLINE_DARKEN } from "../../art/kit/outline";
import { ballGradient } from "../../art/kit/volume";
import { easeOutBack } from "../../art/kit/sparkle";
import { RESPAWN_MS } from "./logic";

// ---------------------------------------------------------------------------
// 3.3 配色板(token 一个不许飘)
// ---------------------------------------------------------------------------

export const BC_COLORS = {
  /** 场地地板 */
  bcFloor: "#F3E8F8",
  /** 围栏顶面 */
  bcRail: "#E5B8D0",
  /** 围栏立面 = shade(bcRail, -22) */
  bcRailSide: shade("#E5B8D0", -22),
  /** 融冰断面浅蓝 */
  bcIceEdge: "#CDEBFF",
  /** 防撞橡胶圈 */
  bcBumper: "#5A4A66",
  /** 朵朵车壳主色 */
  bcPink: "#F4859F",
  /** 星星车壳主色 */
  bcBlue: "#7FB2F0",
  /** 全场统一落影 */
  bcShadow: "rgba(90,74,102,.16)",
} as const;

/** 满蓄小旗 / 星星呆毛的金 */
export const BC_GOLD = "#FFD166";
/** 皮肤色(司机的头和手) */
export const BC_SKIN = "#FFE7D6";
/** 滚桶木色 */
export const BC_WOOD = "#D8B47E";

// ---------------------------------------------------------------------------
// 动效时序表(毫秒写死,测试引用)
// ---------------------------------------------------------------------------

/** 撞击 squash:压扁 12%、80ms easeOutBack 回弹;reduced 关闭 */
export const SQUASH_MS = 80;
export const SQUASH_AMOUNT = 0.12;
/** 灯串交替:900ms 一步(step 缓动);reduced 常亮 */
export const LAMP_MS = 900;
/** 蓄力流光跑道:高光点绕一圈的周期(linear);reduced 静态进度弧 */
export const FLOW_MS = 1100;
/** 加速带流光:箭头亮斑推进一趟的周期;reduced 静态 */
export const PAD_FLOW_MS = 700;
/** 出局降落伞时序 = 既有复活时序,一个毫秒都不另立 */
export const PARACHUTE_MS = RESPAWN_MS;
/** 接触点星花颗数 */
export const BUMP_STAR_COUNT = 4;
/** 星花寿命;reduced 只出 1 帧 */
export const BUMP_STAR_LIFE_MS = 300;
export const BUMP_STAR_LIFE_REDUCED_MS = 40;

// ---------------------------------------------------------------------------
// 纯函数相位
// ---------------------------------------------------------------------------

/**
 * 撞击后的压扁量(0..SQUASH_AMOUNT):t=0 压满 12%,80ms 内 easeOutBack 弹回,
 * 中段轻微过冲成「拉伸」,这就是回弹的那一下。reduced 恒 0。
 */
export function squashAmount(sinceHitMs: number, reduced: boolean): number {
  if (reduced || !Number.isFinite(sinceHitMs) || sinceHitMs < 0 || sinceHitMs >= SQUASH_MS) return 0;
  return SQUASH_AMOUNT * (1 - easeOutBack(sinceHitMs / SQUASH_MS));
}

/**
 * 蓄力流光跑道的进度弧:和 1.2 蓄力环**逐点一致**——
 * 起点 -π/2,终点 -π/2 + ratio × 2π。进度映射一个数都不动。
 */
export function chargeFlowArc(ratio: number): { from: number; to: number } {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return { from: -Math.PI / 2, to: -Math.PI / 2 + r * Math.PI * 2 };
}

/** 流光高光点的相位(0..2π,linear);reduced 冻结在 0 —— 弧还在,光不跑 */
export function flowPhase(tMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return ((Math.max(0, tMs) % FLOW_MS) / FLOW_MS) * Math.PI * 2;
}

/** 第 index 颗灯泡此刻亮不亮:900ms 走一步、奇偶交替;reduced 全部常亮 */
export function lampOn(index: number, tMs: number, reduced: boolean): boolean {
  if (reduced) return true;
  const step = Math.floor(Math.max(0, tMs) / LAMP_MS);
  return ((index + step) % 2 + 2) % 2 === 0;
}

/** 集电杆小旗摆角(弧度):跟随这一帧的转向量,夹在 ±0.5;reduced 静止 */
export function flagSwing(dFace: number, reduced: boolean): number {
  if (reduced || !Number.isFinite(dFace)) return 0;
  return Math.max(-1, Math.min(1, dFace * 6)) * 0.5;
}

/** 加速带流光推进(0..1 循环);reduced 冻结在 0 */
export function padFlow(tMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return (Math.max(0, tMs) % PAD_FLOW_MS) / PAD_FLOW_MS;
}

/**
 * 出局降落伞的下落进度 0..1:只读既有复活倒计时(`car.respawn` 剩余毫秒),
 * 刚出局是 0(还在看台上空),复活那一刻是 1(正好落回出生点)。
 */
export function parachuteProgress(respawnLeftMs: number): number {
  if (!Number.isFinite(respawnLeftMs)) return 1;
  return Math.max(0, Math.min(1, 1 - respawnLeftMs / PARACHUTE_MS));
}

// ---------------------------------------------------------------------------
// 基础矢量件
// ---------------------------------------------------------------------------

/** 四角小星(两个交叠细菱形),星花 / 呆毛 / 转盘星标共用 */
export function drawStar(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  rot = 0
): void {
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

/** 反射斑中心亮度(修复员 R2 · N3:0.16 → 0.24 提一档,第 1 关浅粉地板上不再近乎隐形) */
export const FLOOR_GLOW_CORE_ALPHA = 0.24;
/** 斑心内核小亮斑的透明度(同一椭圆倾角的迷你高光,不是花纹) */
export const FLOOR_GLOW_SHEEN_ALPHA = 0.12;

/**
 * 地板反射斑:一块柔和的放射状白光,把「场馆灯照在地板上」讲出来。
 * 修复员 R2 · N3:中心 alpha 提档(0.16 → 0.24)+ 斑心一枚同倾角迷你内核亮斑;
 * 渐变保持两停(实测 4× 节流下大椭圆径向渐变加中途停是可测的帧率回压,不加),
 * 椭圆几何(r × 0.62r,倾角 −0.5)与三处调用点的位置半径一个数不动,冰面依旧不画花。
 */
export function drawFloorGlow(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (!(r > 0)) return;
  g.save();
  const grad = g.createRadialGradient(x, y, r * 0.1, x, y, r);
  grad.addColorStop(0, withAlpha("#FFFFFF", FLOOR_GLOW_CORE_ALPHA));
  grad.addColorStop(1, withAlpha("#FFFFFF", 0));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(x, y, r, r * 0.62, -0.5, 0, Math.PI * 2);
  g.fill();
  // 内核亮斑:斑心再压一枚 0.34r 的同倾角纯色小椭圆,给光斑一个读得出的核
  // (纯色小面积填充,4× 节流实测无帧率代价;不用第二层渐变)
  g.fillStyle = withAlpha("#FFFFFF", FLOOR_GLOW_SHEEN_ALPHA);
  g.beginPath();
  g.ellipse(x - r * 0.06, y - r * 0.05, r * 0.34, r * 0.2, -0.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** 灯柱:小圆头灯 + 立杆 + 脚下影;on 决定灯头亮不亮 */
export function drawLampPost(g: CanvasRenderingContext2D, x: number, y: number, s: number, on: boolean): void {
  if (!(s > 0)) return;
  g.save();
  g.fillStyle = BC_COLORS.bcShadow;
  g.beginPath();
  g.ellipse(x + s * 0.2, y + s * 0.15, s * 0.7, s * 0.3, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = BC_COLORS.bcBumper;
  g.lineCap = "round";
  g.lineWidth = s * 0.22;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - s * 1.7);
  g.stroke();
  if (on) {
    const halo = g.createRadialGradient(x, y - s * 2, s * 0.1, x, y - s * 2, s * 1.1);
    halo.addColorStop(0, withAlpha(PASTELS.lemon, 0.5));
    halo.addColorStop(1, withAlpha(PASTELS.lemon, 0));
    g.fillStyle = halo;
    g.beginPath();
    g.arc(x, y - s * 2, s * 1.1, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = on ? PASTELS.lemon : shade(BC_COLORS.bcRail, -10);
  g.beginPath();
  g.arc(x, y - s * 2, s * 0.42, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = shade(PASTELS.lemon, OUTLINE_DARKEN);
  g.lineWidth = s * 0.08;
  g.stroke();
  g.restore();
}

/** 灯串上的一颗灯泡 */
export function drawBulb(g: CanvasRenderingContext2D, x: number, y: number, r: number, on: boolean): void {
  if (!(r > 0)) return;
  g.save();
  if (on) {
    g.fillStyle = withAlpha(PASTELS.lemon, 0.32);
    g.beginPath();
    g.arc(x, y, r * 2, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = on ? PASTELS.lemon : shade(BC_COLORS.bcRail, -14);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// ---------------------------------------------------------------------------
// 碰碰车三层自绘
// ---------------------------------------------------------------------------

export interface BumperCarArt {
  x: number;
  y: number;
  /** 判定半径原样传进来,三层都画在这个半径里 */
  r: number;
  face: number;
  color: string;
  /** 0 = 朵朵队(花发卡),其余星星呆毛 —— 发饰 + 车色双通道认阵营 */
  team: number;
  /** 蓄力进度 0..1:满蓄时集电杆小旗竖起换金色 */
  charge?: number;
  /** squash 压扁量(squashAmount 的返回值);只动绘制矩阵 */
  squash?: number;
  /** 集电杆小旗摆角(flagSwing 的返回值) */
  swing?: number;
  alpha?: number;
  /** 只画车壳不画影子(降落伞里吊着的小车用) */
  noShadow?: boolean;
}

/**
 * 顶视碰碰车三层:底层防撞橡胶圈(深环 + 左上高光弧)→ 中层车壳
 * (阵营色三停径向渐变)→ 顶层座舱司机(圆头 + 扶方向盘的手 + 发饰),
 * 外加车尾集电杆(斜线 + 顶端小旗)。只在传进来的 r 里重画,不碰数据。
 */
export function drawBumperCar(g: CanvasRenderingContext2D, art: BumperCarArt): void {
  const { x, y, r, face, color } = art;
  if (!(r > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const chargeK = Math.max(0, Math.min(1, art.charge ?? 0));
  const squash = art.squash ?? 0;
  g.save();
  g.globalAlpha = art.alpha ?? 1;

  if (!art.noShadow) {
    g.fillStyle = BC_COLORS.bcShadow;
    g.beginPath();
    g.ellipse(x + r * 0.16, y + r * 0.2, r * 1.02, r * 0.88, 0, 0, Math.PI * 2);
    g.fill();
  }

  g.translate(x, y);

  // 车尾集电杆:斜线 + 顶端小旗。满蓄旗子竖起、换金色 —— 老远就看见「它蓄满了」
  g.save();
  g.rotate(face + Math.PI + (art.swing ?? 0));
  const pole = r * (1 + chargeK * 0.25);
  g.strokeStyle = BC_COLORS.bcBumper;
  g.lineCap = "round";
  g.lineWidth = r * 0.1;
  g.beginPath();
  g.moveTo(r * 0.55, 0);
  g.lineTo(r * 0.55 + pole * 0.5, -pole * 0.42);
  g.stroke();
  const fx = r * 0.55 + pole * 0.5;
  const fy = -pole * 0.42;
  g.fillStyle = chargeK >= 1 ? BC_GOLD : shade(color, 24);
  g.beginPath();
  g.moveTo(fx, fy);
  g.lineTo(fx + r * (0.46 - chargeK * 0.2), fy - r * (0.14 + chargeK * 0.2));
  g.lineTo(fx + r * 0.05, fy - r * (0.4 + chargeK * 0.18));
  g.closePath();
  g.fill();
  g.restore();

  // squash:沿受击方向压扁,只动这一段绘制矩阵
  if (squash !== 0) {
    g.rotate(face);
    g.scale(1 - squash, 1 + squash);
    g.rotate(-face);
  }

  // ① 底层:防撞橡胶圈
  g.fillStyle = BC_COLORS.bcBumper;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = withAlpha("#FFFFFF", 0.3);
  g.lineCap = "round";
  g.lineWidth = r * 0.13;
  g.beginPath();
  g.arc(0, 0, r * 0.9, Math.PI * 1.05, Math.PI * 1.55);
  g.stroke();

  // ② 中层:车壳(三停径向渐变,左上受光)+ 统一描边(深 20%)
  const shellR = r * 0.76;
  g.fillStyle = ballGradient(g, 0, 0, shellR, color);
  g.beginPath();
  g.arc(0, 0, shellR, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = shade(color, OUTLINE_DARKEN);
  g.lineWidth = Math.min(r * 0.07, 0.45);
  g.stroke();

  // ③ 顶层:车头指示 + 座舱司机(全部跟着车头转)
  g.rotate(face);
  g.fillStyle = withAlpha("#FFFFFF", 0.85);
  g.beginPath();
  g.moveTo(shellR * 0.98, 0);
  g.lineTo(shellR * 0.56, -shellR * 0.26);
  g.lineTo(shellR * 0.56, shellR * 0.26);
  g.closePath();
  g.fill();

  // 方向盘
  g.strokeStyle = shade(BC_COLORS.bcBumper, 14);
  g.lineWidth = r * 0.08;
  g.beginPath();
  g.arc(shellR * 0.44, 0, r * 0.19, 0, Math.PI * 2);
  g.stroke();
  // 扶方向盘的两只手
  g.fillStyle = BC_SKIN;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(shellR * 0.44, s * r * 0.19, r * 0.09, 0, Math.PI * 2);
    g.fill();
  }
  // 圆头小司机
  const headR = r * 0.34;
  const headX = -r * 0.06;
  g.beginPath();
  g.arc(headX, 0, headR, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = shade(BC_SKIN, OUTLINE_DARKEN);
  g.lineWidth = Math.min(r * 0.05, 0.35);
  g.stroke();
  // 发饰:朵朵队花发卡,其余星星呆毛 —— 缩到最小也认得出阵营
  if (art.team === 0) {
    const px = headX - headR * 0.42;
    const py = -headR * 0.55;
    g.fillStyle = "#FFC2DA";
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(px + Math.cos(a) * headR * 0.34, py + Math.sin(a) * headR * 0.34, headR * 0.26, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = BC_GOLD;
    g.beginPath();
    g.arc(px, py, headR * 0.2, 0, Math.PI * 2);
    g.fill();
  } else {
    drawStar(g, headX, -headR * 0.95, r * 0.24, BC_GOLD, 0.3);
  }
  g.restore();
}

/**
 * 蓄力流光跑道:车壳外圈一条进度弧,映射与 1.2 蓄力环逐点一致。
 * `phase` 传 flowPhase 的返回值 —— reduced 下是 0,高光点停在弧头,弧本身照画。
 */
export function drawChargeTrack(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  ratio: number,
  phase: number,
  reduced: boolean
): void {
  if (!(r > 0) || ratio <= 0) return;
  const arc = chargeFlowArc(ratio);
  g.save();
  g.lineCap = "round";
  // 跑道底
  g.strokeStyle = withAlpha(BC_COLORS.bcBumper, 0.18);
  g.lineWidth = r * 0.3;
  g.beginPath();
  g.arc(x, y, r * 1.45, 0, Math.PI * 2);
  g.stroke();
  // 进度弧(颜色沿用 1.2:没满黄、满了橙)
  g.strokeStyle = ratio >= 1 ? "#ff8a3d" : "#ffc663";
  g.lineWidth = r * 0.24;
  g.beginPath();
  g.arc(x, y, r * 1.45, arc.from, arc.to);
  g.stroke();
  // 流光:一颗亮斑沿已点亮的弧跑
  if (!reduced && ratio > 0.05) {
    const a = arc.from + ((arc.to - arc.from) * (phase / (Math.PI * 2))) % (arc.to - arc.from);
    g.fillStyle = withAlpha("#FFFFFF", 0.9);
    g.beginPath();
    g.arc(x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45, r * 0.16, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** 出局降落伞:小车吊在条纹伞下,顺着复活倒计时飘回出生点;reduced 只画静态淡显 */
export function drawParachuteCar(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  team: number,
  progress: number,
  reduced: boolean
): void {
  if (!(r > 0)) return;
  const k = Math.max(0, Math.min(1, progress));
  g.save();
  // 落点提示圈(功能提示,reduced 也保留)
  g.strokeStyle = withAlpha(color, 0.4);
  g.lineWidth = r * 0.12;
  g.setLineDash([r * 0.4, r * 0.35]);
  g.beginPath();
  g.arc(x, y, r * 0.95, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  if (reduced) {
    // 直接淡出淡入:出生点一台静态淡车
    drawBumperCar(g, { x, y, r: r * 0.85, face: -Math.PI / 2, color, team, alpha: 0.28, noShadow: true });
    g.restore();
    return;
  }
  const lift = (1 - k) * r * 5;
  const sway = Math.sin(k * Math.PI * 3) * r * 0.35 * (1 - k);
  const cx = x + sway;
  const cy = y - lift;
  // 伞绳
  g.strokeStyle = withAlpha(BC_COLORS.bcBumper, 0.75);
  g.lineWidth = r * 0.06;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * r * 0.95, cy - r * 1.7);
    g.lineTo(cx + s * r * 0.3, cy - r * 0.4);
    g.stroke();
  }
  // 条纹伞盖
  const topY = cy - r * 1.75;
  g.fillStyle = withAlpha(color, 0.9);
  g.beginPath();
  g.arc(cx, topY, r * 1.05, Math.PI, 0);
  g.closePath();
  g.fill();
  g.fillStyle = withAlpha("#FFFFFF", 0.8);
  g.beginPath();
  g.moveTo(cx - r * 0.42, topY);
  g.quadraticCurveTo(cx - r * 0.21, topY - r * 1.05, cx, topY - r * 1.02);
  g.quadraticCurveTo(cx + r * 0.21, topY - r * 1.05, cx + r * 0.42, topY);
  g.closePath();
  g.fill();
  // 吊着的小车
  drawBumperCar(g, { x: cx, y: cy, r: r * 0.8, face: -Math.PI / 2, color, team, alpha: 0.95, noShadow: true });
  g.restore();
}

// ---------------------------------------------------------------------------
// 道具自绘
// ---------------------------------------------------------------------------

/** 彩虹肥皂渍:多色薄膜渐变 + 高光弧 + 泡泡两颗(替代 💧) */
export function drawSoapSlick(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (!(r > 0)) return;
  g.save();
  const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.12, x, y, r);
  grad.addColorStop(0, withAlpha(PASTELS.mint, 0.5));
  grad.addColorStop(0.45, withAlpha(PASTELS.lilac, 0.44));
  grad.addColorStop(0.78, withAlpha(PASTELS.pink, 0.4));
  grad.addColorStop(1, withAlpha(PASTELS.blue, 0.5));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(x, y, r, r * 0.92, 0.35, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = withAlpha("#8B78B5", 0.55);
  g.lineWidth = r * 0.06;
  g.stroke();
  // 薄膜高光
  g.strokeStyle = withAlpha("#FFFFFF", 0.55);
  g.lineCap = "round";
  g.lineWidth = r * 0.1;
  g.beginPath();
  g.arc(x, y, r * 0.64, Math.PI * 1.05, Math.PI * 1.5);
  g.stroke();
  // 泡泡两颗
  const bubbles: Array<[number, number, number]> = [
    [x + r * 0.42, y - r * 0.36, r * 0.2],
    [x - r * 0.5, y + r * 0.3, r * 0.13],
  ];
  for (const [bx, by, br] of bubbles) {
    g.strokeStyle = withAlpha("#FFFFFF", 0.8);
    g.lineWidth = br * 0.3;
    g.beginPath();
    g.arc(bx, by, br, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = withAlpha("#FFFFFF", 0.9);
    g.beginPath();
    g.arc(bx - br * 0.35, by - br * 0.35, br * 0.3, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** 木纹滚筒:端面年轮 + 横向板条纹(替代 🛢️) */
export function drawBarrel(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (!(r > 0)) return;
  g.save();
  g.fillStyle = BC_COLORS.bcShadow;
  g.beginPath();
  g.ellipse(x + r * 0.16, y + r * 0.2, r, r * 0.86, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = ballGradient(g, x, y, r, BC_WOOD);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = shade(BC_WOOD, OUTLINE_DARKEN);
  g.lineWidth = r * 0.07;
  g.stroke();
  // 横向板条纹(三条弦)
  g.strokeStyle = withAlpha(shade(BC_WOOD, -28), 0.75);
  g.lineCap = "round";
  g.lineWidth = r * 0.055;
  for (const t of [-0.55, 0, 0.55]) {
    const half = Math.sqrt(Math.max(0, 1 - t * t)) * r * 0.94;
    g.beginPath();
    g.moveTo(x - half, y + t * r);
    g.lineTo(x + half, y + t * r);
    g.stroke();
  }
  // 端面年轮两圈 + 芯
  g.strokeStyle = withAlpha(shade(BC_WOOD, -18), 0.8);
  g.lineWidth = r * 0.05;
  for (const k of [0.58, 0.32]) {
    g.beginPath();
    g.arc(x, y, r * k, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = shade(BC_WOOD, -30);
  g.beginPath();
  g.arc(x, y, r * 0.08, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** 唱片机转盘:同心纹 + 中心星标 + 一颗跟着转的盘边指示点(替代平涂圆 + 4 根线) */
export function drawTurntable(g: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number): void {
  if (!(r > 0)) return;
  g.save();
  g.fillStyle = shade(BC_COLORS.bcBumper, -8);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = withAlpha("#FFFFFF", 0.5);
  g.lineWidth = r * 0.05;
  g.stroke();
  // 同心纹
  g.strokeStyle = withAlpha("#FFFFFF", 0.14);
  g.lineWidth = r * 0.04;
  for (const k of [0.82, 0.66, 0.5]) {
    g.beginPath();
    g.arc(x, y, r * k, 0, Math.PI * 2);
    g.stroke();
  }
  // 中心标签 + 星标
  g.fillStyle = PASTELS.lemon;
  g.beginPath();
  g.arc(x, y, r * 0.3, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = shade(PASTELS.lemon, OUTLINE_DARKEN);
  g.lineWidth = r * 0.04;
  g.stroke();
  drawStar(g, x, y, r * 0.17, "#E8558F", angle);
  // 盘边指示点:reduced 下 angle 恒 0,就是一颗静态点
  g.fillStyle = withAlpha("#FFFFFF", 0.75);
  g.beginPath();
  g.arc(x + Math.cos(angle) * r * 0.74, y + Math.sin(angle) * r * 0.74, r * 0.08, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** 打转提示:两滴汗珠(替代 🧹)—— 功能表达,reduced 也画 */
export function drawSweat(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (!(r > 0)) return;
  g.save();
  g.fillStyle = withAlpha("#9FD0FF", 0.9);
  for (const [dx, dy, k] of [
    [-1.35, -1.3, 0.3],
    [-0.95, -1.65, 0.22],
  ] as Array<[number, number, number]>) {
    const bx = x + dx * r;
    const by = y + dy * r;
    const br = r * k;
    g.beginPath();
    g.moveTo(bx, by - br * 1.3);
    g.quadraticCurveTo(bx + br, by, bx, by + br * 0.75);
    g.quadraticCurveTo(bx - br, by, bx, by - br * 1.3);
    g.fill();
  }
  g.restore();
}

/** 失控旋转提示:三颗绕头小星(替代 💫)—— 功能表达,reduced 也画(静态) */
export function drawDizzyStars(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  tMs: number,
  reduced: boolean
): void {
  if (!(r > 0)) return;
  const base = reduced ? 0 : (Math.max(0, tMs) / 1000) * Math.PI * 2;
  for (let k = 0; k < 3; k++) {
    const a = base + (k / 3) * Math.PI * 2;
    drawStar(g, x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 0.6 - r * 1.1, r * 0.22, BC_GOLD, a);
  }
}
