// 星星消消乐 · 单测用的极简 DOM 桩(只给 `*.test.ts` 用,不参与打包)。
//
// 仓库的测试环境是 node、没有 jsdom,也不为一款游戏加运行时依赖,所以这里手写一份最小实现。
// 它存在的理由只有一个:验收铁则要求「消除后、重力完成前,方块的视觉坐标与逻辑坐标不同」——
// 这句话得靠一个能一帧一帧走的虚拟时钟 + 能读到 `style.transform` 的节点树才断言得了。

export type Handler = (ev: unknown) => void;

/** 只认 `tag`、`.cls` 两种,游戏里用到的就这些 */
function matchesSel(el: El, sel: string): boolean {
  const cls = sel.match(/\.([A-Za-z0-9_-]+)/g)?.map((s) => s.slice(1)) ?? [];
  const tag = /^[A-Za-z][A-Za-z0-9]*/.exec(sel)?.[0]?.toLowerCase();
  if (tag && tag !== el.tagName) return false;
  const own = el.className.split(/\s+/).filter(Boolean);
  return cls.every((c) => own.includes(c));
}

/** 这些标签没有闭合标签 */
const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);
/** 这些标签里面的东西一律当纯文本(CSS 里的 `>` 不能当成标签起头) */
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
    else if (key === "hidden") el.hidden = true;
    else if (key === "style") {
      for (const decl of val.split(";")) {
        const at = decl.indexOf(":");
        if (at > 0) el.style[decl.slice(0, at).trim()] = decl.slice(at + 1).trim();
      }
    } else el.setAttribute(key, val);
  }
}

/**
 * 够用就行的 HTML 解析:游戏模板里只有嵌套标签、class/style 属性和文字。
 * 有它,`innerHTML = "<span class=...>"` 之后才 querySelector 得到东西——
 * 不然整关的步数条、目标条全是 null,单测就只能绕着真正的界面走。
 */
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
    if (inner.startsWith("!")) continue; // 注释、doctype
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

export class El {
  tagName: string;
  className = "";
  id = "";
  hidden = false;
  disabled = false;
  type = "";
  title = "";
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

  set innerHTML(v: string) {
    this.dropChildren();
    this.ownText = "";
    this.rawHtml = v;
    for (const c of parseHtml(v)) this.appendChild(c);
  }
  get innerHTML(): string {
    return this.rawHtml;
  }

  /** 解析出来的文字直接并进本节点,不单独建文本节点——`children` 得只装元素 */
  appendText(t: string): void {
    this.ownText += t;
  }

  private rawHtml = "";

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
      contains: (c) => own().includes(c),
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
}

export interface Dom {
  root: El;
  head: El;
  winListeners: Map<string, Set<Handler>>;
  frames: Array<(t: number) => void>;
  cancelled: number[];
  clock: { ms: number };
  timers: Array<{ id: number; at: number; fn: () => void; every?: number }>;
  /** localStorage 桩的底账，测试可以直接翻 */
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
  "setInterval",
  "clearInterval",
  "localStorage",
];

/** 装上 DOM 桩;`width` 是屏宽,`reduced` 控制 prefers-reduced-motion */
export function installDom(width = 800, reduced = false): Dom {
  const head = new El("head");
  const root = new El("div");
  root.clientWidth = width;
  const winListeners = new Map<string, Set<Handler>>();
  const frames: Array<(t: number) => void> = [];
  const cancelled: number[] = [];
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

  const win = {
    innerWidth: width,
    innerHeight: 720,
    matchMedia: (q: string) => ({ matches: reduced && q.includes("reduced-motion") }),
    addEventListener: addWin,
    removeEventListener: removeWin,
  };

  Object.assign(globalThis as Record<string, unknown>, {
    document: {
      head,
      body: root,
      createElement: (tag: string) => new El(tag),
    },
    window: win,
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
    // 定时器也接到虚拟时钟上:不 flush 就永远不响,单测不用真等
    setTimeout: (fn: () => void, ms = 0) => {
      const id = timerId++;
      timers.push({ id, at: clock.ms + ms, fn });
      return id;
    },
    clearTimeout: (id: number) => {
      const at = timers.findIndex((t) => t.id === id);
      if (at >= 0) timers.splice(at, 1);
    },
    setInterval: (fn: () => void, ms = 0) => {
      const id = timerId++;
      timers.push({ id, at: clock.ms + ms, fn, every: Math.max(1, ms) });
      return id;
    },
    clearInterval: (id: number) => {
      const at = timers.findIndex((t) => t.id === id);
      if (at >= 0) timers.splice(at, 1);
    },
    // 每次装桩都是一份全新的空存档，用例之间的进度互不串味
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  });

  return { root, head, winListeners, frames, cancelled, clock, timers, store };
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

export function fireWindow(dom: Dom, type: string, ev: Record<string, unknown> = {}): void {
  const full = { preventDefault: () => undefined, ...ev };
  for (const f of Array.from(dom.winListeners.get(type) ?? [])) f(full);
}

/** 跑 n 帧,每帧推进 stepMs 毫秒（顺带把到点的 setTimeout 也叫醒） */
export function flushFrames(dom: Dom, n: number, stepMs = 16): void {
  for (let i = 0; i < n; i++) {
    const cb = dom.frames.shift();
    if (!cb) return;
    dom.clock.ms += stepMs;
    for (const t of dom.timers.filter((t) => t.at <= dom.clock.ms)) {
      // setInterval 要一直响,setTimeout 响完就摘
      if (t.every) t.at = dom.clock.ms + t.every;
      else dom.timers.splice(dom.timers.indexOf(t), 1);
      t.fn();
    }
    cb(dom.clock.ms);
  }
}

/** 一直跑到 `pred` 成立为止,返回跑了几帧（跑不出来就返回 -1） */
export function runUntil(dom: Dom, pred: () => boolean, maxFrames = 600, stepMs = 16): number {
  for (let i = 0; i < maxFrames; i++) {
    if (pred()) return i;
    flushFrames(dom, 1, stepMs);
  }
  return pred() ? maxFrames : -1;
}
