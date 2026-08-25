export const meta = {
  id: "fruit-catch",
  title: "接住小水果",
  emoji: "🧺",
  category: "casual" as const,
  color: "#FFF4D6",
  blurb: "五关水果雨！小心捣蛋炸弹，金星星一颗顶两颗！",
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
const FRUITS = ["🍎", "🍌", "🍓", "🍇", "🍑", "🍊"];

interface Falling {
  x: number;
  y: number;
  vy: number;
  emoji: string;
  kind: "fruit" | "gold" | "bomb";
}

interface LevelConfig {
  target: number;
  speed: number;
  spawnMs: number;
  bombChance: number;
}

const LEVELS: LevelConfig[] = [
  { target: 10, speed: 1.0, spawnMs: 1100, bombChance: 0 },
  { target: 12, speed: 1.15, spawnMs: 1000, bombChance: 0.1 },
  { target: 14, speed: 1.3, spawnMs: 900, bombChance: 0.14 },
  { target: 16, speed: 1.45, spawnMs: 820, bombChance: 0.18 },
  { target: 18, speed: 1.6, spawnMs: 750, bombChance: 0.22 },
];

const MAX_MISS = 3;

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let paused = true;
  let raf = 0;
  let lastTime = 0;
  let spawnTimer = 0;

  let level = 0;
  let retries = 0;
  let caught = 0;
  let missed = 0;
  let dir = 0;
  let basketX = W / 2;
  const items: Falling[] = [];

  const wrap = document.createElement("div");
  wrap.className = "fc-wrap";
  wrap.innerHTML = `
    <style>
      .fc-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF9E8, #FFEFEF); border-radius: 20px; padding: 12px; max-width: 400px; margin: 0 auto; user-select: none; touch-action: none; position: relative; }
      .fc-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; }
      .fc-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #D08A3E; box-shadow: 0 2px 6px rgba(220,170,100,.25); font-size: 14px; }
      .fc-bar { height: 10px; background: #fff; border-radius: 8px; overflow: hidden; margin-bottom: 8px; box-shadow: inset 0 1px 3px rgba(0,0,0,.08); }
      .fc-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #FFD26E, #FF9E5E); border-radius: 8px; transition: width .3s; }
      .fc-canvas { width: 100%; border-radius: 16px; display: block; background: linear-gradient(180deg, #CDEBFF 0%, #EAF8E6 100%); touch-action: none; }
      .fc-ctrl { display: flex; justify-content: center; gap: 24px; margin-top: 10px; }
      .fc-btn { width: 84px; height: 56px; border: none; border-radius: 18px; font-size: 26px; background: #FFD9A0; color: #8A5A20; cursor: pointer; box-shadow: 0 4px 0 #EBBB77; touch-action: none; }
      .fc-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #EBBB77; }
      .fc-msg { text-align: center; min-height: 20px; color: #D08A3E; font-weight: 700; margin-top: 8px; font-size: 14px; }
      .fc-overlay { position: absolute; inset: 0; background: rgba(255,250,238,.96); border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; z-index: 5; text-align: center; padding: 16px; }
      .fc-ov-big { font-size: 52px; }
      .fc-ov-title { font-size: 24px; font-weight: 900; color: #D08A3E; }
      .fc-ov-sub { font-size: 16px; font-weight: 700; color: #D9A05E; line-height: 1.6; }
      .fc-ov-btn { border: none; border-radius: 20px; padding: 14px 40px; font-size: 20px; font-weight: 900; color: #fff; background: linear-gradient(180deg,#FFC46E,#F49A3E); cursor: pointer; box-shadow: 0 5px 0 #C97B28; font-family: inherit; }
      .fc-ov-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #C97B28; }
    </style>
    <div class="fc-top">
      <span class="fc-badge fc-level">🚩 第 1 关</span>
      <span class="fc-badge fc-score">🧺 0 / 10</span>
      <span class="fc-badge fc-miss">💗💗💗</span>
    </div>
    <div class="fc-bar"><div class="fc-fill"></div></div>
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
  const levelEl = wrap.querySelector(".fc-level") as HTMLElement;
  const scoreEl = wrap.querySelector(".fc-score") as HTMLElement;
  const missEl = wrap.querySelector(".fc-miss") as HTMLElement;
  const fillEl = wrap.querySelector(".fc-fill") as HTMLElement;
  const msgEl = wrap.querySelector(".fc-msg") as HTMLElement;
  const leftBtn = wrap.querySelector(".fc-left") as HTMLButtonElement;
  const rightBtn = wrap.querySelector(".fc-right") as HTMLButtonElement;

  function cfg(): LevelConfig {
    return LEVELS[level];
  }

  function updateTop(): void {
    levelEl.textContent = `🚩 第 ${level + 1} 关`;
    scoreEl.textContent = `🧺 ${caught} / ${cfg().target}`;
    missEl.textContent = "💗".repeat(Math.max(0, MAX_MISS - missed)) + "🤍".repeat(Math.min(MAX_MISS, missed));
    fillEl.style.width = `${Math.min(100, (caught / cfg().target) * 100)}%`;
  }

  function setupLevel(): void {
    caught = 0;
    missed = 0;
    items.length = 0;
    basketX = W / 2;
    spawnTimer = 0.4;
    paused = false;
    updateTop();
    const c = cfg();
    msgEl.textContent = c.bombChance > 0
      ? "小心！💣 炸弹不要接，🌟 金星星一颗顶两颗！"
      : "接住水果装满篮子吧！";
    lastTime = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame((t) => {
      lastTime = t;
      raf = requestAnimationFrame(tick);
    });
  }

  function spawnItem(): void {
    const c = cfg();
    const r = Math.random();
    let kind: Falling["kind"] = "fruit";
    if (r < c.bombChance) kind = "bomb";
    else if (r < c.bombChance + 0.1) kind = "gold";
    items.push({
      x: 30 + Math.random() * (W - 60),
      y: -20,
      vy: (90 + Math.random() * 60 + caught * 3) * c.speed,
      emoji: kind === "bomb" ? "💣" : kind === "gold" ? "🌟" : FRUITS[Math.floor(Math.random() * FRUITS.length)],
      kind,
    });
  }

  function draw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.font = "26px serif";
    ctx.fillText("☁️", 40, 50);
    ctx.fillText("☁️", 250, 90);
    ctx.fillText("🌈", 150, 60);
    ctx.font = "30px serif";
    ctx.textAlign = "center";
    for (const f of items) {
      ctx.fillText(f.emoji, f.x, f.y);
    }
    ctx.font = "44px serif";
    ctx.fillText("🧺", basketX, H - 18);
    ctx.textAlign = "left";
  }

  function showOverlay(kind: "next" | "retry"): void {
    paused = true;
    cancelAnimationFrame(raf);
    const ov = document.createElement("div");
    ov.className = "fc-overlay";
    if (kind === "next") {
      ov.innerHTML = `
        <div class="fc-ov-big">🎉</div>
        <div class="fc-ov-title">第 ${level + 1} 关的篮子装满啦！</div>
        <div class="fc-ov-sub">下一关水果掉得更快，准备好了吗？</div>
        <button class="fc-ov-btn" type="button">下一关 ▶</button>`;
      (ov.querySelector(".fc-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("jump");
        ov.remove();
        level++;
        setupLevel();
      });
    } else {
      ov.innerHTML = `
        <div class="fc-ov-big">🌧️</div>
        <div class="fc-ov-title">哎呀，爱心用完了</div>
        <div class="fc-ov-sub">刚才接到 ${caught} 个，这一关再试一次吧！</div>
        <button class="fc-ov-btn" type="button">🔁 重试本关</button>`;
      (ov.querySelector(".fc-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("tap");
        ov.remove();
        retries++;
        setupLevel();
      });
    }
    wrap.appendChild(ov);
  }

  function levelClear(): void {
    api.play("win");
    if (level >= LEVELS.length - 1) {
      paused = true;
      cancelAnimationFrame(raf);
      msgEl.textContent = "🎉 五关全部通过！";
      const stars: 1 | 2 | 3 = retries === 0 ? 3 : retries <= 2 ? 2 : 1;
      api.onWin(stars, `五关水果雨全部接住，果篮小达人！`);
    } else {
      msgEl.textContent = "🎉 这一关装满啦！";
      showOverlay("next");
    }
  }

  function tick(now: number): void {
    if (destroyed || paused) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    basketX += dir * 260 * dt;
    basketX = Math.max(28, Math.min(W - 28, basketX));

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnItem();
      spawnTimer = Math.max(0.5, cfg().spawnMs / 1000 - caught * 0.02);
    }

    for (let i = items.length - 1; i >= 0; i--) {
      const f = items[i];
      f.y += f.vy * dt;
      if (f.y >= H - 34 && f.y <= H - 6 && Math.abs(f.x - basketX) < 34) {
        items.splice(i, 1);
        if (f.kind === "bomb") {
          missed++;
          api.play("oops");
          msgEl.textContent = "💥 炸弹进篮子啦，快躲开它们！";
          updateTop();
          if (missed >= MAX_MISS) {
            draw();
            showOverlay("retry");
            return;
          }
        } else if (f.kind === "gold") {
          api.play("coin");
          caught += 2;
          msgEl.textContent = "🌟 金星星一颗顶两颗！";
          updateTop();
          if (caught >= cfg().target) { draw(); levelClear(); return; }
        } else {
          api.play("pop");
          caught++;
          updateTop();
          if (caught >= cfg().target) { draw(); levelClear(); return; }
        }
      } else if (f.y > H + 20) {
        items.splice(i, 1);
        if (f.kind === "fruit") {
          missed++;
          api.play("oops");
          updateTop();
          if (missed >= MAX_MISS) {
            draw();
            showOverlay("retry");
            return;
          }
        }
      }
    }

    draw();
    raf = requestAnimationFrame(tick);
  }

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

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") { dir = -1; e.preventDefault(); }
    if (e.key === "ArrowRight") { dir = 1; e.preventDefault(); }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if ((e.key === "ArrowLeft" && dir === -1) || (e.key === "ArrowRight" && dir === 1)) dir = 0;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  draw();
  setupLevel();

  return {
    destroy() {
      destroyed = true;
      paused = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      wrap.remove();
    },
  };
}
