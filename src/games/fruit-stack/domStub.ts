// 果果合成 · 单测用的极简 DOM 桩(只给 `*.test.ts` 用,不参与打包)。
//
// 仓库的测试环境是 node、没有 jsdom,也不为一款游戏加运行时依赖,所以这里手写一份最小实现。
// 它存在的唯一理由是让「destroy 之后监听 / rAF / DOM 一样不剩」这句话有断言撑着:
// window 上还挂着几个监听、rAF 有没有被取消、节点有没有摘干净,都得数得出来。

export type Handler = (ev: unknown) => void;

/** 只认 `tag`、`.cls` 两种,框架里用到的就这些 */
function matchesSel(el: El, sel: string): boolean {
  const cls = sel.match(/\.([A-Za-z0-9_-]+)/g)?.map((s) => s.slice(1)) ?? [];
  const tag = /^[A-Za-z][A-Za-z0-9]*/.exec(sel)?.[0]?.toLowerCase();
  if (tag && tag !== el.tagName) return false;
  const own = el.className.split(/\s+/).filter(Boolean);
  return cls.every((c) => own.includes(c));
}

export class El {
  tagName: string;
  className = "";
  id = "";
  hidden = false;
  disabled = false;
  type = "";
  title = "";
  width = 0;
  height = 0;
  /** 布局用的可见宽度,由测试直接写 */
  clientWidth = 0;
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  children: El[] = [];
  parent: El | null = null;
  listeners = new Map<string, Set<Handler>>();
  private ownText = "";

  constructor(tag: string) {
    this.tagName = tag.toLowerCase();
  }

  get textContent(): string {
    return this.ownText + this.children.map((c) => c.textContent).join("");
  }
  set textContent(v: string) {
    this.dropChildren();
    this.ownText = v;
  }

  /** 游戏里只用 `innerHTML = ""` 清空,不需要真的解析 HTML */
  set innerHTML(v: string) {
    this.dropChildren();
    this.ownText = v === "" ? "" : v;
  }
  get innerHTML(): string {
    return this.ownText;
  }

  private dropChildren(): void {
    for (const c of this.children) c.parent = null;
    this.children = [];
  }

  appendChild(c: El): El {
    c.parent?.removeChild(c);
    c.parent = this;
    this.children.push(c);
    return c;
  }
  append(...cs: El[]): void {
    for (const c of cs) this.appendChild(c);
  }
  removeChild(c: El): void {
    this.children = this.children.filter((x) => x !== c);
    c.parent = null;
  }
  remove(): void {
    this.parent?.removeChild(this);
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
  dispatch(t: string, ev: Record<string, unknown> = {}): void {
    const full = { preventDefault: () => undefined, stopPropagation: () => undefined, ...ev };
    for (const f of Array.from(this.listeners.get(t) ?? [])) f(full);
  }
  getContext(): unknown {
    return ctx2d;
  }
  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: this.width, height: this.height };
  }
  scrollIntoView(): void {
    /* 桩:滚动不用真做 */
  }
  focus(): void {
    /* 桩:焦点不用真做 */
  }

  querySelector(sel: string): El | null {
    for (const c of this.children) {
      if (matchesSel(c, sel)) return c;
      const hit = c.querySelector(sel);
      if (hit) return hit;
    }
    return null;
  }

  /** 这棵子树上一共还挂着几个监听 */
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

/** canvas 2d 上下文:方法全是空操作,属性写得进去。渲染代码照样一行不落地跑一遍 */
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
  frames: Array<(t: number) => void>;
  /** cancelAnimationFrame 被调过几次 */
  cancelled: number[];
  /** 还没被清掉的定时器 */
  timers: Set<number>;
  clock: { ms: number };
}

const saved: Record<string, unknown> = {};
const SWAPPED = [
  "document",
  "window",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "performance",
  "addEventListener",
  "removeEventListener",
  "matchMedia",
  "devicePixelRatio",
];

/** 装上 DOM 桩;`width` 是屏宽,`reduced` 控制 prefers-reduced-motion */
export function installDom(width = 800, reduced = false): Dom {
  const head = new El("head");
  const root = new El("div");
  root.clientWidth = width;
  const winListeners = new Map<string, Set<Handler>>();
  const frames: Array<(t: number) => void> = [];
  const cancelled: number[] = [];
  const timers = new Set<number>();
  const clock = { ms: 1000 };
  const byId = new Map<string, El>();

  const origAppend = head.appendChild.bind(head);
  head.appendChild = (c: El): El => {
    if (c.id) byId.set(c.id, c);
    return origAppend(c);
  };

  for (const k of SWAPPED) saved[k] = (globalThis as Record<string, unknown>)[k];

  const addWin = (t: string, f: Handler): void => {
    if (!winListeners.has(t)) winListeners.set(t, new Set());
    winListeners.get(t)!.add(f);
  };
  const removeWin = (t: string, f: Handler): void => {
    winListeners.get(t)?.delete(f);
  };

  const win = {
    innerWidth: width,
    innerHeight: 720,
    devicePixelRatio: 1,
    matchMedia: (q: string) => ({ matches: reduced && q.includes("reduced-motion") }),
    addEventListener: addWin,
    removeEventListener: removeWin,
  };

  Object.assign(globalThis as Record<string, unknown>, {
    document: {
      head,
      body: root,
      hidden: false,
      // engine/audio 在模块顶层挂 pointerdown/visibilitychange;测试里不放真声音,空实现即可
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      createElement: (tag: string) => new El(tag),
      // 和真 DOM 一样：已经从 head 里摘掉的节点就查不到了
      getElementById: (id: string) => {
        const hit = byId.get(id);
        return hit && hit.parent ? hit : null;
      },
    },
    window: win,
    devicePixelRatio: 1,
    matchMedia: win.matchMedia,
    // level99 挂 resize 用的是 globalThis 上的这一对,和 window 那一对共用同一本账
    addEventListener: addWin,
    removeEventListener: removeWin,
    performance: { now: () => clock.ms },
    requestAnimationFrame: (cb: (t: number) => void) => {
      frames.push(cb);
      return frames.length;
    },
    cancelAnimationFrame: (h: number) => {
      cancelled.push(h);
    },
  });

  return { root, head, winListeners, frames, cancelled, timers, clock };
}

/** 卸掉 DOM 桩,把全局还回去 */
export function restoreDom(): void {
  for (const k of SWAPPED) (globalThis as Record<string, unknown>)[k] = saved[k];
}

/** window 上还挂着几个监听 */
export function windowListenerCount(dom: Dom): number {
  let n = 0;
  for (const set of dom.winListeners.values()) n += set.size;
  return n;
}

/** 触发一个 window 事件(自带 preventDefault) */
export function fireWindow(dom: Dom, type: string, ev: Record<string, unknown> = {}): void {
  const full = { preventDefault: () => undefined, ...ev };
  for (const f of Array.from(dom.winListeners.get(type) ?? [])) f(full);
}

/** 跑 n 帧,每帧推进 stepMs 毫秒 */
export function flushFrames(dom: Dom, n: number, stepMs = 40): void {
  for (let i = 0; i < n; i++) {
    const cb = dom.frames.shift();
    if (!cb) return;
    dom.clock.ms += stepMs;
    cb(dom.clock.ms);
  }
}
