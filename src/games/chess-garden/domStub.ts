/**
 * 花园国际象棋 · 单测用的极简 DOM 桩（只给 `*.test.ts` 用，不参与打包）。
 *
 * 仓库的测试环境是 node、没有 jsdom，也不为一款游戏引进新依赖，
 * 所以这里手写一份最小实现：只覆盖棋盘视图与 188 关框架真正会用到的那几个 API，
 * 顺便把监听器、定时器、rAF 都数出来——「destroy 之后不留东西」这条才有办法断言。
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
  style: Record<string, string> = {};
  children: El[] = [];
  parent: El | null = null;
  attrs: Record<string, string> = {};
  listeners = new Map<string, Set<Handler>>();
  /** 假的排版：给 getBoundingClientRect 用，滑行动画才有非零位移 */
  rect = { left: 0, top: 0, width: 40, height: 40 };

  constructor(tag: string) {
    this.tagName = tag;
  }

  private rawHtml = "";

  set innerHTML(v: string) {
    for (const c of this.children) c.parent = null;
    this.children = [];
    this.rawHtml = v === "" ? "" : v;
  }
  get innerHTML(): string {
    return this.rawHtml;
  }

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
  /** 点一下（棋盘格子、按钮都用它） */
  click(): void {
    this.dispatch("click", {});
  }
  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return this.rect;
  }
  scrollIntoView(): void {
    /* 桩：滚动不用真做 */
  }
  focus(): void {
    /* 桩：焦点不用真做 */
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
  /** 带某个 class 的全部后代 */
  byClass(cls: string): El[] {
    return this.findAll((e) => e.className.split(/\s+/).includes(cls));
  }
  /** 整棵子树的文字，断言提示语用 */
  text(): string {
    return [this.textContent, ...this.children.map((c) => c.text())].join(" ").trim();
  }
}

export interface Dom {
  root: El;
  head: El;
  winListeners: Map<string, Set<Handler>>;
  timers: Map<number, () => void>;
  frames: Array<() => void>;
  clock: { ms: number };
}

const saved: Record<string, unknown> = {};

/** 装上 DOM 桩，返回可以观察的句柄 */
export function installDom(width = 800): Dom {
  const head = new El("head");
  const root = new El("div");
  const winListeners = new Map<string, Set<Handler>>();
  const timers = new Map<number, () => void>();
  const frames: Array<() => void> = [];
  const clock = { ms: 1000 };
  const byId = new Map<string, El>();
  let timerId = 1;

  const origAppend = head.appendChild.bind(head);
  head.appendChild = (c: El): El => {
    if (c.id) byId.set(c.id, c);
    return origAppend(c);
  };

  for (const key of [
    "document",
    "window",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "setTimeout",
    "clearTimeout",
    "performance",
    "innerWidth",
    "matchMedia",
  ]) {
    saved[key] = (globalThis as Record<string, unknown>)[key];
  }

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
      // 和真 DOM 一样：已经从 head 里摘掉的节点就查不到了
      getElementById: (id: string) => {
        const hit = byId.get(id);
        return hit && hit.parent ? hit : null;
      },
    },
    window: win,
    innerWidth: width,
    performance: { now: () => clock.ms },
    matchMedia: (q: string) => ({ matches: false, media: q }),
    requestAnimationFrame: (cb: () => void) => {
      frames.push(cb);
      return frames.length;
    },
    cancelAnimationFrame: () => {
      /* 桩：只要不报错 */
    },
    setTimeout: (cb: () => void) => {
      const id = timerId++;
      timers.set(id, cb);
      return id;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
  });

  return { root, head, winListeners, timers, frames, clock };
}

/** 卸掉 DOM 桩，把全局还回去 */
export function restoreDom(): void {
  for (const [key, value] of Object.entries(saved)) {
    (globalThis as Record<string, unknown>)[key] = value;
  }
}

/** window 上还挂着几个监听 */
export function windowListenerCount(dom: Dom): number {
  let n = 0;
  for (const set of dom.winListeners.values()) n += set.size;
  return n;
}

/** 触发一个 window 事件（键盘操作用） */
export function fireWindow(dom: Dom, type: string, ev: unknown): void {
  for (const f of Array.from(dom.winListeners.get(type) ?? [])) f(ev);
}

/** 把挂着的定时器一次跑完（AI 落子用），返回跑了几个 */
export function flushTimers(dom: Dom, rounds = 12): number {
  let n = 0;
  for (let i = 0; i < rounds; i++) {
    const entry = dom.timers.entries().next();
    if (entry.done) break;
    const [id, cb] = entry.value;
    dom.timers.delete(id);
    dom.clock.ms += 10;
    cb();
    n++;
  }
  return n;
}

/** 把排队的 rAF 回调跑完 */
export function flushFrames(dom: Dom, n = 8): void {
  for (let i = 0; i < n; i++) {
    const cb = dom.frames.shift();
    if (!cb) return;
    dom.clock.ms += 16;
    cb();
  }
}
