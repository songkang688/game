import { describe, expect, it } from "vitest";
import {
  LEVELS,
  MAX_HEARTS,
  ObstacleKind,
  PATTERNS,
  REVIVE_COST,
  THEME_STYLE,
  clampLane,
  detectSwipe,
  isLevelUnlocked,
  missionDone,
  missionLabel,
  missionProgress,
  parseProgress,
  patternIsSurvivable,
  patternsForKinds,
  rowIsSurvivable,
  serializeProgress,
  starsForLevel,
  totalStars,
  wouldHit,
} from "./logic";

describe("rainbow-run 操作", () => {
  it("滑动方向判定与最短距离", () => {
    expect(detectSwipe(50, 5)).toBe("right");
    expect(detectSwipe(-50, 5)).toBe("left");
    expect(detectSwipe(5, -50)).toBe("up");
    expect(detectSwipe(5, 50)).toBe("down");
    expect(detectSwipe(5, 5)).toBeNull();
  });

  it("障碍与动作:跳过栏和坑,趴过杆,软糖云怪只能躲", () => {
    expect(wouldHit("hurdle", "jump")).toBe(false);
    expect(wouldHit("hurdle", "run")).toBe(true);
    expect(wouldHit("pit", "jump")).toBe(false);
    expect(wouldHit("pit", "slide")).toBe(true);
    expect(wouldHit("bar", "slide")).toBe(false);
    expect(wouldHit("bar", "jump")).toBe(true);
    expect(wouldHit("rock", "jump")).toBe(true);
    expect(wouldHit("cloudy", "slide")).toBe(true);
  });

  it("车道夹在 0..2", () => {
    expect(clampLane(-1)).toBe(0);
    expect(clampLane(3)).toBe(2);
    expect(clampLane(1)).toBe(1);
  });
});

describe("rainbow-run 战役关卡(深度)", () => {
  it("关卡数量 >= 18,数据驱动", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(18);
  });

  it("每关都有独特机制标记(feature),互不相同", () => {
    const features = LEVELS.map((l) => l.feature);
    expect(features.every((f) => f.length > 0)).toBe(true);
    expect(new Set(features).size).toBe(LEVELS.length);
  });

  it("四大主题世界,每个世界都有关卡", () => {
    const worlds = new Set(LEVELS.map((l) => l.world));
    expect(worlds.size).toBeGreaterThanOrEqual(4);
    for (const wld of worlds) expect(THEME_STYLE[wld]).toBeDefined();
  });

  it("战役合计至少 5 种障碍 + 3 种道具", () => {
    const kinds = new Set<ObstacleKind>();
    const powers = new Set<string>();
    for (const def of LEVELS) {
      for (const k of def.obstacleKinds) kinds.add(k);
      for (const p of def.powerups) powers.add(p);
    }
    expect(kinds.size).toBeGreaterThanOrEqual(5);
    expect(powers.has("magnet")).toBe(true);
    expect(powers.has("jet")).toBe(true);
    expect(powers.has("board")).toBe(true);
  });

  it("难度递进:后面的关更快更长", () => {
    expect(LEVELS[LEVELS.length - 1].len).toBeGreaterThan(LEVELS[0].len);
    const maxSpeed = Math.max(...LEVELS.map((l) => l.speed));
    expect(maxSpeed).toBeGreaterThan(LEVELS[0].speed);
    for (const def of LEVELS) {
      expect(def.len).toBeGreaterThan(800);
      expect(def.speed).toBeGreaterThan(150);
    }
  });

  it("每关都能凑出至少一组可用花样", () => {
    for (const def of LEVELS) {
      expect(patternsForKinds(def.obstacleKinds).length).toBeGreaterThan(0);
    }
  });

  it("所有预设花样都有活路", () => {
    for (const pat of PATTERNS) {
      expect(patternIsSurvivable(pat)).toBe(true);
    }
    expect(
      rowIsSurvivable({
        obstacles: [
          { lane: 0, kind: "rock" },
          { lane: 1, kind: "rock" },
          { lane: 2, kind: "rock" },
        ],
        stars: [],
        coins: [],
      }),
    ).toBe(false);
  });
});

describe("rainbow-run 任务与 3 星", () => {
  it("任务进度与完成判定", () => {
    const stats = { coins: 12, stars: 2, dodged: 30, heartsLost: 0 };
    expect(missionProgress({ type: "coins", n: 10 }, stats)).toBe(10);
    expect(missionDone({ type: "coins", n: 10 }, stats)).toBe(true);
    expect(missionDone({ type: "stars", n: 3 }, stats)).toBe(false);
    expect(missionDone({ type: "dodge", n: 30 }, stats)).toBe(true);
    expect(missionDone({ type: "noHit", n: 1 }, stats)).toBe(true);
    expect(missionDone({ type: "noHit", n: 1 }, { ...stats, heartsLost: 1 })).toBe(false);
    expect(missionLabel({ type: "coins", n: 5 })).toContain("5");
  });

  it("三星条件:任务+无伤 3 星,其一 2 星,到终点 1 星", () => {
    expect(starsForLevel(true, 0)).toBe(3);
    expect(starsForLevel(true, 2)).toBe(2);
    expect(starsForLevel(false, 0)).toBe(2);
    expect(starsForLevel(false, 2)).toBe(1);
  });

  it("复活花 3 颗星,心上限 3", () => {
    expect(REVIVE_COST).toBe(3);
    expect(MAX_HEARTS).toBe(3);
  });

  it("进度存档回环与解锁规则", () => {
    const stars = new Array(LEVELS.length).fill(0);
    stars[0] = 3;
    const parsed = parseProgress(serializeProgress(stars), LEVELS.length);
    expect(parsed[0]).toBe(3);
    expect(parseProgress("{bad", LEVELS.length)).toEqual(new Array(LEVELS.length).fill(0));
    expect(isLevelUnlocked(stars, 1)).toBe(true);
    expect(isLevelUnlocked(stars, 2)).toBe(false);
    expect(totalStars(stars)).toBe(3);
  });
});
