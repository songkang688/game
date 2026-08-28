import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import { CHAPTERS, LEVELS, type BubbleLevel } from "./levels";
import {
  BIG_GROUP,
  BubbleBag,
  CHAIN,
  type CollapsePlan,
  SEA_ROWS,
  blowShuffle,
  chainBlast,
  groupScore,
  isChain,
  phaseAt,
  planCollapse,
  previewLabel,
  pushUpRow,
  seaColors,
  seaFrozen,
  seaTideRows,
  seaLine,
  seaPushMs,
  visualColAt,
  visualRowAt,
} from "./collapse";
import {
  BOLT,
  CHAMELEON_BASE,
  colorOf,
  countLeftOn,
  cycleChameleons,
  FROZEN_OFFSET,
  groupAt,
  hasMovesOn,
  HIDDEN_OFFSET,
  isChameleon,
  isFrozen,
  isHidden,
  RAINBOW,
  revealHidden,
  STONE,
} from "./logic";
import { BP_DECOR, BP_TIMINGS, bpBurstDelayMs, bpBurstLifeMs, bpCellSkin, bpIsTiny, bpVisualCss, bpWeedsSvg } from "./visual";

const COLS = 8;
/** 一关里最多帮孩子「吹气重排」几次，之后才收局（重排不扣分） */
const MAX_SHUFFLE = 3;

const CSS = `
.bp-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.bp-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.bp-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #4FA3C7; box-shadow: 0 2px 6px rgba(100,170,210,.25); font-size: 14px; }
.bp-board { display: grid; grid-template-columns: repeat(${COLS}, 1fr); gap: 4px; }
.bp-cell { aspect-ratio: 1; border: none; border-radius: 50%; cursor: pointer; transition: opacity .2s; padding: 0; font-size: clamp(12px, 3.6vw, 20px); display: flex; align-items: center; justify-content: center; min-width: 36px; }
.bp-cell.bp-empty { background: transparent !important; box-shadow: none !important; cursor: default; }
.bp-msg { text-align: center; min-height: 22px; color: #4FA3C7; font-weight: 700; margin-top: 10px; font-size: 15px; line-height: 1.5; }

/* 1.2 塌陷时间线 / 预览高亮 / 泡泡海（bbp- 前缀） */
.bbp-hi { outline: 4px solid #2F7FAF; outline-offset: -4px; filter: brightness(1.15); }
.bbp-pop { animation: bbpPop 180ms ease forwards; }
@keyframes bbpPop { 0% { transform: scale(1); opacity: 1; } 55% { transform: scale(1.22); opacity: .85; } 100% { transform: scale(.2); opacity: 0; } }
.bbp-moving { z-index: 2; }
.bbp-ripple { animation: bbpRipple 420ms ease; }
@keyframes bbpRipple { 0% { box-shadow: 0 0 0 0 rgba(120,190,240,.55); } 100% { box-shadow: 0 0 0 18px rgba(120,190,240,0); } }
.bbp-mark { font-size: .72em; color: #ffffffcc; text-shadow: 0 1px 1px rgba(80,110,140,.45); pointer-events: none; }
.bbp-bar { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 0 0 10px; }
/* display:flex 会压过 hidden 属性的 UA display:none,进关/进模式时模式条要真的让位 */
.bbp-bar[hidden] { display: none; }
.bbp-open { border: none; border-radius: 999px; padding: 9px 18px; font-size: 15px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #6FBEE0, #4E97BD); box-shadow: 0 4px 0 #3B7794; }
.bbp-open:active { transform: translateY(2px); box-shadow: 0 2px 0 #3B7794; }
.bbp-mode { max-width: 680px; margin: 0 auto; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }
.bbp-mhead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 10px; }
.bbp-back { border: none; border-radius: 999px; padding: 7px 13px; font-size: 14px; font-weight: 900; cursor: pointer; font-family: inherit; background: #ffffffd9; color: #3F8FBF; box-shadow: 0 3px 0 rgba(80,150,190,.3); }
.bbp-chip { background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 800; font-size: 14px; color: #3F8FBF; box-shadow: 0 2px 6px rgba(100,170,210,.25); }
.bbp-over { text-align: center; padding: 26px 16px; background: #fff; border-radius: 18px; box-shadow: 0 4px 14px rgba(120,170,200,.25); }
.bbp-over-t { font-size: 22px; font-weight: 900; color: #3F8FBF; margin-bottom: 8px; }
.bbp-over-s { font-size: 15px; font-weight: 700; color: #4FA3C7; line-height: 1.6; margin-bottom: 14px; }
.bbp-line { height: 4px; background: repeating-linear-gradient(90deg, #FF9EC8 0 10px, transparent 10px 20px); border-radius: 2px; margin: 0 0 4px; }
@media (max-width: 380px) { .bp-badge { font-size: 14px; } .bp-board { gap: 5px; } .bbp-chip { font-size: 14px; } }
/* N-82:无尽泡泡海 12 行 × min-width 36 撑出 412。基线 36 保留,矮屏才收格 */
@media (max-height: 500px) {
  .bp-wrap { height: 100%; max-height: calc(100dvh - 108px); min-height: 0; overflow: hidden; display: flex; flex-direction: column; box-sizing: border-box; padding: 8px; }
  .bp-top { flex: 0 0 auto; }
  .bp-board { flex: 1 1 auto; min-height: 0; width: min(100%, calc((100dvh - 148px) * 8 / 12)); max-height: min(240px, calc(100dvh - 148px)); margin: 0 auto; }
  .bp-cell { min-width: 0; min-height: 0; }
  .bp-msg { flex: 0 0 auto; max-height: 1.4em; overflow: hidden; margin-top: 6px; }
}
@media (max-height: 840px) and (min-height:501px) {
  .bp-board { width: min(100%, calc((100dvh - 180px) * 8 / 12)); max-height: min(360px, calc(100dvh - 180px)); margin: 0 auto; }
}
@media (prefers-reduced-motion: reduce) {
  .bbp-pop { animation-duration: 16ms; }
  .bbp-ripple { animation: none; }
}
` + bpVisualCss();

/** 孩子的系统开了「减少动态效果」就把塌陷压到一帧（状态机还是同一个） */
function prefersReduced(): boolean {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

/** 相邻两格中心的间距（塌陷动画把逻辑格差换算成像素位移就靠它） */
function pitchOf(cells: HTMLElement[]): { x: number; y: number } {
  const a = cells[0]?.getBoundingClientRect();
  const right = cells[1]?.getBoundingClientRect();
  const below = cells[COLS]?.getBoundingClientRect();
  return {
    x: a && right ? right.left - a.left : 0,
    y: a && below ? below.top - a.top : 0,
  };
}

/** 把一颗泡泡画到格子上（颜色 + 图案双通道，色觉不敏感也分得清；皮肤参数全在 visual.ts） */
function paintCell(el: HTMLButtonElement, v: number): void {
  el.textContent = "";
  el.classList.toggle("bp-empty", v < 0);
  // dataset 只是给自动冒烟脚本读的状态镜像，不参与玩法
  el.dataset.v = String(v);
  const skin = bpCellSkin(v);
  el.classList.toggle("bp-rainbow", skin.rainbow);
  el.style.background = skin.background;
  el.style.boxShadow = skin.boxShadow;
  if (skin.pattern) {
    const pat = document.createElement("span");
    pat.className = skin.patternClass ? `bp-pat ${skin.patternClass}` : "bp-pat";
    pat.innerHTML = skin.pattern;
    el.appendChild(pat);
  }
  if (skin.mark) {
    const mark = document.createElement("span");
    mark.className = "bbp-mark";
    mark.textContent = skin.mark;
    el.appendChild(mark);
  }
}

function paintBoard(cells: HTMLButtonElement[], grid: number[][], rows: number): void {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) paintCell(cells[r * COLS + c], grid[r][c]);
  }
}

/** 泡径 < 32px 时给容器挂 bp-tiny：副高光 / 铆钉这类点缀省略，纹样保留 */
function syncTiny(container: HTMLElement, cells: HTMLElement[]): void {
  container.classList.toggle("bp-tiny", bpIsTiny(cells[0]?.clientWidth ?? 0));
}

/** 把逻辑终态整片搬进现有盘面（保持数组身份不变，闭包里到处引用它） */
function copyInto(grid: number[][], next: readonly number[][]): void {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < COLS; c++) grid[r][c] = next[r][c];
  }
}

function clearFx(cells: HTMLElement[]): void {
  for (const el of cells) {
    el.style.transform = "";
    el.classList.remove("bbp-moving", "bbp-pop", "bp-ghosted", "bp-jelly");
  }
}

interface CollapseHost {
  rows: number;
  cells: HTMLButtonElement[];
  grid: number[][];
  gravityUp: boolean;
  render: () => void;
  alive: () => boolean;
  onRaf: (id: number) => void;
  /** 破裂幽灵层挂在哪(纯装饰;拿不到就退回 1.2 的整批淡出) */
  board: () => HTMLElement | null;
  /** 装饰清场用的延时(走 BubbleBag,destroy 一把倒干净) */
  after: (fn: () => void, ms: number) => void;
}

/**
 * 破裂三阶段幽灵层:每颗被消的泡泡原位克隆一枚「幽灵」,按曼哈顿距离分波
 * (每波 40ms、上限 6 波、0–12ms 抖动)播「鼓 1.12 倍 → 薄膜白环 → 水珠溅落」。
 * 纯装饰:消除集合、得分、塌陷时间线一概不碰;reduced 或量不出格子位置就不放,
 * 返回 false 让调用方退回 1.2 的 .bbp-pop 淡出。
 */
function spawnBursts(host: CollapseHost, popped: Array<[number, number]>, origin: [number, number]): boolean {
  if (prefersReduced()) return false;
  const board = host.board();
  if (!board || typeof board.getBoundingClientRect !== "function") return false;
  const bRect = board.getBoundingClientRect();
  if (!bRect || bRect.width <= 0) return false;
  let made = false;
  for (const [r, c] of popped) {
    const el = host.cells[r * COLS + c];
    if (!el || typeof el.getBoundingClientRect !== "function") continue;
    const rect = el.getBoundingClientRect();
    if (!rect || rect.width <= 0) continue;
    const delay = bpBurstDelayMs(Math.abs(r - origin[0]) + Math.abs(c - origin[1]), Math.random());
    const ghost = document.createElement("span");
    ghost.className = "bp-burst";
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.left = `${rect.left - bRect.left}px`;
    ghost.style.top = `${rect.top - bRect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.setProperty("--bp-wait", `${delay}ms`);
    const skin = document.createElement("i");
    skin.className = "bp-burst-skin";
    skin.style.background = el.style.background;
    ghost.appendChild(skin);
    const ring = document.createElement("i");
    ring.className = "bp-burst-ring";
    ghost.appendChild(ring);
    for (let d = 1; d <= 4; d++) {
      const dropEl = document.createElement("i");
      dropEl.className = `bp-burst-drop bp-dr${d}`;
      ghost.appendChild(dropEl);
    }
    board.appendChild(ghost);
    host.after(() => ghost.remove(), bpBurstLifeMs(delay));
    made = true;
  }
  return made;
}

/**
 * 水下氛围装饰：两道斜向光柱 + 底部水草剪影 + 缓升装饰气泡。
 * 全部 pointer-events:none、挂在 z-index 0，泡泡按钮热区一个像素不动；
 * reduced 下装饰气泡（唯一带动画的）不加，随宿主一起被 remove，无需另清。
 */
function paintAmbience(wrap: HTMLElement): void {
  for (const cls of ["bp-beam bp-beam-a", "bp-beam bp-beam-b"]) {
    const beam = document.createElement("i");
    beam.className = cls;
    beam.setAttribute("aria-hidden", "true");
    wrap.appendChild(beam);
  }
  const weeds = document.createElement("i");
  weeds.className = "bp-weeds";
  weeds.setAttribute("aria-hidden", "true");
  weeds.innerHTML = bpWeedsSvg();
  wrap.appendChild(weeds);
  if (prefersReduced()) return;
  for (const d of BP_DECOR) {
    const b = document.createElement("i");
    b.className = "bp-decor";
    b.setAttribute("aria-hidden", "true");
    b.style.left = d.left;
    b.style.width = `${d.sizePx}px`;
    b.style.height = `${d.sizePx}px`;
    b.style.animationDelay = `${d.delayMs}ms`;
    wrap.appendChild(b);
  }
}

/**
 * 补位果冻落定：塌陷播完、终态渲染之后，给刚落定的泡泡加一下 scaleY .92 → 1。
 * 只加一个 90ms 的过渡类再摘掉——补位逻辑与 planCollapse 时序常量一个没动。
 */
function jellyLand(host: CollapseHost, plan: CollapsePlan): void {
  if (prefersReduced() || plan.falls.length === 0) return;
  const colTo = new Map<number, number>();
  for (const s of plan.shifts) colTo.set(s.fromC, s.toC);
  const landed: HTMLElement[] = [];
  for (const f of plan.falls) {
    const c = colTo.get(f.toC) ?? f.toC;
    const el = host.cells[f.toR * COLS + c];
    if (!el) continue;
    el.classList.add("bp-jelly");
    landed.push(el);
  }
  if (landed.length === 0) return;
  host.after(() => {
    for (const el of landed) el.classList.remove("bp-jelly");
  }, BP_TIMINGS.jellyMs + 40);
}

/**
 * 播一整条塌陷时间线：消除 180ms → 同列下落（错峰）→ 空列左移 120ms → 落定判定。
 * 每一帧都按 visualRowAt / visualColAt 摆位置，所以中途的视觉坐标和逻辑坐标是错开的；
 * 全程只有这一条路径，没有「一次 render 直达终态」的旁路。
 */
function runCollapse(host: CollapseHost, popped: Array<[number, number]>, origin: [number, number], done: () => void): void {
  const plan = planCollapse(host.grid, COLS, host.gravityUp, { reduced: prefersReduced() });
  const step = pitchOf(host.cells);
  // 幽灵放出去了本体就立刻隐身(破裂交给幽灵演);放不出去退回 1.2 的整批淡出
  const ghosted = spawnBursts(host, popped, origin);
  for (const [r, c] of popped) host.cells[r * COLS + c]?.classList.add(ghosted ? "bp-ghosted" : "bbp-pop");

  let seen: "pop" | "fall" | "shift" = "pop";
  const t0 = nowMs();

  const frame = (): void => {
    if (!host.alive()) return;
    const t = nowMs() - t0;
    const phase = phaseAt(plan, t);

    if ((phase === "fall" || phase === "shift" || phase === "done") && seen === "pop") {
      seen = "fall";
      // 洞先空出来，要掉的泡泡这时还停在原来的格子上
      clearFx(host.cells);
      host.render();
    }
    if (phase === "fall") {
      for (const m of plan.falls) {
        const el = host.cells[m.fromR * COLS + m.fromC];
        if (!el) continue;
        el.classList.add("bbp-moving");
        el.style.transform = `translateY(${(visualRowAt(plan, m, t) - m.fromR) * step.y}px)`;
      }
    }
    if ((phase === "shift" || phase === "done") && seen === "fall") {
      seen = "shift";
      clearFx(host.cells);
      copyInto(host.grid, plan.afterFall);
      host.render();
    }
    if (phase === "shift") {
      for (const s of plan.shifts) {
        const dx = (visualColAt(plan, s, t) - s.fromC) * step.x;
        for (let r = 0; r < host.rows; r++) {
          const el = host.cells[r * COLS + s.fromC];
          if (!el) continue;
          el.classList.add("bbp-moving");
          el.style.transform = `translateX(${dx}px)`;
        }
      }
    }
    if (phase === "done") {
      clearFx(host.cells);
      copyInto(host.grid, plan.next);
      host.render();
      jellyLand(host, plan);
      done();
      return;
    }
    host.onRaf(requestAnimationFrame(frame));
  };

  host.onRaf(requestAnimationFrame(frame));
}

/** 仅供视觉冒烟测试(桩 DOM)取用的内部挂钩;运行时不走这条 */
export const __bpVisualHooks = { paintCell, paintBoard, runCollapse, paintAmbience } as const;

// ---------------------------------------------------------------------------
// 188 关闯关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: BubbleLevel = LEVELS[ctx.level];
  const bag = new BubbleBag();
  let levelDone = false;
  /** 塌陷动画进行中：这段时间不吃点击，免得半空中又消掉一组 */
  let busy = false;
  let score = 0;
  let shuffles = 0;
  const rows = cfg.rows;
  const grid: number[][] = [];
  const cells: HTMLButtonElement[] = [];
  let preview: Array<[number, number]> = [];
  /** 1.1 倒影天湖：当前重力是否朝上 */
  let gravityUp = false;
  /** 1.1 步数栈桥：剩余步数（0 = 不限步） */
  let movesLeft = cfg.moveLimit ?? 0;

  const wrap = document.createElement("div");
  wrap.className = "bp-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="bp-top">
      <span class="bp-badge bp-left">🫧</span>
      <span class="bp-badge bp-score">✨ 0 分</span>
      ${cfg.flipGravity ? `<span class="bp-badge bp-grav"></span>` : ""}
      ${cfg.moveLimit ? `<span class="bp-badge bp-moves"></span>` : ""}
      <span class="bp-badge">🎯 剩 ≤${cfg.maxLeft} 过关</span>
    </div>
    <div class="bp-board"></div>
    <div class="bp-msg"></div>
  `;
  stage.appendChild(wrap);
  paintAmbience(wrap);

  const boardEl = wrap.querySelector(".bp-board") as HTMLElement;
  const leftEl = wrap.querySelector(".bp-left") as HTMLElement;
  const scoreEl = wrap.querySelector(".bp-score") as HTMLElement;
  const gravEl = wrap.querySelector(".bp-grav") as HTMLElement | null;
  const movesEl = wrap.querySelector(".bp-moves") as HTMLElement | null;
  const msgEl = wrap.querySelector(".bp-msg") as HTMLElement;

  function later(fn: () => void, ms: number): void {
    bag.after(fn, ms);
  }

  const host: CollapseHost = {
    rows,
    cells,
    grid,
    gravityUp,
    render: () => render(),
    alive: () => bag.alive,
    onRaf: (id) => bag.onRaf(id),
    board: () => boardEl,
    after: (fn, ms) => bag.after(fn, ms),
  };

  function setup(): void {
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < COLS; c++) row.push(Math.floor(Math.random() * cfg.colors));
      grid.push(row);
    }
    // 撒特殊泡泡（互不覆盖）
    const specials: number[] = [];
    for (let i = 0; i < cfg.rainbow; i++) specials.push(RAINBOW);
    for (let i = 0; i < cfg.stone; i++) specials.push(STONE);
    for (let i = 0; i < cfg.bolt; i++) specials.push(BOLT);
    for (let i = 0; i < (cfg.chain ?? 0); i++) specials.push(CHAIN);
    const used = new Set<number>();
    for (const sp of specials) {
      let guard = 0;
      while (guard++ < 200) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * COLS);
        if (used.has(r * COLS + c)) continue;
        used.add(r * COLS + c);
        grid[r][c] = sp;
        break;
      }
    }
    const wrapValue = (offset: number) => {
      let guard = 0;
      while (guard++ < 200) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * COLS);
        if (used.has(r * COLS + c)) continue;
        used.add(r * COLS + c);
        grid[r][c] = (grid[r][c] % cfg.colors) + offset;
        break;
      }
    };
    for (let i = 0; i < cfg.frozen; i++) wrapValue(FROZEN_OFFSET);
    for (let i = 0; i < (cfg.hidden ?? 0); i++) wrapValue(HIDDEN_OFFSET);
    for (let i = 0; i < (cfg.chameleon ?? 0); i++) wrapValue(CHAMELEON_BASE);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const btn = document.createElement("button");
        btn.className = "bp-cell";
        btn.type = "button";
        const rr = r, cc = c;
        btn.addEventListener("click", () => onCell(rr, cc));
        // 按住（手机）/ 悬停（桌面）先看清这一团有多大、值多少分，松手才真的消
        btn.addEventListener("pointerdown", () => showPreview(rr, cc));
        btn.addEventListener("pointerenter", () => showPreview(rr, cc));
        btn.addEventListener("pointerup", clearPreview);
        btn.addEventListener("pointerleave", clearPreview);
        btn.addEventListener("pointercancel", clearPreview);
        boardEl.appendChild(btn);
        cells.push(btn);
      }
    }
    render();
    const tips: string[] = [];
    if (cfg.flipGravity) tips.push("🙃 每消一组，重力就翻个面");
    if ((cfg.chameleon ?? 0) > 0) tips.push("🦎 变色泡泡每步换一种颜色");
    if (cfg.moveLimit) tips.push("🌉 步数有限，先数一数再出手");
    if ((cfg.hidden ?? 0) > 0) tips.push("🏮 黑泡泡先点亮再消");
    if ((cfg.chain ?? 0) > 0) tips.push("🎇 连锁泡点一下会炸开一整圈");
    if (cfg.rainbow > 0) tips.push("🌈 一点消掉最多的颜色");
    if (cfg.stone > 0) tips.push("🪨 敲不破，绕开它");
    if (cfg.bolt > 0) tips.push("⚡ 清掉整行整列");
    if (cfg.frozen > 0) tips.push("🧊 在旁边消一次才解冻");
    msgEl.textContent = tips.length > 0 ? tips.join("；") : "先扫一眼全场，从最大的一团同色泡泡下手！";
  }

  function render(): void {
    paintBoard(cells, grid, rows);
    syncTiny(wrap, cells);
    leftEl.textContent = `🫧 剩 ${countLeftOn(grid)} 个`;
    scoreEl.textContent = `✨ ${score} 分`;
    if (gravEl) gravEl.textContent = gravityUp ? "🙃 重力 ⬆️" : "🙂 重力 ⬇️";
    if (movesEl) movesEl.textContent = `👣 剩 ${movesLeft} 步`;
  }

  function clearPreview(): void {
    for (const [r, c] of preview) cells[r * COLS + c]?.classList.remove("bbp-hi");
    preview = [];
  }

  /** 按住/悬停时把整个连通群圈出来，并报「×N · 预计多少分」 */
  function showPreview(r: number, c: number): void {
    if (levelDone || busy) return;
    clearPreview();
    const v = grid[r][c];
    if (v < 0) return;
    const list = isChain(v) ? chainBlast(grid, COLS, r, c) : groupAt(grid, COLS, r, c, cfg.colors);
    if (list.length < 2) {
      if (colorOf(v, cfg.colors) >= 0) msgEl.textContent = previewLabel(list.length);
      return;
    }
    preview = list;
    for (const [rr, cc] of list) cells[rr * COLS + cc]?.classList.add("bbp-hi");
    msgEl.textContent = previewLabel(list.length);
  }

  /** 消掉一组格子，并解冻它们旁边的冰冻泡泡 */
  function popCells(list: Array<[number, number]>): void {
    for (const [r, c] of list) grid[r][c] = -1;
    for (const [r, c] of list) {
      const near: Array<[number, number]> = [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]];
      for (const [nr, nc] of near) {
        if (nr < 0 || nr >= rows || nc < 0 || nc >= COLS) continue;
        if (isFrozen(grid[nr][nc])) grid[nr][nc] -= FROZEN_OFFSET;
      }
    }
  }

  /** 没得消了就让朵朵吹一口气，把泡泡重新排一遍（不扣分、不扣步） */
  function blowAway(): void {
    shuffles++;
    busy = true;
    ctx.sfx("tap");
    msgEl.textContent = `😮‍💨 场上没有能消的了——朵朵吹一口气，泡泡重新排一排（第 ${shuffles}/${MAX_SHUFFLE} 次，不扣分）`;
    boardEl.classList.add("bbp-ripple");
    later(() => {
      copyInto(grid, blowShuffle(grid, COLS, cfg.colors, Math.random));
      boardEl.classList.remove("bbp-ripple");
      render();
      busy = false;
      checkEnd();
    }, prefersReduced() ? 16 : 420);
  }

  function checkEnd(): void {
    if (levelDone) return;
    const outOfMoves = cfg.moveLimit ? movesLeft <= 0 : false;
    if (!outOfMoves && hasMovesOn(grid, COLS, cfg.colors)) return;
    const left = countLeftOn(grid);
    if (!outOfMoves && left > cfg.maxLeft && shuffles < MAX_SHUFFLE) {
      blowAway();
      return;
    }
    levelDone = true;
    if (left <= cfg.maxLeft) {
      const half = Math.max(cfg.stone, Math.floor(cfg.maxLeft / 2));
      const got = left <= cfg.stone ? 3 : left <= half ? 2 : 1;
      if (left <= cfg.stone) ctx.bonusStars(1);
      later(() => ctx.win(got as 1 | 2 | 3, left <= cfg.stone
        ? `泡泡全部清空，攒到 ${score} 分，这一局的顺序排得很漂亮！`
        : `只剩 ${left} 个泡泡，${score} 分达标通过！`), 400);
    } else if (outOfMoves) {
      later(() => ctx.lose(`步数用完还剩 ${left} 个～下一局先在心里排一遍顺序，从最大的一团开始，收益会高很多！`), 400);
    } else {
      later(() => ctx.lose(`还剩 ${left} 个泡泡～从盘面下方消起，上面掉下来常常会自己连锁，再来一次！`), 400);
    }
  }

  /** 每成功消一步之后的收尾：变色泡泡换色、重力方向结算、塌陷动画、落定判定 */
  function afterPop(popped: Array<[number, number]>, gained: number, origin: [number, number]): void {
    score += gained;
    busy = true;
    if (cfg.moveLimit) movesLeft = Math.max(0, movesLeft - 1);
    if ((cfg.chameleon ?? 0) > 0) cycleChameleons(grid, cfg.colors);
    if (cfg.flipGravity) gravityUp = !gravityUp;
    host.gravityUp = gravityUp;
    if (popped.length >= BIG_GROUP && !prefersReduced()) {
      boardEl.classList.add("bbp-ripple");
      later(() => boardEl.classList.remove("bbp-ripple"), 460);
    }
    // 连消数字跳动(彩色描边),reduced 不加类
    if (!prefersReduced()) {
      scoreEl.classList.add("bp-combo");
      later(() => scoreEl.classList.remove("bp-combo"), BP_TIMINGS.comboMs + 60);
    }
    runCollapse(host, popped, origin, () => {
      busy = false;
      checkEnd();
    });
  }

  function onCell(r: number, c: number): void {
    if (levelDone || busy) return;
    clearPreview();
    const v = grid[r][c];
    if (v < 0) return;
    if (v === STONE) {
      ctx.sfx("oops");
      msgEl.textContent = "石头敲不破，把它当地形绕开就好～";
      return;
    }
    if (isHidden(v)) {
      grid[r][c] = revealHidden(v);
      ctx.sfx("tap");
      msgEl.textContent = "🏮 点亮了！记住它的颜色，别回头再点一次～";
      render();
      return;
    }
    if (isFrozen(v)) {
      ctx.sfx("oops");
      msgEl.textContent = "这颗冻住啦，在它旁边消一组就能解冻！";
      return;
    }
    if (v === CHAIN) {
      const list = chainBlast(grid, COLS, r, c);
      ctx.sfx("coin");
      msgEl.textContent = `🎇 连锁泡炸开一圈，带走 ${list.length} 个泡泡！`;
      for (const [rr, cc] of list) {
        if (isFrozen(grid[rr][cc])) grid[rr][cc] -= FROZEN_OFFSET;
      }
      popCells(list);
      afterPop(list, groupScore(list.length), [r, c]);
      return;
    }
    if (v === RAINBOW) {
      // 消掉数量最多的颜色（变色泡泡按当前颜色一起算）
      const counts = new Array<number>(cfg.colors).fill(0);
      for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < COLS; cc++) {
        const color = colorOf(grid[rr][cc], cfg.colors);
        if (color >= 0) counts[color]++;
      }
      let best = 0;
      for (let i = 1; i < cfg.colors; i++) if (counts[i] > counts[best]) best = i;
      const list: Array<[number, number]> = [[r, c]];
      for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < COLS; cc++) {
        if (colorOf(grid[rr][cc], cfg.colors) === best) list.push([rr, cc]);
      }
      ctx.sfx("coin");
      msgEl.textContent = `🌈 彩虹泡泡消掉了 ${list.length - 1} 个泡泡！`;
      popCells(list);
      afterPop(list, groupScore(list.length), [r, c]);
      return;
    }
    if (v === BOLT) {
      const list: Array<[number, number]> = [];
      for (let cc = 0; cc < COLS; cc++) {
        const gv = grid[r][cc];
        if (gv >= 0 && gv !== STONE) list.push([r, cc]);
      }
      for (let rr = 0; rr < rows; rr++) {
        if (rr === r) continue;
        const gv = grid[rr][c];
        if (gv >= 0 && gv !== STONE) list.push([rr, c]);
      }
      ctx.sfx("coin");
      msgEl.textContent = `⚡ 咔嚓！清掉一行一列共 ${list.length} 个！`;
      for (const [rr, cc] of list) {
        if (isFrozen(grid[rr][cc])) grid[rr][cc] -= FROZEN_OFFSET;
      }
      popCells(list);
      afterPop(list, groupScore(list.length), [r, c]);
      return;
    }
    const g = groupAt(grid, COLS, r, c, cfg.colors);
    if (g.length < 2) {
      ctx.sfx("oops");
      msgEl.textContent = "这颗是单个的，消不掉～找相邻成团的同色泡泡！";
      return;
    }
    const gained = groupScore(g.length);
    ctx.sfx("pop");
    if (g.length >= BIG_GROUP) {
      ctx.bonusStars(1);
      msgEl.textContent = `一口气消掉 ${g.length} 个，进账 ${gained} 分，奖励一颗小星星！`;
    } else {
      msgEl.textContent = `消掉 ${g.length} 个，进账 ${gained} 分～再攒大一点收益更高！`;
    }
    popCells(g);
    afterPop(g, gained, [r, c]);
  }

  setup();

  return {
    destroy() {
      levelDone = true;
      bag.close();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽「泡泡海」：底下不停涨新行，顶到线就收摊
// ---------------------------------------------------------------------------

function mountSea(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "bbp-mode";
  wrap.innerHTML = `<style>${CSS}</style>`;
  const head = document.createElement("div");
  head.className = "bbp-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "bbp-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "bbp-chip";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  const bag = new BubbleBag();
  let best = save.getGameProgress(meta.id).endlessBest;
  let over = false;
  let busy = false;
  let score = 0;
  let pushes = 0;
  let preview: Array<[number, number]> = [];
  const grid: number[][] = [];
  const cells: HTMLButtonElement[] = [];
  let boardEl: HTMLElement | null = null;
  let msgEl: HTMLElement | null = null;
  let panelEl: HTMLElement | null = null;

  function later(fn: () => void, ms: number): void {
    bag.after(fn, ms);
  }

  const view: CollapseHost = {
    rows: SEA_ROWS,
    cells,
    grid,
    gravityUp: false,
    render: () => render(),
    alive: () => bag.alive && !over,
    onRaf: (id) => bag.onRaf(id),
    board: () => boardEl,
    after: (fn, ms) => bag.after(fn, ms),
  };

  function render(): void {
    paintBoard(cells, grid, SEA_ROWS);
    if (panelEl) syncTiny(panelEl, cells);
    chip.textContent = `🌊 ${score} 分 · 涨潮 ${pushes} 次 · 最好 ${best} 分`;
  }

  function clearPreview(): void {
    for (const [r, c] of preview) cells[r * COLS + c]?.classList.remove("bbp-hi");
    preview = [];
  }

  function showPreview(r: number, c: number): void {
    if (over || busy) return;
    clearPreview();
    if (grid[r][c] < 0) return;
    if (isFrozen(grid[r][c])) {
      if (msgEl) msgEl.textContent = "🧊 这颗冻住啦，在它旁边消一组就能化开～";
      return;
    }
    const list = groupAt(grid, COLS, r, c, seaColors(pushes));
    if (list.length < 2) {
      if (msgEl) msgEl.textContent = previewLabel(list.length);
      return;
    }
    preview = list;
    for (const [rr, cc] of list) cells[rr * COLS + cc]?.classList.add("bbp-hi");
    if (msgEl) msgEl.textContent = previewLabel(list.length);
  }

  function scheduleTide(): void {
    if (over || !bag.alive) return;
    later(tide, seaPushMs(pushes));
  }

  function tide(): void {
    if (over || !bag.alive) return;
    if (busy) {
      // 塌陷还在半空，等这一下播完再涨潮，别让画面打架
      later(tide, 120);
      return;
    }
    // 后段会来「大潮」，一次涨两行；每一行都各自看一眼有没有顶穿
    let next: number[][] = grid;
    for (let i = 0; i < seaTideRows(pushes); i++) {
      const result = pushUpRow(next, COLS, seaColors(pushes), Math.random, seaFrozen(pushes));
      if (result.overflow) {
        finish();
        return;
      }
      next = result.grid;
    }
    pushes++;
    copyInto(grid, next);
    api.play("tap");
    render();
    if (!hasMovesOn(grid, COLS, seaColors(pushes))) {
      copyInto(grid, blowShuffle(grid, COLS, seaColors(pushes), Math.random));
      if (msgEl) msgEl.textContent = "😮‍💨 没得消了，吹一口气重新排一排～";
      render();
    }
    scheduleTide();
  }

  function onCell(r: number, c: number): void {
    if (over || busy) return;
    clearPreview();
    if (isFrozen(grid[r][c])) {
      api.play("oops");
      if (msgEl) msgEl.textContent = "🧊 冰壳点不开～在它旁边消一组，冰就化了！";
      return;
    }
    const colors = seaColors(pushes);
    const g = groupAt(grid, COLS, r, c, colors);
    if (g.length < 2) {
      api.play("oops");
      if (msgEl) msgEl.textContent = "单颗消不掉～找挨在一起的同色泡泡，团越大分越高！";
      return;
    }
    const gained = groupScore(g.length);
    score += gained;
    api.play("pop");
    if (!prefersReduced()) {
      chip.classList.add("bp-combo");
      later(() => chip.classList.remove("bp-combo"), BP_TIMINGS.comboMs + 60);
    }
    if (msgEl) msgEl.textContent = g.length >= BIG_GROUP
      ? `好大一团！${g.length} 个进账 ${gained} 分！`
      : `消掉 ${g.length} 个，进账 ${gained} 分。`;
    for (const [rr, cc] of g) grid[rr][cc] = -1;
    // 消掉的一圈邻居里有冰冻的,顺手化开(跟战役同一套规矩)
    for (const [rr, cc] of g) {
      for (const [nr, nc] of [[rr + 1, cc], [rr - 1, cc], [rr, cc + 1], [rr, cc - 1]] as const) {
        if (nr < 0 || nr >= SEA_ROWS || nc < 0 || nc >= COLS) continue;
        if (isFrozen(grid[nr][nc])) grid[nr][nc] -= FROZEN_OFFSET;
      }
    }
    busy = true;
    runCollapse(view, g, [r, c], () => {
      busy = false;
      render();
    });
  }

  function finish(): void {
    over = true;
    bag.clearPending();
    best = save.recordEndlessBest(meta.id, score);
    if (score > 0) api.addStars(1);
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "bbp-over";
    box.innerHTML = `<div class="bbp-over-t">泡泡海退潮啦</div><div class="bbp-over-s">${seaLine(score, best)}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "bbp-open";
    again.textContent = "🔁 再涨一次潮";
    again.addEventListener("click", () => {
      api.play("tap");
      start();
    });
    box.appendChild(again);
    stage.appendChild(box);
    chip.textContent = `🌊 ${score} 分 · 最好 ${best} 分`;
  }

  function start(): void {
    over = false;
    busy = false;
    score = 0;
    pushes = 0;
    preview = [];
    grid.length = 0;
    cells.length = 0;
    bag.clearPending();
    stage.innerHTML = "";

    const panel = document.createElement("div");
    panel.className = "bp-wrap";
    panelEl = panel;
    const line = document.createElement("div");
    line.className = "bbp-line";
    boardEl = document.createElement("div");
    boardEl.className = "bp-board";
    msgEl = document.createElement("div");
    msgEl.className = "bp-msg";
    msgEl.textContent = "海水会从下面一行一行涨上来，别让泡泡顶到虚线！先消最大的一团。";
    panel.append(line, boardEl, msgEl);
    stage.appendChild(panel);
    paintAmbience(panel);

    const colors = seaColors(0);
    for (let r = 0; r < SEA_ROWS; r++) {
      const row: number[] = [];
      const filled = r >= SEA_ROWS - 5;
      for (let c = 0; c < COLS; c++) row.push(filled ? Math.floor(Math.random() * colors) : -1);
      grid.push(row);
    }
    for (let r = 0; r < SEA_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const btn = document.createElement("button");
        btn.className = "bp-cell";
        btn.type = "button";
        const rr = r, cc = c;
        btn.addEventListener("click", () => onCell(rr, cc));
        btn.addEventListener("pointerdown", () => showPreview(rr, cc));
        btn.addEventListener("pointerenter", () => showPreview(rr, cc));
        btn.addEventListener("pointerup", clearPreview);
        btn.addEventListener("pointerleave", clearPreview);
        btn.addEventListener("pointercancel", clearPreview);
        boardEl.appendChild(btn);
        cells.push(btn);
      }
    }
    render();
    scheduleTide();
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  start();

  return {
    destroy() {
      over = true;
      bag.close();
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载：模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "bbp-bar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const seaBtn = document.createElement("button");
  seaBtn.type = "button";
  seaBtn.className = "bbp-open";
  bar.appendChild(seaBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    seaBtn.textContent = best > 0 ? `🌊 无尽泡泡海 · 最好 ${best} 分` : "🌊 无尽泡泡海 · 点我下水！";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  seaBtn.addEventListener("click", () => {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = mountSea(modeHost, api, closeMode);
  });
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "全部清空 3 星，剩得越少星星越多，先规划再出手！",
      grandMessage: "188 关泡泡全部搞定，你的盘面规划能力已经很强了！",
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
