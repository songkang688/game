/**
 * 花园国际象棋 · 棋盘视图（DOM，64 个按钮）。
 *
 * 点一枚自己的子会亮出可走点，再点落点就走；兵到底线会弹出四选一。
 * 键盘：朵朵 WASD + F / G，星星 方向键 + L / K。
 */
import { fileOf, rankOf, squareName, squareOf, type Color, type PieceType, type Position, type Square } from "./board";
import { inCheck, legalMoves, type Move } from "./rules";

export const CSS = `
.cg-board{display:grid;grid-template-columns:repeat(8,1fr);gap:0;width:100%;max-width:480px;margin:0 auto;
  border-radius:12px;overflow:hidden;box-shadow:0 4px 14px rgba(120,100,80,.28);}
.cg-sq{position:relative;aspect-ratio:1/1;min-height:36px;border:none;padding:0;cursor:pointer;
  font-family:inherit;font-size:24px;line-height:1;background:#F3E7D3;color:#3a3040;
  transition:background .16s ease,transform .18s ease;}
.cg-sq.cg-dark{background:#C7A98A;}
.cg-sq.cg-sel{background:#FFD98A;}
.cg-sq.cg-can::after{content:"";position:absolute;left:50%;top:50%;width:26%;height:26%;border-radius:50%;
  transform:translate(-50%,-50%);background:rgba(60,140,90,.55);}
.cg-sq.cg-cap::after{width:70%;height:70%;background:transparent;border:3px solid rgba(210,110,80,.7);}
.cg-sq.cg-last{box-shadow:inset 0 0 0 3px rgba(255,190,90,.75);}
.cg-sq.cg-check{background:#F6C7C0;}
.cg-sq.cg-cursor{outline:3px dashed #7f6bd0;outline-offset:-3px;}
.cg-sq:focus-visible{outline:3px solid #ffb43c;outline-offset:-3px;}
.cg-top{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;margin-bottom:8px;}
.cg-chip{background:#fff;border-radius:999px;padding:5px 11px;font-size:13px;font-weight:800;color:#6b5540;
  box-shadow:0 2px 6px rgba(150,125,95,.25);white-space:nowrap;}
.cg-chip.cg-hot{background:#FFE6DE;color:#b4501f;}
.cg-note{text-align:center;min-height:20px;font-size:13px;font-weight:700;color:#6b5540;margin-top:8px;line-height:1.5;}
.cg-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;margin-top:8px;}
.cg-btn{border:none;border-radius:999px;padding:9px 15px;font-size:14px;font-weight:800;cursor:pointer;
  font-family:inherit;background:#ffffffdd;color:#6b5540;box-shadow:0 3px 0 rgba(150,125,95,.3);min-height:44px;}
.cg-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(150,125,95,.3);}
.cg-promo{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px;}
.cg-promo button{min-height:44px;min-width:44px;font-size:22px;border:none;border-radius:12px;cursor:pointer;
  background:#fff;box-shadow:0 3px 0 rgba(150,125,95,.3);}
.cg-log{margin-top:8px;font-size:12px;font-weight:700;color:#8a7358;text-align:center;line-height:1.6;
  max-height:64px;overflow:auto;}
@media (prefers-reduced-motion:reduce){ .cg-sq{transition-duration:.05s;} .cg-btn:active{transform:none;} }
`;

const GLYPH: Record<Color, Record<PieceType, string>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

const NAME: Record<PieceType, string> = {
  k: "王",
  q: "后",
  r: "车",
  b: "象",
  n: "马",
  p: "兵",
};

export interface BoardOptions {
  /** 拿当前局面（由上层持有，走一手就换一个对象） */
  get: () => Position;
  /** 哪几方由真人下 */
  humans: Color[];
  showHints: boolean;
  /** 棋盘翻过来（星星在下面） */
  flipped?: boolean;
  onHumanMove: (m: Move) => void;
  onNote: (text: string) => void;
}

export interface BoardHandle {
  refresh: () => void;
  setLast: (m: Move | null) => void;
  destroy: () => void;
  cursor: () => Square;
  selected: () => Square;
}

export function createBoard(host: HTMLElement, opts: BoardOptions): BoardHandle {
  const wrap = document.createElement("div");
  const grid = document.createElement("div");
  grid.className = "cg-board";
  const promoRow = document.createElement("div");
  promoRow.className = "cg-promo";
  promoRow.hidden = true;
  wrap.append(grid, promoRow);
  host.appendChild(wrap);

  const squares: HTMLButtonElement[] = [];
  let selected = -1;
  let cursor = squareOf(4, 6);
  let last: Move | null = null;
  let pending: Move[] = [];
  let destroyed = false;

  /** 屏幕上的第 i 个格子对应棋盘的哪一格 */
  function mapIndex(i: number): Square {
    return opts.flipped ? 63 - i : i;
  }
  function screenIndex(sq: Square): number {
    return opts.flipped ? 63 - sq : sq;
  }

  function humanTurn(): boolean {
    return opts.humans.includes(opts.get().turn);
  }

  function targets(from: Square): Move[] {
    return legalMoves(opts.get()).filter((m) => m.from === from);
  }

  function clickSquare(sq: Square): void {
    if (destroyed || !humanTurn()) return;
    cursor = sq;
    if (!promoRow.hidden) {
      opts.onNote("先选一个升变的棋子。");
      return;
    }
    if (selected >= 0) {
      const options = targets(selected).filter((m) => m.to === sq);
      if (options.length === 1) {
        selected = -1;
        refresh();
        opts.onHumanMove(options[0]);
        return;
      }
      if (options.length > 1) {
        // 升变：四选一
        pending = options;
        showPromo();
        return;
      }
    }
    const pos = opts.get();
    const p = pos.board[sq];
    if (p && p.color === pos.turn) {
      selected = sq;
      const t = targets(sq);
      if (t.length === 0) opts.onNote(`这枚${NAME[p.type]}暂时没地方去，换一枚试试。`);
      refresh();
      return;
    }
    selected = -1;
    refresh();
  }

  function showPromo(): void {
    promoRow.innerHTML = "";
    promoRow.hidden = false;
    const color = opts.get().turn;
    for (const m of pending) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = GLYPH[color][m.promo ?? "q"];
      b.setAttribute("aria-label", `升变成${NAME[m.promo ?? "q"]}`);
      b.addEventListener("click", () => {
        promoRow.hidden = true;
        promoRow.innerHTML = "";
        pending = [];
        selected = -1;
        refresh();
        opts.onHumanMove(m);
      });
      promoRow.appendChild(b);
    }
    opts.onNote("兵到底线啦，挑一个升变的棋子。");
  }

  for (let i = 0; i < 64; i++) {
    const b = document.createElement("button") as HTMLButtonElement;
    b.type = "button";
    b.className = "cg-sq";
    b.addEventListener("click", () => clickSquare(mapIndex(i)));
    grid.appendChild(b);
    squares.push(b);
  }

  function moveCursor(df: number, dr: number): void {
    const f = Math.max(0, Math.min(7, fileOf(cursor) + df));
    const r = Math.max(0, Math.min(7, rankOf(cursor) + dr));
    cursor = squareOf(f, r);
    refresh();
  }

  function onKey(e: KeyboardEvent): void {
    if (destroyed) return;
    const k = e.key.toLowerCase();
    const blackTurn = opts.get().turn === "b" && opts.humans.includes("b");
    const arrows = blackTurn || opts.humans.length === 1;
    let handled = true;
    if (k === "w" || (arrows && k === "arrowup")) moveCursor(0, -1);
    else if (k === "s" || (arrows && k === "arrowdown")) moveCursor(0, 1);
    else if (k === "a" || (arrows && k === "arrowleft")) moveCursor(-1, 0);
    else if (k === "d" || (arrows && k === "arrowright")) moveCursor(1, 0);
    else if (k === "f" || (blackTurn && k === "l")) clickSquare(cursor);
    else if (k === "g" || (blackTurn && k === "k")) {
      selected = -1;
      promoRow.hidden = true;
      pending = [];
      refresh();
    } else handled = false;
    if (handled) e.preventDefault();
  }

  window.addEventListener("keydown", onKey);

  function refresh(): void {
    if (destroyed) return;
    const pos = opts.get();
    const canGo = selected >= 0 && opts.showHints ? targets(selected) : [];
    const checkedKing = inCheck(pos, pos.turn)
      ? pos.board.findIndex((p) => p !== null && p.type === "k" && p.color === pos.turn)
      : -1;
    for (let i = 0; i < 64; i++) {
      const sq = mapIndex(i);
      const b = squares[i];
      const p = pos.board[sq];
      const classes = ["cg-sq"];
      if ((fileOf(sq) + rankOf(sq)) % 2 === 1) classes.push("cg-dark");
      if (sq === selected) classes.push("cg-sel");
      const hit = canGo.find((m) => m.to === sq);
      if (hit) classes.push(hit.capture ? "cg-can cg-cap" : "cg-can");
      if (last && (sq === last.from || sq === last.to)) classes.push("cg-last");
      if (sq === checkedKing) classes.push("cg-check");
      if (sq === cursor) classes.push("cg-cursor");
      b.className = classes.join(" ");
      b.textContent = p ? GLYPH[p.color][p.type] : "";
      b.setAttribute(
        "aria-label",
        p ? `${squareName(sq)} ${p.color === "w" ? "白" : "黑"}${NAME[p.type]}` : `${squareName(sq)} 空格`
      );
    }
  }

  refresh();

  return {
    refresh,
    setLast: (m) => {
      last = m;
      selected = -1;
      refresh();
    },
    cursor: () => cursor,
    selected: () => selected,
    destroy() {
      destroyed = true;
      window.removeEventListener("keydown", onKey);
      for (const b of squares) b.remove();
      wrap.remove();
    },
  };
}

export { NAME as PIECE_NAME, GLYPH };
