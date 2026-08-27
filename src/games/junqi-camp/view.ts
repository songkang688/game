/**
 * 军旗对决 · 棋盘视图。
 *
 * 铁路画粗线、公路画细线、行营画圆、大本营画方，一眼能看懂。
 * 点一枚自己的子选中，再点一个亮着的落点，最后按「确认」走。
 * 键盘按座位分：朵朵 WASD 挪光标、F 确认、G 取消；星星 方向键 + L / K。
 * 两个座位各有各的光标（双人同屏时谁也拨不走对方那一个），画面上只画该走的那一位。
 * 对撞一定有动画：两子翻开 → 停一下 → 回营的那一方淡出。
 * 12 行的棋盘在 360px 上放不下，所以整块棋盘可以缩放，也能拖着看。
 */
import {
  CAMP,
  CELLS,
  COLS,
  HQ,
  LINES,
  ROWS,
  cellName,
  colOf,
  idx,
  inCamp,
  inHQ,
  rowOf,
  type Pos,
  type Side,
} from "./board";
import {
  LABEL,
  movesFrom,
  status,
  visibleKind,
  type Cell,
  type CombatOutcome,
  type GameState,
  type Kind,
  type Move,
} from "./rules";

/** 棋子文字的基准字号；乘上最小缩放也要 ≥ 12px */
export const PIECE_FONT = 17;
export const MIN_SCALE = 0.75;
export const MAX_SCALE = 1.6;

/** 对撞动画的三段时长（毫秒） */
export const ANIM = { flip: 260, hold: 320, fade: 240 };
export const ANIM_FAST = { flip: 60, hold: 80, fade: 60 };

export const CSS = `
.jq-stage{position:relative;overflow:hidden;width:100%;height:min(58vh,470px);min-height:300px;
  border-radius:16px;background:linear-gradient(180deg,#F3F7EA,#E7F0F7);touch-action:none;}
.jq-pan{position:absolute;left:0;top:0;width:100%;transform-origin:0 0;}
.jq-board{position:relative;width:100%;padding-top:240%;}
.jq-half{position:absolute;left:0;width:100%;height:50%;border-radius:14px;}
.jq-half.jq-top{top:0;background:#E9F1FB;}
.jq-half.jq-bottom{top:50%;background:#FBF0E7;}
.jq-line{position:absolute;background:#B9C6A8;border-radius:2px;}
.jq-line.jq-rail{background:#7E8B6B;box-shadow:0 0 0 1px #ffffff88;}
.jq-mountain{position:absolute;transform:translate(-50%,-50%);font-size:14px;opacity:.75;}
.jq-cell{position:absolute;width:20%;height:8.3333%;margin:0;padding:0;border:none;background:transparent;
  font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.jq-face{width:82%;height:82%;min-width:44px;min-height:44px;border-radius:12px;display:flex;
  align-items:center;justify-content:center;font-size:${PIECE_FONT}px;font-weight:900;line-height:1.1;
  transition:transform .22s ease,opacity .22s ease,box-shadow .18s ease;}
.jq-cell.jq-camp .jq-face{border-radius:50%;}
.jq-cell.jq-hq .jq-face{border-radius:8px;box-shadow:inset 0 0 0 3px #C9B48A;}
.jq-empty .jq-face{background:#ffffff8c;color:#9aa88c;font-size:13px;font-weight:700;}
.jq-duo .jq-face{background:linear-gradient(180deg,#FFE7D5,#FBD3B6);color:#A9531F;box-shadow:0 2px 0 #d9a97f;}
.jq-star .jq-face{background:linear-gradient(180deg,#DFEAFA,#C4D8F4);color:#25508F;box-shadow:0 2px 0 #90afd8;}
.jq-back .jq-face{background:linear-gradient(180deg,#EFE3F7,#DCCBEE);color:#7A5CA0;box-shadow:0 2px 0 #b39ccb;}
.jq-cell.jq-sel .jq-face{transform:scale(1.06);box-shadow:0 0 0 3px #F2A03C;}
.jq-cell.jq-target .jq-face{box-shadow:0 0 0 3px #7CC28B;}
.jq-cell.jq-pending .jq-face{box-shadow:0 0 0 4px #E0663C;transform:scale(1.08);}
.jq-cell.jq-cursor .jq-face{outline:3px dashed #6E7FD0;outline-offset:2px;}
.jq-cell:focus-visible .jq-face{outline:3px solid #F2A03C;outline-offset:2px;}
.jq-cell.jq-open .jq-face{transform:rotateY(0deg) scale(1.1);}
.jq-cell.jq-gone .jq-face{opacity:0;transform:scale(.55);}
.jq-tools{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;margin-top:8px;}
.jq-btn{border:none;border-radius:999px;min-height:44px;min-width:44px;padding:9px 15px;font-size:14px;
  font-weight:800;font-family:inherit;cursor:pointer;background:#ffffffdd;color:#5f6b4b;
  box-shadow:0 3px 0 rgba(120,130,100,.28);}
.jq-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(120,130,100,.28);}
.jq-btn.jq-go{background:linear-gradient(180deg,#8FC46F,#6FA954);color:#fff;}
.jq-btn.jq-off{opacity:.45;}
.jq-legend{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px;font-size:12px;
  font-weight:700;color:#6b7758;}
.jq-legend span{background:#ffffffcc;border-radius:999px;padding:3px 9px;}
@media (prefers-reduced-motion:reduce){
  .jq-face{transition-duration:.06s;}
  .jq-btn:active{transform:none;}
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

export interface BoardOptions {
  state: GameState;
  /** 哪几方由真人点（其余交给电脑） */
  humans: Side[];
  /** 看棋的视角："all" 是明棋，双方都看得见 */
  viewer: Side | "all";
  onMove: (m: Move) => void;
  onNote: (text: string) => void;
  /** 外面是不是暂停了：暂停期间点格子、挪光标、确认、取消一概不接 */
  isPaused?: () => boolean;
}

export interface CombatShow {
  from: Pos;
  to: Pos;
  attacker: Kind;
  defender: Kind;
  outcome: CombatOutcome;
}

export interface BoardHandle {
  refresh: () => void;
  /** 走子动画：对撞的话先把两子翻开，停一下，再让回营的那一方淡出 */
  animateMove: (before: readonly Cell[], move: Move, show: CombatShow | null, done: () => void) => void;
  /** `side` 省略时算在「当前该走的那位真人」头上 */
  moveCursor: (dr: number, dc: number, side?: Side) => void;
  activate: (at?: Pos, side?: Side) => void;
  cancel: (side?: Side) => void;
  zoom: (delta: number) => void;
  destroy: () => void;
  cursor: (side?: Side) => Pos;
  selected: () => Pos;
  pending: () => Pos;
  scale: () => number;
}

interface Pointer {
  x: number;
  y: number;
}

export function createBoard(host: HTMLElement, opts: BoardOptions): BoardHandle {
  const state = opts.state;
  const soft = reducedMotion();
  const anim = soft ? ANIM_FAST : ANIM;

  const wrap = document.createElement("div");
  const stage = document.createElement("div");
  stage.className = "jq-stage";
  const pan = document.createElement("div");
  pan.className = "jq-pan";
  const board = document.createElement("div");
  board.className = "jq-board";
  pan.appendChild(board);
  stage.appendChild(pan);
  wrap.appendChild(stage);
  host.appendChild(wrap);

  for (const side of ["star", "duo"] as const) {
    const half = document.createElement("div");
    half.className = `jq-half ${side === "star" ? "jq-top" : "jq-bottom"}`;
    board.appendChild(half);
  }

  // 铁路粗线、公路细线、行营那几条斜线
  for (const line of LINES) {
    const el = document.createElement("div");
    el.className = `jq-line ${line.rail ? "jq-rail" : "jq-road"}`;
    const x1 = (colOf(line.a) + 0.5) * (100 / COLS);
    const y1 = (rowOf(line.a) + 0.5) * (100 / ROWS);
    const thick = line.rail ? 6 : 2;
    el.style.left = `${x1}%`;
    el.style.top = `${y1}%`;
    if (line.diagonal) {
      el.style.width = `${(100 / COLS) * 1.4142}%`;
      el.style.height = `${thick}px`;
      el.style.transformOrigin = "0 50%";
      const angle = colOf(line.b) > colOf(line.a) ? 45 : 135;
      el.style.transform = `translate(0,-50%) rotate(${angle}deg)`;
    } else if (rowOf(line.a) === rowOf(line.b)) {
      el.style.width = `${100 / COLS}%`;
      el.style.height = `${thick}px`;
      el.style.transform = "translate(0,-50%)";
    } else {
      el.style.width = `${thick}px`;
      el.style.height = `${100 / ROWS}%`;
      el.style.transform = "translate(-50%,0)";
    }
    board.appendChild(el);
  }

  // 前沿走不通的那两列画座小山
  for (const c of [1, 3]) {
    const el = document.createElement("div");
    el.className = "jq-mountain";
    el.textContent = "⛰️";
    el.style.left = `${(c + 0.5) * (100 / COLS)}%`;
    el.style.top = "50%";
    board.appendChild(el);
  }

  const cells: HTMLButtonElement[] = [];
  const faces: HTMLElement[] = [];
  for (let p = 0; p < CELLS; p++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "jq-cell";
    btn.style.left = `${colOf(p) * (100 / COLS)}%`;
    btn.style.top = `${rowOf(p) * (100 / ROWS)}%`;
    const face = document.createElement("span");
    face.className = "jq-face";
    btn.appendChild(face);
    btn.addEventListener("click", () => {
      if (dragged) {
        dragged = false;
        return;
      }
      activate(p);
    });
    board.appendChild(btn);
    cells.push(btn);
    faces.push(face);
  }

  let selected = -1;
  let pending = -1;
  /** 一人一个光标：朵朵从自己家门口起，星星从对面家门口起，谁也拨不走谁的 */
  const cursors: Record<Side, Pos> = { duo: idx(9, 2), star: idx(2, 2) };
  let targets: Pos[] = [];
  let destroyed = false;
  let frozen = false;
  let dragged = false;
  let overrideCells: readonly Cell[] | null = null;
  let openAt: Pos[] = [];
  let goneAt: Pos[] = [];
  const timers: Array<ReturnType<typeof setTimeout>> = [];

  let scale = 1;
  let panX = 0;
  let panY = 0;
  const pointers = new Map<number, Pointer>();
  let pinchStart = 0;
  let pinchScale = 1;

  function applyTransform(): void {
    pan.style.transform = `translate(${panX}px,${panY}px) scale(${scale})`;
  }

  function stageSize(): { w: number; h: number } {
    const rect = stage.getBoundingClientRect?.();
    const w = rect && rect.width > 0 ? rect.width : 340;
    const h = rect && rect.height > 0 ? rect.height : 420;
    return { w, h };
  }

  function clampPan(): void {
    const { w, h } = stageSize();
    const boardW = w * scale;
    const boardH = w * 2.4 * scale;
    panX = Math.min(0, Math.max(w - boardW, panX));
    panY = Math.min(0, Math.max(h - boardH, panY));
  }

  /** 一上来先看自己这半边 */
  function focusHome(): void {
    const { w, h } = stageSize();
    panY = Math.min(0, h - w * 2.4 * scale);
    panX = 0;
    clampPan();
    applyTransform();
  }

  function zoom(delta: number): void {
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((scale + delta) * 100) / 100));
    clampPan();
    applyTransform();
  }

  function humanTurn(): boolean {
    return opts.humans.includes(state.turn);
  }

  /** 画面上只画一个光标：轮到谁就画谁的；电脑回合里画留在原地的那位真人的 */
  function activeSeat(): Side {
    return humanTurn() ? state.turn : (opts.humans[0] ?? "duo");
  }

  function shownCells(): readonly Cell[] {
    return overrideCells ?? state.cells;
  }

  function describe(p: Pos, kind: Kind | null, piece: Cell): string {
    const place = inCamp(p) ? "行营" : inHQ(p) ? "大本营" : "";
    if (!piece) return `${cellName(p)}${place ? `，${place}` : ""}，空格`;
    const who = piece.side === "duo" ? "朵朵" : "星星";
    const what = kind ? LABEL[kind] : "盖着的子";
    return `${cellName(p)}${place ? `，${place}` : ""}，${who}的${what}`;
  }

  function render(): void {
    if (destroyed) return;
    const view = shownCells();
    for (let p = 0; p < CELLS; p++) {
      const piece = view[p];
      const classes = ["jq-cell"];
      if (inCamp(p)) classes.push("jq-camp");
      if (inHQ(p)) classes.push("jq-hq");
      let kind: Kind | null = null;
      if (!piece) {
        classes.push("jq-empty");
      } else if (piece.side === opts.viewer || opts.viewer === "all" || openAt.includes(p)) {
        kind = piece.kind;
        classes.push(piece.side === "duo" ? "jq-duo" : "jq-star");
      } else {
        kind = visibleKind(state, opts.viewer, p);
        classes.push(kind ? (piece.side === "duo" ? "jq-duo" : "jq-star") : "jq-back");
      }
      if (openAt.includes(p) && piece) kind = piece.kind;
      if (p === selected) classes.push("jq-sel");
      if (targets.includes(p)) classes.push("jq-target");
      if (p === pending) classes.push("jq-pending");
      if (p === cursors[activeSeat()]) classes.push("jq-cursor");
      if (openAt.includes(p)) classes.push("jq-open");
      if (goneAt.includes(p)) classes.push("jq-gone");
      cells[p].className = classes.join(" ");
      faces[p].textContent = piece
        ? kind
          ? LABEL[kind]
          : "🎖️"
        : inCamp(p)
          ? "⛺"
          : inHQ(p)
            ? "🏠"
            : "";
      cells[p].setAttribute("aria-label", describe(p, kind, piece));
    }
    // 双人同屏时两个人的确认 / 取消键不一样，工具条上写轮到的那位那一套
    const starSeat = opts.humans.length > 1 && activeSeat() === "star";
    okBtn.textContent = starSeat ? "✅ 确认 (L)" : "✅ 确认 (F)";
    noBtn.textContent = starSeat ? "↩️ 取消 (K)" : "↩️ 取消 (G)";
    // 暂停期间这两个钮本来就点不动，那就别让它们看起来还能点
    const off = opts.isPaused?.() === true;
    okBtn.className = `jq-btn jq-go${off ? " jq-off" : ""}`;
    noBtn.className = `jq-btn${off ? " jq-off" : ""}`;
    for (const b of [okBtn, noBtn]) b.setAttribute("aria-disabled", String(off));
  }

  function clearPick(): void {
    selected = -1;
    pending = -1;
    targets = [];
  }

  function activate(at?: Pos, side: Side = activeSeat()): void {
    if (destroyed || frozen || opts.isPaused?.()) return;
    const to = at ?? cursors[side];
    cursors[side] = to;
    if (status(state).kind !== "playing" || !humanTurn() || side !== state.turn) {
      render();
      return;
    }
    if (pending >= 0 && to === pending) {
      const move = { from: selected, to: pending };
      clearPick();
      render();
      opts.onMove(move);
      return;
    }
    if (selected >= 0 && targets.includes(to)) {
      pending = to;
      render();
      opts.onNote(
        side === "duo"
          ? "选好落点啦，按「确认」或者 F 键走这一步。"
          : "选好落点啦，按「确认」或者 L 键走这一步。"
      );
      return;
    }
    const piece = state.cells[to];
    if (piece && piece.side === state.turn) {
      const moves = movesFrom(state.cells, to);
      if (moves.length === 0) {
        clearPick();
        render();
        opts.onNote(
          inHQ(to)
            ? "进了大本营的棋子就地休息，不能再动啦。"
            : "这一枚走不动，换一枚试试。"
        );
        return;
      }
      selected = to;
      pending = -1;
      targets = moves;
      render();
      opts.onNote("亮着的格子都能去，铁路上一整条都亮着。");
      return;
    }
    clearPick();
    render();
    opts.onNote("先点一枚自己的棋子。");
  }

  function cancel(side: Side = activeSeat()): void {
    if (destroyed || opts.isPaused?.()) return;
    // 选中的那一枚归当前该走的那一方，别人的取消键碰不着
    if (side !== activeSeat()) return;
    clearPick();
    render();
    opts.onNote("取消啦，重新点一枚。");
  }

  function moveCursor(dr: number, dc: number, side: Side = activeSeat()): void {
    if (destroyed || opts.isPaused?.()) return;
    const from = cursors[side];
    const r = Math.min(ROWS - 1, Math.max(0, rowOf(from) + dr));
    const c = Math.min(COLS - 1, Math.max(0, colOf(from) + dc));
    cursors[side] = idx(r, c);
    render();
  }

  function animateMove(
    before: readonly Cell[],
    move: Move,
    show: CombatShow | null,
    done: () => void
  ): void {
    if (destroyed) return;
    frozen = true;
    clearPick();
    if (!show) {
      render();
      const t = setTimeout(() => {
        frozen = false;
        overrideCells = null;
        render();
        done();
      }, Math.max(30, anim.fade));
      timers.push(t);
      return;
    }
    // 第一段：两子都翻开
    overrideCells = before.slice();
    openAt = [move.from, move.to];
    goneAt = [];
    render();
    const t1 = setTimeout(() => {
      if (destroyed) return;
      // 第二段：停一下，让人看清楚
      render();
      const t2 = setTimeout(() => {
        if (destroyed) return;
        // 第三段：回营休息的一方淡出
        goneAt =
          show.outcome === "both"
            ? [move.from, move.to]
            : show.outcome === "attacker"
              ? [move.to]
              : [move.from];
        render();
        const t3 = setTimeout(() => {
          if (destroyed) return;
          overrideCells = null;
          openAt = [];
          goneAt = [];
          frozen = false;
          render();
          done();
        }, anim.fade);
        timers.push(t3);
      }, anim.hold);
      timers.push(t2);
    }, anim.flip);
    timers.push(t1);
  }

  // ---- 缩放与拖动（手机上双指，桌面上按住拖） ----
  const onPointerDown = (e: PointerEvent): void => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      pinchScale = scale;
    }
  };
  const onPointerMove = (e: PointerEvent): void => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, cur);
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (pinchScale * dist) / pinchStart));
      dragged = true;
      clampPan();
      applyTransform();
      return;
    }
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
    panX += dx;
    panY += dy;
    clampPan();
    applyTransform();
  };
  const onPointerUp = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
  };

  stage.addEventListener("pointerdown", onPointerDown as EventListener);
  stage.addEventListener("pointermove", onPointerMove as EventListener);
  stage.addEventListener("pointerup", onPointerUp as EventListener);
  stage.addEventListener("pointercancel", onPointerUp as EventListener);

  // ---- 工具条：确认 / 取消 / 缩放 ----
  const tools = document.createElement("div");
  tools.className = "jq-tools";
  const okBtn = document.createElement("button");
  okBtn.type = "button";
  okBtn.className = "jq-btn jq-go";
  okBtn.textContent = "✅ 确认 (F)";
  okBtn.addEventListener("click", () => activate(pending >= 0 ? pending : undefined));
  const noBtn = document.createElement("button");
  noBtn.type = "button";
  noBtn.className = "jq-btn";
  noBtn.textContent = "↩️ 取消 (G)";
  noBtn.addEventListener("click", () => cancel());
  // 这三个钮上只有符号，读屏念「减号」「加号」听不出是干什么的，得配一句人话
  const outBtn = document.createElement("button");
  outBtn.type = "button";
  outBtn.className = "jq-btn";
  outBtn.textContent = "➖";
  outBtn.setAttribute("aria-label", "把棋盘缩小一点");
  outBtn.addEventListener("click", () => zoom(-0.15));
  const inBtn = document.createElement("button");
  inBtn.type = "button";
  inBtn.className = "jq-btn";
  inBtn.textContent = "➕";
  inBtn.setAttribute("aria-label", "把棋盘放大一点");
  inBtn.addEventListener("click", () => zoom(0.15));
  const homeBtn = document.createElement("button");
  homeBtn.type = "button";
  homeBtn.className = "jq-btn";
  homeBtn.textContent = "🏠 回自己这边";
  homeBtn.setAttribute("aria-label", "把画面移回自己这半边");
  homeBtn.addEventListener("click", focusHome);
  tools.append(okBtn, noBtn, outBtn, inBtn, homeBtn);
  wrap.appendChild(tools);

  const legend = document.createElement("div");
  legend.className = "jq-legend";
  for (const t of ["粗线是铁路", "细线是公路", "圆圈是行营", "方块是大本营", "⛰️ 过不去"]) {
    const s = document.createElement("span");
    s.textContent = t;
    legend.appendChild(s);
  }
  wrap.appendChild(legend);

  focusHome();
  render();

  return {
    refresh: render,
    animateMove,
    moveCursor,
    activate,
    cancel,
    zoom,
    cursor: (side: Side = activeSeat()) => cursors[side],
    selected: () => selected,
    pending: () => pending,
    scale: () => scale,
    destroy() {
      destroyed = true;
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      stage.removeEventListener("pointerdown", onPointerDown as EventListener);
      stage.removeEventListener("pointermove", onPointerMove as EventListener);
      stage.removeEventListener("pointerup", onPointerUp as EventListener);
      stage.removeEventListener("pointercancel", onPointerUp as EventListener);
      wrap.remove();
    },
  };
}

/** 视图用得到的一点点常量（单测拿它对 360px 的手感） */
export const VIEW_INFO = {
  rows: ROWS,
  cols: COLS,
  camps: CAMP.duo.length + CAMP.star.length,
  hqs: HQ.duo.length + HQ.star.length,
  minPieceFont: PIECE_FONT * MIN_SCALE,
};
