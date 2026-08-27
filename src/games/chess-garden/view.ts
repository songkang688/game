/**
 * 花园国际象棋 · 棋盘视图（纯 DOM，没有 canvas，也没有任何外部依赖）。
 *
 * 一层格子（64 个按钮，点选 / 拖拽 / 键盘都走它）+ 一层棋子。
 * 走子时先算出起落两格的像素差，把棋子先放回起点再让它滑过去，
 * 所以 150–220ms 的滑行是真滑，不是瞬移；`prefers-reduced-motion` 下会缩短。
 *
 * 视图只负责「显示」和「收集玩家意图」，规则一律回到 rules.ts / moves.ts 里问。
 */
import {
  BLACK,
  PIECE_CN,
  WHITE,
  fileOf,
  kingSquare,
  rankOf,
  squareName,
  typeOf,
  type Color,
  type PieceType,
  type Position,
} from "./board";
import type { SoundName } from "../level99";
import { inCheck, legalMoves, makeMove, toChinese, type Move } from "./moves";
import { createGame, gameStatus, playMove, resign, type Game, type Status } from "./rules";
import type { AiTier } from "./search";

/** 国际通用的棋子符号；下面还会配一个中文角标，六种一眼能分开 */
const GLYPH: Record<PieceType, [string, string]> = {
  1: ["♙", "♟"],
  2: ["♘", "♞"],
  3: ["♗", "♝"],
  4: ["♖", "♜"],
  5: ["♕", "♛"],
  6: ["♔", "♚"],
};

/** 走子滑行时长（毫秒）；规格要求 150–220ms */
export const SLIDE_MS = 180;
/** 关掉动画偏好时缩到这么短 */
export const SLIDE_MS_REDUCED = 40;

export interface SeatPlan {
  name: string;
  emoji: string;
  color: string;
  /** null 表示这一方是人 */
  ai: AiTier | null;
}

export interface Judgement {
  ok: boolean;
  msg?: string;
}

export interface BoardOptions {
  /** 起手局面；不给就是标准开局 */
  fen?: string;
  seats: [SeatPlan, SeatPlan];
  banner: string;
  tip: string;
  /** 显示可走点提示 */
  showHints?: boolean;
  /** 翻转棋盘（黑在下） */
  flipped?: boolean;
  /** 显示「翻转棋盘」按钮（双人同屏用） */
  allowFlip?: boolean;
  /** 显示「认输」按钮 */
  allowResign?: boolean;
  sfx: (n: SoundName) => void;
  /** 人走的每一手先过这一关；返回 ok:false 就退回去重走（闯关题目用） */
  judge?: (move: Move, pos: Position, game: Game) => Judgement;
  /** 任何一方走完一手之后 */
  onMoved?: (move: Move, game: Game) => void;
  /** 结算 */
  onOver?: (st: Status, game: Game) => void;
  /** 轮到 AI 时问它走哪一步；返回 null 表示这一方交给人下 */
  think?: (game: Game, seat: 0 | 1) => Move | null;
  /** AI 落子前的思考停顿（毫秒），测试里传 0 */
  aiDelayMs?: number;
}

export interface BoardHandle {
  game: Game;
  /** 外面改了提示语 / 横幅 */
  update: (patch: { banner?: string; tip?: string }) => void;
  /** 从头再来（可换局面） */
  reset: (fen?: string) => void;
  /** 让当前这一方认输 */
  giveUp: (side: Color) => void;
  /** 单测用：直接替玩家走一手，等价于点两下格子 */
  playHuman: (move: Move) => boolean;
  /** 单测用：现在轮到谁、界面上都长什么样 */
  snapshot: () => { turn: Color; tip: string; selected: number; cursor: number; over: boolean };
  destroy: () => void;
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(cls: string, text: string): HTMLButtonElement {
  const b = document.createElement("button") as HTMLButtonElement;
  b.type = "button";
  b.className = cls;
  b.textContent = text;
  return b;
}

function prefersReducedMotion(): boolean {
  const mq = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return mq ? mq("(prefers-reduced-motion: reduce)").matches : false;
  } catch {
    return false;
  }
}

/** 键盘光标的移动：`flipped` 时上下左右整体反过来，看到的方向和按的方向一致 */
export function moveCursor(cursor: number, dx: number, dy: number, flipped: boolean): number {
  const sign = flipped ? -1 : 1;
  const f = Math.max(0, Math.min(7, fileOf(cursor) + dx * sign));
  const r = Math.max(0, Math.min(7, rankOf(cursor) + dy * sign));
  return r * 8 + f;
}

/** 棋盘从上到下、从左到右的格子顺序（`flipped` 时黑在下） */
export function boardOrder(flipped: boolean): number[] {
  const out: number[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const rank = flipped ? row : 7 - row;
      const file = flipped ? 7 - col : col;
      out.push(rank * 8 + file);
    }
  }
  return out;
}

export function createBoard(host: HTMLElement, opts: BoardOptions): BoardHandle {
  let game = createGame(opts.fen);
  let flipped = opts.flipped ?? false;
  let showHints = opts.showHints ?? true;
  let selected = -1;
  let cursor = flipped ? 60 : 4;
  let tip = opts.tip;
  let banner = opts.banner;
  let paused = false;
  let closed = false;
  let pendingPromo: { from: number; to: number } | null = null;
  let lastMove: Move | null = null;
  let aiTimer: ReturnType<typeof setTimeout> | null = null;
  let slideFrame: number | null = null;
  const cleanups: Array<() => void> = [];

  const slideMs = prefersReducedMotion() ? SLIDE_MS_REDUCED : SLIDE_MS;

  const wrap = el("div", "cg-wrap");
  const head = el("div", "cg-head");
  const bannerEl = el("div", "cg-banner", banner);
  const tools = el("div", "cg-tools");
  const hintBtn = button("cg-tool", "");
  const flipBtn = button("cg-tool", "🔄 翻转棋盘");
  const resignBtn = button("cg-tool cg-tool--warn", "🏳️ 认输");
  const seatBar = el("div", "cg-seats");
  const boardEl = el("div", "cg-board");
  const tipEl = el("div", "cg-tip", tip);
  const logBox = el("details", "cg-log");
  const logSummary = el("summary", "cg-log-sum", "📜 记谱");
  const logList = el("div", "cg-log-list");
  const overlay = el("div", "cg-overlay");
  overlay.hidden = true;

  logBox.append(logSummary, logList);
  head.append(bannerEl, tools);
  wrap.append(head, seatBar, boardEl, tipEl, logBox, overlay);
  host.appendChild(wrap);

  const squares: HTMLElement[] = [];
  for (let i = 0; i < 64; i++) {
    const b = button("cg-sq", "");
    squares.push(b);
  }

  function bind(target: unknown, type: string, fn: (ev: unknown) => void): void {
    const t = target as { addEventListener?: (t: string, f: unknown) => void; removeEventListener?: (t: string, f: unknown) => void };
    if (!t || typeof t.addEventListener !== "function") return;
    t.addEventListener(type, fn);
    cleanups.push(() => t.removeEventListener?.(type, fn));
  }

  // -------------------------------------------------------------------------
  // 渲染
  // -------------------------------------------------------------------------

  function seatOf(color: Color): SeatPlan {
    return color === WHITE ? opts.seats[0] : opts.seats[1];
  }

  function humanTurn(): boolean {
    return seatOf(game.pos.turn).ai === null;
  }

  function hintTargets(): Move[] {
    if (!showHints || selected < 0) return [];
    return legalMoves(game.pos, selected);
  }

  function renderSeats(): void {
    seatBar.innerHTML = "";
    for (const color of [WHITE, BLACK] as Color[]) {
      const seat = seatOf(color);
      const chip = el("span", `cg-seat${game.pos.turn === color && !game.result ? " cg-seat--on" : ""}`);
      chip.textContent = `${seat.emoji} ${seat.name}${color === WHITE ? "（白）" : "（黑）"}`;
      chip.style.background = seat.color;
      seatBar.appendChild(chip);
    }
  }

  function renderBoard(): void {
    const order = boardOrder(flipped);
    const hints = hintTargets();
    const checkSide = game.pos.turn;
    const checkSq = inCheck(game.pos, checkSide) ? kingSquare(game.pos, checkSide) : -1;
    boardEl.innerHTML = "";
    for (const sq of order) {
      const b = squares[sq];
      const light = (fileOf(sq) + rankOf(sq)) % 2 === 1;
      const hit = hints.find((m) => m.to === sq);
      const cls = ["cg-sq", light ? "cg-sq--light" : "cg-sq--dark"];
      if (sq === selected) cls.push("cg-sq--sel");
      if (sq === cursor) cls.push("cg-sq--cursor");
      if (sq === checkSq) cls.push("cg-sq--check");
      if (lastMove && (sq === lastMove.from || sq === lastMove.to)) cls.push("cg-sq--last");
      if (hit) cls.push(hit.captured !== 0 ? "cg-sq--cap" : "cg-sq--hint");
      b.className = cls.join(" ");
      b.innerHTML = "";
      const piece = game.pos.board[sq];
      if (piece !== 0) {
        const type = typeOf(piece) as PieceType;
        const white = piece > 0;
        const chip = el("span", `cg-piece ${white ? "cg-piece--w" : "cg-piece--b"}`);
        chip.appendChild(el("span", "cg-piece-mark", GLYPH[type][white ? 0 : 1]));
        chip.appendChild(el("span", "cg-piece-tag", PIECE_CN[type]));
        b.appendChild(chip);
      }
      b.setAttribute("aria-label", squareLabel(sq));
      boardEl.appendChild(b);
    }
  }

  function squareLabel(sq: number): string {
    const piece = game.pos.board[sq];
    const name = squareName(sq);
    if (piece === 0) return `${name} 空格`;
    const type = typeOf(piece) as PieceType;
    return `${name} ${piece > 0 ? "白" : "黑"}${PIECE_CN[type]}`;
  }

  function renderLog(): void {
    logList.innerHTML = "";
    const rows = game.history;
    for (let i = 0; i < rows.length; i += 2) {
      const line = el("div", "cg-log-row");
      line.textContent = `${Math.floor(i / 2) + 1}. ${rows[i].san}${rows[i + 1] ? ` ${rows[i + 1].san}` : ""}`;
      logList.appendChild(line);
    }
    logSummary.textContent = `📜 记谱（${Math.ceil(rows.length / 2)} 回合）`;
  }

  function render(): void {
    if (closed) return;
    bannerEl.textContent = banner;
    tipEl.textContent = tip;
    hintBtn.textContent = showHints ? "💡 提示：开" : "💡 提示：关";
    hintBtn.setAttribute("aria-pressed", String(showHints));
    flipBtn.hidden = !opts.allowFlip;
    resignBtn.hidden = !opts.allowResign || Boolean(game.result);
    renderSeats();
    renderBoard();
    renderLog();
  }

  /** 走完一手让棋子滑过去：先按起点摆好，再在下一帧回到落点 */
  function animate(move: Move): void {
    const target = squares[move.to];
    const chip = target.children?.[0] as HTMLElement | undefined;
    if (!chip || typeof chip.getBoundingClientRect !== "function") return;
    const a = squares[move.from].getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (dx === 0 && dy === 0) return;
    chip.style.transition = "none";
    chip.style.transform = `translate(${dx}px, ${dy}px)`;
    const raf = (globalThis as { requestAnimationFrame?: (cb: () => void) => number }).requestAnimationFrame;
    const run = (): void => {
      if (closed) return;
      chip.style.transition = `transform ${slideMs}ms cubic-bezier(.22,.68,.36,1)`;
      chip.style.transform = "translate(0px, 0px)";
    };
    if (raf) slideFrame = raf(run);
    else run();
  }

  // -------------------------------------------------------------------------
  // 走子
  // -------------------------------------------------------------------------

  function settleIfOver(): boolean {
    const st = gameStatus(game);
    if (!st.over) return false;
    tip = st.text;
    selected = -1;
    render();
    opts.sfx(st.winner === 0 ? "pop" : st.winner === WHITE ? "win" : "oops");
    opts.onOver?.(st, game);
    return true;
  }

  function applyMove(move: Move, byHuman: boolean): boolean {
    if (closed || paused || game.result) return false;
    const before = game.pos;
    if (byHuman && opts.judge) {
      const verdict = opts.judge(move, before, game);
      if (!verdict.ok) {
        selected = -1;
        tip = verdict.msg ?? "换一手试试，这一手之后就抓不住了。";
        opts.sfx("oops");
        render();
        return false;
      }
    }
    if (!playMove(game, move)) return false;
    lastMove = move;
    selected = -1;
    cursor = move.to;
    opts.sfx(move.captured !== 0 ? "pop" : "tap");
    tip = toChinese(move, before);
    render();
    animate(move);
    opts.onMoved?.(move, game);
    if (settleIfOver()) return true;
    scheduleAi();
    return true;
  }

  function scheduleAi(): void {
    if (closed || paused || game.result) return;
    if (humanTurn()) return;
    const seat: 0 | 1 = game.pos.turn === WHITE ? 0 : 1;
    const delay = opts.aiDelayMs ?? 320;
    const run = (): void => {
      aiTimer = null;
      if (closed || paused || game.result) return;
      const move = opts.think?.(game, seat) ?? null;
      if (!move) return;
      applyMove(move, false);
    };
    if (delay <= 0) run();
    else aiTimer = setTimeout(run, delay);
  }

  function pickSquare(sq: number): void {
    if (closed || paused || game.result || pendingPromo) return;
    if (!humanTurn()) return;
    cursor = sq;
    const piece = game.pos.board[sq];
    if (selected >= 0) {
      const options = legalMoves(game.pos, selected).filter((m) => m.to === sq);
      if (options.length > 1 && options[0].promo) {
        pendingPromo = { from: selected, to: sq };
        showPromoPicker();
        return;
      }
      if (options.length === 1) {
        applyMove(options[0], true);
        return;
      }
    }
    if (piece !== 0 && (piece > 0 ? WHITE : BLACK) === game.pos.turn) {
      selected = selected === sq ? -1 : sq;
      opts.sfx("tap");
    } else {
      selected = -1;
    }
    render();
  }

  function showPromoPicker(): void {
    const box = el("div", "cg-promo");
    box.appendChild(el("div", "cg-promo-t", "升变！挑一个兵种"));
    const row = el("div", "cg-promo-row");
    const white = game.pos.turn === WHITE;
    for (const type of [5, 4, 3, 2] as PieceType[]) {
      const b = button("cg-promo-b", `${GLYPH[type][white ? 0 : 1]} ${PIECE_CN[type]}`);
      b.setAttribute("aria-label", `升变成${PIECE_CN[type]}`);
      b.addEventListener("click", () => {
        const pick = pendingPromo;
        pendingPromo = null;
        overlay.hidden = true;
        overlay.innerHTML = "";
        if (!pick) return;
        const move = legalMoves(game.pos, pick.from).find((m) => m.to === pick.to && m.promo === type);
        if (move) applyMove(move, true);
        else render();
      });
      row.appendChild(b);
    }
    box.appendChild(row);
    overlay.innerHTML = "";
    overlay.appendChild(box);
    overlay.hidden = false;
  }

  function pause(): void {
    if (paused) return;
    paused = true;
    if (aiTimer !== null) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    const box = el("div", "cg-promo");
    box.appendChild(el("div", "cg-promo-t", "⏸️ 先歇一下"));
    box.appendChild(el("div", "cg-promo-s", "棋局停在这儿了，想好了再继续（再按一次 Esc 也行）。"));
    const b = button("cg-promo-b", "▶ 继续下棋");
    b.addEventListener("click", resume);
    box.appendChild(b);
    overlay.innerHTML = "";
    overlay.appendChild(box);
    overlay.hidden = false;
  }

  function resume(): void {
    if (!paused) return;
    paused = false;
    overlay.hidden = true;
    overlay.innerHTML = "";
    opts.sfx("tap");
    render();
    scheduleAi();
  }

  // -------------------------------------------------------------------------
  // 输入
  // -------------------------------------------------------------------------

  for (let sq = 0; sq < 64; sq++) {
    squares[sq].addEventListener("click", () => pickSquare(sq));
  }

  hintBtn.addEventListener("click", () => {
    showHints = !showHints;
    opts.sfx("tap");
    render();
  });
  flipBtn.addEventListener("click", () => {
    flipped = !flipped;
    opts.sfx("tap");
    render();
  });
  resignBtn.addEventListener("click", () => {
    giveUp(game.pos.turn);
  });
  tools.append(hintBtn, flipBtn, resignBtn);

  /** 朵朵执白 WASD 移光标、F 选中 / 落子、G 取消；星星执黑 方向键 + L / K；Esc 暂停与继续 */
  const WHITE_KEYS: Record<string, [number, number]> = {
    w: [0, 1],
    s: [0, -1],
    a: [-1, 0],
    d: [1, 0],
  };
  const BLACK_KEYS: Record<string, [number, number]> = {
    ArrowUp: [0, 1],
    ArrowDown: [0, -1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
  };

  function onKey(raw: unknown): void {
    if (closed) return;
    const ev = raw as { key?: string; preventDefault?: () => void };
    const key = ev.key ?? "";
    if (key === "Escape") {
      ev.preventDefault?.();
      // Esc 是开关：按一次停下来，再按一次接着下（和另外四款一个口径）
      if (paused) resume();
      else pause();
      return;
    }
    if (paused || pendingPromo || game.result) return;
    const lower = key.length === 1 ? key.toLowerCase() : key;
    const whiteStep = WHITE_KEYS[lower];
    const blackStep = BLACK_KEYS[key];
    if (whiteStep && game.pos.turn === WHITE) {
      ev.preventDefault?.();
      cursor = moveCursor(cursor, whiteStep[0], whiteStep[1], flipped);
      render();
      return;
    }
    if (blackStep && game.pos.turn === BLACK) {
      ev.preventDefault?.();
      cursor = moveCursor(cursor, blackStep[0], blackStep[1], flipped);
      render();
      return;
    }
    if ((lower === "f" && game.pos.turn === WHITE) || (lower === "l" && game.pos.turn === BLACK)) {
      ev.preventDefault?.();
      pickSquare(cursor);
      return;
    }
    // 取消键：朵朵 G、星星 K，把刚选中的那颗子放回去，选错了不用非得走一手
    if ((lower === "g" && game.pos.turn === WHITE) || (lower === "k" && game.pos.turn === BLACK)) {
      ev.preventDefault?.();
      if (selected < 0) return;
      selected = -1;
      opts.sfx("tap");
      render();
    }
  }

  const keyHost = (globalThis as { window?: unknown }).window ?? globalThis;
  bind(keyHost, "keydown", onKey);

  // -------------------------------------------------------------------------
  // 对外
  // -------------------------------------------------------------------------

  function giveUp(side: Color): void {
    if (game.result) return;
    const st = resign(game, side);
    tip = st.text;
    render();
    opts.sfx("oops");
    opts.onOver?.(st, game);
  }

  function reset(fen?: string): void {
    if (aiTimer !== null) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    game = createGame(fen ?? opts.fen);
    selected = -1;
    lastMove = null;
    paused = false;
    pendingPromo = null;
    overlay.hidden = true;
    overlay.innerHTML = "";
    tip = opts.tip;
    cursor = flipped ? 60 : 4;
    render();
    scheduleAi();
  }

  render();
  scheduleAi();

  return {
    get game() {
      return game;
    },
    update(patch) {
      if (patch.banner !== undefined) banner = patch.banner;
      if (patch.tip !== undefined) tip = patch.tip;
      render();
    },
    reset,
    giveUp,
    playHuman(move) {
      return applyMove(move, true);
    },
    snapshot() {
      return { turn: game.pos.turn, tip, selected, cursor, over: Boolean(game.result) };
    },
    destroy() {
      closed = true;
      if (aiTimer !== null) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }
      if (slideFrame !== null) {
        (globalThis as { cancelAnimationFrame?: (h: number) => void }).cancelAnimationFrame?.(slideFrame);
        slideFrame = null;
      }
      while (cleanups.length) cleanups.pop()?.();
      wrap.remove();
    },
  };
}

/** 给外面算「这一手会不会走出去就吃子」用的小工具，攻略与提示语共用 */
export function describeMove(move: Move, pos: Position): string {
  return toChinese(move, pos);
}

/** 落子后局面（视图之外也要用，例如闯关判定） */
export function previewMove(pos: Position, move: Move): Position {
  return makeMove(pos, move);
}
