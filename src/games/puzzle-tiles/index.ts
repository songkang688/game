import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, LEVELS, THEME_TILES, type PuzzleLevel } from "./levels";

const CSS = `
.pz-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #EEF0FF, #FFF3F9); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.pz-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.pz-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #7B7FD0; box-shadow: 0 2px 6px rgba(130,130,210,.25); font-size: 14px; }
.pz-row2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px; }
.pz-preview { display: grid; gap: 2px; background: #fff; padding: 5px; border-radius: 10px; box-shadow: 0 2px 6px rgba(130,130,210,.25); }
.pz-preview i { width: 16px; height: 16px; border-radius: 4px; font-style: normal; font-size: 11px; display: flex; align-items: center; justify-content: center; }
.pz-preview.pz-hidden i { background: #E8E6F5 !important; color: transparent; }
.pz-hint { border: none; border-radius: 14px; padding: 8px 14px; font-weight: 800; background: #D5C8F8; color: #5D48A0; cursor: pointer; box-shadow: 0 3px 0 #B7A3E8; font-size: 15px; font-family: inherit; }
.pz-hint:active { transform: translateY(2px); box-shadow: 0 1px 0 #B7A3E8; }
.pz-hint:disabled { opacity: .5; }
.pz-board { display: grid; gap: 8px; }
.pz-tile { aspect-ratio: 1; border: none; border-radius: 16px; font-size: clamp(22px, 8vw, 44px); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; transition: transform .14s; box-shadow: 0 3px 8px rgba(120,120,200,.2); padding: 0; }
.pz-tile small { font-size: 12px; color: rgba(90,80,120,.65); font-weight: 700; }
.pz-tile:active { transform: scale(.94); }
.pz-tile.pz-empty { background: rgba(255,255,255,.35) !important; box-shadow: inset 0 2px 6px rgba(120,120,200,.2); cursor: default; }
.pz-tile.pz-glow { animation: pzGlow 1s ease infinite; box-shadow: 0 0 0 4px #FFD86E; }
@keyframes pzGlow { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
.pz-msg { text-align: center; min-height: 22px; color: #7B7FD0; font-weight: 700; margin-top: 10px; font-size: 15px; }
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: PuzzleLevel = LEVELS[ctx.level];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let levelDone = false;
  let moves = 0;
  let hintsLeft = cfg.hints;
  const total = cfg.rows * cfg.cols;
  const EMPTY = total - 1;
  const pic = THEME_TILES[cfg.theme].slice(0, total - 1);
  const board: number[] = Array.from({ length: total }, (_, i) => i);

  const wrap = document.createElement("div");
  wrap.className = "pz-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="pz-top">
      <span class="pz-badge pz-moves">👣 0 / ${cfg.moveLimit} 步</span>
      <span class="pz-badge">⭐ ≤${cfg.three} 步 3 星</span>
    </div>
    <div class="pz-row2">
      <button class="pz-hint" type="button">💡 提示 x${cfg.hints}</button>
      <div class="pz-preview" style="grid-template-columns:repeat(${cfg.cols},16px)"></div>
    </div>
    <div class="pz-board" style="grid-template-columns:repeat(${cfg.cols},1fr)"></div>
    <div class="pz-msg"></div>
  `;
  stage.appendChild(wrap);

  const boardEl = wrap.querySelector(".pz-board") as HTMLElement;
  const movesEl = wrap.querySelector(".pz-moves") as HTMLElement;
  const msgEl = wrap.querySelector(".pz-msg") as HTMLElement;
  const previewEl = wrap.querySelector(".pz-preview") as HTMLElement;
  const hintBtn = wrap.querySelector(".pz-hint") as HTMLButtonElement;

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

  function emptyPos(): number {
    return board.indexOf(EMPTY);
  }

  function neighbors(pos: number): number[] {
    const r = Math.floor(pos / cfg.cols), c = pos % cfg.cols;
    const out: number[] = [];
    if (r > 0) out.push(pos - cfg.cols);
    if (r < cfg.rows - 1) out.push(pos + cfg.cols);
    if (c > 0) out.push(pos - 1);
    if (c < cfg.cols - 1) out.push(pos + 1);
    return out;
  }

  function renderPreview(): void {
    previewEl.innerHTML = "";
    for (let v = 0; v < total; v++) {
      const cell = document.createElement("i");
      if (v < EMPTY) {
        cell.style.background = pic[v].bg;
        cell.textContent = pic[v].emoji;
      }
      previewEl.appendChild(cell);
    }
  }

  function render(): void {
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
    movesEl.textContent = `👣 ${moves} / ${cfg.moveLimit} 步`;
    hintBtn.textContent = `💡 提示 x${hintsLeft}`;
    hintBtn.disabled = hintsLeft <= 0;
  }

  function isSolved(): boolean {
    return board.every((v, i) => v === i);
  }

  function shuffle(): void {
    board.forEach((_, i) => { board[i] = i; });
    let prev = -1;
    for (let k = 0; k < cfg.shuffleSteps || isSolved(); k++) {
      const e = emptyPos();
      const opts = neighbors(e).filter((p) => p !== prev);
      const chosen = opts[Math.floor(Math.random() * opts.length)];
      [board[e], board[chosen]] = [board[chosen], board[e]];
      prev = e;
      if (k > 500) break;
    }
  }

  function showHint(): void {
    if (levelDone || hintsLeft <= 0) return;
    hintsLeft--;
    ctx.sfx("coin");
    if (cfg.hidePreview) {
      // 记忆模式：提示 = 再偷看一眼完整图案
      previewEl.classList.remove("pz-hidden");
      msgEl.textContent = "👀 再看一眼完整图案，重点记特征明显的那几块！";
      render();
      later(() => previewEl.classList.add("pz-hidden"), 2200);
      return;
    }
    const e = emptyPos();
    const movable = neighbors(e);
    let best = movable.find((p) => board[p] === e);
    if (best === undefined) {
      let bestGain = -99;
      for (const p of movable) {
        const v = board[p];
        const tr = Math.floor(v / cfg.cols), tc = v % cfg.cols;
        const now = Math.abs(Math.floor(p / cfg.cols) - tr) + Math.abs((p % cfg.cols) - tc);
        const after = Math.abs(Math.floor(e / cfg.cols) - tr) + Math.abs((e % cfg.cols) - tc);
        const gain = now - after;
        if (gain > bestGain) { bestGain = gain; best = p; }
      }
    }
    render();
    if (best !== undefined) {
      tiles[best].classList.add("pz-glow");
      msgEl.textContent = "💡 发光的那块离归位最近，先推它！";
      later(() => tiles[best as number].classList.remove("pz-glow"), 2200);
    }
  }

  function onTile(pos: number): void {
    if (levelDone) return;
    const e = emptyPos();
    if (!neighbors(e).includes(pos)) {
      if (board[pos] !== EMPTY) {
        ctx.sfx("oops");
        msgEl.textContent = "这块推不动～真正在移动的是空格，点它旁边的方块～";
      }
      return;
    }
    [board[e], board[pos]] = [board[pos], board[e]];
    moves++;
    ctx.sfx("tap");
    render();
    if (isSolved()) {
      levelDone = true;
      const got = moves <= cfg.three ? 3 : moves <= cfg.two ? 2 : 1;
      later(() => ctx.win(got as 1 | 2 | 3, `只用了 ${moves} 步就复原，路线规划得很省！`), 400);
      return;
    }
    if (moves >= cfg.moveLimit) {
      levelDone = true;
      later(() => ctx.lose("步数用完啦～下一次先拼好第一行并锁住它，再一行行往下推，会省很多步！"), 300);
    }
  }

  hintBtn.addEventListener("click", showHint);

  shuffle();
  renderPreview();
  render();
  if (cfg.hidePreview) {
    msgEl.textContent = "👀 记住完整图案，5 秒后藏起来，先记几块特征明显的！";
    later(() => {
      previewEl.classList.add("pz-hidden");
      msgEl.textContent = "图案藏起来了，先把记住的那几块归位当参照（提示能再看一眼）！";
    }, 5000);
  } else {
    msgEl.textContent = "从上往下、从左往右一行一行复原，拼好的那行就别再动～";
  }

  return {
    destroy() {
      destroyed = true;
      levelDone = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    },
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,
    mapHint: "步数越省星星越多，一行一行推最不容易返工！",
    grandMessage: "99 幅拼图全部复原，你的空间感和步数规划都练出来了！",
  });
}
