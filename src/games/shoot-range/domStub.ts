/**
 * 康康射击场 · 测试用的极简 DOM 桩。
 *
 * 仓库的 vitest 跑在 node 环境(没有 jsdom,也不许为此引依赖),
 * 所以本款自己搭一份桩,只实现运行时真正用到的那几样:建节点、挂/摘监听、排 rAF、
 * canvas 的 2d 画笔与 `getBoundingClientRect`、带 `pointerId` / `pointerType` 的指针事件、
 * 带 `code` 的键盘事件、`matchMedia`(减少动态)与 `devicePixelRatio`。
 *
 * 这个文件不带 `.test.` 后缀,vitest 不会把它当用例文件;
 * 玩法代码一行都没 import 它,打包时也不会被带进游戏 chunk。
 */

export interface FakeEvent {
  code?: string;
  key?: string;
  pointerId?: number;
  pointerType?: string;
  clientX?: number;
  clientY?: number;
  buttons?: number;
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
  arcTo(): void {}
  quadraticCurveTo(): void {}
  bezierCurveTo(): void {}
  arc(): void {}
  ellipse(): void {}
  roundRect(): void {}
  rect(): void {}
  fill(): void {}
  stroke(): void {}
  clip(): void {}
  fillText(): void {}
  strokeText(): void {}
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

export class FakeEl {
  tagName: string;
  className = "";
  type = "";
  hidden = false;
  disabled = false;
  tabIndex = 0;
  width = 0;
  height = 0;
  offsetHeight = 24;
  clientWidth = 360;
  clientHeight = 240;
  readonly style: Record<string, string> = {};
  readonly dataset: Record<string, string> = {};
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  ownerDocument: unknown = null;
  readonly attrs = new Map<string, string>();
  readonly listeners = new Map<string, Handler[]>();
  readonly classes = new Set<string>();
  focused = 0;
  readonly classList = {
    add: (c: string) => void this.classes.add(c),
    remove: (c: string) => void this.classes.delete(c),
    toggle: (c: string, on?: boolean) => {
      if (on ?? !this.classes.has(c)) this.classes.add(c);
      else this.classes.delete(c);
    },
    contains: (c: string) => this.classes.has(c),
  };
  private text = "";
  private ctx: FakeCtx | null = null;

  constructor(tagName: string) {
    this.tagName = tagName;
    if (tagName === "canvas") this.ctx = new FakeCtx();
  }

  getContext(kind: string): FakeCtx | null {
    return kind === "2d" ? this.ctx : null;
  }

  get textContent(): string {
    return this.text;
  }

  set textContent(value: string) {
    for (const kid of this.children) kid.parent = null;
    this.children = [];
    this.text = value;
  }

  get innerHTML(): string {
    return this.text;
  }

  /** 桩不解析 HTML,只把标签剥掉留下文字——用例断言的是「上面写着什么」,够用了 */
  set innerHTML(v: string) {
    for (const kid of this.children) kid.parent = null;
    this.children = [];
    this.text = v.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  get parentElement(): FakeEl | null {
    return this.parent;
  }

  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }

  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null;
  }

  focus(): void {
    this.focused++;
  }

  setPointerCapture(): void {}
  releasePointerCapture(): void {}
  scrollIntoView(): void {}

  appendChild(child: FakeEl): FakeEl {
    child.parent?.removeChild(child);
    child.parent = this;
    child.ownerDocument = this.ownerDocument;
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

  querySelector(selector: string): FakeEl | null {
    const want = selector.replace(".", "");
    let hit: FakeEl | null = null;
    walk(this, (node) => {
      if (!hit && node !== this && node.className.split(/\s+/).includes(want)) hit = node;
    });
    return hit;
  }

  /** 画布铺满 360px 宽的手机屏,高度按 620/1000 的场地比例来 */
  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
    if (this.tagName === "canvas") {
      return { left: 0, top: 100, right: 360, bottom: 323, width: 360, height: 223 };
    }
    return { left: 0, top: 0, right: 360, bottom: 44, width: 360, height: 44 };
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

  fire(type: string, extra: Partial<FakeEvent> = {}): void {
    for (const fn of [...(this.listeners.get(type) ?? [])]) {
      fn({ preventDefault: () => {}, ...extra });
    }
  }

  /** 这个节点上一共挂了几个监听(查泄漏用) */
  listenerCount(): number {
    return [...this.listeners.values()].reduce((n, l) => n + l.length, 0);
  }
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

/** 整棵树上的文字拼起来(`<style>` 里的样式不算) */
export function allText(root: FakeEl): string {
  let out = "";
  walk(root, (node) => {
    if (node.tagName === "style") return;
    out += `${node.textContent} `;
  });
  return out;
}

/** 找到第一个文字里带这几个字的按钮 */
export function findButton(root: FakeEl, needle: string): FakeEl | null {
  let hit: FakeEl | null = null;
  walk(root, (node) => {
    if (hit || node.tagName !== "button") return;
    let all = node.textContent;
    walk(node, (kid) => {
      all += kid.textContent;
    });
    if (all.includes(needle)) hit = node;
  });
  return hit;
}

/** class 命中的所有节点 */
export function findAll(root: FakeEl, cls: string): FakeEl[] {
  const out: FakeEl[] = [];
  walk(root, (node) => {
    if (node.className.split(/\s+/).includes(cls)) out.push(node);
  });
  return out;
}

export function findOne(root: FakeEl, cls: string): FakeEl | null {
  return findAll(root, cls)[0] ?? null;
}

/** 整棵树上还挂着几个监听 */
export function totalListeners(root: FakeEl): number {
  let n = 0;
  walk(root, (node) => {
    n += node.listenerCount();
  });
  return n;
}

export interface Harness {
  root: FakeEl;
  /** 还没被取消的 rAF 有几个 */
  pendingFrames: () => number;
  /** window 上还挂着几个监听 */
  windowListeners: () => number;
  /** 把排着的那几帧跑掉(默认每帧 16ms;主循环自己会把 dt 夹到 50ms) */
  flush: (times?: number, ms?: number) => void;
  /** 在 window 上放一个 keydown / keyup(`code` 是本款的键位口径) */
  key: (type: "keydown" | "keyup", code: string) => void;
  /** 「这台机器喜欢少一点动效」 */
  setReducedMotion: (on: boolean) => void;
  /** 地址栏(测 `?level=`) */
  setSearch: (search: string) => void;
  storage: Map<string, string>;
  restore: () => void;
}

export function install(opts: { innerWidth?: number; search?: string } = {}): Harness {
  const g = globalThis as Record<string, unknown>;
  const saved = {
    document: g.document,
    window: g.window,
    raf: g.requestAnimationFrame,
    caf: g.cancelAnimationFrame,
    storage: g.localStorage,
    performance: g.performance,
    location: g.location,
    devicePixelRatio: g.devicePixelRatio,
    matchMedia: g.matchMedia,
  };

  const frames = new Map<number, (t: number) => void>();
  let nextId = 1;
  let clock = 0;
  let reduced = false;
  const loc = { search: opts.search ?? "" };

  const winListeners = new Map<string, Handler[]>();
  const matchMedia = (q: string): { matches: boolean } => ({ matches: reduced && q.includes("reduced-motion") });
  const win = {
    innerWidth: opts.innerWidth ?? 360,
    innerHeight: 720,
    devicePixelRatio: 1,
    navigator: { hardwareConcurrency: 8 },
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
    matchMedia,
    // 提示条那个 1.1 秒的定时器不需要真的跑,给个号就行(免得吊住 node 进程)
    setTimeout: () => 1,
    clearTimeout: () => {},
  };

  const store = new Map<string, string>();
  // `level99` 会顺着 `ui/dialogs` 拉进 `engine/audio`,那两个模块在加载时就往 document 上挂监听。
  // 它们不是本款的东西,桩到能跑就行,不参与断言。
  const docBody = new FakeEl("body");
  const doc = {
    createElement: (tag: string) => {
      const node = new FakeEl(tag);
      node.ownerDocument = doc;
      return node;
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
  const root = new FakeEl("div");
  root.ownerDocument = doc;

  g.document = doc;
  g.window = win;
  g.location = loc;
  g.devicePixelRatio = 1;
  g.matchMedia = matchMedia;
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

  return {
    root,
    pendingFrames: () => frames.size,
    windowListeners: () => [...winListeners.values()].reduce((n, l) => n + l.length, 0),
    flush(times = 1, ms = 16) {
      for (let i = 0; i < times; i++) {
        const due = [...frames.entries()];
        frames.clear();
        clock += ms;
        for (const [, fn] of due) fn(clock);
      }
    },
    key(type, code) {
      for (const fn of [...(winListeners.get(type) ?? [])]) fn({ code, key: code, preventDefault: () => {} });
    },
    setReducedMotion(on) {
      reduced = on;
    },
    setSearch(search) {
      loc.search = search;
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
      g.devicePixelRatio = saved.devicePixelRatio;
      g.matchMedia = saved.matchMedia;
    },
  };
}
