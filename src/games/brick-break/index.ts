import { meta } from "./meta";
export { meta };

import { mountLevelGame, mulberry32, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { save } from "../../engine/save";
import GUIDE from "./guide";
import { CHAPTERS, COLS, LEVELS, portalCells, type BrickLevel } from "./levels";
import {
  BALL_R,
  BRICK_H,
  BRICK_TOP,
  CAPSULE_SPEED,
  DROP_CHANCE,
  H,
  Janitor,
  KIND,
  PADDLE_H,
  PADDLE_Y,
  PORTAL_COOLDOWN,
  POWERS,
  STALL_HINT,
  STALL_NUDGE_DEG,
  TOWER_COLS,
  TOWER_FLOOR,
  TOWER_TOP,
  W,
  brickFace,
  capsuleLook,
  comboGapMs,
  damageBrick,
  grantPower,
  hitStopFrames,
  isBreakableKind,
  launchVelocity,
  makeTower,
  nudgeToVertical,
  paddleBounce,
  particleCount,
  popcornTargets,
  powerBarLabel,
  powerEffects,
  rollPower,
  stallNudges,
  stepBall,
  tickPowers,
  towerBottomY,
  towerBreak,
  towerRowY,
  towerTick,
  trailLength,
  type BallLike,
  type BrickGeom,
  type BrickMark,
  type PowerKind,
  type PowerTimers,
  type TowerState
} from "./logic";

const BRICK_COLORS = ["#FF9EC8", "#FFD26E", "#9FE08D", "#8FCBFF", "#C9A0F0", "#FFB48A"];
const PORTAL_COLOR = "#7B6CD9";

/** 冒烟脚本才需要逐帧状态镜像，正常游玩不写 DOM 属性 */
const SMOKE = typeof location !== "undefined" && /[?&]smoke=1/.test(location.search);

interface Ball extends BallLike {
  /** 传送冷却剩余秒数 */
  portalCd: number;
  /** 磁力板吸住时，球相对板心的位置；没吸住就是 null */
  stuck: number | null;
  trail: Array<[number, number]>;
}

interface Capsule {
  x: number;
  y: number;
  kind: PowerKind;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const CSS = `
.brk-wrap { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: linear-gradient(180deg, #FFEFE4, #F3EDFF); border-radius: 16px; padding: 12px; user-select: none; touch-action: none; position: relative; }
.brk-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px; flex-wrap: nowrap; }
.brk-badge { background: #fff; border-radius: 14px; padding: 5px 10px; font-weight: 700; color: #C97B5A; box-shadow: 0 2px 6px rgba(210,140,110,.25); font-size: 14px; white-space: nowrap; }
.brk-power { min-height: 20px; text-align: center; font-size: 14px; font-weight: 700; color: #7A5AA8; letter-spacing: 1px; }
.brk-canvas { width: 100%; border-radius: 16px; display: block; background: linear-gradient(180deg, #FDF8F0, #F4EFFB); touch-action: none; }
.brk-ctrl { display: flex; justify-content: center; gap: 24px; margin-top: 10px; }
.brk-btn { width: 84px; height: 56px; border: none; border-radius: 18px; font-size: 26px; background: #FFC9AE; color: #8A4A20; cursor: pointer; box-shadow: 0 4px 0 #EBA987; touch-action: none; }
.brk-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #EBA987; }
.brk-msg { text-align: center; min-height: 20px; color: #C97B5A; font-weight: 700; margin-top: 8px; font-size: 14px; line-height: 1.4; }
.brk-bar { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 10px; }
.brk-open { border: none; border-radius: 14px; padding: 9px 14px; font-size: 14px; font-weight: 700; background: #FFD9C4; color: #8A4A20; cursor: pointer; box-shadow: 0 3px 0 #F0B594; }
.brk-open:active { transform: translateY(2px); box-shadow: 0 1px 0 #F0B594; }
.brk-back { border: none; border-radius: 14px; padding: 9px 14px; font-size: 14px; font-weight: 700; background: #E7E1FA; color: #5B4B8A; cursor: pointer; }
.brk-over { text-align: center; padding: 14px 8px; }
.brk-over h3 { margin: 0 0 6px; font-size: 19px; color: #7A5AA8; }
.brk-over p { margin: 4px 0; font-size: 14px; color: #6B5B7A; line-height: 1.5; }
.brk-again { display: flex; gap: 10px; justify-content: center; margin-top: 12px; flex-wrap: wrap; }
@media (prefers-reduced-motion: reduce) {
  .brk-btn:active, .brk-open:active { transform: none; }
}
`;

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------------------------------------------------------------------------
// 画砖 / 画球：闯关与无尽共用同一套笔触
// ---------------------------------------------------------------------------

function drawMark(c2d: CanvasRenderingContext2D, mark: BrickMark, x: number, y: number, w: number, h: number): void {
  if (mark === "none") return;
  c2d.save();
  c2d.strokeStyle = "rgba(255,255,255,.9)";
  c2d.fillStyle = "rgba(255,255,255,.9)";
  c2d.lineWidth = 1.6;
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (mark === "layers2" || mark === "layers3") {
    const n = mark === "layers3" ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const yy = y + (h * (i + 1)) / (n + 1);
      c2d.beginPath();
      c2d.moveTo(x + 6, yy);
      c2d.lineTo(x + w - 6, yy);
      c2d.stroke();
    }
  } else if (mark === "bolt") {
    for (const dx of [-1, 1]) {
      for (const dy of [-1, 1]) {
        c2d.beginPath();
        c2d.arc(cx + dx * (w / 2 - 6), cy + dy * (h / 2 - 4), 1.7, 0, Math.PI * 2);
        c2d.fill();
      }
    }
  } else if (mark === "corn") {
    for (const dx of [-8, 0, 8]) {
      c2d.beginPath();
      c2d.arc(cx + dx, cy, 2.6, 0, Math.PI * 2);
      c2d.fill();
    }
  } else if (mark === "gift") {
    c2d.beginPath();
    c2d.moveTo(cx, cy - 5.5);
    c2d.lineTo(cx + 5.5, cy);
    c2d.lineTo(cx, cy + 5.5);
    c2d.lineTo(cx - 5.5, cy);
    c2d.closePath();
    c2d.fill();
  } else if (mark === "shine") {
    c2d.strokeStyle = "#FFF6DF";
    c2d.lineWidth = 2;
    c2d.beginPath();
    c2d.roundRect(x, y, w, h, 5);
    c2d.stroke();
  }
  c2d.restore();
}

function drawBrick(
  c2d: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  mark: BrickMark
): void {
  c2d.fillStyle = color;
  c2d.beginPath();
  c2d.roundRect(x, y, w, h, 5);
  c2d.fill();
  drawMark(c2d, mark, x, y, w, h);
}

function drawPortal(c2d: CanvasRenderingContext2D, cx: number, cy: number): void {
  c2d.fillStyle = PORTAL_COLOR;
  c2d.beginPath();
  c2d.arc(cx, cy, BRICK_H / 2 + 1, 0, Math.PI * 2);
  c2d.fill();
  c2d.fillStyle = "#EDE9FF";
  c2d.beginPath();
  c2d.arc(cx, cy, BRICK_H / 4, 0, Math.PI * 2);
  c2d.fill();
}

function drawPaddle(c2d: CanvasRenderingContext2D, x: number, w: number, magnet: boolean): void {
  c2d.fillStyle = magnet ? "#4FAE8C" : "#8A6BD0";
  c2d.beginPath();
  c2d.roundRect(x - w / 2, PADDLE_Y, w, PADDLE_H, 6);
  c2d.fill();
}

function drawBallWithTrail(c2d: CanvasRenderingContext2D, b: Ball, speed: number, pierce: boolean): void {
  if (b.trail.length > 1) {
    const span = trailLength(speed);
    c2d.save();
    c2d.strokeStyle = pierce ? "rgba(140,220,255,.5)" : "rgba(255,107,158,.35)";
    c2d.lineWidth = Math.max(3, Math.min(BALL_R * 1.6, span * 0.3));
    c2d.lineCap = "round";
    c2d.beginPath();
    c2d.moveTo(b.trail[0][0], b.trail[0][1]);
    for (let i = 1; i < b.trail.length; i++) c2d.lineTo(b.trail[i][0], b.trail[i][1]);
    c2d.stroke();
    c2d.restore();
  }
  c2d.fillStyle = pierce ? "#6FD0FF" : "#FF6B9E";
  c2d.beginPath();
  c2d.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
  c2d.fill();
}

function drawCapsule(c2d: CanvasRenderingContext2D, cap: Capsule): void {
  const look = capsuleLook(cap.kind);
  c2d.beginPath();
  c2d.arc(cap.x, cap.y, 11, 0, Math.PI * 2);
  if (look.hollow) {
    // 空心圈：形状本身就在说「别接我」，不指望孩子分得出那点粉色
    c2d.lineWidth = 3;
    c2d.strokeStyle = "#E0709A";
    c2d.stroke();
  } else {
    c2d.fillStyle = look.fill;
    c2d.fill();
  }
  c2d.font = "14px serif";
  c2d.textAlign = "center";
  c2d.textBaseline = "middle";
  c2d.fillStyle = "#3A2E4A";
  c2d.fillText(look.emoji, cap.x, cap.y + 1);
}

function drawParticles(c2d: CanvasRenderingContext2D, list: Particle[]): void {
  for (const p of list) {
    c2d.globalAlpha = Math.max(0, Math.min(1, p.life * 2.2));
    c2d.fillStyle = p.color;
    c2d.beginPath();
    c2d.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
    c2d.fill();
  }
  c2d.globalAlpha = 1;
}

function stepParticles(list: Particle[], dt: number): Particle[] {
  for (const p of list) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 380 * dt;
    p.life -= dt;
  }
  return list.filter((p) => p.life > 0);
}

/** 拖板热区：手指在球台下半屏拖，板心与手指之间留一点偏移，别被手挡住 */
const GRAB_MAX = 26;

// ---------------------------------------------------------------------------
// 闯关：188 关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: BrickLevel = LEVELS[ctx.level];
  const ballCount = cfg.balls ?? 1;
  const isPattern = cfg.goal === "pattern";
  const portals = portalCells(cfg.layout);
  const rows = cfg.layout.length;
  const brickW = W / COLS;
  const reduce = reducedMotion();
  const rand = mulberry32(ctx.level * 7919 + 17);
  const jan = new Janitor();

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
  let capsules: Capsule[] = [];
  let particles: Particle[] = [];
  let timers: PowerTimers = {};
  let combo = 0;
  let lastPop = 0;
  /** 击砖顿感剩余秒数 */
  let stopT = 0;
  let sinceHit = 0;
  let nudged = 0;
  let hintT = 0;

  // 当前砖种矩阵：多层砖掉一层就换成层数更少的砖种，原始砖种一直看 cfg.layout
  const grid = cfg.layout.map((row) => row.slice());
  let bricksLeft = 0;
  let patternLeft = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      if (cfg.layout[r][c] === KIND.PATTERN) patternLeft++;
      if (isBreakableKind(cfg.layout[r][c])) bricksLeft++;
    }
  }
  const totalBricks = bricksLeft;
  const totalPattern = patternLeft;

  const wrap = el("div", "brk-wrap");
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="brk-top">
      <span class="brk-badge brk-bricks"></span>
      <span class="brk-badge brk-life">💗💗💗</span>
    </div>
    <div class="brk-power"></div>
    <canvas class="brk-canvas" width="${W}" height="${H}"></canvas>
    <div class="brk-ctrl">
      <button class="brk-btn brk-left" type="button" aria-label="球拍往左">⬅️</button>
      <button class="brk-btn brk-right" type="button" aria-label="球拍往右">➡️</button>
    </div>
    <div class="brk-msg"></div>
  `;
  stage.appendChild(wrap);

  const canvas = wrap.querySelector(".brk-canvas") as HTMLCanvasElement;
  const c2d = canvas.getContext("2d");
  const bricksEl = wrap.querySelector(".brk-bricks") as HTMLElement;
  const lifeEl = wrap.querySelector(".brk-life") as HTMLElement;
  const powerEl = wrap.querySelector(".brk-power") as HTMLElement;
  const msgEl = wrap.querySelector(".brk-msg") as HTMLElement;
  const leftBtn = wrap.querySelector(".brk-left") as HTMLButtonElement;
  const rightBtn = wrap.querySelector(".brk-right") as HTMLButtonElement;

  msgEl.textContent = isPattern
    ? "点一下画面发球！打掉所有金色的图案砖就赢～"
    : ballCount > 1
      ? "点一下画面发球！一次两颗球，全掉光才扣爱心～"
      : cfg.moveSpeed
        ? "点一下画面发球！砖阵会左右滑动，算好提前量～"
        : portals.length > 0
          ? "点一下画面发球！🌀 星门会把球传到另一扇门～"
          : "点一下画面发球！灰色的两层砖要打两下，碎砖有时会掉小道具，用板子接住！";

  function eff() {
    return powerEffects(timers);
  }
  function paddleW(): number {
    return cfg.paddleW * eff().paddleScale;
  }
  function speed(): number {
    return cfg.ballSpeed * eff().speedScale;
  }

  function renderTop(): void {
    bricksEl.textContent = isPattern ? `🖼️ 还差 ${patternLeft}` : `🧱 ${bricksLeft}`;
    lifeEl.textContent = "💗".repeat(Math.max(0, lives)) + "🤍".repeat(Math.max(0, 3 - lives));
    powerEl.textContent = powerBarLabel(timers);
  }

  function brickOffsetX(): number {
    if (!cfg.moveSpeed || !cfg.moveRange) return 0;
    const freq = cfg.moveSpeed / Math.max(1, cfg.moveRange);
    return Math.sin(moveT * freq) * cfg.moveRange;
  }

  function newBall(x: number, offset: number): Ball {
    return { x, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, portalCd: 0, stuck: offset, trail: [] };
  }

  function resetBalls(): void {
    running = false;
    balls = Array.from({ length: ballCount }, (_, i) =>
      newBall(paddleX + (ballCount > 1 ? (i === 0 ? -14 : 14) : 0), ballCount > 1 ? (i === 0 ? -14 : 14) : 0)
    );
  }

  function launch(): void {
    if (ended) return;
    const sp = speed();
    let fired = false;
    if (!running) {
      running = true;
      balls.forEach((b, i) => {
        const spread = ballCount > 1 ? (i === 0 ? -20 : 20) : 0;
        const v = launchVelocity(sp, rand(), spread);
        b.vx = v.vx;
        b.vy = v.vy;
        b.stuck = null;
      });
      fired = true;
    } else {
      for (const b of balls) {
        if (b.stuck === null) continue;
        const v = launchVelocity(sp, 0.5 + (b.stuck / Math.max(1, paddleW())) * 0.8, 0);
        b.vx = v.vx;
        b.vy = v.vy;
        b.stuck = null;
        fired = true;
      }
    }
    if (fired) {
      ctx.sfx("jump");
      msgEl.textContent = "";
      sinceHit = 0;
      nudged = 0;
    }
  }

  function faceOf(r: number, c: number): { color: string; mark: BrickMark } {
    const orig = cfg.layout[r][c];
    if (orig === KIND.NORMAL) return { color: BRICK_COLORS[(r + c) % BRICK_COLORS.length], mark: "none" };
    return brickFace(orig, grid[r][c]);
  }

  function burst(r: number, c: number): void {
    const n = particleCount(7, reduce);
    const cx = c * brickW + brickW / 2 + brickOffsetX();
    const cy = BRICK_TOP + r * BRICK_H + BRICK_H / 2;
    const color = faceOf(r, c).color;
    for (let i = 0; i < n; i++) {
      particles.push({ x: cx, y: cy, vx: (rand() - 0.5) * 190, vy: (rand() - 0.5) * 160 - 40, life: 0.45, color });
    }
  }

  function comboPop(): void {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastPop >= comboGapMs(combo)) {
      ctx.sfx("pop");
      lastPop = now;
    }
    // 连到 5 的倍数就加一声更亮的，听起来像音阶往上爬
    if (combo > 0 && combo % 5 === 0) jan.after(70, () => ctx.sfx("coin"));
  }

  function dropCapsule(r: number, c: number): void {
    if (capsules.length >= 3) return;
    capsules.push({
      x: c * brickW + brickW / 2 + brickOffsetX(),
      y: BRICK_TOP + r * BRICK_H + BRICK_H / 2,
      kind: rollPower(rand())
    });
  }

  function spawnTriple(): void {
    const src = balls.find((b) => b.stuck === null) ?? balls[0];
    if (!src || balls.length >= 6) return;
    const sp = speed();
    const base = Math.atan2(src.vy || -1, src.vx || 0);
    for (const deg of [-26, 26]) {
      const a = base + (deg * Math.PI) / 180;
      balls.push({
        x: src.x,
        y: src.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        portalCd: 0,
        stuck: null,
        trail: []
      });
    }
  }

  function takePower(kind: PowerKind): void {
    if (kind === "triple") spawnTriple();
    else timers = grantPower(timers, kind);
    const info = POWERS[kind];
    ctx.sfx(info.good ? "coin" : "tap");
    msgEl.textContent = `${info.emoji} ${info.name}：${info.hint}`;
    hintT = 2.4;
    renderTop();
  }

  function breakAt(r: number, c: number, pierce: boolean): void {
    const cur = grid[r]?.[c];
    if (cur === undefined || cur === KIND.EMPTY || cur === KIND.PORTAL) return;
    const res = damageBrick(cur, pierce);
    if (res.next === cur) {
      // 钢砖：普通球打不动，给一声闷响提示「得换个办法」
      ctx.sfx("tap");
      stopT = Math.max(stopT, hitStopFrames(cur) / 60);
      return;
    }
    grid[r][c] = res.next;
    sinceHit = 0;
    nudged = 0;
    stopT = Math.max(stopT, hitStopFrames(cur) / 60);
    if (!res.broken) {
      ctx.sfx("tap");
      renderTop();
      return;
    }
    bricksLeft--;
    if (cfg.layout[r][c] === KIND.PATTERN) patternLeft--;
    combo++;
    burst(r, c);
    comboPop();
    if (res.gift || rand() < DROP_CHANCE) dropCapsule(r, c);
    if (res.chain) {
      for (const [nr, nc] of popcornTargets(r, c, rows, COLS)) breakAt(nr, nc, true);
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
    b.trail.length = 0;
    ctx.sfx("coin");
    msgEl.textContent = "🌀 咻——从另一扇星门飞出来啦！";
    hintT = 1.8;
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
      jan.after(350, () => {
        if (!destroyed) ctx.win(got as 1 | 2 | 3, brag);
      });
    } else {
      jan.after(350, () => {
        if (!destroyed) ctx.lose("这一局球溜走了～别追球，提前把球拍挪到落点下面等它，下一局就稳了！");
      });
    }
  }

  function physics(dt: number): void {
    const e = eff();
    const sp = speed();
    const pw = paddleW();
    const dx = brickOffsetX();
    const geom: BrickGeom = { rows, cols: COLS, brickW, brickH: BRICK_H, top: BRICK_TOP, offsetX: dx };

    for (let bi = balls.length - 1; bi >= 0; bi--) {
      const b = balls[bi];
      b.portalCd = Math.max(0, b.portalCd - dt);
      if (b.stuck !== null) {
        b.x = Math.max(BALL_R, Math.min(W - BALL_R, paddleX + b.stuck));
        b.y = PADDLE_Y - BALL_R - 1;
        b.trail.length = 0;
        continue;
      }

      // 球速跟着道具走（慢速球到期会自己恢复），方向保持不变
      const cur = Math.hypot(b.vx, b.vy);
      if (cur > 1e-6) {
        b.vx = (b.vx / cur) * sp;
        b.vy = (b.vy / cur) * sp;
      }

      stepBall(b, dt, {
        geom,
        radius: BALL_R,
        left: 0,
        right: W,
        top: 0,
        solid: (r, c) => grid[r]?.[c] !== undefined && grid[r][c] !== KIND.EMPTY,
        hit: (r, c) => {
          const kind = grid[r][c];
          if (kind === KIND.PORTAL) {
            if (b.portalCd <= 0) teleport(b, r, c);
            return "pass";
          }
          const before = grid[r][c];
          breakAt(r, c, e.pierce);
          if (ended) return "pass";
          // 穿透球一路清过去；钢砖没被打动时照旧反弹
          return e.pierce && grid[r][c] !== before ? "pass" : "bounce";
        }
      });
      if (ended) return;

      // 球拍
      if (
        b.vy > 0 &&
        b.y >= PADDLE_Y - BALL_R &&
        b.y <= PADDLE_Y + PADDLE_H &&
        Math.abs(b.x - paddleX) <= pw / 2 + BALL_R
      ) {
        if (e.magnet) {
          b.stuck = Math.max(-pw / 2, Math.min(pw / 2, b.x - paddleX));
          b.vx = 0;
          b.vy = 0;
          b.y = PADDLE_Y - BALL_R - 1;
          ctx.sfx("meow");
          msgEl.textContent = "🧲 吸住啦！点一下画面再发射～";
          hintT = 2;
        } else {
          const v = paddleBounce(b.x, paddleX, pw, sp);
          b.vx = v.vx;
          b.vy = v.vy;
          b.y = PADDLE_Y - BALL_R - 1;
          ctx.sfx("tap");
        }
        combo = 0;
      }

      b.trail.push([b.x, b.y]);
      const keep = Math.max(2, Math.round(trailLength(sp) / Math.max(1, sp * dt)));
      while (b.trail.length > Math.min(12, keep)) b.trail.shift();

      // 掉落：多球时掉一颗不扣心，全掉光才算一次失误
      if (b.y > H + BALL_R) {
        balls.splice(bi, 1);
        if (balls.length === 0) {
          lives--;
          combo = 0;
          timers = {};
          capsules = [];
          renderTop();
          ctx.sfx("oops");
          if (lives <= 0) {
            finish(false);
            return;
          }
          msgEl.textContent = "球滚出去啦，捡回来再来一次，点画面发球！";
          hintT = 3;
          resetBalls();
        } else {
          msgEl.textContent = "掉了一颗，还有球在场上，稳住节奏！";
          hintT = 2;
        }
      }
    }

    // 道具胶囊
    for (let i = capsules.length - 1; i >= 0; i--) {
      const cap = capsules[i];
      cap.y += CAPSULE_SPEED * dt;
      if (
        cap.y > PADDLE_Y - 6 &&
        cap.y < PADDLE_Y + PADDLE_H + 10 &&
        Math.abs(cap.x - paddleX) <= pw / 2 + 10
      ) {
        capsules.splice(i, 1);
        takePower(cap.kind);
      } else if (cap.y > H + 14) {
        capsules.splice(i, 1);
      }
    }

    // 长时间没击砖：每秒把角度掰竖一点，并提示
    sinceHit += dt;
    const due = stallNudges(sinceHit);
    if (due > nudged) {
      for (const b of balls) {
        if (b.stuck === null) {
          const v = nudgeToVertical(b.vx, b.vy, STALL_NUDGE_DEG * (due - nudged));
          b.vx = v.vx;
          b.vy = v.vy;
        }
      }
      if (nudged === 0) {
        msgEl.textContent = STALL_HINT;
        hintT = 2.6;
      }
      nudged = due;
    }
  }

  function draw(): void {
    if (!c2d) return;
    c2d.clearRect(0, 0, W, H);
    const dx = brickOffsetX();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const orig = cfg.layout[r][c];
        const x = c * brickW + 2 + dx;
        const y = BRICK_TOP + r * BRICK_H + 2;
        if (orig === KIND.PORTAL) {
          drawPortal(c2d, x + brickW / 2 - 2, y + BRICK_H / 2 - 2);
          continue;
        }
        if (grid[r][c] === KIND.EMPTY) continue;
        const face = faceOf(r, c);
        drawBrick(c2d, x, y, brickW - 4, BRICK_H - 4, face.color, face.mark);
      }
    }
    for (const cap of capsules) drawCapsule(c2d, cap);
    drawPaddle(c2d, paddleX, paddleW(), eff().magnet);
    const sp = speed();
    for (const b of balls) drawBallWithTrail(c2d, b, sp, eff().pierce);
    drawParticles(c2d, particles);
    if (SMOKE) canvas.dataset.balls = balls.map((b) => `${Math.round(b.x)},${Math.round(b.y)}`).join(";");
  }

  function tick(now: number): void {
    if (destroyed || ended) return;
    const dt = Math.min(0.03, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    moveT += dt;
    timers = tickPowers(timers, dt);
    particles = stepParticles(particles, dt);
    if (hintT > 0) {
      hintT -= dt;
      if (hintT <= 0) msgEl.textContent = "";
    }

    paddleX += dir * 300 * dt;
    paddleX = Math.max(paddleW() / 2, Math.min(W - paddleW() / 2, paddleX));

    if (!running) {
      balls.forEach((b, i) => {
        b.x = paddleX + (ballCount > 1 ? (i === 0 ? -14 : 14) : 0);
        b.y = PADDLE_Y - BALL_R - 1;
      });
    } else if (stopT > 0) {
      // 击砖顿感：画面照常刷新，物理停 3–5 帧，打击更「实」
      stopT -= dt;
    } else {
      physics(dt);
      if (ended) return;
    }
    renderTop();
    draw();
    raf = requestAnimationFrame(tick);
  }

  function hold(btn: HTMLButtonElement, d: number): void {
    jan.on(btn, "pointerdown", (e: Event) => {
      (e as PointerEvent).preventDefault();
      dir = d;
      launch();
    });
    const stop = () => {
      if (dir === d) dir = 0;
    };
    jan.on(btn, "pointerup", stop);
    jan.on(btn, "pointerleave", stop);
    jan.on(btn, "pointercancel", stop);
  }
  hold(leftBtn, -1);
  hold(rightBtn, 1);

  let dragging = false;
  let grab = 0;
  function canvasX(e: PointerEvent, rect: DOMRect): number {
    return ((e.clientX - rect.left) / rect.width) * W;
  }
  jan.on(canvas, "pointerdown", (ev: Event) => {
    const e = ev as PointerEvent;
    const rect = canvas.getBoundingClientRect();
    // 上半屏点一下＝发球；下半屏整宽都是拖板热区
    if (e.clientY - rect.top < rect.height * 0.45) {
      launch();
      return;
    }
    dragging = true;
    const fx = canvasX(e, rect);
    grab = Math.max(-GRAB_MAX, Math.min(GRAB_MAX, paddleX - fx));
    paddleX = Math.max(paddleW() / 2, Math.min(W - paddleW() / 2, fx + grab));
    launch();
  });
  jan.on(canvas, "pointermove", (ev: Event) => {
    if (!dragging) return;
    const e = ev as PointerEvent;
    const rect = canvas.getBoundingClientRect();
    paddleX = Math.max(paddleW() / 2, Math.min(W - paddleW() / 2, canvasX(e, rect) + grab));
  });
  jan.on(window, "pointerup", () => {
    dragging = false;
  });

  jan.on(window, "keydown", (ev: Event) => {
    const e = ev as KeyboardEvent;
    if (e.key === "ArrowLeft") {
      dir = -1;
      e.preventDefault();
    }
    if (e.key === "ArrowRight") {
      dir = 1;
      e.preventDefault();
    }
    if (e.key === " ") {
      launch();
      e.preventDefault();
    }
  });
  jan.on(window, "keyup", (ev: Event) => {
    const e = ev as KeyboardEvent;
    if ((e.key === "ArrowLeft" && dir === -1) || (e.key === "ArrowRight" && dir === 1)) dir = 0;
  });

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
      jan.destroy();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 无尽「砖塔」：砖墙不断下移，打掉一整行加分，压到底线就收工
// ---------------------------------------------------------------------------

const TOWER_SPEED = 250;
const TOWER_PADDLE_W = 88;

function mountTower(host: HTMLElement, api: GameApi, back: () => void): { destroy: () => void } {
  const jan = new Janitor();
  const reduce = reducedMotion();
  let seedBase = Date.now() >>> 0;
  let raf = 0;
  let disposed = false;

  const wrap = el("div", "brk-wrap");
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="brk-top">
      <span class="brk-badge brk-score">💯 0</span>
      <span class="brk-badge brk-rows">🧱 0 行</span>
      <span class="brk-badge brk-best"></span>
    </div>
    <div class="brk-power"></div>
    <canvas class="brk-canvas" width="${W}" height="${H}"></canvas>
    <div class="brk-ctrl">
      <button class="brk-btn brk-left" type="button" aria-label="球拍往左">⬅️</button>
      <button class="brk-btn brk-right" type="button" aria-label="球拍往右">➡️</button>
    </div>
    <div class="brk-msg"></div>
    <div class="brk-again"><button class="brk-back" type="button">⬅️ 回到关卡地图</button></div>
  `;
  host.appendChild(wrap);

  const canvas = wrap.querySelector(".brk-canvas") as HTMLCanvasElement;
  const c2d = canvas.getContext("2d");
  const scoreEl = wrap.querySelector(".brk-score") as HTMLElement;
  const rowsEl = wrap.querySelector(".brk-rows") as HTMLElement;
  const bestEl = wrap.querySelector(".brk-best") as HTMLElement;
  const powerEl = wrap.querySelector(".brk-power") as HTMLElement;
  const msgEl = wrap.querySelector(".brk-msg") as HTMLElement;
  const backBtn = wrap.querySelector(".brk-back") as HTMLButtonElement;

  let state: TowerState;
  let rand: () => number;
  let ball: Ball;
  let paddleX = W / 2;
  let dir = 0;
  let timers: PowerTimers = {};
  let capsules: Capsule[] = [];
  let particles: Particle[] = [];
  let running = false;
  let over = false;
  let lastTime = 0;
  let hintT = 0;
  let combo = 0;
  let lastPop = 0;
  const brickW = W / TOWER_COLS;

  function eff() {
    return powerEffects(timers);
  }
  function paddleW(): number {
    return TOWER_PADDLE_W * eff().paddleScale;
  }
  function speed(): number {
    return TOWER_SPEED * eff().speedScale;
  }

  function refreshTop(): void {
    scoreEl.textContent = `💯 ${state.score}`;
    rowsEl.textContent = `🧱 ${state.rowsCleared} 行`;
    const best = save.getGameProgress(meta.id).endlessBest;
    bestEl.textContent = best > 0 ? `🏅 最好 ${best}` : "🏅 第一次";
    powerEl.textContent = powerBarLabel(timers);
  }

  function reset(): void {
    seedBase = (seedBase * 1664525 + 1013904223) >>> 0;
    rand = mulberry32(seedBase);
    state = makeTower(rand);
    ball = { x: paddleX, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, portalCd: 0, stuck: 0, trail: [] };
    timers = {};
    capsules = [];
    particles = [];
    running = false;
    over = false;
    combo = 0;
    msgEl.textContent = "点一下画面发球！砖墙会一直往下压，打掉一整行就加分～";
    hintT = 0;
    refreshTop();
  }

  function launch(): void {
    if (over || running) return;
    running = true;
    const v = launchVelocity(speed(), rand(), 0);
    ball.vx = v.vx;
    ball.vy = v.vy;
    ball.stuck = null;
    api.play("jump");
    msgEl.textContent = "";
  }

  function burst(r: number, c: number, kind: number): void {
    const n = particleCount(6, reduce);
    const cx = c * brickW + brickW / 2;
    const cy = towerRowY(state, r) + BRICK_H / 2;
    const color = brickFace(kind, kind).color;
    for (let i = 0; i < n; i++) {
      particles.push({ x: cx, y: cy, vx: (rand() - 0.5) * 180, vy: (rand() - 0.5) * 150 - 30, life: 0.4, color });
    }
  }

  function comboPop(): void {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastPop >= comboGapMs(combo)) {
      api.play("pop");
      lastPop = now;
    }
  }

  function takePower(kind: PowerKind): void {
    if (kind !== "triple") timers = grantPower(timers, kind);
    const info = POWERS[kind];
    api.play(info.good ? "coin" : "tap");
    msgEl.textContent = `${info.emoji} ${info.name}：${info.hint}`;
    hintT = 2.2;
    refreshTop();
  }

  function finish(): void {
    if (over) return;
    over = true;
    running = false;
    api.play("oops");
    let best = state.score;
    try {
      best = save.recordEndlessBest(meta.id, state.score);
    } catch (err) {
      console.warn("[一朵一星] 碰碰砖块无尽成绩没记上:", err);
    }
    const box = el("div", "brk-over");
    box.append(
      el("h3", undefined, "🧱 砖塔靠岸啦！"),
      el("p", undefined, `这一趟拿到 ${state.score} 分，打通了 ${state.rowsCleared} 整行。`),
      el("p", undefined, best > state.score ? `你的最好成绩还是 ${best} 分，再来一次说不定就破了～` : `新纪录！${best} 分，好厉害！`),
      el("p", undefined, "小窍门：先把一列打穿，球钻到砖墙上面就能连着吃好几行。")
    );
    const again = el("div", "brk-again");
    const againBtn = el("button", "brk-open", "🔁 再来一趟");
    const backBtn2 = el("button", "brk-back", "⬅️ 回到关卡地图");
    jan.on(againBtn, "click", () => {
      api.play("tap");
      box.remove();
      reset();
      loop();
    });
    jan.on(backBtn2, "click", () => back());
    again.append(againBtn, backBtn2);
    box.appendChild(again);
    msgEl.after(box);
    refreshTop();
  }

  function breakAt(r: number, c: number, pierce: boolean): void {
    const before = state.rows[r]?.[c];
    if (before === undefined || before === KIND.EMPTY) return;
    const res = towerBreak(state, r, c, pierce);
    if (res.state === state) return;
    for (const [br, bc] of res.broke) burst(br, bc, state.rows[br][bc]);
    state = res.state;
    if (res.broke.length > 0) {
      combo += res.broke.length;
      comboPop();
    } else {
      api.play("tap");
    }
    if (res.clearedRows > 0) {
      api.play("win");
      msgEl.textContent = `🎉 打通 ${res.clearedRows} 整行！`;
      hintT = 1.6;
    }
    for (const [gr, gc] of res.gifts) {
      if (capsules.length < 3) {
        capsules.push({ x: gc * brickW + brickW / 2, y: towerRowY(state, gr) + BRICK_H / 2, kind: rollPower(rand()) });
      }
    }
    refreshTop();
    if (state.over) finish();
  }

  function physics(dt: number): void {
    const e = eff();
    const sp = speed();
    const pw = paddleW();
    state = towerTick(state, dt, rand);
    if (state.over) {
      finish();
      return;
    }

    const geom: BrickGeom = {
      rows: state.rows.length,
      cols: TOWER_COLS,
      brickW,
      brickH: BRICK_H,
      top: TOWER_TOP + state.drop,
      offsetX: 0
    };

    const cur = Math.hypot(ball.vx, ball.vy);
    if (cur > 1e-6) {
      ball.vx = (ball.vx / cur) * sp;
      ball.vy = (ball.vy / cur) * sp;
    }

    stepBall(ball, dt, {
      geom,
      radius: BALL_R,
      left: 0,
      right: W,
      top: 0,
      solid: (r, c) => state.rows[r]?.[c] !== undefined && state.rows[r][c] !== KIND.EMPTY,
      hit: (r, c) => {
        const before = state.rows[r][c];
        breakAt(r, c, e.pierce);
        if (over) return "pass";
        const after = state.rows[r]?.[c];
        return e.pierce && after !== before ? "pass" : "bounce";
      }
    });
    if (over) return;

    if (
      ball.vy > 0 &&
      ball.y >= PADDLE_Y - BALL_R &&
      ball.y <= PADDLE_Y + PADDLE_H &&
      Math.abs(ball.x - paddleX) <= pw / 2 + BALL_R
    ) {
      if (e.magnet) {
        ball.stuck = Math.max(-pw / 2, Math.min(pw / 2, ball.x - paddleX));
        ball.vx = 0;
        ball.vy = 0;
        running = false;
        api.play("meow");
      } else {
        const v = paddleBounce(ball.x, paddleX, pw, sp);
        ball.vx = v.vx;
        ball.vy = v.vy;
        ball.y = PADDLE_Y - BALL_R - 1;
        api.play("tap");
      }
      combo = 0;
    }

    ball.trail.push([ball.x, ball.y]);
    while (ball.trail.length > 10) ball.trail.shift();

    if (ball.y > H + BALL_R) {
      // 球溜走不算输：砖墙往下压一点点，捡回来接着打
      state = { ...state, drop: Math.min(BRICK_H - 0.1, state.drop + 5) };
      running = false;
      ball = { x: paddleX, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, portalCd: 0, stuck: 0, trail: [] };
      combo = 0;
      api.play("oops");
      msgEl.textContent = "球滚出去啦，捡回来点一下再发～砖墙悄悄压低了一点点。";
      hintT = 2.6;
    }

    for (let i = capsules.length - 1; i >= 0; i--) {
      const cap = capsules[i];
      cap.y += CAPSULE_SPEED * dt;
      if (cap.y > PADDLE_Y - 6 && cap.y < PADDLE_Y + PADDLE_H + 10 && Math.abs(cap.x - paddleX) <= pw / 2 + 10) {
        capsules.splice(i, 1);
        takePower(cap.kind);
      } else if (cap.y > H + 14) {
        capsules.splice(i, 1);
      }
    }
  }

  function draw(): void {
    if (!c2d) return;
    c2d.clearRect(0, 0, W, H);
    // 危险线
    c2d.strokeStyle = "rgba(233,120,120,.5)";
    c2d.setLineDash([6, 6]);
    c2d.lineWidth = 2;
    c2d.beginPath();
    c2d.moveTo(0, TOWER_FLOOR);
    c2d.lineTo(W, TOWER_FLOOR);
    c2d.stroke();
    c2d.setLineDash([]);

    for (let r = 0; r < state.rows.length; r++) {
      const y = towerRowY(state, r);
      for (let c = 0; c < TOWER_COLS; c++) {
        const kind = state.rows[r][c];
        if (kind === KIND.EMPTY) continue;
        const face = brickFace(kind, kind);
        const color = kind === KIND.NORMAL ? BRICK_COLORS[(r + c) % BRICK_COLORS.length] : face.color;
        drawBrick(c2d, c * brickW + 2, y + 2, brickW - 4, BRICK_H - 4, color, face.mark);
      }
    }
    for (const cap of capsules) drawCapsule(c2d, cap);
    drawPaddle(c2d, paddleX, paddleW(), eff().magnet);
    if (ball.stuck !== null) {
      ball.x = Math.max(BALL_R, Math.min(W - BALL_R, paddleX + ball.stuck));
      ball.y = PADDLE_Y - BALL_R - 1;
    }
    drawBallWithTrail(c2d, ball, speed(), eff().pierce);
    drawParticles(c2d, particles);
  }

  function tick(now: number): void {
    if (disposed) return;
    const dt = Math.min(0.03, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    timers = tickPowers(timers, dt);
    particles = stepParticles(particles, dt);
    if (hintT > 0) {
      hintT -= dt;
      if (hintT <= 0) msgEl.textContent = "";
    }
    paddleX += dir * 300 * dt;
    paddleX = Math.max(paddleW() / 2, Math.min(W - paddleW() / 2, paddleX));
    if (!over) {
      if (running) physics(dt);
      else if (ball.stuck === null) ball.stuck = 0;
    }
    draw();
    if (!over) raf = requestAnimationFrame(tick);
  }

  function loop(): void {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame((t) => {
      lastTime = t;
      raf = requestAnimationFrame(tick);
    });
  }

  function hold(btn: HTMLButtonElement, d: number): void {
    jan.on(btn, "pointerdown", (ev: Event) => {
      (ev as PointerEvent).preventDefault();
      dir = d;
      launch();
    });
    const stop = () => {
      if (dir === d) dir = 0;
    };
    jan.on(btn, "pointerup", stop);
    jan.on(btn, "pointerleave", stop);
    jan.on(btn, "pointercancel", stop);
  }
  hold(wrap.querySelector(".brk-left") as HTMLButtonElement, -1);
  hold(wrap.querySelector(".brk-right") as HTMLButtonElement, 1);

  let dragging = false;
  let grab = 0;
  jan.on(canvas, "pointerdown", (ev: Event) => {
    const e = ev as PointerEvent;
    const rect = canvas.getBoundingClientRect();
    if (e.clientY - rect.top < rect.height * 0.45) {
      launch();
      return;
    }
    dragging = true;
    const fx = ((e.clientX - rect.left) / rect.width) * W;
    grab = Math.max(-GRAB_MAX, Math.min(GRAB_MAX, paddleX - fx));
    paddleX = Math.max(paddleW() / 2, Math.min(W - paddleW() / 2, fx + grab));
    launch();
  });
  jan.on(canvas, "pointermove", (ev: Event) => {
    if (!dragging) return;
    const e = ev as PointerEvent;
    const rect = canvas.getBoundingClientRect();
    paddleX = Math.max(paddleW() / 2, Math.min(W - paddleW() / 2, ((e.clientX - rect.left) / rect.width) * W + grab));
  });
  jan.on(window, "pointerup", () => {
    dragging = false;
  });
  jan.on(window, "keydown", (ev: Event) => {
    const e = ev as KeyboardEvent;
    if (e.key === "ArrowLeft") {
      dir = -1;
      e.preventDefault();
    }
    if (e.key === "ArrowRight") {
      dir = 1;
      e.preventDefault();
    }
    if (e.key === " ") {
      launch();
      e.preventDefault();
    }
  });
  jan.on(window, "keyup", (ev: Event) => {
    const e = ev as KeyboardEvent;
    if ((e.key === "ArrowLeft" && dir === -1) || (e.key === "ArrowRight" && dir === 1)) dir = 0;
  });
  jan.on(backBtn, "click", () => back());

  reset();
  loop();

  return {
    destroy() {
      disposed = true;
      over = true;
      cancelAnimationFrame(raf);
      jan.destroy();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 挂载：模式条 + 188 关地图
// ---------------------------------------------------------------------------

export function mount(api: GameApi): { destroy: () => void } {
  const root = el("div");
  const bar = el("div", "brk-bar");
  const style = document.createElement("style");
  style.textContent = CSS;
  const levelHost = el("div");
  const modeHost = el("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = el("button", "brk-open", "♾️ 无尽砖塔");
  endlessBtn.type = "button";
  bar.appendChild(endlessBtn);

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 无尽砖塔 · 最好 ${best} 分` : "♾️ 无尽砖塔";
  }

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    modeHost.innerHTML = "";
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  const onEndless = () => {
    if (mode) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = mountTower(modeHost, api, closeMode);
  };
  endlessBtn.addEventListener("click", onEndless);
  refreshBar();

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 开打的时候把模式条收起来：360px 竖屏上球台要占满整宽
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy: () => {
            if (!mode) bar.hidden = false;
            handle.destroy?.();
          }
        };
      },
      guide: GUIDE,
      guideTitle: "碰碰砖块 · 弹道手册",
      mapHint: "一颗爱心都不丢就是 3 星，先在砖阵侧面开条通道！",
      grandMessage: "188 座砖阵全部打穿，你的弹道预判已经很老练了！"
    }
  );

  return {
    destroy() {
      endlessBtn.removeEventListener("click", onEndless);
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    }
  };
}
