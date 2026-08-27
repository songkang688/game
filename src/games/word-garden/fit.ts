/**
 * 识字小花园 1.2：把答题屏钳进「舞台真正看得见的那一段」。
 *
 * 第 2 轮档A 监督修复员 W5R2-F-A-02：320×568 上第三个选项整颗掉在裁切线以下——
 * 真机实测（Chrome headless + CDP，命中一律 `document.elementFromPoint(键心)`）
 * 第 41 / 91 / 141 关的第三个选项分别是「笔」「蛋」「冷清」，键心 y=587..593，
 * 而 `.game-stage` 的下沿在 y=554；这条祖先链上能滚的一个都没有，手指怎么划都够不着。
 * 三选一的题少一个选项 = 那道题可能答不了 = 这一关过不去，按阻断记。
 *
 * 做法与 `clock-house/fit.ts` 同源：答题屏是 `quiz99.ts` 渲染的（公共资产，禁改），
 * 但**它挂在哪儿是本款说了算**——给它一个本款自己的宿主 `.wgd-quizhost`，
 * 再量一次舞台下沿、把像素值写成宿主自己的 `max-height`。
 * 两份实现刻意各写各的、不跨游戏 import（学习优化员 W5R2-L-15 已登记：
 * 真要抽公共件得放 `src/ui/**`，那是禁改区，交窗口1）。
 */

/**
 * 从 `selfTop` 往下，舞台真正看得见的还剩多少像素。
 * 取最靠里那一层裁切祖先的下沿；一层都没有（用例里的裸节点）返回 `Infinity`，表示不用钳。
 */
export function visibleRoomPx(selfTop: number, clipperBottoms: readonly number[]): number {
  if (clipperBottoms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...clipperBottoms) - selfTop;
}

/**
 * 要把 `[top, bottom]` 这一段带进可视段，宿主的 `scrollTop` 该写多少。
 *
 * 滚**最小的那一段**：只要下沿进来就收手，题面尽量留在眼前。
 * 这一段自己比可视段还高（描红卡那种）就从它的上沿开始露，先看得见头。
 * 量不出可视段、或者根本没得滚，就返回 0——不平白往 DOM 上写一个 `scrollTop`。
 */
export function scrollToShowPx(top: number, bottom: number, client: number, max: number): number {
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return 0;
  if (!(client > 0) || !(max > 0)) return 0;
  const want = bottom - top > client ? top : bottom - client;
  return Math.max(0, Math.min(max, Math.round(want)));
}

/** 把选项整排带进宿主的可视段（宿主已经是滚动容器了才叫得动） */
function showChoices(host: HTMLElement): void {
  const row = typeof host.querySelector === "function" ? host.querySelector(".qz-choices") : null;
  if (!row || typeof row.getBoundingClientRect !== "function") return;
  const hostTop = host.getBoundingClientRect().top;
  const r = row.getBoundingClientRect();
  const top = r.top - hostTop + host.scrollTop;
  host.scrollTop = scrollToShowPx(
    top,
    top + r.height,
    host.clientHeight,
    host.scrollHeight - host.clientHeight
  );
}

/**
 * 把答题屏钳进舞台看得见的那一段，钳不下就让宿主自己滚。
 *
 * 只在真的装不下时才写 `max-height` / `overflow-y`，装得下就把两样都还回去，
 * 高屏上不许凭空多出一个滚动容器。认字是慢动作，挂滚动条不伤手感。
 *
 * 钳出滚动条之后还要**顺手把选字那一排带进眼里**：光能滚不够，孩子看到的是
 * 「只有两个字」，屏幕上没有任何东西提示底下还藏着第三个（真机实测 320×568
 * 第 41 / 91 / 141 关分别差 39 / 3 / 33px，整颗在裁切线以下）。
 *
 * `relayout` 换一题就叫一次：描红卡与选字卡的高矮差很多，量一次不够。
 */
export function fitQuizHost(host: HTMLElement): { relayout: () => void; dispose: () => void } {
  const view = host.ownerDocument?.defaultView ?? null;
  const measurable = typeof host.getBoundingClientRect === "function" && !!view;
  const relayout = (): void => {
    if (!measurable || !view) return;
    // 先把上一次钳出来的值还原，不然量到的是钳完的高度，越量越小
    host.style.maxHeight = "";
    host.style.overflowY = "";
    host.style.overscrollBehavior = "";
    host.scrollTop = 0;
    const bottoms: number[] = [];
    for (let p = host.parentElement; p; p = p.parentElement) {
      const oy = view.getComputedStyle(p).overflowY;
      if (oy === "auto" || oy === "scroll" || oy === "hidden") bottoms.push(p.getBoundingClientRect().bottom);
    }
    const room = visibleRoomPx(host.getBoundingClientRect().top, bottoms);
    if (!Number.isFinite(room) || room <= 0) return;
    if (host.scrollHeight <= room + 1) return;
    host.style.maxHeight = `${Math.floor(room)}px`;
    host.style.overflowY = "auto";
    // 滚到底之后不要把整页一起带走
    host.style.overscrollBehavior = "contain";
    showChoices(host);
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
