import { meta } from "./meta";
export { meta };

import {
  TOTAL_LEVELS,
  chapterOf,
  chapterStart,
  loadStars,
  markSkipped,
  mountLevelGame,
  saveStar,
  type Chapter,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
  type SoundName,
} from "../level99";
import { save } from "../../engine/save";
import { getLevelExtras, type GuideBook } from "../../ui/level188Contract";
import GUIDE from "./guide";
import {
  BOSSES,
  CHAPTERS,
  buildEndless,
  buildLevel,
  bossSlotOf,
  type LevelDef,
} from "./levels";
import {
  ELEMENT_SPECS,
  legendLines,
  type ElementSpec,
} from "./elements";
import {
  ABILITIES,
  BLOCK_H,
  BLOCK_W,
  glideFraction,
} from "./abilities";
import { checkpointLabel } from "./checkpoints";
import { TEACH_CUE_SECONDS, cueLegend, cueVisible, teachBadge, teachCue } from "./teach";
import {
  BOSS_H,
  BOSS_W,
  ENEMY_STATS,
  HERO_H,
  HERO_NAMES,
  HERO_W,
  MELEE_TIME,
  SHOT_R,
  botInput,
  counterFor,
  createWorld,
  doorOpen,
  drainEvents,
  emptyInput,
  isPauseKey,
  isSwapKey,
  keyToAction,
  killRatio,
  remainingForDoor,
  starsForRun,
  stepWorld,
  summarize,
  swapActive,
  winMessage,
  type Input,
  type InputName,
  type World,
  type WorldEvent,
} from "./logic";
import { shade, withAlpha } from "../../art/kit/palette";
import { ballGradient, softShadow } from "../../art/kit/volume";
import { strokeOutline } from "../../art/kit/outline";
import { traceStar } from "../../art/kit/star";
import {
  BLADE_FLASH_COLOR,
  BOSS_INTRO_MS,
  CROWN_RUBY,
  PP_COLORS,
  PRINCESS_CROWN_OFFSET_X,
  PRINCESS_CROWN_SCALE,
  PcpFx,
  SHADOW_H_RATIO,
  SHADOW_W_RATIO,
  SKIRT_STAR_R,
  TOP_LIGHT,
  bladeFlashOn,
  blinkLift,
  bossIntroScale,
  bowShape,
  buttonPoints,
  capePhase,
  crownPath,
  crownTeethTips,
  drawBossFigure,
  drawCrateBadge,
  drawEnemy,
  drawEventBadge,
  drawFeatherBadge,
  drawGuardHalo,
  drawGustBadge,
  drawPadlockBadge,
  drawRoyalBadge,
  drawShieldBadge,
  drawSwordBadge,
  drawWingBadge,
  flagWavePhase,
  gemGlowAlpha,
  headwearDetail,
  invulnBlink,
  princeSilhouette,
  princessSilhouette,
  shawlFill,
  shawlPath,
  skirtLiningArcs,
  skirtStars,
  type EventBadge,
} from "./visual13";

// ---------------------------------------------------------------------------
// 配色
// ---------------------------------------------------------------------------

/**
 * 一章一套粉彩 —— 但 1.2 起这套调色板**只管背景**(天空、远山、城堡剪影、地基),
 * 不再决定「危险 / 可踩 / 奖励」长什么样。那六样一律照 `elements.ts` 的规范表画,
 * 全 188 关一个样子,不跟章节走。
 */
interface Palette {
  sky0: string;
  sky1: string;
  far: string;
  mid: string;
  ground: string;
  groundDark: string;
  deco: string;
}

const PALETTES: Palette[] = [
  { sky0: "#FFF1F7", sky1: "#FFE3EF", far: "#F8CFE0", mid: "#F2BBD3", ground: "#F0A9C2", groundDark: "#FBDCE7", deco: "#E37FA8" },
  { sky0: "#F1FBEA", sky1: "#E3F3DC", far: "#C8E3BC", mid: "#B6D9A6", ground: "#9FCE86", groundDark: "#DCEECF", deco: "#6FAA5C" },
  { sky0: "#EDF5FD", sky1: "#DDEBF9", far: "#BFD6EC", mid: "#A9C7E3", ground: "#8FB4D8", groundDark: "#D3E3F2", deco: "#5F8CBE" },
  { sky0: "#F7FBFF", sky1: "#EAF2FC", far: "#D2E4F5", mid: "#BFD9F0", ground: "#A9CBEB", groundDark: "#E0EDF9", deco: "#7FAFDA" },
  { sky0: "#FFF2E6", sky1: "#FFE0CE", far: "#F5C6A6", mid: "#F2B389", ground: "#EE9E6E", groundDark: "#FBD9C1", deco: "#D3703C" },
  { sky0: "#F2FAFE", sky1: "#E4F2FA", far: "#C9E4F2", mid: "#B6DAEC", ground: "#A2CFE6", groundDark: "#DCEEF7", deco: "#6EAFCE" },
  { sky0: "#F4F0FC", sky1: "#EBE4F7", far: "#D6CBEE", mid: "#C3B4E5", ground: "#AC98DC", groundDark: "#E1D8F2", deco: "#7C66B8" },
];

/**
 * 两位主角的配色(本作原创小人换装,不是任何童话 IP 的角色)。
 * 1.3 起主色对齐四·补一的 token,深浅一律走 `shade`,不再手写十六进制。
 */
const HERO_COLORS = [
  {
    cloak: PP_COLORS.ppPrince,
    cloakDark: shade(PP_COLORS.ppPrince, -24),
    skin: "#FFE0BE",
    hair: "#6B4A32",
    trim: PP_COLORS.ppGold,
    name: "王子",
  },
  {
    cloak: PP_COLORS.ppPrincess,
    cloakDark: shade(PP_COLORS.ppPrincess, -22),
    skin: "#FFE4C6",
    hair: "#C97C3A",
    trim: PP_COLORS.ppGold,
    name: "公主",
  },
];

// 修复员 S1:小怪脸谱表(五只 emoji 字形)退休 —— 本体改走 visual13.drawEnemy 自绘。

// ---------------------------------------------------------------------------
// 样式(全部 pcp- 前缀)
// ---------------------------------------------------------------------------

export const CSS = `
.pcp-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;position:relative;}
.pcp-hud{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
.pcp-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:14px;font-weight:800;color:#7B4A72;
  box-shadow:0 2px 6px rgba(170,120,160,.22);white-space:nowrap;}
.pcp-chip-teach{background:#FFF3D6;color:#8A5A2B;}
.pcp-chip-gem{background:linear-gradient(180deg,#FFFDF4,#FFF3D9);border:1px solid ${withAlpha(PP_COLORS.ppGold, 0.55)};
  box-shadow:0 2px 6px rgba(201,138,23,.24);}
.pcp-chip-duo{display:inline-flex;align-items:center;gap:3px;padding:4px 8px;}
.pcp-ava{display:inline-block;width:16px;height:16px;border-radius:50%;
  box-shadow:inset 0 -3px 0 rgba(90,74,120,.14),0 1px 2px rgba(90,74,120,.25);}
.pcp-ava-prince{background:radial-gradient(circle at 35% 30%,${shade(PP_COLORS.ppPrince, 32)},${PP_COLORS.ppPrince});
  border-top:3px solid ${PP_COLORS.ppGold};}
.pcp-ava-princess{background:radial-gradient(circle at 35% 30%,${shade(PP_COLORS.ppPrincess, 32)},${PP_COLORS.ppPrincess});
  border-top:3px solid ${PP_COLORS.ppRuby};}
.pcp-bar{position:relative;flex:1;min-width:110px;height:20px;border-radius:999px;background:#ffffffcc;
  overflow:hidden;box-shadow:inset 0 1px 3px rgba(150,110,140,.25);}
.pcp-bar-fill{height:100%;width:0%;border-radius:999px;transition:width .16s linear;
  background:linear-gradient(90deg,#F7A8C8,#9FD48C);}
.pcp-bar-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:14px;font-weight:900;color:#6B3A62;}
.pcp-btn{border:none;border-radius:999px;padding:5px 12px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#7B4A72;box-shadow:0 3px 0 rgba(170,120,160,.3);}
.pcp-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,120,160,.3);}
.pcp-btn:focus-visible,.pcp-key:focus-visible,.pcp-mode:focus-visible{outline:3px solid #5A2E52;outline-offset:2px;}
.pcp-stagebox{position:relative;border-radius:16px;overflow:hidden;background:#FFF5FA;
  box-shadow:0 4px 12px rgba(170,130,160,.24);}
.pcp-cv{display:block;width:100%;height:300px;}
.pcp-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;text-align:center;padding:16px;background:rgba(255,248,252,.93);}
.pcp-veil-title{font-size:20px;font-weight:900;color:#7B4A72;}
.pcp-veil-sub{font-size:14px;font-weight:700;color:#96658C;line-height:1.6;max-width:330px;}
.pcp-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.pcp-veil-btn{border:none;border-radius:16px;padding:10px 20px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#E784AE,#C85E8C);box-shadow:0 4px 0 #A6486F;}
.pcp-veil-btn.pcp-ghost{background:linear-gradient(180deg,#8FBEE8,#6A97CC);box-shadow:0 4px 0 #4F79A8;}
.pcp-veil-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #A6486F;}
.pcp-toast{position:absolute;left:50%;top:10px;transform:translateX(-50%);background:#ffffffee;border-radius:999px;
  padding:5px 14px;font-size:13px;font-weight:800;color:#7B4A72;box-shadow:0 3px 8px rgba(160,110,150,.25);
  pointer-events:none;opacity:0;transition:opacity .25s ease;max-width:92%;text-align:center;}
.pcp-toast.pcp-on{opacity:1;}
.pcp-cue{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:none;flex-direction:column;
  align-items:center;gap:3px;background:#FFFDF6F2;border:3px solid #8A5A2B;border-radius:18px;padding:7px 16px;
  pointer-events:none;max-width:92%;}
.pcp-cue.pcp-on{display:flex;}
.pcp-cue-icons{font-size:26px;letter-spacing:8px;line-height:1.1;}
.pcp-cue-line{font-size:15px;font-weight:900;color:#6B3A62;white-space:nowrap;}
.pcp-cue-legend{font-size:12px;font-weight:800;color:#8A5A2B;white-space:nowrap;}
.pcp-pads{display:flex;justify-content:space-between;gap:8px;margin-top:8px;--k:52px;}
.pcp-pads[data-players="2"]{--k:42px;}
.pcp-pad{display:grid;grid-template-columns:repeat(4,var(--k));grid-auto-rows:var(--k);gap:4px;justify-content:center;}
.pcp-pad-name{grid-column:1/-1;font-size:11px;font-weight:800;color:#7B4A72;text-align:center;line-height:1.3;}
.pcp-key{border:none;border-radius:14px;font-size:19px;font-weight:900;cursor:pointer;font-family:inherit;
  background:#ffffffe0;color:#7B4A72;box-shadow:0 3px 0 rgba(170,120,160,.34);touch-action:none;padding:0;
  min-width:44px;min-height:44px;}
.pcp-key:active,.pcp-key.pcp-down{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,120,160,.34);background:#FFE3F0;}
.pcp-key-atk{background:#FFD9E6;color:#B3527C;}
.pcp-key-swap{background:#DFF0FF;color:#3F72A8;}
.pcp-tip{margin-top:6px;text-align:center;font-size:12px;font-weight:700;color:#96658C;line-height:1.5;}
.pcp-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.pcp-mode{border:none;border-radius:999px;padding:9px 18px;font-size:14px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#E784AE,#C85E8C);box-shadow:0 4px 0 #A6486F;}
.pcp-mode.pcp-mode-duo{background:linear-gradient(180deg,#9BC7F2,#6E9FD4);box-shadow:0 4px 0 #55799F;}
.pcp-mode.pcp-mode-tower{background:linear-gradient(180deg,#F0B45E,#D68F35);box-shadow:0 4px 0 #B0722A;}
.pcp-mode.pcp-mode-off{background:linear-gradient(180deg,#D9CEDA,#BCAFBD);box-shadow:0 4px 0 #9C8E9D;}
.pcp-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #A6486F;}
.pcp-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
.pcp-head-title{flex:1;text-align:center;font-size:15px;font-weight:900;color:#7B4A72;}
.pcp-over{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;text-align:center;padding:16px;background:rgba(255,248,252,.94);border-radius:16px;}
.pcp-over-t{font-size:19px;font-weight:900;color:#7B4A72;}
.pcp-over-s{font-size:14px;font-weight:700;color:#96658C;line-height:1.6;max-width:330px;}
.pcp-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.pcp-act{border:none;border-radius:16px;padding:9px 18px;font-size:14px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#E784AE,#C85E8C);box-shadow:0 4px 0 #A6486F;}
.pcp-direct{position:relative;min-height:120px;}
@media (max-width:420px){
  .pcp-cv{height:180px;}
  .pcp-wrap[data-players="2"] .pcp-cv{height:270px;}
  .pcp-pads{--k:46px;margin-top:6px;}
  .pcp-pads[data-players="2"]{--k:37px;}
  .pcp-chip{font-size:14px;padding:3px 6px;}
  .pcp-hud{gap:4px;margin-bottom:4px;}
  .pcp-bar{min-width:78px;height:20px;}
  .pcp-btn{padding:5px 9px;}
  .pcp-lbl{display:none;}
  .pcp-tip{font-size:11px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .pcp-pad-name{font-size:10px;}
  .pcp-cue-line{font-size:14px;}
}
@media (hover:none) and (max-width:420px){ .pcp-pad-name{display:none;} }
@media (max-height:620px){
  .pcp-cv{height:142px;}
  .pcp-wrap[data-players="2"] .pcp-cv{height:216px;}
  .pcp-pads{--k:42px;margin-top:4px;}
  .pcp-pads[data-players="2"]{--k:34px;}
}
@media (prefers-reduced-motion:reduce){
  .pcp-bar-fill,.pcp-toast{transition:none;}
}
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 家长在系统里关了动效就别再抖、别再闪 */
export function reducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  if (typeof mm !== "function") return false;
  try {
    return Boolean(mm("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return false;
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, Math.min(Math.abs(w), Math.abs(h)) / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr);
  g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr);
  g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

// 修复员 R2(G4/L-1 + N4 画布部分):emoji() 画布字形助手退休 ——
// 门锁 / 状态小 icon / 指路 / 事件飘图全部换成 visual13 的矢量小徽章;
// DOM 出场卡与 HUD chips 的 emoji 属功能文字口径,不在画布字形之列(登记遗留)。

/** 两人都得留在画面里,边上还要给这么宽的余量 */
export const CAM_MARGIN = 52;

/**
 * 摄像机该停在哪儿(世界坐标的左边界)。
 *
 * 1.1 是「两人 x 的平均值减半屏」,**不夹人也不管掉队**:一个人往前冲,
 * 落后那位直接被挤出屏幕左边,玩家看不见自己操作的小人。
 *
 * 1.2 先取中点,再往回夹一道:只要两人的间距还塞得进这一屏,
 * 就保证**两个人都在画面里**、而且离边至少 `CAM_MARGIN`。
 * 实在拉得太开(超过一屏)才放弃,那时候由 `drawStrayMark` 在边上贴一个指路标。
 */
export function cameraX(xs: readonly number[], viewW: number, levelLen: number): number {
  if (xs.length === 0) return 0;
  const maxCam = Math.max(0, levelLen - viewW);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  let cam = (lo + hi) / 2 - viewW / 2;
  if (hi - lo <= viewW - CAM_MARGIN * 2) {
    cam = Math.min(cam, lo - CAM_MARGIN);
    cam = Math.max(cam, hi + CAM_MARGIN - viewW);
  }
  return Math.max(0, Math.min(maxCam, cam));
}

/** 这一位现在还在画面里吗 */
export function onScreen(x: number, camX: number, viewW: number): boolean {
  return x >= camX && x <= camX + viewW;
}

// ---------------------------------------------------------------------------
// 照着「关卡元素规范表」画的六支笔
//
// 每一支只认 `elements.ts` 里那一条规范,不接受任何章节参数 ——
// 想让某一章的尖刺换个颜色,在这儿是**做不到**的,这就是「全 188 关统一」的兜底。
// ---------------------------------------------------------------------------

const SPEC = ELEMENT_SPECS;

/**
 * 危险:1.3 起改成**圆头软刺 + 警示条纹底座**。
 * 危险语义双保险:条纹底座沿用规范表深红,顶上再由 `drawHazardMark`(最顶层)插三角。
 * 条纹用填充的平行四边形画,**不用 setLineDash** —— 虚线是「推我」箱子的专属语义。
 */
function drawHazardSpikes(
  g: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  baseY: number,
  scale: number
): void {
  const s = SPEC.hazard;
  const baseH = 6 * scale;
  // 警示条纹底座:深红底 + 斜纹
  g.fillStyle = s.stroke;
  g.fillRect(x0, baseY - baseH, x1 - x0, baseH);
  g.fillStyle = s.fill;
  const stripe = 9 * scale;
  const slant = baseH * 0.7;
  for (let px = x0; px < x1; px += stripe * 2) {
    g.beginPath();
    g.moveTo(px, baseY);
    g.lineTo(Math.min(x1, px + stripe), baseY);
    g.lineTo(Math.min(x1, px + stripe + slant), baseY - baseH);
    g.lineTo(Math.min(x1, px + slant), baseY - baseH);
    g.closePath();
    g.fill();
  }
  // 圆头软刺:肩线走二次曲线,顶是圆滚滚的一颗
  const teeth = Math.max(2, Math.round((x1 - x0) / (16 * scale)));
  const tw = (x1 - x0) / teeth;
  g.strokeStyle = s.stroke;
  g.lineWidth = Math.max(1, s.strokeWidth * scale * 0.8);
  for (let i = 0; i < teeth; i++) {
    const tx = x0 + tw * i;
    const tipY = baseY - baseH - 12 * scale;
    g.fillStyle = s.fill;
    g.beginPath();
    g.moveTo(tx + tw * 0.1, baseY - baseH);
    g.quadraticCurveTo(tx + tw * 0.2, tipY + 2 * scale, tx + tw * 0.5, tipY);
    g.quadraticCurveTo(tx + tw * 0.8, tipY + 2 * scale, tx + tw * 0.9, baseY - baseH);
    g.closePath();
    g.fill();
    g.stroke();
    // 圆头上一点高光,软乎乎的不吓人,但红得清楚
    g.fillStyle = shade(s.fill, 30);
    g.beginPath();
    g.arc(tx + tw * 0.42, tipY + 3 * scale, Math.max(1, 1.8 * scale), 0, Math.PI * 2);
    g.fill();
  }
}

/** 危险(小怪 / 断口 / 弹):脚下一枚朝上的小三角,和尖刺同一套配色 */
function drawHazardMark(g: CanvasRenderingContext2D, cx: number, baseY: number, size: number): void {
  const s = SPEC.hazard;
  g.fillStyle = s.fill;
  g.strokeStyle = s.stroke;
  g.lineWidth = Math.max(1, size * 0.18);
  g.beginPath();
  g.moveTo(cx, baseY - size);
  g.lineTo(cx + size * 0.72, baseY);
  g.lineTo(cx - size * 0.72, baseY);
  g.closePath();
  g.fill();
  g.stroke();
}

/**
 * 自绘小星星:公主的星弹 / 「只吃星星」的克制提示 / 首领弱点提示都用它。
 * 星星 emoji 的 `fillText` 从此在本文件绝迹(源码字符串断言盯着)。
 */
function drawStarIcon(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  traceStar(g, cx, cy, Math.max(2, r));
  g.fillStyle = PP_COLORS.ppGold;
  g.fill();
  strokeOutline(g, PP_COLORS.ppGold, 1.5);
}

/** 可踩:圆角横条 + 深棕描边 + 顶上一条亮边。只有能站的东西有亮顶边 */
function drawStandSlab(
  g: CanvasRenderingContext2D,
  x: number,
  topY: number,
  w: number,
  h: number,
  scale: number,
  fill?: string
): void {
  const s = SPEC.stand;
  g.fillStyle = fill ?? s.fill;
  roundRect(g, x, topY, w, h, Math.min(6 * scale, h / 2));
  g.fill();
  g.strokeStyle = s.stroke;
  g.lineWidth = Math.max(1, s.strokeWidth * scale * 0.8);
  g.stroke();
  g.fillStyle = s.topLight ?? "#FFF6DF";
  g.fillRect(x + 1.5 * scale, topY + 1.2 * scale, Math.max(0, w - 3 * scale), Math.max(1, 3 * scale));
}

/** 可推:方块 + 一圈「推我」虚线。只有方块推得动(1.3 加木纹与角铁,语义件全保) */
function drawPushCrate(g: CanvasRenderingContext2D, cx: number, baseY: number, scale: number): void {
  const s = SPEC.push;
  const w = BLOCK_W * scale;
  const h = BLOCK_H * scale;
  const x = cx - w / 2;
  const y = baseY - h;
  g.fillStyle = s.fill;
  roundRect(g, x, y, w, h, 5 * scale);
  g.fill();
  // 木纹:两条横板缝(细实线,不抢「推我」虚线的戏)
  g.strokeStyle = shade(s.fill, -18);
  g.lineWidth = Math.max(1, 1.1 * scale);
  g.beginPath();
  g.moveTo(x + 3 * scale, y + h * 0.36);
  g.lineTo(x + w - 3 * scale, y + h * 0.36);
  g.moveTo(x + 3 * scale, y + h * 0.66);
  g.lineTo(x + w - 3 * scale, y + h * 0.66);
  g.stroke();
  g.strokeStyle = s.stroke;
  g.lineWidth = Math.max(1, s.strokeWidth * scale * 0.8);
  roundRect(g, x, y, w, h, 5 * scale);
  g.stroke();
  // 四角角铁:短短的 L 形铁片,重箱子的分量感
  g.fillStyle = shade(s.stroke, 16);
  const arm = 5.5 * scale;
  const thick = Math.max(1, 1.8 * scale);
  for (const [cxs, cys] of [
    [x + 1.5 * scale, y + 1.5 * scale],
    [x + w - 1.5 * scale - arm, y + 1.5 * scale],
    [x + 1.5 * scale, y + h - 1.5 * scale - thick],
    [x + w - 1.5 * scale - arm, y + h - 1.5 * scale - thick],
  ] as const) {
    g.fillRect(cxs, cys, arm, thick);
  }
  g.setLineDash([4 * scale, 3 * scale]);
  g.strokeStyle = s.stroke;
  g.lineWidth = Math.max(1, 1.6 * scale);
  roundRect(g, x + 5 * scale, y + 5 * scale, w - 10 * scale, h - 10 * scale, 3 * scale);
  g.stroke();
  g.setLineDash([]);
}

/**
 * 奖励:会发光的菱形。只有奖励发光。
 * 1.3:光圈透明度按 `gemGlowAlpha` 呼吸(reduced 停在 1.2 的固定档),
 * 菱形切出上半受光面 + 一点星光,像颗真宝石。
 */
function drawRewardGem(g: CanvasRenderingContext2D, cx: number, cy: number, scale: number, glowAlpha: number): void {
  const s = SPEC.reward;
  const r = 10 * scale;
  if (glowAlpha > 0 && s.glow) {
    g.globalAlpha = Math.max(0, Math.min(1, glowAlpha));
    g.fillStyle = s.glow;
    g.beginPath();
    g.arc(cx, cy, r * 1.75, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  g.fillStyle = s.fill;
  g.beginPath();
  g.moveTo(cx, cy - r);
  g.lineTo(cx + r * 0.78, cy);
  g.lineTo(cx, cy + r);
  g.lineTo(cx - r * 0.78, cy);
  g.closePath();
  g.fill();
  g.strokeStyle = s.stroke;
  g.lineWidth = Math.max(1, s.strokeWidth * scale);
  g.stroke();
  // 切面:上半受光面(左上 45° 光源)
  g.fillStyle = shade(s.fill, 26);
  g.beginPath();
  g.moveTo(cx, cy - r);
  g.lineTo(cx + r * 0.78, cy);
  g.lineTo(cx - r * 0.78, cy);
  g.closePath();
  g.fill();
  // 腰线 + 星光点
  g.strokeStyle = shade(s.fill, -14);
  g.lineWidth = Math.max(1, 1 * scale);
  g.beginPath();
  g.moveTo(cx - r * 0.78, cy);
  g.lineTo(cx + r * 0.78, cy);
  g.stroke();
  g.fillStyle = "rgba(255,255,255,.85)";
  g.beginPath();
  g.arc(cx - r * 0.26, cy - r * 0.38, Math.max(0.8, r * 0.14), 0, Math.PI * 2);
  g.fill();
}

/** 出口:青绿色的拱门。只有出口是拱形(1.3 加花藤缠绕与门内暖光渐变) */
function drawExitArch(
  g: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  open: boolean
): void {
  const s = SPEC.exit;
  const w = 52 * scale;
  const h = 82 * scale;
  g.globalAlpha = open ? 1 : 0.55;
  g.fillStyle = s.fill;
  g.beginPath();
  g.moveTo(cx - w / 2, baseY);
  g.lineTo(cx - w / 2, baseY - h + w / 2);
  g.quadraticCurveTo(cx - w / 2, baseY - h, cx, baseY - h);
  g.quadraticCurveTo(cx + w / 2, baseY - h, cx + w / 2, baseY - h + w / 2);
  g.lineTo(cx + w / 2, baseY);
  g.closePath();
  g.fill();
  g.strokeStyle = s.stroke;
  g.lineWidth = Math.max(1, s.strokeWidth * scale);
  g.stroke();
  // 门洞:开门时里面透出暖光渐变(回家的灯),没开就是一扇深色门板
  const iw = w * 0.58;
  const ih = h * 0.62;
  if (open) {
    const warm = g.createLinearGradient(0, baseY - ih, 0, baseY);
    warm.addColorStop(0, "#FFF6DF");
    warm.addColorStop(1, "#FFD9A0");
    g.fillStyle = warm;
  } else {
    g.fillStyle = shade(s.fill, -26);
  }
  g.beginPath();
  g.moveTo(cx - iw / 2, baseY);
  g.lineTo(cx - iw / 2, baseY - ih + iw / 2);
  g.quadraticCurveTo(cx - iw / 2, baseY - ih, cx, baseY - ih);
  g.quadraticCurveTo(cx + iw / 2, baseY - ih, cx + iw / 2, baseY - ih + iw / 2);
  g.lineTo(cx + iw / 2, baseY);
  g.closePath();
  g.fill();
  // 花藤缠绕:两侧各一条绿藤 + 叶片与小花
  g.strokeStyle = "#5FA96C";
  g.lineWidth = Math.max(1, 1.6 * scale);
  for (const side of [-1, 1] as const) {
    g.beginPath();
    g.moveTo(cx + side * (w / 2), baseY - 4 * scale);
    g.quadraticCurveTo(cx + side * (w / 2 + 5 * scale), baseY - h * 0.4, cx + side * (w * 0.3), baseY - h * 0.86);
    g.stroke();
    g.fillStyle = "#7BC96F";
    g.beginPath();
    g.ellipse(cx + side * (w / 2 + 2 * scale), baseY - h * 0.32, 3.4 * scale, 2 * scale, side * 0.5, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(cx + side * (w * 0.42), baseY - h * 0.66, 3 * scale, 1.8 * scale, side * 0.9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = PP_COLORS.ppLining;
    g.beginPath();
    g.arc(cx + side * (w * 0.34), baseY - h * 0.82, Math.max(1, 1.9 * scale), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // 修复员 R2 · N2:门上挂锁从 emoji 字形换成自绘徽记(开门锁弓掀起,合门锁弓扣死)
  drawPadlockBadge(g, cx, baseY - h * 0.52, 7 * scale, open);
}

/** 检查点:蓝色的小旗。只有检查点是旗子(1.3 加 2 帧飘动,reduced 时 wave 恒 0) */
function drawCheckpointFlag(
  g: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  lit: boolean,
  wave: 0 | 1
): void {
  const s = SPEC.checkpoint;
  const h = 40 * scale;
  const dip = wave === 1 ? 3 * scale : 0;
  g.globalAlpha = lit ? 1 : 0.42;
  g.strokeStyle = s.stroke;
  g.lineWidth = Math.max(1.4, s.strokeWidth * scale * 0.9);
  g.beginPath();
  g.moveTo(cx, baseY);
  g.lineTo(cx, baseY - h);
  g.stroke();
  g.fillStyle = lit ? s.fill : "#D9E4EE";
  g.beginPath();
  g.moveTo(cx, baseY - h);
  g.lineTo(cx + 22 * scale - dip, baseY - h + 9 * scale + dip);
  g.lineTo(cx, baseY - h + 18 * scale);
  g.closePath();
  g.fill();
  g.stroke();
  // 杆顶一颗小圆珠,点亮的旗更精神
  g.fillStyle = lit ? PP_COLORS.ppGold : "#D9E4EE";
  g.beginPath();
  g.arc(cx, baseY - h - 2 * scale, Math.max(1, 2.2 * scale), 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// 场地
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vy: number;
  life: number;
  /** 画哪种矢量事件飘图(修复员 R2:原来是 emoji 字符串) */
  art: EventBadge;
  size: number;
}

interface FieldOpts {
  def: LevelDef;
  players: 1 | 2;
  sfx: (name: SoundName) => void;
  title: string;
  tip: string;
  showTimer: boolean;
  extraChip?: (w: World) => string;
  onEnd: (win: boolean, w: World) => void;
  onQuit?: () => void;
  ready?: boolean;
}

interface Field {
  destroy: () => void;
  world: World;
  swap: (def: LevelDef, keep: { hearts: number }) => void;
  showVeil: (
    title: string,
    sub: string,
    buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>
  ) => void;
  toast: (text: string) => void;
}

const SFX_FOR_EVENT: Partial<Record<WorldEvent["kind"], SoundName>> = {
  jump: "jump",
  double: "jump",
  slash: "tap",
  shoot: "pop",
  hit: "pop",
  block: "tap",
  defeat: "coin",
  gem: "coin",
  shield: "meow",
  cloud: "meow",
  flag: "coin",
  bridge: "pop",
  hurt: "oops",
  guard: "meow",
  bossHit: "pop",
  bossDown: "win",
  slam: "oops",
  door: "coin",
  win: "win",
  lose: "oops",
};

/**
 * 事件飘出来的小图(修复员 R2:emoji 字符串 → visual13 矢量事件飘图)。
 *
 * 受伤是 `shield`(小护盾闪一下),掉下去是 `cloud`(小云朵托回小旗),
 * **画面上不出现任何受伤 / 摔坏的描写**。
 * `push` 和 `glide` 每帧都在发,不走飘字,由画布上的常驻标记表示。
 */
const PARTICLE_FOR_EVENT: Partial<Record<WorldEvent["kind"], EventBadge>> = {
  defeat: "sparkle",
  gem: "gem",
  shield: "shield",
  cloud: "cloud",
  flag: "flag",
  bridge: "bridge",
  hurt: "dizzy",
  block: "block",
  bossHit: "burst",
  bossDown: "party",
  slam: "gust",
  double: "wing",
};

function createField(host: HTMLElement, opts: FieldOpts): Field {
  let world = createWorld(opts.def, opts.players);
  let destroyed = false;
  let ended = false;
  let paused = false;
  let raf = 0;
  let lastTime = 0;
  let readyT = opts.ready === false ? 0 : 1.6;
  let toastT = 0;
  /** 教学关开场的图形提示还剩几秒 */
  let cueT = opts.def.teach ? TEACH_CUE_SECONDS : 0;
  const calm = reducedMotion();
  const particles: Particle[] = [];
  /** 纯视觉的小账本:挥杖星尘轨迹 + 通关击掌彩纸(只读事件,不写 World) */
  const fx = new PcpFx();
  const inputs: Input[] = [emptyInput(), emptyInput()];
  const sfxAt = new Map<SoundName, number>();

  const wrap = el("div", "pcp-wrap");
  wrap.dataset.players = String(opts.players);
  const style = el("style");
  style.textContent = CSS;
  wrap.appendChild(style);

  // ---- HUD ----
  const hud = el("div", "pcp-hud");
  const hearts = el("span", "pcp-chip");
  const bar = el("div", "pcp-bar");
  const barFill = el("div", "pcp-bar-fill");
  const barTxt = el("span", "pcp-bar-txt");
  bar.append(barFill, barTxt);
  const gemChip = el("span", "pcp-chip pcp-chip-gem");
  const flagChip = el("span", "pcp-chip");
  const timerChip = el("span", "pcp-chip");
  const extraChip = el("span", "pcp-chip");
  const whoChip = el("span", "pcp-chip");
  const teachChip = el("span", "pcp-chip pcp-chip-teach", teachBadge());
  const pauseBtn = el("button", "pcp-btn");
  pauseBtn.type = "button";
  pauseBtn.innerHTML = `⏸<span class="pcp-lbl"> 暂停</span>`;
  pauseBtn.setAttribute("aria-label", "暂停(也可以按 Esc)");
  if (opts.players === 2) {
    // 双人头像徽章:一蓝一粉两枚小圆脸,谁在场一眼看清
    const avaChip = el("span", "pcp-chip pcp-chip-duo");
    avaChip.append(el("span", "pcp-ava pcp-ava-prince"), el("span", "pcp-ava pcp-ava-princess"));
    avaChip.setAttribute("aria-label", "王子和公主一起上场");
    hud.appendChild(avaChip);
  }
  hud.append(hearts, bar, gemChip, flagChip);
  if (opts.showTimer) hud.appendChild(timerChip);
  if (opts.extraChip) hud.appendChild(extraChip);
  if (opts.players === 1) hud.appendChild(whoChip);
  if (opts.def.teach) hud.appendChild(teachChip);
  hud.appendChild(pauseBtn);
  wrap.appendChild(hud);

  // ---- 画布 ----
  const box = el("div", "pcp-stagebox");
  const canvas = el("canvas", "pcp-cv");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${opts.title}:王子和公主正在闯关`);
  const toastEl = el("div", "pcp-toast");
  // 教学关的图形提示:先图后字,一行不超过 12 个字
  const cueEl = el("div", "pcp-cue");
  const cueIcons = el("div", "pcp-cue-icons");
  const cueLine = el("div", "pcp-cue-line");
  const cueLegendEl = el("div", "pcp-cue-legend");
  cueEl.append(cueIcons, cueLine, cueLegendEl);
  box.append(canvas, toastEl, cueEl);
  wrap.appendChild(box);

  function refreshCue(def: LevelDef): void {
    if (!def.teach) {
      cueEl.classList.remove("pcp-on");
      return;
    }
    const cue = teachCue(def.chapterIndex);
    cueIcons.textContent = cue.icons.join(" ");
    cueLine.textContent = cue.line;
    cueLegendEl.textContent = cueLegend(cue).join(" · ");
  }
  refreshCue(opts.def);

  // ---- 触屏按键 ----
  const pads = el("div", "pcp-pads");
  pads.dataset.players = String(opts.players);
  const PAD_KEYS: Array<{ act: InputName; label: string; cls?: string; aria: string; col: number; row: number }> = [
    { act: "up", label: "⬆", aria: "跳(公主按住可以滑翔)", col: 2, row: 2 },
    { act: "atk", label: "⚔️", cls: "pcp-key-atk", aria: "攻击", col: 4, row: 2 },
    { act: "left", label: "◀", aria: "往左", col: 1, row: 3 },
    { act: "down", label: "⬇", aria: "蹲下", col: 2, row: 3 },
    { act: "right", label: "▶", aria: "往右", col: 3, row: 3 },
  ];
  const padButtons: Array<{ btn: HTMLButtonElement; player: number; act: InputName }> = [];
  let swapBtn: HTMLButtonElement | null = null;
  for (let pi = 0; pi < opts.players; pi++) {
    const pad = el("div", "pcp-pad");
    pad.appendChild(
      el(
        "div",
        "pcp-pad-name",
        opts.players === 1
          ? "WASD / 方向键移动 · F 或 L 攻击 · Tab 换人"
          : pi === 0
            ? `王子 · W A S D · F 挥剑 · ${ABILITIES.prince.icon}${ABILITIES.prince.name}`
            : `公主 · ↑←↓→ · L 放星星 · ${ABILITIES.princess.icon}${ABILITIES.princess.name}`
      )
    );
    for (const k of PAD_KEYS) {
      const btn = el("button", `pcp-key${k.cls ? ` ${k.cls}` : ""}`, k.label);
      btn.type = "button";
      btn.style.gridColumn = String(k.col);
      btn.style.gridRow = String(k.row);
      btn.setAttribute("aria-label", `${opts.players === 2 ? HERO_COLORS[pi].name : ""}${k.aria}`);
      pad.appendChild(btn);
      padButtons.push({ btn, player: pi, act: k.act });
    }
    if (opts.players === 1) {
      // 一个人玩:多一颗固定位置的「换人」键,顶替键盘的 Tab
      const sw = el("button", "pcp-key pcp-key-swap", "🔁");
      sw.type = "button";
      sw.style.gridColumn = "4";
      sw.style.gridRow = "3";
      sw.setAttribute("aria-label", "换人(也可以按 Tab)");
      pad.appendChild(sw);
      swapBtn = sw;
    }
    pads.appendChild(pad);
  }
  wrap.appendChild(pads);

  const tip = el("div", "pcp-tip", opts.tip);
  wrap.appendChild(tip);
  host.appendChild(wrap);

  const g = canvas.getContext("2d");

  // ---- 输入 ----
  function setKey(player: number, act: InputName, down: boolean): void {
    const slot = inputs[player];
    if (!slot) return;
    slot[act] = down;
  }

  function releaseAll(): void {
    for (const { btn, player, act } of padButtons) {
      btn.classList.remove("pcp-down");
      setKey(player, act, false);
    }
    inputs[0] = emptyInput();
    inputs[1] = emptyInput();
  }

  for (const { btn, player, act } of padButtons) {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.classList.add("pcp-down");
      setKey(opts.players === 1 ? world.active : player, act, true);
    });
    const up = (): void => {
      btn.classList.remove("pcp-down");
      // 单人模式下换人可能发生在按住期间,两位都松一遍才不会卡键
      setKey(0, act, false);
      setKey(1, act, false);
    };
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  }

  function doSwap(): void {
    if (opts.players !== 1 || ended || destroyed) return;
    releaseAll();
    const next = swapActive(world);
    const card = ABILITIES[world.heroes[next].kind];
    opts.sfx("tap");
    toast(`换 ${HERO_NAMES[world.heroes[next].kind]} 上场!${card.icon}${card.name}`);
  }
  swapBtn?.addEventListener("click", doSwap);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isPauseKey(e.code)) {
      e.preventDefault();
      togglePause();
      return;
    }
    if (isSwapKey(e.code) && opts.players === 1) {
      e.preventDefault();
      doSwap();
      return;
    }
    const hit = keyToAction(e.code, opts.players, world.active);
    if (!hit) return;
    e.preventDefault();
    setKey(hit.player, hit.action, true);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const hit = keyToAction(e.code, opts.players, world.active);
    if (!hit) return;
    e.preventDefault();
    setKey(hit.player, hit.action, false);
    if (opts.players === 1) setKey(1 - hit.player, hit.action, false);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointerup", releaseAll);
  window.addEventListener("blur", releaseAll);

  // ---- 遮罩 ----
  let veil: HTMLElement | null = null;

  function clearVeil(): void {
    veil?.remove();
    veil = null;
  }

  function showVeil(
    title: string,
    sub: string,
    buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>
  ): void {
    clearVeil();
    const v = el("div", "pcp-veil");
    v.append(el("div", "pcp-veil-title", title), el("div", "pcp-veil-sub", sub));
    const row = el("div", "pcp-veil-btns");
    for (const b of buttons) {
      const btn = el("button", `pcp-veil-btn${b.ghost ? " pcp-ghost" : ""}`, b.label);
      btn.type = "button";
      btn.addEventListener("click", () => {
        opts.sfx("tap");
        b.onClick();
      });
      row.appendChild(btn);
    }
    v.appendChild(row);
    box.appendChild(v);
    veil = v;
  }

  function togglePause(): void {
    if (ended || destroyed) return;
    paused = !paused;
    releaseAll();
    if (paused) {
      const buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }> = [
        { label: "▶ 继续", onClick: () => togglePause() },
      ];
      if (opts.onQuit) buttons.push({ label: "🚪 退出", ghost: true, onClick: () => opts.onQuit?.() });
      showVeil("休息一下", "按 Esc 或点「继续」接着玩。", buttons);
    } else {
      clearVeil();
      lastTime = 0;
    }
  }

  pauseBtn.addEventListener("click", () => {
    opts.sfx("tap");
    togglePause();
  });

  function toast(text: string): void {
    toastEl.textContent = text;
    toastEl.classList.add("pcp-on");
    toastT = 2.2;
  }

  function playThrottled(name: SoundName, now: number): void {
    const last = sfxAt.get(name) ?? -1;
    if (now - last < 90) return;
    sfxAt.set(name, now);
    opts.sfx(name);
  }

  function consumeEvents(now: number): void {
    for (const ev of drainEvents(world)) {
      const sound = SFX_FOR_EVENT[ev.kind];
      if (sound) playThrottled(sound, now);
      const art = PARTICLE_FOR_EVENT[ev.kind];
      if (art && !calm) {
        particles.push({ x: ev.x, y: ev.y, vy: -34, life: 0.9, art, size: 18 });
        if (particles.length > 42) particles.shift();
      }
      // 公主挥杖(带 hero 下标的 shoot):杖头甩出 5 颗星尘轨迹(reduced 不生成)
      if (ev.kind === "shoot" && ev.hero !== undefined) fx.stardust(ev.x, ev.y, calm);
      // 通关:两人对视击掌 + 彩纸;reduced 只摆姿势(静止合影)
      if (ev.kind === "win") {
        const a = world.heroes[0];
        const b = world.heroes[1] ?? a;
        fx.highFive((a.x + b.x) / 2, Math.min(a.y, b.y) - HERO_H * 0.8, calm);
      }
      if (ev.kind === "guard") {
        toast(ev.text === "melee" ? "护甲变红了!换王子的剑" : "护甲变蓝了!换公主的星星");
      }
      if (ev.kind === "door") {
        toast(opts.players === 1 ? "城门开啦!你自己跑过去才算过关" : "城门开啦!快跑过去");
      }
      if (ev.kind === "flag") toast(`${SPEC.checkpoint.icon} 小旗点亮啦,摔下去就回这儿`);
      if (ev.kind === "cloud") {
        const who = ev.hero === undefined ? "" : HERO_NAMES[world.heroes[ev.hero].kind];
        toast(`☁️ 小云朵把${who}托回小旗啦,宝石都还在`);
      }
      if (ev.kind === "bridge") toast("📦 箱子架成一座小桥啦!");
    }
  }

  // ---- 渲染 ----
  let pal = PALETTES[world.def.chapterIndex % PALETTES.length];

  function drawHero(ctx: CanvasRenderingContext2D, sx: number, sy: number, scale: number, hi: number): void {
    const h = world.heroes[hi];
    const c = HERO_COLORS[hi % HERO_COLORS.length];
    const hh = HERO_H * scale;
    const hw = HERO_W * scale;
    // 无敌闪烁:节拍和 1.2 逐帧一致(`invulnBlink` 就是原公式),
    // 只把闪烁的表达从「压透明度」换成「主色 +40% 提亮」。
    const blink = invulnBlink(world.invuln, calm);
    const lift = (col: string): string => (blink ? blinkLift(col) : col);
    const headR = Math.max(4, hw * 0.4);
    const headCY = -hh + headR * 0.95;
    const bodyTop = headCY + headR * 0.72;
    // 通关击掌:两人转身对视、举起手里的家伙(reduced 也摆,静止合影)
    const celebrating = fx.celebrating && world.status === "won";
    let facing = h.facing;
    if (celebrating && world.heroes.length > 1) {
      facing = world.heroes[1 - hi].x >= h.x ? 1 : -1;
    }
    const sway = capePhase(world.time * 1000, Math.abs(h.vx) > 8, calm);

    // ① 落影椭圆(0.75×HERO_W、0.2 高,全场统一 ppShadow)
    softShadow(
      ctx,
      sx,
      sy + 1.5 * scale,
      (hw * SHADOW_W_RATIO) / 2,
      (hw * SHADOW_W_RATIO * SHADOW_H_RATIO) / 2,
      0.16,
      1,
      "rgba(90,74,120,1)"
    );

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(facing, 1);

    // ② 披风 / 披纱(画在身后,随移动 2 帧摆动;reduced 冻在 0 相)
    if (h.kind === "prince") {
      const tail = -hw * (0.62 + 0.14 * sway);
      const capeGrad = ctx.createLinearGradient(0, bodyTop, 0, 0);
      capeGrad.addColorStop(0, lift(shade(c.cloak, 8)));
      capeGrad.addColorStop(1, lift(shade(c.cloak, -24)));
      ctx.fillStyle = capeGrad;
      ctx.beginPath();
      ctx.moveTo(-hw * 0.02, bodyTop);
      ctx.quadraticCurveTo(-hw * 0.95, -hh * 0.42, tail, -hh * 0.03);
      ctx.quadraticCurveTo(-hw * 0.24, -hh * 0.2, -hw * 0.05, bodyTop + hh * 0.1);
      ctx.closePath();
      ctx.fill();
      // 内层衬色:亮一档的里子,双层披风的层次全靠它
      ctx.fillStyle = lift(shade(c.cloak, 42));
      ctx.beginPath();
      ctx.moveTo(-hw * 0.06, bodyTop + hh * 0.05);
      ctx.quadraticCurveTo(-hw * 0.68, -hh * 0.36, tail * 0.8, -hh * 0.06);
      ctx.quadraticCurveTo(-hw * 0.24, -hh * 0.2, -hw * 0.08, bodyTop + hh * 0.13);
      ctx.closePath();
      ctx.fill();
    } else {
      // 半透明披肩短纱(白 30%),勾一条细边免得和浅色背景糊成一片
      const drift = hw * 0.06 * sway;
      const veil = shawlPath();
      ctx.fillStyle = shawlFill();
      ctx.beginPath();
      ctx.moveTo(veil[0][0] * hw, veil[0][1] * hh);
      for (let i = 1; i < veil.length; i++) {
        ctx.lineTo(veil[i][0] * hw - (i <= 2 ? drift : 0), veil[i][1] * hh);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = withAlpha(c.cloakDark, 0.5);
      ctx.lineWidth = Math.max(1, 1.2 * scale);
      ctx.stroke();
    }

    // ③ 身体剪影(共用骨架、两套参数:王子裤装 / 公主钟形裙)
    const sil = h.kind === "princess" ? princessSilhouette() : princeSilhouette();
    const bodyGrad = ctx.createLinearGradient(0, bodyTop, 0, 0);
    bodyGrad.addColorStop(0, lift(shade(c.cloak, TOP_LIGHT)));
    bodyGrad.addColorStop(1, lift(c.cloak));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(sil[0][0] * hw, sil[0][1] * hh);
    for (let i = 1; i < sil.length; i++) ctx.lineTo(sil[i][0] * hw, sil[i][1] * hh);
    ctx.closePath();
    ctx.fill();
    strokeOutline(ctx, c.cloak, 1.6);

    if (h.kind === "prince") {
      // 立领
      ctx.fillStyle = lift(shade(c.cloak, 32));
      ctx.fillRect(-hw * 0.15, bodyTop - 2.4 * scale, hw * 0.3, 3.2 * scale);
      // 肩章两枚 + 双排金扣 4 点
      ctx.fillStyle = lift(PP_COLORS.ppGold);
      roundRect(ctx, -hw * 0.36, bodyTop - 1.2 * scale, hw * 0.15, 3 * scale, 1.5 * scale);
      ctx.fill();
      roundRect(ctx, hw * 0.21, bodyTop - 1.2 * scale, hw * 0.15, 3 * scale, 1.5 * scale);
      ctx.fill();
      for (const [bx, by] of buttonPoints()) {
        ctx.beginPath();
        ctx.arc(bx * hw, by * hh, Math.max(1, hw * 0.045), 0, Math.PI * 2);
        ctx.fill();
      }
      // 腰带 + 金扣
      ctx.fillStyle = lift(shade(c.cloak, -38));
      ctx.fillRect(-hw * 0.27, -hh * 0.22, hw * 0.54, hh * 0.045);
      ctx.fillStyle = lift(PP_COLORS.ppGold);
      ctx.fillRect(-hw * 0.05, -hh * 0.228, hw * 0.1, hh * 0.06);
      ctx.fillStyle = lift(shade(c.cloak, -38));
      ctx.fillRect(-hw * 0.022, -hh * 0.213, hw * 0.044, hh * 0.03);
    } else {
      // 内衬波浪下摆:ppLining 扇贝从外裙下缘探出来 —— 双层裙的辨识件
      ctx.fillStyle = lift(PP_COLORS.ppLining);
      for (const [ax, ay, ar] of skirtLiningArcs()) {
        ctx.beginPath();
        ctx.arc(ax * hw, ay * hh, ar * hw, 0, Math.PI);
        ctx.fill();
      }
      // 裙面三点小星纹(自绘五角星,不是贴 emoji)
      for (const [px, py] of skirtStars()) {
        traceStar(ctx, px * hw, py * hh, Math.max(1.4, SKIRT_STAR_R * hw));
        ctx.fill();
      }
      // 腰线
      ctx.fillStyle = lift(shade(c.cloak, 30));
      ctx.fillRect(-hw * 0.16, -hh * 0.375, hw * 0.32, 2 * scale);
    }

    // ④ 脑袋 + 脸(1.2 的眼睛腮红笑弧底子保住)
    ctx.fillStyle = lift(c.skin);
    ctx.beginPath();
    ctx.arc(0, headCY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lift(c.hair);
    ctx.beginPath();
    ctx.arc(0, headCY - headR * 0.22, headR * 0.96, Math.PI * 1.05, Math.PI * 2.05);
    ctx.fill();
    if (h.kind === "prince") {
      // 刘海分缝:一道细缝 + 一撮斜刘海
      ctx.strokeStyle = lift(shade(c.hair, -18));
      ctx.lineWidth = Math.max(1, headR * 0.09);
      ctx.beginPath();
      ctx.moveTo(-headR * 0.12, headCY - headR * 0.88);
      ctx.quadraticCurveTo(-headR * 0.05, headCY - headR * 0.55, -headR * 0.16, headCY - headR * 0.3);
      ctx.stroke();
      ctx.fillStyle = lift(c.hair);
      ctx.beginPath();
      ctx.moveTo(-headR * 0.1, headCY - headR * 0.8);
      ctx.lineTo(headR * 0.32, headCY - headR * 0.6);
      ctx.lineTo(headR * 0.05, headCY - headR * 0.34);
      ctx.closePath();
      ctx.fill();
    } else {
      // 长发侧束:脑后垂一束,发梢一个小卷
      ctx.fillStyle = lift(c.hair);
      ctx.beginPath();
      ctx.moveTo(-headR * 0.72, headCY - headR * 0.3);
      ctx.quadraticCurveTo(-headR * 1.06, headCY + headR * 0.5, -headR * 0.78, headCY + headR * 1.35);
      ctx.quadraticCurveTo(-headR * 0.5, headCY + headR * 0.9, -headR * 0.52, headCY + headR * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-headR * 0.74, headCY + headR * 1.38, headR * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // ⑤ 头饰:王子 3 齿大皇冠 / 公主蝶结 + 小皇冠(渲染高低于 6px 退化为纯色块)
    const crownPx = headR * 0.72;
    const jewels = headwearDetail(crownPx);
    const paintCrown = (cs: number, ox: number, oy: number): void => {
      const pts = crownPath();
      ctx.fillStyle = lift(PP_COLORS.ppGold);
      ctx.beginPath();
      ctx.moveTo(ox + pts[0][0] * headR * cs, oy + pts[0][1] * headR * cs);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(ox + pts[i][0] * headR * cs, oy + pts[i][1] * headR * cs);
      ctx.closePath();
      ctx.fill();
      if (!jewels) return;
      // 齿尖圆珠
      ctx.fillStyle = lift(shade(PP_COLORS.ppGold, 28));
      for (const [tx, ty] of crownTeethTips()) {
        ctx.beginPath();
        ctx.arc(ox + tx * headR * cs, oy + ty * headR * cs, Math.max(1, headR * 0.09 * cs), 0, Math.PI * 2);
        ctx.fill();
      }
      // 正中红宝石 + 高光点
      ctx.fillStyle = lift(PP_COLORS.ppRuby);
      ctx.beginPath();
      ctx.ellipse(
        ox + CROWN_RUBY.x * headR * cs,
        oy + CROWN_RUBY.y * headR * cs,
        Math.max(1, CROWN_RUBY.rx * headR * cs),
        Math.max(1, CROWN_RUBY.ry * headR * cs),
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.beginPath();
      ctx.arc(
        ox + (CROWN_RUBY.x - CROWN_RUBY.rx * 0.4) * headR * cs,
        oy + (CROWN_RUBY.y - CROWN_RUBY.ry * 0.5) * headR * cs,
        Math.max(0.6, CROWN_RUBY.hi * headR * cs),
        0,
        Math.PI * 2
      );
      ctx.fill();
    };
    if (h.kind === "prince") {
      paintCrown(1, 0, headCY);
    } else {
      paintCrown(PRINCESS_CROWN_SCALE, PRINCESS_CROWN_OFFSET_X * headR, headCY - headR * PRINCESS_CROWN_SCALE);
      // 蝴蝶结:双翼 + 中间结,长在头侧,和王子的大皇冠一眼分清
      const bow = bowShape();
      ctx.fillStyle = lift(PP_COLORS.ppRuby);
      for (const wing of bow.wings) {
        ctx.beginPath();
        ctx.moveTo(wing[0][0] * headR, headCY + wing[0][1] * headR);
        for (let i = 1; i < wing.length; i++) ctx.lineTo(wing[i][0] * headR, headCY + wing[i][1] * headR);
        ctx.closePath();
        ctx.fill();
      }
      if (jewels) {
        ctx.fillStyle = lift(shade(PP_COLORS.ppRuby, 24));
        ctx.beginPath();
        ctx.arc(bow.knot.x * headR, headCY + bow.knot.y * headR, Math.max(1, bow.knot.r * headR), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 眼睛与笑脸
    ctx.fillStyle = "#4A3020";
    ctx.beginPath();
    ctx.arc(headR * 0.34, headCY + headR * 0.06, Math.max(1.1, headR * 0.13), 0, Math.PI * 2);
    ctx.arc(-headR * 0.16, headCY + headR * 0.06, Math.max(1.1, headR * 0.13), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#C87E7E";
    ctx.lineWidth = Math.max(1, headR * 0.13);
    ctx.beginPath();
    ctx.arc(headR * 0.1, headCY + headR * 0.3, headR * 0.22, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();

    // ⑥ 手上的家伙:剑 / 魔杖(挥动窗口 attackT 只读,一个字不改)
    const swing = h.attackT > 0;
    if (h.kind === "prince") {
      ctx.save();
      ctx.translate(hw * 0.34, -hh * 0.48);
      ctx.rotate(celebrating ? -1.35 : swing ? -0.75 : -0.15);
      const bladeLen = hw * (swing ? 1.5 : 1.1);
      // 柄尾圆珠 + 握把 + 护手弧
      ctx.fillStyle = lift(PP_COLORS.ppGold);
      ctx.beginPath();
      ctx.arc(-hw * 0.17, 0, Math.max(1, hw * 0.055), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = lift(shade(PP_COLORS.ppGold, -28));
      roundRect(ctx, -hw * 0.15, -hw * 0.045, hw * 0.15, hw * 0.09, hw * 0.04);
      ctx.fill();
      ctx.strokeStyle = lift(PP_COLORS.ppGold);
      ctx.lineWidth = Math.max(1.4, hw * 0.07);
      ctx.beginPath();
      ctx.arc(0, 0, hw * 0.13, -Math.PI * 0.65, Math.PI * 0.65);
      ctx.stroke();
      // 剑刃:两段渐变(根深尖亮) + 脊线高光
      const bladeGrad = ctx.createLinearGradient(0, 0, bladeLen, 0);
      bladeGrad.addColorStop(0, "#C9D8EC");
      bladeGrad.addColorStop(0.55, "#DCE6F2");
      bladeGrad.addColorStop(1, "#F4F9FF");
      ctx.fillStyle = bladeGrad;
      ctx.beginPath();
      ctx.moveTo(hw * 0.05, -hw * 0.085);
      ctx.lineTo(bladeLen * 0.9, -hw * 0.07);
      ctx.lineTo(bladeLen, 0);
      ctx.lineTo(bladeLen * 0.9, hw * 0.07);
      ctx.lineTo(hw * 0.05, hw * 0.085);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.lineWidth = Math.max(0.8, hw * 0.02);
      ctx.beginPath();
      ctx.moveTo(hw * 0.09, 0);
      ctx.lineTo(bladeLen * 0.94, 0);
      ctx.stroke();
      // 刃光:挥剑起手那一帧,刃口一抹白扫过(功能反馈,reduced 也保留)
      if (bladeFlashOn(h.attackT, MELEE_TIME)) {
        ctx.fillStyle = BLADE_FLASH_COLOR;
        ctx.beginPath();
        ctx.moveTo(hw * 0.1, -hw * 0.16);
        ctx.lineTo(bladeLen * 1.06, -hw * 0.02);
        ctx.lineTo(bladeLen * 0.9, hw * 0.1);
        ctx.lineTo(hw * 0.1, -hw * 0.02);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(hw * 0.36, -hh * 0.5);
      ctx.rotate(celebrating ? -1.3 : swing ? -0.6 : -0.2);
      // 杖杆
      ctx.strokeStyle = lift("#E8D4A8");
      ctx.lineWidth = Math.max(1.4, hw * 0.09);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(hw * 0.7, -hw * 0.2);
      ctx.stroke();
      // 杖头:自绘五角星 + 星心渐变(挥动时放大一号;星尘轨迹由事件层生成)
      const starR = hw * (swing ? 0.24 : 0.18);
      const scx = hw * 0.78;
      const scy = -hw * 0.24;
      traceStar(ctx, scx, scy, starR);
      ctx.fillStyle = ballGradient(ctx, scx, scy, starR, lift(PP_COLORS.ppGold));
      ctx.fill();
      strokeOutline(ctx, PP_COLORS.ppGold, 1.5);
      ctx.restore();
    }
    ctx.restore();

    // 受伤那一下:身上罩一层小护盾(不是伤口,也不是血)
    if (world.invuln > 0) {
      ctx.globalAlpha = 0.34;
      ctx.strokeStyle = "#7FC7F2";
      ctx.lineWidth = Math.max(1.6, 2.4 * scale);
      ctx.beginPath();
      ctx.arc(sx, sy - hh * 0.52, hh * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawShieldBadge(ctx, sx, sy - hh * 1.18, 6.5 * Math.max(0.7, scale));
    }

    // 公主正在滑翔:头顶一片小羽毛 + 一根额度条
    if (h.glide.active) {
      drawFeatherBadge(ctx, sx - h.facing * hw * 0.8, sy - hh * 0.5, 7 * Math.max(0.7, scale));
      const gw = hw * 1.1;
      ctx.fillStyle = "#ffffffcc";
      roundRect(ctx, sx - gw / 2, sy - hh - 8 * scale, gw, 4 * scale, 2 * scale);
      ctx.fill();
      ctx.fillStyle = "#7FC7F2";
      roundRect(ctx, sx - gw / 2, sy - hh - 8 * scale, gw * glideFraction(h.glide), 4 * scale, 2 * scale);
      ctx.fill();
    }

    // 王子正在推箱子
    if (h.pushing) drawCrateBadge(ctx, sx + h.facing * hw * 0.9, sy - hh * 0.75, 6.5 * Math.max(0.7, scale));

    // 二段跳的小翅膀
    if (h.kind === "princess" && !h.onGround && h.airJumps === 0 && !h.glide.active) {
      ctx.globalAlpha = 0.6;
      drawWingBadge(ctx, sx - h.facing * hw * 0.7, sy - hh * 0.55, 6.5 * Math.max(0.7, scale));
      ctx.globalAlpha = 1;
    }

    // 单人模式给正在操作的那位加个小箭头
    if (opts.players === 1 && hi === world.active) {
      ctx.fillStyle = "#C85E8C";
      ctx.beginPath();
      ctx.moveTo(sx, sy - hh - 10 * scale);
      ctx.lineTo(sx - 7 * scale, sy - hh - 22 * scale);
      ctx.lineTo(sx + 7 * scale, sy - hh - 22 * scale);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 修复员 S2:BOSS 出场弹入的渲染侧小账本(按 world 实例起算一次,重开/下一关自动归零)
  let bossIntroWorld: World | null = null;
  let bossIntroAt = 0;

  function render(): void {
    if (!g) return;
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    const cssW = Math.max(240, canvas.clientWidth || 360);
    const cssH = Math.max(150, canvas.clientHeight || 260);
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const def = world.def;
    const scale = Math.max(0.5, Math.min(1.1, cssW / 560));
    const viewW = cssW / scale;
    const groundY = cssH - Math.max(40, cssH * 0.2);
    const camX = cameraX(world.heroes.map((h) => h.x), viewW, def.len);
    const sx = (wx: number): number => (wx - camX) * scale;
    const sy = (wy: number): number => groundY + wy * scale;

    // 危险标记是功能件,攒着最后画(图层序第 ⑧ 层,只让 HUD 盖它)
    const hazardMarks: Array<[number, number, number]> = [];

    // ① 天空
    const sky = g.createLinearGradient(0, 0, 0, cssH);
    sky.addColorStop(0, pal.sky0);
    sky.addColorStop(1, pal.sky1);
    g.fillStyle = sky;
    g.fillRect(0, 0, cssW, cssH);

    // ②③ 城堡塔楼两层视差 + 中景灌木:越远跟镜头跑得越慢
    drawParallax(g, camX, viewW, groundY, scale, cssW);

    // 地面(断口留空)。地面的**上表面**照「可踩」那一条画:
    // 亮顶边 + 深棕描边全 188 关一个样,底下的土色才跟章节走。
    const segs: Array<[number, number]> = [];
    let cursor = 0;
    for (const gap of def.gaps) {
      segs.push([cursor, gap.x0]);
      cursor = gap.x1;
    }
    segs.push([cursor, def.len]);
    for (const [a, b] of segs) {
      const x0 = sx(a);
      const x1 = sx(b);
      if (x1 < -40 || x0 > cssW + 40) continue;
      g.fillStyle = pal.groundDark;
      g.fillRect(x0, groundY, x1 - x0, cssH - groundY);
      g.fillStyle = pal.ground;
      g.fillRect(x0, groundY + 5 * scale, x1 - x0, 6 * scale);
      g.strokeStyle = SPEC.stand.stroke;
      g.lineWidth = Math.max(1, SPEC.stand.strokeWidth * scale * 0.8);
      g.beginPath();
      g.moveTo(x0, groundY);
      g.lineTo(x1, groundY);
      g.stroke();
      g.fillStyle = SPEC.stand.topLight ?? "#FFF6DF";
      g.fillRect(x0, groundY + 1.2 * scale, x1 - x0, Math.max(1, 3 * scale));
      g.fillStyle = pal.deco;
      for (let d = Math.ceil(a / 92) * 92; d < b; d += 92) g.fillRect(sx(d), groundY + 17 * scale, 5 * scale, 5 * scale);
    }

    // 断口:两边的崖口各插一枚危险三角,一眼看出「这儿要跳」(标记攒到最顶层)
    for (const gap of def.gaps) {
      const x0 = sx(gap.x0);
      const x1 = sx(gap.x1);
      if (x1 < -30 || x0 > cssW + 30) continue;
      hazardMarks.push([x0 - 7 * scale, groundY - 1, 9 * scale]);
      hazardMarks.push([x1 + 7 * scale, groundY - 1, 9 * scale]);
    }

    // 危险 · 尖刺(圆头软刺 + 警示条纹底座;顶上再攒一枚三角,双保险)
    for (const s of world.spikes) {
      const x0 = sx(s.x);
      const x1 = sx(s.x + s.w);
      if (x1 < -20 || x0 > cssW + 20) continue;
      drawHazardSpikes(g, x0, x1, groundY, scale);
      hazardMarks.push([(x0 + x1) / 2, groundY - 21 * scale, 8 * scale]);
    }

    // 检查点 · 小旗(两人都走过才点亮;2 帧 900ms 飘动,reduced 恒 0 相静止)
    const wave = flagWavePhase(world.time * 1000, calm);
    for (let i = 0; i < world.flags.length; i++) {
      const fxp = sx(world.flags[i]);
      if (fxp < -40 || fxp > cssW + 40) continue;
      drawCheckpointFlag(g, fxp, groundY, scale, i <= world.reached, wave);
    }

    // 可踩 · 平台
    for (const pl of world.platforms) {
      const x0 = sx(pl.x);
      if (x0 > cssW + 40 || x0 + pl.w * scale < -40) continue;
      drawStandSlab(g, x0, sy(pl.y), pl.w * scale, 13 * scale, scale, pl.moving ? "#F7DFC0" : undefined);
      if (pl.moving) drawGustBadge(g, x0 + pl.w * scale * 0.5, sy(pl.y) - 12 * scale, 5.5 * scale);
    }

    // 可推 · 重箱子(架成桥的那一块顶上多一条亮边,表示现在踩得住)
    for (const b of world.blocks) {
      const bx = sx(b.x);
      if (bx < -60 || bx > cssW + 60) continue;
      drawPushCrate(g, bx, sy(b.y), scale);
      if (b.bridge) {
        g.fillStyle = SPEC.stand.topLight ?? "#FFF6DF";
        g.fillRect(bx - (BLOCK_W / 2) * scale, sy(b.y) - BLOCK_H * scale, BLOCK_W * scale, Math.max(1, 3 * scale));
      }
    }

    // 出口 · 城门
    const gx = sx(def.goalX);
    if (gx > -70 && gx < cssW + 70) drawExitArch(g, gx, groundY, scale, doorOpen(world));

    // 奖励 · 宝石(光圈 2000ms 呼吸;reduced 停在 1.2 的固定档,浮动也停)
    const glowA = gemGlowAlpha(world.time * 1000, calm);
    for (const gem of world.gems) {
      if (gem.taken) continue;
      const x0 = sx(gem.x);
      if (x0 < -30 || x0 > cssW + 30) continue;
      const bob = calm ? 0 : Math.sin(world.time * 3 + gem.x * 0.02) * 3 * scale;
      drawRewardGem(g, x0, sy(gem.y) + bob, scale, glowA);
    }

    // 危险 · 小怪
    for (const e of world.enemies) {
      const x0 = sx(e.x);
      if (x0 < -50 || x0 > cssW + 50) continue;
      const stat = ENEMY_STATS[e.kind];
      if (!e.alive) {
        if (e.fade > 0) {
          g.globalAlpha = e.fade;
          drawEventBadge(g, "sparkle", x0, sy(e.y) - stat.h * 0.5 * scale, 10 * scale);
          g.globalAlpha = 1;
        }
        continue;
      }
      const cy = e.baseY < 0 ? sy(e.y) : sy(e.y) - stat.h * 0.5 * scale;
      // 「碰到会闪护盾」的东西一律带一枚危险三角(攒到最顶层)
      hazardMarks.push([x0, cy + stat.h * 0.52 * scale, 7 * scale]);
      if (e.hurtT > 0) g.globalAlpha = 0.55;
      // 修复员 S1:裸 emoji 字形 → 五母形自绘(尺寸盒 = ENEMY_STATS 现值,判定不动)
      drawEnemy(g, e.kind, x0, cy, stat.w * scale, stat.h * scale, world.time * 1000, calm, e.dir);
      g.globalAlpha = 1;
      // 只吃某一种攻击的怪,头顶挂一个小提示(星星是自绘的,不再贴 emoji)
      const counter = counterFor(e.kind);
      if (counter === "prince") drawSwordBadge(g, x0, cy - stat.h * 0.78 * scale, 6 * scale);
      else if (counter) drawStarIcon(g, x0, cy - stat.h * 0.78 * scale, 6 * scale);
      // 元气条(本作没有血,掉光只是坐下歇口气)
      if (e.hp < e.maxHp) {
        const bw = stat.w * scale;
        g.fillStyle = "#00000022";
        roundRect(g, x0 - bw / 2, cy - stat.h * 0.68 * scale, bw, 4 * scale, 2 * scale);
        g.fill();
        g.fillStyle = "#7BC96F";
        roundRect(g, x0 - bw / 2, cy - stat.h * 0.68 * scale, (bw * e.hp) / e.maxHp, 4 * scale, 2 * scale);
        g.fill();
      }
    }

    // 首领(修复员 S2:单色圆角矩形 + emoji 脸 → 参数化 Q 版首领骨架 + 七套特征件)
    const boss = world.boss;
    if (boss && boss.alive) {
      const info = BOSSES[boss.kind % BOSSES.length];
      const bx = sx(boss.x);
      const by = sy(boss.y);
      // 出场 400ms 缩放弹入:首次进画面才起算;reduced 直接淡入(纯视觉,判定不碰)
      if (bossIntroWorld !== world && bx > -BOSS_W * scale && bx < cssW + BOSS_W * scale) {
        bossIntroWorld = world;
        bossIntroAt = world.time;
      }
      const introK =
        bossIntroWorld === world ? Math.min(1, (world.time - bossIntroAt) / (BOSS_INTRO_MS / 1000)) : 0;
      const guardColor = boss.guard === "melee" ? "#E4635F" : "#5B8FD6";
      g.save();
      if (calm) {
        g.globalAlpha = Math.max(0.001, introK);
      } else {
        const sc = bossIntroScale(introK, false);
        g.translate(bx, by);
        g.scale(sc, sc);
        g.translate(-bx, -by);
      }
      // guard 光环:0.28 平涂底 → 边缘径向渐变淡出(被击中的一瞬更亮,读法不变)
      drawGuardHalo(g, bx, by, BOSS_W * scale, BOSS_H * scale, guardColor, boss.hurtT > 0 ? 0.45 : 0.28);
      drawBossFigure(g, bx, by, BOSS_W * scale, BOSS_H * scale, boss.kind % BOSSES.length, info.color);
      g.restore();
      g.globalAlpha = 1;
      if (boss.guard === "melee") drawSwordBadge(g, bx, by - (BOSS_H + 22) * scale, 10 * scale);
      else drawStarIcon(g, bx, by - (BOSS_H + 22) * scale, 10 * scale);
    }

    // 弹幕:敌方的弹也是危险,照三角画(攒到最顶层);公主的星弹是自绘五角星
    for (const s of world.shots) {
      if (!s.alive) continue;
      const x0 = sx(s.x);
      if (x0 < -20 || x0 > cssW + 20) continue;
      if (s.friendly) drawStarIcon(g, x0, sy(s.y), SHOT_R * 1.2 * scale);
      else hazardMarks.push([x0, sy(s.y) + SHOT_R * scale, SHOT_R * scale]);
    }

    // 主角
    for (let i = 0; i < world.heroes.length; i++) {
      const h = world.heroes[i];
      drawHero(g, sx(h.x), sy(h.y), scale, i);
    }

    // 掉队的那位:两人拉开一屏以上时,在边上贴一个「他在那边」的指路标
    for (let i = 0; i < world.heroes.length; i++) {
      const h = world.heroes[i];
      if (onScreen(h.x, camX, viewW)) continue;
      const left = h.x < camX;
      const mx = left ? 18 * scale : cssW - 18 * scale;
      const my = groundY - 46 * scale;
      g.fillStyle = HERO_COLORS[i % HERO_COLORS.length].cloak;
      g.beginPath();
      g.moveTo(left ? mx - 10 * scale : mx + 10 * scale, my);
      g.lineTo(left ? mx + 6 * scale : mx - 6 * scale, my - 11 * scale);
      g.lineTo(left ? mx + 6 * scale : mx - 6 * scale, my + 11 * scale);
      g.closePath();
      g.fill();
      drawRoyalBadge(g, mx, my - 24 * scale, 8.5 * scale, h.kind);
    }

    // ⑦ 特效:飘字小图 + 星尘轨迹 / 击掌彩纸(世界坐标 → 屏幕坐标)
    for (const p of particles) {
      g.globalAlpha = Math.max(0, Math.min(1, p.life));
      drawEventBadge(g, p.art, sx(p.x), sy(p.y), p.size * scale * 0.5);
    }
    g.globalAlpha = 1;
    if (fx.count > 0) {
      g.save();
      g.translate(-camX * scale, groundY);
      g.scale(scale, scale);
      fx.draw(g);
      g.restore();
    }

    // ⑧ 危险标记(功能件):压过所有美术层,只让 HUD 盖它
    for (const [mx, my, ms] of hazardMarks) drawHazardMark(g, mx, my, ms);

    // 开场横幅
    if (readyT > 0) {
      g.fillStyle = "rgba(255,248,252,.86)";
      g.fillRect(0, cssH * 0.3, cssW, cssH * 0.4);
      g.fillStyle = "#7B4A72";
      g.font = `900 ${Math.round(20 * Math.max(0.8, scale))}px "PingFang SC",system-ui,sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(def.name, cssW / 2, cssH * 0.44);
      g.font = `700 ${Math.round(13 * Math.max(0.8, scale))}px "PingFang SC",system-ui,sans-serif`;
      g.fillText(def.feature, cssW / 2, cssH * 0.58);
    }

    // 首领元气条画在画布顶上
    if (boss && boss.alive) {
      const info = BOSSES[boss.kind % BOSSES.length];
      const w = cssW * 0.62;
      const x0 = (cssW - w) / 2;
      g.fillStyle = "#ffffffcc";
      roundRect(g, x0, 8, w, 16, 8);
      g.fill();
      g.fillStyle = boss.guard === "melee" ? "#E4635F" : "#5B8FD6";
      roundRect(g, x0, 8, (w * boss.hp) / boss.maxHp, 16, 8);
      g.fill();
      g.fillStyle = "#5A2E52";
      g.font = `900 11px "PingFang SC",system-ui,sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(`${info.emoji} ${info.name} · ${boss.guard === "melee" ? "只吃剑" : "只吃星星"}`, cssW / 2, 16);
    }
  }

  /**
   * 2D 侧视不变,背景堆出城堡的纵深:
   * ② 两层塔楼剪影(远 ppCastleFar / 中 ppCastleMid,城齿 + 尖顶 + 小旗),
   * ③ 中景灌木(圆头绿丛,颜色仍跟章节走,保住「一章一景」)。
   */
  function drawParallax(
    ctx: CanvasRenderingContext2D,
    camX: number,
    viewW: number,
    groundY: number,
    scale: number,
    cssW: number
  ): void {
    const towers: Array<{ color: string; speed: number; step: number; hi: number; alpha: number }> = [
      { color: PP_COLORS.ppCastleFar, speed: 0.18, step: 260, hi: 96, alpha: 0.5 },
      { color: PP_COLORS.ppCastleMid, speed: 0.42, step: 200, hi: 64, alpha: 0.55 },
    ];
    for (let li = 0; li < towers.length; li++) {
      const L = towers[li];
      ctx.globalAlpha = L.alpha;
      const span = viewW + L.step * 2;
      const count = Math.ceil(span / L.step) + 1;
      for (let i = 0; i < count; i++) {
        const bx = ((i * L.step - camX * L.speed) % span + span) % span - L.step;
        const bh = L.hi * 0.6 + ((i * 41 + li * 17) % Math.max(1, L.hi * 0.6));
        const bw = L.step * 0.26 + ((i * 19 + li * 7) % Math.max(1, L.step * 0.16));
        const x = bx * scale;
        const w = bw * scale;
        const topY = groundY - bh * scale;
        // 塔身
        ctx.fillStyle = L.color;
        roundRect(ctx, x, topY, w, bh * scale, 3 * scale);
        ctx.fill();
        // 城齿(三枚方齿)
        const merlon = w / 5;
        for (let m = 0; m < 3; m++) {
          ctx.fillRect(x + merlon * (m * 1.5 + 0.25), topY - merlon * 0.8, merlon, merlon * 0.9);
        }
        // 尖顶塔楼:每隔一座给一顶锥形帽 + 一面小旗
        if ((i + li) % 2 === 0) {
          ctx.fillStyle = shade(L.color, -12);
          ctx.beginPath();
          ctx.moveTo(x + w * 0.18, topY - merlon * 0.6);
          ctx.lineTo(x + w * 0.5, topY - bh * scale * 0.42 - merlon);
          ctx.lineTo(x + w * 0.82, topY - merlon * 0.6);
          ctx.closePath();
          ctx.fill();
          const flagX = x + w * 0.5;
          const flagY = topY - bh * scale * 0.42 - merlon;
          ctx.strokeStyle = shade(L.color, -24);
          ctx.lineWidth = Math.max(1, scale);
          ctx.beginPath();
          ctx.moveTo(flagX, flagY);
          ctx.lineTo(flagX, flagY - 8 * scale);
          ctx.stroke();
          ctx.fillStyle = PP_COLORS.ppRuby;
          ctx.beginPath();
          ctx.moveTo(flagX, flagY - 8 * scale);
          ctx.lineTo(flagX + 7 * scale, flagY - 5.5 * scale);
          ctx.lineTo(flagX, flagY - 3 * scale);
          ctx.closePath();
          ctx.fill();
        }
        if (x > cssW + L.step) break;
      }
    }
    // ③ 中景灌木:两球一丛的圆头绿篱,颜色跟章节
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pal.mid;
    const bStep = 140;
    const bSpan = viewW + bStep * 2;
    const bCount = Math.ceil(bSpan / bStep) + 1;
    for (let i = 0; i < bCount; i++) {
      const bx = ((i * bStep - camX * 0.68) % bSpan + bSpan) % bSpan - bStep;
      const r = (12 + ((i * 23) % 9)) * scale;
      ctx.beginPath();
      ctx.arc(bx * scale, groundY - r * 0.35, r, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx * scale + r * 0.9, groundY - r * 0.2, r * 0.72, Math.PI, Math.PI * 2);
      ctx.fill();
      if (bx * scale > cssW + bStep) break;
    }
    ctx.globalAlpha = 1;
  }

  function updateHud(): void {
    const def = world.def;
    hearts.textContent = `${"❤️".repeat(Math.max(0, world.hearts))}${world.hearts <= 0 ? "💔" : ""}`;
    hearts.setAttribute("aria-label", `两人共有 ${Math.max(0, world.hearts)} 颗心`);
    if (world.boss) {
      const pct = world.boss.alive ? Math.round((world.boss.hp / world.boss.maxHp) * 100) : 0;
      barFill.style.width = `${100 - pct}%`;
      barTxt.textContent = world.boss.alive ? `首领 ${pct}%` : "首领倒下!";
    } else {
      const pct = Math.round(killRatio(world) * 100);
      barFill.style.width = `${pct}%`;
      const left = remainingForDoor(world);
      barTxt.textContent =
        left > 0 ? `还差 ${left} 只开门` : opts.players === 1 ? "城门已开 · 自己跑过去" : `城门已开 ${pct}%`;
    }
    gemChip.textContent = `${SPEC.reward.icon} ${world.gemsTaken}/${def.gemGoal}`;
    flagChip.textContent = checkpointLabel(world.flags, world.reached);
    flagChip.setAttribute("aria-label", `已经点亮 ${world.reached + 1} 面小旗,一共 ${world.flags.length} 面`);
    if (opts.showTimer) {
      timerChip.textContent =
        def.timeLimit > 0
          ? `⏱ ${Math.max(0, Math.ceil(def.timeLimit - world.time))}s`
          : `⏱ ${Math.round(world.time)}s`;
    }
    if (opts.extraChip) extraChip.textContent = opts.extraChip(world);
    if (opts.players === 1) {
      const who = world.heroes[world.active];
      const card = ABILITIES[who.kind];
      whoChip.textContent = `${who.kind === "prince" ? "🤴" : "👸"} ${HERO_NAMES[who.kind]} ${card.icon}${card.name}`;
    }
    cueEl.classList.toggle("pcp-on", cueT > 0 && cueVisible(TEACH_CUE_SECONDS - cueT));
  }

  function frame(now: number): void {
    if (destroyed) return;
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
    lastTime = now;

    if (!paused && !ended) {
      if (readyT > 0) {
        readyT = Math.max(0, readyT - dt);
      } else {
        if (cueT > 0) cueT = Math.max(0, cueT - dt);
        // 单人模式:没被操作的那位交给小伙伴 AI 托管
        const feed: Input[] = world.heroes.map((_, i) => {
          if (opts.players === 2 || i === world.active) return inputs[i] ?? emptyInput();
          return botInput(world, i, dt);
        });
        stepWorld(world, dt, feed);
      }
      consumeEvents(now);
      for (const p of particles) {
        p.life -= dt;
        p.y += p.vy * dt;
      }
      while (particles.length > 0 && particles[0].life <= 0) particles.shift();
    }

    // 星尘与击掌彩纸是纯视觉账本:通关后世界停了它也要走完,只有暂停才冻结
    if (!paused) {
      fx.step(dt);
      if (toastT > 0) {
        toastT -= dt;
        if (toastT <= 0) toastEl.classList.remove("pcp-on");
      }
    }

    updateHud();
    render();

    if (!ended && world.status !== "playing") {
      ended = true;
      opts.onEnd(world.status === "won", world);
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    get world() {
      return world;
    },
    swap(def, keep) {
      world = createWorld(def, opts.players);
      world.hearts = Math.max(1, Math.min(def.hearts, keep.hearts));
      pal = PALETTES[def.chapterIndex % PALETTES.length];
      ended = false;
      readyT = 1.2;
      cueT = def.teach ? TEACH_CUE_SECONDS : 0;
      refreshCue(def);
      particles.length = 0;
      fx.clear();
      releaseAll();
      clearVeil();
    },
    showVeil,
    toast,
    destroy() {
      destroyed = true;
      ended = true;
      particles.length = 0;
      fx.clear();
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerup", releaseAll);
      window.removeEventListener("blur", releaseAll);
      clearVeil();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 玩家人数:整局记住,回地图再进来还是上次那个模式
// ---------------------------------------------------------------------------

let preferredPlayers: 1 | 2 = 1;

/** 单人时给的开场提示;双人时提示两套键位 */
export function tipFor(def: LevelDef, players: 1 | 2): string {
  const abil = `${ABILITIES.prince.icon}王子推重物 · ${ABILITIES.princess.icon}公主滑翔`;
  if (def.teach) return `${def.hint} 这一关不掉心,慢慢看。${abil}`;
  if (players === 2) return `${def.hint} 王子 WASD+F,公主 方向键+L。${abil}`;
  return `${def.hint} 按 Tab 或点 🔁 换人。${abil}`;
}

// ---------------------------------------------------------------------------
// 闯关模式
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const def = buildLevel(ctx.level);
  const field = createField(stage, {
    def,
    players: preferredPlayers,
    sfx: ctx.sfx,
    title: def.name,
    tip: tipFor(def, preferredPlayers),
    showTimer: true,
    onEnd: (win, w) => {
      const summary = summarize(w);
      if (win) ctx.win(starsForRun(def, summary), winMessage(def, summary));
      else ctx.lose(w.message || "再来一次!这回先想好谁打哪一只。");
    },
  });
  return { destroy: () => field.destroy() };
}

// ---------------------------------------------------------------------------
// 无尽「城堡塔」:一层一层往上爬,成绩记的是**层数**
// ---------------------------------------------------------------------------

/** 成绩牌上那一行 */
export function towerBestLabel(best: number): string {
  return best > 0 ? `🏰 爬到过第 ${best} 层` : "🏰 还没爬过";
}

function mountTower(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const head = el("div", "pcp-head");
  const back = el("button", "pcp-btn", "🗺️ 回关卡");
  back.type = "button";
  const title = el("div", "pcp-head-title", "🏰 无尽城堡塔");
  const bestChip = el("span", "pcp-chip");
  head.append(back, title, bestChip);
  const fieldHost = el("div");
  root.append(style, head, fieldHost);
  host.appendChild(root);

  /** 现在正在爬第几层(0 基) */
  let floor = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  bestChip.textContent = towerBestLabel(best);

  let field: Field | null = null;

  function startFloor(def: LevelDef, hearts: number): void {
    field?.destroy();
    field = createField(fieldHost, {
      def,
      players: preferredPlayers,
      sfx: (n) => api.play(n),
      title: def.name,
      tip: "一层一层往上爬!每一层都是拼出来的,走得通才会摆给你。",
      showTimer: false,
      extraChip: () => `🏰 第 ${floor + 1} 层`,
      onQuit: onExit,
      onEnd: (win, w) => {
        if (win) {
          floor++;
          const hp = Math.min(def.hearts, w.hearts + (w.def.boss ? 2 : 1));
          field?.swap(buildEndless(floor), { hearts: hp });
          field?.toast(
            w.def.boss ? "守门首领让路啦!补两颗心,继续往上" : `爬上第 ${floor + 1} 层!补一颗心,继续`
          );
          api.play("win");
          return;
        }
        finish(w);
      },
    });
  }

  /** 这一趟爬到过的最高层(1 基) */
  function reachedFloor(): number {
    return floor + 1;
  }

  function finish(w: World): void {
    const n = reachedFloor();
    const record = n > best;
    // 无尽成绩记的是**层数**,不是折算出来的分数
    if (record) best = save.recordEndlessBest(meta.id, n);
    bestChip.textContent = towerBestLabel(best);
    const bonus = Math.min(6, Math.floor(n / 2));
    if (bonus > 0) api.addStars(bonus);
    api.play(record ? "win" : "oops");
    const why = w.message || "心用完啦,这趟先爬到这儿。";
    field?.showVeil(
      record ? `新纪录!爬到第 ${n} 层` : `这趟爬到第 ${n} 层`,
      `${why}${record ? "这是你们爬得最高的一次!" : `最高纪录第 ${best} 层,再来一趟就追上了。`}${
        bonus > 0 ? `送你们 ${bonus} 颗小星星。` : ""
      }`,
      [
        {
          label: "🔁 再爬一次",
          onClick: () => {
            floor = 0;
            startFloor(buildEndless(0), 6);
          },
        },
        { label: "🗺️ 回关卡", ghost: true, onClick: onExit },
      ]
    );
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  startFloor(buildEndless(0), 6);

  return {
    destroy() {
      field?.destroy();
      field = null;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 攻略
// ---------------------------------------------------------------------------

// 攻略正文统一放在 ./guide.ts,关卡里翻到的和攻略抽屉里翻到的是同一份。
function buildGuide(): GuideBook {
  return GUIDE;
}

/** 首页玩法说明用 */
export const MODE_LABELS: readonly string[] = ["188 关战役", "双人合作", "一个人换着玩", "无尽城堡塔"];

/** 元素规范表的图例(给首页 / 攻略抽屉之外的地方复用) */
export const ELEMENT_LEGEND: readonly string[] = legendLines();

/** 规范表里这一条的形状与描边(渲染层与用例共用同一个入口) */
export function specLegend(): ElementSpec[] {
  return Object.values(SPEC);
}

// ---------------------------------------------------------------------------
// 入口:模式选择 + 188 关地图 + 直达第 N 关
// ---------------------------------------------------------------------------

/** 地址栏上的 `?level=N`(1 基;壳层没给 `initialLevel` 时的兜底) */
export function levelFromQuery(search: string | null): number | null {
  if (!search) return null;
  const raw = new URLSearchParams(search).get("level");
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export interface PrincePrincessHandle {
  /** 平台「直达第 N 关」(1 基),返回真正打开的那一关 */
  openCampaignLevel: (n: number) => number;
  destroy: () => void;
}

export function mount(api: GameApi): PrincePrincessHandle {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "pcp-modebar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const soloBtn = el("button", "pcp-mode");
  soloBtn.type = "button";
  const duoBtn = el("button", "pcp-mode pcp-mode-duo");
  duoBtn.type = "button";
  const towerBtn = el("button", "pcp-mode pcp-mode-tower");
  towerBtn.type = "button";
  bar.append(soloBtn, duoBtn, towerBtn);

  let current: { destroy: () => void } | null = null;
  let direct: { destroy: () => void } | null = null;

  function refreshBar(): void {
    soloBtn.textContent = "🧍 一个人玩(Tab 换人)";
    duoBtn.textContent = "👫 两人一起";
    soloBtn.className = `pcp-mode${preferredPlayers === 1 ? "" : " pcp-mode-off"}`;
    duoBtn.className = `pcp-mode pcp-mode-duo${preferredPlayers === 2 ? "" : " pcp-mode-off"}`;
    soloBtn.setAttribute("aria-pressed", preferredPlayers === 1 ? "true" : "false");
    duoBtn.setAttribute("aria-pressed", preferredPlayers === 2 ? "true" : "false");
    const best = save.getGameProgress(meta.id).endlessBest;
    towerBtn.textContent = best > 0 ? `🏰 无尽城堡塔 · 第 ${best} 层` : "🏰 无尽城堡塔 · 爬爬看!";
  }

  function setPlayers(n: 1 | 2): void {
    preferredPlayers = n;
    api.play("tap");
    refreshBar();
  }

  function closeMode(): void {
    current?.destroy();
    current = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function closeDirect(showMap: boolean): void {
    direct?.destroy();
    direct = null;
    if (showMap) {
      modeHost.hidden = true;
      levelHost.hidden = false;
      bar.hidden = false;
      refreshBar();
    }
  }

  /**
   * 直达第 N 关。
   *
   * 188 关框架只吐一个 `destroy`,没有「从第 N 关开始」的口子,所以自己开一条通道 ——
   * 星级照样存在框架那套 key 上,跳关照样走平台的家长门,也回得去选关地图。
   */
  function openDirectLevel(index: number): void {
    const i = clamp(Math.round(index), 0, TOTAL_LEVELS - 1);
    closeDirect(false);
    current?.destroy();
    current = null;
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;

    const ci = chapterOf(CHAPTERS, i);
    const ch: Chapter = CHAPTERS[ci];
    const shell = el("div", "pcp-direct");
    const shellStyle = el("style");
    shellStyle.textContent = CSS;
    const shellHead = el("div", "pcp-head");
    const backBtn = el("button", "pcp-btn", "🗺️ 回关卡");
    backBtn.type = "button";
    backBtn.addEventListener("click", () => {
      api.play("tap");
      closeDirect(true);
    });
    const shellTitle = el("div", "pcp-head-title", `${ch.emoji} ${ch.name} · 第 ${i + 1} 关`);
    shellHead.append(backBtn, shellTitle);
    const stage = el("div");
    shell.append(shellStyle, shellHead, stage);
    modeHost.appendChild(shell);

    let handle: PlayHandle | undefined;
    let settled = false;

    // 跳关走平台那道家长门:壳层没注册 requestSkip 就干脆不挂按钮(单测环境保持干净)。
    // 放行 = 本关记 0 星、解锁下一关,战役星数一颗不送。
    const request = getLevelExtras().requestSkip;
    if (request && i < TOTAL_LEVELS - 1) {
      const skipBtn = el("button", "pcp-btn", `⏭️ 跳过 第 ${i + 1} 关`);
      skipBtn.type = "button";
      let asking = false;
      skipBtn.addEventListener("click", () => {
        if (asking || settled) return;
        asking = true;
        skipBtn.disabled = true;
        api.play("tap");
        void Promise.resolve(request(meta.id, i))
          .then((ok) => {
            if (!ok) return;
            settled = true;
            markSkipped(meta.id, i);
            openDirectLevel(i + 1);
          })
          .finally(() => {
            asking = false;
            skipBtn.disabled = false;
          });
      });
      shellHead.appendChild(skipBtn);
    }

    function settle(title: string, msg: string, buttons: Array<{ label: string; go: () => void }>): void {
      handle?.destroy?.();
      handle = undefined;
      const over = el("div", "pcp-over");
      over.append(el("div", "pcp-over-t", title), el("div", "pcp-over-s", msg));
      const row = el("div", "pcp-acts");
      for (const b of buttons) {
        const btn = el("button", "pcp-act", b.label);
        btn.type = "button";
        btn.addEventListener("click", () => {
          api.play("tap");
          b.go();
        });
        row.appendChild(btn);
      }
      over.appendChild(row);
      shell.appendChild(over);
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
        if (i + 1 < TOTAL_LEVELS) buttons.push({ label: "下一关 ▶", go: () => openDirectLevel(i + 1) });
        buttons.push({ label: "🔁 再玩一次", go: () => openDirectLevel(i) });
        buttons.push({ label: "🗺️ 选关地图", go: () => closeDirect(true) });
        settle(`🌟 第 ${i + 1} 关过关!`, msg ?? "走得漂亮!", buttons);
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

    handle = playLevel(stage, ctx) ?? undefined;
    direct = {
      destroy() {
        handle?.destroy?.();
        handle = undefined;
        shell.remove();
      },
    };
  }

  function openCampaignLevel(n: number): number {
    const i = clamp(Math.round(n) - 1, 0, TOTAL_LEVELS - 1);
    openDirectLevel(i);
    return i + 1;
  }

  soloBtn.addEventListener("click", () => setPlayers(1));
  duoBtn.addEventListener("click", () => setPlayers(2));
  towerBtn.addEventListener("click", () => {
    if (current || direct) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    current = mountTower(modeHost, api, closeMode);
  });
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "每章第 1 关是不掉心的练习关;路上的小旗走过就点亮,摔下去回小旗,宝石都还在。",
      grandMessage: "188 关全部走完,王子和公主一起坐上了王座,你就是王国的小英雄!",
      guide: buildGuide(),
      guideTitle: "冒险小攻略",
    }
  );

  const jumpTo =
    (api as { initialLevel?: number }).initialLevel ??
    levelFromQuery(typeof location === "object" && location ? location.search : null);
  if (jumpTo !== null && jumpTo !== undefined) openCampaignLevel(jumpTo);

  return {
    openCampaignLevel,
    destroy() {
      current?.destroy();
      current = null;
      direct?.destroy();
      direct = null;
      level.destroy();
      root.remove();
    },
  };
}

/** 给测试与攻略用:某一关是不是首领关 */
export function isBossLevel(level: number): boolean {
  return bossSlotOf(level) !== null;
}
