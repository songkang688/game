/**
 * 小怪物危机 1.2 · 对象池。
 *
 * 这一份的主角是那条「1000 次生成回收后池不膨胀」的用例:
 * 1.1 的怪 / 弹 / 烟一路 new,后期同屏几十只就开始抖;
 * 1.2 借还平衡时,造过的对象数只跟同时在场的峰值有关。
 */
import { describe, expect, it } from "vitest";
import { createPool, deviceTier, particleBudget, swapRemove } from "./pool";

interface Box {
  n: number;
  tag: string;
}

function boxPool(prefill = 0) {
  return createPool<Box>(
    () => ({ n: 0, tag: "" }),
    (b) => {
      b.n = 0;
      b.tag = "";
    },
    prefill
  );
}

describe("对象池", () => {
  it("1000 次生成回收之后,池子一个都没多造(同屏 8 个的峰值)", () => {
    const pool = boxPool();
    const live: Box[] = [];
    for (let i = 0; i < 1000; i++) {
      const b = pool.acquire();
      b.n = i;
      live.push(b);
      if (live.length >= 8) {
        while (live.length > 0) pool.release(live.pop() as Box);
      }
    }
    while (live.length > 0) pool.release(live.pop() as Box);
    expect(pool.created).toBe(8);
    expect(pool.peak).toBe(8);
    expect(pool.live).toBe(0);
    expect(pool.idle).toBe(8);
  });

  it("借出去的一定是干净的:上一手写的字段被 reset 抹掉了", () => {
    const pool = boxPool();
    const a = pool.acquire();
    a.n = 42;
    a.tag = "脏的";
    pool.release(a);
    const b = pool.acquire();
    expect(b).toBe(a);
    expect(b.n).toBe(0);
    expect(b.tag).toBe("");
  });

  it("重复归还同一个对象不会把它塞两遍", () => {
    const pool = boxPool();
    const a = pool.acquire();
    pool.release(a);
    pool.release(a);
    pool.release(a);
    expect(pool.idle).toBe(1);
    expect(pool.acquire()).toBe(a);
    expect(pool.idle).toBe(0);
  });

  it("预热过的池子一上来就有货,不用等第一帧现造", () => {
    const pool = boxPool(12);
    expect(pool.created).toBe(12);
    expect(pool.idle).toBe(12);
    pool.acquire();
    expect(pool.created).toBe(12);
  });

  it("峰值涨上去才会多造,峰值不涨就一直复用", () => {
    const pool = boxPool();
    const live: Box[] = [];
    for (let i = 0; i < 20; i++) live.push(pool.acquire());
    expect(pool.created).toBe(20);
    for (const b of live) pool.release(b);
    for (let round = 0; round < 50; round++) {
      const batch: Box[] = [];
      for (let i = 0; i < 20; i++) batch.push(pool.acquire());
      for (const b of batch) pool.release(b);
    }
    expect(pool.created).toBe(20);
  });

  it("clear 之后不再拖着任何对象(destroy 用得上)", () => {
    const pool = boxPool(4);
    const a = pool.acquire();
    expect(pool.live).toBe(1);
    pool.clear();
    expect(pool.idle).toBe(0);
    expect(pool.live).toBe(0);
    // 清空之后照样能继续借,只是要现造
    const b = pool.acquire();
    expect(b).not.toBe(undefined);
    expect(a).not.toBe(undefined);
  });
});

describe("在场列表与画质预算", () => {
  it("swapRemove 拿最后一个填坑,长度对、内容不丢", () => {
    const list = [1, 2, 3, 4, 5];
    expect(swapRemove(list, 1)).toBe(2);
    expect(list).toHaveLength(4);
    expect(list.sort((a, b) => a - b)).toEqual([1, 3, 4, 5]);
    expect(swapRemove(list, 99)).toBe(undefined);
  });

  it("低端机粒子少画一点,但绝不会少到 0(粒子只是好看,不影响能不能玩)", () => {
    expect(particleBudget(0)).toBeLessThan(particleBudget(1));
    expect(particleBudget(1)).toBeLessThan(particleBudget(2));
    expect(particleBudget(0)).toBeGreaterThan(0);
    // 开了「减少动态效果」就降到最低,但照样有
    expect(particleBudget(2, true)).toBeLessThan(particleBudget(0));
    expect(particleBudget(2, true)).toBeGreaterThan(0);
  });

  it("设备档位:双核当低端,读不到核数就按普通机器算", () => {
    expect(deviceTier(2, 360)).toBe(0);
    expect(deviceTier(4, 360)).toBe(1);
    expect(deviceTier(undefined, 1280)).toBe(1);
    expect(deviceTier(8, 1280)).toBe(2);
  });
});
