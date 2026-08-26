import { meta } from "./meta";
export { meta };

// 拼图乐园:188 关十本画册 + 无尽画廊。
// 1.1 新玩法:5×5 / 6×6 大画板、旋转块(点一下转 90°)、缺块补齐(托盘里挑对的补回去)、限时拼。
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

const SMOKE = typeof location !== "undefined" && /[?&]smoke=1/.test(location.search);

const CSS = `
.pz-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #EEF0FF, #FFF3F9); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.pz-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.pz-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #7B7FD0; box-shadow: 0 2px 6px rgba(130,130,210,.25); font-size: 14px; }
.pz-badge.pz-hot { color: #C2456F; }
.pz-row2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px; }
.pz-preview { display: grid; gap: 2px; background: #fff; padding: 5px; border-radius: 10px; box-shadow: 0 2px 6px rgba(130,130,210,.25); }
.pz-preview i { width: 16px; height: 16px; border-radius: 4px; font-style: normal; font-size: 11px; display: flex; align-items: center; justify-content: center; }
.pz-preview.pz-hidden i { background: #E8E6F5 !important; color: transparent; }
.pz-hint { border: none; border-radius: 14px; padding: 8px 14px; font-weight: 800; background: #D5C8F8; color: #5D48A0; cursor: pointer; box-shadow: 0 3px 0 #B7A3E8; font-size: 15px; font-family: inherit; }
.pz-hint:active { transform: translateY(2px); box-shadow: 0 1px 0 #B7A3E8; }
.pz-hint:disabled { opacity: .5; }
.pz-board { display: grid; gap: 8px; }
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
.pz-open { border: none; border-radius: 999px; padding: 9px 18px; font-size: 15px; font-weight: 900; color: #fff; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #8E86E0, #6E64C8); box-shadow: 0 4px 0 #544BA4; }
.pz-open:active { transform: translateY(2px); box-shadow: 0 2px 0 #544BA4; }
.pz-mode { max-width: 680px; margin: 0 auto; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }
.pz-mhead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 10px; }
.pz-back { border: none; border-radius: 999px; padding: 7px 13px; font-size: 14px; font-weight: 900; cursor: pointer; font-family: inherit; background: #ffffffd9; color: #6E64C8; box-shadow: 0 3px 0 rgba(110,100,200,.3); }
.pz-back:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(110,100,200,.3); }
.pz-chip { background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 800; font-size: 14px; color: #6E64C8; box-shadow: 0 2px 6px rgba(130,130,210,.25); }
.pz-over { text-align: center; padding: 26px 16px; background: #fff; border-radius: 18px; box-shadow: 0 4px 14px rgba(130,130,210,.25); }
.pz-over-t { font-size: 22px; font-weight: 900; color: #6E64C8; margin-bottom: 8px; }
.pz-over-s { font-size: 15px; font-weight: 700; color: #7B7FD0; line-height: 1.6; margin-bottom: 14px; }
`;

interface BoardOpts {
  cfg: PuzzleLevel;
  banner?: string;
  sfx: (name: "tap" | "win" | "oops" | "coin" | "pop") => void;
  onWin: (stars: 1 | 2 | 3, msg: string) => void;
  onLose: (msg: string) => void;
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
  let destroyed = false;
  let levelDone = false;
  let moves = 0;
  let hintsLeft = cfg.hints;
  let timeLeft = cfg.timeLimit ?? 0;
  const total = cfg.rows * cfg.cols;
  const EMPTY = total - 1;
  const pool = THEME_TILES[cfg.theme] ?? THEME_TILES[0];
  const pic = pool.slice(0, kind === "slide" ? total - 1 : Math.min(pool.length, total));

  // 推格子
  const board: number[] = Array.from({ length: total }, (_, i) => i);
  let undoPlan: number[] = [];
  // 旋转块
  let rot: number[] = [];
  // 缺块补齐
  let holes: number[] = [];
  let tray: number[] = [];
  let placed: Record<number, boolean> = {};
  let usedPiece: boolean[] = [];
  let picked = -1;

  const wrap = document.createElement("div");
  wrap.className = "pz-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="pz-top">
      <span class="pz-badge pz-moves">👣 0 / ${cfg.moveLimit} 步</span>
      <span class="pz-badge">⭐ ≤${cfg.three} 步 3 星</span>
      ${cfg.timeLimit ? `<span class="pz-badge pz-hot pz-time">⏳ ${cfg.timeLimit}s</span>` : ""}
      ${opts.banner ? `<span class="pz-badge pz-banner">${opts.banner}</span>` : ""}
    </div>
    <div class="pz-row2">
      <button class="pz-hint" type="button">💡 提示 x${cfg.hints}</button>
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
  const trayEl = wrap.querySelector(".pz-tray") as HTMLElement | null;

  boardEl.style.gridTemplateColumns = `repeat(${cfg.cols},1fr)`;
  boardEl.style.gap = cfg.cols >= 5 ? "5px" : "8px";
  boardEl.style.setProperty("--pz-fs", `clamp(13px, ${Math.max(6, Math.floor(52 / cfg.cols))}vw, 44px)`);
  boardEl.style.setProperty("--pz-num", cfg.cols >= 6 ? "0px" : cfg.cols >= 5 ? "9px" : "12px");

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

  function renderPreview(): void {
    previewEl.innerHTML = "";
    const cells = kind === "slide" ? total : Math.min(total, pic.length);
    for (let v = 0; v < total; v++) {
      const cell = document.createElement("i");
      if (v < cells && (kind !== "slide" || v < EMPTY)) {
        cell.style.background = pic[v].bg;
        cell.textContent = pic[v].emoji;
      }
      previewEl.appendChild(cell);
    }
  }

  function renderTop(): void {
    movesEl.textContent = `👣 ${moves} / ${cfg.moveLimit} 步`;
    if (timeEl) timeEl.textContent = `⏳ ${Math.max(0, timeLeft)}s`;
    hintBtn.textContent = `💡 提示 x${hintsLeft}`;
    hintBtn.disabled = hintsLeft <= 0 || levelDone;
  }

  // ---- 推格子 ----
  function renderSlide(): void {
    for (let pos = 0; pos < total; pos++) {
      const v = board[pos];
      const el = tiles[pos];
      el.classList.remove("pz-glow");
      if (v === EMPTY) {
        el.className = "pz-tile pz-empty";
        el.innerHTML = "";
        el.style.background = "";
      } else {
        el.className = "pz-tile";
        el.style.background = pic[v].bg;
        el.innerHTML = `${pic[v].emoji}<small>${v + 1}</small>`;
      }
    }
    renderTop();
  }

  // ---- 旋转块 ----
  function renderRotate(): void {
    for (let pos = 0; pos < total; pos++) {
      const el = tiles[pos];
      const tile = pic[pos] ?? pic[pic.length - 1];
      el.className = `pz-tile${rot[pos] === 0 ? " pz-upright" : ""}`;
      el.style.background = tile.bg;
      el.innerHTML =
        `<span class="pz-spin" style="transform:rotate(${rot[pos] * 90}deg)">` +
        `<span class="pz-mark">▲</span><span>${tile.emoji}</span></span>`;
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
        el.className = "pz-tile pz-gap";
        el.style.background = "";
        el.innerHTML = "？";
      } else {
        el.className = `pz-tile${isHole ? "" : " pz-fixed"}`;
        el.style.background = tile.bg;
        el.innerHTML = `${tile.emoji}`;
      }
    }
    if (trayEl) {
      trayEl.innerHTML = "";
      tray.forEach((v, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `pz-piece${picked === i ? " pz-piece-on" : ""}${usedPiece[i] ? " pz-piece-used" : ""}`;
        const tile = pool[v] ?? pool[pool.length - 1];
        btn.style.background = tile.bg;
        btn.textContent = tile.emoji;
        btn.disabled = usedPiece[i] || levelDone;
        btn.addEventListener("click", () => onPiece(i));
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

  function finishWin(): void {
    if (levelDone) return;
    levelDone = true;
    intervals.forEach((t) => clearInterval(t));
    intervals.clear();
    opts.sfx("win");
    later(() => opts.onWin(starsFor(moves, cfg), winLine(cfg, moves, Math.max(0, timeLeft))), 400);
  }

  function finishLose(reason: "moves" | "time"): void {
    if (levelDone) return;
    levelDone = true;
    intervals.forEach((t) => clearInterval(t));
    intervals.clear();
    later(() => opts.onLose(loseLine(cfg, reason)), 300);
  }

  function spendMove(): void {
    moves++;
    if (moves >= cfg.moveLimit && !levelDone) later(() => finishLose("moves"), 120);
  }

  function onTile(pos: number): void {
    if (levelDone) return;
    if (kind === "rotate") {
      rot[pos] = (rot[pos] + 1) % 4;
      opts.sfx("tap");
      spendMove();
      render();
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
        msgEl.textContent = "先点下面托盘里的一块，再来补这个缺口！";
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
        render();
        if (holes.every((h) => placed[h])) finishWin();
      } else {
        opts.sfx("oops");
        msgEl.textContent = "这块和小图上的不一样，再对着小图比一比～";
        render();
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
    if (isSolvedSlide(board)) finishWin();
  }

  function onPiece(i: number): void {
    if (levelDone || usedPiece[i]) return;
    picked = picked === i ? -1 : i;
    opts.sfx("tap");
    msgEl.textContent = picked >= 0 ? "选好啦，点画上的缺口把它放进去！" : "换一块也行，慢慢挑～";
    render();
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
    if (cfg.hidePreview) {
      previewEl.classList.remove("pz-hidden");
      msgEl.textContent = "👀 再看一眼完整图案，重点记特征明显的那几块！";
      render();
      later(() => previewEl.classList.add("pz-hidden"), 2200);
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

  renderPreview();
  render();
  msgEl.textContent = openingLine(cfg);
  if (kind === "slide" && cfg.hidePreview) {
    later(() => {
      previewEl.classList.add("pz-hidden");
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
      wrap.remove();
    },
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: PuzzleLevel = LEVELS[ctx.level];
  const board = createBoard(stage, {
    cfg,
    sfx: ctx.sfx,
    onWin: (stars, msg) => ctx.win(stars, msg),
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
