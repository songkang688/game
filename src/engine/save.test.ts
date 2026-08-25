import { describe, expect, it } from "vitest";
import { SAVE_KEY, SaveStore, type StorageLike } from "./save";

function memStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    }
  };
}

describe("SaveStore 星星存档", () => {
  it("初始余额为 0", () => {
    const store = new SaveStore(memStorage());
    expect(store.getStars()).toBe(0);
  });

  it("addStars 可以加星并返回最新余额", () => {
    const store = new SaveStore(memStorage());
    expect(store.addStars(3)).toBe(3);
    expect(store.addStars(2)).toBe(5);
    expect(store.getStars()).toBe(5);
  });

  it("addStars 可以扣星,但余额不会低于 0", () => {
    const store = new SaveStore(memStorage());
    store.addStars(4);
    expect(store.addStars(-3)).toBe(1);
    expect(store.addStars(-100)).toBe(0);
    expect(store.getStars()).toBe(0);
  });

  it("addStars 遇到非法数字时不改变余额", () => {
    const store = new SaveStore(memStorage());
    store.addStars(7);
    expect(store.addStars(Number.NaN)).toBe(7);
    expect(store.addStars(Number.POSITIVE_INFINITY)).toBe(7);
  });

  it("存档会持久化:同一 storage 再建实例能读回余额", () => {
    const storage = memStorage();
    const a = new SaveStore(storage);
    a.addStars(9);
    const b = new SaveStore(storage);
    expect(b.getStars()).toBe(9);
  });

  it("存档损坏(非法 JSON)时回退到默认值而不是崩溃", () => {
    const storage = memStorage();
    storage.setItem(SAVE_KEY, "{{{ 不是 JSON");
    const store = new SaveStore(storage);
    expect(store.getStars()).toBe(0);
    expect(store.isSoundOn()).toBe(true);
  });

  it("存档里的负数星星会被清洗为 0", () => {
    const storage = memStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ stars: -42, soundOn: true, games: {} }));
    const store = new SaveStore(storage);
    expect(store.getStars()).toBe(0);
  });

  it("recordWin 保留历史最好星级", () => {
    const store = new SaveStore(memStorage());
    store.recordWin("demo", 2);
    expect(store.getGameProgress("demo").bestStars).toBe(2);
    store.recordWin("demo", 1);
    expect(store.getGameProgress("demo").bestStars).toBe(2);
    store.recordWin("demo", 3);
    expect(store.getGameProgress("demo").bestStars).toBe(3);
  });

  it("recordPlay 累计游玩次数", () => {
    const store = new SaveStore(memStorage());
    store.recordPlay("demo");
    store.recordPlay("demo");
    expect(store.getGameProgress("demo").plays).toBe(2);
  });

  it("resetAll 清空全部进度", () => {
    const storage = memStorage();
    const store = new SaveStore(storage);
    store.addStars(10);
    store.recordWin("demo", 3);
    store.resetAll();
    expect(store.getStars()).toBe(0);
    expect(store.getGameProgress("demo").bestStars).toBe(0);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it("onChange 订阅会在存档变化时触发,退订后不再触发", () => {
    const store = new SaveStore(memStorage());
    let calls = 0;
    const off = store.onChange(() => {
      calls += 1;
    });
    store.addStars(1);
    expect(calls).toBe(1);
    off();
    store.addStars(1);
    expect(calls).toBe(1);
  });
});
