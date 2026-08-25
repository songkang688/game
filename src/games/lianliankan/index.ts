export const meta = {
  id: "lianliankan",
  title: "连连看",
  emoji: "🔗",
  category: "casual" as const,
  color: "#FFEBDD",
  blurb: "六关连连看！棋盘越来越大，洗牌机会有限，倒计时滴滴答！",
};

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

interface GameApi {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
}

const EMOJIS = ["🍎", "🍌", "🍇", "🐱", "🐶", "🌸", "⭐", "🚗", "🎈", "🐰", "🦊", "🍓", "🌙", "🐸"];
const BGS = [
  "#FFE3E3", "#FFF3CE", "#EBDDFB", "#FFE0EC", "#E0F0FF", "#FFE9F3", "#FFF6D8",
  "#E2F0FF", "#F6E3FF", "#FFEFE0", "#FFE4D0", "#FFDFE8", "#E3EBFF", "#E2F7DF",
];

interface LevelConfig {
  rows: number;
  cols: number;
  kinds: number;
  seconds: number;
  shuffles: number;
}

const LEVELS: LevelConfig[] = [
  { rows: 4, cols: 4, kinds: 6, seconds: 90, shuffles: 3 },
  { rows: 4, cols: 6, kinds: 8, seconds: 120, shuffles: 3 },
  { rows: 5, cols: 6, kinds: 9, seconds: 150, shuffles: 3 },
  { rows: 6, cols: 6, kinds: 10, seconds: 180, shuffles: 3 },
  { rows: 6, cols: 8, kinds: 12, seconds: 210, shuffles: 3 },
  { rows: 7, cols: 8, kinds: 14, seconds: 240, shuffles: 3 },
];

type Pt = [number, number];

export function mount(api: GameApi): { destroy: () => void } {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const intervals = new Set<ReturnType<typeof setInterval>>();
  let destroyed = false;
  let levelDone = false;
  let selected: Pt | null = null;
  let removedPairs = 0;

  let level = 0;
  let retries = 0;
  let timeLeft = 0;
  let shufflesLeft = 0;
  let R = 0;
  let C = 0;
  let grid: number[][] = [];
  let cells: HTMLButtonElement[][] = [];

  const wrap = document.createElement("div");
  wrap.className = "llk-wrap";
  wrap.innerHTML = `
    <style>
      .llk-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF2E4, #FDEBF3); border-radius: 20px; padding: 12px; max-width: 440px; margin: 0 auto; user-select: none; position: relative; }
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
      .llk-overlay { position: absolute; inset: 0; background: rgba(255,244,232,.96); border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; z-index: 5; text-align: center; padding: 16px; }
      .llk-ov-big { font-size: 52px; }
      .llk-ov-title { font-size: 24px; font-weight: 900; color: #D98548; }
      .llk-ov-sub { font-size: 16px; font-weight: 700; color: #E0A070; line-height: 1.6; }
      .llk-ov-btn { border: none; border-radius: 20px; padding: 14px 40px; font-size: 20px; font-weight: 900; color: #fff; background: linear-gradient(180deg,#FFB275,#F08A3E); cursor: pointer; box-shadow: 0 5px 0 #C96A22; font-family: inherit; }
      .llk-ov-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #C96A22; }
    </style>
    <div class="llk-top">
      <span class="llk-badge llk-level">🚩 第 1 关</span>
      <span class="llk-badge llk-left">🧸 剩 0 对</span>
      <span class="llk-badge llk-time">⏰ 0 秒</span>
      <button class="llk-shuffle" type="button">🔀 洗牌 x3</button>
    </div>
    <div class="llk-boardbox">
      <div class="llk-board"></div>
      <canvas class="llk-line"></canvas>
    </div>
    <div class="llk-msg">点两个一样的图案，线拐弯不超过两次就能消掉！</div>
  `;
  api.root.appendChild(wrap);

  const boardEl = wrap.querySelector(".llk-board") as HTMLElement;
  const levelEl = wrap.querySelector(".llk-level") as HTMLElement;
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

  function cfg(): LevelConfig {
    return LEVELS[level];
  }

  function stopClock(): void {
    intervals.forEach((t) => clearInterval(t));
    intervals.clear();
  }

  function setupLevel(): void {
    const c = cfg();
    levelDone = false;
    selected = null;
    removedPairs = 0;
    timeLeft = c.seconds;
    shufflesLeft = c.shuffles;
    R = c.rows + 2;
    C = c.cols + 2;

    grid = [];
    for (let r = 0; r < R; r++) grid.push(new Array(C).fill(-1));

    // 摆放：kinds 种图案两两成对填满内圈
    const total = c.rows * c.cols;
    const bag: number[] = [];
    let k = 0;
    while (bag.length < total) {
      bag.push(k % c.kinds, k % c.kinds);
      k++;
    }
    bag.length = total;
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    let bi = 0;
    for (let r = 1; r <= c.rows; r++) for (let col = 1; col <= c.cols; col++) grid[r][col] = bag[bi++];

    boardEl.style.gridTemplateColumns = `repeat(${C}, 1fr)`;
    boardEl.innerHTML = "";
    cells = [];
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
    msgEl.textContent = `第 ${level + 1} 关：${c.rows}×${c.cols} 棋盘，${c.seconds} 秒内全部连完！`;

    stopClock();
    const clock = setInterval(() => {
      if (levelDone) return;
      timeLeft--;
      renderTop();
      if (timeLeft <= 0) levelFail("时间到啦");
    }, 1000);
    intervals.add(clock);
  }

  function pairsLeft(): number {
    let n = 0;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (grid[r][c] >= 0) n++;
    return n / 2;
  }

  function renderTop(): void {
    levelEl.textContent = `🚩 第 ${level + 1} 关`;
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
          el.style.background = BGS[v];
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
    const ctx = lineCanvas.getContext("2d");
    if (!ctx) return;
    const cw = rect.width / C;
    const ch = rect.height / R;
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#FF8A4C";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    path.forEach(([r, c], i) => {
      const x = c * cw + cw / 2;
      const y = r * ch + ch / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    later(() => {
      const ctx2 = lineCanvas.getContext("2d");
      if (ctx2) ctx2.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
    }, 380);
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
    api.play("meow");
    msgEl.textContent = auto
      ? `连不动啦，自动洗牌一次（还剩 ${shufflesLeft} 次）`
      : `洗好啦，重新找找看（还剩 ${shufflesLeft} 次）`;
    render();
  }

  function showOverlay(kind: "next" | "retry", reason?: string): void {
    stopClock();
    const ov = document.createElement("div");
    ov.className = "llk-overlay";
    if (kind === "next") {
      const c = LEVELS[level + 1];
      ov.innerHTML = `
        <div class="llk-ov-big">🎉</div>
        <div class="llk-ov-title">第 ${level + 1} 关全部连完！</div>
        <div class="llk-ov-sub">下一关是 ${c.rows}×${c.cols} 大棋盘，加油！</div>
        <button class="llk-ov-btn" type="button">下一关 ▶</button>`;
      (ov.querySelector(".llk-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("jump");
        ov.remove();
        level++;
        setupLevel();
      });
    } else {
      ov.innerHTML = `
        <div class="llk-ov-big">🌧️</div>
        <div class="llk-ov-title">${reason || "这一关没过"}</div>
        <div class="llk-ov-sub">还剩 ${pairsLeft()} 对，本关再来一次！</div>
        <button class="llk-ov-btn" type="button">🔁 重试本关</button>`;
      (ov.querySelector(".llk-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("tap");
        ov.remove();
        retries++;
        setupLevel();
      });
    }
    wrap.appendChild(ov);
  }

  function levelFail(reason: string): void {
    if (levelDone) return;
    levelDone = true;
    api.play("oops");
    msgEl.textContent = reason;
    later(() => showOverlay("retry", reason), 350);
  }

  function winCheck(): void {
    if (pairsLeft() > 0) {
      if (!anyMoveExists()) {
        if (shufflesLeft > 0) {
          later(() => { if (!levelDone) doShuffle(true); }, 400);
        } else {
          levelFail("洗牌次数用完，连不动啦");
        }
      }
      return;
    }
    levelDone = true;
    api.play("win");
    if (level >= LEVELS.length - 1) {
      msgEl.textContent = "🎉 六关连连看全部通关！";
      const stars: 1 | 2 | 3 = retries === 0 ? 3 : retries <= 2 ? 2 : 1;
      later(() => api.onWin(stars, `连完了全部六关大棋盘，眼力冠军！`), 400);
    } else {
      msgEl.textContent = "🎉 全部连完！";
      later(() => showOverlay("next"), 400);
    }
  }

  function onCell(r: number, c: number): void {
    if (levelDone || grid[r][c] < 0) return;
    if (!selected) {
      selected = [r, c];
      api.play("tap");
      render();
      return;
    }
    const [sr, sc] = selected;
    if (sr === r && sc === c) {
      selected = null;
      render();
      return;
    }
    if (grid[sr][sc] !== grid[r][c]) {
      api.play("oops");
      msgEl.textContent = "图案不一样哦，要找两个相同的！";
      selected = [r, c];
      render();
      return;
    }
    const path = findPath([sr, sc], [r, c]);
    if (!path) {
      api.play("oops");
      msgEl.textContent = "线拐的弯太多啦，先消旁边的试试！";
      selected = [r, c];
      render();
      return;
    }
    drawPath(path);
    api.play("pop");
    removedPairs++;
    if (removedPairs % 8 === 0) {
      api.addStars(1);
      msgEl.textContent = "连得又快又准，奖励一颗小星星！";
    } else {
      msgEl.textContent = `叮！${EMOJIS[grid[r][c]]} 成功牵手回家～`;
    }
    grid[sr][sc] = -1;
    grid[r][c] = -1;
    selected = null;
    render();
    winCheck();
  }

  shuffleBtn.addEventListener("click", () => {
    if (!levelDone && shufflesLeft > 0) doShuffle(false);
  });

  setupLevel();

  return {
    destroy() {
      destroyed = true;
      levelDone = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      stopClock();
      wrap.remove();
    },
  };
}
