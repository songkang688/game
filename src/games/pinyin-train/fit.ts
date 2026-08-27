/**
 * 拼音小火车 1.2：把答题屏钳进「舞台真正看得见的那一段」。
 *
 * 窗口5 第 2 轮档C 监督修复员 W5R2-FC-01（严重）。
 *
 * 病灶：360×640 / 320×640 上 `.game-stage` 裁掉 33–77px，掉在裁切线以下的是
 * `.qz-msg`——「答对啦！真棒！」「别着急，慢慢来～」这一行。它是这一款唯一的
 * 即时反馈位，**失败只鼓励**这条红线就落在这一行上，连错两次的悄悄提示也在这儿。
 * 这条链上一个可滚祖先都没有，所以不是「滚一下就看得见」，是永远看不见：
 * 孩子在矮屏上答完一题，屏幕上什么都不会发生。
 *
 * 上一轮逐颗 `elementFromPoint` 的复量给的是「够不着 0 颗」——那把尺子只照按钮，
 * 而这一行不是按钮。
 *
 * 为什么本款接得住：答题屏是 `quiz99.ts` 渲的（平台共享模块，禁改），
 * 但**它渲到哪个盒子里是本款说了算**。给它一个本款自己的宿主，
 * 由这里量一次舞台下沿、把像素值写成宿主自己的 `max-height`。
 * 同一套做法档A 第 2 轮已经在 `clock-house` / `word-garden` 上真机验过
 * （`fitQuizHost` / `.clk-quizhost`），更早还有 `shape-kingdom`。
 *
 * 为什么不能只写 CSS：`max-height:100%` 要有一个**定高**父级才算得出来，
 * 而这条链上 `.l99-stage` / `.l99-stage-wrap` 全是内容撑出来的 auto 高。
 * 真正定高的那一层是 `.game-stage`（`src/styles.css`，禁改，交窗口1），
 * 本款够不着它的 CSS，但够得着它的**盒子**。
 *
 * 钳完还要**把该看的那一段带进眼里**：光能滚不够，屏幕上没有任何东西告诉孩子
 * 底下还有字。有反馈话就露反馈话，没有就露选项整排。
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
 * 滚**最小的那一下**：只要下沿进来就收手，题面尽量留在眼前。
 * 这一段自己比可视段还高就从它的上沿开始露，先看得见头。
 * 量不出可视段、或者根本没得滚，就返回 0——不平白往 DOM 上写一个 `scrollTop`。
 */
export function scrollToShowPx(top: number, bottom: number, client: number, max: number): number {
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return 0;
  if (!(client > 0) || !(max > 0)) return 0;
  const want = bottom - top > client ? top : bottom - client;
  return Math.max(0, Math.min(max, Math.round(want)));
}

/**
 * 这一刻该把哪一段带进眼里。
 *
 * 反馈行一有字就先露它——那一句是孩子答完之后唯一的回应；
 * 还没答（或者已经换到下一题、反馈行被清空）就露选项整排，
 * 免得屏幕上只看得见两个选项、第三个藏在折线底下。
 */
export function revealTargetOf(msgText: string | null | undefined): ".qz-msg" | ".qz-choices" {
  return typeof msgText === "string" && msgText.trim().length > 0 ? ".qz-msg" : ".qz-choices";
}

function revealBand(host: HTMLElement): void {
  if (typeof host.querySelector !== "function") return;
  const msg = host.querySelector(".qz-msg") as HTMLElement | null;
  const sel = revealTargetOf(msg?.textContent ?? null);
  const target = (sel === ".qz-msg" ? msg : host.querySelector(".qz-choices")) as HTMLElement | null;
  if (!target || typeof target.getBoundingClientRect !== "function") return;
  const hostTop = host.getBoundingClientRect().top;
  const r = target.getBoundingClientRect();
  const top = r.top - hostTop + host.scrollTop;
  host.scrollTop = scrollToShowPx(top, top + r.height, host.clientHeight, host.scrollHeight - host.clientHeight);
}

/**
 * 把答题屏钳进可视段，钳不下就让宿主自己滚，并把该看的那一段带进眼里。
 *
 * 只在真的装不下时才写 `max-height` / `overflow-y`，装得下就把两样都还回去——
 * 高屏上不许凭空多出一个滚动容器（那会把选项的投影裁掉）。
 * 答题是慢动作，挂滚动条不伤手感（拔河那种按住不放的玩法才不能挂）。
 *
 * 换题 / 出反馈话都要重量一次。`quiz99.ts` 没有给这种回调，也不许为此去改它，
 * 所以靠 `MutationObserver` 听宿主里的内容变化——只听 `childList` 与
 * `characterData`，**不听 `attributes`**：钳位写的是宿主自己的行内样式，
 * 听了就会自己触发自己。
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
    revealBand(host);
  };

  let queued = false;
  const schedule = (): void => {
    if (queued || !view) return;
    queued = true;
    const raf = view.requestAnimationFrame;
    const run = (): void => {
      queued = false;
      relayout();
    };
    if (typeof raf === "function") raf.call(view, run);
    else view.setTimeout(run, 16);
  };

  relayout();
  // 平台顶栏在窄屏上会折行，折完这一屏的起点往下挪几像素——下一帧再量一次才准
  schedule();

  const Obs = (view as unknown as { MutationObserver?: typeof MutationObserver })?.MutationObserver;
  const watcher = typeof Obs === "function" ? new Obs(schedule) : null;
  watcher?.observe(host, { childList: true, subtree: true, characterData: true });
  view?.addEventListener("resize", relayout);

  return {
    relayout,
    dispose(): void {
      watcher?.disconnect();
      view?.removeEventListener("resize", relayout);
      host.style.maxHeight = "";
      host.style.overflowY = "";
      host.style.overscrollBehavior = "";
    }
  };
}
