/**
 * 朵星双人冲刺 · 1.3 视觉资产（第 11 步 A）。
 *
 * 全部是「吃一个 2D context 就画」的纯绘制函数，零 DOM 依赖——
 * 需要离屏画布的地方（金币旋转帧）由调用方注入工厂，测试里塞一个记录桩就能验。
 *
 * ⚠️ 待上移共享 kit：金币（coinFrames）、星屑（drawSparkle）、皇冠（drawCrown）、
 * 心形（drawHeart）是跨游戏资产，与 rainbow-run 的 art.ts 保持同签名；
 * `src/art/kit/` 建立后这几个函数整体搬过去，这里改成 re-export。
 *
 * 这里只画皮，不碰任何玩法数值：所有函数的输入都是坐标 / 尺寸 / 相位，
 * 判定尺寸仍以 logic.ts / match.ts 为准。
 */

import type { PowerKind } from "./logic";

/* ---------------- 调色板 ---------------- */

/** P1 朵朵：粉色系 + 花苞呆毛 + 小裙摆（形状与颜色双通道，色弱下靠剪影分辨） */
export const P1_COLORS = {
  body: "#FFC6DC",
  dark: "#F09CBE",
  light: "#FFE9F3",
  trim: "#FF9EC4",
  cheek: "#FF9FBE",
  ink: "#8A3D5E",
} as const;

/** P2 星星：金黄系 + 星形呆毛 + 蓝色小披风 */
export const P2_COLORS = {
  body: "#FFD98A",
  dark: "#EDB84F",
  light: "#FFF3D4",
  trim: "#7FA8E8",
  cheek: "#FFB37A",
  ink: "#7A5A1E",
} as const;

/** 头像模式外圈描边：跟座位配色一致，一眼分清谁是谁 */
export const SEAT_RING: readonly [string, string] = ["#F2A0C0", "#8FB9E8"];

/* ---------------- 基础形状（待上移 kit） ---------------- */

/** 五角星路径（只铺 path，不填色，调用方决定 fill / stroke） */
export function starPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot: number = -Math.PI / 2,
): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = rot + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** 一粒星屑（拾取反馈、尾焰星点共用） */
export function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color = "#FFE39B",
): void {
  ctx.fillStyle = color;
  starPath(ctx, x, y, r);
  ctx.fill();
}

/** 拾取反馈撒几粒星屑：reduced-motion 下一粒都不撒（只留飘字淡出） */
export function sparkleCount(reduced: boolean): number {
  return reduced ? 0 : 3;
}

/** 心形（加油打气用，替代 💖 字符） */
export function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color = "#FF7EA8",
  filled = true,
): void {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.3, y, x - r * 0.7, y - r * 0.9, x, y - r * 0.25);
  ctx.bezierCurveTo(x + r * 0.7, y - r * 0.9, x + r * 1.3, y, x, y + r * 0.9);
  ctx.closePath();
  if (!filled) {
    // 空心版:掉了的命只描边不填充(r2 · HUD 手绘化,替代 🤍 字符)
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.2, r * 0.2);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = color;
  ctx.fill();
  // 一点高光，别是个死色块
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.32, r * 0.18, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

/** 绘制的小金冠（替代 👑 字符）：金身 + 三个尖 + 一粒粉宝石 */
export function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  const h = w * 0.62;
  ctx.fillStyle = "#F5C542";
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + h * 0.5);
  ctx.lineTo(x - w / 2, y - h * 0.1);
  ctx.lineTo(x - w * 0.25, y + h * 0.12);
  ctx.lineTo(x, y - h * 0.5);
  ctx.lineTo(x + w * 0.25, y + h * 0.12);
  ctx.lineTo(x + w / 2, y - h * 0.1);
  ctx.lineTo(x + w / 2, y + h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#D89A1F";
  ctx.lineWidth = Math.max(0.6, w * 0.05);
  ctx.stroke();
  ctx.fillStyle = "#FF8FAB";
  ctx.beginPath();
  ctx.arc(x, y + h * 0.18, w * 0.11, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------------- 金币：8 帧绕 Y 旋转（待上移 kit，与 rainbow-run 同签名） ---------------- */

export const COIN_FRAME_COUNT = 8;

/** 一帧的几何参数：宽度比（绕 Y 旋转的投影）、翻没翻面、是不是侧棱帧、星印浓度 */
export interface CoinFrameSpec {
  /** 椭圆横向压缩比 0.14…1 */
  w: number;
  /** 转过 90° 之后高光换边 */
  flip: boolean;
  /** 接近侧面时改画硬币的厚度棱 */
  edgeOn: boolean;
  /** 五角星压印的透明度 0…1（侧面看不见星） */
  star: number;
}

export function coinFrameSpec(i: number): CoinFrameSpec {
  const c = Math.cos((i * Math.PI) / COIN_FRAME_COUNT);
  const w = Math.max(0.14, Math.abs(c));
  return {
    w,
    flip: c < 0,
    edgeOn: Math.abs(c) < 0.3,
    star: Math.max(0, (Math.abs(c) - 0.25) / 0.75),
  };
}

/** 把某一帧直接矢量画出来（离屏烘焙与无画布环境的兜底共用同一份笔画） */
export function drawCoinFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  spec: CoinFrameSpec,
): void {
  const rx = r * spec.w;
  const dir = spec.flip ? -1 : 1;
  // 侧面厚度：暗金的棱比正面略偏一点，看起来有一枚硬币的厚度
  ctx.fillStyle = "#C68A1F";
  ctx.beginPath();
  ctx.ellipse(x + dir * r * 0.1 * (1.1 - spec.w), y + r * 0.05, rx, r, 0, 0, Math.PI * 2);
  ctx.fill();
  // 正面：金渐变
  const g = ctx.createLinearGradient(x - rx, y - r, x + rx, y + r);
  g.addColorStop(0, "#FFE79E");
  g.addColorStop(1, "#F5B93C");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, r, 0, 0, Math.PI * 2);
  ctx.fill();
  if (spec.edgeOn) {
    // 侧棱帧：画几条竖着的棱线代替星印
    ctx.strokeStyle = "#D89A1F";
    ctx.lineWidth = Math.max(0.8, r * 0.09);
    for (const k of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(x + k * rx, y - r * 0.72);
      ctx.lineTo(x + k * rx, y + r * 0.72);
      ctx.stroke();
    }
  } else {
    // 内环
    ctx.strokeStyle = "#E09B2D";
    ctx.lineWidth = Math.max(0.8, r * 0.1);
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 0.72, r * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();
    // 五角星压印：跟着旋转横向压扁
    if (spec.star > 0.02) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(spec.w, 1);
      ctx.fillStyle = `rgba(255,244,206,${(0.9 * spec.star).toFixed(3)})`;
      starPath(ctx, 0, 0, r * 0.44);
      ctx.fill();
      ctx.restore();
    }
  }
  // 高光：翻面后换边
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.beginPath();
  ctx.ellipse(x - dir * rx * 0.4, y - r * 0.42, r * 0.15, r * 0.09, dir * -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** 离屏画布的最小结构（测试塞记录桩即可） */
export interface CanvasLike {
  width: number;
  height: number;
  getContext(kind: "2d"): CanvasRenderingContext2D | null;
}

export type CanvasFactory = (w: number, h: number) => CanvasLike | null;

/** 默认工厂：有 document 就造真画布，没有（纯 node）就造不出来，走矢量兜底 */
function defaultCanvasFactory(w: number, h: number): CanvasLike | null {
  const doc = (globalThis as { document?: { createElement?: (t: string) => unknown } }).document;
  if (typeof doc?.createElement !== "function") return null;
  const c = doc.createElement("canvas") as CanvasLike;
  c.width = w;
  c.height = h;
  return c;
}

export interface CoinFrame {
  canvas: CanvasLike;
  /** 画布边长（正方形） */
  size: number;
  /** 烘焙时用的金币半径，drawCoin 按它换算缩放 */
  r: number;
}

/**
 * 把 8 帧旋转金币烘焙到离屏画布上（每帧几何不同：宽度 / 高光边 / 星印 / 侧棱）。
 * 造不出画布（无 DOM 环境）就返回空数组，`drawCoin` 会退回逐帧矢量绘制。
 */
export function coinFrames(r: number, make: CanvasFactory = defaultCanvasFactory): CoinFrame[] {
  const size = Math.ceil(r * 2 + 6);
  const out: CoinFrame[] = [];
  for (let i = 0; i < COIN_FRAME_COUNT; i++) {
    const canvas = make(size, size);
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return [];
    drawCoinFrame(ctx, size / 2, size / 2, r, coinFrameSpec(i));
    out.push({ canvas, size, r });
  }
  return out;
}

/** 画一枚金币：优先 `drawImage` 烘焙帧（快），没有帧就现场矢量画（稳） */
export function drawCoin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  frames: CoinFrame[],
  index: number,
): void {
  const n = frames.length;
  if (n > 0) {
    const f = frames[((index % n) + n) % n];
    const d = f.size * (r / f.r);
    ctx.drawImage(f.canvas as unknown as CanvasImageSource, x - d / 2, y - d / 2, d, d);
    return;
  }
  drawCoinFrame(ctx, x, y, r, coinFrameSpec(((index % COIN_FRAME_COUNT) + COIN_FRAME_COUNT) % COIN_FRAME_COUNT));
}

/* ---------------- 跑者：朵朵 / 星星双主角 ---------------- */

export type RunnerMood = "run" | "jump" | "slide" | "dizzy" | "ghost";

export interface RunnerPose {
  /** 0 = 朵朵（粉 + 花苞 + 裙摆），1 = 星星（金 + 星呆毛 + 披风） */
  who: 0 | 1;
  /** 脚底中点（跳跃时是空中的落点） */
  x: number;
  footY: number;
  /** 基准尺寸 = laneWidthAt(pane, RUNNER_Z) * 0.6，跟 1.2 的 base 同一口径 */
  unit: number;
  /** 下滑压扁 1 = 正常（整个人一起压，头身比不变形） */
  squash: number;
  /** 奔跑起伏（像素，调用方已按 bounce 相位算好） */
  bounce: number;
  /** 腿臂交替摆动的相位（弧度）；reduced 下调用方传 0 即可静止 */
  runPhase: number;
  mood: RunnerMood;
  /** 秒。眩晕星绕头、幽灵火苗的相位用 */
  time: number;
  reduced: boolean;
}

/** 头心相对脚底的高度（眩晕星 / 皇冠 / 加油心定位共用） */
export function runnerHeadY(footY: number, unit: number, squash: number): number {
  return footY - unit * 1.02 * squash;
}

function moodFace(
  ctx: CanvasRenderingContext2D,
  pose: RunnerPose,
  hx: number,
  hy: number,
  hr: number,
  ink: string,
): void {
  const eyeY = hy + hr * 0.05;
  const eyeDx = hr * 0.38;
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = Math.max(1, hr * 0.13);
  ctx.lineCap = "round";
  if (pose.mood === "dizzy") {
    // 被撞：×眼，圆嘴（吃惊但不痛苦）
    for (const s of [-1, 1]) {
      const ex = hx + s * eyeDx;
      ctx.beginPath();
      ctx.moveTo(ex - hr * 0.14, eyeY - hr * 0.14);
      ctx.lineTo(ex + hr * 0.14, eyeY + hr * 0.14);
      ctx.moveTo(ex + hr * 0.14, eyeY - hr * 0.14);
      ctx.lineTo(ex - hr * 0.14, eyeY + hr * 0.14);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(hx, hy + hr * 0.42, hr * 0.13, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (pose.mood === "slide") {
    // 下滑：眯眼一条线，憋住劲
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + s * eyeDx - hr * 0.15, eyeY);
      ctx.lineTo(hx + s * eyeDx + hr * 0.15, eyeY);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(hx - hr * 0.12, hy + hr * 0.42);
    ctx.lineTo(hx + hr * 0.12, hy + hr * 0.42);
    ctx.stroke();
    return;
  }
  // 奔跑 / 跳跃 / 幽灵：圆点眼
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(hx + s * eyeDx, eyeY, hr * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  if (pose.mood === "jump") {
    // 跳跃：张嘴笑
    ctx.beginPath();
    ctx.arc(hx, hy + hr * 0.34, hr * 0.2, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  } else {
    // 奔跑专注：抿一条小嘴
    ctx.beginPath();
    ctx.arc(hx, hy + hr * 0.3, hr * 0.16, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
  }
}

/**
 * 画一个 2 头身小跑者（替代「贴 emoji 的蛋」）。
 * 运动参数（跳弧 / 压扁 / 侧倾 / 抖动）仍由调用方沿 1.2 的口径算好传进来，
 * 这里只管把身体、四肢、呆毛、表情画出来。
 */
export function drawRunnerSprite(ctx: CanvasRenderingContext2D, pose: RunnerPose): void {
  const u = pose.unit;
  const c = pose.who === 0 ? P1_COLORS : P2_COLORS;
  const ghost = pose.mood === "ghost";
  const body = ghost ? "#E8EAF6" : c.body;
  const dark = ghost ? "#C9CFE8" : c.dark;
  const swing = pose.reduced || pose.mood !== "run" ? 0 : Math.sin(pose.runPhase);

  ctx.save();
  // 整个人一起压扁：头身比不变形，下滑时是「趴低」而不是「变胖」
  ctx.translate(pose.x, pose.footY);
  ctx.scale(1, pose.squash);
  ctx.translate(-pose.x, -pose.footY);

  const footY = pose.footY - pose.bounce;
  const bodyH = u * 0.42;
  const bodyW = u * 0.46;
  const bodyCy = footY - u * 0.18 - bodyH / 2;
  const headR = u * 0.34;
  const headCy = bodyCy - bodyH / 2 - headR * 0.72;

  // 双腿交替（俯视前跑，交替表现为一前一后的上下错位）
  ctx.fillStyle = dark;
  for (const s of [-1, 1] as const) {
    const step = pose.mood === "jump" ? -u * 0.06 : s * swing * u * 0.07;
    ctx.beginPath();
    ctx.ellipse(pose.x + s * u * 0.13, footY - u * 0.07 + step, u * 0.09, u * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // P2 的小披风画在身体后面
  if (pose.who === 1 && !ghost) {
    ctx.fillStyle = c.trim;
    ctx.beginPath();
    ctx.moveTo(pose.x - bodyW * 0.52, bodyCy - bodyH * 0.4);
    ctx.quadraticCurveTo(
      pose.x - bodyW * (0.95 + 0.2 * swing),
      bodyCy + bodyH * 0.5,
      pose.x - bodyW * 0.35,
      bodyCy + bodyH * 0.62,
    );
    ctx.quadraticCurveTo(pose.x, bodyCy + bodyH * 0.3, pose.x + bodyW * 0.4, bodyCy + bodyH * 0.55);
    ctx.lineTo(pose.x + bodyW * 0.52, bodyCy - bodyH * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  // 躯干
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(pose.x, bodyCy, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // P1 的小裙摆画在身体前面，奔跑时摆一摆
  if (pose.who === 0 && !ghost) {
    ctx.fillStyle = c.trim;
    ctx.beginPath();
    ctx.moveTo(pose.x - bodyW * 0.5, bodyCy + bodyH * 0.05);
    ctx.quadraticCurveTo(
      pose.x + swing * u * 0.05,
      bodyCy + bodyH * 0.85,
      pose.x + bodyW * 0.5,
      bodyCy + bodyH * 0.05,
    );
    ctx.closePath();
    ctx.fill();
  }

  // 双臂：跟腿反相摆
  ctx.fillStyle = dark;
  for (const s of [-1, 1] as const) {
    const step = pose.mood === "jump" ? -u * 0.1 : -s * swing * u * 0.06;
    ctx.beginPath();
    ctx.ellipse(
      pose.x + s * (bodyW / 2 + u * 0.045),
      bodyCy - bodyH * 0.05 + step,
      u * 0.07,
      u * 0.1,
      s * 0.35,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // 头 + 高光
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(pose.x, headCy, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ghost ? "rgba(255,255,255,.4)" : c.light;
  ctx.beginPath();
  ctx.ellipse(pose.x - headR * 0.34, headCy - headR * 0.4, headR * 0.26, headR * 0.16, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // 呆毛：P1 花苞（茎 + 五瓣小花），P2 金色五角星——剪影层面就分得开。
  // r2 修复 W4R1-03:呆毛比例放大一档(星 0.32→0.5、花苞同步),16px 像素网格下不再消失
  if (pose.who === 0) {
    ctx.strokeStyle = "#7FBF6A";
    ctx.lineWidth = Math.max(1, u * 0.045);
    ctx.beginPath();
    ctx.moveTo(pose.x, headCy - headR * 0.95);
    ctx.quadraticCurveTo(pose.x + u * 0.03, headCy - headR * 1.24, pose.x, headCy - headR * 1.46);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      ctx.fillStyle = "#FF8FAB";
      ctx.beginPath();
      ctx.arc(
        pose.x + Math.cos(a) * headR * 0.24,
        headCy - headR * 1.52 + Math.sin(a) * headR * 0.24,
        headR * 0.16,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = "#FFE39B";
    ctx.beginPath();
    ctx.arc(pose.x, headCy - headR * 1.52, headR * 0.13, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#F5C542";
    starPath(ctx, pose.x, headCy - headR * 1.42, headR * 0.5);
    ctx.fill();
  }

  // 腮红 + 表情
  if (!ghost) {
    ctx.fillStyle = c.cheek;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(pose.x + s * headR * 0.62, headCy + headR * 0.28, headR * 0.14, headR * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  moodFace(ctx, pose, pose.x, headCy, headR, ghost ? "#8A93B8" : c.ink);

  ctx.restore();
}

/** 被撞：三颗小星绕头（替代 😵）。reduced 下星星停在固定角度，不转 */
export function drawDizzyStars(
  ctx: CanvasRenderingContext2D,
  x: number,
  headY: number,
  u: number,
  time: number,
  reduced: boolean,
): void {
  const spin = reduced ? 0 : time * 2.6;
  for (let i = 0; i < 3; i++) {
    const a = spin + (i * Math.PI * 2) / 3;
    drawSparkle(ctx, x + Math.cos(a) * u * 0.46, headY - u * 0.28 + Math.sin(a) * u * 0.14, u * 0.08, "#F5C542");
  }
}

/** 幽灵回放：头顶一簇小火苗（替代 👻 字符），reduced 下不摇 */
export function drawGhostWisp(
  ctx: CanvasRenderingContext2D,
  x: number,
  headY: number,
  u: number,
  time: number,
  reduced: boolean,
): void {
  const sway = reduced ? 0 : Math.sin(time * 7) * u * 0.03;
  ctx.fillStyle = "rgba(168,196,255,.9)";
  ctx.beginPath();
  ctx.moveTo(x + sway, headY - u * 0.62);
  ctx.quadraticCurveTo(x + u * 0.11, headY - u * 0.42, x, headY - u * 0.3);
  ctx.quadraticCurveTo(x - u * 0.11, headY - u * 0.42, x + sway, headY - u * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.beginPath();
  ctx.arc(x, headY - u * 0.4, u * 0.045, 0, Math.PI * 2);
  ctx.fill();
}

/** 加速尾焰：三根速度线 + 两粒星屑（替代 💨）。reduced 下线长固定、不撒星屑 */
export function drawSpeedTrail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  time: number,
  reduced: boolean,
): void {
  ctx.strokeStyle = "rgba(255,214,90,.85)";
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const wig = reduced ? 0 : Math.sin(time * 18 + i * 2.1) * u * 0.05;
    const ly = y - u * 0.28 + i * u * 0.24;
    ctx.lineWidth = Math.max(1.2, u * 0.05);
    ctx.beginPath();
    ctx.moveTo(x - u * 0.5, ly);
    ctx.lineTo(x - u * (0.86 + 0.1 * i) - wig, ly);
    ctx.stroke();
  }
  if (!reduced) {
    drawSparkle(ctx, x - u * 0.72, y - u * 0.42, u * 0.06);
    drawSparkle(ctx, x - u * 0.95, y + u * 0.18, u * 0.05);
  }
}

/** 加油：绘制的心形往上飘（替代 💖）。progress 0…1，reduced 下不飘只淡出 */
export function drawCheerHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  progress: number,
  reduced: boolean,
): void {
  const t = Math.max(0, Math.min(1, progress));
  const rise = reduced ? 0 : t * u * 0.5;
  ctx.save();
  ctx.globalAlpha *= 1 - t * 0.8;
  drawHeart(ctx, x, y - rise, u * 0.16);
  ctx.restore();
}

/** 头像模式：椭圆裁剪 drawImage（沿 1.2 口径）+ 角色色描边环 */
export function drawAvatarBody(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  who: 0 | 1,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  ctx.restore();
  ctx.strokeStyle = SEAT_RING[who];
  ctx.lineWidth = Math.max(1.5, w * 0.06);
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** 进度对比条上的迷你脸：小圆 + 呆毛 + 点眼，形状与颜色都区分 */
export function drawMiniFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  who: 0 | 1,
): void {
  const c = who === 0 ? P1_COLORS : P2_COLORS;
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = c.dark;
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.stroke();
  if (who === 0) {
    ctx.fillStyle = "#FF8FAB";
    ctx.beginPath();
    ctx.arc(x, y - r * 1.12, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#F5C542";
    starPath(ctx, x, y - r * 1.14, r * 0.44);
    ctx.fill();
  }
  ctx.fillStyle = c.ink;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * r * 0.34, y, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------------- 障碍：材质升级，轮廓与判定尺寸不变 ---------------- */

export type ObstacleSprite = "pit" | "rock" | "hurdle" | "gate";

/** 落地影（四种障碍统一先画这一笔） */
function groundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = "rgba(60,60,90,.2)";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 画一个障碍。`themeIndex` 跟座位主题走：0 = 粉（圆石），1 = 蓝（水晶簇）。
 * 轮廓尺寸与 1.2 完全一致（判定在 logic.ts，画大画小都不影响碰撞）。
 */
export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  kind: ObstacleSprite,
  x: number,
  y: number,
  u: number,
  themeIndex: 0 | 1,
): void {
  if (kind === "pit") {
    // 泥坑：外圈土色 → 内壁渐变收深，边上两粒碎石
    ctx.fillStyle = "#8A6242";
    ctx.beginPath();
    ctx.ellipse(x, y, u * 0.42, u * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(x, y, u * 0.05, x, y, u * 0.33);
    g.addColorStop(0, "#2E1D10");
    g.addColorStop(1, "#54371F");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, u * 0.33, u * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,236,214,.5)";
    ctx.lineWidth = Math.max(1, u * 0.025);
    ctx.beginPath();
    ctx.ellipse(x, y - u * 0.012, u * 0.4, u * 0.145, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = "#B08A62";
    for (const [dx, dy, r] of [
      [-u * 0.34, -u * 0.06, u * 0.045],
      [u * 0.3, u * 0.08, u * 0.038],
    ]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (kind === "rock") {
    groundShadow(ctx, x, y, u * 0.36, u * 0.12);
    if (themeIndex === 1) {
      // 蓝主题：水晶簇（三根晶柱，左亮右暗 + 高光线）
      const shard = (cx: number, w: number, h: number): void => {
        ctx.fillStyle = "#7FA8E8";
        ctx.beginPath();
        ctx.moveTo(cx, y - h);
        ctx.lineTo(cx + w, y - h * 0.28);
        ctx.lineTo(cx + w * 0.6, y);
        ctx.lineTo(cx - w * 0.6, y);
        ctx.lineTo(cx - w, y - h * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#C8DCFA";
        ctx.beginPath();
        ctx.moveTo(cx, y - h);
        ctx.lineTo(cx - w, y - h * 0.28);
        ctx.lineTo(cx - w * 0.6, y);
        ctx.lineTo(cx - w * 0.1, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.8)";
        ctx.lineWidth = Math.max(1, u * 0.02);
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.2, y - h * 0.82);
        ctx.lineTo(cx - w * 0.42, y - h * 0.3);
        ctx.stroke();
      };
      shard(x, u * 0.16, u * 0.58);
      shard(x - u * 0.22, u * 0.11, u * 0.36);
      shard(x + u * 0.21, u * 0.1, u * 0.3);
    } else {
      // 粉主题：圆石（亮顶暗底 + 高光 + 一颗小伴石）
      const g = ctx.createLinearGradient(x, y - u * 0.58, x, y);
      g.addColorStop(0, "#C4B9B0");
      g.addColorStop(1, "#8D7F74");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y - u * 0.28, u * 0.34, u * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#E4DAD1";
      ctx.beginPath();
      ctx.ellipse(x - u * 0.12, y - u * 0.42, u * 0.13, u * 0.08, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#A79A90";
      ctx.beginPath();
      ctx.ellipse(x + u * 0.28, y - u * 0.09, u * 0.1, u * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (kind === "hurdle") {
    // 矮木栏：木纹立柱 + 双色横板 + 钉点（跳过去）
    const w = u * 0.4;
    const barY = y - u * 0.3;
    const th = u * 0.09;
    groundShadow(ctx, x, y + u * 0.01, w * 1.05, u * 0.05);
    ctx.fillStyle = "#B57B44";
    ctx.fillRect(x - w, barY, w * 0.16, u * 0.3);
    ctx.fillRect(x + w - w * 0.16, barY, w * 0.16, u * 0.3);
    ctx.strokeStyle = "rgba(120,72,32,.65)";
    ctx.lineWidth = Math.max(0.8, u * 0.015);
    for (const px of [x - w + w * 0.08, x + w - w * 0.08]) {
      ctx.beginPath();
      ctx.moveTo(px, barY + th * 1.4);
      ctx.lineTo(px, y - u * 0.04);
      ctx.stroke();
    }
    const g = ctx.createLinearGradient(x, barY, x, barY + th);
    g.addColorStop(0, "#EDBB84");
    g.addColorStop(1, "#CE9256");
    ctx.fillStyle = g;
    ctx.fillRect(x - w, barY, w * 2, th);
    ctx.fillStyle = "#FFE9CC";
    ctx.fillRect(x - w, barY, w * 2, th * 0.3);
    ctx.fillStyle = "#8A5A30";
    for (const px of [x - w * 0.86, x + w * 0.86]) {
      ctx.beginPath();
      ctx.arc(px, barY + th * 0.55, th * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  // 高横杆：金属立柱（渐变 + 镜面高光线）+ 横梁 + 中央小三角旗（下滑钻过去）
  const w = u * 0.42;
  const top = y - u * 0.95;
  const th = u * 0.2;
  groundShadow(ctx, x, y + u * 0.01, w * 1.05, u * 0.05);
  for (const s of [-1, 1] as const) {
    const px = s === -1 ? x - w : x + w - w * 0.15;
    const g = ctx.createLinearGradient(px, 0, px + w * 0.15, 0);
    g.addColorStop(0, "#9FC4EE");
    g.addColorStop(1, "#6E9BD0");
    ctx.fillStyle = g;
    ctx.fillRect(px, top, w * 0.15, u * 0.95);
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.fillRect(px + w * 0.04, top + th * 0.5, w * 0.03, u * 0.85);
  }
  ctx.fillStyle = "#5C8FCB";
  ctx.fillRect(x - w, top, w * 2, th);
  ctx.fillStyle = "#EAF3FF";
  ctx.fillRect(x - w * 0.6, top + th * 0.3, w * 1.2, th * 0.34);
  ctx.fillStyle = "#FFD9E8";
  ctx.beginPath();
  ctx.moveTo(x - w * 0.14, top + th);
  ctx.lineTo(x + w * 0.14, top + th);
  ctx.lineTo(x, top + th + u * 0.16);
  ctx.closePath();
  ctx.fill();
}

/* ---------------- 道具图标：emoji → 绘制 ---------------- */

/** 糖泡里的道具小图标（替代 POWERUPS[].emoji 字符） */
export function drawPowerIcon(
  ctx: CanvasRenderingContext2D,
  kind: PowerKind,
  x: number,
  y: number,
  r: number,
): void {
  if (kind === "speedCloud") {
    // 小云 + 两根速度线
    ctx.fillStyle = "#FFFFFF";
    for (const [dx, dy, cr] of [
      [0, 0, r * 0.5],
      [-r * 0.5, r * 0.15, r * 0.36],
      [r * 0.5, r * 0.15, r * 0.36],
    ]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, cr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#8FB9E8";
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.lineCap = "round";
    for (const dy of [-r * 0.15, r * 0.25]) {
      ctx.beginPath();
      ctx.moveTo(x - r * 1.15, y + dy);
      ctx.lineTo(x - r * 0.65, y + dy);
      ctx.stroke();
    }
    return;
  }
  if (kind === "shieldBubble") {
    // 盾形 + 高光
    ctx.fillStyle = "#8FC7F0";
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.8);
    ctx.quadraticCurveTo(x + r * 0.85, y - r * 0.55, x + r * 0.7, y + r * 0.1);
    ctx.quadraticCurveTo(x + r * 0.5, y + r * 0.65, x, y + r * 0.9);
    ctx.quadraticCurveTo(x - r * 0.5, y + r * 0.65, x - r * 0.7, y + r * 0.1);
    ctx.quadraticCurveTo(x - r * 0.85, y - r * 0.55, x, y - r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#5C8FCB";
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.28, y - r * 0.4);
    ctx.lineTo(x - r * 0.28, y + r * 0.3);
    ctx.stroke();
    return;
  }
  if (kind === "confetti") {
    // 一束纸屑：三张彩纸 + 放射线
    ctx.strokeStyle = "#C9A0E8";
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.lineCap = "round";
    for (const a of [-2.2, -1.57, -0.9]) {
      ctx.beginPath();
      ctx.moveTo(x, y + r * 0.5);
      ctx.lineTo(x + Math.cos(a) * r * 0.9, y + r * 0.5 + Math.sin(a) * r * 0.9);
      ctx.stroke();
    }
    const papers: Array<[number, number, string, number]> = [
      [-r * 0.55, -r * 0.5, "#FFC6DC", 0.5],
      [0, -r * 0.75, "#B9D4FA", -0.3],
      [r * 0.55, -r * 0.45, "#FFE39B", 0.2],
    ];
    for (const [dx, dy, color, rot] of papers) {
      ctx.save();
      ctx.translate(x + dx, y + dy);
      ctx.rotate(rot);
      ctx.fillStyle = color;
      ctx.fillRect(-r * 0.18, -r * 0.12, r * 0.36, r * 0.24);
      ctx.restore();
    }
    return;
  }
  // magnetStar 磁力星：金星 + 两道吸引弧
  ctx.fillStyle = "#F5C542";
  starPath(ctx, x, y, r * 0.62);
  ctx.fill();
  ctx.strokeStyle = "#E8788A";
  ctx.lineWidth = Math.max(1, r * 0.12);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x, y, r * (0.85 + 0.12 * (s + 1)), s * -0.6 - 0.35, s * -0.6 + 0.35);
    ctx.stroke();
  }
}

/* ---------------- 加速带：发光流动箭头 ---------------- */

/** 箭头流动相位：reduced-motion 下恒 0（静止），否则随时间循环 */
export function boostArrowPhase(time: number, reduced: boolean): number {
  if (reduced) return 0;
  return (time * 2.2) % 1;
}

/** 发光跑道加速带：绿底光晕 + 三枚向前流动的箭头 */
export function drawBoostPad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  phase: number,
): void {
  const g = ctx.createRadialGradient(x, y, u * 0.06, x, y, u * 0.46);
  g.addColorStop(0, "rgba(158,236,178,.95)");
  g.addColorStop(1, "rgba(126,220,150,.25)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, u * 0.42, u * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(62,155,99,.55)";
  ctx.lineWidth = Math.max(1, u * 0.02);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    // phase 让三枚箭头往「前方」循环流动，最亮的一枚在最前
    const t = (i + phase) % 3;
    const dy = y + u * 0.04 - t * u * 0.09;
    const glow = 0.45 + 0.55 * (t / 3);
    ctx.fillStyle = `rgba(46,139,87,${glow.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(x - u * 0.19, dy);
    ctx.lineTo(x, dy - u * 0.12);
    ctx.lineTo(x + u * 0.19, dy);
    ctx.lineTo(x, dy - u * 0.045);
    ctx.closePath();
    ctx.fill();
  }
}

/* ---------------- 场景装饰：第三层视差 / 天体 / 云 / 路旗 ---------------- */

/** 近景剪影的四种花样（主题查表用；本款两个主题各挑一种，其余留给换装） */
export type DecorKind = "tree" | "candy" | "ice" | "starTower";

/** 一棵近景剪影装饰。(x, baseY) 是落地点，h 是高度，单色剪影 + 一点亮部 */
export function drawDecorSilhouette(
  ctx: CanvasRenderingContext2D,
  kind: DecorKind,
  x: number,
  baseY: number,
  h: number,
  color: string,
  lightColor: string,
): void {
  ctx.fillStyle = color;
  if (kind === "tree") {
    ctx.fillRect(x - h * 0.05, baseY - h * 0.34, h * 0.1, h * 0.34);
    ctx.beginPath();
    ctx.arc(x, baseY - h * 0.58, h * 0.3, 0, Math.PI * 2);
    ctx.arc(x - h * 0.18, baseY - h * 0.4, h * 0.22, 0, Math.PI * 2);
    ctx.arc(x + h * 0.18, baseY - h * 0.4, h * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.arc(x - h * 0.08, baseY - h * 0.66, h * 0.09, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (kind === "candy") {
    // 糖果柱：圆头柱 + 斜纹
    ctx.beginPath();
    ctx.moveTo(x - h * 0.12, baseY);
    ctx.lineTo(x - h * 0.12, baseY - h * 0.7);
    ctx.arc(x, baseY - h * 0.7, h * 0.12, Math.PI, 0);
    ctx.lineTo(x + h * 0.12, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = lightColor;
    ctx.lineWidth = h * 0.05;
    for (let i = 0; i < 3; i++) {
      const sy = baseY - h * (0.16 + i * 0.22);
      ctx.beginPath();
      ctx.moveTo(x - h * 0.12, sy);
      ctx.lineTo(x + h * 0.12, sy - h * 0.1);
      ctx.stroke();
    }
    return;
  }
  if (kind === "ice") {
    // 冰锥：一高一矮两根
    ctx.beginPath();
    ctx.moveTo(x - h * 0.18, baseY);
    ctx.lineTo(x - h * 0.04, baseY - h * 0.8);
    ctx.lineTo(x + h * 0.1, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + h * 0.02, baseY);
    ctx.lineTo(x + h * 0.16, baseY - h * 0.45);
    ctx.lineTo(x + h * 0.3, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = lightColor;
    ctx.lineWidth = h * 0.035;
    ctx.beginPath();
    ctx.moveTo(x - h * 0.07, baseY - h * 0.6);
    ctx.lineTo(x - h * 0.11, baseY - h * 0.2);
    ctx.stroke();
    return;
  }
  // starTower 星塔：收窄的塔身 + 顶上一颗星
  ctx.beginPath();
  ctx.moveTo(x - h * 0.16, baseY);
  ctx.lineTo(x - h * 0.06, baseY - h * 0.66);
  ctx.lineTo(x + h * 0.06, baseY - h * 0.66);
  ctx.lineTo(x + h * 0.16, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = lightColor;
  starPath(ctx, x, baseY - h * 0.8, h * 0.13);
  ctx.fill();
}

/** 天上挂的太阳 / 月亮 */
export function drawCelestial(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  kind: "sun" | "moon",
): void {
  if (kind === "sun") {
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.6);
    g.addColorStop(0, "rgba(255,227,155,.9)");
    g.addColorStop(1, "rgba(255,227,155,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFD34D";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.24, r * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = "#F4F6FF";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#D8DEF4";
  for (const [dx, dy, cr] of [
    [-r * 0.25, -r * 0.15, r * 0.2],
    [r * 0.3, r * 0.25, r * 0.14],
  ]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, cr, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 一朵慢云（视差 0.03 由调用方算偏移） */
export function drawCloudPuff(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = "rgba(255,255,255,.8)";
  for (const [dx, dy, cr] of [
    [0, 0, r],
    [-r * 0.9, r * 0.2, r * 0.7],
    [r * 0.9, r * 0.2, r * 0.7],
  ]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, cr, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 路边小旗 / 路牌（纯装饰，用 project 放在路肩外侧） */
export function drawRoadsideFlag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  color: string,
  variant: 0 | 1,
): void {
  ctx.strokeStyle = "#B0906A";
  ctx.lineWidth = Math.max(1, h * 0.07);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h);
  ctx.stroke();
  if (variant === 0) {
    // 三角小旗
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + h * 0.52, y - h * 0.82);
    ctx.lineTo(x, y - h * 0.64);
    ctx.closePath();
    ctx.fill();
    return;
  }
  // 圆角小路牌 + 向前的箭头
  ctx.fillStyle = "#FFF7EC";
  ctx.beginPath();
  ctx.roundRect(x - h * 0.3, y - h, h * 0.6, h * 0.42, h * 0.1);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, h * 0.08);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - h * 0.1, y - h * 0.68);
  ctx.lineTo(x, y - h * 0.9);
  ctx.lineTo(x + h * 0.1, y - h * 0.68);
  ctx.stroke();
}
