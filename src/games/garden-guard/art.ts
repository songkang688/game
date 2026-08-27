// 花园守卫 1.3 —— 纯绘制资产库(视觉升级,零玩法数值)。
//
// 为什么单拆一个文件:1.2 的绘制函数全是 mount() 里的闭包,测试够不着,
// 「铃兰铃和花火塔画得一模一样」这种走样没人抓得住。1.3 把每一件资产都
// 抽成「ctx + 数值参数」的纯函数,art.test.ts 用录制型 context 给每笔指令
// 记账,序列不同 ⇔ 画面不同,从此可分辨性有测试钉住。
//
// 红线(plan-1.3-step13-A):只画不算——攻击/射程/HP/波次/经济零改动;
// 怪物散场是「花瓣回家」不是倒下;元气条永不出现红色;禁止透视与 three.js。

import { MONSTER_INFO, type MonsterKind, type ThemeId, type TowerKind } from "./logic";
import { energyColor } from "./fx12";

type Ctx = CanvasRenderingContext2D;

/* ---------------- 基础工具 ---------------- */

/** 把 #rrggbb 变深/变浅(amt 为 -255..255)。 */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

/** 地块装饰的确定性种子:同一格永远长同样的草,画面不会每帧闪。 */
export function tileHash(c: number, r: number): number {
  let h = (c * 374761393 + r * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/* ---------------- 表情 ---------------- */

/** 表情:笑 / 担忧 / 哭 / O 形嘴(泡泡塔吐泡瞬间)。 */
export type FaceMood = "happy" | "worried" | "sad" | "o";

export function drawFace(ctx: Ctx, x: number, y: number, r: number, blush = true, mood: FaceMood = "happy"): void {
  if (blush) {
    ctx.fillStyle = "rgba(255,150,160,0.4)";
    ctx.beginPath();
    ctx.arc(x - r * 0.52, y + r * 0.12, r * 0.16, 0, Math.PI * 2);
    ctx.arc(x + r * 0.52, y + r * 0.12, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#3a3a4a";
  ctx.beginPath();
  ctx.arc(x - r * 0.32, y - r * 0.1, r * 0.1, 0, Math.PI * 2);
  ctx.arc(x + r * 0.32, y - r * 0.1, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  // 眼睛高光
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.13, r * 0.035, 0, Math.PI * 2);
  ctx.arc(x + r * 0.29, y - r * 0.13, r * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a3a4a";
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.lineCap = "round";
  if (mood === "o") {
    // 吐泡瞬间的 O 形嘴
    ctx.beginPath();
    ctx.arc(x, y + r * 0.32, r * 0.14, 0, Math.PI * 2);
    ctx.stroke();
  } else if (mood === "worried") {
    // 担忧:抿成一条微微下弯的小嘴
    ctx.beginPath();
    ctx.arc(x, y + r * 0.55, r * 0.2, 1.25 * Math.PI, 1.75 * Math.PI);
    ctx.stroke();
  } else if (mood === "sad") {
    // 哭哭:倒扣嘴 + 眉毛耷拉(不狰狞,只是委屈)
    ctx.beginPath();
    ctx.arc(x, y + r * 0.62, r * 0.24, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.42, y - r * 0.3);
    ctx.lineTo(x - r * 0.2, y - r * 0.36);
    ctx.moveTo(x + r * 0.42, y - r * 0.3);
    ctx.lineTo(x + r * 0.2, y - r * 0.36);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x, y + r * 0.15, r * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
}

/* ---------------- 塔 ---------------- */

/** 已种下的植物底座:小土丘 + 两片叶子,让"这是种在土里的植物"一目了然。 */
export function drawTowerBase(ctx: Ctx, tx: number, ty: number, r: number): void {
  ctx.fillStyle = "rgba(58,58,74,0.12)";
  ctx.beginPath();
  ctx.ellipse(tx, ty + r * 1.15, r * 1.05, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b98c62";
  ctx.beginPath();
  ctx.ellipse(tx, ty + r * 1.05, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a3764e";
  ctx.beginPath();
  ctx.ellipse(tx, ty + r * 1.02, r * 0.62, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // 两片小叶子
  ctx.fillStyle = "#8fd8a8";
  ctx.beginPath();
  ctx.ellipse(tx - r * 0.72, ty + r * 0.88, r * 0.3, r * 0.14, -0.6, 0, Math.PI * 2);
  ctx.ellipse(tx + r * 0.72, ty + r * 0.88, r * 0.3, r * 0.14, 0.6, 0, Math.PI * 2);
  ctx.fill();
}

/** 升级的体型加成:1 级原样,2 级 ×1.08,3 级 ×1.15(只是视觉,不碰射程)。 */
export function towerLevelScale(level: number): number {
  if (level >= 3) return 1.15;
  if (level >= 2) return 1.08;
  return 1;
}

/** 2 级银叶环 / 3 级金叶环:围着底座的一圈小叶饰,升没升级一眼看出来。 */
export function drawLevelRing(ctx: Ctx, tx: number, ty: number, r: number, level: number): void {
  if (level < 2) return;
  const gold = level >= 3;
  const leaves = gold ? 8 : 6;
  ctx.save();
  ctx.fillStyle = gold ? "#f2c24e" : "#c8ccd8";
  ctx.strokeStyle = gold ? "#d8a02e" : "#9aa2b8";
  ctx.lineWidth = Math.max(1, r * 0.05);
  for (let i = 0; i < leaves; i++) {
    const a = (Math.PI * 2 * i) / leaves;
    const lx = tx + Math.cos(a) * r * 1.05;
    const ly = ty + r * 0.98 + Math.sin(a) * r * 0.3;
    ctx.beginPath();
    ctx.ellipse(lx, ly, r * 0.18, r * 0.09, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** 金渐变五角星 / 灰空星(地图星级与结算星共用同一规格)。 */
export function drawGoldStar(ctx: Ctx, x: number, y: number, r: number, filled: boolean, rot = 0): void {
  ctx.save();
  if (filled) {
    const grad = ctx.createLinearGradient(x, y - r, x, y + r);
    grad.addColorStop(0, "#ffe9a8");
    grad.addColorStop(1, "#f2b93e");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "#d8952e";
  } else {
    ctx.fillStyle = "#e8e8ee";
    ctx.strokeStyle = "#b8b8c2";
  }
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = (Math.PI * 2 * k) / 5 - Math.PI / 2 + rot;
    const a2 = a + Math.PI / 5;
    if (k === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a2) * r * 0.46, y + Math.sin(a2) * r * 0.46);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (filled) {
    // 一点高光,金子才亮
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.3, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 塔的图标。level 带来饰环 + 体型差,anim(1→0)带来后坐 + 发射白闪,
 * reduced=true 时白闪与后坐全关(弱动效口径:关掉「晃」,不关掉造型)。
 */
export function drawTowerIcon(
  ctx: Ctx,
  kind: TowerKind,
  tx: number,
  ty0: number,
  r0: number,
  level = 1,
  anim = 0,
  reduced = false,
): void {
  const r = r0 * towerLevelScale(level);
  // 发射后坐:身体往下一沉再弹回来,最多 2px
  const ty = ty0 + (reduced ? 0 : anim * anim * 2);
  ctx.save();
  ctx.lineJoin = "round";
  drawLevelRing(ctx, tx, ty0, r0, level);
  if (kind === "bubble") {
    const squish = 1 + anim * 0.15;
    ctx.fillStyle = "#fff7f0";
    ctx.strokeStyle = "#e8b8c8";
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.ellipse(tx, ty + r * 0.35, r * 0.55, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const bodyGrad = ctx.createRadialGradient(tx - r * 0.3, ty - r * 0.5, r * 0.1, tx, ty - r * 0.25, r * 1.1);
    bodyGrad.addColorStop(0, "#ffc3d4");
    bodyGrad.addColorStop(1, "#ff8aa8");
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = "#e87a9a";
    ctx.beginPath();
    ctx.ellipse(tx, ty - r * 0.25, r * squish, r * 0.75 * squish, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const [dx2, dy2] of [
      [-0.45, -0.3],
      [0.35, -0.5],
      [0.1, 0.05],
    ]) {
      ctx.beginPath();
      ctx.arc(tx + dx2 * r, ty - r * 0.25 + dy2 * r, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
    // 吐泡瞬间嘴巴张成 O 形
    drawFace(ctx, tx, ty + r * 0.4, r * 0.55, true, anim > 0.45 ? "o" : "happy");
  } else if (kind === "needle") {
    ctx.strokeStyle = "#5aa878";
    ctx.lineWidth = Math.max(1.5, r * 0.11);
    ctx.lineCap = "round";
    const spikes = 6;
    for (let i = 0; i < spikes; i++) {
      const a = (Math.PI * 2 * i) / spikes + anim * 0.5;
      ctx.beginPath();
      ctx.moveTo(tx + Math.cos(a) * r * 0.62, ty + Math.sin(a) * r * 0.8);
      ctx.lineTo(tx + Math.cos(a) * r * (0.9 + anim * 0.2), ty + Math.sin(a) * r * (1.1 + anim * 0.2));
      ctx.stroke();
    }
    const cactusGrad = ctx.createLinearGradient(tx, ty - r, tx, ty + r);
    cactusGrad.addColorStop(0, "#a8e8bc");
    cactusGrad.addColorStop(1, "#76c894");
    ctx.fillStyle = cactusGrad;
    ctx.strokeStyle = "#4e9a6a";
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.ellipse(tx, ty, r * 0.62, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 仙人掌花
    ctx.fillStyle = "#ffb3c8";
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(tx + Math.cos(a) * r * 0.18, ty - r * 0.85 + Math.sin(a) * r * 0.18, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffe387";
    ctx.beginPath();
    ctx.arc(tx, ty - r * 0.85, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    drawFace(ctx, tx, ty, r * 0.55);
  } else if (kind === "dew") {
    const dewGrad = ctx.createLinearGradient(tx, ty - r, tx, ty + r);
    dewGrad.addColorStop(0, "#c8ecfc");
    dewGrad.addColorStop(1, "#7ec4ea");
    ctx.fillStyle = dewGrad;
    ctx.strokeStyle = "#5aa0cc";
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(tx, ty - r * 0.95);
    ctx.quadraticCurveTo(tx + r * 0.75, ty - r * 0.05, tx + r * 0.6, ty + r * 0.4);
    ctx.arc(tx, ty + r * 0.28, r * 0.62, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.quadraticCurveTo(tx - r * 0.75, ty - r * 0.05, tx, ty - r * 0.95);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.ellipse(tx - r * 0.24, ty - r * 0.1, r * 0.12, r * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fill();
    drawFace(ctx, tx, ty + r * 0.25, r * 0.5);
  } else if (kind === "sunny") {
    // 阳光花:黄色花瓣圈
    ctx.fillStyle = "#ffe387";
    ctx.strokeStyle = "#f2c24e";
    ctx.lineWidth = Math.max(1, r * 0.06);
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + anim * 0.4;
      ctx.beginPath();
      ctx.ellipse(tx + Math.cos(a) * r * 0.62, ty + Math.sin(a) * r * 0.62, r * 0.3, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const coreGrad = ctx.createRadialGradient(tx - r * 0.15, ty - r * 0.15, r * 0.05, tx, ty, r * 0.7);
    coreGrad.addColorStop(0, "#ffe9a8");
    coreGrad.addColorStop(1, "#ffc94e");
    ctx.fillStyle = coreGrad;
    ctx.strokeStyle = "#e8a830";
    ctx.beginPath();
    ctx.arc(tx, ty, r * (0.55 + anim * 0.1), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawFace(ctx, tx, ty, r * 0.5);
  } else if (kind === "frost") {
    // 冰晶塔:六角小冰花
    ctx.strokeStyle = "#8ac8ea";
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * i) / 3 + anim * 0.4;
      ctx.beginPath();
      ctx.moveTo(tx, ty - r * 0.1);
      ctx.lineTo(tx + Math.cos(a) * r * 0.9, ty - r * 0.1 + Math.sin(a) * r * 0.9);
      ctx.stroke();
    }
    const iceGrad = ctx.createRadialGradient(tx - r * 0.2, ty - r * 0.35, r * 0.1, tx, ty - r * 0.1, r * 0.9);
    iceGrad.addColorStop(0, "#eaf8ff");
    iceGrad.addColorStop(1, "#a8dcf2");
    ctx.fillStyle = iceGrad;
    ctx.strokeStyle = "#6ab0d8";
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(tx, ty - r * 0.85);
    for (let i = 1; i <= 6; i++) {
      const a = (Math.PI * i) / 3 - Math.PI / 2;
      ctx.lineTo(tx + Math.cos(a) * r * 0.62, ty - r * 0.1 + Math.sin(a) * r * 0.75);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawFace(ctx, tx, ty + r * 0.05, r * 0.5);
  } else if (kind === "mist") {
    // 毒雾塔:胖蘑菇喷雾壶
    ctx.fillStyle = `rgba(181,216,168,${0.35 + anim * 0.3})`;
    for (let i = 0; i < 3; i++) {
      const a = (Math.PI * 2 * i) / 3 + anim * 2;
      ctx.beginPath();
      ctx.arc(tx + Math.cos(a) * r * (0.7 + anim * 0.4), ty - r * 0.6 + Math.sin(a) * r * 0.3, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
    const potGrad2 = ctx.createLinearGradient(tx, ty - r * 0.2, tx, ty + r * 0.8);
    potGrad2.addColorStop(0, "#cfe8c0");
    potGrad2.addColorStop(1, "#96c888");
    ctx.fillStyle = potGrad2;
    ctx.strokeStyle = "#6aa85e";
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.ellipse(tx, ty + r * 0.25, r * 0.6, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 蘑菇帽
    ctx.fillStyle = "#a884d8";
    ctx.strokeStyle = "#8a68b8";
    ctx.beginPath();
    ctx.arc(tx, ty - r * 0.25, r * 0.62, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(tx - r * 0.28, ty - r * 0.45, r * 0.12, 0, Math.PI * 2);
    ctx.arc(tx + r * 0.2, ty - r * 0.55, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    drawFace(ctx, tx, ty + r * 0.3, r * 0.45);
  } else if (kind === "chime") {
    // 铃兰铃:1.2 里它掉进了花火塔的 else 分支,俩塔长得一模一样——
    // 支援塔连自己的脸都没有,这回给它一根弯茎两朵白铃铛。
    const moundGrad = ctx.createLinearGradient(tx, ty - r * 0.3, tx, ty + r * 0.85);
    moundGrad.addColorStop(0, "#d8f0c8");
    moundGrad.addColorStop(1, "#a0d090");
    ctx.fillStyle = moundGrad;
    ctx.strokeStyle = "#6aa85e";
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.ellipse(tx, ty + r * 0.3, r * 0.62, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 弯茎
    ctx.strokeStyle = "#5a9a52";
    ctx.lineWidth = Math.max(1.5, r * 0.1);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tx - r * 0.1, ty + r * 0.05);
    ctx.quadraticCurveTo(tx - r * 0.05, ty - r * 0.9, tx + r * 0.55, ty - r * 0.85);
    ctx.stroke();
    // 两朵下垂的白铃铛 + 小铃芯
    for (const [bx, by] of [
      [0.18, -0.55],
      [0.62, -0.62],
    ]) {
      const cx = tx + bx * r;
      const cy = ty + by * r;
      ctx.fillStyle = "#fbfbff";
      ctx.strokeStyle = "#c8cce0";
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.2, cy);
      ctx.quadraticCurveTo(cx, cy - r * 0.34, cx + r * 0.2, cy);
      ctx.quadraticCurveTo(cx + r * 0.24, cy + r * 0.22, cx + r * 0.12, cy + r * 0.24);
      ctx.quadraticCurveTo(cx, cy + r * 0.14, cx - r * 0.12, cy + r * 0.24);
      ctx.quadraticCurveTo(cx - r * 0.24, cy + r * 0.22, cx - r * 0.2, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffe387";
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.26, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    drawFace(ctx, tx, ty + r * 0.32, r * 0.45);
  } else {
    // 花火果:圆滚滚的小果子炮
    const potGrad = ctx.createLinearGradient(tx, ty - r * 0.2, tx, ty + r * 0.75);
    potGrad.addColorStop(0, "#ffd0ae");
    potGrad.addColorStop(1, "#f2a878");
    ctx.fillStyle = potGrad;
    ctx.strokeStyle = "#d88a58";
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.ellipse(tx, ty + r * 0.25, r * 0.62, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e8926a";
    ctx.strokeStyle = "#c8744e";
    ctx.beginPath();
    ctx.ellipse(tx + r * 0.1, ty - r * 0.4, r * 0.3, r * 0.5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 引信小火花
    ctx.fillStyle = "#ffd868";
    ctx.beginPath();
    ctx.arc(tx + r * (0.35 + anim * 0.3), ty - r * (0.75 + anim * 0.3), r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff9a4e";
    ctx.beginPath();
    ctx.arc(tx + r * (0.35 + anim * 0.3), ty - r * (0.75 + anim * 0.3), r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    drawFace(ctx, tx, ty + r * 0.25, r * 0.5);
  }
  // 发射白闪:峰值那一小段冒一圈白光,弱动效关掉
  if (!reduced && anim > 0.82) {
    const k = (anim - 0.82) / 0.18;
    ctx.fillStyle = `rgba(255,255,255,${(0.55 * k).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(tx, ty - r * 0.55, r * (1.35 - anim * 0.35), 0, Math.PI * 2);
    ctx.fill();
  }
  // 3 级头顶小金星(和地图星同一规格)
  if (level >= 3) drawGoldStar(ctx, tx, ty0 - r0 * 1.5, r0 * 0.24, true);
  ctx.restore();
}

/* ---------------- 怪物 ---------------- */

export const MONSTER_COLORS: Record<MonsterKind, string> = {
  softy: "#c9b6f2",
  fasty: "#9fd8f5",
  tanky: "#ffc09b",
  dashy: "#ffd868",
  shieldy: "#b8c8d8",
  splity: "#b5e8a8",
  sneaky: "#d8c8f0",
  healy: "#f5d8e8",
  mini: "#d5c9f5",
  boss1: "#ff9eb5",
  boss2: "#f0a878",
  boss3: "#c9a86a",
  boss4: "#e8c060",
  boss5: "#8aa86a",
  boss6: "#a8c8f0",
  boss7: "#e87a5a",
  boss8: "#9a8ac9",
  boss9: "#f078b0",
  flappy: "#a8d8e8",
  glidey: "#e8e2f5",
  boss10: "#8a9ae0",
  boss11: "#c9985a",
  boss12: "#9ec8ea",
  boss13: "#b06ad8",
  bossArmor: "#8fa8bc",
  bossSwift: "#7ec8e0",
  bossFly: "#c8dcf5",
  bossSplit: "#e8909a",
};

/**
 * 心形光环:两圆 + 一个三角拼成的心,替代 1.2 直接贴的 "💗" emoji。
 * phase 0→1 是一轮向外扩散(0.6s 循环);弱动效时传固定值,静止不闪。
 */
export function drawHealHalo(ctx: Ctx, x: number, y: number, r: number, phase: number): void {
  const heart = (s: number, alpha: number, color: string): void => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x - r * 0.36 * s, y - r * 0.16 * s, r * 0.4 * s, 0, Math.PI * 2);
    ctx.arc(x + r * 0.36 * s, y - r * 0.16 * s, r * 0.4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.72 * s, y + r * 0.02 * s);
    ctx.lineTo(x + r * 0.72 * s, y + r * 0.02 * s);
    ctx.lineTo(x, y + r * 0.88 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  // 外圈扩散光环 + 中心实心小心
  heart(0.8 + phase * 0.75, Math.max(0.08, 0.7 - phase * 0.62), "#ffb3c8");
  heart(0.68, 0.95, "#ff8aa8");
}

/**
 * BOSS 家族剪影配饰(r2 修复 B档TOP10):皇冠只回答「是不是 BOSS」,
 * 分家靠轮廓外配饰——铁壳系肩甲护板 / 疾风系后掠速度羽 / 浮云系身下云座 / 双生系分裂环。
 * 十三章 BOSS 按最近原型套用:飞行优先(云座跟着飘),再分裂,再护甲,冲刺/暴走/隐身归疾风;
 * 大软软与泥泥大王保持净版(后者已有回血光环)。纯查表,方便测试逐一钉住。
 */
export type BossTrim = "plate" | "feather" | "cloud" | "ring" | "none";

export function bossTrimOf(kind: MonsterKind): BossTrim {
  const spec = MONSTER_INFO[kind];
  if (!spec.boss) return "none";
  if (spec.flies) return "cloud";
  if (spec.splits) return "ring";
  if (spec.armor > 0) return "plate";
  if (spec.dashes || spec.enrages || spec.sneaks) return "feather";
  return "none";
}

/** 怪物的一帧视觉状态:全是数字与布尔,拼好了交给 drawMonsterSprite。 */
export interface MonsterVisual {
  kind: MonsterKind;
  /** 像素坐标(贴地中心) */
  x: number;
  y: number;
  /** 像素半径 */
  r: number;
  wob: number;
  hidden: boolean;
  flying: boolean;
  dashing: boolean;
  enraged: boolean;
  slowed: boolean;
  armor: number;
  maxArmor: number;
  /** 元气比例 0..1 */
  hpRatio: number;
  /** 受击白闪强度 0..1(弱动效传 0) */
  hurtFlash: number;
  /** 回血怪心形光环相位 0..1(弱动效传固定值) */
  healPhase: number;
  /** 走路相位(弱动效传 0 = 双脚站定) */
  walk: number;
  /** 画不画元气条(波次预览的缩略图不需要,默认画) */
  bar?: boolean;
}

export function drawMonsterSprite(ctx: Ctx, v: MonsterVisual): void {
  const spec = MONSTER_INFO[v.kind];
  const r = v.r;
  const mx = v.x;
  // 飞怪浮在半空:身体抬高,影子留在地面且更小
  const lift = v.flying ? r * 0.85 + Math.sin(v.wob * 1.4) * r * 0.12 : 0;
  const my = v.y - lift;
  const sq = 1 + Math.sin(v.wob) * 0.08;
  ctx.save();
  if (v.hidden) ctx.globalAlpha = 0.22;
  // 脚下软阴影
  ctx.fillStyle = v.flying ? "rgba(58,58,74,0.1)" : "rgba(58,58,74,0.14)";
  ctx.beginPath();
  ctx.ellipse(mx, v.y + r * 1.02, r * (v.flying ? 0.55 : 0.9), r * (v.flying ? 0.16 : 0.26), 0, 0, Math.PI * 2);
  ctx.fill();
  // 走路小脚:两粒脚点交替抬起(相位差 π);飞怪的脚安静下垂
  ctx.fillStyle = "rgba(58,58,74,0.35)";
  const stepA = v.flying ? 0 : Math.max(0, Math.sin(v.walk)) * r * 0.15;
  const stepB = v.flying ? 0 : Math.max(0, Math.sin(v.walk + Math.PI)) * r * 0.15;
  ctx.beginPath();
  ctx.arc(mx - r * 0.4, my + r * 0.9 - stepA, r * 0.16, 0, Math.PI * 2);
  ctx.arc(mx + r * 0.4, my + r * 0.9 - stepB, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  const bodyColor = v.enraged ? "#7aa8e8" : MONSTER_COLORS[v.kind];
  // BOSS 配饰配色:本体色加深约 30%,同族同色系,不抢识别色
  const trim = bossTrimOf(v.kind);
  const trimColor = shade(MONSTER_COLORS[v.kind], -77);
  if (trim === "feather") {
    // 疾风系:背后三根后掠速度羽(长在轮廓外,一条 path 三片羽叶)
    ctx.fillStyle = trimColor;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const fy = my - r * (0.45 - i * 0.35);
      const fl = r * (1.05 - i * 0.18);
      ctx.moveTo(mx - r * 0.55, fy);
      ctx.quadraticCurveTo(mx - r * 0.55 - fl, fy - r * 0.34, mx - r * 0.55 - fl * 1.25, fy - r * 0.05);
      ctx.quadraticCurveTo(mx - r * 0.55 - fl * 0.55, fy + r * 0.16, mx - r * 0.55, fy + r * 0.14);
    }
    ctx.fill();
  } else if (trim === "cloud") {
    // 浮云系:身下一朵小云座(三个圆拱,飞行抬升时跟着身体飘)
    ctx.fillStyle = trimColor;
    ctx.beginPath();
    ctx.arc(mx - r * 0.62, my + r * 0.78, r * 0.34, 0, Math.PI * 2);
    ctx.arc(mx, my + r * 0.92, r * 0.44, 0, Math.PI * 2);
    ctx.arc(mx + r * 0.62, my + r * 0.78, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }
  const bodyGrad = ctx.createRadialGradient(mx - r * 0.35, my - r * 0.4, r * 0.15, mx, my, r * 1.25);
  bodyGrad.addColorStop(0, shade(bodyColor, 26));
  bodyGrad.addColorStop(1, bodyColor);
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = shade(bodyColor, -46);
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  ctx.beginPath();
  ctx.ellipse(mx, my, r * sq, r / sq, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (v.kind === "fasty" || v.kind === "sneaky" || v.flying) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    const flap = Math.sin(v.wob * (v.flying ? 3 : 2)) * r * (v.flying ? 0.42 : 0.3);
    const wingW = v.flying ? r * 0.6 : r * 0.45;
    ctx.beginPath();
    ctx.ellipse(mx - r * 0.9, my - r * 0.3 - flap, wingW, r * 0.22, -0.5, 0, Math.PI * 2);
    ctx.ellipse(mx + r * 0.9, my - r * 0.3 + flap, wingW, r * 0.22, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (v.kind === "tanky") {
    ctx.fillStyle = "#e8a878";
    ctx.beginPath();
    ctx.arc(mx, my - r * 0.55, r * 0.6, Math.PI, 0);
    ctx.fill();
  }
  if (v.kind === "dashy" && v.dashing) {
    ctx.strokeStyle = "rgba(255,216,104,0.8)";
    ctx.lineWidth = 3;
    for (let k = 1; k <= 2; k++) {
      ctx.beginPath();
      ctx.arc(mx - k * r * 0.9, my, r * 0.7, -0.6, 0.6);
      ctx.stroke();
    }
  }
  if (v.maxArmor > 0 && v.armor > 0) {
    ctx.fillStyle = "rgba(150,170,190,0.9)";
    ctx.beginPath();
    ctx.arc(mx, my - r * 0.2, r * 1.05, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = "#7a90a8";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // 回血怪:头顶心形光环(绘制资产,不再是 emoji)
  if (spec.heals) drawHealHalo(ctx, mx, my - r * 1.25, r * 0.5, v.healPhase);
  if (v.kind === "splity") {
    // 两个小圆点表示会分身
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(mx - r * 0.4, my - r * 0.75, r * 0.2, 0, Math.PI * 2);
    ctx.arc(mx + r * 0.4, my - r * 0.75, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (spec.boss) {
    ctx.fillStyle = "#ffd868";
    ctx.beginPath();
    ctx.moveTo(mx - r * 0.4, my - r * 0.95);
    ctx.lineTo(mx - r * 0.2, my - r * 1.35);
    ctx.lineTo(mx, my - r * 1.0);
    ctx.lineTo(mx + r * 0.2, my - r * 1.35);
    ctx.lineTo(mx + r * 0.4, my - r * 0.95);
    ctx.closePath();
    ctx.fill();
    if (v.kind === "boss2") {
      // 蟹蟹钳子
      ctx.strokeStyle = "#d0885a";
      ctx.lineWidth = Math.max(2, r * 0.14);
      ctx.beginPath();
      ctx.arc(mx - r * 1.15, my - r * 0.1, r * 0.3, 0.4, Math.PI * 1.6);
      ctx.arc(mx + r * 1.15, my - r * 0.1, r * 0.3, Math.PI * 1.4, Math.PI * 0.6);
      ctx.stroke();
    }
    if (trim === "plate") {
      // 铁壳系:肩上两块铆钉护板(圆角矩形 ×2,伸出身体轮廓)
      ctx.fillStyle = trimColor;
      ctx.strokeStyle = shade(MONSTER_COLORS[v.kind], -110);
      ctx.lineWidth = Math.max(1, r * 0.06);
      const pw = r * 0.66;
      const ph = r * 0.42;
      ctx.beginPath();
      ctx.roundRect(mx - r * 1.18, my - r * 0.78, pw, ph, r * 0.12);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(mx + r * 1.18 - pw, my - r * 0.78, pw, ph, r * 0.12);
      ctx.fill();
      ctx.stroke();
      // 每块一粒圆钉
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(mx - r * 0.85, my - r * 0.57, r * 0.07, 0, Math.PI * 2);
      ctx.arc(mx + r * 0.85, my - r * 0.57, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
    } else if (trim === "ring") {
      // 双生系:腰间一圈双色分裂环(虚线圆,略宽于本体,两侧伸出剪影)
      ctx.setLineDash([r * 0.3, r * 0.22]);
      ctx.lineWidth = Math.max(2, r * 0.13);
      ctx.strokeStyle = trimColor;
      ctx.beginPath();
      ctx.ellipse(mx, my + r * 0.28, r * 1.18, r * 0.34, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineDashOffset = r * 0.3;
      ctx.beginPath();
      ctx.ellipse(mx, my + r * 0.28, r * 1.18, r * 0.34, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
  }
  if (v.slowed) {
    ctx.fillStyle = "rgba(160,220,255,0.5)";
    ctx.beginPath();
    ctx.arc(mx + r * 0.7, my - r * 0.8, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  drawFace(ctx, mx, my, r);
  // 受击白闪:整只泛白一瞬,配合弹开表示「被弹了一下」;弱动效关闪
  if (v.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(0.6 * v.hurtFlash).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(mx, my, r * sq, r / sq, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (v.bar === false) {
    ctx.restore();
    return;
  }
  // 元气条(带硬壳段)。这不是血条:掉光了不是倒下,是没劲了、散成花瓣回家。
  // 所以配色一路走暖色,满是嫩绿、少是暖橙,任何时候都不出现红。
  const bw = r * 2.2;
  const bh = Math.max(3, r * 0.16);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.roundRect(mx - bw / 2, my - r * 1.55, bw, bh, 3);
  ctx.fill();
  ctx.fillStyle = energyColor(v.hpRatio);
  ctx.beginPath();
  ctx.roundRect(mx - bw / 2, my - r * 1.55, bw * Math.max(0, Math.min(1, v.hpRatio)), bh, 3);
  ctx.fill();
  if (v.maxArmor > 0) {
    ctx.fillStyle = "#8aa0b8";
    ctx.beginPath();
    ctx.roundRect(mx - bw / 2, my - r * 1.55 - bh - 1, (bw * v.armor) / v.maxArmor, bh * 0.8, 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ---------------- 战场地块 ---------------- */

/**
 * 地块装饰:棋盘格上按坐标种子长 0–2 株小草叶,约 8% 的格子再放一件
 * 小装饰(小花 / 石头 / 双石 / 嫩芽)。种子确定,不随帧闪。
 */
export function drawTileGrass(ctx: Ctx, x: number, y: number, cellSize: number, seed: number, tone: string): void {
  const n = seed % 3;
  if (n === 0) return;
  ctx.save();
  ctx.strokeStyle = tone;
  ctx.lineWidth = Math.max(1, cellSize * 0.03);
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const gx = x + cellSize * (0.16 + (((seed >>> (3 + i * 5)) & 31) / 31) * 0.68);
    const gy = y + cellSize * (0.24 + (((seed >>> (7 + i * 5)) & 31) / 31) * 0.6);
    const hgt = cellSize * 0.11;
    const lean = ((seed >>> i) & 1) === 1 ? 1 : -1;
    // 两笔弧线 = 一株小草
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.quadraticCurveTo(gx - hgt * 0.4 * lean, gy - hgt * 0.7, gx - hgt * 0.7 * lean, gy - hgt);
    ctx.moveTo(gx + hgt * 0.25 * lean, gy);
    ctx.quadraticCurveTo(gx + hgt * 0.5 * lean, gy - hgt * 0.6, gx + hgt * 0.9 * lean, gy - hgt * 0.85);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTileDoodad(ctx: Ctx, x: number, y: number, cellSize: number, seed: number, accent: string): void {
  if (seed % 100 >= 8) return;
  const kind = (seed >>> 5) % 4;
  const cx = x + cellSize * (0.3 + (((seed >>> 9) & 7) / 7) * 0.4);
  const cy = y + cellSize * (0.3 + (((seed >>> 12) & 7) / 7) * 0.4);
  ctx.save();
  if (kind === 0) {
    // 小花:五瓣 + 主题色花芯
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * cellSize * 0.05, cy + Math.sin(a) * cellSize * 0.05, cellSize * 0.038, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.032, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 1) {
    // 小石头:灰椭圆 + 高光
    ctx.fillStyle = "rgba(150,150,164,0.55)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, cellSize * 0.08, cellSize * 0.055, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(cx - cellSize * 0.03, cy - cellSize * 0.02, cellSize * 0.02, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 2) {
    // 双石:一大一小
    ctx.fillStyle = "rgba(150,150,164,0.45)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, cellSize * 0.06, cellSize * 0.045, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + cellSize * 0.09, cy + cellSize * 0.02, cellSize * 0.035, cellSize * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 嫩芽:两片对生小叶
    ctx.fillStyle = "rgba(122,201,122,0.7)";
    ctx.beginPath();
    ctx.ellipse(cx - cellSize * 0.035, cy, cellSize * 0.05, cellSize * 0.024, -0.7, 0, Math.PI * 2);
    ctx.ellipse(cx + cellSize * 0.035, cy, cellSize * 0.05, cellSize * 0.024, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 一格地块的全部装饰(index 只管每格调一次)。 */
export function drawTileDecor(
  ctx: Ctx,
  col: number,
  row: number,
  x: number,
  y: number,
  cellSize: number,
  accent: string,
): void {
  const seed = tileHash(col, row);
  drawTileGrass(ctx, x, y, cellSize, seed, "rgba(106,168,94,0.45)");
  drawTileDoodad(ctx, x, y, cellSize, seed, accent);
}

/** 藤蔓拱门:双柱 + 弧顶 + 叶子,替代 1.2 的一块紫色半圆「门」。 */
export function drawVineArch(ctx: Ctx, x: number, y: number, cellSize: number): void {
  const r = cellSize * 0.36;
  ctx.save();
  // 门洞:一片安静的阴影,怪从这里出场
  ctx.fillStyle = "rgba(58,58,74,0.18)";
  ctx.beginPath();
  ctx.arc(x, y + r * 0.5, r * 0.72, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // 双柱
  ctx.fillStyle = "#7ab86a";
  ctx.strokeStyle = "#5a9a52";
  ctx.lineWidth = Math.max(1, r * 0.08);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(x + side * r * 0.78 - r * 0.14, y - r * 0.35, r * 0.28, r * 0.95, r * 0.1);
    ctx.fill();
    ctx.stroke();
  }
  // 弧顶
  ctx.strokeStyle = "#7ab86a";
  ctx.lineWidth = r * 0.26;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y - r * 0.3, r * 0.8, Math.PI, 0);
  ctx.stroke();
  // 拱肩两片叶 + 顶上一片
  ctx.fillStyle = "#8fd8a8";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.85, y - r * 0.55, r * 0.22, r * 0.11, -0.7, 0, Math.PI * 2);
  ctx.ellipse(x + r * 0.85, y - r * 0.55, r * 0.22, r * 0.11, 0.7, 0, Math.PI * 2);
  ctx.ellipse(x, y - r * 1.18, r * 0.2, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 终点花朵的心情:满心笑、掉了一半担忧、只剩 1 颗心哭哭(表情查表挂在 hearts 上)。 */
export function goalMood(hearts: number, maxHearts: number): FaceMood {
  if (hearts <= 1) return "sad";
  if (hearts <= Math.ceil(maxHearts / 2)) return "worried";
  return "happy";
}

/** 路障木箱:圆角箱体 + 交叉加固条 + 两道浅色木纹 + 耐久点。 */
export function drawBarricade(ctx: Ctx, x: number, y: number, cellSize: number, hp: number): void {
  const s = cellSize * 0.33;
  ctx.save();
  ctx.fillStyle = "#c9a86a";
  ctx.strokeStyle = "#9a7a44";
  ctx.lineWidth = Math.max(1.5, cellSize * 0.035);
  ctx.beginPath();
  ctx.roundRect(x - s, y - s, s * 2, s * 2, cellSize * 0.08);
  ctx.fill();
  ctx.stroke();
  // 木纹:两道顺纹浅弧线,箱子才像木头不像纸壳
  ctx.strokeStyle = "rgba(255,246,222,0.5)";
  ctx.lineWidth = Math.max(1, cellSize * 0.02);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.8, y - s * 0.45);
  ctx.quadraticCurveTo(x, y - s * 0.28, x + s * 0.8, y - s * 0.5);
  ctx.moveTo(x - s * 0.8, y + s * 0.35);
  ctx.quadraticCurveTo(x + s * 0.1, y + s * 0.52, x + s * 0.8, y + s * 0.3);
  ctx.stroke();
  // 交叉加固条
  ctx.strokeStyle = "#9a7a44";
  ctx.lineWidth = Math.max(1.5, cellSize * 0.035);
  ctx.beginPath();
  ctx.moveTo(x - s, y - s);
  ctx.lineTo(x + s, y + s);
  ctx.moveTo(x + s, y - s);
  ctx.lineTo(x - s, y + s);
  ctx.stroke();
  // 耐久小点
  ctx.fillStyle = "#7a5a34";
  for (let i = 0; i < hp; i++) {
    ctx.beginPath();
    ctx.arc(x - s + cellSize * 0.09 + i * cellSize * 0.13, y + s - cellSize * 0.1, cellSize * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ---------------- 子弹 ---------------- */

export type BulletArtKind = "bubble" | "needle" | "boom" | "frost";

/**
 * 子弹分型:泡泡 = 半透明泡 + 双高光;针刺 = 旋转针 + 拖尾;
 * 花火 = 果子弹 + 引信火花;冰弹 = 六角小冰星(t 驱动旋转,弱动效传 0)。
 */
export function drawBullet(
  ctx: Ctx,
  kind: BulletArtKind,
  x: number,
  y: number,
  cellSize: number,
  angle = 0,
  t = 0,
): void {
  ctx.save();
  if (kind === "needle") {
    // 拖尾:身后两截渐淡的短线
    ctx.strokeStyle = "rgba(122,178,142,0.4)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(angle) * cellSize * 0.42, y - Math.sin(angle) * cellSize * 0.42);
    ctx.lineTo(x - Math.cos(angle) * cellSize * 0.18, y - Math.sin(angle) * cellSize * 0.18);
    ctx.stroke();
    ctx.strokeStyle = "#5aa878";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(angle) * cellSize * 0.14, y - Math.sin(angle) * cellSize * 0.14);
    ctx.lineTo(x + Math.cos(angle) * cellSize * 0.14, y + Math.sin(angle) * cellSize * 0.14);
    ctx.stroke();
  } else if (kind === "boom") {
    ctx.fillStyle = "#e8926a";
    ctx.beginPath();
    ctx.arc(x, y, cellSize * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffd868";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, cellSize * 0.2, t * 8, t * 8 + Math.PI);
    ctx.stroke();
  } else if (kind === "frost") {
    // 六角小冰星
    ctx.strokeStyle = "#9ad4f0";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * i) / 3 + t * 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * cellSize * 0.14, y + Math.sin(a) * cellSize * 0.14);
      ctx.stroke();
    }
    ctx.fillStyle = "#eaf8ff";
    ctx.beginPath();
    ctx.arc(x, y, cellSize * 0.05, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 泡泡:半透明 + 泡沿 + 双高光
    ctx.fillStyle = "rgba(191,233,255,0.55)";
    ctx.strokeStyle = "rgba(110,180,220,0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, cellSize * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(x - cellSize * 0.04, y - cellSize * 0.045, cellSize * 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.arc(x + cellSize * 0.03, y + cellSize * 0.04, cellSize * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ---------------- 关卡地图 ---------------- */

/** 挂锁:锁体 + 锁梁 + 锁孔,替代 "🔒"。 */
export function drawLockIcon(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  // 锁梁
  ctx.strokeStyle = "#8a8a98";
  ctx.lineWidth = Math.max(1.5, r * 0.2);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y - r * 0.12, r * 0.38, Math.PI, 0);
  ctx.stroke();
  // 锁体
  ctx.fillStyle = "#a8a8b6";
  ctx.strokeStyle = "#7a7a8a";
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.roundRect(x - r * 0.56, y - r * 0.14, r * 1.12, r * 0.85, r * 0.16);
  ctx.fill();
  ctx.stroke();
  // 锁孔
  ctx.fillStyle = "#5a5a6e";
  ctx.beginPath();
  ctx.arc(x, y + r * 0.16, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x - r * 0.05, y + r * 0.18, r * 0.1, r * 0.3, r * 0.05);
  ctx.fill();
  ctx.restore();
}

/** 三尖小王冠:BOSS 关标记,替代 "👑"。 */
export function drawCrownIcon(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  const grad = ctx.createLinearGradient(x, y - r * 0.6, x, y + r * 0.4);
  grad.addColorStop(0, "#ffe387");
  grad.addColorStop(1, "#f2b93e");
  ctx.fillStyle = grad;
  ctx.strokeStyle = "#d8952e";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - r * 0.62, y + r * 0.35);
  ctx.lineTo(x - r * 0.62, y - r * 0.2);
  ctx.lineTo(x - r * 0.3, y + r * 0.05);
  ctx.lineTo(x, y - r * 0.55);
  ctx.lineTo(x + r * 0.3, y + r * 0.05);
  ctx.lineTo(x + r * 0.62, y - r * 0.2);
  ctx.lineTo(x + r * 0.62, y + r * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 三颗尖上的小圆珠
  ctx.fillStyle = "#ff9eb5";
  for (const [dx, dy] of [
    [-0.62, -0.28],
    [0, -0.64],
    [0.62, -0.28],
  ]) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 交叉双剑:遭遇战标记,替代 "⚔"(圆头小剑,不尖锐)。 */
export function drawSwordsIcon(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  ctx.lineCap = "round";
  for (const dir of [-1, 1]) {
    // 剑身
    ctx.strokeStyle = "#b8c2d8";
    ctx.lineWidth = Math.max(1.5, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(x - dir * r * 0.5, y + r * 0.5);
    ctx.lineTo(x + dir * r * 0.45, y - r * 0.45);
    ctx.stroke();
    // 护手
    ctx.strokeStyle = "#c9a86a";
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(x - dir * r * 0.42, y + r * 0.16);
    ctx.lineTo(x - dir * r * 0.16, y + r * 0.42);
    ctx.stroke();
    // 圆头柄
    ctx.fillStyle = "#c9a86a";
    ctx.beginPath();
    ctx.arc(x - dir * r * 0.52, y + r * 0.52, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 地图连线改「小脚印路径」:沿线交替左右脚的小椭圆点。 */
export function drawFootprintTrail(ctx: Ctx, pts: ReadonlyArray<{ x: number; y: number }>, step: number, color: string): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.fillStyle = color;
  let side = 1;
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1].x;
    const ay = pts[i - 1].y;
    const bx = pts[i].x;
    const by = pts[i].y;
    const d = Math.hypot(bx - ax, by - ay);
    if (d < 1e-6) continue;
    const dirx = (bx - ax) / d;
    const diry = (by - ay) / d;
    const nx = -diry;
    const ny = dirx;
    const rot = Math.atan2(by - ay, bx - ax);
    for (let s = step * 0.8; s < d - step * 0.4; s += step) {
      const cx = ax + dirx * s + nx * side * 2.6;
      const cy = ay + diry * s + ny * side * 2.6;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 3.1, 1.9, rot, 0, Math.PI * 2);
      ctx.fill();
      side = -side;
    }
  }
  ctx.restore();
}

/** 章节地图节点的微装饰:花园章叶环 / 雪章雪帽 / 星章小星。 */
export type NodeDecor = "leaf" | "snowcap" | "sparkle" | "none";

export const NODE_DECOR: Record<ThemeId, NodeDecor> = {
  grass: "leaf",
  beach: "none",
  forest: "leaf",
  desert: "none",
  swamp: "leaf",
  snow: "snowcap",
  night: "sparkle",
  lava: "none",
  candy: "sparkle",
  dewhouse: "leaf",
  gearhouse: "none",
  cloudfarm: "snowcap",
  starcrown: "sparkle",
};

export function drawNodeDecor(ctx: Ctx, x: number, y: number, r: number, decor: NodeDecor): void {
  if (decor === "none") return;
  ctx.save();
  if (decor === "leaf") {
    ctx.fillStyle = "#8fd8a8";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.72, y - r * 0.78, r * 0.3, r * 0.14, -0.9, 0, Math.PI * 2);
    ctx.ellipse(x - r * 0.94, y - r * 0.5, r * 0.26, r * 0.12, -1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (decor === "snowcap") {
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(x, y - r * 0.55, r * 0.62, Math.PI * 1.1, Math.PI * 1.9);
    ctx.quadraticCurveTo(x, y - r * 0.7, x + r * 0.52, y - r * 0.88);
    ctx.closePath();
    ctx.fill();
  } else {
    drawGoldStar(ctx, x + r * 0.85, y - r * 0.85, r * 0.28, true, 0.3);
  }
  ctx.restore();
}

/** 地图底部的地平线剪影:树丛 / 沙丘 / 雪丘 / 星空 / 云朵,随主题查表。 */
export type HorizonKind = "trees" | "hills" | "snow" | "stars" | "clouds";

export const HORIZON_KIND: Record<ThemeId, HorizonKind> = {
  grass: "trees",
  beach: "hills",
  forest: "trees",
  desert: "hills",
  swamp: "trees",
  snow: "snow",
  night: "stars",
  lava: "hills",
  candy: "clouds",
  dewhouse: "trees",
  gearhouse: "hills",
  cloudfarm: "clouds",
  starcrown: "stars",
};

/* ---------------- r1 修复:画布 emoji 清零的手绘小图标 ---------------- */
/* 花瓣币(🌸)/灯泡(💡)/盾牌(🛡️)/地图卷轴(🗺️)/十三主题徽章(st.emoji)。   */
/* emoji 换台设备就变脸,这些统一按光源左上 45°、描边 1.5–2px 手绘。      */

/** 花瓣币:五片粉瓣 + 暖金花芯,替代 "🌸" 字符的通用货币图标。 */
export function drawPetalIcon(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const px = x + Math.cos(a) * r * 0.55;
    const py = y + Math.sin(a) * r * 0.55;
    const g = ctx.createRadialGradient(px - r * 0.14, py - r * 0.14, r * 0.06, px, py, r * 0.52);
    g.addColorStop(0, "#ffe0ec");
    g.addColorStop(1, "#f7a8c4");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#d87a9a";
    ctx.beginPath();
    ctx.ellipse(px, py, r * 0.4, r * 0.5, a + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  const cg = ctx.createRadialGradient(x - r * 0.1, y - r * 0.1, r * 0.05, x, y, r * 0.34);
  cg.addColorStop(0, "#ffeeb8");
  cg.addColorStop(1, "#f2b53a");
  ctx.fillStyle = cg;
  ctx.strokeStyle = "#c98a2a";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * 手绘爱心:替代 hud12 段串里的 💗/🤍 字符上画布(r2 修复 W4R1-01)。
 * filled=true 是还在的命(粉渐变+高光),false 是掉掉的命(灰粉空心,
 * 同结算面板既有的 #e9d8dd 系)。hud12 的契约字符串与宽度测量不动,
 * 只在绘制层把 emoji 槽位换成这枚图标。
 */
export function drawHeartIcon(ctx: Ctx, x: number, y: number, r: number, filled: boolean): void {
  ctx.save();
  const lobeR = r * 0.45;
  const cyTop = y - r * 0.6 + lobeR;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.62);
  ctx.quadraticCurveTo(x - r * 0.98, y + r * 0.02, x - lobeR * 2, cyTop);
  ctx.arc(x - lobeR, cyTop, lobeR, Math.PI, 0);
  ctx.arc(x + lobeR, cyTop, lobeR, Math.PI, 0);
  ctx.quadraticCurveTo(x + r * 0.98, y + r * 0.02, x, y + r * 0.62);
  ctx.closePath();
  if (filled) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.32, r * 0.12, x, y, r * 1.05);
    g.addColorStop(0, "#ffd9e4");
    g.addColorStop(1, "#ff7fa2");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#d4607e";
  } else {
    ctx.fillStyle = "#eee2e6";
    ctx.strokeStyle = "#c8b6bd";
  }
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
  if (filled) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.34, y - r * 0.26, r * 0.17, r * 0.11, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 小灯泡:暖光玻璃球 + 灯座 + 两道短光线,替代 "💡" 字符。 */
export function drawBulbIcon(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, "#fff6d0");
  g.addColorStop(1, "#ffd868");
  ctx.fillStyle = g;
  ctx.strokeStyle = "#c98a2a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.12, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#b8b8c2";
  ctx.beginPath();
  ctx.roundRect(x - r * 0.32, y + r * 0.5, r * 0.64, r * 0.42, r * 0.12);
  ctx.fill();
  ctx.strokeStyle = "#e0a030";
  ctx.lineWidth = 1.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + side * r * 0.95, y - r * 0.7);
    ctx.lineTo(x + side * r * 1.25, y - r * 0.95);
    ctx.stroke();
  }
  ctx.restore();
}

/** 小盾牌:蓝渐变盾身 + 左上高光弧 + 中央小星,替代 "🛡️" 字符。 */
export function drawShieldIcon(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, "#9ec8f0");
  g.addColorStop(1, "#4a7ac2");
  ctx.fillStyle = g;
  ctx.strokeStyle = "#2f5a96";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.95, y - r * 0.72, x + r * 0.8, y + r * 0.1);
  ctx.quadraticCurveTo(x + r * 0.62, y + r * 0.72, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.62, y + r * 0.72, x - r * 0.8, y + r * 0.1);
  ctx.quadraticCurveTo(x - r * 0.95, y - r * 0.72, x, y - r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x - r * 0.18, y - r * 0.18, r * 0.55, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  drawGoldStar(ctx, x, y + r * 0.02, r * 0.34, true);
  ctx.restore();
}

/** 地图小卷轴:米色纸面 + 两道卷边 + 一条虚线小路与终点圆点,替代 "🗺️"。 */
export function drawMapScrollIcon(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  const g = ctx.createLinearGradient(x, y - r, x, y + r);
  g.addColorStop(0, "#fdf3dc");
  g.addColorStop(1, "#f2dfb4");
  ctx.fillStyle = g;
  ctx.strokeStyle = "#c9a86a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - r, y - r * 0.78, r * 2, r * 1.56, r * 0.2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e0c890";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(x + side * r - (side > 0 ? r * 0.22 : 0), y - r * 0.78, r * 0.22, r * 1.56, r * 0.1);
    ctx.fill();
  }
  ctx.strokeStyle = "#c2456a";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([r * 0.22, r * 0.18]);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y + r * 0.42);
  ctx.quadraticCurveTo(x, y - r * 0.1, x + r * 0.45, y - r * 0.35);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#e05a7a";
  ctx.beginPath();
  ctx.arc(x + r * 0.45, y - r * 0.35, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 十三章主题徽章:每章一枚手绘小图,替代主题表里的 emoji 字符。
 * 造型只做辨识用(雏菊/日浪/蘑菇/仙人掌/青蛙/雪人/弯月/火山/糖果/晶石/齿轮/云朵/流星)。
 */
export function drawThemeBadge(ctx: Ctx, x: number, y: number, r: number, theme: ThemeId): void {
  ctx.save();
  ctx.lineWidth = 1.5;
  switch (theme) {
    case "grass": {
      // 雏菊:六片白瓣 + 黄芯
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6;
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#d8d8c2";
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * r * 0.52, y + Math.sin(a) * r * 0.52, r * 0.34, r * 0.46, a + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(x - r * 0.08, y - r * 0.08, r * 0.04, x, y, r * 0.34);
      g.addColorStop(0, "#ffeeb8");
      g.addColorStop(1, "#f2b53a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "beach": {
      // 海上小太阳:金圆 + 六道光线 + 两道波浪
      ctx.fillStyle = "#ffd868";
      ctx.strokeStyle = "#e0a030";
      ctx.beginPath();
      ctx.arc(x, y - r * 0.2, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#e0a030";
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI + (i * Math.PI) / 5;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.58, y - r * 0.2 + Math.sin(a) * r * 0.58);
        ctx.lineTo(x + Math.cos(a) * r * 0.82, y - r * 0.2 + Math.sin(a) * r * 0.82);
        ctx.stroke();
      }
      ctx.strokeStyle = "#4a9ac9";
      ctx.lineWidth = 2;
      for (const dy of [r * 0.5, r * 0.78]) {
        ctx.beginPath();
        ctx.moveTo(x - r * 0.8, y + dy);
        ctx.quadraticCurveTo(x - r * 0.4, y + dy - r * 0.22, x, y + dy);
        ctx.quadraticCurveTo(x + r * 0.4, y + dy + r * 0.22, x + r * 0.8, y + dy);
        ctx.stroke();
      }
      break;
    }
    case "forest": {
      // 小蘑菇:暖红伞盖 + 奶白菇柄 + 两粒白点
      ctx.fillStyle = "#fdf3dc";
      ctx.strokeStyle = "#c9a86a";
      ctx.beginPath();
      ctx.roundRect(x - r * 0.24, y, r * 0.48, r * 0.85, r * 0.18);
      ctx.fill();
      ctx.stroke();
      const g = ctx.createLinearGradient(x - r, y - r, x + r, y);
      g.addColorStop(0, "#f2917a");
      g.addColorStop(1, "#d84a4a");
      ctx.fillStyle = g;
      ctx.strokeStyle = "#a83a3a";
      ctx.beginPath();
      ctx.moveTo(x - r * 0.9, y + r * 0.05);
      ctx.quadraticCurveTo(x, y - r * 1.15, x + r * 0.9, y + r * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      for (const [dx, dy, pr] of [[-r * 0.38, -r * 0.3, r * 0.12], [r * 0.24, -r * 0.48, r * 0.15]]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, pr, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "desert": {
      // 仙人掌:绿柱 + 一只小侧臂 + 沙线
      ctx.strokeStyle = "#c98a3a";
      ctx.beginPath();
      ctx.moveTo(x - r * 0.9, y + r * 0.85);
      ctx.lineTo(x + r * 0.9, y + r * 0.85);
      ctx.stroke();
      const g = ctx.createLinearGradient(x - r * 0.3, y, x + r * 0.3, y);
      g.addColorStop(0, "#7ab86a");
      g.addColorStop(1, "#4a8a4a");
      ctx.fillStyle = g;
      ctx.strokeStyle = "#3a6a3a";
      ctx.beginPath();
      ctx.roundRect(x - r * 0.22, y - r * 0.85, r * 0.44, r * 1.7, r * 0.22);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(x + r * 0.18, y - r * 0.35, r * 0.5, r * 0.3, r * 0.15);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "swamp": {
      // 青蛙脸:绿圆脸 + 两粒鼓眼睛 + 弯弯笑
      ctx.fillStyle = "#7ab86a";
      ctx.strokeStyle = "#4a7a4a";
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.1, r * 0.85, r * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.fillStyle = "#7ab86a";
        ctx.beginPath();
        ctx.arc(x + side * r * 0.42, y - r * 0.5, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#3a3a4a";
        ctx.beginPath();
        ctx.arc(x + side * r * 0.42, y - r * 0.5, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#3a5a3a";
      ctx.beginPath();
      ctx.arc(x, y + r * 0.15, r * 0.35, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
    }
    case "snow": {
      // 雪人:两球叠雪 + 点点眼 + 橙鼻子
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#b8c8e0";
      ctx.beginPath();
      ctx.arc(x, y + r * 0.42, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - r * 0.35, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#3a3a4a";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x + side * r * 0.14, y - r * 0.42, r * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#f2913a";
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.3);
      ctx.lineTo(x + r * 0.3, y - r * 0.22);
      ctx.lineTo(x, y - r * 0.16);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "night": {
      // 弯月 + 一粒小星
      const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      g.addColorStop(0, "#ffeeb8");
      g.addColorStop(1, "#f2c53a");
      ctx.fillStyle = g;
      ctx.strokeStyle = "#c9a02a";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.72, Math.PI * 0.42, Math.PI * 1.58);
      ctx.quadraticCurveTo(x + r * 0.05, y, x - r * 0.12, y + r * 0.66);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      drawGoldStar(ctx, x + r * 0.5, y - r * 0.35, r * 0.22, true);
      break;
    }
    case "lava": {
      // 小火山:棕山体 + 顶口暖岩浆
      const g = ctx.createLinearGradient(x, y - r, x, y + r);
      g.addColorStop(0, "#a8764a");
      g.addColorStop(1, "#7a523a");
      ctx.fillStyle = g;
      ctx.strokeStyle = "#5a3a2a";
      ctx.beginPath();
      ctx.moveTo(x - r * 0.9, y + r * 0.8);
      ctx.lineTo(x - r * 0.32, y - r * 0.55);
      ctx.lineTo(x + r * 0.32, y - r * 0.55);
      ctx.lineTo(x + r * 0.9, y + r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f2913a";
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.55, r * 0.34, r * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd868";
      ctx.beginPath();
      ctx.arc(x, y - r * 0.85, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "candy": {
      // 糖果:粉球 + 两侧蝴蝶结糖纸 + 白色高光弧
      ctx.fillStyle = "#f7a8c4";
      ctx.strokeStyle = "#d84a8a";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + side * r * 0.42, y);
        ctx.lineTo(x + side * r * 0.95, y - r * 0.42);
        ctx.lineTo(x + side * r * 0.95, y + r * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(x - r * 0.16, y - r * 0.16, r * 0.08, x, y, r * 0.55);
      g.addColorStop(0, "#ffd6e8");
      g.addColorStop(1, "#f27aaa");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(x - r * 0.1, y - r * 0.1, r * 0.28, Math.PI * 1.1, Math.PI * 1.6);
      ctx.stroke();
      break;
    }
    case "dewhouse": {
      // 晶石:蓝菱形 + 内切面线
      const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      g.addColorStop(0, "#c8e0f7");
      g.addColorStop(1, "#5a8ac9");
      ctx.fillStyle = g;
      ctx.strokeStyle = "#3f6b9e";
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.9);
      ctx.lineTo(x + r * 0.68, y);
      ctx.lineTo(x, y + r * 0.9);
      ctx.lineTo(x - r * 0.68, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.moveTo(x - r * 0.34, y - r * 0.45);
      ctx.lineTo(x, y + r * 0.9);
      ctx.moveTo(x + r * 0.34, y - r * 0.45);
      ctx.lineTo(x, y + r * 0.9);
      ctx.stroke();
      break;
    }
    case "gearhouse": {
      // 齿轮:六颗方齿 + 圆身 + 中孔
      ctx.fillStyle = "#c9b48a";
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6;
        const tx = x + Math.cos(a) * r * 0.72;
        const ty = y + Math.sin(a) * r * 0.72;
        ctx.beginPath();
        ctx.roundRect(tx - r * 0.16, ty - r * 0.16, r * 0.32, r * 0.32, r * 0.06);
        ctx.fill();
      }
      const g = ctx.createRadialGradient(x - r * 0.15, y - r * 0.15, r * 0.1, x, y, r * 0.62);
      g.addColorStop(0, "#e0d0a8");
      g.addColorStop(1, "#a8763a");
      ctx.fillStyle = g;
      ctx.strokeStyle = "#7a5a2a";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fdf3dc";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "cloudfarm": {
      // 云朵:三团白泡 + 平底
      const g = ctx.createLinearGradient(x, y - r, x, y + r * 0.6);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#d8e8f7");
      ctx.fillStyle = g;
      ctx.strokeStyle = "#9ec0e0";
      ctx.beginPath();
      ctx.arc(x - r * 0.45, y + r * 0.1, r * 0.36, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(x - r * 0.05, y - r * 0.28, r * 0.44, Math.PI * 0.95, Math.PI * 1.98);
      ctx.arc(x + r * 0.45, y + r * 0.08, r * 0.38, Math.PI * 1.5, Math.PI * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    default: {
      // starcrown 流星:金星 + 两道尾光
      ctx.strokeStyle = "#f2c53a";
      ctx.lineWidth = 2;
      for (const dy of [-r * 0.16, r * 0.16]) {
        ctx.beginPath();
        ctx.moveTo(x - r * 0.95, y + dy - r * 0.3);
        ctx.lineTo(x - r * 0.1, y + dy - r * 0.05);
        ctx.stroke();
      }
      drawGoldStar(ctx, x + r * 0.34, y, r * 0.6, true);
      break;
    }
  }
  ctx.restore();
}

export function drawHorizonStrip(ctx: Ctx, w: number, yBase: number, hgt: number, kind: HorizonKind, color: string): void {
  ctx.save();
  if (kind === "stars") {
    // 星空:一条安静的深色带 + 几颗四芒小星
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = color;
    ctx.fillRect(0, yBase, w, hgt);
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 7; i++) {
      const sx = ((i * 149 + 40) % Math.max(1, Math.round(w - 20))) + 10;
      const sy = yBase + hgt * (0.2 + ((i * 53) % 5) * 0.14);
      const sr = 2.4 + (i % 3);
      ctx.fillStyle = "#ffe9a8";
      ctx.beginPath();
      ctx.moveTo(sx, sy - sr);
      ctx.quadraticCurveTo(sx + sr * 0.22, sy - sr * 0.22, sx + sr, sy);
      ctx.quadraticCurveTo(sx + sr * 0.22, sy + sr * 0.22, sx, sy + sr);
      ctx.quadraticCurveTo(sx - sr * 0.22, sy + sr * 0.22, sx - sr, sy);
      ctx.quadraticCurveTo(sx - sr * 0.22, sy - sr * 0.22, sx, sy - sr);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = color;
  const bumps = kind === "trees" ? Math.max(5, Math.round(w / 64)) : kind === "clouds" ? Math.max(4, Math.round(w / 90)) : 3;
  ctx.beginPath();
  ctx.moveTo(0, yBase + hgt);
  ctx.lineTo(0, yBase + hgt * 0.55);
  for (let i = 0; i <= bumps; i++) {
    const bx = (w * i) / bumps;
    const peak = yBase + (((i * 37) % 3) * 0.16 - 0.62) * hgt + hgt * 0.55;
    ctx.quadraticCurveTo(bx - w / bumps / 2, peak, bx, yBase + hgt * 0.55);
  }
  ctx.lineTo(w, yBase + hgt);
  ctx.closePath();
  ctx.fill();
  if (kind === "snow") {
    // 雪丘顶上一层白
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i < 3; i++) {
      const bx = (w * (i + 0.5)) / 3;
      ctx.beginPath();
      ctx.ellipse(bx, yBase + hgt * 0.18, w / 14, hgt * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
