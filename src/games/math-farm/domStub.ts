/**
 * 极简 DOM 桩（只给本目录的用例用）。
 *
 * 仓库的 vitest 跑在 node 环境、没有 jsdom，也不打算为了几条用例引新依赖，
 * 所以这里手写运行器真正用到的那几样能力：建元素、按类名查、挂/摘捕获阶段监听、
 * classList、textContent、appendChild / remove、closest，外加一个能手动触发的
 * MutationObserver 替身（运行器靠它知道壳换题了）。
 *
 * 只在测试里 import，玩法代码一行都不碰它。
 */

export interface StubEvent {
  type: string;
  target: StubEl | null;
}

type Handler = (e: StubEvent) => void;

export class StubEl {
  readonly tagName: string;
  textContent = "";
  hidden = false;
  readonly children: StubEl[] = [];
  parentElement: StubEl | null = null;
  readonly attrs = new Map<string, string>();
  /** `click` 与 `click:capture` 分开记：destroy 漏摘哪一处都看得出来 */
  readonly listeners = new Map<string, Handler[]>();
  ownerDocument: StubDoc;
  private classes = new Set<string>();

  constructor(tagName: string, doc?: StubDoc) {
    this.tagName = tagName;
    this.ownerDocument = doc ?? sharedDoc();
  }

  get className(): string {
    return [...this.classes].join(" ");
  }

  set className(value: string) {
    this.classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  readonly classList = {
    add: (...names: string[]): void => {
      for (const n of names) this.classes.add(n);
    },
    remove: (...names: string[]): void => {
      for (const n of names) this.classes.delete(n);
    },
    contains: (name: string): boolean => this.classes.has(name),
  };

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attrs.has(name) ? (this.attrs.get(name) as string) : null;
  }

  appendChild<T extends StubEl>(child: T): T {
    child.parentElement?.removeChild(child);
    child.parentElement = this;
    this.children.push(child);
    notifyObservers(this);
    return child;
  }

  removeChild(child: StubEl): void {
    const at = this.children.indexOf(child);
    if (at >= 0) this.children.splice(at, 1);
    child.parentElement = null;
    notifyObservers(this);
  }

  remove(): void {
    this.parentElement?.removeChild(this);
  }

  addEventListener(type: string, fn: Handler, capture?: boolean): void {
    const key = capture ? `${type}:capture` : type;
    const list = this.listeners.get(key) ?? [];
    list.push(fn);
    this.listeners.set(key, list);
  }

  removeEventListener(type: string, fn: Handler, capture?: boolean): void {
    const key = capture ? `${type}:capture` : type;
    const list = this.listeners.get(key);
    if (!list) return;
    const at = list.indexOf(fn);
    if (at >= 0) list.splice(at, 1);
    if (list.length === 0) this.listeners.delete(key);
  }

  /** 只认 `.类名` 选择器，够本目录的用例用了 */
  querySelector(sel: string): StubEl | null {
    return findOne(this, sel.replace(/^\./, ""), false);
  }

  closest(sel: string): StubEl | null {
    const want = sel.replace(/^\./, "");
    let cur: StubEl | null = this;
    while (cur) {
      if (cur.classList.contains(want)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  /** 还挂着几个监听 */
  get listenerCount(): number {
    let n = 0;
    for (const list of this.listeners.values()) n += list.length;
    return n;
  }
}

export class StubDoc {
  createElement(tag: string): StubEl {
    return new StubEl(tag, this);
  }
}

let shared: StubDoc | null = null;
function sharedDoc(): StubDoc {
  shared ??= new StubDoc();
  return shared;
}

/** 整棵树上带这个类名的元素（文档序） */
export function findAll(root: StubEl, cls: string, includeSelf = true): StubEl[] {
  const out: StubEl[] = [];
  const walk = (el: StubEl, self: boolean): void => {
    if (self && el.classList.contains(cls)) out.push(el);
    for (const kid of el.children) walk(kid, true);
  };
  walk(root, includeSelf);
  return out;
}

export function findOne(root: StubEl, cls: string, includeSelf = true): StubEl | null {
  return findAll(root, cls, includeSelf)[0] ?? null;
}

/** 捕获阶段派发一次点击（运行器的监听就挂在容器的捕获阶段） */
export function clickOn(root: StubEl, target: StubEl): void {
  for (const fn of [...(root.listeners.get("click:capture") ?? [])]) fn({ type: "click", target });
}

/** 这棵树上一共还挂着多少个监听（destroy 之后必须归零） */
export function totalListeners(root: StubEl): number {
  let n = root.listenerCount;
  for (const kid of root.children) n += totalListeners(kid);
  return n;
}

// ---------------------------------------------------------------------------
// MutationObserver 替身
// ---------------------------------------------------------------------------

interface Watch {
  target: StubEl;
  fire: () => void;
}

const watches: Watch[] = [];

function notifyObservers(target: StubEl): void {
  for (const w of watches) {
    if (w.target === target) w.fire();
  }
}

/** 装一个会跟着 appendChild / remove 触发的 MutationObserver 替身 */
export function installMutationObserver(): () => void {
  const g = globalThis as Record<string, unknown>;
  const had = "MutationObserver" in g;
  const before = g.MutationObserver;
  class FakeObserver {
    private mine: Watch[] = [];
    constructor(private readonly cb: () => void) {}
    observe(target: StubEl): void {
      const w = { target, fire: () => this.cb() };
      this.mine.push(w);
      watches.push(w);
    }
    disconnect(): void {
      for (const w of this.mine) {
        const at = watches.indexOf(w);
        if (at >= 0) watches.splice(at, 1);
      }
      this.mine = [];
    }
  }
  g.MutationObserver = FakeObserver;
  return () => {
    watches.length = 0;
    if (had) g.MutationObserver = before;
    else delete g.MutationObserver;
  };
}

/** 还有几个 MutationObserver 没断开（destroy 归零的用例靠它） */
export function liveObservers(): number {
  return watches.length;
}

// ---------------------------------------------------------------------------
// 全局与朗读
// ---------------------------------------------------------------------------

/** 把 `Element` / `HTMLElement` 指到桩上，让运行器里的 instanceof 判断成立 */
export function installDom(): () => void {
  const g = globalThis as Record<string, unknown>;
  const hadEl = "Element" in g;
  const hadHtml = "HTMLElement" in g;
  const before = { Element: g.Element, HTMLElement: g.HTMLElement };
  g.Element = StubEl;
  g.HTMLElement = StubEl;
  return () => {
    if (hadEl) g.Element = before.Element;
    else delete g.Element;
    if (hadHtml) g.HTMLElement = before.HTMLElement;
    else delete g.HTMLElement;
  };
}

export interface SpeechProbe {
  spoken: string[];
  restore: () => void;
}

/** 装一套中文语音；`langs` 里没有 zh 就相当于「没有中文语音包」 */
export function installSpeech(langs: string[] = ["zh-CN"]): SpeechProbe {
  const g = globalThis as Record<string, unknown>;
  const hadSynth = "speechSynthesis" in g;
  const hadUtter = "SpeechSynthesisUtterance" in g;
  const beforeSynth = g.speechSynthesis;
  const beforeUtter = g.SpeechSynthesisUtterance;
  const probe: SpeechProbe = {
    spoken: [],
    restore() {
      if (hadSynth) g.speechSynthesis = beforeSynth;
      else delete g.speechSynthesis;
      if (hadUtter) g.SpeechSynthesisUtterance = beforeUtter;
      else delete g.SpeechSynthesisUtterance;
    },
  };
  g.SpeechSynthesisUtterance = class {
    lang = "";
    rate = 1;
    voice: unknown = null;
    constructor(public text: string) {}
  };
  g.speechSynthesis = {
    getVoices: () => langs.map((lang) => ({ lang })),
    speak: (u: { text: string }) => {
      probe.spoken.push(u.text);
    },
    cancel: () => {},
  };
  return probe;
}

/** 明确「这台机器没有语音」，用来验降级 */
export function removeSpeech(): () => void {
  const g = globalThis as Record<string, unknown>;
  const had = "speechSynthesis" in g;
  const before = g.speechSynthesis;
  delete g.speechSynthesis;
  return () => {
    if (had) g.speechSynthesis = before;
  };
}
