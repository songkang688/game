/**
 * 便便超人 · 运行时小工具(1.2 新增)。
 *
 * 三件和 DOM 打交道、但本身可以纯函数化的事,单独放这儿方便逐条写用例:
 *  1. `createDisposer`:rAF / 定时器 / 事件监听统一登记,`destroy` 一把归零;
 *  2. `padMetrics`:360px 手机上摇杆与清扫钮的格子尺寸,热区 ≥ 44px 且两边不重叠;
 *  3. `resolveInitialLevel`:壳层给的 `initialLevel` 或地址栏 `?level=N` 直开第 N 关。
 */

// ---------------------------------------------------------------------------
// 1. 资源登记:destroy 之后一个都不许剩
// ---------------------------------------------------------------------------

/**
 * 只要求「挂得上、摘得下」两件事,所以 window、canvas、按钮都能直接传进来;
 * 方法写法(不是箭头属性)是故意的:DOM 那一堆重载靠双向协变才对得上。
 */
export interface ListenerLike {
  addEventListener?(type: string, fn: EventListenerOrEventListenerObject, options?: unknown): void;
  removeEventListener?(type: string, fn: EventListenerOrEventListenerObject, options?: unknown): void;
}

type AnyHandler = (e: never) => void;

export interface DisposerEnv {
  cancelRaf?: (id: number) => void;
  clearTimer?: (id: number) => void;
}

export interface Disposer {
  /**
   * 记住主循环最新的 requestAnimationFrame id。
   * 一个 disposer 服务一条主循环:每帧登记会覆盖上一帧的 id,不会越攒越多。
   */
  raf: (id: number) => number;
  /** 记一个 setTimeout / setInterval 的 id */
  timer: (id: number) => number;
  /** 挂一个监听并登记,dispose 时自动摘掉 */
  listen: <E = Event>(target: ListenerLike, type: string, fn: (e: E) => void, options?: unknown) => void;
  /** 全部撤销;可以重复调用,第二次什么都不做 */
  dispose: () => void;
  /** 还挂着几样东西(用例靠它断言归零) */
  readonly size: number;
  readonly disposed: boolean;
}

export function createDisposer(env: DisposerEnv = {}): Disposer {
  const cancelRaf =
    env.cancelRaf ??
    ((id: number) => (globalThis as { cancelAnimationFrame?: (n: number) => void }).cancelAnimationFrame?.(id));
  const clearTimer = env.clearTimer ?? ((id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>));

  let lastRaf: number | null = null;
  const timers = new Set<number>();
  const listeners: Array<{ target: ListenerLike; type: string; fn: AnyHandler }> = [];
  let disposed = false;

  return {
    raf(id) {
      if (!disposed) lastRaf = id;
      return id;
    },
    timer(id) {
      if (!disposed) timers.add(id);
      return id;
    },
    listen(target, type, fn, options) {
      if (disposed) return;
      const handler = fn as unknown as AnyHandler;
      target.addEventListener?.(type, handler as unknown as EventListener, options);
      listeners.push({ target, type, fn: handler });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (lastRaf !== null) cancelRaf(lastRaf);
      lastRaf = null;
      for (const id of timers) clearTimer(id);
      timers.clear();
      for (const l of listeners) {
        l.target.removeEventListener?.(l.type, l.fn as unknown as EventListener);
      }
      listeners.length = 0;
    },
    get size() {
      return (lastRaf === null ? 0 : 1) + timers.size + listeners.length;
    },
    get disposed() {
      return disposed;
    },
  };
}

// ---------------------------------------------------------------------------
// 2. 手机上的摇杆布局
// ---------------------------------------------------------------------------

/** 单人时每个按键的最小热区(手指按得准的下限) */
export const MIN_HOT = 44;
/**
 * 双人分屏时两个摇杆挤一行,热区曾经放宽到这个数。
 *
 * 现在不再拿它当下限了(见 `padMetrics`),留着只为讲清楚放宽换来的是什么:
 * 390/360/320 三档上实测 41/37/34px,颗颗低于手指按得准的 44px,
 * 两个孩子四只手同时按,按空是常态(W5R2-C-02 阻断)。
 */
export const MIN_HOT_DUO = 34;
/** 单人按键网格的列数:← ↓ → 占前三列,清扫 / 冲刺放第四列 */
export const PAD_COLUMNS = 4;
/**
 * 双人按键网格的列数。
 *
 * 一行要并排塞下两个摇杆,四列怎么算都不够:360px 上每盘只分到 163px,
 * 四列摊完一颗才 37px。砍成三列——动作键从第四列挪到上面一行——
 * 同样的 163px 摊三列是 51px,320px 上也有 45px,四档视口全部过 44。
 * 换来的代价是每盘竖着多占 8–15px,双人画布那一档一起收窄补回来。
 */
export const PAD_COLUMNS_DUO = 3;

/**
 * HUD 那排小药丸按钮(⏸ 暂停 / 📖 攻略 …)的最小热区。
 * 摇杆那几个大键有 `padMetrics` 守着,这排小的只靠 padding 撑,
 * 窄屏上 padding 一收就掉到 30×32——比手指按得准的下限还小,所以在 CSS 里钉死。
 *
 * 两条边都用 `MIN_HOT`:先前只把宽抬到 44、高留在 32,真机 360×720 上量到的
 * 「⏸ 暂停」是 44×32——竖着仍然比下限矮 12px,同一颗按钮一半达标一半不达标。
 * HUD 是 `flex-wrap` 的一行,抬高只让这一行长 12px,舞台自己会跟着让。
 */
export const HUD_BTN_MIN_W = MIN_HOT;
export const HUD_BTN_MIN_H = MIN_HOT;

export interface PadMetrics {
  /** 一个按键的边长(px) */
  key: number;
  /** 按键之间的空隙 */
  gap: number;
  columns: number;
  /** 一个摇杆盘的总宽 */
  padWidth: number;
  /** 两个摇杆盘 + 中间空隙的总宽 */
  totalWidth: number;
  /** 摇杆的右边缘(单人是前三列,双人是前两列) */
  joystickRight: number;
  /** 动作键那一列的左边缘;必须大于 joystickRight,不然就叠上了 */
  actionLeft: number;
  /** 动作键是不是挪到了自己那一行(双人三列版就是这样) */
  actionsOwnRow: boolean;
}

/**
 * 算一遍摇杆与清扫钮的尺寸。
 *
 * 单人四列、双人三列,两档的热区都 ≥ 44px:
 * 320/360/390 上单人 44/52/56、双人 45/51/56。
 * 单人版摇杆和清扫钮之间永远隔着一个 gap;双人版动作键单独占一行,列上不相邻。
 */
export function padMetrics(viewportW: number, players: 1 | 2 = 1): PadMetrics {
  const width = Number.isFinite(viewportW) && viewportW > 0 ? viewportW : 360;
  const gap = players === 2 ? 4 : 6;
  const sidePadding = 12;
  const between = players === 2 ? 10 : 0;
  const avail = Math.max(200, width - sidePadding * 2 - between);
  const perPad = avail / players;
  const columns = players === 2 ? PAD_COLUMNS_DUO : PAD_COLUMNS;
  const raw = Math.floor((perPad - gap * (columns - 1)) / columns);
  const key = Math.max(MIN_HOT, Math.min(56, raw));
  const padWidth = key * columns + gap * (columns - 1);
  return {
    key,
    gap,
    columns,
    padWidth,
    totalWidth: padWidth * players + between,
    joystickRight: key * (columns - 1) + gap * (columns - 2),
    actionLeft: key * (columns - 1) + gap * (columns - 1),
    actionsOwnRow: players === 2,
  };
}

/** 摇杆和清扫钮有没有叠在一起(用例直接问它) */
export function padOverlaps(m: PadMetrics): boolean {
  // 双人版动作键在自己那一行,和摇杆连列都不共用,压根谈不上叠
  if (m.actionsOwnRow) return false;
  return m.actionLeft < m.joystickRight;
}

/** 画布再收也得留这么高,不然看不清脚下的路 */
export const MIN_CANVAS_H = 130;

/**
 * 一盘手柄整块有多高:说明行 + 两行键 + 两道空隙。
 *
 * 说明行 `.ph-pad-name` 在触屏窄屏上是 `display:none`,`nameHeight` 传 0。
 * 它原先归 `grid-auto-rows:var(--k)` 管,藏起来也照样占一整颗键那么高——
 * 360×640 的分类关就是被这白留的 56px 顶得三色桶图例与提示行整块掉出屏幕
 * (画布那时已经在 `MIN_CANVAS_H` 的底线上,一个像素都让不出来了)。
 * 现在第一行写成 `auto`,这个函数就是那条算式的可测版本。
 */
export function padGridHeight(m: PadMetrics, nameHeight: number): number {
  const name = Number.isFinite(nameHeight) && nameHeight > 0 ? nameHeight : 0;
  return name + m.gap * 2 + m.key * 2;
}

/**
 * 舞台矮到摇杆掉出屏幕时,画布该收到多高。
 *
 * 为什么不能继续靠 `@media (max-height:…)`:媒体查询问的是**屏高**,
 * 可 `.game-stage` 是 `overflow:hidden` 且定高的——360×640 的机器屏高 640(>620,
 * 那一档媒体查询压根不触发),这一款却只分到 530px,平台顶栏再吃掉 116px。
 * 双人版画布按屏高留了 280px,结果摇杆整排 `◀ ⬇ ▶` 掉在裁切线以下,
 * 三列改造把热区抬到 45–51px 之后,多出来的那 8–15px 更是雪上加霜。
 *
 * 按舞台**真正看得见的那一段**摊,超出多少就从画布身上扣多少。
 * 返回 null 表示装得下,照原样别管。
 */
export function canvasRoomPx(
  wrapHeight: number,
  canvasHeight: number,
  roomPx: number,
  minCanvas = MIN_CANVAS_H,
): number | null {
  if (!Number.isFinite(roomPx) || roomPx <= 0) return null;
  if (!Number.isFinite(wrapHeight) || !Number.isFinite(canvasHeight) || canvasHeight <= 0) return null;
  const over = wrapHeight - roomPx;
  if (over <= 1) return null;
  return Math.max(minCanvas, Math.floor(canvasHeight - over));
}

/**
 * 整块玩法那一层最少要留多高才值得钳——比这还矮就别钳了,钳只会压成一条缝。
 * 画布底线 + 一盘手柄,正好 240px。
 */
export const WRAP_MIN_ROOM = 240;

/**
 * 画布已经收到底线、整块玩法**仍然**装不下时,`.ph-wrap` 自己该钳到多高。
 *
 * `canvasRoomPx()` 只从画布身上扣,可它有 `MIN_CANVAS_H` 这条底线——底线一到就再也让不出
 * 一个像素。320×568 上量到的就是这一幕:舞台看得见 332px,整块玩法 392px,画布早已趴在
 * 底线上,多出来的 60px 全砸在最后两行——三色桶图例(557–589)与提示行(593–610)
 * **整块掉在裁切线以下,而且一个可滚祖先都没有**,任何滚动位置都露不出来。
 * 分类关正是靠那三只桶的颜色与表情认「哪样投哪只」,看不见等于这一关的规则没写在屏幕上
 * (W5R3-C-01)。
 *
 * 这里不再跟画布较劲,直接让 `.ph-wrap` 自己滚:手柄仍在第一屏,图例与提示往下一划就有。
 * 返回 null 表示装得下(或矮到不值得钳),照原样别管——高屏上绝不凭空多出一个滚动容器。
 */
export function wrapRoomPx(
  wrapHeight: number,
  roomPx: number,
  minRoom = WRAP_MIN_ROOM,
): number | null {
  if (!Number.isFinite(roomPx) || roomPx <= 0) return null;
  if (!Number.isFinite(wrapHeight) || wrapHeight <= 0) return null;
  if (wrapHeight - roomPx <= 1) return null;
  return Math.max(minRoom, Math.floor(roomPx));
}

/**
 * 一层裁切祖先真正的那条裁切线。
 *
 * 滚动口是 **padding box**,下边框那几像素照不进内容;
 * `getBoundingClientRect().bottom` 给的却是 border box 的下沿。
 * `.game-stage` 写着 `border:4px solid #fff`,不减这一刀就白多算 4px——
 * 320×640 上提示行 `.ph-tip` 17px 高只露 9px,少的就是这一刀加上子像素。
 * 量不出宽度就当没有,绝不算成 NaN。
 */
export function clipBottomPx(bottom: number, borderBottom: string): number {
  const w = Number.parseFloat(borderBottom);
  return Number.isFinite(w) && w > 0 ? bottom - w : bottom;
}

/** 量一次这个节点头顶到最近那条裁切线之间还剩多少(量不了就返回 Infinity) */
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
  if (bottoms.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(...bottoms) - el.getBoundingClientRect().top;
}

// ---------------------------------------------------------------------------
// 3. 直开第 N 关
// ---------------------------------------------------------------------------

/** 从 `?level=12` 之类的查询串里读关号(1 基);读不到返回 null */
export function parseLevelParam(search: string): number | null {
  if (typeof search !== "string" || !search) return null;
  const hit = /[?&]level=(-?\d+)/.exec(search);
  if (!hit) return null;
  const n = Number(hit[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * 壳层给的 `initialLevel`(1 基)或地址栏 `?level=N` 落到实际要打开的关号(0 基)。
 * 越界一律 clamp;还没解锁的关退回到玩家当前能玩到的最远那一关;没要求就返回 null。
 */
export function resolveInitialLevel(
  raw: unknown,
  unlocked: number,
  total = 188
): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(n)) return null;
  const top = Math.max(1, Math.round(total));
  const oneBased = Math.max(1, Math.min(top, Math.round(n)));
  const wanted = oneBased - 1;
  const reachable = Math.max(0, Math.min(top - 1, Math.round(unlocked)));
  return Math.min(wanted, reachable);
}
