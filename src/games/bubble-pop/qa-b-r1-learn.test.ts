/**
 * 窗口4 · 档B · 第 1 轮学习优化员 —— 泡泡噗噗的落地覆盖。
 *
 * 落地内容:闯关(`playLevel`)与无尽(`mountSea`)原本各手抄了一份
 * 「timeouts Set + destroyed 标记 + raf」,漏一处就是一处泄漏。
 * 现在收成 `BubbleBag` 一个口袋,两条路共用,收摊时一把倒干净。
 */
import { describe, expect, it } from "vitest";
import { BubbleBag, type BubbleBagHost } from "./collapse";
import { readGameSources } from "../adventure-king/qaAudit";

const SOURCES = readGameSources("bubble-pop");
const INDEX = SOURCES.find((s) => s.name === "index.ts")!;

/** 一个假的定时器宿主:能数出「还有几个没清」 */
function fakeHost(): BubbleBagHost & { live: Set<number>; run: (id: number) => void } {
  let next = 1;
  const live = new Set<number>();
  const jobs = new Map<number, () => void>();
  return {
    live,
    setTimeout(fn) {
      const id = next++;
      live.add(id);
      jobs.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      live.delete(id);
      jobs.delete(id);
    },
    cancelRaf(id) {
      live.delete(id);
    },
    run(id) {
      const fn = jobs.get(id);
      jobs.delete(id);
      fn?.();
    },
  };
}

describe("档B R1 落地 · 泡泡噗噗 · BubbleBag 统一收摊", () => {
  it("排进去的延时都记着,close 之后一个不剩", () => {
    const host = fakeHost();
    const bag = new BubbleBag(host);
    for (let i = 0; i < 10; i++) bag.after(() => undefined, 100 + i);
    expect(bag.size).toBe(10);
    expect(host.live.size).toBe(10);
    bag.close();
    expect(bag.size).toBe(0);
    expect(host.live.size).toBe(0);
  });

  it("close 之后到点的回调不会再执行(离开页面不会被旧定时器打脸)", () => {
    const host = fakeHost();
    const bag = new BubbleBag(host);
    let fired = 0;
    bag.after(() => fired++, 100);
    const id = [...host.live][0];
    bag.close();
    host.run(id);
    expect(fired).toBe(0);
  });

  it("close 之后再排新活也排不进来", () => {
    const host = fakeHost();
    const bag = new BubbleBag(host);
    bag.close();
    let fired = 0;
    bag.after(() => fired++, 10);
    expect(bag.size).toBe(0);
    expect(host.live.size).toBe(0);
    expect(fired).toBe(0);
  });

  it("rAF 只记最新的一帧,close 时取消它;收摊后来的帧当场取消", () => {
    const host = fakeHost();
    const bag = new BubbleBag(host);
    bag.onRaf(101);
    bag.onRaf(102);
    expect(bag.size).toBe(1);
    bag.close();
    expect(bag.size).toBe(0);
    expect(host.live.has(102)).toBe(false);
    bag.onRaf(103);
    expect(bag.size).toBe(0);
  });

  it("clearPending 只清手上的活,口袋还能接着用(「再涨一次潮」走这条)", () => {
    const host = fakeHost();
    const bag = new BubbleBag(host);
    bag.after(() => undefined, 50);
    bag.onRaf(7);
    expect(bag.size).toBe(2);
    bag.clearPending();
    expect(bag.size).toBe(0);
    expect(bag.alive).toBe(true);
    bag.after(() => undefined, 50);
    expect(bag.size).toBe(1);
    bag.close();
    expect(bag.alive).toBe(false);
  });

  it("进→玩→退跑 5 遍,口袋每一遍都归零", () => {
    for (let round = 0; round < 5; round++) {
      const host = fakeHost();
      const bag = new BubbleBag(host);
      for (let i = 0; i < 6; i++) bag.after(() => undefined, 30);
      bag.onRaf(round + 1);
      bag.close();
      expect(bag.size).toBe(0);
      expect(host.live.size).toBe(0);
    }
  });

  it("闯关与无尽两条路都改用了同一个口袋,手抄的那两份已经删干净", () => {
    expect((INDEX.text.match(/new BubbleBag\(\)/g) ?? []).length).toBe(2);
    expect(INDEX.text).not.toContain("new Set<ReturnType<typeof setTimeout>>()");
    expect(INDEX.text).not.toMatch(/let destroyed = false/);
    expect(INDEX.text).not.toMatch(/timeouts\.forEach/);
    expect(INDEX.text).not.toMatch(/cancelAnimationFrame\(/);
  });
});
