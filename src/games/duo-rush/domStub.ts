/**
 * 梨康双人冲刺 · 测试用的极简 DOM 桩。
 *
 * 仓库的 vitest 跑在 node 环境(没有 jsdom,也不许为此引依赖),
 * 所以本款自己搭一份桩。和同仓库其他几款的桩比,这一份多两样东西:
 *
 * 1. **`innerHTML` 会真的解析**。本款整块界面是一条 HTML 模板铺出来的,
 *    之后全靠 `wrap.querySelector(".dr-start")` 这类选择器取节点;
 *    桩要是只把标签剥掉留文字,`mount()` 第一行就取不到东西。
 *    这里带一个够用的迷你解析器:标签、属性、`class` / `type` / `data-*`、
 *    自闭合标签(`<img>` `<br>`)和文本节点,够本款的模板用。
 * 2. **`ResizeObserver` 是真桩**。本款优先用 ResizeObserver 盯版面,
 *    只有环境没有它才退回 `window.resize`。桩把还活着的观察者数出来,
 *    `destroy.test.ts` 才能证明 `ro.disconnect()` 真的调了。
 *
 * 这个文件不带 `.test.` 后缀,vitest 不会把它当用例文件;
 * 玩法代码一行都没 import 它,打包时也不会被带进游戏 chunk。
 */

export interface FakeEvent {
  code?: string;
  key?: string;
  repeat?: boolean;
  pointerId?: number;
  clientX?: number;
  clientY?: number;
  preventDefault: () => void;
}

export type Handler = (e: FakeEvent) => void;

export class FakeCtx {
  fillStyle: unknown = "";
  strokeStyle: unknown = "";
  lineWidth = 0;
  lineCap = "";
  lineJoin = "";
  font = "";
  textAlign = "";
  textBaseline = "";
  globalAlpha = 1;
  save(): void {}
  restore(): void {}
  setTransform(): void {}
  transform(): void {}
  translate(): void {}
  rotate(): void {}
  scale(): void {}
  clearRect(): void {}
  fillRect(): void {}
  strokeRect(): void {}
  beginPath(): void {}
  closePath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  quadraticCurveTo(): void {}
  bezierCurveTo(): void {}
  arc(): void {}
  arcTo(): void {}
  ellipse(): void {}
  roundRect(): void {}
  rect(): void {}
  fill(): void {}
  stroke(): void {}
  clip(): void {}
  fillText(): void {}
  strokeText(): void {}
  drawImage(): void {}
  measureText(): { width: number } {
    return { width: 10 };
  }
  setLineDash(): void {}
  createLinearGradient(): { addColorStop: () => void } {
    return { addColorStop: () => {} };
  }
  createRadialGradient(): { addColorStop: () => void } {
    return { addColorStop: () => {} };
  }
}

/** 没有闭合标签的那几个 */
const VOID_TAGS = new Set(["img", "br", "hr", "input", "source", "meta", "link"]);

export class FakeEl {
  tagName: string;
  className = "";
  type = "";
  title = "";
  hidden = false;
  disabled = false;
  tabIndex = 0;
  width = 0;
  height = 0;
  offsetHeight = 24;
  clientWidth = 360;
  clientHeight = 540;
  readonly style: Record<string, string> = {};
  readonly dataset: Record<string, string> = {};
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  readonly attrs = new Map<string, string>();
  readonly listeners = new Map<string, Handler[]>();
  readonly classes = new Set<string>();
  readonly classList = {
    add: (c: string) => {
      this.classes.add(c);
      this.syncClassName();
    },
    remove: (c: string) => {
      this.classes.delete(c);
      this.syncClassName();
    },
    toggle: (c: string, on?: boolean) => {
      if (on ?? !this.classes.has(c)) this.classes.add(c);
      else this.classes.delete(c);
      this.syncClassName();
    },
    contains: (c: string) => this.classes.has(c),
  };
  private text = "";
  private ctx: FakeCtx | null = null;

  constructor(tagName: string) {
    this.tagName = tagName;
    if (tagName === "canvas") this.ctx = new FakeCtx();
  }

  private syncClassName(): void {
    this.className = [...this.classes].join(" ");
  }

  setClass(v: string): void {
    this.classes.clear();
    for (const c of v.split(/\s+/)) if (c) this.classes.add(c);
    this.className = v;
  }

  getContext(kind: string): FakeCtx | null {
    return kind === "2d" ? this.ctx : null;
  }

  get textContent(): string {
    if (this.children.length === 0) return this.text;
    let out = this.text;
    for (const kid of this.children) out += kid.textContent;
    return out;
  }

  set textContent(value: string) {
    for (const kid of this.children) kid.parent = null;
    this.children = [];
    this.text = value;
  }

  get innerHTML(): string {
    return this.textContent;
  }

  set innerHTML(v: string) {
    for (const kid of this.children) kid.parent = null;
    this.children = [];
    this.text = "";
    for (const node of parseHtml(v)) this.appendChild(node);
  }

  get parentElement(): FakeEl | null {
    return this.parent;
  }

  setAttribute(k: string, v: string): void {
    if (k === "class") {
      this.setClass(v);
      return;
    }
    this.attrs.set(k, v);
  }

  getAttribute(k: string): string | null {
    return k === "class" ? this.className : (this.attrs.get(k) ?? null);
  }

  removeAttribute(k: string): void {
    this.attrs.delete(k);
  }

  focus(): void {}
  blur(): void {}
  scrollIntoView(): void {}
  setPointerCapture(): void {}
  releasePointerCapture(): void {}

  appendChild(child: FakeEl): FakeEl {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...kids: FakeEl[]): void {
    for (const kid of kids) this.appendChild(kid);
  }

  removeChild(child: FakeEl): void {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parent = null;
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  private matches(selector: string): boolean {
    for (const part of selector.split(",")) {
      const one = part.trim();
      if (!one) continue;
      if (one.startsWith(".")) {
        if (this.classes.has(one.slice(1))) return true;
      } else if (one.startsWith("[")) {
        const attr = one.slice(1, -1).split("=")[0];
        if (attr.startsWith("data-")) {
          if (this.dataset[dashToCamel(attr.slice(5))] !== undefined) return true;
        } else if (this.attrs.has(attr)) return true;
      } else if (this.tagName === one) return true;
    }
    return false;
  }

  querySelector(selector: string): FakeEl | null {
    let hit: FakeEl | null = null;
    walk(this, (el) => {
      if (!hit && el !== this && el.matches(selector)) hit = el;
    });
    return hit;
  }

  querySelectorAll(selector: string): FakeEl[] {
    const out: FakeEl[] = [];
    walk(this, (el) => {
      if (el !== this && el.matches(selector)) out.push(el);
    });
    return out;
  }

  /** 画布逻辑宽 360、高 540:正好是手机 360px 竖屏那一档 */
  rect: { left: number; top: number; width: number; height: number } | null = null;

  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
    const r = this.rect ?? { left: 0, top: 0, width: 360, height: 540 };
    return { ...r, right: r.left + r.width, bottom: r.top + r.height };
  }

  addEventListener(type: string, fn: Handler): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, fn: Handler): void {
    const list = this.listeners.get(type);
    const i = list ? list.indexOf(fn) : -1;
    if (list && i >= 0) list.splice(i, 1);
  }

  /** 这棵子树上还挂着几个监听(destroy 归零断言用) */
  listenerCount(): number {
    let n = 0;
    walk(this, (el) => {
      for (const list of el.listeners.values()) n += list.length;
    });
    return n;
  }

  fire(type: string, extra: Partial<FakeEvent> = {}): void {
    for (const fn of [...(this.listeners.get(type) ?? [])]) {
      fn({ preventDefault: () => {}, ...extra });
    }
  }
}

function dashToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}

const TAG_RE = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
const ATTR_RE = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function applyAttrs(el: FakeEl, raw: string): void {
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(raw)) !== null) {
    const key = m[1];
    if (!key) continue;
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (key === "class") el.setClass(value);
    else if (key === "type") el.type = value;
    else if (key.startsWith("data-")) el.dataset[dashToCamel(key.slice(5))] = value;
    else el.setAttribute(key, value);
  }
}

/** 够本款模板用的迷你 HTML 解析器 */
export function parseHtml(html: string): FakeEl[] {
  const roots: FakeEl[] = [];
  const stack: FakeEl[] = [];
  const put = (node: FakeEl): void => {
    const top = stack[stack.length - 1];
    if (top) top.appendChild(node);
    else roots.push(node);
  };
  const putText = (raw: string): void => {
    const t = raw.replace(/\s+/g, " ").trim();
    if (!t) return;
    const node = new FakeEl("#text");
    node.textContent = t;
    put(node);
  };

  TAG_RE.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(html)) !== null) {
    putText(html.slice(last, m.index));
    last = TAG_RE.lastIndex;
    const [, closing, rawName, attrs, selfClose] = m;
    const name = rawName.toLowerCase();
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tagName === name) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const node = new FakeEl(name);
    applyAttrs(node, attrs ?? "");
    put(node);
    if (!selfClose && !VOID_TAGS.has(name)) stack.push(node);
  }
  putText(html.slice(last));
  return roots;
}

export function walk(root: FakeEl, fn: (el: FakeEl) => void): void {
  fn(root);
  for (const kid of [...root.children]) walk(kid, fn);
}

export function countNodes(root: FakeEl): number {
  let n = 0;
  walk(root, () => n++);
  return n;
}

/** 整棵树上的文字拼起来。`<style>` 里的样式不算 */
export function allText(root: FakeEl): string {
  let out = "";
  walk(root, (el) => {
    if (el.tagName === "style") return;
    out += `${el.textContent} `;
  });
  return out;
}

export function findButton(root: FakeEl, needle: string): FakeEl | null {
  let hit: FakeEl | null = null;
  walk(root, (el) => {
    if (hit || el.tagName !== "button") return;
    if (el.textContent.includes(needle)) hit = el;
  });
  return hit;
}

export function findAll(root: FakeEl, cls: string): FakeEl[] {
  const out: FakeEl[] = [];
  walk(root, (el) => {
    if (el.classes.has(cls)) out.push(el);
  });
  return out;
}

export function findOne(root: FakeEl, cls: string): FakeEl | null {
  return findAll(root, cls)[0] ?? null;
}

export interface Harness {
  root: FakeEl;
  /** 还没被取消的 rAF 有几个 */
  pendingFrames: () => number;
  /** 还排着几个 `window.setTimeout` */
  pendingTimers: () => number;
  /** window 上还挂着几个监听 */
  windowListeners: () => number;
  /** 还没 disconnect 的 ResizeObserver 有几个 */
  liveObservers: () => number;
  /** 把排着的那几帧跑掉(默认每帧 16ms) */
  flush: (times?: number, ms?: number) => void;
  /** 把排着的 setTimeout 全跑掉 */
  runTimers: () => void;
  /** 在 window 上放一个 keydown / keyup(本款认的是 `key`) */
  key: (type: "keydown" | "keyup", key: string, code?: string) => void;
  /** 直接在 window 上放事件(blur / resize 用) */
  fireWindow: (type: string, e?: Partial<FakeEvent>) => void;
  storage: Map<string, string>;
  restore: () => void;
}

export function install(
  opts: { innerWidth?: number; innerHeight?: number; search?: string; reduceMotion?: boolean } = {}
): Harness {
  const g = globalThis as Record<string, unknown>;
  const saved = {
    document: g.document,
    window: g.window,
    raf: g.requestAnimationFrame,
    caf: g.cancelAnimationFrame,
    storage: g.localStorage,
    performance: g.performance,
    location: g.location,
    matchMedia: g.matchMedia,
    dpr: g.devicePixelRatio,
    innerHeight: g.innerHeight,
    computed: g.getComputedStyle,
    ro: g.ResizeObserver,
    image: g.Image,
    clearTimeout: g.clearTimeout,
  };

  const frames = new Map<number, (t: number) => void>();
  const timers = new Map<number, () => void>();
  let nextId = 1;
  let clock = 0;
  let live = 0;

  const winListeners = new Map<string, Handler[]>();
  const media = (q: string): { matches: boolean } => ({
    matches: /reduced-motion/.test(q) ? (opts.reduceMotion ?? false) : false,
  });
  const win = {
    innerWidth: opts.innerWidth ?? 360,
    innerHeight: opts.innerHeight ?? 720,
    navigator: { hardwareConcurrency: 8 },
    devicePixelRatio: 2,
    addEventListener(type: string, fn: Handler): void {
      const list = winListeners.get(type) ?? [];
      list.push(fn);
      winListeners.set(type, list);
    },
    removeEventListener(type: string, fn: Handler): void {
      const list = winListeners.get(type);
      const i = list ? list.indexOf(fn) : -1;
      if (list && i >= 0) list.splice(i, 1);
    },
    getComputedStyle: () => ({ overflowY: "visible" }),
    matchMedia: media,
    setTimeout(fn: () => void): number {
      const id = nextId++;
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id: number): void {
      timers.delete(id);
    },
  };

  /** 头像是 `new Image()` 预载的,桩到「有这么个东西」就够,不真的去取图 */
  class FakeImage {
    src = "";
    width = 0;
    height = 0;
    complete = true;
    naturalWidth = 64;
    naturalHeight = 64;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoding = "";
    addEventListener(): void {}
    removeEventListener(): void {}
  }

  class FakeResizeObserver {
    private on = false;
    observe(): void {
      if (this.on) return;
      this.on = true;
      live++;
    }
    unobserve(): void {
      this.disconnect();
    }
    disconnect(): void {
      if (!this.on) return;
      this.on = false;
      live--;
    }
  }

  const store = new Map<string, string>();
  const docBody = new FakeEl("body");
  const doc = {
    createElement: (tag: string) => new FakeEl(tag),
    createTextNode: (text: string) => {
      const el = new FakeEl("#text");
      el.textContent = text;
      return el;
    },
    defaultView: win,
    body: docBody,
    head: new FakeEl("head"),
    documentElement: new FakeEl("html"),
    visibilityState: "visible",
    hidden: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  g.document = doc;
  g.window = win;
  g.matchMedia = media;
  g.devicePixelRatio = 2;
  g.innerHeight = win.innerHeight;
  g.getComputedStyle = win.getComputedStyle;
  g.location = { search: opts.search ?? "", href: `http://localhost/${opts.search ?? ""}` };
  g.ResizeObserver = FakeResizeObserver;
  g.Image = FakeImage;
  g.requestAnimationFrame = (fn: (t: number) => void): number => {
    const id = nextId++;
    frames.set(id, fn);
    return id;
  };
  g.cancelAnimationFrame = (id: number): void => {
    frames.delete(id);
  };
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  g.performance = { now: () => clock };
  // 本款排队用的是 `window.setTimeout`,取消用的却是**裸的** `clearTimeout` ——
  // 浏览器里这两个本来就是同一个函数,所以没毛病;但 node 里裸的那个是 node 自己的,
  // 够不着上面那份桩。这里让裸 `clearTimeout` 先在桩的队列里找,找不到再交回 node。
  const nativeClear = saved.clearTimeout as ((id: unknown) => void) | undefined;
  g.clearTimeout = (id: unknown): void => {
    if (typeof id === "number" && timers.has(id)) {
      timers.delete(id);
      return;
    }
    nativeClear?.(id);
  };

  function fireWin(type: string, e: FakeEvent): void {
    for (const fn of [...(winListeners.get(type) ?? [])]) fn(e);
  }

  return {
    root: new FakeEl("div"),
    pendingFrames: () => frames.size,
    pendingTimers: () => timers.size,
    windowListeners: () => [...winListeners.values()].reduce((n, l) => n + l.length, 0),
    liveObservers: () => live,
    flush(times = 1, ms = 16) {
      for (let i = 0; i < times; i++) {
        const due = [...frames.entries()];
        frames.clear();
        clock += ms;
        for (const [, fn] of due) fn(clock);
      }
    },
    runTimers() {
      const due = [...timers.entries()];
      timers.clear();
      for (const [, fn] of due) fn();
    },
    key(type, key, code) {
      fireWin(type, { key, code: code ?? key, preventDefault: () => {} });
    },
    fireWindow(type, e = {}) {
      fireWin(type, { preventDefault: () => {}, ...e });
    },
    storage: store,
    restore() {
      g.document = saved.document;
      g.window = saved.window;
      g.requestAnimationFrame = saved.raf;
      g.cancelAnimationFrame = saved.caf;
      g.localStorage = saved.storage;
      g.performance = saved.performance;
      g.location = saved.location;
      g.matchMedia = saved.matchMedia;
      g.devicePixelRatio = saved.dpr;
      g.innerHeight = saved.innerHeight;
      g.getComputedStyle = saved.computed;
      g.ResizeObserver = saved.ro;
      g.Image = saved.image;
      g.clearTimeout = saved.clearTimeout;
    },
  };
}
