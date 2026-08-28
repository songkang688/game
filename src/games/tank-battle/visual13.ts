/**
 * 铁皮坦克大战 · 1.3 视觉模块(只管画,不碰玩法)。
 *
 * 这里住着三样东西:
 *   1. 配色板与图层序常量块(四·补一)+ 动效时序表(四·补三)——数值全部写死成常量,
 *      测试逐个对表,谁改了立刻红;
 *   2. 纯函数相位:履带齿、两帧水波、冰面扫光、重生光环,全都由「毫秒 + reduced」算出来,
 *      不持有任何状态,reduced 一律冻结;
 *   3. `TankFx`:渲染侧的小账本(履带里程、炮口闪光帧、受击白闪帧)。
 *      它只读 `World`,一个字也不写回去 —— 玩法数值与判定在 `logic.ts`,这儿碰不到。
 *
 * 分级红线:被打中是「散架重组」,所以零件是齿轮/弹簧/履带片这类玩具件,没有火、没有伤。
 */

import { shade, withAlpha } from "../../art/kit/palette";
import { strokeOutline } from "../../art/kit/outline";
import { SIDE_RATIO, roundRectPath, topSideBlock } from "../../art/kit/block25d";
import { DX, DY } from "./terrain12";
import type { Tank, World } from "./logic";
import { REBUILD_SECONDS } from "./logic";

// ---------------------------------------------------------------------------
// 四·补一 配色板(token 一个不许飘)
// ---------------------------------------------------------------------------

export const TK_COLORS = {
  /** 地面底色 */
  tkGround: "#F5EBDD",
  /** 砖墙顶面 */
  tkBrick: "#E2A87A",
  /** 砖墙右侧面 = shade(tkBrick, -22) */
  tkBrickSide: shade("#E2A87A", -22),
  /** 钢块顶面 */
  tkSteel: "#C9D3DE",
  /** 草丛主色 */
  tkGrass: "#9FD98B",
  /** 冰面主色 */
  tkIce: "#DDF2FF",
  /** 水面主色 */
  tkWater: "#A8D8F0",
  /** 朵朵车体主色 */
  tkPink: "#F4859F",
  /** 星星车体主色 */
  tkBlue: "#7FB2F0",
  /** 全图统一右下投影 */
  tkShadow: "rgba(70,60,50,.16)",
} as const;

/** 徽章金边 / 基地星星用的金 */
export const TK_GOLD = "#F2C94C";
/** 履带与炮管这类「铁件」的深灰 */
export const TK_IRON = "#6B6478";
/** 描边统一深 20%:轮廓色都从主色 shade(-20) 拿 */
export const OUTLINE_SHADE = -20;

// ---------------------------------------------------------------------------
// 四·补三 动效时序表(毫秒写死,测试引用)
// ---------------------------------------------------------------------------

/** 履带齿滚动:行进中每 0.2s 滚一格齿(step 缓动),reduced 冻结 */
export const TRACK_STEP_MS = 200;
/** 水面波纹:两帧 1600ms 交替(linear),reduced 冻结 */
export const WATER_WAVE_MS = 1600;
/** 冰面高光扫条:4000ms 一趟(easeInOut),reduced 冻结 */
export const ICE_SHEEN_MS = 4000;
/** 重生光环:1200ms 一圈(linear),reduced 静态环 + 进度弧保留 */
export const REBUILD_RING_MS = 1200;
/** 受击白闪帧数(功能反馈,reduced 也保留) */
export const HIT_FLASH_FRAMES = 2;
/** 炮口十字闪光帧数;reduced 留 1 帧(这是「打出去了」的功能反馈) */
export const MUZZLE_FLASH_FRAMES = 2;
export const MUZZLE_FLASH_FRAMES_REDUCED = 1;
/** 护甲小盾牌图标的边长(px,写死 —— 缩放格子也不缩它) */
export const ARMOR_BADGE_PX = 8;
/** 全图统一右下投影偏移(px) */
export const SHADOW_PX = 2;
/** 2.5D 侧面高度 = 0.18 × 块宽(与 art/kit/block25d 的 SIDE_RATIO 同值) */
export const TANK_SIDE_RATIO = 0.18;
/** 履带齿:齿高 1.5px、齿距 3px */
export const TRACK_TOOTH_H = 1.5;
export const TRACK_TOOTH_GAP = 3;
/** 炮塔圆壳直径 = 0.55 × 车宽 */
export const TURRET_RATIO = 0.55;

// ---------------------------------------------------------------------------
// C-3 家族光照上主角(B 档 R2 一致性排名 5,克制执行两笔):
// ① 炮塔圆顶左上高光弧从 1px 白细线换 shade(炮塔顶色,+18) 2px 圆头弧(静态);
// ② 徽章描边换 kit strokeOutline(深 20% / 1.5px)对齐家规。
// 地形块顶侧双面是本款方言,一个不动;不新增徽记。
// ---------------------------------------------------------------------------

/** 炮塔高光弧:比炮塔顶色再亮 18%(家族左上 45° 光照语言) */
export const TURRET_SHEEN_SHADE = 18;
/** 高光弧线宽(px,静态) */
export const TURRET_SHEEN_W = 2;
/** 高光弧的弧段:左上象限(canvas 角度 π×0.9 → π×1.45),与原白细线同位 */
export const TURRET_SHEEN_ARC = [Math.PI * 0.9, Math.PI * 1.45] as const;

/** 炮塔高光弧取色:顶色 shade(+18) */
export function turretSheenColor(topLite: string): string {
  return shade(topLite, TURRET_SHEEN_SHADE);
}

/** C-3 ①:炮塔圆顶左上高光弧 —— 唯一的动作是把家族光照带上主角,静态零动效 */
export function drawTurretSheen(c: CanvasRenderingContext2D, x: number, y: number, r: number, topLite: string): void {
  if (!(r > 0)) return;
  c.strokeStyle = turretSheenColor(topLite);
  c.lineWidth = TURRET_SHEEN_W;
  c.lineCap = "round";
  c.beginPath();
  c.arc(x, y, r, TURRET_SHEEN_ARC[0], TURRET_SHEEN_ARC[1]);
  c.stroke();
}

// ---------------------------------------------------------------------------
// 纯函数相位:全部「毫秒进、相位出」,不持有状态
// ---------------------------------------------------------------------------

/** smoothstep:冰面扫光的 easeInOut 就用它 */
export function easeInOut(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return t * t * (3 - 2 * t);
}

/**
 * 履带齿相位:里程毫秒 / 200ms 一格,向下取整(step 缓动)。
 * 里程是有符号的:倒着溜(冰面)里程变负,相位就往回退 —— 齿纹反向滚。
 */
export function trackPhase(rollMs: number): number {
  return Math.floor(rollMs / TRACK_STEP_MS);
}

/** 履带齿纹的错位量(px):奇数相位错开半个齿距,负相位也算得对 */
export function trackToothOffset(rollMs: number): number {
  const parity = ((trackPhase(rollMs) % 2) + 2) % 2;
  return parity * (TRACK_TOOTH_GAP / 2);
}

/** 水面两帧波纹:0 / 1 交替,每帧 1600ms;reduced 永远停在第 0 帧 */
export function waterFrame(tMs: number, reduced: boolean): 0 | 1 {
  if (reduced) return 0;
  return (Math.floor(Math.max(0, tMs) / WATER_WAVE_MS) % 2) as 0 | 1;
}

/** 冰面扫光条的位置(0..1,easeInOut);reduced 冻结在 0 */
export function iceSheenPos(tMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return easeInOut((Math.max(0, tMs) % ICE_SHEEN_MS) / ICE_SHEEN_MS);
}

/** 重生光环角度(弧度,linear);reduced 静态(0) */
export function ringAngle(tMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return ((Math.max(0, tMs) % REBUILD_RING_MS) / REBUILD_RING_MS) * Math.PI * 2;
}

/** 重生进度(0..1):只读 `REBUILD_SECONDS`,不定义自己的时长 */
export function rebuildProgress(spin: number): number {
  return Math.max(0, Math.min(1, (REBUILD_SECONDS - spin) / REBUILD_SECONDS));
}

// ---------------------------------------------------------------------------
// TankFx:渲染侧的小账本(destroy 时 reset 归零)
// ---------------------------------------------------------------------------

interface FxEntry {
  x: number;
  y: number;
  /** 履带里程(毫秒计,带符号:前进加、倒溜减) */
  roll: number;
  /** 炮口十字闪光还剩几帧 */
  muzzle: number;
  /** 受击白闪还剩几帧 */
  hit: number;
  armor: number;
  windup: number;
}

export class TankFx {
  private map = new Map<number, FxEntry>();
  private lastT = -1;

  /** 正在记账的坦克数(测试与 destroy 自查用) */
  get tracked(): number {
    return this.map.size;
  }

  reset(): void {
    this.map.clear();
    this.lastT = -1;
  }

  /**
   * 每帧画之前喂一次。只读世界:
   *  - 位移沿车头方向投影,前进里程加、倒溜里程减(reduced 冻结不加);
   *  - 前摇归零的那一帧 = 弹丸出膛 → 点燃炮口闪光(reduced 留 1 帧);
   *  - 护甲掉一格 = 挨了一发 → 白闪 2 帧(功能反馈,reduced 也保留)。
   */
  update(w: World, tMs: number, reduced: boolean): void {
    const dt = this.lastT < 0 ? 0 : Math.max(0, tMs - this.lastT);
    this.lastT = tMs;
    const seen = new Set<number>();
    for (const tk of w.tanks) {
      seen.add(tk.id);
      let e = this.map.get(tk.id);
      if (!e) {
        e = { x: tk.x, y: tk.y, roll: 0, muzzle: 0, hit: 0, armor: tk.armor, windup: tk.windup };
        this.map.set(tk.id, e);
      }
      const dx = tk.x - e.x;
      const dy = tk.y - e.y;
      if (!reduced && Math.abs(dx) + Math.abs(dy) > 1e-4) {
        const ahead = dx * DX[tk.dir] + dy * DY[tk.dir];
        e.roll += (ahead >= 0 ? 1 : -1) * dt;
      }
      if (e.windup > 0 && tk.windup <= 0) {
        e.muzzle = reduced ? MUZZLE_FLASH_FRAMES_REDUCED : MUZZLE_FLASH_FRAMES;
      } else if (e.muzzle > 0) {
        e.muzzle -= 1;
      }
      if (tk.armor < e.armor) e.hit = HIT_FLASH_FRAMES;
      else if (e.hit > 0) e.hit -= 1;
      e.x = tk.x;
      e.y = tk.y;
      e.armor = tk.armor;
      e.windup = tk.windup;
    }
    for (const id of [...this.map.keys()]) {
      if (!seen.has(id)) this.map.delete(id);
    }
  }

  rollOf(tk: Tank): number {
    return this.map.get(tk.id)?.roll ?? 0;
  }

  muzzleOf(tk: Tank): number {
    return this.map.get(tk.id)?.muzzle ?? 0;
  }

  hitOf(tk: Tank): number {
    return this.map.get(tk.id)?.hit ?? 0;
  }
}

/** 半透明白 / 半透明描边这类到处要用的小抄 */
export const SOFT_WHITE = withAlpha("#FFFFFF", 0.55);

// ---------------------------------------------------------------------------
// 格内双面块:右下 2px 投影 + 顶/侧双面,全部收在调用者给的盒子里
// ---------------------------------------------------------------------------

/**
 * 一格地形的标准画法:投影先落在右下(偏 `SHADOW_PX`),块体再画在左上 ——
 * 投影、侧面、顶面三层加起来也不超出 `(x, y, w, h)`,判定格子一寸不多占。
 */
export function cellBlock(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
  radius = 2
): void {
  const bw = Math.max(1, w - SHADOW_PX);
  const bh = Math.max(1, h - SHADOW_PX);
  c.fillStyle = TK_COLORS.tkShadow;
  roundRectPath(c, x + SHADOW_PX, y + SHADOW_PX, bw, bh, radius);
  c.fill();
  topSideBlock(c, x, y, bw, bh, base, SIDE_RATIO, radius);
}

// ---------------------------------------------------------------------------
// 阵营徽章:全部自绘矢量,彻底替换往车顶贴 emoji 字符的老画法。
// 双通道可辨:形状(花/星/齿轮/铆钉/闪电)+ 颜色(车体主色不同),缩到 8px 也分得清。
// ---------------------------------------------------------------------------

export type BadgeKind = "flower" | "star" | "gear" | "rivet" | "bolt";

/** 敌方四款车型 → 徽章形状(齿轮 / 铆钉 / 闪电三款,颜色再拉开一档) */
export const KIND_BADGE: Readonly<Record<string, BadgeKind>> = {
  swift: "bolt",
  armor: "rivet",
  power: "gear",
  smart: "gear",
};

function starPath(c: CanvasRenderingContext2D, x: number, y: number, R: number, inner = 0.45): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? R : R * inner;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
}

/** 朵朵徽章:五瓣小花(白瓣 + 金芯) */
export function drawFlowerBadge(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.fillStyle = "#FFF6F9";
  for (let i = 0; i < 5; i++) {
    const a = ((Math.PI * 2) / 5) * i - Math.PI / 2;
    c.beginPath();
    c.ellipse(x + Math.cos(a) * r * 0.52, y + Math.sin(a) * r * 0.52, r * 0.42, r * 0.3, a, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = TK_GOLD;
  c.beginPath();
  c.arc(x, y, r * 0.34, 0, Math.PI * 2);
  c.fill();
}

/** 星星徽章:金色五角星,描边走 kit strokeOutline(C-3 ②:深 20% / 1.5px 对齐家规) */
export function drawStarBadge(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.fillStyle = TK_GOLD;
  starPath(c, x, y, r);
  c.fill();
  strokeOutline(c, TK_GOLD);
}

/** 齿轮徽章(敌方·火力/机灵):八齿 + 中孔 */
export function drawGearBadge(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.fillStyle = TK_IRON;
  for (let i = 0; i < 8; i++) {
    const a = ((Math.PI * 2) / 8) * i;
    c.beginPath();
    c.arc(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72, r * 0.26, 0, Math.PI * 2);
    c.fill();
  }
  c.beginPath();
  c.arc(x, y, r * 0.62, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#EDE7F2";
  c.beginPath();
  c.arc(x, y, r * 0.26, 0, Math.PI * 2);
  c.fill();
}

/** 铆钉徽章(敌方·装甲):圆盘 + 四颗铆钉 */
export function drawRivetBadge(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.fillStyle = TK_IRON;
  c.beginPath();
  c.arc(x, y, r * 0.8, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#EDE7F2";
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i + Math.PI / 4;
    c.beginPath();
    c.arc(x + Math.cos(a) * r * 0.46, y + Math.sin(a) * r * 0.46, r * 0.16, 0, Math.PI * 2);
    c.fill();
  }
}

/** 闪电徽章的亮黄主色 */
export const BOLT_YELLOW = "#FFE08A";

/** 闪电徽章(敌方·快速):亮黄折线闪电,描边走 kit strokeOutline(C-3 ②) */
export function drawBoltBadge(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.fillStyle = BOLT_YELLOW;
  c.beginPath();
  c.moveTo(x + r * 0.18, y - r);
  c.lineTo(x - r * 0.42, y + r * 0.12);
  c.lineTo(x - r * 0.04, y + r * 0.1);
  c.lineTo(x - r * 0.2, y + r);
  c.lineTo(x + r * 0.46, y - r * 0.14);
  c.lineTo(x + r * 0.06, y - r * 0.12);
  c.closePath();
  c.fill();
  strokeOutline(c, BOLT_YELLOW);
}

/** 徽章总入口:按形状分发 */
export function drawBadge(c: CanvasRenderingContext2D, kind: BadgeKind, x: number, y: number, r: number): void {
  if (kind === "flower") drawFlowerBadge(c, x, y, r);
  else if (kind === "star") drawStarBadge(c, x, y, r);
  else if (kind === "gear") drawGearBadge(c, x, y, r);
  else if (kind === "rivet") drawRivetBadge(c, x, y, r);
  else drawBoltBadge(c, x, y, r);
}

/** 护甲小盾牌(金边,固定 8px):替换 1.2 那颗「像渲染 bug」的白点 */
export function drawShieldBadge(c: CanvasRenderingContext2D, x: number, y: number, px = ARMOR_BADGE_PX): void {
  const w = px / 2;
  const h = px / 2;
  c.fillStyle = "#FFFDF6";
  c.strokeStyle = TK_GOLD;
  c.lineWidth = Math.max(1, px * 0.16);
  c.beginPath();
  c.moveTo(x - w, y - h * 0.7);
  c.quadraticCurveTo(x, y - h, x + w, y - h * 0.7);
  c.lineTo(x + w, y + h * 0.1);
  c.quadraticCurveTo(x + w * 0.6, y + h * 0.8, x, y + h);
  c.quadraticCurveTo(x - w * 0.6, y + h * 0.8, x - w, y + h * 0.1);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = TK_GOLD;
  c.beginPath();
  c.arc(x, y, px * 0.14, 0, Math.PI * 2);
  c.fill();
}

/** 炮口十字闪光(两帧):四条短臂 + 中心亮点,只是「打出去了」的回执 */
export function drawMuzzleFlash(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.fillStyle = "rgba(255,236,150,.45)";
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#FFF7DA";
  c.lineWidth = Math.max(1.2, r * 0.3);
  c.beginPath();
  c.moveTo(x - r, y);
  c.lineTo(x + r, y);
  c.moveTo(x, y - r);
  c.lineTo(x, y + r);
  c.stroke();
}

/** 护盾圈的六边形网纹(reduced 时角度冻结、透明度恒定) */
export function drawHexRing(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angle: number,
  alpha: number
): void {
  c.strokeStyle = withAlpha("#FFFFFF", alpha);
  c.lineWidth = Math.max(1.2, r * 0.09);
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = ((Math.PI * 2) / 6) * i + angle;
    const px = x + Math.cos(a) * r * 0.86;
    const py = y + Math.sin(a) * r * 0.86;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  c.stroke();
}

// ---------------------------------------------------------------------------
// 散架零件:齿轮 / 弹簧 / 履带片 / 轮子 / 螺母,五件对应 1.2 的五个 emoji
// ---------------------------------------------------------------------------

export type PartKind = "gear" | "spring" | "track" | "wheel" | "nut";
export const PART_KINDS: readonly PartKind[] = ["gear", "spring", "track", "wheel", "nut"];

const PART_METAL = "#9AA3B2";
const PART_DARK = shade("#9AA3B2", -28);
const PART_GRAY = "#BDBDC6";

/** 一枚玩具零件;`gray` = reduced 的一帧灰显 */
export function drawPart(
  c: CanvasRenderingContext2D,
  kind: PartKind,
  x: number,
  y: number,
  r: number,
  gray = false
): void {
  const metal = gray ? PART_GRAY : PART_METAL;
  const dark = gray ? PART_GRAY : PART_DARK;
  if (kind === "gear") {
    c.fillStyle = metal;
    for (let i = 0; i < 6; i++) {
      const a = ((Math.PI * 2) / 6) * i;
      c.beginPath();
      c.arc(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.28, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.arc(x, y, r * 0.58, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = dark;
    c.beginPath();
    c.arc(x, y, r * 0.24, 0, Math.PI * 2);
    c.fill();
  } else if (kind === "spring") {
    c.strokeStyle = metal;
    c.lineWidth = Math.max(1.2, r * 0.3);
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const yy = y - r * 0.6 + i * r * 0.6;
      c.moveTo(x - r * 0.5, yy);
      c.quadraticCurveTo(x, yy - r * 0.4, x + r * 0.5, yy);
    }
    c.stroke();
  } else if (kind === "track") {
    c.fillStyle = dark;
    roundRectPath(c, x - r * 0.9, y - r * 0.4, r * 1.8, r * 0.8, r * 0.25);
    c.fill();
    c.fillStyle = metal;
    c.beginPath();
    c.arc(x - r * 0.4, y, r * 0.18, 0, Math.PI * 2);
    c.arc(x + r * 0.4, y, r * 0.18, 0, Math.PI * 2);
    c.fill();
  } else if (kind === "wheel") {
    c.fillStyle = dark;
    c.beginPath();
    c.arc(x, y, r * 0.8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = metal;
    c.beginPath();
    c.arc(x, y, r * 0.42, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = dark;
    c.beginPath();
    c.arc(x, y, r * 0.14, 0, Math.PI * 2);
    c.fill();
  } else {
    // 螺母:六边形 + 中孔
    c.fillStyle = metal;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = ((Math.PI * 2) / 6) * i + Math.PI / 6;
      const px = x + Math.cos(a) * r * 0.75;
      const py = y + Math.sin(a) * r * 0.75;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.fillStyle = dark;
    c.beginPath();
    c.arc(x, y, r * 0.3, 0, Math.PI * 2);
    c.fill();
  }
}

// ---------------------------------------------------------------------------
// 粒子矢量:小花 / 烟团 / 星屑 / 砖屑,替换 1.2 用 emoji 字符贴出来的粒子
// ---------------------------------------------------------------------------

/** 变花退场:五瓣粉白小花 + 金芯 */
export function drawFxFlower(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.fillStyle = "#FFD7E4";
  for (let i = 0; i < 5; i++) {
    const a = ((Math.PI * 2) / 5) * i - Math.PI / 2;
    c.beginPath();
    c.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.42, r * 0.3, a, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = TK_GOLD;
  c.beginPath();
  c.arc(x, y, r * 0.3, 0, Math.PI * 2);
  c.fill();
}

/** 冒烟:三团灰白圆,越散越淡(k 是 0..1 的进度) */
export function drawFxSmoke(c: CanvasRenderingContext2D, x: number, y: number, r: number, k: number): void {
  c.fillStyle = "rgba(214,210,222,.8)";
  const lift = (1 - k) * r;
  c.beginPath();
  c.arc(x - r * 0.5, y - lift * 0.4, r * 0.5, 0, Math.PI * 2);
  c.arc(x + r * 0.4, y - lift * 0.7, r * 0.62, 0, Math.PI * 2);
  c.arc(x, y - lift, r * 0.4, 0, Math.PI * 2);
  c.fill();
}

/** 星屑:四角星(护罩挡下一发、通用火花都用它) */
export function drawFxSparkle(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.fillStyle = "#FFF3C2";
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x + r * 0.18, y - r * 0.18, x + r, y);
  c.quadraticCurveTo(x + r * 0.18, y + r * 0.18, x, y + r);
  c.quadraticCurveTo(x - r * 0.18, y + r * 0.18, x - r, y);
  c.quadraticCurveTo(x - r * 0.18, y - r * 0.18, x, y - r);
  c.closePath();
  c.fill();
}

/** 砖屑:两片斜着飞的小砖块 */
export function drawFxCrumb(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.fillStyle = TK_COLORS.tkBrick;
  c.fillRect(x - r * 1.2, y - r * 0.5, r, r * 0.8);
  c.fillStyle = TK_COLORS.tkBrickSide;
  c.fillRect(x + r * 0.3, y - r * 0.1, r * 0.8, r * 0.65);
}
