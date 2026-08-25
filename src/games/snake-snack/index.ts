import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, GRID, LEVELS, type SnakeLevel } from "./levels";

const CELL = 26;
const SIZE = GRID * CELL;
const SNACKS = ["🍓", "🍎", "🍇", "🍪", "🧁"];

const CSS = `
.sn-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #EAFBE4, #FDF7E2); border-radius: 16px; padding: 12px; user-select: none; position: relative; }
.sn-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap; }
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
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: SnakeLevel = LEVELS[ctx.level];
  let destroyed = false;
  let ended = false;
  let stepTimer: ReturnType<typeof setInterval> | null = null;

  let snake: Array<[number, number]> = [];
  let dir: [number, number] = [1, 0];
  let nextDir: [number, number] = [1, 0];
  let eaten = 0;
  let starsGot = 0;
  let snack: [number, number] = [9, 1];
  let snackEmoji = SNACKS[0];
  let snackIsStar = false;
  let starTicks = 0;
  const walls = new Set<number>();
  cfg.walls.forEach(([x, y]) => walls.add(y * GRID + x));

  const wrap = document.createElement("div");
  wrap.className = "sn-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="sn-top">
      <span class="sn-badge sn-score">🍓 0 / ${cfg.target}</span>
      <span class="sn-badge sn-star">⭐ 0</span>
    </div>
    <canvas class="sn-canvas" width="${SIZE}" height="${SIZE}"></canvas>
    <div class="sn-pad">
      <button class="sn-btn sn-up" type="button">⬆️</button>
      <button class="sn-btn sn-left" type="button">⬅️</button>
      <button class="sn-btn sn-down" type="button">⬇️</button>
      <button class="sn-btn sn-right" type="button">➡️</button>
    </div>
    <div class="sn-msg">吃点心变长，每隔几口会出现限时 ⭐ 星星果！</div>
  `;
  stage.appendChild(wrap);

  const canvas = wrap.querySelector(".sn-canvas") as HTMLCanvasElement;
  const c2d = canvas.getContext("2d");
  const scoreEl = wrap.querySelector(".sn-score") as HTMLElement;
  const starEl = wrap.querySelector(".sn-star") as HTMLElement;
  const msgEl = wrap.querySelector(".sn-msg") as HTMLElement;

  function cellFree(x: number, y: number): boolean {
    if (walls.has(y * GRID + x)) return false;
    return !snake.some(([sx, sy]) => sx === x && sy === y);
  }

  function placeSnack(): void {
    // 每吃 3 口出现一次限时星星果
    snackIsStar = eaten > 0 && eaten % 3 === 2;
    starTicks = 0;
    snackEmoji = snackIsStar ? "⭐" : SNACKS[Math.floor(Math.random() * SNACKS.length)];
    let guard = 0;
    do {
      snack = [Math.floor(Math.random() * GRID), Math.floor(Math.random() * GRID)];
      guard++;
    } while (!cellFree(snack[0], snack[1]) && guard < 500);
  }

  function draw(): void {
    if (!c2d) return;
    c2d.clearRect(0, 0, SIZE, SIZE);
    // 墙
    c2d.fillStyle = "#A9C79A";
    walls.forEach((key) => {
      const x = key % GRID, y = Math.floor(key / GRID);
      c2d.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    });
    c2d.font = `${CELL - 4}px serif`;
    c2d.textAlign = "center";
    c2d.textBaseline = "middle";
    walls.forEach((key) => {
      const x = key % GRID, y = Math.floor(key / GRID);
      c2d.fillText("🌿", x * CELL + CELL / 2, y * CELL + CELL / 2 + 1);
    });
    // 点心
    c2d.fillText(snackEmoji, snack[0] * CELL + CELL / 2, snack[1] * CELL + CELL / 2 + 1);
    // 毛毛虫
    snake.forEach(([x, y], i) => {
      c2d.fillStyle = i === 0 ? "#6BBB4E" : i % 2 === 0 ? "#8FD070" : "#A5DB8A";
      c2d.beginPath();
      c2d.arc(x * CELL + CELL / 2, y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
      c2d.fill();
      if (i === 0) {
        c2d.fillStyle = "#2F4F2A";
        const [dx, dy] = dir;
        c2d.beginPath();
        c2d.arc(x * CELL + CELL / 2 + dx * 5 - dy * 4, y * CELL + CELL / 2 + dy * 5 - dx * 4, 2.4, 0, Math.PI * 2);
        c2d.arc(x * CELL + CELL / 2 + dx * 5 + dy * 4, y * CELL + CELL / 2 + dy * 5 + dx * 4, 2.4, 0, Math.PI * 2);
        c2d.fill();
      }
    });
  }

  function renderTop(): void {
    scoreEl.textContent = `🍓 ${eaten} / ${cfg.target}`;
    starEl.textContent = `⭐ ${starsGot}`;
  }

  function finish(won: boolean, reason?: string): void {
    if (ended) return;
    ended = true;
    if (stepTimer) clearInterval(stepTimer);
    if (won) {
      const got = starsGot >= 2 ? 3 : starsGot >= 1 ? 2 : 1;
      setTimeout(() => { if (!destroyed) ctx.win(got as 1 | 2 | 3, `吃饱 ${cfg.target} 口，还追到了 ${starsGot} 颗星星果！`); }, 350);
    } else {
      setTimeout(() => { if (!destroyed) ctx.lose(reason ?? "撞到啦，没关系，转弯早一点点就好！"); }, 350);
    }
  }

  function step(): void {
    if (ended || destroyed) return;
    dir = nextDir;
    const head = snake[0];
    const nx = head[0] + dir[0];
    const ny = head[1] + dir[1];
    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) {
      ctx.sfx("oops");
      finish(false, "碰到花园围栏啦，早点转弯就好！");
      return;
    }
    if (walls.has(ny * GRID + nx)) {
      ctx.sfx("oops");
      finish(false, "撞到树篱啦，下次绕着走！");
      return;
    }
    if (snake.some(([sx, sy], i) => i > 0 && sx === nx && sy === ny)) {
      ctx.sfx("oops");
      finish(false, "咬到自己尾巴啦，身体长了要小心盘绕！");
      return;
    }
    snake.unshift([nx, ny]);
    if (nx === snack[0] && ny === snack[1]) {
      eaten++;
      if (snackIsStar) {
        starsGot++;
        ctx.sfx("coin");
        msgEl.textContent = "⭐ 追到星星果啦！";
      } else {
        ctx.sfx("pop");
      }
      renderTop();
      if (eaten >= cfg.target) {
        draw();
        finish(true);
        return;
      }
      placeSnack();
    } else {
      snake.pop();
      if (snackIsStar) {
        starTicks++;
        if (starTicks > 30) {
          // 星星果限时溜走，换回普通点心
          snackIsStar = false;
          snackEmoji = SNACKS[Math.floor(Math.random() * SNACKS.length)];
          msgEl.textContent = "星星果溜走了，下次快一点！";
        }
      }
    }
    draw();
  }

  function turn(d: [number, number]): void {
    if (ended) return;
    if (d[0] === -dir[0] && d[1] === -dir[1]) return;
    nextDir = d;
    ctx.sfx("tap");
  }

  (wrap.querySelector(".sn-up") as HTMLButtonElement).addEventListener("click", () => turn([0, -1]));
  (wrap.querySelector(".sn-down") as HTMLButtonElement).addEventListener("click", () => turn([0, 1]));
  (wrap.querySelector(".sn-left") as HTMLButtonElement).addEventListener("click", () => turn([-1, 0]));
  (wrap.querySelector(".sn-right") as HTMLButtonElement).addEventListener("click", () => turn([1, 0]));

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp") { turn([0, -1]); e.preventDefault(); }
    if (e.key === "ArrowDown") { turn([0, 1]); e.preventDefault(); }
    if (e.key === "ArrowLeft") { turn([-1, 0]); e.preventDefault(); }
    if (e.key === "ArrowRight") { turn([1, 0]); e.preventDefault(); }
  };
  window.addEventListener("keydown", onKeyDown);

  const mid = Math.floor(GRID / 2);
  snake = [[3, mid], [2, mid], [1, mid]];
  dir = [1, 0];
  nextDir = [1, 0];
  placeSnack();
  renderTop();
  draw();
  stepTimer = setInterval(step, cfg.tickMs);

  return {
    destroy() {
      destroyed = true;
      ended = true;
      if (stepTimer) clearInterval(stepTimer);
      window.removeEventListener("keydown", onKeyDown);
      wrap.remove();
    },
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,
    mapHint: "追到 2 颗限时星星果就能拿 3 星！",
    grandMessage: "99 座花园全部吃遍，毛毛虫长成大明星！",
  });
}
