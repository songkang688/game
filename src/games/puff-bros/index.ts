import { meta } from "./meta";
export { meta };

import {
  TOTAL_LEVELS,
  chapterOf,
  chapterStart,
  loadStars,
  mountLevelGame,
  saveStar,
  type Chapter,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
  type SoundName,
} from "../level99";
import { getLevelExtras } from "../../ui/level188Contract";
import { save } from "../../engine/save";
import GUIDE from "./guide";
import {
  ARENA_H,
  ARENA_W,
  CEILING_Y,
  CHAPTERS,
  FLOOR_H,
  FLOOR_Y,
  VERSUS_ROUND_TARGET,
  WALL,
  buildLevel,
  buildVersusArena,
  buildWave,
  type ArenaDef,
} from "./arena";
import {
  BRITTLE_REGROW,
  SPRING_RECHARGE,
  UPDRAFT_MAX_UP,
  WARP_R,
  brittlePhase,
  gadgetRect,
  type GadgetState,
} from "./gadgets";
import { SQUASH_TIME, squashScale as landingSquash } from "./feel";
import { PUFF_WINDUP, puffRing, squishScale as pushSquish, windupProgress } from "./push";
import { TUMBLE_TIME, tumbleProgress } from "./bounds";
import {
  CLIMB_BEST_KEY,
  SECTION_METERS,
  bottomLine,
  buildClimbSection,
  climbHeight,
  climbMessage,
  heightLine,
  lineY,
  parseClimbBest,
  rowOfSurface,
  serializeClimbBest,
} from "./updraft";
import {
  BOT_LEVELS,
  BOT_PROFILES,
  BUBBLE_R,
  MONSTER_H,
  MONSTER_W,
  PLAYER_H,
  PLAYER_W,
  ROUNDS_TO_WIN,
  applyRound,
  comboBonus,
  createWorld,
  drainEvents,
  emptyInput,
  endlessScore,
  isMatchOver,
  isPauseKey,
  keyToAction,
  matchWinner,
  newMatch,
  scoreLine,
  starsForRun,
  stepWorld,
  summarize,
  versusBotInput,
  winMessage,
  type BotLevel,
  type Input,
  type InputName,
  type MatchState,
  type World,
  type WorldEvent,
} from "./logic";
import { shade, withAlpha } from "../../art/kit/palette";
import { bubbleFilm, bubbleGloss, sheenAngle } from "../../art/kit/bubbleSkin";
import {
  BRO_KITS,
  CANDY_KINDS,
  PB_BUBBLE_HOLD,
  PB_COLORS,
  PB_WARP_A,
  PB_WARP_B,
  broBody,
  cloudScroll,
  cloudTint,
  drawCandy,
  drawDizzyStars,
  drawEventSpark,
  highFiveFrame,
  mouthState,
  paintBro,
  paintCloud,
  paintHighFive,
  paintPuffRing,
  shouldHighFive,
  skyForLevel,
  springCoilYs,
  swayAngle,
  updraftFeather,
  type SparkKind,
} from "./visual13";

// ---------------------------------------------------------------------------
// 配色:一章一套粉彩,统一走「泡泡糖 + 奶油色」的干净路子
// ---------------------------------------------------------------------------

interface Palette {
  sky0: string;
  sky1: string;
  far: string;
  /** 地板 / 浮台的表层色 */
  deck: string;
  /** 地板主体(一律很浅的粉彩,不要大片深色) */
  deckSoft: string;
  deco: string;
}

const PALETTES: Palette[] = [
  { sky0: "#EAF6FF", sky1: "#FDF2FA", far: "#CFE6F7", deck: "#8FC3E8", deckSoft: "#DCEEFB", deco: "#63A9DA" },
  { sky0: "#F1FBE8", sky1: "#FBFFF2", far: "#D3EDBE", deck: "#9AD07C", deckSoft: "#E3F5D5", deco: "#6FB552" },
  { sky0: "#EFF3FE", sky1: "#FAFBFF", far: "#D5DDF4", deck: "#A5B4E4", deckSoft: "#E4E9FA", deco: "#7C8DD1" },
  { sky0: "#E8F7F8", sky1: "#F6FEFF", far: "#C4E7EB", deck: "#7FC9D2", deckSoft: "#D8F1F4", deco: "#4FADB9" },
  { sky0: "#FFF0F6", sky1: "#FFF9FB", far: "#FAD3E3", deck: "#F3A5C4", deckSoft: "#FCE0EC", deco: "#E27CA5" },
  { sky0: "#FFF8E6", sky1: "#FFFDF4", far: "#F7E4AF", deck: "#F2C75E", deckSoft: "#FBEDC6", deco: "#DCA82E" },
  { sky0: "#F5EEFF", sky1: "#FCF8FF", far: "#DFCFF6", deck: "#B79AE6", deckSoft: "#EADFFA", deco: "#8E6BD0" },
  { sky0: "#FFF1E8", sky1: "#FFF9F4", far: "#FAD6BE", deck: "#F0A87C", deckSoft: "#FBE2D0", deco: "#D4814F" },
];

/**
 * 两位噗噗兄弟:骨架与配色都住在 `visual13.ts` 的 `BRO_KITS` 里 ——
 * 哥哥朵朵(翘呆毛 / 背带裤 / 圆耳朵)、弟弟星星(圆边小帽 / 围兜 / 后脑揪揪)。
 * 几何只算一次,渲染层直接引用。
 */
const BRO_GEOMS = [broBody(0), broBody(1)] as const;
const BRO_NAMES = [BRO_KITS[0].name, BRO_KITS[1].name] as const;

/** 三种咕噜怪的配色 */
const GOO = {
  walker: { body: "#7ED8C3", dark: "#4FB6A0", face: "#2F6D60", label: "咕噜怪" },
  hopper: { body: "#FFD36E", dark: "#E0AE3C", face: "#7A5410", label: "蹦蹦怪" },
  chaser: { body: "#FF9A8B", dark: "#DE6E5E", face: "#7C3225", label: "追追怪" },
};

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

/**
 * 触屏按键的最小热区(px)。
 *
 * 1.1 的双人并排会把按键缩到 36px,360px 的手机上小朋友按十次错三次。
 * 1.2 把每一套控件从 4 列改成 3 列(⬆ 🫧 💨 / ◀ ⬇ ▶),
 * 于是 360px 上两套并排也还剩得下 44px —— 这个数字是下限,不是目标值。
 */
export const TOUCH_MIN = 44;

const CSS = `
.pfb-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;position:relative;}
.pfb-hud{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
/* 计数卡片化:白瓷卡 + 细边 + 顶光,徽章与数字排一行 */
.pfb-chip{background:linear-gradient(180deg,#FFFFFF,#F3FAFF);border:1px solid rgba(150,180,210,.28);
  border-radius:999px;padding:4px 10px;font-size:14px;font-weight:800;color:#3F5C77;
  box-shadow:0 2px 6px rgba(110,140,175,.24);white-space:nowrap;
  display:inline-flex;align-items:center;gap:4px;}
.pfb-chip-a{background:linear-gradient(180deg,#FFEDF5,#FFE0EE);color:#A33C6C;}
.pfb-chip-b{background:linear-gradient(180deg,#E9F3FE,#DAEAFB);color:#2F5A8C;}
.pfb-badge{width:17px;height:24px;display:inline-block;}
.pfb-bar{position:relative;flex:1;min-width:104px;height:20px;border-radius:999px;background:#ffffffcc;
  overflow:hidden;box-shadow:inset 0 1px 3px rgba(100,130,165,.28);}
.pfb-bar-fill{height:100%;width:0%;border-radius:999px;transition:width .16s linear;
  background:linear-gradient(90deg,#9BD9F5,#F7A8CC);}
/* 一行放不下就横着裁掉,绝不折成两行 —— 20px 高的条子折两行会糊成一团 */
.pfb-bar-txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:14px;font-weight:900;color:#33526E;white-space:nowrap;overflow:hidden;}
.pfb-btn{border:none;border-radius:999px;padding:5px 12px;font-size:14px;font-weight:900;cursor:pointer;
  min-width:${TOUCH_MIN}px;min-height:${TOUCH_MIN}px;display:inline-flex;align-items:center;justify-content:center;
  font-family:inherit;background:#ffffffdd;color:#3F5C77;box-shadow:0 3px 0 rgba(110,140,175,.32);}
.pfb-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(110,140,175,.32);}
.pfb-btn:focus-visible,.pfb-key:focus-visible,.pfb-mode:focus-visible,.pfb-veil-btn:focus-visible,
.pfb-pick:focus-visible{outline:3px solid #274766;outline-offset:2px;}
.pfb-stagebox{position:relative;border-radius:16px;overflow:hidden;background:#EEF7FF;margin:0 auto;
  box-shadow:0 4px 12px rgba(110,140,175,.26);}
/* 这个高度只是脚本量出真正剩余空间之前的垫底值,量完会被行内样式盖掉 */
.pfb-cv{display:block;width:100%;height:300px;}
.pfb-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;text-align:center;padding:16px;background:rgba(246,252,255,.94);}
.pfb-veil-title{font-size:20px;font-weight:900;color:#2F5A8C;}
.pfb-veil-sub{font-size:14px;font-weight:700;color:#4E7295;line-height:1.6;max-width:340px;}
.pfb-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.pfb-veil-btn{border:none;border-radius:16px;padding:10px 20px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#F79BB8,#DE6E97);box-shadow:0 4px 0 #B95278;}
.pfb-veil-btn.pfb-ghost{background:linear-gradient(180deg,#8FBEE8,#6A97CC);box-shadow:0 4px 0 #4F79A8;}
.pfb-veil-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #B95278;}
.pfb-toast{position:absolute;left:50%;top:10px;transform:translateX(-50%);background:#ffffffee;border-radius:999px;
  padding:5px 14px;font-size:13px;font-weight:800;color:#2F5A8C;box-shadow:0 3px 8px rgba(110,140,175,.3);
  pointer-events:none;opacity:0;transition:opacity .25s ease;max-width:90%;text-align:center;}
.pfb-toast.pfb-on{opacity:1;}
/* 两个人各占半边屏:space-between 把两套控件顶到左右两头,中间那条空档
   既是「这半边是你的」的分界,也保证两个人的拇指不会在中线上打架 */
.pfb-pads{display:flex;justify-content:space-between;gap:10px;margin-top:8px;--k:58px;}
.pfb-pads[data-pads="1"]{justify-content:center;}
.pfb-pads[data-pads="2"]{--k:52px;}
/* 第一行是键位说明,按字数占多高就多高:按钮的行号是写死的,
   要是让它跟按钮一样高,说明藏起来之后会在这儿留一个空行 */
.pfb-pad{display:grid;grid-template-columns:repeat(3,var(--k));grid-template-rows:auto var(--k) var(--k);
  grid-auto-rows:var(--k);gap:5px;justify-content:center;}
.pfb-pad-name{grid-column:1/-1;font-size:11px;font-weight:800;color:#3F5C77;text-align:center;line-height:1.3;}
.pfb-key{border:none;border-radius:14px;font-size:20px;font-weight:900;cursor:pointer;font-family:inherit;
  background:#ffffffe0;color:#3F5C77;box-shadow:0 3px 0 rgba(110,140,175,.34);touch-action:none;padding:0;
  min-width:${TOUCH_MIN}px;min-height:${TOUCH_MIN}px;}
.pfb-key:active,.pfb-key.pfb-down{transform:translateY(2px);box-shadow:0 1px 0 rgba(110,140,175,.34);
  background:#DCEEFB;}
.pfb-key-act{background:#FFE0EC;color:#A33C6C;}
.pfb-key-sub{background:#E2F3E0;color:#3B7A46;}
.pfb-tip{margin-top:6px;text-align:center;font-size:12px;font-weight:700;color:#5B7C9C;line-height:1.5;}
.pfb-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
/* display:flex 会盖掉 hidden 属性自带的 display:none,进了某个模式就得把这排按钮收起来 */
.pfb-modebar[hidden]{display:none;}
.pfb-mode{border:none;border-radius:999px;padding:9px 18px;font-size:14px;font-weight:900;color:#fff;
  min-height:${TOUCH_MIN}px;cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#7FC4E8,#5AA0CB);box-shadow:0 4px 0 #46809F;}
.pfb-mode.pfb-mode-duel{background:linear-gradient(180deg,#F79BB8,#DE6E97);box-shadow:0 4px 0 #B95278;}
.pfb-mode.pfb-mode-bot{background:linear-gradient(180deg,#B79AE6,#9375CD);box-shadow:0 4px 0 #7256A6;}
.pfb-mode.pfb-mode-coop{background:linear-gradient(180deg,#9AD07C,#78B45B);box-shadow:0 4px 0 #5E9146;}
.pfb-mode.pfb-mode-climb{background:linear-gradient(180deg,#7FD8CE,#4FAFA6);box-shadow:0 4px 0 #3C8B84;}
.pfb-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #46809F;}
.pfb-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
.pfb-head-title{flex:1;text-align:center;font-size:15px;font-weight:900;color:#2F5A8C;}
.pfb-picker{display:flex;flex-direction:column;gap:10px;align-items:center;padding:14px 10px;}
.pfb-picker[hidden]{display:none;}
.pfb-picker-title{font-size:17px;font-weight:900;color:#2F5A8C;}
.pfb-picks{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}
.pfb-pick{border:none;border-radius:18px;padding:12px 16px;min-width:132px;cursor:pointer;font-family:inherit;
  background:#ffffffee;box-shadow:0 4px 0 rgba(110,140,175,.3);text-align:center;}
.pfb-pick:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(110,140,175,.3);}
.pfb-pick-name{font-size:16px;font-weight:900;color:#2F5A8C;}
.pfb-pick-sub{margin-top:4px;font-size:12px;font-weight:700;color:#5B7C9C;line-height:1.4;}
.pfb-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
.pfb-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px;}
.pfb-open{border:none;border-radius:16px;padding:10px 18px;min-height:${TOUCH_MIN}px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#7FC4E8,#5AA0CB);box-shadow:0 4px 0 #46809F;}
.pfb-done{text-align:center;padding:18px 12px;font-size:16px;font-weight:800;color:#2F5A8C;line-height:1.7;}
@media (max-width:420px){
  .pfb-cv{height:210px;}
  /* 360px 上两套并排:3 列 × 44 + 两道 5px 缝 = 142,两套加中间 10px 缝共 294,
     余下的宽度留给外壳的内边距。热区一格都不许低于 TOUCH_MIN */
  .pfb-pads{--k:50px;margin-top:6px;}
  .pfb-pads[data-pads="2"]{--k:${TOUCH_MIN}px;gap:10px;}
  /* HUD 挤成一行也不许把字缩小:看不清心还剩几颗,这一行就白摆了 */
  .pfb-hud{gap:4px;margin-bottom:4px;flex-wrap:nowrap;}
  .pfb-chip{font-size:14px;padding:3px 7px;}
  .pfb-bar{min-width:56px;height:20px;}
  .pfb-btn{padding:5px 9px;}
  .pfb-lbl{display:none;}
  .pfb-tip{font-size:11px;margin-top:4px;}
  .pfb-pad-name{font-size:10px;}
}
/* 触屏设备用不上键盘提示,省下的高度留给画面 */
@media (hover:none) and (max-width:420px){ .pfb-pad-name{display:none;} }
@media (max-height:620px){
  .pfb-cv{height:170px;}
  .pfb-pads{--k:${TOUCH_MIN}px;margin-top:4px;}
  .pfb-pads[data-pads="2"]{--k:${TOUCH_MIN}px;}
  .pfb-tip{margin-top:4px;font-size:11px;}
}
/* N-42 / C-8: 矮横屏把六键垫到画布右侧，暂停钮已抬到 44 */
@media (max-height:500px) and (min-width:640px){
  .pfb-wrap{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;column-gap:8px;}
  .pfb-hud{grid-column:1/-1;}
  .pfb-stagebox{grid-column:1;min-width:0;}
  .pfb-pads{grid-column:2;grid-row:2;margin-top:0;flex-direction:column;justify-content:flex-start;}
  .pfb-tip{grid-column:1/-1;}
}
@media (max-height:840px) and (min-height:501px) and (min-width:640px){
  .pfb-wrap{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;column-gap:10px;}
  .pfb-hud{grid-column:1/-1;}
  .pfb-stagebox{grid-column:1;min-width:0;}
  .pfb-pads{grid-column:2;grid-row:2;margin-top:0;flex-direction:column;justify-content:flex-start;position:sticky;top:0;}
  .pfb-tip{grid-column:1/-1;}
}
@media (max-height:840px) and (min-height:501px) and (max-width:639px){
  .pfb-pads{position:sticky;bottom:0;z-index:4;padding-top:4px;}
}
@media (prefers-reduced-motion:reduce){ .pfb-toast{transition:none;} }
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

// 修复员 G5:emojiAt 助手随最后一批画布 emoji 字形(飘字粒子)一起退休。

/**
 * 系统里勾了「减弱动效」没有。
 *
 * 勾了的话压扁、旋转、气泡上浮这些**形变与动画**一律按静止画,
 * 但位移、判定、玩法一个字不改 —— 关掉的是花哨,不是游戏。
 */
function reducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 机关的画法:五种机关各画各的,一眼要能认出「这是干什么用的」
// ---------------------------------------------------------------------------

const GADGET_ART = {
  updraft: { wall: "rgba(126,216,206,.85)", glow: "rgba(168,238,231,.42)" },
  crate: { body: "#F8DCB0", edge: "#D8A96C", tie: "#F19BB6" },
  brittle: { body: "#E9F0F8", edge: "#B5C8DE", crack: "#7C92AA" },
  spring: { body: "#FFF6FA", edge: "#F3B4CE" },
  warp: { ring: "#8FBEF5", core: "rgba(214,236,255,.7)" },
};

/** 气流管:一根半透明的管子,里面几颗小气泡一路往上飘 */
function drawUpdraft(g: CanvasRenderingContext2D, gs: GadgetState, t: number): void {
  const r = gadgetRect(gs);
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  g.save();
  const grad = g.createLinearGradient(0, r.y1, 0, r.y0);
  grad.addColorStop(0, "rgba(168,238,231,.10)");
  grad.addColorStop(1, GADGET_ART.updraft.glow);
  g.fillStyle = grad;
  roundRect(g, r.x0, r.y0, w, h, 10);
  g.fill();
  g.strokeStyle = GADGET_ART.updraft.wall;
  g.lineWidth = 2;
  g.setLineDash([7, 6]);
  g.beginPath();
  g.moveTo(r.x0 + 1, r.y1);
  g.lineTo(r.x0 + 1, r.y0);
  g.moveTo(r.x1 - 1, r.y1);
  g.lineTo(r.x1 - 1, r.y0);
  g.stroke();
  g.setLineDash([]);
  // 半透明羽毛旋涡:几片小羽毛左右交替、边转边升 —— 「气是往上走的」这一点
  // 比原来的圆点更看得见;reduced 时 t 恒 0,羽毛静止排成一串
  for (let i = 0; i < 4; i++) {
    const f = updraftFeather(i, t, UPDRAFT_MAX_UP / 120);
    const fx = r.x0 + w * f.x01;
    const fy = r.y1 - f.y01 * h;
    g.save();
    g.translate(fx, fy);
    g.rotate(f.rot);
    g.fillStyle = "rgba(255,255,255,.72)";
    g.beginPath();
    g.ellipse(0, 0, 6.4, 2.3, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(126,216,206,.75)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-5, 0);
    g.lineTo(5.4, 0);
    g.stroke();
    g.restore();
  }
  g.restore();
}

/** 可推箱:软木糖果箱 —— 木纹板缝 + 四角角铁,推得动、也能垫脚 */
function drawCrate(g: CanvasRenderingContext2D, gs: GadgetState): void {
  const r = gadgetRect(gs);
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  g.save();
  g.fillStyle = GADGET_ART.crate.body;
  roundRect(g, r.x0, r.y0, w, h, 6);
  g.fill();
  // 三块横板:两道板缝 + 每块板一条浅浅的木纹波线
  g.strokeStyle = shade(GADGET_ART.crate.body, -16);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(r.x0 + 2, r.y0 + h / 3);
  g.lineTo(r.x1 - 2, r.y0 + h / 3);
  g.moveTo(r.x0 + 2, r.y0 + (h * 2) / 3);
  g.lineTo(r.x1 - 2, r.y0 + (h * 2) / 3);
  g.stroke();
  g.strokeStyle = withAlpha(shade(GADGET_ART.crate.edge, -12), 0.5);
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    const gy = r.y0 + (h * (i + 0.5)) / 3;
    g.moveTo(r.x0 + w * 0.16, gy);
    g.quadraticCurveTo(r.x0 + w * 0.5, gy + (i % 2 === 0 ? 2 : -2), r.x1 - w * 0.16, gy);
  }
  g.stroke();
  g.strokeStyle = GADGET_ART.crate.edge;
  g.lineWidth = 2;
  roundRect(g, r.x0, r.y0, w, h, 6);
  g.stroke();
  // 四角角铁:小 L 形,箱子一下子「结实」起来
  g.strokeStyle = shade(GADGET_ART.crate.edge, -22);
  g.lineWidth = 2.4;
  const arm = Math.min(7, w * 0.22);
  g.beginPath();
  for (const [cx, cy, dx, dy] of [
    [r.x0 + 2, r.y0 + 2, 1, 1],
    [r.x1 - 2, r.y0 + 2, -1, 1],
    [r.x0 + 2, r.y1 - 2, 1, -1],
    [r.x1 - 2, r.y1 - 2, -1, -1],
  ] as const) {
    g.moveTo(cx + dx * arm, cy);
    g.lineTo(cx, cy);
    g.lineTo(cx, cy + dy * arm);
  }
  g.stroke();
  g.restore();
}

/**
 * 脆弱地板:完好时是一块干净的云板,踩一下裂出纹路(**预警**),再踩就碎。
 * 碎掉之后留一圈虚线,好让小朋友知道「这儿等会儿还会长回来」。
 */
function drawBrittle(g: CanvasRenderingContext2D, gs: GadgetState): void {
  const r = gadgetRect(gs);
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  const phase = brittlePhase(gs);
  g.save();
  if (phase === "gone") {
    g.globalAlpha = 0.35 + 0.4 * (1 - gs.regrow / BRITTLE_REGROW);
    g.strokeStyle = GADGET_ART.brittle.edge;
    g.lineWidth = 2;
    g.setLineDash([5, 5]);
    roundRect(g, r.x0, r.y0, w, h, 4);
    g.stroke();
    g.setLineDash([]);
    g.restore();
    return;
  }
  g.fillStyle = GADGET_ART.brittle.body;
  roundRect(g, r.x0, r.y0, w, h, 4);
  g.fill();
  g.strokeStyle = GADGET_ART.brittle.edge;
  g.lineWidth = 2;
  g.stroke();
  if (phase === "cracked") {
    g.strokeStyle = GADGET_ART.brittle.crack;
    g.lineWidth = 1.6;
    g.beginPath();
    for (let i = 1; i <= 3; i++) {
      const cx = r.x0 + (w * i) / 4;
      g.moveTo(cx - 5, r.y0);
      g.lineTo(cx, r.y0 + h / 2);
      g.lineTo(cx + 4, r.y1);
    }
    g.stroke();
  }
  g.restore();
}

/**
 * 弹簧云:软软的一朵,刚弹过的那一下会扁一点点。
 * 云底下露出一小截螺旋圈 —— 圈数固定、总高随压缩缩短,**圈距自动变密**,
 * 压缩量照旧只读 `gs.recharge / SPRING_RECHARGE`,一个字不改。
 */
function drawSpring(g: CanvasRenderingContext2D, gs: GadgetState, motion: boolean): void {
  const r = gadgetRect(gs);
  const w = r.x1 - r.x0;
  const squash = motion && gs.recharge > 0 ? (gs.recharge / SPRING_RECHARGE) * 0.4 : 0;
  const h = (r.y1 - r.y0) * (1 - squash);
  g.save();
  g.fillStyle = GADGET_ART.spring.body;
  g.strokeStyle = GADGET_ART.spring.edge;
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(r.x0 + w * 0.26, r.y0 + h * 0.4, w * 0.26, h * 1.5, 0, 0, Math.PI * 2);
  g.ellipse(r.x0 + w * 0.5, r.y0 + h * 0.2, w * 0.3, h * 1.9, 0, 0, Math.PI * 2);
  g.ellipse(r.x0 + w * 0.75, r.y0 + h * 0.4, w * 0.26, h * 1.5, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // 螺旋圈叠在云面下半区:从底座往上排,压缩时同样的圈挤进更矮的高度里
  g.strokeStyle = withAlpha(shade(GADGET_ART.spring.edge, -8), 0.9);
  g.lineWidth = 1.8;
  g.beginPath();
  for (const cy of springCoilYs(r.y1 + 10, 22, squash)) {
    g.ellipse(r.x0 + w * 0.5, cy, w * 0.18, 2.4, 0, 0, Math.PI * 2);
  }
  g.stroke();
  g.restore();
}

/** 传送泡:一颗泡泡,里面有一圈打转的光。刚用过的那阵子它是暗的 */
function drawWarp(g: CanvasRenderingContext2D, gs: GadgetState, t: number, motion: boolean): void {
  const cx = gs.def.x;
  const cy = gs.def.y - WARP_R;
  const cooling = gs.warpCd.some((c) => c > 0);
  g.save();
  g.globalAlpha = cooling ? 0.4 : 1;
  const grad = g.createRadialGradient(cx - WARP_R * 0.3, cy - WARP_R * 0.3, WARP_R * 0.2, cx, cy, WARP_R);
  grad.addColorStop(0, "rgba(255,255,255,.95)");
  grad.addColorStop(1, GADGET_ART.warp.core);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, WARP_R, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = GADGET_ART.warp.ring;
  g.lineWidth = 2.5;
  g.stroke();
  // 双色旋涡互为反色:泡泡蓝顺时针、反色琥珀逆时针,一眼认出「这是要转走的」
  const spin = motion ? t * 2.2 : 0;
  g.strokeStyle = withAlpha(PB_WARP_A, 0.95);
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, WARP_R * 0.55, spin, spin + Math.PI * 1.2);
  g.stroke();
  g.strokeStyle = withAlpha(PB_WARP_B, 0.6);
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, WARP_R * 0.34, Math.PI - spin, Math.PI - spin + Math.PI * 1.2);
  g.stroke();
  g.restore();
}

function drawGadget(g: CanvasRenderingContext2D, gs: GadgetState, t: number, motion: boolean): void {
  switch (gs.def.kind) {
    case "updraft":
      drawUpdraft(g, gs, motion ? t : 0);
      return;
    case "crate":
      drawCrate(g, gs);
      return;
    case "brittle":
      drawBrittle(g, gs);
      return;
    case "spring":
      drawSpring(g, gs, motion);
      return;
    default:
      drawWarp(g, gs, t, motion);
  }
}

// ---------------------------------------------------------------------------
// 场地:一块画布 + 一套操作 + 一个世界
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vy: number;
  life: number;
  /** 修复员 G5:emoji 字形 → 矢量小图种类 */
  art: SparkKind;
  size: number;
}

interface VeilButton {
  label: string;
  ghost?: boolean;
  onClick: () => void;
}

interface FieldOpts {
  def: ArenaDef;
  /** 场上有几个角色 */
  players: 1 | 2;
  /** 其中几个是真人(剩下的交给人机) */
  humans: 1 | 2;
  /** 人机档位(humans < players 时才用得上) */
  botLevel?: BotLevel;
  sfx: (name: SoundName) => void;
  title: string;
  tip: string;
  showTimer: boolean;
  extraChip?: (w: World) => string;
  /** 盖掉 HUD 那条进度条的内容(上升气流量的是高度,不是清了几只怪) */
  progress?: (w: World) => { fill: number; text: string };
  /** 每一帧推进完世界之后叫一次(上升气流靠它记「爬到过第几层」) */
  onTick?: (w: World) => void;
  onEnd: (w: World) => void;
  onQuit?: () => void;
}

interface Field {
  destroy: () => void;
  world: () => World;
  /** 换一张图接着玩(无尽 / 对战下一局用) */
  swap: (def: ArenaDef, keep?: { hearts?: number }) => void;
  showVeil: (title: string, sub: string, buttons: VeilButton[]) => void;
  toast: (text: string) => void;
}

const SFX_FOR_EVENT: Partial<Record<WorldEvent["kind"], SoundName>> = {
  jump: "jump",
  double: "jump",
  puff: "pop",
  spring: "jump",
  crack: "tap",
  warp: "coin",
  tumble: "oops",
  blow: "pop",
  catch: "coin",
  pop: "pop",
  burst: "oops",
  candy: "coin",
  hurt: "oops",
  escape: "tap",
  combo: "meow",
  win: "win",
  lose: "oops",
};

// 修复员 G5:飘字粒子从 13 只 emoji 换矢量小图(泡 / 风 / 云 / 星屑 / 旋涡 / 晕星 / 糖 / 大星)
const PARTICLE_FOR_EVENT: Partial<Record<WorldEvent["kind"], SparkKind>> = {
  double: "bubble",
  puff: "gust",
  spring: "cloud",
  crack: "spark",
  warp: "swirl",
  tumble: "twinkle",
  catch: "bubble",
  pop: "spark",
  burst: "gust",
  candy: "candy",
  hurt: "twinkle",
  escape: "twinkle",
  combo: "star",
};

/**
 * 一套控件六颗键,排成 3 列 × 2 行:
 *
 * ```
 *  ⬆   🫧   💨
 *  ◀   ⬇   ▶
 * ```
 *
 * 下面一排是走路(左 / 蹲 / 右),拇指自然落在那儿;上面一排是跳和两口气。
 * 1.1 排的是 4 列,双人并排时每颗只剩 36px;砍掉一列之后 360px 上也还有
 * `TOUCH_MIN` 那么大。
 */
const PAD_KEYS: Array<{ act: InputName; label: string; cls?: string; aria: string; col: number; row: number }> = [
  { act: "up", label: "⬆", aria: "跳(空中再按一下是二段跳)", col: 1, row: 2 },
  { act: "act", label: "🫧", cls: "pfb-key-act", aria: "吹一个泡泡糖气泡", col: 2, row: 2 },
  {
    act: "sub",
    label: "💨",
    cls: "pfb-key-sub",
    aria: "噗一口气:戳破泡泡、吹开对手、推动箱子;空中没打着东西就把自己推出去",
    col: 3,
    row: 2,
  },
  { act: "left", label: "◀", aria: "往左", col: 1, row: 3 },
  { act: "down", label: "⬇", aria: "蹲下(配合跳可以穿过浮台;站在传送泡上按它就传送)", col: 2, row: 3 },
  { act: "right", label: "▶", aria: "往右", col: 3, row: 3 },
];

function createField(host: HTMLElement, opts: FieldOpts): Field {
  let world = createWorld(opts.def, { players: opts.players });
  let destroyed = false;
  let ended = false;
  let paused = false;
  let raf = 0;
  let lastTime = 0;
  let toastT = 0;
  /** 过关那一刻的时间戳(ms):>= 0 时画击掌合影;换场 / 重开就归 -1 */
  let wonAt = -1;
  const particles: Particle[] = [];
  const inputs: Input[] = [emptyInput(), emptyInput()];
  const sfxAt = new Map<SoundName, number>();
  const padCount = opts.humans;
  const motion = !reducedMotion();

  const wrap = el("div", "pfb-wrap");
  wrap.dataset.pads = String(padCount);
  const style = el("style");
  style.textContent = CSS;
  wrap.appendChild(style);

  // ---- HUD ----
  // 对战里左右两枚计分卡各带一枚兄弟头像徽章(程序化小画布,非位图);
  // 合作模式徽章收起来,卡片照旧写心和糖
  const hud = el("div", "pfb-hud");
  const leftChip = el("span", "pfb-chip");
  const leftBadge = el("canvas", "pfb-badge");
  const leftTxt = el("span");
  leftChip.append(leftBadge, leftTxt);
  const bar = el("div", "pfb-bar");
  const barFill = el("div", "pfb-bar-fill");
  const barTxt = el("span", "pfb-bar-txt");
  bar.append(barFill, barTxt);
  const rightChip = el("span", "pfb-chip");
  const rightBadge = el("canvas", "pfb-badge");
  const rightTxt = el("span");
  rightChip.append(rightBadge, rightTxt);

  /** 头像徽章:直接用 broBody 骨架画一位小噗噗(不落影、常态表情) */
  function paintBadge(cv: HTMLCanvasElement, pi: number): void {
    cv.width = 34;
    cv.height = 48;
    const bctx = cv.getContext("2d");
    if (!bctx) return;
    bctx.translate(17, 44);
    paintBro(bctx, BRO_GEOMS[pi % BRO_GEOMS.length], {
      facing: 1,
      sway: 0,
      mouth: { kind: "idle" },
      grounded: false,
    });
  }
  paintBadge(leftBadge, 0);
  paintBadge(rightBadge, 1);
  const timerChip = el("span", "pfb-chip");
  const extraChip = el("span", "pfb-chip");
  const pauseBtn = el("button", "pfb-btn");
  pauseBtn.type = "button";
  pauseBtn.innerHTML = `⏸<span class="pfb-lbl"> 暂停</span>`;
  pauseBtn.setAttribute("aria-label", "暂停(也可以按 Esc)");
  hud.append(leftChip, bar, rightChip);
  if (opts.showTimer) hud.appendChild(timerChip);
  if (opts.extraChip) hud.appendChild(extraChip);
  hud.appendChild(pauseBtn);
  wrap.appendChild(hud);

  // ---- 画布 ----
  const box = el("div", "pfb-stagebox");
  const canvas = el("canvas", "pfb-cv");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${opts.title}:噗噗兄弟正在吹泡泡糖气流`);
  const toastEl = el("div", "pfb-toast");
  box.append(canvas, toastEl);
  wrap.appendChild(box);

  // ---- 触屏按键 ----
  const pads = el("div", "pfb-pads");
  pads.dataset.pads = String(padCount);
  const padButtons: Array<{ btn: HTMLButtonElement; player: number; act: InputName }> = [];
  for (let pi = 0; pi < padCount; pi++) {
    const pad = el("div", "pfb-pad");
    pad.appendChild(
      el(
        "div",
        "pfb-pad-name",
        padCount === 1
          ? "WASD / 方向键移动 · F 或 L 吹泡泡 · G 或 K 噗一口"
          : pi === 0
            ? "朵朵 · W A S D · F 吹 · G 噗"
            : "星星 · ↑←↓→ · L 吹 · K 噗"
      )
    );
    for (const k of PAD_KEYS) {
      const btn = el("button", `pfb-key${k.cls ? ` ${k.cls}` : ""}`, k.label);
      btn.type = "button";
      btn.style.gridColumn = String(k.col);
      btn.style.gridRow = String(k.row);
      btn.setAttribute("aria-label", `${padCount === 2 ? BRO_NAMES[pi] : ""}${k.aria}`);
      pad.appendChild(btn);
      padButtons.push({ btn, player: pi, act: k.act });
    }
    pads.appendChild(pad);
  }
  wrap.appendChild(pads);

  const tip = el("div", "pfb-tip", opts.tip);
  wrap.appendChild(tip);
  host.appendChild(wrap);

  const g = canvas.getContext("2d");

  // ---- 画面高度 ----
  // 外壳不滚动,超出窗口的部分是直接看不见的,所以画面高度不能写死:
  // 量一下画布上边到窗口底之间还剩多少,再扣掉底下按键和提示语占的那一截,
  // 剩下的全给画面。
  /** 画面底下留一点空,不要顶死窗口边 */
  const VIEW_PAD = 10;
  /** 再挤也得看得清人在哪儿 */
  const VIEW_MIN = 150;

  /**
   * 往下最多画到哪儿。
   *
   * 光看窗口高度不够:外壳一路上套着几层 overflow:hidden,提示语可能在够到
   * 窗口底之前就先被外壳裁掉了。但这几层里也有一部分是被内容自己撑起来的 ——
   * 画面多高它们就多高,拿它们当天花板,画面就再也长不大了。
   *
   * 所以把画面缩一下,看谁的下沿跟着一起动:动了的是被撑起来的,不算数;
   * 纹丝不动的才是真的天花板。
   */
  function bottomLimit(): number {
    const walls: HTMLElement[] = [];
    for (let e: HTMLElement | null = wrap.parentElement; e; e = e.parentElement) {
      if (getComputedStyle(e).overflowY !== "visible") walls.push(e);
    }
    if (walls.length === 0) return window.innerHeight;

    const before = walls.map((e) => e.getBoundingClientRect().bottom);
    const keep = canvas.style.height;
    canvas.style.height = `${Math.max(1, canvas.getBoundingClientRect().height - 40)}px`;
    const after = walls.map((e) => e.getBoundingClientRect().bottom);
    canvas.style.height = keep;

    let limit = window.innerHeight;
    for (let i = 0; i < walls.length; i++) {
      if (Math.abs(after[i] - before[i]) < 1) limit = Math.min(limit, before[i]);
    }
    return limit;
  }

  function fitCanvas(): void {
    // 宽度按 wrap 量,不按画框自己量 —— 下面会把画框改窄,拿它当基准会越量越窄
    const availW = wrap.clientWidth;
    if (availW <= 0) return;
    const boxRect = box.getBoundingClientRect();
    // 按键和提示语的高度跟画面多高无关,所以这一段量出来是稳的,不会跟着自己变
    const below = wrap.getBoundingClientRect().bottom - boxRect.bottom;
    const room = bottomLimit() - boxRect.top - below - VIEW_PAD;
    // 比场地本身还高只会多出两条天空,不如把余量留给别人
    const aspect = ARENA_W / ARENA_H;
    const cap = room > 0 ? room : VIEW_MIN;
    const h = Math.round(Math.max(96, Math.min(cap, availW / aspect)));
    // 场地是等比缩放居中画的,画框比它宽多少,左右就空多少;
    // 干脆把画框收到跟场地一样宽,圆角正好贴着围墙
    const w = Math.round(Math.min(availW, h * aspect));
    if (Math.abs(h - canvas.getBoundingClientRect().height) < 1 && Math.abs(w - boxRect.width) < 1) return;
    canvas.style.height = `${h}px`;
    box.style.width = `${w}px`;
  }

  // 模式按钮换行、外壳收起标题栏都会顶得画面上下移动,窗口尺寸却没变,
  // 所以除了 resize 还得盯着容器自己
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function") {
    ro = new ResizeObserver(() => fitCanvas());
    ro.observe(host);
  }
  window.addEventListener("resize", fitCanvas);
  fitCanvas();

  // ---- 输入 ----
  function setKey(player: number, act: InputName, down: boolean): void {
    const slot = inputs[player];
    if (!slot) return;
    slot[act] = down;
  }

  /**
   * 这颗键是被哪根手指按住的。
   *
   * 1.1 在 window 上挂了一条「抬手就全松」:两个人同屏时,朵朵抬一下手会把
   * 星星正按着的键也一起清掉,人当场定在原地。这里记住按下时的 `pointerId`,
   * window 上那条只松掉**同一根手指**按着的键,另一个人按着的原样留着。
   */
  const heldBy = new Map<HTMLButtonElement, number>();

  function release(entry: { btn: HTMLButtonElement; player: number; act: InputName }): void {
    heldBy.delete(entry.btn);
    entry.btn.classList.remove("pfb-down");
    setKey(entry.player, entry.act, false);
  }

  for (const entry of padButtons) {
    const { btn, player, act } = entry;
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      heldBy.set(btn, e.pointerId ?? -1);
      btn.classList.add("pfb-down");
      setKey(player, act, true);
    });
    const up = (): void => release(entry);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  }

  /** 松掉这根手指按着的键;不给 id(失焦、退出)就一颗不留全松掉 */
  const releaseAll = (pointerId?: number): void => {
    for (const entry of padButtons) {
      if (pointerId !== undefined && heldBy.get(entry.btn) !== pointerId) continue;
      release(entry);
    }
  };
  const onWindowPointerUp = (e: PointerEvent): void => releaseAll(e.pointerId ?? -1);
  const onWindowBlur = (): void => releaseAll();
  window.addEventListener("pointerup", onWindowPointerUp);
  window.addEventListener("blur", onWindowBlur);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isPauseKey(e.code)) {
      e.preventDefault();
      togglePause();
      return;
    }
    const hit = keyToAction(e.code, opts.players, opts.humans);
    if (!hit) return;
    e.preventDefault();
    setKey(hit.player, hit.action, true);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const hit = keyToAction(e.code, opts.players, opts.humans);
    if (!hit) return;
    e.preventDefault();
    setKey(hit.player, hit.action, false);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ---- 遮罩(暂停 / 结算) ----
  let veil: HTMLElement | null = null;

  function clearVeil(): void {
    veil?.remove();
    veil = null;
  }

  function showVeil(title: string, sub: string, buttons: VeilButton[]): void {
    clearVeil();
    const v = el("div", "pfb-veil");
    v.append(el("div", "pfb-veil-title", title), el("div", "pfb-veil-sub", sub));
    const row = el("div", "pfb-veil-btns");
    for (const b of buttons) {
      const btn = el("button", `pfb-veil-btn${b.ghost ? " pfb-ghost" : ""}`, b.label);
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
    // 焦点落到第一颗按钮上,键盘和读屏都能顺着往下走。
    // 这里认「有没有 focus 这个方法」而不是 `instanceof HTMLElement`——
    // 后者在没有 DOM 全局的运行环境里会直接抛 ReferenceError
    const first = v.querySelector("button");
    if (typeof (first as { focus?: unknown } | null)?.focus === "function") {
      (first as HTMLElement).focus();
    }
  }

  function togglePause(): void {
    if (ended || destroyed) return;
    paused = !paused;
    releaseAll();
    if (paused) {
      const buttons: VeilButton[] = [{ label: "▶ 继续", onClick: () => togglePause() }];
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
    toastEl.classList.add("pfb-on");
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
      const art = PARTICLE_FOR_EVENT[ev.kind];
      if (art) {
        particles.push({ x: ev.x, y: ev.y, vy: -34, life: 0.9, art, size: 18 });
        if (particles.length > 40) particles.shift();
      }
    }
  }

  // ---- 渲染 ----
  function drawBro(ctx: CanvasRenderingContext2D, p: World["players"][number], pi: number): void {
    const geom = BRO_GEOMS[pi % BRO_GEOMS.length];
    const blink = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
    const h = PLAYER_H;
    ctx.save();
    ctx.globalAlpha = blink ? 0.45 : 1;
    ctx.translate(p.x, p.y);

    // 形变三件套:落地压扁、被别人吹扁、掉出去打转。
    // 三样都只动外形,判定盒还是那个方方正正的 PLAYER_W × PLAYER_H;
    // 系统勾了「减弱动效」就一样都不做,人照走照跳,只是不再拉伸打转。
    if (motion) {
      if (p.bounds.phase === "tumble") {
        ctx.translate(0, -h * 0.5);
        ctx.rotate(p.bounds.spin);
        ctx.translate(0, h * 0.5);
      }
      const squash = landingSquash(p.feel) + pushSquish(p.puff);
      if (squash > 0.001) ctx.scale(1 + squash, 1 - squash);
    }

    // 皮肤全在 visual13 的 paintBro 里:骨架同一副,识别件按 BRO_KITS 长。
    // 嘴部三态的时序照旧读 blowCd(0.24 窗口)与 windupProgress,只是画法升级。
    const moving = Math.abs(p.vx) > 20 && p.bounds.phase !== "tumble";
    paintBro(ctx, geom, {
      facing: p.facing,
      sway: swayAngle(world.time * 1000, moving, !motion),
      mouth: mouthState(p.blowCd, windupProgress(p.puff), p.puff.pending !== null),
      grounded: p.onGround && p.bounds.phase !== "tumble",
    });
    ctx.restore();
  }

  /**
   * 「噗」的前摇:嘴边那个气流环从小画到大,`PUFF_WINDUP` 走完就喷出去。
   *
   * 这一圈是给对手看的 —— 看见它在攒就来得及躲开;也是给自己看的,
   * 免得小朋友按了半天不知道到底有没有按上。
   */
  function drawPuffRing(ctx: CanvasRenderingContext2D, p: World["players"][number]): void {
    if (!p.puff.pending) return;
    const ring = puffRing(p.x, p.y, PLAYER_H, PLAYER_W / 2, p.facing);
    // 提示功能不变:几何与从小到大的时序照旧由 windupProgress 说了算;
    // 描边升级成彩虹渐变,内圈 3 颗星尘打转,reduced 只留渐变描边
    paintPuffRing(ctx, ring, windupProgress(p.puff), world.time * 1000, !motion);
  }

  /**
   * 掉出底线的人在打转:身边画一圈越缩越小的提示环。
   * 环还在就说明还救得回来 —— 左右挪一挪、空中噗一口,都能飘回场上。
   */
  function drawTumbleRing(ctx: CanvasRenderingContext2D, p: World["players"][number]): void {
    if (p.bounds.phase !== "tumble") return;
    const left = tumbleProgress(p.bounds);
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = left > 0.4 ? "rgba(255,196,224,.95)" : "rgba(242,150,120,.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y - PLAYER_H * 0.5, PLAYER_W * 0.9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
    ctx.stroke();
    ctx.restore();
  }

  function drawGoo(ctx: CanvasRenderingContext2D, m: World["monsters"][number]): void {
    const c = GOO[m.kind];
    const w = MONSTER_W;
    const h = MONSTER_H;
    ctx.save();
    ctx.translate(m.x, m.y);
    // 蹦蹦怪有一对弹簧脚
    if (m.kind === "hopper") {
      ctx.strokeStyle = c.dark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(-5, -6);
      ctx.moveTo(5, 0);
      ctx.lineTo(5, -6);
      ctx.stroke();
    }
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.42, w * 0.5, h * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    // 流挂圆珠:黏液从身子下缘坠出两颗小珠,「黏糊糊」立起来
    ctx.beginPath();
    ctx.arc(-w * 0.22, -h * 0.06, 2.4, 0, Math.PI * 2);
    ctx.arc(w * 0.16, -h * 0.03, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.body;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.48, w * 0.46, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // 光泽:左上 45° 一弯月牙高光,黏液才有「湿」的质感
    ctx.strokeStyle = "rgba(255,255,255,.62)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(-w * 0.06, -h * 0.52, w * 0.3, -Math.PI * 0.82, -Math.PI * 0.42);
    ctx.stroke();
    // 追追怪头上一对小角
    if (m.kind === "chaser") {
      ctx.fillStyle = c.dark;
      ctx.beginPath();
      ctx.moveTo(-7, -h * 0.82);
      ctx.lineTo(-3, -h * 1.06);
      ctx.lineTo(-1, -h * 0.8);
      ctx.moveTo(7, -h * 0.82);
      ctx.lineTo(3, -h * 1.06);
      ctx.lineTo(1, -h * 0.8);
      ctx.fill();
    }
    ctx.fillStyle = c.face;
    if (m.dizzy > 0) {
      // 修复员 G5:「××」字形 → 眩晕星 2 颗绕头(300ms 相位;reduced 定格)
      drawDizzyStars(ctx, 0, -h * 0.62, 9, world.time * 1000, !motion);
    } else {
      ctx.beginPath();
      ctx.arc(m.dir * 2 - 4, -h * 0.56, 2.2, 0, Math.PI * 2);
      ctx.arc(m.dir * 2 + 4, -h * 0.56, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(m.dir * 2, -h * 0.36, 2.6, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 破泡的渐隐与半径曲线沿用 1.2:这里只算数,画法交给薄膜三段式 */
  function bubbleFade(b: World["bubbles"][number]): { fade: number; r: number } {
    const fade = b.popped ? Math.max(0, 1 + b.life / 0.35) : 1;
    return { fade, r: BUBBLE_R * (b.popped ? 1 + (1 - fade) * 0.6 : 1) };
  }

  /** 第一段:薄膜 + 描边。裹着的东西随后画在膜上,薄膜不遮内容物 */
  function drawBubble(ctx: CanvasRenderingContext2D, b: World["bubbles"][number]): void {
    const { fade, r } = bubbleFade(b);
    if (fade <= 0) return;
    ctx.save();
    ctx.globalAlpha = fade;
    bubbleFilm(ctx, b.x, b.y, r, b.hold ? PB_BUBBLE_HOLD : PB_COLORS.pbBubble);
    ctx.strokeStyle = b.hold ? "rgba(226,116,159,.9)" : "rgba(120,180,220,.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** 第三段:月牙高光(2400ms 巡回,reduced 静止)+ 彩虹缘(半径 < 6 自动省略) */
  function drawBubbleGloss(ctx: CanvasRenderingContext2D, b: World["bubbles"][number]): void {
    const { fade, r } = bubbleFade(b);
    if (fade <= 0) return;
    ctx.save();
    ctx.globalAlpha = fade;
    bubbleGloss(ctx, b.x, b.y, r, sheenAngle(world.time * 1000, !motion));
    ctx.restore();
  }

  /** 地板上还实心的那几段(坑之间的部分),从左往右排好 */
  function floorSpans(): Array<{ x0: number; x1: number }> {
    const pits = [...world.def.pits].sort((a, b) => a.x0 - b.x0);
    const out: Array<{ x0: number; x1: number }> = [];
    let cursor = 0;
    for (const pit of pits) {
      if (pit.x0 > cursor) out.push({ x0: cursor, x1: pit.x0 });
      cursor = Math.max(cursor, pit.x1);
    }
    if (cursor < ARENA_W) out.push({ x0: cursor, x1: ARENA_W });
    return out;
  }

  /**
   * 上升气流的那条气流线:它一路往上追,被追上就开始打转。
   * 画成一条半透明的浪,越靠近它颜色越紧张 —— 这是「快跑」的唯一提示。
   */
  function drawClimbLine(ctx: CanvasRenderingContext2D): void {
    if (world.def.climbRow <= 0) return;
    const y = Math.min(bottomLine(), lineY(world.def.index, world.time));
    if (y > ARENA_H + 20) return;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "rgba(126,216,206,.75)";
    ctx.fillRect(WALL, y, ARENA_W - WALL * 2, ARENA_H - y);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "rgba(79,175,166,.95)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = WALL; x <= ARENA_W - WALL; x += 8) {
      const wave = motion ? Math.sin(x * 0.09 + world.time * 4) * 3 : 0;
      if (x === WALL) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
    ctx.restore();
  }

  function render(now: number): void {
    if (!g) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, Math.round(rect.width * dpr));
    const ch = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    const pal = PALETTES[world.def.chapterIndex % PALETTES.length];
    const scale = Math.min(cw / ARENA_W, ch / ARENA_H);
    const offX = (cw - ARENA_W * scale) / 2;
    const offY = (ch - ARENA_H * scale) / 2;

    // ① 天空铺满整块画布:场地按等比缩放居中,两边多出来的地方接着画同一片天,
    // 不会露出一条突兀的色带。三套淡色天空(晨 / 昼 / 暮)按关卡序号轮换
    g.setTransform(1, 0, 0, 1, 0, 0);
    const skyTone = skyForLevel(world.def.index);
    const sky = g.createLinearGradient(0, 0, 0, ch);
    sky.addColorStop(0, skyTone);
    sky.addColorStop(1, shade(skyTone, 55));
    g.fillStyle = sky;
    g.fillRect(0, 0, cw, ch);
    g.setTransform(scale, 0, 0, scale, offX, offY);

    // ② 两层软云视差:远层 0.15×、近层 0.3× 滚速;reduced 时静止在原位
    const cloudSpan = ARENA_W + 160;
    for (const layer of [0, 1] as const) {
      const off = cloudScroll(layer, world.time, cloudSpan, !motion);
      const tint = cloudTint(skyTone, layer);
      for (let i = 0; i < 4; i++) {
        const baseX = (i * cloudSpan) / 4 + (layer === 0 ? 30 : 118);
        const cx = ((((baseX - off) % cloudSpan) + cloudSpan) % cloudSpan) - 80;
        const cy = layer === 0 ? 40 + ((i * 37) % 30) : 82 + ((i * 53) % 36);
        paintCloud(g, cx, cy, layer === 0 ? 26 : 36, tint);
      }
    }

    // 天花板与左右墙
    g.fillStyle = pal.deckSoft;
    g.fillRect(0, 0, ARENA_W, CEILING_Y);
    g.fillRect(0, 0, WALL, ARENA_H);
    g.fillRect(ARENA_W - WALL, 0, WALL, ARENA_H);
    g.fillStyle = pal.deck;
    g.fillRect(0, CEILING_Y - 3, ARENA_W, 3);

    // 地板。1.2 的对战场和上升气流里有真的坑,坑那一段不画地板 ——
    // 底下透出来的就是天,小朋友一眼看得出「这儿是空的,别走过去」
    // (修复员装饰件:顶条上再压一道 shade(deck,+18) 亮边,镇住「平涂感」)
    for (const span of floorSpans()) {
      g.fillStyle = pal.deckSoft;
      g.fillRect(span.x0, FLOOR_Y, span.x1 - span.x0, FLOOR_H);
      g.fillStyle = pal.deck;
      g.fillRect(span.x0, FLOOR_Y, span.x1 - span.x0, 5);
      g.fillStyle = shade(pal.deck, 18);
      g.fillRect(span.x0, FLOOR_Y, span.x1 - span.x0, 1.5);
    }

    // 浮台(顶条同一道亮边)
    for (const pl of world.def.platforms) {
      g.fillStyle = pal.deckSoft;
      roundRect(g, pl.x, pl.y, pl.w, 13, 6);
      g.fill();
      g.fillStyle = pal.deck;
      roundRect(g, pl.x, pl.y, pl.w, 5, 3);
      g.fill();
      g.fillStyle = shade(pal.deck, 18);
      roundRect(g, pl.x + 1, pl.y, pl.w - 2, 1.5, 1);
      g.fill();
    }

    // 机关画在浮台之后、人之前:人踩在机关上,不该被机关盖住
    for (const gs of world.gadgets) drawGadget(g, gs, world.time, motion);

    // 上升气流:脚底下那条一直往上追的气流线
    drawClimbLine(g);

    // 修复员 S6:糖果从 17px 裸 emoji 换成自绘四型(圆糖 / 棒棒糖 / 纸杯 / 团子),
    // 轮换下标与坐标不动,纸角 / 木棍 / 竹签把糖果剪影与泡泡拉开
    for (let i = 0; i < world.candies.length; i++) {
      const c = world.candies[i];
      if (c.taken) continue;
      drawCandy(g, CANDY_KINDS[i % CANDY_KINDS.length], c.x, c.y);
    }

    for (const m of world.monsters) {
      if (m.state === "gone" || m.state === "bubbled") continue;
      drawGoo(g, m);
    }

    // ⑤ 泡泡在人之下:膜 → 泡内物 → 光,三段画完薄膜不遮内容物
    for (const b of world.bubbles) {
      drawBubble(g, b);
      if (!b.popped && b.hold) {
        if (b.hold.kind === "monster") {
          const m = world.monsters[b.hold.id];
          if (m) drawGoo(g, m);
        } else {
          const p = world.players[b.hold.id];
          if (p) drawBro(g, p, b.hold.id);
        }
      }
      drawBubbleGloss(g, b);
    }

    // ⑥ 兄弟二人;过关那一刻换成击掌合影(两帧 step,reduced 静止),
    // 摔出平台的打转、失败面板都轮不到它 —— 只有 won 这一个分支
    const celebrating = shouldHighFive(world.status, wonAt);
    if (celebrating) {
      paintHighFive(g, ARENA_W / 2, FLOOR_Y - 2, highFiveFrame(now - wonAt, !motion));
    } else {
      for (let i = 0; i < world.players.length; i++) {
        const p = world.players[i];
        if (p.respawnT > 0) continue;
        if (p.trapped) continue;
        drawBro(g, p, i);
      }
      // ⑦ 攒气环与星尘是功能件,永远画在角色上层
      for (const p of world.players) {
        if (p.respawnT > 0 || p.trapped) continue;
        drawPuffRing(g, p);
        drawTumbleRing(g, p);
      }
    }

    for (const pt of particles) {
      g.globalAlpha = Math.max(0, Math.min(1, pt.life));
      drawEventSpark(g, pt.art, pt.x, pt.y, pt.size * 0.5);
    }
    g.globalAlpha = 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  function refreshHud(): void {
    if (world.rivalry) {
      leftChip.className = "pfb-chip pfb-chip-a";
      leftBadge.style.display = "";
      leftTxt.textContent = `${BRO_NAMES[0]} ${world.players[0]?.pops ?? 0}`;
      rightChip.className = "pfb-chip pfb-chip-b";
      rightBadge.style.display = "";
      rightTxt.textContent = `${BRO_NAMES[1]} ${world.players[1]?.pops ?? 0}`;
      const target = Math.max(1, world.def.roundTarget);
      const lead = Math.max(world.players[0]?.pops ?? 0, world.players[1]?.pops ?? 0);
      barFill.style.width = `${Math.min(100, (lead / target) * 100)}%`;
      // 条子只有一小截宽,写短的:「先到 N 分赢下这一局」那句话搁在下面的提示行里
      barTxt.textContent = `🏆 ${lead}/${target} 分`;
    } else {
      leftChip.className = "pfb-chip";
      leftBadge.style.display = "none";
      leftTxt.textContent = `❤️ ${"♥".repeat(Math.max(0, world.hearts))}`;
      rightChip.className = "pfb-chip";
      rightBadge.style.display = "none";
      rightTxt.textContent = `🍬 ${world.candiesTaken}`;
      const done = world.monsterTotal > 0 ? world.cleared / world.monsterTotal : 1;
      barFill.style.width = `${Math.round(done * 100)}%`;
      barTxt.textContent = `咕噜怪 ${world.cleared}/${world.monsterTotal}`;
    }
    if (opts.progress) {
      const p = opts.progress(world);
      barFill.style.width = `${Math.round(Math.max(0, Math.min(1, p.fill)) * 100)}%`;
      barTxt.textContent = p.text;
    }
    if (opts.showTimer) {
      const left = world.def.timeLimit > 0 ? Math.max(0, world.def.timeLimit - world.time) : world.time;
      timerChip.textContent = `⏱ ${Math.ceil(left)}`;
    }
    if (opts.extraChip) extraChip.textContent = opts.extraChip(world);
  }

  function frame(ts: number): void {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = lastTime ? Math.min(0.05, (ts - lastTime) / 1000) : 0;
    lastTime = ts;
    if (!paused && !ended && dt > 0) {
      const list: Input[] = [];
      for (let i = 0; i < world.players.length; i++) {
        list.push(i < opts.humans ? inputs[i] : versusBotInput(world, i, opts.botLevel ?? "normal"));
      }
      stepWorld(world, dt, list);
      opts.onTick?.(world);
      consumeEvents(ts);
      for (const pt of particles) {
        pt.y += pt.vy * dt;
        pt.life -= dt;
      }
      for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
      if (toastT > 0) {
        toastT -= dt;
        if (toastT <= 0) toastEl.classList.remove("pfb-on");
      }
      if (world.status !== "playing") {
        ended = true;
        if (world.status === "won") wonAt = ts;
        releaseAll();
        opts.onEnd(world);
      }
    }
    refreshHud();
    render(ts);
  }

  refreshHud();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      // 视觉账本一并归零:粒子、吐司计时、击掌时间戳
      particles.length = 0;
      toastT = 0;
      wonAt = -1;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("resize", fitCanvas);
      ro?.disconnect();
      wrap.remove();
    },
    world: () => world,
    swap(def, keep) {
      world = createWorld(def, { players: opts.players, hearts: keep?.hearts });
      particles.length = 0;
      wonAt = -1;
      ended = false;
      paused = false;
      clearVeil();
      lastTime = 0;
      refreshHud();
    },
    showVeil,
    toast,
  };
}

// ---------------------------------------------------------------------------
// 188 关合作闯关
// ---------------------------------------------------------------------------

/** 闯关是一个人玩还是两个人一起玩(留在模块里,回地图再进来还记得) */
let coopPlayers: 1 | 2 = 1;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const def = buildLevel(ctx.level);
  const field = createField(stage, {
    def,
    players: coopPlayers,
    humans: coopPlayers,
    sfx: ctx.sfx,
    title: def.name,
    tip: def.hint,
    showTimer: true,
    onEnd: (w) => {
      const summary = summarize(w);
      if (summary.win) ctx.win(starsForRun(def, summary), winMessage(def, summary));
      else ctx.lose(w.message || "再来一次,先把离自己最近的那只裹起来!");
    },
  });
  return { destroy: () => field.destroy() };
}

// ---------------------------------------------------------------------------
// 无尽模式:噗噗不停
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const head = el("div", "pfb-head");
  const back = el("button", "pfb-btn", "🗺️ 回关卡");
  back.type = "button";
  const title = el("div", "pfb-head-title", "♾️ 噗噗不停");
  const bestChip = el("span", "pfb-chip");
  head.append(back, title, bestChip);
  const fieldHost = el("div");
  root.append(style, head, fieldHost);
  host.appendChild(root);

  let wave = 0;
  let scoreBase = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  bestChip.textContent = best > 0 ? `🏅 最好 ${best} 分` : "🏅 还没有纪录";

  const liveScore = (w: World): number =>
    scoreBase + endlessScore(w.cleared, w.candiesTaken, 0) + comboBonus(w.players[0]?.combo ?? 0);

  let field: Field | null = null;

  function finish(score: number, w: World): void {
    const record = score > best;
    if (record) best = save.recordEndlessBest(meta.id, score);
    bestChip.textContent = `🏅 最好 ${best} 分`;
    const bonus = Math.min(6, Math.floor(score / 140));
    if (bonus > 0) api.addStars(bonus);
    api.play(record ? "win" : "oops");
    field?.showVeil(
      record ? `新纪录 ${score} 分!` : `这一趟拿了 ${score} 分`,
      `${w.message || "心用完啦,这趟噗噗不停先到这儿。"}${
        record ? "这已经是你清得最多的一趟了!" : `最好成绩 ${best} 分,再来一趟就能追上它。`
      }${bonus > 0 ? `送你 ${bonus} 颗小星星。` : ""}`,
      [
        {
          label: "🔁 再来一趟",
          onClick: () => {
            wave = 0;
            scoreBase = 0;
            field?.swap(buildWave(0), { hearts: 3 });
          },
        },
        { label: "🗺️ 回关卡", ghost: true, onClick: onExit },
      ]
    );
  }

  field = createField(fieldHost, {
    def: buildWave(0),
    players: 1,
    humans: 1,
    sfx: (n) => api.play(n),
    title: "噗噗不停",
    tip: "一波接一波!清空这一波就进下一波,心用完才结束。",
    showTimer: false,
    extraChip: (w) => `🫧 ${liveScore(w)} 分`,
    onQuit: onExit,
    onEnd: (w) => {
      if (w.status === "won") {
        scoreBase = liveScore(w) + 40;
        wave++;
        const hp = Math.min(3, w.hearts + (wave % 3 === 0 ? 1 : 0));
        field?.swap(buildWave(wave), { hearts: hp });
        field?.toast(`第 ${wave} 波清空啦!${wave % 3 === 0 ? "补一颗心," : ""}继续!`);
        api.play("win");
        return;
      }
      finish(liveScore(w), w);
    },
  });

  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  return {
    destroy() {
      field?.destroy();
      field = null;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽模式:上升气流
// ---------------------------------------------------------------------------

/**
 * 一股越吹越急的上升气流把整座泡泡糖塔往上顶,噗噗兄弟只能一层一层往上爬。
 *
 * 一段是一屏,底下整条都是坑,爬到最高那一层就换下一段,高度一路累加。
 * 脚底下那条气流线一直在往上追,被追上、或者掉出屏底,都先**打转**——
 * 那一段时间里还能左右挪、还能噗一口自救,救不回来才结束这一趟。
 *
 * 高度按米记,存在本款自己的 `CLIMB_BEST_KEY` 里 —— 平台那一格无尽成绩留给
 * 「噗噗不停」。两种无尽的单位不一样(那边记分、这边记米),挤一格会让米数
 * 永远刷不过分数,详见 `updraft.ts` 里 `CLIMB_BEST_KEY` 上面那段。
 */
/** 读上升气流的最好高度。存储被禁用(无痕窗口)时安静地当作还没有纪录。 */
function readClimbBest(): number {
  try {
    return parseClimbBest(globalThis.localStorage?.getItem(CLIMB_BEST_KEY));
  } catch {
    return 0;
  }
}

/** 写回上升气流的最好高度;写不进去也不能把这一趟的结算流程搞崩。 */
function writeClimbBest(meters: number): number {
  const next = Math.max(0, Math.round(Number.isFinite(meters) ? meters : 0));
  try {
    globalThis.localStorage?.setItem(CLIMB_BEST_KEY, serializeClimbBest(next));
  } catch {
    /* 存不下就只在这一趟里生效,不打扰玩家 */
  }
  return next;
}

function mountClimb(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const head = el("div", "pfb-head");
  const back = el("button", "pfb-btn", "🗺️ 回关卡");
  back.type = "button";
  const title = el("div", "pfb-head-title", "🎈 上升气流");
  const bestChip = el("span", "pfb-chip");
  head.append(back, title, bestChip);
  const fieldHost = el("div");
  root.append(style, head, fieldHost);
  host.appendChild(root);

  /** 已经爬完几段 */
  let section = 0;
  /** 这一段里踩到过的最高一层 —— 高度只涨不跌,掉下来一点读数不会跟着缩回去 */
  let peak = 0;
  let best = readClimbBest();
  let settled = false;
  bestChip.textContent = best > 0 ? `🏅 最好 ${heightLine(best)}` : "🏅 还没有纪录";

  /** 人这会儿踩在第几层(不在地上就算 0) */
  function standingRow(w: World): number {
    const p = w.players[0];
    if (!p || !p.onGround || p.respawnT > 0) return 0;
    return rowOfSurface(w.def, p.surface);
  }

  const height = (): number => climbHeight(section, peak);

  let field: Field | null = null;

  function restart(): void {
    section = 0;
    peak = 0;
    settled = false;
    field?.swap(buildClimbSection(0));
  }

  function finish(w: World): void {
    if (settled) return;
    settled = true;
    const meters = height();
    const record = meters > best;
    if (record) best = writeClimbBest(meters);
    bestChip.textContent = `🏅 最好 ${heightLine(best)}`;
    const bonus = Math.min(6, Math.floor(meters / 25));
    if (bonus > 0) api.addStars(bonus);
    api.play(record ? "win" : "oops");
    field?.showVeil(
      record && meters > 0 ? `新纪录 ${heightLine(meters)}!` : `这一趟爬到 ${heightLine(meters)}`,
      `${climbMessage(meters, best)}${bonus > 0 ? `送你 ${bonus} 颗小星星。` : ""}`,
      [
        { label: "🔁 再来一趟", onClick: restart },
        { label: "🗺️ 回关卡", ghost: true, onClick: onExit },
      ]
    );
  }

  field = createField(fieldHost, {
    def: buildClimbSection(0),
    players: 1,
    humans: 1,
    sfx: (n) => api.play(n),
    title: "上升气流",
    tip: "脚底下的气流线一直在往上追!踩浮台、钻气流管、跳弹簧云,爬到最高那一层就过了这一段。",
    showTimer: false,
    extraChip: () => `🎈 ${heightLine(height())}`,
    progress: () => ({
      fill: (height() % SECTION_METERS) / SECTION_METERS,
      text: `第 ${section + 1} 段 · ${heightLine(height())}`,
    }),
    onTick: (w) => {
      peak = Math.max(peak, standingRow(w));
    },
    onQuit: onExit,
    onEnd: (w) => {
      if (w.status === "won") {
        section++;
        peak = 0;
        field?.swap(buildClimbSection(section));
        field?.toast(`爬上第 ${section} 段啦!已经 ${heightLine(height())},气流会更急一点。`);
        api.play("win");
        return;
      }
      finish(w);
    },
  });

  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  return {
    destroy() {
      field?.destroy();
      field = null;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 对战:三局两胜(双人 / 人机三档)
// ---------------------------------------------------------------------------

function mountVersus(
  host: HTMLElement,
  api: GameApi,
  onExit: () => void,
  botLevel: BotLevel | null
): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const head = el("div", "pfb-head");
  const back = el("button", "pfb-btn", "🗺️ 回关卡");
  back.type = "button";
  const rivalName = botLevel ? BOT_PROFILES[botLevel].name : BRO_NAMES[1];
  const title = el(
    "div",
    "pfb-head-title",
    botLevel ? `🤖 人机对战 · ${rivalName}` : "⚔️ 双人对战 · 三局两胜"
  );
  const scoreChip = el("span", "pfb-chip");
  head.append(back, title, scoreChip);
  const fieldHost = el("div");
  root.append(style, head, fieldHost);
  host.appendChild(root);

  const names: [string, string] = [BRO_NAMES[0], rivalName];
  let match: MatchState = newMatch();
  let field: Field | null = null;
  let awarded = false;

  function refreshScore(): void {
    scoreChip.textContent = `🏆 ${scoreLine(match, names)}`;
  }

  function endMatch(): void {
    const winner = matchWinner(match);
    const champion = winner < 0 ? null : names[winner];
    if (!awarded) {
      awarded = true;
      // 人机对战里赢了才给星星,双人对战两个人都给一颗,别为了星星吵架
      const gain = botLevel ? (winner === 0 ? (botLevel === "hard" ? 3 : botLevel === "normal" ? 2 : 1) : 0) : 1;
      if (gain > 0) api.addStars(gain);
    }
    api.play(winner === 0 || !botLevel ? "win" : "oops");
    field?.showVeil(
      champion ? `${champion} 拿下这一场!` : "打成平手啦!",
      `最终 ${scoreLine(match, names)}。${
        champion === names[0] && botLevel
          ? `${rivalName} 也很努力,要不要换个更难的档位试试?`
          : "换个场地再来一场吧!"
      }`,
      [
        {
          label: "🔁 再来一场",
          onClick: () => {
            match = newMatch();
            awarded = false;
            refreshScore();
            field?.swap(buildVersusArena(0));
          },
        },
        { label: "🗺️ 回关卡", ghost: true, onClick: onExit },
      ]
    );
  }

  function onRoundEnd(w: World): void {
    const points: [number, number] = [w.players[0]?.pops ?? 0, w.players[1]?.pops ?? 0];
    match = applyRound(match, w.roundWinner, points);
    refreshScore();
    if (isMatchOver(match)) {
      endMatch();
      return;
    }
    const who = w.roundWinner < 0 ? null : names[w.roundWinner];
    api.play(w.roundWinner === 0 || !botLevel ? "win" : "oops");
    field?.showVeil(
      who ? `${who} 赢下第 ${match.played} 局!` : `第 ${match.played} 局打平`,
      `${scoreLine(match, names)} · 先赢 ${ROUNDS_TO_WIN} 局拿下整场。`,
      [
        {
          label: `▶ 第 ${match.played + 1} 局`,
          onClick: () => field?.swap(buildVersusArena(match.played)),
        },
        { label: "🗺️ 回关卡", ghost: true, onClick: onExit },
      ]
    );
  }

  field = createField(fieldHost, {
    def: buildVersusArena(0),
    players: 2,
    humans: botLevel ? 1 : 2,
    botLevel: botLevel ?? "normal",
    sfx: (n) => api.play(n),
    title: "噗噗擂台",
    tip: `把对手裹进泡泡里再噗一下就得 1 分,先拿 ${VERSUS_ROUND_TARGET} 分赢下这一局。被裹住了就猛按方向键挣扎!`,
    showTimer: true,
    onQuit: onExit,
    onEnd: onRoundEnd,
  });

  refreshScore();
  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  return {
    destroy() {
      field?.destroy();
      field = null;
      root.remove();
    },
  };
}

/** 人机对战之前先选档位 */
function mountBotPicker(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const head = el("div", "pfb-head");
  const back = el("button", "pfb-btn", "🗺️ 回关卡");
  back.type = "button";
  head.append(back, el("div", "pfb-head-title", "🤖 人机对战 · 挑一个对手"));
  const picker = el("div", "pfb-picker");
  picker.appendChild(el("div", "pfb-picker-title", "想跟谁打三局两胜?"));
  const picks = el("div", "pfb-picks");
  picker.appendChild(picks);
  picker.appendChild(
    el("div", "pfb-tip", "你用 W A S D 移动、F 吹气流、G 噗一下;方向键那一套交给电脑。")
  );
  // 选完对手整块面板(连同它自己那行标题)一起收起来,免得和对局的标题栏叠成两层
  const panel = el("div");
  panel.append(head, picker);
  const stage = el("div");
  root.append(style, panel, stage);
  host.appendChild(root);

  let inner: { destroy: () => void } | null = null;

  for (const key of BOT_LEVELS) {
    const prof = BOT_PROFILES[key];
    const btn = el("button", "pfb-pick");
    btn.type = "button";
    btn.append(
      el("div", "pfb-pick-name", `${key === "easy" ? "🌱" : key === "normal" ? "🫧" : "👑"} ${prof.name}`),
      el("div", "pfb-pick-sub", prof.blurb)
    );
    btn.addEventListener("click", () => {
      if (inner) return;
      api.play("tap");
      panel.hidden = true;
      inner = mountVersus(stage, api, onExit, key);
    });
    picks.appendChild(btn);
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onExit();
  });

  return {
    destroy() {
      inner?.destroy();
      inner = null;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 入口:模式选择 + 188 关地图
// ---------------------------------------------------------------------------

export interface PuffBrosHandle {
  destroy: () => void;
  /**
   * 平台「直达第 N 关」(1 基),返回真正打开的那一关。
   *
   * 188 关的选关地图走的是平台的 `mountLevelGame`,而它只吐一个 `destroy`,
   * 没有「从第 N 关开始」的入口,所以这儿自己开一条直达通道。越界会夹到 1..188。
   */
  openCampaignLevel: (n: number) => number;
}

/** 壳层没给 `initialLevel` 时,也认地址栏上的 `?level=N`(1 基) */
export function levelFromQuery(search: string | null): number | null {
  if (!search) return null;
  const raw = new URLSearchParams(search).get("level");
  if (raw === null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function mount(api: GameApi): PuffBrosHandle {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "pfb-modebar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const coopBtn = el("button", "pfb-mode pfb-mode-coop");
  coopBtn.type = "button";
  const duelBtn = el("button", "pfb-mode pfb-mode-duel", "⚔️ 双人对战");
  duelBtn.type = "button";
  const botBtn = el("button", "pfb-mode pfb-mode-bot", "🤖 人机三档");
  botBtn.type = "button";
  const endlessBtn = el("button", "pfb-mode");
  endlessBtn.type = "button";
  const climbBtn = el("button", "pfb-mode pfb-mode-climb");
  climbBtn.type = "button";
  bar.append(coopBtn, duelBtn, botBtn, endlessBtn, climbBtn);

  let current: { destroy: () => void } | null = null;
  let direct: { destroy: () => void } | null = null;

  function refreshBar(): void {
    // 两种无尽各记各的:噗噗不停用平台那一格记分,上升气流用本款自己那一格记米
    const waveBest = save.getGameProgress(meta.id).endlessBest;
    const climbBest = readClimbBest();
    endlessBtn.textContent = waveBest > 0 ? `♾️ 噗噗不停 · 最好 ${waveBest} 分` : "♾️ 噗噗不停 · 来一趟!";
    climbBtn.textContent = climbBest > 0 ? `🎈 上升气流 · 最好 ${heightLine(climbBest)}` : "🎈 上升气流 · 往上爬!";
    coopBtn.textContent = coopPlayers === 1 ? "👤 闯关:一个人" : "👫 闯关:两个人";
    coopBtn.setAttribute("aria-label", `188 关闯关目前是${coopPlayers === 1 ? "一个人" : "两个人一起"}玩,点一下切换`);
  }

  function closeMode(): void {
    current?.destroy();
    current = null;
    direct?.destroy();
    direct = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, onExit: () => void) => { destroy: () => void }): void {
    if (current) return;
    api.play("tap");
    direct?.destroy();
    direct = null;
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    current = make(modeHost, api, closeMode);
  }

  coopBtn.addEventListener("click", () => {
    api.play("tap");
    coopPlayers = coopPlayers === 1 ? 2 : 1;
    refreshBar();
  });
  duelBtn.addEventListener("click", () => openMode((h, a, x) => mountVersus(h, a, x, null)));
  botBtn.addEventListener("click", () => openMode(mountBotPicker));
  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  climbBtn.addEventListener("click", () => openMode(mountClimb));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 真下到某一关里就把这排模式按钮收起来:窄屏上它要占两行,
      // 那点高度留给画面比留给「现在能换模式」有用得多。回到关卡地图再放回来
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy() {
            handle.destroy?.();
            if (!current) bar.hidden = false;
          },
        };
      },
      mapHint: "吹一口气流裹住咕噜怪,再噗一下把它变成糖果!用时、糖果、不丢心,三样都做到就是三颗星。",
      grandMessage: "188 关全部清空,噗噗兄弟就是泡泡糖工坊的大冠军!",
      guide: GUIDE,
      guideTitle: "噗噗小攻略",
    }
  );

  /**
   * 不经过选关地图,直接把第 index 关(0 基)摆上来。
   *
   * 星级照旧写平台那份 `l99` 存档,小星星也只补「比历史最好成绩多出来的那几颗」——
   * 直达通道跟从地图点进去是同一份进度,不是刷星的后门。
   */
  function openDirectLevel(index: number): void {
    const i = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(index)));
    current?.destroy();
    current = null;
    direct?.destroy();
    direct = null;
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;

    const ci = chapterOf(CHAPTERS, i);
    const ch = CHAPTERS[ci] as Chapter;
    const topbar = el("div", "pfb-mhead");
    const backBtn = el("button", "pfb-btn", "🗺️ 选关地图");
    backBtn.type = "button";
    backBtn.addEventListener("click", () => {
      api.play("tap");
      closeMode();
    });
    const label = el("span", "pfb-chip", `${ch.emoji} ${ch.name} · 第 ${i + 1} 关`);
    topbar.append(backBtn, label);

    // 跳关走平台的家长门:壳层没注册 requestSkip 就压根不挂这颗按钮
    const request = getLevelExtras().requestSkip;
    if (request && i + 1 < TOTAL_LEVELS) {
      const skip = el("button", "pfb-btn pfb-skip", `⏭️ 跳过 第 ${i + 1} 关`);
      skip.type = "button";
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

    const stage = el("div");
    modeHost.append(topbar, stage);

    let handle: PlayHandle | undefined;
    let settled = false;

    function settle(title: string, msg: string, buttons: Array<{ label: string; go: () => void }>): void {
      handle?.destroy?.();
      handle = undefined;
      stage.textContent = "";
      const panel = el("div", "pfb-done");
      panel.append(el("div", "pfb-veil-title", title), el("div", "pfb-veil-sub", msg));
      const row = el("div", "pfb-acts");
      for (const b of buttons) {
        const btn = el("button", "pfb-open", b.label);
        btn.type = "button";
        btn.addEventListener("click", () => {
          api.play("tap");
          b.go();
        });
        row.appendChild(btn);
      }
      panel.appendChild(row);
      stage.appendChild(panel);
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
        buttons.push({ label: "🗺️ 选关地图", go: () => closeMode() });
        settle(`⭐ 第 ${i + 1} 关过关!`, msg ?? "噗得漂亮!", buttons);
      },
      lose: (msg) => {
        if (settled) return;
        settled = true;
        api.play("oops");
        settle("🫧 就差一点点", msg ?? "再来一次一定行!", [
          { label: "🔁 再试一次", go: () => openDirectLevel(i) },
          { label: "🗺️ 选关地图", go: () => closeMode() },
        ]);
      },
      sfx: (n) => api.play(n),
      bonusStars: (n) => api.addStars(n),
    };

    handle = playLevel(stage, ctx);
    direct = {
      destroy() {
        handle?.destroy?.();
        handle = undefined;
        topbar.remove();
        stage.remove();
      },
    };
  }

  function openCampaignLevel(n: number): number {
    const i = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(n) - 1));
    openDirectLevel(i);
    return i + 1;
  }

  const jumpTo =
    (api as { initialLevel?: number }).initialLevel ??
    levelFromQuery(typeof location === "object" && location ? location.search : null);
  if (jumpTo !== null && jumpTo !== undefined && jumpTo >= 1) openCampaignLevel(jumpTo);

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
