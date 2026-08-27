/**
 * 把答题壳钳进舞台看得见的那一段（1.2 窗口5 · 第 2 轮 · 档B 监督修复员，`W5R2-FB-02`）。
 *
 * `.game-stage` 是**定高 + `overflow:hidden`**（`src/styles.css`，平台文件，交窗口1）：
 * 装不下的部分既不滚也没提示，直接被裁掉。本档五款里另外四款各有一层自己的壳
 * 接住这件事，只有这一款把 `quiz99` 直接渲染进舞台——于是横过来拿的时候
 * 三颗 `.qz-choice` 整排掉在裁切线以下（真机 844×390：选项中心 y=405、裁切线 y=378），
 * 而全场找不到任何滚得起来的祖先，真手指也救不回来，这一关一道题都答不了。
 *
 * 这里只做两件事，都只碰**本款自己起的那一层宿主**：
 *  1. 量出「宿主头顶到最近一条裁切线」还剩多少像素；
 *  2. 装不下就把宿主钳到那个高度并给它 `overflow-y:auto`，内容在宿主身上滚。
 *
 * `quiz99` 一行不动，`.qz-*` 的 DOM、判分、朗读一个字节都没碰。
 * 做法与 `shape-kingdom/draw.ts` 的 `fitIntoStage()` 是同一份（那一款的宿主叫
 * `.shk-quizhost`），本款不跨游戏 import，各自留一份。
 */

/**
 * 一层裁切祖先真正的那条裁切线。
 *
 * 滚动口是 **padding box**，下边框那几像素照不进内容；
 * `getBoundingClientRect().bottom` 给的却是 border box 的下沿。
 * `.game-stage` 写着 `border:4px solid #fff`（平台文件，禁改），不减这一刀就白多算 4px。
 * 量不出宽度（测试桩 / 老浏览器）就当没有，绝不把可视段算成 `NaN`。
 */
export function clipBottomPx(bottom: number, borderBottom: string): number {
  const w = Number.parseFloat(borderBottom);
  return Number.isFinite(w) && w > 0 ? bottom - w : bottom;
}

/**
 * 「我头顶到最近一条裁切线」还剩多少像素。
 * 多层都在裁就听最靠上的那一条——只要有一层裁，再往下就看不见了。
 * 一层都不裁返回 `Infinity`，表示这一屏压根不用钳。
 */
export function visibleRoomPx(selfTop: number, clipperBottoms: readonly number[]): number {
  if (clipperBottoms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...clipperBottoms) - selfTop;
}

/**
 * 这一屏该钳到多高（`null` = 装得下，一个字节都不用写）。
 * 差一个像素以内不算超：亚像素抖动不值得为它挂一条滚动条。
 */
export function capPx(roomPx: number, contentPx: number): number | null {
  if (!Number.isFinite(roomPx) || roomPx <= 0) return null;
  if (!Number.isFinite(contentPx) || contentPx <= 0) return null;
  if (contentPx <= roomPx + 1) return null;
  return Math.floor(roomPx);
}

/**
 * 把 `el` 钳进舞台看得见的那一段，并在换题 / 转屏时重算。
 * 返回 `relayout()`（换题时叫一声）与 `dispose()`（`destroy` 时叫一声）。
 */
export function fitIntoStage(el: HTMLElement): { relayout: () => void; dispose: () => void } {
  const view = el.ownerDocument?.defaultView ?? null;
  const measurable = typeof el.getBoundingClientRect === "function" && !!view;
  const relayout = (): void => {
    if (!measurable || !view) return;
    // 先把上一次钳出来的值还原，不然量到的是钳完的高度，越量越小
    el.style.maxHeight = "";
    el.style.overflowY = "";
    const bottoms: number[] = [];
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = view.getComputedStyle(p);
      const oy = cs.overflowY;
      if (oy === "auto" || oy === "scroll" || oy === "hidden") {
        bottoms.push(clipBottomPx(p.getBoundingClientRect().bottom, cs.borderBottomWidth));
      }
    }
    const cap = capPx(visibleRoomPx(el.getBoundingClientRect().top, bottoms), el.scrollHeight);
    if (cap === null) return;
    el.style.maxHeight = `${cap}px`;
    el.style.overflowY = "auto";
  };
  relayout();
  view?.addEventListener("resize", relayout);
  return {
    relayout,
    dispose(): void {
      view?.removeEventListener("resize", relayout);
    },
  };
}
