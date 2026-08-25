import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, LEVELS, THEME_EMOJIS, type LlkLevel } from "./levels";

export const meta = {
  id: "lianliankan",
  title: "连连看",
  emoji: "🔗",
  category: "casual" as const,
  color: "#FFEBDD",
  blurb: "99 关六大场馆！玩具会下落、鱼儿会游动，连连看新玩法！",
};

const BGS = [
  "#FFE3E3", "#FFF3CE", "#EBDDFB", "#FFE0EC", "#E0F0FF", "#FFE9F3", "#FFF6D8",
  "#E2F0FF", "#F6E3FF", "#FFEFE0", "#FFE4D0", "#FFDFE8", "#E3EBFF", "#E2F7DF",
];

type Pt = [number, number];

const CSS = `
.llk-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF2E4, #FDEBF3); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.llk-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
.llk-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #D98548; box-shadow: 0 2px 6px rgba(220,160,100,.25); font-size: 14px; }
.llk-badge.llk-hurry { color: #E8590C; animation: llkBlink 1s infinite; }
@keyframes llkBlink { 50% { opacity: .5; } }
.llk-shuffle { border: none; border-radius: 14px; padding: 6px 12px; font-weight: 700; background: #FFD9A8; color: #8A5A20; cursor: pointer; box-shadow: 0 3px 0 #EFBC82; font-size: 14px; font-family: inherit; }
.llk-shuffle:active { transform: translateY(2px); box-shadow: 0 1px 0 #EFBC82; }
.llk-shuffle:disabled { opacity: .5; }
.llk-boardbox { position: relative; }
.llk-board { display: grid; gap: 3px; }
.llk-cell { aspect-ratio: 1; border: none; border-radius: 10px; font-size: clamp(13px, 4vw, 24px); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform .12s, opacity .25s; padding: 0; box-shadow: 0 2px 4px rgba(200,140,90,.18); }
.llk-cell.llk-gone { background: transparent !important; box-shadow: none; cursor: default; }
.llk-cell.llk-sel { box-shadow: 0 0 0 3px #FF9E5E; transform: scale(1.1); }
.llk-cell:active { transform: scale(.9); }
.llk-line { position: absolute; inset: 0; pointer-events: none; }
.llk-msg { text-align: center; min-height: 22px; color: #D98548; font-weight: 700; margin-top: 8px; font-size: 15px; }
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: LlkLevel = LEVELS[ctx.level];
  const EMOJIS = THEME_EMOJIS[cfg.theme];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  let destroyed = false;
  let levelDone = false;
  let selected: Pt | null = null;
  let timeLeft = cfg.seconds;
  let shufflesLeft = cfg.shuffles;
  const R = cfg.rows + 2;
  const C = cfg.cols + 2;
  const grid: number[][] = [];
  const cells: HTMLButtonElement[][] = [];

  const wrap = document.createElement("div");
  wrap.className = "llk-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="llk-top">
      <span class="llk-badge llk-left">🧸 剩 0 对</span>
      <span class="llk-badge llk-time">⏰ 0 秒</span>
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

  function setup(): void {
    for (let r = 0; r < R; r++) grid.push(new Array(C).fill(-1));
    const total = cfg.rows * cfg.cols;
    const bag: number[] = [];
    let k = 0;
    while (bag.length < total) {
      bag.push(k % cfg.kinds, k % cfg.kinds);
      k++;
    }
    bag.length = total;
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    let bi = 0;
    for (let r = 1; r <= cfg.rows; r++) for (let col = 1; col <= cfg.cols; col++) grid[r][col] = bag[bi++];

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

    if (!anyMoveExists()) doShuffle(true, true);
    render();
    msgEl.textContent =
      cfg.gravity === "down"
        ? "小心！消掉一对后，上面的图案会掉下来！"
        : cfg.gravity === "left"
          ? "小心！消掉一对后，右边的图案会向左滑！"
          : `${cfg.rows}×${cfg.cols} 棋盘，${cfg.seconds} 秒内全部连完！`;

    const clock = setInterval(() => {
      if (levelDone || destroyed) return;
      timeLeft--;
      renderTop();
      if (timeLeft <= 0) fail("时间到啦，下次先连容易看到的那几对！");
    }, 1000);
    intervals.add(clock);
  }

  function pairsLeft(): number {
    let n = 0;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (grid[r][c] >= 0) n++;
    return n / 2;
  }

  function renderTop(): void {
    leftEl.textContent = `🧸 剩 ${pairsLeft()} 对`;
    timeEl.textContent = `⏰ ${timeLeft} 秒`;
    timeEl.classList.toggle("llk-hurry", timeLeft <= 15);
    shuffleBtn.textContent = `🔀 洗牌 x${shufflesLeft}`;
    shuffleBtn.disabled = shufflesLeft <= 0 || levelDone;
  }

  function render(): void {
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const el = cells[r][c];
        const v = grid[r][c];
        if (v < 0) {
          el.classList.add("llk-gone");
          el.classList.remove("llk-sel");
          el.textContent = "";
          el.style.background = "";
        } else {
          el.classList.remove("llk-gone");
          el.textContent = EMOJIS[v];
          el.style.background = BGS[v % BGS.length];
          el.classList.toggle("llk-sel", !!selected && selected[0] === r && selected[1] === c);
        }
      }
    }
    renderTop();
  }

  function isEmpty(r: number, c: number): boolean {
    return grid[r][c] < 0;
  }

  function clearLine(a: Pt, b: Pt): boolean {
    if (a[0] === b[0]) {
      const [lo, hi] = a[1] < b[1] ? [a[1], b[1]] : [b[1], a[1]];
      for (let c = lo + 1; c < hi; c++) if (!isEmpty(a[0], c)) return false;
      return true;
    }
    if (a[1] === b[1]) {
      const [lo, hi] = a[0] < b[0] ? [a[0], b[0]] : [b[0], a[0]];
      for (let r = lo + 1; r < hi; r++) if (!isEmpty(r, a[1])) return false;
      return true;
    }
    return false;
  }

  function findPath(a: Pt, b: Pt): Pt[] | null {
    if ((a[0] === b[0] || a[1] === b[1]) && clearLine(a, b)) return [a, b];
    const c1: Pt = [a[0], b[1]];
    if (isEmpty(c1[0], c1[1]) && clearLine(a, c1) && clearLine(c1, b)) return [a, c1, b];
    const c2: Pt = [b[0], a[1]];
    if (isEmpty(c2[0], c2[1]) && clearLine(a, c2) && clearLine(c2, b)) return [a, c2, b];
    for (let r = 0; r < R; r++) {
      if (r === a[0] || r === b[0]) continue;
      const p1: Pt = [r, a[1]];
      const p2: Pt = [r, b[1]];
      if (isEmpty(p1[0], p1[1]) && isEmpty(p2[0], p2[1]) &&
          clearLine(a, p1) && clearLine(p1, p2) && clearLine(p2, b)) {
        return [a, p1, p2, b];
      }
    }
    for (let c = 0; c < C; c++) {
      if (c === a[1] || c === b[1]) continue;
      const p1: Pt = [a[0], c];
      const p2: Pt = [b[0], c];
      if (isEmpty(p1[0], p1[1]) && isEmpty(p2[0], p2[1]) &&
          clearLine(a, p1) && clearLine(p1, p2) && clearLine(p2, b)) {
        return [a, p1, p2, b];
      }
    }
    return null;
  }

  function anyMoveExists(): boolean {
    const tiles: Pt[] = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (grid[r][c] >= 0) tiles.push([r, c]);
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        const [r1, c1] = tiles[i];
        const [r2, c2] = tiles[j];
        if (grid[r1][c1] !== grid[r2][c2]) continue;
        if (findPath(tiles[i], tiles[j])) return true;
      }
    }
    return false;
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

  /** 重力：down = 内圈图案往下落；left = 内圈图案向左滑 */
  function applyGravity(): void {
    if (cfg.gravity === "down") {
      for (let c = 1; c <= cfg.cols; c++) {
        const vals: number[] = [];
        for (let r = cfg.rows; r >= 1; r--) if (grid[r][c] >= 0) vals.push(grid[r][c]);
        for (let r = cfg.rows, i = 0; r >= 1; r--, i++) grid[r][c] = i < vals.length ? vals[i] : -1;
      }
    } else if (cfg.gravity === "left") {
      for (let r = 1; r <= cfg.rows; r++) {
        const vals: number[] = [];
        for (let c = 1; c <= cfg.cols; c++) if (grid[r][c] >= 0) vals.push(grid[r][c]);
        for (let c = 1, i = 0; c <= cfg.cols; c++, i++) grid[r][c] = i < vals.length ? vals[i] : -1;
      }
    }
  }

  function doShuffle(auto: boolean, free = false): void {
    if (!free) {
      if (shufflesLeft <= 0) return;
      shufflesLeft--;
    }
    const tiles: Pt[] = [];
    const values: number[] = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (grid[r][c] >= 0) { tiles.push([r, c]); values.push(grid[r][c]); }
    }
    let guard = 0;
    do {
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
      }
      tiles.forEach(([r, c], i) => { grid[r][c] = values[i]; });
      guard++;
    } while (!anyMoveExists() && guard < 40);
    selected = null;
    ctx.sfx("meow");
    msgEl.textContent = auto
      ? `连不动啦，自动洗牌一次（还剩 ${shufflesLeft} 次）`
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
    later(() => ctx.win(got as 1 | 2 | 3, `还剩 ${timeLeft} 秒，眼睛真尖！`), 350);
  }

  function onCell(r: number, c: number): void {
    if (levelDone || grid[r][c] < 0) return;
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
    if (grid[sr][sc] !== grid[r][c]) {
      selected = [r, c];
      ctx.sfx("tap");
      render();
      return;
    }
    const path = findPath(selected, [r, c]);
    if (!path) {
      ctx.sfx("oops");
      msgEl.textContent = "这两个连不到一起，线最多拐两次弯哦～";
      selected = [r, c];
      render();
      return;
    }
    drawPath(path);
    ctx.sfx("pop");
    grid[sr][sc] = -1;
    grid[r][c] = -1;
    selected = null;
    applyGravity();
    render();
    if (pairsLeft() === 0) {
      succeed();
      return;
    }
    if (!anyMoveExists()) {
      if (shufflesLeft > 0) doShuffle(true);
      else fail("连不动了，洗牌次数也用完了，再来一局吧！");
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
    mapHint: "剩的时间越多星星越多，六大场馆等你逛！",
    grandMessage: "99 关连连看全部通关，火眼金睛就是你！",
  });
}
