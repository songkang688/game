import { meta } from "./meta";
export { meta };

// 钓鱼小达人:抛竿蓄力 + 水层深浅 + 张力拉扯的休闲钓鱼游戏。
//
// 三个入口共用同一套钓鱼运行时 `createRun`:
//  - 闯关:188 关八大水域,四种目标(钓够条数 / 攒够分数 / 钓够重量 / 钓够种类),走 level99 框架;
//  - 无尽:90 秒不限竿数,水层随便挑,比谁攒的分多,成绩存进平台的 endlessBest;
//  - 图鉴:25 种原创鱼,钓到过的会亮起来,没见过的只给一个剪影。
//
// 全程没有伤害:线断了、鱼跑了都只是这一竿白费,朵朵和星星会接着给你打气。
import { mountLevelGame, type GameApi, type PlayCtx, type SoundName } from "../level99";
import { save } from "../../engine/save";
import GUIDE from "./guide";
import {
  BAND_LUCK,
  CHAPTERS,
  bandText,
  buildLevel,
  emptyLog,
  goalMet,
  goalText,
  goalValue,
  levelRandom,
  loseLine,
  progressText,
  rateLevel,
  type CatchLog,
  type FishingLevel,
} from "./levels";
import {
  CHARGE_CYCLE_MS,
  DEX_KEY,
  ENDLESS_MS,
  FISH,
  GOOD_AT,
  LAYERS,
  MAX_DEPTH,
  SNAP_AT,
  TIGHT_AT,
  addToDex,
  biteDelayMs,
  castDepth,
  catchScore,
  chargePower,
  clamp,
  comboMultiplier,
  depthLabel,
  dexProgress,
  endlessRank,
  fightParams,
  formatClock,
  formatWeight,
  inBand,
  isActionKey,
  isPauseKey,
  isPerfectCatch,
  newFight,
  parseDex,
  pickFish,
  rarityStars,
  serializeDex,
  sinkMs,
  stepFight,
  tensionZone,
  zoneText,
  type Fish,
  type FightParams,
  type FightState,
} from "./logic";

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.fs-wrap{--fs-ink:#3f5670;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--fs-ink);
  display:flex;flex-direction:column;gap:7px;align-items:center;user-select:none;-webkit-user-select:none;
  touch-action:manipulation;position:relative;}
.fs-hud{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;align-items:center;width:100%;}
.fs-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:12.5px;font-weight:800;white-space:nowrap;
  box-shadow:0 2px 5px rgba(90,130,160,.18);}
.fs-chip b{font-weight:900;color:#1f6f9c;}
.fs-chip--goal{background:#e6f5ff;color:#1f6f9c;}
.fs-chip--warn{background:#ffe8ee;color:#b23a63;}
.fs-btn{border:none;border-radius:999px;padding:6px 13px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#5aa9d6,#3d87b8);box-shadow:0 3px 0 #2d6a94;}
.fs-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #2d6a94;}
.fs-btn:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-btn--ghost{background:linear-gradient(180deg,#a9c4d8,#87a7bf);box-shadow:0 3px 0 #6b8aa1;}
.fs-btn--ghost:active{box-shadow:0 1px 0 #6b8aa1;}
.fs-sea{border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(70,110,150,.22);line-height:0;}
.fs-sea canvas{display:block;}
.fs-bars{width:100%;max-width:620px;display:flex;flex-direction:column;gap:4px;}
.fs-barrow{display:flex;align-items:center;gap:7px;}
.fs-barlabel{font-size:11.5px;font-weight:900;white-space:nowrap;width:44px;text-align:right;color:#5b7a92;}
.fs-track{position:relative;flex:1;height:16px;border-radius:999px;background:#e8eff5;overflow:hidden;
  box-shadow:inset 0 1px 3px rgba(70,110,150,.25);}
.fs-zone{position:absolute;top:0;bottom:0;}
.fs-zone--good{background:#cdeecd;}
.fs-zone--tight{background:#ffe0a8;}
.fs-zone--snap{background:#ffc4cf;}
.fs-fill{position:absolute;top:0;bottom:0;left:0;border-radius:999px;background:linear-gradient(180deg,#7fd0f0,#3d9ed4);}
.fs-fill--tension{background:linear-gradient(180deg,#8fd68f,#4fae63);}
.fs-fill--tight{background:linear-gradient(180deg,#ffce70,#e8a02f);}
.fs-fill--danger{background:linear-gradient(180deg,#ff97ad,#e04f74);}
.fs-fill--slack{background:linear-gradient(180deg,#c9d6e0,#9db1c2);}
.fs-mark{position:absolute;top:-2px;bottom:-2px;width:2px;background:#3f5670a0;}
.fs-tip{font-size:12.5px;font-weight:700;line-height:1.5;text-align:center;max-width:620px;color:#4f6c86;
  background:#ffffffcc;border-radius:12px;padding:5px 10px;min-height:19px;}
.fs-act{border:none;border-radius:18px;padding:13px 30px;font-size:17px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#f0a35c,#dd8232);box-shadow:0 5px 0 #b4652248;
  min-width:190px;touch-action:none;}
.fs-act:active{transform:translateY(3px);box-shadow:0 2px 0 #b4652248;}
.fs-act:focus-visible{outline:3px solid #ffb43c;outline-offset:3px;}
.fs-act--reel{background:linear-gradient(180deg,#6fc48f,#3f9c68);box-shadow:0 5px 0 #2d7a4e48;}
.fs-act--wait{background:linear-gradient(180deg,#a9c4d8,#87a7bf);box-shadow:0 5px 0 #6b8aa148;}
.fs-veil{position:absolute;inset:0;background:rgba(248,253,255,.95);border-radius:16px;z-index:6;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:16px;}
.fs-veil-t{font-size:20px;font-weight:900;color:#2f7ba6;}
.fs-veil-s{font-size:13.5px;font-weight:700;color:#57748c;line-height:1.6;max-width:330px;}
.fs-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.fs-mode{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;border-radius:18px;padding:10px;
  background:linear-gradient(180deg,#eaf6fd,#fdf3ea);display:flex;flex-direction:column;gap:8px;}
.fs-mhead{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.fs-back{border:none;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#2f7ba6;box-shadow:0 3px 0 rgba(80,130,170,.28);}
.fs-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(80,130,170,.28);}
.fs-back:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-bar{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-bottom:7px;}
/* display:flex 会盖掉浏览器自带的 [hidden]{display:none},这里补回来 */
.fs-bar[hidden]{display:none;}
.fs-open{border:none;border-radius:999px;padding:8px 14px;font-size:13.5px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#5aa9d6,#3d87b8);box-shadow:0 4px 0 #2d6a94;}
.fs-open:active{transform:translateY(2px);box-shadow:0 2px 0 #2d6a94;}
.fs-open:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.fs-open--endless{background:linear-gradient(180deg,#f0a35c,#dd8232);box-shadow:0 4px 0 #b46522;}
.fs-open--dex{background:linear-gradient(180deg,#8f9fe0,#6f7fc8);box-shadow:0 4px 0 #57679f;}
.fs-dex{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:8px;max-height:60vh;
  overflow-y:auto;padding:2px;}
.fs-card{background:#fff;border-radius:14px;padding:8px 10px;box-shadow:0 3px 8px rgba(90,130,160,.16);
  display:flex;flex-direction:column;gap:2px;}
.fs-card--locked{background:#eef2f6;box-shadow:none;}
.fs-cname{font-size:14px;font-weight:900;color:#2f5f80;}
.fs-card--locked .fs-cname{color:#9fb0bf;}
.fs-cmeta{font-size:11.5px;font-weight:800;color:#6d8ba1;}
.fs-cnote{font-size:11.5px;font-weight:600;color:#7b93a6;line-height:1.45;}
.fs-crare{font-size:12px;letter-spacing:1px;color:#e8a02f;}
.fs-dexhead{font-size:13px;font-weight:800;color:#3f7ea6;text-align:center;}
.fs-layerhead{grid-column:1/-1;font-size:13px;font-weight:900;color:#2f7ba6;padding:4px 2px 0;}
.fs-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
@media (max-width:420px){
  .fs-chip{font-size:11.5px;padding:3px 8px;}
  .fs-act{padding:12px 22px;font-size:16px;min-width:160px;}
  .fs-dex{grid-template-columns:repeat(auto-fill,minmax(132px,1fr));}
}
/* 手机竖屏一共 667 像素高,水面上面还压着标题栏。每一行都收一点,
   保证张力条和那颗大按钮永远在首屏里,不用一边滚屏一边收线。 */
@media (max-height:720px){
  .fs-wrap{gap:5px;}
  .fs-chip{font-size:11px;padding:2px 7px;}
  .fs-tip{font-size:11.5px;line-height:1.35;padding:3px 9px;}
  .fs-act{padding:11px 20px;font-size:15.5px;}
  .fs-track{height:14px;}
}
@media (prefers-reduced-motion:reduce){
  .fs-btn:active,.fs-act:active,.fs-open:active{transform:none;}
}
`;

let cssInjected = false;
function ensureCss(host: HTMLElement): void {
  if (cssInjected && document.getElementById("fs-style")) return;
  const style = document.createElement("style");
  style.id = "fs-style";
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

function button(cls: string, label: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = cls;
  btn.textContent = label;
  return btn;
}

// ---------------------------------------------------------------------------
// 一场钓鱼(闯关的一关 / 无尽的一局共用)
// ---------------------------------------------------------------------------

type Phase = "aim" | "charge" | "sink" | "wait" | "fight" | "show";

export interface RunResult {
  won: boolean;
  reason: "goal" | "time" | "casts" | "quit";
  log: CatchLog;
  secondsLeft: number;
  castsLeft: number;
  /** 断线 + 跑鱼的次数 */
  lost: number;
  /** 最重的一条 */
  bestFish: Fish | null;
}

interface RunOpts {
  /** 有目标的闯关关卡;无尽模式不给 */
  level?: FishingLevel;
  band: { from: number; to: number };
  /** 限时秒数(0 表示不限时) */
  seconds: number;
  /** 抛竿上限(0 表示不限) */
  casts: number;
  hardness: number;
  hint: string;
  sfx: (name: SoundName) => void;
  /** 每钓上一条鱼回调一次(记图鉴、加星星) */
  onCatch?: (fish: Fish, score: number, isNew: boolean) => void;
  onDone: (res: RunResult) => void;
}

interface Runner {
  destroy: () => void;
}

/** 水面在画布里占的高度比例 */
const SKY = 0.13;

/** 装饰用的游鱼:同一关每次布局一样,纯装饰不参与判定 */
interface Swimmer {
  fish: Fish;
  depth: number;
  x: number;
  speed: number;
}

function makeSwimmers(rand: () => number, count: number): Swimmer[] {
  const out: Swimmer[] = [];
  for (let i = 0; i < count; i++) {
    const fish = FISH[Math.floor(rand() * FISH.length)];
    const layer = LAYERS[fish.layer];
    out.push({
      fish,
      depth: layer.from + rand() * (layer.to - layer.from),
      x: rand(),
      speed: (0.02 + rand() * 0.05) * (rand() < 0.5 ? -1 : 1),
    });
  }
  return out;
}

function createRun(host: HTMLElement, opts: RunOpts): Runner {
  ensureCss(host);

  // 闯关每次重玩换一个盐:关卡目标是固定的,但咬钩顺序不会背下来
  const rand = opts.level ? levelRandom(opts.level, Math.floor(Math.random() * 997)) : mulberryNow();
  const totalMs = opts.seconds > 0 ? opts.seconds * 1000 : 0;

  // ---- 状态 ---------------------------------------------------------------
  let phase: Phase = "aim";
  let phaseMs = 0;
  let chargeMs = 0;
  let power = 0;
  let depth = 0;
  let waitMs = 0;
  let sinkTotal = 0;
  let hooked: Fish | null = null;
  let params: FightParams | null = null;
  let fight: FightState = newFight();
  let holding = false;
  let paused = false;
  let finished = false;
  let remainMs = totalMs;
  let castsLeft = opts.casts > 0 ? opts.casts : Number.POSITIVE_INFINITY;
  let combo = 0;
  let lost = 0;
  let log: CatchLog = emptyLog();
  let bestFish: Fish | null = null;
  let showText = "";
  let ambient = 0;

  const swimmers = makeSwimmers(mulberry(opts.level ? opts.level.seed : 20260826), 9);

  // ---- DOM ----------------------------------------------------------------
  const wrap = el("div", "fs-wrap");
  const hud = el("div", "fs-hud");
  const chipGoal = el("span", "fs-chip fs-chip--goal");
  const chipTime = el("span", "fs-chip");
  const chipCombo = el("span", "fs-chip");
  const pauseBtn = button("fs-btn fs-btn--ghost", "⏸ 暂停");
  hud.append(chipGoal, chipTime, chipCombo, pauseBtn);

  const seaBox = el("div", "fs-sea");
  const canvas = document.createElement("canvas");
  seaBox.appendChild(canvas);

  const bars = el("div", "fs-bars");
  const tensionRow = el("div", "fs-barrow");
  const tensionTrack = el("div", "fs-track");
  const zoneGood = el("div", "fs-zone fs-zone--good");
  zoneGood.style.left = `${GOOD_AT * 100}%`;
  zoneGood.style.width = `${(TIGHT_AT - GOOD_AT) * 100}%`;
  const zoneTight = el("div", "fs-zone fs-zone--tight");
  zoneTight.style.left = `${TIGHT_AT * 100}%`;
  zoneTight.style.width = `${(SNAP_AT - TIGHT_AT) * 100}%`;
  const tensionFill = el("div", "fs-fill fs-fill--tension");
  tensionTrack.append(zoneGood, zoneTight, tensionFill);
  tensionRow.append(el("div", "fs-barlabel", "张力"), tensionTrack);

  const pullRow = el("div", "fs-barrow");
  const pullTrack = el("div", "fs-track");
  const pullFill = el("div", "fs-fill");
  pullTrack.appendChild(pullFill);
  pullRow.append(el("div", "fs-barlabel", "收线"), pullTrack);
  bars.append(tensionRow, pullRow);

  const tip = el("div", "fs-tip", opts.hint);
  const actBtn = button("fs-act", "🎣 按住抛竿");
  const live = el("div", "fs-sr");
  live.setAttribute("role", "status");
  live.setAttribute("aria-live", "polite");

  wrap.append(hud, seaBox, bars, tip, actBtn, live);
  host.appendChild(wrap);

  const g = canvas.getContext("2d");

  // ---- 输入 ---------------------------------------------------------------
  function press(): void {
    if (paused || finished) return;
    holding = true;
  }
  function release(): void {
    holding = false;
  }

  const onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    press();
  };
  actBtn.addEventListener("pointerdown", onPointerDown);
  const onCanvasDown = (e: PointerEvent): void => {
    e.preventDefault();
    press();
  };
  canvas.addEventListener("pointerdown", onCanvasDown);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isPauseKey(e.code)) {
      e.preventDefault();
      togglePause();
      return;
    }
    if (!isActionKey(e.code) || e.repeat) return;
    e.preventDefault();
    press();
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (!isActionKey(e.code)) return;
    e.preventDefault();
    release();
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  window.addEventListener("blur", release);

  pauseBtn.addEventListener("click", () => {
    opts.sfx("tap");
    togglePause();
  });

  // ---- 画布尺寸 ------------------------------------------------------------
  let W = 320;
  let H = 260;

  function layout(): void {
    const avail = clamp(host.clientWidth || 340, 240, 620);
    const viewH = (globalThis as { innerHeight?: number }).innerHeight ?? 700;
    // 手机竖屏一共 667 像素,水面上面还压着平台标题栏和 level99 的选关条。
    // 水面必须让位,否则那颗「按住抛竿」的大按钮会被挤到首屏外面去。
    const share = viewH <= 560 ? 0.33 : viewH <= 720 ? 0.36 : 0.42;
    W = Math.round(avail);
    H = Math.round(clamp(viewH * share, 180, 380));
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    g?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  layout();
  const onResize = (): void => {
    layout();
    render();
  };
  window.addEventListener("resize", onResize);

  function surfaceY(): number {
    return H * SKY;
  }

  function yOfDepth(d: number): number {
    const top = surfaceY();
    return top + (clamp(d, 0, MAX_DEPTH) / MAX_DEPTH) * (H - top - 4);
  }

  // ---- 绘制 ---------------------------------------------------------------

  function drawWater(): void {
    if (!g) return;
    const sky = g.createLinearGradient(0, 0, 0, surfaceY());
    sky.addColorStop(0, "#fdf3e6");
    sky.addColorStop(1, "#ffe9d2");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, surfaceY());

    for (let i = 0; i < LAYERS.length; i++) {
      const y0 = yOfDepth(LAYERS[i].from);
      const y1 = yOfDepth(i === LAYERS.length - 1 ? MAX_DEPTH : LAYERS[i].to);
      g.fillStyle = LAYERS[i].color;
      g.fillRect(0, y0, W, y1 - y0 + 1);
    }

    // 水面的小波纹
    g.strokeStyle = "#ffffffb0";
    g.lineWidth = 2;
    g.beginPath();
    const sy = surfaceY();
    for (let x = 0; x <= W; x += 8) {
      const y = sy + Math.sin((x / 26) + ambient / 420) * 2.2;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }

  function drawBand(): void {
    if (!g) return;
    const y0 = yOfDepth(opts.band.from);
    const y1 = yOfDepth(opts.band.to);
    g.fillStyle = "#ffffff38";
    g.fillRect(0, y0, W, y1 - y0);
    g.strokeStyle = "#ffffffcc";
    g.lineWidth = 1.5;
    g.setLineDash([6, 5]);
    g.beginPath();
    g.moveTo(0, y0);
    g.lineTo(W, y0);
    g.moveTo(0, y1);
    g.lineTo(W, y1);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = "#2f6f9e";
    g.font = "600 11px system-ui,sans-serif";
    g.textAlign = "left";
    g.fillText(`鱼群带 ${opts.band.from}–${opts.band.to} 米`, 6, y0 + 13);
  }

  function drawRuler(): void {
    if (!g) return;
    g.textAlign = "right";
    g.font = "600 10px system-ui,sans-serif";
    for (let d = 10; d <= MAX_DEPTH; d += 10) {
      const y = yOfDepth(d);
      g.strokeStyle = "#ffffff70";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(W - 34, y);
      g.lineTo(W - 4, y);
      g.stroke();
      g.fillStyle = "#ffffffdd";
      g.fillText(`${d}m`, W - 5, y - 3);
    }
    g.textAlign = "left";
  }

  function drawSwimmers(): void {
    if (!g) return;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const s of swimmers) {
      const x = ((s.x + (ambient / 1000) * s.speed) % 1 + 1) % 1;
      const px = 12 + x * (W - 46);
      const py = yOfDepth(s.depth) + Math.sin(ambient / 600 + s.x * 9) * 3;
      g.globalAlpha = 0.55;
      g.font = `${Math.round(clamp(W / 22, 13, 22))}px system-ui,sans-serif`;
      g.fillText(s.fish.emoji, px, py);
      g.globalAlpha = 1;
    }
    g.textBaseline = "alphabetic";
  }

  function rodTip(): { x: number; y: number } {
    return { x: W * 0.32, y: surfaceY() - 6 };
  }

  function drawBoat(): void {
    if (!g) return;
    const sy = surfaceY();
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.font = "22px system-ui,sans-serif";
    g.fillText("🛶", W * 0.22, sy - 2);
    g.font = "18px system-ui,sans-serif";
    g.fillText("🧒", W * 0.16, sy - 6);
    // 鱼竿
    const tipPos = rodTip();
    g.strokeStyle = "#8a5a33";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(W * 0.14, sy - 10);
    g.lineTo(tipPos.x, tipPos.y);
    g.stroke();
  }

  function hookDepth(): number {
    if (phase === "sink") return depth * clamp(sinkTotal > 0 ? phaseMs / sinkTotal : 1, 0, 1);
    if (phase === "wait" || phase === "fight") {
      // 拉扯时钩子随着进度往上走,看得见「快到岸了」
      const lift = phase === "fight" ? fight.progress * 0.75 : 0;
      return depth * (1 - lift);
    }
    if (phase === "charge") return 0;
    return 0;
  }

  function drawLine(): void {
    if (!g) return;
    const tipPos = rodTip();
    if (phase === "aim" || phase === "show") {
      g.strokeStyle = "#ffffffcc";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(tipPos.x, tipPos.y);
      g.lineTo(tipPos.x + 4, surfaceY() + 4);
      g.stroke();
      return;
    }
    const hy = yOfDepth(hookDepth());
    const hx = W * 0.52;
    const zone = phase === "fight" ? tensionZone(fight.tension) : "good";
    g.strokeStyle = zone === "tight" ? "#e8a02f" : zone === "snap" ? "#e04f74" : "#ffffffd8";
    g.lineWidth = zone === "tight" ? 2.4 : 1.6;
    g.beginPath();
    g.moveTo(tipPos.x, tipPos.y);
    // 拉扯时线绷成一条直线,平时垂一点弧度
    const bend = phase === "fight" ? (1 - fight.tension) * 16 : 12;
    g.quadraticCurveTo((tipPos.x + hx) / 2 - bend, (tipPos.y + hy) / 2, hx, hy);
    g.stroke();

    g.textAlign = "center";
    g.textBaseline = "middle";
    if (phase === "fight" && hooked) {
      g.font = `${Math.round(clamp(W / 13, 22, 40))}px system-ui,sans-serif`;
      const shake = Math.sin(ambient / 55) * (2 + fight.tension * 4);
      g.fillText(hooked.emoji, hx + shake, hy);
    } else {
      g.font = "15px system-ui,sans-serif";
      g.fillText("🪝", hx, hy);
    }
    g.textBaseline = "alphabetic";
  }

  function drawAim(): void {
    if (!g || phase !== "charge") return;
    const y = yOfDepth(castDepth(power));
    g.strokeStyle = "#e04f74";
    g.lineWidth = 2;
    g.setLineDash([8, 6]);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = "#b23a63";
    g.font = "700 12px system-ui,sans-serif";
    g.textAlign = "left";
    g.fillText(`松手 → ${castDepth(power).toFixed(1)} 米`, 8, y - 5);
  }

  function render(): void {
    if (!g) return;
    g.clearRect(0, 0, W, H);
    drawWater();
    drawBand();
    drawSwimmers();
    drawRuler();
    drawBoat();
    drawLine();
    drawAim();
  }

  // ---- HUD -----------------------------------------------------------------

  function refreshHud(): void {
    if (opts.level) {
      chipGoal.textContent = `🎯 ${progressText(opts.level, log)}`;
    } else {
      chipGoal.textContent = `🎯 ${log.score} 分`;
    }
    // 竖屏一行只放得下三四个 chip:竿数并进时间那一格,连击没起来时干脆不占位置
    const casts = Number.isFinite(castsLeft) ? ` · 🎣 ${castsLeft} 竿` : "";
    chipTime.textContent = totalMs > 0 ? `⏱ ${formatClock(remainMs)}${casts}` : `🎣 ${log.count} 条`;
    chipTime.className = totalMs > 0 && remainMs <= 10_000 ? "fs-chip fs-chip--warn" : "fs-chip";
    chipCombo.hidden = combo <= 0;
    chipCombo.textContent = `🔥 连击 ×${comboMultiplier(combo).toFixed(1)}`;

    const zone = phase === "fight" ? tensionZone(fight.tension) : "good";
    tensionFill.style.width = `${clamp(fight.tension, 0, 1) * 100}%`;
    tensionFill.className = `fs-fill fs-fill--${
      phase !== "fight" ? "slack" : zone === "tight" ? "tight" : zone === "snap" ? "danger" : zone === "slack" ? "slack" : "tension"
    }`;
    pullFill.style.width = `${(phase === "charge" ? power : phase === "fight" ? fight.progress : 0) * 100}%`;

    if (phase === "aim") {
      actBtn.textContent = "🎣 按住抛竿";
      actBtn.className = "fs-act";
    } else if (phase === "charge") {
      actBtn.textContent = "✋ 松手抛出";
      actBtn.className = "fs-act";
    } else if (phase === "fight") {
      actBtn.textContent = holding ? "🪝 收线中…" : "🪝 按住收线";
      actBtn.className = "fs-act fs-act--reel";
    } else {
      actBtn.textContent = phase === "show" ? "…" : "🌊 等咬钩…";
      actBtn.className = "fs-act fs-act--wait";
    }

    if (phase === "charge") tip.textContent = `力度 ${(power * 100).toFixed(0)}% · ${depthLabel(castDepth(power))}`;
    else if (phase === "sink") tip.textContent = `钩子正在下沉…${depthLabel(depth)}`;
    else if (phase === "wait") tip.textContent = `${depthLabel(depth)} · 静静地等一会儿`;
    else if (phase === "fight" && hooked) tip.textContent = `${hooked.emoji} ${hooked.name} 上钩了!${zoneText(tensionZone(fight.tension))}`;
    else if (phase === "show") tip.textContent = showText;
    else tip.textContent = opts.hint;
  }

  function say(text: string): void {
    live.textContent = text;
  }

  // ---- 流程 -----------------------------------------------------------------

  function startCast(): void {
    depth = castDepth(power);
    castsLeft -= 1;
    sinkTotal = sinkMs(depth);
    phase = "sink";
    phaseMs = 0;
    opts.sfx("pop");
    say(`抛到 ${depthLabel(depth)}`);
  }

  function startBite(): void {
    const luck = inBand(depth, opts.band) ? BAND_LUCK : -0.55;
    hooked = pickFish(depth, rand, luck);
    params = fightParams(hooked, opts.hardness);
    fight = newFight();
    phase = "fight";
    phaseMs = 0;
    opts.sfx("jump");
    say(`${hooked.name} 咬钩了,按住收线`);
  }

  function afterShow(): void {
    if (finished) return;
    if (opts.level && goalMet(opts.level, log)) {
      finish(true, "goal");
      return;
    }
    if (castsLeft <= 0) {
      finish(false, "casts");
      return;
    }
    phase = "aim";
    phaseMs = 0;
    chargeMs = 0;
    power = 0;
  }

  function landFish(): void {
    const fish = hooked;
    if (!fish) return;
    const perfect = isPerfectCatch(fight);
    const gained = catchScore(fish, { combo, perfect, inBand: inBand(depth, opts.band) });
    log = {
      count: log.count + 1,
      score: log.score + gained,
      weight: log.weight + fish.weight,
      species: log.species.includes(fish.id) ? log.species : [...log.species, fish.id],
    };
    combo += 1;
    if (!bestFish || fish.weight > bestFish.weight) bestFish = fish;
    const isNew = rememberFish(fish.id);
    opts.sfx("coin");
    showText = `${fish.emoji} ${fish.name} · ${formatWeight(fish.weight)} · +${gained} 分${perfect ? " · 完美收竿!" : ""}${
      isNew ? " · 图鉴新收录!" : ""
    }`;
    say(showText);
    opts.onCatch?.(fish, gained, isNew);
    phase = "show";
    phaseMs = 0;
  }

  function loseFish(reason: "snapped" | "escaped"): void {
    lost += 1;
    combo = 0;
    opts.sfx("oops");
    showText =
      reason === "snapped"
        ? "线断啦!张力冲到红区就要立刻松手。"
        : "鱼跑啦!线松太久它就甩钩了,松一下就要马上再收。";
    say(showText);
    phase = "show";
    phaseMs = 0;
  }

  function finish(won: boolean, reason: RunResult["reason"]): void {
    if (finished) return;
    finished = true;
    holding = false;
    opts.onDone({
      won,
      reason,
      log,
      secondsLeft: Math.max(0, Math.round(remainMs / 1000)),
      castsLeft: Number.isFinite(castsLeft) ? castsLeft : 0,
      lost,
      bestFish,
    });
  }

  // ---- 主循环 ---------------------------------------------------------------

  let raf = 0;
  let last = 0;

  function tick(dt: number): void {
    ambient += dt;
    if (totalMs > 0) remainMs = Math.max(0, remainMs - dt);

    switch (phase) {
      case "aim":
        if (holding) {
          phase = "charge";
          chargeMs = 0;
          power = 0;
        }
        break;
      case "charge":
        chargeMs += dt;
        power = chargePower(chargeMs, CHARGE_CYCLE_MS);
        if (!holding) startCast();
        break;
      case "sink":
        phaseMs += dt;
        if (phaseMs >= sinkTotal) {
          phase = "wait";
          phaseMs = 0;
          waitMs = biteDelayMs(rand, depth);
        }
        break;
      case "wait":
        phaseMs += dt;
        if (phaseMs >= waitMs) startBite();
        break;
      case "fight": {
        if (!params) break;
        const before = fight.tension;
        fight = stepFight(fight, params, holding, dt);
        if (before < TIGHT_AT && fight.tension >= TIGHT_AT) opts.sfx("tap");
        if (fight.status === "landed") landFish();
        else if (fight.status === "snapped") loseFish("snapped");
        else if (fight.status === "escaped") loseFish("escaped");
        break;
      }
      case "show":
        phaseMs += dt;
        if (phaseMs >= 1300) afterShow();
        break;
      default:
        break;
    }

    // 拉扯途中时间到:先把这一条拉完再结算,不半路把手上的鱼掐掉
    if (totalMs > 0 && remainMs <= 0 && phase !== "fight" && !finished) {
      finish(opts.level ? goalMet(opts.level, log) : true, "time");
    }
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const dt = last === 0 ? 16 : clamp(now - last, 0, 120);
    last = now;
    if (!paused && !finished) tick(dt);
    render();
    refreshHud();
    if (finished) cancelAnimationFrame(raf);
  }
  raf = requestAnimationFrame(frame);

  // ---- 暂停 -----------------------------------------------------------------

  let veil: HTMLElement | null = null;

  function togglePause(): void {
    if (finished) return;
    paused = !paused;
    holding = false;
    if (paused) {
      veil = el("div", "fs-veil");
      veil.append(
        el("div", "fs-veil-t", "⏸ 暂停一下"),
        el("div", "fs-veil-s", "喝口水、揉揉手指,回来接着钓。按 Esc 也能继续。")
      );
      const row = el("div", "fs-veil-btns");
      const go = button("fs-btn", "▶ 继续");
      go.addEventListener("click", () => {
        opts.sfx("tap");
        togglePause();
      });
      row.appendChild(go);
      veil.appendChild(row);
      wrap.appendChild(veil);
      go.focus?.();
      pauseBtn.textContent = "▶ 继续";
      say("已暂停");
    } else {
      veil?.remove();
      veil = null;
      pauseBtn.textContent = "⏸ 暂停";
      last = 0;
      say("继续钓鱼");
    }
  }

  // ---- 图鉴收录 --------------------------------------------------------------

  function rememberFish(id: string): boolean {
    const before = readDex();
    if (before.includes(id)) return false;
    writeDex(addToDex(before, id));
    return true;
  }

  refreshHud();
  render();

  return {
    destroy() {
      finished = true;
      cancelAnimationFrame(raf);
      veil?.remove();
      veil = null;
      actBtn.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerdown", onCanvasDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      window.removeEventListener("resize", onResize);
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 图鉴存档
// ---------------------------------------------------------------------------

function readDex(): string[] {
  try {
    return parseDex(localStorage.getItem(DEX_KEY));
  } catch {
    return [];
  }
}

function writeDex(ids: string[]): void {
  try {
    localStorage.setItem(DEX_KEY, serializeDex(ids));
  } catch {
    // 隐私模式写不进去也不影响这一次游玩
  }
}

// ---------------------------------------------------------------------------
// 随机源
// ---------------------------------------------------------------------------

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 无尽模式每局换一串随机数,免得每次都钓到同样的顺序 */
function mulberryNow(): () => number {
  return mulberry((Date.now() & 0x7fffffff) ^ 0x5bf03635);
}

// ---------------------------------------------------------------------------
// 闯关的一关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): { destroy: () => void } {
  const level = buildLevel(ctx.level);
  const box = el("div");
  stage.append(box);

  let run: Runner | null = null;

  run = createRun(box, {
    level,
    band: level.band,
    seconds: level.seconds,
    casts: level.casts,
    hardness: level.hardness,
    // 目标与鱼群带都挤在这一行:竖屏上每省一行,大按钮就多一分留在首屏里
    hint: `${goalText(level)} · ${bandText(level)}`,
    sfx: ctx.sfx,
    onCatch: (_fish, _score, isNew) => {
      if (isNew) ctx.bonusStars(1);
    },
    onDone: (res) => {
      if (res.won) {
        ctx.win(
          rateLevel(level, { secondsLeft: res.secondsLeft, lost: res.lost, castsLeft: res.castsLeft }),
          `${goalText(level)} 完成!一共钓上 ${res.log.count} 条,${
            res.bestFish ? `最大的是 ${res.bestFish.name}(${formatWeight(res.bestFish.weight)})。` : "手感很稳。"
          }`
        );
      } else {
        ctx.lose(`${loseLine(res.reason === "time" ? "time" : "casts")}(这一关已经完成 ${goalValue(level, res.log)}/${level.need})`);
      }
    },
  });

  return {
    destroy() {
      run?.destroy();
      run = null;
      box.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 模式外壳(无尽 / 图鉴共用)
// ---------------------------------------------------------------------------

interface Shell {
  stage: HTMLElement;
  chip: HTMLElement;
  destroy: () => void;
}

function makeShell(host: HTMLElement, api: GameApi, onBack: () => void, title: string): Shell {
  ensureCss(host);
  const wrap = el("div", "fs-mode");
  const head = el("div", "fs-mhead");
  const back = button("fs-back", "◀ 回选关");
  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });
  const chip = el("span", "fs-chip", title);
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
  buttons: { label: string; ghost?: boolean; onClick: () => void }[]
): void {
  stage.innerHTML = "";
  const box = el("div", "fs-veil");
  box.style.position = "static";
  box.append(el("div", "fs-veil-t", title), el("div", "fs-veil-s", sub));
  const row = el("div", "fs-veil-btns");
  for (const b of buttons) {
    const btn = button(`fs-btn${b.ghost ? " fs-btn--ghost" : ""}`, b.label);
    btn.addEventListener("click", b.onClick);
    row.appendChild(btn);
  }
  box.appendChild(row);
  stage.appendChild(box);
}

// ---------------------------------------------------------------------------
// 无尽模式:90 秒,水层随便挑,比谁攒的分多
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const shell = makeShell(host, api, onBack, "♾️ 无尽鱼汛 · 90 秒");
  let run: Runner | null = null;

  function refreshChip(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    shell.chip.textContent = best > 0 ? `♾️ 无尽鱼汛 · 90 秒 · 最好 ${best} 分` : "♾️ 无尽鱼汛 · 90 秒";
  }

  function start(): void {
    run?.destroy();
    shell.stage.innerHTML = "";
    refreshChip();
    run = createRun(shell.stage, {
      band: { from: 0, to: MAX_DEPTH },
      seconds: Math.round(ENDLESS_MS / 1000),
      casts: 0,
      hardness: 0.5,
      hint: "整片水域都归你,深处的鱼分高但更难拉。连着不失手有连击加成。",
      sfx: (n) => api.play(n),
      onCatch: (_fish, _score, isNew) => {
        if (isNew) api.addStars(1);
      },
      onDone: (res) => {
        run?.destroy();
        run = null;
        const best = save.recordEndlessBest(meta.id, res.log.score);
        api.play(res.log.score > 0 ? "win" : "oops");
        if (res.log.score >= 120) api.addStars(1);
        overBox(
          shell.stage,
          `🏁 ${endlessRank(res.log.score)} · ${res.log.score} 分`,
          `90 秒里钓上 ${res.log.count} 条,共 ${formatWeight(res.log.weight)},${
            res.bestFish ? `最大的一条是 ${res.bestFish.emoji} ${res.bestFish.name}。` : "下一竿一定有收获。"
          }历史最好成绩 ${best} 分。`,
          [
            {
              label: "🔁 再来一局",
              onClick: () => {
                api.play("tap");
                start();
              },
            },
            {
              label: "◀ 回选关",
              ghost: true,
              onClick: () => {
                api.play("tap");
                onBack();
              },
            },
          ]
        );
      },
    });
  }

  start();

  return {
    destroy() {
      run?.destroy();
      run = null;
      shell.destroy();
    },
  };
}

// ---------------------------------------------------------------------------
// 图鉴页
// ---------------------------------------------------------------------------

function mountDex(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const found = readDex();
  const prog = dexProgress(found);
  const shell = makeShell(host, api, onBack, `📖 鱼类图鉴 · ${prog.found}/${prog.total}`);

  const head = el("div", "fs-dexhead", `已经认识 ${prog.found} 种鱼,收录度 ${prog.percent}%。没见过的先钓上来才会亮。`);
  const grid = el("div", "fs-dex");
  for (let layer = 0; layer < LAYERS.length; layer++) {
    const title = el("div", "fs-layerhead", `${LAYERS[layer].emoji} ${LAYERS[layer].name}(${LAYERS[layer].from}–${LAYERS[layer].to} 米)`);
    grid.appendChild(title);
    for (const fish of FISH.filter((f) => f.layer === layer)) {
      const known = found.includes(fish.id);
      const card = el("div", `fs-card${known ? "" : " fs-card--locked"}`);
      card.append(
        el("div", "fs-cname", known ? `${fish.emoji} ${fish.name}` : "❔ 还没见过"),
        el("div", "fs-crare", rarityStars(fish.rarity)),
        el("div", "fs-cmeta", known ? `${formatWeight(fish.weight)} · ${fish.score} 分` : `${LAYERS[fish.layer].name}`),
        el("div", "fs-cnote", known ? fish.note : "在这一层多抛几竿,说不定就碰上它了。")
      );
      grid.appendChild(card);
    }
  }
  shell.stage.append(head, grid);

  return { destroy: () => shell.destroy() };
}

// ---------------------------------------------------------------------------
// 挂载:模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  ensureCss(api.root);
  const root = el("div");
  const bar = el("div", "fs-bar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = button("fs-open fs-open--endless", "♾️ 无尽鱼汛");
  const dexBtn = button("fs-open fs-open--dex", "📖 鱼类图鉴");
  bar.append(endlessBtn, dexBtn);

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽鱼汛 · 最好 ${best} 分` : "♾️ 无尽鱼汛";
    const prog = dexProgress(readDex());
    dexBtn.textContent = `📖 鱼类图鉴 · ${prog.found}/${prog.total}`;
  }

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    modeHost.innerHTML = "";
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  function openMode(make: (host: HTMLElement, api: GameApi, back: () => void) => { destroy: () => void }): void {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = make(modeHost, api, closeMode);
  }

  endlessBtn.addEventListener("click", () => openMode(mountEndless));
  dexBtn.addEventListener("click", () => openMode(mountDex));
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 开钓的时候把模式条收起来:手机竖屏上这一行正好够张力条和大按钮同框
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy: () => {
            if (!mode) bar.hidden = false;
            handle.destroy();
          },
        };
      },
      guide: GUIDE,
      mapHint: "抛竿看水层,收线看张力:一收一放才是最快的。",
      grandMessage: "188 关全部通关,这片水域最会看张力的人就是你!",
      guideTitle: "钓鱼小达人 · 手感手册",
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
