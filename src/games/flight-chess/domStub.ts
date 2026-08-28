/**
 * 飞行棋乐园 · 测试用的极简 DOM 桩。
 *
 * 仓库 vitest 跑在 node 环境（没有 jsdom，也不许为此引依赖），
 * 1.3 的视觉层是「innerHTML 拼 SVG 字符串 + 少量持久节点」，
 * 桩只要记住三样：innerHTML 原文、属性表、class 集合，
 * 视觉契约测试直接对字符串断言。
 *
 * 额外带一本 `classLog`：记下**曾经**被 add / toggle-on 过的所有 class，
 * 「reduced 下逐格跳类一次都没加过」这类断言就查它。
 *
 * 文件不带 `.test.` 后缀，vitest 不会当用例；玩法代码一行都没 import 它。
 */

export type Handler = (e: { key?: string; preventDefault: () => void }) => void;

export class FakeEl {
  tagName: string;
  type = "";
  hidden = false;
  disabled = false;
  width = 0;
  height = 0;
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  readonly attrs = new Map<string, string>();
  readonly listeners = new Map<string, Handler[]>();
  readonly style: Record<string, string> & { setProperty: (k: string, v: string) => void };
  private classes = new Set<string>();
  private text = "";
  private html = "";
  private log: Set<string> | null;

  readonly classList = {
    add: (...cs: string[]) => {
      for (const c of cs) {
        this.classes.add(c);
        this.log?.add(c);
      }
    },
    remove: (...cs: string[]) => {
      for (const c of cs) this.classes.delete(c);
    },
    toggle: (c: string, on?: boolean) => {
      if (on ?? !this.classes.has(c)) {
        this.classes.add(c);
        this.log?.add(c);
      } else this.classes.delete(c);
    },
    contains: (c: string) => this.classes.has(c)
  };

  constructor(tagName: string, log: Set<string> | null = null) {
    this.tagName = tagName;
    this.log = log;
    const store: Record<string, string> = {};
    this.style = Object.assign(store, {
      setProperty: (k: string, v: string) => {
        store[k] = v;
      }
    });
  }

  get className(): string {
    return [...this.classes].join(" ");
  }

  set className(v: string) {
    this.classes = new Set(v.split(/\s+/).filter(Boolean));
    for (const c of this.classes) this.log?.add(c);
  }

  get textContent(): string {
    return this.text;
  }

  set textContent(v: string) {
    for (const kid of this.children) kid.parent = null;
    this.children = [];
    this.html = "";
    this.text = v;
  }

  /** 记住最后一次赋的 HTML 原文，断言 SVG 结构就查它 */
  get innerHTML(): string {
    return this.html;
  }

  set innerHTML(v: string) {
    for (const kid of this.children) kid.parent = null;
    this.children = [];
    this.text = "";
    this.html = v;
  }

  get parentElement(): FakeEl | null {
    return this.parent;
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

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

  fire(type: string): void {
    for (const fn of [...(this.listeners.get(type) ?? [])]) {
      fn({ preventDefault: () => {} });
    }
  }

  focus(): void {
    /* 假 DOM 不需要真的聚焦 */
  }
}

/** 深度遍历整棵桩树 */
export function walk(root: FakeEl, fn: (el: FakeEl) => void): void {
  fn(root);
  for (const kid of root.children) walk(kid, fn);
}

/** 收集 class 含某个词的全部节点 */
export function byClass(root: FakeEl, cls: string): FakeEl[] {
  const hits: FakeEl[] = [];
  walk(root, (el) => {
    if (el.classList.contains(cls)) hits.push(el);
  });
  return hits;
}

export interface Harness {
  root: FakeEl;
  /** 这一局里所有节点曾经被加过的 class 全集 */
  classLog: Set<string>;
  /** 给 window keydown 派一个键（F 掷骰 / G 换飞机…） */
  press: (key: string) => void;
  restore: () => void;
}

/**
 * 装上 document / window 桩；`reduced: true` 时再补一个
 * `matchMedia("(prefers-reduced-motion: reduce)")` 命中的桩。
 */
export function install(opts: { reduced?: boolean } = {}): Harness {
  const g = globalThis as Record<string, unknown>;
  const saved = { document: g.document, window: g.window, matchMedia: g.matchMedia };
  const classLog = new Set<string>();
  const winListeners = new Map<string, Handler[]>();
  g.document = {
    createElement: (tag: string) => new FakeEl(tag, classLog),
    createElementNS: (_ns: string, tag: string) => new FakeEl(tag, classLog)
  };
  g.window = {
    addEventListener(type: string, fn: Handler) {
      const list = winListeners.get(type) ?? [];
      list.push(fn);
      winListeners.set(type, list);
    },
    removeEventListener(type: string, fn: Handler) {
      const list = winListeners.get(type) ?? [];
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    }
  };
  if (opts.reduced) {
    g.matchMedia = () => ({ matches: true });
  }
  return {
    root: new FakeEl("div", classLog),
    classLog,
    press: (key: string) => {
      for (const fn of [...(winListeners.get("keydown") ?? [])]) fn({ key, preventDefault: () => {} });
    },
    restore() {
      g.document = saved.document;
      g.window = saved.window;
      if (opts.reduced) {
        if (saved.matchMedia === undefined) delete g.matchMedia;
        else g.matchMedia = saved.matchMedia;
      }
    }
  };
}
