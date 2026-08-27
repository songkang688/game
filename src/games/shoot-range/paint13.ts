/**
 * 星星射击场 1.3 · 皮肤绘制（第 14 步 A 档）。
 *
 * 这里只有画笔:场景三层纵深（帐篷天幕 / 木横梁 / 木柜台）、
 * 靶子七道工序、双人分形准星、发射台、皱眉小云。
 * 所有渐变 / 描边 / 落影走 `src/art/kit/`,颜色一律取 `visual13` 的 token,
 * 命中判定、靶子坐标与半径一个数都不碰。
 */
import { ballGradient, shade, softShadow } from "../../art/kit/volume";
import { outlineInk, strokeOutline } from "../../art/kit/outline";
import { easeOutBack } from "../../art/kit/sparkle";
import { RAINBOW_TTL, SHIELD_HP } from "./targets12";
import type { Target } from "./logic";
import {
  BEAM_H,
  BEAM_TOP_EDGE,
  BEAM_Y,
  BULLSEYE_DOT_R,
  BULLSEYE_GLOW_R,
  BUNTING_Y,
  COUNTER_Y,
  SHR_PALETTE,
  TARGET_SHADOW_DY,
  TARGET_SHADOW_RX,
  TARGET_SHADOW_RY,
  TENT_H,
  TENT_STRIPE_W,
  WOOD_FRAME_PHASE,
  WOOD_FRAME_SEGMENTS,
  breathScale,
  clawOpenAngle,
  leaveBreathScale,
  rainbowPhase,
  shieldCrackStage,
  strutCount,
} from "./visual13";

const P = SHR_PALETTE;

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}

/** 五角星路径（自绘矢量,不用任何字形星） */
export function starPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rOuter: number,
  rInner = rOuter * 0.45,
  rot = -Math.PI / 2
): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (i / 10) * Math.PI * 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// 图层 ①②③④:场景三层纵深
// ---------------------------------------------------------------------------

/** ① 远景条纹帐篷天幕:两色竖条纹 + 底边波浪 */
export function drawTent(ctx: CanvasRenderingContext2D, w: number): void {
  ctx.save();
  ctx.fillStyle = P.shrSky;
  ctx.fillRect(0, 0, w, TENT_H);
  const stripe = ctx.createLinearGradient(0, 0, 0, TENT_H);
  stripe.addColorStop(0, shade(P.shrTent, 0.12));
  stripe.addColorStop(1, P.shrTent);
  ctx.fillStyle = stripe;
  for (let x = 0; x < w + TENT_STRIPE_W; x += TENT_STRIPE_W * 2) {
    // 条纹往中间略收一点,有布料垂坠感
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + TENT_STRIPE_W, 0);
    ctx.lineTo(x + TENT_STRIPE_W * 0.92, TENT_H);
    ctx.lineTo(x + TENT_STRIPE_W * 0.08, TENT_H);
    ctx.closePath();
    ctx.fill();
  }
  // 底边一排半圆波浪收口
  ctx.fillStyle = shade(P.shrTent, -0.08);
  const scallop = TENT_STRIPE_W / 2;
  for (let x = scallop / 2; x < w + scallop; x += scallop) {
    ctx.beginPath();
    ctx.arc(x, TENT_H, scallop / 2, 0, Math.PI);
    ctx.fill();
  }
  ctx.restore();
}

/** ② 彩旗串:一条软弧线挂一排小三角旗 */
export function drawBunting(ctx: CanvasRenderingContext2D, w: number): void {
  ctx.save();
  const y = BUNTING_Y + 8;
  const sag = 14;
  ctx.strokeStyle = P.shrWoodDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.quadraticCurveTo(w / 2, y + sag * 2, w, y);
  ctx.stroke();
  const flags = [P.shrTent, P.shrGold, "#9BD9F5", "#C7ED9E"];
  const n = Math.max(4, Math.floor(w / 90));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // 贴着上面那条二次曲线挂旗
    const fx = w * t;
    const fy = y + 2 * (1 - t) * t * sag * 2;
    ctx.fillStyle = flags[i % flags.length];
    ctx.beginPath();
    ctx.moveTo(fx - 11, fy);
    ctx.lineTo(fx + 11, fy);
    ctx.lineTo(fx, fy + 22);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** ③ 中景横梁:远排靶站的木梁,3px 顶亮边 + 木纹 */
export function drawBeam(ctx: CanvasRenderingContext2D, w: number): void {
  ctx.save();
  ctx.fillStyle = P.shrWood;
  ctx.fillRect(0, BEAM_Y, w, BEAM_H);
  ctx.fillStyle = shade(P.shrWood, 0.25);
  ctx.fillRect(0, BEAM_Y, w, BEAM_TOP_EDGE);
  ctx.fillStyle = shade(P.shrWood, -0.18);
  ctx.fillRect(0, BEAM_Y + BEAM_H - 2, w, 2);
  // 木纹短线
  ctx.strokeStyle = P.shrWoodDark;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5;
  for (let x = 30; x < w; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, BEAM_Y + 5);
    ctx.lineTo(x + 44, BEAM_Y + 5 + BEAM_H * 0.4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** ④ 近景木柜台:草地一窄条 + 木台面压底 */
export function drawCounter(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.fillStyle = "#DCEFCF";
  ctx.fillRect(0, COUNTER_Y - 28, w, 28);
  ctx.fillStyle = "#C7E4B4";
  ctx.fillRect(0, COUNTER_Y - 28, w, 6);
  const wood = ctx.createLinearGradient(0, COUNTER_Y, 0, h);
  wood.addColorStop(0, shade(P.shrWood, 0.08));
  wood.addColorStop(1, shade(P.shrWood, -0.12));
  ctx.fillStyle = wood;
  ctx.fillRect(0, COUNTER_Y, w, h - COUNTER_Y);
  ctx.fillStyle = shade(P.shrWood, 0.3);
  ctx.fillRect(0, COUNTER_Y, w, BEAM_TOP_EDGE);
  // 竖板缝
  ctx.strokeStyle = P.shrWoodDark;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 2;
  for (let x = 70; x < w; x += 140) {
    ctx.beginPath();
    ctx.moveTo(x, COUNTER_Y + 6);
    ctx.lineTo(x, h - 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 靶子七道工序
// ---------------------------------------------------------------------------

/** 工序 1:椭圆落影 */
function stepShadow(ctx: CanvasRenderingContext2D, r: number): void {
  softShadow(ctx, 0, r * TARGET_SHADOW_DY, r * TARGET_SHADOW_RX, r * TARGET_SHADOW_RY, P.shrShadow);
}

/** 工序 2:支架斜杆(近排两根、远排一根侧视角) */
function stepStruts(ctx: CanvasRenderingContext2D, t: Target): void {
  const r = t.r;
  const legs = strutCount(t);
  ctx.strokeStyle = P.shrWoodDark;
  ctx.lineWidth = 2;
  for (let i = 0; i < legs; i++) {
    const dir = legs === 1 ? 0.4 : i === 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(dir * r * 0.3, r * 0.55);
    ctx.lineTo(dir * r * 0.62, r * TARGET_SHADOW_DY);
    ctx.stroke();
  }
}

/** 工序 3:木框外环——宽 0.08r,双色相间 8 段,接缝错开 22.5° */
function stepWoodFrame(ctx: CanvasRenderingContext2D, r: number): void {
  const seg = (Math.PI * 2) / WOOD_FRAME_SEGMENTS;
  ctx.lineWidth = Math.max(2, r * 0.08);
  for (let i = 0; i < WOOD_FRAME_SEGMENTS; i++) {
    ctx.strokeStyle = i % 2 === 0 ? P.shrWood : P.shrWoodDark;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.04, WOOD_FRAME_PHASE + i * seg, WOOD_FRAME_PHASE + (i + 1) * seg);
    ctx.stroke();
  }
}

/** 工序 4:色环三停径向渐变(左上高光 → 主体 → 边缘暗) */
function stepRings(ctx: CanvasRenderingContext2D, r: number, colors: string[]): void {
  for (let i = 0; i < colors.length; i++) {
    const rad = r * (1 - i * 0.24);
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fillStyle = ballGradient(ctx, 0, 0, rad, colors[i]);
    ctx.fill();
  }
}

/** 工序 5:靶心亮点——0.12r 白点 + 0.2r 半透明光晕 */
function stepBullseye(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.arc(0, 0, r * BULLSEYE_GLOW_R, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.45)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r * BULLSEYE_DOT_R, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
}

// ---- 工序 6:各靶种剪影 -----------------------------------------------------

function skinBull(ctx: CanvasRenderingContext2D, t: Target): void {
  const r = t.r;
  stepStruts(ctx, t);
  stepWoodFrame(ctx, r);
  stepRings(ctx, r, ["#FFFFFF", "#FFC9DC", "#FFFFFF", P.shrRing]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = "#D95C82";
  ctx.fill();
  stepBullseye(ctx, r);
}

function skinBalloon(ctx: CanvasRenderingContext2D, t: Target): void {
  const r = t.r;
  const base = ["#FF9FC4", "#9BD9F5", "#C7ED9E", "#FFD48A"][t.id % 4];
  ctx.strokeStyle = "#D7C9DE";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, r);
  ctx.quadraticCurveTo(6, r * 1.6, 0, r * 2.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.86, r, 0, 0, Math.PI * 2);
  ctx.fillStyle = ballGradient(ctx, 0, 0, r, base);
  ctx.fill();
  strokeOutline(ctx, base);
  // 打结的小三角
  ctx.beginPath();
  ctx.moveTo(-4, r * 0.96);
  ctx.lineTo(4, r * 0.96);
  ctx.lineTo(0, r * 1.14);
  ctx.closePath();
  ctx.fillStyle = shade(base, -0.18);
  ctx.fill();
  // 一枚小玻璃光斑
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.36, r * 0.16, r * 0.24, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.fill();
}

function skinUfo(ctx: CanvasRenderingContext2D, t: Target): void {
  const r = t.r;
  // 舱盖
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.2, r * 0.5, r * 0.45, 0, Math.PI, 0);
  ctx.fillStyle = ballGradient(ctx, 0, -r * 0.2, r * 0.5, "#DCEBFB");
  ctx.fill();
  // 碟身
  ctx.beginPath();
  ctx.ellipse(0, r * 0.15, r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fillStyle = ballGradient(ctx, 0, r * 0.15, r, "#B9CFE8");
  ctx.fill();
  strokeOutline(ctx, "#B9CFE8");
  // 碟底压暗一条,金属才立得住
  ctx.beginPath();
  ctx.ellipse(0, r * 0.34, r * 0.78, r * 0.16, 0, 0, Math.PI);
  ctx.fillStyle = "rgba(90,110,140,.25)";
  ctx.fill();
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(i * r * 0.34, r * 0.2, r * 0.09, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? P.shrGold : "#9FD0F5";
    ctx.fill();
  }
}

function skinRobot(ctx: CanvasRenderingContext2D, t: Target, nowS: number, reduce: boolean): void {
  const r = t.r;
  const bob = Math.sin(nowS * 4 + t.phase) * (reduce ? 0 : 2);
  ctx.translate(0, bob);
  ctx.strokeStyle = "#A9BCCB";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.75);
  ctx.lineTo(0, -r * 1.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -r * 1.12, r * 0.11, 0, Math.PI * 2);
  ctx.fillStyle = "#FFB3C8";
  ctx.fill();
  rr(ctx, -r * 0.7, -r * 0.75, r * 1.4, r * 1.5, r * 0.3);
  ctx.fillStyle = ballGradient(ctx, 0, 0, r, "#D7E3ED");
  ctx.fill();
  strokeOutline(ctx, "#D7E3ED");
  // 铁皮接缝与铆钉
  ctx.strokeStyle = "rgba(140,160,180,.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, r * 0.05);
  ctx.lineTo(r * 0.7, r * 0.05);
  ctx.stroke();
  ctx.fillStyle = "rgba(140,160,180,.6)";
  for (const dx of [-0.52, 0.52]) {
    ctx.beginPath();
    ctx.arc(dx * r, r * 0.52, r * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#5B7386";
  ctx.beginPath();
  ctx.arc(-r * 0.24, -r * 0.18, r * 0.11, 0, Math.PI * 2);
  ctx.arc(r * 0.24, -r * 0.18, r * 0.11, 0, Math.PI * 2);
  ctx.fill();
  // 腮红:铁皮的也要可爱
  ctx.fillStyle = "rgba(255,160,190,.4)";
  for (const dx of [-0.42, 0.42]) {
    ctx.beginPath();
    ctx.arc(dx * r, r * 0.02, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#8FA6B8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r * 0.22, r * 0.28);
  ctx.lineTo(r * 0.22, r * 0.28);
  ctx.stroke();
}

function skinNumber(ctx: CanvasRenderingContext2D, t: Target): void {
  const r = t.r;
  stepStruts(ctx, t);
  rr(ctx, -r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.28);
  ctx.fillStyle = P.shrWood;
  ctx.fill();
  rr(ctx, -r * 0.72, -r * 0.72, r * 1.44, r * 1.44, r * 0.22);
  ctx.fillStyle = ballGradient(ctx, 0, 0, r, "#EAF1FB");
  ctx.fill();
  strokeOutline(ctx, "#EAF1FB");
  ctx.fillStyle = "#3F6B9E";
  ctx.font = `900 ${Math.round(r * 1.02)}px "PingFang SC",system-ui,sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(t.order), 0, r * 0.04);
}

/** 分裂靶:大星星怀里抱两颗小星星,一眼看出「打一变三个星」 */
function skinSplit(ctx: CanvasRenderingContext2D, t: Target): void {
  const r = t.r;
  const base = "#A8E6FF";
  starPath(ctx, 0, 0, r, r * 0.5);
  ctx.fillStyle = ballGradient(ctx, 0, 0, r, base);
  ctx.fill();
  strokeOutline(ctx, base);
  if ((t.gen ?? 0) === 0) {
    // 怀里的两颗小星
    for (const dir of [-1, 1]) {
      starPath(ctx, dir * r * 0.34, r * 0.18, r * 0.3, r * 0.15);
      ctx.fillStyle = ballGradient(ctx, dir * r * 0.34, r * 0.18, r * 0.3, "#E8FBFF");
      ctx.fill();
      strokeOutline(ctx, base);
    }
  }
  // 一对困困的小眼睛,分家前打个招呼
  ctx.fillStyle = "#4A7E9E";
  for (const dx of [-0.18, 0.18]) {
    ctx.beginPath();
    ctx.arc(dx * r, -r * 0.24, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 护盾靶:粉靶心外罩半透明蓝盾,裂纹随剩余护盾两阶段 */
function skinShield(ctx: CanvasRenderingContext2D, t: Target): void {
  const r = t.r;
  stepStruts(ctx, t);
  stepRings(ctx, r * 0.68, ["#FFE3F0", "#FFC9DC"]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = "#D95C82";
  ctx.fill();
  stepBullseye(ctx, r * 0.68);
  const stage = shieldCrackStage(t.hp ?? SHIELD_HP);
  if (stage === "intact") {
    // 完整盾罩:半透明蓝 + 顶部弧形高光
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(155,217,245,.32)";
    ctx.fill();
    ctx.strokeStyle = "rgba(105,170,215,.85)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, -2.4, -1.4);
    ctx.stroke();
  } else {
    // 裂开的盾罩:断续弧 + 两道裂纹
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(155,217,245,.14)";
    ctx.fill();
    ctx.strokeStyle = "rgba(105,170,215,.45)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r, i * 1.57 + 0.25, i * 1.57 + 1.1);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(90,140,180,.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.95);
    ctx.lineTo(r * 0.12, -r * 0.5);
    ctx.lineTo(-r * 0.06, -r * 0.18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.7, r * 0.4);
    ctx.lineTo(r * 0.4, r * 0.52);
    ctx.stroke();
  }
}

/** 彩虹靶:七彩扇形环缓慢自转 + 中心云朵 + 剩余时间弧 */
function skinRainbow(ctx: CanvasRenderingContext2D, t: Target, nowS: number, reduce: boolean): void {
  const r = t.r;
  const bands = ["#FF9FC4", "#FFC98A", "#FFF3A8", "#B9EAB0", "#9BD9F5", "#C9B7F5", "#F5B8E8"];
  const spin = rainbowPhase(nowS, reduce);
  const seg = (Math.PI * 2) / bands.length;
  ctx.lineWidth = Math.max(4, r * 0.3);
  for (let i = 0; i < bands.length; i++) {
    ctx.strokeStyle = bands[i];
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, spin + i * seg, spin + (i + 1) * seg + 0.02);
    ctx.stroke();
  }
  // 中心一朵小白云
  ctx.fillStyle = ballGradient(ctx, 0, 0, r * 0.34, "#FFFFFF");
  for (const [dx, cr] of [
    [-0.16, 0.2],
    [0.02, 0.26],
    [0.2, 0.18],
  ]) {
    ctx.beginPath();
    ctx.arc(dx * r, 0, cr * r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 剩余时间画成脚下的一段弧(1.2 的功能提示,原样保留)
  const left = Math.max(0, Math.min(1, (t.ttl ?? RAINBOW_TTL) / RAINBOW_TTL));
  ctx.beginPath();
  ctx.arc(0, r * 0.35, r * 0.35, Math.PI, Math.PI + Math.PI * left);
  ctx.strokeStyle = "#A2557C";
  ctx.lineWidth = 4;
  ctx.stroke();
}

/** 好人靶:笑脸 + 小旗,加体积光影 */
function skinFriend(ctx: CanvasRenderingContext2D, t: Target): void {
  const r = t.r;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = ballGradient(ctx, 0, 0, r, "#FFF2CE");
  ctx.fill();
  strokeOutline(ctx, "#F0C367");
  ctx.fillStyle = "#9C7433";
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.16, r * 0.1, 0, Math.PI * 2);
  ctx.arc(r * 0.28, -r * 0.16, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#9C7433";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, r * 0.08, r * 0.36, 0.25 * Math.PI, 0.75 * Math.PI);
  ctx.stroke();
  // 腮红
  ctx.fillStyle = "rgba(255,150,170,.4)";
  for (const dx of [-0.52, 0.52]) {
    ctx.beginPath();
    ctx.arc(dx * r, r * 0.06, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#B08A4E";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(r * 0.95, -r * 0.2);
  ctx.lineTo(r * 0.95, -r * 1.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.95, -r * 1.1);
  ctx.lineTo(r * 1.75, -r * 0.86);
  ctx.lineTo(r * 0.95, -r * 0.62);
  ctx.closePath();
  ctx.fillStyle = "#8FD9A8";
  ctx.fill();
  strokeOutline(ctx, "#8FD9A8");
}

/** 花朵靶:五瓣粉花 + 两片叶,一眼看出「这个不能打」 */
function skinFlower(ctx: CanvasRenderingContext2D, t: Target): void {
  const r = t.r;
  // 茎与叶先画,花盖在上面
  ctx.strokeStyle = "#8FD9A8";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, r);
  ctx.lineTo(0, r * 1.7);
  ctx.stroke();
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(dir * r * 0.34, r * 1.34, r * 0.3, r * 0.14, dir * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = ballGradient(ctx, dir * r * 0.34, r * 1.34, r * 0.3, "#8FD9A8");
    ctx.fill();
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r * 0.6;
    const py = Math.sin(a) * r * 0.6;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.42, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = ballGradient(ctx, 0, 0, r * 0.42, "#FFC2DA");
    ctx.fill();
    strokeOutline(ctx, "#FFC2DA");
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = ballGradient(ctx, 0, 0, r * 0.38, "#FFEFA8");
  ctx.fill();
  ctx.fillStyle = "#C08A3A";
  ctx.beginPath();
  ctx.arc(-r * 0.14, -r * 0.06, r * 0.06, 0, Math.PI * 2);
  ctx.arc(r * 0.14, -r * 0.06, r * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#C08A3A";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, r * 0.04, r * 0.16, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
}

/**
 * 七道工序的总装线:① 落影 → ②③④⑤⑥ 由各靶种按需领取 → ⑦ 离场倒计时
 * （保留 1.2 的 `globalAlpha` 闪烁频率,叠 0.9→1.0 呼吸缩放;reduced 只留闪烁不缩放——
 * 而 1.2 的闪烁在 reduced 下本来就不动,口径原样）。
 */
export function drawTargetSkin(
  ctx: CanvasRenderingContext2D,
  t: Target,
  nowS: number,
  reduce: boolean,
  leavingSoon: boolean
): void {
  ctx.save();
  ctx.translate(t.x, t.y);
  stepShadow(ctx, t.r);
  if (leavingSoon) {
    if (!reduce) ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(nowS * 8));
    const s = leaveBreathScale(nowS, reduce);
    ctx.scale(s, s);
  }
  switch (t.kind) {
    case "bull":
      skinBull(ctx, t);
      break;
    case "balloon":
      skinBalloon(ctx, t);
      break;
    case "ufo":
      skinUfo(ctx, t);
      break;
    case "robot":
      skinRobot(ctx, t, nowS, reduce);
      break;
    case "number":
      skinNumber(ctx, t);
      break;
    case "split":
      skinSplit(ctx, t);
      break;
    case "shield":
      skinShield(ctx, t);
      break;
    case "rainbow":
      skinRainbow(ctx, t, nowS, reduce);
      break;
    case "friend":
      skinFriend(ctx, t);
      break;
    case "flower":
      skinFlower(ctx, t);
      break;
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 准星:朵朵四爪 / 星星三角爪 + 呼吸外圈 + 金环双通道
// ---------------------------------------------------------------------------

export interface CrosshairSkinOpts {
  /** 0 = 朵朵(粉四爪),1 = 星星(蓝三角爪) */
  player: number;
  ink: string;
  /** 已含散布的准星半径(feel12.crosshairRadius 的产出,只读) */
  radius: number;
  /** 当前散布(只读,用来算爪张角) */
  spread: number;
  /** feel12.comboHalo 的产出 */
  halo: { alpha: number; width: number };
  /** 倍率变化后的 0..1 扩散进度(1 = 落定;reduced 恒 1) */
  haloPulse: number;
  nowS: number;
  reduce: boolean;
  /** 双人时准星上方标的名字 */
  label?: string;
}

export function drawCrosshairSkin(ctx: CanvasRenderingContext2D, x: number, y: number, o: CrosshairSkinOpts): void {
  const rad = o.radius;
  ctx.save();
  ctx.translate(x, y);

  // 连击金环:数字通道之外的第二条通道。倍率一变金环 easeOutBack 弹开一圈。
  if (o.halo.alpha > 0) {
    const pulse = o.reduce ? 1 : easeOutBack(Math.max(0, Math.min(1, o.haloPulse)));
    const ringR = rad + 7 + o.halo.width / 2 + (1 - pulse) * 6;
    ctx.globalAlpha = o.halo.alpha;
    ctx.strokeStyle = P.shrGold;
    ctx.lineWidth = o.halo.width;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = o.halo.alpha * 0.6;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, ringR - o.halo.width * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 呼吸外圈:1200ms ±6%;reduced 画静态圈
  const breath = breathScale(o.nowS, o.reduce);
  ctx.strokeStyle = o.ink;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, rad * breath + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 准星圈
  ctx.strokeStyle = o.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.stroke();

  // 爪:散布越大张得越开(clawOpenAngle 只读散布常量)
  const open = clawOpenAngle(o.spread);
  if (o.player === 0) {
    // 朵朵:四片花瓣爪,斜向 45°
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
      ctx.save();
      ctx.translate(Math.cos(a) * rad, Math.sin(a) * rad);
      ctx.rotate(a + open);
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 4.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = o.ink;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-1.4, -1.1, 2.4, 1.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,.6)";
      ctx.fill();
      ctx.restore();
    }
  } else {
    // 星星:三片三角爪,朝里指
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
      ctx.save();
      ctx.translate(Math.cos(a) * rad, Math.sin(a) * rad);
      ctx.rotate(a + Math.PI / 2 + open);
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5.5, 3);
      ctx.lineTo(-5.5, 3);
      ctx.closePath();
      ctx.fillStyle = o.ink;
      ctx.fill();
      ctx.restore();
    }
  }

  // 中心:小星点(自绘矢量)
  starPath(ctx, 0, 0, 5.5, 2.6);
  ctx.fillStyle = o.ink;
  ctx.fill();

  if (o.label) {
    ctx.fillStyle = o.ink;
    ctx.font = '900 20px "PingFang SC",system-ui,sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(o.label, 0, -rad - 10);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 发射台:木质小台 + 自绘金星(替掉字形 ★)
// ---------------------------------------------------------------------------

export function drawLauncherSkin(ctx: CanvasRenderingContext2D, x: number, y: number, ink: string, squash: number): void {
  ctx.save();
  ctx.translate(x, y + squash * 6);
  softShadow(ctx, 0, 24, 52, 9, P.shrShadow);
  const wood = ctx.createLinearGradient(0, -20, 0, 20);
  wood.addColorStop(0, shade(P.shrWood, 0.22));
  wood.addColorStop(0.15, P.shrWood);
  wood.addColorStop(1, shade(P.shrWood, -0.15));
  rr(ctx, -46, -20, 92, 40, 14);
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.strokeStyle = outlineInk(P.shrWood);
  ctx.lineWidth = 2;
  ctx.stroke();
  // 台面镶一圈玩家色
  rr(ctx, -40, -14, 80, 28, 10);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  // 自绘金星,不再用字形 ★
  starPath(ctx, 0, 1, 12, 5.4);
  ctx.fillStyle = ballGradient(ctx, 0, 1, 12, P.shrGold);
  ctx.fill();
  strokeOutline(ctx, P.shrGold);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 皱眉小云:误击花朵靶的温柔提醒(不批评,只有一朵皱眉的小云飘过)
// ---------------------------------------------------------------------------

export function drawFrownCloud(ctx: CanvasRenderingContext2D, x: number, y: number, k: number): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - k);
  ctx.translate(x, y - k * 26);
  ctx.fillStyle = ballGradient(ctx, 0, 0, 22, "#FFFFFF");
  for (const [dx, cr] of [
    [-14, 11],
    [0, 15],
    [14, 10],
  ]) {
    ctx.beginPath();
    ctx.arc(dx, 0, cr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#8A6A7E";
  ctx.beginPath();
  ctx.arc(-6, -2, 1.8, 0, Math.PI * 2);
  ctx.arc(6, -2, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // 皱眉:倒过来的小弧
  ctx.strokeStyle = "#8A6A7E";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 8, 5, 1.25 * Math.PI, 1.75 * Math.PI);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}
