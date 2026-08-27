/**
 * 噗噗兄弟 · 1.3 视觉模块(只管画,不碰玩法)。
 *
 * 这里住着四样东西:
 *   1. 配色板(四·补一)与图层序、动效时序表(四·补三)—— 数值全部写死成常量,
 *      测试逐个对表,谁改了立刻红;
 *   2. 兄弟共用骨架 `broBody`:一套工序、两套参数 —— 哥哥朵朵(翘呆毛 / 背带裤 /
 *      圆耳朵)、弟弟星星(圆边小帽 / 围兜波浪边 / 后脑揪揪),「长幼」从形状来,
 *      不是只从颜色来;16px 灰度下三通道剪影仍可分辨;
 *   3. 纯函数相位:呆毛回摆、攒气环星尘、软云视差、击掌帧、嘴部三态映射、
 *      弹簧螺旋圈、气流羽毛 —— 全部「毫秒 + reduced」进、数值出,不持有状态;
 *   4. 画笔函数 `paintBro` / `paintPuffRing` / `paintHighFive`:只接受传进来的
 *      2d 画笔,不摸 DOM,也**不调用 `ctx.scale`**(reduced 下「零 scale」被
 *      runtime12 用例钉着,形变三件套的 scale 只住在 index.ts 的 motion 分支里)。
 *
 * 玩法红线:`PUFF_WINDUP` 前摇、判定盒 `PLAYER_W × PLAYER_H`、`blowCd` 的
 * 0.24 吹泡窗口、形变三件套(feel / push / bounds)在这里**只读不写**。
 */

import { shade, withAlpha } from "../../art/kit/palette";
import { ballGradient, softShadow } from "../../art/kit/volume";
import { strokeOutline } from "../../art/kit/outline";
import { easeOutQuad } from "../../art/kit/sparkle";
import { RAINBOW, bubbleFilm, bubbleGloss } from "../../art/kit/bubbleSkin";
import { BLOW_CD, PLAYER_H, PLAYER_W } from "./logic";

// ---------------------------------------------------------------------------
// 四·补一 配色板(token 一个不许飘)
// ---------------------------------------------------------------------------

export const PB_COLORS = {
  /** 哥哥身体渐变主色(顶光 +22%,见 PB_BRO_TOP_LIGHT) */
  pbBroA: "#F9B97F",
  /** 弟弟身体主色(更浅一档) */
  pbBroB: "#FBD3A5",
  /** 两人肚皮浅色域 */
  pbBelly: "#FFF3E2",
  /** 泡泡薄膜主体 */
  pbBubble: "rgba(190,230,255,.55)",
  /** 三套关卡天空:晨 / 昼 / 暮 */
  pbSkyMorn: "#FFE9F0",
  pbSkyDay: "#E3F3FF",
  pbSkyDusk: "#FFE3C9",
  /** 全场统一落影 */
  pbShadow: "rgba(120,90,60,.16)",
} as const;

/** 哥哥身体三停渐变的顶光档位(规格四·补一:+22%) */
export const PB_BRO_TOP_LIGHT = 22;
/** 身体渐变的背光档位(不在对表里,跟全库 -15 一个路子但更柔) */
export const PB_BRO_DARK = -14;
/** 裹住东西的泡泡薄膜色(粉一档,和空泡的 pbBubble 一眼分得开) */
export const PB_BUBBLE_HOLD = "rgba(255,196,224,.6)";

/**
 * 图层序(render 从底到顶)。攒气环是功能件,永远画在角色上层;
 * HUD 是 DOM,排在最后一格只是把约定写全。
 */
export const PB_LAYERS = [
  "sky",
  "clouds",
  "platforms",
  "gadgets",
  "bubbles",
  "bros",
  "ring",
  "hud",
] as const;

// ---------------------------------------------------------------------------
// 四·补三 动效时序表(毫秒写死,测试引用)
// ---------------------------------------------------------------------------

/** 呆毛 / 揪揪回摆一趟的时长(easeOutQuad);reduced 静止 */
export const SWAY_MS = 320;
/** 回摆最大摆角(弧度) */
export const SWAY_AMP = 0.34;
/** 攒气环星尘:3 颗,500ms 循环(linear);reduced 只留渐变描边 */
export const RING_SPARK_COUNT = 3;
export const RING_SPARK_MS = 500;
/** 软云视差两层滚速倍率(0.15× / 0.3×);reduced 静止 */
export const CLOUD_FACTORS = [0.15, 0.3] as const;
/** 软云视差的基准速度(px/s) */
export const CLOUD_BASE_SPEED = 40;
/** 击掌动画:2 帧、每帧 360ms(step);reduced 静止合影 */
export const HIGH_FIVE_FRAME_MS = 360;
export const HIGH_FIVE_FRAMES = 2;
/**
 * 吹泡窗口阈值:`blowCd > 0.24` 里嘴边有泡(1.2 原值,**只读**)。
 * 时序仍由 `blowCd` 说了算,这里只把白圆升级成「腮帮鼓起 + 泡泡长大」两层。
 */
export const PB_BLOW_BUBBLE_MIN = 0.24;

// ---------------------------------------------------------------------------
// 天空轮换与软云视差
// ---------------------------------------------------------------------------

/** 三套天空按「晨 → 昼 → 暮」排好,按关卡序号轮换 */
export const PB_SKIES = [PB_COLORS.pbSkyMorn, PB_COLORS.pbSkyDay, PB_COLORS.pbSkyDusk] as const;

/** 第 index 关(0 基)用哪套天空:index % 3 → 晨 / 昼 / 暮 */
export function skyForLevel(index: number): string {
  const i = ((Math.round(index) % PB_SKIES.length) + PB_SKIES.length) % PB_SKIES.length;
  return PB_SKIES[i];
}

/**
 * 软云这一帧滚到哪儿(px,0 ≤ 结果 < span)。
 * 纯粹由「已过秒数」推出来,不持有状态 —— destroy 没有东西要清。
 * reduced 恒 0:云定在原位,静态层次保留。
 */
export function cloudScroll(layer: 0 | 1, tSec: number, span: number, reduced: boolean): number {
  if (reduced || span <= 0) return 0;
  const v = CLOUD_BASE_SPEED * CLOUD_FACTORS[layer];
  return ((tSec * v) % span + span) % span;
}

// ---------------------------------------------------------------------------
// 相位纯函数
// ---------------------------------------------------------------------------

/**
 * 呆毛 / 揪揪的摆角(弧度):移动时 320ms 摆出去再回来(easeOutQuad),
 * 静止或 reduced 一律 0。
 */
export function swayAngle(ms: number, moving: boolean, reduced: boolean): number {
  if (reduced || !moving) return 0;
  const k = (((ms % SWAY_MS) + SWAY_MS) % SWAY_MS) / SWAY_MS;
  const t = k < 0.5 ? easeOutQuad(k * 2) : easeOutQuad(2 - k * 2);
  return (t * 2 - 1) * SWAY_AMP;
}

/** 攒气环里画几颗星尘:reduced 一颗不画,只留渐变描边 */
export function ringSparkCount(reduced: boolean): number {
  return reduced ? 0 : RING_SPARK_COUNT;
}

/** 第 i 颗星尘这一毫秒转到哪个角(500ms 一圈,linear,三颗均分) */
export function ringSparkAngle(i: number, ms: number): number {
  const k = (((ms % RING_SPARK_MS) + RING_SPARK_MS) % RING_SPARK_MS) / RING_SPARK_MS;
  return k * Math.PI * 2 + (i / RING_SPARK_COUNT) * Math.PI * 2;
}

/**
 * 击掌动画这一毫秒在第几帧(0 = 举手靠近,1 = 手掌相击)。
 * step 缓动:整帧切换不插值;reduced 定在相击那一帧当「静止合影」。
 */
export function highFiveFrame(msSinceWin: number, reduced: boolean): number {
  if (reduced) return HIGH_FIVE_FRAMES - 1;
  return Math.floor(Math.max(0, msSinceWin) / HIGH_FIVE_FRAME_MS) % HIGH_FIVE_FRAMES;
}

/**
 * 击掌只在**过关**分支画:世界状态是 won 且过关时间戳已经记下。
 * 失败(只鼓励)、打转飘回、进行中,都轮不到它。
 */
export function shouldHighFive(status: string, wonAtMs: number): boolean {
  return status === "won" && wonAtMs >= 0;
}

/** #RRGGBB 的严格反色(传送门双色旋涡「互为反色」用) */
export function invertHex(hex: string): string {
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return "#808080";
  let out = "#";
  for (let i = 0; i < 6; i += 2) {
    out += (255 - Number.parseInt(full.slice(i, i + 2), 16)).toString(16).padStart(2, "0");
  }
  return out;
}

/** 传送门旋涡双色:A 是既有的泡泡蓝,B 与它互为反色 */
export const PB_WARP_A = "#8FBEF5";
export const PB_WARP_B = invertHex(PB_WARP_A);

/**
 * 弹簧螺旋圈的各圈圆心 y:圈数固定、从底座往上排,总高随压缩缩短,
 * 于是**圈距自动变密**(弹簧是往底座方向压的)。
 * `squash` 是渲染层从 `gs.recharge / SPRING_RECHARGE` 读出的既有压缩量(0..0.4)。
 */
export const SPRING_COILS = 4;

export function springCoilYs(yBase: number, h: number, squash: number): number[] {
  const hh = h * (1 - Math.max(0, Math.min(0.9, squash)));
  const out: number[] = [];
  for (let i = 1; i <= SPRING_COILS; i++) out.push(yBase - (hh * i) / (SPRING_COILS + 1));
  return out;
}

/** 气流管里第 i 片羽毛这一秒的位置与姿态(0..1 归一;t=0 即 reduced 的静止排布) */
export function updraftFeather(
  i: number,
  tSec: number,
  riseSpeed: number
): { y01: number; x01: number; rot: number } {
  const phase = (((tSec * riseSpeed + i * 0.25) % 1) + 1) % 1;
  return {
    y01: phase,
    // 左右交替 + 随上升轻轻摆到另一侧,拼出「旋涡」的走位
    x01: 0.5 + (i % 2 === 0 ? 1 : -1) * 0.22 * Math.cos(phase * Math.PI * 2),
    rot: phase * Math.PI * 2 + i * 1.7,
  };
}

// ---------------------------------------------------------------------------
// 嘴部三态(时序读 blowCd / windupProgress,阈值原样)
// ---------------------------------------------------------------------------

export type MouthState =
  | { kind: "idle" }
  | { kind: "windup"; k: number }
  | { kind: "blow"; k: number };

/**
 * 由 1.2 的原始输入(`blowCd`、攒气进度、是否在攒)映射出嘴部三态。
 * 分支顺序与 1.2 完全一致:吹泡窗口(blowCd > 0.24)优先,其次攒气,否则常态。
 * `blow.k` 是 0..1 的「泡泡长大」进度:刚吹出去是 0,窗口收尾长到 1。
 */
export function mouthState(blowCd: number, windupK: number, pending: boolean): MouthState {
  if (blowCd > PB_BLOW_BUBBLE_MIN) {
    const span = BLOW_CD - PB_BLOW_BUBBLE_MIN;
    const k = Math.max(0, Math.min(1, (BLOW_CD - blowCd) / span));
    return { kind: "blow", k };
  }
  if (pending) return { kind: "windup", k: Math.max(0, Math.min(1, windupK)) };
  return { kind: "idle" };
}

// ---------------------------------------------------------------------------
// 兄弟共用骨架:一套工序、两套参数(四·补二)
// ---------------------------------------------------------------------------

export interface BroKit {
  name: string;
  /** 身体主色(渐变基色) */
  body: string;
  /** 服饰(背带裤 / 围兜 / 帽子)主色 —— 保住朵朵粉、星星蓝的阵营归属 */
  accent: string;
  eye: string;
  /** 识别件一:crest 翘呆毛 / cap 圆边小帽 */
  headgear: "crest" | "cap";
  /** 识别件二:overalls 背带裤 / bib 围兜(半圆波浪边) */
  outfit: "overalls" | "bib";
  /** 识别件三:ears 圆耳朵一对 / tuft 后脑揪揪 */
  sidekick: "ears" | "tuft";
  /** 表情参数:哥哥眼稍小眉平,弟弟眼圆腮红大 */
  eyeR: number;
  browFlat: boolean;
  blushR: number;
}

export const BRO_KITS: readonly [BroKit, BroKit] = [
  {
    name: "朵朵",
    body: PB_COLORS.pbBroA,
    accent: "#EF7FA6",
    eye: "#5A3350",
    headgear: "crest",
    outfit: "overalls",
    sidekick: "ears",
    eyeR: 2.3,
    browFlat: true,
    blushR: 2.2,
  },
  {
    name: "星星",
    body: PB_COLORS.pbBroB,
    accent: "#7FB2F0",
    eye: "#2F4A73",
    headgear: "cap",
    outfit: "bib",
    sidekick: "tuft",
    eyeR: 2.9,
    browFlat: false,
    blushR: 3.4,
  },
] as const;

export interface BroGeom {
  kit: BroKit;
  w: number;
  h: number;
  /** 落影:0.8×PLAYER_W 宽、0.2 高比 */
  shadow: { rx: number; ry: number };
  body: { cy: number; rx: number; ry: number };
  belly: { cy: number; rx: number; ry: number };
  /**
   * 剪影抽样点(相对脚底原点,12 点)。
   * 前 8 点分别落在三个识别件与服饰上 —— 两套参数逐点可辨;
   * 后 4 点是共用身体椭圆的四象限,负责「同一副骨架」。
   */
  silhouette: Array<{ x: number; y: number }>;
}

/**
 * 兄弟骨架:同一副身体(判定盒 `PLAYER_W × PLAYER_H` 之内),
 * 识别件按 `BRO_KITS[pi]` 长出不同的形状。
 */
export function broBody(pi: number, w = PLAYER_W, h = PLAYER_H): BroGeom {
  const kit = BRO_KITS[((pi % 2) + 2) % 2];
  const body = { cy: -h * 0.5, rx: w * 0.52, ry: h * 0.5 };
  const belly = { cy: -h * 0.4, rx: w * 0.3, ry: h * 0.3 };
  const crest = kit.headgear === "crest";
  const ears = kit.sidekick === "ears";
  const overalls = kit.outfit === "overalls";
  const silhouette: Array<{ x: number; y: number }> = [
    // 0 头饰最高点:呆毛翘得高且偏右,帽子的顶球居中略矮
    crest ? { x: w * 0.14, y: -h - 9 } : { x: 0, y: -h - 6.5 },
    // 1 头饰侧沿:呆毛尖 vs 帽檐边
    crest ? { x: w * 0.3, y: -h - 4 } : { x: w * 0.4, y: -h * 0.96 },
    // 2/3 头侧:耳朵往外撑,揪揪只在后脑一个包
    ears ? { x: -w * 0.62, y: -h * 0.92 } : { x: -w * 0.52, y: -h * 0.86 },
    ears ? { x: w * 0.62, y: -h * 0.92 } : { x: w * 0.5, y: -h * 0.8 },
    // 4 后脑识别件:揪揪的小球 vs 耳根
    ears ? { x: -w * 0.5, y: -h * 0.82 } : { x: -w * 0.66, y: -h * 0.78 },
    // 5/6 腰线:背带扣位 vs 围兜波浪边缘
    overalls ? { x: -w * 0.34, y: -h * 0.3 } : { x: -w * 0.28, y: -h * 0.24 },
    overalls ? { x: w * 0.34, y: -h * 0.3 } : { x: w * 0.28, y: -h * 0.24 },
    // 7 前身:背带裤前袋下沿 vs 围兜圆弧下摆
    overalls ? { x: 0, y: -h * 0.16 } : { x: 0, y: -h * 0.1 },
    // 8-11 共用身体四象限
    { x: body.rx, y: body.cy },
    { x: -body.rx, y: body.cy },
    { x: 0, y: body.cy - body.ry },
    { x: 0, y: body.cy + body.ry },
  ];
  return {
    kit,
    w,
    h,
    shadow: { rx: w * 0.4, ry: w * 0.4 * 0.2 * 2 },
    body,
    belly,
    silhouette,
  };
}

// ---------------------------------------------------------------------------
// 画笔:paintBro(不含形变 —— 形变三件套由 index.ts 的 motion 分支负责)
// ---------------------------------------------------------------------------

export interface BroPose {
  facing: 1 | -1;
  /** 呆毛 / 揪揪摆角(swayAngle 的输出;reduced 已经是 0) */
  sway: number;
  mouth: MouthState;
  /** 打转中不画落影(人已经离场了) */
  grounded: boolean;
}

function paintHeadgear(ctx: CanvasRenderingContext2D, g: BroGeom, pose: BroPose): void {
  const { kit, w, h } = g;
  if (kit.headgear === "crest") {
    // 翘呆毛:三段贝塞尔,尖端随 sway 轻摆
    const bx = 0;
    const by = -h * 0.98;
    const tip = pose.sway * 8;
    ctx.fillStyle = shade(kit.body, -6);
    ctx.beginPath();
    ctx.moveTo(bx - 3, by + 2);
    ctx.bezierCurveTo(bx - 4, by - 5, bx - 1, by - 8, bx + 1 + tip * 0.4, by - 9);
    ctx.bezierCurveTo(bx + 3 + tip * 0.7, by - 10, bx + 5 + tip, by - 8, bx + w * 0.14 + tip, by - 6.5);
    ctx.bezierCurveTo(bx + 4 + tip * 0.5, by - 5.5, bx + 3.5, by - 2, bx + 3, by + 2);
    ctx.closePath();
    ctx.fill();
    strokeOutline(ctx, kit.body, 1.5);
    return;
  }
  // 圆边小帽:帽檐 + 圆顶 + 顶球
  ctx.fillStyle = kit.accent;
  ctx.beginPath();
  ctx.arc(0, -h * 0.94, w * 0.28, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  strokeOutline(ctx, kit.accent, 1.5);
  ctx.fillStyle = shade(kit.accent, 18);
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.94, w * 0.4, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeOutline(ctx, kit.accent, 1.5);
  ctx.fillStyle = shade(kit.accent, 35);
  ctx.beginPath();
  ctx.arc(0, -h - 6.5 + 2, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

function paintOutfit(ctx: CanvasRenderingContext2D, g: BroGeom): void {
  const { kit, w, h } = g;
  if (kit.outfit === "overalls") {
    // 背带裤:两条肩带 + 前袋方块
    ctx.fillStyle = kit.accent;
    ctx.fillRect(-w * 0.26, -h * 0.6, 3.4, h * 0.32);
    ctx.fillRect(w * 0.26 - 3.4, -h * 0.6, 3.4, h * 0.32);
    const pw = w * 0.3;
    const ph = h * 0.15;
    ctx.fillRect(-pw / 2, -h * 0.3, pw, ph);
    ctx.fillStyle = shade(kit.accent, 30);
    ctx.fillRect(-pw / 2, -h * 0.3, pw, 2);
    return;
  }
  // 围兜:半圆兜面 + 下摆三瓣波浪边
  const r = w * 0.28;
  const cy = -h * 0.46;
  ctx.fillStyle = kit.accent;
  ctx.beginPath();
  ctx.arc(0, cy, r, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  strokeOutline(ctx, kit.accent, 1.5);
  ctx.fillStyle = shade(kit.accent, 22);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintSidekick(ctx: CanvasRenderingContext2D, g: BroGeom, pose: BroPose): void {
  const { kit, w, h } = g;
  if (kit.sidekick === "ears") {
    // 圆耳朵一对:体色 + 肚皮色内耳
    for (const side of [-1, 1]) {
      ctx.fillStyle = shade(kit.body, -4);
      ctx.beginPath();
      ctx.arc(side * w * 0.46, -h * 0.92, 4.4, 0, Math.PI * 2);
      ctx.fill();
      strokeOutline(ctx, kit.body, 1.5);
      ctx.fillStyle = PB_COLORS.pbBelly;
      ctx.beginPath();
      ctx.arc(side * w * 0.46, -h * 0.92, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  // 后脑揪揪:背对朝向那一侧的小球,随 sway 轻摆
  const bx = -pose.facing * w * 0.5;
  const by = -h * 0.86 + pose.sway * 3;
  ctx.strokeStyle = shade(kit.body, -18);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-pose.facing * w * 0.38, -h * 0.88);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.fillStyle = shade(kit.body, 8);
  ctx.beginPath();
  ctx.arc(bx, by, 3.6, 0, Math.PI * 2);
  ctx.fill();
  strokeOutline(ctx, kit.body, 1.5);
}

function paintFace(ctx: CanvasRenderingContext2D, g: BroGeom, pose: BroPose): void {
  const { kit, w, h } = g;
  const f = pose.facing;
  // 眼睛(哥哥稍小、弟弟更圆)+ 高光
  ctx.fillStyle = kit.eye;
  ctx.beginPath();
  ctx.arc(f * 3 - 5, -h * 0.66, kit.eyeR, 0, Math.PI * 2);
  ctx.arc(f * 3 + 5, -h * 0.66, kit.eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(f * 3 - 5.8, -h * 0.69, 0.9, 0, Math.PI * 2);
  ctx.arc(f * 3 + 4.2, -h * 0.69, 0.9, 0, Math.PI * 2);
  ctx.fill();
  // 眉毛:哥哥平眉(稳重),弟弟不画眉(圆眼已经够「幼」)
  if (kit.browFlat) {
    ctx.strokeStyle = shade(kit.body, -35);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(f * 3 - 7.2, -h * 0.76);
    ctx.lineTo(f * 3 - 2.8, -h * 0.76);
    ctx.moveTo(f * 3 + 2.8, -h * 0.76);
    ctx.lineTo(f * 3 + 7.2, -h * 0.76);
    ctx.stroke();
  }
  // 腮红(弟弟的更大)
  ctx.fillStyle = "rgba(255,150,180,.55)";
  ctx.beginPath();
  ctx.ellipse(-w * 0.32, -h * 0.5, kit.blushR + 1.2, kit.blushR, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.32, -h * 0.5, kit.blushR + 1.2, kit.blushR, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintMouth(ctx: CanvasRenderingContext2D, g: BroGeom, pose: BroPose): void {
  const { kit, w, h } = g;
  const f = pose.facing;
  const m = pose.mouth;
  if (m.kind === "blow") {
    // 两层:腮帮鼓起(受光的小椭圆贴在嘴侧)+ 泡泡从嘴边长大(薄膜画法,
    // 半径 < 6px 时彩虹缘自动省略,小泡不糊)
    ctx.fillStyle = shade(kit.body, 14);
    ctx.beginPath();
    ctx.ellipse(f * w * 0.3, -h * 0.48, 4.6, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    const r = 4 + m.k * 6;
    const bx = f * w * 0.62;
    const by = -h * 0.5;
    bubbleFilm(ctx, bx, by, r, PB_COLORS.pbBubble);
    bubbleGloss(ctx, bx, by, r, 0);
    return;
  }
  if (m.kind === "windup") {
    // 攒那一口气:嘴越鼓越圆(沿用 1.2 的尺寸曲线)
    ctx.fillStyle = shade(kit.body, -30);
    ctx.beginPath();
    ctx.ellipse(f * 4, -h * 0.46, 3.4 + m.k * 1.6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = kit.eye;
  ctx.beginPath();
  ctx.ellipse(f * 3, -h * 0.46, 2.6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 在「脚底原点」画一位噗噗兄弟(工序单四·补二的 1–8 步)。
 * 调用方负责 translate 与形变三件套;本函数不调用 `ctx.scale`。
 */
export function paintBro(ctx: CanvasRenderingContext2D, g: BroGeom, pose: BroPose): void {
  const { kit, w, h } = g;
  // 1. 落影(0.8×PLAYER_W、0.2 高比,统一 pbShadow)
  if (pose.grounded) {
    softShadow(ctx, 0, -1, g.shadow.rx, g.shadow.ry, 0.16, 1, "rgba(120,90,60,1)");
  }
  // 小脚(留住 1.2 的剪影记忆点)
  ctx.fillStyle = shade(kit.body, -24);
  ctx.beginPath();
  ctx.ellipse(-w * 0.24, -2, w * 0.19, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.24, -2, w * 0.19, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 识别件三(耳朵 / 揪揪)贴着头画,先于身体好被身体压住根部
  paintSidekick(ctx, g, pose);
  // 2. 身体三停渐变 + 1.5px 描边(顶光 +22%,光源左上 45°)
  ctx.fillStyle = ballGradient(ctx, 0, g.body.cy, g.body.ry, kit.body, {
    light: PB_BRO_TOP_LIGHT,
    dark: PB_BRO_DARK,
  });
  ctx.beginPath();
  ctx.ellipse(0, g.body.cy, g.body.rx, g.body.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeOutline(ctx, kit.body, 1.5);
  // 3. 肚皮浅色域(0.6 身宽)
  ctx.fillStyle = PB_COLORS.pbBelly;
  ctx.beginPath();
  ctx.ellipse(0, g.belly.cy, g.belly.rx, g.belly.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // 5. 识别件二:背带裤 / 围兜
  paintOutfit(ctx, g);
  // 4. 识别件一:呆毛 / 小帽
  paintHeadgear(ctx, g, pose);
  // 7. 表情参数化
  paintFace(ctx, g, pose);
  // 8. 嘴部三态
  paintMouth(ctx, g, pose);
}

// ---------------------------------------------------------------------------
// 攒气环:彩虹渐变描边 + 星尘(提示功能不变,reduced 只描边)
// ---------------------------------------------------------------------------

export interface RingBox {
  cx: number;
  cy: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * 攒气环:几何与透明度曲线沿用 1.2(`0.3 + 0.55t`、线宽 `2 + 1.5t`、
 * 半径 `0.35 + 0.65t`),描边换成彩虹渐变;内圈 3 颗星尘 500ms 打转,
 * reduced 只留渐变描边(星尘 0 颗)。
 */
export function paintPuffRing(
  ctx: CanvasRenderingContext2D,
  ring: RingBox,
  t: number,
  timeMs: number,
  reduced: boolean
): void {
  const rx = ((ring.x1 - ring.x0) / 2) * (0.35 + 0.65 * t);
  const ry = ((ring.y1 - ring.y0) / 2) * (0.35 + 0.65 * t);
  ctx.save();
  ctx.globalAlpha = 0.3 + 0.55 * t;
  const grad = ctx.createLinearGradient(ring.x0, ring.cy, ring.x1, ring.cy);
  for (let i = 0; i < RAINBOW.length; i++) {
    grad.addColorStop(i / (RAINBOW.length - 1), RAINBOW[i]);
  }
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2 + t * 1.5;
  ctx.beginPath();
  ctx.ellipse(ring.cx, ring.cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  const sparks = ringSparkCount(reduced);
  ctx.fillStyle = "rgba(255,246,214,.95)";
  for (let i = 0; i < sparks; i++) {
    const a = ringSparkAngle(i, timeMs);
    const sx = ring.cx + Math.cos(a) * rx * 0.55;
    const sy = ring.cy + Math.sin(a) * ry * 0.55;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 2.4);
    ctx.lineTo(sx + 1.4, sy);
    ctx.lineTo(sx, sy + 2.4);
    ctx.lineTo(sx - 1.4, sy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 胜利击掌(两帧 step;reduced 直接给相击帧当静止合影)
// ---------------------------------------------------------------------------

/**
 * 兄弟击掌:frame 0 举手靠近,frame 1 手掌相击 + 星光。
 * 只在过关分支被调用 —— 摔出平台是「打转飘回」,失败面板只有鼓励,都轮不到它。
 */
export function paintHighFive(
  ctx: CanvasRenderingContext2D,
  cx: number,
  feetY: number,
  frame: number
): void {
  const hit = frame >= 1;
  const gap = hit ? 17 : 24;
  const lift = hit ? 6 : 0;
  const pair: Array<{ geom: BroGeom; facing: 1 | -1 }> = [
    { geom: broBody(0), facing: 1 },
    { geom: broBody(1), facing: -1 },
  ];
  for (let i = 0; i < pair.length; i++) {
    const side = i === 0 ? -1 : 1;
    const { geom, facing } = pair[i];
    ctx.save();
    ctx.translate(cx + side * gap, feetY - (hit ? lift : 0));
    paintBro(ctx, geom, { facing, sway: 0, mouth: { kind: "idle" }, grounded: !hit });
    // 举起的手臂:从肩头伸向中线
    ctx.strokeStyle = shade(geom.kit.body, -18);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(facing * geom.w * 0.4, -geom.h * 0.55);
    ctx.quadraticCurveTo(
      facing * geom.w * (hit ? 0.72 : 0.6),
      -geom.h * (hit ? 0.86 : 0.7),
      facing * (gap - 2),
      -geom.h * (hit ? 0.98 : 0.78)
    );
    ctx.stroke();
    ctx.restore();
  }
  if (hit) {
    // 相击那一帧:中点绽一颗小星
    ctx.save();
    ctx.fillStyle = "rgba(255,214,120,.95)";
    const sy = feetY - PLAYER_H * 1.04;
    ctx.beginPath();
    ctx.moveTo(cx, sy - 5);
    ctx.lineTo(cx + 2, sy - 1);
    ctx.lineTo(cx + 6, sy);
    ctx.lineTo(cx + 2, sy + 1);
    ctx.lineTo(cx, sy + 5);
    ctx.lineTo(cx - 2, sy + 1);
    ctx.lineTo(cx - 6, sy);
    ctx.lineTo(cx - 2, sy - 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// 软云(两层视差,每层都是三瓣椭圆的糖云)
// ---------------------------------------------------------------------------

/** 画一朵软云(三瓣椭圆),tint 直接当 fillStyle 用 */
export function paintCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  tint: string
): void {
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.ellipse(x - s * 0.8, y + s * 0.16, s * 0.7, s * 0.4, 0, 0, Math.PI * 2);
  ctx.ellipse(x, y, s, s * 0.52, 0, 0, Math.PI * 2);
  ctx.ellipse(x + s * 0.85, y + s * 0.18, s * 0.66, s * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** 天空上的柔和云影色(按天空色加深一点点,不喧宾) */
export function cloudTint(skyTone: string, layer: 0 | 1): string {
  return withAlpha(shade(skyTone, layer === 0 ? -10 : -18), layer === 0 ? 0.5 : 0.42);
}
