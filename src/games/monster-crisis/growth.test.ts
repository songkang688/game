/**
 * 小怪物危机 1.2 · 关内成长「三选一」。
 *
 * 守两件事:抽卡这件事必须**可复现**且**同一次不出重复**,
 * 五张卡必须**互相搭台**而不是一条路线碾压(数值换算是纯函数,直接算给你看)。
 */
import { describe, expect, it } from "vitest";
import {
  GROWTH_CARDS,
  GROWTH_IDS,
  type GrowthState,
  HERO_BASE,
  applyGrowth,
  availableCards,
  cardWeight,
  emptyGrowth,
  growthBadges,
  growthSeed,
  heroStats,
  rollGrowth,
  shouldOfferGrowth,
} from "./growth";

function maxed(): GrowthState {
  const s = emptyGrowth();
  for (const id of GROWTH_IDS) s[id] = GROWTH_CARDS[id].max;
  return s;
}

describe("三选一卡池", () => {
  it("默认抽三张,而且同一次绝不出重复", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const cards = rollGrowth(seed, emptyGrowth());
      expect(cards).toHaveLength(3);
      expect(new Set(cards.map((c) => c.id)).size).toBe(3);
    }
  });

  it("同一个种子抽出来永远是同一副牌(可回放)", () => {
    const a = rollGrowth(4242, emptyGrowth()).map((c) => c.id);
    const b = rollGrowth(4242, emptyGrowth()).map((c) => c.id);
    expect(a).toEqual(b);
  });

  it("换个种子会抽出不一样的组合(不是写死的三张)", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      seen.add(
        rollGrowth(seed, emptyGrowth())
          .map((c) => c.id)
          .join("|")
      );
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it("叠满的卡退出卡池,全叠满就一张都不发", () => {
    const some = emptyGrowth();
    some.rapid = GROWTH_CARDS.rapid.max;
    for (let seed = 1; seed <= 80; seed++) {
      expect(rollGrowth(seed, some).some((c) => c.id === "rapid")).toBe(false);
    }
    expect(availableCards(maxed())).toHaveLength(0);
    expect(rollGrowth(7, maxed())).toEqual([]);
  });

  it("卡池只剩两张时就发两张,不会硬凑出重复的第三张", () => {
    const nearly = maxed();
    nearly.range = 0;
    nearly.shield = 0;
    const cards = rollGrowth(9, nearly);
    expect(cards.map((c) => c.id).sort()).toEqual(["range", "shield"]);
  });

  it("稀有度真的影响出现频率:常见的比稀有的多得多", () => {
    let common = 0;
    let rare = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const first = rollGrowth(seed, emptyGrowth())[0];
      if (first.rarity === 1) common++;
      if (first.rarity === 3) rare++;
    }
    expect(cardWeight(1)).toBeGreaterThan(cardWeight(3));
    expect(common).toBeGreaterThan(rare * 2);
  });

  it("每 3 波发一次,别的波次不发", () => {
    expect(shouldOfferGrowth(0)).toBe(false);
    expect([1, 2, 4, 5, 7, 8].every((n) => !shouldOfferGrowth(n))).toBe(true);
    expect([3, 6, 9, 12, 30].every((n) => shouldOfferGrowth(n))).toBe(true);
  });

  it("同一局里每一次三选一的种子都不一样", () => {
    const seeds = new Set<number>();
    for (let i = 0; i < 12; i++) seeds.add(growthSeed(2024, i));
    expect(seeds.size).toBe(12);
  });
});

describe("成长 → 手感", () => {
  it("吃卡是纯函数:原来的状态一个字都不动", () => {
    const before = emptyGrowth();
    const after = applyGrowth(before, "rapid");
    expect(before.rapid).toBe(0);
    expect(after.rapid).toBe(1);
  });

  it("叠满之后再吃同一张不会超过上限", () => {
    let s = emptyGrowth();
    for (let i = 0; i < 9; i++) s = applyGrowth(s, "multi");
    expect(s.multi).toBe(GROWTH_CARDS.multi.max);
  });

  it("五张卡各管各的一件事,不会互相顶掉", () => {
    const s = applyGrowth(applyGrowth(applyGrowth(emptyGrowth(), "range"), "rapid"), "multi");
    const st = heroStats(s);
    expect(st.reach).toBeGreaterThan(HERO_BASE.reach);
    expect(st.reload).toBeLessThan(HERO_BASE.reload);
    expect(st.shots).toBe(HERO_BASE.shots + 1);
    // 没吃的那两张一点没变
    expect(st.magnet).toBe(HERO_BASE.magnet);
    expect(st.shields).toBe(0);
  });

  it("护盾泡与吸吸糖叠层数,数值跟着涨", () => {
    let s = emptyGrowth();
    s = applyGrowth(applyGrowth(s, "shield"), "shield");
    s = applyGrowth(s, "magnet");
    const st = heroStats(s);
    expect(st.shields).toBe(2);
    expect(st.magnet).toBeGreaterThan(HERO_BASE.magnet);
  });

  it("顶上那一行成长图标只显示吃过的卡", () => {
    const s = applyGrowth(applyGrowth(emptyGrowth(), "rapid"), "rapid");
    const badges = growthBadges(s);
    expect(badges).toHaveLength(1);
    expect(badges[0]).toContain("2");
    expect(growthBadges(emptyGrowth())).toEqual([]);
  });

  it("每张卡都写了图标和一句孩子看得懂的说明", () => {
    for (const id of GROWTH_IDS) {
      const card = GROWTH_CARDS[id];
      expect(card.emoji.length).toBeGreaterThan(0);
      expect(card.name.length).toBeGreaterThanOrEqual(2);
      expect(card.desc.length).toBeGreaterThan(8);
      // 分级红线:说明里不许出现伤害 / 攻击这类字眼
      expect(/伤害|攻击|杀|死|血/.test(card.desc)).toBe(false);
    }
  });
});
