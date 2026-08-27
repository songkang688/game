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
  stageRoomPx,
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

/** 两位小主角的配色:鸭梨粉披风,康康蓝披风 */
const HERO_COLORS = [
  { body: "#FFD9A8", cape: "#FF8FB8", capeDark: "#E4699A", mask: "#7B4DA8", name: "鸭梨" },
  { body: "#FFE2BE", cape: "#7FB2FF", capeDark: "#5A8ADD", mask: "#2F6BAE", name: "康康" },
];

const FLOWERS = ["🌸", "🌼", "🌷", "🌻", "💐"];

/**
 * 「豆豆怪」的粉彩配色:一章一套,全是浅浅的糖果色。
 * 造型统一成圆润的小豆豆 + 大眼睛 + 微笑,**一点棕色写实都不要**。
 */
const BEAN_COLORS = [
  { body: "#FFC9DE", shade: "#F7A8C6", face: "#B4577E" },
  { body: "#C9E7C0", shade: "#A9D6A0", face: "#4F8258" },
  { body: "#C6DCF7", shade: "#A6C4E8", face: "#3F6C9E" },
  { body: "#FFE0AE", shade: "#F6CB86", face: "#A9782C" },
  { body: "#F6C6EA", shade: "#E7A6D6", face: "#9B4E86" },
  { body: "#BFE6F2", shade: "#9CD2E4", face: "#3C7C92" },
  { body: "#FFF0B0", shade: "#F3DE86", face: "#9C8320" },
  { body: "#DACDF6", shade: "#C0AEE8", face: "#6A4FA8" },
];

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
/* 触屏设备用不上键盘提示,省下的高度留给画面 */
@media (hover:none) and (max-width:420px){ .ph-pad-name{display:none;} }
@media (max-height:620px){
  .ph-cv{height:138px;}
  .ph-wrap[data-players="2"] .ph-cv{height:224px;}
  .ph-pads{--k:44px;margin-top:4px;}
  .ph-pads[data-players="2"]{--k:44px;}
  .ph-tip{margin-top:4px;font-size:11px;}
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

function emoji(g: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number): void {
  g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(ch, x, y);
}

// ---------------------------------------------------------------------------
// 场地:一块画布 + 一套操作 + 一个世界
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
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

const PARTICLE_FOR_EVENT: Partial<Record<WorldEvent["kind"], string>> = {
  flower: "🌸",
  wipe: "✨",
  sparkle: "⭐",
  hurt: "💫",
  smash: "💨",
  spring: "🍄",
  pickup: "🫳",
  sortGood: "⭐",
  sortSoft: "🤔",
  cart: "🚚",
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
  const pauseBtn = el("button", "ph-btn");
  pauseBtn.type = "button";
  pauseBtn.innerHTML = `⏸<span class="ph-lbl"> 暂停</span>`;
  pauseBtn.setAttribute("aria-label", "暂停(也可以按 Esc)");
  hud.append(hearts, bar, sparkChip);
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
      el("span", "pph-role pph-role-sweep", "鸭梨 · 清扫"),
      el("span", "pph-role pph-role-haul", "康康 · 搬运分类")
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
          ? "鸭梨 · W A S D · F 冲刺 · G 扫"
          : "康康 · ↑←↓→ · L 冲刺 · K 扫"
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

  /** 舞台矮到摇杆掉出裁切线时,把超出的那一截从画布身上扣掉 */
  function fitCanvas(): void {
    canvas.style.height = "";
    const next = canvasRoomPx(wrap.scrollHeight, canvas.offsetHeight, stageRoomPx(wrap));
    if (next === null) return;
    canvas.style.height = `${next}px`;
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
      if (gentle) continue;
      const art = PARTICLE_FOR_EVENT[ev.kind];
      if (art) {
        particles.push({ x: ev.x, y: ev.y, vy: -34, life: 0.9, text: art, size: 18 });
        if (particles.length > 40) particles.shift();
      }
    }
  }

  // ---- 渲染 ----
  const pal = PALETTES[world.def.chapterIndex % PALETTES.length];

  function drawHero(
    ctx2: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    scale: number,
    pi: number,
    p: World["players"][number]
  ): void {
    const colors = HERO_COLORS[pi % HERO_COLORS.length];
    const h = (p.crouch ? CROUCH_H : PLAYER_H) * scale;
    const w = PLAYER_W * scale;
    const blink = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
    const headR = Math.max(4, w * 0.38);
    const headCY = -h + headR * 0.95;
    const bodyTop = headCY + headR * 0.7;
    ctx2.save();
    ctx2.globalAlpha = blink ? 0.45 : 1;
    ctx2.translate(sx, sy);
    ctx2.scale(p.facing, 1);

    // 披风(在身后飘)
    const flap = p.onGround ? 0 : 0.22;
    ctx2.fillStyle = colors.capeDark;
    ctx2.beginPath();
    ctx2.moveTo(-w * 0.05, bodyTop - headR * 0.1);
    ctx2.quadraticCurveTo(-w * (1.05 + flap), -h * 0.42, -w * (0.5 + flap), -h * 0.02);
    ctx2.quadraticCurveTo(-w * 0.22, -h * 0.24, -w * 0.05, bodyTop + h * 0.1);
    ctx2.closePath();
    ctx2.fill();
    ctx2.fillStyle = colors.cape;
    ctx2.beginPath();
    ctx2.moveTo(0, bodyTop - headR * 0.1);
    ctx2.quadraticCurveTo(-w * (0.82 + flap), -h * 0.4, -w * (0.34 + flap), -h * 0.06);
    ctx2.quadraticCurveTo(-w * 0.14, -h * 0.26, 0, bodyTop + h * 0.08);
    ctx2.closePath();
    ctx2.fill();

    // 小脚
    ctx2.fillStyle = colors.capeDark;
    ctx2.beginPath();
    ctx2.ellipse(-w * 0.17, -h * 0.02, w * 0.16, h * 0.055, 0, 0, Math.PI * 2);
    ctx2.ellipse(w * 0.17, -h * 0.02, w * 0.16, h * 0.055, 0, 0, Math.PI * 2);
    ctx2.fill();

    // 身体(套着披风领的连身衣)
    ctx2.fillStyle = colors.cape;
    roundRect(ctx2, -w * 0.36, bodyTop, w * 0.72, -bodyTop - h * 0.02, w * 0.26);
    ctx2.fill();
    // 胸口小花徽章
    ctx2.fillStyle = "#FFF6DC";
    ctx2.beginPath();
    ctx2.arc(0, bodyTop + (-bodyTop) * 0.42, Math.max(2, w * 0.15), 0, Math.PI * 2);
    ctx2.fill();
    ctx2.fillStyle = colors.mask;
    ctx2.beginPath();
    ctx2.arc(0, bodyTop + (-bodyTop) * 0.42, Math.max(1, w * 0.07), 0, Math.PI * 2);
    ctx2.fill();

    // 脑袋
    ctx2.fillStyle = colors.body;
    ctx2.beginPath();
    ctx2.arc(0, headCY, headR, 0, Math.PI * 2);
    ctx2.fill();
    // 眼罩
    ctx2.fillStyle = colors.mask;
    roundRect(ctx2, -headR * 0.98, headCY - headR * 0.38, headR * 1.96, headR * 0.6, headR * 0.26);
    ctx2.fill();
    ctx2.fillStyle = "#FFFFFF";
    ctx2.beginPath();
    ctx2.arc(headR * 0.34, headCY - headR * 0.08, Math.max(1.2, headR * 0.16), 0, Math.PI * 2);
    ctx2.arc(-headR * 0.24, headCY - headR * 0.08, Math.max(1.2, headR * 0.16), 0, Math.PI * 2);
    ctx2.fill();
    // 腮红与笑脸
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

    // 手里的小扫帚
    if (p.sweepT > 0 || p.dashT > 0) {
      ctx2.strokeStyle = "#B98A5E";
      ctx2.lineWidth = Math.max(1.5, w * 0.09);
      ctx2.beginPath();
      ctx2.moveTo(w * 0.3, -h * 0.55);
      ctx2.lineTo(w * 0.85, -h * 0.18);
      ctx2.stroke();
      ctx2.fillStyle = "#F6D08A";
      roundRect(ctx2, w * 0.76, -h * 0.3, w * 0.36, h * 0.26, w * 0.1);
      ctx2.fill();
    }
    ctx2.restore();

    // 冲刺时的小气流
    if (p.dashT > 0) {
      ctx2.globalAlpha = 0.5;
      emoji(ctx2, "💨", sx - p.facing * w * 1.1, sy - h * 0.5, 16 * Math.max(0.7, scale));
      ctx2.globalAlpha = 1;
    }
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
      const pop = m.bloom > 0 && !gentle ? 1 + m.bloom : 1;
      emoji(ctx2, FLOWERS[idx % FLOWERS.length], sx, groundY - MONSTER_H * 0.45 * scale, 24 * scale * pop);
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

    // 小短脚
    ctx2.fillStyle = col.shade;
    ctx2.beginPath();
    ctx2.ellipse(sx - w * 0.2, groundY - 3 * scale, w * 0.15, 4 * scale, 0, 0, Math.PI * 2);
    ctx2.ellipse(sx + w * 0.2, groundY - 3 * scale, w * 0.15, 4 * scale, 0, 0, Math.PI * 2);
    ctx2.fill();

    // 豆豆身体:下面胖、上面收,一颗鼓鼓的圆豆子
    ctx2.fillStyle = col.body;
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

    // 天空
    const sky = g.createLinearGradient(0, 0, 0, cssH);
    sky.addColorStop(0, pal.sky0);
    sky.addColorStop(1, pal.sky1);
    g.fillStyle = sky;
    g.fillRect(0, 0, cssW, cssH);

    // 远景:软软的小房子和云
    g.globalAlpha = 0.45;
    for (let i = 0; i < 16; i++) {
      const bx = ((i * 260 - camX * 0.32) % (viewW + 520)) - 200;
      const bh = 46 + ((i * 37) % 62);
      const bw = 88 + ((i * 23) % 46);
      g.fillStyle = pal.far;
      roundRect(g, bx * scale, groundY - bh * scale, bw * scale, bh * scale, 14 * scale);
      g.fill();
      g.fillStyle = "#FFFFFF";
      g.globalAlpha = 0.26;
      const top = groundY - bh * scale;
      for (let r = 0; r * 26 + 36 < bh; r++) {
        for (let c = 0; c * 28 + 28 < bw; c++) {
          roundRect(g, bx * scale + (15 + c * 28) * scale, top + (15 + r * 26) * scale, 8 * scale, 8 * scale, 3 * scale);
          g.fill();
        }
      }
      g.globalAlpha = 0.45;
    }
    g.globalAlpha = 1;
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

    // 地面(断口留空)
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
      g.fillRect(x0, groundY, x1 - x0, 9 * scale);
      g.fillStyle = pal.deco;
      for (let d = Math.ceil(a / 90) * 90; d < b; d += 90) {
        g.fillRect(sx(d), groundY + 14 * scale, 5 * scale, 5 * scale);
      }
    }

    // 泥洼与污渍
    world.sludges.forEach((s, i) => {
      const x0 = sx(s.x);
      const x1 = sx(s.x + s.w);
      if (x1 < -30 || x0 > cssW + 30) return;
      if (s.clean) {
        for (let k = 0; k * 46 < s.w; k++) {
          emoji(g, FLOWERS[(i + k) % FLOWERS.length], sx(s.x + 22 + k * 46), groundY - 9 * scale, 15 * scale);
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
        emoji(g, FLOWERS[i % FLOWERS.length], x, groundY - 10 * scale, 15 * scale);
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
      emoji(g, "💫", x - 8 * scale, groundY - 12 * scale, 10 * scale);
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
      if (pl.moving) emoji(g, "🫧", x + pl.w * scale * 0.5, sy(pl.y) - 9 * scale, 13 * scale);
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

    // 香香星
    world.sparkles.forEach((s) => {
      if (s.taken) return;
      const x = sx(s.x);
      if (x < -30 || x > cssW + 30) return;
      const bob = Math.sin(world.time * 3 + s.x * 0.02) * 3 * scale;
      emoji(g, "✨", x, sy(s.y) + bob, 19 * scale);
    });

    // 豆豆怪 / 小花
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
      emoji(g, item.emoji, x, groundY - 15 * scale, 20 * scale);
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
      emoji(g, info.emoji, x, groundY - 24 * scale - lift, 17 * scale);
      g.fillStyle = "#3C3348";
      g.font = `900 ${Math.round(9 * Math.max(0.9, scale))}px system-ui,sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(info.short, x, groundY - 9 * scale - lift);
      if (bin.flash > 0) {
        emoji(g, bin.lastOk ? "⭐" : "🤔", x, groundY - 58 * scale, 16 * scale);
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
        emoji(g, "🧽", x, groundY - (CART_H - 12) * scale, 15 * scale);
        if (world.cart.pushed && !gentle) emoji(g, "💨", x - 34 * scale, groundY - 16 * scale, 13 * scale);
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
      emoji(g, open ? "🧼" : "🔒", doorX, groundY - 52 * scale, 24 * scale);
      g.fillStyle = "#6B4A32";
      g.font = `900 ${Math.round(11 * Math.max(0.85, scale))}px system-ui,sans-serif`;
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
          emoji(g, "💨", cx - (12 + k * 26) * scale, groundY - (18 + ((k * 37) % 60)) * scale, 15 * scale);
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

    // 角色
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
          g.font = "900 12px system-ui,sans-serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(x < 0 ? "◀" : "▶", edge, groundY - 60);
        }
        return;
      }
      drawHero(g, x, sy(p.y), scale, i, p);
      // 手上抱着的垃圾:顶在头上,一眼看得出在搬什么
      if (p.carry) {
        const item = trashById(p.carry);
        if (item) emoji(g, item.emoji, x, sy(p.y) - (PLAYER_H + 18) * scale, 17 * scale);
      }
    });

    // 小特效
    for (const pt of particles) {
      g.globalAlpha = Math.max(0, Math.min(1, pt.life));
      emoji(g, pt.text, sx(pt.x), sy(pt.y), pt.size * scale);
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
      g.font = `800 ${Math.round(13 * Math.max(0.85, scale))}px system-ui,sans-serif`;
      g.fillStyle = "#9A7A5E";
      g.fillText(def.hint.slice(0, 24), cssW / 2, cssH * 0.56);
      // 开场顺带念一条卫生小知识(洗手 / 分类 / 少用一次性)
      g.font = `700 ${Math.round(12 * Math.max(0.85, scale))}px system-ui,sans-serif`;
      g.fillStyle = "#A98F76";
      g.fillText(hygieneTip(def.index + def.chapterIndex), cssW / 2, cssH * 0.64);
    }
  }

  function renderHud(): void {
    hearts.textContent = `${"❤️".repeat(Math.max(0, world.hearts))}${"🤍".repeat(
      Math.max(0, world.def.hearts - Math.max(0, world.hearts))
    )}`;
    const pct = Math.round(cleanRatio(world) * 100);
    barFill.style.width = `${pct}%`;
    barTxt.textContent = `清洁度 ${pct}%`;
    sparkChip.textContent = `✨ ${world.sparklesTaken}/${world.sparkles.length}`;
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
      tip: "分工行动!鸭梨清扫,康康把垃圾送进三色桶,最后一起站到净化门前。",
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
