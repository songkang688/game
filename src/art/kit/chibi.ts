/**
 * 共享美术套件 · 圆头小人(1.3 视觉升级)。
 *
 * 双人游戏的两位主角(朵朵 / 星星)共用这一份参数化画法:
 * 肤色 / 发饰 / 服装 / 朝向 / 步态相位全是参数,剪影靠「发饰 + 裙裤」双保险区分,
 * 不只靠颜色 —— 灰度截图下也分得清谁是谁。
 *
 * 工序单(固定顺序):
 *   1. 椭圆落影(0.7 格宽、0.18 格高);
 *   2. 身体:背带裤梯形(dress 裙摆外扩 / pants 直筒两腿);
 *   3. 圆头(0.55 格径)三停径向渐变 + 1.5px 描边;
 *   4. 发饰:五瓣花发卡(头顶偏左)/ 星形呆毛(头顶正中);缩到 4px 以下换高对比色块兜底;
 *   5. 表情三态:常态眨眼 / 埋弹鼓腮 / 被困「哇」嘴型;
 *   6. 步态:走路两帧脚交替 ±8px 摆动(reduced 幅度减半),蹲 0.85 倍压扁;
 *   7. 朝向:左右移动 scaleX(±1) 镜像。
 *
 * 只接受传进来的 2d 画笔,不摸 DOM;渐变 / 描边 / 落影全走本套件的 volume / outline。
 */

import { shade } from "./palette";
import { ballGradient, softShadow } from "./volume";
import { strokeOutline } from "./outline";

// ---------------------------------------------------------------------------
// 常量(测试逐个对表)
// ---------------------------------------------------------------------------

/** 圆头直径 = 0.55 × 格宽 */
export const HEAD_RATIO = 0.55;
/** 落影:0.7 格宽、0.18 格高 */
export const SHADOW_W_RATIO = 0.7;
export const SHADOW_H_RATIO = 0.18;
/** 走路两帧:脚交替摆动 ±8px(reduced 减半,不清零 —— 步态是「在动」的功能反馈) */
export const WALK_SWING_PX = 8;
/** 两帧步态每帧多少毫秒(step 缓动) */
export const WALK_FRAME_MS = 160;
/** 埋弹下蹲:0.85 倍压扁,持续 120ms */
export const SQUAT_SCALE = 0.85;
export const SQUAT_MS = 120;
/** 发饰最小可辨尺寸:低于它换高对比色块兜底 */
export const ACCESSORY_MIN_PX = 4;
/** 常态眨眼:约 3s 一次、一次 120ms(种子错开,俩人不同时眨) */
export const BLINK_PERIOD_MS = 3000;
export const BLINK_MS = 120;

export type ChibiOutfit = "dress" | "pants";
export type ChibiAccessory = "flower" | "star";
export type ChibiPose = "idle" | "walk" | "squat" | "trapped";

export interface ChibiSpec {
  /** 肤色(圆头主色,三停渐变的中停) */
  skin: string;
  /** 服装主色 */
  outfit: string;
  /** 裙 / 裤:灰度剪影保险之一 */
  outfitStyle: ChibiOutfit;
  /** 发饰:灰度剪影保险之二 */
  accessory: ChibiAccessory;
  accessoryColor: string;
}

export interface ChibiState {
  pose: ChibiPose;
  /** 走路两帧的哪一帧 */
  walkFrame?: 0 | 1;
  /** 1 = 朝右(默认),-1 = 朝左(整体镜像);上下移动不镜像 */
  facing?: 1 | -1;
  /** 常态眨眼(只在 idle / walk 生效) */
  blink?: boolean;
  /** 减少动态效果:步幅减半,其余工序照画 */
  reduced?: boolean;
}

// ---------------------------------------------------------------------------
// 纯函数相位
// ---------------------------------------------------------------------------

/** 走路两帧交替(step 缓动):reduced 也交替 —— 幅度在 `walkSwingPx` 里减半 */
export function walkFrameAt(tMs: number): 0 | 1 {
  return (Math.floor(Math.max(0, tMs) / WALK_FRAME_MS) % 2) as 0 | 1;
}

/** 这一帧脚往前(+)还是往后(-)摆多少 px:reduced 幅度减半 */
export function walkSwingPx(frame: 0 | 1, reduced = false): number {
  const amp = reduced ? WALK_SWING_PX / 2 : WALK_SWING_PX;
  return frame === 0 ? amp : -amp;
}

/** 发饰画法:够大画细节,缩到 4px 以下换高对比色块兜底 */
export function accessoryMode(px: number): "detail" | "block" {
  return px < ACCESSORY_MIN_PX ? "block" : "detail";
}

/** 现在该不该闭眼(3s 周期里的前 120ms;seed 错开相位) */
export function blinkOn(tMs: number, seed = 0): boolean {
  const t = (Math.max(0, tMs) + seed * 1370) % BLINK_PERIOD_MS;
  return t < BLINK_MS;
}

// ---------------------------------------------------------------------------
// 主画法
// ---------------------------------------------------------------------------

/**
 * 在 (cx, cy) 为格中心、size 为格宽的格子里画一个小人。
 * 判定格位置不归这里管 —— 调用方保证 (cx, cy) 就是格中心,这里只管把人画好看。
 */
export function drawChibi(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  spec: ChibiSpec,
  state: ChibiState
): void {
  const facing = state.facing ?? 1;
  const reduced = state.reduced === true;
  const squash = state.pose === "squat" ? SQUAT_SCALE : 1;

  // 1) 落影:蹲下时人矮了,影子稍微收一点
  softShadow(ctx, cx, cy + size * 0.36, (size * SHADOW_W_RATIO) / 2, (size * SHADOW_H_RATIO) / 2, 0.16, squash === 1 ? 1 : 0.92, "rgba(93,64,90,1)");

  ctx.save();
  ctx.translate(cx, cy);
  if (facing === -1) ctx.scale(-1, 1);
  if (squash !== 1) {
    // 关于脚底(y = 0.38·size)压扁:脚不离地,头往下缩
    ctx.translate(0, size * 0.38 * (1 - squash));
    ctx.scale(1, squash);
  }

  const headR = (size * HEAD_RATIO) / 2;
  const headY = -size * 0.1;

  // 2) 脚(先画脚再画身体,让裙摆 / 裤腿盖住脚跟)
  const frame = state.walkFrame ?? 0;
  const swing = state.pose === "walk" ? walkSwingPx(frame, reduced) * (size / 46) : 0;
  ctx.fillStyle = shade(spec.outfit, -30);
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.ellipse(side * size * 0.13 + side * swing * 0.5, size * 0.36, size * 0.09, size * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3) 身体:背带裤 —— 裙是外扩梯形,裤是直筒两腿(灰度剪影保险)
  ctx.fillStyle = spec.outfit;
  if (spec.outfitStyle === "dress") {
    ctx.beginPath();
    ctx.moveTo(-size * 0.15, size * 0.02);
    ctx.lineTo(size * 0.15, size * 0.02);
    ctx.lineTo(size * 0.24, size * 0.34);
    ctx.quadraticCurveTo(0, size * 0.42, -size * 0.24, size * 0.34);
    ctx.closePath();
    ctx.fill();
    strokeOutline(ctx, spec.outfit, 1.5);
  } else {
    ctx.beginPath();
    ctx.moveTo(-size * 0.16, size * 0.02);
    ctx.lineTo(size * 0.16, size * 0.02);
    ctx.lineTo(size * 0.16, size * 0.22);
    ctx.lineTo(size * 0.07, size * 0.22);
    ctx.lineTo(size * 0.07, size * 0.35);
    ctx.lineTo(-size * 0.07, size * 0.35);
    ctx.lineTo(-size * 0.07, size * 0.22);
    ctx.lineTo(-size * 0.16, size * 0.22);
    ctx.closePath();
    ctx.fill();
    strokeOutline(ctx, spec.outfit, 1.5);
    // 直筒裤的两腿缝再描一笔,窄屏也能看出「这是裤不是裙」
    ctx.strokeStyle = shade(spec.outfit, -20);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.22);
    ctx.lineTo(0, size * 0.35);
    ctx.stroke();
  }
  // 背带两条 + 胸前扣
  ctx.strokeStyle = shade(spec.outfit, -18);
  ctx.lineWidth = Math.max(1, size * 0.035);
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(side * size * 0.09, size * 0.02);
    ctx.lineTo(side * size * 0.09, size * 0.1);
    ctx.stroke();
  }
  ctx.fillStyle = shade(spec.outfit, 26);
  ctx.beginPath();
  ctx.arc(0, size * 0.12, size * 0.03, 0, Math.PI * 2);
  ctx.fill();

  // 4) 圆头:三停径向渐变 + 统一描边
  ctx.fillStyle = ballGradient(ctx, 0, headY, headR, spec.skin);
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  strokeOutline(ctx, spec.skin, 1.5);

  // 5) 发饰(第二道剪影保险):缩到 4px 以下换高对比色块兜底
  const accPx = size * 0.16;
  if (accessoryMode(accPx) === "block") {
    ctx.fillStyle = spec.accessoryColor;
    const bx = spec.accessory === "flower" ? -headR * 0.55 : 0;
    ctx.fillRect(bx - 2, headY - headR - 2, 4, 4);
    ctx.strokeStyle = shade(spec.accessoryColor, -45);
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 2, headY - headR - 2, 4, 4);
  } else if (spec.accessory === "flower") {
    // 五瓣花发卡:头顶偏左
    const fx = -headR * 0.55;
    const fy = headY - headR * 0.82;
    ctx.fillStyle = spec.accessoryColor;
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * accPx * 0.42, fy + Math.sin(a) * accPx * 0.42, accPx * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#FFF3C9";
    ctx.beginPath();
    ctx.arc(fx, fy, accPx * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 星形呆毛:头顶正中,细杆挑一颗五角星
    const sy = headY - headR - accPx * 0.55;
    ctx.strokeStyle = shade(spec.accessoryColor, -25);
    ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.beginPath();
    ctx.moveTo(0, headY - headR + 1);
    ctx.lineTo(0, sy + accPx * 0.3);
    ctx.stroke();
    ctx.fillStyle = spec.accessoryColor;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? accPx * 0.55 : accPx * 0.26;
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = sy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // 6) 表情三态
  const eyeY = headY - headR * 0.08;
  const eyeX = headR * 0.42;
  const ink = "#3A3357";
  if (state.pose === "trapped") {
    // 被困:圆眼 + 「哇」嘴型(困在泡泡里喊,不疼,就是着急)
    ctx.fillStyle = ink;
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.arc(side * eyeX, eyeY, headR * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#B26060";
    ctx.beginPath();
    ctx.ellipse(0, headY + headR * 0.42, headR * 0.2, headR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (state.pose === "squat") {
    // 埋弹:闭目使劲 + 鼓腮
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, headR * 0.12);
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(side * eyeX - headR * 0.12, eyeY);
      ctx.lineTo(side * eyeX + headR * 0.12, eyeY);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(244,133,159,.4)";
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.arc(side * headR * 0.62, headY + headR * 0.34, headR * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // 常态 / 走路:圆眼(眨眼时是横线)+ 微笑 + 腮红
    if (state.blink === true) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(1, headR * 0.1);
      for (const side of [-1, 1] as const) {
        ctx.beginPath();
        ctx.moveTo(side * eyeX - headR * 0.12, eyeY);
        ctx.lineTo(side * eyeX + headR * 0.12, eyeY);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = ink;
      for (const side of [-1, 1] as const) {
        ctx.beginPath();
        ctx.arc(side * eyeX, eyeY, headR * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffffff";
      for (const side of [-1, 1] as const) {
        ctx.beginPath();
        ctx.arc(side * eyeX - headR * 0.04, eyeY - headR * 0.04, headR * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, headR * 0.09);
    ctx.beginPath();
    ctx.arc(0, headY + headR * 0.22, headR * 0.24, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = "rgba(244,133,159,.28)";
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.arc(side * headR * 0.6, headY + headR * 0.3, headR * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
