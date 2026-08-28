import { meta } from "./meta";
export { meta };

import {
  furthestPlayable,
  loadSkips,
  loadStars,
  mountLevelGame,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
  type SoundName,
} from "../level99";
import { save } from "../../engine/save";
import {
  CHAPTERS,
  MISSION_INFO,
  TOTAL,
  buildCoop,
  buildEndless,
  buildLevel,
  chapterIndexOf,
  type LevelDef,
} from "./levels";
import { BINS, binInfo, hygieneTip, trashById } from "./trash";
import {
  HUD_BTN_MIN_H,
  HUD_BTN_MIN_W,
  createDisposer,
  padMetrics,
  canvasRoomPx,
  showPad,
  stageRoomPx,
  wrapRoomPx,
  parseLevelParam,
  resolveInitialLevel,
} from "./runtime";
import {
  BEAM_BOTTOM,
  BEAM_TOP,
  CART_H,
  CART_W,
  CROUCH_H,
  JUNK_R,
  MONSTER_H,
  MONSTER_W,
  PLAYER_H,
  PLAYER_W,
  cartLeft,
  cleanRatio,
  coopMessage,
  coopProgress,
  coopStars,
  createWorld,
  doorOpen,
  drainEvents,
  emptyInput,
  isPauseKey,
  keyToAction,
  remainingForDoor,
  starsForRun,
  stepWorld,
  summarize,
  winMessage,
  type Input,
  type InputName,
  type World,
  type WorldEvent,
} from "./logic";
// 视觉层只读这两个窗口常量画残影,一个数值都不回写
import { SWEEP_TIME } from "./tuning";
import { blendCape, capeMode, type CapeMode } from "../../art/kit/cape";
import { traceStar } from "../../art/kit/sparkle";
// 自绘道具小画坊(R1 修复):香香星 / 18 款垃圾条目 / 分类桶图标 / 场内小装饰与粒子字形,
// 全部顶替裸 emoji,画布做到零 emoji 直出
import {
  drawBinIcon,
  drawBubbleDot,
  drawMiniStar,
  drawPadlock,
  drawParticleGlyph,
  drawScentStar,
  drawSoap,
  drawSponge,
  drawSwirl,
  drawThinkBubble,
  drawTrashItem,
  type ParticleGlyph,
} from "./trashArt";
import {
  BEAN_COLORS,
  FLOWER_STYLES,
  HERO_VIS,
  PH_ANIM,
  PH_TOKENS,
  PhFx,
  badgePulse,
  bloomFrame,
  breathOffset,
  broomTrailAlpha,
  drawFlower,
  easeOutQuad,
  heroPose,
  legFrame,
  poseLean,
  sceneTheme,
  shade,
  showDetail,
  trailAlpha,
} from "./visual";

// ---------------------------------------------------------------------------
// 配色:一章一套粉彩,统一走「可爱棕 + 粉彩」的干净路子
// ---------------------------------------------------------------------------

interface Palette {
  sky0: string;
  sky1: string;
  far: string;
  /** 地面表层的一条彩色边 */
  ground: string;
  /** 地面主体(一律用很浅的粉彩,不要大片深色) */
  groundDark: string;
  deco: string;
}

const PALETTES: Palette[] = [
  { sky0: "#FFF3E8", sky1: "#FFE4EF", far: "#FBDCC9", ground: "#F6C79E", groundDark: "#F7DDC3", deco: "#FFB9CE" },
  { sky0: "#E9F8FF", sky1: "#F1FCE7", far: "#CDEBC4", ground: "#A9D98F", groundDark: "#DCEEC4", deco: "#6FBF7A" },
  { sky0: "#E1EBF9", sky1: "#EEF4FC", far: "#C3D2E7", ground: "#9FB8D6", groundDark: "#D2E0F0", deco: "#7FA8D4" },
  { sky0: "#FCF3E0", sky1: "#F9EDD8", far: "#E4D3B4", ground: "#D8BE8C", groundDark: "#EEDEBE", deco: "#C9A46A" },
  { sky0: "#FFEAF3", sky1: "#FFF5E8", far: "#F8CFDF", ground: "#F0A9C2", groundDark: "#FAD6E3", deco: "#F07FAA" },
  { sky0: "#E8F6FE", sky1: "#F6FCFF", far: "#C6E6F5", ground: "#8FC9E8", groundDark: "#D1E9F7", deco: "#5FBCE0" },
  { sky0: "#FFF9E4", sky1: "#FFF3D2", far: "#F5E4A9", ground: "#F5CE5E", groundDark: "#FAEBB6", deco: "#EFAE2E" },
  { sky0: "#F0EBFC", sky1: "#F9F5FF", far: "#D8CEF2", ground: "#B79CE8", groundDark: "#E2D7F6", deco: "#9B7ADC" },
];

/** 两位小主角的配色:朵朵粉披风,星星蓝披风(星星披风与 HERO_VIS 同步加深,A-9) */
const HERO_COLORS = [
  { body: "#FFD9A8", cape: "#FF8FB8", capeDark: "#E4699A", mask: "#7B4DA8", name: "朵朵" },
  { body: "#FFE2BE", cape: "#6690E0", capeDark: "#4E74C2", mask: "#2F6BAE", name: "星星" },
];

// 1.3 视觉升级:变花全部改为自绘五瓣花(FLOWER_STYLES),豆豆怪糖果色原值搬去 visual.ts,
// 「糖果色不搞脏」的既有约定原样延续。

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

export const PH_CSS = `
.ph-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;position:relative;}
.ph-hud{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
.ph-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800;color:#8A5A3C;
  box-shadow:0 2px 6px rgba(170,130,100,.22);white-space:nowrap;}
.ph-bar{position:relative;flex:1;min-width:110px;height:20px;border-radius:999px;background:#ffffffcc;
  overflow:hidden;box-shadow:inset 0 1px 3px rgba(150,120,90,.25);}
.ph-bar-fill{height:100%;width:0%;border-radius:999px;transition:width .16s linear;
  background:linear-gradient(90deg,#FFC79A,#9BD98F);}
.ph-bar-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:900;color:#6B4A32;}
.ph-btn{border:none;border-radius:999px;padding:5px 12px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#8A5A3C;box-shadow:0 3px 0 rgba(170,130,100,.3);
  display:inline-flex;align-items:center;justify-content:center;
  min-width:${HUD_BTN_MIN_W}px;min-height:${HUD_BTN_MIN_H}px;}
.ph-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,130,100,.3);}
.ph-btn:focus-visible,.ph-key:focus-visible{outline:3px solid #6B4A32;outline-offset:2px;}
.ph-stagebox{position:relative;border-radius:16px;overflow:hidden;background:#FFF6EC;
  box-shadow:0 4px 12px rgba(170,140,110,.24);}
.ph-cv{display:block;width:100%;height:300px;}
.ph-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;text-align:center;padding:16px;background:rgba(255,250,244,.93);}
.ph-veil-title{font-size:20px;font-weight:900;color:#8A5A3C;}
.ph-veil-sub{font-size:14px;font-weight:700;color:#9A7A5E;line-height:1.6;max-width:320px;}
.ph-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.ph-veil-btn{border:none;border-radius:16px;padding:10px 20px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#F79BB8,#E0729A);box-shadow:0 4px 0 #C25A80;}
.ph-veil-btn.ph-ghost{background:linear-gradient(180deg,#8FBEE8,#6A97CC);box-shadow:0 4px 0 #4F79A8;}
.ph-veil-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #C25A80;}
.ph-toast{position:absolute;left:50%;top:10px;transform:translateX(-50%);background:#ffffffee;border-radius:999px;
  padding:5px 14px;font-size:13px;font-weight:800;color:#8A5A3C;box-shadow:0 3px 8px rgba(160,120,90,.25);
  pointer-events:none;opacity:0;transition:opacity .25s ease;max-width:90%;text-align:center;}
.ph-toast.ph-on{opacity:1;}
.ph-pads{display:flex;justify-content:space-between;gap:8px;margin-top:8px;--k:52px;--cols:4;}
.ph-pads[data-players="2"]{--cols:3;}
/* 第一行是键盘说明,触屏上 display:none——归 grid-auto-rows 管的话它藏起来也照样占
   一整颗键(44–56px),分类关的三色桶图例和提示行就是被这一行顶出屏幕的。
   写成 auto:显示时照样撑开,藏起来就是 0。键仍旧在第 2、3 行。 */
.ph-pad{display:grid;grid-template-columns:repeat(var(--cols),var(--k));
  grid-template-rows:auto var(--k) var(--k);grid-auto-rows:var(--k);gap:4px;
  justify-content:center;}
.ph-pad-name{grid-column:1/-1;font-size:11px;font-weight:800;color:#8A5A3C;text-align:center;
  height:auto;line-height:1.3;}
.ph-key{border:none;border-radius:14px;font-size:19px;font-weight:900;cursor:pointer;font-family:inherit;
  background:#ffffffe0;color:#7A5238;box-shadow:0 3px 0 rgba(170,130,100,.34);touch-action:none;padding:0;}
.ph-key:active,.ph-key.ph-down{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,130,100,.34);
  background:#FFE7D2;}
.ph-key-act{background:#FFD9E6;color:#B3527C;}
.ph-key-sub{background:#DFF0FF;color:#3F72A8;}
.ph-tip{margin-top:6px;text-align:center;font-size:12px;font-weight:700;color:#9A7A5E;line-height:1.5;}
.ph-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
/* display:flex 会盖掉浏览器自带的 [hidden]{display:none},这里补回来 */
.ph-modebar[hidden]{display:none;}
/* 模式入口那两颗：只靠 padding 撑出来是 37px 高，比手指按得准的下限矮 7px */
.ph-mode{border:none;border-radius:999px;padding:9px 18px;font-size:14px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#F0A87C,#D9834F);box-shadow:0 4px 0 #B4693C;
  display:inline-flex;align-items:center;justify-content:center;min-height:${HUD_BTN_MIN_H}px;}
.ph-mode.ph-mode-duo{background:linear-gradient(180deg,#9BC7F2,#6E9FD4);box-shadow:0 4px 0 #55799F;}
.ph-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #B4693C;}
.ph-mode:focus-visible{outline:3px solid #6B4A32;outline-offset:3px;}
.ph-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
.ph-head-title{flex:1;text-align:center;font-size:15px;font-weight:900;color:#8A5A3C;}
@media (max-width:420px){
  .ph-cv{height:178px;}
  /* 双人的两个摇杆并排,竖着省下不少地方,全都还给画面 */
  .ph-wrap[data-players="2"] .ph-cv{height:280px;}
  /* 真正的边长由 padMetrics 逐档量出来写在行内,这里只是 JS 没跑起来时的兜底,不许低于 44 */
  .ph-pads{--k:46px;margin-top:6px;}
  .ph-pads[data-players="2"]{--k:44px;}
  .ph-chip{font-size:12px;padding:3px 7px;}
  .ph-hud{gap:4px;margin-bottom:4px;}
  .ph-bar{min-width:76px;height:18px;}
  .ph-btn{padding:5px 9px;}
  .ph-lbl{display:none;}
  .ph-tip{font-size:11px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .ph-pad-name{font-size:10px;}
}
/* 触屏设备用不上键盘提示,省下的高度留给画面。
   横过来拿的时候宽度上去了(640/844)、高度反而只剩 360/390——上面那条 max-width:420px
   这时候不成立,说明行又冒出来白占 18px,而横屏正是最挤的那一档,
   于是这里按屏高再补一条(W5R3-C-03)。 */
@media (hover:none) and (max-width:420px){ .ph-pad-name{display:none;} }
@media (hover:none) and (max-height:480px){ .ph-pad-name{display:none;} }
@media (max-height:620px){
  .ph-cv{height:138px;}
  .ph-wrap[data-players="2"] .ph-cv{height:224px;}
  .ph-pads{--k:44px;margin-top:4px;}
  .ph-pads[data-players="2"]{--k:44px;}
  .ph-tip{margin-top:4px;font-size:11px;}
}
@media (max-height:840px) and (min-height:501px){
  .ph-pads{position:sticky;bottom:0;z-index:5;margin-top:4px;--k:44px;
    background:linear-gradient(180deg,rgba(255,248,236,0),#FFF8EC 14px);padding-top:4px;}
  .ph-pads[data-players="2"]{--k:44px;}
}

/* ---- 1.2 新增(一律 pph- 前缀)---- */
.pph-chip-sort{background:#EAF3FF;color:#3F72A8;}
.pph-chip-mission{background:#FFF0E2;color:#A5643A;}
.pph-goal{display:flex;align-items:center;gap:6px;margin:0 0 6px;flex-wrap:wrap;}
.pph-goal-label{font-size:12px;font-weight:900;color:#8A5A3C;white-space:nowrap;}
.pph-goal-bar{position:relative;flex:1;min-width:120px;height:16px;border-radius:999px;background:#ffffffcc;
  overflow:hidden;box-shadow:inset 0 1px 3px rgba(150,120,90,.25);}
.pph-goal-fill{height:100%;width:0%;border-radius:999px;transition:width .18s linear;}
.pph-goal-sweep{background:linear-gradient(90deg,#FFB6CE,#F98BB2);}
.pph-goal-haul{background:linear-gradient(90deg,#A7CBFF,#7FA9F0);}
.pph-goal-mess{background:linear-gradient(90deg,#FFD9A8,#EFA9A9);}
.pph-goal-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:900;color:#6B4A32;}
.pph-roles{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 6px;}
.pph-role{border-radius:999px;padding:3px 10px;font-size:12px;font-weight:900;color:#fff;}
.pph-role-sweep{background:#F290B4;}
.pph-role-haul{background:#7FA9F0;}
.pph-bins{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:6px;}
.pph-bin{display:flex;align-items:center;gap:4px;border-radius:12px;padding:4px 9px;font-size:12px;
  font-weight:800;color:#4A3A2C;background:#ffffffd9;box-shadow:0 2px 5px rgba(160,130,100,.2);
  min-height:32px;}
.pph-bin-dot{width:14px;height:14px;border-radius:50%;flex:0 0 auto;}
.pph-bin-emoji{font-size:16px;line-height:1;}
@media (max-width:420px){
  .pph-goal-label{font-size:11px;}
  .pph-bin{font-size:11px;padding:3px 7px;}
}
@media (prefers-reduced-motion:reduce){
  .pph-goal-fill,.ph-bar-fill{transition:none;}
  .ph-toast{transition:none;}
}

/* ---- 1.3 视觉升级(第 22 步 C 档,继续 pph- 前缀):HUD 卡片化 ---- */
.pph-card{background:linear-gradient(180deg,#FFFFFF,#FFF3EA);border:1px solid rgba(244,133,159,.32);
  font-size:14px;}
.pph-chip-combo{background:linear-gradient(180deg,#FFF7DE,#FFE9B8);color:#A5732A;
  border-color:rgba(240,194,90,.55);}
.pph-chip-combo[hidden]{display:none;}
.pph-chip-chapter{background:linear-gradient(180deg,#F3F7FF,#E3EEFF);color:#3F72A8;
  border-color:rgba(127,178,240,.45);}
@media (max-width:420px){
  .pph-card{font-size:14px;padding:3px 6px;}
}
`;

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

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

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
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

/** 系统里开了「减少动态效果」就把抖动、拖尾、冒泡特效全关掉 */
function reducedMotion(): boolean {
  try {
    const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    return mm ? mm("(prefers-reduced-motion: reduce)").matches === true : false;
  } catch {
    return false;
  }
}

function viewportWidth(): number {
  const w = (globalThis as { innerWidth?: number }).innerWidth;
  return typeof w === "number" && w > 0 ? w : 360;
}

// R1 修复:画布上最后一个 emoji 直出点位清场后,连 emoji() 工具函数一起删掉,
// 从根上堵住「往画布贴 emoji 字形」这条回退路(DOM 文案里的装饰 emoji 不归它管)。

// ---------------------------------------------------------------------------
// 场地:一块画布 + 一套操作 + 一个世界
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vy: number;
  life: number;
  glyph: ParticleGlyph;
  size: number;
}

interface FieldOpts {
  def: LevelDef;
  players: 1 | 2;
  sfx: (name: SoundName) => void;
  title: string;
  tip: string;
  /** HUD 右侧要不要显示计时 */
  showTimer: boolean;
  /** 每帧给 HUD 补一段自定义文字(无尽的街区数) */
  extraChip?: (w: World) => string;
  /** 画面上方多加一根条:coop 是共同目标,endless 是脏乱度 */
  goalBar?: "coop" | "mess";
  onEnd: (win: boolean, w: World) => void;
  /** 暂停面板里的「退出」按钮;不给就不显示 */
  onQuit?: () => void;
  /** 开场准备横幅要不要显示 */
  ready?: boolean;
}

interface Field {
  destroy: () => void;
  world: World;
  /** 换一张图接着玩(无尽用:心和脏乱度都带过去) */
  swap: (def: LevelDef, keep: { hearts: number; mess?: number }) => void;
  showVeil: (title: string, sub: string, buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>) => void;
  toast: (text: string) => void;
}

const SFX_FOR_EVENT: Partial<Record<WorldEvent["kind"], SoundName>> = {
  jump: "jump",
  dash: "pop",
  sweep: "tap",
  flower: "coin",
  wipe: "pop",
  sparkle: "coin",
  hurt: "oops",
  spring: "jump",
  smash: "pop",
  pickup: "tap",
  sortGood: "coin",
  sortSoft: "tap",
  cart: "win",
  win: "win",
  lose: "oops",
};

// 事件粒子全部自绘(R1 修复:emoji 文本粒子清场),字形见 trashArt.drawParticleGlyph
const PARTICLE_FOR_EVENT: Partial<Record<WorldEvent["kind"], ParticleGlyph>> = {
  flower: "flower",
  wipe: "spark",
  sparkle: "star",
  hurt: "swirl",
  smash: "spark",
  spring: "mushroom",
  pickup: "bubble",
  sortGood: "star",
  sortSoft: "bubble",
  cart: "star",
};

function createField(host: HTMLElement, opts: FieldOpts): Field {
  let world = createWorld(opts.def, opts.players);
  let destroyed = false;
  let ended = false;
  let paused = false;
  let raf = 0;
  let lastTime = 0;
  let readyT = opts.ready === false ? 0 : 1.5;
  let toastT = 0;
  const particles: Particle[] = [];
  const inputs: Input[] = [emptyInput(), emptyInput()];
  const sfxAt = new Map<SoundName, number>();
  const gentle = reducedMotion();
  const bag = createDisposer();

  // ---- 1.3 视觉状态(全是「皮」:残影 / 尾流 / 星花 / 连击脉冲 / 披风形态) ----
  const fx = new PhFx();
  /** 视觉连击:清扫事件攒起来的,只喂 HUD 卡片与徽章脉冲,不进任何判定 */
  let combo = 0;
  let comboT = 0;
  /** 距上一次脉冲触发过去的毫秒数 */
  let badgeMs: number = PH_ANIM.badgePulseMs;
  /** 披风三段形态(逐玩家),记上一形态好做 180ms ease-out 过渡 */
  const capeStates = world.players.map(() => ({
    prev: "rest" as CapeMode,
    mode: "rest" as CapeMode,
    sinceMs: 9999,
  }));
  /** 星星尾流的逐玩家节拍器(每 100ms 落一颗) */
  const trailAcc = world.players.map(() => 0);

  const wrap = el("div", "ph-wrap");
  wrap.dataset.players = String(opts.players);
  const style = el("style");
  style.textContent = PH_CSS;
  wrap.appendChild(style);

  // ---- HUD ----
  const hud = el("div", "ph-hud");
  const hearts = el("span", "ph-chip");
  const bar = el("div", "ph-bar");
  const barFill = el("div", "ph-bar-fill");
  const barTxt = el("span", "ph-bar-txt");
  bar.append(barFill, barTxt);
  const sparkChip = el("span", "ph-chip");
  const sortChip = el("span", "ph-chip pph-chip-sort");
  const timerChip = el("span", "ph-chip");
  const extraChip = el("span", "ph-chip");
  // 1.3 HUD 卡片化:连击卡(有连击才露面)+ 章节卡
  const comboChip = el("span", "ph-chip pph-card pph-chip-combo");
  comboChip.hidden = true;
  const chapterChip = el(
    "span",
    "ph-chip pph-card pph-chip-chapter",
    viewportWidth() <= 420 ? `📖${opts.def.chapterIndex + 1}` : `📖 第 ${opts.def.chapterIndex + 1} 章`
  );
  chapterChip.title = "当前章节";
  const pauseBtn = el("button", "ph-btn");
  pauseBtn.type = "button";
  pauseBtn.innerHTML = `⏸<span class="ph-lbl"> 暂停</span>`;
  pauseBtn.setAttribute("aria-label", "暂停(也可以按 Esc)");
  hud.append(hearts, bar, sparkChip, comboChip, chapterChip);
  const hasSorting = opts.def.bins.length > 0;
  if (hasSorting) hud.appendChild(sortChip);
  if (opts.showTimer) hud.appendChild(timerChip);
  if (opts.extraChip) hud.appendChild(extraChip);
  hud.appendChild(pauseBtn);
  wrap.appendChild(hud);

  // ---- 任务条:限时 / 护送 / 暴雨天各说一句,双人是共同目标条,无尽是脏乱度 ----
  const goalRow = el("div", "pph-goal");
  const goalLabel = el("div", "pph-goal-label");
  const goalBar = el("div", "pph-goal-bar");
  const goalFill = el("div", "pph-goal-fill");
  const goalTxt = el("span", "pph-goal-txt");
  goalBar.append(goalFill, goalTxt);
  goalRow.append(goalLabel, goalBar);
  if (opts.goalBar) {
    goalLabel.textContent = opts.goalBar === "coop" ? "👫 共同目标" : "🧹 脏乱度";
    goalFill.classList.add(opts.goalBar === "coop" ? "pph-goal-sweep" : "pph-goal-mess");
    wrap.appendChild(goalRow);
  }

  if (opts.def.roles && opts.players === 2) {
    const roles = el("div", "pph-roles");
    roles.append(
      el("span", "pph-role pph-role-sweep", "朵朵 · 清扫"),
      el("span", "pph-role pph-role-haul", "星星 · 搬运分类")
    );
    wrap.appendChild(roles);
  }

  // ---- 画布 ----
  const box = el("div", "ph-stagebox");
  const canvas = el("canvas", "ph-cv");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${opts.title}:噗噗超人正在清洁这条路`);
  const toastEl = el("div", "ph-toast");
  box.append(canvas, toastEl);
  wrap.appendChild(box);

  // ---- 触屏按键 ----
  const pads = el("div", "ph-pads");
  pads.dataset.players = String(opts.players);
  // 360px 上摇杆(前三列)与清扫钮(第四列)之间永远隔着一个 gap,热区不缩到 44px 以下
  const layout = padMetrics(viewportWidth(), opts.players);
  pads.style.setProperty("--k", `${layout.key}px`);
  pads.style.setProperty("--cols", String(layout.columns));
  pads.style.gap = `${layout.gap * 2}px`;
  // 双人一行并排两盘,四列摊完一颗才 34–41px;砍成三列、动作键上提一行,四档全过 44px
  const PAD_KEYS: Array<{ act: InputName; label: string; cls?: string; aria: string; col: number; row: number }> =
    layout.actionsOwnRow
      ? [
          { act: "act", label: "💨", cls: "ph-key-act", aria: "冲刺清扫", col: 1, row: 2 },
          { act: "up", label: "⬆", aria: "跳", col: 2, row: 2 },
          { act: "sub", label: "🧹", cls: "ph-key-sub", aria: "扫一扫", col: 3, row: 2 },
          { act: "left", label: "◀", aria: "往左", col: 1, row: 3 },
          { act: "down", label: "⬇", aria: "蹲下", col: 2, row: 3 },
          { act: "right", label: "▶", aria: "往右", col: 3, row: 3 },
        ]
      : [
          { act: "up", label: "⬆", aria: "跳", col: 2, row: 2 },
          { act: "act", label: "💨", cls: "ph-key-act", aria: "冲刺清扫", col: 4, row: 2 },
          { act: "left", label: "◀", aria: "往左", col: 1, row: 3 },
          { act: "down", label: "⬇", aria: "蹲下", col: 2, row: 3 },
          { act: "right", label: "▶", aria: "往右", col: 3, row: 3 },
          { act: "sub", label: "🧹", cls: "ph-key-sub", aria: "扫一扫", col: 4, row: 3 },
        ];
  const padButtons: Array<{ btn: HTMLButtonElement; player: number; act: InputName }> = [];
  for (let pi = 0; pi < opts.players; pi++) {
    const pad = el("div", "ph-pad");
    const name = el(
      "div",
      "ph-pad-name",
      opts.players === 1
        ? "WASD / 方向键移动 · F 或 L 冲刺 · G 或 K 扫一扫"
        : pi === 0
          ? "朵朵 · W A S D · F 冲刺 · G 扫"
          : "星星 · ↑←↓→ · L 冲刺 · K 扫"
    );
    pad.appendChild(name);
    for (const k of PAD_KEYS) {
      const btn = el("button", `ph-key${k.cls ? ` ${k.cls}` : ""}`, k.label);
      btn.type = "button";
      btn.style.gridColumn = String(k.col);
      btn.style.gridRow = String(k.row);
      btn.setAttribute("aria-label", `${opts.players === 2 ? HERO_COLORS[pi].name : ""}${k.aria}`);
      pad.appendChild(btn);
      padButtons.push({ btn, player: pi, act: k.act });
    }
    pad.style.gap = `${layout.gap}px`;
    pads.appendChild(pad);
  }
  wrap.appendChild(pads);

  // ---- 三色桶小图例:图标 ≥ 32px,孩子照着颜色就能投 ----
  if (hasSorting) {
    const legend = el("div", "pph-bins");
    for (const info of BINS) {
      const item = el("div", "pph-bin");
      const dot = el("span", "pph-bin-dot");
      dot.style.background = info.color;
      const face = el("span", "pph-bin-emoji", info.emoji);
      item.append(dot, face, el("span", undefined, info.short));
      item.title = info.hint;
      legend.appendChild(item);
    }
    wrap.appendChild(legend);
  }

  const tip = el("div", "ph-tip", opts.tip);
  wrap.appendChild(tip);
  host.appendChild(wrap);

  /**
   * 舞台矮到摇杆掉出裁切线时,先把超出的那一截从画布身上扣掉;
   * 画布已经趴在底线上还是装不下,就让 `.ph-wrap` 自己滚——
   * 不然三色桶图例与提示行会永远停在裁切线以下(W5R3-C-01)。
   */
  function fitCanvas(): void {
    canvas.style.height = "";
    wrap.style.maxHeight = "";
    wrap.style.overflowY = "";
    const room = stageRoomPx(wrap);
    const next = canvasRoomPx(wrap.scrollHeight, canvas.offsetHeight, room);
    if (next !== null) canvas.style.height = `${next}px`;
    // 扣完再量一次:还超就交给滚动，一行都不许留在裁切线以下
    const clamp = wrapRoomPx(wrap.scrollHeight, room);
    if (clamp === null) return;
    wrap.style.maxHeight = `${clamp}px`;
    wrap.style.overflowY = "auto";
    // 钳完只是「有得滚」。横屏上手柄仍排在折线以下,顺手把它送进眼里(W5R3-C-03)
    showPad(wrap);
  }
  fitCanvas();
  bag.listen(window, "resize", fitCanvas);

  const g = canvas.getContext("2d");

  // ---- 输入绑定 ----
  function setKey(player: number, act: InputName, down: boolean): void {
    const slot = inputs[player];
    if (!slot) return;
    slot[act] = down;
  }

  for (const { btn, player, act } of padButtons) {
    bag.listen<PointerEvent>(btn, "pointerdown", (e) => {
      e.preventDefault();
      btn.classList.add("ph-down");
      setKey(player, act, true);
    });
    const up = (): void => {
      btn.classList.remove("ph-down");
      setKey(player, act, false);
    };
    bag.listen(btn, "pointerup", up);
    bag.listen(btn, "pointercancel", up);
    bag.listen(btn, "pointerleave", up);
  }

  const releaseAll = (): void => {
    for (const { btn, player, act } of padButtons) {
      btn.classList.remove("ph-down");
      setKey(player, act, false);
    }
  };
  bag.listen(window, "pointerup", releaseAll);
  bag.listen(window, "blur", releaseAll);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isPauseKey(e.code)) {
      e.preventDefault();
      togglePause();
      return;
    }
    const hit = keyToAction(e.code, opts.players);
    if (!hit) return;
    e.preventDefault();
    setKey(hit.player, hit.action, true);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const hit = keyToAction(e.code, opts.players);
    if (!hit) return;
    e.preventDefault();
    setKey(hit.player, hit.action, false);
  };
  bag.listen<KeyboardEvent>(window, "keydown", onKeyDown);
  bag.listen<KeyboardEvent>(window, "keyup", onKeyUp);

  // ---- 遮罩(暂停 / 结算) ----
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
    const v = el("div", "ph-veil");
    v.append(el("div", "ph-veil-title", title), el("div", "ph-veil-sub", sub));
    const row = el("div", "ph-veil-btns");
    for (const b of buttons) {
      const btn = el("button", `ph-veil-btn${b.ghost ? " ph-ghost" : ""}`, b.label);
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
      if (opts.onQuit) {
        buttons.push({ label: "🚪 退出", ghost: true, onClick: () => opts.onQuit?.() });
      }
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
    toastEl.classList.add("ph-on");
    toastT = 2.2;
  }

  // ---- 音效与特效 ----
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
      // 投桶的一句话:对了夸一句,错了温和地讲一遍该去哪个桶(不扣任何分)
      if (ev.kind === "sortGood" || ev.kind === "sortSoft") toast(world.sortHint);
      // 视觉连击:清扫 / 捡星 / 投对桶都算,喂 HUD 连击卡与徽章脉冲(纯装饰)
      if (ev.kind === "flower" || ev.kind === "wipe" || ev.kind === "sparkle" || ev.kind === "sortGood") {
        combo++;
        comboT = 2.5;
        if (combo >= 2) badgeMs = 0;
      }
      // 扫帚碰到豆豆怪的瞬间:接触点星花 4 颗(kit 星花池,reduced 自动只留一帧)
      if (ev.kind === "flower") {
        for (let k = 0; k < 4; k++) {
          fx.sparks.spawn(ev.x + (k % 2 === 0 ? -1 : 1) * (8 + k * 5), ev.y - 8 - (k % 3) * 9, gentle, 7 - k);
        }
      }
      if (gentle) continue;
      const art = PARTICLE_FOR_EVENT[ev.kind];
      if (art) {
        particles.push({ x: ev.x, y: ev.y, vy: -34, life: 0.9, glyph: art, size: 18 });
        if (particles.length > 40) particles.shift();
      }
    }
  }

  // ---- 渲染 ----
  const pal = PALETTES[world.def.chapterIndex % PALETTES.length];
  /** 章节 → 背景主题:街道 / 公园 / 星空屋顶 轮换(只读章节号) */
  const theme = sceneTheme(world.def.chapterIndex);

  /** 自绘小气旋:顶替原来贴 💨 emoji 的车尾气与尘土风 */
  function drawGust(ctx2: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx2.save();
    ctx2.strokeStyle = "rgba(255,255,255,.65)";
    ctx2.lineWidth = Math.max(1, r * 0.28);
    ctx2.lineCap = "round";
    ctx2.beginPath();
    ctx2.arc(x, y, r, Math.PI * 0.15, Math.PI * 1.2);
    ctx2.stroke();
    ctx2.beginPath();
    ctx2.arc(x + r * 0.9, y + r * 0.35, r * 0.55, Math.PI * 0.9, Math.PI * 1.9);
    ctx2.stroke();
    ctx2.restore();
  }

  /** 魔法扫帚:木柄渐变 + 金色捆环 + 8 根须状帚毛,挥动时帚毛随进度弯曲(hero 本地坐标) */
  function drawBroom(ctx2: CanvasRenderingContext2D, w: number, h: number, p: World["players"][number]): void {
    // 挥动进度只读 sweepT 窗口(SWEEP_TIME 一个数都不动)
    const prog = p.sweepT > 0 ? 1 - p.sweepT / SWEEP_TIME : 0;
    ctx2.save();
    ctx2.translate(w * 0.3, -h * 0.5);
    ctx2.rotate(p.sweepT > 0 ? -0.5 + easeOutQuad(prog) * 1.05 : 0.55);
    const len = w * 0.95;
    const handGrad = ctx2.createLinearGradient(0, 0, len, 0);
    handGrad.addColorStop(0, shade(PH_TOKENS.phBroom, 18));
    handGrad.addColorStop(1, shade(PH_TOKENS.phBroom, -12));
    ctx2.fillStyle = handGrad;
    roundRect(ctx2, 0, -w * 0.045, len, w * 0.09, w * 0.045);
    ctx2.fill();
    // 金色捆环
    ctx2.fillStyle = PH_TOKENS.phBroomRing;
    roundRect(ctx2, len * 0.78, -w * 0.075, w * 0.1, w * 0.15, w * 0.03);
    ctx2.fill();
    // 帚毛扇形:8 根须状线,挥得越猛弯得越弯
    const bend = p.sweepT > 0 ? (1 - prog) * 0.55 : 0.12;
    ctx2.lineWidth = Math.max(1, w * 0.035);
    ctx2.lineCap = "round";
    for (let k = 0; k < 8; k++) {
      const spread = (k / 7 - 0.5) * 0.95;
      ctx2.strokeStyle = k % 2 === 0 ? "#F6D08A" : "#E9B863";
      const bx = len * 0.86;
      const ex = bx + Math.cos(spread * 0.8) * w * 0.36;
      const ey = Math.sin(spread) * w * 0.32 + bend * w * 0.16;
      ctx2.beginPath();
      ctx2.moveTo(bx, 0);
      ctx2.quadraticCurveTo(bx + w * 0.18, spread * w * 0.12 + bend * w * 0.18, ex, ey);
      ctx2.stroke();
    }
    ctx2.restore();
  }

  /** 扫帚弧形残影:只在 sweepT > 0 窗口出现,reduced 一帧静态弧;画在超人身后一层 */
  function drawBroomTrail(ctx2: CanvasRenderingContext2D, sxp: number, syp: number, scale: number, p: World["players"][number]): void {
    const a = broomTrailAlpha(p.sweepT, SWEEP_TIME, gentle);
    if (a <= 0) return;
    const h = (p.crouch ? CROUCH_H : PLAYER_H) * scale;
    const w = PLAYER_W * scale;
    const prog = gentle ? 0.5 : 1 - p.sweepT / SWEEP_TIME;
    ctx2.save();
    ctx2.translate(sxp, syp);
    ctx2.scale(p.facing, 1);
    ctx2.strokeStyle = `rgba(255,255,255,${(a * 0.8).toFixed(3)})`;
    ctx2.lineWidth = w * 0.14;
    ctx2.lineCap = "round";
    ctx2.beginPath();
    ctx2.arc(w * 0.3, -h * 0.5, w * 0.95, -0.55 + prog * 0.35, 0.35 + prog * 0.35);
    ctx2.stroke();
    ctx2.restore();
  }

  /** 冲刺残影:两帧线性渐隐的剪影(reduced 压根不生成,见 PhFx.spawnGhost) */
  function drawGhost(
    ctx2: CanvasRenderingContext2D,
    sxp: number,
    syp: number,
    scale: number,
    gh: { facing: 1 | -1; crouch: boolean; framesLeft: number }
  ): void {
    const h = (gh.crouch ? CROUCH_H : PLAYER_H) * scale;
    const w = PLAYER_W * scale;
    const headR = Math.max(4, w * 0.38);
    const headCY = -h + headR * 0.95;
    ctx2.save();
    ctx2.globalAlpha = 0.22 * (gh.framesLeft / PH_ANIM.dashGhostFrames);
    ctx2.translate(sxp, syp);
    ctx2.scale(gh.facing, 1);
    ctx2.fillStyle = PH_TOKENS.phSuit;
    roundRect(ctx2, -w * 0.36, headCY + headR * 0.7, w * 0.72, -(headCY + headR * 0.7) - h * 0.02, w * 0.26);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(0, headCY, headR, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.restore();
  }

  /**
   * 超人九道工序(四·补二):
   * ①落影 ②披风外层渐变+亮边 ③披风内衬 ④身体三停渐变+菱形高光+描边
   * ⑤腰带双色+圆扣 ⑥头+下巴阴影+三撮刘海 ⑦眼罩+反光斜杠+眼睛
   * ⑧手套/靴子收边+跑动腿摆 ⑨状态附加(呼吸/前倾/扫帚)。
   * 判定盒 PLAYER_W/H、CROUCH_H 只读,画多大都不碰它。
   */
  function drawHero(
    ctx2: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    scale: number,
    pi: number,
    p: World["players"][number]
  ): void {
    const vis = HERO_VIS[pi % HERO_VIS.length];
    const h = (p.crouch ? CROUCH_H : PLAYER_H) * scale;
    const w = PLAYER_W * scale;
    const blink = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
    const pose = heroPose(p);
    const tMs = world.time * 1000;
    const headR = Math.max(4, w * 0.38);
    const headCY = -h + headR * 0.95;
    const bodyTop = headCY + headR * 0.7;
    const bodyH = -bodyTop - h * 0.02;
    ctx2.save();
    ctx2.globalAlpha = blink ? 0.45 : 1;
    ctx2.translate(sx, sy);

    // ── 工序① 落影椭圆(0.8×PLAYER_W 宽、0.2 高),统一 phShadow
    ctx2.fillStyle = PH_TOKENS.phShadow;
    ctx2.beginPath();
    ctx2.ellipse(0, -1, w * 0.4, h * 0.1, 0, 0, Math.PI * 2);
    ctx2.fill();

    ctx2.scale(p.facing, 1);
    // ⑨ 的姿态接线放在最前:站立呼吸 ±1px(reduced 停),跑 10° / 冲 18° 前倾绕脚底转
    if (pose === "idle" && p.onGround) ctx2.translate(0, breathOffset(tMs, gentle));
    ctx2.rotate(poseLean(pose));

    // ── 工序② 披风外层:线性渐变(主色顶亮 → 底暗)+ 1px 亮边,三段形态随速度切换
    const cs = capeStates[pi] ?? capeStates[0];
    const pts = blendCape(cs.prev, cs.mode, cs.sinceMs, gentle);
    const capeLen = h * 0.86;
    const sway = gentle ? 0 : Math.sin(tMs / 260 + pi * 2) * pts.sway * capeLen;
    const ax = -w * 0.06;
    const ay = bodyTop - headR * 0.08;
    const tipX = ax - pts.tipX * capeLen;
    const tipY = ay + pts.tipY * capeLen + sway;
    const liftX = ax - pts.liftX * capeLen * 0.72;
    const liftY = ay + pts.liftY * capeLen - capeLen * 0.16;
    const capeGrad = ctx2.createLinearGradient(ax, ay, tipX, tipY);
    capeGrad.addColorStop(0, vis.capeOut0);
    capeGrad.addColorStop(1, vis.capeOut1);
    ctx2.fillStyle = capeGrad;
    ctx2.beginPath();
    ctx2.moveTo(ax, ay);
    ctx2.quadraticCurveTo(liftX, liftY, tipX, tipY);
    ctx2.quadraticCurveTo(ax - capeLen * 0.34, ay + capeLen * 0.62, ax + w * 0.02, ay + h * 0.56);
    ctx2.closePath();
    ctx2.fill();
    ctx2.strokeStyle = "rgba(255,255,255,.75)";
    ctx2.lineWidth = 1;
    ctx2.stroke();

    // ── 工序③ 披风内衬:衬色,跟随外层形变 90%
    ctx2.fillStyle = vis.capeIn;
    ctx2.beginPath();
    ctx2.moveTo(ax, ay + capeLen * 0.06);
    ctx2.quadraticCurveTo(ax + (liftX - ax) * 0.9, ay + (liftY - ay) * 0.9, ax + (tipX - ax) * 0.9, ay + (tipY - ay) * 0.9);
    ctx2.quadraticCurveTo(ax - capeLen * 0.28, ay + capeLen * 0.56, ax + w * 0.02, ay + h * 0.5);
    ctx2.closePath();
    ctx2.fill();

    // ── 工序④ 身体:三停渐变(顶亮/主色/底稳)+ 胸口菱形高光 + 1.5px 描边
    const bodyGrad = ctx2.createLinearGradient(0, bodyTop, 0, bodyTop + bodyH);
    bodyGrad.addColorStop(0, vis.suitHi);
    bodyGrad.addColorStop(0.55, vis.suit);
    bodyGrad.addColorStop(1, shade(vis.suit, -14));
    ctx2.fillStyle = bodyGrad;
    roundRect(ctx2, -w * 0.36, bodyTop, w * 0.72, bodyH, w * 0.26);
    ctx2.fill();
    ctx2.strokeStyle = shade(vis.suit, -32);
    ctx2.lineWidth = 1.5;
    ctx2.stroke();
    // 菱形高光偏向左上(统一光源 45°)
    const chestY = bodyTop + bodyH * 0.34;
    const dR = w * 0.14;
    ctx2.fillStyle = "rgba(255,255,255,.42)";
    ctx2.beginPath();
    ctx2.moveTo(-w * 0.1, chestY - dR);
    ctx2.lineTo(-w * 0.1 + dR * 0.68, chestY);
    ctx2.lineTo(-w * 0.1, chestY + dR);
    ctx2.lineTo(-w * 0.1 - dR * 0.68, chestY);
    ctx2.closePath();
    ctx2.fill();
    // 胸口徽章:连击时 500ms 发光脉冲(reduced 静态亮徽章)
    const badgeR = Math.max(2, w * 0.12);
    const pulse = combo >= 2 ? badgePulse(badgeMs, gentle) : { scale: 1, glow: 0 };
    if (pulse.glow > 0) {
      ctx2.fillStyle = `rgba(255,240,180,${(pulse.glow * 0.9).toFixed(3)})`;
      ctx2.beginPath();
      ctx2.arc(w * 0.08, chestY, badgeR * pulse.scale * 1.7, 0, Math.PI * 2);
      ctx2.fill();
    }
    ctx2.fillStyle = "#FFF6DC";
    ctx2.beginPath();
    ctx2.arc(w * 0.08, chestY, badgeR * pulse.scale, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.fillStyle = vis.mask;
    ctx2.beginPath();
    ctx2.arc(w * 0.08, chestY, badgeR * 0.45 * pulse.scale, 0, Math.PI * 2);
    ctx2.fill();

    // ── 工序⑤ 腰带双色 + 圆扣(直径 < 5px 省略扣)
    const beltH = Math.max(1.5, h * 0.075);
    const beltY = bodyTop + bodyH - beltH * 1.9;
    ctx2.fillStyle = PH_TOKENS.phBelt;
    roundRect(ctx2, -w * 0.36, beltY, w * 0.72, beltH, beltH * 0.5);
    ctx2.fill();
    ctx2.fillStyle = shade(PH_TOKENS.phBelt, -16);
    roundRect(ctx2, -w * 0.36, beltY + beltH * 0.5, w * 0.72, beltH * 0.5, beltH * 0.25);
    ctx2.fill();
    const buckleR = w * 0.085;
    if (showDetail(buckleR * 2)) {
      ctx2.fillStyle = PH_TOKENS.phBeltBuckle;
      ctx2.beginPath();
      ctx2.arc(0, beltY + beltH * 0.5, buckleR, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.strokeStyle = shade(PH_TOKENS.phBelt, -28);
      ctx2.lineWidth = 1;
      ctx2.stroke();
    }

    // ── 工序⑥ 头部圆 + 下巴阴影 + 前额三撮刘海(< 5px 省略,都收在头圆里)
    ctx2.fillStyle = vis.skin;
    ctx2.beginPath();
    ctx2.arc(0, headCY, headR, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.save();
    ctx2.beginPath();
    ctx2.arc(0, headCY, headR, 0, Math.PI * 2);
    ctx2.clip();
    ctx2.fillStyle = "rgba(90,74,110,.14)";
    ctx2.beginPath();
    ctx2.ellipse(0, headCY + headR * 0.78, headR * 0.72, headR * 0.3, 0, 0, Math.PI * 2);
    ctx2.fill();
    if (showDetail(headR * 0.42)) {
      ctx2.fillStyle = vis.hair;
      for (const [hx, hr] of [
        [-0.46, 0.24],
        [-0.02, 0.28],
        [0.4, 0.22],
      ] as const) {
        ctx2.beginPath();
        ctx2.arc(headR * hx, headCY - headR * 0.66, headR * hr, 0, Math.PI * 2);
        ctx2.fill();
      }
    }
    ctx2.restore();

    // ── 工序⑦ 眼罩 + 反光斜杠 + 眼睛两点
    ctx2.fillStyle = vis.mask;
    roundRect(ctx2, -headR * 0.98, headCY - headR * 0.38, headR * 1.96, headR * 0.6, headR * 0.26);
    ctx2.fill();
    ctx2.save();
    roundRect(ctx2, -headR * 0.98, headCY - headR * 0.38, headR * 1.96, headR * 0.6, headR * 0.26);
    ctx2.clip();
    ctx2.strokeStyle = "rgba(255,255,255,.35)";
    ctx2.lineWidth = headR * 0.2;
    ctx2.beginPath();
    ctx2.moveTo(-headR * 0.7, headCY - headR * 0.5);
    ctx2.lineTo(-headR * 0.2, headCY + headR * 0.3);
    ctx2.stroke();
    ctx2.restore();
    ctx2.fillStyle = "#FFFFFF";
    ctx2.beginPath();
    ctx2.arc(headR * 0.34, headCY - headR * 0.08, Math.max(1.2, headR * 0.16), 0, Math.PI * 2);
    ctx2.arc(-headR * 0.24, headCY - headR * 0.08, Math.max(1.2, headR * 0.16), 0, Math.PI * 2);
    ctx2.fill();
    // 腮红与笑脸(可爱底子保住)
    ctx2.fillStyle = "#F9B6C6";
    ctx2.globalAlpha = blink ? 0.3 : 0.7;
    ctx2.beginPath();
    ctx2.ellipse(headR * 0.62, headCY + headR * 0.4, headR * 0.2, headR * 0.14, 0, 0, Math.PI * 2);
    ctx2.ellipse(-headR * 0.62, headCY + headR * 0.4, headR * 0.2, headR * 0.14, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.globalAlpha = blink ? 0.45 : 1;
    ctx2.strokeStyle = "#A9713F";
    ctx2.lineWidth = Math.max(1, headR * 0.14);
    ctx2.beginPath();
    ctx2.arc(headR * 0.06, headCY + headR * 0.34, headR * 0.24, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx2.stroke();

    // 剪影级附件(A-9 双人灰度可分):星星头顶一枚星星发卡,伸出头圆改变轮廓,
    // 16px 缩略下也能靠外形认人——所以它**不走 showDetail 门槛**,多小都画
    if (pi % HERO_VIS.length === 1) {
      const pinR = Math.max(2, headR * 0.55);
      ctx2.fillStyle = "#F5C542";
      traceStar(ctx2, headR * 0.55, headCY - headR * 0.98, pinR);
      ctx2.fill();
      ctx2.strokeStyle = "#B4831E";
      ctx2.lineWidth = 1;
      ctx2.stroke();
    }

    // ── 工序⑧ 手套 / 靴子色块收边 + 跑动 4 帧腿摆(reduced 2 帧)
    const swings = gentle ? [-1, 1] : [-1, 0, 1, 0];
    const swing = pose === "run" ? swings[legFrame(tMs, gentle)] : 0;
    const bootRX = w * 0.16;
    const bootRY = Math.max(1.5, h * 0.06);
    const backX = pose === "dash" ? -w * 0.28 : -w * 0.17 - swing * w * 0.09;
    const frontX = pose === "dash" ? w * 0.04 : w * 0.17 + swing * w * 0.09;
    const backLift = pose === "run" && swing > 0 ? h * 0.045 : 0;
    const frontLift = pose === "run" && swing < 0 ? h * 0.045 : 0;
    ctx2.fillStyle = vis.boot;
    ctx2.strokeStyle = shade(vis.boot, -20);
    ctx2.lineWidth = 1;
    ctx2.beginPath();
    ctx2.ellipse(backX, -h * 0.02 - bootRY - backLift, bootRX, bootRY, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.stroke();
    ctx2.beginPath();
    ctx2.ellipse(frontX, -h * 0.02 - bootRY - frontLift, bootRX, bootRY, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.stroke();
    const handR = Math.max(1.5, w * 0.09);
    const handY = bodyTop + bodyH * 0.52;
    const holding = p.sweepT > 0 || p.dashT > 0;
    ctx2.fillStyle = vis.glove;
    ctx2.strokeStyle = shade(vis.glove, -22);
    ctx2.beginPath();
    ctx2.arc(-w * 0.32, handY, handR, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.stroke();
    ctx2.beginPath();
    // 握持手:挥扫帚时搭在帚柄的握持点上
    if (holding) ctx2.arc(w * 0.3, -h * 0.5, handR, 0, Math.PI * 2);
    else ctx2.arc(w * 0.32, handY, handR, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.stroke();

    // ── 工序⑨ 状态附加:扫帚跟手;冲刺残影画在身后一层、星星尾流压在最上,都在 render 里
    if (holding) drawBroom(ctx2, w, h, p);
    ctx2.restore();
  }

  function drawMonster(
    ctx2: CanvasRenderingContext2D,
    sx: number,
    groundY: number,
    scale: number,
    m: World["monsters"][number],
    idx: number
  ): void {
    if (m.clean) {
      // 变花:自绘五瓣花(花心渐变),240ms 三帧展开,reduced 一帧到位
      const frame = bloomFrame(Math.max(0, 0.6 - m.bloom) * 1000, gentle);
      const grow = [0.5, 0.78, 1][frame] ?? 1;
      drawFlower(ctx2, sx, groundY - MONSTER_H * 0.45 * scale, 13 * scale * grow, idx);
      // 被扫中的「转圈眩晕星」:三颗小星绕着刚开的花打转(纯装饰,reduced 不转)
      if (m.bloom > 0 && !gentle) {
        const spin = (0.6 - m.bloom) * 10;
        ctx2.fillStyle = "rgba(255,255,255,.85)";
        for (let k = 0; k < 3; k++) {
          const a2 = spin + (k * Math.PI * 2) / 3;
          traceStar(
            ctx2,
            sx + Math.cos(a2) * 20 * scale,
            groundY - (MONSTER_H * 0.62 + Math.sin(a2) * 7) * scale,
            4.5 * scale
          );
          ctx2.fill();
        }
      }
      return;
    }
    // 「豆豆怪」:一颗圆润的粉彩小豆豆,头顶一个小卷,两只大眼睛加一张笑脸。
    // 配色一律走糖果色,**不用棕色写实**,离「脏」远一点、离「该扫干净」近一点。
    const col = BEAN_COLORS[world.def.chapterIndex % BEAN_COLORS.length];
    const w = MONSTER_W * 1.05 * scale;
    const h = MONSTER_H * 0.95 * scale;
    const cy = groundY - h * 0.52 - 2 * scale;
    const bob = gentle ? 0 : Math.sin(world.time * 3 + idx) * 1.4 * scale;
    ctx2.save();
    ctx2.translate(0, bob);

    // 统一落影(左上光源,影子略偏右下)
    ctx2.fillStyle = PH_TOKENS.phShadow;
    ctx2.beginPath();
    ctx2.ellipse(sx + 1.5 * scale, groundY - 1.5 * scale, w * 0.42, 3.5 * scale, 0, 0, Math.PI * 2);
    ctx2.fill();

    // 小短脚
    ctx2.fillStyle = col.shade;
    ctx2.beginPath();
    ctx2.ellipse(sx - w * 0.2, groundY - 3 * scale, w * 0.15, 4 * scale, 0, 0, Math.PI * 2);
    ctx2.ellipse(sx + w * 0.2, groundY - 3 * scale, w * 0.15, 4 * scale, 0, 0, Math.PI * 2);
    ctx2.fill();

    // 豆豆身体:下面胖、上面收,一颗鼓鼓的圆豆子
    // 三停渐变体积:左上受光提亮 → 糖果主色 → 右下贴地收进阴影色(糖果色不搞脏)
    const beanGrad = ctx2.createRadialGradient(sx - w * 0.18, cy - h * 0.22, h * 0.08, sx, cy, h * 0.78);
    beanGrad.addColorStop(0, shade(col.body, 16));
    beanGrad.addColorStop(0.55, col.body);
    beanGrad.addColorStop(1, col.shade);
    ctx2.fillStyle = beanGrad;
    ctx2.beginPath();
    ctx2.ellipse(sx, cy + h * 0.14, w * 0.48, h * 0.42, 0, 0, Math.PI * 2);
    ctx2.arc(sx, cy - h * 0.14, h * 0.38, 0, Math.PI * 2);
    ctx2.fill();
    // 头顶的小卷卷(圆的,可爱的那种)
    ctx2.beginPath();
    ctx2.arc(sx, cy - h * 0.52, h * 0.16, 0, Math.PI * 2);
    ctx2.fill();
    // 高光
    ctx2.fillStyle = "#FFFFFF";
    ctx2.globalAlpha = 0.55;
    ctx2.beginPath();
    ctx2.ellipse(sx - w * 0.2, cy - h * 0.26, w * 0.13, h * 0.1, -0.4, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.globalAlpha = 1;

    // 腮红 + 眼睛 + 微笑
    ctx2.fillStyle = "#FF9FBE";
    ctx2.globalAlpha = 0.6;
    ctx2.beginPath();
    ctx2.ellipse(sx - w * 0.29, cy + h * 0.08, w * 0.1, h * 0.08, 0, 0, Math.PI * 2);
    ctx2.ellipse(sx + w * 0.29, cy + h * 0.08, w * 0.1, h * 0.08, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.globalAlpha = 1;
    ctx2.fillStyle = "#FFFFFF";
    ctx2.beginPath();
    ctx2.arc(sx - w * 0.16, cy - h * 0.12, h * 0.16, 0, Math.PI * 2);
    ctx2.arc(sx + w * 0.16, cy - h * 0.12, h * 0.16, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.fillStyle = col.face;
    ctx2.beginPath();
    ctx2.arc(sx - w * 0.14 + m.dir * h * 0.03, cy - h * 0.1, h * 0.08, 0, Math.PI * 2);
    ctx2.arc(sx + w * 0.18 + m.dir * h * 0.03, cy - h * 0.1, h * 0.08, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.strokeStyle = col.face;
    ctx2.lineWidth = Math.max(1, scale * 1.6);
    ctx2.beginPath();
    ctx2.arc(sx, cy + h * 0.06, h * 0.13, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx2.stroke();
    ctx2.restore();
  }

  function render(): void {
    if (!g) return;
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    const cssW = Math.max(240, canvas.clientWidth || 360);
    const cssH = Math.max(160, canvas.clientHeight || 260);
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const def = world.def;
    const scale = Math.max(0.5, Math.min(1.1, cssW / 560));
    const viewW = cssW / scale;
    const groundY = cssH - Math.max(42, cssH * 0.2);
    const focus =
      world.players.reduce((s, p) => s + p.x, 0) / world.players.length;
    const camX = Math.max(0, Math.min(Math.max(0, def.len - viewW), focus - viewW / 2));
    const sx = (wx: number): number => (wx - camX) * scale;
    const sy = (wy: number): number => groundY + wy * scale;

    // ── 图层① 章节背景两层视差:远层 0.16 / 中层 0.45,两档速度差把 2.5D 进深拉开
    const sky = g.createLinearGradient(0, 0, 0, cssH);
    sky.addColorStop(0, pal.sky0);
    sky.addColorStop(1, pal.sky1);
    g.fillStyle = sky;
    g.fillRect(0, 0, cssW, cssH);

    // ①-远层(视差 0.16):主题剪影
    if (theme === "rooftop") {
      // 星空屋顶:月亮 + 小星星 + 远处屋顶天际线
      g.fillStyle = "rgba(255,243,194,.9)";
      g.beginPath();
      g.arc(cssW * 0.78, cssH * 0.2, 15 * scale, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = pal.sky0;
      g.beginPath();
      g.arc(cssW * 0.78 - 7 * scale, cssH * 0.2 - 4 * scale, 12 * scale, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.6)";
      for (let i = 0; i < 12; i++) {
        const sxx = ((i * 173 - camX * 0.08) % (viewW + 340)) - 120;
        traceStar(g, sxx * scale, 16 + ((i * 61) % Math.max(24, cssH * 0.34)), 2.6 * scale);
        g.fill();
      }
      g.globalAlpha = 0.4;
      g.fillStyle = pal.far;
      for (let i = 0; i < 14; i++) {
        const bx = ((i * 230 - camX * 0.16) % (viewW + 460)) - 190;
        const bh = 34 + ((i * 31) % 40);
        roundRect(g, bx * scale, groundY - bh * scale, (96 + ((i * 23) % 42)) * scale, bh * scale, 8 * scale);
        g.fill();
      }
      g.globalAlpha = 1;
    } else if (theme === "park") {
      // 公园:一排接一排的软树浪
      g.globalAlpha = 0.4;
      g.fillStyle = pal.far;
      for (let i = 0; i < 20; i++) {
        const bx = ((i * 150 - camX * 0.16) % (viewW + 300)) - 130;
        const r = (30 + ((i * 27) % 26)) * scale;
        g.beginPath();
        g.arc(bx * scale, groundY - r * 0.5, r, Math.PI, 0);
        g.fill();
      }
      g.globalAlpha = 1;
    } else {
      // 街道:圆角小楼天际线 + 远窗亮点
      g.globalAlpha = 0.42;
      for (let i = 0; i < 15; i++) {
        const bx = ((i * 225 - camX * 0.16) % (viewW + 450)) - 185;
        const bh = 52 + ((i * 41) % 68);
        const bw = 78 + ((i * 29) % 42);
        g.fillStyle = pal.far;
        roundRect(g, bx * scale, groundY - bh * scale, bw * scale, bh * scale, 12 * scale);
        g.fill();
        g.fillStyle = "#FFFFFF";
        g.globalAlpha = 0.24;
        const top = groundY - bh * scale;
        for (let r = 0; r * 26 + 36 < bh; r++) {
          for (let c = 0; c * 28 + 28 < bw; c++) {
            roundRect(g, bx * scale + (15 + c * 28) * scale, top + (15 + r * 26) * scale, 8 * scale, 8 * scale, 3 * scale);
            g.fill();
          }
        }
        g.globalAlpha = 0.42;
      }
      g.globalAlpha = 1;
    }
    // 云只给白天主题;星空屋顶让给星星
    if (theme !== "rooftop") {
      g.globalAlpha = 0.75;
      g.fillStyle = "#FFFFFF";
      for (let i = 0; i < 10; i++) {
        const cx = ((i * 330 - camX * 0.18) % (viewW + 660)) - 240;
        const cy = 22 + ((i * 53) % 46);
        g.beginPath();
        g.arc(cx * scale, cy, 16 * scale, 0, Math.PI * 2);
        g.arc(cx * scale + 18 * scale, cy + 4, 12 * scale, 0, Math.PI * 2);
        g.arc(cx * scale - 17 * scale, cy + 5, 11 * scale, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    // ①-中层(视差 0.45):街道路灯橱窗 / 公园树与长椅 / 屋顶烟囱围栏
    g.globalAlpha = 0.8;
    for (let i = 0; i < 12; i++) {
      const mx = (((i * 320 - camX * 0.45) % (viewW + 640)) - 240) * scale;
      if (mx < -80 * scale || mx > cssW + 80 * scale) continue;
      if (theme === "street") {
        if (i % 2 === 0) {
          // 路灯:杆 + 暖光灯头 + 一圈光晕
          g.fillStyle = pal.deco;
          roundRect(g, mx - 1.6 * scale, groundY - 64 * scale, 3.2 * scale, 64 * scale, 1.6 * scale);
          g.fill();
          g.fillStyle = "rgba(255,233,176,.28)";
          g.beginPath();
          g.arc(mx, groundY - 66 * scale, 11 * scale, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#FFE9B0";
          g.beginPath();
          g.arc(mx, groundY - 66 * scale, 5 * scale, 0, Math.PI * 2);
          g.fill();
        } else {
          // 橱窗:玻璃 + 双色雨棚条纹
          g.fillStyle = "rgba(255,255,255,.55)";
          roundRect(g, mx - 20 * scale, groundY - 36 * scale, 40 * scale, 36 * scale, 5 * scale);
          g.fill();
          for (let k = 0; k < 5; k++) {
            g.fillStyle = k % 2 === 0 ? pal.deco : "#FFFFFF";
            roundRect(g, mx - 20 * scale + k * 8 * scale, groundY - 44 * scale, 8 * scale, 9 * scale, 2 * scale);
            g.fill();
          }
        }
      } else if (theme === "park") {
        if (i % 2 === 0) {
          // 树:树干 + 三球树冠
          g.fillStyle = "#C89B6C";
          roundRect(g, mx - 2.4 * scale, groundY - 40 * scale, 4.8 * scale, 40 * scale, 2 * scale);
          g.fill();
          g.fillStyle = pal.deco;
          g.beginPath();
          g.arc(mx, groundY - 52 * scale, 15 * scale, 0, Math.PI * 2);
          g.arc(mx - 11 * scale, groundY - 42 * scale, 11 * scale, 0, Math.PI * 2);
          g.arc(mx + 11 * scale, groundY - 42 * scale, 11 * scale, 0, Math.PI * 2);
          g.fill();
        } else {
          // 长椅:椅背 + 座板 + 两条腿
          g.fillStyle = "#C89B6C";
          roundRect(g, mx - 16 * scale, groundY - 22 * scale, 32 * scale, 4 * scale, 2 * scale);
          g.fill();
          roundRect(g, mx - 16 * scale, groundY - 13 * scale, 32 * scale, 4 * scale, 2 * scale);
          g.fill();
          roundRect(g, mx - 13 * scale, groundY - 13 * scale, 3 * scale, 13 * scale, 1.5 * scale);
          g.fill();
          roundRect(g, mx + 10 * scale, groundY - 13 * scale, 3 * scale, 13 * scale, 1.5 * scale);
          g.fill();
        }
      } else if (i % 2 === 0) {
        // 屋顶烟囱:砖身 + 囱帽
        g.fillStyle = pal.deco;
        roundRect(g, mx - 7 * scale, groundY - 42 * scale, 14 * scale, 42 * scale, 3 * scale);
        g.fill();
        g.fillStyle = pal.far;
        roundRect(g, mx - 9 * scale, groundY - 46 * scale, 18 * scale, 6 * scale, 3 * scale);
        g.fill();
      } else {
        // 屋顶围栏:一段横杆 + 三根立柱
        g.fillStyle = pal.far;
        roundRect(g, mx - 22 * scale, groundY - 18 * scale, 44 * scale, 3 * scale, 1.5 * scale);
        g.fill();
        for (let k = 0; k < 3; k++) {
          roundRect(g, mx - 16 * scale + k * 16 * scale, groundY - 16 * scale, 3 * scale, 16 * scale, 1.5 * scale);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    // 地平线雾带:远近层之间垫一口气,进深更像 2.5D
    const haze = g.createLinearGradient(0, groundY - 30 * scale, 0, groundY);
    haze.addColorStop(0, "rgba(255,255,255,0)");
    haze.addColorStop(1, "rgba(255,255,255,.22)");
    g.fillStyle = haze;
    g.fillRect(0, groundY - 30 * scale, cssW, 30 * scale);

    // ── 图层② 地面 + 干净带(断口留空)
    const segs: Array<[number, number]> = [];
    let cursor = 0;
    for (const gap of def.gaps) {
      segs.push([cursor, gap.x0]);
      cursor = gap.x1;
    }
    segs.push([cursor, def.len]);
    // 地面主体竖向渐变:顶亮底稳,给 2.5D 一点进深
    const groundGrad = g.createLinearGradient(0, groundY, 0, cssH);
    groundGrad.addColorStop(0, shade(pal.groundDark, 10));
    groundGrad.addColorStop(1, shade(pal.groundDark, -8));
    for (const [a, b] of segs) {
      const x0 = sx(a);
      const x1 = sx(b);
      if (x1 < -40 || x0 > cssW + 40) continue;
      g.fillStyle = groundGrad;
      g.fillRect(x0, groundY, x1 - x0, cssH - groundY);
      g.fillStyle = pal.ground;
      g.fillRect(x0, groundY, x1 - x0, 9 * scale);
      // 顶边一线高光(左上光源)
      g.fillStyle = "rgba(255,255,255,.5)";
      g.fillRect(x0, groundY, x1 - x0, 1.5);
      g.fillStyle = pal.deco;
      for (let d = Math.ceil(a / 90) * 90; d < b; d += 90) {
        g.fillRect(sx(d), groundY + 14 * scale, 5 * scale, 5 * scale);
      }
    }
    // 扫过区域的「发亮干净带」:phClean 渐变痕迹,纯装饰,只读已清扫状态
    const cleanGrad = g.createLinearGradient(0, groundY - 14 * scale, 0, groundY + 8 * scale);
    cleanGrad.addColorStop(0, "rgba(255,244,200,0)");
    cleanGrad.addColorStop(1, PH_TOKENS.phClean);
    g.fillStyle = cleanGrad;
    for (const s of world.sludges) {
      if (!s.clean) continue;
      const x0 = sx(s.x);
      const x1 = sx(s.x + s.w);
      if (x1 < -30 || x0 > cssW + 30) continue;
      roundRect(g, x0 - 6 * scale, groundY - 14 * scale, x1 - x0 + 12 * scale, 22 * scale, 6 * scale);
      g.fill();
    }
    for (const s of world.stains) {
      if (!s.clean) continue;
      const x = sx(s.x);
      if (x < -30 || x > cssW + 30) continue;
      roundRect(g, x - 22 * scale, groundY - 14 * scale, 44 * scale, 22 * scale, 6 * scale);
      g.fill();
    }

    // 泥洼与污渍
    world.sludges.forEach((s, i) => {
      const x0 = sx(s.x);
      const x1 = sx(s.x + s.w);
      if (x1 < -30 || x0 > cssW + 30) return;
      if (s.clean) {
        // 擦亮的水洼开成一排自绘五瓣花:240ms 三帧展开(reduced 一帧)
        const frame = bloomFrame(Math.max(0, 0.5 - s.bloom) * 1000, gentle);
        const grow = [0.5, 0.78, 1][frame] ?? 1;
        for (let k = 0; k * 46 < s.w; k++) {
          drawFlower(g, sx(s.x + 22 + k * 46), groundY - 9 * scale, 8 * scale * grow, i + k);
        }
        return;
      }
      // 一摊小水洼:浅蓝 + 一串小泡泡,擦一下就亮
      g.fillStyle = "#C9E2F2";
      roundRect(g, x0, groundY - 7 * scale, x1 - x0, 10 * scale, 5 * scale);
      g.fill();
      g.fillStyle = "#FFFFFF";
      g.globalAlpha = 0.7;
      for (let k = 0; k * 30 < s.w; k++) {
        g.beginPath();
        g.arc(sx(s.x + 14 + k * 30), groundY - 4 * scale, 2.8 * scale, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    });
    world.stains.forEach((s, i) => {
      const x = sx(s.x);
      if (x < -30 || x > cssW + 30) return;
      if (s.clean) {
        const frame = bloomFrame(Math.max(0, 0.5 - s.bloom) * 1000, gentle);
        const grow = [0.5, 0.78, 1][frame] ?? 1;
        drawFlower(g, x, groundY - 10 * scale, 8 * scale * grow, i);
        return;
      }
      // 小灰尘印:一小片浅浅的粉灰,扫一下就变成花
      g.fillStyle = "#E4D8E8";
      g.beginPath();
      g.ellipse(x, groundY - 3 * scale, 14 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#F4ECF6";
      g.beginPath();
      g.ellipse(x + 6 * scale, groundY - 6 * scale, 5 * scale, 3 * scale, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.55;
      drawSwirl(g, x - 8 * scale, groundY - 12 * scale, 5 * scale);
      g.globalAlpha = 1;
    });

    // 弹簧蘑菇
    for (const sp of world.springs) {
      const x = sx(sp.x);
      if (x < -40 || x > cssW + 40) continue;
      const squash = sp.squash > 0 ? 0.6 : 1;
      g.fillStyle = "#FFF3E4";
      roundRect(g, x - 6 * scale, groundY - 14 * scale * squash, 12 * scale, 14 * scale * squash, 4 * scale);
      g.fill();
      g.fillStyle = "#F58FB0";
      g.beginPath();
      g.ellipse(x, groundY - 14 * scale * squash, 17 * scale, 10 * scale, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = "#FFE3EC";
      g.beginPath();
      g.arc(x - 6 * scale, groundY - 17 * scale * squash, 2.6 * scale, 0, Math.PI * 2);
      g.arc(x + 6 * scale, groundY - 19 * scale * squash, 2.2 * scale, 0, Math.PI * 2);
      g.fill();
    }

    // 平台
    for (const pl of world.platforms) {
      const x = sx(pl.x);
      if (x + pl.w * scale < -40 || x > cssW + 40) continue;
      g.fillStyle = pl.moving ? "#BFE3F7" : pal.ground;
      roundRect(g, x, sy(pl.y), pl.w * scale, 12 * scale, 6 * scale);
      g.fill();
      g.fillStyle = pl.moving ? "#8CC7E8" : pal.groundDark;
      roundRect(g, x, sy(pl.y) + 8 * scale, pl.w * scale, 5 * scale, 3 * scale);
      g.fill();
      if (pl.moving) drawBubbleDot(g, x + pl.w * scale * 0.5, sy(pl.y) - 9 * scale, 6 * scale);
    }

    // 低矮管道
    for (const b of world.beams) {
      const x = sx(b.x);
      if (x + b.w * scale < -40 || x > cssW + 40) continue;
      g.fillStyle = "#A9BBD0";
      roundRect(g, x, sy(BEAM_TOP), b.w * scale, (BEAM_BOTTOM - BEAM_TOP) * scale, 8 * scale);
      g.fill();
      g.fillStyle = "#C4D3E4";
      roundRect(g, x + 4 * scale, sy(BEAM_TOP) + 4 * scale, b.w * scale - 8 * scale, 8 * scale, 4 * scale);
      g.fill();
      g.fillStyle = "#8FA3BC";
      for (let k = 0; k * 40 < b.w; k++) {
        g.beginPath();
        g.arc(x + (16 + k * 40) * scale, sy(BEAM_BOTTOM) - 8 * scale, 2.6 * scale, 0, Math.PI * 2);
        g.fill();
      }
    }

    // 香香星:自绘渐变星(专项①②:平涂 ✨ 清场,原字号 19px ≈ 星半径 9.5)
    world.sparkles.forEach((s) => {
      if (s.taken) return;
      const x = sx(s.x);
      if (x < -30 || x > cssW + 30) return;
      const bob = Math.sin(world.time * 3 + s.x * 0.02) * 3 * scale;
      drawScentStar(g, x, sy(s.y) + bob, 9.5 * scale);
    });

    // ── 图层③ 豆豆怪 / 小花
    world.monsters.forEach((m, i) => {
      const x = sx(m.x);
      if (x < -60 || x > cssW + 60) return;
      drawMonster(g, x, groundY, scale, m, i);
    });

    // 废纸团
    for (const j of world.junks) {
      if (!j.alive) continue;
      const x = sx(j.x);
      if (x < -40 || x > cssW + 40) continue;
      g.fillStyle = "#D8D2C6";
      g.beginPath();
      g.arc(x, groundY - JUNK_R * scale, JUNK_R * scale, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#B3AB9C";
      g.lineWidth = Math.max(1, 1.6 * scale);
      g.beginPath();
      g.moveTo(x - 9 * scale, groundY - 22 * scale);
      g.lineTo(x + 6 * scale, groundY - 12 * scale);
      g.moveTo(x - 5 * scale, groundY - 8 * scale);
      g.lineTo(x + 9 * scale, groundY - 20 * scale);
      g.stroke();
    }

    // 地上等着分类的垃圾
    for (const l of world.litters) {
      if (l.taken || l.sorted) continue;
      const x = sx(l.x);
      if (x < -30 || x > cssW + 30) continue;
      const item = trashById(l.item);
      if (!item) continue;
      g.fillStyle = "#FFFFFF";
      g.globalAlpha = 0.7;
      g.beginPath();
      g.ellipse(x, groundY - 3 * scale, 15 * scale, 5 * scale, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      // 核心道具自绘(专项①:裸 item.emoji 清场),条目造型见 trashArt.drawTrashItem
      drawTrashItem(g, l.item, x, groundY - 13 * scale, 21 * scale);
    }

    // 三色分类站
    world.bins.forEach((bin) => {
      const x = sx(bin.x);
      if (x < -60 || x > cssW + 60) return;
      const info = binInfo(bin.kind);
      const lift = bin.flash > 0 && !gentle ? 3 * scale : 0;
      g.fillStyle = info.color;
      roundRect(g, x - 17 * scale, groundY - 40 * scale - lift, 34 * scale, 40 * scale, 8 * scale);
      g.fill();
      g.fillStyle = "#FFFFFF";
      g.globalAlpha = 0.65;
      roundRect(g, x - 19 * scale, groundY - 46 * scale - lift, 38 * scale, 8 * scale, 4 * scale);
      g.fill();
      g.globalAlpha = 1;
      // 桶面功能图标自绘(专项①:裸 info.emoji 清场);8–9px 桶签一并图形化,
      // 桶的身份 = 桶色 + 图标,全名走 HUD 图例(A-11)
      drawBinIcon(g, bin.kind, x, groundY - 20 * scale - lift, 11 * scale, info.color);
      if (bin.flash > 0) {
        // 投对亮金星、投错弹「想一想」气泡,都自绘(A-7 装饰 emoji 清场)
        if (bin.lastOk) drawMiniStar(g, x, groundY - 58 * scale, 8 * scale);
        else drawThinkBubble(g, x, groundY - 58 * scale, 8 * scale);
      }
    });

    // 清洁车(护送关)
    if (world.cart) {
      const x = sx(world.cart.x);
      if (x > -90 && x < cssW + 90) {
        const wheel = 6 * scale;
        g.fillStyle = "#FFF3E4";
        roundRect(g, x - (CART_W / 2) * scale, groundY - CART_H * scale, CART_W * scale, CART_H * scale * 0.78, 8 * scale);
        g.fill();
        g.fillStyle = world.cart.delivered ? "#8FD69C" : "#9BC7F2";
        roundRect(
          g,
          x - (CART_W / 2 - 4) * scale,
          groundY - (CART_H - 5) * scale,
          (CART_W - 8) * scale,
          CART_H * scale * 0.42,
          6 * scale
        );
        g.fill();
        g.fillStyle = "#7A6B86";
        g.beginPath();
        g.arc(x - 13 * scale, groundY - wheel, wheel, 0, Math.PI * 2);
        g.arc(x + 13 * scale, groundY - wheel, wheel, 0, Math.PI * 2);
        g.fill();
        drawSponge(g, x, groundY - (CART_H - 12) * scale, 15 * scale);
        // 推车尾气改自绘小气旋(💨 emoji 清场)
        if (world.cart.pushed && !gentle) drawGust(g, x - 34 * scale, groundY - 16 * scale, 8 * scale);
      }
    }

    // 净化门
    const doorX = sx(def.goalX);
    if (doorX > -90 && doorX < cssW + 90) {
      const open = doorOpen(world);
      g.fillStyle = open ? "#BFE9C6" : "#E3D9CE";
      roundRect(g, doorX - 28 * scale, groundY - 92 * scale, 56 * scale, 92 * scale, 22 * scale);
      g.fill();
      g.fillStyle = open ? "#8FD69C" : "#CBBFB1";
      roundRect(g, doorX - 20 * scale, groundY - 82 * scale, 40 * scale, 82 * scale, 16 * scale);
      g.fill();
      if (open) drawSoap(g, doorX, groundY - 52 * scale, 24 * scale);
      else drawPadlock(g, doorX, groundY - 52 * scale, 24 * scale);
      g.fillStyle = "#6B4A32";
      // 门帘进度是功能文案,360px 档也不许低于 14px(A-11)
      g.font = `900 ${Math.max(14, Math.round(11 * Math.max(0.85, scale)))}px system-ui,sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(open ? "香喷喷!" : `还差 ${remainingForDoor(world)} 处`, doorX, groundY - 22 * scale);
    }

    // 尘土风
    if (world.chaserX !== null) {
      const cx = sx(world.chaserX);
      if (cx > -140) {
        const grad = g.createLinearGradient(cx - 150 * scale, 0, cx, 0);
        grad.addColorStop(0, "rgba(196,164,196,0)");
        grad.addColorStop(1, "rgba(178,140,178,.72)");
        g.fillStyle = grad;
        g.fillRect(cx - 150 * scale, 0, 150 * scale, cssH);
        g.fillStyle = "rgba(178,140,178,.72)";
        g.fillRect(0, 0, Math.max(0, cx - 150 * scale), cssH);
        for (let k = 0; k < 4; k++) {
          drawGust(g, cx - (12 + k * 26) * scale, groundY - (18 + ((k * 37) % 60)) * scale, 8 * scale);
        }
      }
    }

    // 暴雨天:斜斜的雨丝 + 一层浅浅的雨幕(减少动态效果时只留雨幕)
    if (def.weather === "storm") {
      g.strokeStyle = "rgba(150,180,215,.55)";
      g.lineWidth = Math.max(1, 1.4 * scale);
      if (!gentle) {
        for (let i = 0; i < 46; i++) {
          const rx = ((i * 97 + world.time * 320) % (cssW + 120)) - 60;
          const ry = ((i * 53 + world.time * 520) % cssH) - 10;
          g.beginPath();
          g.moveTo(rx, ry);
          g.lineTo(rx - 6 * scale, ry + 14 * scale);
          g.stroke();
        }
      }
      g.fillStyle = "rgba(190,214,236,.18)";
      g.fillRect(0, 0, cssW, cssH);
    }

    // ── 图层④ 扫帚弧形残影 + 冲刺残影:永远画在超人身后一层
    for (const gh of fx.ghosts) {
      const gx = sx(gh.x);
      if (gx < -40 || gx > cssW + 40) continue;
      drawGhost(g, gx, sy(gh.y), scale, gh);
    }
    fx.tickGhosts();
    world.players.forEach((p) => {
      const x = sx(p.x);
      if (x < -40 || x > cssW + 40) return;
      drawBroomTrail(g, x, sy(p.y), scale, p);
    });

    // ── 图层⑤ 超人
    world.players.forEach((p, i) => {
      const x = sx(p.x);
      if (x < -30 || x > cssW + 30) {
        // 队友跑出画面:边上给个小箭头
        if (opts.players > 1) {
          const edge = x < 0 ? 14 : cssW - 14;
          g.fillStyle = HERO_COLORS[i].cape;
          g.beginPath();
          g.arc(edge, groundY - 60, 11, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#FFFFFF";
          // 队友方位箭头是功能提示,提到 14px(A-11)
          g.font = "900 14px system-ui,sans-serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(x < 0 ? "◀" : "▶", edge, groundY - 60);
        }
        return;
      }
      drawHero(g, x, sy(p.y), scale, i, p);
      // 手上抱着的垃圾:顶在头上,一眼看得出在搬什么(自绘条目,裸 emoji 清场)
      if (p.carry) {
        const item = trashById(p.carry);
        if (item) drawTrashItem(g, item.id, x, sy(p.y) - (PLAYER_H + 18) * scale, 18 * scale);
      }
    });

    // ── 图层⑥ 星星尾流 / 星花(压在超人上面,离豆豆怪的可读区隔开)
    for (const st of fx.trail) {
      const a = trailAlpha(st.ageMs);
      if (a <= 0) continue;
      g.globalAlpha = a;
      g.fillStyle = "#FFF3B8";
      traceStar(g, sx(st.x), sy(st.y), st.r * scale);
      g.fill();
      g.fillStyle = "#FFFFFF";
      traceStar(g, sx(st.x), sy(st.y), st.r * scale * 0.45);
      g.fill();
    }
    g.globalAlpha = 1;
    // 接触星花(kit 星花池存世界坐标,套上镜头变换来画)
    g.save();
    g.translate(-camX * scale, groundY);
    g.scale(scale, scale);
    fx.sparks.draw(g);
    g.restore();

    // 小特效(自绘粒子字形,emoji 文本清场)
    for (const pt of particles) {
      g.globalAlpha = Math.max(0, Math.min(1, pt.life));
      drawParticleGlyph(g, pt.glyph, sx(pt.x), sy(pt.y), pt.size * scale);
    }
    g.globalAlpha = 1;

    // 开场横幅
    if (readyT > 0) {
      g.fillStyle = "rgba(255,250,244,.82)";
      g.fillRect(0, cssH * 0.3, cssW, cssH * 0.4);
      g.fillStyle = "#8A5A3C";
      g.font = `900 ${Math.round(19 * Math.max(0.85, scale))}px system-ui,sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(def.name, cssW / 2, cssH * 0.44);
      // 开场横幅是功能文案,360px 档也不许低于 14px(W7R2 N-2,写法同门帘计数)
      g.font = `800 ${Math.max(14, Math.round(13 * Math.max(0.85, scale)))}px system-ui,sans-serif`;
      g.fillStyle = "#9A7A5E";
      g.fillText(def.hint.slice(0, 24), cssW / 2, cssH * 0.56);
      // 开场顺带念一条卫生小知识(洗手 / 分类 / 少用一次性)
      g.font = `700 ${Math.max(14, Math.round(12 * Math.max(0.85, scale)))}px system-ui,sans-serif`;
      g.fillStyle = "#A98F76";
      g.fillText(hygieneTip(def.index + def.chapterIndex), cssW / 2, cssH * 0.64);
    }
  }

  // ── 图层⑦ HUD(DOM 卡片,永远压在画布上面)
  function renderHud(): void {
    hearts.textContent = `${"❤️".repeat(Math.max(0, world.hearts))}${"🤍".repeat(
      Math.max(0, world.def.hearts - Math.max(0, world.hearts))
    )}`;
    const pct = Math.round(cleanRatio(world) * 100);
    barFill.style.width = `${pct}%`;
    barTxt.textContent = `清洁度 ${pct}%`;
    sparkChip.textContent = `✨ ${world.sparklesTaken}/${world.sparkles.length}`;
    // 连击卡:攒到 2 连才露面(徽章脉冲同一个开关)
    if (combo >= 2) {
      comboChip.hidden = false;
      comboChip.textContent = `⭐ 连击 ×${combo}`;
    } else {
      comboChip.hidden = true;
    }
    if (hasSorting) sortChip.textContent = `♻️ ${world.sorted}/${world.litters.length}`;
    if (opts.showTimer) {
      // 限时清扫显示倒计时,其余显示已用时间
      timerChip.textContent =
        world.def.timeLimit > 0 && world.def.mission === "timed"
          ? `⏳ ${Math.max(0, Math.ceil(world.def.timeLimit - world.time))}″`
          : `⏱ ${Math.floor(world.time)}″`;
    }
    if (opts.extraChip) extraChip.textContent = opts.extraChip(world);
    if (opts.goalBar === "coop") {
      const prog = coopProgress(world);
      goalFill.style.width = `${Math.round(prog.total * 100)}%`;
      goalTxt.textContent = `清扫 ${Math.round(prog.sweep * 100)}% · 分类 ${world.sorted}/${world.def.haulGoal}`;
    } else if (opts.goalBar === "mess") {
      goalFill.style.width = `${Math.round(world.mess * 100)}%`;
      goalTxt.textContent = `脏乱度 ${Math.round(world.mess * 100)}%`;
    }
  }

  // ---- 主循环 ----
  function frame(now: number): void {
    if (destroyed) return;
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 1 / 60;
    lastTime = now;

    if (!paused && !ended) {
      if (readyT > 0) {
        readyT = Math.max(0, readyT - dt);
      } else {
        stepWorld(world, dt, inputs);
        consumeEvents(now);
      }
    }
    // ---- 1.3 视觉计时(纯装饰,不碰任何判定):连击窗口 / 徽章脉冲 / 尾流寿命 / 披风形态 ----
    const dtMs = dt * 1000;
    if (comboT > 0) {
      comboT -= dt;
      if (comboT <= 0) combo = 0;
    }
    badgeMs += dtMs;
    fx.updateTrail(dtMs);
    world.players.forEach((p, i) => {
      const cs = capeStates[i];
      if (cs) {
        // 披风三段形态:只读速度,阈值切换后 180ms ease-out 过渡
        const m = capeMode(p.vx);
        if (m !== cs.mode) {
          cs.prev = cs.mode;
          cs.mode = m;
          cs.sinceMs = 0;
        } else {
          cs.sinceMs += dtMs;
        }
      }
      // 冲刺中撒残影与星星尾流(reduced 在 PhFx 里一律不生成)
      if (p.dashT > 0 && !paused && !ended) {
        fx.spawnGhost(p.x - p.facing * 6, p.y, p.facing, p.crouch, gentle);
        trailAcc[i] = (trailAcc[i] ?? 0) + dtMs;
        if (trailAcc[i] >= PH_ANIM.trailMs / PH_ANIM.trailStars) {
          trailAcc[i] = 0;
          fx.spawnTrailStar(
            p.x - p.facing * (PLAYER_W * 0.8),
            p.y - PLAYER_H * 0.55 + Math.sin(world.time * 21 + i * 3) * 6,
            6.5,
            gentle
          );
        }
      }
    });
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life -= dt;
      pt.y += pt.vy * dt;
      if (pt.life <= 0) particles.splice(i, 1);
    }
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) toastEl.classList.remove("ph-on");
    }

    render();
    renderHud();

    if (!ended && world.status !== "playing") {
      ended = true;
      const win = world.status === "won";
      opts.onEnd(win, world);
    }
    raf = bag.raf(requestAnimationFrame(frame));
  }
  raf = bag.raf(requestAnimationFrame(frame));
  // HUD 的目标条、桶图例是挂上去之后才量得准的,第一帧再钳一次才收得干净
  bag.raf(requestAnimationFrame(fitCanvas));

  return {
    get world() {
      return world;
    },
    swap(def, keep) {
      world = createWorld(def, opts.players);
      world.hearts = Math.max(1, Math.min(def.hearts, keep.hearts));
      world.mess = Math.max(0, Math.min(0.95, keep.mess ?? 0));
      ended = false;
      readyT = 1.1;
      particles.length = 0;
      // 换图把视觉皮层也清干净:残影 / 尾流 / 星花 / 连击一并归零
      fx.clear();
      combo = 0;
      comboT = 0;
      badgeMs = PH_ANIM.badgePulseMs;
      clearVeil();
    },
    showVeil,
    toast,
    destroy() {
      destroyed = true;
      ended = true;
      cancelAnimationFrame(raf);
      // rAF、定时器、window 上的监听全在 bag 里登记过,一把归零
      bag.dispose();
      // 残影 / 星星尾流 / 星花粒子全部清空,不留一颗
      fx.clear();
      clearVeil();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 闯关模式:交给 level99 通用框架
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const def = buildLevel(ctx.level);
  const info = MISSION_INFO[def.mission];
  const field = createField(stage, {
    def,
    players: 1,
    sfx: ctx.sfx,
    title: def.name,
    tip: `${info.emoji} ${info.label} · ${def.hint}`,
    showTimer: true,
    onEnd: (win, w) => {
      const summary = summarize(w);
      if (win) {
        ctx.win(starsForRun(def, summary), winMessage(def, summary));
      } else {
        ctx.lose(w.message || "再来一次,这次先把近处的清干净!");
      }
    },
  });
  return { destroy: () => field.destroy() };
}

// ---------------------------------------------------------------------------
// 无尽模式:清洁马拉松
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = PH_CSS;
  const head = el("div", "ph-head");
  const back = el("button", "ph-btn", "🗺️ 回关卡");
  back.type = "button";
  const title = el("div", "ph-head-title", "♾️ 打扫不完的城市");
  const bestChip = el("span", "ph-chip");
  head.append(back, title, bestChip);
  const fieldHost = el("div");
  root.append(style, head, fieldHost);
  host.appendChild(root);

  /** 已经打扫干净的街区数,也就是这一趟的成绩 */
  let blocks = 0;
  let round = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  bestChip.textContent = best > 0 ? `🏅 最好 ${best} 个街区` : "🏅 还没有纪录";

  let field: Field | null = null;

  function startRound(def: LevelDef, hearts: number, mess: number): void {
    field?.destroy();
    field = createField(fieldHost, {
      def,
      players: 1,
      sfx: (n) => api.play(n),
      title: def.name,
      tip: "区块一段接一段拼上来,脏乱度一直在涨 —— 清得越快,它压得越低。",
      showTimer: false,
      goalBar: "mess",
      extraChip: (w) => `🏙️ ${blocks} 个街区`,
      onQuit: onExit,
      onEnd: (win, w) => {
        if (win) {
          // 这一段街区扫完了,接着拼下一段:脏乱度带过去,只回一点点
          blocks++;
          round++;
          const hp = Math.min(3, w.hearts + 1);
          const carry = Math.max(0, w.mess - 0.12);
          field?.swap(buildEndless(round), { hearts: hp, mess: carry });
          field?.toast(`第 ${blocks} 个街区干干净净!补一颗心,下一段接上了。`);
          api.play("win");
          return;
        }
        finish(w);
      },
    });
  }

  function finish(w: World): void {
    const record = blocks > best;
    if (record) best = save.recordEndlessBest(meta.id, blocks);
    bestChip.textContent = `🏅 最好 ${best} 个街区`;
    const bonus = Math.min(6, Math.floor(blocks / 2));
    if (bonus > 0) api.addStars(bonus);
    api.play(record ? "win" : "oops");
    const why = w.message || "这趟先打扫到这儿,近处的先清、远处的边跑边收,路线会顺很多。";
    field?.showVeil(
      record ? `新纪录 ${blocks} 个街区!` : `这趟扫干净了 ${blocks} 个街区`,
      `${why}${
        record ? "这已经是你坚持得最久的一趟了!" : `最好成绩 ${best} 个街区,再来一趟就能追上它。`
      }${bonus > 0 ? `送你 ${bonus} 颗小星星。` : ""}`,
      [
        {
          label: "🔁 再来一趟",
          onClick: () => {
            round = 0;
            blocks = 0;
            startRound(buildEndless(0), 3, 0);
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

  startRound(buildEndless(0), 3, 0);

  return {
    destroy() {
      field?.destroy();
      field = null;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人合作模式
// ---------------------------------------------------------------------------

function mountCoop(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = PH_CSS;
  const head = el("div", "ph-head");
  const back = el("button", "ph-btn", "🗺️ 回关卡");
  back.type = "button";
  const title = el("div", "ph-head-title", "👫 双人合作 · 清洁大作战");
  const roundChip = el("span", "ph-chip");
  head.append(back, title, roundChip);
  const fieldHost = el("div");
  root.append(style, head, fieldHost);
  host.appendChild(root);

  let round = 0;
  let field: Field | null = null;

  function startRound(): void {
    const def = buildCoop(round);
    roundChip.textContent = `第 ${round + 1} 关`;
    field?.destroy();
    field = createField(fieldHost, {
      def,
      players: 2,
      sfx: (n) => api.play(n),
      title: def.name,
      tip: "分工行动!朵朵清扫,星星把垃圾送进三色桶,最后一起站到净化门前。",
      showTimer: true,
      goalBar: "coop",
      onQuit: onExit,
      onEnd: (win, w) => {
        if (win) {
          api.play("win");
          const stars = coopStars(def, summarize(w));
          api.addStars(stars);
          field?.showVeil(
            `${"⭐".repeat(stars)} 城市干干净净,大家都笑啦!`,
            `${coopMessage(def, w)}用了 ${Math.round(w.time)} 秒,送你们 ${stars} 颗小星星。`,
            [
              {
                label: "▶ 下一关",
                onClick: () => {
                  round++;
                  startRound();
                },
              },
              {
                label: "🔁 再来一次",
                ghost: true,
                onClick: () => startRound(),
              },
              { label: "🗺️ 回关卡", ghost: true, onClick: onExit },
            ]
          );
        } else {
          api.play("oops");
          field?.showVeil("差一点点就干净啦", w.message || "两个人分头清会快很多,再来一次!", [
            { label: "🔁 再来一次", onClick: () => startRound() },
            { label: "🗺️ 回关卡", ghost: true, onClick: onExit },
          ]);
        }
      },
    });
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  startRound();

  return {
    destroy() {
      field?.destroy();
      field = null;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 入口:模式选择 + 188 关地图
// ---------------------------------------------------------------------------

/** 壳层给的 `initialLevel`(1 基),没有就看地址栏的 `?level=N` */
function wantedLevel(api: GameApi): unknown {
  const given = (api as { initialLevel?: unknown }).initialLevel;
  if (given !== undefined && given !== null) return given;
  const loc = (globalThis as { location?: { search?: string; hash?: string } }).location;
  if (!loc) return undefined;
  return parseLevelParam(loc.search ?? "") ?? parseLevelParam(loc.hash ?? "") ?? undefined;
}

/**
 * 替玩家在地图上点开第 level 关(0 基)。
 * 通用闯关框架没开放「打开第 N 关」的接口,又不许改它,所以这里照着地图上的按钮点一下;
 * 点不到就安安静静停在地图上,绝不因为这一步把游戏卡住。
 */
function openLevelOnMap(host: HTMLElement, level: number): boolean {
  const ci = chapterIndexOf(level);
  const tab = host.querySelectorAll<HTMLButtonElement>("button.l99-tab")[ci];
  if (!tab || tab.classList.contains("l99-tab-lock")) return false;
  tab.click();
  const label = `第 ${level + 1} 关`;
  for (const node of Array.from(host.querySelectorAll<HTMLButtonElement>("button.l99-node"))) {
    if (!(node.getAttribute("aria-label") ?? "").startsWith(label)) continue;
    if (node.classList.contains("l99-node-lock")) return false;
    node.click();
    return true;
  }
  return false;
}

export function mount(api: GameApi): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = PH_CSS;
  const bar = el("div", "ph-modebar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = el("button", "ph-mode");
  endlessBtn.type = "button";
  const duoBtn = el("button", "ph-mode ph-mode-duo", "👫 双人合作");
  duoBtn.type = "button";
  bar.append(endlessBtn, duoBtn);

  let current: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 打扫不完的城市 · 最好 ${best} 个街区` : "♾️ 打扫不完的城市 · 来一趟!";
  }

  /** 关卡正在跑没有:侧模式的入口靠它挡住,别把关卡层只藏不销毁(W5R2-C-06) */
  let inLevel = false;

  function closeMode(): void {
    current?.destroy();
    current = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, onExit: () => void) => { destroy: () => void }): void {
    if (current) return;
    // 关卡正在跑就不许再开一层。`bar.hidden` 只是让手指够不着,焦点残留、
    // 壳层补发的 click、自动化脚本照样能把它点响 —— 点响了关卡层就只被 hidden 藏起来,
    // 两条 requestAnimationFrame 与两套定时器一起跑到天荒地老(W5R2-C-06)。
    if (inLevel) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    current = make(modeHost, api, closeMode);
  }

  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  duoBtn.addEventListener("click", () => openMode(mountCoop));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 真下到某一关里就把这两个入口收起来:360px 宽上它俩排不下、要折成两行,
      // 连同外边距占掉 106px。舞台一共才看得见 530px,六颗 56×56 的方向键
      // 整排掉在裁切线以下,纯触屏一步都走不动(W5R2-C-02)。
      // 顺带把 W5R2-C-06 也堵上:关卡进行中点得着 ♾️ 的话,关卡层只被 hidden 藏起来,
      // 两条 requestAnimationFrame 会同时跑。回选关地图就放回去,那儿地方够。
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        inLevel = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy: () => {
            inLevel = false;
            handle?.destroy?.();
            // 无尽 / 双人开着的时候这一条本来就该收着,别替它放回来
            if (!current) bar.hidden = false;
          },
        };
      },
      mapHint: "清洁度、用时、香香星,三样都做到就是三颗星!",
      grandMessage: "188 段路全部变香喷喷,你就是货真价实的便便超人!",
      guideTitle: "清洁小攻略",
    }
  );

  // 壳层或地址栏点名了某一关就直接开进去,不用玩家再在地图上找一遍
  const target = resolveInitialLevel(
    wantedLevel(api),
    furthestPlayable(loadStars(meta.id), loadSkips(meta.id), TOTAL),
    TOTAL
  );
  if (target !== null) {
    try {
      openLevelOnMap(levelHost, target);
    } catch (err) {
      console.warn("[一朵一星] poop-hero 直开关卡失败,停在地图上:", err);
    }
  }

  return {
    destroy() {
      current?.destroy();
      current = null;
      level.destroy();
      root.remove();
    },
  };
}
