/**
 * 带 `<canvas>` 的游戏用的 DOM 替身 —— 窗口 1 第 2 轮补的测试基建。
 *
 * 仓库的单测跑在 node 环境里(`vite.config.ts` 的 `test.environment: "node"`),
 * 又不许往 `package.json` 里加 jsdom,所以画布类游戏一直没有 `index.test.ts`:
 * `orb-arena` / `snake-royale` / `block-drop` 三款的 `createRun` 一上来就
 * `document.createElement("canvas")` 再 `getContext("2d")`,没有替身就跑不起来。
 *
 * 与 `merge-2048/index.test.ts` 里那份手写替身相比,这里多了两件事:
 *  1. `innerHTML` 真的解析成子节点 —— 上面三款都靠模板字符串搭 HUD,
 *     再用 `querySelector(".xx-msg")` 把节点捞回来,只清空是不够的;
 *  2. `<canvas>` 给一份会记账的 2D 上下文,好断言「这一帧真的画了东西」。
 *
 * 约定同 `campaignSim.ts`:文件名不带 `.test.ts`,vitest 不会收集它,
 * 也不 import vitest,任何测试框架都能用。
 */

export type Handler = (e: unknown) => void;

/** 2D 上下文替身记下的一笔绘制 */
export interface DrawOp {
  op: string;
  args: number[];
}

export class FakeCtx2D {
  ops: DrawOp[] = [];
  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  font = "";
  textAlign = "";
  textBaseline = "";
  globalAlpha = 1;

  private note(op: string, args: number[] = []): void {
    this.ops.push({ op, args });
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    this.note("clearRect", [x, y, w, h]);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.note("fillRect", [x, y, w, h]);
  }
  strokeRect(x: number, y: number, w: number, h: number): void {
    this.note("strokeRect", [x, y, w, h]);
  }
  beginPath(): void {
    this.note("beginPath");
  }
  closePath(): void {
    this.note("closePath");
  }
  moveTo(x: number, y: number): void {
    this.note("moveTo", [x, y]);
  }
  lineTo(x: number, y: number): void {
    this.note("lineTo", [x, y]);
  }
  arc(x: number, y: number, r: number, a: number, b: number): void {
    this.note("arc", [x, y, r, a, b]);
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.note("rect", [x, y, w, h]);
  }
  fill(): void {
    this.note("fill");
  }
  stroke(): void {
    this.note("stroke");
  }
  fillText(text: string, x: number, y: number): void {
    this.ops.push({ op: `fillText:${text}`, args: [x, y] });
  }
  save(): void {
    this.note("save");
  }
  restore(): void {
    this.note("restore");
  }
  translate(x: number, y: number): void {
    this.note("translate", [x, y]);
  }
  rotate(a: number): void {
    this.note("rotate", [a]);
  }
  scale(x: number, y: number): void {
    this.note("scale", [x, y]);
  }
  setTransform(): void {
    this.note("setTransform");
  }
  createLinearGradient(): { addColorStop: () => void } {
    this.note("createLinearGradient");
    return { addColorStop: () => undefined };
  }
  createRadialGradient(): { addColorStop: () => void } {
    this.note("createRadialGradient");
    return { addColorStop: () => undefined };
  }

  /** 有没有真的画过东西(只算落笔,不算样式赋值) */
  get painted(): number {
    return this.ops.filter((o) => o.op === "fill" || o.op === "stroke" || o.op.startsWith("fillText")).length;
  }
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export class FakeEl {
  tag: string;
  className = "";
  type = "";
  value = "";
  min = "";
  max = "";
  title = "";
  hidden = false;
  disabled = false;
  offsetWidth = 0;
  offsetHeight = 0;
  scrollWidth = 0;
  clientWidth = 0;
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  style: Record<string, string> & { setProperty: (k: string, v: string) => void };
  attrs: Record<string, string> = {};
  listeners = new Map<string, Set<Handler>>();
  rect: Rect = { left: 0, top: 0, width: 320, height: 320, right: 320, bottom: 320 };
  private text = "";

  constructor(tag: string) {
    this.tag = tag;
    const props: Record<string, string> = {};
    this.style = Object.assign(props, {
      setProperty: (k: string, v: string) => {
        props[k] = v;
      }
    }) as Record<string, string> & { setProperty: (k: string, v: string) => void };
  }

  get textContent(): string {
    if (this.children.length === 0) return this.text;
    return this.text + this.children.map((c) => c.textContent).join("");
  }

  set textContent(v: string) {
    this.text = v;
    this.children = [];
  }

  get innerHTML(): string {
    return this.text;
  }

  set innerHTML(v: string) {
    this.children = [];
    this.text = "";
    parseInto(this, v);
  }

  get firstChild(): FakeEl | null {
    return this.children[0] ?? null;
  }

  get lastChild(): FakeEl | null {
    return this.children[this.children.length - 1] ?? null;
  }

  get classList(): {
    add: (...c: string[]) => void;
    remove: (...c: string[]) => void;
    toggle: (c: string, on?: boolean) => void;
    contains: (c: string) => boolean;
  } {
    const has = (c: string): boolean => this.className.split(" ").includes(c);
    const add = (...cs: string[]): void => {
      for (const c of cs) if (c && !has(c)) this.className = `${this.className} ${c}`.trim();
    };
    const remove = (...cs: string[]): void => {
      this.className = this.className
        .split(" ")
        .filter((x) => x && !cs.includes(x))
        .join(" ");
    };
    return {
      add,
      remove,
      toggle: (c: string, on?: boolean) => {
        const want = on ?? !has(c);
        if (want) add(c);
        else remove(c);
      },
      contains: has
    };
  }

  appendChild(child: FakeEl): FakeEl {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...kids: (FakeEl | string)[]): void {
    for (const k of kids) {
      if (typeof k === "string") this.text += k;
      else this.appendChild(k);
    }
  }

  prepend(...kids: FakeEl[]): void {
    for (let i = kids.length - 1; i >= 0; i--) {
      const k = kids[i];
      k.parent?.removeChild(k);
      k.parent = this;
      this.children.unshift(k);
    }
  }

  insertBefore(child: FakeEl, ref: FakeEl | null): FakeEl {
    child.parent?.removeChild(child);
    child.parent = this;
    const at = ref ? this.children.indexOf(ref) : -1;
    if (at < 0) this.children.push(child);
    else this.children.splice(at, 0, child);
    return child;
  }

  removeChild(child: FakeEl): void {
    this.children = this.children.filter((c) => c !== child);
    child.parent = null;
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  setAttribute(k: string, v: string): void {
    this.attrs[k] = v;
    if (k === "class") this.className = v;
  }

  getAttribute(k: string): string | null {
    return this.attrs[k] ?? null;
  }

  removeAttribute(k: string): void {
    delete this.attrs[k];
  }

  hasAttribute(k: string): boolean {
    return k in this.attrs;
  }

  getBoundingClientRect(): Rect {
    return this.rect;
  }

  scrollIntoView(): void {
    /* 单测里没有滚动条 */
  }

  focus(): void {
    /* 单测里没有焦点环 */
  }

  blur(): void {
    /* 同上 */
  }

  addEventListener(name: string, fn: Handler): void {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)?.add(fn);
  }

  removeEventListener(name: string, fn: Handler): void {
    this.listeners.get(name)?.delete(fn);
  }

  /** 直接触发这个节点上挂的监听(替身不做冒泡) */
  fire(name: string, e: Record<string, unknown> = {}): void {
    const ev = { preventDefault: () => undefined, stopPropagation: () => undefined, target: this, ...e };
    for (const fn of [...(this.listeners.get(name) ?? [])]) fn(ev);
  }

  /** 这个节点(含自己)上一共挂了多少个某类监听 */
  listenerCount(name: string): number {
    return this.all()
      .concat([this])
      .reduce((n, el) => n + (el.listeners.get(name)?.size ?? 0), 0);
  }

  querySelector(sel: string): FakeEl | null {
    return this.queryAll(sel)[0] ?? null;
  }

  querySelectorAll(sel: string): FakeEl[] {
    return this.queryAll(sel);
  }

  /** 只认 `.class` / `tag` / `tag.class` 三种最朴素的选择器 */
  private queryAll(sel: string): FakeEl[] {
    const one = sel.split(",")[0].trim();
    const m = /^([a-zA-Z][\w-]*)?(?:\.([\w-]+))?$/.exec(one);
    if (!m) return [];
    const [, tag, cls] = m;
    return this.all().filter(
      (el) =>
        (!tag || el.tag.toLowerCase() === tag.toLowerCase()) &&
        (!cls || el.className.split(" ").includes(cls))
    );
  }

  /** 后代节点(不含自己),按文档序 */
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
}

export class FakeCanvas extends FakeEl {
  width = 300;
  height = 150;
  ctx = new FakeCtx2D();

  constructor() {
    super("canvas");
    this.rect = { left: 0, top: 0, width: 320, height: 180, right: 320, bottom: 180 };
  }

  getContext(kind: string): FakeCtx2D | null {
    return kind === "2d" ? this.ctx : null;
  }
}

// ---------------------------------------------------------------------------
// 最朴素的 innerHTML 解析:够这几款的模板字符串用就行
// ---------------------------------------------------------------------------

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);

function parseInto(host: FakeEl, html: string): void {
  const stack: FakeEl[] = [host];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      appendText(stack[stack.length - 1], html.slice(i));
      break;
    }
    if (lt > i) appendText(stack[stack.length - 1], html.slice(i, lt));
    const gt = html.indexOf(">", lt);
    if (gt < 0) {
      appendText(stack[stack.length - 1], html.slice(lt));
      break;
    }
    const raw = html.slice(lt + 1, gt).trim();
    if (raw.startsWith("/")) {
      const name = raw.slice(1).trim().toLowerCase();
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tag.toLowerCase() === name) {
          stack.length = k;
          break;
        }
      }
      i = gt + 1;
      continue;
    }
    const selfClose = raw.endsWith("/");
    const body = selfClose ? raw.slice(0, -1) : raw;
    const nameEnd = body.search(/[\s]/);
    const tag = (nameEnd < 0 ? body : body.slice(0, nameEnd)).toLowerCase();
    const el = tag === "canvas" ? new FakeCanvas() : new FakeEl(tag);
    if (nameEnd >= 0) applyAttrs(el, body.slice(nameEnd));
    stack[stack.length - 1].appendChild(el);
    if (selfClose || VOID_TAGS.has(tag)) {
      i = gt + 1;
      continue;
    }
    // <style> / <script> 里的内容当纯文本收,免得 CSS 里的字符把解析带歪
    if (tag === "style" || tag === "script") {
      const close = html.toLowerCase().indexOf(`</${tag}>`, gt + 1);
      const end = close < 0 ? html.length : close;
      appendText(el, html.slice(gt + 1, end));
      i = close < 0 ? html.length : close + tag.length + 3;
      continue;
    }
    stack.push(el);
    i = gt + 1;
  }
}

function appendText(el: FakeEl, chunk: string): void {
  if (chunk.trim() === "") return;
  const holder = el as unknown as { textContent: string };
  holder.textContent = el.textContent + chunk;
}

function applyAttrs(el: FakeEl, chunk: string): void {
  const re = /([\w:-]+)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)')?/g;
  let m = re.exec(chunk);
  while (m) {
    const key = m[1];
    const val = m[2] ?? m[3] ?? "";
    el.setAttribute(key, val);
    if (key === "class") el.className = val;
    if (key === "type") el.type = val;
    if (key === "width") (el as FakeCanvas).width = Number(val) || 0;
    if (key === "height") (el as FakeCanvas).height = Number(val) || 0;
    m = re.exec(chunk);
  }
}

// ---------------------------------------------------------------------------
// 装 / 卸全局替身
// ---------------------------------------------------------------------------

export interface DomHarness {
  /** 全局(window)上挂着的监听,按事件名分桶 */
  globalListeners: Map<string, Set<Handler>>;
  /** 排队中的 rAF 回调 */
  frames: Map<number, (ts: number) => void>;
  /** 推进 n 帧,每帧 ms 毫秒 */
  tick: (n?: number, ms?: number) => void;
  /** 往 window 上派一个 keydown,返回这一下有没有被 preventDefault */
  pressKey: (key: string, extra?: Record<string, unknown>) => boolean;
  releaseKey: (key: string, extra?: Record<string, unknown>) => void;
  /** window 上某类监听的条数 */
  globalListenerCount: (name?: string) => number;
  /** 这一次挂载里 localStorage 收到的东西 */
  storage: Map<string, string>;
  restore: () => void;
}

export function installCanvasDom(opts: { innerWidth?: number } = {}): DomHarness {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved: Record<string, unknown> = {};
  const keep = [
    "document",
    "window",
    "HTMLElement",
    "HTMLCanvasElement",
    "addEventListener",
    "removeEventListener",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "innerWidth",
    "innerHeight",
    "localStorage"
  ];
  for (const k of keep) saved[k] = g[k];

  const globalListeners = new Map<string, Set<Handler>>();
  const frames = new Map<number, (ts: number) => void>();
  let frameId = 0;
  let clock = 0;
  const storage = new Map<string, string>();

  const add = (name: string, fn: Handler): void => {
    if (!globalListeners.has(name)) globalListeners.set(name, new Set());
    globalListeners.get(name)?.add(fn);
  };
  const off = (name: string, fn: Handler): void => {
    globalListeners.get(name)?.delete(fn);
  };

  const documentEl = new FakeEl("html");
  const bodyEl = new FakeEl("body");
  documentEl.appendChild(bodyEl);

  g.document = {
    createElement: (tag: string) => (tag === "canvas" ? new FakeCanvas() : new FakeEl(tag)),
    createTextNode: (t: string) => {
      const el = new FakeEl("#text");
      el.textContent = t;
      return el;
    },
    documentElement: documentEl,
    body: bodyEl,
    addEventListener: add,
    removeEventListener: off,
    querySelector: (sel: string) => documentEl.querySelector(sel),
    querySelectorAll: (sel: string) => documentEl.querySelectorAll(sel)
  };
  g.HTMLElement = FakeEl;
  g.HTMLCanvasElement = FakeCanvas;
  g.addEventListener = add;
  g.removeEventListener = off;
  g.innerWidth = opts.innerWidth ?? 360;
  g.innerHeight = 640;
  g.localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storage.set(k, String(v));
    },
    removeItem: (k: string) => {
      storage.delete(k);
    },
    clear: () => storage.clear(),
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() {
      return storage.size;
    }
  };
  g.window = {
    addEventListener: add,
    removeEventListener: off,
    innerWidth: opts.innerWidth ?? 360,
    innerHeight: 640,
    document: g.document,
    localStorage: g.localStorage,
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
    clearTimeout: (id: number) => clearTimeout(id as unknown as NodeJS.Timeout),
    requestAnimationFrame: (fn: (ts: number) => void) => {
      frameId += 1;
      frames.set(frameId, fn);
      return frameId;
    },
    cancelAnimationFrame: (id: number) => {
      frames.delete(id);
    }
  };
  g.requestAnimationFrame = (fn: (ts: number) => void): number => {
    frameId += 1;
    frames.set(frameId, fn);
    return frameId;
  };
  g.cancelAnimationFrame = (id: number): void => {
    frames.delete(id);
  };

  const fireGlobal = (name: string, e: Record<string, unknown>): boolean => {
    let prevented = false;
    const ev = {
      preventDefault: () => {
        prevented = true;
      },
      stopPropagation: () => undefined,
      ...e
    };
    for (const fn of [...(globalListeners.get(name) ?? [])]) fn(ev);
    return prevented;
  };

  return {
    globalListeners,
    frames,
    storage,
    tick(n = 1, ms = 20) {
      for (let i = 0; i < n; i++) {
        clock += ms;
        const batch = [...frames.entries()];
        frames.clear();
        for (const [, fn] of batch) fn(clock);
      }
    },
    pressKey(key, extra = {}) {
      return fireGlobal("keydown", { key, repeat: false, ...extra });
    },
    releaseKey(key, extra = {}) {
      fireGlobal("keyup", { key, ...extra });
    },
    globalListenerCount(name) {
      if (name) return globalListeners.get(name)?.size ?? 0;
      let n = 0;
      for (const set of globalListeners.values()) n += set.size;
      return n;
    },
    restore() {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete g[k];
        else g[k] = v;
      }
    }
  };
}
