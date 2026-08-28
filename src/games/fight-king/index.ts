export { meta } from "./meta";

// 朵星格斗王 —— 2D 卡通对打。
//
// 五种模式共用同一套对局界面：
//   · 双人对战：同屏两套键位，朵朵 WASD+F/G，星星 方向键+L/K；
//   · 人机对战：AI 五档，一档比一档多会一样本事（会跳会投 → 会防反 → 高手）；
//   · 格斗塔：走 src/games/level99.ts 的 188 关框架，八章八位守擂者；
//   · 无尽：连胜挑战，赢一场换一个更强的对手；
//   · 训练场：元气不掉，屏幕上直接看当前招的起手 / 命中 / 收招、现在处在哪一段、
//     能取消成哪几招、连段几段、离陪练多远；陪练是站立 / 蹲防 / 随机反击三选一的假人。
//
// 这是一款软软的切磋游戏：招式都是花瓣、星光、云朵、豆芽，被打中只会
// 星星飞溅、转圈圈、被弹开，条子上写的是「元气」，掉光就换人休息一下。
import { AI_HINTS, AI_LABELS, AI_LEVELS, aiInput, createBrain, resetBrain, type AiBrain, type AiLevel } from "./ai";
import {
  KEY_MAPS,
  PAUSE_KEY,
  isGameKey,
  keyHintLines,
  mergeInput,
  normalizeInput,
  readKeys,
  stickDirection
} from "./controls";
import {
  charOf,
  createMatch,
  currentMove,
  gapBetween,
  inputOf,
  isFree,
  meterRatio,
  neutralInput,
  noBuff,
  stepMatch,
  superReady,
  vigorRatio,
  type FighterBuff,
  type FighterState,
  type InputFrame,
  type MatchState
} from "./engine";
import {
  CHARACTERS,
  MOVE_SLOTS,
  STAGE_WIDTH,
  activeBoxAt,
  characterById,
  shortName,
  totalFrames,
  type Character,
  type Move,
  type MoveSlot
} from "./frames";
import {
  CHAPTERS,
  endlessAiLevel,
  endlessBuff,
  endlessEndText,
  endlessFoeId,
  endlessStarReward,
  towerStage
} from "./levels";
import {
  DUST_LIFE,
  PARALLAX,
  afterimageAlpha,
  comboPopScale,
  comboPopVisible,
  downBounceOffset,
  drawAfterimage,
  drawAvatar,
  drawBackGear,
  drawComboPop,
  drawConfetti,
  drawCutInBands,
  drawCutInCloseUp,
  drawDustPuff,
  drawFace,
  drawFarHills,
  drawFootRing,
  drawGroundBands,
  drawHeroBody,
  drawHeroLook,
  drawNearProps,
  drawRoundPips,
  drawSideMarker,
  drawSkyDecor,
  drawSpeedLines,
  drawStarShape,
  faceOf,
  hitSpark,
  lookOf,
  parallaxOffset,
  poseOf,
  shadowAlpha,
  shadowShrink,
  shimmerOffset,
  sparkLife,
  stageThemeOf,
  superCutDuration,
  superFlashAlpha,
  modeIconSVG,
  type FighterFrame,
  type SparkGrade
} from "./art";
import guide from "./guide";
import { meta } from "./meta";
import { bestStreak, initialLevelOf, locationHints, openCampaignLevel, recordStreak, streakBadge } from "./progress";
import {
  isActiveFrame,
  movePhase,
  onBlockAdvantage,
  onHitAdvantage,
  rateByVigor,
  sparkCount
} from "./rules";
import {
  DUMMY_HINTS,
  DUMMY_LABELS,
  DUMMY_MODES,
  dummyInput,
  emptyContext,
  frameReadout,
  readoutLines,
  type DummyMode
} from "./training";
import { mountLevelGame, type GameApi, type PlayCtx, type SoundName } from "../level99";

/* ------------------------------------------------------------------ */
/* 格斗塔的出战默认值                                                  */
/* ------------------------------------------------------------------ */

/**
 * 格斗塔默认派谁上场。
 *
 * 以前这里固定是 `CHARACTERS[0]`（朵朵）。第 2 轮验收拿仓库自带那把尺量下来
 * （`curve.test.ts` 的做法：玩家一侧交给 lv4 的手、对手照配表取档位与增益、固定 seed），
 * 朵朵在第 125 关往后一路 0/8，换个小伙伴立刻 4~6/8 —— **关卡表不是墙，默认主角才是**（R2B-3）。
 * 所以默认改成实测能一路推到塔顶的星星；朵朵仍旧排在选人格第一位，想用她随时点。
 */
export const TOWER_HERO_ID = "xingxing";

/** 同一关连着输这么多场，就在选人格下面提一句「换个小伙伴试试」 */
export const SWAP_HINT_AFTER = 3;

export const SWAP_HINT_TEXT = "连着几场没赢下来啦，上面那排换个小伙伴试试，换完还从这一关继续。";

/* ------------------------------------------------------------------ */
/* 样式                                                                */
/* ------------------------------------------------------------------ */

const CSS = `
.fk-root{--fk-ink:#4a3a68;--fk-soft:#7b6aa0;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  max-width:760px;margin:0 auto;color:var(--fk-ink);user-select:none;-webkit-user-select:none;
  width:100%;min-height:0;box-sizing:border-box;}
.fk-root *{box-sizing:border-box;}
.fk-card{background:linear-gradient(180deg,#fffdff,#f5f0ff);border-radius:20px;padding:14px;
  box-shadow:0 4px 14px rgba(140,120,190,.16);margin-bottom:12px;}
.fk-h{font-size:18px;font-weight:900;margin:0 0 8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.fk-sub{font-size:14px;font-weight:700;color:var(--fk-soft);line-height:1.7;}
.fk-modes{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
@media (max-width:420px){.fk-modes{grid-template-columns:1fr;}}
.fk-mode{border:none;border-radius:18px;padding:14px;text-align:left;cursor:pointer;font-family:inherit;
  background:#fff;box-shadow:0 4px 0 rgba(130,105,180,.22);display:flex;gap:10px;align-items:flex-start;}
.fk-mode:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(130,105,180,.22);}
.fk-mode-emoji{font-size:26px;line-height:1;flex:0 0 auto;}
.fk-mode-emoji svg{display:block;}
.fk-h svg{vertical-align:-4px;}
.fk-mode-t{font-size:16px;font-weight:900;color:#5b4890;}
.fk-mode-d{font-size:14px;font-weight:700;color:#8271ab;line-height:1.55;margin-top:3px;}
.fk-btn{border:none;border-radius:14px;padding:9px 15px;min-height:44px;font-size:15px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#fff;color:#6b56a0;box-shadow:0 3px 0 rgba(120,95,170,.28);white-space:nowrap;}
.fk-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,95,170,.28);}
.fk-btn[disabled]{opacity:.45;cursor:default;box-shadow:none;transform:none;}
.fk-btn-go{background:linear-gradient(180deg,#e0679f,#c8497f);color:#fff;box-shadow:0 4px 0 #a33765;}
.fk-btn-go:active{box-shadow:0 1px 0 #a33765;}
.fk-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;}
/* display:flex 会压过 hidden 属性的 UA display:none,进关/进模式时模式条要真的让位 */
.fk-bar[hidden]{display:none;}
.fk-picks{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
@media (max-width:520px){.fk-picks{grid-template-columns:1fr;}}
.fk-pick{background:#fff;border-radius:16px;padding:10px;box-shadow:0 3px 10px rgba(140,120,190,.14);}
.fk-pick-t{font-size:14px;font-weight:900;margin-bottom:6px;}
.fk-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;}
.fk-ch{border:none;border-radius:13px;padding:7px 2px;min-height:44px;cursor:pointer;font-family:inherit;background:#f6f2ff;
  display:flex;flex-direction:column;align-items:center;gap:2px;box-shadow:0 2px 0 rgba(130,105,180,.18);}
.fk-ch:active{transform:translateY(1px);}
.fk-ch-a{width:28px;height:28px;flex:0 0 auto;}
.fk-ch-n{font-size:14px;font-weight:900;color:#5b4890;}
.fk-ch-on{outline:3px solid #e0679f;background:#fff;}
/* 连着几场没赢下来才写字,平时是空的,所以不占地方 */
.fk-swap{font-size:14px;font-weight:800;color:#a3568a;line-height:1.6;margin-top:8px;}
.fk-swap:empty{display:none;}
/* N-25:矮屏/窄屏把塔的出战八宫格收成一行,展开才铺开。人机/双人/无尽不走这套壳 */
.fk-tower-compact{display:none;align-items:center;gap:8px;flex-wrap:wrap;}
.fk-tower-now{font-size:14px;font-weight:900;color:#5b4890;}
@media (max-height:640px),(max-width:430px){
  .fk-tower-hero:not(.fk-tower-open) .fk-grid,
  .fk-tower-hero:not(.fk-tower-open) .fk-pick-t{display:none;}
  .fk-tower-hero .fk-tower-compact{display:flex;}
  .fk-tower-hero{padding:10px;}
}
.fk-info{margin-top:8px;font-size:14px;font-weight:700;color:#7b6aa0;line-height:1.6;min-height:52px;}
/* N-57：训练场选人壳把「开打」钉在舞台底。关内 .fk-train-shell 键排零触碰 */
@media (max-height:500px){
  .fk-select-shell .fk-select-foot{
    position:sticky;bottom:0;z-index:5;margin-bottom:0;
    background:linear-gradient(180deg,rgba(255,253,255,0),#fffdff 10px);
    padding:8px 0 2px;
  }
  .fk-select-shell .fk-bar-go{position:static;background:none;padding:0;}
  .fk-select-shell .fk-info{min-height:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
}
.fk-stage{position:relative;border-radius:18px;overflow:hidden;background:#fdf3f8;
  box-shadow:0 4px 14px rgba(140,120,190,.2);}
.fk-canvas{display:block;width:100%;height:auto;touch-action:none;}
.fk-hud{position:absolute;left:0;right:0;top:0;padding:8px 10px 0;pointer-events:none;}
.fk-hudrow{display:flex;align-items:flex-start;gap:8px;}
.fk-side{flex:1;min-width:0;}
.fk-side-r{text-align:right;}
.fk-nrow{display:flex;align-items:center;gap:4px;min-width:0;}
.fk-side-r .fk-nrow{flex-direction:row-reverse;}
.fk-ava{width:24px;height:24px;border-radius:50%;flex:0 0 auto;
  box-shadow:0 1px 3px rgba(90,70,120,.3);background:#fff;}
.fk-name{font-size:14px;font-weight:900;color:#4a3a68;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  text-shadow:0 1px 0 rgba(255,255,255,.9);min-width:0;}
.fk-vig{height:13px;border-radius:999px;background:#ffffffcc;overflow:hidden;box-shadow:inset 0 1px 3px rgba(90,70,120,.25);}
.fk-vig-in{height:100%;border-radius:999px;background:linear-gradient(180deg,#7fd6a0,#48b57c);
  transition:width .12s linear;}
.fk-vig-low .fk-vig-in{background:linear-gradient(180deg,#ffb27a,#ef8149);}
.fk-mtr{height:7px;border-radius:999px;background:#ffffffcc;overflow:hidden;margin-top:3px;
  box-shadow:inset 0 1px 2px rgba(90,70,120,.22);}
.fk-mtr-in{height:100%;border-radius:999px;background:linear-gradient(180deg,#ffe08a,#f2b429);}
/* 满槽：换成斜纹流光底（backgroundPosition 由渲染层每帧推，reduced 时恒 0 = 静态金框） */
.fk-mtr-full{box-shadow:0 0 0 2px #e8b93a;}
.fk-mtr-full .fk-mtr-in{background:repeating-linear-gradient(105deg,#ffd75e 0 10px,#ffedb0 10px 16px,#ffd75e 16px 24px);}
.fk-pips{width:64px;height:16px;display:block;}
.fk-side-r .fk-pips{margin-left:auto;}
.fk-clock{width:74px;text-align:center;flex:0 0 auto;}
.fk-clock-t{font-size:21px;font-weight:900;color:#4a3a68;line-height:1;text-shadow:0 1px 0 rgba(255,255,255,.9);}
.fk-clock-r{font-size:14px;font-weight:800;color:#7b6aa0;}
.fk-banner{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:6px;pointer-events:none;text-align:center;padding:14px;}
.fk-banner-big{font-size:30px;font-weight:900;color:#c8497f;text-shadow:0 2px 0 #fff,0 4px 10px rgba(200,73,127,.3);}
.fk-banner-sub{font-size:15px;font-weight:800;color:#5b4890;text-shadow:0 1px 0 #fff;}
.fk-pause{position:absolute;inset:0;background:rgba(255,248,252,.95);display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:10px;padding:16px;z-index:6;}
.fk-pause-t{font-size:21px;font-weight:900;color:#8a5aa8;}
.fk-pause-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.fk-pads{display:flex;gap:8px;margin-top:10px;}
.fk-pad{flex:1;min-width:0;background:#fff8fc;border-radius:16px;padding:8px;display:flex;align-items:center;gap:8px;
  box-shadow:0 3px 10px rgba(140,120,190,.14);}
.fk-stick{position:relative;width:96px;height:96px;flex:0 0 auto;border-radius:50%;background:#f0e9ff;
  box-shadow:inset 0 2px 6px rgba(110,90,160,.22);touch-action:none;}
.fk-stick-dot{position:absolute;left:50%;top:50%;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;
  background:#fff;box-shadow:0 2px 6px rgba(110,90,160,.3);pointer-events:none;}
.fk-padbtns{flex:1;min-width:0;display:grid;grid-template-columns:1fr 1fr;gap:6px;}
/* 四颗按钮的热区一律不小于 44px，谁也不许压到谁 */
.fk-padbtn{border:none;border-radius:14px;padding:12px 4px;min-height:44px;font-size:14px;font-weight:900;
  font-family:inherit;cursor:pointer;background:#ffe3ef;color:#a33765;box-shadow:0 3px 0 rgba(180,110,150,.35);
  touch-action:none;}
.fk-padbtn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(180,110,150,.35);}
.fk-padbtn-h{background:#e2e8ff;color:#41539c;box-shadow:0 3px 0 rgba(100,120,190,.35);}
.fk-padbtn-h:active{box-shadow:0 1px 0 rgba(100,120,190,.35);}
.fk-padbtn-s{background:#ffeec2;color:#96650c;box-shadow:0 3px 0 rgba(190,150,60,.35);}
.fk-padbtn-s:active{box-shadow:0 1px 0 rgba(190,150,60,.35);}
.fk-padbtn-g{background:#d8f2e4;color:#2f7a56;box-shadow:0 3px 0 rgba(80,160,120,.35);}
.fk-padbtn-g:active{box-shadow:0 1px 0 rgba(80,160,120,.35);}
.fk-padbtn-ready{outline:3px solid #e0679f;}
.fk-pad-name{font-size:14px;font-weight:900;color:#7b6aa0;text-align:center;}
/* 连段计数是 HUD 里的独立一行 DOM，永远不会被元气条压住 */
.fk-comborow{display:flex;justify-content:space-between;gap:8px;margin-top:4px;height:20px;}
.fk-combo{font-size:15px;font-weight:900;color:#c8497f;text-shadow:0 1px 0 #fff,0 0 4px #fff;min-width:0;
  white-space:nowrap;overflow:hidden;}
.fk-combo-r{text-align:right;}
.fk-train-modes{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0;}
.fk-train-hint{font-size:14px;font-weight:700;color:#8271ab;line-height:1.6;margin-bottom:4px;}
/* N-31:教学表自滚,触屏键排与假人行常驻。FIGHT_MIN_H / 帧数表 / 判定零触碰 */
.fk-train-shell .fk-scroll{max-height:min(220px,42dvh);overflow:auto;-webkit-overflow-scrolling:touch;}
@media (max-height:640px){
  .fk-train-shell .fk-pads{
    position:sticky;bottom:0;z-index:6;margin-top:6px;
    background:linear-gradient(180deg,rgba(255,253,255,0),#fffdff 12px);
    padding:8px 0 4px;
  }
  .fk-train-shell .fk-train-modes{
    position:sticky;top:0;z-index:4;background:#fffdff;padding:4px 0;
  }
}
.fk-live b{color:#c8497f;}
.fk-hidden{display:none !important;}
.fk-fd{width:100%;border-collapse:collapse;font-size:14px;}
.fk-fd th,.fk-fd td{padding:4px 5px;text-align:center;border-bottom:1px solid #efe9fa;}
.fk-fd th{color:#8271ab;font-weight:800;}
.fk-fd td{font-weight:800;color:#5b4890;}
.fk-fd td.fk-fd-n{text-align:left;white-space:nowrap;}
.fk-fd-plus{color:#3f8f5f;}
.fk-fd-minus{color:#c05b5b;}
.fk-scroll{overflow-x:auto;}
.fk-live{font-size:14px;font-weight:800;color:#5b4890;line-height:1.7;}
.fk-btn:focus-visible,.fk-mode:focus-visible,.fk-ch:focus-visible,.fk-padbtn:focus-visible{
  outline:3px solid #3c2a6b;outline-offset:3px;}
/* 手机上两套摇杆挤在一行：摇杆收小，四颗按钮排成 2×2，但热区一律保住 44px */
@media (max-width:520px){
  .fk-pads{gap:6px;}
  .fk-pad{padding:6px;gap:6px;flex-direction:column;align-items:stretch;}
  .fk-stick{width:74px;height:74px;align-self:center;}
  .fk-stick-dot{width:28px;height:28px;margin:-14px 0 0 -14px;}
  .fk-padbtns{grid-template-columns:1fr 1fr;gap:5px;}
  .fk-padbtn{padding:12px 2px;min-height:44px;font-size:14px;}
  .fk-clock{width:58px;}
  .fk-clock-t{font-size:18px;}
  .fk-combo{font-size:14px;}
}
/* 360px：名字由 JS 缩到 3 字 + 省略号兜底，字号守住宪法 14px 下限，HUD 说什么也不许被顶出屏幕 */
@media (max-width:380px){
  .fk-hud{padding:6px 6px 0;}
  .fk-stick{width:66px;height:66px;}
}
@media (prefers-reduced-motion:reduce){
  .fk-vig-in{transition:none;}
}
`;

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

const FRAME_MS = 1000 / 60;
/** 防御成功的金属亮边亮多少帧 */
const GUARD_FLASH_FRAMES = 10;
/** 破防的闪光亮多少帧（比防御成功长得多，一眼分得开） */
const BREAK_FLASH_FRAMES = 26;
const CANVAS_W = STAGE_WIDTH;
/** 宽屏用扁一点的画面，窄屏用方一点的画面（手机上才装得下放大后的两个人） */
const CANVAS_H_WIDE = 380;
const CANVAS_H_NARROW = 470;
/** 低于这个 CSS 宽度就算窄屏 */
const NARROW_PX = 520;

/** 对局画面显示高的下限:再矮两个人就看不清了,低于它宁可交给舞台滚动 */
export const FIGHT_MIN_H = 150;

/**
 * 画面盒子(`.fk-stage`)该钳到多宽(null = 装得下,不用钳)。
 *
 * 画布是 `width:100%; height:auto` 的 replaced 元素:显示高 = 显示宽 × (backingH/backingW)。
 * 横屏 640×360 上按宽算显示高 ~267px,而画布下面还有整排触屏摇杆——
 * `.game-stage` 的可视高只剩 ~280px,摇杆整排掉在裁切线以下,纯触屏一步都动不了。
 * 把盒子宽度钳到「可视余量 ÷ 高宽比」,画布高度就跟着回到裁切线以内;
 * HUD / 横幅 / 暂停面板都是盒子里的 absolute 层,跟着盒子一起走,不会错位。
 * 量不出余量(测试桩 / 独立挂载)时调用方不给数,这里返回 null,一个样式都不写。
 */
export function stageMaxWidthPx(
  cssW: number,
  ratioHW: number,
  roomPx: number,
  minH = FIGHT_MIN_H
): number | null {
  if (!Number.isFinite(cssW) || cssW <= 0) return null;
  if (!Number.isFinite(ratioHW) || ratioHW <= 0) return null;
  if (!Number.isFinite(roomPx) || roomPx <= 0) return null;
  const wantH = cssW * ratioHW;
  const capH = Math.max(minH, Math.floor(roomPx - 4));
  // 差一个像素以内不算超:亚像素抖动不值得为它改样式
  if (wantH <= capH + 1) return null;
  return Math.max(120, Math.floor(capH / ratioHW));
}

function prefersReducedMotion(): boolean {
  try {
    const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    return typeof mm === "function" ? mm("(prefers-reduced-motion: reduce)").matches : false;
  } catch {
    return false;
  }
}

function coarsePointer(): boolean {
  try {
    const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    if (typeof mm === "function" && mm("(pointer: coarse)").matches) return true;
  } catch {
    // 查不到就算了
  }
  return "ontouchstart" in globalThis;
}

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

/** 往 innerHTML 里塞文字前过一道，招式名与提示都是数据，别让它们变成标签 */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"));
}

function button(cls: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", cls, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

/** 选人按钮上的小头像：画的脑袋 + 头饰（和 HUD 头像同一套画法），不再用 emoji 占位 */
function chAvatar(ch: Character, size: number): HTMLCanvasElement {
  const c = el("canvas", "fk-ch-a");
  c.width = size;
  c.height = size;
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  const actx = c.getContext?.("2d");
  if (actx) drawAvatar(actx, size, lookOf(ch.id), ch.color, ch.ink);
  return c;
}

/* ------------------------------------------------------------------ */
/* 特效粒子                                                            */
/* ------------------------------------------------------------------ */

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const SPARK_COLORS = ["#ffd45e", "#ff9ec4", "#9fd8ff", "#c6f0a8", "#ffffff"];

/* ------------------------------------------------------------------ */
/* 对局界面                                                            */
/* ------------------------------------------------------------------ */

interface FightOptions {
  p1: string;
  p2: string;
  /** 2 号位交给 AI 时给档位，null 表示第二个人来操作 */
  aiLevel: AiLevel | null;
  buffs: [FighterBuff, FighterBuff];
  roundsToWin: number;
  timeLimitSec: number;
  training: boolean;
  /** 训练场的假人行为（只有 training 为真时才用得上） */
  dummy?: DummyMode;
  /** 顶部标题（格斗塔显示关号，无尽显示连胜数） */
  title: string;
  /** 舞台主题序号（纯外观：格斗塔按章节给，不给就按选人哈希轮换） */
  stageIndex?: number;
  sfx: (name: SoundName) => void;
  /** 一场打完（训练模式不会调用）；bestCombo 是玩家侧本场最长连段，只用来展示 */
  onEnd: (
    winner: 0 | 1 | -1,
    info: { vigorLeft: number; maxVigor: number; wins: [number, number]; bestCombo: number }
  ) => void;
  /** 顶部"退出"按钮；不给就不显示 */
  onQuit?: () => void;
  /** 顶部额外按钮 */
  extraButtons?: Array<{ label: string; onClick: () => void }>;
}

interface FightHandle {
  destroy: () => void;
}

function createFight(host: HTMLElement, o: FightOptions): FightHandle {
  const reduced = prefersReducedMotion();
  let destroyed = false;
  let raf = 0;
  const timers = new Set<number>();

  const wins: [number, number] = [0, 0];
  let roundIndex = 0;
  let brain: AiBrain | null = o.aiLevel === null ? null : createBrain(o.aiLevel, 1234 + o.aiLevel * 77);
  let state = newMatch();
  let paused = false;
  let screenPhase: "ready" | "fight" | "roundEnd" | "matchEnd" = "ready";
  let phaseTimer = 90;
  let bannerBig = "准备…";
  let bannerSub = o.training ? "训练模式：元气不会掉，随便练" : "看清对手的起手再动手";
  const sparks: Spark[] = [];
  let lastComboShown = 0;
  let dummyMode: DummyMode = o.dummy ?? "stand";
  /** 超必杀演出还剩几帧（≤ 72 帧 = 1.2 秒，连点任意键立刻跳过；reduced 是 24 帧静态卡） */
  let superCut = 0;
  let superCutName = "";
  let superCutSide: 0 | 1 = 0;
  let superCutCharId = "";
  /** 防御成功 / 破防的亮边还剩几帧 */
  const guardFlash: [number, number] = [0, 0];
  const breakFlash: [number, number] = [0, 0];
  /** 命中火花（分级演出：轻 / 重 / 破防各一套画法） */
  const flashes: Array<{ x: number; y: number; grade: SparkGrade; age: number }> = [];
  /** 击倒落地的扬尘 */
  const dusts: Array<{ x: number; y: number; seed: number; age: number }> = [];
  /** 最近几帧的身位（重招命中帧画残影用），一人一条 */
  const trails: [Array<{ x: number; y: number; h: number }>, Array<{ x: number; y: number; h: number }>] = [[], []];
  /** 连击弹跳数字的年龄（连击数一变就归零弹一下） */
  const comboAge: [number, number] = [0, 0];
  const comboLast: [number, number] = [0, 0];
  /** 整场（跨回合）的最大连段，结算展示用 */
  const bestComboAll: [number, number] = [0, 0];
  /** KO 那一下的震屏帧（引擎照常推进，只震画面） */
  let koShake = 0;
  /** 结算画面自己的动画钟（引擎停了，彩带还要飘） */
  let endTick = 0;

  function newMatch(): MatchState {
    return createMatch(o.p1, o.p2, {
      config: {
        reducedMotion: reduced,
        timeLimit: o.training ? 0 : Math.round(o.timeLimitSec * 60),
        training: o.training
      },
      buffs: o.buffs
    });
  }

  /* ---------------- DOM ---------------- */

  const wrap = el("div");

  const bar = el("div", "fk-bar");
  const titleChip = el("span", "fk-h", o.title);
  titleChip.style.margin = "0";
  bar.appendChild(titleChip);
  for (const extra of o.extraButtons ?? []) {
    bar.appendChild(button("fk-btn", extra.label, extra.onClick));
  }
  bar.appendChild(
    button("fk-btn", "⏸️ 暂停", () => {
      setPaused(true);
    })
  );
  if (o.onQuit) bar.appendChild(button("fk-btn", "🚪 退出", () => o.onQuit?.()));
  wrap.appendChild(bar);

  const stage = el("div", "fk-stage");
  const canvas = el("canvas", "fk-canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H_WIDE;
  let narrowLayout = false;

  /** 地平线在画布里的高度（画布变方，地平线也跟着往下走） */
  function groundY(): number {
    return Math.round(canvas.height * 0.87);
  }

  /** 按容器宽度切换画布比例；只有真的变了才动 canvas.width，免得每帧清空画面 */
  function syncLayout(): void {
    // 拿整个 wrap 的宽当「天然宽」:画面盒子可能被 fitStage 钳过,
    // 按钳过的宽判窄屏会误切到更高的窄屏比例,越钳越窄
    const cssW =
      wrap.clientWidth || canvas.clientWidth || (globalThis as { innerWidth?: number }).innerWidth || 400;
    const narrow = cssW > 0 && cssW < NARROW_PX;
    if (narrow === narrowLayout) return;
    narrowLayout = narrow;
    canvas.height = narrow ? CANVAS_H_NARROW : CANVAS_H_WIDE;
  }

  /** 一个盒子的下沿(测试桩的 rect 可能没有 bottom,用 top+height 兜底) */
  const rectBottom = (r: { top: number; bottom?: number; height: number }): number =>
    Number.isFinite(r.bottom) ? (r.bottom as number) : r.top + r.height;

  /** 往上找平台舞台(.game-stage,定高会裁内容)的下沿;量不到返回 NaN */
  function stageClipBottom(): number {
    let node: HTMLElement | null = stage.parentElement ?? null;
    for (let i = 0; node && i < 10; i++) {
      if (typeof node.className === "string" && node.className.includes("game-stage")) {
        if (typeof node.getBoundingClientRect !== "function") break;
        const r = node.getBoundingClientRect();
        const inner =
          typeof node.clientHeight === "number" && node.clientHeight > 0
            ? (node.clientTop || 0) + node.clientHeight
            : r.height;
        if (Number.isFinite(r.top) && Number.isFinite(inner) && inner > 0) return r.top + inner;
        break;
      }
      node = node.parentElement ?? null;
    }
    return Number.NaN;
  }

  /** 量布局是回流读,不必每帧;draw 每 15 帧(~250ms)量一次 */
  let fitTick = 0;

  /** 画面装不进可视余量就把 .fk-stage 钳窄(见 stageMaxWidthPx 的注释) */
  function fitStage(): void {
    if (fitTick++ % 15 !== 0) return;
    if (!stage.style || typeof stage.getBoundingClientRect !== "function") return;
    if (typeof wrap.getBoundingClientRect !== "function") return;
    const clip = stageClipBottom();
    if (!Number.isFinite(clip)) return;
    const stageRect = stage.getBoundingClientRect();
    if (!Number.isFinite(stageRect.top)) return;
    // 画面下面还有多高的家当(触屏摇杆两块):它们的高度不随画面高变,量一次就是稳的
    const below = Math.max(0, rectBottom(wrap.getBoundingClientRect()) - rectBottom(stageRect));
    const room = clip - stageRect.top - below;
    const cssW = wrap.clientWidth || 0;
    const cap = stageMaxWidthPx(cssW, canvas.height / canvas.width, room);
    if (cap === null) {
      if (stage.style.maxWidth) {
        stage.style.maxWidth = "";
        stage.style.marginLeft = "";
        stage.style.marginRight = "";
      }
      return;
    }
    const px = `${cap}px`;
    if (stage.style.maxWidth !== px) {
      stage.style.maxWidth = px;
      stage.style.marginLeft = "auto";
      stage.style.marginRight = "auto";
    }
  }

  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "对打画面");
  stage.appendChild(canvas);

  // 手机上没有键盘，点一下画面同样能跳过超必杀演出
  const onStageTap = (): void => {
    skipSuperCut();
  };
  stage.addEventListener("pointerdown", onStageTap);

  const hud = el("div", "fk-hud");
  hud.innerHTML = `
    <div class="fk-hudrow">
      <div class="fk-side">
        <div class="fk-nrow"><canvas class="fk-ava" data-a="0" width="24" height="24"></canvas><div class="fk-name" data-n="0"></div></div>
        <div class="fk-vig" data-v="0"><div class="fk-vig-in" style="width:100%"></div></div>
        <div class="fk-mtr" data-m="0"><div class="fk-mtr-in" style="width:0%"></div></div>
        <canvas class="fk-pips" data-p="0" width="64" height="16"></canvas>
      </div>
      <div class="fk-clock">
        <div class="fk-clock-t" data-clock>--</div>
        <div class="fk-clock-r" data-round></div>
      </div>
      <div class="fk-side fk-side-r">
        <div class="fk-nrow"><canvas class="fk-ava" data-a="1" width="24" height="24"></canvas><div class="fk-name" data-n="1"></div></div>
        <div class="fk-vig" data-v="1"><div class="fk-vig-in" style="width:100%"></div></div>
        <div class="fk-mtr" data-m="1"><div class="fk-mtr-in" style="width:0%"></div></div>
        <canvas class="fk-pips" data-p="1" width="64" height="16"></canvas>
      </div>
    </div>
    <div class="fk-comborow">
      <div class="fk-combo" data-c="0"></div>
      <div class="fk-combo fk-combo-r" data-c="1"></div>
    </div>`;
  stage.appendChild(hud);

  const banner = el("div", "fk-banner");
  const bannerBigEl = el("div", "fk-banner-big");
  const bannerSubEl = el("div", "fk-banner-sub");
  banner.append(bannerBigEl, bannerSubEl);
  stage.appendChild(banner);

  const pausePanel = el("div", "fk-pause fk-hidden");
  const pauseTitle = el("div", "fk-pause-t", "⏸️ 暂停一下");
  const pauseHint = el("div", "fk-sub");
  pauseHint.style.textAlign = "center";
  pauseHint.innerHTML = keyHintLines()
    .map((s) => `<div>${s}</div>`)
    .join("");
  const pauseBtns = el("div", "fk-pause-btns");
  pauseBtns.appendChild(
    button("fk-btn fk-btn-go", "▶ 继续", () => {
      setPaused(false);
    })
  );
  pauseBtns.appendChild(
    button("fk-btn", "🔁 重打这场", () => {
      restartMatch();
      setPaused(false);
    })
  );
  if (o.onQuit) pauseBtns.appendChild(button("fk-btn", "🚪 退出", () => o.onQuit?.()));
  pausePanel.append(pauseTitle, pauseHint, pauseBtns);
  stage.appendChild(pausePanel);

  wrap.appendChild(stage);

  /* ---------------- 触屏摇杆 ---------------- */

  const pads = el("div", "fk-pads");
  const touchInputs: [InputFrame, InputFrame] = [neutralInput(), neutralInput()];
  /**
   * 「必杀」「防御」两颗按钮按的不是某个键，而是一个**意图**：
   * 前 / 后是相对朝向的，得等到取输入那一刻、知道人朝哪边了才换算得出来。
   */
  const touchIntent: Array<{ special: boolean; guard: boolean }> = [
    { special: false, guard: false },
    { special: false, guard: false }
  ];
  const padCleanups: Array<() => void> = [];
  const superBtns: Array<HTMLButtonElement | null> = [null, null];

  function buildPad(side: 0 | 1, name: string): HTMLElement {
    const pad = el("div", "fk-pad");
    const stick = el("div", "fk-stick");
    const dot = el("div", "fk-stick-dot");
    stick.appendChild(dot);
    const col = el("div", "fk-padbtns");
    const nameEl = el("div", "fk-pad-name", name);
    nameEl.style.gridColumn = "1 / -1";
    const lightBtn = el("button", "fk-padbtn", "轻击");
    lightBtn.type = "button";
    const heavyBtn = el("button", "fk-padbtn fk-padbtn-h", "重击");
    heavyBtn.type = "button";
    const specialBtn = el("button", "fk-padbtn fk-padbtn-s", "必杀");
    specialBtn.type = "button";
    const guardBtn = el("button", "fk-padbtn fk-padbtn-g", "防御");
    guardBtn.type = "button";
    superBtns[side] = specialBtn;
    col.append(nameEl, lightBtn, heavyBtn, specialBtn, guardBtn);
    pad.append(stick, col);

    let stickId = -1;
    const onStickDown = (e: PointerEvent): void => {
      e.preventDefault();
      stickId = e.pointerId;
      stick.setPointerCapture?.(e.pointerId);
      moveStick(e);
    };
    const moveStick = (e: PointerEvent): void => {
      const r = stick.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dir = stickDirection(dx, dy, Math.max(10, r.width * 0.16));
      touchInputs[side] = { ...touchInputs[side], ...dir };
      const max = r.width * 0.3;
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, max / len);
      dot.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    };
    const onStickMove = (e: PointerEvent): void => {
      if (e.pointerId !== stickId) return;
      e.preventDefault();
      moveStick(e);
    };
    const onStickUp = (e: PointerEvent): void => {
      if (e.pointerId !== stickId) return;
      stickId = -1;
      touchInputs[side] = { ...touchInputs[side], up: false, down: false, left: false, right: false };
      dot.style.transform = "";
    };
    stick.addEventListener("pointerdown", onStickDown);
    stick.addEventListener("pointermove", onStickMove);
    stick.addEventListener("pointerup", onStickUp);
    stick.addEventListener("pointercancel", onStickUp);
    padCleanups.push(() => {
      stick.removeEventListener("pointerdown", onStickDown);
      stick.removeEventListener("pointermove", onStickMove);
      stick.removeEventListener("pointerup", onStickUp);
      stick.removeEventListener("pointercancel", onStickUp);
    });

    const bindBtn = (btn: HTMLButtonElement, set: (on: boolean) => void): void => {
      const down = (e: PointerEvent): void => {
        e.preventDefault();
        set(true);
      };
      const up = (): void => set(false);
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointerleave", up);
      btn.addEventListener("pointercancel", up);
      padCleanups.push(() => {
        btn.removeEventListener("pointerdown", down);
        btn.removeEventListener("pointerup", up);
        btn.removeEventListener("pointerleave", up);
        btn.removeEventListener("pointercancel", up);
      });
    };
    bindBtn(lightBtn, (on) => {
      touchInputs[side] = { ...touchInputs[side], light: on };
    });
    bindBtn(heavyBtn, (on) => {
      touchInputs[side] = { ...touchInputs[side], heavy: on };
    });
    bindBtn(specialBtn, (on) => {
      touchIntent[side].special = on;
    });
    bindBtn(guardBtn, (on) => {
      touchIntent[side].guard = on;
    });
    return pad;
  }

  /**
   * 把触屏的「意图」换算成真正的六个键：
   *  · 必杀 = 前 + 轻击（能量满槽时自动升级成 蹲 + 轻 + 重 的超必杀）；
   *  · 防御 = 按住远离对手的方向。
   */
  function touchFrame(side: 0 | 1): InputFrame {
    const base = touchInputs[side];
    const intent = touchIntent[side];
    if (!intent.special && !intent.guard) return base;
    const f = state.fighters[side];
    const forward = f.facing === 1 ? "right" : "left";
    const back = f.facing === 1 ? "left" : "right";
    const out: InputFrame = { ...base };
    if (intent.special) {
      if (superReady(f)) {
        out.down = true;
        out.light = true;
        out.heavy = true;
      } else {
        out[forward] = true;
        out.light = true;
      }
    }
    if (intent.guard) out[back] = true;
    return out;
  }

  pads.appendChild(buildPad(0, characterById(o.p1).name));
  if (o.aiLevel === null) {
    pads.appendChild(buildPad(1, characterById(o.p2).name));
  }
  if (!coarsePointer()) pads.classList.add("fk-hidden");

  const padToggle = button("fk-btn", "📱 触屏按键", () => {
    pads.classList.toggle("fk-hidden");
    o.sfx("tap");
  });
  bar.appendChild(padToggle);

  /* ---------------- 训练模式面板 ---------------- */

  const trainPanel = el("div", "fk-card");
  const trainLive = el("div", "fk-live");
  const dummyHint = el("div", "fk-train-hint");
  if (o.training) {
    wrap.classList.add("fk-train-shell");
    const h = el("div", "fk-h");
    h.innerHTML = `${modeIconSVG("training", 20)}<span> 训练场</span>`;

    const modeRow = el("div", "fk-train-modes");
    modeRow.appendChild(el("span", "fk-sub", "假人："));
    const modeBtns: HTMLButtonElement[] = [];
    DUMMY_MODES.forEach((m, i) => {
      const b = button("fk-btn", DUMMY_LABELS[m], () => {
        dummyMode = m;
        o.sfx("tap");
        modeBtns.forEach((x, j) => x.classList.toggle("fk-ch-on", i === j));
        dummyHint.textContent = DUMMY_HINTS[m];
      });
      b.setAttribute("aria-label", `假人行为：${DUMMY_LABELS[m]}。${DUMMY_HINTS[m]}`);
      modeBtns.push(b);
      modeRow.appendChild(b);
    });
    modeBtns[DUMMY_MODES.indexOf(dummyMode)]?.classList.add("fk-ch-on");
    dummyHint.textContent = DUMMY_HINTS[dummyMode];

    const scroll = el("div", "fk-scroll");
    scroll.appendChild(frameTable(characterById(o.p1)));
    bar.appendChild(modeRow);
    trainPanel.append(h, dummyHint, trainLive, scroll);
    wrap.appendChild(trainPanel);
    wrap.appendChild(pads);
  } else {
    wrap.appendChild(pads);
  }

  host.appendChild(wrap);

  const g = canvas.getContext("2d");

  /* ---------------- 键盘 ---------------- */

  const pressed = new Set<string>();

  /** 超必杀演出：任何一下输入都算"我看够了"，直接跳过 */
  function skipSuperCut(): boolean {
    if (superCut <= 0) return false;
    superCut = 0;
    return true;
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (destroyed) return;
    if (e.code === PAUSE_KEY) {
      e.preventDefault();
      setPaused(!paused);
      return;
    }
    if (!isGameKey(e.code)) return;
    e.preventDefault();
    skipSuperCut();
    pressed.add(e.code);
  }
  function onKeyUp(e: KeyboardEvent): void {
    pressed.delete(e.code);
  }
  function onBlur(): void {
    pressed.clear();
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  function setPaused(v: boolean): void {
    if (screenPhase === "matchEnd") return;
    paused = v;
    pausePanel.classList.toggle("fk-hidden", !v);
    if (v) o.sfx("tap");
  }

  function later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!destroyed) fn();
    }, ms);
    timers.add(id);
  }

  /* ---------------- 回合流程 ---------------- */

  /** 一回合结束 / 重开时把纯画面的痕迹全清掉 */
  function clearFx(): void {
    sparks.length = 0;
    flashes.length = 0;
    dusts.length = 0;
    trails[0].length = 0;
    trails[1].length = 0;
    koShake = 0;
    endTick = 0;
  }

  function restartMatch(): void {
    wins[0] = 0;
    wins[1] = 0;
    roundIndex = 0;
    bestComboAll[0] = 0;
    bestComboAll[1] = 0;
    if (brain) resetBrain(brain);
    state = newMatch();
    clearFx();
    screenPhase = "ready";
    phaseTimer = 90;
    bannerBig = "准备…";
    bannerSub = "看清对手的起手再动手";
  }

  function startNextRound(): void {
    roundIndex++;
    if (brain) resetBrain(brain);
    state = newMatch();
    clearFx();
    camScale = 0;
    screenPhase = "ready";
    phaseTimer = 80;
    bannerBig = `第 ${roundIndex + 1} 回合`;
    bannerSub = "准备…";
  }

  function readPlayerInput(side: 0 | 1): InputFrame {
    const kb = readKeys(pressed, KEY_MAPS[side]);
    return normalizeInput(mergeInput(kb, touchFrame(side)));
  }

  function gatherInputs(): [InputFrame, InputFrame] {
    const p1 = readPlayerInput(0);
    if (o.training) {
      // 训练场的 2 号位是假人，不是 AI：三种行为里选一种，行为本身是纯函数
      return [p1, dummyInput(dummyMode, state.fighters[1], state.fighters[0], Math.random)];
    }
    const p2 = brain ? aiInput(brain, state, 1) : readPlayerInput(1);
    return [p1, p2];
  }

  /** `y` 是对局里"离地多高"，这里换成画布坐标（往下为正）再撒星星 */
  function spawnSparks(x: number, y: number, power: number): void {
    const sy = groundY() - y;
    const n = sparkCount(power, reduced);
    for (let i = 0; i < n && sparks.length < 90; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const sp = 1.6 + Math.random() * 3.4;
      sparks.push({
        x,
        y: sy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1.2,
        life: 22 + Math.round(Math.random() * 12),
        maxLife: 34,
        size: 3 + Math.random() * 4,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)]
      });
    }
  }

  /** 这一下算轻招还是重招（决定火花的档位；查的是招式类别，不碰任何数值） */
  function sparkGradeOf(ev: { side: 0 | 1; slot: MoveSlot | null }): SparkGrade {
    if (!ev.slot) return "light";
    const kind = charOf(state.fighters[ev.side]).moves[ev.slot].kind;
    return kind === "light" ? "light" : "heavy";
  }

  /** 把倒地的一下配上三团扬尘（纯画面） */
  function spawnDust(x: number): void {
    for (let i = 0; i < 3; i++) {
      dusts.push({ x: x + (i - 1) * 14, y: groundY(), seed: state.frame + i * 7, age: 0 });
    }
  }

  function handleEvents(): void {
    let played: SoundName | null = null;
    for (const ev of state.events) {
      switch (ev.type) {
        case "hit": {
          spawnSparks(ev.x, ev.y, ev.power);
          flashes.push({ x: ev.x, y: groundY() - ev.y, grade: sparkGradeOf(ev), age: 0 });
          const mv = ev.slot ? charOf(state.fighters[ev.side]).moves[ev.slot] : null;
          if (mv?.knockdown) spawnDust(ev.x);
          played = played ?? "pop";
          break;
        }
        case "throw":
          spawnSparks(ev.x, ev.y, ev.power);
          flashes.push({ x: ev.x, y: groundY() - ev.y, grade: "heavy", age: 0 });
          spawnDust(ev.x);
          played = "jump";
          break;
        case "block":
          // 挡住了：金属亮边 + 一声"当"，跟挨打完全是两种反馈
          spawnSparks(ev.x, ev.y, 3);
          guardFlash[(1 - ev.side) as 0 | 1] = GUARD_FLASH_FRAMES;
          played = played ?? "tap";
          break;
        case "guardbreak":
          // 破防：橙红闪光 + 盾碎三角，跟普通命中一眼分得开
          spawnSparks(ev.x, ev.y, 14);
          flashes.push({ x: ev.x, y: groundY() - ev.y, grade: "break", age: 0 });
          breakFlash[(1 - ev.side) as 0 | 1] = BREAK_FLASH_FRAMES;
          played = "oops";
          break;
        case "super":
          // reduced 不再整段跳过：改成 24 帧的静态卡（不闪、不动，但仪式感还在）
          superCut = superCutDuration(reduced);
          superCutSide = ev.side;
          superCutCharId = state.fighters[ev.side].charId;
          superCutName = ev.slot ? charOf(state.fighters[ev.side]).moves[ev.slot].name : "";
          played = "coin";
          break;
        case "clash":
          spawnSparks(ev.x, ev.y, 8);
          played = played ?? "tap";
          break;
        case "tech":
          played = played ?? "meow";
          break;
        case "ko":
        case "timeup":
          koShake = reduced ? 0 : 16;
          break;
        default:
          break;
      }
    }
    if (played) o.sfx(played);
  }

  function onRoundOver(): void {
    const winner = state.winner;
    if (winner === 0 || winner === 1) wins[winner]++;
    const nameW = winner === -1 ? "" : characterById(winner === 0 ? o.p1 : o.p2).name;
    const done = wins[0] >= o.roundsToWin || wins[1] >= o.roundsToWin;
    if (done) {
      screenPhase = "matchEnd";
      phaseTimer = 110;
      const champ = wins[0] > wins[1] ? 0 : 1;
      const bc = Math.max(bestComboAll[0], bestComboAll[1]);
      bannerBig = `${characterById(champ === 0 ? o.p1 : o.p2).name} 获胜！`;
      bannerSub =
        (champ === 0 ? "干得漂亮，再来一场？" : "对手这次更稳一点，再试试！") +
        (bc >= 2 ? `　本场最大连段 ${bc} 连` : "");
      o.sfx(champ === 0 ? "win" : "oops");
      const me = state.fighters[0];
      later(() => {
        if (!destroyed)
          o.onEnd(champ, {
            vigorLeft: me.vigor,
            maxVigor: me.maxVigor,
            wins: [wins[0], wins[1]],
            bestCombo: bestComboAll[0]
          });
      }, 1300);
      return;
    }
    screenPhase = "roundEnd";
    phaseTimer = 100;
    bannerBig = winner === -1 ? "平局！" : `${nameW} 拿下这回合`;
    bannerSub = `回合比分 ${wins[0]} : ${wins[1]}`;
    o.sfx(winner === 0 ? "win" : "pop");
  }

  function tick(): void {
    if (paused) return;
    for (const side of [0, 1] as const) {
      if (guardFlash[side] > 0) guardFlash[side]--;
      if (breakFlash[side] > 0) breakFlash[side]--;
    }
    if (koShake > 0) koShake--;
    // 超必杀演出期间世界定格；玩家嫌长就连点任意键，`skipSuperCut` 会把它清掉
    if (superCut > 0) {
      superCut--;
      return;
    }
    // 粒子始终在动（哪怕在读条），画面不会冷冷清清
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.22;
      s.life--;
      if (s.life <= 0) sparks.splice(i, 1);
    }
    // 命中火花与扬尘也一样一直在走
    for (let i = flashes.length - 1; i >= 0; i--) {
      flashes[i].age++;
      if (flashes[i].age >= sparkLife(flashes[i].grade)) flashes.splice(i, 1);
    }
    for (let i = dusts.length - 1; i >= 0; i--) {
      dusts[i].age++;
      if (dusts[i].age >= DUST_LIFE) dusts.splice(i, 1);
    }

    if (screenPhase === "ready") {
      phaseTimer--;
      if (phaseTimer === 30) {
        bannerBig = "开始！";
        bannerSub = "";
        o.sfx("tap");
      }
      if (phaseTimer <= 0) {
        screenPhase = "fight";
        bannerBig = "";
        bannerSub = "";
      }
      return;
    }
    if (screenPhase === "roundEnd") {
      phaseTimer--;
      if (phaseTimer <= 0) startNextRound();
      return;
    }
    if (screenPhase === "matchEnd") {
      phaseTimer = Math.max(0, phaseTimer - 1);
      endTick++;
      return;
    }

    stepMatch(state, gatherInputs());
    handleEvents();

    for (const side of [0, 1] as const) {
      const f = state.fighters[side];
      // 残影轨迹：留最近 4 帧的身位
      trails[side].push({ x: f.x, y: f.y, h: charOf(f).height });
      if (trails[side].length > 4) trails[side].shift();
      // 连击弹跳：数字一变就归零重新弹
      if (f.combo !== comboLast[side]) {
        comboLast[side] = f.combo;
        comboAge[side] = 0;
      } else {
        comboAge[side]++;
      }
      bestComboAll[side] = Math.max(bestComboAll[side], f.bestCombo);
    }

    const combo = Math.max(state.fighters[0].combo, state.fighters[1].combo);
    if (combo > lastComboShown && combo >= 3) o.sfx("coin");
    lastComboShown = combo;

    if (state.over) onRoundOver();
  }

  /* ---------------- 绘制 ---------------- */

  // 舞台主题：格斗塔按章节给（两章换一套），其他模式按选人哈希轮换
  const theme = stageThemeOf(o.stageIndex ?? Math.abs(hashString(o.p1 + o.p2)));

  /**
   * 背景视差（远山 22% + 近景 52%，主题化剪影）。
   * 判定还是彻头彻尾的 2D 侧视，这里加的只有"看着有纵深"。
   * 减弱动效时不再整层消失：还是这两层，只是钉在一帧不动（parallaxOffset 恒 0）。
   */
  function drawParallax(ctx: CanvasRenderingContext2D, line: number, camX: number): void {
    drawFarHills(ctx, theme, line, parallaxOffset(camX, PARALLAX.far, reduced), CANVAS_W);
    drawNearProps(ctx, theme, line, parallaxOffset(camX, PARALLAX.near, reduced), CANVAS_W);
  }

  /** 前景轻粒子：花瓣 / 星屑 / 泡泡 / 雪花随主题换色；减弱动效时静止在一帧 */
  function drawPetals(ctx: CanvasRenderingContext2D, H: number, camX: number): void {
    const tick = reduced ? 0 : state.frame;
    const off = parallaxOffset(camX, PARALLAX.petal, reduced);
    ctx.save();
    ctx.fillStyle = theme.petal;
    for (let i = 0; i < 9; i++) {
      const seed = i * 97.3;
      const y = ((tick * (0.5 + (i % 3) * 0.22) + seed * 7) % (H + 60)) - 30;
      const x = ((seed * 11 + off + Math.sin((tick + seed) * 0.02) * 24) % (CANVAS_W + 80)) - 40;
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 4, (tick + seed) * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 姿态四态查表挪去了 art.ts（语义不变），这里只是把引擎状态翻译成入参 */
  function poseOfFighter(f: FighterState): "normal" | "stun" | "down" | "wakeup" {
    return poseOf({ phase: f.phase, stun: f.stun, invuln: f.invuln, free: isFree(f) });
  }

  function drawFighter(ctx: CanvasRenderingContext2D, f: FighterState, other: FighterState): void {
    const ch = charOf(f);
    const look = lookOf(f.charId);
    const line = groundY();
    const pose = poseOfFighter(f);
    const crouch = (f.crouching && !f.airborne) || pose === "wakeup";
    const h = crouch ? ch.crouchHeight : ch.height;
    const hw = ch.halfWidth;
    const feet = line - f.y;
    const down = pose === "down";
    const mv = currentMove(f);
    const ph = mv && f.phase === "attack" ? movePhase(mv, f.frame) : null;
    const winner = state.over && state.winner === f.side;

    // 重招命中帧的残影：几帧前的身位留一个半透明轮廓（reduced 时 alpha 恒 0，不画）
    if (mv && ph === "active" && mv.kind !== "light" && mv.kind !== "throw") {
      const past = trails[f.side][0];
      if (past) {
        drawAfterimage(
          ctx,
          { x: past.x, feet: line - past.y, hw, h: past.h },
          ch.color,
          afterimageAlpha(reduced)
        );
      }
    }

    // 影子：随跳跃高度缩小；两人贴身时影子交叠加深
    ctx.save();
    const shrink = shadowShrink(f.y);
    ctx.fillStyle = `rgba(95,75,130,${shadowAlpha(gapBetween(f, other))})`;
    ctx.beginPath();
    ctx.ellipse(f.x, line + 5, hw * shrink, 6 * shrink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 脚下光环：P1 粉圈 / P2 蓝圈，双人同屏靠它加头顶标记双通道认人
    drawFootRing(ctx, f.x, line + 5, hw, f.side, shrink);

    ctx.save();
    // 刚倒地那几帧画面往上弹一小下（纯画面的小跳，物理一个数没动）
    const bounce = down ? downBounceOffset(f.downFrames, reduced) : 0;
    if (down) {
      // 倒地：整个人躺平（转 84 度），脑袋朝外，纯卡通表现
      ctx.translate(f.x, line - 12 - bounce);
      ctx.rotate((-f.facing * 84 * Math.PI) / 180);
      ctx.translate(-f.x, -(line - 12 - bounce));
    } else if (pose === "wakeup") {
      // 起身：单膝撑地，斜着往回立，和"躺平"一眼分得开
      ctx.translate(f.x, line - 10);
      ctx.rotate((-f.facing * 26 * Math.PI) / 180);
      ctx.translate(-f.x, -(line - 10));
    } else if (pose === "stun") {
      // 眩晕：站着但站不稳，左右晃
      const sway = reduced ? 0 : Math.sin(state.frame * 0.35) * 9;
      ctx.translate(f.x, line);
      ctx.rotate((sway * Math.PI) / 180);
      ctx.translate(-f.x, -line);
    }

    const bodyTop = feet - h;
    const headR = hw * 0.74;
    const shoulderY = bodyTop + headR * 2.15;
    // 躯干只画到胯，剩下的留给两条腿，不然手脚全被身体盖住了
    const hipY = feet - h * (crouch ? 0.16 : 0.28);

    // 判定框贴着地面的招（扫堂腿一类）用腿去够，其余用手
    const kicking = !!mv && mv.box.y + mv.box.h * 0.5 < h * 0.42;
    /**
     * 出招那只手（脚）的落点：
     * 起手往回收，看得出在蓄力；命中帧整只伸到判定框中心；收招再慢慢收回来。
     */
    function swingTip(anchorY: number): { x: number; y: number } | null {
      if (!mv || !ph) return null;
      if (ph === "startup") return { x: f.x - f.facing * hw * 1.1, y: anchorY + h * 0.12 };
      const t = ph === "active" ? 1 : 0.5;
      const tipX = Math.max(hw * 1.3, mv.box.x + mv.box.w * 0.62);
      const tipY = feet - (mv.box.y + mv.box.h * 0.5);
      return { x: f.x + f.facing * tipX * t, y: anchorY + (tipY - anchorY) * t };
    }
    // 走路时腿前后错开；被弹开或倒地就并拢
    const striding = f.phase === "walk" && !f.airborne;
    const stride = striding && !reduced ? Math.sin(state.frame * 0.28) * hw * 0.5 : 0;
    const tuck = f.airborne ? h * 0.14 : 0;

    // 行头几何：art.ts 只认这一份纯数据
    const fr: FighterFrame = {
      x: f.x,
      feet,
      hw,
      h,
      bodyTop,
      hipY,
      shoulderY,
      headX: f.x,
      headY: bodyTop + headR,
      headR,
      facing: f.facing,
      stride,
      airborne: f.airborne,
      crouch,
      tick: state.frame,
      reduced
    };

    ctx.strokeStyle = ch.ink;
    ctx.lineCap = "round";

    // 前肢在朝向对手的那一侧，后肢在另一侧
    const fw = f.facing;
    const kickTip = kicking ? swingTip(hipY) : null;
    const punchTip = kicking ? null : swingTip(shoulderY);

    /** `side` 取 +1 画朝着对手那一侧的手脚，取 -1 画背对的一侧；末端补拳套 / 鞋头亮点 */
    function limbs(side: 1 | -1): void {
      // 获胜姿态：双手举起来欢呼（只在回合定胜负后，纯画面）
      const cheer = winner && !down && pose !== "wakeup";
      const legTip =
        side === 1 && kickTip
          ? kickTip
          : { x: f.x + side * fw * (hw * 0.45 + stride), y: feet - 2 - tuck };
      ctx.strokeStyle = ch.ink;
      ctx.lineWidth = hw * 0.5;
      ctx.beginPath();
      ctx.moveTo(f.x + side * fw * hw * 0.45, hipY);
      ctx.lineTo(legTip.x, legTip.y);
      ctx.stroke();

      const armTip = cheer
        ? { x: f.x + side * fw * hw * 0.95, y: shoulderY - h * 0.3 }
        : side === 1 && punchTip
          ? punchTip
          : side === 1 && f.blocking
            ? { x: f.x + fw * hw * 1.05, y: shoulderY - h * 0.04 }
            : { x: f.x + side * fw * hw * 1.25, y: shoulderY + h * 0.18 };
      ctx.lineWidth = hw * 0.42;
      ctx.beginPath();
      ctx.moveTo(f.x + side * fw * hw * 0.6, shoulderY);
      ctx.lineTo(armTip.x, armTip.y);
      ctx.stroke();

      // 亮色端点：脚尖一粒鞋头、手端一粒拳套
      ctx.fillStyle = look.glove;
      ctx.beginPath();
      ctx.arc(legTip.x, legTip.y, hw * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(armTip.x, armTip.y, hw * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }

    // 背面披挂（披风 / 围巾尾 / 飘带）压在最底下
    drawBackGear(ctx, fr, look);
    limbs(-1);

    // 双色行头躯干 + 腰带 + 描边
    drawHeroBody(ctx, fr, look, ch.ink);
    // 脑袋
    ctx.fillStyle = ch.color;
    ctx.strokeStyle = ch.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(f.x, bodyTop + headR, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 表情五款按状态查表：平常 / 出招咬牙 / 被打中 >< / 眩晕螺旋眼 / 获胜大笑
    drawFace(ctx, f.x, bodyTop + headR, headR, f.facing, faceOf({ pose, phase: f.phase, winner }), ch.ink);
    // 腮红
    const ex = f.x + f.facing * headR * 0.3;
    const ey = bodyTop + headR - headR * 0.12;
    ctx.fillStyle = "rgba(255,150,180,.55)";
    ctx.beginPath();
    ctx.ellipse(ex + f.facing * headR * 0.35, ey + headR * 0.34, headR * 0.22, headR * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    // 正面行头：头饰 + 短裙摆等
    drawHeroLook(ctx, fr, look);

    // 招式：起手一层淡淡的预告，命中帧画出**这一帧真正生效的那个框**（会随帧长大）
    if (mv && ph && ph !== "recovery") {
      const box = ph === "active" ? activeBoxAt(mv, f.frame) : mv.box;
      const bx = f.facing === 1 ? f.x + box.x : f.x - box.x - box.w;
      const by = feet - box.y - box.h;
      const r = Math.min(box.w, box.h) * 0.42;
      ctx.save();
      if (ph === "active") {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = mv.kind === "super" ? "rgba(255,214,240,.95)" : ch.color;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        roundRect(ctx, bx, by, box.w, box.h, r);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = ch.ink;
        roundRect(ctx, bx, by, box.w, box.h, r);
        ctx.fill();
      }
      ctx.restore();
    }

    // 出招的那只手脚压在判定框上面，看得清是谁伸出去的
    ctx.strokeStyle = ch.ink;
    limbs(1);
    ctx.restore();

    // 头顶标记：P1 小花 / P2 小星（替代原来的名牌 emoji，形状 + 颜色双通道）
    drawSideMarker(ctx, f.x, bodyTop - 14, f.side, state.frame, reduced);

    // 格挡：亮一层小护罩
    if (f.blocking && f.phase !== "attack") {
      ctx.save();
      ctx.strokeStyle = "rgba(120,190,255,.9)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(f.x + f.facing * hw * 0.6, feet - h * 0.55, h * 0.52, -Math.PI / 2, Math.PI / 2, f.facing === -1);
      ctx.stroke();
      ctx.restore();
    }

    // 挡下来那一瞬间：护罩外面再镶一圈金属亮边，"当"的一下弹开
    if (guardFlash[f.side] > 0) {
      const k = guardFlash[f.side] / GUARD_FLASH_FRAMES;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k + 0.25);
      ctx.strokeStyle = "#fff6d0";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(f.x + f.facing * hw * 0.6, feet - h * 0.55, h * 0.58 + (1 - k) * 10, -Math.PI / 2, Math.PI / 2, f.facing === -1);
      ctx.stroke();
      ctx.strokeStyle = "#e8b93a";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // 破防：换一个完全不同的颜色，整个人罩一层橙红，一眼看得出"这次不一样"
    if (breakFlash[f.side] > 0) {
      const k = breakFlash[f.side] / BREAK_FLASH_FRAMES;
      ctx.save();
      ctx.globalAlpha = 0.18 + k * 0.42;
      ctx.fillStyle = "#ff8a4c";
      roundRect(ctx, f.x - hw - 8, feet - h - 12, hw * 2 + 16, h + 18, hw * 0.6);
      ctx.fill();
      ctx.restore();
    }

    // 头顶转圈的小星星：眩晕转三颗，倒地只有两颗，起身就没有了（画的星形，不是字符）
    const stars = pose === "stun" ? 3 : pose === "down" ? 2 : 0;
    if (stars > 0) {
      const t = reduced ? 0 : state.frame * 0.12;
      for (let i = 0; i < stars; i++) {
        const a = t + (i * Math.PI * 2) / stars;
        drawStarShape(ctx, f.x + Math.cos(a) * 18, line - h * 0.9 + Math.sin(a) * 6, 6, "#ffd45e", a);
      }
    }
  }

  /**
   * 镜头：跟着两个人走，贴身时拉近、拉开时推远。
   * 不这么做的话，900 宽的场地铺满屏幕，两个小朋友会小得看不清脸。
   * 缩放以地平线为轴，所以地面永远在同一条线上，不会上下乱跳。
   */
  let camScale = 0;
  let camPan = 0;

  function camera(): { scale: number; camX: number } {
    const [a, b] = state.fighters;
    const spread = Math.abs(a.x - b.x) + 250;
    const wide = Math.max(CANVAS_W / 2.9, Math.min(CANVAS_W, spread));
    // 有人跳起来就自动拉远一点，免得脑袋顶出画面外
    const topNeeded = Math.max(
      150,
      ...state.fighters.map((f) => f.y + charOf(f).height + 40)
    );
    const scale = Math.min(CANVAS_W / wide, (groundY() - 14) / topNeeded, 2.9);
    const viewW = CANVAS_W / scale;
    const mid = (a.x + b.x) / 2;
    const camX = Math.max(0, Math.min(Math.max(0, STAGE_WIDTH - viewW), mid - viewW / 2));
    // 慢慢追上目标值，跳跃和击退时镜头才不会一跳一跳的
    if (camScale === 0) {
      camScale = scale;
      camPan = camX;
    } else {
      camScale += (scale - camScale) * 0.12;
      camPan += (camX - camPan) * 0.16;
    }
    return { scale: camScale, camX: camPan };
  }

  function draw(): void {
    if (!g) return;
    syncLayout();
    fitStage();
    const H = canvas.height;
    const line = groundY();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, CANVAS_W, H);

    // 命中震屏 + KO 那一下的额外震屏（引擎照常推进，只震画面）；reduced 恒 0
    const shake = reduced ? 0 : Math.max(state.shake, koShake > 0 ? koShake * 0.55 : 0);
    if (shake > 0) {
      g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // 四层视差之一：远天（主题渐变 + 天体 / 云 / 星）
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, theme.skyTop);
    sky.addColorStop(1, theme.skyBottom);
    g.fillStyle = sky;
    g.fillRect(-20, -20, CANVAS_W + 40, H + 40);
    const cam = camera();
    drawSkyDecor(g, theme, CANVAS_W, H, parallaxOffset(cam.camX, PARALLAX.sky, reduced), reduced ? 0 : state.frame);
    // 远山 + 近景两层剪影
    drawParallax(g, line, cam.camX);
    // 地面纵深：三条横向色带（远暗近亮）+ 中线
    drawGroundBands(g, theme, line, CANVAS_W, H);

    g.save();
    g.translate(0, line);
    g.scale(cam.scale, cam.scale);
    g.translate(-cam.camX, -line);

    // 扬尘垫在人物脚下
    for (const d of dusts) {
      drawDustPuff(g, d.x, d.y, d.seed, d.age / DUST_LIFE);
    }

    drawFighter(g, state.fighters[0], state.fighters[1]);
    drawFighter(g, state.fighters[1], state.fighters[0]);

    for (const s of sparks) {
      g.save();
      g.globalAlpha = Math.max(0, s.life / s.maxLife);
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // 分级命中火花压在星星粒子上面
    for (const fl of flashes) {
      hitSpark(g, fl.x, fl.y, fl.grade, fl.age / sparkLife(fl.grade));
    }
    g.restore();

    drawPetals(g, H, cam.camX);

    // 连击弹跳数字：≥3 连击在自己那侧的屏幕角弹一下
    for (const side of [0, 1] as const) {
      const f = state.fighters[side];
      if (comboPopVisible(f.combo)) {
        const x = side === 0 ? 64 : CANVAS_W - 64;
        drawComboPop(g, x, 100, f.combo, comboPopScale(comboAge[side], reduced), side);
      }
    }

    // 定出胜负：彩带 20 片（reduced 静止铺满，不消失）
    if (screenPhase === "matchEnd") {
      drawConfetti(g, CANVAS_W, H, endTick, reduced);
    }

    if (superCut > 0) drawSuperCut(g, H);

    g.setTransform(1, 0, 0, 1, 0, 0);
    updateHud();
  }

  /**
   * 超必杀 cut-in：主题色竖条底 + 斜向速度线 12 根 + 角色特写 + 招式名，
   * 入场 0.1 秒白闪一次；最多 72 帧（1.2 秒），连点任意键立刻跳过。
   * 减弱动效时是一张 0.4 秒的静态卡：不闪、速度线不画，仪式感保住。
   */
  function drawSuperCut(ctx: CanvasRenderingContext2D, H: number): void {
    const total = superCutDuration(reduced);
    const t = 1 - superCut / total;
    ctx.save();
    drawCutInBands(ctx, CANVAS_W, H, superCutSide, theme);
    if (!reduced) drawSpeedLines(ctx, CANVAS_W, H, superCutSide, t);
    // 角色特写：放大版脑袋，出招表情
    const cch = characterById(superCutCharId);
    const cx = superCutSide === 0 ? CANVAS_W * 0.28 : CANVAS_W * 0.72;
    const cy = H * 0.42;
    drawCutInCloseUp(ctx, cx, cy, 64, lookOf(cch.id), cch.color, cch.ink, superCutSide === 0 ? 1 : -1);
    ctx.globalAlpha = 1;
    ctx.font = "900 40px system-ui";
    ctx.textAlign = "center";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#c8497f";
    const ty = H * 0.68;
    ctx.strokeText(superCutName, CANVAS_W / 2, ty);
    ctx.fillText(superCutName, CANVAS_W / 2, ty);
    ctx.font = "700 16px system-ui";
    ctx.fillStyle = "#7b6aa0";
    ctx.fillText("连点任意键可以跳过", CANVAS_W / 2, ty + 34);
    // 入场白闪（≤ 0.1 秒只闪一次；reduced 恒 0）
    const flash = superFlashAlpha(total - superCut, reduced);
    if (flash > 0) {
      ctx.globalAlpha = flash;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_W, H);
    }
    ctx.restore();
  }

  const nameEls = [hud.querySelector('[data-n="0"]'), hud.querySelector('[data-n="1"]')] as HTMLElement[];
  const vigEls = [hud.querySelector('[data-v="0"]'), hud.querySelector('[data-v="1"]')] as HTMLElement[];
  const pipEls = [hud.querySelector('[data-p="0"]'), hud.querySelector('[data-p="1"]')] as HTMLCanvasElement[];
  const avaEls = [hud.querySelector('[data-a="0"]'), hud.querySelector('[data-a="1"]')] as HTMLCanvasElement[];
  const mtrEls = [hud.querySelector('[data-m="0"]'), hud.querySelector('[data-m="1"]')] as HTMLElement[];
  const comboEls = [hud.querySelector('[data-c="0"]'), hud.querySelector('[data-c="1"]')] as HTMLElement[];
  const clockEl = hud.querySelector("[data-clock]") as HTMLElement;
  const roundEl = hud.querySelector("[data-round]") as HTMLElement;

  // 元气条端头的小头像：一次画好就不再重绘（复用脑袋 + 头饰画法）
  for (const side of [0, 1] as const) {
    const ch = characterById(side === 0 ? o.p1 : o.p2);
    const actx = avaEls[side]?.getContext?.("2d");
    if (actx) drawAvatar(actx, 24, lookOf(ch.id), ch.color, ch.ink);
  }

  /** 回合星只在数字变了才重画 */
  const lastPips: [number, number] = [-1, -1];

  function updateHud(): void {
    // 窄屏名字太长会把元气条挤歪，所以先按屏宽定一个字数上限
    const nameMax = narrowLayout ? 3 : 4;
    for (const side of [0, 1] as const) {
      const f = state.fighters[side];
      const ch = charOf(f);
      const ratio = vigorRatio(f);
      nameEls[side].textContent = shortName(ch.name, nameMax);
      nameEls[side].title = ch.name;
      const inner = vigEls[side].firstElementChild as HTMLElement;
      inner.style.width = `${Math.round(ratio * 100)}%`;
      vigEls[side].classList.toggle("fk-vig-low", ratio <= 0.3);
      const mi = mtrEls[side].firstElementChild as HTMLElement;
      mi.style.width = `${Math.round(meterRatio(f) * 100)}%`;
      mtrEls[side].classList.toggle("fk-mtr-full", superReady(f));
      // 满槽流光：每帧推一下斜纹底的相位；reduced 恒 0 = 静态金框
      mi.style.backgroundPosition = superReady(f) ? `${shimmerOffset(state.frame, reduced)}px 0` : "";
      // 回合星：画的星形（赢一回合点亮一颗），不再用字符
      if (lastPips[side] !== wins[side]) {
        lastPips[side] = wins[side];
        const pctx = pipEls[side]?.getContext?.("2d");
        if (pctx) drawRoundPips(pctx, 64, 16, wins[side], o.roundsToWin, side === 1);
      }
      // 连段计数是 HUD 里的一行 DOM，不画在画布上，绝不会被元气条压住
      comboEls[side].textContent = f.combo >= 2 ? `${f.combo} 连击！` : "";
      superBtns[side]?.classList.toggle("fk-padbtn-ready", superReady(f));
      if (superBtns[side]) superBtns[side]!.textContent = superReady(f) ? "超必杀" : "必杀";
    }
    clockEl.textContent = o.training ? "∞" : String(Math.ceil(state.timeLeft / 60));
    roundEl.textContent = o.training ? "训练" : `第 ${roundIndex + 1} 回合`;
    bannerBigEl.textContent = bannerBig;
    bannerSubEl.textContent = bannerSub;
    if (o.training) updateTrainLive();
  }

  function updateTrainLive(): void {
    const me = state.fighters[0];
    const ch = charOf(me);
    const readout = frameReadout(ch, me.phase === "attack" ? me.slot : null, me.frame, {
      ...emptyContext(),
      hitDone: me.hitDone,
      used: me.comboUsed,
      hits: me.combo,
      meter: me.meter,
      airborne: me.airborne
    });
    const lines = readoutLines(readout, me.combo, me.bestCombo, gapBetween(me, state.fighters[1]));
    const extra = `能量 <b>${Math.round(me.meter)}</b> / 100　格挡槽 <b>${Math.round(me.guard)}</b> / ${me.guardMax}`;
    trainLive.innerHTML = [...lines.map((s) => `<div>${escapeHtml(s)}</div>`), `<div>${extra}</div>`].join("");
  }

  /* ---------------- 主循环 ---------------- */

  let last = 0;
  let acc = 0;
  function loop(now: number): void {
    if (destroyed) return;
    raf = requestAnimationFrame(loop);
    if (!last) last = now;
    const dt = Math.min(120, now - last);
    last = now;
    acc += dt;
    let guard = 0;
    while (acc >= FRAME_MS && guard < 6) {
      acc -= FRAME_MS;
      guard++;
      tick();
    }
    draw();
  }
  raf = requestAnimationFrame(loop);
  draw();

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      for (const id of timers) clearTimeout(id);
      timers.clear();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      stage.removeEventListener("pointerdown", onStageTap);
      for (const fn of padCleanups) fn();
      padCleanups.length = 0;
      pressed.clear();
      wrap.remove();
    }
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** 训练模式的帧数据表 */
function frameTable(ch: Character): HTMLElement {
  const table = el("table", "fk-fd");
  const head = el("thead");
  head.innerHTML =
    "<tr><th>招式</th><th>起手</th><th>命中</th><th>收招</th><th>威力</th><th>挡下</th><th>命中后</th></tr>";
  const body = el("tbody");
  for (const slot of MOVE_SLOTS) {
    const mv: Move = ch.moves[slot];
    const tr = el("tr");
    const adv = onBlockAdvantage(mv);
    const advHit = onHitAdvantage(mv);
    tr.innerHTML = `
      <td class="fk-fd-n">${mv.name}</td>
      <td>${mv.startup}</td>
      <td>${mv.active}</td>
      <td>${mv.recovery}</td>
      <td>${mv.power}</td>
      <td class="${adv >= 0 ? "fk-fd-plus" : "fk-fd-minus"}">${adv >= 0 ? "+" : ""}${adv}</td>
      <td class="${advHit >= 0 ? "fk-fd-plus" : "fk-fd-minus"}">${advHit >= 0 ? "+" : ""}${advHit}</td>`;
    body.appendChild(tr);
  }
  table.append(head, body);
  return table;
}

/* ------------------------------------------------------------------ */
/* 挂载：菜单 → 选人 → 开打                                            */
/* ------------------------------------------------------------------ */

type Mode = "versus" | "cpu" | "tower" | "endless" | "training";

const MODE_CARDS: Array<{ mode: Mode; emoji: string; title: string; desc: string }> = [
  { mode: "versus", emoji: "🥊", title: "双人对战", desc: "同屏两套键位，朵朵 WASD+F/G，星星 方向键+L/K" },
  { mode: "cpu", emoji: "🤖", title: "人机对战", desc: "AI 五档：轻松 / 普通 / 灵巧 / 老练 / 高手，每一档新学会一样本事" },
  { mode: "tower", emoji: "🏯", title: "格斗塔 188 关", desc: "八层八位守擂者，越往上对手越会打（不是越耐打）" },
  { mode: "endless", emoji: "🔥", title: "无尽连胜", desc: "一场接一场，最长连胜会记进你的成绩单" },
  { mode: "training", emoji: "🎓", title: "训练场", desc: "元气不掉；假人可选站立 / 蹲防 / 随机反击，帧数与可取消路线全都写在屏幕上" }
];

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;

  const root = el("div", "fk-root");
  const style = el("style");
  style.textContent = CSS;
  root.appendChild(style);
  const view = el("div");
  root.appendChild(view);
  api.root.appendChild(root);

  let screenCleanup: (() => void) | null = null;

  function clearScreen(): void {
    try {
      screenCleanup?.();
    } catch (err) {
      console.warn(`[一朵一星] ${meta.id} 场景清理出错:`, err);
    }
    screenCleanup = null;
    view.innerHTML = "";
  }

  function sfx(name: SoundName): void {
    if (!destroyed) api.play(name);
  }

  /* ---------------- 首页菜单 ---------------- */

  function showMenu(): void {
    clearScreen();
    const card = el("div", "fk-card");
    card.appendChild(el("div", "fk-h", "🥋 朵星格斗王"));
    card.appendChild(
      el(
        "div",
        "fk-sub",
        "八位小伙伴同台切磋。招式都是花瓣、星光、云朵和豆芽，被打中只会星星飞溅、转两圈、被弹开，条子上写的是「元气」，掉光就换人休息。"
      )
    );
    const modes = el("div", "fk-modes");
    modes.style.marginTop = "10px";
    for (const m of MODE_CARDS) {
      const b = button("fk-mode", "", () => {
        sfx("tap");
        if (m.mode === "tower") showTower();
        else showSelect(m.mode);
      });
      // 模式图标画制(visual-r2 修遗留#5):emoji 换 SVG 小图标,与画制头像同屏零代差
      b.innerHTML = `<span class="fk-mode-emoji">${modeIconSVG(m.mode)}</span>
        <span><span class="fk-mode-t">${m.title}</span><span class="fk-mode-d">${m.desc}</span></span>`;
      modes.appendChild(b);
    }
    card.appendChild(modes);
    view.appendChild(card);

    const help = el("div", "fk-card");
    help.appendChild(el("div", "fk-h", "🎮 键位"));
    const list = el("div", "fk-sub");
    list.innerHTML = keyHintLines()
      .map((s) => `<div>${s}</div>`)
      .join("");
    help.appendChild(list);
    view.appendChild(help);
  }

  /* ---------------- 选人 ---------------- */

  function showSelect(mode: Exclude<Mode, "tower">): void {
    clearScreen();
    let p1 = CHARACTERS[0].id;
    let p2 = CHARACTERS[1].id;
    let ai: AiLevel = 1;
    let dummy: DummyMode = "stand";

    const card = el("div", "fk-card fk-select-shell");
    const bar = el("div", "fk-bar");
    bar.appendChild(
      button("fk-btn", "◀ 返回", () => {
        sfx("tap");
        showMenu();
      })
    );
    const modeCard = MODE_CARDS.find((m) => m.mode === mode);
    // 标题图标画制(visual-r2 修遗留#5):与模式卡同一枚 SVG,不再 emoji 前缀
    const modeH = el("span", "fk-h");
    modeH.innerHTML = `${modeIconSVG(mode, 20)}<span> ${escapeHtml(modeCard?.title ?? "")}</span>`;
    bar.appendChild(modeH);
    card.appendChild(bar);

    const picks = el("div", "fk-picks");
    const leftInfo = el("div", "fk-info");
    const rightInfo = el("div", "fk-info");

    function pickerFor(
      title: string,
      get: () => string,
      set: (id: string) => void,
      info: HTMLElement
    ): HTMLElement {
      const box = el("div", "fk-pick");
      box.appendChild(el("div", "fk-pick-t", title));
      const grid = el("div", "fk-grid");
      const buttons: HTMLButtonElement[] = [];
      for (const ch of CHARACTERS) {
        const b = el("button", "fk-ch");
        b.type = "button";
        b.appendChild(chAvatar(ch, 28));
        b.appendChild(el("span", "fk-ch-n", ch.name));
        b.setAttribute("aria-label", `选择 ${ch.name}：${ch.style}`);
        b.addEventListener("click", () => {
          set(ch.id);
          sfx("pop");
          refresh();
        });
        buttons.push(b);
        grid.appendChild(b);
      }
      box.appendChild(grid);
      box.appendChild(info);
      const refresh = (): void => {
        const cur = get();
        CHARACTERS.forEach((ch, i) => buttons[i].classList.toggle("fk-ch-on", ch.id === cur));
        const ch = characterById(cur);
        info.innerHTML = `<b>${ch.name}</b>　${ch.blurb}<br>${ch.style}<br>
          必杀：${(["s1", "s2", "s3"] as const).map((s) => ch.moves[s].name).join(" / ")}　
          超必杀：<b>${ch.moves.super.name}</b>`;
      };
      refresh();
      return box;
    }

    picks.appendChild(
      pickerFor(
        mode === "versus" ? "🌸 1 号位（WASD + F/G）" : "🌸 你（WASD + F/G）",
        () => p1,
        (id) => {
          p1 = id;
        },
        leftInfo
      )
    );
    picks.appendChild(
      pickerFor(
        mode === "versus"
          ? "⭐ 2 号位（方向键 + L/K）"
          : mode === "training"
            ? "🎓 陪练"
            : mode === "endless"
              ? "🔥 第一位对手"
              : "🤖 对手",
        () => p2,
        (id) => {
          p2 = id;
        },
        rightInfo
      )
    );
    card.appendChild(picks);

    if (mode === "cpu" || mode === "endless") {
      const row = el("div", "fk-bar");
      row.style.marginTop = "10px";
      row.appendChild(el("span", "fk-sub", "对手强度："));
      const btns: HTMLButtonElement[] = [];
      AI_LEVELS.forEach((lv) => {
        const b = button("fk-btn", AI_LABELS[lv], () => {
          ai = lv;
          sfx("tap");
          btns.forEach((x, i) => x.classList.toggle("fk-ch-on", i === lv));
          hint.textContent = AI_HINTS[lv];
        });
        b.setAttribute("aria-label", `对手强度 ${AI_LABELS[lv]}：${AI_HINTS[lv]}`);
        btns.push(b);
        row.appendChild(b);
      });
      btns[ai].classList.add("fk-ch-on");
      const hint = el("div", "fk-sub", AI_HINTS[ai]);
      card.appendChild(row);
      card.appendChild(hint);
    }

    if (mode === "training") {
      const row = el("div", "fk-bar");
      row.style.marginTop = "10px";
      row.appendChild(el("span", "fk-sub", "假人行为："));
      const btns: HTMLButtonElement[] = [];
      DUMMY_MODES.forEach((m, i) => {
        const b = button("fk-btn", DUMMY_LABELS[m], () => {
          dummy = m;
          sfx("tap");
          btns.forEach((x, j) => x.classList.toggle("fk-ch-on", i === j));
          hint.textContent = DUMMY_HINTS[m];
        });
        b.setAttribute("aria-label", `假人行为 ${DUMMY_LABELS[m]}：${DUMMY_HINTS[m]}`);
        btns.push(b);
        row.appendChild(b);
      });
      btns[DUMMY_MODES.indexOf(dummy)].classList.add("fk-ch-on");
      const hint = el("div", "fk-sub", DUMMY_HINTS[dummy]);
      const goRow = el("div", "fk-bar fk-bar-go");
      goRow.style.marginTop = "8px";
      goRow.appendChild(
        button("fk-btn fk-btn-go", "开打 ▶", () => {
          sfx("jump");
          startPlain(mode, p1, p2, ai, dummy);
        })
      );
      const foot = el("div", "fk-select-foot");
      foot.append(row, hint, goRow);
      card.appendChild(foot);
      view.appendChild(card);
      return;
    }

    if (mode === "endless") {
      const badge = el("div", "fk-sub", streakBadge(bestStreak()));
      badge.style.marginTop = "8px";
      card.appendChild(badge);
    }

    const goRow = el("div", "fk-bar fk-bar-go");
    goRow.style.marginTop = "12px";
    goRow.appendChild(
      button("fk-btn fk-btn-go", "开打 ▶", () => {
        sfx("jump");
        if (mode === "endless") startEndless(p1, p2, ai, 0);
        else startPlain(mode, p1, p2, ai, dummy);
      })
    );
    card.appendChild(goRow);
    view.appendChild(card);
  }

  /* ---------------- 双人 / 人机 / 训练 ---------------- */

  function startPlain(
    mode: "versus" | "cpu" | "training",
    p1: string,
    p2: string,
    ai: AiLevel,
    dummy: DummyMode
  ): void {
    clearScreen();
    const host = el("div");
    view.appendChild(host);
    const fight = createFight(host, {
      p1,
      p2,
      // 训练场的 2 号位交给假人，不走 AI
      aiLevel: mode === "versus" || mode === "training" ? null : ai,
      buffs: [noBuff(), noBuff()],
      roundsToWin: mode === "training" ? 1 : 2,
      timeLimitSec: 75,
      training: mode === "training",
      dummy,
      title:
        mode === "versus"
          ? "🥊 双人对战 · 先赢 2 回合"
          : mode === "cpu"
            ? `🤖 人机对战 · ${AI_LABELS[ai]}档`
            : "🎓 训练场",
      sfx,
      onQuit: () => {
        sfx("tap");
        showMenu();
      },
      extraButtons: [
        {
          label: "🔁 换人",
          onClick: () => {
            sfx("tap");
            showSelect(mode);
          }
        }
      ],
      onEnd: (winner, info) => {
        if (mode === "cpu" && winner === 0) api.addStars(1);
        // 结算卡带上本场最大连段（≥2 才值得一提）
        const comboNote = info.bestCombo >= 2 ? `　你打出了 ${info.bestCombo} 连段！` : "";
        showResult(
          (winner === 0 ? "赢啦！" : "元气用完啦，休息一下再来！") + comboNote,
          () => startPlain(mode, p1, p2, ai, dummy),
          () => showSelect(mode)
        );
      }
    });
    screenCleanup = () => fight.destroy();
  }

  /* ---------------- 无尽 ---------------- */

  function startEndless(p1: string, firstFoe: string, startAi: AiLevel, streak: number): void {
    clearScreen();
    const host = el("div");
    view.appendChild(host);
    const foe = streak === 0 ? firstFoe : endlessFoeId(streak);
    // 连胜越多档位越高；玩家自己挑的起手档位是地板，不会越打越轻松
    const level = Math.max(startAi, endlessAiLevel(streak)) as AiLevel;
    const fight = createFight(host, {
      p1,
      p2: foe,
      aiLevel: level,
      buffs: [noBuff(), endlessBuff(streak)],
      roundsToWin: 1,
      timeLimitSec: 70,
      training: false,
      title: `🔥 无尽连胜 · 已连赢 ${streak} 场 · ${AI_LABELS[level]}档`,
      sfx,
      onQuit: () => {
        sfx("tap");
        // 中途退出也算成绩，别让打了半天的连胜白费
        recordStreak(streak);
        showMenu();
      },
      onEnd: (winner) => {
        if (winner === 0) {
          const next = streak + 1;
          api.addStars(1);
          recordStreak(next);
          startEndless(p1, firstFoe, startAi, next);
          return;
        }
        const reward = endlessStarReward(streak);
        if (reward > 0) api.addStars(reward);
        const best = recordStreak(streak);
        showResult(
          `${endlessEndText(streak)}　${streakBadge(best)}`,
          () => startEndless(p1, firstFoe, startAi, 0),
          () => showSelect("endless")
        );
      }
    });
    screenCleanup = () => fight.destroy();
  }

  /* ---------------- 结算小页 ---------------- */

  function showResult(text: string, again: () => void, back: () => void): void {
    clearScreen();
    const card = el("div", "fk-card");
    card.appendChild(el("div", "fk-h", "🏁 打完啦"));
    card.appendChild(el("div", "fk-sub", text));
    const row = el("div", "fk-bar");
    row.style.marginTop = "12px";
    row.appendChild(
      button("fk-btn fk-btn-go", "🔁 再来一场", () => {
        sfx("tap");
        again();
      })
    );
    row.appendChild(
      button("fk-btn", "🔧 换个人", () => {
        sfx("tap");
        back();
      })
    );
    row.appendChild(
      button("fk-btn", "🏠 回菜单", () => {
        sfx("tap");
        showMenu();
      })
    );
    card.appendChild(row);
    view.appendChild(card);
  }

  /* ---------------- 格斗塔 188 关 ---------------- */

  /** `openAt` 是 0 基关号，给了就替玩家把那一层点开（锁着的层会停在能玩的最远那层） */
  function showTower(openAt = -1): void {
    clearScreen();
    const bar = el("div", "fk-bar");
    bar.appendChild(
      button("fk-btn", "◀ 返回菜单", () => {
        sfx("tap");
        showMenu();
      })
    );
    bar.appendChild(el("span", "fk-h", "🏯 格斗塔 188 关"));
    view.appendChild(bar);

    const towerHost = el("div");
    view.appendChild(towerHost);

    // 塔里默认派 TOWER_HERO_ID 上场（见那条常量的注释）；上面这一排随时能换人
    let heroId: string = TOWER_HERO_ID;
    const heroRow = el("div", "fk-card fk-tower-hero");
    heroRow.appendChild(el("div", "fk-pick-t", "出战角色（随时可以换，换完从当前关继续）"));
    const compact = el("div", "fk-tower-compact");
    const compactNow = el("span", "fk-tower-now");
    const refreshCompact = (): void => {
      compactNow.textContent = `当前出战：${characterById(heroId).name}`;
    };
    const swapBtn = button("fk-btn", "换人 ▾", () => {
      const open = heroRow.classList.toggle("fk-tower-open");
      swapBtn.textContent = open ? "收起 ▴" : "换人 ▾";
      sfx("tap");
    });
    compact.append(compactNow, swapBtn);
    heroRow.appendChild(compact);
    const grid = el("div", "fk-grid");
    const heroBtns: HTMLButtonElement[] = [];
    CHARACTERS.forEach((ch, i) => {
      const b = el("button", "fk-ch");
      b.type = "button";
      b.appendChild(chAvatar(ch, 28));
      b.appendChild(el("span", "fk-ch-n", ch.name));
      b.setAttribute("aria-label", `出战角色 ${ch.name}：${ch.style}`);
      b.addEventListener("click", () => {
        heroId = ch.id;
        sfx("pop");
        heroBtns.forEach((x, j) => x.classList.toggle("fk-ch-on", i === j));
        swapTip.textContent = "";
        refreshCompact();
      });
      heroBtns.push(b);
      grid.appendChild(b);
    });
    heroBtns[Math.max(0, CHARACTERS.findIndex((c) => c.id === TOWER_HERO_ID))].classList.add("fk-ch-on");
    refreshCompact();
    heroRow.appendChild(grid);
    // 连着几场没赢下来就在这儿提一句「换个小伙伴试试」，平时是空的
    const swapTip = el("div", "fk-swap");
    heroRow.appendChild(swapTip);
    view.insertBefore(heroRow, towerHost);

    let currentFight: FightHandle | null = null;
    /** 同一关连着几场没赢下来 */
    let lossStreak = 0;
    let streakAt = -1;

    const tower = mountLevelGame(
      { ...api, root: towerHost },
      {
        id: meta.id,
        chapters: CHAPTERS,
        mapHint: "每一层的守擂者都在最后一关等你，赢得越轻松星星越多。",
        guide,
        guideTitle: "格斗塔小攻略",
        grandMessage: "188 关全部打完，格斗塔的塔顶归你啦！",
        playLevel: (stageEl: HTMLElement, ctx: PlayCtx) => {
          const stage = towerStage(ctx.level);
          const hint = el("div", "fk-sub");
          hint.style.marginBottom = "8px";
          hint.textContent = `${stage.boss ? "👑 守擂者：" : "对手："}${characterById(stage.foeId).name} · ${AI_LABELS[stage.aiLevel]}档　${stage.hint}`;
          stageEl.appendChild(hint);
          const host = el("div");
          stageEl.appendChild(host);
          currentFight?.destroy();
          currentFight = createFight(host, {
            p1: heroId,
            p2: stage.foeId,
            aiLevel: stage.aiLevel,
            buffs: [noBuff(), stage.foeBuff],
            roundsToWin: stage.roundsToWin,
            timeLimitSec: stage.timeLimitSec,
            training: false,
            // 舞台主题按章节分段：每两章换一套（樱花山道 → 星空擂台 → 海边木台 → 雪夜灯笼）
            stageIndex: Math.floor(stage.chapterIndex / 2),
            title: `🏯 第 ${ctx.level + 1} 关${stage.boss ? " · 守擂者" : ""}`,
            sfx: (n) => ctx.sfx(n),
            onEnd: (winner, info) => {
              if (winner === 0) {
                lossStreak = 0;
                swapTip.textContent = "";
                ctx.win(rateByVigor(info.vigorLeft, info.maxVigor));
                return;
              }
              if (streakAt !== ctx.level) {
                streakAt = ctx.level;
                lossStreak = 0;
              }
              lossStreak += 1;
              if (lossStreak >= SWAP_HINT_AFTER) {
                swapTip.textContent = SWAP_HINT_TEXT;
                ctx.lose(SWAP_HINT_TEXT);
                return;
              }
              ctx.lose("这一层的对手挺有一套，换个节奏再来！");
            }
          });
          return {
            destroy: () => {
              currentFight?.destroy();
              currentFight = null;
            }
          };
        }
      }
    );

    screenCleanup = () => {
      currentFight?.destroy();
      currentFight = null;
      tower.destroy();
    };

    if (openAt >= 0) openCampaignLevel(towerHost, openAt);
  }

  // 壳层给了 initialLevel、或者地址栏 / hash 里带着 level=N，就直接开那一层，不停在菜单
  const hints = locationHints();
  const wanted = initialLevelOf(
    (api as unknown as { initialLevel?: number }).initialLevel,
    hints.search,
    hints.hash
  );
  if (wanted >= 0) showTower(wanted);
  else showMenu();

  return {
    destroy() {
      destroyed = true;
      clearScreen();
      root.remove();
    }
  };
}

/** 给壳层用：直接开打格斗塔第 n 层（1 基），越界 clamp */
export function openLevel(host: HTMLElement, n: number): boolean {
  return openCampaignLevel(host, Math.max(0, Math.round(n) - 1));
}
