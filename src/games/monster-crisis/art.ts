/**
 * 小怪物危机 1.3 · 画笔集中营:全部程序化矢量绘制,一张外部图片都不用。
 *
 * 1.2 定下的形状语言原样保留 —— 五种行为五种外形、精英盾弧、上色进度条、
 * 「影子 + y 排序 = 俯视图唯一的立体」;本文件只负责把「平涂 + 描边」升级成
 * 「渐变 + 高光 + 材质」,并把 ☁️ emoji 粒子换成手绘蓬蓬云。
 * 玩法数值(windup/reach 语义、盾判定角度、波次与罐子规则)一个都不碰。
 *
 * 「上色不是打死」:小怪物被涂满是开开心心变彩色离场(drawFarewell),
 * 所有演出都往这个口径靠。
 */
import {
  ARENA_H,
  ARENA_W,
  HERO_R,
  HOME_R,
  type ArenaBullet,
  type ArenaMonster,
  type ArenaParticle,
} from "./arena";
import { MONSTER_COLOR } from "./logic";

const TAU = Math.PI * 2;

/** 颜料罐里的五色粉彩:溅点、彩虹条、离场颜料花共用这一盘。 */
export const PAINTS = ["#ff9ec4", "#ffd66b", "#9be0b9", "#9fc8ff", "#cfa6ff"] as const;

/* ------------------------------------------------------------------ */
/* 基础小工具                                                          */
/* ------------------------------------------------------------------ */

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return `rgb(${r},${g},${b})`;
}

export function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** 径向渐变:左上亮一块,圆滚滚的体积感(平涂退休)。 */
export function bodyGrad(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): CanvasGradient {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.12, x, y, r * 1.15);
  g.addColorStop(0, shade(color, 1.18));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shade(color, 0.88));
  return g;
}

/** 内凹边四芒星:眩晕星、帽徽、离场颜料花共用。 */
export function drawSparkStar(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x + r * 0.18, y - r * 0.18, x + r, y);
  c.quadraticCurveTo(x + r * 0.18, y + r * 0.18, x, y + r);
  c.quadraticCurveTo(x - r * 0.18, y + r * 0.18, x - r, y);
  c.quadraticCurveTo(x - r * 0.18, y - r * 0.18, x, y - r);
  c.closePath();
  c.fill();
}

/** 两只圆眼睛 + 一张笑嘴:全员卡通,凶不起来。happy = 眯眯眼开怀笑(离场演出用)。 */
export function drawFace(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  blink: boolean,
  happy = false
): void {
  const ex = r * 0.34;
  if (happy) {
    c.strokeStyle = "#3d3350";
    c.lineWidth = Math.max(1.2, r * 0.09);
    c.lineCap = "round";
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(cx + s * ex, cy, r * 0.16, Math.PI * 1.15, Math.PI * 1.85);
      c.stroke();
    }
    c.fillStyle = "#3d3350";
    c.beginPath();
    c.arc(cx, cy + r * 0.3, r * 0.22, 0, Math.PI);
    c.closePath();
    c.fill();
    return;
  }
  c.fillStyle = "#fff";
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(cx + s * ex, cy - r * 0.1, r * 0.24, blink ? r * 0.05 : r * 0.26, 0, 0, TAU);
    c.fill();
  }
  if (!blink) {
    c.fillStyle = "#3d3350";
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(cx + s * ex, cy - r * 0.06, r * 0.12, 0, TAU);
      c.fill();
    }
  }
  c.strokeStyle = "#3d3350";
  c.lineWidth = Math.max(1.2, r * 0.09);
  c.lineCap = "round";
  c.beginPath();
  c.arc(cx, cy + r * 0.28, r * 0.26, 0.15 * Math.PI, 0.85 * Math.PI);
  c.stroke();
}

/** 地面阴影:2D 俯视里唯一的「立体」,近的画在上面靠 y 轴排序。签名 1.2 原样。 */
export function drawShadow(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  // 双层软影:外圈更淡,像被阳光晒出来的,不再是一片死板的实心椭圆
  c.fillStyle = "rgba(110,95,150,.08)";
  c.beginPath();
  c.ellipse(x, y + r * 0.72, r * 1.02, r * 0.5, 0, 0, TAU);
  c.fill();
  c.fillStyle = "rgba(110,95,150,.12)";
  c.beginPath();
  c.ellipse(x, y + r * 0.72, r * 0.78, r * 0.36, 0, 0, TAU);
  c.fill();
}

/* ------------------------------------------------------------------ */
/* 双英雄:小画家设定 —— 贝雷帽 + 围裙 + 像样的刷子                        */
/* ------------------------------------------------------------------ */

export interface HeroSkin {
  /** 圆身体主色(= 1.2 的 P_COLOR,双人识别色不动) */
  body: string;
  /** 画家围裙 */
  apron: string;
  /** 贝雷帽:P1 粉、P2 金黄 */
  hat: string;
  /** 帽徽:形状通道,色弱模式也分得开 */
  badge: "flower" | "star";
}

export const HERO_SKINS: readonly [HeroSkin, HeroSkin] = [
  { body: "#e6558f", apron: "#fff1f7", hat: "#f27fae", badge: "flower" },
  { body: "#3f7fd6", apron: "#eef5ff", hat: "#f4b942", badge: "star" },
];

/** drawHero 只读这些字段(ArenaHero 的子集,测试可以直接造假的)。 */
export interface HeroPose {
  x: number;
  y: number;
  fx: number;
  fy: number;
  spin: number;
  invuln: number;
  windup: number;
  shields: number;
  idx: number;
  moving?: boolean;
}

/**
 * 2 头身小画家:圆身体径向渐变 + 贝雷帽(P1 花徽 / P2 星徽)+ 围裙 + 小脚。
 * 刷子从「1 线 + 1 圆」换成「木柄 + 金属箍 + 刷毛扇」;
 * 前摇收 / 甩出伸的 reach 数值语义与 1.2 一字不差。
 * swingAge:距离上一次出手过了几秒(<0.2 时画挥击弧痕 + 刷毛甩开)。
 */
export function drawHero(
  c: CanvasRenderingContext2D,
  h: HeroPose,
  t: number,
  motion: boolean,
  swingAge = 99
): void {
  const skin = HERO_SKINS[h.idx] ?? HERO_SKINS[0];
  const col = skin.body;
  drawShadow(c, h.x, h.y, HERO_R);
  c.save();
  if (h.invuln > 0 && motion) c.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 16));
  // 转圈:整个人打着转,晕头转向但一点都不疼;弱动效时定格成歪一下
  const spinAngle = h.spin > 0 ? (motion ? t * 12 : 0.4) : 0;
  c.translate(h.x, h.y);
  c.rotate(spinAngle);
  // 奔跑:身体往走的方向轻轻一倾(≤8°),两只小脚交替着迈
  const runStep = motion && h.moving ? (Math.floor(t * 9) % 2 === 0 ? 1 : -1) : 0;
  if (motion && h.moving) c.rotate(h.fx * 0.12);
  c.fillStyle = shade(col, 0.72);
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(s * HERO_R * 0.42, HERO_R * 0.88 + (s === runStep ? -2.2 : 0), 3.4, 2.4, 0, 0, TAU);
    c.fill();
  }
  // 圆身体:左上亮的径向渐变
  c.lineWidth = 2.6;
  c.strokeStyle = shade(col, 0.68);
  c.fillStyle = bodyGrad(c, 0, 0, HERO_R, col);
  c.beginPath();
  c.arc(0, 0, HERO_R, 0, TAU);
  c.fill();
  c.stroke();
  // 画家围裙:下半身一块浅色兜兜,上面还蹭着两点颜料
  c.save();
  c.beginPath();
  c.arc(0, 0, HERO_R - 1.1, 0, TAU);
  c.clip();
  c.fillStyle = skin.apron;
  roundRect(c, -HERO_R * 0.74, HERO_R * 0.26, HERO_R * 1.48, HERO_R, HERO_R * 0.4);
  c.fill();
  c.fillStyle = "#ffd66b";
  c.beginPath();
  c.arc(-2.6, HERO_R * 0.56, 1.3, 0, TAU);
  c.fill();
  c.fillStyle = "#9be0b9";
  c.beginPath();
  c.arc(2.8, HERO_R * 0.66, 1.3, 0, TAU);
  c.fill();
  c.restore();

  const blink = motion && Math.sin(t * 1.9 + h.idx * 2.1) > 0.965;
  drawFace(c, 0, -HERO_R * 0.08, HERO_R * 0.72, blink);

  // 画家贝雷帽:扁扁一顶歪戴着,帽顶一粒小揪揪
  c.fillStyle = skin.hat;
  c.strokeStyle = shade(skin.hat, 0.7);
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(-HERO_R * 0.08, -HERO_R * 0.78, HERO_R * 0.74, HERO_R * 0.34, -0.12, 0, TAU);
  c.fill();
  c.stroke();
  c.beginPath();
  c.arc(-HERO_R * 0.08, -HERO_R * 1.1, 2.1, 0, TAU);
  c.fill();
  // 帽徽:P1 五瓣小花 / P2 四芒星 —— 形状 + 颜色双通道区分双人
  const bx = HERO_R * 0.36;
  const by = -HERO_R * 0.84;
  if (skin.badge === "flower") {
    c.fillStyle = "#fff";
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      c.beginPath();
      c.arc(bx + Math.cos(a) * 2.3, by + Math.sin(a) * 2.3, 1.6, 0, TAU);
      c.fill();
    }
    c.fillStyle = "#ffd66b";
    c.beginPath();
    c.arc(bx, by, 1.5, 0, TAU);
    c.fill();
  } else {
    drawSparkStar(c, bx, by, 3.6, "#fff");
  }

  // 举着的刷子:前摇时往回收,甩出去的一瞬间伸到最长(1.2 的 reach 数值不动)
  const ang = Math.atan2(h.fy, h.fx);
  const reach = HERO_R + 5 + (h.windup > 0 ? -3 : 8);
  const splay = motion && swingAge >= 0 && swingAge < 0.16;
  c.save();
  c.rotate(ang);
  // 木柄:双色圆角矩形,像削出来的木头
  c.fillStyle = "#a97e52";
  roundRect(c, 3, -1.9, reach - 6, 3.8, 1.8);
  c.fill();
  c.fillStyle = "#c99b6c";
  roundRect(c, 3, -1.9, reach - 6, 1.7, 1.2);
  c.fill();
  c.strokeStyle = "#7c5a38";
  c.lineWidth = 1;
  roundRect(c, 3, -1.9, reach - 6, 3.8, 1.8);
  c.stroke();
  // 金属箍
  c.fillStyle = "#cfd6e4";
  roundRect(c, reach - 3, -2.6, 3.2, 5.2, 1.2);
  c.fill();
  c.strokeStyle = "#9aa3b8";
  roundRect(c, reach - 3, -2.6, 3.2, 5.2, 1.2);
  c.stroke();
  // 刷毛:平时 3 撮乖乖拢着,甩出的一瞬间 4 撮往两边炸开
  const tufts = splay ? 4 : 3;
  c.fillStyle = "#fffdf6";
  for (let i = 0; i < tufts; i++) {
    const off = (i - (tufts - 1) / 2) * (splay ? 2.5 : 1.8);
    c.beginPath();
    c.moveTo(reach + 0.4, off - 1.05);
    c.lineTo(reach + 0.4, off + 1.05);
    c.lineTo(reach + 5.2 + (splay ? 1.6 : 0), off * (splay ? 1.8 : 1.2));
    c.closePath();
    c.fill();
  }
  // 刷尖蘸着自己的颜料色
  c.fillStyle = col;
  c.beginPath();
  c.arc(reach + 5.4 + (splay ? 1.4 : 0), 0, 1.7, 0, TAU);
  c.fill();
  c.restore();

  // 挥击弧痕:沿挥击弧一道颜料光带,0.2 秒淡出(角色色)
  if (motion && swingAge >= 0 && swingAge < 0.2) {
    const k = swingAge / 0.2;
    c.save();
    c.globalAlpha *= (1 - k) * 0.8;
    c.strokeStyle = col;
    c.lineWidth = 3.5;
    c.lineCap = "round";
    c.beginPath();
    c.arc(0, 0, reach + 6 + k * 4, ang - 0.85 + k * 0.3, ang + 0.85 + k * 0.3);
    c.stroke();
    c.restore();
  }
  c.restore();

  // 护盾泡:身上挂着几个就画几个,每个都有一粒高光
  for (let i = 0; i < h.shields; i++) {
    const a = (motion ? t * 1.6 : 0) + (i / Math.max(1, h.shields)) * TAU;
    const sx = h.x + Math.cos(a) * (HERO_R + 7);
    const sy = h.y + Math.sin(a) * (HERO_R + 7);
    c.strokeStyle = "rgba(150,205,255,.85)";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(sx, sy, 5, 0, TAU);
    c.stroke();
    c.fillStyle = "rgba(255,255,255,.9)";
    c.beginPath();
    c.arc(sx - 1.6, sy - 1.7, 1.2, 0, TAU);
    c.fill();
  }
  // 头顶转的星星:黄点升级为四芒星
  if (h.spin > 0) {
    for (let i = 0; i < 3; i++) {
      const a = (motion ? t * 9 : 0) + (i / 3) * TAU;
      drawSparkStar(c, h.x + Math.cos(a) * (HERO_R + 9), h.y - HERO_R - 6 + Math.sin(a) * 4, 3.4, "#ffd66b");
    }
  }
}

/* ------------------------------------------------------------------ */
/* 五种怪物:形状语言 1.2 原样,渲染全面材质化                             */
/* ------------------------------------------------------------------ */

/**
 * 五种行为五种外形,不是只换个颜色:
 * 直冲 = 圆脑袋加冲刺尖角、绕行 = 转着的折纸风车星、吐泡泡 = 圆气球顶着长喇叭、
 * 召唤 = 高个蛋壳背着小豆子、精英 = 金属六边形正面顶着一块盾。
 */
export function drawMonster(c: CanvasRenderingContext2D, m: ArenaMonster, t: number, motion: boolean): void {
  const fill = MONSTER_COLOR[m.kind];
  const r = m.r;
  const bob = motion ? Math.sin(t * 4 + m.phase) * (m.behavior === "spit" ? 2.6 : 1.4) : 0;
  const x = m.x;
  const y = m.y + bob;
  const ang = Math.atan2(m.fy, m.fx);

  drawShadow(c, m.x, m.y, r);
  c.save();
  if (motion && m.hitFlash > 0) c.globalAlpha = 0.62 + 0.38 * Math.cos(m.hitFlash * 44);
  c.lineWidth = 2.4;
  c.lineJoin = "round";
  c.strokeStyle = shade(fill, 0.6);

  if (m.behavior === "rush") {
    // 冲刺速度线:屁股后面两道,一眼看出它冲得多急
    if (m.speed > 0) {
      c.strokeStyle = shade(fill, 1.12);
      c.lineWidth = 2;
      c.lineCap = "round";
      for (const s of [-0.5, 0.5]) {
        const a2 = ang + Math.PI + s;
        c.beginPath();
        c.moveTo(x + Math.cos(a2) * (r + 3), y + Math.sin(a2) * (r + 3));
        c.lineTo(x + Math.cos(a2) * (r + 10), y + Math.sin(a2) * (r + 10));
        c.stroke();
      }
      c.strokeStyle = shade(fill, 0.6);
      c.lineWidth = 2.4;
    }
    c.fillStyle = bodyGrad(c, x, y, r, fill);
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
    c.stroke();
    // 冲刺尖角:一眼看出它奔着哪儿去;角面分明暗两阶,折纸棱面感
    const tipX = x + Math.cos(ang) * (r + 8);
    const tipY = y + Math.sin(ang) * (r + 8);
    c.fillStyle = shade(fill, 0.92);
    c.beginPath();
    c.moveTo(tipX, tipY);
    c.lineTo(x + Math.cos(ang + 2.4) * r, y + Math.sin(ang + 2.4) * r);
    c.lineTo(x + Math.cos(ang - 2.4) * r, y + Math.sin(ang - 2.4) * r);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = shade(fill, 1.18);
    c.beginPath();
    c.moveTo(tipX, tipY);
    c.lineTo(x + Math.cos(ang - 2.4) * r, y + Math.sin(ang - 2.4) * r);
    c.lineTo(x + Math.cos(ang - 1.1) * r * 0.82, y + Math.sin(ang - 1.1) * r * 0.82);
    c.closePath();
    c.fill();
  } else if (m.behavior === "weave") {
    const spin = motion ? t * 3 + m.phase : m.phase;
    c.fillStyle = bodyGrad(c, x, y, r, fill);
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = spin + (i / 10) * TAU;
      const rad = i % 2 === 0 ? r * 1.15 : r * 0.55;
      const px2 = x + Math.cos(a) * rad;
      const py2 = y + Math.sin(a) * rad;
      if (i === 0) c.moveTo(px2, py2);
      else c.lineTo(px2, py2);
    }
    c.closePath();
    c.fill();
    c.stroke();
    // 星尖交替两色:折纸风车的感觉
    for (let i = 0; i < 5; i++) {
      const aTip = spin + ((i * 2) / 10) * TAU;
      const aL = spin + (((i * 2 + 9) % 10) / 10) * TAU;
      const aR = spin + (((i * 2 + 1) % 10) / 10) * TAU;
      c.fillStyle = i % 2 === 0 ? shade(fill, 1.2) : shade(fill, 0.9);
      c.beginPath();
      c.moveTo(x + Math.cos(aTip) * r * 1.15, y + Math.sin(aTip) * r * 1.15);
      c.lineTo(x + Math.cos(aL) * r * 0.55, y + Math.sin(aL) * r * 0.55);
      c.lineTo(x + Math.cos(aR) * r * 0.55, y + Math.sin(aR) * r * 0.55);
      c.closePath();
      c.fill();
    }
    // 中心留一块干净的圆底给脸
    c.fillStyle = bodyGrad(c, x, y, r * 0.62, fill);
    c.beginPath();
    c.arc(x, y, r * 0.62, 0, TAU);
    c.fill();
  } else if (m.behavior === "spit") {
    // 飘着的气球:身子和影子离得远一点,看着就在天上
    const by2 = y - r * 0.5;
    // 系绳:荡来荡去的一根小细绳
    const sway = motion ? Math.sin(t * 3.2 + m.phase) * 2.4 : 0;
    c.strokeStyle = shade(fill, 0.55);
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(x, by2 + r * 0.95);
    c.quadraticCurveTo(x + sway, by2 + r * 1.5, x - sway * 0.6, m.y + r * 0.6);
    c.stroke();
    c.strokeStyle = shade(fill, 0.6);
    c.lineWidth = 2.4;
    c.fillStyle = bodyGrad(c, x, by2, r, fill);
    c.beginPath();
    c.ellipse(x, by2, r * 0.92, r * 1.02, 0, 0, TAU);
    c.fill();
    c.stroke();
    // 气球高光:左上一枚亮斑,看着就有气
    c.fillStyle = "rgba(255,255,255,.55)";
    c.beginPath();
    c.ellipse(x - r * 0.34, by2 - r * 0.44, r * 0.26, r * 0.15, -0.6, 0, TAU);
    c.fill();
    // 长喇叭:吐泡前那一瞬会鼓一下(timer 是引擎自己的倒计时,只读不改)
    const puff = m.timer < 0.18 ? 1.3 : 1;
    c.strokeStyle = shade(fill, 0.5);
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, by2);
    c.lineTo(x + Math.cos(ang) * (r + 9), by2 + Math.sin(ang) * (r + 9));
    c.stroke();
    c.fillStyle = shade(fill, 0.85);
    c.beginPath();
    c.arc(x + Math.cos(ang) * (r + 10), by2 + Math.sin(ang) * (r + 10), r * 0.34 * puff, 0, TAU);
    c.fill();
    c.stroke();
  } else if (m.behavior === "summon") {
    c.fillStyle = bodyGrad(c, x, y - r * 0.1, r * 1.2, fill);
    roundRect(c, x - r * 0.72, y - r * 1.15, r * 1.44, r * 2.1, r * 0.7);
    c.fill();
    c.stroke();
    // 蛋壳斑点:三粒,长在脸旁边不挡脸
    c.fillStyle = shade(fill, 0.86);
    for (const [dx, dy, dr] of [
      [-0.52, -0.78, 0.13],
      [0.5, -0.9, 0.16],
      [0.55, 0.5, 0.11],
    ] as const) {
      c.beginPath();
      c.arc(x + dx * r, y + dy * r, dr * r, 0, TAU);
      c.fill();
    }
    // 背上那几颗小豆子就是待会儿要蹦出来的小跟班,一颗颗都有小脸
    for (let i = 0; i < Math.min(3, m.summons); i++) {
      const px2 = x - r * 0.5 + i * r * 0.5;
      const py2 = y + r * 0.8;
      c.fillStyle = shade(fill, 0.82);
      c.beginPath();
      c.arc(px2, py2, r * 0.24, 0, TAU);
      c.fill();
      c.fillStyle = "#fff";
      for (const s of [-1, 1]) {
        c.beginPath();
        c.arc(px2 + s * r * 0.08, py2 - r * 0.04, r * 0.05, 0, TAU);
        c.fill();
      }
    }
    // 天线 + 会发光的天线球
    c.strokeStyle = shade(fill, 0.5);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, y - r * 1.15);
    c.lineTo(x, y - r * 1.65);
    c.stroke();
    const glow = c.createRadialGradient(x, y - r * 1.75, 0.4, x, y - r * 1.75, r * 0.52);
    glow.addColorStop(0, "rgba(255,215,234,.95)");
    glow.addColorStop(1, "rgba(255,215,234,0)");
    c.fillStyle = glow;
    c.beginPath();
    c.arc(x, y - r * 1.75, r * 0.52, 0, TAU);
    c.fill();
    c.fillStyle = "#ffd7ea";
    c.beginPath();
    c.arc(x, y - r * 1.75, r * 0.2, 0, TAU);
    c.fill();
  } else {
    // 精英:金属渐变面板的六边形,做工扎实
    const g = c.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, shade(fill, 1.22));
    g.addColorStop(0.5, fill);
    g.addColorStop(1, shade(fill, 0.8));
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = ang + (i / 6) * TAU;
      const px2 = x + Math.cos(a) * r * 1.05;
      const py2 = y + Math.sin(a) * r * 1.05;
      if (i === 0) c.moveTo(px2, py2);
      else c.lineTo(px2, py2);
    }
    c.closePath();
    c.fill();
    c.stroke();
    // 两粒铆钉
    c.fillStyle = shade(fill, 0.62);
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(x + Math.cos(ang + s * 2.2) * r * 0.68, y + Math.sin(ang + s * 2.2) * r * 0.68, r * 0.1, 0, TAU);
      c.fill();
    }
  }

  // 精英怪正面那块盾:挡一下掉一格,掉光就没了(绕到侧后方就打得着)。判定逻辑零改动。
  if (m.shield > 0) {
    const left = m.shield / Math.max(1, m.shieldMax);
    c.strokeStyle = m.blockFlash > 0 && motion ? "#ffffff" : "#9fd0ff";
    c.lineWidth = 5;
    c.lineCap = "round";
    c.beginPath();
    c.arc(x, y, r + 6, ang - 1.15 * left - 0.1, ang + 1.15 * left + 0.1);
    c.stroke();
    // 掉格白闪:两粒小碎盾往外蹦(只是演出)
    if (m.blockFlash > 0 && motion) {
      c.fillStyle = "#ffffff";
      for (const s of [-1, 1]) {
        const a2 = ang + s * (1.15 * left + 0.3);
        const px2 = x + Math.cos(a2) * (r + 9);
        const py2 = y + Math.sin(a2) * (r + 9);
        c.beginPath();
        c.moveTo(px2, py2 - 2.4);
        c.lineTo(px2 + 2.2, py2 + 1.8);
        c.lineTo(px2 - 2.2, py2 + 1.8);
        c.closePath();
        c.fill();
      }
    }
  }

  const blink = motion && Math.sin(t * 1.7 + m.phase * 2) > 0.96;
  drawFace(c, x, m.behavior === "spit" ? y - r * 0.55 : y, r * 0.8, blink);

  // 被刷中:除了闪一下,再溅两粒颜料点(主角的粉颜料)
  if (motion && m.hitFlash > 0) {
    const k = 1 - Math.min(1, m.hitFlash / 0.14);
    c.fillStyle = "#ff7fb4";
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(x + s * (r * 0.6 + k * 7), y - r * 0.5 - k * 6, 2 * (1 - k) + 0.6, 0, TAU);
      c.fill();
    }
  }

  if (m.boss) {
    c.fillStyle = "#ffcf4d";
    c.strokeStyle = "#d99f18";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x - r * 0.55, y - r * 1.0);
    c.lineTo(x - r * 0.3, y - r * 1.45);
    c.lineTo(x, y - r * 1.05);
    c.lineTo(x + r * 0.3, y - r * 1.45);
    c.lineTo(x + r * 0.55, y - r * 1.0);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = "#ff8fb8";
    c.beginPath();
    c.arc(x, y - r * 1.16, r * 0.09, 0, TAU);
    c.fill();
  }
  c.restore();

  // 上色进度条:被涂过才显示,没挨过颜料的头顶干干净净。
  // 条色从单绿换成彩虹渐变 —— 上色不是打死,是把它涂成彩色。
  if (m.hp < m.maxHp) {
    const w = r * 2;
    const by3 = y - r * (m.boss ? 1.75 : 1.5);
    c.fillStyle = "rgba(255,255,255,.85)";
    roundRect(c, x - w / 2, by3, w, 4.5, 2.2);
    c.fill();
    const g2 = c.createLinearGradient(x - w / 2, by3, x + w / 2, by3);
    g2.addColorStop(0, "#ffb3c8");
    g2.addColorStop(0.35, "#ffe08a");
    g2.addColorStop(0.7, "#9be0b9");
    g2.addColorStop(1, "#9fc8ff");
    c.fillStyle = g2;
    roundRect(c, x - w / 2, by3, (w * Math.max(0, m.hp)) / m.maxHp, 4.5, 2.2);
    c.fill();
  }
}

/* ------------------------------------------------------------------ */
/* 家:小房子 + 元气罐                                                   */
/* ------------------------------------------------------------------ */

/**
 * 家:判定圈虚线(1.2 口径,孩子要看得见底线)+ 有门有窗有烟囱的小房子。
 * 元气罐带罐盖、高光与心形贴纸;被抱走的那几罐灰化并倒向一边,一眼读出损失。
 */
export function drawHome(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  jars: number,
  maxJars: number,
  color: string,
  t = 0,
  motion = false
): void {
  // 判定圈:小怪物碰到这一圈就抱走一罐,画清楚孩子才知道底线在哪
  c.strokeStyle = "rgba(150,120,190,.35)";
  c.setLineDash([7, 6]);
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x, y, HOME_R, 0, TAU);
  c.stroke();
  c.setLineDash([]);

  // 房身
  c.fillStyle = "#fff";
  c.strokeStyle = color;
  c.lineWidth = 3;
  roundRect(c, x - 16, y - 12, 32, 24, 7);
  c.fill();
  c.stroke();
  // 烟囱 + 一缕炊烟(弱动效时炊烟定住)
  c.fillStyle = shade(color, 0.8);
  roundRect(c, x + 8, y - 24, 5, 8, 1.5);
  c.fill();
  const drift = motion ? Math.sin(t * 1.8) * 1.6 : 0;
  c.fillStyle = "rgba(255,255,255,.8)";
  c.beginPath();
  c.arc(x + 10.5 + drift * 0.4, y - 28, 2.2, 0, TAU);
  c.fill();
  c.beginPath();
  c.arc(x + 12 + drift, y - 32.5, 3, 0, TAU);
  c.fill();
  // 屋顶:角色色渐变,亮面在屋脊
  const roof = c.createLinearGradient(x, y - 26, x, y - 12);
  roof.addColorStop(0, shade(color, 1.16));
  roof.addColorStop(1, color);
  c.beginPath();
  c.moveTo(x - 20, y - 12);
  c.lineTo(x, y - 26);
  c.lineTo(x + 20, y - 12);
  c.closePath();
  c.fillStyle = roof;
  c.fill();
  // 拱形门
  c.fillStyle = shade(color, 0.74);
  c.beginPath();
  c.moveTo(x - 4, y + 12);
  c.lineTo(x - 4, y + 3);
  c.arc(x, y + 3, 4, Math.PI, 0);
  c.lineTo(x + 4, y + 12);
  c.closePath();
  c.fill();
  // 圆窗:白底 + 十字窗棂
  c.fillStyle = "#fff8e6";
  c.strokeStyle = shade(color, 0.85);
  c.lineWidth = 1.6;
  c.beginPath();
  c.arc(x - 8, y - 2, 4, 0, TAU);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(x - 12, y - 2);
  c.lineTo(x - 4, y - 2);
  c.moveTo(x - 8, y - 6);
  c.lineTo(x - 8, y + 2);
  c.stroke();

  // 家门口的元气罐:被抱走一罐就灰一个、倒一个
  for (let i = 0; i < maxJars; i++) {
    const a = (i / maxJars) * TAU - Math.PI / 2;
    const jx = x + Math.cos(a) * (HOME_R - 5);
    const jy = y + Math.sin(a) * (HOME_R - 5);
    const on = i < jars;
    c.save();
    c.translate(jx, jy);
    // 空罐倒向一边(约 15°),一眼看出「这罐被抱走了」
    if (!on) c.rotate(0.26);
    c.fillStyle = on ? "#ff9ec4" : "#e7e1ee";
    c.strokeStyle = on ? "#d9628a" : "#cfc7dd";
    c.lineWidth = 2;
    roundRect(c, -4, -5, 8, 10, 2.5);
    c.fill();
    c.stroke();
    // 罐盖
    c.fillStyle = on ? "#d9628a" : "#cfc7dd";
    roundRect(c, -4.6, -6.6, 9.2, 2.6, 1.2);
    c.fill();
    if (on) {
      // 罐身高光 + 心形贴纸
      c.strokeStyle = "rgba(255,255,255,.85)";
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(-2.4, -3.2);
      c.lineTo(-2.4, 2.4);
      c.stroke();
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(-1, 0.3, 1.1, 0, TAU);
      c.arc(1, 0.3, 1.1, 0, TAU);
      c.fill();
      c.beginPath();
      c.moveTo(-2, 0.9);
      c.lineTo(0, 3.1);
      c.lineTo(2, 0.9);
      c.closePath();
      c.fill();
    }
    c.restore();
  }
}

/* ------------------------------------------------------------------ */
/* 场地:天空 + 庭院草纹 + 按场景查表的院外装饰                            */
/* ------------------------------------------------------------------ */

export interface ScenerySpec {
  ground: string;
  scene: number;
  versus: boolean;
  homes: ReadonlyArray<{ x: number; y: number }>;
  yard: number;
}

/** 天空:纯色 fillRect 升级为纵向微渐变 + 两朵远处的定格白云。 */
export function drawSky(c: CanvasRenderingContext2D, w: number, h: number, sky: string): void {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, sky);
  g.addColorStop(1, shade(sky, 1.04));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(255,255,255,.5)";
  for (const [cx, cy, s] of [
    [w * 0.16, 16, 1],
    [w * 0.85, 22, 0.8],
  ] as const) {
    for (const [dx, dy, rr] of [
      [-7, 1.5, 4.4],
      [0, -1.5, 5.6],
      [7, 1.5, 4.6],
    ] as const) {
      c.beginPath();
      c.arc(cx + dx * s, cy + dy * s, rr * s, 0, TAU);
      c.fill();
    }
  }
}

/** 稳定的伪随机:同一个场景每一帧长一样,不会闪。 */
function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function decoTree(c: CanvasRenderingContext2D, x: number, y: number, ground: string): void {
  c.fillStyle = "#a97e52";
  roundRect(c, x - 1.8, y - 2, 3.6, 8, 1.4);
  c.fill();
  const leaf = shade(ground, 0.78);
  c.fillStyle = bodyGrad(c, x, y - 8, 8, leaf);
  c.beginPath();
  c.arc(x - 4, y - 5, 5.4, 0, TAU);
  c.arc(x + 4, y - 5, 5.4, 0, TAU);
  c.arc(x, y - 9.5, 6, 0, TAU);
  c.fill();
}

function decoFlower(c: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  c.strokeStyle = "#7cb56f";
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(x, y + 6);
  c.quadraticCurveTo(x + 1.4, y + 3, x, y);
  c.stroke();
  c.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2;
    c.beginPath();
    c.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 1.9, 0, TAU);
    c.fill();
  }
  c.fillStyle = "#ffd66b";
  c.beginPath();
  c.arc(x, y, 1.8, 0, TAU);
  c.fill();
}

function decoTuft(c: CanvasRenderingContext2D, x: number, y: number, ground: string): void {
  c.strokeStyle = shade(ground, 0.72);
  c.lineWidth = 1.4;
  c.lineCap = "round";
  for (const [dx, k] of [
    [-2.4, -0.5],
    [0, 0],
    [2.4, 0.5],
  ] as const) {
    c.beginPath();
    c.moveTo(x + dx, y + 3);
    c.quadraticCurveTo(x + dx + k * 2, y - 1, x + dx + k * 3.4, y - 4);
    c.stroke();
  }
}

function decoCloudPuff(c: CanvasRenderingContext2D, x: number, y: number): void {
  c.fillStyle = "rgba(255,255,255,.9)";
  for (const [dx, dy, rr] of [
    [-6, 1.5, 4.2],
    [0, -1.6, 5.4],
    [6, 1.5, 4.4],
  ] as const) {
    c.beginPath();
    c.arc(x + dx, y + dy, rr, 0, TAU);
    c.fill();
  }
}

function decoRainbow(c: CanvasRenderingContext2D, x: number, y: number): void {
  c.lineWidth = 2.6;
  c.lineCap = "round";
  const bands = ["#ff9ec4", "#ffd66b", "#9be0b9"];
  for (let i = 0; i < bands.length; i++) {
    c.strokeStyle = bands[i];
    c.beginPath();
    c.arc(x, y + 6, 11 - i * 2.6, Math.PI, 0);
    c.stroke();
  }
}

function decoFirefly(c: CanvasRenderingContext2D, x: number, y: number, t: number, motion: boolean): void {
  const fy = y + (motion ? Math.sin(t * 2.1 + x) * 2 : 0);
  const glow = c.createRadialGradient(x, fy, 0.4, x, fy, 6);
  glow.addColorStop(0, "rgba(255,240,160,.9)");
  glow.addColorStop(1, "rgba(255,240,160,0)");
  c.fillStyle = glow;
  c.beginPath();
  c.arc(x, fy, 6, 0, TAU);
  c.fill();
  c.fillStyle = "#ffe08a";
  c.beginPath();
  c.arc(x, fy, 1.6, 0, TAU);
  c.fill();
}

type DecorKind = "tree" | "flower" | "cloud" | "rainbow" | "star" | "firefly";

/** 每套场景 ≤3 件院外装饰(查表,位置按画布比例定,躲开庭院圈)。 */
const SCENE_DECOR: ReadonlyArray<ReadonlyArray<{ kind: DecorKind; fx: number; fy: number }>> = [
  // 自家小院:两棵圆树一朵花
  [
    { kind: "tree", fx: 0.08, fy: 0.2 },
    { kind: "tree", fx: 0.92, fy: 0.84 },
    { kind: "flower", fx: 0.9, fy: 0.16 },
  ],
  // 彩虹街区:小彩虹加两朵花
  [
    { kind: "rainbow", fx: 0.1, fy: 0.15 },
    { kind: "flower", fx: 0.9, fy: 0.85 },
    { kind: "flower", fx: 0.92, fy: 0.16 },
  ],
  // 叮咚学校:花坛加校门口的树
  [
    { kind: "flower", fx: 0.09, fy: 0.18 },
    { kind: "tree", fx: 0.91, fy: 0.16 },
    { kind: "flower", fx: 0.1, fy: 0.84 },
  ],
  // 咕噜游乐园:彩虹门加气球树
  [
    { kind: "rainbow", fx: 0.9, fy: 0.15 },
    { kind: "tree", fx: 0.08, fy: 0.83 },
    { kind: "flower", fx: 0.1, fy: 0.16 },
  ],
  // 月光工厂:星星点点加萤火
  [
    { kind: "star", fx: 0.1, fy: 0.13 },
    { kind: "star", fx: 0.9, fy: 0.19 },
    { kind: "firefly", fx: 0.08, fy: 0.84 },
  ],
  // 云朵糖果城:两团棉花云一朵花
  [
    { kind: "cloud", fx: 0.1, fy: 0.14 },
    { kind: "cloud", fx: 0.9, fy: 0.84 },
    { kind: "flower", fx: 0.92, fy: 0.18 },
  ],
  // 星星电影院:星星和萤火虫排排坐
  [
    { kind: "star", fx: 0.09, fy: 0.15 },
    { kind: "firefly", fx: 0.9, fy: 0.85 },
    { kind: "star", fx: 0.92, fy: 0.13 },
  ],
  // 彩虹总部:彩虹旗、星星与花
  [
    { kind: "rainbow", fx: 0.1, fy: 0.15 },
    { kind: "star", fx: 0.9, fy: 0.13 },
    { kind: "flower", fx: 0.09, fy: 0.85 },
  ],
];

/**
 * 庭院与装饰:同心圆草纹保留作基底,叠加庭院里的小草小花(种子随场景),
 * 院外四角按场景查表放 ≤3 件装饰;对战模式场地挤,只画中线不摆件。
 */
export function drawScenery(
  c: CanvasRenderingContext2D,
  w: number,
  h: number,
  spec: ScenerySpec,
  t: number,
  motion: boolean
): void {
  const { ground, scene, versus, homes, yard } = spec;
  for (const home of homes) {
    // 庭院底:边缘略深一圈,像修剪过的草坪
    const g = c.createRadialGradient(home.x, home.y, yard * 0.2, home.x, home.y, yard);
    g.addColorStop(0, shade(ground, 1.05));
    g.addColorStop(1, ground);
    c.fillStyle = g;
    c.beginPath();
    c.arc(home.x, home.y, yard, 0, TAU);
    c.fill();
    c.strokeStyle = shade(ground, 0.86);
    c.lineWidth = 3;
    c.beginPath();
    c.arc(home.x, home.y, yard, 0, TAU);
    c.stroke();
    // 一圈一圈的草地纹路:看得出家在中间、怪从外面往里挤(1.2 口径)
    c.strokeStyle = "rgba(255,255,255,.65)";
    c.lineWidth = 1.6;
    for (let r = 44; r < yard; r += 36) {
      c.beginPath();
      c.arc(home.x, home.y, r, 0, TAU);
      c.stroke();
    }
    // 庭院里的小草小花:种子随场景,每帧长一样
    for (let i = 0; i < 6; i++) {
      const a = hash01(scene * 31 + i * 7 + home.x) * TAU;
      const d = yard * (0.42 + 0.46 * hash01(scene * 17 + i * 13 + home.y));
      const px = home.x + Math.cos(a) * d;
      const py = home.y + Math.sin(a) * d;
      if (i % 3 === 0) decoFlower(c, px, py, PAINTS[(scene + i) % PAINTS.length]);
      else decoTuft(c, px, py, ground);
    }
  }

  if (versus) {
    // 双人对战中线(1.2 口径保留)
    c.strokeStyle = "rgba(120,100,170,.4)";
    c.setLineDash([9, 7]);
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(w / 2, 0);
    c.lineTo(w / 2, h);
    c.stroke();
    c.setLineDash([]);
    return;
  }

  const decor = SCENE_DECOR[scene % SCENE_DECOR.length] ?? SCENE_DECOR[0];
  for (const d of decor) {
    const dx = d.fx * w;
    const dy = d.fy * h;
    if (d.kind === "tree") decoTree(c, dx, dy, ground);
    else if (d.kind === "flower") decoFlower(c, dx, dy, PAINTS[(scene * 3 + 1) % PAINTS.length]);
    else if (d.kind === "cloud") decoCloudPuff(c, dx, dy);
    else if (d.kind === "rainbow") decoRainbow(c, dx, dy);
    else if (d.kind === "star") drawSparkStar(c, dx, dy, 3.4, "#ffe08a");
    else decoFirefly(c, dx, dy, t, motion);
  }
}

/* ------------------------------------------------------------------ */
/* 元气糖、子弹与粒子                                                    */
/* ------------------------------------------------------------------ */

/** 元气糖:带高光的糖球 + 两片糖纸小翅膀,躺地上一闪一闪。 */
export function drawCrumb(c: CanvasRenderingContext2D, x: number, y: number, t: number, motion: boolean): void {
  const tw = motion ? 1 + Math.sin(t * 6 + x * 0.6 + y * 0.3) * 0.1 : 1;
  c.fillStyle = "#ffe9a8";
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(x + s * 3.6 * tw, y);
    c.lineTo(x + s * 7 * tw, y - 2.4);
    c.lineTo(x + s * 7 * tw, y + 2.4);
    c.closePath();
    c.fill();
  }
  const g = c.createRadialGradient(x - 1.4, y - 1.6, 0.4, x, y, 4.6);
  g.addColorStop(0, "#fff2c4");
  g.addColorStop(1, "#ffd86b");
  c.fillStyle = g;
  c.strokeStyle = "#e0a92c";
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(x, y, 4.2 * tw, 0, TAU);
  c.fill();
  c.stroke();
}

/** 我方颜料泡:渐变身 + 高光 + 两个渐隐残影;敌方泡泡:冷色 + 波动轮廓。 */
export function drawBullet(c: CanvasRenderingContext2D, b: ArenaBullet, t: number, motion: boolean): void {
  if (b.foe) {
    const wob = motion ? Math.sin(t * 7 + b.x * 0.15 + b.y * 0.1) * 2 : 0;
    c.fillStyle = "rgba(169,214,255,.88)";
    c.strokeStyle = "#6ba7dd";
    c.lineWidth = 1.4;
    c.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * TAU;
      const rr = b.r + Math.sin(a * 3 + wob) * 0.9;
      const px = b.x + Math.cos(a) * rr;
      const py = b.y + Math.sin(a) * rr;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = "rgba(255,255,255,.7)";
    c.beginPath();
    c.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.28, 0, TAU);
    c.fill();
    return;
  }
  // 短拖尾:两个渐隐残影跟在屁股后面
  const d = Math.hypot(b.vx, b.vy) || 1;
  const ux = b.vx / d;
  const uy = b.vy / d;
  for (let i = 1; i <= 2; i++) {
    c.fillStyle = i === 1 ? "rgba(255,127,180,.32)" : "rgba(255,127,180,.15)";
    c.beginPath();
    c.arc(b.x - ux * i * 4.5, b.y - uy * i * 4.5, Math.max(0.8, b.r * (1 - i * 0.24)), 0, TAU);
    c.fill();
  }
  const g = c.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.15, b.x, b.y, b.r * 1.1);
  g.addColorStop(0, "#ffb1d0");
  g.addColorStop(1, "#ff7fb4");
  c.fillStyle = g;
  c.strokeStyle = "#d9628a";
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(b.x, b.y, b.r, 0, TAU);
  c.fill();
  c.stroke();
  c.fillStyle = "rgba(255,255,255,.85)";
  c.beginPath();
  c.arc(b.x - b.r * 0.32, b.y - b.r * 0.36, b.r * 0.26, 0, TAU);
  c.fill();
}

/**
 * 粒子:cloud = 手绘蓬蓬云(三圆拼合,膨胀淡出,☁️ emoji 退休)、
 * ring = 圈圈涟漪(1.2 保留)、spark = 粉彩颜料溅点。
 */
export function drawParticle(c: CanvasRenderingContext2D, p: ArenaParticle): void {
  const k = 1 - p.life / p.maxLife;
  c.save();
  c.globalAlpha = Math.max(0, 1 - k);
  if (p.kind === "cloud") {
    const s = 1 + k * 0.7;
    const lobes: ReadonlyArray<readonly [number, number, number]> = [
      [-6, 1.5, 4.4],
      [0, -2, 6],
      [6, 1.5, 4.6],
    ];
    c.fillStyle = "#dde6f8";
    for (const [dx, dy, rr] of lobes) {
      c.beginPath();
      c.arc(p.x + dx * s, p.y + dy * s, (rr + 1.3) * s, 0, TAU);
      c.fill();
    }
    c.fillStyle = "#ffffff";
    for (const [dx, dy, rr] of lobes) {
      c.beginPath();
      c.arc(p.x + dx * s, p.y + dy * s, rr * s, 0, TAU);
      c.fill();
    }
  } else if (p.kind === "ring") {
    c.strokeStyle = "#bcd6ff";
    c.lineWidth = 3 * (1 - k) + 1;
    c.beginPath();
    c.arc(p.x, p.y, 8 + k * 20, 0, TAU);
    c.stroke();
  } else {
    // 颜料溅点:位置定色,一撮里粉黄绿蓝紫都有
    c.fillStyle = PAINTS[Math.abs(Math.round(p.x * 7 + p.y * 13)) % PAINTS.length];
    c.beginPath();
    c.arc(p.x, p.y, 3.4 * (1 - k) + 1, 0, TAU);
    c.fill();
  }
  c.restore();
}

/* ------------------------------------------------------------------ */
/* 涂满离场:开心变彩色,不是被打死                                        */
/* ------------------------------------------------------------------ */

export interface Farewell {
  x: number;
  y: number;
  /** 用 state.elapsed 记的出生时刻 */
  start: number;
}

/** 离场演出多长(秒):跳一下、笑一笑、撒三粒颜料花。 */
export const FAREWELL_TIME = 0.45;

/**
 * 被涂满的小怪物变成彩虹色,开心地跳一下再淡出;弱动效时不跳只淡出。
 * 这是「上色不是打死」的正面演出:涂满 = 完成作品,大家都高兴。
 */
export function drawFarewell(c: CanvasRenderingContext2D, f: Farewell, t: number, motion: boolean): void {
  const age = t - f.start;
  if (age < 0 || age > FAREWELL_TIME) return;
  const k = age / FAREWELL_TIME;
  const hop = motion ? Math.sin(k * Math.PI) * 9 : 0;
  const y = f.y - hop;
  c.save();
  c.globalAlpha = 1 - k * k;
  const g = c.createLinearGradient(f.x - 10, y - 10, f.x + 10, y + 10);
  g.addColorStop(0, "#ffb3c8");
  g.addColorStop(0.34, "#ffe08a");
  g.addColorStop(0.67, "#9be0b9");
  g.addColorStop(1, "#9fc8ff");
  c.fillStyle = g;
  c.strokeStyle = "rgba(255,255,255,.8)";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(f.x, y, 10, 0, TAU);
  c.fill();
  c.stroke();
  drawFace(c, f.x, y, 8, false, true);
  if (motion) {
    // 三粒彩色颜料花往外蹦
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.9;
      const d = 12 + k * 14;
      drawSparkStar(c, f.x + Math.cos(a) * d, y + Math.sin(a) * d, 3 * (1 - k) + 1, PAINTS[i]);
    }
  }
  c.restore();
}
