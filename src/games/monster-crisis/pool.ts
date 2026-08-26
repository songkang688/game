// 小怪物危机 —— 通用对象池(纯逻辑,不碰 DOM)。
//
// 1.1 的战场是「怪 / 弹 / 烟」三个数组一路 push + splice:每只怪、每发颜料弹、
// 每团小云朵都是新对象,后期同屏几十只时 GC 抖得厉害,低端机直接掉帧。
// 1.2 把这三样全换成对象池:用完还回来,下次直接捡起来重填字段。
//
// 池子只保证两件事:
//  1. 借出去的对象一定是「干净的」(reset 过);
//  2. 借还平衡时池子不长个 —— 造过的对象数只跟同时在场的峰值有关,
//     跟总共借了多少次没有关系(`pool.test.ts` 里那条「1000 次生成回收」的用例)。

export interface Pool<T> {
  /** 借一个:池里有闲的就捡起来,没有才新造 */
  acquire(): T;
  /** 还回来:先 reset 再入库,重复归还会被忽略(不会把同一个对象塞两遍) */
  release(item: T): void;
  /** 一共造过多少个对象(含正在用的) */
  readonly created: number;
  /** 现在闲着几个 */
  readonly idle: number;
  /** 同时在场的历史峰值 */
  readonly peak: number;
  /** 现在借出去几个 */
  readonly live: number;
  /** 全部丢掉(destroy 时用,保证不拖着一堆对象不放) */
  clear(): void;
}

class ArrayPool<T> implements Pool<T> {
  private readonly idleItems: T[] = [];
  private readonly out = new Set<T>();
  private made = 0;
  private high = 0;

  constructor(
    private readonly make: () => T,
    private readonly reset: (item: T) => void,
    prefill = 0
  ) {
    for (let i = 0; i < prefill; i++) {
      this.made++;
      const item = make();
      reset(item);
      this.idleItems.push(item);
    }
  }

  acquire(): T {
    const item = this.idleItems.pop() ?? this.born();
    this.out.add(item);
    if (this.out.size > this.high) this.high = this.out.size;
    return item;
  }

  release(item: T): void {
    if (!this.out.delete(item)) return;
    this.reset(item);
    this.idleItems.push(item);
  }

  get created(): number {
    return this.made;
  }

  get idle(): number {
    return this.idleItems.length;
  }

  get peak(): number {
    return this.high;
  }

  get live(): number {
    return this.out.size;
  }

  clear(): void {
    this.idleItems.length = 0;
    this.out.clear();
  }

  private born(): T {
    this.made++;
    return this.make();
  }
}

export function createPool<T>(make: () => T, reset: (item: T) => void, prefill = 0): Pool<T> {
  return new ArrayPool(make, reset, prefill);
}

/**
 * 在场列表里删掉第 i 个:拿最后一个填过来,不做整体搬移。
 * 每帧要删好几只怪,`splice` 的搬移成本在同屏几十只时是白花的。
 */
export function swapRemove<T>(list: T[], i: number): T | undefined {
  const n = list.length;
  if (i < 0 || i >= n) return undefined;
  const item = list[i];
  const last = list.pop();
  if (i < n - 1 && last !== undefined) list[i] = last;
  return item;
}

/**
 * 粒子预算:低端机少画一点,但绝不影响能不能玩(粒子只是好看)。
 * `tier` 是设备档位,0 = 低端 / 1 = 普通 / 2 = 宽裕;开了「减少动态效果」直接降到最低。
 */
export function particleBudget(tier: number, reducedMotion = false): number {
  if (reducedMotion) return 12;
  if (tier <= 0) return 24;
  if (tier === 1) return 60;
  return 120;
}

/**
 * 按屏幕宽度与 CPU 核数估个设备档位。核数读不到就当普通机器,
 * 宁可多画一点也不要一上来就把画面砍秃。
 */
export function deviceTier(cores: number | undefined, viewportW: number): number {
  const c = typeof cores === "number" && cores > 0 ? cores : 4;
  if (c <= 2) return 0;
  if (c <= 4 && viewportW <= 420) return 1;
  return c >= 8 ? 2 : 1;
}
