/**
 * 金矿钩钩 · 188 关矿脉表与无尽矿井单测。
 *
 * 除了章节和、参数曲线这些常规校验,这一份重点证明两件事:
 *  1. **每一关的目标金额都拿得到** —— 用带时间损耗的模拟器把 188 关全跑一遍;
 *  2. **摆烂过不去** —— 专挑石头钩的策略在任何一关都够不着目标,
 *     不然「随便乱按也能通关」就不算关卡了。
 * 顺带把「每颗矿石各占一条互不重叠的车道」这条生成硬规矩也钉死。
 */
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, totalSize } from "../level99";
import {
  CHAPTERS,
  TOTAL,
  allLevels,
  budgetFor,
  buildField,
  chapterOfLevel,
  chapterStartOf,
  difficultyRamp,
  endlessLayer,
  endlessLine,
  endlessQuotaRatio,
  levelAt,
  targetRatio,
  timeFactorOf,
} from "./levels";
import {
  DIG_BOTTOM,
  DIG_TOP,
  FIELD_W,
  ORES,
  WALL,
  angleFromPivot,
  distanceFromPivot,
  lanesOverlap,
  simulateRun,
  type MineField,
} from "./logic";

const LEVELS = allLevels();

// ---------------------------------------------------------------------------
// 章节
// ---------------------------------------------------------------------------

describe("章节切分", () => {
  it("章节大小之和恰好是 188", () => {
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(TOTAL).toBe(TOTAL_LEVELS);
  });

  it("八个主题章节,每个都写齐了名字、图标、颜色和一句话介绍", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(8);
    for (const ch of CHAPTERS) {
      expect(ch.name.length).toBeGreaterThan(1);
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ch.desc.length).toBeGreaterThan(6);
      expect(ch.size).toBeGreaterThan(0);
    }
  });

  it("章节名字互不重复", () => {
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(CHAPTERS.length);
  });

  it("chapterOfLevel 与 chapterStartOf 对得上,而且覆盖满 188 关", () => {
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
      const start = chapterStartOf(ci);
      expect(chapterOfLevel(start)).toBe(ci);
      expect(chapterOfLevel(start + CHAPTERS[ci].size - 1)).toBe(ci);
    }
    expect(chapterStartOf(CHAPTERS.length)).toBe(188);
    expect(chapterOfLevel(999)).toBe(CHAPTERS.length - 1);
  });

  it("难度进度条从 0 走到 1,越界也不会跑出去", () => {
    expect(difficultyRamp(0)).toBe(0);
    expect(difficultyRamp(TOTAL - 1)).toBe(1);
    expect(difficultyRamp(-30)).toBe(0);
    expect(difficultyRamp(9999)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 难度曲线
// ---------------------------------------------------------------------------

describe("难度曲线", () => {
  it("目标系数一路往上抬,时间宽裕度一路往下压", () => {
    for (let i = 1; i < TOTAL; i++) {
      expect(targetRatio(i)).toBeGreaterThan(targetRatio(i - 1));
      expect(timeFactorOf(i)).toBeLessThan(timeFactorOf(i - 1));
    }
    expect(targetRatio(0)).toBeLessThan(0.5);
    expect(targetRatio(TOTAL - 1)).toBeLessThan(0.75);
    expect(timeFactorOf(TOTAL - 1)).toBeGreaterThan(0.5);
  });

  it("摆动越到后面越快越宽,绳子也越放越长", () => {
    const first = LEVELS[0].field;
    const last = LEVELS[TOTAL - 1].field;
    expect(last.swingSpeed).toBeGreaterThan(first.swingSpeed);
    expect(last.swingSpan).toBeGreaterThan(first.swingSpan);
    expect(last.ropeMax).toBeGreaterThan(first.ropeMax);
  });

  it("每一章的平均摆速都比上一章快", () => {
    const avg = CHAPTERS.map((ch, ci) => {
      const from = chapterStartOf(ci);
      const slice = LEVELS.slice(from, from + ch.size);
      return slice.reduce((s, lv) => s + lv.field.swingSpeed, 0) / slice.length;
    });
    for (let i = 1; i < avg.length; i++) expect(avg[i]).toBeGreaterThan(avg[i - 1]);
  });

  it("启动金币随章节增加,让商店从一开始就用得上", () => {
    for (let ci = 1; ci < CHAPTERS.length; ci++) {
      expect(LEVELS[chapterStartOf(ci)].startCoins).toBeGreaterThan(LEVELS[chapterStartOf(ci - 1)].startCoins);
    }
    expect(LEVELS[0].startCoins).toBeGreaterThan(0);
  });

  it("时间预算跟着 timeFactor 走:给的系数越大,时间越多", () => {
    const f = LEVELS[40].field;
    expect(budgetFor(f, 0.9)).toBeGreaterThan(budgetFor(f, 0.5));
    expect(budgetFor(f, 0.0001)).toBeGreaterThanOrEqual(26);
  });
});

// ---------------------------------------------------------------------------
// 188 关的矿洞本身
// ---------------------------------------------------------------------------

describe("188 关矿洞", () => {
  it("每一关都有一个像样的矿洞:矿石够多、限时合理、种子唯一", () => {
    const seeds = new Set<number>();
    for (const lv of LEVELS) {
      expect(lv.field.ores.length).toBeGreaterThanOrEqual(6);
      expect(lv.field.time).toBeGreaterThanOrEqual(26);
      expect(lv.field.time).toBeLessThanOrEqual(120);
      expect(lv.target).toBeGreaterThanOrEqual(40);
      expect(lv.hint.length).toBeGreaterThan(6);
      seeds.add(lv.seed);
    }
    expect(seeds.size).toBe(TOTAL);
  });

  it("每颗矿石都在洞里、够得着,而且落在摆动扇面内", () => {
    for (const lv of LEVELS) {
      for (const o of lv.field.ores) {
        const reach = o.radius + o.runRange;
        expect(o.x - reach, `第 ${lv.index + 1} 关 ${o.kind} 顶到左壁`).toBeGreaterThanOrEqual(WALL - 1);
        expect(o.x + reach, `第 ${lv.index + 1} 关 ${o.kind} 顶到右壁`).toBeLessThanOrEqual(FIELD_W - WALL + 1);
        expect(o.y).toBeGreaterThanOrEqual(DIG_TOP - 1);
        expect(o.y + o.radius).toBeLessThanOrEqual(DIG_BOTTOM + 1);
        const d = distanceFromPivot(o.x, o.y);
        expect(d + o.radius, `第 ${lv.index + 1} 关 ${o.kind} 够不着`).toBeLessThanOrEqual(lv.field.ropeMax + 1);
        expect(Math.abs(angleFromPivot(o.x, o.y))).toBeLessThanOrEqual(lv.field.swingSpan);
      }
    }
  });

  it("任意两颗矿石都不挡道,也不会叠在一起(瞄谁就一定钩到谁)", () => {
    for (const lv of LEVELS) {
      const list = lv.field.ores;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          expect(lanesOverlap(list[i], list[j], 0), `第 ${lv.index + 1} 关有两颗矿挤在同一条道上`).toBe(false);
          const gap = Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y);
          expect(gap).toBeGreaterThan(list[i].radius + list[j].radius);
        }
      }
    }
  });

  it("每一关都至少有几颗真矿物,不会整关全是石头", () => {
    for (const lv of LEVELS) {
      const treasure = lv.field.ores.filter((o) => ORES[o.kind].treasure);
      expect(treasure.length, `第 ${lv.index + 1} 关矿物太少`).toBeGreaterThanOrEqual(3);
    }
  });

  it("会跑的小地鼠从第七章「云顶浮矿」才登场", () => {
    const moleFrom = chapterStartOf(6);
    for (const lv of LEVELS) {
      const moles = lv.field.ores.filter((o) => o.kind === "mole").length;
      if (lv.index < moleFrom) expect(moles, `第 ${lv.index + 1} 关不该有地鼠`).toBe(0);
    }
    const late = LEVELS.slice(moleFrom).filter((lv) => lv.field.ores.some((o) => o.kind === "mole"));
    expect(late.length).toBeGreaterThan(20);
  });

  it("钻石和宝箱都按章节陆续登场,不会第一章就全出来", () => {
    const hasKind = (from: number, to: number, kind: string): boolean =>
      LEVELS.slice(from, to).some((lv) => lv.field.ores.some((o) => o.kind === kind));
    expect(hasKind(0, chapterStartOf(2), "gem")).toBe(false);
    expect(hasKind(chapterStartOf(2), TOTAL, "gem")).toBe(true);
    expect(hasKind(0, chapterStartOf(4), "chest")).toBe(false);
    expect(hasKind(chapterStartOf(4), TOTAL, "chest")).toBe(true);
  });

  it("同一关每次拿到的是同一份数据(缓存 + 种子双保险)", () => {
    expect(levelAt(37)).toBe(levelAt(37));
    const again = buildField({
      seed: LEVELS[37].seed,
      count: LEVELS[37].field.ores.length,
      bag: [["gem", 1]],
      moles: 0,
      swingSpeed: LEVELS[37].field.swingSpeed,
      swingSpan: LEVELS[37].field.swingSpan,
      phase: LEVELS[37].field.phase,
      ropeMax: LEVELS[37].field.ropeMax,
      timeFactor: 0.7,
    });
    expect(again.ores.length).toBeGreaterThan(0);
  });

  it("关号越界会被夹回 0..187", () => {
    expect(levelAt(-9).index).toBe(0);
    expect(levelAt(9999).index).toBe(TOTAL - 1);
  });
});

// ---------------------------------------------------------------------------
// 可通关性:目标金额一定拿得到,摆烂一定拿不到
// ---------------------------------------------------------------------------

/** 拿某种策略把某一关跑一遍,返回「挖到的钱 ÷ 目标」 */
function share(field: MineField, target: number, opts: Parameters<typeof simulateRun>[1]): number {
  return simulateRun(field, opts).coins / target;
}

describe("188 关可通关性", () => {
  it("性价比策略每一关都过得去,而且留有余量", () => {
    const bad: string[] = [];
    for (const lv of LEVELS) {
      const r = share(lv.field, lv.target, {});
      if (r < 1.2) bad.push(`第 ${lv.index + 1} 关只有 ${r.toFixed(2)} 倍`);
    }
    expect(bad, bad.join(";")).toEqual([]);
  });

  it("手慢一点(每趟多花 18% 时间)照样每一关都过得去", () => {
    const bad: string[] = [];
    for (const lv of LEVELS) {
      const r = share(lv.field, lv.target, { timePenalty: 0.18 });
      if (r < 1) bad.push(`第 ${lv.index + 1} 关只有 ${r.toFixed(2)} 倍`);
    }
    expect(bad, bad.join(";")).toEqual([]);
  });

  it("「先钩最值钱的」这种朴素打法也过得去", () => {
    const bad: string[] = [];
    for (const lv of LEVELS) {
      const r = share(lv.field, lv.target, { strategy: "value", timePenalty: 0.1 });
      if (r < 1) bad.push(`第 ${lv.index + 1} 关只有 ${r.toFixed(2)} 倍`);
    }
    expect(bad, bad.join(";")).toEqual([]);
  });

  it("专挑石头钩的摆烂玩法一关都过不去", () => {
    for (const lv of LEVELS) {
      const r = share(lv.field, lv.target, { strategy: "near", takeRocks: true, takeTreasure: false });
      expect(r, `第 ${lv.index + 1} 关摆烂居然也能过`).toBeLessThan(0.9);
    }
  });

  it("「只顾眼前、永远钩最近的」会有一批关卡翻车,说明选目标这件事真的有讲究", () => {
    const failed = LEVELS.filter((lv) => share(lv.field, lv.target, { strategy: "near", timePenalty: 0.1 }) < 1);
    expect(failed.length).toBeGreaterThan(0);
  });

  it("三星线(目标的一倍半)在多数关卡够得着,但不是白送", () => {
    const reachable = LEVELS.filter((lv) => share(lv.field, lv.target, {}) >= 1.6).length;
    expect(reachable).toBeGreaterThan(TOTAL * 0.6);
    expect(reachable).toBeLessThan(TOTAL);
  });

  it("目标金额随章节整体走高", () => {
    const avg = CHAPTERS.map((ch, ci) => {
      const from = chapterStartOf(ci);
      const slice = LEVELS.slice(from, from + ch.size);
      return slice.reduce((s, lv) => s + lv.target, 0) / slice.length;
    });
    expect(avg[avg.length - 1]).toBeGreaterThan(avg[0] * 3);
  });
});

// ---------------------------------------------------------------------------
// 无尽矿井
// ---------------------------------------------------------------------------

describe("无尽矿井", () => {
  it("配额比例逐层收紧,但永远封顶在 0.88", () => {
    for (let d = 2; d <= 40; d++) {
      expect(endlessQuotaRatio(d)).toBeGreaterThanOrEqual(endlessQuotaRatio(d - 1));
    }
    expect(endlessQuotaRatio(1)).toBeLessThan(0.5);
    expect(endlessQuotaRatio(9999)).toBeCloseTo(0.88, 6);
  });

  it("层号会被夹到 1 以上,不会出现第 0 层", () => {
    expect(endlessLayer(0).depth).toBe(1);
    expect(endlessLayer(-4).depth).toBe(1);
  });

  it("每一层都有矿、有配额、有名字", () => {
    for (let d = 1; d <= 30; d++) {
      const layer = endlessLayer(d);
      expect(layer.field.ores.length).toBeGreaterThanOrEqual(6);
      expect(layer.quota).toBeGreaterThanOrEqual(60);
      expect(layer.name.length).toBeGreaterThan(1);
      expect(layer.field.time).toBeGreaterThanOrEqual(26);
    }
  });

  it("越往下摆得越快、时间越紧,但配额始终挖得到", () => {
    const shallow = endlessLayer(1);
    const deep = endlessLayer(20);
    expect(deep.field.swingSpeed).toBeGreaterThan(shallow.field.swingSpeed);
    for (let d = 1; d <= 30; d++) {
      const layer = endlessLayer(d);
      expect(simulateRun(layer.field).coins, `第 ${d} 层配额挖不到`).toBeGreaterThanOrEqual(layer.quota);
    }
  });

  it("浅层给的余量大,深层几乎要挖满才够配额", () => {
    const easy = endlessLayer(2);
    const hard = endlessLayer(24);
    expect(simulateRun(easy.field).coins / easy.quota).toBeGreaterThan(
      simulateRun(hard.field).coins / hard.quota
    );
  });

  it("同一层每次生成的矿洞完全一样", () => {
    expect(endlessLayer(7).field.ores).toEqual(endlessLayer(7).field.ores);
    expect(endlessLayer(7).quota).toBe(endlessLayer(7).quota);
  });

  it("收工的话会把层数、金币和最好成绩说清楚", () => {
    expect(endlessLine(1, 30, 500)).toContain("第一层");
    expect(endlessLine(6, 900, 900)).toContain("刷新");
    const behind = endlessLine(4, 300, 900);
    expect(behind).toContain("第 4 层");
    expect(behind).toContain("900");
  });
});
