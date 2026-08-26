/**
 * 朵星格斗王 —— 存档与平台接线。
 *
 *  · 无尽连胜的最好成绩只走平台的 `save.recordEndlessBest("fight-king", n)`，
 *    本作不新建 key；1.1 之前散在外面的老 key 只读一次、只取最大值。
 *  · 格斗塔的「直开第 N 层」：`api.initialLevel` / `?level=N` / `#level=N` 三条路，
 *    都是 1 基关号，越界一律 clamp，锁着的层退回能玩的最远那一层。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { save, type StorageLike } from "../../engine/save";
import { CHAPTERS } from "./levels";
import { meta } from "./meta";
import {
  LEGACY_ENDLESS_KEYS,
  bestStreak,
  initialLevelOf,
  locationHints,
  openCampaignLevel,
  readLegacyStreak,
  recordStreak,
  resetMigration,
  streakBadge
} from "./progress";
import { TOTAL_LEVELS, chapterOf, chapterStart, saveStar } from "../level99";

/** 一份内存里的假存储，测试之间互不串味 */
function fakeStore(entries: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    }
  };
}

/* ------------------------------------------------------------------ */
/* 一、无尽连胜成绩                                                    */
/* ------------------------------------------------------------------ */

describe("老 key 迁移", () => {
  beforeEach(() => resetMigration());

  it("三条老 key 里取最大值，数字、JSON 对象、纯文本都认", () => {
    expect(readLegacyStreak(fakeStore({ [LEGACY_ENDLESS_KEYS[0]]: "7" }))).toBe(7);
    expect(readLegacyStreak(fakeStore({ [LEGACY_ENDLESS_KEYS[1]]: '{"streak":11}' }))).toBe(11);
    expect(
      readLegacyStreak(
        fakeStore({
          [LEGACY_ENDLESS_KEYS[0]]: "3",
          [LEGACY_ENDLESS_KEYS[1]]: "9",
          [LEGACY_ENDLESS_KEYS[2]]: "5"
        })
      )
    ).toBe(9);
  });

  it("老 key 坏了、没有、是负数，都当成 0，绝不崩", () => {
    expect(readLegacyStreak(null)).toBe(0);
    expect(readLegacyStreak(fakeStore())).toBe(0);
    expect(readLegacyStreak(fakeStore({ [LEGACY_ENDLESS_KEYS[0]]: "{坏掉的" }))).toBe(0);
    expect(readLegacyStreak(fakeStore({ [LEGACY_ENDLESS_KEYS[0]]: "-4" }))).toBe(0);
  });

  it("第一次记成绩顺手把老纪录搬进平台，老玩家一场都不丢", () => {
    const store = fakeStore({ [LEGACY_ENDLESS_KEYS[0]]: "12" });
    // 这一把只连赢了 3 场，但老纪录 12 场必须留着
    expect(recordStreak(3, store)).toBe(12);
    expect(save.getGameProgress(meta.id).endlessBest).toBe(12);
  });

  it("只搬一次：把老 key 改大也不会再被读进来", () => {
    const store = fakeStore({ [LEGACY_ENDLESS_KEYS[0]]: "12" });
    recordStreak(1, store);
    const bumped = fakeStore({ [LEGACY_ENDLESS_KEYS[0]]: "999" });
    expect(recordStreak(1, bumped)).toBe(12);
  });

  it("新成绩只涨不降，成绩单读的就是平台那一份", () => {
    const store = fakeStore();
    recordStreak(0, store);
    expect(recordStreak(20, store)).toBe(20);
    expect(recordStreak(4, store)).toBe(20);
    expect(bestStreak(store)).toBe(20);
    expect(save.getGameProgress(meta.id).endlessBest).toBe(20);
  });

  it("成绩单那一行字：没纪录时也是鼓励，不是空白", () => {
    expect(streakBadge(0)).toContain("还没有");
    expect(streakBadge(9)).toContain("9");
  });
});

/* ------------------------------------------------------------------ */
/* 二、直开第 N 层                                                     */
/* ------------------------------------------------------------------ */

describe("直开第 N 层的关号换算", () => {
  it("平台给的 initialLevel 优先，1 基转 0 基", () => {
    expect(initialLevelOf(1, "?level=50")).toBe(0);
    expect(initialLevelOf(88, "")).toBe(87);
  });

  it("平台没给就认地址栏，地址栏也没有才认 hash", () => {
    expect(initialLevelOf(undefined, "?level=7")).toBe(6);
    expect(initialLevelOf(undefined, "?a=1&level=30")).toBe(29);
    expect(initialLevelOf(undefined, "", "#level=12")).toBe(11);
    expect(initialLevelOf(undefined, "", "#/fight-king/9")).toBe(8);
  });

  it("三条路都给不出关号就返回 -1，照常回菜单", () => {
    expect(initialLevelOf(undefined, "", "")).toBe(-1);
    expect(initialLevelOf(null, "?other=3", "#nope")).toBe(-1);
    expect(initialLevelOf("十八", "")).toBe(-1);
  });

  it("越界一律 clamp 在 1..188 之间", () => {
    expect(initialLevelOf(0, "")).toBe(0);
    expect(initialLevelOf(-99, "")).toBe(0);
    expect(initialLevelOf(9999, "")).toBe(TOTAL_LEVELS - 1);
    expect(initialLevelOf(TOTAL_LEVELS, "")).toBe(TOTAL_LEVELS - 1);
    expect(initialLevelOf(undefined, "?level=100000")).toBe(TOTAL_LEVELS - 1);
  });

  it("无头环境里没有 location 也读得出空字符串，不会炸", () => {
    expect(locationHints()).toEqual({ search: expect.any(String), hash: expect.any(String) });
  });
});

/* ------------------------------------------------------------------ */
/* 三、在真的地图上替玩家点开那一层                                    */
/* ------------------------------------------------------------------ */

interface FakeNode {
  disabled: boolean;
  clicked: number;
  click: () => void;
}

/** 一份最小的 188 关地图：八个章节页签 + 当前章节的关卡按钮 */
function fakeMap(furthest: number): { host: HTMLElement; viewChapter: () => number; opened: () => number } {
  let viewChapter = 0;
  let opened = -1;
  const tabs: FakeNode[] = CHAPTERS.map((_, i) => ({
    disabled: false,
    clicked: 0,
    click: () => {
      viewChapter = i;
      tabs[i].clicked++;
    }
  }));
  const host = {
    querySelectorAll(sel: string): FakeNode[] {
      if (sel === ".l99-tab") return tabs;
      const start = chapterStart(CHAPTERS, viewChapter);
      return Array.from({ length: CHAPTERS[viewChapter].size }, (_, i) => {
        const level = start + i;
        return {
          disabled: level > furthest,
          clicked: 0,
          click: () => {
            opened = level;
          }
        };
      });
    }
  } as unknown as HTMLElement;
  return { host, viewChapter: () => viewChapter, opened: () => opened };
}

describe("openCampaignLevel", () => {
  it("解锁过的层：先翻到那一章，再把那一关点开", () => {
    // 前 60 关都通了，第 60 关（0 基）就是能玩的最远那一层
    for (let i = 0; i < 60; i++) saveStar(meta.id, i, 3);
    const map = fakeMap(60);
    expect(openCampaignLevel(map.host, 40)).toBe(true);
    expect(map.viewChapter()).toBe(chapterOf(CHAPTERS, 40));
    expect(map.opened()).toBe(40);
  });

  it("还锁着的层不给直开，退回能玩的最远那一层（跳关得走家长授权）", () => {
    for (let i = 0; i < 60; i++) saveStar(meta.id, i, 3);
    const map = fakeMap(60);
    expect(openCampaignLevel(map.host, 187)).toBe(true);
    expect(map.opened()).toBe(60);
    expect(map.viewChapter()).toBe(chapterOf(CHAPTERS, 60));
  });

  it("关号越界一样 clamp，负数回第 1 层、超过 188 回最后能玩的那层", () => {
    for (let i = 0; i < 60; i++) saveStar(meta.id, i, 3);
    const low = fakeMap(60);
    expect(openCampaignLevel(low.host, -20)).toBe(true);
    expect(low.opened()).toBe(0);
    const high = fakeMap(60);
    expect(openCampaignLevel(high.host, 99999)).toBe(true);
    expect(high.opened()).toBe(60);
  });

  it("按钮是灰的（真的还没解锁）就老实返回 false，不硬点", () => {
    const map = fakeMap(-1);
    expect(openCampaignLevel(map.host, 5)).toBe(false);
    expect(map.opened()).toBe(-1);
  });

  it("地图还没挂上来（查不到任何节点）也不会崩", () => {
    const empty = { querySelectorAll: () => [] } as unknown as HTMLElement;
    expect(openCampaignLevel(empty, 3)).toBe(false);
    expect(openCampaignLevel({} as HTMLElement, 3)).toBe(false);
  });
});
