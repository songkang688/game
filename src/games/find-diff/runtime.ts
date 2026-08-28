/**
 * 找不同 · 1.2 运行时小工具（命中容差 / 温和惩罚 / 缩放 / 两级提示 / 直开关卡）。
 *
 * 这一份不碰 DOM，全是纯函数，单测直接跑；`index.ts` 只负责把手指的坐标喂进来、
 * 把算出来的结果画出去。
 */
import { TOTAL_LEVELS } from "../level99";

// ---------------------------------------------------------------------------
// 命中容差
// ---------------------------------------------------------------------------

/** 命中半径的下限：手指按下去的接触面大约就这么大 */
export const MIN_HIT_RADIUS = 22;
/** 命中半径占格宽的比例（> 0.5，所以格与格之间的缝隙也吃得住） */
export const HIT_RADIUS_RATIO = 0.55;

/** 一格的命中半径：`max(格宽 * 0.55, 22px)` */
export function hitRadius(cellWidth: number): number {
  const w = Number.isFinite(cellWidth) && cellWidth > 0 ? cellWidth : 0;
  return Math.max(w * HIT_RADIUS_RATIO, MIN_HIT_RADIUS);
}

/** 棋盘上一格的圆心（像素坐标，原点随便，只要与点击坐标同一套） */
export interface CellCenter {
  index: number;
  cx: number;
  cy: number;
}

/**
 * 点在 (x, y) 时命中哪一格：半径内取最近的那个；
 * 两个格子都够得着就取距离更近的，一样近就取下标小的（结果稳定，可测试）。
 * 半径内一个都没有就返回 null（当作点在空白处，什么都不发生）。
 */
export function pickNearest(cells: readonly CellCenter[], x: number, y: number, radius: number): number | null {
  let best: number | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of cells) {
    const d = Math.hypot(c.cx - x, c.cy - y);
    if (d > radius) continue;
    if (d < bestDist - 1e-9) {
      best = c.index;
      bestDist = d;
    }
  }
  return best;
}

/**
 * 小格子上的命中：半径内**优先取还没找到的答案格**，没有答案才退回就近那一格。
 *
 * 为什么要偏心（W5R2-C-09）：图格是这一款唯一的点击目标，矮屏上摊到 26px，
 * 加 4px 缝隙一格的步距才 30px——远不到手指按得准的 44px。
 * 而格子是**紧挨着铺满**的，谁也没法把每格的热区各自撑到 44px 还互不重叠：
 * 单纯放大命中半径只会让相邻两格抢同一片区域，`pickNearest` 照样判给几何上最近的那个，
 * 孩子明明看见了、手指偏 6px 就算点错，白吃一次 0.6 秒冷却，还掉星。
 *
 * 所以把这 44px 的热区**整个让给答案格**：偏 6px 也算找到，
 * 剩下的地盘留给普通格子照旧就近判。看上去一点没变，容错却真到了 44px。
 *
 * 只在格子撑不到 44px 时才这么判（见 `index.ts` 的 `hitAt`）——
 * 大屏上格子本来就够大，仍旧一格一格如实判。
 */
export function pickForgiving(
  cells: readonly CellCenter[],
  x: number,
  y: number,
  radius: number,
  isAnswer: (index: number) => boolean,
): number | null {
  const answer = pickNearest(
    cells.filter((c) => isAnswer(c.index)),
    x,
    y,
    radius,
  );
  return answer ?? pickNearest(cells, x, y, radius);
}

// ---------------------------------------------------------------------------
// 温和惩罚：点错只冷却，不扣分不扣时，更不会失败
// ---------------------------------------------------------------------------

/** 点错一次的冷却 */
export const MISS_COOLDOWN_MS = 600;
/** 判定为「连点乱扫」之后的冷却（翻倍） */
export const SPAM_COOLDOWN_MS = 1200;
/** 乱扫的判定窗口 */
export const SPAM_WINDOW_MS = 1000;
/** 窗口内错点到这么多次就算乱扫 */
export const SPAM_MISSES = 5;

/**
 * 这一次点错该冷却多久：正常 0.6 秒；
 * 1 秒内（含这一次）错点 ≥ 5 次判为乱扫，翻倍到 1.2 秒。
 * `missTimes` 传最近若干次错点的时间戳（含这一次），单位毫秒。
 */
export function missCooldownMs(missTimes: readonly number[], now: number): number {
  const recent = missTimes.filter((t) => now - t < SPAM_WINDOW_MS);
  return recent.length >= SPAM_MISSES ? SPAM_COOLDOWN_MS : MISS_COOLDOWN_MS;
}

// ---------------------------------------------------------------------------
// 放大镜：双指缩放 + 拖动平移（两图共用同一组参数，所以是联动的）
// ---------------------------------------------------------------------------

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 2.5;
export const ZOOM_STEP = 0.25;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return ZOOM_MIN;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/** 双指捏合：按两指间距的变化比例缩放，夹在 1×–2.5× */
export function pinchZoom(startZoom: number, startDist: number, dist: number): number {
  if (!(startDist > 0) || !(dist > 0)) return clampZoom(startZoom);
  return clampZoom(startZoom * (dist / startDist));
}

/** 两点间距（双指捏合用） */
export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * 平移量的边界：放大 z 倍之后，内容比视口多出 (z-1)*size，
 * 往任一方向最多只能拖出这么多的一半，再多就把图拖出屏幕了。
 */
export function clampPan(pan: number, zoom: number, size: number): number {
  const limit = (Math.max(ZOOM_MIN, zoom) - 1) * Math.max(0, size) / 2;
  if (!Number.isFinite(pan)) return 0;
  return Math.min(limit, Math.max(-limit, pan));
}

/** 1× 时格子小于这个像素就该提醒孩子「可以放大」 */
export const SMALL_CELL_PX = 44;

/** 工具条上那一排（提示键、放大滑杆）的最小热区高度 */
export const TOOL_MIN_H = 44;

/**
 * 主棋盘一格的边长。竖屏上下两图必须同时看得见（不许滚动来回比对），
 * 所以每张图最多占约 40% 的屏高，格子按行数摊下来，再夹在 26–44px。
 * 摊到最小的 26px 时命中半径仍有 22px（热区直径 44px），点得到。
 */
export function panelCellPx(rows: number, viewportHeight: number, max = SMALL_CELL_PX): number {
  const h = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 640;
  const perPanel = Math.max(140, h * 0.4) - 28;
  return Math.max(26, Math.min(max, Math.floor(perPanel / Math.max(1, rows))));
}

/**
 * 两张图之外那些固定占位一共吃掉多少：顶部徽章 29 + 提示行 20 + 工具条 72
 * + 三道 8px 间距 + 上下各 10px 内边距，取整到 165。
 */
export const PANEL_CHROME_PX = 165;

/**
 * 同样是主棋盘一格的边长，但按**舞台真正看得见的那一段**摊，而不是按屏高。
 *
 * 为什么要有这一条：`panelCellPx()` 拿的是 `innerHeight`，可 `.game-stage` 是
 * `overflow:hidden` 且定高的——360×720 的机器上屏高有 720，这一款却只分到 356px。
 * 按屏高摊会得出「屏幕够高，两张图放大点没事」的错误结论，于是提示键与放大滑杆
 * 被顶到裁切线以下，真实坐标一个都点不着（360×720 上实测 2 颗，360×640 上 5 颗）。
 *
 * 摊到最小仍是 26px：命中半径 22px（热区直径 44px），点得到。
 */
export function panelCellForRoom(rows: number, roomPx: number, max = SMALL_CELL_PX): number {
  if (!Number.isFinite(roomPx) || roomPx <= 0) return max;
  const perPanel = (roomPx - PANEL_CHROME_PX) / 2;
  return Math.max(26, Math.min(max, Math.floor(perPanel / Math.max(1, rows))));
}

/** 从自己的顶边到最近那条裁切线还剩多少像素（没有裁切祖先就是无限） */
export function visibleRoomPx(selfTop: number, clipperBottoms: readonly number[]): number {
  if (clipperBottoms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...clipperBottoms) - selfTop;
}

/**
 * 一层裁切祖先真正的那条裁切线。
 *
 * 滚动口是 **padding box**，下边框那几像素照不进内容；
 * `getBoundingClientRect().bottom` 给的却是 border box 的下沿。
 * `.game-stage` 写着 `border:4px solid #fff`，不减这一刀就白多算 4px。
 * 量不出宽度就当没有，绝不算成 NaN。
 */
export function clipBottomPx(bottom: number, borderBottom: string): number {
  const w = Number.parseFloat(borderBottom);
  return Number.isFinite(w) && w > 0 ? bottom - w : bottom;
}

/** 量一次这个节点头顶到最近那条裁切线之间还剩多少（量不了就返回 Infinity） */
export function stageRoomPx(el: HTMLElement): number {
  const view = el.ownerDocument?.defaultView ?? null;
  if (!view || typeof el.getBoundingClientRect !== "function") return Number.POSITIVE_INFINITY;
  const bottoms: number[] = [];
  for (let p = el.parentElement; p; p = p.parentElement) {
    const cs = view.getComputedStyle(p);
    const oy = cs.overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "hidden") {
      bottoms.push(clipBottomPx(p.getBoundingClientRect().bottom, cs.borderBottomWidth));
    }
  }
  return visibleRoomPx(el.getBoundingClientRect().top, bottoms);
}

/**
 * 两张图那一块最少要留多高才值得钳——比这还矮就整块让给滚动，钳只会压成一条缝。
 * 两行 26px 的格子加上格间距与标题，正好 96px。
 */
export const VIEWPORT_MIN_ROOM = 96;

/**
 * 算「两张图那一块」该被钳到多高，才能让它下面的提示行与工具条留在裁切线以内。
 *
 * `panelCellForRoom()` 已经把格子摊到 26px 的下限了，可 360×640 上整块玩法仍有 504px，
 * 而舞台只给 404px——`.l99-stagebar` 自己就吃掉 116px，工具条那行「🔎 圈出大致区域」
 * 202px 宽放不下滑杆，又换了一行多占 52px。差的这 100px 没地方再省，
 * 于是提示键与放大滑杆整个掉到裁切线以下，四档视口里 ≤640 的两档一个都点不着。
 *
 * 这里只动两张图那一块：把超出的部分从它身上扣掉，工具条就顶回屏幕里。
 * 返回 null 表示装得下（或矮到不值得钳），照原样别管。
 */
export function viewportRoomPx(
  wrapHeight: number,
  viewportHeight: number,
  roomPx: number,
  minRoom = VIEWPORT_MIN_ROOM,
): number | null {
  if (!Number.isFinite(roomPx) || roomPx <= 0) return null;
  if (!Number.isFinite(wrapHeight) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return null;
  const over = wrapHeight - roomPx;
  if (over <= 1) return null;
  return Math.max(minRoom, Math.floor(viewportHeight - over));
}

/**
 * 两张图那一块已经钳到 `VIEWPORT_MIN_ROOM` 底线了，整屏**还是**装不下吗。
 *
 * 走到这一步说明再没有可让的像素了：两张图不能再矮（26px 的格子已经是下限，
 * 再矮就看不清哪儿不一样），工具条又不能不要。以前这里直接收手，
 * 横屏 640×360 上量到的就是后果：`.fdf-wrap` 237px、可视段只有 190px，
 * **提示键 202×44、放大滑杆 110×44、朗读键 115×44 三颗全部落在裁切线以下，
 * 而且一个可滚祖先都没有**，真手指慢拖八趟一颗都救不回来（W5R3-C-04）。
 * 提示是这一款唯一的救济——找不出来又按不着提示，这一关就卡死在那儿了。
 *
 * 滚动口最矮也得放得下一颗工具键的中心点，所以下限就是 `TOOL_MIN_H`。
 */
export const WRAP_MIN_ROOM = TOOL_MIN_H;

export function wrapNeedsScroll(wrapHeight: number, roomPx: number, minRoom = WRAP_MIN_ROOM): boolean {
  if (!Number.isFinite(roomPx) || roomPx < minRoom) return false;
  if (!Number.isFinite(wrapHeight) || wrapHeight <= 0) return false;
  return wrapHeight - roomPx > 1;
}

/**
 * 要把 `[top, bottom]` 这一段送进眼前，`scrollTop` 该写多少（滚最小的那一段）。
 * 这一段比滚动口还高就从它的上沿开始露；量不出数 / 没得滚就返回 0。
 */
export function scrollToShowPx(top: number, bottom: number, client: number, max: number): number {
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return 0;
  if (!(client > 0) || !(max > 0)) return 0;
  const want = bottom - top > client ? top : bottom - client;
  return Math.max(0, Math.min(max, Math.round(want)));
}

/**
 * 首帧之后允许格子**往回长**到多大;不该长就返回 null。
 *
 * 为什么需要这一条:挂载那一刻 `.fdf-panels` 还是空的,`.l99-stage` 这类
 * **随内容长高**的裁切祖先此时几乎没有高度,`stageRoomPx()` 量出来的余量
 * 小得离谱,`panelCellForRoom()` 直接钳到 26px 下限——390×844 的手机和
 * 1024×768 的平板上棋盘四周明明一大片空,格子却只有 26px(三办 R4 实测)。
 * 等真实内容排完再量一次,余量就是真的了;这里按同一套公式复算,
 * 只许放大、不许缩小(缩小的活儿归 fitViewport 的钳制,别抢)。
 */
export function regrowCellPx(
  currentPx: number,
  rows: number,
  viewportHeight: number,
  roomPx: number,
  max = SMALL_CELL_PX,
): number | null {
  if (!Number.isFinite(currentPx) || currentPx <= 0) return null;
  const grown = Math.min(panelCellPx(rows, viewportHeight, max), panelCellForRoom(rows, roomPx, max));
  return grown > currentPx ? grown : null;
}

/** 三图模式上排那两张参考图的格子：并排还得塞进 360px 宽 */
export function miniCellPx(cols: number, viewportWidth: number): number {
  const w = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 360;
  const usable = Math.max(240, Math.min(w, 420)) - 40;
  return Math.max(22, Math.min(32, Math.floor(usable / 2 / Math.max(1, cols)) - 4));
}

/** 这块棋盘在 1× 下是不是已经小到该提示放大了 */
export function shouldSuggestZoom(cellWidth: number, zoom: number): boolean {
  return zoom <= ZOOM_MIN + 1e-9 && cellWidth < SMALL_CELL_PX;
}

// ---------------------------------------------------------------------------
// 提示经济：先圈 3×3 区域，再点一次才精确指出
// ---------------------------------------------------------------------------

export type HintStage = "area" | "spot";

/** 以 index 为中心的 3×3 区域（贴边时自动收窄，不会绕到隔壁行） */
export function hintArea(index: number, rows: number, cols: number): number[] {
  const out: number[] = [];
  if (!Number.isInteger(index) || index < 0 || index >= rows * cols) return out;
  const r0 = Math.floor(index / cols);
  const c0 = index % cols;
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    if (r < 0 || r >= rows) continue;
    for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (c < 0 || c >= cols) continue;
      out.push(r * cols + c);
    }
  }
  return out;
}

/** 提示按了第 n 次（1 基）时该给到哪一级：奇数次圈区域，偶数次才精确指 */
export function hintStageOf(press: number): HintStage {
  return press % 2 === 1 ? "area" : "spot";
}

/** 一次「圈区域 + 精确指」算用掉一次提示额度 */
export function hintsUsed(press: number): number {
  return Math.ceil(Math.max(0, press) / 2);
}

// ---------------------------------------------------------------------------
// 直开第 N 关
// ---------------------------------------------------------------------------

/**
 * 通用闯关框架 `level99.ts` 没给「直接开某一关」的入口，而它是只读的公共文件。
 * 于是这里照着地图上的按钮替玩家点一下：先切章，再点那一关的格子；
 * 点不到就安静地停在地图上，绝不因为这一步把游戏卡住。
 */

/** 从 `?level=12` 之类的串里读关号（1 基）；读不到返回 null */
export function parseLevelParam(search: string): number | null {
  if (typeof search !== "string" || !search) return null;
  const hit = /[?&#]level=(-?\d+)/.exec(search);
  if (!hit) return null;
  const n = Number(hit[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * 壳层给的 `initialLevel`（1 基）或地址栏 `?level=N` 落成实际要开的关号（0 基）：
 * 越界夹回来，还没解锁的退到当前能玩到的最远那一关，没点名就返回 null。
 */
export function resolveInitialLevel(raw: unknown, unlocked: number, total = TOTAL_LEVELS): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(n)) return null;
  const top = Math.max(1, Math.round(total));
  const wanted = Math.max(1, Math.min(top, Math.round(n))) - 1;
  const reachable = Math.max(0, Math.min(top - 1, Math.round(unlocked)));
  return Math.min(wanted, reachable);
}

/** 地图上一个能点的格子（只要求这三样，真 DOM 与测试桩都对得上） */
export interface MapNodeLike {
  classList: { contains(token: string): boolean };
  getAttribute(name: string): string | null;
  click(): void;
}

/** 地图容器（只要求查得出格子） */
export interface MapHostLike {
  querySelectorAll(selector: string): ArrayLike<MapNodeLike>;
}

/** 替玩家在地图上点开第 level 关（0 基）；章节锁着或格子锁着就返回 false */
export function openLevelOnMap(host: MapHostLike, level: number, chapterIndex: number): boolean {
  const tabs = host.querySelectorAll("button.l99-tab");
  const tab = chapterIndex >= 0 && chapterIndex < tabs.length ? tabs[chapterIndex] : undefined;
  if (!tab || tab.classList.contains("l99-tab-lock")) return false;
  tab.click();
  const label = `第 ${level + 1} 关`;
  const nodes = host.querySelectorAll("button.l99-node");
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!(node.getAttribute("aria-label") ?? "").startsWith(label)) continue;
    if (node.classList.contains("l99-node-lock")) return false;
    node.click();
    return true;
  }
  return false;
}
