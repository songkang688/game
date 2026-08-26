/**
 * 极简 DOM 桩（只给本目录的用例用）。
 *
 * 仓库的 vitest 跑在 node 环境、没有 jsdom，也不打算为了几条用例引新依赖，
 * 所以这里手写拼读车厢与错题回顾真正用到的那几样 DOM 能力：
 * 建元素、挂/摘监听、classList、style、appendChild / remove、getBoundingClientRect。
 *
 * 只在测试里 import，玩法代码一行都不碰它。
 */

export interface StubEvent {
  type: string;
  target: StubEl | null;
  clientX: number;
  clientY: number;
  preventDefault: () => void;
}

type Handler = (e: StubEvent) => void;

export class StubEl {
  readonly tagName: string;
  textContent = "";
  type = "";
  disabled = false;
  hidden = false;
  readonly style: Record<string, string> = {};
  readonly children: StubEl[] = [];
  parent: StubEl | null = null;
  readonly attrs = new Map<string, string>();
  readonly listeners = new Map<string, Handler[]>();
  rect = { left: 0, top: 0, width: 0, height: 0 };
  private classes = new Set<string>();

  constructor(tagName: string) {
    this.tagName = tagName;
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
    toggle: (name: string, force?: boolean): boolean => {
      const on = force === undefined ? !this.classes.has(name) : force;
      if (on) this.classes.add(name);
      else this.classes.delete(name);
      return on;
    },
  };

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attrs.has(name) ? (this.attrs.get(name) as string) : null;
  }

  appendChild<T extends StubEl>(child: T): T {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...kids: StubEl[]): void {
    for (const kid of kids) this.appendChild(kid);
  }

  removeChild(child: StubEl): void {
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
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return this.rect;
  }

  /** 触发一个事件（不冒泡：本目录的代码只在元素自己身上挂监听） */
  fire(type: string, extra: Partial<StubEvent> = {}): void {
    const e: StubEvent = {
      type,
      target: this,
      clientX: 0,
      clientY: 0,
      preventDefault: () => {},
      ...extra,
    };
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn(e);
  }

  /** 还挂着几个监听（destroy 归零的用例靠它） */
  get listenerCount(): number {
    let n = 0;
    for (const list of this.listeners.values()) n += list.length;
    return n;
  }
}

export class StubDoc extends StubEl {
  constructor() {
    super("#document");
  }

  createElement(tag: string): StubEl {
    return new StubEl(tag);
  }
}

/** 遍历整棵树找出全部带这个类名的元素（文档序） */
export function findAll(root: StubEl, cls: string): StubEl[] {
  const out: StubEl[] = [];
  const walk = (el: StubEl): void => {
    if (el.classList.contains(cls)) out.push(el);
    for (const kid of el.children) walk(kid);
  };
  walk(root);
  return out;
}

/** 找第一个带这个类名的元素 */
export function findOne(root: StubEl, cls: string): StubEl | null {
  return findAll(root, cls)[0] ?? null;
}

/** 按 aria-label 找元素 */
export function findByLabel(root: StubEl, label: string): StubEl | null {
  const walk = (el: StubEl): StubEl | null => {
    if (el.getAttribute("aria-label") === label) return el;
    for (const kid of el.children) {
      const hit = walk(kid);
      if (hit) return hit;
    }
    return null;
  };
  return walk(root);
}

/** 整棵树上还挂着几个监听 */
export function totalListeners(root: StubEl): number {
  let n = root.listenerCount;
  for (const kid of root.children) n += totalListeners(kid);
  return n;
}

export interface InstalledDom {
  doc: StubDoc;
  restore: () => void;
}

/** 把桩装到 globalThis.document 上，用完记得 restore */
export function installDom(): InstalledDom {
  const g = globalThis as { document?: unknown };
  const had = "document" in g;
  const before = g.document;
  const doc = new StubDoc();
  g.document = doc;
  return {
    doc,
    restore() {
      if (had) g.document = before;
      else delete g.document;
    },
  };
}

// ---------------------------------------------------------------------------
// 朗读桩：装上就是「有中文语音包」，不装就是「没有语音包」
// ---------------------------------------------------------------------------

export interface SpeechProbe {
  spoken: string[];
  cancels: number;
  restore: () => void;
}

export function installSpeech(langs: string[] = ["zh-CN"]): SpeechProbe {
  const g = globalThis as Record<string, unknown>;
  const hadSynth = "speechSynthesis" in g;
  const hadUtter = "SpeechSynthesisUtterance" in g;
  const beforeSynth = g.speechSynthesis;
  const beforeUtter = g.SpeechSynthesisUtterance;
  const probe: SpeechProbe = {
    spoken: [],
    cancels: 0,
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
    cancel: () => {
      probe.cancels++;
    },
  };
  return probe;
}

/** 确保当前环境「没有语音包」（node 下本来就没有，这里只是把话说明白） */
export function removeSpeech(): () => void {
  const g = globalThis as Record<string, unknown>;
  const hadSynth = "speechSynthesis" in g;
  const before = g.speechSynthesis;
  delete g.speechSynthesis;
  return () => {
    if (hadSynth) g.speechSynthesis = before;
  };
}
