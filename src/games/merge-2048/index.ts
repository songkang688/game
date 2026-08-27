import { meta } from "./meta";
export { meta };

// 星星合成:同样的数字撞在一起就会变成更大的星星。
// 188 关战役 + 同一发牌序列的对战竞速 + 马拉松无尽 + 左右两块盘的同屏双人,对手是本机假人,全程离线。
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import { save } from "../../engine/save";
import { prefersReducedMotion } from "../../engine/view25d";
import {
  DIRS,
  EMPTY,
  BLOCK,
  cloneBoard,
  createBoard,
  legalDirs,
  maxTile,
  move,
  rng,
  spawn,
  type Board,
  type Dir,
  type MoveResult
} from "./board";
import { AI_TIER_BLURBS, AI_TIER_LABELS, AI_TIERS, chooseMove, type AiTier } from "./ai";
import {
  CHAPTERS,
  endlessConfig,
  goalLine,
  levelConfig,
  levelWon,
  overLine,
  starsFor,
  startBoard,
  stepBudget,
  versusConfig,
  VERSUS_TARGETS,
  type EndlessKind,
  type MergeResult
} from "./levels";
import guide from "./guide";

/** 一块方块滑到位要多久(毫秒)。规格要求 80–140ms,不许瞬变 */
export const MOVE_MS = 110;
/** 合并时那一下短促放大 */
export const MERGE_MS = 120;
/** 新块冒出来的淡入 */
export const BORN_MS = 100;
/** 手指要划过这么多像素才算一次滑屏,免得点一下就被当成滑动 */
export const SWIPE_MIN = 26;
/** 假人两步之间歇多久,别快得看不清 */
export const AI_BEAT_MS = 420;

const PALETTE: Record<number, [string, string]> = {
  2: ["#FFF6DA", "#8A7A45"],
  4: ["#FFEFC6", "#8A7233"],
  8: ["#FFE0BE", "#8C5F2E"],
  16: ["#FFD2C4", "#8E4C3B"],
  32: ["#FFC4CE", "#8C3B52"],
  64: ["#F7C0E4", "#7E3670"],
  128: ["#DFC2F5", "#5B3A85"],
  256: ["#C6CCF7", "#3B4790"],
  512: ["#BEE0F7", "#2F5C86"],
  1024: ["#BCEFE2", "#256B58"],
  2048: ["#CDEFBF", "#3B6E2A"],
  4096: ["#FBE8A6", "#8A6A16"],
  8192: ["#FFD9A8", "#8A5514"]
};

/** 每一格的底色与字色:超过表格的更大数字沿用最后一档 */
export function tileColors(value: number): [string, string] {
  return PALETTE[value] ?? PALETTE[8192];
}

/** 数字有几位就用多大的字;窄屏也保证不小于 16px */
export function tileFontPx(value: number, cell: number): number {
  const digits = String(value).length;
  const scale = digits <= 2 ? 0.42 : digits === 3 ? 0.34 : digits === 4 ? 0.27 : 0.22;
  return Math.max(16, Math.round(cell * scale));
}

/**
 * 除了颜色再给一层「圈的粗细」:色觉不一样的小朋友光看颜色分不清,
 * 数字越大圈越粗,一眼能看出层级。
 */
export function tileRingPx(value: number): number {
  return Math.min(7, Math.max(2, Math.round(Math.log2(Math.max(2, value)))) - 1);
}

export const MG_CSS = `
.mg-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#FFFBEC,#FFF6FA);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;}
.mg-top{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:8px;}
.mg-badge{background:#fff;border-radius:14px;padding:5px 10px;font-weight:800;font-size:16px;color:#7a5f2e;
  box-shadow:0 2px 6px rgba(190,165,110,.28);overflow-wrap:anywhere;min-width:0;}
.mg-seats{display:flex;flex-direction:column;gap:12px;align-items:center;}
.mg-seat{display:flex;flex-direction:column;gap:6px;align-items:center;max-width:100%;min-width:0;}
.mg-name{font-size:14px;font-weight:900;color:#7a5f2e;overflow-wrap:anywhere;}
.mg-board{position:relative;border-radius:14px;background:#F3E7CD;touch-action:none;flex:0 0 auto;}
.mg-hole{position:absolute;border-radius:10px;background:#FBF3E2;}
.mg-hole.mg-block{background:#F0B9C8;box-shadow:inset 0 0 0 3px #E08FA6;}
.mg-flower{position:absolute;display:flex;align-items:center;justify-content:center;font-size:18px;pointer-events:none;}
.mg-tile{position:absolute;border-radius:10px;display:flex;align-items:center;justify-content:center;
  font-weight:900;line-height:1;transition:transform ${MOVE_MS}ms ease-out;will-change:transform;}
.mg-tile.mg-pop{animation:mgpop ${MERGE_MS}ms ease-out;}
.mg-tile.mg-born{animation:mgborn ${BORN_MS}ms ease-out;}
@keyframes mgpop{0%{transform:var(--mg-at) scale(1)}45%{transform:var(--mg-at) scale(1.18)}100%{transform:var(--mg-at) scale(1)}}
@keyframes mgborn{from{opacity:.2}to{opacity:1}}
.mg-pad{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:8px;}
.mg-btn{min-width:56px;min-height:46px;border:none;border-radius:14px;font-family:inherit;font-size:18px;
  font-weight:900;cursor:pointer;background:#FBE3B4;color:#7a5518;box-shadow:0 3px 0 #E3C280;padding:0 10px;}
.mg-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #E3C280;}
.mg-btn.mg-star{background:#E4DDFB;color:#4c3f85;box-shadow:0 3px 0 #C2B7EC;}
.mg-btn:focus-visible,.mg-open:focus-visible,.mg-back:focus-visible{outline:3px solid #4a3a10;outline-offset:3px;}
.mg-msg{text-align:center;min-height:20px;color:#7a5f2e;font-weight:800;margin-top:6px;font-size:16px;
  overflow-wrap:anywhere;line-height:1.5;}
/* 只给读屏听的一行:看不见、不占位,但 aria-live 会把盘面的变化念出来 */
.mg-say{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;
  clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;}
.mg-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
.mg-open{border:none;border-radius:999px;padding:9px 18px;font-size:15px;min-height:44px;font-weight:900;color:#fff;
  cursor:pointer;font-family:inherit;background:linear-gradient(180deg,#E8A93C,#CE8C22);box-shadow:0 4px 0 #A96F17;}
.mg-open:active{transform:translateY(2px);box-shadow:0 2px 0 #A96F17;}
.mg-mode{max-width:820px;margin:0 auto;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;}
.mg-mhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px;}
.mg-back{border:none;border-radius:999px;padding:7px 13px;font-size:14px;min-height:44px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#ffffffd9;color:#a9762a;box-shadow:0 3px 0 rgba(180,140,70,.32);}
.mg-over{text-align:center;padding:24px 16px;background:#fff;border-radius:18px;box-shadow:0 4px 14px rgba(190,165,110,.3);}
.mg-over-t{font-size:21px;font-weight:900;color:#7a5f2e;margin-bottom:8px;}
.mg-over-s{font-size:16px;font-weight:700;color:#8a6f3e;line-height:1.6;margin-bottom:14px;overflow-wrap:anywhere;}
@media (min-width:720px){
  .mg-seats.mg-split{flex-direction:row;align-items:flex-start;justify-content:center;}
}
@media (max-width:360px){
  .mg-wrap{padding:6px;}
  .mg-badge{padding:4px 8px;}
  .mg-btn{min-width:48px;padding:0 6px;}
}
@media (prefers-reduced-motion:reduce){
  .mg-tile{transition:none;}
  .mg-tile.mg-pop{animation:none;}
  .mg-tile.mg-born{animation:none;}
}
`;

/** 键盘按下的这个键对应哪个方向;`who` 决定认哪一套键位 */
export function keyToDir(key: string, who: "duo" | "star"): Dir | null {
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (who === "duo") {
    if (k === "a") return "left";
    if (k === "d") return "right";
    if (k === "w") return "up";
    if (k === "s") return "down";
    return null;
  }
  if (k === "ArrowLeft") return "left";
  if (k === "ArrowRight") return "right";
  if (k === "ArrowUp") return "up";
  if (k === "ArrowDown") return "down";
  return null;
}

/** 手指从 (0,0) 划到 (dx,dy) 算哪个方向;划得不够远就不算 */
export function swipeToDir(dx: number, dy: number, min: number = SWIPE_MIN): Dir | null {
  if (Math.abs(dx) < min && Math.abs(dy) < min) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** 一块盘的实时状态 */
export interface SeatState {
  score: number;
  steps: number;
  best: number;
  reached: boolean;
  stuck: boolean;
  outOfSteps: boolean;
}

/** 这一步是不是已经把这一盘走完了(走完就不用再报「第几步」,直接报结论) */
export function seatEnded(st: SeatState): boolean {
  return st.reached || st.stuck || st.outOfSteps;
}

/**
 * 走完一步之后要念给读屏听的一句话。
 * 盘面本身只有一句静态的 `aria-label`,看不见的人光靠它不知道刚才那一步合出了什么,
 * 所以每一步都补一句短的:合出更大的数字时说「合出」,否则只报当前最大。
 * `withName` 在双人同屏时打开,免得两块盘的播报分不清是谁。
 */
export function moveAnnounce(name: string, st: SeatState, prevBest: number, withName = false): string {
  const who = withName ? `${name}:` : "";
  const grew = st.best > prevBest;
  return `${who}第 ${st.steps} 步,${grew ? `合出 ${st.best}` : `最大 ${st.best}`},${st.score} 分`;
}

/** 一盘结束时念的那一句:为什么结束、结果如何,都要说清楚 */
export function overAnnounce(name: string, st: SeatState, withName = false): string {
  const who = withName ? `${name}:` : "";
  if (st.reached) return `${who}合到 ${st.best},目标达成,用了 ${st.steps} 步。`;
  if (st.outOfSteps) return `${who}步数用完了,最大合到 ${st.best}。`;
  if (st.stuck) return `${who}挪不动了,最大合到 ${st.best},走了 ${st.steps} 步。`;
  return `${who}这一盘结束,最大合到 ${st.best}。`;
}

/** 两句播报之间至少隔这么久;隔得更近的连续步子只留最后一句 */
export const SAY_THROTTLE_MS = 900;

export interface SayThrottleHooks {
  write: (text: string) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}

export interface SayThrottle {
  /** 走一步的播报:窗口内攒着,只把最后一句写出去 */
  polite: (text: string) => void;
  /** 结论播报:立刻写,攒着的那句直接丢掉 */
  urgent: (text: string) => void;
  /** 卸载时调用:攒着的那句不再写 */
  cancel: () => void;
}

/**
 * 读屏播报的节流闸。
 *
 * `aria-live="polite"` 只保证不打断当前朗读,不会替你合并 —— 快速连滑时
 * 每一步都写一句,读屏会排成一长串,等它念完玩家早就滑到别处去了。
 * 这里按「首句立刻、窗口内攒最后一句」处理:慢慢走的玩家一句不少,
 * 连着乱滑的只听到最新的盘面。结论(达成 / 卡死 / 步数用完)走 `urgent` 插队,
 * 免得攒着的「第几步」把结论盖过去。
 */
export function createSayThrottle(hooks: SayThrottleHooks, gap = SAY_THROTTLE_MS): SayThrottle {
  const now = hooks.now ?? ((): number => Date.now());
  const setTimer = hooks.setTimer ?? ((fn: () => void, ms: number): number => setTimeout(fn, ms) as unknown as number);
  const clearTimer = hooks.clearTimer ?? ((id: number): void => clearTimeout(id));
  let lastAt = Number.NEGATIVE_INFINITY;
  let pending: string | null = null;
  let timer: number | null = null;

  function flush(): void {
    timer = null;
    if (pending === null) return;
    const text = pending;
    pending = null;
    lastAt = now();
    hooks.write(text);
  }

  function cancel(): void {
    if (timer !== null) clearTimer(timer);
    timer = null;
    pending = null;
  }

  return {
    polite(text: string): void {
      const at = now();
      if (timer === null && at - lastAt >= gap) {
        lastAt = at;
        hooks.write(text);
        return;
      }
      pending = text;
      if (timer === null) timer = setTimer(flush, Math.max(0, gap - (at - lastAt)));
    },
    urgent(text: string): void {
      cancel();
      lastAt = now();
      hooks.write(text);
    },
    cancel
  };
}

export interface SeatOpts {
  name: string;
  /** 人类玩家的键位;不给就是本机假人 */
  human?: "duo" | "star";
  tier?: AiTier;
  start: Board;
  seed: number;
  /** 合到这个数字就算达成;0 表示没有目标 */
  target: number;
  /** 步数上限;0 表示不限 */
  stepLimit: number;
  cell: number;
  sfx: (n: SoundName) => void;
  /** 这一盘结束(达成 / 推不动 / 步数用完) */
  onDone: (s: SeatState) => void;
  /** 每走一步都会叫一次,用来刷新 HUD */
  onTick?: (s: SeatState) => void;
}

interface TileView {
  el: HTMLElement;
  row: number;
  col: number;
  value: number;
}

interface PendingMove {
  res: MoveResult;
  /** 还要滑多久(秒) */
  wait: number;
  /** 合到同一格的两块:动画放完后 drop 撤掉、keep 换成新数字 */
  merges: Array<{ keep: TileView; drop: TileView; value: number }>;
  /** 这一步之后还留在盘上的那些块 */
  survivors: TileView[];
}

const GAP = 6;

interface Seat {
  el: HTMLElement;
  board: () => Board;
  state: () => SeatState;
  input: (dir: Dir) => boolean;
  step: (dt: number) => void;
  isOver: () => boolean;
  destroy: () => void;
}

function createSeat(host: HTMLElement, opts: SeatOpts): Seat {
  const soft = prefersReducedMotion();
  const rand = rng(opts.seed);
  const size = opts.start.length;
  const cell = Math.max(34, Math.round(opts.cell));
  const span = size * cell + (size + 1) * GAP;

  let board = cloneBoard(opts.start);
  let score = 0;
  let steps = 0;
  let over = false;
  let reached = false;
  let stuck = false;
  let outOfSteps = false;
  /** 正在滑行的这一步:等 wait 归零再落地 */
  let pending: PendingMove | null = null;
  let queued: Dir | null = null;
  let aiWait = AI_BEAT_MS / 1000;

  const seat = document.createElement("div");
  seat.className = "mg-seat";
  const name = document.createElement("div");
  name.className = "mg-name";
  name.textContent = opts.name;
  const view = document.createElement("div");
  view.className = "mg-board";
  view.style.width = `${span}px`;
  view.style.height = `${span}px`;
  view.setAttribute("role", "img");
  view.setAttribute("aria-label", `${opts.name} 的 ${size} 乘 ${size} 盘面`);
  seat.append(name, view);
  host.appendChild(seat);

  function at(r: number, c: number): [number, number] {
    return [GAP + c * (cell + GAP), GAP + r * (cell + GAP)];
  }

  // 底板:空格与障碍花都是固定的,画一次就好
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const hole = document.createElement("div");
      const blocked = board[r][c] === BLOCK;
      hole.className = `mg-hole${blocked ? " mg-block" : ""}`;
      const [x, y] = at(r, c);
      hole.style.left = `${x}px`;
      hole.style.top = `${y}px`;
      hole.style.width = `${cell}px`;
      hole.style.height = `${cell}px`;
      view.appendChild(hole);
      if (blocked) {
        const flower = document.createElement("div");
        flower.className = "mg-flower";
        flower.textContent = "🌺";
        flower.style.left = `${x}px`;
        flower.style.top = `${y}px`;
        flower.style.width = `${cell}px`;
        flower.style.height = `${cell}px`;
        view.appendChild(flower);
      }
    }
  }

  let views: TileView[] = [];

  function place(v: TileView, pop = false, born = false): void {
    const [x, y] = at(v.row, v.col);
    const t = `translate(${x}px, ${y}px)`;
    v.el.style.setProperty("--mg-at", t);
    v.el.style.transform = t;
    const [bg, fg] = tileColors(v.value);
    v.el.style.background = bg;
    v.el.style.color = fg;
    v.el.style.boxShadow = `inset 0 0 0 ${tileRingPx(v.value)}px #ffffffcc`;
    v.el.style.fontSize = `${tileFontPx(v.value, cell)}px`;
    v.el.textContent = String(v.value);
    v.el.setAttribute("aria-label", String(v.value));
    if (soft) return;
    if (pop) restartAnim(v.el, "mg-pop");
    if (born) restartAnim(v.el, "mg-born");
  }

  function restartAnim(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    // 读一下布局属性强制重排,同一个动画连着放两次才会重新开始
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function makeTile(r: number, c: number, value: number, born: boolean): TileView {
    const el = document.createElement("div");
    el.className = "mg-tile";
    el.style.width = `${cell}px`;
    el.style.height = `${cell}px`;
    view.appendChild(el);
    const v: TileView = { el, row: r, col: c, value };
    place(v, false, born);
    return v;
  }

  function rebuild(born?: { row: number; col: number }): void {
    for (const v of views) v.el.remove();
    views = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const value = board[r][c];
        if (value <= 0) continue;
        views.push(makeTile(r, c, value, Boolean(born && born.row === r && born.col === c)));
      }
    }
  }

  rebuild();

  function snapshot(): SeatState {
    return { score, steps, best: Math.max(0, maxTile(board)), reached, stuck, outOfSteps };
  }

  function finish(): void {
    if (over) return;
    over = true;
    opts.sfx(reached ? "win" : "oops");
    opts.onDone(snapshot());
  }

  /** 滑行动画放完之后:合并的那一对并成一块、生成新块、判断有没有结束 */
  function settle(): void {
    const now = pending;
    pending = null;
    if (!now) return;

    for (const m of now.merges) {
      m.drop.el.remove();
      m.keep.value = m.value;
      place(m.keep, true);
    }
    views = now.survivors;

    const res = now.res;
    board = res.board;
    score += res.score;
    steps += 1;
    if (res.merges > 0) opts.sfx(res.score >= 128 ? "coin" : "pop");

    const born = spawn(board, rand);
    if (born) {
      board = born.board;
      views.push(makeTile(born.row, born.col, born.value, true));
    }

    if (opts.target > 0 && maxTile(board) >= opts.target) reached = true;
    if (opts.stepLimit > 0 && steps >= opts.stepLimit && !reached) outOfSteps = true;
    if (legalDirs(board).length === 0) stuck = true;
    opts.onTick?.(snapshot());
    if (reached || stuck || outOfSteps) {
      finish();
      return;
    }
    if (queued) {
      const next = queued;
      queued = null;
      input(next);
    }
  }

  function input(dir: Dir): boolean {
    if (over) return false;
    if (pending) {
      // 手快的小朋友连按两下,后一下先记着,这一段滑完立刻接上
      queued = dir;
      return false;
    }
    const res = move(board, dir);
    if (!res.moved) return false;

    const taken = new Set<TileView>();
    const landed = new Map<string, TileView>();
    const merges: PendingMove["merges"] = [];
    const survivors: TileView[] = [];
    // 先把每一块挪到新位置,让 CSS 把这一段滑行补出来;
    // 合并的那一对先叠在同一格上,等滑完再并成一块
    for (const p of res.paths) {
      const v = views.find((x) => !taken.has(x) && x.row === p.fromRow && x.col === p.fromCol);
      if (!v) continue;
      taken.add(v);
      v.row = p.toRow;
      v.col = p.toCol;
      place(v);
      if (p.mergedInto <= 0) {
        survivors.push(v);
        continue;
      }
      const key = `${p.toRow},${p.toCol}`;
      const first = landed.get(key);
      if (first) merges.push({ keep: first, drop: v, value: p.mergedInto });
      else {
        landed.set(key, v);
        survivors.push(v);
      }
    }
    for (const v of views) if (!taken.has(v)) v.el.remove();
    views = survivors.concat(merges.map((m) => m.drop));

    pending = { res, wait: (soft ? 20 : MOVE_MS) / 1000, merges, survivors };
    return true;
  }

  function step(dt: number): void {
    if (over) return;
    if (pending) {
      pending.wait -= dt;
      if (pending.wait <= 0) settle();
      return;
    }
    if (!opts.tier) return;
    aiWait -= dt;
    if (aiWait > 0) return;
    aiWait = AI_BEAT_MS / 1000;
    const dir = chooseMove(board, opts.tier, rand);
    if (!dir) {
      stuck = true;
      finish();
      return;
    }
    input(dir);
  }

  return {
    el: seat,
    board: () => cloneBoard(board),
    state: snapshot,
    input,
    step,
    isOver: () => over,
    destroy() {
      over = true;
      for (const v of views) v.el.remove();
      views = [];
      seat.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 一张桌子:一到两块盘 + 一套键盘 + 一套触屏,共用一个 rAF
// ---------------------------------------------------------------------------

export interface TableOpts {
  seats: SeatOpts[];
  goalText: string;
  banner?: string;
  split?: boolean;
  hint?: string;
  onOver: (states: SeatState[]) => void;
}

export function createTable(stage: HTMLElement, opts: TableOpts): { destroy: () => void } {
  let destroyed = false;
  let raf = 0;
  let last = 0;
  let paused = false;
  let done = false;
  const timers: number[] = [];
  const offs: Array<() => void> = [];
  const results: Array<SeatState | null> = opts.seats.map(() => null);

  const wrap = document.createElement("div");
  wrap.className = "mg-wrap";
  const style = document.createElement("style");
  style.textContent = MG_CSS;
  const top = document.createElement("div");
  top.className = "mg-top";
  const goal = document.createElement("span");
  goal.className = "mg-badge";
  goal.textContent = opts.goalText;
  const stat = document.createElement("span");
  stat.className = "mg-badge";
  top.append(goal, stat);
  if (opts.banner) {
    const b = document.createElement("span");
    b.className = "mg-badge";
    b.textContent = opts.banner;
    top.appendChild(b);
  }
  const seatsHost = document.createElement("div");
  seatsHost.className = `mg-seats${opts.split ? " mg-split" : ""}`;
  const pad = document.createElement("div");
  pad.className = "mg-pad";
  const msg = document.createElement("div");
  msg.className = "mg-msg";
  // 暂停 / 继续这类提示写在这里,读屏要能立刻听见
  msg.setAttribute("role", "status");
  msg.setAttribute("aria-live", "polite");
  msg.setAttribute("aria-atomic", "true");
  msg.textContent = opts.hint ?? "同样的数字撞在一起就会变大。方向键或者滑屏都行。";
  // 看不见的一行:每走一步播一句盘面变化,不占版面也不改布局
  const say = document.createElement("div");
  say.className = "mg-say";
  say.setAttribute("role", "status");
  say.setAttribute("aria-live", "polite");
  say.setAttribute("aria-atomic", "true");
  wrap.append(style, top, seatsHost, pad, msg, say);
  stage.appendChild(wrap);

  /** 只播人类那几块盘;假人一步一句会把读屏刷屏 */
  const announceNames = opts.seats.filter((s) => s.human).length > 1;
  const prevBest: number[] = opts.seats.map(() => 0);
  // 一块盘一个闸:同一个人连着滑只听最后一句,两块盘之间互不排队
  const sayers = opts.seats.map(() =>
    createSayThrottle({
      write: (text: string) => {
        if (!destroyed) say.textContent = text;
      },
      setTimer: (fn: () => void, ms: number) => {
        const id = window.setTimeout(fn, ms);
        timers.push(id);
        return id;
      },
      clearTimer: (id: number) => window.clearTimeout(id)
    })
  );

  const seats: Seat[] = [];
  opts.seats.forEach((so, i) => {
    seats.push(
      createSeat(seatsHost, {
        ...so,
        onTick: (s) => {
          so.onTick?.(s);
          if (so.human && !seatEnded(s)) sayers[i].polite(moveAnnounce(so.name, s, prevBest[i], announceNames));
          prevBest[i] = s.best;
          refresh();
        },
        onDone: (s) => {
          results[i] = s;
          if (so.human) sayers[i].urgent(overAnnounce(so.name, s, announceNames));
          so.onDone(s);
          if (done) return;
          // 人这边一结束就结算,不用干等着假人慢慢合
          const humanDone = so.human && results[i];
          if (humanDone || results.every((x) => x !== null)) {
            done = true;
            timers.push(
              window.setTimeout(() => {
                if (!destroyed) opts.onOver(results.map((x, k) => x ?? seats[k].state()));
              }, 280)
            );
          }
        }
      })
    );
  });

  function refresh(): void {
    stat.textContent = seats
      .map((s, i) => {
        const st = s.state();
        return `${opts.seats[i].name} ${st.score} 分 · 最大 ${st.best}`;
      })
      .join(" | ");
  }
  refresh();

  const humans = opts.seats.map((s, i) => ({ s, i })).filter((e) => e.s.human);

  for (const { s, i } of humans) {
    const mk = (label: string, dir: Dir): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `mg-btn${s.human === "star" ? " mg-star" : ""}`;
      b.textContent = label;
      b.setAttribute("aria-label", `${s.name} 往${dir === "left" ? "左" : dir === "right" ? "右" : dir === "up" ? "上" : "下"}滑`);
      b.addEventListener("click", () => {
        if (!paused) seats[i].input(dir);
      });
      return b;
    };
    pad.append(mk("◀", "left"), mk("▲", "up"), mk("▼", "down"), mk("▶", "right"));
  }

  // 触屏四向滑动:阈值写成常量,轻轻一点不会被当成滑动
  humans.forEach(({ i }) => {
    const el = seats[i].el.querySelector(".mg-board");
    if (!(el instanceof HTMLElement)) return;
    let sx = 0;
    let sy = 0;
    let live = false;
    const onDown = (e: PointerEvent): void => {
      sx = e.clientX;
      sy = e.clientY;
      live = true;
      e.preventDefault();
    };
    const onUp = (e: PointerEvent): void => {
      if (!live) return;
      live = false;
      if (paused) return;
      const dir = swipeToDir(e.clientX - sx, e.clientY - sy);
      if (dir) seats[i].input(dir);
    };
    const onCancel = (): void => {
      live = false;
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    offs.push(() => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
    });
  });

  const duo = humans.find((e) => e.s.human === "duo");
  const star = humans.find((e) => e.s.human === "star");
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      paused = !paused;
      msg.textContent = paused ? "⏸️ 暂停中,再按一次 Esc 继续。" : "继续!";
      // 这一下归自己了:不拦住,游戏壳还会再弹一次统一暂停面板,
      // 之后的 Esc 只关面板,盘面却一直停着
      e.preventDefault();
      return;
    }
    if (paused) return;
    if (duo) {
      const d = keyToDir(e.key, "duo");
      if (d) {
        seats[duo.i].input(d);
        e.preventDefault();
        return;
      }
    }
    // 只有一个人玩的时候方向键也归他,不必非得按 WASD
    const arrows = star ?? duo;
    if (arrows) {
      const d = keyToDir(e.key, "star");
      if (d) {
        seats[arrows.i].input(d);
        e.preventDefault();
      }
    }
  };
  window.addEventListener("keydown", onKeyDown);

  function frame(ts: number): void {
    if (destroyed) return;
    const dt = last === 0 ? 1 / 60 : Math.min(0.05, (ts - last) / 1000);
    last = ts;
    if (!paused) for (const s of seats) s.step(dt);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("keydown", onKeyDown);
      for (const s of sayers) s.cancel();
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
      for (const off of offs) off();
      offs.length = 0;
      for (const s of seats) s.destroy();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 战役
// ---------------------------------------------------------------------------

/** 窄屏也塞得下的格子尺寸:盘面加上间隙不超过可用宽度 */
export function cellPxFor(size: number, width: number, seats = 1): number {
  const usable = Math.max(200, Math.min(width, 520) - 24) / seats;
  return Math.max(34, Math.floor((usable - (size + 1) * GAP) / size));
}

function viewportWidth(): number {
  const w = (globalThis as { innerWidth?: number }).innerWidth;
  return typeof w === "number" && w > 0 ? w : 420;
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg = levelConfig(ctx.level);
  let settled = false;
  let foeReached = false;

  const seats: SeatOpts[] = [
    {
      name: "朵朵",
      human: "duo",
      start: startBoard(ctx.level),
      seed: cfg.seed,
      target: cfg.target,
      stepLimit: cfg.stepLimit,
      cell: cellPxFor(cfg.size, viewportWidth(), cfg.race ? 2 : 1),
      sfx: ctx.sfx,
      onDone: () => undefined
    }
  ];
  if (cfg.race) {
    seats.push({
      name: `${AI_TIER_LABELS[cfg.aiTier]}假人`,
      tier: cfg.aiTier,
      start: startBoard(ctx.level),
      seed: cfg.seed,
      target: cfg.target,
      stepLimit: 0,
      cell: Math.round(cellPxFor(cfg.size, viewportWidth(), 2) * 0.9),
      sfx: () => undefined,
      onDone: (s) => {
        if (s.reached) foeReached = true;
      }
    });
  }

  const table = createTable(stage, {
    goalText: goalLine(cfg),
    banner: cfg.race ? `对手:${AI_TIER_LABELS[cfg.aiTier]}` : undefined,
    split: cfg.race,
    hint: "开局已经摆好一条从大到小的阶梯,把最小的那一级再凑一份出来就能一路合上去。",
    seats,
    onOver: (states) => {
      if (settled) return;
      settled = true;
      const me = states[0];
      const got: MergeResult = {
        best: me.best,
        steps: me.steps,
        score: me.score,
        stuck: me.stuck,
        foeReached: foeReached || Boolean(states[1]?.reached)
      };
      if (levelWon(cfg, got)) {
        ctx.win(starsFor(cfg, got), `合出了 ${got.best},用了 ${got.steps} 步,拿了 ${got.score} 分！`);
      } else {
        ctx.lose(overLine(cfg, got));
      }
    }
  });
  return { destroy: () => table.destroy() };
}

// ---------------------------------------------------------------------------
// 对战 / 无尽 / 双人同屏
// ---------------------------------------------------------------------------

type ExtraMode = "versus" | "endless" | "duo";

const MODE_TITLE: Record<ExtraMode, string> = {
  versus: "🤝 对战竞速",
  endless: "♾️ 马拉松",
  duo: "👫 双人同屏"
};

function freshBoard(size: number, seed: number): Board {
  const rand = rng(seed);
  let board = createBoard(size);
  for (let i = 0; i < 2; i++) {
    const born = spawn(board, rand);
    if (born) board = born.board;
  }
  return board;
}

function mountExtra(host: HTMLElement, api: GameApi, mode: ExtraMode, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "mg-mode";
  const style = document.createElement("style");
  style.textContent = MG_CSS;
  const head = document.createElement("div");
  head.className = "mg-mhead";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "mg-back";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "mg-badge";
  chip.textContent = MODE_TITLE[mode];
  head.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(style, head, stage);
  host.appendChild(wrap);

  let table: { destroy: () => void } | null = null;
  let kind: EndlessKind = "marathon";
  let tier: AiTier = "normal";
  let target = 512;
  let best = save.getGameProgress(meta.id).endlessBest;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function picker(labels: string[], onPick: (i: number) => void): HTMLElement {
    const row = document.createElement("div");
    row.className = "mg-modebar";
    labels.forEach((label, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mg-open";
      b.textContent = label;
      b.addEventListener("click", () => {
        api.play("tap");
        onPick(i);
      });
      row.appendChild(b);
    });
    return row;
  }

  function showOver(title: string, sub: string, again: string): void {
    table?.destroy();
    table = null;
    stage.innerHTML = "";
    const box = document.createElement("div");
    box.className = "mg-over";
    const t = document.createElement("div");
    t.className = "mg-over-t";
    t.textContent = title;
    const s = document.createElement("div");
    s.className = "mg-over-s";
    s.textContent = sub;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mg-open";
    btn.textContent = again;
    btn.addEventListener("click", () => {
      api.play("tap");
      start();
    });
    box.append(t, s, btn);
    stage.appendChild(box);
  }

  function start(): void {
    table?.destroy();
    table = null;
    stage.innerHTML = "";
    const seed = Math.floor(Math.random() * 1e9);

    if (mode === "endless") {
      stage.appendChild(
        picker(["♾️ 四乘四马拉松", "🔳 三乘三马拉松"], (i) => {
          kind = i === 0 ? "marathon" : "tiny";
          runEndless(seed);
        })
      );
      const tip = document.createElement("div");
      tip.className = "mg-msg";
      tip.textContent = `没有目标,一直叠下去。目前最好成绩 ${best} 分。`;
      stage.appendChild(tip);
      return;
    }
    if (mode === "versus") {
      stage.appendChild(
        picker(
          VERSUS_TARGETS.map((n) => `🎯 合到 ${n}`),
          (i) => {
            target = VERSUS_TARGETS[i];
            stage.innerHTML = "";
            stage.appendChild(
              picker(
                AI_TIERS.map((t) => `${AI_TIER_LABELS[t]}`),
                (k) => {
                  tier = AI_TIERS[k];
                  runVersus(seed);
                }
              )
            );
            const note = document.createElement("div");
            note.className = "mg-msg";
            note.textContent = AI_TIERS.map((t) => `${AI_TIER_LABELS[t]}:${AI_TIER_BLURBS[t]}`).join("\n");
            stage.appendChild(note);
          }
        )
      );
      const tip = document.createElement("div");
      tip.className = "mg-msg";
      tip.textContent = "两边用同一串生成序列,比谁先合到目标。";
      stage.appendChild(tip);
      return;
    }
    runDuo(seed);
  }

  function runEndless(seed: number): void {
    stage.innerHTML = "";
    const cfg = endlessConfig(kind);
    chip.textContent = `${cfg.label} · 最好 ${best}`;
    table = createTable(stage, {
      goalText: "一直叠下去,记最高分和最大的那一块",
      banner: `最好成绩 ${best}`,
      hint: cfg.hint,
      seats: [
        {
          name: "朵朵",
          human: "duo",
          start: freshBoard(cfg.size, seed),
          seed,
          target: 0,
          stepLimit: 0,
          cell: cellPxFor(cfg.size, viewportWidth()),
          sfx: (n) => api.play(n),
          onDone: () => undefined
        }
      ],
      onOver: (states) => {
        const me = states[0];
        best = save.recordEndlessBest(meta.id, me.score);
        if (me.best >= 512) api.addStars(2);
        showOver(
          "这一盘到此为止",
          `拿了 ${me.score} 分,最大的一块是 ${me.best},走了 ${me.steps} 步。最好成绩 ${best} 分。`,
          "🔁 再来一盘"
        );
      }
    });
  }

  function runVersus(seed: number): void {
    stage.innerHTML = "";
    const cfg = versusConfig(tier, target);
    chip.textContent = `🤝 对手:${AI_TIER_LABELS[tier]} · 目标 ${cfg.target}`;
    let foeReached = false;
    table = createTable(stage, {
      goalText: `比谁先合到 ${cfg.target}`,
      banner: `${AI_TIER_LABELS[tier]}:${AI_TIER_BLURBS[tier]}`,
      split: true,
      hint: "两边的生成序列一样,拼的是谁排得更整齐。",
      seats: [
        {
          name: "朵朵",
          human: "duo",
          start: freshBoard(cfg.size, seed),
          seed,
          target: cfg.target,
          stepLimit: 0,
          cell: cellPxFor(cfg.size, viewportWidth(), 2),
          sfx: (n) => api.play(n),
          onDone: () => undefined
        },
        {
          name: `${AI_TIER_LABELS[tier]}假人`,
          tier,
          start: freshBoard(cfg.size, seed),
          seed,
          target: cfg.target,
          stepLimit: 0,
          cell: cellPxFor(cfg.size, viewportWidth(), 2),
          sfx: () => undefined,
          onDone: (s) => {
            if (s.reached) foeReached = true;
          }
        }
      ],
      onOver: (states) => {
        const me = states[0];
        const foe = states[1];
        const won = me.reached && !foeReached && !foe.reached;
        if (won) api.addStars(2);
        showOver(
          won ? "你先合到啦！" : "这一局到此为止",
          `你最大 ${me.best}、${me.steps} 步;对手最大 ${foe.best}。${won ? "排得真整齐！" : "换个顺序再来一盘。"}`,
          "🔁 再打一场"
        );
      }
    });
  }

  function runDuo(seed: number): void {
    stage.innerHTML = "";
    chip.textContent = "👫 朵朵 WASD · 星星 方向键";
    table = createTable(stage, {
      goalText: "两块盘一起叠,比谁的最大块更大",
      split: true,
      hint: "朵朵用 W A S D,星星用方向键,手机各滑各的那块盘。",
      seats: [
        {
          name: "朵朵",
          human: "duo",
          start: freshBoard(4, seed),
          seed,
          target: 0,
          stepLimit: 0,
          cell: cellPxFor(4, viewportWidth(), 2),
          sfx: (n) => api.play(n),
          onDone: () => undefined
        },
        {
          name: "星星",
          human: "star",
          start: freshBoard(4, seed + 1),
          seed: seed + 1,
          target: 0,
          stepLimit: 0,
          cell: cellPxFor(4, viewportWidth(), 2),
          sfx: (n) => api.play(n),
          onDone: () => undefined
        }
      ],
      onOver: (states) => {
        const [a, b] = states;
        const line =
          a.best === b.best
            ? "两个人打成平手,再来一盘！"
            : a.best > b.best
              ? "朵朵这一盘的块更大！"
              : "星星这一盘的块更大！";
        showOver("这一盘结束啦", `朵朵最大 ${a.best}、${a.score} 分;星星最大 ${b.best}、${b.score} 分。${line}`, "🔁 再来一盘");
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

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = MG_CSS;
  const bar = document.createElement("div");
  bar.className = "mg-modebar";
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

  (["versus", "endless", "duo"] as ExtraMode[]).forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mg-open";
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
      mapHint: "选一个角守住,只往两个方向滑,大块就不会乱跑。",
      grandMessage: "188 关全部合完,合成杯冠军就是你！",
      guide,
      guideTitle: "星星合成 · 合数笔记"
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
export const MG_CONSTS = { MOVE_MS, MERGE_MS, BORN_MS, SWIPE_MIN, AI_BEAT_MS, GAP };

/** 给测试用的方向表与空格记号 */
export const MG_DIRS = DIRS;
export const MG_EMPTY = EMPTY;
export const MG_STEP_BUDGET = stepBudget;
