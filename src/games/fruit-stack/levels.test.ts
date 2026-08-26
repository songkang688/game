// 188 关关卡表:章节和恒等 188、每一关的容器与目标都站得住脚。
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, chapterOf } from "../level99";
import {
  CHAPTERS,
  buildEndless,
  buildLevel,
  buildVersus,
  chapterProgress,
  dropBudget,
  estimateScore,
  goalFeasible,
  goalMet,
  goalText,
  levelBrief,
  unitsNeeded,
  unitsPerDrop,
} from "./levels";
import { CHAIN, TOP_LEVEL, radiusOf } from "./merge";

const ALL = Array.from({ length: TOTAL_LEVELS }, (_, i) => buildLevel(i));

describe("章节切分", () => {
  it("八章合计正好 188 关", () => {
    expect(CHAPTERS.length).toBe(8);
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
    expect(CHAPTERS.reduce((s, c) => s + c.size, 0)).toBe(TOTAL_LEVELS);
  });

  it("章节切分和规格里的 24×4 + 22×2 + 24×2 对得上", () => {
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
  });

  it("每一章都有名字、图标、颜色和一句话介绍", () => {
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(0);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThan(6);
    }
  });

  it("章节内进度从 0 爬到 1", () => {
    expect(chapterProgress(0)).toBe(0);
    expect(chapterProgress(23)).toBe(1);
    expect(chapterProgress(24)).toBe(0);
    expect(chapterProgress(187)).toBe(1);
  });
});

describe("188 关每一关都立得住", () => {
  it("关号、章节、seed 都对得上,而且是确定性的", () => {
    ALL.forEach((lv, i) => {
      expect(lv.index).toBe(i);
      expect(lv.chapter).toBe(chapterOf(CHAPTERS, i));
      expect(buildLevel(i)).toEqual(lv);
    });
    expect(new Set(ALL.map((l) => l.seed)).size).toBe(TOTAL_LEVELS);
  });

  it("容器、警戒线与投放区间都在合理范围内", () => {
    for (const lv of ALL) {
      expect(lv.box.w).toBeGreaterThanOrEqual(200);
      expect(lv.box.h).toBeGreaterThanOrEqual(340);
      expect(lv.lineY).toBeGreaterThan(40);
      expect(lv.lineY).toBeLessThan(lv.box.h * 0.4);
      expect(lv.minDrop).toBeGreaterThanOrEqual(0);
      expect(lv.maxDrop).toBeGreaterThanOrEqual(lv.minDrop);
      expect(lv.maxDrop).toBeLessThanOrEqual(TOP_LEVEL);
      // 投放的果子必须塞得进盆里,而且盆至少能并排放下两颗
      expect(radiusOf(lv.maxDrop) * 2).toBeLessThan(lv.box.w * 0.6);
      expect(lv.drops).toBeGreaterThan(12);
      expect(lv.tuning.restitution).toBeGreaterThan(0);
      expect(lv.tuning.restitution).toBeLessThanOrEqual(0.6);
    }
  });

  it("188 关的目标都够得着(投放预算模型)", () => {
    const bad = ALL.filter((lv) => !goalFeasible(lv)).map((lv) => `第 ${lv.index + 1} 关`);
    expect(bad, `这些关的目标超出了投放预算:${bad.join("、")}`).toEqual([]);
  });

  it("目标果子塞得进容器", () => {
    for (const lv of ALL) {
      if (lv.goal.kind !== "level") continue;
      expect(CHAIN[lv.goal.value].r * 2, `第 ${lv.index + 1} 关的目标果子比盆还宽`).toBeLessThanOrEqual(lv.box.w);
    }
  });

  it("目标一关比一关高:第 188 关就是最高级", () => {
    expect(ALL[187].goal).toEqual({ kind: "level", value: TOP_LEVEL });
    expect(ALL[0].goal).toEqual({ kind: "level", value: 3 });
  });

  it("预算模型本身是保守的:够不着的关会被拦下来", () => {
    const lv = { ...ALL[0], drops: 4 };
    expect(goalFeasible(lv)).toBe(false);
    expect(unitsNeeded(0, 3)).toBe(8);
    expect(unitsNeeded(5, 10)).toBe(32);
    expect(estimateScore({ drops: 50, minDrop: 0 })).toBeGreaterThan(0);
  });

  it("预算跟着本关能投的等级区间走,开放得越窄预算越紧", () => {
    // 只开放三档:(40·1+30·2+18·4)/88,一颗顶不到两个当量
    expect(unitsPerDrop(0, 2)).toBeCloseTo(172 / 88, 6);
    // 五档全开就是 0.40·1+0.30·2+0.18·4+0.09·8+0.03·16
    expect(unitsPerDrop(0, 4)).toBeCloseTo(2.92, 6);
    // 区间再宽也只有五档权重,不会继续涨
    expect(unitsPerDrop(0, 9)).toBeCloseTo(unitsPerDrop(0, 4), 6);
    expect(unitsPerDrop(3, 3)).toBe(1);
    expect(unitsPerDrop(0, 2)).toBeLessThan(unitsPerDrop(0, 3));
    expect(dropBudget({ drops: 40, minDrop: 0, maxDrop: 4 })).toBeCloseTo(58.4, 6);
    expect(dropBudget({ drops: 40, minDrop: 0, maxDrop: 2 })).toBeCloseTo((40 * 172) / 88 / 2, 6);
  });
});

describe("八章各自的新机制真的落到了参数上", () => {
  it("第 1 章只投前三级,第 2 章开始往上放", () => {
    expect(ALL[0].maxDrop).toBe(2);
    expect(ALL[0].goal.value).toBe(3);
  });

  it("第 3 章的警戒线一路往下压", () => {
    const first = ALL[48].lineY;
    const last = ALL[71].lineY;
    expect(last).toBeLessThan(first);
    expect(last).toBeLessThan(ALL[0].lineY);
  });

  it("第 4 章考的是连锁", () => {
    for (let i = 72; i < 96; i++) {
      expect(ALL[i].goal.kind).toBe("chain");
      expect(ALL[i].goal.value).toBeGreaterThanOrEqual(3);
    }
  });

  it("第 5 章的盆越来越窄", () => {
    expect(ALL[117].box.w).toBeLessThan(ALL[96].box.w);
    expect(ALL[117].box.w).toBeLessThan(ALL[0].box.w);
  });

  it("第 6 章的弹性明显更大", () => {
    expect(ALL[118].tuning.restitution).toBeGreaterThan(ALL[0].tuning.restitution * 1.5);
    expect(ALL[139].tuning.restitution).toBeGreaterThan(ALL[118].tuning.restitution);
  });

  it("第 7 章是分屏对盆,其余章节都是单盆", () => {
    for (let i = 140; i < 164; i++) expect(ALL[i].split).toBe(true);
    expect(ALL[0].split).toBe(false);
    expect(ALL[187].split).toBe(false);
  });

  it("第 8 章一上来就是大果子", () => {
    for (let i = 164; i < 188; i++) {
      expect(ALL[i].minDrop).toBeGreaterThanOrEqual(4);
      expect(ALL[i].goal.value).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("目标判定与文案", () => {
  it("三种目标各判各的", () => {
    const got = { bestLevel: 5, score: 300, bestChain: 3 };
    expect(goalMet({ kind: "level", value: 5 }, got)).toBe(true);
    expect(goalMet({ kind: "level", value: 6 }, got)).toBe(false);
    expect(goalMet({ kind: "score", value: 300 }, got)).toBe(true);
    expect(goalMet({ kind: "score", value: 301 }, got)).toBe(false);
    expect(goalMet({ kind: "chain", value: 3 }, got)).toBe(true);
    expect(goalMet({ kind: "chain", value: 4 }, got)).toBe(false);
  });

  it("目标文案用的是原创果名", () => {
    expect(goalText({ kind: "level", value: TOP_LEVEL })).toContain("团圆瓜");
    expect(goalText({ kind: "score", value: 320 })).toContain("320");
    expect(goalText({ kind: "chain", value: 3 })).toContain("3");
    expect(levelBrief(ALL[0])).toContain("最多");
  });
});

describe("无尽与对战", () => {
  it("无尽没有关底,盆也最大", () => {
    const lv = buildEndless();
    expect(lv.drops).toBeGreaterThan(1000);
    expect(lv.box.w).toBeGreaterThanOrEqual(300);
    expect(lv.maxDrop).toBe(4);
  });

  it("对战一局比一局窄、目标一局比一局高", () => {
    const a = buildVersus(1);
    const c = buildVersus(3);
    expect(c.box.w).toBeLessThan(a.box.w);
    expect(c.goal.value).toBeGreaterThan(a.goal.value);
    expect(a.split).toBe(true);
    expect(buildVersus(1)).toEqual(buildVersus(1));
  });
});
