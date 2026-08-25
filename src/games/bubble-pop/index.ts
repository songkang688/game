export const meta = {
  id: "bubble-pop",
  title: "泡泡噗噗",
  emoji: "🫧",
  category: "casual" as const,
  color: "#DCF3FF",
  blurb: "五关泡泡挑战！彩虹泡泡一点，同色泡泡全消光！",
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

const COLS = 8;
const RAINBOW = 99;

const COLORS = [
  { bg: "radial-gradient(circle at 35% 30%, #FFE1EE, #FF9EC8)", ring: "#FF9EC8" },
  { bg: "radial-gradient(circle at 35% 30%, #DFF3FF, #8FCBFF)", ring: "#8FCBFF" },
  { bg: "radial-gradient(circle at 35% 30%, #E6FBDF, #9FE08D)", ring: "#9FE08D" },
  { bg: "radial-gradient(circle at 35% 30%, #FFF6DA, #FFD26E)", ring: "#FFD26E" },
  { bg: "radial-gradient(circle at 35% 30%, #F0E2FF, #C9A0F0)", ring: "#C9A0F0" },
];

interface LevelConfig {
  rows: number;
  colors: number;
  /** 结束时最多允许剩下多少个泡泡 */
  maxLeft: number;
  rainbow: boolean;
}

const LEVELS: LevelConfig[] = [
  { rows: 8, colors: 3, maxLeft: 8, rainbow: false },
  { rows: 9, colors: 4, maxLeft: 12, rainbow: false },
  { rows: 9, colors: 4, maxLeft: 8, rainbow: true },
  { rows: 10, colors: 5, maxLeft: 16, rainbow: true },
  { rows: 10, colors: 5, maxLeft: 12, rainbow: true },
];

export function mount(api: GameApi): { destroy: () => void } {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let levelDone = false;

  let level = 0;
  let retries = 0;
  let score = 0;
  let rows = LEVELS[0].rows;
  let grid: number[][] = [];
  let cells: HTMLButtonElement[] = [];

  const wrap = document.createElement("div");
  wrap.className = "bp-wrap";
  wrap.innerHTML = `
    <style>
      .bp-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E4F6FF, #F2EDFF); border-radius: 20px; padding: 14px; max-width: 400px; margin: 0 auto; user-select: none; position: relative; }
      .bp-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
      .bp-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #4FA3C7; box-shadow: 0 2px 6px rgba(100,170,210,.25); font-size: 14px; }
      .bp-board { display: grid; grid-template-columns: repeat(${COLS}, 1fr); gap: 4px; }
      .bp-cell { aspect-ratio: 1; border: none; border-radius: 50%; cursor: pointer; transition: transform .12s, opacity .2s; padding: 0; font-size: clamp(12px, 3.6vw, 20px); display: flex; align-items: center; justify-content: center; }
      .bp-cell:active { transform: scale(.85); }
      .bp-cell.bp-empty { background: transparent !important; box-shadow: none !important; cursor: default; }
      .bp-cell.bp-rainbow { animation: bpSpin 2.5s linear infinite; }
      @keyframes bpSpin { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
      .bp-msg { text-align: center; min-height: 22px; color: #4FA3C7; font-weight: 700; margin-top: 10px; font-size: 15px; }
      .bp-overlay { position: absolute; inset: 0; background: rgba(235,248,255,.96); border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; z-index: 5; text-align: center; padding: 16px; }
      .bp-ov-big { font-size: 52px; }
      .bp-ov-title { font-size: 24px; font-weight: 900; color: #4FA3C7; }
      .bp-ov-sub { font-size: 16px; font-weight: 700; color: #6FB5D4; line-height: 1.6; }
      .bp-ov-btn { border: none; border-radius: 20px; padding: 14px 40px; font-size: 20px; font-weight: 900; color: #fff; background: linear-gradient(180deg,#79C4E8,#4FA3C7); cursor: pointer; box-shadow: 0 5px 0 #3781A3; font-family: inherit; }
      .bp-ov-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #3781A3; }
    </style>
    <div class="bp-top">
      <span class="bp-badge bp-level">🚩 第 1 关</span>
      <span class="bp-badge bp-score">✨ 0 分</span>
      <span class="bp-badge bp-left">🫧 剩 0 个</span>
    </div>
    <div class="bp-board"></div>
    <div class="bp-msg">找到挨在一起的同色泡泡，一起点破它们！</div>
  `;
  api.root.appendChild(wrap);

  const boardEl = wrap.querySelector(".bp-board") as HTMLElement;
  const levelEl = wrap.querySelector(".bp-level") as HTMLElement;
  const scoreEl = wrap.querySelector(".bp-score") as HTMLElement;
  const leftEl = wrap.querySelector(".bp-left") as HTMLElement;
  const msgEl = wrap.querySelector(".bp-msg") as HTMLElement;

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

  function setupLevel(): void {
    const c = cfg();
    levelDone = false;
    rows = c.rows;
    grid = [];
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let col = 0; col < COLS; col++) row.push(Math.floor(Math.random() * c.colors));
      grid.push(row);
    }
    if (c.rainbow) {
      const rr = Math.floor(Math.random() * rows);
      const rc = Math.floor(Math.random() * COLS);
      grid[rr][rc] = RAINBOW;
    }
    boardEl.innerHTML = "";
    cells = [];
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < COLS; col++) {
        const btn = document.createElement("button");
        btn.className = "bp-cell";
        btn.type = "button";
        const rr = r, cc = col;
        btn.addEventListener("click", () => onCell(rr, cc));
        boardEl.appendChild(btn);
        cells.push(btn);
      }
    }
    render();
    msgEl.textContent = c.rainbow
      ? `目标：剩下不超过 ${c.maxLeft} 个！🌈 彩虹泡泡能消掉最多的那种颜色！`
      : `目标：把泡泡消到只剩 ${c.maxLeft} 个以内！`;
  }

  function countLeft(): number {
    let n = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] >= 0) n++;
    return n;
  }

  function render(): void {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const el = cells[r * COLS + c];
        const v = grid[r][c];
        el.classList.remove("bp-rainbow");
        el.textContent = "";
        if (v < 0) {
          el.classList.add("bp-empty");
          el.style.background = "";
          el.style.boxShadow = "";
        } else if (v === RAINBOW) {
          el.classList.remove("bp-empty");
          el.classList.add("bp-rainbow");
          el.style.background = "conic-gradient(#FF9EC8, #FFD26E, #9FE08D, #8FCBFF, #C9A0F0, #FF9EC8)";
          el.style.boxShadow = "0 2px 8px rgba(150,120,220,.5)";
          el.textContent = "🌈";
        } else {
          el.classList.remove("bp-empty");
          el.style.background = COLORS[v].bg;
          el.style.boxShadow = `0 2px 5px ${COLORS[v].ring}66`;
        }
      }
    }
    levelEl.textContent = `🚩 第 ${level + 1} 关`;
    scoreEl.textContent = `✨ ${score} 分`;
    leftEl.textContent = `🫧 剩 ${countLeft()} 个（目标 ≤${cfg().maxLeft}）`;
  }

  function group(r: number, c: number): Array<[number, number]> {
    const color = grid[r][c];
    if (color < 0 || color === RAINBOW) return [];
    const seen = new Set<number>();
    const stack: Array<[number, number]> = [[r, c]];
    const out: Array<[number, number]> = [];
    while (stack.length) {
      const [cr, cc] = stack.pop() as [number, number];
      const key = cr * COLS + cc;
      if (seen.has(key)) continue;
      seen.add(key);
      if (cr < 0 || cr >= rows || cc < 0 || cc >= COLS || grid[cr][cc] !== color) continue;
      out.push([cr, cc]);
      stack.push([cr + 1, cc], [cr - 1, cc], [cr, cc + 1], [cr, cc - 1]);
    }
    return out;
  }

  function collapse(): void {
    for (let c = 0; c < COLS; c++) {
      let write = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        if (grid[r][c] >= 0) {
          grid[write][c] = grid[r][c];
          if (write !== r) grid[r][c] = -1;
          write--;
        }
      }
      for (let r = write; r >= 0; r--) grid[r][c] = -1;
    }
    let writeCol = 0;
    for (let c = 0; c < COLS; c++) {
      const hasAny = grid.some((row) => row[c] >= 0);
      if (hasAny) {
        if (writeCol !== c) {
          for (let r = 0; r < rows; r++) {
            grid[r][writeCol] = grid[r][c];
            grid[r][c] = -1;
          }
        }
        writeCol++;
      }
    }
  }

  function hasMoves(): boolean {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        if (v < 0) continue;
        if (v === RAINBOW) return true;
        if (r + 1 < rows && grid[r + 1][c] === v) return true;
        if (c + 1 < COLS && grid[r][c + 1] === v) return true;
      }
    }
    return false;
  }

  function showOverlay(kind: "next" | "retry", left: number): void {
    const ov = document.createElement("div");
    ov.className = "bp-overlay";
    if (kind === "next") {
      ov.innerHTML = `
        <div class="bp-ov-big">🎉</div>
        <div class="bp-ov-title">第 ${level + 1} 关过啦！</div>
        <div class="bp-ov-sub">只剩 ${left} 个泡泡，下一关颜色更多哦～</div>
        <button class="bp-ov-btn" type="button">下一关 ▶</button>`;
      (ov.querySelector(".bp-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("jump");
        ov.remove();
        level++;
        setupLevel();
      });
    } else {
      ov.innerHTML = `
        <div class="bp-ov-big">🌧️</div>
        <div class="bp-ov-title">还剩 ${left} 个泡泡</div>
        <div class="bp-ov-sub">先找大团的同色泡泡下手，再来一次！</div>
        <button class="bp-ov-btn" type="button">🔁 重试本关</button>`;
      (ov.querySelector(".bp-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("tap");
        ov.remove();
        retries++;
        setupLevel();
      });
    }
    wrap.appendChild(ov);
  }

  function finishBoard(): void {
    levelDone = true;
    const left = countLeft();
    if (left <= cfg().maxLeft) {
      api.play("win");
      if (left === 0) {
        api.addStars(1);
        msgEl.textContent = "🎉 全部清空，奖励一颗小星星！";
      } else {
        msgEl.textContent = "🎉 达到目标啦！";
      }
      if (level >= LEVELS.length - 1) {
        const stars: 1 | 2 | 3 = retries === 0 ? 3 : retries <= 2 ? 2 : 1;
        later(() => api.onWin(stars, `五关泡泡全部搞定，共得 ${score} 分！`), 400);
      } else {
        later(() => showOverlay("next", left), 400);
      }
    } else {
      api.play("oops");
      later(() => showOverlay("retry", left), 400);
    }
  }

  function popRainbow(r: number, c: number): void {
    // 统计剩余最多的颜色，全部消掉
    const counts = new Map<number, number>();
    for (let rr = 0; rr < rows; rr++) {
      for (let cc = 0; cc < COLS; cc++) {
        const v = grid[rr][cc];
        if (v >= 0 && v !== RAINBOW) counts.set(v, (counts.get(v) || 0) + 1);
      }
    }
    let bestColor = -1, bestCount = 0;
    counts.forEach((n, color) => { if (n > bestCount) { bestCount = n; bestColor = color; } });
    grid[r][c] = -1;
    let popped = 0;
    if (bestColor >= 0) {
      for (let rr = 0; rr < rows; rr++) {
        for (let cc = 0; cc < COLS; cc++) {
          if (grid[rr][cc] === bestColor) { grid[rr][cc] = -1; popped++; }
        }
      }
    }
    api.play("coin");
    score += popped * 3;
    msgEl.textContent = `🌈 彩虹魔法！一口气消掉 ${popped} 个泡泡！`;
    collapse();
    render();
    if (!hasMoves()) finishBoard();
  }

  function onCell(r: number, c: number): void {
    if (levelDone || grid[r][c] < 0) return;
    if (grid[r][c] === RAINBOW) {
      popRainbow(r, c);
      return;
    }
    const g = group(r, c);
    if (g.length < 2) {
      api.play("oops");
      msgEl.textContent = "这个泡泡孤零零的，点不破哦～";
      return;
    }
    api.play("pop");
    score += g.length * (g.length - 1);
    if (g.length >= 8) msgEl.textContent = `哇！一口气消掉 ${g.length} 个泡泡！`;
    else msgEl.textContent = "噗噗噗～泡泡破掉啦！";
    for (const [gr, gc] of g) grid[gr][gc] = -1;
    collapse();
    render();
    if (!hasMoves()) finishBoard();
  }

  setupLevel();

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
