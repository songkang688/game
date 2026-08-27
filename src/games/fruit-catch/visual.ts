/**
 * 接住小水果 · 1.3 视觉层（第 20 步 A 档）。
 *
 * 本文件只有「皮肤」：配色板、动效时序、三层场景、编织藤篮、自绘道具、
 * 星屑 / 彩虹 / 飘分 / 落空弹地的粒子池。判定数值（篮口宽度、判定线、
 * 生成表、道具效果）一个都不在这里，也一个都不许改。
 *
 * 光源统一左上 45°；reduced-motion 下旋转 / 云移 / 彩虹 / 回弹全停，
 * 只保留静态层次与红圈警告（功能件）。
 */
import {
  FRUIT_MAIN,
  drawKitFruit,
  shade,
  type FruitKitKind
} from "../../art/kit/fruit";
import type { FruitKind } from "./logic";

// ---------------------------------------------------------------------------
// 一、视觉常量块（step 文档 四·补一 / 四·补三，测试逐字核对）
// ---------------------------------------------------------------------------

/** 配色板 token（与 plan-1.3-step20-A 四·补一逐字一致） */
export const FC_COLORS = {
  fcSkyDay: "#DFF2FF",
  fcSkyNight: "#2E2A55",
  fcGrass: "#B8E39B",
  fcBranch: "#A87B4F",
  fcBasket: "#C89B6C",
  fcApple: "#F06B6B",
  fcBanana: "#F5D442",
  fcGrape: "#9F7AD8",
  fcCloudGray: "#B9BEC9",
  fcShadow: "rgba(90,74,60,.16)"
} as const;

/** 动效时序（plan-1.3-step20-A 四·补三，毫秒写死并被测试引用） */
export const FC_TIMING = {
  /** 果子慢旋：±8°、1600ms 周期，reduced 停转 */
  spinDeg: 8,
  spinPeriodMs: 1600,
  /** 篮身压扁回弹：8%、120ms（沿用 press 变量），reduced 一帧切换（为 0） */
  pressSquash: 0.08,
  pressMs: 120,
  /** 接住星屑：4 颗 280ms，reduced 不生成 */
  sparkCount: 4,
  sparkMs: 280,
  /** 连接 5 个不落地：篮上方小彩虹 300ms 一闪，reduced 关闭 */
  rainbowMs: 300,
  /** 落空弹地渐隐 240ms，reduced 直接渐隐（不弹跳） */
  missFadeMs: 240,
  /** 程序云缓移 0.1× / 0.18×，reduced 静止 */
  cloudSpeedA: 0.1,
  cloudSpeedB: 0.18
} as const;

/** draw 的图层序（从底到顶），index.ts 按这个顺序落笔 */
export const FC_LAYERS = [
  "sky",
  "clouds",
  "branch",
  "items",
  "basket",
  "fx",
  "warnRing",
  "hud"
] as const;

/** 接住时篮子往下压几像素（沿用 1.2 的 press 数值） */
export const FC_PRESS_PX = 3;
/** 篮内裁剪层最多摆几个最近接住的小果子 */
export const FC_BASKET_SHOW_MAX = 3;
/** 程序云缓移的基准速度（像素/秒），乘 cloudSpeedA/B 得到每朵的速度 */
export const FC_CLOUD_BASE_PXPS = 60;

// ---------------------------------------------------------------------------
// 二、纯映射：昼夜、emoji → 剪影种类 / 皮色
// ---------------------------------------------------------------------------

/** 昼夜只跟关卡主题号映射，不新增任何状态存储（5=夜晚萤火，9=连击星光坡） */
export function fcIsNight(theme: number): boolean {
  return theme === 5 || theme === 9;
}

/** 主题 emoji → 六剪影之一（只换皮不换骨：themeEmoji 的摇法一个字没动） */
const KIND_OF: Readonly<Record<string, FruitKitKind>> = {
  "🍎": "apple", "🍏": "apple", "🍑": "apple", "🍒": "grape", "🏮": "apple",
  "🍌": "banana", "🍬": "banana",
  "🍇": "grape", "🫐": "grape", "🍡": "grape",
  "🍊": "orange", "🍋": "orange", "🥭": "orange", "🍍": "orange", "🥮": "orange",
  "🍯": "orange", "🧁": "strawberry", "🍪": "orange", "🍭": "orange",
  "🍓": "strawberry",
  "🍐": "pear", "🥝": "pear", "🍈": "pear",
  "🍉": "orange", "🎃": "orange", "🥥": "orange"
};

/** 主题 emoji → 皮色覆盖（不在表里的用剪影默认主色） */
const COLOR_OF: Readonly<Record<string, string>> = {
  "🍏": "#9ED77B", "🍑": "#F7AC9B", "🍒": "#E05A70", "🏮": "#E85B5B",
  "🍋": "#F2DC5C", "🥭": "#F5B04C", "🍍": "#E8C24E", "🥮": "#D9A254",
  "🍯": "#EFB94F", "🧁": "#F2A6C4", "🍪": "#D3A05C", "🍭": "#EF8FB8",
  "🫐": "#7A8FD8", "🥝": "#A8C25C", "🍈": "#CDE3A4", "🍬": "#F2A6C4",
  "🍡": "#EFB6C8",
  "🍉": "#74C46A", "🎃": "#F0913F", "🥥": "#9C6F48"
};

export function fruitKindOf(emoji: string): FruitKitKind {
  const hit = KIND_OF[emoji];
  if (hit) return hit;
  // 没登记的图形按码位稳定散列到六种之一，保证同款永远同剪影
  let acc = 0;
  for (let i = 0; i < emoji.length; i++) acc = (acc * 31 + emoji.charCodeAt(i)) >>> 0;
  const kinds: FruitKitKind[] = ["apple", "banana", "grape", "orange", "strawberry", "pear"];
  return kinds[acc % kinds.length];
}

export function fruitColorOf(emoji: string): string | undefined {
  return COLOR_OF[emoji];
}

// ---------------------------------------------------------------------------
// 三、纯函数动效：慢旋 / 云移 / 压扁（reduced 一律回 0 / 回基准位）
// ---------------------------------------------------------------------------

/** 下落慢旋角（弧度）：±8°、1600ms 周期；reduced 恒为 0 */
export function fcSpinAngle(tSec: number, phase: number, reduced: boolean): number {
  if (reduced || !Number.isFinite(tSec)) return 0;
  const omega = (Math.PI * 2 * 1000) / FC_TIMING.spinPeriodMs;
  return Math.sin(tSec * omega + phase) * ((FC_TIMING.spinDeg * Math.PI) / 180);
}

/** 程序云横坐标：0.1× / 0.18× 基准速度缓移；reduced 停在基准位 */
export function fcCloudX(tSec: number, lane: 0 | 1, w: number, reduced: boolean): number {
  const base = lane === 0 ? w * 0.24 : w * 0.66;
  if (reduced || !Number.isFinite(tSec)) return base;
  const speed = (lane === 0 ? FC_TIMING.cloudSpeedA : FC_TIMING.cloudSpeedB) * FC_CLOUD_BASE_PXPS;
  const span = w + 120;
  return ((base + 60 + tSec * speed) % span + span) % span - 60;
}

/** 篮身压扁比例（0..pressSquash）：沿用 press 变量；reduced 一帧切换（恒 0） */
export function fcBasketSquash(press: number, reduced: boolean): number {
  if (reduced || !Number.isFinite(press)) return 0;
  return Math.max(0, Math.min(1, press / FC_PRESS_PX)) * FC_TIMING.pressSquash;
}

/** 篮内裁剪层实际摆出来的小果子：只取最近 FC_BASKET_SHOW_MAX 个 */
export function fcBasketShown(recent: readonly FruitKitKind[]): FruitKitKind[] {
  return recent.slice(-FC_BASKET_SHOW_MAX);
}

// ---------------------------------------------------------------------------
// 四、三层场景：远层天空日月 → 中层程序云 → 近层果树枝 + 草地
// ---------------------------------------------------------------------------

export interface FcSceneOpts {
  w: number;
  h: number;
  theme: number;
  /** 关卡时钟（秒），驱动云移 */
  t: number;
  reduced: boolean;
}

function puffyCloud(c2d: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  c2d.fillStyle = color;
  c2d.beginPath();
  c2d.arc(x - s * 0.8, y, s * 0.55, 0, Math.PI * 2);
  c2d.arc(x, y - s * 0.28, s * 0.7, 0, Math.PI * 2);
  c2d.arc(x + s * 0.8, y, s * 0.55, 0, Math.PI * 2);
  c2d.ellipse(x, y + s * 0.18, s * 1.25, s * 0.42, 0, 0, Math.PI * 2);
  c2d.fill();
}

/** 远层：天空渐变 + 太阳 / 月亮（按关卡昼夜映射，光源左上） */
export function drawFcSky(c2d: CanvasRenderingContext2D, opts: FcSceneOpts): void {
  const { w, h, theme } = opts;
  const night = fcIsNight(theme);
  const g = c2d.createLinearGradient(0, 0, 0, h);
  if (night) {
    g.addColorStop(0, FC_COLORS.fcSkyNight);
    g.addColorStop(1, shade(FC_COLORS.fcSkyNight, 0.22));
  } else {
    g.addColorStop(0, FC_COLORS.fcSkyDay);
    g.addColorStop(1, shade(FC_COLORS.fcSkyDay, 0.4));
  }
  c2d.fillStyle = g;
  c2d.fillRect(0, 0, w, h);

  if (night) {
    // 月亮：圆减圆的弯月 + 三颗小星
    c2d.save();
    c2d.fillStyle = "#F5E9B8";
    c2d.beginPath();
    c2d.arc(52, 54, 17, 0, Math.PI * 2);
    c2d.fill();
    c2d.fillStyle = shade(FC_COLORS.fcSkyNight, 0.06);
    c2d.beginPath();
    c2d.arc(60, 48, 14, 0, Math.PI * 2);
    c2d.fill();
    c2d.fillStyle = "rgba(245,233,184,.9)";
    for (const [sx, sy, sr] of [[w * 0.55, 44, 2.2], [w * 0.74, 78, 1.6], [w * 0.36, 92, 1.8]] as const) {
      c2d.beginPath();
      c2d.arc(sx, sy, sr, 0, Math.PI * 2);
      c2d.fill();
    }
    c2d.restore();
  } else {
    // 太阳在左上（光源方向一致）：底盘 + 光晕 + 八根短光芒
    c2d.save();
    c2d.fillStyle = "rgba(255,214,110,.35)";
    c2d.beginPath();
    c2d.arc(52, 54, 26, 0, Math.PI * 2);
    c2d.fill();
    c2d.fillStyle = "#FFD66E";
    c2d.beginPath();
    c2d.arc(52, 54, 16, 0, Math.PI * 2);
    c2d.fill();
    c2d.strokeStyle = "rgba(255,193,86,.75)";
    c2d.lineWidth = 2.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      c2d.beginPath();
      c2d.moveTo(52 + Math.cos(a) * 20, 54 + Math.sin(a) * 20);
      c2d.lineTo(52 + Math.cos(a) * 25, 54 + Math.sin(a) * 25);
      c2d.stroke();
    }
    c2d.restore();
  }
}

/** 中层：两朵程序云缓移（reduced 静止） */
export function drawFcClouds(c2d: CanvasRenderingContext2D, opts: FcSceneOpts): void {
  const night = fcIsNight(opts.theme);
  const color = night ? "rgba(150,148,190,.55)" : "rgba(255,255,255,.85)";
  puffyCloud(c2d, fcCloudX(opts.t, 0, opts.w, opts.reduced), 52, 15, color);
  puffyCloud(c2d, fcCloudX(opts.t, 1, opts.w, opts.reduced), 88, 11, color);
}

/** 近层：果树枝从顶部探入（果子「从树上掉下来」）+ 地面草地条 */
export function drawFcBranchAndGrass(c2d: CanvasRenderingContext2D, opts: FcSceneOpts): void {
  const { w, h, theme } = opts;
  const night = fcIsNight(theme);
  const branch = night ? shade(FC_COLORS.fcBranch, -0.25) : FC_COLORS.fcBranch;
  const foliage = night ? "rgba(84,118,84,.5)" : "rgba(139,196,127,.55)";
  const leafTone = night ? shade("#7BC47F", -0.25) : "#7BC47F";

  // 树冠软影两团 + 一根横枝，起点贴着水果出生线上方
  c2d.save();
  for (const [fx, fy, frx] of [[w * 0.2, 2, 64], [w * 0.78, -2, 74]] as const) {
    c2d.fillStyle = foliage;
    c2d.beginPath();
    c2d.ellipse(fx, fy, frx, 20, 0, 0, Math.PI * 2);
    c2d.fill();
  }
  c2d.strokeStyle = branch;
  c2d.lineWidth = 7;
  c2d.lineCap = "round";
  c2d.beginPath();
  c2d.moveTo(-8, 16);
  c2d.quadraticCurveTo(w * 0.5, 26, w + 8, 10);
  c2d.stroke();
  // 三根小分叉
  c2d.lineWidth = 4;
  for (const [bx, by, ex, ey] of [
    [w * 0.22, 19, w * 0.28, 32],
    [w * 0.55, 24, w * 0.5, 38],
    [w * 0.82, 15, w * 0.88, 30]
  ] as const) {
    c2d.beginPath();
    c2d.moveTo(bx, by);
    c2d.quadraticCurveTo((bx + ex) / 2 + 4, (by + ey) / 2, ex, ey);
    c2d.stroke();
  }
  // 枝上的小叶片
  c2d.fillStyle = leafTone;
  for (const [lx, ly, rot] of [
    [w * 0.14, 24, 0.6], [w * 0.32, 30, -0.4], [w * 0.48, 34, 0.9],
    [w * 0.63, 26, -0.7], [w * 0.86, 26, 0.5]
  ] as const) {
    c2d.save();
    c2d.translate(lx, ly);
    c2d.rotate(rot);
    c2d.beginPath();
    c2d.ellipse(0, 0, 7, 3.2, 0, 0, Math.PI * 2);
    c2d.fill();
    c2d.restore();
  }
  c2d.restore();

  // 地面草地条：底色 + 顶边圆润草丛鼓包
  const grass = night ? shade(FC_COLORS.fcGrass, -0.35) : FC_COLORS.fcGrass;
  c2d.save();
  c2d.fillStyle = grass;
  c2d.fillRect(0, h - 10, w, 10);
  c2d.beginPath();
  for (let x = 12; x < w; x += 34) c2d.arc(x, h - 10, 6, Math.PI, Math.PI * 2);
  c2d.fill();
  c2d.fillStyle = shade(grass, 0.14);
  c2d.beginPath();
  for (let x = 28; x < w; x += 52) c2d.arc(x, h - 9, 3.4, Math.PI, Math.PI * 2);
  c2d.fill();
  c2d.restore();
}

/** 三层场景一把梭（sky → clouds → branch+grass） */
export function drawFcScene(c2d: CanvasRenderingContext2D, opts: FcSceneOpts): void {
  drawFcSky(c2d, opts);
  drawFcClouds(c2d, opts);
  drawFcBranchAndGrass(c2d, opts);
}

// ---------------------------------------------------------------------------
// 五、编织藤篮（横三纵五编织纹 + 高光沿 + 提耳 + 篮内裁剪层 + 道具映射）
// ---------------------------------------------------------------------------

export interface FcBasketOpts {
  /** 篮口中心横坐标（判定用的 basketX，原样传入，只读） */
  x: number;
  /** 场地高度 H */
  h: number;
  /** 接住下压量（沿用 1.2 的 press 变量，0..FC_PRESS_PX） */
  press: number;
  reduced: boolean;
  /** 双人模式的队伍色椭圆垫（沿用 1.2 的 tint 语义） */
  tint?: string;
  /** 磁铁道具生效中 → 篮沿泛蓝微光（只读映射，不写状态） */
  magnet?: boolean;
  /** 冰冻道具生效中 → 篮口挂两根小冰凌（只读映射，不写状态） */
  frozen?: boolean;
  /** 最近接住的果子（visual 只取最后 3 个摆进篮口） */
  recent?: readonly FruitKitKind[];
}

/** 自绘编织藤篮。几何只跟视觉有关：接住判定仍由 logic.isCaught 说了算。 */
export function drawFcBasket(c2d: CanvasRenderingContext2D, opts: FcBasketOpts): void {
  const { x, h, press, reduced } = opts;
  if (!Number.isFinite(x) || !Number.isFinite(h)) return;
  const squash = fcBasketSquash(press, reduced);
  const base = FC_COLORS.fcBasket;
  const dark = shade(base, -0.2);
  const rimY = h - 26 + press;
  const bottomY = h - 5;
  const topHalf = 33;
  const botHalf = 24;

  c2d.save();
  if (opts.tint) {
    c2d.fillStyle = opts.tint;
    c2d.beginPath();
    c2d.ellipse(x, h - 12 + press, 30, 9, 0, 0, Math.PI * 2);
    c2d.fill();
  }
  // 落影
  c2d.fillStyle = FC_COLORS.fcShadow;
  c2d.beginPath();
  c2d.ellipse(x, bottomY + 2, topHalf * 0.92, 4, 0, 0, Math.PI * 2);
  c2d.fill();

  // 压扁回弹：绕篮底缩放（reduced 时 squash 恒 0，一帧切换）
  c2d.translate(x, bottomY);
  c2d.scale(1 + squash * 0.6, 1 - squash);
  c2d.translate(-x, -bottomY);

  // 磁铁：篮沿泛蓝微光（先画在篮身后面一圈）
  if (opts.magnet) {
    c2d.strokeStyle = "rgba(120,160,240,.55)";
    c2d.lineWidth = 5;
    c2d.beginPath();
    c2d.ellipse(x, rimY, topHalf + 4, 9, 0, 0, Math.PI * 2);
    c2d.stroke();
  }

  // 篮身：上宽下窄的梯形 + 渐变
  const bodyG = c2d.createLinearGradient(x - topHalf, rimY, x + topHalf, bottomY);
  bodyG.addColorStop(0, shade(base, 0.16));
  bodyG.addColorStop(0.55, base);
  bodyG.addColorStop(1, shade(base, -0.14));
  c2d.fillStyle = bodyG;
  c2d.beginPath();
  c2d.moveTo(x - topHalf, rimY);
  c2d.quadraticCurveTo(x - topHalf - 2, bottomY - 4, x - botHalf, bottomY);
  c2d.lineTo(x + botHalf, bottomY);
  c2d.quadraticCurveTo(x + topHalf + 2, bottomY - 4, x + topHalf, rimY);
  c2d.closePath();
  c2d.fill();
  c2d.strokeStyle = shade(base, -0.34);
  c2d.lineWidth = 1.5;
  c2d.stroke();

  // 编织纹：横三条弧线 + 纵五条短线交叉
  c2d.strokeStyle = dark;
  c2d.lineWidth = 1.6;
  for (let row = 1; row <= 3; row++) {
    const yy = rimY + ((bottomY - rimY) * row) / 4;
    const halfAt = topHalf + (botHalf - topHalf) * (row / 4);
    c2d.beginPath();
    c2d.moveTo(x - halfAt + 2, yy);
    c2d.quadraticCurveTo(x, yy + 3, x + halfAt - 2, yy);
    c2d.stroke();
  }
  for (let col = 0; col < 5; col++) {
    const k = (col + 0.5) / 5;
    const xt = x - topHalf + topHalf * 2 * k;
    const xb = x - botHalf + botHalf * 2 * k;
    c2d.beginPath();
    c2d.moveTo(xt, rimY + 2);
    c2d.lineTo(xb, bottomY - 2);
    c2d.stroke();
  }

  // 篮内裁剪层：篮口内侧最多摆 FC_BASKET_SHOW_MAX 个最近接住的小果子
  const shown = fcBasketShown(opts.recent ?? []);
  if (shown.length > 0) {
    c2d.save();
    c2d.beginPath();
    c2d.ellipse(x, rimY, topHalf - 4, 7, 0, 0, Math.PI * 2);
    c2d.clip();
    let slot = -(shown.length - 1) / 2;
    for (const kind of shown) {
      drawKitFruit(c2d, x + slot * 15, rimY - 1, 7, kind, { detail: false, color: FRUIT_MAIN[kind] });
      slot += 1;
    }
    c2d.restore();
  }

  // 篮口：环形沿 + 上缘高光
  c2d.fillStyle = shade(base, -0.08);
  c2d.beginPath();
  c2d.ellipse(x, rimY, topHalf, 8, 0, 0, Math.PI * 2);
  c2d.ellipse(x, rimY, topHalf - 6, 4.6, 0, 0, Math.PI * 2);
  c2d.fill("evenodd");
  c2d.strokeStyle = shade(base, -0.34);
  c2d.lineWidth = 1.5;
  c2d.beginPath();
  c2d.ellipse(x, rimY, topHalf, 8, 0, 0, Math.PI * 2);
  c2d.stroke();
  c2d.strokeStyle = shade(base, 0.32);
  c2d.lineWidth = 2;
  c2d.beginPath();
  c2d.ellipse(x, rimY - 1.2, topHalf - 3, 6, 0, Math.PI * 1.05, Math.PI * 1.95);
  c2d.stroke();

  // 双侧提耳
  c2d.strokeStyle = shade(base, -0.26);
  c2d.lineWidth = 3;
  for (const side of [-1, 1]) {
    c2d.beginPath();
    c2d.arc(x + side * (topHalf - 2), rimY - 3, 7, Math.PI * 0.9, Math.PI * 1.9 + (side === 1 ? 0.4 : 0));
    c2d.stroke();
  }

  // 冰冻：篮口挂两根小冰凌（只读 frozen 状态做映射）
  if (opts.frozen) {
    c2d.fillStyle = "rgba(190,230,255,.9)";
    for (const [ox, len] of [[-12, 9], [9, 7]] as const) {
      c2d.beginPath();
      c2d.moveTo(x + ox - 2.6, rimY + 6);
      c2d.lineTo(x + ox + 2.6, rimY + 6);
      c2d.lineTo(x + ox, rimY + 6 + len);
      c2d.closePath();
      c2d.fill();
    }
  }
  c2d.restore();
}

// ---------------------------------------------------------------------------
// 六、自绘道具与警告物（红圈是功能件留在 index.ts，这里只画圈内物）
// ---------------------------------------------------------------------------

/** 小捣蛋云：皱眉乌云 + 两滴小雨——语义是「别接它」，不吓人 */
export function drawNaughtyCloud(c2d: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || r <= 0) return;
  c2d.save();
  c2d.translate(x, y);
  const base = FC_COLORS.fcCloudGray;
  const g = c2d.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r * 1.2);
  g.addColorStop(0, shade(base, 0.18));
  g.addColorStop(0.6, base);
  g.addColorStop(1, shade(base, -0.16));
  c2d.fillStyle = g;
  c2d.beginPath();
  c2d.arc(-r * 0.55, 0, r * 0.5, 0, Math.PI * 2);
  c2d.arc(0, -r * 0.3, r * 0.62, 0, Math.PI * 2);
  c2d.arc(r * 0.55, 0, r * 0.5, 0, Math.PI * 2);
  c2d.ellipse(0, r * 0.16, r * 1.05, r * 0.42, 0, 0, Math.PI * 2);
  c2d.fill();
  c2d.strokeStyle = shade(base, -0.32);
  c2d.lineWidth = 1.5;
  c2d.beginPath();
  c2d.ellipse(0, -r * 0.05, r * 1.02, r * 0.62, 0, 0, Math.PI * 2);
  c2d.stroke();
  // 皱眉 + 嘟嘴（圆润，不狰狞）
  c2d.strokeStyle = "#5B5566";
  c2d.lineWidth = Math.max(1.2, r * 0.1);
  c2d.lineCap = "round";
  c2d.beginPath();
  c2d.moveTo(-r * 0.42, -r * 0.28);
  c2d.lineTo(-r * 0.16, -r * 0.16);
  c2d.moveTo(r * 0.42, -r * 0.28);
  c2d.lineTo(r * 0.16, -r * 0.16);
  c2d.stroke();
  c2d.fillStyle = "#5B5566";
  for (const ex of [-0.28, 0.28] as const) {
    c2d.beginPath();
    c2d.arc(ex * r, r * 0.02, r * 0.08, 0, Math.PI * 2);
    c2d.fill();
  }
  c2d.beginPath();
  c2d.arc(0, r * 0.3, r * 0.12, Math.PI * 1.15, Math.PI * 1.85);
  c2d.strokeStyle = "#5B5566";
  c2d.stroke();
  // 两滴小雨
  c2d.fillStyle = "rgba(120,160,220,.85)";
  for (const [dx, dy] of [[-r * 0.35, r * 0.72], [r * 0.3, r * 0.88]] as const) {
    c2d.beginPath();
    c2d.ellipse(dx, dy, r * 0.09, r * 0.14, 0, 0, Math.PI * 2);
    c2d.fill();
  }
  c2d.restore();
}

/** 小辣椒：弯身红椒 + 绿蒂（掉得最慢的警告物，语义与文案一致） */
export function drawFcChili(c2d: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || r <= 0) return;
  c2d.save();
  c2d.translate(x, y);
  c2d.rotate(0.5);
  const g = c2d.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.15, 0, 0, r * 1.2);
  g.addColorStop(0, "#FF8A7A");
  g.addColorStop(0.55, "#E85B4B");
  g.addColorStop(1, "#C74435");
  c2d.fillStyle = g;
  c2d.beginPath();
  c2d.moveTo(-r * 0.1, -r * 0.72);
  c2d.quadraticCurveTo(r * 0.85, -r * 0.5, r * 0.5, r * 0.35);
  c2d.quadraticCurveTo(r * 0.25, r * 0.95, -r * 0.35, r * 0.8);
  c2d.quadraticCurveTo(r * 0.35, r * 0.45, -r * 0.42, -r * 0.55);
  c2d.closePath();
  c2d.fill();
  c2d.strokeStyle = "#A33327";
  c2d.lineWidth = 1.5;
  c2d.stroke();
  c2d.fillStyle = "#6FA85C";
  c2d.beginPath();
  c2d.ellipse(-r * 0.26, -r * 0.7, r * 0.24, r * 0.15, -0.5, 0, Math.PI * 2);
  c2d.fill();
  c2d.strokeStyle = "#557F45";
  c2d.lineWidth = Math.max(1, r * 0.1);
  c2d.beginPath();
  c2d.moveTo(-r * 0.26, -r * 0.78);
  c2d.quadraticCurveTo(-r * 0.1, -r * 1.0, -r * 0.34, -r * 1.05);
  c2d.stroke();
  c2d.fillStyle = "rgba(255,255,255,.45)";
  c2d.beginPath();
  c2d.ellipse(-r * 0.12, -r * 0.3, r * 0.16, r * 0.09, 0.7, 0, Math.PI * 2);
  c2d.fill();
  c2d.restore();
}

/** 五角星路径（星星果 / 星屑共用） */
function starPath(c2d: CanvasRenderingContext2D, r: number, inner: number, points = 5, rot = -Math.PI / 2): void {
  c2d.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const a = rot + (i * Math.PI) / points;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) c2d.moveTo(px, py);
    else c2d.lineTo(px, py);
  }
  c2d.closePath();
}

/** 稀有星星果：金色五角星 + 光晕（🌟 的自绘替身） */
export function drawFcStar(c2d: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || r <= 0) return;
  c2d.save();
  c2d.translate(x, y);
  c2d.fillStyle = "rgba(255,214,120,.35)";
  c2d.beginPath();
  c2d.arc(0, 0, r * 1.3, 0, Math.PI * 2);
  c2d.fill();
  const g = c2d.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, "#FFE9A8");
  g.addColorStop(0.55, "#FFC94D");
  g.addColorStop(1, "#E8A62E");
  starPath(c2d, r, r * 0.46);
  c2d.fillStyle = g;
  c2d.fill();
  c2d.strokeStyle = "#C7861F";
  c2d.lineWidth = 1.5;
  c2d.stroke();
  c2d.fillStyle = "rgba(255,255,255,.6)";
  c2d.beginPath();
  c2d.ellipse(-r * 0.24, -r * 0.3, r * 0.16, r * 0.1, -0.6, 0, Math.PI * 2);
  c2d.fill();
  c2d.restore();
}

/** 夜章的萤火虫：发光小肚子 + 双翅（✨ 的自绘替身） */
export function drawFcFirefly(c2d: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || r <= 0) return;
  c2d.save();
  c2d.translate(x, y);
  c2d.fillStyle = "rgba(255,240,150,.3)";
  c2d.beginPath();
  c2d.arc(0, r * 0.15, r * 1.25, 0, Math.PI * 2);
  c2d.fill();
  c2d.fillStyle = "rgba(214,226,255,.8)";
  for (const side of [-1, 1]) {
    c2d.beginPath();
    c2d.ellipse(side * r * 0.42, -r * 0.4, r * 0.4, r * 0.2, side * 0.7, 0, Math.PI * 2);
    c2d.fill();
  }
  const g = c2d.createRadialGradient(0, r * 0.1, r * 0.08, 0, r * 0.2, r * 0.75);
  g.addColorStop(0, "#FFF6C4");
  g.addColorStop(0.6, "#FFE070");
  g.addColorStop(1, "#E8B93A");
  c2d.fillStyle = g;
  c2d.beginPath();
  c2d.ellipse(0, r * 0.2, r * 0.5, r * 0.62, 0, 0, Math.PI * 2);
  c2d.fill();
  c2d.fillStyle = "#6B5B4A";
  c2d.beginPath();
  c2d.arc(0, -r * 0.55, r * 0.3, 0, Math.PI * 2);
  c2d.fill();
  c2d.restore();
}

/** 冰冻果：圆角冰块 + 六向雪花纹（保留原半透明底板语义） */
export function drawFcIce(c2d: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || r <= 0) return;
  c2d.save();
  c2d.translate(x, y);
  const g = c2d.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, "rgba(214,240,255,.95)");
  g.addColorStop(1, "rgba(150,210,245,.9)");
  c2d.fillStyle = g;
  c2d.beginPath();
  c2d.roundRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.32);
  c2d.fill();
  c2d.strokeStyle = "rgba(110,180,225,.9)";
  c2d.lineWidth = 1.5;
  c2d.stroke();
  c2d.strokeStyle = "rgba(255,255,255,.95)";
  c2d.lineWidth = Math.max(1.2, r * 0.1);
  c2d.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    c2d.beginPath();
    c2d.moveTo(0, 0);
    c2d.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
    c2d.stroke();
    c2d.beginPath();
    c2d.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.07, 0, Math.PI * 2);
    c2d.stroke();
  }
  c2d.fillStyle = "rgba(255,255,255,.5)";
  c2d.beginPath();
  c2d.ellipse(-r * 0.4, -r * 0.45, r * 0.2, r * 0.1, -0.7, 0, Math.PI * 2);
  c2d.fill();
  c2d.restore();
}

/** 磁铁果：U 形磁铁 + 两个亮银磁极（保留原紫圈底板语义） */
export function drawFcMagnet(c2d: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || r <= 0) return;
  c2d.save();
  c2d.translate(x, y);
  c2d.rotate(Math.PI);
  const thick = r * 0.42;
  const g = c2d.createLinearGradient(-r, -r, r, r * 0.4);
  g.addColorStop(0, "#B08CE8");
  g.addColorStop(1, "#8558C8");
  c2d.strokeStyle = g;
  c2d.lineWidth = thick;
  c2d.lineCap = "butt";
  c2d.beginPath();
  c2d.arc(0, -r * 0.12, r * 0.58, 0, Math.PI);
  c2d.stroke();
  c2d.strokeStyle = "rgba(60,30,110,.5)";
  c2d.lineWidth = 1.5;
  c2d.beginPath();
  c2d.arc(0, -r * 0.12, r * 0.58 + thick / 2, 0, Math.PI);
  c2d.arc(0, -r * 0.12, r * 0.58 - thick / 2, Math.PI, 0, true);
  c2d.stroke();
  c2d.fillStyle = "#EDEAF5";
  for (const side of [-1, 1]) {
    c2d.beginPath();
    c2d.rect(side * r * 0.58 - thick / 2, -r * 0.52, thick, r * 0.34);
    c2d.fill();
    c2d.strokeStyle = "rgba(60,30,110,.4)";
    c2d.stroke();
  }
  c2d.fillStyle = "rgba(255,255,255,.5)";
  c2d.beginPath();
  c2d.ellipse(-r * 0.32, r * 0.3, r * 0.14, r * 0.08, 0.5, 0, Math.PI * 2);
  c2d.fill();
  c2d.restore();
}

/** 沉水果：大圆身 + 各自纹理（西瓜条纹 / 南瓜棱 / 椰子毛点 / 甜瓜网纹） */
export function drawFcHeavy(c2d: CanvasRenderingContext2D, x: number, y: number, r: number, emoji: string): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || r <= 0) return;
  const skin =
    emoji === "🎃" ? { base: "#F0913F", line: "#C96F26" } :
    emoji === "🥥" ? { base: "#9C6F48", line: "#7A5334" } :
    emoji === "🍈" ? { base: "#CDE3A4", line: "#A8C47E" } :
    { base: "#74C46A", line: "#3F8A4C" };
  c2d.save();
  c2d.translate(x, y);
  const g = c2d.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.12, 0, 0, r * 1.12);
  g.addColorStop(0, shade(skin.base, 0.18));
  g.addColorStop(0.55, skin.base);
  g.addColorStop(1, shade(skin.base, -0.14));
  c2d.fillStyle = g;
  c2d.beginPath();
  c2d.ellipse(0, 0, r, r * 0.94, 0, 0, Math.PI * 2);
  c2d.fill();
  c2d.strokeStyle = shade(skin.base, -0.34);
  c2d.lineWidth = 1.5;
  c2d.stroke();
  c2d.strokeStyle = skin.line;
  c2d.lineWidth = Math.max(1.4, r * 0.12);
  if (emoji === "🥥") {
    c2d.fillStyle = skin.line;
    for (const [dx, dy] of [[-0.24, -0.18], [0.24, -0.18], [0, 0.16]] as const) {
      c2d.beginPath();
      c2d.arc(dx * r, dy * r, r * 0.09, 0, Math.PI * 2);
      c2d.fill();
    }
  } else if (emoji === "🍈") {
    c2d.lineWidth = Math.max(1, r * 0.05);
    for (const off of [-0.5, 0, 0.5] as const) {
      c2d.beginPath();
      c2d.arc(off * r * 2, 0, r * 1.4, Math.PI * 0.7, Math.PI * 1.3);
      c2d.stroke();
    }
  } else {
    // 西瓜 / 南瓜共用的纵向弧纹
    for (const off of [-0.55, 0, 0.55] as const) {
      c2d.beginPath();
      c2d.moveTo(off * r, -r * 0.88);
      c2d.quadraticCurveTo(off * r * 1.7, 0, off * r, r * 0.88);
      c2d.stroke();
    }
    if (emoji === "🎃") {
      c2d.strokeStyle = "#557F45";
      c2d.lineWidth = Math.max(1.4, r * 0.14);
      c2d.beginPath();
      c2d.moveTo(0, -r * 0.9);
      c2d.lineTo(0, -r * 1.14);
      c2d.stroke();
    }
  }
  c2d.fillStyle = "rgba(255,255,255,.5)";
  c2d.beginPath();
  c2d.ellipse(-r * 0.38, -r * 0.42, r * 0.2, r * 0.12, -0.6, 0, Math.PI * 2);
  c2d.fill();
  c2d.restore();
}

/** 双人标签的小花标（朵朵）——名字仍用文字，图标自绘 */
export function drawFcFlower(c2d: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || r <= 0) return;
  c2d.save();
  c2d.translate(x, y);
  c2d.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    c2d.beginPath();
    c2d.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.42, r * 0.3, a, 0, Math.PI * 2);
    c2d.fill();
  }
  c2d.fillStyle = "#FFE9A8";
  c2d.beginPath();
  c2d.arc(0, 0, r * 0.34, 0, Math.PI * 2);
  c2d.fill();
  c2d.restore();
}

/** 双人标签的小星标（星星） */
export function drawFcStarBadge(c2d: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r) || r <= 0) return;
  c2d.save();
  c2d.translate(x, y);
  starPath(c2d, r, r * 0.46);
  c2d.fillStyle = color;
  c2d.fill();
  c2d.restore();
}

/** 传送带小箭头（替代字符直出） */
export function drawFcBeltArrow(c2d: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1): void {
  c2d.save();
  c2d.beginPath();
  c2d.moveTo(x - dir * 4, y - 4);
  c2d.lineTo(x + dir * 4, y);
  c2d.lineTo(x - dir * 4, y + 4);
  c2d.closePath();
  c2d.fill();
  c2d.restore();
}

/**
 * 一颗下落物的「身体」（不含红圈 / 底板，那些是功能件留在 index.ts）。
 * kind 是玩法侧的水果种类，emoji 是主题摇出来的原始图形——这里只做只读映射。
 */
export function drawFcItemBody(
  c2d: CanvasRenderingContext2D,
  kind: FruitKind,
  emoji: string,
  r: number,
  rot: number
): void {
  if (kind === "bad") {
    drawNaughtyCloud(c2d, 0, -8, r * 0.9);
    return;
  }
  if (kind === "chili") {
    drawFcChili(c2d, 0, -8, r * 0.9);
    return;
  }
  if (kind === "gold") {
    if (emoji === "✨") drawFcFirefly(c2d, 0, -8, r * 0.9);
    else drawFcStar(c2d, 0, -8, r * 0.85);
    return;
  }
  if (kind === "freeze") {
    drawFcIce(c2d, 0, -8, r * 0.8);
    return;
  }
  if (kind === "magnet") {
    drawFcMagnet(c2d, 0, -8, r * 0.85);
    return;
  }
  if (kind === "heavy") {
    drawFcHeavy(c2d, 0, -8, r, emoji);
    return;
  }
  drawKitFruit(c2d, 0, -8, r * 0.9, fruitKindOf(emoji), { rot, color: fruitColorOf(emoji) });
}

// ---------------------------------------------------------------------------
// 七、接住反馈粒子池：星屑 / 飘分 / 彩虹 / 落空弹地 /「哎呀」云雾
// ---------------------------------------------------------------------------

interface FxSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  /** true = 灰色云雾（接到警告物），false = 星屑 */
  puff: boolean;
}

interface FxFloat {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

interface FxFade {
  x: number;
  kind: FruitKitKind;
  color?: string;
  life: number;
  /** reduced 时不弹跳，直接渐隐 */
  bounce: boolean;
}

/**
 * 视觉粒子总管：三种粒子 + 彩虹计时都归它管，
 * destroy 时 clear() 一把清零（pending() 归零可测）。
 */
export class FcFx {
  readonly reduced: boolean;
  readonly sparks: FxSpark[] = [];
  readonly floats: FxFloat[] = [];
  readonly fades: FxFade[] = [];
  rainbowLeft = 0;
  rainbowX = 0;

  constructor(reduced: boolean) {
    this.reduced = reduced;
  }

  /** 接住普通果：星屑 4 颗（reduced 不生成） */
  catchBurst(x: number, y: number, color: string): void {
    if (this.reduced) return;
    for (let i = 0; i < FC_TIMING.sparkCount; i++) {
      const a = (i / FC_TIMING.sparkCount) * Math.PI * 2 + 0.6;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * 105,
        vy: Math.sin(a) * 105 - 75,
        life: FC_TIMING.sparkMs / 1000,
        color,
        puff: false
      });
    }
  }

  /** 飘分（reduced 也保留：只是淡出，不带粒子） */
  scoreFloat(x: number, y: number, text: string, color = "#D08A3E"): void {
    this.floats.push({ x, y, text, life: 0.7, color });
  }

  /** 接到警告物：灰色小云雾 +「哎呀」气泡（不批评） */
  hazardPuff(x: number, y: number): void {
    if (!this.reduced) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.9;
        this.sparks.push({
          x,
          y,
          vx: Math.cos(a) * 55,
          vy: Math.sin(a) * 55 - 30,
          life: FC_TIMING.sparkMs / 1000,
          color: "rgba(150,150,165,.8)",
          puff: true
        });
      }
    }
    this.scoreFloat(x, y - 16, "哎呀", "#8A8A98");
  }

  /** 落空的果子：在草地上弹一下变半透明再消失（reduced 直接渐隐） */
  missFade(x: number, kind: FruitKitKind, color?: string): void {
    this.fades.push({ x, kind, color, life: FC_TIMING.missFadeMs / 1000, bounce: !this.reduced });
  }

  /** 连接 5 个不落地：篮上方小彩虹一闪（reduced 关闭） */
  flashRainbow(x: number): void {
    if (this.reduced) return;
    this.rainbowLeft = FC_TIMING.rainbowMs / 1000;
    this.rainbowX = x;
  }

  pending(): number {
    return this.sparks.length + this.floats.length + this.fades.length + (this.rainbowLeft > 0 ? 1 : 0);
  }

  clear(): void {
    this.sparks.length = 0;
    this.floats.length = 0;
    this.fades.length = 0;
    this.rainbowLeft = 0;
  }

  step(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 520 * dt;
      s.life -= dt;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.y -= 34 * dt;
      f.life -= dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
    for (let i = this.fades.length - 1; i >= 0; i--) {
      const f = this.fades[i];
      f.life -= dt;
      if (f.life <= 0) this.fades.splice(i, 1);
    }
    this.rainbowLeft = Math.max(0, this.rainbowLeft - dt);
  }

  /** groundY = 草地面（落空果子在这里弹） */
  draw(c2d: CanvasRenderingContext2D, groundY: number): void {
    // 落空弹地渐隐（画在最底，别盖住星屑）
    for (const f of this.fades) {
      const k = 1 - f.life / (FC_TIMING.missFadeMs / 1000); // 0 → 1
      const alpha = Math.max(0, 0.66 * (1 - k));
      const hop = f.bounce ? Math.sin(Math.min(1, k) * Math.PI) * 9 : 0;
      drawKitFruit(c2d, f.x, groundY - 6 - hop, 11, f.kind, { detail: false, alpha, color: f.color });
    }
    // 星屑 / 云雾
    for (const s of this.sparks) {
      c2d.save();
      c2d.globalAlpha = Math.max(0, Math.min(1, s.life * 4));
      c2d.fillStyle = s.color;
      if (s.puff) {
        c2d.beginPath();
        c2d.arc(s.x, s.y, 4.5, 0, Math.PI * 2);
        c2d.fill();
      } else {
        c2d.translate(s.x, s.y);
        starPath(c2d, 4.6, 1.8, 4, 0);
        c2d.fill();
      }
      c2d.restore();
    }
    // 小彩虹一闪
    if (this.rainbowLeft > 0) {
      const k = this.rainbowLeft / (FC_TIMING.rainbowMs / 1000);
      c2d.save();
      c2d.globalAlpha = 0.85 * k;
      c2d.lineWidth = 3;
      const colors = ["#F28FB6", "#FFD66E", "#8FD8A0", "#8FB6F2"];
      for (let i = 0; i < colors.length; i++) {
        c2d.strokeStyle = colors[i];
        c2d.beginPath();
        c2d.arc(this.rainbowX, groundY - 28, 30 - i * 3.4, Math.PI * 1.08, Math.PI * 1.92);
        c2d.stroke();
      }
      c2d.restore();
    }
    // 飘分
    for (const f of this.floats) {
      c2d.save();
      c2d.globalAlpha = Math.max(0, Math.min(1, f.life * 2.2));
      c2d.fillStyle = f.color;
      c2d.font = "bold 14px sans-serif";
      c2d.textAlign = "center";
      c2d.fillText(f.text, f.x, f.y);
      c2d.restore();
    }
  }
}
