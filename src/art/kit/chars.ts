/**
 * 1.3 素材包 · 朵朵与星星（`src/art/kit/chars.ts`）
 *
 * 全家 IP 的两位主角，Q 版 2–3 头身，底色 + 暗部 + 高光三阶光影：
 * - 朵朵：粉色花瓣头饰（剪影特征），花心是脸，绿叶发夹点缀，波浪裙摆。
 * - 星星：五角星轮廓的大脑袋（剪影特征）+ 蓝披风，星面中央是脸。
 *
 * 约定：`(x, y)` 是脚底中心，`size` 是总身高（px）。
 * `t` 是 0–1 循环相位：idle 呼吸浮动 ≤ size 的 4%，相位落在眨眼窗口时闭眼。
 * `facing:"left"` 用坐标翻转实现，配饰随身体镜像、位置保持正确。
 * 换 `skin` 只换颜色组，不改任何路径数（剪影不变）。
 *
 * 纯绘制函数：只吃传入的 ctx，不查 DOM、不建 canvas、不挂监听。
 * 极端输入（size ≤ 0、NaN、未知 pose）不抛异常、不画出 NaN 坐标。
 */

import { CHAR_COLORS, KIT_PALETTE, shade, tint, type CharColorSet } from "./palette";

export type KitPose = "idle" | "run" | "jump" | "hurt" | "win";
export type KitFacing = "left" | "right";

/** 皮肤就是一组角色配色；换肤只换色、不改剪影 */
export type KitSkin = CharColorSet;

export interface CharOpts {
  /** 脚底中心 x */
  x: number;
  /** 脚底基线 y */
  y: number;
  /** 总身高（px），必须 > 0 */
  size: number;
  facing?: KitFacing;
  pose?: KitPose;
  /** 0–1 循环相位（越界自动取小数部分） */
  t?: number;
  skin?: KitSkin;
}

/** 动画契约常量（素材契约测试直接断言这里） */
export const CHAR_ANIM = {
  /** idle 呼吸振幅（相对 size），宪法上限 0.04 */
  breathAmp: 0.02,
  /** 眨眼窗口 [start, end)，idle / run 相位落进来就闭眼 */
  blinkStart: 0.62,
  blinkEnd: 0.7,
  /** run 一个 t 循环里迈几步 */
  runCycles: 2
} as const;

/** 朵朵皮肤：默认 + 冬装（深莓粉大衣 + 冰蓝配饰），只换色组 */
export const DUODUO_SKINS: Readonly<Record<"default" | "winter", KitSkin>> = {
  default: CHAR_COLORS.duoduo,
  winter: { primary: "#e0679a", secondary: "#fff6f9", accent: "#9fd7f0", outline: "#7c4560" }
};

/** 星星皮肤：默认 + 冬装（暖金 + 深冬夜蓝披风），只换色组 */
export const XINGXING_SKINS: Readonly<Record<"default" | "winter", KitSkin>> = {
  default: CHAR_COLORS.xingxing,
  winter: { primary: "#f0be3a", secondary: "#fffaf0", accent: "#3f6fae", outline: "#7c5a17" }
};

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function norm01(t: number | undefined): number {
  if (typeof t !== "number" || !Number.isFinite(t)) return 0;
  return ((t % 1) + 1) % 1;
}

const POSES: ReadonlySet<string> = new Set(["idle", "run", "jump", "hurt", "win"]);

function normPose(pose: string | undefined): KitPose {
  return POSES.has(pose ?? "") ? (pose as KitPose) : "idle";
}

/** 一帧的骨架参数：由 pose + t 推出，画的时候只读它 */
interface Rig {
  /** 身体整体升降（px，负为上浮） */
  bob: number;
  /** 手臂摆角（rad，0 = 垂直向下，正 = 朝面向方向摆） */
  armL: number;
  armR: number;
  /** 腿摆角 */
  legL: number;
  legR: number;
  /** 腿收起程度 0–1（jump 蜷腿用） */
  crouch: number;
  blink: boolean;
  mood: "normal" | "hurt" | "win";
}

function poseRig(pose: KitPose, t: number, size: number): Rig {
  const blink = t >= CHAR_ANIM.blinkStart && t < CHAR_ANIM.blinkEnd;
  switch (pose) {
    case "run": {
      const swing = Math.sin(t * TAU * CHAR_ANIM.runCycles);
      return {
        bob: -Math.abs(Math.sin(t * TAU * CHAR_ANIM.runCycles)) * size * 0.025,
        armL: swing * 0.9,
        armR: -swing * 0.9,
        legL: -swing * 0.65,
        legR: swing * 0.65,
        crouch: 0,
        blink,
        mood: "normal"
      };
    }
    case "jump":
      return {
        bob: -size * 0.06,
        armL: 2.6,
        armR: 2.6,
        legL: -0.35,
        legR: 0.35,
        crouch: 0.65,
        blink: false,
        mood: "normal"
      };
    case "hurt":
      return {
        bob: size * 0.01,
        armL: -0.4,
        armR: 0.4,
        legL: -0.18,
        legR: 0.18,
        crouch: 0,
        blink: false,
        mood: "hurt"
      };
    case "win":
      return {
        bob: -Math.abs(Math.sin(t * TAU)) * size * 0.03,
        armL: 2.7,
        armR: 2.7,
        legL: -0.22,
        legR: 0.22,
        crouch: 0,
        blink: false,
        mood: "win"
      };
    default:
      // idle：呼吸浮动 ≤ size 的 4%（振幅 0.02 → 峰峰值 0.04）
      return {
        bob: Math.sin(t * TAU) * size * CHAR_ANIM.breathAmp,
        armL: Math.sin(t * TAU) * 0.06,
        armR: -Math.sin(t * TAU) * 0.06,
        legL: 0,
        legR: 0,
        crouch: 0,
        blink,
        mood: "normal"
      };
  }
}

/** 圆头短四肢：一条粗圆帽线段 */
function limb(
  ctx: Ctx,
  x0: number,
  y0: number,
  len: number,
  ang: number,
  width: number,
  color: string
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + Math.sin(ang) * len, y0 + Math.cos(ang) * len);
  ctx.stroke();
}

function limbEnd(x0: number, y0: number, len: number, ang: number): { x: number; y: number } {
  return { x: x0 + Math.sin(ang) * len, y: y0 + Math.cos(ang) * len };
}

/** 标准五角星路径（chars 内部用：星星的头、胜利撒花） */
function starPath(
  ctx: Ctx,
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  rot = -Math.PI / 2,
  points = 5
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (i * Math.PI) / points;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** 眼睛 + 腮红 + 嘴：两位角色共用的五官画法 */
function drawFace(ctx: Ctx, cx: number, cy: number, r: number, rig: Rig, colors: KitSkin): void {
  const eyeDX = r * 0.36;
  const eyeY = cy - r * 0.08;
  const eyeR = Math.max(r * 0.13, 0.7);
  const ink = KIT_PALETTE.ink;

  if (rig.mood === "hurt") {
    // 「><」眼：每只眼两道短斜线，不出血
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(r * 0.07, 0.6);
    ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      const ex = cx + side * eyeDX;
      ctx.beginPath();
      ctx.moveTo(ex - side * eyeR, eyeY - eyeR);
      ctx.lineTo(ex + side * eyeR * 0.6, eyeY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex - side * eyeR, eyeY + eyeR);
      ctx.lineTo(ex + side * eyeR * 0.6, eyeY);
      ctx.stroke();
    }
  } else if (rig.mood === "win" || rig.blink) {
    // 胜利眯眯眼（^ ^）与眨眼共用弯弧画法，方向不同
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(r * 0.08, 0.6);
    ctx.lineCap = "round";
    const up = rig.mood === "win";
    for (const side of [-1, 1]) {
      const ex = cx + side * eyeDX;
      ctx.beginPath();
      ctx.arc(ex, up ? eyeY + eyeR * 0.5 : eyeY - eyeR * 0.5, eyeR, up ? Math.PI * 1.15 : Math.PI * 0.15, up ? Math.PI * 1.85 : Math.PI * 0.85);
      ctx.stroke();
    }
  } else {
    // 睁眼：墨色圆眼 + 高光点
    for (const side of [-1, 1]) {
      const ex = cx + side * eyeDX;
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(ex, eyeY, eyeR, 0, TAU);
      ctx.fill();
      ctx.fillStyle = KIT_PALETTE.cloud;
      ctx.beginPath();
      ctx.arc(ex - eyeR * 0.3, eyeY - eyeR * 0.32, eyeR * 0.34, 0, TAU);
      ctx.fill();
    }
  }

  // 腮红
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = KIT_PALETTE.blush;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * r * 0.6, cy + r * 0.3, r * 0.17, r * 0.11, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 嘴
  const mouthY = cy + r * 0.36;
  if (rig.mood === "hurt") {
    // 委屈扁嘴（向下弯）
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(r * 0.07, 0.6);
    ctx.beginPath();
    ctx.arc(cx, mouthY + r * 0.18, r * 0.2, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  } else if (rig.mood === "win") {
    // 开心大笑：实心半圆嘴
    ctx.fillStyle = shade(colors.outline, 0.2);
    ctx.beginPath();
    ctx.arc(cx, mouthY, r * 0.24, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  } else {
    // 平时的小微笑
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(r * 0.07, 0.6);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, mouthY - r * 0.06, r * 0.18, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
}

/** 受伤时头顶的眩晕圈：椭圆轨道 + 三颗绕圈小星点（不出血） */
function drawDizzy(ctx: Ctx, cx: number, cy: number, r: number, t: number, color: string): void {
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(r * 0.08, 0.6);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.34, 0, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = KIT_PALETTE.lemon;
  for (let i = 0; i < 3; i++) {
    const a = t * TAU + (i * TAU) / 3;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.34, Math.max(r * 0.14, 0.6), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** 胜利时身边的小星花 */
function drawWinSparkles(ctx: Ctx, size: number, shoulderY: number): void {
  ctx.fillStyle = KIT_PALETTE.lemon;
  for (const side of [-1, 1]) {
    starPath(ctx, side * size * 0.32, shoulderY - size * 0.2, size * 0.06, size * 0.025, -Math.PI / 2, 4);
    ctx.fill();
  }
}

/** 入口共用：校验、定位、翻转、姿态推导 */
function withChar(
  ctx: Ctx,
  o: CharOpts,
  defaultSkin: KitSkin,
  draw: (size: number, rig: Rig, colors: KitSkin, t: number) => void
): void {
  if (
    !Number.isFinite(o.x) ||
    !Number.isFinite(o.y) ||
    !Number.isFinite(o.size) ||
    o.size <= 0
  ) {
    return;
  }
  const t = norm01(o.t);
  const rig = poseRig(normPose(o.pose), t, o.size);
  const colors = o.skin ?? defaultSkin;
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.facing === "left") ctx.scale(-1, 1);
  draw(o.size, rig, colors, t);
  ctx.restore();
}

/**
 * 朵朵：粉花瓣头饰的小姑娘。花瓣双层（后层暗、前层亮）给体积，
 * 花心是脸，绿叶发夹是不对称剪影特征，裙摆带暗部色带与高光斑。
 */
export function drawDuoduo(ctx: Ctx, o: CharOpts): void {
  withChar(ctx, o, DUODUO_SKINS.default, (H, rig, c, t) => {
    const headR = H * 0.3;
    const headY = -H * 0.62 + rig.bob;
    const shoulderY = -H * 0.4 + rig.bob;
    const hemY = -H * 0.14 + rig.bob;
    const limbW = H * 0.085;
    const outlineW = Math.max(H * 0.018, 0.6);

    // 腿与鞋（画在裙子后面）
    const legLen = H * 0.17 * (1 - rig.crouch * 0.6);
    const legTopY = -H * 0.18 + rig.bob;
    const legColor = tint(c.secondary, 0.3);
    const shoeColor = shade(c.primary, 0.3);
    for (const [lx, ang] of [
      [-H * 0.09, rig.legL],
      [H * 0.09, rig.legR]
    ] as const) {
      limb(ctx, lx, legTopY, legLen, ang, limbW, legColor);
      const foot = limbEnd(lx, legTopY, legLen, ang);
      ctx.fillStyle = shoeColor;
      ctx.beginPath();
      ctx.ellipse(foot.x + H * 0.012, foot.y, limbW * 0.72, limbW * 0.5, 0, 0, TAU);
      ctx.fill();
    }

    // 裙身：底色（有宽度的躯干，宪法反火柴人条款）
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-H * 0.13, shoulderY);
    ctx.lineTo(H * 0.13, shoulderY);
    ctx.quadraticCurveTo(H * 0.23, hemY - H * 0.02, H * 0.2, hemY);
    ctx.quadraticCurveTo(H * 0.1, hemY + H * 0.035, 0, hemY + H * 0.02);
    ctx.quadraticCurveTo(-H * 0.1, hemY + H * 0.035, -H * 0.2, hemY);
    ctx.quadraticCurveTo(-H * 0.23, hemY - H * 0.02, -H * 0.13, shoulderY);
    ctx.closePath();
    ctx.fillStyle = c.primary;
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = outlineW;
    ctx.stroke();
    // 裙摆暗部色带
    ctx.fillStyle = shade(c.primary, 0.22);
    ctx.beginPath();
    ctx.ellipse(0, hemY, H * 0.18, H * 0.045, 0, 0, TAU);
    ctx.fill();
    // 裙面高光斑
    ctx.fillStyle = tint(c.primary, 0.45);
    ctx.beginPath();
    ctx.ellipse(-H * 0.06, shoulderY + H * 0.07, H * 0.05, H * 0.075, 0.35, 0, TAU);
    ctx.fill();

    // 手臂（袖子色，圆帽短臂）
    const armColor = tint(c.primary, 0.18);
    limb(ctx, -H * 0.12, shoulderY + H * 0.02, H * 0.15, rig.armL, limbW, armColor);
    limb(ctx, H * 0.12, shoulderY + H * 0.02, H * 0.15, rig.armR, limbW, armColor);

    // 花瓣头饰：后层（暗阶）
    const petals = 8;
    ctx.fillStyle = shade(c.primary, 0.2);
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU + Math.PI / petals;
      ctx.save();
      ctx.translate(Math.cos(a) * headR * 0.92, headY + Math.sin(a) * headR * 0.92);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(headR * 0.16, 0, headR * 0.44, headR * 0.25, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // 花瓣前层（底色）
    ctx.fillStyle = c.primary;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU;
      ctx.save();
      ctx.translate(Math.cos(a) * headR * 0.88, headY + Math.sin(a) * headR * 0.88);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(headR * 0.14, 0, headR * 0.42, headR * 0.26, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // 左上两片花瓣的高光阶
    ctx.fillStyle = tint(c.primary, 0.4);
    for (const a of [-Math.PI * 0.75, -Math.PI * 0.5]) {
      ctx.save();
      ctx.translate(Math.cos(a) * headR * 0.88, headY + Math.sin(a) * headR * 0.88);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(headR * 0.1, 0, headR * 0.26, headR * 0.14, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // 绿叶发夹（不对称剪影特征，随 facing 镜像保持在脸颊侧）
    ctx.save();
    ctx.translate(headR * 0.98, headY + headR * 0.55);
    ctx.rotate(0.85);
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.ellipse(0, 0, headR * 0.3, headR * 0.14, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = shade(c.accent, 0.35);
    ctx.lineWidth = Math.max(headR * 0.05, 0.5);
    ctx.beginPath();
    ctx.moveTo(-headR * 0.22, 0);
    ctx.lineTo(headR * 0.22, 0);
    ctx.stroke();
    ctx.restore();

    // 花心 = 脸
    ctx.fillStyle = c.secondary;
    ctx.beginPath();
    ctx.arc(0, headY, headR * 0.74, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = outlineW;
    ctx.stroke();

    drawFace(ctx, 0, headY, headR * 0.74, rig, c);

    if (rig.mood === "hurt") {
      drawDizzy(ctx, 0, headY - headR * 1.5, headR * 0.85, t, c.outline);
    } else if (rig.mood === "win") {
      drawWinSparkles(ctx, H, shoulderY);
    }
  });
}

/**
 * 星星：五角星轮廓大脑袋 + 蓝披风的小家伙。星头三层（底影 / 主体 / 高光），
 * 星尖用同色圆角描边磨圆，脸开在星面中央，披风飘向身后。
 */
export function drawXingxing(ctx: Ctx, o: CharOpts): void {
  withChar(ctx, o, XINGXING_SKINS.default, (H, rig, c, t) => {
    const R = H * 0.33;
    const headY = -H * 0.58 + rig.bob;
    const shoulderY = -H * 0.34 + rig.bob;
    const limbW = H * 0.08;
    const outlineW = Math.max(H * 0.018, 0.6);

    // 披风（最底层，向身后飘；镜像后仍在背侧，方向正确）
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-H * 0.08, shoulderY - H * 0.02);
    ctx.quadraticCurveTo(-H * 0.32, -H * 0.2 + rig.bob, -H * 0.26, -H * 0.02 + rig.bob);
    ctx.quadraticCurveTo(-H * 0.18, -H * 0.07 + rig.bob, -H * 0.12, -H * 0.03 + rig.bob);
    ctx.quadraticCurveTo(-H * 0.07, -H * 0.08 + rig.bob, -H * 0.02, -H * 0.05 + rig.bob);
    ctx.lineTo(H * 0.06, shoulderY - H * 0.02);
    ctx.closePath();
    ctx.fillStyle = c.accent;
    ctx.fill();
    // 披风内侧暗阶
    ctx.fillStyle = shade(c.accent, 0.25);
    ctx.beginPath();
    ctx.moveTo(-H * 0.08, shoulderY);
    ctx.quadraticCurveTo(-H * 0.24, -H * 0.16 + rig.bob, -H * 0.2, -H * 0.04 + rig.bob);
    ctx.quadraticCurveTo(-H * 0.12, -H * 0.1 + rig.bob, -H * 0.05, shoulderY + H * 0.04);
    ctx.closePath();
    ctx.fill();

    // 腿与靴子
    const legLen = H * 0.16 * (1 - rig.crouch * 0.6);
    const legTopY = -H * 0.16 + rig.bob;
    const legColor = tint(c.secondary, 0.25);
    const bootColor = shade(c.accent, 0.15);
    for (const [lx, ang] of [
      [-H * 0.08, rig.legL],
      [H * 0.08, rig.legR]
    ] as const) {
      limb(ctx, lx, legTopY, legLen, ang, limbW, legColor);
      const foot = limbEnd(lx, legTopY, legLen, ang);
      ctx.fillStyle = bootColor;
      ctx.beginPath();
      ctx.ellipse(foot.x + H * 0.01, foot.y, limbW * 0.7, limbW * 0.5, 0, 0, TAU);
      ctx.fill();
    }

    // 躯干：奶油色小身板 + 腰带（有宽度，反火柴人）
    ctx.fillStyle = c.secondary;
    ctx.beginPath();
    ctx.ellipse(0, -H * 0.23 + rig.bob, H * 0.13, H * 0.15, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = outlineW;
    ctx.stroke();
    ctx.fillStyle = shade(c.secondary, 0.16);
    ctx.beginPath();
    ctx.ellipse(0, -H * 0.16 + rig.bob, H * 0.115, H * 0.035, 0, 0, TAU);
    ctx.fill();

    // 手臂
    const armColor = tint(c.primary, 0.2);
    limb(ctx, -H * 0.11, shoulderY + H * 0.02, H * 0.14, rig.armL, limbW, armColor);
    limb(ctx, H * 0.11, shoulderY + H * 0.02, H * 0.14, rig.armR, limbW, armColor);

    // 披风领结（前侧点缀）
    ctx.fillStyle = shade(c.accent, 0.1);
    ctx.beginPath();
    ctx.arc(H * 0.07, shoulderY - H * 0.01, H * 0.035, 0, TAU);
    ctx.fill();

    // 星头底影（体积暗阶）
    ctx.fillStyle = shade(c.primary, 0.3);
    starPath(ctx, 0, headY + R * 0.08, R, R * 0.5);
    ctx.fill();
    // 星头主体，同色粗圆角描边把星尖磨圆
    ctx.fillStyle = c.primary;
    starPath(ctx, 0, headY, R, R * 0.5);
    ctx.fill();
    ctx.strokeStyle = c.primary;
    ctx.lineWidth = R * 0.18;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
    // 左上星角高光阶
    ctx.fillStyle = tint(c.primary, 0.5);
    ctx.beginPath();
    ctx.ellipse(-R * 0.42, headY - R * 0.42, R * 0.2, R * 0.1, -0.65, 0, TAU);
    ctx.fill();

    // 星面中央的脸
    const faceR = R * 0.52;
    ctx.fillStyle = c.secondary;
    ctx.beginPath();
    ctx.arc(0, headY + R * 0.06, faceR, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = c.outline;
    ctx.lineWidth = outlineW;
    ctx.stroke();

    drawFace(ctx, 0, headY + R * 0.06, faceR, rig, c);

    if (rig.mood === "hurt") {
      drawDizzy(ctx, 0, headY - R * 1.35, R * 0.8, t, c.outline);
    } else if (rig.mood === "win") {
      drawWinSparkles(ctx, H, shoulderY);
    }
  });
}
