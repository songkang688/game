/**
 * 红蓝拔河 1.2：把关内那一屏钳进「舞台真正看得见的那一段」。
 *
 * 窗口5 第 2 轮档C 监督修复员 W5R2-FC-03。第 2 轮学习优化员判「这一款不用单独收紧」，
 * 依据是 LC-02 把模式条收起来之后舞台裁掉 0；我按同一把尺子（Chrome headless + CDP，
 * `document.elementFromPoint`）复量，360×640 上还裁 **63px**、320×640 上裁 **95px**。
 *
 * 差在哪儿：逐颗数按钮的复量只照得到按钮。裁掉的那一段里装的是
 * `.rbg-msg`——「看到 🟢 才按住拉，🔴 时松手歇着攒体力!」这类**规则说明与即时反馈**，
 * 它不是按钮，`elementFromPoint` 那把尺子照不到，于是就成了「够不着 0 颗」的绿灯。
 * 红绿灯章不知道这句话就等于不知道怎么玩。
 *
 * 为什么非用 JS 量不可：真正定高的那一层是 `.game-stage`（`src/styles.css`，禁改，
 * 交窗口1），中间的 `.l99-stage` / `.l99-stage-wrap` 全是内容撑出来的 auto 高，
 * 写 `max-height:100%` 算不出任何东西；而 `@media (max-height:…)` 问的是屏高，
 * 360×640 的机器屏高 640，可这一款只分到 530px，平台顶栏再吃掉 116px——问错了对象。
 *
 * 收谁：拔河场 `.rbg-field`。它是这一屏里唯一「矮一点也照样玩」的块——
 * 旗子、绳子、两个人都是按百分比定位的，收矮之后仍旧看得出绳子偏哪边。
 * 底线 76px：再矮旗子和两个头像就叠在一起了。
 */

/** 拔河场再收也得留这么高，不然看不出绳子偏哪边 */
export const MIN_FIELD_H = 76;

/**
 * 两颗大按钮再收也得留这么高——手指按得准的下限是 44px，这里留 56px，
 * 因为按钮里是两行字（「🪢 用力拉」+「按住 F / 空格」），56 以下第二行就压没了。
 */
export const MIN_PULL_H = 56;

/**
 * 从 `selfTop` 往下，舞台真正看得见的还剩多少像素。
 * 取最靠里那一层裁切祖先的下沿；一层都没有（用例里的裸节点）返回 `Infinity`，表示不用钳。
 */
export function visibleRoomPx(selfTop: number, clipperBottoms: readonly number[]): number {
  if (clipperBottoms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...clipperBottoms) - selfTop;
}

/**
 * 这一屏超出可视段多少，拔河场就该收到多高。
 *
 * 返回 `null` 表示装得下 / 量不出来，照原样别管——高屏上不许平白改动布局。
 * 只超 1px 也当装得下：那一格是子像素误差，为它抖来抖去反而难看。
 */
export function fieldRoomPx(
  wrapHeight: number,
  fieldHeight: number,
  roomPx: number,
  minField = MIN_FIELD_H
): number | null {
  if (!Number.isFinite(roomPx) || roomPx <= 0) return null;
  if (!Number.isFinite(wrapHeight) || !Number.isFinite(fieldHeight) || fieldHeight <= 0) return null;
  const over = wrapHeight - roomPx;
  if (over <= 1) return null;
  return Math.max(minField, Math.floor(fieldHeight - over));
}

/**
 * 一层裁切祖先真正的那条裁切线。
 *
 * 滚动口是 **padding box**，下边框那几像素照不进内容；
 * `getBoundingClientRect().bottom` 给的却是 border box 的下沿。
 * `.game-stage` 写着 `border:4px solid #fff`，不减这一刀就白多算 4px——
 * 320×640 上拔河场因此还是压不住 `.rbg-msg`。量不出宽度就当没有，绝不算成 NaN。
 */
export function clipBottomPx(bottom: number, borderBottom: string): number {
  const w = Number.parseFloat(borderBottom);
  return Number.isFinite(w) && w > 0 ? bottom - w : bottom;
}

/**
 * 竖向节奏减半能让出多少像素：块间距 8→4 共四处 16px、提示行上边距 8→4 共 4px、
 * 外框上下内边距 12→6 共 12px，一共 32px。改一处就要改这个数，`tightFit.test.ts` 盯着。
 */
export const TIGHT_SAVING_PX = 32;

/**
 * 拔河场已经收到底线了还装不下吗——装不下就得把这一屏的竖向节奏压一档。
 *
 * 只在**场地无路可退**时才判 true：场地还扣得动就先扣场地，
 * 少动一次布局就少一次「换个视口整屏跳一下」。
 */
export function needsTight(
  wrapHeight: number,
  fieldHeight: number,
  roomPx: number,
  minField = MIN_FIELD_H
): boolean {
  if (!Number.isFinite(roomPx) || roomPx <= 0) return false;
  if (!Number.isFinite(wrapHeight) || !Number.isFinite(fieldHeight) || fieldHeight <= 0) return false;
  if (wrapHeight - roomPx <= 1) return false;
  return fieldHeight <= minField;
}

/**
 * 空隙减半之后**还是**装不下吗——那就得连字号一起收一档（W5R3-B-02）。
 *
 * 判据和 `needsTight` 是同一个形状，只是问的是「下一档」：
 * 场地已经在底线上、`rbg-tight` 也已经挂上了，这一屏却仍旧比可视段高。
 */
export function needsTighter(wrapHeight: number, roomPx: number): boolean {
  if (!Number.isFinite(roomPx) || roomPx <= 0) return false;
  if (!Number.isFinite(wrapHeight)) return false;
  return wrapHeight - roomPx > 1;
}

/**
 * 字号也收完还超出多少，两颗大按钮就该收到多高。
 *
 * 和 `fieldRoomPx` 同一套算法，只是底线换成 `MIN_PULL_H`。
 * 返回 `null` 表示装得下 / 量不出来，照原样别管。
 */
export function pullRoomPx(
  wrapHeight: number,
  pullHeight: number,
  roomPx: number,
  minPull = MIN_PULL_H
): number | null {
  if (!Number.isFinite(roomPx) || roomPx <= 0) return null;
  if (!Number.isFinite(wrapHeight) || !Number.isFinite(pullHeight) || pullHeight <= 0) return null;
  const over = wrapHeight - roomPx;
  if (over <= 1) return null;
  return Math.max(minPull, Math.floor(pullHeight - over));
}

/**
 * 四档收紧全用尽之后,滚动口最矮能矮到什么程度——比这还矮就真的不值得钳,
 * 连一颗大按钮的中心点都塞不进去。一颗按钮的底线正好是 `MIN_PULL_H`。
 */
export const SCROLL_MIN_ROOM = MIN_PULL_H;

/**
 * 四档（扣场地 → 减空隙 → 收字号 → 扣按钮）全用尽了,这一屏**还是**装不下吗。
 *
 * 走到这一步说明再没有可让的像素了。以前这里就直接收手,后果分两档:
 * - 320×568 第 181 关:`.rbg-wrap` 358px、可视段 330px,
 *   `.rbg-msg`「💧 补给被对面拿走了,稳住自己的节奏」**`vis 0/16`,整句一个像素都看不见**(W5R3-C-05);
 * - 横屏 640×360 / 844×390:这一屏 311 / 288px、可视段只有 190 / 220px,
 *   **两颗拉绳钮 2/2 全部落在裁切线以下,而且一个可滚祖先都没有**,
 *   真手指慢拖八趟一颗都救不回来——这一款横屏上纯触屏一步都走不动(W5R3-C-04)。
 */
export function needsScroll(wrapHeight: number, roomPx: number, minRoom = SCROLL_MIN_ROOM): boolean {
  if (!Number.isFinite(roomPx) || roomPx < minRoom) return false;
  if (!Number.isFinite(wrapHeight) || wrapHeight <= 0) return false;
  return wrapHeight - roomPx > 1;
}

/**
 * 要把 `[top, bottom]` 这一段送进眼前,`scrollTop` 该写多少（滚最小的那一段）。
 * 这一段比滚动口还高就从它的上沿开始露;量不出数 / 没得滚就返回 0。
 */
export function scrollToShowPx(top: number, bottom: number, client: number, max: number): number {
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return 0;
  if (!(client > 0) || !(max > 0)) return 0;
  const want = bottom - top > client ? top : bottom - client;
  return Math.max(0, Math.min(max, Math.round(want)));
}

/**
 * 挂上滚动条之后，把两颗拉绳钮送到孩子眼前（W5R3-C-04）。
 *
 * 落地的 `scrollTop` 是 0，而两颗大按钮排在这一屏最底下——横屏上钳完只是「有得滚」。
 * 滚**最小的那一段**：按钮的下沿一进来就收手，上面的拔河场尽量留在眼里，
 * 孩子按住的时候仍看得见绳子偏向哪一边。
 *
 * 按钮下面还剩一条 `.rbg-msg`，这里**故意不把它一起算进去**：
 * 提示行再往下滚一点就有，可按钮一旦被顶出去这一关就没法玩了，两者不同价。
 */
export function showPull(wrap: HTMLElement): number {
  if (typeof wrap.querySelector !== "function" || typeof wrap.getBoundingClientRect !== "function") return 0;
  const pull = wrap.querySelector(".rbg-ctrl") ?? wrap.querySelector(".rbg-pull");
  if (!pull || typeof pull.getBoundingClientRect !== "function") return 0;
  const r = pull.getBoundingClientRect();
  const top = r.top - wrap.getBoundingClientRect().top + wrap.scrollTop;
  const next = scrollToShowPx(top, top + r.height, wrap.clientHeight, wrap.scrollHeight - wrap.clientHeight);
  wrap.scrollTop = next;
  return next;
}

/** 量一次这个节点头顶到最近那条裁切线之间还剩多少（量不了就返回 Infinity） */
export function stageRoomPx(el: HTMLElement): number {
  const view = el.ownerDocument?.defaultView ?? null;
  if (!view || typeof el.getBoundingClientRect !== "function") return Number.POSITIVE_INFINITY;
  const bottoms: number[] = [];
  for (let p = el.parentElement; p; p = p.parentElement) {
    const cs = view.getComputedStyle(p);
    const oy = cs.overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "hidden") {
      bottoms.push(clipBottomPx(p.getBoundingClientRect().bottom, cs.borderBottomWidth));
    }
  }
  return visibleRoomPx(el.getBoundingClientRect().top, bottoms);
}

/**
 * 把 `.rbg-wrap` 这一屏钳进可视段：超出多少就从拔河场身上扣多少。
 *
 * **能不挂滚动条就不挂**：拔河是按住不放的连点玩法，一挂滚动条手指一滑就松了力，
 * 「想按却滑走了」比场地矮一点难受得多（`landlord-cards` 那一轮同款判断）。
 * 所以四档收紧（扣场地 → 减空隙 → 收字号 → 扣按钮）一律排在滚动前面，
 * 只有**四档全用尽仍装不下**才走最后那一档兜底。
 *
 * 兜底那一档为什么不会把「按住蓄力」弄丢：`.rbg-pull` 自己写着 `touch-action:none`
 * （`index.ts` 的 `RBG_CSS`），手指落在按钮上时浏览器根本不会把这一下当成滚动手势，
 * 按住多久就是多久。会滚的只有按钮以外的地方，而那些地方本来也没什么可按的。
 *
 * 每次量之前先把上一次收出来的高度还原，不然量到的是收完的高度，越量越小。
 * 换窗口大小 / 转屏时重量一次；`dispose()` 把监听摘掉并还原。
 */
export function fitFieldIntoStage(wrap: HTMLElement): { relayout: () => void; dispose: () => void } {
  const view = wrap.ownerDocument?.defaultView ?? null;
  const field =
    typeof wrap.querySelector === "function" ? (wrap.querySelector(".rbg-field") as HTMLElement | null) : null;
  const measurable = !!view && !!field && typeof wrap.getBoundingClientRect === "function";
  const pulls = (): HTMLElement[] =>
    typeof wrap.querySelectorAll === "function"
      ? (Array.from(wrap.querySelectorAll(".rbg-pull")) as HTMLElement[])
      : [];
  /**
   * 把按钮高度的自定义属性还原成「这一次重绘写进来的那个内联高度」。
   * 不能直接 `removeProperty`：收紧档的 CSS 规则带 `!important`，
   * 属性一空高度就掉成 `auto`，按钮当场塌成一行字（比切掉 25px 还糟）。
   */
  const resetPull = (p: HTMLElement): void => {
    const base = p.style?.height;
    if (base) p.style.setProperty("--rbg-pull-h", base);
    else p.style?.removeProperty?.("--rbg-pull-h");
  };
  /** 兜底那一档留下的东西也要还原，不然下一次量到的是钳完的高度 */
  const resetScroll = (): void => {
    wrap.classList?.remove("rbg-scroll");
    wrap.style.maxHeight = "";
    wrap.style.overflowY = "";
  };
  const relayout = (): void => {
    if (!measurable || !field) return;
    field.style.height = "";
    wrap.classList.remove("rbg-tight");
    wrap.classList.remove("rbg-tighter");
    resetScroll();
    for (const p of pulls()) resetPull(p);
    const room = stageRoomPx(wrap);
    const next = fieldRoomPx(wrap.scrollHeight, field.offsetHeight, room);
    if (next === null) return;
    field.style.height = `${next}px`;
    // 场地退到底线还装不下（320×640 就是这样）：把这一屏的空隙减半，再让场地扣一次
    if (!needsTight(wrap.scrollHeight, next, room)) return;
    wrap.classList.add("rbg-tight");
    field.style.height = "";
    const tighter = fieldRoomPx(wrap.scrollHeight, field.offsetHeight, room);
    field.style.height = `${tighter ?? next}px`;
    // 空隙减半也不够（320×568 后段章节：机关胶囊排到三行，把 .rbg-msg 整条顶出裁切线，
    // 两颗大按钮也被切掉 25px）。再往下走两档：先收字号，还不够才收按钮。W5R3-B-02
    if (!needsTighter(wrap.scrollHeight, room)) return;
    wrap.classList.add("rbg-tighter");
    field.style.height = "";
    const tightest = fieldRoomPx(wrap.scrollHeight, field.offsetHeight, room);
    field.style.height = `${tightest ?? tighter ?? next}px`;
    const btns = pulls();
    if (btns.length > 0) {
      const nextPull = pullRoomPx(wrap.scrollHeight, btns[0].offsetHeight, room);
      // 按钮的高是 JS 按视口算完写成内联 `height` 的（`layout.height`），
      // 直接改那一处会被下一次重绘覆盖；改自定义属性，CSS 里那条优先级更高的规则认它。
      if (nextPull !== null) for (const p of btns) p.style.setProperty("--rbg-pull-h", `${nextPull}px`);
    }
    // 四档全用尽还是装不下（横屏两档、320×568 后段章节）：最后一档兜底，
    // 让这一屏自己滚，并顺手把两颗大按钮送进眼里——不然钳完也只是「有得滚」，
    // 五六岁的孩子不会想到先把屏幕往上推（W5R3-C-04 / W5R3-C-05）。
    if (!needsScroll(wrap.scrollHeight, room)) return;
    wrap.classList.add("rbg-scroll");
    wrap.style.maxHeight = `${Math.floor(room)}px`;
    wrap.style.overflowY = "auto";
    showPull(wrap);
  };
  relayout();
  // 平台顶栏在窄屏上会折行，折完这一屏的起点往下挪几像素——下一帧再量一次才准
  const raf = view?.requestAnimationFrame;
  if (typeof raf === "function") raf.call(view, () => relayout());
  view?.addEventListener("resize", relayout);
  return {
    relayout,
    dispose(): void {
      view?.removeEventListener("resize", relayout);
      wrap.classList?.remove("rbg-tight");
      wrap.classList?.remove("rbg-tighter");
      resetScroll();
      for (const p of pulls()) p.style?.removeProperty?.("--rbg-pull-h");
      if (field) field.style.height = "";
    }
  };
}
