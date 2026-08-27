/**
 * 钓鱼小达人 · 资源登记簿单测。
 *
 * `destroy` 必须把 rAF、定时器、监听全部还回去 —— 这份测试就是那句「归零」的凭据。
 */
import { describe, expect, it, vi } from "vitest";
import { createLedger } from "./runtime";

describe("资源登记簿", () => {
  it("新开的登记簿什么都不欠", () => {
    const led = createLedger();
    expect(led.size()).toBe(0);
    expect(led.counts()).toEqual({ rafs: 0, timers: 0, listeners: 0 });
  });

  it("登记什么就记什么,rAF 句柄原样还回去", () => {
    const led = createLedger();
    expect(led.raf(7)).toBe(7);
    led.timer(8);
    led.timer(9);
    led.listener(() => {});
    expect(led.counts()).toEqual({ rafs: 1, timers: 2, listeners: 1 });
    expect(led.size()).toBe(4);
  });

  it("releaseAll 之后计数归零,而且每样都被真的取消掉了", () => {
    const cancelRaf = vi.fn();
    const clearTimer = vi.fn();
    const off = vi.fn();
    const led = createLedger({ cancelRaf, clearTimer });
    led.raf(1);
    led.raf(2);
    led.timer(30);
    led.listener(off);

    led.releaseAll();

    expect(led.size()).toBe(0);
    expect(led.counts()).toEqual({ rafs: 0, timers: 0, listeners: 0 });
    expect(cancelRaf.mock.calls.map((c) => c[0]).sort()).toEqual([1, 2]);
    expect(clearTimer).toHaveBeenCalledWith(30);
    expect(off).toHaveBeenCalledTimes(1);
  });

  it("再 releaseAll 一次什么都不会发生(destroy 调两遍也安全)", () => {
    const cancelRaf = vi.fn();
    const off = vi.fn();
    const led = createLedger({ cancelRaf });
    led.raf(5);
    led.listener(off);
    led.releaseAll();
    led.releaseAll();
    expect(cancelRaf).toHaveBeenCalledTimes(1);
    expect(off).toHaveBeenCalledTimes(1);
    expect(led.size()).toBe(0);
  });

  it("同一个 rAF 句柄登记两次只算一份", () => {
    const cancelRaf = vi.fn();
    const led = createLedger({ cancelRaf });
    led.raf(4);
    led.raf(4);
    expect(led.counts().rafs).toBe(1);
    led.releaseAll();
    expect(cancelRaf).toHaveBeenCalledTimes(1);
  });

  it("提前还掉的 rAF 不会在 destroy 时被重复取消", () => {
    const cancelRaf = vi.fn();
    const led = createLedger({ cancelRaf });
    led.raf(11);
    led.dropRaf(11);
    expect(led.size()).toBe(0);
    led.dropRaf(11);
    led.releaseAll();
    expect(cancelRaf).toHaveBeenCalledTimes(1);
  });

  it("有一个清理函数抛异常,剩下的照样清干净", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const good = vi.fn();
    const led = createLedger({
      cancelRaf: () => {
        throw new Error("取消失败");
      },
    });
    led.raf(1);
    led.listener(() => {
      throw new Error("解绑失败");
    });
    led.listener(good);
    led.releaseAll();
    expect(led.size()).toBe(0);
    expect(good).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("非法句柄不会被记进去", () => {
    const led = createLedger();
    led.raf(Number.NaN);
    led.timer(Number.POSITIVE_INFINITY);
    expect(led.size()).toBe(0);
  });
});
