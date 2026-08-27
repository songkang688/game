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
 * **不挂滚动条**：拔河是按住不放的连点玩法，一挂滚动条手指一滑就松了力，
 * 「想按却滑走了」比场地矮一点难受得多（`landlord-cards` 那一轮同款判断）。
 *
 * 每次量之前先把上一次收出来的高度还原，不然量到的是收完的高度，越量越小。
 * 换窗口大小 / 转屏时重量一次；`dispose()` 把监听摘掉并还原。
 */
export function fitFieldIntoStage(wrap: HTMLElement): { relayout: () => void; dispose: () => void } {
  const view = wrap.ownerDocument?.defaultView ?? null;
  const field =
    typeof wrap.querySelector === "function" ? (wrap.querySelector(".rbg-field") as HTMLElement | null) : null;
  const measurable = !!view && !!field && typeof wrap.getBoundingClientRect === "function";
  const relayout = (): void => {
    if (!measurable || !field) return;
    field.style.height = "";
    wrap.classList.remove("rbg-tight");
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
      if (field) field.style.height = "";
    }
  };
}
