export const meta = {
  id: "puzzle-tiles",
  title: "拼图乐园",
  emoji: "🧩",
  category: "casual" as const,
  color: "#E5E9FF",
  blurb: "推一推滑块，把打乱的小图案拼回原样吧！",
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

const N = 3;
const TILES = [
  { emoji: "🌸", bg: "#FFD9E8" },
  { emoji: "🌞", bg: "#FFF1BD" },
  { emoji: "🌈", bg: "#D9F1FF" },
  { emoji: "🍎", bg: "#FFDCD2" },
  { emoji: "🐝", bg: "#FDF3C7" },
  { emoji: "🍀", bg: "#D9F5D3" },
  { emoji: "⛵", bg: "#D5EAFB" },
  { emoji: "🎈", bg: "#F3DBFF" },
];

export function mount(api: GameApi): { destroy: () => void } {
  let finished = false;
  let moves = 0;
  // board[pos] = 值 0..7 表示第几块，8 表示空格
  const board: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  const wrap = document.createElement("div");
  wrap.className = "pz-wrap";
  wrap.innerHTML = `
    <style>
      .pz-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #EEF0FF, #FFF3F9); border-radius: 20px; padding: 14px; max-width: 400px; margin: 0 auto; user-select: none; }
      .pz-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .pz-badge { background: #fff; border-radius: 14px; padding: 6px 14px; font-weight: 700; color: #7B7FD0; box-shadow: 0 2px 6px rgba(130,130,210,.25); font-size: 15px; }
      .pz-preview { display: grid; grid-template-columns: repeat(3, 18px); gap: 2px; background: #fff; padding: 5px; border-radius: 10px; box-shadow: 0 2px 6px rgba(130,130,210,.25); }
      .pz-preview i { width: 18px; height: 18px; border-radius: 4px; font-style: normal; font-size: 12px; display: flex; align-items: center; justify-content: center; }
      .pz-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .pz-tile { aspect-ratio: 1; border: none; border-radius: 16px; font-size: clamp(30px, 11vw, 52px); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; transition: transform .14s; box-shadow: 0 3px 8px rgba(120,120,200,.2); padding: 0; }
      .pz-tile small { font-size: 13px; color: rgba(90,80,120,.65); font-weight: 700; }
      .pz-tile:active { transform: scale(.94); }
      .pz-tile.pz-empty { background: rgba(255,255,255,.35) !important; box-shadow: inset 0 2px 6px rgba(120,120,200,.2); cursor: default; }
      .pz-msg { text-align: center; min-height: 22px; color: #7B7FD0; font-weight: 700; margin-top: 10px; font-size: 15px; }
    </style>
    <div class="pz-top">
      <span class="pz-badge pz-moves">👣 0 步</span>
      <div class="pz-preview"></div>
    </div>
    <div class="pz-board"></div>
    <div class="pz-msg">点空格旁边的方块，把图案拼成右上角的样子！</div>
  `;
  api.root.appendChild(wrap);

  const boardEl = wrap.querySelector(".pz-board") as HTMLElement;
  const movesEl = wrap.querySelector(".pz-moves") as HTMLElement;
  const msgEl = wrap.querySelector(".pz-msg") as HTMLElement;
  const previewEl = wrap.querySelector(".pz-preview") as HTMLElement;

  for (let v = 0; v < 9; v++) {
    const cell = document.createElement("i");
    if (v < 8) {
      cell.style.background = TILES[v].bg;
      cell.textContent = TILES[v].emoji;
    }
    previewEl.appendChild(cell);
  }

  const tiles: HTMLButtonElement[] = [];
  for (let pos = 0; pos < 9; pos++) {
    const btn = document.createElement("button");
    btn.className = "pz-tile";
    btn.type = "button";
    btn.addEventListener("click", () => onTile(pos));
    boardEl.appendChild(btn);
    tiles.push(btn);
  }

  function emptyPos(): number {
    return board.indexOf(8);
  }

  function neighbors(pos: number): number[] {
    const r = Math.floor(pos / N), c = pos % N;
    const out: number[] = [];
    if (r > 0) out.push(pos - N);
    if (r < N - 1) out.push(pos + N);
    if (c > 0) out.push(pos - 1);
    if (c < N - 1) out.push(pos + 1);
    return out;
  }

  function render(): void {
    for (let pos = 0; pos < 9; pos++) {
      const v = board[pos];
      const el = tiles[pos];
      if (v === 8) {
        el.className = "pz-tile pz-empty";
        el.innerHTML = "";
        el.style.background = "";
      } else {
        el.className = "pz-tile";
        el.style.background = TILES[v].bg;
        el.innerHTML = `${TILES[v].emoji}<small>${v + 1}</small>`;
      }
    }
    movesEl.textContent = `👣 ${moves} 步`;
  }

  function isSolved(): boolean {
    return board.every((v, i) => v === i);
  }

  function shuffle(): void {
    // 从完成状态随机走 70 步，保证一定可以拼回去
    let prev = -1;
    for (let k = 0; k < 70 || isSolved(); k++) {
      const e = emptyPos();
      const opts = neighbors(e).filter((p) => p !== prev);
      const pick = opts[Math.floor(Math.random() * opts.length)];
      [board[e], board[pick]] = [board[pick], board[e]];
      prev = e;
      if (k > 200) break;
    }
  }

  function onTile(pos: number): void {
    if (finished) return;
    const e = emptyPos();
    if (!neighbors(e).includes(pos)) {
      if (board[pos] !== 8) {
        api.play("oops");
        msgEl.textContent = "这块推不动哦，先点空格旁边的方块～";
      }
      return;
    }
    [board[e], board[pos]] = [board[pos], board[e]];
    moves++;
    api.play("tap");
    render();
    if (isSolved()) {
      finished = true;
      const stars: 1 | 2 | 3 = moves <= 45 ? 3 : moves <= 90 ? 2 : 1;
      api.play("win");
      msgEl.textContent = "🎉 拼好啦，图案完整无缺！";
      api.onWin(stars, `只用了 ${moves} 步就拼好了，真聪明！`);
    }
  }

  shuffle();
  render();

  return {
    destroy() {
      finished = true;
      wrap.remove();
    },
  };
}
