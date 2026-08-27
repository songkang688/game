/**
 * 红蓝拔河 · 运行时小工具(1.2 新增)。
 *
 * 四件和 DOM 打交道、但本身可以纯函数化的事,单独放这儿方便逐条写用例:
 *  1. `createDisposer`:rAF / 定时器 / 事件监听统一登记,`destroy` 一把归零;
 *  2. `sideLayout`:360px 手机上两侧大按钮的尺寸 —— 各自 ≥72px、中间留隔离带;
 *  3. `keySideOf`:两套键位(鸭梨 F/A、康康 J/L,单人再加空格),`destroy` 时一起卸;
 *  4. `resolveInitialLevel`:壳层给的 `initialLevel` 或地址栏 `?level=N` 直开第 N 关。
 */
import { LABEL_FONT_MIN, SIDE_BTN_MIN, SIDE_GAP_MIN } from "./tuning";

// ---------------------------------------------------------------------------
// 1. 资源登记:destroy 之后一个都不许剩
// ---------------------------------------------------------------------------

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
  /** 记住主循环最新的 rAF id(一条主循环一个 disposer,不会越攒越多) */
  raf: (id: number) => number;
  timer: (id: number) => number;
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
      target.addEventListener?.(type, fn as EventListener, options);
      listeners.push({ target, type, fn: fn as AnyHandler });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (lastRaf !== null) cancelRaf(lastRaf);
      lastRaf = null;
      timers.forEach((id) => clearTimer(id));
      timers.clear();
      for (const l of listeners) l.target.removeEventListener?.(l.type, l.fn as EventListener);
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
// 2. 两侧大按钮的排版
// ---------------------------------------------------------------------------

export interface SideLayout {
  /** 一侧按钮的宽 */
  width: number;
  /** 一侧按钮的高(手指的热区高度) */
  height: number;
  /** 中间隔离带的宽度 */
  gap: number;
  /** 体力条与提示的字号 */
  fontSize: number;
  /** 两个按钮加隔离带的总宽 */
  totalWidth: number;
}

/**
 * 按视口宽度算两侧按钮的尺寸。
 * 360px 的手机上仍然是「各自 ≥72px、中间留 ≥16px 隔离带、字号 ≥14px」。
 */
export function sideLayout(viewportW: number): SideLayout {
  const width = Number.isFinite(viewportW) && viewportW > 0 ? viewportW : 360;
  const padding = 12;
  const avail = Math.max(SIDE_BTN_MIN * 2 + SIDE_GAP_MIN, width - padding * 2);
  const raw = Math.floor((avail - SIDE_GAP_MIN) / 2);
  const btn = Math.max(SIDE_BTN_MIN, Math.min(168, raw));
  const gap = Math.max(SIDE_GAP_MIN, avail - btn * 2);
  return {
    width: btn,
    height: width <= 360 ? 76 : 88,
    gap,
    fontSize: Math.max(LABEL_FONT_MIN, width <= 360 ? 14 : 15),
    totalWidth: btn * 2 + gap,
  };
}

/** 两侧按钮有没有挤到一起(用例直接问它) */
export function sideButtonsOverlap(m: SideLayout): boolean {
  return m.gap < SIDE_GAP_MIN || m.width < SIDE_BTN_MIN || m.height < SIDE_BTN_MIN;
}

// ---------------------------------------------------------------------------
// 3. 两套键位
// ---------------------------------------------------------------------------

/** 鸭梨(红队)的键 */
export const RED_KEYS: readonly string[] = ["KeyF", "KeyA"];
/**
 * 康康(蓝队)的键。
 *
 * 平台的双人约定是「鸭梨 WASD+F+G,康康 ↑←↓→+L+K」,所以屏幕上一律写 **K**——
 * 跨游戏的肌肉记忆才对得上。老版本写的是 J,已经玩熟的孩子按 J 照样算数,
 * 所以 J 留在表里继续接管,只是不再往屏幕上写。
 */
export const BLUE_KEY_MAIN = "KeyK";
export const BLUE_KEYS: readonly string[] = [BLUE_KEY_MAIN, "KeyL", "KeyJ"];
/** 单人打小电脑时,空格也算自己的键 */
export const SOLO_KEYS: readonly string[] = ["Space"];

export type TugSideKey = "red" | "blue";

/**
 * 一个键属于哪一队;`duo` 为 false(单人打小电脑)时,蓝队的键不接管,
 * 空格归红队 —— 免得一个人玩的时候按到对手的键。
 */
export function keySideOf(code: string, duo: boolean): TugSideKey | null {
  if (RED_KEYS.includes(code)) return "red";
  if (!duo && SOLO_KEYS.includes(code)) return "red";
  if (duo && BLUE_KEYS.includes(code)) return "blue";
  return null;
}

/** 这一局一共要接管几个键(destroy 时要卸干净的那些) */
export function boundKeys(duo: boolean): string[] {
  return duo ? [...RED_KEYS, ...BLUE_KEYS] : [...RED_KEYS, ...SOLO_KEYS];
}

// ---------------------------------------------------------------------------
// 4. 直开第 N 关
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
 * 越界一律 clamp;还没解锁的关退回到当前能玩到的最远那一关;没要求就返回 null。
 */
export function resolveInitialLevel(raw: unknown, unlocked: number, total = 188): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(n)) return null;
  const top = Math.max(1, Math.round(total));
  const wanted = Math.max(1, Math.min(top, Math.round(n))) - 1;
  const reachable = Math.max(0, Math.min(top - 1, Math.round(unlocked)));
  return Math.min(wanted, reachable);
}

/** 地图上一个能点的格子(只要求这三样,真 DOM 与测试桩都对得上) */
export interface MapNodeLike {
  classList: { contains(token: string): boolean };
  getAttribute(name: string): string | null;
  click(): void;
}

/** 地图容器(只要求查得出格子) */
export interface MapHostLike {
  querySelectorAll(selector: string): ArrayLike<MapNodeLike>;
}

/**
 * 替玩家在地图上点开第 `level` 关(0 基);章节锁着或格子锁着就返回 false。
 *
 * `UPGRADE-1.2.md` 当时记的是「`mountLevelGame` 没有 `initialLevel` 这个入口,
 * 要接就得改 `level99.ts`」,于是上面那两支写好了、写了用例,却一次都没人调——
 * 真机上 `?level=141#/game/red-blue-tug` 打开的还是选关地图,五款里只有这一款进不去。
 * 那个理由现在站不住:同档另外四款一个字都没改 `level99.ts`,全是照着地图上的按钮
 * 替玩家点一下落地的。这一支就是那一下。
 */
export function openLevelOnMap(host: MapHostLike, level: number, chapterIndex: number): boolean {
  const tabs = host.querySelectorAll("button.l99-tab");
  const tab = chapterIndex >= 0 && chapterIndex < tabs.length ? tabs[chapterIndex] : undefined;
  if (!tab || tab.classList.contains("l99-tab-lock")) return false;
  tab.click();
  const label = `第 ${level + 1} 关`;
  const nodes = host.querySelectorAll("button.l99-node");
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!(node.getAttribute("aria-label") ?? "").startsWith(label)) continue;
    if (node.classList.contains("l99-node-lock")) return false;
    node.click();
    return true;
  }
  return false;
}
