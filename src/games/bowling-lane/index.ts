import { meta } from "./meta";
export { meta };

// 保龄球小馆:蓄力 → 落点 → 旋转,三下按键定一球。
//
// 三种玩法共用同一张「投球台」`createDesk`:
//  - 闯关:188 关八大主题,一关两到四格,目标分一路涨,后面几章还混特殊瓶(走 level99 框架);
//  - 双人对战:整整十格,朵朵和星星轮流投,也可以换成三档电脑球手;
//  - 无尽:一格一格往下打,哪一格没够到目标分就结束。
//
// 记分完全交给 scoring.ts 那个纯函数,画面上看到的每一次滚瓶也都是 logic.ts 真算出来的,
// 和单测跑的是同一套代码。
import { save } from "../../engine/save";
import { stagePlayRoom } from "../../engine/stageRoom";
import { shade, withAlpha } from "../../art/kit/palette";
import { mirrorEllipse, reflectStreak } from "../../art/kit/mirror";
import { mountLevelGame, type GameApi, type PlayCtx, type SoundName } from "../level99";
import GUIDE from "./guide";
import {
  BL_COLORS,
  BL_GOLD,
  BL_HALL_LIFT_ALPHA,
  BL_HALL_TINT,
  BL_HALL_TINT_ALPHA,
  FOLLOW_IN_MS,
  FOLLOW_OUT_MS,
  FOLLOW_ZOOM,
  OIL_STREAK_MS,
  drawBall,
  drawCeilingLamp,
  drawNeighborLanes,
  drawPin,
  drawStar,
  neonAlpha,
  pinFallAngle,
  pinFallDir,
  seamAlphaAt,
  seamXs,
  strikeFlashOn,
} from "./visual13";
import { CHAPTERS, buildEndlessFrame, buildLevel, buildVersus, chapterOfLevel } from "./levels";
import {
  AI_LABEL,
  BALL_R,
  DECK_END,
  GUTTER_EDGE,
  HEAD_Y,
  LANE_LEN,
  LANE_W,
  PIN_R,
  STAGE_LABEL,
  STAGE_MS,
  aiShot,
  aimFromSweep,
  canUndo,
  clamp,
  createLane,
  downFlags,
  endlessLine,
  isPauseKey,
  keyToAction,
  laneProject,
  loseLine,
  pinShift,
  pinSpot,
  pocketLeftX,
  pocketX,
  powerFromSweep,
  prevStage,
  rateLevel,
  releaseX,
  shotLine,
  spinFromSweep,
  standingAfter,
  stepLane,
  sweep,
  versusLine,
  winLine,
  type AiLevel,
  type LaneState,
  type LaneView,
  type PinKind,
  type Shot,
  type Stage,
} from "./logic";
import { PINS, frameMarks, longestStrikeRun, scoreGame, totalScore, turnState, type FrameScore } from "./scoring";

const P_NAME = ["朵朵", "星星"];
const P_EMOJI = ["🌸", "⭐"];
const P_COLOR = ["#e8558f", "#3f7fd6"];

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.bl-wrap{--bl-ink:#42406b;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--bl-ink);
  display:flex;flex-direction:column;gap:7px;align-items:center;user-select:none;-webkit-user-select:none;
  touch-action:manipulation;position:relative;width:100%;}
.bl-hud{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;width:100%;}
/* 比分芯片与记分表是这一款唯二要读数字的地方,规格第八节写着字号 ≥ 14px:
   下面窄屏 / 矮屏两档只收内边距,不动字号。 */
.bl-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:14px;font-weight:800;white-space:nowrap;
  box-shadow:0 2px 5px rgba(110,120,170,.18);}
.bl-chip-p0{color:#a8306a;background:#ffeaf3;}
.bl-chip-p1{color:#28568f;background:#e6f0ff;}
.bl-chip-now{outline:2px solid #ffb43c;}
.bl-btn{border:none;border-radius:999px;padding:6px 13px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7aa8e0,#5585c8);box-shadow:0 3px 0 #3f6da8;
  min-height:44px;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;}
.bl-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #3f6da8;}
.bl-btn:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bl-btn--ghost{background:linear-gradient(180deg,#b3aecd,#918bb0);box-shadow:0 3px 0 #736e8f;}
.bl-btn--ghost:active{box-shadow:0 1px 0 #736e8f;}
.bl-lane{border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(100,110,160,.22);line-height:0;}
.bl-lane canvas{display:block;}
.bl-card{display:flex;gap:2px;justify-content:center;flex-wrap:nowrap;width:100%;overflow-x:auto;padding-bottom:2px;}
/* 1.3 计分板卡片化:白 72% 底、圆角、当前格靠 .bl-fr-now 的高亮描边 */
.bl-fr{background:rgba(255,255,255,.72);border:1px solid rgba(110,120,170,.14);border-radius:10px;min-width:36px;
  flex:0 0 auto;text-align:center;box-shadow:0 1px 3px rgba(110,120,170,.2);padding:1px 0 2px;}
.bl-fr-now{outline:2px solid #ffb43c;}
.bl-fr-n{font-size:9px;font-weight:800;color:#9a93b8;line-height:1.2;}
.bl-fr-m{font-size:14px;font-weight:900;letter-spacing:1px;line-height:1.25;min-height:18px;}
.bl-fr-s{font-size:14px;font-weight:800;color:#5d5786;line-height:1.2;min-height:17px;}
.bl-gauges{display:flex;flex-direction:column;gap:4px;width:100%;max-width:520px;}
.bl-gauge{position:relative;height:20px;border-radius:999px;background:#efecf8;overflow:hidden;
  box-shadow:inset 0 2px 4px rgba(110,110,160,.18);}
.bl-gauge--power{background:linear-gradient(90deg,#d9f0e4,#ffe6a8,#ffc2c2);}
.bl-gauge--aim{background:linear-gradient(90deg,#dfe9ff,#ffffff,#dfe9ff);}
.bl-gauge--spin{background:linear-gradient(90deg,#e6dcff,#ffffff,#ffe1ef);}
.bl-gauge-tag{position:absolute;left:8px;top:0;line-height:20px;font-size:11px;font-weight:900;color:#6d6795;}
.bl-gauge-val{position:absolute;right:8px;top:0;line-height:20px;font-size:11px;font-weight:900;color:#6d6795;}
.bl-needle{position:absolute;top:1px;width:6px;height:18px;border-radius:3px;background:#4a4270;margin-left:-3px;}
.bl-gauge--done .bl-needle{background:#e8558f;}
.bl-gauge--idle{opacity:.42;}
.bl-tip{font-size:12.5px;font-weight:700;line-height:1.5;text-align:center;max-width:620px;color:#645e8c;
  background:#ffffffcc;border-radius:12px;padding:5px 10px;}
/* 三段式的三颗控件(停指针 / 左右微调 / 退回一段)热区一律 ≥ 44px。 */
.bl-roll{border:none;border-radius:18px;padding:12px 30px;font-size:17px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#f79ac0,#e8558f);box-shadow:0 4px 0 #bf3a70;
  min-width:190px;min-height:44px;}
.bl-roll:active{transform:translateY(2px);box-shadow:0 2px 0 #bf3a70;}
.bl-roll:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bl-roll--p1{background:linear-gradient(180deg,#8db6ec,#3f7fd6);box-shadow:0 4px 0 #2f63aa;}
.bl-roll--p1:active{box-shadow:0 2px 0 #2f63aa;}
.bl-roll[disabled]{opacity:.5;cursor:default;transform:none;}
.bl-nudge{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;}
/* 1.3:左右微调箭头加圆钮质感(顶部受光的radial),热区不动 */
.bl-nudge button{border:none;border-radius:14px;width:48px;height:44px;min-height:44px;font-size:17px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#4a4270;background:radial-gradient(circle at 50% 34%,#ffffff,#e9e3f6);
  box-shadow:0 3px 0 rgba(130,130,180,.35);}
.bl-nudge button:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(130,130,180,.35);}
.bl-nudge button:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bl-veil{position:absolute;inset:0;background:rgba(252,253,255,.95);border-radius:16px;z-index:6;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:16px;}
.bl-veil-t{font-size:20px;font-weight:900;color:#3f6da8;}
.bl-veil-s{font-size:13.5px;font-weight:700;color:#645e8c;line-height:1.6;max-width:340px;}
.bl-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.bl-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#eef4ff,#fdf1f6);display:flex;flex-direction:column;gap:8px;}
.bl-mhead{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.bl-back{border:none;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:900;cursor:pointer;
  min-height:44px;box-sizing:border-box;
  font-family:inherit;background:#ffffffdd;color:#3f6da8;box-shadow:0 3px 0 rgba(90,120,180,.28);}
.bl-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(90,120,180,.28);}
.bl-back:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bl-bar{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-bottom:7px;
  position:sticky;top:0;z-index:8;padding:4px 0 2px;
  background:linear-gradient(180deg,#eef4ff,#fdf1f6);}
/* display:flex 会盖掉浏览器自带的 [hidden]{display:none},这里补回来 */
.bl-bar[hidden],.bl-picks[hidden]{display:none;}
.bl-open{border:none;border-radius:999px;padding:8px 14px;font-size:13.5px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7aa8e0,#5585c8);box-shadow:0 4px 0 #3f6da8;
  min-height:44px;display:inline-flex;align-items:center;}
.bl-open:active{transform:translateY(2px);box-shadow:0 2px 0 #3f6da8;}
.bl-open:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bl-open--ai{background:linear-gradient(180deg,#6fbfa8,#4c9d86);box-shadow:0 4px 0 #3b7c69;}
.bl-open--en{background:linear-gradient(180deg,#9a86e4,#7358cc);box-shadow:0 4px 0 #5b43a3;}
.bl-picks{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;
  position:sticky;top:48px;z-index:7;padding:0 0 4px;
  background:linear-gradient(180deg,#fdf1f6,#fff8fb);}
.bl-pick{border:none;border-radius:14px;padding:7px 13px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffe0;color:#544d7d;box-shadow:0 3px 0 rgba(130,130,190,.35);
  min-height:44px;display:inline-flex;align-items:center;}
.bl-pick[aria-pressed="true"]{background:linear-gradient(180deg,#7aa8e0,#5585c8);color:#fff;box-shadow:0 3px 0 #3f6da8;}
.bl-pick:active{transform:translateY(2px);}
.bl-pick:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
/* ---- 1.2 新增(bwl- 前缀) ---- */
/* 「↩ 重来」:三段式的反悔键,得跟停指针一样好按 */
.bwl-undo{border:none;border-radius:14px;min-width:52px;height:44px;padding:0 10px;font-size:14px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#6a4f7d;background:#fff0f7;box-shadow:0 3px 0 rgba(170,120,160,.38);}
.bwl-undo:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,120,160,.38);}
.bwl-undo:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.bwl-undo[disabled]{opacity:.4;cursor:default;transform:none;}
/* 这一关的花样:护栏 / 移动瓶 / 限球数……一行小字挂在 HUD 上 */
.bwl-twist{background:#fff7e2;color:#8a6a24;}
.bwl-legend{font-size:11.5px;font-weight:800;color:#7b6f9e;text-align:center;line-height:1.5;max-width:620px;}
@media (max-width:420px){
  .bl-chip{padding:3px 8px;}
  .bl-fr{min-width:32px;}
  .bl-fr-m{letter-spacing:0;}
  .bl-roll{min-width:150px;padding:11px 22px;font-size:16px;}
  .bwl-legend{font-size:11px;}
  .bwl-undo{min-width:46px;padding:0 6px;}
}
/* r18 B:极矮横屏内容仍可能溢出(l99 舞台已可滚),三段式的「停!」是每球必按的
   核心键,钉在可视底不许滚丢。 */
@media (max-height:520px){
  .bl-nudge{position:sticky;bottom:0;z-index:6;padding:4px 0 2px;
    background:linear-gradient(180deg,rgba(253,241,246,0),#fdf1f6 40%);}
  .bwl-legend{display:none;}
}
/* 手机竖屏统共 667 像素高,球道上面还压着标题栏,每一行都收一点 */
@media (max-height:720px){
  .bl-wrap{gap:5px;}
  .bl-chip{padding:2px 7px;}
  .bl-tip{font-size:11.5px;line-height:1.35;padding:3px 9px;}
  .bl-gauge{height:18px;}
  .bl-needle{height:16px;}
  .bl-gauge-tag,.bl-gauge-val{line-height:18px;}
  .bl-roll{padding:10px 20px;}
  .bwl-legend{display:none;}
}
@media (max-height:840px) and (min-height:501px){
  .bl-nudge{position:sticky;bottom:0;z-index:6;padding:4px 0 2px;
    background:linear-gradient(180deg,rgba(253,241,246,0),#fdf1f6 40%);}
}
@media (max-height:840px) and (min-height:721px){
  .bl-wrap{gap:5px;}
  .bl-nudge{position:sticky;bottom:0;z-index:6;padding:4px 0 2px;
    background:linear-gradient(180deg,rgba(253,241,246,0),#fdf1f6 40%);}
}
@media (prefers-reduced-motion:reduce){
  .bl-btn:active,.bl-roll:active,.bl-pick:active,.bl-nudge button:active{transform:none;}
}
`;

let cssInjected = false;
function ensureCss(host: HTMLElement): void {
  if (cssInjected && document.getElementById("bl-style")) return;
  const style = document.createElement("style");
  style.id = "bl-style";
  style.textContent = CSS;
  (document.head ?? host).appendChild(style);
  cssInjected = true;
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(cls: string, text: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = cls;
  btn.textContent = text;
  return btn;
}

// ---------------------------------------------------------------------------
// 投球台:三种玩法共用的一整局
// ---------------------------------------------------------------------------

export interface SeatPlan {
  name: string;
  emoji: string;
  color: string;
  /** null = 真人,数字 = 电脑档位 */
  ai: AiLevel | null;
}

export interface DeskResult {
  /** 每个座位的总分 */
  totals: number[];
  /** 每个座位打出的全中次数 */
  strikes: number[];
  /** 每个座位连着全中最多几次 */
  chain: number[];
  /** 每个座位一共投了几球 */
  balls: number[];
  /** 赢家座位号;只有一个人玩就是 0,打平是 -1 */
  winner: number;
}

interface DeskOpts {
  frames: number;
  seats: SeatPlan[];
  /** 这一格摆什么瓶 */
  kindsFor: (frame: number) => PinKind[];
  /** 这一格开球摆哪几个瓶(少瓶挑战那一章会留一副分瓶);不给就是满架 */
  rackFor?: (frame: number) => boolean[];
  oil: number;
  /** 球沟上架护栏:洗不了沟 */
  bumpers?: boolean;
  /** 瓶阵横移幅度 */
  drift?: number;
  /** 球沟宽度(无尽越往后越宽,球道就越窄) */
  gutter?: number;
  /** 口袋辅助线的浓淡 0..1 */
  guide?: number;
  /** 这一局最多投几球;0 = 不限 */
  ballLimit?: number;
  banner: string;
  tip: string;
  /** 记分牌上显示的目标分(没有就不显示) */
  target?: number;
  sfx: (name: SoundName) => void;
  onDone: (res: DeskResult) => void;
}

interface Runner {
  destroy: () => void;
}

interface SeatRun {
  plan: SeatPlan;
  rolls: number[];
  /** 这一架瓶还站着哪几个 */
  standing: boolean[];
  kinds: PinKind[];
}

/** 方向键微调落点,一下挪这么多 */
const NUDGE_STEP = 0.06;

function createDesk(host: HTMLElement, opts: DeskOpts): Runner {
  ensureCss(host);
  const frames = Math.max(1, Math.round(opts.frames));
  const rackFor = (frame: number): boolean[] =>
    opts.rackFor ? opts.rackFor(frame).slice() : new Array<boolean>(PINS).fill(true);
  const ballLimit = Math.max(0, Math.round(opts.ballLimit ?? 0));
  const guideAt = clamp(opts.guide ?? 0, 0, 1);
  const gutterW = clamp(opts.gutter ?? GUTTER_EDGE, GUTTER_EDGE, LANE_W / 2 - BALL_R - 2);
  const seats: SeatRun[] = opts.seats.map((plan) => ({
    plan,
    rolls: [],
    standing: rackFor(0),
    kinds: opts.kindsFor(0),
  }));
  const solo = seats.length === 1;
  const calm = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- DOM -------------------------------------------------------------------
  const wrap = el("div", "bl-wrap");
  const hud = el("div", "bl-hud");
  const chipBanner = el("span", "bl-chip", opts.banner);
  const chipSeats = seats.map((_, i) => el("span", `bl-chip bl-chip-p${i}`, ""));
  const pauseBtn = button("bl-btn bl-btn--ghost", "⏸ 暂停");
  hud.append(chipBanner, ...chipSeats, pauseBtn);

  // 这一关有什么花样,先在 HUD 上说清楚,别让人打了两球才发现瓶阵在动
  const twists: string[] = [];
  if (opts.bumpers) twists.push("🛟 有护栏");
  if ((opts.drift ?? 0) > 0) twists.push("↔️ 瓶阵会挪");
  if ((opts.gutter ?? GUTTER_EDGE) > GUTTER_EDGE) twists.push("↕️ 球道变窄");
  if ((opts.ballLimit ?? 0) > 0) twists.push(`🎯 限 ${opts.ballLimit} 球`);
  if (twists.length > 0) hud.appendChild(el("span", "bl-chip bwl-twist", twists.join(" · ")));

  const laneBox = el("div", "bl-lane");
  const canvas = document.createElement("canvas");
  laneBox.appendChild(canvas);

  const card = el("div", "bl-card");
  const gauges = el("div", "bl-gauges");

  const gaugeOrder: Array<Exclude<Stage, "roll">> = ["power", "aim", "spin"];
  const gaugeEls = gaugeOrder.map((stage) => {
    const bar = el("div", `bl-gauge bl-gauge--${stage} bl-gauge--idle`);
    const tag = el("span", "bl-gauge-tag", STAGE_LABEL[stage]);
    const val = el("span", "bl-gauge-val", "");
    const needle = el("div", "bl-needle");
    bar.append(tag, val, needle);
    gauges.appendChild(bar);
    return { bar, val, needle };
  });

  const tip = el("div", "bl-tip", opts.tip);
  const controls = el("div", "bl-nudge");
  const leftBtn = button("", "◀");
  leftBtn.setAttribute("aria-label", "落点往左挪一点");
  const rollBtn = button("bl-roll", "🎳 停!");
  const rightBtn = button("", "▶");
  rightBtn.setAttribute("aria-label", "落点往右挪一点");
  const undoBtn = button("bwl-undo", "↩ 重来");
  undoBtn.setAttribute("aria-label", "退回上一段重新来");
  controls.append(leftBtn, rollBtn, rightBtn, undoBtn);

  const legend = el(
    "div",
    "bwl-legend",
    "① 力度 ② 落点 ③ 旋转,一段一下。出手前随时可以按「↩ 重来」退回上一段。"
  );

  wrap.append(hud, laneBox, card, gauges, tip, controls, legend);
  host.appendChild(wrap);

  const g = canvas.getContext("2d");

  // ---- 画面尺寸 ---------------------------------------------------------------
  // 伪 2.5D:球道**竖着**画,出手线在屏幕底下、瓶台在最上面,近宽远窄的一块梯形。
  // 所有碰撞还是在俯视坐标里算(logic.ts),这里只是把 (x, y) 投影到画布上。
  const view: LaneView = { w: 320, h: 360 };

  /** 球道下面自家的记分牌/指针/按钮实测总高(绝对定位的遮罩不算流内,跳过) */
  function extrasHeight(): number {
    let sum = 0;
    for (const child of Array.from(wrap.children)) {
      // 不用 instanceof HTMLElement:单测桩环境里根本没有这个全局,引用即炸
      if (child === laneBox) continue;
      const box = child as HTMLElement;
      if (box.hidden) continue;
      try {
        if (typeof getComputedStyle === "function" && getComputedStyle(box).position === "absolute") continue;
      } catch {
        // 单测桩没有 getComputedStyle 也不能炸
      }
      sum += box.offsetHeight || 0;
    }
    return sum;
  }

  function layout(): void {
    const avail = Math.max(240, Math.min(host.clientWidth || 360, 520));
    // 上下还压着 HUD、记分牌、三条指针和按钮。矮屏按舞台剩余高度缩球道。
    const guessed = clamp((window.innerHeight || 700) - 386, 150, 460);
    // r18 B:舞台余高还要扣掉自家 HUD/记分牌/指针/按钮的实测高度,不然 768/844 高
    // 的屏上球道吃满余高,「停!(蓄力)」被顶到视口外(量不到就退回老猜法)。
    const room = stagePlayRoom(host, { w: avail, h: guessed }).h;
    const extras = extrasHeight();
    const roomH = clamp(extras > 0 ? room - extras - 40 : Math.min(room, guessed), 150, 460);
    // 球道高度被压扁时同步收窄,近宽远窄的梯形不至于摊成一条横带
    const w = Math.round(Math.min(avail, Math.max(260, roomH / 0.85)));
    const h = Math.round(Math.min(roomH, w * 1.25));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    view.w = w;
    view.h = h;
    g?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  layout();
  const onResize = (): void => {
    layout();
    render();
  };
  window.addEventListener("resize", onResize);
  // 首帧时提示行/记分牌还没换行定型,extras 量偏小;渲染稳定后再校一次。
  // rAF 句柄记下来,destroy 时取消,守卫测试数 rAF 是要归零的。
  let settleRaf = 0;
  if (typeof requestAnimationFrame === "function") {
    settleRaf = requestAnimationFrame(() => {
      settleRaf = requestAnimationFrame(onResize);
    });
  }

  // ---- 一局的状态 --------------------------------------------------------------
  let turnSeat = 0;
  let stage: Stage = "power";
  let stageStart = 0;
  let clock = 0;
  let pending: Shot = { power: 0.6, aim: 0, spin: 0 };
  let aimNudge = 0;
  let lane: LaneState | null = null;
  let paused = false;
  let finished = false;
  let waitUntil = 0;
  let aiThinkUntil = 0;
  /** 上一球算完了,等提示语念完再开下一球 */
  let awaitingNextShot = false;
  let toast = "";
  let toastUntil = 0;
  let shotSeed = 0;
  /** 「跟球」运镜的强度 0..1:出手时涨起来,球停下就落回去 */
  let follow = 0;

  /** 这一局的球投完了没(限球数的关卡里,球用光就得收摊) */
  function outOfBalls(seat: SeatRun): boolean {
    return ballLimit > 0 && seat.rolls.length >= ballLimit;
  }

  /** 下一球该谁投:格数落后的先投,一样多就按座位顺序 */
  function pickSeat(): number {
    let best = -1;
    let bestFrame = Number.POSITIVE_INFINITY;
    for (let i = 0; i < seats.length; i++) {
      const st = turnState(seats[i].rolls, frames);
      if (st.over || outOfBalls(seats[i])) continue;
      if (st.frame < bestFrame) {
        bestFrame = st.frame;
        best = i;
      }
    }
    return best;
  }

  function currentSeat(): SeatRun {
    return seats[turnSeat];
  }

  function beginShot(): void {
    const seat = currentSeat();
    const st = turnState(seat.rolls, frames);
    if (st.freshRack) {
      seat.kinds = opts.kindsFor(st.frame);
      seat.standing = rackFor(st.frame);
    }
    aimNudge = 0;
    pending = { power: 0.6, aim: 0, spin: 0 };
    stage = "power";
    stageStart = clock;
    lane = null;
    if (seat.plan.ai) aiThinkUntil = clock + 700;
    refreshHud();
  }

  function stageValue(): number {
    if (stage === "roll") return 0;
    return sweep(clock - stageStart, STAGE_MS[stage]);
  }

  /** 按下确认:锁住当前这一段,进入下一段;三段都锁完就滚球 */
  function lockStage(): void {
    if (finished || paused || lane || stage === "roll") return;
    const v = stageValue();
    if (stage === "power") {
      pending.power = powerFromSweep(v);
      stage = "aim";
      stageStart = clock;
      opts.sfx("tap");
    } else if (stage === "aim") {
      pending.aim = aimFromSweep(v);
      stage = "spin";
      stageStart = clock;
      opts.sfx("tap");
    } else {
      pending.spin = spinFromSweep(v);
      stage = "roll";
      opts.sfx("jump");
      startRoll();
    }
    refreshGauges();
  }

  /**
   * 退回上一段重新来。三段里的任何一段,在球出手之前都能反悔——
   * 退回去那一段的指针重新开始跑,之前锁的值作废。
   */
  function stepBack(): void {
    if (finished || paused || lane || !canUndo(stage)) return;
    stage = prevStage(stage);
    stageStart = clock;
    opts.sfx("tap");
    refreshGauges();
    refreshHud();
  }

  function nudge(dir: -1 | 1): void {
    if (finished || paused || lane) return;
    aimNudge = clamp(aimNudge + dir * NUDGE_STEP, -0.3, 0.3);
    opts.sfx("tap");
    refreshHud();
  }

  function startRoll(): void {
    const seat = currentSeat();
    const shot: Shot = {
      power: pending.power,
      aim: clamp(pending.aim + aimNudge, -1, 1),
      spin: pending.spin,
    };
    lane = createLane(
      {
        standing: seat.standing.slice(),
        kinds: seat.kinds,
        oil: opts.oil,
        bumpers: opts.bumpers,
        drift: opts.drift,
        gutter: gutterW,
      },
      shot
    );
    // 倒瓶动画的记账清零:这一球谁倒下、往哪边倒,重新记
    downAt.fill(0);
    downDir.fill(1);
    shotSeed++;
  }

  function finishRoll(): void {
    if (!lane) return;
    const seat = currentSeat();
    const st = turnState(seat.rolls, frames);
    const knocked = downFlags(lane).filter(Boolean).length;
    const gutter = lane.ball.gutter;
    seat.standing = standingAfter(lane);
    seat.rolls.push(knocked);
    lane = null;

    if (knocked === PINS && st.ball === 0) {
      opts.sfx("win");
      strikeAt = clock;
      throwConfetti();
    } else if (knocked > 0) opts.sfx("coin");
    else opts.sfx("oops");
    toast = `${seat.plan.emoji}${seat.plan.name}:${shotLine(knocked, st.ball === 0, gutter)}`;
    toastUntil = clock + 1500;

    refreshCard();
    refreshHud();

    const next = pickSeat();
    if (next < 0) {
      settle();
      return;
    }
    turnSeat = next;
    waitUntil = clock + 900;
    awaitingNextShot = true;
  }

  function settle(): void {
    if (finished) return;
    finished = true;
    const totals = seats.map((s) => totalScore(s.rolls, frames));
    const strikes = seats.map((s) =>
      scoreGame(s.rolls, frames).frames.filter((f) => f.kind === "strike").length
    );
    const chain = seats.map((s) => longestStrikeRun(s.rolls, frames));
    const balls = seats.map((s) => s.rolls.length);
    let winner = 0;
    if (!solo) {
      if (totals[0] === totals[1]) winner = -1;
      else winner = totals[0] > totals[1] ? 0 : 1;
    }
    opts.onDone({ totals, strikes, chain, balls, winner });
  }

  // ---- 记分牌 ------------------------------------------------------------------
  const cardCells: Array<{ box: HTMLElement; marks: HTMLElement; score: HTMLElement }[]> = [];

  function buildCard(): void {
    card.innerHTML = "";
    cardCells.length = 0;
    for (let s = 0; s < seats.length; s++) {
      const row: Array<{ box: HTMLElement; marks: HTMLElement; score: HTMLElement }> = [];
      const strip = el("div", "bl-card");
      for (let f = 0; f < frames; f++) {
        const box = el("div", "bl-fr");
        const n = el("div", "bl-fr-n", solo ? String(f + 1) : `${seats[s].plan.emoji}${f + 1}`);
        const marks = el("div", "bl-fr-m", "");
        const score = el("div", "bl-fr-s", "");
        box.append(n, marks, score);
        strip.appendChild(box);
        row.push({ box, marks, score });
      }
      cardCells.push(row);
      card.appendChild(strip);
    }
    if (seats.length > 1) card.style.flexDirection = "column";
  }

  function refreshCard(): void {
    for (let s = 0; s < seats.length; s++) {
      const sheet = scoreGame(seats[s].rolls, frames);
      const now = turnState(seats[s].rolls, frames);
      sheet.frames.forEach((frame: FrameScore, f: number) => {
        const cell = cardCells[s]?.[f];
        if (!cell) return;
        cell.marks.textContent = frameMarks(frame);
        cell.score.textContent = frame.running === null ? "" : String(frame.running);
        cell.box.classList.toggle("bl-fr-now", !now.over && now.frame === f && turnSeat === s);
      });
    }
  }

  // ---- HUD --------------------------------------------------------------------
  function refreshHud(): void {
    for (let i = 0; i < seats.length; i++) {
      const seat = seats[i];
      const sheet = scoreGame(seat.rolls, frames);
      const who = seat.plan.ai ? `🤖${seat.plan.name}` : `${seat.plan.emoji}${seat.plan.name}`;
      const mark = !finished && turnSeat === i ? " ◀" : "";
      // 有奖励的那几格要等后面的球才结算,所以另外报一句「已经打倒多少瓶」,
      // 免得刚打了七瓶还看见 0 分,小朋友以为是坏了
      const pins = seat.rolls.reduce((s, v) => s + v, 0);
      const pending = sheet.complete ? "" : ` · 已倒 ${pins} 瓶`;
      chipSeats[i].textContent = `${who} ${sheet.total} 分${pending}${mark}`;
      chipSeats[i].classList.toggle("bl-chip-now", !finished && turnSeat === i);
    }
    const st = turnState(currentSeat().rolls, frames);
    const nudgeText = aimNudge === 0 ? "" : ` · 落点微调 ${aimNudge > 0 ? "右" : "左"}${Math.round(Math.abs(aimNudge) / NUDGE_STEP)}`;
    const ballText = ballLimit > 0 ? ` · 还剩 ${Math.max(0, ballLimit - currentSeat().rolls.length)} 球` : "";
    chipBanner.textContent = opts.target
      ? `${opts.banner} · 目标 ${opts.target} 分 · 第 ${Math.min(st.frame + 1, frames)}/${frames} 格${ballText}${nudgeText}`
      : `${opts.banner} · 第 ${Math.min(st.frame + 1, frames)}/${frames} 格${ballText}${nudgeText}`;
    rollBtn.className = `bl-roll${turnSeat === 1 ? " bl-roll--p1" : ""}`;
    const ai = Boolean(currentSeat().plan.ai);
    rollBtn.disabled = ai || Boolean(lane) || finished;
    rollBtn.textContent = ai ? "🤖 电脑在瞄" : lane ? "🎳 球滚出去啦" : `🎳 停!(${STAGE_LABEL[stage === "roll" ? "power" : stage]})`;
    undoBtn.disabled = ai || Boolean(lane) || finished || !canUndo(stage);
    undoBtn.textContent = canUndo(stage) ? `↩ 重定${STAGE_LABEL[prevStage(stage)]}` : "↩ 重来";
  }

  function refreshGauges(): void {
    const live = stageValue();
    gaugeOrder.forEach((name, i) => {
      const ui = gaugeEls[i];
      const active = stage === name && !lane;
      const locked =
        (name === "power" && (stage === "aim" || stage === "spin" || stage === "roll")) ||
        (name === "aim" && (stage === "spin" || stage === "roll")) ||
        (name === "spin" && stage === "roll");
      const v = active ? live : locked ? (name === "power" ? pending.power : (name === "aim" ? pending.aim : pending.spin) / 2 + 0.5) : 0;
      ui.needle.style.left = `${clamp(v, 0, 1) * 100}%`;
      ui.bar.classList.toggle("bl-gauge--idle", !active && !locked);
      ui.bar.classList.toggle("bl-gauge--done", locked);
      if (name === "power") ui.val.textContent = locked ? `${Math.round(pending.power * 100)}%` : "";
      else if (name === "aim") ui.val.textContent = locked ? (pending.aim >= 0 ? `偏右 ${pending.aim.toFixed(2)}` : `偏左 ${(-pending.aim).toFixed(2)}`) : "";
      else ui.val.textContent = locked ? (pending.spin >= 0 ? `右旋 ${pending.spin.toFixed(2)}` : `左旋 ${(-pending.spin).toFixed(2)}`) : "";
    });
  }

  // ---- 画面 --------------------------------------------------------------------
  /** 星星彩纸:只在全中的时候撒一把,`prefers-reduced-motion` 下压根不生成 */
  interface Bit {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    hue: string;
  }
  const CONFETTI = ["#ff9ec4", BL_GOLD, "#8fd6b4", "#9ec5ff", "#c9a7f5"];
  let bits: Bit[] = [];

  // ---- 渲染侧小账本(纯视觉,destroy 一并清零) ---------------------------------
  /** 每只瓶「第一次被看见倒下」的时刻与方向:倒瓶旋转动画用 */
  const downAt: number[] = new Array<number>(PINS).fill(0);
  const downDir: Array<1 | -1> = new Array<1 | -1>(PINS).fill(1);
  /** 全中的时刻:瓶台灯箱闪三下(reduced 一次长亮) */
  let strikeAt = Number.NEGATIVE_INFINITY;
  /** 油区倒影拉丝(reduced 不生成) */
  interface Streak {
    x: number;
    y: number;
    life: number;
  }
  let streaks: Streak[] = [];
  let lastStreakAt = 0;

  function throwConfetti(): void {
    if (calm) return;
    const spot = laneProject(LANE_W / 2, HEAD_Y + 6, view);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      bits.push({
        x: spot.sx,
        y: spot.sy,
        vx: Math.cos(a) * (30 + (i % 5) * 14),
        vy: Math.sin(a) * (26 + (i % 3) * 12) - 30,
        life: 900,
        hue: CONFETTI[i % CONFETTI.length],
      });
    }
  }

  function stepConfetti(dt: number): void {
    if (bits.length === 0) return;
    const s = dt / 1000;
    for (const b of bits) {
      b.vy += 210 * s;
      b.x += b.vx * s;
      b.y += b.vy * s;
      b.life -= dt;
    }
    bits = bits.filter((b) => b.life > 0);
  }

  /** 一条沿着球道纵向铺开的带子:两条边在透视里是弯的,采样着画才不穿帮 */
  function band(x0: number, x1: number, y0: number, y1: number, fill: string): void {
    if (!g) return;
    const N = 10;
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const p = laneProject(x0, y0 + ((y1 - y0) * i) / N, view);
      if (i === 0) g.moveTo(p.sx, p.sy);
      else g.lineTo(p.sx, p.sy);
    }
    for (let i = N; i >= 0; i--) {
      const p = laneProject(x1, y0 + ((y1 - y0) * i) / N, view);
      g.lineTo(p.sx, p.sy);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  }

  /** 一条顺着球道往前跑的线(教学线、瞄准线都走这里) */
  function rail(x: number, y0: number, y1: number, stroke: string, dash: number[]): void {
    if (!g) return;
    g.save();
    g.strokeStyle = stroke;
    g.lineWidth = 2;
    g.setLineDash(dash);
    g.beginPath();
    const N = 10;
    for (let i = 0; i <= N; i++) {
      const p = laneProject(x, y0 + ((y1 - y0) * i) / N, view);
      if (i === 0) g.moveTo(p.sx, p.sy);
      else g.lineTo(p.sx, p.sy);
    }
    g.stroke();
    g.restore();
  }

  /** 两侧霓虹装饰线:沿球道边缘的会聚线跑,粉 / 蓝呼吸(reduced 常亮) */
  function neonRail(x: number, color: string, aMul: number): void {
    if (!g) return;
    g.save();
    g.lineCap = "round";
    const N = 10;
    for (const [w, a] of [
      [5, 0.22],
      [2, 0.85],
    ] as Array<[number, number]>) {
      g.strokeStyle = withAlpha(color, a * aMul);
      g.lineWidth = w;
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const p = laneProject(x, (LANE_LEN * i) / N, view);
        if (i === 0) g.moveTo(p.sx, p.sy);
        else g.lineTo(p.sx, p.sy);
      }
      g.stroke();
    }
    g.restore();
  }

  /** 瓶台灯箱:暖光往上晕开 + 立面横板 + 顶部小星招牌;全中时闪三下 */
  function drawLightbox(): void {
    if (!g) return;
    const deckTop = laneProject(LANE_W / 2, HEAD_Y - 10, view).sy;
    const flash = strikeFlashOn(clock - strikeAt, calm);
    const grad = g.createLinearGradient(0, deckTop, 0, 0);
    grad.addColorStop(0, withAlpha(BL_COLORS.blGlow, flash ? 0.9 : 0.5));
    grad.addColorStop(1, withAlpha(BL_COLORS.blGlow, 0.04));
    g.fillStyle = grad;
    g.fillRect(0, 0, view.w, Math.max(2, deckTop));
    const bh = Math.max(9, view.h * 0.042);
    g.fillStyle = flash ? shade(BL_COLORS.blGlow, 14) : BL_COLORS.blGlow;
    g.fillRect(view.w * 0.08, 2, view.w * 0.84, bh);
    g.strokeStyle = shade(BL_COLORS.blGlow, -18);
    g.lineWidth = 1.5;
    g.strokeRect(view.w * 0.08, 2, view.w * 0.84, bh);
    drawStar(g, view.w / 2, 2 + bh / 2, bh * 0.34, flash ? "#FFFFFF" : BL_GOLD);
  }

  function render(): void {
    if (!g) return;
    g.clearRect(0, 0, view.w, view.h);
    // 球道两侧的暗底(梯形之外的馆内地面)
    g.fillStyle = "#3b3556";
    g.fillRect(0, 0, view.w, view.h);
    // C-2 粉彩夜场(方案 A):暗底提暖一档 —— 提亮 6%(≈shade(+6))再叠 4% 粉紫,
    // 「灰紫」调成「粉紫」;主道与灯箱随后原样压顶,亮度预算一分不动
    g.fillStyle = withAlpha("#FFFFFF", BL_HALL_LIFT_ALPHA);
    g.fillRect(0, 0, view.w, view.h);
    g.fillStyle = withAlpha(BL_HALL_TINT, BL_HALL_TINT_ALPHA);
    g.fillRect(0, 0, view.w, view.h);
    // 修复员装饰件:两侧邻道暗剪影 + 馆内立柱竖线
    // (纯静态,画在跟球运镜之前 —— 不进缩放)
    drawNeighborLanes(g, view);

    g.save();
    // 「跟球」运镜:参数与 1.2 完全一致(FOLLOW_ZOOM/IN/OUT 只是常量化)
    if (follow > 0 && lane && !calm) {
      const b = laneProject(lane.ball.x, lane.ball.y, view);
      const k = 1 + FOLLOW_ZOOM * follow;
      g.translate(b.sx, b.sy);
      g.scale(k, k);
      g.translate(-b.sx, -b.sy);
    }

    // 尽头灯箱先铺:球道压在暖光上,透视灭点立刻有了去处
    drawLightbox();

    // 木板双色:8 块板沿 laneProject 会聚,相邻一深一浅
    band(0, LANE_W, 0, LANE_LEN, BL_COLORS.blWoodA);
    const seams = seamXs(gutterW);
    for (let i = 1; i < seams.length; i += 2) {
      const right = i + 1 < seams.length ? seams[i + 1] : LANE_W - gutterW;
      band(seams[i], right, 0, LANE_LEN, BL_COLORS.blWoodB);
    }
    // 木板缝:一条一条沿会聚线画,远端间距和透明度一起收缩
    g.lineCap = "round";
    const SEG = 10;
    for (const sx of seams) {
      for (let i = 0; i < SEG; i++) {
        const t0 = i / SEG;
        const t1 = (i + 1) / SEG;
        const p0 = laneProject(sx, LANE_LEN * t0, view);
        const p1 = laneProject(sx, LANE_LEN * t1, view);
        g.strokeStyle = `rgba(160,120,70,${seamAlphaAt((t0 + t1) / 2).toFixed(3)})`;
        g.lineWidth = 1.1 * p0.k;
        g.beginPath();
        g.moveTo(p0.sx, p0.sy);
        g.lineTo(p1.sx, p1.sy);
        g.stroke();
      }
    }
    // 两侧球沟:有护栏就是一条鼓起来的栏杆,没护栏才是真的沟;
    // 沟内壁(贴球道那一侧)压深 22%,凹下去的立面感就出来了
    const gutFill = opts.bumpers ? "#f2a9c6" : BL_COLORS.blGutter;
    const wallFill = opts.bumpers ? shade("#f2a9c6", -22) : BL_COLORS.blGutterWall;
    band(0, gutterW, 0, LANE_LEN, gutFill);
    band(LANE_W - gutterW, LANE_W, 0, LANE_LEN, gutFill);
    const wallW = Math.min(1.1, gutterW * 0.4);
    band(gutterW - wallW, gutterW, 0, LANE_LEN, wallFill);
    band(LANE_W - gutterW, LANE_W - gutterW + wallW, 0, LANE_LEN, wallFill);
    // 打油区:油越厚越亮(功能表达,保留)+ 镜面高光带两条(纵向白渐变条)
    band(gutterW, LANE_W - gutterW, 0, DECK_END * 0.62, `rgba(180,205,255,${0.1 + opts.oil * 0.34})`);
    band(LANE_W * 0.34, LANE_W * 0.48, 0, DECK_END * 0.62, BL_COLORS.blOil);
    band(LANE_W * 0.56, LANE_W * 0.62, 0, DECK_END * 0.62, withAlpha("#FFFFFF", 0.14));
    // 球经过油区的倒影拉丝(reduced 不生成)
    for (const s of streaks) {
      const p = laneProject(s.x, s.y, view);
      reflectStreak(g, p.sx, p.sy + 2, 16 * p.k, 3 * p.k, "#FFFFFF", 0.35 * (s.life / OIL_STREAK_MS));
    }
    // 瓶台与犯规线(几何不动,犯规线加深一档才看得见)
    band(gutterW, LANE_W - gutterW, HEAD_Y - 8, LANE_LEN, "#e0c79a");
    band(gutterW, LANE_W - gutterW, 1.4, 2.6, shade(BL_COLORS.blWoodB, -18));

    // 口袋教学线:前两章画得实,越往后越淡,第七章起彻底不画。
    // 线指的是「口袋在哪儿」,力度、落点、旋转还得自己定。
    if (guideAt > 0) {
      rail(pocketX(), 6, HEAD_Y, `rgba(232,85,143,${0.5 * guideAt})`, [7, 6]);
      rail(pocketLeftX(), 6, HEAD_Y, `rgba(90,140,220,${0.34 * guideAt})`, [7, 6]);
    }

    // 瞄准线:落点定下来之后画出球出手的那条直线
    const seat = currentSeat();
    if (!lane && !finished && (stage === "spin" || stage === "roll")) {
      rail(releaseX(clamp(pending.aim + aimNudge, -1, 1), gutterW), 0, HEAD_Y, "rgba(70,60,110,.6)", [4, 4]);
    }

    // 瓶:细颈宽肩剪影,被击后绕瓶底支点旋转倒下(250ms + 弹跳,reduced 直躺)
    const perUnit = view.w / LANE_W;
    const pins = lane ? lane.pins : null;
    for (let i = 0; i < PINS; i++) {
      const kind = seat.kinds[i] ?? "wood";
      let px: number;
      let py: number;
      let down: boolean;
      let here: boolean;
      let vx = 0;
      if (pins) {
        const pin = pins[i];
        px = pin.x;
        py = pin.y;
        down = pin.down || pinShift(pin) > 0.6;
        here = !pin.gone;
        vx = pin.vx;
      } else {
        const home = pinSpot(i);
        px = home.x;
        py = home.y;
        down = false;
        here = seat.standing[i];
      }
      if (!here) continue;
      const p = laneProject(px, py, view);
      const r = Math.max(2, PIN_R * perUnit * p.k);
      const h = r * 3.1;
      if (down && downAt[i] === 0) {
        // 第一次看见它倒:记时刻与方向,方向沿受击矢量的横向分量
        downAt[i] = clock;
        downDir[i] = pinFallDir(vx);
      }
      drawPin(g, {
        sx: p.sx,
        sy: p.sy + r * 0.6,
        h,
        kind,
        fall: down ? pinFallAngle(clock - downAt[i], calm) : 0,
        dir: downDir[i],
        alpha: down ? 0.7 : 1,
      });
    }

    // 球:三停径向渐变 + 三指孔(相位沿用旧白点)+ 球下镜面倒影
    if (lane && !lane.ball.gone) {
      const b = lane.ball;
      const p = laneProject(b.x, b.y, view);
      const r = Math.max(3, BALL_R * perUnit * p.k);
      mirrorEllipse(g, p.sx, p.sy + r * 1.28, r * 0.85, r * 0.3, seat.plan.color);
      // 出手那一小段,球道接触点留一圈微光
      if (b.y < 10 && !calm) {
        g.save();
        g.fillStyle = withAlpha("#FFFFFF", 0.28 * (1 - b.y / 10));
        g.beginPath();
        g.ellipse(p.sx, p.sy + r * 0.9, r * 1.5, r * 0.5, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      drawBall(g, p.sx, p.sy, r, seat.plan.color, b.y, calm);
    }
    g.restore();

    // 馆内氛围:天花板垂灯两盏 + 两侧霓虹装饰线(粉/蓝呼吸,reduced 常亮)
    drawCeilingLamp(g, view.w * 0.16, view.h * 0.075, Math.max(7, view.w * 0.028));
    drawCeilingLamp(g, view.w * 0.84, view.h * 0.075, Math.max(7, view.w * 0.028));
    const na = neonAlpha(clock, calm);
    neonRail(-1.3, BL_COLORS.blNeonPink, na);
    neonRail(LANE_W + 1.3, BL_COLORS.blNeonBlue, na);

    // 星星彩纸雨(全中专属)
    for (const bit of bits) {
      g.globalAlpha = clamp(bit.life / 900, 0, 1);
      drawStar(g, bit.x, bit.y, 4.2, bit.hue, bit.life / 130);
    }
    g.globalAlpha = 1;
  }

  // ---- 遮罩与暂停 ---------------------------------------------------------------
  let veil: HTMLElement | null = null;

  function clearVeil(): void {
    veil?.remove();
    veil = null;
  }

  function togglePause(): void {
    if (finished) return;
    paused = !paused;
    pauseBtn.textContent = paused ? "▶ 继续" : "⏸ 暂停";
    if (!paused) {
      clearVeil();
      return;
    }
    clearVeil();
    const box = el("div", "bl-veil");
    box.append(
      el("div", "bl-veil-t", "⏸ 休息一下"),
      el(
        "div",
        "bl-veil-s",
        "按 Esc 或点「继续」接着投。朵朵用 F 停指针、G 退回上一段;星星用 L 停指针、K 退回上一段,方向键左右微调落点。屏幕上的「↩ 重来」按钮和 G / K 是一回事。"
      )
    );
    const row = el("div", "bl-veil-btns");
    const go = button("bl-btn", "▶ 继续");
    go.addEventListener("click", () => {
      opts.sfx("tap");
      togglePause();
    });
    row.appendChild(go);
    box.appendChild(row);
    wrap.appendChild(box);
    veil = box;
  }

  pauseBtn.addEventListener("click", () => {
    opts.sfx("tap");
    togglePause();
  });

  // ---- 输入 --------------------------------------------------------------------
  const humanSeats = seats.filter((s) => !s.plan.ai).length;

  const onKeyDown = (ev: KeyboardEvent): void => {
    if (isPauseKey(ev.code)) {
      ev.preventDefault();
      togglePause();
      return;
    }
    const hit = keyToAction(ev.code, humanSeats);
    if (!hit) return;
    // 双人对战时只认「轮到的那个人」的键,免得对面乱按
    if (humanSeats > 1 && hit.player !== turnSeat) return;
    if (currentSeat().plan.ai) return;
    ev.preventDefault();
    if (hit.action === "confirm") lockStage();
    else if (hit.action === "cancel") stepBack();
    else if (hit.action === "left") nudge(-1);
    else if (hit.action === "right") nudge(1);
  };
  window.addEventListener("keydown", onKeyDown);

  rollBtn.addEventListener("click", () => lockStage());
  leftBtn.addEventListener("click", () => nudge(-1));
  rightBtn.addEventListener("click", () => nudge(1));
  undoBtn.addEventListener("click", () => stepBack());
  const onLaneTap = (ev: PointerEvent): void => {
    ev.preventDefault();
    lockStage();
  };
  canvas.addEventListener("pointerdown", onLaneTap);

  // ---- 主循环 -------------------------------------------------------------------
  let raf = 0;
  let last = 0;

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (last === 0) last = now;
    const dt = Math.max(0, Math.min(48, now - last));
    last = now;
    if (finished) {
      stepConfetti(dt);
      render();
      return;
    }
    if (!paused) {
      clock += dt;
      stepConfetti(dt);
      // 油区倒影拉丝:推进寿命;球正滚在油区里时每隔一小段落一条(reduced 不生成)
      if (streaks.length > 0) {
        for (const s of streaks) s.life -= dt;
        streaks = streaks.filter((s) => s.life > 0);
      }
      if (!calm && lane && !lane.ball.gone && lane.ball.y < DECK_END * 0.62 && clock - lastStreakAt > 45) {
        streaks.push({ x: lane.ball.x, y: lane.ball.y, life: OIL_STREAK_MS });
        lastStreakAt = clock;
      }
      follow = clamp(follow + (lane ? dt / FOLLOW_IN_MS : -dt / FOLLOW_OUT_MS), 0, 1);
      if (lane) {
        // stepLane 单步最多推进 8ms,一帧要补几步才跟得上真实时间
        let rest = dt;
        while (rest > 0 && !lane.settled) {
          stepLane(lane, Math.min(8, rest));
          rest -= 8;
        }
        if (lane.settled) finishRoll();
      } else if (clock >= waitUntil) {
        if (awaitingNextShot) {
          awaitingNextShot = false;
          beginShot();
        }
        const seat = currentSeat();
        // 电脑不用三段式,想一小会儿就直接投
        if (seat.plan.ai && stage !== "roll" && clock >= aiThinkUntil) {
          const st = turnState(seat.rolls, frames);
          pending = aiShot(seat.standing, seat.plan.ai, shotSeed * 7 + st.frame * 3 + st.ball);
          aimNudge = 0;
          stage = "roll";
          startRoll();
        }
      }
    }
    refreshGauges();
    refreshHud();
    tip.textContent = clock < toastUntil ? toast : opts.tip;
    render();
  }

  // 开局
  buildCard();
  beginShot();
  refreshCard();
  refreshGauges();
  render();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      finished = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(settleRaf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onLaneTap);
      // 新加的纯视觉状态一并归零:彩纸、倒影拉丝、倒瓶记账
      bits = [];
      streaks = [];
      downAt.fill(0);
      clearVeil();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 闯关(188 关)
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): { destroy: () => void } {
  const lv = buildLevel(ctx.level);
  const chapter = CHAPTERS[chapterOfLevel(lv.index)];
  const desk = createDesk(stage, {
    frames: lv.frames,
    seats: [{ name: P_NAME[0], emoji: P_EMOJI[0], color: P_COLOR[0], ai: null }],
    kindsFor: () => lv.kinds,
    rackFor: () => lv.standing,
    oil: lv.oil,
    bumpers: lv.bumpers,
    drift: lv.drift,
    guide: lv.guide,
    ballLimit: lv.ballLimit,
    banner: `${chapter.emoji} 第 ${lv.index + 1} 关`,
    tip: lv.hint,
    target: lv.target,
    sfx: ctx.sfx,
    onDone: (res) => {
      const score = res.totals[0];
      if (score < lv.target) {
        ctx.lose(loseLine(score, lv.target));
        return;
      }
      // 连着全中够了次数就多给一颗星:这是「限球数」那一章的额外目标
      const bonus = lv.chainNeed > 0 && res.chain[0] >= lv.chainNeed ? 1 : 0;
      const stars = Math.min(3, rateLevel(score, lv.target) + bonus) as 1 | 2 | 3;
      const extra = bonus > 0 ? ` 连着全中 ${res.chain[0]} 次,额外奖一颗星!` : "";
      ctx.win(stars, `${winLine(score, lv.target, res.strikes[0])}${extra}`);
    },
  });
  return { destroy: () => desk.destroy() };
}

// ---------------------------------------------------------------------------
// 模式外壳:统一的「◀ 回选关 + 标题 + 舞台」
// ---------------------------------------------------------------------------

interface Shell {
  stage: HTMLElement;
  chip: HTMLElement;
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void, title: string): Shell {
  ensureCss(host);
  const wrap = el("div", "bl-mode");
  const head = el("div", "bl-mhead");
  const back = button("bl-back", "◀ 回选关");
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = el("span", "bl-chip", title);
  head.append(back, chip);
  const stage = el("div");
  wrap.append(head, stage);
  host.appendChild(wrap);
  return { stage, chip, destroy: () => wrap.remove() };
}

function overBox(
  stage: HTMLElement,
  title: string,
  sub: string,
  buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>
): void {
  stage.innerHTML = "";
  const box = el("div", "bl-veil");
  box.style.position = "static";
  box.append(el("div", "bl-veil-t", title), el("div", "bl-veil-s", sub));
  const row = el("div", "bl-veil-btns");
  for (const b of buttons) {
    const btn = button(`bl-btn${b.ghost ? " bl-btn--ghost" : ""}`, b.label);
    btn.addEventListener("click", b.onClick);
    row.appendChild(btn);
  }
  box.appendChild(row);
  stage.appendChild(box);
}

// ---------------------------------------------------------------------------
// 双人对战:整整十格,轮流投
// ---------------------------------------------------------------------------

function mountVersus(host: HTMLElement, api: GameApi, onBack: () => void, aiSkill: AiLevel | null): { destroy: () => void } {
  const label = aiSkill ? `🤖 人机对战 · ${AI_LABEL[aiSkill]}` : "⚔️ 双人对战";
  const shell = makeShell(host, api, onBack, label);
  let desk: Runner | null = null;
  let round = 1;

  function start(): void {
    desk?.destroy();
    shell.stage.innerHTML = "";
    const vs = buildVersus(round);
    shell.chip.textContent = `${label} · ${vs.name} · 第 ${round} 局`;
    desk = createDesk(shell.stage, {
      frames: vs.frames,
      seats: [
        { name: P_NAME[0], emoji: P_EMOJI[0], color: P_COLOR[0], ai: null },
        aiSkill
          ? { name: AI_LABEL[aiSkill], emoji: "🤖", color: P_COLOR[1], ai: aiSkill }
          : { name: P_NAME[1], emoji: P_EMOJI[1], color: P_COLOR[1], ai: null },
      ],
      kindsFor: () => vs.kinds,
      oil: vs.oil,
      guide: 0.5,
      banner: `${vs.name} · 第 ${round} 局`,
      tip: aiSkill
        ? `${vs.hint} 朵朵:F 停指针、G 退回上一段,方向键左右微调落点。`
        : `${vs.hint} 朵朵:F/G;星星:L/K。轮到谁,谁的键才管用。`,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        desk?.destroy();
        desk = null;
        const names = [P_NAME[0], aiSkill ? AI_LABEL[aiSkill] : P_NAME[1]];
        const line = versusLine(res.totals, names);
        if (res.winner >= 0) {
          api.play("win");
          api.addStars(2);
        } else {
          api.play("meow");
          api.addStars(1);
        }
        const title = res.winner < 0 ? "🤝 打成平手!" : `🏆 ${names[res.winner]}赢了这一局!`;
        overBox(shell.stage, title, `${line}。换一张球道再来一局,油量和瓶型都不一样。`, [
          {
            label: "▶ 换一张球道",
            onClick: () => {
              api.play("tap");
              round++;
              start();
            },
          },
          { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
        ]);
      },
    });
  }

  start();

  return {
    destroy() {
      desk?.destroy();
      desk = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽:一格一格往下打,没够到目标分就结束
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "♾️ 无尽格");
  let desk: Runner | null = null;
  let frame = 1;
  let best = save.getGameProgress(meta.id).endlessBest;

  function start(): void {
    desk?.destroy();
    shell.stage.innerHTML = "";
    const setup = buildEndlessFrame(frame);
    shell.chip.textContent = `♾️ 无尽格 · 第 ${frame} 格 · 最好 ${best} 格`;
    desk = createDesk(shell.stage, {
      frames: 1,
      seats: [{ name: P_NAME[0], emoji: P_EMOJI[0], color: P_COLOR[0], ai: null }],
      kindsFor: () => setup.kinds,
      rackFor: () => setup.standing,
      oil: setup.oil,
      gutter: setup.gutter,
      banner: `第 ${frame} 格 · 第 ${setup.tier + 1} 档`,
      tip: `${setup.hint} 这一格要拿到 ${setup.target} 分才能继续。`,
      target: setup.target,
      sfx: (n) => api.play(n),
      onDone: (res) => {
        const score = res.totals[0];
        if (score >= setup.target) {
          best = save.recordEndlessBest(meta.id, frame);
          api.addStars(1);
          frame++;
          start();
          return;
        }
        const reached = Math.max(0, frame - 1);
        best = save.recordEndlessBest(meta.id, reached);
        desk?.destroy();
        desk = null;
        api.play("oops");
        overBox(
          shell.stage,
          "🎳 这一格没够到目标分",
          `第 ${frame} 格拿了 ${score} 分,差 ${Math.max(0, setup.target - score)} 分。${endlessLine(reached, best)}`,
          [
            {
              label: "🔁 从第 1 格再来",
              onClick: () => {
                api.play("tap");
                frame = 1;
                start();
              },
            },
            { label: "◀ 回选关", ghost: true, onClick: () => { api.play("tap"); onBack(); } },
          ]
        );
      },
    });
  }

  start();

  return {
    destroy() {
      desk?.destroy();
      desk = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载:模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  ensureCss(api.root);
  const root = el("div");
  const bar = el("div", "bl-bar");
  const picks = el("div", "bl-picks");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(bar, picks, levelHost, modeHost);
  api.root.appendChild(root);

  let aiSkill: AiLevel = 2;

  const vsBtn = button("bl-open", "⚔️ 双人对战");
  const aiBtn = button("bl-open bl-open--ai", "🤖 人机对战");
  const endlessBtn = button("bl-open bl-open--en", "♾️ 无尽格");
  bar.append(vsBtn, aiBtn, endlessBtn);

  const pickBtns: HTMLButtonElement[] = [];
  ([1, 2, 3] as AiLevel[]).forEach((skill) => {
    const btn = button("bl-pick", `🤖 ${AI_LABEL[skill]}`);
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
    endlessBtn.textContent = best > 0 ? `♾️ 无尽格 · 最好 ${best} 格` : "♾️ 无尽格";
    aiBtn.textContent = `🤖 人机对战 · ${AI_LABEL[aiSkill]}`;
    pickBtns.forEach((btn, i) => btn.setAttribute("aria-pressed", String(i + 1 === aiSkill)));
  }

  let mode: { destroy: () => void } | null = null;

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
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    picks.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  vsBtn.addEventListener("click", () => openMode((h, a, b) => mountVersus(h, a, b, null)));
  aiBtn.addEventListener("click", () => openMode((h, a, b) => mountVersus(h, a, b, aiSkill)));
  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 开打的时候把模式条收起来:手机竖屏上这一百来像素正好够球道和三条指针同框
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        picks.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy: () => {
            if (!mode) {
              bar.hidden = false;
              picks.hidden = false;
            }
            handle.destroy();
          },
        };
      },
      guide: GUIDE,
      mapHint: "口袋是 1 号瓶和 3 号瓶之间那条缝,正对头瓶撞过去反而会剩角瓶。出手前随时能按「↩ 重来」退回上一段。",
      grandMessage: "188 关全部通关,保龄球小馆的口袋位已经被你摸透啦!",
      guideTitle: "保龄球小馆 · 投球手册",
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    },
  };
}
