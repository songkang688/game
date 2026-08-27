/**
 * 音乐星星 · 运行时小工具（1.2 新增）。
 *
 * 「直开第 N 关」这件事：通用闯关框架 `level99.ts` 没有对外开放入口
 * （`LevelGameOptions` 里没有 `initialLevel`），而它是只读的公共文件，
 * 不许为了一款游戏去改。于是这里照着地图上的按钮替玩家点一下——
 * 先切到那一章，再点那一关的格子；点不到就安静停在地图上，绝不把游戏卡住。
 *
 * 全部写成不依赖真 DOM 的小接口，单测直接拿桩对象跑。
 */
import { TOTAL_LEVELS } from "../level99";

/** 从 `?level=12` 之类的查询串里读关号（1 基）；读不到返回 null */
export function parseLevelParam(search: string): number | null {
  if (typeof search !== "string" || !search) return null;
  const hit = /[?&#]level=(-?\d+)/.exec(search);
  if (!hit) return null;
  const n = Number(hit[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * 壳层给的 `initialLevel`（1 基）或地址栏 `?level=N` 落到实际要打开的关号（0 基）。
 * 越界一律夹回来；还没解锁的关退到当前能玩到的最远那一关；没点名就返回 null。
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

/**
 * 替玩家在地图上点开第 level 关（0 基）。
 * 章节锁着、格子锁着、或者根本没渲染出来，都返回 false 停在地图上。
 */
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

/** 这台设备是不是要求「减少动效」 */
export function prefersReducedMotion(): boolean {
  const mm = (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia;
  try {
    return typeof mm === "function" && mm("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 360px 布局：五颗星星必须一行放得下，热区还不能缩水
// ---------------------------------------------------------------------------

/** 琴键（星星）热区的最小边长 */
export const KEY_MIN_PX = 56;
/**
 * 实在摆不下时允许收到的触屏底线。再往下小手指就按不准了，
 * 所以到 44px 就不再收，剩下的交给横向滚动（见 `layoutFits`）。
 */
export const KEY_TOUCH_MIN_PX = 44;
/** 琴键之间的最小间隙 */
export const KEY_MIN_GAP_PX = 8;
/** 挤到底时允许的间隙 */
export const KEY_TIGHT_GAP_PX = 4;

export interface KeyLayout {
  width: number;
  gap: number;
}

/**
 * 按可用宽度算键宽与间隙：先保证热区 ≥ 56px、间隙 ≥ 8px，
 * 有余量就把键铺宽一点（最宽 84px），余下的都给间隙。
 *
 * 摆不下的时候（七声音阶 8 个键、双声部关拉开间距的 5 个键都会摆不下）
 * 老写法死守 56px，算出来的总宽直接超过 `available`，键就被切到屏幕外去了
 * ——测试员 W5-B-03 / W5-B-07 量到「哆」和「高哆」整个在屏外。
 * 现在改成逐级让步：先按原间隙把键收到触屏底线以上，再不行才收间隙，
 * 一律不许收到 44px 以下；连 44px 都摆不下的（8 键 × 360px 就是）
 * 就老老实实返回底线尺寸，由调用方按 `layoutFits` 开横向滚动。
 */
export function keyLayout(available: number, count: number, minGap = KEY_MIN_GAP_PX): KeyLayout {
  const n = Math.max(1, Math.round(count));
  const w = Number.isFinite(available) && available > 0 ? available : 360;
  const gaps = Math.max(0, n - 1);
  const room = w - gaps * minGap;
  const width = Math.max(KEY_MIN_PX, Math.min(84, Math.floor(room / n)));
  if (n * width + gaps * minGap <= w) {
    const spare = w - n * width;
    const gap = gaps > 0 ? Math.max(minGap, Math.floor(spare / gaps)) : minGap;
    return { width, gap };
  }
  const shrunk = Math.floor(room / n);
  if (shrunk >= KEY_TOUCH_MIN_PX) return { width: shrunk, gap: minGap };
  // 双声部关那种「刻意拉开」的间距不许被挤掉——一根手指盖住两颗键就判不出和弦了，
  // 所以只有默认间距才允许再收一档，拉开过的间距宁可交给横向滚动。
  const tightGap = minGap > KEY_MIN_GAP_PX ? minGap : Math.min(minGap, KEY_TIGHT_GAP_PX);
  const tight = Math.floor((w - gaps * tightGap) / n);
  if (tight >= KEY_TOUCH_MIN_PX) return { width: tight, gap: tightGap };
  return { width: KEY_TOUCH_MIN_PX, gap: tightGap };
}

/** 这套布局在这个宽度下装不装得下 */
export function layoutFits(layout: KeyLayout, count: number, available: number): boolean {
  const n = Math.max(1, Math.round(count));
  return n * layout.width + Math.max(0, n - 1) * layout.gap <= available;
}
