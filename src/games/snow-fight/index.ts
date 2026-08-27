import { meta } from "./meta";
export { meta };

// 雪球大作战 1.2:侧视雪原上的**实时**投掷。
//
// 1.1 是回合制炮击(你定角度、定力度、松手,然后等对面)。1.2 换成三拍子的实时对局:
//
//   躲 —— 蹲在雪坡后面,对面的雪球有一半会顺着坡滑过去;
//   搓 —— 蹲着 0.6 秒搓一颗,手里最多三颗,脚下的雪会被挖薄,得换阵地;
//   投 —— 站起来按住蓄力 0–1.2 秒,落点圈跟着蓄力实时变,松手把雪球抛出去。
//
// 三拍子互相咬:蹲着最安全但扔不出去,站着能扔但会被砸成雪人 1.5 秒。
// 全程没有血量、没有淘汰:靶子化成一摊雪,人被砸中只是变一会儿雪人,
// 连着变三次去炉子边暖手 5 秒再回场。
//
// 四种玩法共用 `arena.ts` 那一台实时引擎:188 关闯关、双人对战、人机对战(三档)、无尽雪季。
import {
  loadStars,
  mountLevelGame,
  rateAbove,
  rateBelow,
  saveStar,
  type Chapter,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
  type SoundName,
} from "../level99";
import { getLevelExtras } from "../../ui/level188Contract";
import { save } from "../../engine/save";
import { stopSpeaking } from "../speech";
import guide from "./guide";
import {
  CHAPTERS,
  CHAPTER_NEW,
  LEVEL_TOTAL,
  VIEW_W,
  buildLevel,
  chapterIndexOf,
  chapterStartOf,
} from "./levels";
import {
  BODY_R_12,
  CROUCH_SCALE,
  DUEL_TIME,
  FIELD_W_12,
  aimCircle,
  campaignArena,
  campaignBallBudget,
  campaignLoseLine,
  campaignWinLine,
  duelArena,
  endlessArena,
  idleInput,
  liveFoes,
  seasonLine,
  stepArena,
  type Arena,
  type ArenaEvent,
  type Fighter,
  type Foe,
  type Input12,
} from "./arena";
import { AI_12, aiInput, aiTitle } from "./brains";
import { HAND_MAX, ballsLeftAt, depthAt } from "./economy";
import { ROW_LIFT, coverBox, rowBase, type Cover12 } from "./covers12";
import { BUMP_LIMIT, bumpsLeft, freezeRatio } from "./snowman";
import { BALL_R_12, CHARGE_MAX, chargeRatio, windWord } from "./throw12";
import type { AiLevel } from "./physics";

const P_NAME = ["朵朵", "星星"];
const P_MARK = ["🌸", "⭐"];
const P_COLOR = ["#e8558f", "#3f7fd6"];
/** 两套键位互不重叠:一个人按 A/D/W/S/F/G,另一个按方向键 + L/K */
const P_KEYS = [
  "A/D 走 · W/S 抬准星 · 按住 F 蓄力 · 按住 G 蹲下搓雪",
  "←/→ 走 · ↑/↓ 抬准星 · 按住 L 蓄力 · 按住 K 蹲下搓雪",
];

/** 画面往上画到多少个单位高(再高的雪球就飞出画面了,不影响判定) */
const VIEW_H = 14;
/** 地面线下面留几个像素画雪地 */
const GROUND_PAD = 18;
/** 手机上画面矮得看不清抛物线,至少给它这么多像素高 */
const MIN_BOARD_H = 156;
/** 一帧最多推进多少秒(切后台回来别一口气跳过半局) */
const MAX_DT = 0.05;

// ---------------------------------------------------------------------------
// 样式:全部 snf- 前缀 + 局部 <style>,一行都不进 src/styles.css
// ---------------------------------------------------------------------------

const CSS = `
.snf-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:8px;align-items:center;}
.snf-hud{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center;width:100%;}
.snf-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:14px;font-weight:800;color:#4f5b78;
  box-shadow:0 2px 6px rgba(140,160,190,.26);white-space:nowrap;}
.snf-chip-p0{background:#fff0f6;color:#b8436f;}
.snf-chip-p1{background:#e6f0ff;color:#2f5fa8;}
.snf-chip-warn{background:#fff3e2;color:#a4642a;}
.snf-board{position:relative;line-height:0;width:100%;display:flex;justify-content:center;}
.snf-canvas{display:block;border-radius:14px;background:#dceaf8;touch-action:none;
  box-shadow:0 4px 14px rgba(110,140,180,.3);}
.snf-over{position:absolute;inset:0;border-radius:14px;background:rgba(252,253,255,.94);display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:14px;}
.snf-over-t{font-size:20px;font-weight:900;color:#3f6ea8;line-height:1.3;}
.snf-over-s{font-size:14px;font-weight:700;color:#5b6885;line-height:1.6;max-width:320px;}
.snf-say{font-size:14px;font-weight:800;color:#4f5b78;text-align:center;line-height:1.5;max-width:460px;min-height:21px;}
.snf-tip{font-size:14px;font-weight:700;color:#6b7794;text-align:center;line-height:1.5;max-width:460px;}
.snf-pads{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;width:100%;}
.snf-pad{display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 8px;border-radius:14px;background:#ffffffb0;}
.snf-pad-p0{box-shadow:0 0 0 2px #f3b6cf inset;}
.snf-pad-p1{box-shadow:0 0 0 2px #a9c6ee inset;}
.snf-pad-t{font-size:14px;font-weight:900;text-align:center;line-height:1.4;}
.snf-row{display:flex;gap:6px;align-items:center;}
.snf-btn{border:none;border-radius:12px;min-width:46px;min-height:46px;padding:2px 8px;font-size:16px;
  font-weight:900;cursor:pointer;font-family:inherit;color:#42557a;background:#e8f0fb;
  box-shadow:0 3px 0 rgba(120,150,190,.4);touch-action:none;}
.snf-btn:active,.snf-btn-hold{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,150,190,.4);}
.snf-btn:disabled{opacity:.42;cursor:default;}
.snf-btn-throw{background:#ffdbe6;color:#a83a68;box-shadow:0 3px 0 rgba(200,110,150,.42);min-width:104px;}
.snf-btn-scoop{background:#eef6ff;color:#3a6ba8;box-shadow:0 3px 0 rgba(110,150,200,.42);min-width:88px;}
.snf-btn:focus-visible,.snf-act:focus-visible,.snf-open:focus-visible,.snf-back:focus-visible{outline:3px solid #2a3f6b;outline-offset:3px;}
.snf-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.snf-act{border:none;border-radius:999px;padding:11px 16px;min-height:44px;font-size:14px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#4f6a9c;box-shadow:0 3px 0 rgba(110,140,180,.26);white-space:nowrap;}
.snf-act:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(110,140,180,.26);}
.snf-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:6px;}
.snf-open{border:none;border-radius:999px;padding:11px 16px;min-height:44px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7fb2e0,#5b8ec4);box-shadow:0 4px 0 #43709e;}
.snf-open.snf-open-vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.snf-open.snf-open-ai{background:linear-gradient(180deg,#9d9ae0,#7a76c9);box-shadow:0 4px 0 #5f5ba6;}
.snf-open:active{transform:translateY(2px);box-shadow:0 2px 0 #43709e;}
.snf-mode{border-radius:18px;padding:10px;background:linear-gradient(180deg,#eef5fd,#fff3f8);
  display:flex;flex-direction:column;gap:8px;align-items:center;}
.snf-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;width:100%;}
.snf-back{border:none;border-radius:999px;padding:11px 15px;min-height:44px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#52698c;box-shadow:0 3px 0 rgba(110,140,180,.3);}
.snf-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(110,140,180,.3);}
@media (max-width:420px){
  .snf-btn{min-width:44px;min-height:44px;font-size:15px;padding:2px 6px;}
  .snf-btn-throw{min-width:92px;}
  .snf-btn-scoop{min-width:80px;}
  .snf-pads{gap:6px;}
  .snf-pad{padding:4px 6px;}
  .snf-open{padding:10px 12px;font-size:14px;}
  .snf-bar{gap:6px;margin-bottom:4px;}
  .snf-chip{padding:4px 9px;font-size:14px;}
}
@media (prefers-reduced-motion:reduce){.snf-btn:active,.snf-btn-hold{transform:none;}}
`;

// ---------------------------------------------------------------------------
// 画面:全部程序化绘制,一张外部图片都不用
// ---------------------------------------------------------------------------

/**
 * 世界坐标 → 画布坐标。
 *
 * 横向是老老实实的等比缩放,竖向多了一个拉伸系数:场地有 54–60 格宽,
 * 挤进手机屏之后一格只剩五六个像素,抛物线会被压成一条直线。
 * 只把竖向拉高,落点、风偏这些「横着算」的东西一点都不受影响,
 * 弧线却看得清清楚楚——落点圈落在哪儿,雪球就落到哪儿。
 */
interface Camera {
  /** 横向:一个世界单位有多少像素 */
  s: number;
  /** 竖向额外拉伸多少倍(宽屏上就是 1) */
  ys: number;
  /** 地面线在画布上的高度(下面还有一条雪地) */
  h: number;
}

function sx(cam: Camera, x: number): number {
  return x * cam.s;
}

function sy(cam: Camera, y: number): number {
  return cam.h - y * cam.s * cam.ys;
}

/**
 * 远排画小一点。
 *
 * 伪纵深就靠这一个系数加上 `ROW_LIFT` 的抬高:远排的东西抬到半空、缩到八成,
 * 看着就像退到了雪原深处。不做真 3D——判定始终是二维的,
 * 小朋友看到的和判定算的必须是同一回事。
 */
const FAR_SCALE = 0.8;

function rowScale(row: 0 | 1): number {
  return row === 1 ? FAR_SCALE : 1;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function drawSky(c: CanvasRenderingContext2D, cam: Camera, w: number, t: number): void {
  const g = c.createLinearGradient(0, 0, 0, cam.h);
  g.addColorStop(0, "#cfe3f7");
  g.addColorStop(1, "#f2f8ff");
  c.fillStyle = g;
  c.fillRect(0, 0, w, cam.h + GROUND_PAD);
  // 一直在下的雪:位置只跟时间有关,不占状态,所以暂停 / 重挂都不会闪
  c.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < 30; i++) {
    const px = ((i * 137.5 + t * 12) % (w + 20)) - 10;
    const py = ((i * 61.7 + t * 26) % (cam.h + 20)) - 10;
    c.beginPath();
    c.arc(px, py, Math.max(1, cam.s * 0.06) + (i % 3) * 0.4, 0, Math.PI * 2);
    c.fill();
  }
}

/** 远处的雪山和小松树:位置固定,只是让雪原不那么空 */
function drawBackdrop(c: CanvasRenderingContext2D, cam: Camera, w: number): void {
  const base = sy(cam, 0);
  c.fillStyle = "#e6eff9";
  for (const [cx, r] of [
    [0.22, 0.3],
    [0.55, 0.24],
    [0.86, 0.28],
  ] as Array<[number, number]>) {
    c.beginPath();
    c.ellipse(w * cx, base + 2, w * r, Math.max(14, cam.h * 0.3), 0, Math.PI, Math.PI * 2);
    c.fill();
  }
  const treeH = Math.max(12, cam.h * 0.17);
  c.fillStyle = "#cbdcec";
  for (const cx of [0.16, 0.33, 0.47, 0.64, 0.79, 0.93]) {
    const x = w * cx;
    for (let k = 0; k < 3; k++) {
      const y = base - (treeH * k) / 3.4;
      const half = (treeH * (3 - k)) / 9;
      c.beginPath();
      c.moveTo(x, y - treeH / 2.6);
      c.lineTo(x - half, y);
      c.lineTo(x + half, y);
      c.closePath();
      c.fill();
    }
  }
}

/**
 * 地面 + 积雪厚度。
 *
 * 每一格积雪的厚度都画出来:搓过雪的地方明显变薄发灰,
 * 小朋友不用看数字就知道「这儿挖秃了,该换个地方蹲」。
 */
function drawGround(c: CanvasRenderingContext2D, cam: Camera, w: number, a: Arena): void {
  const y = sy(cam, 0);
  c.fillStyle = "#eaf1f9";
  c.fillRect(0, y, w, GROUND_PAD);
  const field = a.field;
  for (let i = 0; i < field.depth.length; i++) {
    const x0 = sx(cam, field.x0 + i * field.patchW);
    const pw = field.patchW * cam.s;
    if (x0 > w) break;
    const d = Math.max(0, Math.min(1, field.depth[i] ?? 0));
    const th = 3 + d * (GROUND_PAD - 6);
    c.fillStyle = d > 0.05 ? "#ffffff" : "#dfe8f2";
    c.fillRect(x0, y + GROUND_PAD - th, Math.max(1, pw - 0.6), th);
  }
  c.strokeStyle = "#d3e0ee";
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(0, y + GROUND_PAD);
  c.lineTo(w, y + GROUND_PAD);
  c.stroke();
}

/** 雪堡与警戒线:雪人走到这里这一轮就结束(不是被打败,是该重来一次) */
function drawFort(c: CanvasRenderingContext2D, cam: Camera, fortX: number): void {
  const gx = sx(cam, fortX);
  const base = sy(cam, 0);
  c.fillStyle = "#eef4fb";
  c.beginPath();
  c.moveTo(0, base);
  c.lineTo(0, sy(cam, 4));
  c.lineTo(gx * 0.3, sy(cam, 5.4));
  c.lineTo(gx * 0.6, sy(cam, 4));
  c.lineTo(gx * 0.6, base);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(160,190,220,.7)";
  c.lineWidth = 1.4;
  c.stroke();
  c.setLineDash([4, 4]);
  c.strokeStyle = "rgba(240,150,180,.85)";
  c.beginPath();
  c.moveTo(gx, base);
  c.lineTo(gx, sy(cam, 3.4));
  c.stroke();
  c.setLineDash([]);
  c.textAlign = "center";
  c.textBaseline = "bottom";
  c.font = `${Math.max(13, Math.round(cam.s * 0.9))}px system-ui`;
  c.fillText("🏰", gx * 0.3, base - 3);
}

/** 三种掩体各画各的样子:一眼要能分出「砸得碎 / 推得动 / 得蹲下」 */
function drawCover(c: CanvasRenderingContext2D, cam: Camera, cv: Cover12): void {
  const box = coverBox(cv);
  const x = sx(cam, box.x0);
  const w = Math.max(4, cv.w * cam.s);
  const top = sy(cam, box.y1);
  const bottom = sy(cam, box.y0);
  const far = cv.row === 1;
  c.globalAlpha = far ? 0.72 : 1;
  if (cv.kind === "slope") {
    // 雪坡:一个斜面,左低右高。站着挡不住,蹲下才半隐藏
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(x, bottom);
    c.lineTo(x + w, top);
    c.lineTo(x + w, bottom);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(150,185,220,.85)";
    c.lineWidth = 1.4;
    c.stroke();
    c.fillStyle = "rgba(120,160,200,.5)";
    c.font = `${Math.max(11, Math.round(cam.s * 0.7))}px system-ui`;
    c.textAlign = "center";
    c.textBaseline = "bottom";
    c.fillText("⛰️", x + w * 0.62, bottom - 2);
  } else if (cv.kind === "crate") {
    // 木箱:砸不碎,但会被推着走
    c.fillStyle = "#e6cfa8";
    roundRect(c, x, top, w, bottom - top, 3);
    c.fill();
    c.strokeStyle = "#b99a6c";
    c.lineWidth = 1.6;
    c.stroke();
    c.beginPath();
    c.moveTo(x, top);
    c.lineTo(x + w, bottom);
    c.moveTo(x + w, top);
    c.lineTo(x, bottom);
    c.stroke();
  } else {
    // 雪墙:砸三下碎,每掉一层多一道裂纹、颜色也淡一档
    const worn = cv.hp / Math.max(1, cv.maxHp);
    c.fillStyle = worn > 0.66 ? "#ffffff" : worn > 0.33 ? "#eef6fd" : "#dfeefa";
    roundRect(c, x, top, w, bottom - top, Math.min(w / 2, cam.s * 0.4));
    c.fill();
    c.strokeStyle = "rgba(140,180,215,.9)";
    c.lineWidth = 1.5;
    c.stroke();
    const cracks = Math.max(0, cv.maxHp - cv.hp);
    c.strokeStyle = "rgba(110,150,190,.6)";
    c.lineWidth = 1.2;
    for (let i = 0; i < cracks; i++) {
      const yy = top + ((bottom - top) * (i + 1)) / (cracks + 1);
      c.beginPath();
      c.moveTo(x + 2, yy);
      c.lineTo(x + w - 2, yy + (i % 2 === 0 ? 3 : -3));
      c.stroke();
    }
  }
  c.globalAlpha = 1;
}

function drawFoe(c: CanvasRenderingContext2D, cam: Camera, f: Foe, time: number): void {
  if (f.melted) return;
  const k = rowScale(f.row);
  const x = sx(cam, f.x);
  const y = sy(cam, f.y + rowBase(f.row));
  const r = Math.max(6, f.r * cam.s * k);
  c.globalAlpha = f.row === 1 ? 0.85 : 1;
  if (f.kind === "snowfoe") {
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(x, y + r * 0.5, r * 0.95, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(x, y - r * 0.55, r * 0.68, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(150,185,220,.85)";
    c.lineWidth = 1.3;
    c.stroke();
    c.fillStyle = "#5b6885";
    c.beginPath();
    c.arc(x - r * 0.25, y - r * 0.62, Math.max(1, r * 0.1), 0, Math.PI * 2);
    c.arc(x + r * 0.25, y - r * 0.62, Math.max(1, r * 0.1), 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#f0a2b8";
    c.beginPath();
    c.arc(x, y - r * 0.32, Math.max(1, r * 0.14), 0, Math.PI);
    c.fill();
    c.globalAlpha = 1;
    return;
  }
  // 雪灯笼:一颗会轻轻发光的小灯,归属用颜色区分
  c.fillStyle = `rgba(255,214,150,${0.28 + Math.sin(time * 2 + f.id) * 0.12})`;
  c.beginPath();
  c.arc(x, y, r * 1.5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = f.owner === 0 ? "#f7a8c6" : f.owner === 1 ? "#9ec2ee" : "#ffcf87";
  c.beginPath();
  c.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(255,255,255,.9)";
  c.lineWidth = 1.4;
  c.stroke();
  c.fillStyle = "rgba(255,255,255,.95)";
  c.fillRect(x - r * 0.9, y - r * 0.12, r * 1.8, Math.max(1.5, r * 0.16));
  c.beginPath();
  c.ellipse(x, y - r * 0.95, r * 0.55, r * 0.28, 0, Math.PI, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
}

/**
 * 一个投手。四种样子:站着、蹲着(在搓雪)、变雪人、暖手休息。
 * 变雪人画成一个顶着胡萝卜鼻子的小雪人 —— 不掉血、不倒地,只是动不了。
 */
function drawFighter(c: CanvasRenderingContext2D, cam: Camera, f: Fighter, time: number): void {
  const x = sx(cam, f.x);
  const base = sy(cam, 0);
  const full = Math.max(8, BODY_R_12 * cam.s * 0.72);
  const r = f.crouch ? full * CROUCH_SCALE + full * 0.25 : full;
  const frozen = f.hit.phase !== "free";
  if (!frozen) {
    c.fillStyle = `rgba(255,214,120,${0.2 + Math.sin(time * 3 + f.seat) * 0.08})`;
    c.beginPath();
    c.ellipse(x, base - r * 0.2, r * 1.8, r * 0.5, 0, 0, Math.PI * 2);
    c.fill();
  }
  if (f.hit.phase === "snowman") {
    // 变雪人:两个雪球摞起来,顶上一根胡萝卜
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(x, base - full * 0.8, full * 0.85, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(x, base - full * 2, full * 0.6, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(150,185,220,.9)";
    c.lineWidth = 1.4;
    c.stroke();
    c.fillStyle = "#f2954f";
    c.beginPath();
    c.moveTo(x, base - full * 2);
    c.lineTo(x + full * 0.75, base - full * 1.92);
    c.lineTo(x, base - full * 1.84);
    c.closePath();
    c.fill();
    // 倒计时圈:还有多久能动
    const k = freezeRatio(f.hit);
    c.strokeStyle = "rgba(90,140,200,.75)";
    c.lineWidth = 2.4;
    c.beginPath();
    c.arc(x, base - full * 2, full * 1.15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    c.stroke();
    return;
  }
  c.fillStyle = f.hit.phase === "warming" ? "#cfd9e8" : P_COLOR[f.seat] ?? P_COLOR[0];
  roundRect(c, x - r * 0.75, base - r * 2.1, r * 1.5, r * 2.1, r * 0.6);
  c.fill();
  c.fillStyle = "#ffe8d2";
  c.beginPath();
  c.arc(x, base - r * 2.5, r * 0.72, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#5b6885";
  const eyeDir = f.dir * r * 0.24;
  c.beginPath();
  c.arc(x + eyeDir - r * 0.16, base - r * 2.56, Math.max(1, r * 0.1), 0, Math.PI * 2);
  c.arc(x + eyeDir + r * 0.16, base - r * 2.56, Math.max(1, r * 0.1), 0, Math.PI * 2);
  c.fill();
  c.textAlign = "center";
  c.textBaseline = "bottom";
  c.font = `${Math.max(12, Math.round(full * 1.1))}px system-ui`;
  if (f.hit.phase === "warming") {
    c.fillText("🔥", x, base - r * 3.2);
  } else {
    c.fillText(P_MARK[f.seat] ?? "🌸", x, base - r * 3.2);
  }
  // 手里攥着几颗:头顶上一排小白点,不用低头看 HUD
  c.fillStyle = "#ffffff";
  c.strokeStyle = "rgba(130,170,210,.9)";
  c.lineWidth = 1;
  for (let i = 0; i < f.hands.balls; i++) {
    c.beginPath();
    c.arc(x - full * 0.6 + i * full * 0.6, base - r * 3.5, Math.max(2, full * 0.22), 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  // 正在搓的那一颗:一个慢慢长大的小球
  if (f.crouch && f.hands.progress > 0) {
    c.fillStyle = "rgba(255,255,255,.95)";
    c.beginPath();
    c.arc(x + f.dir * r * 0.9, base - r * 0.35, Math.max(1.5, full * 0.32 * (f.hands.progress / 0.6)), 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
}

/**
 * 落点圈:这一发大概会落在哪儿。
 *
 * 圈的半径来自 `landingCircle`——它同时算过「飞得越久越没底」和「出手抖动的两个极端」,
 * 所以真实落点一定在圈里。飞得越远圈越大,画得也越虚:
 * **越远越模糊**这件事是算出来的,不是画上去的。
 */
function drawLanding(c: CanvasRenderingContext2D, cam: Camera, ring: { x: number; r: number; blur: number }, hot: boolean): void {
  const cx = sx(cam, ring.x);
  const cy = sy(cam, 0);
  const rx = Math.max(4, ring.r * cam.s);
  const ry = Math.max(2.5, rx * 0.32);
  const alpha = (hot ? 0.85 : 0.4) * (1 - ring.blur * 0.5);
  c.save();
  c.setLineDash(ring.blur > 0.4 ? [4, 5] : [7, 4]);
  c.lineWidth = hot ? 2.4 : 1.6;
  c.strokeStyle = `rgba(232,85,143,${alpha})`;
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = `rgba(232,85,143,${alpha * 0.16})`;
  c.fill();
  c.restore();
}

function drawBall(c: CanvasRenderingContext2D, cam: Camera, b: { x: number; y: number }): void {
  c.fillStyle = "#ffffff";
  c.strokeStyle = "rgba(140,175,210,.9)";
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(sx(cam, b.x), sy(cam, b.y), Math.max(3, BALL_R_12 * cam.s), 0, Math.PI * 2);
  c.fill();
  c.stroke();
}

interface Puff {
  x: number;
  y: number;
  t: number;
  face: string;
}

function drawPuffs(c: CanvasRenderingContext2D, cam: Camera, puffs: Puff[]): void {
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const p of puffs) {
    const k = Math.max(0, 1 - p.t / 0.9);
    c.globalAlpha = k;
    c.font = `${Math.max(14, Math.round(cam.s * 1.1))}px system-ui`;
    c.fillText(p.face, sx(cam, p.x), sy(cam, p.y) - (1 - k) * cam.s);
    c.globalAlpha = 1;
  }
}

function drawWindFlag(c: CanvasRenderingContext2D, cam: Camera, w: number, wind: number): void {
  const cx = w / 2;
  const cy = Math.max(15, cam.h * 0.1);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `700 ${Math.max(12, Math.round(cam.s * 0.8))}px system-ui`;
  c.fillStyle = "#4f6a9c";
  c.fillText(windWord(wind), cx, cy);
  if (Math.abs(wind) < 0.25) return;
  const len = Math.min(46, 12 + Math.abs(wind) * 12);
  const dir = wind > 0 ? 1 : -1;
  c.strokeStyle = "rgba(90,130,180,.8)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(cx - (len / 2) * dir, cy + 14);
  c.lineTo(cx + (len / 2) * dir, cy + 14);
  c.lineTo(cx + (len / 2 - 6) * dir, cy + 10);
  c.moveTo(cx + (len / 2) * dir, cy + 14);
  c.lineTo(cx + (len / 2 - 6) * dir, cy + 18);
  c.stroke();
}

/** 准星:从手上伸出去的一小段箭头,告诉你现在抬了多高 */
function drawAimArrow(c: CanvasRenderingContext2D, cam: Camera, f: Fighter): void {
  const hx = sx(cam, f.x + f.dir * 0.6);
  const hy = sy(cam, 1.5 * (f.crouch ? CROUCH_SCALE + 0.25 : 1));
  const rad = (f.aim * Math.PI) / 180;
  const len = Math.max(20, cam.s * 2.6);
  const ex = hx + Math.cos(rad) * len * f.dir;
  const ey = hy - Math.sin(rad) * len * cam.ys;
  c.strokeStyle = f.seat === 0 ? "rgba(232,85,143,.8)" : "rgba(63,127,214,.8)";
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(hx, hy);
  c.lineTo(ex, ey);
  c.stroke();
  c.fillStyle = c.strokeStyle;
  c.beginPath();
  c.arc(ex, ey, 3, 0, Math.PI * 2);
  c.fill();
}

/** 蓄力条:按住多久就有多长,满档变色 */
function drawChargeBar(c: CanvasRenderingContext2D, cssW: number, cam: Camera, seat: number, held: number): void {
  const w = Math.min(200, cssW * 0.46);
  const x = seat === 0 ? 10 : cssW - w - 10;
  const y = cam.h - 16;
  const k = chargeRatio(held);
  c.fillStyle = "rgba(255,255,255,.88)";
  roundRect(c, x, y, w, 10, 5);
  c.fill();
  c.fillStyle = k > 0.92 ? "#e8558f" : seat === 0 ? "#f08aa8" : "#5b8ec4";
  roundRect(c, x + 1, y + 1, Math.max(2, (w - 2) * k), 8, 4);
  c.fill();
}

// ---------------------------------------------------------------------------
// 一局的运行器:画布 + HUD + 两套键位 + 触屏 + 暂停
// ---------------------------------------------------------------------------

/** 一个人这一帧按住了什么 */
interface Held {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  crouch: boolean;
  charge: boolean;
}

function noHold(): Held {
  return { left: false, right: false, up: false, down: false, crouch: false, charge: false };
}

function holdToInput(h: Held): Input12 {
  return {
    move: (h.right ? 1 : 0) - (h.left ? 1 : 0),
    aim: (h.up ? 1 : 0) - (h.down ? 1 : 0),
    crouch: h.crouch,
    charging: h.charge,
  };
}

type HoldKey = keyof Held;

/** 两套键位:一个人 A/D/W/S/F/G,另一个方向键 + L/K。互不重叠,谁也抢不了谁 */
const KEYS_12: Record<string, { seat: 0 | 1; hold: HoldKey }> = {
  KeyA: { seat: 0, hold: "left" },
  KeyD: { seat: 0, hold: "right" },
  KeyW: { seat: 0, hold: "up" },
  KeyS: { seat: 0, hold: "down" },
  KeyF: { seat: 0, hold: "charge" },
  KeyG: { seat: 0, hold: "crouch" },
  ArrowLeft: { seat: 1, hold: "left" },
  ArrowRight: { seat: 1, hold: "right" },
  ArrowUp: { seat: 1, hold: "up" },
  ArrowDown: { seat: 1, hold: "down" },
  KeyL: { seat: 1, hold: "charge" },
  KeyK: { seat: 1, hold: "crouch" },
};

const PAUSE_KEY_12 = "Escape";

interface RunOptions {
  arena: Arena;
  /** 场地画多宽(闯关只画到 VIEW_W,对战要画满 FIELD_W_12) */
  viewW: number;
  /** 有几位真人在场(1 = 只有朵朵的键位生效) */
  humans: 1 | 2;
  hint: string;
  /** HUD 上额外挂几个小牌子 */
  extraChips?: (a: Arena) => string[];
  onEnd: (a: Arena) => void;
  onWave?: (a: Arena) => void;
}

interface Runner {
  destroy: () => void;
  /** 给用例用的探针:现在画面上这一局是什么样 */
  arena: Arena;
}

function mountRun(host: HTMLElement, sfx: (n: SoundName) => void, opts: RunOptions): Runner {
  const a = opts.arena;
  const wrap = document.createElement("div");
  wrap.className = "snf-wrap";

  const hud = document.createElement("div");
  hud.className = "snf-hud";
  const board = document.createElement("div");
  board.className = "snf-board";
  const canvas = document.createElement("canvas");
  canvas.className = "snf-canvas";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "雪球大作战的雪原:按住画面蓄力,上下拖动调准星,松手把雪球扔出去");
  board.appendChild(canvas);
  const say = document.createElement("div");
  say.className = "snf-say";
  say.setAttribute("aria-live", "polite");
  const tip = document.createElement("div");
  tip.className = "snf-tip";
  tip.textContent = opts.hint;
  const acts = document.createElement("div");
  acts.className = "snf-acts";
  const pads = document.createElement("div");
  pads.className = "snf-pads";
  wrap.append(hud, board, say, tip, acts, pads);
  host.appendChild(wrap);

  const held: Held[] = [noHold(), noHold()];
  const puffs: Puff[] = [];
  let paused = false;
  let finished = false;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let hudAt = 0;
  let cam: Camera = { s: 8, ys: 1, h: 128 };
  let cssW = 320;

  const pauseBtn = document.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "snf-act";
  pauseBtn.textContent = "⏸️ 暂停 (Esc)";
  acts.appendChild(pauseBtn);

  function layout(): void {
    const availW = Math.max(240, (host.clientWidth || 340) - 8);
    const maxW = Math.min(availW, 880);
    const s = maxW / opts.viewW;
    const ys = Math.max(1, Math.min(2, MIN_BOARD_H / (VIEW_H * s)));
    cam = { s, ys, h: Math.round(VIEW_H * s * ys) };
    cssW = Math.round(opts.viewW * s);
    const cssH = cam.h + GROUND_PAD;
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const c = canvas.getContext("2d");
    if (c) c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seatOf(seat: number): Fighter | undefined {
    return a.fighters.find((f) => f.seat === seat);
  }

  // ---- HUD ----------------------------------------------------------------

  function chipsFor(): string[] {
    const chips: string[] = [];
    for (let s = 0; s < opts.humans; s++) {
      const f = seatOf(s);
      if (!f) continue;
      const balls = "❄️".repeat(f.hands.balls) + "·".repeat(HAND_MAX - f.hands.balls);
      const state =
        f.hit.phase === "snowman"
          ? " ⛄变雪人"
          : f.hit.phase === "warming"
            ? " 🔥暖手中"
            : bumpsLeft(f.hit) < BUMP_LIMIT
              ? ` ♡${bumpsLeft(f.hit)}`
              : "";
      chips.push(`${P_MARK[s]} ${balls}${state}`);
    }
    const me = seatOf(0);
    if (me) chips.push(`📐 ${Math.round(me.aim)}°`);
    chips.push(`🌬️ ${windWord(a.wind)}`);
    if (a.mode === "duel") {
      chips.push(`🏮 我方 ${liveFoes(a, 0).length} : ${liveFoes(a, 1).length} 对方`);
      if (a.clock > 0) chips.push(`⏳ ${Math.max(0, Math.ceil(a.clock - a.t))} 秒`);
    } else {
      chips.push(`🎯 还剩 ${liveFoes(a).length} 个`);
    }
    if (me) {
      const left = ballsLeftAt(a.field, me.x);
      chips.push(left > 0 ? `🤲 脚下还能搓 ${left} 颗` : "🤲 这儿挖秃了,换个地方");
    }
    for (const extra of opts.extraChips?.(a) ?? []) chips.push(extra);
    return chips;
  }

  function refreshHud(): void {
    hud.innerHTML = "";
    for (const [i, text] of chipsFor().entries()) {
      const el = document.createElement("span");
      const tone = i === 0 ? " snf-chip-p0" : i === 1 && opts.humans === 2 ? " snf-chip-p1" : "";
      el.className = `snf-chip${tone}${text.includes("挖秃") ? " snf-chip-warn" : ""}`;
      el.textContent = text;
      el.setAttribute("aria-live", "off");
      hud.appendChild(el);
    }
  }

  // ---- 事件 → 音效 / 冒泡 ---------------------------------------------------

  function playEvents(events: ArenaEvent[]): void {
    for (const e of events) {
      if (e.kind === "throw") sfx("pop");
      else if (e.kind === "scoop") puffs.push({ x: e.x, y: 0.7, t: 0, face: "❄️" });
      else if (e.kind === "melt") {
        puffs.push({ x: e.x, y: e.y, t: 0, face: e.foe === "snowfoe" ? "🌼" : "✨" });
        sfx("coin");
      } else if (e.kind === "cover") {
        puffs.push({ x: e.x, y: e.y, t: 0, face: e.broke ? "💥" : e.pushed !== 0 ? "📦" : "💨" });
        sfx("tap");
      } else if (e.kind === "shield") {
        puffs.push({ x: e.x, y: e.y, t: 0, face: "🛡️" });
        sfx("tap");
      } else if (e.kind === "snowman") {
        puffs.push({ x: e.x, y: e.y, t: 0, face: e.warming ? "🔥" : "⛄" });
        sfx("oops");
        const f = seatOf(e.seat);
        if (f) {
          say.textContent = e.warming
            ? `${f.name}连着变了三次雪人,去炉子边暖暖手,一会儿就回来!`
            : `${f.name}变成雪人啦!抖一抖雪,一秒半就能动。`;
        }
      } else if (e.kind === "wave") {
        sfx("win");
        say.textContent = `第 ${e.wave} 波雪人来啦!趁现在多搓两颗。`;
        opts.onWave?.(a);
      } else if (e.kind === "splash") {
        puffs.push({ x: e.x, y: 0.4, t: 0, face: "💨" });
      }
    }
  }

  // ---- 主循环 --------------------------------------------------------------

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (last === 0) last = now;
    const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000));
    last = now;
    if (!paused && !finished) {
      clock += dt;
      for (const p of puffs) p.t += dt;
      while (puffs.length > 0 && (puffs[0]?.t ?? 0) > 0.9) puffs.shift();
      const inputs: Partial<Record<number, Input12>> = {};
      for (const f of a.fighters) {
        inputs[f.seat] = f.ai ? aiInput(a, f, dt) : f.seat < opts.humans ? holdToInput(held[f.seat] ?? noHold()) : idleInput();
      }
      playEvents(stepArena(a, dt, inputs));
      hudAt += dt;
      if (hudAt > 0.12) {
        hudAt = 0;
        refreshHud();
      }
      if (a.status !== "playing") {
        finished = true;
        refreshHud();
        window.setTimeout(() => opts.onEnd(a), 460);
      }
    }
    const c = canvas.getContext("2d");
    if (c) draw(c);
  }

  function draw(c: CanvasRenderingContext2D): void {
    drawSky(c, cam, cssW, clock);
    drawBackdrop(c, cam, cssW);
    drawGround(c, cam, cssW, a);
    if (a.mode !== "duel") drawFort(c, cam, a.fortX);
    // 远排先画,近排压在上面:两排一叠就有了「远处更远」的样子
    for (const cv of a.covers) if (cv.row === 1) drawCover(c, cam, cv);
    for (const f of a.foes) if (f.row === 1) drawFoe(c, cam, f, clock);
    for (const cv of a.covers) if (cv.row === 0) drawCover(c, cam, cv);
    for (const f of a.foes) if (f.row === 0) drawFoe(c, cam, f, clock);
    for (const f of a.fighters) {
      // 落点圈:没在蓄力也画一个虚的(那是「轻轻一点就松手」会落到的地方),
      // 蓄力中画实的。小朋友照着圈调,不用先学会看角度
      if (f.hit.phase === "free" && f.hands.balls > 0 && !f.crouch && (f.ai === null || f.charge !== null)) {
        drawLanding(c, cam, aimCircle(a, f), f.charge !== null);
      }
      drawAimArrow(c, cam, f);
      drawFighter(c, cam, f, clock);
    }
    for (const b of a.balls) drawBall(c, cam, b);
    drawWindFlag(c, cam, cssW, a.wind);
    for (let s = 0; s < opts.humans; s++) {
      const f = seatOf(s);
      if (f && f.charge !== null) drawChargeBar(c, cssW, cam, s, f.charge);
    }
    drawPuffs(c, cam, puffs);
  }

  // ---- 键盘 ---------------------------------------------------------------

  function onKeyDown(e: KeyboardEvent): void {
    if (e.code === PAUSE_KEY_12) {
      e.preventDefault();
      setPaused(!paused);
      return;
    }
    const bind = KEYS_12[e.code];
    if (!bind || bind.seat >= opts.humans) return;
    e.preventDefault();
    const box = held[bind.seat];
    if (box) box[bind.hold] = true;
  }

  function onKeyUp(e: KeyboardEvent): void {
    const bind = KEYS_12[e.code];
    if (!bind || bind.seat >= opts.humans) return;
    const box = held[bind.seat];
    if (box) box[bind.hold] = false;
  }

  /** 切走了就当所有键都松开:回来时不会发现自己一直在蓄力 */
  function releaseAll(): void {
    held[0] = noHold();
    held[1] = noHold();
  }

  // ---- 触屏:按住 + 拖方向 + 松手 -------------------------------------------

  /**
   * 手机上的一整套操作只用一根手指:
   * **按住画面** = 开始蓄力(落点圈立刻出现);**上下拖** = 抬 / 压准星;
   * **左右拖到边上** = 往那边挪两步;**松手** = 扔出去。
   *
   * 松手前落点圈一直跟着手指走,所以「扔到哪儿」这件事在松手之前就已经看得见了。
   */
  const DRAG_AIM_PX = 2.2;
  let drag: { id: number; y0: number; aim0: number } | null = null;

  function onPointerDown(e: PointerEvent): void {
    if (paused || finished || opts.humans !== 1) return;
    const f = seatOf(0);
    if (!f) return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    drag = { id: e.pointerId, y0: e.clientY, aim0: f.aim };
    const box = held[0];
    if (box) box.charge = true;
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.id) return;
    const f = seatOf(0);
    if (!f) return;
    e.preventDefault();
    // 往上拖 = 抬高。直接写 aim 而不是按住方向键,手指停在哪儿准星就停在哪儿
    f.aim = Math.max(8, Math.min(82, drag.aim0 + (drag.y0 - e.clientY) / DRAG_AIM_PX));
  }

  function onPointerUp(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    drag = null;
    const box = held[0];
    if (box) box.charge = false;
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  // ---- 触屏按钮(和键盘完全等价) --------------------------------------------

  function makeBtn(label: string, aria: string, cls = ""): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `snf-btn${cls ? ` ${cls}` : ""}`;
    b.textContent = label;
    b.setAttribute("aria-label", aria);
    return b;
  }

  /** 按住生效、松开失效——键盘和手指走的是同一条 `held` */
  function bindHold(b: HTMLButtonElement, seat: 0 | 1, key: HoldKey): void {
    const set = (on: boolean) => (e: Event): void => {
      e.preventDefault();
      const box = held[seat];
      if (box) box[key] = on;
      b.classList.toggle("snf-btn-hold", on);
    };
    b.addEventListener("pointerdown", set(true));
    b.addEventListener("pointerup", set(false));
    b.addEventListener("pointercancel", set(false));
    b.addEventListener("pointerleave", set(false));
    b.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !e.repeat) set(true)(e);
    });
    b.addEventListener("keyup", (e) => {
      if (e.key === "Enter" || e.key === " ") set(false)(e);
    });
    b.addEventListener("blur", () => {
      const box = held[seat];
      if (box) box[key] = false;
      b.classList.remove("snf-btn-hold");
    });
  }

  function makePad(seat: 0 | 1): HTMLElement {
    const box = document.createElement("div");
    box.className = `snf-pad snf-pad-p${seat}`;
    const name = document.createElement("div");
    name.className = "snf-pad-t";
    name.style.color = P_COLOR[seat] ?? P_COLOR[0];
    name.textContent = `${P_MARK[seat]} ${P_NAME[seat]} · ${P_KEYS[seat]}`;
    const row1 = document.createElement("div");
    row1.className = "snf-row";
    const lf = makeBtn("◀", `${P_NAME[seat]}往左走`);
    bindHold(lf, seat, "left");
    const rt = makeBtn("▶", `${P_NAME[seat]}往右走`);
    bindHold(rt, seat, "right");
    const up = makeBtn("📐▲", `${P_NAME[seat]}抬高准星`);
    bindHold(up, seat, "up");
    const dn = makeBtn("📐▼", `${P_NAME[seat]}压低准星`);
    bindHold(dn, seat, "down");
    row1.append(lf, rt, up, dn);
    const row2 = document.createElement("div");
    row2.className = "snf-row";
    const sc = makeBtn("🤲 蹲下搓雪", `${P_NAME[seat]}蹲下搓雪球`, "snf-btn-scoop");
    bindHold(sc, seat, "crouch");
    const th = makeBtn("❄️ 按住蓄力", `${P_NAME[seat]}按住蓄力,松手扔出去`, "snf-btn-throw");
    bindHold(th, seat, "charge");
    row2.append(sc, th);
    box.append(name, row1, row2);
    return box;
  }

  for (let s = 0; s < opts.humans; s++) pads.appendChild(makePad(s as 0 | 1));

  // ---- 暂停 ---------------------------------------------------------------

  function setPaused(next: boolean): void {
    if (finished) return;
    paused = next;
    releaseAll();
    pauseBtn.textContent = paused ? "▶️ 继续 (Esc)" : "⏸️ 暂停 (Esc)";
    board.querySelector(".snf-over")?.remove();
    if (!paused) return;
    const ov = document.createElement("div");
    ov.className = "snf-over";
    const t = document.createElement("div");
    t.className = "snf-over-t";
    t.textContent = "⏸️ 先歇一会儿";
    const s = document.createElement("div");
    s.className = "snf-over-s";
    s.textContent =
      opts.humans === 2
        ? `按 Esc 或点「继续」回到雪原。${P_KEYS[0]};${P_KEYS[1]}。`
        : `按 Esc 或点「继续」回到雪原。${P_KEYS[0]}。手机上按住画面蓄力、上下拖调准星、松手扔出去。`;
    ov.append(t, s);
    board.appendChild(ov);
  }

  pauseBtn.addEventListener("click", () => {
    sfx("tap");
    setPaused(!paused);
  });

  const onResize = (): void => layout();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", releaseAll);
  window.addEventListener("resize", onResize);

  layout();
  refreshHud();
  raf = requestAnimationFrame(frame);

  return {
    arena: a,
    destroy() {
      finished = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      releaseAll();
      drag = null;
      puffs.length = 0;
      a.balls = [];
      stopSpeaking();
      wrap.remove();
    },
  };
}

/**
 * 不经过选关地图与模式条,直接把一局摆上来。
 *
 * 三种模式的运行器本来就是同一个,导出它是为了让运行时用例能抓住这一局的 `arena`——
 * 「按住 F 真的飞出了雪球」这种事只有对着同一份状态问才问得清楚。
 */
export function createBout(
  opts: Omit<RunOptions, "onEnd" | "hint"> & {
    host: HTMLElement;
    hint?: string;
    sfx?: (n: SoundName) => void;
    onEnd?: (a: Arena) => void;
  }
): Runner {
  const { host, sfx, onEnd, hint, ...rest } = opts;
  return mountRun(host, sfx ?? ((): void => {}), { ...rest, hint: hint ?? "", onEnd: onEnd ?? ((): void => {}) });
}

/** 本款的全部样式(用例拿它验热区与字号,顺便证明一行都没进 src/styles.css) */
export const CSS_12 = CSS;

// ---------------------------------------------------------------------------
// 188 关闯关
// ---------------------------------------------------------------------------

/** 三星要多省:扔的雪球数不超过关卡基准的六成 */
export function rateThrows(thrown: number, budget: number): 1 | 2 | 3 {
  return rateBelow(thrown, Math.max(2, Math.round(budget * 0.6)), Math.max(3, budget));
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const level = buildLevel(ctx.level);
  const ci = chapterIndexOf(ctx.level);
  const arena = campaignArena(level);
  const budget = campaignBallBudget(level);
  let runner: Runner | null = null;
  runner = mountRun(stage, ctx.sfx, {
    arena,
    viewW: VIEW_W,
    humans: 1,
    hint: `${CHAPTER_NEW[ci] ?? ""} 蹲下搓雪(G),站起来按住 F 蓄力,落点圈套住靶子再松手。`,
    onEnd(a) {
      const me = a.fighters[0];
      if (!me) return;
      if (a.status === "win") ctx.win(rateThrows(me.thrown, budget), campaignWinLine(me.thrown, budget));
      else ctx.lose(campaignLoseLine(a.reason));
    },
  });
  return {
    destroy() {
      runner?.destroy();
      runner = null;
    },
  };
}

// ---------------------------------------------------------------------------
// 双人对战 / 人机对战
// ---------------------------------------------------------------------------

function panel(title: string, lines: string[]): HTMLElement {
  const ov = document.createElement("div");
  ov.className = "snf-mode";
  const t = document.createElement("div");
  t.className = "snf-over-t";
  t.textContent = title;
  const s = document.createElement("div");
  s.className = "snf-over-s";
  for (const [i, line] of lines.entries()) {
    if (i > 0) s.appendChild(document.createElement("br"));
    s.appendChild(document.createTextNode(line));
  }
  ov.append(t, s);
  return ov;
}

function mountDuel(host: HTMLElement, api: GameApi, back: () => void, ai: AiLevel | null): { destroy: () => void } {
  const box = document.createElement("div");
  box.className = "snf-mode";
  const head = document.createElement("div");
  head.className = "snf-mhead";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "snf-back";
  backBtn.textContent = "← 回选关";
  const title = document.createElement("span");
  title.className = "snf-chip";
  title.textContent = ai ? `🤖 人机对战 · ${aiTitle(ai)}` : "⚔️ 双人对战 · 先砸化对面三盏雪灯笼";
  head.append(backBtn, title);
  const stage = document.createElement("div");
  box.append(head, stage);
  host.appendChild(box);

  const arena = duelArena(ai, ((Date.now() % 100000) + 7) | 0);
  let runner: Runner | null = null;
  let over = false;

  function finish(a: Arena): void {
    if (over) return;
    over = true;
    runner?.destroy();
    runner = null;
    const who =
      a.winner < 0 ? "两边打成平手" : ai ? (a.winner === 0 ? "朵朵赢啦" : `${AI_12[ai].name}赢啦`) : `${P_NAME[a.winner]}赢啦`;
    const ov = panel(`🎉 ${who}`, [
      `${a.reason}。`,
      `雪灯笼 ${liveFoes(a, 0).length} : ${liveFoes(a, 1).length}。被砸中的人拍拍雪就好,一点都不疼。`,
      "下一局试试:蹲在雪坡后面攒满三颗,再站起来连投两发。",
    ]);
    const again = document.createElement("button");
    again.type = "button";
    again.className = `snf-open ${ai ? "snf-open-ai" : "snf-open-vs"}`;
    again.textContent = "🔁 再来一局";
    again.addEventListener("click", () => {
      api.play("tap");
      box.remove();
      mountDuel(host, api, back, ai);
    });
    const home = document.createElement("button");
    home.type = "button";
    home.className = "snf-back";
    home.textContent = "← 回选关";
    home.addEventListener("click", () => {
      api.play("tap");
      back();
    });
    const row = document.createElement("div");
    row.className = "snf-acts";
    row.append(again, home);
    ov.appendChild(row);
    stage.appendChild(ov);
  }

  runner = mountRun(stage, (n) => api.play(n), {
    arena,
    viewW: FIELD_W_12,
    humans: ai ? 1 : 2,
    hint: ai
      ? `对面的灯笼躲在掩体后面,抬高角度绕过去。砸中${AI_12[ai].name}他会变 1.5 秒雪人,那正是你连投的机会。`
      : `两个人同时玩,键位各管各的:${P_KEYS[0]};${P_KEYS[1]}。`,
    onEnd: finish,
  });

  backBtn.addEventListener("click", () => {
    api.play("tap");
    back();
  });

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      box.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽「雪季」:一波比一波准
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const box = document.createElement("div");
  box.className = "snf-mode";
  const head = document.createElement("div");
  head.className = "snf-mhead";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "snf-back";
  backBtn.textContent = "← 回选关";
  const title = document.createElement("span");
  title.className = "snf-chip";
  title.textContent = "♾️ 无尽雪季 · 一波比一波准";
  head.append(backBtn, title);
  const stage = document.createElement("div");
  box.append(head, stage);
  host.appendChild(box);

  const arena = endlessArena((Date.now() % 100000) | 0);
  let runner: Runner | null = null;
  let over = false;

  function finish(a: Arena): void {
    if (over) return;
    over = true;
    const best = save.recordEndlessBest(meta.id, a.wave);
    runner?.destroy();
    runner = null;
    const ov = panel(`🌼 顶到了第 ${a.wave} 波`, [
      seasonLine(a.wave, a.melted, best),
      "下次先拦最靠前的那一个;蹲在雪坡后面搓雪最安全,雪墙能替你挡三下。",
    ]);
    const again = document.createElement("button");
    again.type = "button";
    again.className = "snf-open";
    again.textContent = "🔁 再来一轮";
    again.addEventListener("click", () => {
      api.play("tap");
      box.remove();
      mountEndless(host, api, back);
    });
    const home = document.createElement("button");
    home.type = "button";
    home.className = "snf-back";
    home.textContent = "← 回选关";
    home.addEventListener("click", () => {
      api.play("tap");
      back();
    });
    const row = document.createElement("div");
    row.className = "snf-acts";
    row.append(again, home);
    ov.appendChild(row);
    stage.appendChild(ov);
  }

  runner = mountRun(stage, (n) => api.play(n), {
    arena,
    viewW: VIEW_W,
    humans: 1,
    hint: "雪季不会停,雪人一波比一波准。手里最多三颗,趁没人扔过来的时候蹲下多搓两颗。",
    extraChips: (a) => [`🌊 第 ${a.wave} 波`, `🌼 化掉 ${a.melted}`],
    onEnd: finish,
  });

  backBtn.addEventListener("click", () => {
    api.play("tap");
    back();
  });

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      box.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载:模式条 + 188 关地图 + 平台直达
// ---------------------------------------------------------------------------

export interface SnowFightHandle {
  destroy: () => void;
  /**
   * 平台「直达第 N 关」(1 基),返回真正打开的那一关。
   *
   * 本款的选关地图走平台的 `mountLevelGame`,而它只吐一个 `destroy`,
   * 没有「从第 N 关开始」的入口,所以自己开一条直达通道。越界会夹到 1..188。
   */
  openCampaignLevel: (n: number) => number;
}

/** 壳层没传 `initialLevel` 时,也认地址栏上的 `?level=N`(1 基) */
export function levelFromQuery(search: string | null): number | null {
  if (!search) return null;
  const raw = new URLSearchParams(search).get("level");
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
}

export function mount(api: GameApi): SnowFightHandle {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "snf-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let mode: { destroy: () => void } | null = null;
  let direct: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    direct?.destroy();
    direct = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, back: () => void) => { destroy: () => void }): void {
    if (mode || direct) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "snf-open snf-open-vs";
  vsBtn.textContent = "⚔️ 双人对战";
  vsBtn.addEventListener("click", () => openMode((h, a2, b) => mountDuel(h, a2, b, null)));

  // 三档人机的短名字:手机上一行放得下才不会把画面挤到屏幕外面
  const AI_SHORT: Record<AiLevel, string> = { easy: "🤖 简单", normal: "🤖 普通", hard: "🤖 会算风" };
  const aiBtns = (["easy", "normal", "hard"] as AiLevel[]).map((level) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "snf-open snf-open-ai";
    b.textContent = AI_SHORT[level];
    b.title = aiTitle(level);
    b.setAttribute("aria-label", `人机对战 ${AI_12[level].name}`);
    b.addEventListener("click", () => openMode((h, a2, backTo) => mountDuel(h, a2, backTo, level)));
    return b;
  });

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "snf-open";
  endlessBtn.addEventListener("click", () => openMode(mountEndless));

  bar.append(vsBtn, ...aiBtns, endlessBtn);

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽雪季 · 最好 第 ${best} 波` : "♾️ 无尽雪季 · 点我开始!";
  }
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "落点圈套住靶子再松手。手里最多三颗,蹲下搓 0.6 秒一颗——蹲着最安全,但蹲着扔不出去。",
      grandMessage: `${LEVEL_TOTAL} 关全部打完,躲、搓、投三拍子你都拿捏住了,你就是雪原上的投手!`,
      guide,
      guideTitle: "雪球大作战 · 雪原手记",
    }
  );

  /**
   * 不经过选关地图,直接把第 index 关(0 基)摆上来。
   *
   * 星级仍旧写平台那份 `l99` 存档,小星星也只补「比历史最好成绩多出来的那几颗」——
   * 和从地图点进去玩完全是同一份进度,直达通道不会变成刷星的后门。
   */
  function openDirectLevel(index: number): void {
    const i = Math.max(0, Math.min(LEVEL_TOTAL - 1, Math.round(index)));
    mode?.destroy();
    mode = null;
    direct?.destroy();
    direct = null;
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    modeHost.innerHTML = "";

    const ci = chapterIndexOf(i);
    const ch = CHAPTERS[ci] as Chapter;
    const topbar = document.createElement("div");
    topbar.className = "snf-mhead";
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "snf-back";
    backBtn.textContent = "🗺️ 选关地图";
    backBtn.addEventListener("click", () => {
      api.play("tap");
      closeMode();
    });
    const label = document.createElement("span");
    label.className = "snf-chip";
    label.textContent = `${ch.emoji} ${ch.name} · 第 ${i + 1} 关`;
    topbar.append(backBtn, label);
    // 跳关:壳层没注册 requestSkip 就不挂按钮,单测环境保持干净
    const request = getLevelExtras().requestSkip;
    if (request && i + 1 < LEVEL_TOTAL) {
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "snf-back snf-skip";
      skip.textContent = `⏭️ 跳过 第${i + 1}关`;
      skip.title = "需要家长确认才能跳过这一关";
      skip.addEventListener("click", () => {
        api.play("tap");
        skip.disabled = true;
        Promise.resolve(request(meta.id, i))
          .then((ok) => {
            skip.disabled = false;
            if (ok) openDirectLevel(i + 1);
          })
          .catch(() => {
            skip.disabled = false;
          });
      });
      topbar.appendChild(skip);
    }
    const stage = document.createElement("div");
    modeHost.append(topbar, stage);

    let handle: PlayHandle | undefined;
    let settled = false;

    function settle(title: string, msg: string, buttons: Array<{ label: string; go: () => void }>): void {
      handle?.destroy?.();
      handle = undefined;
      stage.innerHTML = "";
      const ov = panel(title, [msg]);
      const row = document.createElement("div");
      row.className = "snf-acts";
      for (const b of buttons) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "snf-open";
        btn.textContent = b.label;
        btn.addEventListener("click", () => {
          api.play("tap");
          b.go();
        });
        row.appendChild(btn);
      }
      ov.appendChild(row);
      stage.appendChild(ov);
    }

    const ctx: PlayCtx = {
      level: i,
      chapter: ch,
      chapterIndex: ci,
      indexInChapter: i - chapterStartOf(ci),
      win: (stars, msg) => {
        if (settled) return;
        settled = true;
        const prev = loadStars(meta.id)[i] ?? 0;
        saveStar(meta.id, i, stars);
        if (stars > prev) api.addStars(stars - prev);
        api.play("win");
        const buttons: Array<{ label: string; go: () => void }> = [];
        if (i + 1 < LEVEL_TOTAL) buttons.push({ label: "下一关 ▶", go: () => openDirectLevel(i + 1) });
        buttons.push({ label: "🔁 再玩一次", go: () => openDirectLevel(i) });
        buttons.push({ label: "🗺️ 选关地图", go: () => closeMode() });
        settle(`⭐ 第 ${i + 1} 关过关!`, msg ?? "扔得漂亮!", buttons);
      },
      lose: (msg) => {
        if (settled) return;
        settled = true;
        api.play("oops");
        settle("⛄ 就差一点点", msg ?? "再来一次一定行!", [
          { label: "🔁 再试一次", go: () => openDirectLevel(i) },
          { label: "🗺️ 选关地图", go: () => closeMode() },
        ]);
      },
      sfx: (n) => api.play(n),
      bonusStars: (n) => api.addStars(n),
    };

    handle = playLevel(stage, ctx) ?? undefined;
    direct = {
      destroy() {
        handle?.destroy?.();
        handle = undefined;
        modeHost.innerHTML = "";
      },
    };
  }

  function openCampaignLevel(n: number): number {
    const i = Math.max(0, Math.min(LEVEL_TOTAL - 1, Math.round(n) - 1));
    openDirectLevel(i);
    return i + 1;
  }

  const jumpTo =
    (api as { initialLevel?: number }).initialLevel ??
    levelFromQuery(typeof location === "object" ? location.search : null);
  if (jumpTo !== null && jumpTo !== undefined && jumpTo >= 1) openCampaignLevel(jumpTo);

  return {
    openCampaignLevel,
    destroy() {
      mode?.destroy();
      mode = null;
      direct?.destroy();
      direct = null;
      level.destroy();
      stopSpeaking();
      root.remove();
    },
  };
}

/** 给首页玩法说明用:这一款到底有哪几种玩法 */
export const MODE_LABELS: readonly string[] = ["188 关闯关", "双人对战", "人机对战(三档)", "无尽雪季"];

/** 评一评无尽成绩(波次越高越好) */
export function rateEndless(wave: number): 1 | 2 | 3 {
  return rateAbove(wave, 10, 5);
}

/** 给用例与文档用:远排到底抬高了多少(伪纵深的那个数) */
export const FAR_ROW_LIFT = ROW_LIFT;

/** 对战一局最长打多久 */
export const DUEL_CLOCK = DUEL_TIME;

/** 满蓄力要按住多久 */
export const FULL_CHARGE_SECONDS = CHARGE_MAX;

/** 站在这儿还能搓几颗(HUD 与用例共用同一个口径) */
export function scoopsLeftAt(a: Arena, x: number): number {
  return ballsLeftAt(a.field, x);
}

/** 这一处的积雪厚度(用例检查「挖秃了」时用) */
export function snowDepthAt(a: Arena, x: number): number {
  return depthAt(a.field, x);
}
