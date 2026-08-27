/**
 * 海底大胃王 · 单测用的极简 DOM 桩(只给 `*.test.ts` 用,不参与打包)。
 *
 * 仓库的测试环境是 node、没有 jsdom,也不为一款游戏引新依赖,所以这里手写一份
 * 最小实现:只覆盖 `index.ts` 真正会碰的那几个 API,顺便把监听器、rAF、
 * localStorage 都数出来——「destroy 之后不留东西」才有办法断言。
 *
 * 与别家那几份 domStub 的差别:这一款是纯画布,不建 DOM 控件,所以省掉了
 * `querySelector` 那一套,换成 `location.search`(要测 `?level=`)与
 * `devicePixelRatio`(`syncSize` 要读)。
 */

export type Handler = (ev: unknown) => void;

export class El {
  tagName: string;
  className = "";
  width = 0;
  height = 0;
  clientWidth = 0;
  clientHeight = 0;
  style: Record<string, string> = {};
  children: El[] = [];
  parent: El | null = null;
  listeners = new Map<string, Set<Handler>>();

  constructor(tag: string) {
    this.tagName = tag;
  }

  appendChild(c: El): El {
    c.parent = this;
    this.children.push(c);
    return c;
  }
  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  addEventListener(t: string, f: Handler): void {
    if (!this.listeners.has(t)) this.listeners.set(t, new Set());
    this.listeners.get(t)!.add(f);
  }
  removeEventListener(t: string, f: Handler): void {
    this.listeners.get(t)?.delete(f);
  }
  dispatch(t: string, ev: unknown = {}): void {
    for (const f of Array.from(this.listeners.get(t) ?? [])) f(ev);
  }
  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: this.clientWidth || this.width, height: this.clientHeight || this.height };
  }
  getContext(): unknown {
    return ctx2d;
  }
  countListeners(): number {
    let n = 0;
    for (const set of this.listeners.values()) n += set.size;
    for (const c of this.children) n += c.countListeners();
    return n;
  }
}

/** canvas 2d 上下文:任何方法都是空操作,任何属性都写得进去。 */
export const ctx2d: unknown = new Proxy(
  {},
  {
    get: () => () => ctx2d,
    set: () => true,
  },
);

export interface Dom {
  root: El;
  winListeners: Map<string, Set<Handler>>;
  frames: Array<(now: number) => void>;
  cancelled: number[];
  clock: { ms: number };
  storage: Map<string, string>;
  /** 改这个就能测 `?level=` */
  search: { value: string };
}

const saved: Record<string, unknown> = {};

/** 装上 DOM 桩,返回可以观察的句柄。 */
export function installDom(width = 640, height = 480, reducedMotion = false): Dom {
  const root = new El("div");
  root.clientWidth = width;
  root.clientHeight = height;
  const winListeners = new Map<string, Set<Handler>>();
  const frames: Array<(now: number) => void> = [];
  const cancelled: number[] = [];
  const clock = { ms: 1000 };
  const storage = new Map<string, string>();
  const search = { value: "" };

  for (const k of [
    "document",
    "window",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "performance",
    "localStorage",
  ]) {
    saved[k] = (globalThis as Record<string, unknown>)[k];
  }

  const win = {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: 1,
    get location() {
      return { search: search.value };
    },
    matchMedia: (q: string) => ({ matches: q.includes("reduce") ? reducedMotion : false }),
    addEventListener: (t: string, f: Handler) => {
      if (!winListeners.has(t)) winListeners.set(t, new Set());
      winListeners.get(t)!.add(f);
    },
    removeEventListener: (t: string, f: Handler) => {
      winListeners.get(t)?.delete(f);
    },
  };

  Object.assign(globalThis as Record<string, unknown>, {
    document: { createElement: (tag: string) => new El(tag) },
    window: win,
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    },
    performance: { now: () => clock.ms },
    requestAnimationFrame: (cb: (now: number) => void) => {
      frames.push(cb);
      return frames.length;
    },
    cancelAnimationFrame: (h: number) => {
      cancelled.push(h);
    },
  });

  return { root, winListeners, frames, cancelled, clock, storage, search };
}

/** 卸掉 DOM 桩,把全局还回去。 */
export function restoreDom(): void {
  Object.assign(globalThis as Record<string, unknown>, {
    document: saved.document,
    window: saved.window,
    requestAnimationFrame: saved.requestAnimationFrame,
    cancelAnimationFrame: saved.cancelAnimationFrame,
    performance: saved.performance,
    localStorage: saved.localStorage,
  });
}

/** window 上还挂着几个监听。 */
export function windowListenerCount(dom: Dom): number {
  let n = 0;
  for (const set of dom.winListeners.values()) n += set.size;
  return n;
}

/** 往 window 上派一个事件(键盘用)。 */
export function dispatchWindow(dom: Dom, type: string, ev: unknown): void {
  for (const f of Array.from(dom.winListeners.get(type) ?? [])) f(ev);
}

/** 跑 n 帧动画,每帧推进 stepMs 毫秒。 */
export function flushFrames(dom: Dom, n: number, stepMs = 33): void {
  for (let i = 0; i < n; i++) {
    const cb = dom.frames.shift();
    if (!cb) return;
    dom.clock.ms += stepMs;
    cb(dom.clock.ms);
  }
}
