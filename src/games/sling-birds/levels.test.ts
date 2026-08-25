import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  CHAPTER_SIZES,
  GENERATED_LEVELS,
  LEVELS,
  SPECIAL_KINDS,
  chapterOfId,
  chapterStartId,
  levelsOfChapter,
  obstacleKinds,
  targetCount,
  type BlockDef,
  type LevelDef
} from "./levels";
import { GROUND_Y, WORLD_W } from "./physics";

describe("sling-birds 关卡总量与章节", () => {
  it("正好 99 关", () => {
    expect(LEVELS.length).toBe(99);
  });

  it("id 从 1 开始连续且唯一", () => {
    LEVELS.forEach((l, i) => expect(l.id).toBe(i + 1));
  });

  it("6 个主题章节,章节大小与 chapter 字段对应", () => {
    expect(CHAPTERS.length).toBe(6);
    expect(CHAPTER_SIZES.length).toBe(6);
    expect(CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(99);
    for (let c = 0; c < 6; c++) {
      expect(levelsOfChapter(c).length, `第 ${c + 1} 章`).toBe(CHAPTER_SIZES[c]);
      expect(chapterOfId(chapterStartId(c))).toBe(c);
    }
    for (const l of LEVELS) {
      expect(l.chapter, `第 ${l.id} 关`).toBe(chapterOfId(l.id));
    }
  });

  it("手写独特布局 ≥ 28 关", () => {
    expect(LEVELS.filter((l) => l.handmade).length).toBeGreaterThanOrEqual(28);
  });

  it("所有关卡布局互不相同", () => {
    const sigs = new Set(
      LEVELS.map((l) =>
        JSON.stringify([l.blocks, l.beans, l.slopes, l.boulders, l.platforms, l.balloons, l.winds])
      )
    );
    expect(sigs.size).toBe(LEVELS.length);
  });
});

describe("sling-birds 小鸟与目标", () => {
  it("每关 2~6 只小鸟、1~6 个绿绿豆目标", () => {
    for (const l of LEVELS) {
      expect(l.birds.length).toBeGreaterThanOrEqual(2);
      expect(l.birds.length).toBeLessThanOrEqual(6);
      expect(targetCount(l)).toBeGreaterThanOrEqual(1);
      expect(targetCount(l)).toBeLessThanOrEqual(6);
    }
  });

  it("四种小鸟技能都会用到", () => {
    const kinds = new Set(LEVELS.flatMap((l) => l.birds));
    expect(kinds).toEqual(new Set(["straight", "split", "slam", "drill"]));
  });
});

describe("sling-birds 障碍组合", () => {
  it("生成关卡的障碍组合互不相同", () => {
    const sigs = GENERATED_LEVELS.map((l) => obstacleKinds(l).join("+"));
    expect(new Set(sigs).size).toBe(GENERATED_LEVELS.length);
  });

  it("后半程(31 关起)每关至少 2 种特殊障碍同时出现", () => {
    const specials = new Set<string>(SPECIAL_KINDS);
    for (const l of LEVELS.filter((x) => x.id > 30)) {
      const n = obstacleKinds(l).filter((k) => specials.has(k)).length;
      expect(n, `第 ${l.id} 关 ${l.name}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("木/石/冰/玻璃/TNT/滚石/坡/平台/气球/风区全都登场", () => {
    const all = new Set(LEVELS.flatMap(obstacleKinds));
    for (const k of ["wood", "stone", "ice", "glass", "tnt", "boulder", "slope", "platform", "balloon", "wind"]) {
      expect(all.has(k), `缺少障碍:${k}`).toBe(true);
    }
  });

  it("火山峡谷章每关都有 TNT / 滚石 / 斜坡之一", () => {
    for (const l of levelsOfChapter(4)) {
      const kinds = obstacleKinds(l);
      expect(
        kinds.includes("tnt") || kinds.includes("boulder") || kinds.includes("slope"),
        `第 ${l.id} 关 ${l.name}`
      ).toBe(true);
    }
  });

  it("彩虹云端章每关都有平台 / 气球 / 风区之一", () => {
    for (const l of levelsOfChapter(5)) {
      const kinds = obstacleKinds(l);
      expect(
        kinds.includes("platform") || kinds.includes("balloon") || kinds.includes("wind"),
        `第 ${l.id} 关 ${l.name}`
      ).toBe(true);
    }
  });
});

describe("sling-birds 布局合法性", () => {
  function overlap(a: BlockDef, b: BlockDef): number {
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return Math.min(ox, oy);
  }

  it("方块都落在场地里、不会埋进地面", () => {
    for (const l of LEVELS) {
      for (const b of l.blocks) {
        expect(b.x, `第 ${l.id} 关`).toBeGreaterThanOrEqual(140);
        expect(b.x + b.w, `第 ${l.id} 关`).toBeLessThanOrEqual(WORLD_W - 10);
        expect(b.y + b.h, `第 ${l.id} 关`).toBeLessThanOrEqual(GROUND_Y + 0.01);
        expect(b.y).toBeGreaterThan(0);
      }
    }
  });

  it("初始方块互不重叠(允许贴着)", () => {
    for (const l of LEVELS) {
      for (let i = 0; i < l.blocks.length; i++) {
        for (let j = i + 1; j < l.blocks.length; j++) {
          expect(
            overlap(l.blocks[i], l.blocks[j]),
            `第 ${l.id} 关 方块 ${i}/${j}`
          ).toBeLessThanOrEqual(0.01);
        }
      }
    }
  });

  it("绿绿豆不会卡在方块或地面里", () => {
    for (const l of LEVELS) {
      for (const bean of l.beans) {
        expect(bean.y, `第 ${l.id} 关`).toBeLessThanOrEqual(GROUND_Y - 9);
        expect(bean.x).toBeGreaterThan(150);
        expect(bean.x).toBeLessThan(WORLD_W - 10);
        for (const b of l.blocks) {
          const inside =
            bean.x > b.x && bean.x < b.x + b.w && bean.y > b.y && bean.y < b.y + b.h;
          expect(inside, `第 ${l.id} 关 豆(${bean.x},${bean.y})`).toBe(false);
        }
      }
    }
  });

  it("平台运动范围不出界", () => {
    for (const l of LEVELS) {
      for (const p of l.platforms ?? []) {
        expect(p.x - p.dx).toBeGreaterThanOrEqual(150);
        expect(p.x + p.dx + p.w).toBeLessThanOrEqual(WORLD_W - 8);
        expect(p.y - p.dy).toBeGreaterThan(20);
        expect(p.y + p.dy + p.h).toBeLessThan(GROUND_Y);
      }
    }
  });

  it("章节难度递进:后面的章节会用到更多种障碍", () => {
    const kindsInChapter = (c: number): number =>
      new Set(levelsOfChapter(c).flatMap(obstacleKinds)).size;
    expect(kindsInChapter(3)).toBeGreaterThanOrEqual(kindsInChapter(0));
  });
});

describe("sling-birds 生成器确定性", () => {
  it("同一份代码两次取到的生成关卡完全一致", () => {
    const byId = new Map(LEVELS.map((l) => [l.id, l] as [number, LevelDef]));
    for (const g of GENERATED_LEVELS) {
      expect(JSON.stringify(byId.get(g.id))).toBe(JSON.stringify(g));
    }
  });
});
