import { meta } from "./meta";
export { meta };

// 泡泡布阵:格子迷宫里摆泡泡的合家欢对战游戏。
//
// 五种玩法共用同一套对局运行时 `createMatch`:
//  - 闯关:188 关八大主题,清怪 / 找出口 / 泡泡王三种目标(走 level99 框架);
//  - 双人对战:同屏两人,先赢 3 局;
//  - 人机对战:三档电脑玩家,高档会算彩虹波与逃生路线;
//  - 泡泡塔(无尽):一层一张小地图,清完这一层就上楼,道具跟着爬;
//  - 双人合作:两人同队一起闯关,被罩住的人可以被队友拍出来。
//
// 全程没有血、没有伤、没有死亡:被彩虹波扫到只是被泡泡罩住几秒,
// 自己会晃出来,合作模式里队友还能贴上来把泡泡拍破。砖块被波及是「变成小花散开」。
import {
  TOTAL_LEVELS,
  loadStars,
  markSkipped,
  mountLevelGame,
  saveStar,
  type GameApi,
  type PlayCtx,
  type SoundName,
} from "../level99";
import { getLevelExtras } from "../../ui/level188Contract";
import { stopSpeaking } from "../speech";
import { save } from "../../engine/save";
import GUIDE from "./guide";
import {
  AI_LABEL,
  createPacer,
  dangerTiming,
  pacedAiAction,
  shrinkDelay,
  shrinkRing,
  type AiLevel,
} from "./ai";
import {
  CHAPTERS,
  MIN_CELL_PX,
  TOWER_SHRINK_FROM,
  buildArena,
  buildCoopLevel,
  buildLevel,
  buildTowerFloor,
  goalText,
  withinChapter,
  type BombLevel,
} from "./levels";
import {
  BUBBLE_MS,
  BUBBLE_POP_MS,
  CHAIN_WINDOW_MS,
  COOP_KEY,
  CRITTER_INFO,
  DIR_DOWN,
  DIR_LEFT,
  DIR_NONE,
  DIR_RIGHT,
  DIR_UP,
  FLAME_MS,
  FUSE_MS,
  ITEM_INFO,
  RESCUE_MS,
  RESCUE_TOUCH_MS,
  TILE_HARD,
  TILE_SOFT,
  actionDir,
  applyItem,
  bubbleStage,
  coopLine,
  createWorld,
  endlessLine,
  formatClock,
  growProgress,
  isPauseKey,
  keyToAction,
  levelCleared,
  loseLine,
  makeFighter,
  matchWinner,
  parseCoopProgress,
  pickDir,
  rateLevel,
  rescuerFor,
  roundWinner,
  secondsLeft,
  serializeCoopProgress,
  stepWorld,
  timeUp,
  versusLine,
  winLine,
  xOf,
  yOf,
  bubbleAge,
  type Fighter,
  type Intent,
  type InputName,
  type World,
} from "./logic";
import { shade, withAlpha } from "../../art/kit/palette";
import { ballGradient, softShadow } from "../../art/kit/volume";
import { topSideBlock } from "../../art/kit/block25d";
import { drawParticles, spawnPetals, stepParticles, type Particle } from "../../art/kit/sparkle";
import { blinkOn, drawChibi, walkFrameAt, type ChibiSpec } from "../../art/kit/chibi";
import {
  BB_COLORS,
  BB_PULSE_TINT,
  BbBoomFx,
  BbFighterFx,
  DANGER_EDGE,
  DANGER_RGB,
  PULSE_WINDOW_MS,
  bombPulseScale,
  crackStage,
  dangerEdgeAlpha,
  dangerGlowAlpha,
  drawDoor,
  drawHudRing,
  drawItemIcon,
  drawRivets,
  drawWallOrnament,
  fuseSparkPhase,
  hudRingColor,
  sparkPath,
  themeOfChapter,
} from "./visual13";

const P_NAME = ["朵朵", "星星"];
const P_COLOR = ["#e8558f", "#3f7fd6"];

/**
 * 双人自绘小人的参数(1.3 起彻底替换 emoji 主角)。
 * 剪影靠「花发卡 vs 星呆毛 + 裙 vs 裤」双保险区分,灰度截图下也分得清。
 */
const CHIBI_SPECS: ChibiSpec[] = [
  { skin: "#FFE3D2", outfit: BB_COLORS.bbPink, outfitStyle: "dress", accessory: "flower", accessoryColor: "#FF9FBE" },
  { skin: "#FFE9D8", outfit: BB_COLORS.bbBlue, outfitStyle: "pants", accessory: "star", accessoryColor: "#FFD678" },
];

/** 两套键位一个字都不重叠,写在一处,暂停面板与各模式提示共用 */
export const KEY_HELP =
  "朵朵:WASD 走 · F 放泡 · V 踢泡 · G 拍破;星星:方向键走 · L 放泡 · J 踢泡 · K 拍破。";

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

// --- 触屏热区 ---------------------------------------------------------------
//
// 1.2 的硬指标:摇杆 + 放泡钮 + 踢泡钮在 360px 宽的手机上互不重叠,热区都 ≥ 44px。
// 下面这几个数是「排得下」的算术依据,改之前先自己乘一遍:
//   摇杆 104 + 间隙 6 + 按钮 46 = 每人 156;两个人 156×2 + 中缝 10 = 322 ≤ 360。
// 老版本用的是 3×3 方向键盘(单键 40px,窄屏还会缩到 34px),既不够 44 也排不下两套,
// 所以这一版换成「一根摇杆 + 一列动作钮」。
/** 摇杆底盘直径 */
export const STICK_PX = 104;
/** 动作钮边长(最小热区 44 之上留 2px 余量) */
export const ACT_PX = 46;
/** 摇杆死区:手指离圆心这么近就算「不动」,免得贴着中心抖出乱七八糟的方向 */
export const STICK_DEAD_PX = 10;

/**
 * 手指落点(相对摇杆圆心的偏移)→ 四方向。
 *
 * 纯函数,单测直接喂坐标。取「偏得多的那根轴」,并列时按横轴——
 * 斜着 45° 推的时候总得选一个,横着走在这游戏里更常用。
 */
export function stickDir(dx: number, dy: number, dead: number = STICK_DEAD_PX): number {
  if (Math.hypot(dx, dy) < dead) return DIR_NONE;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? DIR_RIGHT : DIR_LEFT;
  return dy > 0 ? DIR_DOWN : DIR_UP;
}

/**
 * 棋盘格子边长(纯函数)。
 *
 * 两条约束打架时以「看得见」优先:能整屏放下就按可用空间铺满,
 * 实在放不下也不会小于 `MIN_CELL_PX` —— 24px 以下的格子,
 * 小怪只剩一个色块,孩子分不清是咕噜怪还是道具。
 * 关卡生成器那边已经把地图封在 15×15 以内,所以正常情况下两条都能满足。
 */
export function boardCellSize(cols: number, rows: number, availW: number, availH: number): number {
  const fit = Math.floor(Math.min(availW / Math.max(1, cols), availH / Math.max(1, rows)));
  return Math.max(MIN_CELL_PX, Math.min(46, fit));
}

export const CSS = `
.bmb-wrap{--bmb-ink:#4a4266;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--bmb-ink);
  display:flex;flex-direction:column;gap:7px;align-items:center;user-select:none;-webkit-user-select:none;
  position:relative;}
/* 只有真正要拖的东西吃掉手势;别的地方留给滚动,万一哪台机器还是矮了一截,
   摇杆也划得到,不会被 overflow:hidden 的舞台吃掉 */
.bmb-board,.bmb-stick,.bmb-act{touch-action:none;}
.bmb-hud{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;width:100%;}
.bmb-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:14px;font-weight:800;white-space:nowrap;
  box-shadow:0 2px 5px rgba(120,110,170,.18);}
.bmb-chip b{font-weight:900;}
.bmb-chip-p0{color:#a8306a;background:#ffeaf3;}
.bmb-chip-p1{color:#28568f;background:#e6f0ff;}
.bmb-chip--save{background:linear-gradient(180deg,#fff2c9,#ffe08a);color:#8a5a12;animation:bmb-pulse .7s ease-in-out infinite;}
.bmb-chip[hidden]{display:none;}
@keyframes bmb-pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.06);}}
.bmb-btn{border:none;border-radius:999px;min-height:44px;padding:6px 16px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7e6bc4,#6857ae);box-shadow:0 3px 0 #52458c;}
.bmb-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #52458c;}
.bmb-btn:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bmb-btn--ghost{background:linear-gradient(180deg,#9db6d8,#7f9ac3);box-shadow:0 3px 0 #64809f;}
.bmb-btn--ghost:active{box-shadow:0 1px 0 #64809f;}
.bmb-board{border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(110,100,160,.22);line-height:0;}
.bmb-board canvas{display:block;}
.bmb-tip{font-size:14px;font-weight:700;line-height:1.45;text-align:center;max-width:620px;color:#6a5f8c;
  background:#ffffffcc;border-radius:12px;padding:5px 10px;}
.bmb-pads{display:flex;justify-content:center;align-items:flex-start;gap:10px;width:100%;}
.bmb-padwrap{display:flex;flex-direction:column;align-items:center;gap:3px;}
.bmb-padname{font-size:12px;font-weight:900;}
.bmb-pad{display:flex;align-items:center;gap:6px;}
/* 摇杆:整块底盘就是热区,按下去哪边就往哪边走,拖着不放可以一路改方向 */
.bmb-stick{position:relative;width:${STICK_PX}px;height:${STICK_PX}px;border-radius:50%;flex:0 0 auto;
  background:radial-gradient(circle at 50% 42%,#ffffff,#e9e4f7);box-shadow:inset 0 2px 7px rgba(90,75,140,.22),0 3px 0 rgba(120,105,170,.3);
  touch-action:none;cursor:pointer;}
.bmb-stick:focus-visible{outline:3px solid #ffb43c;outline-offset:3px;}
.bmb-stick::before{content:"↑ ↓ ← →";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:900;color:#b3a8d4;letter-spacing:1px;}
.bmb-knob{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
  box-shadow:0 2px 6px rgba(90,75,140,.35);transition:transform .06s linear;pointer-events:none;}
.bmb-stick--p0 .bmb-knob{background:linear-gradient(180deg,#f79ac0,#e8558f);}
.bmb-stick--p1 .bmb-knob{background:linear-gradient(180deg,#8db6ec,#3f7fd6);}
.bmb-acts{display:flex;flex-direction:column;gap:5px;}
.bmb-act{border:none;border-radius:13px;width:${ACT_PX}px;height:${ACT_PX}px;font-size:11px;font-weight:900;
  line-height:1.15;cursor:pointer;font-family:inherit;color:#fff;padding:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;}
.bmb-act b{font-size:17px;font-weight:400;}
.bmb-act:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bmb-act:active{transform:translateY(2px);}
.bmb-acts--p0 .bmb-act{background:linear-gradient(180deg,#f79ac0,#e8558f);box-shadow:0 3px 0 #bf3a70;}
.bmb-acts--p1 .bmb-act{background:linear-gradient(180deg,#8db6ec,#3f7fd6);box-shadow:0 3px 0 #2f63aa;}
.bmb-veil{position:absolute;inset:0;background:rgba(255,252,255,.94);border-radius:16px;z-index:6;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:16px;}
.bmb-veil-t{font-size:20px;font-weight:900;color:#6a4fa8;}
.bmb-veil-s{font-size:14px;font-weight:700;color:#6f6390;line-height:1.6;max-width:320px;}
.bmb-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.bmb-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#f2f5ff,#fff3f8);display:flex;flex-direction:column;gap:8px;
  max-height:100%;overflow-y:auto;overscroll-behavior:contain;}
.bmb-mhead{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.bmb-back{border:none;border-radius:999px;min-height:44px;padding:6px 14px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#6a52a0;box-shadow:0 3px 0 rgba(120,90,160,.28);}
.bmb-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.28);}
.bmb-back:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bmb-bar{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-bottom:7px;}
/* display:flex 会盖掉浏览器自带的 [hidden]{display:none},这里补回来 */
.bmb-bar[hidden],.bmb-picks[hidden]{display:none;}
.bmb-open{border:none;border-radius:999px;min-height:44px;padding:8px 15px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#8f7ae0,#6f57c8);box-shadow:0 4px 0 #57429f;}
.bmb-open:active{transform:translateY(2px);box-shadow:0 2px 0 #57429f;}
.bmb-open:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bmb-open--vs{background:linear-gradient(180deg,#f08aa8,#d9628a);box-shadow:0 4px 0 #b04a6c;}
.bmb-open--ai{background:linear-gradient(180deg,#6fbfa8,#4c9d86);box-shadow:0 4px 0 #3b7c69;}
.bmb-open--co{background:linear-gradient(180deg,#efb268,#d8913f);box-shadow:0 4px 0 #ab7031;}
.bmb-picks{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;}
/* 舞台是定高的一屏。把中间这两层也钉成定高,.bmb-mode 的 max-height:100% 才有参照物 ——
   万一哪台机器矮得连 24px 的格子都排不下,至少还能滑下去按到摇杆,而不是被裁掉。 */
.bmb-root{display:flex;flex-direction:column;min-height:0;max-height:100%;}
.bmb-modehost{display:flex;flex-direction:column;min-height:0;}
.bmb-root>[hidden],.bmb-modehost[hidden]{display:none;}
.bmb-pick{border:none;border-radius:14px;min-height:44px;padding:7px 14px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffe0;color:#5b4a7a;box-shadow:0 3px 0 rgba(140,120,190,.35);}
.bmb-pick[aria-pressed="true"]{background:linear-gradient(180deg,#8f7ae0,#6f57c8);color:#fff;box-shadow:0 3px 0 #57429f;}
.bmb-pick:active{transform:translateY(2px);}
.bmb-pick:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bmb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
/* 360px 宽的手机:最宽的图是 13 列 ×24px = 312px,舞台内宽只有 323 —— 左右留白
   必须压到 4px 才塞得进去。两套摇杆挤一行(150×2 + 6 = 306),热区一个都不许缩:
   宁可字小一号、名字收起来,也不能让按钮小于 44。 */
@media (max-width:400px){
  .bmb-mode{padding:6px 4px;gap:6px;}
  .bmb-mhead{flex-wrap:nowrap;gap:5px;}
  .bmb-mhead .bmb-chip{min-width:0;overflow:hidden;text-overflow:ellipsis;flex:1 1 auto;}
  .bmb-mhead .bmb-btn{flex:0 0 auto;padding:6px 10px;}
  .bmb-back{padding:6px 10px;font-size:13px;}
  .bmb-pads{gap:6px;}
  .bmb-pad{gap:4px;}
  .bmb-tip{font-size:12.5px;padding:3px 8px;}
  .bmb-chip{font-size:12px;padding:3px 7px;}
  /* 名字只在宽屏上写全:窄屏靠颜色和表情认人,省下来的宽度让 HUD 收成一行 */
  .bmb-nm{display:none;}
  .bmb-act{width:44px;height:44px;border-radius:12px;font-size:11px;}
  .bmb-act b{font-size:16px;}
  .bmb-acts{gap:4px;}
  .bmb-stick{width:96px;height:96px;}
  .bmb-knob{width:44px;height:44px;margin:-22px 0 0 -22px;}
}
/* 手机竖屏一共就六百来像素高,棋盘上面还压着平台标题栏和本款的标题条。
   这里把行距收干净,保证「整张图 + 两套摇杆」一起留在首屏里,
   不用一边滚屏一边躲彩虹波 —— 舞台是 overflow:hidden 的,漏出去就等于按不到。 */
@media (max-height:780px){
  .bmb-wrap{gap:3px;}
  .bmb-padname{font-size:11px;line-height:1.1;}
  .bmb-padwrap{gap:2px;}
  /* 只有一个人玩的时候名字挪到摇杆左边,又省下一行的高度 */
  .bmb-pads--one .bmb-padwrap{flex-direction:row;align-items:center;gap:6px;}
}
/* 再矮一点(667 那一档):提示条让位给棋盘。这句话在暂停面板和开局播报里都还在。 */
@media (max-height:700px){
  .bmb-tip{display:none;}
}
@media (prefers-reduced-motion:reduce){
  .bmb-btn:active,.bmb-act:active,.bmb-pick:active{transform:none;}
  .bmb-knob{transition:none;}
  .bmb-chip--save{animation:none;}
}
/* 1.3 视觉升级:HUD 头像徽章 + 倒计时圆环(画布尺寸是 2x 的,CSS 收回一半) */
.bmb-ava{width:18px;height:18px;vertical-align:-4px;margin-right:3px;}
.bmb-ring{width:16px;height:16px;vertical-align:-3px;margin-right:2px;}
.bmb-nm{margin-right:3px;}
/* 摇杆名牌:emoji 退休,本色小圆点认人 */
.bmb-padname::before{content:"";display:inline-block;width:9px;height:9px;border-radius:50%;
  background:currentColor;margin-right:4px;vertical-align:-1px;}
`;

const STYLE_ID = "bmb-style";

function ensureCss(host: HTMLElement): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head ?? host).appendChild(style);
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------------------------------------------------------------------------
// 配色
// ---------------------------------------------------------------------------

interface Palette {
  bg: string;
  floor: string;
  line: string;
  wall: string;
  wallTop: string;
  brick: string;
  brickTop: string;
}

// 每一章一套粉彩配色。软砖要和地板拉开差距(砖是暖色、地板近白),
// 不然孩子一眼分不清「这块能炸」还是「这里能走」。
const PALETTES: Palette[] = [
  { bg: "#eef8ef", floor: "#fbfefa", line: "#e2f0e0", wall: "#7fb389", wallTop: "#9ccba4", brick: "#f0cf94", brickTop: "#ffe6b8" },
  { bg: "#fdeef4", floor: "#fffbfd", line: "#f6e2ea", wall: "#cd8aa5", wallTop: "#e3a5bd", brick: "#f3b183", brickTop: "#ffcfa6" },
  { bg: "#eaf4fc", floor: "#fbfdff", line: "#dcecf7", wall: "#6fa3c4", wallTop: "#8dbcd9", brick: "#eec98f", brickTop: "#ffe1b2" },
  { bg: "#eeeffb", floor: "#fcfcff", line: "#e4e6f5", wall: "#868dc6", wallTop: "#a2a8d9", brick: "#e9bfa0", brickTop: "#fbd9c0" },
  { bg: "#f5f0e6", floor: "#fefdfa", line: "#eee6d8", wall: "#b0906a", wallTop: "#cbae8b", brick: "#d9b98f", brickTop: "#f0d5ae" },
  { bg: "#e9f5f8", floor: "#fafeff", line: "#dcedf1", wall: "#6fb2c4", wallTop: "#8ecada", brick: "#f0cba1", brickTop: "#ffe3bf" },
  { bg: "#fdf1e4", floor: "#fffcf8", line: "#f6e6d5", wall: "#c9925f", wallTop: "#e0ae7f", brick: "#e8c07e", brickTop: "#fbdaa8" },
  { bg: "#f0ecfa", floor: "#fdfcff", line: "#e7e1f4", wall: "#9280c2", wallTop: "#ac9bd6", brick: "#e3bfa2", brickTop: "#f7dcc4" },
];

// 彩虹波:一圈圈软色的波纹,不是火。核心偏白、边缘走七彩,越淡越像肥皂泡的膜。
const WAVE_CORE = "#ffffff";
const WAVE_RING = ["#ffd7e6", "#ffe9b8", "#d6f5cf", "#cdeafc", "#ded6fb"];
// 泡泡与地形的皮肤主色全部收进 visual13 的 BB_COLORS 常量块;
// 这里只留几笔由主色派生的受光 / 砖缝 / 铆钉色(`shade` 是唯一取色入口)。
const BRICK_LINE = shade(BB_COLORS.bbBrick, -14);
const BRICK_SHEEN = shade(BB_COLORS.bbBrick, 18);
const BRICK_CRACK = shade(BB_COLORS.bbBrick, -38);
const WALL_SHEEN = shade(BB_COLORS.bbWall, 18);
const WALL_RIVET = shade(BB_COLORS.bbWall, -32);
/** 砖被波及散开的花瓣粒子(矢量,替换 emoji 小花池)的备选色 */
const PETAL_COLORS = ["#FFC2DA", "#FFD1E4", "#F7A9C9", "#CDEAFB"];

// ---------------------------------------------------------------------------
// 一场对局
// ---------------------------------------------------------------------------

export type MatchMode = "campaign" | "coop" | "versus" | "ai" | "endless";

export interface MatchResult {
  cleared: boolean;
  reason: "clear" | "time" | "bubble" | "escape";
  secondsLeft: number;
  totalSeconds: number;
  /** 1 号玩家(或合作双方合计)被罩了几次 */
  bubbled: number;
  picked: number;
  /** 合作:一共互相救出来几次 */
  saves: number;
  /** 对战:赢家下标;其它模式 -1 */
  winner: number;
  /** 1 号玩家收工时手上的家当(泡泡塔靠它把道具带上楼) */
  carry: Carry;
}

/** 一层结束时带走的家当 */
export type Carry = Pick<Fighter, "power" | "bombs" | "speed" | "kick" | "ghost" | "remote" | "shield">;

/** 这一层结束时手上剩什么,原样交给下一层 */
export function carryOf(f: Fighter): Carry {
  return {
    power: f.power,
    bombs: f.bombs,
    speed: f.speed,
    kick: f.kick,
    ghost: f.ghost,
    remote: f.remote,
    shield: f.shield,
  };
}

export interface MatchOpts {
  level: BombLevel;
  mode: MatchMode;
  /** 人类玩家数(1 或 2) */
  humans: number;
  /** 电脑玩家 */
  ai?: { index: number; skill: AiLevel }[];
  banner: string;
  tip: string;
  sfx: (name: SoundName) => void;
  onDone: (res: MatchResult) => void;
  /** 队友把人拍出来了:合作模式当场发一颗小星星 */
  onRescue?: (by: number) => void;
  /** 老无尽轮次(>0 时场地会一圈圈收缩);泡泡塔不用它 */
  shrinkRound?: number;
  /** 上一层带上来的家当(泡泡塔用:爬楼不清空道具) */
  carry?: Carry;
  /**
   * 暂停钮挂哪儿。
   *
   * 竖屏手机的高度是抠出来的:标题栏那一行右边空着半截,暂停钮搬过去,
   * HUD 就从两行缩成一行,棋盘正好多出 44px —— 13×13 的图才放得下 24px 的格子。
   * 不给就退回 HUD 里,单测和宽屏都照旧。
   */
  headSlot?: HTMLElement;
}

interface Runner {
  destroy: () => void;
  pause: () => void;
}

interface FighterView {
  rx: number;
  ry: number;
  hop: number;
  /** 这一帧还在往目标格挪吗(走路步态用) */
  moving: boolean;
}

const HOLD_KEYS: InputName[] = ["up", "right", "down", "left"];

function createMatch(host: HTMLElement, opts: MatchOpts): Runner {
  ensureCss(host);
  const lv = opts.level;
  const board = lv.board;
  const palette = PALETTES[Math.max(0, Math.min(PALETTES.length - 1, lv.chapter))];
  const coop = opts.mode === "coop";
  const duel = opts.mode === "versus" || opts.mode === "ai";
  const seats = Math.max(1, Math.min(2, opts.humans + (opts.ai?.length ?? 0)));

  // ---- 世界 ----------------------------------------------------------------
  const fighters: Fighter[] = [];
  for (let i = 0; i < seats; i++) {
    const spawn = lv.spawns[i] ?? lv.spawns[0];
    // 主角不再挂 emoji:画布上的形象由 chibi 自绘,HUD 用头像徽章
    const f = makeFighter(i, P_NAME[i], "", spawn, coop ? 0 : i);
    for (const item of lv.starters) applyItem(f, item);
    if (i === 0 && opts.carry) Object.assign(f, opts.carry);
    fighters.push(f);
  }
  for (const seat of opts.ai ?? []) {
    const f = fighters[seat.index];
    if (f) f.ai = true;
  }

  const world: World = createWorld({
    board,
    fighters,
    critters: lv.critters.map((c) => ({ ...c })),
    hidden: new Map(lv.hidden),
    exit: lv.exit,
    exitNeedsClear: true,
    goal: lv.goal,
    pierce: lv.pierce,
    // 合作模式才开救援:一个人玩的时候没人来拍,把困住时间从 3.6 秒改成 5 秒纯属添堵
    rescue: coop && opts.humans >= 2,
    limit: lv.seconds > 0 ? lv.seconds * 1000 : 0,
    seed: lv.seed,
    richness: lv.richness,
    pool: lv.pool,
  });

  const views: FighterView[] = fighters.map((f) => ({
    rx: xOf(board, f.pos),
    ry: yOf(board, f.pos),
    hop: 0,
    moving: false,
  }));

  /** 砖被彩虹波扫到时散出来的花瓣粒子(矢量,纯装饰不参与判定) */
  let fx: Particle[] = [];
  /** 爆炸涟漪账本:中心白闪 2 帧 + 沿四臂推进的花瓣串 + 末端星屑 */
  const boomFx = new BbBoomFx();
  /** 埋弹下蹲窗口账本(谁刚放了泡泡谁就蹲 120ms) */
  const fighterFx = new BbFighterFx();

  /**
   * 系统里勾了「减少动态效果」就别晃。
   *
   * CSS 那边有 `prefers-reduced-motion` 的媒体查询,但画布上的东西归不了 CSS 管,
   * 这里自己问一次。问不到(测试桩 / 老浏览器)就当没勾。
   */
  const calmMotion = (() => {
    const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    try {
      return mm?.("(prefers-reduced-motion: reduce)").matches === true;
    } catch {
      return false;
    }
  })();

  // ---- DOM -----------------------------------------------------------------
  const wrap = el("div", "bmb-wrap");
  const hud = el("div", "bmb-hud");
  const chipTime = el("span", "bmb-chip");
  // 倒计时圆环进度化:小画布圆环 + 原来的时间文本,读的还是同一个 secondsLeft
  const ringCv = document.createElement("canvas") as HTMLCanvasElement;
  ringCv.width = 32;
  ringCv.height = 32;
  ringCv.className = "bmb-ring";
  const ringG = ringCv.getContext("2d");
  ringG?.setTransform(2, 0, 0, 2, 0, 0);
  const timeText = el("span");
  chipTime.append(ringCv, timeText);
  const chipGoal = el("span", "bmb-chip");
  // 名字和数字分开装:窄屏上把名字收起来,一排芯片就能挤进 315px,HUD 从两行变一行
  const chipStats: { box: HTMLElement; name: HTMLElement; body: HTMLElement }[] = [];
  for (let i = 0; i < seats; i++) {
    const box = el("span", `bmb-chip bmb-chip-p${i}`);
    // 双人头像徽章:一张小画布,画一遍迷你 chibi,不用 emoji 认人
    const ava = document.createElement("canvas") as HTMLCanvasElement;
    ava.width = 36;
    ava.height = 36;
    ava.className = "bmb-ava";
    const ag = ava.getContext("2d");
    if (ag) {
      ag.setTransform(2, 0, 0, 2, 0, 0);
      drawChibi(ag, 9, 8, 15, CHIBI_SPECS[i] ?? CHIBI_SPECS[0], { pose: "idle" });
    }
    const name = el("span", "bmb-nm");
    const body = el("span");
    box.append(ava, name, body);
    chipStats.push({ box, name, body });
  }
  const pauseBtn = el("button", "bmb-btn bmb-btn--ghost") as HTMLButtonElement;
  pauseBtn.type = "button";
  const pauseIcon = el("span", undefined, "⏸");
  const pauseWord = el("span", "bmb-nm", "暂停");
  pauseBtn.append(pauseIcon, pauseWord);
  pauseBtn.setAttribute("aria-label", "暂停");
  hud.append(chipTime, chipGoal, ...chipStats.map((c) => c.box));
  // 手机上标题栏那一行还空着半截,暂停钮搬过去,棋盘就能多要回一整行 44px
  (opts.headSlot ?? hud).appendChild(pauseBtn);

  const boardBox = el("div", "bmb-board");
  const canvas = document.createElement("canvas");
  boardBox.appendChild(canvas);

  // 合作模式的救援提示:队友被罩住时才亮,平时藏起来不占地方
  const chipRescue = el("span", "bmb-chip bmb-chip--save");
  chipRescue.hidden = true;
  hud.appendChild(chipRescue);

  const tip = el("div", "bmb-tip", opts.tip);
  const pads = el("div", "bmb-pads");
  const live = el("div", "bmb-sr");
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");

  wrap.append(hud, boardBox, tip, pads, live);
  host.appendChild(wrap);

  const g = canvas.getContext("2d");

  // ---- 输入 ----------------------------------------------------------------
  const held: boolean[][] = [];
  const recent: number[][] = [];
  const pending: { drop: boolean; boom: boolean; kick: boolean }[] = [];
  /** 摇杆推出来的方向(和键盘各走各的,松手就归 -1) */
  const stickDirs: number[] = [];
  for (let i = 0; i < seats; i++) {
    held.push([false, false, false, false]);
    recent.push([]);
    pending.push({ drop: false, boom: false, kick: false });
    stickDirs.push(DIR_NONE);
  }

  function humanSeat(player: number): number {
    // 单人玩时两套键位都归 0 号;双人时各管各的
    if (opts.humans <= 1) return 0;
    return player;
  }

  function setHold(seat: number, action: InputName, down: boolean): void {
    if (seat < 0 || seat >= seats) return;
    if (fighters[seat]?.ai) return;
    const dir = actionDir(action);
    if (dir >= 0) {
      held[seat][dir] = down;
      if (down) recent[seat].push(dir);
      else recent[seat] = recent[seat].filter((d) => d !== dir);
      if (recent[seat].length > 6) recent[seat] = recent[seat].slice(-6);
      return;
    }
    if (!down) return;
    if (action === "drop") pending[seat].drop = true;
    if (action === "boom") pending[seat].boom = true;
    if (action === "kick") pending[seat].kick = true;
  }

  const padButtons: { btn: HTMLButtonElement; seat: number; action: InputName }[] = [];
  const sticks: { el: HTMLElement; knob: HTMLElement; seat: number; pointer: number }[] = [];

  /** 三颗动作钮:放泡 / 踢泡 / 遥控拍破。46×46,竖着排在摇杆右边,谁也不压谁。 */
  const ACT_BUTTONS: { action: InputName; icon: string; word: string; aria: string }[] = [
    { action: "drop", icon: "🫧", word: "放泡", aria: "放一个泡泡" },
    { action: "kick", icon: "🦵", word: "踢泡", aria: "把脚边的泡泡踢出去" },
    { action: "boom", icon: "📡", word: "拍破", aria: "遥控把自己的泡泡拍破" },
  ];

  function buildPad(seat: number): void {
    const box = el("div", "bmb-padwrap");
    // 名牌不再用 emoji:CSS ::before 画一颗本色小圆点认人
    const name = el("div", "bmb-padname", P_NAME[seat]);
    name.style.color = P_COLOR[seat];

    const pad = el("div", "bmb-pad");
    const stick = el("div", `bmb-stick bmb-stick--p${seat}`);
    stick.tabIndex = 0;
    stick.setAttribute("role", "group");
    stick.setAttribute(
      "aria-label",
      `${P_NAME[seat]}的摇杆:按住往哪边推就往哪边走,也可以用${seat === 0 ? " W A S D " : "方向"}键`
    );
    const knob = el("span", "bmb-knob");
    stick.appendChild(knob);
    sticks.push({ el: stick, knob, seat, pointer: -1 });

    const acts = el("div", `bmb-acts bmb-acts--p${seat}`);
    for (const act of ACT_BUTTONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bmb-act";
      const icon = el("b", undefined, act.icon);
      btn.append(icon, el("span", undefined, act.word));
      btn.setAttribute("aria-label", `${P_NAME[seat]}${act.aria}`);
      acts.appendChild(btn);
      padButtons.push({ btn, seat, action: act.action });
    }

    pad.append(stick, acts);
    box.append(name, pad);
    pads.appendChild(box);
  }

  for (let i = 0; i < seats; i++) {
    if (!fighters[i].ai) buildPad(i);
  }
  pads.classList.add(pads.childElementCount > 1 ? "bmb-pads--two" : "bmb-pads--one");

  for (const { btn, seat, action } of padButtons) {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      setHold(seat, action, true);
    });
    const up = (): void => setHold(seat, action, false);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  }

  /** 手指位置 → 这一格摇杆的方向,同时把小圆点挪过去让人看见自己推到哪了 */
  function aimStick(s: { el: HTMLElement; knob: HTMLElement; seat: number }, e: PointerEvent): void {
    const rect = s.el.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const dir = stickDir(dx, dy);
    stickDirs[s.seat] = dir;
    const shift = rect.width * 0.22;
    const kx = dir === DIR_LEFT ? -shift : dir === DIR_RIGHT ? shift : 0;
    const ky = dir === DIR_UP ? -shift : dir === DIR_DOWN ? shift : 0;
    s.knob.style.transform = `translate(${kx.toFixed(1)}px,${ky.toFixed(1)}px)`;
  }

  function dropStick(s: { knob: HTMLElement; seat: number; pointer: number }): void {
    s.pointer = -1;
    stickDirs[s.seat] = DIR_NONE;
    s.knob.style.transform = "translate(0px,0px)";
  }

  for (const s of sticks) {
    s.el.addEventListener("pointerdown", (e) => {
      const pe = e as PointerEvent;
      pe.preventDefault();
      s.pointer = pe.pointerId ?? 0;
      // 抓住这根手指:滑出底盘也还归这根摇杆管,两个人的手指不会串台
      (s.el as HTMLElement & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(s.pointer);
      aimStick(s, pe);
    });
    s.el.addEventListener("pointermove", (e) => {
      const pe = e as PointerEvent;
      if (s.pointer < 0 || (pe.pointerId ?? 0) !== s.pointer) return;
      pe.preventDefault();
      aimStick(s, pe);
    });
    const release = (e: Event): void => {
      const pe = e as PointerEvent;
      if (s.pointer >= 0 && (pe.pointerId ?? 0) !== s.pointer) return;
      dropStick(s);
    };
    s.el.addEventListener("pointerup", release);
    s.el.addEventListener("pointercancel", release);
    s.el.addEventListener("lostpointercapture", release);
  }

  const releaseAll = (): void => {
    for (let i = 0; i < seats; i++) {
      held[i] = [false, false, false, false];
      recent[i] = [];
      stickDirs[i] = DIR_NONE;
    }
    for (const s of sticks) dropStick(s);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isPauseKey(e.code)) {
      e.preventDefault();
      togglePause();
      return;
    }
    const hit = keyToAction(e.code, opts.humans);
    if (!hit) return;
    e.preventDefault();
    setHold(humanSeat(hit.player), hit.action, true);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const hit = keyToAction(e.code, opts.humans);
    if (!hit) return;
    e.preventDefault();
    setHold(humanSeat(hit.player), hit.action, false);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointerup", releaseAll);
  window.addEventListener("blur", releaseAll);

  // ---- 画布尺寸 -------------------------------------------------------------
  let cell = 30;

  /**
   * 棋盘还能占多高——量出来的,不是拍脑袋的常量。
   *
   * 平台的舞台是 `overflow:hidden` 的一屏,漏到屏幕外的摇杆等于按不到。
   * 所以先把「棋盘上面那一摞」(标题栏 + 标题条 + HUD)和「下面那一摞」
   * (提示条 + 摇杆)的**真实**高度扣干净,剩下多少才是棋盘的。
   * 量不到(比如测试用的 DOM 桩)就退回老常量,行为和 1.1 一样。
   */
  function roomForBoard(viewH: number): number {
    const top = boardBox.getBoundingClientRect?.()?.top ?? 0;
    const below = (tip.offsetHeight ?? 0) + (pads.offsetHeight ?? 0);
    // 舞台底下平台自己还留了 8~14px 的边,留 16 当保险
    const room = viewH - 16 - top - below - 8;
    if (!Number.isFinite(room) || top <= 0 || room <= 0) return viewH - (viewH <= 720 ? 250 : 220);
    return room;
  }

  function layout(): void {
    const wide = (globalThis as { innerWidth?: number }).innerWidth ?? 400;
    const avail = Math.max(MIN_CELL_PX * board.w, Math.min(host.clientWidth || wide, 620));
    const viewH = (globalThis as { innerHeight?: number }).innerHeight ?? 700;
    // 高度不够就只能让棋盘小一点,但**不允许**把格子压到 24px 以下 ——
    // 宁可这一屏挤一挤,也不能让孩子看不清脚下那格是砖还是泡泡。
    const maxH = Math.max(MIN_CELL_PX * board.h, roomForBoard(viewH));
    cell = boardCellSize(board.w, board.h, avail, maxH);
    const cssW = cell * board.w;
    const cssH = cell * board.h;
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    g?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  layout();
  const onResize = (): void => {
    layout();
    render();
  };
  window.addEventListener("resize", onResize);

  // ---- 绘制 ----------------------------------------------------------------
  function roundRect(x: number, y: number, w: number, h: number, r: number): void {
    if (!g) return;
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }

  /**
   * 小怪的 emoji 字形(小怪不在本步替换清单里,照旧)。
   * 角色 / 门 / 道具 / 花瓣已全部改为程序化自绘,这里再也不经手它们。
   */
  function glyphAt(text: string, cx: number, cy: number, size: number): void {
    if (!g) return;
    g.font = `${Math.round(size)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, cx, cy);
  }

  /** 三套主题装饰(花园藤蔓 / 冰原霜花 / 星空星子):只换装饰层,不换布局数据 */
  const theme = themeOfChapter(lv.chapter);

  function render(): void {
    if (!g) return;
    const cssW = cell * board.w;
    const cssH = cell * board.h;
    g.clearRect(0, 0, cssW, cssH);
    g.fillStyle = palette.bg;
    g.fillRect(0, 0, cssW, cssH);

    const timing = dangerTiming(board, world.bombs, world.pierce);

    // ① 地板棋盘:双色差 4% 明度、四角圆润(硬墙格不铺,墙自己盖)
    for (let y = 0; y < board.h; y++) {
      for (let x = 0; x < board.w; x++) {
        const cellIdx = y * board.w + x;
        if (board.cells[cellIdx] === TILE_HARD) continue;
        const px = x * cell;
        const py = y * cell;
        g.fillStyle = (x + y) % 2 === 0 ? BB_COLORS.bbFloorA : BB_COLORS.bbFloorB;
        roundRect(px + 0.5, py + 0.5, cell - 1, cell - 1, Math.max(2, cell * 0.12));
        g.fill();
      }
    }

    // ② 危险格泛红呼吸 + 边缘虚线。什么时候开始亮、多快变亮仍由 dangerTiming
    //    与 1.2 的同一条归一化说了算(见 visual13.dangerGlowAlpha),这里只换皮。
    //    永远压在砖下 —— 砖面另有裂纹提示,角色也不遮它。
    for (const [cellIdx, burn] of timing) {
      if (world.flames.has(cellIdx)) continue;
      const px = (cellIdx % board.w) * cell;
      const py = Math.floor(cellIdx / board.w) * cell;
      g.fillStyle = `rgba(${DANGER_RGB},${dangerGlowAlpha(burn, world.time, calmMotion).toFixed(3)})`;
      roundRect(px + 1.5, py + 1.5, cell - 3, cell - 3, Math.max(3, cell * 0.2));
      g.fill();
      g.strokeStyle = withAlpha(DANGER_EDGE, dangerEdgeAlpha(burn));
      g.lineWidth = Math.max(1.5, cell * 0.06);
      g.setLineDash([Math.max(3, cell * 0.14), Math.max(2, cell * 0.1)]);
      roundRect(px + 2, py + 2, cell - 4, cell - 4, Math.max(3, cell * 0.2));
      g.stroke();
      g.setLineDash([]);
    }

    // ③ 硬墙 / 软砖 / 门:2.5D 双面块(光源左上 45°,侧面在右下)
    for (let y = 0; y < board.h; y++) {
      for (let x = 0; x < board.w; x++) {
        const cellIdx = y * board.w + x;
        const px = x * cell;
        const py = y * cell;
        const t = board.cells[cellIdx];
        if (t === TILE_HARD) {
          topSideBlock(g, px + 1, py + 1, cell - 2, cell - 2, BB_COLORS.bbWall, undefined, Math.max(2, cell * 0.14));
          const topW = (cell - 2) * 0.82;
          g.fillStyle = WALL_SHEEN;
          roundRect(px + 2.5, py + 2.5, topW - 3, Math.max(2, cell * 0.12), Math.max(1.5, cell * 0.06));
          g.fill();
          drawRivets(g, px + 1, py + 1, topW, topW, WALL_RIVET);
          drawWallOrnament(g, theme, px + 1, py + 1, topW, palette.wall);
          continue;
        }
        if (t === TILE_SOFT) {
          topSideBlock(g, px + 2, py + 2, cell - 4, cell - 4, BB_COLORS.bbBrick, undefined, Math.max(2, cell * 0.16));
          const topW = (cell - 4) * 0.82;
          // 2×2 砖缝:一横三竖(上下两排错半格),砖才像砖
          g.strokeStyle = BRICK_LINE;
          g.lineWidth = Math.max(1, cell * 0.035);
          g.beginPath();
          g.moveTo(px + 3, py + 2 + topW / 2);
          g.lineTo(px + 1 + topW, py + 2 + topW / 2);
          g.moveTo(px + 2 + topW / 2, py + 3);
          g.lineTo(px + 2 + topW / 2, py + 2 + topW / 2);
          g.moveTo(px + 2 + topW * 0.28, py + 2 + topW / 2);
          g.lineTo(px + 2 + topW * 0.28, py + 1 + topW);
          g.moveTo(px + 2 + topW * 0.72, py + 2 + topW / 2);
          g.lineTo(px + 2 + topW * 0.72, py + 1 + topW);
          g.stroke();
          g.fillStyle = BRICK_SHEEN;
          roundRect(px + 3.5, py + 3, topW - 3, Math.max(2, cell * 0.1), Math.max(1.5, cell * 0.05));
          g.fill();
          // 被炸前的两阶段裂纹:纯视觉,由 dangerTiming 读数驱动,不碰「一次炸碎」的逻辑
          const stage = crackStage(timing.get(cellIdx));
          if (stage > 0) {
            g.strokeStyle = BRICK_CRACK;
            g.lineWidth = Math.max(1, cell * 0.045);
            g.beginPath();
            g.moveTo(px + cell * 0.3, py + cell * 0.22);
            g.lineTo(px + cell * 0.46, py + cell * 0.4);
            g.lineTo(px + cell * 0.38, py + cell * 0.58);
            g.stroke();
            if (stage > 1) {
              g.beginPath();
              g.moveTo(px + cell * 0.66, py + cell * 0.3);
              g.lineTo(px + cell * 0.56, py + cell * 0.48);
              g.lineTo(px + cell * 0.68, py + cell * 0.66);
              g.stroke();
            }
          }
        } else if (world.exitOpen && cellIdx === world.exit) {
          // 拱形木门 + 星星门牌(自绘,替换 emoji 门)
          drawDoor(g, px, py, cell);
        }
      }
    }

    // ④ 道具:白卡片 + 统一自绘图标(火力=星火 / 泡泡数=泡泡串 / 脚力=小靴……)
    for (const [cellIdx, kind] of world.items) {
      const px = (cellIdx % board.w) * cell;
      const py = Math.floor(cellIdx / board.w) * cell;
      g.fillStyle = "#ffffffdd";
      roundRect(px + cell * 0.14, py + cell * 0.14, cell * 0.72, cell * 0.72, cell * 0.24);
      g.fill();
      drawItemIcon(g, kind, px + cell / 2, py + cell / 2, cell * 0.26);
    }

    // ⑤ 炸弹泡泡:三停径向渐变 + 月牙反光 + 引信星火;临爆前 1s ±6% 体积脉动
    for (const bomb of world.bombs) {
      const px = (bomb.pos % board.w) * cell;
      const py = Math.floor(bomb.pos / board.w) * cell;
      const grow = growProgress(bomb.fuse, bomb.remote);
      const stage = bubbleStage(bomb.fuse, bomb.remote);
      const pulsing = !bomb.remote && bomb.fuse <= PULSE_WINDOW_MS;
      // 膨胀段从 0.3 倍长到 1 倍;临爆窗口走 ±6% 脉动(reduced 退化为变色);其余轻轻晃
      let beat: number;
      if (stage === "grow") beat = 0.3 + grow * 0.7;
      else if (pulsing) beat = bombPulseScale(bomb.fuse, calmMotion);
      else beat = 0.96 + (calmMotion ? 0 : 0.04 * Math.sin((FUSE_MS - bomb.fuse) / 150));
      const r = cell * 0.36 * beat;
      const cx = px + cell / 2;
      const cy = py + cell / 2;
      softShadow(g, cx, cy + cell * 0.34, cell * 0.3, cell * 0.09, 0.16, 1, "rgba(93,64,90,1)");
      g.globalAlpha = 0.92;
      g.fillStyle = ballGradient(g, cx, cy, Math.max(1, r), pulsing && calmMotion ? BB_PULSE_TINT : BB_COLORS.bbBubble);
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      // 膜:遥控泡泡镶一圈青色,连锁被点着的镶一圈粉色,一眼看出这颗为什么要破
      g.strokeStyle = bomb.remote ? "#4fc4b4" : bomb.chained ? "#f18cb4" : stage === "burst" ? "#ff9ec2" : "#8fd6f5";
      g.lineWidth = Math.max(1.5, cell * (stage === "burst" ? 0.09 : 0.06));
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      // 顶部月牙反光 + 小高光点(光源左上 45°)
      g.strokeStyle = "rgba(255,255,255,.8)";
      g.lineWidth = Math.max(1.5, r * 0.16);
      g.beginPath();
      g.arc(cx, cy, r * 0.7, -Math.PI * 0.78, -Math.PI * 0.32);
      g.stroke();
      g.fillStyle = "rgba(255,255,255,.9)";
      g.beginPath();
      g.arc(cx - r * 0.32, cy - r * 0.36, r * 0.14, 0, Math.PI * 2);
      g.fill();
      // 引信星火:沿弧线上蹿(400ms 循环);reduced 停在引信头当静态星火点
      const sparkT = calmMotion ? 1 : fuseSparkPhase(bubbleAge(bomb.fuse, bomb.remote), false);
      const fx0x = cx;
      const fx0y = cy - r;
      const fcx = cx + r * 0.42;
      const fcy = cy - r - cell * 0.16;
      const fx1x = cx + r * 0.5;
      const fx1y = cy - r - cell * 0.26;
      g.strokeStyle = "#b9a3d6";
      g.lineWidth = Math.max(1, cell * 0.04);
      g.beginPath();
      g.moveTo(fx0x, fx0y);
      g.quadraticCurveTo(fcx, fcy, fx1x, fx1y);
      g.stroke();
      const sx = (1 - sparkT) * (1 - sparkT) * fx0x + 2 * (1 - sparkT) * sparkT * fcx + sparkT * sparkT * fx1x;
      const sy = (1 - sparkT) * (1 - sparkT) * fx0y + 2 * (1 - sparkT) * sparkT * fcy + sparkT * sparkT * fx1y;
      g.fillStyle = "#FFD678";
      sparkPath(g, sx, sy, Math.max(2.5, cell * 0.09));
      g.fill();
      // 最后一秒在泡泡上写倒数,孩子能读着数字跑
      if (!bomb.remote && bomb.fuse <= 1000) {
        g.fillStyle = "#6a4fa8";
        g.font = `900 ${Math.round(cell * 0.34)}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(`${Math.max(1, Math.ceil(bomb.fuse / 1000))}`, cx, cy);
      }
    }

    // ⑥ 小怪 + 双人小人(角色画在格中心,判定格位置不动)
    for (const c of world.critters) {
      const px = (c.pos % board.w) * cell;
      const py = Math.floor(c.pos / board.w) * cell;
      const info = CRITTER_INFO[c.kind];
      if (c.kind === "boss") {
        g.fillStyle = "#ffe0f0";
        g.beginPath();
        g.arc(px + cell / 2, py + cell / 2, cell * 0.46, 0, Math.PI * 2);
        g.fill();
      }
      glyphAt(info.emoji, px + cell / 2, py + cell / 2, cell * (c.kind === "boss" ? 0.72 : 0.6));
      if (info.layers > 1) {
        g.fillStyle = "#7a5da8";
        g.font = `900 ${Math.round(cell * 0.28)}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(`${c.layers}`, px + cell * 0.8, py + cell * 0.22);
      }
    }

    fighters.forEach((f, i) => {
      const v = views[i];
      // 被罩住的人在泡泡里左右晃:一眼看出这不是「站着不动」而是「出不来」
      const sway = f.bubbleT > 0 && !calmMotion ? Math.sin(world.time / 130) * cell * 0.06 : 0;
      const cx = v.rx * cell + cell / 2 + sway;
      const cy = v.ry * cell + cell / 2 - v.hop;
      const r = cell * 0.34;
      const pose = f.bubbleT > 0 ? "trapped" : fighterFx.squatting(i, world.time) ? "squat" : v.moving ? "walk" : "idle";
      drawChibi(g, cx, cy, cell, CHIBI_SPECS[i] ?? CHIBI_SPECS[0], {
        pose,
        walkFrame: walkFrameAt(world.time),
        // 左右移动整体镜像,上下移动不镜像
        facing: f.facing === DIR_LEFT ? -1 : 1,
        blink: pose === "idle" || pose === "walk" ? blinkOn(world.time, i) : false,
        reduced: calmMotion,
      });
      // 护盾:头上顶几个小圈就是还剩几层
      if (f.shield > 0 && f.bubbleT <= 0) {
        g.strokeStyle = "#ffc95e";
        g.lineWidth = Math.max(1.5, cell * 0.05);
        for (let s = 0; s < f.shield; s++) {
          g.beginPath();
          g.arc(cx, cy, r * (1.18 + s * 0.2), 0, Math.PI * 2);
          g.stroke();
        }
      }
      if (f.bubbleT > 0) {
        g.strokeStyle = "#8fd6f5";
        g.lineWidth = Math.max(2, cell * 0.08);
        g.globalAlpha = 0.85;
        g.beginPath();
        g.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = "rgba(180,230,250,.35)";
        g.fill();
        g.globalAlpha = 1;
        // 头顶的倒计时圈:还剩多久自己晃出来,一圈走完就出来了
        const left = Math.max(0, Math.min(1, f.bubbleT / BUBBLE_MS));
        g.strokeStyle = "#5bb7e8";
        g.lineWidth = Math.max(2, cell * 0.07);
        g.beginPath();
        g.arc(cx, cy - r * 1.9, r * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
        g.stroke();
        // 合作模式:队友贴上来拍的时候,泡泡外面转一圈进度弧
        if (world.rescue && f.rescueT > 0) {
          const k = Math.min(1, f.rescueT / RESCUE_TOUCH_MS);
          g.strokeStyle = "#ffb43c";
          g.lineWidth = Math.max(2.5, cell * 0.1);
          g.beginPath();
          g.arc(cx, cy, r * 1.72, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
          g.stroke();
        }
      }
      if (f.ai) {
        g.fillStyle = "#4a4266";
        g.font = `900 ${Math.round(cell * 0.24)}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("电脑", cx, cy + r * 1.35);
      }
    });

    // ⑦ 彩虹波纹 + 爆炸涟漪 + 粒子(压在角色上层:波是半透明的软色,不遮人)
    //    波纹逐格照抄 world.flames —— 覆盖格与判定格由构造保证完全一致。
    for (const [cellIdx, left] of world.flames) {
      const px = (cellIdx % board.w) * cell;
      const py = Math.floor(cellIdx / board.w) * cell;
      const k = Math.max(0, Math.min(1, left / FLAME_MS));
      g.globalAlpha = 0.25 + k * 0.5;
      g.fillStyle = WAVE_RING[cellIdx % WAVE_RING.length];
      roundRect(px + 1, py + 1, cell - 2, cell - 2, cell * 0.34);
      g.fill();
      g.fillStyle = WAVE_CORE;
      // 波纹从中心往外化开:刚扫过时是一小团,散掉之前铺满整格
      const inset = cell * (0.06 + k * 0.24);
      roundRect(px + inset, py + inset, cell - inset * 2, cell - inset * 2, cell * 0.3);
      g.fill();
      g.globalAlpha = 1;
    }
    boomFx.draw(g, cell, world.time);
    drawParticles(g, fx);
  }

  // ---- HUD -----------------------------------------------------------------
  function refreshHud(): void {
    const secs = world.limit > 0 ? secondsLeft(world) : Math.floor(world.time / 1000);
    timeText.textContent = `⏱ ${formatClock(secs)}`;
    // 倒计时圆环进度化:有限时画剩余比例,无限时画一圈静态描边
    if (ringG) {
      const frac = world.limit > 0 ? Math.max(0, Math.min(1, (secs * 1000) / world.limit)) : 1;
      ringG.clearRect(0, 0, 16, 16);
      drawHudRing(ringG, 8, 8, 6, frac, world.limit > 0 ? hudRingColor(frac) : "#B9AEDC");
    }
    if (duel) {
      chipGoal.textContent = `⚔️ ${opts.banner}`;
    } else if (world.goal === "exit") {
      chipGoal.textContent = world.exitOpen ? "🌟 出口开了,走过去!" : `👾 剩 ${world.critters.length} 只 · 再找出口`;
    } else {
      chipGoal.textContent = `👾 剩 ${world.critters.length} 只`;
    }
    fighters.forEach((f, i) => {
      const gear = `${f.kick ? "🦵" : ""}${f.ghost ? "✨" : ""}${f.remote ? "📡" : ""}${f.shield > 0 ? `🛡${f.shield}` : ""}`;
      chipStats[i].name.textContent = f.name;
      chipStats[i].body.textContent = `🌈${f.power} 🫧${f.bombs} 👟${f.speed}${gear ? ` ${gear}` : ""}`;
    });
    refreshRescueChip();
  }

  /**
   * 亮/灭救援条,顺手重排一次。
   *
   * 这一条会给 HUD 多撑出一行。竖屏手机上那一行是从棋盘身上借的:不重排的话,
   * 下面的摇杆整块往下挪 30px,第三颗动作钮就被舞台裁掉了——偏偏「有人被困」
   * 正是最需要按钮的时候。
   */
  function showRescueChip(on: boolean): void {
    if (chipRescue.hidden !== !on) return;
    chipRescue.hidden = !on;
    layout();
  }

  /**
   * 救援提示条。
   *
   * 合作模式下队友被罩住时,另一个人常常根本没注意到——屏幕上两个小人都在动,
   * 谁被罩了并不显眼。这里直接把话说出来:还剩几秒、快过去拍。
   * 已经贴上去了就换成「拍拍拍」,让人知道按住不动就行、不用乱跑。
   */
  function refreshRescueChip(): void {
    const stuck = world.rescue ? fighters.find((f) => f.bubbleT > 0) : undefined;
    if (!stuck) {
      showRescueChip(false);
      return;
    }
    showRescueChip(true);
    const left = Math.max(1, Math.ceil(stuck.bubbleT / 1000));
    chipRescue.textContent =
      rescuerFor(world, stuck.index) >= 0
        ? `🫧 拍拍拍!马上就把${stuck.name}放出来`
        : `🆘 ${stuck.name}困在泡泡里 · 还有 ${left} 秒 · 快贴过去拍`;
  }

  // ---- 遮罩 ----------------------------------------------------------------
  let veil: HTMLElement | null = null;
  let paused = false;
  let finished = false;

  function clearVeil(): void {
    veil?.remove();
    veil = null;
  }

  function showVeil(title: string, sub: string, buttons: { label: string; ghost?: boolean; onClick: () => void }[]): void {
    clearVeil();
    const box = el("div", "bmb-veil");
    box.append(el("div", "bmb-veil-t", title), el("div", "bmb-veil-s", sub));
    const row = el("div", "bmb-veil-btns");
    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `bmb-btn${b.ghost ? " bmb-btn--ghost" : ""}`;
      btn.textContent = b.label;
      btn.addEventListener("click", () => {
        opts.sfx("tap");
        b.onClick();
      });
      row.appendChild(btn);
    }
    box.appendChild(row);
    wrap.appendChild(box);
    veil = box;
  }

  function togglePause(): void {
    if (finished) return;
    paused = !paused;
    pauseIcon.textContent = paused ? "▶" : "⏸";
    pauseWord.textContent = paused ? "继续" : "暂停";
    pauseBtn.setAttribute("aria-label", paused ? "继续" : "暂停");
    if (paused) {
      releaseAll();
      showVeil("⏸ 休息一下", `按 Esc 或点「继续」回到对局。${KEY_HELP}`, [
        { label: "▶ 继续", onClick: () => togglePause() },
      ]);
    } else {
      clearVeil();
    }
  }
  pauseBtn.addEventListener("click", () => {
    opts.sfx("tap");
    togglePause();
  });

  // ---- 事件 → 音效与提示 -----------------------------------------------------
  let lastBoom = 0;
  let toast = "";
  let toastUntil = 0;

  function say(line: string, now: number, ms = 1800): void {
    toast = line;
    toastUntil = now + ms;
    live.textContent = line;
  }

  function consumeEvents(now: number): void {
    for (const e of world.events) {
      switch (e.kind) {
        case "boom":
          // 一串连锁一帧里可能来好几条,90ms 内只响一声,不然像撒豆子
          if (now - lastBoom > 90) {
            opts.sfx("pop");
            lastBoom = now;
          }
          // 涟漪落账:中心白闪 + 按波次沿臂推进的花瓣串 + 末端星屑
          boomFx.noteBoom(board, e.waves, world.time, calmMotion);
          break;
        case "brick": {
          // 砖变成小花瓣散开(矢量粒子);reduced 不撒会飞的花瓣,静态涟漪已足够
          if (!calmMotion) {
            const bx = (e.cell % board.w) * cell + cell / 2;
            const by = Math.floor(e.cell / board.w) * cell + cell / 2;
            fx.push(...spawnPetals(bx, by, { count: 4, colors: PETAL_COLORS, size: Math.max(4, cell * 0.16) }));
          }
          break;
        }
        case "pickup":
          opts.sfx("coin");
          say(`${fighters[e.who].name} 捡到 ${ITEM_INFO[e.item].name}:${ITEM_INFO[e.item].line}`, now);
          break;
        case "bubble":
          opts.sfx("oops");
          say(
            world.rescue
              ? `${fighters[e.who].name} 困在泡泡里啦!队友快贴过去拍破它,${Math.round(RESCUE_MS / 1000)} 秒内都来得及。`
              : `${fighters[e.who].name} 被泡泡罩住啦,${Math.round(BUBBLE_MS / 1000)} 秒后自己晃出来。`,
            now
          );
          break;
        case "shield":
          opts.sfx("tap");
          say(`🛡 护盾替${fighters[e.who].name}挡了一下!还剩 ${e.left} 层。`, now, 1500);
          break;
        case "rescue":
          opts.sfx("win");
          say(`🤝 ${fighters[e.by].name}把${fighters[e.who].name}拍出来了!救人加一颗小星星。`, now, 2200);
          opts.onRescue?.(e.by);
          break;
        case "critter":
          if (e.done) opts.sfx("meow");
          break;
        case "exit":
          opts.sfx("jump");
          break;
        case "free":
          break;
      }
    }
    world.events.length = 0;
    tip.textContent = now < toastUntil ? toast : opts.tip;
  }

  // ---- 无尽收缩 -------------------------------------------------------------
  let shrinkAt = opts.shrinkRound && opts.shrinkRound > 0 ? shrinkDelay(opts.shrinkRound) : Infinity;
  let ring = 1;

  function maybeShrink(): void {
    if (world.time < shrinkAt) return;
    const cells = shrinkRing(board, ring);
    if (cells.length === 0) {
      shrinkAt = Infinity;
      return;
    }
    for (const c of cells) {
      // 站着人的格子先不封,给一点缓冲,下一轮再收
      if (fighters.some((f) => f.pos === c)) continue;
      board.cells[c] = TILE_HARD;
      world.items.delete(c);
    }
    world.bombs = world.bombs.filter((b) => board.cells[b.pos] !== TILE_HARD);
    world.critters = world.critters.filter((c) => board.cells[c.pos] !== TILE_HARD);
    ring++;
    shrinkAt = world.time + shrinkDelay(opts.shrinkRound ?? 1);
    opts.sfx("tap");
    toast = "楼板往里收了!快往中间靠。";
    toastUntil = performance.now() + 1600;
    live.textContent = toast;
  }

  // ---- 主循环 ---------------------------------------------------------------
  let raf = 0;
  let last = 0;
  let aiTick = 0;
  // 思考节奏(档位越低想得越慢)由 `ai.ts` 的节拍器统一管,那边的 `AI_TUNING.thinkMs`
  // 是唯一出处 —— 这里以前手抄过一份 260/150/70,抄出来的那份才是真上场的。
  const aiPace = fighters.map(() => createPacer());

  function intentsFor(now: number, dt: number): Intent[] {
    const out: Intent[] = [];
    for (let i = 0; i < seats; i++) {
      const f = fighters[i];
      if (f.ai) {
        const skill = opts.ai?.find((a) => a.index === i)?.skill ?? 2;
        const act = pacedAiAction(aiPace[i], world, i, skill, dt, aiTick);
        if (aiPace[i].fresh) aiTick++;
        out.push({ dir: act.dir, drop: act.drop, detonate: act.detonate, kick: false });
        continue;
      }
      // 摇杆优先:手指正推着的时候不理会键盘上按住没放的那一下
      const dir = stickDirs[i] >= 0 ? stickDirs[i] : pickDir(held[i], recent[i]);
      out.push({ dir, drop: pending[i].drop, detonate: pending[i].boom, kick: pending[i].kick });
      pending[i].drop = false;
      pending[i].boom = false;
      pending[i].kick = false;
    }
    return out;
  }

  function settle(res: MatchResult): void {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    releaseAll();
    opts.onDone(res);
  }

  function baseResult(): MatchResult {
    const mine = coop ? fighters.reduce((s, f) => s + f.bubbled, 0) : fighters[0].bubbled;
    const picked = fighters.reduce((s, f) => s + f.picked, 0);
    return {
      cleared: false,
      reason: "time",
      secondsLeft: secondsLeft(world),
      totalSeconds: lv.seconds,
      bubbled: mine,
      picked,
      saves: fighters.reduce((s, f) => s + f.saves, 0),
      winner: -1,
      carry: carryOf(fighters[0]),
    };
  }

  function checkEnd(): void {
    if (duel) {
      const w = roundWinner(world);
      if (w >= 0) {
        settle({ ...baseResult(), cleared: true, reason: "bubble", winner: w });
        return;
      }
      if (timeUp(world)) {
        settle({ ...baseResult(), cleared: false, reason: "time", winner: -1 });
      }
      return;
    }
    if (levelCleared(world)) {
      settle({ ...baseResult(), cleared: true, reason: world.goal === "exit" ? "escape" : "clear" });
      return;
    }
    if (opts.mode === "endless" && fighters[0].bubbleT > 0) {
      settle({ ...baseResult(), cleared: false, reason: "bubble" });
      return;
    }
    if (timeUp(world)) {
      settle({ ...baseResult(), cleared: false, reason: "time" });
    }
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (last === 0) last = now;
    const dt = Math.max(0, Math.min(48, now - last));
    last = now;
    if (paused || finished) {
      render();
      return;
    }

    // 炸心位置要在 stepWorld 之前记:boom 事件到手时炸弹已经从世界里消失了
    boomFx.noteBombs(world.bombs);
    stepWorld(world, dt, intentsFor(now, dt));
    // 埋弹下蹲要在 stepWorld 之后看:这一帧新落的泡泡才数得到
    fighterFx.update(world.bombs, seats, world.time);
    if (opts.shrinkRound) maybeShrink();
    consumeEvents(now);
    boomFx.step(world.time);
    fx = stepParticles(fx, dt / 1000);

    // 视觉插值:格子跳到目标位,人走得顺滑一点
    fighters.forEach((f, i) => {
      const v = views[i];
      const tx = xOf(board, f.pos);
      const ty = yOf(board, f.pos);
      const k = Math.min(1, dt / 90);
      v.rx += (tx - v.rx) * k;
      v.ry += (ty - v.ry) * k;
      const moving = Math.abs(tx - v.rx) + Math.abs(ty - v.ry) > 0.05;
      v.moving = moving && f.bubbleT <= 0;
      // 走路的小蹦跶:reduced 幅度减半(步态是「在动」的功能反馈,不清零)
      v.hop = v.moving ? Math.abs(Math.sin(now / 90)) * cell * (calmMotion ? 0.03 : 0.06) : 0;
    });

    refreshHud();
    render();
    checkEnd();
  }
  // 芯片先填字再量高:空 HUD 比填好字的矮一截,先量会把棋盘算大、把摇杆挤出屏幕
  refreshHud();
  layout();
  render();
  raf = requestAnimationFrame(frame);

  return {
    pause: () => {
      if (!paused) togglePause();
    },
    destroy() {
      // 退出必须归零到「这一局从来没发生过」:再挂一次不会有旧的帧、旧的键、旧的朗读跟过来。
      finished = true;
      paused = false;
      cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerup", releaseAll);
      window.removeEventListener("blur", releaseAll);
      window.removeEventListener("resize", onResize);
      releaseAll();
      for (let i = 0; i < seats; i++) {
        pending[i].drop = false;
        pending[i].boom = false;
        pending[i].kick = false;
      }
      // 粒子与动画计时账本全部归零
      fx = [];
      boomFx.reset();
      fighterFx.reset();
      world.events.length = 0;
      toast = "";
      toastUntil = 0;
      stopSpeaking();
      clearVeil();
      pauseBtn.remove();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 闯关(188 关)
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx, headSlot?: HTMLElement): { destroy: () => void } {
  const lv = buildLevel(ctx.level, 1);
  const runner = createMatch(stage, {
    level: lv,
    mode: "campaign",
    humans: 1,
    headSlot,
    banner: `第 ${ctx.level + 1} 关`,
    tip: `${goalText(lv.goal)}。${lv.hint}`,
    sfx: ctx.sfx,
    onDone: (res) => {
      if (res.cleared) {
        ctx.win(rateLevel(res.secondsLeft, lv.seconds, res.bubbled), winLine(res.secondsLeft, res.bubbled, res.picked));
      } else {
        ctx.lose(loseLine(res.reason === "bubble" ? "bubble" : "time"));
      }
    },
  });
  return { destroy: () => runner.destroy() };
}

// ---------------------------------------------------------------------------
// 模式外壳:统一的「◀ 回选关 + 标题 + 舞台」
// ---------------------------------------------------------------------------

interface Shell {
  stage: HTMLElement;
  chip: HTMLElement;
  head: HTMLElement;
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void, title: string): Shell {
  ensureCss(host);
  const wrap = el("div", "bmb-mode");
  const head = el("div", "bmb-mhead");
  const back = document.createElement("button");
  back.type = "button";
  back.className = "bmb-back";
  back.textContent = "◀ 回选关";
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = el("span", "bmb-chip", title);
  head.append(back, chip);
  const stage = el("div");
  wrap.append(head, stage);
  host.appendChild(wrap);
  return {
    stage,
    chip,
    head,
    destroy: () => wrap.remove(),
  };
}

function overBox(
  stage: HTMLElement,
  title: string,
  sub: string,
  buttons: { label: string; ghost?: boolean; onClick: () => void }[]
): void {
  stage.innerHTML = "";
  const box = el("div", "bmb-veil");
  box.style.position = "static";
  box.append(el("div", "bmb-veil-t", title), el("div", "bmb-veil-s", sub));
  const row = el("div", "bmb-veil-btns");
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `bmb-btn${b.ghost ? " bmb-btn--ghost" : ""}`;
    btn.textContent = b.label;
    btn.addEventListener("click", b.onClick);
    row.appendChild(btn);
  }
  box.appendChild(row);
  stage.appendChild(box);
}

// ---------------------------------------------------------------------------
// 对战(双人同屏 / 人机),先赢 3 局
// ---------------------------------------------------------------------------

const WIN_TARGET = 3;

function mountDuel(host: HTMLElement, api: GameApi, onBack: () => void, aiSkill: AiLevel | null): { destroy: () => void } {
  const label = aiSkill ? `🤖 人机对战 · ${AI_LABEL[aiSkill]}` : "⚔️ 双人对战";
  const shell = makeShell(host, api, onBack, `${label} · 先赢 ${WIN_TARGET} 局`);
  let runner: Runner | null = null;
  let round = 1;
  const scores = [0, 0];

  function refreshChip(): void {
    shell.chip.textContent = `${label} · ${P_NAME[0]} ${scores[0]} : ${scores[1]} ${P_NAME[1]} · 先赢 ${WIN_TARGET} 局`;
  }

  function finishMatch(winner: number): void {
    runner?.destroy();
    runner = null;
    api.play("win");
    api.addStars(2);
    overBox(
      shell.stage,
      `🏆 ${P_NAME[winner]}拿下整场!`,
      `${versusLine(scores, P_NAME)}。${
        winner === 1 && aiSkill
          ? "电脑这一档已经会算彩虹波了,想再练手就调高一档试试。"
          : "换个开局位置再来一场,布局思路会完全不一样。"
      }`,
      [
        {
          label: "🔁 再来一场",
          onClick: () => {
            api.play("tap");
            scores[0] = 0;
            scores[1] = 0;
            round = 1;
            startRound();
          },
        },
        { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
      ]
    );
  }

  function roundOver(winner: number, drawn: boolean): void {
    runner?.destroy();
    runner = null;
    if (!drawn && winner >= 0) scores[winner]++;
    refreshChip();
    const champion = matchWinner(scores, WIN_TARGET);
    if (champion >= 0) {
      finishMatch(champion);
      return;
    }
    const title = drawn ? "🤝 这一局打平" : `🫧 ${P_NAME[winner]}赢下第 ${round} 局!`;
    const sub = drawn
      ? `时间到,两个人都没被泡泡罩住。${versusLine(scores, P_NAME)},下一局再决胜负。`
      : `${versusLine(scores, P_NAME)}。${
          winner === 0 ? "堵得漂亮!" : "下一局先抢道具,彩虹波长起来就好打了。"
        }`;
    overBox(shell.stage, title, sub, [
      {
        label: "▶ 下一局",
        onClick: () => {
          api.play("tap");
          round++;
          startRound();
        },
      },
      { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
    ]);
  }

  function startRound(): void {
    runner?.destroy();
    shell.stage.innerHTML = "";
    refreshChip();
    runner = createMatch(shell.stage, {
      level: buildArena(round, 2),
      mode: aiSkill ? "ai" : "versus",
      humans: aiSkill ? 1 : 2,
      headSlot: shell.head,
      ai: aiSkill ? [{ index: 1, skill: aiSkill }] : [],
      banner: `第 ${round} 局 · ${scores[0]}:${scores[1]}`,
      tip: aiSkill
        ? "朵朵:WASD 走 · F 放泡 · V 踢泡 · G 拍破。把电脑逼进死胡同就赢了。"
        : `${KEY_HELP}谁先被泡泡罩住,这一局就算对方赢。`,
      sfx: (n) => api.play(n),
      onDone: (res) => roundOver(res.winner, res.winner < 0),
    });
  }

  startRound();

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽「泡泡塔」:一层一张小地图,清完就上楼
// ---------------------------------------------------------------------------

function mountTower(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "🗼 泡泡塔");
  let runner: Runner | null = null;
  let floor = 1;
  let carry: Carry | undefined;
  let best = save.getGameProgress(meta.id).endlessBest;

  function startFloor(): void {
    runner?.destroy();
    shell.stage.innerHTML = "";
    shell.chip.textContent = `🗼 泡泡塔 · 第 ${floor} 层 · 最高 第 ${best} 层`;
    runner = createMatch(shell.stage, {
      level: buildTowerFloor(floor),
      mode: "endless",
      humans: 1,
      headSlot: shell.head,
      banner: `第 ${floor} 层`,
      carry,
      // 高层的楼板会一圈圈往里收,逼着人往中间打,不许拖到最后一秒
      shrinkRound: floor >= TOWER_SHRINK_FROM ? floor - TOWER_SHRINK_FROM + 1 : undefined,
      tip:
        floor >= TOWER_SHRINK_FROM
          ? "把这一层的小怪全包成泡泡就上楼。这一层的楼板会往里收,早点往中间靠。"
          : "把这一层的小怪全包成泡泡就上楼,道具跟着你一起爬。被罩住或时间到,这次登塔就结束。",
      sfx: (n) => api.play(n),
      onDone: (res) => {
        if (res.cleared) {
          carry = res.carry;
          best = save.recordEndlessBest(meta.id, floor);
          api.play("win");
          api.addStars(1);
          floor++;
          startFloor();
          return;
        }
        // 爬到第 n 层但没打完:成绩记 n-1(已经站稳的最高层)
        const reached = Math.max(0, floor - 1);
        best = save.recordEndlessBest(meta.id, reached);
        runner?.destroy();
        runner = null;
        overBox(
          shell.stage,
          reached > 0 ? `🗼 爬到了第 ${reached} 层!` : "🫧 泡泡把你接住啦",
          endlessLine(reached, best),
          [
            {
              label: "🔁 从第 1 层再来",
              onClick: () => {
                api.play("tap");
                floor = 1;
                carry = undefined;
                startFloor();
              },
            },
            { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
          ]
        );
      },
    });
  }

  startFloor();

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 双人合作闯关
// ---------------------------------------------------------------------------

function readCoop(): number {
  try {
    return parseCoopProgress(localStorage.getItem(COOP_KEY));
  } catch {
    return 0;
  }
}

function writeCoop(level: number): void {
  try {
    localStorage.setItem(COOP_KEY, serializeCoopProgress(level));
  } catch {
    // 隐私模式写不进去也不影响这一次游玩
  }
}

function mountCoop(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "🤝 双人合作闯关");
  let runner: Runner | null = null;
  let level = readCoop();

  function startLevel(): void {
    runner?.destroy();
    shell.stage.innerHTML = "";
    const lv = buildCoopLevel(level);
    shell.chip.textContent = `🤝 双人合作 · 第 ${level + 1} 关 · ${CHAPTERS[lv.chapter].emoji} ${CHAPTERS[lv.chapter].name}`;
    runner = createMatch(shell.stage, {
      level: lv,
      mode: "coop",
      humans: 2,
      headSlot: shell.head,
      banner: `合作 第 ${level + 1} 关`,
      tip: `${goalText(lv.goal)}。谁被泡泡罩住,另一个人贴过去就能拍破救出来。${KEY_HELP}`,
      sfx: (n) => api.play(n),
      // 救一次人当场发一颗小星星:合作的好处要立刻看得见,不能等到结算
      onRescue: () => api.addStars(1),
      onDone: (res) => {
        runner?.destroy();
        runner = null;
        if (res.cleared) {
          api.play("win");
          api.addStars(1);
          const next = Math.min(187, level + 1);
          writeCoop(next);
          overBox(
            shell.stage,
            `🎉 第 ${level + 1} 关合作通过!`,
            coopLine(res.saves, res.picked, res.bubbled),
            [
              {
                label: "▶ 下一关",
                onClick: () => {
                  api.play("tap");
                  level = next;
                  startLevel();
                },
              },
              { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
            ]
          );
        } else {
          overBox(shell.stage, "⏱ 时间到啦", loseLine("time"), [
            {
              label: "🔁 再试一次",
              onClick: () => {
                api.play("tap");
                startLevel();
              },
            },
            { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
          ]);
        }
      },
    });
  }

  startLevel();

  return {
    destroy() {
      runner?.destroy();
      runner = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载:模式条 + 188 关地图 + 直达第 N 关
// ---------------------------------------------------------------------------

export interface BombBuddiesHandle {
  /** 平台「直达第 N 关」(1 基),返回真正打开的那一关 */
  openCampaignLevel: (n: number) => number;
  destroy: () => void;
}

/**
 * 地址栏上的 `?level=N`(1 基)。
 *
 * 壳层给了 `initialLevel` 就用壳层的,没给才看地址栏——
 * 和 gold-hook / monster-crisis 同一套约定,家长把链接直接发给孩子也能落到那一关。
 */
export function levelFromQuery(search: string | null): number | null {
  if (!search) return null;
  const raw = new URLSearchParams(search).get("level");
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
}

export function mount(api: GameApi): BombBuddiesHandle {
  ensureCss(api.root);
  const root = el("div", "bmb-root");
  const bar = el("div", "bmb-bar");
  const picks = el("div", "bmb-picks");
  const levelHost = el("div");
  const modeHost = el("div", "bmb-modehost");
  modeHost.hidden = true;
  root.append(bar, picks, levelHost, modeHost);
  api.root.appendChild(root);

  let aiSkill: AiLevel = 2;

  const vsBtn = document.createElement("button");
  vsBtn.type = "button";
  vsBtn.className = "bmb-open bmb-open--vs";
  vsBtn.textContent = "⚔️ 双人对战";
  const aiBtn = document.createElement("button");
  aiBtn.type = "button";
  aiBtn.className = "bmb-open bmb-open--ai";
  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "bmb-open";
  const coopBtn = document.createElement("button");
  coopBtn.type = "button";
  coopBtn.className = "bmb-open bmb-open--co";
  bar.append(vsBtn, aiBtn, endlessBtn, coopBtn);

  const pickBtns: HTMLButtonElement[] = [];
  ([1, 2, 3] as AiLevel[]).forEach((skill) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bmb-pick";
    btn.textContent = `🤖 ${AI_LABEL[skill]}`;
    btn.setAttribute("aria-label", `电脑难度:${AI_LABEL[skill]}`);
    btn.addEventListener("click", () => {
      api.play("tap");
      aiSkill = skill;
      refreshBar();
    });
    pickBtns.push(btn);
    picks.appendChild(btn);
  });

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `🗼 泡泡塔 · 最高 第 ${best} 层` : "🗼 泡泡塔";
    aiBtn.textContent = `🤖 人机对战 · ${AI_LABEL[aiSkill]}`;
    coopBtn.textContent = `🤝 双人合作 · 第 ${readCoop() + 1} 关`;
    pickBtns.forEach((btn, i) => btn.setAttribute("aria-pressed", String(i + 1 === aiSkill)));
  }

  let mode: { destroy: () => void } | null = null;
  let direct: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    modeHost.innerHTML = "";
    levelHost.hidden = false;
    bar.hidden = false;
    picks.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, back: () => void) => { destroy: () => void }): void {
    if (mode || direct) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    picks.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  function closeDirect(): void {
    direct?.destroy();
    direct = null;
    modeHost.hidden = true;
    modeHost.innerHTML = "";
    levelHost.hidden = false;
    bar.hidden = false;
    picks.hidden = false;
    refreshBar();
  }

  /**
   * 直达第 i 关(0 基)。
   *
   * 地图走的是平台 `mountLevelGame`,它只吐一个 `destroy`,没有「从第 N 关开始」的口子,
   * 所以本款自己开一条:借模式外壳把这一关单独摆出来,过关 / 失败都能接着走。
   */
  function openDirectLevel(i: number): void {
    mode?.destroy();
    mode = null;
    direct?.destroy();
    direct = null;
    levelHost.hidden = true;
    bar.hidden = true;
    picks.hidden = true;
    modeHost.hidden = false;
    modeHost.innerHTML = "";

    const lv = buildLevel(i, 1);
    const ch = CHAPTERS[lv.chapter];
    const shell = makeShell(modeHost, api, closeDirect, `${ch.emoji} ${ch.name} · 第 ${i + 1} 关`);
    let handle: { destroy: () => void } | null = null;
    let settled = false;

    // 跳关走平台那道家长门。选关地图上本来就有一颗(188 框架自带),
    // 直达进来的这条路以前没有——卡在某一关的孩子从家长发的链接点进来就出不去了。
    // 壳层没注册 requestSkip 就干脆不挂按钮,单测环境保持干净。
    const askSkip = getLevelExtras().requestSkip;
    if (askSkip && i < TOTAL_LEVELS - 1) {
      const skipBtn = document.createElement("button");
      skipBtn.type = "button";
      skipBtn.className = "bmb-btn bmb-btn--ghost";
      skipBtn.textContent = "⏭️ 跳过这一关";
      let asking = false;
      skipBtn.addEventListener("click", () => {
        if (asking || settled) return;
        asking = true;
        skipBtn.disabled = true;
        api.play("tap");
        void Promise.resolve(askSkip(meta.id, i))
          .then((pass) => {
            if (!pass) return;
            settled = true;
            // 放行 = 这一关记 0 星、解锁下一关,战役星数一颗不送
            markSkipped(meta.id, i);
            openDirectLevel(i + 1);
          })
          .finally(() => {
            asking = false;
            skipBtn.disabled = false;
          });
      });
      shell.head.appendChild(skipBtn);
    }

    function finish(title: string, msg: string, buttons: { label: string; ghost?: boolean; go: () => void }[]): void {
      handle?.destroy();
      handle = null;
      overBox(
        shell.stage,
        title,
        msg,
        buttons.map((b) => ({
          label: b.label,
          ghost: b.ghost,
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
      chapterIndex: lv.chapter,
      indexInChapter: withinChapter(i),
      win: (stars, msg) => {
        if (settled) return;
        settled = true;
        const prev = loadStars(meta.id)[i] ?? 0;
        saveStar(meta.id, i, stars);
        if (stars > prev) api.addStars(stars - prev);
        api.play("win");
        const buttons: { label: string; ghost?: boolean; go: () => void }[] = [];
        if (i + 1 < TOTAL_LEVELS) buttons.push({ label: "▶ 下一关", go: () => openDirectLevel(i + 1) });
        buttons.push({ label: "🔁 再玩一次", go: () => openDirectLevel(i) });
        buttons.push({ label: "🗺️ 回选关", ghost: true, go: closeDirect });
        finish(`🌟 第 ${i + 1} 关过关!`, msg ?? "放泡泡的位置挑得很准!", buttons);
      },
      lose: (msg) => {
        if (settled) return;
        settled = true;
        api.play("oops");
        finish("💪 就差一点点", msg ?? "再来一次一定行!", [
          { label: "🔁 再试一次", go: () => openDirectLevel(i) },
          { label: "🗺️ 回选关", ghost: true, go: closeDirect },
        ]);
      },
      sfx: (n) => api.play(n),
      bonusStars: (n) => api.addStars(n),
    };

    handle = playLevel(shell.stage, ctx, shell.head);
    direct = {
      destroy() {
        handle?.destroy();
        handle = null;
        shell.destroy();
      },
    };
  }

  function openCampaignLevel(n: number): number {
    const i = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(n) - 1));
    openDirectLevel(i);
    return i + 1;
  }

  vsBtn.addEventListener("click", () => openMode((h, a, b) => mountDuel(h, a, b, null)));
  aiBtn.addEventListener("click", () => openMode((h, a, b) => mountDuel(h, a, b, aiSkill)));
  endlessBtn.addEventListener("click", () => openMode(mountTower));
  coopBtn.addEventListener("click", () => openMode(mountCoop));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 开打的时候把模式条收起来:手机竖屏上这一百来像素正好够棋盘和摇杆同框
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        picks.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy: () => {
            if (!mode && !direct) {
              bar.hidden = false;
              picks.hidden = false;
            }
            handle.destroy();
          },
        };
      },
      guide: GUIDE,
      mapHint: "放泡泡之前先想好往哪躲,拐角后面永远安全。",
      grandMessage: "188 关全部通关,你就是泡泡布阵里最会算退路的那一个!",
      guideTitle: "泡泡布阵 · 放泡手册",
    }
  );

  // 壳层给了 `initialLevel` 就听壳层的,没给才看地址栏 `?level=`
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
      stopSpeaking();
      root.remove();
    },
  };
}
