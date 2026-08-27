/**
 * 勇者小路 · 资源看管（定时器 / rAF / 事件监听）。
 *
 * 1.1 时这个类内联在 `index.ts` 里，`destroy()` 有没有真的清干净只能靠肉眼看。
 * 1.2 把它抽出来，并且把「宿主」（setTimeout / requestAnimationFrame 那一套）做成可注入的，
 * 于是单测可以塞一个假宿主进来，直接断言「destroy 之后一件都不剩」。
 */

export interface TimerHost {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
  setInterval?(fn: () => void, ms: number): number;
  clearInterval?(id: number): void;
  requestAnimationFrame?(fn: (t: number) => void): number;
  cancelAnimationFrame?(id: number): void;
}

export interface ListenerTarget {
  addEventListener(type: string, fn: (ev: never) => void): void;
  removeEventListener(type: string, fn: (ev: never) => void): void;
}

function defaultHost(): TimerHost {
  const g = globalThis as unknown as TimerHost;
  return {
    setTimeout: (fn, ms) => g.setTimeout(fn, ms),
    clearTimeout: (id) => g.clearTimeout(id),
    setInterval: g.setInterval ? (fn, ms) => (g.setInterval as (f: () => void, m: number) => number)(fn, ms) : undefined,
    clearInterval: g.clearInterval ? (id) => (g.clearInterval as (i: number) => void)(id) : undefined,
    requestAnimationFrame: g.requestAnimationFrame
      ? (fn) => (g.requestAnimationFrame as (f: (t: number) => void) => number)(fn)
      : undefined,
    cancelAnimationFrame: g.cancelAnimationFrame
      ? (id) => (g.cancelAnimationFrame as (i: number) => void)(id)
      : undefined
  };
}

export class Cleanup {
  private timers = new Map<number, { fn: () => void; dueAt: number }>();
  private intervals = new Map<number, { fn: () => void; ms: number }>();
  private frames = new Map<number, (t: number) => void>();
  private heldTimers: Array<{ fn: () => void; restMs: number }> = [];
  private heldIntervals: Array<{ fn: () => void; ms: number }> = [];
  private heldFrames: Array<(t: number) => void> = [];
  private offs: Array<() => void> = [];
  private readonly host: TimerHost;
  dead = false;
  frozen = false;

  constructor(host?: TimerHost) {
    this.host = host ?? defaultHost();
    LIVE.add(this);
  }

  /** 还有多少条没清掉的资源；`destroy()` 之后必须是 0 */
  pending(): number {
    return (
      this.timers.size +
      this.intervals.size +
      this.frames.size +
      this.heldTimers.length +
      this.heldIntervals.length +
      this.heldFrames.length +
      this.offs.length
    );
  }

  after(ms: number, fn: () => void): number {
    if (this.dead) return 0;
    if (this.frozen) {
      this.heldTimers.push({ fn, restMs: Math.max(0, ms) });
      return 0;
    }
    const id = this.host.setTimeout(() => {
      this.timers.delete(id);
      if (!this.dead) fn();
    }, ms);
    this.timers.set(id, { fn, dueAt: Date.now() + Math.max(0, ms) });
    return id;
  }

  every(ms: number, fn: () => void): number {
    if (this.dead || !this.host.setInterval) return 0;
    if (this.frozen) {
      this.heldIntervals.push({ fn, ms });
      return 0;
    }
    const id = this.host.setInterval(() => {
      if (!this.dead) fn();
    }, ms);
    this.intervals.set(id, { fn, ms });
    return id;
  }

  frame(fn: (t: number) => void): number {
    if (this.dead || !this.host.requestAnimationFrame) return 0;
    if (this.frozen) {
      this.heldFrames.push(fn);
      return 0;
    }
    const id = this.host.requestAnimationFrame((t) => {
      this.frames.delete(id);
      if (!this.dead) fn(t);
    });
    this.frames.set(id, fn);
    return id;
  }

  /** 挂一个监听，并把「怎么摘掉」一并记下 */
  on<T extends ListenerTarget>(target: T, type: string, fn: (ev: never) => void): void {
    target.addEventListener(type, fn);
    this.own(() => target.removeEventListener(type, fn));
  }

  own(off: () => void): void {
    this.offs.push(off);
  }

  /** 冻住：在飞的定时器按剩余毫秒收起，心跳与帧一并收走；监听留着 */
  freeze(): void {
    if (this.frozen || this.dead) return;
    this.frozen = true;
    const now = Date.now();
    for (const [id, t] of this.timers) {
      this.host.clearTimeout(id);
      this.heldTimers.push({ fn: t.fn, restMs: Math.max(0, t.dueAt - now) });
    }
    this.timers.clear();
    for (const [id, t] of this.intervals) {
      this.host.clearInterval?.(id);
      this.heldIntervals.push(t);
    }
    this.intervals.clear();
    for (const [id, fn] of this.frames) {
      this.host.cancelAnimationFrame?.(id);
      this.heldFrames.push(fn);
    }
    this.frames.clear();
  }

  /** 化冻：欠多少毫秒补多少，心跳与帧原样接上 */
  thaw(): void {
    if (!this.frozen || this.dead) return;
    this.frozen = false;
    for (const t of this.heldTimers.splice(0)) this.after(t.restMs, t.fn);
    for (const t of this.heldIntervals.splice(0)) this.every(t.ms, t.fn);
    for (const fn of this.heldFrames.splice(0)) this.frame(fn);
  }

  killTimers(): void {
    for (const id of this.timers.keys()) this.host.clearTimeout(id);
    this.timers.clear();
    if (this.host.clearInterval) {
      for (const id of this.intervals.keys()) this.host.clearInterval(id);
    }
    this.intervals.clear();
    if (this.host.cancelAnimationFrame) {
      for (const id of this.frames.keys()) this.host.cancelAnimationFrame(id);
    }
    this.frames.clear();
    this.heldTimers.length = 0;
    this.heldIntervals.length = 0;
    this.heldFrames.length = 0;
    this.frozen = false;
  }

  destroy(): void {
    this.dead = true;
    LIVE.delete(this);
    this.killTimers();
    while (this.offs.length) {
      try {
        this.offs.pop()?.();
      } catch (err) {
        console.warn("[一朵一星] 勇者小路清理时出错:", err);
      }
    }
  }
}

/**
 * 还活着的清洁工。闯关、无尽、对战各建各的，外壳只认 `mount()` 返回的那一对
 * `pause` / `resume`，所以留一份名册，暂停时不用管孩子当下在哪个屏。
 */
const LIVE = new Set<Cleanup>();

/** 外壳弹「先歇一会儿」时调：这一款所有还活着的清洁工一起冻住 */
export function freezeAll(): void {
  for (const c of [...LIVE]) c.freeze();
}

/** 关掉面板时调：原样接上 */
export function thawAll(): void {
  for (const c of [...LIVE]) c.thaw();
}

/** 用例用：当前还有几个清洁工活着（destroy 之后必须归零） */
export function liveCleanups(): number {
  return LIVE.size;
}
