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
  private timers = new Set<number>();
  private intervals = new Set<number>();
  private frames = new Set<number>();
  private offs: Array<() => void> = [];
  private readonly host: TimerHost;
  dead = false;

  constructor(host?: TimerHost) {
    this.host = host ?? defaultHost();
  }

  /** 还有多少条没清掉的资源；`destroy()` 之后必须是 0 */
  pending(): number {
    return this.timers.size + this.intervals.size + this.frames.size + this.offs.length;
  }

  after(ms: number, fn: () => void): number {
    const id = this.host.setTimeout(() => {
      this.timers.delete(id);
      if (!this.dead) fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  every(ms: number, fn: () => void): number {
    if (!this.host.setInterval) return 0;
    const id = this.host.setInterval(() => {
      if (!this.dead) fn();
    }, ms);
    this.intervals.add(id);
    return id;
  }

  frame(fn: (t: number) => void): number {
    if (!this.host.requestAnimationFrame) return 0;
    const id = this.host.requestAnimationFrame((t) => {
      this.frames.delete(id);
      if (!this.dead) fn(t);
    });
    this.frames.add(id);
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

  killTimers(): void {
    for (const id of this.timers) this.host.clearTimeout(id);
    this.timers.clear();
    if (this.host.clearInterval) {
      for (const id of this.intervals) this.host.clearInterval(id);
    }
    this.intervals.clear();
    if (this.host.cancelAnimationFrame) {
      for (const id of this.frames) this.host.cancelAnimationFrame(id);
    }
    this.frames.clear();
  }

  destroy(): void {
    this.dead = true;
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
