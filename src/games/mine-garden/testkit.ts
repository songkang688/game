/**
 * 只给 `*.test.ts` 用的小工具：一份够用的 DOM 替身。
 * 玩法代码一个字都不会 import 它，所以不会进打包产物。
 */
export type FakeHandler = (e: unknown) => void;

export class FakeEl {
  tag: string;
  className = "";
  type = "";
  hidden = false;
  disabled = false;
  tabIndex = 0;
  width = 0;
  height = 0;
  value = "";
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  listeners = new Map<string, Set<FakeHandler>>();
  clientWidth = 360;
  scrollLeft = 0;
  private text = "";

  constructor(tag: string) {
    this.tag = tag;
  }

  get textContent(): string {
    if (this.text) return this.text;
    return this.children.map((c) => c.textContent).join("");
  }

  set textContent(v: string) {
    this.text = v;
    this.children = [];
  }

  set innerHTML(v: string) {
    this.children = [];
    this.text = v;
  }

  appendChild(child: FakeEl): FakeEl {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...kids: FakeEl[]): void {
    for (const k of kids) this.appendChild(k);
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

  getContext(): null {
    return null;
  }

  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: this.width, height: this.height };
  }

  scrollIntoView(): void {
    /* 单测里不需要真的滚 */
  }

  focus(): void {
    /* 同上 */
  }

  setPointerCapture(): void {
    /* 同上 */
  }

  releasePointerCapture(): void {
    /* 同上 */
  }

  addEventListener(name: string, fn: FakeHandler): void {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)?.add(fn);
  }

  removeEventListener(name: string, fn: FakeHandler): void {
    this.listeners.get(name)?.delete(fn);
  }

  fire(name: string, ev: Record<string, unknown> = {}): void {
    const base = { preventDefault: () => undefined, stopPropagation: () => undefined, button: 0, pointerId: 1 };
    for (const fn of [...(this.listeners.get(name) ?? [])]) fn({ ...base, ...ev });
  }

  querySelector(sel: string): FakeEl | null {
    return this.all().find((el) => el.className.split(" ").includes(sel.replace(".", ""))) ?? null;
  }

  /** 自己的全部后代 */
  all(): FakeEl[] {
    const out: FakeEl[] = [];
    const walk = (el: FakeEl): void => {
      out.push(el);
      for (const c of el.children) walk(c);
    };
    for (const c of this.children) walk(c);
    return out;
  }

  byClass(cls: string): FakeEl[] {
    return this.all().filter((el) => el.className.split(" ").includes(cls));
  }

  /** 后代里第一个正文包含 needle 的元素 */
  findText(needle: string): FakeEl | null {
    return this.all().find((el) => el.textContent.includes(needle)) ?? null;
  }

  /** 后代里所有按钮的正文 */
  buttonTexts(): string[] {
    return this.all()
      .filter((el) => el.tag === "button")
      .map((el) => el.textContent);
  }

  /** 按正文找按钮（找不到返回 null） */
  button(needle: string): FakeEl | null {
    return (
      this.all().find((el) => el.tag === "button" && el.textContent.includes(needle)) ?? null
    );
  }
}

export interface DomStub {
  root: FakeEl;
  /** 挂在 globalThis 上的监听器（keydown / resize 等） */
  globals: Map<string, Set<FakeHandler>>;
  press: (key: string) => void;
  globalCount: () => number;
  /** 还没清掉的定时器 / rAF 个数 */
  timerCount: () => number;
  /** 把攒着的定时器一口气跑完 */
  flush: (max?: number) => void;
  /** 只跑一轮 rAF */
  frame: (max?: number) => void;
  restore: () => void;
}

/** 装上 DOM 替身，记得在 afterEach 里 restore */
export function installDom(): DomStub {
  const g = globalThis as unknown as Record<string, unknown>;
  const prev = {
    document: g.document,
    addEventListener: g.addEventListener,
    removeEventListener: g.removeEventListener,
    setTimeout: g.setTimeout,
    clearTimeout: g.clearTimeout,
    setInterval: g.setInterval,
    clearInterval: g.clearInterval,
    requestAnimationFrame: g.requestAnimationFrame,
    cancelAnimationFrame: g.cancelAnimationFrame,
    innerWidth: g.innerWidth
  };
  const globals = new Map<string, Set<FakeHandler>>();
  const timers = new Map<number, () => void>();
  const frames = new Map<number, () => void>();
  let nextId = 1;

  g.document = { createElement: (tag: string) => new FakeEl(tag) };
  g.innerWidth = 360;
  g.addEventListener = (name: string, fn: FakeHandler) => {
    if (!globals.has(name)) globals.set(name, new Set());
    globals.get(name)?.add(fn);
  };
  g.removeEventListener = (name: string, fn: FakeHandler) => {
    globals.get(name)?.delete(fn);
  };
  g.setTimeout = ((fn: () => void) => {
    const id = nextId++;
    timers.set(id, fn);
    return id;
  }) as unknown as typeof setTimeout;
  g.clearTimeout = ((id: number) => timers.delete(id)) as unknown as typeof clearTimeout;
  g.setInterval = ((fn: () => void) => {
    const id = nextId++;
    timers.set(id, fn);
    return id;
  }) as unknown as typeof setInterval;
  g.clearInterval = ((id: number) => timers.delete(id)) as unknown as typeof clearInterval;
  g.requestAnimationFrame = ((fn: () => void) => {
    const id = nextId++;
    frames.set(id, fn);
    return id;
  }) as unknown as typeof requestAnimationFrame;
  g.cancelAnimationFrame = ((id: number) => frames.delete(id)) as unknown as typeof cancelAnimationFrame;

  return {
    root: new FakeEl("div"),
    globals,
    press(key: string) {
      for (const fn of [...(globals.get("keydown") ?? [])]) fn({ key, preventDefault: () => undefined });
    },
    globalCount() {
      let n = 0;
      for (const set of globals.values()) n += set.size;
      return n;
    },
    timerCount() {
      return timers.size + frames.size;
    },
    flush(max = 600) {
      let n = 0;
      while ((timers.size > 0 || frames.size > 0) && n++ < max) {
        const tid = timers.keys().next().value as number | undefined;
        if (tid !== undefined) {
          const fn = timers.get(tid);
          timers.delete(tid);
          fn?.();
          continue;
        }
        const fid = frames.keys().next().value as number;
        const fn = frames.get(fid);
        frames.delete(fid);
        fn?.();
      }
    },
    frame(max = 60) {
      let n = 0;
      const ids = [...frames.keys()];
      for (const id of ids) {
        if (n++ >= max) break;
        const fn = frames.get(id);
        frames.delete(id);
        fn?.();
      }
    },
    restore() {
      for (const [k, v] of Object.entries(prev)) g[k] = v;
    }
  };
}
