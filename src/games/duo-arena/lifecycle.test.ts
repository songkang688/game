import { describe, expect, it } from "vitest";
import { type Listener, type TimerHost, createLifecycle } from "./lifecycle";

/** 假宿主:把挂上去的东西全记下来,好断言「离开时归零」 */
function fakeHost() {
  const timers = new Map<number, () => void>();
  const listeners = new Map<string, Listener[]>();
  const frames = new Map<number, (now: number) => void>();
  let seq = 1;
  const host: TimerHost = {
    setTimeout(fn) {
      const id = seq++;
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    requestAnimationFrame(cb) {
      const id = seq++;
      frames.set(id, cb);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    addEventListener(type, fn) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener(type, fn) {
      listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn));
    },
  };
  return {
    host,
    /** 宿主这边还挂着多少东西 */
    live() {
      let n = 0;
      for (const list of listeners.values()) n += list.length;
      return { timers: timers.size, listeners: n, frames: frames.size };
    },
    runTimers() {
      for (const [id, fn] of [...timers]) {
        timers.delete(id);
        fn();
      }
    },
    tick(now: number) {
      for (const [id, cb] of [...frames]) {
        frames.delete(id);
        cb(now);
      }
    },
  };
}

describe("资源账本", () => {
  it("挂上去的 timer、监听、帧循环都记在账上", () => {
    const h = fakeHost();
    const life = createLifecycle(h.host);
    life.later(() => {}, 100);
    life.listen("keydown", () => {});
    life.listen("keyup", () => {});
    life.loop(() => {});
    expect(life.counts()).toEqual({ timers: 1, listeners: 2, frames: 1 });
    expect(h.live()).toEqual({ timers: 1, listeners: 2, frames: 1 });
  });

  it("timer 跑完自动销账,不会越攒越多", () => {
    const h = fakeHost();
    const life = createLifecycle(h.host);
    let hit = 0;
    life.later(() => hit++, 10);
    h.runTimers();
    expect(hit).toBe(1);
    expect(life.counts().timers).toBe(0);
  });

  it("帧循环会自己续帧,一次只挂一个", () => {
    const h = fakeHost();
    const life = createLifecycle(h.host);
    let frames = 0;
    life.loop(() => frames++);
    h.tick(16);
    h.tick(32);
    expect(frames).toBe(2);
    expect(h.live().frames).toBe(1);
    life.loop(() => frames++); // 重复调用不会开出第二个循环
    expect(h.live().frames).toBe(1);
  });

  it("中途退出对局只清延时任务,键盘监听与帧循环还在", () => {
    const h = fakeHost();
    const life = createLifecycle(h.host);
    let fired = 0;
    life.later(() => fired++, 800);
    life.listen("keydown", () => {});
    life.loop(() => {});
    life.clearTimers();
    h.runTimers();
    expect(fired).toBe(0);
    expect(life.counts()).toEqual({ timers: 0, listeners: 1, frames: 1 });
    expect(life.alive).toBe(true);
  });

  it("destroy 之后账面与宿主同时归零", () => {
    const h = fakeHost();
    const life = createLifecycle(h.host);
    life.later(() => {}, 100);
    life.later(() => {}, 200);
    life.listen("keydown", () => {});
    life.listen("resize", () => {});
    life.loop(() => {});
    life.dispose();
    expect(life.alive).toBe(false);
    expect(life.counts()).toEqual({ timers: 0, listeners: 0, frames: 0 });
    expect(h.live()).toEqual({ timers: 0, listeners: 0, frames: 0 });
  });

  it("destroy 之后帧回调不会再跑,延时任务也不会再响", () => {
    const h = fakeHost();
    const life = createLifecycle(h.host);
    let frames = 0;
    let fired = 0;
    life.loop(() => frames++);
    life.later(() => fired++, 10);
    h.tick(16);
    expect(frames).toBe(1);
    life.dispose();
    h.tick(32);
    h.runTimers();
    expect(frames).toBe(1);
    expect(fired).toBe(0);
  });

  it("destroy 之后再挂东西也挂不上去", () => {
    const h = fakeHost();
    const life = createLifecycle(h.host);
    life.dispose();
    expect(life.later(() => {}, 5)).toBe(-1);
    life.listen("keydown", () => {});
    life.loop(() => {});
    expect(h.live()).toEqual({ timers: 0, listeners: 0, frames: 0 });
  });

  it("重复 destroy 不会出错,也不会重复拆", () => {
    const h = fakeHost();
    const life = createLifecycle(h.host);
    life.listen("keyup", () => {});
    life.dispose();
    life.dispose();
    expect(h.live()).toEqual({ timers: 0, listeners: 0, frames: 0 });
    expect(life.alive).toBe(false);
  });

  it("拆掉的正是自己挂的那几个监听,别人的不动", () => {
    const h = fakeHost();
    const outsider = () => {};
    h.host.addEventListener("keydown", outsider);
    const life = createLifecycle(h.host);
    life.listen("keydown", () => {});
    expect(h.live().listeners).toBe(2);
    life.dispose();
    expect(h.live().listeners).toBe(1);
  });
});
