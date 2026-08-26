export { meta } from "./meta";

// 朵星格斗王 —— 2D 卡通对打。
//
// 五种模式共用同一套对局界面：
//   · 双人对战：同屏两套键位，朵朵 WASD+F/G，星星 方向键+L/K；
//   · 人机对战：AI 三档，高档会防会反击，但有反应延迟；
//   · 格斗塔：走 src/games/level99.ts 的 188 关框架，八章八位守擂者；
//   · 无尽：连胜挑战，赢一场换一个更强的对手；
//   · 训练模式：元气不掉，屏幕上直接看帧数据和连段段数。
//
// 这是一款软软的切磋游戏：招式都是花瓣、星光、云朵、豆芽，被打中只会
// 星星飞溅、转圈圈、被弹开，条子上写的是「元气」，掉光就换人休息一下。
import { AI_HINTS, AI_LABELS, aiInput, createBrain, resetBrain, type AiBrain, type AiLevel } from "./ai";
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
  characterById,
  totalFrames,
  type Character,
  type Move
} from "./frames";
import {
  CHAPTERS,
  STAGE_SKY,
  endlessAiLevel,
  endlessBuff,
  endlessEndText,
  endlessFoeId,
  endlessStarReward,
  towerStage
} from "./levels";
import { meta } from "./meta";
import {
  isActiveFrame,
  movePhase,
  onBlockAdvantage,
  onHitAdvantage,
  rateByVigor,
  sparkCount
} from "./rules";
import { mountLevelGame, type GameApi, type PlayCtx, type SoundName } from "../level99";

/* ------------------------------------------------------------------ */
/* 样式                                                                */
/* ------------------------------------------------------------------ */

const CSS = `
.fk-root{--fk-ink:#4a3a68;--fk-soft:#7b6aa0;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  max-width:760px;margin:0 auto;color:var(--fk-ink);user-select:none;-webkit-user-select:none;}
.fk-root *{box-sizing:border-box;}
.fk-card{background:linear-gradient(180deg,#fffdff,#f5f0ff);border-radius:20px;padding:14px;
  box-shadow:0 4px 14px rgba(140,120,190,.16);margin-bottom:12px;}
.fk-h{font-size:18px;font-weight:900;margin:0 0 8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.fk-sub{font-size:13px;font-weight:700;color:var(--fk-soft);line-height:1.7;}
.fk-modes{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
@media (max-width:420px){.fk-modes{grid-template-columns:1fr;}}
.fk-mode{border:none;border-radius:18px;padding:14px;text-align:left;cursor:pointer;font-family:inherit;
  background:#fff;box-shadow:0 4px 0 rgba(130,105,180,.22);display:flex;gap:10px;align-items:flex-start;}
.fk-mode:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(130,105,180,.22);}
.fk-mode-emoji{font-size:26px;line-height:1;}
.fk-mode-t{font-size:16px;font-weight:900;color:#5b4890;}
.fk-mode-d{font-size:12.5px;font-weight:700;color:#8271ab;line-height:1.55;margin-top:3px;}
.fk-btn{border:none;border-radius:14px;padding:9px 15px;font-size:15px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#fff;color:#6b56a0;box-shadow:0 3px 0 rgba(120,95,170,.28);white-space:nowrap;}
.fk-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,95,170,.28);}
.fk-btn[disabled]{opacity:.45;cursor:default;box-shadow:none;transform:none;}
.fk-btn-go{background:linear-gradient(180deg,#e0679f,#c8497f);color:#fff;box-shadow:0 4px 0 #a33765;}
.fk-btn-go:active{box-shadow:0 1px 0 #a33765;}
.fk-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;}
.fk-picks{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
@media (max-width:520px){.fk-picks{grid-template-columns:1fr;}}
.fk-pick{background:#fff;border-radius:16px;padding:10px;box-shadow:0 3px 10px rgba(140,120,190,.14);}
.fk-pick-t{font-size:14px;font-weight:900;margin-bottom:6px;}
.fk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}
.fk-ch{border:none;border-radius:13px;padding:7px 2px;cursor:pointer;font-family:inherit;background:#f6f2ff;
  display:flex;flex-direction:column;align-items:center;gap:2px;box-shadow:0 2px 0 rgba(130,105,180,.18);}
.fk-ch:active{transform:translateY(1px);}
.fk-ch-e{font-size:21px;line-height:1;}
.fk-ch-n{font-size:11.5px;font-weight:900;color:#5b4890;}
.fk-ch-on{outline:3px solid #e0679f;background:#fff;}
.fk-info{margin-top:8px;font-size:12.5px;font-weight:700;color:#7b6aa0;line-height:1.6;min-height:52px;}
.fk-stage{position:relative;border-radius:18px;overflow:hidden;background:#fdf3f8;
  box-shadow:0 4px 14px rgba(140,120,190,.2);}
.fk-canvas{display:block;width:100%;height:auto;touch-action:none;}
.fk-hud{position:absolute;left:0;right:0;top:0;padding:8px 10px 0;pointer-events:none;}
.fk-hudrow{display:flex;align-items:flex-start;gap:8px;}
.fk-side{flex:1;min-width:0;}
.fk-side-r{text-align:right;}
.fk-name{font-size:12.5px;font-weight:900;color:#4a3a68;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  text-shadow:0 1px 0 rgba(255,255,255,.9);}
.fk-vig{height:13px;border-radius:999px;background:#ffffffcc;overflow:hidden;box-shadow:inset 0 1px 3px rgba(90,70,120,.25);}
.fk-vig-in{height:100%;border-radius:999px;background:linear-gradient(180deg,#7fd6a0,#48b57c);
  transition:width .12s linear;}
.fk-vig-low .fk-vig-in{background:linear-gradient(180deg,#ffb27a,#ef8149);}
.fk-mtr{height:7px;border-radius:999px;background:#ffffffcc;overflow:hidden;margin-top:3px;
  box-shadow:inset 0 1px 2px rgba(90,70,120,.22);}
.fk-mtr-in{height:100%;border-radius:999px;background:linear-gradient(180deg,#ffe08a,#f2b429);}
.fk-mtr-full .fk-mtr-in{background:linear-gradient(180deg,#ffd0ec,#e0679f);}
.fk-pips{font-size:12px;letter-spacing:2px;color:#e0679f;height:14px;}
.fk-clock{width:74px;text-align:center;flex:0 0 auto;}
.fk-clock-t{font-size:21px;font-weight:900;color:#4a3a68;line-height:1;text-shadow:0 1px 0 rgba(255,255,255,.9);}
.fk-clock-r{font-size:11px;font-weight:800;color:#7b6aa0;}
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
.fk-padbtn{border:none;border-radius:14px;padding:14px 4px;font-size:14px;font-weight:900;font-family:inherit;
  cursor:pointer;background:#ffe3ef;color:#a33765;box-shadow:0 3px 0 rgba(180,110,150,.35);touch-action:none;}
.fk-padbtn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(180,110,150,.35);}
.fk-padbtn-h{background:#e2e8ff;color:#41539c;box-shadow:0 3px 0 rgba(100,120,190,.35);}
.fk-padbtn-h:active{box-shadow:0 1px 0 rgba(100,120,190,.35);}
.fk-pad-name{font-size:11px;font-weight:900;color:#7b6aa0;text-align:center;}
.fk-hidden{display:none !important;}
.fk-fd{width:100%;border-collapse:collapse;font-size:12px;}
.fk-fd th,.fk-fd td{padding:4px 5px;text-align:center;border-bottom:1px solid #efe9fa;}
.fk-fd th{color:#8271ab;font-weight:800;}
.fk-fd td{font-weight:800;color:#5b4890;}
.fk-fd td.fk-fd-n{text-align:left;white-space:nowrap;}
.fk-fd-plus{color:#3f8f5f;}
.fk-fd-minus{color:#c05b5b;}
.fk-scroll{overflow-x:auto;}
.fk-live{font-size:12.5px;font-weight:800;color:#5b4890;line-height:1.7;}
.fk-btn:focus-visible,.fk-mode:focus-visible,.fk-ch:focus-visible,.fk-padbtn:focus-visible{
  outline:3px solid #3c2a6b;outline-offset:3px;}
/* 手机上两套摇杆挤在一行，摇杆收小、轻重击改成上下两颗，免得按键被挤出屏幕 */
@media (max-width:520px){
  .fk-pads{gap:6px;}
  .fk-pad{padding:6px;gap:6px;}
  .fk-stick{width:74px;height:74px;}
  .fk-stick-dot{width:28px;height:28px;margin:-14px 0 0 -14px;}
  .fk-padbtns{grid-template-columns:1fr;gap:5px;}
  .fk-padbtn{padding:11px 2px;font-size:13px;}
}
@media (prefers-reduced-motion:reduce){
  .fk-vig-in{transition:none;}
}
`;

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

const FRAME_MS = 1000 / 60;
const CANVAS_W = STAGE_WIDTH;
/** 宽屏用扁一点的画面，窄屏用方一点的画面（手机上才装得下放大后的两个人） */
const CANVAS_H_WIDE = 380;
const CANVAS_H_NARROW = 470;
/** 低于这个 CSS 宽度就算窄屏 */
const NARROW_PX = 520;

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

function button(cls: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", cls, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
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
  /** 顶部标题（格斗塔显示关号，无尽显示连胜数） */
  title: string;
  sfx: (name: SoundName) => void;
  /** 一场打完（训练模式不会调用） */
  onEnd: (winner: 0 | 1 | -1, info: { vigorLeft: number; maxVigor: number; wins: [number, number] }) => void;
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
    const cssW = canvas.clientWidth || (globalThis as { innerWidth?: number }).innerWidth || 400;
    const narrow = cssW > 0 && cssW < NARROW_PX;
    if (narrow === narrowLayout) return;
    narrowLayout = narrow;
    canvas.height = narrow ? CANVAS_H_NARROW : CANVAS_H_WIDE;
  }

  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "对打画面");
  stage.appendChild(canvas);

  const hud = el("div", "fk-hud");
  hud.innerHTML = `
    <div class="fk-hudrow">
      <div class="fk-side">
        <div class="fk-name" data-n="0"></div>
        <div class="fk-vig" data-v="0"><div class="fk-vig-in" style="width:100%"></div></div>
        <div class="fk-mtr" data-m="0"><div class="fk-mtr-in" style="width:0%"></div></div>
        <div class="fk-pips" data-p="0"></div>
      </div>
      <div class="fk-clock">
        <div class="fk-clock-t" data-clock>--</div>
        <div class="fk-clock-r" data-round></div>
      </div>
      <div class="fk-side fk-side-r">
        <div class="fk-name" data-n="1"></div>
        <div class="fk-vig" data-v="1"><div class="fk-vig-in" style="width:100%"></div></div>
        <div class="fk-mtr" data-m="1"><div class="fk-mtr-in" style="width:0%"></div></div>
        <div class="fk-pips" data-p="1"></div>
      </div>
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
  const padCleanups: Array<() => void> = [];

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
    col.append(nameEl, lightBtn, heavyBtn);
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

    const bindBtn = (btn: HTMLButtonElement, key: "light" | "heavy"): void => {
      const down = (e: PointerEvent): void => {
        e.preventDefault();
        touchInputs[side] = { ...touchInputs[side], [key]: true };
      };
      const up = (): void => {
        touchInputs[side] = { ...touchInputs[side], [key]: false };
      };
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
    bindBtn(lightBtn, "light");
    bindBtn(heavyBtn, "heavy");
    return pad;
  }

  pads.appendChild(buildPad(0, `${characterById(o.p1).emoji} ${characterById(o.p1).name}`));
  if (o.aiLevel === null) {
    pads.appendChild(buildPad(1, `${characterById(o.p2).emoji} ${characterById(o.p2).name}`));
  }
  if (!coarsePointer()) pads.classList.add("fk-hidden");
  wrap.appendChild(pads);

  const padToggle = button("fk-btn", "📱 触屏按键", () => {
    pads.classList.toggle("fk-hidden");
    o.sfx("tap");
  });
  bar.appendChild(padToggle);

  /* ---------------- 训练模式面板 ---------------- */

  const trainPanel = el("div", "fk-card");
  const trainLive = el("div", "fk-live");
  if (o.training) {
    const h = el("div", "fk-h", "🎓 帧数据（你的角色）");
    const scroll = el("div", "fk-scroll");
    scroll.appendChild(frameTable(characterById(o.p1)));
    trainPanel.append(h, trainLive, scroll);
    wrap.appendChild(trainPanel);
  }

  host.appendChild(wrap);

  const g = canvas.getContext("2d");

  /* ---------------- 键盘 ---------------- */

  const pressed = new Set<string>();

  function onKeyDown(e: KeyboardEvent): void {
    if (destroyed) return;
    if (e.code === PAUSE_KEY) {
      e.preventDefault();
      setPaused(!paused);
      return;
    }
    if (!isGameKey(e.code)) return;
    e.preventDefault();
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

  function restartMatch(): void {
    wins[0] = 0;
    wins[1] = 0;
    roundIndex = 0;
    if (brain) resetBrain(brain);
    state = newMatch();
    sparks.length = 0;
    screenPhase = "ready";
    phaseTimer = 90;
    bannerBig = "准备…";
    bannerSub = "看清对手的起手再动手";
  }

  function startNextRound(): void {
    roundIndex++;
    if (brain) resetBrain(brain);
    state = newMatch();
    sparks.length = 0;
    camScale = 0;
    screenPhase = "ready";
    phaseTimer = 80;
    bannerBig = `第 ${roundIndex + 1} 回合`;
    bannerSub = "准备…";
  }

  function readPlayerInput(side: 0 | 1): InputFrame {
    const kb = readKeys(pressed, KEY_MAPS[side]);
    return normalizeInput(mergeInput(kb, touchInputs[side]));
  }

  function gatherInputs(): [InputFrame, InputFrame] {
    const p1 = readPlayerInput(0);
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

  function handleEvents(): void {
    let played: SoundName | null = null;
    for (const ev of state.events) {
      switch (ev.type) {
        case "hit":
          spawnSparks(ev.x, ev.y, ev.power);
          played = played ?? "pop";
          break;
        case "throw":
          spawnSparks(ev.x, ev.y, ev.power);
          played = "jump";
          break;
        case "block":
          spawnSparks(ev.x, ev.y, 3);
          played = played ?? "tap";
          break;
        case "guardbreak":
          spawnSparks(ev.x, ev.y, 14);
          played = "oops";
          break;
        case "super":
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
      bannerBig = `${characterById(champ === 0 ? o.p1 : o.p2).emoji} ${characterById(champ === 0 ? o.p1 : o.p2).name} 赢啦！`;
      bannerSub = champ === 0 ? "干得漂亮，再来一场？" : "对手这次更稳一点，再试试！";
      o.sfx(champ === 0 ? "win" : "oops");
      const me = state.fighters[0];
      later(() => {
        if (!destroyed) o.onEnd(champ, { vigorLeft: me.vigor, maxVigor: me.maxVigor, wins: [wins[0], wins[1]] });
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
    // 粒子始终在动（哪怕在读条），画面不会冷冷清清
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.22;
      s.life--;
      if (s.life <= 0) sparks.splice(i, 1);
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
      return;
    }

    stepMatch(state, gatherInputs());
    handleEvents();

    const combo = Math.max(state.fighters[0].combo, state.fighters[1].combo);
    if (combo > lastComboShown && combo >= 3) o.sfx("coin");
    lastComboShown = combo;

    if (state.over) onRoundOver();
  }

  /* ---------------- 绘制 ---------------- */

  const skyIndex = Math.abs(hashString(o.p1 + o.p2)) % STAGE_SKY.length;

  function drawFighter(ctx: CanvasRenderingContext2D, f: FighterState): void {
    const ch = charOf(f);
    const line = groundY();
    const crouch = f.crouching && !f.airborne;
    const h = crouch ? ch.crouchHeight : ch.height;
    const hw = ch.halfWidth;
    const feet = line - f.y;
    const down = f.phase === "knockdown";

    // 影子
    ctx.save();
    ctx.fillStyle = "rgba(95,75,130,.15)";
    ctx.beginPath();
    const shrink = Math.max(0.45, 1 - f.y / 220);
    ctx.ellipse(f.x, line + 5, hw * shrink, 6 * shrink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    if (down) {
      // 被弹开躺一下：整个人转 70 度，脑袋朝外，纯卡通表现
      ctx.translate(f.x, line - 14);
      ctx.rotate((-f.facing * 70 * Math.PI) / 180);
      ctx.translate(-f.x, -(line - 14));
    }

    const bodyTop = feet - h;
    const headR = hw * 0.74;
    const shoulderY = bodyTop + headR * 2.15;
    // 躯干只画到胯，剩下的留给两条腿，不然手脚全被身体盖住了
    const hipY = feet - h * (crouch ? 0.16 : 0.28);
    const mv = currentMove(f);
    const ph = mv && f.phase === "attack" ? movePhase(mv, f.frame) : null;

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

    ctx.strokeStyle = ch.ink;
    ctx.lineCap = "round";

    // 前肢在朝向对手的那一侧，后肢在另一侧
    const fw = f.facing;
    const kickTip = kicking ? swingTip(hipY) : null;
    const punchTip = kicking ? null : swingTip(shoulderY);

    /** `side` 取 +1 画朝着对手那一侧的手脚，取 -1 画背对的一侧 */
    function limbs(side: 1 | -1): void {
      ctx.lineWidth = hw * 0.5;
      ctx.beginPath();
      ctx.moveTo(f.x + side * fw * hw * 0.45, hipY);
      if (side === 1 && kickTip) ctx.lineTo(kickTip.x, kickTip.y);
      else ctx.lineTo(f.x + side * fw * (hw * 0.45 + stride), feet - 2 - tuck);
      ctx.stroke();

      ctx.lineWidth = hw * 0.42;
      ctx.beginPath();
      ctx.moveTo(f.x + side * fw * hw * 0.6, shoulderY);
      if (side === 1 && punchTip) ctx.lineTo(punchTip.x, punchTip.y);
      else if (side === 1 && f.blocking) ctx.lineTo(f.x + fw * hw * 1.05, shoulderY - h * 0.04);
      else ctx.lineTo(f.x + side * fw * hw * 1.25, shoulderY + h * 0.18);
      ctx.stroke();
    }

    limbs(-1);

    // 身体
    ctx.fillStyle = ch.color;
    ctx.lineWidth = 3;
    roundRect(ctx, f.x - hw, bodyTop + headR, hw * 2, hipY - bodyTop - headR, hw * 0.55);
    ctx.fill();
    ctx.stroke();
    // 脑袋
    ctx.beginPath();
    ctx.arc(f.x, bodyTop + headR, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 眼睛（朝向对手）
    ctx.fillStyle = ch.ink;
    const ex = f.x + f.facing * headR * 0.3;
    const ey = bodyTop + headR - headR * 0.12;
    ctx.beginPath();
    ctx.arc(ex - f.facing * headR * 0.3, ey, 3.1, 0, Math.PI * 2);
    ctx.arc(ex + f.facing * headR * 0.12, ey, 3.1, 0, Math.PI * 2);
    ctx.fill();
    // 腮红
    ctx.fillStyle = "rgba(255,150,180,.55)";
    ctx.beginPath();
    ctx.ellipse(ex + f.facing * headR * 0.35, ey + headR * 0.34, headR * 0.22, headR * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    // 招式：起手一层淡淡的预告，命中帧画出真正的判定框
    if (mv && ph && ph !== "recovery") {
      const bx = f.facing === 1 ? f.x + mv.box.x : f.x - mv.box.x - mv.box.w;
      const by = feet - mv.box.y - mv.box.h;
      const r = Math.min(mv.box.w, mv.box.h) * 0.42;
      ctx.save();
      if (ph === "active") {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = mv.kind === "super" ? "rgba(255,214,240,.95)" : ch.color;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        roundRect(ctx, bx, by, mv.box.w, mv.box.h, r);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = ch.ink;
        roundRect(ctx, bx, by, mv.box.w, mv.box.h, r);
        ctx.fill();
      }
      ctx.restore();
    }

    // 出招的那只手脚压在判定框上面，看得清是谁伸出去的
    ctx.strokeStyle = ch.ink;
    limbs(1);
    ctx.restore();

    // 名牌 emoji
    ctx.save();
    ctx.font = "20px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(ch.emoji, f.x, bodyTop - 8);
    ctx.restore();

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

    // 眩晕：破防或倒地时头顶转圈的小星星
    if (down || f.phase === "guardbreak") {
      ctx.save();
      ctx.font = "15px system-ui";
      ctx.textAlign = "center";
      const t = reduced ? 0 : state.frame * 0.12;
      for (let i = 0; i < 3; i++) {
        const a = t + (i * Math.PI * 2) / 3;
        ctx.fillText("⭐", f.x + Math.cos(a) * 18, line - h * 0.9 + Math.sin(a) * 6);
      }
      ctx.restore();
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
    const H = canvas.height;
    const line = groundY();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, CANVAS_W, H);

    const shake = reduced ? 0 : state.shake;
    if (shake > 0) {
      g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // 天空 + 地面
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, STAGE_SKY[skyIndex]);
    sky.addColorStop(1, "#ffffff");
    g.fillStyle = sky;
    g.fillRect(-20, -20, CANVAS_W + 40, H + 40);
    g.fillStyle = "#f2e6f7";
    g.fillRect(-20, line, CANVAS_W + 40, H - line + 20);
    g.strokeStyle = "#dcc9e8";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-20, line);
    g.lineTo(CANVAS_W + 20, line);
    g.stroke();

    const cam = camera();
    g.save();
    g.translate(0, line);
    g.scale(cam.scale, cam.scale);
    g.translate(-cam.camX, -line);

    drawFighter(g, state.fighters[0]);
    drawFighter(g, state.fighters[1]);

    for (const s of sparks) {
      g.save();
      g.globalAlpha = Math.max(0, s.life / s.maxLife);
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.restore();

    // 连段计数
    for (const f of state.fighters) {
      if (f.combo >= 2) {
        g.save();
        g.font = "900 24px system-ui";
        g.textAlign = f.side === 0 ? "left" : "right";
        g.fillStyle = "#c8497f";
        g.strokeStyle = "#fff";
        g.lineWidth = 4;
        const tx = f.side === 0 ? 30 : CANVAS_W - 30;
        g.strokeText(`${f.combo} 连击！`, tx, 118);
        g.fillText(`${f.combo} 连击！`, tx, 118);
        g.restore();
      }
    }

    g.setTransform(1, 0, 0, 1, 0, 0);
    updateHud();
  }

  const nameEls = [hud.querySelector('[data-n="0"]'), hud.querySelector('[data-n="1"]')] as HTMLElement[];
  const vigEls = [hud.querySelector('[data-v="0"]'), hud.querySelector('[data-v="1"]')] as HTMLElement[];
  const pipEls = [hud.querySelector('[data-p="0"]'), hud.querySelector('[data-p="1"]')] as HTMLElement[];
  const mtrEls = [hud.querySelector('[data-m="0"]'), hud.querySelector('[data-m="1"]')] as HTMLElement[];
  const clockEl = hud.querySelector("[data-clock]") as HTMLElement;
  const roundEl = hud.querySelector("[data-round]") as HTMLElement;

  function updateHud(): void {
    for (const side of [0, 1] as const) {
      const f = state.fighters[side];
      const ch = charOf(f);
      const ratio = vigorRatio(f);
      nameEls[side].textContent = `${ch.emoji} ${ch.name}`;
      const inner = vigEls[side].firstElementChild as HTMLElement;
      inner.style.width = `${Math.round(ratio * 100)}%`;
      vigEls[side].classList.toggle("fk-vig-low", ratio <= 0.3);
      const mi = mtrEls[side].firstElementChild as HTMLElement;
      mi.style.width = `${Math.round(meterRatio(f) * 100)}%`;
      mtrEls[side].classList.toggle("fk-mtr-full", superReady(f));
      pipEls[side].textContent = "★".repeat(wins[side]);
    }
    clockEl.textContent = o.training ? "∞" : String(Math.ceil(state.timeLeft / 60));
    roundEl.textContent = o.training ? "训练" : `第 ${roundIndex + 1} 回合`;
    bannerBigEl.textContent = bannerBig;
    bannerSubEl.textContent = bannerSub;
    if (o.training) updateTrainLive();
  }

  function updateTrainLive(): void {
    const me = state.fighters[0];
    const mv = currentMove(me);
    const phaseText = mv ? movePhase(mv, me.frame) : null;
    const phaseLabel =
      phaseText === "startup" ? "起手" : phaseText === "active" ? "命中" : phaseText === "recovery" ? "收招" : "—";
    trainLive.innerHTML = `
      <div>当前招式：<b>${mv ? mv.name : "站着不动"}</b>　阶段：<b>${phaseLabel}</b>　第 ${mv ? me.frame + 1 : 0} 帧</div>
      <div>连段：<b>${me.combo}</b> 段（本回合最长 <b>${me.bestCombo}</b> 段）　能量：<b>${Math.round(me.meter)}</b> / 100</div>
      <div>格挡槽：<b>${Math.round(me.guard)}</b> / ${me.guardMax}　与陪练的距离：<b>${Math.round(gapBetween(me, state.fighters[1]))}</b></div>`;
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
  { mode: "cpu", emoji: "🤖", title: "人机对战", desc: "AI 三档，高手档会防会反击，但也有反应延迟" },
  { mode: "tower", emoji: "🏯", title: "格斗塔 188 关", desc: "八层八位守擂者，越往上对手越强、增益越厚" },
  { mode: "endless", emoji: "🔥", title: "无尽连胜", desc: "一场接一场，看看你能连赢多少次" },
  { mode: "training", emoji: "🎓", title: "训练模式", desc: "元气不掉，边打边看帧数据和连段段数" }
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
      b.innerHTML = `<span class="fk-mode-emoji">${m.emoji}</span>
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

    const card = el("div", "fk-card");
    const bar = el("div", "fk-bar");
    bar.appendChild(
      button("fk-btn", "◀ 返回", () => {
        sfx("tap");
        showMenu();
      })
    );
    const modeCard = MODE_CARDS.find((m) => m.mode === mode);
    bar.appendChild(el("span", "fk-h", `${modeCard?.emoji ?? ""} ${modeCard?.title ?? ""}`));
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
        b.innerHTML = `<span class="fk-ch-e">${ch.emoji}</span><span class="fk-ch-n">${ch.name}</span>`;
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
        info.innerHTML = `<b>${ch.emoji} ${ch.name}</b>　${ch.blurb}<br>${ch.style}<br>
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

    if (mode === "cpu" || mode === "endless" || mode === "training") {
      const row = el("div", "fk-bar");
      row.style.marginTop = "10px";
      row.appendChild(el("span", "fk-sub", mode === "training" ? "陪练强度：" : "对手强度："));
      const btns: HTMLButtonElement[] = [];
      ([0, 1, 2] as AiLevel[]).forEach((lv) => {
        const b = button("fk-btn", AI_LABELS[lv], () => {
          ai = lv;
          sfx("tap");
          btns.forEach((x, i) => x.classList.toggle("fk-ch-on", i === lv));
          hint.textContent = AI_HINTS[lv];
        });
        btns.push(b);
        row.appendChild(b);
      });
      btns[ai].classList.add("fk-ch-on");
      const hint = el("div", "fk-sub", AI_HINTS[ai]);
      card.appendChild(row);
      card.appendChild(hint);
    }

    const goRow = el("div", "fk-bar");
    goRow.style.marginTop = "12px";
    goRow.appendChild(
      button("fk-btn fk-btn-go", "开打 ▶", () => {
        sfx("jump");
        if (mode === "endless") startEndless(p1, p2, 0);
        else startPlain(mode, p1, p2, ai);
      })
    );
    card.appendChild(goRow);
    view.appendChild(card);
  }

  /* ---------------- 双人 / 人机 / 训练 ---------------- */

  function startPlain(mode: "versus" | "cpu" | "training", p1: string, p2: string, ai: AiLevel): void {
    clearScreen();
    const host = el("div");
    view.appendChild(host);
    const fight = createFight(host, {
      p1,
      p2,
      aiLevel: mode === "versus" ? null : ai,
      buffs: [noBuff(), noBuff()],
      roundsToWin: mode === "training" ? 1 : 2,
      timeLimitSec: 75,
      training: mode === "training",
      title:
        mode === "versus"
          ? "🥊 双人对战 · 先赢 2 回合"
          : mode === "cpu"
            ? `🤖 人机对战 · ${AI_LABELS[ai]}档`
            : "🎓 训练模式",
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
      onEnd: (winner) => {
        if (mode === "cpu" && winner === 0) api.addStars(1);
        showResult(winner === 0 ? "赢啦！" : "对手更稳一点", () => startPlain(mode, p1, p2, ai), () =>
          showSelect(mode)
        );
      }
    });
    screenCleanup = () => fight.destroy();
  }

  /* ---------------- 无尽 ---------------- */

  function startEndless(p1: string, firstFoe: string, streak: number): void {
    clearScreen();
    const host = el("div");
    view.appendChild(host);
    const foe = streak === 0 ? firstFoe : endlessFoeId(streak);
    const fight = createFight(host, {
      p1,
      p2: foe,
      aiLevel: endlessAiLevel(streak),
      buffs: [noBuff(), endlessBuff(streak)],
      roundsToWin: 1,
      timeLimitSec: 70,
      training: false,
      title: `🔥 无尽连胜 · 已连赢 ${streak} 场`,
      sfx,
      onQuit: () => {
        sfx("tap");
        showMenu();
      },
      onEnd: (winner) => {
        if (winner === 0) {
          const next = streak + 1;
          api.addStars(1);
          startEndless(p1, firstFoe, next);
          return;
        }
        const reward = endlessStarReward(streak);
        if (reward > 0) api.addStars(reward);
        showResult(endlessEndText(streak), () => startEndless(p1, firstFoe, 0), () => showSelect("endless"));
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

  function showTower(): void {
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

    // 塔里固定用朵朵登场；想换角色就去双人 / 人机模式挑
    let heroId = CHARACTERS[0].id;
    const heroRow = el("div", "fk-card");
    heroRow.appendChild(el("div", "fk-pick-t", "🌸 出战角色（随时可以换，换完从当前关继续）"));
    const grid = el("div", "fk-grid");
    const heroBtns: HTMLButtonElement[] = [];
    CHARACTERS.forEach((ch, i) => {
      const b = el("button", "fk-ch");
      b.type = "button";
      b.innerHTML = `<span class="fk-ch-e">${ch.emoji}</span><span class="fk-ch-n">${ch.name}</span>`;
      b.setAttribute("aria-label", `出战角色 ${ch.name}：${ch.style}`);
      b.addEventListener("click", () => {
        heroId = ch.id;
        sfx("pop");
        heroBtns.forEach((x, j) => x.classList.toggle("fk-ch-on", i === j));
      });
      heroBtns.push(b);
      grid.appendChild(b);
    });
    heroBtns[0].classList.add("fk-ch-on");
    heroRow.appendChild(grid);
    view.insertBefore(heroRow, towerHost);

    let currentFight: FightHandle | null = null;

    const tower = mountLevelGame(
      { ...api, root: towerHost },
      {
        id: meta.id,
        chapters: CHAPTERS,
        mapHint: "每一层的守擂者都在最后一关等你，赢得越轻松星星越多。",
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
            title: `🏯 第 ${ctx.level + 1} 关${stage.boss ? " · 守擂者" : ""}`,
            sfx: (n) => ctx.sfx(n),
            onEnd: (winner, info) => {
              if (winner === 0) ctx.win(rateByVigor(info.vigorLeft, info.maxVigor));
              else ctx.lose("这一层的对手挺有一套，换个节奏再来！");
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
  }

  showMenu();

  return {
    destroy() {
      destroyed = true;
      clearScreen();
      root.remove();
    }
  };
}
