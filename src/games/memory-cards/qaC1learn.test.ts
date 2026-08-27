// 窗口 4 · QA 档C · 第 1 轮学习优化员:记忆翻翻乐两条落地改进的覆盖测试。
//
// L1-03 无尽牌数封顶(第 8 轮 10 组)之后接上「不加牌」的机关,曲线不再走平。
// L1-04 endlessCols 里那个两个分支一模一样的三目改成写实的上限常量。
import { describe, expect, it } from "vitest";
import { THEME_PACKS } from "./art";
import { type MemoryLevel } from "./levels";
import {
  CARD_MIN_W,
  ENDLESS_MAX_COLS,
  ENDLESS_MAX_PAIRS,
  ENDLESS_ROTATE_FROM,
  ENDLESS_SWAP_FROM,
  boardGap,
  buildDeck,
  cardWidthAt,
  deckSize,
  endlessCols,
  endlessDifficulty,
  endlessLevel,
  endlessPairs,
  endlessTwist,
  rotatePositions,
} from "./logic";

/** 一轮的「题面」——只看会影响难度的字段,配色不算 */
const shape = (c: MemoryLevel): string =>
  JSON.stringify([c.pairs, c.cols, c.matchSize, c.decoys ?? 0, c.rotateEvery ?? 0, c.swapEvery ?? 0]);

describe("档C R1 学习优化 · L1-03 无尽封顶之后接着变难", () => {
  it("难度分从第 1 轮到第 40 轮一路不降,而且中间没有连着 8 轮踏步", () => {
    let flat = 0;
    for (let r = 2; r <= 40; r++) {
      const prev = endlessDifficulty(r - 1);
      const now = endlessDifficulty(r);
      expect(now, `第 ${r} 轮比上一轮还简单`).toBeGreaterThanOrEqual(prev);
      flat = now > prev ? 0 : flat + 1;
      expect(flat, `第 ${r} 轮之前已经连着 ${flat} 轮没变难`).toBeLessThan(8);
    }
  });

  it("改之前第 8 轮和第 99 轮是同一道题,现在不是了", () => {
    expect(endlessPairs(8)).toBe(ENDLESS_MAX_PAIRS);
    expect(endlessPairs(99)).toBe(ENDLESS_MAX_PAIRS);
    expect(shape(endlessLevel(8, 6))).not.toBe(shape(endlessLevel(99, 6)));
  });

  it("接上来的两样机关都是「先慢后快」,而且各自有下限", () => {
    for (let r = 1; r <= 200; r++) {
      const { rotateEvery, swapEvery } = endlessTwist(r);
      if (r < ENDLESS_SWAP_FROM) expect(swapEvery, `第 ${r} 轮不该有挪窝`).toBe(0);
      else {
        expect(swapEvery).toBeLessThanOrEqual(14000);
        // 8 秒是战役终极厅同一个下限:再勤一点孩子就来不及翻完一组
        expect(swapEvery, `第 ${r} 轮挪得太勤`).toBeGreaterThanOrEqual(8000);
      }
      if (r < ENDLESS_ROTATE_FROM) expect(rotateEvery, `第 ${r} 轮不该转`).toBe(0);
      else {
        expect(rotateEvery).toBeLessThanOrEqual(9);
        // 一组两张,至少留 4 翻才不会「刚翻开一张就被转走」
        expect(rotateEvery, `第 ${r} 轮转得太勤`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("机关是一样一样上的,不会开局就三件套糊脸", () => {
    for (let r = 1; r < ENDLESS_SWAP_FROM; r++) {
      const cfg = endlessLevel(r, THEME_PACKS.length);
      expect(cfg.swapEvery ?? 0, `第 ${r} 轮`).toBe(0);
      expect(cfg.rotateEvery ?? 0, `第 ${r} 轮`).toBe(0);
    }
    const first = endlessLevel(ENDLESS_SWAP_FROM, THEME_PACKS.length);
    expect(first.swapEvery).toBeGreaterThan(0);
    expect(first.rotateEvery ?? 0).toBe(0);
    const both = endlessLevel(ENDLESS_ROTATE_FROM, THEME_PACKS.length);
    expect(both.swapEvery).toBeGreaterThan(0);
    expect(both.rotateEvery).toBeGreaterThan(0);
  });

  it("机关只加难度不加牌:任何一轮都还是 ≤10 组 20 张、≤5 列", () => {
    for (let r = 1; r <= 200; r++) {
      const cfg = endlessLevel(r, THEME_PACKS.length);
      expect(cfg.pairs).toBeLessThanOrEqual(ENDLESS_MAX_PAIRS);
      expect(deckSize(cfg), `第 ${r} 轮的牌数`).toBeLessThanOrEqual(ENDLESS_MAX_PAIRS * 2);
      expect(cfg.cols).toBeLessThanOrEqual(ENDLESS_MAX_COLS);
      expect(cfg.decoys ?? 0, `第 ${r} 轮不该混独苗卡`).toBe(0);
      // 三次机会由外面统管,单轮不许先判负
      expect(cfg.maxMiss).toBeGreaterThan(3);
      expect(cfg.timeLimit).toBe(0);
    }
  });

  it("加了机关的那些轮在 360px 上照样摆得开、点得准", () => {
    for (const r of [1, 9, 10, 16, 24, 40, 99]) {
      const cfg = endlessLevel(r, THEME_PACKS.length);
      const w = cardWidthAt(360, cfg.cols, boardGap(cfg.cols));
      expect(w, `第 ${r} 轮的牌宽 ${w}`).toBeGreaterThanOrEqual(CARD_MIN_W);
    }
  });

  it("会转的那几轮转到底也不会弄丢牌、不会把牌叠在一起", () => {
    for (const r of [ENDLESS_ROTATE_FROM, 24, 40, 99]) {
      const cfg = endlessLevel(r, THEME_PACKS.length);
      const n = deckSize(cfg);
      const gone = new Array<boolean>(n).fill(false);
      let order = Array.from({ length: n }, (_, i) => i);
      for (let k = 0; k < n * 2 + 3; k++) {
        order = rotatePositions(order, gone);
        expect(order.length, `第 ${r} 轮转第 ${k + 1} 次少牌了`).toBe(n);
        expect(new Set(order).size, `第 ${r} 轮转第 ${k + 1} 次有牌叠一起了`).toBe(n);
      }
    }
  });

  it("发牌不受机关影响:每一轮的牌都还是两两成双、没有落单的", () => {
    for (const r of [1, 8, 10, 16, 30, 77]) {
      const cfg = endlessLevel(r, THEME_PACKS.length);
      const deck = buildDeck(cfg, 9000 + r);
      const count = new Map<number, number>();
      for (const c of deck) {
        if (c.decoy) continue;
        count.set(c.group, (count.get(c.group) ?? 0) + 1);
      }
      expect(count.size, `第 ${r} 轮的组数`).toBe(cfg.pairs);
      for (const [g, n] of count) expect(n, `第 ${r} 轮第 ${g} 组只有 ${n} 张`).toBe(cfg.matchSize);
    }
  });

  it("轮号是 0、负数、小数也不会算出奇怪的机关", () => {
    for (const r of [-5, 0, 0.4, 1]) {
      const { rotateEvery, swapEvery } = endlessTwist(r);
      expect(rotateEvery).toBe(0);
      expect(swapEvery).toBe(0);
      expect(endlessDifficulty(r)).toBeGreaterThan(0);
    }
  });
});

describe("档C R1 学习优化 · L1-04 列数上限写实", () => {
  it("列数只有 4 和 5 两种,上限就是常量本身", () => {
    expect(ENDLESS_MAX_COLS).toBe(5);
    const seen = new Set<number>();
    for (let p = 1; p <= 40; p++) {
      const c = endlessCols(p);
      expect(c).toBeLessThanOrEqual(ENDLESS_MAX_COLS);
      seen.add(c);
    }
    expect([...seen].sort()).toEqual([4, 5]);
  });

  it("分界点还在老地方:8 张以内 4 列,再多就 5 列", () => {
    expect(endlessCols(4)).toBe(4);
    expect(endlessCols(5)).toBe(ENDLESS_MAX_COLS);
    for (let p = 8; p <= 30; p++) expect(endlessCols(p)).toBe(ENDLESS_MAX_COLS);
  });

  it("5 列是 360px 摆得下的极限,6 列就戳不准了", () => {
    expect(cardWidthAt(360, ENDLESS_MAX_COLS, boardGap(ENDLESS_MAX_COLS))).toBeGreaterThanOrEqual(
      CARD_MIN_W
    );
    expect(cardWidthAt(360, 6, boardGap(6))).toBeLessThan(CARD_MIN_W);
  });
});
