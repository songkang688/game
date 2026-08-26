// 果果合成 · 运行期资源登记簿。
//
// 监听、定时器、rAF 循环、AudioContext 这些东西一旦漏掉,离开游戏再进来就会
// 出现「上一局还在跑」的怪事。这里把它们统统登记下来,`destroy()` 一把倒着清干净,
// 而且宿主(window / 定时器 / rAF)全都可以注入,所以这套清理逻辑能在无头单测里验。

export type FsListener = (ev: Event) => void;

/** 用方法签名声明,参数按双变检查,window / canvas / button 都能直接传进来 */
export interface ListenerTarget {
  addEventListener(type: string, fn: FsListener, opts?: unknown): void;
  removeEventListener(type: string, fn: FsListener, opts?: unknown): void;
}

export interface RuntimeHost {
  raf: (cb: (t: number) => void) => number;
  caf: (id: number) => void;
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
  setInterval: (fn: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
  now: () => number;
}

/** 默认宿主:浏览器里就是 window 那一套,没有的话退化成不做事,绝不抛异常 */
export function defaultHost(): RuntimeHost {
  const g = globalThis as unknown as Partial<RuntimeHost> & {
    requestAnimationFrame?: (cb: (t: number) => void) => number;
    cancelAnimationFrame?: (id: number) => void;
    performance?: { now: () => number };
  };
  return {
    raf: (cb) => (g.requestAnimationFrame ? g.requestAnimationFrame(cb) : 0),
    caf: (id) => g.cancelAnimationFrame?.(id),
    setTimeout: (fn, ms) => (g.setTimeout ? g.setTimeout(fn, ms) : 0),
    clearTimeout: (id) => g.clearTimeout?.(id),
    setInterval: (fn, ms) => (g.setInterval ? g.setInterval(fn, ms) : 0),
    clearInterval: (id) => g.clearInterval?.(id),
    now: () => g.performance?.now() ?? Date.now(),
  };
}

export interface LoopHandle {
  start: () => void;
  stop: () => void;
  readonly running: boolean;
}

export interface Runtime {
  /** 挂一个监听,返回单独摘掉它的函数 */
  on: <T extends Event>(target: ListenerTarget, type: string, fn: (ev: T) => void, opts?: unknown) => () => void;
  /** 一次性定时器 */
  after: (fn: () => void, ms: number) => () => void;
  /** 周期定时器 */
  every: (fn: () => void, ms: number) => () => void;
  /** rAF 循环:回调拿到的是「距上一帧的毫秒数」 */
  loop: (tick: (dtMs: number, now: number) => void) => LoopHandle;
  /** 登记任意一件要在 destroy 时做的清理(例如关掉 AudioContext) */
  own: (dispose: () => void) => () => void;
  /** 还挂着几件东西(单测用) */
  readonly size: number;
  readonly alive: boolean;
  destroy: () => void;
}

export function createRuntime(host: RuntimeHost = defaultHost()): Runtime {
  const bag: Array<() => void> = [];
  let alive = true;

  function own(dispose: () => void): () => void {
    if (!alive) {
      // 已经拆过了就地清掉,免得新登记的东西永远留在那儿
      safely(dispose);
      return () => undefined;
    }
    bag.push(dispose);
    return () => {
      const i = bag.indexOf(dispose);
      if (i >= 0) {
        bag.splice(i, 1);
        safely(dispose);
      }
    };
  }

  function safely(fn: () => void): void {
    try {
      fn();
    } catch (err) {
      console.warn("[一朵一星] 果果合成清理时出了点小状况:", err);
    }
  }

  return {
    on<T extends Event>(target: ListenerTarget, type: string, fn: (ev: T) => void, opts?: unknown) {
      const handler = fn as unknown as FsListener;
      target.addEventListener(type, handler, opts);
      return own(() => target.removeEventListener(type, handler, opts));
    },
    after(fn, ms) {
      let off = (): void => undefined;
      const id = host.setTimeout(() => {
        off();
        fn();
      }, ms);
      off = own(() => host.clearTimeout(id));
      return off;
    },
    every(fn, ms) {
      const id = host.setInterval(fn, ms);
      return own(() => host.clearInterval(id));
    },
    loop(tick) {
      let id = 0;
      let running = false;
      let last = 0;
      const frame = (now: number): void => {
        if (!running) return;
        const dt = last === 0 ? 16 : now - last;
        last = now;
        id = host.raf(frame);
        tick(dt, now);
      };
      const handle: LoopHandle = {
        get running() {
          return running;
        },
        start() {
          if (running) return;
          running = true;
          last = 0;
          id = host.raf(frame);
        },
        stop() {
          running = false;
          host.caf(id);
          id = 0;
        },
      };
      own(() => handle.stop());
      return handle;
    },
    own,
    get size() {
      return bag.length;
    },
    get alive() {
      return alive;
    },
    destroy() {
      if (!alive) return;
      alive = false;
      // 倒着拆:后挂上去的先摘,顺序和挂载时对称
      while (bag.length > 0) {
        const fn = bag.pop();
        if (fn) safely(fn);
      }
    },
  };
}
