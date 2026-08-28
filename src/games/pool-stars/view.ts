/**
 * 朵星台球 · Canvas 球桌视图。
 *
 * 一张球桌四种玩法共用：闯关、人机对战、无尽残局、双人同屏。
 * 视图只负责「让人看得懂、按得动」，规则一律交给 rules.ts，物理一律交给 physics.ts。
 *
 * 交互：
 *  - 桌面：方向键调角度（按住 Shift 微调），按住 F 蓄力、松开击球，G 取消蓄力；
 *    双人同屏时星星用 L 蓄力 / K 取消；Esc 暂停。
 *  - 手机：手指在球桌上拖动瞄准，力度条跟着拉开的距离走，松手就击球；
 *    另外还有一个 ≥44px 的击球钮，按住蓄力松手出杆。
 *
 * 360px：球桌自动转成竖版（短边朝上），球直径不小于 14px，
 * 力度条与击球钮都不小于 44px，字号不小于 13px。
 */
import type { SoundName } from "../level99";
import { stagePlayRoom } from "../../engine/stageRoom";
import {
  GOLD,
  ballIconSvg,
  ballSprite,
  ballStampSprite,
  paintCueStick,
  paintSparkle,
} from "./art";
import {
  FIXED_DT,
  POCKETS,
  TABLE,
  type Ball,
  type BallKind,
  type ShotResult,
  type StepEvent,
  type Vec,
  cloneBalls,
  clamp,
  dist,
  speedOf,
  spotFree,
  stepWorld,
  strike,
  summarizeShot,
} from "./physics";
import { POCKET_LABEL, placeCueBall } from "./rules";

// ---------------------------------------------------------------------------
// 布局（纯函数，360px 的硬指标就靠它保证）
// ---------------------------------------------------------------------------

export interface Layout {
  /** 竖版：球桌短边朝上，母球从下往上打 */
  vertical: boolean;
  /** 画布显示宽高（CSS 像素） */
  cssW: number;
  cssH: number;
  /** 台面单位 → 像素 */
  scale: number;
  /** 球的直径（像素） */
  ballPx: number;
  /** 正文字号 */
  fontPx: number;
}

/** 竖版时球桌最高画到多少像素（再高手机一屏就装不下了） */
export const MAX_VERTICAL_PX = 560;
/** 球直径的下限：小于这个数手指点不准 */
export const MIN_BALL_PX = 14;
/** 力度条与击球钮的最小热区 */
export const MIN_TOUCH_PX = 44;

export function tableLayout(viewportWidth: number, availHeight: number = MAX_VERTICAL_PX): Layout {
  const w = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 480;
  const avail = clamp(w - 16, 260, 760);
  const capH =
    Number.isFinite(availHeight) && availHeight > 0
      ? Math.min(MAX_VERTICAL_PX, availHeight)
      : MAX_VERTICAL_PX;
  const vertical = w < 560;
  let scale: number;
  if (vertical) {
    const fit = Math.min(avail / TABLE.h, capH / TABLE.w);
    const minScale = MIN_BALL_PX / (2 * TABLE.r);
    // 剩余高度不够时优先整桌进屏，不靠 MIN_BALL 把桌子再撑出舞台
    scale = fit < minScale ? Math.max(fit, 0.01) : fit;
  } else {
    scale = Math.min(avail / TABLE.w, 3.4);
    scale = Math.max(scale, MIN_BALL_PX / (2 * TABLE.r));
  }
  const cssW = vertical ? TABLE.h * scale : TABLE.w * scale;
  const cssH = vertical ? TABLE.w * scale : TABLE.h * scale;
  return {
    vertical,
    cssW: Math.round(cssW),
    cssH: Math.round(cssH),
    scale,
    ballPx: 2 * TABLE.r * scale,
    // r2-3：这一路是 .ps-tip 的运行时内联来源，窄屏 13px 的老分支会把 CSS 的 14px 提级
    // 整个架空——正文下限统一 14px，不再按视口回降
    fontPx: 14,
  };
}

/** 台面坐标 → 画布坐标 */
export function toScreen(p: Vec, lay: Layout): Vec {
  return lay.vertical
    ? { x: p.y * lay.scale, y: (TABLE.w - p.x) * lay.scale }
    : { x: p.x * lay.scale, y: p.y * lay.scale };
}

/** 画布坐标 → 台面坐标 */
export function toTable(sx: number, sy: number, lay: Layout): Vec {
  return lay.vertical
    ? { x: TABLE.w - sy / lay.scale, y: sx / lay.scale }
    : { x: sx / lay.scale, y: sy / lay.scale };
}

/** 拉开的距离换算成力度（0..1）；手机拖动瞄准用 */
export function powerFromDrag(px: number, lay: Layout): number {
  const full = 34 * lay.scale;
  return clamp(px / full, 0.06, 1);
}

/** 蓄力条来回跑：按住的时间换算成当前力度 */
export function chargePower(heldMs: number, cycleMs = 1500): number {
  if (!Number.isFinite(heldMs) || heldMs <= 0) return 0.06;
  const t = (heldMs % cycleMs) / cycleMs;
  const tri = t < 0.5 ? t * 2 : 2 - t * 2;
  return clamp(0.06 + tri * 0.94, 0.06, 1);
}

/** 撞库撞到这个速度以上才值得抖一下屏 */
export const SHAKE_SPEED = 200;
/** 一次抖动持续多久（毫秒） */
export const SHAKE_MS = 170;
/** 抖动幅度上限（像素），只是「轻微」，不做夸张位移 */
export const SHAKE_MAX_PX = 4;

/** 撞库速度换成抖动幅度；不够狠就是 0（外层据此判断要不要抖） */
export function shakeAmplitude(speed: number): number {
  if (!Number.isFinite(speed) || speed < SHAKE_SPEED) return 0;
  return Math.min(SHAKE_MAX_PX, 1.4 + (speed - SHAKE_SPEED) / 90);
}

/** 抖动位移：随剩余时间线性收敛到 0，保证结束时正好回到原位 */
export function shakeOffset(msLeft: number, amp: number, t: number): Vec {
  if (msLeft <= 0 || amp <= 0) return { x: 0, y: 0 };
  const k = clamp(msLeft / SHAKE_MS, 0, 1);
  return { x: Math.sin(t / 11) * amp * k, y: Math.cos(t / 8) * amp * k * 0.7 };
}

export interface AimPreview {
  /** 瞄准线的终点（撞到球或者撞到库边的位置） */
  end: Vec;
  /** 第一颗会碰到的球；碰不到球就是 null */
  hitId: number | null;
}

/** 瞄准线与第一碰撞点：从母球沿角度射一条线，看先碰到球还是先碰到库 */
export function aimPreview(cue: Vec, angle: number, balls: readonly Ball[], maxLen = 260): AimPreview {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  let best = maxLen;
  let hitId: number | null = null;
  for (const b of balls) {
    if (b.potted) continue;
    const dx = b.x - cue.x;
    const dy = b.y - cue.y;
    const along = dx * ux + dy * uy;
    if (along <= 0) continue;
    const perp = Math.abs(dx * uy - dy * ux);
    const rr = 2 * TABLE.r;
    if (perp > rr) continue;
    const t = along - Math.sqrt(rr * rr - perp * perp);
    if (t > 0 && t < best) {
      best = t;
      hitId = b.id;
    }
  }
  // 库边
  const lims: number[] = [];
  if (ux > 1e-6) lims.push((TABLE.w - TABLE.r - cue.x) / ux);
  if (ux < -1e-6) lims.push((TABLE.r - cue.x) / ux);
  if (uy > 1e-6) lims.push((TABLE.h - TABLE.r - cue.y) / uy);
  if (uy < -1e-6) lims.push((TABLE.r - cue.y) / uy);
  for (const l of lims) {
    if (l > 0 && l < best) {
      best = l;
      hitId = null;
    }
  }
  return { end: { x: cue.x + ux * best, y: cue.y + uy * best }, hitId };
}

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.ps-wrap{--ps-ink:#2f4a3c;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--ps-ink);
  display:flex;flex-direction:column;gap:7px;align-items:center;width:100%;position:relative;
  user-select:none;-webkit-user-select:none;touch-action:none;
  /* B 档 r2 一致性①:淡草绿壳卡(与台呢同色相、高明度),深台面被浅卡包住——家族卡片语汇归队。
     侧内衬 6px 是 320px 实测值:竖版台面 cssW 封顶 280px,恰好放进 320-2×14(屏)-2×6(卡) */
  background:linear-gradient(180deg,#EFF7F0,#E7F1EA);border-radius:16px;padding:10px 6px;box-sizing:border-box;}
.ps-hud{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;width:100%;}
.ps-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:14px;font-weight:800;white-space:nowrap;
  box-shadow:0 2px 5px rgba(90,130,110,.18);}
.ps-chip-p0{color:#a8306a;background:#ffeaf3;}
.ps-chip-p1{color:#28568f;background:#e6f0ff;}
.ps-chip-now{outline:2px solid #ffb43c;}
.ps-table{border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(70,110,90,.24);line-height:0;}
.ps-table canvas{display:block;}
.ps-bars{display:flex;flex-direction:column;gap:5px;width:100%;max-width:520px;}
.ps-power{position:relative;height:${MIN_TOUCH_PX}px;border-radius:999px;background:#eaf3ec;overflow:hidden;
  box-shadow:inset 0 2px 4px rgba(90,120,100,.2);}
.ps-power-fill{position:absolute;left:0;top:0;bottom:0;width:0%;border-radius:0 999px 999px 0;
  background:linear-gradient(90deg,#5c3a22 0%,#8a5a34 18%,#a06a3c 46%,#dcae72 82%,#f6f2e8 93%,#4a76a8 100%);
  box-shadow:inset 0 3px 0 rgba(255,255,255,.28),inset 0 -3px 0 rgba(60,30,10,.3);}
.ps-power-tag{position:absolute;left:12px;top:0;line-height:${MIN_TOUCH_PX}px;font-size:14px;font-weight:900;color:#3d6152;}
.ps-power-val{position:absolute;right:12px;top:0;line-height:${MIN_TOUCH_PX}px;font-size:14px;font-weight:900;color:#3d6152;}
.ps-row{display:flex;gap:7px;flex-wrap:wrap;justify-content:center;align-items:center;}
.ps-btn{border:none;border-radius:14px;min-height:${MIN_TOUCH_PX}px;padding:10px 16px;font-size:14px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#2f4a3c;background:#ffffffe0;box-shadow:0 3px 0 rgba(110,150,130,.35);}
.ps-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(110,150,130,.35);}
.ps-btn:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.ps-btn[aria-pressed="true"]{background:linear-gradient(180deg,#8fd6ae,#5fb98c);color:#fff;box-shadow:0 3px 0 #3f8f68;}
.ps-shoot{border:none;border-radius:18px;min-height:${MIN_TOUCH_PX + 6}px;padding:12px 30px;font-size:17px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#fff;background:linear-gradient(180deg,#f79ac0,#e8558f);
  box-shadow:0 4px 0 #bf3a70;min-width:180px;}
.ps-shoot:active{transform:translateY(2px);box-shadow:0 2px 0 #bf3a70;}
.ps-shoot:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.ps-shoot[disabled]{opacity:.5;cursor:default;transform:none;}
.ps-tip{font-size:14px;font-weight:700;line-height:1.55;text-align:center;max-width:620px;color:#43604f;
  background:#ffffffcc;border-radius:12px;padding:6px 11px;word-break:break-word;}
.ps-tip-foul{background:#ffe1e1;color:#a03030;animation:psTipShake .3s ease 1;}
@keyframes psTipShake{0%{transform:translateX(0)}30%{transform:translateX(-4px)}60%{transform:translateX(4px)}100%{transform:translateX(0)}}
.ps-ballrow{display:inline-flex;gap:2px;align-items:center;line-height:0;min-height:21px;}
.ps-ballrow svg{display:block;}
.ps-pockets{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;}
.ps-veil{position:absolute;inset:0;background:rgba(250,255,252,.95);border-radius:16px;z-index:6;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:16px;}
.ps-veil-t{font-size:20px;font-weight:900;color:#3f8f68;}
.ps-veil-s{font-size:14px;font-weight:700;color:#43604f;line-height:1.6;max-width:340px;}
@media (max-width:420px){
  .ps-chip{font-size:14px;padding:4px 8px;}
  .ps-shoot{min-width:150px;padding:12px 20px;font-size:16px;}
  .ps-tip{font-size:14px;}
}
@media (prefers-reduced-motion:reduce){
  .ps-btn:active,.ps-shoot:active{transform:none;}
  .ps-table{transform:none !important;}
  .ps-tip-foul{animation:none;}
}
`;

const STYLE_ID = "ps-style";
/** 现在有几张球桌正用着这份样式:进出多少次都只注一份,最后一张桌子拆掉时带走 */
let cssUsers = 0;

/** 注一次样式并占一份引用,返回「这一份用完了」的回调（重复调用无害） */
function acquireCss(host: HTMLElement): () => void {
  cssUsers++;
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head ?? host).appendChild(style);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    cssUsers = Math.max(0, cssUsers - 1);
    if (cssUsers === 0) document.getElementById(STYLE_ID)?.remove();
  };
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(cls: string, text: string): HTMLButtonElement {
  const b = document.createElement("button") as HTMLButtonElement;
  b.type = "button";
  b.className = cls;
  b.textContent = text;
  return b;
}

function now(): number {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

function reducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  if (typeof mm !== "function") return false;
  try {
    return mm("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 球桌
// ---------------------------------------------------------------------------

export interface SeatPlan {
  name: string;
  emoji: string;
  color: string;
  /** null = 真人；数字 = 电脑档位 */
  ai: number | null;
}

export interface ShotIntent {
  angle: number;
  power: number;
  spin: number;
  calledPocket: number | null;
}

export interface TableOptions {
  balls: Ball[];
  seats: SeatPlan[];
  turn: number;
  banner: string;
  tip: string;
  /** 显示瞄准辅助线与第一碰撞点 */
  showAim: boolean;
  /** 解锁上下旋 */
  allowSpin: boolean;
  /** 打黑星球要不要指定袋 */
  requireCall: boolean;
  /** 出杆方拿到了自由球 */
  freeBall: boolean;
  /** 这一杆的合法目标，只用来写提示文案 */
  target: BallKind | "any";
  sfx: (n: SoundName) => void;
  onSettled: (res: ShotResult, shot: ShotIntent) => void;
  onFreeBall?: (pos: Vec) => void;
  /** 轮到电脑时问它这一杆怎么打；返回 null 表示这个座位是真人 */
  aiThink?: (balls: Ball[], seat: number) => ShotIntent | null;
}

export interface TablePatch {
  balls?: Ball[];
  turn?: number;
  banner?: string;
  tip?: string;
  freeBall?: boolean;
  showAim?: boolean;
  target?: BallKind | "any";
  requireCall?: boolean;
}

export interface TableHandle {
  destroy: () => void;
  update: (patch: TablePatch) => void;
  /** 当前是不是正在滚球（单测与外部控制用） */
  rolling: () => boolean;
  /** 现存的进袋星光粒子数（单测断言「动画结束粒子回收」用） */
  fx: () => number;
}

/** 木框上的六颗菱形定位钉（长边四分点 + 短边中点，行业通用制式） */
const SIGHTS: readonly Vec[] = [
  { x: 50, y: 0 },
  { x: 150, y: 0 },
  { x: 50, y: 100 },
  { x: 150, y: 100 },
  { x: 0, y: 50 },
  { x: 200, y: 50 },
];

/** 击球瞬间母球出发点的小白闪持续多久（毫秒） */
const FLASH_MS = 160;
/** 犯规（母球落袋）时屏幕边缘红光持续多久（毫秒） */
const FOUL_MS = 300;

/** 进袋星光粒子 */
interface PotFx {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}

const KIND_NAME: Record<BallKind, string> = {
  cue: "母球",
  warm: "暖色组",
  cool: "冷色组",
  black: "黑星球",
};

/**
 * 瞄准键：`[归哪一位, 拨几个细调步长]`。
 * 朵朵一套 `WASD`、星星一套方向键；上下是「大步」，左右是「小步」。
 */
const AIM_KEYS: Record<string, ["duo" | "star", number]> = {
  a: ["duo", -1],
  A: ["duo", -1],
  d: ["duo", 1],
  D: ["duo", 1],
  w: ["duo", -3],
  W: ["duo", -3],
  s: ["duo", 3],
  S: ["duo", 3],
  ArrowLeft: ["star", -1],
  ArrowRight: ["star", 1],
  ArrowUp: ["star", -3],
  ArrowDown: ["star", 3],
};

export function createTable(host: HTMLElement, opts: TableOptions): TableHandle {
  const releaseCss = acquireCss(host);
  const soft = reducedMotion();

  let balls = cloneBalls(opts.balls);
  let turn = opts.turn;
  let banner = opts.banner;
  let tip = opts.tip;
  let showAim = opts.showAim;
  let freeBall = opts.freeBall;
  let target = opts.target;
  let requireCall = opts.requireCall;

  let lay = tableLayout(viewportWidth());
  let angle = 0;
  let spin = 0;
  let calledPocket: number | null = null;
  let phase: "aim" | "charge" | "rolling" | "place" = freeBall ? "place" : "aim";
  let chargeStart = 0;
  let power = 0.5;
  let dragFrom: Vec | null = null;
  let placePos: Vec | null = null;
  const sinking = new Map<number, number>();
  /** 每颗球的视觉滚动角（只影响压印层的旋转，不碰物理） */
  const rollAngle = new Map<number, number>();
  /** 滚动残影：每颗球最近两帧的画布坐标 */
  const trails = new Map<number, Vec[]>();
  /** 进袋星光粒子（reduced-motion 下不生成） */
  let fx: PotFx[] = [];
  /** 击球瞬间的小白闪：出发点（台面坐标）与结束时刻 */
  let flashAt: Vec | null = null;
  let flashUntil = 0;
  /** 犯规红光结束时刻 */
  let foulUntil = 0;
  const shotEvents: StepEvent[] = [];
  let shotSteps = 0;
  let crossed = false;
  let shotStartLeft = true;
  let shakeAmp = 0;
  let shakeUntil = 0;
  let acc = 0;
  let last = now();
  let raf = 0;
  let aiTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;
  let paused = false;
  let currentShot: ShotIntent = { angle: 0, power: 0.5, spin: 0, calledPocket: null };

  const wrap = el("div", "ps-wrap");
  const hud = el("div", "ps-hud");
  const tableBox = el("div", "ps-table");
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  tableBox.appendChild(canvas);
  const bars = el("div", "ps-bars");
  const powerBar = el("div", "ps-power");
  const powerFill = el("div", "ps-power-fill");
  const powerTag = el("span", "ps-power-tag", "力度");
  const powerVal = el("span", "ps-power-val", "50%");
  powerBar.append(powerFill, powerTag, powerVal);
  bars.appendChild(powerBar);
  const aimRow = el("div", "ps-row");
  const leftBtn = button("ps-btn", "◀ 左");
  const rightBtn = button("ps-btn", "右 ▶");
  const shootBtn = button("ps-shoot", "🎯 蓄力击球");
  aimRow.append(leftBtn, shootBtn, rightBtn);
  const extraRow = el("div", "ps-row");
  const spinBtn = button("ps-btn", "🌀 旋转：不加");
  const placeBtn = button("ps-btn", "✅ 母球放好了");
  // 手机上没有 Esc 键：给球桌配一个和另外四款同样口径的暂停钮
  const pauseBtn = button("ps-btn", "⏸ 暂停");
  pauseBtn.setAttribute("aria-pressed", "false");
  extraRow.append(spinBtn, placeBtn, pauseBtn);
  const pockRow = el("div", "ps-pockets");
  const tipBox = el("div", "ps-tip", tip);
  wrap.append(hud, tableBox, bars, aimRow, extraRow, pockRow, tipBox);
  host.appendChild(wrap);

  const pocketBtns: HTMLButtonElement[] = POCKET_LABEL.map((label, i) => {
    const b = button("ps-btn", label);
    b.setAttribute("aria-label", `把黑星球指定到${label}`);
    b.addEventListener("click", () => {
      if (paused) return;
      opts.sfx("tap");
      calledPocket = i;
      refresh();
    });
    pockRow.appendChild(b);
    return b;
  });

  function viewportWidth(): number {
    const w = (globalThis as { innerWidth?: number }).innerWidth;
    return typeof w === "number" && w > 0 ? w : 480;
  }

  function cueBall(): Ball | undefined {
    return balls.find((b) => b.kind === "cue");
  }

  function seatOf(i: number): SeatPlan {
    return opts.seats[i] ?? opts.seats[0];
  }

  function isAiTurn(): boolean {
    return seatOf(turn).ai !== null;
  }

  function resize(): void {
    const room = stagePlayRoom(wrap, {
      w: viewportWidth(),
      h: MAX_VERTICAL_PX,
    });
    lay = tableLayout(viewportWidth(), room.h);
    canvas.width = Math.round(lay.cssW);
    canvas.height = Math.round(lay.cssH);
    canvas.style.width = `${lay.cssW}px`;
    canvas.style.height = `${lay.cssH}px`;
    tipBox.style.fontSize = `${lay.fontPx}px`;
  }

  // -------------------------------------------------------------------------
  // 画
  // -------------------------------------------------------------------------

  function render(): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = lay.scale;
    const W = canvas.width;
    const H = canvas.height;
    const t = now();
    const ballR = TABLE.r * s;
    ctx.clearRect(0, 0, W, H);

    // 台呢：径向渐变绒布（中心亮、角落深），一次填充（旧版双 fillRect 的冗余已删）
    const cloth = ctx.createRadialGradient(
      W / 2,
      H / 2,
      Math.min(W, H) * 0.18,
      W / 2,
      H / 2,
      Math.max(W, H) * 0.72
    );
    cloth.addColorStop(0, "#7bbf8e");
    cloth.addColorStop(1, "#5da574");
    ctx.fillStyle = cloth;
    ctx.fillRect(0, 0, W, H);

    // 开球线（白色细点线，点画出来的，免得和瞄准线的 setLineDash 混在一起）
    ctx.fillStyle = "rgba(255,255,255,.32)";
    const baulkA = toScreen({ x: 50, y: TABLE.r }, lay);
    const baulkB = toScreen({ x: 50, y: TABLE.h - TABLE.r }, lay);
    const baulkLen = Math.hypot(baulkB.x - baulkA.x, baulkB.y - baulkA.y);
    const nDots = Math.max(4, Math.floor(baulkLen / 9));
    for (let i = 0; i <= nDots; i++) {
      const k = i / nDots;
      ctx.beginPath();
      ctx.arc(
        baulkA.x + (baulkB.x - baulkA.x) * k,
        baulkA.y + (baulkB.y - baulkA.y) * k,
        Math.max(1, s * 0.3),
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    // 置球点（摆球堆的脚点）与中心点
    ctx.fillStyle = "rgba(255,255,255,.5)";
    for (const spot of [{ x: 150, y: 50 }, { x: 100, y: 50 }]) {
      const sp = toScreen(spot, lay);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, Math.max(1.6, s * 0.55), 0, Math.PI * 2);
      ctx.fill();
    }

    // 库边三层：深木外框（渐变）→ 库垫深绿条 → 1px 高光线
    const wood = Math.max(7, s * 2.6);
    const woodG = ctx.createLinearGradient(0, 0, W, H);
    woodG.addColorStop(0, "#a87848");
    woodG.addColorStop(0.5, "#8a5a34");
    woodG.addColorStop(1, "#6b4226");
    ctx.strokeStyle = woodG;
    ctx.lineWidth = wood;
    ctx.strokeRect(wood / 2, wood / 2, W - wood, H - wood);
    const padW = Math.max(3, s * 1.1);
    ctx.strokeStyle = "#3e8a5f";
    ctx.lineWidth = padW;
    ctx.strokeRect(wood + padW / 2, wood + padW / 2, W - 2 * wood - padW, H - 2 * wood - padW);
    ctx.strokeStyle = "rgba(255,255,255,.28)";
    ctx.lineWidth = 1;
    ctx.strokeRect(wood + padW + 0.5, wood + padW + 0.5, W - 2 * (wood + padW) - 1, H - 2 * (wood + padW) - 1);

    // 木框上的六颗菱形定位钉
    const sightR = Math.max(2.2, s * 0.8);
    ctx.fillStyle = "#f3e2bd";
    for (const q of SIGHTS) {
      const sp = toScreen(q, lay);
      const px = sp.x <= 1 ? wood / 2 : sp.x >= W - 1 ? W - wood / 2 : sp.x;
      const py = sp.y <= 1 ? wood / 2 : sp.y >= H - 1 ? H - wood / 2 : sp.y;
      ctx.beginPath();
      ctx.moveTo(px, py - sightR);
      ctx.lineTo(px + sightR, py);
      ctx.lineTo(px, py + sightR);
      ctx.lineTo(px - sightR, py);
      ctx.closePath();
      ctx.fill();
    }

    // 袋口：内阴影渐变（外浅内黑）+ 朝台心的金色护口弧
    for (const p of POCKETS) {
      const sp = toScreen(p, lay);
      const pr = TABLE.pocketR * s * 0.95;
      const hole = ctx.createRadialGradient(sp.x, sp.y, pr * 0.15, sp.x, sp.y, pr);
      hole.addColorStop(0, "#101614");
      hole.addColorStop(0.72, "#26302a");
      hole.addColorStop(1, "#55645a");
      ctx.fillStyle = hole;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, pr, 0, Math.PI * 2);
      ctx.fill();
      const toCenter = Math.atan2(H / 2 - sp.y, W / 2 - sp.x);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = Math.max(2, s * 0.7);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, pr * 0.96, toCenter - Math.PI / 2, toCenter + Math.PI / 2);
      ctx.stroke();
    }

    // 指定袋：袋口金光脉动（reduced-motion 是一圈静态金圈）
    if (calledPocket !== null && calledPocket >= 0) {
      const sp = toScreen(POCKETS[calledPocket], lay);
      const pulse = soft ? 1 : 0.55 + 0.45 * Math.sin(t / 170);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,196,80,${(0.5 + 0.5 * pulse).toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.arc(sp.x, sp.y, TABLE.pocketR * s * (soft ? 1.15 : 1.08 + 0.1 * pulse), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,214,120,.3)";
      ctx.lineWidth = 6;
      ctx.arc(sp.x, sp.y, TABLE.pocketR * s * 1.34, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 瞄准线 + 第一碰撞点
    const cue = cueBall();
    if (cue && !cue.potted && phase !== "rolling" && showAim) {
      const pv = aimPreview(cue, angle, balls.filter((b) => b.kind !== "cue"));
      const a = toScreen(cue, lay);
      const b = toScreen(pv.end, lay);
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.strokeStyle = pv.hitId === null ? "rgba(255,255,255,.6)" : "#ffb43c";
      ctx.arc(b.x, b.y, TABLE.r * s, 0, Math.PI * 2);
      ctx.stroke();
    } else if (cue && !cue.potted && phase !== "rolling") {
      // 关掉辅助之后只留一小段方向短线，手机上还得看得见自己朝哪
      const a = toScreen(cue, lay);
      const tipPt = toScreen({ x: cue.x + Math.cos(angle) * 12, y: cue.y + Math.sin(angle) * 12 }, lay);
      ctx.strokeStyle = "rgba(255,255,255,.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(tipPt.x, tipPt.y);
      ctx.stroke();
    }

    // 球杆：只在瞄准 / 蓄力阶段画，滚球阶段绝不出现；蓄力时杆随力度后拉
    if (cue && !cue.potted && (phase === "aim" || phase === "charge")) {
      const a = toScreen(cue, lay);
      const f = toScreen({ x: cue.x + Math.cos(angle), y: cue.y + Math.sin(angle) }, lay);
      const aimAng = Math.atan2(f.y - a.y, f.x - a.x);
      const pull = phase === "charge" ? power * ballR * 3.4 : ballR * 0.4;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(aimAng);
      paintCueStick(ctx, ballR * 1.5 + pull, ballR * 15, Math.max(3, ballR * 0.55));
      ctx.restore();
    }

    // 击球瞬间：母球出发点一记小白闪（reduced-motion 不生成）
    if (flashAt && t < flashUntil) {
      const p0 = toScreen(flashAt, lay);
      const k = clamp((flashUntil - t) / FLASH_MS, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.85 * k;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p0.x, p0.y, ballR * (0.7 + (1 - k) * 1.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 滚动残影（reduced-motion 关）：最近两帧的位置淡淡拖一下
    if (!soft && phase === "rolling") {
      for (const [id, pts] of trails) {
        const b = balls.find((x) => x.id === id);
        if (!b || b.potted) continue;
        for (let i = 0; i < pts.length; i++) {
          ctx.save();
          ctx.globalAlpha = i === pts.length - 1 ? 0.2 : 0.1;
          ctx.drawImage(ballSprite(b.kind, ballR), pts[i].x - ballR, pts[i].y - ballR, ballR * 2, ballR * 2);
          ctx.restore();
        }
      }
    }

    // 球：预渲染 sprite（底层光影不转，阵营压印随滚动转）；入袋时向袋心吸入 + 缩小淡出
    for (const b of balls) {
      const sink = sinking.get(b.id);
      if (b.potted && sink === undefined) continue;
      let p = toScreen(b, lay);
      const shrink = sink === undefined ? 1 : Math.max(0, 1 - sink);
      const r = ballR * shrink;
      if (r <= 0.3) continue;
      if (sink !== undefined && b.pocket >= 0) {
        const pk = toScreen(POCKETS[b.pocket], lay);
        const k = Math.min(1, sink * 1.2);
        p = { x: p.x + (pk.x - p.x) * k, y: p.y + (pk.y - p.y) * k };
      }
      ctx.globalAlpha = sink === undefined ? 1 : Math.max(0, 1 - sink * 0.9);
      ctx.drawImage(ballSprite(b.kind, ballR), p.x - r, p.y - r, r * 2, r * 2);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(rollAngle.get(b.id) ?? 0);
      ctx.drawImage(ballStampSprite(b.kind, ballR), -r, -r, r * 2, r * 2);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // 进袋星光（黑星球金星 ×6，其余阵营色星光）
    for (const p of fx) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life / p.ttl, 0, 1);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      paintSparkle(ctx, p.size * (0.6 + (0.4 * p.life) / p.ttl), p.color);
      ctx.restore();
    }

    // 自由球预览：放得下画白球影子，放不下再罩一层红圈提示禁放
    if (phase === "place" && placePos) {
      const p = toScreen(placePos, lay);
      const ok = spotFree(placePos, balls);
      ctx.globalAlpha = 0.65;
      ctx.drawImage(ballSprite("cue", ballR), p.x - ballR, p.y - ballR, ballR * 2, ballR * 2);
      ctx.globalAlpha = 1;
      if (!ok) {
        ctx.fillStyle = "rgba(230,70,70,.26)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, ballR * 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(214,48,48,.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ballR * 1.8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 犯规（母球落袋）：屏幕边缘红光一闪（reduced-motion 只静态变色不闪）
    if (t < foulUntil) {
      const k = soft ? 0.5 : clamp((foulUntil - t) / FOUL_MS, 0, 1) * 0.85;
      const lw = Math.max(6, s * 2);
      ctx.strokeStyle = `rgba(226,74,74,${k.toFixed(3)})`;
      ctx.lineWidth = lw;
      ctx.strokeRect(lw / 2, lw / 2, W - lw, H - lw);
    }
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------

  function refresh(): void {
    hud.innerHTML = "";
    const bannerChip = el("span", "ps-chip", banner);
    hud.appendChild(bannerChip);
    opts.seats.forEach((seat, i) => {
      const chip = el("span", `ps-chip ps-chip-p${i}${i === turn ? " ps-chip-now" : ""}`);
      chip.textContent = `${seat.emoji} ${seat.name}${i === turn ? " · 出杆" : ""}`;
      hud.appendChild(chip);
    });
    if (target !== "any") {
      hud.appendChild(el("span", "ps-chip", `目标：${KIND_NAME[target]}`));
    }
    // 双方剩余球：用球 sprite 缩略排出来，不再只有文字
    for (const k of ["warm", "cool"] as const) {
      const total = balls.filter((b) => b.kind === k).length;
      if (total === 0) continue;
      const left = balls.filter((b) => b.kind === k && !b.potted).length;
      const chip = el("span", "ps-chip ps-ballrow");
      chip.setAttribute("role", "img");
      chip.setAttribute("aria-label", `${KIND_NAME[k]}还剩 ${left} 颗`);
      if (left === 0) chip.textContent = `${KIND_NAME[k]}已清台`;
      else chip.innerHTML = ballIconSvg(k, 15).repeat(left);
      hud.appendChild(chip);
    }

    const pct = Math.round(power * 100);
    powerFill.style.width = `${pct}%`;
    powerVal.textContent = `${pct}%`;
    tipBox.textContent = tip;

    const black = target === "black" && requireCall;
    pockRow.hidden = !black;
    pocketBtns.forEach((b, i) => {
      b.setAttribute("aria-pressed", String(calledPocket === i));
    });
    spinBtn.hidden = !opts.allowSpin;
    spinBtn.textContent = spin > 0 ? "🌀 旋转：跟进" : spin < 0 ? "🌀 旋转：拉杆" : "🌀 旋转：不加";
    placeBtn.hidden = phase !== "place";
    const human = !isAiTurn() && !paused;
    const canShoot = phase === "aim" || phase === "charge";
    shootBtn.disabled = !human || !canShoot;
    leftBtn.disabled = !human || phase === "rolling";
    rightBtn.disabled = !human || phase === "rolling";
    shootBtn.textContent = phase === "charge" ? "🎯 松手击球" : "🎯 蓄力击球";
    render();
  }

  // -------------------------------------------------------------------------
  // 出杆
  // -------------------------------------------------------------------------

  function fire(shot: ShotIntent): void {
    const cue = cueBall();
    if (!cue || cue.potted || phase === "rolling") return;
    currentShot = shot;
    shotStartLeft = cue.x < TABLE.w / 2;
    // 击球瞬间的小白闪（reduced-motion 不闪）
    if (!soft) {
      flashAt = { x: cue.x, y: cue.y };
      flashUntil = now() + FLASH_MS;
    }
    const next = cloneBalls(balls);
    const idx = next.findIndex((b) => b.kind === "cue");
    next[idx] = strike(next[idx], shot.angle, shot.power, shot.spin);
    balls = next;
    shotEvents.length = 0;
    shotSteps = 0;
    crossed = false;
    phase = "rolling";
    opts.sfx("pop");
    refresh();
  }

  function settle(): void {
    phase = "aim";
    trails.clear();
    const res = summarizeShot(cloneBalls(balls), shotEvents.slice(), crossed, shotSteps);
    refresh();
    opts.onSettled(res, currentShot);
  }

  /** 进袋星光：黑星球迸金星 ×6，阵营球迸阵营色星光；母球落袋走红光不走星光 */
  function spawnPotFx(kind: BallKind, pocket: number): void {
    if (soft || pocket < 0 || kind === "cue") return;
    const sp = toScreen(POCKETS[pocket], lay);
    const gold = kind === "black";
    const n = gold ? 6 : 5;
    const size = Math.max(3, lay.scale * (gold ? 2 : 1.5));
    const color = gold ? "#ffd25e" : kind === "warm" ? "#ffd3e0" : "#cfe6ff";
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const v = 40 + Math.random() * 50;
      fx.push({
        x: sp.x,
        y: sp.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 30,
        life: 0.7,
        ttl: 0.7,
        size,
        color,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 6,
      });
    }
  }

  /** 滚球时把上一帧的位置记进残影队列（reduced-motion 不记） */
  function pushTrails(): void {
    for (const b of balls) {
      if (b.potted || (b.vx === 0 && b.vy === 0)) continue;
      const sp = toScreen(b, lay);
      const arr = trails.get(b.id) ?? [];
      arr.push(sp);
      if (arr.length > 2) arr.shift();
      trails.set(b.id, arr);
    }
  }

  function stepRolling(dt: number): void {
    const startLeft = shotStartLeft;
    let guard = 0;
    acc += dt;
    while (acc >= FIXED_DT && guard++ < 12) {
      acc -= FIXED_DT;
      const out = stepWorld(balls, FIXED_DT);
      balls = out.balls;
      shotSteps++;
      // 视觉滚动角：按每颗球这一小步走的路程折算（只转压印层，不碰物理）
      for (const b of balls) {
        if (b.potted) continue;
        const sp = speedOf(b);
        if (sp > 0) rollAngle.set(b.id, (rollAngle.get(b.id) ?? 0) + (sp * FIXED_DT) / TABLE.r);
      }
      for (const ev of out.events) {
        shotEvents.push(ev);
        if (ev.type === "pot") {
          sinking.set(ev.id, 0);
          spawnPotFx(ev.kind, ev.pocket ?? -1);
          if (ev.kind === "cue") foulUntil = now() + FOUL_MS;
          opts.sfx(ev.kind === "cue" ? "oops" : "coin");
        } else if (ev.type === "cushion") {
          opts.sfx("tap");
          kickShake(ev.id);
        } else if (ev.type === "hit") {
          opts.sfx("tap");
        }
      }
      const cue = balls.find((b) => b.kind === "cue");
      if (cue && !cue.potted && (startLeft ? cue.x > TABLE.w / 2 : cue.x < TABLE.w / 2)) crossed = true;
      if (!out.moving) {
        acc = 0;
        settle();
        return;
      }
    }
  }

  /** 球撞库撞得够狠时，球桌轻轻晃一下；prefers-reduced-motion 下一动不动 */
  function kickShake(id: number): void {
    if (soft) return;
    const b = balls.find((x) => x.id === id);
    if (!b) return;
    const amp = shakeAmplitude(Math.hypot(b.vx, b.vy));
    if (amp <= 0) return;
    shakeAmp = Math.max(shakeAmp, amp);
    shakeUntil = now() + SHAKE_MS;
  }

  function applyShake(t: number): void {
    if (shakeUntil <= 0) return;
    const left = shakeUntil - t;
    if (left <= 0) {
      shakeUntil = 0;
      shakeAmp = 0;
      tableBox.style.transform = "";
      return;
    }
    const o = shakeOffset(left, shakeAmp, t);
    tableBox.style.transform = `translate(${o.x.toFixed(2)}px,${o.y.toFixed(2)}px)`;
  }

  function frame(): void {
    if (destroyed) return;
    const t = now();
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (!paused) {
      if (phase === "rolling") {
        if (!soft) pushTrails();
        stepRolling(dt);
      }
      if (phase === "charge") {
        power = chargePower(t - chargeStart);
        const pct = Math.round(power * 100);
        powerFill.style.width = `${pct}%`;
        powerVal.textContent = `${pct}%`;
      }
      // 入袋动画：缩小 + 下沉淡出，绝不瞬删
      for (const [id, v] of Array.from(sinking.entries())) {
        const nv = v + (soft ? dt * 4 : dt * 2.4);
        if (nv >= 1) sinking.delete(id);
        else sinking.set(id, nv);
      }
      // 进袋星光：飘一下、转一下，寿命到了就回收
      if (fx.length > 0) {
        for (const p of fx) {
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 90 * dt;
          p.rot += p.vr * dt;
        }
        fx = fx.filter((p) => p.life > 0);
      }
      // 犯规提示条：红光期间提示条跟着变色抖一下（reduced-motion 只变色）
      if (foulUntil > 0) {
        if (t < foulUntil) {
          if (!tipBox.className.includes("ps-tip-foul")) tipBox.className = "ps-tip ps-tip-foul";
        } else {
          foulUntil = 0;
          tipBox.className = "ps-tip";
        }
      }
      applyShake(t);
      render();
    }
    raf = requestAnimationFrame(frame);
  }

  // -------------------------------------------------------------------------
  // 输入
  // -------------------------------------------------------------------------

  function startCharge(): void {
    if (paused || phase !== "aim" || isAiTurn()) return;
    phase = "charge";
    chargeStart = now();
    opts.sfx("tap");
    refresh();
  }

  function releaseCharge(): void {
    if (paused || phase !== "charge") return;
    phase = "aim";
    fire({ angle, power, spin, calledPocket: calledPocket ?? autoPocket() });
  }

  function cancelCharge(): void {
    if (phase !== "charge") return;
    phase = "aim";
    opts.sfx("tap");
    refresh();
  }

  function autoPocket(): number | null {
    if (target !== "black" || !requireCall) return null;
    const black = balls.find((b) => b.kind === "black" && !b.potted);
    if (!black) return null;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < POCKETS.length; i++) {
      const d = dist(black, POCKETS[i]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  function nudge(delta: number): void {
    if (paused || phase === "rolling" || isAiTurn()) return;
    angle += delta;
    refresh();
  }

  /**
   * 这一套瞄准键归哪个座位。
   * 双人同屏（两个座位都是真人）时朵朵一套、星星一套；
   * 单人局里两套都归那位真人 —— 老键位一条不丢。
   */
  function aimSeat(owner: "duo" | "star"): number {
    const humans = opts.seats.map((s, i) => (s.ai === null ? i : -1)).filter((i) => i >= 0);
    const duo = humans[0] ?? 0;
    return owner === "duo" ? duo : (humans[1] ?? duo);
  }

  // -------------------------------------------------------------------------
  // 暂停
  // -------------------------------------------------------------------------

  let veil: HTMLElement | null = null;

  function clearVeil(): void {
    veil?.remove();
    veil = null;
  }

  /** 暂停遮罩：手机上没有那行提示语也一眼看得出球桌停住了 */
  function showVeil(): void {
    clearVeil();
    const box = el("div", "ps-veil");
    box.append(
      el("div", "ps-veil-t", "⏸ 歇一会儿"),
      el("div", "ps-veil-s", "球都停在原地，想好了再接着打（按 Esc 或点「继续」）。")
    );
    const go = button("ps-btn", "▶ 继续");
    go.addEventListener("click", () => setPaused(false));
    box.appendChild(go);
    wrap.appendChild(box);
    veil = box;
  }

  function setPaused(next: boolean): void {
    if (paused === next) return;
    paused = next;
    // 蓄到一半按暂停：这一杆作废，恢复之后重新蓄
    if (paused && phase === "charge") phase = "aim";
    tip = paused ? "已暂停，按 Esc 继续。" : opts.tip;
    pauseBtn.textContent = paused ? "▶ 继续" : "⏸ 暂停";
    pauseBtn.setAttribute("aria-pressed", String(paused));
    if (paused) {
      // 电脑那一杆也一起停住：不加这一句，遮罩盖着的时候排好的定时器照样把球打出去
      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }
      showVeil();
    } else {
      clearVeil();
    }
    refresh();
    if (!paused) maybeAi();
  }

  pauseBtn.addEventListener("click", () => {
    opts.sfx("tap");
    setPaused(!paused);
  });

  const onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key;
    if (k === "Escape") {
      setPaused(!paused);
      return;
    }
    // 暂停就是暂停：除了 Esc，瞄准 / 蓄力 / 出杆一个都不接
    if (paused) return;
    const fine = e.shiftKey ? 0.008 : 0.03;
    const aim = AIM_KEYS[k];
    if (aim) {
      e.preventDefault();
      // 瞄准键也按座位分：朵朵 WASD、星星 方向键，谁也拨不动对方那一杆
      if (aimSeat(aim[0]) !== turn) return;
      nudge(fine * aim[1]);
      return;
    }
    if (e.repeat) return;
    const seat = seatOf(turn);
    const mine = seat.ai === null;
    if (!mine) return;
    const isP0 = turn === 0;
    if ((isP0 && (k === "f" || k === "F")) || (!isP0 && (k === "l" || k === "L"))) {
      startCharge();
      e.preventDefault();
      return;
    }
    if ((isP0 && (k === "g" || k === "G")) || (!isP0 && (k === "k" || k === "K"))) {
      cancelCharge();
      e.preventDefault();
    }
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    if (paused) return;
    const k = e.key;
    const isP0 = turn === 0;
    if ((isP0 && (k === "f" || k === "F")) || (!isP0 && (k === "l" || k === "L"))) {
      releaseCharge();
    }
  };

  function pointerTable(e: { clientX: number; clientY: number }): Vec {
    const rect = canvas.getBoundingClientRect?.() ?? { left: 0, top: 0, width: lay.cssW, height: lay.cssH };
    const sx = ((e.clientX - rect.left) / (rect.width || lay.cssW)) * lay.cssW;
    const sy = ((e.clientY - rect.top) / (rect.height || lay.cssH)) * lay.cssH;
    return toTable(sx, sy, lay);
  }

  const onPointerDown = (e: PointerEvent): void => {
    if (paused) return;
    const p = pointerTable(e);
    if (phase === "place") {
      placePos = placeCueBall(balls, p).pos;
      refresh();
      return;
    }
    if (phase !== "aim" || isAiTurn()) return;
    const cue = cueBall();
    if (!cue) return;
    // 手机：从母球往回拉，拉得越远力度越大；方向就是母球指向手指的反方向
    dragFrom = p;
    angle = Math.atan2(p.y - cue.y, p.x - cue.x);
    power = 0.35;
    refresh();
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!dragFrom || phase !== "aim" || paused) return;
    const p = pointerTable(e);
    const cue = cueBall();
    if (!cue) return;
    angle = Math.atan2(p.y - cue.y, p.x - cue.x);
    power = powerFromDrag(dist(p, cue) * lay.scale, lay);
    refresh();
  };

  const onPointerUp = (): void => {
    if (!dragFrom) return;
    dragFrom = null;
    if (phase === "aim" && !isAiTurn()) {
      fire({ angle, power, spin, calledPocket: calledPocket ?? autoPocket() });
    }
  };

  const onResize = (): void => {
    resize();
    render();
  };

  leftBtn.addEventListener("click", () => nudge(-0.03));
  rightBtn.addEventListener("click", () => nudge(0.03));
  shootBtn.addEventListener("pointerdown", startCharge);
  shootBtn.addEventListener("pointerup", releaseCharge);
  shootBtn.addEventListener("pointerleave", cancelCharge);
  shootBtn.addEventListener("keydown", (e) => {
    const k = (e as KeyboardEvent).key;
    if (k === "Enter" || k === " ") startCharge();
  });
  shootBtn.addEventListener("keyup", (e) => {
    const k = (e as KeyboardEvent).key;
    if (k === "Enter" || k === " ") releaseCharge();
  });
  spinBtn.addEventListener("click", () => {
    if (paused) return;
    spin = spin > 0 ? -1 : spin < 0 ? 0 : 1;
    opts.sfx("tap");
    refresh();
  });
  placeBtn.addEventListener("click", () => {
    if (paused || phase !== "place") return;
    const pos = placePos ?? { x: TABLE.w * 0.22, y: TABLE.h / 2 };
    const safe = placeCueBall(balls, pos).pos;
    const next = cloneBalls(balls);
    const cue = next.find((b) => b.kind === "cue");
    if (cue) {
      cue.x = safe.x;
      cue.y = safe.y;
      cue.potted = false;
      cue.pocket = -1;
      cue.vx = 0;
      cue.vy = 0;
    }
    balls = next;
    placePos = null;
    freeBall = false;
    phase = "aim";
    opts.sfx("tap");
    refresh();
    opts.onFreeBall?.(safe);
    maybeAi();
  });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onResize);

  // -------------------------------------------------------------------------
  // 电脑出杆
  // -------------------------------------------------------------------------

  function maybeAi(): void {
    if (destroyed || paused || phase === "rolling" || !isAiTurn() || !opts.aiThink) return;
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (destroyed || paused || phase === "rolling" || !isAiTurn()) return;
      const shot = opts.aiThink?.(cloneBalls(balls), turn);
      if (!shot) return;
      angle = shot.angle;
      power = shot.power;
      spin = shot.spin;
      calledPocket = shot.calledPocket;
      fire(shot);
    }, 700);
  }

  function update(patch: TablePatch): void {
    if (patch.balls) {
      balls = cloneBalls(patch.balls);
      // 整桌换球（新一局 / 放回重打）：残影、滚动角、星光都从头来
      rollAngle.clear();
      trails.clear();
      fx = [];
    }
    if (patch.turn !== undefined) turn = patch.turn;
    if (patch.banner !== undefined) banner = patch.banner;
    if (patch.tip !== undefined) tip = patch.tip;
    if (patch.showAim !== undefined) showAim = patch.showAim;
    if (patch.target !== undefined) target = patch.target;
    if (patch.requireCall !== undefined) requireCall = patch.requireCall;
    if (patch.freeBall !== undefined) {
      freeBall = patch.freeBall;
      if (freeBall && !isAiTurn()) {
        phase = "place";
        placePos = null;
      } else if (phase === "place") {
        phase = "aim";
      }
    }
    if (phase !== "place" && phase !== "rolling") phase = "aim";
    calledPocket = target === "black" && requireCall ? calledPocket ?? autoPocket() : null;
    refresh();
    maybeAi();
  }

  resize();
  refresh();
  maybeAi();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      if (aiTimer) clearTimeout(aiTimer);
      aiTimer = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      sinking.clear();
      rollAngle.clear();
      trails.clear();
      fx = [];
      flashAt = null;
      flashUntil = 0;
      foulUntil = 0;
      shakeUntil = 0;
      shakeAmp = 0;
      tableBox.style.transform = "";
      clearVeil();
      wrap.remove();
      releaseCss();
    },
    update,
    rolling: () => phase === "rolling",
    fx: () => fx.length,
  };
}
