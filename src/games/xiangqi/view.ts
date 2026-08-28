// 棋盘视图 —— 木纹棋盘 + 楷体棋子，**保持 2D**（立体棋子会挡住后面的子和九宫线）。
//
// 这一层只画画和收点击，规则一概不管：
//   · 棋子走 art.ts 预渲染的 14 种 sprite（影 / 侧壁 / 面 / 阴刻字），满盘只做 drawImage；
//   · 选中的子亮一圈，合法落点用小圆点 / 红圈标出来；
//   · 确认落子开着的时候，先画一个半透明的预览子，再点一次才真的走；
//   · 走子「拿起—滑动 160ms—落定回弹 + 波纹」三段；吃子被吃方缩小旋出 + 3 片花瓣，大子加金环；
//   · 将军飞出「将军！」徽章 400ms，被将一方的帅 / 将红光呼吸 2 次后转静态描边，应将成功后消失；
//   · 将死时棋盘轻微变暗，胜方将帅跳起两下 + 印章盖「胜」（残局解开盖「妙手」）；
//   · `prefers-reduced-motion`：徽章静帧、不呼吸、不滑动、不出花瓣波纹，直接落定。
import { type Board, type Move, type Piece, type PieceType, type Pos, type Side, idx } from "./logic";
import { type BoardGeom, MIN_HIT_PX, hitRadius, pickPoint, pointAt } from "./session";
import {
  ANIM_TOTAL_MS,
  BLACK_INK,
  CAPTURE_MS,
  LAND_MS,
  MOVE_MS,
  PETAL_MS,
  PIECE_FACE,
  RED_INK,
  RIPPLE_MS,
  SEAL_MS,
  captureScale,
  captureSpin,
  checkGlowAlpha,
  landScaleAt,
  paintBoardFrame,
  paintCompassMark,
  paintGoldRing,
  paintPetal,
  paintPieceBody,
  paintPieceShadow,
  paintPositionMark,
  paintRipple,
  paintRiverWaves,
  paintSeal,
  petalOffset,
  pieceSprite,
  slideEase,
  winJumpOffset,
} from "./art";

/** 画布几何：9 列 10 行，交叉点间距 44 */
export const GEOM: BoardGeom = { margin: 24, cell: 44, width: 24 * 2 + 44 * 8, height: 24 * 2 + 44 * 9 };

const R = 20; // 棋子半径

// 调色板挪进了 art.ts（1.3 视觉资产库），这里原样转出去，老引用一个不断
export { BLACK_INK, PIECE_FACE, RED_INK };

export interface ViewState {
  board: Board;
  selected: Pos | null;
  targets: Pos[];
  /** 半透明预览的落点（确认落子用） */
  pending: Pos | null;
  lastMove: Move | null;
  /** 正在被将军的一方（红光呼吸描边），应将成功后置 null */
  checkSide: Side | null;
  /** 棋盘变暗（将死 / 困毙的结算画面） */
  dim: boolean;
  /** 结算画面上跳起庆祝的胜方（将帅跳两下），非将死结算是 null */
  winSide: Side | null;
  /** 还能不能点 */
  interactive: boolean;
}

export interface BoardView {
  canvas: HTMLCanvasElement;
  update: (patch: Partial<ViewState>) => void;
  /** 飞出「将军！」徽章 400ms */
  flashCheck: (text?: string) => void;
  /** 走子演出：滑动 + 落定回弹 + 波纹；带 captured 时被吃方缩小旋出 + 花瓣（reduce 直接落定） */
  animateMove: (move: Move, piece: Piece, captured: Piece | null) => void;
  /** 结算印章：「胜」/「妙手」盖到棋盘中央（reduce 静态盖好） */
  stampSeal: (text: string) => void;
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
  font-family:"Kaiti SC","STKaiti","PingFang SC",serif;
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
.xq-btns button{flex:1 1 92px;min-height:${MIN_HIT_PX}px;border:none;border-radius:14px;padding:11px 4px;
  font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.12);font-family:inherit;}
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
.xq-step{flex:0 0 auto;background:#fff;border-radius:12px;padding:5px 10px;font-size:14px;font-weight:700;
  color:#6B5A45;box-shadow:0 2px 5px rgba(150,120,80,.18);white-space:nowrap;}
.xq-step-red{color:${RED_INK};}
.xq-step-black{color:${BLACK_INK};}
.xq-step-last{background:#FFF0BF;box-shadow:0 2px 5px rgba(200,150,60,.4);}
.xq-capsbar{display:flex;flex-direction:column;gap:4px;margin-bottom:8px;}
.xq-capline{display:flex;align-items:center;gap:3px;flex-wrap:wrap;background:#FFF9EE;border-radius:12px;
  padding:4px 10px;font-size:14px;font-weight:800;color:#8A5A2C;box-shadow:0 2px 5px rgba(150,120,80,.14);}
.xq-capline .xq-picon{display:block;}
.xq-capwho{margin-right:2px;}
.xq-player .xq-picon{vertical-align:middle;}
.xq-panel{display:flex;flex-direction:column;gap:12px;padding:10px 4px;}
.xq-label{font-weight:800;color:#8A5A2C;font-size:15px;margin-bottom:6px;}
.xq-seg{display:flex;gap:8px;flex-wrap:wrap;}
.xq-seg button{flex:1 1 110px;border:3px solid #EED9B8;background:#FFFDF8;border-radius:16px;padding:11px 8px;
  font-size:14px;font-weight:800;color:#7A5A34;cursor:pointer;font-family:inherit;}
.xq-seg button.xq-on{border-color:#F2A0C0;background:#FFE4EF;color:#A82F63;}
.xq-tierblurb{font-size:14px;font-weight:700;color:#7A5A86;text-align:center;min-height:21px;}
.xq-start{border:none;border-radius:18px;padding:14px;font-size:19px;font-weight:900;background:#FFB3CD;
  color:#7A234F;cursor:pointer;box-shadow:0 5px 0 #E890B2;width:100%;font-family:inherit;}
.xq-start:active{transform:translateY(3px);box-shadow:0 2px 0 #E890B2;}
.xq-modebar{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;}
/* display:flex 会压过 hidden 属性的 UA display:none,进关/进模式时模式条要真的让位 */
.xq-modebar[hidden]{display:none;}
.xq-mode{flex:1 1 150px;min-height:${MIN_HIT_PX}px;border:none;border-radius:16px;padding:12px 8px;font-size:15px;
  font-weight:900;cursor:pointer;font-family:inherit;background:#FFE1EC;color:#A82F63;box-shadow:0 4px 0 #E8A9C4;}
.xq-mode-streak{background:#FFEFC7;color:#8A5A10;box-shadow:0 4px 0 #E8C97F;}
.xq-mode:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(0,0,0,.15);}
.xq-over{position:absolute;inset:0;background:rgba(255,250,245,.94);border-radius:18px;z-index:6;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:18px;}
.xq-over-title{font-size:22px;font-weight:900;color:#8A4A7A;}
.xq-over-sub{font-size:15px;font-weight:700;color:#75608A;line-height:1.6;max-width:320px;}
.xq-over-btn{border:none;border-radius:16px;min-height:${MIN_HIT_PX}px;padding:11px 22px;font-size:16px;
  font-weight:900;color:#fff;cursor:pointer;background:linear-gradient(180deg,#C84483,#AD3A72);
  box-shadow:0 4px 0 #8F2C5C;font-family:inherit;}
.xq-rules{position:absolute;inset:0;background:#FFF9F0;border-radius:18px;padding:14px;overflow-y:auto;z-index:7;}
.xq-rules h3{color:#A82F63;margin:12px 0 4px;font-size:17px;}
.xq-rules p{color:#6B4A2E;font-size:14.5px;line-height:1.7;margin:6px 0;}
.xq-rules-close{position:sticky;top:0;float:right;border:none;border-radius:14px;background:#FFB3CD;color:#7A234F;
  min-height:${MIN_HIT_PX}px;font-size:15px;font-weight:900;padding:9px 16px;cursor:pointer;box-shadow:0 3px 0 #E890B2;
  font-family:inherit;}
.xq-hidden{display:none;}
@media (max-width:380px){
  .xq-btns button{flex:1 1 74px;min-height:${MIN_HIT_PX}px;padding:10px 2px;}
  .xq-badge{font-size:28px;}
}
/* 平板横屏高度是短边:460 宽的棋盘(高≈510)会把悔棋/提示那排顶出首屏,收窄一点整套都装得下 */
@media (min-width:700px) and (max-height:840px){
  .xq-wrap{max-width:380px;}
}
@media (min-width:700px) and (max-height:500px){
  .xq-wrap{max-width:248px;}
  .xq-btns{position:sticky;bottom:0;z-index:4;padding:6px 0 2px;background:linear-gradient(180deg,rgba(255,248,240,.4),#FFF8F0);}
}
/* 412 高时 248 宽棋盘仍把悔棋排顶出首屏,再收一档；够宽时棋盘与工具列并排 */
@media (min-width:700px) and (max-height:430px){
  .xq-wrap{max-width:196px;}
}
@media (min-width:800px) and (max-height:430px){
  .xq-wrap{max-width:none;width:min(100%,420px);display:grid;
    grid-template-columns:minmax(160px,240px) minmax(96px,132px);column-gap:8px;align-items:start;}
  .xq-top,.xq-capsbar{grid-column:1/-1;}
  .xq-boardhost{grid-column:1;grid-row:3;min-width:0;}
  .xq-record{grid-column:1;max-height:28px;}
  .xq-btns{grid-column:2;grid-row:3 / span 4;flex-direction:column;flex-wrap:nowrap;margin-top:0;
    position:sticky;top:0;align-self:start;}
  .xq-btns button{flex:0 0 auto;}
  .xq-msg{grid-column:1;}
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
    winSide: null,
    interactive: true,
  };
}

/** 当前时刻（ms）：动画公式全用它，测试桩的 performance.now 也接得住 */
function nowMs(): number {
  const p = (globalThis as { performance?: { now?: () => number } }).performance;
  return p?.now ? p.now() : Date.now();
}

/** 走子演出的进行时状态（reduce 下永远不建） */
interface MoveAnim {
  from: Pos;
  to: Pos;
  side: Side;
  type: PieceType;
  captured: Piece | null;
  start: number;
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

  // 演出状态：走子动画 / 将军红光起点 / 胜方跳子起点 / 结算印章
  let anim: MoveAnim | null = null;
  let checkStart = 0;
  let winStart = 0;
  let seal: { text: string; start: number } | null = null;

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
    // 河界水意：楚河汉界底下两道极淡水波（静态）
    paintRiverWaves(ctx, px(0), px(8), (py(4) + py(5)) / 2);

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
    // 兵位 / 炮位的传统十字角标（0 路只画右半、8 路只画左半）
    for (const [mx, my] of [[1, 2], [7, 2], [1, 7], [7, 7]] as const) {
      paintPositionMark(ctx, px(mx), py(my));
    }
    for (const my of [3, 6]) {
      for (let mx = 0; mx <= 8; mx += 2) {
        paintPositionMark(ctx, px(mx), py(my), mx !== 0, mx !== 8);
      }
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
    // 双层木框：外 8px 深木 + 内 1px 金线 + 四角如意云头（盖在木纹边缘上）
    paintBoardFrame(ctx, GEOM.width, GEOM.height);
  }

  /**
   * 画一颗棋子：投影贴在盘上，本体走 art.ts 的 sprite（drawImage）；
   * 离屏渲染不可用时退回逐层直绘。lift 是拿起的抬升，scale 给落定回弹用。
   */
  function drawPiece(cx: number, cy: number, side: Side, type: PieceType, alpha = 1, lift = 0, scale = 1): void {
    if (!ctx) return;
    ctx.globalAlpha = alpha;
    paintPieceShadow(ctx, cx, cy, R, lift);
    const yy = cy - lift;
    const spr = pieceSprite(document, side, type, R);
    if (spr) {
      const w = spr.span * scale;
      ctx.drawImage(spr.canvas, cx - w / 2, yy - w / 2, w, w);
    } else {
      paintPieceBody(ctx, cx, yy, R * scale, side, type);
    }
    ctx.globalAlpha = 1;
  }

  function draw(): void {
    if (!ctx || dead) return;
    drawBoard();
    const now = nowMs();
    const pulse = reduce ? 1 : 1 + Math.sin(time * 5) * 0.1;
    if (anim && now - anim.start >= ANIM_TOTAL_MS) anim = null; // 演出散场即回收
    const a = anim;
    const at = a ? now - a.start : 0;
    const sliding = !!a && at < MOVE_MS;

    if (state.lastMove) {
      // 罗盘印记替掉了 1.2 的橙色方框：起点小印、落点整印，与圆棋子同族
      paintCompassMark(ctx, px(state.lastMove.from.x), py(state.lastMove.from.y), R * 0.45, 0.5);
      paintCompassMark(ctx, px(state.lastMove.to.x), py(state.lastMove.to.y), R + 4, 0.9);
    }

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 9; x++) {
        const p = state.board[idx(x, y)];
        if (!p) continue;
        if (a && x === a.to.x && y === a.to.y) {
          if (sliding) continue; // 还在滑动：这颗子稍后画在最上层
          drawPiece(px(x), py(y), p.side, p.type, 1, 0, landScaleAt((at - MOVE_MS) / LAND_MS));
          continue;
        }
        if (state.dim && state.winSide === p.side && p.type === "K") continue; // 胜方将帅画在结算层
        const sel = state.selected && state.selected.x === x && state.selected.y === y;
        const lift = sel && !reduce ? 3 + Math.sin(time * 5) * 1.5 : sel ? 3 : 0;
        drawPiece(px(x), py(y), p.side, p.type, 1, lift);
        if (sel) {
          ctx.strokeStyle = "#E4573D";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px(x), py(y) - lift, R + 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // 吃子退场：被吃方缩小旋出，大子（车马炮）加一圈金环，3 片花瓣飘散
    if (a && a.captured) {
      const tx = px(a.to.x);
      const ty = py(a.to.y);
      const kc = at / CAPTURE_MS;
      if (kc < 1) {
        const spr = pieceSprite(document, a.captured.side, a.captured.type, R);
        const sc = captureScale(kc);
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(captureSpin(kc));
        ctx.globalAlpha = Math.max(0, 1 - kc);
        if (spr) {
          const w = spr.span * sc;
          ctx.drawImage(spr.canvas, -w / 2, -w / 2, w, w);
        } else if (sc > 0) {
          paintPieceBody(ctx, 0, 0, R * sc, a.captured.side, a.captured.type, false);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
        if (a.captured.type === "R" || a.captured.type === "H" || a.captured.type === "C") {
          paintGoldRing(ctx, tx, ty, R + 2, kc);
        }
      }
      const kp = at / PETAL_MS;
      if (kp < 1) {
        for (let i = 0; i < 3; i++) {
          const o = petalOffset(i, kp);
          paintPetal(ctx, tx + o.x, ty + o.y, 7, o.rot, 1 - kp);
        }
      }
    }

    // 走子滑行：「拿起—移动—放下」的中段，微抬 + 微放大
    if (a && sliding) {
      const k = slideEase(at / MOVE_MS);
      const cx = px(a.from.x) + (px(a.to.x) - px(a.from.x)) * k;
      const cy = py(a.from.y) + (py(a.to.y) - py(a.from.y)) * k;
      drawPiece(cx, cy, a.side, a.type, 1, 2 + (1 - k) * 2, 1.04);
    }

    // 落定波纹（reduce 下 anim 根本不建，这里自然走不到）
    if (a && !sliding && at < MOVE_MS + RIPPLE_MS) {
      paintRipple(ctx, px(a.to.x), py(a.to.y), R, (at - MOVE_MS) / RIPPLE_MS);
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
        drawPiece(px(state.pending.x), py(state.pending.y), p.side, p.type, 0.55);
        ctx.strokeStyle = "#B23A86";
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px(state.pending.x), py(state.pending.y), R + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 被将一方的将帅：红光呼吸 2 次后转静态描边（应将成功后 checkSide 置 null，描边就没了）
    // reduce 一直是静态描边——警告不消失，配合徽章与提示文字，不只靠红光
    if (state.checkSide) {
      const k = kingOf(state.board, state.checkSide);
      if (k) {
        const glow = checkGlowAlpha(now - checkStart, reduce);
        ctx.strokeStyle = `rgba(226,60,45,${glow})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(px(k.x), py(k.y), R + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(226,60,45,${glow * 0.35})`;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.arc(px(k.x), py(k.y), R + 12, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (state.dim) {
      ctx.fillStyle = "rgba(40,25,10,.28)";
      ctx.fillRect(0, 0, GEOM.width, GEOM.height);
    }

    // 结算层：胜方将帅跳起两下（画在变暗层之上），印章随后盖下
    if (state.dim && state.winSide) {
      const k = kingOf(state.board, state.winSide);
      if (k) {
        drawPiece(px(k.x), py(k.y), state.winSide, "K", 1, winJumpOffset(now - winStart, reduce));
      }
    }
    if (seal) {
      const k = reduce ? 1 : Math.min(1, (now - seal.start) / SEAL_MS);
      paintSeal(ctx, GEOM.width / 2, GEOM.height * 0.46, 84, k, seal.text);
    }
  }

  function tick(): void {
    if (dead) return;
    time = nowMs() / 1000;
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
      // 将军红光与胜方跳子都从「状态翻上来的那一刻」起计时
      if (patch.checkSide && patch.checkSide !== state.checkSide) checkStart = nowMs();
      if (patch.winSide && patch.winSide !== state.winSide) winStart = nowMs();
      if (patch.lastMove === null) anim = null; // 悔棋 / 重摆：演出立刻收
      state = { ...state, ...patch };
      draw();
    },
    animateMove(move, piece, captured) {
      if (dead || reduce) return; // reduce：直接落定，不滑不旋不出花瓣
      anim = { from: move.from, to: move.to, side: piece.side, type: piece.type, captured, start: nowMs() };
      draw();
    },
    stampSeal(text) {
      if (dead) return;
      seal = { text, start: nowMs() };
      draw();
    },
    flashCheck(text = "将军！") {
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
