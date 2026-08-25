export const meta = {
  id: "fruit-catch",
  title: "接住小水果",
  emoji: "🧺",
  category: "casual" as const,
  color: "#FFF4D6",
  blurb: "左右移动小篮子，把掉下来的水果通通接住！",
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

const W = 360;
const H = 460;
const TARGET = 15;
const MAX_MISS = 5;
const FRUITS = ["🍎", "🍌", "🍓", "🍇", "🍑", "🍊"];

interface Fruit {
  x: number;
  y: number;
  vy: number;
  emoji: string;
  golden: boolean;
}

export function mount(api: GameApi): { destroy: () => void } {
  let finished = false;
  let raf = 0;
  let lastTime = 0;
  let spawnTimer = 0;
  let caught = 0;
  let missed = 0;
  let dir = 0; // -1 左, 1 右
  let basketX = W / 2;
  const fruits: Fruit[] = [];

  const wrap = document.createElement("div");
  wrap.className = "fc-wrap";
  wrap.innerHTML = `
    <style>
      .fc-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF9E8, #FFEFEF); border-radius: 20px; padding: 12px; max-width: 400px; margin: 0 auto; user-select: none; touch-action: none; }
      .fc-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
      .fc-badge { background: #fff; border-radius: 14px; padding: 6px 12px; font-weight: 700; color: #D08A3E; box-shadow: 0 2px 6px rgba(220,170,100,.25); font-size: 15px; }
      .fc-canvas { width: 100%; border-radius: 16px; display: block; background: linear-gradient(180deg, #CDEBFF 0%, #EAF8E6 100%); touch-action: none; }
      .fc-ctrl { display: flex; justify-content: center; gap: 24px; margin-top: 10px; }
      .fc-btn { width: 84px; height: 56px; border: none; border-radius: 18px; font-size: 26px; background: #FFD9A0; color: #8A5A20; cursor: pointer; box-shadow: 0 4px 0 #EBBB77; touch-action: none; }
      .fc-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #EBBB77; }
      .fc-msg { text-align: center; min-height: 20px; color: #D08A3E; font-weight: 700; margin-top: 8px; font-size: 14px; }
    </style>
    <div class="fc-top">
      <span class="fc-badge fc-score">🧺 0 / ${TARGET}</span>
      <span class="fc-badge fc-miss">💗💗💗💗💗</span>
    </div>
    <canvas class="fc-canvas" width="${W}" height="${H}"></canvas>
    <div class="fc-ctrl">
      <button class="fc-btn fc-left" type="button">⬅️</button>
      <button class="fc-btn fc-right" type="button">➡️</button>
    </div>
    <div class="fc-msg">按住按钮或直接拖动画面移动篮子～</div>
  `;
  api.root.appendChild(wrap);

  const canvas = wrap.querySelector(".fc-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  const scoreEl = wrap.querySelector(".fc-score") as HTMLElement;
  const missEl = wrap.querySelector(".fc-miss") as HTMLElement;
  const msgEl = wrap.querySelector(".fc-msg") as HTMLElement;
  const leftBtn = wrap.querySelector(".fc-left") as HTMLButtonElement;
  const rightBtn = wrap.querySelector(".fc-right") as HTMLButtonElement;

  function updateTop(): void {
    scoreEl.textContent = `🧺 ${caught} / ${TARGET}`;
    missEl.textContent = "💗".repeat(Math.max(0, MAX_MISS - missed)) + "🤍".repeat(missed);
  }

  function spawnFruit(): void {
    const golden = Math.random() < 0.1;
    fruits.push({
      x: 30 + Math.random() * (W - 60),
      y: -20,
      vy: 90 + Math.random() * 60 + caught * 4,
      emoji: golden ? "🌟" : FRUITS[Math.floor(Math.random() * FRUITS.length)],
      golden,
    });
  }

  function draw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    // 云朵
    ctx.font = "26px serif";
    ctx.fillText("☁️", 40, 50);
    ctx.fillText("☁️", 250, 90);
    ctx.fillText("🌈", 150, 60);
    // 水果
    ctx.font = "30px serif";
    ctx.textAlign = "center";
    for (const f of fruits) {
      ctx.fillText(f.emoji, f.x, f.y);
    }
    // 篮子
    ctx.font = "44px serif";
    ctx.fillText("🧺", basketX, H - 18);
    ctx.textAlign = "left";
  }

  function endGame(win: boolean): void {
    if (finished) return;
    finished = true;
    if (win) {
      const stars: 1 | 2 | 3 = missed === 0 ? 3 : missed <= 2 ? 2 : 1;
      api.play("win");
      msgEl.textContent = "🎉 篮子装得满满的！";
      api.onWin(stars, `接住了 ${TARGET} 个水果，只漏掉 ${missed} 个！`);
    } else {
      api.play("oops");
      msgEl.textContent = "水果掉了好多，再试一次吧！";
      api.onLose(`接住了 ${caught} 个，下次瞄准一点哦！`);
    }
  }

  function tick(now: number): void {
    if (finished) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    basketX += dir * 260 * dt;
    basketX = Math.max(28, Math.min(W - 28, basketX));

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnFruit();
      spawnTimer = Math.max(0.55, 1.1 - caught * 0.03);
    }

    for (let i = fruits.length - 1; i >= 0; i--) {
      const f = fruits[i];
      f.y += f.vy * dt;
      if (f.y >= H - 34 && f.y <= H - 6 && Math.abs(f.x - basketX) < 34) {
        fruits.splice(i, 1);
        if (f.golden) {
          api.play("coin");
          api.addStars(1);
          msgEl.textContent = "🌟 接到金星星，奖励一颗小星星！";
        } else {
          api.play("pop");
        }
        caught++;
        updateTop();
        if (caught >= TARGET) {
          draw();
          endGame(true);
          return;
        }
      } else if (f.y > H + 20) {
        fruits.splice(i, 1);
        if (!f.golden) {
          missed++;
          api.play("oops");
          updateTop();
          if (missed >= MAX_MISS) {
            draw();
            endGame(false);
            return;
          }
        }
      }
    }

    draw();
    raf = requestAnimationFrame(tick);
  }

  // 控制：按住按钮
  function hold(btn: HTMLButtonElement, d: number): void {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      dir = d;
      api.play("tap");
    });
    const stop = () => { if (dir === d) dir = 0; };
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointerleave", stop);
    btn.addEventListener("pointercancel", stop);
  }
  hold(leftBtn, -1);
  hold(rightBtn, 1);

  // 控制：拖动画布
  let dragging = false;
  function canvasX(e: PointerEvent): number {
    const rect = canvas.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * W;
  }
  const onPointerDown = (e: PointerEvent) => {
    dragging = true;
    basketX = Math.max(28, Math.min(W - 28, canvasX(e)));
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging) basketX = Math.max(28, Math.min(W - 28, canvasX(e)));
  };
  const onPointerUp = () => { dragging = false; };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  // 控制：键盘
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") { dir = -1; e.preventDefault(); }
    if (e.key === "ArrowRight") { dir = 1; e.preventDefault(); }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if ((e.key === "ArrowLeft" && dir === -1) || (e.key === "ArrowRight" && dir === 1)) dir = 0;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  updateTop();
  draw();
  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    destroy() {
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      wrap.remove();
    },
  };
}
