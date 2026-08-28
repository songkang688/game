import { meta } from "./meta";
export { meta };

/**
 * 围子花园:九路 / 十三路 / 十九路的围棋。
 * 188 关死活官子闯关 + 四档人机自由对战 + 九路连胜无尽 + 朵朵星星同屏双人,
 * 棋力全部来自本仓库的启发式与浅层随机模拟,离线可玩,不接任何外部引擎。
 */
import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle, type SoundName } from "../level99";
import {
  compatFromMeta,
  describeModes,
  modeEntryKeys,
  type ModeEntry
} from "../../engine";
import { save } from "../../engine/save";
import { stagePlayRoom } from "../../engine/stageRoom";
import { resetStageScroll, stageClipBottom } from "../stageFit";
import guide from "./guide";
import {
  BLACK,
  BOARD_SIZES,
  EMPTY,
  SIZE_LABELS,
  WHITE,
  colorName,
  coordLabel,
  emptyPoints,
  groupAt,
  neighborTable,
  other,
  parseRows,
  pointOf,
  starPoints,
  xy,
  type Board,
  type BoardSize,
  type Color
} from "./board";
import { autoDeadStones, expandDead } from "./life";
import {
  ILLEGAL_TEXT,
  cloneGame,
  createGame,
  movesFor,
  passMove,
  playMove,
  type GameState,
  type ScoreRule
} from "./rules";
import { RULE_HINTS, RULE_LABELS, applyDead, damePoints, finalScore, komiFor, scoreLines, territoryOf, type Territory } from "./score";
import {
  TERRITORY_COLORS,
  WASH_MS,
  WQ_WOOD,
  drawCursorBox,
  drawDeadCross,
  drawKoFlower,
  drawLeafMark,
  drawPlaceRipple,
  drawSproutHint,
  harvestCount,
  harvestFlowersSVG,
  makePetalPool,
  paintStone,
  paintWoodBoard,
  scoreBarParts,
  stoneSprite,
  stoneSpriteSize,
  trophySVG,
  washAlpha,
  type ArtCtx,
  type PetalPool,
  type StoneKind
} from "./art";
import { AI_TIERS, AI_TIER_HINTS, AI_TIER_LABELS, aiMove, type AiTier } from "./ai";
import {
  CHAPTERS,
  KIND_LABELS,
  levelAt,
  levelBoard,
  levelCleared,
  levelSolutions,
  starsFor,
  type WeiqiLevel
} from "./levels";

// ---------------------------------------------------------------------------
// 版面尺寸:9 路交叉点热区必须 ≥ 28px,13 / 19 路 ≥ 22px
// ---------------------------------------------------------------------------

/** 各路数的最小热区(px) */
export function minHitSize(size: number): number {
  return size <= 9 ? 28 : 22;
}

export interface BoardMetrics {
  /** 相邻两条线的间距,也就是一个交叉点的热区大小 */
  cell: number;
  /** 棋盘边缘到第一条线的留白 */
  pad: number;
  /** 画布边长 */
  extent: number;
  /** 棋子半径 */
  stone: number;
}

/**
 * 按可用宽度算棋盘尺寸。宽度不够时不会把格子压小 —— 直接维持最小热区,
 * 画布比容器宽就交给外层容器滚动(手机上拖着看)。
 */
export function boardMetrics(size: number, width: number, zoom = 1): BoardMetrics {
  const usable = Number.isFinite(width) && width > 80 ? width : 320;
  const fit = usable / (size + 1);
  const cell = Math.max(minHitSize(size), fit) * Math.max(1, zoom);
  const pad = cell * 0.7;
  const extent = Math.round(pad * 2 + cell * (size - 1));
  return { cell, pad, extent, stone: cell * 0.46 };
}

/** 画布坐标 → 交叉点;离最近的交叉点太远就返回 null */
export function hitPoint(size: number, m: BoardMetrics, x: number, y: number): number | null {
  const gx = Math.round((x - m.pad) / m.cell);
  const gy = Math.round((y - m.pad) / m.cell);
  if (gx < 0 || gy < 0 || gx >= size || gy >= size) return null;
  const dx = x - (m.pad + gx * m.cell);
  const dy = y - (m.pad + gy * m.cell);
  if (Math.hypot(dx, dy) > m.cell * 0.62) return null;
  return pointOf(size, gx, gy);
}

// ---------------------------------------------------------------------------
// 键位
// ---------------------------------------------------------------------------

export type KeyAction = "up" | "down" | "left" | "right" | "confirm" | "pass" | "pause" | null;

/**
 * 同屏双人开局前那一行说明。
 *
 * 原来只写了「点交叉点。F 确认,G 停一手」—— 那是朵朵那套键。
 * 坐在右边的孩子照着按 F,按的是对家的键,轮到自己反而不知道该按什么，
 * 所以两套键位各写各的。
 */
export const DUO_HINT =
  "朵朵执黑先走,星星执白,轮流点交叉点。朵朵 WASD 挪光标、F 落子、G 停一手;星星 方向键挪光标、L 落子、K 停一手。";

/**
 * 点选落子是主要玩法,键盘是等价通道:
 * 方向键 / `WASD` 挪光标,`F`(朵朵)或 `L`(星星)确认落子,`G` / `K` 停一手,`Esc` 暂停。
 */
export function keyAction(key: string): KeyAction {
  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
      return "up";
    case "ArrowDown":
    case "s":
    case "S":
      return "down";
    case "ArrowLeft":
    case "a":
    case "A":
      return "left";
    case "ArrowRight":
    case "d":
    case "D":
      return "right";
    case "f":
    case "F":
    case "l":
    case "L":
    case "Enter":
      return "confirm";
    case "g":
    case "G":
    case "k":
    case "K":
      return "pass";
    case "Escape":
      return "pause";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// 动效:提子要一颗颗提走
// ---------------------------------------------------------------------------

/** 每颗被提的子之间隔多久(ms);省电模式下缩到最短,但顺序还在 */
export function captureStepMs(reduced: boolean): number {
  return reduced ? 16 : 80;
}

export function reducedMotion(): boolean {
  try {
    return Boolean(
      (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia?.("(prefers-reduced-motion: reduce)")
        ?.matches
    );
  } catch {
    return false;
  }
}

/** 提子文案:一颗都不许写成打打杀杀 */
export function captureLine(n: number, color: Color): string {
  if (n <= 0) return "";
  return `请${colorName(color)}这 ${n} 颗子回篮子里。`;
}

/**
 * 读屏那一句。
 *
 * 棋盘是一张画布,读屏只能听到「十九路棋盘」这一句静态 `aria-label`,
 * 之后落哪儿、提了几颗、该谁下,全靠看芯片。这里把芯片上那几个数
 * 与这一步的提示合成一句短话,写进看不见的 live 区。
 */
export function saySentence(head: readonly string[], note?: string): string {
  const body = head.map((s) => s.trim()).filter((s) => s.length > 0).join(",");
  const tail = (note ?? "").trim();
  if (!body) return tail;
  return tail ? `${body}。${tail}` : `${body}。`;
}

/** 自由对局 / 双人同屏的那一句 */
export function matchSay(
  moves: number,
  turn: Color,
  captures: { black: number; white: number },
  opts: { counting?: boolean; dead?: number; note?: string } = {}
): string {
  if (opts.counting) {
    return saySentence(["数一数阶段", `已标死 ${opts.dead ?? 0} 颗`], opts.note);
  }
  return saySentence(
    [`第 ${moves} 手`, `轮到${colorName(turn)}`, `朵朵提了 ${captures.black} 颗`, `星星提了 ${captures.white} 颗`],
    opts.note
  );
}

/** 闯关的那一句:关心的是还剩几手,不是提子数 */
export function puzzleSay(kind: string, used: number, budget: number, marked: number, note?: string): string {
  const head = kind === "markDead" ? [`已标 ${marked} 颗`] : [`第 ${used} 手`, `还剩 ${Math.max(0, budget - used)} 手`];
  return saySentence(head, note);
}

// ---------------------------------------------------------------------------
// 无尽:连胜越多对手越强
// ---------------------------------------------------------------------------

export function endlessTier(streak: number): AiTier {
  if (streak >= 6) return "master";
  if (streak >= 3) return "expert";
  if (streak >= 1) return "normal";
  return "rookie";
}

export function endlessLine(streak: number, best: number): string {
  return `连胜 ${streak} 场 · 最好成绩 ${Math.max(best, streak)} 场 · 现在的对手是${AI_TIER_LABELS[endlessTier(streak)]}`;
}

/** 闯关每一关给多少秒(温柔的上限,超时只鼓励) */
export function levelSeconds(level: WeiqiLevel): number {
  if (level.kind === "battle") return 180;
  if (level.size >= 19) return 150;
  return 120;
}

export const MODE_LABELS = {
  versus: "🤖 自由对战",
  endless: "🔥 连胜无尽",
  duo: "👫 双人同屏"
} as const;

export type ExtraMode = keyof typeof MODE_LABELS;

// ---------------------------------------------------------------------------
// 样式
// ---------------------------------------------------------------------------

export const WQ_CSS = `
.wq-wrap{font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;background:linear-gradient(180deg,#FBF7EE,#F2EFE6);
  border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;}
.wq-modebar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:0 0 10px;}
/* display:flex 会压过 hidden 属性的 UA display:none,进关/进模式时模式条要真的让位 */
.wq-modebar[hidden]{display:none;}
.wq-modetip{flex:1 1 100%;margin:0 0 2px;font-size:16px;line-height:1.5;font-weight:700;color:#6A5A42;text-align:center;overflow-wrap:anywhere;}
.wq-open{border:none;border-radius:999px;padding:10px 18px;font-size:15px;font-weight:900;color:#fff;cursor:pointer;
  min-height:44px;font-family:inherit;background:linear-gradient(180deg,#8C7A5B,#6F6047);box-shadow:0 4px 0 #574B38;}
.wq-open:active{transform:translateY(2px);box-shadow:0 2px 0 #574B38;}
.wq-open.wq-ghost{background:linear-gradient(180deg,#7E8BA6,#65708A);box-shadow:0 4px 0 #4E5770;}
.wq-open.wq-ghost:active{box-shadow:0 2px 0 #4E5770;}
.wq-hud{display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:center;margin-bottom:8px;}
.wq-chip{background:#fff;border-radius:999px;padding:6px 11px;font-size:16px;font-weight:800;color:#6A5A42;
  box-shadow:0 2px 6px rgba(150,130,90,.22);overflow-wrap:anywhere;}
.wq-chip b{color:#A8763A;}
.wq-scroll{overflow:auto;-webkit-overflow-scrolling:touch;border-radius:14px;max-width:100%;width:fit-content;
  margin:0 auto;}
.wq-canvas{display:block;touch-action:manipulation;border-radius:14px;background:#E8D9B5;}
.wq-lens{display:block;border-radius:12px;background:#E8D9B5;box-shadow:0 2px 8px rgba(120,100,60,.3);}
.wq-lensbox{display:flex;align-items:center;gap:8px;justify-content:center;margin-top:6px;flex-wrap:wrap;}
.wq-lenstip{font-size:var(--mt-body,16px);font-weight:700;color:#7A6A50;}
.wq-tools{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:8px;}
.wq-btn{border:none;border-radius:14px;padding:9px 14px;min-height:44px;font-size:14px;font-weight:900;cursor:pointer;
  font-family:inherit;background:#fff;color:#6A5A42;box-shadow:0 3px 0 rgba(150,130,90,.3);white-space:nowrap;}
.wq-btn:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(150,130,90,.3);}
.wq-btn.wq-on{background:#F2E3C2;color:#7A5A26;}
.wq-btn:disabled{opacity:.5;cursor:default;}
.wq-btn:focus-visible,.wq-open:focus-visible,.wq-canvas:focus-visible{outline:3px solid #3F3520;outline-offset:3px;}
.wq-msg{text-align:center;font-size:16px;font-weight:800;color:#6A5A42;min-height:22px;line-height:1.6;margin-top:8px;
  overflow-wrap:anywhere;}
.wq-note{text-align:center;font-size:16px;font-weight:700;color:#8A7A5E;line-height:1.6;margin:6px auto 0;max-width:520px;
  overflow-wrap:anywhere;}
/* 只给读屏听的一行:看不见也不占位,盘面一变就把变化念出来 */
.wq-say{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;
  clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;}
.wq-rows{background:#ffffffcc;border-radius:12px;padding:8px 10px;font-size:16px;font-weight:700;color:#6A5A42;
  line-height:1.7;margin:8px auto 0;max-width:520px;overflow-wrap:anywhere;}
.wq-over{position:absolute;inset:0;background:rgba(251,247,238,.96);border-radius:16px;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:18px;z-index:6;}
.wq-over-t{font-size:20px;font-weight:900;color:#7A5A26;}
.wq-over-s{font-size:16px;font-weight:700;color:#6A5A42;line-height:1.6;max-width:320px;overflow-wrap:anywhere;}
.wq-trophy{line-height:0;filter:drop-shadow(0 2px 2px rgba(120,100,60,.35));}
.wq-bars{display:flex;width:min(260px,86%);height:16px;border-radius:999px;overflow:hidden;background:#fff;
  box-shadow:inset 0 1px 3px rgba(90,70,40,.35);}
.wq-bar-b{display:block;height:100%;background:linear-gradient(180deg,#cfb7f2,#a98ae0);}
.wq-bar-w{display:block;height:100%;background:linear-gradient(180deg,#fff8e8,#efe3c8);}
.wq-harvest{line-height:0;max-width:280px;}
.wq-stage{position:relative;}
.wq-setup{display:flex;flex-direction:column;gap:8px;align-items:center;margin-bottom:8px;}
.wq-row{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center;}
.wq-label{font-size:16px;font-weight:800;color:#7A6A50;}
/* r5 N-10:915×412 矮横屏纵排装不下(canvas 下沿+停一手/数一数排折叠线下)——
   盘左、徽章/工具/提示右双栏,盘宽由 hostWidth 按舞台高预算算(这一档只扣 40) */
@media (min-width:700px) and (max-height:520px){
  .wq-stage{display:grid;grid-template-columns:minmax(0,auto) minmax(220px,340px);
    column-gap:12px;row-gap:6px;align-items:start;align-content:start;justify-content:center;}
  .wq-boardhost{grid-column:1;grid-row:1 / span 6;}
  .wq-stage .wq-hud,.wq-stage .wq-tools,.wq-stage .wq-msg,.wq-stage .wq-say,
  .wq-stage .wq-rows,.wq-stage .wq-note{grid-column:2;margin:0;}
}
@media (max-width:360px){
  .wq-chip{padding:5px 9px;}
  .wq-btn{padding:8px 11px;}
  .wq-open{font-size:14px;padding:9px 13px;}
}
@media (prefers-reduced-motion:reduce){
  .wq-canvas{transition:none;}
}
`;

// ---------------------------------------------------------------------------
// 棋盘视图
// ---------------------------------------------------------------------------

type Ctx2D = {
  clearRect: (x: number, y: number, w: number, h: number) => void;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  arc: (x: number, y: number, r: number, a: number, b: number) => void;
  fill: () => void;
  stroke: () => void;
  setTransform?: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  /** 有离屏 sprite 的环境走 drawImage;探测不到就逐子矢量兜底 */
  drawImage?: (img: unknown, x: number, y: number, w: number, h: number) => void;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  globalAlpha: number;
};

export interface ViewOptions {
  size: BoardSize;
  onPick: (pt: number) => void;
  /** 光标停在哪儿(键盘用),不给就自己管 */
  hostWidth?: () => number;
}

export interface BoardView {
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  cursor: number;
  setZoom: (z: number) => void;
  moveCursor: (dx: number, dy: number) => void;
  confirmCursor: () => void;
  render: (board: Board, extra?: RenderExtra) => void;
  /** 提子那一格喷一朵花瓣(reducedMotion 下自动不喷,子直接消失) */
  burst: (pt: number, kind: StoneKind) => void;
  destroy: () => void;
}

export interface RenderExtra {
  last?: number | null;
  dead?: readonly number[];
  hints?: readonly number[];
  ghost?: { pt: number; color: Color } | null;
  /** 劫争点:画一朵小红花提示「这里暂时不能提回来」 */
  ko?: number | null;
  /** 数一数阶段的领地归属:淡色块波纹铺开(只做展示,不进任何计分) */
  territory?: Territory | null;
}

/** 落子动画总时长(ms):前 150ms 从 1.25 倍缩到 1 倍,后半段振纹淡出 */
const DROP_MS = 300;
const DROP_SCALE_MS = 150;

function createBoardView(host: HTMLElement, opts: ViewOptions): BoardView {
  const size = opts.size;
  const scroll = document.createElement("div");
  scroll.className = "wq-scroll";
  const canvas = document.createElement("canvas");
  canvas.className = "wq-canvas";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${SIZE_LABELS[size as BoardSize] ?? `${size} 路`}棋盘`);
  scroll.appendChild(canvas);
  host.appendChild(scroll);

  let zoom = 1;
  let metrics = boardMetrics(size, opts.hostWidth?.() ?? 320, zoom);
  let lastBoard: Board | null = null;
  let lastExtra: RenderExtra = {};

  // ---- 1.3 视觉状态:花瓣池 / 落子动画 / 数目铺色,全是展示层,不碰胜负 ----
  const reduced = reducedMotion();
  const pool = makePetalPool();
  // 测试探针:视觉契约用例从画布上取回花瓣池,断言「提子喷了、播完回收了」
  (canvas as unknown as { wqFx?: PetalPool }).wqFx = pool;
  let destroyed = false;
  let fxOn = false;
  let dropPt: number | null = null;
  let dropStart = 0;
  let prevLast: number | null = null;
  let washStart: number | null = null;

  function raf(): ((cb: (t: number) => void) => number) | null {
    const r = (globalThis as { requestAnimationFrame?: (cb: (t: number) => void) => number }).requestAnimationFrame;
    return typeof r === "function" ? r : null;
  }

  /** 动画泵:有活(花瓣 / 落子 / 铺色)就一帧帧重画,闲下来自动熄火 */
  function pumpFx(): void {
    const r = raf();
    if (!r || fxOn || destroyed) return;
    fxOn = true;
    let prev = Date.now();
    const loop = (): void => {
      if (destroyed) {
        fxOn = false;
        return;
      }
      const now = Date.now();
      pool.step(Math.min(0.1, (now - prev) / 1000));
      prev = now;
      if (lastBoard) draw(lastBoard, lastExtra);
      const dropBusy = dropPt !== null && now - dropStart < DROP_MS;
      const washBusy = washStart !== null && now - washStart < WASH_MS;
      if (!pool.idle() || dropBusy || washBusy) r(loop);
      else fxOn = false;
    };
    r(loop);
  }

  const view: BoardView = {
    el: scroll,
    canvas,
    cursor: pointOf(size, (size - 1) >> 1, (size - 1) >> 1),
    setZoom: (z) => {
      zoom = Math.max(1, Math.min(2.6, z));
      resize();
    },
    moveCursor: (dx, dy) => {
      const { x, y } = xy(size, view.cursor);
      const nx = Math.max(0, Math.min(size - 1, x + dx));
      const ny = Math.max(0, Math.min(size - 1, y + dy));
      view.cursor = pointOf(size, nx, ny);
      if (lastBoard) view.render(lastBoard, lastExtra);
    },
    confirmCursor: () => opts.onPick(view.cursor),
    render: (board, extra) => {
      lastBoard = board;
      lastExtra = extra ?? {};
      // 新的一手:落子动画(soft / reducedMotion / 无 rAF 环境直接出现)
      const last = lastExtra.last ?? null;
      if (last !== prevLast) {
        prevLast = last;
        if (last !== null && board.cells[last] !== EMPTY && !reduced && raf()) {
          dropPt = last;
          dropStart = Date.now();
          pumpFx();
        } else {
          dropPt = null;
        }
      }
      // 数目铺色从领地第一次出现时起算;退出数子阶段就归零
      if (lastExtra.territory) {
        if (washStart === null) {
          washStart = Date.now();
          pumpFx();
        }
      } else {
        washStart = null;
      }
      draw(board, lastExtra);
    },
    burst: (pt, kind) => {
      const { x, y } = xy(size, pt);
      pool.spawn(metrics.pad + x * metrics.cell, metrics.pad + y * metrics.cell, kind, {
        reduced,
        r: metrics.stone
      });
      pumpFx();
    },
    destroy: () => {
      destroyed = true;
      canvas.removeEventListener("pointerdown", onPointer);
      (globalThis as { removeEventListener?: typeof window.removeEventListener }).removeEventListener?.("resize", resize);
      if (settleTimer !== null) clearTimeout(settleTimer);
      scroll.remove();
    }
  };

  function dpr(): number {
    const v = (globalThis as { devicePixelRatio?: number }).devicePixelRatio;
    return typeof v === "number" && v > 0 ? Math.min(v, 3) : 1;
  }

  function resize(): void {
    metrics = boardMetrics(size, opts.hostWidth?.() ?? 320, zoom);
    const ratio = dpr();
    canvas.width = Math.round(metrics.extent * ratio);
    canvas.height = Math.round(metrics.extent * ratio);
    canvas.style.width = `${metrics.extent}px`;
    canvas.style.height = `${metrics.extent}px`;
    fitScrollBox();
    if (lastBoard) draw(lastBoard, lastExtra);
  }

  /**
   * r5 N-10:9 路盘按 28px 热区地板算是 263px,915×412 双栏里只剩 250px——
   * 热区不能再小,就把 .wq-scroll(本来就 overflow:auto)钳到实际余量,
   * 差的十几像素在盒子里拖,不再戳穿舞台下沿。竖屏纵排不钳,交给舞台滚。
   */
  function fitScrollBox(): void {
    if (!scroll.style) return;
    scroll.style.maxHeight = "";
    const mq = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    let shortLand = false;
    try {
      shortLand = mq ? mq("(min-width:700px) and (max-height:520px)").matches : false;
    } catch {
      shortLand = false;
    }
    if (!shortLand || typeof scroll.getBoundingClientRect !== "function") return;
    const clip = stageClipBottom(scroll);
    if (!Number.isFinite(clip)) return;
    const r = scroll.getBoundingClientRect();
    if (!Number.isFinite(r.top)) return;
    // stageClipBottom 已按「滚回顶」口径扣掉残余滚动
    const room = Math.floor(clip - r.top - 4);
    if (room >= 120 && metrics.extent > room) scroll.style.maxHeight = `${room}px`;
  }

  function ctx2d(): Ctx2D | null {
    const get = (canvas as unknown as { getContext?: (t: string) => unknown }).getContext;
    if (typeof get !== "function") return null;
    const c = get.call(canvas, "2d") as Ctx2D | null;
    return c ?? null;
  }

  /** 画布坐标:交叉点 (gx, gy) 的像素位置 */
  function px(g: number): number {
    return metrics.pad + g * metrics.cell;
  }

  /** 数目铺色进度:reduced / 无 rAF 环境直接铺满,不留半途 */
  function washT(): number {
    if (washStart === null || reduced || !raf()) return 1;
    return Math.min(1, (Date.now() - washStart) / WASH_MS);
  }

  function draw(board: Board, extra: RenderExtra): void {
    const ctx = ctx2d();
    if (!ctx) return;
    const ratio = dpr();
    ctx.setTransform?.(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, metrics.extent, metrics.extent);
    const art = ctx as unknown as ArtCtx;

    // 1) 温润木盘:渐变底 + 木纹 + 深木边框 + 四角花藤(全在 art.ts)
    paintWoodBoard(art, { extent: metrics.extent, pad: metrics.pad });

    // 2) 网格深棕;星位点画「高光偏移 + 深点」做内嵌感
    ctx.strokeStyle = WQ_WOOD.grid;
    ctx.lineWidth = Math.max(1, metrics.cell * 0.035);
    for (let i = 0; i < size; i++) {
      const p = px(i);
      ctx.beginPath();
      ctx.moveTo(metrics.pad, p);
      ctx.lineTo(px(size - 1), p);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p, metrics.pad);
      ctx.lineTo(p, px(size - 1));
      ctx.stroke();
    }
    for (const sp of starPoints(size)) {
      const { x, y } = xy(size, sp);
      const sr = Math.max(2, metrics.cell * 0.08);
      ctx.fillStyle = "#f6e8c8";
      ctx.beginPath();
      ctx.arc(px(x) + 1, px(y) + 1, sr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = WQ_WOOD.grid;
      ctx.beginPath();
      ctx.arc(px(x), px(y), sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3) 数一数阶段:领地淡色块波纹铺开(黑淡紫、白淡米,只做展示)
    if (extra.territory) {
      const c = (size - 1) / 2;
      const maxDist = Math.hypot(c, c);
      const t = washT();
      const half = metrics.cell * 0.36;
      const zones: readonly [StoneKind, readonly number[], number][] = [
        ["black", extra.territory.black, 0.3],
        ["white", extra.territory.white, 0.42]
      ];
      for (const [kind, pts, peak] of zones) {
        ctx.fillStyle = TERRITORY_COLORS[kind];
        for (const pt of pts) {
          const { x, y } = xy(size, pt);
          const a = washAlpha(Math.hypot(x - c, y - c), maxDist, t) * peak;
          if (a <= 0) continue;
          ctx.globalAlpha = a;
          ctx.fillRect(px(x) - half, px(y) - half, half * 2, half * 2);
        }
      }
      ctx.globalAlpha = 1;
    }

    // 4) 棋子:offscreen sprite 一张画到底(19 路满盘也只 drawImage);
    //    拿不到离屏画布的环境退回逐子矢量,同一份 paintStone,质感一致
    const dead = new Set(extra.dead ?? []);
    const blit = (cx: number, cy: number, kind: StoneKind, alpha: number, scale: number): void => {
      const sprite = typeof ctx.drawImage === "function" ? stoneSprite(kind, metrics.stone, ratio) : null;
      if (sprite && typeof ctx.drawImage === "function") {
        const s = stoneSpriteSize(metrics.stone) * scale;
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, cx - s / 2, cy - s / 2, s, s);
        ctx.globalAlpha = 1;
      } else {
        paintStone(art, cx, cy, metrics.stone * scale, kind, alpha);
      }
    };
    const now = Date.now();
    for (let i = 0; i < board.cells.length; i++) {
      const cell = board.cells[i];
      if (cell === EMPTY) continue;
      const { x, y } = xy(size, i);
      const kind: StoneKind = cell === BLACK ? "black" : "white";
      let scale = 1;
      if (dropPt === i) {
        const el = now - dropStart;
        if (el < DROP_SCALE_MS) scale = 1.25 - 0.25 * (el / DROP_SCALE_MS);
        else if (el >= DROP_MS) dropPt = null;
      }
      blit(px(x), px(y), kind, dead.has(i) ? 0.35 : 1, scale);
      if (dead.has(i)) drawDeadCross(art, px(x), px(y), metrics.stone, kind);
    }
    // 落定振纹:4 根极短线,后半段淡出
    if (dropPt !== null && board.cells[dropPt] !== EMPTY) {
      const k = (now - dropStart - DROP_SCALE_MS) / (DROP_MS - DROP_SCALE_MS);
      if (k > 0) {
        const { x, y } = xy(size, dropPt);
        drawPlaceRipple(art, px(x), px(y), metrics.stone, k);
      }
    }

    // 5) 预览 ghost:同款 sprite,alpha 0.4,质感与正式子一致
    if (extra.ghost && board.cells[extra.ghost.pt] === EMPTY) {
      const { x, y } = xy(size, extra.ghost.pt);
      blit(px(x), px(y), extra.ghost.color === BLACK ? "black" : "white", 0.4, 1);
    }

    // 6) 提示点:发芽小点(形状通道,不再是绿描边圆)
    for (const h of extra.hints ?? []) {
      const { x, y } = xy(size, h);
      drawSproutHint(art, px(x), px(y), metrics.stone);
    }

    // 7) 劫争点:小红花标记
    if (extra.ko !== undefined && extra.ko !== null && board.cells[extra.ko] === EMPTY) {
      const { x, y } = xy(size, extra.ko);
      drawKoFlower(art, px(x), px(y), metrics.stone);
    }

    // 8) 最后一手:小枫叶,贴子的右上缘不遮中心
    if (extra.last !== undefined && extra.last !== null) {
      const { x, y } = xy(size, extra.last);
      drawLeafMark(art, px(x), px(y), metrics.stone);
    }

    // 9) 键盘光标:圆角方框(与圆形棋子、发芽点形状区分)
    const { x: cxp, y: cyp } = xy(size, view.cursor);
    drawCursorBox(art, px(cxp), px(cyp), metrics.cell * 0.46);

    // 10) 花瓣粒子盖在最上层
    pool.draw(art);
  }

  function onPointer(e: PointerEvent): void {
    const rect = canvas.getBoundingClientRect?.();
    const left = rect ? rect.left : 0;
    const top = rect ? rect.top : 0;
    const pt = hitPoint(size, metrics, e.clientX - left, e.clientY - top);
    if (pt === null) return;
    view.cursor = pt;
    opts.onPick(pt);
  }

  canvas.addEventListener("pointerdown", onPointer);
  (globalThis as { addEventListener?: typeof window.addEventListener }).addEventListener?.("resize", resize);
  resize();
  // 挂载这一刻壳层抬头(l99 关卡条)可能还没排好版,hostWidth 会把余量估多;
  // 抽空再量一次,矮横屏才不会差出十几像素(r5 N-10)。
  const settleTimer = typeof setTimeout === "function" ? setTimeout(resize, 0) : null;
  return view;
}

// ---------------------------------------------------------------------------
// 小工具:按钮、标签
// ---------------------------------------------------------------------------

function button(label: string, onClick: () => void, ghost = false): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = ghost ? "wq-btn wq-on" : "wq-btn";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function chip(text: string): HTMLElement {
  const el = document.createElement("span");
  el.className = "wq-chip";
  el.textContent = text;
  return el;
}

function row(...kids: HTMLElement[]): HTMLElement {
  const el = document.createElement("div");
  el.className = "wq-row";
  for (const k of kids) el.appendChild(k);
  return el;
}

function label(text: string): HTMLElement {
  const el = document.createElement("span");
  el.className = "wq-label";
  el.textContent = text;
  return el;
}

// ---------------------------------------------------------------------------
// 一局对弈(自由对战 / 无尽 / 双人共用)
// ---------------------------------------------------------------------------

export interface MatchOptions {
  size: BoardSize;
  rule: ScoreRule;
  handicap: number;
  /** 白方是谁:AI 档位,或者 `"human"` 表示同屏双人 */
  white: AiTier | "human";
  sfx: (n: SoundName) => void;
  onEnd: (verdict: ReturnType<typeof finalScore>) => void;
  /** 每步 AI 思考的等待毫秒,单测里传 0 */
  thinkMs?: number;
  /** 让测试可以塞一个同步的定时器 */
  schedule?: (fn: () => void, ms: number) => number;
  unschedule?: (id: number) => void;
}

export interface Match {
  el: HTMLElement;
  state: () => GameState;
  play: (pt: number) => boolean;
  pass: () => void;
  destroy: () => void;
}

function createMatch(host: HTMLElement, opts: MatchOptions): Match {
  const setTimer = opts.schedule ?? ((fn, ms) => (globalThis.setTimeout as typeof setTimeout)(fn, ms) as unknown as number);
  const clearTimer = opts.unschedule ?? ((id) => (globalThis.clearTimeout as typeof clearTimeout)(id as unknown as number));
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number): void => {
    const id = setTimer(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  const stage = document.createElement("div");
  stage.className = "wq-stage";
  host.appendChild(stage);
  // 菜单页的「开始 ▶」在折叠线下,点完舞台带着残余滚动;开局滚回顶,抬头别被卷走
  resetStageScroll(host);

  const hud = document.createElement("div");
  hud.className = "wq-hud";
  const turnChip = chip("");
  const capChip = chip("");
  const infoChip = chip("");
  hud.append(turnChip, capChip, infoChip);
  stage.appendChild(hud);

  const boardHost = document.createElement("div");
  boardHost.className = "wq-boardhost";
  stage.appendChild(boardHost);

  const msg = document.createElement("div");
  msg.className = "wq-msg";
  msg.setAttribute("role", "status");
  msg.setAttribute("aria-live", "polite");
  msg.setAttribute("aria-atomic", "true");
  const say = document.createElement("div");
  say.className = "wq-say";
  say.setAttribute("role", "status");
  say.setAttribute("aria-live", "polite");
  say.setAttribute("aria-atomic", "true");
  let said = "";

  let state = createGame({ size: opts.size, handicap: opts.handicap, rule: opts.rule });
  let dead: number[] = [];
  let paused = false;
  let counting = false;
  let busy = false;
  let overlay: HTMLElement | null = null;
  const reduced = reducedMotion();

  const view = createBoardView(boardHost, {
    size: opts.size,
    onPick: (pt) => tap(pt),
    hostWidth: () => hostWidth(host)
  });

  const tools = document.createElement("div");
  tools.className = "wq-tools";
  const passBtn = button("🖐️ 停一手 (G)", () => doPass());
  const countBtn = button("🧮 数一数", () => enterCounting());
  const pauseBtn = button("⏸️ 暂停 (Esc)", () => togglePause());
  tools.append(passBtn, countBtn, pauseBtn);
  if (opts.size > 9) {
    tools.append(
      button("➖", () => {
        zoom = Math.max(1, zoom - 0.3);
        view.setZoom(zoom);
      }),
      button("➕", () => {
        zoom = Math.min(2.6, zoom + 0.3);
        view.setZoom(zoom);
      })
    );
  }
  stage.append(tools, msg, say);

  const rows = document.createElement("div");
  rows.className = "wq-rows";
  rows.textContent = RULE_HINTS[opts.rule];
  stage.appendChild(rows);

  let zoom = 1;

  function refresh(note?: string): void {
    const last = state.moves.length ? state.moves[state.moves.length - 1].pt : null;
    // 数一数阶段把领地算出来铺淡色(纯展示,分数仍以 finalScore 为准)
    const territory = counting ? territoryOf(applyDead(state.board, dead).board) : null;
    view.render(state.board, { last, dead, ghost: null, ko: state.ko, territory });
    turnChip.textContent = counting ? "🧮 数一数" : `轮到 ${colorName(state.turn)}`;
    capChip.textContent = `提子 朵朵 ${state.captures[BLACK]} · 星星 ${state.captures[WHITE]}`;
    infoChip.textContent = `${SIZE_LABELS[opts.size]} · ${RULE_LABELS[opts.rule]} · 第 ${state.moves.length} 手`;
    if (note !== undefined) msg.textContent = note;
    // 同一句不重写:读屏对 live 区是「变了才念」,重复写会让它把没变的话再念一遍
    const line = matchSay(
      state.moves.length,
      state.turn,
      { black: state.captures[BLACK], white: state.captures[WHITE] },
      { counting, dead: dead.length, note: note ?? undefined }
    );
    if (line !== said) {
      said = line;
      say.textContent = line;
    }
  }

  function humanTurn(): boolean {
    return state.turn === BLACK || opts.white === "human";
  }

  function tap(pt: number): void {
    if (paused || busy) return;
    if (counting) {
      toggleDead(pt);
      return;
    }
    if (state.over || !humanTurn()) return;
    doPlay(pt);
  }

  function toggleDead(pt: number): void {
    if (state.board.cells[pt] === EMPTY) return;
    const group = expandDead(state.board, [pt]);
    const set = new Set(dead);
    const on = group.every((p) => set.has(p));
    for (const p of group) {
      if (on) set.delete(p);
      else set.add(p);
    }
    dead = Array.from(set).sort((a, b) => a - b);
    opts.sfx("tap");
    refresh(`标死 ${dead.length} 颗。点子可以取消,数完按「就这么数」。`);
  }

  function doPlay(pt: number): boolean {
    const res = playMove(state, pt);
    if (!res.ok) {
      opts.sfx("oops");
      refresh(ILLEGAL_TEXT[res.reason]);
      return false;
    }
    const before = state;
    state = res.state;
    opts.sfx(res.captured.length > 0 ? "pop" : "tap");
    if (res.captured.length > 0) {
      animateCaptures(before, pt, res.captured, other(state.turn));
    } else {
      refresh(res.ko !== null ? "成劫啦!对方不能马上提回来。" : "");
    }
    afterMove();
    return true;
  }

  /** 提子一颗颗提走:先画上还在的样子,再每隔 80ms 拿掉一颗、原位开一朵花瓣 */
  function animateCaptures(before: GameState, pt: number, captured: number[], taker: Color): void {
    const step = captureStepMs(reduced);
    const shown = cloneGame(before);
    shown.board.cells[pt] = taker;
    const gone: StoneKind = other(taker) === BLACK ? "black" : "white";
    let i = 0;
    const tick = (): void => {
      if (i >= captured.length) {
        refresh(captureLine(captured.length, other(taker)));
        return;
      }
      view.burst(captured[i], gone);
      shown.board.cells[captured[i]] = EMPTY;
      i++;
      view.render(shown.board, { last: pt, dead });
      later(tick, step);
    };
    view.render(shown.board, { last: pt, dead });
    later(tick, step);
  }

  function doPass(): void {
    if (paused || busy || state.over || counting) return;
    if (!humanTurn()) return;
    state = passMove(state);
    opts.sfx("tap");
    refresh("停一手。双方都停就开始数啦。");
    afterMove();
  }

  function afterMove(): void {
    if (state.over) {
      later(() => enterCounting(true), 260);
      return;
    }
    if (opts.white !== "human" && state.turn === WHITE) {
      busy = true;
      later(() => {
        busy = false;
        aiTurn();
      }, opts.thinkMs ?? 260);
    } else {
      refresh();
    }
  }

  function aiTurn(): void {
    if (state.over || paused) return;
    const tier = opts.white as AiTier;
    const pt = aiMove(state.board, WHITE, tier, { ko: state.ko, history: state.history });
    if (pt === null) {
      state = passMove(state);
      refresh("星星停了一手。");
      afterMove();
      return;
    }
    const res = playMove(state, pt);
    if (!res.ok) {
      state = passMove(state);
      refresh("星星停了一手。");
      afterMove();
      return;
    }
    const before = state;
    state = res.state;
    opts.sfx(res.captured.length > 0 ? "pop" : "tap");
    if (res.captured.length > 0) animateCaptures(before, pt, res.captured, WHITE);
    else refresh(`星星下在 ${coordLabel(opts.size, pt)}。`);
    afterMove();
  }

  function enterCounting(auto = false): void {
    if (counting) return;
    counting = true;
    dead = autoDeadStones(state.board);
    passBtn.disabled = true;
    countBtn.textContent = "✅ 就这么数";
    countBtn.className = "wq-btn wq-on";
    const dameLeft = damePoints(state.board, dead).length;
    refresh(
      auto
        ? `双方都停手啦,先自动标了 ${dead.length} 颗走不掉的子。${dameLeft > 0 ? `还剩 ${dameLeft} 个单官。` : ""}点子可以改,改完按「就这么数」。`
        : "点一下走不掉的子把它标出来,改完按「就这么数」。"
    );
    countBtn.addEventListener("click", settle);
  }

  function settle(): void {
    if (!counting) return;
    const verdict = finalScore(state.board, {
      rule: opts.rule,
      dead,
      captures: state.captures,
      handicap: opts.handicap
    });
    const box = document.createElement("div");
    box.className = "wq-over";
    const t = document.createElement("div");
    t.className = "wq-over-t";
    t.textContent = verdict.winner === "draw" ? "和棋!" : verdict.winner === "black" ? "朵朵赢啦!" : "星星赢啦!";
    // 奖杯 + 目数对比双色条 + 花园收成:全是展示,分数只认 finalScore
    const trophy = document.createElement("div");
    trophy.className = "wq-trophy";
    trophy.innerHTML = trophySVG(46);
    const s = document.createElement("div");
    s.className = "wq-over-s";
    s.textContent = `${verdict.text} 贴还 ${verdict.komi}。`;
    const bars = document.createElement("div");
    bars.className = "wq-bars";
    bars.setAttribute("role", "img");
    bars.setAttribute("aria-label", `朵朵 ${verdict.black},星星 ${verdict.white}`);
    const parts = scoreBarParts(verdict.black, verdict.white);
    const barB = document.createElement("span");
    barB.className = "wq-bar-b";
    barB.style.width = `${parts.black}%`;
    const barW = document.createElement("span");
    barW.className = "wq-bar-w";
    barW.style.width = `${parts.white}%`;
    bars.append(barB, barW);
    const detail = document.createElement("div");
    detail.className = "wq-over-s";
    detail.textContent = scoreLines(state.board, {
      rule: opts.rule,
      dead,
      captures: state.captures,
      handicap: opts.handicap
    }).join("　");
    box.append(t, trophy, s, bars, detail);
    const bloomCount = harvestCount(verdict.diff);
    if (verdict.winner !== "draw" && bloomCount > 0) {
      const harvest = document.createElement("div");
      harvest.className = "wq-harvest";
      harvest.innerHTML = harvestFlowersSVG(verdict.diff, verdict.winner === "black" ? "black" : "white");
      const harvestLine = document.createElement("div");
      harvestLine.className = "wq-over-s";
      harvestLine.textContent = `花园收成:领先的目数开出 ${bloomCount} 朵小花。`;
      box.append(harvest, harvestLine);
    }
    const ok = button("好的", () => {
      box.remove();
      overlay = null;
      opts.onEnd(verdict);
    });
    ok.className = "wq-open";
    box.appendChild(ok);
    overlay = box;
    stage.appendChild(box);
    opts.sfx(verdict.winner === "black" ? "win" : "coin");
  }

  function togglePause(): void {
    paused = !paused;
    pauseBtn.textContent = paused ? "▶️ 继续 (Esc)" : "⏸️ 暂停 (Esc)";
    refresh(paused ? "先歇一会儿,回来接着下。" : "");
  }

  function onKey(e: KeyboardEvent): void {
    const act = keyAction(e.key);
    if (!act) return;
    if (act === "pause") {
      e.preventDefault();
      togglePause();
      return;
    }
    if (paused) return;
    if (act === "confirm") {
      e.preventDefault();
      tap(view.cursor);
      return;
    }
    if (act === "pass") {
      e.preventDefault();
      doPass();
      return;
    }
    e.preventDefault();
    const d = act === "up" ? [0, -1] : act === "down" ? [0, 1] : act === "left" ? [-1, 0] : [1, 0];
    view.moveCursor(d[0], d[1]);
  }

  (globalThis as { addEventListener?: typeof window.addEventListener }).addEventListener?.("keydown", onKey as EventListener);

  refresh(`${RULE_HINTS[opts.rule]} 点交叉点落子,F 确认,G 停一手。`);

  return {
    el: stage,
    state: () => state,
    play: (pt) => doPlay(pt),
    pass: () => doPass(),
    destroy: () => {
      for (const id of timers) clearTimer(id);
      timers.clear();
      (globalThis as { removeEventListener?: typeof window.removeEventListener }).removeEventListener?.(
        "keydown",
        onKey as EventListener
      );
      overlay?.remove();
      view.destroy();
      stage.remove();
    }
  };
}

function hostWidth(host: HTMLElement): number {
  const w = (host as { clientWidth?: number }).clientWidth;
  const byWidth = (() => {
    if (typeof w === "number" && w > 80) return w;
    const iw = (globalThis as { innerWidth?: number }).innerWidth;
    return typeof iw === "number" && iw > 80 ? Math.min(iw - 32, 520) : 320;
  })();
  // 平板横屏的短边是高度:棋盘按宽度铺满会把下面的按钮顶出屏,得同时受舞台高度约束。
  // 220 是棋盘上下的徽章行 + 提示语 + 按钮排的合计;量不到舞台时退回按宽度算,行为不变。
  // r5 N-10:915×412 矮横屏走「盘左、徽章/工具右」双栏,盘上下只剩自己的边距,
  // 再按 220 扣就把盘压到 240 地板还是装不下——这一档只扣 40(壳层圆角与上下留白)。
  const shortLand = (() => {
    const mq = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
    try {
      return mq ? mq("(min-width:700px) and (max-height:520px)").matches : false;
    } catch {
      return false;
    }
  })();
  const chrome = shortLand ? 40 : 220;
  const room = stagePlayRoom(host, { w: byWidth, h: byWidth + chrome });
  return Math.max(240, Math.min(byWidth, room.h - chrome));
}

// ---------------------------------------------------------------------------
// 闯关:每一关一道题
// ---------------------------------------------------------------------------

export interface PuzzleOptions {
  level: WeiqiLevel;
  sfx: (n: SoundName) => void;
  win: (stars: 1 | 2 | 3, msg?: string) => void;
  lose: (msg?: string) => void;
  /** 单测里塞同步定时器 */
  schedule?: (fn: () => void, ms: number) => number;
  unschedule?: (id: number) => void;
  /** 单测里关掉倒计时 */
  timed?: boolean;
}

export function mountPuzzle(host: HTMLElement, opts: PuzzleOptions): PlayHandle {
  const level = opts.level;
  const setTimer = opts.schedule ?? ((fn, ms) => (globalThis.setTimeout as typeof setTimeout)(fn, ms) as unknown as number);
  const clearTimer = opts.unschedule ?? ((id) => (globalThis.clearTimeout as typeof clearTimeout)(id as unknown as number));
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number): void => {
    const id = setTimer(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  const stage = document.createElement("div");
  stage.className = "wq-stage wq-wrap";
  host.appendChild(stage);
  // 选关图卷到下面选的关,进关滚回顶,抬头别被卷走
  resetStageScroll(host);

  const hud = document.createElement("div");
  hud.className = "wq-hud";
  const taskChip = chip(`${KIND_LABELS[level.kind]} · ${SIZE_LABELS[level.size]}`);
  const moveChip = chip("");
  const timeChip = chip("");
  hud.append(taskChip, moveChip, timeChip);
  stage.appendChild(hud);

  const boardHost = document.createElement("div");
  boardHost.className = "wq-boardhost";
  stage.appendChild(boardHost);

  const msg = document.createElement("div");
  msg.className = "wq-msg";
  msg.setAttribute("role", "status");
  msg.setAttribute("aria-live", "polite");
  msg.setAttribute("aria-atomic", "true");
  msg.textContent = level.task;
  const say = document.createElement("div");
  say.className = "wq-say";
  say.setAttribute("role", "status");
  say.setAttribute("aria-live", "polite");
  say.setAttribute("aria-atomic", "true");
  let said = "";

  let state = createGame({ size: level.size, board: levelBoard(level), turn: level.turn, rule: level.rule });
  let capturedTotal = 0;
  let marked: number[] = [];
  let used = 0;
  let done = false;
  let paused = false;
  let left = levelSeconds(level);
  const reduced = reducedMotion();

  const view = createBoardView(boardHost, {
    size: level.size,
    onPick: (pt) => tap(pt),
    hostWidth: () => hostWidth(host)
  });

  const tools = document.createElement("div");
  tools.className = "wq-tools";
  const passBtn = button("🖐️ 停一手 (G)", () => tapPass());
  const hintBtn = button("💡 看方法", () => {
    opts.sfx("tap");
    msg.textContent = level.hint;
  });
  const pauseBtn = button("⏸️ 暂停 (Esc)", () => togglePause());
  tools.append(passBtn, hintBtn, pauseBtn);
  if (level.size > 9) {
    let zoom = 1;
    tools.append(
      button("➖", () => view.setZoom((zoom = Math.max(1, zoom - 0.3)))),
      button("➕", () => view.setZoom((zoom = Math.min(2.6, zoom + 0.3))))
    );
  }
  stage.append(tools, msg, say);

  const note = document.createElement("div");
  note.className = "wq-note";
  note.textContent = level.kind === "markDead" ? "点一下走不掉的子就能标上,再点一下取消。" : level.hint;
  stage.appendChild(note);

  function refresh(text?: string): void {
    const last = state.moves.length ? state.moves[state.moves.length - 1].pt : null;
    view.render(state.board, { last, dead: marked, ko: state.ko });
    moveChip.textContent =
      level.kind === "markDead" ? `已标 ${marked.length} 颗` : `第 ${used} / ${level.moveBudget} 手`;
    timeChip.textContent = opts.timed === false ? level.task : `⏳ ${Math.max(0, left)} 秒`;
    if (text !== undefined) msg.textContent = text;
    const line = puzzleSay(level.kind, used, level.moveBudget, marked.length, text ?? undefined);
    if (line !== said) {
      said = line;
      say.textContent = line;
    }
  }

  function finishWin(): void {
    if (done) return;
    done = true;
    opts.sfx("win");
    const stars = starsFor(level, Math.max(1, used || marked.length));
    opts.win(stars, level.kind === "markDead" ? "标得准!这几颗确实走不掉。" : "这一手正好,漂亮!");
  }

  function finishLose(text: string): void {
    if (done) return;
    done = true;
    opts.sfx("oops");
    opts.lose(text);
  }

  function tap(pt: number): void {
    if (done || paused) return;
    if (level.kind === "markDead") {
      if (state.board.cells[pt] === EMPTY) return;
      const group = expandDead(state.board, [pt]);
      const set = new Set(marked);
      const on = group.every((p) => set.has(p));
      for (const p of group) {
        if (on) set.delete(p);
        else set.add(p);
      }
      marked = Array.from(set).sort((a, b) => a - b);
      opts.sfx("tap");
      refresh();
      if (levelCleared(level, state.board, capturedTotal, marked)) finishWin();
      return;
    }
    const res = playMove(state, pt);
    if (!res.ok) {
      opts.sfx("oops");
      refresh(ILLEGAL_TEXT[res.reason]);
      return;
    }
    const before = state;
    state = res.state;
    used++;
    capturedTotal += res.captured.length;
    opts.sfx(res.captured.length > 0 ? "pop" : "tap");
    if (res.captured.length > 0) {
      const shown = cloneGame(before);
      shown.board.cells[pt] = level.turn;
      const gone: StoneKind = other(before.turn) === BLACK ? "black" : "white";
      let i = 0;
      const step = captureStepMs(reduced);
      const tick = (): void => {
        if (i >= res.captured.length) {
          refresh(captureLine(res.captured.length, WHITE));
          settleStep();
          return;
        }
        view.burst(res.captured[i], gone);
        shown.board.cells[res.captured[i]] = EMPTY;
        i++;
        view.render(shown.board, { last: pt, dead: marked });
        later(tick, step);
      };
      view.render(shown.board, { last: pt, dead: marked });
      later(tick, step);
      return;
    }
    refresh();
    settleStep();
  }

  function settleStep(): void {
    if (levelCleared(level, state.board, capturedTotal, marked)) {
      finishWin();
      return;
    }
    if (used >= level.moveBudget) {
      finishLose("这块差一口气,下次先补一手。再来一次一定行!");
      return;
    }
    // 对局任务里星星会还手,别的题型让玩家安静地想
    if (level.kind === "battle") {
      later(() => {
        if (done || paused) return;
        const pt = aiMove(state.board, WHITE, "normal", { ko: state.ko, history: state.history });
        if (pt === null) {
          state = passMove(state);
        } else {
          const r = playMove(state, pt);
          if (r.ok) state = r.state;
          else state = passMove(state);
        }
        refresh("星星应了一手,再数一遍气。");
      }, 240);
    }
  }

  function tapPass(): void {
    if (done || paused || level.kind === "markDead") return;
    state = passMove(state);
    used++;
    opts.sfx("tap");
    refresh("停了一手。");
    settleStep();
  }

  function togglePause(): void {
    paused = !paused;
    pauseBtn.textContent = paused ? "▶️ 继续 (Esc)" : "⏸️ 暂停 (Esc)";
    refresh(paused ? "先歇一会儿,想好了再回来。" : level.task);
  }

  function onKey(e: KeyboardEvent): void {
    const act = keyAction(e.key);
    if (!act) return;
    e.preventDefault();
    if (act === "pause") {
      togglePause();
      return;
    }
    if (paused) return;
    if (act === "confirm") {
      tap(view.cursor);
      return;
    }
    if (act === "pass") {
      tapPass();
      return;
    }
    const d = act === "up" ? [0, -1] : act === "down" ? [0, 1] : act === "left" ? [-1, 0] : [1, 0];
    view.moveCursor(d[0], d[1]);
  }

  (globalThis as { addEventListener?: typeof window.addEventListener }).addEventListener?.("keydown", onKey as EventListener);

  let ticker: number | null = null;
  if (opts.timed !== false) {
    ticker = (globalThis.setInterval as typeof setInterval)(() => {
      if (done || paused) return;
      left--;
      refresh();
      if (left <= 0) finishLose("时间到啦,这一关先放一放,回头再来准能想出来!");
    }, 1000) as unknown as number;
  }

  refresh();

  return {
    destroy() {
      done = true;
      for (const id of timers) clearTimer(id);
      timers.clear();
      if (ticker !== null) (globalThis.clearInterval as typeof clearInterval)(ticker as unknown as number);
      (globalThis as { removeEventListener?: typeof window.removeEventListener }).removeEventListener?.(
        "keydown",
        onKey as EventListener
      );
      view.destroy();
      stage.remove();
    }
  };
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  return mountPuzzle(stage, {
    level: levelAt(ctx.level),
    sfx: ctx.sfx,
    win: ctx.win,
    lose: ctx.lose
  });
}

// ---------------------------------------------------------------------------
// 三个额外模式
// ---------------------------------------------------------------------------

function mountExtra(host: HTMLElement, api: GameApi, mode: ExtraMode, back: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  wrap.className = "wq-wrap";
  host.appendChild(wrap);

  const head = document.createElement("div");
  head.className = "wq-hud";
  const title = chip(MODE_LABELS[mode]);
  const backBtn = button("← 回闯关", () => {
    api.play("tap");
    back();
  });
  head.append(backBtn, title);
  wrap.appendChild(head);

  const body = document.createElement("div");
  wrap.appendChild(body);

  let match: Match | null = null;
  let size: BoardSize = 9;
  let tier: AiTier = "normal";
  let rule: ScoreRule = "chinese";
  let handicap = 0;
  let streak = 0;
  let best = save.getGameProgress(meta.id).endlessBest;

  function clear(): void {
    match?.destroy();
    match = null;
    body.textContent = "";
  }

  function setup(): void {
    clear();
    const box = document.createElement("div");
    box.className = "wq-setup";

    if (mode !== "endless") {
      const sizeRow = row(label("路数"));
      for (const s of BOARD_SIZES) {
        const b = button(SIZE_LABELS[s], () => {
          api.play("tap");
          size = s;
          if (size !== 9) handicap = 0;
          setup();
        }, size === s);
        sizeRow.appendChild(b);
      }
      box.appendChild(sizeRow);

      const ruleRow = row(label("计分"));
      for (const r of ["chinese", "japanese"] as ScoreRule[]) {
        ruleRow.appendChild(
          button(RULE_LABELS[r], () => {
            api.play("tap");
            rule = r;
            setup();
          }, rule === r)
        );
      }
      box.appendChild(ruleRow);
    }

    if (mode === "versus") {
      const tierRow = row(label("对手"));
      for (const t of AI_TIERS) {
        tierRow.appendChild(
          button(AI_TIER_LABELS[t], () => {
            api.play("tap");
            tier = t;
            setup();
          }, tier === t)
        );
      }
      box.appendChild(tierRow);
      if (size === 9) {
        const hRow = row(label("让子"));
        for (const h of [0, 2, 3]) {
          hRow.appendChild(
            button(h === 0 ? "分先" : `让 ${h} 子`, () => {
              api.play("tap");
              handicap = h;
              setup();
            }, handicap === h)
          );
        }
        box.appendChild(hRow);
      }
    }

    const note = document.createElement("div");
    note.className = "wq-note";
    note.textContent =
      mode === "versus"
        ? `${AI_TIER_HINTS[tier]} 贴还 ${komiFor(rule, handicap)}。`
        : mode === "endless"
          ? endlessLine(streak, best)
          : DUO_HINT;
    box.appendChild(note);

    const go = document.createElement("button");
    go.type = "button";
    go.className = "wq-open";
    go.textContent = mode === "endless" ? "开始连胜挑战 ▶" : "开始 ▶";
    go.addEventListener("click", () => {
      api.play("tap");
      start();
    });
    box.appendChild(go);
    body.appendChild(box);
  }

  function start(): void {
    clear();
    const useSize: BoardSize = mode === "endless" ? 9 : size;
    const useTier: AiTier | "human" = mode === "duo" ? "human" : mode === "endless" ? endlessTier(streak) : tier;
    match = createMatch(body, {
      size: useSize,
      rule: mode === "endless" ? "chinese" : rule,
      handicap: mode === "versus" ? handicap : 0,
      white: useTier,
      sfx: (n) => api.play(n),
      onEnd: (verdict) => {
        if (mode === "endless") {
          if (verdict.winner === "black") {
            streak++;
            best = save.recordEndlessBest(meta.id, streak);
            api.play("coin");
          } else {
            streak = 0;
          }
        }
        setup();
      }
    });
  }

  setup();

  return {
    destroy() {
      clear();
      wrap.remove();
    }
  };
}

// ---------------------------------------------------------------------------
// 挂载
// ---------------------------------------------------------------------------

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
  style.textContent = WQ_CSS;
  const bar = document.createElement("div");
  bar.className = "wq-modebar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", MODE_SUMMARY);
  const modeTip = document.createElement("p");
  modeTip.className = "wq-modetip";
  modeTip.textContent = MODE_SUMMARY;
  bar.appendChild(modeTip);
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  let extra: { destroy: () => void } | null = null;

  function closeExtra(): void {
    extra?.destroy();
    extra = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
  }

  MODE_KEYS.forEach((key) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wq-open";
    btn.textContent = MODE_LABELS[key];
    btn.addEventListener("click", () => {
      if (extra) return;
      api.play("tap");
      levelHost.hidden = true;
      bar.hidden = true;
      modeHost.hidden = false;
      extra = mountExtra(modeHost, api, key, closeExtra);
    });
    bar.appendChild(btn);
  });

  const level = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      // 关内把模式入口收起来:手机上这一条要占约 150px,棋盘能整个抬进首屏
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        const h = playLevel(stage, ctx);
        return {
          destroy() {
            h?.destroy?.();
            bar.hidden = false;
          }
        };
      },
      mapHint: "先数气、再看眼,最后才想劫 —— 这三步能解掉大半的题。",
      grandMessage: "188 关全部走完,九路十三路十九路都拿下啦!",
      guide,
      guideTitle: "围子花园 · 下棋笔记"
    }
  );

  return {
    destroy() {
      extra?.destroy();
      extra = null;
      level.destroy();
      root.remove();
    }
  };
}

/** 给测试钉住的关键常量与工具 */
export const WQ_CONSTS = {
  minHit9: minHitSize(9),
  minHit19: minHitSize(19),
  captureStep: captureStepMs(false),
  solutionsOf: (index: number): number[] => levelSolutions(levelAt(index)),
  emptyCount: (board: Board): number => emptyPoints(board).length,
  neighborsOf: (size: number, pt: number): number[] => neighborTable(size)[pt],
  groupSize: (board: Board, pt: number): number => groupAt(board, pt)?.stones.length ?? 0,
  parse: parseRows,
  movesFor
};
