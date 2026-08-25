export const meta = {
  id: "puzzle-tiles",
  title: "拼图乐园",
  emoji: "🧩",
  category: "casual" as const,
  color: "#E5E9FF",
  blurb: "五关滑块拼图！图案关关不同，还有魔法提示帮你忙！",
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

interface Tile { emoji: string; bg: string }

const PICTURES: Tile[][] = [
  [
    { emoji: "🌸", bg: "#FFD9E8" }, { emoji: "🌞", bg: "#FFF1BD" }, { emoji: "🌈", bg: "#D9F1FF" },
    { emoji: "🍎", bg: "#FFDCD2" }, { emoji: "🐝", bg: "#FDF3C7" }, { emoji: "🍀", bg: "#D9F5D3" },
    { emoji: "⛵", bg: "#D5EAFB" }, { emoji: "🎈", bg: "#F3DBFF" },
  ],
  [
    { emoji: "🐱", bg: "#FFE8CE" }, { emoji: "🐶", bg: "#EDE1D1" }, { emoji: "🐰", bg: "#FFE3EE" },
    { emoji: "🦊", bg: "#FFD9BE" }, { emoji: "🐼", bg: "#E8E8E8" }, { emoji: "🐸", bg: "#DDF5D0" },
    { emoji: "🐥", bg: "#FFF6C4" }, { emoji: "🐙", bg: "#F4DBF0" },
  ],
  [
    { emoji: "🚗", bg: "#FFDBDB" }, { emoji: "🚌", bg: "#FFF0C0" }, { emoji: "🚀", bg: "#E1E7FF" },
    { emoji: "🚁", bg: "#D8F2F8" }, { emoji: "🚂", bg: "#E6DCCB" }, { emoji: "⛵", bg: "#D5EAFB" },
    { emoji: "🚲", bg: "#E0F5DC" }, { emoji: "🛸", bg: "#EFE0FA" },
  ],
  [
    { emoji: "🍓", bg: "#FFDDE4" }, { emoji: "🍌", bg: "#FFF6BF" }, { emoji: "🍇", bg: "#EBDCF8" },
    { emoji: "🍉", bg: "#FFE0DA" }, { emoji: "🍑", bg: "#FFE9D4" }, { emoji: "🍍", bg: "#FBF0C0" },
    { emoji: "🥝", bg: "#E1F3D2" }, { emoji: "🍒", bg: "#FFD9DE" },
  ],
  [
    { emoji: "🌟", bg: "#FFF3C4" }, { emoji: "🌙", bg: "#DCE9FF" }, { emoji: "☀️", bg: "#FFEDB8" },
    { emoji: "☁️", bg: "#EAF2FA" }, { emoji: "🌍", bg: "#D8EFDC" }, { emoji: "⚡", bg: "#FFF2C8" },
    { emoji: "❄️", bg: "#E0F3FF" }, { emoji: "🌋", bg: "#FFDFD0" },
  ],
];

interface LevelConfig {
  shuffleSteps: number;
  moveLimit: number;
  hints: number;
}

const LEVELS: LevelConfig[] = [
  { shuffleSteps: 12, moveLimit: 60, hints: 3 },
  { shuffleSteps: 26, moveLimit: 110, hints: 3 },
  { shuffleSteps: 44, moveLimit: 160, hints: 3 },
  { shuffleSteps: 64, moveLimit: 220, hints: 4 },
  { shuffleSteps: 88, moveLimit: 280, hints: 4 },
];

export function mount(api: GameApi): { destroy: () => void } {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let levelDone = false;

  let level = 0;
  let retries = 0;
  let moves = 0;
  let hintsLeft = 0;
  const board: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  const wrap = document.createElement("div");
  wrap.className = "pz-wrap";
  wrap.innerHTML = `
    <style>
      .pz-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #EEF0FF, #FFF3F9); border-radius: 20px; padding: 14px; max-width: 400px; margin: 0 auto; user-select: none; position: relative; }
      .pz-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
      .pz-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #7B7FD0; box-shadow: 0 2px 6px rgba(130,130,210,.25); font-size: 14px; }
      .pz-row2 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px; }
      .pz-preview { display: grid; grid-template-columns: repeat(3, 18px); gap: 2px; background: #fff; padding: 5px; border-radius: 10px; box-shadow: 0 2px 6px rgba(130,130,210,.25); }
      .pz-preview i { width: 18px; height: 18px; border-radius: 4px; font-style: normal; font-size: 12px; display: flex; align-items: center; justify-content: center; }
      .pz-hint { border: none; border-radius: 14px; padding: 8px 14px; font-weight: 800; background: #D5C8F8; color: #5D48A0; cursor: pointer; box-shadow: 0 3px 0 #B7A3E8; font-size: 15px; font-family: inherit; }
      .pz-hint:active { transform: translateY(2px); box-shadow: 0 1px 0 #B7A3E8; }
      .pz-hint:disabled { opacity: .5; }
      .pz-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .pz-tile { aspect-ratio: 1; border: none; border-radius: 16px; font-size: clamp(30px, 11vw, 52px); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; transition: transform .14s; box-shadow: 0 3px 8px rgba(120,120,200,.2); padding: 0; }
      .pz-tile small { font-size: 13px; color: rgba(90,80,120,.65); font-weight: 700; }
      .pz-tile:active { transform: scale(.94); }
      .pz-tile.pz-empty { background: rgba(255,255,255,.35) !important; box-shadow: inset 0 2px 6px rgba(120,120,200,.2); cursor: default; }
      .pz-tile.pz-glow { animation: pzGlow 1s ease infinite; box-shadow: 0 0 0 4px #FFD86E; }
      @keyframes pzGlow { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
      .pz-msg { text-align: center; min-height: 22px; color: #7B7FD0; font-weight: 700; margin-top: 10px; font-size: 15px; }
      .pz-overlay { position: absolute; inset: 0; background: rgba(240,242,255,.96); border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; z-index: 5; text-align: center; padding: 16px; }
      .pz-ov-big { font-size: 52px; }
      .pz-ov-title { font-size: 24px; font-weight: 900; color: #7B7FD0; }
      .pz-ov-sub { font-size: 16px; font-weight: 700; color: #9B9EDB; line-height: 1.6; }
      .pz-ov-btn { border: none; border-radius: 20px; padding: 14px 40px; font-size: 20px; font-weight: 900; color: #fff; background: linear-gradient(180deg,#A0A6F0,#7B7FD0); cursor: pointer; box-shadow: 0 5px 0 #5B5FB0; font-family: inherit; }
      .pz-ov-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #5B5FB0; }
    </style>
    <div class="pz-top">
      <span class="pz-badge pz-level">🚩 第 1 关</span>
      <span class="pz-badge pz-moves">👣 0 步</span>
    </div>
    <div class="pz-row2">
      <button class="pz-hint" type="button">💡 提示 x3</button>
      <div class="pz-preview"></div>
    </div>
    <div class="pz-board"></div>
    <div class="pz-msg">点空格旁边的方块，把图案拼成右上角的样子！</div>
  `;
  api.root.appendChild(wrap);

  const boardEl = wrap.querySelector(".pz-board") as HTMLElement;
  const levelEl = wrap.querySelector(".pz-level") as HTMLElement;
  const movesEl = wrap.querySelector(".pz-moves") as HTMLElement;
  const msgEl = wrap.querySelector(".pz-msg") as HTMLElement;
  const previewEl = wrap.querySelector(".pz-preview") as HTMLElement;
  const hintBtn = wrap.querySelector(".pz-hint") as HTMLButtonElement;

  const tiles: HTMLButtonElement[] = [];
  for (let pos = 0; pos < 9; pos++) {
    const btn = document.createElement("button");
    btn.className = "pz-tile";
    btn.type = "button";
    btn.addEventListener("click", () => onTile(pos));
    boardEl.appendChild(btn);
    tiles.push(btn);
  }

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

  function pic(): Tile[] {
    return PICTURES[level % PICTURES.length];
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

  function renderPreview(): void {
    previewEl.innerHTML = "";
    for (let v = 0; v < 9; v++) {
      const cell = document.createElement("i");
      if (v < 8) {
        cell.style.background = pic()[v].bg;
        cell.textContent = pic()[v].emoji;
      }
      previewEl.appendChild(cell);
    }
  }

  function render(): void {
    for (let pos = 0; pos < 9; pos++) {
      const v = board[pos];
      const el = tiles[pos];
      el.classList.remove("pz-glow");
      if (v === 8) {
        el.className = "pz-tile pz-empty";
        el.innerHTML = "";
        el.style.background = "";
      } else {
        el.className = "pz-tile";
        el.style.background = pic()[v].bg;
        el.innerHTML = `${pic()[v].emoji}<small>${v + 1}</small>`;
      }
    }
    levelEl.textContent = `🚩 第 ${level + 1} 关`;
    movesEl.textContent = `👣 ${moves} / ${cfg().moveLimit} 步`;
    hintBtn.textContent = `💡 提示 x${hintsLeft}`;
    hintBtn.disabled = hintsLeft <= 0;
  }

  function isSolved(): boolean {
    return board.every((v, i) => v === i);
  }

  function shuffle(): void {
    board.forEach((_, i) => { board[i] = i; });
    let prev = -1;
    for (let k = 0; k < cfg().shuffleSteps || isSolved(); k++) {
      const e = emptyPos();
      const opts = neighbors(e).filter((p) => p !== prev);
      const pick = opts[Math.floor(Math.random() * opts.length)];
      [board[e], board[pick]] = [board[pick], board[e]];
      prev = e;
      if (k > 400) break;
    }
  }

  function setupLevel(): void {
    levelDone = false;
    moves = 0;
    hintsLeft = cfg().hints;
    shuffle();
    renderPreview();
    render();
    msgEl.textContent = `第 ${level + 1} 关：把图案拼成右上角的样子！`;
  }

  function showHint(): void {
    if (levelDone || hintsLeft <= 0) return;
    hintsLeft--;
    api.play("coin");
    const e = emptyPos();
    const movable = neighbors(e);
    // 优先提示「推过去正好归位」的方块
    let best = movable.find((p) => board[p] === e);
    if (best === undefined) {
      // 否则提示推过去离家更近的方块
      let bestGain = -99;
      for (const p of movable) {
        const v = board[p];
        const tr = Math.floor(v / N), tc = v % N;
        const now = Math.abs(Math.floor(p / N) - tr) + Math.abs((p % N) - tc);
        const after = Math.abs(Math.floor(e / N) - tr) + Math.abs((e % N) - tc);
        const gain = now - after;
        if (gain > bestGain) { bestGain = gain; best = p; }
      }
    }
    render();
    if (best !== undefined) {
      tiles[best].classList.add("pz-glow");
      msgEl.textContent = "💡 亮亮的那块，推它试试！";
      later(() => tiles[best as number].classList.remove("pz-glow"), 2200);
    }
  }

  function showOverlay(kind: "next" | "retry"): void {
    const ov = document.createElement("div");
    ov.className = "pz-overlay";
    if (kind === "next") {
      ov.innerHTML = `
        <div class="pz-ov-big">🎉</div>
        <div class="pz-ov-title">第 ${level + 1} 关拼好啦！</div>
        <div class="pz-ov-sub">只用了 ${moves} 步，下一关图案更乱哦～</div>
        <button class="pz-ov-btn" type="button">下一关 ▶</button>`;
      (ov.querySelector(".pz-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("jump");
        ov.remove();
        level++;
        setupLevel();
      });
    } else {
      ov.innerHTML = `
        <div class="pz-ov-big">🌧️</div>
        <div class="pz-ov-title">步数用完啦</div>
        <div class="pz-ov-sub">没关系，重新打乱再拼一次，你一定行！</div>
        <button class="pz-ov-btn" type="button">🔁 重试本关</button>`;
      (ov.querySelector(".pz-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("tap");
        ov.remove();
        retries++;
        setupLevel();
      });
    }
    wrap.appendChild(ov);
  }

  function onTile(pos: number): void {
    if (levelDone) return;
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
      levelDone = true;
      api.play("win");
      if (level >= LEVELS.length - 1) {
        msgEl.textContent = "🎉 五关拼图全部完成！";
        const stars: 1 | 2 | 3 = retries === 0 ? 3 : retries <= 2 ? 2 : 1;
        later(() => api.onWin(stars, `五幅图案全部拼好，拼图小天才！`), 400);
      } else {
        msgEl.textContent = "🎉 拼好啦，图案完整无缺！";
        later(() => showOverlay("next"), 400);
      }
      return;
    }
    if (moves >= cfg().moveLimit) {
      levelDone = true;
      api.play("oops");
      later(() => showOverlay("retry"), 300);
    }
  }

  hintBtn.addEventListener("click", showHint);

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
