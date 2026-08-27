/**
 * 朵朵抢地主 1.2：把这一桌钳进「舞台真正看得见的那一段」。
 *
 * 第 2 轮测试员 W5R2-A-05：360×640 上「⏸ 暂停」的键心落在舞台裁切线以下 43px，
 * 真实坐标点不着——孩子想暂停只能退出重来。再往下到 320×568，叫地主那一排
 * 「不叫 / 1 分 / 2 分 / 3 分」四颗一起挂掉，连开局都开不了。
 * 根因的一半在平台（`.game-stage{overflow:hidden}`，禁改，交窗口1），
 * 另一半是本款自己这一桌太高，这个文件收的是后一半。
 *
 * 收的都是留白、字号与对家面板上的装饰小牌背；
 * 出牌那一排 48px、底下那一排 44px、以及手牌本身，一分不动——
 * 那三样是玩法本身，为了「装得下」把热区收到 44 以下等于换一种点不着。
 *
 * 为什么不能写成媒体查询：舞台比视口矮一大截（360×640 的机器上这一桌只分到 356px，
 * 视口却有 640px），按 `vh` 判会得出「屏幕够高，不用收」的错误结论。
 */

/** 第一档「挤一挤」：收留白与字号 */
export const TIGHT_CLASS = "ldc-tight";
/** 第二档「再挤挤」：对家面板上的小牌背收起来，只留「还剩几张」 */
export const TIGHTER_CLASS = "ldc-tighter";
/** 第三档兜底：两档收紧全用尽仍装不下，这一桌自己挂滚动条 */
export const SCROLL_CLASS = "ldc-scroll";

/**
 * 两档收紧全用尽之后，滚动口最矮能矮到什么程度——比这还矮就真的不值得钳，
 * 连一颗出牌键的中心点都塞不进去。出牌那一排写的正是 `min-height:48px`。
 */
export const SCROLL_MIN_ROOM = 48;

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
 * 不减这一刀就白多算 4px——真机 320×568 上「⏸ 暂停」下沿因此超出裁切线 3px（露 41/44）。
 *
 * 优先走 `clientHeight` 口径（`rect.top + clientTop + clientHeight`，横向滚动条也一并算掉）；
 * 量不出来（用例里的桩节点 / SSR）才退回「减掉下边框宽度」，再不行就照原样返回。
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

/** 这一桌 `contentPx` 高、舞台只看得见 `room`，要不要再收一档 */
export function shouldTighten(room: number, contentPx: number): boolean {
  if (!Number.isFinite(room) || room <= 0) return false;
  return contentPx > room + 1;
}

/**
 * 该给这一桌挂几档。0 = 原样，1 = 挤一挤，2 = 再挤挤。
 * `measure(tier)` 要返回挂上第 tier 档之后这一桌有多高——真量，别估。
 */
export function pickTier(room: number, measure: (tier: 0 | 1 | 2) => number): 0 | 1 | 2 {
  if (!shouldTighten(room, measure(0))) return 0;
  if (!shouldTighten(room, measure(1))) return 1;
  return 2;
}

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
 * 两档收紧全用尽了，这一桌**还是**装不下吗。
 *
 * 走到这一步说明再没有可让的像素了。以前这里就直接收手，横屏上的后果是：
 * 640×360 / 844×390 两档上叫地主那一排四颗 + 「⏸ 暂停」**5/5 全部压在裁切线以下，
 * 而且一个可滚祖先都没有**——真手指慢拖一趟纹丝不动，`0 / 24` 一颗救不回来。
 * 叫不了地主这一局就开不了，纯触屏在横屏上一步都走不动（W5R3-TA-01）。
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
 * 挂上滚动条之后，把动手那一排送到孩子眼前（W5R3-TA-01）。
 *
 * 落地的 `scrollTop` 是 0，而叫地主 / 出牌那一排排在这一桌最底下——横屏上钳完只是「有得滚」，
 * 五六岁的孩子不会想到先把屏幕往上推。滚**最小的那一段**：出牌那一排的下沿一进来就收手，
 * 上面的牌桌和手牌尽量留在眼里。
 *
 * 底下那一排（`↩️ 重选` / `⏸ 暂停`）跟出牌那一排**一起**装得进滚动口时就连它一块儿送进来；
 * 装不下才只保出牌那一排——暂停键再往下滚一点就有，可出牌键被顶出去这一局就没法打了，
 * **两者不同价**，这个先后不许换。
 */
export function showCtrl(wrap: HTMLElement): number {
  if (typeof wrap.querySelector !== "function" || typeof wrap.getBoundingClientRect !== "function") return 0;
  const main = wrap.querySelector(".ldc-mainbar");
  if (!main || typeof main.getBoundingClientRect !== "function") return 0;
  const client = wrap.clientHeight;
  const hostTop = wrap.getBoundingClientRect().top;
  const r = main.getBoundingClientRect();
  const top = r.top - hostTop + wrap.scrollTop;
  let bottom = top + r.height;
  const sub = wrap.querySelector(".ldc-subbar");
  if (sub && typeof sub.getBoundingClientRect === "function") {
    const s = sub.getBoundingClientRect();
    const subBottom = s.top - hostTop + wrap.scrollTop + s.height;
    if (subBottom > bottom && subBottom - top <= client) bottom = subBottom;
  }
  const next = scrollToShowPx(top, bottom, client, wrap.scrollHeight - client);
  wrap.scrollTop = next;
  return next;
}

/**
 * 量一次舞台可视高，装不下就逐档收紧。
 * `onTier` 在档位真的变了的时候叫一次——手牌扇的高度是 JS 摆出来的，
 * 不跟着重摆一次，CSS 收出来的那点空间会被扇形原样占回去。
 */
export function fitTableStage(
  wrap: HTMLElement,
  onTier?: (tier: 0 | 1 | 2) => void
): { relayout: () => void; dispose: () => void } {
  const view = wrap.ownerDocument?.defaultView ?? null;
  const measurable = typeof wrap.getBoundingClientRect === "function" && !!view;
  let worn: 0 | 1 | 2 = 0;
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
    // 先摘干净再量：量到的必须是「本来有多高」，不然收完装得下就以为本来就装得下
    wear(0);
    resetScroll();
    const room = visibleRoomPx(wrap.getBoundingClientRect().top, clipperBottoms(wrap, view));
    const tier = pickTier(room, (t) => {
      wear(t);
      return wrap.getBoundingClientRect().height;
    });
    wear(tier);
    if (tier !== worn) {
      worn = tier;
      onTier?.(tier);
    }
    // 两档全用尽还是装不下（横屏 640×360 / 844×390 就是这样）：最后一档兜底，
    // 让这一桌自己滚，并顺手把动手那一排送进眼里——不然钳完也只是「有得滚」。
    // 手牌扇自己写着 `touch-action:none`（`.ld-fanbox`），落在牌上的手指不会带着壳一起滚，
    // 「横着划一道框选好几张」那一手照旧（W5R3-TA-01）。
    if (!needsScroll(wrap.scrollHeight, room)) return;
    wrap.classList?.toggle?.(SCROLL_CLASS, true);
    if (!wrap.style) return;
    wrap.style.maxHeight = `${Math.floor(room)}px`;
    wrap.style.overflowY = "auto";
    // 翻到底不要把外面那层也带着走
    wrap.style.overscrollBehavior = "contain";
    showCtrl(wrap);
  };

  relayout();
  // 平台顶栏在窄屏上会折行，折完这一桌的起点往下挪几像素——下一帧再量一次才准
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
      worn = 0;
    },
  };
}
