import { meta } from "./meta";
export { meta };

import { save } from "../../engine/save";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import guide from "./guide";
import {
  GHOST_COLORS,
  GHOST_NAMES,
  TIER_LABELS,
  frightWarning,
  type Ghost,
} from "./ghosts";
import { MAX_CELL_PX, cellPxFor, maxCanvasWidth } from "./layout";
import { CHAPTERS, configFor, endlessConfig, planFor, rateLevel } from "./levels";
import {
  canTurn,
  cellIndex,
  stepCell,
  type Cell,
  type Dir,
  type Maze,
} from "./maze";
import {
  FRUITS,
  clearTurn,
  createRun,
  remaining,
  requestTurn,
  steerGhost,
  stepRun,
  type RunConfig,
  type RunState,
} from "./logic";

/** 平台内置的那几个音效。声音一律走 api.play，游戏自己不建音频上下文 */
export type Sfx = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

/** 豆子被收走之后缩多久 */
const POP_MS = 180;

/** 小幽灵变蓝 / 变回来的过渡时长 */
const BLUE_FADE_MS = 220;

/** 惊吓时的「昏昏蓝」 */
const FRIGHT_BLUE = "#7FA9FF";

/** 在两个颜色之间取插值，t=0 给 a，t=1 给 b */
export function mixColor(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const pick = (hex: string, at: number): number => parseInt(hex.slice(at, at + 2), 16);
  const out: number[] = [];
  for (let i = 1; i < 7; i += 2) {
    out.push(Math.round(pick(a, i) + (pick(b, i) - pick(a, i)) * k));
  }
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const CSS = `
.dmz-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#FFFBEA,#F4F0FF);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;position:relative;}
.dmz-hud{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;margin-bottom:8px;}
.dmz-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:800;color:#8a6a2f;
  box-shadow:0 2px 6px rgba(180,160,90,.25);white-space:nowrap;}
.dmz-canvas{display:block;width:100%;height:auto;border-radius:14px;background:#241f3a;touch-action:none;}
.dmz-note{text-align:center;min-height:20px;font-size:13px;font-weight:700;color:#7a6aa0;margin-top:8px;}
.dmz-pad{display:grid;grid-template-columns:repeat(3,minmax(48px,1fr));gap:6px;justify-content:center;margin:10px auto 0;max-width:220px;}
.dmz-key{border:none;border-radius:14px;min-height:48px;font-size:20px;font-weight:900;color:#6b5a90;cursor:pointer;
  background:#ffffffd9;box-shadow:0 3px 0 rgba(120,90,160,.25);font-family:inherit;}
.dmz-key:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.25);}
.dmz-key-blank{visibility:hidden;}
.dmz-menu{display:flex;flex-direction:column;gap:10px;align-items:center;padding:8px 4px 4px;}
.dmz-title{font-size:19px;font-weight:900;color:#7a5da8;text-align:center;}
.dmz-sub{font-size:13px;font-weight:700;color:#8b7bb0;text-align:center;line-height:1.6;max-width:330px;}
.dmz-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;width:100%;max-width:420px;}
.dmz-mode{border:none;border-radius:16px;padding:14px 10px;font-size:16px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#c88a43,#ad6f2f);box-shadow:0 4px 0 #8d581f;}
.dmz-mode:active{transform:translateY(2px);box-shadow:0 2px 0 #8d581f;}
.dmz-mode.dmz-mode-b{background:linear-gradient(180deg,#5470c0,#4560ab);box-shadow:0 4px 0 #34498a;}
.dmz-mode.dmz-mode-c{background:linear-gradient(180deg,#4fa77c,#3d8c66);box-shadow:0 4px 0 #2e6d4f;}
.dmz-mode.dmz-mode-d{background:linear-gradient(180deg,#c05490,#a5457a);box-shadow:0 4px 0 #843761;}
.dmz-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;}
.dmz-btn{border:none;border-radius:999px;padding:8px 14px;min-height:44px;font-size:14px;font-weight:800;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;
  font-family:inherit;background:#ffffffd9;color:#6b5a90;box-shadow:0 3px 0 rgba(120,90,160,.22);}
.dmz-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.22);}
.dmz-btn[aria-pressed="true"]{background:#ffe6b8;color:#7a5520;}
.dmz-tip{font-size:12px;font-weight:700;color:#9a8bb8;text-align:center;line-height:1.6;}
@media (max-width:420px){
  .dmz-chip{font-size:13px;padding:4px 9px;}
  .dmz-title{font-size:17px;}
}
@media (prefers-reduced-motion:reduce){
  .dmz-key:active,.dmz-mode:active,.dmz-btn:active{transform:none;}
}
`;

function reducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return mm ? mm("(prefers-reduced-motion: reduce)").matches : false;
  } catch {
    return false;
  }
}

const KEY_DIR_DUO: Record<string, Dir> = {
  w: "up",
  a: "left",
  s: "down",
  d: "right",
};

const KEY_DIR_STAR: Record<string, Dir> = {
  arrowup: "up",
  arrowleft: "left",
  arrowdown: "down",
  arrowright: "right",
};

export type StarRole = "none" | "eater" | "ghost";

export interface StageOptions {
  cfg: RunConfig;
  starRole: StarRole;
  /** 顶部标题 */
  label: string;
  /** 结算回调：won 表示朵朵这边达成目标 */
  onEnd: (result: { won: boolean; score: number; livesLeft: number; starScore: number }) => void;
  /** 每帧回调（HUD 额外信息） */
  extraChip?: () => string;
  /** 音效，只走平台内置的那七个 */
  play?: (name: Sfx) => void;
}

interface StarEater {
  cell: Cell;
  dir: Dir;
  next: Dir;
  score: number;
  cd: number;
}

/**
 * 一局迷宫的 Canvas 舞台。负责渲染、键盘 / 触屏输入与 rAF 循环，
 * 全部规则都在 logic.ts / ghosts.ts / maze.ts 里，这里只做表现。
 */
export function mountStage(host: HTMLElement, opts: StageOptions): { destroy: () => void } {
  const soft = reducedMotion();
  const wrap = document.createElement("div");
  wrap.className = "dmz-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="dmz-hud">
      <span class="dmz-chip dmz-score">🍬 0</span>
      <span class="dmz-chip dmz-lives">⭐ 0</span>
      <span class="dmz-chip dmz-left">🫐 0</span>
      <span class="dmz-chip dmz-extra">${opts.label}</span>
    </div>
    <canvas class="dmz-canvas"></canvas>
    <div class="dmz-note"></div>
    <div class="dmz-pad">
      <button type="button" class="dmz-key dmz-key-blank" tabindex="-1"></button>
      <button type="button" class="dmz-key" data-dir="up" aria-label="向上">▲</button>
      <button type="button" class="dmz-key dmz-key-blank" tabindex="-1"></button>
      <button type="button" class="dmz-key" data-dir="left" aria-label="向左">◀</button>
      <button type="button" class="dmz-key" data-dir="down" aria-label="向下">▼</button>
      <button type="button" class="dmz-key" data-dir="right" aria-label="向右">▶</button>
    </div>`;
  host.appendChild(wrap);

  const canvas = wrap.querySelector(".dmz-canvas") as HTMLCanvasElement;
  const scoreEl = wrap.querySelector(".dmz-score") as HTMLElement;
  const livesEl = wrap.querySelector(".dmz-lives") as HTMLElement;
  const leftEl = wrap.querySelector(".dmz-left") as HTMLElement;
  const extraEl = wrap.querySelector(".dmz-extra") as HTMLElement;
  const noteEl = wrap.querySelector(".dmz-note") as HTMLElement;

  const sfx = opts.play ?? ((): void => {});
  // 追逃模式里星星操纵第 0 只小幽灵：交给 logic 记下来，AI 就不会再覆盖它的方向
  const cfg: RunConfig = opts.starRole === "ghost" ? { ...opts.cfg, controlled: 0 } : opts.cfg;
  const state: RunState = createRun(cfg, 20240612);
  const maze: Maze = state.maze;
  let star: StarEater | null = null;
  if (opts.starRole === "eater") {
    star = {
      cell: { x: maze.w - 2, y: 1 },
      dir: "left",
      next: "left",
      score: 0,
      cd: opts.cfg.stepMs,
    };
    // 星星的出生格不能是墙
    if (maze.wall[cellIndex(maze, star.cell.x, star.cell.y)]) star.cell = { ...maze.spawn };
  }

  // 画布按屏宽定分辨率，再用 max-width 挡住大屏上的过度拉伸。
  // 360px 下能不能保住 14px/格由 layout.mazeFits 兜底，layout.test.ts 逐关断言。
  const viewport = typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 420;
  const cell = cellPxFor(viewport, maze.w);
  canvas.width = maze.w * cell;
  canvas.height = maze.h * cell;
  canvas.style.maxWidth = `${maxCanvasWidth(maze.w)}px`;
  // 读屏和冒烟脚本都靠这两个属性认迷宫：列数用来反推每格实际占多少像素
  canvas.setAttribute("role", "img");
  canvas.setAttribute("data-cols", String(maze.w));
  const ctx = canvas.getContext("2d");

  let raf = 0;
  let last = 0;
  let paused = false;
  let finished = false;
  let destroyed = false;

  /** 刚被收走的豆子：原地缩一下再消失（规格第九节），减弱动效时直接不记 */
  const pops: Array<{ cell: Cell; leftMs: number }> = [];
  /** 每只小幽灵的「蓝度」0–1，用来把变蓝和变回来做成过渡而不是硬切 */
  const blue: number[] = state.ghosts.map(() => 0);

  function notePop(cell: Cell): void {
    if (soft) return;
    pops.push({ cell: { ...cell }, leftMs: POP_MS });
  }

  function agePops(dt: number): void {
    for (let i = pops.length - 1; i >= 0; i--) {
      pops[i].leftMs -= dt;
      if (pops[i].leftMs <= 0) pops.splice(i, 1);
    }
  }

  function easeBlue(dt: number): void {
    const step = soft ? 1 : dt / BLUE_FADE_MS;
    state.ghosts.forEach((g, i) => {
      const want = g.mood === "fright" ? 1 : 0;
      const cur = blue[i] ?? 0;
      blue[i] = cur < want ? Math.min(want, cur + step) : Math.max(want, cur - step);
    });
  }

  function finish(won: boolean): void {
    if (finished) return;
    finished = true;
    stop();
    opts.onEnd({
      won,
      score: state.score,
      livesLeft: state.lives,
      starScore: star ? star.score : 0,
    });
  }

  function stop(): void {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function moveStarEater(dt: number): void {
    if (!star) return;
    star.cd -= dt;
    let guard = 0;
    while (star.cd <= 0 && guard++ < 6) {
      if (canTurn(maze, star.cell, star.next)) star.dir = star.next;
      if (canTurn(maze, star.cell, star.dir)) {
        star.cell = stepCell(maze, star.cell, star.dir);
        const i = cellIndex(maze, star.cell.x, star.cell.y);
        if (maze.dot[i]) {
          maze.dot[i] = false;
          star.score += 10;
          notePop(star.cell);
        } else if (maze.power[i]) {
          maze.power[i] = false;
          star.score += 50;
          notePop(star.cell);
        }
      }
      star.cd += opts.cfg.stepMs;
    }
  }

  function draw(): void {
    if (!ctx) return;
    ctx.fillStyle = "#241f3a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 墙
    for (let y = 0; y < maze.h; y++) {
      for (let x = 0; x < maze.w; x++) {
        const i = cellIndex(maze, x, y);
        const px = x * cell;
        const py = y * cell;
        if (maze.wall[i]) {
          ctx.fillStyle = "#4b5ea8";
          roundRect(ctx, px + 1.5, py + 1.5, cell - 3, cell - 3, 5);
          ctx.fill();
          continue;
        }
        if (maze.dot[i]) {
          ctx.fillStyle = "#FFE9A8";
          ctx.beginPath();
          ctx.arc(px + cell / 2, py + cell / 2, 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (maze.power[i]) {
          const pulse = soft ? 1 : 1 + Math.sin(state.elapsed / 180) * 0.18;
          ctx.fillStyle = "#FFD1E8";
          ctx.beginPath();
          ctx.arc(px + cell / 2, py + cell / 2, 4.6 * pulse, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // 刚被收走的豆子：原地缩一下再没
    for (const p of pops) {
      const k = p.leftMs / POP_MS;
      ctx.globalAlpha = k;
      ctx.fillStyle = "#FFF3C4";
      ctx.beginPath();
      ctx.arc(p.cell.x * cell + cell / 2, p.cell.y * cell + cell / 2, 2.2 + (1 - k) * 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 果子
    if (state.fruit) {
      ctx.font = `${cell - 4}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(FRUITS[state.fruit.kind].emoji, state.fruit.cell.x * cell + cell / 2, state.fruit.cell.y * cell + cell / 2);
    }
    // 小幽灵
    state.ghosts.forEach((g, i) => {
      drawGhost(g, i === state.controlled, blue[i] ?? 0);
    });
    // 星星（抢豆模式）
    if (star) {
      ctx.fillStyle = "#8FD8FF";
      ctx.beginPath();
      ctx.arc(star.cell.x * cell + cell / 2, star.cell.y * cell + cell / 2, cell * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
    // 玩家：原创小圆脸，张嘴幅度跟着步进走
    const mouth = soft ? 0.28 : 0.1 + Math.abs(Math.sin(state.elapsed / 90)) * 0.35;
    const cx = state.player.x * cell + cell / 2;
    const cy = state.player.y * cell + cell / 2;
    const base: Record<Dir, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
    ctx.fillStyle = state.graceMs > 0 && !soft && Math.floor(state.elapsed / 120) % 2 === 0 ? "#FFF6C9" : "#FFD84D";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, cell * 0.4, base[state.dir] + mouth, base[state.dir] - mouth + Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    // 迷雾
    if (opts.cfg.fog) {
      const grad = ctx.createRadialGradient(cx, cy, cell * 2.2, cx, cy, cell * 5.4);
      grad.addColorStop(0, "rgba(36,31,58,0)");
      grad.addColorStop(1, "rgba(36,31,58,0.92)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawGhost(g: Ghost, isStar: boolean, blueness: number): void {
    if (!ctx) return;
    const gx = g.cell.x * cell + cell / 2;
    const gy = g.cell.y * cell + cell / 2;
    if (g.mood === "eyes") {
      ctx.fillStyle = "#EAF2FF";
      ctx.beginPath();
      ctx.arc(gx - 3, gy - 1, 2.6, 0, Math.PI * 2);
      ctx.arc(gx + 3, gy - 1, 2.6, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    // 变蓝和变回来都走过渡，不硬切颜色
    let color = mixColor(GHOST_COLORS[g.kind], FRIGHT_BLUE, blueness);
    if (g.mood === "fright" && frightWarning(g) && !soft && Math.floor(state.elapsed / 150) % 2 === 0) {
      color = "#FFFFFF";
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(gx, gy - 1, cell * 0.38, Math.PI, 0);
    ctx.lineTo(gx + cell * 0.38, gy + cell * 0.3);
    ctx.lineTo(gx, gy + cell * 0.16);
    ctx.lineTo(gx - cell * 0.38, gy + cell * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2f2a45";
    ctx.beginPath();
    ctx.arc(gx - 3.4, gy - 2, 1.8, 0, Math.PI * 2);
    ctx.arc(gx + 3.4, gy - 2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    if (isStar) {
      ctx.strokeStyle = "#FFF3B0";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(gx, gy, cell * 0.46, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (frightWarning(g) && soft) {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(gx, gy, cell * 0.44, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function renderHud(): void {
    scoreEl.textContent = star ? `🍬 朵朵 ${state.score} · 星星 ${star.score}` : `🍬 ${state.score}`;
    livesEl.textContent = `⭐ ${"●".repeat(Math.max(0, state.lives))}`;
    leftEl.textContent = `🫐 剩 ${remaining(state)}`;
    extraEl.textContent = opts.extraChip ? opts.extraChip() : opts.label;
    noteEl.textContent = paused ? "已暂停，按 Esc 继续。" : state.notice;
    canvas.setAttribute(
      "aria-label",
      `朵朵${state.score}分，小星命${state.lives}，剩${remaining(state)}颗豆${paused ? "，已暂停" : ""}`
    );
  }

  // 上一帧的几个数，用来判断这一帧该响哪个音
  let lastScore = state.score;
  let lastLives = state.lives;
  let lastChain = state.chain;
  let lastFright = false;

  function speak(): void {
    const fright = state.ghosts.some((g) => g.mood === "fright");
    if (state.lives < lastLives) sfx("oops");
    else if (state.chain > lastChain) sfx("meow");
    else if (fright && !lastFright) sfx("pop");
    else if (state.score > lastScore) sfx("coin");
    lastScore = state.score;
    lastLives = state.lives;
    lastChain = state.chain;
    lastFright = fright;
  }

  function frame(now: number): void {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    const dt = Math.min(80, now - last);
    last = now;
    if (paused || finished) {
      draw();
      renderHud();
      return;
    }
    const dotsBefore = remaining(state);
    stepRun(state, dt);
    if (remaining(state) < dotsBefore) notePop(state.player);
    moveStarEater(dt);
    agePops(dt);
    easeBlue(dt);
    speak();
    draw();
    renderHud();
    if (state.over) {
      sfx(state.won ? "win" : "oops");
      if (star) finish(state.score >= star.score);
      else finish(state.won);
    } else if (star && remaining(state) === 0) {
      sfx("win");
      finish(state.score >= star.score);
    }
  }

  function onKey(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    if (key === "escape") {
      paused = !paused;
      sfx("tap");
      renderHud();
      e.preventDefault();
      return;
    }
    const duo = KEY_DIR_DUO[key];
    if (duo) {
      requestTurn(state, duo, state.elapsed);
      e.preventDefault();
      return;
    }
    const starDir = KEY_DIR_STAR[key];
    if (starDir) {
      if (star) star.next = starDir;
      else if (opts.starRole === "ghost") steerGhost(state, starDir);
      // 单人玩的时候方向键和 WASD 等价，两只手随便用哪一套
      else requestTurn(state, starDir, state.elapsed);
      e.preventDefault();
      return;
    }
    // 取消键：朵朵 G、星星 K，把提前按下、还没到路口的那次转向撤回来。
    // 迷宫里没有「确认」这一步，所以 F / L 不接（攻略里已写明）。
    if (key === "g") {
      clearTurn(state);
      e.preventDefault();
      return;
    }
    if (key === "k") {
      cancelStarTurn();
      e.preventDefault();
    }
  }

  /** 星星那一侧的「撤回转向」：抢豆的星星把待转方向收回当前方向，操纵小幽灵时同理，单人局归朵朵 */
  function cancelStarTurn(): void {
    if (star) star.next = star.dir;
    else if (opts.starRole === "ghost") steerGhost(state, state.ghosts[state.controlled]?.dir ?? state.controlledDir);
    else clearTurn(state);
  }

  const padButtons = Array.from(wrap.querySelectorAll<HTMLButtonElement>(".dmz-key[data-dir]"));
  const padHandlers: Array<() => void> = [];
  for (const btn of padButtons) {
    const dir = btn.dataset.dir as Dir;
    const handler = (): void => requestTurn(state, dir, state.elapsed);
    btn.addEventListener("click", handler);
    padHandlers.push(() => btn.removeEventListener("click", handler));
  }

  let touchStart: { x: number; y: number } | null = null;
  function onTouchStart(e: TouchEvent): void {
    const t = e.touches[0];
    if (t) touchStart = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: TouchEvent): void {
    const t = e.changedTouches[0];
    if (!t || !touchStart) return;
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    requestTurn(state, dir, state.elapsed);
  }
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });
  canvas.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("keydown", onKey);

  renderHud();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      finished = true;
      stop();
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      for (const off of padHandlers) off();
      wrap.remove();
    },
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg = configFor(ctx.level);
  const plan = planFor(ctx.level);
  const handle = mountStage(stage, {
    cfg,
    starRole: plan.duoChase ? "ghost" : "none",
    label: `${TIER_LABELS[plan.tier]}档`,
    play: (name) => ctx.sfx(name),
    extraChip: () => `${TIER_LABELS[plan.tier]}档 · ${plan.ghostCount} 只小幽灵`,
    onEnd: ({ won, livesLeft }) => {
      if (won) ctx.win(rateLevel(livesLeft, cfg.lives), "豆子全部吃光，路线走得很干净！");
      else ctx.lose("被绕晕啦，深呼吸再来一次。");
    },
  });
  return { destroy: () => handle.destroy() };
}

function mountCampaign(host: HTMLElement, api: GameApi): { destroy: () => void } {
  return mountLevelGame({ ...api, root: host }, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,
    guide,
    mapHint: "提前按转向就会记住，到路口自动拐。",
    grandMessage: "188 张迷宫全部清空，你已经是走位高手了！",
  });
}

interface SimpleModeOptions {
  title: string;
  hint: string;
  starRole: StarRole;
  makeConfig: (round: number) => RunConfig;
  /** 结束时怎么算成绩 */
  onRoundEnd: (info: { won: boolean; score: number; starScore: number }, next: (again: boolean) => void) => void;
}

function mountRounds(host: HTMLElement, api: GameApi, opts: SimpleModeOptions): { destroy: () => void } {
  let current: { destroy: () => void } | null = null;
  let round = 0;
  let destroyed = false;
  const box = document.createElement("div");
  host.appendChild(box);

  function start(): void {
    if (destroyed) return;
    current?.destroy();
    box.innerHTML = "";
    const info = document.createElement("div");
    info.className = "dmz-tip";
    info.textContent = opts.hint;
    box.appendChild(info);
    current = mountStage(box, {
      cfg: opts.makeConfig(round),
      starRole: opts.starRole,
      label: opts.title,
      play: (name) => api.play(name),
      extraChip: () => `${opts.title} · 第 ${round + 1} 轮`,
      onEnd: ({ won, score, starScore }) => {
        api.play(won ? "win" : "oops");
        opts.onRoundEnd({ won, score, starScore }, (again) => {
          if (again) {
            round += 1;
            start();
          } else {
            round = 0;
            start();
          }
        });
      },
    });
  }

  start();
  return {
    destroy() {
      destroyed = true;
      current?.destroy();
      box.remove();
    },
  };
}

/**
 * 无尽收场那一句。
 *
 * `recordEndlessBest` 返回的是**已经把本轮算进去之后**的最好成绩，所以要另外记一份
 * 「投这一轮之前的纪录」才分得出破没破（`R3-PA-DM-1`：第一次玩本轮就是历史最好，
 * 原来的措辞却还在催人去刷新一个刚创下的成绩，也没有一句「新纪录」）。
 */
export function endlessLine(score: number, before: number, best: number): string {
  if (score > before) return `这一轮拿到 ${score} 分，是你的新纪录!下次还能再往上冲。`;
  return `这一轮拿到 ${score} 分，历史最好 ${best} 分。再来一次就能刷新它!`;
}

export function mount(api: GameApi): { destroy: () => void } {
  let child: { destroy: () => void } | null = null;
  const wrap = document.createElement("div");
  wrap.className = "dmz-wrap";
  const style = document.createElement("style");
  style.textContent = CSS;
  wrap.appendChild(style);
  const view = document.createElement("div");
  wrap.appendChild(view);
  api.root.appendChild(wrap);

  let totalScore = 0;

  function clear(): void {
    child?.destroy();
    child = null;
    view.innerHTML = "";
  }

  function backBar(label: string): HTMLElement {
    const row = document.createElement("div");
    row.className = "dmz-row";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "dmz-btn";
    back.textContent = "◀ 换个玩法";
    back.addEventListener("click", () => {
      api.play("tap");
      showMenu();
    });
    const tag = document.createElement("span");
    tag.className = "dmz-chip";
    tag.textContent = label;
    row.append(back, tag);
    return row;
  }

  function showMenu(): void {
    clear();
    const menu = document.createElement("div");
    menu.className = "dmz-menu";
    menu.innerHTML = `
      <div class="dmz-title">🟡 豆豆迷宫</div>
      <div class="dmz-sub">四只迷途小幽灵脾气各不相同：${GHOST_NAMES.zhi}直追、${GHOST_NAMES.guai}抄前路、${GHOST_NAMES.rao}包夹、${GHOST_NAMES.luan}远则乱走。能量豆一亮，它们就变成昏昏蓝。</div>`;
    const grid = document.createElement("div");
    grid.className = "dmz-modes";
    const modes: Array<{ label: string; cls: string; run: () => void }> = [
      { label: "🚩 闯关 188", cls: "", run: startCampaign },
      { label: "♾️ 无尽迷宫", cls: "dmz-mode-b", run: startEndless },
      { label: "⚔️ 抢豆对战", cls: "dmz-mode-c", run: startVersus },
      { label: "👫 双人追逃", cls: "dmz-mode-d", run: startTwoPlayer },
    ];
    for (const m of modes) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `dmz-mode ${m.cls}`;
      btn.textContent = m.label;
      btn.addEventListener("click", () => {
        api.play("tap");
        m.run();
      });
      grid.appendChild(btn);
    }
    menu.appendChild(grid);
    const tip = document.createElement("div");
    tip.className = "dmz-tip";
    tip.textContent =
      "朵朵：WASD 或滑动屏幕｜星星：方向键｜Esc 暂停。无尽最高分：" +
      save.getGameProgress(meta.id).endlessBest;
    menu.appendChild(tip);
    view.appendChild(menu);
  }

  function startCampaign(): void {
    clear();
    view.appendChild(backBar("闯关 188"));
    const host = document.createElement("div");
    view.appendChild(host);
    child = mountCampaign(host, api);
  }

  function startEndless(): void {
    clear();
    view.appendChild(backBar("无尽迷宫"));
    const host = document.createElement("div");
    view.appendChild(host);
    totalScore = 0;
    child = mountRounds(host, api, {
      title: "无尽",
      hint: "地图一圈比一圈快，掉光小星命就结算最高分。",
      starRole: "none",
      makeConfig: (round) => endlessConfig(round),
      onRoundEnd: ({ won, score }, next) => {
        totalScore += score;
        if (won) {
          next(true);
          return;
        }
        // 先读旧纪录再记这一轮，不然「历史最好」已经把本轮算进去了，
        // 破没破纪录就分不出来 —— 第一次玩会被劝去刷新一个刚创下的成绩。
        const before = save.getGameProgress(meta.id).endlessBest;
        const best = save.recordEndlessBest(meta.id, totalScore);
        api.onLose(endlessLine(totalScore, before, best));
        next(false);
      },
    });
  }

  function startVersus(): void {
    clear();
    view.appendChild(backBar("抢豆对战"));
    const host = document.createElement("div");
    view.appendChild(host);
    child = mountRounds(host, api, {
      title: "抢豆",
      hint: "同一张图两个人抢豆：朵朵 WASD，星星方向键，豆子吃完分高者胜。",
      starRole: "eater",
      makeConfig: (round) => ({ ...configFor(60 + round * 9), fog: false }),
      onRoundEnd: ({ won, score, starScore }, next) => {
        if (won) api.onWin(2, `朵朵 ${score} 分对星星 ${starScore} 分，这一局朵朵赢啦！`);
        else api.onLose(`星星 ${starScore} 分对朵朵 ${score} 分，下一局换条路线试试。`);
        next(true);
      },
    });
  }

  function startTwoPlayer(): void {
    clear();
    view.appendChild(backBar("双人追逃"));
    const host = document.createElement("div");
    view.appendChild(host);
    child = mountRounds(host, api, {
      title: "追逃",
      hint: "朵朵用 WASD 清豆，星星用方向键操纵带光圈的那只小幽灵。",
      starRole: "ghost",
      makeConfig: (round) => configFor(150 + round * 7),
      onRoundEnd: ({ won, score }, next) => {
        if (won) api.onWin(2, `朵朵清光了豆子，拿到 ${score} 分！`);
        else api.onLose("星星这一局守得真严，换个人来试试。");
        next(true);
      },
    });
  }

  showMenu();

  return {
    destroy() {
      clear();
      wrap.remove();
    },
  };
}
