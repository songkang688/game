// 1.1：记忆翻翻乐 99 → 188 的新主题、新机制与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, totalSize, TOTAL_LEVELS } from "../level99";
import {
  CHAPTERS,
  LEGACY_CHAPTER_SIZES,
  LEGACY_LEVELS,
  LEVELS,
  THEME_EMOJIS,
} from "./levels";
// 1.2：发牌 / 算式 / 旋转 / 可解性都搬到了 logic.ts，断言一条没动
import {
  buildDeck,
  buildMathPairs,
  deckSeed,
  deckSize,
  estimateSeconds,
  evalExpr,
  rotatePositions,
  simulatePerfectPlay,
} from "./logic";

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
/** 四个新章的关号区间（0 基，含头不含尾） */
const CH = { math: [99, 122], spin: [122, 144], ghost: [144, 166], final: [166, 188] } as const;
/** 每关都按几个不同的发牌种子验一遍，免得只有某一副牌恰好过得去 */
const SEEDS = [0, 1, 2, 17, 233];

describe("记忆翻翻乐 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：17/17/17/16/16/16", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 6).map((c) => c.name)).toEqual([
      "动物乐园", "水果集市", "海底世界", "太空基地", "玩具小屋", "魔法城堡",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
    expect(LEGACY_LEVELS).toBe(99);
  });

  it("前 99 关每关参数一笔未改（生成指纹回归）", () => {
    expect(fnv(JSON.stringify(LEVELS.slice(0, 99)))).toBe("49574637");
  });

  it("前六套主题表情与 1.0 一模一样", () => {
    expect(fnv(JSON.stringify(THEME_EMOJIS.slice(0, 6)))).toBe("bc28fee");
    expect(THEME_EMOJIS.slice(0, 6).every((pool) => pool.length === 12)).toBe(true);
  });

  it("前 99 关一律不带任何 1.1 新机制字段", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(lv.mathPairs).toBeUndefined();
      expect(lv.mathHard).toBeUndefined();
      expect(lv.rotateEvery).toBeUndefined();
      expect(lv.decoys).toBeUndefined();
    }
  });

  it("老存档（长度 99 的数组）读出来前 99 位原样不动", () => {
    const old = Array.from({ length: 99 }, (_, i) => (i % 4) as 0 | 1 | 2 | 3);
    const grown = old.concat(new Array(TOTAL_LEVELS - old.length).fill(0));
    expect(grown).toHaveLength(188);
    expect(grown.slice(0, 99)).toEqual(old);
  });
});

describe("记忆翻翻乐 · 1.1 四个新主题", () => {
  it("总共 188 关，四个新章名字与关数都对得上", () => {
    expect(LEVELS).toHaveLength(188);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(CHAPTERS).toHaveLength(10);
    expect(CHAPTERS.slice(6).map((c) => c.name)).toEqual([
      "算式配对屋", "旋转木马厅", "幻影干扰卡", "星海终极厅",
    ]);
    expect(CHAPTERS.slice(6).reduce((a, c) => a + c.size, 0)).toBe(89);
  });

  it("每个新章都能按关号找回自己（章节索引连得上）", () => {
    expect(chapterOf(CHAPTERS, CH.math[0])).toBe(6);
    expect(chapterOf(CHAPTERS, CH.spin[0])).toBe(7);
    expect(chapterOf(CHAPTERS, CH.ghost[0])).toBe(8);
    expect(chapterOf(CHAPTERS, CH.final[0])).toBe(9);
    expect(chapterOf(CHAPTERS, 187)).toBe(9);
  });

  it("四套新主题表情各 16 个、彼此不撞、也不和 1.0 的六套重样", () => {
    expect(THEME_EMOJIS).toHaveLength(10);
    for (const pool of THEME_EMOJIS.slice(6)) {
      expect(pool).toHaveLength(16);
      expect(new Set(pool).size).toBe(16);
    }
    const names = CHAPTERS.map((c) => c.name);
    expect(new Set(names).size).toBe(10);
  });

  it("新章的文案既不低幼也不带任何商标或官方角色名", () => {
    const banned = ["宝宝", "乖乖", "TM", "®", "™", "迪士尼", "奥特曼", "小猪佩奇", "皮卡丘", "愤怒的小鸟"];
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.desc.length).toBeGreaterThanOrEqual(10);
      for (const b of banned) expect(ch.desc + ch.name).not.toContain(b);
    }
  });

  it("四章各有各的机关，不是同一个模板换皮", () => {
    // 算式配对屋：整章都是「算式 = 得数」
    for (let i = CH.math[0]; i < CH.math[1]; i++) expect(LEVELS[i].mathPairs).toBe(true);
    // 旋转木马厅：整章都会整体转
    for (let i = CH.spin[0]; i < CH.spin[1]; i++) {
      expect(LEVELS[i].rotateEvery ?? 0).toBeGreaterThanOrEqual(4);
      expect(LEVELS[i].mathPairs).toBeUndefined();
    }
    // 幻影干扰卡：整章都混着独苗卡
    for (let i = CH.ghost[0]; i < CH.ghost[1]; i++) {
      expect(LEVELS[i].decoys ?? 0).toBeGreaterThanOrEqual(1);
      expect(LEVELS[i].rotateEvery).toBeUndefined();
    }
    // 星海终极厅：三种机关混着来，且至少各出现过一次
    const last = LEVELS.slice(CH.final[0], CH.final[1]);
    expect(last.some((lv) => lv.matchSize === 3)).toBe(true);
    expect(last.some((lv) => lv.mathPairs)).toBe(true);
    expect(last.some((lv) => (lv.decoys ?? 0) > 0 && (lv.rotateEvery ?? 0) > 0)).toBe(true);
  });

  it("难度是往上走的：越往后组数越多、算式越难、独苗卡越多", () => {
    expect(LEVELS[CH.math[0]].pairs).toBeLessThan(LEVELS[CH.math[1] - 1].pairs);
    expect(LEVELS[CH.math[0]].mathHard ?? 0).toBeLessThan(LEVELS[CH.math[1] - 1].mathHard ?? 0);
    expect(LEVELS[CH.spin[0]].pairs).toBeLessThan(LEVELS[CH.spin[1] - 1].pairs);
    // 转得越来越勤（间隔越来越短）
    expect(LEVELS[CH.spin[1] - 1].rotateEvery ?? 9).toBeLessThanOrEqual(LEVELS[CH.spin[0]].rotateEvery ?? 0);
    expect(LEVELS[CH.ghost[0]].decoys ?? 0).toBeLessThan(LEVELS[CH.ghost[1] - 1].decoys ?? 0);
  });
});

describe("记忆翻翻乐 · 新机制一：算式配对", () => {
  it("生成的每道算式都算得出来，且和它的得数对得上", () => {
    for (const hard of [0, 1, 2]) {
      const pairs = buildMathPairs(20250826 + hard, 12, hard);
      expect(pairs).toHaveLength(12);
      for (const p of pairs) {
        expect(evalExpr(p.expr)).toBe(p.value);
        expect(Number.isInteger(p.value)).toBe(true);
        expect(p.value).toBeGreaterThan(0);
      }
    }
  });

  it("同一副牌里得数两两不同，绝不会出现一张得数配得上两道算式", () => {
    for (let seed = 0; seed < 40; seed++) {
      const pairs = buildMathPairs(seed, 14, seed % 3);
      expect(new Set(pairs.map((p) => p.value)).size).toBe(pairs.length);
    }
  });

  it("难度分档：入门只有二十以内加减，最难档才出两位数与乘除", () => {
    const easy = buildMathPairs(7, 20, 0);
    for (const p of easy) {
      expect(p.expr).toMatch(/^\d+[+\-]\d+$/);
      expect(p.value).toBeLessThanOrEqual(20);
    }
    const hard = buildMathPairs(7, 20, 2);
    expect(hard.some((p) => /[×÷]/.test(p.expr))).toBe(true);
    expect(hard.some((p) => p.value > 20)).toBe(true);
  });

  it("看不懂的式子不硬算，除数是 0 也不会算出个怪数", () => {
    expect(Number.isNaN(evalExpr("三加五"))).toBe(true);
    expect(Number.isNaN(evalExpr("6÷0"))).toBe(true);
    expect(evalExpr("12+7")).toBe(19);
    expect(evalExpr("30÷6")).toBe(5);
  });

  it("要多少组就发多少组，一组都不会少", () => {
    for (const n of [1, 5, 12, 20]) {
      expect(buildMathPairs(99, n, 0)).toHaveLength(n);
    }
    expect(buildMathPairs(99, 0, 0)).toHaveLength(0);
  });
});

describe("记忆翻翻乐 · 新机制二：牌阵整体旋转", () => {
  it("转一圈牌一张不多一张不少，只是换了位置", () => {
    const order = [0, 1, 2, 3, 4, 5];
    const gone = new Array(6).fill(false);
    const next = rotatePositions(order, gone, 1);
    expect(next.slice().sort((a, b) => a - b)).toEqual(order);
    expect(next).not.toEqual(order);
    expect(next).toEqual([5, 0, 1, 2, 3, 4]);
  });

  it("已经配掉的空位不参与旋转，剩下的牌互相顶上去", () => {
    const order = [0, 1, 2, 3, 4, 5];
    const gone = [false, true, false, true, false, false];
    const next = rotatePositions(order, gone, 1);
    // 空位（1 号槽、3 号槽）上的牌原地不动
    expect(next[1]).toBe(1);
    expect(next[3]).toBe(3);
    // 还在场上的四张牌整体挪了一格
    expect([next[0], next[2], next[4], next[5]]).toEqual([5, 0, 2, 4]);
  });

  it("转满一圈回到原样，剩一张牌时干脆不转", () => {
    const order = [0, 1, 2, 3];
    const gone = new Array(4).fill(false);
    let cur = order.slice();
    for (let k = 0; k < 4; k++) cur = rotatePositions(cur, gone, 1);
    expect(cur).toEqual(order);
    const only = rotatePositions([0, 1], [false, true], 1);
    expect(only).toEqual([0, 1]);
  });
});

describe("记忆翻翻乐 · 新机制三：干扰卡", () => {
  it("独苗卡数量对得上，而且真的没有同伴", () => {
    for (let i = CH.ghost[0]; i < CH.ghost[1]; i++) {
      const cfg = LEVELS[i];
      const deck = buildDeck(cfg, deckSeed(i));
      const decoys = deck.filter((c) => c.decoy);
      expect(decoys).toHaveLength(cfg.decoys ?? 0);
      for (const d of decoys) {
        expect(deck.filter((c) => c.face === d.face)).toHaveLength(1);
        expect(deck.filter((c) => c.group === d.group)).toHaveLength(1);
      }
    }
  });

  it("正牌永远刚好凑得成一组，多一张少一张都没有", () => {
    for (const i of NEW_LEVELS) {
      const cfg = LEVELS[i];
      for (const s of SEEDS) {
        const deck = buildDeck(cfg, deckSeed(i) + s);
        expect(deck).toHaveLength(deckSize(cfg));
        const byGroup = new Map<number, number>();
        for (const c of deck) {
          if (!c.decoy) byGroup.set(c.group, (byGroup.get(c.group) ?? 0) + 1);
        }
        expect(byGroup.size).toBe(cfg.pairs);
        for (const n of byGroup.values()) expect(n).toBe(cfg.matchSize);
      }
    }
  });

  it("同一关同一副牌：牌面固定，孩子重来一次不会换一套题", () => {
    const a = buildDeck(LEVELS[120], deckSeed(120));
    const b = buildDeck(LEVELS[120], deckSeed(120));
    expect(a).toEqual(b);
    expect(buildDeck(LEVELS[120], deckSeed(120) + 1)).not.toEqual(a);
  });
});

describe("记忆翻翻乐 · 第 100–188 关逐关可解（记性完美的孩子真跑一遍）", () => {
  it("每一关都能把所有组配完，且用不满失误额度", () => {
    const bad: string[] = [];
    for (const i of NEW_LEVELS) {
      const cfg = LEVELS[i];
      for (const s of SEEDS) {
        const est = simulatePerfectPlay(cfg, deckSeed(i) + s);
        // 记性完美也难免要试出生牌，失误额度必须还留有余量
        if (est.misses + 2 > cfg.maxMiss) bad.push(`${i + 1}(seed${s} 失误${est.misses}/${cfg.maxMiss})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("每一关的牌都摆得下：张数是一组的整数倍加独苗，行数不夸张", () => {
    for (const i of NEW_LEVELS) {
      const cfg = LEVELS[i];
      const n = deckSize(cfg);
      expect(n).toBe(cfg.pairs * cfg.matchSize + (cfg.decoys ?? 0));
      expect(n).toBeGreaterThanOrEqual(8);
      // 375×667 的窄屏：最多 5 列 6 行，再多就要挤出屏幕了
      expect(cfg.cols).toBeLessThanOrEqual(5);
      expect(Math.ceil(n / cfg.cols)).toBeLessThanOrEqual(6);
    }
  });

  it("限时关留得出时间：估算耗时比倒计时短一大截", () => {
    for (const i of NEW_LEVELS) {
      const cfg = LEVELS[i];
      if (cfg.timeLimit <= 0) continue;
      const est = simulatePerfectPlay(cfg, deckSeed(i));
      expect(estimateSeconds(est)).toBeLessThan(cfg.timeLimit);
    }
  });

  it("难度不是白送：越往后翻牌次数越多，末关明显比首关吃力", () => {
    const first = simulatePerfectPlay(LEVELS[99], deckSeed(99)).flips;
    const last = simulatePerfectPlay(LEVELS[187], deckSeed(187)).flips;
    expect(last).toBeGreaterThan(first);
    for (const i of NEW_LEVELS) {
      expect(simulatePerfectPlay(LEVELS[i], deckSeed(i)).flips).toBeGreaterThanOrEqual(LEVELS[i].pairs * 2);
    }
  });

  it("算式关逐关体检：每张得数卡只配得上唯一一道算式", () => {
    for (const i of NEW_LEVELS) {
      const cfg = LEVELS[i];
      if (!cfg.mathPairs) continue;
      for (const s of SEEDS) {
        const deck = buildDeck(cfg, deckSeed(i) + s);
        const values = deck.filter((c) => /^\d+$/.test(c.face)).map((c) => c.face);
        expect(new Set(values).size).toBe(values.length);
        const exprs = deck.filter((c) => !/^\d+$/.test(c.face));
        expect(exprs).toHaveLength(cfg.pairs);
        for (const e of exprs) {
          const answer = deck.find((c) => c.group === e.group && c !== e);
          expect(answer).toBeDefined();
          expect(evalExpr(e.face)).toBe(Number(answer?.face));
        }
      }
    }
  });

  it("旋转关逐关体检：转到底也不会弄丢牌，间隔够孩子翻完一组", () => {
    for (const i of NEW_LEVELS) {
      const cfg = LEVELS[i];
      const every = cfg.rotateEvery ?? 0;
      if (every <= 0) continue;
      expect(every).toBeGreaterThanOrEqual(cfg.matchSize * 2);
      const n = deckSize(cfg);
      let order = Array.from({ length: n }, (_, k) => k);
      const gone = new Array(n).fill(false);
      for (let k = 0; k < n * 2; k++) order = rotatePositions(order, gone, 1);
      expect(order.slice().sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, k) => k));
    }
  });
});
