import { describe, expect, it } from "vitest";
import {
  HANDMADE_PER_THEME,
  LEVELS,
  LEVELS_PER_THEME,
  MAX_HEARTS,
  ObstacleKind,
  PATTERNS,
  REVIVE_COST,
  ROLLER_SPEED_MULT,
  THEME_ORDER,
  THEME_STYLE,
  ZAPPER_OFF,
  ZAPPER_ON,
  clampLane,
  detectSwipe,
  isLevelUnlocked,
  isThemeUnlocked,
  levelIndicesOfTheme,
  missionDone,
  missionLabel,
  missionProgress,
  parseProgress,
  patternIsSurvivable,
  patternsForKinds,
  rowIsSurvivable,
  serializeProgress,
  starsForLevel,
  themeCleared,
  themeOfLevel,
  themeStars,
  totalStars,
  wouldHit,
  zapperActive,
} from "./logic";

describe("rainbow-run 操作", () => {
  it("滑动方向判定与最短距离", () => {
    expect(detectSwipe(50, 5)).toBe("right");
    expect(detectSwipe(-50, 5)).toBe("left");
    expect(detectSwipe(5, -50)).toBe("up");
    expect(detectSwipe(5, 50)).toBe("down");
    expect(detectSwipe(5, 5)).toBeNull();
  });

  it("障碍与动作:跳过栏和坑,趴过杆,软糖云怪滚球电门只能躲", () => {
    expect(wouldHit("hurdle", "jump")).toBe(false);
    expect(wouldHit("hurdle", "run")).toBe(true);
    expect(wouldHit("pit", "jump")).toBe(false);
    expect(wouldHit("pit", "slide")).toBe(true);
    expect(wouldHit("bar", "slide")).toBe(false);
    expect(wouldHit("bar", "jump")).toBe(true);
    expect(wouldHit("rock", "jump")).toBe(true);
    expect(wouldHit("cloudy", "slide")).toBe(true);
    expect(wouldHit("roller", "jump")).toBe(true);
    expect(wouldHit("zapper", "slide")).toBe(true);
  });

  it("车道夹在 0..2", () => {
    expect(clampLane(-1)).toBe(0);
    expect(clampLane(3)).toBe(2);
    expect(clampLane(1)).toBe(1);
  });

  it("电光门按周期通电,滚滚球比路面快", () => {
    expect(ZAPPER_ON).toBeGreaterThan(0);
    expect(ZAPPER_OFF).toBeGreaterThan(0);
    expect(zapperActive(0, 0)).toBe(true);
    expect(zapperActive(ZAPPER_ON + 0.1, 0)).toBe(false);
    expect(zapperActive(ZAPPER_ON + ZAPPER_OFF + 0.05, 0)).toBe(true);
    expect(zapperActive(0, ZAPPER_ON + 0.1)).toBe(false);
    expect(ROLLER_SPEED_MULT).toBeGreaterThan(1);
  });
});

describe("rainbow-run 99 关九大世界", () => {
  it("正好 99 关 = 9 章 × 11 关", () => {
    expect(LEVELS.length).toBe(99);
    expect(THEME_ORDER.length).toBe(9);
    expect(LEVELS_PER_THEME).toBe(11);
    expect(THEME_ORDER.length * LEVELS_PER_THEME).toBe(99);
  });

  it("章内关卡世界一致,顺序与 THEME_ORDER 对应", () => {
    for (let ci = 0; ci < THEME_ORDER.length; ci++) {
      for (const li of levelIndicesOfTheme(ci)) {
        expect(LEVELS[li].world).toBe(THEME_ORDER[ci]);
        expect(themeOfLevel(li)).toBe(THEME_ORDER[ci]);
      }
    }
  });

  it("每章至少 8 关手写(非生成)且布局互不相同", () => {
    for (let ci = 0; ci < THEME_ORDER.length; ci++) {
      const chapter = levelIndicesOfTheme(ci).map((i) => LEVELS[i]);
      const hand = chapter.filter((l) => !l.gen);
      expect(hand.length).toBeGreaterThanOrEqual(HANDMADE_PER_THEME);
      // 布局签名 = 障碍组合 + 任务;整章 11 关都互不相同
      const sigs = new Set(
        chapter.map(
          (l) => `${[...l.obstacleKinds].sort().join(",")}|${l.mission.type}:${l.mission.n}`,
        ),
      );
      expect(sigs.size).toBe(chapter.length);
    }
  });

  it("生成关卡的障碍组合不重复同一模板(全局唯一)", () => {
    const gens = LEVELS.filter((l) => l.gen);
    expect(gens.length).toBe(THEME_ORDER.length * (LEVELS_PER_THEME - HANDMADE_PER_THEME));
    const sigs = new Set(gens.map((l) => `${l.world}|${[...l.obstacleKinds].sort().join(",")}`));
    expect(sigs.size).toBe(gens.length);
  });

  it("99 关每关都有全局唯一的机制标记", () => {
    const feats = new Set(LEVELS.map((l) => l.feature));
    expect(feats.size).toBe(99);
    for (const l of LEVELS) expect(l.feature.length).toBeGreaterThan(0);
  });

  it("九个世界配色两两不同,障碍组合(palette)两两不同", () => {
    const tops = new Set(THEME_ORDER.map((t) => THEME_STYLE[t].skyTop));
    expect(tops.size).toBe(9);
    const lane0 = new Set(THEME_ORDER.map((t) => THEME_STYLE[t].lanes[0]));
    expect(lane0.size).toBe(9);
    const palettes = new Set(
      THEME_ORDER.map((t) => [...THEME_STYLE[t].palette].sort().join(",")),
    );
    expect(palettes.size).toBe(9);
    for (const t of THEME_ORDER) {
      expect(THEME_STYLE[t].name).toBeTruthy();
      expect(THEME_STYLE[t].skyTop).toMatch(/^#/);
    }
  });

  it("关卡障碍不越出所在世界的 palette,战役覆盖全部 7 种障碍", () => {
    for (const l of LEVELS) {
      const allowed = new Set(THEME_STYLE[l.world].palette);
      for (const k of l.obstacleKinds) expect(allowed.has(k)).toBe(true);
    }
    const all = new Set(LEVELS.flatMap((l) => l.obstacleKinds));
    expect(all.size).toBe(7);
  });

  it("速度和长度随世界递增,最终关最长", () => {
    for (const l of LEVELS) {
      expect(l.len).toBeGreaterThan(800);
      expect(l.speed).toBeGreaterThan(150);
    }
    const w0max = Math.max(...levelIndicesOfTheme(0).map((i) => LEVELS[i].speed));
    const w8min = Math.min(...levelIndicesOfTheme(8).map((i) => LEVELS[i].speed));
    expect(w8min).toBeGreaterThan(w0max);
    expect(LEVELS[98].len).toBe(Math.max(...LEVELS.map((l) => l.len)));
  });

  it("每个世界都有 noHit 挑战和道具关", () => {
    for (let ci = 0; ci < THEME_ORDER.length; ci++) {
      const chapter = levelIndicesOfTheme(ci).map((i) => LEVELS[i]);
      expect(chapter.some((l) => l.mission.type === "noHit")).toBe(true);
      expect(chapter.some((l) => l.powerups.length > 0)).toBe(true);
    }
  });

  it("每关的任务都能用花样池达成(有对应障碍/奖励)", () => {
    for (const l of LEVELS) {
      const pool = patternsForKinds(l.obstacleKinds);
      expect(pool.length).toBeGreaterThan(0);
      for (const pat of pool) expect(patternIsSurvivable(pat)).toBe(true);
    }
  });
});

describe("rainbow-run 花样与活路", () => {
  it("所有内置花样都有活路", () => {
    for (const pat of PATTERNS) {
      expect(patternIsSurvivable(pat)).toBe(true);
    }
  });

  it("三条道全是只能躲的障碍就没活路", () => {
    expect(
      rowIsSurvivable({
        obstacles: [
          { lane: 0, kind: "rock" },
          { lane: 1, kind: "roller" },
          { lane: 2, kind: "zapper" },
        ],
        stars: [],
        coins: [],
      }),
    ).toBe(false);
    expect(
      rowIsSurvivable({
        obstacles: [
          { lane: 0, kind: "rock" },
          { lane: 1, kind: "hurdle" },
          { lane: 2, kind: "rock" },
        ],
        stars: [],
        coins: [],
      }),
    ).toBe(true);
  });

  it("patternsForKinds 只保留可用障碍的花样", () => {
    const only = patternsForKinds(["rock"]);
    for (const pat of only) {
      for (const row of pat) {
        for (const o of row.obstacles) expect(o.kind).toBe("rock" as ObstacleKind);
      }
    }
    const withZapper = patternsForKinds(["rock", "hurdle", "bar", "zapper"]);
    expect(withZapper.length).toBeGreaterThan(patternsForKinds(["rock"]).length);
  });
});

describe("rainbow-run 任务", () => {
  it("四种任务的进度与完成判定", () => {
    const stats = { coins: 12, stars: 2, dodged: 30, heartsLost: 0 };
    expect(missionProgress({ type: "coins", n: 10 }, stats)).toBe(10);
    expect(missionDone({ type: "coins", n: 10 }, stats)).toBe(true);
    expect(missionDone({ type: "stars", n: 3 }, stats)).toBe(false);
    expect(missionDone({ type: "dodge", n: 30 }, stats)).toBe(true);
    expect(missionDone({ type: "noHit", n: 1 }, stats)).toBe(true);
    expect(missionDone({ type: "noHit", n: 1 }, { ...stats, heartsLost: 1 })).toBe(false);
  });

  it("任务文案齐全", () => {
    expect(missionLabel({ type: "coins", n: 10 })).toContain("10");
    expect(missionLabel({ type: "stars", n: 3 })).toContain("3");
    expect(missionLabel({ type: "dodge", n: 5 })).toContain("5");
    expect(missionLabel({ type: "noHit", n: 1 }).length).toBeGreaterThan(0);
  });
});

describe("rainbow-run 星级与进度", () => {
  it("任务+无伤 3 星;其一 2 星;仅通关 1 星", () => {
    expect(starsForLevel(true, 0)).toBe(3);
    expect(starsForLevel(true, 1)).toBe(2);
    expect(starsForLevel(false, 0)).toBe(2);
    expect(starsForLevel(false, 2)).toBe(1);
    expect(MAX_HEARTS).toBe(3);
    expect(REVIVE_COST).toBeGreaterThan(0);
  });

  it("进度序列化往返一致,坏档当新档", () => {
    const stars = new Array(LEVELS.length).fill(0);
    stars[0] = 3;
    const restored = parseProgress(serializeProgress(stars), LEVELS.length);
    expect(restored[0]).toBe(3);
    expect(restored[1]).toBe(0);
    expect(parseProgress(null, 3)).toEqual([0, 0, 0]);
    expect(parseProgress("bad", 3)).toEqual([0, 0, 0]);
    expect(parseProgress(JSON.stringify([9, -2]), 2)).toEqual([3, 0]);
  });

  it("第一关默认解锁,通过才解锁下一关", () => {
    const stars = new Array(LEVELS.length).fill(0);
    expect(isLevelUnlocked(stars, 0)).toBe(true);
    expect(isLevelUnlocked(stars, 1)).toBe(false);
    stars[0] = 2;
    expect(isLevelUnlocked(stars, 1)).toBe(true);
    expect(totalStars(stars)).toBe(2);
  });

  it("章节解锁:通关上一章终点关才开下一个世界", () => {
    const stars = new Array(LEVELS.length).fill(0);
    expect(isThemeUnlocked(stars, 0)).toBe(true);
    expect(isThemeUnlocked(stars, 1)).toBe(false);
    for (let i = 0; i < LEVELS_PER_THEME; i++) stars[i] = 3;
    expect(isThemeUnlocked(stars, 1)).toBe(true);
    expect(isThemeUnlocked(stars, 2)).toBe(false);
    expect(themeStars(stars, 0)).toBe(LEVELS_PER_THEME * 3);
    expect(themeCleared(stars, 0)).toBe(LEVELS_PER_THEME);
    expect(themeCleared(stars, 1)).toBe(0);
  });
});
