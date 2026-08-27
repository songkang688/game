import { meta } from "./meta";
export { meta };

/**
 * 扫雷花园：看数字绕开刺种，把整片花园翻开。
 *
 * 188 关闯关 + 同图竞速对战 + 连续清盘无尽 + 朵朵星星左右分屏双人。
 * 全部离线，逻辑在 `board.ts` / `solver.ts` / `run.ts` 里，本文件只负责画和接线。
 */
import {
  compatFromMeta,
  describeModes,
  modeEntryKeys,
  type ModeEntry
} from "../../engine";
import { save } from "../../engine/save";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import {
  FLAG,
  GUESS,
  OPEN,
  canChord,
  fogVisible,
  flagsLeft,
  maxMines,
  xOf,
  yOf,
  type Dir
} from "./board";
import guide from "./guide";
import { CHAPTERS, levelAt, levelSeed, loseLine, starsByTime, winLine, type MineLevel } from "./levels";
import {
  AI_TIERS,
  AI_TIER_HINTS,
  AI_TIER_LABELS,
  aiFirstOpen,
  aiProgress,
  aiStep,
  createAi,
  type Ai,
  type AiTier
} from "./ai";
import {
  chordAt,
  createRun,
  elapsedMs,
  expire,
  flagAt,
  flagBudgetLeft,
  moveRunCursor,
  openAt,
  revealRest,
  runProgress,
  runWrongFlags,
  timeLeftMs,
  timedOut,
  type Run,
  type RunOptions
} from "./run";

// ---------------------------------------------------------------------------
// 版面：360px 上格子必须 ≥ 28px
// ---------------------------------------------------------------------------

/** 最小格子边长（px）。手指点得准，这条线不许再往下压。 */
export const MIN_CELL = 28;
/** 大图上格子的上限，免得 5×5 的小苗床铺满整个屏幕 */
export const MAX_CELL = 44;

/**
 * 按可用宽度算格子边长。宽度不够时**不会**把格子压小 ——
 * 直接维持 28px，画面比容器宽就交给外层横向滚动（配迷你地图看全局）。
 */
export function cellPx(cols: number, width: number): number {
  const usable = Number.isFinite(width) && width > 80 ? width : 320;
  const fit = Math.floor((usable - 10) / Math.max(1, cols));
  return Math.max(MIN_CELL, Math.min(MAX_CELL, fit));
}

/** 这张图在这个宽度下要不要横向滚动 */
export function needsScroll(cols: number, width: number): boolean {
  return cellPx(cols, width) * cols + 10 > (Number.isFinite(width) && width > 80 ? width : 320);
}

export function viewportWidth(): number {
  const w = (globalThis as { innerWidth?: number }).innerWidth;
  return typeof w === "number" && w > 0 ? w : 480;
}

// ---------------------------------------------------------------------------
// 键位
// ---------------------------------------------------------------------------

export type FieldKey = "up" | "down" | "left" | "right" | "open" | "flag" | "pause" | null;
export type KeyScheme = "solo" | "p1" | "p2" | "none";

/**
 * 单人：方向键或 `WASD` 挪光标，`F` 翻开，`G` 插旗，`Esc` 暂停。
 * 双人：朵朵 `WASD` + `F` + `G`，星星 方向键 + `L` + `K`。
 */
export function keyAction(key: string, scheme: KeyScheme = "solo"): FieldKey {
  if (scheme === "none") return key === "Escape" ? "pause" : null;
  const arrows = scheme === "solo" || scheme === "p2";
  const wasd = scheme === "solo" || scheme === "p1";
  switch (key) {
    case "ArrowUp":
      return arrows ? "up" : null;
    case "ArrowDown":
      return arrows ? "down" : null;
    case "ArrowLeft":
      return arrows ? "left" : null;
    case "ArrowRight":
      return arrows ? "right" : null;
    case "w":
    case "W":
      return wasd ? "up" : null;
    case "s":
    case "S":
      return wasd ? "down" : null;
    case "a":
    case "A":
      return wasd ? "left" : null;
    case "d":
    case "D":
      return wasd ? "right" : null;
    case "f":
    case "F":
      return scheme === "p2" ? null : "open";
    case "g":
    case "G":
      return scheme === "p2" ? null : "flag";
    case "l":
    case "L":
      return scheme === "p1" ? null : "open";
    case "k":
    case "K":
      return scheme === "p1" ? null : "flag";
    case "Enter":
      return scheme === "p2" ? null : "open";
    case "Escape":
      return "pause";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// 触屏长按插旗
// ---------------------------------------------------------------------------

/** 长按多久算插旗（毫秒）。设置里可以在这三档之间切。 */
export const LONG_PRESS_CHOICES: readonly number[] = [260, 400, 560];
export const LONG_PRESS_MS = LONG_PRESS_CHOICES[1];

/** 长按进度环的完成度 0..1（纯函数，界面照着画） */
export function longPressProgress(elapsed: number, threshold: number = LONG_PRESS_MS): number {
  if (!(threshold > 0)) return 1;
  return Math.max(0, Math.min(1, elapsed / threshold));
}

export function nextLongPress(cur: number): number {
  const i = LONG_PRESS_CHOICES.indexOf(cur);
  return LONG_PRESS_CHOICES[(i + 1) % LONG_PRESS_CHOICES.length];
}

// ---------------------------------------------------------------------------
// 动效
// ---------------------------------------------------------------------------

export function reducedMotion(): boolean {
  try {
    return Boolean(
      (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      )?.matches
    );
  } catch {
    return false;
  }
}

/** 翻开的翻转动画时长（毫秒）；省电模式缩到最短 */
export function flipMs(reduced: boolean): number {
  return reduced ? 16 : 110;
}

/** 输了之后一颗一颗开花的间隔（毫秒）；顺序永远在，绝不一下子全开 */
export function bloomStepMs(reduced: boolean): number {
  return reduced ? 8 : 90;
}

// ---------------------------------------------------------------------------
// 配色与文案
// ---------------------------------------------------------------------------

/** 数字 1–8 的粉彩八色（对着浅底都够对比度） */
export const HINT_COLORS: readonly string[] = [
  "#3F7D3A",
  "#2F5FA8",
  "#B03E63",
  "#6A44A0",
  "#A86A22",
  "#1F7A73",
  "#6B4A38",
  "#4A4A5C"
];

export function hintColor(n: number): string {
  return HINT_COLORS[Math.max(0, Math.min(HINT_COLORS.length - 1, n - 1))];
}

/** 计时 / 倒计时都用 mm:ss */
export function clockText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function percentText(p: number): string {
  return `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
}

// ---------------------------------------------------------------------------
// 难度预设与无尽
// ---------------------------------------------------------------------------

export interface Preset {
  key: string;
  label: string;
  w: number;
  h: number;
  mines: number;
}

export const PRESETS: readonly Preset[] = [
  { key: "easy", label: "初级 9×9", w: 9, h: 9, mines: 10 },
  { key: "mid", label: "中级 16×16", w: 16, h: 16, mines: 40 },
  { key: "hard", label: "高级 30×16", w: 30, h: 16, mines: 99 }
];

/** 无尽：每清一盘密度 +1 颗刺种 */
export function endlessMines(round: number, preset: Preset): number {
  return Math.min(maxMines(preset.w, preset.h, 0) - 1, preset.mines + Math.max(0, round));
}

export function endlessLine(streak: number, best: number, mines: number): string {
  return `连清 ${streak} 盘 · 最好成绩 ${Math.max(best, streak)} 盘 · 这一盘 ${mines} 颗刺种`;
}

export const MODE_LABELS = {
  versus: "🤖 竞速对战",
  endless: "🔥 连续清盘",
  duo: "👫 双人同屏"
} as const;

export type ExtraMode = keyof typeof MODE_LABELS;

/** 竞速对战里假人那根进度条的刷新间隔（毫秒） */
export const AI_TICK_MS = 120;

/**
 * 一次插旗动作的去重窗口（毫秒）。
 * 右键会连着发 pointerdown(button=2) 和 contextmenu，安卓长按也会补一发 contextmenu，
 * 两发都翻旗的话等于没插。这个窗口内只认头一发。
 */
export const DOUBLE_FLAG_GUARD_MS = 400;

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

export const MN_CSS = `
.mn-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#F4FBEC,#E9F5E0);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;position:relative;}
.mn-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.mn-modetip{flex:1 1 100%;margin:0 0 2px;font-size:16px;line-height:1.5;font-weight:700;color:#41633A;text-align:center;overflow-wrap:anywhere;}
.mn-open,.mn-back{border:none;border-radius:999px;padding:10px 18px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  min-height:44px;font-family:inherit;background:linear-gradient(180deg,#6FA85A,#568844);box-shadow:0 4px 0 #416832;}
.mn-open:active,.mn-back:active{transform:translateY(2px);box-shadow:0 2px 0 #416832;}
.mn-back{background:linear-gradient(180deg,#7E97C0,#65799C);box-shadow:0 4px 0 #4E5E7C;}
.mn-back:active{box-shadow:0 2px 0 #4E5E7C;}
.mn-field{position:relative;}
.mn-hud{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;margin-bottom:8px;}
.mn-chip{background:#fff;border-radius:999px;padding:6px 11px;font-size:16px;font-weight:800;color:#3F6033;
  box-shadow:0 2px 6px rgba(110,150,90,.24);overflow-wrap:anywhere;}
.mn-chip b{color:#B0563E;}
.mn-chip.mn-warn{background:#FFF0E4;color:#A85A28;}
.mn-scroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;border-radius:12px;max-width:100%;
  padding:3px;background:#DCEBCF;}
.mn-grid{display:grid;gap:2px;margin:0 auto;width:max-content;}
.mn-cell{border:none;padding:0;margin:0;border-radius:6px;cursor:pointer;font-family:inherit;font-weight:900;
  background:linear-gradient(180deg,#BEE0A8,#A8D08C);box-shadow:inset 0 -2px 0 rgba(90,130,70,.35);
  display:flex;align-items:center;justify-content:center;line-height:1;touch-action:none;position:relative;}
.mn-cell:active{transform:scale(.94);}
.mn-cell.mn-lit{background:#F3F7EA;box-shadow:inset 0 0 0 1px rgba(150,175,130,.5);cursor:default;
  animation:mnflip 110ms ease-out;}
.mn-cell.mn-chordable{box-shadow:inset 0 0 0 2px #E0A94A;cursor:pointer;}
.mn-cell.mn-flag{background:linear-gradient(180deg,#F6D9A8,#EFC684);}
.mn-cell.mn-guess{background:linear-gradient(180deg,#DCD8EE,#C7C1E2);}
.mn-cell.mn-bloom{background:#FDEFF5;animation:mnbloom 260ms cubic-bezier(.34,1.56,.64,1);}
.mn-cell.mn-wrong{background:#EFE7DA;}
.mn-cell.mn-cursor{outline:3px solid #E2705A;outline-offset:-2px;z-index:2;}
.mn-cell.mn-dark{background:linear-gradient(180deg,#9FB3A0,#8CA18E);color:transparent;}
.mn-cell.mn-dark.mn-lit{background:#C6CFC1;}
.mn-cell.mn-pressing::after{content:"";position:absolute;inset:2px;border-radius:5px;
  border:2px solid #E0A94A;opacity:var(--mn-press,0);}
@keyframes mnflip{from{transform:rotateX(70deg);opacity:.3}to{transform:none;opacity:1}}
@keyframes mnbloom{from{transform:scale(.4)}to{transform:scale(1)}}
.mn-mini{display:block;margin:6px auto 0;border-radius:8px;background:#DCEBCF;
  box-shadow:0 2px 6px rgba(110,150,90,.3);}
.mn-minitip{text-align:center;font-size:var(--mt-body,16px);font-weight:700;color:#5B7A4C;margin-top:2px;}
.mn-tools{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:8px;}
.mn-btn{border:none;border-radius:12px;padding:9px 13px;min-height:40px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#fff;color:#3F6033;box-shadow:0 3px 0 rgba(110,150,90,.32);white-space:nowrap;}
.mn-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(110,150,90,.32);}
.mn-btn.mn-on{background:#DCEFC9;color:#37642A;}
.mn-btn:disabled{opacity:.5;cursor:default;}
.mn-btn:focus-visible,.mn-open:focus-visible,.mn-back:focus-visible,.mn-cell:focus-visible{outline:3px solid #274C1C;outline-offset:2px;}
.mn-msg{text-align:center;font-size:16px;font-weight:800;color:#41633A;min-height:22px;line-height:1.6;margin-top:8px;
  overflow-wrap:anywhere;}
.mn-note{text-align:center;font-size:16px;font-weight:700;color:#5B7A4C;line-height:1.6;margin:6px auto 0;
  max-width:520px;overflow-wrap:anywhere;}
.mn-setup{display:flex;flex-direction:column;gap:8px;align-items:center;}
.mn-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;}
.mn-label{font-size:var(--mt-body,16px);font-weight:800;color:#4B6B3E;}
.mn-duo{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:flex-start;}
.mn-duo>div{flex:1 1 300px;min-width:280px;}
.mn-side{background:#ffffffcc;border-radius:12px;padding:8px 10px;font-size:16px;font-weight:800;color:#41633A;
  line-height:1.7;margin:8px auto 0;max-width:520px;}
.mn-bar{height:10px;border-radius:999px;background:#D6E6C6;overflow:hidden;margin-top:4px;}
.mn-bar>i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#8CC46C,#5E9B45);}
.mn-over{position:absolute;inset:0;background:rgba(244,251,236,.96);border-radius:16px;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:18px;z-index:6;}
.mn-over-t{font-size:21px;font-weight:900;color:#3F7D3A;}
.mn-over-s{font-size:16px;font-weight:700;color:#4B6B3E;line-height:1.6;max-width:340px;overflow-wrap:anywhere;}
@media (max-width:420px){
  .mn-wrap{padding:8px;}
  .mn-chip{padding:5px 9px;}
  .mn-duo>div{min-width:0;flex:1 1 100%;}
}
@media (prefers-reduced-motion:reduce){
  .mn-cell.mn-lit{animation:none;}
  .mn-cell.mn-bloom{animation:none;}
}
`;

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

function el(tag: string, cls = "", text = ""): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function chip(text: string): HTMLElement {
  return el("span", "mn-chip", text);
}

function button(text: string, onClick: () => void, on = false): HTMLElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `mn-btn${on ? " mn-on" : ""}`;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

/** 一个只管清理的定时器篮子：destroy 的时候一口气全倒掉 */
class Timers {
  private timeouts = new Set<number>();
  private intervals = new Set<number>();
  private frames = new Set<number>();

  after(fn: () => void, ms: number): number {
    const id = setTimeout(() => {
      this.timeouts.delete(id as unknown as number);
      fn();
    }, ms) as unknown as number;
    this.timeouts.add(id);
    return id;
  }

  every(fn: () => void, ms: number): number {
    const id = setInterval(fn, ms) as unknown as number;
    this.intervals.add(id);
    return id;
  }

  frame(fn: () => void): number {
    const raf = (globalThis as { requestAnimationFrame?: (cb: () => void) => number }).requestAnimationFrame;
    if (!raf) return this.after(fn, 16);
    const id = raf(() => {
      this.frames.delete(id);
      fn();
    });
    this.frames.add(id);
    return id;
  }

  cancel(id: number): void {
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
    this.timeouts.delete(id);
    const caf = (globalThis as { cancelAnimationFrame?: (id: number) => void }).cancelAnimationFrame;
    if (this.frames.has(id)) {
      caf?.(id);
      this.frames.delete(id);
    }
  }

  clear(): void {
    for (const id of this.timeouts) clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
    for (const id of this.intervals) clearInterval(id as unknown as ReturnType<typeof setInterval>);
    const caf = (globalThis as { cancelAnimationFrame?: (id: number) => void }).cancelAnimationFrame;
    for (const id of this.frames) caf?.(id);
    this.timeouts.clear();
    this.intervals.clear();
    this.frames.clear();
  }
}

function nowMs(): number {
  const p = (globalThis as { performance?: { now: () => number } }).performance;
  return p ? p.now() : Date.now();
}

// ---------------------------------------------------------------------------
// 一片花园（四种模式共用的核心组件）
// ---------------------------------------------------------------------------

export interface FieldEndInfo {
  win: boolean;
  ms: number;
  usedProtect: boolean;
  reason: "clear" | "hit" | "time";
}

export interface FieldOptions extends RunOptions {
  title?: string;
  /** 键盘方案；双人同屏时两边各一套 */
  scheme?: KeyScheme;
  /** 分屏用的紧凑版：格子小一点，工具行收起来 */
  compact?: boolean;
  longPressMs?: number;
  sfx: (name: SoundName) => void;
  /** 本局结束（赢或输）时回调一次 */
  onEnd?: (info: FieldEndInfo) => void;
  /** 第一下点完、种布好之后回调（竞速对战靠它把同一张图交给假人） */
  onPlant?: (mine: Uint8Array, first: number) => void;
  /** 自己弹结算浮层；闯关交给 188 关框架，所以传 false */
  autoSettle?: boolean;
  /** 结算浮层上的「再来一盘」；不给就不显示 */
  onReplay?: () => void;
}

export interface FieldHandle {
  destroy: () => void;
  run: Run;
  el: HTMLElement;
  /** 让外面的人（比如暂停键）也能问一句现在过了多久 */
  elapsed: () => number;
}

/**
 * 挂一片可玩的花园。
 *
 * 交互：左键 / `F` 翻开，右键 / `G` 插旗，`WASD` 或方向键挪光标，`Esc` 暂停；
 * 触屏点一下翻开、长按插旗（有进度环）；已翻开的数字格再点一下就是和弦。
 */
export function mountField(host: HTMLElement, opts: FieldOptions): FieldHandle {
  const run = createRun(opts);
  const timers = new Timers();
  const reduced = reducedMotion();
  const scheme: KeyScheme = opts.scheme ?? "solo";
  let longPress = opts.longPressMs ?? LONG_PRESS_MS;
  let paused = false;
  let pausedTotal = 0;
  let pauseStart = 0;
  let finished = false;
  let dead = false;
  let bloomed: number[] = [];

  const wrap = el("div", "mn-field");
  const hud = el("div", "mn-hud");
  const flagChip = chip("🚩 0");
  const clockChip = chip("⏱ 00:00");
  const doneChip = chip("🌼 0%");
  hud.append(flagChip, clockChip, doneChip);
  if (opts.title) hud.appendChild(chip(opts.title));
  wrap.appendChild(hud);

  const scroll = el("div", "mn-scroll");
  const grid = el("div", "mn-grid");
  scroll.appendChild(grid);
  wrap.appendChild(scroll);

  const mini = document.createElement("canvas");
  mini.className = "mn-mini";
  const miniTip = el("div", "mn-minitip", "地图放不下，可以横着拖；下面这张小地图是全景。");
  wrap.append(mini, miniTip);

  const msg = el("div", "mn-msg", opts.fog ? "雾里只照亮光标周围，数字要记住。" : "第一下一定安全，放心点。");
  wrap.appendChild(msg);

  const tools = el("div", "mn-tools");
  const pressBtn = button(`🖐 长按 ${longPress}ms`, () => {
    longPress = nextLongPress(longPress);
    pressBtn.textContent = `🖐 长按 ${longPress}ms`;
    opts.sfx("tap");
  });
  const pauseBtn = button("⏸ 暂停", () => togglePause());
  if (!opts.compact) tools.append(pressBtn, pauseBtn);
  wrap.appendChild(tools);
  host.appendChild(wrap);

  const total = run.opts.w * run.opts.h;
  const cells: HTMLElement[] = new Array(total);
  for (let i = 0; i < total; i++) {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "mn-cell";
    c.setAttribute("aria-label", cellLabel(i));
    bindCell(c, i);
    cells[i] = c;
    grid.appendChild(c);
  }

  function cellLabel(i: number): string {
    const x = xOf(run.opts.w, i) + 1;
    const y = yOf(run.opts.w, i) + 1;
    const st = run.board.state[i];
    if (st === OPEN) {
      const n = run.board.hint[i];
      return run.board.mine[i] ? `第 ${y} 行第 ${x} 列，刺种开花了` : `第 ${y} 行第 ${x} 列，${n} 颗刺种`;
    }
    if (st === FLAG) return `第 ${y} 行第 ${x} 列，插着小旗`;
    if (st === GUESS) return `第 ${y} 行第 ${x} 列，打了问号`;
    return `第 ${y} 行第 ${x} 列，还没翻开`;
  }

  function layout(): void {
    const px = cellPx(run.opts.w, Math.min(viewportWidth(), (host as { clientWidth?: number }).clientWidth || viewportWidth()));
    const size = opts.compact ? Math.max(MIN_CELL, Math.round(px * 0.8)) : px;
    grid.style.gridTemplateColumns = `repeat(${run.opts.w}, ${size}px)`;
    grid.style.fontSize = `${Math.max(13, Math.round(size * 0.52))}px`;
    for (const c of cells) {
      c.style.width = `${size}px`;
      c.style.height = `${size}px`;
    }
    const wide = size * run.opts.w + 10 > viewportWidth();
    mini.hidden = !wide;
    miniTip.hidden = !wide;
    if (wide) drawMini();
  }

  function drawMini(): void {
    const scale = Math.max(2, Math.floor(300 / run.opts.w));
    mini.width = run.opts.w * scale;
    mini.height = run.opts.h * scale;
    const ctx = (mini as HTMLCanvasElement).getContext?.("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, mini.width, mini.height);
    for (let i = 0; i < total; i++) {
      const st = run.board.state[i];
      ctx.fillStyle = st === OPEN ? "#F3F7EA" : st === FLAG ? "#EFC684" : "#A8D08C";
      ctx.fillRect(xOf(run.opts.w, i) * scale, yOf(run.opts.w, i) * scale, scale, scale);
    }
    ctx.strokeStyle = "#E2705A";
    ctx.lineWidth = 1;
    ctx.strokeRect(xOf(run.opts.w, run.cursor) * scale, yOf(run.opts.w, run.cursor) * scale, scale, scale);
  }

  function paintCell(i: number): void {
    const c = cells[i];
    const st = run.board.state[i];
    const dark = Boolean(opts.fog) && !fogVisible(run.opts.w, run.opts.h, run.cursor, i);
    let cls = "mn-cell";
    let text = "";
    let color = "";
    if (st === OPEN) {
      if (run.board.mine[i]) {
        cls += " mn-bloom";
        text = "🌼";
      } else {
        cls += " mn-lit";
        const n = run.board.hint[i];
        if (n > 0) {
          text = String(n);
          color = hintColor(n);
        }
        if (!finished && canChord(run.board, i)) cls += " mn-chordable";
      }
    } else if (st === FLAG) {
      cls += finished && !run.board.mine[i] ? " mn-flag mn-wrong" : " mn-flag";
      text = finished && !run.board.mine[i] ? "🍀" : "🚩";
    } else if (st === GUESS) {
      cls += " mn-guess";
      text = "❓";
    }
    if (dark) cls += " mn-dark";
    if (i === run.cursor && scheme !== "none") cls += " mn-cursor";
    c.className = cls;
    c.textContent = dark && st !== FLAG ? "" : text;
    c.style.color = color;
    c.setAttribute("aria-label", cellLabel(i));
  }

  function paintAll(): void {
    for (let i = 0; i < total; i++) paintCell(i);
    if (!mini.hidden) drawMini();
  }

  function clock(): number {
    const raw = nowMs();
    const pausedNow = paused ? raw - pauseStart : 0;
    return raw - pausedTotal - pausedNow;
  }

  function paintHud(): void {
    const budget = flagBudgetLeft(run);
    flagChip.textContent = Number.isFinite(budget)
      ? `🚩 ${budget} / ${run.opts.flagLimit}`
      : `🚩 ${flagsLeft(run.board)}`;
    flagChip.className = Number.isFinite(budget) && budget <= 0 ? "mn-chip mn-warn" : "mn-chip";
    const limit = run.opts.timeLimitMs;
    if (typeof limit === "number") {
      const left = timeLeftMs(run, clock());
      clockChip.textContent = `⏳ ${clockText(left)}`;
      clockChip.className = left <= 20000 ? "mn-chip mn-warn" : "mn-chip";
    } else {
      clockChip.textContent = `⏱ ${clockText(elapsedMs(run, clock()))}`;
    }
    doneChip.textContent = `🌼 ${percentText(runProgress(run))}`;
  }

  function finish(win: boolean, reason: FieldEndInfo["reason"]): void {
    if (finished) return;
    finished = true;
    const ms = elapsedMs(run, clock());
    if (win) {
      opts.sfx("win");
      msg.textContent = "整片花园都翻开啦！";
    } else {
      opts.sfx("oops");
      msg.textContent = loseLine(reason === "time" ? "time" : "hit");
      // 温柔揭开剩下的刺种：一颗一颗慢慢开花，绝不一下子全开
      bloomed = revealRest(run);
      const step = bloomStepMs(reduced);
      bloomed.forEach((idx, k) => {
        timers.after(() => {
          if (dead) return;
          run.board.state[idx] = OPEN;
          paintCell(idx);
        }, step * (k + 1));
      });
      for (const idx of runWrongFlags(run)) paintCell(idx);
    }
    paintAll();
    paintHud();
    if (opts.autoSettle !== false) showOver(win, ms);
    opts.onEnd?.({ win, ms, usedProtect: run.usedProtect, reason });
  }

  function showOver(win: boolean, ms: number): void {
    const ov = el("div", "mn-over");
    ov.appendChild(el("div", "mn-over-t", win ? "🌼 扫种完成！" : "🌱 这一片没扫完"));
    ov.appendChild(
      el("div", "mn-over-s", win ? `用时 ${clockText(ms)}，${run.board.mines} 颗刺种都绕开了。` : loseLine("hit"))
    );
    if (opts.onReplay) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mn-open";
      b.textContent = "🔁 再来一盘";
      b.addEventListener("click", () => {
        opts.sfx("tap");
        ov.remove();
        opts.onReplay?.();
      });
      ov.appendChild(b);
    }
    wrap.appendChild(ov);
  }

  function afterAction(res: ReturnType<typeof openAt>): void {
    if (res.first) {
      opts.onPlant?.(Uint8Array.from(run.board.mine), run.firstIndex);
      msg.textContent = run.noGuess
        ? "这一张保证能算出来，不用蒙。"
        : "看数字推刺种，拿不准就先插面小旗。";
    }
    if (res.blocked) {
      msg.textContent = "小旗用完啦，先收一面再插。";
      opts.sfx("oops");
    } else if (res.saved) {
      msg.textContent = "小铲子替你挡下了一颗刺种，已经插好小旗。";
      opts.sfx("pop");
    } else if (res.flag === "flag") {
      opts.sfx("pop");
    } else if (res.flag === "clear" || res.flag === "guess") {
      opts.sfx("tap");
    } else if (res.opened.length > 0) {
      opts.sfx("tap");
    }
    paintAll();
    paintHud();
    if (res.win) finish(true, "clear");
    else if (res.lose) finish(false, "hit");
  }

  function doOpen(i: number): void {
    if (finished || paused) return;
    if (run.board.state[i] === OPEN) {
      afterAction(chordAt(run, i, clock()));
      return;
    }
    afterAction(openAt(run, i, clock()));
  }

  function doFlag(i: number): void {
    if (finished || paused) return;
    afterAction(flagAt(run, i, clock()));
  }

  function bindCell(c: HTMLElement, i: number): void {
    let pressAt = 0;
    let longFired = false;
    let raf = 0;
    // 右键会连着发 pointerdown(button=2) 和 contextmenu，长按在有些浏览器上也会补一发 contextmenu。
    // 插旗只认第一发，后面这一小会儿的重复事件一律吞掉，免得刚插上又被自己拔掉。
    let flaggedAt = -1e9;
    const flagOnce = (): void => {
      const t = nowMs();
      if (t - flaggedAt < DOUBLE_FLAG_GUARD_MS) return;
      flaggedAt = t;
      doFlag(i);
    };

    const stopRing = (): void => {
      if (raf) timers.cancel(raf);
      raf = 0;
      c.style.removeProperty?.("--mn-press");
      c.className = c.className.replace(" mn-pressing", "");
    };

    const ring = (): void => {
      if (dead || longFired || pressAt === 0) return;
      const p = longPressProgress(nowMs() - pressAt, longPress);
      c.style.setProperty?.("--mn-press", String(p));
      if (p >= 1) {
        longFired = true;
        stopRing();
        flagOnce();
        return;
      }
      raf = timers.frame(ring);
    };

    c.addEventListener("pointerdown", (ev) => {
      const e = ev as PointerEvent;
      if (e.button === 2) {
        e.preventDefault?.();
        flagOnce();
        longFired = true;
        return;
      }
      pressAt = nowMs();
      longFired = false;
      c.className += " mn-pressing";
      raf = timers.frame(ring);
    });
    c.addEventListener("pointerup", () => {
      stopRing();
      const wasLong = longFired;
      pressAt = 0;
      longFired = false;
      if (!wasLong) doOpen(i);
    });
    c.addEventListener("pointercancel", () => {
      stopRing();
      pressAt = 0;
      longFired = false;
    });
    c.addEventListener("pointerleave", () => {
      stopRing();
      pressAt = 0;
    });
    c.addEventListener("contextmenu", (ev) => {
      (ev as Event).preventDefault?.();
      flagOnce();
      longFired = true;
    });
  }

  function togglePause(): void {
    if (finished) return;
    paused = !paused;
    if (paused) {
      pauseStart = nowMs();
      pauseBtn.textContent = "▶ 继续";
      msg.textContent = "先歇一会儿，计时停住了。";
    } else {
      pausedTotal += nowMs() - pauseStart;
      pauseBtn.textContent = "⏸ 暂停";
      msg.textContent = "接着扫。";
    }
    paintHud();
  }

  const onKey = (ev: Event): void => {
    if (dead) return;
    const e = ev as KeyboardEvent;
    const act = keyAction(e.key, scheme);
    if (!act) return;
    e.preventDefault?.();
    if (act === "pause") {
      togglePause();
      return;
    }
    if (paused || finished) return;
    if (act === "open") doOpen(run.cursor);
    else if (act === "flag") doFlag(run.cursor);
    else {
      moveRunCursor(run, act as Dir);
      paintAll();
    }
  };

  const onResize = (): void => layout();
  (globalThis as { addEventListener?: typeof window.addEventListener }).addEventListener?.("keydown", onKey);
  (globalThis as { addEventListener?: typeof window.addEventListener }).addEventListener?.("resize", onResize);

  timers.every(() => {
    if (dead || finished) return;
    paintHud();
    if (!paused && timedOut(run, clock())) {
      expire(run, clock());
      finish(false, "time");
    }
  }, 250);

  layout();
  paintAll();
  paintHud();

  return {
    run,
    el: wrap,
    elapsed: () => elapsedMs(run, clock()),
    destroy() {
      dead = true;
      timers.clear();
      (globalThis as { removeEventListener?: typeof window.removeEventListener }).removeEventListener?.(
        "keydown",
        onKey
      );
      (globalThis as { removeEventListener?: typeof window.removeEventListener }).removeEventListener?.(
        "resize",
        onResize
      );
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 闯关：188 关
// ---------------------------------------------------------------------------

export function levelRunOptions(level: MineLevel, retry = 0): RunOptions {
  return {
    w: level.w,
    h: level.h,
    mines: level.mines,
    seed: levelSeed(level.index, retry),
    noGuess: level.noGuess,
    protect: level.protect,
    fog: level.fog,
    flagLimit: level.flagLimit,
    timeLimitMs: level.timeLimitMs
  };
}

/** 关卡上方那行小字：这一关有什么特别的 */
export function levelNote(level: MineLevel): string {
  const bits = [`${level.h} 行 × ${level.w} 列 · ${level.mines} 颗刺种`];
  if (level.protect) bits.push("有一次保护");
  if (level.chordCourse) bits.push("练和弦");
  if (level.fog) bits.push("有雾");
  if (level.flagLimit) bits.push(`小旗上限 ${level.flagLimit}`);
  if (level.timeLimitMs) bits.push(`限时 ${clockText(level.timeLimitMs)}`);
  if (level.noGuess) bits.push("保证能算出来");
  return bits.join(" · ");
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const level = levelAt(ctx.level);
  const note = el("div", "mn-note", `${level.task} ${levelNote(level)}`);
  stage.appendChild(note);
  const field = mountField(stage, {
    ...levelRunOptions(level),
    title: level.title,
    sfx: ctx.sfx,
    autoSettle: false,
    onEnd: (info) => {
      if (info.win) {
        const stars = starsByTime(info.ms, level.starMs, info.usedProtect);
        ctx.win(stars, winLine(level, stars, info.ms));
      } else {
        ctx.lose(loseLine(info.reason === "time" ? "time" : "hit"));
      }
    }
  });
  return {
    destroy() {
      field.destroy();
      note.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 竞速对战 / 连续清盘 / 双人同屏
// ---------------------------------------------------------------------------

function mountVersus(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const box = el("div");
  host.appendChild(box);
  let preset = PRESETS[0];
  let tier: AiTier = "normal";
  let field: FieldHandle | null = null;
  let ai: Ai | null = null;
  const timers = new Timers();
  let seed = (Date.now() ^ 0x51ed) >>> 0;
  let dead = false;

  function clear(): void {
    timers.clear();
    field?.destroy();
    field = null;
    ai = null;
    box.textContent = "";
  }

  function setup(): void {
    clear();
    const wrap = el("div", "mn-setup");
    const r1 = el("div", "mn-row");
    r1.appendChild(el("span", "mn-label", "地块"));
    for (const p of PRESETS) {
      r1.appendChild(
        button(p.label, () => {
          api.play("tap");
          preset = p;
          setup();
        }, preset.key === p.key)
      );
    }
    const r2 = el("div", "mn-row");
    r2.appendChild(el("span", "mn-label", "对手"));
    for (const t of AI_TIERS) {
      r2.appendChild(
        button(AI_TIER_LABELS[t], () => {
          api.play("tap");
          tier = t;
          setup();
        }, tier === t)
      );
    }
    const note = el("div", "mn-note", `${AI_TIER_HINTS[tier]} 同一张图，比谁先扫完。`);
    const go = document.createElement("button");
    go.type = "button";
    go.className = "mn-open";
    go.textContent = "开始竞速 ▶";
    go.addEventListener("click", () => {
      api.play("tap");
      start();
    });
    wrap.append(r1, r2, note, go);
    box.appendChild(wrap);
  }

  function start(): void {
    clear();
    seed = (seed + 0x9e3779b9) >>> 0;
    const side = el("div", "mn-side", `🤖 ${AI_TIER_LABELS[tier]}还在等你点第一下。`);
    const bar = el("div", "mn-bar");
    const fill = el("i");
    bar.appendChild(fill);
    side.appendChild(bar);
    let over = false;

    field = mountField(box, {
      w: preset.w,
      h: preset.h,
      mines: preset.mines,
      seed,
      noGuess: true,
      sfx: (n) => api.play(n),
      title: `🤖 对手：${AI_TIER_LABELS[tier]}`,
      autoSettle: false,
      onPlant: (mine, first) => {
        // 假人和你从同一格起手，之后各扫各的
        const brain = createAi(preset.w, preset.h, mine, tier);
        ai = brain;
        const rand = makeUiRand(seed ^ 0x1234);
        let clockMs = aiFirstOpen(brain, first);
        let waitUntil = clockMs;
        fill.style.width = `${Math.round(aiProgress(brain) * 100)}%`;
        timers.every(() => {
          if (dead || over || brain.done) return;
          clockMs += AI_TICK_MS;
          if (clockMs < waitUntil) return;
          const step = aiStep(brain, rand);
          waitUntil = clockMs + step.ms;
          fill.style.width = `${Math.round(aiProgress(brain) * 100)}%`;
          if (brain.done && aiProgress(brain) >= 1) {
            over = true;
            finishRace(false);
          }
        }, AI_TICK_MS);
      },
      onEnd: (info) => {
        if (over) return;
        over = true;
        finishRace(info.win);
      },
      onReplay: () => start()
    });
    box.appendChild(side);

    function finishRace(playerWon: boolean): void {
      const ov = el("div", "mn-over");
      ov.appendChild(el("div", "mn-over-t", playerWon ? "🏆 你先扫完！" : "🌱 这一局对手快一点"));
      ov.appendChild(
        el(
          "div",
          "mn-over-s",
          playerWon
            ? `${AI_TIER_LABELS[tier]}还在慢慢数呢，这片花园是你的了。`
            : `${AI_TIER_LABELS[tier]}先扫完了，换一张图再来。`
        )
      );
      const again = document.createElement("button");
      again.type = "button";
      again.className = "mn-open";
      again.textContent = "🔁 再来一局";
      again.addEventListener("click", () => {
        api.play("tap");
        start();
      });
      const backBtn = document.createElement("button");
      backBtn.type = "button";
      backBtn.className = "mn-back";
      backBtn.textContent = "← 换难度";
      backBtn.addEventListener("click", () => {
        api.play("tap");
        setup();
      });
      ov.append(again, backBtn);
      if (playerWon) api.play("win");
      (field?.el ?? box).appendChild(ov);
    }
  }

  setup();
  return {
    destroy() {
      dead = true;
      clear();
      box.remove();
    }
  };
}

function makeUiRand(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mountEndless(host: HTMLElement, api: GameApi): { destroy: () => void } {
  const box = el("div");
  host.appendChild(box);
  let preset = PRESETS[0];
  let streak = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  let field: FieldHandle | null = null;
  let seed = (Date.now() ^ 0x2f1d) >>> 0;

  function clear(): void {
    field?.destroy();
    field = null;
    box.textContent = "";
  }

  function setup(): void {
    clear();
    const wrap = el("div", "mn-setup");
    const r1 = el("div", "mn-row");
    r1.appendChild(el("span", "mn-label", "起手地块"));
    for (const p of PRESETS) {
      r1.appendChild(
        button(p.label, () => {
          api.play("tap");
          preset = p;
          streak = 0;
          setup();
        }, preset.key === p.key)
      );
    }
    const note = el("div", "mn-note", endlessLine(streak, best, endlessMines(streak, preset)));
    const go = document.createElement("button");
    go.type = "button";
    go.className = "mn-open";
    go.textContent = streak > 0 ? "接着清 ▶" : "开始连清 ▶";
    go.addEventListener("click", () => {
      api.play("tap");
      start();
    });
    wrap.append(r1, note, go);
    box.appendChild(wrap);
  }

  function start(): void {
    clear();
    seed = (seed + 0x85ebca6b) >>> 0;
    const mines = endlessMines(streak, preset);
    field = mountField(box, {
      w: preset.w,
      h: preset.h,
      mines,
      seed,
      noGuess: true,
      sfx: (n) => api.play(n),
      title: `🔥 连清 ${streak} · ${mines} 颗`,
      autoSettle: false,
      onEnd: (info) => {
        if (info.win) {
          streak++;
          best = save.recordEndlessBest(meta.id, streak);
          api.play("coin");
        } else {
          streak = 0;
        }
        setup();
      }
    });
    const side = el("div", "mn-side", endlessLine(streak, best, mines));
    box.appendChild(side);
  }

  setup();
  return {
    destroy() {
      clear();
      box.remove();
    }
  };
}

function mountDuo(host: HTMLElement, api: GameApi): { destroy: () => void } {
  const box = el("div");
  host.appendChild(box);
  let preset = PRESETS[0];
  let left: FieldHandle | null = null;
  let right: FieldHandle | null = null;
  let seed = (Date.now() ^ 0x77aa) >>> 0;

  function clear(): void {
    left?.destroy();
    right?.destroy();
    left = null;
    right = null;
    box.textContent = "";
  }

  function setup(): void {
    clear();
    const wrap = el("div", "mn-setup");
    const r1 = el("div", "mn-row");
    r1.appendChild(el("span", "mn-label", "地块"));
    for (const p of PRESETS) {
      r1.appendChild(
        button(p.label, () => {
          api.play("tap");
          preset = p;
          setup();
        }, preset.key === p.key)
      );
    }
    const note = el(
      "div",
      "mn-note",
      "两张一模一样的图，左边朵朵（WASD 挪、F 翻开、G 插旗），右边星星（方向键挪、L 翻开、K 插旗）。谁先扫完谁赢。"
    );
    const go = document.createElement("button");
    go.type = "button";
    go.className = "mn-open";
    go.textContent = "开始 ▶";
    go.addEventListener("click", () => {
      api.play("tap");
      start();
    });
    wrap.append(r1, note, go);
    box.appendChild(wrap);
  }

  function start(): void {
    clear();
    seed = (seed + 0xc2b2ae35) >>> 0;
    const row = el("div", "mn-duo");
    const lHost = el("div");
    const rHost = el("div");
    row.append(lHost, rHost);
    box.appendChild(row);
    let over = false;

    const settle = (who: string): void => {
      if (over) return;
      over = true;
      api.play("win");
      const ov = el("div", "mn-over");
      ov.appendChild(el("div", "mn-over-t", `🌼 ${who}先扫完！`));
      ov.appendChild(el("div", "mn-over-s", "同一张图，另一边也把剩下的看完再走吧。"));
      const again = document.createElement("button");
      again.type = "button";
      again.className = "mn-open";
      again.textContent = "🔁 再来一局";
      again.addEventListener("click", () => {
        api.play("tap");
        start();
      });
      ov.appendChild(again);
      box.appendChild(ov);
    };

    const common = {
      w: preset.w,
      h: preset.h,
      mines: preset.mines,
      seed,
      noGuess: true,
      compact: true,
      sfx: (n: SoundName) => api.play(n),
      autoSettle: false
    };
    left = mountField(lHost, {
      ...common,
      scheme: "p1",
      title: "🌸 朵朵",
      onEnd: (info) => {
        if (info.win) settle("朵朵");
      }
    });
    right = mountField(rHost, {
      ...common,
      scheme: "p2",
      title: "⭐ 星星",
      onEnd: (info) => {
        if (info.win) settle("星星");
      }
    });
  }

  setup();
  return {
    destroy() {
      clear();
      box.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 模式入口条:按 meta.modes 推,不硬写
// ---------------------------------------------------------------------------

/** 这一款按 `meta.modes` 算出来的模式口径(首页玩法芯片读的是同一份 meta) */
export const MODE_COMPAT = compatFromMeta(meta);

/** 本款自己的入口名 ↔ 三大类的对应关系;顺序就是入口条从左到右的顺序 */
const MODE_ENTRIES: ModeEntry<ExtraMode>[] = [
  { key: "versus", kind: "versus", versusKind: "ai" },
  { key: "endless", kind: "endless" },
  { key: "duo", kind: "versus", versusKind: "hotseat" }
];

/**
 * 真正摆出来的入口。
 * 以前这里是硬写的 `["versus","endless","duo"]`,`meta.modes` 一改就与首页芯片各说各话;
 * 现在少写一个模式,入口条自己就少一个按钮。
 */
export const MODE_KEYS: ExtraMode[] = modeEntryKeys(MODE_COMPAT, MODE_ENTRIES);

/** 模式菜单顶上那句话,措辞走 `describeModes` 的共享口径,十二款不各写各的 */
export const MODE_SUMMARY = describeModes(MODE_COMPAT);

export function mount(api: GameApi): { destroy: () => void } {
  const root = el("div", "mn-wrap");
  const style = document.createElement("style");
  style.textContent = MN_CSS;
  const bar = el("div", "mn-modebar");
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", MODE_SUMMARY);
  const modeTip = document.createElement("p");
  modeTip.className = "mn-modetip";
  modeTip.textContent = MODE_SUMMARY;
  bar.appendChild(modeTip);
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let extra: { destroy: () => void } | null = null;

  function closeExtra(): void {
    extra?.destroy();
    extra = null;
    modeHost.textContent = "";
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
  }

  MODE_KEYS.forEach((key) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mn-open";
    btn.textContent = MODE_LABELS[key];
    btn.addEventListener("click", () => {
      if (extra) return;
      api.play("tap");
      levelHost.hidden = true;
      bar.hidden = true;
      modeHost.hidden = false;
      const backBtn = document.createElement("button");
      backBtn.type = "button";
      backBtn.className = "mn-back";
      backBtn.textContent = "← 回闯关";
      backBtn.addEventListener("click", () => {
        api.play("tap");
        closeExtra();
      });
      modeHost.appendChild(backBtn);
      extra =
        key === "versus"
          ? mountVersus(modeHost, api, closeExtra)
          : key === "endless"
            ? mountEndless(modeHost, api)
            : mountDuo(modeHost, api);
    });
    bar.appendChild(btn);
  });

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "数字说的是它周围 8 格里有几颗刺种。第一下永远安全，放心点。",
      grandMessage: "188 关全部扫完，从小苗床一路扫到园丁杯，这片花园全开了！",
      guide,
      guideTitle: "扫雷花园 · 扫种笔记"
    }
  );

  return {
    destroy() {
      extra?.destroy();
      extra = null;
      level.destroy();
      root.remove();
    }
  };
}

/** 给测试钉住的关键常量与工具 */
export const MG_CONSTS = {
  minCell: MIN_CELL,
  longPress: LONG_PRESS_MS,
  flip: flipMs(false),
  bloom: bloomStepMs(false),
  presets: PRESETS,
  hintColors: HINT_COLORS
};
