import { meta } from "./meta";
export { meta };

// 小怪物危机 1.2 —— 玩家角色亲自上场的动作防守。
//
// 家摆在场地正中间,小怪物从四面八方围上来想把元气罐抱走。
// 你就是场上那个小人:摇杆走位、技能钮出手,每 3 波从三张成长卡里挑一张
// (长手刷 / 快手腕 / 多彩喷 / 吸吸糖 / 护盾泡),越打越顺手。
//
// 被撞到只是「转个圈、晕一下」,小怪物被涂满就「变成小云朵飘走」——
// 全程没有一点伤害描写,守不住也只说下一次怎么办。
//
// 四种玩法:188 关八大章节闯关、无尽波次(每 5 波小 boss、每 10 波换场景)、
// 双人合作(共享波次、各自成长)、一人一半的对战(先失守的那边输)。
//
// 世界怎么动全在 `arena.ts`(纯逻辑、可无头回放);这里只负责画出来、
// 收手指和键盘、把引擎吐出来的事件翻译成 `api.play` 的音效与一句飘字。
import {
  type Chapter,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
  type SoundName,
  chapterOf,
  chapterStart,
  loadStars,
  mountLevelGame,
  saveStar,
} from "../level99";
import { save } from "../../engine/save";
import guide from "./guide";
import {
  ARENA_H,
  ARENA_W,
  type ArenaEvent,
  type ArenaInput,
  type ArenaMonster,
  type ArenaResult,
  type ArenaState,
  BEHAVIOR_INFO,
  COOP_WAVES,
  HERO_R,
  HOME_R,
  SCENE_COUNT,
  VERSUS_WAVES,
  arenaEndlessWave,
  chooseGrowth,
  createArena,
  createCampaignArena,
  disposeArena,
  stepArena,
  waveLabel,
} from "./arena";
import {
  GROWTH_CARDS,
  type GrowthState,
  growthBadges,
} from "./growth";
import { deviceTier, particleBudget } from "./pool";
import {
  arenaCoopLine,
  arenaEndlessLine,
  arenaLoseLine,
  arenaVersusLine,
  arenaWinLine,
  draftTitle,
} from "./copy";
import { MONSTER_COLOR, MONSTER_INFO, campaignStars, formatClock } from "./logic";
import { CHAPTERS, LEVELS, TOTAL, buildCoopWave, endlessLevelIndex } from "./levels";

/* ------------------------------------------------------------------ */
/* 配色与样式(类名一律 mcr- 前缀,样式只挂在自己这棵树上)                 */
/* ------------------------------------------------------------------ */

const P_COLOR = ["#e6558f", "#3f7fd6"];
const P_NAME = ["朵朵", "星星"];

/** 八套场景皮:无尽每 10 波换一套,闯关按章节取。 */
const SCENE_SKY = ["#fff3f8", "#fff6ec", "#f4fbea", "#eef7ff", "#f2eeff", "#fff0fa", "#eef6f6", "#f8f0ff"];
const SCENE_GROUND = ["#dcefd0", "#ffdfb8", "#d6ecbf", "#cbe4fb", "#dad2f5", "#ffd4ee", "#cfe5e3", "#e4d2ff"];
const SCENE_NAME = [
  "自家小院",
  "彩虹街区",
  "叮咚学校",
  "咕噜游乐园",
  "月光工厂",
  "云朵糖果城",
  "星星电影院",
  "彩虹总部",
];

const CSS = `
.mcr-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column;gap:8px;position:relative;}
.mcr-hud{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;}
.mcr-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:14px;font-weight:900;color:#5f4e8c;
  box-shadow:0 2px 6px rgba(150,140,180,.22);white-space:nowrap;line-height:1.3;}
.mcr-chip-warn{background:#ffe6f0;color:#b8386e;}
.mcr-chip-p1{color:#b83a6e;}
.mcr-chip-p2{color:#2f5fa8;}
.mcr-hudbtn{border:none;border-radius:999px;min-width:44px;min-height:44px;font-size:18px;cursor:pointer;
  font-family:inherit;background:#ffffffe0;color:#5f4e8c;box-shadow:0 3px 0 rgba(140,120,190,.3);}
.mcr-hudbtn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(140,120,190,.3);}
.mcr-stage{position:relative;display:flex;justify-content:center;}
.mcr-canvas{display:block;max-width:100%;border-radius:18px;background:#fff6fb;touch-action:none;
  box-shadow:0 3px 12px rgba(160,140,200,.24);}
.mcr-say{position:absolute;top:8px;left:50%;transform:translateX(-50%);background:#ffffffe8;border-radius:999px;
  padding:5px 14px;font-size:14px;font-weight:800;color:#7a4f9c;pointer-events:none;max-width:92%;
  text-align:center;box-shadow:0 2px 8px rgba(150,130,190,.25);}
.mcr-say[hidden]{display:none;}
.mcr-pads{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:96px;}
.mcr-pad{display:flex;align-items:center;gap:10px;}
.mcr-pad-r{flex-direction:row-reverse;}
.mcr-stick{position:relative;width:92px;height:92px;border-radius:50%;background:#f1ecff;
  box-shadow:inset 0 3px 10px rgba(120,100,170,.22);touch-action:none;cursor:pointer;flex:0 0 auto;}
.mcr-knob{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;
  background:#fff;box-shadow:0 3px 8px rgba(120,100,170,.35);pointer-events:none;}
.mcr-fire{border:none;border-radius:50%;width:74px;height:74px;min-width:44px;min-height:44px;font-size:28px;
  cursor:pointer;font-family:inherit;color:#a8305f;background:#ffdbe8;box-shadow:0 4px 0 rgba(200,110,150,.45);
  touch-action:none;flex:0 0 auto;}
.mcr-fire:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(200,110,150,.45);}
.mcr-fire-p2{color:#2f5fa8;background:#dbe8ff;box-shadow:0 4px 0 rgba(110,150,200,.45);}
.mcr-fire-p2:active{box-shadow:0 1px 0 rgba(110,150,200,.45);}
.mcr-padname{font-size:13px;font-weight:900;text-align:center;}
.mcr-tip{text-align:center;font-size:14px;font-weight:700;color:#6f6390;line-height:1.5;}
.mcr-layer{position:absolute;inset:0;background:rgba(255,250,253,.96);border-radius:18px;z-index:9;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;
  padding:12px;overflow-y:auto;}
.mcr-layer-t{font-size:19px;font-weight:900;color:#6a4fa8;}
.mcr-layer-s{font-size:14px;font-weight:700;color:#6f6390;line-height:1.55;max-width:340px;}
.mcr-cards{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;width:100%;max-height:62vh;overflow-y:auto;
  padding:2px;}
.mcr-card{border:none;border-radius:16px;padding:10px 12px;cursor:pointer;font-family:inherit;background:#fff;
  color:#5b4a7a;box-shadow:0 4px 0 rgba(140,120,190,.3);display:flex;flex-direction:column;align-items:center;
  gap:3px;min-width:132px;min-height:44px;flex:1 1 132px;max-width:190px;}
.mcr-card:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(140,120,190,.3);}
.mcr-card-emoji{font-size:26px;line-height:1.1;}
.mcr-card-name{font-size:16px;font-weight:900;}
.mcr-card-desc{font-size:13px;font-weight:700;color:#7c6f9b;line-height:1.4;}
.mcr-card-lv{font-size:12px;font-weight:800;color:#a08fc0;}
.mcr-btn{border:none;border-radius:999px;padding:11px 20px;font-size:16px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;min-height:44px;background:linear-gradient(180deg,#8f7ae0,#6f57c8);
  box-shadow:0 4px 0 #57429f;}
.mcr-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #57429f;}
.mcr-btn-co{background:linear-gradient(180deg,#68c2a0,#48a683);box-shadow:0 4px 0 #35805f;}
.mcr-btn-co:active{box-shadow:0 2px 0 #35805f;}
.mcr-btn-vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.mcr-btn-vs:active{box-shadow:0 2px 0 #b04a6c;}
.mcr-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:8px;}
.mcr-bar[hidden]{display:none;}
.mcr-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#f6f2ff,#fff4f8);display:flex;flex-direction:column;gap:8px;}
.mcr-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.mcr-back{border:none;border-radius:999px;padding:9px 15px;font-size:15px;font-weight:900;cursor:pointer;
  min-height:44px;font-family:inherit;background:#ffffffe0;color:#6a52a0;box-shadow:0 3px 0 rgba(120,90,160,.28);}
.mcr-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.28);}
.mcr-over{border-radius:16px;background:#fffdfa;padding:16px;text-align:center;display:flex;
  flex-direction:column;gap:10px;align-items:center;box-shadow:0 3px 10px rgba(160,150,190,.25);}
.mcr-over-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.mcr-hudbtn:focus-visible,.mcr-fire:focus-visible,.mcr-card:focus-visible,.mcr-btn:focus-visible,
.mcr-back:focus-visible,.mcr-stick:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
/* 手机竖屏 360px:字号一律 ≥14px,摇杆和技能钮的热区一律 ≥44px,谁也不许被挤出屏幕 */
@media (max-width:420px){
  .mcr-wrap{gap:6px;}
  .mcr-chip{font-size:14px;padding:4px 9px;}
  .mcr-hud{gap:4px;}
  .mcr-stick{width:84px;height:84px;}
  .mcr-knob{width:44px;height:44px;margin:-22px 0 0 -22px;}
  .mcr-fire{width:64px;height:64px;font-size:24px;}
  .mcr-pads{min-height:86px;gap:4px;}
  .mcr-pad{gap:6px;}
  .mcr-tip{font-size:14px;line-height:1.4;}
  .mcr-card{min-width:118px;flex:1 1 118px;}
  .mcr-cards{max-height:52vh;}
}
@media (prefers-reduced-motion:reduce){
  .mcr-fire:active,.mcr-btn:active,.mcr-card:active,.mcr-back:active,.mcr-hudbtn:active{transform:none;}
}
`;

/* ------------------------------------------------------------------ */
/* 画笔:全部程序化绘制,一张外部图片都不用                                */
/* ------------------------------------------------------------------ */

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return `rgb(${r},${g},${b})`;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** 两只圆眼睛 + 一张笑嘴:全员卡通,凶不起来。 */
function drawFace(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, blink: boolean): void {
  const ex = r * 0.34;
  c.fillStyle = "#fff";
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(cx + s * ex, cy - r * 0.1, r * 0.24, blink ? r * 0.05 : r * 0.26, 0, 0, Math.PI * 2);
    c.fill();
  }
  if (!blink) {
    c.fillStyle = "#3d3350";
    for (const s of [-1, 1]) {
      c.beginPath();
      c.arc(cx + s * ex, cy - r * 0.06, r * 0.12, 0, Math.PI * 2);
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

/** 地面阴影:2D 俯视里唯一的「立体」,近的画在上面靠 y 轴排序。 */
function drawShadow(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.fillStyle = "rgba(110,95,150,.13)";
  c.beginPath();
  c.ellipse(x, y + r * 0.72, r * 0.9, r * 0.42, 0, 0, Math.PI * 2);
  c.fill();
}

/**
 * 五种行为五种外形,不是只换个颜色:
 * 直冲 = 圆脑袋加一个冲刺尖角、绕行 = 转着的风车星、吐泡泡 = 圆气球顶着长喇叭、
 * 召唤 = 高个蛋壳背着小豆子、精英 = 六边形正面顶着一块盾。
 */
function drawMonster(c: CanvasRenderingContext2D, m: ArenaMonster, t: number, motion: boolean): void {
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
  c.fillStyle = fill;

  if (m.behavior === "rush") {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // 冲刺尖角:一眼看出它奔着哪儿去
    c.beginPath();
    c.moveTo(x + Math.cos(ang) * (r + 8), y + Math.sin(ang) * (r + 8));
    c.lineTo(x + Math.cos(ang + 2.4) * r, y + Math.sin(ang + 2.4) * r);
    c.lineTo(x + Math.cos(ang - 2.4) * r, y + Math.sin(ang - 2.4) * r);
    c.closePath();
    c.fill();
    c.stroke();
  } else if (m.behavior === "weave") {
    const spin = motion ? t * 3 + m.phase : m.phase;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = spin + (i / 10) * Math.PI * 2;
      const rad = i % 2 === 0 ? r * 1.15 : r * 0.55;
      const px2 = x + Math.cos(a) * rad;
      const py2 = y + Math.sin(a) * rad;
      if (i === 0) c.moveTo(px2, py2);
      else c.lineTo(px2, py2);
    }
    c.closePath();
    c.fill();
    c.stroke();
  } else if (m.behavior === "spit") {
    // 飘着的气球:身子和影子离得远一点,看着就在天上
    c.beginPath();
    c.ellipse(x, y - r * 0.5, r * 0.92, r * 1.02, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.strokeStyle = shade(fill, 0.5);
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y - r * 0.5);
    c.lineTo(x + Math.cos(ang) * (r + 9), y - r * 0.5 + Math.sin(ang) * (r + 9));
    c.stroke();
    c.fillStyle = shade(fill, 0.85);
    c.beginPath();
    c.arc(x + Math.cos(ang) * (r + 10), y - r * 0.5 + Math.sin(ang) * (r + 10), r * 0.34, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  } else if (m.behavior === "summon") {
    roundRect(c, x - r * 0.72, y - r * 1.15, r * 1.44, r * 2.1, r * 0.7);
    c.fill();
    c.stroke();
    // 背上那几颗小豆子就是待会儿要蹦出来的小跟班
    c.fillStyle = shade(fill, 0.82);
    for (let i = 0; i < Math.min(3, m.summons); i++) {
      c.beginPath();
      c.arc(x - r * 0.5 + i * r * 0.5, y + r * 0.8, r * 0.24, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = shade(fill, 0.5);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, y - r * 1.15);
    c.lineTo(x, y - r * 1.65);
    c.stroke();
    c.fillStyle = "#ffd7ea";
    c.beginPath();
    c.arc(x, y - r * 1.75, r * 0.2, 0, Math.PI * 2);
    c.fill();
  } else {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = ang + (i / 6) * Math.PI * 2;
      const px2 = x + Math.cos(a) * r * 1.05;
      const py2 = y + Math.sin(a) * r * 1.05;
      if (i === 0) c.moveTo(px2, py2);
      else c.lineTo(px2, py2);
    }
    c.closePath();
    c.fill();
    c.stroke();
  }

  // 精英怪正面那块盾:挡一下掉一格,掉光就没了(绕到侧后方就打得着)
  if (m.shield > 0) {
    const left = m.shield / Math.max(1, m.shieldMax);
    c.strokeStyle = m.blockFlash > 0 && motion ? "#ffffff" : "#9fd0ff";
    c.lineWidth = 5;
    c.lineCap = "round";
    c.beginPath();
    c.arc(x, y, r + 6, ang - 1.15 * left - 0.1, ang + 1.15 * left + 0.1);
    c.stroke();
  }

  const blink = motion && Math.sin(t * 1.7 + m.phase * 2) > 0.96;
  drawFace(c, x, m.behavior === "spit" ? y - r * 0.55 : y, r * 0.8, blink);

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
  }
  c.restore();

  // 上色进度条:被涂过才显示,没挨过颜料的头顶干干净净
  if (m.hp < m.maxHp) {
    const w = r * 2;
    const by = y - r * (m.boss ? 1.75 : 1.5);
    c.fillStyle = "rgba(255,255,255,.85)";
    roundRect(c, x - w / 2, by, w, 4.5, 2.2);
    c.fill();
    c.fillStyle = "#7fd6a3";
    roundRect(c, x - w / 2, by, (w * Math.max(0, m.hp)) / m.maxHp, 4.5, 2.2);
    c.fill();
  }
}

function drawHero(
  c: CanvasRenderingContext2D,
  h: { x: number; y: number; fx: number; fy: number; spin: number; invuln: number; windup: number; shields: number; idx: number },
  t: number,
  motion: boolean
): void {
  const col = P_COLOR[h.idx] ?? P_COLOR[0];
  drawShadow(c, h.x, h.y, HERO_R);
  c.save();
  if (h.invuln > 0 && motion) c.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 16));
  // 转圈:整个人打着转,晕头转向但一点都不疼
  const spinAngle = h.spin > 0 ? t * 12 : 0;
  c.translate(h.x, h.y);
  c.rotate(spinAngle);
  c.lineWidth = 2.6;
  c.strokeStyle = shade(col, 0.68);
  c.fillStyle = col;
  c.beginPath();
  c.arc(0, 0, HERO_R, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // 举着的刷子:前摇时往回收,甩出去的一瞬间伸到最长
  const ang = Math.atan2(h.fy, h.fx);
  const reach = HERO_R + 5 + (h.windup > 0 ? -3 : 8);
  c.strokeStyle = "#8a6a4a";
  c.lineWidth = 3.4;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(Math.cos(ang) * 4, Math.sin(ang) * 4);
  c.lineTo(Math.cos(ang) * reach, Math.sin(ang) * reach);
  c.stroke();
  c.fillStyle = "#fff";
  c.beginPath();
  c.arc(Math.cos(ang) * (reach + 3), Math.sin(ang) * (reach + 3), 3.6, 0, Math.PI * 2);
  c.fill();
  drawFace(c, 0, 0, HERO_R * 0.85, false);
  c.restore();

  // 护盾泡:身上挂着几个就画几个
  for (let i = 0; i < h.shields; i++) {
    const a = t * 1.6 + (i / Math.max(1, h.shields)) * Math.PI * 2;
    c.strokeStyle = "rgba(150,205,255,.85)";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(h.x + Math.cos(a) * (HERO_R + 7), h.y + Math.sin(a) * (HERO_R + 7), 5, 0, Math.PI * 2);
    c.stroke();
  }
  if (h.spin > 0) {
    c.fillStyle = "#ffd66b";
    for (let i = 0; i < 3; i++) {
      const a = t * 9 + (i / 3) * Math.PI * 2;
      c.beginPath();
      c.arc(h.x + Math.cos(a) * (HERO_R + 9), h.y - HERO_R - 6 + Math.sin(a) * 4, 2.6, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function drawHome(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  jars: number,
  maxJars: number,
  color: string
): void {
  // 判定圈:小怪物碰到这一圈就抱走一罐,画清楚孩子才知道底线在哪
  c.strokeStyle = "rgba(150,120,190,.35)";
  c.setLineDash([7, 6]);
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x, y, HOME_R, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);

  c.fillStyle = "#fff";
  c.strokeStyle = color;
  c.lineWidth = 3;
  roundRect(c, x - 16, y - 12, 32, 24, 7);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(x - 20, y - 12);
  c.lineTo(x, y - 26);
  c.lineTo(x + 20, y - 12);
  c.closePath();
  c.fillStyle = color;
  c.fill();

  // 家门口的元气罐:被抱走一罐就灭一个
  for (let i = 0; i < maxJars; i++) {
    const a = (i / maxJars) * Math.PI * 2 - Math.PI / 2;
    const jx = x + Math.cos(a) * (HOME_R - 5);
    const jy = y + Math.sin(a) * (HOME_R - 5);
    const on = i < jars;
    c.fillStyle = on ? "#ff9ec4" : "#e7e1ee";
    c.strokeStyle = on ? "#d9628a" : "#cfc7dd";
    c.lineWidth = 2;
    roundRect(c, jx - 4, jy - 5, 8, 10, 2.5);
    c.fill();
    c.stroke();
  }
}

/* ------------------------------------------------------------------ */
/* 画布尺寸                                                            */
/* ------------------------------------------------------------------ */

/**
 * 战场画多大:手机竖屏要给底下的摇杆和技能钮留够位置,
 * 所以按屏幕高度切一刀,再按原始长宽比换算宽度(永远不拉变形)。
 */
export function arenaCanvasSize(availW: number, viewportW: number, viewportH: number): { w: number; h: number } {
  const vh = viewportH > 0 ? viewportH : 700;
  const budget = Math.max(150, Math.round(vh * (viewportW >= 700 ? 0.5 : 0.4)));
  const wide = Math.max(220, availW > 0 ? availW : 320);
  const w = Math.min(wide, 720, (budget * ARENA_W) / ARENA_H);
  return { w: Math.round(w), h: Math.round((w * ARENA_H) / ARENA_W) };
}

/* ------------------------------------------------------------------ */
/* 战场视图                                                            */
/* ------------------------------------------------------------------ */

interface ViewOptions {
  state: ArenaState;
  title: string;
  hint: string;
  /** 场景皮下标(闯关按章节,无尽按波数) */
  scene: number;
  sfx: (n: SoundName) => void;
  onDone: (res: ArenaResult) => void;
}

interface ViewHandle {
  destroy: () => void;
}

function createArenaView(host: HTMLElement, opts: ViewOptions): ViewHandle {
  const state = opts.state;
  const doc = host.ownerDocument ?? document;
  const view = doc.defaultView ?? window;
  const players = state.heroes.length;
  const versus = state.mode === "versus";
  const reduced = !!view.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  state.particleCap = particleBudget(
    deviceTier((view.navigator as { hardwareConcurrency?: number } | undefined)?.hardwareConcurrency, view.innerWidth ?? 400),
    reduced
  );

  const wrap = doc.createElement("div");
  wrap.className = "mcr-wrap";

  /* ---- 顶上那一行:波次 / 元气 / 成长图标 ---- */
  const hud = doc.createElement("div");
  hud.className = "mcr-hud";
  const waveChip = doc.createElement("span");
  waveChip.className = "mcr-chip";
  const jarChips: HTMLElement[] = [];
  for (let s = 0; s < state.homes.length; s++) {
    const chip = doc.createElement("span");
    chip.className = "mcr-chip";
    jarChips.push(chip);
  }
  const growthChips: HTMLElement[] = [];
  for (let i = 0; i < players; i++) {
    const chip = doc.createElement("span");
    chip.className = `mcr-chip mcr-chip-p${i + 1}`;
    growthChips.push(chip);
  }
  const pauseBtn = doc.createElement("button");
  pauseBtn.type = "button";
  pauseBtn.className = "mcr-hudbtn";
  pauseBtn.textContent = "⏸";
  pauseBtn.setAttribute("aria-label", "暂停");
  hud.append(waveChip, ...jarChips, ...growthChips, pauseBtn);

  /* ---- 战场 ---- */
  const stage = doc.createElement("div");
  stage.className = "mcr-stage";
  const canvas = doc.createElement("canvas");
  canvas.className = "mcr-canvas";
  canvas.width = ARENA_W * 2;
  canvas.height = ARENA_H * 2;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${opts.title}:家在正中间,小怪物从四面八方围上来`);
  const say = doc.createElement("div");
  say.className = "mcr-say";
  say.hidden = true;
  stage.append(canvas, say);

  /* ---- 摇杆左下、技能钮右下 ---- */
  const pads = doc.createElement("div");
  pads.className = "mcr-pads";
  const tip = doc.createElement("div");
  tip.className = "mcr-tip";
  tip.textContent = opts.hint;

  wrap.append(hud, stage, pads, tip);
  host.appendChild(wrap);

  const c2d = canvas.getContext("2d");

  /* ---------------- 输入 ---------------- */

  const inputs: ArenaInput[] = [];
  for (let i = 0; i < players; i++) inputs.push({ mx: 0, my: 0, fire: false });
  const keyDir: Array<{ up: boolean; down: boolean; left: boolean; right: boolean }> = [
    { up: false, down: false, left: false, right: false },
    { up: false, down: false, left: false, right: false },
  ];
  const keyFire = [false, false];
  const stickDir: Array<{ x: number; y: number }> = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  const padFire = [false, false];

  const KEYS: Array<Record<string, "up" | "down" | "left" | "right">> = [
    { w: "up", W: "up", s: "down", S: "down", a: "left", A: "left", d: "right", D: "right" },
    { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" },
  ];
  const FIRE_KEYS = [new Set(["f", "F", " ", "Spacebar"]), new Set(["l", "L", "Enter"])];

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      togglePause();
      return;
    }
    for (let p = 0; p < 2; p++) {
      const slot = players === 1 ? 0 : p;
      const dir = KEYS[p][e.key];
      if (dir) {
        keyDir[slot][dir] = true;
        e.preventDefault();
        return;
      }
      if (FIRE_KEYS[p].has(e.key)) {
        keyFire[slot] = true;
        e.preventDefault();
        return;
      }
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    for (let p = 0; p < 2; p++) {
      const slot = players === 1 ? 0 : p;
      const dir = KEYS[p][e.key];
      if (dir) keyDir[slot][dir] = false;
      if (FIRE_KEYS[p].has(e.key)) keyFire[slot] = false;
    }
  }

  view.addEventListener("keydown", onKeyDown);
  view.addEventListener("keyup", onKeyUp);

  /**
   * 一套「摇杆 + 技能钮」。单人时摇杆钉在左下角、技能钮钉在右下角(规格第八节);
   * 双人时两人各占一边,自己的摇杆永远在自己那一侧的外角上。
   */
  function buildPad(player: number, split: boolean): void {
    const pad = doc.createElement("div");
    pad.className = `mcr-pad${player === 1 ? " mcr-pad-r" : ""}`;
    const stick = doc.createElement("div");
    stick.className = "mcr-stick";
    stick.setAttribute("role", "button");
    stick.setAttribute("aria-label", `${P_NAME[player]}的摇杆,按住拖着走`);
    stick.tabIndex = 0;
    const knob = doc.createElement("div");
    knob.className = "mcr-knob";
    knob.style.background = player === 1 ? "#e5eeff" : "#fff";
    stick.appendChild(knob);

    const fire = doc.createElement("button");
    fire.type = "button";
    fire.className = `mcr-fire${player === 1 ? " mcr-fire-p2" : ""}`;
    fire.textContent = "🎨";
    fire.setAttribute("aria-label", `${P_NAME[player]}甩颜料弹`);

    let stickId: number | null = null;
    const setKnob = (dx: number, dy: number): void => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const moveStick = (e: PointerEvent): void => {
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rad = rect.width / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      const max = Math.max(1, rad - 12);
      if (d > max) {
        dx = (dx / d) * max;
        dy = (dy / d) * max;
      }
      stickDir[player] = { x: dx / max, y: dy / max };
      setKnob(dx, dy);
    };
    const endStick = (): void => {
      stickId = null;
      stickDir[player] = { x: 0, y: 0 };
      setKnob(0, 0);
    };
    stick.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      stickId = e.pointerId;
      stick.setPointerCapture?.(e.pointerId);
      moveStick(e);
    });
    stick.addEventListener("pointermove", (e) => {
      if (stickId !== e.pointerId) return;
      e.preventDefault();
      moveStick(e);
    });
    stick.addEventListener("pointerup", endStick);
    stick.addEventListener("pointercancel", endStick);
    stick.addEventListener("lostpointercapture", endStick);

    const fireOn = (e: Event): void => {
      e.preventDefault();
      padFire[player] = true;
    };
    const fireOff = (): void => {
      padFire[player] = false;
    };
    fire.addEventListener("pointerdown", fireOn);
    fire.addEventListener("pointerup", fireOff);
    fire.addEventListener("pointerleave", fireOff);
    fire.addEventListener("pointercancel", fireOff);
    // 键盘 / 读屏用户:回车空格触发 click,给一发单点
    fire.addEventListener("click", () => {
      padFire[player] = true;
      clickFireLeft[player] = 0.12;
    });

    if (split) {
      // 单人:摇杆真的贴左下,技能钮真的贴右下,中间那块留给键盘说明
      const note = doc.createElement("div");
      note.className = "mcr-padname";
      note.style.color = "#7c6f9b";
      note.textContent = "键盘 W A S D 走位 · F 甩";
      pads.append(stick, note, fire);
      return;
    }
    pad.append(stick, fire);
    pads.appendChild(pad);
  }

  const clickFireLeft = [0, 0];
  buildPad(0, players === 1);
  if (players > 1) buildPad(1, false);

  function collectInputs(dt: number): void {
    for (let i = 0; i < players; i++) {
      const k = keyDir[i];
      let mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      let my = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      const s = stickDir[i];
      if (Math.hypot(s.x, s.y) > 0.12) {
        mx = s.x;
        my = s.y;
      }
      if (clickFireLeft[i] > 0) {
        clickFireLeft[i] -= dt;
        if (clickFireLeft[i] <= 0) padFire[i] = false;
      }
      inputs[i] = { mx, my, fire: keyFire[i] || padFire[i] };
    }
  }

  /* ---------------- 覆盖层:三选一 / 暂停 ---------------- */

  let layer: HTMLElement | null = null;
  let paused = false;

  function closeLayer(): void {
    layer?.remove();
    layer = null;
  }

  function openLayer(): HTMLElement {
    closeLayer();
    const el = doc.createElement("div");
    el.className = "mcr-layer";
    wrap.appendChild(el);
    layer = el;
    return el;
  }

  let draftShownFor = -1;

  /** 三选一面板:图标 + 名字 + 一句话,孩子能看懂;竖屏可滚动,按钮不出屏。 */
  function renderDraft(): void {
    const draft = state.drafts[0];
    if (!draft) {
      draftShownFor = -1;
      closeLayer();
      return;
    }
    draftShownFor = draft.hero;
    const el = openLayer();
    const title = doc.createElement("div");
    title.className = "mcr-layer-t";
    title.textContent = players > 1 ? `${draftTitle(state.draftCount)} · ${P_NAME[draft.hero]}` : draftTitle(state.draftCount);
    const sub = doc.createElement("div");
    sub.className = "mcr-layer-s";
    sub.textContent = "挑一样带上场,选好就继续开打。";
    const cards = doc.createElement("div");
    cards.className = "mcr-cards";
    const growth: GrowthState = state.heroes[draft.hero].growth;
    for (const card of draft.cards) {
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "mcr-card";
      const have = growth[card.id] ?? 0;
      btn.innerHTML = `<span class="mcr-card-emoji">${card.emoji}</span>
        <span class="mcr-card-name">${card.name}</span>
        <span class="mcr-card-desc">${card.desc}</span>
        <span class="mcr-card-lv">${have > 0 ? `已经有 ${have} 层,再加一层` : "第一次拿到"}</span>`;
      btn.setAttribute("aria-label", `${card.name}:${card.desc}`);
      btn.addEventListener("click", () => {
        opts.sfx("coin");
        chooseGrowth(state, draft.hero, card.id);
        refreshHud();
        renderDraft();
      });
      cards.appendChild(btn);
    }
    el.append(title, sub, cards);
    const first = cards.querySelector(".mcr-card");
    if (first instanceof HTMLElement) first.focus?.();
  }

  function openPause(): void {
    paused = true;
    const el = openLayer();
    const t = doc.createElement("div");
    t.className = "mcr-layer-t";
    t.textContent = "⏸ 先歇一会儿";
    const s = doc.createElement("div");
    s.className = "mcr-layer-s";
    s.textContent = "小怪物在原地等你,喝口水再继续。";
    const go = doc.createElement("button");
    go.type = "button";
    go.className = "mcr-btn";
    go.textContent = "继续守家 ▶";
    go.addEventListener("click", () => {
      opts.sfx("tap");
      paused = false;
      closeLayer();
      if (state.drafts.length > 0) renderDraft();
    });
    el.append(t, s, go);
    go.focus?.();
  }

  function togglePause(): void {
    if (state.phase === "over") return;
    if (paused) {
      paused = false;
      closeLayer();
      if (state.drafts.length > 0) renderDraft();
    } else if (state.drafts.length === 0) {
      openPause();
    }
  }

  pauseBtn.addEventListener("click", () => {
    opts.sfx("tap");
    togglePause();
  });

  /* ---------------- 事件 → 音效 + 飘字 ---------------- */

  const soundAt = new Map<string, number>();
  let sayLeft = 0;
  let shake = 0;

  function playThrottled(name: SoundName, key: string, gap: number): void {
    const now = state.elapsed;
    const last = soundAt.get(key) ?? -99;
    if (now - last < gap) return;
    soundAt.set(key, now);
    opts.sfx(name);
  }

  function consume(events: ArenaEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case "pop":
          playThrottled("pop", "pop", 0.12);
          break;
        case "block":
          playThrottled("tap", "block", 0.35);
          break;
        case "shieldPop":
          playThrottled("jump", "shield", 0.2);
          break;
        case "spin":
          playThrottled("oops", "spin", 0.4);
          shake = reduced ? 0 : 0.32;
          break;
        case "steal":
          opts.sfx("oops");
          shake = reduced ? 0 : 0.4;
          break;
        case "jar":
          opts.sfx("coin");
          break;
        case "boss":
          opts.sfx("meow");
          break;
        case "wave":
          playThrottled("coin", "wave", 0.5);
          break;
        default:
          break;
      }
      if (e.text) {
        say.textContent = e.text;
        say.hidden = false;
        sayLeft = 2.4;
      }
    }
  }

  /* ---------------- 渲染 ---------------- */

  let scene = opts.scene % SCENE_COUNT;

  function render(): void {
    if (!c2d) return;
    const t = state.elapsed;
    c2d.setTransform(2, 0, 0, 2, 0, 0);
    if (state.mode === "endless") scene = state.scene % SCENE_COUNT;
    const sky = SCENE_SKY[scene] ?? SCENE_SKY[0];
    const ground = SCENE_GROUND[scene] ?? SCENE_GROUND[0];

    c2d.clearRect(0, 0, ARENA_W, ARENA_H);
    c2d.fillStyle = sky;
    c2d.fillRect(0, 0, ARENA_W, ARENA_H);

    c2d.save();
    if (shake > 0 && !reduced) c2d.translate(Math.sin(t * 46) * shake * 5, Math.cos(t * 39) * shake * 3);

    // 地面:一圈一圈的草地纹路,看得出家在中间、怪从外面往里挤
    const yard = versus ? 108 : 152;
    for (const home of state.homes) {
      c2d.fillStyle = ground;
      c2d.beginPath();
      c2d.arc(home.x, home.y, yard, 0, Math.PI * 2);
      c2d.fill();
      c2d.strokeStyle = shade(ground, 0.86);
      c2d.lineWidth = 3;
      c2d.beginPath();
      c2d.arc(home.x, home.y, yard, 0, Math.PI * 2);
      c2d.stroke();
      c2d.strokeStyle = "rgba(255,255,255,.65)";
      c2d.lineWidth = 1.6;
      for (let r = 44; r < yard; r += 36) {
        c2d.beginPath();
        c2d.arc(home.x, home.y, r, 0, Math.PI * 2);
        c2d.stroke();
      }
    }
    if (versus) {
      c2d.strokeStyle = "rgba(120,100,170,.4)";
      c2d.setLineDash([9, 7]);
      c2d.lineWidth = 2.5;
      c2d.beginPath();
      c2d.moveTo(ARENA_W / 2, 0);
      c2d.lineTo(ARENA_W / 2, ARENA_H);
      c2d.stroke();
      c2d.setLineDash([]);
    }

    for (let s = 0; s < state.homes.length; s++) {
      drawHome(c2d, state.homes[s].x, state.homes[s].y, state.jars[s], state.maxJars, P_COLOR[s] ?? P_COLOR[0]);
    }

    // 元气糖
    for (const c of state.crumbs) {
      c2d.fillStyle = "#ffd86b";
      c2d.strokeStyle = "#e0a92c";
      c2d.lineWidth = 1.4;
      c2d.beginPath();
      c2d.arc(c.x, c.y, 4.2, 0, Math.PI * 2);
      c2d.fill();
      c2d.stroke();
    }

    // 近的画在上面:按 y 排一下序,俯视图也有一点点前后关系
    const actors: Array<{ y: number; draw: () => void }> = [];
    for (const m of state.monsters) actors.push({ y: m.y, draw: () => drawMonster(c2d, m, t, !reduced) });
    for (const h of state.heroes) actors.push({ y: h.y, draw: () => drawHero(c2d, h, t, !reduced) });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();

    for (const b of state.bullets) {
      c2d.fillStyle = b.foe ? "#a9d6ff" : "#ff7fb4";
      c2d.strokeStyle = b.foe ? "#6ba7dd" : "#d9628a";
      c2d.lineWidth = 1.4;
      c2d.beginPath();
      c2d.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      c2d.fill();
      c2d.stroke();
    }

    for (const p of state.particles) {
      const k = 1 - p.life / p.maxLife;
      c2d.save();
      c2d.globalAlpha = Math.max(0, 1 - k);
      if (p.kind === "cloud") {
        c2d.font = "18px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
        c2d.textAlign = "center";
        c2d.textBaseline = "middle";
        c2d.fillText(p.emoji || "☁️", p.x, p.y);
      } else if (p.kind === "ring") {
        c2d.strokeStyle = "#bcd6ff";
        c2d.lineWidth = 3 * (1 - k) + 1;
        c2d.beginPath();
        c2d.arc(p.x, p.y, 8 + k * 20, 0, Math.PI * 2);
        c2d.stroke();
      } else {
        c2d.fillStyle = "#ffd6ea";
        c2d.beginPath();
        c2d.arc(p.x, p.y, 3.4 * (1 - k) + 1, 0, Math.PI * 2);
        c2d.fill();
      }
      c2d.restore();
    }

    c2d.restore();
  }

  /* ---------------- HUD ---------------- */

  let lastHud = "";

  function refreshHud(): void {
    const parts: string[] = [];
    const wave = waveLabel(state);
    parts.push(wave);
    for (let s = 0; s < state.homes.length; s++) {
      parts.push(`${state.jars[s]}`);
    }
    for (let i = 0; i < players; i++) parts.push(growthBadges(state.heroes[i].growth).join(""));
    const sig = parts.join("|");
    if (sig === lastHud) return;
    lastHud = sig;
    waveChip.textContent = wave;
    for (let s = 0; s < jarChips.length; s++) {
      const jars = state.jars[s];
      const label = versus ? `${P_NAME[s]} ` : "";
      jarChips[s].textContent = `${label}🫙 ${"●".repeat(Math.max(0, jars))}${"○".repeat(Math.max(0, state.maxJars - jars))}`;
      jarChips[s].className = jars <= 1 ? "mcr-chip mcr-chip-warn" : "mcr-chip";
    }
    for (let i = 0; i < players; i++) {
      const badges = growthBadges(state.heroes[i].growth);
      growthChips[i].textContent = badges.length ? `${players > 1 ? P_NAME[i] : "成长"} ${badges.join(" ")}` : "";
      growthChips[i].hidden = badges.length === 0;
    }
  }

  /* ---------------- 布局 ---------------- */

  function layout(): void {
    const size = arenaCanvasSize(stage.clientWidth || wrap.clientWidth, view.innerWidth, view.innerHeight);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
  }

  layout();
  view.addEventListener("resize", layout);
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function") {
    ro = new ResizeObserver(() => layout());
    ro.observe(stage);
  }

  /* ---------------- 主循环 ---------------- */

  let raf = 0;
  let last = 0;
  let destroyed = false;
  let done = false;

  function frame(now: number): void {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    if (!paused && state.phase !== "over") {
      collectInputs(dt);
      const events = stepArena(state, dt, inputs);
      consume(events);
    }
    if (shake > 0) shake = Math.max(0, shake - dt);
    if (sayLeft > 0) {
      sayLeft -= dt;
      if (sayLeft <= 0) say.hidden = true;
    }

    if (state.drafts.length > 0 && state.drafts[0].hero !== draftShownFor && !paused) renderDraft();
    if (state.drafts.length === 0 && draftShownFor >= 0 && !paused) {
      draftShownFor = -1;
      closeLayer();
    }

    refreshHud();
    render();

    if (state.result && !done) {
      done = true;
      closeLayer();
      opts.onDone(state.result);
    }
  }

  refreshHud();
  render();
  last = typeof performance === "object" ? performance.now() : 0;
  raf = requestAnimationFrame(frame);
  if (state.drafts.length > 0) renderDraft();

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      closeLayer();
      ro?.disconnect();
      ro = null;
      view.removeEventListener("keydown", onKeyDown);
      view.removeEventListener("keyup", onKeyUp);
      view.removeEventListener("resize", layout);
      disposeArena(state);
      wrap.remove();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 闯关:188 关                                                        */
/* ------------------------------------------------------------------ */

const CAMPAIGN_HINT =
  "左下摇杆走位,右下 🎨 按住不放一直甩;小怪物碰到你只会转个圈,别怕。电脑上用 W A S D 走、F 甩。";

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const state = createCampaignArena(ctx.level);
  const view = createArenaView(stage, {
    state,
    title: `${ctx.chapter.emoji} 第 ${ctx.level + 1} 关`,
    hint: CAMPAIGN_HINT,
    scene: ctx.chapterIndex,
    sfx: ctx.sfx,
    onDone: (res) => {
      if (res.win) {
        ctx.win(campaignStars(res.jars[0], res.maxJars), arenaWinLine(res.jars[0], res.maxJars, res.popped));
      } else {
        ctx.lose(arenaLoseLine(res.wavesCleared, res.waveTotal, res.weakSide));
      }
    },
  });
  return { destroy: () => view.destroy() };
}

/* ------------------------------------------------------------------ */
/* 三个附加模式共用的外壳                                               */
/* ------------------------------------------------------------------ */

function modeShell(
  host: HTMLElement,
  api: GameApi,
  onBack: () => void,
  chipText: string
): { root: HTMLElement; stage: HTMLElement; chip: HTMLElement; destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "mcr-mode";
  const head = document.createElement("div");
  head.className = "mcr-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "mcr-back";
  back.textContent = "◀ 回选关";
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = document.createElement("span");
  chip.className = "mcr-chip";
  chip.textContent = chipText;
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);
  return { root: wrap, stage, chip, destroy: () => wrap.remove() };
}

function overBox(
  stage: HTMLElement,
  title: string,
  sub: string,
  buttons: Array<{ label: string; cls?: string; onClick: () => void }>
): void {
  stage.innerHTML = "";
  const box = document.createElement("div");
  box.className = "mcr-over";
  const t = document.createElement("div");
  t.className = "mcr-layer-t";
  t.textContent = title;
  const s = document.createElement("div");
  s.className = "mcr-layer-s";
  s.textContent = sub;
  const row = document.createElement("div");
  row.className = "mcr-over-btns";
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `mcr-btn${b.cls ? ` ${b.cls}` : ""}`;
    btn.textContent = b.label;
    btn.addEventListener("click", b.onClick);
    row.appendChild(btn);
  }
  box.append(t, s, row);
  stage.appendChild(box);
}

/* ------------------------------------------------------------------ */
/* 无尽:每 5 波小 boss,每 10 波换场景                                   */
/* ------------------------------------------------------------------ */

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = modeShell(host, api, onBack, "");
  let view: ViewHandle | null = null;
  let best = save.getGameProgress(meta.id).endlessBest;

  function start(): void {
    view?.destroy();
    shell.stage.innerHTML = "";
    shell.chip.textContent = best > 0 ? `♾️ 无尽守家 · 最好 第 ${best} 波` : "♾️ 无尽守家 · 挡到第几波?";
    const state = createArena({
      mode: "endless",
      makeWave: arenaEndlessWave,
      levelIdxFor: (wave) => endlessLevelIndex(wave),
      seed: 20250813,
      jars: 5,
      openingDraft: true,
    });
    view = createArenaView(shell.stage, {
      state,
      title: "无尽守家",
      hint: "波次没有尽头。每 5 波来一只小 boss,每 10 波换一个场景;记得捡地上的元气糖补家里的罐子。",
      scene: 0,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        const reached = res.wavesCleared;
        best = save.recordEndlessBest(meta.id, reached);
        if (reached > 0) api.addStars(Math.min(3, Math.ceil(reached / 4)));
        overBox(
          shell.stage,
          reached >= best && reached > 0 ? "🏅 新纪录!" : "🏠 元气被抱完啦",
          arenaEndlessLine(reached, best),
          [{ label: "🔁 从第 1 波再来", onClick: () => {
            api.play("tap");
            start();
          } }]
        );
      },
    });
  }

  start();
  return {
    destroy() {
      view?.destroy();
      view = null;
      shell.destroy();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 双人合作:共享波次,各自成长                                           */
/* ------------------------------------------------------------------ */

function mountCoop(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = modeShell(host, api, onBack, `🤝 双人合作 · 一起挡满 ${COOP_WAVES} 波`);
  let view: ViewHandle | null = null;

  function start(): void {
    view?.destroy();
    shell.stage.innerHTML = "";
    const waves = [];
    for (let w = 1; w <= COOP_WAVES; w++) waves.push(buildCoopWave(w));
    const state = createArena({
      mode: "coop",
      waves,
      heroes: 2,
      jars: 5,
      levelIdxFor: (wave) => endlessLevelIndex(wave),
      seed: 424242,
      openingDraft: true,
    });
    view = createArenaView(shell.stage, {
      state,
      title: "双人合作守家",
      hint: "两个人守同一个家:朵朵用左边摇杆 + 🎨,星星用右边摇杆 + 🎨;键盘是 W A S D / F 和 ↑←↓→ / L。成长卡两个人分开挑!",
      scene: 3,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        if (res.win) api.addStars(3);
        else if (res.wavesCleared >= 3) api.addStars(1);
        overBox(
          shell.stage,
          res.win ? "🎉 一起守住啦!" : "🏠 元气被抱完啦",
          arenaCoopLine(res.wavesCleared, COOP_WAVES, res.popped),
          [{ label: "🔁 再来一局", cls: "mcr-btn-co", onClick: () => {
            api.play("tap");
            start();
          } }]
        );
      },
    });
  }

  start();
  return {
    destroy() {
      view?.destroy();
      view = null;
      shell.destroy();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 对战:两人各守一半,先失守者输                                          */
/* ------------------------------------------------------------------ */

function mountVersus(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = modeShell(host, api, onBack, `⚔️ 各守一半 · ${VERSUS_WAVES} 波,先失守的那边输`);
  let view: ViewHandle | null = null;

  function start(): void {
    view?.destroy();
    shell.stage.innerHTML = "";
    const waves = [];
    for (let w = 1; w <= VERSUS_WAVES; w++) waves.push(buildCoopWave(w));
    const state = createArena({
      mode: "versus",
      waves,
      heroes: 2,
      jars: 5,
      levelIdxFor: (wave) => endlessLevelIndex(wave),
      seed: 987654,
      openingDraft: true,
    });
    view = createArenaView(shell.stage, {
      state,
      title: "各守一半",
      hint: "左边是朵朵的家,右边是星星的家,两边来的小怪物一模一样。谁先被抱光元气谁就输,撑到最后元气多的那边赢!",
      scene: 7,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        api.addStars(1);
        const title =
          res.winner < 0 ? "🤝 平手!" : res.winner === 0 ? "🎀 朵朵这边守住啦!" : "⭐ 星星这边守住啦!";
        overBox(shell.stage, title, arenaVersusLine(res.winner, res.jars, P_NAME), [
          { label: "🔁 换边再来", cls: "mcr-btn-vs", onClick: () => {
            api.play("tap");
            start();
          } },
        ]);
      },
    });
  }

  start();
  return {
    destroy() {
      view?.destroy();
      view = null;
      shell.destroy();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 挂载:模式条 + 188 关地图 + 直达第 N 关                                */
/* ------------------------------------------------------------------ */

export interface MonsterCrisisHandle {
  /** 平台「直达第 N 关」(1 基),返回真正打开的那一关 */
  openCampaignLevel: (n: number) => number;
  destroy: () => void;
}

/** 地址栏上的 `?level=N`(壳层没给 `initialLevel` 时的兜底,和 gold-hook 同一套约定)。 */
export function levelFromQuery(search: string | null): number | null {
  if (!search) return null;
  const raw = new URLSearchParams(search).get("level");
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
}

export function mount(api: GameApi): MonsterCrisisHandle {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "mcr-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "mcr-btn";
  const coopBtn = document.createElement("button");
  coopBtn.type = "button";
  coopBtn.className = "mcr-btn mcr-btn-co";
  coopBtn.textContent = "🤝 双人合作";
  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "mcr-btn mcr-btn-vs";
  vsBtn.textContent = "⚔️ 各守一半";
  bar.append(endlessBtn, coopBtn, vsBtn);

  let mode: { destroy: () => void } | null = null;
  let direct: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽守家 · 最好 第 ${best} 波` : "♾️ 无尽守家 · 点我开始!";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, back: () => void) => { destroy: () => void }): void {
    if (mode) return;
    api.play("tap");
    closeDirect(false);
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  function closeDirect(showMap: boolean): void {
    direct?.destroy();
    direct = null;
    modeHost.innerHTML = "";
    if (showMap) {
      modeHost.hidden = true;
      levelHost.hidden = false;
      bar.hidden = false;
    }
  }

  /**
   * 直达第 N 关:平台的 188 关框架只吐一个 `destroy`,没有「从第 N 关开始」的入口,
   * 所以按规格第九节自己开一条通道 —— 星级照样按框架那套 key 存,回得去选关地图。
   */
  function openDirectLevel(index: number): void {
    const i = Math.max(0, Math.min(TOTAL - 1, Math.round(index)));
    closeDirect(false);
    mode?.destroy();
    mode = null;
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    modeHost.innerHTML = "";

    const ci = chapterOf(CHAPTERS, i);
    const ch: Chapter = CHAPTERS[ci];
    const shell = modeShell(modeHost, api, () => closeDirect(true), `${ch.emoji} ${ch.name} · 第 ${i + 1} 关`);
    let handle: PlayHandle | undefined;
    let settled = false;

    function settle(title: string, msg: string, buttons: Array<{ label: string; go: () => void }>): void {
      handle?.destroy?.();
      handle = undefined;
      overBox(
        shell.stage,
        title,
        msg,
        buttons.map((b) => ({
          label: b.label,
          onClick: () => {
            api.play("tap");
            b.go();
          },
        }))
      );
    }

    const ctx: PlayCtx = {
      level: i,
      chapter: ch,
      chapterIndex: ci,
      indexInChapter: i - chapterStart(CHAPTERS, ci),
      win: (stars, msg) => {
        if (settled) return;
        settled = true;
        const prev = loadStars(meta.id)[i] ?? 0;
        saveStar(meta.id, i, stars);
        if (stars > prev) api.addStars(stars - prev);
        api.play("win");
        const buttons: Array<{ label: string; go: () => void }> = [];
        if (i + 1 < TOTAL) buttons.push({ label: "下一关 ▶", go: () => openDirectLevel(i + 1) });
        buttons.push({ label: "🔁 再玩一次", go: () => openDirectLevel(i) });
        buttons.push({ label: "🗺️ 选关地图", go: () => closeDirect(true) });
        settle(`⭐ 第 ${i + 1} 关过关!`, msg ?? "守得漂亮!", buttons);
      },
      lose: (msg) => {
        if (settled) return;
        settled = true;
        api.play("oops");
        settle("💪 就差一点点", msg ?? "再来一次一定行!", [
          { label: "🔁 再试一次", go: () => openDirectLevel(i) },
          { label: "🗺️ 选关地图", go: () => closeDirect(true) },
        ]);
      },
      sfx: (n) => api.play(n),
      bonusStars: (n) => api.addStars(n),
    };

    handle = playLevel(shell.stage, ctx);
    direct = {
      destroy() {
        handle?.destroy?.();
        handle = undefined;
        shell.destroy();
      },
    };
  }

  function openCampaignLevel(n: number): number {
    const i = Math.max(0, Math.min(TOTAL - 1, Math.round(n) - 1));
    openDirectLevel(i);
    return i + 1;
  }

  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  coopBtn.addEventListener("click", () => openMode(mountCoop));
  vsBtn.addEventListener("click", () => openMode(mountVersus));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 关卡里那一屏得省着用,三颗模式按钮只在选关地图上露面
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy() {
            handle.destroy?.();
            if (!mode && !direct) bar.hidden = false;
          },
        };
      },
      mapHint: "自己上场跑位出手:每 3 波挑一张成长卡,越打越顺手。被撞到只会转个圈,不疼的!",
      grandMessage: "188 关全部守住!彩虹总部的小怪物全变成了小云朵,你是最棒的守家小队长!",
      guide,
      guideTitle: "小怪物危机 · 守家手册",
    }
  );

  const jumpTo =
    (api as { initialLevel?: number }).initialLevel ??
    levelFromQuery(typeof location === "object" ? location.search : null);
  if (jumpTo !== null && jumpTo !== undefined) openCampaignLevel(jumpTo);

  return {
    openCampaignLevel,
    destroy() {
      mode?.destroy();
      mode = null;
      direct?.destroy();
      direct = null;
      level.destroy();
      root.remove();
    },
  };
}

/** 图例:五种行为各是什么(攻略面板与无障碍说明共用)。 */
export function behaviorLegend(): string[] {
  return (Object.keys(BEHAVIOR_INFO) as Array<keyof typeof BEHAVIOR_INFO>).map(
    (k) => `${BEHAVIOR_INFO[k].emoji} ${BEHAVIOR_INFO[k].name}:${BEHAVIOR_INFO[k].tip}`
  );
}

/** 关卡小标题:哪一章、什么场景(直达第 N 关与攻略共用)。 */
export function levelSceneName(levelIdx: number): string {
  const ci = chapterOf(CHAPTERS, Math.max(0, Math.min(LEVELS.length - 1, levelIdx)));
  return SCENE_NAME[ci % SCENE_NAME.length];
}

/** 一局打了多久,给结算用。 */
export function runClock(seconds: number): string {
  return formatClock(seconds);
}

/** 图鉴:这一关会来哪些怪(按行为归类,给攻略面板)。 */
export function levelBehaviors(levelIdx: number): string[] {
  const def = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIdx))];
  const seen = new Set<string>();
  for (const w of def.waves) {
    for (const s of w.spawns) {
      const info = MONSTER_INFO[s.kind];
      seen.add(info.name);
    }
  }
  return [...seen];
}
