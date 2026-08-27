import { describe, expect, it } from "vitest";
import { DEX, DEX_KEY, PROGRESS_KEY, parseDex, serializeDex } from "./logic";
import {
  CAMPAIGN_TOTAL,
  SKIP_KEY,
  clampLevelIndex,
  initialLevelIndex,
  isThemeUnlockedWith,
  isUnlockedWith,
  levelFromSearch,
  mergeSkip,
  parseSkipList,
  serializeSkipList,
} from "./campaign";

describe("直开第 N 关", () => {
  it("1 基关号换成 0 基下标", () => {
    expect(clampLevelIndex(1)).toBe(0);
    expect(clampLevelIndex(2)).toBe(1);
    expect(clampLevelIndex(188)).toBe(187);
    expect(CAMPAIGN_TOTAL).toBe(188);
  });

  it("越界一律夹到两端,坏数字当第 1 关", () => {
    expect(clampLevelIndex(0)).toBe(0);
    expect(clampLevelIndex(-40)).toBe(0);
    expect(clampLevelIndex(9999)).toBe(CAMPAIGN_TOTAL - 1);
    expect(clampLevelIndex(Number.NaN)).toBe(0);
    expect(clampLevelIndex(Number.POSITIVE_INFINITY)).toBe(CAMPAIGN_TOTAL - 1);
    // 小数四舍五入,不会掉进 -1
    expect(clampLevelIndex(3.4)).toBe(2);
    expect(clampLevelIndex(3.6)).toBe(3);
  });

  it("从 `?level=` 里读关号", () => {
    expect(levelFromSearch("?level=12")).toBe(12);
    expect(levelFromSearch("level=12")).toBe(12);
    expect(levelFromSearch("?game=ocean-munch&level=7&x=1")).toBe(7);
    expect(levelFromSearch("?level=999")).toBe(999);
    expect(levelFromSearch("?level=%2012%20")).toBe(12);
  });

  it("读不出关号就返回 null,不瞎猜", () => {
    expect(levelFromSearch("")).toBe(null);
    expect(levelFromSearch(null)).toBe(null);
    expect(levelFromSearch(undefined)).toBe(null);
    expect(levelFromSearch("?level=")).toBe(null);
    expect(levelFromSearch("?level=abc")).toBe(null);
    expect(levelFromSearch("?levels=3")).toBe(null);
    expect(levelFromSearch("?nolevel")).toBe(null);
  });

  it("initialLevel 优先于地址栏,两个都没有才停在首屏", () => {
    expect(initialLevelIndex(5, "?level=100")).toBe(4);
    expect(initialLevelIndex(undefined, "?level=100")).toBe(99);
    expect(initialLevelIndex(null, "?level=100")).toBe(99);
    expect(initialLevelIndex(undefined, "")).toBe(null);
    expect(initialLevelIndex(undefined, null)).toBe(null);
    // 两边的越界都在这一层夹住
    expect(initialLevelIndex(9999, null)).toBe(CAMPAIGN_TOTAL - 1);
    expect(initialLevelIndex(undefined, "?level=-3")).toBe(0);
  });
});

describe("家长跳关的记账", () => {
  it("存档 key 都挂在 `yiduo-yixing.` 前缀下", () => {
    for (const key of [SKIP_KEY, PROGRESS_KEY, DEX_KEY]) {
      expect(key.startsWith("yiduo-yixing.")).toBe(true);
    }
    expect(SKIP_KEY).toBe("yiduo-yixing.l99skip.ocean-munch");
  });

  it("跳关清单序列化往返:去重、排序、原样读回来", () => {
    const list = [7, 3, 3, 0];
    const text = serializeSkipList(list);
    expect(parseSkipList(text)).toEqual([0, 3, 7]);
    expect(parseSkipList(serializeSkipList(parseSkipList(text)))).toEqual([0, 3, 7]);
    expect(parseSkipList(serializeSkipList([]))).toEqual([]);
  });

  it("坏档一律当没跳过,不许抛", () => {
    expect(parseSkipList(null)).toEqual([]);
    expect(parseSkipList("")).toEqual([]);
    expect(parseSkipList("{ 这不是 JSON")).toEqual([]);
    expect(parseSkipList('{"a":1}')).toEqual([]);
    expect(parseSkipList('[1,"x",null,2.5,-3,99999]')).toEqual([1, 2]);
  });

  it("并进一关:重复不涨,越界不收", () => {
    expect(mergeSkip(null, 4)).toEqual([4]);
    expect(mergeSkip("[4]", 4)).toEqual([4]);
    expect(mergeSkip("[9]", 4)).toEqual([4, 9]);
    expect(mergeSkip("[9]", -1)).toEqual([9]);
    expect(mergeSkip("[9]", CAMPAIGN_TOTAL)).toEqual([9]);
  });

  it("跳过的那关下一关照样解锁,自己仍旧 0 星", () => {
    const stars = new Array<number>(CAMPAIGN_TOTAL).fill(0);
    expect(isUnlockedWith(stars, [], 0)).toBe(true);
    expect(isUnlockedWith(stars, [], 1)).toBe(false);
    // 家长跳了第 1 关(下标 0):第 2 关开,但第 1 关星级没变
    const skips = mergeSkip(null, 0);
    expect(isUnlockedWith(stars, skips, 1)).toBe(true);
    expect(stars[0]).toBe(0);
    expect(isUnlockedWith(stars, skips, 2)).toBe(false);
    // 正常通关也解锁
    stars[1] = 3;
    expect(isUnlockedWith(stars, skips, 2)).toBe(true);
  });

  it("章节解锁跟着本章第一关走", () => {
    const stars = new Array<number>(CAMPAIGN_TOTAL).fill(0);
    expect(isThemeUnlockedWith(stars, [], 0)).toBe(true);
    expect(isThemeUnlockedWith(stars, [], 16)).toBe(false);
    expect(isThemeUnlockedWith(stars, mergeSkip(null, 15), 16)).toBe(true);
  });
});

describe("图鉴序列化往返", () => {
  it("存进去什么读出来什么", () => {
    const seen = new Set(["minnow", "stripey", "elite", "lantern", "ribbon"]);
    expect(parseDex(serializeDex(seen))).toEqual(seen);
    expect(parseDex(serializeDex(new Set()))).toEqual(new Set());
    // 全收齐也能原样回来
    const all = new Set(DEX.map((d) => d.id));
    expect(parseDex(serializeDex(all)).size).toBe(DEX.length);
  });

  it("坏档与不认识的 id 都当没收录", () => {
    expect(parseDex(null)).toEqual(new Set());
    expect(parseDex("不是 JSON")).toEqual(new Set());
    expect(parseDex('["minnow","不存在的鱼",7]')).toEqual(new Set(["minnow"]));
  });
});
