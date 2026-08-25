import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, COLS, LEVELS, type BrickLevel } from "./levels";

export const meta = {
  id: "brick-break",
  title: "碰碰砖块",
  emoji: "🧱",
  category: "casual" as const,
  color: "#FFE2D9",
  blurb: "99 关六大砖阵！金字塔、钻石阵、钢铁堡垒，弹球全打碎！",
};

const W = 360;
const H = 430;
const BRICK_H = 18;
const BRICK_TOP = 42;
const PADDLE_H = 12;
const BALL_R = 7;

const BRICK_COLORS = ["#FF9EC8", "#FFD26E", "#9FE08D", "#8FCBFF", "#C9A0F0", "#FFB48A"];
const STEEL_COLOR = "#9AA0AE";
const STEEL_HIT_COLOR = "#C4C9D4";

const CSS = `
.bb-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFEFE4, #F3EDFF); border-radius: 16px; padding: 12px; user-select: none; touch-action: none; position: relative; }
.bb-top { display: flex; justify-content: space-between; margin-bottom: 8px; gap: 6px; }
.bb-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #C97B5A; box-shadow: 0 2px 6px rgba(210,140,110,.25); font-size: 14px; }
.bb-canvas { width: 100%; border-radius: 16px; display: block; background: linear-gradient(180deg, #FDF8F0, #F4EFFB); touch-action: none; }
.bb-ctrl { display: flex; justify-content: center; gap: 24px; margin-top: 10px; }
.bb-btn { width: 84px; height: 56px; border: none; border-radius: 18px; font-size: 26px; background: #FFC9AE; color: #8A4A20; cursor: pointer; box-shadow: 0 4px 0 #EBA987; touch-action: none; }
.bb-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #EBA987; }
.bb-msg { text-align: center; min-height: 20px; color: #C97B5A; font-weight: 700; margin-top: 8px; font-size: 14px; }
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: BrickLevel = LEVELS[ctx.level];
  let destroyed = false;
  let ended = false;
  let running = false;
  let raf = 0;
  let lastTime = 0;
  let lives = 3;
  let dir = 0;
  let paddleX = W / 2;
  let ballX = W / 2;
  let ballY = H - 60;
  let vx = 0;
  let vy = 0;

  const brickW = W / COLS;
  // hp 矩阵（复制布局，2=钢砖打两下）
  const hp: number[][] = cfg.layout.map((row) => row.slice());
  let bricksLeft = hp.flat().filter((v) => v > 0).length;
  const totalBricks = bricksLeft;

  const wrap = document.createElement("div");
  wrap.className = "bb-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="bb-top">
      <span class="bb-badge bb-bricks">🧱 ${bricksLeft}</span>
      <span class="bb-badge bb-life">💗💗💗</span>
    </div>
    <canvas class="bb-canvas" width="${W}" height="${H}"></canvas>
    <div class="bb-ctrl">
      <button class="bb-btn bb-left" type="button">⬅️</button>
      <button class="bb-btn bb-right" type="button">➡️</button>
    </div>
    <div class="bb-msg">点一下画面发球！灰色钢砖要打两下～</div>
  `;
  stage.appendChild(wrap);

  const canvas = wrap.querySelector(".bb-canvas") as HTMLCanvasElement;
  const c2d = canvas.getContext("2d");
  const bricksEl = wrap.querySelector(".bb-bricks") as HTMLElement;
  const lifeEl = wrap.querySelector(".bb-life") as HTMLElement;
  const msgEl = wrap.querySelector(".bb-msg") as HTMLElement;
  const leftBtn = wrap.querySelector(".bb-left") as HTMLButtonElement;
  const rightBtn = wrap.querySelector(".bb-right") as HTMLButtonElement;

  function renderTop(): void {
    bricksEl.textContent = `🧱 ${bricksLeft}`;
    lifeEl.textContent = "💗".repeat(Math.max(0, lives)) + "🤍".repeat(Math.max(0, 3 - lives));
  }

  function resetBall(): void {
    running = false;
    ballX = paddleX;
    ballY = H - 40;
    vx = 0;
    vy = 0;
  }

  function launch(): void {
    if (running || ended) return;
    running = true;
    const angle = (-55 - Math.random() * 60) * (Math.PI / 180);
    vx = Math.cos(angle) * cfg.ballSpeed;
    vy = Math.sin(angle) * cfg.ballSpeed;
    ctx.sfx("jump");
    msgEl.textContent = "";
  }

  function draw(): void {
    if (!c2d) return;
    c2d.clearRect(0, 0, W, H);
    for (let r = 0; r < hp.length; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = hp[r][c];
        if (v <= 0) continue;
        const orig = cfg.layout[r][c];
        c2d.fillStyle = orig === 2 ? (v === 2 ? STEEL_COLOR : STEEL_HIT_COLOR) : BRICK_COLORS[(r + c) % BRICK_COLORS.length];
        c2d.beginPath();
        c2d.roundRect(c * brickW + 2, BRICK_TOP + r * BRICK_H + 2, brickW - 4, BRICK_H - 4, 5);
        c2d.fill();
      }
    }
    c2d.fillStyle = "#8A6BD0";
    c2d.beginPath();
    c2d.roundRect(paddleX - cfg.paddleW / 2, H - 24, cfg.paddleW, PADDLE_H, 6);
    c2d.fill();
    c2d.fillStyle = "#FF6B9E";
    c2d.beginPath();
    c2d.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
    c2d.fill();
  }

  function finish(won: boolean): void {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    if (won) {
      const got = lives >= 3 ? 3 : lives === 2 ? 2 : 1;
      setTimeout(() => { if (!destroyed) ctx.win(got as 1 | 2 | 3, `${totalBricks} 块砖全部打碎，爱心还剩 ${lives} 颗！`); }, 350);
    } else {
      setTimeout(() => { if (!destroyed) ctx.lose("球溜走三次啦，球拍早点移过去接住它！"); }, 350);
    }
  }

  function hitBrick(r: number, c: number): void {
    hp[r][c]--;
    if (hp[r][c] <= 0) {
      bricksLeft--;
      ctx.sfx("pop");
    } else {
      ctx.sfx("tap");
    }
    renderTop();
    if (bricksLeft <= 0) finish(true);
  }

  function tick(now: number): void {
    if (destroyed || ended) return;
    const dt = Math.min(0.03, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    paddleX += dir * 300 * dt;
    paddleX = Math.max(cfg.paddleW / 2, Math.min(W - cfg.paddleW / 2, paddleX));
    if (!running) {
      ballX = paddleX;
    } else {
      ballX += vx * dt;
      ballY += vy * dt;

      if (ballX < BALL_R) { ballX = BALL_R; vx = Math.abs(vx); }
      if (ballX > W - BALL_R) { ballX = W - BALL_R; vx = -Math.abs(vx); }
      if (ballY < BALL_R) { ballY = BALL_R; vy = Math.abs(vy); }

      // 球拍
      if (vy > 0 && ballY >= H - 24 - BALL_R && ballY <= H - 24 + PADDLE_H && Math.abs(ballX - paddleX) <= cfg.paddleW / 2 + BALL_R) {
        vy = -Math.abs(vy);
        const off = (ballX - paddleX) / (cfg.paddleW / 2);
        vx = off * cfg.ballSpeed * 0.85;
        const speed = Math.hypot(vx, vy);
        vx = (vx / speed) * cfg.ballSpeed;
        vy = (vy / speed) * cfg.ballSpeed;
        ctx.sfx("tap");
      }

      // 砖块
      const r = Math.floor((ballY - BRICK_TOP) / BRICK_H);
      const c = Math.floor(ballX / brickW);
      if (r >= 0 && r < hp.length && c >= 0 && c < COLS && hp[r][c] > 0) {
        const brickCx = c * brickW + brickW / 2;
        const brickCy = BRICK_TOP + r * BRICK_H + BRICK_H / 2;
        const dx = (ballX - brickCx) / brickW;
        const dy2 = (ballY - brickCy) / BRICK_H;
        if (Math.abs(dx) > Math.abs(dy2)) vx = dx > 0 ? Math.abs(vx) : -Math.abs(vx);
        else vy = dy2 > 0 ? Math.abs(vy) : -Math.abs(vy);
        hitBrick(r, c);
      }

      // 掉落
      if (ballY > H + BALL_R) {
        lives--;
        renderTop();
        ctx.sfx("oops");
        if (lives <= 0) {
          finish(false);
          return;
        }
        msgEl.textContent = "球溜走了，点画面再发一次！";
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
      launch();
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
    paddleX = Math.max(cfg.paddleW / 2, Math.min(W - cfg.paddleW / 2, canvasX(e)));
    launch();
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging) paddleX = Math.max(cfg.paddleW / 2, Math.min(W - cfg.paddleW / 2, canvasX(e)));
  };
  const onPointerUp = () => { dragging = false; };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") { dir = -1; e.preventDefault(); }
    if (e.key === "ArrowRight") { dir = 1; e.preventDefault(); }
    if (e.key === " ") { launch(); e.preventDefault(); }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if ((e.key === "ArrowLeft" && dir === -1) || (e.key === "ArrowRight" && dir === 1)) dir = 0;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  resetBall();
  renderTop();
  draw();
  raf = requestAnimationFrame((t) => {
    lastTime = t;
    raf = requestAnimationFrame(tick);
  });

  return {
    destroy() {
      destroyed = true;
      ended = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      wrap.remove();
    },
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,
    mapHint: "一颗爱心都不丢就是 3 星！",
    grandMessage: "99 座砖阵全部打穿，弹球小勇士！",
  });
}
