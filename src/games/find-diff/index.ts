import { meta } from "./meta";
export { meta };

import {
  chapterOf,
  furthestPlayable,
  loadSkips,
  loadStars,
  mountLevelGame,
  rateBelow,
  TOTAL_LEVELS,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
  type SoundName,
} from "../level99";
import { save } from "../../engine/save";
import { speak, stopSpeaking, whenSpeechReady } from "../speech";
import { CHAPTERS, LEVELS, movePermutation, type DiffLevel } from "./levels";
import {
  COUNT_OFFSET,
  GLYPH_RATIO,
  buildEndlessScene,
  buildScene,
  sourceIndex,
  type CellView,
  type Scene,
} from "./scene12";
import {
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  clampPan,
  clampZoom,
  distance,
  hintArea,
  hintStageOf,
  hitRadius,
  miniCellPx,
  missCooldownMs,
  panelCellPx,
  panelCellForRoom,
  regrowCellPx,
  stageRoomPx,
  openLevelOnMap,
  parseLevelParam,
  pickForgiving,
  pickNearest,
  pinchZoom,
  resolveInitialLevel,
  shouldSuggestZoom,
  scrollToShowPx,
  viewportRoomPx,
  wrapNeedsScroll,
  TOOL_MIN_H,
  type CellCenter,
} from "./runtime";
import { BOARD_ART_CSS, glyphHTML, sceneStickersReady } from "./boardArt";
import {
  BUBBLE_MS,
  CONFETTI_TINTS,
  FDF_ART,
  HIT_SPARK_MS,
  MAG_MS,
  MISS_BUBBLE_TEXT,
  RING_MS,
  STAGE_CSS,
  badgeRowHTML,
  confettiSpecs,
  deskDoodleHTML,
  hitRingEndRadius,
  hitSparkSpecs,
  hudTimeHTML,
  magnifierFxHTML,
  seamHTML,
  seamMode,
} from "./stage13";

/** 主棋盘一格的边长上限：配合 22px 的命中半径下限，热区直径稳稳 ≥ 44px */
export const PLAY_CELL_PX = 44;
/** 图案字号下限：双胞胎替换在 360px 小屏上也得认得出 */
export const MIN_GLYPH_PX = 22;
const GAP_PX = 4;

const THEME_BG = [
  "linear-gradient(#fff4e6,#ffe8cc)",
  "linear-gradient(#e3fafc,#d3f9d8)",
  "linear-gradient(#e7f5ff,#d0f0fd)",
  "linear-gradient(#fff0f6,#ffdeeb)",
  "linear-gradient(#2b2a5e,#4a3f8f)",
  "linear-gradient(#fff9db,#fff3bf)",
  "linear-gradient(#fff5f0,#ffe9e0)",
  "linear-gradient(#eef7ff,#e0f0ff)",
  "linear-gradient(#f0fbf8,#e4f7f2)",
  "linear-gradient(#faf3ff,#f3e8ff)",
];
const THEME_ACCENT = [
  "#d9480f", "#2b8a3e", "#1971c2", "#c2255c", "#ffe066", "#e8590c",
  "#b02a37", "#1c6fb8", "#0f8a72", "#7c3aed",
];

/** 每种玩法的一句话说明（开局就告诉孩子这一关的规则变了） */
export const MODE_HINTS: Record<DiffLevel["mode"], string> = {
  classic: "定一条路线一行一行扫，上下对照着找！",
  triple: "三张图一起看：只有跟上面两张都不一样的才算数～",
  moving: "图案会自己换位置，记图案别记坐标！",
  mirror: "下图是左右翻过来的，上图最左对应下图最右～",
  rush: "一关连打好几轮，倒计时是共用的，前面省下的就是后面的余粮！",
};

/** 结算时的鼓励语：一次没错就夸眼力，错过也只肯定完成度 */
export function finishLine(misses: number, totalDiffs: number, rounds: number): string {
  if (misses === 0) return rounds > 1 ? `${rounds} 轮一次都没点错，命中率满分！` : "一次都没点错，命中率满分！";
  return rounds > 1 ? `${rounds} 轮全部完成，一共找到 ${totalDiffs} 处不同！` : `${totalDiffs} 处不同全部找到！`;
}

/** 无尽结算文案：只报到了第几轮，不批评 */
export function endlessLine(reached: number, best: number): string {
  if (reached <= 0) return "第一轮就先热个身，两图上下对照着一行一行扫，节奏找到就顺了！";
  if (reached >= best) return `马拉松跑到第 ${reached} 轮，这是你目前的最好成绩！`;
  return `马拉松跑到第 ${reached} 轮，最好成绩是第 ${best} 轮，再来一次就能追上。`;
}

/** 星级：点错一次以内 3 星，五次以内 2 星，再多也保底 1 星（点错不判负） */
export function starsFor(misses: number): 1 | 2 | 3 {
  return rateBelow(misses, 1, 5);
}

const CSS = `
.fdf-wrap{border-radius:16px;padding:10px;user-select:none;-webkit-user-select:none;touch-action:manipulation;
  font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  display:flex;flex-direction:column;gap:8px;align-items:center;}
.fdf-top{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;}
.fdf-badge{font-size:14px;font-weight:800;background:#ffffffd9;border-radius:999px;padding:5px 11px;
  box-shadow:0 2px 6px rgba(120,120,160,.2);white-space:nowrap;}
.fdf-viewport{position:relative;overflow:hidden;width:100%;border-radius:14px;touch-action:none;
  overscroll-behavior:contain;}
.fdf-zoom{transform-origin:center center;will-change:transform;}
.fdf-panels{display:flex;flex-direction:column;gap:8px;width:100%;align-items:center;}
.fdf-row{display:flex;gap:6px;flex-wrap:nowrap;justify-content:center;}
.fdf-panel{background:#ffffffec;border-radius:14px;padding:6px;box-shadow:0 3px 10px rgba(120,120,160,.18);}
.fdf-split{width:86%;height:3px;border-radius:3px;background:linear-gradient(90deg,#ffd8e6,#c5b3f0,#ffd8e6);}
.fdf-label{text-align:center;font-size:12px;font-weight:800;color:#8a7aa8;margin-bottom:3px;}
.fdf-grid{display:grid;gap:${GAP_PX}px;}
.fdf-cell{position:relative;border:none;border-radius:10px;background:#f6f2fb;padding:0;overflow:visible;
  display:block;font-family:inherit;}
.fdf-cell-play{cursor:pointer;}
.fdf-glyph{position:absolute;left:50%;top:50%;line-height:1;pointer-events:none;}
.fdf-cell.fdf-found::after{content:"";position:absolute;inset:6%;border:3px solid #f4b942;border-radius:50%;
  box-shadow:0 0 0 2px #ffffffc0 inset;}
.fdf-cell.fdf-hintarea{background:#fff3bf;}
.fdf-cell.fdf-hintspot{background:#ffe066;animation:fdfBlink .7s 3;}
@keyframes fdfBlink{50%{background:#ffd43b;}}
.fdf-cell.fdf-slide{animation:fdfSlide .45s;}
@keyframes fdfSlide{from{transform:translateX(-10px);opacity:.35}to{transform:translateX(0);opacity:1}}
.fdf-ripple{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;pointer-events:none;
  border:3px solid rgba(140,140,150,.6);animation:fdfRipple .6s ease-out forwards;}
@keyframes fdfRipple{from{transform:scale(.35);opacity:.9}to{transform:scale(1.15);opacity:0}}
.fdf-confetti{font-size:20px;letter-spacing:6px;animation:fdfPop .6s ease-out;}
@keyframes fdfPop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
.fdf-msg{min-height:20px;font-size:14px;font-weight:800;text-align:center;line-height:1.4;}
.fdf-tools{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;}
/* 两张图收到底线仍装不下时（横屏 640×360）由 fitViewport() 挂上这一档：
   整屏自己滚，翻到底不许把外面那层也带着走。两张图那一格有自己的滚动条与
   touch-action，手指落在图上仍旧是拖图 / 捏合，不会误滚外层。 */
.fdf-wrap.fdf-scroll{overscroll-behavior:contain;}
/* display:flex 会盖掉浏览器自带的 [hidden]{display:none}，这里补回来 */
.fdf-tools[hidden]{display:none;}
.fdf-btn{border:none;border-radius:999px;padding:8px 16px;font-size:15px;font-weight:900;cursor:pointer;
  min-height:44px;color:#fff;background:linear-gradient(180deg,#74c0fc,#4dabf7);box-shadow:0 4px 0 #1c7ed6;
  font-family:inherit;white-space:nowrap;}
.fdf-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #1c7ed6;}
.fdf-btn:disabled{opacity:.45;}
.fdf-btn-ghost{color:#7a5aa0;background:#ffffffe6;box-shadow:0 4px 0 rgba(120,90,160,.3);}
.fdf-btn-ghost:active{box-shadow:0 2px 0 rgba(120,90,160,.3);}
.fdf-zoomrow{display:flex;gap:6px;align-items:center;font-size:14px;font-weight:800;color:#7a5aa0;
  min-height:${TOOL_MIN_H}px;}
/* 滑杆默认只有 16px 高，比手指按得准的下限矮 28px；旁边那颗提示键已经是 44 了 */
.fdf-zoomrow input{width:110px;height:${TOOL_MIN_H}px;}
.fdf-cell:focus-visible,.fdf-btn:focus-visible{outline:3px solid #3c2a6b;outline-offset:2px;}
@media (max-width:380px){
  .fdf-wrap{padding:8px;}
  .fdf-zoomrow input{width:88px;}
}
@media (prefers-reduced-motion:reduce){
  .fdf-cell.fdf-slide,.fdf-cell.fdf-hintspot,.fdf-ripple,.fdf-confetti{animation:none;}
  .fdf-ripple{opacity:0;}
}
`;

function prefersReducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return typeof mm === "function" && mm("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** 把一格的外观画出来：底色 + 一到两个图案（缩放 / 左右翻 / 格内位移都在这里落地） */
function paintCell(el: HTMLElement, view: CellView, px: number, art: boolean): void {
  el.style.background = view.tint ?? "";
  const font = Math.max(MIN_GLYPH_PX, Math.round(px * GLYPH_RATIO));
  const parts: string[] = [];
  for (let k = 0; k < view.count; k++) {
    const spread = view.count > 1 ? (k === 0 ? -COUNT_OFFSET : COUNT_OFFSET) : 0;
    const tx = (view.dx + spread) * px;
    const ty = view.dy * px;
    // W8R1-04：贴纸与 emoji 走同一份字号 + transform，六种差异维度照样成立；
    // 门控关闸（图集没配齐的章节）输出与 1.2 逐字节一致
    const style = `font-size:${font}px;transform:translate(-50%,-50%) translate(${tx.toFixed(
      1
    )}px,${ty.toFixed(1)}px) scale(${view.scale.toFixed(2)}) scaleX(${view.flip ? -1 : 1})`;
    parts.push(art ? glyphHTML(view.emoji, font, style) : `<span class="fdf-glyph" style="${style}">${view.emoji}</span>`);
  }
  el.innerHTML = parts.join("");
}

interface RunnerOptions {
  scene: Scene;
  /** 上图/下图的标题 */
  playLabel: string;
  sfx: (name: SoundName) => void;
  /** 找到一处（已找到数, 总数） */
  onProgress?: (found: number, total: number) => void;
  /** 全部找齐 */
  onCleared: (misses: number) => void;
}

interface Runner {
  root: HTMLElement;
  /** 顶部 HUD 里留给调用方的位置（连环的轮次、倒计时都塞这里） */
  hud: HTMLElement;
  msg: HTMLElement;
  misses: () => number;
  setMessage: (text: string) => void;
  /** 旋转灯塔：整块棋盘换一次位置 */
  shuffleTo: (step: number) => void;
  freeze: () => void;
  destroy: () => void;
}

/**
 * 一张（或三张）图的对照玩法：渲染 + 缩放 + 命中判定 + 温和惩罚 + 两级提示。
 * 闯关与无尽共用这一套，区别只在外面谁来计时、谁来结算。
 */
function createRunner(host: HTMLElement, opts: RunnerOptions): Runner {
  const scene = opts.scene;
  const n = scene.rows * scene.cols;
  const answers = new Set(scene.diffIdx);
  const foundSet = new Set<number>();
  const reduced = prefersReducedMotion();
  // W8R1-04：整关门控——盘面每种图案都有贴纸才换装，绝不出半贴纸半 emoji 的混排图
  const artOn = sceneStickersReady(scene);

  let frozen = false;
  let cooling = false;
  let missCount = 0;
  let hintPress = 0;
  let hintsLeft = scene.hints;
  let zoom = ZOOM_MIN;
  let panX = 0;
  let panY = 0;
  let perm = movePermutation(scene.rows, scene.cols, 0);

  const view = globalThis as { innerHeight?: number; innerWidth?: number };
  const triple = scene.second !== null;
  // 竖屏上下两图各占约 40% 高度，中间留 UI 条：格子按屏高摊，两张图始终同时可见
  let playPx = panelCellPx(scene.rows, view.innerHeight ?? 640, PLAY_CELL_PX);
  const miniPx = triple ? miniCellPx(scene.cols, view.innerWidth ?? 360) : playPx;

  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!frozen) fn();
    }, ms);
    timeouts.add(t);
  }

  const root = document.createElement("div");
  root.className = "fdf-wrap fdf-desk";
  root.innerHTML = `
    <div class="fdf-deco">${deskDoodleHTML()}</div>
    <div class="fdf-top">
      <span class="fdf-badge fdf-count">🔍 0/${scene.diffIdx.length}</span>
      <span class="fdf-badges" aria-hidden="true"></span>
      <span class="fdf-badge fdf-hud"></span>
    </div>
    <div class="fdf-viewport"><div class="fdf-zoom"><div class="fdf-panels"></div></div></div>
    <div class="fdf-msg"></div>
    <div class="fdf-tools">
      <button type="button" class="fdf-btn fdf-hint"></button>
      <span class="fdf-zoomrow">🔎<input type="range" class="fdf-zoomer" min="${ZOOM_MIN}" max="${ZOOM_MAX}"
        step="${ZOOM_STEP}" value="${ZOOM_MIN}" aria-label="放大镜倍数"><span class="fdf-zoomval">1.0×</span></span>
      <button type="button" class="fdf-btn fdf-btn-ghost fdf-say" hidden>🔈 再听一遍</button>
    </div>
  `;
  host.appendChild(root);
  // 屏高只是上限，真正能用的是舞台裁切线以内那一段——两者取小的那个
  playPx = Math.min(playPx, panelCellForRoom(scene.rows, stageRoomPx(root), PLAY_CELL_PX));

  const countEl = root.querySelector(".fdf-count") as HTMLElement;
  const hudEl = root.querySelector(".fdf-hud") as HTMLElement;
  const badgesEl = root.querySelector(".fdf-badges") as HTMLElement;
  const viewport = root.querySelector(".fdf-viewport") as HTMLElement;
  const zoomBox = root.querySelector(".fdf-zoom") as HTMLElement;
  const panelsEl = root.querySelector(".fdf-panels") as HTMLElement;
  const msgEl = root.querySelector(".fdf-msg") as HTMLElement;
  const toolsEl = root.querySelector(".fdf-tools") as HTMLElement;
  const hintBtn = root.querySelector(".fdf-hint") as HTMLButtonElement;
  const zoomer = root.querySelector(".fdf-zoomer") as HTMLInputElement;
  const zoomVal = root.querySelector(".fdf-zoomval") as HTMLElement;
  hudEl.hidden = true;

  // 暖色滤镜层与命中动画层：都盖在两张图上方、都不吃点击（视觉层不许挡玩法）
  const warmth = document.createElement("div");
  warmth.className = "fdf-warmth";
  const fxLayer = document.createElement("div");
  fxLayer.className = "fdf-fxlayer";
  viewport.append(warmth, fxLayer);

  /** 侦探徽章排：点亮数 = 已找到数，总数 = 该关差异总数（只读题目数据） */
  function renderBadges(flashNewest: boolean): void {
    badgesEl.innerHTML = badgeRowHTML(foundSet.size, scene.diffIdx.length, flashNewest && !reduced);
  }

  // --- 棋盘 -----------------------------------------------------------------

  function makeGrid(px: number): HTMLElement {
    const grid = document.createElement("div");
    grid.className = "fdf-grid";
    grid.style.gridTemplateColumns = `repeat(${scene.cols},${px}px)`;
    grid.style.gridAutoRows = `${px}px`;
    return grid;
  }

  function makePanel(label: string, px: number): { panel: HTMLElement; grid: HTMLElement } {
    const panel = document.createElement("div");
    // 木质画框只是相框皮肤：格子网格的坐标与尺寸一个像素不动
    panel.className = "fdf-panel fdf-framed";
    const cap = document.createElement("div");
    cap.className = "fdf-label fdf-plaque";
    cap.textContent = label;
    const grid = makeGrid(px);
    panel.append(cap, grid);
    return { panel, grid };
  }

  const refGrids: HTMLElement[] = [];
  const refCells: HTMLElement[][] = [];
  let playCells: HTMLButtonElement[] = [];

  if (triple) {
    const row = document.createElement("div");
    row.className = "fdf-row";
    const a = makePanel("图 ①", miniPx);
    const b = makePanel("图 ②", miniPx);
    row.append(a.panel, b.panel);
    panelsEl.appendChild(row);
    refGrids.push(a.grid, b.grid);
  } else {
    const top = makePanel(scene.mirrored ? "原图（下面是它的镜子像）" : "原图（看这里）", playPx);
    panelsEl.appendChild(top.panel);
    refGrids.push(top.grid);
  }
  const split = document.createElement("div");
  split.className = "fdf-split";
  // 中缝装饰：窄屏（上下排布）顶部麻绳横挂，宽屏麻绳短段 + 两个别针连框
  const seam = seamMode(view.innerWidth ?? 360);
  split.classList.add("fdf-seam", `fdf-seam-${seam}`);
  split.innerHTML = seamHTML(seam);
  panelsEl.appendChild(split);
  const play = makePanel(opts.playLabel, playPx);
  panelsEl.appendChild(play.panel);
  const playGrid = play.grid;

  function fillRef(grid: HTMLElement, cells: CellView[], gi: number, px: number, slide: boolean): void {
    grid.innerHTML = "";
    refCells[gi] = [];
    perm.forEach((src) => {
      const cell = document.createElement("div");
      cell.className = `fdf-cell${slide ? " fdf-slide" : ""}`;
      paintCell(cell, cells[src], px, artOn);
      grid.appendChild(cell);
      refCells[gi][src] = cell;
    });
  }

  function fillPlay(slide: boolean): void {
    playGrid.innerHTML = "";
    playCells = [];
    perm.forEach((src, pos) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `fdf-cell fdf-cell-play${slide ? " fdf-slide" : ""}`;
      paintCell(btn, scene.right[src], playPx, artOn);
      btn.setAttribute("aria-label", `第 ${Math.floor(pos / scene.cols) + 1} 行第 ${(pos % scene.cols) + 1} 个`);
      // 鼠标/手指走 viewport 上的几何命中判定（有容差）；这里只接键盘敲出来的 click
      btn.addEventListener("click", (ev) => {
        if ((ev as MouseEvent).detail !== 0) return;
        attempt(src);
      });
      playGrid.appendChild(btn);
      playCells[src] = btn;
    });
    for (const src of foundSet) markFound(src);
  }

  function paintAll(slide: boolean): void {
    refGrids.forEach((grid, gi) => {
      const cells = gi === 0 ? scene.left : scene.second ?? scene.left;
      fillRef(grid, cells, gi, triple ? miniPx : playPx, slide);
    });
    fillPlay(slide);
  }

  /** 找到的点在两图上都打圈；没找到的绝不提前显形 */
  function markFound(src: number): void {
    playCells[src]?.classList.add("fdf-found");
    const mirrorSrc = sourceIndex(scene, src);
    for (const row of refCells) row[mirrorSrc]?.classList.add("fdf-found");
  }

  // --- 缩放与平移（两图在同一个 .fdf-zoom 里，天然联动） ----------------------

  function applyTransform(): void {
    const w = viewport.clientWidth || 320;
    const h = viewport.clientHeight || 320;
    panX = clampPan(panX, zoom, w);
    panY = clampPan(panY, zoom, h);
    zoomBox.style.transform = `translate(${panX.toFixed(1)}px,${panY.toFixed(1)}px) scale(${zoom.toFixed(2)})`;
    zoomer.value = String(zoom);
    zoomVal.textContent = `${zoom.toFixed(1)}×`;
  }

  function setZoom(next: number): void {
    zoom = clampZoom(next);
    if (zoom <= ZOOM_MIN + 1e-9) {
      panX = 0;
      panY = 0;
    }
    applyTransform();
    syncTouchAction();
  }

  /**
   * 1× 时 `clampPan()` 的行程本来就是 0，拖也拖不动——把这一档让给滚动，
   * 手指才推得动上面钳出来的那条滚动条；一旦放大，平移又比滚动要紧，收回来。
   */
  function syncTouchAction(): void {
    viewport.style.touchAction = zoom <= ZOOM_MIN + 1e-9 ? "pan-y" : "none";
  }

  /** 舞台矮到工具条掉出裁切线时，把两张图那一块钳矮、让它自己挂滚动条 */
  function fitViewport(): void {
    viewport.style.maxHeight = "";
    viewport.style.overflowY = "";
    root.classList.remove("fdf-scroll");
    root.style.maxHeight = "";
    root.style.overflowY = "";
    const room = stageRoomPx(root);
    const next = viewportRoomPx(root.scrollHeight, viewport.offsetHeight, room);
    if (next !== null) {
      viewport.style.maxHeight = `${next}px`;
      viewport.style.overflowY = "auto";
    }
    // 两张图收到底线还是装不下（横屏 640×360）：让整屏自己滚，
    // 并顺手把工具条送进眼里——提示键是这一款唯一的救济（W5R3-C-04）
    if (!wrapNeedsScroll(root.scrollHeight, room)) return;
    root.classList.add("fdf-scroll");
    root.style.maxHeight = `${Math.floor(room)}px`;
    root.style.overflowY = "auto";
    const r = toolsEl.getBoundingClientRect();
    const top = r.top - root.getBoundingClientRect().top + root.scrollTop;
    root.scrollTop = scrollToShowPx(top, top + r.height, root.clientHeight, root.scrollHeight - root.clientHeight);
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;
  let pinchZoomStart = ZOOM_MIN;
  let dragFrom: { x: number; y: number; panX: number; panY: number } | null = null;
  let tap: { x: number; y: number; t: number; moved: number } | null = null;

  const onPointerDown = (ev: PointerEvent): void => {
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    viewport.setPointerCapture?.(ev.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = distance(a.x, a.y, b.x, b.y);
      pinchZoomStart = zoom;
      tap = null;
      dragFrom = null;
      return;
    }
    dragFrom = { x: ev.clientX, y: ev.clientY, panX, panY };
    tap = { x: ev.clientX, y: ev.clientY, t: Date.now(), moved: 0 };
  };

  const onPointerMove = (ev: PointerEvent): void => {
    if (!pointers.has(ev.pointerId)) return;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      setZoom(pinchZoom(pinchZoomStart, pinchDist, distance(a.x, a.y, b.x, b.y)));
      return;
    }
    if (tap) tap.moved = Math.max(tap.moved, distance(tap.x, tap.y, ev.clientX, ev.clientY));
    if (dragFrom && zoom > ZOOM_MIN + 1e-9) {
      panX = dragFrom.panX + (ev.clientX - dragFrom.x);
      panY = dragFrom.panY + (ev.clientY - dragFrom.y);
      applyTransform();
    }
  };

  const onPointerUp = (ev: PointerEvent): void => {
    pointers.delete(ev.pointerId);
    viewport.releasePointerCapture?.(ev.pointerId);
    const t = tap;
    tap = null;
    dragFrom = null;
    if (pointers.size > 0 || !t) return;
    if (t.moved > 10 || Date.now() - t.t > 700) return;
    hitAt(ev.clientX, ev.clientY);
  };

  const onPointerCancel = (ev: PointerEvent): void => {
    pointers.delete(ev.pointerId);
    tap = null;
    dragFrom = null;
  };

  const onWheel = (ev: WheelEvent): void => {
    ev.preventDefault();
    setZoom(zoom + (ev.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  };

  const onZoomer = (): void => setZoom(Number(zoomer.value));

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", onPointerUp);
  viewport.addEventListener("pointercancel", onPointerCancel);
  viewport.addEventListener("wheel", onWheel, { passive: false });
  zoomer.addEventListener("input", onZoomer);

  // --- 命中判定 -------------------------------------------------------------

  /** 屏幕坐标 →（有容差的）格子：半径内取最近的那个 */
  function hitAt(clientX: number, clientY: number): void {
    const centers: CellCenter[] = [];
    let width = playPx * zoom;
    playCells.forEach((btn, index) => {
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      if (r.width > 0) width = r.width;
      centers.push({ index, cx: r.left + r.width / 2, cy: r.top + r.height / 2 });
    });
    const radius = hitRadius(width);
    // 格子撑得到 44px 就一格一格如实判；撑不到的矮屏上把这片热区让给答案格（W5R2-C-09）
    const hit =
      width >= PLAY_CELL_PX
        ? pickNearest(centers, clientX, clientY, radius)
        : pickForgiving(centers, clientX, clientY, radius, (i) => answers.has(i) && !foundSet.has(i));
    if (hit === null) return;
    attempt(hit, clientX, clientY);
  }

  const missTimes: number[] = [];

  /** 视口内某个屏幕坐标换算到命中动画层里（层随内容滚动，得补上滚动量） */
  function fxPoint(clientX: number, clientY: number): { x: number; y: number } {
    const box = viewport.getBoundingClientRect();
    return { x: clientX - box.left + viewport.scrollLeft, y: clientY - box.top + viewport.scrollTop };
  }

  /**
   * 命中仪式（纯装饰层）：放大镜从画框外滑到差异点（260ms）→ 虚线圈从 28px
   * 收紧到**命中判定半径**并转一圈定格（300ms）→ 星屑 3 颗。
   * reduced：全部跳过，靠 markFound 的金圈直接显示。
   */
  function hitFx(src: number): void {
    if (reduced) return;
    const btn = playCells[src];
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    if (!(r.width > 0)) return;
    const { x, y } = fxPoint(r.left + r.width / 2, r.top + r.height / 2);
    const mag = document.createElement("div");
    mag.className = "fdf-mag";
    mag.style.left = `${x.toFixed(1)}px`;
    mag.style.top = `${y.toFixed(1)}px`;
    mag.innerHTML = `${magnifierFxHTML()}<span class="fdf-maglens"></span>`;
    const ring = document.createElement("div");
    ring.className = "fdf-hitring";
    ring.style.left = `${x.toFixed(1)}px`;
    ring.style.top = `${y.toFixed(1)}px`;
    // 收圈终态直径 = 判定半径 × 2：画出来的圈就是判定的圈（乘上当下的实际格宽）
    ring.style.setProperty("--fdf-ring-d", `${(hitRingEndRadius(r.width) * 2).toFixed(1)}px`);
    const stars = document.createElement("div");
    stars.className = "fdf-fxstar";
    stars.style.left = `${x.toFixed(1)}px`;
    stars.style.top = `${y.toFixed(1)}px`;
    for (const s of hitSparkSpecs(Math.random)) {
      const sp = document.createElement("span");
      sp.className = "fdf-spark";
      sp.textContent = "✦";
      sp.style.color = FDF_ART.foundGold;
      sp.style.fontSize = `${s.sizePx}px`;
      sp.style.animationDelay = `${MAG_MS + s.delayMs}ms`;
      sp.style.setProperty("--fdf-spark-dx", `${s.dx}px`);
      sp.style.setProperty("--fdf-spark-dy", `${s.dy}px`);
      stars.appendChild(sp);
    }
    fxLayer.append(mag, ring, stars);
    later(() => ring.classList.add("fdf-hitring-done"), MAG_MS + RING_MS);
    later(() => mag.remove(), MAG_MS + RING_MS + 160);
    later(() => ring.remove(), MAG_MS + RING_MS + 420);
    later(() => stars.remove(), MAG_MS + HIT_SPARK_MS + 220);
  }

  /**
   * 点错反馈（不吓人版）：小问号气泡 + 一圈灰色涟漪。不闪红、不扣分，
   * 冷却与文案逻辑照旧。reduced：只显一帧静态气泡，涟漪不画。
   */
  function missFx(clientX?: number, clientY?: number): void {
    if (clientX === undefined || clientY === undefined) return;
    const { x, y } = fxPoint(clientX, clientY);
    const bubble = document.createElement("div");
    bubble.className = "fdf-bubble";
    bubble.textContent = MISS_BUBBLE_TEXT;
    bubble.style.left = `${x.toFixed(1)}px`;
    bubble.style.top = `${y.toFixed(1)}px`;
    fxLayer.appendChild(bubble);
    later(() => bubble.remove(), reduced ? 420 : BUBBLE_MS + 380);
    if (reduced) return;
    const dot = document.createElement("div");
    dot.className = "fdf-ripple";
    dot.style.left = `${x.toFixed(1)}px`;
    dot.style.top = `${y.toFixed(1)}px`;
    fxLayer.appendChild(dot);
    later(() => dot.remove(), 650);
  }

  function attempt(index: number, clientX?: number, clientY?: number): void {
    if (frozen || cooling || foundSet.has(index)) return;
    if (answers.has(index)) {
      foundSet.add(index);
      markFound(index);
      hitFx(index);
      renderBadges(true);
      opts.sfx("coin");
      countEl.textContent = `🔍 ${foundSet.size}/${scene.diffIdx.length}`;
      msgEl.textContent = "找到一处！👀 同一片区域常常还藏着第二处～";
      opts.onProgress?.(foundSet.size, scene.diffIdx.length);
      if (foundSet.size >= scene.diffIdx.length) {
        celebrate();
        opts.onCleared(missCount);
      }
      return;
    }
    // 点错：不扣分、不扣时、更不会失败，只是短暂冷却 + 一圈涟漪
    missCount++;
    const now = Date.now();
    missTimes.push(now);
    if (missTimes.length > 16) missTimes.shift();
    const cool = missCooldownMs(missTimes, now);
    cooling = true;
    later(() => {
      cooling = false;
    }, cool);
    opts.sfx("tap");
    missFx(clientX, clientY);
    msgEl.textContent =
      cool > 600
        ? "慢一点点～停半秒，挑一行从左往右仔细比，比乱扫快得多。"
        : triple
          ? "这一格只跟其中一张不同，要三张都对上才算～"
          : scene.mirrored
            ? "左右是反的，换成镜子里的位置再对一次～"
            : "这一格上下一致，换成一列一列竖着比试试～";
  }

  /** 全部找到：中缝贴「完全一致!」缎带 + 彩纸 16 粒；reduced 只留静态缎带 */
  function celebrate(): void {
    const ribbon = document.createElement("div");
    ribbon.className = "fdf-ribbon";
    ribbon.textContent = "完全一致!";
    split.replaceWith(ribbon);
    later(() => ribbon.replaceWith(split), 1500);
    if (reduced) return;
    const cx = (viewport.clientWidth || 320) / 2;
    for (const c of confettiSpecs(Math.random)) {
      const paper = document.createElement("span");
      paper.className = "fdf-paper";
      paper.style.left = `${cx.toFixed(1)}px`;
      paper.style.background = CONFETTI_TINTS[c.tint];
      paper.style.animationDelay = `${c.delayMs}ms`;
      paper.style.setProperty("--fdf-paper-dx", `${c.dx}px`);
      paper.style.setProperty("--fdf-paper-fall", `${c.fall}px`);
      paper.style.setProperty("--fdf-paper-spin", `${c.spin}deg`);
      fxLayer.appendChild(paper);
      later(() => paper.remove(), c.delayMs + 900);
    }
  }

  // --- 两级提示 -------------------------------------------------------------

  function refreshHintBtn(): void {
    if (hintsLeft <= 0 && hintStageOf(hintPress + 1) === "area") {
      hintBtn.textContent = "🔎 提示用完啦（不影响过关）";
      hintBtn.disabled = true;
      return;
    }
    hintBtn.textContent =
      hintStageOf(hintPress + 1) === "area" ? `🔎 圈出大致区域（${hintsLeft} 次）` : "🎯 再点一次精确指出";
  }

  hintBtn.addEventListener("click", () => {
    if (frozen || hintBtn.disabled) return;
    const remaining = scene.diffIdx.filter((i) => !foundSet.has(i));
    if (remaining.length === 0) return;
    const target = remaining[0];
    const stage = hintStageOf(hintPress + 1);
    if (stage === "area" && hintsLeft <= 0) return;
    hintPress++;
    opts.sfx("pop");
    if (stage === "area") {
      hintsLeft--;
      const area = hintArea(target, scene.rows, scene.cols);
      for (const i of area) playCells[i]?.classList.add("fdf-hintarea");
      msgEl.textContent = "范围就在这一片 3×3 里，先自己找找看；再点一次才精确指出。";
      later(() => {
        for (const i of area) playCells[i]?.classList.remove("fdf-hintarea");
      }, 2600);
    } else {
      playCells[target]?.classList.add("fdf-hintspot");
      msgEl.textContent = "就是这一格，点它！";
      later(() => playCells[target]?.classList.remove("fdf-hintspot"), 2600);
    }
    refreshHintBtn();
  });

  // --- 起手 -----------------------------------------------------------------

  paintAll(false);
  applyTransform();
  syncTouchAction();
  refreshHintBtn();
  renderBadges(false);
  msgEl.textContent = shouldSuggestZoom(playPx, zoom)
    ? "格子有点小，可以两根手指放大，两张图会一起放大～"
    : "";
  fitViewport();
  const win = root.ownerDocument?.defaultView ?? null;
  // 平台顶栏 `.l99-stagebar` 在窄屏上会折行，折之前和折之后这一屏的起点差好几像素。
  // 量在折行之前就会以为「装得下」而整屏不钳——320×568 上实测正是这一幕：
  // `.fdf-wrap` 382px、可视段 330px，兜底却一次都没触发（W5R3-C-04）。
  // 下一帧再量一次才准；拿不到 rAF（测试桩 / SSR）就安静跳过。
  let liveFit = true;
  const raf = win?.requestAnimationFrame;
  if (typeof raf === "function") {
    raf.call(win, () => {
      if (!liveFit) return;
      // 挂载那一刻面板还空着,随内容长高的裁切祖先量出的余量偏小,格子被
      // 冤枉地钳到 26px;真实布局出来后按同一套公式复算,只放大不缩小
      const grown = regrowCellPx(playPx, scene.rows, view.innerHeight ?? 640, stageRoomPx(root), PLAY_CELL_PX);
      if (grown !== null && foundSet.size === 0) {
        playPx = grown;
        // 格子盒子的尺寸在 grid 模板上,重填内容前得把模板一起改大
        for (const grid of triple ? [playGrid] : [playGrid, ...refGrids]) {
          grid.style.gridTemplateColumns = `repeat(${scene.cols},${playPx}px)`;
          grid.style.gridAutoRows = `${playPx}px`;
        }
        paintAll(false);
        msgEl.textContent = shouldSuggestZoom(playPx, zoom)
          ? "格子有点小，可以两根手指放大，两张图会一起放大～"
          : "";
      }
      fitViewport();
    });
  }
  win?.addEventListener("resize", fitViewport);

  return {
    root,
    hud: hudEl,
    msg: msgEl,
    misses: () => missCount,
    setMessage: (text: string) => {
      msgEl.textContent = text;
    },
    shuffleTo(step: number) {
      perm = movePermutation(scene.rows, scene.cols, step);
      paintAll(true);
    },
    freeze() {
      frozen = true;
    },
    destroy() {
      frozen = true;
      liveFit = false;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerUp);
      viewport.removeEventListener("pointercancel", onPointerCancel);
      viewport.removeEventListener("wheel", onWheel);
      zoomer.removeEventListener("input", onZoomer);
      win?.removeEventListener("resize", fitViewport);
      pointers.clear();
      // 放大镜、收圈、气泡、彩纸全在这一层里；它们的收尸计时也都挂在 timeouts 上，
      // 上面已经清空，这里再把节点清干净，离场即归零
      fxLayer.textContent = "";
      zoom = ZOOM_MIN;
      panX = 0;
      panY = 0;
      root.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 闯关
// ---------------------------------------------------------------------------

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: DiffLevel = LEVELS[ctx.level];
  const rounds = Math.max(1, cfg.rounds);
  let roundIndex = 0;
  let runner: Runner | null = null;
  let timerId: ReturnType<typeof setInterval> | null = null;
  let moveId: ReturnType<typeof setInterval> | null = null;
  let moveStep = 0;
  let timeLeft = cfg.timeSec;
  let missTotal = 0;
  let foundTotal = 0;
  let ended = false;
  let destroyed = false;
  const nextRoundTimers = new Set<ReturnType<typeof setTimeout>>();

  const board = document.createElement("div");
  board.style.background = THEME_BG[cfg.theme];
  board.style.borderRadius = "16px";
  stage.appendChild(board);

  const askLine =
    cfg.mode === "rush"
      ? `一共 ${rounds} 轮，每轮找出 ${cfg.diffs} 个不一样的地方！`
      : `找出下面 ${cfg.diffs} 个不一样的地方，找到就点它！`;

  const unwatchSpeech = whenSpeechReady(() => {
    const say = runner?.root.querySelector(".fdf-say") as HTMLButtonElement | null;
    if (say) say.hidden = false;
    if (!destroyed && !ended) speak(askLine);
  });

  function stopTimers(): void {
    if (timerId) clearInterval(timerId);
    if (moveId) clearInterval(moveId);
    timerId = null;
    moveId = null;
  }

  function updateHud(): void {
    if (!runner) return;
    const bits: string[] = [];
    if (rounds > 1) bits.push(`🎬 第 ${roundIndex + 1}/${rounds} 轮`);
    // 计时逻辑原封不动，这里只把剩余时间画成沙漏（流沙比例 = 剩余 / 总时长）
    if (cfg.timeSec > 0) bits.push(hudTimeHTML(timeLeft, cfg.timeSec));
    runner.hud.innerHTML = bits.join("　");
    runner.hud.hidden = bits.length === 0;
  }

  function finish(): void {
    ended = true;
    stopTimers();
    runner?.freeze();
    ctx.win(starsFor(missTotal), finishLine(missTotal, foundTotal, rounds));
  }

  function startRound(slide: boolean): void {
    runner?.destroy();
    moveStep = 0;
    const scene = buildScene(ctx.level, roundIndex);
    runner = createRunner(board, {
      scene,
      playLabel:
        cfg.mode === "triple"
          ? `图 ③：跟上面两张都不同的有 ${cfg.diffs} 个，点它！`
          : `找出下图不一样的 ${cfg.diffs} 个地方，点它！`,
      sfx: ctx.sfx,
      onProgress: () => {
        foundTotal++;
      },
      onCleared: (misses) => {
        missTotal += misses;
        if (roundIndex + 1 < rounds) {
          const t = setTimeout(() => {
            nextRoundTimers.delete(t);
            if (destroyed || ended) return;
            roundIndex++;
            startRound(true);
            runner?.setMessage(`第 ${roundIndex + 1} 轮开始，保持刚才的扫描节奏！`);
          }, 600);
          nextRoundTimers.add(t);
        } else {
          const t = setTimeout(() => {
            nextRoundTimers.delete(t);
            if (destroyed || ended) return;
            finish();
          }, 450);
          nextRoundTimers.add(t);
        }
      },
    });
    const say = runner.root.querySelector(".fdf-say") as HTMLButtonElement;
    say.addEventListener("click", () => speak(askLine));
    if (!slide) {
      runner.setMessage(
        cfg.lookalike && cfg.mode === "classic"
          ? "这一关有长得很像的一对，盯细节：数量、缺口、朝向～"
          : MODE_HINTS[cfg.mode]
      );
    }
    updateHud();
    if (cfg.moveEverySec > 0) {
      if (moveId) clearInterval(moveId);
      moveId = setInterval(() => {
        if (destroyed || ended) return;
        moveStep++;
        runner?.shuffleTo(moveStep);
        ctx.sfx("tap");
      }, cfg.moveEverySec * 1000);
    }
  }

  startRound(false);

  // 连环挑战：倒计时几轮共用，中途换轮不重置
  if (cfg.timeSec > 0) {
    timerId = setInterval(() => {
      if (destroyed || ended) return;
      timeLeft--;
      updateHud();
      if (timeLeft <= 0) {
        ended = true;
        stopTimers();
        runner?.freeze();
        ctx.lose("时间到～开局先花两秒整体扫一遍再动手，速度会明显提上来！");
      }
    }, 1000);
  }

  return {
    destroy() {
      destroyed = true;
      ended = true;
      unwatchSpeech();
      stopSpeaking();
      stopTimers();
      nextRoundTimers.forEach((t) => clearTimeout(t));
      nextRoundTimers.clear();
      runner?.destroy();
      runner = null;
      board.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 无尽：找不同马拉松
// ---------------------------------------------------------------------------

function mountEndless(host: HTMLElement, api: GameApi, onBack: () => void): { destroy: () => void } {
  const wrap = document.createElement("div");
  const bar = document.createElement("div");
  bar.className = "fdf-tools";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "fdf-btn fdf-btn-ghost";
  back.textContent = "◀ 回选关";
  const chip = document.createElement("span");
  chip.className = "fdf-badge";
  bar.append(back, chip);
  const stage = document.createElement("div");
  wrap.append(bar, stage);
  host.appendChild(wrap);

  let round = 1;
  let runner: Runner | null = null;
  let timerId: ReturnType<typeof setInterval> | null = null;
  let nextId: ReturnType<typeof setTimeout> | null = null;
  let timeLeft = 0;
  let best = save.getGameProgress(meta.id).endlessBest;
  let dead = false;

  back.addEventListener("click", () => {
    api.play("tap");
    onBack();
  });

  function stopTimer(): void {
    if (timerId) clearInterval(timerId);
    if (nextId) clearTimeout(nextId);
    timerId = null;
    nextId = null;
  }

  function showOver(): void {
    stopTimer();
    runner?.destroy();
    runner = null;
    stage.innerHTML = "";
    const reached = Math.max(0, round - 1);
    best = save.recordEndlessBest(meta.id, reached);
    const box = document.createElement("div");
    box.className = "fdf-wrap";
    box.innerHTML = `<div class="fdf-msg" style="color:#7a5aa0">⏰ 这一轮没找完<br>${endlessLine(reached, best)}</div>`;
    const again = document.createElement("button");
    again.type = "button";
    again.className = "fdf-btn";
    again.textContent = "🔁 从第 1 轮再来";
    again.addEventListener("click", () => {
      api.play("tap");
      round = 1;
      startRound();
    });
    box.appendChild(again);
    stage.appendChild(box);
  }

  function startRound(): void {
    if (dead) return;
    stopTimer();
    runner?.destroy();
    stage.innerHTML = "";
    const scene = buildEndlessScene(round);
    timeLeft = scene.timeSec;
    chip.textContent = `♾️ 第 ${round} 轮 · 最好 第 ${best} 轮`;
    runner = createRunner(stage, {
      scene,
      playLabel: `找出下图不一样的 ${scene.diffIdx.length} 个地方，点它！`,
      sfx: (name) => api.play(name),
      onCleared: () => {
        api.play("win");
        best = save.recordEndlessBest(meta.id, round);
        api.addStars(1);
        round++;
        // 这一轮已经清干净了，秒表先停掉：换轮那 450 毫秒里它要是踩到 0,
        // 会闪一屏「⏰ 这一轮没找完」，明明刚刚才找齐。
        stopTimer();
        nextId = setTimeout(() => {
          nextId = null;
          if (!dead) startRound();
        }, 450);
      },
    });
    runner.hud.hidden = false;
    runner.hud.innerHTML = hudTimeHTML(timeLeft, scene.timeSec);
    runner.setMessage("每轮 3 处不同，找齐就进下一轮；网格会越来越大，双胞胎图案也会越来越多。");
    timerId = setInterval(() => {
      if (dead) return;
      timeLeft--;
      if (runner) runner.hud.innerHTML = hudTimeHTML(timeLeft, scene.timeSec);
      if (timeLeft <= 0) showOver();
    }, 1000);
  }

  startRound();

  return {
    destroy() {
      dead = true;
      stopTimer();
      runner?.destroy();
      runner = null;
      wrap.remove();
    },
  };
}

// ---------------------------------------------------------------------------
// 挂载：模式条 + 188 关地图
// ---------------------------------------------------------------------------

/** 壳层给的 `initialLevel`（1 基），没有就看地址栏的 `?level=N` */
function wantedLevel(api: GameApi): unknown {
  const given = (api as { initialLevel?: unknown }).initialLevel;
  if (given !== undefined && given !== null) return given;
  const loc = (globalThis as { location?: { search?: string; hash?: string } }).location;
  if (!loc) return undefined;
  return parseLevelParam(loc.search ?? "") ?? parseLevelParam(loc.hash ?? "") ?? undefined;
}

/** 当前挂载着的那一局的「直开第 N 关」入口（没挂载就是 null） */
let opener: ((level1: number) => boolean) | null = null;

/**
 * 平台侧直开第 N 关（1 基）。`level99.ts` 只读、没开这个口子，
 * 所以实现是「替玩家在地图上点一下」；没挂载或关卡还锁着就返回 false。
 */
export function openCampaignLevel(level: number): boolean {
  return opener ? opener(level) : false;
}

export function mount(api: GameApi): { destroy: () => void } {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = CSS + STAGE_CSS + BOARD_ART_CSS;
  const bar = document.createElement("div");
  bar.className = "fdf-tools";
  bar.style.margin = "0 0 8px";
  const levelHost = document.createElement("div");
  const modeHost = document.createElement("div");
  modeHost.hidden = true;
  root.append(style, bar, levelHost, modeHost);
  api.root.appendChild(root);

  const endlessBtn = document.createElement("button");
  endlessBtn.type = "button";
  endlessBtn.className = "fdf-btn";
  bar.appendChild(endlessBtn);

  let mode: { destroy: () => void } | null = null;

  function refreshBar(): void {
    const best = save.getGameProgress(meta.id).endlessBest;
    endlessBtn.textContent = best > 0 ? `♾️ 找不同马拉松 · 最好 第 ${best} 轮` : "♾️ 找不同马拉松 · 点我开始！";
  }

  /** 关卡正在跑没有：♾️ 入口靠它挡住，别把关卡层只藏不销毁（W5R2-C-06） */
  let inLevel = false;

  function closeMode(): void {
    mode?.destroy();
    mode = null;
    modeHost.hidden = true;
    levelHost.hidden = false;
    bar.hidden = false;
    refreshBar();
  }

  endlessBtn.addEventListener("click", () => {
    if (mode) return;
    // 关卡正在跑就不许再开一层。`bar.hidden` 只是让手指够不着，焦点残留、
    // 壳层补发的 click、自动化脚本照样能把它点响 —— 点响了关卡层就只被 hidden 藏起来，
    // 秒表继续走，52 秒后「时间到」结算屏会盖在正在进行的马拉松上（W5R2-C-06）。
    if (inLevel) return;
    api.play("tap");
    levelHost.hidden = true;
    bar.hidden = true;
    modeHost.hidden = false;
    mode = mountEndless(modeHost, api, closeMode);
  });
  refreshBar();

  const game = mountLevelGame(
    { ...api, root: levelHost },
    {
      id: meta.id,
      chapters: CHAPTERS,
      mapHint: "一行一行按路线扫，比满屏乱看快得多～",
      grandMessage: "188 关全部找完，你已经练出一套自己的观察方法了！",
      // 真下到某一关里就把 ♾️ 入口收起来，回选关地图再放回去。两件事一起解决：
      // ① 关内那 52px 是提示键与放大滑杆掉出屏幕的一部分（W5R2-C-04）；
      // ② 关卡进行中点得着 ♾️ 的话，关卡层只被 hidden 藏起来、秒表继续走，
      //    52 秒后「时间到」结算屏会盖在正在进行的马拉松上（W5R2-C-06）。
      // 先收再摆：格子是在 playLevel 里按可视高摊的，量早了这 52px 没人认领。
      playLevel: (stage, ctx) => {
        bar.hidden = true;
        inLevel = true;
        const handle = playLevel(stage, ctx);
        return {
          destroy: () => {
            inLevel = false;
            handle?.destroy?.();
            // 马拉松开着的时候这一条本来就该收着，别替它放回来
            if (!mode) bar.hidden = false;
          },
        };
      },
    }
  );

  function open(level1: number): boolean {
    const target = resolveInitialLevel(
      level1,
      furthestPlayable(loadStars(meta.id), loadSkips(meta.id), TOTAL_LEVELS),
      TOTAL_LEVELS
    );
    if (target === null) return false;
    if (mode) closeMode();
    try {
      return openLevelOnMap(levelHost, target, chapterOf(CHAPTERS, target));
    } catch (err) {
      console.warn("[一朵一星] find-diff 直开关卡失败，停在地图上:", err);
      return false;
    }
  }
  opener = open;

  // 壳层或地址栏点名了某一关就直接开进去，不用孩子在 188 个格子里自己找
  const wanted = wantedLevel(api);
  if (wanted !== undefined && wanted !== null) open(Number(wanted));

  return {
    destroy() {
      if (opener === open) opener = null;
      mode?.destroy();
      mode = null;
      game.destroy();
      root.remove();
    },
  };
}
