// 棋盘视图 —— 木纹棋盘 + 楷体棋子，**保持 2D**（立体棋子会挡住后面的子和九宫线）。
//
// 这一层只画画和收点击，规则一概不管：
//   · 选中的子亮一圈，合法落点用小圆点 / 红圈标出来；
//   · 确认落子开着的时候，先画一个半透明的预览子，再点一次才真的走；
//   · 将军飞出「将！」徽章 400ms，被将一方的帅 / 将脉冲描边，应将成功后消失；
//   · 将死时棋盘轻微变暗；
//   · `prefers-reduced-motion`：徽章静帧、不脉冲。
import { type Board, type Move, type Pos, type Side, PIECE_NAME, idx } from "./logic";
import { type BoardGeom, hitRadius, pickPoint, pointAt } from "./session";

/** 画布几何：9 列 10 行，交叉点间距 44 */
export const GEOM: BoardGeom = { margin: 24, cell: 44, width: 24 * 2 + 44 * 8, height: 24 * 2 + 44 * 9 };

const R = 20; // 棋子半径

export const RED_INK = "#B3261E";
export const BLACK_INK = "#2F3350";
export const PIECE_FACE = "#FFF7E6";

export interface ViewState {
  board: Board;
  selected: Pos | null;
  targets: Pos[];
  /** 半透明预览的落点（确认落子用） */
  pending: Pos | null;
  lastMove: Move | null;
  /** 正在被将军的一方（脉冲描边），应将成功后置 null */
  checkSide: Side | null;
  /** 棋盘变暗（将死 / 困毙的结算画面） */
  dim: boolean;
  /** 还能不能点 */
  interactive: boolean;
}

export interface BoardView {
  canvas: HTMLCanvasElement;
  update: (patch: Partial<ViewState>) => void;
  /** 飞出「将！」徽章 400ms */
  flashCheck: (text?: string) => void;
  destroy: () => void;
}

export interface ViewOptions {
  onTap: (p: Pos) => void;
  /** 静态化：不脉冲、徽章不飞（跟随 prefers-reduced-motion） */
  reduceMotion?: boolean;
}

export const CHECK_BADGE_MS = 400;

export const CSS = `
.xq-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;max-width:460px;margin:0 auto;
  position:relative;user-select:none;-webkit-user-select:none;}
.xq-boardbox{position:relative;border-radius:18px;overflow:hidden;box-shadow:0 4px 16px rgba(150,110,60,.28);}
.xq-canvas{width:100%;display:block;touch-action:none;}
.xq-badge{position:absolute;left:50%;top:32%;transform:translate(-50%,-50%);pointer-events:none;
  font-size:34px;font-weight:900;color:#fff;background:linear-gradient(180deg,#E4573D,#C0392B);
  border-radius:18px;padding:6px 20px;letter-spacing:4px;box-shadow:0 6px 16px rgba(160,50,30,.45);
  animation:xq-badge-fly ${CHECK_BADGE_MS}ms ease-out forwards;}
@keyframes xq-badge-fly{
  0%{opacity:0;transform:translate(-50%,-30%) scale(.6);}
  40%{opacity:1;transform:translate(-50%,-50%) scale(1.12);}
  100%{opacity:0;transform:translate(-50%,-70%) scale(1);}
}
.xq-top{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;}
.xq-player{display:flex;align-items:center;gap:6px;background:#fff;border-radius:16px;padding:5px 10px;
  font-weight:800;font-size:14px;box-shadow:0 2px 6px rgba(180,130,80,.2);border:3px solid transparent;}
.xq-player.xq-red{color:${RED_INK};}
.xq-player.xq-black{color:${BLACK_INK};}
.xq-player.xq-turn{border-color:#FFC46B;background:#FFF6E0;}
.xq-msg{text-align:center;min-height:22px;color:#7A4F86;font-weight:700;margin-top:8px;font-size:14px;line-height:1.5;}
.xq-btns{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;}
.xq-btns button{flex:1 1 92px;border:none;border-radius:14px;padding:11px 4px;font-size:14px;font-weight:800;
  cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.12);font-family:inherit;}
.xq-btns button:disabled{opacity:.45;cursor:default;}
.xq-undo{background:#CDE6FF;color:#1F5687;}
.xq-restart{background:#FFD9C4;color:#8A421F;}
.xq-hint{background:#FFF0BF;color:#7A5A10;}
.xq-help{background:#D9F2C4;color:#3E6A22;}
.xq-back{background:#FFE0C2;color:#8A4E19;}
.xq-confirm{background:#EDE2FF;color:#553A8B;}
.xq-resign{background:#FFDDE4;color:#8E2B4A;}
.xq-draw{background:#E2F0F5;color:#255E70;}
.xq-record{display:flex;gap:6px;overflow-x:auto;padding:6px 2px;margin-top:8px;scrollbar-width:none;}
.xq-record::-webkit-scrollbar{display:none;}
.xq-step{flex:0 0 auto;background:#fff;border-radius:12px;padding:5px 10px;font-size:13px;font-weight:700;
  color:#6B5A45;box-shadow:0 2px 5px rgba(150,120,80,.18);white-space:nowrap;}
.xq-step-red{color:${RED_INK};}
.xq-step-black{color:${BLACK_INK};}
.xq-panel{display:flex;flex-direction:column;gap:12px;padding:10px 4px;}
.xq-label{font-weight:800;color:#8A5A2C;font-size:15px;margin-bottom:6px;}
.xq-seg{display:flex;gap:8px;flex-wrap:wrap;}
.xq-seg button{flex:1 1 110px;border:3px solid #EED9B8;background:#FFFDF8;border-radius:16px;padding:11px 8px;
  font-size:14px;font-weight:800;color:#7A5A34;cursor:pointer;font-family:inherit;}
.xq-seg button.xq-on{border-color:#F2A0C0;background:#FFE4EF;color:#A82F63;}
.xq-tierblurb{font-size:13px;font-weight:700;color:#7A5A86;text-align:center;min-height:20px;}
.xq-start{border:none;border-radius:18px;padding:14px;font-size:19px;font-weight:900;background:#FFB3CD;
  color:#7A234F;cursor:pointer;box-shadow:0 5px 0 #E890B2;width:100%;font-family:inherit;}
.xq-start:active{transform:translateY(3px);box-shadow:0 2px 0 #E890B2;}
.xq-modebar{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;}
.xq-mode{flex:1 1 150px;border:none;border-radius:16px;padding:12px 8px;font-size:15px;font-weight:900;
  cursor:pointer;font-family:inherit;background:#FFE1EC;color:#A82F63;box-shadow:0 4px 0 #E8A9C4;}
.xq-mode-streak{background:#FFEFC7;color:#8A5A10;box-shadow:0 4px 0 #E8C97F;}
.xq-mode:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(0,0,0,.15);}
.xq-over{position:absolute;inset:0;background:rgba(255,250,245,.94);border-radius:18px;z-index:6;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:18px;}
.xq-over-title{font-size:22px;font-weight:900;color:#8A4A7A;}
.xq-over-sub{font-size:15px;font-weight:700;color:#75608A;line-height:1.6;max-width:320px;}
.xq-over-btn{border:none;border-radius:16px;padding:11px 22px;font-size:16px;font-weight:900;color:#fff;
  cursor:pointer;background:linear-gradient(180deg,#C84483,#AD3A72);box-shadow:0 4px 0 #8F2C5C;font-family:inherit;}
.xq-rules{position:absolute;inset:0;background:#FFF9F0;border-radius:18px;padding:14px;overflow-y:auto;z-index:7;}
.xq-rules h3{color:#A82F63;margin:12px 0 4px;font-size:17px;}
.xq-rules p{color:#6B4A2E;font-size:14.5px;line-height:1.7;margin:6px 0;}
.xq-rules-close{position:sticky;top:0;float:right;border:none;border-radius:14px;background:#FFB3CD;color:#7A234F;
  font-size:15px;font-weight:900;padding:9px 16px;cursor:pointer;box-shadow:0 3px 0 #E890B2;font-family:inherit;}
.xq-hidden{display:none;}
@media (max-width:380px){
  .xq-btns button{flex:1 1 74px;font-size:13px;padding:10px 2px;}
  .xq-badge{font-size:28px;}
}
@media (prefers-reduced-motion:reduce){
  .xq-badge{animation:none;opacity:1;transform:translate(-50%,-50%);}
}
`;

function emptyState(board: Board): ViewState {
  return {
    board,
    selected: null,
    targets: [],
    pending: null,
    lastMove: null,
    checkSide: null,
    dim: false,
    interactive: true,
  };
}

/** 找某一方的将帅（画脉冲描边用） */
function kingOf(board: Board, side: Side): Pos | null {
  for (let y = 0; y < 10; y++) {
    for (let x = 3; x <= 5; x++) {
      const p = board[idx(x, y)];
      if (p && p.type === "K" && p.side === side) return { x, y };
    }
  }
  return null;
}

export function createBoardView(host: HTMLElement, board: Board, opts: ViewOptions): BoardView {
  const box = document.createElement("div");
  box.className = "xq-boardbox";
  const canvas = document.createElement("canvas");
  canvas.className = "xq-canvas";
  canvas.width = GEOM.width;
  canvas.height = GEOM.height;
  box.appendChild(canvas);
  host.appendChild(box);

  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  let state = emptyState(board);
  let raf = 0;
  let time = 0;
  let badge: HTMLElement | null = null;
  let badgeTimer = 0;
  let dead = false;
  const reduce = !!opts.reduceMotion;

  const px = (x: number): number => pointAt(GEOM, x, 0).cx;
  const py = (y: number): number => pointAt(GEOM, 0, y).cy;

  function drawBoard(): void {
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, GEOM.width, GEOM.height);
    g.addColorStop(0, "#F6E1BD");
    g.addColorStop(1, "#EFD2A3");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GEOM.width, GEOM.height);
    // 木纹：几道极淡的横纹，不抢棋子
    ctx.strokeStyle = "rgba(180,140,90,.12)";
    ctx.lineWidth = 6;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 52 + 12);
      ctx.lineTo(GEOM.width, i * 52 + 26);
      ctx.stroke();
    }

    ctx.strokeStyle = "#A9762F";
    ctx.lineWidth = 1.6;
    for (let y = 0; y < 10; y++) {
      ctx.beginPath();
      ctx.moveTo(px(0), py(y));
      ctx.lineTo(px(8), py(y));
      ctx.stroke();
    }
    for (let x = 0; x < 9; x++) {
      if (x === 0 || x === 8) {
        ctx.beginPath();
        ctx.moveTo(px(x), py(0));
        ctx.lineTo(px(x), py(9));
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(px(x), py(0));
        ctx.lineTo(px(x), py(4));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px(x), py(5));
        ctx.lineTo(px(x), py(9));
        ctx.stroke();
      }
    }
    ctx.lineWidth = 3;
    ctx.strokeRect(px(0) - 5, py(0) - 5, GEOM.cell * 8 + 10, GEOM.cell * 9 + 10);
    ctx.lineWidth = 1.6;
    for (const top of [0, 7]) {
      ctx.beginPath();
      ctx.moveTo(px(3), py(top));
      ctx.lineTo(px(5), py(top + 2));
      ctx.moveTo(px(5), py(top));
      ctx.lineTo(px(3), py(top + 2));
      ctx.stroke();
    }
    ctx.fillStyle = "#8A5A20";
    ctx.font = `700 ${Math.round(GEOM.cell * 0.48)}px "Kaiti SC","STKaiti",serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const midY = (py(4) + py(5)) / 2;
    ctx.fillText("楚 河", px(2), midY);
    ctx.fillText("汉 界", px(6), midY);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawPiece(cx: number, cy: number, side: Side, name: string, alpha = 1, lift = 0): void {
    if (!ctx) return;
    ctx.globalAlpha = alpha;
    // 极轻的投影：保持 2D，不做立体
    ctx.beginPath();
    ctx.arc(cx, cy + 2.5, R, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(110,75,35,.26)";
    ctx.fill();
    const yy = cy - lift;
    const grad = ctx.createRadialGradient(cx - R * 0.35, yy - R * 0.4, R * 0.15, cx, yy, R);
    grad.addColorStop(0, "#FFFDF6");
    grad.addColorStop(1, PIECE_FACE);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, yy, R, 0, Math.PI * 2);
    ctx.fill();
    const ink = side === "red" ? RED_INK : BLACK_INK;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, yy, R - 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, yy, R - 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = `800 ${Math.round(R * 1.08)}px "Kaiti SC","STKaiti","PingFang SC",serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, cx, yy + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
  }

  function draw(): void {
    if (!ctx || dead) return;
    drawBoard();
    const pulse = reduce ? 1 : 1 + Math.sin(time * 5) * 0.1;

    if (state.lastMove) {
      ctx.strokeStyle = "rgba(226,140,60,.9)";
      ctx.lineWidth = 2.5;
      for (const p of [state.lastMove.from, state.lastMove.to]) {
        ctx.strokeRect(px(p.x) - R - 2, py(p.y) - R - 2, (R + 2) * 2, (R + 2) * 2);
      }
    }

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
        const p = state.board[idx(x, y)];
        if (!p) continue;
        const sel = state.selected && state.selected.x === x && state.selected.y === y;
        const lift = sel && !reduce ? 3 + Math.sin(time * 5) * 1.5 : sel ? 3 : 0;
        drawPiece(px(x), py(y), p.side, PIECE_NAME[p.side][p.type], 1, lift);
        if (sel) {
          ctx.strokeStyle = "#E4573D";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px(x), py(y) - lift, R + 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // 合法落点：空点画小圆点，能吃的子画红圈
    if (state.selected && state.interactive) {
      for (const t of state.targets) {
        const cx = px(t.x);
        const cy = py(t.y);
        if (state.board[idx(t.x, t.y)]) {
          ctx.strokeStyle = "rgba(206,60,50,.95)";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(cx, cy, (R + 4) * pulse, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(70,150,70,.9)";
          ctx.beginPath();
          ctx.arc(cx, cy, 8 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,.95)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // 半透明预览子：再点一次才落下
    if (state.pending && state.selected) {
      const p = state.board[idx(state.selected.x, state.selected.y)];
      if (p) {
        drawPiece(px(state.pending.x), py(state.pending.y), p.side, PIECE_NAME[p.side][p.type], 0.55);
        ctx.strokeStyle = "#B23A86";
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px(state.pending.x), py(state.pending.y), R + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 被将一方的将帅：脉冲描边（应将成功后 checkSide 置 null，描边就没了）
    if (state.checkSide) {
      const k = kingOf(state.board, state.checkSide);
      if (k) {
        const glow = reduce ? 0.85 : 0.4 + Math.abs(Math.sin(time * 7)) * 0.5;
        ctx.strokeStyle = `rgba(226,60,45,${glow})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(px(k.x), py(k.y), R + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (state.dim) {
      ctx.fillStyle = "rgba(40,25,10,.28)";
      ctx.fillRect(0, 0, GEOM.width, GEOM.height);
    }
  }

  function tick(now: number): void {
    if (dead) return;
    time = now / 1000;
    draw();
    raf = requestAnimationFrame(tick);
  }

  const onPointerDown = (e: PointerEvent): void => {
    if (dead || !state.interactive) return;
    e.preventDefault?.();
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width || GEOM.width;
    const cx = ((e.clientX - rect.left) / cssWidth) * GEOM.width;
    const cy = ((e.clientY - rect.top) / (rect.height || GEOM.height)) * GEOM.height;
    const hit = pickPoint(GEOM, cx, cy, hitRadius(GEOM, cssWidth));
    if (hit) opts.onTap(hit);
  };
  canvas.addEventListener("pointerdown", onPointerDown);

  raf = requestAnimationFrame(tick);
  draw();

  return {
    canvas,
    update(patch) {
      state = { ...state, ...patch };
      draw();
    },
    flashCheck(text = "将！") {
      if (dead) return;
      badge?.remove();
      badge = document.createElement("div");
      badge.className = "xq-badge";
      badge.textContent = text;
      box.appendChild(badge);
      clearTimeout(badgeTimer);
      const el = badge;
      badgeTimer = (globalThis as { setTimeout: typeof setTimeout }).setTimeout(() => {
        el.remove();
        if (badge === el) badge = null;
      }, CHECK_BADGE_MS + 60) as unknown as number;
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      clearTimeout(badgeTimer);
      canvas.removeEventListener("pointerdown", onPointerDown);
      badge?.remove();
      box.remove();
    },
  };
}
