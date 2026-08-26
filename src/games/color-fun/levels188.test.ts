// 1.1：涂色小屋 99 → 188 的新章节、新玩法与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, indexInChapter, totalSize, TOTAL_LEVELS } from "../level99";
import {
  ALL_PAINTS,
  ANALOGOUS_NEXT,
  buildLevel,
  CHAPTERS,
  COMPLEMENT,
  LEGACY_CHAPTER_SIZES,
  LEGACY_LEVELS,
  LEGEND_SYMBOLS,
  LEVELS,
  MIX_TABLE,
  PICTURES,
  ruleText,
  SHADE_LADDERS,
  SHADE_PAINTS,
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

describe("涂色小屋 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：17/17/17/16/16/16", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 6).map((c) => c.name)).toEqual([
      "温馨小屋村", "快乐农场镇", "海底调色湾", "夜空数字园", "彩虹深色坡", "星光记忆城",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
  });

  it("前 99 关每关的布局一笔未改（生成指纹回归）", () => {
    const digest = fnv(JSON.stringify(Array.from({ length: 99 }, (_, i) => buildLevel(i))));
    expect(digest).toBe("ff070e54");
  });

  it("前 99 关只有 1.0 的四种玩法，没有任何新字段", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(["guide", "mix", "number", "memory"]).toContain(lv.mode);
      expect(lv.order).toBeUndefined();
      expect(lv.given).toBeUndefined();
      expect(lv.rules).toBeUndefined();
      expect(lv.legend).toBeUndefined();
      expect(lv.budget).toBeUndefined();
    }
  });
});

describe("涂色小屋 · 1.1 新村镇", () => {
  it("总关数 188，末尾追加了 4 个全新村镇共 89 关", () => {
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    const fresh = CHAPTERS.slice(6);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(totalSize(fresh)).toBe(89);
    expect(fresh.map((c) => c.name)).toEqual(["晨昏渐变谷", "互补配色坊", "图例大画布", "限色挑战场"]);
  });

  it("新村镇配色文案齐全，且不含任何英文商标字样", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.name).not.toMatch(/[A-Za-z]/);
      expect(ch.desc).not.toMatch(/[A-Za-z]/);
    }
  });

  it("四张新线稿画得出来：区域够多、id 不重复、大画布至少 12 块", () => {
    for (const pic of PICTURES.slice(6)) {
      expect(pic.regions.length).toBeGreaterThanOrEqual(8);
      expect(new Set(pic.regions.map((r) => r.id)).size).toBe(pic.regions.length);
      for (const r of pic.regions) {
        expect(r.svg).toContain("/>");
        expect(r.name.length).toBeGreaterThan(0);
      }
    }
    expect(PICTURES[8].regions.length).toBeGreaterThanOrEqual(12);
  });

  it("新颜料与色环数据自检：阶梯由浅到深、互补成对、邻近成环", () => {
    for (const p of SHADE_PAINTS) expect(ALL_PAINTS[p.name]).toBe(p.value);
    for (const ladder of SHADE_LADDERS) {
      expect(ladder).toHaveLength(3);
      for (const c of ladder) expect(ALL_PAINTS[c]).toBeDefined();
    }
    for (const [a, b] of Object.entries(COMPLEMENT)) {
      expect(COMPLEMENT[b]).toBe(a);
      expect(ALL_PAINTS[b]).toBeDefined();
    }
    // 邻近色顺着走六步正好回到原点
    let cur = "红色";
    for (let i = 0; i < 6; i++) cur = ANALOGOUS_NEXT[cur];
    expect(cur).toBe("红色");
    expect(new Set(LEGEND_SYMBOLS).size).toBe(LEGEND_SYMBOLS.length);
  });
});

describe("涂色小屋 · 第 100–188 关逐关可涂完", () => {
  it("每一关都能涂完：任务颜色要么在盘里，要么调得出来", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      const pic = PICTURES[cfg.pic];
      const ids = new Set(pic.regions.map((r) => r.id));
      expect(cfg.pic).toBe(chapterOf(CHAPTERS, lv));
      expect(cfg.tasks.length).toBeGreaterThanOrEqual(4);
      expect(new Set(cfg.tasks.map((k) => k.region)).size).toBe(cfg.tasks.length);
      for (const task of cfg.tasks) {
        expect(ids.has(task.region)).toBe(true);
        expect(ALL_PAINTS[task.color]).toBeDefined();
        expect(cfg.palette.includes(task.color) || cfg.needMix.includes(task.color)).toBe(true);
      }
      for (const c of cfg.needMix) {
        expect(Object.values(MIX_TABLE)).toContain(c);
        expect(cfg.palette).not.toContain(c);
      }
      expect(cfg.maxWrong).toBeGreaterThanOrEqual(3);
    }
  });

  it("渐变关：一定按由浅到深排序，且颜色都来自同一条明暗阶梯", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      if (cfg.mode !== "shade") continue;
      expect(cfg.order).toBe(true);
      expect(cfg.tasks.length).toBeGreaterThanOrEqual(5);
      const colors = cfg.tasks.map((k) => k.color);
      // 每一段连续的任务都能在某条阶梯上找到，并且下标递增
      let ladder = SHADE_LADDERS.find((l) => l.includes(colors[0]));
      expect(ladder).toBeDefined();
      let prev = -1;
      for (const c of colors) {
        if (!ladder!.includes(c)) {
          ladder = SHADE_LADDERS.find((l) => l.includes(c));
          expect(ladder).toBeDefined();
          prev = -1;
        }
        const at = ladder!.indexOf(c);
        expect(at).toBeGreaterThan(prev);
        prev = at;
      }
    }
  });

  it("配色规则关：每块都有规则，颜色严格等于规则推出来的那个", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      if (cfg.mode !== "rule") continue;
      expect(cfg.given && cfg.given.length).toBeGreaterThanOrEqual(2);
      expect(cfg.rules).toBeDefined();
      const givenAt = new Map((cfg.given ?? []).map((g) => [g.region, g.color]));
      for (const task of cfg.tasks) {
        const rule = cfg.rules!.find((r) => r.region === task.region);
        expect(rule).toBeDefined();
        const ref = givenAt.get(rule!.refRegion);
        expect(ref).toBeDefined();
        const want = rule!.kind === "complement" ? COMPLEMENT[ref!] : ANALOGOUS_NEXT[ref!];
        expect(task.color).toBe(want);
        // 参照块本身不能又是要涂的块
        expect(givenAt.has(task.region)).toBe(false);
      }
    }
  });

  it("图例大画布关：每种任务色都在图例里，符号互不重复", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      if (cfg.mode !== "legend") continue;
      expect(cfg.legend).toBeDefined();
      expect(cfg.tasks.length).toBeGreaterThanOrEqual(8);
      const symbols = cfg.legend!.map((x) => x.symbol);
      expect(new Set(symbols).size).toBe(symbols.length);
      const mapped = new Map(cfg.legend!.map((x) => [x.color, x.symbol]));
      for (const task of cfg.tasks) expect(mapped.has(task.color)).toBe(true);
      for (const item of cfg.legend!) expect(cfg.palette).toContain(item.color);
    }
  });

  it("限色关：只给三原色，预算够把需要的颜色全调出来还有富余", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      if (cfg.mode !== "limited") continue;
      expect(cfg.palette).toEqual(expect.arrayContaining(["红色", "黄色", "蓝色"]));
      expect(cfg.palette).toHaveLength(3);
      expect(cfg.needMix.length).toBeGreaterThanOrEqual(2);
      expect(cfg.budget).toBeGreaterThan(cfg.needMix.length);
      for (const c of cfg.needMix) expect(Object.values(MIX_TABLE)).toContain(c);
    }
  });

  it("四个新村镇各玩各的，玩法一个都不重样", () => {
    const modeOf = (lv: number): string => LEVELS[lv].mode;
    expect(modeOf(99)).toBe("shade");
    expect(modeOf(121)).toBe("rule");
    expect(modeOf(143)).toBe("legend");
    expect(modeOf(166)).toBe("limited");
    expect(modeOf(187)).toBe("limited");
    expect(new Set(NEW_LEVELS.map(modeOf)).size).toBe(4);
    for (const lv of NEW_LEVELS) {
      expect(["guide", "mix", "number", "memory"]).not.toContain(modeOf(lv));
    }
  });

  it("同一关重玩布局一致（确定性生成）", () => {
    for (const lv of [99, 121, 143, 166, 187]) {
      expect(JSON.stringify(buildLevel(lv))).toBe(JSON.stringify(buildLevel(lv)));
      expect(JSON.stringify(buildLevel(lv))).toBe(JSON.stringify(LEVELS[lv]));
    }
  });

  it("难度往上走：新村镇的块数更多、容错更少", () => {
    const lastNew = LEVELS[187];
    expect(lastNew.maxWrong).toBeLessThanOrEqual(LEVELS[0].maxWrong);
    expect(LEVELS[143].tasks.length).toBeGreaterThan(LEVELS[0].tasks.length);
    for (const lv of [110, 132, 155, 180]) {
      expect(indexInChapter(CHAPTERS, lv)).toBeGreaterThan(0);
      expect(LEVELS[lv].maxWrong).toBeLessThanOrEqual(4);
    }
  });

  it("规则文案只讲关系、不报答案", () => {
    expect(ruleText("complement", "草地")).toBe("草地的互补色");
    expect(ruleText("analogous", "天空")).toContain("下一格");
    for (const kind of ["complement", "analogous"] as const) {
      const line = ruleText(kind, "屋顶");
      for (const name of Object.keys(COMPLEMENT)) expect(line).not.toContain(name);
    }
  });
});
