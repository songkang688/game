import { meta } from "./meta";
export { meta };

// 拼图乐园:188 关十本画册 + 无尽画廊。
// 1.1 新玩法:5×5 / 6×6 大画板、旋转块(点一下转 90°)、缺块补齐(托盘里挑对的补回去)、限时拼。
// 1.2 新增:碎片拖着走 + 磁性吸附(阈值 = 格宽 × 0.35)、预览三档、旋转撤销栈、大画板中途续拼。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import {
  buildFillPuzzle,
  buildRotations,
  CHAPTERS,
  endlessBoard,
  endlessHallName,
  endlessLine,
  LEVELS,
  THEME_TILES,
  type PuzzleLevel,
} from "./levels";
import {
  bestSlideMove,
  boardKind,
  isSolvedSlide,
  neighborsOf,
  openingLine,
  loseLine,
  shuffleBoard,
  starsFor,
  winLine,
} from "./logic";
import {
  BOUNCE_MS,
  PREVIEW_KEY,
  RESUME_KEY,
  TileBag,
  applyRotate,
  bounceLine,
  cellCenter,
  challengeBadge,
  dropCostsMove,
  dropDistance,
  magnetMs,
  nearestCell,
  needsResume,
  nextPreview,
  parsePreview,
  parseResume,
  previewLabel,
  resolveDrop,
  resumeMatches,
  serializeResume,
  snapThreshold,
  undoRotate,
  type GridGeom,
  type PreviewMode,
  type ResumeState,
  type RotateStep,
} from "./snap";
import {
  PT_CSS,
  PtFx,
  dropFxClasses,
  ghostTarget,
  modeTagHtml,
  framingOverlayHtml,
  pieceSkinSvg,
  stepAngle,
} from "./visual";
import { patternDefsSvg, patternSliceSvg } from "../../art/kit/pattern";

const SMOKE = typeof location !== "undefined" && /[?&]smoke=1/.test(location.search);

const CSS = `
.pz-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #EEF0FF, #FFF3F9); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.pz-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.pz-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #7B7FD0; box-shadow: 0 2px 6px rgba(130,130,210,.25); font-size: 14px; }
.pz-badge.pz-hot { color: #C2456F; }
.pz-row2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px; flex-wrap: wrap; }
.pz-preview { display: grid; gap: 2px; background: #fff; padding: 5px; border-radius: 10px; box-shadow: 0 2px 6px rgba(130,130,210,.25); }
.pz-preview i { width: 16px; height: 16px; border-radius: 4px; font-style: normal; font-size: 11px; display: flex; align-items: center; justify-content: center; }
.pz-preview.pz-hidden i { background: #E8E6F5 !important; color: transparent; }
.pz-hint { border: none; border-radius: 14px; padding: 8px 14px; font-weight: 800; background: #D5C8F8; color: #5D48A0; cursor: pointer; box-shadow: 0 3px 0 #B7A3E8; font-size: 15px; font-family: inherit; min-height: 44px; box-sizing: border-box; }
.pz-hint:active { transform: translateY(2px); box-shadow: 0 1px 0 #B7A3E8; }
.pz-hint:disabled { opacity: .5; }
.pz-board { display: grid; gap: 8px; position: relative; }
@media (max-height: 500px) {
  .pz-board { max-width: min(100%, calc(100dvh - 220px)); margin: 0 auto; }
}
@media (min-width: 700px) and (max-height: 840px) and (min-height: 501px) {
  .pz-board { max-width: min(100%, calc(100dvh - 220px)); margin: 0 auto; }
}
.pz-tile { aspect-ratio: 1; border: none; border-radius: 16px; font-size: var(--pz-fs, clamp(22px, 8vw, 44px)); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; transition: transform .14s; box-shadow: 0 3px 8px rgba(120,120,200,.2); padding: 0; }
.pz-tile small { font-size: var(--pz-num, 12px); color: rgba(90,80,120,.65); font-weight: 700; }
.pz-tile:active { transform: scale(.94); }
.pz-tile.pz-empty { background: rgba(255,255,255,.35) !important; box-shadow: inset 0 2px 6px rgba(120,120,200,.2); cursor: default; }
.pz-tile.pz-glow { animation: pzGlow 1s ease infinite; box-shadow: 0 0 0 4px #FFD86E; }
@keyframes pzGlow { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
.pz-spin { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; transition: transform .18s ease; }
.pz-mark { font-size: 10px; color: #C2456F; line-height: 1; }
.pz-tile.pz-upright { box-shadow: 0 0 0 3px #A8DDA0, 0 3px 8px rgba(120,120,200,.2); }
.pz-tile.pz-gap { background: repeating-linear-gradient(45deg, #EFEBFA, #EFEBFA 6px, #E3DDF5 6px, #E3DDF5 12px) !important; color: #8F86B8; }
.pz-tile.pz-fixed { cursor: default; }
.pz-tray { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 12px; background: #ffffffa8; border-radius: 14px; padding: 8px; }
.pz-piece { border: none; border-radius: 14px; width: 46px; height: 46px; font-size: 24px; cursor: pointer; box-shadow: 0 3px 8px rgba(120,120,200,.2); padding: 0; }
.pz-piece:active { transform: scale(.94); }
.pz-piece.pz-piece-on { outline: 3px solid #C2456F; }
.pz-piece.pz-piece-used { opacity: .3; cursor: default; }
.pz-msg { text-align: center; min-height: 22px; color: #7B7FD0; font-weight: 700; margin-top: 10px; font-size: 15px; }
.pz-bar-modes { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 0 0 10px; }
/* display:flex 会压过 hidden 属性的 UA display:none,进关/进模式时模式条要真的让位 */
.pz-bar-modes[hidden] { display: none; }
.pz-open { border: none; border-radius: 999px; padding: 9px 18px; font-size: 15px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #8E86E0, #6E64C8); box-shadow: 0 4px 0 #544BA4; min-height: 44px; box-sizing: border-box; }
.pz-open:active { transform: translateY(2px); box-shadow: 0 2px 0 #544BA4; }
.pz-mode { max-width: 680px; margin: 0 auto; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }
.pz-mhead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 10px; }
.pz-back { border: none; border-radius: 999px; padding: 7px 13px; font-size: 14px; font-weight: 900; cursor: pointer; font-family: inherit; background: #ffffffd9; color: #6E64C8; box-shadow: 0 3px 0 rgba(110,100,200,.3); min-height: 44px; box-sizing: border-box; }
.pz-back:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(110,100,200,.3); }
.pz-chip { background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 800; font-size: 14px; color: #6E64C8; box-shadow: 0 2px 6px rgba(130,130,210,.25); }
.pz-over { text-align: center; padding: 26px 16px; background: #fff; border-radius: 18px; box-shadow: 0 4px 14px rgba(130,130,210,.25); }
.pz-over-t { font-size: 22px; font-weight: 900; color: #6E64C8; margin-bottom: 8px; }
.pz-over-s { font-size: 15px; font-weight: 700; color: #7B7FD0; line-height: 1.6; margin-bottom: 14px; }

/* ---- 1.2 新增（全部 pzt- 前缀，不改上面 1.0/1.1 的规则） ---- */
.pzt-tools { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.pzt-eye, .pzt-undo { border: none; border-radius: 14px; padding: 8px 12px; font-weight: 800; font-size: 14px; font-family: inherit; cursor: pointer; background: #fff; color: #6E64C8; box-shadow: 0 2px 6px rgba(130,130,210,.25); min-height: 44px; box-sizing: border-box; }
.pzt-eye:active, .pzt-undo:active { transform: translateY(1px); }
.pzt-undo:disabled { opacity: .45; cursor: default; }
/* 整图半透明底图：铺在画板上当参照，不吃点击 */
.pzt-ghost { position: absolute; inset: 0; display: grid; pointer-events: none; opacity: .26; }
.pzt-ghost i { border-radius: 16px; font-style: normal; display: flex; align-items: center; justify-content: center; font-size: var(--pz-fs, clamp(22px, 8vw, 44px)); }
.pzt-ghost[hidden] { display: none; }
/* 拿在手里的碎片：抬高 20px、放大 6%、带投影 */
.pzt-drag { position: fixed; z-index: 60; border-radius: 14px; display: flex; align-items: center; justify-content: center; pointer-events: none; box-shadow: 0 10px 20px rgba(80,70,140,.38); transform: translate(-50%, -50%) scale(1.06); }
.pz-tile.pzt-target { box-shadow: 0 0 0 4px #FFD86E, 0 3px 8px rgba(120,120,200,.2); }
.pz-board.pzt-shine .pz-tile { box-shadow: 0 0 14px 4px #FFE7A0; }
.pz-board.pzt-shine { gap: 2px !important; transition: gap .45s ease; }
.pz-piece { touch-action: none; }
@media (prefers-reduced-motion: reduce) {
  .pzt-drag { transition: none !important; }
  .pz-board.pzt-shine { transition: none; }
}
@media (max-width: 380px) {
  .pz-tray { flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; -webkit-overflow-scrolling: touch; }
  .pz-piece { flex: 0 0 auto; width: 40px; height: 40px; font-size: 21px; }
  .pz-badge, .pzt-eye, .pzt-undo { font-size: 14px; }
}
${PT_CSS}`;

interface BoardOpts {
  cfg: PuzzleLevel;
  banner?: string;
  /** 闯关关号（0 基）：只有闯关的大画板才存中途续拼，无尽画廊不填 */
  level?: number;
  sfx: (name: "tap" | "win" | "oops" | "coin" | "pop") => void;
  onWin: (stars: 1 | 2 | 3, msg: string) => void;
  onLose: (msg: string) => void;
}

function prefersReduced(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 小设置读写：浏览器隐私模式下 localStorage 会抛，一律吞掉当没存过 */
function readLS(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLS(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* 存不下就算了，不影响这一局 */
  }
}

function dropLS(key: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch {
    /* 同上 */
  }
}

/**
 * 一块画板：推格子 / 旋转块 / 缺块补齐三种板式共用这一套外壳，
 * 闯关关卡和无尽画廊都是往这里塞一个 PuzzleLevel。
 */
function createBoard(stage: HTMLElement, opts: BoardOpts): { destroy: () => void } {
  const cfg = opts.cfg;
  const kind = boardKind(cfg);
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  const bag = new TileBag();
  // 1.3 视觉:动画计时统一记账(destroy 一把清零)+ 齿形确定性种子(同一关两次进来一个样)
  const fx = new PtFx();
  const skinSeed = ((opts.level ?? -1) + 7) * 131 + (cfg.seed ?? 0) * 17 + cfg.rows * cfg.cols;
  const rowOf = (pos: number): number => Math.floor(pos / cfg.cols);
  const colOf = (pos: number): number => pos % cfg.cols;
  let raf = 0;
  let destroyed = false;
  let levelDone = false;
  let moves = 0;
  let hintsLeft = cfg.hints;
  let timeLeft = cfg.timeLimit ?? 0;
  const total = cfg.rows * cfg.cols;
  const EMPTY = total - 1;
  const pool = THEME_TILES[cfg.theme] ?? THEME_TILES[0];
  const pic = pool.slice(0, kind === "slide" ? total - 1 : Math.min(pool.length, total));
  // 窗口 7 R1 修复:牌面内容 = 主题场景画切片,emoji 只当关卡数据里的主题钥匙,不上屏
  const themeIdx = THEME_TILES[cfg.theme] ? cfg.theme : 0;

  // 推格子
  const board: number[] = Array.from({ length: total }, (_, i) => i);
  let undoPlan: number[] = [];
  // 旋转块
  let rot: number[] = [];
  /** 旋转撤销栈：点歪了可以一步步退回去，退回不算走冤枉路 */
  const rotUndo: RotateStep[] = [];
  // 缺块补齐
  let holes: number[] = [];
  let tray: number[] = [];
  let placed: Record<number, boolean> = {};
  let usedPiece: boolean[] = [];
  let picked = -1;

  // 1.2：预览三档 + 大画板续拼
  let preview: PreviewMode = parsePreview(readLS(PREVIEW_KEY));
  /** 记忆关（水果派对 / 彩虹大画展）开局几秒后把图藏起来，这一档由关卡说了算 */
  let memoryHidden = false;
  const canResume = typeof opts.level === "number" && needsResume(cfg.rows, cfg.cols);

  const wrap = document.createElement("div");
  wrap.className = "pz-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    ${patternDefsSvg(themeIdx, cfg.rows, cfg.cols)}
    <div class="pz-top">
      ${modeTagHtml(kind)}
      <span class="pz-badge pz-moves">👣 0 / ${cfg.moveLimit} 步</span>
      <span class="pz-badge">⭐ ≤${cfg.three} 步 3 星</span>
      ${cfg.timeLimit ? `<span class="pz-badge pz-hot pz-time">⏳ ${cfg.timeLimit}s</span>` : ""}
      ${opts.banner ? `<span class="pz-badge pz-banner">${opts.banner}</span>` : ""}
    </div>
    <div class="pz-row2">
      <div class="pzt-tools">
        <button class="pz-hint" type="button">💡 提示 x${cfg.hints}</button>
        <button class="pzt-eye" type="button"></button>
        ${kind === "rotate" ? '<button class="pzt-undo" type="button">↩️ 撤一步</button>' : ""}
      </div>
      <div class="pz-preview" style="grid-template-columns:repeat(${cfg.cols},16px)"></div>
    </div>
    <div class="pz-board"></div>
    ${kind === "fill" ? '<div class="pz-tray"></div>' : ""}
    <div class="pz-msg"></div>
  `;
  stage.appendChild(wrap);

  const boardEl = wrap.querySelector(".pz-board") as HTMLElement;
  const movesEl = wrap.querySelector(".pz-moves") as HTMLElement;
  const timeEl = wrap.querySelector(".pz-time") as HTMLElement | null;
  const msgEl = wrap.querySelector(".pz-msg") as HTMLElement;
  const previewEl = wrap.querySelector(".pz-preview") as HTMLElement;
  const hintBtn = wrap.querySelector(".pz-hint") as HTMLButtonElement;
  const eyeBtn = wrap.querySelector(".pzt-eye") as HTMLButtonElement;
  const undoBtn = wrap.querySelector(".pzt-undo") as HTMLButtonElement | null;
  const trayEl = wrap.querySelector(".pz-tray") as HTMLElement | null;

  boardEl.style.gridTemplateColumns = `repeat(${cfg.cols},1fr)`;
  const gapCss = cfg.cols >= 5 ? "5px" : "8px";
  boardEl.style.gap = gapCss;
  boardEl.style.setProperty("--pz-fs", `clamp(13px, ${Math.max(6, Math.floor(52 / cfg.cols))}vw, 44px)`);
  boardEl.style.setProperty("--pz-num", cfg.cols >= 6 ? "0px" : cfg.cols >= 5 ? "9px" : "12px");

  const ghostEl = document.createElement("div");
  ghostEl.className = "pzt-ghost";
  ghostEl.style.gridTemplateColumns = `repeat(${cfg.cols},1fr)`;
  ghostEl.style.gap = gapCss;
  ghostEl.hidden = true;
  boardEl.appendChild(ghostEl);

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  const tiles: HTMLButtonElement[] = [];
  for (let pos = 0; pos < total; pos++) {
    const btn = document.createElement("button");
    btn.className = "pz-tile";
    btn.type = "button";
    const p = pos;
    btn.addEventListener("click", () => onTile(p));
    boardEl.appendChild(btn);
    tiles.push(btn);
  }

  /**
   * 1.3 齿形皮肤:home 是这块「回家」的格号,齿形跟着块走,拼齐时齿齿相扣。
   * 纯视觉裁剪层(pointer-events:none),按钮热区与逻辑坐标一个像素不动。
   */
  function skinFor(home: number, bg: string, ghost = false): string {
    return pieceSkinSvg({
      rows: cfg.rows,
      cols: cfg.cols,
      r: rowOf(home),
      c: colOf(home),
      bg,
      cellPx: tiles[0]?.clientWidth || 64,
      seed: skinSeed,
      ghost,
      // 虚影只要粉色影子;正常块嵌场景画切片(齿形裁剪,凸齿上也有画)
      slice: ghost ? undefined : { theme: themeIdx, home },
    });
  }

  /** 放对 / 放错走不同视觉分支:放对回弹+接缝白光,放错轻微摇头;reduced 只留白光 */
  function applyDropFx(el: HTMLElement, fxKind: "snap" | "wrong"): void {
    const classes = dropFxClasses(fxKind, prefersReduced());
    if (classes.length === 0) return;
    el.classList.add(...classes);
    fx.later(() => el.classList.remove(...classes), 420);
  }

  /** 转正一块:四角星一闪(纯装饰,reduced 不放) */
  function flashStar(el: HTMLElement): void {
    const star = document.createElement("span");
    star.className = "pzv-star";
    el.appendChild(star);
    fx.later(() => star.remove(), 420);
  }

  /** 这一格是不是有内容(推格子的最后一格是空格,预览与虚影都留白) */
  function hasFace(pos: number): boolean {
    return kind !== "slide" || pos < EMPTY;
  }

  function renderPreview(): void {
    // 预览小样与底图虚影都直接裁场景画:与牌面同源,拼的就是这幅画
    previewEl.innerHTML = "";
    for (let v = 0; v < total; v++) {
      const cell = document.createElement("i");
      if (hasFace(v)) cell.innerHTML = patternSliceSvg(themeIdx, cfg.rows, cfg.cols, v);
      previewEl.appendChild(cell);
    }
    ghostEl.innerHTML = "";
    for (let pos = 0; pos < total; pos++) {
      const cell = document.createElement("i");
      if (hasFace(pos)) cell.innerHTML = patternSliceSvg(themeIdx, cfg.rows, cfg.cols, pos);
      ghostEl.appendChild(cell);
    }
  }

  // ---- 预览三档：整图底图 / 角落小图 / 不看图挑战 ----
  function applyPreview(): void {
    eyeBtn.textContent = previewLabel(preview);
    const hidden = memoryHidden || preview === "none";
    ghostEl.hidden = hidden || preview !== "ghost";
    previewEl.classList.toggle("pz-hidden", hidden || preview === "ghost");
  }

  function cyclePreview(): void {
    preview = nextPreview(preview);
    writeLS(PREVIEW_KEY, preview);
    opts.sfx("tap");
    applyPreview();
    msgEl.textContent =
      preview === "ghost"
        ? "整幅画淡淡地铺在下面啦，照着它拼就行～"
        : preview === "thumb"
          ? "小图挪回右上角，随时抬头看一眼～"
          : "不看图挑战！拼完会多一枚徽章，三星标准一点没变～";
  }

  /** 看一眼：提示 / 记忆关到点都借这条路,临时把图放出来几秒 */
  function peek(ms: number): void {
    const back = preview;
    if (preview === "none") preview = "thumb";
    memoryHidden = false;
    applyPreview();
    later(() => {
      preview = back;
      if (cfg.hidePreview) memoryHidden = true;
      applyPreview();
    }, ms);
  }

  function renderTop(): void {
    movesEl.textContent = `👣 ${moves} / ${cfg.moveLimit} 步`;
    if (timeEl) timeEl.textContent = `⏳ ${Math.max(0, timeLeft)}s`;
    hintBtn.textContent = `💡 提示 x${hintsLeft}`;
    hintBtn.disabled = hintsLeft <= 0 || levelDone;
    if (undoBtn) {
      undoBtn.textContent = rotUndo.length > 0 ? `↩️ 撤一步 (${rotUndo.length})` : "↩️ 撤一步";
      undoBtn.disabled = rotUndo.length === 0 || levelDone;
    }
  }

  // ---- 推格子 ----
  function renderSlide(): void {
    // 可滑微光:只读既有的邻居判断(空格四邻),不写任何棋盘数据
    const canSlide = neighborsOf(board.indexOf(EMPTY), cfg.rows, cfg.cols);
    for (let pos = 0; pos < total; pos++) {
      const v = board[pos];
      const el = tiles[pos];
      el.classList.remove("pz-glow");
      if (v === EMPTY) {
        el.className = "pz-tile pz-empty";
        el.innerHTML = "";
        el.style.background = "";
      } else {
        el.className = `pz-tile pzv-cut${canSlide.includes(pos) ? " pzv-can" : ""}`;
        el.style.background = "";
        el.innerHTML = skinFor(v, pic[v].bg) + `<small>${v + 1}</small>`;
      }
    }
    renderTop();
  }

  // ---- 旋转块 ----
  /** 旋转视角的累计角:只影响过渡走哪个方向,朝向真值永远是 rot */
  const visDeg: number[] = [];
  function renderRotate(): void {
    for (let pos = 0; pos < total; pos++) {
      const el = tiles[pos];
      const tile = pic[pos] ?? pic[pic.length - 1];
      // 结构只建一次:innerHTML 每帧重建会把 120ms 旋转过渡吃掉
      let rotor = el.querySelector<HTMLElement>(".pzv-rotor");
      if (!rotor) {
        el.innerHTML =
          `<span class="pzv-rotor">${skinFor(pos, tile.bg)}` +
          `<span class="pz-spin"><span class="pz-mark">▲</span></span>` +
          `</span><span class="pzv-knob"></span>`;
        rotor = el.querySelector<HTMLElement>(".pzv-rotor") as HTMLElement;
      }
      el.className = `pz-tile pzv-cut${rot[pos] === 0 ? " pz-upright" : ""}`;
      el.style.background = "";
      const want = rot[pos] * 90;
      let deg = visDeg[pos] ?? want;
      if (((deg % 360) + 360) % 360 !== want) deg = want;
      visDeg[pos] = deg;
      rotor.style.transform = `rotate(${deg}deg)`;
    }
    renderTop();
  }

  // ---- 缺块补齐 ----
  function renderFill(): void {
    for (let pos = 0; pos < total; pos++) {
      const el = tiles[pos];
      const isHole = holes.includes(pos);
      const tile = pic[pos] ?? pic[pic.length - 1];
      if (isHole && !placed[pos]) {
        // 洞 = 刻进画板的凹槽,里面备一层虚影皮肤(凑近且块对时才浮出)
        el.className = "pz-tile pz-gap";
        el.style.background = "";
        el.innerHTML = skinFor(pos, "", true) + `<span class="pzv-face">？</span>`;
      } else {
        el.className = `pz-tile pzv-cut${isHole ? "" : " pz-fixed"}`;
        el.style.background = "";
        el.innerHTML = skinFor(pos, tile.bg);
      }
    }
    if (trayEl) {
      trayEl.innerHTML = "";
      tray.forEach((v, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `pz-piece pzv-cut${picked === i ? " pz-piece-on" : ""}${usedPiece[i] ? " pz-piece-used" : ""}`;
        const tile = pool[v] ?? pool[pool.length - 1];
        btn.style.background = "";
        btn.innerHTML = skinFor(v, tile.bg);
        btn.disabled = usedPiece[i] || levelDone;
        btn.addEventListener("pointerdown", (ev) => beginDrag(i, btn, ev));
        trayEl.appendChild(btn);
      });
    }
    renderTop();
  }

  function render(): void {
    if (kind === "rotate") renderRotate();
    else if (kind === "fill") renderFill();
    else renderSlide();
  }

  // ---- 中途续拼：≥25 片的大画板每走一步就记一次，下次进同一关接着拼 ----
  function saveResume(): void {
    if (!canResume || levelDone) return;
    const s: ResumeState = { level: opts.level as number, kind, total, moves };
    if (kind === "slide") s.board = board.slice();
    else if (kind === "rotate") s.rot = rot.slice();
    else {
      s.filled = holes.filter((h) => placed[h]);
      s.used = usedPiece.map((u, i) => (u ? i : -1)).filter((i) => i >= 0);
    }
    writeLS(RESUME_KEY, serializeResume(s));
  }

  function clearResume(): void {
    if (canResume) dropLS(RESUME_KEY);
  }

  function loadResume(): boolean {
    if (!canResume) return false;
    const s = parseResume(readLS(RESUME_KEY));
    if (!resumeMatches(s, opts.level as number, kind, total) || !s) return false;
    if (s.moves >= cfg.moveLimit) return false;
    moves = s.moves;
    if (kind === "slide" && s.board) s.board.forEach((v, i) => { board[i] = v; });
    else if (kind === "rotate" && s.rot) rot = s.rot.slice();
    else {
      for (const p of s.filled ?? []) if (holes.includes(p)) placed[p] = true;
      for (const i of s.used ?? []) if (i >= 0 && i < usedPiece.length) usedPiece[i] = true;
    }
    return true;
  }

  /** 画廊语义:这是第几幅作品(闯关按关号,无尽画廊借横幅上的第几幅) */
  function galleryCaption(): string {
    if (typeof opts.level === "number") return `🖼️ 第 ${opts.level + 1} 幅作品装裱完成！`;
    if (opts.banner) return `🖼️ ${opts.banner.replace("♾️ ", "")}作品装裱完成！`;
    return "🖼️ 作品装裱完成！";
  }

  /** 拼完先让整幅画亮一下、拼缝合拢，展示 1.2 秒；点一下可以跳过 */
  function celebrate(then: () => void): void {
    boardEl.classList.add("pzt-shine");
    // 装裱动画:木框四边合拢 + 彩纸 + 画廊标牌;reduced 直接展示成品
    if (!prefersReduced()) {
      const mount = document.createElement("div");
      mount.className = "pzv-mount";
      mount.innerHTML = framingOverlayHtml(galleryCaption());
      wrap.appendChild(mount);
    }
    let fired = false;
    const go = (): void => {
      if (fired) return;
      fired = true;
      wrap.removeEventListener("click", go);
      then();
    };
    wrap.addEventListener("click", go);
    bag.add(() => wrap.removeEventListener("click", go));
    later(go, prefersReduced() ? 200 : 1200);
  }

  function finishWin(): void {
    if (levelDone) return;
    levelDone = true;
    intervals.forEach((t) => clearInterval(t));
    intervals.clear();
    clearResume();
    opts.sfx("win");
    render();
    const badge = challengeBadge(preview);
    const line = winLine(cfg, moves, Math.max(0, timeLeft)) + (badge ? ` ${badge}` : "");
    celebrate(() => opts.onWin(starsFor(moves, cfg), line));
  }

  function finishLose(reason: "moves" | "time"): void {
    if (levelDone) return;
    levelDone = true;
    intervals.forEach((t) => clearInterval(t));
    intervals.clear();
    clearResume();
    later(() => opts.onLose(loseLine(cfg, reason)), 300);
  }

  function spendMove(): void {
    moves++;
    saveResume();
    if (moves >= cfg.moveLimit && !levelDone) later(() => finishLose("moves"), 120);
  }

  function undoOnce(): void {
    if (levelDone || kind !== "rotate") return;
    const step = rotUndo.pop();
    if (!step) return;
    rot = undoRotate(rot, step);
    // 视角倒着转回去(-90°),不绕远路
    visDeg[step.pos] = stepAngle(visDeg[step.pos] ?? step.to * 90, step.to, step.from);
    moves = Math.max(0, moves - 1);
    opts.sfx("tap");
    saveResume();
    render();
    msgEl.textContent = "退回上一步啦，这一下不算走冤枉路～";
  }

  function onTile(pos: number): void {
    if (levelDone) return;
    if (kind === "rotate") {
      const turned = applyRotate(rot, pos);
      rot = turned.rot;
      rotUndo.push(turned.step);
      // 视角顺时针 +90°,120ms 过渡由 CSS 走
      visDeg[pos] = stepAngle(visDeg[pos] ?? turned.step.from * 90, turned.step.from, turned.step.to);
      opts.sfx("tap");
      spendMove();
      render();
      if (rot[pos] === 0 && !prefersReduced()) flashStar(tiles[pos]);
      if (rot.every((r) => r === 0)) finishWin();
      return;
    }
    if (kind === "fill") {
      if (!holes.includes(pos) || placed[pos]) {
        opts.sfx("tap");
        msgEl.textContent = "这一块已经在画上啦，找找还空着的缺口～";
        return;
      }
      if (picked < 0) {
        opts.sfx("tap");
        msgEl.textContent = "把托盘里的一块拖上来，或者先点一块再点这个缺口！";
        return;
      }
      const value = tray[picked];
      spendMove();
      if (value === pos) {
        placed[pos] = true;
        usedPiece[picked] = true;
        picked = -1;
        opts.sfx("coin");
        msgEl.textContent = "补对啦！继续找下一个缺口～";
        saveResume();
        render();
        if (holes.every((h) => placed[h])) finishWin();
        applyDropFx(tiles[pos], "snap");
      } else {
        opts.sfx("oops");
        msgEl.textContent = bounceLine("wrong");
        render();
        applyDropFx(tiles[pos], "wrong");
      }
      return;
    }
    const empty = board.indexOf(EMPTY);
    if (!neighborsOf(empty, cfg.rows, cfg.cols).includes(pos)) {
      if (board[pos] !== EMPTY) {
        opts.sfx("oops");
        msgEl.textContent = "这块推不动～真正在移动的是空格，点它旁边的方块～";
      }
      return;
    }
    [board[empty], board[pos]] = [board[pos], board[empty]];
    opts.sfx("tap");
    spendMove();
    render();
    // 滑入动画:从被点的格滑进原空格,90ms + 轻微惯性拉伸(纯视觉,棋盘数据已换好)
    const slid = tiles[empty];
    slid.style.setProperty("--pt-sx", `${(colOf(pos) - colOf(empty)) * 100}%`);
    slid.style.setProperty("--pt-sy", `${(rowOf(pos) - rowOf(empty)) * 100}%`);
    slid.classList.add("pzv-slidein");
    fx.later(() => slid.classList.remove("pzv-slidein"), 150);
    if (isSolvedSlide(board)) finishWin();
  }

  function onPiece(i: number): void {
    if (levelDone || usedPiece[i]) return;
    picked = picked === i ? -1 : i;
    opts.sfx("tap");
    msgEl.textContent = picked >= 0 ? "选好啦，拖上去或者点缺口都行！" : "换一块也行，慢慢挑～";
    render();
  }

  // -------------------------------------------------------------------------
  // 1.2 拖着碎片走 + 磁性吸附
  // -------------------------------------------------------------------------

  interface DragState {
    /** 托盘下标 */
    i: number;
    /** 按下时的手指位置，用来分辨「点一下」和「拖一段」 */
    x0: number;
    y0: number;
    /** 出发时碎片在屏幕上的中心，弹回就回这儿 */
    homeX: number;
    homeY: number;
    moved: boolean;
    el: HTMLElement | null;
  }

  /** 手指要挪过这么多像素才算拖，短于它仍然当点一下（保留 1.1 的点选手感） */
  const DRAG_SLOP = 6;
  /** 拖动时碎片浮在手指上方这么高，免得被手挡住 */
  const LIFT = 20;
  let drag: DragState | null = null;

  /** 现在这块画板的几何：格宽 / 缝宽都按真实布局量，缩放和横竖屏都不会算歪 */
  function boardGeom(): GridGeom {
    const first = tiles[0].getBoundingClientRect();
    const gap = cfg.cols > 1 ? tiles[1].getBoundingClientRect().left - first.left - first.width : 0;
    return { left: first.left, top: first.top, cell: first.width, gap, rows: cfg.rows, cols: cfg.cols };
  }

  function markTarget(pos: number | null, ghostPos: number | null = null): void {
    for (let p = 0; p < total; p++) {
      tiles[p].classList.toggle("pzt-target", p === pos);
      tiles[p].classList.toggle("pzv-ghost-on", p === ghostPos);
    }
  }

  function beginDrag(i: number, btn: HTMLElement, ev: PointerEvent): void {
    if (levelDone || usedPiece[i] || drag) return;
    const box = btn.getBoundingClientRect();
    drag = {
      i,
      x0: ev.clientX,
      y0: ev.clientY,
      homeX: box.left + box.width / 2,
      homeY: box.top + box.height / 2,
      moved: false,
      el: null,
    };
  }

  function makeFloater(i: number): HTMLElement {
    const v = tray[i];
    const tile = pool[v] ?? pool[pool.length - 1];
    const side = Math.max(40, Math.round(boardGeom().cell));
    const el = document.createElement("div");
    el.className = "pzt-drag pzv-cut";
    el.style.width = `${side}px`;
    el.style.height = `${side}px`;
    el.innerHTML = skinFor(v, tile.bg);
    document.body.appendChild(el);
    return el;
  }

  function moveFloater(el: HTMLElement, x: number, y: number): void {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  function onDragMove(ev: PointerEvent): void {
    if (!drag || levelDone) return;
    if (!drag.moved) {
      if (Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) < DRAG_SLOP) return;
      drag.moved = true;
      picked = drag.i;
      drag.el = makeFloater(drag.i);
      render();
    }
    if (!drag.el) return;
    ev.preventDefault();
    moveFloater(drag.el, ev.clientX, ev.clientY - LIFT);
    const g = boardGeom();
    const pos = nearestCell(g, ev.clientX, ev.clientY - LIFT);
    const near = dropDistance(g, ev.clientX, ev.clientY - LIFT) <= snapThreshold(g.cell);
    const targetPos = near && holes.includes(pos) && !placed[pos] ? pos : null;
    // 虚影提示:只读既有校验的输入(手里块的值/缺口表/已补表),接近正确位才浮出影子
    const ghostPos =
      targetPos !== null &&
      ghostTarget(targetPos, tray[drag.i], holes, holes.filter((h) => placed[h]))
        ? targetPos
        : null;
    markTarget(targetPos, ghostPos);
  }

  /** 把手里的碎片滑到 (x,y) 再收工：磁性吸附和弹回共用这一段 */
  function glideTo(el: HTMLElement, x: number, y: number, ms: number, done: () => void): void {
    // 先停掉拾起抬升动画,否则 forwards 填充会压住下面的行内 transform
    el.style.animation = "none";
    el.style.transition = `left ${ms}ms cubic-bezier(.2,.85,.3,1), top ${ms}ms cubic-bezier(.2,.85,.3,1), transform ${ms}ms ease`;
    raf = requestAnimationFrame(() => {
      raf = 0;
      moveFloater(el, x, y);
      el.style.transform = "translate(-50%, -50%) scale(1)";
    });
    later(() => {
      el.remove();
      done();
    }, ms + 30);
  }

  function onDragEnd(ev: PointerEvent): void {
    if (!drag) return;
    const d = drag;
    drag = null;
    markTarget(null);
    if (!d.moved || !d.el) {
      onPiece(d.i);
      return;
    }
    const el = d.el;
    if (levelDone) {
      el.remove();
      return;
    }
    const g = boardGeom();
    // 判定用碎片自己的中心（手指上方 20px 那一点），孩子看到哪就落在哪
    const px = ev.clientX;
    const py = ev.clientY - LIFT;
    const res = resolveDrop(g, px, py, {
      holes,
      filled: holes.filter((h) => placed[h]),
      value: tray[d.i],
    });
    const reduced = prefersReduced();
    if (res.kind === "snap") {
      const c = cellCenter(g, res.pos);
      opts.sfx("tap");
      spendMove();
      glideTo(el, c.x, c.y, magnetMs(reduced), () => {
        placed[res.pos] = true;
        usedPiece[d.i] = true;
        picked = -1;
        opts.sfx("coin");
        msgEl.textContent = "咔哒，吸进去啦！继续找下一个缺口～";
        saveResume();
        render();
        if (holes.every((h) => placed[h])) finishWin();
        applyDropFx(tiles[res.pos], "snap");
      });
      return;
    }
    if (dropCostsMove(res)) {
      opts.sfx("oops");
      spendMove();
    }
    // 放错的那格轻轻摇头(提示不批评);离得远/格子已满只弹回,不摇
    if (res.reason === "wrong") applyDropFx(tiles[res.pos], "wrong");
    msgEl.textContent = bounceLine(res.reason);
    glideTo(el, d.homeX, d.homeY, reduced ? 16 : BOUNCE_MS, () => {
      picked = -1;
      render();
    });
  }

  if (kind === "fill") {
    const move = (ev: PointerEvent): void => onDragMove(ev);
    const up = (ev: PointerEvent): void => onDragEnd(ev);
    const cancel = (): void => {
      if (!drag) return;
      const d = drag;
      drag = null;
      markTarget(null);
      d.el?.remove();
      picked = -1;
      render();
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    bag.add(() => window.removeEventListener("pointermove", move));
    bag.add(() => window.removeEventListener("pointerup", up));
    bag.add(() => window.removeEventListener("pointercancel", cancel));
  }

  function showHint(): void {
    if (levelDone || hintsLeft <= 0) return;
    hintsLeft--;
    opts.sfx("coin");
    if (kind === "rotate") {
      const wrong = rot.findIndex((r) => r !== 0);
      render();
      if (wrong >= 0) {
        tiles[wrong].classList.add("pz-glow");
        msgEl.textContent = `💡 亮亮的那块还歪着，再点 ${(4 - rot[wrong]) % 4} 下就正啦！`;
        later(() => tiles[wrong].classList.remove("pz-glow"), 2200);
      }
      return;
    }
    if (kind === "fill") {
      render();
      const target = picked >= 0 ? tray[picked] : holes.find((h) => !placed[h]);
      if (target !== undefined && holes.includes(target) && !placed[target]) {
        tiles[target].classList.add("pz-glow");
        msgEl.textContent = picked >= 0 ? "💡 这块要补到亮亮的那个缺口！" : "💡 先补亮亮的这个缺口试试～";
        later(() => tiles[target].classList.remove("pz-glow"), 2200);
      }
      return;
    }
    if (cfg.hidePreview || preview === "none") {
      peek(2200);
      msgEl.textContent = "👀 再看一眼完整图案，重点记特征明显的那几块！";
      render();
      return;
    }
    render();
    const best = bestSlideMove(board, cfg.rows, cfg.cols);
    if (best !== undefined) {
      tiles[best].classList.add("pz-glow");
      msgEl.textContent = "💡 发光的那块离归位最近，先推它！";
      later(() => tiles[best].classList.remove("pz-glow"), 2200);
    }
  }

  hintBtn.addEventListener("click", showHint);
  eyeBtn.addEventListener("click", cyclePreview);
  undoBtn?.addEventListener("click", undoOnce);

  // ---- 开局布置 ----
  if (kind === "rotate") {
    rot = buildRotations(cfg.rows, cfg.cols, cfg.rotateWrong ?? 4, cfg.seed ?? 1);
    if (SMOKE) boardEl.dataset.rot = rot.join(",");
  } else if (kind === "fill") {
    const puzzle = buildFillPuzzle(
      cfg.rows,
      cfg.cols,
      cfg.missing ?? 3,
      cfg.extraPieces ?? 2,
      cfg.seed ?? 1,
      pool.length
    );
    holes = puzzle.holes;
    tray = puzzle.tray;
    placed = {};
    usedPiece = tray.map(() => false);
    if (SMOKE) {
      boardEl.dataset.holes = holes.join(",");
      boardEl.dataset.tray = tray.join(",");
    }
  } else {
    const plan = shuffleBoard(cfg.rows, cfg.cols, cfg.shuffleSteps, Math.random);
    plan.board.forEach((v, i) => { board[i] = v; });
    undoPlan = plan.undo;
    if (SMOKE) boardEl.dataset.undo = undoPlan.join(",");
  }
  if (SMOKE) boardEl.dataset.kind = kind;

  const resumed = loadResume();

  renderPreview();
  applyPreview();
  render();
  msgEl.textContent = resumed
    ? `📌 上次这幅画拼到第 ${moves} 步，接着来！`
    : openingLine(cfg);
  if (kind === "slide" && cfg.hidePreview) {
    later(() => {
      memoryHidden = true;
      applyPreview();
      msgEl.textContent = "图案藏起来了，先把记住的那几块归位当参照（提示能再看一眼）！";
    }, 5000);
  }

  if (cfg.timeLimit) {
    const clock = setInterval(() => {
      if (levelDone || destroyed) return;
      timeLeft--;
      renderTop();
      if (timeLeft <= 0) finishLose("time");
    }, 1000);
    intervals.add(clock);
  }

  return {
    destroy() {
      destroyed = true;
      levelDone = true;
      intervals.forEach((t) => clearInterval(t));
      intervals.clear();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      fx.clear();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      drag?.el?.remove();
      drag = null;
      bag.clear();
      wrap.remove();
    },
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: PuzzleLevel = LEVELS[ctx.level];
  const board = createBoard(stage, {
    cfg,
    level: ctx.level,
    sfx: ctx.sfx,
    // 画廊语义:结算里露出这是第几幅作品(纯文案,评星与判定不动)
    onWin: (stars, msg) => ctx.win(stars, `🖼️ 第 ${ctx.level + 1} 幅装裱入册！${msg}`),
    onLose: (msg) => ctx.lose(msg),
  });
  return { destroy: () => board.destroy() };
}

// ---------------------------------------------------------------------------
// 无尽画廊
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "pz-mode";
  wrap.innerHTML = `<style>${CSS}</style>`;
  const head = document.createElement("div");
  head.className = "pz-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "pz-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "pz-chip";
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let round = 1;
  let current: { destroy: () => void } | null = null;
  let best = save.getGameProgress(meta.id).endlessBest;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showOver(sub: string): void {
    current?.destroy();
    current = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "pz-over";
    box.innerHTML = `<div class="pz-over-t">画廊今天先关门啦</div><div class="pz-over-s">${sub}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "pz-open";
    again.textContent = "🔁 从第 1 幅再来";
    again.addEventListener("click", () => {
      api.play("tap");
      round = 1;
      startRound();
    });
    box.appendChild(again);
    stage.appendChild(box);
  }

  function startRound(): void {
    current?.destroy();
    stage.innerHTML = "";
    chip.textContent = `♾️ ${endlessHallName(round)} · 第 ${round} 幅 · 最好 ${best} 幅`;
    current = createBoard(stage, {
      cfg: endlessBoard(round),
      banner: `♾️ 第 ${round} 幅`,
      sfx: (n) => api.play(n),
      onWin: () => {
        best = save.recordEndlessBest(meta.id, round);
        api.addStars(1);
        round++;
        startRound();
      },
      onLose: () => {
        const done = Math.max(0, round - 1);
        best = save.recordEndlessBest(meta.id, done);
        showOver(endlessLine(done, best));
      },
    });
  }

  startRound();

  return {
    destroy() {
      current?.destroy();
      current = null;
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
  bar.className = "pz-bar-modes";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "pz-open";
  bar.appendChild(endlessBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽画廊 · 最好 ${best} 幅` : "♾️ 无尽画廊 · 点我开拼！";
  }

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  endlessBtn.addEventListener("click", () => {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = mountEndless(modeHost, api, closeMode);
  });
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "步数越省星星越多，一行一行推最不容易返工！",
      grandMessage: "188 幅拼图全部复原，你的空间感和步数规划都练出来了！",
      guideTitle: "拼图乐园 · 复原手记",
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
