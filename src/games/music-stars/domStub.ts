/**
 * 极简 DOM / Web Audio 桩（只给本目录的用例用）。
 *
 * 仓库的 vitest 跑在 node 环境、没有 jsdom，也不打算为了几条用例引新依赖，
 * 所以这里手写星星键盘、节拍条与合成器真正用到的那几样能力：
 * 建元素（含 SVG）、挂监听、classList、style、appendChild / remove、
 * 以及一台假的 `AudioContext`——时钟可以手动往前拨，节点建了几个、断了几个都数得出来。
 *
 * 只在测试里 import，玩法代码一行都不碰它。
 */
import type { AudioLike, FilterLike, GainNodeLike, OscLike, ParamLike } from "./synth";

export interface StubEvent {
  type: string;
  target: StubEl | null;
  pointerId: number;
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

  /** 玩法代码用 innerHTML 铺骨架；桩只解析出 class 与文字，够查得到就行 */
  get innerHTML(): string {
    return this.rawHtml;
  }

  set innerHTML(html: string) {
    this.children.length = 0;
    this.rawHtml = String(html);
    for (const el of parseHtml(this.rawHtml)) {
      el.parent = this;
      this.children.push(el);
    }
  }

  private rawHtml = "";

  get firstChild(): StubEl | null {
    return this.children[0] ?? null;
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
    if (name === "class") this.className = String(value);
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

  querySelector(sel: string): StubEl | null {
    return findOne(this, sel.replace(/^\./, ""));
  }

  querySelectorAll(sel: string): StubEl[] {
    const cls = sel.split(".").pop() ?? sel;
    return findAll(this, cls);
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

  setPointerCapture(): void {
    // 桩不需要真的捕获
  }

  click(): void {
    this.fire("click");
  }

  /** 触发一个事件（不冒泡：本目录的代码只在元素自己身上挂监听） */
  fire(type: string, extra: Partial<StubEvent> = {}): void {
    if (this.disabled) return;
    const e: StubEvent = {
      type,
      target: this,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      preventDefault: () => {},
      ...extra,
    };
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn(e);
  }

  get listenerCount(): number {
    let n = 0;
    for (const list of this.listeners.values()) n += list.length;
    return n;
  }
}

/** 从一段 innerHTML 里粗略认出顶层元素的 class（够本目录的用例查） */
function parseHtml(html: string): StubEl[] {
  const out: StubEl[] = [];
  const re = /<(\w+)([^>]*)>/g;
  let hit: RegExpExecArray | null;
  while ((hit = re.exec(html))) {
    const el = new StubEl(hit[1]);
    const cls = /class="([^"]*)"/.exec(hit[2]);
    if (cls) el.className = cls[1];
    if (/\bhidden\b/.test(hit[2])) el.hidden = true;
    out.push(el);
  }
  return out;
}

export class StubDoc extends StubEl {
  constructor() {
    super("#document");
  }

  createElement(tag: string): StubEl {
    return new StubEl(tag);
  }

  createElementNS(_ns: string, tag: string): StubEl {
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
  const g = globalThis as { document?: unknown; requestAnimationFrame?: unknown; cancelAnimationFrame?: unknown };
  const had = "document" in g;
  const before = g.document;
  const hadRaf = "requestAnimationFrame" in g;
  const beforeRaf = g.requestAnimationFrame;
  const beforeCancel = g.cancelAnimationFrame;
  const doc = new StubDoc();
  g.document = doc;
  // 节拍条会申请动画帧；桩里给一个不真的排队的版本，免得用例跑不完
  g.requestAnimationFrame = (): number => 0;
  g.cancelAnimationFrame = (): void => {};
  return {
    doc,
    restore() {
      if (had) g.document = before;
      else delete g.document;
      if (hadRaf) {
        g.requestAnimationFrame = beforeRaf;
        g.cancelAnimationFrame = beforeCancel;
      } else {
        delete g.requestAnimationFrame;
        delete g.cancelAnimationFrame;
      }
    },
  };
}

/** 内存版存档：沙盒与音量设置的用例用它，绝不碰真的 localStorage */
export function memoryStorage(seed: Record<string, string> = {}): {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

// ---------------------------------------------------------------------------
// 假 AudioContext：时钟手动拨，节点建了几个断了几个都数得出来
// ---------------------------------------------------------------------------

class StubParam implements ParamLike {
  value = 0;
  readonly events: Array<{ kind: string; value: number; at: number }> = [];

  setValueAtTime(value: number, at: number): this {
    this.events.push({ kind: "set", value, at });
    this.value = value;
    return this;
  }

  linearRampToValueAtTime(value: number, at: number): this {
    this.events.push({ kind: "linear", value, at });
    return this;
  }

  exponentialRampToValueAtTime(value: number, at: number): this {
    this.events.push({ kind: "exp", value, at });
    return this;
  }

  cancelScheduledValues(at: number): this {
    this.events.push({ kind: "cancel", value: 0, at });
    return this;
  }

  /** 这条包络上出现过的最大目标值——音量上限断言靠它 */
  get peak(): number {
    return this.events.reduce((m, e) => Math.max(m, e.value), this.value);
  }
}

export class StubNode {
  connected: unknown = null;
  disconnected = false;
  readonly ctx: StubAudioContext;

  constructor(ctx: StubAudioContext) {
    this.ctx = ctx;
    ctx.nodes.push(this as unknown as StubNode);
  }

  connect(dest: unknown): unknown {
    this.connected = dest;
    return dest;
  }

  disconnect(): void {
    this.disconnected = true;
  }
}

export class StubGain extends StubNode implements GainNodeLike {
  readonly gain = new StubParam();
}

export class StubOsc extends StubNode implements OscLike {
  type = "sine";
  readonly frequency = new StubParam();
  readonly detune = new StubParam();
  started = -1;
  stopped = -1;
  onended: (() => void) | null = null;

  start(at: number): void {
    this.started = at;
  }

  stop(at: number): void {
    this.stopped = at;
  }
}

export class StubFilter extends StubNode implements FilterLike {
  type = "lowpass";
  readonly frequency = new StubParam();
}

export class StubAudioContext implements AudioLike {
  currentTime = 0;
  state = "suspended";
  readonly destination = { id: "destination" };
  outputLatency?: number;
  baseLatency?: number;
  readonly nodes: StubNode[] = [];
  resumed = 0;
  suspended = 0;
  closed = 0;

  constructor(latency?: { outputLatency?: number; baseLatency?: number }) {
    if (latency?.outputLatency !== undefined) this.outputLatency = latency.outputLatency;
    if (latency?.baseLatency !== undefined) this.baseLatency = latency.baseLatency;
  }

  createOscillator(): StubOsc {
    return new StubOsc(this);
  }

  createGain(): StubGain {
    return new StubGain(this);
  }

  createBiquadFilter(): StubFilter {
    return new StubFilter(this);
  }

  resume(): Promise<void> {
    this.resumed++;
    this.state = "running";
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    this.suspended++;
    this.state = "suspended";
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.closed++;
    this.state = "closed";
    return Promise.resolve();
  }

  /** 把时钟往前拨几秒 */
  tick(seconds: number): void {
    this.currentTime += seconds;
  }

  /** 全部增益节点上出现过的最大目标值 */
  get peakGain(): number {
    let peak = 0;
    for (const n of this.nodes) {
      if (n instanceof StubGain) peak = Math.max(peak, n.gain.peak);
    }
    return peak;
  }

  /** 还没断开的节点数 */
  get liveNodes(): number {
    return this.nodes.filter((n) => !n.disconnected).length;
  }
}
