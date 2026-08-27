/**
 * 连招对决 · 1.3 视觉资产(纯绘制层,零玩法数值)。
 *
 * 全部是「只吃传入 ctx」的纯绘制函数与纯查表:不查 DOM、不挂监听、
 * 不碰 engine/rules/frames 的任何判定数值。调色与光影推导复用共享素材包
 * `src/art/kit/`(视觉宪法:凡 kit 有的不许重抄)。
 *
 * 兼容性约定:仓库单测跑在 node 环境,画布替身(`src/games/__tests__/canvasDom`)
 * 只认 arc / moveTo / lineTo / rect / fillRect / strokeRect / fillText / 渐变 /
 * translate / rotate / scale 这些基础调用,所以这里的椭圆一律用「变换 + 单位圆」画、
 * 月牙与绳索用采样折线画,不用 ellipse / quadraticCurveTo / arcTo / strokeText。
 */

import { KIT_PALETTE, drawSparkle, drawStar, hexToRgb, shade, tint } from "../../art/kit";
import { chapterIndexOf } from "./levels";
import type { CharLook } from "./frames";

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function fin(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** `#rrggbb` + 透明度 → `rgba()`;非法 hex 原样返回,不抛 */
function rgba(hex: string, a: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

/** 负数也回得来的取模(视差平铺用) */
function wrap(v: number, m: number): number {
  return ((v % m) + m) % m;
}

/** 椭圆路径:变换 + 单位圆,替身环境没有 ctx.ellipse 也能画 */
function pathOval(g: Ctx, cx: number, cy: number, rx: number, ry: number, rot = 0): void {
  const sx = Math.max(0.1, rx);
  const sy = Math.max(0.1, ry);
  g.save();
  g.translate(cx, cy);
  if (rot !== 0) g.rotate(rot);
  g.scale(sx, sy);
  g.beginPath();
  g.arc(0, 0, 1, 0, TAU);
  g.restore();
}

/** 标准 N 芒星路径(倒地转圈星 / 星屑 / 空槽星徽用) */
function pathStar(g: Ctx, cx: number, cy: number, rOut: number, rIn: number, rot = -Math.PI / 2, points = 5): void {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = rot + (i * Math.PI) / points;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/** 圆帽单段小短肢(手臂 / 小腿) */
function limb(g: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string): void {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}

// ---------------------------------------------------------------------------
// 主题舞台:樱花道场 / 星空擂台 / 糖果广场(按 levels.ts 章节查表)
// ---------------------------------------------------------------------------

export type StageThemeId = "sakura" | "night" | "candy";

export interface StageTheme {
  id: StageThemeId;
  name: string;
  skyTop: string;
  skyBot: string;
  /** 远景剪影色 */
  far: string;
  /** 近景土丘色 */
  near: string;
  /** 擂台木板底色 / 板缝 / 顶沿 */
  floor: string;
  seam: string;
  edge: string;
  /** 围绳与立柱 */
  rope: string;
  post: string;
  /** 花瓣 / 星光 / 糖点缀色 */
  accent: string;
}

export const STAGE_THEMES: Record<StageThemeId, StageTheme> = {
  sakura: {
    id: "sakura",
    name: "樱花道场",
    skyTop: "#fff3f8",
    skyBot: "#ffd9e8",
    far: "#e8a7c3",
    near: "#f6c7da",
    floor: "#e8c39a",
    seam: "#c99b6d",
    edge: "#d9ae80",
    rope: "#e0568f",
    post: "#b85c8a",
    accent: "#ffb3d2"
  },
  night: {
    id: "night",
    name: "星空擂台",
    skyTop: "#3a4370",
    skyBot: "#7a6aa8",
    far: "#2e3560",
    near: "#565f96",
    floor: "#7d6aa0",
    seam: "#5d4f80",
    edge: "#6a5b90",
    rope: "#ffd34e",
    post: "#cfb7f2",
    accent: "#ffe38a"
  },
  candy: {
    id: "candy",
    name: "糖果广场",
    skyTop: "#fff7e8",
    skyBot: "#ffe1f2",
    far: "#f2a9d0",
    near: "#ffd1e8",
    floor: "#f2c48d",
    seam: "#d1a069",
    edge: "#e0b27a",
    rope: "#79c8ef",
    post: "#f2789f",
    accent: "#a5e6c8"
  }
};

/** 关号 → 舞台主题:前三章樱花道场,中三章星空擂台,后两章糖果广场 */
export function stageThemeOf(level: number): StageThemeId {
  const ci = chapterIndexOf(level);
  return ci <= 2 ? "sakura" : ci <= 5 ? "night" : "candy";
}

/** 樱花花瓣数量上限(规格:≤ 12 粒) */
export const PETAL_MAX = 12;

export interface StageOpts {
  w: number;
  h: number;
  groundY: number;
  /** 镜头视差基准(两人中点) */
  shift: number;
  theme: StageThemeId;
  /** 秒级动画相位 */
  t: number;
  /** 减弱动效:花瓣 / 流星 / 闪烁全部停 */
  soft: boolean;
}

function farSakura(g: Ctx, o: StageOpts, th: StageTheme): void {
  for (let i = -1; i < 6; i++) {
    const x = wrap(i * 165 - o.shift * 0.25, o.w + 330) - 165;
    const gy = o.groundY - 6;
    g.fillStyle = rgba(shade(th.far, 0.25), 0.9);
    g.fillRect(x - 3, gy - 44, 6, 44);
    g.fillStyle = rgba(th.far, 0.85);
    g.beginPath();
    g.arc(x, gy - 52, 22, 0, TAU);
    g.arc(x - 15, gy - 42, 15, 0, TAU);
    g.arc(x + 15, gy - 42, 15, 0, TAU);
    g.fill();
    g.fillStyle = rgba(tint(th.far, 0.35), 0.8);
    g.beginPath();
    g.arc(x - 7, gy - 58, 8, 0, TAU);
    g.fill();
  }
}

function farNight(g: Ctx, o: StageOpts, th: StageTheme): void {
  // 星山剪影
  for (let i = -1; i < 6; i++) {
    const x = wrap(i * 190 - o.shift * 0.25, o.w + 380) - 190;
    const peak = 62 + (i % 2 === 0 ? 16 : 0);
    g.fillStyle = rgba(th.far, 0.95);
    g.beginPath();
    g.moveTo(x - 92, o.groundY - 4);
    g.lineTo(x, o.groundY - 4 - peak);
    g.lineTo(x + 92, o.groundY - 4);
    g.closePath();
    g.fill();
  }
  // 满天星:固定布点,轻微闪烁(soft 恒亮不闪)
  for (let i = 0; i < 16; i++) {
    const sx = (i * 61 + 17) % o.w;
    const sy = (i * 37 + 9) % Math.max(40, o.groundY - 80);
    const twinkle = o.soft ? 0.7 : 0.35 + 0.55 * Math.abs(Math.sin(o.t * 1.4 + i));
    g.fillStyle = rgba(th.accent, twinkle);
    g.beginPath();
    g.arc(sx, sy, 1.5 + (i % 3) * 0.5, 0, TAU);
    g.fill();
  }
  // 弯月:亮圆 + 天色圆错位盖出月牙
  const mx = o.w * 0.82;
  g.fillStyle = rgba(th.accent, 0.95);
  g.beginPath();
  g.arc(mx, 34, 14, 0, TAU);
  g.fill();
  g.fillStyle = th.skyTop;
  g.beginPath();
  g.arc(mx - 7, 30, 12, 0, TAU);
  g.fill();
  // 偶发流星(soft 关)
  if (!o.soft) {
    const cyc = o.t % 7;
    if (cyc < 0.6) {
      const k = cyc / 0.6;
      const x0 = o.w * 0.72 - k * o.w * 0.4;
      const y0 = 18 + k * 66;
      g.strokeStyle = `rgba(255,255,255,${0.85 * (1 - k)})`;
      g.lineWidth = 2;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x0 + 30, y0 - 18);
      g.stroke();
    }
  }
}

function farCandy(g: Ctx, o: StageOpts, th: StageTheme): void {
  // 软糖山
  for (let i = -1; i < 7; i++) {
    const x = wrap(i * 150 - o.shift * 0.25, o.w + 300) - 150;
    g.fillStyle = rgba(th.far, 0.5);
    g.beginPath();
    g.arc(x, o.groundY - 4, 56, Math.PI, 0);
    g.fill();
  }
  // 棒棒糖路灯
  for (let i = -1; i < 5; i++) {
    const x = wrap(i * 210 + 70 - o.shift * 0.25, o.w + 420) - 210;
    const gy = o.groundY - 4;
    g.fillStyle = "#fff2df";
    g.fillRect(x - 2.5, gy - 62, 5, 60);
    g.fillStyle = th.far;
    g.beginPath();
    g.arc(x, gy - 70, 14, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,.75)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, gy - 70, 8, 0.4, TAU * 0.8);
    g.stroke();
    g.fillStyle = rgba(tint(th.far, 0.5), 0.9);
    g.beginPath();
    g.arc(x - 5, gy - 75, 4, 0, TAU);
    g.fill();
  }
}

/** 近景土丘(三主题共用形状,只换颜色) */
function nearMounds(g: Ctx, o: StageOpts, th: StageTheme): void {
  g.fillStyle = rgba(th.near, 0.9);
  for (let i = -1; i < 8; i++) {
    const x = wrap(i * 112 - o.shift * 0.6, o.w + 224) - 112;
    g.beginPath();
    g.arc(x, o.groundY + 4, 40, Math.PI, 0);
    g.fill();
  }
}

/** 主题飘浮粒子:樱花花瓣 / 糖果闪光(星空的闪烁在远景层做了) */
function themeDrift(g: Ctx, o: StageOpts, th: StageTheme): void {
  if (o.soft) return;
  if (o.theme === "sakura") {
    for (let i = 0; i < PETAL_MAX; i++) {
      const fall = 22 + (i % 3) * 12;
      const px = wrap(i * 83 + Math.sin(o.t * 0.8 + i) * 14 + o.t * 6, o.w + 30) - 15;
      const py = wrap(o.t * fall + i * 47, o.groundY + 40) - 20;
      g.fillStyle = rgba(th.accent, 0.85);
      pathOval(g, px, py, 4, 2.4, o.t * 2 + i);
      g.fill();
    }
  } else if (o.theme === "candy") {
    for (let i = 0; i < 6; i++) {
      const sx = (i * 107 + 40) % o.w;
      const sy = 26 + ((i * 53) % Math.max(30, o.groundY - 110));
      drawSparkle(g, { x: sx, y: sy, r: 5, t: o.t * 0.6 + i * 0.17, color: rgba(th.accent, 0.9) });
    }
  }
}

/** 擂台地面:木板条纹 + 中线标记 + 围绳与立柱 */
function ringFloor(g: Ctx, o: StageOpts, th: StageTheme): void {
  const gy = o.groundY;
  g.fillStyle = th.floor;
  g.fillRect(0, gy, o.w, o.h - gy);
  // 顶沿亮阶
  g.fillStyle = th.edge;
  g.fillRect(0, gy, o.w, 4);
  // 竖板缝
  g.strokeStyle = rgba(th.seam, 0.8);
  g.lineWidth = 1.5;
  for (let x = 21; x < o.w; x += 42) {
    g.beginPath();
    g.moveTo(x, gy + 5);
    g.lineTo(x, o.h - 2);
    g.stroke();
  }
  // 横板缝
  g.strokeStyle = rgba(th.seam, 0.45);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, gy + 17);
  g.lineTo(o.w, gy + 17);
  g.stroke();
  // 中线 + 菱形标记
  g.fillStyle = "rgba(255,255,255,.5)";
  g.fillRect(o.w / 2 - 1.5, gy + 4, 3, o.h - gy - 8);
  g.fillStyle = th.accent;
  pathStar(g, o.w / 2, gy + 12, 6, 2.6, -Math.PI / 2, 4);
  g.fill();
  // 立柱(左右各一根,带暗侧与圆头)
  for (const px of [12, o.w - 12]) {
    g.fillStyle = th.post;
    g.fillRect(px - 4, gy - 70, 8, 70);
    g.fillStyle = rgba(shade(th.post, 0.3), 0.9);
    g.fillRect(px + 1, gy - 70, 3, 70);
    g.fillStyle = tint(th.post, 0.35);
    g.beginPath();
    g.arc(px, gy - 70, 5, 0, TAU);
    g.fill();
  }
  // 两根围绳:采样折线画下垂,主色 + 高光双道
  for (const ry of [gy - 62, gy - 44]) {
    for (const [color, lw, dy] of [
      [th.rope, 3, 0],
      [tint(th.rope, 0.45), 1, -1]
    ] as const) {
      g.strokeStyle = color;
      g.lineWidth = lw;
      g.lineCap = "round";
      g.beginPath();
      for (let i = 0; i <= 16; i++) {
        const px = (i / 16) * o.w;
        const py = ry + Math.sin((i / 16) * Math.PI) * 4 + dy;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
  }
}

/** 整个舞台背景:天空渐变 → 远景剪影 → 近景土丘 → 飘浮粒子 → 擂台地面 */
export function drawStage(g: Ctx, o: StageOpts): void {
  if (!fin(o.w) || !fin(o.h) || o.w <= 0 || o.h <= 0) return;
  const th = STAGE_THEMES[o.theme] ?? STAGE_THEMES.sakura;
  const sky = g.createLinearGradient(0, 0, 0, o.h);
  sky.addColorStop(0, th.skyTop);
  sky.addColorStop(1, th.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, o.w, o.h);
  if (o.theme === "night") farNight(g, o, th);
  else if (o.theme === "candy") farCandy(g, o, th);
  else farSakura(g, o, th);
  nearMounds(g, o, th);
  themeDrift(g, o, th);
  ringFloor(g, o, th);
}

// ---------------------------------------------------------------------------
// 姿态查表:phase / stance / 招式分段 → 一帧骨架参数(纯函数,不碰帧数逻辑)
// ---------------------------------------------------------------------------

export interface PoseInput {
  /** 引擎 phase(idle / walk / attack / hitstun / knockdown …) */
  phase: string;
  /** stand / crouch / air */
  stance: string;
  /** 当前招式类别(light / heavy / special / super / throw),无招 = null */
  moveKind: string | null;
  /** 出招分段(startup / active / recovery),无招 = null */
  seg: "startup" | "active" | "recovery" | null;
  /** 分段内进度 0–1 */
  prog: number;
  /** 渲染帧号(驱动呼吸 / 走路两帧 / 眨眼) */
  tick: number;
  /** 整场已分出胜负且胜者是自己 → 胜利姿势 */
  won: boolean;
}

export interface PoseFrame {
  /** 身体上下浮动 px(idle 呼吸 ±2px) */
  bob: number;
  /** 后仰角(rad,正 = 向后倾;重击后倾 8°) */
  lean: number;
  /** 屈膝程度 0–1 */
  crouch: number;
  /** 走路两帧:1 / -1 交替,0 = 不走 */
  step: -1 | 0 | 1;
  /** 出招伸展 0–1:startup 收拳 → active 拳到判定框中心 → recovery 收回 */
  strike: number;
  /** 双手上举(胜利) */
  raise: boolean;
  /** 躺倒(knockdown) */
  lying: boolean;
  /** 坐下休息(rest) */
  sitting: boolean;
  /** 抱盾(blockstun) */
  guard: boolean;
  mood: "normal" | "hurt" | "win" | "grit";
  blink: boolean;
}

const POSE_BASE: PoseFrame = {
  bob: 0,
  lean: 0,
  crouch: 0,
  step: 0,
  strike: 0,
  raise: false,
  lying: false,
  sitting: false,
  guard: false,
  mood: "normal",
  blink: false
};

/** 重击后倾角:规格钉 8° */
export const HEAVY_LEAN = (8 * Math.PI) / 180;

export function poseOf(p: PoseInput): PoseFrame {
  const t = wrap(p.tick, 120) / 120;
  const blink = t >= 0.62 && t < 0.7;
  if (p.won) {
    return { ...POSE_BASE, raise: true, mood: "win", bob: -Math.abs(Math.sin(t * TAU * 2)) * 3 };
  }
  switch (p.phase) {
    case "rest":
      return { ...POSE_BASE, sitting: true, crouch: 1, mood: "hurt" };
    case "knockdown":
      return { ...POSE_BASE, lying: true, mood: "hurt" };
    case "wakeup":
      return { ...POSE_BASE, crouch: 0.5, mood: "grit" };
    case "hitstun":
      return { ...POSE_BASE, lean: 0.18, mood: "hurt" };
    case "guardbreak":
      return { ...POSE_BASE, lean: 0.26, mood: "hurt" };
    case "blockstun":
      return { ...POSE_BASE, guard: true, crouch: p.stance === "crouch" ? 1 : 0.15, mood: "grit" };
    case "clash":
      return { ...POSE_BASE, lean: 0.1, strike: 0.4, mood: "grit" };
    case "jump":
      return { ...POSE_BASE, crouch: 0.45 };
    case "landing":
      return { ...POSE_BASE, crouch: 0.35 };
    case "walk":
      return { ...POSE_BASE, step: Math.floor(p.tick / 8) % 2 === 0 ? 1 : -1, bob: -1.2, blink };
    case "crouch":
      return { ...POSE_BASE, crouch: 1, blink };
    case "attack": {
      const ext =
        p.seg === "startup"
          ? 0.25 + 0.45 * Math.min(1, Math.max(0, p.prog))
          : p.seg === "active"
            ? 1
            : Math.max(0, 0.85 * (1 - Math.min(1, Math.max(0, p.prog))));
      return {
        ...POSE_BASE,
        strike: ext,
        lean: p.moveKind === "heavy" ? HEAVY_LEAN : p.moveKind === "super" ? 0.06 : 0.02,
        crouch: p.stance === "crouch" ? 0.9 : 0,
        mood: "grit"
      };
    }
    default:
      // idle:呼吸 ±2px,双拳收于胸前
      return { ...POSE_BASE, bob: Math.sin(t * TAU) * 2, blink };
  }
}

// ---------------------------------------------------------------------------
// 二头身 Q 版格斗家:大头 + 短身,分层绘制(后臂→身体→前臂→头→表情)
// ---------------------------------------------------------------------------

export type LimbKind = "arm" | "leg" | "both";

/** 出招目标点(局部坐标:前方 dx px、离地 dy px)与用哪条肢体去够它 */
export interface StrikeAim {
  dx: number;
  dy: number;
  limb: LimbKind;
}

export interface HeadOpts {
  x: number;
  y: number;
  r: number;
  look: CharLook;
  color: string;
  ink: string;
  mood: PoseFrame["mood"];
  blink: boolean;
  t: number;
}

/** 头饰后层(画在头之前) */
function hatBack(g: Ctx, o: HeadOpts): void {
  const { x, y, r } = o;
  const hat = o.look.hat;
  if (hat === "flower") {
    // 双层花瓣:后层暗、前层亮(kit 朵朵同款语汇)
    for (const [amt, rr] of [
      [0.2, 0.94],
      [0, 0.88]
    ] as const) {
      g.fillStyle = amt > 0 ? shade(o.color, amt) : o.color;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + (amt > 0 ? Math.PI / 8 : 0);
        pathOval(g, x + Math.cos(a) * r * rr, y + Math.sin(a) * r * rr, r * 0.42, r * 0.25, a);
        g.fill();
      }
    }
  } else if (hat === "star") {
    // 星形大脑袋轮廓(kit 星星同款语汇):底影 + 主体 + 圆角描边
    g.fillStyle = shade(o.color, 0.3);
    pathStar(g, x, y + r * 0.1, r * 1.6, r * 0.8);
    g.fill();
    g.fillStyle = o.color;
    pathStar(g, x, y, r * 1.6, r * 0.8);
    g.fill();
    g.strokeStyle = o.color;
    g.lineWidth = r * 0.28;
    g.lineJoin = "round";
    g.lineCap = "round";
    g.stroke();
  } else if (hat === "snow") {
    // 六臂雪花
    g.strokeStyle = "rgba(255,255,255,.95)";
    g.lineWidth = Math.max(r * 0.09, 0.8);
    g.lineCap = "round";
    const cy = y - r * 1.18;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      g.beginPath();
      g.moveTo(x, cy);
      g.lineTo(x + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5);
      g.stroke();
    }
    g.fillStyle = o.look.trim;
    g.beginPath();
    g.arc(x, cy, r * 0.14, 0, TAU);
    g.fill();
  }
}

/** 头饰前层(画在头之后、表情之前) */
function hatFront(g: Ctx, o: HeadOpts): void {
  const { x, y, r } = o;
  const hat = o.look.hat;
  if (hat === "dango") {
    // 三色小团子串
    g.strokeStyle = shade(o.look.dress, 0.35);
    g.lineWidth = Math.max(r * 0.09, 0.8);
    g.beginPath();
    g.moveTo(x, y - r * 0.9);
    g.lineTo(x, y - r * 2.35);
    g.stroke();
    const balls: Array<[number, string]> = [
      [-1.15, "#f9a8c9"],
      [-1.7, "#fff6ee"],
      [-2.2, "#a5e6c8"]
    ];
    for (const [k, color] of balls) {
      g.fillStyle = color;
      g.beginPath();
      g.arc(x, y + r * k, r * 0.3, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.65)";
      g.beginPath();
      g.arc(x - r * 0.1, y + r * k - r * 0.1, r * 0.09, 0, TAU);
      g.fill();
    }
  } else if (hat === "cloud") {
    // 云朵小帽:三团鼓包
    g.fillStyle = tint(o.color, 0.6);
    g.beginPath();
    g.arc(x - r * 0.5, y - r * 0.85, r * 0.42, 0, TAU);
    g.arc(x, y - r * 1.1, r * 0.52, 0, TAU);
    g.arc(x + r * 0.5, y - r * 0.85, r * 0.42, 0, TAU);
    g.fill();
    g.fillStyle = rgba(shade(o.color, 0.2), 0.5);
    pathOval(g, x, y - r * 0.78, r * 0.75, r * 0.16);
    g.fill();
  } else if (hat === "bear") {
    // 小熊耳朵
    for (const side of [-1, 1]) {
      g.fillStyle = o.color;
      g.beginPath();
      g.arc(x + side * r * 0.66, y - r * 0.72, r * 0.34, 0, TAU);
      g.fill();
      g.strokeStyle = o.ink;
      g.lineWidth = Math.max(r * 0.05, 0.6);
      g.stroke();
      g.fillStyle = tint(o.color, 0.5);
      g.beginPath();
      g.arc(x + side * r * 0.66, y - r * 0.72, r * 0.16, 0, TAU);
      g.fill();
    }
  } else if (hat === "spark") {
    // 四芒闪光发饰 + 侧边小闪
    g.fillStyle = KIT_PALETTE.lemon;
    pathStar(g, x, y - r * 1.22, r * 0.52, r * 0.2, -Math.PI / 2, 4);
    g.fill();
    g.strokeStyle = o.look.trim;
    g.lineWidth = Math.max(r * 0.06, 0.6);
    g.stroke();
    drawSparkle(g, { x: x + r * 0.85, y: y - r * 0.75, r: r * 0.2, t: o.t, color: "rgba(255,255,255,.9)" });
  } else if (hat === "sprout") {
    // 头顶豆芽:茎 + 两片叶
    g.strokeStyle = o.look.trim;
    g.lineWidth = Math.max(r * 0.1, 0.8);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, y - r * 0.92);
    g.lineTo(x, y - r * 1.36);
    g.stroke();
    g.fillStyle = o.look.dress;
    pathOval(g, x - r * 0.32, y - r * 1.42, r * 0.34, r * 0.17, -0.7);
    g.fill();
    pathOval(g, x + r * 0.32, y - r * 1.42, r * 0.34, r * 0.17, 0.7);
    g.fill();
  } else if (hat === "chick") {
    // 呆毛三根
    g.strokeStyle = o.look.trim;
    g.lineWidth = Math.max(r * 0.11, 0.8);
    g.lineCap = "round";
    for (const a of [-0.5, 0, 0.5]) {
      g.beginPath();
      g.moveTo(x, y - r * 0.9);
      g.lineTo(x + Math.sin(a) * r * 0.45, y - r * 0.9 - Math.cos(a) * r * 0.45);
      g.stroke();
    }
  } else if (hat === "peach") {
    // 桃子叶柄:短梗 + 两片叶
    g.strokeStyle = shade(o.look.trim, 0.25);
    g.lineWidth = Math.max(r * 0.09, 0.8);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, y - r * 0.9);
    g.lineTo(x + r * 0.1, y - r * 1.18);
    g.stroke();
    g.fillStyle = o.look.trim;
    pathOval(g, x - r * 0.24, y - r * 1.2, r * 0.32, r * 0.15, -0.5);
    g.fill();
    pathOval(g, x + r * 0.36, y - r * 1.24, r * 0.32, r * 0.15, 0.5);
    g.fill();
  } else if (hat === "flower") {
    // 前层两片高光花瓣
    g.fillStyle = tint(o.color, 0.4);
    for (const a of [-Math.PI * 0.75, -Math.PI * 0.5]) {
      pathOval(g, x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88, r * 0.26, r * 0.14, a);
      g.fill();
    }
  } else if (hat === "star") {
    // 左上星角高光
    g.fillStyle = tint(o.color, 0.5);
    pathOval(g, x - r * 0.62, y - r * 0.62, r * 0.26, r * 0.13, -0.65);
    g.fill();
  }
}

/** 表情:眼(圆眼 / >< / 眯眯眼)+ 腮红 + 嘴,mood 查表 */
function face(g: Ctx, o: HeadOpts): void {
  const { x, y, r } = o;
  const ink = KIT_PALETTE.ink;
  const eyeDX = r * 0.36;
  const eyeY = y - r * 0.06;
  const eyeR = Math.max(r * 0.14, 0.8);
  const fwd = r * 0.1; // 眼睛朝面向方向(局部 +x)微偏

  if (o.mood === "hurt") {
    // 「><」眼,不出血
    g.strokeStyle = ink;
    g.lineWidth = Math.max(r * 0.08, 0.6);
    g.lineCap = "round";
    for (const side of [-1, 1]) {
      const ex = x + side * eyeDX + fwd;
      g.beginPath();
      g.moveTo(ex - side * eyeR, eyeY - eyeR);
      g.lineTo(ex + side * eyeR * 0.6, eyeY);
      g.stroke();
      g.beginPath();
      g.moveTo(ex - side * eyeR, eyeY + eyeR);
      g.lineTo(ex + side * eyeR * 0.6, eyeY);
      g.stroke();
    }
  } else if (o.mood === "win" || o.blink) {
    const up = o.mood === "win";
    g.strokeStyle = ink;
    g.lineWidth = Math.max(r * 0.09, 0.6);
    g.lineCap = "round";
    for (const side of [-1, 1]) {
      const ex = x + side * eyeDX + fwd;
      g.beginPath();
      g.arc(ex, up ? eyeY + eyeR * 0.5 : eyeY - eyeR * 0.5, eyeR, up ? Math.PI * 1.15 : Math.PI * 0.15, up ? Math.PI * 1.85 : Math.PI * 0.85);
      g.stroke();
    }
  } else {
    for (const side of [-1, 1]) {
      const ex = x + side * eyeDX + fwd;
      g.fillStyle = ink;
      g.beginPath();
      g.arc(ex, eyeY, eyeR, 0, TAU);
      g.fill();
      g.fillStyle = KIT_PALETTE.cloud;
      g.beginPath();
      g.arc(ex - eyeR * 0.3, eyeY - eyeR * 0.32, eyeR * 0.34, 0, TAU);
      g.fill();
    }
    if (o.mood === "grit") {
      // 出招的认真眉
      g.strokeStyle = ink;
      g.lineWidth = Math.max(r * 0.07, 0.6);
      g.lineCap = "round";
      for (const side of [-1, 1]) {
        const ex = x + side * eyeDX + fwd;
        g.beginPath();
        g.moveTo(ex - side * eyeR * 0.9, eyeY - eyeR * 2);
        g.lineTo(ex + side * eyeR * 0.7, eyeY - eyeR * 1.4);
        g.stroke();
      }
    }
  }

  // 腮红
  g.fillStyle = rgba(KIT_PALETTE.blush, 0.5);
  for (const side of [-1, 1]) {
    pathOval(g, x + side * r * 0.6 + fwd * 0.5, y + r * 0.32, r * 0.17, r * 0.1);
    g.fill();
  }

  // 嘴 / 鸟嘴
  const mouthY = y + r * 0.38;
  if (o.look.hat === "chick") {
    g.fillStyle = o.look.trim;
    g.beginPath();
    g.moveTo(x + fwd - r * 0.16, mouthY - r * 0.14);
    g.lineTo(x + fwd + r * 0.26, mouthY - r * 0.02);
    g.lineTo(x + fwd - r * 0.16, mouthY + r * 0.1);
    g.closePath();
    g.fill();
  } else if (o.mood === "hurt") {
    g.strokeStyle = ink;
    g.lineWidth = Math.max(r * 0.08, 0.6);
    g.lineCap = "round";
    g.beginPath();
    g.arc(x + fwd, mouthY + r * 0.18, r * 0.2, Math.PI * 1.2, Math.PI * 1.8);
    g.stroke();
  } else if (o.mood === "win") {
    g.fillStyle = shade(o.color, 0.35);
    g.beginPath();
    g.arc(x + fwd, mouthY, r * 0.24, 0, Math.PI);
    g.closePath();
    g.fill();
  } else if (o.mood === "grit") {
    g.fillStyle = shade(o.color, 0.3);
    g.beginPath();
    g.arc(x + fwd, mouthY, r * 0.11, 0, TAU);
    g.fill();
  } else {
    g.strokeStyle = ink;
    g.lineWidth = Math.max(r * 0.08, 0.6);
    g.lineCap = "round";
    g.beginPath();
    g.arc(x + fwd, mouthY - r * 0.06, r * 0.17, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
  }
}

/** 大头(头饰后层 → 脸底 → 头饰前层 → 表情);HUD 头像与场上角色共用 */
export function drawFighterHead(g: Ctx, o: HeadOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.r) || o.r <= 0) return;
  hatBack(g, o);
  g.fillStyle = tint(o.color, 0.55);
  g.beginPath();
  g.arc(o.x, o.y, o.r, 0, TAU);
  g.fill();
  g.strokeStyle = o.ink;
  g.lineWidth = Math.max(o.r * 0.07, 0.8);
  g.stroke();
  hatFront(g, o);
  face(g, o);
}

export interface QFighterOpts {
  /** 脚底中心 x(世界坐标) */
  x: number;
  /** 脚底 y(世界坐标,空中时高于地面线) */
  feet: number;
  /** 地面线 y(画落地阴影用) */
  groundY: number;
  facing: 1 | -1;
  color: string;
  ink: string;
  look: CharLook;
  halfWidth: number;
  height: number;
  crouchHeight: number;
  pose: PoseFrame;
  /** 出招目标点(null = 不出招) */
  strike: StrikeAim | null;
  /** 秒级动画相位(倒地转圈星用) */
  t: number;
}

/** 躺倒姿势:横躺身体 + 头顶画的转圈星(不是 ✦ 字符) */
function drawLying(g: Ctx, o: QFighterOpts): void {
  const H = o.height;
  const hw = o.halfWidth;
  const headR = hw * 1.02;
  g.save();
  g.translate(o.x, o.feet);
  g.scale(o.facing, 1);
  // 身体横躺
  const grad = g.createLinearGradient(0, -hw * 1.6, 0, 0);
  grad.addColorStop(0, tint(o.look.dress, 0.25));
  grad.addColorStop(1, shade(o.look.dress, 0.12));
  g.fillStyle = grad;
  pathOval(g, H * 0.04, -hw * 0.82, H * 0.3, hw * 0.7);
  g.fill();
  g.strokeStyle = o.ink;
  g.lineWidth = 2;
  pathOval(g, H * 0.04, -hw * 0.82, H * 0.3, hw * 0.7);
  g.stroke();
  // 翘着的小短腿两条
  const legC = shade(o.look.dress, 0.2);
  limb(g, H * 0.24, -hw * 0.7, H * 0.34, -hw * 0.2, H * 0.075, legC);
  limb(g, H * 0.3, -hw * 0.85, H * 0.42, -hw * 0.5, H * 0.075, legC);
  // 摊开的手
  limb(g, -H * 0.1, -hw * 1.1, H * 0.02, -hw * 1.55, H * 0.07, tint(o.look.dress, 0.2));
  // 大头(朝后仰)
  drawFighterHead(g, {
    x: -H * 0.3,
    y: -headR * 0.95,
    r: headR,
    look: o.look,
    color: o.color,
    ink: o.ink,
    mood: "hurt",
    blink: false,
    t: o.t
  });
  // 头顶转圈星:三颗画的五角星沿椭圆轨道转
  for (let i = 0; i < 3; i++) {
    const a = o.t * 3 + (i * TAU) / 3;
    const sx = -H * 0.3 + Math.cos(a) * headR * 1.5;
    const sy = -headR * 2.15 + Math.sin(a) * headR * 0.4;
    g.fillStyle = rgba(KIT_PALETTE.starGold, 0.9);
    pathStar(g, sx, sy, 4.5, 2, a);
    g.fill();
  }
  g.restore();
}

/**
 * 二头身 Q 版格斗家(分层:影→后臂→后腿→身体渐变描边→前腿→前臂→头→表情)。
 * 视觉可略溢出判定框,判定尺寸一律不看这里。
 */
export function drawQFighter(g: Ctx, o: QFighterOpts): void {
  if (!fin(o.x) || !fin(o.feet) || !fin(o.height) || o.height <= 0) return;
  const P = o.pose;
  // 落地软阴影(跳得越高影子越小)
  const airH = Math.max(0, o.groundY - o.feet);
  const sh = Math.max(0.4, 1 - airH / 140);
  g.save();
  g.globalAlpha = 0.16 * sh + 0.04;
  g.fillStyle = KIT_PALETTE.ink;
  pathOval(g, o.x, o.groundY + 3, (o.halfWidth + 7) * sh, 5 * sh);
  g.fill();
  g.restore();

  if (P.lying) {
    drawLying(g, o);
    return;
  }

  const H = o.height;
  const hw = o.halfWidth;
  const headR = hw * 1.06;
  const sit = P.sitting;
  const crouchK = Math.min(1, P.crouch);
  const bodyH = sit ? o.crouchHeight * 0.72 : H - (H - o.crouchHeight) * crouchK;
  const dress = o.look.dress;

  g.save();
  g.translate(o.x, o.feet);
  g.scale(o.facing, 1);
  if (P.lean !== 0) g.rotate(-P.lean);

  const bob = P.bob;
  const headCY = -(bodyH - headR) + bob;
  const torsoTopY = headCY + headR * 0.62;
  const legLen = sit ? H * 0.06 : H * 0.16 * (1 - 0.55 * crouchK);
  const torsoBotY = -legLen + 2;
  const torsoCY = (torsoTopY + torsoBotY) / 2;
  const torsoRY = Math.max(3, (torsoBotY - torsoTopY) / 2 + 2);
  const chestY = torsoTopY + H * 0.1;
  const limbW = H * 0.085;
  const armLen = H * 0.17;
  const armC = tint(dress, 0.22);
  const legC = shade(dress, 0.16);
  const shoeC = shade(dress, 0.3);
  const fistC = tint(o.color, 0.35);
  const ext = P.strike;
  const aim = o.strike;
  // 出招目标点(局部):startup 收在胸前 → active 到判定框中心 → recovery 收回
  const hitX = aim ? aim.dx * (0.18 + 0.82 * ext) : 0;
  const hitY = aim ? (1 - ext) * chestY - ext * aim.dy : 0;

  const drawFist = (fx: number, fy: number, r: number): void => {
    g.fillStyle = fistC;
    g.beginPath();
    g.arc(fx, fy, r, 0, TAU);
    g.fill();
    g.strokeStyle = o.ink;
    g.lineWidth = Math.max(H * 0.014, 0.6);
    g.stroke();
  };

  const drawShoe = (fx: number, fy: number): void => {
    g.fillStyle = shoeC;
    pathOval(g, fx + H * 0.014, fy, limbW * 0.75, limbW * 0.52);
    g.fill();
  };

  // ---- 后臂 ----
  const shoulderY = torsoTopY + 3;
  if (P.raise) {
    limb(g, -hw * 0.5, shoulderY, -hw * 0.62, shoulderY - H * 0.2, limbW, armC);
    drawFist(-hw * 0.62, shoulderY - H * 0.2, H * 0.055);
  } else if (aim && aim.limb === "both" && ext > 0) {
    limb(g, -hw * 0.5, shoulderY, hitX - H * 0.06, hitY + H * 0.05, limbW, armC);
    drawFist(hitX - H * 0.06, hitY + H * 0.05, H * 0.055);
  } else if (aim && aim.limb === "arm" && ext > 0) {
    // 打拳时后臂往回收
    limb(g, -hw * 0.5, shoulderY, -hw * 0.85, chestY + H * 0.05, limbW, armC);
    drawFist(-hw * 0.85, chestY + H * 0.05, H * 0.05);
  } else if (P.guard) {
    limb(g, -hw * 0.5, shoulderY, hw * 0.42, chestY + H * 0.05, limbW, armC);
  } else if (P.step !== 0) {
    limb(g, -hw * 0.5, shoulderY, -hw * 0.5 - P.step * H * 0.08, shoulderY + armLen, limbW, armC);
  } else {
    limb(g, -hw * 0.5, shoulderY, hw * 0.32, chestY + 2, limbW, armC);
    drawFist(hw * 0.32, chestY + 2, H * 0.05);
  }

  // ---- 腿(后腿先画) ----
  const hipY = -legLen;
  if (sit) {
    // 坐下休息:小短腿往前伸平
    limb(g, hw * 0.1, -4, hw * 1.2, -3, limbW, legC);
    drawShoe(hw * 1.2, -3);
    limb(g, -hw * 0.15, -4, hw * 0.9, -6, limbW, legC);
    drawShoe(hw * 0.9, -6);
  } else if (aim && aim.limb === "leg" && ext > 0) {
    // 重脚:后腿站桩,前腿踢向判定框中心
    limb(g, -hw * 0.35, hipY, -hw * 0.42, 0, limbW * 1.1, legC);
    drawShoe(-hw * 0.42, -1);
  } else {
    const backAng = P.step * -0.45;
    limb(g, -hw * 0.35, hipY, -hw * 0.35 + Math.sin(backAng) * legLen, hipY + Math.cos(backAng) * legLen, limbW * 1.05, legC);
    drawShoe(-hw * 0.35 + Math.sin(backAng) * legLen, hipY + Math.cos(backAng) * legLen - 1);
  }

  // ---- 身体:渐变 + 描边(沿用 ch.color/ch.ink 语汇,主体用 look.dress) ----
  const grad = g.createLinearGradient(0, torsoTopY, 0, 2);
  grad.addColorStop(0, tint(dress, 0.28));
  grad.addColorStop(1, shade(dress, 0.1));
  g.fillStyle = grad;
  pathOval(g, 0, torsoCY, hw * 1.08, torsoRY);
  g.fill();
  g.strokeStyle = o.ink;
  g.lineWidth = Math.max(H * 0.022, 1);
  pathOval(g, 0, torsoCY, hw * 1.08, torsoRY);
  g.stroke();
  // 腰带点缀(look.trim 双色通道)
  g.fillStyle = o.look.trim;
  pathOval(g, 0, torsoCY + torsoRY * 0.4, hw * 0.95, Math.max(2, torsoRY * 0.2));
  g.fill();
  // 衣面高光斑
  g.fillStyle = rgba(tint(dress, 0.6), 0.85);
  pathOval(g, -hw * 0.35, torsoCY - torsoRY * 0.35, hw * 0.3, torsoRY * 0.28, 0.4);
  g.fill();

  // ---- 前腿 ----
  if (!sit) {
    if (aim && aim.limb === "leg" && ext > 0) {
      limb(g, hw * 0.3, hipY, hitX, hitY, limbW * 1.2, legC);
      drawShoe(hitX, hitY);
    } else {
      const frontAng = P.step * 0.45 + crouchK * 0.5;
      limb(g, hw * 0.35, hipY, hw * 0.35 + Math.sin(frontAng) * legLen, hipY + Math.cos(frontAng) * legLen, limbW * 1.05, legC);
      drawShoe(hw * 0.35 + Math.sin(frontAng) * legLen, hipY + Math.cos(frontAng) * legLen - 1);
    }
  }

  // ---- 前臂 ----
  if (P.raise) {
    limb(g, hw * 0.5, shoulderY, hw * 0.62, shoulderY - H * 0.22, limbW, armC);
    drawFist(hw * 0.62, shoulderY - H * 0.22, H * 0.055);
  } else if (aim && (aim.limb === "arm" || aim.limb === "both") && ext > 0) {
    limb(g, hw * 0.5, shoulderY, hitX, hitY, limbW * 1.1, armC);
    drawFist(hitX, hitY, H * 0.062);
    if (ext > 0.85) {
      // 拳后两道小速度线
      g.strokeStyle = "rgba(255,255,255,.8)";
      g.lineWidth = 1.5;
      g.lineCap = "round";
      for (const dy of [-4, 4]) {
        g.beginPath();
        g.moveTo(hitX - H * 0.16, hitY + dy);
        g.lineTo(hitX - H * 0.05, hitY + dy);
        g.stroke();
      }
    }
  } else if (P.guard) {
    limb(g, hw * 0.5, shoulderY, hw * 0.55, chestY - 2, limbW, armC);
    drawFist(hw * 0.55, chestY - 2, H * 0.055);
    // 小盾弧
    g.strokeStyle = "rgba(95,168,232,.8)";
    g.lineWidth = 3;
    g.lineCap = "round";
    g.beginPath();
    g.arc(hw * 0.6, chestY, H * 0.2, -1.1, 1.1);
    g.stroke();
  } else if (P.step !== 0) {
    limb(g, hw * 0.5, shoulderY, hw * 0.5 + P.step * H * 0.08, shoulderY + armLen, limbW, armC);
  } else {
    limb(g, hw * 0.5, shoulderY, hw * 0.42, chestY, limbW, armC);
    drawFist(hw * 0.42, chestY, H * 0.055);
  }

  // ---- 头 + 表情 ----
  drawFighterHead(g, {
    x: hw * 0.08,
    y: headCY,
    r: headR,
    look: o.look,
    color: o.color,
    ink: o.ink,
    mood: P.mood,
    blink: P.blink,
    t: o.t
  });

  // 硬直小星(画的星形,替代 ✦ 字符)
  if (P.mood === "hurt" && !P.lying && !sit) {
    g.fillStyle = rgba(KIT_PALETTE.starGold, 0.9);
    pathStar(g, -headR * 0.8, headCY - headR * 1.4, 4, 1.8, o.t * 4);
    g.fill();
    pathStar(g, headR * 0.9, headCY - headR * 1.6, 3.2, 1.5, -o.t * 4);
    g.fill();
  }

  g.restore();
}

// ---------------------------------------------------------------------------
// P1 / P2 脚下光环:红圆环 vs 蓝方环(颜色 + 形状双通道,色弱也能分)
// ---------------------------------------------------------------------------

export const AURA_COLORS = { p1: "#ff5f7a", p2: "#5fa8e8" } as const;

export interface AuraOpts {
  x: number;
  groundY: number;
  side: 0 | 1;
  t: number;
  soft: boolean;
}

export function drawSeatAura(g: Ctx, o: AuraOpts): void {
  if (!fin(o.x) || !fin(o.groundY)) return;
  const pulse = o.soft ? 0 : Math.sin(o.t * TAU * 0.8) * 1.5;
  g.save();
  g.translate(o.x, o.groundY + 2);
  g.scale(1, 0.34);
  g.lineCap = "round";
  if (o.side === 0) {
    // P1:红色圆环(外粗内细)
    const r = 24 + pulse;
    g.globalAlpha = 0.85;
    g.strokeStyle = AURA_COLORS.p1;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.stroke();
    g.globalAlpha = 0.4;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(0, 0, r * 0.7, 0, TAU);
    g.stroke();
  } else {
    // P2:蓝色方环(缓慢自转的菱形观感)
    const s = 21 + pulse;
    if (!o.soft) g.rotate(o.t * 0.5);
    g.globalAlpha = 0.85;
    g.strokeStyle = AURA_COLORS.p2;
    g.lineWidth = 3;
    g.strokeRect(-s, -s, s * 2, s * 2);
    g.globalAlpha = 0.4;
    g.lineWidth = 1.5;
    g.strokeRect(-s * 0.62, -s * 0.62, s * 1.24, s * 1.24);
  }
  g.restore();
}

// ---------------------------------------------------------------------------
// 出招弧光 / 命中火花 / 破防盾碎 / 连击数字 / KO 彩带
// ---------------------------------------------------------------------------

export interface SlashOpts {
  x: number;
  y: number;
  facing: 1 | -1;
  /** 弧光半径基准(按判定框尺寸换算,只用来画,不反哺判定) */
  size: number;
  /** active 进度 0–1(驱动淡出) */
  k: number;
  /** 招式类别:light 小弧 / heavy 大弧+残影 / special / super 双弧 */
  kind: string;
  color: string;
  soft: boolean;
}

/** 攻击弧光:沿出招方向的月牙渐变刀光(替代把判定框画成白矩形) */
export function drawArcSlash(g: Ctx, o: SlashOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.size) || o.size <= 0) return;
  const heavy = o.kind === "heavy";
  const sup = o.kind === "super";
  const spec = o.kind === "special";
  const r = o.size * (sup ? 1.3 : heavy ? 1.15 : spec ? 1.05 : 0.85);
  const fade = 1 - Math.min(1, Math.max(0, o.k)) * 0.7;
  g.save();
  g.translate(o.x, o.y);
  g.scale(o.facing, 1);
  const grad = g.createLinearGradient(-r * 0.5, 0, r, 0);
  grad.addColorStop(0, rgba(o.color, 0));
  grad.addColorStop(0.65, rgba(o.color, 0.5 * fade));
  grad.addColorStop(1, `rgba(255,255,255,${Math.min(1, 0.9 * fade)})`);
  const crescent = (rot: number, alpha: number): void => {
    g.save();
    g.rotate(rot);
    g.globalAlpha = alpha;
    g.beginPath();
    const a0 = -1.15;
    const a1 = 1.15;
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    for (let i = steps; i >= 0; i--) {
      const a = a0 + ((a1 - a0) * i) / steps;
      g.lineTo(Math.cos(a) * r * 0.55 - r * 0.25, Math.sin(a) * r * 0.62);
    }
    g.closePath();
    g.fillStyle = grad;
    g.fill();
    g.restore();
  };
  // 重招残影两道(soft 关);超必双弧演出
  if (heavy && !o.soft) {
    crescent(-0.3, 0.25 * fade);
    crescent(0.3, 0.25 * fade);
  }
  if (sup) {
    crescent(0.55, 0.35 * fade);
    crescent(-0.55, 0.35 * fade);
  }
  crescent(0, 1);
  if (sup && !o.soft) {
    drawSparkle(g, { x: r * 0.7, y: -r * 0.4, r: r * 0.18, t: o.k, color: "rgba(255,255,255,.95)" });
  }
  g.restore();
}

/** 命中火花放射短线根数(规格:6–8 根) */
export const HIT_SPARK_RAYS = 7;
/** 命中闪白帧数(0.15s × 60fps) */
export const HIT_FLASH_FRAMES = 9;

export interface HitSparkOpts {
  x: number;
  y: number;
  /** 播放进度 0–1 */
  k: number;
  power: number;
}

/** 命中火花:放射状短线 6–8 根 + 中心闪白圆,0.15s 播完 */
export function drawHitSpark(g: Ctx, o: HitSparkOpts): void {
  if (!fin(o.x) || !fin(o.y)) return;
  const k = Math.min(1, Math.max(0, o.k));
  const fade = 1 - k;
  const reach = (9 + Math.min(14, (fin(o.power) ? o.power : 5) * 0.35)) * (0.35 + 0.65 * k);
  g.save();
  g.translate(o.x, o.y);
  g.strokeStyle = "#ffffff";
  g.lineWidth = 2;
  g.lineCap = "round";
  g.globalAlpha = 0.9 * fade;
  const r0 = 4 + 8 * k;
  for (let i = 0; i < HIT_SPARK_RAYS; i++) {
    const a = (i / HIT_SPARK_RAYS) * TAU + 0.35;
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * (r0 + reach), Math.sin(a) * (r0 + reach));
    g.stroke();
  }
  g.strokeStyle = rgba(KIT_PALETTE.starGold, 0.7 * fade);
  g.lineWidth = 2;
  g.beginPath();
  g.arc(0, 0, 6 + 16 * k, 0, TAU);
  g.stroke();
  // 中心闪白圆
  g.globalAlpha = Math.min(1, 0.95 * fade);
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(0, 0, 7 * fade + 1.5, 0, TAU);
  g.fill();
  g.restore();
}

/** 破防盾碎片数量(规格:蓝色三角 6 片) */
export const SHARD_COUNT = 6;

export interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  maxLife: number;
}

/** 破防:6 片蓝色三角盾碎片散开(确定性布点,测试可复现) */
export function makeShatter(x: number, y: number): Shard[] {
  const out: Shard[] = [];
  if (!fin(x) || !fin(y)) return out;
  for (let i = 0; i < SHARD_COUNT; i++) {
    const a = (i / SHARD_COUNT) * TAU - Math.PI / 2;
    const v = 2.2 + (i % 2) * 0.9;
    const life = 22 + (i % 3) * 4;
    out.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, rot: a, vr: 0.2 + (i % 3) * 0.1, life, maxLife: life });
  }
  return out;
}

export function drawGuardShard(g: Ctx, s: Shard): void {
  const k = Math.max(0, s.life / s.maxLife);
  if (k <= 0) return;
  g.save();
  g.translate(s.x, s.y);
  g.rotate(s.rot);
  g.globalAlpha = 0.9 * k;
  g.beginPath();
  g.moveTo(0, -5);
  g.lineTo(4.5, 3);
  g.lineTo(-4.5, 3);
  g.closePath();
  g.fillStyle = AURA_COLORS.p2;
  g.fill();
  g.strokeStyle = "rgba(255,255,255,.7)";
  g.lineWidth = 1;
  g.stroke();
  g.restore();
}

export interface ComboPopOpts {
  x: number;
  y: number;
  n: number;
  /** 弹出后经过的帧数 */
  age: number;
  soft: boolean;
}

/** 连击 ≥ 3 时角落弹出的大号连击数字(弹跳缓动,soft 不缩放) */
export function drawComboPop(g: Ctx, o: ComboPopOpts): void {
  if (!fin(o.x) || !fin(o.y) || !fin(o.n) || o.n < 3) return;
  const k = Math.min(1, o.age / 10);
  const s = o.soft ? 1 : 1 + (1 - k) * 0.7;
  const alpha = o.age > 36 ? Math.max(0, 1 - (o.age - 36) / 12) : 1;
  if (alpha <= 0) return;
  g.save();
  g.translate(o.x, o.y);
  g.scale(s, s);
  g.globalAlpha = alpha;
  g.font = "900 26px system-ui";
  g.textAlign = "center";
  g.fillStyle = "rgba(74,59,62,.4)";
  g.fillText(`${o.n} 连!`, 2, 2);
  g.fillStyle = KIT_PALETTE.candyDeep;
  g.fillText(`${o.n} 连!`, 0, 0);
  g.restore();
}

/** KO 演出帧数(0.3s × 60fps 震屏 + 胜利姿势) */
export const KO_FRAMES = 18;
/** 彩带片数(规格:20 片) */
export const CONFETTI_COUNT = 20;

const CONFETTI_COLORS = [KIT_PALETTE.candy, KIT_PALETTE.lemon, KIT_PALETTE.mint, KIT_PALETTE.lilac, KIT_PALETTE.starGold];

export interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
  maxLife: number;
}

/** KO 彩带:20 片小纸屑往上抛(确定性布点) */
export function makeConfetti(x: number, y: number, count = CONFETTI_COUNT): ConfettiPiece[] {
  const out: ConfettiPiece[] = [];
  if (!fin(x) || !fin(y)) return out;
  const n = Math.max(1, Math.min(64, Math.round(count)));
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1 || 1)) * Math.PI;
    const v = 2 + (i % 4) * 0.8;
    const life = 42 + (i % 5) * 6;
    out.push({
      x,
      y,
      vx: Math.cos(a) * v * 1.4,
      vy: Math.sin(a) * v - 2.4,
      rot: (i / n) * TAU,
      vr: 0.12 + (i % 3) * 0.08,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      life,
      maxLife: life
    });
  }
  return out;
}

export function drawConfettiPiece(g: Ctx, p: ConfettiPiece): void {
  const k = Math.max(0, p.life / p.maxLife);
  if (k <= 0) return;
  g.save();
  g.translate(p.x, p.y);
  g.rotate(p.rot);
  g.globalAlpha = Math.min(1, k * 1.4);
  g.fillStyle = p.color;
  g.fillRect(-3.2, -1.6, 6.4, 3.2);
  g.restore();
}

/** KO 文案:分级红线——只用「获胜」这一种说法 */
export function koBannerText(name: string | null): string {
  return name ? `${name} 获胜!` : "平局!";
}

export interface KoBannerOpts {
  w: number;
  text: string;
  t: number;
}

/** KO 横幅:居中大字 + 两侧星星 */
export function drawKoBanner(g: Ctx, o: KoBannerOpts): void {
  if (!fin(o.w) || o.w <= 0) return;
  const y = 76;
  g.save();
  g.textAlign = "center";
  g.font = "900 30px system-ui";
  g.fillStyle = "rgba(74,59,62,.42)";
  g.fillText(o.text, o.w / 2 + 2, y + 2);
  g.fillStyle = "#e0568f";
  g.fillText(o.text, o.w / 2, y);
  for (const side of [-1, 1]) {
    drawStar(g, { x: o.w / 2 + side * 96, y: y - 10, r: 10, t: o.t, color: KIT_PALETTE.starGold });
  }
  g.restore();
}

// ---------------------------------------------------------------------------
// 投射物 / 星屑 / HUD 头像与星徽
// ---------------------------------------------------------------------------

export interface OrbOpts {
  cx: number;
  cy: number;
  r: number;
  color: string;
  t: number;
  facing: 1 | -1;
}

/** 投射物:发光小圆球(拖尾 + 光晕 + 高光 + 星芒),替代圆角矩形色块 */
export function drawProjectileOrb(g: Ctx, o: OrbOpts): void {
  if (!fin(o.cx) || !fin(o.cy) || !fin(o.r) || o.r <= 0) return;
  for (let j = 3; j >= 1; j--) {
    g.fillStyle = rgba(o.color, 0.3 - j * 0.07);
    g.beginPath();
    g.arc(o.cx - o.facing * j * 7, o.cy, Math.max(1, o.r * (1 - j * 0.18)), 0, TAU);
    g.fill();
  }
  g.fillStyle = rgba(o.color, 0.22);
  g.beginPath();
  g.arc(o.cx, o.cy, o.r * 1.6, 0, TAU);
  g.fill();
  g.fillStyle = o.color;
  g.beginPath();
  g.arc(o.cx, o.cy, o.r, 0, TAU);
  g.fill();
  g.strokeStyle = shade(o.color, 0.3);
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = tint(o.color, 0.55);
  g.beginPath();
  g.arc(o.cx - o.r * 0.25, o.cy - o.r * 0.28, o.r * 0.45, 0, TAU);
  g.fill();
  g.fillStyle = "rgba(255,255,255,.85)";
  pathStar(g, o.cx + o.r * 0.1, o.cy - o.r * 0.15, o.r * 0.5, o.r * 0.18, o.t * TAU, 4);
  g.fill();
}

/** 小星屑(替代 ✦ 字符粒子) */
export function drawMiniStar(g: Ctx, x: number, y: number, r: number, color: string): void {
  if (!fin(x) || !fin(y) || !fin(r) || r <= 0) return;
  g.fillStyle = color;
  pathStar(g, x, y, r, r * 0.45);
  g.fill();
}

export interface MiniAvatarOpts {
  /** 画布边长(规格:HUD 头像 24px) */
  size: number;
  color: string;
  ink: string;
  look: CharLook;
}

/** HUD 血条端头的角色小头像(复用角色头部函数) */
export function drawMiniAvatar(g: Ctx, o: MiniAvatarOpts): void {
  if (!fin(o.size) || o.size <= 0) return;
  const c = o.size / 2;
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(c, c, c - 0.5, 0, TAU);
  g.fill();
  g.strokeStyle = rgba(o.ink, 0.4);
  g.lineWidth = 1;
  g.stroke();
  drawFighterHead(g, {
    x: c,
    y: c + o.size * 0.06,
    r: o.size * 0.34,
    look: o.look,
    color: o.color,
    ink: o.ink,
    mood: "normal",
    blink: false,
    t: 0
  });
}

export interface WinBadgeOpts {
  /** 点亮几颗 */
  n: number;
  /** 一共几格 */
  total: number;
  w: number;
  h: number;
}

/** 元气星徽:画的星星徽章替代 ♥ 文字(亮星用 kit drawStar,空槽淡星) */
export function drawWinBadges(g: Ctx, o: WinBadgeOpts): void {
  if (!fin(o.w) || !fin(o.h) || o.w <= 0 || o.h <= 0 || o.total <= 0) return;
  for (let i = 0; i < o.total; i++) {
    const cx = ((i + 0.5) * o.w) / o.total;
    const cy = o.h / 2;
    const r = o.h * 0.34;
    if (i < o.n) {
      drawStar(g, { x: cx, y: cy, r, t: 0, color: KIT_PALETTE.starGold });
    } else {
      g.fillStyle = rgba(KIT_PALETTE.ink, 0.15);
      pathStar(g, cx, cy, r, r * 0.45);
      g.fill();
    }
  }
}
