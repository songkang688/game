/**
 * 只给 `*.test.ts` 用的小工具:摆盘面、造 DOM 替身。
 * 玩法代码一个字都不会 import 它,所以不会进打包产物。
 */
import { parseRows, pointOf, type Board } from "./board";

/** 把几行短写补成 9 行 9 列的文本盘面 */
export function rows9(...rows: string[]): string[] {
  const out = rows.map((r) => (r + ".........").slice(0, 9));
  while (out.length < 9) out.push(".........");
  return out.slice(0, 9);
}

/** 直接摆一个 9 路盘面 */
export function board9(...rows: string[]): Board {
  return parseRows(rows9(...rows));
}

/** 9 路坐标 */
export function P9(x: number, y: number): number {
  return pointOf(9, x, y);
}

/**
 * 一份够用的 DOM 替身:仓库的单测跑在 node 环境里,不引 jsdom 也要能验 destroy。
 * canvas 的 getContext 一律返回 null,画图那一段会自己跳过。
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
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  listeners = new Map<string, Set<FakeHandler>>();
  clientWidth = 360;
  private text = "";

  constructor(tag: string) {
    this.tag = tag;
  }

  get textContent(): string {
    return this.text;
  }

  set textContent(v: string) {
    this.text = v;
    this.children = [];
  }

  set innerHTML(v: string) {
    this.children = [];
    this.text = v === "" ? "" : this.text;
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

  getContext(_kind?: string): FakeCtx2D | null {
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

  addEventListener(name: string, fn: FakeHandler): void {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)?.add(fn);
  }

  removeEventListener(name: string, fn: FakeHandler): void {
    this.listeners.get(name)?.delete(fn);
  }

  fire(name: string, ev: unknown = {}): void {
    for (const fn of [...(this.listeners.get(name) ?? [])]) fn(ev);
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

  text0(): string {
    return this.textContent;
  }
}

// ---------------------------------------------------------------------------
// 1.3 视觉契约用的记账画布:每一笔绘制调用都记进 ops,好断言
// 「这一帧真的画了木纹渐变 / sprite」。装了 { canvas: true } 的 installDom
// 才会把 <canvas> 换成这个替身,老测试的行为一个字都不变。
// ---------------------------------------------------------------------------

export interface CtxOp {
  op: string;
  args: unknown[];
}

/** 会记账的 2D 上下文替身:实现 art.ts 需要的全部方法 + 渐变 */
export class FakeCtx2D {
  ops: CtxOp[] = [];
  lineWidth = 1;
  lineCap = "";
  lineJoin = "";
  font = "";
  private alpha = 1;
  private fillS: unknown = "";
  private strokeS: unknown = "";
  private stack: Array<{ a: number; f: unknown; s: unknown; w: number }> = [];

  private note(op: string, ...args: unknown[]): void {
    this.ops.push({ op, args });
  }

  get globalAlpha(): number {
    return this.alpha;
  }

  set globalAlpha(v: number) {
    this.alpha = v;
    this.note("globalAlpha", v);
  }

  get fillStyle(): unknown {
    return this.fillS;
  }

  set fillStyle(v: unknown) {
    this.fillS = v;
    this.note("fillStyle", typeof v === "string" ? v : "[gradient]");
  }

  get strokeStyle(): unknown {
    return this.strokeS;
  }

  set strokeStyle(v: unknown) {
    this.strokeS = v;
    this.note("strokeStyle", typeof v === "string" ? v : "[gradient]");
  }

  setTransform(...args: number[]): void {
    this.note("setTransform", ...args);
  }
  clearRect(x: number, y: number, w: number, h: number): void {
    this.note("clearRect", x, y, w, h);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.note("fillRect", x, y, w, h);
  }
  strokeRect(x: number, y: number, w: number, h: number): void {
    this.note("strokeRect", x, y, w, h);
  }
  beginPath(): void {
    this.note("beginPath");
  }
  closePath(): void {
    this.note("closePath");
  }
  moveTo(x: number, y: number): void {
    this.note("moveTo", x, y);
  }
  lineTo(x: number, y: number): void {
    this.note("lineTo", x, y);
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    this.note("quadraticCurveTo", cx, cy, x, y);
  }
  bezierCurveTo(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.note("bezierCurveTo", a, b, c, d, e, f);
  }
  arc(x: number, y: number, r: number, a: number, b: number): void {
    this.note("arc", x, y, r, a, b);
  }
  fill(): void {
    this.note("fill");
  }
  stroke(): void {
    this.note("stroke");
  }
  save(): void {
    this.stack.push({ a: this.alpha, f: this.fillS, s: this.strokeS, w: this.lineWidth });
    this.note("save");
  }
  restore(): void {
    const top = this.stack.pop();
    if (top) {
      this.alpha = top.a;
      this.fillS = top.f;
      this.strokeS = top.s;
      this.lineWidth = top.w;
    }
    this.note("restore");
  }
  translate(x: number, y: number): void {
    this.note("translate", x, y);
  }
  rotate(a: number): void {
    this.note("rotate", a);
  }
  scale(x: number, y: number): void {
    this.note("scale", x, y);
  }
  drawImage(...args: unknown[]): void {
    this.note("drawImage", ...args.slice(1));
  }
  createLinearGradient(...args: number[]): { addColorStop: (o: number, c: string) => void } {
    this.note("createLinearGradient", ...args);
    return { addColorStop: (o: number, c: string) => this.note("addColorStop", o, c) };
  }
  createRadialGradient(...args: number[]): { addColorStop: (o: number, c: string) => void } {
    this.note("createRadialGradient", ...args);
    return { addColorStop: (o: number, c: string) => this.note("addColorStop", o, c) };
  }
  fillText(text: string, x: number, y: number): void {
    this.note(`fillText:${text}`, x, y);
  }

  /** 某类调用出现了几次 */
  count(op: string): number {
    return this.ops.filter((o) => o.op === op).length;
  }

  /** 真的落笔了几次(fill / stroke / drawImage) */
  get painted(): number {
    return this.ops.filter((o) => o.op === "fill" || o.op === "stroke" || o.op === "drawImage").length;
  }
}

/** 带记账 2D 上下文的 canvas 替身 */
export class FakeCanvasEl extends FakeEl {
  ctx2d = new FakeCtx2D();

  constructor() {
    super("canvas");
  }

  getContext(kind?: string): FakeCtx2D | null {
    return kind === undefined || kind === "2d" ? this.ctx2d : null;
  }
}

export interface DomStub {
  root: FakeEl;
  /** 挂在 globalThis 上的监听器(keydown / resize 等) */
  globals: Map<string, Set<FakeHandler>>;
  press: (key: string) => void;
  globalCount: () => number;
  restore: () => void;
}

/** 装上 DOM 替身,记得在 afterEach 里 restore;{ canvas: true } 时画布会记账 */
export function installDom(opts: { canvas?: boolean } = {}): DomStub {
  const g = globalThis as unknown as Record<string, unknown>;
  const prevDoc = g.document;
  const prevAdd = g.addEventListener;
  const prevRemove = g.removeEventListener;
  const globals = new Map<string, Set<FakeHandler>>();
  g.document = {
    createElement: (tag: string) => (opts.canvas === true && tag === "canvas" ? new FakeCanvasEl() : new FakeEl(tag))
  };
  g.addEventListener = (name: string, fn: FakeHandler) => {
    if (!globals.has(name)) globals.set(name, new Set());
    globals.get(name)?.add(fn);
  };
  g.removeEventListener = (name: string, fn: FakeHandler) => {
    globals.get(name)?.delete(fn);
  };
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
    restore() {
      g.document = prevDoc;
      g.addEventListener = prevAdd;
      g.removeEventListener = prevRemove;
    }
  };
}

/** 同步的定时器替身:攒着,flush 的时候一口气跑完 */
export function makeScheduler(): {
  schedule: (fn: () => void, ms: number) => number;
  unschedule: (id: number) => void;
  flush: (max?: number) => void;
  pending: () => number;
} {
  let next = 1;
  const queue = new Map<number, () => void>();
  return {
    schedule(fn) {
      const id = next++;
      queue.set(id, fn);
      return id;
    },
    unschedule(id) {
      queue.delete(id);
    },
    flush(max = 400) {
      let n = 0;
      while (queue.size > 0 && n++ < max) {
        const first = queue.keys().next().value as number;
        const fn = queue.get(first);
        queue.delete(first);
        fn?.();
      }
    },
    pending() {
      return queue.size;
    }
  };
}
