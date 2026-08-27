import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { save } from "../../engine/save";
import type { GuideBook } from "../../ui/level188Contract";
import GUIDE from "./guide";
import {
  CHAPTERS,
  buildEndless,
  featureTags,
  getLevel,
  winMessage,
  type LevelDef,
} from "./levels";
import {
  assistSummary,
  canUndo,
  canUseHint,
  deadlockTip,
  difficultyBadge,
  facingAngle,
  fitCell,
  hintsLeft,
  makeEndlessRoom,
  moveDuration,
  newUndoStack,
  nextHintMove,
  pushFrame,
  resetStack,
  starsWithAssist,
  stuckReport,
  undoFrame,
  usableDirs,
} from "./assist";
import {
  DIR_LABELS,
  initialState,
  isSolved,
  remainingBoxes,
  tryMove,
  type Dir,
  type Puzzle,
  type State,
} from "./logic";

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

const CSS = `
.bh-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;user-select:none;
  -webkit-user-select:none;touch-action:manipulation;position:relative;}
.bh-hud{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;}
.bh-chip{background:#fff;border-radius:999px;padding:4px 10px;font-size:13px;font-weight:800;color:#7A5433;
  box-shadow:0 2px 6px rgba(170,140,100,.22);white-space:nowrap;}
.bh-chip-warn{background:#FFE9E2;color:#B4553A;}
.bh-btn{border:none;border-radius:999px;padding:5px 12px;font-size:13px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#7A5433;box-shadow:0 3px 0 rgba(170,140,100,.32);}
.bh-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,140,100,.32);}
.bh-btn[disabled]{opacity:.45;cursor:default;box-shadow:none;}
.bh-btn:focus-visible,.bh-key:focus-visible,.bh-mode:focus-visible{outline:3px solid #4A3018;outline-offset:2px;}
.bh-stagebox{position:relative;border-radius:16px;padding:10px;background:#FFF8EC;
  box-shadow:0 4px 12px rgba(170,140,110,.24);display:flex;justify-content:center;}
.bh-grid{display:grid;gap:2px;--cell:42px;}
.bh-cell{width:var(--cell);height:var(--cell);border-radius:8px;display:flex;align-items:center;
  justify-content:center;font-size:calc(var(--cell) * .62);line-height:1;background:#FBEBD2;position:relative;}
.bh-wall{background:#C4A277;border-radius:5px;box-shadow:inset 0 -3px 0 rgba(0,0,0,.12);}
.bh-ice{background:#D6EEFB;box-shadow:inset 0 0 0 2px #B4DDF3;}
.bh-goal{background:#FBE0C4;box-shadow:inset 0 0 0 2px #E9B67F;}
.bh-goal.bh-ice{background:#CDE6F2;}
.bh-portal{background:#E3DAF9;box-shadow:inset 0 0 0 2px #BCA9EC;}
.bh-done{background:#D9EFC9;box-shadow:inset 0 0 0 2px #96CB77;}
.bh-hero{outline:3px solid #E6893F;outline-offset:-3px;border-radius:10px;}
.bh-hero-b{outline-color:#4E8FD0;}
.bh-hint{animation:bhhint .8s ease infinite;}
@keyframes bhhint{0%,100%{box-shadow:inset 0 0 0 3px #F2A93B}50%{box-shadow:inset 0 0 0 3px #FFE0A0}}
/* 1.2 新增:格间插值、仓鼠朝向、难度小标签(bxh- 前缀) */
.bxh-slide{animation:bxhslide var(--bxh-dur,140ms) ease-out;}
@keyframes bxhslide{from{transform:translate(var(--bxh-dx,0),var(--bxh-dy,0));}to{transform:translate(0,0);}}
.bxh-face{display:inline-block;transform:rotate(var(--bxh-turn,0deg));
  transition:transform var(--bxh-dur,140ms) ease-out;}
.bxh-diff{background:#FFF1DC;color:#9A6A34;}
.bxh-stuck{background:#FFE9E2;color:#B4553A;}
@media (prefers-reduced-motion:reduce){
  .bxh-slide{animation-duration:16ms;}
  .bxh-face{transition-duration:16ms;}
}
.bh-veil{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:8px;text-align:center;padding:16px;background:rgba(255,250,242,.94);border-radius:16px;}
.bh-veil-title{font-size:20px;font-weight:900;color:#7A5433;}
.bh-veil-sub{font-size:14px;font-weight:700;color:#957048;line-height:1.6;max-width:320px;}
.bh-veil-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.bh-veil-btn{border:none;border-radius:16px;padding:10px 20px;font-size:15px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#E8A85E,#CE8639);box-shadow:0 4px 0 #A96A28;}
.bh-veil-btn.bh-ghost{background:linear-gradient(180deg,#8FBEE8,#6A97CC);box-shadow:0 4px 0 #4F79A8;}
.bh-veil-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #A96A28;}
.bh-toast{position:absolute;left:50%;top:8px;transform:translateX(-50%);background:#ffffffee;border-radius:999px;
  padding:5px 14px;font-size:13px;font-weight:800;color:#7A5433;box-shadow:0 3px 8px rgba(160,120,90,.25);
  pointer-events:none;opacity:0;transition:opacity .25s ease;max-width:92%;text-align:center;z-index:3;}
.bh-toast.bh-on{opacity:1;}
.bh-pad{display:grid;grid-template-columns:repeat(3,56px);grid-auto-rows:52px;gap:6px;justify-content:center;
  margin-top:10px;}
.bh-key{border:none;border-radius:14px;font-size:20px;font-weight:900;cursor:pointer;font-family:inherit;
  background:#ffffffe0;color:#7A5433;box-shadow:0 3px 0 rgba(170,140,100,.34);touch-action:none;padding:0;}
.bh-key:active,.bh-key.bh-down{transform:translateY(2px);box-shadow:0 1px 0 rgba(170,140,100,.34);background:#FFEBD0;}
.bh-tip{margin-top:8px;text-align:center;font-size:12px;font-weight:700;color:#957048;line-height:1.5;}
.bh-tags{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:6px;}
.bh-tag{background:#ffffffcc;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:800;color:#7A5433;}
.bh-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.bh-mode{border:none;border-radius:999px;padding:9px 18px;font-size:14px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#E8A85E,#CE8639);box-shadow:0 4px 0 #A96A28;}
.bh-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #A96A28;}
.bh-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
.bh-head-title{flex:1;text-align:center;font-size:15px;font-weight:900;color:#7A5433;}
@media (max-width:420px){
  .bh-grid{--cell:34px;gap:2px;}
  .bh-chip{font-size:12px;padding:3px 8px;}
  .bh-btn{padding:5px 9px;font-size:12px;}
  .bh-stagebox{padding:6px;}
  .bh-pad{grid-template-columns:repeat(3,50px);grid-auto-rows:46px;margin-top:8px;}
  .bh-tip{font-size:11px;}
}
@media (max-width:340px){ .bh-grid{--cell:28px;} }
@media (prefers-reduced-motion:reduce){ .bh-hint{animation:none;box-shadow:inset 0 0 0 3px #F2A93B;} }
`;

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

// ---------------------------------------------------------------------------
// 棋盘
// ---------------------------------------------------------------------------

/** 两只仓鼠的名字与配色 */
const HAMSTERS = [
  { name: "豆豆", face: "🐹", cls: "bh-hero" },
  { name: "团团", face: "🐹", cls: "bh-hero bh-hero-b" },
];

/** 仓鼠的转身:左右靠翻面,上下靠一点点仰头低头,看得出朝哪边又不会歪成一团 */
function faceStyle(dir: Dir): string {
  const angle = facingAngle(dir);
  const tilt = angle === 0 ? -8 : angle === 180 ? 8 : 0;
  return `rotate(${tilt}deg)${angle === 270 ? " scaleX(-1)" : ""}`;
}

/** 方向键盘映射 */
const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 0,
  KeyW: 0,
  ArrowRight: 1,
  KeyD: 1,
  ArrowDown: 2,
  KeyS: 2,
  ArrowLeft: 3,
  KeyA: 3,
};

interface BoardOpts {
  def: LevelDef;
  sfx: (name: SoundName) => void;
  /** 步数用完就算这一趟结束;0 表示不限 */
  moveLimit?: number;
  onWin: (moves: number, undos: number, hints: number) => void;
  onOut?: (moves: number) => void;
  onQuit?: () => void;
  showBest?: boolean;
}

interface BoardHandle {
  destroy: () => void;
  swap: (def: LevelDef) => void;
  showVeil: (
    title: string,
    sub: string,
    buttons: Array<{ label: string; ghost?: boolean; onClick: () => void }>
  ) => void;
  toast: (text: string) => void;
  moves: () => number;
}

function createBoard(host: HTMLElement, opts: BoardOpts): BoardHandle {
  let def = opts.def;
  let state: State = initialState(def);
  /** 无限撤销:一步一帧压进去,只有内存上限这一条保护 */
  const undoStack = newUndoStack();
  let moves = 0;
  let undos = 0;
  let hintsUsed = 0;
  let active = 0;
  let finished = false;
  let hintCell = -1;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  /** 每只仓鼠面朝哪边 */
  let facings: Dir[] = [2, 2];
  /** 这一步要播的格间插值(播完就清掉,不会每帧重放) */
  let slide: { cell: number; dx: number; dy: number; ms: number } | null = null;
  /** 上一次提醒过的死局局面,同一个局面不重复唠叨 */
  let stuckSaid = "";
  const softMotion = (() => {
    const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    return typeof mm === "function" ? !!mm("(prefers-reduced-motion: reduce)").matches : false;
  })();

  const wrap = el("div", "bh-wrap");
  const style = el("style");
  style.textContent = CSS;
  wrap.appendChild(style);

  const tags = el("div", "bh-tags");
  wrap.appendChild(tags);

  const hud = el("div", "bh-hud");
  const boxChip = el("span", "bh-chip");
  const moveChip = el("span", "bh-chip");
  const undoBtn = el("button", "bh-btn", "↩️ 撤销");
  undoBtn.type = "button";
  const resetBtn = el("button", "bh-btn", "🔄 重来");
  resetBtn.type = "button";
  const hintBtn = el("button", "bh-btn", "💡 提示");
  hintBtn.type = "button";
  const swapBtn = el("button", "bh-btn", "🔁 换鼠");
  swapBtn.type = "button";
  hud.append(boxChip, moveChip, undoBtn, resetBtn, hintBtn);
  if (def.hamsters.length > 1) hud.appendChild(swapBtn);
  if (opts.onQuit) {
    const quit = el("button", "bh-btn", "🚪 退出");
    quit.type = "button";
    quit.addEventListener("click", () => {
      opts.sfx("tap");
      opts.onQuit?.();
    });
    hud.appendChild(quit);
  }
  wrap.appendChild(hud);

  const box = el("div", "bh-stagebox");
  const grid = el("div", "bh-grid");
  grid.setAttribute("role", "img");
  const toastEl = el("div", "bh-toast");
  box.append(grid, toastEl);
  wrap.appendChild(box);

  const pad = el("div", "bh-pad");
  const padDefs: Array<{ dir: Dir; label: string; col: number; row: number }> = [
    { dir: 0, label: "⬆", col: 2, row: 1 },
    { dir: 3, label: "◀", col: 1, row: 2 },
    { dir: 2, label: "⬇", col: 2, row: 2 },
    { dir: 1, label: "▶", col: 3, row: 2 },
  ];
  const padBtns: Array<{ dir: Dir; btn: HTMLButtonElement }> = [];
  for (const k of padDefs) {
    const btn = el("button", "bh-key", k.label);
    btn.type = "button";
    btn.style.gridColumn = String(k.col);
    btn.style.gridRow = String(k.row);
    btn.setAttribute("aria-label", `往${DIR_LABELS[k.dir]}走`);
    btn.addEventListener("click", () => step(k.dir));
    pad.appendChild(btn);
    padBtns.push({ dir: k.dir, btn });
  }
  wrap.appendChild(pad);

  const tip = el("div", "bh-tip", def.hint);
  wrap.appendChild(tip);
  host.appendChild(wrap);

  let cells: HTMLElement[] = [];

  /**
   * 按「这会儿还剩多宽」定格子边长。
   *
   * 以前边长是媒体查询写死的,和列数无关,13 列的双鼠宽仓在 360px 上要 466px,
   * 而 `.game-stage` 是 `overflow:hidden` —— 超出去的列不是能滑出来,是直接没了。
   */
  function fitBoard(): void {
    const style = typeof getComputedStyle === "function" ? getComputedStyle(box) : null;
    const pad = style ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) : 0;
    const avail = (box.clientWidth || 0) - pad;
    // 还没上屏就量不出宽度;先留着 CSS 里那一档,等下一帧再量
    if (avail <= 0) return;
    grid.style.setProperty("--cell", `${fitCell(def.w, avail)}px`);
  }

  function buildGrid(): void {
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${def.w}, var(--cell))`;
    cells = [];
    for (let c = 0; c < def.w * def.h; c++) {
      const cell = el("div", "bh-cell");
      grid.appendChild(cell);
      cells.push(cell);
    }
    fitBoard();
  }

  function currentPuzzle(): Puzzle {
    return { ...def, boxes: state.boxes.slice(), hamsters: state.hamsters.slice() };
  }

  function render(): void {
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      let cls = "bh-cell";
      let text = "";
      if (def.wall[c]) {
        cls += " bh-wall";
      } else {
        if (def.ice[c]) cls += " bh-ice";
        if (def.target[c]) cls += " bh-goal";
        if (def.portal[c] >= 0) cls += " bh-portal";
      }

      const bi = state.boxes.indexOf(c);
      const hi = state.hamsters.indexOf(c);
      let piece: HTMLElement | null = null;
      if (bi >= 0) {
        text = "📦";
        if (def.target[c]) cls += " bh-done";
      } else if (hi >= 0) {
        // 仓鼠按朝向转身,不许瞬间换脸
        piece = el("span", "bxh-face", HAMSTERS[hi % HAMSTERS.length].face);
        piece.style.transform = faceStyle(facings[hi] ?? 2);
        if (state.hamsters.length === 1 || hi === active) cls += ` ${HAMSTERS[hi % HAMSTERS.length].cls}`;
      } else if (def.portal[c] >= 0) {
        text = "🌀";
      } else if (def.target[c]) {
        text = "🐾";
      } else if (def.ice[c]) {
        text = "";
      }
      if (c === hintCell) cls += " bh-hint";
      cell.className = cls;
      if (piece) {
        cell.replaceChildren(piece);
      } else {
        cell.textContent = text;
      }
      // 格间插值:从上一格「滑」到这一格,推箱比走路慢一点
      const mover = piece ?? (text === "📦" ? cell : null);
      if (slide && slide.cell === c && mover) {
        mover.style.setProperty("--bxh-dx", `${slide.dx * 100}%`);
        mover.style.setProperty("--bxh-dy", `${slide.dy * 100}%`);
        mover.style.setProperty("--bxh-dur", `${slide.ms}ms`);
        mover.classList.add("bxh-slide");
      }
    }
    slide = null;

    const left = remainingBoxes(def, state);
    boxChip.textContent = left === 0 ? "📦 全部归位!" : `📦 还差 ${left} 个`;
    if (opts.moveLimit && opts.moveLimit > 0) {
      const rest = Math.max(0, opts.moveLimit - moves);
      moveChip.textContent = `👣 还剩 ${rest} 步`;
      moveChip.className = rest <= 8 ? "bh-chip bh-chip-warn" : "bh-chip";
    } else {
      moveChip.textContent = `👣 ${moves} 步 · 目标 ${def.parMoves}`;
      moveChip.className = moves <= def.parMoves ? "bh-chip" : "bh-chip bh-chip-warn";
    }
    undoBtn.disabled = !canUndo(undoStack) || finished;
    hintBtn.disabled = finished || !canUseHint(hintsUsed);
    hintBtn.textContent = `💡 提示 ${hintsLeft(hintsUsed)}`;
    const walkable = usableDirs(def, state, active);
    for (const p of padBtns) p.btn.disabled = finished || !walkable[p.dir];
    swapBtn.textContent = `🔁 换 ${HAMSTERS[(active + 1) % state.hamsters.length].name}`;
    grid.setAttribute(
      "aria-label",
      `${def.name}:${def.w} 乘 ${def.h} 的仓库,还差 ${left} 个箱子没归位,已经走了 ${moves} 步`
    );
  }

  function refreshTags(): void {
    tags.innerHTML = "";
    // 难度标签是拿求解器算出来的最短推箱次数标的,关卡数据一格都没动
    tags.appendChild(el("span", "bh-tag bxh-diff", difficultyBadge(def)));
    for (const t of featureTags(def)) tags.appendChild(el("span", "bh-tag", t));
    tip.textContent = def.hint;
  }

  function toast(text: string): void {
    toastEl.textContent = text;
    toastEl.classList.add("bh-on");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("bh-on"), 2200);
  }

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
    const v = el("div", "bh-veil");
    v.append(el("div", "bh-veil-title", title), el("div", "bh-veil-sub", sub));
    const row = el("div", "bh-veil-btns");
    for (const b of buttons) {
      const btn = el("button", `bh-veil-btn${b.ghost ? " bh-ghost" : ""}`, b.label);
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

  /** 从 from 滑到 to 的格子偏移(动画从「上一格」的位置起步) */
  function slideFrom(from: number, to: number, kind: "walk" | "push", undoing: boolean): void {
    if (from < 0 || to < 0) return;
    slide = {
      cell: to,
      dx: (from % def.w) - (to % def.w),
      dy: Math.floor(from / def.w) - Math.floor(to / def.w),
      ms: moveDuration(kind, softMotion, undoing),
    };
  }

  /** 这一步之后局面还救得回来吗:先过死局规则,推了箱子再让求解器复核一遍 */
  function warnIfStuck(pushed: boolean): void {
    if (finished || isSolved(def, state)) return;
    const report = stuckReport(currentPuzzle(), state, {
      nodeCap: 20_000,
      useSolver: pushed && def.w * def.h <= 90,
    });
    if (!report.stuck) {
      stuckSaid = "";
      return;
    }
    const key = `${state.boxes.join(",")}`;
    if (key === stuckSaid) return;
    stuckSaid = key;
    toast(report.tip || deadlockTip("solver"));
  }

  function step(dir: Dir): void {
    if (finished) return;
    const out = tryMove(def, state, active, dir);
    if (!out) {
      opts.sfx("oops");
      return;
    }
    pushFrame(undoStack, state);
    state = out.state;
    facings[active] = dir;
    moves++;
    hintCell = -1;
    slideFrom(out.from, out.pushed ? out.to : out.to, out.pushed ? "push" : "walk", false);
    opts.sfx(out.pushed ? "pop" : "tap");
    if (out.teleported) opts.sfx("coin");
    render();

    if (isSolved(def, state)) {
      finished = true;
      opts.sfx("win");
      opts.onWin(moves, undos, hintsUsed);
      return;
    }
    if (opts.moveLimit && opts.moveLimit > 0 && moves >= opts.moveLimit) {
      finished = true;
      opts.onOut?.(moves);
      return;
    }
    warnIfStuck(out.pushed);
  }

  function undo(): void {
    if (finished || !canUndo(undoStack)) return;
    const prev = undoFrame(undoStack);
    if (!prev) return;
    const wasAt = state.hamsters[active];
    state = prev;
    moves = Math.max(0, moves - 1);
    undos++;
    hintCell = -1;
    stuckSaid = "";
    // 撤销把刚才那一步反着播,速度快一倍
    slideFrom(wasAt, state.hamsters[active], "walk", true);
    opts.sfx("tap");
    render();
  }

  function reset(): void {
    state = initialState(def);
    resetStack(undoStack);
    moves = 0;
    active = 0;
    finished = false;
    hintCell = -1;
    stuckSaid = "";
    facings = [2, 2];
    clearVeil();
    opts.sfx("tap");
    render();
  }

  function swapHamster(): void {
    if (state.hamsters.length < 2) return;
    active = (active + 1) % state.hamsters.length;
    opts.sfx("tap");
    toast(`换 ${HAMSTERS[active % HAMSTERS.length].name} 上场啦`);
    render();
  }

  /**
   * 卡住了给一步:走求解器那条解的第一步,把该走的那一格亮起来。
   * 每关只给一次,用掉这一关就封顶两星(撤销随便用,不扣星)。
   */
  function hint(): void {
    if (finished || !canUseHint(hintsUsed)) return;
    opts.sfx("tap");
    const res = nextHintMove(currentPuzzle(), state);
    if (!res.move) {
      toast(res.text);
      render();
      return;
    }
    hintsUsed++;
    const first = res.move;
    if (first.who !== active && state.hamsters.length > 1) {
      active = first.who;
      toast(`该 ${HAMSTERS[active % HAMSTERS.length].name} 动啦,往${DIR_LABELS[first.dir]}走一格`);
    } else {
      toast(res.text);
    }
    const out = tryMove(def, state, first.who, first.dir);
    hintCell = out ? out.to : -1;
    render();
  }

  undoBtn.addEventListener("click", undo);
  resetBtn.addEventListener("click", reset);
  hintBtn.addEventListener("click", hint);
  swapBtn.addEventListener("click", swapHamster);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Tab") {
      if (state.hamsters.length < 2) return;
      e.preventDefault();
      swapHamster();
      return;
    }
    if (e.code === "KeyU" || e.code === "Backspace") {
      e.preventDefault();
      undo();
      return;
    }
    if (e.code === "KeyR") {
      e.preventDefault();
      reset();
      return;
    }
    const dir = KEY_DIRS[e.code];
    if (dir === undefined) return;
    e.preventDefault();
    step(dir);
  };
  window.addEventListener("keydown", onKeyDown);

  // 转屏 / 分屏改变可用宽度时重新量一次,免得棋盘又被切掉右边几列
  const onResize = (): void => fitBoard();
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  buildGrid();
  refreshTags();
  render();
  // 挂载那一刻可能还没上屏,量不出宽度;下一帧补量一次
  const fitRaf = requestAnimationFrame(fitBoard);

  return {
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      cancelAnimationFrame(fitRaf);
      if (toastTimer) clearTimeout(toastTimer);
      clearVeil();
      wrap.remove();
    },
    swap(next) {
      def = next;
      state = initialState(def);
      resetStack(undoStack);
      moves = 0;
      undos = 0;
      hintsUsed = 0;
      active = 0;
      finished = false;
      hintCell = -1;
      stuckSaid = "";
      facings = [2, 2];
      clearVeil();
      if (def.hamsters.length > 1 && !swapBtn.isConnected) hud.appendChild(swapBtn);
      if (def.hamsters.length <= 1 && swapBtn.isConnected) swapBtn.remove();
      buildGrid();
      refreshTags();
      render();
    },
    showVeil,
    toast,
    moves: () => moves,
  };
}

// ---------------------------------------------------------------------------
// 闯关模式
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const def = getLevel(ctx.level);
  const board = createBoard(stage, {
    def,
    sfx: ctx.sfx,
    onWin: (moves, undos, hints) => {
      // 撤销一颗星都不扣;看过提示才封顶两星
      ctx.win(starsWithAssist(def, moves, hints), `${winMessage(def, moves, undos)} ${assistSummary(undos, hints)}`);
    },
  });
  return { destroy: () => board.destroy() };
}

// ---------------------------------------------------------------------------
// 无尽模式:仓库大挑战
// ---------------------------------------------------------------------------

/** 一仓给多少步的预算:参考解再宽松一倍多一点,想清楚了完全够用 */
export function budgetFor(def: LevelDef): number {
  return Math.round(def.bestMoves * 2.2) + 14;
}

/** 一仓推完拿多少分:参考解越长的仓分越高,省下来的步数还有额外奖励 */
export function roomScore(def: LevelDef, used: number, budget: number): number {
  return def.bestPushes * 12 + def.bestMoves * 2 + Math.max(0, budget - used) * 3;
}

function mountEndless(host: HTMLElement, api: GameApi, onExit: () => void): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const head = el("div", "bh-head");
  const back = el("button", "bh-btn", "🗺️ 回关卡");
  back.type = "button";
  const title = el("div", "bh-head-title", "♾️ 仓库大挑战");
  const bestChip = el("span", "bh-chip");
  head.append(back, title, bestChip);
  const fieldHost = el("div");
  root.append(style, head, fieldHost);
  host.appendChild(root);

  let round = 0;
  let score = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  bestChip.textContent = best > 0 ? `🏅 最好 ${best} 分` : "🏅 还没有纪录";

  let board: BoardHandle | null = null;

  /** 生成一仓:随机生成 + 求解器验证有解,超时或验不过就自动退一档,绝不卡住画面 */
  function makeRoom(r: number): LevelDef {
    return makeEndlessRoom({ round: r, make: buildEndless }).def;
  }

  function startRound(): void {
    const def = makeRoom(round);
    const budget = budgetFor(def);
    board?.destroy();
    board = createBoard(fieldHost, {
      def,
      sfx: (n) => api.play(n),
      moveLimit: budget,
      onQuit: onExit,
      onWin: (moves) => {
        score += roomScore(def, moves, budget);
        round++;
        api.play("win");
        const next = makeRoom(round);
        board?.swap(next);
        board?.toast(`第 ${round} 仓收拾好啦!当前 ${score} 分,继续!`);
      },
      onOut: () => finish(),
    });
  }

  function finish(): void {
    const record = score > best;
    if (record) best = save.recordEndlessBest(meta.id, score);
    bestChip.textContent = `🏅 最好 ${best} 分`;
    const bonus = Math.min(6, Math.floor(score / 150));
    if (bonus > 0) api.addStars(bonus);
    api.play(record ? "win" : "oops");
    board?.showVeil(
      record ? `新纪录 ${score} 分!` : `这趟收了 ${round} 仓 · ${score} 分`,
      `步数用完啦。${
        record ? "这是你到目前为止收拾得最利索的一趟!" : `最好成绩 ${best} 分,再来一趟就能追上它。`
      }${bonus > 0 ? `送你 ${bonus} 颗小星星。` : ""}`,
      [
        {
          label: "🔁 再来一趟",
          onClick: () => {
            round = 0;
            score = 0;
            startRound();
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

  startRound();

  return {
    destroy() {
      board?.destroy();
      board = null;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 攻略
// ---------------------------------------------------------------------------

// 攻略正文统一放在 ./guide.ts,关卡里翻到的和攻略抽屉里翻到的是同一份。
function buildGuide(): GuideBook {
  return GUIDE;
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = el("div");
  const style = el("style");
  style.textContent = CSS;
  const bar = el("div", "bh-modebar");
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = el("button", "bh-mode");
  endlessBtn.type = "button";
  bar.appendChild(endlessBtn);

  let current: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 仓库大挑战 · 最好 ${best} 分` : "♾️ 仓库大挑战 · 来一趟!";
  }

  function closeMode(): void {
    current?.destroy();
    current = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  endlessBtn.addEventListener("click", () => {
    if (current) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    current = mountEndless(modeHost, api, closeMode);
  });
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "步数越省星星越多。撤销和重来都不扣分,想清楚再推!",
      grandMessage: "188 间仓库全部收拾干净,你就是小仓鼠们的整理大王!",
      guide: buildGuide(),
      guideTitle: "推箱小攻略",
    }
  );

  return {
    destroy() {
      current?.destroy();
      current = null;
      level.destroy();
      root.remove();
    },
  };
}
