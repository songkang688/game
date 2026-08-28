/**
 * 画布显示高按「舞台可视余量」收一刀(三人组 r4/r5 走查配方 B 之 1 的共享件)。
 *
 * 这一族病灶的共因:画布分辨率按屏宽或固定比例定,显示层 `width:100%;height:auto`,
 * 横屏矮屏(915×412)与平板(1024×768)上显示高远超 `.game-stage` 的可视高,
 * 画布下半截连同虚拟按键(触屏的主输入)一起掉在折叠线以下——实时玩法不能边玩边滚。
 *
 * 修法照 dot-maze `a16caf46`:量 `.game-stage` 的裁切下沿,减掉画布下面自家家当
 * (按钮排 / 提示行,量 wrap 下沿与画布下沿的差就全含了),给显示层钳一条 `max-height`。
 * canvas 是带内在比例的 replaced 元素,超过 max-height 时浏览器会连宽一起等比收,
 * 画面不变形;指针输入都按 `rect.width / rect.height` 换算,显示缩放不碰任何判定。
 *
 * 量不到(单测桩、还没挂上壳)就一个样式不写,永不抛。
 */

/** 画布显示高的下限:比这更矮画面就看不清了,低于它宁可交给舞台滚动 */
export const MIN_CANVAS_DISPLAY_PX = 160;

/** 画布该「显示」多高(null = 余量装得下,一个样式都不用写) */
export function canvasDisplayCapPx(
  nativeH: number,
  roomPx: number,
  min = MIN_CANVAS_DISPLAY_PX
): number | null {
  if (!Number.isFinite(nativeH) || nativeH <= 0) return null;
  if (!Number.isFinite(roomPx) || roomPx <= 0) return null;
  const cap = Math.floor(roomPx);
  // 差一个像素以内不算超:亚像素抖动不值得为它改样式
  if (nativeH <= cap + 1) return null;
  return Math.max(min, cap);
}

interface RectLike {
  top: number;
  bottom?: number;
  height: number;
}

/** 一个盒子的下沿(测试桩的 rect 可能没有 bottom,用 top+height 兜底) */
export function rectBottom(r: RectLike): number {
  return Number.isFinite(r.bottom) ? (r.bottom as number) : r.top + r.height;
}

/** 往上找平台舞台(.game-stage);找不到返回 null */
function findStage(from: HTMLElement | null | undefined): HTMLElement | null {
  let node: HTMLElement | null = from?.parentElement ?? null;
  for (let i = 0; node && i < 12; i++) {
    if (typeof node.className === "string" && node.className.includes("game-stage")) return node;
    node = node.parentElement ?? null;
  }
  return null;
}

/**
 * 往上找平台舞台(.game-stage,定高会裁内容)的可视下沿;量不到返回 NaN。
 * 用 clientHeight 口径(舞台有 4px 边框,rect.bottom 会多算,1.2 窗口 5 翻过车)。
 */
export function stageClipBottom(from: HTMLElement | null | undefined): number {
  const node = findStage(from);
  if (!node || typeof node.getBoundingClientRect !== "function") return Number.NaN;
  const r = node.getBoundingClientRect();
  const inner =
    typeof node.clientHeight === "number" && node.clientHeight > 0
      ? (node.clientTop || 0) + node.clientHeight
      : r.height;
  if (Number.isFinite(r.top) && Number.isFinite(inner) && inner > 0) return r.top + inner;
  return Number.NaN;
}

/**
 * 舞台此刻卷走了多少(scrollTop)。菜单页的「开始」钮常在折叠线下,点完
 * 舞台还留着残余滚动——这时 rect 量出来的余量偏大,钳出来的画布回到顶端就装不下。
 * 量不到返回 0。
 */
export function stageScrollTopPx(from: HTMLElement | null | undefined): number {
  const node = findStage(from);
  const st = node ? (node as { scrollTop?: number }).scrollTop : undefined;
  return typeof st === "number" && Number.isFinite(st) ? Math.max(0, st) : 0;
}

/** 进桌/进关时把舞台滚回顶:不然新画面的抬头会被菜单页的残余滚动卷走 */
export function resetStageScroll(from: HTMLElement | null | undefined): void {
  const node = findStage(from);
  if (node && typeof node.scrollTop === "number") node.scrollTop = 0;
}

/**
 * 画布下方自家家当(按钮排/提示行/徽章排)的实高:容器下沿减画布下沿。
 * `stagePlayRoom(host).h` 只减了壳层抬头,自家按钮排要各款自己再减(r5 配方 F);
 * 家当高度不随画布显示高变,量一次就是稳的。量不到返回 0,永不抛。
 */
export function belowCanvasPx(canvas: HTMLElement, wrap: HTMLElement): number {
  if (typeof canvas.getBoundingClientRect !== "function" || typeof wrap.getBoundingClientRect !== "function") return 0;
  const c = canvas.getBoundingClientRect();
  const w = wrap.getBoundingClientRect();
  if (!Number.isFinite(c.top) || !Number.isFinite(w.top)) return 0;
  return Math.max(0, rectBottom(w) - rectBottom(c));
}

/**
 * 画布(或棋盘)这一刻真正可用的显示高:舞台可视下沿 − 画布上沿 − 画布下方家当。
 * 比 `stagePlayRoom(host).h` 准:抬头 HUD 与自家按钮排都量进去了。
 * 量不到(单测桩)返回 NaN,调用方自己兜底(一般退回原来的估法)。
 */
export function canvasRoomPx(canvas: HTMLElement, wrap: HTMLElement, margin = 4): number {
  if (typeof canvas.getBoundingClientRect !== "function") return Number.NaN;
  const clip = stageClipBottom(wrap);
  if (!Number.isFinite(clip)) return Number.NaN;
  const rect = canvas.getBoundingClientRect();
  if (!Number.isFinite(rect.top)) return Number.NaN;
  return clip - rect.top - belowCanvasPx(canvas, wrap) - margin;
}

export interface CanvasFitHandle {
  /** 排版变了(resize / 关内重排)再量一次 */
  refit: () => void;
  /** destroy 时摘监听,幂等 */
  detach: () => void;
}

/**
 * 方格盘(aspect-ratio:1 的格子 + 等 gap)按「高预算」反推容器最大宽。
 * 盘高 = rows×cell + (rows-1)×gap,cell = (宽 - (cols-1)×gap) / cols:
 * 给定可视余量 roomPx,解出宽上限;格子有下限(minCellPx),缩到底还装不下
 * 就贴着下限交给舞台滚动(BL-W6-03 口径)。装得下返回 null,一个样式不写。
 */
export function boardCapWidthPx(opts: {
  /** 盘面此刻的显示高 */
  h: number;
  /** 可视余量 */
  room: number;
  cols: number;
  rows: number;
  gap?: number;
  minCellPx?: number;
}): number | null {
  const { h, room, cols, rows } = opts;
  if (!Number.isFinite(h) || h <= 0) return null;
  if (!Number.isFinite(room) || room <= 0) return null;
  if (!(cols > 0) || !(rows > 0)) return null;
  if (h <= room + 1) return null;
  const gap = Number.isFinite(opts.gap) ? (opts.gap as number) : 0;
  const minCell = Number.isFinite(opts.minCellPx) ? (opts.minCellPx as number) : 26;
  const cap = Math.floor(((room - (rows - 1) * gap) * cols) / rows + (cols - 1) * gap);
  const floor = Math.ceil(cols * minCell + (cols - 1) * gap);
  return Math.max(floor, cap);
}

/**
 * 给一块画布挂上「按可视余量钳显示高」:挂载时量一次、下一帧补量一次、resize 重量。
 * `wrap` 是画布所在的自家容器——wrap 下沿减画布下沿就是「画布下面的家当」实高,
 * 按钮排 / 提示行不随画布显示高变,量一次就是稳的。
 */
export function attachCanvasFit(
  canvas: HTMLCanvasElement,
  wrap: HTMLElement,
  opts: { margin?: number; minPx?: number } = {}
): CanvasFitHandle {
  const margin = Number.isFinite(opts.margin) ? (opts.margin as number) : 4;
  let detached = false;

  function fit(): void {
    if (detached || !canvas.style) return;
    if (typeof canvas.getBoundingClientRect !== "function" || typeof wrap.getBoundingClientRect !== "function") return;
    const clip = stageClipBottom(wrap);
    if (!Number.isFinite(clip)) return;
    // 先摘掉上一次的钳位再量:量到的必须是「本来要多高」
    canvas.style.maxHeight = "";
    canvas.style.width = "";
    const canvasRect = canvas.getBoundingClientRect();
    if (!Number.isFinite(canvasRect.top)) return;
    const below = Math.max(0, rectBottom(wrap.getBoundingClientRect()) - rectBottom(canvasRect));
    // 减掉舞台残余滚动:预算按「滚回顶」的位置算,画布才装得进第一屏
    const room = clip - canvasRect.top - stageScrollTopPx(wrap) - below - margin;
    const px = canvasDisplayCapPx(canvasRect.height, room, opts.minPx);
    if (px === null) return;
    canvas.style.maxHeight = `${px}px`;
    // 这一族画布 CSS 都是 width:100% + 固定分辨率缓冲:光钳高会把画面压扁。
    // 按缓冲的固有比例把显示宽一起收(封顶 100%、居中),画面不变形;
    // 缓冲跟着盒子走的款(每帧重配)量出来的就是当前比例,同样成立。
    const ratio = canvas.width > 0 && canvas.height > 0 ? canvas.width / canvas.height : Number.NaN;
    if (Number.isFinite(ratio)) {
      canvas.style.width = `${Math.round(px * ratio)}px`;
      canvas.style.maxWidth = "100%";
      canvas.style.marginLeft = "auto";
      canvas.style.marginRight = "auto";
    }
  }

  fit();
  // 挂载那一刻可能还没排好版;抽空补量一次(不用 rAF,免得测试桩的帧队列被挤)
  const timer = typeof setTimeout === "function" ? setTimeout(fit, 0) : null;
  const hasWin = typeof window !== "undefined" && typeof window.addEventListener === "function";
  if (hasWin) window.addEventListener("resize", fit);

  return {
    refit: fit,
    detach() {
      if (detached) return;
      detached = true;
      if (timer !== null) clearTimeout(timer);
      if (hasWin) window.removeEventListener("resize", fit);
    },
  };
}
