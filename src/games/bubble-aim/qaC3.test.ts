// 档C · 第 3 轮测试员 · bubble-aim:188 关一关不漏地摆一遍。
//
// 「打得过」这件事 `logic.test.ts` 的贪心机器人已经逐关跑过了,第 3 轮不重复造轮子;
// 这一段补的是它没盯的另外几条线,而且全部改成**全量**:
// 布局自洽(行长 8/9 交替、开局不悬空、不越警戒线)、子弹预算有下限、
// 机关声明与实际对得上、障碍不糊墙不压泡泡、文案干净、存档往返(含 1.0 老档 99 位)。
import { describe, expect, it } from "vitest";
import { meta } from "./meta";
import {
  LEGACY_LEVELS,
  LEVELS,
  MECH_INFO,
  THEMES,
  THEME_SIZES,
  budgetBand,
  budgetNote,
  clearableCount,
  isTightShots,
  levelMechanisms,
  parseStars,
  shotBudget,
  themeOfLevel,
  themeStart,
  type BubbleLevelDef,
} from "./levels";
import {
  COLS,
  DEADLINE_ROW,
  H,
  MAX_ROWS,
  RAINBOW,
  STONE,
  W,
  countBubbles,
  countStones,
  crossedDeadline,
  findFloating,
  parseLayout,
  rowLen,
  starsForShotsLeft,
  wonSpeechLine,
} from "./logic";
import { ENDLESS_PUSH_EVERY, ENDLESS_START_ROWS, endlessLine, endlessTotal } from "./aim12";

const COLORS = ["R", "Y", "B", "G", "P"];
const CELLS = new Set([...COLORS, RAINBOW, STONE, "."]);

/** 一发子弹理论上最多能带下多少颗泡泡也不可能少于这个数 —— 用来卡「给的子弹够不够」的下限 */
const MIN_BUDGET = 1 / 3;

/* ------------------------------------------------------------------ */
/* 一、188 关全量                                                       */
/* ------------------------------------------------------------------ */

describe("档C R3 · bubble-aim · 188 关一关不漏", () => {
  it("关数、主题切分都对得上", () => {
    expect(LEVELS).toHaveLength(188);
    expect(THEME_SIZES.reduce((a, b) => a + b, 0)).toBe(LEVELS.length);
    expect(THEMES).toHaveLength(THEME_SIZES.length);
    expect(LEGACY_LEVELS).toBe(99);
    LEVELS.forEach((_, i) => {
      const t = themeOfLevel(i);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(THEMES.length);
      expect(i).toBeGreaterThanOrEqual(themeStart(t));
      expect(i).toBeLessThan(themeStart(t) + THEME_SIZES[t]);
    });
  });

  it("每一关的布局都自洽:行长 8/9 交替、字符全在册、行数不超顶", () => {
    LEVELS.forEach((def, i) => {
      expect(def.layout.length, `第 ${i + 1} 关一行都没有`).toBeGreaterThan(0);
      expect(def.layout.length, `第 ${i + 1} 关行数超过了顶`).toBeLessThanOrEqual(MAX_ROWS);
      def.layout.forEach((row, r) => {
        expect(row.length, `第 ${i + 1} 关第 ${r} 行长度不对`).toBe(rowLen(0, r));
        for (const ch of row) expect(CELLS, `第 ${i + 1} 关第 ${r} 行冒出了「${ch}」`).toContain(ch);
      });
      for (const row of def.dropRows ?? []) {
        for (const ch of row) expect(CELLS, `第 ${i + 1} 关的下落行冒出了「${ch}」`).toContain(ch);
      }
    });
  });

  it("每一关开局都不悬空、不越警戒线、有得打", () => {
    LEVELS.forEach((def, i) => {
      const g = parseLayout(def.layout);
      expect(findFloating(g), `第 ${i + 1} 关开局就有悬空的泡泡`).toEqual([]);
      expect(crossedDeadline(g), `第 ${i + 1} 关开局就越过警戒线了`).toBe(false);
      expect(countBubbles(g), `第 ${i + 1} 关开局是空屏`).toBeGreaterThan(0);
      expect(clearableCount(def), `第 ${i + 1} 关全是石泡,清不掉`).toBeGreaterThan(0);
    });
  });

  it("每一关的子弹都够:预算不低于三分之一,而且没有 0 发关", () => {
    LEVELS.forEach((def, i) => {
      expect(def.shots, `第 ${i + 1} 关没给子弹`).toBeGreaterThan(0);
      expect(shotBudget(def), `第 ${i + 1} 关的子弹低于理论下限`).toBeGreaterThan(MIN_BUDGET);
    });
  });

  it("石泡关真的有石泡、彩虹关真的有彩虹 —— 机关声明和布局对得上", () => {
    LEVELS.forEach((def, i) => {
      const mech = levelMechanisms(def);
      const flat = def.layout.join("");
      expect(mech.includes("stone"), `第 ${i + 1} 关的石泡标签`).toBe(flat.includes(STONE));
      expect(mech.includes("rainbow"), `第 ${i + 1} 关的彩虹标签`).toBe(flat.includes(RAINBOW));
      expect(mech.includes("cloud"), `第 ${i + 1} 关的云标签`).toBe((def.clouds?.length ?? 0) > 0);
      expect(mech.includes("hole"), `第 ${i + 1} 关的黑洞标签`).toBe((def.holes?.length ?? 0) > 0);
      expect(mech.includes("drop"), `第 ${i + 1} 关的下落标签`).toBe((def.dropRows?.length ?? 0) > 0);
      expect(mech.includes("tight"), `第 ${i + 1} 关的限弹标签`).toBe(isTightShots(def));
      for (const m of mech) expect(MECH_INFO[m], `第 ${i + 1} 关的 ${m} 没有图标`).toBeDefined();
      // 有下落行就必须写清多少发压一行,不然队列压不下来
      if ((def.dropRows?.length ?? 0) > 0) {
        expect(def.dropEvery, `第 ${i + 1} 关有下落行却没写 dropEvery`).toBeGreaterThan(0);
      }
      if ((def.pressEvery ?? 0) > 0) {
        expect(def.pressMax, `第 ${i + 1} 关有顶板却没写 pressMax`).toBeGreaterThan(0);
      }
    });
  });

  it("云和黑洞都不糊墙边、不压在开局泡泡上、不挡住发射台", () => {
    LEVELS.forEach((def, i) => {
      const bottomOfBubbles = 6 + def.layout.length * (19 * 2 * 0.866);
      for (const c of def.clouds ?? []) {
        expect(c.x, `第 ${i + 1} 关的云糊到左墙外了`).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w, `第 ${i + 1} 关的云糊到右墙外了`).toBeLessThanOrEqual(W);
        expect(c.y, `第 ${i + 1} 关的云压在开局泡泡上`).toBeGreaterThan(bottomOfBubbles - 40);
        expect(c.y + c.h, `第 ${i + 1} 关的云挡住了发射台`).toBeLessThan(H - 60);
      }
      for (const h of def.holes ?? []) {
        expect(h.x).toBeGreaterThan(0);
        expect(h.x).toBeLessThan(W);
        expect(h.y).toBeGreaterThan(0);
        expect(h.y, `第 ${i + 1} 关的黑洞贴到发射台了`).toBeLessThan(H - 60);
      }
    });
  });

  it("每一关的文案都干净:关名、提示没有洋文也没有丧气话", () => {
    const harsh = ["你输了", "笨", "蠢", "血", "死亡", "干掉", "杀"];
    const names = new Set<string>();
    LEVELS.forEach((def, i) => {
      expect(def.name.length, `第 ${i + 1} 关没有关名`).toBeGreaterThan(0);
      expect(def.tip.length, `第 ${i + 1} 关没有提示`).toBeGreaterThan(4);
      expect(def.name, `第 ${i + 1} 关的关名里有洋文`).not.toMatch(/[A-Za-z]/);
      for (const w of harsh) {
        expect(def.tip.includes(w), `第 ${i + 1} 关的提示里有「${w}」`).toBe(false);
        expect(def.name.includes(w), `第 ${i + 1} 关的关名里有「${w}」`).toBe(false);
      }
      names.add(def.name);
    });
    // 关名基本不重样(重了选关页会分不清)
    expect(names.size).toBeGreaterThanOrEqual(LEVELS.length - 2);
  });

  it("每一关的子弹分档都给得出来,提醒只在紧的那两档挂", () => {
    LEVELS.forEach((def, i) => {
      const band = budgetBand(def);
      expect(["限弹", "偏紧", "适中", "宽松"], `第 ${i + 1} 关`).toContain(band);
      const note = budgetNote(def);
      if (band === "限弹" || band === "偏紧") expect(note.length, `第 ${i + 1} 关`).toBeGreaterThan(8);
      else expect(note, `第 ${i + 1} 关`).toBe("");
    });
  });

  it("每一关都摆得进 360px 的画布 —— 9 格一行正好铺满不溢出", () => {
    expect(W).toBe(360);
    const g = parseLayout(["RRRRRRRRR"]);
    expect(g.rows[0]).toHaveLength(COLS);
    // 警戒线留在画布里,不会画到看不见的地方
    expect(DEADLINE_ROW).toBeLessThan(MAX_ROWS);
    expect(6 + DEADLINE_ROW * (19 * 2 * 0.866)).toBeLessThan(H);
  });
});

/* ------------------------------------------------------------------ */
/* 二、两种模式                                                         */
/* ------------------------------------------------------------------ */

describe("档C R3 · bubble-aim · 两种模式一个不漏", () => {
  it("meta 只声明战役和无尽,而且两个都有真实入口", () => {
    expect([...meta.modes].sort()).toEqual(["campaign", "endless"]);
    expect(LEVELS[0].layout.length).toBeGreaterThan(0);
    expect(ENDLESS_START_ROWS).toBeGreaterThan(0);
    expect(ENDLESS_PUSH_EVERY).toBeGreaterThan(0);
  });

  it("战役:三星门槛够得着,一星也说得出好话", () => {
    LEVELS.forEach((def, i) => {
      expect(starsForShotsLeft(def.shots, def.shots), `第 ${i + 1} 关满弹评不到 3 星`).toBe(3);
      expect(starsForShotsLeft(0, def.shots)).toBe(1);
    });
    for (const s of [1, 2, 3]) {
      const line = wonSpeechLine(s);
      expect(line.length).toBeGreaterThan(0);
      for (const w of ["输", "笨", "差劲", "失败"]) expect(line).not.toContain(w);
    }
  });

  it("无尽:结算只鼓励,分数只增不减", () => {
    let prev = -1;
    for (let rows = 0; rows <= 200; rows += 5) {
      const t = endlessTotal(rows * 20, rows);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
    for (const [score, best] of [[0, 0], [5, 900], [900, 5]]) {
      const line = endlessLine(score, best);
      expect(line.length).toBeGreaterThan(0);
      for (const w of ["输", "笨", "菜", "失败"]) expect(line).not.toContain(w);
    }
    expect(endlessLine(900, 5)).toContain("新纪录");
  });

  it("九个主题的简介都在,而且各说各的机关", () => {
    const blurbs = new Set(THEMES.map((t) => t.blurb));
    expect(blurbs.size).toBe(THEMES.length);
    for (const th of THEMES) {
      expect(th.name).not.toMatch(/[A-Za-z]/);
      expect(th.blurb).not.toMatch(/[A-Za-z]/);
      expect(th.blurb.length).toBeGreaterThanOrEqual(10);
      expect(th.skyTop).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(th.skyBottom).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("石泡只在有石泡的关里算数:countStones 和布局逐关对得上", () => {
    LEVELS.forEach((def, i) => {
      const g = parseLayout(def.layout);
      const want = [...def.layout.join("")].filter((c) => c === STONE).length;
      expect(countStones(g), `第 ${i + 1} 关的石泡数对不上`).toBe(want);
    });
  });
});

/* ------------------------------------------------------------------ */
/* 三、存档往返(含 1.0 老档)                                           */
/* ------------------------------------------------------------------ */

describe("档C R3 · bubble-aim · 存档往返", () => {
  it("188 位的新档存进去读出来一颗星不丢", () => {
    const want = Array.from({ length: LEVELS.length }, (_, i) => (i % 4) as 0 | 1 | 2 | 3);
    const back = parseStars(want);
    expect(back).toHaveLength(LEVELS.length);
    for (let i = 0; i < LEVELS.length; i++) expect(back[i], `第 ${i + 1} 关`).toBe(want[i]);
  });

  it("1.0 的 99 位老档原样保留,后面 89 位补 0", () => {
    const old = Array.from({ length: LEGACY_LEVELS }, (_, i) => ((i % 3) + 1) as 1 | 2 | 3);
    const back = parseStars(old);
    expect(back).toHaveLength(LEVELS.length);
    for (let i = 0; i < LEGACY_LEVELS; i++) expect(back[i], `老档第 ${i + 1} 关丢了`).toBe(old[i]);
    for (let i = LEGACY_LEVELS; i < LEVELS.length; i++) expect(back[i]).toBe(0);
  });

  it("超长 / 越界 / 写坏的档都读得回来,不会白屏", () => {
    for (const junk of [
      null,
      undefined,
      "哈",
      {},
      [],
      [9, -1, 2.7, "x", NaN, Infinity],
      new Array(400).fill(3),
    ]) {
      const back = parseStars(junk);
      expect(back).toHaveLength(LEVELS.length);
      for (const v of back) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(3);
      }
    }
  });

  it("往返两趟结果一样(读出来再存回去不会漂)", () => {
    const first = parseStars([3, 2, 1, 0, 3]);
    expect(parseStars(first)).toEqual(first);
  });
});

/* ------------------------------------------------------------------ */
/* 四、辅助:主题预算一览(留给第 3 轮学习优化员看曲线)                    */
/* ------------------------------------------------------------------ */

describe("档C R3 · bubble-aim · 主题难度一览", () => {
  it("九个主题的平均预算都在合理区间,没有哪个主题松到没意思", () => {
    const avg = (defs: BubbleLevelDef[]): number =>
      defs.reduce((s, d) => s + shotBudget(d), 0) / defs.length;
    for (let t = 0; t < THEME_SIZES.length; t++) {
      const start = themeStart(t);
      const b = avg(LEVELS.slice(start, start + THEME_SIZES[t]));
      expect(b, `第 ${t + 1} 主题松到没意思了`).toBeLessThan(2);
      expect(b, `第 ${t + 1} 主题紧到打不过`).toBeGreaterThan(MIN_BUDGET);
    }
  });
});
