import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, GUIDE, analyzeLevel, type LevelAnalysis } from "./levels";
import {
  DIR_DOWN,
  DIR_LEFT,
  DIR_RIGHT,
  DIR_UP,
  HERO_SHORT,
  MAX_HEARTS,
  POWER_CHARGES,
  POWER_CHARGES_MAX,
  TILE,
  computeLight,
  computePower,
  gemOwner,
  initialState,
  isAdjacent,
  isWin,
  loseLine,
  moveHero,
  parseLevel,
  rateRun,
  traceBeam,
  useElementPower,
  winLine,
  type GameState,
  type Gem,
  type Hero,
  type ParsedLevel,
} from "./logic";

// ---------------------------------------------------------------------------
// 手感常数
// ---------------------------------------------------------------------------

/** 按住方向键时,每走一格的间隔 */
const MOVE_MS = 145;
/** 撞墙之后短暂锁一下,免得按住不放疯狂撞 */
const BUMP_MS = 220;
/** 碰到危险格弹回来的硬直 */
const HURT_MS = 520;
/** 击掌的冷却 */
const HIGH_FIVE_MS = 2600;
/** 格子最大边长(大屏上别把小小的一张图拉得糊掉) */
const MAX_CELL = 44;
/** 棋盘最高占多少像素(留出 HUD 与虚拟按键的位置) */
const MAX_BOARD_H = 360;

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

const ICE_BODY = "#8FD3F4";
const ICE_DARK = "#4FA8D8";
const FIRE_BODY = "#FFB077";
const FIRE_DARK = "#E8763C";
const WATER_FILL = "#B9E4F7";
const WATER_DEEP = "#7FC9EC";
const LAVA_FILL = "#FFC08A";
const LAVA_DEEP = "#F2894A";
const SLIME_FILL = "#B9E08A";
const SLIME_DEEP = "#87BF52";
const BEAM_COLOR = "#FFD34D";

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.iff-wrap{--iff-ink:#4A4266;display:flex;flex-direction:column;gap:8px;align-items:center;
  font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--iff-ink);
  user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.iff-hud{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:center;width:100%;}
.iff-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:800;
  box-shadow:0 2px 5px rgba(120,110,170,.18);white-space:nowrap;}
.iff-chip b{font-weight:900;}
.iff-btn{border:none;border-radius:999px;padding:6px 13px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;color:#fff;background:linear-gradient(180deg,#7E6BC4,#6857AE);box-shadow:0 3px 0 #52458C;}
.iff-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #52458C;}
.iff-btn:focus-visible{outline:3px solid #FFB43C;outline-offset:2px;}
.iff-btn--ghost{background:linear-gradient(180deg,#9DB6D8,#7F9AC3);box-shadow:0 3px 0 #64809F;}
.iff-btn--ghost:active{box-shadow:0 1px 0 #64809F;}
.iff-board{border-radius:18px;overflow:hidden;box-shadow:0 6px 18px rgba(110,100,160,.22);line-height:0;}
.iff-board canvas{display:block;}
.iff-tip{font-size:12.5px;font-weight:700;line-height:1.5;text-align:center;max-width:640px;
  color:#6A5F8C;background:#ffffffcc;border-radius:12px;padding:6px 10px;}
.iff-pads{display:flex;justify-content:space-between;gap:10px;width:100%;max-width:640px;}
.iff-pad{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:4px;}
.iff-pad button{border:none;border-radius:12px;width:42px;height:42px;font-size:17px;font-weight:900;
  cursor:pointer;font-family:inherit;color:#fff;}
.iff-pad button:focus-visible{outline:3px solid #FFB43C;outline-offset:2px;}
.iff-pad--ice button{background:linear-gradient(180deg,#8FD3F4,#5FB4DF);box-shadow:0 3px 0 #4A93BC;}
.iff-pad--fire button{background:linear-gradient(180deg,#FFB077,#F08B4C);box-shadow:0 3px 0 #C96B31;}
.iff-pad button:active{transform:translateY(2px);}
.iff-pad .iff-pad-slot{visibility:hidden;}
.iff-padwrap{display:flex;flex-direction:column;align-items:center;gap:5px;}
.iff-padname{font-size:12px;font-weight:900;}
.iff-padacts{display:flex;gap:5px;}
.iff-padacts button{width:auto;padding:0 11px;height:34px;font-size:12px;}
.iff-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
@media (max-width:420px){
  .iff-pad button{width:38px;height:38px;font-size:15px;}
  .iff-chip{font-size:12px;padding:4px 9px;}
}
@media (prefers-reduced-motion:reduce){
  .iff-btn:active,.iff-pad button:active{transform:none;}
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
// 键位
// ---------------------------------------------------------------------------

/** 朵朵那一套(W A S D + F + G)开凛凛,星星那一套(方向键 + L + K)开焰焰 */
export const KEY_MAP: Record<string, { hero: Hero; action: "up" | "down" | "left" | "right" | "power" | "cheer" }> = {
  KeyW: { hero: "ice", action: "up" },
  KeyS: { hero: "ice", action: "down" },
  KeyA: { hero: "ice", action: "left" },
  KeyD: { hero: "ice", action: "right" },
  KeyF: { hero: "ice", action: "power" },
  KeyG: { hero: "ice", action: "cheer" },
  ArrowUp: { hero: "fire", action: "up" },
  ArrowDown: { hero: "fire", action: "down" },
  ArrowLeft: { hero: "fire", action: "left" },
  ArrowRight: { hero: "fire", action: "right" },
  KeyL: { hero: "fire", action: "power" },
  KeyK: { hero: "fire", action: "cheer" },
};

const ACTION_DIR: Record<string, number> = {
  up: DIR_UP,
  down: DIR_DOWN,
  left: DIR_LEFT,
  right: DIR_RIGHT,
};

/** 两套键位有没有撞车(测试会盯着这一条) */
export function keySetsDisjoint(): boolean {
  const ice = Object.entries(KEY_MAP).filter(([, v]) => v.hero === "ice").map(([k]) => k);
  const fire = Object.entries(KEY_MAP).filter(([, v]) => v.hero === "fire").map(([k]) => k);
  return ice.every((k) => !fire.includes(k));
}

/** HUD 上的时间显示 */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** 门口等人时说的一句话 */
export function waitingLine(iceHome: boolean, fireHome: boolean): string {
  if (iceHome && fireHome) return "两个人都到齐了!";
  if (iceHome) return "凛凛已经站在冰门上,等焰焰过来。";
  if (fireHome) return "焰焰已经站在火门上,等凛凛过来。";
  return "";
}

// ---------------------------------------------------------------------------
// 一关的运行时
// ---------------------------------------------------------------------------

interface HeroView {
  rx: number;
  ry: number;
  queue: number[];
  facing: number;
  cooldownUntil: number;
  charges: number;
  flash: number;
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

  let st: GameState = initialState(level);
  let collected = new Set<number>();
  let hearts = MAX_HEARTS;
  let elapsed = 0;
  let paused = false;
  let finished = false;
  let lastFrame = 0;
  let raf = 0;
  let solo = false;
  let active: Hero = "ice";
  let highFiveAt = -HIGH_FIVE_MS;
  let toast = "";
  let toastUntil = 0;

  const views: Record<Hero, HeroView> = {
    ice: makeView(level, st.ice),
    fire: makeView(level, st.fire),
  };

  function makeView(lv: ParsedLevel, pos: number): HeroView {
    return {
      rx: pos % lv.w,
      ry: (pos / lv.w) | 0,
      queue: [],
      facing: DIR_RIGHT,
      cooldownUntil: 0,
      charges: POWER_CHARGES,
      flash: 0,
    };
  }

  // ---- DOM ----------------------------------------------------------------
  const wrap = document.createElement("div");
  wrap.className = "iff-wrap";

  const hud = document.createElement("div");
  hud.className = "iff-hud";
  const chipTime = chip("⏱ 0:00");
  const chipGems = chip(`💎 0/${totalGems}`);
  const chipHearts = chip("💗 ❤❤❤");
  const chipIce = chip("");
  const chipFire = chip("");
  const soloBtn = document.createElement("button");
  soloBtn.type = "button";
  soloBtn.className = "iff-btn iff-btn--ghost";
  const swapBtn = document.createElement("button");
  swapBtn.type = "button";
  swapBtn.className = "iff-btn";
  swapBtn.textContent = "🔁 换人";
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "iff-btn iff-btn--ghost";
  resetBtn.textContent = "↺ 重摆";
  hud.append(chipTime, chipGems, chipHearts, chipIce, chipFire, soloBtn, swapBtn, resetBtn);

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

  wrap.append(hud, board, tip, pads, status);
  stage.appendChild(wrap);

  function chip(text: string): HTMLSpanElement {
    const el = document.createElement("span");
    el.className = "iff-chip";
    el.textContent = text;
    return el;
  }

  // ---- 虚拟按键 ------------------------------------------------------------
  const held = new Set<string>();

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
    const cells: Array<{ label: string; action?: string }> = [
      { label: "" },
      { label: "▲", action: "up" },
      { label: "" },
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
    const acts = document.createElement("div");
    acts.className = "iff-padacts";
    const powerBtn = document.createElement("button");
    powerBtn.type = "button";
    powerBtn.textContent = hero === "ice" ? "❄ 冻" : "🔥 烤";
    powerBtn.setAttribute(
      "aria-label",
      hero === "ice" ? "凛凛把面前的岩浆冻成冰桥" : "焰焰把面前的冰水烤干"
    );
    powerBtn.addEventListener("click", () => doPower(hero));
    const cheerBtn = document.createElement("button");
    cheerBtn.type = "button";
    cheerBtn.textContent = "🤝 击掌";
    cheerBtn.setAttribute("aria-label", `${HERO_SHORT[hero]}和同伴击掌,补一发元素之力`);
    cheerBtn.addEventListener("click", () => doCheer());
    acts.append(powerBtn, cheerBtn);
    box.append(name, grid, acts);
    return { el: box, name };
  }

  function dirWord(action: string): string {
    return action === "up" ? "上" : action === "down" ? "下" : action === "left" ? "左" : "右";
  }

  function bindHold(btn: HTMLButtonElement, hero: Hero, action: string): void {
    const key = `${hero}:${action}`;
    const on = (e: Event): void => {
      e.preventDefault();
      held.add(key);
    };
    const off = (): void => {
      held.delete(key);
    };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointercancel", off);
    btn.addEventListener("pointerleave", off);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        held.add(key);
      }
    });
    btn.addEventListener("keyup", off);
    btn.addEventListener("blur", off);
  }

  // ---- 键盘 ---------------------------------------------------------------
  function onKeyDown(e: KeyboardEvent): void {
    if (finished) return;
    if (e.code === "Tab") {
      if (!solo) return;
      e.preventDefault();
      swapHero();
      return;
    }
    const bind = KEY_MAP[e.code];
    if (!bind) return;
    e.preventDefault();
    const hero = solo ? active : bind.hero;
    if (bind.action === "power") {
      doPower(hero);
      return;
    }
    if (bind.action === "cheer") {
      doCheer();
      return;
    }
    held.add(`${hero}:${bind.action}`);
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
  function swapHero(): void {
    active = active === "ice" ? "fire" : "ice";
    held.clear();
    ctx.sfx("tap");
    say(`现在控制${HERO_SHORT[active]}`);
    refreshHud();
  }

  function setSolo(next: boolean): void {
    solo = next;
    held.clear();
    ctx.sfx("tap");
    say(solo ? `单人模式,现在控制${HERO_SHORT[active]},按 Tab 换人` : "双人模式,两套键位各管一位");
    refreshHud();
  }

  soloBtn.addEventListener("click", () => setSolo(!solo));
  swapBtn.addEventListener("click", () => {
    if (!solo) setSolo(true);
    else swapHero();
  });
  resetBtn.addEventListener("click", () => resetLevel());

  function resetLevel(): void {
    const fresh = parseLevel(analysis.grid);
    level.tiles.set(fresh.tiles);
    level.aux.set(fresh.aux);
    st = initialState(level);
    collected = new Set<number>();
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

  function doCheer(): void {
    if (finished || paused) return;
    const now = performance.now();
    if (now - highFiveAt < HIGH_FIVE_MS) return;
    if (!isAdjacent(level, st)) {
      flashToast("要挨在一起才击得到掌哦");
      return;
    }
    highFiveAt = now;
    let gained = false;
    for (const hero of ["ice", "fire"] as const) {
      if (views[hero].charges < POWER_CHARGES_MAX) {
        views[hero].charges++;
        gained = true;
      }
    }
    ctx.sfx("coin");
    views.ice.flash = now;
    views.fire.flash = now;
    say(gained ? "击掌成功,元素之力补了一发" : "击掌!两个人都满着呢");
    refreshHud();
  }

  function flashToast(text: string): void {
    toast = text;
    toastUntil = performance.now() + 2200;
    tip.textContent = text;
  }

  function say(text: string): void {
    status.textContent = text;
  }

  // ---- 走一步 -------------------------------------------------------------
  function tryStep(hero: Hero, dir: number, now: number): void {
    const view = views[hero];
    if (now < view.cooldownUntil) return;
    view.facing = dir;
    const out = moveHero(level, st, hero, dir);
    if (out.kind === "solid") {
      view.cooldownUntil = now + BUMP_MS;
      return;
    }
    if (out.kind === "hurt") {
      view.cooldownUntil = now + HURT_MS;
      view.flash = now;
      hearts--;
      ctx.sfx("oops");
      say(
        hero === "ice"
          ? "凛凛碰到了不该碰的地方,被弹回来了"
          : "焰焰碰到了不该碰的地方,被弹回来了"
      );
      refreshHud();
      if (hearts <= 0) settleLose("hearts");
      return;
    }
    st = out.state;
    view.cooldownUntil = now + MOVE_MS;
    views.ice.queue.push(...out.icePath);
    views.fire.queue.push(...out.firePath);
    ctx.sfx("tap");
    pickUpGems();
    refreshHud();
    if (isWin(level, st)) settleWin();
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

  function settleLose(reason: "time" | "hearts"): void {
    if (finished) return;
    finished = true;
    ctx.lose(loseLine(reason));
  }

  // ---- HUD ---------------------------------------------------------------
  function refreshHud(): void {
    chipTime.textContent = `⏱ ${formatClock(elapsed)} / ${formatClock(analysis.limitSeconds)}`;
    chipGems.textContent = `💎 ${collected.size}/${totalGems}`;
    chipHearts.textContent = `💗 ${"❤".repeat(Math.max(0, hearts))}${"·".repeat(Math.max(0, MAX_HEARTS - hearts))}`;
    chipIce.textContent = `❄ 凛凛 ${views.ice.charges}`;
    chipIce.style.color = ICE_DARK;
    chipFire.textContent = `🔥 焰焰 ${views.fire.charges}`;
    chipFire.style.color = FIRE_DARK;
    soloBtn.textContent = solo ? "🙋 单人中" : "👥 双人中";
    soloBtn.setAttribute("aria-pressed", solo ? "true" : "false");
    swapBtn.textContent = solo ? `🔁 换人(现在是${HERO_SHORT[active]})` : "🙋 一个人玩";
    icePad.name.textContent = solo && active !== "ice" ? "凛凛(待命)" : "凛凛";
    firePad.name.textContent = solo && active !== "fire" ? "焰焰(待命)" : "焰焰";
    if (performance.now() > toastUntil) {
      const wait = waitingLine(st.ice === level.iceDoor, st.fire === level.fireDoor);
      tip.textContent = wait || analysis.hint;
      toast = "";
    }
  }

  // ---- 画面 ---------------------------------------------------------------
  let cell = 24;

  function layout(): void {
    const availW = Math.max(200, (stage.clientWidth || 340) - 8);
    cell = Math.max(
      14,
      Math.floor(Math.min(availW / level.w, MAX_BOARD_H / level.h, MAX_CELL))
    );
    const dpr = Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1);
    canvas.width = Math.round(level.w * cell * dpr);
    canvas.height = Math.round(level.h * cell * dpr);
    canvas.style.width = `${level.w * cell}px`;
    canvas.style.height = `${level.h * cell}px`;
    const c = canvas.getContext("2d");
    if (c) c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

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

  function drawTile(c: CanvasRenderingContext2D, pos: number, power: number, light: boolean): void {
    const x = (pos % level.w) * cell;
    const y = ((pos / level.w) | 0) * cell;
    const t = level.tiles[pos];
    const a = level.aux[pos];
    const pad = Math.max(1, cell * 0.06);

    if (t !== TILE.WALL) {
      c.fillStyle = palette.floor;
      c.fillRect(x, y, cell, cell);
      c.strokeStyle = palette.floorLine;
      c.lineWidth = 1;
      c.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
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
        fillPool(c, x, y, WATER_FILL, WATER_DEEP, pad);
        break;
      case TILE.LAVA:
        fillPool(c, x, y, LAVA_FILL, LAVA_DEEP, pad);
        break;
      case TILE.SLIME:
        fillPool(c, x, y, SLIME_FILL, SLIME_DEEP, pad);
        c.fillStyle = "#6FA53E";
        dot(c, x + cell * 0.35, y + cell * 0.4, cell * 0.07);
        dot(c, x + cell * 0.66, y + cell * 0.6, cell * 0.06);
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
        c.fillStyle = ice ? ICE_DARK : FIRE_DARK;
        c.font = `${Math.round(cell * 0.46)}px system-ui`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(ice ? "❄" : "🔥", x + cell / 2, y + cell * 0.54);
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
        groupMark(c, x, y, a, on);
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
        groupMark(c, x, y, a, on);
        break;
      }
      case TILE.GATE:
      case TILE.SEESAW: {
        const powered = ((power >> a) & 1) === 1;
        const open = t === TILE.GATE ? powered : !powered;
        drawGate(c, x, y, open, t === TILE.SEESAW);
        groupMark(c, x, y, a, open);
        break;
      }
      case TILE.LIGHT_GATE:
        drawGate(c, x, y, light, false, BEAM_COLOR);
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
        c.fillStyle = "#8C6FB8";
        c.font = `${Math.round(cell * 0.36)}px system-ui`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("🤲", x + cell / 2, y + cell * 0.56);
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
    if (gem && !collected.has(pos)) drawGem(c, x, y, gem);
  }

  function fillPool(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    fill: string,
    deep: string,
    pad: number
  ): void {
    c.fillStyle = fill;
    roundRect(c, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.22);
    c.fill();
    c.strokeStyle = deep;
    c.lineWidth = Math.max(1.5, cell * 0.07);
    c.beginPath();
    c.moveTo(x + cell * 0.24, y + cell * 0.62);
    c.quadraticCurveTo(x + cell * 0.42, y + cell * 0.48, x + cell * 0.56, y + cell * 0.62);
    c.quadraticCurveTo(x + cell * 0.68, y + cell * 0.74, x + cell * 0.78, y + cell * 0.6);
    c.stroke();
  }

  function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }

  function groupMark(c: CanvasRenderingContext2D, x: number, y: number, group: number, on: boolean): void {
    c.fillStyle = on ? "#B5761A" : "#8C7FB4";
    c.font = `900 ${Math.round(cell * 0.26)}px system-ui`;
    c.textAlign = "left";
    c.textBaseline = "top";
    c.fillText(String(group + 1), x + cell * 0.1, y + cell * 0.06);
  }

  function drawGate(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    open: boolean,
    seesaw: boolean,
    tone?: string
  ): void {
    const base = tone ?? (seesaw ? "#D7A8C4" : "#A79AD0");
    if (open) {
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
    c.strokeStyle = "#ffffff88";
    c.lineWidth = Math.max(2, cell * 0.07);
    for (let i = 1; i <= 3; i++) {
      const gx = x + (cell * i) / 4;
      c.beginPath();
      c.moveTo(gx, y + cell * 0.12);
      c.lineTo(gx, y + cell * 0.88);
      c.stroke();
    }
  }

  function drawGem(c: CanvasRenderingContext2D, x: number, y: number, gem: Gem): void {
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
  }

  function drawHero(c: CanvasRenderingContext2D, hero: Hero, now: number): void {
    const v = views[hero];
    const x = v.rx * cell;
    const y = v.ry * cell;
    const body = hero === "ice" ? ICE_BODY : FIRE_BODY;
    const dark = hero === "ice" ? ICE_DARK : FIRE_DARK;
    const hurt = now - v.flash < 400;
    const cx = x + cell / 2;
    const cy = y + cell * 0.56;
    const r = cell * 0.33;

    c.fillStyle = "rgba(90,80,130,.16)";
    c.beginPath();
    c.ellipse(cx, y + cell * 0.9, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = hurt ? "#FFFFFF" : body;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = dark;
    c.lineWidth = Math.max(1.5, cell * 0.06);
    c.stroke();

    // 头顶的小尖:凛凛是雪花簇,焰焰是火苗
    c.fillStyle = dark;
    c.beginPath();
    if (hero === "ice") {
      c.moveTo(cx - r * 0.5, cy - r * 0.8);
      c.lineTo(cx, cy - r * 1.6);
      c.lineTo(cx + r * 0.5, cy - r * 0.8);
    } else {
      c.moveTo(cx - r * 0.45, cy - r * 0.85);
      c.quadraticCurveTo(cx - r * 0.1, cy - r * 1.8, cx + r * 0.45, cy - r * 0.85);
    }
    c.closePath();
    c.fill();

    c.fillStyle = "#3B3358";
    dot(c, cx - r * 0.34, cy - r * 0.1, Math.max(1.2, r * 0.13));
    dot(c, cx + r * 0.34, cy - r * 0.1, Math.max(1.2, r * 0.13));
    c.strokeStyle = "#3B3358";
    c.lineWidth = Math.max(1, cell * 0.045);
    c.beginPath();
    c.arc(cx, cy + r * 0.18, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
    c.stroke();

    const controlled = !solo || active === hero;
    if (controlled) {
      c.strokeStyle = dark;
      c.lineWidth = Math.max(2, cell * 0.07);
      c.setLineDash([cell * 0.1, cell * 0.09]);
      c.beginPath();
      c.arc(cx, cy, r * 1.42, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
  }

  function render(now: number): void {
    const c = canvas.getContext("2d");
    if (!c) return;
    const power = computePower(level, st);
    const light = computeLight(level, st, power);

    const grad = c.createLinearGradient(0, 0, 0, level.h * cell);
    grad.addColorStop(0, palette.bg0);
    grad.addColorStop(1, palette.bg1);
    c.fillStyle = grad;
    c.fillRect(0, 0, level.w * cell, level.h * cell);

    for (let pos = 0; pos < level.w * level.h; pos++) drawTile(c, pos, power, light);

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

    drawHero(c, "ice", now);
    drawHero(c, "fire", now);
  }

  // ---- 主循环 -------------------------------------------------------------
  function advanceView(hero: Hero, dt: number): void {
    const v = views[hero];
    if (v.queue.length === 0) return;
    const speed = (1000 / MOVE_MS) * Math.max(1, v.queue.length);
    let budget = (speed * dt) / 1000;
    while (budget > 0 && v.queue.length > 0) {
      const target = v.queue[0];
      const tx = target % level.w;
      const ty = (target / level.w) | 0;
      const dx = tx - v.rx;
      const dy = ty - v.ry;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist <= budget || dist < 0.001) {
        v.rx = tx;
        v.ry = ty;
        budget -= dist;
        v.queue.shift();
      } else {
        v.rx += (dx / dist) * budget;
        v.ry += (dy / dist) * budget;
        budget = 0;
      }
    }
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const dt = lastFrame === 0 ? 16 : Math.min(64, now - lastFrame);
    lastFrame = now;
    if (!paused && !finished) {
      elapsed += dt / 1000;
      for (const hero of ["ice", "fire"] as const) {
        for (const action of ["up", "down", "left", "right"] as const) {
          if (held.has(`${hero}:${action}`)) {
            tryStep(hero, ACTION_DIR[action], now);
            break;
          }
        }
      }
      if (elapsed >= analysis.limitSeconds) settleLose("time");
      if (toast && now > toastUntil) refreshHud();
      const shown = chipTime.textContent ?? "";
      if (!shown.startsWith(`⏱ ${formatClock(elapsed)}`)) refreshHud();
    }
    advanceView("ice", dt);
    advanceView("fire", dt);
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

  layout();
  refreshHud();
  say(`第 ${ctx.level + 1} 关开始。${analysis.hint}`);
  raf = requestAnimationFrame(frame);

  return {
    pause(): void {
      paused = true;
      held.clear();
    },
    resume(): void {
      paused = false;
      lastFrame = 0;
    },
    destroy(): void {
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      ro = null;
      held.clear();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void; pause: () => void; resume: () => void } {
  let current: LevelRuntime | null = null;

  const handle = mountLevelGame(api, {
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
  });

  return {
    destroy(): void {
      current = null;
      handle.destroy();
    },
    pause(): void {
      current?.pause();
    },
    resume(): void {
      current?.resume();
    },
  };
}
