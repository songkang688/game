/**
 * 舞台剩余高度:游戏玩法区(canvas / 棋盘 / 果盆)在 `.game-stage` 里还能占多高。
 *
 * 1.3 手机端修复引入:以前各游戏用 `innerHeight - 常数` 猜高度,顶栏、选关条、
 * HUD 一变就猜错,矮屏上球桌 / 果盆被直接裁掉。这里改成真量——
 * 找到 `.game-stage` 祖先,拿它的可视高减去「玩法区以外的东西」(上方的选关条、
 * HUD,下方的按钮行、提示语),剩下的才是玩法区能用的高度。
 *
 * 量不到(测试桩没有布局引擎、或者游戏没挂在壳层舞台里)返回 null,
 * 调用方退回自己原来的估算,行为一个字不变。
 */

export interface RectLike {
  top: number;
  bottom: number;
  height: number;
}

export interface StageElementLike {
  className?: unknown;
  parentElement?: StageElementLike | null;
  clientHeight?: number;
  clientTop?: number;
  scrollTop?: number;
  children?: ArrayLike<StageElementLike>;
  getBoundingClientRect?: () => Partial<RectLike> | null | undefined;
}

/**
 * 纯函数:舞台可视高 − 玩法区上方占用 − 玩法区下方占用 = 玩法区还能用多高。
 * 负数与 NaN 一律当 0;结果不低于 minPx(玩法区再挤也得留口气,挤不下就靠舞台滚动)。
 */
export function roomWithin(stageClientH: number, aboveH: number, belowH: number, minPx = 0): number {
  const h = Number.isFinite(stageClientH) && stageClientH > 0 ? stageClientH : 0;
  const a = Number.isFinite(aboveH) && aboveH > 0 ? aboveH : 0;
  const b = Number.isFinite(belowH) && belowH > 0 ? belowH : 0;
  return Math.max(Number.isFinite(minPx) ? minPx : 0, h - a - b);
}

/** 从 el 一路向上找壳层舞台 `.game-stage`;没挂在壳里返回 null */
export function findStage(el: StageElementLike | null | undefined): StageElementLike | null {
  let cur: StageElementLike | null | undefined = el;
  let guard = 0;
  while (cur && guard++ < 64) {
    const cls = typeof cur.className === "string" ? cur.className : "";
    if (cls.split(/\s+/).includes("game-stage")) return cur;
    cur = cur.parentElement ?? null;
  }
  return null;
}

/** 把各种残缺的 rect 读成 {top, bottom}:读不出有限数返回 null */
function readRect(el: StageElementLike): { top: number; bottom: number } | null {
  if (typeof el.getBoundingClientRect !== "function") return null;
  let raw: Partial<RectLike> | null | undefined;
  try {
    raw = el.getBoundingClientRect();
  } catch {
    return null;
  }
  if (!raw) return null;
  const top = Number(raw.top);
  const bottom = Number.isFinite(Number(raw.bottom)) ? Number(raw.bottom) : top + Number(raw.height);
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;
  return { top, bottom };
}

/**
 * 量出 el(玩法区元素,通常是 canvas 或它的直接容器)在 `.game-stage` 里
 * 还能占多高:舞台可视高 − el 上方的一切 − el 下方的一切。
 *
 *  - 上方占用按「el 顶到舞台内容顶」算(补上 scrollTop,舞台滚过也不算错);
 *  - 下方占用按「舞台内容最底 − el 底」算,el 自己现在多高不影响结果,
 *    所以反复 layout 不会自己追自己。
 *
 * 量不到(不在舞台里 / 测试桩没布局)返回 null,调用方自己兜底。
 */
export function measureStageRoom(el: StageElementLike | null | undefined, minPx = 0): number | null {
  if (!el) return null;
  const stage = findStage(el);
  if (!stage) return null;
  const clientH = Number(stage.clientHeight);
  if (!Number.isFinite(clientH) || clientH <= 0) return null;
  const sRect = readRect(stage);
  const eRect = readRect(el);
  if (!sRect || !eRect) return null;
  // 测试桩常给全 0 的 rect:上下占用都量成 0 会把整个舞台高当成剩余,宁可退回估算
  if (sRect.top === 0 && sRect.bottom === 0 && eRect.top === 0 && eRect.bottom === 0) return null;

  const clientTop = Number.isFinite(Number(stage.clientTop)) ? Number(stage.clientTop) : 0;
  const scrollTop = Number.isFinite(Number(stage.scrollTop)) ? Number(stage.scrollTop) : 0;
  const above = eRect.top - sRect.top - clientTop + scrollTop;

  // 舞台内容最底:直属孩子里最靠下的那个(HUD / 提示语都在某个孩子的子树里,rect 会算进去)
  let contentBottom = eRect.bottom;
  const kids = stage.children;
  const n = kids ? Number(kids.length) : 0;
  for (let i = 0; i < n; i++) {
    const r = readRect((kids as ArrayLike<StageElementLike>)[i]);
    if (r) contentBottom = Math.max(contentBottom, r.bottom);
  }
  const below = contentBottom - eRect.bottom;
  return roomWithin(clientH, above, below, minPx);
}
