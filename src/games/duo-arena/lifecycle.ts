/**
 * 朵星擂台 · 资源账本。
 *
 * 擂台开着的时候会挂一堆东西:两套键盘监听、窗口尺寸监听、演出用的 setTimeout、
 * 还有一直在跑的 requestAnimationFrame。离开游戏时这些必须**一个不剩**地拆掉,
 * 否则回到首页还在偷偷跑帧、偷偷响音效。
 *
 * 与其在 `index.ts` 里到处记变量,不如把它们记进这个小账本:
 * 挂东西走 `later` / `listen` / `loop`,离开时一句 `dispose()` 全部归零,
 * `lifecycle.test.ts` 直接用假 host 断言「归零」这件事,不需要真浏览器。
 *
 * 本作不直接创建 AudioContext(音效一律走 `api.play`),所以账本里没有音频节点。
 */

export type Listener = (event: never) => void;

/** 账本要用到的宿主能力,真跑的时候传 `window`,测试时传假的 */
export interface TimerHost {
  setTimeout(handler: () => void, timeout: number): number;
  clearTimeout(id: number): void;
  requestAnimationFrame(cb: (now: number) => void): number;
  cancelAnimationFrame(id: number): void;
  addEventListener(type: string, fn: Listener): void;
  removeEventListener(type: string, fn: Listener): void;
}

export interface LifecycleCounts {
  timers: number;
  listeners: number;
  frames: number;
}

export interface Lifecycle {
  /** 还活着吗(dispose 之后就是 false) */
  readonly alive: boolean;
  /** 延时执行;账本关掉之后既不会执行也不会留下 timer */
  later(fn: () => void, ms: number): number;
  /** 挂一个窗口监听 */
  listen(type: string, fn: Listener): void;
  /** 开一个每帧回调的循环(内部自己续帧) */
  loop(fn: (now: number) => void): void;
  /** 只清掉还没到点的延时任务(中途退出对局用),监听与帧循环留着 */
  clearTimers(): void;
  /** 现在还挂着多少东西 */
  counts(): LifecycleCounts;
  /** 全部拆掉,可以重复调用 */
  dispose(): void;
}

export function createLifecycle(host: TimerHost): Lifecycle {
  const timers = new Set<number>();
  const listeners: Array<{ type: string; fn: Listener }> = [];
  let frameId: number | null = null;
  let alive = true;

  const api: Lifecycle = {
    get alive() {
      return alive;
    },

    later(fn, ms) {
      if (!alive) return -1;
      const id = host.setTimeout(() => {
        timers.delete(id);
        if (alive) fn();
      }, ms);
      timers.add(id);
      return id;
    },

    listen(type, fn) {
      if (!alive) return;
      host.addEventListener(type, fn);
      listeners.push({ type, fn });
    },

    loop(fn) {
      if (!alive || frameId !== null) return;
      const step = (now: number): void => {
        if (!alive) return;
        frameId = host.requestAnimationFrame(step);
        fn(now);
      };
      frameId = host.requestAnimationFrame(step);
    },

    clearTimers() {
      for (const id of timers) host.clearTimeout(id);
      timers.clear();
    },

    counts() {
      return { timers: timers.size, listeners: listeners.length, frames: frameId === null ? 0 : 1 };
    },

    dispose() {
      alive = false;
      for (const id of timers) host.clearTimeout(id);
      timers.clear();
      for (const { type, fn } of listeners) host.removeEventListener(type, fn);
      listeners.length = 0;
      if (frameId !== null) {
        host.cancelAnimationFrame(frameId);
        frameId = null;
      }
    },
  };

  return api;
}
