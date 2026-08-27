/**
 * 时钟小屋 1.2：错题类型统计。
 * 只记「哪一类错过几次」，key 走平台统一的 `yiduo-yixing.` 前缀，
 * 没有 localStorage（隐私模式、单测环境）时也必须一声不吭地继续跑。
 */
import { describe, expect, it } from "vitest";
import {
  MISTAKES_KEY,
  clearMistakes,
  loadMistakes,
  migrateMistakes,
  recordMistakes,
  topMistakeTypes,
  type StorageLike,
} from "./mistakes";

function fakeStore(seed?: string): StorageLike & { dump: () => string | null } {
  const box = new Map<string, string>();
  if (seed !== undefined) box.set(MISTAKES_KEY, seed);
  return {
    getItem: (k) => box.get(k) ?? null,
    setItem: (k, v) => void box.set(k, v),
    dump: () => box.get(MISTAKES_KEY) ?? null,
  };
}

describe("时钟小屋 · 错题类型统计", () => {
  it("存档 key 走 yiduo-yixing. 前缀，和 188 关星级存档分开放", () => {
    expect(MISTAKES_KEY.startsWith("yiduo-yixing.")).toBe(true);
    expect(MISTAKES_KEY).not.toContain("yiduo-yixing.l99.");
    expect(MISTAKES_KEY).toContain("clock-house");
  });

  it("答错就累加，同一类错两次就记两次", () => {
    const store = fakeStore();
    recordMistakes(["elapsed", "unitConvert"], store);
    recordMistakes(["elapsed"], store);
    expect(loadMistakes(store)).toEqual({ elapsed: 2, unitConvert: 1 });
  });

  it("坏数据、脏字段、负数一律当没有，绝不把统计读崩", () => {
    expect(migrateMistakes(null)).toEqual({});
    expect(migrateMistakes("坏了")).toEqual({});
    expect(migrateMistakes({ elapsed: -3, readFace: 0, 不存在的类: 9 })).toEqual({});
    expect(migrateMistakes({ elapsed: 2.4, timezone: "3" })).toEqual({ elapsed: 2 });
    expect(loadMistakes(fakeStore("{ 这不是 json"))).toEqual({});
    expect(loadMistakes(fakeStore())).toEqual({});
  });

  it("错得最多的排前面，并列时顺序稳定", () => {
    const stats = { readFace: 1, elapsed: 5, unitConvert: 5, timezone: 2 };
    expect(topMistakeTypes(stats, 3)).toEqual(["elapsed", "unitConvert", "timezone"]);
    expect(topMistakeTypes(stats, 1)).toEqual(["elapsed"]);
    expect(topMistakeTypes({}, 3)).toEqual([]);
  });

  it("清空之后从头再来，写进去的一直是合法 JSON", () => {
    const store = fakeStore();
    recordMistakes(["schedule", "schedule", "calendar"], store);
    expect(JSON.parse(store.dump()!)).toEqual({ schedule: 2, calendar: 1 });
    clearMistakes(store);
    expect(loadMistakes(store)).toEqual({});
  });

  it("没有 localStorage 也能用：退回内存，既不报错也不丢当次统计", () => {
    expect(() => recordMistakes(["elapsed"], null)).not.toThrow();
    const first = recordMistakes(["convert1224"], null);
    expect(first.convert1224).toBeGreaterThanOrEqual(1);
    expect(() => clearMistakes(null)).not.toThrow();
    expect(loadMistakes(null)).toEqual({});
  });
});
