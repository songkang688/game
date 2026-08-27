/** 识字小花园 1.2：错题本读写（只落本机，key 走平台统一前缀）。 */
import { describe, expect, it } from "vitest";
import {
  clearMistakes,
  loadMistakes,
  MAX_ENTRIES,
  migrateMistakes,
  MISTAKES_KEY,
  recordMistakes,
  topMistakes,
  type StorageLike,
} from "./mistakes";

function fakeStore(seed: Record<string, string> = {}): StorageLike & { raw: Record<string, string> } {
  const raw: Record<string, string> = { ...seed };
  return {
    raw,
    getItem: (k) => raw[k] ?? null,
    setItem: (k, v) => {
      raw[k] = v;
    },
  };
}

describe("识字小花园 · 错题本", () => {
  it("key 走 yiduo-yixing. 前缀，和 188 关星级存档并存不打架", () => {
    expect(MISTAKES_KEY.startsWith("yiduo-yixing.")).toBe(true);
    expect(MISTAKES_KEY).not.toBe("yiduo-yixing.l99.word-garden");
    const store = fakeStore({ "yiduo-yixing.l99.word-garden": "[1,2,3]" });
    recordMistakes(["日"], store);
    expect(store.raw["yiduo-yixing.l99.word-garden"]).toBe("[1,2,3]");
    expect(JSON.parse(store.raw[MISTAKES_KEY])).toEqual({ 日: 1 });
  });

  it("同一个字错几次就累计几次，多个字分开记", () => {
    const store = fakeStore();
    recordMistakes(["日", "月"], store);
    recordMistakes(["日"], store);
    const book = loadMistakes(store);
    expect(book).toEqual({ 日: 2, 月: 1 });
    expect(topMistakes(book)).toEqual(["日", "月"]);
    expect(topMistakes(book, 1)).toEqual(["日"]);
    expect(topMistakes({}, 3)).toEqual([]);
  });

  it("脏数据一律挡在门外，坏 JSON 当作没错过题", () => {
    expect(migrateMistakes(null)).toEqual({});
    expect(migrateMistakes([1, 2, 3])).toEqual({});
    expect(migrateMistakes("日")).toEqual({});
    // 只收单字、只收正数
    expect(migrateMistakes({ 日: 2, 太阳: 5, 月: 0, 星: -1, 天: "多" })).toEqual({ 日: 2 });
    expect(loadMistakes(fakeStore({ [MISTAKES_KEY]: "{坏掉的" }))).toEqual({});
    expect(loadMistakes(fakeStore())).toEqual({});
    // 非单字的错字请求直接忽略，不会污染本子
    const store = fakeStore();
    expect(recordMistakes(["", "两个字"], store)).toEqual({});
  });

  it("攒太多也不会撑爆本地存档：只留错得最多的那些", () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < MAX_ENTRIES + 50; i++) many[String.fromCharCode(0x4e00 + i)] = i + 1;
    const kept = migrateMistakes(many);
    expect(Object.keys(kept)).toHaveLength(MAX_ENTRIES);
    // 留下的是次数最多的那一批
    expect(Math.min(...Object.values(kept))).toBeGreaterThan(50);
  });

  it("家长可以一键清空", () => {
    const store = fakeStore();
    recordMistakes(["日", "月", "星"], store);
    expect(Object.keys(loadMistakes(store))).toHaveLength(3);
    clearMistakes(store);
    expect(loadMistakes(store)).toEqual({});
  });

  it("没有 localStorage 也照样能玩：退到内存里，不抛异常", () => {
    expect(() => recordMistakes(["日"], null)).not.toThrow();
    expect(loadMistakes(null)).toEqual({ 日: 1 });
    clearMistakes(null);
    expect(loadMistakes(null)).toEqual({});
  });
});
