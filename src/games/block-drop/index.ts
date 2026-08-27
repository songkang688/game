import { meta } from "./meta";
export { meta };

// 方块叠叠乐:七种小方块轮流落下,凑满一整行就开花消掉。
// 188 关战役 + 对战发垃圾行 + 马拉松/竞速无尽 + 同屏双人,对手是本机 AI,全程离线。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import {
  compatFromMeta,
  describeModes,
  modeEntryKeys,
  type ModeEntry
} from "../../engine";
import { save } from "../../engine/save";
import { prefersReducedMotion } from "../../engine/view25d";
import {
  COLS,
  GARBAGE_CELL,
  ROWS,
  VISIBLE_ROWS,
  addGarbage,
  clearLines,
  cloneBoard,
  collides,
  createBoard,
  dropPosition,
  lockPiece,
  type Board
} from "./board";
import {
  PIECE_COLORS,
  PIECE_IDS,
  PIECE_MARKS,
  PieceQueue,
  cellsFor,
  rng,
  spawnX,
  type Cell,
  type PieceId,
  type Rot
} from "./pieces";
import { tryRotate } from "./srs";
import {
  LOCK_DELAY,
  cancelGarbage,
  detectTSpin,
  garbageFor,
  gravity,
  holdSwap,
  isB2BMove,
  levelOf,
  lockReset,
  lockStep,
  overLine,
  scoreFor,
  type TSpinKind
} from "./score";
import {
  CHAPTERS,
  endlessConfig,
  goalLine,
  levelConfig,
  levelWon,
  starsFor,
  startBoard,
  versusConfig,
  type EndlessKind
} from "./levels";
import { AI_TIER_LABELS, choosePlacement, type AiTier } from "./ai";

/** 消行开花动画的时长(秒):150–250ms,不允许瞬删 */
export const CLEAR_ANIM_SEC = 0.22;
/** 硬降压扁动画时长 */
export const SLAM_ANIM_SEC = 0.12;

/**
 * 按住不放时系统会一秒发三十来个 `keydown`。挪左挪右、软降本来就该跟着连发,
 * 但硬降、旋转、暂存是「按一下算一下」—— 手指在硬降键上多停半秒,
 * 一关的方块预算就白白倒掉好几块。这里只放行该连发的那几个键。
 */
const REPEATABLE_KEYS = new Set(["a", "d", "s", "ArrowLeft", "ArrowRight", "ArrowDown"]);

export function acceptsRepeat(key: string): boolean {
  return REPEATABLE_KEYS.has(key.length === 1 ? key.toLowerCase() : key);
}

const CSS = `
.bd-wrap{font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:linear-gradient(180deg,#EEF4FF,#F9FBFF);
  border-radius:16px;padding:10px;user-select:none;}
.bd-top{display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;margin-bottom:6px;}
.bd-badge{background:#fff;border-radius:14px;padding:5px 10px;font-weight:800;font-size:16px;color:#3f5b8a;
  box-shadow:0 2px 6px rgba(130,150,200,.25);overflow-wrap:anywhere;}
.bd-seats{display:flex;flex-direction:column;gap:10px;align-items:center;}
.bd-seats.bd-split{flex-direction:column;}
.bd-seat{display:flex;gap:8px;align-items:flex-start;justify-content:center;max-width:100%;}
.bd-canvas{border-radius:12px;background:#F4F7FF;touch-action:none;display:block;max-width:100%;height:auto;}
.bd-side{display:flex;flex-direction:column;gap:6px;min-width:64px;}
.bd-mini{background:#ffffffcc;border-radius:10px;padding:4px 6px;font-size:16px;font-weight:800;color:#3f5b8a;
  text-align:center;overflow-wrap:anywhere;line-height:1.4;}
.bd-pad{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:8px;}
.bd-btn{min-width:56px;min-height:46px;border:none;border-radius:14px;font-family:inherit;font-size:15px;
  font-weight:900;cursor:pointer;background:#C9DBF7;color:#2f4a75;box-shadow:0 3px 0 #A2BEE8;padding:0 10px;}
.bd-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #A2BEE8;}
.bd-btn.bd-star{background:#F7D9E4;color:#7a3a58;box-shadow:0 3px 0 #E3AFC4;}
.bd-btn:focus-visible{outline:3px solid #24406b;outline-offset:3px;}
.bd-msg{text-align:center;min-height:20px;color:#3f5b8a;font-weight:800;margin-top:6px;font-size:16px;
  overflow-wrap:anywhere;line-height:1.5;}
.bd-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.bd-modetip{flex:1 1 100%;margin:0 0 2px;font-size:16px;line-height:1.5;font-weight:700;color:#3f5b8a;text-align:center;overflow-wrap:anywhere;}
.bd-open{border:none;border-radius:999px;padding:9px 18px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  font-family:inherit;background:linear-gradient(180deg,#7fa5e0,#5c83c4);box-shadow:0 4px 0 #47679f;}
.bd-open:active{transform:translateY(2px);box-shadow:0 2px 0 #47679f;}
.bd-mode{max-width:820px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",sans-serif;}
.bd-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;}
.bd-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffd9;color:#5c83c4;box-shadow:0 3px 0 rgba(100,130,190,.3);}
.bd-over{text-align:center;padding:24px 16px;background:#fff;border-radius:18px;box-shadow:0 4px 14px rgba(130,150,200,.25);}
.bd-over-t{font-size:21px;font-weight:900;color:#3f5b8a;margin-bottom:8px;}
.bd-over-s{font-size:16px;font-weight:700;color:#54709b;line-height:1.6;margin-bottom:14px;overflow-wrap:anywhere;}
@media (min-width:760px){
  .bd-seats.bd-split{flex-direction:row;align-items:flex-start;}
}
@media (max-width:360px){
  .bd-badge{padding:4px 8px;}
  .bd-btn{min-width:48px;font-size:14px;padding:0 6px;}
  /* 窄屏把预览与暂存收成顶上一行,场地才占得满宽 */
  .bd-seat{flex-direction:column-reverse;align-items:stretch;gap:6px;}
  .bd-side{flex-direction:row;min-width:0;gap:4px;}
  .bd-side .bd-mini{flex:1 1 0;min-width:0;}
  .bd-mini{padding:3px 4px;}
}
`;

const COLOR_INDEX: Record<PieceId, number> = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };
const INDEX_COLOR: string[] = [
  "",
  PIECE_COLORS.I,
  PIECE_COLORS.O,
  PIECE_COLORS.T,
  PIECE_COLORS.S,
  PIECE_COLORS.Z,
  PIECE_COLORS.J,
  PIECE_COLORS.L,
  "#C9CEDB"
];
const INDEX_MARK: string[] = ["", PIECE_MARKS.I, PIECE_MARKS.O, PIECE_MARKS.T, PIECE_MARKS.S, PIECE_MARKS.Z, PIECE_MARKS.J, PIECE_MARKS.L, ""];

export interface SeatResult {
  lines: number;
  score: number;
  used: number;
  toppedOut: boolean;
  bestCombo: number;
  tspins: number;
  quads: number;
  usedHold: boolean;
  usedKick: boolean;
  sec: number;
}

interface SeatOpts {
  name: string;
  /** 人类玩家的键位;不给就是本机 AI */
  human?: "duo" | "star";
  tier?: AiTier;
  seed: number;
  bag: PieceId[];
  startLevel: number;
  start: Board;
  /** 用完这么多块就结束,0 表示不限 */
  pieceBudget: number;
  /** 消满这么多行就结束,0 表示不限 */
  targetLines: number;
  sfx: (n: "tap" | "win" | "oops" | "coin" | "pop") => void;
  onSend: (lines: number) => void;
  onDone: (r: SeatResult) => void;
  cellPx: number;
}

/**
 * 一个人(或者一个 AI)的一块场地。战役、对战、双人都复用这一份。
 */
interface Seat {
  destroy: () => void;
  step: (dt: number) => void;
  draw: () => void;
  receive: (lines: number) => void;
  state: () => SeatResult;
  move: (dx: number) => boolean;
  rotate: (dir: 1 | -1) => boolean;
  softDrop: () => void;
  hardDrop: () => void;
  doHold: () => void;
  toggleGhost: () => void;
  isOver: () => boolean;
}

function createSeat(host: HTMLElement, opts: SeatOpts): Seat {
  const soft = prefersReducedMotion();
  const rand = rng(opts.seed);
  const queue = new PieceQueue(rand, opts.bag);
  let board = cloneBoard(opts.start);

  let cur: PieceId = queue.take();
  let rot: Rot = 0;
  let px = spawnX(cur, COLS);
  let py = 0;
  let held: PieceId | null = null;
  let holdLocked = false;
  let lastMoveWasRotate = false;
  let lastKickIndex = 0;

  let lock = { timer: 0, resets: 0 };
  let fallAcc = 0;
  let lines = 0;
  let score = 0;
  let used = 0;
  let combo = 0;
  let bestCombo = 0;
  let b2b = false;
  let tspins = 0;
  let quads = 0;
  let usedHold = false;
  let usedKick = false;
  let incoming = 0;
  let over = false;
  let elapsed = 0;
  let clearAnim = 0;
  let clearRows: number[] = [];
  let slam = 0;
  let ghostOn = true;

  const seat = document.createElement("div");
  seat.className = "bd-seat";
  const canvas = document.createElement("canvas");
  canvas.className = "bd-canvas";
  const cell = Math.max(22, Math.round(opts.cellPx));
  canvas.width = COLS * cell;
  canvas.height = VISIBLE_ROWS * cell;
  canvas.setAttribute("aria-label", `${opts.name} 的场地`);
  const side = document.createElement("div");
  side.className = "bd-side";
  const holdBox = document.createElement("div");
  holdBox.className = "bd-mini";
  const nextBox = document.createElement("div");
  nextBox.className = "bd-mini";
  const statBox = document.createElement("div");
  statBox.className = "bd-mini";
  side.append(holdBox, nextBox, statBox);
  seat.append(canvas, side);
  host.appendChild(seat);

  function cells(): Cell[] {
    return cellsFor(cur, rot);
  }

  function hits(cs: readonly Cell[], x: number, y: number): boolean {
    return collides(board, cs, x, y);
  }

  function grounded(): boolean {
    return hits(cells(), px, py + 1);
  }

  function spawn(): void {
    cur = queue.take();
    rot = 0;
    px = spawnX(cur, COLS);
    py = 0;
    lock = { timer: 0, resets: 0 };
    holdLocked = false;
    lastMoveWasRotate = false;
    lastKickIndex = 0;
    if (hits(cells(), px, py)) finish(true);
  }

  function move(dx: number): boolean {
    if (over || clearAnim > 0) return false;
    if (hits(cells(), px + dx, py)) return false;
    px += dx;
    lastMoveWasRotate = false;
    if (grounded()) lock = lockReset(lock);
    return true;
  }

  function rotate(dir: 1 | -1): boolean {
    if (over || clearAnim > 0) return false;
    const r = tryRotate(cur, rot, px, py, dir, (cs, x, y) => hits(cs, x, y));
    if (!r) return false;
    px = r.x;
    py = r.y;
    rot = r.rot;
    lastMoveWasRotate = true;
    lastKickIndex = r.kickIndex;
    if (r.kicked) usedKick = true;
    if (grounded()) lock = lockReset(lock);
    opts.sfx("tap");
    return true;
  }

  function softDrop(): void {
    if (over || clearAnim > 0) return;
    if (!hits(cells(), px, py + 1)) {
      py += 1;
      score += 1;
      lastMoveWasRotate = false;
    }
  }

  function hardDrop(): void {
    if (over || clearAnim > 0) return;
    const landing = dropPosition(board, cells(), px, py);
    const dist = landing - py;
    py = landing;
    score += dist * 2;
    lastMoveWasRotate = false;
    slam = soft ? 0 : SLAM_ANIM_SEC;
    place();
  }

  function doHold(): void {
    if (over || clearAnim > 0) return;
    const swap = holdSwap(cur, held, holdLocked);
    if (!swap.ok) return;
    held = swap.held;
    holdLocked = swap.locked;
    usedHold = true;
    opts.sfx("pop");
    if (swap.next) {
      cur = swap.next;
      rot = 0;
      px = spawnX(cur, COLS);
      py = 0;
      lock = { timer: 0, resets: 0 };
      if (hits(cells(), px, py)) finish(true);
    } else {
      spawn();
    }
  }

  /** 把当前块钉进场地,结算消行、分数与要发出去的垃圾行 */
  function place(): void {
    if (over) return;
    const spin: TSpinKind = detectTSpin(board, cur, rot, px, py, lastMoveWasRotate, lastKickIndex);
    board = lockPiece(board, cells(), px, py, COLOR_INDEX[cur]);
    used += 1;

    const cleared = clearLines(board);
    const n = cleared.count;
    const res = scoreFor({ lines: n, tspin: spin, level: levelOf(lines, opts.startLevel), backToBack: b2b, combo });
    score += res.points;
    b2b = res.backToBack;
    combo = res.combo;
    bestCombo = Math.max(bestCombo, combo);

    if (n > 0) {
      lines += n;
      if (n >= 4) quads += 1;
      if (spin !== "none") tspins += 1;
      clearRows = cleared.rows;
      clearAnim = soft ? 0.06 : CLEAR_ANIM_SEC;
      opts.sfx(n >= 4 || spin !== "none" ? "win" : "coin");
      const send = garbageFor(n, spin, isB2BMove(n, spin) && b2b);
      const cut = cancelGarbage(incoming, send);
      incoming = cut.incoming;
      if (cut.outgoing > 0) opts.onSend(cut.outgoing);
      // 消行动画放完再把新块放出来
      pendingBoard = cleared.board;
    } else {
      opts.sfx("tap");
      // 没消行,别人发过来的垃圾这时候升起来
      if (incoming > 0) {
        board = addGarbage(board, incoming, Math.floor(rand() * COLS) % COLS);
        incoming = 0;
      }
      afterPlace();
    }
  }

  let pendingBoard: Board | null = null;

  function afterPlace(): void {
    if (over) return;
    if (opts.targetLines > 0 && lines >= opts.targetLines) {
      finish(false);
      return;
    }
    if (opts.pieceBudget > 0 && used >= opts.pieceBudget) {
      finish(false);
      return;
    }
    spawn();
  }

  function finish(toppedOut: boolean): void {
    if (over) return;
    over = true;
    opts.sfx(toppedOut ? "oops" : "win");
    opts.onDone(state(toppedOut));
  }

  function state(toppedOut = false): SeatResult {
    return { lines, score, used, toppedOut, bestCombo, tspins, quads, usedHold, usedKick, sec: elapsed };
  }

  // ---- AI ----
  let aiCooldown = 0;
  function aiTurn(): void {
    if (!opts.tier || over || clearAnim > 0) return;
    aiCooldown -= 1;
    if (aiCooldown > 0) return;
    aiCooldown = Math.max(2, 12 - opts.startLevel);
    const next = queue.peek(1)[0] ?? null;
    const pick = choosePlacement(board, cur, opts.tier, { next, incoming, rand });
    if (!pick) {
      finish(true);
      return;
    }
    rot = pick.rot;
    px = pick.x;
    py = pick.y;
    lastMoveWasRotate = pick.spun;
    lastKickIndex = pick.kickIndex;
    place();
  }

  function step(dt: number): void {
    if (over) return;
    elapsed += dt;
    if (slam > 0) slam = Math.max(0, slam - dt);
    if (clearAnim > 0) {
      clearAnim = Math.max(0, clearAnim - dt);
      if (clearAnim === 0) {
        if (pendingBoard) {
          board = pendingBoard;
          pendingBoard = null;
        }
        clearRows = [];
        if (incoming > 0) {
          board = addGarbage(board, incoming, Math.floor(rand() * COLS) % COLS);
          incoming = 0;
        }
        afterPlace();
      }
      return;
    }
    if (opts.tier) {
      aiTurn();
      return;
    }
    const ms = gravity(levelOf(lines, opts.startLevel));
    fallAcc += dt * 1000;
    while (fallAcc >= ms) {
      fallAcc -= ms;
      if (!hits(cells(), px, py + 1)) {
        py += 1;
        lastMoveWasRotate = false;
      }
    }
    const st = lockStep(lock, dt * 1000, grounded());
    lock = { timer: st.timer, resets: st.resets };
    if (st.locked) place();
  }

  function drawCell(g: CanvasRenderingContext2D, x: number, y: number, color: string, alpha = 1, mark = ""): void {
    const vy = y - (ROWS - VISIBLE_ROWS);
    if (vy < 0 || vy >= VISIBLE_ROWS) return;
    const gx = x * cell;
    const gy = vy * cell;
    g.globalAlpha = alpha;
    g.fillStyle = color;
    const r = Math.max(3, cell * 0.22);
    g.beginPath();
    g.roundRect(gx + 1, gy + 1, cell - 2, cell - 2, r);
    g.fill();
    g.strokeStyle = "#ffffffaa";
    g.lineWidth = 1.5;
    g.stroke();
    if (mark && cell >= 24) {
      g.fillStyle = "#00000055";
      g.font = `700 ${Math.round(cell * 0.42)}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(mark, gx + cell / 2, gy + cell / 2);
    }
    g.globalAlpha = 1;
  }

  function draw(): void {
    const g = canvas.getContext("2d");
    if (!g) return;
    const sink = slam > 0 ? Math.round((slam / SLAM_ANIM_SEC) * 3) : 0;
    g.setTransform(1, 0, 0, 1, 0, sink);
    g.clearRect(0, -sink, canvas.width, canvas.height + sink);
    g.fillStyle = "#F4F7FF";
    g.fillRect(0, -sink, canvas.width, canvas.height + sink);

    g.strokeStyle = "#E2E9F7";
    g.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      g.beginPath();
      g.moveTo(c * cell, 0);
      g.lineTo(c * cell, canvas.height);
      g.stroke();
    }
    for (let r = 1; r < VISIBLE_ROWS; r++) {
      g.beginPath();
      g.moveTo(0, r * cell);
      g.lineTo(canvas.width, r * cell);
      g.stroke();
    }

    for (let r = 0; r < board.length; r++) {
      const flashing = clearRows.includes(r);
      for (let c = 0; c < COLS; c++) {
        const v = board[r][c];
        if (v === 0) continue;
        if (flashing) {
          const t = clearAnim / Math.max(0.001, CLEAR_ANIM_SEC);
          drawCell(g, c, r, soft ? "#FFF0C2" : "#FFFFFF", 0.35 + 0.65 * t, "");
        } else {
          drawCell(g, c, r, INDEX_COLOR[v] ?? "#C9CEDB", 1, INDEX_MARK[v] ?? "");
        }
      }
    }

    if (!over && clearAnim === 0) {
      if (ghostOn) {
        const gy = dropPosition(board, cells(), px, py);
        for (const c of cells()) drawCell(g, c.x + px, c.y + gy, PIECE_COLORS[cur], 0.28, "");
      }
      for (const c of cells()) drawCell(g, c.x + px, c.y + py, PIECE_COLORS[cur], 1, PIECE_MARKS[cur]);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);

    holdBox.textContent = `暂存 ${held ?? "—"}`;
    nextBox.textContent = `下一个 ${queue.peek(5).join(" ")}`;
    statBox.textContent = `${lines} 行 · ${score} 分${incoming > 0 ? ` · 待落 ${incoming}` : ""}`;
  }

  return {
    destroy() {
      over = true;
      seat.remove();
    },
    step,
    draw,
    receive(n: number) {
      incoming += Math.max(0, Math.round(n));
    },
    state: () => state(false),
    move,
    rotate,
    softDrop,
    hardDrop,
    doHold,
    toggleGhost: () => {
      ghostOn = !ghostOn;
    },
    isOver: () => over
  };
}

interface TableOpts {
  seats: SeatOpts[];
  banner?: string;
  goalText: string;
  split?: boolean;
  onOver: (results: SeatResult[]) => void;
}

/**
 * 一张桌子:一到两块人类场地 + 可选的一块 AI 场地,共用一个 rAF 与一套键盘。
 */
function createTable(stage: HTMLElement, opts: TableOpts): { destroy: () => void } {
  let destroyed = false;
  let raf = 0;
  let last = 0;
  let paused = false;
  let done = false;
  const results: (SeatResult | null)[] = opts.seats.map(() => null);
  /** destroy 的时候要一并撤掉的定时器与监听 */
  const timers: number[] = [];
  const offs: (() => void)[] = [];

  const wrap = document.createElement("div");
  wrap.className = "bd-wrap";
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="bd-top">
      <span class="bd-badge bd-goal">${opts.goalText}</span>
      ${opts.banner ? `<span class="bd-badge">${opts.banner}</span>` : ""}
    </div>
    <div class="bd-seats"></div>
    <div class="bd-pad"></div>
    <div class="bd-msg"></div>
  `;
  stage.appendChild(wrap);
  const seatsHost = wrap.querySelector(".bd-seats") as HTMLElement;
  const padEl = wrap.querySelector(".bd-pad") as HTMLElement;
  const msgEl = wrap.querySelector(".bd-msg") as HTMLElement;
  if (opts.split) seatsHost.classList.add("bd-split");
  msgEl.textContent = "先看影子确认落点,再按下落。凑满一整行就会开花。";

  const seats: Seat[] = [];
  opts.seats.forEach((so, i) => {
    const seat = createSeat(seatsHost, {
      ...so,
      onSend: (n) => {
        for (let k = 0; k < seats.length; k++) if (k !== i) seats[k]?.receive(n);
        so.onSend(n);
      },
      onDone: (r) => {
        results[i] = r;
        so.onDone(r);
        if (!done && results.every((x) => x !== null)) {
          done = true;
          timers.push(
            window.setTimeout(() => {
              if (!destroyed) opts.onOver(results.map((x) => x as SeatResult));
            }, 260)
          );
        } else if (!done && so.human) {
          // 人类结束了就直接结算,不用等 AI 慢慢摆完
          done = true;
          timers.push(
            window.setTimeout(() => {
              if (!destroyed) opts.onOver(results.map((x, k) => x ?? seats[k].state()));
            }, 260)
          );
        }
      }
    });
    seats.push(seat);
  });

  const humanSeats = opts.seats.map((s, i) => ({ s, i })).filter((e) => e.s.human);

  // 手机等价操作:每个人一排大钮,热区都 ≥ 44px
  for (const { s, i } of humanSeats) {
    const row = document.createElement("div");
    row.style.display = "contents";
    const mk = (label: string, fn: () => void): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `bd-btn${s.human === "star" ? " bd-star" : ""}`;
      b.textContent = label;
      b.addEventListener("click", () => {
        if (!paused) fn();
      });
      return b;
    };
    padEl.append(
      row,
      mk("◀", () => seats[i].move(-1)),
      mk("▶", () => seats[i].move(1)),
      mk("↻", () => seats[i].rotate(1)),
      mk("↺", () => seats[i].rotate(-1)),
      mk("▼", () => seats[i].softDrop()),
      mk("⤓", () => seats[i].hardDrop()),
      mk("📦", () => seats[i].doHold())
    );
  }

  // 触屏手势:左右滑动挪、下滑软降、上滑硬降、点一下转
  humanSeats.forEach(({ i }) => {
    const canvas = seatsHost.querySelectorAll("canvas")[i] as HTMLCanvasElement | undefined;
    if (!canvas) return;
    let sx = 0;
    let sy = 0;
    let moved = false;
    let acc = 0;
    const onDown = (e: PointerEvent): void => {
      sx = e.clientX;
      sy = e.clientY;
      moved = false;
      acc = 0;
      e.preventDefault();
    };
    const onMove = (e: PointerEvent): void => {
      if (e.buttons === 0 && e.pointerType !== "touch") return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const stepPx = 26;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > stepPx) {
        const n = Math.trunc(dx / stepPx) - acc;
        for (let k = 0; k < Math.abs(n); k++) seats[i].move(Math.sign(n));
        acc += n;
        moved = true;
      } else if (dy > stepPx * 1.6) {
        seats[i].softDrop();
        sy = e.clientY;
        moved = true;
      }
      e.preventDefault();
    };
    const onUp = (e: PointerEvent): void => {
      const dy = e.clientY - sy;
      if (!moved && Math.abs(dy) < 12) seats[i].rotate(1);
      else if (dy < -50) seats[i].hardDrop();
    };
    const onCancel = (): void => {
      moved = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    offs.push(() => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
    });
  });

  const duo = humanSeats.find((e) => e.s.human === "duo");
  const star = humanSeats.find((e) => e.s.human === "star");

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      paused = !paused;
      msgEl.textContent = paused ? "⏸️ 暂停中,再按 Esc 继续。" : "继续!";
      // 这一下归自己了:不拦住,游戏壳还会再弹一次统一暂停面板,
      // 之后的 Esc 只关面板,场上却一直停着
      e.preventDefault();
      return;
    }
    if (paused) return;
    if (e.repeat && !acceptsRepeat(e.key)) {
      e.preventDefault();
      return;
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (duo) {
      const s = seats[duo.i];
      if (k === "a") {
        s.move(-1);
        e.preventDefault();
      } else if (k === "d") {
        s.move(1);
        e.preventDefault();
      } else if (k === "s") {
        s.softDrop();
        e.preventDefault();
      } else if (k === "w") {
        s.hardDrop();
        e.preventDefault();
      } else if (k === "f") {
        s.rotate(1);
      } else if (k === "g") {
        s.rotate(-1);
      } else if (e.key === "Shift") {
        s.doHold();
      }
    }
    const arrowSeat = star ?? duo;
    if (arrowSeat) {
      const s = seats[arrowSeat.i];
      if (e.key === "ArrowLeft") {
        s.move(-1);
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        s.move(1);
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        s.softDrop();
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        s.hardDrop();
        e.preventDefault();
      }
    }
    if (star) {
      const s = seats[star.i];
      if (k === "l") s.rotate(1);
      if (k === "k") s.rotate(-1);
      if (k === "enter") s.doHold();
    }
  };
  window.addEventListener("keydown", onKeyDown);

  function frame(ts: number): void {
    if (destroyed) return;
    const dt = last === 0 ? 1 / 60 : Math.min(0.05, (ts - last) / 1000);
    last = ts;
    if (!paused) for (const s of seats) s.step(dt);
    for (const s of seats) s.draw();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("keydown", onKeyDown);
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      for (const off of offs) off();
      offs.length = 0;
      for (const s of seats) s.destroy();
      wrap.remove();
    }
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg = levelConfig(ctx.level);
  let settled = false;
  const table = createTable(stage, {
    goalText: goalLine(cfg),
    seats: [
      {
        name: "朵朵",
        human: "duo",
        seed: cfg.seed,
        bag: cfg.bag,
        startLevel: cfg.startLevel,
        start: startBoard(ctx.level),
        pieceBudget: cfg.pieceBudget,
        targetLines: cfg.targetLines,
        cellPx: 24,
        sfx: ctx.sfx,
        onSend: () => undefined,
        onDone: () => undefined
      }
    ],
    onOver: (rs) => {
      if (settled) return;
      settled = true;
      const r = rs[0];
      const skillDone =
        cfg.skill === "hold"
          ? r.usedHold
          : cfg.skill === "kick"
            ? r.usedKick
            : cfg.skill === "quad"
              ? r.quads > 0
              : cfg.skill === "tspin"
                ? r.tspins > 0
                : cfg.skill === "combo"
                  ? r.bestCombo >= cfg.comboTarget
                  : false;
      if (levelWon(cfg, r)) {
        ctx.win(
          starsFor(cfg, { lines: r.lines, used: r.used, skillDone, bestCombo: r.bestCombo }),
          `消了 ${r.lines} 行,用了 ${r.used} 块,拿了 ${r.score} 分！`
        );
      } else {
        ctx.lose(overLine(r.lines, r.score));
      }
    }
  });
  return { destroy: () => table.destroy() };
}

// ---------------------------------------------------------------------------
// 无尽 / 对战 / 双人同屏
// ---------------------------------------------------------------------------

type ExtraMode = "versus" | "endless" | "duo";

const MODE_TITLE: Record<ExtraMode, string> = {
  versus: "🤝 对战发行",
  endless: "♾️ 马拉松 / 竞速",
  duo: "👫 双人同屏"
};

function mountExtra(host: HTMLElement, api: GameApi, mode: ExtraMode, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "bd-mode";
  wrap.innerHTML = `<style>${CSS}</style>`;
  const head = document.createElement("div");
  head.className = "bd-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "bd-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "bd-badge";
  chip.textContent = MODE_TITLE[mode];
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(head, stage);
  host.appendChild(wrap);

  let table: { destroy: () => void } | null = null;
  let kind: EndlessKind = "marathon";
  let tier: AiTier = "normal";
  let best = save.getGameProgress(meta.id).endlessBest;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function showOver(title: string, sub: string, again: string): void {
    table?.destroy();
    table = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "bd-over";
    box.innerHTML = `<div class="bd-over-t">${title}</div><div class="bd-over-s">${sub}</div>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bd-open";
    btn.textContent = again;
    btn.addEventListener("click", () => {
      api.play("tap");
      start();
    });
    box.appendChild(btn);
    stage.appendChild(box);
  }

  function picker(labels: string[], onPick: (i: number) => void): HTMLElement {
    const row = document.createElement("div");
    row.className = "bd-modebar";
    labels.forEach((label, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bd-open";
      b.textContent = label;
      b.addEventListener("click", () => {
        api.play("tap");
        onPick(i);
      });
      row.appendChild(b);
    });
    return row;
  }

  function start(): void {
    table?.destroy();
    table = null;
    stage.innerHTML = "";
    const seed = Math.floor(Math.random() * 1e9);

    if (mode === "endless") {
      stage.appendChild(
        picker(["🏃 马拉松", "⏱️ 40 行竞速"], (i) => {
          kind = i === 0 ? "marathon" : "sprint";
          runEndless(seed);
        })
      );
      const tip = document.createElement("div");
      tip.className = "bd-msg";
      tip.textContent = `马拉松记最高分,竞速比 40 行用多久。目前最好成绩 ${best}。`;
      stage.appendChild(tip);
      return;
    }
    if (mode === "versus") {
      stage.appendChild(
        picker(["🐣 菜鸟", "🙂 普通", "😎 高手", "🔥 地狱"], (i) => {
          tier = (["rookie", "normal", "pro", "hell"] as AiTier[])[i];
          runVersus(seed);
        })
      );
      const tip = document.createElement("div");
      tip.className = "bd-msg";
      tip.textContent = "消行会给对手升起垃圾行;自己也消行就能先把待落的垃圾顶掉。";
      stage.appendChild(tip);
      return;
    }
    runDuo(seed);
  }

  function runEndless(seed: number): void {
    stage.innerHTML = "";
    const cfg = endlessConfig(kind);
    chip.textContent = kind === "marathon" ? `🏃 马拉松 · 最好 ${best}` : "⏱️ 40 行竞速";
    table = createTable(stage, {
      goalText: kind === "sprint" ? "消满 40 行,比用时" : "一直叠下去,等级越来越快",
      banner: kind === "marathon" ? `最好成绩 ${best}` : undefined,
      seats: [
        {
          name: "朵朵",
          human: "duo",
          seed,
          bag: cfg.bag,
          startLevel: cfg.startLevel,
          start: createBoard(),
          pieceBudget: 0,
          targetLines: cfg.targetLines,
          cellPx: 26,
          sfx: (n) => api.play(n),
          onSend: () => undefined,
          onDone: () => undefined
        }
      ],
      onOver: (rs) => {
        const r = rs[0];
        const value = kind === "marathon" ? r.score : Math.max(0, 600 - Math.round(r.sec));
        best = save.recordEndlessBest(meta.id, value);
        if (kind === "sprint" && !r.toppedOut && r.lines >= 40) api.addStars(2);
        showOver(
          r.toppedOut ? "叠得好高呀" : "这一局完成啦",
          kind === "sprint"
            ? `40 行用了 ${Math.round(r.sec)} 秒,消了 ${r.lines} 行。`
            : `${overLine(r.lines, r.score)} 最好成绩 ${best}。`,
          "🔁 再来一局"
        );
      }
    });
  }

  function runVersus(seed: number): void {
    stage.innerHTML = "";
    const cfg = versusConfig(tier);
    chip.textContent = `🤝 对手:${AI_TIER_LABELS[tier]}`;
    table = createTable(stage, {
      goalText: "谁先叠到顶,这一局就先歇一歇",
      banner: AI_TIER_LABELS[tier],
      split: true,
      seats: [
        {
          name: "朵朵",
          human: "duo",
          seed,
          bag: [...PIECE_IDS],
          startLevel: cfg.startLevel,
          start: createBoard(),
          pieceBudget: 0,
          targetLines: 0,
          cellPx: 24,
          sfx: (n) => api.play(n),
          onSend: () => undefined,
          onDone: () => undefined
        },
        {
          name: AI_TIER_LABELS[tier],
          tier: cfg.tier,
          seed: seed + 1,
          bag: [...PIECE_IDS],
          startLevel: cfg.startLevel,
          start: createBoard(),
          pieceBudget: 0,
          targetLines: 0,
          cellPx: 20,
          sfx: () => undefined,
          onSend: () => undefined,
          onDone: () => undefined
        }
      ],
      onOver: (rs) => {
        const me = rs[0];
        const foe = rs[1];
        const won = !me.toppedOut && foe.toppedOut;
        if (won) api.addStars(2);
        showOver(
          won ? "这一局赢下来啦！" : "这一局到此为止",
          `你消了 ${me.lines} 行、拿了 ${me.score} 分,对手消了 ${foe.lines} 行。`,
          "🔁 再打一场"
        );
      }
    });
  }

  function runDuo(seed: number): void {
    stage.innerHTML = "";
    chip.textContent = "👫 朵朵 WASD+F/G · 星星 方向键+L/K";
    table = createTable(stage, {
      goalText: "两个人一起叠,互相发垃圾行",
      split: true,
      seats: [
        {
          name: "朵朵",
          human: "duo",
          seed,
          bag: [...PIECE_IDS],
          startLevel: 0,
          start: createBoard(),
          pieceBudget: 0,
          targetLines: 0,
          cellPx: 22,
          sfx: (n) => api.play(n),
          onSend: () => undefined,
          onDone: () => undefined
        },
        {
          name: "星星",
          human: "star",
          seed: seed + 1,
          bag: [...PIECE_IDS],
          startLevel: 0,
          start: createBoard(),
          pieceBudget: 0,
          targetLines: 0,
          cellPx: 22,
          sfx: (n) => api.play(n),
          onSend: () => undefined,
          onDone: () => undefined
        }
      ],
      onOver: (rs) => {
        showOver(
          "这一局结束啦",
          `朵朵消了 ${rs[0].lines} 行,星星消了 ${rs[1].lines} 行。再来一局吧！`,
          "🔁 再来一局"
        );
      }
    });
  }

  start();

  return {
    destroy() {
      table?.destroy();
      table = null;
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 模式入口条:按 meta.modes 推,不硬写
// ---------------------------------------------------------------------------

/** 这一款按 `meta.modes` 算出来的模式口径(首页玩法芯片读的是同一份 meta) */
export const MODE_COMPAT = compatFromMeta(meta);

/** 本款自己的入口名 ↔ 三大类的对应关系;顺序就是入口条从左到右的顺序 */
const MODE_ENTRIES: ModeEntry<ExtraMode>[] = [
  { key: "versus", kind: "versus", versusKind: "ai" },
  { key: "endless", kind: "endless" },
  { key: "duo", kind: "versus", versusKind: "hotseat" }
];

/**
 * 真正摆出来的入口。
 * 以前这里是硬写的 `["versus","endless","duo"]`,`meta.modes` 一改就与首页芯片各说各话;
 * 现在少写一个模式,入口条自己就少一个按钮。
 */
export const MODE_KEYS: ExtraMode[] = modeEntryKeys(MODE_COMPAT, MODE_ENTRIES);

/** 模式菜单顶上那句话,措辞走 `describeModes` 的共享口径,十二款不各写各的 */
export const MODE_SUMMARY = describeModes(MODE_COMPAT);

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS;
  const bar = document.createElement("div");
  bar.className = "bd-modebar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", MODE_SUMMARY);
  const modeTip = document.createElement("p");
  modeTip.className = "bd-modetip";
  modeTip.textContent = MODE_SUMMARY;
  bar.appendChild(modeTip);
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let mode: { destroy: () => void } | null = null;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
  }

  MODE_KEYS.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bd-open";
    btn.textContent = MODE_TITLE[m];
    btn.addEventListener("click", () => {
      if (mode) return;
      api.play("tap");
      levelHost.hidden = true;
      bar.hidden = true;
      modeHost.hidden = false;
      mode = mountExtra(modeHost, api, m, closeMode);
    });
    bar.appendChild(btn);
  });

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      playLevel,
      mapHint: "先看半透明的影子确认落点,再让方块掉下去。",
      grandMessage: "188 关全部拿下,叠叠杯冠军就是你！",
      guideTitle: "方块叠叠乐 · 摆砖笔记"
    }
  );

  return {
    destroy() {
      mode?.destroy();
      mode = null;
      level.destroy();
      root.remove();
    }
  };
}

/** 给测试钉住的关键常量 */
export const DROP_CONSTS = { LOCK_DELAY, CLEAR_ANIM_SEC, COLS, VISIBLE_ROWS, GARBAGE_CELL };
