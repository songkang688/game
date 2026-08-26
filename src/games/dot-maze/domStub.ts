/**
 * 豆豆迷宫 · 单测用的极简 DOM 桩（只给 `*.test.ts` 用，不参与打包）。
 *
 * 仓库的测试环境是 node、没有 jsdom，也不为一款游戏引新依赖，所以这里手写一份最小实现。
 * 和别处的桩相比多了一件事：`innerHTML` 会真的解析成子节点。
 * 豆豆迷宫的 HUD、画布和虚拟方向键都是一整段 innerHTML 塞进去、再 querySelector 捞出来的，
 * 不解析就没法验「destroy 之后监听、rAF、DOM 全都收干净了」这条。
 */

export type Handler = (ev: unknown) => void;

/** 支持 `tag`、`.cls`、`.cls[attr]`、`.a.b` 这几种选择器，够框架用了 */
interface Selector {
  tag: string | null;
  classes: string[];
  attrs: string[];
}

function parseSelector(sel: string): Selector {
  const out: Selector = { tag: null, classes: [], attrs: [] };
  const re = /\.([A-Za-z0-9_-]+)|\[([A-Za-z0-9_-]+)\]|^([A-Za-z][A-Za-z0-9]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sel)) !== null) {
    if (m[1]) out.classes.push(m[1]);
    else if (m[2]) out.attrs.push(m[2]);
    else if (m[3]) out.tag = m[3].toLowerCase();
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
  tabIndex = 0;
  width = 0;
  height = 0;
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attrs: Record<string, string> = {};
  children: El[] = [];
  parent: El | null = null;
  listeners = new Map<string, Set<Handler>>();
  /** 只有叶子节点上的文字 */
  private ownText = "";

  constructor(tag: string) {
    this.tagName = tag.toLowerCase();
  }

  get textContent(): string {
    if (this.children.length === 0) return this.ownText;
    return this.ownText + this.children.map((c) => c.textContent).join("");
  }
  set textContent(v: string) {
    this.detachChildren();
    this.ownText = v;
  }

  set innerHTML(v: string) {
    this.detachChildren();
    this.ownText = "";
    if (v !== "") parseHtml(v, this);
  }
  get innerHTML(): string {
    return this.children.map((c) => c.outerHtml()).join("");
  }

  outerHtml(): string {
    const cls = this.className ? ` class="${this.className}"` : "";
    return `<${this.tagName}${cls}>${this.ownText}${this.innerHTML}</${this.tagName}>`;
  }

  private detachChildren(): void {
    for (const c of this.children) c.parent = null;
    this.children = [];
  }

  get childElementCount(): number {
    return this.children.length;
  }

  appendChild(c: El): El {
    c.parent = this;
    this.children.push(c);
    return c;
  }
  append(...cs: El[]): void {
    for (const c of cs) this.appendChild(c);
  }
  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  setAttribute(k: string, v: string): void {
    this.attrs[k] = v;
    if (k.startsWith("data-")) this.dataset[camel(k.slice(5))] = v;
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
  /** 触发一个事件；默认带上 preventDefault，省得每处都写 */
  dispatch(t: string, ev: Record<string, unknown> = {}): void {
    const full = { preventDefault: () => undefined, stopPropagation: () => undefined, ...ev };
    for (const f of Array.from(this.listeners.get(t) ?? [])) f(full);
  }
  getContext(): unknown {
    return ctx2d;
  }
  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: this.width, height: this.height };
  }
  scrollIntoView(): void {
    /* 桩：滚动不用真做 */
  }
  focus(): void {
    /* 桩：焦点不用真做 */
  }

  matches(sel: string): boolean {
    const s = parseSelector(sel);
    if (s.tag && s.tag !== this.tagName) return false;
    const own = this.className.split(/\s+/).filter(Boolean);
    for (const c of s.classes) if (!own.includes(c)) return false;
    for (const a of s.attrs) if (this.attrs[a] === undefined) return false;
    return true;
  }
  querySelector(sel: string): El | null {
    for (const c of this.children) {
      if (c.matches(sel)) return c;
      const hit = c.querySelector(sel);
      if (hit) return hit;
    }
    return null;
  }
  querySelectorAll(sel: string): El[] {
    const out: El[] = [];
    for (const c of this.children) {
      if (c.matches(sel)) out.push(c);
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

function camel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * 够用就好的 HTML 解析：标签 + 属性 + 文本。
 * `<style>` 的内容整段当文本收下，免得 CSS 里的括号被当成标签。
 */
function parseHtml(html: string, root: El): void {
  const stack: El[] = [root];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      addText(stack[stack.length - 1], html.slice(i));
      break;
    }
    addText(stack[stack.length - 1], html.slice(i, lt));
    const gt = html.indexOf(">", lt);
    if (gt < 0) break;
    const raw = html.slice(lt + 1, gt).trim();
    if (raw.startsWith("/")) {
      if (stack.length > 1) stack.pop();
      i = gt + 1;
      continue;
    }
    const selfClosing = raw.endsWith("/");
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const name = /^[A-Za-z][A-Za-z0-9]*/.exec(body)?.[0] ?? "div";
    const el = new El(name);
    for (const [, k, v] of body.slice(name.length).matchAll(/([A-Za-z-]+)\s*=\s*"([^"]*)"/g)) {
      if (k === "class") el.className = v;
      else if (k === "id") el.id = v;
      else el.setAttribute(k, v);
    }
    stack[stack.length - 1].appendChild(el);
    if (selfClosing) {
      i = gt + 1;
      continue;
    }
    if (el.tagName === "style") {
      // CSS 里有大括号和引号，整段原样收进来，不要再当标签解析
      const close = html.indexOf("</style>", gt);
      const end = close < 0 ? html.length : close;
      addText(el, html.slice(gt + 1, end));
      i = close < 0 ? html.length : close + "</style>".length;
      continue;
    }
    stack.push(el);
    i = gt + 1;
  }
}

function addText(el: El, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  el.appendChild(new El("#text")).textContent = trimmed;
}

/** canvas 2d 上下文：方法都是空操作，属性都写得进去 */
export const ctx2d: unknown = new Proxy(
  {},
  {
    get: () => () => ctx2d,
    set: () => true,
  }
);

export interface Dom {
  root: El;
  head: El;
  winListeners: Map<string, Set<Handler>>;
  frames: Array<(t: number) => void>;
  /** cancelAnimationFrame 被调过几次 */
  cancelled: number[];
  clock: { ms: number };
  /** 还没被清掉的定时器 */
  timers: Set<number>;
}

const saved: Record<string, unknown> = {};

/**
 * 装上 DOM 桩。`width` 是屏宽（`reduceMotion` 是否开启用 `reduced` 控制）。
 */
export function installDom(width = 800, reduced = false): Dom {
  const head = new El("head");
  const root = new El("div");
  const winListeners = new Map<string, Set<Handler>>();
  const frames: Array<(t: number) => void> = [];
  const cancelled: number[] = [];
  const timers = new Set<number>();
  const clock = { ms: 1000 };
  const byId = new Map<string, El>();

  const origAppend = head.appendChild.bind(head);
  head.appendChild = (c: El): El => {
    if (c.id) byId.set(c.id, c);
    return origAppend(c);
  };

  for (const k of [
    "document",
    "window",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "performance",
    "innerWidth",
    "matchMedia",
  ]) {
    saved[k] = (globalThis as Record<string, unknown>)[k];
  }

  const win = {
    innerWidth: width,
    matchMedia: (q: string) => ({ matches: reduced && q.includes("reduced-motion") }),
    addEventListener: (t: string, f: Handler) => {
      if (!winListeners.has(t)) winListeners.set(t, new Set());
      winListeners.get(t)!.add(f);
    },
    removeEventListener: (t: string, f: Handler) => {
      winListeners.get(t)?.delete(f);
    },
  };

  Object.assign(globalThis as Record<string, unknown>, {
    document: {
      head,
      body: root,
      createElement: (tag: string) => new El(tag),
      getElementById: (id: string) => byId.get(id) ?? null,
    },
    window: win,
    innerWidth: width,
    matchMedia: win.matchMedia,
    performance: { now: () => clock.ms },
    requestAnimationFrame: (cb: (t: number) => void) => {
      frames.push(cb);
      return frames.length;
    },
    cancelAnimationFrame: (h: number) => {
      cancelled.push(h);
    },
  });

  return { root, head, winListeners, frames, cancelled, clock, timers };
}

/** 卸掉 DOM 桩，把全局还回去 */
export function restoreDom(): void {
  const back: Record<string, unknown> = {};
  for (const k of Object.keys(saved)) back[k] = saved[k];
  Object.assign(globalThis as Record<string, unknown>, back);
}

/** window 上还挂着几个监听 */
export function windowListenerCount(dom: Dom): number {
  let n = 0;
  for (const set of dom.winListeners.values()) n += set.size;
  return n;
}

/** 触发一个 window 事件（自带 preventDefault） */
export function fireWindow(dom: Dom, type: string, ev: Record<string, unknown>): void {
  const full = { preventDefault: () => undefined, ...ev };
  for (const f of Array.from(dom.winListeners.get(type) ?? [])) f(full);
}

/** 跑 n 帧，每帧推进 stepMs 毫秒 */
export function flushFrames(dom: Dom, n: number, stepMs = 50): void {
  for (let i = 0; i < n; i++) {
    const cb = dom.frames.shift();
    if (!cb) return;
    dom.clock.ms += stepMs;
    cb(dom.clock.ms);
  }
}
