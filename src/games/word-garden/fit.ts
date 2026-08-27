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
 * 一层裁切祖先真正的那条裁切线：**padding box 的下沿**，不是 border box 的。
 *
 * 滚动口是 padding box，下边框那几像素照不进内容；`getBoundingClientRect().bottom`
 * 给的却是 border box 的下沿。`.game-stage` 写着 `border:4px solid #fff`，
 * 于是钳出来的天花板**恒定比真裁切线低 4px**（第 3 轮测试员 A7 逐格量到的固定差值，
 * 本档五档视口复量也全是 4：334/330、406/402、194/190、224/220——W5R3-TA-05）。
 *
 * 优先走 `clientHeight` 口径；量不出来（用例里的桩节点 / SSR）才退回「减掉下边框宽度」。
 * 那圈 4px 边框本身在 `src/styles.css`（禁改），交窗口1；这里改的只是**自己量的那把尺子**。
 */
export function clipBottomPx(
  rect: { top: number; bottom: number },
  clientTop: number,
  clientHeight: number,
  borderBottomWidth: string
): number {
  if (Number.isFinite(clientTop) && Number.isFinite(clientHeight) && clientHeight > 0) {
    return rect.top + clientTop + clientHeight;
  }
  const w = Number.parseFloat(borderBottomWidth);
  return Number.isFinite(w) && w > 0 ? rect.bottom - w : rect.bottom;
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

/**
 * 钳出滚动条那一档挂在宿主上的记号。
 *
 * 描红台底下那条 `.wgd-msg` 靠它才粘到可视区下沿——`position:sticky` 要有一个**真在滚**的
 * 祖先才算数，装得下的高屏上宿主并不滚，那时粘性的参照物会变成整个视口，
 * 那句话就会跑到屏幕最底下去。所以这条记号只在**真的钳住了**的时候才挂。
 */
export const SCROLL_CLASS = "wgd-scroll";

/**
 * 「该送进眼里的那一段」的选择器，按优先级从前往后找第一个找得到的：
 *  - `.qz-choices`：答题屏（`quiz99.ts` 渲染，W5R2-F-A-02）；
 *  - `.bc-choices`：组字工坊（W5R3-A-02）；
 *  - `.wgd-padwrap`：描红台的田字格——这一屏没有选项排，要用手指去碰的是格子本身。
 *
 * 描红台原先一条都对不上，于是钳完只是「有得滚」：真机 320×568 / 360×640 上
 * `.wgd-msg` 整句 `26px` 露 `0px`，横屏 640×360 上连田字格自己都只露 101/300（W5R3-TA-03）。
 */
const FOCUS_ROWS = ".qz-choices,.bc-choices,.wgd-padwrap";

/**
 * 粘在滚动口下沿那一行吃掉了多少净空间。
 *
 * 描红台的 `.wgd-msg` 钳住之后是 `position:sticky;bottom:0`——它恒占滚动口最下面那一条，
 * 不减掉它，送进来的那一段就正好停在它底下（`kitty-care` 第 3 轮档C 踩过同一个坑）。
 * 没有粘住的行、或者量不出来，就返回 0，行为与改前一模一样。
 */
export function stickyTailPx(host: HTMLElement): number {
  const view = host.ownerDocument?.defaultView ?? null;
  if (!view || typeof host.querySelector !== "function") return 0;
  const tail = host.querySelector(".wgd-msg");
  if (!tail || typeof tail.getBoundingClientRect !== "function") return 0;
  const pos = view.getComputedStyle(tail as HTMLElement).position;
  if (pos !== "sticky") return 0;
  const h = tail.getBoundingClientRect().height;
  return Number.isFinite(h) && h > 0 ? h : 0;
}

/** 把该看的那一段带进宿主的可视段（宿主已经是滚动容器了才叫得动） */
function showFocus(host: HTMLElement): void {
  const row = typeof host.querySelector === "function" ? host.querySelector(FOCUS_ROWS) : null;
  if (!row || typeof row.getBoundingClientRect !== "function") return;
  const hostTop = host.getBoundingClientRect().top;
  const r = row.getBoundingClientRect();
  const top = r.top - hostTop + host.scrollTop;
  // 净空间＝滚动口高度减掉粘在下沿那一行；不然田字格正好停在那句提示底下
  const client = Math.max(0, host.clientHeight - stickyTailPx(host));
  host.scrollTop = scrollToShowPx(top, top + r.height, client, host.scrollHeight - host.clientHeight);
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
    host.style.minHeight = "";
    host.style.overflowY = "";
    host.style.overscrollBehavior = "";
    host.classList?.toggle?.(SCROLL_CLASS, false);
    host.scrollTop = 0;
    const bottoms: number[] = [];
    for (let p = host.parentElement; p; p = p.parentElement) {
      const cs = view.getComputedStyle(p);
      const oy = cs.overflowY;
      if (oy === "auto" || oy === "scroll" || oy === "hidden") {
        bottoms.push(clipBottomPx(p.getBoundingClientRect(), p.clientTop, p.clientHeight, cs.borderBottomWidth));
      }
    }
    const room = visibleRoomPx(host.getBoundingClientRect().top, bottoms);
    if (!Number.isFinite(room) || room <= 0) return;
    if (host.scrollHeight <= room + 1) return;
    host.style.maxHeight = `${Math.floor(room)}px`;
    // `min-height` 赢 `max-height`：组字工坊的 `.bc-wrap` 写着 `min-height:380px`，
    // 可视段比它矮时钳位整条空转——真机 320×568 第 188 关量到 maxHeight 已经写成 301px，
    // 盒子却还是 380px 高，`.bc-msg` 那行反馈照样落在裁切线以下（W5R3-A-02 复测）。
    // 钳住的这一次把下限一起松开；松回去的那一路上面已经清空了，两边成对。
    host.style.minHeight = "0";
    host.style.overflowY = "auto";
    // 滚到底之后不要把整页一起带走
    host.style.overscrollBehavior = "contain";
    // 真的钳住了才挂这条记号：描红台那句「这一笔该怎么描」靠它粘到可视区下沿
    host.classList?.toggle?.(SCROLL_CLASS, true);
    showFocus(host);
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
