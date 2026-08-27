import { meta } from "./meta";
export { meta };

// 数独花田:每一行、每一列、每一朵九宫花都要种满 1 到 9。
// 188 关战役 + 同题竞速的对战 + 错三题结束的无尽 + 左右分盘的同屏双人,对手是本机假人,全程离线。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { save } from "../../engine/save";
import {
  EMPTY,
  cellsFromString,
  conflictsAt,
  isSolved,
  maskToDigits,
  rowOf,
  colOf,
  type SudokuBoard,
  type Variant
} from "./solver";
import { TECHNIQUE_LABELS, allowedUpTo, nextTechnique, type TechniqueHint } from "./techniques";
import { bankAt, boardFromBank, solutionOfBank, variantOfBank, type BankEntry } from "./puzzles";
import {
  CHAPTERS,
  DUO_LEVELS,
  VERSUS_LEVELS,
  endlessConfig,
  endlessPick,
  goalLine,
  levelSpec,
  loseLine,
  starsByTimeAndErrors,
  winLine,
  type EndlessKind,
  type LevelSpec
} from "./levels";
import {
  AI_PROFILES,
  AI_TIERS,
  AI_TIER_BLURBS,
  AI_TIER_LABELS,
  nextMove,
  profileOf,
  type AiTier
} from "./ai";
import guide from "./guide";

/** 一朵花开完要多久 */
export const BLOOM_MS = 420;
/** 九宫依次开花,每宫错开这么久(规格硬性要求) */
export const BLOOM_STEP_MS = 100;
/** 省电 / 减少动态效果时开花缩到这么短 */
export const BLOOM_STEP_REDUCED_MS = 30;
/** 填进一个数字时那一下小缩放 */
export const POP_MS = 140;
/** 每格最小边长(360px 窄屏的红线) */
export const CELL_MIN_PX = 34;
/** 每格最大边长,大屏上也别撑成巨无霸 */
export const CELL_MAX_PX = 56;
/** 数字钮的最小高度(手指红线) */
export const KEY_MIN_PX = 46;
/** 盘面数字的最小字号 */
export const FONT_MIN_PX = 16;

/**
 * 360px 窄屏也要塞得下:盘面占满宽,每格不小于 34px。
 * 两块盘只有在够宽的时候才真的左右分,窄屏自动上下摞着放。
 */
export function cellPxFor(n: number, width: number, seats = 1): number {
  const w = Number.isFinite(width) && width > 0 ? width : 480;
  const usable = Math.max(220, w - 24);
  const per = seats > 1 && usable >= 720 ? usable / seats - 16 : usable;
  const raw = Math.floor((per - (n - 1) - 6) / n);
  return Math.max(CELL_MIN_PX, Math.min(CELL_MAX_PX, raw));
}

/** 盘面数字的字号:跟着格子走,但绝不小于 16px */
export function digitFontPx(cell: number): number {
  return Math.max(FONT_MIN_PX, Math.round(cell * 0.52));
}

/** 铅笔笔记的小字号(草稿性质,比正文小一号) */
export function noteFontPx(cell: number): number {
  return Math.max(9, Math.round(cell * 0.27));
}

/** 第 i 朵花什么时候开(依次错开;减少动态效果时缩短) */
export function bloomDelayMs(regionIndex: number, reduced = false): number {
  return regionIndex * (reduced ? BLOOM_STEP_REDUCED_MS : BLOOM_STEP_MS);
}

function reducedMotion(): boolean {
  try {
    const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    return mm ? mm("(prefers-reduced-motion: reduce)").matches : false;
  } catch {
    return false;
  }
}

function viewportWidth(): number {
  const w = (globalThis as { innerWidth?: number }).innerWidth;
  return typeof w === "number" && w > 0 ? w : 480;
}

// ---------------------------------------------------------------------------
// 键位
// ---------------------------------------------------------------------------

export type Who = "duo" | "star";

export type SeatAction =
  | { type: "move"; dr: number; dc: number }
  | { type: "fill" }
  | { type: "pencil" }
  | { type: "digit"; digit: number };

const DUO_MOVE: Record<string, [number, number]> = {
  w: [-1, 0],
  s: [1, 0],
  a: [0, -1],
  d: [0, 1]
};

const STAR_MOVE: Record<string, [number, number]> = {
  arrowup: [-1, 0],
  arrowdown: [1, 0],
  arrowleft: [0, -1],
  arrowright: [0, 1]
};

/**
 * 键盘按下 → 这一座位要做什么。
 * 朵朵 `WASD` + `F`(填入) + `G`(切铅笔);星星 方向键 + `L`(填入) + `K`(切铅笔)。
 * 数字键 1–9 两边都能直接填(单人玩的时候最顺手)。
 */
export function keyAction(key: string, who: Who, soloDigits = true): SeatAction | null {
  const k = String(key ?? "").toLowerCase();
  const move = who === "duo" ? DUO_MOVE[k] : STAR_MOVE[k];
  if (move) return { type: "move", dr: move[0], dc: move[1] };
  if (who === "duo" && k === "f") return { type: "fill" };
  if (who === "duo" && k === "g") return { type: "pencil" };
  if (who === "star" && k === "l") return { type: "fill" };
  if (who === "star" && k === "k") return { type: "pencil" };
  if (soloDigits && /^[1-9]$/.test(k)) return { type: "digit", digit: Number.parseInt(k, 10) };
  return null;
}

// ---------------------------------------------------------------------------
// 笔记(位掩码)
// ---------------------------------------------------------------------------

/** 在笔记里加 / 去掉一个数字 */
export function toggleNote(mask: number, digit: number): number {
  if (digit < 1 || digit > 9) return mask;
  return mask ^ (1 << digit);
}

/** 笔记里记了哪几个数字 */
export function noteDigits(mask: number): number[] {
  return maskToDigits(mask);
}

export interface SeatSnapshot {
  cells: number[];
  notes: number[];
}

/**
 * 完成判定:**只看真正填进去的数字**,铅笔笔记一概不算。
 * 满盘小字也不会被误判成种完了。
 */
export function isFilledComplete(variant: Variant, snap: SeatSnapshot): boolean {
  return isSolved({ variant, cells: snap.cells });
}

/** 错够次数了没(errorLimit 为 0 表示这一局不判负) */
export function isOutOfTries(errors: number, errorLimit: number): boolean {
  return errorLimit > 0 && errors >= errorLimit;
}

// ---------------------------------------------------------------------------
// 读屏播报
//
// 格子自己有 aria-label,读屏点到哪一格能念哪一格;但「刚才那一手成没成、
// 还剩多少朵、还能错几次」只有看得见的人知道。下面几句短话写进看不见的 live 区,
// 只在真的落子 / 擦掉 / 收场时写,光挪光标不写(挪得快会把读屏刷屏)。
// ---------------------------------------------------------------------------

/** 「第 3 行第 5 列」这半句,和格子 aria-label 一个口径 */
export function cellSay(idx: number, n: number): string {
  return `第${Math.floor(idx / n) + 1}行第${(idx % n) + 1}列`;
}

/** 种对了 */
export function fillSay(idx: number, n: number, digit: number, leftHoles: number): string {
  const tail = leftHoles > 0 ? `还剩 ${leftHoles} 朵` : "花田种满啦";
  return `${cellSay(idx, n)}种下 ${digit},${tail}。`;
}

/** 种错了:还能错几次要说清楚,errorLimit 为 0 时不吓唬人 */
export function wrongSay(idx: number, n: number, digit: number, errors: number, errorLimit: number): string {
  const tail = errorLimit > 0 ? `还能改 ${Math.max(0, errorLimit - errors)} 次` : "再看看同一行同一列";
  return `${cellSay(idx, n)}的 ${digit} 先放一放,${tail}。`;
}

/** 擦掉一格 */
export function clearSay(idx: number, n: number): string {
  return `${cellSay(idx, n)}擦干净了。`;
}

/** 一盘收场 */
export function doneSay(solved: boolean, filled: number, errors: number): string {
  if (solved) return `花田开满啦,一共种了 ${filled} 朵,错了 ${errors} 次。`;
  return `这一盘先到这里,种了 ${filled} 朵。歇一会儿再来。`;
}

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

/** 异形宫的九块淡彩:光靠边框看不清形状,再垫一层很浅的底色 */
const REGION_TINTS = [
  "#FFFFFF",
  "#FBF4FF",
  "#F3F8FF",
  "#FFF7F0",
  "#F2FBF4",
  "#FFF4F8",
  "#F6F4FF",
  "#FFFBEE",
  "#F1F9FB"
];

export const SP_CSS = `
.sp-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#F7F2FF,#FFF6FB);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;}
.sp-top{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:8px;}
.sp-badge{background:#fff;border-radius:14px;padding:5px 10px;font-weight:800;font-size:14px;color:#5f4a8a;
  box-shadow:0 2px 6px rgba(150,130,200,.25);overflow-wrap:anywhere;min-width:0;}
.sp-seats{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;justify-content:center;}
.sp-seat{display:flex;flex-direction:column;gap:6px;align-items:center;max-width:100%;min-width:0;}
.sp-name{font-size:14px;font-weight:900;color:#5f4a8a;overflow-wrap:anywhere;text-align:center;}
.sp-grid{display:grid;gap:1px;background:#CFC1EC;border-radius:12px;padding:3px;flex:0 0 auto;}
.sp-cell{position:relative;display:flex;align-items:center;justify-content:center;border:none;padding:0;margin:0;
  font-family:inherit;font-weight:900;line-height:1;cursor:pointer;color:#3f7f9c;background:#fff;}
.sp-cell.sp-given{color:#4a3a75;background:#F4F0FF;}
.sp-cell.sp-peer{background:#F6F1FF;}
.sp-cell.sp-same{background:#EADFFF;}
.sp-cell.sp-bad{background:#FFDFE6;color:#A93A57;}
.sp-cell.sp-cur{outline:3px solid #9A7BD8;outline-offset:-3px;z-index:2;}
.sp-cell.sp-hint{background:#FFF2C9;}
.sp-cell.sp-pop{animation:sppop ${POP_MS}ms ease-out;}
.sp-cell:focus-visible{outline:3px solid #3c2a6b;outline-offset:-3px;}
@keyframes sppop{0%{transform:scale(.72)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
.sp-petal{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;
  opacity:0;font-size:80%;}
.sp-cell.sp-bloom .sp-petal{animation:spbloom ${BLOOM_MS}ms ease-out forwards;}
@keyframes spbloom{0%{opacity:0;transform:scale(.2) rotate(-40deg)}70%{opacity:1;transform:scale(1.15) rotate(6deg)}
  100%{opacity:1;transform:scale(1) rotate(0)}}
.sp-notes{position:absolute;inset:2px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);
  color:#8E7FB6;font-weight:700;line-height:1;pointer-events:none;}
.sp-note{display:flex;align-items:center;justify-content:center;}
.sp-pad{display:grid;grid-template-columns:repeat(9,1fr);gap:3px;width:100%;margin-top:6px;}
.sp-key{min-height:${KEY_MIN_PX}px;border:none;border-radius:12px;font-family:inherit;font-size:18px;font-weight:900;
  cursor:pointer;background:#EDE4FF;color:#4c3f85;box-shadow:0 3px 0 #CDBDF0;padding:0;}
.sp-key:active{transform:translateY(2px);box-shadow:0 1px 0 #CDBDF0;}
.sp-key.sp-key-done{opacity:.42;}
.sp-tools{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:6px;}
.sp-tool{min-height:44px;min-width:44px;border:none;border-radius:14px;font-family:inherit;font-size:15px;
  font-weight:900;cursor:pointer;background:#FFE9F2;color:#8d3f66;box-shadow:0 3px 0 #F0C4D8;padding:0 12px;}
.sp-tool:active{transform:translateY(2px);box-shadow:0 1px 0 #F0C4D8;}
.sp-tool.sp-on{background:#D9F0DC;color:#2f6b3c;box-shadow:0 3px 0 #AFD9B6;}
.sp-key:focus-visible,.sp-tool:focus-visible,.sp-open:focus-visible,.sp-back:focus-visible{outline:3px solid #3c2a6b;outline-offset:3px;}
.sp-msg{text-align:center;min-height:20px;color:#5f4a8a;font-weight:800;margin-top:6px;font-size:16px;
  overflow-wrap:anywhere;line-height:1.5;max-width:340px;}
.sp-hintbox{background:#FFFBEA;border-radius:12px;padding:8px 10px;font-size:14px;font-weight:700;color:#7a5f1e;
  line-height:1.6;max-width:340px;text-align:left;}
/* 只给读屏听的一行:看不见、不占位,落子成没成靠它 */
.sp-say{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;
  clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;}
.sp-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.sp-open{border:none;border-radius:999px;padding:9px 18px;font-size:15px;min-height:44px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#8E6BD0,#7554B8);box-shadow:0 4px 0 #5B3F93;}
.sp-open:active{transform:translateY(2px);box-shadow:0 2px 0 #5B3F93;}
.sp-mode{max-width:860px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;}
.sp-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;}
.sp-back{border:none;border-radius:999px;padding:8px 14px;min-height:44px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffd9;color:#6b4f9c;box-shadow:0 3px 0 rgba(120,90,160,.25);}
.sp-back:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.25);}
.sp-pause{margin-top:10px;text-align:center;font-size:15px;font-weight:900;color:#6b4f9c;}
@media (max-width:420px){
  .sp-wrap{padding:7px;}
  .sp-seats{gap:10px;}
  .sp-key{font-size:17px;}
}
@media (prefers-reduced-motion:reduce){
  .sp-cell.sp-pop{animation:none;}
  .sp-cell.sp-bloom .sp-petal{animation-duration:120ms;}
}
`;

// ---------------------------------------------------------------------------
// 一块盘(座位)
// ---------------------------------------------------------------------------

export interface SeatOpts {
  name: string;
  /** 人类座位吃哪一套键位;假人座位填 null */
  who: Who | null;
  /** 假人档位;人类座位不填 */
  ai?: AiTier;
  entry: BankEntry;
  cell: number;
  /** 错几次算失败;0 表示这一局不判负 */
  errorLimit: number;
  /** 允许提示用到哪一档技巧 */
  hintTier: LevelSpec["tier"];
  sfx: (name: SoundName) => void;
  onDone: (state: SeatState) => void;
  /** 每错一次通知一次(无尽用它记错题) */
  onError?: (errors: number) => void;
}

export interface SeatState {
  name: string;
  solved: boolean;
  failed: boolean;
  errors: number;
  /** 已经填进去的格子数(不含题面原有的) */
  filled: number;
  holes: number;
}

export interface Seat {
  el: HTMLElement;
  state: () => SeatState;
  /** 键盘 / 数字钮统一从这里进 */
  act: (action: SeatAction) => void;
  /** 假人推进一步 */
  stepAi: (roll: number) => void;
  /** 这一步该不该轮到假人动了 */
  aiStepMs: number;
  finished: () => boolean;
  destroy: () => void;
}

export function createSeat(host: HTMLElement, opts: SeatOpts): Seat {
  const board = boardFromBank(opts.entry);
  const solution = solutionOfBank(opts.entry);
  const variant = board.variant;
  const n = variant.n;
  const given = board.cells.map((v) => v > EMPTY);
  const holes = given.filter((g) => !g).length;
  const notes = new Array<number>(n * n).fill(0);

  let cursor = board.cells.findIndex((v) => v === EMPTY);
  if (cursor < 0) cursor = 0;
  let pencil = false;
  let errors = 0;
  let solved = false;
  let failed = false;
  let hint: TechniqueHint | null = null;
  let popAt = -1;
  let aiSlipAt = -1;
  const timers: Array<ReturnType<typeof setTimeout>> = [];

  const wrap = document.createElement("div");
  wrap.className = "sp-seat";

  const name = document.createElement("div");
  name.className = "sp-name";
  name.textContent = opts.name;

  const grid = document.createElement("div");
  grid.className = "sp-grid";
  grid.style.gridTemplateColumns = `repeat(${n},${opts.cell}px)`;
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", `${opts.name}的花田`);

  const cells: HTMLElement[] = [];
  const petals: HTMLElement[] = [];
  const noteBoxes: HTMLElement[] = [];
  const digitFont = digitFontPx(opts.cell);
  const noteFont = noteFontPx(opts.cell);

  for (let i = 0; i < n * n; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "sp-cell";
    cell.style.width = `${opts.cell}px`;
    cell.style.height = `${opts.cell}px`;
    cell.style.fontSize = `${digitFont}px`;
    cell.style.setProperty("--sp-tint", REGION_TINTS[variant.regions[i] % REGION_TINTS.length]);
    // 宫的分界线用 inset 阴影画,不占位、不会把格子挤歪
    cell.style.boxShadow = regionEdgeShadow(variant, i);
    const petal = document.createElement("span");
    petal.className = "sp-petal";
    petal.textContent = "🌸";
    const noteBox = document.createElement("span");
    noteBox.className = "sp-notes";
    noteBox.style.fontSize = `${noteFont}px`;
    cell.append(petal, noteBox);
    cell.addEventListener("click", () => {
      if (solved || failed) return;
      cursor = i;
      hint = null;
      opts.sfx("tap");
      render();
    });
    grid.appendChild(cell);
    cells.push(cell);
    petals.push(petal);
    noteBoxes.push(noteBox);
  }

  const pad = document.createElement("div");
  pad.className = "sp-pad";
  const keys: HTMLElement[] = [];
  for (let d = 1; d <= n; d++) {
    const key = document.createElement("button");
    key.type = "button";
    key.className = "sp-key";
    key.textContent = String(d);
    key.setAttribute("aria-label", `种下 ${d}`);
    key.addEventListener("click", () => act({ type: "digit", digit: d }));
    pad.appendChild(key);
    keys.push(key);
  }
  pad.style.gridTemplateColumns = `repeat(${n},1fr)`;

  const tools = document.createElement("div");
  tools.className = "sp-tools";
  const pencilBtn = document.createElement("button");
  pencilBtn.type = "button";
  pencilBtn.className = "sp-tool";
  pencilBtn.textContent = "✏️ 铅笔";
  pencilBtn.addEventListener("click", () => act({ type: "pencil" }));
  const eraseBtn = document.createElement("button");
  eraseBtn.type = "button";
  eraseBtn.className = "sp-tool";
  eraseBtn.textContent = "🧽 擦掉";
  eraseBtn.addEventListener("click", () => clearAt(cursor));
  const hintBtn = document.createElement("button");
  hintBtn.type = "button";
  hintBtn.className = "sp-tool";
  hintBtn.textContent = "💡 提示";
  hintBtn.addEventListener("click", () => askHint());
  tools.append(pencilBtn, eraseBtn, hintBtn);

  const hintBox = document.createElement("div");
  hintBox.className = "sp-hintbox";
  hintBox.hidden = true;

  const msg = document.createElement("div");
  msg.className = "sp-msg";
  msg.setAttribute("role", "status");
  msg.setAttribute("aria-live", "polite");
  msg.setAttribute("aria-atomic", "true");
  msg.textContent = opts.ai ? AI_TIER_BLURBS[opts.ai] : "点一个格子,再按下面的数字钮种进去。";

  // 看不见的一行:落子成没成、还剩多少朵,读屏靠它知道
  const say = document.createElement("div");
  say.className = "sp-say";
  say.setAttribute("role", "status");
  say.setAttribute("aria-live", "polite");
  say.setAttribute("aria-atomic", "true");

  wrap.append(name, grid);
  if (opts.who) wrap.append(pad, tools, hintBox);
  wrap.append(msg, say);
  host.appendChild(wrap);

  /** 只有人在玩的那块盘才播;假人一步一句会把读屏刷屏 */
  function announce(text: string): void {
    if (!opts.who) return;
    if (say.textContent === text) return;
    say.textContent = text;
  }

  /** 还有几朵没种(种满了就是 0) */
  function leftHoles(): number {
    return board.cells.filter((v, i) => v === EMPTY && !given[i]).length;
  }

  function snapshot(): SeatSnapshot {
    return { cells: board.cells, notes };
  }

  function state(): SeatState {
    return {
      name: opts.name,
      solved,
      failed,
      errors,
      filled: board.cells.filter((v, i) => v > EMPTY && !given[i]).length,
      holes
    };
  }

  function clearAt(idx: number): void {
    if (solved || failed || given[idx]) return;
    if (board.cells[idx] === EMPTY && notes[idx] === 0) return;
    board.cells[idx] = EMPTY;
    notes[idx] = 0;
    hint = null;
    opts.sfx("tap");
    announce(clearSay(idx, n));
    render();
  }

  function askHint(): void {
    if (solved || failed) return;
    hint = nextTechnique(board, allowedUpTo(opts.hintTier));
    opts.sfx("meow");
    render();
  }

  /** 往一格里种一个数字。铅笔模式下只写小字,不动正文 */
  function place(idx: number, digit: number): void {
    if (solved || failed || given[idx]) {
      if (given[idx]) msg.textContent = "这一格是花田原本就有的,换一格试试。";
      return;
    }
    if (pencil) {
      notes[idx] = toggleNote(notes[idx], digit);
      opts.sfx("tap");
      hint = null;
      render();
      return;
    }
    if (board.cells[idx] === digit) {
      clearAt(idx);
      return;
    }
    board.cells[idx] = digit;
    notes[idx] = 0;
    popAt = idx;
    hint = null;

    if (digit !== solution[idx]) {
      errors += 1;
      opts.sfx("oops");
      msg.textContent =
        opts.errorLimit > 0
          ? `这一朵先放一放,还能改 ${Math.max(0, opts.errorLimit - errors)} 次。`
          : "这一朵先放一放,再看看同一行同一列。";
      announce(wrongSay(idx, n, digit, errors, opts.errorLimit));
      opts.onError?.(errors);
      if (isOutOfTries(errors, opts.errorLimit)) {
        failed = true;
        render();
        announce(doneSay(false, state().filled, errors));
        opts.onDone(state());
        return;
      }
    } else {
      opts.sfx("pop");
      // 种对了就顺手把同行同列同花的笔记里这个数字划掉
      const bit = 1 << digit;
      for (const g of variant.cellGroups[idx]) {
        for (const cell of variant.groups[g]) notes[cell] &= ~bit;
      }
      msg.textContent = "";
      announce(fillSay(idx, n, digit, leftHoles()));
    }

    render();
    if (isFilledComplete(variant, snapshot())) {
      solved = true;
      opts.sfx("win");
      announce(doneSay(true, state().filled, errors));
      bloom();
      opts.onDone(state());
    }
  }

  /** 完成时九宫依次开花,每宫错开 100ms */
  function bloom(): void {
    const reduced = reducedMotion();
    for (let r = 0; r < n; r++) {
      const delay = bloomDelayMs(r, reduced);
      const id = setTimeout(() => {
        for (let i = 0; i < n * n; i++) {
          if (variant.regions[i] === r) cells[i].classList.add("sp-bloom");
        }
        if (r === n - 1) opts.sfx("coin");
      }, delay);
      timers.push(id);
    }
  }

  function act(action: SeatAction): void {
    if (solved || failed) return;
    switch (action.type) {
      case "move": {
        const r = Math.min(n - 1, Math.max(0, rowOf(cursor, n) + action.dr));
        const c = Math.min(n - 1, Math.max(0, colOf(cursor, n) + action.dc));
        cursor = r * n + c;
        hint = null;
        render();
        break;
      }
      case "pencil":
        pencil = !pencil;
        opts.sfx("tap");
        msg.textContent = pencil ? "铅笔打开了,现在写的是小字草稿,不算种下去。" : "铅笔收起来了,现在是真的种花。";
        render();
        break;
      case "fill": {
        // F / L 是「把光标这一格里唯一还能放的那个数字种下去」的快捷键:
        // 只在真的只剩一种可能时才动手,想不清楚就什么也不做,不会替你猜。
        const only = onlyCandidate(cursor);
        if (only > 0) place(cursor, only);
        else msg.textContent = "这一格还不止一种可能,先按数字钮挑一个吧。";
        break;
      }
      case "digit":
        if (action.digit >= 1 && action.digit <= n) place(cursor, action.digit);
        break;
      default:
        break;
    }
  }

  /** 光标这一格是不是只剩唯一一种可能;不是就返回 0 */
  function onlyCandidate(idx: number): number {
    if (given[idx] || board.cells[idx] > EMPTY) return 0;
    let found = 0;
    for (let d = 1; d <= n; d++) {
      const probe: SudokuBoard = { variant, cells: board.cells };
      const before = probe.cells[idx];
      probe.cells[idx] = EMPTY;
      const ok = conflictFree(probe, idx, d);
      probe.cells[idx] = before;
      if (!ok) continue;
      if (found) return 0;
      found = d;
    }
    return found;
  }

  function conflictFree(b: SudokuBoard, idx: number, digit: number): boolean {
    for (const g of b.variant.cellGroups[idx]) {
      for (const cell of b.variant.groups[g]) {
        if (cell !== idx && b.cells[cell] === digit) return false;
      }
    }
    return true;
  }

  /** 假人走一步:按最小技巧路径填,档位高的又快又准 */
  function stepAi(roll: number): void {
    if (solved || failed || !opts.ai) return;
    if (aiSlipAt >= 0) {
      // 上一步故意种错了,这一步自己发现并改回来
      board.cells[aiSlipAt] = EMPTY;
      aiSlipAt = -1;
      render();
      return;
    }
    const move = nextMove(board, roll, profileOf(opts.ai));
    if (!move) return;
    board.cells[move.idx] = move.digit;
    if (move.slip) aiSlipAt = move.idx;
    popAt = move.idx;
    render();
    if (isFilledComplete(variant, snapshot())) {
      solved = true;
      bloom();
      opts.onDone(state());
    }
  }

  function render(): void {
    const curDigit = board.cells[cursor];
    const peers = new Set<number>();
    for (const g of variant.cellGroups[cursor]) {
      for (const cell of variant.groups[g]) peers.add(cell);
    }
    const bad = new Set<number>();
    for (let i = 0; i < n * n; i++) {
      if (board.cells[i] > EMPTY && conflictsAt(board, i).length > 0) bad.add(i);
    }
    const focus = new Set(hint?.focus ?? []);

    for (let i = 0; i < n * n; i++) {
      const cell = cells[i];
      const digit = board.cells[i];
      const classes = ["sp-cell"];
      if (given[i]) classes.push("sp-given");
      if (peers.has(i) && i !== cursor) classes.push("sp-peer");
      if (curDigit > EMPTY && digit === curDigit) classes.push("sp-same");
      if (focus.has(i)) classes.push("sp-hint");
      if (bad.has(i)) classes.push("sp-bad");
      if (i === cursor && opts.who) classes.push("sp-cur");
      if (i === popAt) classes.push("sp-pop");
      if (cell.classList.contains("sp-bloom")) classes.push("sp-bloom");
      cell.className = classes.join(" ");
      cell.style.background = classes.length === 1 ? REGION_TINTS[variant.regions[i] % REGION_TINTS.length] : "";
      cell.setAttribute(
        "aria-label",
        `第${rowOf(i, n) + 1}行第${colOf(i, n) + 1}列${digit > EMPTY ? `,种着 ${digit}` : ",还空着"}`
      );

      // 正文数字与铅笔小字二选一显示
      const noteBox = noteBoxes[i];
      noteBox.innerHTML = "";
      if (digit > EMPTY) {
        setCellText(cell, String(digit));
      } else {
        setCellText(cell, "");
        for (const d of noteDigits(notes[i])) {
          const dot = document.createElement("span");
          dot.className = "sp-note";
          dot.textContent = String(d);
          dot.style.gridColumn = String(((d - 1) % 3) + 1);
          dot.style.gridRow = String(Math.floor((d - 1) / 3) + 1);
          noteBox.appendChild(dot);
        }
      }
    }
    popAt = -1;

    // 已经种满九次的数字把钮暗下去,一眼看出还缺哪个
    for (let d = 1; d <= n; d++) {
      const used = board.cells.filter((v) => v === d).length;
      keys[d - 1].className = used >= n ? "sp-key sp-key-done" : "sp-key";
    }
    pencilBtn.className = pencil ? "sp-tool sp-on" : "sp-tool";
    if (hint) {
      hintBox.hidden = false;
      hintBox.textContent = `💡 ${TECHNIQUE_LABELS[hint.kind]}:${hint.text}`;
    } else {
      hintBox.hidden = true;
      hintBox.textContent = "";
    }
  }

  /** 格子里既有小字层又有花瓣层,正文要单独挂一个文本节点,不能直接 textContent */
  function setCellText(cell: HTMLElement, text: string): void {
    const holder = cell.querySelector(".sp-digit");
    if (holder instanceof HTMLElement) {
      holder.textContent = text;
      return;
    }
    const span = document.createElement("span");
    span.className = "sp-digit";
    span.textContent = text;
    cell.appendChild(span);
  }

  render();

  return {
    el: wrap,
    state,
    act,
    stepAi,
    aiStepMs: opts.ai ? AI_PROFILES[opts.ai].stepMs : 0,
    finished: () => solved || failed,
    destroy() {
      for (const id of timers) clearTimeout(id);
      timers.length = 0;
      wrap.remove();
    }
  };
}

/** 一格四条边里哪几条是宫的分界:用 inset 阴影画出来,不占位置 */
export function regionEdgeShadow(variant: Variant, idx: number): string {
  const n = variant.n;
  const r = rowOf(idx, n);
  const c = colOf(idx, n);
  const mine = variant.regions[idx];
  const line = "#8874BE";
  const parts: string[] = [];
  if (r === 0 || variant.regions[idx - n] !== mine) parts.push(`inset 0 2px 0 ${line}`);
  if (r === n - 1 || variant.regions[idx + n] !== mine) parts.push(`inset 0 -2px 0 ${line}`);
  if (c === 0 || variant.regions[idx - 1] !== mine) parts.push(`inset 2px 0 0 ${line}`);
  if (c === n - 1 || variant.regions[idx + 1] !== mine) parts.push(`inset -2px 0 0 ${line}`);
  return parts.join(",");
}

// ---------------------------------------------------------------------------
// 一张桌子(一个或两个座位 + 计时 + 暂停 + 键盘)
// ---------------------------------------------------------------------------

export interface TableOpts {
  goalText: string;
  hint?: string;
  banner?: string;
  seats: SeatOpts[];
  /** 全部座位都结束时回调 */
  onOver: (states: SeatState[], ms: number) => void;
}

export function createTable(stage: HTMLElement, opts: TableOpts): { destroy: () => void; elapsedMs: () => number } {
  const wrap = document.createElement("div");
  wrap.className = "sp-wrap";

  const top = document.createElement("div");
  top.className = "sp-top";
  const goal = document.createElement("span");
  goal.className = "sp-badge";
  goal.textContent = `🎯 ${opts.goalText}`;
  const clock = document.createElement("span");
  clock.className = "sp-badge";
  clock.textContent = "⏱️ 0 秒";
  top.append(goal, clock);
  if (opts.banner) {
    const banner = document.createElement("span");
    banner.className = "sp-badge";
    banner.textContent = opts.banner;
    top.appendChild(banner);
  }

  const seatsHost = document.createElement("div");
  seatsHost.className = "sp-seats";
  const pauseLine = document.createElement("div");
  pauseLine.className = "sp-pause";
  // 暂停 / 继续这一下读屏也要立刻听见
  pauseLine.setAttribute("role", "status");
  pauseLine.setAttribute("aria-live", "polite");
  pauseLine.setAttribute("aria-atomic", "true");
  pauseLine.textContent = "";

  wrap.append(top, seatsHost, pauseLine);
  if (opts.hint) {
    const hint = document.createElement("div");
    hint.className = "sp-msg";
    hint.textContent = opts.hint;
    wrap.appendChild(hint);
  }
  stage.appendChild(wrap);

  let over = false;
  let paused = false;
  let elapsed = 0;
  let last = -1;
  let raf = 0;
  const aiClock = new Map<number, number>();
  let rolls = 1;

  const seats = opts.seats.map((so) =>
    createSeat(seatsHost, {
      ...so,
      onDone: () => {
        so.onDone(seatOf(so.name));
        checkOver();
      }
    })
  );

  function seatOf(name: string): SeatState {
    const hit = seats.find((s) => s.state().name === name);
    return hit ? hit.state() : { name, solved: false, failed: false, errors: 0, filled: 0, holes: 0 };
  }

  function checkOver(): void {
    if (over) return;
    // 任意一个座位结束就收桌:竞速里谁先种完谁赢,单人盘只有自己
    if (!seats.some((s) => s.finished())) return;
    over = true;
    opts.onOver(
      seats.map((s) => s.state()),
      elapsed
    );
  }

  function tick(ts: number): void {
    if (over) return;
    if (last < 0) last = ts;
    const dt = Math.max(0, Math.min(200, ts - last));
    last = ts;
    if (!paused) {
      elapsed += dt;
      clock.textContent = `⏱️ ${Math.round(elapsed / 1000)} 秒`;
      seats.forEach((seat, i) => {
        if (seat.aiStepMs <= 0 || seat.finished()) return;
        const due = (aiClock.get(i) ?? 0) + dt;
        if (due >= seat.aiStepMs) {
          aiClock.set(i, 0);
          rolls = (rolls * 1103515245 + 12345) % 2147483647;
          seat.stepAi((rolls % 1000) / 1000);
          checkOver();
        } else {
          aiClock.set(i, due);
        }
      });
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  const onKey = (e: KeyboardEvent): void => {
    if (over) return;
    if (e.key === "Escape") {
      paused = !paused;
      pauseLine.textContent = paused ? "⏸️ 暂停中,再按一次 Esc 继续。" : "";
      e.preventDefault();
      return;
    }
    if (paused) return;
    // 只有一块人类盘时数字键直接落子;两块盘同屏时数字键留给触屏,免得抢位
    const humans = opts.seats.filter((s) => s.who).length;
    for (let i = 0; i < seats.length; i++) {
      const who = opts.seats[i].who;
      if (!who) continue;
      const action = keyAction(e.key, who, humans === 1);
      if (action) {
        seats[i].act(action);
        e.preventDefault();
        break;
      }
    }
  };
  (globalThis as { addEventListener?: typeof window.addEventListener }).addEventListener?.("keydown", onKey);

  return {
    elapsedMs: () => elapsed,
    destroy() {
      over = true;
      cancelAnimationFrame(raf);
      (globalThis as { removeEventListener?: typeof window.removeEventListener }).removeEventListener?.(
        "keydown",
        onKey
      );
      for (const s of seats) s.destroy();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 闯关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const spec = levelSpec(ctx.level);
  const entry = bankAt(ctx.level);
  let settled = false;

  const seats: SeatOpts[] = [
    {
      name: "朵朵",
      who: "duo",
      entry,
      cell: cellPxFor(entry.n, viewportWidth(), spec.race ? 2 : 1),
      errorLimit: spec.errorLimit,
      hintTier: spec.tier,
      sfx: ctx.sfx,
      onDone: () => undefined
    }
  ];
  if (spec.race) {
    seats.push({
      name: `${AI_TIER_LABELS[spec.aiTier]}假人`,
      who: null,
      ai: spec.aiTier,
      entry,
      cell: Math.max(CELL_MIN_PX, Math.round(cellPxFor(entry.n, viewportWidth(), 2) * 0.86)),
      errorLimit: 0,
      hintTier: spec.tier,
      sfx: () => undefined,
      onDone: () => undefined
    });
  }

  const table = createTable(stage, {
    goalText: goalLine(spec),
    banner: spec.race ? `对手:${AI_TIER_LABELS[spec.aiTier]}` : undefined,
    hint: "提示按钮只讲方法,不会替你填。铅笔小字随便写,不算种下去。",
    seats,
    onOver: (states, ms) => {
      if (settled) return;
      settled = true;
      const me = states[0];
      const foe = states[1];
      if (me.solved) {
        ctx.win(starsByTimeAndErrors(ms, me.errors, spec.parMs), winLine(ms, me.errors));
      } else if (foe?.solved) {
        ctx.lose("假人这次快了半步,你的花田还在,换个顺序再来一遍。");
      } else {
        ctx.lose(loseLine(spec));
      }
    }
  });

  return { destroy: () => table.destroy() };
}

// ---------------------------------------------------------------------------
// 对战 / 无尽 / 双人同屏
// ---------------------------------------------------------------------------

type ExtraMode = "versus" | "endless" | "duo";

const MODE_TITLE: Record<ExtraMode, string> = {
  versus: "🤝 对战竞速",
  endless: "♾️ 花田马拉松",
  duo: "👫 双人同屏"
};

function mountExtra(host: HTMLElement, api: GameApi, mode: ExtraMode, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "sp-mode";
  const style = document.createElement("style");
  style.textContent = SP_CSS;
  const head = document.createElement("div");
  head.className = "sp-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "sp-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "sp-badge";
  chip.textContent = MODE_TITLE[mode];
  head.append(back, chip);
  const setup = document.createElement("div");
  setup.className = "sp-mhead";
  const stage = document.createElement("div");
  const board = document.createElement("div");
  wrap.append(style, head, setup, stage, board);
  host.appendChild(wrap);

  let table: { destroy: () => void; elapsedMs: () => number } | null = null;
  /** 关掉之后不许再开新盘:无尽的换题是延时的,玩家可能在这一秒里就退出去了 */
  let closed = false;
  const laters = new Set<ReturnType<typeof setTimeout>>();

  /** 托管的延时:destroy 会把还没到点的一起撤掉 */
  function later(fn: () => void, ms: number): void {
    const id = setTimeout(() => {
      laters.delete(id);
      if (closed) return;
      fn();
    }, ms);
    laters.add(id);
  }

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function drop(): void {
    table?.destroy();
    table = null;
    board.innerHTML = "";
  }

  // ---- 对战:同题竞速 ----
  let tier: AiTier = "normal";
  let versusLevel = VERSUS_LEVELS[2];

  function startVersus(): void {
    drop();
    const entry = bankAt(versusLevel);
    const spec = levelSpec(versusLevel);
    table = createTable(board, {
      goalText: `同一题竞速 · ${AI_TIER_LABELS[tier]}假人`,
      hint: "两边是一模一样的题,谁先种满谁赢。",
      seats: [
        {
          name: "朵朵",
          who: "duo",
          entry,
          cell: cellPxFor(entry.n, viewportWidth(), 2),
          errorLimit: 0,
          hintTier: spec.tier,
          sfx: (s) => api.play(s),
          onDone: () => undefined
        },
        {
          name: `${AI_TIER_LABELS[tier]}假人`,
          who: null,
          ai: tier,
          entry,
          cell: cellPxFor(entry.n, viewportWidth(), 2),
          errorLimit: 0,
          hintTier: spec.tier,
          sfx: () => undefined,
          onDone: () => undefined
        }
      ],
      onOver: (states, ms) => {
        const me = states[0];
        const line = document.createElement("div");
        line.className = "sp-msg";
        if (me.solved) {
          api.play("win");
          api.addStars(2);
          line.textContent = `你先种满了！用了 ${Math.round(ms / 1000)} 秒,拿 2 颗小星星。`;
        } else {
          api.play("oops");
          line.textContent = "假人这次快了半步。换一档或者换一题,再来一局。";
        }
        board.appendChild(line);
      }
    });
  }

  // ---- 无尽:错三题结束 ----
  let endlessKind: EndlessKind = "mixed";

  function startEndless(): void {
    drop();
    const cfg = endlessConfig(endlessKind);
    let streak = 0;
    let wrongPuzzles = 0;
    let index = 0;
    let mistakeThisPuzzle = false;

    const scoreLine = document.createElement("div");
    scoreLine.className = "sp-msg";
    board.appendChild(scoreLine);
    const arena = document.createElement("div");
    board.appendChild(arena);

    const paint = (): void => {
      scoreLine.textContent = `连解 ${streak} 题 · 错 ${wrongPuzzles}/${cfg.errorLimit} 题 · ${cfg.hint}`;
    };

    const finish = (): void => {
      const best = save.recordEndlessBest(meta.id, streak);
      api.play(streak > 0 ? "win" : "oops");
      const line = document.createElement("div");
      line.className = "sp-msg";
      line.textContent = `这一轮连解 ${streak} 题,最高纪录 ${best} 题。歇一口气再来一轮。`;
      board.appendChild(line);
    };

    const nextPuzzle = (): void => {
      if (closed) return;
      table?.destroy();
      arena.innerHTML = "";
      if (wrongPuzzles >= cfg.errorLimit) {
        finish();
        return;
      }
      const lv = endlessPick(cfg, index, 7);
      const entry = bankAt(lv);
      const spec = levelSpec(lv);
      mistakeThisPuzzle = false;
      paint();
      table = createTable(arena, {
        goalText: `第 ${index + 1} 题 · ${goalLine(spec)}`,
        hint: "错三题这一轮就结束,慢一点没关系。",
        seats: [
          {
            name: "朵朵",
            who: "duo",
            entry,
            cell: cellPxFor(entry.n, viewportWidth(), 1),
            errorLimit: 0,
            hintTier: spec.tier,
            sfx: (s) => api.play(s),
            onError: () => {
              if (mistakeThisPuzzle) return;
              mistakeThisPuzzle = true;
              wrongPuzzles += 1;
              paint();
            },
            onDone: () => undefined
          }
        ],
        onOver: (states) => {
          if (states[0].solved) {
            streak += 1;
            api.addStars(1);
          }
          index += 1;
          paint();
          // 让开花动画放完再换下一题
          later(nextPuzzle, BLOOM_STEP_MS * 9 + BLOOM_MS);
        }
      });
    };

    paint();
    nextPuzzle();
  }

  // ---- 双人同屏:左右分盘同一题 ----
  let duoLevel = DUO_LEVELS[1];

  function startDuo(): void {
    drop();
    const entry = bankAt(duoLevel);
    const spec = levelSpec(duoLevel);
    const cell = cellPxFor(entry.n, viewportWidth(), 2);
    table = createTable(board, {
      goalText: "同一题,左右各种一片",
      hint: "朵朵用 W A S D 移动、F 种下、G 切铅笔;星星用方向键、L 种下、K 切铅笔。手机上直接点各自的数字钮。",
      seats: [
        {
          name: "🌸 朵朵",
          who: "duo",
          entry,
          cell,
          errorLimit: 0,
          hintTier: spec.tier,
          sfx: (s) => api.play(s),
          onDone: () => undefined
        },
        {
          name: "⭐ 星星",
          who: "star",
          entry,
          cell,
          errorLimit: 0,
          hintTier: spec.tier,
          sfx: (s) => api.play(s),
          onDone: () => undefined
        }
      ],
      onOver: (states, ms) => {
        api.play("win");
        const winner = states.find((s) => s.solved);
        const line = document.createElement("div");
        line.className = "sp-msg";
        line.textContent = winner
          ? `${winner.name} 先种满啦,用了 ${Math.round(ms / 1000)} 秒。换一题再来一局。`
          : "这一局到此为止,换一题再来一局。";
        board.appendChild(line);
      }
    });
  }

  function chip2(label: string, on: boolean, onClick: () => void): HTMLElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = on ? "sp-tool sp-on" : "sp-tool";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      api.play("tap");
      onClick();
    });
    return btn;
  }

  function paintSetup(): void {
    setup.innerHTML = "";
    if (mode === "versus") {
      for (const t of AI_TIERS) {
        setup.appendChild(
          chip2(AI_TIER_LABELS[t], t === tier, () => {
            tier = t;
            paintSetup();
            startVersus();
          })
        );
      }
      VERSUS_LEVELS.forEach((lv, i) => {
        setup.appendChild(
          chip2(`${CHAPTERS[i].emoji}`, lv === versusLevel, () => {
            versusLevel = lv;
            paintSetup();
            startVersus();
          })
        );
      });
    } else if (mode === "endless") {
      for (const k of ["mixed", "mini"] as EndlessKind[]) {
        setup.appendChild(
          chip2(endlessConfig(k).label, k === endlessKind, () => {
            endlessKind = k;
            paintSetup();
            startEndless();
          })
        );
      }
    } else {
      DUO_LEVELS.forEach((lv, i) => {
        setup.appendChild(
          chip2(`${CHAPTERS[i].emoji}`, lv === duoLevel, () => {
            duoLevel = lv;
            paintSetup();
            startDuo();
          })
        );
      });
    }
  }

  paintSetup();
  if (mode === "versus") startVersus();
  else if (mode === "endless") startEndless();
  else startDuo();

  return {
    destroy() {
      closed = true;
      for (const id of laters) clearTimeout(id);
      laters.clear();
      drop();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = SP_CSS;
  const bar = document.createElement("div");
  bar.className = "sp-modebar";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
  }

  (["versus", "endless", "duo"] as ExtraMode[]).forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sp-open";
    btn.textContent = MODE_TITLE[m];
    btn.addEventListener("click", () => {
      if (mode) return;
      api.play("tap");
      levelHost.hidden = true;
      bar.hidden = true;
      modeHost.hidden = false;
      mode = mountExtra(modeHost, api, m, closeMode);
    });
    bar.appendChild(btn);
  });

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "先找那些被围得只剩一种可能的格子,填完局面会自己松动。",
      grandMessage: "188 片花田全部种满,花田杯冠军就是你！",
      guide,
      guideTitle: "数独花田 · 种花笔记"
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    }
  };
}

/** 给测试钉住的关键常量 */
export const SP_CONSTS = {
  BLOOM_MS,
  BLOOM_STEP_MS,
  BLOOM_STEP_REDUCED_MS,
  POP_MS,
  CELL_MIN_PX,
  CELL_MAX_PX,
  KEY_MIN_PX,
  FONT_MIN_PX
};

/** 给测试与冒烟脚本用的转发 */
export { bankAt, boardFromBank, solutionOfBank, variantOfBank, cellsFromString };
