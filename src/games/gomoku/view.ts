// 棋盘视图：2D canvas，自由对战与解局共用一份。
// 只负责画和收点击，规则与 AI 一律由外面传进来。
// 动画都在这里：落子有一个「掉下去弹一下」，五连是一条扫过去的光带，
// 禁手点会红叉抖两下 —— 1.1 里这些全是瞬现的。

import type { Board, Player } from "./ai";
import { cursorLabel } from "./session";
import type { Cell, HintArea } from "./session";

/** 画布逻辑宽度（CSS 宽度自适应，坐标一律按这个算） */
export const VIEW_W = 380;

/** 落子动画时长（毫秒） */
export const DROP_MS = 220;
/** 五连光带扫过去的时长（毫秒） */
export const WIN_SWEEP_MS = 620;
/** 禁手红叉停留时长（毫秒） */
export const FORBID_MS = 1400;

/**
 * 手指至少要有多大的靶子：44 CSS px（无障碍下限）。
 * 全局 `* { box-sizing:border-box }`，所以 `min-height` 把 padding 与边框都算了进去，
 * 360px 上量到的就是这个数。
 */
export const MIN_HIT_PX = 44;

export const CSS = `
.gmk-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;max-width:420px;margin:0 auto;
  user-select:none;-webkit-user-select:none;position:relative;}
.gmk-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;}
.gmk-badge{background:#fff;border-radius:14px;padding:6px 12px;font-weight:800;color:#A8743C;font-size:14px;
  box-shadow:0 2px 6px rgba(180,130,80,.2);white-space:nowrap;}
.gmk-badge.gmk-think{animation:gmk-think 1.1s ease-in-out infinite;}
@keyframes gmk-think{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.97)}}
.gmk-canvas{width:100%;border-radius:16px;display:block;touch-action:none;box-shadow:0 4px 14px rgba(190,140,90,.25);}
.gmk-canvas:focus-visible{outline:3px solid #C2497E;outline-offset:3px;}
.gmk-btns{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;}
.gmk-btns button{flex:1;min-width:88px;min-height:${MIN_HIT_PX}px;border:none;border-radius:14px;padding:10px 6px;
  font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.12);font-family:inherit;}
.gmk-btns button:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.12);}
.gmk-btns button:disabled{opacity:.45;cursor:default;transform:none;}
.gmk-undo{background:#CDE6FF;color:#2A6099;}
.gmk-hint{background:#D9F2C4;color:#4A7A2A;}
.gmk-retry{background:#FFD9C4;color:#A0522D;}
.gmk-back{background:#FFE0C2;color:#9A5A20;}
.gmk-claim{background:#FFD1DC;color:#A8325C;}
.gmk-msg{text-align:center;min-height:20px;color:#B06AB3;font-weight:700;margin-top:8px;font-size:14px;line-height:1.5;}
.gmk-panel{display:flex;flex-direction:column;gap:12px;padding:10px 6px;}
.gmk-label{font-weight:800;color:#A8743C;font-size:15px;margin-bottom:6px;}
.gmk-seg{display:flex;gap:8px;flex-wrap:wrap;}
.gmk-seg button{flex:1;min-width:98px;border:3px solid #EED9B8;background:#FFFDF8;border-radius:16px;padding:9px 8px;
  font-size:14px;font-weight:700;color:#8A6B45;cursor:pointer;font-family:inherit;text-align:center;}
.gmk-seg button.gmk-on{border-color:#F2A0C0;background:#FFE4EF;color:#C2497E;}
.gmk-seg button:focus-visible{outline:3px solid #C2497E;outline-offset:2px;}
.gmk-tierblurb{font-size:12.5px;color:#8A6B45;font-weight:700;margin-top:6px;min-height:18px;line-height:1.5;}
.gmk-start{border:none;border-radius:18px;padding:13px;font-size:18px;font-weight:900;background:#FFB3CD;color:#86285A;
  cursor:pointer;box-shadow:0 5px 0 #E890B2;width:100%;font-family:inherit;}
.gmk-start:active{transform:translateY(3px);box-shadow:0 2px 0 #E890B2;}
.gmk-modebar{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:0 0 10px;}
.gmk-mode{border:none;border-radius:999px;padding:9px 16px;font-size:15px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#FFE8C8;color:#96601F;box-shadow:0 3px 0 rgba(150,96,31,.25);white-space:nowrap;}
.gmk-mode:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(150,96,31,.25);}
.gmk-mode-streak{background:#FFD7E4;color:#A8325C;box-shadow:0 3px 0 rgba(168,50,92,.25);}
.gmk-claimbar{display:flex;align-items:center;gap:8px;justify-content:center;margin-top:8px;flex-wrap:wrap;}
.gmk-claimtip{font-size:13px;font-weight:800;color:#A8325C;}
.gmk-over{position:absolute;inset:0;background:rgba(255,250,245,.95);border-radius:18px;z-index:5;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:20px;}
.gmk-over-title{font-size:22px;font-weight:900;color:#8A5AA8;}
.gmk-over-sub{font-size:15px;font-weight:700;color:#77619B;line-height:1.6;max-width:300px;}
.gmk-over-btn{border:none;border-radius:16px;padding:11px 24px;font-size:16px;font-weight:900;color:#fff;cursor:pointer;
  background:linear-gradient(180deg,#C84483,#AD3A72);box-shadow:0 4px 0 #8F2C5C;font-family:inherit;}
.gmk-over-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #8F2C5C;}
@media (prefers-reduced-motion:reduce){
  .gmk-badge.gmk-think{animation:none;}
}
`;

export interface ViewState {
  board: Board;
  size: number;
  turn: Player;
  lastMove: Cell | null;
  /** 待确认的落点（半透明子 + 粉圈） */
  pending: Cell | null;
  /** 按住滑动时的瞄准点 */
  ghost: Cell | null;
  /** 提示亮区（只圈一片，不点名） */
  hint: HintArea | null;
  winLine: Array<[number, number]> | null;
  /** 刚判为禁手的点，画红叉 */
  forbidden: Cell | null;
  interactive: boolean;
  /** 确认落子开着没有（只用来播报「按回车是预览还是落子」） */
  confirm: boolean;
}

export interface BoardViewOpts {
  size: number;
  onTap: (cell: Cell) => void;
  /** 想知道现在一格多少 CSS 像素（判断要不要开落子确认） */
  onReady?: (view: BoardView) => void;
}

export interface BoardView {
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  state: ViewState;
  update(patch: Partial<ViewState>): void;
  /** 播一次落子动画 */
  drop(x: number, y: number): void;
  /** 五连光带从头扫到尾 */
  sweep(): void;
  /** 画布上一格实际占多少 CSS 像素 */
  cellPx(): number;
  resize(size: number, board: Board): void;
  destroy(): void;
}

function nowMs(): number {
  const p = (globalThis as { performance?: { now(): number } }).performance;
  return p ? p.now() : Date.now();
}

/** 挂一块棋盘：canvas + 指针 / 键盘输入 + 动画循环 */
export function createBoardView(host: HTMLElement, opts: BoardViewOpts): BoardView {
  const canvas = document.createElement("canvas");
  canvas.className = "gmk-canvas";
  canvas.width = VIEW_W;
  canvas.height = VIEW_W;
  canvas.setAttribute("tabindex", "0");
  canvas.setAttribute("role", "application");
  canvas.setAttribute("aria-label", "五子棋棋盘，方向键移动、回车落子");
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;

  let size = opts.size;
  let destroyed = false;
  let raf = 0;
  let t = 0;
  const drops = new Map<string, number>();
  let sweepAt = -1;
  let forbidAt = -1;
  let cursor: Cell = { x: Math.floor(size / 2), y: Math.floor(size / 2) };

  const state: ViewState = {
    board: { size, cells: new Uint8Array(size * size) } as Board,
    size,
    turn: 1,
    lastMove: null,
    pending: null,
    ghost: null,
    hint: null,
    winLine: null,
    forbidden: null,
    interactive: true,
    confirm: false,
  };

  /**
   * 把光标这一刻的位置写进 `aria-label`。读屏器认的是 label 的变化，
   * 所以方向键挪一格就要刷一次；`update()` 里换手 / 换预览点也要刷。
   */
  function syncLabel(): void {
    const n = state.size;
    const v = state.board.cells[cursor.y * n + cursor.x];
    canvas.setAttribute(
      "aria-label",
      cursorLabel(cursor, n, {
        at: v === 1 || v === 2 ? v : 0,
        pending: !!state.pending && state.pending.x === cursor.x && state.pending.y === cursor.y,
        interactive: state.interactive,
        confirm: state.confirm,
      })
    );
  }

  function cs(): number {
    return VIEW_W / (size + 1);
  }

  function px(i: number): number {
    return cs() + i * cs();
  }

  // ---------------- 画 ----------------

  function drawGrid(): void {
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_W);
    g.addColorStop(0, "#F9E4C3");
    g.addColorStop(0.5, "#F5D9AE");
    g.addColorStop(1, "#F2D2A4");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_W);
    ctx.strokeStyle = "rgba(200,155,95,.18)";
    ctx.lineWidth = 5;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(-20, i * 64 + 10);
      ctx.bezierCurveTo(VIEW_W * 0.3, i * 64 - 16, VIEW_W * 0.6, i * 64 + 34, VIEW_W + 20, i * 64 + 4);
      ctx.stroke();
    }
    ctx.strokeStyle = "#C79A66";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < size; i++) {
      const p = px(i);
      ctx.beginPath();
      ctx.moveTo(px(0), p);
      ctx.lineTo(px(size - 1), p);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p, px(0));
      ctx.lineTo(p, px(size - 1));
      ctx.stroke();
    }
    ctx.fillStyle = "#B9854E";
    const dots = size >= 15 ? [3, Math.floor(size / 2), size - 4] : [2, Math.floor(size / 2), size - 3];
    for (const sy of dots) {
      for (const sx of dots) {
        ctx.beginPath();
        ctx.arc(px(sx), px(sy), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawStone(x: number, y: number, p: Player, alpha = 1, scale = 1): void {
    if (!ctx) return;
    const c = cs();
    const cx = px(x);
    const cy = px(y);
    const r = c * 0.47 * scale;
    if (r <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(cx + r * 0.06, cy + r * 0.12, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(120,80,40,.28)";
    ctx.fill();
    const grad = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.1, cx, cy, r * 1.05);
    if (p === 1) {
      grad.addColorStop(0, "#8E7E92");
      grad.addColorStop(0.55, "#544860");
      grad.addColorStop(1, "#3B3244");
    } else {
      grad.addColorStop(0, "#FFFFFF");
      grad.addColorStop(0.6, "#FBF4E8");
      grad.addColorStop(1, "#EBDFC9");
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (p === 2) {
      ctx.strokeStyle = "rgba(150,110,70,.8)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.fillStyle = p === 1 ? "rgba(255,255,255,.4)" : "rgba(255,255,255,.95)";
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.32, cy - r * 0.4, r * 0.26, r * 0.16, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** 落子动画的缩放：从 1.5 倍砸下来，回弹到 1 */
  function dropScale(x: number, y: number): number {
    const t0 = drops.get(`${x},${y}`);
    if (t0 === undefined) return 1;
    const k = (t - t0) / DROP_MS;
    if (k >= 1) {
      drops.delete(`${x},${y}`);
      return 1;
    }
    if (k < 0) return 1;
    // 先大后小再回正：easeOutBack 的手感
    const e = 1 - Math.pow(1 - k, 3);
    return 1.5 - 0.62 * e + 0.12 * Math.sin(e * Math.PI);
  }

  function drawHint(): void {
    if (!ctx || !state.hint) return;
    const a = state.hint;
    const c = cs();
    const pulse = 0.16 + Math.sin(t / 220) * 0.08;
    ctx.fillStyle = `rgba(120,200,90,${Math.max(0.06, pulse)})`;
    const left = px(a.x0) - c / 2;
    const top = px(a.y0) - c / 2;
    const w = (a.x1 - a.x0 + 1) * c;
    const h = (a.y1 - a.y0 + 1) * c;
    ctx.fillRect(left, top, w, h);
    ctx.strokeStyle = "#67B54B";
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    ctx.strokeRect(left, top, w, h);
    ctx.setLineDash([]);
  }

  function drawForbidden(): void {
    if (!ctx || !state.forbidden || forbidAt < 0) return;
    if (t - forbidAt > FORBID_MS) {
      state.forbidden = null;
      return;
    }
    const c = cs();
    const cx = px(state.forbidden.x);
    const cy = px(state.forbidden.y);
    const shake = Math.sin((t - forbidAt) / 40) * 2.2 * Math.max(0, 1 - (t - forbidAt) / FORBID_MS);
    const r = c * 0.34;
    ctx.strokeStyle = "#E23B5A";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - r + shake, cy - r);
    ctx.lineTo(cx + r + shake, cy + r);
    ctx.moveTo(cx + r + shake, cy - r);
    ctx.lineTo(cx - r + shake, cy + r);
    ctx.stroke();
  }

  function drawWinLine(): void {
    if (!ctx || !state.winLine || state.winLine.length === 0) return;
    const line = state.winLine;
    const c = cs();
    const k = sweepAt < 0 ? 1 : Math.max(0, Math.min(1, (t - sweepAt) / WIN_SWEEP_MS));
    const [x0, y0] = line[0];
    const [x1, y1] = line[line.length - 1];
    const ax = px(x0);
    const ay = px(y0);
    const bx = px(x1);
    const by = px(y1);
    const glow = 0.5 + Math.sin(t / 160) * 0.3;
    ctx.strokeStyle = `rgba(255,200,60,${glow})`;
    ctx.lineWidth = c * 0.9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + (bx - ax) * k, ay + (by - ay) * k);
    ctx.stroke();
    // 光带扫到哪颗子，哪颗子才亮星星
    line.forEach(([x, y], i) => {
      if (i / Math.max(1, line.length - 1) > k) return;
      const cell = state.board.cells[y * state.size + x];
      if (cell === 1 || cell === 2) drawStone(x, y, cell as Player);
      ctx.fillStyle = `rgba(255,240,150,${glow})`;
      ctx.font = `${Math.round(c * 0.5)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⭐", px(x), px(y));
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    });
  }

  function draw(): void {
    if (!ctx) return;
    drawGrid();
    drawHint();
    const n = state.size;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = state.board.cells[y * n + x];
        if (v === 1 || v === 2) drawStone(x, y, v as Player, 1, dropScale(x, y));
      }
    }
    const c = cs();
    if (state.lastMove && !state.winLine) {
      ctx.strokeStyle = "#FF7EA8";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px(state.lastMove.x), px(state.lastMove.y), c * 0.44 + 3 + Math.sin(t / 200) * 1.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (state.ghost && state.interactive && state.board.cells[state.ghost.y * n + state.ghost.x] === 0) {
      drawStone(state.ghost.x, state.ghost.y, state.turn, 0.42);
      const gx = px(state.ghost.x);
      const gy = px(state.ghost.y);
      ctx.strokeStyle = "#FF9DBE";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(gx - c, gy);
      ctx.lineTo(gx + c, gy);
      ctx.moveTo(gx, gy - c);
      ctx.lineTo(gx, gy + c);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (state.pending && state.board.cells[state.pending.y * n + state.pending.x] === 0) {
      drawStone(state.pending.x, state.pending.y, state.turn, 0.5);
      ctx.strokeStyle = "#FF6FA5";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px(state.pending.x), px(state.pending.y), c * 0.52 + Math.sin(t / 170) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawForbidden();
    drawWinLine();
  }

  function tick(): void {
    if (destroyed) return;
    t = nowMs();
    draw();
    raf = requestAnimationFrame(tick);
  }

  // ---------------- 输入 ----------------

  function eventCell(e: { clientX: number; clientY: number }): Cell | null {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || VIEW_W;
    const h = rect.height || VIEW_W;
    const cx = ((e.clientX - rect.left) / w) * VIEW_W;
    const cy = ((e.clientY - rect.top) / h) * VIEW_W;
    const c = cs();
    const x = Math.round(cx / c - 1);
    const y = Math.round(cy / c - 1);
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    return { x, y };
  }

  let pressing = false;
  const onDown = (ev: unknown): void => {
    const e = ev as PointerEvent;
    e.preventDefault?.();
    pressing = true;
    state.ghost = eventCell(e);
  };
  const onMove = (ev: unknown): void => {
    if (!pressing) return;
    state.ghost = eventCell(ev as PointerEvent);
  };
  const onUp = (ev: unknown): void => {
    if (!pressing) return;
    pressing = false;
    const cell = state.ghost ?? eventCell(ev as PointerEvent);
    state.ghost = null;
    if (cell) opts.onTap(cell);
  };
  const onCancel = (): void => {
    pressing = false;
    state.ghost = null;
  };
  // 键盘可达：方向键挪光标、回车落子。**只挂在 canvas 上**，
  // 不碰 window，更不会去 preventDefault 空格键（那会毁掉页面滚动）。
  const onKey = (ev: unknown): void => {
    const e = ev as KeyboardEvent;
    const k = e.key;
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (step[k]) {
      e.preventDefault?.();
      cursor = {
        x: Math.max(0, Math.min(size - 1, cursor.x + step[k][0])),
        y: Math.max(0, Math.min(size - 1, cursor.y + step[k][1])),
      };
      state.ghost = cursor;
      syncLabel();
      return;
    }
    if (k === "Enter") {
      e.preventDefault?.();
      opts.onTap({ ...cursor });
    }
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onCancel);
  canvas.addEventListener("keydown", onKey);

  raf = requestAnimationFrame(tick);

  const view: BoardView = {
    el: canvas as unknown as HTMLElement,
    canvas,
    state,
    update(patch) {
      Object.assign(state, patch);
      if (patch.forbidden) forbidAt = nowMs();
      if (patch.winLine === null) sweepAt = -1;
      if (patch.size !== undefined) size = patch.size;
      syncLabel();
    },
    drop(x, y) {
      drops.set(`${x},${y}`, nowMs());
    },
    sweep() {
      sweepAt = nowMs();
    },
    cellPx() {
      const shown = canvas.getBoundingClientRect().width || VIEW_W;
      return shown / (size + 1);
    },
    resize(nextSize, board) {
      size = nextSize;
      state.size = nextSize;
      state.board = board;
      drops.clear();
      sweepAt = -1;
      forbidAt = -1;
      cursor = { x: Math.floor(nextSize / 2), y: Math.floor(nextSize / 2) };
      syncLabel();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("keydown", onKey);
      canvas.remove();
    },
  };
  opts.onReady?.(view);
  return view;
}
