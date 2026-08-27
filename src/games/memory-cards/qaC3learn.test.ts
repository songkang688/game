// 档C · 第 3 轮学习优化员 · L3-02:记忆翻翻乐的无尽从第 34 轮延到第 42 轮。
//
// 第 2 轮把 alien-seek / box-hamster / snake-snack 三款的「无尽后段冻住」收干净了,
// 收官时回头看这张表,memory-cards 是**到顶最早**的那一款:
// 组数第 8 轮封顶、转牌阵第 32 轮到底、挪窝第 34 轮到底,第 35 轮起就是换个配色。
//
// 改法沿用同一条套路:**前面一个数都不动**,再从这一款手上还没用完的余量里挑一样接上。
// 挑的是独苗卡——第 9 章「幻影干扰卡」验证过的老机关,只多一两张牌(5 列摆 23 张是 5 行,
// 360px 上每张还有 64px),却把「记住位置」变成「记住位置 + 认出那张假的」。
import { describe, expect, it } from "vitest";
import { THEME_PACKS } from "./art";
import {
  CARD_MIN_W,
  ENDLESS_DECOY_FROM,
  ENDLESS_MAX_DECOYS,
  ENDLESS_MAX_MISS,
  ENDLESS_MAX_PAIRS,
  ENDLESS_PEAK_ROUND,
  ENDLESS_ROTATE_FROM,
  ENDLESS_SWAP_FROM,
  buildDeck,
  cardWidthAt,
  deckSize,
  endlessDecoys,
  endlessDifficulty,
  endlessLevel,
  endlessPairs,
  endlessTwist,
  groupMatches,
  hitDecoy,
} from "./logic";

const PACKS = THEME_PACKS.length;

function rowsOf(cols: number, cards: number): number {
  return Math.ceil(cards / Math.max(1, cols));
}

describe("档C R3 学习优化 · L3-02 无尽曲线延到第 42 轮", () => {
  it("前 29 轮一张独苗卡都没有 —— 老玩家的手感一点没动", () => {
    for (let r = 1; r < ENDLESS_DECOY_FROM; r++) {
      expect(endlessDecoys(r), `第 ${r} 轮冒出了独苗卡`).toBe(0);
      expect(endlessLevel(r, PACKS).decoys, `第 ${r} 轮`).toBeUndefined();
    }
    expect(endlessDecoys(ENDLESS_DECOY_FROM)).toBe(1);
  });

  it("独苗卡每 6 轮多一张,3 张封顶,而且只增不减", () => {
    for (let r = 1; r <= 300; r++) {
      expect(endlessDecoys(r), `第 ${r} 轮`).toBeGreaterThanOrEqual(endlessDecoys(r - 1));
      expect(endlessDecoys(r)).toBeLessThanOrEqual(ENDLESS_MAX_DECOYS);
    }
    expect(endlessDecoys(ENDLESS_DECOY_FROM + 6)).toBe(2);
    expect(endlessDecoys(ENDLESS_PEAK_ROUND)).toBe(ENDLESS_MAX_DECOYS);
    expect(endlessDecoys(999)).toBe(ENDLESS_MAX_DECOYS);
  });

  it("难度分接着往上走:第 34 轮不再是终点,第 42 轮才是", () => {
    expect(ENDLESS_PEAK_ROUND).toBe(42);
    expect(endlessDifficulty(42)).toBeGreaterThan(endlessDifficulty(34));
    expect(endlessDifficulty(36)).toBeGreaterThan(endlessDifficulty(30));
    for (let r = 2; r <= 300; r++) {
      expect(endlessDifficulty(r), `第 ${r} 轮反而更简单`).toBeGreaterThanOrEqual(
        endlessDifficulty(r - 1)
      );
    }
    // 到顶之后老老实实是同一个分数(是天花板,不是忘了继续加)
    const peak = endlessDifficulty(ENDLESS_PEAK_ROUND);
    for (const r of [ENDLESS_PEAK_ROUND, ENDLESS_PEAK_ROUND + 1, 100, 999]) {
      expect(endlessDifficulty(r), `第 ${r} 轮`).toBe(peak);
    }
  });

  it("到顶之前不会连着 10 轮一动不动", () => {
    for (let r = 1; r + 10 <= ENDLESS_PEAK_ROUND; r++) {
      expect(endlessDifficulty(r + 10), `第 ${r} 轮到第 ${r + 10} 轮完全没变`).toBeGreaterThan(
        endlessDifficulty(r)
      );
    }
  });

  it("机关是一样一样接上的:挪窝 → 转牌阵 → 独苗卡", () => {
    expect(ENDLESS_SWAP_FROM).toBeLessThan(ENDLESS_ROTATE_FROM);
    expect(ENDLESS_ROTATE_FROM).toBeLessThan(ENDLESS_DECOY_FROM);
    // 独苗卡上场的时候,前两样已经在场上了
    const cfg = endlessLevel(ENDLESS_DECOY_FROM, PACKS);
    expect(cfg.swapEvery).toBeGreaterThan(0);
    expect(cfg.rotateEvery).toBeGreaterThan(0);
    expect(cfg.decoys).toBe(1);
  });

  it("加了独苗卡之后 360px 照样摆得下:每张牌都不窄于 56px", () => {
    for (let r = 1; r <= 300; r++) {
      const cfg = endlessLevel(r, PACKS);
      const cards = deckSize(cfg);
      expect(cards, `第 ${r} 轮的牌太多`).toBeLessThanOrEqual(ENDLESS_MAX_PAIRS * 2 + ENDLESS_MAX_DECOYS);
      const w = cardWidthAt(360, cfg.cols, rowsOf(cfg.cols, cards));
      expect(w, `第 ${r} 轮在 360px 上每张牌只剩 ${w}px`).toBeGreaterThanOrEqual(CARD_MIN_W);
      // 5 列 23 张正好 5 行,再多就该滚屏了
      expect(rowsOf(cfg.cols, cards), `第 ${r} 轮排了太多行`).toBeLessThanOrEqual(5);
    }
  });

  it("独苗卡是真的独苗:发出来的牌里它没有同伴,配也配不上", () => {
    for (const r of [ENDLESS_DECOY_FROM, 36, 42, 80]) {
      const cfg = endlessLevel(r, PACKS);
      const deck = buildDeck(cfg, 7000 + r);
      expect(deck, `第 ${r} 轮牌数不对`).toHaveLength(deckSize(cfg));
      const decoys = deck.map((c, i) => ({ c, i })).filter(({ c }) => c.decoy);
      expect(decoys, `第 ${r} 轮的独苗卡张数不对`).toHaveLength(endlessDecoys(r));
      for (const { c, i } of decoys) {
        expect(deck.filter((o) => o.group === c.group), `第 ${r} 轮的独苗卡有同伴`).toHaveLength(1);
        const real = deck.findIndex((o) => !o.decoy);
        expect(groupMatches(deck, [i, real])).toBe(false);
        expect(hitDecoy(deck, [real, i])).toBe(i);
      }
      // 正牌照样两两成组,配得上
      const real = deck.findIndex((o) => !o.decoy);
      const same = deck.map((_o, k) => k).filter((k) => deck[k].group === deck[real].group);
      expect(same).toHaveLength(2);
      expect(groupMatches(deck, same)).toBe(true);
    }
  });

  it("组数、失误额度、列数一个都没被带歪", () => {
    for (let r = 1; r <= 300; r++) {
      const cfg = endlessLevel(r, PACKS);
      expect(cfg.pairs, `第 ${r} 轮的组数`).toBe(endlessPairs(r));
      expect(cfg.pairs).toBeLessThanOrEqual(ENDLESS_MAX_PAIRS);
      expect(cfg.maxMiss, `第 ${r} 轮的失误额度`).toBeGreaterThan(ENDLESS_MAX_MISS);
      expect(cfg.cols).toBeLessThanOrEqual(5);
      expect(cfg.matchSize).toBe(2);
      const { rotateEvery, swapEvery } = endlessTwist(r);
      expect(cfg.rotateEvery ?? 0).toBe(rotateEvery);
      expect(cfg.swapEvery ?? 0).toBe(swapEvery);
    }
  });

  it("轮号越界不会算出负数或者 NaN", () => {
    for (const r of [-99, -1, 0, 0.4]) {
      expect(endlessDecoys(r), `第 ${r} 轮`).toBe(0);
      expect(Number.isFinite(endlessDifficulty(r))).toBe(true);
      expect(endlessDifficulty(r)).toBe(endlessDifficulty(1));
    }
  });
});
