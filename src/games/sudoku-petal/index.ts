import { meta } from "./meta";
export { meta };

// 数独花田:每一行、每一列、每一朵九宫花都要种满 1 到 9。
// 188 关战役 + 同题竞速的对战 + 错三题结束的无尽 + 左右分盘的同屏双人,对手是本机假人,全程离线。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import {
  compatFromMeta,
  describeModes,
  modeEntryKeys,
  type ModeEntry
} from "../../engine";
import { save } from "../../engine/save";
import {
  EMPTY,
  cellsFromString,
  conflictsAt,
  isSolved,
  maskToDigits,
  rowOf,
  colOf,
  type SudokuBoard,
  type Variant
} from "./solver";
import { TECHNIQUE_LABELS, allowedUpTo, nextTechnique, type TechniqueHint } from "./techniques";
import { bankAt, boardFromBank, solutionOfBank, variantOfBank, type BankEntry } from "./puzzles";
import {
  CHAPTERS,
  DUO_LEVELS,
  VERSUS_LEVELS,
  endlessConfig,
  endlessPick,
  goalLine,
  levelSpec,
  loseLine,
  starsByTimeAndErrors,
  winLine,
  type EndlessKind,
  type LevelSpec
} from "./levels";
import {
  AI_PROFILES,
  AI_TIERS,
  AI_TIER_BLURBS,
  AI_TIER_LABELS,
  nextMove,
  profileOf,
  type AiTier
} from "./ai";
import guide from "./guide";
import {
  LEAF_GREEN,
  PETAL_BLUE,
  PETAL_PINK,
  budSVG,
  bulbSVG,
  clusterSVG,
  flowerSVG,
  leafSVG,
  mix,
  pencilSVG,
  petalSVG,
  spongeSVG,
  witherSVG
} from "./art";

/** 一朵花开完要多久 */
export const BLOOM_MS = 420;
/** 九宫依次开花,每宫错开这么久(规格硬性要求) */
export const BLOOM_STEP_MS = 100;
/** 省电 / 减少动态效果时开花缩到这么短 */
export const BLOOM_STEP_REDUCED_MS = 30;
/** 填进一个数字时那一下小缩放 */
export const POP_MS = 140;
/** 花苞展开成数字要多久(填数动画) */
export const BUD_MS = 250;
/** 整题开花的波纹从中心往外,每一圈错开这么久 */
export const WAVE_STEP_MS = 50;
/** 波纹里一格「翻成花再翻回数字」的时长 */
export const WAVE_MS = 400;
/** 种齐一整朵九宫花时,九格依次冒花瓣的错峰间隔 */
export const CHEER_STEP_MS = 30;
/** 一小片庆祝花瓣从冒出到散掉的时长 */
export const CHEER_MS = 420;
/** 一行 / 一列刚好种齐时,沿线柔光的错峰间隔(r1 遗留 2 的轻反馈) */
export const LINE_STEP_MS = 24;
/** 一格柔光从亮起到散掉的时长 */
export const LINE_MS = 420;
/** 整题开满时顶上飘几片花瓣(一次建好一整池,反复用) */
export const SHOWER_PETALS = 10;
/** 花瓣雨从挂出到整块收走的时长 */
export const SHOWER_MS = 2600;
/** 每格最小边长(360px 窄屏的红线) */
export const CELL_MIN_PX = 34;
/** 每格最大边长,大屏上也别撑成巨无霸 */
export const CELL_MAX_PX = 56;
/** 数字钮的最小高度(手指红线) */
export const KEY_MIN_PX = 46;
/** 盘面数字的最小字号 */
export const FONT_MIN_PX = 16;

/**
 * 360px 窄屏也要塞得下:盘面占满宽,每格不小于 34px。
 * 两块盘只有在够宽的时候才真的左右分,窄屏自动上下摞着放。
 */
export function cellPxFor(n: number, width: number, seats = 1): number {
  const w = Number.isFinite(width) && width > 0 ? width : 480;
  const usable = Math.max(220, w - 24);
  // 915 舞台扣白边后常 <720,两盘会折行叠成 crop 1046(N-49)。640 起就左右分
  const sideBySide = seats > 1 && usable >= 640;
  const per = sideBySide ? usable / seats - 16 : usable;
  const raw = Math.floor((per - (n - 1) - 6) / n);
  let px = Math.max(CELL_MIN_PX, Math.min(CELL_MAX_PX, raw));
  const h = (globalThis as { innerHeight?: number }).innerHeight;
  if (typeof h === "number" && h > 0 && h <= 500) {
    const boardBudget = (h - 128) / (sideBySide ? 1 : Math.max(1, seats));
    const byH = Math.floor((boardBudget - 14) / Math.max(1, n));
    if (byH > 0) px = Math.max(26, Math.min(px, byH));
  }
  return px;
}

/** 盘面数字的字号:跟着格子走,但绝不小于 16px */
export function digitFontPx(cell: number): number {
  return Math.max(FONT_MIN_PX, Math.round(cell * 0.52));
}

/** 铅笔笔记的小字号(草稿性质,比正文小一号) */
export function noteFontPx(cell: number): number {
  return Math.max(9, Math.round(cell * 0.27));
}

/** 第 i 朵花什么时候开(依次错开;减少动态效果时缩短) */
export function bloomDelayMs(regionIndex: number, reduced = false): number {
  return regionIndex * (reduced ? BLOOM_STEP_REDUCED_MS : BLOOM_STEP_MS);
}

/**
 * 整题开满时的波纹:从盘中心往四周,一圈一圈把格子短暂翻成花再翻回数字。
 * 圈数按「行列离中心的最大距离」算;减少动态效果时不排波纹,直接 0。
 */
export function bloomWaveDelayMs(idx: number, n: number, reduced = false): number {
  if (reduced) return 0;
  const mid = (n - 1) / 2;
  const ring = Math.max(Math.abs(rowOf(idx, n) - mid), Math.abs(colOf(idx, n) - mid));
  return Math.ceil(ring) * WAVE_STEP_MS;
}

/**
 * 结算插画上开几朵花:提示用得越少收成越满,但最少也开一朵,不打击人。
 * 0 次提示开 3 朵、1 次开 2 朵、再多也有 1 朵。
 */
export function harvestFlowers(hints: number): number {
  return Math.max(1, 3 - Math.max(0, hints));
}

function reducedMotion(): boolean {
  try {
    const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    return mm ? mm("(prefers-reduced-motion: reduce)").matches : false;
  } catch {
    return false;
  }
}

function viewportWidth(): number {
  const w = (globalThis as { innerWidth?: number }).innerWidth;
  return typeof w === "number" && w > 0 ? w : 480;
}

// ---------------------------------------------------------------------------
// 键位
// ---------------------------------------------------------------------------

export type Who = "duo" | "star";

export type SeatAction =
  | { type: "move"; dr: number; dc: number }
  | { type: "fill" }
  | { type: "pencil" }
  | { type: "digit"; digit: number };

const DUO_MOVE: Record<string, [number, number]> = {
  w: [-1, 0],
  s: [1, 0],
  a: [0, -1],
  d: [0, 1]
};

const STAR_MOVE: Record<string, [number, number]> = {
  arrowup: [-1, 0],
  arrowdown: [1, 0],
  arrowleft: [0, -1],
  arrowright: [0, 1]
};

/**
 * 键盘按下 → 这一座位要做什么。
 * 朵朵 `WASD` + `F`(填入) + `G`(切铅笔);星星 方向键 + `L`(填入) + `K`(切铅笔)。
 * 数字键 1–9 两边都能直接填(单人玩的时候最顺手)。
 */
export function keyAction(key: string, who: Who, soloDigits = true): SeatAction | null {
  const k = String(key ?? "").toLowerCase();
  const move = who === "duo" ? DUO_MOVE[k] : STAR_MOVE[k];
  if (move) return { type: "move", dr: move[0], dc: move[1] };
  if (who === "duo" && k === "f") return { type: "fill" };
  if (who === "duo" && k === "g") return { type: "pencil" };
  if (who === "star" && k === "l") return { type: "fill" };
  if (who === "star" && k === "k") return { type: "pencil" };
  if (soloDigits && /^[1-9]$/.test(k)) return { type: "digit", digit: Number.parseInt(k, 10) };
  return null;
}

// ---------------------------------------------------------------------------
// 笔记(位掩码)
// ---------------------------------------------------------------------------

/** 在笔记里加 / 去掉一个数字 */
export function toggleNote(mask: number, digit: number): number {
  if (digit < 1 || digit > 9) return mask;
  return mask ^ (1 << digit);
}

/** 笔记里记了哪几个数字 */
export function noteDigits(mask: number): number[] {
  return maskToDigits(mask);
}

export interface SeatSnapshot {
  cells: number[];
  notes: number[];
}

/**
 * 完成判定:**只看真正填进去的数字**,铅笔笔记一概不算。
 * 满盘小字也不会被误判成种完了。
 */
export function isFilledComplete(variant: Variant, snap: SeatSnapshot): boolean {
  return isSolved({ variant, cells: snap.cells });
}

/** 错够次数了没(errorLimit 为 0 表示这一局不判负) */
export function isOutOfTries(errors: number, errorLimit: number): boolean {
  return errorLimit > 0 && errors >= errorLimit;
}

// ---------------------------------------------------------------------------
// 读屏播报
//
// 格子自己有 aria-label,读屏点到哪一格能念哪一格;但「刚才那一手成没成、
// 还剩多少朵、还能错几次」只有看得见的人知道。下面几句短话写进看不见的 live 区,
// 只在真的落子 / 擦掉 / 收场时写,光挪光标不写(挪得快会把读屏刷屏)。
// ---------------------------------------------------------------------------

/** 「第 3 行第 5 列」这半句,和格子 aria-label 一个口径 */
export function cellSay(idx: number, n: number): string {
  return `第${Math.floor(idx / n) + 1}行第${(idx % n) + 1}列`;
}

/** 种对了 */
export function fillSay(idx: number, n: number, digit: number, leftHoles: number): string {
  const tail = leftHoles > 0 ? `还剩 ${leftHoles} 朵` : "花田种满啦";
  return `${cellSay(idx, n)}种下 ${digit},${tail}。`;
}

/** 种错了:还能错几次要说清楚,errorLimit 为 0 时不吓唬人 */
export function wrongSay(idx: number, n: number, digit: number, errors: number, errorLimit: number): string {
  const tail = errorLimit > 0 ? `还能改 ${Math.max(0, errorLimit - errors)} 次` : "再看看同一行同一列";
  return `${cellSay(idx, n)}的 ${digit} 先放一放,${tail}。`;
}

/** 擦掉一格 */
export function clearSay(idx: number, n: number): string {
  return `${cellSay(idx, n)}擦干净了。`;
}

/** 一盘收场 */
export function doneSay(solved: boolean, filled: number, errors: number): string {
  if (solved) return `花田开满啦,一共种了 ${filled} 朵,错了 ${errors} 次。`;
  return `这一盘先到这里,种了 ${filled} 朵。歇一会儿再来。`;
}

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

/**
 * 异形宫的九块淡彩:光靠边框看不清形状,再垫一层很浅的底色。
 * 1.3 起统一降饱和、提亮成「花圃畦」的口径:每一宫是一块自家的花圃,颜色淡到不抢数字。
 */
const REGION_TINTS = [
  "#FDFBF4",
  "#F8F2FA",
  "#EFF5FA",
  "#FBF4EC",
  "#F0F8F0",
  "#FBF2F4",
  "#F3F1FA",
  "#FBF8EC",
  "#EFF7F5"
];

/** 题面数字脚下那片小叶子的颜色:基准绿往各宫的底色里掺一点,颜色随宫走 */
function leafTint(region: number): string {
  return mix(LEAF_GREEN, REGION_TINTS[region % REGION_TINTS.length], 0.35);
}

export const SP_CSS = `
.sp-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#FBF3DF,#EDF6E6);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;position:relative;overflow:hidden;}
.sp-corner{position:absolute;bottom:2px;width:58px;height:44px;pointer-events:none;opacity:.9;}
.sp-corner-l{left:4px;}
.sp-corner-r{right:4px;transform:scaleX(-1);}
.sp-top{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:8px;position:relative;z-index:1;}
.sp-badge{background:#fff;border-radius:14px;padding:5px 10px;font-weight:800;font-size:16px;color:#5f4a8a;
  box-shadow:0 2px 6px rgba(150,130,200,.25);overflow-wrap:anywhere;min-width:0;}
.sp-seats{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;justify-content:center;position:relative;z-index:1;}
.sp-seat{display:flex;flex-direction:column;gap:6px;align-items:center;max-width:100%;min-width:0;position:relative;}
.sp-name{font-size:16px;font-weight:900;color:#5f4a8a;overflow-wrap:anywhere;text-align:center;}
/* 花田本体:格缝是浅土色的田埂,外圈围一圈竖纹木篱笆,篱笆顶上一排圆头桩 */
.sp-grid{display:grid;gap:1px;background:#DCCFB6;border-radius:12px;padding:3px;flex:0 0 auto;position:relative;
  border:8px solid transparent;
  border-image:repeating-linear-gradient(90deg,#C89A6B 0 6px,#A97F52 6px 8px) 8;
  box-shadow:0 4px 10px rgba(120,95,60,.28);}
.sp-grid::before{content:"";position:absolute;left:-8px;right:-8px;top:-13px;height:8px;pointer-events:none;
  background-image:radial-gradient(circle at 4px 5px,#C89A6B 3.2px,rgba(0,0,0,0) 3.7px);
  background-size:12px 8px;background-repeat:repeat-x;}
.sp-cell{position:relative;display:flex;align-items:center;justify-content:center;border:none;padding:0;margin:0;
  font-family:inherit;font-weight:900;line-height:1;cursor:pointer;color:#6B5AA0;background:var(--sp-tint,#FDFBF4);}
.sp-digit{position:relative;display:inline-block;}
/* 题面原有的数字:深色衬线排版,脚下垫一小片叶子,表示「原来就长在这儿」 */
.sp-cell.sp-given{color:#3D3260;background:#F6F1E7;}
.sp-cell.sp-given .sp-digit{font-family:Georgia,"Songti SC","SimSun",serif;}
.sp-leaf{position:absolute;left:6%;bottom:4%;width:34%;height:26%;pointer-events:none;opacity:.9;}
/* 同行同列同宫:极淡的水纹底,提醒「这一片都受光标影响」 */
.sp-cell.sp-peer{background:#F4F6FD;
  background-image:repeating-linear-gradient(115deg,rgba(140,170,230,.08) 0 4px,rgba(0,0,0,0) 4px 9px);}
/* 同一个数字:花瓣形的高亮圈,替代整格换色 */
.sp-cell.sp-same{background:#F7F3FD;}
.sp-cell.sp-same::after{content:"";position:absolute;inset:11%;border:2.5px solid #B393E8;pointer-events:none;
  background:rgba(196,168,240,.16);border-radius:58% 42% 55% 45%/48% 60% 40% 52%;}
/* 冲突:变红之外还摇一下头,右上角再挂一片枯叶(不靠颜色也认得出) */
.sp-cell.sp-bad{background:#FFE3E9;color:#A93A57;animation:spshake 300ms ease-in-out;}
@keyframes spshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}50%{transform:translateX(2px)}75%{transform:translateX(-2px)}}
.sp-badmark{position:absolute;right:2px;top:2px;width:32%;height:32%;max-width:12px;max-height:12px;display:none;pointer-events:none;}
.sp-cell.sp-bad .sp-badmark{display:block;}
/* 技巧提示的焦点:金色呼吸描边 */
.sp-cell.sp-hint{background:#FFF2C9;}
.sp-cell.sp-hint::before{content:"";position:absolute;inset:2px;border:2px solid #E8B33C;border-radius:9px;
  pointer-events:none;animation:sphintglow 1.2s ease-in-out infinite;}
@keyframes sphintglow{0%,100%{opacity:.45}50%{opacity:1}}
/* 光标:圆角粗框 + 四角小三角,键盘玩家一眼找得到 */
.sp-cell.sp-cur{outline:3px solid #9A7BD8;outline-offset:-3px;border-radius:10px;z-index:2;
  background-image:linear-gradient(135deg,#7C5FC0 6px,rgba(0,0,0,0) 6px),linear-gradient(225deg,#7C5FC0 6px,rgba(0,0,0,0) 6px),
    linear-gradient(45deg,#7C5FC0 6px,rgba(0,0,0,0) 6px),linear-gradient(315deg,#7C5FC0 6px,rgba(0,0,0,0) 6px);
  background-position:left top,right top,left bottom,right bottom;background-size:10px 10px;background-repeat:no-repeat;}
.sp-cell.sp-pop{animation:sppop ${POP_MS}ms ease-out;}
.sp-cell:focus-visible{outline:3px solid #3c2a6b;outline-offset:-3px;}
@keyframes sppop{0%{transform:scale(.72)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
.sp-petal{position:absolute;inset:12%;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;}
.sp-cell.sp-bloom .sp-petal{animation:spbloom ${BLOOM_MS}ms ease-out forwards;}
@keyframes spbloom{0%{opacity:0;transform:scale(.2) rotate(-40deg)}55%{opacity:1;transform:scale(1.12) rotate(6deg)}
  100%{opacity:0;transform:scale(1.3) rotate(14deg)}}
/* 填数瞬间:花苞先在格里展开,再散两片花瓣,数字随 sp-pop 浮现 */
.sp-budfx{position:absolute;inset:0;pointer-events:none;}
.sp-bud{position:absolute;left:15%;top:12%;width:70%;height:70%;animation:spbudopen ${BUD_MS}ms ease-out forwards;}
@keyframes spbudopen{0%{opacity:1;transform:scale(.85)}65%{opacity:.85;transform:scale(1.12)}100%{opacity:0;transform:scale(1.3)}}
.sp-fly{position:absolute;left:33%;top:33%;width:34%;height:34%;opacity:0;animation:spflyl ${BUD_MS}ms ease-out forwards;}
.sp-fly-r{animation-name:spflyr;}
@keyframes spflyl{0%{opacity:.95;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(-13px,-15px) rotate(-50deg)}}
@keyframes spflyr{0%{opacity:.95;transform:translate(0,0) rotate(0)}100%{opacity:0;transform:translate(13px,-15px) rotate(50deg)}}
/* 种齐一整朵九宫花:九格依次往上冒一小片花瓣 */
.sp-petalfx{position:absolute;left:30%;top:26%;width:40%;height:40%;pointer-events:none;
  animation:sppetalup ${CHEER_MS}ms ease-out forwards;}
@keyframes sppetalup{0%{opacity:.95;transform:translateY(3px) scale(.6) rotate(0)}
  100%{opacity:0;transform:translateY(-14px) scale(1.1) rotate(40deg)}}
/* 种齐一整行 / 一整列:沿线依次亮一道杏色柔光扫过去(纯视觉轻反馈,不遮数字、不吃点击) */
.sp-linefx{position:absolute;inset:8%;border-radius:10px;pointer-events:none;opacity:0;
  background:radial-gradient(circle at 50% 50%,rgba(255,214,130,.55),rgba(255,214,130,0) 72%);
  animation:splineglow ${LINE_MS}ms ease-out forwards;}
@keyframes splineglow{0%{opacity:0;transform:scale(.7)}35%{opacity:1;transform:scale(1.06)}
  100%{opacity:0;transform:scale(1.15)}}
/* 整题开满:波纹经过的格子把数字翻成小花再翻回来 */
.sp-cell.sp-wave .sp-digit{animation:spdigitflip ${WAVE_MS}ms ease-in-out;}
.sp-cell.sp-wave .sp-petal{animation:sppetalpeek ${WAVE_MS}ms ease-in-out;}
@keyframes spdigitflip{0%,100%{transform:scaleX(1)}45%,55%{transform:scaleX(0)}}
@keyframes sppetalpeek{0%,100%{opacity:0;transform:scale(.4)}45%,55%{opacity:1;transform:scale(1)}}
/* 花瓣雨:开满整题时顶上飘下来的一小池花瓣 */
.sp-shower{position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:inherit;}
.sp-driftpetal{position:absolute;top:-24px;width:18px;height:18px;animation:spdrift 2200ms ease-in forwards;}
@keyframes spdrift{0%{transform:translateY(0) rotate(0);opacity:.95}100%{transform:translateY(190px) rotate(140deg);opacity:0}}
/* 减少动态效果时,开满只在盘中央静静放一朵大花 */
.sp-bigbloom{position:absolute;left:50%;top:38%;width:64px;height:64px;margin:-32px 0 0 -32px;pointer-events:none;}
.sp-notes{position:absolute;inset:2px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);
  color:#8E7FB6;font-weight:700;line-height:1;pointer-events:none;}
.sp-note{display:flex;align-items:center;justify-content:center;}
.sp-pad{display:grid;grid-template-columns:repeat(9,1fr);gap:3px;width:100%;margin-top:6px;}
/* 数字钮:一块挂着小绳的木牌;用完的数字翻到背面,露出一朵小花 */
.sp-key{min-height:${KEY_MIN_PX}px;border:none;border-radius:8px 8px 12px 12px;font-family:inherit;font-size:18px;font-weight:900;
  cursor:pointer;color:#5A4630;padding:0;position:relative;display:inline-flex;align-items:center;justify-content:center;
  background:linear-gradient(180deg,#EACDA5,#D8B183);box-shadow:0 3px 0 #A97F52,inset 0 1px 0 rgba(255,255,255,.55);
  transition:transform .3s ease;}
.sp-key::before{content:"";position:absolute;top:-4px;left:50%;width:2px;height:5px;margin-left:-1px;background:#8A6142;border-radius:1px;}
.sp-key:active{transform:translateY(2px);box-shadow:0 1px 0 #A97F52;}
.sp-keyflower{display:none;width:22px;height:22px;}
.sp-key.sp-key-done{background:linear-gradient(180deg,#DCC8AA,#C9AF8C);opacity:.85;transform:rotateY(180deg);}
.sp-key.sp-key-done .sp-keylabel{display:none;}
.sp-key.sp-key-done .sp-keyflower{display:block;transform:rotateY(180deg);}
.sp-tools{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:6px;}
.sp-tool{min-height:44px;min-width:44px;border:none;border-radius:14px;font-family:inherit;font-size:15px;
  font-weight:900;cursor:pointer;background:#FFE9F2;color:#8d3f66;box-shadow:0 3px 0 #F0C4D8;padding:0 12px;
  display:inline-flex;align-items:center;justify-content:center;gap:5px;}
.sp-ico{order:-1;width:16px;height:16px;flex:0 0 16px;pointer-events:none;}
.sp-tool:active{transform:translateY(2px);box-shadow:0 1px 0 #F0C4D8;}
.sp-tool.sp-on{background:#D9F0DC;color:#2f6b3c;box-shadow:0 3px 0 #AFD9B6;}
.sp-key:focus-visible,.sp-tool:focus-visible,.sp-open:focus-visible,.sp-back:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.sp-msg{text-align:center;min-height:20px;color:#5f4a8a;font-weight:800;margin-top:6px;font-size:16px;
  overflow-wrap:anywhere;line-height:1.5;max-width:340px;}
.sp-hintbox{background:#FFFBEA;border-radius:12px;padding:8px 10px;font-size:16px;font-weight:700;color:#7a5f1e;
  line-height:1.6;max-width:340px;text-align:left;display:flex;align-items:flex-start;gap:6px;}
.sp-bulb{order:-1;width:18px;height:18px;flex:0 0 18px;margin-top:2px;}
/* 收桌小仪式:用时、提示次数,和一排「花田收成」小花 */
.sp-harvest{display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:8px;position:relative;z-index:1;
  background:#FFFDF4;border-radius:12px;padding:8px 12px;box-shadow:0 2px 6px rgba(150,130,200,.2);}
.sp-harvest-line{font-weight:800;color:#5f4a8a;font-size:15px;text-align:center;overflow-wrap:anywhere;}
.sp-harvest-pot{display:flex;gap:4px;}
.sp-harvest-flower{width:24px;height:24px;display:inline-block;}
/* 只给读屏听的一行:看不见、不占位,落子成没成靠它 */
.sp-say{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;
  clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;}
.sp-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.sp-modebar[hidden]{display:none;}
.sp-modetip{flex:1 1 100%;margin:0 0 2px;font-size:16px;line-height:1.5;font-weight:700;color:#5f4a8a;text-align:center;overflow-wrap:anywhere;}
.sp-open{border:none;border-radius:999px;padding:9px 18px;font-size:15px;min-height:44px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#8E6BD0,#7554B8);box-shadow:0 4px 0 #5B3F93;}
.sp-open:active{transform:translateY(2px);box-shadow:0 2px 0 #5B3F93;}
.sp-mode{max-width:860px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;}
.sp-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;}
.sp-back{border:none;border-radius:999px;padding:8px 14px;min-height:44px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffd9;color:#6b4f9c;box-shadow:0 3px 0 rgba(120,90,160,.25);}
.sp-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.25);}
.sp-pause{margin-top:10px;text-align:center;font-size:16px;font-weight:900;color:#6b4f9c;}
@media (max-width:420px){
  .sp-wrap{padding:7px;}
  .sp-seats{gap:10px;}
  .sp-key{font-size:17px;}
  .sp-corner{display:none;}
}
@media (max-height:500px){
  /* N-99:矮横屏盘身(9×9 连键排 570+)比舞台可视段(178/134)高,overflow:hidden
     让盘底两排既看不见也滚不到。滚动交还给用户;数字排/工具排本就 sticky 钉底,
     滚盘时一直在手边。390×844(高>500px)走不进这档,fold 0 不回退。 */
  .sp-wrap{overflow-y:auto;-webkit-overflow-scrolling:touch;}
  .sp-pad,.sp-tools{position:sticky;bottom:0;z-index:5;background:linear-gradient(180deg,rgba(255,252,255,.35),#fff 40%);
    padding-top:4px;}
  .sp-tools{bottom:0;z-index:6;}
}
/* N-70 双人同屏:数字排在盘下会切 394 / 工具 452。N-49 竞速:两盘折行叠高。矮宽屏左右分座+键靠盘 */
@media (min-width:640px) and (max-height:500px){
  .sp-seats{flex-wrap:nowrap;gap:8px;}
  .sp-seat{flex-direction:row;flex-wrap:wrap;justify-content:center;align-items:flex-start;gap:4px;max-width:50%;}
  .sp-pad{width:auto;max-width:128px;margin-top:0;grid-template-columns:repeat(3,1fr);}
  .sp-key{min-height:40px;font-size:15px;}
  .sp-msg,.sp-hintbox{max-height:2.2em;overflow:hidden;}
}
@media (prefers-reduced-motion:reduce){
  .sp-cell.sp-pop{animation:none;}
  .sp-cell.sp-bloom .sp-petal{animation:none;}
  .sp-cell.sp-bad{animation:none;}
  .sp-cell.sp-hint::before{animation:none;opacity:1;}
  .sp-cell.sp-wave .sp-digit,.sp-cell.sp-wave .sp-petal{animation:none;}
  .sp-key{transition:none;}
  .sp-budfx,.sp-petalfx,.sp-linefx{display:none;}
  .sp-driftpetal{animation:none;opacity:0;}
}
`;

// ---------------------------------------------------------------------------
// 一块盘(座位)
// ---------------------------------------------------------------------------

export interface SeatOpts {
  name: string;
  /** 人类座位吃哪一套键位;假人座位填 null */
  who: Who | null;
  /** 假人档位;人类座位不填 */
  ai?: AiTier;
  entry: BankEntry;
  cell: number;
  /** 错几次算失败;0 表示这一局不判负 */
  errorLimit: number;
  /** 允许提示用到哪一档技巧 */
  hintTier: LevelSpec["tier"];
  sfx: (name: SoundName) => void;
  onDone: (state: SeatState) => void;
  /** 每错一次通知一次(无尽用它记错题) */
  onError?: (errors: number) => void;
}

export interface SeatState {
  name: string;
  solved: boolean;
  failed: boolean;
  errors: number;
  /** 已经填进去的格子数(不含题面原有的) */
  filled: number;
  holes: number;
}

export interface Seat {
  el: HTMLElement;
  state: () => SeatState;
  /** 键盘 / 数字钮统一从这里进 */
  act: (action: SeatAction) => void;
  /** 假人推进一步 */
  stepAi: (roll: number) => void;
  /** 这一步该不该轮到假人动了 */
  aiStepMs: number;
  /** 这一盘按过几次提示(结算的「花田收成」按它算) */
  hints: () => number;
  finished: () => boolean;
  destroy: () => void;
}

export function createSeat(host: HTMLElement, opts: SeatOpts): Seat {
  const board = boardFromBank(opts.entry);
  const solution = solutionOfBank(opts.entry);
  const variant = board.variant;
  const n = variant.n;
  const given = board.cells.map((v) => v > EMPTY);
  const holes = given.filter((g) => !g).length;
  const notes = new Array<number>(n * n).fill(0);

  let cursor = board.cells.findIndex((v) => v === EMPTY);
  if (cursor < 0) cursor = 0;
  let pencil = false;
  let errors = 0;
  let solved = false;
  let failed = false;
  let hint: TechniqueHint | null = null;
  let hintsUsed = 0;
  let popAt = -1;
  let aiSlipAt = -1;
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  // 你的庆祝是粉色,对手(假人 / 另一位玩家的盘由各自座位画)是浅蓝,一眼分得开
  const cheerColor = opts.who ? PETAL_PINK : PETAL_BLUE;

  const wrap = document.createElement("div");
  wrap.className = opts.who ? "sp-seat" : "sp-seat sp-seat-ai";

  const name = document.createElement("div");
  name.className = "sp-name";
  name.textContent = opts.name;

  const grid = document.createElement("div");
  grid.className = "sp-grid";
  grid.style.gridTemplateColumns = `repeat(${n},${opts.cell}px)`;
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", `${opts.name}的花田`);

  const cells: HTMLElement[] = [];
  const petals: HTMLElement[] = [];
  const noteBoxes: HTMLElement[] = [];
  const digitFont = digitFontPx(opts.cell);
  const noteFont = noteFontPx(opts.cell);

  for (let i = 0; i < n * n; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "sp-cell";
    cell.style.width = `${opts.cell}px`;
    cell.style.height = `${opts.cell}px`;
    cell.style.fontSize = `${digitFont}px`;
    cell.style.setProperty("--sp-tint", REGION_TINTS[variant.regions[i] % REGION_TINTS.length]);
    // 宫的分界线用 inset 阴影画,不占位、不会把格子挤歪
    cell.style.boxShadow = regionEdgeShadow(variant, i);
    const petal = document.createElement("span");
    petal.className = "sp-petal";
    petal.setAttribute("aria-hidden", "true");
    petal.innerHTML = flowerSVG(cheerColor);
    const noteBox = document.createElement("span");
    noteBox.className = "sp-notes";
    noteBox.style.fontSize = `${noteFont}px`;
    cell.append(petal, noteBox);
    if (given[i]) {
      // 题面原有的数字脚下垫一片小叶子:这一朵是花田原来就长好的
      const leaf = document.createElement("span");
      leaf.className = "sp-leaf";
      leaf.setAttribute("aria-hidden", "true");
      leaf.innerHTML = leafSVG(leafTint(variant.regions[i]));
      cell.appendChild(leaf);
    }
    // 冲突时右上角亮出来的枯叶:除了红色还有形状这第二通道
    const badmark = document.createElement("span");
    badmark.className = "sp-badmark";
    badmark.setAttribute("aria-hidden", "true");
    badmark.innerHTML = witherSVG();
    cell.appendChild(badmark);
    cell.addEventListener("click", () => {
      if (solved || failed) return;
      cursor = i;
      hint = null;
      opts.sfx("tap");
      render();
    });
    grid.appendChild(cell);
    cells.push(cell);
    petals.push(petal);
    noteBoxes.push(noteBox);
  }

  const pad = document.createElement("div");
  pad.className = "sp-pad";
  const keys: HTMLElement[] = [];
  for (let d = 1; d <= n; d++) {
    const key = document.createElement("button");
    key.type = "button";
    key.className = "sp-key";
    key.setAttribute("aria-label", `种下 ${d}`);
    // 木牌正面写数字;这个数字种满九次后木牌翻到背面,露出一朵小花
    const label = document.createElement("span");
    label.className = "sp-keylabel";
    label.textContent = String(d);
    const flower = document.createElement("span");
    flower.className = "sp-keyflower";
    flower.setAttribute("aria-hidden", "true");
    flower.innerHTML = flowerSVG(PETAL_PINK);
    key.append(label, flower);
    key.addEventListener("click", () => act({ type: "digit", digit: d }));
    pad.appendChild(key);
    keys.push(key);
  }
  pad.style.gridTemplateColumns = `repeat(${n},1fr)`;

  /** 工具钮头上的小图标:画出来的,不再用 emoji 占位 */
  function toolIcon(btn: HTMLElement, svg: string): void {
    const ico = document.createElement("span");
    ico.className = "sp-ico";
    ico.setAttribute("aria-hidden", "true");
    ico.innerHTML = svg;
    btn.appendChild(ico);
  }

  const tools = document.createElement("div");
  tools.className = "sp-tools";
  const pencilBtn = document.createElement("button");
  pencilBtn.type = "button";
  pencilBtn.className = "sp-tool";
  pencilBtn.textContent = "铅笔";
  toolIcon(pencilBtn, pencilSVG());
  pencilBtn.addEventListener("click", () => act({ type: "pencil" }));
  const eraseBtn = document.createElement("button");
  eraseBtn.type = "button";
  eraseBtn.className = "sp-tool";
  eraseBtn.textContent = "擦掉";
  toolIcon(eraseBtn, spongeSVG());
  eraseBtn.addEventListener("click", () => clearAt(cursor));
  const hintBtn = document.createElement("button");
  hintBtn.type = "button";
  hintBtn.className = "sp-tool";
  hintBtn.textContent = "提示";
  toolIcon(hintBtn, bulbSVG());
  hintBtn.addEventListener("click", () => askHint());
  tools.append(pencilBtn, eraseBtn, hintBtn);

  const hintBox = document.createElement("div");
  hintBox.className = "sp-hintbox";
  hintBox.hidden = true;
  // 提示框前缀的小灯泡:每次写完提示文字再挂回来
  const bulb = document.createElement("span");
  bulb.className = "sp-bulb";
  bulb.setAttribute("aria-hidden", "true");
  bulb.innerHTML = bulbSVG();

  const msg = document.createElement("div");
  msg.className = "sp-msg";
  msg.setAttribute("role", "status");
  msg.setAttribute("aria-live", "polite");
  msg.setAttribute("aria-atomic", "true");
  msg.textContent = opts.ai ? AI_TIER_BLURBS[opts.ai] : "点一个格子,再按下面的数字钮种进去。";

  // 看不见的一行:落子成没成、还剩多少朵,读屏靠它知道
  const say = document.createElement("div");
  say.className = "sp-say";
  say.setAttribute("role", "status");
  say.setAttribute("aria-live", "polite");
  say.setAttribute("aria-atomic", "true");

  wrap.append(name, grid);
  if (opts.who) wrap.append(pad, tools, hintBox);
  wrap.append(msg, say);
  host.appendChild(wrap);

  /** 只有人在玩的那块盘才播;假人一步一句会把读屏刷屏 */
  function announce(text: string): void {
    if (!opts.who) return;
    if (say.textContent === text) return;
    say.textContent = text;
  }

  /** 还有几朵没种(种满了就是 0) */
  function leftHoles(): number {
    return board.cells.filter((v, i) => v === EMPTY && !given[i]).length;
  }

  function snapshot(): SeatSnapshot {
    return { cells: board.cells, notes };
  }

  function state(): SeatState {
    return {
      name: opts.name,
      solved,
      failed,
      errors,
      filled: board.cells.filter((v, i) => v > EMPTY && !given[i]).length,
      holes
    };
  }

  function clearAt(idx: number): void {
    if (solved || failed || given[idx]) return;
    if (board.cells[idx] === EMPTY && notes[idx] === 0) return;
    board.cells[idx] = EMPTY;
    notes[idx] = 0;
    hint = null;
    opts.sfx("tap");
    announce(clearSay(idx, n));
    render();
  }

  function askHint(): void {
    if (solved || failed) return;
    hint = nextTechnique(board, allowedUpTo(opts.hintTier));
    hintsUsed += 1;
    opts.sfx("meow");
    render();
  }

  /** 玩家种对一朵的瞬间:格里先展开一个花苞,再散两片花瓣(0.25s;弱动效直接不放) */
  function sproutAt(idx: number): void {
    if (reducedMotion()) return;
    const fx = document.createElement("span");
    fx.className = "sp-budfx";
    fx.setAttribute("aria-hidden", "true");
    const bud = document.createElement("span");
    bud.className = "sp-bud";
    bud.innerHTML = budSVG();
    const flyL = document.createElement("span");
    flyL.className = "sp-fly sp-fly-l";
    flyL.innerHTML = petalSVG(cheerColor);
    const flyR = document.createElement("span");
    flyR.className = "sp-fly sp-fly-r";
    flyR.innerHTML = petalSVG(cheerColor);
    fx.append(bud, flyL, flyR);
    cells[idx].appendChild(fx);
    const gone = setTimeout(() => fx.remove(), BUD_MS);
    timers.push(gone);
  }

  /** 这一宫是不是已经全部种对了 */
  function regionDone(r: number): boolean {
    for (let i = 0; i < n * n; i++) {
      if (variant.regions[i] === r && board.cells[i] !== solution[i]) return false;
    }
    return true;
  }

  /** 这一组(行 / 列)是不是已经全部种对了 —— 只读检查,不碰任何玩法状态 */
  function groupDone(g: number): boolean {
    for (const i of variant.groups[g]) {
      if (board.cells[i] !== solution[i]) return false;
    }
    return true;
  }

  /**
   * 种齐一整行 / 一整列:沿线依次亮一道杏色柔光(r1 遗留 2 的轻反馈,纯视觉)。
   * 错峰交给 CSS 的 animation-delay,一次建齐、各自到点自己散;弱动效直接不放。
   */
  function cheerLine(g: number): void {
    if (reducedMotion()) return;
    variant.groups[g].forEach((idx, k) => {
      const fx = document.createElement("span");
      fx.className = "sp-linefx";
      fx.setAttribute("aria-hidden", "true");
      fx.style.animationDelay = `${k * LINE_STEP_MS}ms`;
      cells[idx].appendChild(fx);
      const gone = setTimeout(() => fx.remove(), LINE_MS + n * LINE_STEP_MS);
      timers.push(gone);
    });
  }

  /** 种齐一整朵九宫花:这九格从头到尾依次往上冒一小片花瓣(每格错峰 30ms) */
  function cheerRegion(r: number): void {
    if (reducedMotion()) return;
    let k = 0;
    for (let i = 0; i < n * n; i++) {
      if (variant.regions[i] !== r) continue;
      const idx = i;
      const at = setTimeout(() => {
        const fx = document.createElement("span");
        fx.className = "sp-petalfx";
        fx.setAttribute("aria-hidden", "true");
        fx.innerHTML = petalSVG(cheerColor);
        cells[idx].appendChild(fx);
        const gone = setTimeout(() => fx.remove(), CHEER_MS);
        timers.push(gone);
      }, k * CHEER_STEP_MS);
      timers.push(at);
      k += 1;
    }
  }

  /** 往一格里种一个数字。铅笔模式下只写小字,不动正文 */
  function place(idx: number, digit: number): void {
    if (solved || failed || given[idx]) {
      if (given[idx]) msg.textContent = "这一格是花田原本就有的,换一格试试。";
      return;
    }
    if (pencil) {
      notes[idx] = toggleNote(notes[idx], digit);
      opts.sfx("tap");
      hint = null;
      render();
      return;
    }
    if (board.cells[idx] === digit) {
      clearAt(idx);
      return;
    }
    board.cells[idx] = digit;
    notes[idx] = 0;
    popAt = idx;
    hint = null;

    if (digit !== solution[idx]) {
      errors += 1;
      opts.sfx("oops");
      msg.textContent =
        opts.errorLimit > 0
          ? `这一朵先放一放,还能改 ${Math.max(0, opts.errorLimit - errors)} 次。`
          : "这一朵先放一放,再看看同一行同一列。";
      announce(wrongSay(idx, n, digit, errors, opts.errorLimit));
      opts.onError?.(errors);
      if (isOutOfTries(errors, opts.errorLimit)) {
        failed = true;
        render();
        announce(doneSay(false, state().filled, errors));
        opts.onDone(state());
        return;
      }
    } else {
      opts.sfx("pop");
      // 种对了就顺手把同行同列同花的笔记里这个数字划掉
      const bit = 1 << digit;
      for (const g of variant.cellGroups[idx]) {
        for (const cell of variant.groups[g]) notes[cell] &= ~bit;
      }
      msg.textContent = "";
      announce(fillSay(idx, n, digit, leftHoles()));
      sproutAt(idx);
    }

    render();
    if (isFilledComplete(variant, snapshot())) {
      solved = true;
      opts.sfx("win");
      announce(doneSay(true, state().filled, errors));
      bloom();
      opts.onDone(state());
    } else if (digit === solution[idx]) {
      // 一整朵九宫花种齐了,先小小庆祝一下
      if (regionDone(variant.regions[idx])) cheerRegion(variant.regions[idx]);
      // 行 / 列刚好种齐的轻反馈:落子格此前必未填对,所以「组现在齐」就是「这一手刚种齐」,
      // 不需要任何前后状态钩子。行列组固定排在 groups 的前 2n 位(宫归 cheerRegion,斜线不吵)
      for (const g of variant.cellGroups[idx]) {
        if (g < 2 * n && groupDone(g)) cheerLine(g);
      }
    }
  }

  /**
   * 种满整片花田的大仪式:
   * 九宫照老规矩依次亮花(每宫错开 100ms),再从盘中心一圈一圈把格子翻成花又翻回数字,
   * 顶上飘下一小池花瓣;减少动态效果时全部收起,只在盘中央放一朵大花。
   */
  function bloom(): void {
    const reduced = reducedMotion();
    for (let r = 0; r < n; r++) {
      const delay = bloomDelayMs(r, reduced);
      const id = setTimeout(() => {
        for (let i = 0; i < n * n; i++) {
          if (variant.regions[i] === r) cells[i].classList.add("sp-bloom");
        }
        if (r === n - 1) opts.sfx("coin");
      }, delay);
      timers.push(id);
    }
    if (reduced) {
      const big = document.createElement("span");
      big.className = "sp-bigbloom";
      big.setAttribute("aria-hidden", "true");
      big.innerHTML = flowerSVG(cheerColor);
      wrap.appendChild(big);
      return;
    }
    // 波纹:中心那格先翻,一圈一圈往外传
    for (let i = 0; i < n * n; i++) {
      const idx = i;
      const at = setTimeout(() => {
        cells[idx].classList.add("sp-wave");
        const off = setTimeout(() => cells[idx].classList.remove("sp-wave"), WAVE_MS);
        timers.push(off);
      }, bloomWaveDelayMs(idx, n));
      timers.push(at);
    }
    // 花瓣雨:一次建好一整池,飘完整块收走
    const shower = document.createElement("div");
    shower.className = "sp-shower";
    shower.setAttribute("aria-hidden", "true");
    for (let k = 0; k < SHOWER_PETALS; k++) {
      const p = document.createElement("span");
      p.className = "sp-driftpetal";
      p.innerHTML = petalSVG(k % 2 ? PETAL_BLUE : cheerColor);
      p.style.left = `${6 + ((k * 29) % 88)}%`;
      p.style.animationDelay = `${(k * 137) % 900}ms`;
      shower.appendChild(p);
    }
    wrap.appendChild(shower);
    const gone = setTimeout(() => shower.remove(), SHOWER_MS);
    timers.push(gone);
  }

  function act(action: SeatAction): void {
    if (solved || failed) return;
    switch (action.type) {
      case "move": {
        const r = Math.min(n - 1, Math.max(0, rowOf(cursor, n) + action.dr));
        const c = Math.min(n - 1, Math.max(0, colOf(cursor, n) + action.dc));
        cursor = r * n + c;
        hint = null;
        render();
        break;
      }
      case "pencil":
        pencil = !pencil;
        opts.sfx("tap");
        msg.textContent = pencil ? "铅笔打开了,现在写的是小字草稿,不算种下去。" : "铅笔收起来了,现在是真的种花。";
        render();
        break;
      case "fill": {
        // F / L 是「把光标这一格里唯一还能放的那个数字种下去」的快捷键:
        // 只在真的只剩一种可能时才动手,想不清楚就什么也不做,不会替你猜。
        const only = onlyCandidate(cursor);
        if (only > 0) place(cursor, only);
        else msg.textContent = "这一格还不止一种可能,先按数字钮挑一个吧。";
        break;
      }
      case "digit":
        if (action.digit >= 1 && action.digit <= n) place(cursor, action.digit);
        break;
      default:
        break;
    }
  }

  /** 光标这一格是不是只剩唯一一种可能;不是就返回 0 */
  function onlyCandidate(idx: number): number {
    if (given[idx] || board.cells[idx] > EMPTY) return 0;
    let found = 0;
    for (let d = 1; d <= n; d++) {
      const probe: SudokuBoard = { variant, cells: board.cells };
      const before = probe.cells[idx];
      probe.cells[idx] = EMPTY;
      const ok = conflictFree(probe, idx, d);
      probe.cells[idx] = before;
      if (!ok) continue;
      if (found) return 0;
      found = d;
    }
    return found;
  }

  function conflictFree(b: SudokuBoard, idx: number, digit: number): boolean {
    for (const g of b.variant.cellGroups[idx]) {
      for (const cell of b.variant.groups[g]) {
        if (cell !== idx && b.cells[cell] === digit) return false;
      }
    }
    return true;
  }

  /** 假人走一步:按最小技巧路径填,档位高的又快又准 */
  function stepAi(roll: number): void {
    if (solved || failed || !opts.ai) return;
    if (aiSlipAt >= 0) {
      // 上一步故意种错了,这一步自己发现并改回来
      board.cells[aiSlipAt] = EMPTY;
      aiSlipAt = -1;
      render();
      return;
    }
    const move = nextMove(board, roll, profileOf(opts.ai));
    if (!move) return;
    board.cells[move.idx] = move.digit;
    if (move.slip) aiSlipAt = move.idx;
    popAt = move.idx;
    render();
    if (isFilledComplete(variant, snapshot())) {
      solved = true;
      bloom();
      opts.onDone(state());
    }
  }

  function render(): void {
    const curDigit = board.cells[cursor];
    const peers = new Set<number>();
    for (const g of variant.cellGroups[cursor]) {
      for (const cell of variant.groups[g]) peers.add(cell);
    }
    const bad = new Set<number>();
    for (let i = 0; i < n * n; i++) {
      if (board.cells[i] > EMPTY && conflictsAt(board, i).length > 0) bad.add(i);
    }
    const focus = new Set(hint?.focus ?? []);

    const reduced = reducedMotion();
    for (let i = 0; i < n * n; i++) {
      const cell = cells[i];
      const digit = board.cells[i];
      const classes = ["sp-cell"];
      if (given[i]) classes.push("sp-given");
      if (peers.has(i) && i !== cursor) classes.push("sp-peer");
      if (curDigit > EMPTY && digit === curDigit) classes.push("sp-same");
      if (focus.has(i)) classes.push("sp-hint");
      if (bad.has(i)) classes.push("sp-bad");
      if (i === cursor && opts.who) classes.push("sp-cur");
      if (i === popAt && !reduced) classes.push("sp-pop");
      if (cell.classList.contains("sp-bloom")) classes.push("sp-bloom");
      if (cell.classList.contains("sp-wave")) classes.push("sp-wave");
      cell.className = classes.join(" ");
      cell.setAttribute(
        "aria-label",
        `第${rowOf(i, n) + 1}行第${colOf(i, n) + 1}列${digit > EMPTY ? `,种着 ${digit}` : ",还空着"}`
      );

      // 正文数字与铅笔小字二选一显示
      const noteBox = noteBoxes[i];
      noteBox.innerHTML = "";
      if (digit > EMPTY) {
        setCellText(cell, String(digit));
      } else {
        setCellText(cell, "");
        for (const d of noteDigits(notes[i])) {
          const dot = document.createElement("span");
          dot.className = "sp-note";
          dot.textContent = String(d);
          dot.style.gridColumn = String(((d - 1) % 3) + 1);
          dot.style.gridRow = String(Math.floor((d - 1) / 3) + 1);
          noteBox.appendChild(dot);
        }
      }
    }
    popAt = -1;

    // 已经种满九次的数字把钮暗下去,一眼看出还缺哪个
    for (let d = 1; d <= n; d++) {
      const used = board.cells.filter((v) => v === d).length;
      keys[d - 1].className = used >= n ? "sp-key sp-key-done" : "sp-key";
    }
    pencilBtn.className = pencil ? "sp-tool sp-on" : "sp-tool";
    if (hint) {
      hintBox.hidden = false;
      hintBox.textContent = `${TECHNIQUE_LABELS[hint.kind]}:${hint.text}`;
      // 写字会把小灯泡冲掉,写完再挂回来(CSS 里 order:-1,灯泡永远排最前)
      hintBox.appendChild(bulb);
    } else {
      hintBox.hidden = true;
      hintBox.textContent = "";
    }
  }

  /** 格子里既有小字层又有花瓣层,正文要单独挂一个文本节点,不能直接 textContent */
  function setCellText(cell: HTMLElement, text: string): void {
    const holder = cell.querySelector(".sp-digit");
    if (holder instanceof HTMLElement) {
      holder.textContent = text;
      return;
    }
    const span = document.createElement("span");
    span.className = "sp-digit";
    span.textContent = text;
    cell.appendChild(span);
  }

  render();

  return {
    el: wrap,
    state,
    act,
    stepAi,
    aiStepMs: opts.ai ? AI_PROFILES[opts.ai].stepMs : 0,
    hints: () => hintsUsed,
    finished: () => solved || failed,
    destroy() {
      for (const id of timers) clearTimeout(id);
      timers.length = 0;
      wrap.remove();
    }
  };
}

/**
 * 一格四条边里哪几条是宫的分界:用 inset 阴影画出来,不占位置。
 * 线是田埂的深木色,每条线再跟半像素的浅色高光伴线,看起来像晒到太阳的田埂棱。
 */
export function regionEdgeShadow(variant: Variant, idx: number): string {
  const n = variant.n;
  const r = rowOf(idx, n);
  const c = colOf(idx, n);
  const mine = variant.regions[idx];
  const line = "#8A6142";
  const glow = "rgba(255,241,214,.65)";
  const parts: string[] = [];
  if (r === 0 || variant.regions[idx - n] !== mine) parts.push(`inset 0 2px 0 ${line}`, `inset 0 2.5px 0 ${glow}`);
  if (r === n - 1 || variant.regions[idx + n] !== mine)
    parts.push(`inset 0 -2px 0 ${line}`, `inset 0 -2.5px 0 ${glow}`);
  if (c === 0 || variant.regions[idx - 1] !== mine) parts.push(`inset 2px 0 0 ${line}`, `inset 2.5px 0 0 ${glow}`);
  if (c === n - 1 || variant.regions[idx + 1] !== mine)
    parts.push(`inset -2px 0 0 ${line}`, `inset -2.5px 0 0 ${glow}`);
  return parts.join(",");
}

// ---------------------------------------------------------------------------
// 一张桌子(一个或两个座位 + 计时 + 暂停 + 键盘)
// ---------------------------------------------------------------------------

export interface TableOpts {
  goalText: string;
  hint?: string;
  banner?: string;
  seats: SeatOpts[];
  /** 全部座位都结束时回调 */
  onOver: (states: SeatState[], ms: number) => void;
}

export function createTable(stage: HTMLElement, opts: TableOpts): { destroy: () => void; elapsedMs: () => number } {
  const wrap = document.createElement("div");
  wrap.className = "sp-wrap";

  // 花田两个角落各一丛静态小花:纯装饰、不吃点击
  for (const side of ["l", "r"]) {
    const corner = document.createElement("span");
    corner.className = `sp-corner sp-corner-${side}`;
    corner.setAttribute("aria-hidden", "true");
    corner.innerHTML = clusterSVG();
    wrap.appendChild(corner);
  }

  const top = document.createElement("div");
  top.className = "sp-top";
  const goal = document.createElement("span");
  goal.className = "sp-badge";
  goal.textContent = `🎯 ${opts.goalText}`;
  const clock = document.createElement("span");
  clock.className = "sp-badge";
  clock.textContent = "⏱️ 0 秒";
  top.append(goal, clock);
  if (opts.banner) {
    const banner = document.createElement("span");
    banner.className = "sp-badge";
    banner.textContent = opts.banner;
    top.appendChild(banner);
  }

  const seatsHost = document.createElement("div");
  seatsHost.className = "sp-seats";
  const pauseLine = document.createElement("div");
  pauseLine.className = "sp-pause";
  // 暂停 / 继续这一下读屏也要立刻听见
  pauseLine.setAttribute("role", "status");
  pauseLine.setAttribute("aria-live", "polite");
  pauseLine.setAttribute("aria-atomic", "true");
  pauseLine.textContent = "";

  wrap.append(top, seatsHost, pauseLine);
  if (opts.hint) {
    const hint = document.createElement("div");
    hint.className = "sp-msg";
    hint.textContent = opts.hint;
    wrap.appendChild(hint);
  }
  stage.appendChild(wrap);

  let over = false;
  let paused = false;
  let elapsed = 0;
  let last = -1;
  let raf = 0;
  const aiClock = new Map<number, number>();
  let rolls = 1;

  const seats = opts.seats.map((so) =>
    createSeat(seatsHost, {
      ...so,
      onDone: () => {
        so.onDone(seatOf(so.name));
        checkOver();
      }
    })
  );

  function seatOf(name: string): SeatState {
    const hit = seats.find((s) => s.state().name === name);
    return hit ? hit.state() : { name, solved: false, failed: false, errors: 0, filled: 0, holes: 0 };
  }

  function checkOver(): void {
    if (over) return;
    // 任意一个座位结束就收桌:竞速里谁先种完谁赢,单人盘只有自己
    if (!seats.some((s) => s.finished())) return;
    over = true;
    showHarvest();
    opts.onOver(
      seats.map((s) => s.state()),
      elapsed
    );
  }

  /** 收桌小仪式:有人种满才摆——用时、提示次数,和一排「花田收成」小花 */
  function showHarvest(): void {
    if (!seats.some((s) => s.state().solved)) return;
    const hints = seats.reduce((sum, s) => sum + s.hints(), 0);
    const panel = document.createElement("div");
    panel.className = "sp-harvest";
    const line = document.createElement("span");
    line.className = "sp-harvest-line";
    line.textContent = `用时 ${Math.round(elapsed / 1000)} 秒 · 提示 ${hints} 次 · 花田收成`;
    const pot = document.createElement("span");
    pot.className = "sp-harvest-pot";
    pot.setAttribute("aria-hidden", "true");
    for (let k = 0; k < harvestFlowers(hints); k++) {
      const f = document.createElement("span");
      f.className = "sp-harvest-flower";
      f.innerHTML = flowerSVG(PETAL_PINK);
      pot.appendChild(f);
    }
    panel.append(line, pot);
    wrap.appendChild(panel);
  }

  function tick(ts: number): void {
    if (over) return;
    if (last < 0) last = ts;
    const dt = Math.max(0, Math.min(200, ts - last));
    last = ts;
    if (!paused) {
      elapsed += dt;
      clock.textContent = `⏱️ ${Math.round(elapsed / 1000)} 秒`;
      seats.forEach((seat, i) => {
        if (seat.aiStepMs <= 0 || seat.finished()) return;
        const due = (aiClock.get(i) ?? 0) + dt;
        if (due >= seat.aiStepMs) {
          aiClock.set(i, 0);
          rolls = (rolls * 1103515245 + 12345) % 2147483647;
          seat.stepAi((rolls % 1000) / 1000);
          checkOver();
        } else {
          aiClock.set(i, due);
        }
      });
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  const onKey = (e: KeyboardEvent): void => {
    if (over) return;
    if (e.key === "Escape") {
      paused = !paused;
      pauseLine.textContent = paused ? "⏸️ 暂停中,再按一次 Esc 继续。" : "";
      e.preventDefault();
      return;
    }
    if (paused) return;
    // 只有一块人类盘时数字键直接落子;两块盘同屏时数字键留给触屏,免得抢位
    const humans = opts.seats.filter((s) => s.who).length;
    for (let i = 0; i < seats.length; i++) {
      const who = opts.seats[i].who;
      if (!who) continue;
      const action = keyAction(e.key, who, humans === 1);
      if (action) {
        seats[i].act(action);
        e.preventDefault();
        break;
      }
    }
  };
  (globalThis as { addEventListener?: typeof window.addEventListener }).addEventListener?.("keydown", onKey);

  return {
    elapsedMs: () => elapsed,
    destroy() {
      over = true;
      cancelAnimationFrame(raf);
      (globalThis as { removeEventListener?: typeof window.removeEventListener }).removeEventListener?.(
        "keydown",
        onKey
      );
      for (const s of seats) s.destroy();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 闯关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const spec = levelSpec(ctx.level);
  const entry = bankAt(ctx.level);
  let settled = false;

  const seats: SeatOpts[] = [
    {
      name: "朵朵",
      who: "duo",
      entry,
      cell: cellPxFor(entry.n, viewportWidth(), spec.race ? 2 : 1),
      errorLimit: spec.errorLimit,
      hintTier: spec.tier,
      sfx: ctx.sfx,
      onDone: () => undefined
    }
  ];
  if (spec.race) {
    seats.push({
      name: `${AI_TIER_LABELS[spec.aiTier]}假人`,
      who: null,
      ai: spec.aiTier,
      entry,
      cell: Math.max(CELL_MIN_PX, Math.round(cellPxFor(entry.n, viewportWidth(), 2) * 0.86)),
      errorLimit: 0,
      hintTier: spec.tier,
      sfx: () => undefined,
      onDone: () => undefined
    });
  }

  const table = createTable(stage, {
    goalText: goalLine(spec),
    banner: spec.race ? `对手:${AI_TIER_LABELS[spec.aiTier]}` : undefined,
    hint: "提示按钮只讲方法,不会替你填。铅笔小字随便写,不算种下去。",
    seats,
    onOver: (states, ms) => {
      if (settled) return;
      settled = true;
      const me = states[0];
      const foe = states[1];
      if (me.solved) {
        ctx.win(starsByTimeAndErrors(ms, me.errors, spec.parMs), winLine(ms, me.errors));
      } else if (foe?.solved) {
        ctx.lose("假人这次快了半步,你的花田还在,换个顺序再来一遍。");
      } else {
        ctx.lose(loseLine(spec));
      }
    }
  });

  return { destroy: () => table.destroy() };
}

// ---------------------------------------------------------------------------
// 对战 / 无尽 / 双人同屏
// ---------------------------------------------------------------------------

type ExtraMode = "versus" | "endless" | "duo";

const MODE_TITLE: Record<ExtraMode, string> = {
  versus: "🤝 对战竞速",
  endless: "♾️ 花田马拉松",
  duo: "👫 双人同屏"
};

function mountExtra(host: HTMLElement, api: GameApi, mode: ExtraMode, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "sp-mode";
  const style = document.createElement("style");
  style.textContent = SP_CSS;
  const head = document.createElement("div");
  head.className = "sp-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "sp-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "sp-badge";
  chip.textContent = MODE_TITLE[mode];
  head.append(back, chip);
  const setup = document.createElement("div");
  setup.className = "sp-mhead";
  const stage = document.createElement("div");
  const board = document.createElement("div");
  wrap.append(style, head, setup, stage, board);
  host.appendChild(wrap);

  let table: { destroy: () => void; elapsedMs: () => number } | null = null;
  /** 关掉之后不许再开新盘:无尽的换题是延时的,玩家可能在这一秒里就退出去了 */
  let closed = false;
  const laters = new Set<ReturnType<typeof setTimeout>>();

  /** 托管的延时:destroy 会把还没到点的一起撤掉 */
  function later(fn: () => void, ms: number): void {
    const id = setTimeout(() => {
      laters.delete(id);
      if (closed) return;
      fn();
    }, ms);
    laters.add(id);
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function drop(): void {
    table?.destroy();
    table = null;
    board.innerHTML = "";
  }

  // ---- 对战:同题竞速 ----
  let tier: AiTier = "normal";
  let versusLevel = VERSUS_LEVELS[2];

  function startVersus(): void {
    drop();
    const entry = bankAt(versusLevel);
    const spec = levelSpec(versusLevel);
    table = createTable(board, {
      goalText: `同一题竞速 · ${AI_TIER_LABELS[tier]}假人`,
      hint: "两边是一模一样的题,谁先种满谁赢。",
      seats: [
        {
          name: "朵朵",
          who: "duo",
          entry,
          cell: cellPxFor(entry.n, viewportWidth(), 2),
          errorLimit: 0,
          hintTier: spec.tier,
          sfx: (s) => api.play(s),
          onDone: () => undefined
        },
        {
          name: `${AI_TIER_LABELS[tier]}假人`,
          who: null,
          ai: tier,
          entry,
          cell: cellPxFor(entry.n, viewportWidth(), 2),
          errorLimit: 0,
          hintTier: spec.tier,
          sfx: () => undefined,
          onDone: () => undefined
        }
      ],
      onOver: (states, ms) => {
        const me = states[0];
        const line = document.createElement("div");
        line.className = "sp-msg";
        if (me.solved) {
          api.play("win");
          api.addStars(2);
          line.textContent = `你先种满了！用了 ${Math.round(ms / 1000)} 秒,拿 2 颗小星星。`;
        } else {
          api.play("oops");
          line.textContent = "假人这次快了半步。换一档或者换一题,再来一局。";
        }
        board.appendChild(line);
      }
    });
  }

  // ---- 无尽:错三题结束 ----
  let endlessKind: EndlessKind = "mixed";

  function startEndless(): void {
    drop();
    const cfg = endlessConfig(endlessKind);
    let streak = 0;
    let wrongPuzzles = 0;
    let index = 0;
    let mistakeThisPuzzle = false;

    const scoreLine = document.createElement("div");
    scoreLine.className = "sp-msg";
    board.appendChild(scoreLine);
    const arena = document.createElement("div");
    board.appendChild(arena);

    const paint = (): void => {
      scoreLine.textContent = `连解 ${streak} 题 · 错 ${wrongPuzzles}/${cfg.errorLimit} 题 · ${cfg.hint}`;
    };

    const finish = (): void => {
      const best = save.recordEndlessBest(meta.id, streak);
      api.play(streak > 0 ? "win" : "oops");
      const line = document.createElement("div");
      line.className = "sp-msg";
      line.textContent = `这一轮连解 ${streak} 题,最高纪录 ${best} 题。歇一口气再来一轮。`;
      board.appendChild(line);
    };

    const nextPuzzle = (): void => {
      if (closed) return;
      table?.destroy();
      arena.innerHTML = "";
      if (wrongPuzzles >= cfg.errorLimit) {
        finish();
        return;
      }
      const lv = endlessPick(cfg, index, 7);
      const entry = bankAt(lv);
      const spec = levelSpec(lv);
      mistakeThisPuzzle = false;
      paint();
      table = createTable(arena, {
        goalText: `第 ${index + 1} 题 · ${goalLine(spec)}`,
        hint: "错三题这一轮就结束,慢一点没关系。",
        seats: [
          {
            name: "朵朵",
            who: "duo",
            entry,
            cell: cellPxFor(entry.n, viewportWidth(), 1),
            errorLimit: 0,
            hintTier: spec.tier,
            sfx: (s) => api.play(s),
            onError: () => {
              if (mistakeThisPuzzle) return;
              mistakeThisPuzzle = true;
              wrongPuzzles += 1;
              paint();
            },
            onDone: () => undefined
          }
        ],
        onOver: (states) => {
          if (states[0].solved) {
            streak += 1;
            api.addStars(1);
          }
          index += 1;
          paint();
          // 让开花动画放完再换下一题
          later(nextPuzzle, BLOOM_STEP_MS * 9 + BLOOM_MS);
        }
      });
    };

    paint();
    nextPuzzle();
  }

  // ---- 双人同屏:左右分盘同一题 ----
  let duoLevel = DUO_LEVELS[1];

  function startDuo(): void {
    drop();
    const entry = bankAt(duoLevel);
    const spec = levelSpec(duoLevel);
    const cell = cellPxFor(entry.n, viewportWidth(), 2);
    table = createTable(board, {
      goalText: "同一题,左右各种一片",
      hint: "朵朵用 W A S D 移动、F 种下、G 切铅笔;星星用方向键、L 种下、K 切铅笔。手机上直接点各自的数字钮。",
      seats: [
        {
          name: "🌸 朵朵",
          who: "duo",
          entry,
          cell,
          errorLimit: 0,
          hintTier: spec.tier,
          sfx: (s) => api.play(s),
          onDone: () => undefined
        },
        {
          name: "⭐ 星星",
          who: "star",
          entry,
          cell,
          errorLimit: 0,
          hintTier: spec.tier,
          sfx: (s) => api.play(s),
          onDone: () => undefined
        }
      ],
      onOver: (states, ms) => {
        api.play("win");
        const winner = states.find((s) => s.solved);
        const line = document.createElement("div");
        line.className = "sp-msg";
        line.textContent = winner
          ? `${winner.name} 先种满啦,用了 ${Math.round(ms / 1000)} 秒。换一题再来一局。`
          : "这一局到此为止,换一题再来一局。";
        board.appendChild(line);
      }
    });
  }

  function chip2(label: string, on: boolean, onClick: () => void): HTMLElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = on ? "sp-tool sp-on" : "sp-tool";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      api.play("tap");
      onClick();
    });
    return btn;
  }

  function paintSetup(): void {
    setup.innerHTML = "";
    if (mode === "versus") {
      for (const t of AI_TIERS) {
        setup.appendChild(
          chip2(AI_TIER_LABELS[t], t === tier, () => {
            tier = t;
            paintSetup();
            startVersus();
          })
        );
      }
      VERSUS_LEVELS.forEach((lv, i) => {
        setup.appendChild(
          chip2(`${CHAPTERS[i].emoji}`, lv === versusLevel, () => {
            versusLevel = lv;
            paintSetup();
            startVersus();
          })
        );
      });
    } else if (mode === "endless") {
      for (const k of ["mixed", "mini"] as EndlessKind[]) {
        setup.appendChild(
          chip2(endlessConfig(k).label, k === endlessKind, () => {
            endlessKind = k;
            paintSetup();
            startEndless();
          })
        );
      }
    } else {
      DUO_LEVELS.forEach((lv, i) => {
        setup.appendChild(
          chip2(`${CHAPTERS[i].emoji}`, lv === duoLevel, () => {
            duoLevel = lv;
            paintSetup();
            startDuo();
          })
        );
      });
    }
  }

  paintSetup();
  if (mode === "versus") startVersus();
  else if (mode === "endless") startEndless();
  else startDuo();

  return {
    destroy() {
      closed = true;
      for (const id of laters) clearTimeout(id);
      laters.clear();
      drop();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 模式入口条:按 meta.modes 推,不硬写
// ---------------------------------------------------------------------------

/** 这一款按 `meta.modes` 算出来的模式口径(首页玩法芯片读的是同一份 meta) */
export const MODE_COMPAT = compatFromMeta(meta);

/** 本款自己的入口名 ↔ 三大类的对应关系;顺序就是入口条从左到右的顺序 */
const MODE_ENTRIES: ModeEntry<ExtraMode>[] = [
  { key: "versus", kind: "versus", versusKind: "ai" },
  { key: "endless", kind: "endless" },
  { key: "duo", kind: "versus", versusKind: "hotseat" }
];

/**
 * 真正摆出来的入口。
 * 以前这里是硬写的 `["versus","endless","duo"]`,`meta.modes` 一改就与首页芯片各说各话;
 * 现在少写一个模式,入口条自己就少一个按钮。
 */
export const MODE_KEYS: ExtraMode[] = modeEntryKeys(MODE_COMPAT, MODE_ENTRIES);

/** 模式菜单顶上那句话,措辞走 `describeModes` 的共享口径,十二款不各写各的 */
export const MODE_SUMMARY = describeModes(MODE_COMPAT);

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = SP_CSS;
  const bar = document.createElement("div");
  bar.className = "sp-modebar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", MODE_SUMMARY);
  const modeTip = document.createElement("p");
  modeTip.className = "sp-modetip";
  modeTip.textContent = MODE_SUMMARY;
  bar.appendChild(modeTip);
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
  }

  MODE_KEYS.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sp-open";
    btn.textContent = MODE_TITLE[m];
    btn.addEventListener("click", () => {
      if (mode) return;
      api.play("tap");
      levelHost.hidden = true;
      bar.hidden = true;
      modeHost.hidden = false;
      mode = mountExtra(modeHost, api, m, closeMode);
    });
    bar.appendChild(btn);
  });

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "先找那些被围得只剩一种可能的格子,填完局面会自己松动。",
      grandMessage: "188 片花田全部种满,花田杯冠军就是你！",
      guide,
      guideTitle: "数独花田 · 种花笔记"
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    }
  };
}

/** 给测试钉住的关键常量 */
export const SP_CONSTS = {
  BLOOM_MS,
  BLOOM_STEP_MS,
  BLOOM_STEP_REDUCED_MS,
  POP_MS,
  BUD_MS,
  WAVE_STEP_MS,
  WAVE_MS,
  CHEER_STEP_MS,
  CHEER_MS,
  LINE_STEP_MS,
  LINE_MS,
  SHOWER_PETALS,
  SHOWER_MS,
  CELL_MIN_PX,
  CELL_MAX_PX,
  KEY_MIN_PX,
  FONT_MIN_PX
};

/** 给测试与冒烟脚本用的转发 */
export { bankAt, boardFromBank, solutionOfBank, variantOfBank, cellsFromString };
