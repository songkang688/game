import { describe, expect, it } from "vitest";
import {
  MAGNET_SECONDS,
  MAX_HEARTS,
  PATTERNS,
  SECTIONS,
  SHOP_ITEMS,
  THEME_STYLE,
  TOTAL_LEN,
  canBuy,
  clampLane,
  detectSwipe,
  patternIsSurvivable,
  rowIsSurvivable,
  sectionAt,
  sectionStart,
  starsForRun,
  wouldHit,
} from "./logic";

describe("rainbow-run 操作", () => {
  it("滑动方向判定", () => {
    expect(detectSwipe(50, 5)).toBe("right");
    expect(detectSwipe(-50, 5)).toBe("left");
    expect(detectSwipe(5, -50)).toBe("up");
    expect(detectSwipe(5, 50)).toBe("down");
    expect(detectSwipe(5, 5)).toBeNull();
  });

  it("跳过栅栏、趴过横杆、软糖必须躲", () => {
    expect(wouldHit("hurdle", "jump")).toBe(false);
    expect(wouldHit("hurdle", "run")).toBe(true);
    expect(wouldHit("bar", "slide")).toBe(false);
    expect(wouldHit("bar", "jump")).toBe(true);
    expect(wouldHit("rock", "jump")).toBe(true);
    expect(wouldHit("rock", "slide")).toBe(true);
  });

  it("车道限制在 0..2", () => {
    expect(clampLane(-1)).toBe(0);
    expect(clampLane(3)).toBe(2);
    expect(clampLane(1)).toBe(1);
  });
});

describe("rainbow-run 赛段", () => {
  it("至少 5 段且覆盖草地/天空/糖果三个主题", () => {
    expect(SECTIONS.length).toBeGreaterThanOrEqual(5);
    const themes = new Set(SECTIONS.map((s) => s.theme));
    expect(themes.has("grass")).toBe(true);
    expect(themes.has("sky")).toBe(true);
    expect(themes.has("candy")).toBe(true);
  });

  it("赛段速度递增,总长等于各段之和", () => {
    for (let i = 1; i < SECTIONS.length; i++) {
      expect(SECTIONS[i].speed).toBeGreaterThan(SECTIONS[i - 1].speed);
    }
    expect(TOTAL_LEN).toBe(SECTIONS.reduce((s, x) => s + x.len, 0));
  });

  it("按里程找赛段:边界正确且封顶", () => {
    expect(sectionAt(0)).toBe(0);
    expect(sectionAt(SECTIONS[0].len - 1)).toBe(0);
    expect(sectionAt(SECTIONS[0].len)).toBe(1);
    expect(sectionAt(TOTAL_LEN + 999)).toBe(SECTIONS.length - 1);
    expect(sectionStart(0)).toBe(0);
    expect(sectionStart(2)).toBe(SECTIONS[0].len + SECTIONS[1].len);
  });

  it("三个主题都有配色", () => {
    expect(THEME_STYLE.grass.lanes).toHaveLength(3);
    expect(THEME_STYLE.sky.skyTop).toMatch(/^#/);
    expect(THEME_STYLE.candy.deco).toMatch(/^#/);
  });
});

describe("rainbow-run 障碍花样", () => {
  it("每个花样每一行都留了活路", () => {
    for (const pattern of PATTERNS) {
      expect(patternIsSurvivable(pattern)).toBe(true);
    }
  });

  it("三条道全是软糖就没有活路", () => {
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

  it("花样里车道编号合法", () => {
    for (const pattern of PATTERNS) {
      for (const row of pattern) {
        for (const o of row.obstacles) {
          expect(o.lane).toBeGreaterThanOrEqual(0);
          expect(o.lane).toBeLessThan(3);
        }
        for (const l of [...row.stars, ...row.coins]) {
          expect(l).toBeGreaterThanOrEqual(0);
          expect(l).toBeLessThan(3);
        }
      }
    }
  });
});

describe("rainbow-run 商店与结算", () => {
  it("商店有护盾和磁铁,金币够才能买", () => {
    expect(SHOP_ITEMS.map((i) => i.id).sort()).toEqual(["magnet", "shield"]);
    const shield = SHOP_ITEMS.find((i) => i.id === "shield")!;
    expect(canBuy(shield.cost, shield)).toBe(true);
    expect(canBuy(shield.cost - 1, shield)).toBe(false);
    expect(MAGNET_SECONDS).toBeGreaterThan(0);
  });

  it("星级由重试与掉心决定", () => {
    expect(MAX_HEARTS).toBe(3);
    expect(starsForRun(0, 0)).toBe(3);
    expect(starsForRun(0, 1)).toBe(3);
    expect(starsForRun(0, 3)).toBe(2);
    expect(starsForRun(1, 1)).toBe(2);
    expect(starsForRun(2, 0)).toBe(1);
  });
});
