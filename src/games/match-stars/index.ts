export const meta = {
  id: "match-stars",
  title: "星星消消乐",
  emoji: "⭐",
  category: "casual" as const,
  color: "#FFE3F1",
  blurb: "交换相邻的小星星，三个连成一排就会噗地消失啦！",
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

const SIZE = 8;
const TARGET_SCORE = 300;
const START_MOVES = 16;

const TOKENS = [
  { emoji: "⭐", bg: "#FFF3C4" },
  { emoji: "💖", bg: "#FFDDE8" },
  { emoji: "🍀", bg: "#D8F5D8" },
  { emoji: "🌙", bg: "#DCE9FF" },
  { emoji: "🍊", bg: "#FFE8D1" },
];

export function mount(api: GameApi): { destroy: () => void } {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let finished = false;
  let busy = false;

  let score = 0;
  let moves = START_MOVES;
  let selected = -1;

  const grid: number[] = new Array(SIZE * SIZE).fill(0);

  const wrap = document.createElement("div");
  wrap.className = "mst-wrap";
  wrap.innerHTML = `
    <style>
      .mst-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF0F7, #F3F0FF); border-radius: 20px; padding: 12px; max-width: 420px; margin: 0 auto; user-select: none; }
      .mst-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 10px; }
      .mst-badge { background: #fff; border-radius: 14px; padding: 6px 12px; font-weight: 700; color: #A66BBE; box-shadow: 0 2px 6px rgba(180,140,220,.25); font-size: 15px; }
      .mst-bar { height: 12px; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
      .mst-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #FFB6D9, #C9A7F5); border-radius: 8px; transition: width .3s; }
      .mst-board { display: grid; grid-template-columns: repeat(${SIZE}, 1fr); gap: 4px; }
      .mst-cell { aspect-ratio: 1; border: none; border-radius: 12px; font-size: clamp(16px, 4.5vw, 26px); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform .12s, box-shadow .12s; padding: 0; }
      .mst-cell:active { transform: scale(.9); }
      .mst-cell.mst-sel { box-shadow: 0 0 0 3px #FF8FC7; transform: scale(1.08); }
      .mst-cell.mst-boom { animation: mstBoom .25s ease; }
      @keyframes mstBoom { 0% { transform: scale(1.25); opacity: .4; } 100% { transform: scale(1); opacity: 1; } }
      .mst-msg { text-align: center; min-height: 22px; color: #B06BC0; font-weight: 700; margin-top: 8px; font-size: 15px; }
    </style>
    <div class="mst-top">
      <span class="mst-badge">🎯 目标 ${TARGET_SCORE} 分</span>
      <span class="mst-badge mst-score">✨ 0 分</span>
      <span class="mst-badge mst-moves">👣 ${START_MOVES} 步</span>
    </div>
    <div class="mst-bar"><div class="mst-fill"></div></div>
    <div class="mst-board"></div>
    <div class="mst-msg">点一颗星星，再点它旁边的，交换位置吧！</div>
  `;
  api.root.appendChild(wrap);

  const boardEl = wrap.querySelector(".mst-board") as HTMLElement;
  const scoreEl = wrap.querySelector(".mst-score") as HTMLElement;
  const movesEl = wrap.querySelector(".mst-moves") as HTMLElement;
  const fillEl = wrap.querySelector(".mst-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".mst-msg") as HTMLElement;

  const cells: HTMLButtonElement[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const btn = document.createElement("button");
    btn.className = "mst-cell";
    btn.type = "button";
    btn.addEventListener("click", () => onCell(i));
    boardEl.appendChild(btn);
    cells.push(btn);
  }

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!finished) fn();
    }, ms);
    timeouts.add(t);
  }

  function randToken(): number {
    return Math.floor(Math.random() * TOKENS.length);
  }

  function fillInitial(): void {
    for (let i = 0; i < grid.length; i++) {
      let v = randToken();
      // 避免开局就有现成的三连
      const r = Math.floor(i / SIZE);
      const c = i % SIZE;
      while (
        (c >= 2 && grid[i - 1] === v && grid[i - 2] === v) ||
        (r >= 2 && grid[i - SIZE] === v && grid[i - 2 * SIZE] === v)
      ) {
        v = randToken();
      }
      grid[i] = v;
    }
  }

  function findMatches(g: number[]): Set<number> {
    const out = new Set<number>();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const i = r * SIZE + c;
        const v = g[i];
        if (v < 0) continue;
        if (c <= SIZE - 3 && g[i + 1] === v && g[i + 2] === v) {
          out.add(i); out.add(i + 1); out.add(i + 2);
        }
        if (r <= SIZE - 3 && g[i + SIZE] === v && g[i + 2 * SIZE] === v) {
          out.add(i); out.add(i + SIZE); out.add(i + 2 * SIZE);
        }
      }
    }
    return out;
  }

  function render(boomSet?: Set<number>): void {
    for (let i = 0; i < grid.length; i++) {
      const cell = cells[i];
      const v = grid[i];
      if (v < 0) {
        cell.textContent = "";
        cell.style.background = "rgba(255,255,255,.4)";
      } else {
        cell.textContent = TOKENS[v].emoji;
        cell.style.background = TOKENS[v].bg;
      }
      cell.classList.toggle("mst-sel", i === selected);
      cell.classList.toggle("mst-boom", !!boomSet && boomSet.has(i));
    }
    scoreEl.textContent = `✨ ${score} 分`;
    movesEl.textContent = `👣 ${moves} 步`;
    fillEl.style.width = `${Math.min(100, (score / TARGET_SCORE) * 100)}%`;
  }

  function applyGravity(): void {
    for (let c = 0; c < SIZE; c++) {
      let write = SIZE - 1;
      for (let r = SIZE - 1; r >= 0; r--) {
        const v = grid[r * SIZE + c];
        if (v >= 0) {
          grid[write * SIZE + c] = v;
          write--;
        }
      }
      for (let r = write; r >= 0; r--) {
        grid[r * SIZE + c] = randToken();
      }
    }
  }

  function resolveCascade(chain: number): void {
    const matched = findMatches(grid);
    if (matched.size === 0) {
      busy = false;
      checkEnd();
      return;
    }
    api.play("pop");
    const gained = matched.size * 10 + (chain - 1) * 20;
    score += gained;
    if (matched.size >= 5) {
      api.addStars(1);
      msgEl.textContent = `哇！一下消掉 ${matched.size} 颗，奖励一颗小星星！`;
    } else if (chain > 1) {
      msgEl.textContent = `连锁反应 x${chain}，太棒啦！`;
    }
    matched.forEach((i) => { grid[i] = -1; });
    render(matched);
    later(() => {
      applyGravity();
      render();
      later(() => resolveCascade(chain + 1), 180);
    }, 220);
  }

  function checkEnd(): void {
    if (finished) return;
    if (score >= TARGET_SCORE) {
      finished = true;
      const stars: 1 | 2 | 3 = moves >= 5 ? 3 : moves >= 2 ? 2 : 1;
      api.play("win");
      msgEl.textContent = "🎉 达成目标，星星全亮啦！";
      api.onWin(stars, `消出了 ${score} 分，真厉害！`);
    } else if (moves <= 0) {
      finished = true;
      api.play("oops");
      msgEl.textContent = "步数用完了，下次一定行！";
      api.onLose(`差一点点，得到 ${score} 分，再来一局吧！`);
    }
  }

  function adjacent(a: number, b: number): boolean {
    const ra = Math.floor(a / SIZE), ca = a % SIZE;
    const rb = Math.floor(b / SIZE), cb = b % SIZE;
    return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
  }

  function onCell(i: number): void {
    if (finished || busy) return;
    if (selected === -1) {
      selected = i;
      api.play("tap");
      render();
      return;
    }
    if (selected === i) {
      selected = -1;
      render();
      return;
    }
    if (!adjacent(selected, i)) {
      selected = i;
      api.play("tap");
      render();
      return;
    }
    const a = selected, b = i;
    selected = -1;
    [grid[a], grid[b]] = [grid[b], grid[a]];
    if (findMatches(grid).size === 0) {
      [grid[a], grid[b]] = [grid[b], grid[a]];
      api.play("oops");
      msgEl.textContent = "这样换不能消除哦，换个方向试试～";
      render();
      return;
    }
    moves--;
    busy = true;
    render();
    later(() => resolveCascade(1), 120);
  }

  fillInitial();
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
