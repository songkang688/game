export const meta = {
  id: "bubble-pop",
  title: "泡泡噗噗",
  emoji: "🫧",
  category: "casual" as const,
  color: "#DCF3FF",
  blurb: "点两个以上连在一起的同色泡泡，噗噗噗全消掉！",
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
const ROWS = 9;
const COLORS = [
  { bg: "radial-gradient(circle at 35% 30%, #FFE1EE, #FF9EC8)", ring: "#FF9EC8" },
  { bg: "radial-gradient(circle at 35% 30%, #DFF3FF, #8FCBFF)", ring: "#8FCBFF" },
  { bg: "radial-gradient(circle at 35% 30%, #E6FBDF, #9FE08D)", ring: "#9FE08D" },
  { bg: "radial-gradient(circle at 35% 30%, #FFF6DA, #FFD26E)", ring: "#FFD26E" },
];

export function mount(api: GameApi): { destroy: () => void } {
  let finished = false;
  let score = 0;
  // grid[r][c]: -1 空，否则颜色编号
  const grid: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < COLS; c++) row.push(Math.floor(Math.random() * COLORS.length));
    grid.push(row);
  }

  const wrap = document.createElement("div");
  wrap.className = "bp-wrap";
  wrap.innerHTML = `
    <style>
      .bp-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #E4F6FF, #F2EDFF); border-radius: 20px; padding: 14px; max-width: 400px; margin: 0 auto; user-select: none; }
      .bp-top { display: flex; justify-content: space-between; margin-bottom: 10px; }
      .bp-badge { background: #fff; border-radius: 14px; padding: 6px 14px; font-weight: 700; color: #4FA3C7; box-shadow: 0 2px 6px rgba(100,170,210,.25); font-size: 15px; }
      .bp-board { display: grid; grid-template-columns: repeat(${COLS}, 1fr); gap: 4px; }
      .bp-cell { aspect-ratio: 1; border: none; border-radius: 50%; cursor: pointer; transition: transform .12s, opacity .2s; padding: 0; }
      .bp-cell:active { transform: scale(.85); }
      .bp-cell.bp-empty { background: transparent !important; box-shadow: none; cursor: default; }
      .bp-msg { text-align: center; min-height: 22px; color: #4FA3C7; font-weight: 700; margin-top: 10px; font-size: 15px; }
    </style>
    <div class="bp-top">
      <span class="bp-badge bp-score">✨ 0 分</span>
      <span class="bp-badge bp-left">🫧 剩 ${COLS * ROWS} 个</span>
    </div>
    <div class="bp-board"></div>
    <div class="bp-msg">找到挨在一起的同色泡泡，一起点破它们！</div>
  `;
  api.root.appendChild(wrap);

  const boardEl = wrap.querySelector(".bp-board") as HTMLElement;
  const scoreEl = wrap.querySelector(".bp-score") as HTMLElement;
  const leftEl = wrap.querySelector(".bp-left") as HTMLElement;
  const msgEl = wrap.querySelector(".bp-msg") as HTMLElement;

  const cells: HTMLButtonElement[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const btn = document.createElement("button");
      btn.className = "bp-cell";
      btn.type = "button";
      const rr = r, cc = c;
      btn.addEventListener("click", () => onCell(rr, cc));
      boardEl.appendChild(btn);
      cells.push(btn);
    }
  }

  function countLeft(): number {
    let n = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] >= 0) n++;
    return n;
  }

  function render(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const el = cells[r * COLS + c];
        const v = grid[r][c];
        if (v < 0) {
          el.classList.add("bp-empty");
          el.style.background = "";
          el.style.boxShadow = "";
        } else {
          el.classList.remove("bp-empty");
          el.style.background = COLORS[v].bg;
          el.style.boxShadow = `0 2px 5px ${COLORS[v].ring}66`;
        }
      }
    }
    scoreEl.textContent = `✨ ${score} 分`;
    leftEl.textContent = `🫧 剩 ${countLeft()} 个`;
  }

  function group(r: number, c: number): Array<[number, number]> {
    const color = grid[r][c];
    if (color < 0) return [];
    const seen = new Set<number>();
    const stack: Array<[number, number]> = [[r, c]];
    const out: Array<[number, number]> = [];
    while (stack.length) {
      const [cr, cc] = stack.pop() as [number, number];
      const key = cr * COLS + cc;
      if (seen.has(key)) continue;
      seen.add(key);
      if (cr < 0 || cr >= ROWS || cc < 0 || cc >= COLS || grid[cr][cc] !== color) continue;
      out.push([cr, cc]);
      stack.push([cr + 1, cc], [cr - 1, cc], [cr, cc + 1], [cr, cc - 1]);
    }
    return out;
  }

  function collapse(): void {
    // 泡泡往下落
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c] >= 0) {
          grid[write][c] = grid[r][c];
          if (write !== r) grid[r][c] = -1;
          write--;
        }
      }
      for (let r = write; r >= 0; r--) grid[r][c] = -1;
    }
    // 空列往左靠
    let writeCol = 0;
    for (let c = 0; c < COLS; c++) {
      const hasAny = grid.some((row) => row[c] >= 0);
      if (hasAny) {
        if (writeCol !== c) {
          for (let r = 0; r < ROWS; r++) {
            grid[r][writeCol] = grid[r][c];
            grid[r][c] = -1;
          }
        }
        writeCol++;
      }
    }
  }

  function hasMoves(): boolean {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        if (v < 0) continue;
        if (r + 1 < ROWS && grid[r + 1][c] === v) return true;
        if (c + 1 < COLS && grid[r][c + 1] === v) return true;
      }
    }
    return false;
  }

  function finishBoard(): void {
    finished = true;
    const left = countLeft();
    if (left === 0) {
      api.play("win");
      api.addStars(1);
      msgEl.textContent = "🎉 泡泡全部清空，太完美啦！";
      api.onWin(3, `一个泡泡都不剩，得了 ${score} 分！`);
    } else if (left <= 6) {
      api.play("win");
      msgEl.textContent = "🎉 只剩下几个小泡泡，很棒！";
      api.onWin(2, `只剩 ${left} 个泡泡，得了 ${score} 分！`);
    } else if (left <= 14) {
      api.play("win");
      msgEl.textContent = "不错哦，泡泡消掉了一大半！";
      api.onWin(1, `剩下 ${left} 个泡泡，得了 ${score} 分！`);
    } else {
      api.play("oops");
      msgEl.textContent = "剩的泡泡有点多，再试一次吧！";
      api.onLose(`还剩 ${left} 个泡泡，下次先找大团的同色泡泡哦！`);
    }
  }

  function onCell(r: number, c: number): void {
    if (finished || grid[r][c] < 0) return;
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

  render();

  return {
    destroy() {
      finished = true;
      wrap.remove();
    },
  };
}
