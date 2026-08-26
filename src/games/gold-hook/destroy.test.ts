/**
 * `destroy()` 必须归零。
 *
 * 这一款在 `window` 上挂了 resize 与 keydown、开了主循环 rAF、
 * 版面还额外排了一帧 rAF，无尽模式的结算跳数又是一条独立的 rAF。
 * 玩家从矿洞退回首页、再从首页退出游戏，这些东西一样都不许留下 ——
 * 留一个 keydown 在上面，下一款游戏里按空格就会莫名其妙地放绳。
 *
 * 仓库的 vitest 跑在 node 环境（没有 jsdom，也不许为此引依赖），
 * 所以这里自己搭一个极简 DOM 桩，只实现本款真正用到的那几样能力。
 */
import { afterEach, describe, expect, it } from "vitest";

type Handler = (e: FakeEvent) => void;

interface FakeEvent {
  key?: string;
  preventDefault: () => void;
}

class FakeCtx {
  fillStyle: unknown = "";
  strokeStyle: unknown = "";
  lineWidth = 0;
  font = "";
  textAlign = "";
  textBaseline = "";
  globalAlpha = 1;
  save(): void {}
  restore(): void {}
  setTransform(): void {}
  translate(): void {}
  rotate(): void {}
  clearRect(): void {}
  fillRect(): void {}
  beginPath(): void {}
  closePath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  quadraticCurveTo(): void {}
  arc(): void {}
  ellipse(): void {}
  roundRect(): void {}
  rect(): void {}
  fill(): void {}
  stroke(): void {}
  fillText(): void {}
  setLineDash(): void {}
  createLinearGradient(): { addColorStop: () => void } {
    return { addColorStop: () => {} };
  }
  createRadialGradient(): { addColorStop: () => void } {
    return { addColorStop: () => {} };
  }
}

class FakeEl {
  tagName: string;
  className = "";
  type = "";
  hidden = false;
  disabled = false;
  tabIndex = 0;
  width = 0;
  height = 0;
  offsetHeight = 20;
  clientWidth = 360;
  readonly style: Record<string, string> = {};
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  readonly listeners = new Map<string, Handler[]>();
  readonly classes = new Set<string>();
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
    return "";
  }

  set innerHTML(_v: string) {
    for (const kid of this.children) kid.parent = null;
    this.children = [];
  }

  get parentElement(): FakeEl | null {
    return this.parent;
  }

  setAttribute(): void {}

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

  querySelector(selector: string): FakeEl | null {
    const want = selector.replace(".", "");
    let hit: FakeEl | null = null;
    walk(this, (el) => {
      if (!hit && el.className.split(/\s+/).includes(want)) hit = el;
    });
    return hit;
  }

  getBoundingClientRect(): { top: number; bottom: number } {
    return { top: 120, bottom: 640 };
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
}

function walk(root: FakeEl, fn: (el: FakeEl) => void): void {
  fn(root);
  for (const kid of root.children) walk(kid, fn);
}

function countNodes(root: FakeEl): number {
  let n = 0;
  walk(root, () => n++);
  return n;
}

/** 找到第一个文字里带这几个字的按钮 */
function findButton(root: FakeEl, needle: string): FakeEl | null {
  let hit: FakeEl | null = null;
  walk(root, (el) => {
    if (hit || el.tagName !== "button") return;
    let all = el.textContent;
    walk(el, (kid) => {
      all += kid.textContent;
    });
    if (all.includes(needle)) hit = el;
  });
  return hit;
}

interface Harness {
  root: FakeEl;
  /** 还没被取消的 rAF 有几个 */
  pendingFrames: () => number;
  /** window 上还挂着几个监听 */
  windowListeners: () => number;
  /** 把排着的那几帧跑掉 */
  flush: (times?: number) => void;
  restore: () => void;
}

function install(): Harness {
  const saved = {
    document: (globalThis as Record<string, unknown>).document,
    window: (globalThis as Record<string, unknown>).window,
    raf: (globalThis as Record<string, unknown>).requestAnimationFrame,
    caf: (globalThis as Record<string, unknown>).cancelAnimationFrame,
    storage: (globalThis as Record<string, unknown>).localStorage,
  };

  const frames = new Map<number, (t: number) => void>();
  let nextId = 1;
  let clock = 0;

  const winListeners = new Map<string, Handler[]>();
  const win = {
    innerHeight: 640,
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
    matchMedia: () => ({ matches: false }),
  };

  const store = new Map<string, string>();
  const g = globalThis as Record<string, unknown>;
  // `level99` 会顺着 `ui/dialogs` 拉进 `engine/audio`，那两个模块在**加载时**
  // 就往 document 上挂监听。它们不是本款的东西，桩到能跑就行，不参与断言。
  const docBody = new FakeEl("body");
  g.document = {
    createElement: (tag: string) => new FakeEl(tag),
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
  g.window = win;
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

  return {
    root: new FakeEl("div"),
    pendingFrames: () => frames.size,
    windowListeners: () => [...winListeners.values()].reduce((n, l) => n + l.length, 0),
    flush(times = 1) {
      for (let i = 0; i < times; i++) {
        const due = [...frames.entries()];
        frames.clear();
        clock += 16;
        for (const [, fn] of due) fn(clock);
      }
    },
    restore() {
      g.document = saved.document;
      g.window = saved.window;
      g.requestAnimationFrame = saved.raf;
      g.cancelAnimationFrame = saved.caf;
      g.localStorage = saved.storage;
    },
  };
}

let harness: Harness | null = null;

afterEach(() => {
  harness?.restore();
  harness = null;
});

async function mountGame(h: Harness): Promise<{ destroy: () => void }> {
  const mod = await import("./index");
  const played: string[] = [];
  return mod.mount({
    root: h.root as unknown as HTMLElement,
    play: (n: string) => void played.push(n),
  } as never);
}

describe("1.2 destroy 归零", () => {
  it("首页进无尽、开挖、再 destroy：rAF、window 监听与节点全部清干净", async () => {
    const h = install();
    harness = h;
    const before = h.windowListeners();

    const game = await mountGame(h);
    const endless = findButton(h.root, "无尽矿井");
    expect(endless).not.toBeNull();
    endless?.fire("click");

    const dig = findButton(h.root, "开挖");
    expect(dig).not.toBeNull();
    dig?.fire("click");

    // 主循环那一帧和版面那一帧都排上了，跑几帧让游戏真的动起来
    expect(h.pendingFrames()).toBeGreaterThan(0);
    h.flush(6);
    expect(h.windowListeners()).toBeGreaterThan(before);
    expect(countNodes(h.root)).toBeGreaterThan(1);

    game.destroy();

    expect(h.pendingFrames()).toBe(0);
    expect(h.windowListeners()).toBe(before);
    expect(countNodes(h.root)).toBe(1);
  });

  it("退出后再按空格不会有人接（keydown 真的摘掉了）", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    findButton(h.root, "无尽矿井")?.fire("click");
    findButton(h.root, "开挖")?.fire("click");
    h.flush(3);
    game.destroy();

    expect(h.windowListeners()).toBe(0);
    // 再跑几帧也不该冒出新的 rAF
    h.flush(3);
    expect(h.pendingFrames()).toBe(0);
  });

  it("反复进出无尽模式不会把监听越挂越多", async () => {
    const h = install();
    harness = h;

    const game = await mountGame(h);
    let peak = 0;
    for (let i = 0; i < 3; i++) {
      findButton(h.root, "无尽矿井")?.fire("click");
      findButton(h.root, "开挖")?.fire("click");
      h.flush(4);
      peak = Math.max(peak, h.windowListeners());
      findButton(h.root, "换模式")?.fire("click");
      h.flush(2);
    }
    // 每一轮的峰值都一样，说明退出时摘干净了
    expect(peak).toBeLessThanOrEqual(2);
    game.destroy();
    expect(h.windowListeners()).toBe(0);
    expect(h.pendingFrames()).toBe(0);
  });
});
