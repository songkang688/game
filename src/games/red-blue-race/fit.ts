/**
 * 红蓝跑道 1.2：把这一屏钳进「舞台真正看得见的那一段」。
 *
 * 第 2 轮测试员 W5R2-A-02：360×720 起「🦘 跳」的键心落在舞台裁切线以下点不着，
 * 360×640 上左脚 / 右脚 / 跳三颗全挂——触屏玩家在这两档视口上跳不了。
 * 根因的一半在平台（`.game-stage{overflow:hidden}` 与 `.l99-stage-wrap`，禁改，交窗口1），
 * 另一半是本款自己这一屏太高，这个文件收的是后一半。
 *
 * 两条硬规矩：
 *  1. **能不挂滚动条就不挂。** 这是个连点游戏，能滚就会「想按却滑走了」——
 *     所以两档收紧一律排在滚动前面，能让的高度先让干净。
 *     只有**两档全用尽仍旧装不下**才走最后那一档兜底：横屏 640×360 / 844×390 上
 *     `👟左脚` / `👟右脚` / `🦘跳` **3/3 全部压在裁切线以下，而且一个可滚祖先都没有**，
 *     真手指慢拖一趟纹丝不动——「想按却滑走了」难受，可「一颗都按不着」是跑都跑不动
 *     （W5R3-TA-01）。两者不同价，所以这一档从「一律不挂」改判成「最后才挂」。
 *  2. **热区一分不动。** 收的是抬头条、赛道条、留白与字号；
 *     最狠的一档里跑动键仍有 52px、让分开关仍是 44px，都在触屏口径之上。
 *
 * 为什么不能写成媒体查询：舞台比视口矮一大截（360×640 的机器上这一屏只分到 302px，
 * 视口却有 640px），按 `vh` 判会得出「屏幕够高，不用收」的错误结论——
 * 那正是这条缺陷一直没被 CSS 挡住的原因。只能实测祖先裁切线。
 */

/** 第一档「挤一挤」：收留白与字号，跑动键从两行改一行 */
export const TIGHT_CLASS = "rbr-tight";
/** 第二档「再挤挤」：连抬头条的头像徽章一起收起来，赛道再矮一点 */
export const TIGHTER_CLASS = "rbr-tighter";
/** 第三档兜底：两档收紧全用尽仍装不下，这一屏自己挂滚动条 */
export const SCROLL_CLASS = "rbr-scroll";

/**
 * 两档收紧全用尽之后，滚动口最矮能矮到什么程度——比这还矮就真的不值得钳，
 * 连一颗跑动键的中心点都塞不进去。最狠那一档里跑动键仍是 52px。
 */
export const SCROLL_MIN_ROOM = 52;

/**
 * 从 `selfTop` 往下，舞台真正看得见的还剩多少像素。
 * 取最靠里那一层裁切祖先的下沿；一层都没有（用例里的裸节点）返回 `Infinity`，表示不用收。
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
 * 不减这一刀就白多算 4px，最底下那颗键照旧被切掉一圈（W5R3-TA-05）。
 *
 * 优先走 `clientHeight` 口径；量不出来（用例里的桩节点 / SSR）才退回「减掉下边框宽度」。
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
 * 两档收紧全用尽了，这一屏**还是**装不下吗（W5R3-TA-01）。
 *
 * 横屏 640×360 上这一屏 379px、可视段只有 190px；844×390 上 349 / 220。
 * 走到这一步说明再没有可让的像素了，不兜底就等于把三颗跑动键钉在屏幕外面。
 */
export function needsScroll(wrapHeight: number, roomPx: number, minRoom = SCROLL_MIN_ROOM): boolean {
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
 * 挂上滚动条之后，把跑动键那一排送到孩子眼前（W5R3-TA-01）。
 *
 * 落地的 `scrollTop` 是 0，而跑动键排在这一屏最底下——横屏上钳完只是「有得滚」。
 * 滚**最小的那一段**：键的下沿一进来就收手，上面的赛道尽量留在眼里，
 * 孩子连点的时候仍看得见小人跑到哪儿了。
 *
 * 键下面还压着一条 `.rbr-msg`——「本关新玩法:体力条,看清楚再冲!」那句规则说明。
 * 它跟键**一起**装得进滚动口时就连它一块儿送进来；装不下才只保键：
 * 提示行再往下滚一点就有，可键一旦被顶出去这一关就跑不动了，**两者不同价**。
 */
export function showPads(wrap: HTMLElement): number {
  if (typeof wrap.querySelector !== "function" || typeof wrap.getBoundingClientRect !== "function") return 0;
  const pads = wrap.querySelector(".rbr-pads");
  if (!pads || typeof pads.getBoundingClientRect !== "function") return 0;
  const client = wrap.clientHeight;
  const hostTop = wrap.getBoundingClientRect().top;
  const r = pads.getBoundingClientRect();
  const top = r.top - hostTop + wrap.scrollTop;
  let bottom = top + r.height;
  const msg = wrap.querySelector(".rbr-msg");
  if (msg && typeof msg.getBoundingClientRect === "function") {
    const m = msg.getBoundingClientRect();
    const msgBottom = m.top - hostTop + wrap.scrollTop + m.height;
    if (msgBottom > bottom && msgBottom - top <= client) bottom = msgBottom;
  }
  const next = scrollToShowPx(top, bottom, client, wrap.scrollHeight - client);
  wrap.scrollTop = next;
  return next;
}

/** 这一屏 `contentPx` 高、舞台只看得见 `room`，要不要再收一档 */
export function shouldTighten(room: number, contentPx: number): boolean {
  if (!Number.isFinite(room) || room <= 0) return false;
  return contentPx > room + 1;
}

/**
 * 该给这一屏挂几档。0 = 原样，1 = 挤一挤，2 = 再挤挤。
 * `measure(tier)` 要返回挂上第 tier 档之后这一屏有多高——真量，别估。
 */
export function pickTier(room: number, measure: (tier: 0 | 1 | 2) => number): 0 | 1 | 2 {
  if (!shouldTighten(room, measure(0))) return 0;
  if (!shouldTighten(room, measure(1))) return 1;
  return 2;
}

/** 一层层往上找会裁切的祖先，收集它们真正的那条裁切线（padding box 下沿） */
function clipperBottoms(wrap: HTMLElement, view: Window): number[] {
  const bottoms: number[] = [];
  for (let p = wrap.parentElement; p; p = p.parentElement) {
    const cs = view.getComputedStyle(p);
    const oy = cs.overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "hidden") {
      bottoms.push(clipBottomPx(p.getBoundingClientRect(), p.clientTop, p.clientHeight, cs.borderBottomWidth));
    }
  }
  return bottoms;
}

/**
 * 量一次舞台可视高，装不下就逐档收紧，装得下就把档位摘干净。
 * 返回 `relayout`（仪表盘长出新芯片、换模式、转屏之后再叫一次）与 `dispose`（`destroy` 时拆监听）。
 */
export function fitRaceStage(wrap: HTMLElement): { relayout: () => void; dispose: () => void } {
  const view = wrap.ownerDocument?.defaultView ?? null;
  const measurable = typeof wrap.getBoundingClientRect === "function" && !!view;
  /** 拆台之后那一帧不许再动 DOM（下面补量的 rAF 可能排在 destroy 后面） */
  let live = true;

  const wear = (tier: 0 | 1 | 2): void => {
    wrap.classList.toggle(TIGHT_CLASS, tier >= 1);
    wrap.classList.toggle(TIGHTER_CLASS, tier >= 2);
  };

  /** 兜底那一档留下的东西也要还原，不然下一次量到的是钳完的高度 */
  const resetScroll = (): void => {
    wrap.classList?.toggle?.(SCROLL_CLASS, false);
    if (wrap.style) {
      wrap.style.maxHeight = "";
      wrap.style.overflowY = "";
      wrap.style.overscrollBehavior = "";
    }
  };

  const relayout = (): void => {
    if (!measurable || !view || !live) return;
    // 先摘干净再量：量到的必须是「本来有多高」，不然收完装得下就以为本来就装得下,越量越松
    wear(0);
    resetScroll();
    const room = visibleRoomPx(wrap.getBoundingClientRect().top, clipperBottoms(wrap, view));
    wear(
      pickTier(room, (tier) => {
        wear(tier);
        return wrap.getBoundingClientRect().height;
      })
    );
    // 两档全用尽还是装不下（横屏 640×360 / 844×390 就是这样）：最后一档兜底。
    // 跑动键自己写着 `touch-action:manipulation`，停着不动的那一下照旧算点击，
    // 真想滚就得刻意划一道——「按不着」和「偶尔滑走」不是同一个量级的事（W5R3-TA-01）。
    if (!needsScroll(wrap.scrollHeight, room)) return;
    wrap.classList?.toggle?.(SCROLL_CLASS, true);
    if (!wrap.style) return;
    wrap.style.maxHeight = `${Math.floor(room)}px`;
    wrap.style.overflowY = "auto";
    // 翻到底不要把外面那层也带着走
    wrap.style.overscrollBehavior = "contain";
    showPads(wrap);
  };

  relayout();
  // 平台顶栏在窄屏上会折行，折完这一屏的起点往下挪几像素——下一帧再量一次才准
  const raf = view?.requestAnimationFrame;
  if (typeof raf === "function") raf.call(view, () => relayout());
  view?.addEventListener("resize", relayout);
  return {
    relayout,
    dispose(): void {
      live = false;
      view?.removeEventListener("resize", relayout);
      wear(0);
      resetScroll();
    },
  };
}
