/**
 * 识字小花园 1.2：笔顺数据与判定。
 *
 * 这一份的第一条就是 29 个字的**逐笔顺序**：笔顺写错就是教错人，
 * 所以每一个字的每一笔都在这里白纸黑字写一遍，改数据必然对不上。
 */
import { describe, expect, it } from "vitest";
import {
  GRID,
  hasStrokes,
  isStrokeTraced,
  judgeTrace,
  pointToSegment,
  STROKE_CHARS,
  strokeCount,
  strokeNames,
  strokesOf,
  traceDoneLine,
  traceHint,
  traceScore,
  traceTask,
  type Point,
} from "./strokes";
import { CHAPTER_POOLS, isTraceLevel, traceCharCount } from "./levels";

/** 29 个字的标准笔顺（《现代汉语通用字笔顺规范》） */
const EXPECTED: Record<string, string[]> = {
  一: ["横"],
  二: ["横", "横"],
  三: ["横", "横", "横"],
  十: ["横", "竖"],
  人: ["撇", "捺"],
  八: ["撇", "捺"],
  七: ["横", "竖弯钩"],
  九: ["撇", "横折弯钩"],
  五: ["横", "竖", "横折", "横"],
  六: ["点", "横", "撇", "点"],
  四: ["竖", "横折", "撇", "竖弯", "横"],
  口: ["竖", "横折", "横"],
  日: ["竖", "横折", "横", "横"],
  目: ["竖", "横折", "横", "横", "横"],
  月: ["撇", "横折钩", "横", "横"],
  山: ["竖", "竖折", "竖"],
  木: ["横", "竖", "撇", "捺"],
  水: ["竖钩", "横撇", "撇", "捺"],
  火: ["点", "撇", "撇", "捺"],
  天: ["横", "横", "撇", "捺"],
  云: ["横", "横", "撇折", "点"],
  手: ["撇", "横", "横", "竖钩"],
  心: ["点", "卧钩", "点", "点"],
  门: ["点", "竖", "横折钩"],
  牛: ["撇", "横", "横", "竖"],
  马: ["横折", "竖折折钩", "横"],
  鸟: ["撇", "横折钩", "点", "竖折折钩", "横"],
  米: ["点", "撇", "横", "竖", "撇", "捺"],
  电: ["竖", "横折", "横", "横", "竖弯钩"],
  耳: ["横", "竖", "竖", "横", "横", "横"],
};

const away: Point[] = [[2, 96], [6, 98]];

describe("识字小花园 · 笔顺数据", () => {
  it("29 个字的每一笔，顺序和笔画名一笔不差", () => {
    expect(Object.keys(EXPECTED).length).toBeGreaterThanOrEqual(20);
    expect(STROKE_CHARS).toHaveLength(Object.keys(EXPECTED).length);
    for (const [char, names] of Object.entries(EXPECTED)) {
      expect(hasStrokes(char), `没有 ${char} 的笔顺数据`).toBe(true);
      expect(strokeNames(char), `${char} 的笔顺不对`).toEqual(names);
      expect(strokeCount(char)).toBe(names.length);
    }
  });

  it("笔画数和公认的一致（横平竖直数得出来的那种）", () => {
    const counts: Record<string, number> = {
      一: 1, 二: 2, 三: 3, 十: 2, 人: 2, 八: 2, 七: 2, 九: 2, 五: 4, 六: 4,
      四: 5, 口: 3, 日: 4, 目: 5, 月: 4, 山: 3, 木: 4, 水: 4, 火: 4, 天: 4,
      云: 4, 手: 4, 心: 4, 门: 3, 牛: 4, 马: 3, 鸟: 5, 米: 6, 电: 5, 耳: 6,
    };
    for (const [char, n] of Object.entries(counts)) expect(strokeCount(char), char).toBe(n);
  });

  it("每一笔都是画得出来的折线：≥2 个点、全部落在田字格里", () => {
    for (const c of STROKE_CHARS) {
      expect([...c.char]).toHaveLength(1);
      expect(c.pinyin.length).toBeGreaterThan(0);
      expect(c.strokes.length).toBeGreaterThan(0);
      for (const s of c.strokes) {
        expect(s.name.length, `${c.char} 有一笔没名字`).toBeGreaterThan(0);
        expect(s.points.length, `${c.char} 的「${s.name}」不成一条线`).toBeGreaterThanOrEqual(2);
        for (const [x, y] of s.points) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(GRID);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(GRID);
        }
        // 起笔和收笔不许是同一个点，不然描红判不出方向
        const [hx, hy] = s.points[0];
        const [tx, ty] = s.points[s.points.length - 1];
        expect(Math.hypot(hx - tx, hy - ty), `${c.char} 的「${s.name}」起收重合`).toBeGreaterThan(4);
      }
    }
  });

  it("收的都是前三章的高频字，没有一个是字卡表外的生字", () => {
    const bank = new Set(CHAPTER_POOLS.flat().map((c) => c.char));
    for (const c of STROKE_CHARS) {
      expect(bank.has(c.char), `${c.char} 不在字卡表里`).toBe(true);
    }
    expect(strokesOf("龘")).toBeNull();
    expect(strokeCount("龘")).toBe(0);
    expect(strokeNames("龘")).toEqual([]);
  });
});

describe("识字小花园 · 描红判定", () => {
  it("顺着这一笔描就算过：29 个字逐笔走一遍全部判对", () => {
    for (const c of STROKE_CHARS) {
      for (let i = 0; i < c.strokes.length; i++) {
        const v = judgeTrace(c.char, i, c.strokes[i].points);
        expect(v.kind, `${c.char} 第 ${i + 1} 笔判错了`).toBe("right");
        expect(isStrokeTraced(c.strokes[i], c.strokes[i].points)).toBe(true);
        expect(traceScore(c.strokes[i], c.strokes[i].points)).toBeGreaterThan(0.95);
      }
    }
  });

  it("顺序反了会被认出来，而且说得出该先写第几笔", () => {
    // 「日」的第 4 笔（封口的横）跑到第 1 笔来写
    const v = judgeTrace("日", 0, strokesOf("日")!.strokes[3].points);
    expect(v.kind).toBe("outOfOrder");
    if (v.kind === "outOfOrder") {
      expect(v.index).toBe(3);
      expect(v.expected).toBe(0);
    }
    // 「十」先写竖后写横：竖是第 2 笔，第 1 笔该是横
    const t = judgeTrace("十", 0, strokesOf("十")!.strokes[1].points);
    expect(t.kind).toBe("outOfOrder");
    if (t.kind === "outOfOrder") expect(t.expected).toBe(0);
  });

  it("描歪到格子角上只当没描到，不冤枉成顺序错", () => {
    expect(judgeTrace("木", 0, away).kind).toBe("miss");
    expect(judgeTrace("耳", 3, away)).toEqual({ kind: "miss", expected: 3 });
    // 没有笔顺数据的字不许抛异常
    expect(judgeTrace("龘", 0, away).kind).toBe("miss");
    // 一个点不成一道
    expect(judgeTrace("一", 0, [[14, 50]]).kind).toBe("miss");
  });

  it("方向反着描不算数：从收笔倒着划回起笔要被拦下来", () => {
    const heng = strokesOf("一")!.strokes[0];
    const backwards = [...heng.points].reverse();
    expect(isStrokeTraced(heng, backwards)).toBe(false);
    expect(judgeTrace("一", 0, backwards).kind).not.toBe("right");
  });

  it("点到线段的距离算得对（判定的地基）", () => {
    expect(pointToSegment([0, 0], [0, 0], [10, 0])).toBe(0);
    expect(pointToSegment([5, 3], [0, 0], [10, 0])).toBeCloseTo(3);
    expect(pointToSegment([20, 0], [0, 0], [10, 0])).toBeCloseTo(10);
    expect(pointToSegment([3, 4], [0, 0], [0, 0])).toBeCloseTo(5);
  });

  it("提示只指路、不说孩子错，也不出现任何批评的字眼", () => {
    const lines = [
      traceHint(judgeTrace("日", 0, strokesOf("日")!.strokes[3].points), "日"),
      traceHint(judgeTrace("木", 0, away), "木"),
      traceHint(judgeTrace("木", 0, strokesOf("木")!.strokes[0].points), "木"),
      traceDoneLine("水"),
    ];
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(0);
      expect(line).not.toMatch(/错|笨|差劲|不行|失败|重写/);
    }
    expect(lines[0]).toContain("第 1 笔");
    expect(lines[3]).toContain("4 笔");
  });
});

describe("识字小花园 · 描红台排关", () => {
  it("形近字迷宫里每三关来一次描红，一共 6 关", () => {
    const levels = Array.from({ length: 188 }, (_, i) => i).filter(isTraceLevel);
    expect(levels).toEqual([101, 104, 107, 110, 113, 116]);
    for (const lv of levels) {
      expect(traceCharCount(lv)).toBeGreaterThanOrEqual(2);
      expect(traceCharCount(lv)).toBeLessThanOrEqual(4);
    }
  });

  it("同一关重开描的是同样几个字，一关之内不描重复字", () => {
    for (const lv of [101, 107, 116]) {
      const a = traceTask(lv, traceCharCount(lv));
      const b = traceTask(lv, traceCharCount(lv));
      expect(a.chars.map((c) => c.char)).toEqual(b.chars.map((c) => c.char));
      expect(new Set(a.chars.map((c) => c.char)).size).toBe(a.chars.length);
      expect(a.chars.length).toBe(traceCharCount(lv));
    }
    // 要多少给多少，超过库存也不崩
    expect(traceTask(3, 999).chars.length).toBeLessThanOrEqual(STROKE_CHARS.length);
    expect(traceTask(3, 0).chars.length).toBe(1);
  });
});
