/**
 * 雪球大作战 1.3 · 绘制工序(第 15 步 B 档,纯画笔函数,零 DOM、零状态)。
 *
 * 所有函数只拿传进来的 2d 画笔与几何参数画画,不读 Arena、不写任何玩法字段。
 * 渐变 / 描边 / 落影统一走 `src/art/kit/`(只 import 不改);
 * 光源统一左上 45°,雪地阴影一律冷蓝 `rgba(120,150,200,.18)`,不许黑影。
 */
import { ballGradient, softShadow } from "../../art/kit/volume";
import { strokeOutline } from "../../art/kit/outline";
import { shade, withAlpha } from "../../art/kit/palette";
import {
  CHARGE_FULL_AT,
  HAT_BODY_SHADE,
  HAT_CROUCH_DROP,
  FIGHTER_SHADOW_RX,
  FIGHTER_SHADOW_RY,
  RELEASE_LEAN_DEG,
  SCARF_SWING_DEG,
  SNF_PALETTE,
  SNF_SHADOW_ALPHA,
  SNF_SHADOW_RGB,
  SNOWFOE_BODY_STOPS,
  SNOWFOE_HAT,
  WINDUP_ARM_DEG,
  chargeBallRadius,
  landingStyle,
  type ThrowPhase,
} from "./visual13";

const P = SNF_PALETTE;

/** 两队主色(帽子 / 围巾 / 手套):0 = 朵朵粉,1 = 星星蓝 */
export function teamColor(seat: number): string {
  return seat === 0 ? P.sfPink : P.sfBlue;
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function roundRectPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

// ---------------------------------------------------------------------------
// 一、场景:松树两层视差 + 雪丘高光斑
// ---------------------------------------------------------------------------

/** 一排松树剪影:三层塔形 + 顶上一撮雪。offset 是视差滚动量(px) */
export function paintPineRow(
  c: CanvasRenderingContext2D,
  w: number,
  baseY: number,
  treeH: number,
  color: string,
  spacing: number,
  offset: number
): void {
  c.fillStyle = color;
  const span = Math.max(40, spacing);
  const start = -((offset % span) + span) % span;
  for (let x = start; x <= w + span; x += span) {
    for (let k = 0; k < 3; k++) {
      const y = baseY - (treeH * k) / 3.4;
      const half = (treeH * (3 - k)) / 9;
      c.beginPath();
      c.moveTo(x, y - treeH / 2.6);
      c.lineTo(x - half, y);
      c.lineTo(x + half, y);
      c.closePath();
      c.fill();
    }
    // 顶上一撮雪:让剪影不至于是一团纯色
    c.fillStyle = withAlpha(P.sfSnowLit, 0.85);
    c.beginPath();
    c.moveTo(x, baseY - treeH * 0.97);
    c.lineTo(x - treeH * 0.07, baseY - treeH * 0.82);
    c.lineTo(x + treeH * 0.07, baseY - treeH * 0.82);
    c.closePath();
    c.fill();
    c.fillStyle = color;
  }
}

/** 雪丘高光斑:seed 固定的确定性位置,画在雪地那条带上 */
export function paintSnowMounds(c: CanvasRenderingContext2D, w: number, groundY: number, pad: number): void {
  c.fillStyle = withAlpha(P.sfSnowLit, 0.55);
  for (let i = 0; i < 7; i++) {
    const x = ((i * 149.3 + 37) % (w + 40)) - 20;
    const rx = 10 + (i % 3) * 7;
    c.beginPath();
    c.ellipse(x, groundY + pad * (0.3 + (i % 2) * 0.25), rx, Math.max(1.6, pad * 0.14), 0, 0, Math.PI * 2);
    c.fill();
  }
  // 地平线下缘一条冷蓝阴影,雪层才有厚度
  c.fillStyle = P.sfShadow;
  c.fillRect(0, groundY + pad - 2, w, 2);
}

// ---------------------------------------------------------------------------
// 二、角色七道工序
// ---------------------------------------------------------------------------

export interface FighterPose {
  /** 画布坐标:脚下中心 */
  x: number;
  base: number;
  /** 站立时的画半径(px,判定不动) */
  full: number;
  /** 此刻的画半径(蹲下已按 CROUCH_SCALE 折过) */
  r: number;
  dir: 1 | -1;
  seat: 0 | 1;
  crouch: boolean;
  /** 暖手休息中(整体画灰) */
  warming: boolean;
  phase: ThrowPhase;
  /** 蓄力读数 0..1 */
  chargeK: number;
  /** 围巾甩动 0..1(reduced 恒 0) */
  swing: number;
  /** 动画钟(reduced 恒 0) */
  time: number;
  /** 刚命中对方,眨单眼 */
  wink: boolean;
}

/** 第 1 道工序:冷蓝椭圆落影(0.8×full、0.22×full) */
export function paintFighterShadow(c: CanvasRenderingContext2D, x: number, base: number, full: number): void {
  softShadow(c, x, base, full * FIGHTER_SHADOW_RX, full * FIGHTER_SHADOW_RY, SNF_SHADOW_ALPHA, 1, SNF_SHADOW_RGB);
}

/** 第 7 道工序:站位压痕环(雪面浅凹陷 + 边缘亮线,呼吸沿用原正弦参数) */
export function paintStanceRing(
  c: CanvasRenderingContext2D,
  x: number,
  base: number,
  r: number,
  seat: number,
  time: number
): void {
  // 原黄椭圆的呼吸参数原样保留:alpha = 0.2 + sin(time*3 + seat) * 0.08
  const breath = 0.2 + Math.sin(time * 3 + seat) * 0.08;
  c.fillStyle = withAlpha("#7896C8", breath);
  c.beginPath();
  c.ellipse(x, base - r * 0.2, r * 1.8, r * 0.5, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = withAlpha(P.sfSnowLit, 0.9);
  c.lineWidth = 1.2;
  c.beginPath();
  c.ellipse(x, base - r * 0.24, r * 1.7, r * 0.44, 0, Math.PI * 1.05, Math.PI * 1.95);
  c.stroke();
}

/** 身体此刻前倾 / 后仰几度(读三帧相位,正数 = 朝出手方向倾) */
export function bodyLeanDeg(phase: ThrowPhase, chargeK: number): number {
  if (phase === "windup") return -6 * chargeK;
  if (phase === "release") return RELEASE_LEAN_DEG;
  if (phase === "recover") return RELEASE_LEAN_DEG * 0.35;
  return 0;
}

/** 投掷臂此刻抬到哪个角(度,0 = 垂放,负 = 后摆,正 = 前挥) */
export function throwArmDeg(phase: ThrowPhase, chargeK: number): number {
  if (phase === "windup") return -WINDUP_ARM_DEG * chargeK;
  if (phase === "release") return 58;
  if (phase === "recover") return 24;
  return 0;
}

/**
 * 第 2–6 道工序:主体三停渐变、针织帽、围巾两段、连指手套三帧、表情。
 * 全部画在以脚下为原点的局部坐标里,身体倾角用一次 rotate 统一交代。
 */
export function paintFighterBody(c: CanvasRenderingContext2D, pose: FighterPose): void {
  const { r, dir, seat, crouch, warming, phase, chargeK, swing, time, wink } = pose;
  const color = warming ? "#cfd9e8" : teamColor(seat);
  const yarn = shade(color, -12);
  c.save();
  c.translate(pose.x, pose.base);
  c.rotate(rad(bodyLeanDeg(phase, chargeK)) * dir);

  // ② 主体:裹成球的小孩,full/蹲下半径与 1.2 同一条公式(判定不动)
  c.fillStyle = ballGradient(c, 0, -r, r, color);
  c.beginPath();
  c.arc(0, -r, r, 0, Math.PI * 2);
  c.fill();
  strokeOutline(c, color, 1.6);

  // 肚兜高光:左上 45° 受光的一小片
  c.fillStyle = withAlpha(P.sfSnowLit, 0.32);
  c.beginPath();
  c.ellipse(-r * 0.34, -r * 1.34, r * 0.34, r * 0.22, rad(-38), 0, Math.PI * 2);
  c.fill();

  // ⑤ 后手先画(压在身体后面):常态垂放
  const backAng = rad(150 + (phase === "windup" ? -14 * chargeK : 0));
  paintMitten(c, dir === 1 ? -1 : 1, r, backAng, color);

  // ④ 围巾:脖圈 + 两段飘带(出手时向出手反方向甩 SCARF_SWING_DEG)
  paintScarf(c, r, dir, seat, yarn, swing, time);

  // ③ 针织帽:阵营色帽体 + 白绒边 + 顶球,下蹲压低两成,两队帽形不同
  paintHat(c, r, seat, crouch ? HAT_CROUCH_DROP : 0, color);

  // ⑥ 表情:常态眨眼、蓄力抿嘴、命中对方眨单眼
  paintFace(c, r, dir, phase, time, wink, crouch);

  // ⑤ 前手(投掷臂):三帧相位 —— 后摆 30° → 前倾出手 → 收势回位
  const frontAng = rad(-90 + throwArmDeg(phase, chargeK) * 1.6) * 1;
  paintMitten(c, dir, r, frontAng, color);
  c.restore();
}

/** 一只连指手套:从肩点伸出一小截手臂,末端一只圆手套 */
function paintMitten(c: CanvasRenderingContext2D, side: 1 | -1, r: number, ang: number, color: string): void {
  const sx = side * r * 0.62;
  const sy = -r * 1.06;
  const len = r * 0.55;
  const hx = sx + Math.cos(ang) * len * side;
  const hy = sy - Math.sin(ang) * len;
  c.strokeStyle = shade(color, -18);
  c.lineWidth = Math.max(2, r * 0.24);
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(sx, sy);
  c.lineTo(hx, hy);
  c.stroke();
  c.lineCap = "butt";
  c.fillStyle = shade(color, 18);
  c.beginPath();
  c.arc(hx, hy, Math.max(2, r * 0.24), 0, Math.PI * 2);
  c.fill();
  strokeOutline(c, color, 1.5);
}

/** 围巾:脖圈 + 两段飘带。结的位置两队不同(灰度下也分得清) */
function paintScarf(
  c: CanvasRenderingContext2D,
  r: number,
  dir: 1 | -1,
  seat: 0 | 1,
  yarn: string,
  swing: number,
  time: number
): void {
  const neckY = -r * 1.18;
  c.fillStyle = yarn;
  roundRectPath(c, -r * 0.68, neckY - r * 0.14, r * 1.36, r * 0.3, r * 0.14);
  c.fill();
  // 结:朵朵在面朝一侧,星星在背侧 —— 形状通道,不只靠颜色
  const knotSide = seat === 0 ? dir : -dir;
  c.beginPath();
  c.arc(knotSide * r * 0.6, neckY + r * 0.05, r * 0.16, 0, Math.PI * 2);
  c.fill();
  // 两段飘带:静止微垂,出手时向出手反方向甩(swing 0..1)
  const sway = Math.sin(time * 1.6 + seat) * 0.08;
  const lift = rad(SCARF_SWING_DEG) * swing;
  c.strokeStyle = yarn;
  c.lineWidth = Math.max(2, r * 0.2);
  c.lineCap = "round";
  for (const [seg, len] of [
    [0, r * 0.72],
    [0.5, r * 0.5],
  ] as Array<[number, number]>) {
    const a = Math.PI / 2 + sway + seg * 0.5 - lift * (1 - seg * 0.4);
    const bx = knotSide * r * 0.6 - Math.cos(a) * len * dir;
    const by = neckY + r * 0.08 + Math.sin(a) * len;
    c.beginPath();
    c.moveTo(knotSide * r * 0.6, neckY + r * 0.05);
    c.quadraticCurveTo(
      knotSide * r * 0.6 - (Math.cos(a) * len * dir) / 2 - dir * r * 0.1,
      neckY + (Math.sin(a) * len) / 2,
      bx,
      by
    );
    c.stroke();
  }
  c.lineCap = "butt";
}

/** 针织帽:seat 0 圆顶绒线帽,seat 1 尖顶睡帽(帽形是第二条辨认通道;帽体色深浅是第三条) */
function paintHat(c: CanvasRenderingContext2D, r: number, seat: 0 | 1, drop: number, color: string): void {
  const top = -r * 2;
  const y = top + r * drop;
  c.fillStyle = shade(color, HAT_BODY_SHADE[seat] ?? -6);
  if (seat === 0) {
    c.beginPath();
    c.arc(0, y + r * 0.28, r * 0.66, Math.PI, Math.PI * 2);
    c.closePath();
    c.fill();
  } else {
    c.beginPath();
    c.moveTo(-r * 0.62, y + r * 0.3);
    c.lineTo(r * 0.62, y + r * 0.3);
    c.lineTo(r * 0.16, y - r * 0.52);
    c.closePath();
    c.fill();
  }
  strokeOutline(c, color, 1.5);
  // 白绒边
  c.fillStyle = P.sfSnowLit;
  roundRectPath(c, -r * 0.7, y + r * 0.18, r * 1.4, r * 0.22, r * 0.11);
  c.fill();
  // 顶球
  c.beginPath();
  c.arc(seat === 0 ? 0 : r * 0.16, seat === 0 ? y - r * 0.38 : y - r * 0.56, r * 0.17, 0, Math.PI * 2);
  c.fill();
}

/** 表情:眼睛(会眨)、腮红、嘴(常态微笑 / 蓄力抿嘴 / 命中眨单眼) */
function paintFace(
  c: CanvasRenderingContext2D,
  r: number,
  dir: 1 | -1,
  phase: ThrowPhase,
  time: number,
  wink: boolean,
  crouch: boolean
): void {
  const fy = -r * (crouch ? 1.42 : 1.5);
  const fx = dir * r * 0.18;
  // 常态眨眼:3.2 秒一轮,只在最后 0.18 秒闭上(帧计数用例不受影响)
  const cycle = time % 3.2;
  const blink = cycle > 3.02 ? 0.15 : 1;
  c.fillStyle = "#4C5878";
  for (const side of [-1, 1] as const) {
    const shut = wink && side === dir ? 0.12 : blink;
    c.beginPath();
    c.ellipse(fx + side * r * 0.22, fy, r * 0.075, r * 0.075 * shut + 0.6, 0, 0, Math.PI * 2);
    c.fill();
  }
  // 腮红
  c.fillStyle = withAlpha("#F4859F", 0.4);
  for (const side of [-1, 1] as const) {
    c.beginPath();
    c.ellipse(fx + side * r * 0.4, fy + r * 0.22, r * 0.1, r * 0.06, 0, 0, Math.PI * 2);
    c.fill();
  }
  // 嘴
  c.strokeStyle = "#4C5878";
  c.lineWidth = Math.max(1, r * 0.06);
  c.beginPath();
  if (phase === "windup") {
    c.moveTo(fx - r * 0.1, fy + r * 0.26);
    c.lineTo(fx + r * 0.1, fy + r * 0.26);
  } else {
    c.arc(fx, fy + r * 0.18, r * 0.14, Math.PI * 0.15, Math.PI * 0.85);
  }
  c.stroke();
}

// ---------------------------------------------------------------------------
// 三、雪人惩罚态:三件套 + 融化高光
// ---------------------------------------------------------------------------

/**
 * 变雪人:两球叠放 + 胡萝卜鼻 + 树枝手 + 三粒纽扣 + 笑脸。
 * meltK 是融化高光爬到多高(0 = 脚,1 = 头,读 `meltRise(freezeRatio)`,不改时长)。
 */
export function paintSnowman(
  c: CanvasRenderingContext2D,
  x: number,
  base: number,
  full: number,
  meltK: number,
  time: number
): void {
  paintFighterShadow(c, x, base, full);
  // 两个雪球:三停渐变的白,左上受光
  for (const [cy, r] of [
    [base - full * 0.8, full * 0.85],
    [base - full * 2, full * 0.6],
  ] as Array<[number, number]>) {
    c.fillStyle = ballGradient(c, x, cy, r, P.sfSnow, { light: 4, dark: -9 });
    c.beginPath();
    c.arc(x, cy, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = withAlpha("#7896C8", 0.55);
    c.lineWidth = 1.4;
    c.stroke();
  }
  // 树枝手:两侧折线(带一根小叉)
  c.strokeStyle = "#A87B4F";
  c.lineWidth = Math.max(1.4, full * 0.1);
  c.lineCap = "round";
  for (const side of [-1, 1] as const) {
    const sx = x + side * full * 0.78;
    const sy = base - full * 1.05;
    const ex = x + side * full * 1.5;
    const ey = base - full * 1.7;
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(ex, ey);
    c.moveTo(x + side * full * 1.2, base - full * 1.43);
    c.lineTo(x + side * full * 1.42, base - full * 1.28);
    c.stroke();
  }
  c.lineCap = "butt";
  // 三粒纽扣
  c.fillStyle = "#5B6885";
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.arc(x, base - full * (0.55 + i * 0.32), Math.max(1.2, full * 0.09), 0, Math.PI * 2);
    c.fill();
  }
  // 笑脸:点点眼 + 上弯嘴 —— 变雪人是喜感,不是惊吓
  c.fillStyle = "#4C5878";
  for (const side of [-1, 1] as const) {
    c.beginPath();
    c.arc(x + side * full * 0.22, base - full * 2.12, Math.max(1, full * 0.08), 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = "#4C5878";
  c.lineWidth = Math.max(1, full * 0.06);
  c.beginPath();
  c.arc(x, base - full * 1.98, full * 0.2, Math.PI * 0.2, Math.PI * 0.8);
  c.stroke();
  // 胡萝卜鼻:橙三角(sfCarrot)
  c.fillStyle = P.sfCarrot;
  c.beginPath();
  c.moveTo(x, base - full * 2.06);
  c.lineTo(x + full * 0.75, base - full * 1.98);
  c.lineTo(x, base - full * 1.9);
  c.closePath();
  c.fill();
  // 融化高光:一条亮带从脚往头爬(功能提示,reduced 也保留)
  const hy = base - meltK * full * 2.6;
  c.fillStyle = withAlpha(P.sfSnowLit, 0.65);
  c.beginPath();
  c.ellipse(x, hy, full * 0.95, Math.max(1.6, full * 0.16), 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = withAlpha("#BFE3FF", 0.5);
  c.beginPath();
  c.ellipse(x, hy, full * 0.6, Math.max(1, full * 0.09), 0, 0, Math.PI * 2);
  c.fill();
  // 头顶小水珠:快解冻时(爬过肩膀)钻出一颗,提示「马上能动」
  if (meltK > 0.72) {
    c.fillStyle = withAlpha("#9CCBFF", 0.85);
    c.beginPath();
    c.arc(x + full * 0.4, base - full * 2.6 - Math.sin(time * 5) * 1.5, Math.max(1, full * 0.09), 0, Math.PI * 2);
    c.fill();
  }
}

/**
 * 无尽模式雪怪(修复员 S5):双雪球三停渐变 + 冷蓝底影 + 歪戴深青毛线帽 +
 * 竖椭圆眼白高光。两颗球的圆心 / 半径与 1.2 完全同位
 * (身球 y+0.5r · 0.95r,头球 y-0.55r · 0.68r),行为、判定半径一个数不动;
 * 纯静态件,reduced 无需分支。帽子是第三帽形,与两队圆绒帽 / 尖睡帽都分得开。
 */
export function paintSnowFoe(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  // 底影:冷蓝椭圆(禁黑影)
  softShadow(c, x, y + r * 1.42, r * 0.95, r * 0.2, SNF_SHADOW_ALPHA, 1, SNF_SHADOW_RGB);
  // 双球:高光 (-0.35r, -0.35r) 白 → 本体雪白 → 底部冷蓝
  for (const [cy, rr] of [
    [y + r * 0.5, r * 0.95],
    [y - r * 0.55, r * 0.68],
  ] as Array<[number, number]>) {
    const grad = c.createRadialGradient(x - rr * 0.35, cy - rr * 0.35, rr * 0.12, x, cy, rr);
    grad.addColorStop(0, SNOWFOE_BODY_STOPS[0]);
    grad.addColorStop(0.55, SNOWFOE_BODY_STOPS[1]);
    grad.addColorStop(1, SNOWFOE_BODY_STOPS[2]);
    c.fillStyle = grad;
    c.beginPath();
    c.arc(x, cy, rr, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(150,185,220,.85)";
    c.lineWidth = 1.5;
    c.stroke();
  }
  // 身球下缘再压一抹冷蓝,体积立起来
  c.fillStyle = P.sfShadow;
  c.beginPath();
  c.ellipse(x, y + r * 1.05, r * 0.6, r * 0.22, 0, 0, Math.PI * 2);
  c.fill();
  // 识别件:歪戴的深青毛线帽(帽体 2 停 + 白绒边 + 侧绒球)
  const hy = y - r * 0.55;
  c.save();
  c.translate(x, hy);
  c.rotate(-0.24);
  const hat = c.createLinearGradient(0, -r * 0.95, 0, -r * 0.3);
  hat.addColorStop(0, shade(SNOWFOE_HAT, 14));
  hat.addColorStop(1, SNOWFOE_HAT);
  c.fillStyle = hat;
  c.beginPath();
  c.arc(0, -r * 0.38, r * 0.52, Math.PI, Math.PI * 2);
  c.closePath();
  c.fill();
  strokeOutline(c, SNOWFOE_HAT, 1.5);
  c.fillStyle = P.sfSnowLit;
  roundRectPath(c, -r * 0.56, -r * 0.48, r * 1.12, r * 0.18, r * 0.09);
  c.fill();
  c.beginPath();
  c.arc(r * 0.34, -r * 0.92, r * 0.14, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // 眼睛:竖椭圆 + 白高光点(从「两点眼」升级)
  c.fillStyle = "#5B6885";
  for (const side of [-1, 1] as const) {
    c.beginPath();
    c.ellipse(x + side * r * 0.25, y - r * 0.6, Math.max(1, r * 0.09), Math.max(1.4, r * 0.14), 0, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "rgba(255,255,255,.9)";
  for (const side of [-1, 1] as const) {
    c.beginPath();
    c.arc(x + side * r * 0.25 - r * 0.03, y - r * 0.64, Math.max(0.6, r * 0.035), 0, Math.PI * 2);
    c.fill();
  }
  // 嘴保持小弧
  c.fillStyle = "#F0A2B8";
  c.beginPath();
  c.arc(x, y - r * 0.32, Math.max(1, r * 0.14), 0, Math.PI);
  c.fill();
}

// ---------------------------------------------------------------------------
// 四、雪球与落点
// ---------------------------------------------------------------------------

/**
 * 飞行中的雪球:三停径向渐变 + 底部冷阴影 + 两道滚纹(相位随飞行距离)。
 * rollPhase 传 `ballRollPhase(spin×age, reduced)`——reduced 静止纹。
 */
export function paintSnowball(c: CanvasRenderingContext2D, x: number, y: number, r: number, rollPhase: number): void {
  c.fillStyle = ballGradient(c, x, y, r, P.sfSnowLit, { light: 0, dark: -10 });
  c.strokeStyle = withAlpha("#7896C8", 0.9);
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // 底部冷阴影:球身下缘一弯冷蓝
  c.fillStyle = P.sfShadow;
  c.beginPath();
  c.ellipse(x, y + r * 0.55, r * 0.66, r * 0.26, 0, 0, Math.PI * 2);
  c.fill();
  // 两道滚纹:绕球心转,相位差 1.3
  c.strokeStyle = withAlpha("#96B4D8", 0.8);
  c.lineWidth = 1;
  for (const off of [0, 1.3]) {
    c.beginPath();
    c.ellipse(x, y, r * 0.72, Math.max(0.4, r * 0.72 * Math.abs(Math.cos(rollPhase + off))), 0, 0, Math.PI * 2);
    c.stroke();
  }
}

/**
 * 落点提示:雪面凹陷椭圆 + 原样的功能虚线圈。
 * 半径 / 圆心 / 透明度 / 虚线节奏与 1.2 完全一致(landingStyle 对过账)。
 */
export function paintLanding(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  hot: boolean,
  blur: number
): void {
  const st = landingStyle(hot, blur);
  c.save();
  // 雪面凹陷:冷蓝浅坑 + 下缘亮边(远近感不靠黑影)
  c.fillStyle = withAlpha("#7896C8", st.alpha * 0.3);
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = withAlpha(P.sfSnowLit, st.alpha * 0.9);
  c.lineWidth = 1.2;
  c.beginPath();
  c.ellipse(cx, cy + ry * 0.18, rx * 0.86, ry * 0.72, 0, Math.PI * 0.1, Math.PI * 0.9);
  c.stroke();
  // 功能虚线圈:原公式原节奏(它是承诺,真实落点一定在圈里)
  c.setLineDash(st.dash);
  c.lineWidth = st.width;
  c.strokeStyle = `rgba(232,85,143,${st.alpha})`;
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
  c.restore();
}

// ---------------------------------------------------------------------------
// 五、掩体与雪堡
// ---------------------------------------------------------------------------

export interface CoverBoxPx {
  x: number;
  w: number;
  top: number;
  bottom: number;
}

/** 堆雪墙:顶部圆鼓 + 侧面冷蓝阴影 + 按既有 hp 画三阶段耗损缺口 */
export function paintSnowWall(c: CanvasRenderingContext2D, box: CoverBoxPx, hp: number, maxHp: number): void {
  const { x, w, top, bottom } = box;
  const worn = hp / Math.max(1, maxHp);
  // 三阶段主色(阈值与 1.2 相同:>0.66 / >0.33 / 其余)
  const bodyColor = worn > 0.66 ? P.sfSnowLit : worn > 0.33 ? P.sfFort : "#DCE9F8";
  c.fillStyle = bodyColor;
  roundRectPath(c, x, top + 2, w, bottom - top - 2, Math.min(w / 2, 5));
  c.fill();
  // 顶部圆鼓:三个雪包
  const lump = w / 3;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.arc(x + lump * (i + 0.5), top + 2.5, lump * 0.62, Math.PI, Math.PI * 2);
    c.fill();
  }
  // 侧面冷蓝阴影(背光面在右下)
  c.fillStyle = P.sfShadow;
  c.fillRect(x + w * 0.78, top + 3, w * 0.22, Math.max(0, bottom - top - 4));
  c.strokeStyle = withAlpha("#7896C8", 0.75);
  c.lineWidth = 1.5;
  roundRectPath(c, x, top + 2, w, bottom - top - 2, Math.min(w / 2, 5));
  c.stroke();
  // 耗损缺口:每掉一层顶上啃掉一口 + 一道裂纹(读既有 hp,不回写)
  const bites = Math.max(0, maxHp - hp);
  for (let i = 0; i < bites; i++) {
    const bx = x + w * (0.25 + i * 0.28);
    c.fillStyle = withAlpha("#7896C8", 0.28);
    c.beginPath();
    c.arc(bx, top + 2, Math.max(2, w * 0.1), 0, Math.PI);
    c.fill();
    c.strokeStyle = withAlpha("#7896C8", 0.6);
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(bx, top + 4);
    c.lineTo(bx + (i % 2 === 0 ? 3 : -3), top + (bottom - top) * 0.5);
    c.stroke();
  }
}

/** 木箱:木色 + 两道板缝 + 顶上一层积雪 */
export function paintCrate(c: CanvasRenderingContext2D, box: CoverBoxPx): void {
  const { x, w, top, bottom } = box;
  c.fillStyle = "#E6CFA8";
  roundRectPath(c, x, top, w, bottom - top, 3);
  c.fill();
  strokeOutline(c, "#E6CFA8", 1.6);
  c.strokeStyle = withAlpha("#A87B4F", 0.7);
  c.lineWidth = 1.1;
  for (const k of [0.38, 0.68]) {
    c.beginPath();
    c.moveTo(x + 2, top + (bottom - top) * k);
    c.lineTo(x + w - 2, top + (bottom - top) * k);
    c.stroke();
  }
  c.fillStyle = P.sfSnowLit;
  c.beginPath();
  c.ellipse(x + w / 2, top + 1, w * 0.52, Math.max(1.6, (bottom - top) * 0.1), 0, 0, Math.PI * 2);
  c.fill();
}

/** 雪坡:白坡面 + 坡脚冷蓝影 + 坡顶雪檐(不再用 emoji) */
export function paintSlope(c: CanvasRenderingContext2D, box: CoverBoxPx): void {
  const { x, w, top, bottom } = box;
  c.fillStyle = P.sfSnowLit;
  c.beginPath();
  c.moveTo(x, bottom);
  c.lineTo(x + w, top);
  c.lineTo(x + w, bottom);
  c.closePath();
  c.fill();
  c.strokeStyle = withAlpha("#7896C8", 0.8);
  c.lineWidth = 1.4;
  c.stroke();
  // 坡脚冷蓝影
  c.fillStyle = P.sfShadow;
  c.beginPath();
  c.moveTo(x, bottom);
  c.lineTo(x + w * 0.5, bottom - (bottom - top) * 0.28);
  c.lineTo(x + w * 0.6, bottom);
  c.closePath();
  c.fill();
  // 坡顶雪檐:一小卷
  c.fillStyle = P.sfSnowLit;
  c.beginPath();
  c.arc(x + w - 2, top + 2, 3, 0, Math.PI * 2);
  c.fill();
}

/** 雪堡:堆雪墙主色的城头(两垛口 + 小旗),替掉 🏰 emoji */
export function paintFortKeep(c: CanvasRenderingContext2D, cx: number, base: number, s: number): void {
  const w = Math.max(16, s * 2.2);
  const h = Math.max(12, s * 1.6);
  c.fillStyle = P.sfFort;
  roundRectPath(c, cx - w / 2, base - h, w, h, 3);
  c.fill();
  c.strokeStyle = withAlpha("#7896C8", 0.7);
  c.lineWidth = 1.3;
  roundRectPath(c, cx - w / 2, base - h, w, h, 3);
  c.stroke();
  // 两垛口
  c.fillStyle = P.sfFort;
  for (const side of [-1, 1] as const) {
    roundRectPath(c, cx + side * w * 0.3 - w * 0.12, base - h - h * 0.3, w * 0.24, h * 0.34, 2);
    c.fill();
  }
  // 小旗
  c.strokeStyle = "#A87B4F";
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(cx, base - h);
  c.lineTo(cx, base - h - h * 0.6);
  c.stroke();
  c.fillStyle = P.sfPink;
  c.beginPath();
  c.moveTo(cx, base - h - h * 0.6);
  c.lineTo(cx + w * 0.28, base - h - h * 0.46);
  c.lineTo(cx, base - h - h * 0.32);
  c.closePath();
  c.fill();
}

// ---------------------------------------------------------------------------
// 六、功能件换皮(数值映射一个点都不动)
// ---------------------------------------------------------------------------

/**
 * 蓄力读数图形化:雪球从小滚大。
 * k 必须是 `chargeReadout`(= chargeRatio)的读数;满档阈值与旧蓄力条同为 0.92。
 */
export function paintChargeSnowball(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  k: number,
  seat: number
): void {
  // 雪道:半透明白槽(和旧底条同款底色)
  c.fillStyle = "rgba(255,255,255,.88)";
  roundRectPath(c, x, y + 2, w, 6, 3);
  c.fill();
  // 三格刻度:轻轻提示滚到几成
  c.fillStyle = withAlpha("#7896C8", 0.4);
  for (const t of [0.25, 0.5, 0.75]) {
    c.fillRect(x + w * t, y + 2, 1, 6);
  }
  const maxR = chargeBallRadius(1);
  const r = chargeBallRadius(k);
  const bx = x + maxR + (w - maxR * 2) * Math.max(0, Math.min(1, k));
  const by = y + 5 - r * 0.4;
  // 雪球本体:三停渐变,满档换成粉描边(阈值 0.92 与旧条一致)
  c.fillStyle = ballGradient(c, bx, by, r, P.sfSnowLit, { light: 0, dark: -10 });
  c.beginPath();
  c.arc(bx, by, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = k > CHARGE_FULL_AT ? "#E8558F" : seat === 0 ? "#F08AA8" : "#5B8EC4";
  c.lineWidth = k > CHARGE_FULL_AT ? 2.2 : 1.4;
  c.stroke();
}

/**
 * 风旗:旗杆 + 波浪两帧的旗面 + 描边箭头。
 * 箭头长度 `flagLen`、出现阈值 |wind| ≥ 0.25、文字 `windWord` 全部沿用旧映射。
 */
export function paintWindFlag(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  wind: number,
  ink: string,
  frame: 0 | 1,
  len: number,
  word: string,
  fontPx: number
): void {
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `700 ${fontPx}px system-ui`;
  c.fillStyle = ink;
  c.fillText(word, cx, cy);
  const calm = Math.abs(wind) < 0.25;
  const dir = wind >= 0 ? 1 : -1;
  // 旗杆 + 旗面:无风垂着,有风朝风向飘,波浪两帧交替
  const px = cx - dir * (len / 2 + 10);
  c.strokeStyle = ink;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(px, cy + 6);
  c.lineTo(px, cy + 20);
  c.stroke();
  c.fillStyle = withAlpha("#F4859F", 0.9);
  c.beginPath();
  if (calm) {
    c.moveTo(px, cy + 7);
    c.lineTo(px + 7, cy + 9);
    c.lineTo(px + 1.5, cy + 13);
  } else {
    const wave = frame === 0 ? -1.6 : 1.6;
    c.moveTo(px, cy + 7);
    c.quadraticCurveTo(px + dir * 7, cy + 8 + wave, px + dir * 14, cy + 8);
    c.lineTo(px + dir * 13, cy + 12);
    c.quadraticCurveTo(px + dir * 7, cy + 12 - wave, px, cy + 13);
  }
  c.closePath();
  c.fill();
  if (calm) return;
  // 箭头:先描边(深 20%)再画本体,长度公式一个字没改
  for (const pass of [0, 1] as const) {
    c.strokeStyle = pass === 0 ? withAlpha("#3A4E74", 0.5) : ink;
    c.lineWidth = pass === 0 ? 4 : 2;
    c.beginPath();
    c.moveTo(cx - (len / 2) * dir, cy + 14);
    c.lineTo(cx + (len / 2) * dir, cy + 14);
    c.lineTo(cx + (len / 2 - 6) * dir, cy + 10);
    c.moveTo(cx + (len / 2) * dir, cy + 14);
    c.lineTo(cx + (len / 2 - 6) * dir, cy + 18);
    c.stroke();
  }
}

/** 准星:主线 + 渐隐点阵(从手到端点越来越淡),几何与 1.2 完全一致 */
export function paintAimArrow(
  c: CanvasRenderingContext2D,
  hx: number,
  hy: number,
  ex: number,
  ey: number,
  color: string
): void {
  c.strokeStyle = color;
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(hx, hy);
  c.lineTo(ex, ey);
  c.stroke();
  // 渐隐点阵:5 颗小点,越靠端点越淡
  const alpha = c.globalAlpha;
  for (let i = 1; i <= 5; i++) {
    const k = i / 5;
    c.globalAlpha = alpha * (1 - k * 0.65);
    c.fillStyle = color;
    c.beginPath();
    c.arc(hx + (ex - hx) * k, hy + (ey - hy) * k, 1.6 + (1 - k) * 0.8, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.beginPath();
  c.arc(ex, ey, 3, 0, Math.PI * 2);
  c.fill();
}
