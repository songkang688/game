/**
 * 翻翻暗棋 · 棋盘视图。
 *
 * 32 个格子就是 32 个按钮，点一下翻子，再点一下走子；
 * 键盘鸭梨用 WASD + F / G，康康用方向键 + L / K，各管各的一个光标。
 * 单人局里方向键与 L / K 是鸭梨的别名，老键位一条都不丢。
 * 翻子和吃子都有动画，不许瞬变。
 */
import { COLS, KINDS, RANK, ROWS, colOf, indexOf, labelOf, rowOf, type Color, type Kind } from "./board";
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
.dc-cell{position:relative;aspect-ratio:1/1;min-height:44px;border:none;border-radius:10px;cursor:pointer;padding:0;
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
/* 和棋倒数:摆出来就说明快判和了,配色比普通提示更抢眼一点 */
.dc-chip.dc-quiet{background:#EDE7FF;color:#5b46a8;}
/* 手数上限倒数:另一条也会收场的线,配色和和棋倒数分开,一眼看得出说的是哪一条 */
.dc-chip.dc-cap{background:#FFF0D6;color:#95651a;}
.dc-note{text-align:center;min-height:20px;font-size:13px;font-weight:700;color:#795b3a;margin-top:8px;line-height:1.5;}
.dc-count{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:8px;}
.dc-count span{font-size:12px;font-weight:800;border-radius:999px;padding:3px 8px;background:#fff8ec;color:#8a6a40;}
.dc-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;margin-top:8px;}
.dc-btn{border:none;border-radius:999px;padding:9px 15px;font-size:14px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#7a5a34;box-shadow:0 3px 0 rgba(160,130,90,.3);min-height:44px;}
.dc-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(160,130,90,.3);}
/* 窄屏把格间距收一点:8 列摊在 360px 上,每省 1px 间距就还给格子 0.875px 宽 */
@media (max-width:400px){ .dc-cell{font-size:18px;} .dc-board{gap:3px;} }
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

/**
 * 记牌面板的一行字。
 *
 * 暗棋真正要学的是「大子翻出来没有」：还剩一枚帅没露面，谁都不敢把士往前送。
 * `remainingUnknown()` 一直是按兵种数的（函数注释写的就是「还有哪些兵种没露过面」），
 * 以前屏幕上只落下一个总数，最要紧的那半截被丢掉了。
 * 现在按相克次序从大到小列出来，翻光了的兵种自动不占位置，一行还是一行。
 */
export function counterLine(color: Color, left: Record<Kind, number>): string {
  const head = `${color === "red" ? "红" : "蓝"}还盖着 ${KINDS.reduce((a, k) => a + left[k], 0)}`;
  const kinds = KINDS.slice()
    .sort((a, b) => RANK[b] - RANK[a])
    .filter((k) => left[k] > 0)
    .map((k) => `${labelOf(color, k)}${left[k]}`);
  return kinds.length > 0 ? `${head} · ${kinds.join(" ")}` : `${head} · 都翻出来啦`;
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
  /** 收回当前这一方选中的子（取消键 / 取消按钮共用） */
  cancel: (side?: Side) => void;
  destroy: () => void;
  /** 单测用：某一方的光标在哪一格（不传就是屏幕上画着的那一个） */
  cursor: (side?: Side) => number;
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
  /** 一人一个光标：鸭梨从左上角起，康康从右下角起，谁也拨不走谁的 */
  const cursors: Record<Side, number> = { duo: 0, star: ROWS * COLS - 1 };
  let targets: number[] = [];
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  let destroyed = false;

  /** 单人局里康康那一套键（方向键 + L / K）也归鸭梨，老键位一条都不丢 */
  const starSeat: Side = opts.humans.includes("star") ? "star" : "duo";

  function humanTurn(): boolean {
    return opts.humans.includes(state.turn);
  }

  /** 屏幕上只画一个光标：轮到谁就画谁的；电脑回合里画留在原地的那位真人的 */
  function activeSeat(): Side {
    return humanTurn() ? state.turn : (opts.humans[0] ?? "duo");
  }

  function clickCell(i: number, side: Side = activeSeat()): void {
    if (destroyed || status(state).kind !== "playing" || !humanTurn()) return;
    // 双人同屏：不是你的回合，你的确认键连光标都挪不动，更别说替对方落子
    if (side !== state.turn) return;
    cursors[side] = i;
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

  function moveCursor(dr: number, dc: number, side: Side = activeSeat()): void {
    if (destroyed) return;
    const from = cursors[side];
    const r = Math.max(0, Math.min(ROWS - 1, rowOf(from) + dr));
    const c = Math.max(0, Math.min(COLS - 1, colOf(from) + dc));
    cursors[side] = indexOf(r, c);
    refresh();
  }

  function cancel(side: Side = activeSeat()): void {
    if (destroyed) return;
    // 选中的那一枚归当前该走的那一方，别人的取消键碰不着
    if (side !== activeSeat()) return;
    selected = -1;
    targets = [];
    refresh();
  }

  // 两套键位各管各的座位：鸭梨 WASD + F / G，康康 方向键 + L / K
  const DUO_MOVE: Record<string, [number, number]> = {
    w: [-1, 0],
    s: [1, 0],
    a: [0, -1],
    d: [0, 1],
  };
  const STAR_MOVE: Record<string, [number, number]> = {
    arrowup: [-1, 0],
    arrowdown: [1, 0],
    arrowleft: [0, -1],
    arrowright: [0, 1],
  };

  function onKey(e: KeyboardEvent): void {
    if (destroyed) return;
    const k = e.key.toLowerCase();
    let handled = true;
    if (DUO_MOVE[k]) moveCursor(DUO_MOVE[k][0], DUO_MOVE[k][1], "duo");
    else if (STAR_MOVE[k]) moveCursor(STAR_MOVE[k][0], STAR_MOVE[k][1], starSeat);
    else if (k === "f") clickCell(cursors.duo, "duo");
    else if (k === "l") clickCell(cursors[starSeat], starSeat);
    else if (k === "g") cancel("duo");
    else if (k === "k") cancel(starSeat);
    else handled = false;
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
      if (i === cursors[activeSeat()]) classes.push("dc-cursor");
      b.className = classes.join(" ");
    }
    if (opts.showCounter) {
      const left = remainingUnknown(state);
      counter.innerHTML = "";
      for (const color of ["red", "blue"] as Color[]) {
        const s = document.createElement("span");
        s.textContent = counterLine(color, left[color]);
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
    cancel,
    cursor: (side: Side = activeSeat()) => cursors[side],
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
