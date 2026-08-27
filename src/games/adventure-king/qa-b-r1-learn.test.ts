/**
 * 窗口4 · 档B · 第 1 轮学习优化员 —— 冒险小王的落地覆盖。
 *
 * 落地内容:横版走廊 `createRunner` 原本手写三行 `removeEventListener`,
 * 和探索层的 `Disposer` 各走各的路;现在统一收进同一个口袋,
 * 「新加了监听忘了摘」这条口子从此有测试守着。
 */
import { describe, expect, it } from "vitest";
import { Disposer } from "./explore";
import { globalListenersRegisteredInBag, readGameSources } from "./qaAudit";

const SOURCES = readGameSources("adventure-king");
const INDEX = SOURCES.find((s) => s.name === "index.ts")!;

describe("档B R1 落地 · 冒险小王 · 全局监听统一进口袋", () => {
  it("index.ts 里每一条 window 监听的下一行都把「怎么摘」登记进了 bag", () => {
    expect(globalListenersRegisteredInBag(INDEX)).toEqual([]);
  });

  it("走廊与探索层都用同一个 Disposer,不再各写各的收尾", () => {
    const uses = INDEX.text.match(/new Disposer\(\)/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(2);
    // 收尾里不再出现裸的 removeEventListener / cancelAnimationFrame
    expect(INDEX.text).not.toMatch(/destroy\(\)\s*\{[^}]*window\.removeEventListener/);
  });

  it("rAF 的取消也进了口袋,dispose 一次就全清", () => {
    expect(INDEX.text).toContain("bag.add(() => cancelAnimationFrame(raf))");
  });

  it("Disposer 后进先出地收:先登记的后收,和手写 destroy 的顺序一致", () => {
    const order: number[] = [];
    const bag = new Disposer();
    bag.add(() => order.push(1));
    bag.add(() => order.push(2));
    bag.add(() => order.push(3));
    bag.dispose();
    expect(order).toEqual([3, 2, 1]);
    expect(bag.size).toBe(0);
    expect(bag.disposed).toBe(true);
  });

  it("进→玩→退跑 5 遍,口袋每一遍都归零", () => {
    for (let round = 0; round < 5; round++) {
      const bag = new Disposer();
      let live = 0;
      for (let i = 0; i < 8; i++) {
        live++;
        bag.add(() => live--);
      }
      expect(bag.size).toBe(8);
      bag.dispose();
      expect(bag.size).toBe(0);
      expect(live).toBe(0);
    }
  });
});
