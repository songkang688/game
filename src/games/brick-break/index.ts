import { meta } from "./meta";
export { meta };

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, COLS, LEVELS, portalCells, type BrickLevel } from "./levels";

const W = 360;
const H = 430;
const BRICK_H = 18;
const BRICK_TOP = 42;
const PADDLE_H = 12;
const BALL_R = 7;
/** 星门传送后的冷却（秒），防止球在两扇门之间来回抖 */
const PORTAL_COOLDOWN = 0.4;

const BRICK_COLORS = ["#FF9EC8", "#FFD26E", "#9FE08D", "#8FCBFF", "#C9A0F0", "#FFB48A"];
const STEEL_COLOR = "#9AA0AE";
const STEEL_HIT_COLOR = "#C4C9D4";
const PATTERN_COLOR = "#FFC53D";
const PORTAL_COLOR = "#7B6CD9";

/** 冒烟脚本才需要逐帧状态镜像，正常游玩不写 DOM 属性 */
const SMOKE = typeof location !== "undefined" && /[?&]smoke=1/.test(location.search);

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 传送冷却剩余秒数 */
  portalCd: number;
}

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
  const ballCount = cfg.balls ?? 1;
  const isPattern = cfg.goal === "pattern";
  const portals = portalCells(cfg.layout);
  let destroyed = false;
  let ended = false;
  let running = false;
  let raf = 0;
  let lastTime = 0;
  let lives = 3;
  let dir = 0;
  let paddleX = W / 2;
  /** 滑动迷阵的相位（秒），砖阵横向偏移 = sin(相位×频率)×幅度 */
  let moveT = 0;
  let balls: Ball[] = [];

  const brickW = W / COLS;
  // hp 矩阵：普通/图案砖 1 下，钢砖 2 下；星门(3)永远打不碎
  const hp: number[][] = cfg.layout.map((row) => row.map((v) => (v === 2 ? 2 : v === 4 ? 1 : v === 3 ? 0 : v)));
  let bricksLeft = 0;
  let patternLeft = 0;
  for (let r = 0; r < cfg.layout.length; r++) {
    for (let c = 0; c < COLS; c++) {
      if (cfg.layout[r][c] === 4) patternLeft++;
      if (hp[r][c] > 0) bricksLeft++;
    }
  }
  const totalBricks = bricksLeft;
  const totalPattern = patternLeft;

  const wrap = document.createElement("div");
  wrap.className = "bb-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="bb-top">
      <span class="bb-badge bb-bricks"></span>
      <span class="bb-badge bb-life">💗💗💗</span>
    </div>
    <canvas class="bb-canvas" width="${W}" height="${H}"></canvas>
    <div class="bb-ctrl">
      <button class="bb-btn bb-left" type="button">⬅️</button>
      <button class="bb-btn bb-right" type="button">➡️</button>
    </div>
    <div class="bb-msg"></div>
  `;
  stage.appendChild(wrap);

  const canvas = wrap.querySelector(".bb-canvas") as HTMLCanvasElement;
  const c2d = canvas.getContext("2d");
  const bricksEl = wrap.querySelector(".bb-bricks") as HTMLElement;
  const lifeEl = wrap.querySelector(".bb-life") as HTMLElement;
  const msgEl = wrap.querySelector(".bb-msg") as HTMLElement;
  const leftBtn = wrap.querySelector(".bb-left") as HTMLButtonElement;
  const rightBtn = wrap.querySelector(".bb-right") as HTMLButtonElement;

  msgEl.textContent = isPattern
    ? "点一下画面发球！打掉所有金色的图案砖就赢～"
    : ballCount > 1
      ? "点一下画面发球！一次两颗球，全掉光才扣爱心～"
      : cfg.moveSpeed
        ? "点一下画面发球！砖阵会左右滑动，算好提前量～"
        : portals.length > 0
          ? "点一下画面发球！🌀 星门会把球传到另一扇门～"
          : "点一下画面发球！灰色钢砖要打两下～";

  function renderTop(): void {
    bricksEl.textContent = isPattern ? `🖼️ 还差 ${patternLeft}` : `🧱 ${bricksLeft}`;
    lifeEl.textContent = "💗".repeat(Math.max(0, lives)) + "🤍".repeat(Math.max(0, 3 - lives));
  }

  function brickOffsetX(): number {
    if (!cfg.moveSpeed || !cfg.moveRange) return 0;
    const freq = cfg.moveSpeed / Math.max(1, cfg.moveRange);
    return Math.sin(moveT * freq) * cfg.moveRange;
  }

  function resetBalls(): void {
    running = false;
    balls = Array.from({ length: ballCount }, () => ({ x: paddleX, y: H - 40, vx: 0, vy: 0, portalCd: 0 }));
  }

  function launch(): void {
    if (running || ended) return;
    running = true;
    balls.forEach((b, i) => {
      const spread = ballCount > 1 ? (i === 0 ? -20 : 20) : 0;
      const angle = (-55 - Math.random() * 60 + spread) * (Math.PI / 180);
      b.vx = Math.cos(angle) * cfg.ballSpeed;
      b.vy = Math.sin(angle) * cfg.ballSpeed;
    });
    ctx.sfx("jump");
    msgEl.textContent = "";
  }

  function draw(): void {
    if (!c2d) return;
    c2d.clearRect(0, 0, W, H);
    const dx = brickOffsetX();
    for (let r = 0; r < hp.length; r++) {
      for (let c = 0; c < COLS; c++) {
        const orig = cfg.layout[r][c];
        const x = c * brickW + 2 + dx;
        const y = BRICK_TOP + r * BRICK_H + 2;
        if (orig === 3) {
          // 星门：一圈紫色旋涡，永远都在
          c2d.fillStyle = PORTAL_COLOR;
          c2d.beginPath();
          c2d.arc(x + brickW / 2 - 2, y + BRICK_H / 2 - 2, BRICK_H / 2 + 1, 0, Math.PI * 2);
          c2d.fill();
          c2d.fillStyle = "#EDE9FF";
          c2d.beginPath();
          c2d.arc(x + brickW / 2 - 2, y + BRICK_H / 2 - 2, BRICK_H / 4, 0, Math.PI * 2);
          c2d.fill();
          continue;
        }
        const v = hp[r][c];
        if (v <= 0) continue;
        c2d.fillStyle = orig === 2
          ? (v === 2 ? STEEL_COLOR : STEEL_HIT_COLOR)
          : orig === 4
            ? PATTERN_COLOR
            : BRICK_COLORS[(r + c) % BRICK_COLORS.length];
        c2d.beginPath();
        c2d.roundRect(x, y, brickW - 4, BRICK_H - 4, 5);
        c2d.fill();
        if (orig === 4) {
          // 图案砖描一圈白边，一眼能认出目标
          c2d.strokeStyle = "#FFF6DF";
          c2d.lineWidth = 2;
          c2d.stroke();
        }
      }
    }
    c2d.fillStyle = "#8A6BD0";
    c2d.beginPath();
    c2d.roundRect(paddleX - cfg.paddleW / 2, H - 24, cfg.paddleW, PADDLE_H, 6);
    c2d.fill();
    for (const b of balls) {
      c2d.fillStyle = "#FF6B9E";
      c2d.beginPath();
      c2d.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      c2d.fill();
    }
    if (SMOKE) canvas.dataset.balls = balls.map((b) => `${Math.round(b.x)},${Math.round(b.y)}`).join(";");
  }

  function finish(won: boolean): void {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    if (won) {
      const got = lives >= 3 ? 3 : lives === 2 ? 2 : 1;
      const brag = isPattern
        ? `${totalPattern} 块图案砖全部点亮，作品完成！`
        : `${totalBricks} 块砖全部打碎，爱心还剩 ${lives} 颗！`;
      setTimeout(() => { if (!destroyed) ctx.win(got as 1 | 2 | 3, brag); }, 350);
    } else {
      setTimeout(() => { if (!destroyed) ctx.lose("球溜走三次啦，球拍早点移过去接住它！"); }, 350);
    }
  }

  function hitBrick(r: number, c: number): void {
    hp[r][c]--;
    if (hp[r][c] <= 0) {
      bricksLeft--;
      if (cfg.layout[r][c] === 4) patternLeft--;
      ctx.sfx("pop");
    } else {
      ctx.sfx("tap");
    }
    renderTop();
    if (isPattern ? patternLeft <= 0 : bricksLeft <= 0) finish(true);
  }

  /** 星门传送：球从另一扇门出来，速度不变 */
  function teleport(b: Ball, fromR: number, fromC: number): void {
    const other = portals.find(([r, c]) => r !== fromR || c !== fromC);
    if (!other) return;
    const dx = brickOffsetX();
    b.x = other[1] * brickW + brickW / 2 + dx;
    b.y = BRICK_TOP + other[0] * BRICK_H + BRICK_H / 2 + (b.vy > 0 ? BRICK_H : -BRICK_H);
    b.portalCd = PORTAL_COOLDOWN;
    ctx.sfx("coin");
    msgEl.textContent = "🌀 咻——从另一扇星门飞出来啦！";
  }

  function tick(now: number): void {
    if (destroyed || ended) return;
    const dt = Math.min(0.03, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    moveT += dt;

    paddleX += dir * 300 * dt;
    paddleX = Math.max(cfg.paddleW / 2, Math.min(W - cfg.paddleW / 2, paddleX));

    if (!running) {
      balls.forEach((b, i) => {
        b.x = paddleX + (ballCount > 1 ? (i === 0 ? -14 : 14) : 0);
        b.y = H - 40;
      });
    } else {
      const dx = brickOffsetX();
      for (let bi = balls.length - 1; bi >= 0; bi--) {
        const b = balls[bi];
        b.portalCd = Math.max(0, b.portalCd - dt);
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
        if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); }
        if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); }

        // 球拍
        if (b.vy > 0 && b.y >= H - 24 - BALL_R && b.y <= H - 24 + PADDLE_H && Math.abs(b.x - paddleX) <= cfg.paddleW / 2 + BALL_R) {
          b.vy = -Math.abs(b.vy);
          const off = (b.x - paddleX) / (cfg.paddleW / 2);
          b.vx = off * cfg.ballSpeed * 0.85;
          const speed = Math.hypot(b.vx, b.vy);
          b.vx = (b.vx / speed) * cfg.ballSpeed;
          b.vy = (b.vy / speed) * cfg.ballSpeed;
          ctx.sfx("tap");
        }

        // 砖块（滑动迷阵要扣掉当前偏移再换算列号）
        const r = Math.floor((b.y - BRICK_TOP) / BRICK_H);
        const c = Math.floor((b.x - dx) / brickW);
        if (r >= 0 && r < hp.length && c >= 0 && c < COLS) {
          if (cfg.layout[r][c] === 3) {
            if (b.portalCd <= 0) teleport(b, r, c);
          } else if (hp[r][c] > 0) {
            const brickCx = c * brickW + brickW / 2 + dx;
            const brickCy = BRICK_TOP + r * BRICK_H + BRICK_H / 2;
            const ox = (b.x - brickCx) / brickW;
            const oy = (b.y - brickCy) / BRICK_H;
            if (Math.abs(ox) > Math.abs(oy)) b.vx = ox > 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
            else b.vy = oy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
            hitBrick(r, c);
            if (ended) return;
          }
        }

        // 掉落：多球时掉一颗不扣心，全掉光才算一次失误
        if (b.y > H + BALL_R) {
          balls.splice(bi, 1);
          if (balls.length === 0) {
            lives--;
            renderTop();
            ctx.sfx("oops");
            if (lives <= 0) {
              finish(false);
              return;
            }
            msgEl.textContent = ballCount > 1 ? "两颗球都溜走了，点画面再发一次！" : "球溜走了，点画面再发一次！";
            resetBalls();
          } else {
            msgEl.textContent = "掉了一颗球，还有一颗，稳住！";
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

  resetBalls();
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
    grandMessage: "188 座砖阵全部打穿，弹球小勇士！",
  });
}
