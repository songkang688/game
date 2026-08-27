/**
 * 时钟小屋 1.2：把答题屏钳进「舞台真正看得见的那一段」。
 *
 * 第 2 轮档A 监督修复员 W5R2-F-A-01：320×568 上第三个选项整颗掉在裁切线以下——
 * 真机实测（Chrome headless + CDP，`document.elementFromPoint(键心)`）
 * `.qz-choice` 占 y=566..630，而 `.game-stage` 的下沿在 y=554，
 * 这一条链上**一个能滚的祖先都没有**，手指怎么划都够不着。
 * 三个选项少一个 = 那道题可能根本答不了 = 这一关过不去，所以按阻断记。
 *
 * 为什么本款接得住这件事：答题屏是 `quiz99.ts` 渲染的（公共资产，禁改），
 * 但**它挂在哪儿是本款说了算**——给它一个本款自己的宿主 `.clk-quizhost`，
 * 再由这里量一次舞台下沿、把像素值写成宿主自己的 `max-height`。
 * 同一套做法档B 第 1 轮已经在 `shape-kingdom` 上真机验过（`fitIntoStage` / `.shk-quizhost`）。
 *
 * 为什么不能只写 CSS：`max-height:100%` 要有一个**定高**父级才算得出来，
 * 而壳层这条链上 `.l99-stage` / `.l99-stage-wrap` 全是内容撑出来的 auto 高，
 * 那行钳不住任何东西。真正定高的那一层是 `.game-stage`（平台文件，交窗口1），
 * 本款够不着它的 CSS，但够得着它的**盒子**。
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
 * 把答题屏钳进舞台看得见的那一段，钳不下就让宿主自己滚。
 *
 * 只在真的装不下时才写 `max-height` / `overflow-y`，装得下就把两样都还回去——
 * 高屏上不许凭空多出一个滚动容器（那会把选项的投影裁掉）。
 * 答题是慢动作，挂滚动条不伤手感（跑步那种连点游戏才不能挂）。
 *
 * `relayout` 换一题就叫一次：每道题的题面高矮差很多，量一次不够。
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
