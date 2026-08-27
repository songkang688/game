/**
 * 泡泡布阵 · 1.3 视觉模块(只管画,不碰玩法)。
 *
 * 这里住着四样东西:
 *   1. 配色板与图层序常量块(四·补一)+ 动效时序表(四·补三)——数值全部写死成常量,
 *      测试逐个对表,谁改了立刻红;
 *   2. 纯函数相位:引信星火、临爆 ±6% 体积脉动、涟漪推进延迟、危险格泛红呼吸、
 *      软砖两阶段裂纹,全都由「毫秒 + reduced」算出来,不持有状态;
 *   3. 自绘矢量:拱形木门、七件道具图标、三套主题墙角饰、花瓣涟漪单元 —— emoji 素材彻底下岗;
 *   4. `BbBoomFx` / `BbFighterFx`:渲染侧的小账本(爆炸涟漪推进、埋弹下蹲窗口)。
 *      它们只读 `World` 的炸弹与事件,一个字也不写回去。
 *
 * 分级红线:爆炸永远是「花瓣与星星」,无火焰、无灼伤;被波及是「变泡泡飘走再回来」。
 * `dangerTiming` 的时序输入与 1.2 完全一致,这里只换皮(泛红呼吸 + 虚线边),不改时机。
 */

import { shade } from "../../art/kit/palette";
import { strokeOutline } from "../../art/kit/outline";
import { easeOutQuad } from "../../art/kit/sparkle";
import { SQUAT_MS } from "../../art/kit/chibi";
import { DIRS, FUSE_MS, xOf, yOf, type Board, type Bomb, type ChainWave, type ItemKind } from "./logic";

// ---------------------------------------------------------------------------
// 四·补一 配色板(token 一个不许飘)
// ---------------------------------------------------------------------------

export const BB_COLORS = {
  /** 地板棋盘双色(明度差 4%) */
  bbFloorA: "#FDF3F7",
  bbFloorB: "#F8ECF2",
  /** 硬墙顶面 */
  bbWall: "#D9C4E8",
  /** 硬墙右 / 下侧面 = shade(bbWall, -22) */
  bbWallSide: shade("#D9C4E8", -22),
  /** 软砖主色(侧面沿全库 -22 档,由 block25d 统一取) */
  bbBrick: "#F3C9A8",
  /** 炸弹泡泡主体 */
  bbBubble: "#BFE4FF",
  /** 危险格泛红呼吸峰值 */
  bbDanger: "rgba(244,110,110,.32)",
  /** 朵朵 / 星星服装主色 */
  bbPink: "#F4859F",
  bbBlue: "#7FB2F0",
  /** 全图统一落影 */
  bbShadow: "rgba(93,64,90,.16)",
} as const;

/** 危险格泛红的 RGB(和 bbDanger 同源,呼吸时只动透明度) */
export const DANGER_RGB = "244,110,110" as const;
/** 危险格泛红呼吸峰值透明度(= bbDanger 的 .32) */
export const DANGER_PEAK_ALPHA = 0.32;
/** 危险格边缘虚线颜色(小屏保命线:对地板对比度 ≥ 3:1) */
export const DANGER_EDGE = "#D64545";
/** 木门主色(拱形木门 + 星星门牌) */
export const BB_DOOR = "#C89B6E";
/** reduced 下临爆「只变色」的泡泡体色 */
export const BB_PULSE_TINT = "#FFD3E2";

/**
 * 图层序(render 内固定从底到顶)。危险层永远压在砖下、角色上层不遮提示 ——
 * 涟漪与粒子在角色之上,HUD 是 DOM,排在最后一格只是把约定写全。
 */
export const BB_LAYERS = [
  "floor",
  "danger",
  "blocks",
  "items",
  "bombs",
  "fighters",
  "ripples",
  "hud",
] as const;

// ---------------------------------------------------------------------------
// 四·补三 动效时序表(毫秒写死,测试引用)
// ---------------------------------------------------------------------------

/** 引信星火沿弧线上蹿:400ms 循环(linear);reduced 静态星火点 */
export const FUSE_SPARK_MS = 400;
/** 临爆体积脉动:只在爆前这个窗口出现 */
export const PULSE_WINDOW_MS = 1000;
/** 脉动周期(sin) */
export const PULSE_PERIOD_MS = 250;
/** 脉动幅度 ±6% */
export const PULSE_AMP = 0.06;
/** 爆炸中心白闪帧数(功能反馈,reduced 也保留) */
export const BOOM_FLASH_FRAMES = 2;
/** 花瓣涟漪:沿四臂每格延后这么多毫秒出现,随后在同样时长里渐隐(easeOutQuad) */
export const RIPPLE_STEP_MS = 150;
/** reduced:涟漪一次性静态显示的停留时长 */
export const RIPPLE_REDUCED_HOLD_MS = 300;
/** 每条臂末端的星屑颗数 */
export const RIPPLE_END_SPARKS = 3;
/** 末端星屑寿命 */
export const RIPPLE_SPARK_MS = 300;
/** 危险格泛红呼吸周期(sin);时机仍由 dangerTiming 说了算 */
export const DANGER_BREATH_MS = 900;
/** 一进危险表就有的底亮(对应 1.2 描边的 0.15 基线:提前亮的时机一帧不差) */
export const DANGER_FLOOR = 0.35;
/** 软砖两阶段裂纹的门槛(纯视觉:炸碎仍是一次到位的逻辑) */
export const CRACK_STAGE1_MS = 1000;
export const CRACK_STAGE2_MS = 350;

// ---------------------------------------------------------------------------
// 纯函数相位:全部「毫秒进、相位出」,不持有状态
// ---------------------------------------------------------------------------

/** 引信星火的行程 0..1(linear 循环);reduced 冻结在 0(画静态星火点) */
export function fuseSparkPhase(ageMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return (Math.max(0, ageMs) % FUSE_SPARK_MS) / FUSE_SPARK_MS;
}

/**
 * 临爆体积脉动:引信只剩 `PULSE_WINDOW_MS` 以内才出现,±6%、250ms 周期(sin)。
 * reduced 一律返回 1 —— 那时候「快破了」由变色说(见 `BB_PULSE_TINT`)。
 */
export function bombPulseScale(fuseMs: number, reduced: boolean): number {
  if (reduced) return 1;
  if (fuseMs > PULSE_WINDOW_MS || fuseMs < 0) return 1;
  const t = PULSE_WINDOW_MS - fuseMs;
  return 1 + PULSE_AMP * Math.sin((t / PULSE_PERIOD_MS) * Math.PI * 2);
}

/** 花瓣涟漪:离炸心 `dist` 格的那一瓣延后多少毫秒;reduced 全部同时出现(一次性静态) */
export function rippleDelayMs(dist: number, reduced: boolean): number {
  return reduced ? 0 : Math.max(0, dist) * RIPPLE_STEP_MS;
}

/**
 * 危险格泛红的这一帧透明度。
 *
 * `near = 1 - msToBurn / FUSE_MS` 与 1.2 是同一条归一化 —— 什么时候开始亮、
 * 多快变亮全部原样;这里只把「描边变色」换成「地板泛红 + 呼吸」。
 * reduced:呼吸停,静态红保留(保命信息不减)。峰值 = DANGER_PEAK_ALPHA。
 */
export function dangerGlowAlpha(msToBurn: number, nowMs: number, reduced: boolean): number {
  const near = Math.max(0, Math.min(1, 1 - msToBurn / FUSE_MS));
  const ramp = DANGER_FLOOR + (1 - DANGER_FLOOR) * near;
  const breath = reduced ? 1 : 0.7 + 0.3 * (0.5 + 0.5 * Math.sin((nowMs / DANGER_BREATH_MS) * Math.PI * 2));
  return DANGER_PEAK_ALPHA * ramp * breath;
}

/** 危险格边缘虚线的透明度:沿用 1.2 描边的 `0.15 + near * 0.55`,时序一帧不差 */
export function dangerEdgeAlpha(msToBurn: number): number {
  const near = Math.max(0, Math.min(1, 1 - msToBurn / FUSE_MS));
  return 0.15 + near * 0.55;
}

/** 软砖裂纹分档:0 = 完好,1 = 细裂,2 = 大裂。只由 dangerTiming 的读数驱动,纯视觉 */
export function crackStage(msToBurn: number | undefined): 0 | 1 | 2 {
  if (msToBurn === undefined || !Number.isFinite(msToBurn)) return 0;
  if (msToBurn <= CRACK_STAGE2_MS) return 2;
  if (msToBurn <= CRACK_STAGE1_MS) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// 三套主题(花园 / 冰原 / 星空):只换装饰层,不换布局数据
// ---------------------------------------------------------------------------

export type BbTheme = "garden" | "ice" | "starry";

/**
 * 章节 → 主题:草坪 / 糖果 / 矿洞 / 沙漠走「花园藤蔓」,水乡 / 冰原走「冰原霜花」,
 * 云朵 / 月亮走「星空星子」。章节配色(palette)照旧,角饰颜色也从它身上取。
 */
export const THEME_BY_CHAPTER: readonly BbTheme[] = [
  "garden",
  "garden",
  "ice",
  "starry",
  "garden",
  "ice",
  "garden",
  "starry",
];

export function themeOfChapter(chapter: number): BbTheme {
  const i = Math.max(0, Math.min(THEME_BY_CHAPTER.length - 1, Math.floor(chapter)));
  return THEME_BY_CHAPTER[i];
}

// ---------------------------------------------------------------------------
// 基础形状
// ---------------------------------------------------------------------------

/** N 角星路径(fill 由调用方管):rot 默认让一个角朝正上 */
export function starPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rOuter: number,
  points = 5,
  innerRatio = 0.5,
  rot = -Math.PI / 2
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rOuter * innerRatio;
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** 四角星屑(两个交叠的细菱形),涟漪末端与引信星火共用 */
export function sparkPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.3, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r * 0.3, cy);
  ctx.closePath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx, cy + r * 0.3);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy - r * 0.3);
  ctx.closePath();
}

/** 花瓣涟漪单元:五瓣小花(五个圆瓣 + 白心),一格一瓣 */
export function drawRipplePetal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number
): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = color;
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#FFF8FB";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 自绘矢量:门 / 道具 / 主题角饰
// ---------------------------------------------------------------------------

/** 拱形木门 + 星星门牌(替换 🚪) */
export function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const cx = x + size / 2;
  const w = size * 0.6;
  const baseY = y + size * 0.88;
  const archY = y + size * 0.42;
  // 门板:方脚 + 半圆拱顶
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, baseY);
  ctx.lineTo(cx - w / 2, archY);
  ctx.arc(cx, archY, w / 2, Math.PI, 0);
  ctx.lineTo(cx + w / 2, baseY);
  ctx.closePath();
  ctx.fillStyle = BB_DOOR;
  ctx.fill();
  strokeOutline(ctx, BB_DOOR, Math.max(1.5, size * 0.045));
  // 两条门板木纹
  ctx.strokeStyle = shade(BB_DOOR, -18);
  ctx.lineWidth = Math.max(1, size * 0.03);
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + (k * w) / 6, baseY - size * 0.04);
    ctx.lineTo(cx + (k * w) / 6, archY - w * 0.28);
    ctx.stroke();
  }
  // 门把
  ctx.fillStyle = shade(BB_DOOR, -32);
  ctx.beginPath();
  ctx.arc(cx + w * 0.26, baseY - size * 0.2, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
  // 星星门牌(出口 = 回家的星星)
  ctx.fillStyle = "#FFD678";
  starPath(ctx, cx, y + size * 0.18, size * 0.13);
  ctx.fill();
  strokeOutline(ctx, "#FFD678", 1.5);
}

/** 道具图标统一入口:火力 = 星火、泡泡数 = 泡泡串、脚力 = 小靴…… 全部程序化绘制 */
export function drawItemIcon(
  ctx: CanvasRenderingContext2D,
  kind: ItemKind,
  cx: number,
  cy: number,
  r: number
): void {
  switch (kind) {
    case "fire": {
      // 星火:一大一小两颗四角星
      ctx.fillStyle = "#FFB84D";
      sparkPath(ctx, cx, cy, r * 0.82);
      ctx.fill();
      ctx.fillStyle = "#FFE1A6";
      sparkPath(ctx, cx + r * 0.46, cy - r * 0.46, r * 0.34);
      ctx.fill();
      break;
    }
    case "bomb": {
      // 泡泡串:三颗由小到大的泡泡
      const spots: [number, number, number][] = [
        [cx - r * 0.42, cy + r * 0.4, r * 0.28],
        [cx + r * 0.18, cy + r * 0.05, r * 0.4],
        [cx + r * 0.42, cy - r * 0.55, r * 0.22],
      ];
      for (const [px, py, pr] of spots) {
        ctx.fillStyle = BB_COLORS.bbBubble;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        strokeOutline(ctx, BB_COLORS.bbBubble, 1.5);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(px - pr * 0.3, py - pr * 0.3, pr * 0.26, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "speed":
    case "kick": {
      // 小靴(踢泡再加两道风):靴筒 + 靴头
      const boot = kind === "speed" ? "#F49BB5" : "#8FB9F2";
      ctx.fillStyle = boot;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.34, cy - r * 0.7);
      ctx.lineTo(cx + r * 0.14, cy - r * 0.7);
      ctx.lineTo(cx + r * 0.14, cy + r * 0.16);
      ctx.lineTo(cx + r * 0.66, cy + r * 0.32);
      ctx.quadraticCurveTo(cx + r * 0.74, cy + r * 0.66, cx + r * 0.4, cy + r * 0.66);
      ctx.lineTo(cx - r * 0.34, cy + r * 0.66);
      ctx.closePath();
      ctx.fill();
      strokeOutline(ctx, boot, 1.5);
      ctx.fillStyle = "#fff";
      ctx.fillRect(cx - r * 0.34, cy + r * 0.44, r, r * 0.14);
      if (kind === "kick") {
        ctx.strokeStyle = shade(boot, -25);
        ctx.lineWidth = 1.5;
        for (const k of [0, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.9, cy - r * 0.3 + k * r * 0.3);
          ctx.lineTo(cx - r * 0.5, cy - r * 0.3 + k * r * 0.3);
          ctx.stroke();
        }
      }
      break;
    }
    case "ghost": {
      // 穿泡小精灵:圆顶 + 波浪裙边
      ctx.fillStyle = "#D9CBF5";
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.12, r * 0.56, Math.PI, 0);
      ctx.lineTo(cx + r * 0.56, cy + r * 0.5);
      for (let k = 2; k >= 0; k--) {
        const wx = cx - r * 0.56 + ((k + 0.5) / 3) * r * 1.12;
        ctx.quadraticCurveTo(wx + r * 0.18, cy + r * 0.72, wx, cy + r * 0.5);
        ctx.quadraticCurveTo(wx - r * 0.18, cy + r * 0.3, wx - r * 0.37, cy + r * 0.5);
      }
      ctx.closePath();
      ctx.fill();
      strokeOutline(ctx, "#D9CBF5", 1.5);
      ctx.fillStyle = "#6C5E93";
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cx + k * r * 0.22, cy - r * 0.14, r * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "remote": {
      // 遥控:信号点 + 两圈电波(和遥控泡泡的青色膜同色)
      ctx.fillStyle = "#4FC4B4";
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy + r * 0.34, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#4FC4B4";
      for (const k of [0.42, 0.74]) {
        ctx.lineWidth = Math.max(1.5, r * 0.14);
        ctx.beginPath();
        ctx.arc(cx - r * 0.3, cy + r * 0.34, r * k + r * 0.18, -Math.PI / 2, 0);
        ctx.stroke();
      }
      break;
    }
    case "shield": {
      // 泡泡护盾:圆盾 + 星心
      ctx.fillStyle = "#BFE4FF";
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.6, cy - r * 0.5);
      ctx.quadraticCurveTo(cx, cy - r * 0.74, cx + r * 0.6, cy - r * 0.5);
      ctx.quadraticCurveTo(cx + r * 0.6, cy + r * 0.3, cx, cy + r * 0.72);
      ctx.quadraticCurveTo(cx - r * 0.6, cy + r * 0.3, cx - r * 0.6, cy - r * 0.5);
      ctx.closePath();
      ctx.fill();
      strokeOutline(ctx, "#BFE4FF", 2);
      ctx.fillStyle = "#FFD678";
      starPath(ctx, cx, cy - r * 0.02, r * 0.3);
      ctx.fill();
      break;
    }
  }
}

/** 硬墙铆钉四点(顶面四角) */
export function drawRivets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.fillStyle = color;
  const inset = Math.max(2, w * 0.16);
  const r = Math.max(0.8, w * 0.05);
  for (const [kx, ky] of [
    [inset, inset],
    [w - inset, inset],
    [inset, h - inset],
    [w - inset, h - inset],
  ]) {
    ctx.beginPath();
    ctx.arc(x + kx, y + ky, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 主题墙角饰:花园藤蔓 / 冰原霜花 / 星空星子,画在顶面左上角 */
export function drawWallOrnament(
  ctx: CanvasRenderingContext2D,
  theme: BbTheme,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  const ox = x + size * 0.24;
  const oy = y + size * 0.24;
  const r = size * 0.14;
  ctx.save();
  ctx.globalAlpha = 0.85;
  if (theme === "garden") {
    // 藤蔓:一小段卷须 + 叶点
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size * 0.045);
    ctx.beginPath();
    ctx.moveTo(ox - r, oy + r);
    ctx.quadraticCurveTo(ox + r * 0.4, oy + r * 0.6, ox + r * 0.2, oy - r * 0.4);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(ox + r * 0.55, oy - r * 0.55, r * 0.45, r * 0.28, -0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (theme === "ice") {
    // 霜花:米字三线
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size * 0.04);
    for (const a of [0, Math.PI / 3, (Math.PI * 2) / 3]) {
      ctx.beginPath();
      ctx.moveTo(ox - Math.cos(a) * r, oy - Math.sin(a) * r);
      ctx.lineTo(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
      ctx.stroke();
    }
  } else {
    // 星子:四角小星
    ctx.fillStyle = color;
    sparkPath(ctx, ox, oy, r);
    ctx.fill();
  }
  ctx.restore();
}

/** HUD 倒计时圆环(进度化):frac 是剩余比例,画在小画布上 */
export function drawHudRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  frac: number,
  color: string,
  track = "#EFE7F1"
): void {
  const k = Math.max(0, Math.min(1, frac));
  ctx.save();
  ctx.lineWidth = Math.max(2, r * 0.42);
  ctx.lineCap = "round";
  ctx.strokeStyle = track;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  if (k > 0) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    ctx.stroke();
  }
  ctx.restore();
}

/** 圆环颜色:富余绿 → 过半琥珀 → 紧张红(只影响 HUD,不碰倒计时逻辑) */
export function hudRingColor(frac: number): string {
  if (frac > 0.5) return "#6FBF9A";
  if (frac > 0.25) return "#F2B34C";
  return "#E06A6A";
}

// ---------------------------------------------------------------------------
// BbBoomFx:爆炸涟漪账本(中心白闪 2 帧 + 沿臂推进的花瓣串 + 末端星屑)
// ---------------------------------------------------------------------------

/** 涟漪花瓣的备选色(粉彩花瓣,无火焰色) */
export const RIPPLE_PETAL_COLORS = ["#FFC2DA", "#FFE1AE", "#CDEBD2", "#C9E6FB", "#E3D9FB"] as const;

interface RipplePetalFx {
  /** 格中心(格坐标,画的时候再乘 cell) */
  x: number;
  y: number;
  /** 什么时候轮到这一瓣出现(world.time 口径) */
  start: number;
  life: number;
  color: string;
  reduced: boolean;
}

interface BoomFlashFx {
  x: number;
  y: number;
  frames: number;
}

interface EndSparkFx {
  x: number;
  y: number;
  start: number;
  seed: number;
}

export class BbBoomFx {
  private petals: RipplePetalFx[] = [];
  private flashes: BoomFlashFx[] = [];
  private sparks: EndSparkFx[] = [];
  /** 上一帧每颗炸弹的位置:boom 事件到手时炸弹已经没了,靠它找回炸心 */
  private bombPos = new Map<number, number>();

  /** 每帧(stepWorld 之前)记一次炸弹位置 */
  noteBombs(bombs: readonly Bomb[]): void {
    this.bombPos.clear();
    for (const b of bombs) this.bombPos.set(b.id, b.pos);
  }

  /**
   * 一声「啵」:按连锁波次落账。
   * 每一波:炸心白闪 2 帧;波内每格一瓣,离炸心越远越晚出现(150ms/格);
   * 每条臂的末端撒 3 颗星屑。reduced:涟漪一次性静态显示、星屑不撒、白闪保留。
   */
  noteBoom(board: Board, waves: readonly ChainWave[], now: number, reduced: boolean): void {
    for (const wave of waves) {
      const centers = wave.ids
        .map((id) => this.bombPos.get(id))
        .filter((p): p is number => p !== undefined);
      if (centers.length === 0 && wave.cells.length > 0) centers.push(wave.cells[0]);
      const at = now + wave.delay;
      for (const center of centers) {
        this.flashes.push({ x: xOf(board, center) + 0.5, y: yOf(board, center) + 0.5, frames: BOOM_FLASH_FRAMES });
      }
      for (const cell of wave.cells) {
        let dist = Infinity;
        for (const center of centers) {
          const d =
            Math.abs(xOf(board, cell) - xOf(board, center)) + Math.abs(yOf(board, cell) - yOf(board, center));
          if (d < dist) dist = d;
        }
        if (!Number.isFinite(dist)) dist = 0;
        this.petals.push({
          x: xOf(board, cell) + 0.5,
          y: yOf(board, cell) + 0.5,
          start: at + rippleDelayMs(dist, reduced),
          life: reduced ? RIPPLE_REDUCED_HOLD_MS : RIPPLE_STEP_MS,
          color: RIPPLE_PETAL_COLORS[cell % RIPPLE_PETAL_COLORS.length],
          reduced,
        });
      }
      if (!reduced) {
        // 每条臂的末端:从每个炸心出发,四个方向各找最远的同线格
        for (const center of centers) {
          const cx = xOf(board, center);
          const cy = yOf(board, center);
          for (const dir of DIRS) {
            let best = -1;
            let bestD = 0;
            for (const cell of wave.cells) {
              const dx = xOf(board, cell) - cx;
              const dy = yOf(board, cell) - cy;
              if (dir.dx !== 0 ? dy !== 0 || Math.sign(dx) !== dir.dx : dx !== 0 || Math.sign(dy) !== dir.dy) continue;
              const d = Math.abs(dx) + Math.abs(dy);
              if (d > bestD) {
                bestD = d;
                best = cell;
              }
            }
            if (best >= 0 && bestD > 0) {
              this.sparks.push({
                x: xOf(board, best) + 0.5,
                y: yOf(board, best) + 0.5,
                start: at + rippleDelayMs(bestD, false),
                seed: (best * 31 + bestD) % 97,
              });
            }
          }
        }
      }
    }
  }

  /** 每帧推进一次:过期的账目划掉,白闪帧数递减 */
  step(now: number): void {
    this.petals = this.petals.filter((p) => now <= p.start + p.life);
    this.sparks = this.sparks.filter((s) => now <= s.start + RIPPLE_SPARK_MS);
    for (const f of this.flashes) f.frames--;
    this.flashes = this.flashes.filter((f) => f.frames > 0);
  }

  /** 画在角色之上(图层序第 ⑦ 层) */
  draw(ctx: CanvasRenderingContext2D, cellPx: number, now: number): void {
    for (const f of this.flashes) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(f.x * cellPx, f.y * cellPx, cellPx * 0.58, 0, Math.PI * 2);
      ctx.fill();
      sparkPath(ctx, f.x * cellPx, f.y * cellPx, cellPx * 0.85);
      ctx.fill();
      ctx.restore();
    }
    for (const p of this.petals) {
      if (now < p.start) continue;
      const age = Math.max(0, Math.min(1, (now - p.start) / p.life));
      const alpha = p.reduced ? 0.85 : 1 - easeOutQuad(age);
      drawRipplePetal(ctx, p.x * cellPx, p.y * cellPx, cellPx * 0.42, p.color, alpha);
    }
    for (const s of this.sparks) {
      if (now < s.start) continue;
      const age = Math.max(0, Math.min(1, (now - s.start) / RIPPLE_SPARK_MS));
      ctx.save();
      ctx.globalAlpha = 1 - easeOutQuad(age);
      ctx.fillStyle = "#FFD678";
      for (let k = 0; k < RIPPLE_END_SPARKS; k++) {
        const a = ((s.seed + k * 33) % 360) * (Math.PI / 180);
        const d = cellPx * (0.2 + 0.28 * age);
        sparkPath(ctx, s.x * cellPx + Math.cos(a) * d, s.y * cellPx + Math.sin(a) * d, cellPx * 0.1);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** 账上还挂着多少条(测试与 destroy 复查用) */
  get pending(): number {
    return this.petals.length + this.flashes.length + this.sparks.length;
  }

  /** 每一瓣的出现时刻(绝对毫秒,升序)——测试对「150ms/格推进」的账 */
  petalStarts(): number[] {
    return this.petals.map((p) => p.start).sort((a, b) => a - b);
  }

  /** 臂端星屑条目数(一条画 3 颗) */
  sparkCount(): number {
    return this.sparks.length;
  }

  /** 中心白闪条目数 */
  flashCount(): number {
    return this.flashes.length;
  }

  /** destroy:一笔不剩 */
  reset(): void {
    this.petals.length = 0;
    this.flashes.length = 0;
    this.sparks.length = 0;
    this.bombPos.clear();
  }
}

// ---------------------------------------------------------------------------
// BbFighterFx:埋弹下蹲窗口(谁的在场炸弹数涨了,谁就蹲 SQUAT_MS)
// ---------------------------------------------------------------------------

export class BbFighterFx {
  private counts: number[] = [];
  private squatUntil: number[] = [];

  update(bombs: readonly Bomb[], seats: number, now: number): void {
    const next: number[] = new Array(seats).fill(0);
    for (const b of bombs) {
      if (b.owner >= 0 && b.owner < seats) next[b.owner]++;
    }
    for (let i = 0; i < seats; i++) {
      if (next[i] > (this.counts[i] ?? 0)) this.squatUntil[i] = now + SQUAT_MS;
      this.counts[i] = next[i];
    }
  }

  squatting(seat: number, now: number): boolean {
    return now < (this.squatUntil[seat] ?? 0);
  }

  /** 账上还有没有没到期的下蹲计时(destroy 复查用) */
  pendingAt(now: number): number {
    return this.squatUntil.filter((t) => now < t).length;
  }

  reset(): void {
    this.counts.length = 0;
    this.squatUntil.length = 0;
  }
}
