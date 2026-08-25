export const meta = {
  id: "snake-snack",
  title: "贪吃毛毛虫",
  emoji: "🐛",
  category: "casual" as const,
  color: "#E2F7DC",
  blurb: "五张地图闯关！绕开树篱机关，闪电果实吃了会咻咻加速！",
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
const SNACKS = ["🍓", "🍎", "🍇", "🍪", "🧁"];

interface LevelConfig {
  name: string;
  target: number;
  tickMs: number;
  walls: Array<[number, number]>;
}

function hLine(y: number, x1: number, x2: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let x = x1; x <= x2; x++) out.push([x, y]);
  return out;
}
function vLine(x: number, y1: number, y2: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let y = y1; y <= y2; y++) out.push([x, y]);
  return out;
}

const LEVELS: LevelConfig[] = [
  { name: "青青草原", target: 6, tickMs: 300, walls: [] },
  { name: "树篱小路", target: 8, tickMs: 290, walls: [...hLine(6, 2, 4), ...hLine(6, 8, 10)] },
  { name: "双柱花园", target: 9, tickMs: 280, walls: [...vLine(6, 2, 4), ...vLine(6, 8, 10)] },
  {
    name: "四角迷宫", target: 10, tickMs: 270,
    walls: [...hLine(3, 2, 4), ...hLine(3, 8, 10), ...hLine(9, 2, 4), ...hLine(9, 8, 10)],
  },
  {
    name: "中心花坛", target: 12, tickMs: 260,
    walls: [...hLine(6, 4, 8), ...vLine(6, 4, 8)],
  },
];

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let running = false;
  const intervals = new Set<ReturnType<typeof setInterval>>();
  const timeouts = new Set<ReturnType<typeof setTimeout>>();

  let level = 0;
  let retries = 0;
  let snake: Array<[number, number]> = [];
  let dir: [number, number] = [1, 0];
  let nextDir: [number, number] = [1, 0];
  let eaten = 0;
  let snack: [number, number] = [9, 1];
  let snackEmoji = SNACKS[0];
  let snackIsBolt = false;
  let fastUntil = 0;
  let walls = new Set<number>();
  let stepTimer: ReturnType<typeof setInterval> | null = null;
  let fastMode = false;

  const wrap = document.createElement("div");
  wrap.className = "sn-wrap";
  wrap.innerHTML = `
    <style>
      .sn-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #EAFBE4, #FDF7E2); border-radius: 20px; padding: 12px; max-width: 400px; margin: 0 auto; user-select: none; position: relative; }
      .sn-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; }
      .sn-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #67A05B; box-shadow: 0 2px 6px rgba(120,180,110,.25); font-size: 14px; }
      .sn-canvas { width: 100%; border-radius: 16px; display: block; background: #F4FBEF; }
      .sn-pad { display: grid; grid-template-columns: 60px 60px 60px; grid-template-rows: 48px 48px; gap: 6px; justify-content: center; margin-top: 10px; }
      .sn-btn { border: none; border-radius: 14px; font-size: 22px; background: #BEE8B0; color: #3F6B36; cursor: pointer; box-shadow: 0 3px 0 #9CCC8E; touch-action: none; padding: 0; }
      .sn-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #9CCC8E; }
      .sn-up { grid-column: 2; grid-row: 1; }
      .sn-left { grid-column: 1; grid-row: 2; }
      .sn-down { grid-column: 2; grid-row: 2; }
      .sn-right { grid-column: 3; grid-row: 2; }
      .sn-msg { text-align: center; min-height: 20px; color: #67A05B; font-weight: 700; margin-top: 8px; font-size: 14px; }
      .sn-overlay { position: absolute; inset: 0; background: rgba(240,251,232,.96); border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; z-index: 5; text-align: center; padding: 16px; }
      .sn-ov-big { font-size: 52px; }
      .sn-ov-title { font-size: 24px; font-weight: 900; color: #67A05B; }
      .sn-ov-sub { font-size: 16px; font-weight: 700; color: #85B378; line-height: 1.6; }
      .sn-ov-btn { border: none; border-radius: 20px; padding: 14px 40px; font-size: 20px; font-weight: 900; color: #fff; background: linear-gradient(180deg,#9CD986,#72BB58); cursor: pointer; box-shadow: 0 5px 0 #559440; font-family: inherit; }
      .sn-ov-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #559440; }
    </style>
    <div class="sn-top">
      <span class="sn-badge sn-level">🚩 第 1 关</span>
      <span class="sn-badge sn-score">🍓 0 / 6</span>
    </div>
    <canvas class="sn-canvas" width="${SIZE}" height="${SIZE}"></canvas>
    <div class="sn-pad">
      <button class="sn-btn sn-up" type="button">⬆️</button>
      <button class="sn-btn sn-left" type="button">⬅️</button>
      <button class="sn-btn sn-down" type="button">⬇️</button>
      <button class="sn-btn sn-right" type="button">➡️</button>
    </div>
    <div class="sn-msg">用按钮或方向键指挥毛毛虫吃点心！</div>
  `;
  api.root.appendChild(wrap);

  const canvas = wrap.querySelector(".sn-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  const levelEl = wrap.querySelector(".sn-level") as HTMLElement;
  const scoreEl = wrap.querySelector(".sn-score") as HTMLElement;
  const msgEl = wrap.querySelector(".sn-msg") as HTMLElement;

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

  function setDir(x: number, y: number): void {
    if (!running) return;
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
    } while (occupied.has(y * N + x) || walls.has(y * N + x));
    snack = [x, y];
    snackIsBolt = level >= 1 && Math.random() < 0.25;
    snackEmoji = snackIsBolt ? "⚡" : SNACKS[Math.floor(Math.random() * SNACKS.length)];
  }

  function updateTop(): void {
    levelEl.textContent = `🚩 第 ${level + 1} 关 ${cfg().name}`;
    scoreEl.textContent = `🍓 ${eaten} / ${cfg().target}`;
  }

  function draw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#F1FAEA" : "#E7F5DD";
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
    // 树篱墙
    ctx.font = `${CELL - 4}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    walls.forEach((key) => {
      const x = key % N, y = Math.floor(key / N);
      ctx.fillStyle = "#C7E4B4";
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      ctx.fillText("🌳", x * CELL + CELL / 2, y * CELL + CELL / 2 + 1);
    });
    // 点心
    ctx.fillText(snackEmoji, snack[0] * CELL + CELL / 2, snack[1] * CELL + CELL / 2 + 1);
    // 毛毛虫身体
    for (let i = snake.length - 1; i >= 1; i--) {
      const [x, y] = snake[i];
      ctx.fillStyle = fastMode ? (i % 2 === 0 ? "#FFD98A" : "#FFE8B0") : (i % 2 === 0 ? "#9FD98A" : "#B7E3A4");
      ctx.beginPath();
      ctx.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
    }
    const [hx, hy] = snake[0];
    ctx.fillStyle = fastMode ? "#F5B942" : "#7BC966";
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

  function stopTimer(): void {
    if (stepTimer) { clearInterval(stepTimer); intervals.delete(stepTimer); stepTimer = null; }
  }

  function startTimer(): void {
    stopTimer();
    const ms = fastMode ? Math.round(cfg().tickMs * 0.55) : cfg().tickMs;
    stepTimer = setInterval(step, ms);
    intervals.add(stepTimer);
  }

  function showOverlay(kind: "next" | "retry", reason?: string): void {
    const ov = document.createElement("div");
    ov.className = "sn-overlay";
    if (kind === "next") {
      ov.innerHTML = `
        <div class="sn-ov-big">🎉</div>
        <div class="sn-ov-title">${cfg().name} 通过！</div>
        <div class="sn-ov-sub">下一张地图有新的树篱机关，小心哦～</div>
        <button class="sn-ov-btn" type="button">下一关 ▶</button>`;
      (ov.querySelector(".sn-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("jump");
        ov.remove();
        level++;
        startLevel();
      });
    } else {
      ov.innerHTML = `
        <div class="sn-ov-big">🌧️</div>
        <div class="sn-ov-title">${reason || "碰到啦"}</div>
        <div class="sn-ov-sub">已经吃到 ${eaten} 个点心，这一关再来一次！</div>
        <button class="sn-ov-btn" type="button">🔁 重试本关</button>`;
      (ov.querySelector(".sn-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("tap");
        ov.remove();
        retries++;
        startLevel();
      });
    }
    wrap.appendChild(ov);
  }

  function lose(reason: string): void {
    if (!running) return;
    running = false;
    stopTimer();
    api.play("oops");
    msgEl.textContent = reason;
    later(() => showOverlay("retry", reason), 350);
  }

  function step(): void {
    if (!running) return;
    if (fastMode && Date.now() > fastUntil) {
      fastMode = false;
      startTimer();
      msgEl.textContent = "加速结束，慢慢爬～";
    }
    dir = nextDir;
    const head = snake[0];
    const nx = head[0] + dir[0];
    const ny = head[1] + dir[1];
    if (nx < 0 || nx >= N || ny < 0 || ny >= N) {
      lose("哎呀，撞到栅栏了！");
      return;
    }
    if (walls.has(ny * N + nx)) {
      lose("哎呀，撞到树篱了！");
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
      updateTop();
      if (snackIsBolt) {
        fastMode = true;
        fastUntil = Date.now() + 3500;
        startTimer();
        msgEl.textContent = "⚡ 吃到闪电果实，咻咻加速！";
      } else {
        msgEl.textContent = `好吃！毛毛虫变成 ${snake.length} 节啦～`;
      }
      if (eaten >= cfg().target) {
        running = false;
        stopTimer();
        draw();
        api.play("win");
        if (level >= LEVELS.length - 1) {
          msgEl.textContent = "🎉 五张地图全部通关！";
          const stars: 1 | 2 | 3 = retries === 0 ? 3 : retries <= 2 ? 2 : 1;
          later(() => api.onWin(stars, `毛毛虫爬过了五张地图，长成超级大毛毛虫啦！`), 400);
        } else {
          msgEl.textContent = "🎉 这张地图吃饱啦！";
          later(() => showOverlay("next"), 400);
        }
        return;
      }
      placeSnack();
    } else {
      snake.pop();
    }
    draw();
  }

  function startLevel(): void {
    walls = new Set(cfg().walls.map(([x, y]) => y * N + x));
    snake = [[3, 1], [2, 1], [1, 1]];
    dir = [1, 0];
    nextDir = [1, 0];
    eaten = 0;
    fastMode = false;
    running = true;
    placeSnack();
    updateTop();
    msgEl.textContent = level >= 1
      ? `${cfg().name}：绕开树篱 🌳，⚡ 果实会加速哦！`
      : `吃满 ${cfg().target} 个点心就过关！`;
    draw();
    startTimer();
  }

  startLevel();

  return {
    destroy() {
      destroyed = true;
      running = false;
      intervals.forEach((t) => clearInterval(t));
      intervals.clear();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      window.removeEventListener("keydown", onKeyDown);
      wrap.remove();
    },
  };
}
