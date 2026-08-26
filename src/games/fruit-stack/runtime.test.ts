// destroy 必须把监听、定时器、rAF 全部拆干净:宿主可注入,所以这一条能在无头环境里验。
import { describe, expect, it, vi } from "vitest";
import { createRuntime, defaultHost, type ListenerTarget, type RuntimeHost } from "./runtime";

interface FakeTarget extends ListenerTarget {
  live: () => number;
}

function fakeTarget(): FakeTarget {
  const bound = new Map<string, Set<unknown>>();
  return {
    addEventListener(type, fn) {
      if (!bound.has(type)) bound.set(type, new Set());
      bound.get(type)!.add(fn);
    },
    removeEventListener(type, fn) {
      bound.get(type)?.delete(fn);
    },
    live: () => Array.from(bound.values()).reduce((n, s) => n + s.size, 0),
  };
}

interface FakeHost extends RuntimeHost {
  timers: () => number;
  frames: () => number;
  tick: (t: number) => void;
}

function fakeHost(): FakeHost {
  const timeouts = new Set<number>();
  const intervals = new Set<number>();
  const frames = new Map<number, (t: number) => void>();
  let id = 1;
  return {
    raf(cb) {
      const k = id++;
      frames.set(k, cb);
      return k;
    },
    caf(k) {
      frames.delete(k);
    },
    setTimeout() {
      const k = id++;
      timeouts.add(k);
      return k;
    },
    clearTimeout(k) {
      timeouts.delete(k);
    },
    setInterval() {
      const k = id++;
      intervals.add(k);
      return k;
    },
    clearInterval(k) {
      intervals.delete(k);
    },
    now: () => 0,
    timers: () => timeouts.size + intervals.size,
    frames: () => frames.size,
    tick(t) {
      const pending = Array.from(frames.entries());
      frames.clear();
      for (const [, cb] of pending) cb(t);
    },
  };
}

describe("运行期资源登记簿", () => {
  it("destroy 会把监听全部摘掉", () => {
    const host = fakeHost();
    const rt = createRuntime(host);
    const a = fakeTarget();
    const b = fakeTarget();
    rt.on(a, "keydown", () => undefined);
    rt.on(a, "keyup", () => undefined);
    rt.on(b, "resize", () => undefined);
    expect(a.live() + b.live()).toBe(3);
    expect(rt.size).toBe(3);
    rt.destroy();
    expect(a.live() + b.live()).toBe(0);
    expect(rt.size).toBe(0);
    expect(rt.alive).toBe(false);
  });

  it("destroy 会清掉定时器和 rAF 循环", () => {
    const host = fakeHost();
    const rt = createRuntime(host);
    rt.after(() => undefined, 100);
    rt.every(() => undefined, 50);
    const loop = rt.loop(() => undefined);
    loop.start();
    expect(host.timers()).toBe(2);
    expect(host.frames()).toBe(1);
    rt.destroy();
    expect(host.timers()).toBe(0);
    expect(host.frames()).toBe(0);
    expect(loop.running).toBe(false);
  });

  it("循环停下来之后不会再有下一帧", () => {
    const host = fakeHost();
    const rt = createRuntime(host);
    const tick = vi.fn();
    const loop = rt.loop(tick);
    loop.start();
    host.tick(16);
    host.tick(32);
    expect(tick).toHaveBeenCalledTimes(2);
    rt.destroy();
    host.tick(48);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it("单独摘一件东西不影响别的", () => {
    const host = fakeHost();
    const rt = createRuntime(host);
    const t = fakeTarget();
    const off = rt.on(t, "click", () => undefined);
    rt.on(t, "blur", () => undefined);
    off();
    expect(t.live()).toBe(1);
    expect(rt.size).toBe(1);
    off();
    expect(rt.size).toBe(1);
    rt.destroy();
    expect(t.live()).toBe(0);
  });

  it("destroy 可以重复调用,拆到一半出错也不会连累别人", () => {
    const host = fakeHost();
    const rt = createRuntime(host);
    const cleaned: string[] = [];
    rt.own(() => cleaned.push("first"));
    rt.own(() => {
      throw new Error("清理时炸了一下");
    });
    rt.own(() => cleaned.push("last"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => rt.destroy()).not.toThrow();
    // 倒着拆:后登记的先清
    expect(cleaned).toEqual(["last", "first"]);
    expect(() => rt.destroy()).not.toThrow();
    warn.mockRestore();
  });

  it("拆完之后再登记的东西会被就地清掉,不会漏在外面", () => {
    const host = fakeHost();
    const rt = createRuntime(host);
    rt.destroy();
    const t = fakeTarget();
    rt.on(t, "click", () => undefined);
    expect(t.live()).toBe(0);
    expect(rt.size).toBe(0);
  });

  it("没有浏览器 API 时默认宿主也不会抛异常", () => {
    const host = defaultHost();
    expect(() => host.caf(0)).not.toThrow();
    expect(() => host.clearTimeout(host.setTimeout(() => undefined, 0))).not.toThrow();
    expect(typeof host.now()).toBe("number");
  });
});
