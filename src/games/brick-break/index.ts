export const meta = {
  id: "brick-break",
  title: "碰碰砖块",
  emoji: "🧱",
  category: "casual" as const,
  color: "#FFE2D9",
  blurb: "小球弹呀弹，用挡板接住它，把彩虹砖块全敲开！",
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
const PADDLE_W = 84;
const PADDLE_H = 14;
const BALL_R = 8;
const COLS = 6;
const ROWS = 4;
const BRICK_W = 52;
const BRICK_H = 22;
const BRICK_GAP = 6;
const BRICK_TOP = 50;
const BRICK_LEFT = (W - COLS * BRICK_W - (COLS - 1) * BRICK_GAP) / 2;
const ROW_COLORS = ["#FFB3C7", "#FFD9A0", "#B8E6A6", "#A9D7FF"];

export function mount(api: GameApi): { destroy: () => void } {
  let finished = false;
  let raf = 0;
  let lastTime = 0;
  let lives = 3;
  let launched = false;
  let paddleX = W / 2;
  let dir = 0;
  let ballX = W / 2;
  let ballY = H - 60;
  let vx = 150;
  let vy = -230;
  const bricks: boolean[] = new Array(COLS * ROWS).fill(true);

  const wrap = document.createElement("div");
  wrap.className = "bb-wrap";
  wrap.innerHTML = `
    <style>
      .bb-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFF0EA, #F0F4FF); border-radius: 20px; padding: 12px; max-width: 400px; margin: 0 auto; user-select: none; touch-action: none; }
      .bb-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
      .bb-badge { background: #fff; border-radius: 14px; padding: 6px 12px; font-weight: 700; color: #E07A5F; box-shadow: 0 2px 6px rgba(220,140,110,.25); font-size: 15px; }
      .bb-canvas { width: 100%; border-radius: 16px; display: block; background: linear-gradient(180deg, #FDF6FF, #EFF7FF); touch-action: none; }
      .bb-ctrl { display: flex; justify-content: center; gap: 24px; margin-top: 10px; }
      .bb-btn { width: 84px; height: 56px; border: none; border-radius: 18px; font-size: 26px; background: #FFC9B5; color: #8A4A30; cursor: pointer; box-shadow: 0 4px 0 #EFAA90; touch-action: none; }
      .bb-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #EFAA90; }
      .bb-msg { text-align: center; min-height: 20px; color: #E07A5F; font-weight: 700; margin-top: 8px; font-size: 14px; }
    </style>
    <div class="bb-top">
      <span class="bb-badge bb-count">🧱 剩 ${COLS * ROWS} 块</span>
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
  const countEl = wrap.querySelector(".bb-count") as HTMLElement;
  const livesEl = wrap.querySelector(".bb-lives") as HTMLElement;
  const msgEl = wrap.querySelector(".bb-msg") as HTMLElement;
  const leftBtn = wrap.querySelector(".bb-left") as HTMLButtonElement;
  const rightBtn = wrap.querySelector(".bb-right") as HTMLButtonElement;

  function bricksLeft(): number {
    return bricks.filter(Boolean).length;
  }

  function updateTop(): void {
    countEl.textContent = `🧱 剩 ${bricksLeft()} 块`;
    livesEl.textContent = "💗".repeat(lives) + "🤍".repeat(3 - lives);
  }

  function resetBall(): void {
    launched = false;
    ballX = paddleX;
    ballY = H - PADDLE_H - 20 - BALL_R;
    vx = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 60);
    vy = -230;
  }

  function draw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    // 砖块
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!bricks[r * COLS + c]) continue;
        const x = BRICK_LEFT + c * (BRICK_W + BRICK_GAP);
        const y = BRICK_TOP + r * (BRICK_H + BRICK_GAP);
        ctx.fillStyle = ROW_COLORS[r % ROW_COLORS.length];
        ctx.beginPath();
        ctx.roundRect(x, y, BRICK_W, BRICK_H, 7);
        ctx.fill();
      }
    }
    // 挡板
    ctx.fillStyle = "#F49FB6";
    ctx.beginPath();
    ctx.roundRect(paddleX - PADDLE_W / 2, H - PADDLE_H - 20, PADDLE_W, PADDLE_H, 8);
    ctx.fill();
    // 小球（毛球脸）
    ctx.fillStyle = "#FFD86E";
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7A5A1E";
    ctx.beginPath();
    ctx.arc(ballX - 3, ballY - 2, 1.4, 0, Math.PI * 2);
    ctx.arc(ballX + 3, ballY - 2, 1.4, 0, Math.PI * 2);
    ctx.fill();
    if (!launched && !finished) {
      ctx.fillStyle = "#B98BC9";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("点一下发球！", W / 2, H - 70);
      ctx.textAlign = "left";
    }
  }

  function endGame(win: boolean): void {
    if (finished) return;
    finished = true;
    if (win) {
      const stars: 1 | 2 | 3 = lives >= 3 ? 3 : lives === 2 ? 2 : 1;
      api.play("win");
      msgEl.textContent = "🎉 砖块全部敲开啦！";
      api.onWin(stars, `还剩 ${lives} 颗爱心，弹球小高手！`);
    } else {
      api.play("oops");
      msgEl.textContent = "小球溜走了，再来挑战一次！";
      api.onLose(`还差 ${bricksLeft()} 块砖，下次一定能全敲开！`);
    }
  }

  function tick(now: number): void {
    if (finished) return;
    const dt = Math.min(0.04, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    paddleX += dir * 300 * dt;
    paddleX = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, paddleX));

    if (!launched) {
      ballX = paddleX;
      ballY = H - PADDLE_H - 20 - BALL_R;
    } else {
      ballX += vx * dt;
      ballY += vy * dt;

      if (ballX < BALL_R) { ballX = BALL_R; vx = Math.abs(vx); api.play("tap"); }
      if (ballX > W - BALL_R) { ballX = W - BALL_R; vx = -Math.abs(vx); api.play("tap"); }
      if (ballY < BALL_R) { ballY = BALL_R; vy = Math.abs(vy); api.play("tap"); }

      // 挡板
      const py = H - PADDLE_H - 20;
      if (vy > 0 && ballY + BALL_R >= py && ballY + BALL_R <= py + PADDLE_H + 6 &&
          ballX > paddleX - PADDLE_W / 2 - BALL_R && ballX < paddleX + PADDLE_W / 2 + BALL_R) {
        vy = -Math.abs(vy);
        const offset = (ballX - paddleX) / (PADDLE_W / 2);
        vx = offset * 220;
        api.play("jump");
      }

      // 砖块
      for (let i = 0; i < bricks.length; i++) {
        if (!bricks[i]) continue;
        const r = Math.floor(i / COLS), c = i % COLS;
        const bx = BRICK_LEFT + c * (BRICK_W + BRICK_GAP);
        const by = BRICK_TOP + r * (BRICK_H + BRICK_GAP);
        if (ballX + BALL_R > bx && ballX - BALL_R < bx + BRICK_W &&
            ballY + BALL_R > by && ballY - BALL_R < by + BRICK_H) {
          bricks[i] = false;
          api.play("pop");
          // 判断从哪边撞的
          const fromLeft = Math.abs(ballX - bx);
          const fromRight = Math.abs(bx + BRICK_W - ballX);
          const fromTop = Math.abs(ballY - by);
          const fromBottom = Math.abs(by + BRICK_H - ballY);
          const m = Math.min(fromLeft, fromRight, fromTop, fromBottom);
          if (m === fromTop || m === fromBottom) vy = -vy;
          else vx = -vx;
          updateTop();
          if (bricksLeft() === 0) {
            draw();
            endGame(true);
            return;
          }
          break;
        }
      }

      // 掉落
      if (ballY > H + BALL_R) {
        lives--;
        updateTop();
        if (lives <= 0) {
          endGame(false);
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
    paddleX = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, canvasX(e)));
    if (!launched && !finished) {
      launched = true;
      api.play("jump");
      msgEl.textContent = "小球出发！瞄准砖块～";
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging) paddleX = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, canvasX(e)));
  };
  const onPointerUp = () => { dragging = false; };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") { dir = -1; e.preventDefault(); }
    else if (e.key === "ArrowRight") { dir = 1; e.preventDefault(); }
    else if (e.key === " " && !launched && !finished) { launched = true; api.play("jump"); e.preventDefault(); }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if ((e.key === "ArrowLeft" && dir === -1) || (e.key === "ArrowRight" && dir === 1)) dir = 0;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  updateTop();
  resetBall();
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
