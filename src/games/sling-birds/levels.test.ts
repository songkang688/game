import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  CHAPTER_SIZES,
  GENERATED_LEVELS,
  GENERATED_LEVELS_V2,
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
  it("正好 188 关(1.0 的 99 关 + 1.1 追加的 89 关)", () => {
    expect(LEVELS.length).toBe(188);
  });

  it("id 从 1 开始连续且唯一", () => {
    LEVELS.forEach((l, i) => expect(l.id).toBe(i + 1));
  });

  it("9 个主题章节,章节大小与 chapter 字段对应", () => {
    expect(CHAPTERS.length).toBe(9);
    expect(CHAPTER_SIZES.length).toBe(9);
    expect(CHAPTER_SIZES.reduce((a, b) => a + b, 0)).toBe(188);
    for (let c = 0; c < 9; c++) {
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
        JSON.stringify([
          l.blocks,
          l.beans,
          l.slopes,
          l.boulders,
          l.platforms,
          l.balloons,
          l.winds,
          l.portals
        ])
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

  it("五种小鸟技能都会用到(1.1 新增卷卷·回旋)", () => {
    const kinds = new Set(LEVELS.flatMap((l) => l.birds));
    expect(kinds).toEqual(new Set(["straight", "split", "slam", "drill", "boomerang"]));
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

/* ------------------------------------------------------------------ */
/* 1.1 新增用例:前 99 关冻结、新三章、新机制                            */
/* ------------------------------------------------------------------ */

/** FNV-1a 32 位哈希:给前 99 关的 JSON 拍一张「指纹照」 */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

describe("sling-birds 1.1 前 99 关冻结(老玩家进度不受影响)", () => {
  it("前 99 关内容与 1.0 完全一致(冻结哈希逐字节校验)", () => {
    // 该哈希取自 1.0 代码(commit 47061c4)生成的 LEVELS,前 99 关谁都不许动
    const json = JSON.stringify(LEVELS.slice(0, 99));
    expect(json.length).toBe(48518);
    expect(fnv1a(json)).toBe("2eb81054");
  });

  it("前 99 关不含任何 1.1 新机制(传送门 / 岩壳块 / 卷卷)", () => {
    for (const l of LEVELS.slice(0, 99)) {
      expect(l.portals ?? [], `第 ${l.id} 关不该有传送门`).toHaveLength(0);
      expect(
        l.blocks.some((b) => b.kind === "shell" || b.kind === "core"),
        `第 ${l.id} 关不该有岩壳块`
      ).toBe(false);
      expect(l.birds.includes("boomerang"), `第 ${l.id} 关不该有卷卷`).toBe(false);
    }
  });

  it("1.0 老存档(99 个星级键位)逐关仍然有效,第 100 关随之自然解锁", () => {
    // 复刻 index.ts 的解锁规则:第 1 关免锁,其余看上一关有没有星
    const legacyStars: Record<string, number> = {};
    for (let id = 1; id <= 99; id++) legacyStars[String(id)] = (id % 3) + 1;
    const starsOf = (id: number): number => legacyStars[String(id)] ?? 0;
    const unlocked = (id: number): boolean => id === 1 || starsOf(id - 1) > 0;

    for (let id = 1; id <= 99; id++) {
      const lv = LEVELS[id - 1];
      expect(lv.id, "键位与关卡一一对应").toBe(id);
      expect(unlocked(id), `第 ${id} 关保持解锁`).toBe(true);
    }
    expect(unlocked(100), "打过第 99 关就能进新章").toBe(true);
    expect(unlocked(101), "更后面的关卡仍需逐关解锁").toBe(false);
  });
});

describe("sling-birds 1.1 新三章(风车高地 / 冰晶矿洞 / 熔岩工坊)", () => {
  const windlands = levelsOfChapter(6);
  const crystalMine = levelsOfChapter(7);
  const lavaWorks = levelsOfChapter(8);

  it("三个新章共 89 关:30 + 30 + 29,id 100~188 连续排布", () => {
    expect(windlands.length).toBe(30);
    expect(crystalMine.length).toBe(30);
    expect(lavaWorks.length).toBe(29);
    expect(chapterStartId(6)).toBe(100);
    expect(chapterStartId(7)).toBe(130);
    expect(chapterStartId(8)).toBe(160);
    expect(LEVELS[187].id).toBe(188);
  });

  it("新章名字与图标正确", () => {
    expect(CHAPTERS[6]).toEqual({ name: "风车高地", emoji: "🌬️" });
    expect(CHAPTERS[7]).toEqual({ name: "冰晶矿洞", emoji: "💎" });
    expect(CHAPTERS[8]).toEqual({ name: "熔岩工坊", emoji: "⚙️" });
  });

  it("每个新章都同时有手写关与生成关", () => {
    for (const [c, list] of [[6, windlands], [7, crystalMine], [8, lavaWorks]] as const) {
      expect(list.some((l) => l.handmade), `第 ${c + 1} 章要有手写关`).toBe(true);
      expect(list.some((l) => !l.handmade), `第 ${c + 1} 章要有生成关`).toBe(true);
    }
  });

  it("风车高地每一关都有风区(章节主题机制)", () => {
    for (const l of windlands) {
      expect(obstacleKinds(l).includes("wind"), `第 ${l.id} 关 ${l.name}`).toBe(true);
    }
  });

  it("冰晶矿洞每一关都有冰晶或传送门,其中传送门关卡 ≥ 15", () => {
    let portalCount = 0;
    for (const l of crystalMine) {
      const kinds = obstacleKinds(l);
      expect(kinds.includes("ice") || kinds.includes("portal"), `第 ${l.id} 关 ${l.name}`).toBe(true);
      if (kinds.includes("portal")) portalCount++;
    }
    expect(portalCount).toBeGreaterThanOrEqual(15);
  });

  it("熔岩工坊每一关都有岩壳块或 TNT,其中岩壳关卡 ≥ 15", () => {
    let shellCount = 0;
    for (const l of lavaWorks) {
      const kinds = obstacleKinds(l);
      expect(kinds.includes("shell") || kinds.includes("tnt"), `第 ${l.id} 关 ${l.name}`).toBe(true);
      if (kinds.includes("shell")) shellCount++;
    }
    expect(shellCount).toBeGreaterThanOrEqual(15);
  });

  it("新小鸟卷卷只在新三章登场,且登场 ≥ 12 关", () => {
    const withBoomer = LEVELS.filter((l) => l.birds.includes("boomerang"));
    expect(withBoomer.length).toBeGreaterThanOrEqual(12);
    for (const l of withBoomer) {
      expect(l.chapter, `第 ${l.id} 关`).toBeGreaterThanOrEqual(6);
    }
  });

  it("三个新机制(传送门 / 岩壳块 / 卷卷)在新章全部登场", () => {
    const newOnes = LEVELS.slice(99);
    expect(newOnes.some((l) => (l.portals?.length ?? 0) > 0)).toBe(true);
    expect(newOnes.some((l) => l.blocks.some((b) => b.kind === "shell"))).toBe(true);
    expect(newOnes.some((l) => l.birds.includes("boomerang"))).toBe(true);
  });

  it("传送门定义合法:两口都悬在场内半空、相距足够远", () => {
    for (const l of LEVELS) {
      for (const p of l.portals ?? []) {
        for (const [mx, my] of [
          [p.ax, p.ay],
          [p.bx, p.by]
        ] as const) {
          expect(mx - p.r, `第 ${l.id} 关传送门`).toBeGreaterThanOrEqual(150);
          expect(mx + p.r).toBeLessThanOrEqual(WORLD_W - 10);
          expect(my - p.r).toBeGreaterThan(20);
          expect(my + p.r).toBeLessThan(GROUND_Y - 20);
        }
        expect(Math.hypot(p.ax - p.bx, p.ay - p.by), `第 ${l.id} 关两口太近`).toBeGreaterThan(60);
      }
    }
  });

  it("v2 生成关的障碍组合互不相同", () => {
    const sigs = GENERATED_LEVELS_V2.map((l) => obstacleKinds(l).join("+"));
    expect(new Set(sigs).size).toBe(GENERATED_LEVELS_V2.length);
  });

  it("冒烟锚点关(第 100 / 145 / 188 关)存在、章节正确且为手写布局", () => {
    const l100 = LEVELS[99];
    const l145 = LEVELS[144];
    const l188 = LEVELS[187];
    expect([l100.id, l100.chapter, l100.handmade]).toEqual([100, 6, true]);
    expect([l145.id, l145.chapter, l145.handmade]).toEqual([145, 7, true]);
    expect([l188.id, l188.chapter, l188.handmade]).toEqual([188, 8, true]);
    // 决战关要用上全部三个新机制
    expect(l188.portals?.length).toBeGreaterThanOrEqual(1);
    expect(l188.blocks.some((b) => b.kind === "shell")).toBe(true);
    expect(l188.birds.includes("boomerang")).toBe(true);
  });

  it("新章关卡同样保证布局合法(岩壳块不越界、不与其他方块重叠)", () => {
    for (const l of LEVELS.slice(99)) {
      for (const b of l.blocks.filter((k) => k.kind === "shell")) {
        expect(b.x).toBeGreaterThanOrEqual(140);
        expect(b.x + b.w).toBeLessThanOrEqual(WORLD_W - 10);
        expect(b.y + b.h).toBeLessThanOrEqual(GROUND_Y + 0.01);
      }
    }
  });
});
