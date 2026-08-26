import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import {
  anyMove,
  applyGravity,
  createBoard,
  findPath,
  MASK_FACE,
  maskKey,
  pickMasked,
  removePair,
  rotateBoard,
  shuffleBoard,
  tilesLeft,
  type BoardState,
  type Pt
} from "./board";
import { CHAPTERS, LEVELS, THEME_EMOJIS, turnsOf, type LlkLevel } from "./levels";

const BGS = [
  "#FFE3E3", "#FFF3CE", "#EBDDFB", "#FFE0EC", "#E0F0FF", "#FFE9F3", "#FFF6D8",
  "#E2F0FF", "#F6E3FF", "#FFEFE0", "#FFE4D0", "#FFDFE8", "#E3EBFF", "#E2F7DF",
];

const CSS = `
.llk-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF2E4, #FDEBF3); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.llk-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.llk-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #D98548; box-shadow: 0 2px 6px rgba(220,160,100,.25); font-size: 14px; }
.llk-badge.llk-hurry { color: #E8590C; animation: llkBlink 1s infinite; }
.llk-badge.llk-rule { color: #7A5AA8; background: #F3ECFF; }
@keyframes llkBlink { 50% { opacity: .5; } }
.llk-shuffle { border: none; border-radius: 14px; padding: 6px 12px; font-weight: 700; background: #FFD9A8; color: #8A5A20; cursor: pointer; box-shadow: 0 3px 0 #EFBC82; font-size: 14px; font-family: inherit; }
.llk-shuffle:active { transform: translateY(2px); box-shadow: 0 1px 0 #EFBC82; }
.llk-shuffle:disabled { opacity: .5; }
.llk-boardbox { position: relative; }
.llk-board { display: grid; gap: 3px; transition: transform .3s ease; }
.llk-board.llk-spin { transform: rotate(90deg) scale(.86); }
.llk-cell { aspect-ratio: 1; border: none; border-radius: 10px; font-size: clamp(13px, 4vw, 24px); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform .12s, opacity .25s; padding: 0; box-shadow: 0 2px 4px rgba(200,140,90,.18); }
.llk-cell.llk-gone { background: transparent !important; box-shadow: none; cursor: default; }
.llk-cell.llk-sel { box-shadow: 0 0 0 3px #FF9E5E; transform: scale(1.1); }
.llk-cell.llk-mask { background: #E7E0F5 !important; color: #8B7BB8; }
.llk-cell:active { transform: scale(.9); }
.llk-line { position: absolute; inset: 0; pointer-events: none; }
.llk-msg { text-align: center; min-height: 22px; color: #D98548; font-weight: 700; margin-top: 8px; font-size: 15px; }
@media (prefers-reduced-motion: reduce) {
  .llk-board { transition: none; }
  .llk-badge.llk-hurry { animation: none; }
}
`;

/** 头部那句规则小贴纸：一眼看出这一关的新花样 */
function ruleChip(cfg: LlkLevel): string {
  if (cfg.rotateMs) return "🌀 棋盘会转";
  if (turnsOf(cfg) <= 1) return "📏 只准拐一次";
  if (cfg.disguise) return "🎭 有面具";
  if (cfg.gravity === "up") return "🧲 往上飘";
  if (cfg.gravity === "right") return "🧲 往右滑";
  return "";
}

function openingHint(cfg: LlkLevel): string {
  if (cfg.rotateMs) return "每过一会儿整块棋盘就转 90°，记图案别记坐标。";
  if (turnsOf(cfg) <= 1) return "这里的线最多只准拐一次弯，先找同一行同一列的。";
  if (cfg.disguise) return "戴面具的图案点一下露真身，先翻一遍摸清盘面再动手。";
  if (cfg.gravity === "up") return "重力向上：消掉一对后，下面的图案会补上来。";
  if (cfg.gravity === "right") return "重力向右：消掉一对后，左边的图案会挤过来。";
  if (cfg.gravity === "down") return "重力向下：消掉一对后，上面的图案会落下来。";
  if (cfg.gravity === "left") return "重力向左：消掉一对后，右边的图案会挤过来。";
  return `${cfg.rows}×${cfg.cols} 棋盘，${cfg.seconds} 秒内全部连完，先从边角下手！`;
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: LlkLevel = LEVELS[ctx.level];
  const EMOJIS = THEME_EMOJIS[cfg.theme];
  const maxTurns = turnsOf(cfg);
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  let destroyed = false;
  let levelDone = false;
  let selected: Pt | null = null;
  let timeLeft = cfg.seconds;
  let shufflesLeft = cfg.shuffles;
  const board: BoardState = createBoard(
    { rows: cfg.rows, cols: cfg.cols, kinds: cfg.kinds, gravity: cfg.gravity, maxTurns },
    Math.random
  );
  const { R, C } = board;
  let masked: Set<string> = new Set();
  const revealed = new Set<string>();
  const cells: HTMLButtonElement[][] = [];

  const wrap = document.createElement("div");
  wrap.className = "llk-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="llk-top">
      <span class="llk-badge llk-left">🧸 剩 0 对</span>
      <span class="llk-badge llk-time">⏰ 0 秒</span>
      ${ruleChip(cfg) ? `<span class="llk-badge llk-rule">${ruleChip(cfg)}</span>` : ""}
      <button class="llk-shuffle" type="button">🔀 洗牌</button>
    </div>
    <div class="llk-boardbox">
      <div class="llk-board"></div>
      <canvas class="llk-line"></canvas>
    </div>
    <div class="llk-msg"></div>
  `;
  stage.appendChild(wrap);

  const boardEl = wrap.querySelector(".llk-board") as HTMLElement;
  const leftEl = wrap.querySelector(".llk-left") as HTMLElement;
  const timeEl = wrap.querySelector(".llk-time") as HTMLElement;
  const msgEl = wrap.querySelector(".llk-msg") as HTMLElement;
  const lineCanvas = wrap.querySelector(".llk-line") as HTMLCanvasElement;
  const shuffleBtn = wrap.querySelector(".llk-shuffle") as HTMLButtonElement;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed) fn();
    }, ms);
    timeouts.add(t);
  }

  function rerollMasks(): void {
    if (!cfg.disguise) return;
    masked = pickMasked(board, cfg.disguise, Math.random);
    revealed.clear();
  }

  function setup(): void {
    boardEl.style.gridTemplateColumns = `repeat(${C}, 1fr)`;
    for (let r = 0; r < R; r++) {
      const row: HTMLButtonElement[] = [];
      for (let col = 0; col < C; col++) {
        const btn = document.createElement("button");
        btn.className = "llk-cell";
        btn.type = "button";
        const rr = r, cc = col;
        btn.addEventListener("click", () => onCell(rr, cc));
        boardEl.appendChild(btn);
        row.push(btn);
      }
      cells.push(row);
    }

    if (!anyMove(board, maxTurns)) doShuffle(true, true);
    rerollMasks();
    render();
    msgEl.textContent = openingHint(cfg);

    const clock = setInterval(() => {
      if (levelDone || destroyed) return;
      timeLeft--;
      renderTop();
      if (timeLeft <= 0) fail("时间到～下一局先清边角，边角的线拐弯少，还能给里面让出通道！");
    }, 1000);
    intervals.add(clock);

    if (cfg.rotateMs && cfg.rotateMs > 0) {
      const spin = setInterval(() => {
        if (levelDone || destroyed) return;
        doRotate();
      }, Math.max(4000, cfg.rotateMs));
      intervals.add(spin);
    }
    if (cfg.disguise && cfg.disguiseMs && cfg.disguiseMs > 0) {
      const swapMask = setInterval(() => {
        if (levelDone || destroyed) return;
        rerollMasks();
        render();
        msgEl.textContent = "🎭 面具换了一批，之前记的失效了，重新翻一遍～";
      }, Math.max(3500, cfg.disguiseMs));
      intervals.add(swapMask);
    }
  }

  function pairsLeft(): number {
    return tilesLeft(board) / 2;
  }

  function renderTop(): void {
    leftEl.textContent = `🧸 剩 ${pairsLeft()} 对`;
    timeEl.textContent = `⏰ ${timeLeft} 秒`;
    timeEl.classList.toggle("llk-hurry", timeLeft <= 15);
    shuffleBtn.textContent = `🔀 洗牌 x${shufflesLeft}`;
    shuffleBtn.disabled = shufflesLeft <= 0 || levelDone;
  }

  function faceOf(r: number, c: number): { text: string; bg: string; hidden: boolean } {
    const v = board.grid[r][c];
    const key = maskKey(r, c);
    const isSel = !!selected && selected[0] === r && selected[1] === c;
    if (masked.has(key) && !revealed.has(key) && !isSel) {
      return { text: MASK_FACE, bg: "", hidden: true };
    }
    return { text: EMOJIS[v], bg: BGS[v % BGS.length], hidden: false };
  }

  function render(): void {
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const el = cells[r][c];
        const v = board.grid[r][c];
        if (v < 0) {
          el.classList.add("llk-gone");
          el.classList.remove("llk-sel", "llk-mask");
          el.textContent = "";
          el.style.background = "";
          el.setAttribute("aria-hidden", "true");
          continue;
        }
        const face = faceOf(r, c);
        el.classList.remove("llk-gone");
        el.removeAttribute("aria-hidden");
        el.textContent = face.text;
        el.style.background = face.bg;
        el.classList.toggle("llk-mask", face.hidden);
        el.setAttribute("aria-label", face.hidden ? "戴着面具的图案，点一下看看" : `图案 ${face.text}`);
        el.classList.toggle("llk-sel", !!selected && selected[0] === r && selected[1] === c);
      }
    }
    renderTop();
  }

  function drawPath(path: Pt[]): void {
    const rect = boardEl.getBoundingClientRect();
    if (rect.width === 0) return;
    lineCanvas.width = rect.width;
    lineCanvas.height = rect.height;
    const c2d = lineCanvas.getContext("2d");
    if (!c2d) return;
    const cw = rect.width / C;
    const chh = rect.height / R;
    c2d.clearRect(0, 0, rect.width, rect.height);
    c2d.strokeStyle = "#FF8A4C";
    c2d.lineWidth = 4;
    c2d.lineCap = "round";
    c2d.lineJoin = "round";
    c2d.beginPath();
    path.forEach(([r, c], i) => {
      const x = c * cw + cw / 2;
      const y = r * chh + chh / 2;
      if (i === 0) c2d.moveTo(x, y);
      else c2d.lineTo(x, y);
    });
    c2d.stroke();
    later(() => {
      const ctx2 = lineCanvas.getContext("2d");
      if (ctx2) ctx2.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
    }, 380);
  }

  /** 1.1 风车旋转：整块棋盘顺时针转 90°，图案一个不少 */
  function doRotate(): void {
    if (!rotateBoard(board)) return;
    selected = null;
    revealed.clear();
    rerollMasks();
    boardEl.classList.add("llk-spin");
    later(() => boardEl.classList.remove("llk-spin"), 320);
    ctx.sfx("tap");
    msgEl.textContent = "🌀 棋盘转了 90°，先花一秒重新定位再动手！";
    render();
    if (!anyMove(board, maxTurns) && tilesLeft(board) > 0) {
      if (cfg.autoShuffleFree || shufflesLeft > 0) doShuffle(true);
      else fail("转完之后没有可连的了～洗牌留给真正的死局，再来一局就顺了！");
    }
  }

  function doShuffle(auto: boolean, free = false): void {
    // 1.1 新场馆规则更花，连不动时的自动重排不计次，绝不把人堵死
    const noCharge = free || (auto && !!cfg.autoShuffleFree);
    if (!noCharge) {
      if (shufflesLeft <= 0) return;
      shufflesLeft--;
    }
    shuffleBoard(board, Math.random, maxTurns);
    selected = null;
    revealed.clear();
    rerollMasks();
    ctx.sfx("meow");
    msgEl.textContent = auto
      ? cfg.autoShuffleFree
        ? "连不动啦，这一关会自动帮你重排，接着找！"
        : `连不动啦，自动洗牌一次（还剩 ${shufflesLeft} 次）`
      : `洗好啦，重新找找看（还剩 ${shufflesLeft} 次）`;
    render();
  }

  function stopAll(): void {
    intervals.forEach((t) => clearInterval(t));
    intervals.clear();
  }

  function fail(reason: string): void {
    if (levelDone) return;
    levelDone = true;
    stopAll();
    later(() => ctx.lose(reason), 300);
  }

  function succeed(): void {
    levelDone = true;
    stopAll();
    const frac = timeLeft / cfg.seconds;
    const got = frac >= 0.4 ? 3 : frac >= 0.15 ? 2 : 1;
    later(() => ctx.win(got as 1 | 2 | 3, `还剩 ${timeLeft} 秒，扫盘的效率很高！`), 350);
  }

  function onCell(r: number, c: number): void {
    if (levelDone || board.grid[r][c] < 0) return;
    const key = maskKey(r, c);
    // 戴面具的先露脸：点一下就记住它，之后再来连
    if (masked.has(key) && !revealed.has(key)) {
      revealed.add(key);
      ctx.sfx("tap");
      selected = [r, c];
      render();
      return;
    }
    if (!selected) {
      selected = [r, c];
      ctx.sfx("tap");
      render();
      return;
    }
    if (selected[0] === r && selected[1] === c) {
      selected = null;
      render();
      return;
    }
    const [sr, sc] = selected;
    if (board.grid[sr][sc] !== board.grid[r][c]) {
      selected = [r, c];
      ctx.sfx("tap");
      render();
      return;
    }
    const path = findPath(board, selected, [r, c], maxTurns);
    if (!path) {
      ctx.sfx("oops");
      msgEl.textContent = maxTurns <= 1
        ? "这两个连不上：这一关的线只准拐一次弯，先找同行同列的～"
        : "这两个连不上：线最多拐两次弯，中间还不能有别的图案～";
      selected = [r, c];
      render();
      return;
    }
    drawPath(path);
    ctx.sfx("pop");
    removePair(board, selected, [r, c]);
    selected = null;
    revealed.delete(maskKey(sr, sc));
    revealed.delete(key);
    masked.delete(maskKey(sr, sc));
    masked.delete(key);
    if (cfg.gravity !== "none") {
      applyGravity(board, cfg.gravity);
      revealed.clear();
      rerollMasks();
    }
    render();
    if (tilesLeft(board) === 0) {
      succeed();
      return;
    }
    if (!anyMove(board, maxTurns)) {
      if (cfg.autoShuffleFree || shufflesLeft > 0) doShuffle(true);
      else fail("场上没有可连的了～洗牌是应急用的，下一局多留一次就够翻盘啦！");
    }
  }

  shuffleBtn.addEventListener("click", () => {
    if (levelDone || shufflesLeft <= 0) return;
    doShuffle(false);
  });

  setup();

  return {
    destroy() {
      destroyed = true;
      levelDone = true;
      stopAll();
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
    mapHint: "剩的时间越多星星越多，先清边角效率最高！",
    grandMessage: "188 关全部通关，你的扫盘路线已经很有章法了！",
  });
}
