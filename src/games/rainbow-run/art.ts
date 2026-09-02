// 彩虹跑跑 · 1.3 视觉资产库(纯绘制函数与查表,不碰任何玩法数值)。
//
// `src/art/kit/` 尚未建立,按 visual-bible 的约定把本款的视觉资产收在这一份里:
// 星币旋转帧、彩虹跑者、障碍立面、道具图标、视差剪影主题表。
// 全部是「给定输入必出同一串绘制调用」的纯函数,视觉契约测试拿录制型
// 上下文直接断言;判定、速度、关卡数值一个都不在这里。
// 纯 Canvas 2D,不引任何三维库。

import type { ObstacleKind, PowerKind, Theme } from "./logic";

type Ctx = CanvasRenderingContext2D;

/* ====================================================================== */
/* 星币:8 帧绕 Y 轴旋转的预渲染 sprite                                    */
/* ====================================================================== */

/** 一整圈切成几帧(预渲染到离屏画布,播放时 drawImage)。 */
export const COIN_FRAME_COUNT = 8;
/** 每秒播几帧:8 帧一圈 ≈ 0.8 秒转一整圈。 */
export const COIN_SPIN_FPS = 10;
/** 扫光周期(秒):每 1.2 秒一道斜向亮光扫过币面。 */
export const COIN_SWEEP_PERIOD = 1.2;
/** 投影缩到这个倍率以下就退化成亮点(360px 红线:性能 + 可读)。 */
export const COIN_DOT_SCALE = 0.16;
/** 离屏帧的留白(像素,乘超采样前)。 */
export const COIN_SPRITE_PAD = 4;

export const COIN_GOLD_LIGHT = "#ffe9a0";
export const COIN_GOLD_MID = "#f8c860";
export const COIN_GOLD_DEEP = "#f0a828";
export const COIN_GOLD_BACK = "#dc9422";
export const COIN_GOLD_EDGE = "#b87818";

/** 五角星路径(xScale 带符号:绕 Y 轴转到背面时星星跟着镜像)。 */
export function starPath(ctx: Ctx, r: number, xScale = 1): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const sx = Math.cos(a) * rr * xScale;
    const sy = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
}

/** 第 frame 帧的横向压缩比:1 → 0.25 → 1,模拟绕 Y 轴旋转。 */
export function coinFrameRatio(frame: number, total = COIN_FRAME_COUNT): number {
  const a = (Math.PI * 2 * frame) / total;
  return Math.max(0.25, Math.abs(Math.cos(a)));
}

/**
 * 画一帧星币(画在原点,半径 r):
 * 金色径向渐变币面 + 深金描边 + 内圈亮环凹槽 + 中心五角星压印;
 * 侧过去的帧露出 2px 厚度侧棱,背面帧调暗并把星星镜像。
 */
export function drawCoinFrame(ctx: Ctx, r: number, frame: number, total = COIN_FRAME_COUNT): void {
  const ang = (Math.PI * 2 * frame) / total;
  const cosA = Math.cos(ang);
  const ratio = Math.max(0.25, Math.abs(cosA));
  const rx = r * ratio;
  const lean = Math.sin(ang);
  // 厚度侧棱:窄面那一侧露出一条深金
  ctx.fillStyle = COIN_GOLD_EDGE;
  ctx.beginPath();
  ctx.ellipse(-lean * 2, 0.6, rx, r, 0, 0, Math.PI * 2);
  ctx.fill();
  // 币面:金色径向渐变(背面帧调暗一档)
  const g = ctx.createRadialGradient(-rx * 0.35, -r * 0.4, r * 0.12, 0, 0, r * 1.05);
  g.addColorStop(0, COIN_GOLD_LIGHT);
  g.addColorStop(0.55, cosA >= 0 ? COIN_GOLD_MID : COIN_GOLD_BACK);
  g.addColorStop(1, COIN_GOLD_DEEP);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COIN_GOLD_EDGE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 内圈亮环凹槽
  ctx.strokeStyle = COIN_GOLD_LIGHT;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.68, r * 0.68, 0, 0, Math.PI * 2);
  ctx.stroke();
  // 中心五角星压印(侧到快看不见就不画,给侧面帧留出区分)
  if (Math.abs(cosA) >= 0.35) {
    ctx.fillStyle = COIN_GOLD_EDGE;
    starPath(ctx, r * 0.42, cosA);
    ctx.fill();
  }
}

/** 离屏画布的最小面目(真环境是 HTMLCanvasElement,测试给个录制桩就行)。 */
export interface SpriteCanvas {
  width: number;
  height: number;
  getContext(id: "2d"): unknown;
}

export type CanvasFactory = (w: number, h: number) => SpriteCanvas;

export interface CoinSprite {
  frames: SpriteCanvas[];
  /** 播放时 drawImage 的半边长(逻辑像素) */
  half: number;
  /** 超采样倍率 */
  ss: number;
}

/** 预渲染 8 帧星币到离屏画布(只建一次,之后每帧 drawImage)。 */
export function makeCoinSprite(r: number, ss: number, create: CanvasFactory): CoinSprite {
  const half = r + COIN_SPRITE_PAD;
  const size = Math.ceil(half * 2 * ss);
  const frames: SpriteCanvas[] = [];
  for (let f = 0; f < COIN_FRAME_COUNT; f++) {
    const canvas = create(size, size);
    const g = canvas.getContext("2d") as Ctx | null;
    if (!g) continue;
    g.translate(size / 2, size / 2);
    g.scale(ss, ss);
    drawCoinFrame(g, r, f);
    frames.push(canvas);
  }
  return { frames, half, ss };
}

/** 这一刻该播第几帧。 */
export function coinFrameAt(t: number, total = COIN_FRAME_COUNT): number {
  return Math.floor(Math.max(0, t) * COIN_SPIN_FPS) % total;
}

/** 播放一帧星币(画在原点)。 */
export function drawCoin(ctx: Ctx, sprite: CoinSprite, frame: number): void {
  const n = sprite.frames.length;
  if (n === 0) return;
  const img = sprite.frames[((frame % n) + n) % n];
  const half = sprite.half;
  ctx.drawImage(img as unknown as CanvasImageSource, -half, -half, half * 2, half * 2);
}

/** 扫光相位:每 COIN_SWEEP_PERIOD 秒里前 22% 时间返回 0..1,其余 -1(不画)。 */
export function coinSweepPhase(t: number): number {
  const p = (((t % COIN_SWEEP_PERIOD) + COIN_SWEEP_PERIOD) % COIN_SWEEP_PERIOD) / COIN_SWEEP_PERIOD;
  return p < 0.22 ? p / 0.22 : -1;
}

/** 一道斜向亮光扫过币面(phase < 0 不画)。 */
export function drawCoinSweep(ctx: Ctx, r: number, phase: number): void {
  if (phase < 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(-0.6);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(-r * 2 + phase * r * 4 - r * 0.35, -r * 2, r * 0.7, r * 4);
  ctx.restore();
}

/** 远处的星币退化画法:两层亮点,省性能也保可读。 */
export function drawCoinDot(ctx: Ctx, r: number): void {
  ctx.fillStyle = COIN_GOLD_DEEP;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COIN_GOLD_LIGHT;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

/** 星币该用哪档画法:投影太小就退化成亮点。 */
export function coinLOD(scale: number): "dot" | "sprite" {
  return scale < COIN_DOT_SCALE ? "dot" : "sprite";
}

/* ====================================================================== */
/* 星星与道具泡泡                                                          */
/* ====================================================================== */

/** 收集星:光晕 + 星体 + 内芯 + 火花(twinkle 0..1 控制光晕呼吸)。 */
export function drawStarPickup(ctx: Ctx, r: number, twinkle: number): void {
  const glow = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2);
  glow.addColorStop(0, `rgba(255,227,135,${0.4 + 0.25 * Math.max(0, Math.min(1, twinkle))})`);
  glow.addColorStop(1, "rgba(255,227,135,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffd868";
  starPath(ctx, r);
  ctx.fill();
  ctx.strokeStyle = "#e0a030";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#fff3c2";
  starPath(ctx, r * 0.5);
  ctx.fill();
}

/**
 * HUD 心心(画在原点,半径 r;visual-r1 修 A 档 P-07):
 * 实心=粉系径向渐变 + 深粉描边 + 左上高光点;空心=灰白面 + 浅描边。
 * 掉几颗心从形色两个通道都读得出来,替掉 💗🤍 emoji 直出。
 */
export function drawHeartPip(ctx: Ctx, r: number, filled: boolean): void {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.9);
  ctx.bezierCurveTo(-r * 1.15, r * 0.15, -r * 0.85, -r * 0.85, 0, -r * 0.25);
  ctx.bezierCurveTo(r * 0.85, -r * 0.85, r * 1.15, r * 0.15, 0, r * 0.9);
  ctx.closePath();
  if (filled) {
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r * 1.15);
    g.addColorStop(0, "#ffd3e2");
    g.addColorStop(0.55, "#ff8fb4");
    g.addColorStop(1, "#f0608e");
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.82)";
  }
  ctx.fill();
  ctx.strokeStyle = filled ? "#d84a7c" : "#c9b8c4";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (filled) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.36, r * 0.2, r * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** HUD 节奏音符小图标(画在原点,半径 r):实心符头 + 符干 + 小旗,配节奏关连击计数。 */
export function drawNoteChip(ctx: Ctx, r: number): void {
  ctx.fillStyle = "#8a5ac9";
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, r * 0.5, r * 0.44, r * 0.32, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8a5ac9";
  ctx.lineWidth = Math.max(1.5, r * 0.2);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(r * 0.1, r * 0.42);
  ctx.lineTo(r * 0.1, -r * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.1, -r * 0.7);
  ctx.quadraticCurveTo(r * 0.6, -r * 0.55, r * 0.66, -r * 0.05);
  ctx.stroke();
}

/** 道具的泡泡球底:渐变球体 + 描边 + 左上高光弧,替掉原来的白圈。 */
export function drawBubble(ctx: Ctx, r: number): void {
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.2, 0, 0, r);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.75, "rgba(238,231,255,0.92)");
  g.addColorStop(1, "rgba(201,166,242,0.9)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#b28ae8";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = r * 0.14;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, Math.PI * 1.05, Math.PI * 1.45);
  ctx.stroke();
}

/** 磁铁:红蹄形 + 银端(s 是半个图标的尺度)。 */
export function drawMagnetIcon(ctx: Ctx, s: number): void {
  const arm = s * 0.62;
  ctx.strokeStyle = "#e0485a";
  ctx.lineWidth = s * 0.55;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.arc(0, 0, arm, Math.PI, Math.PI * 2);
  ctx.moveTo(-arm, 0);
  ctx.lineTo(-arm, s * 0.45);
  ctx.moveTo(arm, 0);
  ctx.lineTo(arm, s * 0.45);
  ctx.stroke();
  ctx.fillStyle = "#eef2f8";
  ctx.fillRect(-arm - s * 0.28, s * 0.45, s * 0.56, s * 0.42);
  ctx.fillRect(arm - s * 0.28, s * 0.45, s * 0.56, s * 0.42);
  ctx.strokeStyle = "#8a92a8";
  ctx.lineWidth = 1;
  ctx.strokeRect(-arm - s * 0.28, s * 0.45, s * 0.56, s * 0.42);
  ctx.strokeRect(arm - s * 0.28, s * 0.45, s * 0.56, s * 0.42);
}

/** 喷气火箭:白身 + 红头 + 蓝窗 + 双尾翼 + 小尾焰。 */
export function drawJetIcon(ctx: Ctx, s: number): void {
  ctx.fillStyle = "#e0485a";
  ctx.beginPath();
  ctx.moveTo(-s * 0.32, s * 0.15);
  ctx.lineTo(-s * 0.66, s * 0.66);
  ctx.lineTo(-s * 0.32, s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s * 0.32, s * 0.15);
  ctx.lineTo(s * 0.66, s * 0.66);
  ctx.lineTo(s * 0.32, s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffb84d";
  ctx.beginPath();
  ctx.moveTo(-s * 0.16, s * 0.5);
  ctx.lineTo(0, s * 0.95);
  ctx.lineTo(s * 0.16, s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f6f9ff";
  ctx.beginPath();
  ctx.roundRect(-s * 0.32, -s * 0.5, s * 0.64, s * 1.05, s * 0.3);
  ctx.fill();
  ctx.strokeStyle = "#c2cadd";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#e0485a";
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.05);
  ctx.quadraticCurveTo(s * 0.44, -s * 0.6, s * 0.32, -s * 0.42);
  ctx.lineTo(-s * 0.32, -s * 0.42);
  ctx.quadraticCurveTo(-s * 0.44, -s * 0.6, 0, -s * 1.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#5a8ac9";
  ctx.beginPath();
  ctx.arc(0, -s * 0.1, s * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** 滑板:板面 + 条纹 + 双轮白毂。 */
export function drawBoardIcon(ctx: Ctx, s: number): void {
  ctx.fillStyle = "#8a5ac9";
  ctx.beginPath();
  ctx.arc(-s * 0.5, s * 0.42, s * 0.22, 0, Math.PI * 2);
  ctx.arc(s * 0.5, s * 0.42, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-s * 0.5, s * 0.42, s * 0.08, 0, Math.PI * 2);
  ctx.arc(s * 0.5, s * 0.42, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c9a6f2";
  ctx.beginPath();
  ctx.roundRect(-s * 0.95, -s * 0.1, s * 1.9, s * 0.34, s * 0.17);
  ctx.fill();
  ctx.strokeStyle = "#8a5ac9";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = "#ffd868";
  ctx.lineWidth = s * 0.09;
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, s * 0.07);
  ctx.lineTo(s * 0.5, s * 0.07);
  ctx.stroke();
}

/** 加速滑轨的闪电小图标(HUD 倒计时用,替掉 ⚡ emoji)。 */
export function drawBoltIcon(ctx: Ctx, s: number): void {
  ctx.fillStyle = "#2ec9b8";
  ctx.beginPath();
  ctx.moveTo(s * 0.28, -s);
  ctx.lineTo(-s * 0.5, s * 0.16);
  ctx.lineTo(-s * 0.04, s * 0.16);
  ctx.lineTo(-s * 0.28, s);
  ctx.lineTo(s * 0.5, -s * 0.16);
  ctx.lineTo(s * 0.04, -s * 0.16);
  ctx.closePath();
  ctx.fill();
}

/** 一颗道具泡泡:泡泡球底 + 绘制图标(不再用字符占位)。 */
export function drawPowerIcon(ctx: Ctx, kind: PowerKind, r: number): void {
  drawBubble(ctx, r);
  const s = r * 0.55;
  if (kind === "magnet") drawMagnetIcon(ctx, s);
  else if (kind === "jet") drawJetIcon(ctx, s);
  else drawBoardIcon(ctx, s);
}

/** 可吃的东西轻轻上下浮(±3px 正弦;系统关动效就静止)。 */
export function pickupFloat(t: number, reduced: boolean, seed = 0): number {
  return reduced ? 0 : Math.sin(t * 2.6 + seed) * 3;
}

/* ====================================================================== */
/* 彩虹跑者                                                                */
/* ====================================================================== */

export type RunnerPose = "run" | "jump" | "slide" | "fly" | "hurt";

export const RUNNER_BODY = "#ffb3c8";
export const RUNNER_LIMB = "#e88aa5";
export const RUNNER_INK = "#3a3a4a";
export const RUNNER_CAPE = "#9adcf0";
/** P1 彩虹发带的五段颜色。 */
export const HEADBAND_P1: readonly string[] = ["#ff6a7a", "#ffb84d", "#ffe368", "#7ac97a", "#5a8ac9"];
/** 双人预留:P2 蓝发带(形状 + 颜色双通道,与 P1 一眼可分)。 */
export const HEADBAND_P2: readonly string[] = ["#5ad0c9", "#5aa9e0", "#5a8ac9", "#8a5ac9", "#4a7ab8"];

/** 无敌闪烁频率(次/秒):光敏安全线以内。 */
export const INVINCIBLE_BLINK_HZ = 3;

/** 无敌期这一帧要不要把本体换成残影(≤3Hz,原来的 8 太快)。 */
export function blinkHidden(invincibleSec: number): boolean {
  return invincibleSec > 0 && Math.floor(invincibleSec * INVINCIBLE_BLINK_HZ) % 2 === 0;
}

/** 发带 / 披风的两帧飘动相位(reduced 恒 0:飘带静止)。 */
export function flutterPhase(t: number, reduced: boolean): number {
  return reduced ? 0 : Math.floor(Math.max(0, t) * 4) % 2;
}

/** 背后的小披风:奔跑 / 飞行时飘动,滑铲收起。 */
export function drawCape(ctx: Ctx, r: number, pose: RunnerPose, flutter: number, color = RUNNER_CAPE): void {
  if (pose === "slide") return;
  const sway = pose === "fly" ? r * 0.52 : r * 0.34;
  const lift = flutter === 1 ? r * 0.16 : 0;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.4);
  ctx.quadraticCurveTo(-r - sway, r * 0.1 - lift, -r * 0.74, r * 0.74 - lift);
  ctx.quadraticCurveTo(-r * 0.2, r * 0.52, -r * 0.26, -r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#6ab8d8";
  ctx.lineWidth = r * 0.06;
  ctx.stroke();
}

/** 双臂:奔跑反相位前后摆,跳跃 / 飞行举起来,滑铲收在身侧。 */
export function drawRunnerArms(ctx: Ctx, r: number, step: number, pose: RunnerPose): void {
  ctx.fillStyle = RUNNER_LIMB;
  ctx.beginPath();
  if (pose === "jump" || pose === "fly") {
    ctx.arc(-r * 0.92, -r * 0.5, r * 0.23, 0, Math.PI * 2);
    ctx.arc(r * 0.92, -r * 0.5, r * 0.23, 0, Math.PI * 2);
  } else if (pose === "slide") {
    ctx.arc(-r * 0.8, r * 0.16, r * 0.2, 0, Math.PI * 2);
    ctx.arc(r * 0.8, r * 0.16, r * 0.2, 0, Math.PI * 2);
  } else {
    // 与同侧脚反相位:左脚向前(+step)时左臂向后(-step)
    ctx.arc(-r * 0.95, r * 0.1 - step * 0.5, r * 0.22, 0, Math.PI * 2);
    ctx.arc(r * 0.95, r * 0.1 + step * 0.5, r * 0.22, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** 头顶彩虹发带 + 发结 + 两条小飘带(flutter 换两帧)。 */
export function drawHeadband(ctx: Ctx, r: number, flutter: number, colors: readonly string[] = HEADBAND_P1): void {
  const seg = 0.14 * Math.PI;
  const start = Math.PI * 1.15;
  const cy = -r * 0.18;
  ctx.lineCap = "butt";
  ctx.lineWidth = r * 0.2;
  for (let i = 0; i < colors.length; i++) {
    ctx.strokeStyle = colors[i];
    ctx.beginPath();
    ctx.arc(0, cy, r * 0.74, start + i * seg, start + (i + 1) * seg);
    ctx.stroke();
  }
  const kx = r * 0.56;
  const ky = cy - r * 0.52;
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.arc(kx, ky, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
  const wave = flutter === 1 ? r * 0.14 : -r * 0.06;
  ctx.lineCap = "round";
  ctx.lineWidth = r * 0.11;
  ctx.strokeStyle = colors[1];
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.quadraticCurveTo(kx + r * 0.4, ky - r * 0.1 + wave, kx + r * 0.62, ky + r * 0.14 + wave);
  ctx.stroke();
  ctx.strokeStyle = colors[3];
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.quadraticCurveTo(kx + r * 0.34, ky + r * 0.2 - wave, kx + r * 0.56, ky + r * 0.42 - wave);
  ctx.stroke();
}

/** 姿态脸:奔跑专注 / 跳跃张嘴笑 / 滑铲眯眼 / 飞行大笑 / 撞击 × 眼。 */
export function drawRunnerFace(ctx: Ctx, r: number, pose: RunnerPose): void {
  const cy = -r * 0.18;
  const ex = r * 0.34;
  const ey = cy - r * 0.02;
  ctx.lineCap = "round";
  if (pose === "hurt") {
    // × 眼 + 委屈小嘴(只是晕乎乎,不吓人)
    ctx.strokeStyle = RUNNER_INK;
    ctx.lineWidth = r * 0.09;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * ex - r * 0.11, ey - r * 0.11);
      ctx.lineTo(s * ex + r * 0.11, ey + r * 0.11);
      ctx.moveTo(s * ex + r * 0.11, ey - r * 0.11);
      ctx.lineTo(s * ex - r * 0.11, ey + r * 0.11);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, cy + r * 0.42, r * 0.14, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else if (pose === "slide") {
    // 眯眼冲刺
    ctx.strokeStyle = RUNNER_INK;
    ctx.lineWidth = r * 0.09;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * ex, ey + r * 0.04, r * 0.13, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, cy + r * 0.36);
    ctx.lineTo(r * 0.14, cy + r * 0.34);
    ctx.stroke();
  } else if (pose === "jump" || pose === "fly") {
    // 圆眼 + 张嘴笑
    ctx.fillStyle = RUNNER_INK;
    ctx.beginPath();
    ctx.arc(-ex, ey, r * 0.12, 0, Math.PI * 2);
    ctx.arc(ex, ey, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, cy + r * 0.3, r * 0.18, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  } else {
    // 奔跑专注:压扁一点的眼 + 抿住的小嘴 + 内斜小眉
    ctx.fillStyle = RUNNER_INK;
    ctx.beginPath();
    ctx.ellipse(-ex, ey, r * 0.11, r * 0.13, 0, 0, Math.PI * 2);
    ctx.ellipse(ex, ey, r * 0.11, r * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = RUNNER_INK;
    ctx.lineWidth = r * 0.07;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * (ex + r * 0.12), ey - r * 0.26);
      ctx.lineTo(s * (ex - r * 0.1), ey - r * 0.2);
      ctx.stroke();
    }
    ctx.lineWidth = r * 0.08;
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, cy + r * 0.36);
    ctx.lineTo(r * 0.12, cy + r * 0.36);
    ctx.stroke();
  }
  // 腮红(全部姿态保留)
  ctx.fillStyle = "rgba(255,120,150,0.4)";
  ctx.beginPath();
  ctx.arc(-r * 0.6, cy + r * 0.24, r * 0.16, 0, Math.PI * 2);
  ctx.arc(r * 0.6, cy + r * 0.24, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

export interface RunnerOpts {
  pose: RunnerPose;
  /** 基准半径(沿用原来那颗 r=30 椭圆的量纲,判定不变) */
  r: number;
  /** 奔跑步幅:index 沿用 sin(scrollPhase * 0.05) * 8 的老公式 */
  step: number;
  t: number;
  /** 滑铲压扁 / 拉伸(老口径:滑铲 1.25 / 0.6) */
  squashX: number;
  squashY: number;
  reduced: boolean;
  /** 发带配色(双人预留,默认 P1 彩虹) */
  band?: readonly string[];
}

/**
 * 彩虹跑者本体:披风 → 腿 → 臂 → 短身 + 圆头(2 头身) → 肚皮高光 → 发带 → 脸。
 * 跳跃弧线、滑铲压扁、侧倾、影子全部留在 index,这里只管把身体画得像样。
 */
export function drawRunner(ctx: Ctx, o: RunnerOpts): void {
  const { pose, r } = o;
  const colors = o.band ?? HEADBAND_P1;
  const flutter = flutterPhase(o.t, o.reduced);
  ctx.save();
  ctx.scale(o.squashX, o.squashY);
  drawCape(ctx, r, pose, flutter);
  if (pose === "run" || pose === "hurt") {
    // 双脚交替:老 step 公式原样进来
    ctx.fillStyle = RUNNER_LIMB;
    ctx.beginPath();
    ctx.arc(-r * 0.4, r * 0.8 + o.step * 0.4, r * 0.23, 0, Math.PI * 2);
    ctx.arc(r * 0.4, r * 0.8 - o.step * 0.4, r * 0.23, 0, Math.PI * 2);
    ctx.fill();
  } else if (pose === "jump") {
    // 屈膝收腿
    ctx.fillStyle = RUNNER_LIMB;
    ctx.beginPath();
    ctx.arc(-r * 0.34, r * 0.64, r * 0.22, 0, Math.PI * 2);
    ctx.arc(r * 0.34, r * 0.64, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  drawRunnerArms(ctx, r, o.step, pose);
  // 2 头身:短身体 + 大圆头,整体仍缩在原来那颗椭圆里
  ctx.fillStyle = RUNNER_BODY;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.42, r * 0.66, r * 0.56, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -r * 0.18, r * 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.46, r * 0.34, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  drawHeadband(ctx, r, flutter, colors);
  drawRunnerFace(ctx, r, pose);
  ctx.restore();
}

/** 无敌闪烁的隐帧:不再整个人消失,换成两帧金色残影。 */
export function drawRunnerAfterimage(ctx: Ctx, r: number, sx: number, sy: number): void {
  ctx.fillStyle = "rgba(255,214,104,0.32)";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * sx, r * sy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,214,104,0.16)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, 0, r * sx, r * sy, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** 滑板(道具态):板身 + 双轮 + 会转的轮辐线。 */
export function drawBoardArt(ctx: Ctx, r: number, spin: number): void {
  ctx.fillStyle = "#c9a6f2";
  ctx.beginPath();
  ctx.roundRect(-r * 1.1, r * 0.85, r * 2.2, 8, 4);
  ctx.fill();
  ctx.fillStyle = "#8a5ac9";
  ctx.beginPath();
  ctx.arc(-r * 0.6, r * 0.85 + 10, 5, 0, Math.PI * 2);
  ctx.arc(r * 0.6, r * 0.85 + 10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e8d8ff";
  ctx.lineWidth = 1.6;
  for (const wx of [-r * 0.6, r * 0.6]) {
    ctx.beginPath();
    ctx.moveTo(wx - Math.cos(spin) * 4, r * 0.85 + 10 - Math.sin(spin) * 4);
    ctx.lineTo(wx + Math.cos(spin) * 4, r * 0.85 + 10 + Math.sin(spin) * 4);
    ctx.stroke();
  }
}

/** 喷气鞋的尾焰:锥形三层(外橙 / 中黄 / 芯白),轻微抖动,reduced 静止。 */
export function drawJetFlame(ctx: Ctx, r: number, t: number, reduced: boolean): void {
  const jitter = reduced ? 0 : Math.floor(t * 10) % 2 === 0 ? 0.12 : -0.08;
  const fy = r * 1.02;
  const len = r * (1.1 + jitter);
  const layer = (halfW: number, l: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-halfW, fy);
    ctx.quadraticCurveTo(0, fy + l * 1.25, halfW, fy);
    ctx.closePath();
    ctx.fill();
  };
  layer(r * 0.5, len, "#ff9040");
  layer(r * 0.34, len * 0.72, "#ffd868");
  layer(r * 0.18, len * 0.45, "#fff6e0");
}

/* ====================================================================== */
/* 障碍:立面双色 + 统一接地影                                             */
/* ====================================================================== */

/** 所有障碍统一的接地椭圆影(与玩家影子同一个色系)。 */
export const CONTACT_SHADOW = "rgba(90,90,110,0.22)";

export function drawContactShadow(ctx: Ctx, rx: number, y: number): void {
  ctx.fillStyle = CONTACT_SHADOW;
  ctx.beginPath();
  ctx.ellipse(0, y, rx, rx * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

export interface ObstacleArtOpts {
  /** 世界秒表(电光门的霓虹呼吸用) */
  time: number;
  /** 滚滚球转角:index 沿用 o.y * 0.04 的老公式 */
  spin: number;
  /** 电光门此刻通没通电(判定归 logic,这里只管画) */
  active: boolean;
}

/** 一根斜晶柱:亮暗双面 + 顶端高光。 */
function crystalSpike(
  ctx: Ctx,
  cx: number,
  topX: number,
  topY: number,
  half: number,
  footY: number,
  light: string,
  dark: string,
): void {
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(cx + half, footY - half * 0.5);
  ctx.lineTo(cx, footY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(cx - half, footY - half * 0.5);
  ctx.lineTo(cx, footY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(topX, topY + half * 0.4, half * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 一个障碍,画在原点,缩放交给画布变换。
 * 每种都有顶面 / 立面双色与接地影;判定框一个像素没动。
 */
export function drawObstacleArt(ctx: Ctx, kind: ObstacleKind, laneW: number, o: ObstacleArtOpts): void {
  if (kind === "rock") {
    // 彩虹水晶簇:底座 + 三根斜晶柱(亮暗双面 + 顶端高光)
    const base = laneW * 0.3;
    drawContactShadow(ctx, base * 1.15, base * 0.68);
    ctx.fillStyle = "#8a68c8";
    ctx.beginPath();
    ctx.ellipse(0, base * 0.52, base * 0.95, base * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    crystalSpike(ctx, -base * 0.55, -base * 0.72, -base * 0.32, base * 0.3, base * 0.58, "#d8c2ff", "#9a78d8");
    crystalSpike(ctx, base * 0.52, base * 0.68, -base * 0.46, base * 0.32, base * 0.58, "#ffd0e8", "#d888b8");
    crystalSpike(ctx, 0, 0, -base * 1.02, base * 0.42, base * 0.62, "#c2e8ff", "#78aad8");
  } else if (kind === "hurdle") {
    // 糖果栏架:双圆柱腿(侧面暗色) + 斜纹横杆
    const half = laneW * 0.32;
    drawContactShadow(ctx, half * 1.15, 14);
    for (const lx of [-half * 0.66, half * 0.66]) {
      ctx.fillStyle = "#f8f8ff";
      ctx.beginPath();
      ctx.roundRect(lx - 4, -8, 8, 20, 3);
      ctx.fill();
      ctx.fillStyle = "#d8b8c8";
      ctx.fillRect(lx + 1, -7, 3, 18);
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(-half, -12, half * 2, 10, 5);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-half, -12, half * 2, 10, 5);
    ctx.clip();
    ctx.fillStyle = "#ff8aa8";
    for (let x = -half; x < half; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, -2);
      ctx.lineTo(x + 7, -12);
      ctx.lineTo(x + 14, -12);
      ctx.lineTo(x + 7, -2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "#e0a8bc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-half, -12, half * 2, 10, 5);
    ctx.stroke();
  } else if (kind === "bar") {
    // 彩虹光栅门:三色横条保留,两侧立柱加顶面椭圆与外侧暗条
    const half = laneW * 0.36;
    drawContactShadow(ctx, half * 1.18, 12);
    for (const s of [-1, 1]) {
      const px = s * half;
      ctx.fillStyle = "#9adcf0";
      ctx.fillRect(px - 4, -26, 8, 32);
      ctx.fillStyle = "#5aa8c8";
      ctx.fillRect(px + (s > 0 ? 1 : -4), -25, 3, 30);
      ctx.fillStyle = "#c8f0fa";
      ctx.beginPath();
      ctx.ellipse(px, -26, 5, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const bands = ["#ff9eb5", "#ffd868", "#8fd8c8"];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = bands[i];
      ctx.fillRect(-half, -26 + i * 6, half * 2, 6);
    }
    ctx.fillStyle = "rgba(58,58,74,0.25)";
    ctx.fillRect(-half, -8, half * 2, 2);
  } else if (kind === "pit") {
    // 坑洞:内壁渐变(上缘亮 → 底黑) + 坑沿亮边 + 三粒碎石
    const rx = laneW * 0.34;
    const ry = laneW * 0.18;
    drawContactShadow(ctx, rx * 1.12, ry * 0.4);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    const g = ctx.createLinearGradient(0, -ry, 0, ry);
    g.addColorStop(0, "#8d84b8");
    g.addColorStop(0.45, "#453e6e");
    g.addColorStop(1, "#171226");
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#b8aed8";
    const pebbles: ReadonlyArray<readonly [number, number, number]> = [
      [-rx * 0.8, -ry * 0.95, 2.6],
      [rx * 0.55, ry * 1.05, 3],
      [rx * 0.95, -ry * 0.35, 2.2],
    ];
    for (const [px, py, pr] of pebbles) {
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === "roller") {
    // 滚滚球:旋转纹路保留,加左右高光带,接地阴影加深
    const rr = laneW * 0.27;
    drawContactShadow(ctx, rr * 1.05, rr + 5);
    ctx.fillStyle = "rgba(70,40,20,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, rr + 5, rr * 0.9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8a05a";
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 3.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, rr * 0.65, o.spin + (i * Math.PI * 2) / 3, o.spin + (i * Math.PI * 2) / 3 + 1.1);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,244,220,0.75)";
    ctx.lineWidth = rr * 0.16;
    ctx.beginPath();
    ctx.arc(0, 0, rr * 0.8, Math.PI * 0.95, Math.PI * 1.35);
    ctx.stroke();
    ctx.strokeStyle = "rgba(120,70,30,0.4)";
    ctx.lineWidth = rr * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, rr * 0.82, -Math.PI * 0.25, Math.PI * 0.3);
    ctx.stroke();
  } else if (kind === "zapper") {
    // 电光门:柱身加侧面暗条与顶面圆头;通电画折线电弧 + 绘制小闪电(不再用字符)
    const half = laneW * 0.36;
    drawContactShadow(ctx, half * 1.15, 18);
    for (const s of [-1, 1]) {
      const px = s * half;
      ctx.fillStyle = o.active ? "#ffd868" : "#9a9ab8";
      ctx.beginPath();
      ctx.roundRect(px - 5, -26, 10, 42, 4);
      ctx.fill();
      ctx.fillStyle = o.active ? "#d8a838" : "#70708c";
      ctx.fillRect(px + (s > 0 ? 2 : -5), -24, 3, 38);
      ctx.fillStyle = o.active ? "#fff3c2" : "#c2c2d8";
      ctx.beginPath();
      ctx.ellipse(px, -26, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (o.active) {
      ctx.strokeStyle = `rgba(255,238,120,${0.75 + Math.sin(o.time * 20) * 0.25})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-half + 5, -6);
      for (let i = 1; i <= 4; i++) {
        const zx = -half + 5 + ((half * 2 - 10) * i) / 4;
        ctx.lineTo(zx, -6 + (i % 2 === 0 ? 6 : -8));
      }
      ctx.stroke();
      ctx.fillStyle = "#ffe368";
      ctx.beginPath();
      ctx.moveTo(-3, -46);
      ctx.lineTo(4, -46);
      ctx.lineTo(0, -39);
      ctx.lineTo(5, -39);
      ctx.lineTo(-4, -28);
      ctx.lineTo(-1, -37);
      ctx.lineTo(-5, -37);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#c9881f";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  } else if (kind === "crate") {
    // 彩纸箱:正面 + 顶面(亮) + 右侧面(暗),丝带绕三个面
    const s2 = laneW * 0.3;
    const dx = s2 * 0.3;
    const dy = s2 * 0.36;
    drawContactShadow(ctx, s2 * 1.25, s2 * 0.78);
    ctx.fillStyle = "#c98a4a";
    ctx.beginPath();
    ctx.moveTo(s2, -s2 * 0.5);
    ctx.lineTo(s2 + dx, -s2 * 0.5 - dy);
    ctx.lineTo(s2 + dx, s2 * 0.7 - dy);
    ctx.lineTo(s2, s2 * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffe0b0";
    ctx.beginPath();
    ctx.moveTo(-s2, -s2 * 0.5);
    ctx.lineTo(-s2 + dx, -s2 * 0.5 - dy);
    ctx.lineTo(s2 + dx, -s2 * 0.5 - dy);
    ctx.lineTo(s2, -s2 * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f2c48a";
    ctx.beginPath();
    ctx.roundRect(-s2, -s2 * 0.5, s2 * 2, s2 * 1.2, 4);
    ctx.fill();
    ctx.strokeStyle = "#c98a4a";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = "#ff9eb5";
    ctx.fillRect(-s2 * 0.16, -s2 * 0.5, s2 * 0.32, s2 * 1.2);
    ctx.beginPath();
    ctx.moveTo(-s2 * 0.16 + dx, -s2 * 0.5 - dy);
    ctx.lineTo(s2 * 0.16 + dx, -s2 * 0.5 - dy);
    ctx.lineTo(s2 * 0.16, -s2 * 0.5);
    ctx.lineTo(-s2 * 0.16, -s2 * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9adcf0";
    ctx.fillRect(-s2, s2 * 0.02, s2 * 2, s2 * 0.3);
    ctx.fillStyle = "#ffd0dd";
    ctx.beginPath();
    ctx.arc(-s2 * 0.02 + dx * 0.5, -s2 * 0.5 - dy * 0.5, s2 * 0.14, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 云朵怪:软云 + 生气小眉毛 + 皱嘴,飘着也压一点接地影
    drawContactShadow(ctx, laneW * 0.28, laneW * 0.3);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(-laneW * 0.16, 0, laneW * 0.15, 0, Math.PI * 2);
    ctx.arc(0, -laneW * 0.08, laneW * 0.18, 0, Math.PI * 2);
    ctx.arc(laneW * 0.16, 0, laneW * 0.15, 0, Math.PI * 2);
    ctx.arc(0, laneW * 0.06, laneW * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = RUNNER_INK;
    ctx.beginPath();
    ctx.arc(-laneW * 0.06, -laneW * 0.03, 3, 0, Math.PI * 2);
    ctx.arc(laneW * 0.06, -laneW * 0.03, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = RUNNER_INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-laneW * 0.12, -laneW * 0.1);
    ctx.lineTo(-laneW * 0.03, -laneW * 0.06);
    ctx.moveTo(laneW * 0.12, -laneW * 0.1);
    ctx.lineTo(laneW * 0.03, -laneW * 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, laneW * 0.08, 5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
}

/* ====================================================================== */
/* 视差剪影主题表:12 个世界各配一套远 / 中 / 近剪影                        */
/* ====================================================================== */

export type SilhouetteKind =
  | "hills"
  | "gummy"
  | "dunes"
  | "peaks"
  | "icePeaks"
  | "cloudband"
  | "waves"
  | "aurora"
  | "trees"
  | "firs"
  | "palms"
  | "lollipops"
  | "cacti"
  | "crystals"
  | "skyline"
  | "poles";

export interface ParallaxTheme {
  far: SilhouetteKind;
  mid: SilhouetteKind;
  near: SilhouetteKind;
}

/** 12 世界的剪影主题:换世界(mixHex 换色)时同步换这张表。 */
export const PARALLAX_THEMES: Record<Theme, ParallaxTheme> = {
  grass: { far: "hills", mid: "cloudband", near: "trees" },
  sky: { far: "gummy", mid: "cloudband", near: "waves" },
  candy: { far: "gummy", mid: "cloudband", near: "lollipops" },
  forest: { far: "peaks", mid: "cloudband", near: "firs" },
  beach: { far: "hills", mid: "waves", near: "palms" },
  desert: { far: "dunes", mid: "cloudband", near: "cacti" },
  snow: { far: "icePeaks", mid: "cloudband", near: "firs" },
  lava: { far: "peaks", mid: "cloudband", near: "crystals" },
  space: { far: "peaks", mid: "aurora", near: "crystals" },
  neon: { far: "skyline", mid: "aurora", near: "poles" },
  ropeway: { far: "peaks", mid: "cloudband", near: "poles" },
  stardust: { far: "gummy", mid: "aurora", near: "crystals" },
};

/**
 * 画一格剪影(区间 [x0, x0 + span],基线 baseY,最高伸到 baseY - topH)。
 * 颜色与透明度由调用方按 view3d 的老公式设好,这里只管形状。
 */
export function drawSilhouetteUnit(
  ctx: Ctx,
  kind: SilhouetteKind,
  x0: number,
  span: number,
  baseY: number,
  topH: number,
): void {
  const u = span;
  if (kind === "hills") {
    ctx.beginPath();
    ctx.moveTo(x0, baseY);
    ctx.quadraticCurveTo(x0 + u * 0.5, baseY - topH, x0 + u, baseY);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "gummy") {
    // 软糖山:平顶圆肩
    ctx.beginPath();
    ctx.moveTo(x0 + u * 0.06, baseY);
    ctx.quadraticCurveTo(x0 + u * 0.1, baseY - topH * 0.85, x0 + u * 0.3, baseY - topH * 0.85);
    ctx.lineTo(x0 + u * 0.66, baseY - topH * 0.85);
    ctx.quadraticCurveTo(x0 + u * 0.88, baseY - topH * 0.85, x0 + u * 0.92, baseY);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "dunes") {
    ctx.beginPath();
    ctx.moveTo(x0, baseY);
    ctx.quadraticCurveTo(x0 + u * 0.22, baseY - topH, x0 + u * 0.46, baseY - topH * 0.35);
    ctx.quadraticCurveTo(x0 + u * 0.68, baseY - topH * 0.72, x0 + u, baseY);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "peaks") {
    ctx.beginPath();
    ctx.moveTo(x0, baseY);
    ctx.lineTo(x0 + u * 0.3, baseY - topH);
    ctx.lineTo(x0 + u * 0.55, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x0 + u * 0.5, baseY);
    ctx.lineTo(x0 + u * 0.76, baseY - topH * 0.62);
    ctx.lineTo(x0 + u, baseY);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "icePeaks") {
    // 冰峰:更尖更密的三根
    for (const [fx, fh, fw] of [
      [0.18, 1, 0.16],
      [0.5, 0.78, 0.13],
      [0.8, 0.58, 0.11],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x0 + u * (fx - fw), baseY);
      ctx.lineTo(x0 + u * fx, baseY - topH * fh);
      ctx.lineTo(x0 + u * (fx + fw), baseY);
      ctx.closePath();
      ctx.fill();
    }
  } else if (kind === "cloudband") {
    for (const [fx, frx, fh] of [
      [0.25, 0.2, 0.5],
      [0.55, 0.24, 0.72],
      [0.82, 0.16, 0.44],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(x0 + u * fx, baseY, u * frx, topH * fh, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === "waves") {
    // 浪线:一排贝壳弧
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(x0 + (u * (k + 0.5)) / 4, baseY, u * 0.13, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    }
  } else if (kind === "aurora") {
    // 极光带:一条起伏的光绸
    ctx.beginPath();
    ctx.moveTo(x0, baseY - topH * 0.55);
    ctx.quadraticCurveTo(x0 + u * 0.25, baseY - topH * 1.05, x0 + u * 0.5, baseY - topH * 0.6);
    ctx.quadraticCurveTo(x0 + u * 0.75, baseY - topH * 0.2, x0 + u, baseY - topH * 0.66);
    ctx.lineTo(x0 + u, baseY - topH * 0.34);
    ctx.quadraticCurveTo(x0 + u * 0.72, baseY - topH * 0.02, x0 + u * 0.5, baseY - topH * 0.34);
    ctx.quadraticCurveTo(x0 + u * 0.28, baseY - topH * 0.72, x0, baseY - topH * 0.28);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "trees") {
    for (const [fx, fh] of [
      [0.3, 1],
      [0.72, 0.78],
    ] as const) {
      const cx = x0 + u * fx;
      ctx.fillRect(cx - u * 0.02, baseY - topH * fh * 0.4, u * 0.04, topH * fh * 0.4);
      ctx.beginPath();
      ctx.arc(cx, baseY - topH * fh * 0.62, topH * fh * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === "firs") {
    // 雪杉 / 松杉:双层三角
    for (const [fx, fh] of [
      [0.28, 1],
      [0.7, 0.74],
    ] as const) {
      const cx = x0 + u * fx;
      const hh = topH * fh;
      ctx.beginPath();
      ctx.moveTo(cx - u * 0.11, baseY);
      ctx.lineTo(cx, baseY - hh * 0.66);
      ctx.lineTo(cx + u * 0.11, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - u * 0.08, baseY - hh * 0.4);
      ctx.lineTo(cx, baseY - hh);
      ctx.lineTo(cx + u * 0.08, baseY - hh * 0.4);
      ctx.closePath();
      ctx.fill();
    }
  } else if (kind === "palms") {
    const cx = x0 + u * 0.45;
    ctx.beginPath();
    ctx.moveTo(cx - u * 0.025, baseY);
    ctx.quadraticCurveTo(cx + u * 0.02, baseY - topH * 0.5, cx + u * 0.07, baseY - topH * 0.78);
    ctx.lineTo(cx + u * 0.11, baseY - topH * 0.74);
    ctx.quadraticCurveTo(cx + u * 0.05, baseY - topH * 0.46, cx + u * 0.035, baseY);
    ctx.closePath();
    ctx.fill();
    for (const a of [-0.9, -0.35, 0.3, 0.9]) {
      ctx.beginPath();
      ctx.ellipse(
        cx + u * 0.09 + Math.cos(a) * u * 0.1,
        baseY - topH * 0.78 + Math.sin(a) * topH * 0.12,
        u * 0.1,
        topH * 0.08,
        a * 0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else if (kind === "lollipops") {
    // 棒棒糖树:棍 + 大圆糖
    for (const [fx, fh, fr] of [
      [0.32, 1, 0.16],
      [0.74, 0.72, 0.12],
    ] as const) {
      const cx = x0 + u * fx;
      ctx.fillRect(cx - u * 0.016, baseY - topH * fh * 0.52, u * 0.032, topH * fh * 0.52);
      ctx.beginPath();
      ctx.arc(cx, baseY - topH * fh * 0.68, u * fr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === "cacti") {
    const cx = x0 + u * 0.42;
    ctx.beginPath();
    ctx.roundRect(cx - u * 0.04, baseY - topH * 0.9, u * 0.08, topH * 0.9, u * 0.04);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx - u * 0.16, baseY - topH * 0.6, u * 0.12, u * 0.05, u * 0.025);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx + u * 0.04, baseY - topH * 0.42, u * 0.12, u * 0.05, u * 0.025);
    ctx.fill();
  } else if (kind === "crystals") {
    // 晶簇:两枚细长菱晶
    for (const [fx, fh, fw] of [
      [0.34, 1, 0.06],
      [0.66, 0.66, 0.045],
    ] as const) {
      const cx = x0 + u * fx;
      ctx.beginPath();
      ctx.moveTo(cx, baseY - topH * fh);
      ctx.lineTo(cx + u * fw, baseY - topH * fh * 0.4);
      ctx.lineTo(cx, baseY);
      ctx.lineTo(cx - u * fw, baseY - topH * fh * 0.4);
      ctx.closePath();
      ctx.fill();
    }
  } else if (kind === "skyline") {
    // 城市天际线:三栋楼 + 天线
    for (const [fx, fw, fh] of [
      [0.08, 0.2, 0.62],
      [0.34, 0.24, 1],
      [0.66, 0.22, 0.5],
    ] as const) {
      ctx.fillRect(x0 + u * fx, baseY - topH * fh, u * fw, topH * fh);
    }
    ctx.fillRect(x0 + u * 0.45, baseY - topH * 1.2, u * 0.012, topH * 0.2);
  } else {
    // poles:索道立柱 + 一段下垂的缆线
    for (const fx of [0.2, 0.8] as const) {
      ctx.fillRect(x0 + u * fx - u * 0.015, baseY - topH * 0.9, u * 0.03, topH * 0.9);
      ctx.fillRect(x0 + u * fx - u * 0.06, baseY - topH * 0.88, u * 0.12, topH * 0.06);
    }
    ctx.beginPath();
    ctx.moveTo(x0 + u * 0.2, baseY - topH * 0.85);
    ctx.quadraticCurveTo(x0 + u * 0.5, baseY - topH * 0.55, x0 + u * 0.8, baseY - topH * 0.85);
    ctx.quadraticCurveTo(x0 + u * 0.5, baseY - topH * 0.48, x0 + u * 0.2, baseY - topH * 0.78);
    ctx.closePath();
    ctx.fill();
  }
}

/* ====================================================================== */
/* 结算小件                                                                */
/* ====================================================================== */

/** 无尽结算的世界进度带:这一趟点亮了几颗世界小点。 */
export function worldDotsLit(dist: number, stageLen: number, total: number): number {
  if (!(stageLen > 0) || total <= 0) return 0;
  return Math.min(total, Math.floor(Math.max(0, dist) / stageLen) + 1);
}

/**
 * 顶部大标题的自适应字号(visual-r1 修 A 档 P-02):
 * 从 basePx 逐级往下试,直到 measure(px) 宽度塞得进 avail 或到 minPx 兜底。
 * 纯函数,measure 由调用方给(实机是 ctx.measureText,测试给线性桩)。
 */
export function titleFitPx(
  measure: (px: number) => number,
  basePx: number,
  minPx: number,
  avail: number,
): number {
  let px = basePx;
  while (px > minPx && measure(px) > avail) px -= 1;
  return px;
}

/* ====================================================================== */
/* 菜单 / 地图 / 结算徽章(visual-r2 修遗留 #2):替掉画布 fillText emoji   */
/* 直出的小图标。与本库其它资产同约定:画在原点,translate 由调用方负责;  */
/* 统一左上高光、1.5~2px 档描边、糖果粉彩板。                              */
/* ====================================================================== */

/** 地图/结算迷你星(替 ⭐▫☆):拿到=金星+暗金描边,空位=灰白描边星。 */
export function drawMiniStar(ctx: Ctx, r: number, filled: boolean): void {
  starPath(ctx, r);
  if (filled) {
    ctx.fillStyle = "#ffd868";
    ctx.fill();
    ctx.strokeStyle = "#e0a030";
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(150,150,165,0.75)";
  }
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.stroke();
}

/** 挂锁(替 🔒):灰梁 + 金身渐变 + 锁孔 + 左上高光。 */
export function drawPadlock(ctx: Ctx, r: number): void {
  ctx.strokeStyle = "#8a90a6";
  ctx.lineWidth = Math.max(1.5, r * 0.24);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, -r * 0.28, r * 0.42, Math.PI, Math.PI * 2);
  ctx.stroke();
  const g = ctx.createLinearGradient(0, -r * 0.3, 0, r * 0.9);
  g.addColorStop(0, "#ffd868");
  g.addColorStop(1, "#d9a832");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-r * 0.62, -r * 0.3, r * 1.24, r * 1.16, r * 0.24);
  ctx.fill();
  ctx.strokeStyle = "#a87f28";
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.stroke();
  ctx.fillStyle = "#7a5a1a";
  ctx.beginPath();
  ctx.arc(0, r * 0.14, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-r * 0.07, r * 0.14, r * 0.14, r * 0.4, r * 0.06);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.06, r * 0.14, r * 0.24, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** 终点旗(替 🏁):深杆 + 双色格纹旗面 + 杆顶圆钮。 */
export function drawFinishFlag(ctx: Ctx, r: number): void {
  // 旗杆
  ctx.strokeStyle = "#8a7a6a";
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, r);
  ctx.lineTo(-r * 0.55, -r * 0.95);
  ctx.stroke();
  ctx.fillStyle = "#8a7a6a";
  ctx.beginPath();
  ctx.arc(-r * 0.55, -r * 0.98, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  // 旗面:白底 + 2×3 深格
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#5a5a6e";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.roundRect(-r * 0.48, -r * 0.92, r * 1.3, r * 0.86, r * 0.08);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#5a5a6e";
  const cell = (r * 1.3) / 3;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      if ((row + col) % 2 === 0) {
        ctx.fillRect(-r * 0.48 + col * cell, -r * 0.92 + row * (r * 0.43), cell, r * 0.43);
      }
    }
  }
}

/** 限时关小秒表(替 ⏱):白面钢蓝圈 + 顶钮 + 双针 + 左上弧光。 */
export function drawStopwatchBadge(ctx: Ctx, r: number): void {
  ctx.fillStyle = "#4a7ac9";
  ctx.beginPath();
  ctx.roundRect(-r * 0.18, -r * 1.18, r * 0.36, r * 0.3, r * 0.1);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4a7ac9";
  ctx.lineWidth = Math.max(1.5, r * 0.18);
  ctx.stroke();
  ctx.strokeStyle = "#2a4a5e";
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -r * 0.56);
  ctx.moveTo(0, 0);
  ctx.lineTo(r * 0.38, r * 0.1);
  ctx.stroke();
  ctx.fillStyle = "#2a4a5e";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.66, Math.PI * 1.05, Math.PI * 1.45);
  ctx.stroke();
}

/** 无尽入口的 ∞ 徽记(替 ♾️):两只彩虹描边圆环左右相扣 + 左上高光点。 */
export function drawInfinityBadge(ctx: Ctx, r: number): void {
  const loop = (cx: number, color: string): void => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, r * 0.3);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, 0, r * 0.48, 0, Math.PI * 2);
    ctx.stroke();
  };
  loop(-r * 0.46, "#ff8fb4");
  loop(r * 0.46, "#7ac9e0");
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(-r * 0.62, -r * 0.34, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

/** 任务小靶(替 🎯):红白同心环 + 靶心点 + 左上高光弧。 */
export function drawTargetBadge(ctx: Ctx, r: number): void {
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e0679f";
  ctx.lineWidth = Math.max(1.5, r * 0.18);
  ctx.stroke();
  ctx.strokeStyle = "#e0679f";
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#c8497f";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, Math.PI * 1.05, Math.PI * 1.4);
  ctx.stroke();
}

/** 岔路路牌箭头(替 ◀▶):圆角实心三角,dir=-1 朝左 / 1 朝右。 */
export function drawForkArrow(ctx: Ctx, r: number, dir: -1 | 1): void {
  ctx.fillStyle = "#4a4a5e";
  ctx.strokeStyle = "#4a4a5e";
  ctx.lineWidth = Math.max(1, r * 0.2);
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(dir * r, 0);
  ctx.lineTo(-dir * r * 0.6, -r * 0.7);
  ctx.lineTo(-dir * r * 0.6, r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
