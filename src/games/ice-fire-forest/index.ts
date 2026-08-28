import { meta } from "./meta";
export { meta };

import {
  TOTAL_LEVELS,
  chapterOf,
  chapterStart,
  loadStars,
  markSkipped,
  mountLevelGame,
  saveStar,
  type Chapter,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
} from "../level99";
import { getLevelExtras } from "../../ui/level188Contract";
import { CHAPTERS, GUIDE, analyzeLevel, type LevelAnalysis } from "./levels";
import {
  ACTION_DIR,
  DIR_DOWN,
  DIR_LEFT,
  DIR_RIGHT,
  DIR_UP,
  HERO_SHORT,
  KEY_MAP,
  MAX_HEARTS,
  POWER_CHARGES,
  POWER_CHARGES_MAX,
  TILE,
  boardHeightBudget,
  clampBoardBudget,
  computeLight,
  computePower,
  formatClock,
  gemOwner,
  initialState,
  isAdjacent,
  isWin,
  loseLine,
  parseLevel,
  rateRun,
  traceBeam,
  useElementPower,
  waitingLine,
  winLine,
  type GameState,
  type Gem,
  type Hero,
  type ParsedLevel,
} from "./logic";
import {
  FEEL,
  bufferAlive,
  bufferPress,
  bufferTake,
  coyoteOpen,
  emptyBuffer,
  hopDurationMs,
  hopOffsetPx,
  hopProgress,
  makeGlide,
  nextBumpAt,
  nextStepAt,
  prefersReducedMotion,
  stepGlide,
  stepReady,
  type Buffered,
  type Glide,
} from "./feel";
import {
  COOP_HINTS,
  boostTarget,
  buildCoopKit,
  cloneCoop,
  crateAt,
  elevatorCellsIn,
  elevatorReady,
  elevatorRide,
  initialCoop,
  linkHints,
  memoryDoorOpen,
  moveWithCoop,
  portalReady,
  portalSwap,
  ropePull,
  type CoopKit,
  type CoopState,
} from "./coop";
import {
  checkpointLabel,
  cloudLine,
  cloudPath,
  pickCheckpoints,
  respawnCell,
  updateReached,
  type Checkpoints,
} from "./checkpoint";
import { CAMERA, arrowLabel, computeCamera, followTowards } from "./camera";
import {
  TOUCH_HIT_PX,
  initialSolo,
  isControlled,
  isSwitchCode,
  padLabel,
  routeHero,
  soloAnnounce,
  switchButtonAria,
  switchButtonLabel,
  switchHero,
  toggleSolo,
  type SoloState,
} from "./solo";
import { shade, withAlpha } from "../../art/kit/palette";
import {
  IFF_COLORS,
  IFF_PARALLAX_DEPTHS,
  IFF_PARALLAX_TOPS,
  IFF_TINT_COLD,
  IFF_TINT_WARM,
  IffDustFx,
  drawCloudBuddy,
  drawControlRing,
  drawDoorBadge,
  drawForestFar,
  drawForestMid,
  drawForestNear,
  drawHeroFigure,
  drawLiftIcon,
  drawMiniHero,
  drawPadlock,
  flagWave,
  gemSparks,
  lavaBubbles,
  lavaSheenPhase,
} from "./visual13";

// ---------------------------------------------------------------------------
// 画面常数(手感常量全部搬去 feel.ts 了,这里只剩「画多大」)
// ---------------------------------------------------------------------------

/** 格子最大边长(大屏上别把小小的一张图拉得糊掉) */
const MAX_CELL = 44;
/**
 * 格子最小边长。
 * 1.1 是「不管多大的图都压进一屏」,结果 17×11 的图在 360px 上格子只剩 14px,
 * 机关上那个组号根本看不清。1.2 改成:小于这个数就不再压,交给摄像机跟随。
 */
const MIN_CELL = 22;
/** 击掌的冷却 */
const HIGH_FIVE_MS = 2600;
/** 暂停键 */
const PAUSE_CODE = "Escape";
/** 暂停时棋盘下面那一行 */
const PAUSE_LINE = "⏸ 先歇一会儿,再按一次 Esc 接着玩。";

// ---------------------------------------------------------------------------
// 配色
// ---------------------------------------------------------------------------

interface Palette {
  bg0: string;
  bg1: string;
  wall: string;
  wallTop: string;
  floor: string;
  floorLine: string;
}

const PALETTES: Palette[] = [
  { bg0: "#EAF7E6", bg1: "#F4FBF0", wall: "#8FBF87", wallTop: "#A8D3A0", floor: "#FBFDF6", floorLine: "#E4F0DC" },
  { bg0: "#FDEDE4", bg1: "#FFF6F0", wall: "#C89A82", wallTop: "#DDB49B", floor: "#FFF9F4", floorLine: "#F3E1D5" },
  { bg0: "#EEEAF9", bg1: "#F7F4FD", wall: "#9E93C4", wallTop: "#B7AEDA", floor: "#FBFAFF", floorLine: "#E6E1F3" },
  { bg0: "#E4F1FA", bg1: "#F2F9FE", wall: "#84AEC8", wallTop: "#9CC5DC", floor: "#F8FCFF", floorLine: "#DCEBF5" },
  { bg0: "#E6F3E9", bg1: "#F2FAF3", wall: "#7FB58C", wallTop: "#9BCBA6", floor: "#F9FDFA", floorLine: "#DDEEE1" },
  { bg0: "#F3E9FA", bg1: "#FAF4FE", wall: "#AE8FC7", wallTop: "#C4A9D9", floor: "#FDFAFF", floorLine: "#EBDFF4" },
  { bg0: "#E9EDFA", bg1: "#F5F7FE", wall: "#8F9BCB", wallTop: "#A8B2DC", floor: "#FAFBFF", floorLine: "#E2E6F4" },
  { bg0: "#FAE9F1", bg1: "#FEF4F8", wall: "#C68DAC", wallTop: "#DBA7C3", floor: "#FFFAFC", floorLine: "#F4DEE9" },
];

const ICE_DARK = "#4FA8D8";
const FIRE_DARK = "#E8763C";
const WATER_FILL = "#B9E4F7";
const WATER_DEEP = "#7FC9EC";
const SLIME_FILL = "#B9E08A";
const SLIME_DEEP = "#87BF52";
const BEAM_COLOR = "#FFD34D";
const CRATE_FILL = "#E2C79A";
const CRATE_EDGE = "#A97F4C";
const PORTAL_COLOR = "#9C8AD6";
const LIFT_COLOR = "#7FA8C9";

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.iff-wrap{--iff-ink:#4A4266;--iff-hit:${TOUCH_HIT_PX}px;position:relative;display:flex;flex-direction:column;
  gap:8px;align-items:center;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  color:var(--iff-ink);user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.iff-hud{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:center;width:100%;}
.iff-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:14px;font-weight:800;
  box-shadow:0 2px 5px rgba(120,110,170,.18);white-space:nowrap;}
.iff-chip b{font-weight:900;}
.iff-duo{display:inline-flex;gap:4px;align-items:center;padding:4px 9px;}
.iff-duo-face{width:24px;height:24px;display:block;}
.iff-btn{border:none;border-radius:999px;padding:6px 13px;font-size:14px;font-weight:900;cursor:pointer;
  min-height:44px;display:inline-flex;align-items:center;justify-content:center;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7E6BC4,#6857AE);box-shadow:0 3px 0 #52458C;}
.iff-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #52458C;}
.iff-btn:focus-visible{outline:3px solid #FFB43C;outline-offset:2px;}
.iff-btn--ghost{background:linear-gradient(180deg,#9DB6D8,#7F9AC3);box-shadow:0 3px 0 #64809F;}
.iff-btn--ghost:active{box-shadow:0 1px 0 #64809F;}
.iff-swapbar{display:flex;justify-content:center;width:100%;}
.iff-swap{min-height:var(--iff-hit);min-width:132px;border:none;border-radius:999px;padding:0 18px;
  font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;color:#fff;
  background:linear-gradient(180deg,#C3B4E8,#8F7CC8);box-shadow:0 3px 0 #6C5AA4;}
.iff-swap:active{transform:translateY(2px);box-shadow:0 1px 0 #6C5AA4;}
.iff-swap:focus-visible{outline:3px solid #FFB43C;outline-offset:2px;}
.iff-board{position:relative;border-radius:18px;overflow:hidden;box-shadow:0 6px 18px rgba(110,100,160,.22);line-height:0;}
.iff-board canvas{display:block;}
.iff-tip{font-size:12.5px;font-weight:700;line-height:1.5;text-align:center;max-width:640px;
  color:#6A5F8C;background:#ffffffcc;border-radius:12px;padding:6px 10px;}
.iff-pads{display:flex;justify-content:space-between;gap:10px;width:100%;max-width:640px;}
.iff-pad{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:4px;}
.iff-pad button{border:none;border-radius:12px;width:var(--iff-hit);height:var(--iff-hit);
  min-width:var(--iff-hit);min-height:var(--iff-hit);font-size:18px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#fff;}
.iff-pad button:focus-visible{outline:3px solid #FFB43C;outline-offset:2px;}
.iff-pad--ice button{background:linear-gradient(180deg,#8FD3F4,#5FB4DF);box-shadow:0 3px 0 #4A93BC;}
.iff-pad--fire button{background:linear-gradient(180deg,#FFB077,#F08B4C);box-shadow:0 3px 0 #C96B31;}
.iff-pad button:active{transform:translateY(2px);}
.iff-pad .iff-pad-slot{visibility:hidden;}
.iff-pad .iff-pad-act{background:linear-gradient(180deg,#C3B4E8,#A08FD2)!important;
  box-shadow:0 3px 0 #7D6BB4!important;font-size:16px;}
.iff-padwrap{display:flex;flex-direction:column;align-items:center;gap:4px;}
.iff-padname{font-size:12px;font-weight:900;}
.iff-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
.iff-shell{display:flex;flex-direction:column;gap:8px;align-items:center;width:100%;}
.iff-shellhead{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center;width:100%;}
.iff-shelltitle{font-size:14px;font-weight:900;color:#5B5182;}
.iff-over{display:flex;flex-direction:column;gap:10px;align-items:center;padding:18px 12px;
  font-weight:900;color:#5B5182;text-align:center;}
@media (max-width:420px){
  .iff-chip{font-size:12px;padding:3px 8px;}
  .iff-duo-face{width:20px;height:20px;}
  .iff-btn{font-size:11.5px;padding:5px 10px;}
  .iff-wrap{gap:5px;}
  .iff-tip{font-size:11.5px;padding:4px 8px;}
  .iff-pad{gap:3px;}
}
/* C-8：矮横屏双垫挪到棋盘右侧并排,竖叠会把第二套垫顶出 412 高 */
@media (max-height:500px) and (min-width:640px){
  .iff-wrap{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;column-gap:8px;justify-items:stretch;}
  .iff-hud,.iff-swapbar{grid-column:1/-1;}
  .iff-board{grid-column:1;min-width:0;}
  .iff-tip{grid-column:1;}
  .iff-pads{grid-column:2;grid-row:3;flex-direction:row;align-items:flex-start;width:auto;max-width:none;position:sticky;top:0;}
}
@media (prefers-reduced-motion:reduce){
  .iff-btn:active,.iff-pad button:active,.iff-swap:active{transform:none;}
}
`;

let cssInjected = false;
function ensureCss(host: HTMLElement): void {
  if (cssInjected && document.getElementById("iff-style")) return;
  const style = document.createElement("style");
  style.id = "iff-style";
  style.textContent = CSS;
  (document.head ?? host).appendChild(style);
  cssInjected = true;
}

// ---------------------------------------------------------------------------
// 一关的运行时
// ---------------------------------------------------------------------------

const DIR_ACTIONS = ["up", "down", "left", "right"] as const;

interface HeroView {
  glide: Glide;
  facing: number;
  /** 下一格最早什么时候(手感:走格节奏) */
  readyAt: number;
  /** 提前按下的指令(手感:跳跃缓冲) */
  buffer: Buffered;
  charges: number;
  flash: number;
  /** 同伴最后一次踩在托举点上的时刻(手感:土狼时间) */
  lastSupported: number;
  /** 小云朵飘回:飘到什么时候为止 */
  cloudUntil: number;
  cloudFrom: number;
  cloudTo: number;
  /** 被顶举抛出去:飞到什么时候为止 */
  hopUntil: number;
}

interface LevelRuntime extends PlayHandle {
  pause: () => void;
  resume: () => void;
}

function playLevel(stage: HTMLElement, ctx: PlayCtx, analysis: LevelAnalysis): LevelRuntime {
  ensureCss(stage);

  const level: ParsedLevel = parseLevel(analysis.grid);
  const gemAt = new Map<number, Gem>();
  for (const g of level.gems) gemAt.set(g.pos, g);
  const totalGems = level.gems.length;
  const palette = PALETTES[ctx.chapterIndex % PALETTES.length];
  const kit: CoopKit = buildCoopKit(ctx.level, level);
  const cps: Checkpoints = pickCheckpoints(level);
  const links = linkHints(level);

  let st: GameState = initialState(level);
  let coop: CoopState = initialCoop(kit);
  let collected = new Set<number>();
  let reached = -1;
  let hearts = MAX_HEARTS;
  let elapsed = 0;
  let paused = false;
  let finished = false;
  let lastFrame = 0;
  let raf = 0;
  let soloState: SoloState = initialSolo();
  let highFiveAt = -HIGH_FIVE_MS;
  let liftDown = true;
  let toastUntil = 0;
  let reduced = prefersReducedMotion();
  /** 开门尘土账本(纯视觉,destroy 一笔不剩) */
  const dustFx = new IffDustFx();

  const views: Record<Hero, HeroView> = {
    ice: makeView(level, st.ice),
    fire: makeView(level, st.fire),
  };

  function makeView(lv: ParsedLevel, pos: number): HeroView {
    return {
      glide: makeGlide(pos % lv.w, (pos / lv.w) | 0),
      facing: DIR_RIGHT,
      readyAt: 0,
      buffer: emptyBuffer(),
      charges: POWER_CHARGES,
      flash: 0,
      lastSupported: -1,
      cloudUntil: 0,
      cloudFrom: -1,
      cloudTo: -1,
      hopUntil: 0,
    };
  }

  // ---- DOM ----------------------------------------------------------------
  const wrap = document.createElement("div");
  wrap.className = "iff-wrap";

  const hud = document.createElement("div");
  hud.className = "iff-hud";
  // 双人头像卡片:两张迷你脸画一次就够,不进帧循环
  const chipDuo = document.createElement("span");
  chipDuo.className = "iff-chip iff-duo";
  chipDuo.setAttribute("aria-hidden", "true");
  for (const kind of ["ice", "fire"] as const) {
    const face = document.createElement("canvas");
    face.width = 48;
    face.height = 48;
    face.className = "iff-duo-face";
    const fc = face.getContext("2d");
    if (fc) drawMiniHero(fc, kind, 48);
    chipDuo.appendChild(face);
  }
  const chipTime = chip("⏱ 0:00");
  const chipGems = chip(`💎 0/${totalGems}`);
  const chipClouds = chip("💗 ❤❤❤");
  const chipFlag = chip(checkpointLabel(cps, reached));
  const chipPower = chip("");
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "iff-btn iff-btn--ghost";
  resetBtn.textContent = "↺ 重摆";
  hud.append(chipDuo, chipTime, chipGems, chipClouds, chipFlag, chipPower, resetBtn);

  // 单人换人按钮固定在棋盘正上方的中间 —— 手机上两只手都在屏幕下缘,
  // 中间上方是唯一一块不会被拇指挡住、又一眼能看见的地方
  const swapBar = document.createElement("div");
  swapBar.className = "iff-swapbar";
  const swapBtn = document.createElement("button");
  swapBtn.type = "button";
  swapBtn.className = "iff-swap";
  swapBar.appendChild(swapBtn);

  const board = document.createElement("div");
  board.className = "iff-board";
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    `冰冰火火森林第 ${ctx.level + 1} 关的地图,${level.w} 列 ${level.h} 行`
  );
  board.appendChild(canvas);

  const tip = document.createElement("div");
  tip.className = "iff-tip";
  tip.textContent = analysis.hint;

  const status = document.createElement("div");
  status.className = "iff-sr";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const pads = document.createElement("div");
  pads.className = "iff-pads";
  const icePad = buildPad("ice");
  const firePad = buildPad("fire");
  pads.append(icePad.el, firePad.el);

  wrap.append(hud, swapBar, board, tip, pads, status);
  stage.appendChild(wrap);

  function chip(text: string): HTMLSpanElement {
    const el = document.createElement("span");
    el.className = "iff-chip";
    el.textContent = text;
    return el;
  }

  // ---- 虚拟按键 ------------------------------------------------------------
  const held = new Set<string>();

  /**
   * 按下一个方向。
   *
   * 跳跃缓冲必须**按「一次按下」记一次**,不能按住期间每帧重记 ——
   * 每帧重记的话,快按一下会走两格:按下的那一瞬间先走一步,
   * 松手后那条一直被刷新的缓冲又在 120ms 内兑现出第二步。
   * 真机上这个毛病一按就现,格子游戏里尤其难受。
   */
  function pressDir(hero: Hero, action: string, repeat: boolean): void {
    held.add(`${hero}:${action}`);
    if (!repeat) views[hero].buffer = bufferPress(views[hero].buffer, action, performance.now());
  }

  interface PadHandle {
    el: HTMLElement;
    name: HTMLElement;
  }

  function buildPad(hero: Hero): PadHandle {
    const box = document.createElement("div");
    box.className = "iff-padwrap";
    const name = document.createElement("div");
    name.className = "iff-padname";
    name.style.color = hero === "ice" ? ICE_DARK : FIRE_DARK;
    name.textContent = HERO_SHORT[hero];
    const grid = document.createElement("div");
    grid.className = `iff-pad iff-pad--${hero}`;
    // 元素之力与同行键塞进方向键的两个空角:手机竖屏上省下一整行,
    // 375×667 才装得下「棋盘 + 两套虚拟键」而不用滚动
    const cells: Array<{ label: string; action?: string; tap?: "power" | "cheer" }> = [
      { label: hero === "ice" ? "❄" : "🔥", tap: "power" },
      { label: "▲", action: "up" },
      { label: "🤝", tap: "cheer" },
      { label: "◀", action: "left" },
      { label: "" },
      { label: "▶", action: "right" },
      { label: "" },
      { label: "▼", action: "down" },
      { label: "" },
    ];
    for (const cell of cells) {
      const b = document.createElement("button");
      b.type = "button";
      if (cell.tap) {
        b.textContent = cell.label;
        b.className = "iff-pad-act";
        b.setAttribute(
          "aria-label",
          cell.tap === "power"
            ? hero === "ice"
              ? "凛凛把面前的岩浆冻成冰桥"
              : "焰焰把面前的冰水烤干"
            : `${HERO_SHORT[hero]}和同伴配合一下:传送、顶举、拉绳或者击掌`
        );
        b.addEventListener("click", () => (cell.tap === "power" ? doPower(hero) : doTeam(hero)));
        grid.appendChild(b);
        continue;
      }
      if (!cell.action) {
        b.className = "iff-pad-slot";
        b.tabIndex = -1;
        b.setAttribute("aria-hidden", "true");
        grid.appendChild(b);
        continue;
      }
      b.textContent = cell.label;
      b.setAttribute("aria-label", `${HERO_SHORT[hero]}向${dirWord(cell.action)}走`);
      bindHold(b, hero, cell.action);
      grid.appendChild(b);
    }
    box.append(name, grid);
    return { el: box, name };
  }

  function dirWord(action: string): string {
    return action === "up" ? "上" : action === "down" ? "下" : action === "left" ? "左" : "右";
  }

  function bindHold(btn: HTMLButtonElement, hero: Hero, action: string): void {
    const on = (e: Event): void => {
      e.preventDefault();
      pressDir(routeHero(soloState, hero), action, false);
    };
    const off = (): void => {
      held.delete(`ice:${action}`);
      held.delete(`fire:${action}`);
    };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointercancel", off);
    btn.addEventListener("pointerleave", off);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pressDir(routeHero(soloState, hero), action, e.repeat);
      }
    });
    btn.addEventListener("keyup", off);
    btn.addEventListener("blur", off);
  }

  // ---- 键盘 ---------------------------------------------------------------
  function onKeyDown(e: KeyboardEvent): void {
    if (finished) return;
    if (e.code === PAUSE_CODE) {
      e.preventDefault();
      setPaused(!paused);
      return;
    }
    if (paused) return;
    if (isSwitchCode(e.code)) {
      e.preventDefault();
      // 双人模式下按 Tab 也直接进单人 —— 一个人坐下来玩的时候不用先找按钮
      soloState = soloState.solo ? switchHero(soloState) : toggleSolo(soloState);
      afterSoloChange();
      return;
    }
    const bind = KEY_MAP[e.code];
    if (!bind) return;
    e.preventDefault();
    const hero = routeHero(soloState, bind.hero);
    if (bind.action === "power") {
      doPower(hero);
      return;
    }
    if (bind.action === "cheer") {
      doTeam(hero);
      return;
    }
    pressDir(hero, bind.action, e.repeat);
  }

  function onKeyUp(e: KeyboardEvent): void {
    const bind = KEY_MAP[e.code];
    if (!bind) return;
    // 单人模式中途换人时,两套键位都得松开,免得留下按住不放的幽灵
    held.delete(`ice:${bind.action}`);
    held.delete(`fire:${bind.action}`);
  }

  function onBlur(): void {
    held.clear();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  // ---- 交互 ---------------------------------------------------------------
  /**
   * 暂停 / 继续。两套键位一起松开,缓冲也清掉 ——
   * 不然暂停前按住的那一下会在恢复的瞬间兑现,人莫名其妙走出去一格。
   */
  function setPaused(next: boolean): void {
    if (finished || paused === next) return;
    paused = next;
    held.clear();
    views.ice.buffer = emptyBuffer();
    views.fire.buffer = emptyBuffer();
    if (paused) {
      lastFrame = 0;
      toastUntil = Number.POSITIVE_INFINITY;
      tip.textContent = PAUSE_LINE;
      say(PAUSE_LINE);
    } else {
      lastFrame = 0;
      toastUntil = 0;
      tip.textContent =
        waitingLine(st.ice === level.iceDoor, st.fire === level.fireDoor) || analysis.hint;
      say("接着玩");
      refreshHud();
    }
  }

  function afterSoloChange(): void {
    held.clear();
    views.ice.buffer = emptyBuffer();
    views.fire.buffer = emptyBuffer();
    ctx.sfx("tap");
    say(soloAnnounce(soloState));
    refreshHud();
  }

  swapBtn.addEventListener("click", () => {
    soloState = soloState.solo ? switchHero(soloState) : toggleSolo(soloState);
    afterSoloChange();
  });
  resetBtn.addEventListener("click", () => resetLevel());

  function resetLevel(): void {
    const fresh = parseLevel(analysis.grid);
    level.tiles.set(fresh.tiles);
    level.aux.set(fresh.aux);
    st = initialState(level);
    coop = initialCoop(kit);
    collected = new Set<number>();
    reached = -1;
    hearts = MAX_HEARTS;
    elapsed = 0;
    views.ice = makeView(level, st.ice);
    views.fire = makeView(level, st.fire);
    ctx.sfx("tap");
    say("这一关重新摆好了");
    refreshHud();
  }

  function doPower(hero: Hero): void {
    if (finished || paused) return;
    const view = views[hero];
    if (view.charges <= 0) {
      flashToast(`${HERO_SHORT[hero]}的元素之力用完了,和同伴击掌能补一发`);
      return;
    }
    const changed = useElementPower(level, st, hero, view.facing);
    if (changed < 0) {
      flashToast(
        hero === "ice" ? "面前得正好是岩浆,凛凛才冻得出冰桥" : "面前得正好是冰水,焰焰才烤得干"
      );
      return;
    }
    view.charges--;
    ctx.sfx("pop");
    say(hero === "ice" ? "凛凛把岩浆冻成了冰桥" : "焰焰把冰水烤成了干地");
    refreshHud();
  }

  /** 从 hero 看过去,同伴在哪个方向(不在同一行 / 同一列就是 -1) */
  function dirToMate(hero: Hero): number {
    const from = hero === "ice" ? st.ice : st.fire;
    const mate = hero === "ice" ? st.fire : st.ice;
    const dx = (mate % level.w) - (from % level.w);
    const dy = ((mate / level.w) | 0) - ((from / level.w) | 0);
    if (dx !== 0 && dy === 0) return dx > 0 ? DIR_RIGHT : DIR_LEFT;
    if (dy !== 0 && dx === 0) return dy > 0 ? DIR_DOWN : DIR_UP;
    return -1;
  }

  /**
   * 同行键(G / K / 🤝):按优先级挨个试,第一个成立的就是它。
   * 传送门 → 电梯 → 顶举 → 绳索 → 击掌。
   * 顶举和绳索都要「正朝着同伴」,所以想击掌的时候转个身就行,不会抢。
   */
  function doTeam(hero: Hero): void {
    if (finished || paused) return;
    const now = performance.now();
    const view = views[hero];
    const power = computePower(level, st);
    const light = computeLight(level, st, power);

    if (portalReady(kit, st)) {
      const swapped = portalSwap(kit, st);
      if (swapped) {
        st = swapped;
        snapViews();
        ctx.sfx("pop");
        say("两个人从传送门换了个位置");
        refreshHud();
        return;
      }
    }

    if (elevatorReady(level, kit, st, coop) && kit.elevator) {
      if (coop.elevatorRow >= kit.elevator.bottom) liftDown = false;
      if (coop.elevatorRow <= kit.elevator.top) liftDown = true;
      const ride = elevatorRide(level, kit, st, coop, liftDown ? DIR_DOWN : DIR_UP);
      if (ride) {
        st = ride.state;
        coop = ride.coop;
        snapViews();
        ctx.sfx("tap");
        say("升降台动了,两个人一起走");
        refreshHud();
        return;
      }
    }

    const facingMate = dirToMate(hero) === view.facing;
    if (facingMate) {
      const boosted = boostTarget(level, st, hero, power, light);
      if (boosted >= 0) {
        const mate: Hero = hero === "ice" ? "fire" : "ice";
        if (mate === "ice") st = { ...st, ice: boosted };
        else st = { ...st, fire: boosted };
        views[mate].hopUntil = now + hopDurationMs();
        views[mate].glide.queue.push(boosted);
        ctx.sfx("jump");
        say(`${HERO_SHORT[hero]}把${HERO_SHORT[mate]}举了过去`);
        pickUpGems();
        refreshHud();
        if (isWin(level, st)) settleWin();
        return;
      }
      const pulled = ropePull(level, st, hero, power, light);
      if (pulled >= 0) {
        const mate: Hero = hero === "ice" ? "fire" : "ice";
        if (mate === "ice") st = { ...st, ice: pulled };
        else st = { ...st, fire: pulled };
        views[mate].glide.queue.push(pulled);
        ctx.sfx("pop");
        say(`${HERO_SHORT[hero]}用绳子把${HERO_SHORT[mate]}拉了过来`);
        pickUpGems();
        refreshHud();
        if (isWin(level, st)) settleWin();
        return;
      }
    }

    if (now - highFiveAt < HIGH_FIVE_MS) return;
    if (!isAdjacent(level, st)) {
      flashToast("要挨在一起才配合得上;想顶举或拉绳,先转身朝着同伴。");
      return;
    }
    highFiveAt = now;
    let gained = false;
    for (const who of ["ice", "fire"] as const) {
      if (views[who].charges < POWER_CHARGES_MAX) {
        views[who].charges++;
        gained = true;
      }
    }
    ctx.sfx("coin");
    if (!reduced) {
      views.ice.flash = now;
      views.fire.flash = now;
    }
    say(gained ? "击掌成功,元素之力补了一发" : "击掌!两个人都满着呢");
    refreshHud();
  }

  /** 位置被直接改写(传送 / 电梯)之后,让画面立刻跟上,不要拖一条斜线 */
  function snapViews(): void {
    for (const hero of ["ice", "fire"] as const) {
      const pos = hero === "ice" ? st.ice : st.fire;
      const v = views[hero];
      v.glide.queue.length = 0;
      v.glide.x = pos % level.w;
      v.glide.y = (pos / level.w) | 0;
    }
  }

  function flashToast(text: string): void {
    toastUntil = performance.now() + 2200;
    tip.textContent = text;
  }

  function say(text: string): void {
    status.textContent = text;
  }

  // ---- 走一步 -------------------------------------------------------------
  function pumpHero(hero: Hero, now: number): void {
    const v = views[hero];
    if (now < v.cloudUntil) return;
    let action: string | null = null;
    if (isControlled(soloState, hero)) {
      for (const a of DIR_ACTIONS) {
        if (held.has(`${hero}:${a}`)) {
          action = a;
          break;
        }
      }
    }
    if (!stepReady(now, v.readyAt)) return;
    if (!action && bufferAlive(v.buffer, now)) {
      const taken = bufferTake(v.buffer, now);
      v.buffer = taken.next;
      action = taken.action;
    } else if (action) {
      v.buffer = emptyBuffer();
    }
    if (!action) return;
    tryStep(hero, ACTION_DIR[action], now);
  }

  function tryStep(hero: Hero, dir: number, now: number): void {
    const view = views[hero];
    view.facing = dir;
    const out = moveWithCoop(level, kit, coop, st, hero, dir);

    if (out.kind === "solid") {
      if (tryCoyoteClimb(hero, dir, now)) return;
      view.readyAt = nextBumpAt(now);
      return;
    }
    if (out.kind === "hurt") {
      startCloud(hero, dir, now);
      return;
    }
    st = out.state;
    coop = out.coop;
    view.readyAt = nextStepAt(now);
    views.ice.glide.queue.push(...out.icePath);
    views.fire.glide.queue.push(...out.firePath);
    ctx.sfx(out.pushed ? "pop" : "tap");
    pickUpGems();
    reached = updateReached(cps, reached, st.ice % level.w, st.fire % level.w);
    refreshHud();
    if (isWin(level, st)) settleWin();
  }

  /**
   * 土狼时间:同伴刚从托举点上走开,这一步已经按下去了 —— 90ms 内照样算数。
   * 没有这一条,两个人永远差半拍,高坎那一章会卡到想放弃。
   */
  function tryCoyoteClimb(hero: Hero, dir: number, now: number): boolean {
    const view = views[hero];
    if (!coyoteOpen(now, view.lastSupported)) return false;
    const from = hero === "ice" ? st.ice : st.fire;
    const x = (from % level.w) + [1, -1, 0, 0][dir];
    const y = ((from / level.w) | 0) + [0, 0, 1, -1][dir];
    if (x < 0 || y < 0 || x >= level.w || y >= level.h) return false;
    const to = y * level.w + x;
    if (level.tiles[to] !== TILE.LEDGE) return false;
    const other = hero === "ice" ? st.fire : st.ice;
    if (to === other) return false;
    st = hero === "ice" ? { ...st, ice: to } : { ...st, fire: to };
    view.readyAt = nextStepAt(now);
    views[hero].glide.queue.push(to);
    view.lastSupported = -1;
    ctx.sfx("jump");
    pickUpGems();
    reached = updateReached(cps, reached, st.ice % level.w, st.fire % level.w);
    refreshHud();
    if (isWin(level, st)) settleWin();
    return true;
  }

  /**
   * 踩进了自己过不去的池子:**不重来这一关**,变成一朵小云飘回最近的休息点。
   * 拉杆、闩开的记忆门、捡过的宝石、推过的木箱统统保留。
   */
  function startCloud(hero: Hero, dir: number, now: number): void {
    const view = views[hero];
    const from = hero === "ice" ? st.ice : st.fire;
    const x = (from % level.w) + [1, -1, 0, 0][dir];
    const y = ((from / level.w) | 0) + [0, 0, 1, -1][dir];
    const splash = y * level.w + x;
    const other = hero === "ice" ? st.fire : st.ice;
    const back = respawnCell(level, cps, reached, hero, from, other);
    if (back < 0) {
      view.readyAt = nextBumpAt(now);
      return;
    }
    st = hero === "ice" ? { ...st, ice: back } : { ...st, fire: back };
    view.cloudFrom = splash;
    view.cloudTo = back;
    view.cloudUntil = now + FEEL.CLOUD_MS;
    view.readyAt = now + FEEL.CLOUD_MS;
    view.buffer = emptyBuffer();
    view.glide.queue.length = 0;
    hearts = Math.max(0, hearts - 1);
    ctx.sfx("oops");
    say(cloudLine(hero, reached));
    flashToast(cloudLine(hero, reached));
    refreshHud();
  }

  function pickUpGems(): void {
    for (const hero of ["ice", "fire"] as const) {
      const pos = hero === "ice" ? st.ice : st.fire;
      const gem = gemAt.get(pos);
      if (!gem || collected.has(pos)) continue;
      const owner = gemOwner(gem.kind);
      if (owner !== "both" && owner !== hero) continue;
      collected.add(pos);
      ctx.sfx("coin");
    }
  }

  // ---- 结算 ---------------------------------------------------------------
  function settleWin(): void {
    if (finished) return;
    finished = true;
    const run = {
      gems: collected.size,
      totalGems,
      seconds: Math.round(elapsed),
      steps: analysis.steps,
      hearts,
    };
    const stars = rateRun(run);
    ctx.win(stars, winLine(run, stars));
  }

  /**
   * 唯一会结束一局的原因是**超时**。
   *
   * 1.1 里心掉光就整关重来;1.2 有了检查点,踩空只是变成小云朵飘回去,
   * 心从此只影响星数 —— 一个卡在半路的孩子不会被打回起点。
   */
  function settleLose(): void {
    if (finished) return;
    finished = true;
    ctx.lose(loseLine("time"));
  }

  // ---- HUD ---------------------------------------------------------------
  function refreshHud(): void {
    chipTime.textContent = `⏱ ${formatClock(elapsed)} / ${formatClock(analysis.limitSeconds)}`;
    chipGems.textContent = `💎 ${collected.size}/${totalGems}`;
    chipClouds.textContent = `💗 ${"❤".repeat(Math.max(0, hearts))}${"·".repeat(Math.max(0, MAX_HEARTS - hearts))}`;
    chipFlag.textContent = checkpointLabel(cps, reached);
    chipFlag.setAttribute(
      "aria-label",
      cps.columns.length === 0
        ? "这一关很短,没有休息点"
        : `已经点亮 ${reached + 1} 个休息点,一共 ${cps.columns.length} 个`
    );
    chipPower.textContent = `❄${views.ice.charges} 🔥${views.fire.charges}`;
    chipPower.setAttribute(
      "aria-label",
      `凛凛还有 ${views.ice.charges} 发元素之力,焰焰还有 ${views.fire.charges} 发`
    );
    swapBtn.textContent = switchButtonLabel(soloState);
    swapBtn.setAttribute("aria-label", switchButtonAria(soloState));
    swapBtn.setAttribute("aria-pressed", soloState.solo ? "true" : "false");
    icePad.name.textContent = padLabel(soloState, "ice");
    firePad.name.textContent = padLabel(soloState, "fire");
    if (performance.now() > toastUntil) {
      const wait = waitingLine(st.ice === level.iceDoor, st.fire === level.fireDoor);
      tip.textContent = wait || analysis.hint;
    }
  }

  // ---- 画面 ---------------------------------------------------------------
  let baseCell = 24;
  let viewW = 320;
  let viewH = 240;
  let camX = 0;
  let camY = 0;
  let camCell = 24;
  let camReady = false;

  function layout(): void {
    const availW = Math.max(200, (stage.clientWidth || 340) - 8);
    // N-103:壳标题 + HUD + 换人条吃掉的高度也要从预算里扣,画布底才进得了 412
    let roomH = Number.NaN;
    if (typeof board.getBoundingClientRect === "function") {
      const top = board.getBoundingClientRect().top;
      if (Number.isFinite(top) && top > 0) roomH = (window.innerHeight || 667) - top - 6;
    }
    const budgetH = clampBoardBudget(
      boardHeightBudget(window.innerWidth || 375, window.innerHeight || 667),
      roomH
    );
    const fit = Math.min(availW / level.w, budgetH / level.h);
    // 小于 MIN_CELL 就不再压缩,改由摄像机跟随 —— 贴边看不清前方比看不见全图更难受
    baseCell = Math.max(MIN_CELL, Math.min(fit, MAX_CELL));
    viewW = Math.round(Math.min(availW, level.w * baseCell));
    viewH = Math.round(Math.min(budgetH, level.h * baseCell));
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    const c = canvas.getContext("2d");
    if (c) c.setTransform(dpr, 0, 0, dpr, 0, 0);
    camReady = false;
  }

  function heroScreenPos(hero: Hero, now: number): { x: number; y: number; lift: number } {
    const v = views[hero];
    if (now < v.cloudUntil && v.cloudFrom >= 0 && v.cloudTo >= 0) {
      const t = 1 - (v.cloudUntil - now) / FEEL.CLOUD_MS;
      const pts = cloudPath(level, v.cloudFrom, v.cloudTo);
      const i = Math.min(pts.length - 1, Math.max(0, Math.round(t * (pts.length - 1))));
      return { x: pts[i].x, y: pts[i].y, lift: 0 };
    }
    const hopLeft = v.hopUntil - now;
    const lift = hopLeft > 0 ? hopOffsetPx(hopDurationMs() - hopLeft) : 0;
    return { x: v.glide.x, y: v.glide.y, lift };
  }

  function updateCamera(now: number, dt: number): void {
    const a = heroScreenPos("ice", now);
    const b = heroScreenPos("fire", now);
    const cam = computeCamera({
      iceX: a.x,
      iceY: a.y,
      fireX: b.x,
      fireY: b.y,
      gridW: level.w,
      gridH: level.h,
      viewW,
      viewH,
      baseCell,
    });
    if (!camReady || reduced) {
      camX = cam.cx;
      camY = cam.cy;
      camCell = cam.cell;
      camReady = true;
    } else {
      camX = followTowards(camX, cam.cx, dt);
      camY = followTowards(camY, cam.cy, dt);
      camCell = followTowards(camCell, cam.cell, dt);
    }
    lastArrows = cam.arrows;
  }

  let lastArrows: Array<{ hero: "ice" | "fire"; dx: number; dy: number }> = [];

  function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }

  /**
   * 冰水潭:**圆角池子 + 三道横波纹 + 一枚六角雪花**,1.3 加镜面反光斜带与池沿霜花。
   * 岩浆池:**尖角池子 + 流动高光 + 上浮气泡**。
   * 两者形状与纹理都不一样,不靠颜色也分得开(色觉友好)。
   */
  function drawIcePool(c: CanvasRenderingContext2D, x: number, y: number, cell: number): void {
    const pad = Math.max(1, cell * 0.06);
    c.fillStyle = WATER_FILL;
    roundRect(c, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.3);
    c.fill();
    c.strokeStyle = WATER_DEEP;
    c.lineWidth = Math.max(1.2, cell * 0.05);
    c.stroke();
    // 镜面反光斜带(静态渐变系,reduced 保留)
    c.save();
    roundRect(c, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.3);
    c.clip();
    c.strokeStyle = withAlpha("#FFFFFF", 0.5);
    c.lineCap = "round";
    for (const [w0, off] of [
      [0.12, 0],
      [0.05, 0.22],
    ]) {
      c.lineWidth = cell * w0;
      c.beginPath();
      c.moveTo(x + cell * (0.14 + off), y + cell * 0.86);
      c.lineTo(x + cell * (0.6 + off), y + cell * 0.14);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = WATER_DEEP;
    c.lineWidth = Math.max(1.2, cell * 0.05);
    for (let i = 0; i < 3; i++) {
      const wy = y + cell * (0.34 + i * 0.18);
      c.beginPath();
      c.moveTo(x + cell * 0.2, wy);
      c.quadraticCurveTo(x + cell * 0.35, wy - cell * 0.07, x + cell * 0.5, wy);
      c.quadraticCurveTo(x + cell * 0.65, wy + cell * 0.07, x + cell * 0.8, wy);
      c.stroke();
    }
    c.strokeStyle = "#ffffffcc";
    c.lineWidth = Math.max(1, cell * 0.05);
    const r = cell * 0.16;
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const ang = (Math.PI / 3) * i;
      c.moveTo(x + cell / 2 - Math.cos(ang) * r, y + cell * 0.5 - Math.sin(ang) * r);
      c.lineTo(x + cell / 2 + Math.cos(ang) * r, y + cell * 0.5 + Math.sin(ang) * r);
    }
    c.stroke();
    // 池沿霜花:顶边三粒小白点
    c.fillStyle = withAlpha("#FFFFFF", 0.85);
    for (const fx of [0.24, 0.5, 0.76]) {
      dot(c, x + cell * fx, y + pad + cell * 0.03, Math.max(0.8, cell * 0.035));
    }
  }

  /** 岩浆池的 16 齿尖角轮廓(和 1.2 同形,只是拆出来好做裁剪) */
  function lavaPath(c: CanvasRenderingContext2D, cx: number, cy: number, outer: number): void {
    const inner = outer * 0.66;
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const ang = (Math.PI * 2 * i) / 16 - Math.PI / 2;
      const rad = i % 2 === 0 ? outer : inner;
      const px = cx + Math.cos(ang) * rad;
      const py = cy + Math.sin(ang) * rad;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
  }

  function drawLavaPool(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    cell: number,
    pos: number,
    now: number
  ): void {
    const pad = Math.max(1, cell * 0.08);
    const cx = x + cell / 2;
    const cy = y + cell / 2;
    const outer = cell / 2 - pad;
    lavaPath(c, cx, cy, outer);
    c.fillStyle = IFF_COLORS.iffLava;
    c.fill();
    // 池沿焦糖色描边
    c.strokeStyle = shade(IFF_COLORS.iffLava, -32);
    c.lineWidth = Math.max(1.2, cell * 0.05);
    c.stroke();
    // 流动高光条:3200ms 平移循环(linear);reduced 是一根静止条
    c.save();
    lavaPath(c, cx, cy, outer);
    c.clip();
    const ph = lavaSheenPhase(now, reduced);
    const sx = x + (ph * 1.7 - 0.35) * cell;
    c.strokeStyle = withAlpha("#FFE28A", 0.7);
    c.lineWidth = cell * 0.1;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(sx, y + cell * 0.92);
    c.lineTo(sx + cell * 0.34, y + cell * 0.08);
    c.stroke();
    c.restore();
    // 上浮气泡:2s 循环(easeOutSine);reduced 一粒不生成
    for (const b of lavaBubbles(pos, now, reduced)) {
      c.save();
      c.globalAlpha = Math.max(0, Math.min(1, b.alpha)) * 0.85;
      c.fillStyle = shade(IFF_COLORS.iffLava, 30);
      dot(c, x + b.u * cell, y + b.v * cell, b.r * cell);
      c.strokeStyle = shade(IFF_COLORS.iffLava, -18);
      c.lineWidth = Math.max(0.8, cell * 0.03);
      c.beginPath();
      c.arc(x + b.u * cell, y + b.v * cell, b.r * cell, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }

  function drawSlime(c: CanvasRenderingContext2D, x: number, y: number, cell: number): void {
    const pad = Math.max(1, cell * 0.08);
    c.fillStyle = SLIME_FILL;
    roundRect(c, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.42);
    c.fill();
    // 果冻顶部一弯高光(左上 45° 光源)
    c.fillStyle = withAlpha("#FFFFFF", 0.3);
    roundRect(c, x + pad * 2, y + pad * 2, (cell - pad * 4) * 0.6, (cell - pad * 4) * 0.32, cell * 0.2);
    c.fill();
    c.strokeStyle = SLIME_DEEP;
    c.lineWidth = Math.max(1.2, cell * 0.06);
    roundRect(c, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.42);
    c.stroke();
    c.fillStyle = "#6FA53E";
    dot(c, x + cell * 0.35, y + cell * 0.4, cell * 0.07);
    dot(c, x + cell * 0.66, y + cell * 0.6, cell * 0.06);
  }

  function groupMark(c: CanvasRenderingContext2D, x: number, y: number, cell: number, group: number, on: boolean): void {
    c.fillStyle = on ? "#B5761A" : "#8C7FB4";
    c.font = `900 ${Math.round(cell * 0.26)}px system-ui`;
    c.textAlign = "left";
    c.textBaseline = "top";
    c.fillText(String(group + 1), x + cell * 0.1, y + cell * 0.06);
  }

  /** 机关门:关门是石框立面 + 栅条,开门保留 1.2 的虚线框(识别语言不变) */
  function drawGate(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    cell: number,
    open: boolean,
    seesaw: boolean,
    tone?: string
  ): void {
    const base = tone ?? (seesaw ? "#D7A8C4" : "#A79AD0");
    if (open) {
      // 门柱残端:开着也看得出「这里有一扇门」
      c.fillStyle = shade(base, -12);
      c.fillRect(x + cell * 0.08, y + cell * 0.74, cell * 0.14, cell * 0.18);
      c.fillRect(x + cell * 0.78, y + cell * 0.74, cell * 0.14, cell * 0.18);
      c.strokeStyle = base;
      c.lineWidth = Math.max(2, cell * 0.08);
      c.setLineDash([cell * 0.12, cell * 0.1]);
      c.strokeRect(x + cell * 0.16, y + cell * 0.16, cell * 0.68, cell * 0.68);
      c.setLineDash([]);
      return;
    }
    c.fillStyle = base;
    roundRect(c, x + 1, y + 1, cell - 2, cell - 2, cell * 0.18);
    c.fill();
    // 石框立面:顶梁受光、右柱与底沿背光(左上 45° 光源)
    c.fillStyle = shade(base, 22);
    roundRect(c, x + 1, y + 1, cell - 2, cell * 0.2, cell * 0.12);
    c.fill();
    c.fillStyle = shade(base, -18);
    c.fillRect(x + cell * 0.84, y + cell * 0.16, cell * 0.1, cell * 0.76);
    c.fillRect(x + cell * 0.06, y + cell * 0.86, cell * 0.88, cell * 0.08);
    c.strokeStyle = "#ffffff88";
    c.lineWidth = Math.max(2, cell * 0.07);
    for (let i = 1; i <= 3; i++) {
      const gx = x + (cell * i) / 4;
      c.beginPath();
      c.moveTo(gx, y + cell * 0.24);
      c.lineTo(gx, y + cell * 0.84);
      c.stroke();
    }
  }

  /** 宝石切面化:菱形主体 + 三角切面高光 + 旋转闪点(1800ms/圈,reduced 静止高光) */
  function drawGem(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    cell: number,
    gem: Gem,
    pos: number,
    now: number
  ): void {
    const colors: Record<string, [string, string]> = {
      blue: ["#8FD3F4", "#3E8FC0"],
      red: ["#FFA98F", "#D9552F"],
      white: ["#FFF0B8", "#D9A82C"],
    };
    const [fill, edge] = colors[gem.kind];
    const cx = x + cell / 2;
    const cy = y + cell / 2;
    const r = cell * 0.24;
    c.fillStyle = fill;
    c.strokeStyle = edge;
    c.lineWidth = Math.max(1.5, cell * 0.06);
    c.beginPath();
    c.moveTo(cx, cy - r);
    c.lineTo(cx + r * 0.86, cy);
    c.lineTo(cx, cy + r);
    c.lineTo(cx - r * 0.86, cy);
    c.closePath();
    c.fill();
    c.stroke();
    // 切面:左上受光三角亮、下半三角沉(静止高光,reduced 保留)
    c.fillStyle = withAlpha("#FFFFFF", 0.55);
    c.beginPath();
    c.moveTo(cx, cy - r);
    c.lineTo(cx - r * 0.86, cy);
    c.lineTo(cx, cy);
    c.closePath();
    c.fill();
    c.fillStyle = withAlpha(shade(fill, -30), 0.35);
    c.beginPath();
    c.moveTo(cx - r * 0.86, cy);
    c.lineTo(cx + r * 0.86, cy);
    c.lineTo(cx, cy + r);
    c.closePath();
    c.fill();
    c.fillStyle = "#FFFFFF";
    dot(c, cx - r * 0.28, cy - r * 0.42, Math.max(0.8, r * 0.14));
    // 旋转闪点:reduced 一粒不生成
    for (const s of gemSparks(now, pos, reduced)) {
      const px = cx + Math.cos(s.angle) * r * s.dist;
      const py = cy + Math.sin(s.angle) * r * 0.85 * s.dist;
      const sr = Math.max(1, r * 0.22);
      c.fillStyle = withAlpha("#FFFFFF", 0.9);
      c.beginPath();
      c.moveTo(px, py - sr);
      c.lineTo(px + sr * 0.32, py);
      c.lineTo(px, py + sr);
      c.lineTo(px - sr * 0.32, py);
      c.closePath();
      c.fill();
    }
  }

  function drawTile(
    c: CanvasRenderingContext2D,
    pos: number,
    cell: number,
    power: number,
    light: boolean,
    now: number
  ): void {
    const x = (pos % level.w) * cell;
    const y = ((pos / level.w) | 0) * cell;
    const t = level.tiles[pos];
    const a = level.aux[pos];
    const pad = Math.max(1, cell * 0.06);
    const isDoorCell = kit.dualButton !== null && pos === kit.dualButton.door;

    if (t !== TILE.WALL || isDoorCell) {
      c.fillStyle = palette.floor;
      c.fillRect(x, y, cell, cell);
      c.strokeStyle = palette.floorLine;
      c.lineWidth = 1;
      c.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
    }

    if (isDoorCell) {
      const open = memoryDoorOpen(kit, coop);
      dustFx.noteGate(pos, open, pos % level.w, (pos / level.w) | 0, now, reduced);
      drawGate(c, x, y, cell, open, false, "#8FB7D6");
      // 修复员 G2:锁 emoji 字形 → 自绘挂锁(开锁时锁弓抬起)
      drawPadlock(c, x + cell / 2, y + cell * 0.54, cell * 0.16, open, open ? "#3E8FC0" : "#6A5F8C");
      return;
    }

    switch (t) {
      case TILE.WALL: {
        c.fillStyle = palette.wall;
        roundRect(c, x + 1, y + 1, cell - 2, cell - 2, cell * 0.28);
        c.fill();
        c.fillStyle = palette.wallTop;
        roundRect(c, x + 1, y + 1, cell - 2, (cell - 2) * 0.55, cell * 0.28);
        c.fill();
        break;
      }
      case TILE.ICE_WATER:
        drawIcePool(c, x, y, cell);
        break;
      case TILE.LAVA:
        drawLavaPool(c, x, y, cell, pos, now);
        break;
      case TILE.SLIME:
        drawSlime(c, x, y, cell);
        break;
      case TILE.DOOR_ICE:
      case TILE.DOOR_FIRE: {
        const ice = t === TILE.DOOR_ICE;
        c.fillStyle = ice ? "#D6EEFA" : "#FDE3D0";
        roundRect(c, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.3);
        c.fill();
        c.strokeStyle = ice ? ICE_DARK : FIRE_DARK;
        c.lineWidth = Math.max(2, cell * 0.09);
        c.stroke();
        // 修复员 G2:雪花/火焰字形 → 主角水滴/火苗剪影缩成门面徽记(同一套形状语言)
        drawDoorBadge(c, ice ? "ice" : "fire", x + cell / 2, y + cell * 0.55, cell * 0.2, ice ? ICE_DARK : FIRE_DARK);
        break;
      }
      case TILE.PLATE: {
        const on = ((power >> a) & 1) === 1;
        c.fillStyle = on ? "#FFE9A8" : "#EFEAF6";
        roundRect(c, x + pad * 2, y + pad * 2, cell - pad * 4, cell - pad * 4, cell * 0.18);
        c.fill();
        c.strokeStyle = on ? "#E4A828" : "#B5A9CE";
        c.lineWidth = Math.max(2, cell * 0.08);
        c.stroke();
        groupMark(c, x, y, cell, a, on);
        break;
      }
      case TILE.LEVER: {
        const on = ((power >> a) & 1) === 1;
        c.fillStyle = "#EFEAF6";
        roundRect(c, x + pad * 2, y + cell * 0.55, cell - pad * 4, cell * 0.3, cell * 0.1);
        c.fill();
        c.strokeStyle = on ? "#E4A828" : "#8C7FB4";
        c.lineWidth = Math.max(2, cell * 0.1);
        c.beginPath();
        c.moveTo(x + cell / 2, y + cell * 0.68);
        c.lineTo(x + cell / 2 + (on ? cell * 0.22 : -cell * 0.22), y + cell * 0.24);
        c.stroke();
        groupMark(c, x, y, cell, a, on);
        break;
      }
      case TILE.GATE:
      case TILE.SEESAW: {
        const powered = ((power >> a) & 1) === 1;
        const open = t === TILE.GATE ? powered : !powered;
        dustFx.noteGate(pos, open, pos % level.w, (pos / level.w) | 0, now, reduced);
        drawGate(c, x, y, cell, open, t === TILE.SEESAW);
        groupMark(c, x, y, cell, a, open);
        break;
      }
      case TILE.LIGHT_GATE:
        dustFx.noteGate(pos, light, pos % level.w, (pos / level.w) | 0, now, reduced);
        drawGate(c, x, y, cell, light, false, BEAM_COLOR);
        break;
      case TILE.BELT: {
        c.fillStyle = "#E7EEF6";
        c.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        c.strokeStyle = "#93AAC4";
        c.lineWidth = Math.max(2, cell * 0.09);
        c.lineCap = "round";
        const cx = x + cell / 2;
        const cy = y + cell / 2;
        const s = cell * 0.2;
        const dx = [1, -1, 0, 0][a];
        const dy = [0, 0, 1, -1][a];
        for (let i = -1; i <= 1; i++) {
          const ox = cx + (dy !== 0 ? i * s * 1.1 : 0) - dx * s * 0.4;
          const oy = cy + (dx !== 0 ? i * s * 1.1 : 0) - dy * s * 0.4;
          c.beginPath();
          c.moveTo(ox - dy * s * 0.6, oy - dx * s * 0.6);
          c.lineTo(ox + dx * s, oy + dy * s);
          c.lineTo(ox + dy * s * 0.6, oy + dx * s * 0.6);
          c.stroke();
        }
        c.lineCap = "butt";
        break;
      }
      case TILE.LIFT_PAD: {
        c.strokeStyle = "#C2A6E0";
        c.lineWidth = Math.max(2, cell * 0.08);
        c.setLineDash([cell * 0.14, cell * 0.1]);
        c.beginPath();
        c.arc(x + cell / 2, y + cell / 2, cell * 0.3, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
        // 修复员 G2:双手 emoji 字形 → 双弧托举符号(两条圆头弧 + 被托起的小圆)
        drawLiftIcon(c, x + cell / 2, y + cell * 0.56, cell * 0.19, "#8C6FB8");
        break;
      }
      case TILE.LEDGE: {
        c.fillStyle = "#CBBEE6";
        roundRect(c, x + 1, y + cell * 0.3, cell - 2, cell * 0.7 - 1, cell * 0.14);
        c.fill();
        c.fillStyle = "#E0D6F3";
        roundRect(c, x + cell * 0.16, y + cell * 0.08, cell * 0.68, cell * 0.34, cell * 0.12);
        c.fill();
        break;
      }
      case TILE.MIRROR_SLASH:
      case TILE.MIRROR_BACK: {
        c.fillStyle = "#E6EDF4";
        roundRect(c, x + 1, y + 1, cell - 2, cell - 2, cell * 0.18);
        c.fill();
        c.strokeStyle = "#7FA8C9";
        c.lineWidth = Math.max(3, cell * 0.14);
        c.lineCap = "round";
        c.beginPath();
        if (t === TILE.MIRROR_SLASH) {
          c.moveTo(x + cell * 0.2, y + cell * 0.8);
          c.lineTo(x + cell * 0.8, y + cell * 0.2);
        } else {
          c.moveTo(x + cell * 0.2, y + cell * 0.2);
          c.lineTo(x + cell * 0.8, y + cell * 0.8);
        }
        c.stroke();
        c.lineCap = "butt";
        break;
      }
      case TILE.EMITTER: {
        c.fillStyle = "#5E5480";
        roundRect(c, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.24);
        c.fill();
        c.fillStyle = BEAM_COLOR;
        dot(c, x + cell / 2, y + cell / 2, cell * 0.18);
        break;
      }
      case TILE.RECEIVER: {
        c.fillStyle = "#5E5480";
        roundRect(c, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.24);
        c.fill();
        c.strokeStyle = light ? BEAM_COLOR : "#9C93BC";
        c.lineWidth = Math.max(2, cell * 0.1);
        c.beginPath();
        c.arc(x + cell / 2, y + cell / 2, cell * 0.22, 0, Math.PI * 2);
        c.stroke();
        break;
      }
      default:
        break;
    }

    const gem = gemAt.get(pos);
    if (gem && !collected.has(pos)) drawGem(c, x, y, cell, gem, pos, now);
  }

  /** 合作机关的摆件:按钮、传送门、升降台、木箱 */
  function drawKit(c: CanvasRenderingContext2D, cell: number): void {
    const db = kit.dualButton;
    if (db) {
      for (const [pos, tone] of [
        [db.icePad, ICE_DARK],
        [db.firePad, FIRE_DARK],
      ] as Array<[number, string]>) {
        const x = (pos % level.w) * cell;
        const y = ((pos / level.w) | 0) * cell;
        const pressed = pos === st.ice || pos === st.fire;
        c.strokeStyle = tone;
        c.lineWidth = Math.max(2, cell * 0.09);
        c.beginPath();
        c.arc(x + cell / 2, y + cell / 2, cell * (pressed ? 0.2 : 0.28), 0, Math.PI * 2);
        c.stroke();
      }
      // 光路提示:两颗按钮各连一条虚线到记忆门
      c.save();
      c.setLineDash([cell * 0.14, cell * 0.12]);
      c.strokeStyle = memoryDoorOpen(kit, coop) ? "#3E8FC0" : "#B5A9CE";
      c.lineWidth = Math.max(1, cell * 0.045);
      for (const pos of [db.icePad, db.firePad]) {
        c.beginPath();
        c.moveTo((pos % level.w) * cell + cell / 2, ((pos / level.w) | 0) * cell + cell / 2);
        c.lineTo((db.door % level.w) * cell + cell / 2, ((db.door / level.w) | 0) * cell + cell / 2);
        c.stroke();
      }
      c.restore();
    }

    if (kit.portal) {
      const lit = portalReady(kit, st);
      for (const pos of [kit.portal.a, kit.portal.b]) {
        const x = (pos % level.w) * cell;
        const y = ((pos / level.w) | 0) * cell;
        c.strokeStyle = PORTAL_COLOR;
        c.lineWidth = Math.max(2, cell * 0.08);
        c.beginPath();
        c.ellipse(x + cell / 2, y + cell / 2, cell * 0.3, cell * 0.22, 0, 0, Math.PI * 2);
        c.stroke();
        if (lit) {
          c.fillStyle = "#D8CCF5";
          dot(c, x + cell / 2, y + cell / 2, cell * 0.12);
        }
      }
    }

    if (kit.elevator && coop.elevatorRow >= 0) {
      const lift = kit.elevator;
      c.save();
      c.setLineDash([cell * 0.12, cell * 0.14]);
      c.strokeStyle = LIFT_COLOR;
      c.lineWidth = Math.max(1, cell * 0.05);
      for (const col of [lift.colA, lift.colB]) {
        c.beginPath();
        c.moveTo(col * cell + cell / 2, lift.top * cell + cell / 2);
        c.lineTo(col * cell + cell / 2, lift.bottom * cell + cell / 2);
        c.stroke();
      }
      c.restore();
      const y = coop.elevatorRow * cell;
      c.fillStyle = "#CFE0EE";
      roundRect(c, lift.colA * cell + 2, y + cell * 0.62, cell * 2 - 4, cell * 0.3, cell * 0.12);
      c.fill();
      c.strokeStyle = LIFT_COLOR;
      c.lineWidth = Math.max(1.5, cell * 0.06);
      c.stroke();
    }

    if (coop.crate >= 0) {
      const x = (coop.crate % level.w) * cell;
      const y = ((coop.crate / level.w) | 0) * cell;
      c.fillStyle = CRATE_FILL;
      roundRect(c, x + cell * 0.1, y + cell * 0.1, cell * 0.8, cell * 0.8, cell * 0.12);
      c.fill();
      c.strokeStyle = CRATE_EDGE;
      c.lineWidth = Math.max(1.5, cell * 0.06);
      c.stroke();
      c.beginPath();
      c.moveTo(x + cell * 0.1, y + cell * 0.1);
      c.lineTo(x + cell * 0.9, y + cell * 0.9);
      c.moveTo(x + cell * 0.9, y + cell * 0.1);
      c.lineTo(x + cell * 0.1, y + cell * 0.9);
      c.stroke();
    }
  }

  /** 机关联动的光路提示:开关 → 它管的那扇门 */
  function drawLinks(c: CanvasRenderingContext2D, cell: number, power: number): void {
    if (links.length === 0) return;
    c.save();
    c.setLineDash([cell * 0.16, cell * 0.14]);
    c.lineWidth = Math.max(1, cell * 0.05);
    for (const link of links) {
      const on = ((power >> link.group) & 1) === 1;
      c.strokeStyle = on ? "#E4A828" : "#C4BBDD";
      c.beginPath();
      c.moveTo((link.from % level.w) * cell + cell / 2, ((link.from / level.w) | 0) * cell + cell / 2);
      c.lineTo((link.to % level.w) * cell + cell / 2, ((link.to / level.w) | 0) * cell + cell / 2);
      c.stroke();
    }
    c.restore();
  }

  /** 双人集合点:竖光带 + 程序化飘动小旗(900ms sin;reduced 静止旗) */
  function drawCheckpoints(c: CanvasRenderingContext2D, cell: number, now: number): void {
    for (let i = 0; i < cps.columns.length; i++) {
      const x = cps.columns[i] * cell;
      const lit = i <= reached;
      c.save();
      c.globalAlpha = lit ? 0.32 : 0.16;
      c.fillStyle = lit ? "#FFD98A" : "#C4BBDD";
      c.fillRect(x + cell * 0.42, 0, cell * 0.16, level.h * cell);
      c.restore();
      // 旗杆
      const px = x + cell * 0.4;
      const top = cell * 0.18;
      c.strokeStyle = lit ? "#B98A2C" : "#9C93BC";
      c.lineWidth = Math.max(1.5, cell * 0.05);
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(px, top);
      c.lineTo(px, top + cell * 0.62);
      c.stroke();
      // 三角旗:随 flagWave 上下摆尾
      const w = flagWave(now, reduced);
      c.fillStyle = lit ? "#FFD98A" : "#C4BBDD";
      c.beginPath();
      c.moveTo(px, top);
      c.quadraticCurveTo(
        px + cell * 0.2,
        top + cell * (0.02 + 0.05 * w),
        px + cell * 0.4,
        top + cell * (0.1 + 0.07 * w)
      );
      c.quadraticCurveTo(px + cell * 0.2, top + cell * (0.18 + 0.04 * w), px, top + cell * 0.26);
      c.closePath();
      c.fill();
      c.strokeStyle = lit ? "#E4A828" : "#B5A9CE";
      c.lineWidth = Math.max(1, cell * 0.035);
      c.stroke();
    }
  }

  /**
   * 双主角(四·补二工序单):共用 `drawHeroFigure` 骨架、两套参数。
   * 凛凛 = 水滴剪影 + 雪晶发饰 + 围巾;焰焰 = 火苗剪影 + 火簇发型 + 腰带 ——
   * 16px 灰度下剪影 / 头饰 / 附件三通道都分得开。
   * 判定格与半径没动:锚点仍是 1.2 的 `cy = y + cell*0.56`、`r = cell*0.33`。
   */
  function drawHero(c: CanvasRenderingContext2D, hero: Hero, cell: number, now: number): void {
    const v = views[hero];
    const at = heroScreenPos(hero, now);
    const cloud = now < v.cloudUntil;
    const x = at.x * cell;
    const y = at.y * cell - at.lift;
    const dark = hero === "ice" ? ICE_DARK : FIRE_DARK;
    const flash = !reduced && now - v.flash < 400;
    const cx = x + cell / 2;
    const cy = y + cell * 0.56;
    const r = cell * 0.33;

    if (cloud) {
      // 借位小云朵:换个地方接着玩,没有任何「撑不住」的画法(判定与时序不变)
      drawCloudBuddy(c, cx, cy, r, dark);
      return;
    }

    drawHeroFigure(c, {
      kind: hero,
      cx,
      cy,
      r,
      nowMs: now,
      reduced,
      moving: v.glide.queue.length > 0,
      jumping: at.lift > 0,
      leanX: v.facing === DIR_RIGHT ? 1 : v.facing === DIR_LEFT ? -1 : 0,
      flash,
      shadow: true,
    });

    // 当前控制角色的虚线圈(功能件,数值与 1.2 一个不差)
    if (isControlled(soloState, hero)) {
      drawControlRing(c, cx, cy, r, dark, cell);
    }
  }

  /** 拉到头还框不住同伴时,在画面边缘给一个「另一位在这边」的箭头 */
  function drawArrows(c: CanvasRenderingContext2D): void {
    for (const arrow of lastArrows) {
      const inset = CAMERA.ARROW_INSET_PX;
      const halfW = viewW / 2 - inset;
      const halfH = viewH / 2 - inset;
      const scale = Math.min(
        Math.abs(arrow.dx) > 1e-6 ? halfW / Math.abs(arrow.dx) : Number.POSITIVE_INFINITY,
        Math.abs(arrow.dy) > 1e-6 ? halfH / Math.abs(arrow.dy) : Number.POSITIVE_INFINITY
      );
      const px = viewW / 2 + arrow.dx * scale;
      const py = viewH / 2 + arrow.dy * scale;
      const tone = arrow.hero === "ice" ? ICE_DARK : FIRE_DARK;
      c.save();
      c.translate(px, py);
      c.rotate(Math.atan2(arrow.dy, arrow.dx));
      c.beginPath();
      c.moveTo(11, 0);
      c.lineTo(-8, -8);
      c.lineTo(-8, 8);
      c.closePath();
      // 白色衬边:装饰层再密,功能箭头也糊不掉(只精修描边,不动逻辑)
      c.strokeStyle = "#ffffffd9";
      c.lineWidth = 3;
      c.lineJoin = "round";
      c.stroke();
      c.fillStyle = tone;
      c.fill();
      c.restore();
      c.font = "900 11px system-ui";
      c.textAlign = "center";
      c.textBaseline = "middle";
      const lx = Math.max(46, Math.min(viewW - 46, px));
      const ly = Math.max(12, Math.min(viewH - 10, py + 16));
      c.strokeStyle = "#ffffffd9";
      c.lineWidth = 3;
      c.lineJoin = "round";
      c.strokeText(arrowLabel(arrow.hero), lx, ly);
      c.fillStyle = tone;
      c.fillText(arrowLabel(arrow.hero), lx, ly);
    }
  }

  /**
   * 背景视差:三层**森林**远景按 0.18 / 0.34 / 0.55 的比例跟着镜头挪
   * (比例是 1.2 的原值,一个不动;1.3 只把三排白圆换成
   * 远层雾色树冠 / 中层冷暖树干与蘑菇 / 近层草叶藤蔓)。
   * 纯装饰,一格判定都不碰;装饰层饱和度压在主体层 70% 以下,不抢机关可读性。
   */
  function drawParallax(c: CanvasRenderingContext2D, cell: number): void {
    c.save();
    // 冰火半场色温:左冷右暖、中缝渐变。锚在世界坐标上,跟着镜头走
    const worldX0 = viewW / 2 - camX * cell;
    const tint = c.createLinearGradient(worldX0, 0, worldX0 + level.w * cell, 0);
    tint.addColorStop(0, IFF_TINT_COLD);
    tint.addColorStop(0.42, IFF_TINT_COLD);
    tint.addColorStop(0.58, IFF_TINT_WARM);
    tint.addColorStop(1, IFF_TINT_WARM);
    c.fillStyle = tint;
    c.fillRect(0, 0, viewW, viewH);

    const span = Math.max(72, cell * 3.4);
    const draws = [drawForestFar, drawForestMid, drawForestNear] as const;
    for (let i = 0; i < IFF_PARALLAX_DEPTHS.length; i++) {
      const shift = -camX * cell * IFF_PARALLAX_DEPTHS[i];
      const baseY = viewH * IFF_PARALLAX_TOPS[i];
      draws[i](c, shift, viewW, viewH, baseY, span * (1 - i * 0.16));
    }
    c.restore();
  }

  function render(now: number): void {
    const c = canvas.getContext("2d");
    if (!c) return;
    const power = computePower(level, st);
    const light = computeLight(level, st, power);
    const cell = camCell;

    const grad = c.createLinearGradient(0, 0, 0, viewH);
    grad.addColorStop(0, palette.bg0);
    grad.addColorStop(1, palette.bg1);
    c.fillStyle = grad;
    c.fillRect(0, 0, viewW, viewH);
    drawParallax(c, cell);

    const offX = viewW / 2 - camX * cell;
    const offY = viewH / 2 - camY * cell;
    c.save();
    c.translate(offX, offY);

    const x0 = Math.max(0, Math.floor(-offX / cell) - 1);
    const x1 = Math.min(level.w - 1, Math.ceil((viewW - offX) / cell) + 1);
    const y0 = Math.max(0, Math.floor(-offY / cell) - 1);
    const y1 = Math.min(level.h - 1, Math.ceil((viewH - offY) / cell) + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) drawTile(c, y * level.w + x, cell, power, light, now);
    }

    drawCheckpoints(c, cell, now);
    drawLinks(c, cell, power);
    drawKit(c, cell);

    if (level.emitters.length > 0) {
      const beam = traceBeam(level, st, power);
      c.save();
      c.globalAlpha = 0.75;
      c.fillStyle = BEAM_COLOR;
      for (const p of beam) {
        const bx = (p % level.w) * cell;
        const by = ((p / level.w) | 0) * cell;
        c.fillRect(bx + cell * 0.36, by + cell * 0.36, cell * 0.28, cell * 0.28);
      }
      c.restore();
    }

    drawHero(c, "ice", cell, now);
    drawHero(c, "fire", cell, now);

    // 粒子层(图层序 ⑧):开门尘土,压在主角之上、功能件之下
    dustFx.step(now);
    dustFx.draw(c, cell, now);
    c.restore();

    drawArrows(c);
  }

  // ---- 主循环 -------------------------------------------------------------
  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const dt = lastFrame === 0 ? 16 : Math.min(FEEL.MAX_FRAME_MS, now - lastFrame);
    lastFrame = now;
    if (!paused && !finished) {
      elapsed += dt / 1000;
      for (const hero of ["ice", "fire"] as const) {
        // 同伴踩在托举点上的这一刻记下来,走开之后还认 90ms(土狼时间)
        const other = hero === "ice" ? st.fire : st.ice;
        if (level.tiles[other] === TILE.LIFT_PAD) views[hero].lastSupported = now;
        pumpHero(hero, now);
      }
      if (elapsed >= analysis.limitSeconds) settleLose();
      const shown = chipTime.textContent ?? "";
      if (!shown.startsWith(`⏱ ${formatClock(elapsed)}`)) refreshHud();
    }
    stepGlide(views.ice.glide, dt, level.w);
    stepGlide(views.fire.glide, dt, level.w);
    updateCamera(now, dt);
    render(now);
  }

  let ro: ResizeObserver | null = null;
  function onResize(): void {
    layout();
  }
  if (typeof ResizeObserver === "function") {
    ro = new ResizeObserver(onResize);
    ro.observe(stage);
  }
  window.addEventListener("resize", onResize);

  const motionQuery =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  function onMotionChange(): void {
    reduced = prefersReducedMotion();
  }
  motionQuery?.addEventListener?.("change", onMotionChange);

  layout();
  refreshHud();
  const kitLine = kit.kinds.length > 0 ? COOP_HINTS[kit.kinds[kit.kinds.length - 1]] : "";
  say(`第 ${ctx.level + 1} 关开始。${analysis.hint}${kitLine}`);
  raf = requestAnimationFrame(frame);

  return {
    pause(): void {
      setPaused(true);
    },
    resume(): void {
      setPaused(false);
    },
    destroy(): void {
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      motionQuery?.removeEventListener?.("change", onMotionChange);
      ro?.disconnect();
      ro = null;
      held.clear();
      views.ice.glide.queue.length = 0;
      views.fire.glide.queue.length = 0;
      lastArrows = [];
      dustFx.reset();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 直达第 N 关
// ---------------------------------------------------------------------------

/**
 * 地址栏上的 `?level=N`(1 基)。
 * 壳层给了 `initialLevel` 就用壳层的,没给才看地址栏 —— 和仓库里其它几款同一套约定。
 */
export function levelFromQuery(search: string | null): number | null {
  if (!search) return null;
  const raw = new URLSearchParams(search).get("level");
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
}

export interface IceFireForestHandle {
  /** 平台「直达第 N 关」(1 基),返回真正打开的那一关 */
  openCampaignLevel: (n: number) => number;
  destroy: () => void;
  pause: () => void;
  resume: () => void;
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

export function mount(api: GameApi): IceFireForestHandle {
  ensureCss(api.root);

  const root = document.createElement("div");
  const levelHost = document.createElement("div");
  const directHost = document.createElement("div");
  directHost.hidden = true;
  root.append(levelHost, directHost);
  api.root.appendChild(root);

  let current: LevelRuntime | null = null;
  let direct: { destroy: () => void } | null = null;

  function closeDirect(): void {
    direct?.destroy();
    direct = null;
    directHost.hidden = true;
    directHost.innerHTML = "";
    levelHost.hidden = false;
  }

  /**
   * 直达第 i 关(0 基)。
   *
   * 选关地图走的是平台 `mountLevelGame`,它只吐一个 `destroy`,
   * 没有「从第 N 关开始」的口子,所以本款自己开一条:
   * 把这一关单独摆在一个小外壳里,过关 / 没过都能接着走,也能回选关。
   */
  function openDirectLevel(i: number): void {
    closeDirect();
    levelHost.hidden = true;
    directHost.hidden = false;
    directHost.innerHTML = "";

    const shell = document.createElement("div");
    shell.className = "iff-shell";
    const head = document.createElement("div");
    head.className = "iff-shellhead";
    const title = document.createElement("span");
    title.className = "iff-shelltitle";
    const ci = chapterOf(CHAPTERS, i);
    const ch: Chapter = CHAPTERS[ci];
    title.textContent = `${ch.emoji} ${ch.name} · 第 ${i + 1} 关`;
    const back = document.createElement("button");
    back.type = "button";
    back.className = "iff-btn iff-btn--ghost";
    back.textContent = "🗺️ 回选关";
    back.addEventListener("click", () => {
      api.play("tap");
      closeDirect();
    });
    head.append(title, back);

    let settled = false;

    // 跳关走平台那道家长门:选关地图上本来就有一颗(188 框架自带),
    // 直达进来的这条路以前没有 —— 卡住的孩子从家长发的链接点进来会出不去。
    // 壳层没注册 requestSkip 就干脆不挂按钮,单测环境保持干净。
    const askSkip = getLevelExtras().requestSkip;
    if (askSkip && i < TOTAL_LEVELS - 1) {
      const skipBtn = document.createElement("button");
      skipBtn.type = "button";
      skipBtn.className = "iff-btn iff-btn--ghost";
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
            openDirectLevel(Math.min(TOTAL_LEVELS - 1, i + 1));
          })
          .finally(() => {
            asking = false;
            skipBtn.disabled = false;
          });
      });
      head.appendChild(skipBtn);
    }

    const stage = document.createElement("div");
    shell.append(head, stage);
    directHost.appendChild(shell);

    function overlay(text: string, buttons: Array<{ label: string; go: () => void }>): void {
      const box = document.createElement("div");
      box.className = "iff-over";
      const line = document.createElement("div");
      line.textContent = text;
      box.appendChild(line);
      for (const b of buttons) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "iff-btn";
        btn.textContent = b.label;
        btn.addEventListener("click", () => {
          api.play("tap");
          b.go();
        });
        box.appendChild(btn);
      }
      stage.appendChild(box);
    }

    const analysis = analyzeLevel(i);
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
        runtime?.destroy?.();
        runtime = null;
        const buttons: Array<{ label: string; go: () => void }> = [];
        if (i + 1 < TOTAL_LEVELS) buttons.push({ label: "▶ 下一关", go: () => openDirectLevel(i + 1) });
        buttons.push({ label: "🔁 再玩一次", go: () => openDirectLevel(i) });
        buttons.push({ label: "🗺️ 回选关", go: closeDirect });
        overlay(`⭐ 第 ${i + 1} 关过关!${msg ?? ""}`, buttons);
      },
      lose: (msg) => {
        if (settled) return;
        settled = true;
        api.play("oops");
        runtime?.destroy?.();
        runtime = null;
        overlay(msg ?? "再来一次一定行!", [
          { label: "🔁 再试一次", go: () => openDirectLevel(i) },
          { label: "🗺️ 回选关", go: closeDirect },
        ]);
      },
      sfx: (name) => api.play(name),
      bonusStars: (n) => api.addStars(n),
    };

    let runtime: LevelRuntime | null = playLevel(stage, ctx, analysis);
    current = runtime;
    direct = {
      destroy(): void {
        if (current === runtime) current = null;
        runtime?.destroy?.();
        runtime = null;
      },
    };
  }

  function openCampaignLevel(n: number): number {
    const i = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.round(n) - 1));
    openDirectLevel(i);
    return i + 1;
  }

  const handle = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      guide: GUIDE,
      guideTitle: GUIDE.title,
      mapHint: "两个人各走各的路,最后一起进门;一个人玩就按 Tab 换角色。",
      grandMessage: "188 关全部走通,冰冰火火森林最深处的门为你们打开了!",
      playLevel(stage, ctx) {
        const analysis = analyzeLevel(ctx.level);
        const runtime = playLevel(stage, ctx, analysis);
        current = runtime;
        return {
          destroy(): void {
            if (current === runtime) current = null;
            runtime.destroy?.();
          },
        };
      },
    }
  );

  // 壳层给了 `initialLevel` 就听壳层的,没给才看地址栏 `?level=`
  const jumpTo =
    (api as { initialLevel?: number }).initialLevel ??
    levelFromQuery(typeof location === "object" ? location.search : null);
  if (jumpTo !== null && jumpTo !== undefined) openCampaignLevel(jumpTo);

  return {
    openCampaignLevel,
    destroy(): void {
      closeDirect();
      current = null;
      handle.destroy();
      root.remove();
    },
    pause(): void {
      current?.pause();
    },
    resume(): void {
      current?.resume();
    },
  };
}
