/**
 * 钓场排版的两件运行期小事（1.2 窗口5 · 第 2 轮 · 档B 学习优化员）。
 *
 * 一、**这一屏到底有多高，得量，不能猜。**
 * `layout()` 原来按 `innerHeight` 乘一个比例算水面高度。可子游戏拿到的从来不是整块屏幕：
 * 平台壳顶栏、`l99` 抬头、关卡 HUD 加起来在 360×640 上要吃掉两百多像素，
 * 而 `.game-stage` 是**定高 + `overflow:hidden`**（平台文件，交窗口1），多出来的部分
 * 既不滚也没提示，直接被裁掉——裁掉的那一截里正是「🎣 按住抛竿」。
 * 按 `innerHeight` 猜出来的水面在矮屏上必然偏高，所以这里改成量真实可视高再倒推水面。
 *
 * 二、**别人滚过的位置不许带进关内。**
 * 选关地图上按「🎯 跳到当前关」（以及点节点时浏览器自带的聚焦滚动）会把 `.game-stage`
 * 滚出一个非 0 的 `scrollTop`。进关之后这个位移**没有任何东西会把它还原**，
 * 而舞台是 `overflow:hidden`，于是关内 UI 顶部被硬裁掉一截，用户也滚不回去。
 * 进关那一刻把这条链上的滚动位移归 0 就完事了——地图已经换成关卡界面，
 * 那个位移在这一刻已经没有任何意义。
 *
 * 两件事都只碰本款自己的盒子与它的祖先**滚动位置**，一行平台 CSS 都没改。
 */

/** 水面再矮也不能低于这个高度：低于它就看不清鱼群带与深度尺了 */
export const MIN_SEA_PX = 132;

/** 量出来的可视高与实际排版之间留的余量（借边框圆角与阴影一两个像素） */
export const FIT_SLACK_PX = 4;

/**
 * 「我头顶到最近一条裁切线」还剩多少像素。
 * 多层都在裁就听最靠上的那一条——只要有一层裁，再往下就看不见了。
 * 一层都不裁返回 `Infinity`，表示这一屏压根不用收。
 */
export function visibleRoomPx(selfTop: number, clipperBottoms: readonly number[]): number {
  if (clipperBottoms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...clipperBottoms) - selfTop;
}

/**
 * 水面该多高：想要 `want`，可视高只有 `room`，水面以外的那些行占了 `chrome`。
 * 收不下就收到 `MIN_SEA_PX` 为止，绝不收成 0（那是把画面压没，不是修）。
 * 纯函数，用例直接喂数字。
 */
export function seaHeightPx(want: number, room: number, chrome: number, min = MIN_SEA_PX): number {
  if (!Number.isFinite(room) || room <= 0) return want;
  const fits = Math.floor(room - chrome - FIT_SLACK_PX);
  return Math.max(min, Math.min(want, fits));
}

interface ViewLike {
  getComputedStyle: (el: Element) => { overflowY: string; overflowX?: string };
}

/**
 * 一个 `overflow` 不是 `visible` 的祖先，算不算一条**真的**裁切线。
 *
 * 这一条是本轮踩出来的坑，值得写清楚：舞台这条链上
 * `.game-stage`（定高，真会裁）和 `.l99-stage-wrap`（`overflow:hidden` 但**高度是内容撑出来的**）
 * 都满足「overflow 不是 visible」。可后者的下沿**跟着我自己走**——我收一点它就矮一点，
 * 于是「按可视高收缩」会变成一个自己追自己的死循环：收 → 它跟着矮 → 量出来更矮 → 再收…
 * 真机上量到的就是这个：390×844 明明还剩两百多像素，水面却被收到了下限附近。
 *
 * 判据用 `scrollHeight` 与 `clientHeight` 的关系：
 *  - 两者**相等** = 这个盒子正好被内容撑成这么高（缩包），它的下沿是我自己的下沿，**不算数**；
 *  - `clientHeight < scrollHeight` = 它正在裁东西，**算数**；
 *  - `clientHeight > scrollHeight` = 它比内容高（定高且还有余量），**算数**——
 *    正是这一档给出「还能长多高」的答案，也正是它让收缩之后不会再反弹回去。
 */
export function isRealClipper(el: { scrollHeight?: number; clientHeight?: number }): boolean {
  const sh = el.scrollHeight;
  const ch = el.clientHeight;
  if (typeof sh !== "number" || typeof ch !== "number") return false;
  return Math.abs(sh - ch) > 1;
}

/** 这个盒子头上有哪些「真会裁人」的祖先，各自的下沿在哪儿 */
export function clipperBottoms(el: HTMLElement, view: ViewLike): number[] {
  const out: number[] = [];
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = view.getComputedStyle(p).overflowY;
    if (oy !== "auto" && oy !== "scroll" && oy !== "hidden") continue;
    if (!isRealClipper(p)) continue;
    out.push(p.getBoundingClientRect().bottom);
  }
  return out;
}

/** 这个盒子头顶到最近一条裁切线还剩多少（没有裁切祖先就是 `Infinity`） */
export function stageRoomPx(el: HTMLElement): number {
  const view = el.ownerDocument?.defaultView ?? null;
  if (!view || typeof el.getBoundingClientRect !== "function") return Number.POSITIVE_INFINITY;
  return visibleRoomPx(el.getBoundingClientRect().top, clipperBottoms(el, view as unknown as ViewLike));
}

/**
 * 把「别人滚过的位置」还原成 0：自己以及所有还在滚着的祖先。
 *
 * 只动 `scrollTop` / `scrollLeft`，不改任何人的样式，也不改任何人的 DOM。
 * 已经是 0 的一个都不碰（免得把正常的滚动惯性打断）。
 * 返回真的动过的元素个数，用例靠它判空转。
 */
export function resetClippedScroll(el: HTMLElement | null): number {
  let moved = 0;
  for (let p: HTMLElement | null = el; p; p = p.parentElement) {
    if (typeof p.scrollTop === "number" && p.scrollTop !== 0) {
      p.scrollTop = 0;
      moved += 1;
    }
    if (typeof p.scrollLeft === "number" && p.scrollLeft !== 0) {
      p.scrollLeft = 0;
      moved += 1;
    }
  }
  return moved;
}
