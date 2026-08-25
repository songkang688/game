export const meta = {
  id: "lianliankan",
  title: "连连看",
  emoji: "🔗",
  category: "casual" as const,
  color: "#FFEBDD",
  blurb: "找到两个一样的小图案，用不超过两个拐弯的线连起来！",
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

// 内圈 6x6 放图案，外圈一圈空位留给连线拐弯
const IN = 6;
const R = IN + 2;
const C = IN + 2;
const EMOJIS = ["🍎", "🍌", "🍇", "🐱", "🐶", "🌸", "⭐", "🚗", "🎈"];
const BGS = ["#FFE3E3", "#FFF3CE", "#EBDDFB", "#FFE0EC", "#E0F0FF", "#FFE9F3", "#FFF6D8", "#E2F0FF", "#F6E3FF"];

type Pt = [number, number];

export function mount(api: GameApi): { destroy: () => void } {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let finished = false;
  let selected: Pt | null = null;
  let removedPairs = 0;
  const startTime = Date.now();

  // grid[r][c]: -1 表示空，否则是图案编号
  const grid: number[][] = [];
  for (let r = 0; r < R; r++) grid.push(new Array(C).fill(-1));

  const wrap = document.createElement("div");
  wrap.className = "llk-wrap";
  wrap.innerHTML = `
    <style>
      .llk-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF2E4, #FDEBF3); border-radius: 20px; padding: 12px; max-width: 420px; margin: 0 auto; user-select: none; }
      .llk-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px; }
      .llk-badge { background: #fff; border-radius: 14px; padding: 6px 12px; font-weight: 700; color: #D98548; box-shadow: 0 2px 6px rgba(220,160,100,.25); font-size: 15px; }
      .llk-shuffle { border: none; border-radius: 14px; padding: 6px 12px; font-weight: 700; background: #FFD9A8; color: #8A5A20; cursor: pointer; box-shadow: 0 3px 0 #EFBC82; font-size: 14px; }
      .llk-shuffle:active { transform: translateY(2px); box-shadow: 0 1px 0 #EFBC82; }
      .llk-boardbox { position: relative; }
      .llk-board { display: grid; grid-template-columns: repeat(${C}, 1fr); gap: 3px; }
      .llk-cell { aspect-ratio: 1; border: none; border-radius: 10px; font-size: clamp(15px, 4.6vw, 26px); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform .12s, opacity .25s; padding: 0; box-shadow: 0 2px 4px rgba(200,140,90,.18); }
      .llk-cell.llk-gone { background: transparent !important; box-shadow: none; cursor: default; }
      .llk-cell.llk-sel { box-shadow: 0 0 0 3px #FF9E5E; transform: scale(1.1); }
      .llk-cell:active { transform: scale(.9); }
      .llk-line { position: absolute; inset: 0; pointer-events: none; }
      .llk-msg { text-align: center; min-height: 22px; color: #D98548; font-weight: 700; margin-top: 8px; font-size: 15px; }
    </style>
    <div class="llk-top">
      <span class="llk-badge llk-left">🧸 剩 ${IN * IN / 2} 对</span>
      <button class="llk-shuffle" type="button">🔀 重新排一排</button>
    </div>
    <div class="llk-boardbox">
      <div class="llk-board"></div>
      <canvas class="llk-line"></canvas>
    </div>
    <div class="llk-msg">点两个一样的图案，线拐弯不超过两次就能消掉！</div>
  `;
  api.root.appendChild(wrap);

  const boardEl = wrap.querySelector(".llk-board") as HTMLElement;
  const leftEl = wrap.querySelector(".llk-left") as HTMLElement;
  const msgEl = wrap.querySelector(".llk-msg") as HTMLElement;
  const lineCanvas = wrap.querySelector(".llk-line") as HTMLCanvasElement;
  const shuffleBtn = wrap.querySelector(".llk-shuffle") as HTMLButtonElement;

  // 初始摆放：9 种图案各 4 个
  const bag: number[] = [];
  for (let e = 0; e < EMOJIS.length; e++) for (let k = 0; k < 4; k++) bag.push(e);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  let bi = 0;
  for (let r = 1; r <= IN; r++) for (let c = 1; c <= IN; c++) grid[r][c] = bag[bi++];

  const cells: HTMLButtonElement[][] = [];
  for (let r = 0; r < R; r++) {
    const row: HTMLButtonElement[] = [];
    for (let c = 0; c < C; c++) {
      const btn = document.createElement("button");
      btn.className = "llk-cell";
      btn.type = "button";
      const rr = r, cc = c;
      btn.addEventListener("click", () => onCell(rr, cc));
      boardEl.appendChild(btn);
      row.push(btn);
    }
    cells.push(row);
  }

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!finished) fn();
    }, ms);
    timeouts.add(t);
  }

  function pairsLeft(): number {
    let n = 0;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (grid[r][c] >= 0) n++;
    return n / 2;
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
    leftEl.textContent = `🧸 剩 ${pairsLeft()} 对`;
  }

  function isEmpty(r: number, c: number): boolean {
    return grid[r][c] < 0;
  }

  // 两点间直线（不含端点）是否全空，需在同一行或同一列
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

  // 返回连线经过的拐点（含起终点），连不上返回 null
  function findPath(a: Pt, b: Pt): Pt[] | null {
    // 0 个拐弯
    if ((a[0] === b[0] || a[1] === b[1]) && clearLine(a, b)) return [a, b];
    // 1 个拐弯
    const c1: Pt = [a[0], b[1]];
    if (isEmpty(c1[0], c1[1]) && clearLine(a, c1) && clearLine(c1, b)) return [a, c1, b];
    const c2: Pt = [b[0], a[1]];
    if (isEmpty(c2[0], c2[1]) && clearLine(a, c2) && clearLine(c2, b)) return [a, c2, b];
    // 2 个拐弯：沿某一行或某一列走中段
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

  function doShuffle(auto: boolean): void {
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
    } while (!anyMoveExists() && guard < 30);
    selected = null;
    api.play("meow");
    msgEl.textContent = auto ? "连不动啦，小图案们自动换了位置！" : "洗好啦，重新找找看！";
    render();
  }

  function winCheck(): void {
    if (pairsLeft() > 0) {
      if (!anyMoveExists()) later(() => doShuffle(true), 400);
      return;
    }
    finished = true;
    const secs = Math.round((Date.now() - startTime) / 1000);
    const stars: 1 | 2 | 3 = secs <= 100 ? 3 : secs <= 170 ? 2 : 1;
    api.play("win");
    msgEl.textContent = "🎉 全部连完，眼力真好！";
    api.onWin(stars, `用了 ${secs} 秒连完 ${IN * IN / 2} 对图案！`);
  }

  function onCell(r: number, c: number): void {
    if (finished || grid[r][c] < 0) return;
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
    if (removedPairs % 6 === 0) {
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
    if (!finished) doShuffle(false);
  });

  render();

  return {
    destroy() {
      finished = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    },
  };
}
