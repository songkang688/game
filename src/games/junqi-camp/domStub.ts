/**
 * 军旗对决 · 单测用的极简 DOM 桩（只给 `*.test.ts` 用，不参与打包）。
 *
 * 仓库的测试环境是 node、没有 jsdom，也不打算为一款游戏引进新依赖，
 * 所以这里手写一份最小实现：只覆盖棋盘视图与 188 关框架真正会用到的那几个 API，
 * 顺便把监听器、rAF、样式标签都数出来——「destroy 之后不留东西」这条才有办法断言。
 */

export type Handler = (ev: unknown) => void;

export class El {
  tagName: string;
  className = "";
  id = "";
  textContent = "";
  hidden = false;
  disabled = false;
  type = "";
  title = "";
  width = 0;
  height = 0;
  style: Record<string, string> = {};
  children: El[] = [];
  parent: El | null = null;
  attrs: Record<string, string> = {};
  listeners = new Map<string, Set<Handler>>();

  constructor(tag: string) {
    this.tagName = tag;
  }

  set innerHTML(v: string) {
    for (const c of this.children) c.parent = null;
    this.children = [];
    if (v !== "") this.rawHtml = v;
    else this.rawHtml = "";
  }
  get innerHTML(): string {
    return this.rawHtml;
  }
  private rawHtml = "";

  get childElementCount(): number {
    return this.children.length;
  }

  appendChild(c: El): El {
    c.parent = this;
    this.children.push(c);
    return c;
  }
  append(...cs: El[]): void {
    for (const c of cs) this.appendChild(c);
  }
  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  setAttribute(k: string, v: string): void {
    this.attrs[k] = v;
  }
  getAttribute(k: string): string | null {
    return this.attrs[k] ?? null;
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
    return { left: 0, top: 0, width: this.width, height: this.height };
  }
  getContext(): unknown {
    return ctx2d;
  }
  scrollIntoView(): void {
    /* 桩：滚动不需要真做 */
  }
  focus(): void {
    /* 桩：焦点不需要真做 */
  }
  /** 只支持 `.class` 这一种选择器，框架里用到的就这一种 */
  querySelector(sel: string): El | null {
    const cls = sel.startsWith(".") ? sel.slice(1) : sel;
    return this.find((e) => e.className.split(/\s+/).includes(cls));
  }
  countListeners(): number {
    let n = 0;
    for (const set of this.listeners.values()) n += set.size;
    for (const c of this.children) n += c.countListeners();
    return n;
  }
  find(pred: (e: El) => boolean): El | null {
    if (pred(this)) return this;
    for (const c of this.children) {
      const hit = c.find(pred);
      if (hit) return hit;
    }
    return null;
  }
  findAll(pred: (e: El) => boolean, out: El[] = []): El[] {
    if (pred(this)) out.push(this);
    for (const c of this.children) c.findAll(pred, out);
    return out;
  }
}

/** canvas 2d 上下文：任何方法都是空操作，任何属性都写得进去 */
export const ctx2d: unknown = new Proxy(
  {},
  {
    get: () => () => ctx2d,
    set: () => true,
  }
);

export interface Dom {
  root: El;
  head: El;
  winListeners: Map<string, Set<Handler>>;
  frames: Array<() => void>;
  cancelled: number[];
  clock: { ms: number };
}

const saved: Record<string, unknown> = {};

/** 装上 DOM 桩，返回可以观察的句柄（reduceMotion=true 时动画走短的那一档） */
export function installDom(width = 800, reduceMotion = false): Dom {
  const head = new El("head");
  const root = new El("div");
  const winListeners = new Map<string, Set<Handler>>();
  const frames: Array<() => void> = [];
  const cancelled: number[] = [];
  const clock = { ms: 1000 };
  const byId = new Map<string, El>();

  const origAppend = head.appendChild.bind(head);
  head.appendChild = (c: El): El => {
    if (c.id) byId.set(c.id, c);
    return origAppend(c);
  };

  saved.document = (globalThis as Record<string, unknown>).document;
  saved.window = (globalThis as Record<string, unknown>).window;
  saved.raf = (globalThis as Record<string, unknown>).requestAnimationFrame;
  saved.caf = (globalThis as Record<string, unknown>).cancelAnimationFrame;
  saved.performance = (globalThis as Record<string, unknown>).performance;
  saved.innerWidth = (globalThis as Record<string, unknown>).innerWidth;
  saved.matchMedia = (globalThis as Record<string, unknown>).matchMedia;

  const win = {
    innerWidth: width,
    addEventListener: (t: string, f: Handler) => {
      if (!winListeners.has(t)) winListeners.set(t, new Set());
      winListeners.get(t)!.add(f);
    },
    removeEventListener: (t: string, f: Handler) => {
      winListeners.get(t)?.delete(f);
    },
  };

  Object.assign(globalThis as Record<string, unknown>, {
    document: {
      head,
      createElement: (tag: string) => new El(tag),
      getElementById: (id: string) => byId.get(id) ?? null,
    },
    window: win,
    innerWidth: width,
    matchMedia: (q: string) => ({ matches: reduceMotion && q.includes("reduce") }),
    performance: { now: () => clock.ms },
    requestAnimationFrame: (cb: () => void) => {
      frames.push(cb);
      return frames.length;
    },
    cancelAnimationFrame: (h: number) => {
      cancelled.push(h);
    },
  });

  return { root, head, winListeners, frames, cancelled, clock };
}

/** 卸掉 DOM 桩，把全局还回去 */
export function restoreDom(): void {
  Object.assign(globalThis as Record<string, unknown>, {
    document: saved.document,
    window: saved.window,
    requestAnimationFrame: saved.raf,
    cancelAnimationFrame: saved.caf,
    performance: saved.performance,
    innerWidth: saved.innerWidth,
    matchMedia: saved.matchMedia,
  });
}

/** window 上还挂着几个监听 */
export function windowListenerCount(dom: Dom): number {
  let n = 0;
  for (const set of dom.winListeners.values()) n += set.size;
  return n;
}

/** 触发一个 window 事件 */
export function fireWindow(dom: Dom, type: string, ev: unknown): void {
  for (const f of Array.from(dom.winListeners.get(type) ?? [])) f(ev);
}

/** 跑 n 帧动画，每帧推进 stepMs 毫秒 */
export function flushFrames(dom: Dom, n: number, stepMs = 50): void {
  for (let i = 0; i < n; i++) {
    const cb = dom.frames.shift();
    if (!cb) return;
    dom.clock.ms += stepMs;
    cb();
  }
}
