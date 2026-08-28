import { meta } from "./meta";
export { meta };

import { save } from "../../engine/save";
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import {
  WALL_THEMES,
  drawBackdrop,
  drawGhostFigure,
  drawPlayerFigure,
  drawWalls,
  dotSprite,
  fruitSprite,
  lifeBadgeSVG,
  powerSprite,
  versusStarSprite,
  wallThemeIndex,
} from "./art";
import guide from "./guide";
import {
  GHOST_COLORS,
  GHOST_NAMES,
  TIER_LABELS,
  frightScore,
  frightWarning,
  type Ghost,
} from "./ghosts";
import { MAX_CELL_PX, canvasDisplayCapPx, cellPxFor, maxCanvasWidth } from "./layout";
import { CHAPTERS, configFor, endlessConfig, planFor, rateLevel } from "./levels";
import {
  DELTA,
  canTurn,
  cellIndex,
  stepCell,
  type Cell,
  type Dir,
  type Maze,
} from "./maze";
import {
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

/** 被抓之后委屈脸持续多久（纯表现，重生节奏在 logic 里没变） */
const SAD_MS = 400;

/** 连击分数飘字飘多久（纯表现） */
const FLOAT_MS = 700;

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
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;position:relative;
  /* 撑满壳层舞台:进门菜单只有半屏内容时,下面不再露一大块白底(1.3 UX 走查) */
  flex:1 0 auto;display:flex;flex-direction:column;}
.dmz-view{flex:1;display:flex;flex-direction:column;min-height:0;}
.dmz-view>*{flex:0 0 auto;}
.dmz-hud{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;margin-bottom:8px;}
.dmz-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:14px;font-weight:800;color:#8a6a2f;
  box-shadow:0 2px 6px rgba(180,160,90,.25);white-space:nowrap;}
.dmz-canvas{display:block;width:100%;height:auto;border-radius:14px;background:#241f3a;touch-action:none;}
.dmz-note{text-align:center;min-height:20px;font-size:14px;font-weight:700;color:#7a6aa0;margin-top:8px;}
.dmz-playfield{display:flex;flex-direction:column;min-width:0;}
.dmz-side{min-width:0;}
.dmz-pad{display:grid;grid-template-columns:repeat(3,minmax(48px,1fr));gap:6px;justify-content:center;margin:10px auto 0;max-width:220px;
  position:sticky;bottom:0;z-index:3;background:linear-gradient(180deg,#fffbeaf2,#f4f0fff8);padding:6px 0 2px;}
.dmz-key{border:none;border-radius:14px;min-height:48px;font-size:20px;font-weight:900;color:#6b5a90;cursor:pointer;
  background:#ffffffd9;box-shadow:0 3px 0 rgba(120,90,160,.25);font-family:inherit;}
.dmz-key:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,90,160,.25);}
.dmz-key-blank{visibility:hidden;}
.dmz-pause{background:#fff3d6;color:#8a6a2f;font-size:17px;}
/* 双人局:朵朵、星星各一套方向键并排,没有键盘的手机/平板也能俩人一起玩(1.3 UX 走查修复) */
.dmz-pads{display:flex;gap:12px;justify-content:center;align-items:flex-start;flex-wrap:wrap;margin-top:10px;
  position:sticky;bottom:0;z-index:3;background:linear-gradient(180deg,#fffbeaf2,#f4f0fff8);padding:6px 0 2px;}
.dmz-pads .dmz-pad{margin:0;}
.dmz-pad-col{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;}
.dmz-pad-t{font-size:14px;font-weight:900;color:#8b7bb0;}
.dmz-pad-star .dmz-key{color:#4560ab;box-shadow:0 3px 0 rgba(84,112,192,.3);}
.dmz-pad-star .dmz-key:active{box-shadow:0 1px 0 rgba(84,112,192,.3);}
.dmz-menu{display:flex;flex-direction:column;gap:10px;align-items:center;padding:8px 4px 4px;
  /* 菜单占满剩余高并垂直居中,别缩在舞台顶上 */
  flex:1;justify-content:center;}
.dmz-title{font-size:19px;font-weight:900;color:#7a5da8;text-align:center;}
.dmz-sub{font-size:14px;font-weight:700;color:#8b7bb0;text-align:center;line-height:1.6;max-width:330px;}
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
.dmz-tip{font-size:14px;font-weight:700;color:#9a8bb8;text-align:center;line-height:1.6;}
@media (max-width:420px){
  .dmz-chip{font-size:14px;padding:4px 9px;}
  .dmz-title{font-size:17px;}
  /* 360px 上两套键盘并排:格子收到 44px 下限、缝收窄,一排正好放得下 */
  .dmz-pads{gap:8px;}
  .dmz-pads .dmz-pad{grid-template-columns:repeat(3,minmax(44px,1fr));gap:4px;}
  .dmz-pads .dmz-key{min-height:44px;font-size:17px;}
}
@media (prefers-reduced-motion:reduce){
  .dmz-key:active,.dmz-mode:active,.dmz-btn:active{transform:none;}
}
@media (max-height:500px) and (min-width:700px){
  .dmz-playfield{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;}
  .dmz-pad,.dmz-pads{margin-top:0;position:static;background:transparent;padding:0;}
  .dmz-pads{flex-direction:column;}
  .dmz-note{margin-top:0;}
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
  /** 墙色主题下标（WALL_THEMES），闯关每 47 关换一套；省略用第一套 */
  theme?: number;
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
  const duoPad = `
    <div class="dmz-pad">
      <button type="button" class="dmz-key dmz-pause" data-act="pause" aria-label="暂停">⏸</button>
      <button type="button" class="dmz-key" data-dir="up" aria-label="向上">▲</button>
      <button type="button" class="dmz-key dmz-key-blank" tabindex="-1" aria-hidden="true"></button>
      <button type="button" class="dmz-key" data-dir="left" aria-label="向左">◀</button>
      <button type="button" class="dmz-key" data-dir="down" aria-label="向下">▼</button>
      <button type="button" class="dmz-key" data-dir="right" aria-label="向右">▶</button>
    </div>`;
  // 双人局星星没有键盘就动不了:给她单独一套触屏方向键,和朵朵的并排
  const padSection =
    opts.starRole === "none"
      ? duoPad
      : `
    <div class="dmz-pads">
      <div class="dmz-pad-col">
        <div class="dmz-pad-t">🌸 朵朵</div>
        ${duoPad}
      </div>
      <div class="dmz-pad-col dmz-pad-star">
        <div class="dmz-pad-t">⭐ 星星</div>
        <div class="dmz-pad">
          <button type="button" class="dmz-key dmz-key-blank" tabindex="-1" aria-hidden="true"></button>
          <button type="button" class="dmz-key" data-star-dir="up" aria-label="星星向上">▲</button>
          <button type="button" class="dmz-key dmz-key-blank" tabindex="-1" aria-hidden="true"></button>
          <button type="button" class="dmz-key" data-star-dir="left" aria-label="星星向左">◀</button>
          <button type="button" class="dmz-key" data-star-dir="down" aria-label="星星向下">▼</button>
          <button type="button" class="dmz-key" data-star-dir="right" aria-label="星星向右">▶</button>
        </div>
      </div>
    </div>`;
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="dmz-hud">
      <span class="dmz-chip dmz-score">🍬 0</span>
      <span class="dmz-chip dmz-lives">⭐ 0</span>
      <span class="dmz-chip dmz-left">🫐 0</span>
      <span class="dmz-chip dmz-extra">${opts.label}</span>
    </div>
    <div class="dmz-playfield">
      <canvas class="dmz-canvas"></canvas>
      <div class="dmz-side">
        <div class="dmz-note"></div>
        ${padSection}
      </div>
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

  // 静态层：夜空底色 + 星点 + 霓虹连通墙。墙在一局里不会变，
  // 开局预渲染一次，之后每帧只要一次 drawImage，比逐格重画便宜
  const theme = WALL_THEMES[Math.max(0, opts.theme ?? 0) % WALL_THEMES.length];
  const still = document.createElement("canvas") as HTMLCanvasElement;
  still.width = canvas.width;
  still.height = canvas.height;
  const stillCtx = still.getContext("2d");
  if (stillCtx) {
    drawBackdrop(stillCtx, still.width, still.height, theme);
    drawWalls(stillCtx, maze, cell, theme);
  }

  let raf = 0;
  let last = 0;
  let paused = false;
  let finished = false;
  let destroyed = false;

  /** 刚被收走的豆子：原地缩一下再消失（规格第九节），减弱动效时直接不记 */
  const pops: Array<{ cell: Cell; leftMs: number }> = [];
  /** 每只小幽灵的「蓝度」0–1，用来把变蓝和变回来做成过渡而不是硬切 */
  const blue: number[] = state.ghosts.map(() => 0);
  /** 被抓后的委屈脸还要摆多少毫秒（纯表现） */
  let sadMs = 0;
  /** 连吃小幽灵的分数飘字（200/400/800/1600 的翻倍感），减弱动效时不记 */
  const floats: Array<{ x: number; y: number; text: string; leftMs: number }> = [];
  /** 开局共有多少颗豆，结算进度环按它算吃豆率 */
  const totalDots = remaining(state);

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
    // 背景 + 星点 + 墙：开局预渲染好的静态层
    ctx.drawImage(still, 0, 0);
    // 豆子与能量豆
    for (let y = 0; y < maze.h; y++) {
      for (let x = 0; x < maze.w; x++) {
        const i = cellIndex(maze, x, y);
        const px = x * cell;
        const py = y * cell;
        if (maze.dot[i]) {
          // 发光贴图整场复用；360px 最小格下 core 也还有 3px 以上，看得见
          const s = Math.max(6, cell * 0.62);
          ctx.drawImage(dotSprite(), px + (cell - s) / 2, py + (cell - s) / 2, s, s);
        } else if (maze.power[i]) {
          // 脉动节奏沿用旧版（elapsed/180、±0.18），soft 下静止也不旋转
          const pulse = soft ? 1 : 1 + Math.sin(state.elapsed / 180) * 0.18;
          const s = cell * 0.92 * pulse;
          if (soft) {
            ctx.drawImage(powerSprite(), px + (cell - s) / 2, py + (cell - s) / 2, s, s);
          } else {
            ctx.save();
            ctx.translate(px + cell / 2, py + cell / 2);
            ctx.rotate(((state.elapsed % 8000) / 8000) * Math.PI * 2);
            ctx.drawImage(powerSprite(), -s / 2, -s / 2, s, s);
            ctx.restore();
          }
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
    // 果子：画出来的贴图（emoji 只留在 HUD 播报文案里），soft 之外轻轻上下浮
    if (state.fruit) {
      const s = cell - 4;
      const bob = soft ? 0 : Math.sin(state.elapsed / 320) * cell * 0.06;
      ctx.drawImage(
        fruitSprite(state.fruit.kind),
        state.fruit.cell.x * cell + (cell - s) / 2,
        state.fruit.cell.y * cell + (cell - s) / 2 + bob,
        s,
        s
      );
    }
    // 小幽灵
    state.ghosts.forEach((g, i) => {
      drawGhost(g, i === state.controlled, blue[i] ?? 0);
    });
    // 星星（抢豆模式）：真五角星贴图，soft 之外带一点轻轻的摇摆
    if (star) {
      const s = cell * 0.94;
      const sx = star.cell.x * cell + cell / 2;
      const sy = star.cell.y * cell + cell / 2;
      if (soft) {
        ctx.drawImage(versusStarSprite(), sx - s / 2, sy - s / 2, s, s);
      } else {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.sin(state.elapsed / 480) * 0.22);
        ctx.drawImage(versusStarSprite(), -s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
    // 玩家：原创小圆脸（一只大眼睛 + 小呆毛，和任何街机角色都不同），张嘴幅度跟着步进走。
    // 无敌换色沿用 120ms 的闪烁节奏；soft 下不闪，只换成常亮的浅色。
    const mouth = soft ? 0.28 : 0.1 + Math.abs(Math.sin(state.elapsed / 90)) * 0.35;
    const cx = state.player.x * cell + cell / 2;
    const cy = state.player.y * cell + cell / 2;
    drawPlayerFigure(ctx, {
      x: cx,
      y: cy,
      r: cell * 0.4,
      dir: state.dir,
      mouth,
      flash: state.graceMs > 0 && (soft || Math.floor(state.elapsed / 120) % 2 === 0),
      shield: state.graceMs > 0 && !soft,
      sad: sadMs > 0,
    });
    // 迷雾
    if (opts.cfg.fog) {
      const grad = ctx.createRadialGradient(cx, cy, cell * 2.2, cx, cy, cell * 5.4);
      grad.addColorStop(0, "rgba(36,31,58,0)");
      grad.addColorStop(1, "rgba(36,31,58,0.92)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // 连击分数飘字（画在迷雾之上，soft 下根本不会入列）
    for (const f of floats) {
      const k = Math.max(0, f.leftMs / FLOAT_MS);
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.fillStyle = "#FFE27A";
      ctx.font = `900 ${Math.max(11, Math.round(cell * 0.62))}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.text, f.x * cell + cell / 2, f.y * cell + cell / 2 - (1 - k) * cell * 0.9);
      ctx.globalAlpha = 1;
    }
    // 一局收场：吃豆率进度环
    if (state.over) drawEndRing();
  }

  /** 结算的吃豆率进度环（纯展示，画在最后一帧上） */
  function drawEndRing(): void {
    if (!ctx) return;
    const eaten = Math.max(0, totalDots - remaining(state));
    const rate = totalDots > 0 ? eaten / totalDots : 0;
    const rx = canvas.width / 2;
    const ry = canvas.height / 2;
    const rr = Math.min(canvas.width, canvas.height) * 0.18;
    ctx.fillStyle = "rgba(36,31,58,0.74)";
    ctx.beginPath();
    ctx.arc(rx, ry, rr * 1.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(3, rr * 0.16);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(rx, ry, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#FFD84D";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + rate * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#FFF6C9";
    ctx.font = `900 ${Math.max(12, Math.round(rr * 0.52))}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(rate * 100)}%`, rx, ry);
  }

  function drawGhost(g: Ghost, isStar: boolean, blueness: number): void {
    if (!ctx) return;
    const gx = g.cell.x * cell + cell / 2;
    const gy = g.cell.y * cell + cell / 2;
    // 瞳孔顺着移动方向偏 1.2px
    const d = DELTA[g.dir];
    const pupil = { dx: d.dx * 1.2, dy: d.dy * 1.2 };
    if (g.mood === "eyes") {
      drawGhostFigure(ctx, {
        x: gx,
        y: gy,
        r: cell * 0.38,
        color: "#EAF2FF",
        mood: "eyes",
        pupil,
        starMark: false,
        warnRing: false,
      });
      return;
    }
    // 变蓝和变回来都走过渡，不硬切颜色；白闪预警沿用 150ms 节奏
    let color = mixColor(GHOST_COLORS[g.kind], FRIGHT_BLUE, blueness);
    if (g.mood === "fright" && frightWarning(g) && !soft && Math.floor(state.elapsed / 150) % 2 === 0) {
      color = "#FFFFFF";
    }
    drawGhostFigure(ctx, {
      x: gx,
      y: gy,
      r: cell * 0.38,
      color,
      mood: g.mood === "fright" ? "fright" : "normal",
      pupil,
      starMark: isStar,
      warnRing: frightWarning(g) && soft,
    });
  }

  // 生命数画成一排小豆豆脸；innerHTML 只在数目变化那一帧重建
  let livesShown = -1;

  function renderLives(): void {
    if (state.lives === livesShown) return;
    livesShown = state.lives;
    const n = Math.max(0, state.lives);
    livesEl.innerHTML = `⭐ ${lifeBadgeSVG().repeat(n)}`;
    livesEl.setAttribute("aria-label", `剩 ${n} 颗小星命`);
  }

  function renderHud(): void {
    scoreEl.textContent = star ? `🍬 朵朵 ${state.score} · 星星 ${star.score}` : `🍬 ${state.score}`;
    renderLives();
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
    const livesBefore = state.lives;
    const chainBefore = state.chain;
    stepRun(state, dt);
    if (remaining(state) < dotsBefore) notePop(state.player);
    // 被抓只是委屈 0.4 秒再出发：静态表情，soft 下也照常摆
    if (state.lives < livesBefore) sadMs = SAD_MS;
    else if (sadMs > 0) sadMs = Math.max(0, sadMs - dt);
    // 连吃小幽灵的分数飘字（soft 下不加新动效）
    if (state.chain > chainBefore && !soft) {
      floats.push({
        x: state.player.x,
        y: state.player.y,
        text: `+${frightScore(state.chain - 1)}`,
        leftMs: FLOAT_MS,
      });
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].leftMs -= dt;
      if (floats[i].leftMs <= 0) floats.splice(i, 1);
    }
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
      togglePause();
      e.preventDefault();
      return;
    }
    // 暂停就是暂停：除了 Esc，转向与取消一个都不接。
    // 不加这道闸的话，遮住的这段时间里按下的转向会攒在缓冲里，一恢复就集体生效。
    if (paused) return;
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

  // 手机上没有 Esc 键：方向键盘左上角那一格从占位改成暂停钮，和另外四款一样有触屏通路
  const pauseBtn = wrap.querySelector('.dmz-key[data-act="pause"]') as HTMLElement | null;

  function renderPause(): void {
    if (!pauseBtn) return;
    pauseBtn.textContent = paused ? "▶" : "⏸";
    pauseBtn.setAttribute("aria-label", paused ? "继续" : "暂停");
    pauseBtn.setAttribute("aria-pressed", String(paused));
  }

  function togglePause(): void {
    paused = !paused;
    sfx("tap");
    renderPause();
    renderHud();
  }

  const onPauseClick = (): void => togglePause();
  pauseBtn?.addEventListener("click", onPauseClick);

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
    const handler = (): void => {
      if (paused) return;
      requestTurn(state, dir, state.elapsed);
    };
    btn.addEventListener("click", handler);
    padHandlers.push(() => btn.removeEventListener("click", handler));
  }
  // 星星那套触屏键:抢豆局转小星星,追逃局转带光圈的小幽灵(和方向键走同一条路)
  const starPadButtons = Array.from(wrap.querySelectorAll<HTMLButtonElement>(".dmz-key[data-star-dir]"));
  for (const btn of starPadButtons) {
    const dir = btn.dataset.starDir as Dir;
    const handler = (): void => {
      if (paused) return;
      if (star) star.next = dir;
      else if (opts.starRole === "ghost") steerGhost(state, dir);
    };
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
    if (paused) {
      touchStart = null;
      return;
    }
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

  // ---- 画布显示高:量真实可视高再钳(见 layout.canvasDisplayCapPx 的注释) ----

  /** 一个盒子的下沿(测试桩的 rect 可能没有 bottom,用 top+height 兜底) */
  const rectBottom = (r: { top: number; bottom?: number; height: number }): number =>
    Number.isFinite(r.bottom) ? (r.bottom as number) : r.top + r.height;

  /** 往上找平台舞台(.game-stage,定高会裁内容)的下沿;量不到返回 NaN */
  function stageClipBottom(): number {
    let node: HTMLElement | null = wrap.parentElement ?? null;
    for (let i = 0; node && i < 10; i++) {
      if (typeof node.className === "string" && node.className.includes("game-stage")) {
        if (typeof node.getBoundingClientRect !== "function") break;
        const r = node.getBoundingClientRect();
        const inner =
          typeof node.clientHeight === "number" && node.clientHeight > 0
            ? (node.clientTop || 0) + node.clientHeight
            : r.height;
        if (Number.isFinite(r.top) && Number.isFinite(inner) && inner > 0) return r.top + inner;
        break;
      }
      node = node.parentElement ?? null;
    }
    return Number.NaN;
  }

  function fitCanvasDisplay(): void {
    if (destroyed || !canvas.style) return;
    if (typeof canvas.getBoundingClientRect !== "function" || typeof wrap.getBoundingClientRect !== "function") return;
    const clip = stageClipBottom();
    if (!Number.isFinite(clip)) return;
    // 先摘掉上一次的钳位再量:量到的必须是「本来要多高」
    canvas.style.maxHeight = "";
    const canvasRect = canvas.getBoundingClientRect();
    if (!Number.isFinite(canvasRect.top)) return;
    // 画布下面的家当(提示行 + 虚拟方向键):高度不随画布显示高变,量一次就是稳的
    const below = Math.max(0, rectBottom(wrap.getBoundingClientRect()) - rectBottom(canvasRect));
    const px = canvasDisplayCapPx(canvasRect.height, clip - canvasRect.top - below - 4);
    if (px !== null) canvas.style.maxHeight = `${px}px`;
  }

  fitCanvasDisplay();
  // 挂载那一刻可能还没排好版;抽空补量一次(不用 rAF,免得测试桩的帧队列被挤)
  const fitTimer = setTimeout(fitCanvasDisplay, 0);
  window.addEventListener("resize", fitCanvasDisplay);

  renderPause();
  renderHud();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      finished = true;
      stop();
      clearTimeout(fitTimer);
      window.removeEventListener("resize", fitCanvasDisplay);
      pauseBtn?.removeEventListener("click", onPauseClick);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      for (const off of padHandlers) off();
      wrap.remove();
    },
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg = configFor(ctx.level);
  const plan = planFor(ctx.level);
  const handle = mountStage(stage, {
    cfg,
    starRole: plan.duoChase ? "ghost" : "none",
    label: `${TIER_LABELS[plan.tier]}档`,
    theme: wallThemeIndex(ctx.level),
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
      // 无尽 / 抢豆 / 追逃：一轮换一套墙色，跑得越久风景越多
      theme: round % WALL_THEMES.length,
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
  view.className = "dmz-view";
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
      "朵朵：WASD 或滑动屏幕｜星星：方向键｜Esc 或方向键盘上的 ⏸ 暂停。无尽最高分：" +
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
      hint: "地图一圈比一圈快，掉光小星命就结算最高分。想歇一下就按 Esc 或点 ⏸。",
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
      hint: "同一张图两个人抢豆：朵朵 WASD，星星方向键，手机上点各自那排按键，豆子吃完分高者胜。想歇一下就按 Esc 或点 ⏸。",
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
      hint: "朵朵用 WASD 清豆，星星用方向键（或点她那排按键）操纵带光圈的那只小幽灵。想歇一下就按 Esc 或点 ⏸。",
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
