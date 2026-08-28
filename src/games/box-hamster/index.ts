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
  fitCellRect,
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
import {
  BH_TIMINGS,
  bhHamsterSvg,
  bhVisualCss,
  boxPieceSvg,
  classifyMove,
  confettiHtml,
  dustHtml,
  poseForKind,
  scratchHtml,
  shouldShowDust,
  teleportInHtml,
  themeOf,
  undoIconSvg,
  type BhMoveKind,
} from "./visual";

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
.bh-modebar[hidden]{display:none;}
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
/* N-80:闯关方向键 571。无尽键已在屏,只锁矮屏闯关壳,CELL_MIN 不降 */
@media (max-height:500px){
  .bh-wrap{height:100%;max-height:calc(100dvh - 108px);min-height:0;overflow:hidden;
    display:flex;flex-direction:column;box-sizing:border-box;}
  .bh-tags,.bh-hud{flex:0 0 auto;}
  .bh-stagebox{flex:1 1 auto;min-height:0;overflow:hidden;}
  .bh-pad{position:sticky;bottom:0;z-index:5;flex:0 0 auto;margin-top:4px;
    grid-auto-rows:44px;gap:4px;
    background:linear-gradient(180deg,rgba(255,248,236,0),#FFF8EC 14px);padding-top:4px;}
  .bh-key{min-height:44px;}
  .bh-tip{flex:0 0 auto;max-height:1.3em;overflow:hidden;margin-top:4px;}
}
@media (max-height:840px) and (min-height:501px){
  .bh-pad{position:sticky;bottom:0;z-index:5;flex:0 0 auto;margin-top:4px;
    grid-auto-rows:44px;gap:4px;
    background:linear-gradient(180deg,rgba(255,248,236,0),#FFF8EC 14px);padding-top:4px;}
  .bh-key{min-height:44px;}
}
@media (prefers-reduced-motion:reduce){ .bh-hint{animation:none;box-shadow:inset 0 0 0 3px #F2A93B;} }
${bhVisualCss()}`;

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

/** 两只仓鼠的名字与选中描边(皮肤画法在 visual.ts / kit 的 hamsterSvg 里) */
const HAMSTERS = [
  { name: "豆豆", cls: "bh-hero" },
  { name: "团团", cls: "bh-hero bh-hero-b" },
];

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
  /** 还挂着几个特效计时器(视觉测试用:destroy 后必须归零) */
  pendingFx: () => number;
}

/** 导出仅供视觉冒烟测试挂桩用;运行时入口仍是 mount */
export function createBoard(host: HTMLElement, opts: BoardOpts): BoardHandle {
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
  /** 这一步要播的格间插值(仓鼠一条、被推的箱子一条;播完就清掉) */
  let slides: Array<{ cell: number; dx: number; dy: number; ms: number }> = [];
  /** 传送落点:这一格的棋子播「放大旋出」而不是平移 */
  let spinCell = -1;
  /** 上一步的移动语义(推 / 滑 / 传 / 走)与是谁走的,决定仓鼠姿态 */
  let lastKind: BhMoveKind = "walk";
  let lastMover = -1;
  /** 当前格子边长(fitBoard 量出来的),28px 以下省略尘土只留姿态 */
  let cellPx = 42;
  /** 上一帧已经躺在目标点上的箱子格:新到位的那格才放金光脉冲 */
  let doneCells = new Set<number>();
  /** 尘土 / 擦痕 / 旋入这类临时特效的清场计时器 */
  const fxTimers = new Set<ReturnType<typeof setTimeout>>();
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
  // 撤销画成小时钟回转图标,文案保留给读屏
  const undoBtn = el("button", "bh-btn bxh-undo");
  undoBtn.type = "button";
  undoBtn.innerHTML = `${undoIconSvg()}<span>撤销</span>`;
  undoBtn.setAttribute("aria-label", "撤销一步");
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
  // 章节主题角标(木屋 / 冰窖 / 花园轮换),纯装饰
  const themeDeco = el("span", "bxh-theme");
  themeDeco.setAttribute("aria-hidden", "true");
  box.append(grid, themeDeco, toastEl);
  wrap.appendChild(box);

  function applyTheme(): void {
    const theme = themeOf(def.chapterIndex);
    // 底纹是「tint 收底 + ≤8% 材质层」的整幅 background(B 档 TOP-9)
    box.style.background = theme.mat;
    themeDeco.innerHTML = theme.deco;
  }
  applyTheme();

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

  /** 一个盒子的下沿在哪儿(测试桩的 rect 没有 bottom,用 top+height 兜底) */
  function rectBottom(r: { top: number; bottom?: number; height: number }): number {
    return Number.isFinite(r.bottom) ? (r.bottom as number) : r.top + r.height;
  }

  /**
   * 往上找平台舞台(`.game-stage`,定高 + 会裁内容)的下沿,那是真正的裁切线。
   * 量不到(还没上屏 / 测试桩 / 独立挂载)就返回 NaN,竖向那把尺随之失效,
   * 边长退回「只按宽算」。
   */
  function stageClipBottom(): number {
    let node: HTMLElement | null = box.parentElement ?? null;
    for (let i = 0; node && i < 8; i++) {
      if (typeof node.className === "string" && node.className.includes("game-stage")) {
        if (typeof node.getBoundingClientRect !== "function") break;
        const r = node.getBoundingClientRect();
        // 滚动口是 padding box:clientHeight 量得出就用它(顺手把 4px 白边扣掉)
        const inner =
          typeof node.clientHeight === "number" && node.clientHeight > 0
            ? (node.clientTop || 0) + node.clientHeight
            : r.height;
        if (Number.isFinite(r.top) && Number.isFinite(inner) && inner > 0) return r.top + inner;
        break;
      }
      node = node.parentElement ?? null;
    }
    return Number.NaN;
  }

  /**
   * 按「这会儿还剩多宽、多高」定格子边长。
   *
   * 宽:以前边长是媒体查询写死的,和列数无关,13 列的双鼠宽仓在 360px 上要 466px,
   * 而 `.game-stage` 是 `overflow:hidden` —— 超出去的列不是能滑出来,是直接没了。
   * 高:只按宽算,10 行高的仓库在 360×640 竖屏上棋盘一路长到 400px 开外,
   * 把下面的触屏方向盘(唯一的手指走法)顶出裁切线;横屏 640×360 更是整块没了。
   * 所以竖向同样量:从棋盘顶到裁切线,扣掉棋盘下面的方向盘 + 提示行,剩多少摆多少。
   */
  function fitBoard(): void {
    const style = typeof getComputedStyle === "function" ? getComputedStyle(box) : null;
    const pad = style ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) : 0;
    const avail = (box.clientWidth || 0) - pad;
    // 还没上屏就量不出宽度;先留着 CSS 里那一档,等下一帧再量
    if (avail <= 0) return;
    let availH = Number.NaN;
    const clipBottom = stageClipBottom();
    if (
      Number.isFinite(clipBottom) &&
      typeof grid.getBoundingClientRect === "function" &&
      typeof wrap.getBoundingClientRect === "function" &&
      typeof box.getBoundingClientRect === "function"
    ) {
      const gridRect = grid.getBoundingClientRect();
      // 棋盘下面还有多高的「家当」(方向盘 + 提示行):这些高度不随格子边长变,量一次就是稳的
      const below = Math.max(0, rectBottom(wrap.getBoundingClientRect()) - rectBottom(box.getBoundingClientRect()));
      const padBottom = style ? parseFloat(style.paddingBottom) || 0 : 0;
      if (Number.isFinite(gridRect.top)) availH = clipBottom - gridRect.top - below - padBottom - 4;
    }
    cellPx = fitCellRect(def.w, def.h, avail, availH);
    grid.style.setProperty("--cell", `${cellPx}px`);
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
    const nextDone = new Set<number>();
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      let cls = "bh-cell";
      if (def.wall[c]) {
        cls += " bh-wall";
      } else {
        if (def.ice[c]) cls += " bh-ice";
        if (def.target[c]) cls += " bh-goal";
        if (def.portal[c] >= 0) {
          // 传送门成对反色:下标小的算进口(紫),大的算出口(金)
          cls += ` bh-portal${c > def.portal[c] ? " bxh-portal-out" : ""}`;
        }
      }

      const bi = state.boxes.indexOf(c);
      const hi = state.hamsters.indexOf(c);
      let piece: HTMLElement | null = null;
      if (bi >= 0) {
        const done = !!def.target[c];
        if (done) {
          cls += " bh-done";
          nextDone.add(c);
        }
        // 木箱自绘;推到目标点变礼物盒,刚归位那一下放一圈金光脉冲
        piece = el("span", "bxh-piece bxh-box");
        piece.innerHTML = boxPieceSvg(done, done && !doneCells.has(c) && !softMotion);
      } else if (hi >= 0) {
        // 仓鼠 SVG:四朝向各自姿态,刚推完 / 滑完的那只摆对应姿态
        const pose = hi === lastMover ? poseForKind(lastKind) : "idle";
        piece = el("span", "bxh-piece bxh-hamster");
        piece.innerHTML = bhHamsterSvg(hi, facings[hi] ?? 2, pose);
        if (state.hamsters.length === 1 || hi === active) cls += ` ${HAMSTERS[hi % HAMSTERS.length].cls}`;
      }
      if (c === hintCell) cls += " bh-hint";
      cell.className = cls;
      if (piece) {
        cell.replaceChildren(piece);
      } else {
        cell.textContent = "";
      }
      // 格间插值:从上一格「滑」到这一格,推箱比走路慢一点;箱子也一起滑
      if (piece) {
        for (const s of slides) {
          if (s.cell !== c) continue;
          piece.style.setProperty("--bxh-dx", `${s.dx * 100}%`);
          piece.style.setProperty("--bxh-dy", `${s.dy * 100}%`);
          piece.style.setProperty("--bxh-dur", `${s.ms}ms`);
          piece.classList.add("bxh-slide");
        }
        // 传送落点:平移换成放大旋出(200ms;reduced 时不加类,瞬移)
        if (spinCell === c) piece.classList.add("bxh-tp-out");
      }
    }
    slides = [];
    spinCell = -1;
    doneCells = nextDone;

    const left = remainingBoxes(def, state);
    boxChip.textContent = left === 0 ? "🎁 全部归位!" : `🎁 还差 ${left} 个`;
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
    slides.push({
      cell: to,
      dx: (from % def.w) - (to % def.w),
      dy: Math.floor(from / def.w) - Math.floor(to / def.w),
      ms: moveDuration(kind, softMotion, undoing),
    });
  }

  /** 在某格上放一段临时特效(尘土 / 擦痕 / 旋入 / 彩带),到点自己收走 */
  function spawnFx(cell: number, html: string, ms: number): void {
    const host = cells[cell];
    if (!host) return;
    const node = el("span", "bxh-fxwrap");
    node.setAttribute("aria-hidden", "true");
    node.innerHTML = html;
    host.appendChild(node);
    const timer = setTimeout(() => {
      node.remove();
      fxTimers.delete(timer);
    }, ms);
    fxTimers.add(timer);
  }

  /** 过关仪式:所有礼物盒同时放彩带,仓鼠抱腮转圈(reduced 静止合影 + 静态彩带) */
  function celebrate(): void {
    grid.classList.add("bxh-win");
    for (const c of state.boxes) spawnFx(c, confettiHtml(), BH_TIMINGS.winSpinMs + 400);
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
    // 三种移动三种画法:推(尘土+推箱姿态)/ 滑(擦痕+张爪)/ 传(旋入旋出)
    const kind = classifyMove(def, out);
    lastKind = kind;
    lastMover = active;
    if (kind === "teleport") {
      if (out.pushed) {
        // 箱子被传走:仓鼠正常跟半步,箱子在出口旋出、入口放旋入小闪
        slideFrom(out.from, out.to, "push", false);
        if (!softMotion) spinCell = out.boxTo;
      } else if (!softMotion) {
        // 仓鼠自己传送:不做跨场长平移,入口旋入、出口旋出(reduced 瞬移)
        spinCell = out.to;
      }
    } else {
      slideFrom(out.from, out.to, kind === "push" ? "push" : "walk", false);
      if (kind === "push") slideFrom(out.boxFrom, out.boxTo, "push", false);
    }
    opts.sfx(out.pushed ? "pop" : "tap");
    if (out.teleported) opts.sfx("coin");
    render();
    // 特效在重绘之后落格,免得被 replaceChildren 一把清掉
    if (kind === "push" && shouldShowDust(cellPx, softMotion)) {
      spawnFx(out.boxFrom, dustHtml(dir), BH_TIMINGS.dustMs + 120);
    } else if (kind === "slide" && !softMotion) {
      spawnFx(out.from, scratchHtml(dir), BH_TIMINGS.scratchMs + 60);
    } else if (kind === "teleport" && !softMotion) {
      const path = out.pushed ? out.boxPath : out.path;
      const entry = path.length >= 2 ? path[path.length - 2] : -1;
      if (entry >= 0) spawnFx(entry, teleportInHtml(), BH_TIMINGS.teleportMs + 60);
    }

    if (isSolved(def, state)) {
      finished = true;
      celebrate();
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
    lastKind = "walk";
    lastMover = -1;
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
    lastKind = "walk";
    lastMover = -1;
    doneCells = new Set();
    grid.classList.remove("bxh-win");
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
      for (const timer of fxTimers) clearTimeout(timer);
      fxTimers.clear();
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
      lastKind = "walk";
      lastMover = -1;
      doneCells = new Set();
      grid.classList.remove("bxh-win");
      applyTheme();
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
    pendingFx: () => fxTimers.size,
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
