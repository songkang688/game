export const meta = {
  id: "brick-break",
  title: "碰碰砖块",
  emoji: "🧱",
  category: "casual" as const,
  color: "#FFE2D9",
  blurb: "六关砖块阵！坚固砖要敲两下，礼物砖会掉下神奇道具！",
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
const H = 440;
const PADDLE_H = 14;
const BALL_R = 8;
const COLS = 6;
const BRICK_W = 52;
const BRICK_H = 22;
const BRICK_GAP = 6;
const BRICK_TOP = 46;
const BRICK_LEFT = (W - COLS * BRICK_W - (COLS - 1) * BRICK_GAP) / 2;
const ROW_COLORS = ["#FFB3C7", "#FFD9A0", "#B8E6A6", "#A9D7FF", "#D9C2F5", "#FFE9A8"];

/**
 * 关卡布局：每行 6 个字符
 * "." 没有砖 / "n" 普通砖 / "t" 坚固砖(敲两下) / "p" 礼物砖(掉道具)
 */
interface LevelConfig {
  name: string;
  rows: string[];
  speed: number;
}

const LEVELS: LevelConfig[] = [
  { name: "彩虹墙", speed: 1.0, rows: ["nnnnnn", "nnnnnn", "nnnnnn"] },
  { name: "笑脸", speed: 1.05, rows: [".t..t.", "nnnnnn", "n....n", ".npnn.", ".nnnn."] },
  { name: "棋盘格", speed: 1.1, rows: ["ntntnt", "tntntn", "npnnpn", "tntntn"] },
  { name: "小金字塔", speed: 1.15, rows: ["..tt..", ".nppn.", "nnnnnn", "tnnnnt"] },
  { name: "小城堡", speed: 1.2, rows: ["t.tt.t", "tnnnnt", "npnnpn", "tttttt"] },
  { name: "大心心", speed: 1.25, rows: [".n..n.", "ntnntn", "ntpptn", ".nttn.", "..nn.."] },
];

interface Brick {
  x: number;
  y: number;
  hp: number;
  tough: boolean;
  gift: boolean;
}

interface Capsule {
  x: number;
  y: number;
  kind: "wide" | "slow" | "heart";
}

export function mount(api: GameApi): { destroy: () => void } {
  let destroyed = false;
  let paused = true;
  let raf = 0;
  let lastTime = 0;

  let level = 0;
  let retries = 0;
  let lives = 3;
  let launched = false;
  let paddleX = W / 2;
  let paddleW = 84;
  let wideUntil = 0;
  let slowUntil = 0;
  let dir = 0;
  let ballX = W / 2;
  let ballY = H - 60;
  let vx = 150;
  let vy = -230;
  let bricks: Brick[] = [];
  let capsules: Capsule[] = [];
  let totalBricks = 0;

  const wrap = document.createElement("div");
  wrap.className = "bb-wrap";
  wrap.innerHTML = `
    <style>
      .bb-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF0EA, #F0F4FF); border-radius: 20px; padding: 12px; max-width: 400px; margin: 0 auto; user-select: none; touch-action: none; position: relative; }
      .bb-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; }
      .bb-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #E07A5F; box-shadow: 0 2px 6px rgba(220,140,110,.25); font-size: 14px; }
      .bb-canvas { width: 100%; border-radius: 16px; display: block; background: linear-gradient(180deg, #FDF6FF, #EFF7FF); touch-action: none; }
      .bb-ctrl { display: flex; justify-content: center; gap: 24px; margin-top: 10px; }
      .bb-btn { width: 84px; height: 56px; border: none; border-radius: 18px; font-size: 26px; background: #FFC9B5; color: #8A4A30; cursor: pointer; box-shadow: 0 4px 0 #EFAA90; touch-action: none; }
      .bb-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #EFAA90; }
      .bb-msg { text-align: center; min-height: 20px; color: #E07A5F; font-weight: 700; margin-top: 8px; font-size: 14px; }
      .bb-overlay { position: absolute; inset: 0; background: rgba(255,242,238,.96); border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; z-index: 5; text-align: center; padding: 16px; }
      .bb-ov-big { font-size: 52px; }
      .bb-ov-title { font-size: 24px; font-weight: 900; color: #E07A5F; }
      .bb-ov-sub { font-size: 16px; font-weight: 700; color: #E89B85; line-height: 1.6; }
      .bb-ov-btn { border: none; border-radius: 20px; padding: 14px 40px; font-size: 20px; font-weight: 900; color: #fff; background: linear-gradient(180deg,#FF9E82,#E8714F); cursor: pointer; box-shadow: 0 5px 0 #C15335; font-family: inherit; }
      .bb-ov-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #C15335; }
    </style>
    <div class="bb-top">
      <span class="bb-badge bb-level">🚩 第 1 关</span>
      <span class="bb-badge bb-count">🧱 0 块</span>
      <span class="bb-badge bb-lives">💗💗💗</span>
    </div>
    <canvas class="bb-canvas" width="${W}" height="${H}"></canvas>
    <div class="bb-ctrl">
      <button class="bb-btn bb-left" type="button">⬅️</button>
      <button class="bb-btn bb-right" type="button">➡️</button>
    </div>
    <div class="bb-msg">点一下画面发球，按住按钮移动挡板！</div>
  `;
  api.root.appendChild(wrap);

  const canvas = wrap.querySelector(".bb-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  const levelEl = wrap.querySelector(".bb-level") as HTMLElement;
  const countEl = wrap.querySelector(".bb-count") as HTMLElement;
  const livesEl = wrap.querySelector(".bb-lives") as HTMLElement;
  const msgEl = wrap.querySelector(".bb-msg") as HTMLElement;
  const leftBtn = wrap.querySelector(".bb-left") as HTMLButtonElement;
  const rightBtn = wrap.querySelector(".bb-right") as HTMLButtonElement;

  function cfg(): LevelConfig {
    return LEVELS[level];
  }

  function buildBricks(): void {
    bricks = [];
    const rows = cfg().rows;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = rows[r][c] || ".";
        if (ch === ".") continue;
        bricks.push({
          x: BRICK_LEFT + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          hp: ch === "t" ? 2 : 1,
          tough: ch === "t",
          gift: ch === "p",
        });
      }
    }
    totalBricks = bricks.length;
  }

  function updateTop(): void {
    levelEl.textContent = `🚩 第 ${level + 1} 关 ${cfg().name}`;
    countEl.textContent = `🧱 剩 ${bricks.length} / ${totalBricks} 块`;
    livesEl.textContent = "💗".repeat(lives) + "🤍".repeat(Math.max(0, 3 - lives));
  }

  function resetBall(): void {
    launched = false;
    ballX = paddleX;
    ballY = H - PADDLE_H - 20 - BALL_R;
    const s = cfg().speed;
    vx = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 60) * s;
    vy = -230 * s;
  }

  function speedScale(): number {
    return Date.now() < slowUntil ? 0.72 : 1;
  }

  function draw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (const b of bricks) {
      const row = Math.round((b.y - BRICK_TOP) / (BRICK_H + BRICK_GAP));
      ctx.fillStyle = b.tough ? (b.hp === 2 ? "#B58BA8" : "#D5AFC9") : ROW_COLORS[row % ROW_COLORS.length];
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, BRICK_W, BRICK_H, 7);
      ctx.fill();
      if (b.gift) {
        ctx.font = "15px serif";
        ctx.textAlign = "center";
        ctx.fillText("🎁", b.x + BRICK_W / 2, b.y + BRICK_H - 5);
        ctx.textAlign = "left";
      } else if (b.tough && b.hp === 1) {
        ctx.strokeStyle = "#7A5A6E";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(b.x + 12, b.y + 4);
        ctx.lineTo(b.x + 24, b.y + 12);
        ctx.lineTo(b.x + 18, b.y + 18);
        ctx.stroke();
      }
    }
    // 道具胶囊
    ctx.font = "20px serif";
    ctx.textAlign = "center";
    for (const c of capsules) {
      ctx.fillText(c.kind === "wide" ? "🍬" : c.kind === "slow" ? "🐢" : "💗", c.x, c.y);
    }
    ctx.textAlign = "left";
    // 挡板
    ctx.fillStyle = Date.now() < wideUntil ? "#B586E8" : "#F49FB6";
    ctx.beginPath();
    ctx.roundRect(paddleX - paddleW / 2, H - PADDLE_H - 20, paddleW, PADDLE_H, 8);
    ctx.fill();
    // 小球
    ctx.fillStyle = "#FFD86E";
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7A5A1E";
    ctx.beginPath();
    ctx.arc(ballX - 3, ballY - 2, 1.4, 0, Math.PI * 2);
    ctx.arc(ballX + 3, ballY - 2, 1.4, 0, Math.PI * 2);
    ctx.fill();
    if (!launched && !paused) {
      ctx.fillStyle = "#B98BC9";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("点一下发球！", W / 2, H - 70);
      ctx.textAlign = "left";
    }
  }

  function showOverlay(kind: "next" | "retry"): void {
    paused = true;
    cancelAnimationFrame(raf);
    const ov = document.createElement("div");
    ov.className = "bb-overlay";
    if (kind === "next") {
      ov.innerHTML = `
        <div class="bb-ov-big">🎉</div>
        <div class="bb-ov-title">${cfg().name} 通关！</div>
        <div class="bb-ov-sub">还剩 ${lives} 颗爱心，下一关砖块更调皮～</div>
        <button class="bb-ov-btn" type="button">下一关 ▶</button>`;
      (ov.querySelector(".bb-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("jump");
        ov.remove();
        level++;
        startLevel();
      });
    } else {
      ov.innerHTML = `
        <div class="bb-ov-big">🌧️</div>
        <div class="bb-ov-title">小球溜走了</div>
        <div class="bb-ov-sub">还差 ${bricks.length} 块砖，这一关再挑战一次！</div>
        <button class="bb-ov-btn" type="button">🔁 重试本关</button>`;
      (ov.querySelector(".bb-ov-btn") as HTMLButtonElement).addEventListener("click", () => {
        api.play("tap");
        ov.remove();
        retries++;
        startLevel();
      });
    }
    wrap.appendChild(ov);
  }

  function levelClear(): void {
    api.play("win");
    if (level >= LEVELS.length - 1) {
      paused = true;
      cancelAnimationFrame(raf);
      msgEl.textContent = "🎉 六关砖块全部敲开！";
      const stars: 1 | 2 | 3 = retries === 0 ? 3 : retries <= 2 ? 2 : 1;
      api.onWin(stars, `六个砖块阵全部通关，弹球小高手！`);
    } else {
      msgEl.textContent = "🎉 这一关全敲开啦！";
      showOverlay("next");
    }
  }

  function dropCapsule(x: number, y: number): void {
    const kinds: Capsule["kind"][] = ["wide", "slow", "heart"];
    capsules.push({ x, y, kind: kinds[Math.floor(Math.random() * kinds.length)] });
  }

  function applyCapsule(kind: Capsule["kind"]): void {
    if (kind === "wide") {
      wideUntil = Date.now() + 10000;
      paddleW = 122;
      msgEl.textContent = "🍬 挡板变长啦（10 秒）！";
    } else if (kind === "slow") {
      slowUntil = Date.now() + 6000;
      msgEl.textContent = "🐢 小球慢下来啦（6 秒）！";
    } else {
      if (lives < 5) lives++;
      msgEl.textContent = "💗 多了一颗爱心！";
      updateTop();
    }
    api.play("coin");
  }

  function tick(now: number): void {
    if (destroyed || paused) return;
    const dt = Math.min(0.04, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    if (Date.now() >= wideUntil && paddleW !== 84) paddleW = 84;

    paddleX += dir * 300 * dt;
    paddleX = Math.max(paddleW / 2, Math.min(W - paddleW / 2, paddleX));

    if (!launched) {
      ballX = paddleX;
      ballY = H - PADDLE_H - 20 - BALL_R;
    } else {
      const sc = speedScale();
      ballX += vx * dt * sc;
      ballY += vy * dt * sc;

      if (ballX < BALL_R) { ballX = BALL_R; vx = Math.abs(vx); api.play("tap"); }
      if (ballX > W - BALL_R) { ballX = W - BALL_R; vx = -Math.abs(vx); api.play("tap"); }
      if (ballY < BALL_R) { ballY = BALL_R; vy = Math.abs(vy); api.play("tap"); }

      const py = H - PADDLE_H - 20;
      if (vy > 0 && ballY + BALL_R >= py && ballY + BALL_R <= py + PADDLE_H + 6 &&
          ballX > paddleX - paddleW / 2 - BALL_R && ballX < paddleX + paddleW / 2 + BALL_R) {
        vy = -Math.abs(vy);
        const offset = (ballX - paddleX) / (paddleW / 2);
        vx = offset * 220 * cfg().speed;
        api.play("jump");
      }

      for (let i = 0; i < bricks.length; i++) {
        const b = bricks[i];
        if (ballX + BALL_R > b.x && ballX - BALL_R < b.x + BRICK_W &&
            ballY + BALL_R > b.y && ballY - BALL_R < b.y + BRICK_H) {
          const fromLeft = Math.abs(ballX - b.x);
          const fromRight = Math.abs(b.x + BRICK_W - ballX);
          const fromTop = Math.abs(ballY - b.y);
          const fromBottom = Math.abs(b.y + BRICK_H - ballY);
          const m = Math.min(fromLeft, fromRight, fromTop, fromBottom);
          if (m === fromTop || m === fromBottom) vy = -vy;
          else vx = -vx;
          b.hp--;
          if (b.hp <= 0) {
            api.play("pop");
            if (b.gift) dropCapsule(b.x + BRICK_W / 2, b.y + BRICK_H);
            bricks.splice(i, 1);
            updateTop();
            if (bricks.length === 0) {
              draw();
              levelClear();
              return;
            }
          } else {
            api.play("tap");
            msgEl.textContent = "坚固砖出现裂缝，再敲一下！";
          }
          break;
        }
      }

      // 道具下落
      for (let i = capsules.length - 1; i >= 0; i--) {
        const c = capsules[i];
        c.y += 120 * dt;
        if (c.y >= py - 4 && c.y <= py + PADDLE_H + 12 &&
            c.x > paddleX - paddleW / 2 - 12 && c.x < paddleX + paddleW / 2 + 12) {
          capsules.splice(i, 1);
          applyCapsule(c.kind);
        } else if (c.y > H + 20) {
          capsules.splice(i, 1);
        }
      }

      if (ballY > H + BALL_R) {
        lives--;
        updateTop();
        if (lives <= 0) {
          showOverlay("retry");
          return;
        }
        api.play("oops");
        msgEl.textContent = "没关系，再发一球！";
        resetBall();
      }
    }

    draw();
    raf = requestAnimationFrame(tick);
  }

  function startLevel(): void {
    lives = 3;
    capsules = [];
    paddleW = 84;
    wideUntil = 0;
    slowUntil = 0;
    paddleX = W / 2;
    buildBricks();
    resetBall();
    updateTop();
    msgEl.textContent = level === 0
      ? "点一下画面发球，按住按钮移动挡板！"
      : `${cfg().name}：紫色坚固砖要敲两下，🎁 礼物砖会掉道具！`;
    paused = false;
    lastTime = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame((t) => {
      lastTime = t;
      raf = requestAnimationFrame(tick);
    });
  }

  function hold(btn: HTMLButtonElement, d: number): void {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      dir = d;
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
    paddleX = Math.max(paddleW / 2, Math.min(W - paddleW / 2, canvasX(e)));
    if (!launched && !paused) {
      launched = true;
      api.play("jump");
      msgEl.textContent = "小球出发！瞄准砖块～";
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging) paddleX = Math.max(paddleW / 2, Math.min(W - paddleW / 2, canvasX(e)));
  };
  const onPointerUp = () => { dragging = false; };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") { dir = -1; e.preventDefault(); }
    else if (e.key === "ArrowRight") { dir = 1; e.preventDefault(); }
    else if (e.key === " " && !launched && !paused) { launched = true; api.play("jump"); e.preventDefault(); }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if ((e.key === "ArrowLeft" && dir === -1) || (e.key === "ArrowRight" && dir === 1)) dir = 0;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  startLevel();

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
