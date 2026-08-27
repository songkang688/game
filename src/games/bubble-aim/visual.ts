// 泡泡瞄准手 · 1.3 视觉层(第 19 步 C 档视觉升级)。
//
// 这里放的全是「怎么画」:ba 配色 token、图层序、动效时序表、瞄准点串采样、
// 炮台角度换算、reduced 分支与各种纯 painter。全部纯数据与纯函数;
// index.ts 只负责把这里算出来的东西画上 canvas。
//
// 红线:这一层绝不读写发射角度换算 / 反弹 / 贴附 / 掉落判定 / 关卡数据;
// 瞄准点串的每个坐标都来自 simulateShot→previewPath 的既有物理输出,
// 这里只做「沿折线取样」,一个物理点都不自己算。
import { filmVisible, paintBottomCrescent, paintFilm } from "../../art/kit/film";
import { shade } from "../../art/kit/palette";
import { STONE_CRACKED, type Cell, isClearable } from "./logic";

// ---------------------------------------------------------------------------
// 一、配色 token(四·补一规格表原样落成常量,动一个色值单测就红)
// ---------------------------------------------------------------------------

export const BA_COLORS = {
  /** 背景双色渐变(无尽墙用;战役保留各主题自己的天空色) */
  baBgTop: "#F3EAFB",
  baBgBottom: "#E3F0FA",
  /** 顶部藤蔓装饰带 */
  baVine: "#9FD98B",
  /** 吊灯暖光 */
  baLamp: "#FFE2B8",
  /** 炮台木质底座 */
  baWood: "#C89B6C",
  /** 石泡棱面主色 */
  baStone: "#B9AFA4",
  /** 炸弹黑猫主色(可爱不阴森) */
  baCat: "#5A5468",
  /** 统一落影 */
  baShadow: "rgba(93,84,110,.16)",
} as const;

/**
 * 图层序(draw 从底到顶):① 背景渐变+光斑 → ② 顶部藤蔓吊灯 → ③ 网格泡泡串 →
 * ④ 掉落串拖尾 → ⑤ 飞行泡 → ⑥ 瞄准点串(功能件) → ⑦ 发射器炮台 →
 * ⑧ 星花/飘分 → ⑨ HUD。色觉标记(colorMark)跟泡泡本体同层,永不被装饰盖住。
 */
export const BA_LAYERS = {
  background: 0,
  vineLamp: 1,
  gridBubbles: 2,
  /** 色觉辅助标记与泡泡本体同层(画在本体面子上,装饰不许盖) */
  colorMark: 2,
  fallTrail: 3,
  flight: 4,
  aimDots: 5,
  shooter: 6,
  sparkFx: 7,
  hud: 8,
} as const;

// ---------------------------------------------------------------------------
// 二、动效时序表(四·补三;毫秒写死成常量,测试直接引用)
// ---------------------------------------------------------------------------

export const BA_TIMINGS = {
  /** 待命泡弹跳:±2px、700ms 一个 sin 周期;reduced 静止 */
  idleBounceMs: 700,
  idleBounceAmpPx: 2,
  /** 换弹旋转交换(纯视觉过渡,逻辑交换时机不变) */
  swapMs: 150,
  /** 引信星火循环;reduced 静止火点 */
  fuseMs: 400,
  /** 彩虹环一圈;reduced 静止 */
  rainbowSpinMs: 2400,
  /** 掉落串拖尾渐隐帧数;reduced 不生成 */
  trailFrames: 3,
  /** 瞄准点串点径:起点 4px 沿路径递减到 2px(窄屏下限,功能件常驻) */
  aimDotMaxR: 4,
  aimDotMinR: 2,
} as const;

// ---------------------------------------------------------------------------
// 三、reduced 分支(弹跳/旋转/星火/拖尾全停;静态体积与瞄准点串保留)
// ---------------------------------------------------------------------------

/** 待命泡上下轻弹的偏移(px):sin 周期 700ms、±2px;reduced 恒 0 */
export function bounceOffset(tMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return Math.sin((tMs / BA_TIMINGS.idleBounceMs) * Math.PI * 2) * BA_TIMINGS.idleBounceAmpPx;
}

/** 彩虹环旋转角(弧度):2400ms 一圈 linear;reduced 恒 0(静止环) */
export function rainbowSpinAngle(tMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return ((tMs % BA_TIMINGS.rainbowSpinMs) / BA_TIMINGS.rainbowSpinMs) * Math.PI * 2;
}

/** 引信星火相位 0..1:400ms 循环 linear;reduced 恒 0(静止火点) */
export function fuseSparkPhase(tMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return (tMs % BA_TIMINGS.fuseMs) / BA_TIMINGS.fuseMs;
}

/** 掉落串拖尾帧数:reduced 不生成拖尾 */
export function trailFrames(reduced: boolean): number {
  return reduced ? 0 : BA_TIMINGS.trailFrames;
}

/**
 * 换弹交换进度 0..1(easeInOut):150ms 走完;reduced 瞬时到位。
 * 只做视觉过渡 —— 逻辑上 swapLoader 早在按下那一刻就换完了。
 */
export function swapProgress(elapsedMs: number, reduced: boolean): number {
  if (reduced) return 1;
  const t = Math.max(0, Math.min(1, elapsedMs / BA_TIMINGS.swapMs));
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ---------------------------------------------------------------------------
// 四、瞄准点串(功能件,reduced 也保留)
// ---------------------------------------------------------------------------

export interface AimDot {
  x: number;
  y: number;
  /** 沿整条预览路径的进度 0..1(点径映射用) */
  t: number;
}

/** 点串取样间隔(px) */
export const AIM_DOT_SPACING = 16;

/**
 * 把既有物理预览折线变成渐隐圆点串:只沿给定顶点做线性取样,
 * 每个点都落在 path 的线段上 —— 不改一个物理坐标,更不自己算反弹。
 */
export function aimDots(
  path: ReadonlyArray<{ x: number; y: number }>,
  spacing: number = AIM_DOT_SPACING
): AimDot[] {
  if (path.length < 2) return [];
  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const len = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    segLens.push(len);
    total += len;
  }
  if (total <= 0) return [];
  const out: AimDot[] = [];
  const gap = Math.max(4, spacing);
  for (let s = 0; s <= total; s += gap) {
    let rest = s;
    for (let i = 0; i < segLens.length; i++) {
      if (rest > segLens[i]) {
        rest -= segLens[i];
        continue;
      }
      const k = segLens[i] > 0 ? rest / segLens[i] : 0;
      const a = path[i];
      const b = path[i + 1];
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, t: s / total });
      break;
    }
  }
  return out;
}

/** 点径映射:路径起点 4px 线性递减到终点 2px(窄屏可见性下限) */
export function aimDotRadius(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return BA_TIMINGS.aimDotMaxR - (BA_TIMINGS.aimDotMaxR - BA_TIMINGS.aimDotMinR) * k;
}

/** 反弹点星花标记:就是预览折线的中间顶点(物理反射点),原样返回 */
export function bounceStars(
  path: ReadonlyArray<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  return path.slice(1, Math.max(1, path.length - 1)).map((p) => ({ x: p.x, y: p.y }));
}

// ---------------------------------------------------------------------------
// 五、炮台角度(只读瞄准方向,不写回)
// ---------------------------------------------------------------------------

/** 炮管旋转角(弧度):直接读既有瞄准方向向量,canvas 直接 rotate 用 */
export function barrelAngle(aim: { readonly dx: number; readonly dy: number }): number {
  return Math.atan2(aim.dy, aim.dx);
}

// ---------------------------------------------------------------------------
// 六、飘分轻弹入场
// ---------------------------------------------------------------------------

/**
 * 飘字轻弹入场缩放:寿命剩余比例 k(1=刚出现,0=散尽)。
 * 刚出现的前 15% 从 0.6 弹到 1,之后恒 1;reduced 不走这里(index 直接给 1)。
 */
export function floatPopScale(k: number): number {
  const born = 1 - Math.max(0, Math.min(1, k));
  if (born >= 0.15) return 1;
  const t = born / 0.15;
  return 0.6 + 0.4 * t + 0.15 * Math.sin(t * Math.PI) * (1 - t);
}

/** 顶板下压越多层,藤架阴影越深(0 层 0.16 → 每层 +0.05,封顶 0.4) */
export function vineShadowAlpha(pressedLayers: number): number {
  return Math.min(0.4, 0.16 + Math.max(0, pressedLayers) * 0.05);
}

// ---------------------------------------------------------------------------
// 七、绘制接口与泡泡 painter(node 测试塞记录桩,真 ctx 天然兼容)
// ---------------------------------------------------------------------------

export interface PaintCtx {
  globalAlpha: number;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  translate(x: number, y: number): void;
  rotate(a: number): void;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
}

/** 五角星路径(徽章 / 彩虹泡中心 / 反弹星花共用) */
export function starPath(ctx: PaintCtx, x: number, y: number, rOut: number, rIn: number, points = 5): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** 这颗子(彩色或彩虹)算不算「软泡泡」:成串挤压高光只画在软泡泡之间 */
export function isSquashy(cell: Cell): boolean {
  return isClearable(cell);
}

/** 石泡的裂纹两态:只读既有 cracked 状态,不写回 */
export function stoneCracked(cell: Cell): boolean {
  return cell === STONE_CRACKED;
}

/**
 * 普通彩色泡泡:既有径向渐变打底,再加边缘 1px 彩虹薄膜(<6px 省略)、
 * 底部月牙反光、主高光 + 副高光;色觉标记最后画 —— 与本体同层,永不被盖。
 * 光源统一左上 45°。
 */
export function paintBubble(
  ctx: PaintCtx,
  x: number,
  y: number,
  r: number,
  light: string,
  dark: string,
  colorKey: string,
  alpha = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  // ① 本体径向渐变(左上光源)
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
  grad.addColorStop(0, "#FFFFFF");
  grad.addColorStop(0.35, light);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // ② 边缘彩虹薄膜描边(同色系 +12°,<6px 自动省略)
  paintFilm(ctx, x, y, r, dark);
  // ③ 底部月牙反光
  if (filmVisible(r)) paintBottomCrescent(ctx, x, y, r);
  // ④ 主高光(左上椭圆)+ 副高光(小圆点)
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.4, r * 0.24, r * 0.15, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(x + r * 0.06, y - r * 0.58, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  // ⑤ 色觉辅助标记(功能件):最后一笔,层级不低于本体,谁都盖不住
  paintColorMark(ctx, x, y + r * 0.08, colorKey, r);
  ctx.restore();
}

/** 色弱友好:每种颜色配一个专属白色小图案,不靠颜色也能分清(1.2 原样保住) */
export function paintColorMark(ctx: PaintCtx, x: number, y: number, color: string, radius: number): void {
  const s = radius * 0.34;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = Math.max(1.5, radius * 0.12);
  ctx.beginPath();
  if (color === "R") {
    // 红:实心三角
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y + s * 0.8);
    ctx.lineTo(x - s, y + s * 0.8);
    ctx.closePath();
    ctx.fill();
  } else if (color === "Y") {
    // 黄:实心菱形
    ctx.moveTo(x, y - s * 1.15);
    ctx.lineTo(x + s * 1.15, y);
    ctx.lineTo(x, y + s * 1.15);
    ctx.lineTo(x - s * 1.15, y);
    ctx.closePath();
    ctx.fill();
  } else if (color === "B") {
    // 蓝:空心圆环
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.stroke();
  } else if (color === "G") {
    // 绿:实心方块
    ctx.fillRect(x - s * 0.85, y - s * 0.85, s * 1.7, s * 1.7);
  } else if (color === "P") {
    // 紫:十字
    ctx.moveTo(x - s, y);
    ctx.lineTo(x + s, y);
    ctx.moveTo(x, y - s);
    ctx.lineTo(x, y + s);
    ctx.stroke();
  }
}

/** 贴附成串时相邻软泡泡之间的挤压高光点(静态体积感,reduced 保留) */
export function paintSqueezeDot(ctx: PaintCtx, ax: number, ay: number, bx: number, by: number): void {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  // 光源左上:高光点往左上偏一点
  ctx.arc(mx - 1.5, my - 1.5, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 七·补:发射器炮台六道工序(四·补二;每道一个纯 painter,index 按序调用)
// ---------------------------------------------------------------------------

/** 工序①:底座落影椭圆(统一落影色) */
export function paintShooterShadow(ctx: PaintCtx, x: number, y: number, r: number): void {
  ctx.save();
  ctx.fillStyle = BA_COLORS.baShadow;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 1.32, r * 1.7, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 工序②:木质底座(木纹两条 + 顶亮边 + 两颗铆钉) */
export function paintShooterBase(ctx: PaintCtx, x: number, y: number, r: number): void {
  ctx.save();
  const w = r * 2.5;
  const h = r * 1.05;
  const top = y + r * 0.42;
  const grad = ctx.createLinearGradient(x, top, x, top + h);
  grad.addColorStop(0, shade(BA_COLORS.baWood, 14));
  grad.addColorStop(1, shade(BA_COLORS.baWood, -16));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, top + h);
  ctx.lineTo(x - w * 0.36, top);
  ctx.lineTo(x + w * 0.36, top);
  ctx.lineTo(x + w / 2, top + h);
  ctx.closePath();
  ctx.fill();
  // 顶亮边(左上光源)
  ctx.strokeStyle = shade(BA_COLORS.baWood, 38);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.36, top + 1);
  ctx.lineTo(x + w * 0.36, top + 1);
  ctx.stroke();
  // 木纹两条
  ctx.strokeStyle = shade(BA_COLORS.baWood, -28);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.3, top + h * 0.38);
  ctx.lineTo(x + w * 0.26, top + h * 0.34);
  ctx.moveTo(x - w * 0.24, top + h * 0.68);
  ctx.lineTo(x + w * 0.32, top + h * 0.72);
  ctx.stroke();
  // 铆钉两颗
  ctx.fillStyle = shade(BA_COLORS.baWood, -34);
  ctx.beginPath();
  ctx.arc(x - w * 0.34, top + h * 0.55, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w * 0.34, top + h * 0.55, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 工序③:炮管旋转层(只读瞄准角;圆管 + 口部亮环) */
export function paintBarrel(ctx: PaintCtx, x: number, y: number, angleRad: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);
  const inner = r * 0.34;
  const outer = r * 1.9;
  const half = r * 0.5;
  const grad = ctx.createLinearGradient(0, -half, 0, half);
  grad.addColorStop(0, shade(BA_COLORS.baWood, 26));
  grad.addColorStop(0.5, BA_COLORS.baWood);
  grad.addColorStop(1, shade(BA_COLORS.baWood, -24));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(inner, -half * 0.8);
  ctx.lineTo(outer, -half);
  ctx.lineTo(outer, half);
  ctx.lineTo(inner, half * 0.8);
  ctx.closePath();
  ctx.fill();
  // 口部亮环
  ctx.strokeStyle = "#FFF4DC";
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(outer - 1, -half);
  ctx.lineTo(outer - 1, half);
  ctx.stroke();
  ctx.restore();
}

/** 工序④:座舱星星徽章(圆片 + 金星;kit 无 star.ts,星形路径归本档 starPath) */
export function paintStarBadge(ctx: PaintCtx, x: number, y: number, r: number): void {
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.46, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(BA_COLORS.baWood, -12);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = BA_COLORS.baLamp;
  starPath(ctx, x, y, r * 0.3, r * 0.13, 5);
  ctx.fill();
  ctx.strokeStyle = "#E8B25A";
  ctx.lineWidth = 1;
  starPath(ctx, x, y, r * 0.3, r * 0.13, 5);
  ctx.stroke();
  ctx.restore();
}

/** 工序⑤:装填槽(下一发待命的小凹槽;待命泡的弹跳偏移由 bounceOffset 给) */
export function paintLoadSlot(ctx: PaintCtx, x: number, y: number, r: number): void {
  ctx.save();
  ctx.fillStyle = BA_COLORS.baShadow;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.92, r * 1.06, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(BA_COLORS.baWood, 8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r + 3, Math.PI * 0.12, Math.PI * 0.88);
  ctx.stroke();
  ctx.restore();
}

/**
 * 工序⑥:换弹旋转交换的两颗泡位置(p=0 起步,p=1 到位;上弧下弧对转)。
 * 纯插值 —— 逻辑上 swapLoader 在按下那一刻已经换完,这里只演 150ms 的过场。
 */
export function swapPositions(
  p: number,
  cx: number,
  cy: number,
  nx: number,
  ny: number
): { cur: { x: number; y: number }; nxt: { x: number; y: number } } {
  const k = Math.max(0, Math.min(1, p));
  const lift = Math.sin(k * Math.PI) * 18;
  return {
    // 新的当前弹:从装填槽转到炮位(走上弧)
    cur: { x: nx + (cx - nx) * k, y: ny + (cy - ny) * k - lift },
    // 换下来的下一发:从炮位转回装填槽(走下弧)
    nxt: { x: cx + (nx - cx) * k, y: cy + (ny - cy) * k + lift },
  };
}

// ---------------------------------------------------------------------------
// 八、特殊泡三兄弟:黑猫炸弹 / 岩石棱面 / 彩虹环(剪影一眼分清)
// ---------------------------------------------------------------------------

/**
 * 炸弹泡 → 可爱黑猫:圆脸 + 双耳 + 粉内耳 + 大眼睛 + w 嘴,
 * 头顶小引信冒星火(sparkPhase 0..1 循环;reduced 给 0 = 静止火点)。
 */
export function paintBombCat(
  ctx: PaintCtx,
  x: number,
  y: number,
  r: number,
  sparkPhase: number,
  alpha = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  const dark = shade(BA_COLORS.baCat, -18);
  // 耳朵两只(先画,被脸压住下缘)
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.72, y - r * 0.28);
  ctx.lineTo(x - r * 0.52, y - r * 1.02);
  ctx.lineTo(x - r * 0.12, y - r * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + r * 0.72, y - r * 0.28);
  ctx.lineTo(x + r * 0.52, y - r * 1.02);
  ctx.lineTo(x + r * 0.12, y - r * 0.62);
  ctx.closePath();
  ctx.fill();
  // 粉内耳
  ctx.fillStyle = "#F3A8C0";
  ctx.beginPath();
  ctx.moveTo(x - r * 0.56, y - r * 0.44);
  ctx.lineTo(x - r * 0.48, y - r * 0.82);
  ctx.lineTo(x - r * 0.26, y - r * 0.56);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + r * 0.56, y - r * 0.44);
  ctx.lineTo(x + r * 0.48, y - r * 0.82);
  ctx.lineTo(x + r * 0.26, y - r * 0.56);
  ctx.closePath();
  ctx.fill();
  // 圆脸(左上光源渐变,可爱不阴森)
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.12, x, y, r);
  grad.addColorStop(0, shade(BA_COLORS.baCat, 28));
  grad.addColorStop(0.5, BA_COLORS.baCat);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // 大眼睛两颗 + 眼神光
  ctx.fillStyle = "#FFF9E8";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.08, r * 0.2, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.32, y - r * 0.08, r * 0.2, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2B2735";
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.04, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.34, y - r * 0.04, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(x - r * 0.34, y - r * 0.09, r * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.3, y - r * 0.09, r * 0.04, 0, Math.PI * 2);
  ctx.fill();
  // w 小嘴 + 腮红
  ctx.strokeStyle = "#F3A8C0";
  ctx.lineWidth = Math.max(1.2, r * 0.08);
  ctx.beginPath();
  ctx.arc(x - r * 0.09, y + r * 0.26, r * 0.1, 0.15, Math.PI - 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + r * 0.09, y + r * 0.26, r * 0.1, 0.15, Math.PI - 0.15);
  ctx.stroke();
  ctx.fillStyle = "rgba(243,168,192,0.5)";
  ctx.beginPath();
  ctx.arc(x - r * 0.58, y + r * 0.22, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.58, y + r * 0.22, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // 头顶小引信 + 星火(相位 0..1;静止时火点停在引信头)
  ctx.strokeStyle = "#B9AFA4";
  ctx.lineWidth = Math.max(1.2, r * 0.09);
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.94);
  ctx.lineTo(x + r * 0.12, y - r * 1.18);
  ctx.stroke();
  const fx = x + r * 0.12;
  const fy = y - r * 1.18;
  const twinkle = 0.75 + 0.25 * Math.sin(sparkPhase * Math.PI * 2);
  ctx.fillStyle = "#FFD27A";
  starPath(ctx, fx, fy, r * 0.22 * twinkle, r * 0.09 * twinkle, 4);
  ctx.fill();
  ctx.restore();
}

/**
 * 石泡 → 岩石:棱面三块(亮/中/暗)+ 斑点;cracked 时裂纹加宽到醒目
 * (读既有 cracked 布尔,不写任何状态)。
 */
export function paintStoneRock(
  ctx: PaintCtx,
  x: number,
  y: number,
  r: number,
  cracked: boolean,
  alpha = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
  grad.addColorStop(0, shade(BA_COLORS.baStone, 24));
  grad.addColorStop(0.45, BA_COLORS.baStone);
  grad.addColorStop(1, shade(BA_COLORS.baStone, -26));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // 岩石棱面三块:左上受光亮面、右侧中间面、下方暗面
  ctx.fillStyle = shade(BA_COLORS.baStone, 16);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.62, y - r * 0.18);
  ctx.lineTo(x - r * 0.16, y - r * 0.66);
  ctx.lineTo(x + r * 0.1, y - r * 0.2);
  ctx.lineTo(x - r * 0.3, y + r * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(BA_COLORS.baStone, -8);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.16, y - r * 0.5);
  ctx.lineTo(x + r * 0.66, y - r * 0.1);
  ctx.lineTo(x + r * 0.4, y + r * 0.3);
  ctx.lineTo(x + r * 0.08, y - r * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(BA_COLORS.baStone, -18);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.34, y + r * 0.26);
  ctx.lineTo(x + r * 0.26, y + r * 0.2);
  ctx.lineTo(x + r * 0.02, y + r * 0.66);
  ctx.closePath();
  ctx.fill();
  // 斑点两粒
  ctx.fillStyle = "rgba(110,115,132,0.5)";
  ctx.beginPath();
  ctx.arc(x + r * 0.3, y + r * 0.2, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - r * 0.4, y + r * 0.4, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  if (cracked) {
    // 裂纹加宽到醒目:主干粗 + 亮边衬一道,远看也知道「再一下就碎」
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = Math.max(3.5, r * 0.24);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.3);
    ctx.lineTo(x - r * 0.1, y);
    ctx.lineTo(x - r * 0.35, y + r * 0.45);
    ctx.stroke();
    ctx.strokeStyle = "#4A4E60";
    ctx.lineWidth = Math.max(2.5, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.3);
    ctx.lineTo(x - r * 0.1, y);
    ctx.lineTo(x - r * 0.35, y + r * 0.45);
    ctx.moveTo(x - r * 0.1, y);
    ctx.lineTo(x + r * 0.45, y - r * 0.15);
    ctx.moveTo(x + r * 0.1, y - r * 0.08);
    ctx.lineTo(x + r * 0.2, y + r * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

/** 彩虹环的七彩(从红到紫,孩子数得出七种) */
export const RAINBOW_RING = [
  "#F26D93",
  "#F0A05A",
  "#F0BE3E",
  "#7CBE5F",
  "#5BA7E0",
  "#7B8BE0",
  "#A87FDE",
] as const;

/**
 * 彩虹泡 → 旋转七彩环 + 中心白星:环随 spin(弧度)转,reduced 给 0 = 静止;
 * 星星常驻,剪影和普通泡 / 石泡 / 黑猫都分得开。
 */
export function paintRainbowOrb(
  ctx: PaintCtx,
  x: number,
  y: number,
  r: number,
  spin: number,
  alpha = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  // 白底
  const base = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  base.addColorStop(0, "#FFFFFF");
  base.addColorStop(1, "#EDE4F7");
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // 旋转七彩环(粗环带,七段)
  const seg = (Math.PI * 2) / RAINBOW_RING.length;
  ctx.lineWidth = Math.max(2, r * 0.3);
  for (let k = 0; k < RAINBOW_RING.length; k++) {
    ctx.strokeStyle = RAINBOW_RING[k];
    ctx.beginPath();
    ctx.arc(x, y, r * 0.68, spin + k * seg, spin + (k + 1) * seg + 0.02);
    ctx.stroke();
  }
  // 中心白星 + 描边
  ctx.fillStyle = "#FFFFFF";
  starPath(ctx, x, y, r * 0.34, r * 0.15, 5);
  ctx.fill();
  ctx.strokeStyle = "rgba(168,127,222,0.7)";
  ctx.lineWidth = 1.5;
  starPath(ctx, x, y, r * 0.34, r * 0.15, 5);
  ctx.stroke();
  // 玻璃高光与外圈
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.42, r * 0.2, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
