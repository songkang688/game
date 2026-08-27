/**
 * 窗口 4 的假时钟（只给本目录的用例用）。
 *
 * 仓库的 vitest 跑在 node 环境，真的等 1 秒去看倒计时走没走太慢也不稳。
 * 这里手写一个能自己往前拨的时钟：`advance(ms)` 走到哪一刻，到点的定时器
 * 就按顺序回调，`Date.now()` 也跟着走 —— 各款的 freeze/thaw 都是按
 * **剩余毫秒** 记账的，`Date.now()` 不跟着拨就验不出「暂停多久欠多久」。
 */

interface Job {
  id: number;
  fn: () => void;
  dueAt: number;
  /** 心跳：跑完自动排下一次 */
  everyMs: number | null;
}

export interface FakeClock {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
  setInterval(fn: () => void, ms: number): number;
  clearInterval(id: number): void;
  requestAnimationFrame(fn: (t: number) => void): number;
  cancelAnimationFrame(id: number): void;
  /** 往前拨，到点的活按时间顺序跑掉 */
  advance(ms: number): void;
  /** 只把排着的帧跑一遍（rAF 不看时间） */
  runFrames(): void;
  /** 还排着几个定时器 / 心跳 */
  readonly timers: number;
  /** 还排着几帧 */
  readonly frames: number;
  /** 装到 globalThis.Date.now 上，用完 restore */
  restore(): void;
}

export function fakeClock(startMs = 1_700_000_000_000): FakeClock {
  let now = startMs;
  let seq = 1;
  const jobs = new Map<number, Job>();
  const frames = new Map<number, (t: number) => void>();

  const realNow = Date.now;
  Date.now = () => now;

  const clock: FakeClock = {
    setTimeout(fn, ms) {
      const id = seq++;
      jobs.set(id, { id, fn, dueAt: now + Math.max(0, ms), everyMs: null });
      return id;
    },
    clearTimeout(id) {
      jobs.delete(id);
    },
    setInterval(fn, ms) {
      const id = seq++;
      const every = Math.max(1, ms);
      jobs.set(id, { id, fn, dueAt: now + every, everyMs: every });
      return id;
    },
    clearInterval(id) {
      jobs.delete(id);
    },
    requestAnimationFrame(fn) {
      const id = seq++;
      frames.set(id, fn);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    advance(ms) {
      const until = now + Math.max(0, ms);
      // 一次只跑最早到期的那一个，跑完再看有没有新排进来的（心跳会自己续）
      for (let guard = 0; guard < 10_000; guard++) {
        let next: Job | null = null;
        for (const job of jobs.values()) {
          if (job.dueAt <= until && (next === null || job.dueAt < next.dueAt)) next = job;
        }
        if (!next) break;
        now = next.dueAt;
        if (next.everyMs === null) jobs.delete(next.id);
        else next.dueAt = now + next.everyMs;
        next.fn();
      }
      now = until;
    },
    runFrames() {
      const batch = [...frames.entries()];
      frames.clear();
      for (const [, fn] of batch) fn(now);
    },
    get timers() {
      return jobs.size;
    },
    get frames() {
      return frames.size;
    },
    restore() {
      Date.now = realNow;
    },
  };
  return clock;
}
