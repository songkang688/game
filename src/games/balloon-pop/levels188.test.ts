// 1.1：气球砰砰 99 → 188 的新天空、新机制与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, mulberry32, totalSize, TOTAL_LEVELS } from "../level99";
import {
  CHAPTERS,
  evalMathExpr,
  LEGACY_CHAPTER_SIZES,
  LEGACY_LEVELS,
  LEVELS,
  mathExprFor,
} from "./levels";

/** 前 99 关的「指纹」：任何一处生成参数被改动都会对不上 */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

const NEW_LEVELS = Array.from({ length: TOTAL_LEVELS - LEGACY_LEVELS }, (_, i) => LEGACY_LEVELS + i);

describe("气球砰砰 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：17/17/17/16/16/16", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 6).map((c) => c.name)).toEqual([
      "彩色广场", "颜色指令", "数字气球", "乌云闯入", "闪电风暴", "烟花之夜",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
    expect(LEGACY_LEVELS).toBe(99);
  });

  it("前 99 关每关参数一笔未改（生成指纹回归）", () => {
    expect(fnv(JSON.stringify(LEVELS.slice(0, 99)))).toBe("a66b6852");
  });

  it("前 99 关一律没有任何 1.1 新机制字段", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(lv.chainChance).toBeUndefined();
      expect(lv.shieldChance).toBeUndefined();
      expect(lv.wind).toBeUndefined();
      expect(lv.windFlipMs).toBeUndefined();
      expect(lv.mode).not.toBe("math");
    }
  });
});

describe("气球砰砰 · 1.1 新天空", () => {
  it("总关数 188，末尾追加了 4 片全新天空共 89 关", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    const fresh = CHAPTERS.slice(6);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(totalSize(fresh)).toBe(89);
    expect(fresh.map((c) => c.name)).toEqual(["连锁峡谷", "护盾高原", "算式云梯", "镜风山口"]);
  });

  it("新天空文案齐全，且不含任何英文商标字样", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.name).not.toMatch(/[A-Za-z]/);
      expect(ch.desc).not.toMatch(/[A-Za-z]/);
    }
  });

  it("四片新天空的机制各不相同：连锁 / 护盾 / 算式 / 镜风", () => {
    // 连锁峡谷：全章都有连锁气球
    for (let lv = 99; lv < 122; lv++) expect(LEVELS[lv].chainChance ?? 0).toBeGreaterThan(0);
    // 护盾高原：全章都有护盾气球
    for (let lv = 122; lv < 144; lv++) expect(LEVELS[lv].shieldChance ?? 0).toBeGreaterThan(0);
    // 算式云梯：全章都是算式玩法
    for (let lv = 144; lv < 166; lv++) expect(LEVELS[lv].mode).toBe("math");
    // 镜风山口：全章都有翻面的风
    for (let lv = 166; lv < 188; lv++) {
      expect(LEVELS[lv].wind ?? 0).toBeGreaterThan(0);
      expect(LEVELS[lv].windFlipMs ?? 0).toBeGreaterThan(0);
    }
    // 前三章互不越界：算式章之外没有 math，镜风章之外没有风
    for (const lv of NEW_LEVELS) {
      const ci = chapterOf(CHAPTERS, lv);
      if (ci !== 8) expect(LEVELS[lv].mode).not.toBe("math");
      if (ci !== 9) expect(LEVELS[lv].wind).toBeUndefined();
    }
  });

  it("第 100–188 关逐关参数可玩：目标、容错、节奏都有上下界", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      expect(cfg.target).toBeGreaterThanOrEqual(10);
      expect(cfg.target).toBeLessThanOrEqual(40);
      expect(cfg.escapes).toBeGreaterThanOrEqual(5);
      expect(cfg.spawnMs).toBeGreaterThanOrEqual(560);
      expect(cfg.riseSpeed).toBeGreaterThanOrEqual(50);
      expect(cfg.riseSpeed).toBeLessThanOrEqual(120);
      expect((cfg.chainChance ?? 0)).toBeLessThanOrEqual(0.25);
      expect((cfg.shieldChance ?? 0)).toBeLessThanOrEqual(0.45);
      expect(cfg.cloudChance + cfg.rainbowChance + (cfg.chainChance ?? 0)).toBeLessThanOrEqual(0.4);
      if (cfg.wind !== undefined) {
        expect(cfg.wind).toBeLessThanOrEqual(20);
        expect(cfg.windFlipMs ?? 0).toBeGreaterThanOrEqual(1500);
      }
    }
  });

  it("算式云梯的容错更宽：可飘走数不小于其他新章", () => {
    for (let lv = 144; lv < 166; lv++) {
      expect(LEVELS[lv].escapes).toBeGreaterThanOrEqual(6);
    }
  });

  it("新章内部难度递进：目标更多、飞得更快、出球更密", () => {
    const starts = [99, 122, 144, 166];
    const ends = [121, 143, 165, 187];
    starts.forEach((s, i) => {
      const e = ends[i];
      expect(LEVELS[s].target).toBeLessThanOrEqual(LEVELS[e].target);
      expect(LEVELS[s].riseSpeed).toBeLessThan(LEVELS[e].riseSpeed);
      expect(LEVELS[s].spawnMs).toBeGreaterThan(LEVELS[e].spawnMs);
    });
  });
});

describe("气球砰砰 · 算式云梯逐题可解", () => {
  it("得数 1..9 的口算题算出来恰好是它自己（200 组随机种子）", () => {
    for (let value = 1; value <= 9; value++) {
      for (let seed = 0; seed < 200; seed++) {
        const expr = mathExprFor(value, mulberry32(seed * 31 + value));
        expect(expr).toMatch(/^\d+[+\-×÷]\d+$/);
        expect(evalMathExpr(expr)).toBe(value);
      }
    }
  });

  it("口算题的操作数都在两位数以内（口算量级）", () => {
    for (let value = 1; value <= 5; value++) {
      for (let seed = 0; seed < 100; seed++) {
        const expr = mathExprFor(value, mulberry32(seed * 17 + value));
        const m = /^(\d+)[+\-×÷](\d+)$/.exec(expr);
        expect(m).not.toBeNull();
        expect(Number(m![1])).toBeLessThanOrEqual(99);
        expect(Number(m![2])).toBeLessThanOrEqual(99);
      }
    }
  });

  it("同一串随机数生成同一道题（确定性），求值器拒绝乱码", () => {
    const a = mathExprFor(4, mulberry32(2024));
    const b = mathExprFor(4, mulberry32(2024));
    expect(a).toBe(b);
    expect(evalMathExpr("香蕉+苹果")).toBeNaN();
    expect(evalMathExpr("3?4")).toBeNaN();
  });

  it("四种运算都出得来（加减乘除全覆盖）", () => {
    const ops = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const expr = mathExprFor(4, mulberry32(seed));
      ops.add(expr.replace(/\d+/g, ""));
    }
    expect(ops).toEqual(new Set(["+", "-", "×", "÷"]));
  });
});
