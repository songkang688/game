/**
 * 音符下落 · 单测用的极简 DOM / Canvas / AudioContext 桩(只给 `*.test.ts` 用,不参与打包)。
 *
 * 仓库的测试环境是 node、没有 jsdom,也不为一款游戏引新依赖,所以这里手写一份最小实现,
 * 只覆盖 Canvas 舞台与 188 关框架真正用到的那几个 API,顺便把监听器、rAF、
 * 建过几个 AudioContext、关掉几个都数出来——「destroy 之后什么都不剩」这句话才有断言撑着。
 */

export type Handler = (ev: unknown) => void;

export class El {
  tagName: string;
  className = "";
  id = "";
  textContent = "";
  hidden = false;
  disabled = false;
  type = "";
  title = "";
  width = 0;
  height = 0;
  style: Record<string, string> = {};
  children: El[] = [];
  parent: El | null = null;
  attrs: Record<string, string> = {};
  listeners = new Map<string, Set<Handler>>();
  /** 这个节点上一共画过几次(canvas 才有意义) */
  draws = 0;
  /** 每种画布操作各调用了几次(fillRect / drawImage / fillText …),1.3 视觉契约用 */
  ops: Record<string, number> = {};
  /** fillStyle 被赋过的每一个值,按顺序记录(断言「miss 无红闪」用) */
  fillStyles: string[] = [];

  constructor(tag: string) {
    this.tagName = tag;
  }

  private rawHtml = "";

  set innerHTML(v: string) {
    for (const c of this.children) c.parent = null;
    this.children = [];
    this.rawHtml = v;
  }
  get innerHTML(): string {
    return this.rawHtml;
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
  dispatch(t: string, ev: Record<string, unknown> = {}): void {
    const full = { preventDefault: () => undefined, stopPropagation: () => undefined, ...ev };
    for (const f of Array.from(this.listeners.get(t) ?? [])) f(full);
  }
  click(): void {
    if (this.disabled) return;
    this.dispatch("click");
  }
  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 0, top: 0, width: this.width, height: this.height };
  }
  getContext(): unknown {
    return makeCtx(this);
  }
  scrollIntoView(): void {
    /* 桩:滚动不用真做 */
  }
  focus(): void {
    /* 桩:焦点不用真做 */
  }
  /** 只支持 `.class` 这一种选择器,壳层和舞台用到的就这一种 */
  querySelector(sel: string): El | null {
    const cls = sel.startsWith(".") ? sel.slice(1) : sel;
    return this.find((e) => e.className.split(/\s+/).includes(cls));
  }
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

/**
 * canvas 2d 上下文:方法都是空操作,但把「画过几笔」和每种操作的次数都记下来,
 * 1.3 的视觉契约(音符走 drawImage、粒子不再 fillText、miss 无红闪)靠这些计数断言。
 */
function makeCtx(owner: El): unknown {
  const count = (name: string): void => {
    owner.ops[name] = (owner.ops[name] ?? 0) + 1;
  };
  /** 真正落笔的操作:计数并累加 draws */
  const paint =
    (name: string) =>
    (): void => {
      count(name);
      owner.draws++;
    };
  /** 只建路径 / 变换,不落笔 */
  const trace =
    (name: string) =>
    (): void => {
      count(name);
    };
  const gradient = (): unknown => ({ addColorStop: () => undefined });
  let fillStyle: unknown = "";
  return {
    clearRect: paint("clearRect"),
    fillRect: paint("fillRect"),
    fillText: paint("fillText"),
    strokeText: paint("strokeText"),
    drawImage: paint("drawImage"),
    fill: paint("fill"),
    stroke: paint("stroke"),
    beginPath: trace("beginPath"),
    closePath: trace("closePath"),
    moveTo: trace("moveTo"),
    lineTo: trace("lineTo"),
    quadraticCurveTo: trace("quadraticCurveTo"),
    arc: trace("arc"),
    ellipse: trace("ellipse"),
    save: trace("save"),
    restore: trace("restore"),
    translate: trace("translate"),
    scale: trace("scale"),
    rotate: trace("rotate"),
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    get fillStyle(): string {
      return fillStyle as string;
    },
    set fillStyle(v: string) {
      fillStyle = v;
      owner.fillStyles.push(typeof v === "string" ? v : "[gradient]");
    },
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    globalAlpha: 1,
  };
}

// ---------------------------------------------------------------------------
// AudioContext 桩
// ---------------------------------------------------------------------------

export class FakeAudioContext {
  currentTime = 0;
  state = "running";
  closedTimes = 0;
  /** 这个上下文一共合成过几颗音 */
  tones = 0;
  /** 每颗音的频率,用来断言「旋律是自合成的音阶」 */
  freqs: number[] = [];
  destination: unknown = { kind: "destination" };

  createOscillator(): unknown {
    const self = this;
    return {
      type: "sine",
      frequency: {
        setValueAtTime(v: number) {
          self.tones++;
          self.freqs.push(v);
        },
      },
      connect: (node: unknown) => node,
      start: () => undefined,
      stop: () => undefined,
    };
  }

  createGain(): unknown {
    const param = {
      setValueAtTime: () => undefined,
      linearRampToValueAtTime: () => undefined,
      exponentialRampToValueAtTime: () => undefined,
    };
    return { gain: param, connect: (node: unknown) => node };
  }

  close(): Promise<void> {
    this.closedTimes++;
    this.state = "closed";
    return Promise.resolve();
  }
}

export interface Dom {
  root: El;
  head: El;
  winListeners: Map<string, Set<Handler>>;
  frames: Array<() => void>;
  cancelled: number[];
  clock: { ms: number };
  /** 本次测试里建过的音频上下文 */
  audios: FakeAudioContext[];
}

const saved: Record<string, unknown> = {};

/** 装上 DOM 桩。width 是屏宽,reduced 决定 prefers-reduced-motion */
export function installDom(width = 800, reduced = false): Dom {
  const head = new El("head");
  const root = new El("div");
  const winListeners = new Map<string, Set<Handler>>();
  const frames: Array<() => void> = [];
  const cancelled: number[] = [];
  const clock = { ms: 1000 };
  const audios: FakeAudioContext[] = [];

  for (const k of [
    "document",
    "window",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "performance",
    "innerWidth",
    "matchMedia",
    "AudioContext",
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

  class TrackedAudioContext extends FakeAudioContext {
    constructor() {
      super();
      audios.push(this);
    }
  }

  Object.assign(globalThis as Record<string, unknown>, {
    document: {
      head,
      body: root,
      createElement: (tag: string) => new El(tag),
    },
    window: win,
    innerWidth: width,
    matchMedia: win.matchMedia,
    performance: { now: () => clock.ms },
    requestAnimationFrame: (cb: () => void) => {
      frames.push(cb);
      return frames.length;
    },
    cancelAnimationFrame: (h: number) => {
      cancelled.push(h);
    },
    AudioContext: TrackedAudioContext,
  });

  return { root, head, winListeners, frames, cancelled, clock, audios };
}

/** 卸掉 DOM 桩,把全局还回去 */
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

/** 触发一个 window 事件(自带 preventDefault) */
export function fireWindow(dom: Dom, type: string, ev: Record<string, unknown> = {}): void {
  const full = { preventDefault: () => undefined, ...ev };
  for (const f of Array.from(dom.winListeners.get(type) ?? [])) f(full);
}

/** 跑 n 帧动画,每帧推进 stepMs 毫秒(时间先走,再执行这一帧) */
export function flushFrames(dom: Dom, n: number, stepMs = 16): void {
  for (let i = 0; i < n; i++) {
    const cb = dom.frames.shift();
    if (!cb) return;
    dom.clock.ms += stepMs;
    cb();
  }
}

/** 把时钟拨到某个时刻,再跑一帧 */
export function frameAt(dom: Dom, ms: number): void {
  const cb = dom.frames.shift();
  dom.clock.ms = ms;
  cb?.();
}
