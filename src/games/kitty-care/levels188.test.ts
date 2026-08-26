// 1.1：萌猫小屋 99 → 188 的新主题、新机制与前 99 关回归
import { describe, expect, it } from "vitest";
import { chapterOf, mulberry32, totalSize, TOTAL_LEVELS } from "../level99";
import {
  buildCureRound,
  buildStyleRound,
  CAT_CREW,
  catForTask,
  CHAPTERS,
  CURE_TOOLS,
  LEGACY_CHAPTER_SIZES,
  LEGACY_LEVELS,
  LEVELS,
  moodAfter,
  moodFace,
  moodMistakeBudget,
  moodSurvivesPerfectRun,
  roundSeed,
  STYLE_THEMES,
  STYLE_WARDROBE,
  styleGrade,
  styleItemScore,
  styleScore,
  SYMPTOMS,
  type KittyTask,
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
/** 四个新章的关号区间（0 基，含头不含尾） */
const CH = { cats: [99, 122], mood: [122, 144], cure: [144, 166], style: [166, 188] } as const;

describe("萌猫小屋 · 1.0 前 99 关回归", () => {
  it("章节切分与 1.0 完全一致：17/17/17/16/16/16", () => {
    expect(CHAPTERS.slice(0, 6).map((c) => c.size)).toEqual(LEGACY_CHAPTER_SIZES);
    expect(CHAPTERS.slice(0, 6).map((c) => c.name)).toEqual([
      "春日小奶猫", "夏日玩水", "秋日野餐", "冬日暖炉", "生日派对", "梦幻旅行",
    ]);
    expect(LEGACY_CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
    expect(LEGACY_LEVELS).toBe(99);
  });

  it("前 99 关每关参数一笔未改（生成指纹回归）", () => {
    expect(fnv(JSON.stringify(LEVELS.slice(0, 99)))).toBe("e212416f");
  });

  it("前 99 关一律没有任何 1.1 新机制字段与新任务", () => {
    for (let i = 0; i < LEGACY_LEVELS; i++) {
      const lv = LEVELS[i];
      expect(lv.cats).toBeUndefined();
      expect(lv.moodStart).toBeUndefined();
      expect(lv.moodMax).toBeUndefined();
      expect(lv.cureSteps).toBeUndefined();
      expect(lv.styleSlots).toBeUndefined();
      expect(lv.tasks).not.toContain("cure");
      expect(lv.tasks).not.toContain("style");
      expect(lv.theme).toBeLessThan(6);
    }
  });
});

describe("萌猫小屋 · 1.1 新主题", () => {
  it("总关数 188，末尾追加了 4 个全新主题共 89 关", () => {
    expect(LEVELS).toHaveLength(TOTAL_LEVELS);
    expect(totalSize(CHAPTERS)).toBe(188);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    const fresh = CHAPTERS.slice(6);
    expect(fresh.length).toBeGreaterThanOrEqual(3);
    expect(totalSize(fresh)).toBe(89);
    expect(fresh.map((c) => c.name)).toEqual(["双猫客厅", "心情小屋", "暖心诊所", "时装小舞台"]);
  });

  it("新主题文案齐全，且不含任何英文商标字样", () => {
    for (const ch of CHAPTERS.slice(6)) {
      expect(ch.emoji.length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(ch.desc.length).toBeGreaterThanOrEqual(8);
      expect(ch.name).not.toMatch(/[A-Za-z]/);
      expect(ch.desc).not.toMatch(/[A-Za-z]/);
    }
  });

  it("四个新主题各有招牌机制：多猫 / 心情 / 看病 / 搭配", () => {
    for (let lv = CH.cats[0]; lv < CH.cats[1]; lv++) expect(LEVELS[lv].cats ?? 0).toBeGreaterThanOrEqual(2);
    for (let lv = CH.mood[0]; lv < CH.mood[1]; lv++) expect(LEVELS[lv].moodStart ?? 0).toBeGreaterThan(0);
    for (let lv = CH.cure[0]; lv < CH.cure[1]; lv++) {
      expect(LEVELS[lv].tasks).toContain("cure");
      expect(LEVELS[lv].cureSteps ?? 0).toBeGreaterThanOrEqual(2);
    }
    for (let lv = CH.style[0]; lv < CH.style[1]; lv++) {
      expect(LEVELS[lv].tasks).toContain("style");
      expect(LEVELS[lv].styleSlots ?? 0).toBeGreaterThanOrEqual(2);
    }
    // 招牌任务不越界：看病只在诊所章，搭配只在时装章
    for (const lv of NEW_LEVELS) {
      const ci = chapterOf(CHAPTERS, lv);
      if (ci !== 8) expect(LEVELS[lv].tasks).not.toContain("cure");
      if (ci !== 9) expect(LEVELS[lv].tasks).not.toContain("style");
    }
  });

  it("新章内部难度递进：任务更多、护理更长、搭配更多件", () => {
    expect(LEVELS[CH.cats[0]].cats).toBeLessThan(LEVELS[CH.cats[1] - 1].cats as number);
    expect(LEVELS[CH.mood[0]].moodStart as number).toBeGreaterThan(LEVELS[CH.mood[1] - 1].moodStart as number);
    expect(LEVELS[CH.cure[0]].cureSteps as number).toBeLessThan(LEVELS[CH.cure[1] - 1].cureSteps as number);
    expect(LEVELS[CH.style[0]].styleSlots as number).toBeLessThan(LEVELS[CH.style[1] - 1].styleSlots as number);
  });

  it("同一关每次生成完全一致（确定性）", () => {
    for (const lv of [99, 120, 143, 160, 187]) {
      expect(JSON.stringify(LEVELS[lv])).toBe(JSON.stringify(LEVELS[lv]));
      expect(buildCureRound(roundSeed(lv, 1), 3, 4)).toEqual(buildCureRound(roundSeed(lv, 1), 3, 4));
      expect(buildStyleRound(roundSeed(lv, 2), 3, 4)).toEqual(buildStyleRound(roundSeed(lv, 2), 3, 4));
    }
  });
});

describe("萌猫小屋 · 第 100–188 关逐关可解", () => {
  it("每一关的任务清单都合法，且新任务只出现在自己的章里", () => {
    const kinds: KittyTask[] = ["feed", "play", "wash", "sleep", "dress", "cure", "style"];
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      expect(cfg.tasks.length).toBeGreaterThanOrEqual(3);
      expect(cfg.tasks.length).toBeLessThanOrEqual(5);
      for (const task of cfg.tasks) expect(kinds).toContain(task);
      expect(cfg.playTaps).toBeGreaterThanOrEqual(4);
      expect(cfg.playTaps).toBeLessThanOrEqual(12);
      expect(cfg.washSpots).toBeGreaterThanOrEqual(4);
      expect(cfg.washSpots).toBeLessThanOrEqual(12);
      expect(cfg.options).toBeGreaterThanOrEqual(3);
      expect(cfg.options).toBeLessThanOrEqual(5);
      expect(cfg.notes).toBeGreaterThanOrEqual(4);
      expect(cfg.notes).toBeLessThanOrEqual(6);
      expect(cfg.theme).toBe(chapterOf(CHAPTERS, lv));
    }
  });

  it("每一关的心情条：零失误一定撑得住，还留得下至少两次失误的余地", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      if (!cfg.moodStart) continue;
      const max = cfg.moodMax ?? 10;
      expect(cfg.moodStart).toBeLessThanOrEqual(max);
      expect(moodSurvivesPerfectRun(cfg.moodStart, cfg.tasks.length, max)).toBe(true);
      expect(moodMistakeBudget(cfg.moodStart, max)).toBeGreaterThanOrEqual(2);
    }
  });

  it("每一关的看病流程：每一步的选项里正确答案有且只有一个", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      cfg.tasks.forEach((task, ti) => {
        if (task !== "cure") return;
        const round = buildCureRound(roundSeed(lv, ti), cfg.cureSteps ?? 2, Math.min(cfg.options + 1, 6));
        expect(round.steps.length).toBe(cfg.cureSteps);
        expect(SYMPTOMS).toContain(round.symptom);
        for (const step of round.steps) {
          expect(step.options.length).toBe(Math.min(cfg.options + 1, 6));
          expect(step.options.filter((tool) => tool.name === step.answer.name)).toHaveLength(1);
          expect(new Set(step.options.map((t) => t.name)).size).toBe(step.options.length);
          expect(CURE_TOOLS).toContain(step.answer);
        }
        // 护理单就是症状本来的顺序，照着点一定能做完
        expect(round.steps.map((s) => s.answer.name)).toEqual(round.symptom.order.slice(0, round.steps.length));
      });
    }
  });

  it("每一关的搭配任务：每个部位都恰好有一件最搭 + 一件百搭，满分拿得到", () => {
    for (const lv of NEW_LEVELS) {
      const cfg = LEVELS[lv];
      cfg.tasks.forEach((task, ti) => {
        if (task !== "style") return;
        const round = buildStyleRound(roundSeed(lv, ti), cfg.styleSlots ?? 2, Math.min(cfg.options + 1, 6));
        expect(round.slots.length).toBe(cfg.styleSlots);
        expect(round.maxScore).toBe(round.slots.length * 2);
        expect(STYLE_THEMES).toContain(round.theme);
        expect(new Set(round.slots.map((s) => s.slot)).size).toBe(round.slots.length);
        const best = round.slots.map((s) => {
          const hits = s.options.filter((item) => item.theme === round.theme);
          const neutral = s.options.filter((item) => item.theme === null);
          expect(hits).toHaveLength(1);
          expect(neutral).toHaveLength(1);
          return hits[0];
        });
        // 每个部位都挑最搭的那件，一定拿满分、一定评到「超搭」
        expect(styleScore(best, round.theme)).toBe(round.maxScore);
        expect(styleGrade(styleScore(best, round.theme), round.maxScore).stars).toBe(3);
      });
    }
  });

  it("每一关都至少有一只猫，多猫关的任务人人有份", () => {
    for (const lv of NEW_LEVELS) {
      const cats = LEVELS[lv].cats ?? 1;
      expect(cats).toBeGreaterThanOrEqual(1);
      expect(cats).toBeLessThanOrEqual(CAT_CREW.length);
      const served = new Set(LEVELS[lv].tasks.map((_, i) => catForTask(i, cats)));
      expect(served.size).toBe(Math.min(cats, LEVELS[lv].tasks.length));
    }
  });
});

describe("萌猫小屋 · 1.1 机制纯函数", () => {
  it("多猫轮值：编号一定落在 0..cats-1，且轮着来不落下谁", () => {
    for (let cats = 1; cats <= CAT_CREW.length; cats++) {
      for (let i = 0; i < 12; i++) {
        const who = catForTask(i, cats);
        expect(who).toBeGreaterThanOrEqual(0);
        expect(who).toBeLessThan(cats);
      }
      expect(new Set(Array.from({ length: cats }, (_, i) => catForTask(i, cats))).size).toBe(cats);
    }
    // 参数不对也不会崩：至少还有一只猫
    expect(catForTask(3, 0)).toBe(0);
    expect(catForTask(-1, 2)).toBe(1);
  });

  it("心情值：做对涨 1、做错掉 2、安抚回 2，永远夹在 0..上限之间", () => {
    expect(moodAfter(5, "done", 10)).toBe(6);
    expect(moodAfter(5, "miss", 10)).toBe(3);
    expect(moodAfter(5, "soothe", 10)).toBe(7);
    expect(moodAfter(10, "done", 10)).toBe(10);
    expect(moodAfter(1, "miss", 10)).toBe(0);
    expect(moodAfter(0, "miss", 10)).toBe(0);
    expect(moodMistakeBudget(9, 10)).toBe(4);
    expect(moodMistakeBudget(5, 10)).toBe(2);
  });

  it("心情表情只会从开心变成想被安慰，不会出现责备的脸", () => {
    const faces = [0, 2, 4, 6, 8, 10].map((m) => moodFace(m, 10));
    expect(faces[0]).toBe("🙀");
    expect(faces[5]).toBe("😻");
    expect(new Set(faces).size).toBeGreaterThanOrEqual(3);
    for (const f of faces) expect(f).not.toMatch(/[A-Za-z]/);
  });

  it("五种症状的护理顺序各不相同，用到的东西都在护理柜里", () => {
    expect(SYMPTOMS.length).toBeGreaterThanOrEqual(5);
    const seqs = new Set(SYMPTOMS.map((s) => s.order.join(">")));
    expect(seqs.size).toBe(SYMPTOMS.length);
    const names = new Set(CURE_TOOLS.map((t) => t.name));
    for (const s of SYMPTOMS) {
      expect(s.order.length).toBeGreaterThanOrEqual(4);
      expect(new Set(s.order).size).toBe(s.order.length);
      for (const step of s.order) expect(names.has(step)).toBe(true);
      expect(s.name).not.toMatch(/[A-Za-z]/);
    }
  });

  it("看病选项数受护理柜大小约束，参数越界也不会崩", () => {
    const round = buildCureRound(7, 99, 99);
    expect(round.steps.length).toBeLessThanOrEqual(round.symptom.order.length);
    expect(round.steps[0].options.length).toBe(CURE_TOOLS.length);
    const tiny = buildCureRound(7, 0, 0);
    expect(tiny.steps).toHaveLength(1);
    expect(tiny.steps[0].options.length).toBe(2);
  });

  it("衣柜：四个部位各有五件主题款 + 一件百搭款，emoji 不重样", () => {
    expect(STYLE_WARDROBE).toHaveLength(4);
    for (const entry of STYLE_WARDROBE) {
      expect(entry.items).toHaveLength(6);
      expect(entry.items.filter((i) => i.theme === null)).toHaveLength(1);
      for (const theme of STYLE_THEMES) {
        expect(entry.items.filter((i) => i.theme === theme)).toHaveLength(1);
      }
      expect(new Set(entry.items.map((i) => i.emoji)).size).toBe(6);
      for (const item of entry.items) expect(item.name).not.toMatch(/[A-Za-z]/);
    }
  });

  it("搭配评分：最搭 2 分、百搭 1 分、不搭 0 分，档位只夸不批评", () => {
    const hat = STYLE_WARDROBE[0].items;
    const beach = hat.find((i) => i.theme === "夏日海边")!;
    const snow = hat.find((i) => i.theme === "冬日雪天")!;
    const any = hat.find((i) => i.theme === null)!;
    expect(styleItemScore(beach, "夏日海边")).toBe(2);
    expect(styleItemScore(any, "夏日海边")).toBe(1);
    expect(styleItemScore(snow, "夏日海边")).toBe(0);
    expect(styleScore([beach, any, snow], "夏日海边")).toBe(3);
    expect(styleGrade(6, 6)).toEqual({ label: "超搭", stars: 3 });
    expect(styleGrade(4, 6).stars).toBe(2);
    expect(styleGrade(1, 6).stars).toBe(1);
    expect(styleGrade(0, 0).stars).toBe(2);
    for (const s of [0, 2, 4, 6]) expect(styleGrade(s, 6).label).not.toMatch(/笨|差|失败/);
  });

  it("同一个种子搭出同一套，换种子会换主题（不是一个模板复制）", () => {
    expect(buildStyleRound(11, 3, 4)).toEqual(buildStyleRound(11, 3, 4));
    const themes = new Set(Array.from({ length: 60 }, (_, i) => buildStyleRound(i * 7 + 1, 2, 4).theme));
    expect(themes.size).toBeGreaterThanOrEqual(4);
    const symptoms = new Set(Array.from({ length: 60 }, (_, i) => buildCureRound(i * 5 + 2, 3, 4).symptom.name));
    expect(symptoms.size).toBeGreaterThanOrEqual(4);
  });

  it("护理与搭配的种子逐关不同，同一关内逐任务也不同", () => {
    const seeds = new Set<number>();
    for (const lv of NEW_LEVELS) for (let t = 0; t < 5; t++) seeds.add(roundSeed(lv, t));
    expect(seeds.size).toBe(NEW_LEVELS.length * 5);
    expect(mulberry32(roundSeed(100, 0))()).not.toBe(mulberry32(roundSeed(100, 1))());
  });
});
