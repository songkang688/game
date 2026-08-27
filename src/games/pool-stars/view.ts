/**
 * 梨康台球 · Canvas 球桌视图。
 *
 * 一张球桌四种玩法共用：闯关、人机对战、无尽残局、双人同屏。
 * 视图只负责「让人看得懂、按得动」，规则一律交给 rules.ts，物理一律交给 physics.ts。
 *
 * 交互：
 *  - 桌面：方向键调角度（按住 Shift 微调），按住 F 蓄力、松开击球，G 取消蓄力；
 *    双人同屏时康康用 L 蓄力 / K 取消；Esc 暂停。
 *  - 手机：手指在球桌上拖动瞄准，力度条跟着拉开的距离走，松手就击球；
 *    另外还有一个 ≥44px 的击球钮，按住蓄力松手出杆。
 *
 * 360px：球桌自动转成竖版（短边朝上），球直径不小于 14px，
 * 力度条与击球钮都不小于 44px，字号不小于 13px。
 */
import type { SoundName } from "../level99";
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

export function tableLayout(viewportWidth: number): Layout {
  const w = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 480;
  const avail = clamp(w - 16, 260, 760);
  const vertical = w < 560;
  let scale: number;
  if (vertical) {
    scale = Math.min(avail / TABLE.h, MAX_VERTICAL_PX / TABLE.w);
    scale = Math.max(scale, MIN_BALL_PX / (2 * TABLE.r));
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
    fontPx: w < 380 ? 13 : 14,
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
  user-select:none;-webkit-user-select:none;touch-action:none;}
.ps-hud{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;width:100%;}
.ps-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800;white-space:nowrap;
  box-shadow:0 2px 5px rgba(90,130,110,.18);}
.ps-chip-p0{color:#a8306a;background:#ffeaf3;}
.ps-chip-p1{color:#28568f;background:#e6f0ff;}
.ps-chip-now{outline:2px solid #ffb43c;}
.ps-table{border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(70,110,90,.24);line-height:0;}
.ps-table canvas{display:block;}
.ps-bars{display:flex;flex-direction:column;gap:5px;width:100%;max-width:520px;}
.ps-power{position:relative;height:${MIN_TOUCH_PX}px;border-radius:999px;background:#eaf3ec;overflow:hidden;
  box-shadow:inset 0 2px 4px rgba(90,120,100,.2);}
.ps-power-fill{position:absolute;left:0;top:0;bottom:0;width:0%;
  background:linear-gradient(90deg,#a8e0bd,#ffd98a,#ff9aa6);}
.ps-power-tag{position:absolute;left:12px;top:0;line-height:${MIN_TOUCH_PX}px;font-size:13px;font-weight:900;color:#3d6152;}
.ps-power-val{position:absolute;right:12px;top:0;line-height:${MIN_TOUCH_PX}px;font-size:13px;font-weight:900;color:#3d6152;}
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
.ps-tip{font-size:13px;font-weight:700;line-height:1.55;text-align:center;max-width:620px;color:#43604f;
  background:#ffffffcc;border-radius:12px;padding:6px 11px;word-break:break-word;}
.ps-pockets{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;}
.ps-veil{position:absolute;inset:0;background:rgba(250,255,252,.95);border-radius:16px;z-index:6;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:16px;}
.ps-veil-t{font-size:20px;font-weight:900;color:#3f8f68;}
.ps-veil-s{font-size:13.5px;font-weight:700;color:#43604f;line-height:1.6;max-width:340px;}
@media (max-width:420px){
  .ps-chip{font-size:13px;padding:4px 8px;}
  .ps-shoot{min-width:150px;padding:12px 20px;font-size:16px;}
  .ps-tip{font-size:13px;}
}
@media (prefers-reduced-motion:reduce){
  .ps-btn:active,.ps-shoot:active{transform:none;}
  .ps-table{transform:none !important;}
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
}

const KIND_FILL: Record<BallKind, string> = {
  cue: "#fdfdf7",
  warm: "#f4845f",
  cool: "#5aa9e6",
  black: "#3b3b52",
};

const KIND_NAME: Record<BallKind, string> = {
  cue: "母球",
  warm: "暖色组",
  cool: "冷色组",
  black: "黑星球",
};

/**
 * 瞄准键：`[归哪一位, 拨几个细调步长]`。
 * 鸭梨一套 `WASD`、康康一套方向键；上下是「大步」，左右是「小步」。
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
    lay = tableLayout(viewportWidth());
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 台呢
    ctx.fillStyle = "#cde8d0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#bfe0c4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 库边
    ctx.strokeStyle = "#9c7b5a";
    ctx.lineWidth = Math.max(6, s * 2.4);
    ctx.strokeRect(
      ctx.lineWidth / 2,
      ctx.lineWidth / 2,
      canvas.width - ctx.lineWidth,
      canvas.height - ctx.lineWidth
    );

    // 袋口
    for (const p of POCKETS) {
      const sp = toScreen(p, lay);
      ctx.beginPath();
      ctx.fillStyle = "#4a4a55";
      ctx.arc(sp.x, sp.y, TABLE.pocketR * s * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // 指定袋高亮
    if (calledPocket !== null && calledPocket >= 0) {
      const sp = toScreen(POCKETS[calledPocket], lay);
      ctx.beginPath();
      ctx.strokeStyle = "#ffb43c";
      ctx.lineWidth = 3;
      ctx.arc(sp.x, sp.y, TABLE.pocketR * s * 1.15, 0, Math.PI * 2);
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
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
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

    // 球
    for (const b of balls) {
      const sink = sinking.get(b.id);
      if (b.potted && sink === undefined) continue;
      const p = toScreen(b, lay);
      const shrink = sink === undefined ? 1 : Math.max(0, 1 - sink);
      const r = TABLE.r * s * shrink;
      if (r <= 0.3) continue;
      ctx.globalAlpha = sink === undefined ? 1 : Math.max(0, 1 - sink * 0.9);
      ctx.beginPath();
      ctx.fillStyle = KIND_FILL[b.kind];
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(40,60,50,.35)";
      ctx.stroke();
      if (b.kind === "black") {
        ctx.beginPath();
        ctx.fillStyle = "#ffe9a8";
        ctx.arc(p.x, p.y, r * 0.34, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 自由球预览
    if (phase === "place" && placePos) {
      const p = toScreen(placePos, lay);
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.fillStyle = "#fdfdf7";
      ctx.arc(p.x, p.y, TABLE.r * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
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
    const res = summarizeShot(cloneBalls(balls), shotEvents.slice(), crossed, shotSteps);
    refresh();
    opts.onSettled(res, currentShot);
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
      for (const ev of out.events) {
        shotEvents.push(ev);
        if (ev.type === "pot") {
          sinking.set(ev.id, 0);
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
      if (phase === "rolling") stepRolling(dt);
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
   * 双人同屏（两个座位都是真人）时鸭梨一套、康康一套；
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
      // 瞄准键也按座位分：鸭梨 WASD、康康 方向键，谁也拨不动对方那一杆
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
    if (patch.balls) balls = cloneBalls(patch.balls);
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
      shakeUntil = 0;
      shakeAmp = 0;
      tableBox.style.transform = "";
      clearVeil();
      wrap.remove();
      releaseCss();
    },
    update,
    rolling: () => phase === "rolling",
  };
}
