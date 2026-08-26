/**
 * 翻翻暗棋 · 棋盘视图。
 *
 * 32 个格子就是 32 个按钮，点一下翻子，再点一下走子；
 * 键盘用 WASD / 方向键挪光标，F 确认、G 取消。
 * 翻子和吃子都有动画，不许瞬变。
 */
import { COLS, ROWS, colOf, indexOf, labelOf, rowOf, type Color } from "./board";
import {
  applyAction,
  coveredCount,
  legalActions,
  movesFrom,
  mustFlip,
  remainingUnknown,
  status,
  type Action,
  type GameState,
  type Side,
} from "./rules";

export const CSS = `
.dc-board{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;width:100%;max-width:520px;margin:0 auto;}
.dc-cell{position:relative;aspect-ratio:1/1;min-height:40px;border:none;border-radius:10px;cursor:pointer;padding:0;
  font-family:inherit;font-size:20px;font-weight:900;line-height:1;background:#EBD9BD;color:#7a5a34;
  box-shadow:0 2px 0 rgba(150,120,80,.35);transition:transform .16s ease,opacity .18s ease;}
.dc-cell:focus-visible{outline:3px solid #ffb43c;outline-offset:2px;}
.dc-cell.dc-empty{background:#F7EEDF;box-shadow:none;cursor:default;}
.dc-cell.dc-red{background:#FFF3F1;color:#c03a2b;}
.dc-cell.dc-blue{background:#EFF4FD;color:#245ba8;}
.dc-cell.dc-sel{outline:3px solid #ff9a3c;outline-offset:1px;}
.dc-cell.dc-can{box-shadow:0 0 0 3px #8fd3a8 inset;}
.dc-cell.dc-cursor{outline:3px dashed #7f6bd0;outline-offset:1px;}
.dc-cell.dc-flip{transform:rotateY(180deg) scale(.86);}
.dc-cell.dc-gone{opacity:0;transform:scale(.5);}
.dc-top{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;margin-bottom:8px;}
.dc-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:800;color:#7a5a34;
  box-shadow:0 2px 6px rgba(160,130,90,.25);white-space:nowrap;}
.dc-chip.dc-hot{background:#FFE9DC;color:#b4501f;}
.dc-note{text-align:center;min-height:20px;font-size:13px;font-weight:700;color:#795b3a;margin-top:8px;line-height:1.5;}
.dc-count{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:8px;}
.dc-count span{font-size:12px;font-weight:800;border-radius:999px;padding:3px 8px;background:#fff8ec;color:#8a6a40;}
.dc-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;margin-top:8px;}
.dc-btn{border:none;border-radius:999px;padding:9px 15px;font-size:14px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#7a5a34;box-shadow:0 3px 0 rgba(160,130,90,.3);min-height:44px;}
.dc-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(160,130,90,.3);}
@media (max-width:400px){ .dc-cell{font-size:18px;} }
@media (prefers-reduced-motion:reduce){ .dc-cell{transition-duration:.06s;} .dc-btn:active{transform:none;} }
`;

function reducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return mm ? mm("(prefers-reduced-motion: reduce)").matches : false;
  } catch {
    return false;
  }
}

export interface BoardOptions {
  state: GameState;
  /** 哪几方由真人操作 */
  humans: Side[];
  showCounter: boolean;
  /** 真人走完一手（AI 由外面驱动） */
  onHumanAction: (a: Action) => void;
  onNote: (text: string) => void;
}

export interface BoardHandle {
  refresh: () => void;
  /** 播一段翻子 / 吃子动画，结束后回调 */
  animate: (kind: "flip" | "capture", at: number, done: () => void) => void;
  destroy: () => void;
  /** 单测用：当前光标在哪一格 */
  cursor: () => number;
  /** 单测用：当前选中的是哪一格（没选是 -1） */
  selected: () => number;
}

export function createBoard(host: HTMLElement, opts: BoardOptions): BoardHandle {
  const soft = reducedMotion();
  const state = opts.state;
  const wrap = document.createElement("div");
  const grid = document.createElement("div");
  grid.className = "dc-board";
  const counter = document.createElement("div");
  counter.className = "dc-count";
  counter.hidden = !opts.showCounter;
  wrap.append(grid, counter);
  host.appendChild(wrap);

  const cells: HTMLButtonElement[] = [];
  let selected = -1;
  let cursor = 0;
  let targets: number[] = [];
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  let destroyed = false;

  function humanTurn(): boolean {
    return opts.humans.includes(state.turn);
  }

  function clickCell(i: number): void {
    if (destroyed || status(state).kind !== "playing" || !humanTurn()) return;
    cursor = i;
    const c = state.cells[i];
    if (selected >= 0 && targets.includes(i)) {
      const from = selected;
      selected = -1;
      targets = [];
      opts.onHumanAction({ type: "move", from, to: i });
      return;
    }
    if (c && c.covered) {
      selected = -1;
      targets = [];
      opts.onHumanAction({ type: "flip", at: i });
      return;
    }
    if (mustFlip(state)) {
      opts.onNote("第一手只能翻一枚盖着的棋子。");
      refresh();
      return;
    }
    const mine = state.colors[state.turn];
    if (c && !c.covered && mine && c.color === mine) {
      selected = i;
      targets = movesFrom(state.cells, i);
      if (targets.length === 0) opts.onNote("这一枚暂时没地方去，换一枚试试。");
      refresh();
      return;
    }
    selected = -1;
    targets = [];
    refresh();
  }

  for (let i = 0; i < ROWS * COLS; i++) {
    const b = document.createElement("button") as HTMLButtonElement;
    b.type = "button";
    b.className = "dc-cell";
    b.addEventListener("click", () => clickCell(i));
    grid.appendChild(b);
    cells.push(b);
  }

  function moveCursor(dr: number, dc: number): void {
    const r = Math.max(0, Math.min(ROWS - 1, rowOf(cursor) + dr));
    const c = Math.max(0, Math.min(COLS - 1, colOf(cursor) + dc));
    cursor = indexOf(r, c);
    refresh();
  }

  function onKey(e: KeyboardEvent): void {
    if (destroyed) return;
    const k = e.key.toLowerCase();
    const starTurn = state.turn === "star" && opts.humans.includes("star");
    const useArrows = starTurn || opts.humans.length === 1;
    let handled = true;
    if (k === "w" || (useArrows && k === "arrowup")) moveCursor(-1, 0);
    else if (k === "s" || (useArrows && k === "arrowdown")) moveCursor(1, 0);
    else if (k === "a" || (useArrows && k === "arrowleft")) moveCursor(0, -1);
    else if (k === "d" || (useArrows && k === "arrowright")) moveCursor(0, 1);
    else if (k === "f" || (starTurn && k === "l")) clickCell(cursor);
    else if (k === "g" || (starTurn && k === "k")) {
      selected = -1;
      targets = [];
      refresh();
    } else handled = false;
    if (handled) e.preventDefault();
  }

  window.addEventListener("keydown", onKey);

  function refresh(): void {
    if (destroyed) return;
    for (let i = 0; i < cells.length; i++) {
      const b = cells[i];
      const c = state.cells[i];
      const classes = ["dc-cell"];
      if (!c) {
        classes.push("dc-empty");
        b.textContent = "";
        b.disabled = true;
        b.setAttribute("aria-label", `第 ${rowOf(i) + 1} 行第 ${colOf(i) + 1} 列 空格`);
      } else if (c.covered) {
        b.textContent = "🌸";
        b.disabled = false;
        b.setAttribute("aria-label", `第 ${rowOf(i) + 1} 行第 ${colOf(i) + 1} 列 还盖着`);
      } else {
        classes.push(c.color === "red" ? "dc-red" : "dc-blue");
        b.textContent = labelOf(c.color, c.kind);
        b.disabled = false;
        b.setAttribute(
          "aria-label",
          `第 ${rowOf(i) + 1} 行第 ${colOf(i) + 1} 列 ${c.color === "red" ? "红" : "蓝"}${labelOf(c.color, c.kind)}`
        );
      }
      if (i === selected) classes.push("dc-sel");
      if (targets.includes(i)) classes.push("dc-can");
      if (i === cursor) classes.push("dc-cursor");
      b.className = classes.join(" ");
    }
    if (opts.showCounter) {
      const left = remainingUnknown(state);
      const parts: string[] = [];
      for (const color of ["red", "blue"] as Color[]) {
        const total = Object.values(left[color]).reduce((a, b2) => a + b2, 0);
        parts.push(`${color === "red" ? "红" : "蓝"}还盖着 ${total}`);
      }
      counter.innerHTML = "";
      for (const p of parts) {
        const s = document.createElement("span");
        s.textContent = p;
        counter.appendChild(s);
      }
    }
  }

  function animate(kind: "flip" | "capture", at: number, done: () => void): void {
    const b = cells[at];
    const ms = soft ? 80 : kind === "flip" ? 200 : 180;
    if (b) b.className = `${b.className} ${kind === "flip" ? "dc-flip" : "dc-gone"}`;
    const t = setTimeout(() => {
      if (destroyed) return;
      refresh();
      done();
    }, ms);
    timers.push(t);
  }

  refresh();

  return {
    refresh,
    animate,
    cursor: () => cursor,
    selected: () => selected,
    destroy() {
      destroyed = true;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      window.removeEventListener("keydown", onKey);
      for (const b of cells) b.remove();
      wrap.remove();
    },
  };
}

/** 供上层做提示用：这一方现在有几手可走 */
export function actionCount(state: GameState, side: Side): number {
  return legalActions(state, side).length;
}

export { applyAction, coveredCount };
