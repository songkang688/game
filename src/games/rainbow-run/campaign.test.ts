import { describe, expect, it } from "vitest";
import {
  BOOST_CAP,
  CAMPAIGN_TOTAL,
  LEGACY_ENDLESS_KEYS,
  SKIP_KEY,
  START_SHIELD_CAP_MS,
  bestEndlessMeters,
  clampBoost,
  clampLevelIndex,
  describeBoosts,
  initialLevelIndex,
  isUnlockedWith,
  levelFromSearch,
  mergeSkip,
  neutralBoosts,
  parseSkipList,
  readLegacyMeters,
  runnerBoosts,
  serializeSkipList,
} from "./campaign";
import type { KeyStore } from "./campaign";
import { BONUS_CAP_PERMILLE, MAX_LEVEL, START_SHIELD_MS_PER_LEVEL } from "../../engine/collection";
import type { CollectionEffects } from "../../engine/collection";
import { LEVELS, PROGRESS_KEY } from "./logic";
import { ENDLESS_RECORD_KEY } from "./endless";

function store(map: Record<string, string>): KeyStore {
  return { getItem: (k) => map[k] ?? null };
}

describe("彩虹跑跑 · openCampaignLevel 直开第 N 关", () => {
  it("战役总关数就是关卡表的长度,188 关一关不多一关不少", () => {
    expect(CAMPAIGN_TOTAL).toBe(LEVELS.length);
    expect(CAMPAIGN_TOTAL).toBe(188);
  });

  it("1 基关号换成 0 基下标:第 1 关是 0,第 188 关是 187", () => {
    expect(clampLevelIndex(1)).toBe(0);
    expect(clampLevelIndex(2)).toBe(1);
    expect(clampLevelIndex(188)).toBe(187);
  });

  it("越界一律夹到两端,不会开出一关不存在的关", () => {
    expect(clampLevelIndex(0)).toBe(0);
    expect(clampLevelIndex(-99)).toBe(0);
    expect(clampLevelIndex(189)).toBe(187);
    expect(clampLevelIndex(99_999)).toBe(187);
    for (const n of [-5, 0, 1, 94, 188, 500]) {
      const idx = clampLevelIndex(n);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(CAMPAIGN_TOTAL);
      expect(LEVELS[idx]).toBeDefined();
    }
  });

  it("小数与坏数据也夹得住,不会算出 NaN 下标", () => {
    expect(clampLevelIndex(12.4)).toBe(11);
    expect(clampLevelIndex(12.6)).toBe(12);
    // 不是个有限的数就当第 1 关——NaN 和无穷都走同一条兜底,不猜玩家想干什么
    expect(clampLevelIndex(Number.NaN)).toBe(0);
    expect(clampLevelIndex(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampLevelIndex(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("?level=N 读得出来,读不出来就返回 null", () => {
    expect(levelFromSearch("?level=12")).toBe(12);
    expect(levelFromSearch("level=1")).toBe(1);
    expect(levelFromSearch("?a=1&level=188&b=2")).toBe(188);
    expect(levelFromSearch("?level=%20 7 ")).toBe(7);
    expect(levelFromSearch("?level=")).toBeNull();
    expect(levelFromSearch("?level=abc")).toBeNull();
    expect(levelFromSearch("?other=3")).toBeNull();
    expect(levelFromSearch("")).toBeNull();
    expect(levelFromSearch(null)).toBeNull();
  });

  it("平台给的 initialLevel 优先于地址栏,两个都没有才走选世界", () => {
    expect(initialLevelIndex(30, "?level=5")).toBe(29);
    expect(initialLevelIndex(undefined, "?level=5")).toBe(4);
    expect(initialLevelIndex(undefined, "")).toBeNull();
    expect(initialLevelIndex(undefined, "?nope=1")).toBeNull();
    // 平台给的数也一样要夹
    expect(initialLevelIndex(9999, "")).toBe(187);
    expect(initialLevelIndex(Number.NaN, "?level=3")).toBe(2);
  });
});

describe("彩虹跑跑 · 家长跳关", () => {
  it("跳关存档是并存的小数组,和战役星级、无尽纪录都分开", () => {
    expect(SKIP_KEY).toBe("yiduo-yixing.l99skip.rainbow-run");
    expect(SKIP_KEY).not.toBe(PROGRESS_KEY);
    expect(SKIP_KEY).not.toBe(ENDLESS_RECORD_KEY);
  });

  it("读跳关记录:坏数据一律当没跳过,不抛异常", () => {
    expect(parseSkipList(null)).toEqual([]);
    expect(parseSkipList("")).toEqual([]);
    expect(parseSkipList("不是 json")).toEqual([]);
    expect(parseSkipList('{"a":1}')).toEqual([]);
    expect(parseSkipList("[1,\"x\",null,2]")).toEqual([1, 2]);
    // 越界的关号被剔掉
    expect(parseSkipList(`[-1,0,${CAMPAIGN_TOTAL},${CAMPAIGN_TOTAL - 1}]`)).toEqual([
      0,
      CAMPAIGN_TOTAL - 1,
    ]);
  });

  it("并进新的一关:去重、排好序,越界的忽略", () => {
    expect(mergeSkip(null, 5)).toEqual([5]);
    expect(mergeSkip("[5]", 5)).toEqual([5]);
    expect(mergeSkip("[9,3]", 5)).toEqual([3, 5, 9]);
    expect(mergeSkip("[3]", -1)).toEqual([3]);
    expect(mergeSkip("[3]", CAMPAIGN_TOTAL)).toEqual([3]);
  });

  it("写出去再读回来是同一份", () => {
    const list = [7, 2, 2, 30];
    expect(parseSkipList(serializeSkipList(list))).toEqual([2, 7, 30]);
  });

  it("跳过的关星级仍记 0,但下一关照样解锁", () => {
    const stars = new Array<number>(CAMPAIGN_TOTAL).fill(0);
    // 第 1 关永远可玩
    expect(isUnlockedWith(stars, [], 0)).toBe(true);
    // 没星又没跳过 → 第 2 关锁着
    expect(isUnlockedWith(stars, [], 1)).toBe(false);
    // 跳过第 1 关 → 第 2 关开了,而星级还是 0
    expect(isUnlockedWith(stars, [0], 1)).toBe(true);
    expect(stars[0]).toBe(0);
    // 拿到星星也一样解锁
    stars[1] = 2;
    expect(isUnlockedWith(stars, [], 2)).toBe(true);
    // 跳过的是别的关,解锁不了这一关
    expect(isUnlockedWith(stars, [0], 5)).toBe(false);
  });
});

describe("彩虹跑跑 · 无尽成绩上报与老 key 迁移", () => {
  it("老 key 只读不写,而且都带 yiduo-yixing 前缀", () => {
    expect(LEGACY_ENDLESS_KEYS.length).toBeGreaterThan(0);
    for (const k of LEGACY_ENDLESS_KEYS) {
      expect(k.startsWith("yiduo-yixing.rainbow-run.")).toBe(true);
      expect(k).not.toBe(ENDLESS_RECORD_KEY);
    }
  });

  it("老 key 里最好那一趟读得出来:纯数字、JSON 数字、带 meters 的对象都认", () => {
    expect(readLegacyMeters(store({ [LEGACY_ENDLESS_KEYS[0]]: "420" }))).toBe(420);
    expect(readLegacyMeters(store({ [LEGACY_ENDLESS_KEYS[1]]: "777" }))).toBe(777);
    expect(
      readLegacyMeters(store({ [LEGACY_ENDLESS_KEYS[2]]: '{"meters":301,"coins":9}' })),
    ).toBe(301);
    // 三条都有就取最大
    expect(
      readLegacyMeters(
        store({
          [LEGACY_ENDLESS_KEYS[0]]: "100",
          [LEGACY_ENDLESS_KEYS[1]]: "900",
          [LEGACY_ENDLESS_KEYS[2]]: "500",
        }),
      ),
    ).toBe(900);
  });

  it("读不动、读到垃圾、根本没有 store,都当 0,不抛异常", () => {
    expect(readLegacyMeters(null)).toBe(0);
    expect(readLegacyMeters(store({}))).toBe(0);
    expect(readLegacyMeters(store({ [LEGACY_ENDLESS_KEYS[0]]: "坏了" }))).toBe(0);
    expect(readLegacyMeters(store({ [LEGACY_ENDLESS_KEYS[0]]: "-30" }))).toBe(0);
    expect(
      readLegacyMeters({
        getItem() {
          throw new Error("隐私模式");
        },
      }),
    ).toBe(0);
  });

  it("上报的成绩取三个来源的最大值,迁移只涨不降", () => {
    const rec = { meters: 500, coins: 12 };
    expect(bestEndlessMeters(rec, 0, 0)).toBe(500);
    expect(bestEndlessMeters(rec, 800, 0)).toBe(800);
    expect(bestEndlessMeters(rec, 0, 900)).toBe(900);
    expect(bestEndlessMeters(rec, 800, 900)).toBe(900);
    // 平台已经记着更高的,新一趟差一点也不会把它按下去
    expect(bestEndlessMeters({ meters: 10, coins: 0 }, 0, 1200)).toBe(1200);
    // 坏数据当 0
    expect(bestEndlessMeters({ meters: Number.NaN, coins: 0 }, -5, 0)).toBe(0);
  });
});

describe("彩虹跑跑 · 收藏册加成封顶", () => {
  const wild: CollectionEffects = {
    speedMul: 99,
    jumpMul: 99,
    magnetMul: 99,
    coinMul: 99,
    luckMul: 99,
    reviveOnce: true,
    startShieldMs: 999_999,
  };

  it("上限和收藏册自己承诺的 +35% 是同一个数", () => {
    expect(BOOST_CAP).toBeCloseTo(BONUS_CAP_PERMILLE / 1000, 10);
    expect(BOOST_CAP).toBeCloseTo(0.35, 10);
    expect(START_SHIELD_CAP_MS).toBe(START_SHIELD_MS_PER_LEVEL * MAX_LEVEL);
  });

  it("再离谱的加成也超不过上限", () => {
    const b = runnerBoosts(wild);
    for (const mul of [b.speedMul, b.magnetMul, b.coinMul, b.jumpMul]) {
      expect(mul).toBeLessThanOrEqual(1 + BOOST_CAP);
      expect(mul).toBeCloseTo(1 + BOOST_CAP, 10);
    }
    expect(b.startShieldMs).toBe(START_SHIELD_CAP_MS);
    expect(b.reviveOnce).toBe(true);
  });

  it("加成不倒扣:负数、NaN 都按「什么都没穿」算", () => {
    expect(clampBoost(0.4)).toBe(1);
    expect(clampBoost(-2)).toBe(1);
    expect(clampBoost(Number.NaN)).toBe(1);
    expect(clampBoost(1)).toBe(1);
    expect(clampBoost(1.1)).toBeCloseTo(1.1, 10);
  });

  it("什么都没穿的时候一切都是 1 倍,一点便宜都不占", () => {
    const b = neutralBoosts();
    expect(b).toEqual({
      speedMul: 1,
      magnetMul: 1,
      coinMul: 1,
      jumpMul: 1,
      reviveOnce: false,
      startShieldMs: 0,
    });
    expect(describeBoosts(b)).toBe("");
  });

  it("起步无敌的时长夹在 0 与上限之间,坏数据当 0", () => {
    const make = (ms: number): number => runnerBoosts({ ...wild, startShieldMs: ms }).startShieldMs;
    expect(make(0)).toBe(0);
    expect(make(-500)).toBe(0);
    expect(make(Number.NaN)).toBe(0);
    expect(make(1000)).toBe(1000);
    expect(make(START_SHIELD_CAP_MS + 5000)).toBe(START_SHIELD_CAP_MS);
  });

  it("开跑前那一行小字只说真的帮上忙的那几项", () => {
    const line = describeBoosts(runnerBoosts(wild));
    expect(line).toContain("速度 +35%");
    expect(line).toContain("摔倒接住一次");
    expect(line).toContain("起步无敌");
    const only = describeBoosts({ ...neutralBoosts(), coinMul: 1.2 });
    expect(only).toContain("糖果 +20%");
    expect(only).not.toContain("速度");
  });
});
