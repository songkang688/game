// 梨康格斗王 · 单测用的极简 DOM 桩（只给 `*.test.ts` 用，不参与打包）。
//
// 仓库的测试环境是 node、没有 jsdom，也不为一款游戏加运行时依赖，所以这里手写一份最小实现。
// 它存在的理由有两个：
//  1. 验收铁则要求「`destroy` 之后 window 上一个监听都不许剩」—— 得有一本能翻的监听账；
//  2. 训练场那几行读数是贴在 DOM 上的，得能真的把界面挂起来、跑几帧、再把字读回来。
//
// 画布这边不做真渲染：`getContext("2d")` 返回一个"怎么调都行"的代理，
// 让绘制代码原样跑一遍而不报错，这样连画画的分支也一起被冒烟覆盖到。

export type Handler = (ev: unknown) => void;

/** 认 `tag`、`.cls`、`[attr="v"]` 三种，游戏里用到的就这些 */
function matchesSel(el: El, sel: string): boolean {
  const attrs = [...sel.matchAll(/\[([A-Za-z-]+)(?:="([^"]*)")?\]/g)];
  const rest = sel.replace(/\[[^\]]*\]/g, "");
  const cls = rest.match(/\.([A-Za-z0-9_-]+)/g)?.map((s) => s.slice(1)) ?? [];
  const tag = /^[A-Za-z][A-Za-z0-9]*/.exec(rest)?.[0]?.toLowerCase();
  if (tag && tag !== el.tagName) return false;
  const own = el.className.split(/\s+/).filter(Boolean);
  if (!cls.every((c) => own.includes(c))) return false;
  return attrs.every(([, k, v]) => (v === undefined ? el.getAttribute(k) !== null : el.getAttribute(k) === v));
}

/** 这些标签没有闭合标签 */
const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);
/** 这些标签里面的东西一律当纯文本（CSS 里的 `>` 不能当成标签起头） */
const RAW_TAGS = new Set(["style", "script"]);

function readAttrs(el: El, src: string): void {
  const re = /([A-Za-z-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const key = m[1].toLowerCase();
    const val = m[2] ?? m[3] ?? m[4] ?? "";
    if (key === "class") el.className = val;
    else if (key === "id") el.id = val;
    else if (key === "type") el.type = val;
    else if (key === "title") el.title = val;
    else if (key === "disabled") el.disabled = true;
    else if (key === "style") {
      for (const decl of val.split(";")) {
        const at = decl.indexOf(":");
        if (at > 0) el.style[decl.slice(0, at).trim()] = decl.slice(at + 1).trim();
      }
    } else el.setAttribute(key, val);
  }
}

/** 够用就行的 HTML 解析：模板里只有嵌套标签、class/style/data- 属性和文字 */
export function parseHtml(html: string): El[] {
  const out: El[] = [];
  const open: El[] = [];
  const put = (n: El): void => {
    const top = open[open.length - 1];
    if (top) top.appendChild(n);
    else out.push(n);
  };
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    const text = html.slice(i, lt < 0 ? html.length : lt);
    if (text.trim()) open[open.length - 1]?.appendText(text);
    if (lt < 0) break;
    const gt = html.indexOf(">", lt);
    if (gt < 0) break;
    const inner = html.slice(lt + 1, gt).trim();
    i = gt + 1;
    if (inner.startsWith("!")) continue;
    if (inner.startsWith("/")) {
      open.pop();
      continue;
    }
    const selfClose = inner.endsWith("/");
    const body = selfClose ? inner.slice(0, -1) : inner;
    const tag = (/^[A-Za-z][A-Za-z0-9-]*/.exec(body)?.[0] ?? "div").toLowerCase();
    const el = new El(tag);
    readAttrs(el, body.slice(tag.length));
    put(el);
    if (RAW_TAGS.has(tag)) {
      const close = html.toLowerCase().indexOf(`</${tag}`, i);
      const end = close < 0 ? html.length : close;
      el.appendText(html.slice(i, end));
      const after = close < 0 ? -1 : html.indexOf(">", end);
      i = after < 0 ? html.length : after + 1;
      continue;
    }
    if (!selfClose && !VOID_TAGS.has(tag)) open.push(el);
  }
  return out;
}

/** 一个"随便怎么调用都不报错"的 2D 上下文：绘制代码照跑，只是什么都不画 */
function fakeContext(): CanvasRenderingContext2D {
  const store: Record<string, unknown> = {};
  const target = function (): unknown {
    return proxy;
  };
  const proxy: unknown = new Proxy(target, {
    get: (_t, k) => (typeof k === "symbol" ? undefined : (store[k] ?? proxy)),
    set: (_t, k, v) => {
      store[k as string] = v;
      return true;
    },
    apply: () => proxy
  });
  return proxy as CanvasRenderingContext2D;
}

export class El {
  tagName: string;
  className = "";
  id = "";
  disabled = false;
  type = "";
  title = "";
  width = 0;
  height = 0;
  /** 布局用的可见宽度，由测试直接写 */
  clientWidth = 0;
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  children: El[] = [];
  parent: El | null = null;
  listeners = new Map<string, Set<Handler>>();
  private ownText = "";
  private rawHtml = "";

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

  set innerHTML(v: string) {
    this.dropChildren();
    this.ownText = "";
    this.rawHtml = v;
    for (const c of parseHtml(v)) this.appendChild(c);
  }
  get innerHTML(): string {
    return this.rawHtml;
  }

  appendText(t: string): void {
    this.ownText += t;
  }

  get firstElementChild(): El | null {
    return this.children[0] ?? null;
  }

  private dropChildren(): void {
    for (const c of this.children) c.parent = null;
    this.children = [];
    this.rawHtml = "";
  }

  get classList(): {
    add: (c: string) => void;
    remove: (c: string) => void;
    toggle: (c: string, on?: boolean) => void;
    contains: (c: string) => boolean;
  } {
    const own = (): string[] => this.className.split(/\s+/).filter(Boolean);
    const write = (list: string[]): void => {
      this.className = list.join(" ");
    };
    return {
      add: (c) => {
        const l = own();
        if (!l.includes(c)) write([...l, c]);
      },
      remove: (c) => write(own().filter((x) => x !== c)),
      toggle: (c, on) => {
        const has = own().includes(c);
        const want = on === undefined ? !has : on;
        if (want && !has) write([...own(), c]);
        if (!want && has) write(own().filter((x) => x !== c));
      },
      contains: (c) => own().includes(c)
    };
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
  insertBefore(c: El, ref: El | null): El {
    c.parent?.removeChild(c);
    c.parent = this;
    const at = ref ? this.children.indexOf(ref) : -1;
    if (at < 0) this.children.push(c);
    else this.children.splice(at, 0, c);
    return c;
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
  click(): void {
    this.dispatch("click");
  }
  focus(): void {
    /* 桩：焦点不用真做 */
  }
  scrollIntoView(): void {
    /* 桩：滚动不用真做 */
  }
  setPointerCapture(): void {
    /* 桩：指针捕获不用真做 */
  }
  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: 96, height: 96 };
  }
  getContext(): CanvasRenderingContext2D {
    return (this.ctx ??= fakeContext());
  }
  private ctx: CanvasRenderingContext2D | null = null;

  querySelector(sel: string): El | null {
    for (const c of this.children) {
      if (matchesSel(c, sel)) return c;
      const hit = c.querySelector(sel);
      if (hit) return hit;
    }
    return null;
  }

  querySelectorAll(sel: string): El[] {
    const out: El[] = [];
    for (const c of this.children) {
      if (matchesSel(c, sel)) out.push(c);
      out.push(...c.querySelectorAll(sel));
    }
    return out;
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
  /** 按可见文字找按钮，写用例比记 class 名省事 */
  findByText(text: string): El | null {
    return this.find((e) => e !== this && e.textContent.includes(text));
  }
}

export interface Dom {
  root: El;
  head: El;
  winListeners: Map<string, Set<Handler>>;
  frames: Array<(t: number) => void>;
  clock: { ms: number };
  timers: Array<{ id: number; at: number; fn: () => void }>;
  store: Map<string, string>;
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
  "setTimeout",
  "clearTimeout",
  "localStorage",
  "innerWidth"
];

/** 装上 DOM 桩；`width` 是屏宽，`reduced` 控制 prefers-reduced-motion */
export function installDom(width = 800, reduced = false): Dom {
  const head = new El("head");
  const root = new El("div");
  root.clientWidth = width;
  const winListeners = new Map<string, Set<Handler>>();
  const frames: Array<(t: number) => void> = [];
  const clock = { ms: 1000 };
  const timers: Dom["timers"] = [];
  const store = new Map<string, string>();
  let timerId = 1;

  for (const k of SWAPPED) saved[k] = (globalThis as Record<string, unknown>)[k];

  const addWin = (t: string, f: Handler): void => {
    if (!winListeners.has(t)) winListeners.set(t, new Set());
    winListeners.get(t)!.add(f);
  };
  const removeWin = (t: string, f: Handler): void => {
    winListeners.get(t)?.delete(f);
  };
  const setTimer = (fn: () => void, ms = 0): number => {
    const id = timerId++;
    timers.push({ id, at: clock.ms + ms, fn });
    return id;
  };
  const clearTimer = (id: number): void => {
    const at = timers.findIndex((t) => t.id === id);
    if (at >= 0) timers.splice(at, 1);
  };

  const win = {
    innerWidth: width,
    innerHeight: 720,
    matchMedia: (q: string) => ({ matches: reduced && q.includes("reduced-motion") }),
    addEventListener: addWin,
    removeEventListener: removeWin,
    setTimeout: setTimer,
    clearTimeout: clearTimer
  };

  Object.assign(globalThis as Record<string, unknown>, {
    document: {
      head,
      body: root,
      createElement: (tag: string) => new El(tag)
    },
    window: win,
    innerWidth: width,
    matchMedia: win.matchMedia,
    // level99 挂 resize 用的是 globalThis 上的这一对，和 window 那一对共用同一本账
    addEventListener: addWin,
    removeEventListener: removeWin,
    performance: { now: () => clock.ms },
    requestAnimationFrame: (cb: (t: number) => void) => {
      frames.push(cb);
      return frames.length;
    },
    cancelAnimationFrame: () => undefined,
    setTimeout: setTimer,
    clearTimeout: clearTimer,
    // 每次装桩都是一份全新的空存档，用例之间的进度互不串味
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      }
    }
  });

  return { root, head, winListeners, frames, clock, timers, store };
}

/** 卸掉 DOM 桩，把全局还回去 */
export function restoreDom(): void {
  for (const k of SWAPPED) (globalThis as Record<string, unknown>)[k] = saved[k];
}

/** window 上还挂着几个监听 */
export function windowListenerCount(dom: Dom): number {
  let n = 0;
  for (const set of dom.winListeners.values()) n += set.size;
  return n;
}

export function fireWindow(dom: Dom, type: string, ev: Record<string, unknown> = {}): void {
  const full = { preventDefault: () => undefined, ...ev };
  for (const f of Array.from(dom.winListeners.get(type) ?? [])) f(full);
}

/** 跑 n 帧，每帧推进 stepMs 毫秒（顺带把到点的 setTimeout 也叫醒） */
export function flushFrames(dom: Dom, n: number, stepMs = 16): void {
  for (let i = 0; i < n; i++) {
    const cb = dom.frames.shift();
    if (!cb) return;
    dom.clock.ms += stepMs;
    for (const t of dom.timers.filter((x) => x.at <= dom.clock.ms)) {
      dom.timers.splice(dom.timers.indexOf(t), 1);
      t.fn();
    }
    cb(dom.clock.ms);
  }
}
