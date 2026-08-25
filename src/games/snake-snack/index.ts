export const meta = {
  id: "snake-snack",
  title: "贪吃毛毛虫",
  emoji: "🐛",
  category: "casual" as const,
  color: "#E2F7DC",
  blurb: "带着毛毛虫吃点心，吃一口长一节，别撞到墙哦！",
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

const N = 13;
const CELL = 26;
const SIZE = N * CELL;
const TARGET = 8;
const SNACKS = ["🍓", "🍎", "🍇", "🍪", "🧁"];

export function mount(api: GameApi): { destroy: () => void } {
  let finished = false;
  const intervals = new Set<ReturnType<typeof setInterval>>();

  let snake: Array<[number, number]> = [[6, 6], [5, 6], [4, 6]];
  let dir: [number, number] = [1, 0];
  let nextDir: [number, number] = [1, 0];
  let eaten = 0;
  let snack: [number, number] = [9, 6];
  let snackEmoji = SNACKS[0];
  const startTime = Date.now();

  const wrap = document.createElement("div");
  wrap.className = "sn-wrap";
  wrap.innerHTML = `
    <style>
      .sn-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #EAFBE4, #FDF7E2); border-radius: 20px; padding: 12px; max-width: 400px; margin: 0 auto; user-select: none; }
      .sn-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
      .sn-badge { background: #fff; border-radius: 14px; padding: 6px 12px; font-weight: 700; color: #67A05B; box-shadow: 0 2px 6px rgba(120,180,110,.25); font-size: 15px; }
      .sn-canvas { width: 100%; border-radius: 16px; display: block; background: #F4FBEF; }
      .sn-pad { display: grid; grid-template-columns: 60px 60px 60px; grid-template-rows: 48px 48px; gap: 6px; justify-content: center; margin-top: 10px; }
      .sn-btn { border: none; border-radius: 14px; font-size: 22px; background: #BEE8B0; color: #3F6B36; cursor: pointer; box-shadow: 0 3px 0 #9CCC8E; touch-action: none; padding: 0; }
      .sn-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #9CCC8E; }
      .sn-up { grid-column: 2; grid-row: 1; }
      .sn-left { grid-column: 1; grid-row: 2; }
      .sn-down { grid-column: 2; grid-row: 2; }
      .sn-right { grid-column: 3; grid-row: 2; }
      .sn-msg { text-align: center; min-height: 20px; color: #67A05B; font-weight: 700; margin-top: 8px; font-size: 14px; }
    </style>
    <div class="sn-top">
      <span class="sn-badge sn-score">🍓 0 / ${TARGET}</span>
      <span class="sn-badge">🐛 毛毛虫加油！</span>
    </div>
    <canvas class="sn-canvas" width="${SIZE}" height="${SIZE}"></canvas>
    <div class="sn-pad">
      <button class="sn-btn sn-up" type="button">⬆️</button>
      <button class="sn-btn sn-left" type="button">⬅️</button>
      <button class="sn-btn sn-down" type="button">⬇️</button>
      <button class="sn-btn sn-right" type="button">➡️</button>
    </div>
    <div class="sn-msg">用按钮或方向键指挥毛毛虫，吃满 ${TARGET} 个点心！</div>
  `;
  api.root.appendChild(wrap);

  const canvas = wrap.querySelector(".sn-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  const scoreEl = wrap.querySelector(".sn-score") as HTMLElement;
  const msgEl = wrap.querySelector(".sn-msg") as HTMLElement;

  function setDir(x: number, y: number): void {
    if (finished) return;
    // 不能直接掉头
    if (x === -dir[0] && y === -dir[1]) return;
    nextDir = [x, y];
    api.play("tap");
  }

  (wrap.querySelector(".sn-up") as HTMLButtonElement).addEventListener("click", () => setDir(0, -1));
  (wrap.querySelector(".sn-down") as HTMLButtonElement).addEventListener("click", () => setDir(0, 1));
  (wrap.querySelector(".sn-left") as HTMLButtonElement).addEventListener("click", () => setDir(-1, 0));
  (wrap.querySelector(".sn-right") as HTMLButtonElement).addEventListener("click", () => setDir(1, 0));

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp") { setDir(0, -1); e.preventDefault(); }
    else if (e.key === "ArrowDown") { setDir(0, 1); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { setDir(-1, 0); e.preventDefault(); }
    else if (e.key === "ArrowRight") { setDir(1, 0); e.preventDefault(); }
  };
  window.addEventListener("keydown", onKeyDown);

  function placeSnack(): void {
    const occupied = new Set(snake.map(([x, y]) => y * N + x));
    let x = 0, y = 0;
    do {
      x = Math.floor(Math.random() * N);
      y = Math.floor(Math.random() * N);
    } while (occupied.has(y * N + x));
    snack = [x, y];
    snackEmoji = SNACKS[Math.floor(Math.random() * SNACKS.length)];
  }

  function draw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    // 草地格子
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#F1FAEA" : "#E7F5DD";
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
    // 点心
    ctx.font = `${CELL - 4}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(snackEmoji, snack[0] * CELL + CELL / 2, snack[1] * CELL + CELL / 2 + 1);
    // 毛毛虫身体
    for (let i = snake.length - 1; i >= 1; i--) {
      const [x, y] = snake[i];
      ctx.fillStyle = i % 2 === 0 ? "#9FD98A" : "#B7E3A4";
      ctx.beginPath();
      ctx.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // 头
    const [hx, hy] = snake[0];
    ctx.fillStyle = "#7BC966";
    ctx.beginPath();
    ctx.arc(hx * CELL + CELL / 2, hy * CELL + CELL / 2, CELL / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2F4A28";
    const ex = dir[0] * 3, ey = dir[1] * 3;
    ctx.beginPath();
    ctx.arc(hx * CELL + CELL / 2 - 4 + ex, hy * CELL + CELL / 2 - 3 + ey, 2.2, 0, Math.PI * 2);
    ctx.arc(hx * CELL + CELL / 2 + 4 + ex, hy * CELL + CELL / 2 - 3 + ey, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function lose(reason: string): void {
    if (finished) return;
    finished = true;
    intervals.forEach((t) => clearInterval(t));
    intervals.clear();
    api.play("oops");
    msgEl.textContent = reason;
    api.onLose(`${reason} 已经吃到 ${eaten} 个点心啦，再来一次！`);
  }

  function step(): void {
    if (finished) return;
    dir = nextDir;
    const head = snake[0];
    const nx = head[0] + dir[0];
    const ny = head[1] + dir[1];
    if (nx < 0 || nx >= N || ny < 0 || ny >= N) {
      lose("哎呀，撞到栅栏了！");
      return;
    }
    if (snake.some(([x, y], i) => i < snake.length - 1 && x === nx && y === ny)) {
      lose("哎呀，咬到自己尾巴了！");
      return;
    }
    snake.unshift([nx, ny]);
    if (nx === snack[0] && ny === snack[1]) {
      eaten++;
      api.play("coin");
      scoreEl.textContent = `🍓 ${eaten} / ${TARGET}`;
      msgEl.textContent = `好吃！毛毛虫变成 ${snake.length} 节啦～`;
      if (eaten >= TARGET) {
        finished = true;
        intervals.forEach((t) => clearInterval(t));
        intervals.clear();
        const secs = Math.round((Date.now() - startTime) / 1000);
        const stars: 1 | 2 | 3 = secs <= 50 ? 3 : secs <= 85 ? 2 : 1;
        draw();
        api.play("win");
        msgEl.textContent = "🎉 毛毛虫吃得饱饱的！";
        api.onWin(stars, `用了 ${secs} 秒吃完 ${TARGET} 个点心，长成大毛毛虫啦！`);
        return;
      }
      placeSnack();
    } else {
      snake.pop();
    }
    draw();
  }

  placeSnack();
  draw();
  const tickInt = setInterval(step, 300);
  intervals.add(tickInt);

  return {
    destroy() {
      finished = true;
      intervals.forEach((t) => clearInterval(t));
      intervals.clear();
      window.removeEventListener("keydown", onKeyDown);
      wrap.remove();
    },
  };
}
