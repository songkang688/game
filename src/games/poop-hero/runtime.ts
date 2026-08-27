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
/** 双人分屏时两个摇杆挤一行,热区放宽到这个数 */
export const MIN_HOT_DUO = 34;
/** 按键网格的列数:← ↓ → 占前三列,清扫 / 冲刺放第四列 */
export const PAD_COLUMNS = 4;

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
  /** 摇杆(前三列)的右边缘 */
  joystickRight: number;
  /** 动作键(第四列)的左边缘;必须大于 joystickRight,不然就叠上了 */
  actionLeft: number;
}

/**
 * 算一遍摇杆与清扫钮的尺寸。
 * 360px 的窄屏上单人热区仍然 ≥ 44px,而且摇杆和清扫钮之间永远隔着一个 gap。
 */
export function padMetrics(viewportW: number, players: 1 | 2 = 1): PadMetrics {
  const width = Number.isFinite(viewportW) && viewportW > 0 ? viewportW : 360;
  const gap = players === 2 ? 4 : 6;
  const sidePadding = 12;
  const between = players === 2 ? 10 : 0;
  const avail = Math.max(200, width - sidePadding * 2 - between);
  const perPad = avail / players;
  const floor = players === 2 ? MIN_HOT_DUO : MIN_HOT;
  const raw = Math.floor((perPad - gap * (PAD_COLUMNS - 1)) / PAD_COLUMNS);
  const key = Math.max(floor, Math.min(56, raw));
  const padWidth = key * PAD_COLUMNS + gap * (PAD_COLUMNS - 1);
  return {
    key,
    gap,
    columns: PAD_COLUMNS,
    padWidth,
    totalWidth: padWidth * players + between,
    joystickRight: key * 3 + gap * 2,
    actionLeft: key * 3 + gap * 3,
  };
}

/** 摇杆和清扫钮有没有叠在一起(用例直接问它) */
export function padOverlaps(m: PadMetrics): boolean {
  return m.actionLeft < m.joystickRight;
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
